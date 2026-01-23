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
  const chHealthy = await clickhouse.checkHealth();
  const cacheHealthy = await cache.checkHealth();
  const dbHealthy = await db.checkHealth();
  
  res.json({
    service: 'analytics-service',
    status: chHealthy && cacheHealthy && dbHealthy ? 'healthy' : 'degraded',
    checks: {
      clickhouse: chHealthy ? 'ok' : 'error',
      cache: cacheHealthy ? 'ok' : 'error',
      database: dbHealthy ? 'ok' : 'error'
    },
    timestamp: new Date().toISOString()
  });
});

export default router;
