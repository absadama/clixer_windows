/**
 * Clixer - Security Helpers
 * SQL Injection koruması, Input validation, Sanitization, Encryption
 */

import crypto from 'crypto';
import createLogger from './logger';

const logger = createLogger({ service: 'security' });

// ============================================
// ENCRYPTION (AES-256-GCM)
// ============================================

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bit IV
const AUTH_TAG_LENGTH = 16; // 128 bit auth tag
const SALT_LENGTH = 32;

// Encryption key - TÜM ORTAMLARDA ZORUNLU
// SECURITY: Development fallback kaldırıldı - güvenlik riski
const ENCRYPTION_KEY = (() => {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    logger.error('CRITICAL: ENCRYPTION_KEY environment variable is required!');
    throw new Error('ENCRYPTION_KEY environment variable is required. Generate with: openssl rand -hex 32');
  }
  
  // SECURITY FIX: Key doğrudan 32 byte olmalı
  // Hex format: 64 karakter (openssl rand -hex 32)
  // Base64 format: ~44 karakter
  
  // Hex format kontrolü (64 karakter hex = 32 byte)
  if (/^[a-fA-F0-9]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }
  
  // Base64 format kontrolü
  try {
    const decoded = Buffer.from(key, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }
  } catch {
    // Base64 decode başarısız
  }
  
  // SECURITY: Kısa key için daha güçlü derivation
  // Salt olarak key'in hash'ini kullan (sabit salt yerine)
  // Bu sayede farklı key'ler farklı salt'lar üretir
  logger.warn('ENCRYPTION_KEY is not 32 bytes, deriving key. Consider using: openssl rand -hex 32');
  const keySalt = crypto.createHash('sha256').update(key + 'clixer_key_derivation_v2').digest();
  return crypto.scryptSync(key, keySalt, 32, { N: 16384, r: 8, p: 1 });
})();

/**
 * Veriyi AES-256-GCM ile şifrele
 * Format: base64(iv + authTag + encryptedData)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    // IV + AuthTag + EncryptedData birleştir
    const combined = Buffer.concat([iv, authTag, encrypted]);
    
    return combined.toString('base64');
  } catch (error: any) {
    logger.error('Encryption failed', { error: error.message });
    throw new Error('Şifreleme başarısız');
  }
}

/**
 * AES-256-GCM ile şifrelenmiş veriyi çöz
 */
export function decrypt(encryptedData: string): string {
  if (!encryptedData) return '';
  
  try {
    const combined = Buffer.from(encryptedData, 'base64');
    
    // IV, AuthTag ve EncryptedData ayır
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error: any) {
    // Eski format (base64 encoded plain text) olabilir - backward compatibility
    try {
      const decoded = Buffer.from(encryptedData, 'base64').toString('utf8');
      // Eğer decode edilebiliyorsa ve makul bir string ise, eski format
      if (decoded && decoded.length > 0 && decoded.length < 1000) {
        logger.warn('Legacy base64 password detected, should be migrated');
        return decoded;
      }
    } catch {
      // Base64 decode da başarısız, plain text olabilir
    }
    
    logger.error('Decryption failed', { error: error.message });
    throw new Error('Şifre çözme başarısız');
  }
}

/**
 * Verinin şifreli olup olmadığını kontrol et
 * AES-256-GCM formatında mı?
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;
  
  try {
    const combined = Buffer.from(data, 'base64');
    // Minimum uzunluk: IV(16) + AuthTag(16) + MinData(1) = 33
    return combined.length >= 33;
  } catch {
    return false;
  }
}

/**
 * Eski formatı (base64 veya plain text) yeni formata migrate et
 */
export function migratePassword(oldPassword: string): string {
  if (!oldPassword) return '';
  
  // Zaten şifreli mi?
  if (isEncrypted(oldPassword)) {
    try {
      decrypt(oldPassword); // Doğrula
      return oldPassword; // Zaten doğru formatta
    } catch {
      // Şifreli gibi görünüyor ama çözülemedi - yeniden şifrele
    }
  }
  
  // Base64 decode dene
  let plainPassword = oldPassword;
  try {
    const decoded = Buffer.from(oldPassword, 'base64').toString('utf8');
    // Base64 ise ve makul bir string ise
    if (decoded && decoded.length > 0 && decoded.length < oldPassword.length) {
      plainPassword = decoded;
    }
  } catch {
    // Base64 değil, plain text olarak devam et
  }
  
  // Yeni formatla şifrele
  return encrypt(plainPassword);
}

// ============================================
// SQL INJECTION KORUMASI
// ============================================

