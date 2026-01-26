/**
 * ETL Worker Management Routes
 * UI'dan ETL Worker yönetimi
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize, ROLES, audit, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'etl-worker-routes' });

/**
 * POST /etl/worker/start
 * Start ETL Worker
 */
router.post('/worker/start', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getServiceManager } = require('@clixer/shared');
    const manager = getServiceManager();
    
    logger.info('Starting ETL Worker via UI', { userId: req.user!.userId });
    
    const result = await manager.start('etl-worker');
    
    // Audit log
    await audit.log({
      userId: req.user!.userId,
      tenantId: req.user!.tenantId,
      action: 'CREATE',
      resourceType: 'etl_job',
      resourceId: 'etl-worker',
      resourceName: 'etl_worker_start',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'ETL Worker başlatıldı',
      data: result
    });
  } catch (error: any) {
    logger.error('ETL Worker start failed', { error: error.message, userId: req.user!.userId });
    res.status(500).json({
      success: false,
      message: `ETL Worker başlatılamadı: ${error.message}`
    });
  }
});

/**
 * POST /etl/worker/stop
 * Stop ETL Worker
 */
router.post('/worker/stop', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getServiceManager } = require('@clixer/shared');
    const manager = getServiceManager();
    
    logger.info('Stopping ETL Worker via UI', { userId: req.user!.userId });
    
    const result = await manager.stop('etl-worker');
    
    // Audit log
    await audit.log({
      userId: req.user!.userId,
      tenantId: req.user!.tenantId,
      action: 'DELETE',
      resourceType: 'etl_job',
      resourceId: 'etl-worker',
      resourceName: 'etl_worker_stop',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'ETL Worker durduruldu',
      data: result
    });
  } catch (error: any) {
    logger.error('ETL Worker stop failed', { error: error.message, userId: req.user!.userId });
    res.status(500).json({
      success: false,
      message: `ETL Worker durdurulamadı: ${error.message}`
    });
  }
});

/**
 * POST /etl/worker/restart
 * Restart ETL Worker
 */
router.post('/worker/restart', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getServiceManager } = require('@clixer/shared');
    const manager = getServiceManager();
    
    logger.info('Restarting ETL Worker via UI', { userId: req.user!.userId });
    
    const result = await manager.restart('etl-worker');
    
    // Audit log
    await audit.log({
      userId: req.user!.userId,
      tenantId: req.user!.tenantId,
      action: 'UPDATE',
      resourceType: 'etl_job',
      resourceId: 'etl-worker',
      resourceName: 'etl_worker_restart',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'ETL Worker yeniden başlatıldı',
      data: result
    });
  } catch (error: any) {
    logger.error('ETL Worker restart failed', { error: error.message, userId: req.user!.userId });
    res.status(500).json({
      success: false,
      message: `ETL Worker yeniden başlatılamadı: ${error.message}`
    });
  }
});

/**
 * GET /etl/worker/status
 * Get ETL Worker detailed status
 */
router.get('/worker/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getServiceManager } = require('@clixer/shared');
    const manager = getServiceManager();
    
    const status = await manager.getStatus('etl-worker');
    
    res.json({
      success: true,
      data: status
    });
  } catch (error: any) {
    logger.error('ETL Worker status check failed', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'ETL Worker durumu alınamadı',
      data: {
        id: 'etl-worker',
        name: 'ETL Worker',
        status: 'unknown',
        error: error.message
      }
    });
  }
});

export default router;
