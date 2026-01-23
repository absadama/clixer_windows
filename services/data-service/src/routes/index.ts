/**
 * Data Service Routes Index
 * Aggregates all route modules
 * 
 * NOTE: Due to complex interdependencies in the original monolithic file,
 * some endpoints remain in the main index.ts. This is a partial refactor
 * that establishes the modular structure.
 */

import { Router } from 'express';

// Import route modules
import healthRoutes from './health.routes';
import adminRoutes from './admin.routes';
import connectionsRoutes from './connections.routes';
import datasetsRoutes from './datasets.routes';
import etlRoutes from './etl.routes';
import etlWorkerRoutes from './etl-worker.routes';
import schedulesRoutes from './schedules.routes';
import systemRoutes from './system.routes';
import clickhouseRoutes from './clickhouse.routes';
import performanceRoutes from './performance.routes';
import cacheRoutes from './cache.routes';
import apiPreviewRoutes from './api-preview.routes';

const router = Router();

// Health check
router.use('/health', healthRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Connection management
router.use('/connections', connectionsRoutes);

// Dataset management
router.use('/datasets', datasetsRoutes);

// ETL routes
router.use('/etl', etlRoutes);
router.use('/etl', etlWorkerRoutes);  // ETL Worker management (start/stop/restart)
router.use('/etl-jobs', etlRoutes);  // Alias for /etl/jobs

// Schedule management
router.use('/schedules', schedulesRoutes);

// System routes
router.use('/system', systemRoutes);

// ClickHouse management
router.use('/clickhouse', clickhouseRoutes);

// Performance metrics
router.use('/performance', performanceRoutes);

// Cache management
router.use('/cache', cacheRoutes);

// API preview
router.use('/api-preview', apiPreviewRoutes);

export default router;