/**
 * Güvenli tablo adı kontrolü (whitelist)
 * Sadece alfanumerik, underscore ve nokta kabul edilir
 */
export function sanitizeTableName(tableName: string): string {
  if (!tableName || typeof tableName !== 'string') {
    throw new Error('Geçersiz tablo adı');
  }
  
  // Sadece alfanumerik, underscore, nokta ve tire kabul et
  const sanitized = tableName.replace(/[^a-zA-Z0-9_.\-]/g, '');
  
  if (sanitized !== tableName) {
    logger.warn('Table name sanitized', { original: tableName, sanitized });
  }
  
  // Minimum uzunluk kontrolü
  if (sanitized.length < 1 || sanitized.length > 128) {
    throw new Error('Tablo adı geçersiz uzunlukta');
  }
  
  return sanitized;
}

/**
 * Güvenli kolon adı kontrolü (whitelist)
 */
export function sanitizeColumnName(columnName: string): string {
  if (!columnName || typeof columnName !== 'string') {
    throw new Error('Geçersiz kolon adı');
  }
  
  // Sadece alfanumerik ve underscore kabul et
  const sanitized = columnName.replace(/[^a-zA-Z0-9_]/g, '');
  
  if (sanitized !== columnName) {
    logger.warn('Column name sanitized', { original: columnName, sanitized });
  }
  
  if (sanitized.length < 1 || sanitized.length > 64) {
    throw new Error('Kolon adı geçersiz uzunlukta');
  }
  
  return sanitized;
}

/**
 * Güvenli aggregation fonksiyonu kontrolü (strict whitelist)
 */
const ALLOWED_AGG_FUNCTIONS = [
  'sum', 'count', 'avg', 'min', 'max', 
  'uniq', 'uniqExact', 'any', 'anyLast',
  'SUM', 'COUNT', 'AVG', 'MIN', 'MAX',
  'UNIQ', 'UNIQEXACT', 'ANY', 'ANYLAST'
];

export function sanitizeAggFunction(aggFunc: string): string {
  if (!aggFunc || typeof aggFunc !== 'string') {
    throw new Error('Geçersiz aggregation fonksiyonu');
  }
  
  // Fonksiyon adını çıkar (örn: "sum(amount)" -> "sum")
  const match = aggFunc.match(/^(\w+)\s*\(/);
  const funcName = match ? match[1] : aggFunc;
  
  if (!ALLOWED_AGG_FUNCTIONS.includes(funcName)) {
    logger.error('Invalid aggregation function attempt', { aggFunc, funcName });
    throw new Error(`Geçersiz aggregation fonksiyonu: ${funcName}`);
  }
  
  // Parantez içindeki kolon adını da sanitize et
  const columnMatch = aggFunc.match(/\(([^)]+)\)/);
  if (columnMatch) {
    const column = sanitizeColumnName(columnMatch[1].trim());
    return `${funcName.toLowerCase()}(${column})`;
  }
  
  return funcName.toLowerCase();
}

/**
 * Güvenli tarih string kontrolü (YYYY-MM-DD formatı)
 */
export function sanitizeDateString(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error('Geçersiz tarih');
  }
  
  // YYYY-MM-DD veya YYYY-MM-DD HH:mm:ss formatı
  const datePattern = /^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2})?$/;
  
  if (!datePattern.test(dateStr)) {
    logger.warn('Invalid date format', { dateStr });
    throw new Error('Geçersiz tarih formatı (YYYY-MM-DD bekleniyor)');
  }
  
  return dateStr;
}

/**
 * Güvenli sayısal değer kontrolü
 */
export function sanitizeNumber(value: any, defaultValue: number = 0): number {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  
  const num = Number(value);
  
  if (isNaN(num) || !isFinite(num)) {
    logger.warn('Invalid number sanitized', { value, defaultValue });
    return defaultValue;
  }
  
  return num;
}

/**
 * Güvenli limit kontrolü (maksimum değer sınırı)
 */
export function sanitizeLimit(limit: any, maxLimit: number = 10000): number {
  const num = sanitizeNumber(limit, 100);
  return Math.min(Math.max(1, num), maxLimit);
}

/**
 * Güvenli offset kontrolü
 */
export function sanitizeOffset(offset: any): number {
  const num = sanitizeNumber(offset, 0);
  return Math.max(0, num);
}

// ============================================
// INPUT VALIDATION
// ============================================

/**
 * Email format kontrolü
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailPattern.test(email) && email.length <= 255;
}

/**
 * UUID format kontrolü
 */
export function isValidUUID(uuid: string): boolean {
  if (!uuid || typeof uuid !== 'string') return false;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
}

