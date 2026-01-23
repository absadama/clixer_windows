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

// Import route modules - only simple/independent routes
import healthRoutes from './health.routes';
import etlWorkerRoutes from './etl-worker.routes';
import clickhouseRoutes from './clickhouse.routes';
import performanceRoutes from './performance.routes';
import cacheRoutes from './cache.routes';

const router = Router();

// Health check (simple, no dependencies)
router.use('/health', healthRoutes);

// ETL Worker management (start/stop/restart - independent)
router.use('/etl', etlWorkerRoutes);

// ClickHouse table management (independent)
router.use('/clickhouse', clickhouseRoutes);

// Performance metrics (independent)
router.use('/performance', performanceRoutes);

// Cache management (independent)
router.use('/cache', cacheRoutes);

// NOTE: The following routes remain in index.ts due to complex dependencies:
// - /admin/* (system status, stats, restart, backup - heavy system dependencies)
// - /connections/* (database driver dependencies for test, query, preview)
// - /datasets/* (ETL and ClickHouse dependencies for sync, preview, aggregates)
// - /etl/* (ETL job management with complex state)
// - /schedules/* (dataset schedule dependencies)
// - /system/* (system-wide operations)
// - /api-preview (external API dependencies)

export default router;
