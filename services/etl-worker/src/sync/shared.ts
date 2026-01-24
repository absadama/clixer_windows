/**
 * Shared utilities for sync operations
 */

import { createLogger, db, clickhouse, cache } from '@clixer/shared';
import { 
  convertToClickHouseDateTime, 
  isDateLikeValue,
  parseColumnMapping 
} from '../helpers';

export const logger = createLogger({ service: 'etl-worker' });

// Re-export for convenience
export { db, clickhouse, cache };
export { parseColumnMapping };

// ============================================
// SQL → CLICKHOUSE TYPE MAPPING
// ============================================
export const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // INTEGER TYPES
  'int': 'Int32', 'int4': 'Int32', 'integer': 'Int32',
  'int2': 'Int16', 'smallint': 'Int16',
  'int8': 'Int64', 'bigint': 'Int64',
  'serial': 'Int32', 'bigserial': 'Int64', 'smallserial': 'Int16',
  'oid': 'UInt32', 'tinyint': 'Int8', 'mediumint': 'Int32', 'year': 'Int16',
  'number': 'Float64', 'pls_integer': 'Int32', 'binary_integer': 'Int32',
  
  // FLOAT TYPES
  'float': 'Float64', 'float4': 'Float32', 'float8': 'Float64',
  'real': 'Float32', 'double': 'Float64', 'double precision': 'Float64',
  'decimal': 'Float64', 'numeric': 'Float64', 'money': 'Float64',
  'newdecimal': 'Float64', 'smallmoney': 'Float64',
  'binary_float': 'Float32', 'binary_double': 'Float64',
  
  // STRING TYPES
  'text': 'String', 'varchar': 'String', 'char': 'String',
  'character varying': 'String', 'character': 'String', 'bpchar': 'String',
  'name': 'String', 'uuid': 'String', 'json': 'String', 'jsonb': 'String',
  'xml': 'String', 'citext': 'String', 'inet': 'String', 'cidr': 'String', 'macaddr': 'String',
  'tinytext': 'String', 'mediumtext': 'String', 'longtext': 'String',
  'enum': 'String', 'set': 'String',
  'nvarchar': 'String', 'nchar': 'String', 'ntext': 'String',
  'uniqueidentifier': 'String', 'sql_variant': 'String', 'sysname': 'String',
  'varchar2': 'String', 'nvarchar2': 'String', 'clob': 'String', 'nclob': 'String',
  'long': 'String', 'rowid': 'String',
  
  // DATE/TIME TYPES
  'date': 'Date', 'time': 'String', 'timetz': 'String', 'interval': 'String',
  'timestamp': 'DateTime', 'timestamptz': 'DateTime',
  'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
  'datetime': 'DateTime', 'newdate': 'Date',
  'datetime2': 'DateTime', 'smalldatetime': 'DateTime', 'datetimeoffset': 'DateTime',
  'timestamp with local time zone': 'DateTime',
  
  // BOOLEAN TYPES
  'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  
  // BINARY TYPES
  'bytea': 'String', 'blob': 'String', 'tinyblob': 'String', 
  'mediumblob': 'String', 'longblob': 'String',
  'binary': 'String', 'varbinary': 'String', 'image': 'String',
  'raw': 'String', 'long raw': 'String', 'bfile': 'String',
  
  // GEOMETRY TYPES
  'geometry': 'String', 'geography': 'String', 'point': 'String',
  'linestring': 'String', 'polygon': 'String',
};

/**
 * Map source database type to ClickHouse type
 */
export function mapSourceTypeToClickHouse(sourceType: string): string {
  if (!sourceType) return 'String';
  const normalized = sourceType.toLowerCase().replace(/\s+/g, ' ').trim();
  const baseType = normalized.split('(')[0].trim();
  return SQL_TO_CLICKHOUSE_TYPE[baseType] || SQL_TO_CLICKHOUSE_TYPE[normalized] || 'String';
}

/**
 * Transform a single row for ClickHouse
 */
export function transformRowForClickHouse(row: any): any {
  const transformed: any = {};
  
  for (const key in row) {
    const value = row[key];
    
    if (value === null || value === undefined) {
      transformed[key] = null;
      continue;
    }
    
    if (value instanceof Date) {
      transformed[key] = convertToClickHouseDateTime(value);
      continue;
    }
    
    if (typeof value === 'string' && isDateLikeValue(value)) {
      const converted = convertToClickHouseDateTime(value);
      transformed[key] = converted !== null ? converted : value;
      continue;
    }
    
    transformed[key] = value;
  }
  
  return transformed;
}

/**
 * Transform a batch of rows for ClickHouse
 */
export function transformBatchForClickHouse(rows: any[], _columnMapping?: any[]): any[] {
  return rows.map(row => transformRowForClickHouse(row));
}

/**
 * Extract table name from SQL query
 */
