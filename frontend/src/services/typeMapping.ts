/**
 * Clixer - SQL to ClickHouse Type Mapping
 * DataPage'den çıkarıldı - Tip dönüşüm yardımcıları
 */

// SQL → ClickHouse Type Mapping
export const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // ============ STRING TYPES ============
  // PostgreSQL
  'character varying': 'String', 'varchar': 'String', 'character': 'String', 'char': 'String',
  'text': 'String', 'citext': 'String', 'name': 'String',
  // MySQL
  'tinytext': 'String', 'mediumtext': 'String', 'longtext': 'String',
  'enum': 'String', 'set': 'String',
  // MSSQL
  'nvarchar': 'String', 'nchar': 'String', 'ntext': 'String',
  'sysname': 'String', 'sql_variant': 'String', 'xml': 'String',
  // Oracle
  'varchar2': 'String', 'nvarchar2': 'String', 'clob': 'String', 'nclob': 'String', 'long': 'String',
  
  // ============ INTEGER TYPES ============
  // PostgreSQL
  'integer': 'Int32', 'int': 'Int32', 'int4': 'Int32',
  'smallint': 'Int16', 'int2': 'Int16',
  'bigint': 'Int64', 'int8': 'Int64',
  'serial': 'Int32', 'serial4': 'Int32',
  'smallserial': 'Int16', 'serial2': 'Int16',
  'bigserial': 'Int64', 'serial8': 'Int64',
  // MySQL
  'tinyint': 'Int8', 'mediumint': 'Int32',
  // MSSQL
  'tinyint unsigned': 'UInt8',
  // Oracle
  'number': 'Float64', 'pls_integer': 'Int32', 'binary_integer': 'Int32',
  
  // ============ FLOAT TYPES ============
  // PostgreSQL
  'real': 'Float32', 'float4': 'Float32',
  'double precision': 'Float64', 'float8': 'Float64', 'float': 'Float64',
  'numeric': 'Decimal128(4)', 'decimal': 'Decimal128(4)',
  // MySQL
  'double': 'Float64',
  // MSSQL
  'money': 'Decimal128(4)', 'smallmoney': 'Decimal64(4)',
  // Oracle
  'binary_float': 'Float32', 'binary_double': 'Float64',
  
  // ============ DATE/TIME TYPES ============
  // PostgreSQL
  'date': 'Date', 'time': 'String', 'time without time zone': 'String', 'time with time zone': 'String',
  'timestamp': 'DateTime', 'timestamptz': 'DateTime',
  'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
  // MySQL
  'datetime': 'DateTime', 'newdate': 'Date',
  // MSSQL
  'datetime2': 'DateTime', 'smalldatetime': 'DateTime', 'datetimeoffset': 'DateTime',
  // Oracle
  'timestamp with local time zone': 'DateTime',
  
  // ============ BOOLEAN TYPES ============
  'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  
  // ============ BINARY TYPES ============
  // PostgreSQL
  'bytea': 'String',
  // MySQL
  'blob': 'String', 'tinyblob': 'String', 'mediumblob': 'String', 'longblob': 'String',
  'binary': 'String', 'varbinary': 'String',
  // MSSQL
  'image': 'String',
  // Oracle
  'raw': 'String', 'long raw': 'String', 'bfile': 'String',
  
  // ============ GEOMETRY TYPES ============
  'geometry': 'String', 'geography': 'String', 'point': 'String',
  'linestring': 'String', 'polygon': 'String',
}

/**
 * SQL tipini ClickHouse tipine dönüştürür
 */
export function sqlToClickHouseType(sqlType: string): string {
  if (!sqlType) return 'String'
  const normalized = sqlType.toLowerCase().trim()
  const baseType = normalized.replace(/\(.*\)/, '').trim()
  return SQL_TO_CLICKHOUSE_TYPE[baseType] || SQL_TO_CLICKHOUSE_TYPE[normalized] || 'String'
}

/**
 * Tip uyumluluk bilgisi döndürür
 */
export function getTypeCompatibilityInfo(sourceType: string): { 
  chType: string
  compatible: boolean
  suggestion: string | null
  isDateType: boolean
} {
  const chType = sqlToClickHouseType(sourceType)
  const normalizedSource = (sourceType || '').toLowerCase()
  
  // Date/DateTime tipi kontrolü
  const isDateType = ['date', 'datetime', 'datetime2', 'timestamp', 'smalldatetime', 'time'].some(t => normalizedSource.includes(t))
  
  // Uyumluluk ve öneri
  if (!sourceType) {
    return { 
      chType: 'String', 
      compatible: false, 
      suggestion: 'Kaynak tipi bilinmiyor. Varsayılan String kullanılacak.',
      isDateType: false
    }
  }
  
  // Date tipi için özel uyarı
  if (isDateType) {
    return {
      chType,
      compatible: true,
      suggestion: `⏰ Tarih kolonları MSSQL'den farklı formatta gelebilir. Sorun olursa CONVERT(VARCHAR, kolon, 120) kullanın.`,
      isDateType: true
    }
  }
  
  return { chType, compatible: true, suggestion: null, isDateType: false }
}

/**
 * Tip uyumluluğuna göre renk döndürür
 */
export function getTypeColor(compatible: boolean, isDark: boolean): string {
  if (compatible) {
    return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
  }
  return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300'
}
