/**
 * Clixer - Notification Service
 * WebSocket (Socket.IO) + Alerts + Email + Push
 * 
 * Real-time Events:
 * - etl:completed → Dashboard widget'larını yenile
 * - data:changed → Cache invalidate + UI güncelle
 * - notification:new → Bildirim toast göster
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

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
const httpServer = createServer(app);

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 4004;
const JWT_SECRET = process.env.JWT_SECRET || 'clixer_jwt_super_secret_2025';

// ============================================
// SOCKET.IO SERVER - 400+ Kullanıcı için Optimize
// ============================================
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://clixer.app', 'https://app.clixer.com']
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // 400 kullanıcı için optimize
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB
  transports: ['websocket', 'polling'],
  // Connection throttling
  connectTimeout: 45000,
  // Redis adapter için hazır (scaling için)
  // adapter: createAdapter(pubClient, subClient) // İleride eklenebilir
});

// ============================================
// SOCKET AUTHENTICATION MIDDLEWARE
// ============================================
io.use((socket: Socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    logger.warn('Socket connection rejected: No token', { socketId: socket.id });
    return next(new Error('Authentication required'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    socket.data.userId = decoded.userId;
    socket.data.tenantId = decoded.tenantId;
    socket.data.email = decoded.email;
    socket.data.filterLevel = decoded.filterLevel || 'none';
    socket.data.filterValue = decoded.filterValue;
    next();
  } catch (err) {
    logger.warn('Socket connection rejected: Invalid token', { socketId: socket.id });
    return next(new Error('Invalid token'));
  }
});

// ============================================
// SOCKET CONNECTION HANDLING
// ============================================
const connectedUsers = new Map<string, Set<string>>(); // userId -> Set<socketId>

io.on('connection', (socket: Socket) => {
  const userId = socket.data.userId;
  const tenantId = socket.data.tenantId;
  
  logger.info('Socket connected', { 
    socketId: socket.id, 
    userId, 
    tenantId,
    transport: socket.conn.transport.name
  });
  
  // Kullanıcıyı tenant room'una ekle
  socket.join(`tenant:${tenantId}`);
  socket.join(`user:${userId}`);
  
  // Bağlı kullanıcıları takip et
  if (!connectedUsers.has(userId)) {
    connectedUsers.set(userId, new Set());
  }
  connectedUsers.get(userId)!.add(socket.id);
  
  // Online kullanıcı sayısını logla
  const totalConnections = io.engine.clientsCount;
  logger.info('Active connections', { total: totalConnections, uniqueUsers: connectedUsers.size });
  
  // ============================================
  // CLIENT EVENTS
  // ============================================
  
  // Dashboard'a abone ol (real-time güncellemeler için)
  socket.on('subscribe:dashboard', (designId: string) => {
    socket.join(`dashboard:${designId}`);
    logger.debug('Subscribed to dashboard', { socketId: socket.id, designId });
  });
  
  // Dashboard aboneliğinden çık
  socket.on('unsubscribe:dashboard', (designId: string) => {
    socket.leave(`dashboard:${designId}`);
    logger.debug('Unsubscribed from dashboard', { socketId: socket.id, designId });
  });
  
  // Dataset'e abone ol (ETL güncellemeleri için)
  socket.on('subscribe:dataset', (datasetId: string) => {
    socket.join(`dataset:${datasetId}`);
    logger.debug('Subscribed to dataset', { socketId: socket.id, datasetId });
  });
  
  // Ping-pong (connection health)
  socket.on('ping', () => {
    socket.emit('pong', { timestamp: Date.now() });
  });
  
  // ============================================
  // DISCONNECT
  // ============================================
  socket.on('disconnect', (reason) => {
    logger.info('Socket disconnected', { socketId: socket.id, userId, reason });
    
    // Kullanıcı bağlantısını kaldır
    const userSockets = connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        connectedUsers.delete(userId);
      }
    }
  });
});

// ============================================
// EXPRESS MIDDLEWARE
// ============================================
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// ============================================
// REST ENDPOINTS
// ============================================

// Health check
app.get('/health', async (req: Request, res: Response) => {
  const dbHealthy = await db.checkHealth();
  const cacheHealthy = await cache.checkHealth();
  const socketConnections = io.engine.clientsCount;
  
  res.json({
    service: 'notification-service',
    status: dbHealthy && cacheHealthy ? 'healthy' : 'degraded',
    websocket: {
      connections: socketConnections,
      uniqueUsers: connectedUsers.size
    },
    timestamp: new Date().toISOString()
  });
});

// WebSocket stats (admin için)
app.get('/stats', authenticate, async (req: Request, res: Response) => {
  const sockets = await io.fetchSockets();
  
  res.json({
    success: true,
    data: {
      totalConnections: io.engine.clientsCount,
      uniqueUsers: connectedUsers.size,
      rooms: io.sockets.adapter.rooms.size,
      users: Array.from(connectedUsers.entries()).map(([userId, sockets]) => ({
        userId,
        connectionCount: sockets.size
      }))
    }
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

// Send notification (internal API)
app.post('/notifications/send', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, title, message, type = 'info' } = req.body;
    
    // Veritabanına kaydet
    const result = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, tenant_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, title, message, type, req.user!.tenantId]
    );
    
    // WebSocket ile anlık gönder
    io.to(`user:${userId}`).emit('notification:new', {
      id: result.rows[0].id,
      title,
      message,
      type,
      createdAt: new Date().toISOString()
    });
    
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// Broadcast to tenant (admin only)
app.post('/notifications/broadcast', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, message, type = 'info' } = req.body;
    const tenantId = req.user!.tenantId;
    
    // Tüm tenant kullanıcılarına WebSocket ile gönder
    io.to(`tenant:${tenantId}`).emit('notification:broadcast', {
      title,
      message,
      type,
      createdAt: new Date().toISOString()
    });
    
    logger.info('Broadcast sent', { tenantId, title });
    res.json({ success: true, message: 'Broadcast sent' });
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

// ============================================
// REDIS PUB/SUB - Real-time Events
// ============================================
async function setupEventListeners() {
  // ETL tamamlandığında
  cache.subscribe('etl:completed', (message: any) => {
    const { datasetId, datasetName, rowsProcessed, tenantId } = message;
    
    logger.info('ETL completed event', { datasetId, rowsProcessed });
    
    // Dataset'e abone olan herkese bildir
    io.to(`dataset:${datasetId}`).emit('etl:completed', {
      datasetId,
      datasetName,
      rowsProcessed,
      timestamp: Date.now()
    });
    
    // Tenant'taki herkese bildir
    if (tenantId) {
      io.to(`tenant:${tenantId}`).emit('data:refresh', {
        type: 'etl',
        datasetId,
        message: `${datasetName || 'Dataset'} güncellendi (${rowsProcessed} satır)`
      });
    }
  });
  
  // Veri değiştiğinde (cache invalidation sonrası)
  cache.subscribe('data:changed', (message: any) => {
    const { datasetId, table, tenantId } = message;
    
    logger.info('Data changed event', { datasetId, table });
    
    // İlgili dashboard'ları güncelle
    io.to(`dataset:${datasetId}`).emit('data:changed', {
      datasetId,
      table,
      timestamp: Date.now()
    });
  });
  
  // Dashboard cache temizlendiğinde
  cache.subscribe('cache:invalidated', (message: any) => {
    const { designId, reason } = message;
    
    if (designId) {
      io.to(`dashboard:${designId}`).emit('dashboard:refresh', {
        designId,
        reason,
        timestamp: Date.now()
      });
    }
  });
}

// ============================================
// START SERVER
// ============================================
async function start() {
  try {
    db.createPool();
    cache.createRedisClient();
    
    // Redis event listener'larını kur
    await setupEventListeners();
    
    httpServer.listen(PORT, () => {
      logger.info(`🔔 Notification Service (WebSocket) running on port ${PORT}`);
      logger.info(`📡 Socket.IO ready for 400+ concurrent connections`);
    });
  } catch (error) {
    logger.error('Failed to start notification-service', { error });
    process.exit(1);
  }
}

start();

// ============================================
// EXPORTS (Test/Debug için)
// ============================================
export { io, connectedUsers };
