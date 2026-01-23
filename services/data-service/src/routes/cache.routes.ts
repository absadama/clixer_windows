/**
 * Cache Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { cache, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * POST /cache/clear
 * Clear cache (admin only)
 */
router.post('/clear', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pattern } = req.body;
    
    if (pattern) {
      await cache.invalidate(pattern, 'manual');
      logger.info('Cache cleared by pattern', { pattern, user: req.user?.email });
    } else {
      await cache.invalidate('*', 'manual');
      logger.info('All cache cleared', { user: req.user?.email });
    }
    
    res.json({ success: true, message: 'Cache temizlendi' });
  } catch (error) {
    next(error);
  }
});

export default router;
