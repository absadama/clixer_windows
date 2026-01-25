/**
 * Full Refresh Sync Strategy
 * Complete table refresh - truncates and re-imports all data
 * SECURITY: SSRF koruması uygulandı
 */

import { 
  logger, 
  db, 
  clickhouse, 
  ensureTableExists, 
  transformBatchForClickHouse,
  validateExternalUrl,
  safeFetch
} from '../shared';

import { 
  BATCH_SIZE, 
  GC_INTERVAL,
  truncateClickHouseTable,
  checkMemory,
  forceGC,
  toClickHouseDateTime
} from '../../helpers';

// Forward declarations for database sync functions
let mssqlSync: any;
let mysqlSync: any;
let streamingPostgreSQLSync: any;
let isJobCancelled: any;
let validateDataConsistency: any;

export function injectDependencies(deps: {
  mssqlSync: any;
  mysqlSync: any;
  streamingPostgreSQLSync: any;
  isJobCancelled: any;
  validateDataConsistency: any;
}) {
  mssqlSync = deps.mssqlSync;
  mysqlSync = deps.mysqlSync;
  streamingPostgreSQLSync = deps.streamingPostgreSQLSync;
  isJobCancelled = deps.isJobCancelled;
  validateDataConsistency = deps.validateDataConsistency;
}

