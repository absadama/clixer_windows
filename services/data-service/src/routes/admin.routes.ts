/**
 * Admin Routes
 * System administration, reconnection, backup
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, clickhouse, cache, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * POST /admin/redis/reconnect
 * Reconnect to Redis
 */
router.post('/redis/reconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await cache.createRedisClient();
    const healthy = await cache.checkHealth();
    
    logger.info('Redis reconnected', { user: req.user?.email, healthy });
    
    res.json({ 
      success: healthy, 
      message: healthy ? 'Redis bağlantısı yenilendi' : 'Redis bağlantısı başarısız' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/postgres/reconnect
 * Reconnect to PostgreSQL
 */
router.post('/postgres/reconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.closePool();
    db.createPool();
    const healthy = await db.checkHealth();
    
    logger.info('PostgreSQL reconnected', { user: req.user?.email, healthy });
    
    res.json({ 
      success: healthy, 
      message: healthy ? 'PostgreSQL bağlantısı yenilendi' : 'PostgreSQL bağlantısı başarısız' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /admin/clickhouse/reconnect
 * Reconnect to ClickHouse
 */
router.post('/clickhouse/reconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    clickhouse.createClickHouseClient();
    const healthy = await clickhouse.checkHealth();
    
    logger.info('ClickHouse reconnected', { user: req.user?.email, healthy });
    
    res.json({ 
      success: healthy, 
      message: healthy ? 'ClickHouse bağlantısı yenilendi' : 'ClickHouse bağlantısı başarısız' 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/system/status
 * Get system status
 */
router.get('/system/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [pgHealth, chHealth, redisHealth] = await Promise.all([
      db.checkHealth(),
      clickhouse.checkHealth(),
      cache.checkHealth()
    ]);
    
    res.json({
      success: true,
      data: {
        postgres: pgHealth ? 'ok' : 'error',
        clickhouse: chHealth ? 'ok' : 'error',
        redis: redisHealth ? 'ok' : 'error',
        overall: pgHealth && chHealth && redisHealth ? 'healthy' : 'degraded'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/services
 * Get all services status
 */
router.get('/services', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = [
      { name: 'gateway', port: 3000 },
      { name: 'auth-service', port: 4001 },
      { name: 'core-service', port: 4002 },
      { name: 'data-service', port: 4003 },
      { name: 'notification-service', port: 4004 },
      { name: 'analytics-service', port: 4005 }
    ];
    
    const results = await Promise.all(
      services.map(async (service) => {
        try {
          const response = await fetch(`http://localhost:${service.port}/health`, { 
            signal: AbortSignal.timeout(3000) 
          });
          return { ...service, status: response.ok ? 'running' : 'error' };
        } catch {
          return { ...service, status: 'stopped' };
        }
      })
    );
    
    res.json({ success: true, data: results });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /admin/sessions
 * Get active sessions
 */
router.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get session count from Redis pattern
    const sessionKeys = await cache.get('session:count') || '0';
    
    res.json({ 
      success: true, 
      data: { 
        activeSessions: parseInt(sessionKeys),
        message: 'Session bilgileri Redis\'ten alındı'
      } 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /admin/sessions/:userId
 * Terminate user sessions
 */
router.delete('/sessions/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    await cache.del(`refresh:${userId}`);
    await cache.invalidate(`session:${userId}:*`, 'admin');
    
    logger.info('User sessions terminated', { targetUserId: userId, user: req.user?.email });
    
    res.json({ success: true, message: 'Kullanıcı oturumları sonlandırıldı' });
  } catch (error) {
    next(error);
  }
});

// NOTE: Complex endpoints (system/stats, system/restart, backup/list, backup/create)
// remain in index.ts due to heavy system dependencies

export default router;
