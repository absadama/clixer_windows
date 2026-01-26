/**
 * Report Subscriptions Routes
 * CRUD operations for scheduled report email subscriptions
 * 
 * Security:
 * - All endpoints require authentication
 * - Admin/SuperAdmin only for create/update/delete
 * - Tenant isolation enforced
 * - Input validation on all fields
 * - Audit logging for all operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import {
  db,
  createLogger,
  authenticate,
  tenantIsolation,
  AppError,
  ValidationError,
  ForbiddenError
} from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'notification-subscriptions' });

// Cron format validation regex
const CRON_REGEX = /^(\*|[0-5]?\d)\s+(\*|[01]?\d|2[0-3])\s+(\*|[1-9]|[12]\d|3[01])\s+(\*|[1-9]|1[0-2])\s+(\*|[0-6])$/;

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Design type validation
const VALID_DESIGN_TYPES = ['cockpit', 'analysis'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function requireAdmin(req: Request): void {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPER_ADMIN') {
    throw new ForbiddenError('Bu işlem için admin yetkisi gerekli');
  }
}

function validateCron(cron: string): boolean {
  return CRON_REGEX.test(cron);
}

function validateUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

function validateUUIDs(uuids: string[]): boolean {
  return uuids.every(uuid => validateUUID(uuid));
}

async function auditLog(
  action: string,
  status: string,
  subscriptionId: string | null,
  tenantId: string,
  userId: string,
  details?: Record<string, any>
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO subscription_logs 
       (subscription_id, tenant_id, action, status, metadata, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [subscriptionId, tenantId, action, status, JSON.stringify(details || {}), userId]
    );
  } catch (error) {
    logger.error('Audit log failed', { error, action, subscriptionId });
  }
}

// ============================================
// GET /subscriptions - List all subscriptions
// ============================================
router.get('/', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenantId = req.user!.tenantId;
    
    const subscriptions = await db.queryAll(`
      SELECT 
        rs.*,
        d.name as design_name,
        u.name as created_by_name,
        (SELECT COUNT(*) FROM subscription_logs WHERE subscription_id = rs.id AND action = 'SENT') as total_sent
      FROM report_subscriptions rs
      LEFT JOIN designs d ON rs.design_id = d.id
      LEFT JOIN users u ON rs.created_by = u.id
      WHERE rs.tenant_id = $1
      ORDER BY rs.created_at DESC
    `, [tenantId]);

    // Get recipient names for each subscription
    for (const sub of subscriptions) {
      if (sub.recipient_user_ids && sub.recipient_user_ids.length > 0) {
        const recipients = await db.queryAll(
          `SELECT id, name, email FROM users WHERE id = ANY($1)`,
          [sub.recipient_user_ids]
        );
        sub.recipients = recipients;
      } else {
        sub.recipients = [];
      }
    }

    res.json({ success: true, data: subscriptions });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET /subscriptions/:id - Get single subscription
// ============================================
router.get('/:id', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;

    if (!validateUUID(id)) {
      throw new ValidationError('Geçersiz abonelik ID');
    }

    const subscription = await db.queryOne(`
      SELECT 
        rs.*,
        d.name as design_name,
        d.type as design_type_actual
      FROM report_subscriptions rs
      LEFT JOIN designs d ON rs.design_id = d.id
      WHERE rs.id = $1 AND rs.tenant_id = $2
    `, [id, tenantId]);

    if (!subscription) {
      throw new AppError('Abonelik bulunamadı', 404);
    }

    // Get recipients
    if (subscription.recipient_user_ids && subscription.recipient_user_ids.length > 0) {
      const recipients = await db.queryAll(
        `SELECT id, name, email FROM users WHERE id = ANY($1)`,
        [subscription.recipient_user_ids]
      );
      subscription.recipients = recipients;
    }

    // Get recent logs
    const logs = await db.queryAll(`
      SELECT action, status, created_at, error_message, execution_time_ms
      FROM subscription_logs
      WHERE subscription_id = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [id]);
    subscription.recent_logs = logs;

    res.json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /subscriptions - Create subscription
// ============================================
router.post('/', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    const {
      name,
      description,
      design_id,
      design_type = 'cockpit',
      recipient_user_ids,
      recipient_emails = [],
      schedule_cron,
      schedule_description
    } = req.body;

    // ===== INPUT VALIDATION =====
    
    // Name validation
    if (!name || typeof name !== 'string' || name.trim().length < 3) {
      throw new ValidationError('Abonelik adı en az 3 karakter olmalı');
    }
    if (name.length > 255) {
      throw new ValidationError('Abonelik adı en fazla 255 karakter olabilir');
    }

    // Design validation
    if (design_id && !validateUUID(design_id)) {
      throw new ValidationError('Geçersiz rapor ID');
    }

    // Design type validation
    if (!VALID_DESIGN_TYPES.includes(design_type)) {
      throw new ValidationError('Geçersiz rapor tipi (cockpit veya analysis olmalı)');
    }

    // Recipients validation
    if (!Array.isArray(recipient_user_ids) || recipient_user_ids.length === 0) {
      throw new ValidationError('En az bir alıcı seçilmeli');
    }
    if (recipient_user_ids.length > 50) {
      throw new ValidationError('En fazla 50 alıcı seçilebilir');
    }
    if (!validateUUIDs(recipient_user_ids)) {
      throw new ValidationError('Geçersiz alıcı ID formatı');
    }

    // Verify recipients exist and belong to tenant
    const validRecipients = await db.queryAll(
      `SELECT id FROM users WHERE id = ANY($1) AND tenant_id = $2`,
      [recipient_user_ids, tenantId]
    );
    if (validRecipients.length !== recipient_user_ids.length) {
      throw new ValidationError('Bazı alıcılar bulunamadı veya bu tenant\'a ait değil');
    }

    // Cron validation
    if (!schedule_cron || !validateCron(schedule_cron)) {
      throw new ValidationError('Geçersiz zamanlama formatı (cron)');
    }

    // ===== CREATE SUBSCRIPTION =====

    const result = await db.queryOne(`
      INSERT INTO report_subscriptions (
        tenant_id, name, description, design_id, design_type,
        recipient_user_ids, recipient_emails, schedule_cron,
        schedule_description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      tenantId,
      name.trim(),
      description?.trim() || null,
      design_id || null,
      design_type,
      recipient_user_ids,
      recipient_emails,
      schedule_cron,
      schedule_description || null,
      userId
    ]);

    // Audit log
    await auditLog('CREATED', 'SUCCESS', result.id, tenantId, userId, {
      name,
      design_id,
      recipient_count: recipient_user_ids.length,
      schedule_cron
    });

    logger.info('Subscription created', {
      subscriptionId: result.id,
      tenantId,
      userId,
      name
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PUT /subscriptions/:id - Update subscription
// ============================================
router.put('/:id', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    if (!validateUUID(id)) {
      throw new ValidationError('Geçersiz abonelik ID');
    }

    // Check if subscription exists
    const existing = await db.queryOne(
      `SELECT id FROM report_subscriptions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!existing) {
      throw new AppError('Abonelik bulunamadı', 404);
    }

    const {
      name,
      description,
      design_id,
      design_type,
      recipient_user_ids,
      schedule_cron,
      schedule_description,
      is_active
    } = req.body;

    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 3) {
        throw new ValidationError('Abonelik adı en az 3 karakter olmalı');
      }
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(description?.trim() || null);
    }

    if (design_id !== undefined) {
      if (design_id && !validateUUID(design_id)) {
        throw new ValidationError('Geçersiz rapor ID');
      }
      updates.push(`design_id = $${paramIndex++}`);
      values.push(design_id || null);
    }

    if (design_type !== undefined) {
      if (!VALID_DESIGN_TYPES.includes(design_type)) {
        throw new ValidationError('Geçersiz rapor tipi');
      }
      updates.push(`design_type = $${paramIndex++}`);
      values.push(design_type);
    }

    if (recipient_user_ids !== undefined) {
      if (!Array.isArray(recipient_user_ids) || recipient_user_ids.length === 0) {
        throw new ValidationError('En az bir alıcı seçilmeli');
      }
      if (!validateUUIDs(recipient_user_ids)) {
        throw new ValidationError('Geçersiz alıcı ID formatı');
      }
      updates.push(`recipient_user_ids = $${paramIndex++}`);
      values.push(recipient_user_ids);
    }

    if (schedule_cron !== undefined) {
      if (!validateCron(schedule_cron)) {
        throw new ValidationError('Geçersiz zamanlama formatı');
      }
      updates.push(`schedule_cron = $${paramIndex++}`);
      values.push(schedule_cron);
    }

    if (schedule_description !== undefined) {
      updates.push(`schedule_description = $${paramIndex++}`);
      values.push(schedule_description || null);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(Boolean(is_active));
    }

    updates.push(`updated_by = $${paramIndex++}`);
    values.push(userId);

    if (updates.length === 1) {
      throw new ValidationError('Güncellenecek alan belirtilmedi');
    }

    values.push(id);
    values.push(tenantId);

    const result = await db.queryOne(`
      UPDATE report_subscriptions
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++} AND tenant_id = $${paramIndex}
      RETURNING *
    `, values);

    // Audit log
    await auditLog('UPDATED', 'SUCCESS', id, tenantId, userId, req.body);

    logger.info('Subscription updated', { subscriptionId: id, tenantId, userId });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE /subscriptions/:id - Delete subscription
// ============================================
router.delete('/:id', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    if (!validateUUID(id)) {
      throw new ValidationError('Geçersiz abonelik ID');
    }

    // Check if exists
    const existing = await db.queryOne(
      `SELECT id, name FROM report_subscriptions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!existing) {
      throw new AppError('Abonelik bulunamadı', 404);
    }

    // Delete (logs cascade automatically)
    await db.query(
      `DELETE FROM report_subscriptions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    // Audit log (subscription_id will be null since it's deleted)
    await auditLog('DELETED', 'SUCCESS', null, tenantId, userId, {
      deleted_subscription_id: id,
      deleted_subscription_name: existing.name
    });

    logger.info('Subscription deleted', { subscriptionId: id, tenantId, userId });

    res.json({ success: true, message: 'Abonelik silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /subscriptions/:id/toggle - Toggle active status
// ============================================
router.post('/:id/toggle', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    if (!validateUUID(id)) {
      throw new ValidationError('Geçersiz abonelik ID');
    }

    const result = await db.queryOne(`
      UPDATE report_subscriptions
      SET is_active = NOT is_active, updated_by = $1
      WHERE id = $2 AND tenant_id = $3
      RETURNING id, name, is_active
    `, [userId, id, tenantId]);

    if (!result) {
      throw new AppError('Abonelik bulunamadı', 404);
    }

    await auditLog(
      result.is_active ? 'ACTIVATED' : 'DEACTIVATED',
      'SUCCESS',
      id,
      tenantId,
      userId
    );

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// ============================================
// POST /subscriptions/:id/send-now - Manual trigger
// ============================================
router.post('/:id/send-now', authenticate as any, tenantIsolation as any, async (req: Request, res: Response, next: NextFunction) => {
  try {
    requireAdmin(req);

    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    const userId = req.user!.userId;

    if (!validateUUID(id)) {
      throw new ValidationError('Geçersiz abonelik ID');
    }

    const subscription = await db.queryOne(
      `SELECT * FROM report_subscriptions WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (!subscription) {
      throw new AppError('Abonelik bulunamadı', 404);
    }

    // Trigger send via Redis pub/sub (scheduler will pick it up)
    const { cache } = await import('@clixer/shared');
    await cache.publish('subscription:send', JSON.stringify({
      subscriptionId: id,
      tenantId,
      triggeredBy: userId,
      manual: true
    }));

    await auditLog('MANUAL_TRIGGER', 'SUCCESS', id, tenantId, userId);

    res.json({ 
      success: true, 
      message: 'Gönderim tetiklendi, kısa süre içinde işlenecek' 
    });
  } catch (error) {
    next(error);
  }
});

export default router;
