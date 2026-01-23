/**
 * Clixer - PostgreSQL Database Helper
 * Connection pooling ve query helpers
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { DatabaseError } from './errors';
import createLogger from './logger';

const logger = createLogger({ service: 'db' });

let pool: Pool | null = null;

export interface DbConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  max?: number; // Max connections
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

// Production'da POSTGRES_PASSWORD zorunlu
const isProduction = process.env.NODE_ENV === 'production';

function getRequiredEnvVar(name: string, devDefault?: string): string {
  const value = process.env[name];
  if (!value && isProduction) {
    logger.error(`CRITICAL: ${name} environment variable is required in production!`);
    throw new Error(`${name} environment variable is required in production`);
  }
  if (!value && devDefault) {
    logger.warn(`${name} not set, using development fallback. DO NOT use in production!`);
    return devDefault;
  }
  return value || devDefault || '';
}

/**
 * PostgreSQL connection pool oluştur
 */
export function createPool(config?: DbConfig): Pool {
  if (pool) return pool;

  const dbConfig: DbConfig = {
    connectionString: config?.connectionString || process.env.DATABASE_URL,
    host: config?.host || process.env.POSTGRES_HOST || '127.0.0.1',
    port: config?.port || parseInt(process.env.POSTGRES_PORT || '5432'),
    database: config?.database || process.env.POSTGRES_DB || 'clixer',
    user: config?.user || process.env.POSTGRES_USER || 'clixer',
    password: config?.password || getRequiredEnvVar('POSTGRES_PASSWORD', 'clixer_dev_password'),
    max: config?.max || 50,  // 400+ kullanıcı desteği için artırıldı
    idleTimeoutMillis: config?.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: config?.connectionTimeoutMillis || 5000
  };

  pool = new Pool(dbConfig);

  pool.on('connect', () => {
    logger.debug('New client connected to PostgreSQL');
  });

  pool.on('error', (err) => {
    logger.error('Unexpected PostgreSQL error', { error: err.message });
  });

  return pool;
}

/**
 * Pool'u al (lazy initialization)
 */
export function getPool(): Pool {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

/**
 * Query çalıştır
 */
export async function query<T extends Record<string, any> = any>(
  sql: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const client = getPool();
  try {
    const start = Date.now();
    const result = await client.query(sql, params);
    const duration = Date.now() - start;

    if (duration > 1000) {
      logger.warn('Slow query detected', { sql: sql.substring(0, 100), duration: `${duration}ms` });
    }

    return result;
  } catch (error: any) {
    logger.error('Query error', { sql: sql.substring(0, 100), error: error.message });
    throw new DatabaseError(error.message);
  }
}

/**
 * Tek satır döndür
 */
export async function queryOne<T extends Record<string, any> = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

/**
 * Tüm satırları döndür
 */
export async function queryAll<T extends Record<string, any> = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(sql, params);
  return result.rows;
}

/**
 * Transaction wrapper
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Health check
 */
export async function checkHealth(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Pool'u kapat
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('PostgreSQL pool closed');
  }
}

export default {
  createPool,
  getPool,
  query,
  queryOne,
  queryAll,
  withTransaction,
  checkHealth,
  closePool
};
