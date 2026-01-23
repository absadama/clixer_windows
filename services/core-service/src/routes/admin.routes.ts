/**
 * Admin System Health Center Routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { db, cache, authenticate, authorize, ROLES, createLogger, ValidationError } from '@clixer/shared';

const router = Router();
const logger = createLogger({ service: 'core-service' });

// Service endpoints configuration
const SERVICE_ENDPOINTS: Record<string, { name: string; url: string; port: number; critical: boolean }> = {
  gateway: { name: 'API Gateway', url: 'http://localhost:4000/health', port: 4000, critical: true },
  auth: { name: 'Auth Service', url: 'http://localhost:4001/health', port: 4001, critical: true },
  core: { name: 'Core Service', url: 'http://localhost:4002/health', port: 4002, critical: true },
  data: { name: 'Data Service', url: 'http://localhost:4003/health', port: 4003, critical: true },
  notification: { name: 'Notification Service', url: 'http://localhost:4004/health', port: 4004, critical: false },
  analytics: { name: 'Analytics Service', url: 'http://localhost:4005/health', port: 4005, critical: true }
};

// Error messages
const ERROR_MESSAGES: Record<string, string> = {
  'SERVICE_DOWN': '{service} servisi yanıt vermiyor. Yeniden başlatmayı deneyin.',
  'CH_CONN_FAILED': 'ClickHouse bağlantısı kurulamadı. Container çalışıyor mu kontrol edin.',
  'PG_CONN_FAILED': 'PostgreSQL bağlantısı kesildi. Container\'ı yeniden başlatın.',
  'REDIS_CONN_FAILED': 'Redis bağlantısı yok. Cache çalışmayacak.',
  'ALL_HEALTHY': 'Tüm sistemler çalışıyor. Sorun yok.',
  'CACHE_CLEARED': 'Önbellek başarıyla temizlendi.',
  'ETL_TRIGGERED': 'ETL işlemi başlatıldı. Sonuçları birkaç dakika içinde göreceksiniz.'
};

// Helper: Check service health
async function checkService(id: string, config: any): Promise<any> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(config.url, { signal: controller.signal });
    clearTimeout(timeout);
    
    const responseTime = Date.now() - startTime;
    const data = await response.json().catch(() => ({}));
    
    return {
      id, name: config.name, port: config.port,
      status: response.ok ? 'healthy' : 'degraded',
      statusText: response.ok ? 'Çalışıyor' : 'Sorunlu',
      responseTime, critical: config.critical,
      lastCheck: new Date().toISOString(), details: data
    };
  } catch (error: any) {
    return {
      id, name: config.name, port: config.port,
      status: 'down', statusText: 'Durdu',
      responseTime: Date.now() - startTime,
      critical: config.critical,
      lastCheck: new Date().toISOString(),
      error: error.message,
      errorMessage: ERROR_MESSAGES['SERVICE_DOWN'].replace('{service}', config.name)
    };
  }
}

// Helper: Check ClickHouse
async function checkClickHouse(): Promise<any> {
  try {
    const startTime = Date.now();
    const chUser = process.env.CLICKHOUSE_USER || 'clixer';
    const chPassword = process.env.CLICKHOUSE_PASSWORD || 'clixer_click_2025';
    const authHeader = 'Basic ' + Buffer.from(`${chUser}:${chPassword}`).toString('base64');
    
    const versionRes = await fetch('http://localhost:8123/?query=SELECT%20version()', {
      headers: { 'Authorization': authHeader }
    });
    const version = await versionRes.text();
    
    if (version.includes('Code:')) throw new Error(version);
    
    const tablesRes = await fetch('http://localhost:8123/', {
      method: 'POST',
      headers: { 'Authorization': authHeader },
      body: 'SELECT name, total_rows, total_bytes FROM system.tables WHERE database=\'clixer_analytics\' FORMAT JSON'
    });
    const tablesData: any = await tablesRes.json();
    const totalRows = tablesData.data?.reduce((sum: number, t: any) => sum + parseInt(t.total_rows || 0), 0) || 0;
    
    return {
      status: 'healthy', statusText: 'Bağlı',
      version: version.trim(), tables: tablesData.data?.length || 0, totalRows,
      responseTime: Date.now() - startTime, lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'down', statusText: 'Bağlantı Yok',
      error: error.message, errorMessage: ERROR_MESSAGES['CH_CONN_FAILED'],
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: Check Redis
async function checkRedis(): Promise<any> {
  try {
    const isHealthy = await cache.checkHealth();
    const client = cache.getClient();
    const info = await client.info('memory');
    const dbsize = await client.dbsize();
    const memMatch = info.match(/used_memory_human:(\S+)/);
    
    return {
      status: isHealthy ? 'healthy' : 'down',
      statusText: isHealthy ? 'Bağlı' : 'Bağlantı Yok',
      memory: memMatch ? memMatch[1] : 'N/A', keys: dbsize,
      lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'down', statusText: 'Bağlantı Yok',
      error: error.message, errorMessage: ERROR_MESSAGES['REDIS_CONN_FAILED'],
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: Check PostgreSQL
async function checkPostgres(): Promise<any> {
  try {
    const startTime = Date.now();
    const result = await db.queryOne('SELECT count(*) as tables FROM information_schema.tables WHERE table_schema = $1', ['public']);
    
    return {
      status: 'healthy', statusText: 'Bağlı',
      tables: parseInt(result?.tables || '0'),
      responseTime: Date.now() - startTime, lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return {
      status: 'down', statusText: 'Bağlantı Yok',
      error: error.message, errorMessage: ERROR_MESSAGES['PG_CONN_FAILED'],
      lastCheck: new Date().toISOString()
    };
  }
}

// Helper: Check ETL
async function checkETL(tenantId: string): Promise<any> {
  try {
    const jobs = await db.queryAll(`
      SELECT e.id, e.dataset_id, e.action, e.status, e.rows_processed, 
             e.started_at, e.completed_at, e.error_message, d.name as dataset_name
      FROM etl_jobs e LEFT JOIN datasets d ON e.dataset_id = d.id
      ORDER BY e.started_at DESC LIMIT 10
    `);
    
    const stats = await db.queryOne(`
      SELECT count(*) FILTER (WHERE status = 'completed') as successful,
             count(*) FILTER (WHERE status = 'failed') as failed,
             count(*) FILTER (WHERE status = 'running') as running,
             count(*) FILTER (WHERE status = 'pending') as pending,
             max(completed_at) FILTER (WHERE status = 'completed') as last_sync
      FROM etl_jobs WHERE started_at > NOW() - INTERVAL '24 hours'
    `);
    
    const pendingCount = await db.queryOne('SELECT count(*) as count FROM etl_jobs WHERE status = \'pending\'');
    
    return {
      status: 'healthy', statusText: 'Çalışıyor',
      lastSync: stats?.last_sync,
      successful: parseInt(stats?.successful || '0'),
      failed: parseInt(stats?.failed || '0'),
      running: parseInt(stats?.running || '0'),
      pendingJobs: parseInt(pendingCount?.count || '0'),
      recentJobs: jobs.map((j: any) => ({
        id: j.id, datasetId: j.dataset_id, datasetName: j.dataset_name || 'Bilinmeyen Dataset',
        action: j.action, status: j.status, rowsProcessed: j.rows_processed || 0,
        startedAt: j.started_at, completedAt: j.completed_at, error: j.error_message
      })),
      lastCheck: new Date().toISOString()
    };
  } catch (error: any) {
    return { status: 'degraded', statusText: 'ETL bilgisi alınamadı', error: error.message, lastCheck: new Date().toISOString() };
  }
}

// Helper: Check ETL Worker
async function checkETLWorker(): Promise<{ isAlive: boolean; lastHeartbeat: string | null; message: string }> {
  try {
    const client = cache.getClient();
    const heartbeatRaw = await client.get('etl:worker:heartbeat');
    
    if (!heartbeatRaw) {
      return { isAlive: false, lastHeartbeat: null, message: 'ETL Worker hiç sinyal göndermedi' };
    }
    
    let heartbeatTime: number;
    try { heartbeatTime = parseInt(JSON.parse(heartbeatRaw), 10); } 
    catch { heartbeatTime = parseInt(heartbeatRaw, 10); }
    
    const diffSeconds = Math.floor((Date.now() - heartbeatTime) / 1000);
    const lastHeartbeatStr = new Date(heartbeatTime).toISOString();
    
    if (isNaN(heartbeatTime) || diffSeconds > 60) {
      return { isAlive: false, lastHeartbeat: lastHeartbeatStr, message: `ETL Worker ${Math.floor(diffSeconds / 60)} dakikadır sinyal göndermedi` };
    }
    
    return { isAlive: true, lastHeartbeat: lastHeartbeatStr, message: 'ETL Worker çalışıyor' };
  } catch (error: any) {
    return { isAlive: false, lastHeartbeat: null, message: 'Redis bağlantı hatası' };
  }
}

// Helper: Time ago
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} saniye önce`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`;
  return `${Math.floor(seconds / 86400)} gün önce`;
}

/**
 * GET /admin/health
 * Full system health status
 */
