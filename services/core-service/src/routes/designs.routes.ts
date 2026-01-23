/**
 * Design Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, tenantIsolation, NotFoundError } from '@clixer/shared';

const router = Router();

/**
 * GET /designs
 * Get all designs for tenant
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const designs = await db.queryAll(
      'SELECT * FROM designs WHERE tenant_id = $1 ORDER BY updated_at DESC',
      [req.user!.tenantId]
    );
    res.json({ success: true, data: designs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /designs/:id
 * Get a specific design by ID
 */
router.get('/:id', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const design = await db.queryOne(
      'SELECT * FROM designs WHERE id = $1 AND tenant_id = $2',
      [req.params.id, req.user!.tenantId]
    );
    if (!design) throw new NotFoundError('Tasarım');
    res.json({ success: true, data: design });
  } catch (error) {
    next(error);
  }
});

export default router;