export async function fullRefresh(dataset: any, connection: any, jobId?: string): Promise<number> {
  logger.info('Full refresh starting', { datasetId: dataset.id, table: dataset.clickhouse_table, jobId });
  
  try {
    await ensureTableExists(dataset);
    
    const columnMapping = dataset.column_mapping || [];
    
    // PostgreSQL streaming sync
    if (connection.type === 'postgresql') {
      return await streamingPostgreSQLSync(dataset, connection, columnMapping, jobId);
    }
    
    // MSSQL sync
    if (connection.type === 'mssql') {
      return await mssqlSync(dataset, connection, columnMapping, jobId);
    }
    
    // MySQL sync
    if (connection.type === 'mysql') {
      return await mysqlSync(dataset, connection, columnMapping, jobId);
    }
    
    // API and other sources
    let rows: any[] = [];
    
    if (connection.type === 'api') {
      logger.info('Fetching from API', { host: connection.host });
      
      let apiConfig: any = connection.api_config || {};
      
      if (dataset.source_query && typeof dataset.source_query === 'string') {
        try {
          const queryConfig = JSON.parse(dataset.source_query);
          apiConfig = { ...apiConfig, ...queryConfig };
        } catch (e) {
          apiConfig.endpoint = dataset.source_query;
        }
      }
      
      let url = connection.host.trim().replace(/\/$/, '');
      
      // SECURITY: SSRF koruması - internal/private adreslere erişimi engelle
      const baseUrlValidation = validateExternalUrl(url);
      if (!baseUrlValidation.valid) {
        throw new Error(`SSRF koruması: ${baseUrlValidation.error}`);
      }
      
      if (url.startsWith('http://')) {
        const httpsUrl = url.replace('http://', 'https://');
        try {
          const testRes = await safeFetch(httpsUrl, { method: 'HEAD' });
          if (testRes.ok || testRes.status < 400) {
            url = httpsUrl;
          }
        } catch (e) {
          // Keep HTTP
        }
      }
      
      if (apiConfig.endpoint) {
        url += '/' + apiConfig.endpoint.replace(/^\//, '');
      }
      if (apiConfig.queryParams) {
        url += (url.includes('?') ? '&' : '?') + apiConfig.queryParams;
      }
      
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(apiConfig.headers || {})
      };
      
      const connApiConfig = typeof connection.api_config === 'string' 
        ? JSON.parse(connection.api_config) 
        : (connection.api_config || {});
      
      if (connApiConfig.apiKey) {
        const headerName = connApiConfig.headerName || 'Authorization';
        if (headerName === 'Authorization') {
          fetchHeaders['Authorization'] = `Bearer ${connApiConfig.apiKey}`;
        } else {
          fetchHeaders[headerName] = connApiConfig.apiKey;
        }
      }
      
      const fetchOptions: RequestInit = {
        method: apiConfig.method || 'GET',
        headers: fetchHeaders,
        redirect: 'follow'
      };
      
      if ((apiConfig.method === 'POST' || apiConfig.method === 'PUT') && apiConfig.requestBody) {
        fetchOptions.body = typeof apiConfig.requestBody === 'string' 
          ? apiConfig.requestBody 
          : JSON.stringify(apiConfig.requestBody);
      }
      
      // SECURITY: safeFetch kullan (SSRF korumalı)
      const response = await safeFetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      let data: any = await response.json();
      
      if (apiConfig.responsePath) {
        const paths = apiConfig.responsePath.split('.');
        for (const p of paths) {
          if (data && (data as any)[p] !== undefined) {
            data = (data as any)[p];
          }
        }
      }
      
      rows = Array.isArray(data) ? data : [data];
      logger.info('Fetched rows from API', { count: rows.length });
    }
    
    if (rows.length === 0) {
      logger.warn('No data fetched from source');
      return 0;
    }
    
    // Auto-create column mapping if not provided
    if (columnMapping.length === 0 && rows.length > 0) {
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
    }
    
    await truncateClickHouseTable(dataset.clickhouse_table);
    
    // Transform data
    const transformedRows = rows.map(row => {
      const transformed: any = {};
      for (const mapping of columnMapping) {
        const sourceCol = mapping.source || mapping.sourceName;
        const targetCol = mapping.target || mapping.targetName;
        let value = row[sourceCol];
        const chType = mapping.clickhouseType || 'String';
        
        const isNumericType = chType.includes('Int') || chType.includes('Float') || chType.includes('Decimal');
        
        if (value === null || value === undefined || (value === '' && isNumericType)) {
          if (isNumericType) {
            value = 0;
          } else if (chType === 'Date') {
            value = '1970-01-01';
          } else if (chType === 'DateTime') {
            value = '1970-01-01 00:00:00';
          } else {
            value = '';
          }
        } else if (isNumericType && typeof value === 'string') {
          const numVal = parseFloat(value);
          value = isNaN(numVal) ? 0 : numVal;
        }
        
        transformed[targetCol] = value;
      }
      return transformed;
    });
    
    // Batch insert
    let insertedCount = 0;
    let batchNumber = 0;
    const totalBatches = Math.ceil(transformedRows.length / BATCH_SIZE);
    const columns = columnMapping.map((m: any) => m.target || m.targetName);
    
    logger.info('Starting batch insert', { 
      totalRows: transformedRows.length, 
      batchSize: BATCH_SIZE, 
      totalBatches 
    });
    
    for (let i = 0; i < transformedRows.length; i += BATCH_SIZE) {
      batchNumber++;
      
      if (jobId && isJobCancelled && await isJobCancelled(jobId)) {
        logger.info('Job cancelled during batch processing', { jobId, batchNumber, processedSoFar: insertedCount });
        return insertedCount;
      }
      
      const memCheck = checkMemory();
      if (!memCheck.ok) {
        logger.warn('Memory pressure, forcing GC', { usedMB: memCheck.usedMB });
        forceGC();
        await new Promise(r => setTimeout(r, 100));
      }
      
      const batch = transformedRows.slice(i, i + BATCH_SIZE);
      
      const values = batch.map(row => {
        const vals = columns.map((col: string) => {
          const val = row[col];
          if (val === null || val === undefined) {
            return 'NULL';
          }
          
          if (val instanceof Date || (typeof val === 'string' && val.match(/\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4}/))) {
            const converted = toClickHouseDateTime(val);
            if (converted) return `'${converted}'`;
            return 'NULL';
          }
          
          if (typeof val === 'string') {
            return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
          }
          return val;
        });
        return `(${vals.join(', ')})`;
      }).join(',\n');
      
      const insertSql = `INSERT INTO clixer_analytics.${dataset.clickhouse_table} (${columns.join(', ')}) VALUES ${values}`;
      
      try {
        await clickhouse.execute(insertSql);
        insertedCount += batch.length;
        
        if (batchNumber % 10 === 0 || batchNumber === totalBatches) {
          const progress = Math.round((batchNumber / totalBatches) * 100);
          const memUsed = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
          logger.info('Batch progress', { 
            batch: `${batchNumber}/${totalBatches}`,
            progress: `${progress}%`,
            inserted: insertedCount,
            memoryMB: memUsed
          });
        }
        
        if (batchNumber % (GC_INTERVAL / BATCH_SIZE) === 0) {
          forceGC();
        }
        
      } catch (insertErr: any) {
        logger.error('Insert error', { error: insertErr.message, batch: batchNumber });
      }
    }
    
    forceGC();
    
    // Validate
    let validation = { isConsistent: true, targetCount: insertedCount, duplicateCount: 0 };
    if (validateDataConsistency) {
      validation = await validateDataConsistency(dataset, null, transformedRows.length);
      
      if (!validation.isConsistent) {
        logger.warn('Data consistency warning', {
          datasetId: dataset.id,
          expected: transformedRows.length,
          actual: validation.targetCount,
          duplicatesRemoved: validation.duplicateCount
        });
      }
    }
    
    logger.info('Full refresh completed', { 
      datasetId: dataset.id, 
      rowsInserted: insertedCount,
      finalRowCount: validation.targetCount
    });
    
    return validation.targetCount;
    
  } catch (error: any) {
    logger.error('Full refresh error', { datasetId: dataset.id, error: error.message });
    throw error;
  }
}
