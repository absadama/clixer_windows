/**
 * Clixer - Authentication & Authorization
 * JWT handling ve middleware
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { AuthenticationError, TokenExpiredError, InvalidTokenError, ForbiddenError } from './errors';
import createLogger from './logger';

const logger = createLogger({ service: 'auth' });

// JWT Config
const JWT_SECRET = process.env.JWT_SECRET || 'clixer_dev_secret';
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || '1h';
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || '7d';
const BCRYPT_ROUNDS = 12;

// Token payload type
export interface TokenPayload {
  userId: string;
  tenantId: string;
  role: string;
  email: string;
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
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      throw new AuthenticationError('Token gerekli');
    }

    const user = verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
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
 */
export function tenantIsolation(req: Request, res: Response, next: NextFunction): void {
  try {
    if (!req.user) {
      throw new AuthenticationError();
    }

    // tenantId'yi query/body'ye otomatik ekle
    if (req.user.tenantId) {
      req.query.tenantId = req.user.tenantId;
      if (req.body) {
        req.body.tenantId = req.user.tenantId;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
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
  optionalAuth,
  authorize,
  tenantIsolation,
  ROLES
};
