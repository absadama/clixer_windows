/**
 * Clixer - Audit Logging Helper
 * Kim, ne zaman, ne yaptı kaydı
 * Enterprise güvenlik gereksinimi
 */

import db from './db';
import createLogger from './logger';

const logger = createLogger({ service: 'audit' });

// ============================================
// TYPES
// ============================================

export type AuditAction = 
  | 'CREATE' 
  | 'READ' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'LOGIN' 
  | 'LOGOUT' 
  | 'LOGIN_FAILED'
  | 'EXPORT' 
  | 'IMPORT' 
  | 'SYNC' 
  | 'ERROR'
  | 'PERMISSION_DENIED'
  | 'PASSWORD_CHANGE'
  | 'SETTINGS_CHANGE';

export type ResourceType = 
  | 'user' 
  | 'design' 
  | 'dataset' 
  | 'metric' 
  | 'connection' 
  | 'etl_job' 
  | 'system_setting'
  | 'store'
  | 'region'
  | 'position'
  | 'tenant'
  | 'session';

export interface AuditLogEntry {
  userId?: string;
  userEmail?: string;
  tenantId?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  resourceName?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  success?: boolean;
  errorMessage?: string;
}

// ============================================
// MAIN FUNCTION
// ============================================

/**
 * Audit log kaydı oluştur
 * 
 * @example
 * await audit.log({
 *   userId: req.user.userId,
 *   userEmail: req.user.email,
 *   tenantId: req.user.tenantId,
 *   action: 'CREATE',
 *   resourceType: 'design',
 *   resourceId: newDesign.id,
 *   resourceName: newDesign.name,
 *   ipAddress: req.ip,
 *   userAgent: req.headers['user-agent']
 * });
 */
export async function log(entry: AuditLogEntry): Promise<void> {
  try {
    // Mevcut tablo yapısına uygun: entity_type ve resource_type her ikisini de doldur
    await db.query(
      `INSERT INTO audit_logs (
        user_id, tenant_id,
        action, entity_type, resource_type, resource_id, resource_name,
        details, ip_address, user_agent,
        success, error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        entry.userId || null,
        entry.tenantId || null,
        entry.action,
        entry.resourceType, // entity_type
        entry.resourceType, // resource_type (ikisi de aynı değer)
        entry.resourceId || null,
        entry.resourceName || null,
        entry.details ? JSON.stringify(entry.details) : null,
        entry.ipAddress || null,
        entry.userAgent || null,
        entry.success !== false, // varsayılan true
        entry.errorMessage || null
      ]
    );

    logger.debug('Audit log created', { 
      action: entry.action, 
      resourceType: entry.resourceType,
      resourceId: entry.resourceId 
    });
  } catch (error: any) {
    // Audit log hatası ana akışı engellemez
    logger.error('Failed to create audit log', { 
      error: error.message,
      entry 
    });
  }
}

// ============================================
// CONVENIENCE FUNCTIONS
// ============================================

/**
 * Login başarılı
 */
export async function logLogin(
  userId: string, 
  email: string, 
  tenantId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await log({
    userId,
    userEmail: email,
    tenantId,
    action: 'LOGIN',
    resourceType: 'session',
    ipAddress,
    userAgent
  });
}

/**
 * Login başarısız
 */
export async function logLoginFailed(
  email: string,
  reason: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await log({
    userEmail: email,
    action: 'LOGIN_FAILED',
    resourceType: 'session',
    success: false,
    errorMessage: reason,
    ipAddress,
    userAgent
  });
}

/**
 * Logout
 */
export async function logLogout(
  userId: string,
  email: string,
  tenantId: string
): Promise<void> {
  await log({
    userId,
    userEmail: email,
    tenantId,
    action: 'LOGOUT',
    resourceType: 'session'
  });
}

/**
 * CRUD işlemi
 */
export async function logCrud(
  action: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE',
  resourceType: ResourceType,
  resourceId: string,
  userId: string,
  tenantId: string,
  details?: Record<string, any>
): Promise<void> {
  await log({
    userId,
    tenantId,
    action,
    resourceType,
    resourceId,
    details
  });
}

/**
 * Hata kaydı
 */
export async function logError(
  userId: string | undefined,
  tenantId: string | undefined,
  resourceType: ResourceType,
  errorMessage: string,
  details?: Record<string, any>
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'ERROR',
    resourceType,
    success: false,
    errorMessage,
    details
  });
}

/**
 * İzin reddedildi
 */
export async function logPermissionDenied(
  userId: string,
  tenantId: string,
  resourceType: ResourceType,
  resourceId: string,
  requiredPermission: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'PERMISSION_DENIED',
    resourceType,
    resourceId,
    success: false,
    errorMessage: `Required permission: ${requiredPermission}`
  });
}

// ============================================
// QUERY FUNCTIONS
// ============================================

/**
 * Kullanıcının son aktiviteleri
 */
export async function getUserActivity(
  userId: string,
  limit: number = 50
): Promise<any[]> {
  const result = await db.queryAll(
    `SELECT * FROM audit_logs 
     WHERE user_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [userId, limit]
  );
  return result;
}

/**
 * Son login denemeleri (güvenlik için)
 */
export async function getRecentLogins(
  tenantId: string,
  hours: number = 24
): Promise<any[]> {
  const result = await db.queryAll(
    `SELECT * FROM audit_logs 
     WHERE tenant_id = $1 
     AND action IN ('LOGIN', 'LOGIN_FAILED')
     AND created_at > NOW() - INTERVAL '${hours} hours'
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return result;
}

/**
 * Başarısız işlemler
 */
export async function getFailedOperations(
  tenantId: string,
  limit: number = 100
): Promise<any[]> {
  const result = await db.queryAll(
    `SELECT * FROM audit_logs 
     WHERE tenant_id = $1 
     AND success = false
     ORDER BY created_at DESC 
     LIMIT $2`,
    [tenantId, limit]
  );
  return result;
}

export default {
  log,
  logLogin,
  logLoginFailed,
  logLogout,
  logCrud,
  logError,
  logPermissionDenied,
  getUserActivity,
  getRecentLogins,
  getFailedOperations
};

