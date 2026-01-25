/**
 * Clixer - Auth Service
 * Login, JWT, 2FA, Password management
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import {
  createLogger,
  requestLogger,
  db,
  cache,
  auth,
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  authenticate,
  authenticateWithOptionalPurpose,
  AppError,
  formatError,
  ValidationError,
  AuthenticationError,
  isUserBlacklisted
} from '@clixer/shared';

const logger = createLogger({ service: 'auth-service' });
const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 4001;

// Middleware
app.use(helmet());

// CORS - Servisler gateway arkasında, sadece internal erişim
// Production'da sadece gateway'den gelen isteklere izin ver
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? ['http://localhost:3000', 'http://127.0.0.1:3000'] // Gateway
  : true; // Development'ta tüm originler
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// Rate limiting - Genel limit
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, errorCode: 'RATE_LIMIT', message: 'Çok fazla istek' },
  // Verify ve health endpoint'leri hariç tut
  skip: (req) => req.path === '/verify' || req.path === '/health'
});

// Login için daha sıkı rate limit (brute-force koruması)
const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 dakika
  max: 20, // 5 dakikada max 20 login denemesi (dev için makul)
  message: { success: false, errorCode: 'RATE_LIMIT', message: 'Çok fazla giriş denemesi. 5 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// SECURITY: Token refresh için rate limit (token theft koruması)
// Saldırgan çalınan refresh token'ı unlimited yenileyemez
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 30, // 15 dakikada max 30 refresh (normal kullanımda yeterli)
  message: { success: false, errorCode: 'RATE_LIMIT', message: 'Çok fazla token yenileme. 15 dakika bekleyin.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // SECURITY FIX: Socket IP kullan, X-Forwarded-For spoofable
    // Trust proxy ayarı yapılmışsa req.ip zaten doğru değeri verir
    // Yapılmamışsa socket'tan al
    const ip = req.socket?.remoteAddress || req.ip || 'unknown';
    // User-Agent'ı hash'le (spoofing için çok uzun key'ler oluşmasın)
    const crypto = require('crypto');
    const uaHash = crypto.createHash('md5')
      .update(req.headers['user-agent'] || 'no-ua')
      .digest('hex')
      .substring(0, 8);
    return `${ip}:${uaHash}`;
  }
});

app.use(generalLimiter);

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await db.checkHealth();
  const cacheHealthy = await cache.checkHealth();

  res.json({
    service: 'auth-service',
    status: dbHealthy && cacheHealthy ? 'healthy' : 'degraded',
    checks: {
      database: dbHealthy ? 'ok' : 'error',
      cache: cacheHealthy ? 'ok' : 'error'
    },
    timestamp: new Date().toISOString()
  });
});

// LDAP Authentication Helper
async function authenticateWithLDAP(ldapDn: string, password: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    try {
      // LDAP ayarlarını al
      const ldapSettings = await db.queryOne(
        "SELECT value FROM system_settings WHERE key = 'ldap_server_url'"
      );
      
      if (!ldapSettings) {
        logger.warn('LDAP settings not found');
        resolve(false);
        return;
      }

      let serverUrl = ldapSettings.value;
      // JSON string veya object olabilir
      if (typeof serverUrl === 'string') {
        // Tırnak işaretlerini temizle
        serverUrl = serverUrl.replace(/^"|"$/g, '');
      } else if (typeof serverUrl === 'object' && serverUrl.value) {
        serverUrl = serverUrl.value;
      }
      
      logger.info('LDAP server URL', { serverUrl });
      
      // ldapjs dinamik import
      const ldap = require('ldapjs');
      
      const client = ldap.createClient({
        url: serverUrl,
        timeout: 5000,
        connectTimeout: 5000
      });

      client.on('error', (err: any) => {
        logger.error('LDAP connection error', { error: err.message });
        resolve(false);
      });

      // LDAP bind ile şifre doğrula
      client.bind(ldapDn, password, (err: any) => {
        if (err) {
          logger.warn('LDAP bind failed', { ldapDn, error: err.message });
          client.unbind();
          resolve(false);
        } else {
          logger.info('LDAP authentication successful', { ldapDn });
          client.unbind();
          resolve(true);
        }
      });

    } catch (err: any) {
      logger.error('LDAP authentication error', { error: err.message });
      resolve(false);
    }
  });
}

// Trusted Device Token TTL (30 gün)
const TRUSTED_DEVICE_TTL = 30 * 24 * 60 * 60; // saniye

// Login - Brute-force koruması için özel rate limit
app.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, twoFactorCode, rememberDevice, deviceToken } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email ve şifre gerekli');
    }

    // Kullanıcıyı bul (ldap_dn, filter_level, filter_value, 2FA, phone, categories dahil)
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.password_hash, u.role, u.tenant_id, u.name, 
              u.position_code, u.ldap_dn, u.filter_value,
              u.two_factor_enabled, u.two_factor_secret, u.two_factor_backup_codes,
              u.can_see_all_categories,
              u.phone_number, u.phone_active,
              p.filter_level
       FROM users u
       LEFT JOIN positions p ON u.position_code = p.code
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (!user) {
      throw new AuthenticationError('Kullanıcı bulunamadı');
    }
    
    // SECURITY: Telefon güvenlik katmanı - telefon numarası varsa ve pasif ise engelle
    if (user.phone_number && user.phone_active === false) {
      logger.warn('Phone disabled login attempt', { userId: user.id, email: user.email, phone: user.phone_number });
      throw new AuthenticationError('Bu hesap için telefon erişimi devre dışı bırakılmış. Yöneticinizle iletişime geçin.');
    }

    let isValid = false;

    // LDAP kullanıcısı mı kontrol et
    if (user.ldap_dn) {
      // LDAP ile doğrula
      logger.info('Attempting LDAP authentication', { email, ldapDn: user.ldap_dn });
      isValid = await authenticateWithLDAP(user.ldap_dn, password);
      // SECURITY FIX: LDAP fallback kaldırıldı - LDAP kullanıcısı sadece LDAP ile giriş yapabilir
      // Eski davranış backdoor oluşturuyordu (LDAP'tan atılan kullanıcı DB şifresiyle girebiliyordu)
    } else {
      // Normal veritabanı şifresi ile doğrula
      isValid = await verifyPassword(password, user.password_hash);
    }

    if (!isValid) {
      throw new AuthenticationError('Hatalı şifre');
    }

    // Trusted Device Token kontrolü (2FA zaten doğrulanmış cihaz)
    // SECURITY: IP ve User-Agent binding ile token theft koruması
    let isTrustedDevice = false;
    if (deviceToken && user.two_factor_enabled) {
      const trustedKey = `trusted_device:${user.id}:${deviceToken}`;
      const trustedData = await cache.get(trustedKey);
      if (trustedData) {
        // SECURITY: IP ve User-Agent kontrolü
        const crypto = require('crypto');
        const currentIp = req.socket?.remoteAddress || req.ip || 'unknown';
        const currentUaHash = crypto.createHash('md5')
          .update(req.headers['user-agent'] || 'no-ua')
          .digest('hex');
        
        // trustedData string veya object olabilir (backward compat)
        const parsed = typeof trustedData === 'string' 
          ? (trustedData === 'true' ? {} : JSON.parse(trustedData))
          : trustedData;
        
        // Eski format (sadece 'true' string) veya yeni format kontrol
        if (parsed.ipHash && parsed.uaHash) {
          // Yeni format - IP ve UA hash kontrolü
          const currentIpHash = crypto.createHash('md5').update(currentIp).digest('hex');
          if (parsed.ipHash === currentIpHash && parsed.uaHash === currentUaHash) {
            isTrustedDevice = true;
            logger.info('Trusted device verified', { userId: user.id });
          } else {
            logger.warn('Trusted device token IP/UA mismatch', { 
              userId: user.id, 
              expectedIpHash: parsed.ipHash?.substring(0, 8),
              currentIpHash: currentIpHash.substring(0, 8)
            });
          }
        } else {
          // Eski format veya eksik data - güvenlik için reddet
          logger.warn('Trusted device token old format, rejecting', { userId: user.id });
        }
      }
    }
    
    // Sistem genelinde 2FA zorunluluğu kontrolü (Admin panel'den açılıp kapatılabilir)
    // Not: Hem 'require_2fa' hem de '2fa_enabled' key'lerini kontrol et (uyumluluk için)
    // tenant_id NULL olabilir (global ayar) veya kullanıcının tenant_id'sine eşit olmalı
    const twoFactorSetting = await db.queryOne(
      `SELECT value FROM system_settings 
       WHERE (key = 'require_2fa' OR key = '2fa_enabled') 
       AND (tenant_id IS NULL OR tenant_id = $1) 
       LIMIT 1`,
      [user.tenant_id]
    );
    
    // DEBUG LOG
    logger.info('2FA Setting Check', { 
      twoFactorSetting: twoFactorSetting?.value,
      userTenantId: user.tenant_id,
      userTwoFactorEnabled: user.two_factor_enabled
    });
    
    // value JSON formatında olabilir: "true" veya {"value": "true"}
    // PostgreSQL JSONB driver otomatik parse edebilir, o yüzden her iki durumu da ele al
    let systemRequires2FA = false;
    if (twoFactorSetting?.value) {
      const val = twoFactorSetting.value;
      
      // Zaten object ise (PostgreSQL driver tarafından parse edilmiş)
      if (typeof val === 'object' && val !== null) {
        systemRequires2FA = val.value === 'true' || val.value === true;
        logger.info('2FA Parsed (object)', { val, systemRequires2FA });
      } else if (typeof val === 'string') {
        // String ise parse etmeyi dene
        try {
          const parsed = JSON.parse(val);
          systemRequires2FA = parsed === true || parsed === 'true' || parsed?.value === 'true' || parsed?.value === true;
          logger.info('2FA Parsed (string→json)', { parsed, systemRequires2FA });
        } catch {
          systemRequires2FA = val === 'true';
          logger.info('2FA Parsed (plain string)', { val, systemRequires2FA });
        }
      } else if (typeof val === 'boolean') {
        systemRequires2FA = val;
        logger.info('2FA Parsed (boolean)', { val, systemRequires2FA });
      }
    }
    
    // Response için yeni trusted device token
    let newTrustedDeviceToken: string | null = null;

    // SECURITY: Sistem 2FA zorunlu ama kullanıcı 2FA kurmamışsa → Setup gerekli
    if (systemRequires2FA && !user.two_factor_enabled) {
      logger.info('2FA setup required for user', { userId: user.id, email: user.email });
      return res.json({
        success: false,
        requires2FASetup: true,
        setupToken: generateAccessToken({ // Geçici token (2FA setup için)
          userId: user.id,
          tenantId: user.tenant_id,
          role: user.role,
          email: user.email,
          purpose: '2fa_setup' // Özel amaç
        }),
        message: '2FA kurulumu zorunlu. Lütfen Google Authenticator uygulamanızı ayarlayın.'
      });
    }

    // 2FA kontrolü (trusted device değilse)
    if (user.two_factor_enabled && !isTrustedDevice) {
      if (!twoFactorCode) {
        // 2FA kodu gerekli - özel response döndür
        return res.json({
          success: false,
          requiresTwoFactor: true,
          message: '2FA doğrulaması gerekli'
        });
      }
      
      // 2FA kodunu doğrula
      const speakeasy = require('speakeasy');
      let twoFactorValid = speakeasy.totp.verify({
        secret: user.two_factor_secret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2
      });
      
      // Yedek kod kontrolü
      if (!twoFactorValid && user.two_factor_backup_codes) {
        const backupCodes = user.two_factor_backup_codes;
        const codeIndex = backupCodes.indexOf(twoFactorCode.toUpperCase());
        if (codeIndex !== -1) {
          twoFactorValid = true;
          // Kullanılan yedek kodu sil
          backupCodes.splice(codeIndex, 1);
          await db.query(
            'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
            [backupCodes, user.id]
          );
          logger.info('Backup code used', { userId: user.id });
        }
      }
      
      if (!twoFactorValid) {
        throw new AuthenticationError('Geçersiz 2FA kodu');
      }
      
      // "Bu cihazı hatırla" seçilmişse trusted device token oluştur
      // SECURITY: IP ve User-Agent hash'leri de kaydet (token theft koruması)
      if (rememberDevice) {
        const crypto = require('crypto');
        newTrustedDeviceToken = crypto.randomBytes(32).toString('hex');
        const trustedKey = `trusted_device:${user.id}:${newTrustedDeviceToken}`;
        
        const currentIp = req.socket?.remoteAddress || req.ip || 'unknown';
        const ipHash = crypto.createHash('md5').update(currentIp).digest('hex');
        const uaHash = crypto.createHash('md5').update(req.headers['user-agent'] || 'no-ua').digest('hex');
        
        await cache.set(trustedKey, JSON.stringify({ 
          createdAt: Date.now(), 
          ipHash,
          uaHash
        }), TRUSTED_DEVICE_TTL);
        logger.info('Trusted device token created with binding', { userId: user.id, ttlDays: 30 });
      }
    }

    // Kullanıcının rapor kategorilerini getir (Güçler Ayrılığı)
    let categoryIds: string[] = [];
    if (!user.can_see_all_categories) {
      const userCategories = await db.queryAll(
        `SELECT category_id FROM user_report_categories WHERE user_id = $1`,
        [user.id]
      );
      categoryIds = userCategories.map((c: any) => c.category_id);
    }

    // Token oluştur (filter_level, filter_value ve categoryIds dahil - RLS için)
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
      filterLevel: user.filter_level || 'store',   // RLS seviyesi
      filterValue: user.filter_value || null,       // RLS değeri
      canSeeAllCategories: user.can_see_all_categories ?? true,
      categoryIds: categoryIds                       // Güçler Ayrılığı için
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Refresh token'ı cache'e kaydet
    await cache.set(`refresh:${user.id}`, refreshToken, 7 * 24 * 60 * 60);

    // Session bilgisini kaydet (aktif oturumlar için)
    const sessionId = `session:${user.id}:${Date.now()}`;
    const sessionData = {
      userId: user.id,
      email: user.email,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      loginAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };
    await cache.set(sessionId, JSON.stringify(sessionData), 7 * 24 * 60 * 60);
    
    // Kullanıcının aktif session listesine ekle
    const sessionsKey = `user_sessions:${user.id}`;
    const existingSessions = await cache.get(sessionsKey);
    const sessions = existingSessions ? JSON.parse(existingSessions) : [];
    sessions.push(sessionId);
    // Maksimum 10 session tut
    if (sessions.length > 10) sessions.shift();
    await cache.set(sessionsKey, JSON.stringify(sessions), 7 * 24 * 60 * 60);

    logger.info('User logged in', { 
      userId: user.id, 
      email: user.email,
      filterLevel: user.filter_level,
      filterValue: user.filter_value
    });

    // Set HttpOnly cookies for XSS protection
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' as const : 'lax' as const,
      path: '/'
    };

    // Access token cookie (15 dakika)
    res.cookie('access_token', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // Refresh token cookie (7 gün)
    res.cookie('refresh_token', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        trustedDeviceToken: newTrustedDeviceToken, // 2FA "Bu cihazı hatırla" için
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenant_id,
          positionCode: user.position_code || 'VIEWER',
          filterLevel: user.filter_level || 'store',   // RLS için
          filterValue: user.filter_value || null,       // RLS için
          canSeeAllCategories: user.can_see_all_categories ?? true,  // Güçler Ayrılığı
          categoryIds: categoryIds                       // Güçler Ayrılığı
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token - SECURITY: Özel rate limiter uygulandı
app.post('/refresh', refreshLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token gerekli');
    }

    const payload = auth.verifyToken(refreshToken);

    // SECURITY: Blacklist kontrolü - silinmiş/pasif kullanıcıların token'ı geçersiz
    const isBlacklisted = await isUserBlacklisted(payload.userId);
    if (isBlacklisted) {
      logger.warn('Blacklisted user attempted token refresh', { userId: payload.userId });
      throw new AuthenticationError('Oturum sonlandırıldı. Lütfen tekrar giriş yapın.');
    }

    // Cache'te kontrol et
    const cachedToken = await cache.get(`refresh:${payload.userId}`);
    if (cachedToken !== refreshToken) {
      throw new AuthenticationError('Geçersiz refresh token');
    }

    // DB'den güncel kullanıcı bilgilerini çek (yetki değişmiş olabilir)
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.role, u.tenant_id, u.filter_value, u.can_see_all_categories, u.is_active,
              p.filter_level
       FROM users u
       LEFT JOIN positions p ON u.position_code = p.code
       WHERE u.id = $1`,
      [payload.userId]
    );

    if (!user || !user.is_active) {
      throw new AuthenticationError('Kullanıcı bulunamadı veya deaktif');
    }

    // Kullanıcının güncel rapor kategorilerini çek
    let categoryIds: string[] = [];
    if (!user.can_see_all_categories) {
      const userCategories = await db.queryAll(
        `SELECT category_id FROM user_report_categories WHERE user_id = $1`,
        [user.id]
      );
      categoryIds = userCategories.map((c: any) => c.category_id);
    }

    // Yeni token oluştur - güncel yetkilerle
    const newPayload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
      filterLevel: user.filter_level || 'store',
      filterValue: user.filter_value || null,
      canSeeAllCategories: user.can_see_all_categories ?? true,
      categoryIds: categoryIds
    };

    const accessToken = generateAccessToken(newPayload);

    logger.info('Token refreshed with updated permissions', { 
      userId: user.id, 
      role: user.role,
      filterLevel: user.filter_level 
    });

    res.json({
      success: true,
      data: { accessToken }
    });
  } catch (error) {
    next(error);
  }
});

// Logout
app.post('/logout', authenticate, async (req: Request, res: Response) => {
  if (req.user) {
    // Clear refresh token from cache
    await cache.del(`refresh:${req.user.userId}`);
    
    // Clear all user sessions
    const sessionPattern = `session:${req.user.userId}:*`;
    await cache.del(sessionPattern);
    await cache.del(`user_sessions:${req.user.userId}`);
    
    logger.info('User logged out, all sessions cleared', { userId: req.user.userId });
  }

  // Clear HttpOnly cookies
  res.clearCookie('access_token', { path: '/' });
  res.clearCookie('refresh_token', { path: '/' });

  res.json({ success: true, message: 'Çıkış yapıldı' });
});

// Verify token
app.get('/verify', authenticate, (req: Request, res: Response) => {
  res.json({ success: true, data: { user: req.user } });
});

// Change password
app.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw new ValidationError('Mevcut ve yeni şifre gerekli');
    }

    // Güçlü şifre politikası kontrolü
    const { validatePassword } = require('@clixer/shared');
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      throw new ValidationError(passwordCheck.errors.join('. '));
    }

    const user = await db.queryOne(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.userId]
    );

    const isValid = await verifyPassword(currentPassword, user.password_hash);
    if (!isValid) {
      throw new AuthenticationError('Mevcut şifre hatalı');
    }

    const newHash = await hashPassword(newPassword);
    
    // Update password and increment token_version to invalidate all existing tokens
    await db.query(
      `UPDATE users 
       SET password_hash = $1, 
           token_version = COALESCE(token_version, 0) + 1,
           updated_at = NOW() 
       WHERE id = $2`,
      [newHash, req.user!.userId]
    );

    // Invalidate all sessions in Redis
    const sessionPattern = `session:${req.user!.userId}:*`;
    await cache.del(sessionPattern);
    
    logger.info('Password changed, all sessions invalidated', { userId: req.user!.userId });

    res.json({ 
      success: true, 
      message: 'Şifre değiştirildi. Güvenlik için tüm oturumlar sonlandırıldı, lütfen tekrar giriş yapın.',
      requireRelogin: true
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// 2FA (TWO-FACTOR AUTHENTICATION)
// ============================================

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// 2FA Setup - QR kod oluştur
// SECURITY: Hem normal token hem de 2fa_setup purpose token kabul edilir
// (ilk login'de zorunlu 2FA kurulumu için)
app.post('/2fa/setup', authenticateWithOptionalPurpose('2fa_setup'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const tokenPurpose = (req.user as any).purpose;
    
    // SECURITY FIX: 2fa_setup token tek kullanımlık
    if (tokenPurpose === '2fa_setup') {
      const tokenUsedKey = `2fa_setup_used:${userId}`;
      const alreadyUsed = await cache.get(tokenUsedKey);
      if (alreadyUsed) {
        throw new AuthenticationError('Bu kurulum token\'ı zaten kullanıldı. Lütfen tekrar giriş yapın.');
      }
    }
    
    // Kullanıcı bilgilerini al
    const user = await db.queryOne('SELECT email, two_factor_enabled FROM users WHERE id = $1', [userId]);
    if (!user) {
      throw new ValidationError('Kullanıcı bulunamadı');
    }
    
    if (user.two_factor_enabled) {
      throw new ValidationError('2FA zaten aktif');
    }
    
    // Secret oluştur
    const secret = speakeasy.generateSecret({
      name: `Clixer (${user.email})`,
      issuer: 'Clixer'
    });
    
    // Secret'ı geçici olarak kaydet (doğrulama sonrası kalıcı olacak)
    await db.query(
      'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
      [secret.base32, userId]
    );
    
    // QR kod oluştur
    const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);
    
    // Yedek kodlar oluştur - SECURITY: 12 karakter, 10 adet (crypto-secure)
    const crypto = require('crypto');
    const backupCodes = Array.from({ length: 10 }, () => {
      // SECURITY: crypto.randomBytes kullanarak gerçek kriptografik rastgele sayı üret
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Karışıklık önlemek için 0,O,1,I,L çıkarıldı
      const randomBytes = crypto.randomBytes(12);
      let code = '';
      for (let i = 0; i < 12; i++) {
        // Her byte'ı chars dizisinin uzunluğuna göre modüle al
        code += chars.charAt(randomBytes[i] % chars.length);
        if (i === 3 || i === 7) code += '-'; // XXXX-XXXX-XXXX formatı
      }
      return code;
    });
    
    await db.query(
      'UPDATE users SET two_factor_backup_codes = $1 WHERE id = $2',
      [backupCodes, userId]
    );
    
    logger.info('2FA setup initiated', { userId });
    
    res.json({
      success: true,
      data: {
        qrCode: qrCodeDataUrl,
        secret: secret.base32,
        backupCodes
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2FA Verify & Enable - Kodu doğrula ve aktifleştir
// SECURITY: Hem normal token hem de 2fa_setup purpose token kabul edilir
app.post('/2fa/verify', authenticateWithOptionalPurpose('2fa_setup'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { code, rememberDevice } = req.body;
    const tokenPurpose = (req.user as any).purpose;
    
    if (!code) {
      throw new ValidationError('Doğrulama kodu gerekli');
    }
    
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id, u.is_active, 
              u.filter_level, u.filter_value, u.can_see_all_categories,
              u.two_factor_secret, u.two_factor_enabled, u.two_factor_backup_codes,
              p.code as position_code
       FROM users u
       LEFT JOIN positions p ON u.position_code = p.code
       WHERE u.id = $1`,
      [userId]
    );
    
    if (!user || !user.two_factor_secret) {
      throw new ValidationError('Önce 2FA kurulumu başlatın');
    }
    
    if (user.two_factor_enabled) {
      throw new ValidationError('2FA zaten aktif');
    }
    
    // Kodu doğrula
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2
    });
    
    if (!verified) {
      throw new AuthenticationError('Geçersiz doğrulama kodu');
    }
    
    // 2FA'yı aktifleştir
    await db.query(
      'UPDATE users SET two_factor_enabled = true WHERE id = $1',
      [userId]
    );
    
    logger.info('2FA enabled', { userId });
    
    // SECURITY: Eğer bu ilk login 2FA setup ise (purpose token), tam login token'ları döndür
    if (tokenPurpose === '2fa_setup') {
      // SECURITY FIX: Token'ı kullanıldı olarak işaretle (1 saat geçerli)
      const tokenUsedKey = `2fa_setup_used:${userId}`;
      await cache.set(tokenUsedKey, 'true', 3600);
      // Kullanıcının kategori izinlerini al
      const userCategories = await db.queryAll(
        'SELECT category_id FROM user_report_categories WHERE user_id = $1',
        [userId]
      );
      const categoryIds = userCategories.map((c: any) => c.category_id);
      
      // Token payload oluştur
      const payload = {
        userId: user.id,
        tenantId: user.tenant_id,
        role: user.role,
        email: user.email,
        filterLevel: user.filter_level || 'store',
        filterValue: user.filter_value || null,
        canSeeAllCategories: user.can_see_all_categories ?? true,
        categoryIds: categoryIds
      };
      
      const accessToken = generateAccessToken(payload);
      const refreshToken = generateRefreshToken(payload);
      
      // Cache'e kaydet
      await cache.set(`refresh:${user.id}`, refreshToken, 7 * 24 * 60 * 60);
      
      // Session bilgisini kaydet
      const sessionId = `session:${user.id}:${Date.now()}`;
      const sessionData = {
        userId: user.id,
        email: user.email,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        loginAt: new Date().toISOString(),
        lastActivity: new Date().toISOString()
      };
      await cache.set(sessionId, JSON.stringify(sessionData), 7 * 24 * 60 * 60);
      
      // Trusted device token (opsiyonel)
      // SECURITY: IP ve User-Agent hash'leri ile binding
      let trustedDeviceToken: string | null = null;
      if (rememberDevice) {
        const crypto = require('crypto');
        trustedDeviceToken = crypto.randomBytes(32).toString('hex');
        const trustedKey = `trusted_device:${user.id}:${trustedDeviceToken}`;
        
        const currentIp = req.socket?.remoteAddress || req.ip || 'unknown';
        const ipHash = crypto.createHash('md5').update(currentIp).digest('hex');
        const uaHash = crypto.createHash('md5').update(req.headers['user-agent'] || 'no-ua').digest('hex');
        
        await cache.set(trustedKey, JSON.stringify({ 
          createdAt: Date.now(), 
          ipHash,
          uaHash
        }), 30 * 24 * 60 * 60); // 30 gün
      }
      
      logger.info('User completed 2FA setup and logged in', { userId: user.id, email: user.email });
      
      return res.json({
        success: true,
        message: '2FA başarıyla aktifleştirildi',
        data: {
          accessToken,
          refreshToken,
          trustedDeviceToken,
          backupCodes: user.two_factor_backup_codes, // İlk kurulumda backup kodları göster
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            tenantId: user.tenant_id,
            positionCode: user.position_code,
            filterLevel: user.filter_level || 'none',
            filterValue: user.filter_value,
            canSeeAllCategories: user.can_see_all_categories ?? true,
            categoryIds: categoryIds
          }
        }
      });
    }
    
    // Normal 2FA aktivasyonu (zaten login olmuş kullanıcı)
    res.json({ 
      success: true, 
      message: '2FA başarıyla aktifleştirildi',
      data: {
        backupCodes: user.two_factor_backup_codes
      }
    });
  } catch (error) {
    next(error);
  }
});

// 2FA Disable - 2FA'yı kapat
app.post('/2fa/disable', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { code, password } = req.body;
    
    if (!code || !password) {
      throw new ValidationError('Kod ve şifre gerekli');
    }
    
    const user = await db.queryOne(
      'SELECT password_hash, two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    
    if (!user || !user.two_factor_enabled) {
      throw new ValidationError('2FA aktif değil');
    }
    
    // Şifreyi doğrula
    const passwordValid = await verifyPassword(password, user.password_hash);
    if (!passwordValid) {
      throw new AuthenticationError('Geçersiz şifre');
    }
    
    // 2FA kodunu doğrula
    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token: code,
      window: 2
    });
    
    if (!verified) {
      throw new AuthenticationError('Geçersiz doğrulama kodu');
    }
    
    // 2FA'yı kapat
    await db.query(
      'UPDATE users SET two_factor_enabled = false, two_factor_secret = NULL, two_factor_backup_codes = NULL WHERE id = $1',
      [userId]
    );
    
    logger.info('2FA disabled', { userId });
    
    res.json({ success: true, message: '2FA devre dışı bırakıldı' });
  } catch (error) {
    next(error);
  }
});

// 2FA Status - Durumu kontrol et
app.get('/2fa/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    
    const user = await db.queryOne(
      'SELECT two_factor_enabled FROM users WHERE id = $1',
      [userId]
    );
    
    res.json({
      success: true,
      data: {
        enabled: user?.two_factor_enabled || false
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

// Aktif oturumları listele
app.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionsKey = `user_sessions:${userId}`;
    
    const sessionIds = await cache.get(sessionsKey);
    if (!sessionIds) {
      return res.json({ success: true, data: [] });
    }
    
    const ids = JSON.parse(sessionIds);
    const sessions = [];
    
    for (const sessionId of ids) {
      const sessionData = await cache.get(sessionId);
      if (sessionData) {
        const session = JSON.parse(sessionData);
        sessions.push({
          id: sessionId,
          ...session,
          current: sessionId.includes(`:${userId}:`) // Basit kontrol
        });
      }
    }
    
    res.json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
});

// Tek bir oturumu sonlandır
app.delete('/sessions/:sessionId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.params;
    
    // Session'ın bu kullanıcıya ait olduğunu doğrula
    if (!sessionId.includes(`:${userId}:`)) {
      throw new AuthenticationError('Bu oturumu sonlandırma yetkiniz yok');
    }
    
    // Session'ı sil
    await cache.del(sessionId);
    
    // Listeden çıkar
    const sessionsKey = `user_sessions:${userId}`;
    const sessionIds = await cache.get(sessionsKey);
    if (sessionIds) {
      const ids = JSON.parse(sessionIds).filter((id: string) => id !== sessionId);
      await cache.set(sessionsKey, JSON.stringify(ids), 7 * 24 * 60 * 60);
    }
    
    logger.info('Session terminated', { userId, sessionId });
    
    res.json({ success: true, message: 'Oturum sonlandırıldı' });
  } catch (error) {
    next(error);
  }
});

// Tüm oturumları sonlandır (mevcut hariç)
app.delete('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const sessionsKey = `user_sessions:${userId}`;
    
    const sessionIds = await cache.get(sessionsKey);
    if (sessionIds) {
      const ids = JSON.parse(sessionIds);
      
      for (const sessionId of ids) {
        await cache.del(sessionId);
      }
      
      // Listeyi temizle
      await cache.del(sessionsKey);
    }
    
    // Refresh token'ı da sil
    await cache.del(`refresh:${userId}`);
    
    logger.info('All sessions terminated', { userId });
    
    res.json({ success: true, message: 'Tüm oturumlar sonlandırıldı' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const errorResponse = formatError(err, isDev);
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  logger.error('Request error', {
    error: err.message,
    stack: isDev ? err.stack : undefined,
    path: req.path,
    method: req.method
  });

  res.status(statusCode).json(errorResponse);
});

// ============================================
// START SERVER
// ============================================

let server: any;

async function start() {
  try {
    // Database bağlantısını test et
    db.createPool();
    await db.checkHealth();
    logger.info('PostgreSQL connected');

    // Redis bağlantısını test et
    cache.createRedisClient();
    await cache.checkHealth();
    logger.info('Redis connected');

    server = app.listen(PORT, () => {
      logger.info(`🔐 Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start auth-service', { error });
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await db.closePool();
        logger.info('Database pool closed');
        
        await cache.close();
        logger.info('Redis connection closed');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    });
  }
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
