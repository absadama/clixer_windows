/**
 * Grid Designs Routes
 * User-specific grid layout designs (DataGrid state persistence)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, tenantIsolation } from '@clixer/shared';

const router = Router();

/**
 * GET /grid-designs/:gridId
 * Get all grid designs for user and specific grid
 */
router.get('/:gridId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gridId } = req.params;
    const userId = (req as any).user.userId;
    const tenantId = (req as any).user.tenantId;

    const result = await db.query(
      `SELECT gd.id, gd.name, gd.grid_id, gd.state, gd.is_default, gd.dataset_id, 
              gd.created_at, gd.updated_at, d.name as dataset_name
       FROM grid_designs gd
       LEFT JOIN datasets d ON gd.dataset_id = d.id
       WHERE gd.user_id = $1 AND gd.tenant_id = $2 AND gd.grid_id = $3
       ORDER BY gd.is_default DESC, gd.name ASC`,
      [userId, tenantId, gridId]
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /grid-designs/:gridId/default
 * Get default grid design for user
 */
router.get('/:gridId/default', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gridId } = req.params;
    const userId = (req as any).user.userId;
    const tenantId = (req as any).user.tenantId;

    const result = await db.query(
      `SELECT id, name, grid_id, state, is_default, created_at, updated_at
       FROM grid_designs
       WHERE user_id = $1 AND tenant_id = $2 AND grid_id = $3 AND is_default = true
       LIMIT 1`,
      [userId, tenantId, gridId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /grid-designs
 * Create new grid design
 */
router.post('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { gridId, name, state, isDefault, datasetId } = req.body;
    const userId = (req as any).user.userId;
    const tenantId = (req as any).user.tenantId;

    // If setting as default, remove default from others
    if (isDefault) {
      await db.query(
        `UPDATE grid_designs SET is_default = false WHERE user_id = $1 AND grid_id = $2`,
        [userId, gridId]
      );
    }

    const result = await db.query(
      `INSERT INTO grid_designs (user_id, tenant_id, grid_id, name, state, is_default, dataset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, grid_id, state, is_default, dataset_id, created_at`,
      [userId, tenantId, gridId, name, JSON.stringify(state), isDefault || false, datasetId || null]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    if (error.code === '23505') {
      res.status(400).json({ success: false, error: 'Bu isimde bir tasarım zaten mevcut' });
    } else {
      next(error);
    }
  }
});

/**
 * PUT /grid-designs/:id
 * Update grid design
 */
router.put('/:id', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, state, isDefault } = req.body;
    const userId = (req as any).user.userId;

    // If setting as default, remove default from others
    if (isDefault) {
      const existing = await db.query('SELECT grid_id FROM grid_designs WHERE id = $1', [id]);
      if (existing.rows.length > 0) {
        await db.query(
          `UPDATE grid_designs SET is_default = false WHERE user_id = $1 AND grid_id = $2`,
          [userId, existing.rows[0].grid_id]
        );
      }
    }

    const result = await db.query(
      `UPDATE grid_designs 
       SET name = COALESCE($1, name), 
           state = COALESCE($2, state), 
           is_default = COALESCE($3, is_default),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, grid_id, state, is_default, updated_at`,
      [name, state ? JSON.stringify(state) : null, isDefault, id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tasarım bulunamadı' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /grid-designs/:id
 * Delete grid design
 */
router.delete('/:id', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    const result = await db.query(
      `DELETE FROM grid_designs WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tasarım bulunamadı' });
    }

    res.json({ success: true, message: 'Tasarım silindi' });
  } catch (error) {
    next(error);
  }
});

export default router;
