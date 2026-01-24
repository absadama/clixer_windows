/**
 * Date Partition Sync Strategy
 * Sliding window + modified detection for partition-based sync
 */

import { 
  logger, 
  clickhouse, 
  ensureTableExists
} from '../shared';

// Forward declaration
let fullRefresh: any;

export function injectDependencies(deps: { fullRefresh: any }) {
  fullRefresh = deps.fullRefresh;
}

export async function syncByDatePartition(dataset: any, connection: any, jobId?: string): Promise<number> {
  await ensureTableExists(dataset);
  
  const {
    partition_column,
    partition_type = 'monthly',
    refresh_window_days = 7,
    detect_modified = false,
    modified_column,
    clickhouse_table
  } = dataset;

  logger.info('Partition-based sync starting', { 
    datasetId: dataset.id, 
    partitionColumn: partition_column,
    partitionType: partition_type,
    refreshWindowDays: refresh_window_days,
    detectModified: detect_modified,
    modifiedColumn: modified_column
  });

  if (!partition_column) {
    logger.warn('No partition column defined, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }

  if (!dataset.source_table && !dataset.source_query) {
    logger.error('No source table or query defined', { datasetId: dataset.id });
    throw new Error('Kaynak tablo veya sorgu tanımlanmamış');
  }

  // Consistency check
  try {
    const tableInfo = await clickhouse.queryOne(`
      SELECT partition_key, engine, sorting_key
      FROM system.tables 
      WHERE database = 'clixer_analytics' AND name = '${clickhouse_table}'
    `);
    
    if (tableInfo) {
      const actualPartitionKey = tableInfo.partition_key || '';
      const isActuallyMonthly = actualPartitionKey.includes('toYYYYMM') && !actualPartitionKey.includes('toYYYYMMDD');
      const isActuallyDaily = actualPartitionKey.includes('toYYYYMMDD');
      
      const isConsistent = 
        (partition_type === 'daily' && isActuallyDaily) || 
        (partition_type === 'monthly' && isActuallyMonthly);
      
      if (!isConsistent && actualPartitionKey) {
        logger.warn('PARTITION FORMAT MISMATCH!', {
          datasetId: dataset.id,
          uiSetting: partition_type,
          actualFormat: isActuallyDaily ? 'daily' : (isActuallyMonthly ? 'monthly' : 'unknown')
        });
      }
    }
  } catch (e: any) {
    logger.warn('Consistency check failed', { error: e.message });
  }

  try {
    const columnMapping = dataset.column_mapping || [];
    
    if (!columnMapping || columnMapping.length === 0) {
      logger.error('No column mapping defined', { datasetId: dataset.id });
      throw new Error('Kolon eşleştirmesi tanımlanmamış');
    }
    
    if (connection.type !== 'postgresql') {
      logger.warn('Partition sync only supports PostgreSQL, falling back to full refresh', { type: connection.type });
      return await fullRefresh(dataset, connection, jobId);
    }

    const { Client } = require('pg');
    const client = new Client({
      host: connection.host,
      port: connection.port,
      database: connection.database_name,
      user: connection.username,
      password: connection.password_encrypted
    });
    await client.connect();

    const sourceFrom = dataset.source_table 
      ? dataset.source_table 
      : dataset.source_query 
        ? `(${dataset.source_query}) AS sq` 
        : null;
    
    if (!sourceFrom) {
      throw new Error('Kaynak tablo veya sorgu tanımlanmamış');
    }

    try {
      let affectedDates: string[] = [];
      const today = new Date();
      
      if (detect_modified && modified_column) {
        const lastSyncTime = dataset.last_sync_at || new Date(0).toISOString();
        
        const affectedQuery = `
          SELECT DISTINCT DATE(${partition_column}) as affected_date
          FROM ${sourceFrom}
          WHERE ${modified_column} >= $1
          ORDER BY affected_date
        `;
        
        const affectedResult = await client.query(affectedQuery, [lastSyncTime]);
        affectedDates = affectedResult.rows.map((r: any) => r.affected_date.toISOString().split('T')[0]);
        
        logger.info('Modified dates detected', { 
          count: affectedDates.length, 
          dates: affectedDates.slice(0, 10),
          since: lastSyncTime 
        });
      }
      
      if (refresh_window_days > 0) {
        for (let i = 0; i < refresh_window_days; i++) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          if (!affectedDates.includes(dateStr)) {
            affectedDates.push(dateStr);
          }
        }
      }
      
      affectedDates.sort();
      
      if (affectedDates.length === 0) {
        logger.info('No affected dates found, skipping sync', { datasetId: dataset.id });
        await client.end();
        return 0;
      }
      
      logger.info('Dates to refresh', { count: affectedDates.length, dates: affectedDates.slice(0, 10) });
      
      let totalInserted = 0;
      
      for (const dateStr of affectedDates) {
        logger.info('Processing date', { date: dateStr });
        
        // Delete from ClickHouse
        await clickhouse.execute(`
          ALTER TABLE clixer_analytics.${clickhouse_table}
          DELETE WHERE toDate(${partition_column}) = '${dateStr}'
        `);
        
        // Fetch and insert
        const columns = columnMapping.map((c: any) => c.source).join(', ');
        const query = `SELECT ${columns} FROM ${sourceFrom} WHERE DATE(${partition_column}) = $1`;
        const result = await client.query(query, [dateStr]);
        
        if (result.rows.length > 0) {
          const transformedRows = result.rows.map((row: any) => {
            const transformed: any = {};
            for (const mapping of columnMapping) {
              const sourceCol = mapping.source;
              const targetCol = mapping.target || sourceCol;
              transformed[targetCol] = row[sourceCol];
            }
            return transformed;
          });
          
          await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedRows);
          totalInserted += result.rows.length;
          
          logger.info('Date synced', { date: dateStr, rows: result.rows.length });
        }
      }
      
      await client.end();
      
      await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
      
      logger.info('Partition-based sync completed', { 
        datasetId: dataset.id,
        totalInserted,
        datesProcessed: affectedDates.length
      });
      
      return totalInserted;
      
    } catch (error: any) {
      await client.end();
      throw error;
    }
    
  } catch (error: any) {
    logger.error('Partition-based sync failed', { 
      datasetId: dataset.id,
      error: error.message 
    });
    throw error;
  }
}