router.get('/health', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [services, clickhouse, redis, postgres, etl, etlWorker] = await Promise.all([
      Promise.all(Object.entries(SERVICE_ENDPOINTS).map(([id, config]) => checkService(id, config))),
      checkClickHouse(),
      checkRedis(),
      checkPostgres(),
      checkETL(req.user!.tenantId),
      checkETLWorker()
    ]);
    
    const criticalDown = services.filter(s => s.critical && s.status === 'down').length;
    const anyDown = services.filter(s => s.status === 'down').length;
    const dbDown = [clickhouse, redis, postgres].filter(d => d.status === 'down').length;
    
    let overallStatus = 'healthy';
    let overallMessage = ERROR_MESSAGES['ALL_HEALTHY'];
    
    if (criticalDown > 0 || dbDown > 0) {
      overallStatus = 'critical';
      overallMessage = `${criticalDown + dbDown} kritik bileşen çalışmıyor!`;
    } else if (anyDown > 0 || !etlWorker.isAlive) {
      overallStatus = 'warning';
      overallMessage = !etlWorker.isAlive ? `⚠️ ETL Worker durduruldu! ${etlWorker.message}` : `${anyDown} servis çalışmıyor.`;
    }
    
    res.json({
      success: true,
      data: {
        overall: { status: overallStatus, statusText: overallStatus === 'healthy' ? 'Sağlıklı' : overallStatus === 'warning' ? 'Uyarı' : 'Kritik', message: overallMessage, timestamp: new Date().toISOString() },
        services,
        databases: { clickhouse, redis, postgres },
        etl, etlWorker
      }
    });
  } catch (error) { next(error); }
});

