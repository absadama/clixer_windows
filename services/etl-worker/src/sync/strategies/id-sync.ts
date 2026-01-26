/**
 * ID-based Sync Strategy
 * Incremental sync using auto-increment ID column
 */

import { 
  logger, 
  db, 
  clickhouse, 
  cache,
  ensureTableExists, 
  extractTableFromQuery,
  transformBatchForClickHouse,
  decrypt
} from '../shared';

// Forward declaration
let fullRefresh: any;

export function injectDependencies(deps: { fullRefresh: any }) {
  fullRefresh = deps.fullRefresh;
}

export async function syncById(dataset: any, connection: any, jobId?: string): Promise<number> {
  await ensureTableExists(dataset);
  
  const { clickhouse_table, source_table, source_query, reference_column, row_limit } = dataset;
  
  if (!reference_column) {
    logger.warn('No reference column for ID-based sync, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }
  
  const sourceTableName = source_table || (source_query ? extractTableFromQuery(source_query) : null);
  if (!sourceTableName) {
    logger.warn('No source table or query for ID-based sync, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }
  
  logger.info('ID-Based incremental sync starting', { 
    datasetId: dataset.id, 
    table: clickhouse_table,
    sourceTable: sourceTableName,
    referenceColumn: reference_column
  });
  
  try {
    let maxId = 0;
    try {
      const maxResult = await clickhouse.queryOne(`
        SELECT max(toInt64OrZero(toString(${reference_column}))) as max_id FROM clixer_analytics.${clickhouse_table}
      `);
      maxId = parseInt(maxResult?.max_id || '0') || 0;
      logger.info('Current max ID in ClickHouse (converted to Int64)', { maxId, table: clickhouse_table });
    } catch (e: any) {
      logger.warn('Could not get max ID, will fetch all', { error: e.message });
    }
    
    const limit = parseInt(String(row_limit)) || 10000000;
    let totalInserted = 0;
    
    if (connection.type === 'mssql') {
      const sql = require('mssql');
      const isAzure = connection.host?.includes('.database.windows.net');
      
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
        requestTimeout: 600000
      };
      
      const pool = await sql.connect(config);
      
      const BATCH_SIZE = 5000;
      let currentMaxId = maxId;
      let lastFetchedId = maxId;
      let hasMoreData = true;
      
      logger.info('MSSQL ID-based sync with cursor starting', { 
        startMaxId: maxId, 
        batchSize: BATCH_SIZE,
        rowLimit: limit 
      });
      
      while (hasMoreData && (limit === null || totalInserted < limit)) {
        const remainingLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
        const query = `SELECT TOP ${remainingLimit} * FROM ${sourceTableName} WHERE ${reference_column} > ${currentMaxId} ORDER BY ${reference_column}`;
        
        const result = await pool.request().query(query);
        const rows = result.recordset;
        
        if (rows.length === 0) {
          hasMoreData = false;
          break;
        }
        
        const transformedBatch = transformBatchForClickHouse(rows);
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedBatch);
        totalInserted += rows.length;
        
        lastFetchedId = rows[rows.length - 1][reference_column];
        currentMaxId = lastFetchedId;
        
        if (jobId) {
          await db.query(`UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`, [totalInserted, jobId]);
        }
        
        logger.info('MSSQL cursor batch inserted', { batchSize: rows.length, totalInserted, currentMaxId });
        
        if (limit && totalInserted >= limit) {
          hasMoreData = false;
        }
      }
      
      await pool.close();
      
      if (totalInserted > 0) {
        await db.query(
          `UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2`,
          [String(lastFetchedId), dataset.id]
        );
      }
      
    } else if (connection.type === 'mysql') {
      const mysql = require('mysql2/promise');
      
      const conn = await mysql.createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        database: connection.database_name,
        charset: 'utf8mb4',
        dateStrings: true
      });
      
      const BATCH_SIZE = 5000;
      let currentMaxId: number = parseInt(String(maxId)) || 0;
      let lastFetchedId: number = currentMaxId;
      let hasMoreData = true;
      
      while (hasMoreData && totalInserted < limit) {
        const remainingLimit: number = Math.min(BATCH_SIZE, limit - totalInserted);
        const query = `SELECT * FROM ${sourceTableName} WHERE ${reference_column} > ${currentMaxId} ORDER BY ${reference_column} LIMIT ${remainingLimit}`;
        const [rows] = await conn.query(query);
        
        if ((rows as any[]).length === 0) {
          hasMoreData = false;
          break;
        }
        
        const transformedBatch = transformBatchForClickHouse(rows as any[]);
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedBatch);
        totalInserted += (rows as any[]).length;
        
        lastFetchedId = parseInt(String((rows as any[])[(rows as any[]).length - 1][reference_column])) || 0;
        currentMaxId = lastFetchedId;
        
        if (jobId) {
          await db.query(`UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`, [totalInserted, jobId]);
        }
        
        if (limit && totalInserted >= limit) {
          hasMoreData = false;
        }
      }
      
      await conn.end();
      
      if (totalInserted > 0) {
        await db.query(
          `UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2`,
          [String(lastFetchedId), dataset.id]
        );
      }
      
    } else if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        user: connection.username,
        password: decrypt(connection.password_encrypted),
        database: connection.database_name
      });
      
      await client.connect();
      
      const BATCH_SIZE = 5000;
      let currentMaxId = maxId;
      let lastFetchedId = maxId;
      let hasMoreData = true;
      
      while (hasMoreData && (limit === null || totalInserted < limit)) {
        const remainingLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
        const query = `SELECT * FROM ${sourceTableName} WHERE ${reference_column} > $1 ORDER BY ${reference_column} LIMIT $2`;
        const result = await client.query(query, [currentMaxId, remainingLimit]);
        
        if (result.rows.length === 0) {
          hasMoreData = false;
          break;
        }
        
        const transformedBatch = transformBatchForClickHouse(result.rows);
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedBatch);
        totalInserted += result.rows.length;
        
        lastFetchedId = result.rows[result.rows.length - 1][reference_column];
        currentMaxId = lastFetchedId;
        
        if (jobId) {
          await db.query(`UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`, [totalInserted, jobId]);
        }
        
        if (limit && totalInserted >= limit) {
          hasMoreData = false;
        }
      }
      
      await client.end();
      
      if (totalInserted > 0) {
        await db.query(
          `UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2`,
          [String(lastFetchedId), dataset.id]
        );
      }
    }
    
    // Job complete - error_message'ı temizle
    if (jobId) {
      await db.query(
        `UPDATE etl_jobs SET status = 'completed', completed_at = NOW(), rows_processed = $1, error_message = NULL WHERE id = $2`,
        [totalInserted, jobId]
      );
    }
    
    await cache.del(`kpi:${clickhouse_table}:*`);
    
    logger.info('ID-Based incremental sync completed', { 
      datasetId: dataset.id, 
      totalInserted,
      previousMaxId: maxId
    });
    
    return totalInserted;
    
  } catch (error: any) {
    logger.error('ID-Based sync failed', { error: error.message, datasetId: dataset.id });
    throw error;
  }
}
