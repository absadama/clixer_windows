/**
 * Dynamic Labels Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, cache, authenticate, authorize, tenantIsolation, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /labels
 * Get all labels for tenant with optional type filter
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.query;
    const tenantId = req.user!.tenantId;
    
    let query = `
      SELECT id, label_type, label_key, label_value, description, is_active, created_at, updated_at
      FROM labels 
      WHERE tenant_id = $1
    `;
    const params: any[] = [tenantId];
    
    if (type) {
      query += ' AND label_type = $2';
      params.push(type);
    }
    
    query += ' ORDER BY label_type, label_key';
    
    const labels = await db.queryAll(query, params);
    res.json({ success: true, data: labels });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /labels/:type
 * Get labels for a specific type (cacheable)
 */
router.get('/:type', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type } = req.params;
    const tenantId = req.user!.tenantId;
    
    // Check cache
    const cacheKey = `labels:${tenantId}:${type}`;
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json({ success: true, data: JSON.parse(cached), cached: true });
    }
    
    const labels = await db.queryAll(
      `SELECT label_key, label_value, description
       FROM labels 
       WHERE tenant_id = $1 AND label_type = $2 AND is_active = true
       ORDER BY label_key`,
      [tenantId, type]
    );
    
    // Convert to key-value map
    const labelMap: Record<string, string> = {};
    labels.forEach((l: any) => {
      labelMap[l.label_key] = l.label_value;
    });
    
    // Cache for 1 hour
    await cache.set(cacheKey, JSON.stringify(labelMap), 3600);
    
    res.json({ success: true, data: labelMap });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /labels
 * Create a new label (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label_type, label_key, label_value, description } = req.body;
    const tenantId = req.user!.tenantId;
    
    if (!label_type || !label_key || !label_value) {
      throw new ValidationError('label_type, label_key ve label_value zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO labels (tenant_id, label_type, label_key, label_value, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, label_type, label_key, label_value, description`,
      [tenantId, label_type, label_key, label_value, description || null]
    );
    
    // Clear cache
    await cache.del(`labels:${tenantId}:${label_type}`);
    
    logger.info('Label created', { label_type, label_key, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      return next(new ValidationError('Bu etiket zaten mevcut'));
    }
    next(error);
  }
});

/**
 * PUT /labels/batch
 * Batch update labels (Admin only) - Must be before :id route
 */
router.put('/batch', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { labels } = req.body;
    const tenantId = req.user!.tenantId;
    
    if (!Array.isArray(labels) || labels.length === 0) {
      throw new ValidationError('labels array zorunludur');
    }
    
    const typesToClear = new Set<string>();
    
    for (const label of labels) {
      if (!label.label_type || !label.label_key || !label.label_value) {
        continue;
      }
      
      await db.query(
        `INSERT INTO labels (tenant_id, label_type, label_key, label_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id, label_type, label_key) 
         DO UPDATE SET label_value = $4, updated_at = NOW()`,
        [tenantId, label.label_type, label.label_key, label.label_value]
      );
      typesToClear.add(label.label_type);
    }
    
    // Clear relevant caches
    for (const type of typesToClear) {
      try {
        await cache.del(`labels:${tenantId}:${type}`);
      } catch {
        // Ignore cache clear errors
      }
    }
    
    logger.info('Labels batch updated', { count: labels.length, user: req.user!.email });
    res.json({ success: true, message: `${labels.length} etiket güncellendi` });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /labels/:id
 * Update a label (Admin only)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { label_value, description, is_active } = req.body;
    const tenantId = req.user!.tenantId;
    
    // Find existing label
    const existing = await db.queryOne(
      'SELECT label_type FROM labels WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (!existing) {
      throw new NotFoundError('Etiket bulunamadı');
    }
    
    const result = await db.queryOne(
      `UPDATE labels 
       SET label_value = COALESCE($1, label_value),
           description = COALESCE($2, description),
           is_active = COALESCE($3, is_active),
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING id, label_type, label_key, label_value, description, is_active`,
      [label_value, description, is_active, id, tenantId]
    );
    
    // Clear cache
    await cache.del(`labels:${tenantId}:${existing.label_type}`);
    
    logger.info('Label updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /labels/:id
 * Delete a label (Admin only)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const tenantId = req.user!.tenantId;
    
    // Find existing label
    const existing = await db.queryOne(
      'SELECT label_type FROM labels WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    
    if (!existing) {
      throw new NotFoundError('Etiket bulunamadı');
    }
    
    await db.query('DELETE FROM labels WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    
    // Clear cache
    await cache.del(`labels:${tenantId}:${existing.label_type}`);
    
    logger.info('Label deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Etiket silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