/**
 * POST /admin/cache/clear
 * Clear KPI/data cache (preserves sessions)
 */
router.post('/cache/clear', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const client = cache.getClient();
    const patternsToDelete = ['kpi:*', 'dashboard:*', 'analytics:*', 'query:*', 'metrics:*'];
    
    let deletedCount = 0;
    for (const pattern of patternsToDelete) {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
        deletedCount += keys.length;
      }
    }
    
    logger.info('Cache cleared by admin (sessions preserved)', { user: req.user!.userId, deletedKeys: deletedCount });
    
    res.json({
      success: true,
      message: `Önbellek temizlendi (${deletedCount} kayıt silindi). Oturumlar korundu.`,
      data: { deletedCount },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

/**
 * POST /admin/etl/trigger
 * Trigger ETL job
 */
router.post('/etl/trigger', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.body;
    
    if (datasetId) {
      await db.query(`INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at) VALUES ($1, $2, 'manual_sync', 'pending', NOW())`, [req.user!.tenantId, datasetId]);
    } else {
      await db.query(`INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at) SELECT tenant_id, id, 'manual_sync', 'pending', NOW() FROM datasets WHERE tenant_id = $1 AND status = 'active'`, [req.user!.tenantId]);
    }
    
    await cache.publish('etl:trigger', { triggeredBy: req.user!.userId, datasetId });
    logger.info('ETL triggered by admin', { user: req.user!.userId, datasetId });
    
    res.json({ success: true, message: ERROR_MESSAGES['ETL_TRIGGERED'], timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

/**
 * POST /admin/redis/reconnect
 * Reconnect to Redis
 */
router.post('/redis/reconnect', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    try { const client = cache.getClient(); await client.quit(); } catch (e) {}
    cache.createRedisClient();
    await cache.checkHealth();
    logger.info('Redis reconnected by admin', { user: req.user!.userId });
    res.json({ success: true, message: 'Redis bağlantısı yenilendi' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Redis bağlantısı kurulamadı: ' + error.message });
  }
});

/**
 * POST /admin/services/refresh
 * Refresh all service statuses
 */
router.post('/services/refresh', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const services = await Promise.all(Object.entries(SERVICE_ENDPOINTS).map(([id, config]) => checkService(id, config)));
    const healthyCount = services.filter(s => s.status === 'healthy').length;
    res.json({ success: true, message: `${healthyCount}/${services.length} servis çalışıyor`, data: services });
  } catch (error) { next(error); }
});

/**
 * POST /admin/etl/cancel-all
 * Cancel all pending ETL jobs
 */
router.post('/etl/cancel-all', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await db.query(`UPDATE etl_jobs SET status = 'cancelled', completed_at = NOW(), error_message = 'Admin tarafından toplu iptal edildi' WHERE tenant_id = $1 AND status IN ('pending', 'running')`, [req.user!.tenantId]);
    
    await cache.del('etl:lock:*');
    await cache.del('etl:cancel:*');
    
    const cancelledCount = result.rowCount || 0;
    logger.info('All pending ETL jobs cancelled', { user: req.user!.userId, cancelledCount });
    res.json({ success: true, message: `${cancelledCount} job iptal edildi`, cancelledCount });
  } catch (error) { next(error); }
});

/**
 * GET /admin/logs
 * Get recent error logs
 */
router.get('/logs', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    
    const logs = await db.queryAll(`
      SELECT id, action, entity_type, entity_id, details, created_at, user_id
      FROM audit_logs WHERE tenant_id = $1 AND (action LIKE '%error%' OR action LIKE '%fail%' OR details::text LIKE '%error%')
      ORDER BY created_at DESC LIMIT $2
    `, [req.user!.tenantId, limit]);
    
    const etlErrors = await db.queryAll(`
      SELECT e.id, 'etl_error' as action, 'etl_job' as entity_type, e.id as entity_id,
             json_build_object('error', e.error_message, 'dataset', d.name) as details, e.completed_at as created_at
      FROM etl_jobs e JOIN datasets d ON e.dataset_id = d.id
      WHERE e.status = 'failed' AND d.tenant_id = $1
      ORDER BY e.completed_at DESC LIMIT $2
    `, [req.user!.tenantId, limit]);
    
    const allLogs = [...logs, ...etlErrors]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit)
      .map(log => ({ ...log, timeAgo: getTimeAgo(new Date(log.created_at)), severity: log.action?.includes('error') ? 'error' : 'warning' }));
    
    res.json({ success: true, data: allLogs });
  } catch (error) { next(error); }
});

