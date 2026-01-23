/**
 * Tenant Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, ROLES } from '@clixer/shared';

const router = Router();

/**
 * GET /tenants
 * Get all tenants (Super Admin only)
 */
router.get('/', authenticate, authorize(ROLES.SUPER_ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tenants = await db.queryAll('SELECT * FROM tenants ORDER BY created_at DESC');
    res.json({ success: true, data: tenants });
  } catch (error) {
    next(error);
  }
});

export default router;
