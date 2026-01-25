/**
 * Connection Factory
 * Centralized database connection creation for ETL operations
 */

import { createLogger, decrypt } from '@clixer/shared';

const logger = createLogger({ service: 'etl-worker' });

// ============================================
// TYPES
// ============================================

export interface DataConnection {
  id: string;
  type: 'postgresql' | 'mysql' | 'mssql';
  host: string;
  port?: number;
  database_name: string;
  username: string;
  password_encrypted: string;
  ssl_verify?: boolean;
}

export interface ConnectionResult<T> {
  client: T;
  close: () => Promise<void>;
}

// ============================================
// AZURE SQL DETECTION
// ============================================

/**
 * Check if MSSQL connection is Azure SQL Database
 */
export function isAzureSql(host: string): boolean {
  return host?.includes('.database.windows.net') || false;
}

// ============================================
// MSSQL CONNECTION
// ============================================

/**
 * Create MSSQL connection pool
 */
export async function createMssqlConnection(
  connection: DataConnection,
  options: { requestTimeout?: number } = {}
): Promise<ConnectionResult<any>> {
  const sql = require('mssql');
  const isAzure = isAzureSql(connection.host);
  
  const config = {
    user: connection.username,
    password: decrypt(connection.password_encrypted),
    server: connection.host,
    database: connection.database_name,
    port: connection.port || 1433,
    options: {
      encrypt: isAzure,
      trustServerCertificate: !isAzure
    },
    requestTimeout: options.requestTimeout || 600000 // 10 minutes default
  };
  
  const pool = await sql.connect(config);
  
  logger.debug('MSSQL connection created', { 
    host: connection.host, 
    database: connection.database_name,
    isAzure 
  });
  
  return {
    client: pool,
    close: async () => {
      await pool.close();
      logger.debug('MSSQL connection closed');
    }
  };
}

// ============================================
// POSTGRESQL CONNECTION
// ============================================

/**
 * Create PostgreSQL client connection
 */
export async function createPostgresConnection(
  connection: DataConnection
): Promise<ConnectionResult<any>> {
  const { Client } = require('pg');
  
  const client = new Client({
    host: connection.host,
    port: connection.port || 5432,
    database: connection.database_name,
    user: connection.username,
    password: decrypt(connection.password_encrypted)
  });
  
  await client.connect();
  
  logger.debug('PostgreSQL connection created', { 
    host: connection.host, 
    database: connection.database_name 
  });
  
  return {
    client,
    close: async () => {
      await client.end();
      logger.debug('PostgreSQL connection closed');
    }
  };
}

// ============================================
// MYSQL CONNECTION
// ============================================

/**
 * Create MySQL connection
 */
export async function createMysqlConnection(
  connection: DataConnection
): Promise<ConnectionResult<any>> {
  const mysql = require('mysql2/promise');
  
  const conn = await mysql.createConnection({
    host: connection.host,
    port: connection.port || 3306,
    database: connection.database_name,
    user: connection.username,
    password: decrypt(connection.password_encrypted),
    charset: 'utf8mb4',
    dateStrings: true
  });
  
  logger.debug('MySQL connection created', { 
    host: connection.host, 
    database: connection.database_name 
  });
  
  return {
    client: conn,
    close: async () => {
      await conn.end();
      logger.debug('MySQL connection closed');
    }
  };
}

// ============================================
// GENERIC CONNECTION FACTORY
// ============================================

/**
 * Create database connection based on type
 */
export async function createDbConnection(
  connection: DataConnection,
  options: { requestTimeout?: number } = {}
): Promise<ConnectionResult<any>> {
  switch (connection.type) {
    case 'mssql':
      return createMssqlConnection(connection, options);
    case 'postgresql':
      return createPostgresConnection(connection);
    case 'mysql':
      return createMysqlConnection(connection);
    default:
      throw new Error(`Unsupported database type: ${connection.type}`);
  }
}

/**
 * Execute query on any database type
 * Returns rows array
 */
export async function executeQuery(
  connection: DataConnection,
  query: string
): Promise<any[]> {
  const { client, close } = await createDbConnection(connection);
  
  try {
    let rows: any[];
    
    switch (connection.type) {
      case 'mssql': {
        const result = await client.request().query(query);
        rows = result.recordset;
        break;
      }
      case 'postgresql': {
        const result = await client.query(query);
        rows = result.rows;
        break;
      }
      case 'mysql': {
        const [result] = await client.query(query);
        rows = result as any[];
        break;
      }
      default:
        throw new Error(`Unsupported database type: ${connection.type}`);
    }
    
    return rows;
  } finally {
    await close();
  }
}
