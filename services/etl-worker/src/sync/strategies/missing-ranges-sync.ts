/**
 * Missing Ranges Sync Strategy
 * Syncs only missing ID ranges detected by data validation
 */

import { 
  logger, 
  db, 
  clickhouse, 
  parseColumnMapping,
  transformBatchForClickHouse
} from '../shared';

export async function syncMissingRanges(
  dataset: any, 
  connection: any, 
  jobId: string,
  ranges: Array<{start: number; end: number; missing_count?: number}>,
  pkColumn: string = 'id'
): Promise<number> {
  const { clickhouse_table, source_query } = dataset;
  
  if (!ranges || ranges.length === 0) {
    logger.warn('No ranges provided for missing sync', { datasetId: dataset.id });
    return 0;
  }
  
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
  
  const idColumn = pkColumn;
  let totalInserted = 0;
  
  logger.info('Starting missing ranges sync', { 
    datasetId: dataset.id, 
    ranges: ranges.length,
    totalMissing: ranges.reduce((sum, r) => sum + (r.missing_count || (r.end - r.start + 1)), 0)
  });
  
  const columnMapping = parseColumnMapping(dataset);
  
  if (connection.type === 'mssql') {
    const mssql = require('mssql');
    const connStr = connection.connection_string || 
      `Server=${connection.host},${connection.port || 1433};Database=${connection.database_name};User Id=${connection.username};Password=${connection.password_encrypted};Encrypt=${connection.host?.includes('.database.windows.net')};TrustServerCertificate=true;Connection Timeout=30;Request Timeout=120000`;
    
    const pool = await mssql.connect(connStr);
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      logger.info(`Processing range ${i + 1}/${ranges.length}`, { start: range.start, end: range.end });
      
      const query = `SELECT * FROM [${sourceTable}] WITH (NOLOCK) WHERE [${idColumn}] >= ${range.start} AND [${idColumn}] <= ${range.end}`;
      const result = await pool.request().query(query);
      
      if (result.recordset.length > 0) {
        const localMapping = columnMapping.length > 0 ? columnMapping : [];
        
        if (localMapping.length === 0) {
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
        
        logger.info(`Range ${i + 1} completed`, { inserted: result.recordset.length, totalSoFar: totalInserted });
      }
      
      if (jobId) {
        const progress = Math.round(((i + 1) / ranges.length) * 100);
        await db.query(
          `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
          [totalInserted, `Range ${i + 1}/${ranges.length} - ${progress}%`, jobId]
        );
      }
    }
    
    await pool.close();
  } else {
    throw new Error(`Missing sync henüz sadece MSSQL destekliyor. Mevcut: ${connection.type}`);
  }
  
  try {
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
    logger.info('OPTIMIZE completed after missing sync');
  } catch (optErr: any) {
    logger.warn('OPTIMIZE failed (non-critical)', { error: optErr.message });
  }
  
  logger.info('Missing ranges sync completed', { 
    datasetId: dataset.id, 
    totalInserted,
    rangesProcessed: ranges.length
  });
  
  return totalInserted;
}
