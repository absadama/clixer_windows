/**
 * Analytics Service Routes Index
 * Aggregates all route modules
 * 
 * NOTE: Due to complex interdependencies in the original monolithic file,
 * some endpoints remain in the main index.ts. This is a partial refactor
 * that establishes the modular structure. Future refactoring can migrate
 * the remaining endpoints as dependencies are resolved.
 */

import { Router } from 'express';

// Import route modules
import healthRoutes from './health.routes';
import metricsRoutes from './metrics.routes';
import datasetsRoutes from './datasets.routes';
import designsRoutes from './designs.routes';
import dashboardRoutes from './dashboard.routes';
import clickhouseRoutes from './clickhouse.routes';
import cacheRoutes from './cache.routes';

const router = Router();

// Health check
router.use('/health', healthRoutes);

// Metrics - partial (CRUD operations)
router.use('/metrics', metricsRoutes);
router.use('/metric-types', (req, res, next) => {
  // Redirect to metrics/types
  req.url = '/types';
  metricsRoutes(req, res, next);
});

// Datasets
router.use('/datasets', datasetsRoutes);

// Designs - partial
router.use('/designs', designsRoutes);

// Dashboard
router.use('/dashboard', dashboardRoutes);

// ClickHouse direct access
router.use('/clickhouse', clickhouseRoutes);

// Cache management
router.use('/cache', cacheRoutes);

export default router;
