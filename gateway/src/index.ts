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

// ============================================
// TRUST PROXY CONFIGURATION
// ============================================
// Reverse proxy arkasında doğru IP tespiti için gerekli
// SECURITY: Rate limiting ve IP whitelist için kritik
const isProduction = process.env.NODE_ENV === 'production';
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', true);
} else if (isProduction) {
  // Production'da varsayılan olarak 1 hop (nginx/load balancer)
  app.set('trust proxy', 1);
}

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

// Helmet.js - HTTP güvenlik başlıkları (Production-grade)
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
      frameSrc: ["'none'"],
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
    }
  },
  crossOriginEmbedderPolicy: false,  // API için gerekli
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: {
    maxAge: 31536000,  // 1 yıl
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xContentTypeOptions: true,  // X-Content-Type-Options: nosniff
  xFrameOptions: { action: "deny" },  // Clickjacking koruması
  xXssProtection: true  // XSS koruması (legacy browsers)
}));

// Ek güvenlik başlıkları
app.use((req, res, next) => {
  // Cache-Control for API responses
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  // Permissions-Policy (eski Feature-Policy)
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

// CORS - Production'da ZORUNLU whitelist, development'ta localhost
const corsOrigins = (() => {
  const isProduction = process.env.NODE_ENV === 'production';
  const envOrigin = process.env.CORS_ORIGIN;
  
  // Production'da CORS_ORIGIN zorunlu ve * olamaz
  if (isProduction) {
    if (!envOrigin) {
      console.error('CRITICAL: CORS_ORIGIN must be set in production!');
      throw new Error('CORS_ORIGIN environment variable is required in production');
    }
    if (envOrigin === '*') {
      console.error('CRITICAL: CORS_ORIGIN cannot be * in production!');
      throw new Error('CORS_ORIGIN cannot be wildcard (*) in production');
    }
    return envOrigin.split(',').map(o => o.trim());
  }
  
  // Development'ta izin verilen originler
  if (envOrigin && envOrigin !== '*') {
    return envOrigin.split(',').map(o => o.trim());
  }
  
  // Development default - localhost
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
})();

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
// SECURITY FIX: x-user-id header kaldırıldı - client tarafından manipüle edilebilirdi
// Sadece IP kullanılıyor, reverse proxy arkasında x-forwarded-for destekleniyor
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: process.env.NODE_ENV === 'development' ? 500 : 300, // Dev'de 500, prod'da 300 (UX iyileştirme)
  message: { 
    success: false, 
    errorCode: 'RATE_LIMIT', 
    message: 'Çok fazla istek. Lütfen 1 dakika bekleyin.' 
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Sadece IP kullan - x-forwarded-for reverse proxy için
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = forwardedFor 
      ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
      : req.ip;
    return clientIp || req.ip || 'unknown';
  }
});

// Analytics için daha kısıtlı limit (ağır sorgular)
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100, // Dakikada 100 analytics sorgusu (dashboard yoğun kullanım için artırıldı)
  message: { 
    success: false, 
    errorCode: 'RATE_LIMIT_ANALYTICS', 
    message: 'Çok fazla analitik sorgusu. Lütfen bekleyin.' 
  }
});

// Per-user rate limiting (IP + JWT user combined)
// Enterprise: Her kullanıcı için ayrı limit
const createUserAwareLimiter = (maxRequests: number) => rateLimit({
  windowMs: 60 * 1000,
  max: maxRequests,
  message: { 
    success: false, 
    errorCode: 'USER_RATE_LIMIT', 
    message: `Kullanıcı limiti aşıldı. Dakikada ${maxRequests} istek hakkınız var.` 
  },
  keyGenerator: (req) => {
    // Try to extract user from JWT (if present)
    const authHeader = req.headers.authorization;
    let userId = 'anonymous';
    
    if (authHeader?.startsWith('Bearer ')) {
      try {
        // Decode JWT without verification (just for rate limit key)
        const token = authHeader.substring(7);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = payload.userId || payload.sub || 'unknown';
      } catch {
        // Invalid token, use IP
      }
    }
    
    // Combine IP + userId for unique rate limit key
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = forwardedFor 
      ? (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor.split(',')[0].trim())
      : req.ip || 'unknown';
    
    return `${clientIp}:${userId}`;
  }
});

// Heavy operations limiter (exports, bulk operations)
const heavyOperationsLimiter = createUserAwareLimiter(10); // 10 per minute

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
  
  // SECURITY NOTE: Gateway proxy olduğu için body parse edilmez (downstream servislere iletilir)
  // Body içindeki injection'lar downstream servislerde kontrol edilir
  // Burada sadece URL ve query string kontrol edilir
  const checkTarget = req.originalUrl;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(checkTarget)) {
      logger.warn('Suspicious request blocked', {
        ip: req.ip,
        method: req.method,
        url: req.path, // Sadece path logla, query string sensitive bilgi içerebilir
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
    // SECURITY: Internal target URL'leri logda ifşa etme
    logger.error(`Proxy error: ${err.message}`, { path: req.url });
    (res as Response).status(502).json({
      success: false,
      errorCode: 'PROXY_ERROR',
      message: 'Servis geçici olarak kullanılamıyor'
    });
  }
});

