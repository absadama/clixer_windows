/**
 * Health Check Routes
 */

import { Router, Request, Response } from 'express';
import { db, clickhouse, cache } from '@clixer/shared';

const router = Router();

/**
 * GET /health
 * Service health check
 */
router.get('/', async (req: Request, res: Response) => {
  const dbHealthy = await db.checkHealth();
  const chHealthy = await clickhouse.checkHealth();
  const cacheHealthy = await cache.checkHealth();
  
  res.json({
    service: 'data-service',
    status: dbHealthy && chHealthy && cacheHealthy ? 'healthy' : 'degraded',
    checks: {
      database: dbHealthy ? 'ok' : 'error',
      clickhouse: chHealthy ? 'ok' : 'error',
      cache: cacheHealthy ? 'ok' : 'error'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
