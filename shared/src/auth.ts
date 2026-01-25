/**
 * Clixer - Authentication & Authorization
 * JWT handling ve middleware
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, TokenExpiredError, InvalidTokenError, ForbiddenError, ValidationError, NotFoundError } from './errors';
import createLogger from './logger';
import { isUserBlacklisted } from './cache';

const logger = createLogger({ service: 'auth' });

// JWT Config - JWT_SECRET TÜM ORTAMLARDA ZORUNLU
// SECURITY: Development fallback kaldırıldı - güvenlik riski
const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    logger.error('CRITICAL: JWT_SECRET environment variable is required!');
    throw new Error('JWT_SECRET environment variable is required. Set it in your .env file.');
  }
  // Minimum 32 karakter kontrolü
  if (secret.length < 32) {
    logger.error('CRITICAL: JWT_SECRET must be at least 32 characters!');
    throw new Error('JWT_SECRET must be at least 32 characters for security');
  }
  return secret;
})();

const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const BCRYPT_ROUNDS = 12;

// Token payload type
export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
  purpose?: string; // SECURITY: '2fa_setup' gibi özel amaçlı tokenler için
}

// User from request
export interface AuthenticatedUser extends TokenPayload {
  iat: number;
  exp: number;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      traceId?: string;
    }
  }
}

// ============================================
// PASSWORD OPERATIONS
// ============================================

/**
 * Şifre hash'le
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Şifre doğrula
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================
// TOKEN OPERATIONS
// ============================================

/**
 * Access token oluştur
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES } as jwt.SignOptions);
}

/**
 * Refresh token oluştur
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRES } as jwt.SignOptions);
}

/**
 * Token doğrula
 */
export function verifyToken(token: string): AuthenticatedUser {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthenticatedUser;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      throw new TokenExpiredError();
    }
    throw new InvalidTokenError();
  }
}

/**
 * Token'dan bearer'ı çıkar
 */
export function extractToken(authHeader?: string): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1];
}

// ============================================
// MIDDLEWARE
// ============================================

/**
 * Authentication middleware
 * Supports both Authorization header and HttpOnly cookies
 * SECURITY: Redis blacklist kontrolü ile anında token invalidation
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Try Authorization header first
    let token = extractToken(req.headers.authorization);
    
    // Fallback to HttpOnly cookie
    if (!token && req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      throw new AuthenticationError('Token gerekli');
    }

    const user = verifyToken(token);
    
    // SECURITY: Özel amaçlı tokenları reddet (2FA setup vs.)
    // Bu tokenlar sadece belirli endpoint'lerde kabul edilmeli
    if ((user as any).purpose) {
      logger.warn('Special purpose token used in normal endpoint', { 
        userId: user.userId, 
        purpose: (user as any).purpose 
      });
      throw new AuthenticationError('Bu token genel erişim için kullanılamaz');
    }
    
    // SECURITY: Redis blacklist kontrolü
    // Kullanıcı silinmiş/pasife alınmışsa token geçersiz
    try {
      const isBlacklisted = await isUserBlacklisted(user.userId);
      if (isBlacklisted) {
        logger.warn('Blacklisted user attempted access', { userId: user.userId, email: user.email });
        throw new AuthenticationError('Oturum sonlandırıldı. Lütfen tekrar giriş yapın.');
      }
    } catch (blacklistError: any) {
      // Redis bağlantı hatası durumunda güvenlik için reddet
      if (blacklistError instanceof AuthenticationError) {
        throw blacklistError;
      }
      logger.error('Blacklist check failed', { error: blacklistError.message, userId: user.userId });
      // SECURITY FIX: Fail-closed - Redis down ise erişimi engelle
      // Blacklist kontrolü yapılamıyorsa, deaktif edilmiş kullanıcılar erişebilir
      if (process.env.NODE_ENV === 'production') {
        throw new AuthenticationError('Kimlik doğrulama servisi geçici olarak kullanılamıyor');
      }
      // Development'ta uyarı logla ama devam et
      logger.warn('Redis down but allowing access in development mode', { userId: user.userId });
    }
    
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Authentication middleware for special purpose tokens (2FA setup, etc.)
 * SECURITY: Sadece belirtilen purpose'a sahip tokenları kabul eder
 */
