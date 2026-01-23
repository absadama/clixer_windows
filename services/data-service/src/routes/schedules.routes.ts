/**
 * Schedules Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, tenantIsolation, ROLES, createLogger, NotFoundError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /schedules
 * List all ETL schedules
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schedules = await db.queryAll(
      `SELECT d.id, d.name, d.sync_schedule, d.last_sync_at, d.is_active
       FROM datasets d
       WHERE d.tenant_id = $1 AND d.sync_schedule IS NOT NULL
       ORDER BY d.name`,
      [req.user!.tenantId]
    );
    
    res.json({ success: true, data: schedules });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /schedules/:id
 * Update schedule for a dataset
 */
router.put('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { syncSchedule, isActive } = req.body;
    
    const result = await db.queryOne(
      `UPDATE datasets 
       SET sync_schedule = COALESCE($1, sync_schedule),
           is_active = COALESCE($2, is_active),
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING id, name, sync_schedule, is_active`,
      [syncSchedule, isActive, id, req.user!.tenantId]
    );
    
    if (!result) {
      throw new NotFoundError('Dataset');
    }
    
    logger.info('Schedule updated', { datasetId: id, user: req.user?.email });
    
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
