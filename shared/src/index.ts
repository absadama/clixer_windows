/**
 * Clixer - Shared Modules
 * Tüm microservices bu modülleri kullanır
 */

// Errors
export * from './errors';

// Logger
export { default as createLogger, requestLogger, generateTraceId } from './logger';
export type { LoggerOptions } from './logger';

// Database (PostgreSQL)
export { default as db } from './db';
export { 
  createPool, 
  getPool, 
  query, 
  queryOne, 
  queryAll, 
  withTransaction,
  checkHealth as checkDbHealth,
  closePool 
} from './db';
export type { DbConfig } from './db';

// ClickHouse
export { default as clickhouse } from './clickhouse';
export {
  createClickHouseClient,
  getClient as getClickHouseClient,
  query as chQuery,
  insert as chInsert,
  execute as chExecute,
  checkHealth as checkClickHouseHealth,
  closeClient as closeClickHouse
} from './clickhouse';
export type { ClickHouseConfig } from './clickhouse';

// Cache (Redis)
export { default as cache } from './cache';
export {
  createRedisClient,
  getClient as getRedisClient,
  set as cacheSet,
  get as cacheGet,
  del as cacheDel,
  getOrSet as cacheGetOrSet,
  publish,
  subscribe,
  checkHealth as checkCacheHealth,
  closeClients as closeRedis,
  invalidate as invalidateCache
} from './cache';
export type { CacheConfig } from './cache';

// Auth
export { default as auth } from './auth';
export {
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
  verifyTenantOwnership,
  ROLES
} from './auth';
export type { TokenPayload, AuthenticatedUser, Role } from './auth';

// Audit Logging
export { default as audit } from './audit';
export {
  log as auditLog,
  logLogin,
  logLoginFailed,
  logLogout,
  logCrud,
  logError,
  logPermissionDenied,
  logPasswordChange,
  logRoleChange,
  logCategoryPermissionChange,
  logSettingsChange,
  logDataExport,
  getUserActivity,
  getRecentLogins,
  getFailedOperations
} from './audit';
export type { AuditAction, ResourceType, AuditLogEntry } from './audit';

// Security (SQL Injection koruması, Input validation, Encryption)
export { default as security } from './security';
export {
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
  getClientIP,
  validatePassword
} from './security';
