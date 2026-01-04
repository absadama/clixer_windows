/**
 * Clixer - API Gateway
 * Route requests to microservices
 */

import express, { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import winston from 'winston';

dotenv.config({ path: '../.env' });

const app = express();
const PORT = process.env.GATEWAY_PORT || 4000;

// Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => 
      `${timestamp} [gateway] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
    )
  ),
  transports: [new winston.transports.Console()]
});

// Service URLs
const SERVICES = {
  AUTH: process.env.AUTH_SERVICE_URL || 'http://localhost:4001',
  CORE: process.env.CORE_SERVICE_URL || 'http://localhost:4002',
  DATA: process.env.DATA_SERVICE_URL || 'http://localhost:4003',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:4004',
  ANALYTICS: process.env.ANALYTICS_SERVICE_URL || 'http://localhost:4005'
};

// ============================================
// SECURITY MIDDLEWARE
// ============================================

// Helmet.js - HTTP güvenlik başlıkları
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,  // API için gerekli
  hsts: {
    maxAge: 31536000,  // 1 yıl
    includeSubDomains: true,
    preload: true
  }
}));

// CORS - Production'da kısıtlı, development'ta localhost
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : (process.env.NODE_ENV === 'production' 
      ? ['https://clixer.app', 'https://app.clixer.com'] 
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173']);

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Trace-Id'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Size'],
  maxAge: 86400  // 24 saat preflight cache
}));

app.use(compression());

// ============================================
// ENTERPRISE RATE LIMITING
// ============================================

// Genel rate limit - Tüm endpointler için
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 200, // Dakikada 200 istek
  message: { 
    success: false, 
    errorCode: 'RATE_LIMIT', 
    message: 'Çok fazla istek. Lütfen 1 dakika bekleyin.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // IP + User ID kombinasyonu (eğer varsa)
    const userId = (req.headers['x-user-id'] as string) || '';
    return `${req.ip}-${userId}`;
  }
});

// Analytics için daha kısıtlı limit (ağır sorgular)
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60, // Dakikada 60 analytics sorgusu
  message: { 
    success: false, 
    errorCode: 'RATE_LIMIT_ANALYTICS', 
    message: 'Çok fazla analitik sorgusu. Lütfen bekleyin.' 
  }
});

// Auth için brute-force koruması
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10, // 15 dakikada 10 deneme
  message: { 
    success: false, 
    errorCode: 'AUTH_RATE_LIMIT', 
    message: 'Çok fazla giriş denemesi. 15 dakika bekleyin.' 
  },
  skipSuccessfulRequests: true // Başarılı girişleri sayma
});

// Genel rate limit uygula
app.use(generalLimiter);

// ============================================
// REQUEST SECURITY & LOGGING
// ============================================

// Trace ID oluştur (her request için unique ID)
app.use((req: Request, res: Response, next: NextFunction) => {
  const traceId = req.headers['x-trace-id'] as string || 
    `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  req.headers['x-trace-id'] = traceId;
  res.setHeader('X-Trace-Id', traceId);
  next();
});

// Suspicious request detection
app.use((req: Request, res: Response, next: NextFunction) => {
  // API endpoint'leri için whitelist (bu path'ler SQL keyword içerebilir)
  const whitelistedPaths = [
    '/api/analytics/metrics/',  // /execute endpoint'i için
    '/api/data/connections/',   // /execute endpoint'i için
    '/api/data/datasets/',      // query işlemleri için
    '/api/data/clickhouse/'     // Veri yönetimi (delete, truncate) için
  ];
  
  // Whitelist'teki path'leri SQL keyword kontrolünden muaf tut
  const isWhitelisted = whitelistedPaths.some(path => req.originalUrl.includes(path));
  
  const suspiciousPatterns = [
    /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,  // SQL Injection
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // XSS
    /\.\.\//g  // Path traversal
  ];
  
  // SQL keyword kontrolü sadece whitelist dışındaki path'lerde
  if (!isWhitelisted) {
    suspiciousPatterns.push(/\b(union|select|insert|update|delete|drop|alter|exec|execute)\b/i);
  }
  
  const fullUrl = req.originalUrl + JSON.stringify(req.body || {});
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fullUrl)) {
      logger.warn('Suspicious request blocked', {
        ip: req.ip,
        method: req.method,
        url: req.originalUrl,
        pattern: pattern.toString()
      });
      return res.status(400).json({
        success: false,
        errorCode: 'SECURITY_VIOLATION',
        message: 'Geçersiz istek tespit edildi'
      });
    }
  }
  next();
});

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      traceId: req.headers['x-trace-id']
    };
    
    // Yavaş istekleri uyarı olarak logla
    if (duration > 5000) {
      logger.warn(`SLOW ${req.method} ${req.originalUrl}`, logData);
    } else {
      logger.info(`${req.method} ${req.originalUrl}`, logData);
    }
  });
  next();
});

// Proxy options factory
const proxyOptions = (target: string): Options => ({
  target,
  changeOrigin: true,
  pathRewrite: { '^/api': '' },
  onError: (err, req, res) => {
    logger.error(`Proxy error: ${err.message}`, { target, path: req.url });
    (res as Response).status(502).json({
      success: false,
      errorCode: 'PROXY_ERROR',
      message: 'Servis geçici olarak kullanılamıyor'
    });
  }
});

