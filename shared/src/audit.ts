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
// SENSITIVE OPERATIONS
// ============================================

/**
 * Password change - kritik güvenlik olayı
 */
export async function logPasswordChange(
  userId: string,
  tenantId: string,
  targetUserId: string,
  changedBy: 'self' | 'admin',
  ipAddress?: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'PASSWORD_CHANGE',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { changedBy, isSelfChange: userId === targetUserId },
    ipAddress
  });
  
  logger.info('Password changed', { 
    userId, 
    targetUserId, 
    changedBy,
    isSelfChange: userId === targetUserId 
  });
}

/**
 * Role change - kritik güvenlik olayı
 */
export async function logRoleChange(
  userId: string,
  tenantId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string,
  ipAddress?: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'UPDATE',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { 
      changeType: 'role_change',
      oldRole, 
      newRole 
    },
    ipAddress
  });
  
  logger.warn('User role changed', { 
    changedBy: userId, 
    targetUserId, 
    oldRole, 
    newRole 
  });
}

/**
 * Category permission change
 */
export async function logCategoryPermissionChange(
  userId: string,
  tenantId: string,
  targetUserId: string,
  addedCategories: string[],
  removedCategories: string[],
  canSeeAllCategories?: boolean
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'UPDATE',
    resourceType: 'user',
    resourceId: targetUserId,
    details: { 
      changeType: 'category_permission',
      addedCategories, 
      removedCategories,
      canSeeAllCategories
    }
  });
}

/**
 * Settings change - sistem ayarları değişikliği
 */
export async function logSettingsChange(
  userId: string,
  tenantId: string,
  settingKey: string,
  oldValue: any,
  newValue: any
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'SETTINGS_CHANGE',
    resourceType: 'system_setting',
    resourceId: settingKey,
    details: { 
      settingKey,
      oldValue: typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
      newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : newValue
    }
  });
  
  logger.info('Settings changed', { userId, settingKey });
}

/**
 * Data export - veri dışa aktarım
 */
export async function logDataExport(
  userId: string,
  tenantId: string,
  resourceType: ResourceType,
  exportFormat: string,
  rowCount: number,
  filters?: Record<string, any>
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'EXPORT',
    resourceType,
    details: { 
      format: exportFormat,
      rowCount,
      filters
    }
  });
  
  logger.info('Data exported', { userId, resourceType, format: exportFormat, rowCount });
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

// ============================================
// ADDITIONAL CRITICAL OPERATIONS
// ============================================

/**
 * 2FA Enable/Disable - kritik güvenlik
 */
export async function log2FAChange(
  userId: string,
  tenantId: string,
  enabled: boolean,
  ipAddress?: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: enabled ? 'CREATE' : 'DELETE',
    resourceType: 'user',
    resourceId: userId,
    details: { 
      changeType: '2fa_status',
      twoFactorEnabled: enabled 
    },
    ipAddress
  });
  
  logger.warn('2FA status changed', { userId, enabled });
}

/**
 * Database connection created/modified - sensitive
 */
export async function logConnectionChange(
  userId: string,
  tenantId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE',
  connectionId: string,
  connectionName: string,
  connectionType: string,
  ipAddress?: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action,
    resourceType: 'connection',
    resourceId: connectionId,
    resourceName: connectionName,
    details: { connectionType },
    ipAddress
  });
  
  logger.info('Connection changed', { userId, action, connectionId, connectionName });
}

/**
 * Dataset operation - data management
 */
export async function logDatasetOperation(
  userId: string,
  tenantId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC',
  datasetId: string,
  datasetName: string,
  details?: Record<string, any>
): Promise<void> {
  await log({
    userId,
    tenantId,
    action,
    resourceType: 'dataset',
    resourceId: datasetId,
    resourceName: datasetName,
    details
  });
}

/**
 * ETL job operation
 */
export async function logETLOperation(
  userId: string,
  tenantId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SYNC',
  jobId: string,
  datasetName?: string,
  details?: Record<string, any>
): Promise<void> {
  await log({
    userId,
    tenantId,
    action,
    resourceType: 'etl_job',
    resourceId: jobId,
    resourceName: datasetName,
    details
  });
}

/**
 * Bulk data delete - critical operation
 */
export async function logBulkDelete(
  userId: string,
  tenantId: string,
  resourceType: ResourceType,
  deletedCount: number,
  filters: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action: 'DELETE',
    resourceType,
    details: { 
      bulkOperation: true,
      deletedCount,
      filters 
    },
    ipAddress
  });
  
  logger.warn('Bulk delete executed', { userId, resourceType, deletedCount, filters });
}

/**
 * API key created/revoked
 */
export async function logAPIKeyChange(
  userId: string,
  tenantId: string,
  action: 'CREATE' | 'DELETE',
  keyId: string,
  keyName: string,
  ipAddress?: string
): Promise<void> {
  await log({
    userId,
    tenantId,
    action,
    resourceType: 'system_setting',
    resourceId: keyId,
    resourceName: `api_key:${keyName}`,
    details: { changeType: 'api_key' },
    ipAddress
  });
  
  logger.warn('API key changed', { userId, action, keyId });
}

/**
 * User impersonation - critical security
 */
export async function logImpersonation(
  adminUserId: string,
  tenantId: string,
  targetUserId: string,
  targetEmail: string,
  action: 'start' | 'end',
  ipAddress?: string
): Promise<void> {
  await log({
    userId: adminUserId,
    tenantId,
    action: action === 'start' ? 'CREATE' : 'DELETE',
    resourceType: 'session',
    resourceId: targetUserId,
    resourceName: `impersonation:${targetEmail}`,
    details: { 
      impersonation: true,
      targetUserId,
      targetEmail,
      impersonationAction: action
    },
    ipAddress
  });
  
  logger.warn('User impersonation', { adminUserId, targetUserId, action });
}

export default {
  log,
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
  log2FAChange,
  logConnectionChange,
  logDatasetOperation,
  logETLOperation,
  logBulkDelete,
  logAPIKeyChange,
  logImpersonation,
  getUserActivity,
  getRecentLogins,
  getFailedOperations
};