/**
 * GET /admin/services/:serviceId
 * Get specific service info
 */
router.get('/services/:serviceId', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const config = SERVICE_ENDPOINTS[serviceId];
    if (!config) return res.status(404).json({ success: false, message: 'Servis bulunamadı' });
    const status = await checkService(serviceId, config);
    res.json({ success: true, data: status });
  } catch (error) { next(error); }
});

/**
 * POST /admin/service/:serviceId/restart
 * Restart a specific service
 */
router.post('/service/:serviceId/restart', authenticate, authorize(ROLES.ADMIN), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const config = SERVICE_ENDPOINTS[serviceId];
    if (!config) return res.status(404).json({ success: false, message: `Servis bulunamadı: ${serviceId}` });
    
    const status = await checkService(serviceId, config);
    
    if (status.status === 'healthy') {
      return res.json({
        success: true,
        message: `${config.name} çalışıyor. Yeniden başlatmak için terminalde ilgili servisi durdurup başlatın.`,
        instructions: `cd services/${serviceId} && npm run dev`
      });
    }
    
    res.json({
      success: true,
      message: `${config.name} durmuş. Başlatmak için terminalde şu komutu çalıştırın:`,
      instructions: `cd services/${serviceId} && npm run dev`,
      status: 'requires_manual_action'
    });
  } catch (error) { next(error); }
});

export default router;