export function extractTableFromQuery(query: string): string | null {
  if (!query) return null;
  
  // MSSQL format: [schema].[table] or [table]
  const mssqlMatch = query.match(/\bFROM\s+\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?\.\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?/i);
  if (mssqlMatch) {
    return `${mssqlMatch[1]}.${mssqlMatch[2]}`;
  }
  
  // Standard format: table only
  const tableMatch = query.match(/\bFROM\s+\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?(?:\s|$|;|,|\))/i);
  if (tableMatch) {
    return tableMatch[1];
  }
  
  return null;
}

/**
 * Ensure ClickHouse table exists (self-healing)
 */
export async function ensureTableExists(dataset: any): Promise<void> {
  const tableName = dataset.clickhouse_table;
  
  try {
    const result = await clickhouse.query(`
      SELECT count() as cnt FROM system.tables 
      WHERE database = 'clixer_analytics' AND name = '${tableName}'
    `);
    
    const tableExists = result && result[0] && parseInt(result[0].cnt) > 0;
    
    if (tableExists) {
      logger.debug('Table already exists', { tableName });
      return;
    }
    
    logger.info('Table does not exist, creating automatically', { tableName, datasetId: dataset.id });
    
    const columnMapping = dataset.column_mapping || [];
    
    if (columnMapping.length === 0) {
      throw new Error(`Dataset ${dataset.name} için column_mapping bulunamadı. Tablo oluşturulamıyor.`);
    }
    
    // Create columns
    const columns = columnMapping.map((col: any) => {
      const targetName = col.target || col.source;
      let chType = col.clickhouseType;
      
      if (!chType || chType === 'String') {
        const sourceType = col.sourceType || col.type || '';
        chType = mapSourceTypeToClickHouse(sourceType);
      }
      
      if (chType && chType.startsWith('Decimal')) {
        chType = 'Float64';
      }
      
      const numericPatterns = [
        'amount', 'tutar', 'price', 'fiyat', 'total', 'toplam', 
        'adet', 'quantity', 'miktar', 'indirim', 'discount', 
        'brut', 'net', 'gross', 'ucret', 'maas', 'salary', 'fee',
        'cost', 'maliyet', 'borc', 'alacak', 'bakiye', 'balance'
      ];
      if (chType === 'String' && numericPatterns.some(p => targetName.toLowerCase().includes(p))) {
        chType = 'Float64';
      }
      
      return `${targetName} ${chType}`;
    });
    
    // Find ORDER BY column
    const uniqueCandidates = ['id', 'code', 'kod', 'uuid', 'pk', 'primary_key', '_id'];
    const uniqueCol = columnMapping.find((c: any) => {
      const name = (c.target || c.source).toLowerCase();
      return uniqueCandidates.includes(name);
    });
    
    let dateColumn: string | null = null;
    
    if (dataset.partition_column) {
      const partCol = columnMapping.find((c: any) => 
        c.source === dataset.partition_column || c.target === dataset.partition_column
      );
      if (partCol) dateColumn = partCol.target || partCol.source;
    }
    
    if (!dateColumn && dataset.reference_column) {
      const refCol = columnMapping.find((c: any) => 
        c.source === dataset.reference_column || c.target === dataset.reference_column
      );
      if (refCol) dateColumn = refCol.target || refCol.source;
    }
    
    if (!dateColumn) {
      const dateCol = columnMapping.find((c: any) => 
        c.clickhouseType === 'Date' || c.clickhouseType === 'DateTime'
      );
      if (dateCol) dateColumn = dateCol.target || dateCol.source;
    }
    
    let orderByColumn: string;
    
    if (uniqueCol) {
      orderByColumn = uniqueCol.target || uniqueCol.source;
    } else if (dateColumn) {
      const otherColumns = columnMapping
        .filter((c: any) => (c.target || c.source) !== dateColumn)
        .slice(0, 4)
        .map((c: any) => c.target || c.source);
      orderByColumn = [dateColumn, ...otherColumns].join(', ');
    } else {
      const allColumns = columnMapping.slice(0, 5).map((c: any) => c.target || c.source);
      orderByColumn = allColumns.length > 0 ? allColumns.join(', ') : '_synced_at';
    }
    
    const createSql = `
      CREATE TABLE IF NOT EXISTS clixer_analytics.${tableName} (
        ${columns.join(',\n        ')},
        _synced_at DateTime DEFAULT now()
      )
      ENGINE = ReplacingMergeTree(_synced_at)
      ORDER BY (${orderByColumn})
    `;
    
    logger.info('Auto-creating ClickHouse table', { tableName, sql: createSql.substring(0, 500) });
    await clickhouse.execute(createSql);
    logger.info('Table created successfully', { tableName });
    
  } catch (error: any) {
    logger.error('Failed to ensure table exists', { tableName, error: error.message });
    throw new Error(`ClickHouse tablo oluşturulamadı: ${error.message}`);
  }
}
