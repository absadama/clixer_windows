/**
 * Input Sanitization Module
 * Enterprise-grade input cleaning for security
 */

import createLogger from './logger';

const logger = createLogger({ service: 'sanitize' });

/**
 * Dangerous patterns that could indicate attacks
 */
const DANGEROUS_PATTERNS = [
  // SQL Injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|TRUNCATE)\b.*\b(FROM|INTO|TABLE|DATABASE)\b)/gi,
  /('.*OR.*'.*=.*')/gi,
  /(;\s*--)/g,
  /(\bEXEC\b|\bEXECUTE\b)/gi,
  
  // NoSQL Injection
  /(\$where|\$gt|\$lt|\$ne|\$regex)/gi,
  
  // Path traversal
  /(\.\.\/|\.\.\\)/g,
  
  // Command injection
  /([;&|`$])/g,
  
  // Script injection (XSS)
  /(<script[\s\S]*?>[\s\S]*?<\/script>)/gi,
  /(javascript:|vbscript:|data:text\/html)/gi,
  /(on\w+\s*=)/gi,
];

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str.replace(/[&<>"'/]/g, char => HTML_ENTITIES[char] || char);
}

/**
 * Check if input contains dangerous patterns
 */
export function containsDangerousPattern(input: string): { dangerous: boolean; pattern?: string } {
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(input)) {
      return { dangerous: true, pattern: pattern.source };
    }
    // Reset regex lastIndex for global patterns
    pattern.lastIndex = 0;
  }
  return { dangerous: false };
}

/**
 * Sanitize a single string value
 */
export function sanitizeString(value: string, options?: {
  escapeHtml?: boolean;
  maxLength?: number;
  allowNewlines?: boolean;
}): string {
  let sanitized = value;
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Normalize unicode
  sanitized = sanitized.normalize('NFC');
  
  // Remove control characters (except newline if allowed)
  if (options?.allowNewlines) {
    sanitized = sanitized.replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, '');
  } else {
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  }
  
  // Escape HTML if requested
  if (options?.escapeHtml) {
    sanitized = escapeHtml(sanitized);
  }
  
  // Truncate to max length
  if (options?.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  return sanitized;
}

/**
 * Deep sanitize an object (recursive)
 */
export function sanitizeObject(obj: any, depth = 0): any {
  // Prevent deep recursion attacks
  if (depth > 10) {
    logger.warn('Sanitize depth exceeded', { depth });
    return {};
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }
  
  if (typeof obj === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Sanitize keys too (prevent prototype pollution)
      const sanitizedKey = sanitizeString(key);
      if (sanitizedKey === '__proto__' || sanitizedKey === 'constructor' || sanitizedKey === 'prototype') {
        logger.warn('Prototype pollution attempt blocked', { key });
        continue;
      }
      sanitized[sanitizedKey] = sanitizeObject(value, depth + 1);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * Validate and sanitize SQL identifier (table/column names)
 */
export function sanitizeSqlIdentifier(identifier: string): string {
  // Only allow alphanumeric, underscore
  const sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Must start with letter or underscore
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    throw new Error('Invalid SQL identifier');
  }
  
  // Max length 63 (PostgreSQL limit)
  if (sanitized.length > 63) {
    throw new Error('SQL identifier too long');
  }
  
  return sanitized;
}

/**
 * Express middleware for input sanitization
 */
export function sanitizeMiddleware() {
  return (req: any, res: any, next: any) => {
    try {
      // Sanitize body
      if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
      }
      
      // Sanitize query params
      if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
      }
      
      // Check for dangerous patterns in raw body (if available)
      const rawBody = JSON.stringify(req.body || {});
      const check = containsDangerousPattern(rawBody);
      if (check.dangerous) {
        logger.warn('Dangerous pattern detected in request', {
          ip: req.ip,
          path: req.path,
          pattern: check.pattern
        });
        // Don't block, just log - parameterized queries protect against SQL injection
      }
      
      next();
    } catch (error: any) {
      logger.error('Sanitization error', { error: error.message });
      next(error);
    }
  };
}

export default {
  escapeHtml,
  containsDangerousPattern,
  sanitizeString,
  sanitizeObject,
  sanitizeSqlIdentifier,
  sanitizeMiddleware
};