/**
 * Güvenli string kontrolü (XSS koruması)
 */
export function sanitizeString(str: string, maxLength: number = 1000): string {
  if (!str || typeof str !== 'string') return '';
  
  // HTML karakterlerini escape et
  const escaped = str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Maksimum uzunluk kontrolü
  return escaped.substring(0, maxLength);
}

/**
 * SQL keyword kontrolü (tehlikeli keyword'ler)
 */
const DANGEROUS_SQL_KEYWORDS = [
  'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 'UPDATE',
  'EXEC', 'EXECUTE', 'UNION', 'SCRIPT', '--', ';', '/*', '*/'
];

export function containsDangerousSQLKeywords(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  
  const upperInput = input.toUpperCase();
  return DANGEROUS_SQL_KEYWORDS.some(keyword => upperInput.includes(keyword));
}

/**
 * Güvenli SQL koşul oluşturma (RLS için)
 */
export function buildSafeWhereCondition(
  column: string,
  value: string | number,
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' = '='
): string {
  const safeColumn = sanitizeColumnName(column);
  
  if (typeof value === 'number') {
    return `${safeColumn} ${operator} ${sanitizeNumber(value)}`;
  }
  
  // String değerler için escape
  const safeValue = String(value).replace(/'/g, "''");
  return `${safeColumn} ${operator} '${safeValue}'`;
}

// ============================================
// RATE LIMITING HELPERS
// ============================================

/**
 * IP adresini normalize et (proxy arkasında gerçek IP)
 */
export function getClientIP(req: any): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

// ============================================
// AUDIT LOGGING
// ============================================

export interface AuditLogEntry {
  userId: string;
  tenantId: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: Date;
}

/**
 * Audit log oluştur (güvenlik olayları için)
 */
export function createAuditLog(entry: Omit<AuditLogEntry, 'timestamp'>): AuditLogEntry {
  const log: AuditLogEntry = {
    ...entry,
    timestamp: new Date()
  };
  
  logger.info('AUDIT', log);
  return log;
}

// ============================================
// PASSWORD POLICY
// ============================================

export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
  specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
  strength: 'weak' | 'medium' | 'strong' | 'very_strong';
  score: number;
}

/**
 * Şifre politikası doğrulama
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  let score = 0;
  
  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Şifre gerekli'], strength: 'weak', score: 0 };
  }
  
  // Minimum uzunluk
  if (password.length < PASSWORD_POLICY.minLength) {
    errors.push(`Şifre en az ${PASSWORD_POLICY.minLength} karakter olmalı`);
  } else {
    score += 1;
  }
  
  // Maksimum uzunluk
  if (password.length > PASSWORD_POLICY.maxLength) {
    errors.push(`Şifre en fazla ${PASSWORD_POLICY.maxLength} karakter olabilir`);
  }
  
  // Büyük harf
  if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Şifre en az 1 büyük harf içermeli');
  } else if (/[A-Z]/.test(password)) {
    score += 1;
  }
  
  // Küçük harf
  if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Şifre en az 1 küçük harf içermeli');
  } else if (/[a-z]/.test(password)) {
    score += 1;
  }
  
  // Rakam
  if (PASSWORD_POLICY.requireNumber && !/[0-9]/.test(password)) {
    errors.push('Şifre en az 1 rakam içermeli');
  } else if (/[0-9]/.test(password)) {
    score += 1;
  }
  
  // Özel karakter
  const specialRegex = new RegExp(`[${PASSWORD_POLICY.specialChars.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}]`);
  if (PASSWORD_POLICY.requireSpecial && !specialRegex.test(password)) {
    errors.push('Şifre en az 1 özel karakter içermeli (!@#$%^&*...)');
  } else if (specialRegex.test(password)) {
    score += 1;
  }
  
  // Ekstra puan: uzunluk
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  
  // Güç hesaplama
  let strength: 'weak' | 'medium' | 'strong' | 'very_strong' = 'weak';
  if (score >= 7) strength = 'very_strong';
  else if (score >= 5) strength = 'strong';
  else if (score >= 3) strength = 'medium';
  
  return {
    valid: errors.length === 0,
    errors,
    strength,
    score
  };
}

/**
 * Şifre gücü yüzdesi (UI için)
 */
export function getPasswordStrength(password: string): number {
  const result = validatePassword(password);
  return Math.min(100, Math.round((result.score / 7) * 100));
}

// ============================================
// SSRF (Server-Side Request Forgery) KORUMASI
// ============================================

/**
 * Private/Internal IP aralıkları
 * RFC 1918 + RFC 5737 + RFC 3927 + Loopback + Link-local
 */