export function authenticateWithPurpose(allowedPurpose: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token = extractToken(req.headers.authorization);
      
      if (!token && req.cookies?.access_token) {
        token = req.cookies.access_token;
      }

      if (!token) {
        throw new AuthenticationError('Token gerekli');
      }

      const user = verifyToken(token);
      
      // SECURITY: Sadece belirtilen purpose kabul edilir
      if ((user as any).purpose !== allowedPurpose) {
        logger.warn('Invalid purpose token', { 
          expected: allowedPurpose, 
          received: (user as any).purpose 
        });
        throw new AuthenticationError('Geçersiz token türü');
      }
      
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Authentication middleware that accepts both normal tokens and specific purpose tokens
 * SECURITY: Normal tokenlar veya belirtilen purpose tokenları kabul eder
 * Örn: 2FA setup hem normal kullanıcı hem de ilk login yapan kullanıcı için çalışmalı
 */
export function authenticateWithOptionalPurpose(allowedPurpose: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let token = extractToken(req.headers.authorization);
      
      if (!token && req.cookies?.access_token) {
        token = req.cookies.access_token;
      }

      if (!token) {
        throw new AuthenticationError('Token gerekli');
      }

      const user = verifyToken(token);
      const tokenPurpose = (user as any).purpose;
      
      // SECURITY: Ya normal token (purpose yok) ya da belirtilen purpose
      if (tokenPurpose && tokenPurpose !== allowedPurpose) {
        logger.warn('Invalid purpose token', { 
          expected: allowedPurpose, 
          received: tokenPurpose 
        });
        throw new AuthenticationError('Geçersiz token türü');
      }
      
      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Optional authentication (token varsa doğrula, yoksa devam et)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req.headers.authorization);

    if (token) {
      req.user = verifyToken(token);
    }
    next();
  } catch {
    // Token geçersizse sessizce devam et
    next();
  }
}

/**
 * Role-based authorization
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        throw new AuthenticationError();
      }

      if (!allowedRoles.includes(req.user.role)) {
        throw new ForbiddenError();
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Tenant isolation middleware
 * SECURITY: Override any client-provided tenantId to prevent manipulation
 */
export function tenantIsolation(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }

    if (!req.user.tenantId) {
      throw new ForbiddenError('Tenant bilgisi eksik');
    }

    // SECURITY FIX: Override client-provided tenantId
    // Client tarafından gönderilen tenantId manipüle edilebilir
    req.query.tenantId = req.user.tenantId;
    if (req.body && typeof req.body === 'object') {
      req.body.tenantId = req.user.tenantId;
    }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Verify entity belongs to current tenant
 * Use this in routes to verify ownership before operations
 * @param tableName - Database table name
 * @param entityId - Entity ID to verify
 * @param tenantId - Current user's tenant ID
 * @param db - Database instance
 * @returns Entity if found and owned by tenant, throws NotFoundError otherwise
 */
export async function verifyTenantOwnership(
  tableName: string,
  entityId: string,
  tenantId: string,
  db: any
): Promise<any> {
  // Whitelist of allowed table names to prevent SQL injection
  const allowedTables = [
    'users', 'stores', 'regions', 'ownership_groups', 'positions',
    'report_categories', 'designs', 'data_connections', 'datasets',
    'metrics', 'user_report_categories', 'ldap_connections', 'notifications'
  ];
  
  if (!allowedTables.includes(tableName)) {
    throw new ValidationError(`Invalid table name: ${tableName}`);
  }
  
  const entity = await db.queryOne(
    `SELECT id, tenant_id FROM ${tableName} WHERE id = $1`,
    [entityId]
  );
  
  if (!entity) {
    throw new NotFoundError(tableName);
  }
  
  if (entity.tenant_id !== tenantId) {
    // Log attempted cross-tenant access
    logger.warn('Cross-tenant access attempt', { 
      tableName, 
      entityId, 
      requestedTenantId: tenantId,
      actualTenantId: entity.tenant_id 
    });
    throw new NotFoundError(tableName); // Don't reveal entity exists in other tenant
  }
  
  return entity;
}

// ============================================
// ROLES
// ============================================

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  USER: 'USER',
  VIEWER: 'VIEWER'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

export default {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractToken,
  authenticate,
  authenticateWithPurpose,
  authenticateWithOptionalPurpose,
  optionalAuth,
  authorize,
  tenantIsolation,
  verifyTenantOwnership,
  ROLES
};
