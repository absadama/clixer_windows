/**
 * Health Check Routes
 */

import { Router, Request, Response } from 'express';
import { db } from '@clixer/shared';

const router = Router();

/**
 * GET /health
 * Service health check endpoint
 */
router.get('/', async (req: Request, res: Response) => {
  const dbHealthy = await db.checkHealth();
  res.json({
    service: 'core-service',
    status: dbHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString()
  });
});

export default router;
