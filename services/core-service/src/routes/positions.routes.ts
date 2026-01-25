/**
 * Position Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * GET /positions
 * Get all positions
 */
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const positions = await db.queryAll(
      'SELECT code, name, hierarchy_level, can_see_all_stores, description, filter_level FROM positions ORDER BY hierarchy_level'
    );
    res.json({ success: true, data: positions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /positions/:code/permissions
 * Get permissions for a specific position
 */
router.get('/:code/permissions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await db.queryAll(
      'SELECT menu_key, can_view, can_edit FROM menu_permissions WHERE position_code = $1',
      [req.params.code]
    );
    res.json({ success: true, data: permissions });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /positions/:code/permissions
 * Update permissions for a position (SUPER_ADMIN only)
 * SECURITY FIX: Sadece SUPER_ADMIN pozisyon izinlerini değiştirebilir
 * (Pozisyonlar tüm tenant'lar için geçerli sistem ayarıdır)
 */
router.put('/:code/permissions', authenticate, authorize(ROLES.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const { permissions } = req.body; // [{ menu_key, can_view, can_edit }]
    
    // Delete existing permissions
    await db.query('DELETE FROM menu_permissions WHERE position_code = $1', [code]);
    
    // Insert new permissions
    for (const perm of permissions) {
      await db.query(
        'INSERT INTO menu_permissions (position_code, menu_key, can_view, can_edit) VALUES ($1, $2, $3, $4)',
        [code, perm.menu_key, perm.can_view, perm.can_edit]
      );
    }
    
    logger.info('Position permissions updated', { code, user: req.user!.email });
    res.json({ success: true, message: 'İzinler güncellendi' });
  } catch (error) {
    next(error);
  }
});

export default router;
