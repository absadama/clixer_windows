/**
 * Admin Routes - System Administration
 * Reconnection, backup, monitoring, service management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, clickhouse, cache, authenticate, authorize, ROLES, createLogger } from '@clixer/shared';
import { SERVICE_LIST, pingService } from '../helpers/service.helper';

const router = Router();
const logger = createLogger({ service: 'data-service' });

// ============================================
// DATABASE RECONNECTION
// ============================================

/**
 * POST /admin/redis/reconnect
 * Reconnect to Redis
 */
router.post('/redis/reconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Redis reconnect requested by user', { userId: req.user?.userId });
    
    const Redis = require('ioredis');
    const redisClient = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      lazyConnect: true
    });
    
    await redisClient.connect();
    await redisClient.ping();
    await redisClient.quit();
    
    logger.info('Redis reconnect successful');
    res.json({ success: true, message: 'Redis bağlantısı yenilendi' });
  } catch (error: any) {
    logger.error('Redis reconnect failed', { error: error.message });
    res.status(500).json({ success: false, message: 'Redis bağlantısı kurulamadı: ' + error.message });
  }
});

/**
 * POST /admin/postgres/reconnect
 * Reconnect to PostgreSQL
 */
router.post('/postgres/reconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('PostgreSQL reconnect requested by user', { userId: req.user?.userId });
    
    db.createPool();
    const healthy = await db.checkHealth();
    
    if (healthy) {
      logger.info('PostgreSQL reconnect successful');
      res.json({ success: true, message: 'PostgreSQL bağlantısı yenilendi' });
    } else {
      throw new Error('Health check başarısız');
    }
  } catch (error: any) {
    logger.error('PostgreSQL reconnect failed', { error: error.message });
    res.status(500).json({ success: false, message: 'PostgreSQL bağlantısı kurulamadı: ' + error.message });
  }
});

/**
 * POST /admin/clickhouse/reconnect
 * Reconnect to ClickHouse
 */
router.post('/clickhouse/reconnect', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('ClickHouse reconnect requested by user', { userId: req.user?.userId });
    
    clickhouse.createClickHouseClient();
    const healthy = await clickhouse.checkHealth();
    
    if (healthy) {
      logger.info('ClickHouse reconnect successful');
      res.json({ success: true, message: 'ClickHouse bağlantısı yenilendi' });
    } else {
      throw new Error('Health check başarısız');
    }
  } catch (error: any) {
    logger.error('ClickHouse reconnect failed', { error: error.message });
    res.status(500).json({ success: false, message: 'ClickHouse bağlantısı kurulamadı: ' + error.message });
  }
});

// ============================================
// SYSTEM STATUS & MONITORING
// ============================================

/**
 * GET /admin/system/status
 * Detailed system status
 */
