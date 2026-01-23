/**
 * Metrics Routes
 * Metric CRUD and execution endpoints
 * 
 * NOTE: This file contains the route definitions.
 * Complex business logic (executeMetric, etc.) remains in the main index.ts
 * for now due to heavy interdependencies.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, clickhouse, cache, authenticate, tenantIsolation, createLogger, NotFoundError, ValidationError } from '@clixer/shared';
import { AGGREGATION_TYPES, VISUALIZATION_TYPES } from '../types';

const router = Router();
const logger = createLogger({ service: 'analytics-service' });

/**
 * GET /metric-types
 * Get available aggregation and visualization types
 */
router.get('/types', authenticate, async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    data: { 
      aggregationTypes: AGGREGATION_TYPES,
      visualizationTypes: VISUALIZATION_TYPES
    } 
  });
});

/**
 * GET /metrics
 * List all metrics
 */
router.get('/', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId, isActive } = req.query;

    let sql = `
      SELECT m.*, d.name as dataset_name, d.clickhouse_table
      FROM metrics m
      LEFT JOIN datasets d ON m.dataset_id = d.id
      WHERE m.tenant_id = $1
    `;
    const params: any[] = [req.user!.tenantId];

    if (datasetId) {
      sql += ` AND m.dataset_id = $${params.length + 1}`;
      params.push(datasetId);
    }

    if (isActive !== undefined) {
      sql += ` AND m.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    sql += ' ORDER BY m.created_at DESC';

    const metrics = await db.queryAll(sql, params);

    // camelCase transformation
    const formatted = metrics.map(m => ({
      id: m.id,
      tenantId: m.tenant_id,
      name: m.name,
      label: m.label,
      description: m.description,
      icon: m.icon,
      color: m.color,
      datasetId: m.dataset_id,
      datasetName: m.dataset_name,
      clickhouseTable: m.clickhouse_table,
      dbColumn: m.db_column,
      aggregationType: m.aggregation_type,
      filterSql: m.filter_sql,
      groupByColumn: m.group_by_column,
      orderByColumn: m.order_by_column,
      orderDirection: m.order_direction,
      visualizationType: m.visualization_type,
      chartConfig: m.chart_config,
      formatConfig: m.format_config,
      comparisonEnabled: m.comparison_enabled,
      comparisonType: m.comparison_type,
      comparisonConfig: m.comparison_config,
      targetValue: m.target_value,
      defaultWidth: m.default_width,
      defaultHeight: m.default_height,
      isActive: m.is_active,
      cacheTtl: m.cache_ttl,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /metrics/:metricId
 * Get metric details
 */
router.get('/:metricId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;

    const metric = await db.queryOne(
      `SELECT m.*, d.name as dataset_name, d.clickhouse_table
       FROM metrics m
       LEFT JOIN datasets d ON m.dataset_id = d.id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [metricId, req.user!.tenantId]
    );

    if (!metric) {
      throw new NotFoundError('Metrik');
    }

    res.json({ success: true, data: metric });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /metrics/:metricId/duplicate
 * Duplicate a metric
 */
router.post('/:metricId/duplicate', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;
    const { newName } = req.body;

    const original = await db.queryOne(
      'SELECT * FROM metrics WHERE id = $1 AND tenant_id = $2',
      [metricId, req.user!.tenantId]
    );

    if (!original) {
      throw new NotFoundError('Metrik');
    }

    const duplicateName = newName || `${original.name} (Kopya)`;

    const newMetric = await db.queryOne(
      `INSERT INTO metrics (
        tenant_id, name, label, description, dataset_id, clickhouse_table,
        aggregation_type, db_column, group_by_column, filter_sql,
        visualization_type, chart_config, comparison_enabled, comparison_type,
        target_value, use_sql_mode, custom_sql, icon, color
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        req.user!.tenantId,
        duplicateName,
        duplicateName,
        original.description,
        original.dataset_id,
        original.clickhouse_table,
        original.aggregation_type,
        original.db_column,
        original.group_by_column,
        original.filter_sql,
        original.visualization_type,
        original.chart_config,
        original.comparison_enabled,
        original.comparison_type,
        original.target_value,
        original.use_sql_mode,
        original.custom_sql,
        original.icon,
        original.color
      ]
    );

    res.json({
      success: true,
      data: newMetric,
      message: `Metrik "${duplicateName}" olarak kopyalandı`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /metrics/:metricId
 * Delete a metric
 */
router.delete('/:metricId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;

    const result = await db.query(
      'DELETE FROM metrics WHERE id = $1 AND tenant_id = $2',
      [metricId, req.user!.tenantId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Metrik');
    }

    // Clear metric cache
    try {
      await cache.del(`metric:${metricId}:default`);
      logger.info('Metric cache cleared on delete', { metricId });
    } catch (cacheError) {
      logger.warn('Failed to clear metric cache on delete', { metricId, error: cacheError });
    }

    logger.info('Metric deleted', { metricId, user: req.user!.userId });

    res.json({ success: true, message: 'Metrik silindi' });
  } catch (error) {
    next(error);
  }
});

// NOTE: The following endpoints are complex and require the executeMetric function
// which has heavy dependencies. They will be migrated in a future refactor:
// - POST /metrics (create)
// - PUT /metrics/:metricId (update)
// - GET/POST /metrics/:metricId/execute
// - POST /metrics/:metricId/drill-down
// - POST /metrics/batch

export default router;
