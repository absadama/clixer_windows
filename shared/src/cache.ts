/**
 * Clixer - Redis Cache & Pub/Sub
 * Multi-level caching stratejisi
 */

import Redis from 'ioredis';
import createLogger from './logger';

const logger = createLogger({ service: 'cache' });

let redis: Redis | null = null;
let subscriber: Redis | null = null;

export interface CacheConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Redis client oluştur
 */
export function createRedisClient(config?: CacheConfig): Redis {
  if (redis) return redis;

  const redisConfig = {
    host: config?.host || process.env.REDIS_HOST || 'localhost',
    port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
    password: config?.password || process.env.REDIS_PASSWORD,
    db: config?.db || 0,
    keyPrefix: config?.keyPrefix || 'clixer:',
    retryStrategy: (times: number) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3
  };

  redis = new Redis(redisConfig);

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (err) => {
    logger.error('Redis error', { error: err.message });
  });

  return redis;
}

/**
 * Client'ı al
 */
export function getClient(): Redis {
  if (!redis) {
    redis = createRedisClient();
  }
  return redis;
}

// ============================================
// CACHE OPERATIONS
// ============================================

/**
 * Cache'e yaz
 */
export async function set(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<void> {
  const client = getClient();
  const serialized = JSON.stringify(value);

  if (ttlSeconds) {
    await client.setex(key, ttlSeconds, serialized);
  } else {
    await client.set(key, serialized);
  }
}

/**
 * Cache'ten oku
 */
export async function get<T = any>(key: string): Promise<T | null> {
  const client = getClient();
  const value = await client.get(key);

  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

/**
 * Cache'ten sil
 * NOT: keyPrefix otomatik olarak eklenir, pattern'e dahil etmeyin
 */
export async function del(pattern: string): Promise<number> {
  const client = getClient();
  const keyPrefix = 'clixer:'; // keyPrefix ile eşleşmeli

  if (pattern.includes('*')) {
    // Pattern ile sil - keyPrefix'i dahil et
    const fullPattern = keyPrefix + pattern;
    const keys = await client.keys(fullPattern);
    if (keys.length === 0) {
      logger.debug('No keys found for pattern', { pattern: fullPattern });
      return 0;
    }
    // keyPrefix'siz key'leri sil (ioredis del komutunda prefix otomatik eklenir)
    const keysWithoutPrefix = keys.map(k => k.replace(keyPrefix, ''));
    const deleted = await client.del(...keysWithoutPrefix);
    logger.debug('Deleted keys', { pattern: fullPattern, count: deleted });
    return deleted;
  }

  return await client.del(pattern);
}

/**
 * Set if Not eXists (SETNX) - Lock mekanizması için
 * @returns true eğer key oluşturulduysa, false eğer zaten varsa
 */
export async function setNX(
  key: string,
  value: any,
  ttlSeconds?: number
): Promise<boolean> {
  const client = getClient();
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);

  if (ttlSeconds) {
    // SET key value EX ttl NX - sadece key yoksa set et, TTL ile
    const result = await client.set(key, serialized, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  } else {
    // SETNX key value - sadece key yoksa set et
    const result = await client.setnx(key, serialized);
    return result === 1;
  }
}

/**
 * Cache-aside pattern
 */
export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const cached = await get<T>(key);
  if (cached !== null) {
    logger.debug('Cache hit', { key });
    return cached;
  }

  logger.debug('Cache miss', { key });
  const value = await factory();
  await set(key, value, ttlSeconds);
  return value;
}

// ============================================
// PUB/SUB OPERATIONS
// ============================================

/**
 * Subscriber client oluştur
 */
export function getSubscriber(): Redis {
  if (!subscriber) {
    subscriber = getClient().duplicate();
  }
  return subscriber;
}

/**
 * Channel'a mesaj yayınla
 */
export async function publish(channel: string, message: any): Promise<number> {
  const client = getClient();
  const serialized = typeof message === 'string' ? message : JSON.stringify(message);
  return await client.publish(channel, serialized);
}

/**
 * Channel'ı dinle
 */
export function subscribe(
  channel: string,
  callback: (message: any, channel: string) => void
): void {
  const sub = getSubscriber();

  sub.subscribe(channel, (err) => {
    if (err) {
      logger.error('Subscribe error', { channel, error: err.message });
    } else {
      logger.info('Subscribed to channel', { channel });
    }
  });

  sub.on('message', (ch, msg) => {
    if (ch === channel || channel === '*') {
      try {
        const parsed = JSON.parse(msg);
        callback(parsed, ch);
      } catch {
        callback(msg, ch);
      }
    }
  });
}

// ============================================
// UTILITY
// ============================================

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const client = getClient();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Client'ları kapat
 */
export async function closeClients(): Promise<void> {
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  if (redis) {
    await redis.quit();
    redis = null;
  }
  logger.info('Redis clients closed');
}

/**
 * Cache invalidation event yayınla
 */
export async function invalidate(pattern: string, source?: string): Promise<void> {
  const deleted = await del(pattern);
  await publish('cache:invalidated', { pattern, deleted, source, timestamp: Date.now() });
  logger.info('Cache invalidated', { pattern, deleted });
}

// ============================================
// USER BLACKLIST (Token Invalidation)
// ============================================
// SECURITY: Kullanıcı silindiğinde/pasife alındığında
// mevcut token'ları anında geçersiz kılmak için

const BLACKLIST_PREFIX = 'user:blacklist:';
const BLACKLIST_TTL = 7 * 24 * 60 * 60; // 7 gün (refresh token süresi kadar)

/**
 * Kullanıcıyı blacklist'e ekle
 * Token'ları anında geçersiz olur
 */
export async function blacklistUser(userId: string, reason: string = 'deactivated'): Promise<void> {
  const client = getClient();
  const key = BLACKLIST_PREFIX + userId;
  await client.setex(key, BLACKLIST_TTL, JSON.stringify({
    reason,
    timestamp: Date.now()
  }));
  logger.info('User blacklisted', { userId, reason });
  
  // Pub/Sub ile diğer servislere bildir
  await publish('user:blacklisted', { userId, reason, timestamp: Date.now() });
}

/**
 * Kullanıcının blacklist'te olup olmadığını kontrol et
 * @returns true ise kullanıcı bloke, false ise aktif
 */
export async function isUserBlacklisted(userId: string): Promise<boolean> {
  const client = getClient();
  const key = BLACKLIST_PREFIX + userId;
  const exists = await client.exists(key);
  return exists === 1;
}

/**
 * Kullanıcıyı blacklist'ten kaldır (tekrar aktif etmek için)
 */
export async function removeFromBlacklist(userId: string): Promise<void> {
  const client = getClient();
  const key = BLACKLIST_PREFIX + userId;
  await client.del(key);
  logger.info('User removed from blacklist', { userId });
}

/**
 * Birden fazla kullanıcıyı blacklist'e ekle
 */
export async function blacklistUsers(userIds: string[], reason: string = 'bulk_deactivated'): Promise<void> {
  const client = getClient();
  const pipeline = client.pipeline();
  
  for (const userId of userIds) {
    const key = BLACKLIST_PREFIX + userId;
    pipeline.setex(key, BLACKLIST_TTL, JSON.stringify({ reason, timestamp: Date.now() }));
  }
  
  await pipeline.exec();
  logger.info('Users blacklisted', { count: userIds.length, reason });
}

export default {
  createRedisClient,
  getClient,
  set,
  setNX,
  get,
  del,
  getOrSet,
  publish,
  subscribe,
  checkHealth,
  closeClients,
  invalidate,
  // User blacklist
  blacklistUser,
  isUserBlacklisted,
  removeFromBlacklist,
  blacklistUsers
};
