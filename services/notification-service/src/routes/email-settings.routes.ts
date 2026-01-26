/**
 * Email Settings Routes
 * SMTP configuration for tenant email sending
 * 
 * Security:
 * - Admin/SuperAdmin only
 * - SMTP password encrypted with AES-256
 * - No password returned in responses
 * - Connection test with rate limiting
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  createLogger,
  authenticate,
  tenantIsolation,
  AppError,
  ValidationError,
  ForbiddenError,
  encrypt,
  decrypt
} from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'notification-email-settings' });

// Rate limit for test endpoint (simple in-memory)
const testRateLimit = new Map<string, { count: number; resetAt: number }>();
const TEST_LIMIT = 5; // 5 tests per minute
const TEST_WINDOW_MS = 60000;

// ============================================
// HELPER FUNCTIONS
// ============================================

function requireAdmin(req: Request): void {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Bu işlem için admin yetkisi gerekli');
  }
}

function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateHost(host: string): boolean {
  // Basic hostname validation - no spaces, valid characters
  const hostRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;
  return hostRegex.test(host);
}

function isInternalHost(host: string): boolean {
  // Block internal/private hosts for SSRF protection
  const blockedPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^0\.0\.0\.0$/,
    /^::1$/,
    /^fe80:/i
  ];
  return blockedPatterns.some(pattern => pattern.test(host));
}

function checkRateLimit(tenantId: string): void {
  const now = Date.now();
  const key = `test:${tenantId}`;
  const limit = testRateLimit.get(key);

  if (limit) {
    if (now < limit.resetAt) {
      if (limit.count >= TEST_LIMIT) {
        throw new AppError('Çok fazla test isteği. Lütfen 1 dakika bekleyin.', 429);
      }
      limit.count++;
    } else {
      testRateLimit.set(key, { count: 1, resetAt: now + TEST_WINDOW_MS });
    }
  } else {
    testRateLimit.set(key, { count: 1, resetAt: now + TEST_WINDOW_MS });
  }
}

// ============================================
// GET /email-settings - Get current settings
// ============================================
router.get('/', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const tenantId = req.user!.tenantId;

    const settings = await db.queryOne(
      `SELECT 
        id, tenant_id, smtp_host, smtp_port, smtp_secure, smtp_user,
        from_email, from_name, is_configured, last_test_at, last_test_result,
        created_at, updated_at
       FROM email_settings 
       WHERE tenant_id = $1`,
      [tenantId]
    );

    // Return empty config if not exists (don't expose whether it exists)
    const result = settings || {
      smtp_host: '',
      smtp_port: 587,
      smtp_secure: false,
      smtp_user: '',
      from_email: '',
      from_name: 'Clixer Analytics',
      is_configured: false
    };

    // NEVER return password
    delete result.smtp_password_encrypted;

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /email-settings - Create/Update settings
// ============================================
router.put('/', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const {
      smtp_host,
      smtp_port = 587,
      smtp_secure = false,
      smtp_user,
      smtp_password, // Will be encrypted
      from_email,
      from_name = 'Clixer Analytics'
    } = req.body;

    // ===== INPUT VALIDATION =====

    // SMTP Host validation
    if (!smtp_host || typeof smtp_host !== 'string') {
      throw new ValidationError('SMTP host gerekli');
    }
    if (!validateHost(smtp_host)) {
      throw new ValidationError('Geçersiz SMTP host formatı');
    }
    if (isInternalHost(smtp_host)) {
      throw new ValidationError('Internal/private SMTP host kullanılamaz');
    }

    // Port validation
    const port = Number(smtp_port);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new ValidationError('SMTP port 1-65535 arasında olmalı');
    }

    // User validation
    if (!smtp_user || typeof smtp_user !== 'string' || smtp_user.length < 3) {
      throw new ValidationError('SMTP kullanıcı adı gerekli');
    }

    // From email validation
    if (!from_email || !validateEmail(from_email)) {
      throw new ValidationError('Geçerli bir gönderen email adresi gerekli');
    }

    // From name validation
    if (from_name && from_name.length > 100) {
      throw new ValidationError('Gönderen adı en fazla 100 karakter olabilir');
    }

    // ===== ENCRYPTION =====
    
    let encryptedPassword: string | null = null;
    if (smtp_password) {
      try {
        encryptedPassword = encrypt(smtp_password);
      } catch (error) {
        throw new AppError('Encryption key yapılandırılmamış', 500);
      }
    }

    // ===== UPSERT =====

    const existing = await db.queryOne(
      `SELECT id FROM email_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    let result;
    if (existing) {
      // Update - only update password if provided
      const passwordClause = encryptedPassword 
        ? `, smtp_password_encrypted = $8` 
        : '';
      
      const values = [
        smtp_host,
        port,
        Boolean(smtp_secure),
        smtp_user,
        from_email,
        from_name,
        userId,
        tenantId
      ];

      if (encryptedPassword) {
        values.splice(7, 0, encryptedPassword);
      }

      result = await db.queryOne(`
        UPDATE email_settings
        SET smtp_host = $1, smtp_port = $2, smtp_secure = $3, smtp_user = $4,
            from_email = $5, from_name = $6, updated_by = $7,
            is_configured = true
            ${passwordClause}
        WHERE tenant_id = $${encryptedPassword ? 9 : 8}
        RETURNING id, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_configured
      `, values);
    } else {
      // Insert
      if (!encryptedPassword) {
        throw new ValidationError('Yeni ayarlar için SMTP şifresi gerekli');
      }

      result = await db.queryOne(`
        INSERT INTO email_settings (
          tenant_id, smtp_host, smtp_port, smtp_secure, smtp_user,
          smtp_password_encrypted, from_email, from_name, is_configured,
          created_by, updated_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $9)
        RETURNING id, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_configured
      `, [tenantId, smtp_host, port, Boolean(smtp_secure), smtp_user, encryptedPassword, from_email, from_name, userId]);
    }

    logger.info('Email settings updated', { tenantId, userId });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /email-settings/test - Test connection
// ============================================
router.post('/test', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    // Rate limiting
    checkRateLimit(tenantId);

    // Get settings
    const settings = await db.queryOne(
      `SELECT * FROM email_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    if (!settings || !settings.is_configured) {
      throw new ValidationError('Email ayarları henüz yapılandırılmamış');
    }

    // Decrypt password
    let decryptedPassword: string;
    try {
      decryptedPassword = decrypt(settings.smtp_password_encrypted);
    } catch (err) {
      throw new AppError('SMTP şifresi çözülemedi', 500);
    }

    // Test connection using nodemailer
    const nodemailer = await import('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: settings.smtp_host,
      port: settings.smtp_port,
      secure: settings.smtp_secure,
      auth: {
        user: settings.smtp_user,
        pass: decryptedPassword
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000
    });

    const startTime = Date.now();
    
    try {
      await transporter.verify();
      const duration = Date.now() - startTime;

      // Update test result
      await db.query(
        `UPDATE email_settings 
         SET last_test_at = NOW(), last_test_result = 'SUCCESS'
         WHERE tenant_id = $1`,
        [tenantId]
      );

      logger.info('Email settings test successful', { tenantId, duration });

      res.json({ 
        success: true, 
        message: 'SMTP bağlantısı başarılı',
        duration_ms: duration
      });
    } catch (smtpError: any) {
      const duration = Date.now() - startTime;

      // Update test result with error
      await db.query(
        `UPDATE email_settings 
         SET last_test_at = NOW(), last_test_result = $1
         WHERE tenant_id = $2`,
        [`ERROR: ${smtpError.message}`, tenantId]
      );

      logger.warn('Email settings test failed', { tenantId, error: smtpError.message });

      // Don't expose detailed SMTP errors to client
      res.status(400).json({ 
        success: false, 
        message: 'SMTP bağlantısı başarısız. Ayarları kontrol edin.',
        duration_ms: duration
      });
    }
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE /email-settings - Remove settings
// ============================================
router.delete('/', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const tenantId = req.user!.tenantId;

    await db.query(
      `DELETE FROM email_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    logger.info('Email settings deleted', { tenantId });

    res.json({ success: true, message: 'Email ayarları silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
