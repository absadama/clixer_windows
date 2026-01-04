/**
 * Clixer - ClickHouse Client
 * Analitik sorgular için
 */

import { createClient, ClickHouseClient } from '@clickhouse/client';
import createLogger from './logger';
import { ExternalServiceError } from './errors';

const logger = createLogger({ service: 'clickhouse' });

let client: ClickHouseClient | null = null;

export interface ClickHouseConfig {
  url?: string;
  username?: string;
  password?: string;
  database?: string;
  request_timeout?: number;
}

export interface QueryOptions {
  timeout?: number;  // Query timeout in milliseconds (default: 10000)
}

/**
 * ClickHouse client oluştur
 */
export function createClickHouseClient(config?: ClickHouseConfig): ClickHouseClient {
  if (client) return client;

  const chConfig = {
    url: config?.url || process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: config?.username || process.env.CLICKHOUSE_USER || 'clixer',
    password: config?.password || process.env.CLICKHOUSE_PASSWORD || '',
    database: config?.database || process.env.CLICKHOUSE_DB || 'clixer_analytics',
    request_timeout: config?.request_timeout || 30000
  };

  client = createClient(chConfig);
  logger.info('ClickHouse client created', { url: chConfig.url, database: chConfig.database });

  return client;
}

/**
 * Client'ı al
 */
export function getClient(): ClickHouseClient {
  if (!client) {
    client = createClickHouseClient();
  }
  return client;
}

/**
 * Query çalıştır
 * @param sql - SQL sorgusu
 * @param options - Query options (timeout, vb.)
 * @returns Query sonuçları
 */
export async function query<T = any>(sql: string, options?: QueryOptions): Promise<T[]> {
  const ch = getClient();
  const timeout = options?.timeout || 10000; // Default 10 saniye timeout
  
  try {
    const start = Date.now();
    
    // AbortController ile timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const result = await ch.query({ 
      query: sql, 
      format: 'JSONEachRow',
      abort_signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    const data = await result.json() as T[];
    const duration = Date.now() - start;

    if (duration > 2000) {
      logger.warn('Slow ClickHouse query', { sql: sql.substring(0, 100), duration: `${duration}ms` });
    }

    return data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      logger.error('ClickHouse query timeout', { sql: sql.substring(0, 100), timeout: `${timeout}ms` });
      throw new ExternalServiceError('ClickHouse', `Query timeout after ${timeout}ms`);
    }
    logger.error('ClickHouse query error', { sql: sql.substring(0, 100), error: error.message });
    throw new ExternalServiceError('ClickHouse', error.message);
  }
}

/**
 * Insert data
 */
export async function insert<T extends Record<string, any>>(
  table: string,
  values: T[]
): Promise<void> {
  if (values.length === 0) return;

  const ch = getClient();
  try {
    await ch.insert({
      table,
      values,
      format: 'JSONEachRow'
    });
    logger.debug(`Inserted ${values.length} rows to ${table}`);
  } catch (error: any) {
    logger.error('ClickHouse insert error', { table, error: error.message });
    throw new ExternalServiceError('ClickHouse', error.message);
  }
}

/**
 * Query tek satır döndür (ilk satır veya null)
 * @param sql - SQL sorgusu
 * @param options - Query options (timeout, vb.)
 * @returns İlk satır veya null
 */
export async function queryOne<T = any>(sql: string, options?: QueryOptions): Promise<T | null> {
  const results = await query<T>(sql, options);
  return results.length > 0 ? results[0] : null;
}

/**
 * Execute command (CREATE, ALTER, DROP)
 */
export async function execute(sql: string): Promise<void> {
  const ch = getClient();
  try {
    await ch.command({ query: sql });
    logger.info('ClickHouse command executed', { sql: sql.substring(0, 100) });
  } catch (error: any) {
    logger.error('ClickHouse command error', { sql: sql.substring(0, 100), error: error.message });
    throw new ExternalServiceError('ClickHouse', error.message);
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
 * Client'ı kapat
 */
export async function closeClient(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    logger.info('ClickHouse client closed');
  }
}

export default {
  createClickHouseClient,
  getClient,
  query,
  queryOne,
  insert,
  execute,
  checkHealth,
  closeClient
};
