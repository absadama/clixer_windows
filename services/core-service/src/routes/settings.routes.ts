/**
 * System Settings Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /settings
 * Get all system settings for tenant
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await db.queryAll(
      `SELECT id, key, value, category, created_at, updated_at 
       FROM system_settings 
       WHERE tenant_id = $1 OR tenant_id IS NULL
       ORDER BY category, key`,
      [req.user!.tenantId]
    );
    
    // Parse JSON values
    const parsed = settings.map((s: any) => ({
      ...s,
      value: typeof s.value === 'string' ? s.value : s.value
    }));
    
    res.json({ success: true, data: parsed });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /settings
 * Create a new system setting (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, value, category, label, description, type } = req.body;
    
    if (!key || !category) {
      throw new ValidationError('Anahtar ve kategori zorunludur');
    }
    
    // Check if key exists
    const existing = await db.queryOne(
      'SELECT id FROM system_settings WHERE (tenant_id = $1 OR tenant_id IS NULL) AND key = $2',
      [req.user!.tenantId, key]
    );
    
    if (existing) {
      throw new ValidationError('Bu anahtar zaten mevcut');
    }
    
    const result = await db.queryOne(
      `INSERT INTO system_settings (tenant_id, key, value, category)
       VALUES ($1, $2, $3, $4)
       RETURNING id, key, value, category`,
      [req.user!.tenantId, key, JSON.stringify({ value, label, description, type }), category]
    );
    
    logger.info('System setting created', { key, category, user: req.user!.email });
    
    res.status(201).json({ success: true, data: result, message: 'Ayar başarıyla oluşturuldu' });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /settings/:key
 * Update a system setting (Admin only)
 */
router.put('/:key', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    const { value, label, description, type, category } = req.body;
    
    // Prepare value to store
    let valueToStore: string;
    if (category === 'performance' && typeof value === 'object') {
      valueToStore = JSON.stringify(value);
    } else if (typeof value === 'object') {
      valueToStore = JSON.stringify(value);
    } else {
      valueToStore = JSON.stringify({ value, label, description, type });
    }
    
    // Find existing record
    const existing = await db.queryOne(
      'SELECT id, value FROM system_settings WHERE (tenant_id = $1 OR tenant_id IS NULL) AND key = $2',
      [req.user!.tenantId, key]
    );
    
    if (!existing) {
      // Upsert - create if not exists
      const result = await db.queryOne(
        `INSERT INTO system_settings (tenant_id, key, value, category)
         VALUES ($1, $2, $3, $4)
         RETURNING id, key, value, category`,
        [req.user!.tenantId, key, valueToStore, category || 'general']
      );
      
      logger.info('System setting created (upsert)', { key, user: req.user!.email });
      return res.json({ success: true, data: result, message: 'Ayar oluşturuldu' });
    }
    
    // Update existing
    const result = await db.queryOne(
      `UPDATE system_settings 
       SET value = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, key, value, category`,
      [valueToStore, existing.id]
    );
    
    logger.info('System setting updated', { key, user: req.user!.email });
    
    res.json({ success: true, data: result, message: 'Ayar güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /settings/:key
 * Delete a system setting (Admin only)
 * SECURITY: Sadece tenant'a ait ayarlar silinebilir, global ayarlar (tenant_id IS NULL) silinemez
 */
router.delete('/:key', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = req.params;
    
    // SECURITY: Sadece tenant'a ait ayarları sil - global ayarlar korunur
    const result = await db.query(
      'DELETE FROM system_settings WHERE tenant_id = $1 AND key = $2 RETURNING id',
      [req.user!.tenantId, key]
    );
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Ayar (sadece tenant ayarları silinebilir)');
    }
    
    logger.info('System setting deleted', { key, user: req.user!.email });
    
    res.json({ success: true, message: 'Ayar silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
