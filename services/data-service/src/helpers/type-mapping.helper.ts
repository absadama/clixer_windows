/**
 * Type Mapping Helper
 * SQL to ClickHouse type conversions
 */

import { createLogger } from '@clixer/shared';

const logger = createLogger({ service: 'data-service' });

// ============================================
// SQL TO CLICKHOUSE TYPE MAPPING
// ============================================

export const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // ============ STRING TYPES ============
  // PostgreSQL
  'text': 'String',
  'varchar': 'String',
  'char': 'String',
  'character varying': 'String',
  'character': 'String',
  'bpchar': 'String',
  'name': 'String',
  'uuid': 'String',
  'json': 'String',
  'jsonb': 'String',
  'xml': 'String',
  'citext': 'String',
  'inet': 'String',
  'cidr': 'String',
  'macaddr': 'String',
  
  // MySQL
  'tinytext': 'String',
  'mediumtext': 'String',
  'longtext': 'String',
  'enum': 'String',
  'set': 'String',
  
  // MSSQL
  'nvarchar': 'String',
  'nchar': 'String',
  'ntext': 'String',
  'uniqueidentifier': 'String',
  'sql_variant': 'String',
  'sysname': 'String',
  
  // Oracle
  'varchar2': 'String',
  'nvarchar2': 'String',
  'clob': 'String',
  'nclob': 'String',
  'long': 'String',
  'rowid': 'String',
  
  // ============ INTEGER TYPES ============
  // PostgreSQL
  'int': 'Int32',
  'int4': 'Int32',
  'integer': 'Int32',
  'int2': 'Int16',
  'smallint': 'Int16',
  'int8': 'Int64',
  'bigint': 'Int64',
  'serial': 'Int32',
  'bigserial': 'Int64',
  'smallserial': 'Int16',
  'oid': 'UInt32',
  
  // MySQL
  'tinyint': 'Int8',
  'mediumint': 'Int32',
  'year': 'Int16',
  
  // Oracle
  'number': 'Float64',
  'pls_integer': 'Int32',
  'binary_integer': 'Int32',
  
  // ============ FLOAT TYPES ============
  // PostgreSQL
  'float': 'Float64',
  'float4': 'Float32',
  'float8': 'Float64',
  'real': 'Float32',
  'double precision': 'Float64',
  'double': 'Float64',
  'decimal': 'Float64',
  'numeric': 'Float64',
  'money': 'Float64',
  
  // MySQL
  'newdecimal': 'Float64',
  
  // MSSQL
  'smallmoney': 'Float64',
  
  // Oracle
  'binary_float': 'Float32',
  'binary_double': 'Float64',
  
  // ============ BOOLEAN TYPES ============
  'boolean': 'UInt8',
  'bool': 'UInt8',
  'bit': 'UInt8',
  
  // ============ DATE/TIME TYPES ============
  // PostgreSQL
  'date': 'Date',
  'time': 'String',
  'timetz': 'String',
  'timestamp': 'DateTime',
  'timestamp without time zone': 'DateTime',
  'timestamp with time zone': 'DateTime',
  'timestamptz': 'DateTime',
  'interval': 'String',
  
  // MySQL
  'datetime': 'DateTime',
  'newdate': 'Date',
  
  // MSSQL
  'datetime2': 'DateTime',
  'smalldatetime': 'DateTime',
  'datetimeoffset': 'DateTime',
  
  // Oracle
  'timestamp with local time zone': 'DateTime',
  
  // ============ BINARY TYPES ============
  // PostgreSQL
  'bytea': 'String',
  
  // MySQL
  'blob': 'String',
  'tinyblob': 'String',
  'mediumblob': 'String',
  'longblob': 'String',
  'binary': 'String',
  'varbinary': 'String',
  
  // MSSQL
  'image': 'String',
  
  // Oracle
  'raw': 'String',
  'long raw': 'String',
  'bfile': 'String',
  
  // ============ GEOMETRY TYPES ============
  'geometry': 'String',
  'geography': 'String',
  'point': 'String',
  'linestring': 'String',
  'polygon': 'String',
  
  // Default
  'default': 'String'
};

/**
 * Convert SQL type to ClickHouse type
 */
export function sqlToClickHouseType(sqlType: string): string {
  if (!sqlType) return 'String';
  
  const normalized = sqlType.toLowerCase().trim();
  
  // Direct match
  if (SQL_TO_CLICKHOUSE_TYPE[normalized]) {
    return SQL_TO_CLICKHOUSE_TYPE[normalized];
  }
  
  // Remove parentheses (varchar(255) -> varchar)
  const baseType = normalized.replace(/\(.*\)/, '').trim();
  if (SQL_TO_CLICKHOUSE_TYPE[baseType]) {
    return SQL_TO_CLICKHOUSE_TYPE[baseType];
  }
  
  // Partial match
  for (const [key, value] of Object.entries(SQL_TO_CLICKHOUSE_TYPE)) {
    if (normalized.includes(key)) {
      return value;
    }
  }
  
  logger.warn('Unknown SQL type, defaulting to String', { sqlType });
  return 'String';
}

/**
 * Check if type is a date/time type
 */
export function isDateType(sqlType: string): boolean {
  const normalized = sqlType.toLowerCase();
  return normalized.includes('date') || 
         normalized.includes('time') || 
         normalized.includes('timestamp');
}

/**
 * Check if type is numeric
 */
export function isNumericType(sqlType: string): boolean {
  const normalized = sqlType.toLowerCase();
  const chType = sqlToClickHouseType(sqlType);
  return chType.includes('Int') || chType.includes('Float');
}
