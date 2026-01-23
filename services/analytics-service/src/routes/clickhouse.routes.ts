/**
 * ClickHouse Routes
 * Direct ClickHouse queries and table info
 */

import { Router, Request, Response, NextFunction } from 'express';
import { clickhouse, authenticate, createLogger, ValidationError, sanitizeTableName, containsDangerousSQLKeywords } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'analytics-service' });

/**
 * GET /clickhouse/tables
 * List all ClickHouse tables
 */
router.get('/tables', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await clickhouse.query<{ name: string; engine: string; total_rows: number }>(
      `SELECT name, engine, total_rows 
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
 * GET /clickhouse/tables/:tableName/columns
 * Get columns for a specific table
 */
router.get('/tables/:tableName/columns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tableName = sanitizeTableName(req.params.tableName);
    
    const columns = await clickhouse.query<{ name: string; type: string; default_expression: string }>(
      `SELECT name, type, default_expression 
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
 * POST /clickhouse/query
 * Execute a custom ClickHouse query (admin only)
 */
router.post('/query', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql, limit = 1000 } = req.body;
    
    if (!sql) {
      throw new ValidationError('SQL sorgusu gerekli');
    }
    
    // Security check - no dangerous keywords
    if (containsDangerousSQLKeywords(sql)) {
      throw new ValidationError('Tehlikeli SQL keyword tespit edildi');
    }
    
    // Only SELECT queries allowed
    const sqlTrimmed = sql.trim().toUpperCase();
    if (!sqlTrimmed.startsWith('SELECT') && !sqlTrimmed.startsWith('SHOW') && !sqlTrimmed.startsWith('DESCRIBE')) {
      throw new ValidationError('Sadece SELECT, SHOW ve DESCRIBE sorguları çalıştırılabilir');
    }
    
    // Add limit if not present
    let safeSql = sql;
    if (!sqlTrimmed.includes('LIMIT')) {
      safeSql = `${sql} LIMIT ${limit}`;
    }
    
    logger.info('Executing custom ClickHouse query', { user: req.user?.email, sqlLength: sql.length });
    
    const startTime = Date.now();
    const result = await clickhouse.query(safeSql);
    const executionTime = Date.now() - startTime;
    
    res.json({ 
      success: true, 
      data: result,
      metadata: {
        rowCount: result.length,
        executionTime
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
