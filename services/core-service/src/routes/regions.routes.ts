/**
 * Region Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /regions
 * Get all regions for tenant
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const regions = await db.queryAll(
      'SELECT id, code, name, description, manager_name, manager_email, sort_order, is_active FROM regions WHERE tenant_id = $1 AND is_active = TRUE ORDER BY sort_order, name',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: regions });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /regions
 * Create a new region (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, manager_name, manager_email } = req.body;
    
    if (!code || !name) {
      throw new ValidationError('Bölge kodu ve adı zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO regions (tenant_id, code, name, description, manager_name, manager_email)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user!.tenantId, code, name, description, manager_name, manager_email]
    );
    
    logger.info('Region created', { code, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new ValidationError('Bu bölge kodu zaten kullanılıyor'));
    } else {
      next(error);
    }
  }
});

/**
 * PUT /regions/:id
 * Update a region (Admin only)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name, description, manager_name, manager_email, is_active } = req.body;
    
    const result = await db.queryOne(
      `UPDATE regions SET 
        code = COALESCE($3, code),
        name = COALESCE($4, name),
        description = COALESCE($5, description),
        manager_name = COALESCE($6, manager_name),
        manager_email = COALESCE($7, manager_email),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user!.tenantId, code, name, description, manager_name, manager_email, is_active]
    );
    
    if (!result) throw new NotFoundError('Bölge');
    logger.info('Region updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /regions/:id
 * Delete a region (Admin only)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Check for linked stores
    const storeCount = await db.queryOne(
      'SELECT COUNT(*) as count FROM stores WHERE region_id = $1',
      [id]
    );
    
    if (storeCount && storeCount.count > 0) {
      throw new ValidationError(`Bu bölgeye bağlı ${storeCount.count} mağaza var. Önce mağazaları farklı bölgeye taşıyın.`);
    }
    
    const result = await db.queryOne(
      'DELETE FROM regions WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Bölge');
    logger.info('Region deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Bölge silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
