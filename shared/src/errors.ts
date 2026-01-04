/**
 * Clixer - Centralized Error Handling
 * Tüm servisler bu error class'ları kullanır
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

// Authentication Errors
export class AuthenticationError extends AppError {
  constructor(message: string = 'Kimlik doğrulama başarısız') {
    super(message, 401, 'AUTH_001');
  }
}

export class TokenExpiredError extends AppError {
  constructor(message: string = 'Token süresi dolmuş') {
    super(message, 401, 'AUTH_002');
  }
}

export class InvalidTokenError extends AppError {
  constructor(message: string = 'Geçersiz token') {
    super(message, 401, 'AUTH_003');
  }
}

// Authorization Errors
export class ForbiddenError extends AppError {
  constructor(message: string = 'Bu işlem için yetkiniz yok') {
    super(message, 403, 'AUTH_004');
  }
}

// Resource Errors
export class NotFoundError extends AppError {
  constructor(resource: string = 'Kaynak') {
    super(`${resource} bulunamadı`, 404, 'RES_001');
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Kaynak zaten mevcut') {
    super(message, 409, 'RES_002');
  }
}

// Validation Errors
export class ValidationError extends AppError {
  public readonly details?: Record<string, string>;

  constructor(message: string = 'Doğrulama hatası', details?: Record<string, string>) {
    super(message, 400, 'VAL_001');
    this.details = details;
  }
}

// Database Errors
export class DatabaseError extends AppError {
  constructor(message: string = 'Veritabanı hatası') {
    super(message, 500, 'DB_001', false);
  }
}

// External Service Errors
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string = 'Servis hatası') {
    super(`${service}: ${message}`, 502, 'EXT_001');
  }
}

// Rate Limit Error
export class RateLimitError extends AppError {
  constructor(message: string = 'Çok fazla istek, lütfen bekleyin') {
    super(message, 429, 'RATE_001');
  }
}

// Error Response Type
export interface ErrorResponse {
  success: false;
  errorCode: string;
  message: string;
  details?: Record<string, string>;
  stack?: string;
}

// Error handler middleware için yardımcı
export function formatError(error: Error, includeStack: boolean = false): ErrorResponse {
  if (error instanceof AppError) {
    return {
      success: false,
      errorCode: error.errorCode,
      message: error.message,
      details: error instanceof ValidationError ? error.details : undefined,
      stack: includeStack ? error.stack : undefined
    };
  }

  return {
    success: false,
    errorCode: 'UNKNOWN_ERROR',
    message: 'Beklenmeyen bir hata oluştu',
    stack: includeStack ? error.stack : undefined
  };
}
