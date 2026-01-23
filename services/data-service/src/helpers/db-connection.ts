/**
 * Database Connection Helper
 * Centralized connection configuration and factory for data-service
 */

import { createLogger } from '@clixer/shared';

const logger = createLogger({ service: 'data-service' });

// ============================================
// TYPES
// ============================================

export interface DataConnection {
  id?: string;
  type: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port?: number;
  database_name: string;
  username: string;
  password_encrypted: string;
}

export interface ConnectionConfig {
  postgresql?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  };
  mssql?: {
    server: string;
    port: number;
    database: string;
    user: string;
    password: string;
    options: {
      encrypt: boolean;
      trustServerCertificate: boolean;
    };
    connectionTimeout?: number;
    requestTimeout?: number;
  };
  mysql?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    charset: string;
    dateStrings: boolean;
  };
}

// ============================================
// AZURE SQL DETECTION
// ============================================

/**
 * Check if host is Azure SQL Database
 */
export function isAzureSql(host: string): boolean {
  return host?.includes('.database.windows.net') || false;
}

// ============================================
// CONNECTION CONFIGURATION
// ============================================

/**
 * Get connection configuration for database type
 */
export function getConnectionConfig(connection: DataConnection): ConnectionConfig {
  const config: ConnectionConfig = {};
  
  switch (connection.type) {
    case 'postgresql':
      config.postgresql = {
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted
      };
      break;
      
    case 'mssql': {
      const isAzure = isAzureSql(connection.host);
      config.mssql = {
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted,
        options: {
          encrypt: isAzure,
          trustServerCertificate: !isAzure
        },
        connectionTimeout: 15000
      };
      break;
    }
      
    case 'mysql':
      config.mysql = {
        host: connection.host,
        port: connection.port || 3306,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted,
        charset: 'utf8mb4',
        dateStrings: true
      };
      break;
  }
  
  return config;
}

// ============================================
// CONNECTION FACTORY
// ============================================

/**
 * Create PostgreSQL client
 */
export async function createPostgresClient(connection: DataConnection): Promise<any> {
  const { Client } = require('pg');
  const config = getConnectionConfig(connection).postgresql;
  const client = new Client(config);
  await client.connect();
  logger.debug('PostgreSQL client created', { host: connection.host });
  return client;
}

/**
 * Create MSSQL pool
 */
export async function createMssqlPool(
  connection: DataConnection, 
  options?: { requestTimeout?: number }
): Promise<any> {
  const sql = require('mssql');
  const config = {
    ...getConnectionConfig(connection).mssql,
    ...(options?.requestTimeout && { requestTimeout: options.requestTimeout })
  };
  const pool = await sql.connect(config);
  logger.debug('MSSQL pool created', { host: connection.host });
  return pool;
}

/**
 * Create MySQL connection
 */
export async function createMysqlConnection(connection: DataConnection): Promise<any> {
  const mysql = require('mysql2/promise');
  const config = getConnectionConfig(connection).mysql;
  const conn = await mysql.createConnection(config);
  logger.debug('MySQL connection created', { host: connection.host });
  return conn;
}

// ============================================
// DATE FORMATTING
// ============================================

/**
 * Format date for specific database type
 */
export function formatDateForDb(date: Date, dbType: string): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  
  switch (dbType) {
    case 'postgresql':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    case 'mssql':
      return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
    case 'mysql':
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    default:
      return date.toISOString();
  }
}

// ============================================
// TEST CONNECTION
// ============================================

/**
 * Test database connection
 */
export async function testConnection(
  connection: DataConnection
): Promise<{ success: boolean; message: string }> {
  try {
    switch (connection.type) {
      case 'postgresql': {
        const client = await createPostgresClient(connection);
        await client.query('SELECT 1');
        await client.end();
        return { success: true, message: 'PostgreSQL bağlantısı başarılı' };
      }
      
      case 'mssql': {
        const pool = await createMssqlPool(connection);
        await pool.request().query('SELECT 1');
        await pool.close();
        return { success: true, message: 'MSSQL bağlantısı başarılı' };
      }
      
      case 'mysql': {
        const conn = await createMysqlConnection(connection);
        await conn.query('SELECT 1');
        await conn.end();
        return { success: true, message: 'MySQL bağlantısı başarılı' };
      }
      
      default:
        return { success: false, message: `Desteklenmeyen veritabanı tipi: ${connection.type}` };
    }
  } catch (error: any) {
    return { success: false, message: `Bağlantı hatası: ${error.message}` };
  }
}