// ============================================
// ROUTES
// ============================================

// Gateway health
app.get('/health', (req: Request, res: Response) => {
  res.json({
    service: 'gateway',
    status: 'healthy',
    services: SERVICES,
    timestamp: new Date().toISOString()
  });
});

// Auth routes (brute-force korumalı)
app.use('/api/auth', authLimiter, createProxyMiddleware({
  ...proxyOptions(SERVICES.AUTH),
  pathRewrite: { '^/api/auth': '' }
}));

// ============================================
// IP WHITELIST MIDDLEWARE (Admin Panel)
// ============================================

// IP Whitelist cache (5 dakika)
let ipWhitelistCache: { ips: string[], cachedAt: number } | null = null;
const IP_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

async function getIPWhitelist(): Promise<string[]> {
  // Cache kontrolü
  if (ipWhitelistCache && (Date.now() - ipWhitelistCache.cachedAt) < IP_CACHE_TTL) {
    return ipWhitelistCache.ips;
  }
  
  try {
    // Veritabanından al
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'clixer',
      user: process.env.DB_USER || 'clixer',
      password: process.env.DB_PASSWORD || 'clixer123'
    });
    
    const result = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'admin_ip_whitelist' LIMIT 1"
    );
    
    await pool.end();
    
    if (result.rows.length > 0) {
      const ips = typeof result.rows[0].value === 'string' 
        ? JSON.parse(result.rows[0].value)
        : result.rows[0].value;
      
      ipWhitelistCache = { ips, cachedAt: Date.now() };
      return ips;
    }
  } catch (error) {
    logger.error('IP whitelist fetch error', { error });
  }
  
  // Varsayılan: Tümüne izin ver
  return ['*'];
}

function getClientIP(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim();
  }
  return req.socket.remoteAddress || req.ip || '';
}

// Admin endpoint'leri için IP kontrolü
const adminIPWhitelist = async (req: Request, res: Response, next: NextFunction) => {
  const whitelist = await getIPWhitelist();
  
  // * = Tümüne izin ver
  if (whitelist.includes('*')) {
    return next();
  }
  
  const clientIP = getClientIP(req);
  
  // IP kontrolü (CIDR desteği olmadan basit karşılaştırma)
  const isAllowed = whitelist.some(ip => {
    // Localhost varyantları
    if (ip === 'localhost' && (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1')) {
      return true;
    }
    return ip === clientIP || ip === clientIP.replace('::ffff:', '');
  });
  
  if (!isAllowed) {
    logger.warn('IP not whitelisted', { clientIP, path: req.path });
    return res.status(403).json({
      success: false,
      errorCode: 'IP_NOT_ALLOWED',
      message: 'Bu IP adresinden admin paneline erişim izni yok'
    });
  }
  
  next();
};

// Core routes (users, tenants, designs, components, settings, roles)
// /api/core/* -> Core Service (yeni prefix)
// Admin endpoint'leri IP whitelist kontrolü altında
app.use('/api/core', adminIPWhitelist, createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

// Legacy core routes (backward compatibility)
app.use('/api/users', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/tenants', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/designs', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/components', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/settings', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api': '' }
}));

// Data routes (connections, datasets, etl, metrics)
// /api/data/* -> Data Service
app.use('/api/data', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api/data': '' }
}));

// Legacy routes (backward compatibility)
app.use('/api/connections', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/datasets', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/etl-jobs', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/metrics', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

// Analytics routes (metrics, kpi, dashboard, clickhouse) - Özel limit
app.use('/api/analytics', analyticsLimiter, createProxyMiddleware({
  ...proxyOptions(SERVICES.ANALYTICS),
  pathRewrite: { '^/api/analytics': '' }
}));

app.use('/api/kpi', createProxyMiddleware({
  ...proxyOptions(SERVICES.ANALYTICS),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/dashboard', createProxyMiddleware({
  ...proxyOptions(SERVICES.ANALYTICS),
  pathRewrite: { '^/api': '' }
}));

// Notification routes
app.use('/api/notifications', createProxyMiddleware({
  ...proxyOptions(SERVICES.NOTIFICATION),
  pathRewrite: { '^/api': '' }
}));

// Admin Database routes (Redis, PostgreSQL, ClickHouse reconnect) - Data Service
// NOT: Spesifik route'lar genel route'tan ÖNCE gelmeli!
app.use('/api/admin/redis', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/admin/postgres', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/admin/clickhouse', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

app.use('/api/admin/system', createProxyMiddleware({
  ...proxyOptions(SERVICES.DATA),
  pathRewrite: { '^/api': '' }
}));

// Admin routes (System Health) - Core Service (genel admin catch-all)
app.use('/api/admin', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api': '' }
}));

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} bulunamadı`
  });
});

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Gateway error', { error: err.message, path: req.path });
  res.status(500).json({
    success: false,
    errorCode: 'GATEWAY_ERROR',
    message: 'Gateway hatası'
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  logger.info('Service endpoints:', SERVICES);
});
