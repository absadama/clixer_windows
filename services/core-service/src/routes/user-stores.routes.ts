/**
 * User-Store Assignment Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES } from '@clixer/shared';

const router = Router();

/**
 * GET /users/:id/stores
 * Get stores assigned to a user
 */
router.get('/:id/stores', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await db.queryAll(
      'SELECT store_id, store_name, assigned_at FROM user_stores WHERE user_id = $1',
      [req.params.id]
    );
    res.json({ success: true, data: stores });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/:id/stores
 * Assign stores to a user (Admin only)
 */
router.post('/:id/stores', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stores } = req.body; // [{ store_id, store_name }]
    
    for (const store of stores) {
      await db.query(
        `INSERT INTO user_stores (user_id, store_id, store_name, assigned_by) 
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, store_id) DO NOTHING`,
        [req.params.id, store.store_id, store.store_name, req.user!.userId]
      );
    }
    
    res.json({ success: true, message: 'Mağazalar atandı' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /users/:id/stores/:storeId
 * Remove store assignment from a user (Admin only)
 */
router.delete('/:id/stores/:storeId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.query(
      'DELETE FROM user_stores WHERE user_id = $1 AND store_id = $2',
      [req.params.id, req.params.storeId]
    );
    res.json({ success: true, message: 'Mağaza ataması kaldırıldı' });
  } catch (error) {
    next(error);
  }
});

export default router;