// ============================================
// API VERSIONING
// ============================================

// Current API version
const API_VERSION = 'v1';

// Version middleware - /api/v1/* yollarını /api/* olarak yönlendir
app.use('/api/v1', (req: Request, res: Response, next: NextFunction) => {
  // Add version header
  res.setHeader('X-API-Version', API_VERSION);
  next();
});

// Rewrite /api/v1/* to /api/*
app.use('/api/v1', (req, res, next) => {
  req.url = req.url; // URL zaten /api/v1 prefix'i kaldırılmış olarak gelir
  next('route');
});

// ============================================
// ROUTES
// ============================================

// API version info
app.get('/api/version', (req: Request, res: Response) => {
  res.json({
    version: API_VERSION,
    supported: ['v1'],
    deprecated: [],
    current: 'v1'
  });
});

// Gateway health
// SECURITY: Internal service URLs ifşa edilmemeli
app.get(['/health', '/api/health', '/api/v1/health'], (req: Request, res: Response) => {
  res.json({
    service: 'gateway',
    status: 'healthy',
    version: API_VERSION,
    timestamp: new Date().toISOString()
  });
});

// Auth routes (brute-force korumalı)
app.use(['/api/auth', '/api/v1/auth'], authLimiter, createProxyMiddleware({
  ...proxyOptions(SERVICES.AUTH),
  pathRewrite: { '^/api/v1/auth': '', '^/api/auth': '' }
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
    // SECURITY: Production'da DB_PASSWORD zorunlu
    const dbPassword = process.env.DB_PASSWORD;
    if (!dbPassword && process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: DB_PASSWORD environment variable is required in production');
      // SECURITY FIX: Fail-closed - tüm admin erişimini engelle
      return [];
    }
    
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'clixer',
      user: process.env.DB_USER || 'clixer',
      password: dbPassword || (process.env.NODE_ENV !== 'production' ? 'clixer_dev_password' : '')
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
    // SECURITY FIX: Fail-closed in production - veritabanı hatası durumunda admin erişimini engelle
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
  }
  
  // Development'ta varsayılan: Tümüne izin ver (test kolaylığı)
  // Production'da DB ayarı yoksa tümüne izin ver (IP whitelist özelliği kullanılmıyor)
  return ['*'];
}

function getClientIP(req: Request): string {
  // SECURITY FIX: Express'in trust proxy ayarına güven, header'ı manuel parse etme
  // req.ip zaten trust proxy ayarına göre doğru IP'yi döner
  return req.ip || req.socket.remoteAddress || '';
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

// Manifest.json route (PUBLIC - Auth gerektirmez, PWA için)
app.get('/manifest.json', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/manifest.json': '/manifest.json' }
}));

// Logo info route (Admin Panel için)
app.use('/api/core/logo-info', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

// Logo upload route (Admin Panel için)
app.use('/api/core/upload/logo', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

// Grid Designs route (IP whitelist gerektirmez - kullanıcı bazlı)
app.use('/api/core/grid-designs', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

// Search route (IP whitelist gerektirmez - tüm authenticated kullanıcılar için)
app.use('/api/core/search', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

// Navigation route (IP whitelist gerektirmez - search index için)
app.use('/api/core/navigation', createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

// User preferences route (IP whitelist gerektirmez - kullanıcı kendi tercihlerini güncelleyebilir)
// Pattern: /api/core/users/:id/preferences
app.use(/^\/api\/core\/users\/[^/]+\/preferences$/, createProxyMiddleware({
  ...proxyOptions(SERVICES.CORE),
  pathRewrite: { '^/api/core': '' }
}));

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

// Report Subscriptions routes (notification service)
app.use('/api/notification/subscriptions', createProxyMiddleware({
  ...proxyOptions(SERVICES.NOTIFICATION),
  pathRewrite: { '^/api/notification': '' }
}));

// Email Settings routes (notification service)
app.use('/api/notification/email-settings', createProxyMiddleware({
  ...proxyOptions(SERVICES.NOTIFICATION),
  pathRewrite: { '^/api/notification': '' }
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

const server = app.listen(PORT, () => {
  logger.info(`🚀 API Gateway running on port ${PORT}`);
  // SECURITY: Internal service URL'leri logda ifşa etme
  if (process.env.NODE_ENV !== 'production') {
    logger.info('Service endpoints configured (development mode)');
  }
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, starting graceful shutdown...`);
  
  server.close(() => {
    logger.info('HTTP server closed');
    logger.info('Graceful shutdown completed');
    process.exit(0);
  });
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
