/**
 * ClickHouse Routes
 * ClickHouse table management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { clickhouse, authenticate, authorize, ROLES, createLogger, NotFoundError, ValidationError, sanitizeTableName } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'data-service' });

/**
 * GET /clickhouse/tables
 * List all ClickHouse tables
 */
router.get('/tables', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await clickhouse.query<{ name: string; engine: string; total_rows: number; total_bytes: number }>(
      `SELECT name, engine, total_rows, total_bytes
       FROM system.tables
       WHERE database = 'clixer_analytics'
       ORDER BY name`
    );
    
    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /clickhouse/tables/:name
 * Get table details
 */
router.get('/tables/:name', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.name);
    
    const tableInfo = await clickhouse.query(
      `SELECT name, engine, total_rows, total_bytes, 
              create_table_query, partition_key, sorting_key
       FROM system.tables
       WHERE database = 'clixer_analytics' AND name = '${tableName}'`
    );
    
    if (tableInfo.length === 0) {
      throw new NotFoundError('Tablo');
    }
    
    res.json({ success: true, data: tableInfo[0] });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /clickhouse/tables/:name
 * Drop a table
 */
router.delete('/tables/:name', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.name);
    
    await clickhouse.execute(`DROP TABLE IF EXISTS clixer_analytics.${tableName}`);
    
    logger.info('ClickHouse table dropped', { tableName, user: req.user?.email });
    
    res.json({ success: true, message: 'Tablo silindi' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clickhouse/tables/:name/truncate
 * Truncate a table
 */
router.post('/tables/:name/truncate', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.name);
    
    await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${tableName}`);
    
    logger.info('ClickHouse table truncated', { tableName, user: req.user?.email });
    
    res.json({ success: true, message: 'Tablo temizlendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /clickhouse/tables/:name/optimize
 * Optimize a table
 */
router.post('/tables/:name/optimize', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.name);
    
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${tableName} FINAL`);
    
    logger.info('ClickHouse table optimized', { tableName, user: req.user?.email });
    
    res.json({ success: true, message: 'Tablo optimize edildi' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /clickhouse/tables/:table/columns
 * Get table columns
 */
router.get('/tables/:table/columns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.table);
    
    const columns = await clickhouse.query(
      `SELECT name, type, default_expression, comment
       FROM system.columns
       WHERE database = 'clixer_analytics' AND table = '${tableName}'
       ORDER BY position`
    );
    
    res.json({ success: true, data: columns });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /clickhouse/tables/:table/partitions
 * Get table partitions
 */
router.get('/tables/:table/partitions', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.table);
    
    const partitions = await clickhouse.query(
      `SELECT partition, name, rows, bytes_on_disk, modification_time
       FROM system.parts
       WHERE database = 'clixer_analytics' AND table = '${tableName}' AND active = 1
       ORDER BY partition`
    );
    
    res.json({ success: true, data: partitions });
  } catch (error) {
    next(error);
  }
});

// NOTE: Complex endpoints (preview-delete, rows delete, delete-partition)
// remain in index.ts due to complex query building

export default router;
