/**
 * Data Service Routes Index
 * Aggregates modular route modules
 * 
 * ARCHITECTURE NOTE:
 * - Simple CRUD operations are in modular route files
 * - Complex operations with heavy dependencies remain in main index.ts
 * - This prevents circular dependencies and keeps complex logic centralized
 */

import { Router } from 'express';

// Import route modules
import healthRoutes from './health.routes';
import adminRoutes from './admin.routes';
import systemRoutes from './system.routes';
import apiPreviewRoutes from './api-preview.routes';
import etlRoutes from './etl.routes';
import etlWorkerRoutes from './etl-worker.routes';
import clickhouseRoutes from './clickhouse.routes';
import performanceRoutes from './performance.routes';
import cacheRoutes from './cache.routes';

const router = Router();

// Health check
router.use('/health', healthRoutes);

// Admin routes (reconnection, backup, services)
router.use('/admin', adminRoutes);

// System routes (locks, jobs, ETL health)
router.use('/system', systemRoutes);

// ETL routes (status, jobs, trigger-all)
router.use('/etl', etlRoutes);
router.use('/etl-jobs', etlRoutes);  // Alias: /etl-jobs -> /etl/jobs

// ETL Worker management (start/stop/restart)
router.use('/etl/worker', etlWorkerRoutes);

// ClickHouse table management
router.use('/clickhouse', clickhouseRoutes);

// Performance metrics
router.use('/performance', performanceRoutes);

// Cache management
router.use('/cache', cacheRoutes);

// API Preview
router.use('/api-preview', apiPreviewRoutes);

// NOTE: The following routes remain in index.ts due to complex dependencies:
// - /connections/* (database driver dependencies for test, query, preview)
// - /datasets/* (ETL and ClickHouse dependencies for sync, preview, aggregates)
// - /schedules/* (etl_schedules table dependencies)

export default router;
