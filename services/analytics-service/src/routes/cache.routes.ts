/**
 * Cache Routes
 * Cache management endpoints
 */

import { Router, Request, Response, NextFunction } from 'express';
import { cache, authenticate, tenantIsolation, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'analytics-service' });

/**
 * DELETE /cache
 * Clear all cache (admin only)
 */
router.delete('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pattern } = req.query;
    
    if (pattern) {
      await cache.invalidate(String(pattern), 'manual');
      logger.info('Cache invalidated by pattern', { user: req.user?.email, pattern });
    } else {
      await cache.invalidate('*', 'manual');
      logger.info('All cache cleared', { user: req.user?.email });
    }
    
    res.json({ success: true, message: 'Cache temizlendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /datasets/:datasetId/cache
 * Clear cache for a specific dataset
 */
router.delete('/datasets/:datasetId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    
    await cache.invalidate(`dataset:${datasetId}:*`, 'manual');
    await cache.invalidate(`dashboard:*`, 'manual');
    
    logger.info('Dataset cache cleared', { user: req.user?.email, datasetId });
    
    res.json({ success: true, message: 'Dataset cache temizlendi' });
  } catch (error) {
    next(error);
  }
});

export default router;
