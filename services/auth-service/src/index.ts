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
  AppError,
  formatError,
  ValidationError,
  AuthenticationError
} from '@clixer/shared';

const logger = createLogger({ service: 'auth-service' });
const app = express();
const PORT = process.env.AUTH_SERVICE_PORT || 4001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// Rate limiting
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, errorCode: 'RATE_LIMIT', message: 'Çok fazla istek' }
}));

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

// Login
app.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, twoFactorCode } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email ve şifre gerekli');
    }

    // Kullanıcıyı bul (ldap_dn, filter_level, filter_value, 2FA, categories dahil)
    const user = await db.queryOne(
      `SELECT u.id, u.email, u.password_hash, u.role, u.tenant_id, u.name, 
              u.position_code, u.ldap_dn, u.filter_value,
              u.two_factor_enabled, u.two_factor_secret, u.two_factor_backup_codes,
              u.can_see_all_categories,
              p.filter_level
       FROM users u
       LEFT JOIN positions p ON u.position_code = p.code
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (!user) {
      throw new AuthenticationError('Kullanıcı bulunamadı');
    }

    let isValid = false;

    // LDAP kullanıcısı mı kontrol et
    if (user.ldap_dn) {
      // LDAP ile doğrula
      logger.info('Attempting LDAP authentication', { email, ldapDn: user.ldap_dn });
      isValid = await authenticateWithLDAP(user.ldap_dn, password);
      
      if (!isValid) {
        // LDAP başarısız olursa, veritabanı şifresini de dene (fallback)
        logger.info('LDAP failed, trying database password', { email });
        isValid = await verifyPassword(password, user.password_hash);
      }
    } else {
      // Normal veritabanı şifresi ile doğrula
      isValid = await verifyPassword(password, user.password_hash);
    }

    if (!isValid) {
      throw new AuthenticationError('Hatalı şifre');
    }

    // 2FA kontrolü
    if (user.two_factor_enabled) {
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

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
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

// Refresh token
app.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw new ValidationError('Refresh token gerekli');
    }

    const payload = auth.verifyToken(refreshToken);

    // Cache'te kontrol et
    const cachedToken = await cache.get(`refresh:${payload.userId}`);
    if (cachedToken !== refreshToken) {
      throw new AuthenticationError('Geçersiz refresh token');
    }

    // Yeni token oluştur
    const newPayload = {
      userId: payload.userId,
      tenantId: payload.tenantId,
      role: payload.role,
      email: payload.email
    };

    const accessToken = generateAccessToken(newPayload);

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
    await cache.del(`refresh:${req.user.userId}`);
    logger.info('User logged out', { userId: req.user.userId });
  }

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
    await db.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, req.user!.userId]
    );

    logger.info('Password changed', { userId: req.user!.userId });

    res.json({ success: true, message: 'Şifre değiştirildi' });
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
app.post('/2fa/setup', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    
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
    
    // Yedek kodlar oluştur
    const backupCodes = Array.from({ length: 8 }, () => 
      Math.random().toString(36).substring(2, 8).toUpperCase()
    );
    
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
app.post('/2fa/verify', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { code } = req.body;
    
    if (!code) {
      throw new ValidationError('Doğrulama kodu gerekli');
    }
    
    const user = await db.queryOne(
      'SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = $1',
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
    
    res.json({ success: true, message: '2FA başarıyla aktifleştirildi' });
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

    app.listen(PORT, () => {
      logger.info(`🔐 Auth Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start auth-service', { error });
    process.exit(1);
  }
}

start();
