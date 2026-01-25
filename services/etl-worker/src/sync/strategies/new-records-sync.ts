/**
 * New Records Sync Strategy
 * Fetches all records after max ID - most efficient for 100M+ tables
 */

import { 
  logger, 
  db, 
  clickhouse, 
  parseColumnMapping,
  transformBatchForClickHouse,
  decrypt
} from '../shared';

export async function syncNewRecordsAfterMaxId(
  dataset: any,
  connection: any,
  jobId: string,
  pkColumn: string = 'id',
  afterId: number = 0,
  limit?: number
): Promise<number> {
  const { clickhouse_table, source_query } = dataset;
  const BATCH_SIZE = 5000;
  
  let sourceTable = dataset.source_table;
  if (!sourceTable && source_query) {
    const match = source_query.match(/FROM\s+\[?(\w+)\]?\.\[?(\w+)\]?/i) ||
                  source_query.match(/FROM\s+\[?(\w+)\]?/i);
    if (match) {
      sourceTable = match[2] || match[1];
    }
  }
  
  if (!sourceTable) {
    throw new Error('Kaynak tablo adı bulunamadı');
  }
  
  logger.info('NEW RECORDS SYNC starting', { 
    datasetId: dataset.id, 
    pkColumn, 
    afterId,
    limit: limit || 'UNLIMITED',
    batchSize: BATCH_SIZE
  });
  
  const columnMapping = parseColumnMapping(dataset);
  
  let totalInserted = 0;
  let currentMaxId = afterId;
  let hasMore = true;
  let batchNum = 0;
  
  if (connection.type === 'mssql') {
    const mssql = require('mssql');
    // SECURITY FIX: decrypt() ile şifre çözümleme
    const connStr = connection.connection_string || 
      `Server=${connection.host},${connection.port || 1433};Database=${connection.database_name};User Id=${connection.username};Password=${decrypt(connection.password_encrypted)};Encrypt=${connection.host?.includes('.database.windows.net')};TrustServerCertificate=true;Connection Timeout=30;Request Timeout=120000`;
    
    const pool = await mssql.connect(connStr);
    
    const sourceMaxResult = await pool.request().query(`SELECT MAX([${pkColumn}]) as max_id FROM [${sourceTable}] WITH (NOLOCK)`);
    const sourceMaxId = sourceMaxResult.recordset[0]?.max_id || 0;
    const expectedTotal = Math.max(0, sourceMaxId - afterId);
    
    logger.info('Source max ID found', { sourceMaxId, afterId, expectedTotal });
    
    while (hasMore) {
      batchNum++;
      
      const remainingLimit = limit ? Math.max(0, limit - totalInserted) : BATCH_SIZE;
      const batchLimit = Math.min(BATCH_SIZE, remainingLimit);
      
      if (batchLimit === 0) {
        logger.info('Limit reached, stopping sync', { totalInserted, limit });
        break;
      }
      
      const query = `
        SELECT TOP ${batchLimit} * 
        FROM [${sourceTable}] WITH (NOLOCK) 
        WHERE [${pkColumn}] > ${currentMaxId} 
        ORDER BY [${pkColumn}] ASC
      `;
      
      const result = await pool.request().query(query);
      
      if (result.recordset.length === 0) {
        hasMore = false;
        break;
      }
      
      const localMapping = columnMapping.length > 0 ? columnMapping : [];
      if (localMapping.length === 0 && result.recordset.length > 0) {
        for (const key of Object.keys(result.recordset[0])) {
          const value = result.recordset[0][key];
          let clickhouseType = 'String';
          if (typeof value === 'number') {
            clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          } else if (value instanceof Date) {
            clickhouseType = 'DateTime';
          }
          localMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
        }
      }
      
      const transformedData = transformBatchForClickHouse(result.recordset, localMapping);
      await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
      totalInserted += result.recordset.length;
      
      currentMaxId = result.recordset[result.recordset.length - 1][pkColumn];
      
      const progress = expectedTotal > 0 ? Math.min(100, Math.round((totalInserted / expectedTotal) * 100)) : 0;
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [totalInserted, `Batch ${batchNum}: ${totalInserted} rows (${progress}%)`, jobId]
      );
      
      logger.info(`Batch ${batchNum} completed`, { 
        batchSize: result.recordset.length,
        totalSoFar: totalInserted,
        currentMaxId,
        progress: `${progress}%`
      });
      
      if (result.recordset.length < batchLimit) {
        hasMore = false;
      }
    }
    
    await pool.close();
  } else if (connection.type === 'postgresql') {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: connection.host,
      port: connection.port || 5432,
      database: connection.database_name,
      user: connection.username,
      password: decrypt(connection.password_encrypted),
      max: 5
    });
    
    while (hasMore) {
      batchNum++;
      const batchLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
      if (batchLimit <= 0) break;
      
      const query = `SELECT * FROM ${sourceTable} WHERE ${pkColumn} > $1 ORDER BY ${pkColumn} ASC LIMIT $2`;
      const result = await pool.query(query, [currentMaxId, batchLimit]);
      
      if (result.rows.length === 0) {
        hasMore = false;
        break;
      }
      
      const localMapping = columnMapping.length > 0 ? columnMapping : [];
      if (localMapping.length === 0 && result.rows.length > 0) {
        for (const key of Object.keys(result.rows[0])) {
          const value = result.rows[0][key];
          let clickhouseType = 'String';
          if (typeof value === 'number') clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          else if (value instanceof Date) clickhouseType = 'DateTime';
          localMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
        }
      }
      
      const transformedData = transformBatchForClickHouse(result.rows, localMapping);
      await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
      totalInserted += result.rows.length;
      currentMaxId = result.rows[result.rows.length - 1][pkColumn];
      
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [totalInserted, `Batch ${batchNum}: ${totalInserted} rows`, jobId]
      );
      
      if (result.rows.length < batchLimit) hasMore = false;
    }
    
    await pool.end();
  } else if (connection.type === 'mysql') {
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: connection.host,
      port: connection.port || 3306,
      database: connection.database_name,
      user: connection.username,
      password: decrypt(connection.password_encrypted),
      charset: 'utf8mb4'
    });
    
    while (hasMore) {
      batchNum++;
      const batchLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
      if (batchLimit <= 0) break;
      
      const query = `SELECT * FROM ${sourceTable} WHERE ${pkColumn} > ${currentMaxId} ORDER BY ${pkColumn} ASC LIMIT ${batchLimit}`;
      const [rows] = await conn.query(query);
      
      if (!rows || (rows as any[]).length === 0) {
        hasMore = false;
        break;
      }
      
      const rowsArray = rows as any[];
      const localMapping = columnMapping.length > 0 ? columnMapping : [];
      
      if (localMapping.length === 0 && rowsArray.length > 0) {
        for (const key of Object.keys(rowsArray[0])) {
          const value = rowsArray[0][key];
          let clickhouseType = 'String';
          if (typeof value === 'number') clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          else if (value instanceof Date) clickhouseType = 'DateTime';
          localMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
        }
      }
      
      const transformedData = transformBatchForClickHouse(rowsArray, localMapping);
      await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
      totalInserted += rowsArray.length;
      currentMaxId = rowsArray[rowsArray.length - 1][pkColumn];
      
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [totalInserted, `Batch ${batchNum}: ${totalInserted} rows`, jobId]
      );
      
      if (rowsArray.length < batchLimit) hasMore = false;
    }
    
    await conn.end();
  } else {
    throw new Error(`new_records_sync doesn't support ${connection.type} yet`);
  }
  
  if (totalInserted > 0 && totalInserted < 1000000) {
    try {
      await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
      logger.info('OPTIMIZE completed after new records sync');
    } catch (optErr: any) {
      logger.warn('OPTIMIZE skipped or failed', { error: optErr.message });
    }
  }
  
  logger.info('NEW RECORDS SYNC completed', { 
    datasetId: dataset.id, 
    totalInserted,
    batchesProcessed: batchNum,
    finalMaxId: currentMaxId
  });
  
  return totalInserted;
}