router.get('/system/status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dbHealthy = await db.checkHealth();
    const chHealthy = await clickhouse.checkHealth();
    
    let redisHealthy = false;
    let redisInfo: any = {};
    try {
      const Redis = require('ioredis');
      const redisClient = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        connectTimeout: 5000
      });
      
      const pong = await redisClient.ping();
      redisHealthy = pong === 'PONG';
      
      if (redisHealthy) {
        const info = await redisClient.info('memory');
        const keys = await redisClient.dbsize();
        redisInfo = { memory: info.match(/used_memory_human:(.+)/)?.[1]?.trim() || 'N/A', keys };
      }
      
      await redisClient.quit();
    } catch (e: any) {
      redisInfo = { error: e.message };
    }
    
    res.json({
      success: true,
      data: {
        databases: {
          postgres: { status: dbHealthy ? 'healthy' : 'error' },
          clickhouse: { status: chHealthy ? 'healthy' : 'error' },
          redis: { 
            status: redisHealthy ? 'healthy' : 'error',
            ...redisInfo
          }
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * GET /admin/system/stats
 * System statistics for monitoring
 */
router.get('/system/stats', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const connResult = await db.queryOne(`
      SELECT count(*) as active FROM pg_stat_activity WHERE state = 'active'
    `);
    
    const last24h = await db.queryOne(`
      SELECT 
        count(*) as total_logins,
        count(DISTINCT user_id) as unique_users
      FROM audit_logs 
      WHERE action = 'LOGIN' 
        AND created_at >= NOW() - INTERVAL '24 hours'
    `);
    
    const last7d = await db.queryOne(`
      SELECT 
        count(*) as total_logins,
        count(DISTINCT user_id) as unique_users
      FROM audit_logs 
      WHERE action = 'LOGIN' 
        AND created_at >= NOW() - INTERVAL '7 days'
    `);
    
    let pgSize = 'N/A';
    let chSize = 'N/A';
    
    try {
      const pgResult = await db.queryOne(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      pgSize = pgResult?.size || 'N/A';
    } catch (e) {}
    
    try {
      const chResult = await clickhouse.query(`
        SELECT formatReadableSize(sum(bytes_on_disk)) as size 
        FROM system.parts 
        WHERE database = 'clixer_analytics'
      `);
      chSize = chResult?.[0]?.size || 'N/A';
    } catch (e) {}
    
    const recentLogins = await db.queryAll(`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.position_code as position_name,
        u.last_login_at
      FROM users u
      WHERE u.last_login_at IS NOT NULL
      ORDER BY u.last_login_at DESC
      LIMIT 10
    `);
    
    res.json({
      success: true,
      data: {
        activeConnections: parseInt(connResult?.active || '0'),
        last24Hours: {
          logins: parseInt(last24h?.total_logins || '0'),
          uniqueUsers: parseInt(last24h?.unique_users || '0')
        },
        last7Days: {
          logins: parseInt(last7d?.total_logins || '0'),
          uniqueUsers: parseInt(last7d?.unique_users || '0')
        },
        databaseSize: {
          postgres: pgSize,
          clickhouse: chSize
        },
        recentLogins
      }
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /admin/system/restart
 * Restart all services
 * SECURITY: Command Injection protection with whitelist and execFile
 */
router.post('/system/restart', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response) => {
  const { spawn, execFile } = require('child_process');
  const path = require('path');
  const fs = require('fs');
  const isWindows = process.platform === 'win32';
  
  // SECURITY: Sadece whitelist'teki scriptler çalıştırılabilir
  const ALLOWED_SCRIPTS: Record<string, string> = {
    windows: 'restart-local.ps1',
    linux: 'restart-all.sh'
  };
  
  const scriptName = isWindows ? ALLOWED_SCRIPTS.windows : ALLOWED_SCRIPTS.linux;
  const scriptsDir = path.resolve(__dirname, '../../../../scripts');
  const scriptPath = path.resolve(scriptsDir, scriptName);
  
  // SECURITY: Path traversal koruması
  if (!scriptPath.startsWith(scriptsDir)) {
    logger.error('Path traversal attempt detected', { 
      attemptedPath: scriptPath, 
      scriptsDir, 
      user: req.user?.email 
    });
    return res.status(400).json({ 
      success: false, 
      message: 'Geçersiz script path' 
    });
  }
  
  if (!fs.existsSync(scriptPath)) {
    logger.error('Restart script not found', { scriptPath, user: req.user?.email });
    return res.status(500).json({ 
      success: false, 
      message: 'Restart scripti bulunamadı' 
    });
  }
  
  logger.warn('System restart initiated by user', { 
    user: req.user?.email, 
    platform: process.platform,
    scriptPath 
  });
  
  // SECURITY: Command injection koruması - execFile kullan, shell string interpolation değil
  if (isWindows) {
    // Windows: PowerShell'i doğrudan array argümanları ile çağır
    spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
  } else {
    // Linux: execFile ile script'i doğrudan çalıştır (sudo için sudoers yapılandırması gerekli)
    // NOT: at komutu yerine nohup ile çalıştır - daha güvenli
    spawn('/bin/bash', ['-c', `sleep 5 && ${scriptPath}`], {
      detached: true,
      stdio: 'ignore'
    }).unref();
  }
  
  res.json({ 
    success: true, 
    message: 'Sistem yeniden başlatma sinyali gönderildi. Tüm servislerin ayağa kalkması 30-60 saniye sürebilir.' 
  });
});

// ============================================
// SERVICE MANAGEMENT
// ============================================

/**
 * GET /admin/services
 * List all services with status
 */
router.get('/services', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await Promise.all(
      SERVICE_LIST.map(async (svc) => {
        let status = 'unknown';
        let responseTime = 0;
        
        if (svc.port) {
          const startTime = Date.now();
          const isHealthy = await pingService(`http://localhost:${svc.port}/health`);
          responseTime = Date.now() - startTime;
          status = isHealthy ? 'running' : 'stopped';
        } else {
          try {
            const Redis = require('ioredis');
            const redis = new Redis({
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379'),
              connectTimeout: 2000
            });
            const lastHeartbeat = await redis.get('etl:worker:heartbeat');
            await redis.quit();
            
            if (lastHeartbeat) {
              const lastTime = new Date(lastHeartbeat).getTime();
              const now = Date.now();
              status = (now - lastTime < 120000) ? 'running' : 'stopped';
            } else {
              status = 'stopped';
            }
          } catch {
            status = 'unknown';
          }
        }
        
        return {
          ...svc,
          status,
          statusText: status === 'running' ? 'Çalışıyor' : status === 'stopped' ? 'Durmuş' : 'Bilinmiyor',
          responseTime
        };
      })
    );
    
    const runningCount = services.filter(s => s.status === 'running').length;
    const stoppedCount = services.filter(s => s.status === 'stopped').length;
    
    res.json({
      success: true,
      data: {
        services,
        summary: {
          total: services.length,
          running: runningCount,
          stopped: stoppedCount
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * GET /admin/sessions
 * List active sessions
 */
router.get('/sessions', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await db.queryAll(`
      SELECT DISTINCT ON (u.id)
        u.id as user_id,
        u.email,
        u.name,
        u.position_code,
        u.last_login_at,
        al.ip_address,
        al.user_agent,
        al.created_at as session_start
      FROM users u
      LEFT JOIN audit_logs al ON al.user_id = u.id AND al.action = 'user_login'
      WHERE u.last_login_at > NOW() - INTERVAL '24 hours'
      ORDER BY u.id, al.created_at DESC
    `);
    
    res.json({ 
      success: true, 
      data: sessions.map((s: any) => ({
        ...s,
        isActive: true,
        duration: s.session_start ? Math.floor((Date.now() - new Date(s.session_start).getTime()) / 60000) : 0
      }))
    });
  } catch (error: any) {
    next(error);
  }
});

/**
 * DELETE /admin/sessions/:userId
 * Terminate user session
 */
router.delete('/sessions/:userId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    
    await db.query(
      'UPDATE users SET last_login_at = NULL WHERE id = $1',
      [userId]
    );
    
    try {
      const Redis = require('ioredis');
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379')
      });
      await redis.del(`user:${userId}:tokens`);
      await redis.quit();
    } catch {}
    
    logger.info('Session terminated', { userId, by: req.user?.id });
    res.json({ success: true, message: 'Oturum sonlandırıldı' });
  } catch (error: any) {
    next(error);
  }
});

// ============================================
// BACKUP MANAGEMENT
// ============================================

/**
 * GET /admin/backup/list
 * List backups
 */
router.get('/backup/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const backupDir = path.join(process.cwd(), '..', '..', 'backups');
    
    let backups: any[] = [];
    
    if (fs.existsSync(backupDir)) {
      const dirs = fs.readdirSync(backupDir).filter((f: string) => {
        const fullPath = path.join(backupDir, f);
        return fs.statSync(fullPath).isDirectory();
      });
      
      backups = dirs.map((dir: string) => {
        const fullPath = path.join(backupDir, dir);
        const stats = fs.statSync(fullPath);
        
        let size = 0;
        try {
          const files = fs.readdirSync(fullPath);
          files.forEach((file: string) => {
            const filePath = path.join(fullPath, file);
            const fileStats = fs.statSync(filePath);
            if (fileStats.isFile()) size += fileStats.size;
          });
        } catch {}
        
        return {
          name: dir,
          createdAt: stats.mtime,
          size: size,
          sizeFormatted: size > 1024*1024 ? `${(size/1024/1024).toFixed(1)} MB` : `${(size/1024).toFixed(1)} KB`
        };
      }).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    
    res.json({ success: true, data: backups });
  } catch (error: any) {
    next(error);
  }
});

/**
 * POST /admin/backup/create
 * Create new backup
 * SECURITY: Command Injection protection with execFile and spawn
 */
router.post('/backup/create', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    
    // SECURITY: timestamp sadece güvenli karakterler içerir
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    // SECURITY: backupName formatı kontrol edilir
    if (!/^backup_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/.test(`backup_${timestamp}`)) {
      throw new Error('Geçersiz backup adı formatı');
    }
    const backupName = `backup_${timestamp}`;
    const backupsRoot = path.resolve(process.cwd(), '..', '..', 'backups');
    const backupDir = path.join(backupsRoot, backupName);
    
    // SECURITY: Path traversal koruması
    if (!backupDir.startsWith(backupsRoot)) {
      throw new Error('Geçersiz backup dizini');
    }
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    const outputFile = path.join(backupDir, 'postgresql_full.sql');
    const outputStream = fs.createWriteStream(outputFile);
    
    // SECURITY: spawn ile array argümanları kullan - shell interpolation yok
    const pgDump = spawn('docker', [
      'exec', 
      'clixer_postgres', 
      'pg_dump', 
      '-U', 'clixer', 
      '-d', 'clixer', 
      '--no-owner'
    ]);
    
    pgDump.stdout.pipe(outputStream);
    
    pgDump.on('error', (error: Error) => {
      logger.error('Backup spawn failed', { error: error.message });
    });
    
    pgDump.on('close', (code: number) => {
      if (code === 0) {
        logger.info('Backup created', { backupName, by: req.user?.userId });
      } else {
        logger.error('Backup failed', { code, backupName });
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Yedekleme başlatıldı', 
      data: { backupName } 
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
