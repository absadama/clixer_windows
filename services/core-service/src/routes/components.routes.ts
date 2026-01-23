/**
 * Component Management Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, tenantIsolation } from '@clixer/shared';

const router = Router();

/**
 * GET /components
 * Get all components for tenant (optionally filtered by designId)
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.query;
    let query = 'SELECT * FROM components WHERE tenant_id = $1';
    const params: any[] = [req.user!.tenantId];

    if (designId) {
      query += ' AND design_id = $2';
      params.push(designId);
    }

    query += ' ORDER BY position';
    const components = await db.queryAll(query, params);
    res.json({ success: true, data: components });
  } catch (error) {
    next(error);
  }
});

export default router;
