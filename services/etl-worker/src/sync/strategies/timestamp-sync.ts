/**
 * Timestamp-based Sync Strategy
 * Incremental sync using timestamp column
 */

import { 
  logger, 
  db, 
  clickhouse, 
  ensureTableExists, 
  extractTableFromQuery,
  parseColumnMapping
} from '../shared';

// Forward declarations - will be imported from databases
let mssqlSync: any;
let mysqlSync: any;
let streamingPostgreSQLSync: any;
let fullRefresh: any;

// Inject dependencies to avoid circular imports
export function injectDependencies(deps: {
  mssqlSync: any;
  mysqlSync: any;
  streamingPostgreSQLSync: any;
  fullRefresh: any;
}) {
  mssqlSync = deps.mssqlSync;
  mysqlSync = deps.mysqlSync;
  streamingPostgreSQLSync = deps.streamingPostgreSQLSync;
  fullRefresh = deps.fullRefresh;
}

export async function syncByTimestamp(dataset: any, connection: any, jobId?: string): Promise<number> {
  await ensureTableExists(dataset);
  
  const {
    reference_column,
    clickhouse_table,
    source_query,
    source_table,
    row_limit,
    last_sync_value
  } = dataset;

  logger.info('Timestamp-based sync starting', { 
    datasetId: dataset.id, 
    datasetName: dataset.name,
    referenceColumn: reference_column,
    lastSyncValue: last_sync_value,
    clickhouseTable: clickhouse_table
  });

  if (!reference_column) {
    logger.warn('No reference column defined, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }

  const sourceTableName = extractTableFromQuery(source_query || `SELECT * FROM ${source_table}`);
  if (!sourceTableName) {
    throw new Error('Kaynak tablo bulunamadı');
  }

  try {
    let lastValue = last_sync_value;
    
    if (!lastValue) {
      try {
        const maxResult = await clickhouse.query(`
          SELECT max(${reference_column}) as max_val 
          FROM clixer_analytics.${clickhouse_table}
        `);
        lastValue = maxResult[0]?.max_val || null;
        logger.info('Got max timestamp from ClickHouse', { lastValue });
      } catch (e) {
        lastValue = null;
      }
    }

    let totalInserted = 0;
    const columnMapping = parseColumnMapping(dataset);

    if (connection.type === 'mssql') {
      const columns = columnMapping.map((c: any) => c.source).join(', ') || '*';
      let whereClause = '';
      
      if (lastValue) {
        whereClause = `WHERE ${reference_column} > '${lastValue}'`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT TOP ${limit} ${columns} FROM ${sourceTableName} ${whereClause} ORDER BY ${reference_column}`;
      
      logger.info('Executing MSSQL timestamp query', { 
        query: query.substring(0, 300),
        lastValue,
        limit
      });

      const originalQuery = dataset.source_query;
      dataset.source_query = query;
      try {
        totalInserted = await mssqlSync(dataset, connection, columnMapping, jobId);
      } finally {
        dataset.source_query = originalQuery;
      }
      
    } else if (connection.type === 'postgresql') {
      const columns = columnMapping.map((c: any) => c.source).join(', ') || '*';
      let whereClause = '';
      
      if (lastValue) {
        whereClause = `WHERE ${reference_column} > '${lastValue}'`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT ${columns} FROM ${sourceTableName} ${whereClause} ORDER BY ${reference_column} LIMIT ${limit}`;
      
      logger.info('Executing PostgreSQL timestamp query', { query: query.substring(0, 300) });
      
      totalInserted = await streamingPostgreSQLSync(dataset, connection, columnMapping, jobId);
      
    } else if (connection.type === 'mysql') {
      const columns = columnMapping.map((c: any) => c.source).join(', ') || '*';
      let whereClause = '';
      
      if (lastValue) {
        whereClause = `WHERE ${reference_column} > '${lastValue}'`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT ${columns} FROM ${sourceTableName} ${whereClause} ORDER BY ${reference_column} LIMIT ${limit}`;
      
      logger.info('Executing MySQL timestamp query', { query: query.substring(0, 300) });
      
      totalInserted = await mysqlSync(dataset, connection, columnMapping, jobId);
      
    } else {
      logger.warn('Unsupported connection type for timestamp sync, falling back to full refresh', { 
        type: connection.type 
      });
      return await fullRefresh(dataset, connection, jobId);
    }

    // Update last sync value
    if (totalInserted > 0) {
      try {
        const newMaxResult = await clickhouse.query(`
          SELECT max(${reference_column}) as max_val 
          FROM clixer_analytics.${clickhouse_table}
        `);
        const newMaxValue = newMaxResult[0]?.max_val;
        
        if (newMaxValue) {
          await db.query(
            'UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2',
            [newMaxValue, dataset.id]
          );
          logger.info('Updated last_sync_value', { newMaxValue });
        }
      } catch (e: any) {
        logger.warn('Could not update last_sync_value', { error: e.message });
      }
    }

    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
    
    logger.info('Timestamp-based sync completed', { 
      datasetId: dataset.id,
      totalInserted,
      lastValue
    });

    return totalInserted;
    
  } catch (error: any) {
    logger.error('Timestamp-based sync failed', { 
      datasetId: dataset.id,
      error: error.message 
    });
    throw error;
  }
}
