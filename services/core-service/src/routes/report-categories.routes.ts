/**
 * Report Categories Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /report-categories
 * Get all report categories for tenant
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await db.queryAll(
      `SELECT id, code, name, description, color, icon, sort_order, is_active, created_at
       FROM report_categories 
       WHERE tenant_id = $1 AND is_active = TRUE 
       ORDER BY sort_order, name`,
      [req.user!.tenantId]
    );
    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /report-categories/:id
 * Get a specific report category by ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = await db.queryOne(
      `SELECT id, code, name, description, color, icon, sort_order, is_active, created_at
       FROM report_categories 
       WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.user!.tenantId]
    );
    if (!category) throw new NotFoundError('Rapor kategorisi');
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /report-categories
 * Create a new report category (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, color, icon, sort_order } = req.body;
    
    if (!code || !name) {
      throw new ValidationError('Kategori kodu ve adı zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO report_categories (tenant_id, code, name, description, color, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.user!.tenantId, code.toUpperCase(), name, description, color || '#6366f1', icon || 'Folder', sort_order || 0]
    );
    
    logger.info('Report category created', { code, name, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new ValidationError('Bu kategori kodu zaten kullanılıyor'));
    } else {
      next(error);
    }
  }
});

/**
 * PUT /report-categories/:id
 * Update a report category (Admin only)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name, description, color, icon, sort_order, is_active } = req.body;
    
    const result = await db.queryOne(
      `UPDATE report_categories SET 
        code = COALESCE($3, code),
        name = COALESCE($4, name),
        description = COALESCE($5, description),
        color = COALESCE($6, color),
        icon = COALESCE($7, icon),
        sort_order = COALESCE($8, sort_order),
        is_active = COALESCE($9, is_active),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user!.tenantId, code?.toUpperCase(), name, description, color, icon, sort_order, is_active]
    );
    
    if (!result) throw new NotFoundError('Rapor kategorisi');
    logger.info('Report category updated', { id, name, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /report-categories/:id
 * Delete a report category (Admin only)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Check for linked designs
    const designCount = await db.queryOne(
      'SELECT COUNT(*) as count FROM designs WHERE category_id = $1',
      [id]
    );
    
    if (designCount && parseInt(designCount.count) > 0) {
      throw new ValidationError(`Bu kategori ${designCount.count} rapora atanmış. Önce raporları başka kategoriye taşıyın.`);
    }
    
    // Delete user assignments
    await db.query('DELETE FROM user_report_categories WHERE category_id = $1', [id]);
    
    // Delete category
    const result = await db.queryOne(
      'DELETE FROM report_categories WHERE id = $1 AND tenant_id = $2 RETURNING id, name',
      [id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Rapor kategorisi');
    logger.info('Report category deleted', { id, name: result.name, user: req.user!.email });
    res.json({ success: true, message: 'Rapor kategorisi silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
