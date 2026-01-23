/**
 * Datasets Routes
 * Direct ClickHouse queries on datasets
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, clickhouse, cache, authenticate, tenantIsolation, createLogger, NotFoundError, ValidationError, sanitizeLimit } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'analytics-service' });

/**
 * GET /datasets/:datasetId/query
 * Query dataset directly (for widgets)
 */
router.get('/:datasetId/query', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    const { 
      columns = '*',
      where,
      groupBy,
      orderBy,
      limit = 1000,
      offset = 0
    } = req.query;

    // Get dataset with RLS columns
    const dataset = await db.queryOne(
      'SELECT clickhouse_table, store_column, region_column, group_column FROM datasets WHERE id = $1 AND tenant_id = $2',
      [datasetId, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    const tableName = dataset.clickhouse_table;
    
    // Get RLS info
    const userFilterLevel = (req.user as any).filterLevel || 'none';
    const userFilterValue = (req.user as any).filterValue || null;
    const cacheKey = `dataset:${datasetId}:${userFilterLevel}:${userFilterValue}:${JSON.stringify(req.query)}`;

    // Cache check
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Build query
    let sql = `SELECT ${columns} FROM ${tableName}`;
    
    // Build RLS condition
    let rlsCondition: string | null = null;
    if (userFilterLevel !== 'none' && userFilterValue) {
      let rlsColumn: string | null = null;
      switch (userFilterLevel) {
        case 'store': rlsColumn = dataset.store_column; break;
        case 'region': rlsColumn = dataset.region_column; break;
        case 'group': rlsColumn = dataset.group_column; break;
      }
      if (rlsColumn) {
        rlsCondition = `${rlsColumn} = '${userFilterValue.replace(/'/g, "''")}'`;
      }
    }
    
    // Combine WHERE conditions
    const whereConditions: string[] = [];
    if (rlsCondition) whereConditions.push(rlsCondition);
    if (where) whereConditions.push(String(where));
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (groupBy) {
      sql += ` GROUP BY ${groupBy}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    sql += ` LIMIT ${Math.min(Number(limit), 10000)} OFFSET ${Number(offset)}`;

    const startTime = Date.now();
    const data = await clickhouse.query(sql);
    const executionTime = Date.now() - startTime;

    const result = {
      rows: data,
      rowCount: data.length,
      executionTime
    };

    // Cache (2 minutes)
    await cache.set(cacheKey, result, 120);

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /datasets/:datasetId/aggregate
 * Aggregate query (for KPI cards)
 */
router.post('/:datasetId/aggregate', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    const { 
      column,
      aggregation = 'sum',
      where,
      groupBy
    } = req.body;

    if (!column && aggregation !== 'count') {
      throw new ValidationError('column gerekli');
    }

    // Get dataset with RLS columns
    const dataset = await db.queryOne(
      'SELECT clickhouse_table, store_column, region_column, group_column FROM datasets WHERE id = $1 AND tenant_id = $2',
      [datasetId, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    const tableName = dataset.clickhouse_table;
    
    // Get RLS info
    const userFilterLevel = (req.user as any).filterLevel || 'none';
    const userFilterValue = (req.user as any).filterValue || null;
    const cacheKey = `dataset:agg:${datasetId}:${userFilterLevel}:${userFilterValue}:${aggregation}:${column}:${JSON.stringify({ where, groupBy })}`;

    // Cache check
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Build RLS condition
    let rlsCondition: string | null = null;
    if (userFilterLevel !== 'none' && userFilterValue) {
      let rlsColumn: string | null = null;
      switch (userFilterLevel) {
        case 'store': rlsColumn = dataset.store_column; break;
        case 'region': rlsColumn = dataset.region_column; break;
        case 'group': rlsColumn = dataset.group_column; break;
      }
      if (rlsColumn) {
        rlsCondition = `${rlsColumn} = '${userFilterValue.replace(/'/g, "''")}'`;
      }
    }

    // Build aggregation function
    let aggFunc: string;
    switch (aggregation) {
      case 'sum': aggFunc = `sum(${column})`; break;
      case 'avg': aggFunc = `avg(${column})`; break;
      case 'count': aggFunc = 'count()'; break;
      case 'min': aggFunc = `min(${column})`; break;
      case 'max': aggFunc = `max(${column})`; break;
      case 'uniq': aggFunc = `uniq(${column})`; break;
      default: aggFunc = `sum(${column})`;
    }

    let sql = `SELECT ${aggFunc} as value`;

    if (groupBy) {
      sql = `SELECT ${groupBy}, ${aggFunc} as value`;
    }
    
    sql += ` FROM ${tableName}`;
    
    // Combine WHERE conditions
    const whereConditions: string[] = [];
    if (rlsCondition) whereConditions.push(rlsCondition);
    if (where) whereConditions.push(String(where));
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (groupBy) {
      sql += ` GROUP BY ${groupBy} ORDER BY value DESC LIMIT 100`;
    }

    const startTime = Date.now();
    const data = await clickhouse.query(sql);
    const executionTime = Date.now() - startTime;

    const result = {
      value: groupBy ? undefined : data[0]?.value,
      rows: groupBy ? data : undefined,
      executionTime
    };

    // Cache (5 minutes)
    await cache.set(cacheKey, result, 300);

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    next(error);
  }
});

export default router;
