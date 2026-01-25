/**
 * User-Store Assignment Routes
 * SECURITY: Tenant isolation uygulandı - cross-tenant IDOR koruması
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, NotFoundError, ForbiddenError } from '@clixer/shared';

const router = Router();

/**
 * SECURITY: Helper function to verify user belongs to same tenant
 * Cross-tenant IDOR koruması
 */
async function verifyUserTenant(userId: string, tenantId: string): Promise<boolean> {
  const user = await db.queryOne(
    'SELECT id, tenant_id FROM users WHERE id = $1',
    [userId]
  );
  
  if (!user) {
    throw new NotFoundError('Kullanıcı bulunamadı');
  }
  
  if (user.tenant_id !== tenantId) {
    // Log attempted cross-tenant access but don't reveal the user exists in another tenant
    throw new NotFoundError('Kullanıcı bulunamadı');
  }
  
  return true;
}

/**
 * GET /users/:id/stores
 * Get stores assigned to a user
 * SECURITY: Tenant isolation
 */
router.get('/:id/stores', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SECURITY: Verify user belongs to same tenant
    await verifyUserTenant(req.params.id, req.user!.tenantId);
    
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
 * SECURITY: Tenant isolation
 */
router.post('/:id/stores', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stores } = req.body; // [{ store_id, store_name }]
    
    // SECURITY: Verify user belongs to same tenant
    await verifyUserTenant(req.params.id, req.user!.tenantId);
    
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
 * SECURITY: Tenant isolation
 */
router.delete('/:id/stores/:storeId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SECURITY: Verify user belongs to same tenant
    await verifyUserTenant(req.params.id, req.user!.tenantId);
    
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