const PRIVATE_IP_RANGES = [
  // IPv4 Private
  { start: '10.0.0.0', end: '10.255.255.255' },       // Class A
  { start: '172.16.0.0', end: '172.31.255.255' },     // Class B
  { start: '192.168.0.0', end: '192.168.255.255' },   // Class C
  // Loopback
  { start: '127.0.0.0', end: '127.255.255.255' },
  // Link-local
  { start: '169.254.0.0', end: '169.254.255.255' },
  // CGNAT
  { start: '100.64.0.0', end: '100.127.255.255' },
  // Documentation/Test
  { start: '192.0.2.0', end: '192.0.2.255' },
  { start: '198.51.100.0', end: '198.51.100.255' },
  { start: '203.0.113.0', end: '203.0.113.255' },
  // Broadcast
  { start: '255.255.255.255', end: '255.255.255.255' },
  // Current network
  { start: '0.0.0.0', end: '0.255.255.255' }
];

/**
 * Yasaklı hostnameler (cloud metadata, internal services)
 */
const BLOCKED_HOSTNAMES = [
  // Cloud metadata endpoints
  '169.254.169.254',           // AWS/GCP/Azure metadata
  'metadata.google.internal',   // GCP
  'metadata.goog',              // GCP
  'metadata.google',            // GCP
  'metadata.azure.com',         // Azure
  'metadata.azure',             // Azure
  // Localhost variants
  'localhost',
  'localhost.localdomain',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
  // Internal service discovery
  'kubernetes.default',
  'kubernetes.default.svc',
  '.internal',
  '.local',
  '.localhost',
  // Docker
  'host.docker.internal',
  'gateway.docker.internal'
];

/**
 * Yasaklı URL scheme'leri
 */
const BLOCKED_SCHEMES = ['file', 'ftp', 'gopher', 'data', 'javascript', 'vbscript'];

/**
 * IP adresini sayısal değere dönüştür (karşılaştırma için)
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

/**
 * IP adresinin private/internal olup olmadığını kontrol et
 */
export function isPrivateIP(ip: string): boolean {
  // IPv6 loopback
  if (ip === '::1' || ip === '[::1]') return true;
  
  // IPv6 private ranges (basitleştirilmiş)
  if (ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80')) return true;
  
  const ipNum = ipToNumber(ip);
  if (ipNum === -1) return true; // Geçersiz IP = engelle
  
  for (const range of PRIVATE_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }
  
  return false;
}

/**
 * Hostname'in yasaklı olup olmadığını kontrol et
 */
export function isBlockedHostname(hostname: string): boolean {
  if (!hostname) return true;
  
  const lowerHostname = hostname.toLowerCase().trim();
  
  // Direkt eşleşme
  if (BLOCKED_HOSTNAMES.includes(lowerHostname)) return true;
  
  // Suffix eşleşme (.internal, .local, etc.)
  for (const blocked of BLOCKED_HOSTNAMES) {
    if (blocked.startsWith('.') && lowerHostname.endsWith(blocked)) {
      return true;
    }
  }
  
  // IP adresi ise private kontrolü
  if (/^\d+\.\d+\.\d+\.\d+$/.test(lowerHostname)) {
    return isPrivateIP(lowerHostname);
  }
  
  // IPv6 bracket notation
  if (lowerHostname.startsWith('[') && lowerHostname.endsWith(']')) {
    const ipv6 = lowerHostname.slice(1, -1);
    if (ipv6 === '::1' || ipv6.startsWith('fc') || ipv6.startsWith('fd')) {
      return true;
    }
  }
  
  return false;
}

/**
 * URL'nin güvenli olup olmadığını doğrula (SSRF koruması)
 * @returns { valid: boolean, error?: string, url?: URL }
 */
export function validateExternalUrl(urlString: string): { valid: boolean; error?: string; url?: URL } {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'URL gerekli' };
  }
  
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return { valid: false, error: 'Geçersiz URL formatı' };
  }
  
  // Scheme kontrolü
  const scheme = url.protocol.replace(':', '').toLowerCase();
  if (BLOCKED_SCHEMES.includes(scheme)) {
    logger.warn('SSRF: Blocked scheme attempted', { url: urlString, scheme });
    return { valid: false, error: `Yasaklı protokol: ${scheme}` };
  }
  
  // Sadece HTTP/HTTPS izin ver
  if (!['http', 'https'].includes(scheme)) {
    return { valid: false, error: 'Sadece HTTP/HTTPS desteklenir' };
  }
  
  // Hostname kontrolü
  const hostname = url.hostname.toLowerCase();
  if (isBlockedHostname(hostname)) {
    logger.warn('SSRF: Blocked hostname attempted', { url: urlString, hostname });
    return { valid: false, error: 'Bu adrese erişim engellenmiştir (internal/private network)' };
  }
  
  // Port kontrolü - standart dışı portlar için uyarı (opsiyonel engelleme)
  const port = url.port ? parseInt(url.port) : (scheme === 'https' ? 443 : 80);
  const suspiciousPorts = [22, 23, 25, 3306, 5432, 6379, 27017, 9200]; // SSH, Telnet, SMTP, MySQL, PostgreSQL, Redis, MongoDB, Elasticsearch
  if (suspiciousPorts.includes(port)) {
    logger.warn('SSRF: Suspicious port attempted', { url: urlString, port });
    return { valid: false, error: `Şüpheli port: ${port}` };
  }
  
  // Credential in URL kontrolü (bilgi sızıntısı)
  if (url.username || url.password) {
    return { valid: false, error: 'URL içinde kullanıcı bilgisi kullanılamaz' };
  }
  
  return { valid: true, url };
}

