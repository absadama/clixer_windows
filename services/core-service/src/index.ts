/**
 * Clixer - Core Service
 * Users, Tenants, Designs, Components, Settings
 * 
 * Modular Architecture - v4.34
 * All routes are organized in separate modules under ./routes/
 */

// CRITICAL: Load environment FIRST
import './env';

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';

import {
  createLogger,
  requestLogger,
  db,
  cache,
  AppError,
  formatError
} from '@clixer/shared';

// Import all routes
import routes from './routes';

const logger = createLogger({ service: 'core-service' });
const app = express();
const PORT = process.env.CORE_SERVICE_PORT || 4002;

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());

// CORS - Servisler gateway arkasında, sadece internal erişim
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? ['http://localhost:3000', 'http://127.0.0.1:3000'] // Gateway
  : true; // Development'ta tüm originler
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// ============================================
// ROUTES
// ============================================

// Mount all routes
app.use('/', routes);

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const errorResponse = formatError(err, isDev);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  logger.error('Request error', { error: err.message, path: req.path });
  res.status(statusCode).json(errorResponse);
});

// ============================================
// STUCK JOB CLEANUP (Every 2 minutes)
// ============================================

const lastKnownProgress: Map<string, { rows: number; checkTime: number }> = new Map();

async function cleanupStuckJobs() {
  try {
    const client = cache.getClient();
    
    const runningJobs = await db.queryAll(`
      SELECT id, dataset_id, rows_processed, started_at 
      FROM etl_jobs WHERE status = 'running'
    `);
    
    if (runningJobs.length === 0) {
      lastKnownProgress.clear();
      return;
    }
    
    const heartbeatRaw = await client.get('etl:worker:heartbeat');
    let workerAlive = false;
    if (heartbeatRaw) {
      let heartbeatTime: number;
      try { heartbeatTime = parseInt(JSON.parse(heartbeatRaw), 10); } 
      catch { heartbeatTime = parseInt(heartbeatRaw, 10); }
      workerAlive = !isNaN(heartbeatTime) && (Date.now() - heartbeatTime) < 60000;
    }
    
    const stuckJobIds: string[] = [];
    const stuckDatasetIds: string[] = [];
    
    for (const job of runningJobs) {
      const jobId = job.id;
      const currentRows = job.rows_processed || 0;
      const startedAt = new Date(job.started_at).getTime();
      const jobAge = Date.now() - startedAt;
      
      if (jobAge < 3 * 60 * 1000) continue;
      
      const lastProgress = lastKnownProgress.get(jobId);
      
      if (lastProgress) {
        const timeSinceLastCheck = Date.now() - lastProgress.checkTime;
        const rowsChanged = currentRows !== lastProgress.rows;
        
        if (!workerAlive && !rowsChanged && timeSinceLastCheck > 2 * 60 * 1000) {
          stuckJobIds.push(jobId);
          stuckDatasetIds.push(job.dataset_id);
          logger.warn('Job stuck detected', { jobId, lastRows: lastProgress.rows, currentRows, workerAlive });
        }
      }
      
      lastKnownProgress.set(jobId, { rows: currentRows, checkTime: Date.now() });
    }
    
    if (stuckJobIds.length > 0) {
      await db.query(`
        UPDATE etl_jobs SET status = 'failed', completed_at = NOW(),
               error_message = 'ETL Worker yanıt vermiyor ve ilerleme yok (crash veya durdurulmuş)'
        WHERE id = ANY($1::uuid[]) AND status = 'running'
      `, [stuckJobIds]);
      
      logger.warn('Stuck jobs marked as failed', { count: stuckJobIds.length, jobIds: stuckJobIds });
      
      for (const datasetId of stuckDatasetIds) {
        await client.del(`etl:lock:${datasetId}`);
        lastKnownProgress.delete(datasetId);
      }
    }
    
    for (const [jobId] of lastKnownProgress) {
      if (!runningJobs.find((j: any) => j.id === jobId)) {
        lastKnownProgress.delete(jobId);
      }
    }
  } catch (error: any) {
    logger.error('Stuck job cleanup failed', { error: error.message });
  }
}

// ============================================
// START SERVER
// ============================================

// Track intervals for cleanup
const intervals: NodeJS.Timeout[] = [];

const server = app.listen(PORT, () => {
  logger.info(`Core Service started on port ${PORT}`);
  
  // Start stuck job cleanup interval (every 2 minutes)
  intervals.push(setInterval(cleanupStuckJobs, 2 * 60 * 1000));
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  // Clear all intervals to prevent memory leaks
  intervals.forEach(interval => clearInterval(interval));
  logger.info('Intervals cleared');
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Close database connections
      await db.closePool();
      logger.info('Database pool closed');
      
      // Close Redis connection
      await cache.close();
      logger.info('Redis connection closed');
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error: any) {
      logger.error('Error during shutdown', { error: error.message });
      process.exit(1);
    }
  });
  
  // Force exit after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
