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

// Encryption key - production'da zorunlu
const ENCRYPTION_KEY = (() => {
  const key = process.env.ENCRYPTION_KEY;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!key && isProduction) {
    logger.error('CRITICAL: ENCRYPTION_KEY environment variable is required in production!');
    throw new Error('ENCRYPTION_KEY environment variable is required in production');
  }
  
  if (!key) {
    logger.warn('ENCRYPTION_KEY not set, using development fallback. DO NOT use in production!');
    // Development için 32-byte key (256 bit)
    return crypto.scryptSync('clixer_dev_encryption_key', 'clixer_salt', 32);
  }
  
  // Key 32 byte (256 bit) olmalı - eğer değilse derive et
  if (Buffer.from(key, 'base64').length === 32) {
    return Buffer.from(key, 'base64');
  }
  return crypto.scryptSync(key, 'clixer_encryption_salt', 32);
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
  PASSWORD_POLICY
};
