/**
 * Performance Routes
 * Database and system performance metrics
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, clickhouse, cache, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /performance/redis
 * Get Redis performance metrics
 */
router.get('/redis', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await cache.get('redis:info');
    
    // Basic Redis metrics
    res.json({
      success: true,
      data: {
        status: 'connected',
        info: info ? JSON.parse(info) : null,
        message: 'Redis performans bilgileri'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /performance/etl
 * Get ETL performance metrics
 */
router.get('/etl', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.queryOne(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_today,
        COUNT(*) FILTER (WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_today,
        AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as avg_duration_seconds,
        SUM(rows_processed) FILTER (WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as total_rows_today
      FROM etl_jobs
    `);
    
    res.json({
      success: true,
      data: {
        completedToday: parseInt(stats?.completed_today || '0'),
        failedToday: parseInt(stats?.failed_today || '0'),
        avgDurationSeconds: parseFloat(stats?.avg_duration_seconds || '0'),
        totalRowsToday: parseInt(stats?.total_rows_today || '0'),
        successRate: stats?.completed_today > 0 
          ? (stats.completed_today / (stats.completed_today + stats.failed_today) * 100).toFixed(1) 
          : 0
      }
    });
  } catch (error) {
    next(error);
  }
});

// NOTE: Complex endpoints (postgres, clickhouse, connections/:id performance)
// remain in index.ts due to heavy query complexity

export default router;
