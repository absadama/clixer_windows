/**
 * Date Delete & Insert Sync Strategy
 * Deletes and re-inserts data based on date range
 */

import { 
  logger, 
  clickhouse, 
  ensureTableExists, 
  extractTableFromQuery,
  parseColumnMapping
} from '../shared';

// Forward declarations
let mssqlSync: any;
let mysqlSync: any;
let streamingPostgreSQLSync: any;
let fullRefresh: any;

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

export async function syncByDateDeleteInsert(dataset: any, connection: any, jobId?: string): Promise<number> {
  const {
    reference_column,
    delete_days = 1,
    clickhouse_table,
    source_query,
    source_table,
    row_limit
  } = dataset;

  const columnMapping = parseColumnMapping(dataset);

  logger.info('Date Delete & Insert sync starting', { 
    datasetId: dataset.id, 
    datasetName: dataset.name,
    referenceColumn: reference_column,
    deleteDays: delete_days,
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
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - delete_days);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    logger.info('Deleting data from ClickHouse', { 
      table: clickhouse_table, 
      dateColumn: reference_column,
      fromDate: startDateStr
    });

    await clickhouse.execute(`
      ALTER TABLE clixer_analytics.${clickhouse_table} 
      DELETE WHERE toDate(${reference_column}) >= '${startDateStr}'
    `);
    
    logger.info('Deleted recent data from ClickHouse');

    let totalInserted = 0;

    if (connection.type === 'mssql') {
      const columns = (dataset.column_mapping || []).map((c: any) => {
        const col = c.source;
        if (col.startsWith('[') && col.endsWith(']')) {
          return col;
        }
        return `[${col}]`;
      }).join(', ') || '*';
      
      const safeRefColumn = reference_column.startsWith('[') ? reference_column : `[${reference_column}]`;
      let dateFilter = '';
      
      if (delete_days === 0) {
        dateFilter = `WHERE CAST(${safeRefColumn} AS DATE) = CAST(GETDATE() AS DATE)`;
      } else {
        dateFilter = `WHERE ${safeRefColumn} >= DATEADD(day, -${delete_days}, CAST(GETDATE() AS DATE))`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT TOP ${limit} ${columns} FROM ${sourceTableName} ${dateFilter} ORDER BY ${safeRefColumn}`;
      
      logger.info('Executing MSSQL date-filtered query', { query: query.substring(0, 300) });

      const originalQuery = dataset.source_query;
      dataset.source_query = query;
      
      try {
        totalInserted = await mssqlSync(dataset, connection, columnMapping, jobId);
      } finally {
        dataset.source_query = originalQuery;
      }
      
    } else if (connection.type === 'postgresql') {
      const columns = (dataset.column_mapping || []).map((c: any) => c.source).join(', ') || '*';
      let dateFilter = '';
      
      if (delete_days === 0) {
        dateFilter = `WHERE ${reference_column}::date = CURRENT_DATE`;
      } else {
        dateFilter = `WHERE ${reference_column} >= CURRENT_DATE - INTERVAL '${delete_days} days'`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT ${columns} FROM ${sourceTableName} ${dateFilter} ORDER BY ${reference_column} LIMIT ${limit}`;
      
      logger.info('Executing PostgreSQL date-filtered query', { query: query.substring(0, 300) });
      
      const originalQuery = dataset.source_query;
      dataset.source_query = query;
      try {
        totalInserted = await streamingPostgreSQLSync(dataset, connection, columnMapping, jobId);
      } finally {
        dataset.source_query = originalQuery;
      }
      
    } else if (connection.type === 'mysql') {
      const columns = (dataset.column_mapping || []).map((c: any) => c.source).join(', ') || '*';
      let dateFilter = '';
      
      if (delete_days === 0) {
        dateFilter = `WHERE DATE(${reference_column}) = CURDATE()`;
      } else {
        dateFilter = `WHERE ${reference_column} >= DATE_SUB(CURDATE(), INTERVAL ${delete_days} DAY)`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT ${columns} FROM ${sourceTableName} ${dateFilter} ORDER BY ${reference_column} LIMIT ${limit}`;
      
      logger.info('Executing MySQL date-filtered query', { query: query.substring(0, 300) });
      
      const originalQuery = dataset.source_query;
      dataset.source_query = query;
      try {
        totalInserted = await mysqlSync(dataset, connection, columnMapping, jobId);
      } finally {
        dataset.source_query = originalQuery;
      }
      
    } else {
      logger.warn('Unsupported connection type for date_delete_insert, falling back to full refresh', { 
        type: connection.type 
      });
      return await fullRefresh(dataset, connection, jobId);
    }

    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
    
    logger.info('Date Delete & Insert sync completed', { 
      datasetId: dataset.id,
      totalInserted,
      deleteDays: delete_days
    });

    return totalInserted;
    
  } catch (error: any) {
    logger.error('Date Delete & Insert sync failed', { 
      datasetId: dataset.id,
      error: error.message 
    });
    throw error;
  }
}
