/**
 * PostgreSQL Streaming Sync
 * Handles 200M+ rows with constant memory usage
 */

import { createLogger, db, clickhouse, decrypt } from '@clixer/shared';
import { 
  STREAM_BATCH_SIZE, 
  INSERT_BATCH_SIZE,
  truncateClickHouseTable,
  forceGC,
  toClickHouseDateTime
} from '../../helpers';

const logger = createLogger({ service: 'etl-worker' });

// Forward declarations
let isJobCancelled: any;

export function injectDependencies(deps: { isJobCancelled: any }) {
  isJobCancelled = deps.isJobCancelled;
}

export async function insertToClickHouse(tableName: string, columns: string[], rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  
  const values = rows.map(row => {
    const vals = columns.map((col: string) => {
      const val = row[col];
      
      if (val instanceof Date || (typeof val === 'string' && val.match(/\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4}/))) {
        const converted = toClickHouseDateTime(val);
        if (converted) return `'${converted}'`;
        return 'NULL';
      }
      
      if (typeof val === 'string') {
        return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
      } else if (val === null || val === undefined) {
        return 'NULL';
      }
      return val;
    });
    return `(${vals.join(', ')})`;
  }).join(',\n');
  
  const sql = `INSERT INTO clixer_analytics.${tableName} (${columns.join(', ')}) VALUES ${values}`;
  await clickhouse.execute(sql);
}

export async function streamingPostgreSQLSync(
  dataset: any, 
  connection: any, 
  columnMapping: any[],
  jobId?: string
): Promise<number> {
  const Cursor = require('pg-cursor');
  const { Client } = require('pg');
  
  const client = new Client({
    host: connection.host,
    port: connection.port || 5432,
    database: connection.database_name,
    user: connection.username,
    password: decrypt(connection.password_encrypted),
  });
  
  await client.connect();
  
  let query = dataset.source_query || `SELECT * FROM ${dataset.source_table}`;
  query = query.replace(/\s+LIMIT\s+\d+\s*/gi, ' ').trim();
  
  const customWhere = dataset.custom_where;
  if (customWhere && customWhere.trim()) {
    if (query.toUpperCase().includes(' WHERE ')) {
      query = `${query} AND (${customWhere})`;
    } else {
      query = `${query} WHERE ${customWhere}`;
    }
  }
  
  const rowLimit = dataset.row_limit || null;
  
  logger.info('STREAMING ETL starting', { 
    datasetId: dataset.id,
    table: dataset.clickhouse_table,
    rowLimit: rowLimit || 'UNLIMITED',
    streamBatchSize: STREAM_BATCH_SIZE
  });
  
  const cursor = client.query(new Cursor(query));
  
  let totalInserted = 0;
  let batchNumber = 0;
  let insertBuffer: any[] = [];
  let columns: string[] = [];
  
  await truncateClickHouseTable(dataset.clickhouse_table);
  
  const readBatch = (): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      cursor.read(STREAM_BATCH_SIZE, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  };
  
  try {
    while (true) {
      if (jobId && isJobCancelled && await isJobCancelled(jobId)) {
        logger.info('Job cancelled during streaming', { jobId, totalInserted });
        break;
      }
      
      const rows = await readBatch();
      
      if (rows.length === 0) break;
      
      batchNumber++;
      
      if (batchNumber === 1 && columnMapping.length === 0 && rows.length > 0) {
        const firstRow = rows[0];
        for (const key of Object.keys(firstRow)) {
          const value = firstRow[key];
          let clickhouseType = 'String';
          if (typeof value === 'number') {
            clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          } else if (typeof value === 'boolean') {
            clickhouseType = 'UInt8';
          }
          columnMapping.push({
            source: key,
            target: key.replace(/[^a-zA-Z0-9_]/g, '_'),
            clickhouseType
          });
        }
        columns = columnMapping.map((m: any) => m.target || m.targetName);
      }
      
      if (columns.length === 0) {
        columns = columnMapping.map((m: any) => m.target || m.targetName);
      }
      
      for (const row of rows) {
        const transformed: any = {};
        for (const mapping of columnMapping) {
          const sourceCol = mapping.source || mapping.sourceName;
          const targetCol = mapping.target || mapping.targetName;
          let value = row[sourceCol];
          
          if (value === null || value === undefined) {
            if (mapping.clickhouseType?.includes('Int') || mapping.clickhouseType?.includes('Decimal')) {
              value = 0;
            } else if (mapping.clickhouseType === 'Date') {
              value = '1970-01-01';
            } else {
              value = '';
            }
          }
          
          transformed[targetCol] = value;
        }
        insertBuffer.push(transformed);
        
        if (insertBuffer.length >= INSERT_BATCH_SIZE) {
          await insertToClickHouse(dataset.clickhouse_table, columns, insertBuffer);
          totalInserted += insertBuffer.length;
          insertBuffer = [];
          
          if (totalInserted % 50000 === 0) {
            const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            logger.info('Streaming progress', { 
              totalInserted: totalInserted.toLocaleString(),
              memoryMB: memMB
            });
            forceGC();
          }
        }
        
        if (rowLimit && totalInserted + insertBuffer.length >= rowLimit) break;
      }
      
      if (rowLimit && totalInserted + insertBuffer.length >= rowLimit) break;
    }
    
    if (insertBuffer.length > 0) {
      await insertToClickHouse(dataset.clickhouse_table, columns, insertBuffer);
      totalInserted += insertBuffer.length;
    }
    
  } finally {
    await new Promise<void>((resolve) => cursor.close(() => resolve()));
    await client.end();
    forceGC();
  }
  
  logger.info('STREAMING ETL completed', { 
    datasetId: dataset.id, 
    totalInserted: totalInserted.toLocaleString()
  });
  
  return totalInserted;
}
