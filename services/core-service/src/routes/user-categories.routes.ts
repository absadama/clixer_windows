/**
 * User-Category Assignment Routes
 * 
 * SECURITY FIX: Added tenant isolation to prevent cross-tenant data access
 * Previously, any authenticated user could access other tenants' user categories
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES, createLogger, NotFoundError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

/**
 * Verify user belongs to current tenant
 * SECURITY: This prevents cross-tenant data access
 */
async function verifyUserTenant(userId: string, tenantId: string): Promise<boolean> {
  const user = await db.queryOne(
    'SELECT id FROM users WHERE id = $1 AND tenant_id = $2',
    [userId, tenantId]
  );
  return !!user;
}

/**
 * GET /users/:id/categories
 * Get categories assigned to a user
 * SECURITY FIX: Added tenant verification
 */
router.get('/:id/categories', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SECURITY FIX: Verify user belongs to current tenant
    const userExists = await verifyUserTenant(req.params.id, req.user!.tenantId);
    if (!userExists) {
      throw new NotFoundError('Kullanıcı');
    }

    const categories = await db.queryAll(
      `SELECT rc.id, rc.code, rc.name, rc.color, rc.icon, urc.assigned_at
       FROM user_report_categories urc
       JOIN report_categories rc ON urc.category_id = rc.id
       WHERE urc.user_id = $1 AND rc.is_active = TRUE
       ORDER BY rc.sort_order, rc.name`,
      [req.params.id]
    );
    
    // Get user's can_see_all_categories status
    const user = await db.queryOne(
      'SELECT can_see_all_categories FROM users WHERE id = $1',
      [req.params.id]
    );
    
    res.json({ 
      success: true, 
      data: {
        categories,
        canSeeAllCategories: user?.can_see_all_categories ?? true
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /users/:id/categories
 * Update all categories for a user (Admin only)
 * SECURITY FIX: Added tenant verification
 */
router.put('/:id/categories', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;
    const { categoryIds, canSeeAllCategories } = req.body;
    
    // SECURITY FIX: Verify user belongs to current tenant
    const userExists = await verifyUserTenant(userId, req.user!.tenantId);
    if (!userExists) {
      throw new NotFoundError('Kullanıcı');
    }
    
    // Update can_see_all_categories
    if (typeof canSeeAllCategories === 'boolean') {
      await db.query(
        'UPDATE users SET can_see_all_categories = $1 WHERE id = $2',
        [canSeeAllCategories, userId]
      );
    }
    
    // Delete existing assignments
    await db.query('DELETE FROM user_report_categories WHERE user_id = $1', [userId]);
    
    // Insert new assignments
    if (Array.isArray(categoryIds) && categoryIds.length > 0) {
      for (const categoryId of categoryIds) {
        await db.query(
          `INSERT INTO user_report_categories (user_id, category_id, assigned_by)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, category_id) DO NOTHING`,
          [userId, categoryId, req.user!.userId]
        );
      }
    }
    
    logger.info('User categories updated', { userId, categoryCount: categoryIds?.length || 0, user: req.user!.email });
    res.json({ success: true, message: 'Kullanıcı kategorileri güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /users/:id/categories/:categoryId
 * Assign a single category to a user (Admin only)
 * SECURITY FIX: Added tenant verification
 */
router.post('/:id/categories/:categoryId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SECURITY FIX: Verify user belongs to current tenant
    const userExists = await verifyUserTenant(req.params.id, req.user!.tenantId);
    if (!userExists) {
      throw new NotFoundError('Kullanıcı');
    }

    await db.query(
      `INSERT INTO user_report_categories (user_id, category_id, assigned_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category_id) DO NOTHING`,
      [req.params.id, req.params.categoryId, req.user!.userId]
    );
    res.json({ success: true, message: 'Kategori atandı' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /users/:id/categories/:categoryId
 * Remove category assignment from a user (Admin only)
 * SECURITY FIX: Added tenant verification
 */
router.delete('/:id/categories/:categoryId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    // SECURITY FIX: Verify user belongs to current tenant
    const userExists = await verifyUserTenant(req.params.id, req.user!.tenantId);
    if (!userExists) {
      throw new NotFoundError('Kullanıcı');
    }

    await db.query(
      'DELETE FROM user_report_categories WHERE user_id = $1 AND category_id = $2',
      [req.params.id, req.params.categoryId]
    );
    res.json({ success: true, message: 'Kategori ataması kaldırıldı' });
  } catch (error) {
    next(error);
  }
});

export default router;
