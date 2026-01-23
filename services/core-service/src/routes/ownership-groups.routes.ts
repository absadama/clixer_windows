/**
 * Ownership Groups Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /ownership-groups
 * Get all ownership groups for tenant
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const groups = await db.queryAll(
      'SELECT id, code, name, description, color, icon, is_active FROM ownership_groups WHERE tenant_id = $1 AND is_active = TRUE ORDER BY sort_order, name',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ownership-groups
 * Create a new ownership group (Admin only)
 */
router.post('/', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code, name, description, color, icon } = req.body;
    
    if (!code || !name) {
      throw new ValidationError('Grup kodu ve adı zorunludur');
    }
    
    const result = await db.queryOne(
      `INSERT INTO ownership_groups (tenant_id, code, name, description, color, icon)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user!.tenantId, code, name, description, color, icon]
    );
    
    logger.info('Ownership group created', { code, user: req.user!.email });
    res.status(201).json({ success: true, data: result });
  } catch (error: any) {
    if (error.code === '23505') {
      next(new ValidationError('Bu grup kodu zaten kullanılıyor'));
    } else {
      next(error);
    }
  }
});

/**
 * PUT /ownership-groups/:id
 * Update an ownership group (Admin only)
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { code, name, description, color, icon, is_active } = req.body;
    
    const result = await db.queryOne(
      `UPDATE ownership_groups SET 
        code = COALESCE($3, code),
        name = COALESCE($4, name),
        description = COALESCE($5, description),
        color = COALESCE($6, color),
        icon = COALESCE($7, icon),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [id, req.user!.tenantId, code, name, description, color, icon, is_active]
    );
    
    if (!result) throw new NotFoundError('Sahiplik grubu');
    logger.info('Ownership group updated', { id, user: req.user!.email });
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /ownership-groups/:id
 * Delete an ownership group (Admin only)
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await db.queryOne(
      'DELETE FROM ownership_groups WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, req.user!.tenantId]
    );
    
    if (!result) throw new NotFoundError('Sahiplik grubu');
    logger.info('Ownership group deleted', { id, user: req.user!.email });
    res.json({ success: true, message: 'Sahiplik grubu silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
