/**
 * System Routes - Health & Monitoring
 * Redis locks, job management, ETL health
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, cache, authenticate, authorize, ROLES, createLogger, NotFoundError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

// ============================================
// REDIS LOCK MANAGEMENT
// ============================================

/**
 * GET /system/locks
 * Get all Redis locks
 */
router.get('/locks', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = cache.getClient();
    const lockKeys = await client.keys('clixer:etl:lock:*');
    
    const locks = await Promise.all(lockKeys.map(async (key: string) => {
      const value = await client.get(key);
      const ttl = await client.ttl(key);
      let lockInfo = null;
      try {
        lockInfo = value ? JSON.parse(value) : null;
      } catch {}
      return {
        key: key.replace('clixer:', ''),
        datasetId: key.split(':').pop(),
        pid: lockInfo?.pid,
        startedAt: lockInfo?.startedAt,
        ttlSeconds: ttl
      };
    }));
    
    res.json({ success: true, data: locks });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /system/locks/:datasetId
 * Delete specific lock
 */
router.delete('/locks/:datasetId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    const client = cache.getClient();
    const deleted = await client.del(`etl:lock:${datasetId}`);
    
    logger.info('Lock deleted by admin', { datasetId, userId: req.user!.userId });
    res.json({ success: true, deleted });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /system/locks
 * Delete all locks
 */
router.delete('/locks', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = cache.getClient();
    const lockKeys = await client.keys('clixer:etl:lock:*');
    
    let deleted = 0;
    for (const key of lockKeys) {
      await client.del(key.replace('clixer:', ''));
      deleted++;
    }
    
    logger.info('All locks deleted by admin', { count: deleted, userId: req.user!.userId });
    res.json({ success: true, deleted });
  } catch (error) {
    next(error);
  }
});

// ============================================
// JOB MONITORING
// ============================================

/**
 * GET /system/stuck-jobs
 * Get stuck jobs (running > 10 minutes)
 */
router.get('/stuck-jobs', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stuckJobs = await db.queryAll(`
      SELECT 
        e.id,
        e.dataset_id,
        d.name as dataset_name,
        e.status,
        e.started_at,
        e.rows_processed,
        EXTRACT(EPOCH FROM (NOW() - e.started_at))::int as running_seconds
      FROM etl_jobs e
      JOIN datasets d ON e.dataset_id = d.id
      WHERE e.status = 'running' 
        AND e.started_at < NOW() - INTERVAL '10 minutes'
      ORDER BY e.started_at ASC
    `);
    
    res.json({ 
      success: true, 
      data: stuckJobs.map((job: any) => ({
        ...job,
        runningMinutes: Math.floor(job.running_seconds / 60)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/running-jobs
 * Get all running jobs
 */
router.get('/running-jobs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runningJobs = await db.queryAll(`
      SELECT 
        e.id,
        e.dataset_id,
        d.name as dataset_name,
        e.status,
        e.started_at,
        e.rows_processed,
        EXTRACT(EPOCH FROM (NOW() - e.started_at))::int as running_seconds
      FROM etl_jobs e
      JOIN datasets d ON e.dataset_id = d.id
      WHERE e.status IN ('running', 'pending')
      ORDER BY e.started_at DESC
      LIMIT 20
    `);
    
    res.json({ 
      success: true, 
      data: runningJobs.map((job: any) => ({
        ...job,
        runningMinutes: Math.floor((job.running_seconds || 0) / 60)
      }))
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /system/jobs/:id/cancel
 * Cancel a job
 */
router.post('/jobs/:id/cancel', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE etl_jobs 
       SET status = 'cancelled', 
           completed_at = NOW(),
           error_message = 'Admin tarafından iptal edildi'
       WHERE id = $1 AND status IN ('running', 'pending')
       RETURNING id, dataset_id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      throw new NotFoundError('İptal edilebilir job');
    }
    
    // Clear related lock
    const datasetId = result.rows[0].dataset_id;
    const client = cache.getClient();
    await client.del(`etl:lock:${datasetId}`);
    
    logger.info('Job cancelled by admin', { jobId: id, datasetId, userId: req.user!.userId });
    res.json({ success: true, message: 'Job iptal edildi' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/etl-health
 * Get ETL Worker detailed status
 */
router.get('/etl-health', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = cache.getClient();
    
    // Worker status from Redis
    const workerStatus = await client.get('etl:worker:status');
    const workerHeartbeat = await client.get('etl:worker:heartbeat');
    const activeJobs = await client.get('etl:worker:active_jobs');
    
    // Lock count
    const lockKeys = await client.keys('clixer:etl:lock:*');
    
    // Running/Pending/Stuck jobs from DB
    const jobStats = await db.queryOne(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'running') as running_jobs,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_jobs,
        COUNT(*) FILTER (WHERE status = 'running' AND started_at < NOW() - INTERVAL '10 minutes') as stuck_jobs,
        MAX(completed_at) FILTER (WHERE status = 'completed') as last_completed_at
      FROM etl_jobs
    `);
    
    // Parse worker info
    let workerInfo = null;
    try {
      workerInfo = workerStatus ? JSON.parse(workerStatus) : null;
    } catch {}
    
    const heartbeatTime = workerHeartbeat ? new Date(workerHeartbeat).getTime() : 0;
    const isWorkerAlive = heartbeatTime > Date.now() - 30000;
    
    res.json({
      success: true,
      data: {
        worker: {
          isAlive: isWorkerAlive,
          lastHeartbeat: workerHeartbeat,
          pid: workerInfo?.pid,
          startedAt: workerInfo?.startedAt,
          activeJobCount: activeJobs ? parseInt(activeJobs) : 0
        },
        locks: {
          count: lockKeys.length,
          keys: lockKeys.map(k => k.replace('clixer:', ''))
        },
        jobs: {
          running: parseInt(jobStats?.running_jobs || '0'),
          pending: parseInt(jobStats?.pending_jobs || '0'),
          stuck: parseInt(jobStats?.stuck_jobs || '0'),
          lastCompletedAt: jobStats?.last_completed_at
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/jobs/:id/progress
 * Get specific job progress with details
 */
router.get('/jobs/:id/progress', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const job = await db.queryOne(`
      SELECT 
        e.id,
        e.dataset_id,
        d.name as dataset_name,
        e.status,
        e.action,
        e.started_at,
        e.completed_at,
        e.rows_processed,
        e.rows_inserted,
        e.rows_updated,
        e.rows_deleted,
        e.error_message,
        e.error_details,
        e.retry_count,
        EXTRACT(EPOCH FROM (COALESCE(e.completed_at, NOW()) - e.started_at))::int as duration_seconds,
        d.row_limit,
        d.source_table,
        d.clickhouse_table
      FROM etl_jobs e
      JOIN datasets d ON e.dataset_id = d.id
      WHERE e.id = $1
    `, [id]);
    
    if (!job) {
      throw new NotFoundError('Job');
    }
    
    // Calculate progress if row_limit exists
    let progress = null;
    let estimatedRemaining = null;
    
    if (job.row_limit && job.rows_processed > 0 && job.status === 'running') {
      progress = Math.min(99, Math.round((job.rows_processed / job.row_limit) * 100));
      
      // Estimated remaining time
      const rate = job.rows_processed / job.duration_seconds;
      const remaining = job.row_limit - job.rows_processed;
      estimatedRemaining = Math.round(remaining / rate);
    }
    
    res.json({
      success: true,
      data: {
        ...job,
        progress,
        estimatedRemainingSeconds: estimatedRemaining,
        durationMinutes: Math.floor(job.duration_seconds / 60),
        durationSeconds: job.duration_seconds % 60
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
