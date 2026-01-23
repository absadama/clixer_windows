/**
 * Datasets Routes
 * Dataset CRUD operations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, authenticate, authorize, tenantIsolation, ROLES, createLogger, NotFoundError, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /datasets
 * List all datasets
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const datasets = await db.queryAll(
      `SELECT d.*, c.name as connection_name, c.type as connection_type
       FROM datasets d
       LEFT JOIN data_connections c ON d.connection_id = c.id
       WHERE d.tenant_id = $1
       ORDER BY d.name`,
      [req.user!.tenantId]
    );
    
    res.json({ success: true, data: datasets });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /datasets/:id
 * Get dataset details
 */
router.get('/:id', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const dataset = await db.queryOne(
      `SELECT d.*, c.name as connection_name, c.type as connection_type
       FROM datasets d
       LEFT JOIN data_connections c ON d.connection_id = c.id
       WHERE d.id = $1 AND d.tenant_id = $2`,
      [id, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset');
    }
    
    res.json({ success: true, data: dataset });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /datasets/:id
 * Delete dataset
 */
router.delete('/:id', authenticate, authorize(ROLES.ADMIN, ROLES.MANAGER), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    // Check if dataset exists
    const dataset = await db.queryOne(
      'SELECT id, name, clickhouse_table FROM datasets WHERE id = $1 AND tenant_id = $2',
      [id, req.user!.tenantId]
    );
    
    if (!dataset) {
      throw new NotFoundError('Dataset');
    }
    
    // Delete from PostgreSQL
    await db.query('DELETE FROM datasets WHERE id = $1', [id]);
    
    logger.info('Dataset deleted', { datasetId: id, name: dataset.name, user: req.user?.email });
    
    res.json({ success: true, message: 'Dataset silindi' });
  } catch (error) {
    next(error);
  }
});

// NOTE: Complex endpoints (create, update, sync, preview, aggregates, export, compare, etc.)
// remain in index.ts due to heavy ETL and ClickHouse dependencies

export default router;
