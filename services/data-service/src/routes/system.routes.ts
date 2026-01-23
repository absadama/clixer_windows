/**
 * System Routes
 * System locks, stuck jobs, health monitoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, cache, authenticate, authorize, ROLES, createLogger, NotFoundError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /system/locks
 * List active dataset locks
 */
router.get('/locks', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const locks = await db.queryAll(
      `SELECT d.id as dataset_id, d.name as dataset_name, 
              j.id as job_id, j.status, j.started_at
       FROM datasets d
       INNER JOIN etl_jobs j ON d.id = j.dataset_id AND j.status = 'running'
       ORDER BY j.started_at`
    );
    
    res.json({ success: true, data: locks });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /system/locks/:datasetId
 * Force release a dataset lock
 */
router.delete('/locks/:datasetId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    
    const result = await db.query(
      `UPDATE etl_jobs SET status = 'cancelled', completed_at = NOW(), error_message = 'Kilit manuel olarak kaldırıldı'
       WHERE dataset_id = $1 AND status = 'running'`,
      [datasetId]
    );
    
    logger.info('Dataset lock released', { datasetId, user: req.user?.email });
    
    res.json({ success: true, message: 'Kilit kaldırıldı', affectedJobs: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /system/locks
 * Release all locks
 */
router.delete('/locks', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(
      `UPDATE etl_jobs SET status = 'cancelled', completed_at = NOW(), error_message = 'Tüm kilitler manuel olarak kaldırıldı'
       WHERE status = 'running'`
    );
    
    logger.info('All locks released', { user: req.user?.email, count: result.rowCount });
    
    res.json({ success: true, message: 'Tüm kilitler kaldırıldı', affectedJobs: result.rowCount });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/stuck-jobs
 * List stuck jobs (running for more than 1 hour)
 */
router.get('/stuck-jobs', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stuckJobs = await db.queryAll(
      `SELECT j.*, d.name as dataset_name,
              EXTRACT(EPOCH FROM (NOW() - j.started_at))/60 as running_minutes
       FROM etl_jobs j
       LEFT JOIN datasets d ON j.dataset_id = d.id
       WHERE j.status = 'running' AND j.started_at < NOW() - INTERVAL '1 hour'
       ORDER BY j.started_at`
    );
    
    res.json({ success: true, data: stuckJobs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/running-jobs
 * List all running jobs
 */
router.get('/running-jobs', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runningJobs = await db.queryAll(
      `SELECT j.*, d.name as dataset_name,
              EXTRACT(EPOCH FROM (NOW() - j.started_at))/60 as running_minutes
       FROM etl_jobs j
       LEFT JOIN datasets d ON j.dataset_id = d.id
       WHERE j.status = 'running'
       ORDER BY j.started_at`
    );
    
    res.json({ success: true, data: runningJobs });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /system/jobs/:id/cancel
 * Cancel a specific job
 */
router.post('/jobs/:id/cancel', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `UPDATE etl_jobs SET status = 'cancelled', completed_at = NOW(), error_message = 'Admin tarafından iptal edildi'
       WHERE id = $1 AND status IN ('running', 'pending')`,
      [id]
    );
    
    if (result.rowCount === 0) {
      throw new NotFoundError('Job veya job zaten tamamlanmış');
    }
    
    // Notify ETL worker
    await cache.publish('etl:job:cancel', JSON.stringify({ jobId: id }));
    
    logger.info('Job cancelled by admin', { jobId: id, user: req.user?.email });
    
    res.json({ success: true, message: 'Job iptal edildi' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/etl-health
 * Get ETL system health
 */
router.get('/etl-health', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await db.queryOne(`
      SELECT 
        (SELECT COUNT(*) FROM etl_jobs WHERE status = 'running') as running_jobs,
        (SELECT COUNT(*) FROM etl_jobs WHERE status = 'pending') as pending_jobs,
        (SELECT COUNT(*) FROM etl_jobs WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours') as completed_today,
        (SELECT COUNT(*) FROM etl_jobs WHERE status = 'failed' AND completed_at > NOW() - INTERVAL '24 hours') as failed_today,
        (SELECT COUNT(*) FROM etl_jobs WHERE status = 'running' AND started_at < NOW() - INTERVAL '1 hour') as stuck_jobs
    `);
    
    const workerStatus = await cache.get('etl:worker:status');
    
    res.json({
      success: true,
      data: {
        ...stats,
        workerStatus: workerStatus ? JSON.parse(workerStatus) : null
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /system/jobs/:id/progress
 * Get job progress
 */
router.get('/jobs/:id/progress', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const job = await db.queryOne(
      `SELECT id, status, progress, rows_processed, rows_inserted, started_at, completed_at, error_message
       FROM etl_jobs WHERE id = $1`,
      [id]
    );
    
    if (!job) {
      throw new NotFoundError('Job');
    }
    
    res.json({ success: true, data: job });
  } catch (error) {
    next(error);
  }
});

export default router;
