/**
 * ETL Routes
 * ETL worker management and job control
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, cache, authenticate, authorize, tenantIsolation, ROLES, createLogger, NotFoundError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /etl/status
 * Get ETL worker status
 */
router.get('/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workerStatus = await cache.get('etl:worker:status');
    
    res.json({
      success: true,
      data: workerStatus ? JSON.parse(workerStatus) : {
        isRunning: false,
        message: 'ETL worker durumu bilinmiyor'
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /etl-jobs
 * List ETL jobs
 */
router.get('/jobs', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { limit = 50, status, datasetId } = req.query;
    
    let sql = `
      SELECT j.*, d.name as dataset_name
      FROM etl_jobs j
      LEFT JOIN datasets d ON j.dataset_id = d.id
      WHERE j.tenant_id = $1
    `;
    const params: any[] = [req.user!.tenantId];
    
    if (status) {
      sql += ` AND j.status = $${params.length + 1}`;
      params.push(status);
    }
    
    if (datasetId) {
      sql += ` AND j.dataset_id = $${params.length + 1}`;
      params.push(datasetId);
    }
    
    sql += ` ORDER BY j.created_at DESC LIMIT $${params.length + 1}`;
    params.push(Number(limit));
    
    const jobs = await db.queryAll(sql, params);
    
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /etl-jobs/running
 * List running ETL jobs
 */
router.get('/jobs/running', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await db.queryAll(
      `SELECT j.*, d.name as dataset_name
       FROM etl_jobs j
       LEFT JOIN datasets d ON j.dataset_id = d.id
       WHERE j.tenant_id = $1 AND j.status IN ('pending', 'running')
       ORDER BY j.created_at DESC`,
      [req.user!.tenantId]
    );
    
    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /etl-jobs/:jobId/kill
 * Kill a running ETL job
 */
router.post('/jobs/:jobId/kill', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    
    const job = await db.queryOne(
      'SELECT id, status FROM etl_jobs WHERE id = $1 AND tenant_id = $2',
      [jobId, req.user!.tenantId]
    );
    
    if (!job) {
      throw new NotFoundError('ETL Job');
    }
    
    if (job.status !== 'running' && job.status !== 'pending') {
      return res.json({ success: false, message: 'Job zaten tamamlanmış veya iptal edilmiş' });
    }
    
    await db.query(
      `UPDATE etl_jobs SET status = 'cancelled', completed_at = NOW(), error_message = 'Kullanıcı tarafından iptal edildi'
       WHERE id = $1`,
      [jobId]
    );
    
    // Notify ETL worker
    await cache.publish('etl:job:cancel', JSON.stringify({ jobId }));
    
    logger.info('ETL job cancelled', { jobId, user: req.user?.email });
    
    res.json({ success: true, message: 'Job iptal edildi' });
  } catch (error) {
    next(error);
  }
});

// NOTE: worker/start, worker/stop, worker/restart, trigger-all endpoints
// remain in index.ts due to process management dependencies

export default router;