/**
 * SSRF korumalı fetch wrapper
 * External API çağrıları için kullanılmalı
 * SECURITY: DNS rebinding koruması dahil
 */
export async function safeFetch(
  urlString: string, 
  options: RequestInit = {},
  allowedDomains?: string[]
): Promise<Response> {
  // URL doğrulama
  const validation = validateExternalUrl(urlString);
  if (!validation.valid || !validation.url) {
    throw new Error(`SSRF koruması: ${validation.error}`);
  }
  
  // Opsiyonel: Sadece belirli domainlere izin ver
  if (allowedDomains && allowedDomains.length > 0) {
    const hostname = validation.url.hostname.toLowerCase();
    const isAllowed = allowedDomains.some(domain => {
      const d = domain.toLowerCase();
      return hostname === d || hostname.endsWith('.' + d);
    });
    if (!isAllowed) {
      logger.warn('SSRF: Domain not in allowlist', { url: urlString, hostname, allowedDomains });
      throw new Error(`Bu domain izin listesinde değil: ${hostname}`);
    }
  }
  
  // SECURITY FIX: DNS rebinding koruması
  // DNS çözümlemesi yapıp resolved IP'nin private olmadığını doğrula
  const hostname = validation.url.hostname;
  // IP adresi değilse DNS kontrolü yap
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    const dnsValidation = await resolveAndValidateHost(hostname);
    if (!dnsValidation.valid) {
      throw new Error(`SSRF koruması (DNS): ${dnsValidation.error}`);
    }
  }
  
  // Timeout ekle (default 30 saniye)
  const fetchOptions: RequestInit = {
    ...options,
    signal: options.signal || AbortSignal.timeout(30000)
  };
  
  logger.debug('Safe fetch', { url: urlString, method: options.method || 'GET' });
  
  return fetch(urlString, fetchOptions);
}

/**
 * DNS rebinding koruması için hostname çözümleme
 * (İleri seviye koruma - opsiyonel)
 */
export async function resolveAndValidateHost(hostname: string): Promise<{ valid: boolean; error?: string; ip?: string }> {
  // Node.js dns modülü ile çözümle
  try {
    const dns = await import('dns').then(m => m.promises);
    const addresses = await dns.resolve4(hostname);
    
    for (const ip of addresses) {
      if (isPrivateIP(ip)) {
        logger.warn('SSRF: DNS resolved to private IP', { hostname, ip });
        return { valid: false, error: `Hostname private IP'ye çözümlendi: ${ip}` };
      }
    }
    
    return { valid: true, ip: addresses[0] };
  } catch (error: any) {
    // DNS çözümlenemedi - muhtemelen invalid hostname
    return { valid: false, error: `DNS çözümlenemedi: ${hostname}` };
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  // Encryption
  encrypt,
  decrypt,
  isEncrypted,
  migratePassword,
  
  // SQL Injection koruması
  sanitizeTableName,
  sanitizeColumnName,
  sanitizeAggFunction,
  sanitizeDateString,
  sanitizeNumber,
  sanitizeLimit,
  sanitizeOffset,
  
  // Input validation
  isValidEmail,
  isValidUUID,
  sanitizeString,
  containsDangerousSQLKeywords,
  buildSafeWhereCondition,
  
  // Rate limiting
  getClientIP,
  
  // Audit
  createAuditLog,
  
  // Password Policy
  validatePassword,
  getPasswordStrength,
  PASSWORD_POLICY,
  
  // SSRF Protection
  isPrivateIP,
  isBlockedHostname,
  validateExternalUrl,
  safeFetch,
  resolveAndValidateHost
};
