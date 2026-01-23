/**
 * Health Check Routes
 * Enterprise-grade health checks with dependency monitoring
 */

import { Router, Request, Response } from 'express';
import { db, cache } from '@clixer/shared';

const router = Router();

interface DependencyHealth {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  error?: string;
}

interface HealthResponse {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  dependencies: {
    postgres: DependencyHealth;
    redis: DependencyHealth;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

const startTime = Date.now();

/**
 * Check individual dependency health with latency
 */
async function checkDependency(
  name: string,
  checkFn: () => Promise<boolean>
): Promise<DependencyHealth> {
  const start = Date.now();
  try {
    const healthy = await checkFn();
    return {
      status: healthy ? 'healthy' : 'unhealthy',
      latency: Date.now() - start
    };
  } catch (error: any) {
    return {
      status: 'unhealthy',
      latency: Date.now() - start,
      error: error.message
    };
  }
}

/**
 * GET /health
 * Basic health check - for load balancers
 */
router.get('/', async (req: Request, res: Response) => {
  const [postgres, redis] = await Promise.all([
    checkDependency('postgres', db.checkHealth),
    checkDependency('redis', cache.checkHealth)
  ]);

  const allHealthy = postgres.status === 'healthy' && redis.status === 'healthy';
  const anyHealthy = postgres.status === 'healthy' || redis.status === 'healthy';
  
  const status = allHealthy ? 'healthy' : anyHealthy ? 'degraded' : 'unhealthy';
  const statusCode = allHealthy ? 200 : anyHealthy ? 200 : 503;

  const memUsage = process.memoryUsage();
  
  const response: HealthResponse = {
    service: 'core-service',
    status,
    version: process.env.npm_package_version || '4.33.0',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres,
      redis
    },
    memory: {
      used: Math.round(memUsage.heapUsed / 1024 / 1024),
      total: Math.round(memUsage.heapTotal / 1024 / 1024),
      percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    }
  };

  res.status(statusCode).json(response);
});

/**
 * GET /health/live
 * Liveness probe - is the process running?
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

/**
 * GET /health/ready
 * Readiness probe - can the service handle requests?
 */
router.get('/ready', async (req: Request, res: Response) => {
  const [postgresOk, redisOk] = await Promise.all([
    db.checkHealth(),
    cache.checkHealth()
  ]);

  if (postgresOk && redisOk) {
    res.json({ status: 'ready', timestamp: new Date().toISOString() });
  } else {
    res.status(503).json({
      status: 'not_ready',
      postgres: postgresOk,
      redis: redisOk,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
