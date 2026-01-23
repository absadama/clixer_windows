/**
 * Clixer - Notification Service
 * Alerts, WebSocket, Email, Push
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import {
  createLogger,
  requestLogger,
  db,
  cache,
  authenticate,
  tenantIsolation,
  AppError,
  formatError
} from '@clixer/shared';

const logger = createLogger({ service: 'notification-service' });
const app = express();
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 4004;

// Middleware
app.use(helmet());

// CORS - Servisler gateway arkasında, sadece internal erişim
const corsOrigins = process.env.NODE_ENV === 'production' 
  ? ['http://localhost:3000', 'http://127.0.0.1:3000'] // Gateway
  : true; // Development'ta tüm originler
app.use(cors({ origin: corsOrigins, credentials: true }));

app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await db.checkHealth();
  const cacheHealthy = await cache.checkHealth();
  res.json({
    service: 'notification-service',
    status: dbHealthy && cacheHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString()
  });
});

// Get notifications
app.get('/notifications', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { unreadOnly } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    if (unreadOnly === 'true') query += ' AND is_read = false';
    query += ' ORDER BY created_at DESC LIMIT 50';

    const notifications = await db.queryAll(query, [req.user!.userId]);
    res.json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
});

// Mark as read
app.put('/notifications/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await db.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const errorResponse = formatError(err, process.env.NODE_ENV !== 'production');
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json(errorResponse);
});

// Start
let server: any;

async function start() {
  try {
    db.createPool();
    cache.createRedisClient();

    // Listen for events
    cache.subscribe('data_changed', (message) => {
      logger.info('Data changed event received', message);
      // TODO: WebSocket ile frontend'e bildir
    });

    cache.subscribe('etl:completed', (message) => {
      logger.info('ETL completed', message);
      // TODO: Kullanıcıya bildirim gönder
    });

    server = app.listen(PORT, () => {
      logger.info(`🔔 Notification Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start notification-service', { error });
    process.exit(1);
  }
}

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  if (server) {
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await db.closePool();
        logger.info('Database pool closed');
        
        await cache.close();
        logger.info('Redis connection closed');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error: any) {
        logger.error('Error during shutdown', { error: error.message });
        process.exit(1);
      }
    });
  }
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
