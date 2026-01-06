/**
 * Clixer - ETL Worker
 * Background job processor for ETL operations
 * Ayrı process - Ana uygulama etkilenmez!
 * 
 * MEMORY OPTİMİZASYONU:
 * - Büyük veri setleri batch'ler halinde işlenir
 * - Garbage collector manual tetikleme
 * - Memory limit kontrol
 */

import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

// SSL sertifika kontrolünü devre dışı bırak (self-signed veya expired sertifikalar için)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import {
  createLogger,
  db,
  clickhouse,
  cache
} from '@clixer/shared';

const logger = createLogger({ service: 'etl-worker' });

// Memory Optimizasyonu Sabitleri
const MAX_MEMORY_MB = 1024; // 1GB limit
const BATCH_SIZE = 5000; // Küçük batch'ler = daha az memory
const GC_INTERVAL = 10000; // Her 10 batch'te bir GC tetikle

// ============================================
// AKILLI TARİH DÖNÜŞTÜRÜCÜ
// Farklı kaynaklardan gelen formatları ClickHouse'a uygun hale getirir
// ============================================
function toClickHouseDateTime(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  
  // Date objesi
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  
  // String değer
  if (typeof val === 'string') {
    const str = val.trim();
    
    // 1. ISO 8601: 2025-12-13T20:33:42.722Z veya 2025-12-13T20:33:42
    if (str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return str.replace('T', ' ').replace('Z', '').split('.')[0];
    }
    
    // 2. ClickHouse formatı zaten: 2025-12-13 20:33:42
    if (str.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
      return str.split('.')[0]; // Milisaniye varsa at
    }
    
    // 3. Sadece tarih: 2025-12-13
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return str + ' 00:00:00';
    }
    
    // 4. Avrupa formatı: DD-MM-YYYY veya DD/MM/YYYY (gün > 12 ise kesin bu)
    const euMatch = str.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
    if (euMatch) {
      const day = parseInt(euMatch[1]);
      const month = parseInt(euMatch[2]);
      const year = euMatch[3];
      const time = euMatch[4] || '00:00:00';
      
      // Gün 12'den büyükse kesinlikle DD-MM-YYYY
      if (day > 12 && month <= 12) {
        return `${year}-${euMatch[2]}-${euMatch[1]} ${time}`;
      }
      // Ay 12'den büyükse kesinlikle MM-DD-YYYY (ABD)
      if (month > 12 && day <= 12) {
        return `${year}-${euMatch[1]}-${euMatch[2]} ${time}`;
      }
      // İkisi de <=12 ise varsayılan olarak DD-MM-YYYY kabul et (Türkiye için)
      return `${year}-${euMatch[2]}-${euMatch[1]} ${time}`;
    }
    
    // 5. ABD formatı açık: MM/DD/YYYY
    const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
    if (usMatch) {
      const month = usMatch[1].padStart(2, '0');
      const day = usMatch[2].padStart(2, '0');
      const year = usMatch[3];
      const time = usMatch[4] || '00:00:00';
      return `${year}-${month}-${day} ${time}`;
    }
    
    // 6. PostgreSQL timestamp without time zone: 2025-12-13 20:33:42.123456
    if (str.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+/)) {
      return str.split('.')[0];
    }
    
    // 7. Son çare: Date.parse dene
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }
    
    // Tanınamadı - null dön, log at
    logger.warn('Unknown date format, returning NULL', { value: val });
    return null;
  }
  
  // Number (timestamp)
  if (typeof val === 'number') {
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }
  }
  
  return null;
}

// ============================================
// KAPSAMLI TARİH FORMAT DÖNÜŞTÜRÜCÜ
// Tüm SQL tarih formatlarını ClickHouse DateTime'a çevirir
// ============================================

/**
 * TÜM SQL TARİH FORMATLARINI ClickHouse DateTime'a çevirir
 * 
 * Desteklenen formatlar:
 * - ISO 8601: 2025-12-23T16:00:00.000Z, 2025-12-23T16:00:00Z
 * - ISO with offset: 2025-12-23T16:00:00+03:00
 * - SQL Server: 2025-12-23 16:00:00.0000000
 * - MySQL: 2025-12-23 16:00:00
 * - PostgreSQL: 2025-12-23 16:00:00.123456
 * - Date only: 2025-12-23
 * - European: 23/12/2025, 23.12.2025
 * - US: 12/23/2025
 * - JavaScript Date object
 * - Unix timestamp (number)
 * 
 * ClickHouse çıktı formatı: 'YYYY-MM-DD HH:mm:ss'
 */
function convertToClickHouseDateTime(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // 1. JavaScript Date objesi
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  
  // 2. Unix timestamp (number - milliseconds)
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    return null;
  }
  
  // 3. String formatları
  if (typeof value === 'string') {
    const val = value.trim();
    
    // A. ISO 8601 with T and optional timezone: 2025-12-23T16:00:00.000Z
    let match = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
    }
    
    // B. SQL Server format: 2025-12-23 16:00:00.0000000
    match = val.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
    }
    
    // C. MySQL/PostgreSQL: 2025-12-23 16:00:00
    match = val.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      return val; // Zaten doğru format
    }
    
    // D. Date only: 2025-12-23
    match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${val} 00:00:00`;
    }
    
    // E. European format: 23/12/2025 veya 23.12.2025
    match = val.match(/^(\d{2})[\/\.](\d{2})[\/\.](\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (match) {
      const time = match[4] ? ` ${match[4]}:${match[5]}:${match[6]}` : ' 00:00:00';
      return `${match[3]}-${match[2]}-${match[1]}${time}`;
    }
    
    // F. US format: 12/23/2025 (MM/DD/YYYY)
    match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (match) {
      const time = match[4] ? ` ${match[4]}:${match[5]}:${match[6]}` : ' 00:00:00';
      return `${match[3]}-${match[1]}-${match[2]}${time}`;
    }
    
    // G. YYYYMMDD format: 20251223
    match = val.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} 00:00:00`;
    }
    
    // H. SQL Server short: Dec 23 2025 4:00PM
    match = val.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})([AP]M)?$/i);
    if (match) {
      const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const mon = months[match[1].toLowerCase()] || '01';
      let hour = parseInt(match[4]);
      if (match[6]?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (match[6]?.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${match[3]}-${mon}-${match[2].padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${match[5]}:00`;
    }
    
    // Tanınamadı - null dön
    logger.warn('Unknown date format, returning null', { value: val });
    return null;
  }
  
  return null;
}

/**
 * Bir değerin tarih olup olmadığını kontrol et
 */
function isDateLikeValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return true;
  if (typeof value !== 'string') return false;
  
  const val = value.trim();
  
  // ISO format check
  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(val)) return true;
  // Date only
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return true;
  // European/US format
  if (/^\d{2}[\/\.]\d{2}[\/\.]\d{4}/.test(val)) return true;
  
  return false;
}

/**
 * Veri satırını ClickHouse için dönüştür
 * Tüm tarih benzeri değerleri ClickHouse DateTime formatına çevirir
 */
function transformRowForClickHouse(row: any): any {
  const transformed: any = {};
  
  for (const key in row) {
    const value = row[key];
    
    if (value === null || value === undefined) {
      transformed[key] = null;
      continue;
    }
    
    // Date objesi ise dönüştür
    if (value instanceof Date) {
      transformed[key] = convertToClickHouseDateTime(value);
      continue;
    }
    
    // Tarih benzeri string ise dönüştür
    if (typeof value === 'string' && isDateLikeValue(value)) {
      const converted = convertToClickHouseDateTime(value);
      transformed[key] = converted !== null ? converted : value;
      continue;
    }
    
    // Diğer değerler olduğu gibi
    transformed[key] = value;
  }
  
  return transformed;
}

/**
 * Veri batch'ini ClickHouse için dönüştür
 */
function transformBatchForClickHouse(rows: any[]): any[] {
  return rows.map(row => transformRowForClickHouse(row));
}

// ============================================
// TABLO YOKSA OLUŞTUR (SELF-HEALING)
// ============================================
// KAPSAMLI TİP DÖNÜŞÜM HARİTASI
// PostgreSQL/MySQL/MSSQL/Oracle → ClickHouse
// ============================================
const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // ============ INTEGER TYPES ============
  'int': 'Int32', 'int4': 'Int32', 'integer': 'Int32',
  'int2': 'Int16', 'smallint': 'Int16',
  'int8': 'Int64', 'bigint': 'Int64',
  'serial': 'Int32', 'bigserial': 'Int64', 'smallserial': 'Int16',
  'oid': 'UInt32', 'tinyint': 'Int8', 'mediumint': 'Int32', 'year': 'Int16',
  'number': 'Float64', 'pls_integer': 'Int32', 'binary_integer': 'Int32',
  
  // ============ FLOAT TYPES ============
  'float': 'Float64', 'float4': 'Float32', 'float8': 'Float64',
  'real': 'Float32', 'double': 'Float64', 'double precision': 'Float64',
  'decimal': 'Float64', 'numeric': 'Float64', 'money': 'Float64',
  'newdecimal': 'Float64', 'smallmoney': 'Float64',
  'binary_float': 'Float32', 'binary_double': 'Float64',
  
  // ============ STRING TYPES ============
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
  
  // ============ DATE/TIME TYPES ============
  'date': 'Date', 'time': 'String', 'timetz': 'String', 'interval': 'String',
  'timestamp': 'DateTime', 'timestamptz': 'DateTime',
  'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
  'datetime': 'DateTime', 'newdate': 'Date',
  'datetime2': 'DateTime', 'smalldatetime': 'DateTime', 'datetimeoffset': 'DateTime',
  'timestamp with local time zone': 'DateTime',
  
  // ============ BOOLEAN TYPES ============
  'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  
  // ============ BINARY TYPES ============
  'bytea': 'String', 'blob': 'String', 'tinyblob': 'String', 
  'mediumblob': 'String', 'longblob': 'String',
  'binary': 'String', 'varbinary': 'String', 'image': 'String',
  'raw': 'String', 'long raw': 'String', 'bfile': 'String',
  
  // ============ GEOMETRY TYPES ============
  'geometry': 'String', 'geography': 'String', 'point': 'String',
  'linestring': 'String', 'polygon': 'String',
};

function mapSourceTypeToClickHouse(sourceType: string): string {
  if (!sourceType) return 'String';
  const normalized = sourceType.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Parantez içindeki değerleri temizle: varchar(255) → varchar
  const baseType = normalized.split('(')[0].trim();
  
  return SQL_TO_CLICKHOUSE_TYPE[baseType] || SQL_TO_CLICKHOUSE_TYPE[normalized] || 'String';
}

// ============================================
// UI'dan sync tetiklendiğinde tablo yoksa otomatik oluşturur
// ============================================
async function ensureTableExists(dataset: any): Promise<void> {
  const tableName = dataset.clickhouse_table;
  
  try {
    // Tablo var mı kontrol et
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
    
    // column_mapping'den tablo yapısını oluştur
    const columnMapping = dataset.column_mapping || [];
    
    if (columnMapping.length === 0) {
      throw new Error(`Dataset ${dataset.name} için column_mapping bulunamadı. Tablo oluşturulamıyor.`);
    }
    
    // Kolonları oluştur - KAPSAMLI TİP DÖNÜŞÜM
    const columns = columnMapping.map((col: any) => {
      const targetName = col.target || col.source;
      
      // 1. Önce UI'dan gelen clickhouseType'ı kullan
      let chType = col.clickhouseType;
      
      // 2. clickhouseType yoksa, kaynak tipten dönüştür
      if (!chType || chType === 'String') {
        const sourceType = col.sourceType || col.type || '';
        chType = mapSourceTypeToClickHouse(sourceType);
      }
      
      // 3. Decimal tipi Float64 olarak sakla (SUM, AVG çalışsın!)
      if (chType && chType.startsWith('Decimal')) {
        chType = 'Float64';
      }
      
      // 4. Sayısal kolonları algıla (kolon adından - fallback)
      const numericPatterns = [
        'amount', 'tutar', 'price', 'fiyat', 'total', 'toplam', 
        'adet', 'quantity', 'miktar', 'indirim', 'discount', 
        'brut', 'net', 'gross', 'ucret', 'maas', 'salary', 'fee',
        'cost', 'maliyet', 'borc', 'alacak', 'bakiye', 'balance'
      ];
      if (chType === 'String' && numericPatterns.some(p => targetName.toLowerCase().includes(p))) {
        chType = 'Float64';
        logger.debug('Auto-detected numeric column from name', { column: targetName, type: chType });
      }
      
      return `${targetName} ${chType}`;
    });
    
    // ORDER BY için uygun kolon bul
    const orderByCol = columnMapping.find((c: any) => {
      const name = c.target || c.source;
      return name === 'id' || name === 'kod' || name === 'code' ||
        c.clickhouseType === 'Date' || c.clickhouseType === 'DateTime';
    });
    const orderByColumn = orderByCol ? (orderByCol.target || orderByCol.source) : '_synced_at';
    
    const createSql = `
      CREATE TABLE IF NOT EXISTS clixer_analytics.${tableName} (
        ${columns.join(',\n        ')},
        _synced_at DateTime DEFAULT now()
      )
      ENGINE = MergeTree()
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

// ============================================
// SQL SORGUDAN TABLO ADI ÇIKARICI
// ============================================
function extractTableFromQuery(query: string): string | null {
  if (!query) return null;
  
  // MSSQL formatı: [schema].[table] veya [table]
  // Standard format: schema.table veya table
  
  // Önce MSSQL köşeli parantez formatını dene: [dbo].[transaction_items]
  const mssqlMatch = query.match(/\bFROM\s+\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?\.\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?/i);
  if (mssqlMatch) {
    // schema.table formatında döndür (köşeli parantezler olmadan)
    return `${mssqlMatch[1]}.${mssqlMatch[2]}`;
  }
  
  // Sadece tablo adı (köşeli parantezli veya değil): [transaction_items] veya transaction_items
  const tableMatch = query.match(/\bFROM\s+\[?([a-zA-Z_][a-zA-Z0-9_]*)\]?(?:\s|$|;|,|\))/i);
  if (tableMatch) {
    return tableMatch[1];
  }
  
  return null;
}

// ============================================
// TİP UYUMLULUK KONTROLÜ (MUST!)
// ClickHouse tablo tipleri ile kaynak DB tipleri UYUMLU OLMAK ZORUNDA
// ============================================

interface TypeMismatch {
  column: string;
  sourceType: string;
  clickhouseType: string;
  compatible: boolean;
}

/**
 * SQL tipini ClickHouse tipine dönüştür
 */
function sqlToClickHouseType(sqlType: string): string {
  if (!sqlType) return 'String';
  
  const normalized = sqlType.toLowerCase().trim();
  
  const typeMap: Record<string, string> = {
    // Integer types
    'int': 'Int32', 'int4': 'Int32', 'integer': 'Int32',
    'int2': 'Int16', 'smallint': 'Int16',
    'int8': 'Int64', 'bigint': 'Int64',
    'tinyint': 'Int8',
    'serial': 'Int32', 'bigserial': 'Int64',
    
    // Float types
    'float': 'Float64', 'float4': 'Float32', 'float8': 'Float64',
    'real': 'Float32', 'double': 'Float64', 'double precision': 'Float64',
    'decimal': 'Float64', 'numeric': 'Float64', 'money': 'Float64',
    
    // String types
    'text': 'String', 'varchar': 'String', 'char': 'String',
    'nvarchar': 'String', 'nchar': 'String', 'ntext': 'String',
    'uuid': 'String', 'uniqueidentifier': 'String',
    
    // Date/Time types
    'date': 'Date',
    'datetime': 'DateTime', 'datetime2': 'DateTime',
    'timestamp': 'DateTime', 'timestamptz': 'DateTime',
    
    // Boolean
    'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  };
  
  // Parantez içini kaldır (varchar(255) -> varchar)
  const baseType = normalized.replace(/\(.*\)/, '').trim();
  
  return typeMap[baseType] || typeMap[normalized] || 'String';
}

/**
 * İki ClickHouse tipi uyumlu mu kontrol et
 */
function areTypesCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  
  // Int32 ↔ Int64 uyumlu (upcast)
  if (expected.startsWith('Int') && actual.startsWith('Int')) return true;
  
  // Float32 ↔ Float64 uyumlu
  if (expected.startsWith('Float') && actual.startsWith('Float')) return true;
  
  // String her şeyle uyumlu (en geniş tip)
  if (actual === 'String') return true;
  
  return false;
}

/**
 * Kaynak tablo ve ClickHouse tablo tiplerini karşılaştır
 * MUST: Sync başlamadan önce çağrılmalı!
 */
async function validateTypeCompatibility(
  dataset: any, 
  connection: any
): Promise<{ valid: boolean; mismatches: TypeMismatch[]; warning: string | null }> {
  const mismatches: TypeMismatch[] = [];
  
  try {
    // 1. Kaynak tablo tiplerini al (column_mapping'den)
    const columnMapping = typeof dataset.column_mapping === 'string' 
      ? JSON.parse(dataset.column_mapping) 
      : dataset.column_mapping;
    
    if (!columnMapping || columnMapping.length === 0) {
      logger.warn('No column mapping found, skipping type validation');
      return { valid: true, mismatches: [], warning: null };
    }
    
    // 2. ClickHouse tablo var mı?
    if (!dataset.clickhouse_table) {
      return { valid: true, mismatches: [], warning: null };
    }
    
    // 3. ClickHouse tablo tiplerini al
    const chColumns = await clickhouse.query(`
      DESCRIBE TABLE clixer_analytics.${dataset.clickhouse_table}
    `);
    
    if (!chColumns || chColumns.length === 0) {
      return { valid: true, mismatches: [], warning: null };
    }
    
    const chTypeMap: Record<string, string> = {};
    for (const col of chColumns) {
      chTypeMap[col.name] = col.type;
    }
    
    // 4. Her kolon için tip karşılaştır
    for (const col of columnMapping) {
      const colName = col.target || col.targetName || col.source || col.sourceName;
      const sqlType = col.sqlType || col.sourceType || col.type || '';
      const expectedChType = col.clickhouseType || sqlToClickHouseType(sqlType);
      const actualChType = chTypeMap[colName];
      
      if (actualChType && !areTypesCompatible(expectedChType, actualChType)) {
        mismatches.push({
          column: colName,
          sourceType: expectedChType,
          clickhouseType: actualChType,
          compatible: false
        });
      }
    }
    
    if (mismatches.length > 0) {
      const warning = `Tip uyumsuzluğu: ${mismatches.map(m => `${m.column}(${m.sourceType}→${m.clickhouseType})`).join(', ')}`;
      logger.error('🚨 TYPE MISMATCH DETECTED!', { mismatches, dataset: dataset.name });
      return { valid: false, mismatches, warning };
    }
    
    return { valid: true, mismatches: [], warning: null };
    
  } catch (error: any) {
    logger.warn('Type validation failed, proceeding with caution', { error: error.message });
    return { valid: true, mismatches: [], warning: `Tip kontrolü yapılamadı: ${error.message}` };
  }
}

// ============================================
// VERİ TUTARLILIK VE DUPLICATE ÖNLEME SİSTEMİ
// ============================================

interface DataValidationResult {
  sourceCount: number;
  targetCount: number;
  isConsistent: boolean;
  duplicateCount: number;
  message: string;
}

/**
 * ReplacingMergeTree için OPTIMIZE çalıştır - Duplicate'ları temizler
 * CRITICAL: Her sync sonrası çağrılmalı!
 */
async function optimizeTable(tableName: string): Promise<number> {
  try {
    // Önce duplicate sayısını bul
    const beforeCount = await clickhouse.queryOne(
      `SELECT count() as cnt FROM clixer_analytics.${tableName}`
    );
    
    // OPTIMIZE FINAL - ReplacingMergeTree duplicate'ları temizler
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${tableName} FINAL`);
    
    // Sonraki sayıyı al
    const afterCount = await clickhouse.queryOne(
      `SELECT count() as cnt FROM clixer_analytics.${tableName}`
    );
    
    const removedDuplicates = (beforeCount?.cnt || 0) - (afterCount?.cnt || 0);
    
    if (removedDuplicates > 0) {
      logger.info('Duplicates removed by OPTIMIZE', { 
        tableName, 
        before: beforeCount?.cnt, 
        after: afterCount?.cnt, 
        removed: removedDuplicates 
      });
    }
    
    return removedDuplicates;
  } catch (error: any) {
    logger.warn('OPTIMIZE failed (non-critical)', { tableName, error: error.message });
    return 0;
  }
}

/**
 * Veri tutarlılık kontrolü
 * Kaynak ve hedef satır sayısını karşılaştırır
 */
async function validateDataConsistency(
  dataset: any, 
  sourceClient: any, 
  expectedRows: number
): Promise<DataValidationResult> {
  try {
    // ClickHouse'daki satır sayısı
    const targetResult = await clickhouse.queryOne(
      `SELECT count() as cnt FROM clixer_analytics.${dataset.clickhouse_table}`
    );
    const targetCount = targetResult?.cnt || 0;
    
    // Duplicate kontrolü (ORDER BY key'e göre grup sayısı)
    let duplicateCount = 0;
    try {
      // ReplacingMergeTree için OPTIMIZE çalıştır
      duplicateCount = await optimizeTable(dataset.clickhouse_table);
    } catch (e) {
      // Ignore
    }
    
    // Tolerans: %1 fark kabul edilebilir (bazı kayıtlar filtrelenmiş olabilir)
    const tolerance = Math.ceil(expectedRows * 0.01);
    const isConsistent = Math.abs(targetCount - expectedRows) <= tolerance;
    
    const result: DataValidationResult = {
      sourceCount: expectedRows,
      targetCount,
      isConsistent,
      duplicateCount,
      message: isConsistent 
        ? `✅ Veri tutarlı: ${targetCount} satır (beklenen: ${expectedRows})`
        : `⚠️ Veri uyumsuzluğu: ${targetCount} satır (beklenen: ${expectedRows}, fark: ${Math.abs(targetCount - expectedRows)})`
    };
    
    logger.info('Data validation completed', result);
    return result;
  } catch (error: any) {
    return {
      sourceCount: expectedRows,
      targetCount: 0,
      isConsistent: false,
      duplicateCount: 0,
      message: `❌ Doğrulama hatası: ${error.message}`
    };
  }
}

/**
 * Partition bazlı duplicate kontrolü
 * Date partition'larda aynı günün verileri tekrar etmemeli
 */
async function checkPartitionDuplicates(
  tableName: string, 
  partitionColumn: string,
  dateValue: string
): Promise<number> {
  try {
    // Aynı tarih için kaç satır var?
    const result = await clickhouse.queryOne(`
      SELECT count() as cnt 
      FROM clixer_analytics.${tableName} 
      WHERE toDate(${partitionColumn}) = '${dateValue}'
    `);
    return result?.cnt || 0;
  } catch (error) {
    return 0;
  }
}

// ============================================
// DATASET LOCK MEKANİZMASI
// Aynı dataset için aynı anda sadece bir job çalışabilir!
// ============================================
const LOCK_TTL = 3600; // 1 saat lock timeout (sonsuz çalışmayı önler)

/**
 * Dataset için lock al
 * @returns true eğer lock alındıysa, false eğer zaten kilitliyse
 */
async function acquireDatasetLock(datasetId: string): Promise<boolean> {
  const lockKey = `etl:lock:${datasetId}`;
  try {
    // SETNX equivalent - sadece key yoksa set et
    const result = await cache.setNX(lockKey, JSON.stringify({
      pid: process.pid,
      startedAt: new Date().toISOString()
    }), LOCK_TTL);
    
    if (result) {
      logger.info('Dataset lock acquired', { datasetId });
      return true;
    } else {
      // Lock zaten var - kim tarafından alınmış kontrol et
      const existing = await cache.get(lockKey);
      logger.warn('Dataset already locked (duplicate job prevention)', { 
        datasetId, 
        existingLock: existing 
      });
      return false;
    }
  } catch (error) {
    logger.error('Failed to acquire dataset lock', { datasetId, error });
    return false;
  }
}

/**
 * Dataset lock'ını serbest bırak
 */
async function releaseDatasetLock(datasetId: string): Promise<void> {
  const lockKey = `etl:lock:${datasetId}`;
  try {
    await cache.del(lockKey);
    logger.info('Dataset lock released', { datasetId });
  } catch (error) {
    logger.error('Failed to release dataset lock', { datasetId, error });
  }
}

/**
 * Job iptal edildi mi kontrol et
 */
async function isJobCancelled(jobId: string): Promise<boolean> {
  const cancelKey = `etl:cancel:${jobId}`;
  const cancelled = await cache.get(cancelKey);
  return cancelled === 'true';
}

/**
 * Kill signal gönder
 */
async function sendKillSignal(jobId: string): Promise<void> {
  const cancelKey = `etl:cancel:${jobId}`;
  await cache.set(cancelKey, 'true', 3600);
  logger.info('Kill signal sent', { jobId });
}

// Memory kullanımını kontrol et
function checkMemory(): { usedMB: number; ok: boolean } {
  const used = process.memoryUsage();
  const usedMB = Math.round(used.heapUsed / 1024 / 1024);
  const ok = usedMB < MAX_MEMORY_MB;
  if (!ok) {
    logger.warn('High memory usage detected', { usedMB, maxMB: MAX_MEMORY_MB });
  }
  return { usedMB, ok };
}

// Garbage collector'ı manual tetikle (varsa)
function forceGC() {
  if (global.gc) {
    global.gc();
    logger.debug('Manual garbage collection triggered');
  }
}

// ============================================
// ETL JOB PROCESSOR
// ============================================

interface ETLJob {
  datasetId: string;
  jobId?: string;
  action: 'initial_sync' | 'incremental_sync' | 'full_refresh' | 'manual_sync' | 'partial_refresh' | 'missing_sync' | 'new_records_sync';
  triggeredBy?: string;
  days?: number; // Partial refresh için gün sayısı
  ranges?: Array<{start: number; end: number; missing_count?: number}>; // missing_sync için eksik ID aralıkları
  pkColumn?: string; // ⚠️ KULLANICI SEÇTİĞİ PK KOLONU - hardcoded değil!
  afterId?: number; // new_records_sync için: Bu ID'den sonraki kayıtları çek
  limit?: number; // Opsiyonel satır limiti
}

async function processETLJob(job: ETLJob): Promise<void> {
  const startTime = Date.now();
  logger.info('Starting ETL job', job);

  try {
    // Dataset bilgisini al
    const dataset = await db.queryOne(
      'SELECT * FROM datasets WHERE id = $1',
      [job.datasetId]
    );

    if (!dataset) {
      throw new Error(`Dataset not found: ${job.datasetId}`);
    }

    // Connection bilgisini al
    const connection = await db.queryOne(
      'SELECT * FROM data_connections WHERE id = $1',
      [dataset.connection_id]
    );

    if (!connection) {
      throw new Error(`Connection not found: ${dataset.connection_id}`);
    }

    // ============================================
    // MUST: TİP UYUMLULUK KONTROLÜ
    // Sync başlamadan önce kaynak ve hedef tipleri karşılaştır
    // ============================================
    const typeValidation = await validateTypeCompatibility(dataset, connection);
    if (!typeValidation.valid) {
      const errorMsg = `TİP UYUMSUZLUĞU: ${typeValidation.warning}. Tabloyu silip yeniden oluşturun.`;
      logger.error('🚨 Sync blocked due to type mismatch', { 
        dataset: dataset.name, 
        mismatches: typeValidation.mismatches 
      });
      
      // Job'ı failed olarak işaretle
      if (job.jobId) {
        await db.query(
          `UPDATE etl_jobs SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
          [errorMsg, job.jobId]
        );
      }
      throw new Error(errorMsg);
    }
    
    if (typeValidation.warning) {
      logger.warn('Type validation warning', { warning: typeValidation.warning });
    }

    // ETL job kaydı: Eğer jobId varsa (data-service'ten geldiyse) onu kullan, yoksa yeni oluştur
    let etlJobId: string;
    
    if (job.jobId) {
      // data-service zaten job oluşturdu, sadece running yap
      await db.query(
        `UPDATE etl_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
        [job.jobId]
      );
      etlJobId = job.jobId;
      logger.info('Using existing job from data-service', { jobId: job.jobId });
    } else {
      // Eski stil trigger veya initial_sync - yeni job oluştur
      // Ama önce duplicate kontrolü yap
      const existingJob = await db.queryOne(
        `SELECT id FROM etl_jobs WHERE dataset_id = $1 AND status IN ('pending', 'running') LIMIT 1`,
        [job.datasetId]
      );
      
      if (existingJob) {
        logger.warn('Duplicate job prevented in ETL Worker', { datasetId: job.datasetId, existingJobId: existingJob.id });
        return; // Duplicate job, atla
      }
      
      const etlJob = await db.queryOne(
        `INSERT INTO etl_jobs (tenant_id, dataset_id, action, status, started_at)
         VALUES ($1, $2, $3, 'running', NOW())
         RETURNING id`,
        [dataset.tenant_id, job.datasetId, job.action]
      );
      etlJobId = etlJob.id;
    }
    
    const etlJob = { id: etlJobId };

    let rowsProcessed = 0;

    try {
      // ============================================
      // INITIAL_SYNC - İlk oluşturmada SADECE test verisi yaz!
      // LIMIT'i KORUYARAK source_query'yi çalıştır (10 satır)
      // Bu sayede ID-Based/Time-Based sync için referans noktası olur
      // ============================================
      if (job.action === 'initial_sync') {
        logger.info('🧪 INITIAL SYNC - Test verisi yazılıyor (LIMIT korunuyor)', { 
          datasetId: job.datasetId,
          sourceQuery: dataset.source_query?.substring(0, 100)
        });
        rowsProcessed = await initialTestSync(dataset, connection, etlJobId);
      }
      // ============================================
      // PARTIAL REFRESH - Özel aksiyon (UI'dan gelen)
      // ============================================
      else if (job.action === 'partial_refresh') {
        logger.info('Executing partial refresh', { 
          datasetId: job.datasetId, 
          days: dataset.refresh_window_days,
          partitionColumn: dataset.partition_column 
        });
        rowsProcessed = await syncByDatePartition(dataset, connection, etlJobId);
      }
      // ============================================
      // MISSING SYNC - Sadece eksik ID aralıklarını çek
      // ============================================
      else if (job.action === 'missing_sync') {
        logger.info('🔍 MISSING SYNC - Eksik ID aralıkları çekiliyor', { 
          datasetId: job.datasetId,
          rangesCount: job.ranges?.length || 0,
          pkColumn: job.pkColumn || 'id'
        });
        rowsProcessed = await syncMissingRanges(dataset, connection, etlJobId, job.ranges || [], job.pkColumn || 'id');
      }
      // ============================================
      // 🚀 NEW RECORDS SYNC - Max ID'den sonraki yeni kayıtları çek
      // 100M+ tablolar için en verimli yöntem!
      // ============================================
      else if (job.action === 'new_records_sync') {
        const pkColumn = job.pkColumn || 'id';
        const afterId = job.afterId || 0;
        const limit = job.limit;
        
        logger.info('🚀 NEW RECORDS SYNC - Sadece yeni kayıtlar çekiliyor', { 
          datasetId: job.datasetId,
          pkColumn,
          afterId,
          limit: limit || 'UNLIMITED'
        });
        
        rowsProcessed = await syncNewRecordsAfterMaxId(dataset, connection, etlJobId, pkColumn, afterId, limit);
      } else {
        // Sync stratejisine göre veri çek - jobId'yi geçir progress için
        switch (dataset.sync_strategy) {
          case 'timestamp':
            rowsProcessed = await syncByTimestamp(dataset, connection, etlJobId);
            break;
          case 'id':
            rowsProcessed = await syncById(dataset, connection, etlJobId);
            break;
          case 'date_partition':
            rowsProcessed = await syncByDatePartition(dataset, connection, etlJobId);
            break;
          case 'date_delete_insert':
            rowsProcessed = await syncByDateDeleteInsert(dataset, connection, etlJobId);
            break;
          case 'full_refresh':
          default:
            rowsProcessed = await fullRefresh(dataset, connection, etlJobId);
        }
      }

      // Job başarılı
      await db.query(
        `UPDATE etl_jobs SET status = 'completed', completed_at = NOW(), rows_processed = $1 WHERE id = $2`,
        [rowsProcessed, etlJob.id]
      );

      // Dataset son sync zamanını ve satır sayısını güncelle
      // ClickHouse'dan gerçek satır sayısını al
      let totalRows = rowsProcessed;
      try {
        if (dataset.clickhouse_table) {
          const countResult = await clickhouse.query(`SELECT count() as cnt FROM clixer_analytics.${dataset.clickhouse_table}`);
          totalRows = countResult[0]?.cnt || rowsProcessed;
        }
      } catch (e) {
        logger.warn('Could not get total rows from ClickHouse', { error: e });
      }
      
      await db.query(
        `UPDATE datasets SET last_sync_at = NOW(), last_sync_rows = $1, total_rows = $2, status = 'active' WHERE id = $3`,
        [rowsProcessed, totalRows, job.datasetId]
      );

      // Cache invalidate
      await cache.invalidate(`kpi:${dataset.clickhouse_table}:*`, 'etl');

      // Event yayınla
      await cache.publish('etl:completed', {
        datasetId: job.datasetId,
        rowsProcessed,
        duration: Date.now() - startTime
      });

      logger.info('ETL job completed', {
        datasetId: job.datasetId,
        rowsProcessed,
        duration: `${Date.now() - startTime}ms`
      });

    } catch (error: any) {
      // Job başarısız
      await db.query(
        `UPDATE etl_jobs SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
        [error.message, etlJob.id]
      );
      throw error;
    }

  } catch (error) {
    logger.error('ETL job failed', { job, error });
    throw error;
  }
}

// ============================================
// STREAMING POSTGRESQL SYNC
// 200M+ satır sorunsuz işlenir - bellek sabit kalır
// ============================================

const STREAM_BATCH_SIZE = 10000; // Cursor'dan bir seferde okunacak satır
const INSERT_BATCH_SIZE = 5000;  // ClickHouse'a yazılacak batch boyutu

async function streamingPostgreSQLSync(
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
    password: connection.password_encrypted,
  });
  
  await client.connect();
  
  // Source query oluştur - LIMIT YOK! Streaming ile hepsini alacağız
  let query = dataset.source_query || `SELECT * FROM ${dataset.source_table}`;
  
  // ❗ KRITIK: Dataset oluşturulurken LIMIT 10 ile test edilmiş olabilir!
  // Full Refresh'te TÜM veriyi çekmek için LIMIT'i kaldır
  query = query.replace(/\s+LIMIT\s+\d+\s*/gi, ' ').trim();
  
  // Custom WHERE koşulu varsa ekle (Full Refresh için kullanıcı tanımlı filtre)
  const customWhere = dataset.custom_where;
  if (customWhere && customWhere.trim()) {
    // Sorgunun zaten WHERE içerip içermediğini kontrol et
    if (query.toUpperCase().includes(' WHERE ')) {
      // Varsa AND ile ekle
      query = `${query} AND (${customWhere})`;
    } else {
      // Yoksa WHERE ekle
      query = `${query} WHERE ${customWhere}`;
    }
    logger.info('Custom WHERE applied', { customWhere });
  }
  
  // Ama row_limit varsa ona uyalım
  const rowLimit = dataset.row_limit || null; // null = sınırsız
  
  logger.info('🚀 STREAMING ETL starting', { 
    datasetId: dataset.id,
    table: dataset.clickhouse_table,
    query: query.substring(0, 100),
    customWhere: customWhere || 'none',
    rowLimit: rowLimit || 'UNLIMITED',
    streamBatchSize: STREAM_BATCH_SIZE
  });
  
  // Cursor oluştur
  const cursor = client.query(new Cursor(query));
  
  let totalInserted = 0;
  let batchNumber = 0;
  let insertBuffer: any[] = [];
  let columns: string[] = [];
  
  // ClickHouse tablosunu truncate et
  try {
    await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${dataset.clickhouse_table}`);
    logger.info('Truncated ClickHouse table', { table: dataset.clickhouse_table });
  } catch (truncErr: any) {
    logger.warn('Could not truncate, trying ALTER DELETE', { error: truncErr.message });
    await clickhouse.execute(`ALTER TABLE clixer_analytics.${dataset.clickhouse_table} DELETE WHERE 1=1`);
  }
  
  // Streaming okuma döngüsü
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
      // Kill check
      if (jobId && await isJobCancelled(jobId)) {
        logger.info('Job cancelled during streaming', { jobId, totalInserted });
        break;
      }
      
      // Batch oku
      const rows = await readBatch();
      
      if (rows.length === 0) {
        // Veri bitti
        break;
      }
      
      batchNumber++;
      
      // İlk batch'te column mapping oluştur (eğer yoksa)
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
      
      // Satırları dönüştür ve buffer'a ekle
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
        
        // Buffer doluysa ClickHouse'a yaz
        if (insertBuffer.length >= INSERT_BATCH_SIZE) {
          await insertToClickHouse(dataset.clickhouse_table, columns, insertBuffer);
          totalInserted += insertBuffer.length;
          insertBuffer = []; // Buffer'ı temizle - bellek serbest
          
          // Her 50K satırda progress log
          if (totalInserted % 50000 === 0) {
            const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
            logger.info('📊 Streaming progress', { 
              totalInserted: totalInserted.toLocaleString(),
              memoryMB: memMB,
              batchNumber
            });
            
            // GC tetikle
            forceGC();
          }
        }
        
        // Row limit kontrolü
        if (rowLimit && totalInserted + insertBuffer.length >= rowLimit) {
          break;
        }
      }
      
      // Row limit kontrolü (dış döngü için)
      if (rowLimit && totalInserted + insertBuffer.length >= rowLimit) {
        break;
      }
    }
    
    // Kalan buffer'ı yaz
    if (insertBuffer.length > 0) {
      await insertToClickHouse(dataset.clickhouse_table, columns, insertBuffer);
      totalInserted += insertBuffer.length;
    }
    
  } finally {
    // Cursor ve client'ı kapat
    await new Promise<void>((resolve) => cursor.close(() => resolve()));
    await client.end();
    forceGC();
  }
  
  const memMB = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
  logger.info('✅ STREAMING ETL completed', { 
    datasetId: dataset.id, 
    totalInserted: totalInserted.toLocaleString(),
    finalMemoryMB: memMB
  });
  
  return totalInserted;
}

/**
 * ClickHouse'a batch insert
 * DateTime formatı: YYYY-MM-DD HH:MM:SS
 * Akıllı tarih dönüştürücü ile tüm formatlar desteklenir
 */
async function insertToClickHouse(tableName: string, columns: string[], rows: any[]): Promise<void> {
  if (rows.length === 0) return;
  
  const values = rows.map(row => {
    const vals = columns.map((col: string) => {
      const val = row[col];
      
      // Tarih/DateTime kontrolü - önce akıllı dönüştürücüyü dene
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

// ============================================
// INITIAL TEST SYNC - İlk oluşturmada LIMIT'i KORUYARAK test verisi yaz
// Bu fonksiyon sadece dataset ilk oluşturulduğunda çalışır
// LIMIT 10 ile gelen sorguyu OLDUĞU GİBİ çalıştırır
// Böylece ID-Based/Time-Based sync için referans noktası oluşur
// ============================================
async function initialTestSync(dataset: any, connection: any, jobId?: string): Promise<number> {
  logger.info('🧪 Initial Test Sync starting - LIMIT korunuyor!', { 
    datasetId: dataset.id,
    table: dataset.clickhouse_table,
    connectionType: connection.type
  });
  
  try {
    // 🔧 SELF-HEALING: Tablo yoksa otomatik oluştur
    await ensureTableExists(dataset);
    
    const columnMapping = dataset.column_mapping || [];
    
    // ❗ KRİTİK: source_query'yi OLDUĞU GİBİ kullan - LIMIT KALDIRMA!
    const query = dataset.source_query || `SELECT * FROM ${dataset.source_table} LIMIT 10`;
    
    logger.info('Initial test query (LIMIT korunuyor)', { query: query.substring(0, 200) });
    
    let rows: any[] = [];
    
    // Bağlantı tipine göre veri çek
    if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted,
      });
      await client.connect();
      const result = await client.query(query);
      rows = result.rows;
      await client.end();
    } 
    else if (connection.type === 'mysql') {
      const mysql = require('mysql2/promise');
      const conn = await mysql.createConnection({
        host: connection.host,
        port: connection.port || 3306,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted,
        charset: 'utf8mb4',
        dateStrings: true
      });
      const [result] = await conn.query(query);
      rows = result as any[];
      await conn.end();
    }
    else if (connection.type === 'mssql') {
      const mssql = require('mssql');
      const isAzure = connection.host.includes('.database.windows.net');
      const pool = await mssql.connect({
        server: connection.host,
        port: connection.port || 1433,
        database: connection.database_name,
        user: connection.username,
        password: connection.password_encrypted,
        options: { encrypt: isAzure, trustServerCertificate: !isAzure }
      });
      const result = await pool.request().query(query);
      rows = result.recordset;
      await pool.close();
    }
    
    logger.info('Initial test data fetched', { rowCount: rows.length });
    
    if (rows.length === 0) {
      logger.warn('No test data fetched - table will be empty');
      return 0;
    }
    
    // ClickHouse'a yaz (TRUNCATE YOK - tablo zaten boş)
    const insertData = rows.map((row: any) => {
      const obj: any = {};
      for (const col of columnMapping) {
        const sourceCol = col.source || col.sourceName;
        const targetCol = col.target || col.targetName;
        let val = row[sourceCol];
        
        // DateTime dönüşümü
        if (col.clickhouseType === 'DateTime' || col.clickhouseType === 'Date') {
          val = toClickHouseDateTime(val) || '1970-01-01 00:00:00';
        }
        
        // Null handling
        if (val === null || val === undefined) {
          if (col.clickhouseType === 'String') val = '';
          else if (col.clickhouseType?.includes('Int') || col.clickhouseType?.includes('Float')) val = 0;
          else val = '';
        }
        
        obj[targetCol] = val;
      }
      return obj;
    });
    
    await clickhouse.insert(`clixer_analytics.${dataset.clickhouse_table}`, insertData);
    
    logger.info('✅ Initial test sync completed', { 
      datasetId: dataset.id,
      rowsInserted: rows.length 
    });
    
    return rows.length;
    
  } catch (error: any) {
    logger.error('Initial test sync failed', { 
      datasetId: dataset.id, 
      error: error.message 
    });
    throw error;
  }
}

// ============================================
// SYNC STRATEGIES
// ============================================

async function syncByTimestamp(dataset: any, connection: any, jobId?: string): Promise<number> {
  // 🔧 SELF-HEALING: Tablo yoksa otomatik oluştur
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

  // Referans kolon kontrolü
  if (!reference_column) {
    logger.warn('No reference column defined, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }

  // Source kontrolü
  const sourceTableName = extractTableFromQuery(source_query || `SELECT * FROM ${source_table}`);
  if (!sourceTableName) {
    throw new Error('Kaynak tablo bulunamadı');
  }

  try {
    // Son sync değerini al (yoksa tüm veriyi çek)
    let lastValue = last_sync_value;
    
    // Eğer last_sync_value yoksa, ClickHouse'tan en son değeri al
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

    // column_mapping'i parse et
    let columnMapping = dataset.column_mapping || [];
    if (typeof columnMapping === 'string') {
      try {
        columnMapping = JSON.parse(columnMapping);
      } catch (e) {
        columnMapping = [];
      }
    }

    if (connection.type === 'mssql') {
      const columns = columnMapping.map((c: any) => c.source).join(', ') || '*';
      let whereClause = '';
      
      if (lastValue) {
        // MSSQL datetime formatı
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

    // Son sync değerini güncelle
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

    // OPTIMIZE çalıştır
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

async function syncById(dataset: any, connection: any, jobId?: string): Promise<number> {
  // 🔧 SELF-HEALING: Tablo yoksa otomatik oluştur
  await ensureTableExists(dataset);
  
  const { clickhouse_table, source_table, source_query, reference_column, row_limit } = dataset;
  
  // Referans kolon kontrolü
  if (!reference_column) {
    logger.warn('No reference column for ID-based sync, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }
  
  // Kaynak tablo veya sorgu kontrolü
  const sourceTableName = source_table || (source_query ? extractTableFromQuery(source_query) : null);
  if (!sourceTableName) {
    logger.warn('No source table or query for ID-based sync, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }
  
  logger.info('ID-Based incremental sync starting', { 
    datasetId: dataset.id, 
    table: clickhouse_table,
    sourceTable: sourceTableName,
    referenceColumn: reference_column
  });
  
  try {
    // 1. ClickHouse'tan mevcut max ID'yi al
    // NOT: ID kolonu String olabilir, bu yüzden toInt64OrZero ile sayıya çeviriyoruz!
    let maxId = 0;
    try {
      const maxResult = await clickhouse.queryOne(`
        SELECT max(toInt64OrZero(toString(${reference_column}))) as max_id FROM clixer_analytics.${clickhouse_table}
      `);
      maxId = parseInt(maxResult?.max_id || '0') || 0;
      logger.info('Current max ID in ClickHouse (converted to Int64)', { maxId, table: clickhouse_table });
    } catch (e: any) {
      logger.warn('Could not get max ID, will fetch all', { error: e.message });
    }
    
    // 2. Kaynaktan sadece yeni kayıtları çek (WHERE id > maxId)
    // ⚠️ row_limit string olarak gelebilir, integer'a çevir!
    const limit = parseInt(String(row_limit)) || 10000000;
    let totalInserted = 0;
    
    if (connection.type === 'mssql') {
      const sql = require('mssql');
      const isAzure = connection.host?.includes('.database.windows.net');
      
      const config = {
        user: connection.username,
        password: connection.password_encrypted,
        server: connection.host,
        database: connection.database_name,
        port: connection.port || 1433,
        options: {
          encrypt: isAzure,
          trustServerCertificate: !isAzure
        },
        requestTimeout: 600000 // 10 dakika
      };
      
      const pool = await sql.connect(config);
      
      // ============================================
      // CURSOR/PAGINATION MANTIĞI - 5000'erlik parçalar
      // Bellek dolmaz, milyonlarca satır çekilebilir!
      // ============================================
      const BATCH_SIZE = 5000;
      let currentMaxId = maxId;
      let lastFetchedId = maxId;
      let hasMoreData = true;
      
      logger.info('MSSQL ID-based sync with cursor starting', { 
        startMaxId: maxId, 
        batchSize: BATCH_SIZE,
        rowLimit: limit 
      });
      
      while (hasMoreData && (limit === null || totalInserted < limit)) {
        const remainingLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
        const query = `SELECT TOP ${remainingLimit} * FROM ${sourceTableName} WHERE ${reference_column} > ${currentMaxId} ORDER BY ${reference_column}`;
        
        const result = await pool.request().query(query);
        const rows = result.recordset;
        
        if (rows.length === 0) {
          hasMoreData = false;
          logger.info('No more rows to fetch', { currentMaxId, totalInserted });
          break;
        }
        
        // ClickHouse'a yaz
        const transformedBatch = transformBatchForClickHouse(rows);
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedBatch);
        totalInserted += rows.length;
        
        // Sonraki parça için max ID güncelle
        lastFetchedId = rows[rows.length - 1][reference_column];
        currentMaxId = lastFetchedId;
        
        // Progress güncelle
        if (jobId) {
          await db.query(
            `UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`,
            [totalInserted, jobId]
          );
        }
        
        logger.info('MSSQL cursor batch inserted', { 
          batchSize: rows.length, 
          totalInserted, 
          currentMaxId
        });
        
        if (limit && totalInserted >= limit) {
          hasMoreData = false;
        }
      }
      
      await pool.close();
      
      if (totalInserted > 0) {
        await db.query(
          `UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2`,
          [String(lastFetchedId), dataset.id]
        );
        logger.info('Updated last_sync_value', { newMaxId: lastFetchedId, totalInserted });
      }
      
    } else if (connection.type === 'mysql') {
      const mysql = require('mysql2/promise');
      
      const conn = await mysql.createConnection({
        host: connection.host,
        port: connection.port || 3306,
        user: connection.username,
        password: connection.password_encrypted,
        database: connection.database_name,
        charset: 'utf8mb4',
        dateStrings: true
      });
      
      // ============================================
      // CURSOR/PAGINATION MANTIĞI - 5000'erlik parçalar
      // Bellek dolmaz, milyonlarca satır çekilebilir!
      // ============================================
      const BATCH_SIZE = 5000;
      // ⚠️ maxId integer olmalı - MySQL prepared statement için!
      let currentMaxId: number = parseInt(String(maxId)) || 0;
      let lastFetchedId: number = currentMaxId;
      let hasMoreData = true;
      
      logger.info('MySQL ID-based sync with cursor starting', { 
        startMaxId: currentMaxId, 
        batchSize: BATCH_SIZE,
        rowLimit: limit 
      });
      
      while (hasMoreData && totalInserted < limit) {
        // Her seferinde sadece 5000 satır çek
        const remainingLimit: number = Math.min(BATCH_SIZE, limit - totalInserted);
        
        // ⚠️ MySQL prepared statement sorunları nedeniyle değerleri direkt sorguya yazıyoruz
        const query = `SELECT * FROM ${sourceTableName} WHERE ${reference_column} > ${currentMaxId} ORDER BY ${reference_column} LIMIT ${remainingLimit}`;
        logger.info('MySQL ID-based query', { query: query.substring(0, 200), currentMaxId, remainingLimit });
        const [rows] = await conn.query(query); // execute yerine query kullan!
        
        if ((rows as any[]).length === 0) {
          hasMoreData = false;
          logger.info('No more rows to fetch', { currentMaxId, totalInserted });
          break;
        }
        
        // ClickHouse'a yaz
        const transformedBatch = transformBatchForClickHouse(rows as any[]);
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedBatch);
        totalInserted += (rows as any[]).length;
        
        // Sonraki parça için max ID güncelle
        // ⚠️ Integer'a çevir - MySQL prepared statement için!
        lastFetchedId = parseInt(String((rows as any[])[(rows as any[]).length - 1][reference_column])) || 0;
        currentMaxId = lastFetchedId;
        
        // Progress güncelle
        if (jobId) {
          await db.query(
            `UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`,
            [totalInserted, jobId]
          );
        }
        
        logger.info('MySQL cursor batch inserted', { 
          batchSize: (rows as any[]).length, 
          totalInserted, 
          currentMaxId,
          hasMoreData: (rows as any[]).length === remainingLimit
        });
        
        // Eğer limit'e ulaştıysak dur
        if (limit && totalInserted >= limit) {
          hasMoreData = false;
        }
      }
      
      await conn.end();
      
      if (totalInserted > 0) {
        await db.query(
          `UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2`,
          [String(lastFetchedId), dataset.id]
        );
        logger.info('Updated last_sync_value', { newMaxId: lastFetchedId, totalInserted });
      }
      
    } else if (connection.type === 'postgresql') {
      const { Client } = require('pg');
      const client = new Client({
        host: connection.host,
        port: connection.port || 5432,
        user: connection.username,
        password: connection.password_encrypted,
        database: connection.database_name
      });
      
      await client.connect();
      
      // ============================================
      // CURSOR/PAGINATION MANTIĞI - 5000'erlik parçalar
      // Bellek dolmaz, milyonlarca satır çekilebilir!
      // ============================================
      const BATCH_SIZE = 5000;
      let currentMaxId = maxId;
      let lastFetchedId = maxId;
      let hasMoreData = true;
      
      logger.info('PostgreSQL ID-based sync with cursor starting', { 
        startMaxId: maxId, 
        batchSize: BATCH_SIZE,
        rowLimit: limit 
      });
      
      while (hasMoreData && (limit === null || totalInserted < limit)) {
        const remainingLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
        const query = `SELECT * FROM ${sourceTableName} WHERE ${reference_column} > $1 ORDER BY ${reference_column} LIMIT $2`;
        const result = await client.query(query, [currentMaxId, remainingLimit]);
        
        if (result.rows.length === 0) {
          hasMoreData = false;
          logger.info('No more rows to fetch', { currentMaxId, totalInserted });
          break;
        }
        
        // ClickHouse'a yaz
        const transformedBatch = transformBatchForClickHouse(result.rows);
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedBatch);
        totalInserted += result.rows.length;
        
        // Sonraki parça için max ID güncelle
        lastFetchedId = result.rows[result.rows.length - 1][reference_column];
        currentMaxId = lastFetchedId;
        
        // Progress güncelle
        if (jobId) {
          await db.query(
            `UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`,
            [totalInserted, jobId]
          );
        }
        
        logger.info('PostgreSQL cursor batch inserted', { 
          batchSize: result.rows.length, 
          totalInserted, 
          currentMaxId
        });
        
        if (limit && totalInserted >= limit) {
          hasMoreData = false;
        }
      }
      
      await client.end();
      
      if (totalInserted > 0) {
        await db.query(
          `UPDATE datasets SET last_sync_value = $1, last_sync_at = NOW() WHERE id = $2`,
          [String(lastFetchedId), dataset.id]
        );
        logger.info('Updated last_sync_value', { newMaxId: lastFetchedId, totalInserted });
      }
    }
    
    // ============================================
    // COUNT VERIFICATION - Kaynak vs Hedef Karşılaştırma
    // ============================================
    let verificationWarning: string | null = null;
    try {
      // ClickHouse'taki toplam satır sayısı
      const chCountResult = await clickhouse.queryOne(`
        SELECT count() as total FROM clixer_analytics.${clickhouse_table}
      `);
      const clickhouseCount = parseInt(chCountResult?.total || '0');
      
      // Kaynak DB'deki toplam satır sayısı (sadece count, hızlı)
      let sourceCount = 0;
      const sourceTableName = dataset.source_table || (dataset.source_query ? extractTableFromQuery(dataset.source_query) : null);
      
      if (sourceTableName && connection.type === 'mssql') {
        const sql = require('mssql');
        const isAzure = connection.host?.includes('.database.windows.net');
        const config = {
          user: connection.username,
          password: connection.password_encrypted,
          server: connection.host,
          database: connection.database_name,
          port: connection.port || 1433,
          options: { encrypt: isAzure, trustServerCertificate: !isAzure },
          requestTimeout: 60000
        };
        const pool = await sql.connect(config);
        const countResult = await pool.request().query(`SELECT COUNT(*) as cnt FROM ${sourceTableName}`);
        sourceCount = countResult.recordset[0].cnt;
        await pool.close();
      } else if (sourceTableName && connection.type === 'mysql') {
        const mysql = require('mysql2/promise');
        const conn = await mysql.createConnection({
          host: connection.host,
          port: connection.port || 3306,
          user: connection.username,
          password: connection.password_encrypted,
          database: connection.database_name
        });
        const [rows] = await conn.execute(`SELECT COUNT(*) as cnt FROM ${sourceTableName}`);
        sourceCount = (rows as any[])[0].cnt;
        await conn.end();
      } else if (sourceTableName && connection.type === 'postgresql') {
        const { Client } = require('pg');
        const client = new Client({
          host: connection.host,
          port: connection.port || 5432,
          user: connection.username,
          password: connection.password_encrypted,
          database: connection.database_name
        });
        await client.connect();
        const result = await client.query(`SELECT COUNT(*) as cnt FROM ${sourceTableName}`);
        sourceCount = parseInt(result.rows[0].cnt);
        await client.end();
      }
      
      // Karşılaştır
      const diff = sourceCount - clickhouseCount;
      const diffPercent = sourceCount > 0 ? Math.round((diff / sourceCount) * 100) : 0;
      
      logger.info('📊 Count Verification', { 
        source: sourceCount, 
        clickhouse: clickhouseCount, 
        diff, 
        diffPercent: `${diffPercent}%` 
      });
      
      // %1'den fazla fark varsa uyarı
      if (Math.abs(diffPercent) > 1 && Math.abs(diff) > 1000) {
        verificationWarning = `Kaynak: ${sourceCount.toLocaleString()}, Hedef: ${clickhouseCount.toLocaleString()} - ${Math.abs(diff).toLocaleString()} satır fark (${diffPercent}%)`;
        logger.warn('⚠️ Count mismatch detected!', { 
          source: sourceCount, 
          clickhouse: clickhouseCount, 
          diff,
          warning: verificationWarning
        });
      }
    } catch (verifyError: any) {
      logger.warn('Count verification failed', { error: verifyError.message });
    }
    
    // Job tamamla (verification sonucu ile)
    if (jobId) {
      await db.query(
        `UPDATE etl_jobs SET 
          status = 'completed', 
          completed_at = NOW(), 
          rows_processed = $1,
          error_message = $2
        WHERE id = $3`,
        [totalInserted, verificationWarning, jobId]
      );
    }
    
    // Cache invalidate
    await cache.del(`kpi:${clickhouse_table}:*`);
    
    logger.info('ID-Based incremental sync completed', { 
      datasetId: dataset.id, 
      totalInserted,
      previousMaxId: maxId,
      verification: verificationWarning || 'OK'
    });
    
    return totalInserted;
    
  } catch (error: any) {
    logger.error('ID-Based sync failed', { error: error.message, datasetId: dataset.id });
    throw error;
  }
}

/**
 * EKSİK ID ARALIKLARI SYNC (Missing Ranges Sync)
 * 
 * Sadece eksik olan ID aralıklarını kaynak DB'den çeker.
 * Truncate yapmaz, mevcut verilere ekler.
 * 
 * Kullanım: Veri doğrulamada tespit edilen eksik aralıklar için.
 */
async function syncMissingRanges(
  dataset: any, 
  connection: any, 
  jobId: string,
  ranges: Array<{start: number; end: number; missing_count?: number}>,
  pkColumn: string = 'id' // ⚠️ KULLANICI SEÇTİĞİ PK KOLONU
): Promise<number> {
  const { clickhouse_table, source_query } = dataset;
  
  if (!ranges || ranges.length === 0) {
    logger.warn('No ranges provided for missing sync', { datasetId: dataset.id });
    return 0;
  }
  
  // Kaynak sorgudan tablo adını çıkar
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
  
  // ⚠️ DİNAMİK PK KOLONU - kullanıcı seçiyor!
  const idColumn = pkColumn;
  let totalInserted = 0;
  
  logger.info('🔍 Starting missing ranges sync', { 
    datasetId: dataset.id, 
    ranges: ranges.length,
    totalMissing: ranges.reduce((sum, r) => sum + (r.missing_count || (r.end - r.start + 1)), 0)
  });
  
  // column_mapping'i parse et
  let columnMapping = dataset.column_mapping || [];
  if (typeof columnMapping === 'string') {
    try { columnMapping = JSON.parse(columnMapping); } catch (e) { columnMapping = []; }
  }
  
  if (connection.type === 'mssql') {
    const mssql = require('mssql');
    const connStr = connection.connection_string || 
      `Server=${connection.host},${connection.port || 1433};Database=${connection.database_name};User Id=${connection.username};Password=${connection.password_encrypted};Encrypt=${connection.host?.includes('.database.windows.net')};TrustServerCertificate=true;Connection Timeout=30;Request Timeout=120000`;
    
    const pool = await mssql.connect(connStr);
    
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      logger.info(`Processing range ${i + 1}/${ranges.length}`, { start: range.start, end: range.end });
      
      // Bu aralıktaki verileri çek
      const query = `SELECT * FROM [${sourceTable}] WITH (NOLOCK) WHERE [${idColumn}] >= ${range.start} AND [${idColumn}] <= ${range.end}`;
      const result = await pool.request().query(query);
      
      if (result.recordset.length > 0) {
        // Column mapping yoksa oluştur
        if (columnMapping.length === 0) {
          for (const key of Object.keys(result.recordset[0])) {
            const value = result.recordset[0][key];
            let clickhouseType = 'String';
            if (typeof value === 'number') {
              clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
            } else if (value instanceof Date) {
              clickhouseType = 'DateTime';
            }
            columnMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
          }
        }
        
        // Veriyi ClickHouse formatına dönüştür
        const transformedData = transformBatchForClickHouse(result.recordset, columnMapping);
        
        // ClickHouse'a yaz
        await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
        totalInserted += result.recordset.length;
        
        logger.info(`Range ${i + 1} completed`, { 
          inserted: result.recordset.length, 
          totalSoFar: totalInserted 
        });
      }
      
      // Progress güncelle
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
  
  // OPTIMIZE çalıştır
  try {
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
    logger.info('OPTIMIZE completed after missing sync');
  } catch (optErr: any) {
    logger.warn('OPTIMIZE failed (non-critical)', { error: optErr.message });
  }
  
  logger.info('✅ Missing ranges sync completed', { 
    datasetId: dataset.id, 
    totalInserted,
    rangesProcessed: ranges.length
  });
  
  return totalInserted;
}

/**
 * 🚀 SADECE YENİ KAYITLARI ÇEK (New Records Sync)
 * 
 * 100M+ tablolar için EN VERİMLİ yöntem!
 * ClickHouse'daki max ID'den sonraki tüm kayıtları batch batch çeker.
 * 
 * Avantajlar:
 * - RAM tüketimi minimum (5000'lik batch)
 * - Eksik ID aralıklarını taramaya gerek yok
 * - Kaynakta yeni ne varsa hepsini alır
 * - Progress bar ile takip edilebilir
 */
async function syncNewRecordsAfterMaxId(
  dataset: any,
  connection: any,
  jobId: string,
  pkColumn: string = 'id',
  afterId: number = 0,
  limit?: number
): Promise<number> {
  const { clickhouse_table, source_query } = dataset;
  const BATCH_SIZE = 5000; // Her batch'te 5000 satır
  
  // Kaynak sorgudan tablo adını çıkar
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
  
  logger.info('🚀 NEW RECORDS SYNC başlıyor', { 
    datasetId: dataset.id, 
    pkColumn, 
    afterId,
    limit: limit || 'UNLIMITED',
    batchSize: BATCH_SIZE
  });
  
  // column_mapping'i parse et
  let columnMapping = dataset.column_mapping || [];
  if (typeof columnMapping === 'string') {
    try { columnMapping = JSON.parse(columnMapping); } catch (e) { columnMapping = []; }
  }
  
  let totalInserted = 0;
  let currentMaxId = afterId;
  let hasMore = true;
  let batchNum = 0;
  
  if (connection.type === 'mssql') {
    const mssql = require('mssql');
    const connStr = connection.connection_string || 
      `Server=${connection.host},${connection.port || 1433};Database=${connection.database_name};User Id=${connection.username};Password=${connection.password_encrypted};Encrypt=${connection.host?.includes('.database.windows.net')};TrustServerCertificate=true;Connection Timeout=30;Request Timeout=120000`;
    
    const pool = await mssql.connect(connStr);
    
    // Kaynaktaki max ID'yi al (ilerleme hesabı için)
    const sourceMaxResult = await pool.request().query(`SELECT MAX([${pkColumn}]) as max_id FROM [${sourceTable}] WITH (NOLOCK)`);
    const sourceMaxId = sourceMaxResult.recordset[0]?.max_id || 0;
    const expectedTotal = Math.max(0, sourceMaxId - afterId);
    
    logger.info('📊 Kaynak max ID bulundu', { sourceMaxId, afterId, expectedTotal });
    
    while (hasMore) {
      batchNum++;
      
      // Limit kontrolü
      const remainingLimit = limit ? Math.max(0, limit - totalInserted) : BATCH_SIZE;
      const batchLimit = Math.min(BATCH_SIZE, remainingLimit);
      
      if (batchLimit === 0) {
        logger.info('Limite ulasildi, sync durduruluyor', { totalInserted, limit });
        break;
      }
      
      // Cursor/Pagination ile veri çek
      // MSSQL için TOP kullan, ORDER BY ile sırala
      const query = `
        SELECT TOP ${batchLimit} * 
        FROM [${sourceTable}] WITH (NOLOCK) 
        WHERE [${pkColumn}] > ${currentMaxId} 
        ORDER BY [${pkColumn}] ASC
      `;
      
      const result = await pool.request().query(query);
      
      if (result.recordset.length === 0) {
        hasMore = false;
        logger.info('Çekilecek veri kalmadı, sync tamamlandı');
        break;
      }
      
      // Column mapping yoksa oluştur
      if (columnMapping.length === 0 && result.recordset.length > 0) {
        for (const key of Object.keys(result.recordset[0])) {
          const value = result.recordset[0][key];
          let clickhouseType = 'String';
          if (typeof value === 'number') {
            clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          } else if (value instanceof Date) {
            clickhouseType = 'DateTime';
          }
          columnMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
        }
      }
      
      // Veriyi ClickHouse formatına dönüştür
      const transformedData = transformBatchForClickHouse(result.recordset, columnMapping);
      
      // ClickHouse'a yaz
      await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
      totalInserted += result.recordset.length;
      
      // Cursor'u güncelle (son satırın ID'si)
      currentMaxId = result.recordset[result.recordset.length - 1][pkColumn];
      
      // Progress güncelle
      const progress = expectedTotal > 0 ? Math.min(100, Math.round((totalInserted / expectedTotal) * 100)) : 0;
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [totalInserted, `Batch ${batchNum}: ${totalInserted} satır (${progress}%)`, jobId]
      );
      
      logger.info(`Batch ${batchNum} tamamlandı`, { 
        batchSize: result.recordset.length,
        totalSoFar: totalInserted,
        currentMaxId,
        progress: `${progress}%`
      });
      
      // Batch tam dolmadıysa veri bitmiş demektir
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
      password: connection.password_encrypted,
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
      
      if (columnMapping.length === 0 && result.rows.length > 0) {
        for (const key of Object.keys(result.rows[0])) {
          const value = result.rows[0][key];
          let clickhouseType = 'String';
          if (typeof value === 'number') clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          else if (value instanceof Date) clickhouseType = 'DateTime';
          columnMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
        }
      }
      
      const transformedData = transformBatchForClickHouse(result.rows, columnMapping);
      await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
      totalInserted += result.rows.length;
      currentMaxId = result.rows[result.rows.length - 1][pkColumn];
      
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [totalInserted, `Batch ${batchNum}: ${totalInserted} satır`, jobId]
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
      password: connection.password_encrypted,
      charset: 'utf8mb4'
    });
    
    while (hasMore) {
      batchNum++;
      const batchLimit = limit ? Math.min(BATCH_SIZE, limit - totalInserted) : BATCH_SIZE;
      if (batchLimit <= 0) break;
      
      // MySQL için inline values kullan (prepared statement LIMIT sorunu!)
      const query = `SELECT * FROM ${sourceTable} WHERE ${pkColumn} > ${currentMaxId} ORDER BY ${pkColumn} ASC LIMIT ${batchLimit}`;
      const [rows] = await conn.query(query);
      
      if (!rows || (rows as any[]).length === 0) {
        hasMore = false;
        break;
      }
      
      const rowsArray = rows as any[];
      
      if (columnMapping.length === 0 && rowsArray.length > 0) {
        for (const key of Object.keys(rowsArray[0])) {
          const value = rowsArray[0][key];
          let clickhouseType = 'String';
          if (typeof value === 'number') clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
          else if (value instanceof Date) clickhouseType = 'DateTime';
          columnMapping.push({ sourceName: key, targetName: key, type: clickhouseType });
        }
      }
      
      const transformedData = transformBatchForClickHouse(rowsArray, columnMapping);
      await clickhouse.insert(`clixer_analytics.${clickhouse_table}`, transformedData);
      totalInserted += rowsArray.length;
      currentMaxId = rowsArray[rowsArray.length - 1][pkColumn];
      
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [totalInserted, `Batch ${batchNum}: ${totalInserted} satır`, jobId]
      );
      
      if (rowsArray.length < batchLimit) hasMore = false;
    }
    
    await conn.end();
  } else {
    throw new Error(`new_records_sync henüz ${connection.type} desteklemiyor`);
  }
  
  // OPTIMIZE çalıştır (opsiyonel - büyük tablolarda zaman alır!)
  if (totalInserted > 0 && totalInserted < 1000000) { // 1M altında optimize et
    try {
      await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${clickhouse_table} FINAL`);
      logger.info('OPTIMIZE completed after new records sync');
    } catch (optErr: any) {
      logger.warn('OPTIMIZE skipped or failed (non-critical for large tables)', { error: optErr.message });
    }
  } else {
    logger.info('OPTIMIZE skipped for large table (>1M rows inserted)', { totalInserted });
  }
  
  logger.info('✅ NEW RECORDS SYNC tamamlandı', { 
    datasetId: dataset.id, 
    totalInserted,
    batchesProcessed: batchNum,
    finalMaxId: currentMaxId
  });
  
  return totalInserted;
}

/**
 * TARİH BAZLI SİL-YAZ (Date Delete & Insert)
 * 
 * Partition gerektirmez! Basit ve etkili:
 * 1. ClickHouse'tan son X günü sil (reference_column'a göre)
 * 2. Kaynak DB'den son X günü çek
 * 3. ClickHouse'a yaz
 * 
 * Küçük-orta tablolar için ideal!
 */
async function syncByDateDeleteInsert(dataset: any, connection: any, jobId?: string): Promise<number> {
  const {
    reference_column,
    delete_days = 1,
    clickhouse_table,
    source_query,
    source_table,
    row_limit
  } = dataset;

  // column_mapping'i parse et
  let columnMapping = dataset.column_mapping || [];
  if (typeof columnMapping === 'string') {
    try {
      columnMapping = JSON.parse(columnMapping);
    } catch (e) {
      columnMapping = [];
    }
  }

  logger.info('Date Delete & Insert sync starting', { 
    datasetId: dataset.id, 
    datasetName: dataset.name,
    referenceColumn: reference_column,
    deleteDays: delete_days,
    clickhouseTable: clickhouse_table
  });

  // Referans kolon kontrolü
  if (!reference_column) {
    logger.warn('No reference column defined, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }

  // Source kontrolü
  const sourceTableName = extractTableFromQuery(source_query || `SELECT * FROM ${source_table}`);
  if (!sourceTableName) {
    throw new Error('Kaynak tablo bulunamadı');
  }

  try {
    // 1. ClickHouse'tan son X günü sil
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - delete_days);
    const startDateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
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

    // 2. Kaynak DB'den son X günü çek
    let totalInserted = 0;

    if (connection.type === 'mssql') {
      // MSSQL için tarih filtreli sorgu
      const columns = (dataset.column_mapping || []).map((c: any) => c.source).join(', ') || '*';
      let dateFilter = '';
      
      // MSSQL tarih formatı
      if (delete_days === 0) {
        dateFilter = `WHERE CAST(${reference_column} AS DATE) = CAST(GETDATE() AS DATE)`;
      } else {
        dateFilter = `WHERE ${reference_column} >= DATEADD(day, -${delete_days}, CAST(GETDATE() AS DATE))`;
      }
      
      const limit = row_limit || 10000000;
      const query = `SELECT TOP ${limit} ${columns} FROM ${sourceTableName} ${dateFilter} ORDER BY ${reference_column}`;
      
      logger.info('Executing MSSQL date-filtered query', { 
        query: query.substring(0, 300),
        dateFilter,
        limit
      });

      // MSSQL streaming ile veri çek - custom query ile
      const originalQuery = dataset.source_query;
      dataset.source_query = query;
      
      // column_mapping'i parse et
      let columnMapping = dataset.column_mapping || [];
      if (typeof columnMapping === 'string') {
        try {
          columnMapping = JSON.parse(columnMapping);
        } catch (e) {
          columnMapping = [];
        }
      }
      
      try {
        totalInserted = await mssqlSync(dataset, connection, columnMapping, jobId);
      } finally {
        dataset.source_query = originalQuery;
      }
      
    } else if (connection.type === 'postgresql') {
      // PostgreSQL için
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
      
      // source_query'yi geçici olarak değiştir
      const originalQuery = dataset.source_query;
      dataset.source_query = query;
      try {
        totalInserted = await streamingPostgreSQLSync(dataset, connection, columnMapping, jobId);
      } finally {
        dataset.source_query = originalQuery;
      }
      
    } else if (connection.type === 'mysql') {
      // MySQL için
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
      
      // source_query'yi geçici olarak değiştir
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

    // 3. OPTIMIZE çalıştır
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

/**
 * PARTITION BAZLI SİL-YAZ (Sliding Window + Modified Algılama)
 * 
 * Bu fonksiyon şunları yapar:
 * 1. refresh_window_days kadar geriye gider (sliding window)
 * 2. detect_modified=true ise modified_at ile değişen günleri bulur
 * 3. Etkilenen partition'ları siler
 * 4. Sadece o günlerin verilerini yazar
 * 
 * Power BI Incremental Refresh benzeri ama daha güçlü!
 */
async function syncByDatePartition(dataset: any, connection: any, jobId?: string): Promise<number> {
  // 🔧 SELF-HEALING: Tablo yoksa otomatik oluştur
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

  // Partition kolonu yoksa full refresh'e düş
  if (!partition_column) {
    logger.warn('No partition column defined, falling back to full refresh', { datasetId: dataset.id });
    return await fullRefresh(dataset, connection, jobId);
  }

  // Source table kontrolü
  if (!dataset.source_table && !dataset.source_query) {
    logger.error('No source table or query defined', { datasetId: dataset.id });
    throw new Error('Kaynak tablo veya sorgu tanımlanmamış');
  }

  // ============================================
  // TUTARLILIK KONTROLÜ: Dataset ayarı vs ClickHouse tablo yapısı
  // ============================================
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
      const expectedFormat = partition_type === 'daily' ? 'YYYYMMDD (günlük)' : 'YYYYMM (aylık)';
      const actualFormat = isActuallyDaily ? 'YYYYMMDD (günlük)' : (isActuallyMonthly ? 'YYYYMM (aylık)' : 'bilinmiyor');
      
      // Uyumsuzluk kontrolü
      const isConsistent = 
        (partition_type === 'daily' && isActuallyDaily) || 
        (partition_type === 'monthly' && isActuallyMonthly);
      
      if (!isConsistent && actualPartitionKey) {
        logger.warn('⚠️ PARTITION FORMAT UYUMSUZLUĞU!', {
          datasetId: dataset.id,
          datasetName: dataset.name,
          clickhouseTable: clickhouse_table,
          uiAyari: {
            partitionType: partition_type,
            beklenenFormat: expectedFormat
          },
          clickhouseGercek: {
            partitionKey: actualPartitionKey,
            gercekFormat: actualFormat,
            engine: tableInfo.engine
          },
          cozum: 'Tablo partition_key formatı kullanılacak (UI ayarı yoksayıldı)'
        });
      } else {
        logger.info('✅ Partition format tutarlı', {
          datasetId: dataset.id,
          format: actualFormat,
          engine: tableInfo.engine
        });
      }
    }
  } catch (consistencyError: any) {
    logger.warn('Tutarlılık kontrolü yapılamadı', { error: consistencyError.message });
  }

  try {
    const columnMapping = dataset.column_mapping || [];
    
    // Column mapping kontrolü
    if (!columnMapping || columnMapping.length === 0) {
      logger.error('No column mapping defined', { datasetId: dataset.id });
      throw new Error('Kolon eşleştirmesi tanımlanmamış');
    }
    
    // PostgreSQL bağlantısı kur
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

    // Source table veya query belirle
    const sourceFrom = dataset.source_table 
      ? dataset.source_table 
      : dataset.source_query 
        ? `(${dataset.source_query}) AS sq` 
        : null;
    
    if (!sourceFrom) {
      throw new Error('Kaynak tablo veya sorgu tanımlanmamış');
    }

    try {
      // 1. AFFECTED DATES: Hangi günler etkilendi?
      let affectedDates: string[] = [];
      const today = new Date();
      
      if (detect_modified && modified_column) {
        // modified_at bazlı algılama - hangi günlerin verisi değişti?
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
      
      // 2. SLIDING WINDOW: Son X günü de ekle
      if (refresh_window_days > 0) {
        for (let i = 0; i < refresh_window_days; i++) {
          const date = new Date(today);
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          if (!affectedDates.includes(dateStr)) {
            affectedDates.push(dateStr);
          }
        }
      }

      // Tarih yoksa en az bugünü ekle
      if (affectedDates.length === 0) {
        affectedDates.push(today.toISOString().split('T')[0]);
      }

      // Tarihleri sırala
      affectedDates.sort();
      
      logger.info('Dates to refresh', { 
        count: affectedDates.length, 
        dates: affectedDates 
      });

      // 3. HER TARİH İÇİN: Partition sil + yaz
      // ============================================
      // 3. ÖNCE: Etkilenen partition'ları BİR KEZ sil
      // ============================================
      
      // Tablonun partition formatını öğren (döngü dışında - performans için)
      const tableInfo = await clickhouse.queryOne(`
        SELECT partition_key 
        FROM system.tables 
        WHERE database = 'clixer_analytics' AND name = '${clickhouse_table}'
      `);
      const isMonthlyPartition = tableInfo?.partition_key?.includes('toYYYYMM') && !tableInfo?.partition_key?.includes('toYYYYMMDD');
      
      // Unique partition değerlerini hesapla (aynı ay için tek sil)
      const uniquePartitions = new Set<string>();
      for (const dateStr of affectedDates) {
        const partitionDate = new Date(dateStr);
        const partitionValue = isMonthlyPartition 
          ? partitionDate.toISOString().slice(0, 7).replace(/-/g, '')   // YYYYMM
          : partitionDate.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        uniquePartitions.add(partitionValue);
      }
      
      logger.info('Unique partitions to drop', { 
        count: uniquePartitions.size, 
        partitions: Array.from(uniquePartitions),
        isMonthly: isMonthlyPartition,
        partitionKey: tableInfo?.partition_key
      });
      
      // Her unique partition'ı sadece BİR KEZ sil
      for (const partitionValue of uniquePartitions) {
        try {
          logger.info('Dropping partition', { table: clickhouse_table, partition: partitionValue });
          await clickhouse.execute(
            `ALTER TABLE clixer_analytics.${clickhouse_table} DROP PARTITION '${partitionValue}'`
          );
          logger.info('Partition dropped successfully', { table: clickhouse_table, partition: partitionValue });
        } catch (dropError: any) {
          if (!dropError.message?.includes('not found') && !dropError.message?.includes('Cannot find')) {
            logger.warn('Partition drop warning', { partition: partitionValue, error: dropError.message });
          }
        }
      }
      
      // ============================================
      // 4. SONRA: Tüm veriyi ekle (partition silme yok artık)
      // ============================================
      let totalRowsProcessed = 0;
      
      for (const dateStr of affectedDates) {
        // Job iptal edilmiş mi kontrol et
        if (jobId && await isJobCancelled(jobId)) {
          logger.info('Job cancelled during partition sync', { jobId, currentDate: dateStr });
          break;
        }

        logger.info('Processing date data', { date: dateStr });

        // O tarihin verilerini çek ve yaz (partition silme ARTIK YOK - yukarıda yapıldı)
        const dateCondition = partition_type === 'daily'
          ? `DATE(${partition_column}) = '${dateStr}'`
          : `DATE_TRUNC('month', ${partition_column}) = DATE_TRUNC('month', '${dateStr}'::date)`;

        const selectColumns = columnMapping.map((col: any) => col.source).join(', ');
        
        // Source table veya source_query'den veri çek
        let dataQuery: string;
        if (dataset.source_query) {
          // Subquery olarak kullan
          dataQuery = `SELECT ${selectColumns} FROM (${dataset.source_query}) AS sq WHERE ${dateCondition}`;
        } else if (dataset.source_table) {
          dataQuery = `SELECT ${selectColumns} FROM ${dataset.source_table} WHERE ${dateCondition}`;
        } else {
          throw new Error('Kaynak tablo veya sorgu tanımlanmamış');
        }
        
        const dataResult = await client.query(dataQuery);
        const rows = dataResult.rows;
        
        if (rows.length > 0) {
          // ClickHouse'a yaz
          const targetColumns = columnMapping.map((col: any) => col.target);
          
          // Batch insert
          const batchSize = 5000;
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            const values = batch.map((row: any) => {
              return '(' + columnMapping.map((col: any) => {
                const val = row[col.source];
                if (val === null || val === undefined) return 'NULL';
                
                // DateTime veya Date tipinde kolon için akıllı dönüştürücü kullan
                if (col.clickhouseType === 'DateTime' || col.clickhouseType === 'DateTime64' || col.clickhouseType === 'Date') {
                  const converted = convertToClickHouseDateTime(val);
                  if (converted) {
                    // Date tipi için sadece tarih kısmını al
                    if (col.clickhouseType === 'Date') {
                      return `'${converted.split(' ')[0]}'`;
                    }
                    return `'${converted}'`;
                  }
                  // Varsayılan değer
                  return col.clickhouseType === 'Date' ? "'1970-01-01'" : "'1970-01-01 00:00:00'";
                }
                
                // Tarih benzeri string'ler için de kontrol et
                if (val instanceof Date || (typeof val === 'string' && val.match(/\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4}/))) {
                  const converted = convertToClickHouseDateTime(val);
                  if (converted) return `'${converted}'`;
                }
                
                if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
                return val;
              }).join(',') + ')';
            }).join(',\n');

            const insertSql = `
              INSERT INTO clixer_analytics.${clickhouse_table} (${targetColumns.join(',')})
              VALUES ${values}
            `;
            
            await clickhouse.execute(insertSql);
          }
          
          totalRowsProcessed += rows.length;
          logger.info('Partition data written', { 
            date: dateStr, 
            rows: rows.length 
          });
        } else {
          logger.info('No data for partition', { date: dateStr });
        }
      }

      // Cache invalidate
      await cache.del(`kpi:${clickhouse_table}:*`);
      
      // ============================================
      // VERİ TUTARLILIK KONTROLÜ VE DUPLICATE TEMİZLİĞİ
      // ============================================
      const validation = await validateDataConsistency(dataset, client, totalRowsProcessed);
      
      if (!validation.isConsistent) {
        logger.warn('Partition sync consistency warning', {
          datasetId: dataset.id,
          expected: totalRowsProcessed,
          actual: validation.targetCount,
          duplicatesRemoved: validation.duplicateCount
        });
      }
      
      logger.info('Partition sync completed', { 
        datasetId: dataset.id, 
        rowsProcessed: totalRowsProcessed,
        finalRowCount: validation.targetCount,
        partitionsProcessed: affectedDates.length,
        duplicatesRemoved: validation.duplicateCount,
        isConsistent: validation.isConsistent
      });

      // İşlenen satır sayısı 0 ise, tablodaki toplam satır sayısını döndür
      // (sliding window dışında veri yoksa bile tablo boş değil)
      return totalRowsProcessed > 0 ? totalRowsProcessed : validation.targetCount;

    } finally {
      await client.end();
    }

  } catch (error: any) {
    logger.error('Partition sync failed', { datasetId: dataset.id, error: error.message });
    throw error;
  }
}

// ============================================
// MSSQL SYNC (Azure SQL dahil) - STREAMING MODE
// ============================================
async function mssqlSync(
  dataset: any,
  connection: any,
  columnMapping: any[],
  jobId?: string
): Promise<number> {
  const mssql = require('mssql');
  
  const isAzure = connection.host.includes('.database.windows.net');
  const config = {
    server: connection.host,
    port: connection.port || 1433,
    database: connection.database_name,
    user: connection.username,
    password: connection.password_encrypted,
    options: { 
      encrypt: isAzure, 
      trustServerCertificate: !isAzure,
      requestTimeout: 600000 // 10 dakika timeout
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  };
  
  const rowLimit = dataset.row_limit || null;
  
  logger.info('🔷 MSSQL Streaming Sync starting', {
    datasetId: dataset.id,
    table: dataset.clickhouse_table,
    isAzure,
    host: connection.host,
    rowLimit: rowLimit || 'UNLIMITED'
  });
  
  let pool: any = null;
  
  // Date format helper - güvenli versiyon
  const formatDate = (date: Date): string | null => {
    // Geçersiz Date kontrolü
    if (!date || isNaN(date.getTime())) {
      return null;
    }
    const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
    const year = date.getFullYear();
    // Yıl geçersizse (çok küçük veya çok büyük)
    if (year < 1900 || year > 2100) {
      return null;
    }
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };
  
  try {
    pool = await mssql.connect(config);
    logger.info('MSSQL connected');
    
    // Sorgu oluştur
    let query = dataset.source_query || `SELECT * FROM ${dataset.source_table}`;
    
    // ❗ KRITIK: Dataset oluşturulurken LIMIT/TOP 10 ile test edilmiş olabilir!
    // Full Refresh'te TÜM veriyi çekmek için LIMIT/TOP'ı kaldır
    query = query.replace(/\s+LIMIT\s+\d+\s*/gi, ' ').trim();
    query = query.replace(/\bSELECT\s+TOP\s*\(?(\d+)\)?\s+/gi, 'SELECT ').trim();
    
    // Row limit varsa (kullanıcı isterse) yeniden ekle
    if (rowLimit && !query.toUpperCase().includes('TOP ') && !query.toUpperCase().includes('TOP(')) {
      query = query.replace(/^SELECT\s+/i, `SELECT TOP ${rowLimit} `);
    }
    
    logger.info('Executing MSSQL streaming query', { query: query.substring(0, 200) });
    
    // ClickHouse tablosunu truncate et (full_refresh için)
    if (dataset.sync_strategy === 'full_refresh') {
      try {
        await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${dataset.clickhouse_table}`);
        logger.info('Truncated ClickHouse table');
      } catch (truncErr: any) {
        await clickhouse.execute(`ALTER TABLE clixer_analytics.${dataset.clickhouse_table} DELETE WHERE 1=1`);
      }
    }
    
    // STREAMING MODE
    return new Promise((resolve, reject) => {
      const request = pool.request();
      request.stream = true; // ⚡ STREAMING AÇIK!
      
      let batch: any[] = [];
      let totalInserted = 0;
      let columnMappingInitialized = columnMapping.length > 0;
      const STREAM_BATCH_SIZE = 5000; // Her 5000 satırda bir yaz
      let lastError: string | null = null; // Hata takibi için
      
      // Row event - her satır geldiğinde
      request.on('row', async (row: any) => {
        // İlk satırda column mapping oluştur
        if (!columnMappingInitialized) {
          for (const key of Object.keys(row)) {
            const value = row[key];
            let clickhouseType = 'String';
            if (typeof value === 'number') {
              clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
            } else if (value instanceof Date) {
              clickhouseType = 'DateTime';
            }
            columnMapping.push({ source: key, target: key, clickhouseType });
          }
          columnMappingInitialized = true;
          logger.info('Column mapping auto-generated', { columns: columnMapping.length });
        }
        
        // Date objelerini ve DateTime/Date kolonlarını düzgün formata çevir
        const processedRow: any = {};
        for (const key in row) {
          const colInfo = columnMapping.find((c: any) => c.source === key || c.target === key);
          let val = row[key];
          
          // DEBUG: İlk satırda opening_date değerini logla
          if (key === 'opening_date' && batch.length === 0) {
            logger.info('DEBUG opening_date', { 
              key, 
              val, 
              valType: typeof val, 
              isDate: val instanceof Date,
              colInfo: colInfo ? { source: colInfo.source, target: colInfo.target, clickhouseType: colInfo.clickhouseType } : null
            });
          }
          
          if (val === null || val === undefined) {
            processedRow[key] = null;
          } else if (val instanceof Date) {
            // Date nesnesi - güvenli dönüşüm
            const formatted = formatDate(val);
            if (formatted) {
              if (colInfo?.clickhouseType === 'Date') {
                processedRow[key] = formatted.split(' ')[0]; // Sadece tarih
              } else {
                processedRow[key] = formatted;
              }
            } else {
              // Geçersiz Date - varsayılan değer kullan
              processedRow[key] = colInfo?.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
            }
          } else if (colInfo?.clickhouseType === 'Date' || colInfo?.clickhouseType === 'DateTime') {
            // String olarak gelen ama Date/DateTime tipinde olması gereken değer
            const converted = convertToClickHouseDateTime(val);
            if (converted) {
              if (colInfo.clickhouseType === 'Date') {
                processedRow[key] = converted.split(' ')[0]; // Sadece tarih
              } else {
                processedRow[key] = converted;
              }
            } else {
              // Dönüştürülemedi - varsayılan değer
              processedRow[key] = colInfo.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
            }
          } else {
            processedRow[key] = val;
          }
        }
        
        batch.push(processedRow);
        
        // Batch doldu - ClickHouse'a yaz
        if (batch.length >= STREAM_BATCH_SIZE) {
          request.pause(); // Streaming durdur
          
          try {
            const insertData = batch.map((r: any) => {
              const obj: any = {};
              for (const col of columnMapping) {
                // processedRow key olarak orijinal source adını kullanıyor
                let val = r[col.source];
                
                // ⚠️ KRİTİK: Date objesi ise önce string'e çevir!
                // ClickHouse client Date objelerini JSON'a düzgün serialize edemiyor
                if (val instanceof Date) {
                  const formatted = formatDate(val);
                  if (formatted) {
                    val = col.clickhouseType === 'Date' ? formatted.split(' ')[0] : formatted;
                  } else {
                    val = col.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
                  }
                }
                
                // Date/DateTime tiplerini düzelt
                if (col.clickhouseType === 'DateTime' || col.clickhouseType === 'Date') {
                  if (val === null || val === undefined || val === '') {
                    val = col.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
                  } else if (typeof val === 'string') {
                    // Zaten string ise kontrol et
                    const converted = convertToClickHouseDateTime(val);
                    if (converted) {
                      val = col.clickhouseType === 'Date' ? converted.split(' ')[0] : converted;
                    } else {
                      val = col.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
                    }
                  }
                }
                
                // Null değerleri varsayılanlarla değiştir
                if (val === null || val === undefined) {
                  if (col.clickhouseType === 'String') val = '';
                  else if (col.clickhouseType?.includes('Int') || col.clickhouseType?.includes('Float')) val = 0;
                  else if (col.clickhouseType === 'Date') val = '1970-01-01';
                  else if (col.clickhouseType === 'DateTime') val = '1970-01-01 00:00:00';
                  else val = '';
                }
                obj[col.target] = val;
              }
              return obj;
            });
            
            await clickhouse.insert(`clixer_analytics.${dataset.clickhouse_table}`, insertData);
            
            totalInserted += batch.length;
            batch = []; // Batch'i temizle
            
            // Progress güncelle
            if (jobId) {
              await db.query(
                'UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2',
                [totalInserted, jobId]
              );
            }
            
            logger.info(`Streaming batch inserted`, { totalInserted, rowLimit });
            
          } catch (insertError: any) {
            logger.error('Batch insert failed', { error: insertError.message });
            lastError = insertError.message;
          }
          
          request.resume(); // Streaming devam
        }
      });
      
      // Done event - tüm satırlar alındı
      request.on('done', async () => {
        // Kalan batch'i yaz
        if (batch.length > 0) {
          try {
            const insertData = batch.map((r: any) => {
              const obj: any = {};
              for (const col of columnMapping) {
                // processedRow key olarak orijinal source adını kullanıyor
                let val = r[col.source];
                
                // ⚠️ KRİTİK: Date objesi ise önce string'e çevir!
                if (val instanceof Date) {
                  const formatted = formatDate(val);
                  if (formatted) {
                    val = col.clickhouseType === 'Date' ? formatted.split(' ')[0] : formatted;
                  } else {
                    val = col.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
                  }
                }
                
                // Date/DateTime tiplerini düzelt
                if (col.clickhouseType === 'DateTime' || col.clickhouseType === 'Date') {
                  if (val === null || val === undefined || val === '') {
                    val = col.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
                  } else if (typeof val === 'string') {
                    // Zaten string ise kontrol et
                    const converted = convertToClickHouseDateTime(val);
                    if (converted) {
                      val = col.clickhouseType === 'Date' ? converted.split(' ')[0] : converted;
                    } else {
                      val = col.clickhouseType === 'Date' ? '1970-01-01' : '1970-01-01 00:00:00';
                    }
                  }
                }
                
                // Null değerleri varsayılanlarla değiştir
                if (val === null || val === undefined) {
                  if (col.clickhouseType === 'String') val = '';
                  else if (col.clickhouseType?.includes('Int') || col.clickhouseType?.includes('Float')) val = 0;
                  else if (col.clickhouseType === 'Date') val = '1970-01-01';
                  else if (col.clickhouseType === 'DateTime') val = '1970-01-01 00:00:00';
                  else val = '';
                }
                obj[col.target] = val;
              }
              return obj;
            });
            
            await clickhouse.insert(`clixer_analytics.${dataset.clickhouse_table}`, insertData);
            totalInserted += batch.length;
            
            if (jobId) {
              await db.query(
                'UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2',
                [totalInserted, jobId]
              );
            }
            
            logger.info(`Final batch inserted`, { batchSize: batch.length, totalInserted });
          } catch (insertError: any) {
            logger.error('Final batch insert failed', { error: insertError.message });
            lastError = insertError.message;
          }
        }
        
        // Hata veya 0 satır kontrolü
        if (lastError) {
          logger.error('❌ MSSQL Streaming Sync failed', { totalInserted, error: lastError });
          if (pool) await pool.close();
          reject(new Error(lastError));
          return;
        }
        
        if (totalInserted === 0) {
          // 0 satır = Güncellenecek yeni veri yok (incremental sync için normal)
          logger.info('ℹ️ MSSQL Streaming Sync: Güncellenecek yeni veri bulunamadı (0 satır)', {
            query: query.substring(0, 200)
          });
          if (pool) await pool.close();
          resolve(0); // Başarılı, sadece yeni veri yok
          return;
        }
        
        // COUNT VERIFICATION
        try {
          const validation = await validateDataConsistency(dataset, null, totalInserted);
          logger.info('📊 Count Verification', { 
            source: totalInserted, 
            clickhouse: validation.targetCount,
            isConsistent: validation.isConsistent,
            message: validation.message
          });
          
          // Verification sonucunu job'a kaydet (uyarı olarak)
          if (!validation.isConsistent && jobId) {
            const verificationWarning = `Kaynak: ${totalInserted.toLocaleString()}, Hedef: ${validation.targetCount.toLocaleString()} - ${Math.abs(totalInserted - validation.targetCount).toLocaleString()} satır fark`;
            await db.query(
              'UPDATE etl_jobs SET error_message = $1 WHERE id = $2',
              [verificationWarning, jobId]
            );
          }
        } catch (verifyError: any) {
          logger.warn('Count verification failed', { error: verifyError.message });
        }
        
        logger.info('✅ MSSQL Streaming Sync completed', { totalInserted });
        
        if (pool) {
          await pool.close();
        }
        
        resolve(totalInserted);
      });
      
      // Error event
      request.on('error', async (err: any) => {
        logger.error('MSSQL Stream error', { error: err.message });
        if (pool) {
          await pool.close();
        }
        reject(err);
      });
      
      // Sorguyu başlat
      request.query(query);
    });
    
  } catch (error: any) {
    logger.error('MSSQL Sync failed', { error: error.message, stack: error.stack });
    if (pool) {
      await pool.close();
    }
    throw error;
  }
}

// ============================================
// MYSQL SYNC
// ============================================
async function mysqlSync(
  dataset: any,
  connection: any,
  columnMapping: any[],
  jobId?: string
): Promise<number> {
  const mysql = require('mysql2/promise');
  
  logger.info('🔶 MySQL Sync starting', {
    datasetId: dataset.id,
    table: dataset.clickhouse_table,
    host: connection.host
  });
  
  let conn: any = null;
  
  try {
    conn = await mysql.createConnection({
      host: connection.host,
      port: connection.port || 3306,
      database: connection.database_name,
      user: connection.username,
      password: connection.password_encrypted,
      charset: 'utf8mb4',
      dateStrings: true
    });
    
    // Sorgu oluştur
    let query = dataset.source_query || `SELECT * FROM ${dataset.source_table}`;
    
    // ❗ KRITIK: Dataset oluşturulurken LIMIT 10 ile test edilmiş olabilir!
    // Full Refresh'te TÜM veriyi çekmek için LIMIT'i kaldır
    query = query.replace(/\s+LIMIT\s+\d+\s*/gi, ' ').trim();
    
    // Row limit varsa (kullanıcı isterse) yeniden ekle
    const rowLimit = dataset.row_limit;
    if (rowLimit && !query.toUpperCase().includes('LIMIT')) {
      query += ` LIMIT ${rowLimit}`;
    }
    
    logger.info('MySQL row limit', { rowLimit: rowLimit || 'UNLIMITED' });
    logger.info('Executing MySQL query', { query: query.substring(0, 200) });
    
    const [rows] = await conn.query(query);
    
    logger.info('Fetched rows from MySQL', { count: rows.length });
    
    if (rows.length === 0) {
      logger.warn('No data fetched from MySQL');
      return 0;
    }
    
    // Column mapping yoksa otomatik oluştur
    if (columnMapping.length === 0 && rows.length > 0) {
      const firstRow = rows[0];
      for (const key of Object.keys(firstRow)) {
        const value = firstRow[key];
        let clickhouseType = 'String';
        if (typeof value === 'number') {
          clickhouseType = Number.isInteger(value) ? 'Int64' : 'Float64';
        }
        columnMapping.push({
          source: key,
          target: key,
          clickhouseType
        });
      }
    }
    
    // ClickHouse tablosunu truncate et
    try {
      await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${dataset.clickhouse_table}`);
      logger.info('Truncated ClickHouse table');
    } catch (truncErr: any) {
      await clickhouse.execute(`ALTER TABLE clixer_analytics.${dataset.clickhouse_table} DELETE WHERE 1=1`);
    }
    
    // Batch insert
    let totalInserted = 0;
    
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      
      // Her satırı obje formatına dönüştür
      const insertData = batch.map((row: any) => {
        const obj: any = {};
        for (const col of columnMapping) {
          let val = row[col.source];
          
          // DateTime dönüşümü
          if (col.clickhouseType === 'DateTime' || col.clickhouseType === 'Date') {
            val = toClickHouseDateTime(val) || '1970-01-01 00:00:00';
          }
          
          // Null handling
          if (val === null || val === undefined) {
            if (col.clickhouseType === 'String') val = '';
            else if (col.clickhouseType?.includes('Int') || col.clickhouseType?.includes('Float')) val = 0;
            else val = '';
          }
          
          obj[col.target] = val;
        }
        return obj;
      });
      
      await clickhouse.insert(
        `clixer_analytics.${dataset.clickhouse_table}`,
        insertData
      );
      
      totalInserted += batch.length;
      logger.info(`Inserted batch ${Math.floor(i/BATCH_SIZE) + 1}`, { 
        batchSize: batch.length, 
        totalInserted 
      });
    }
    
    // 🔧 OPTIMIZE FINAL - Duplicate'ları fiziksel olarak sil
    // ReplacingMergeTree için kritik!
    try {
      await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${dataset.clickhouse_table} FINAL`);
      logger.info('OPTIMIZE FINAL executed');
    } catch (optErr: any) {
      logger.warn('OPTIMIZE FINAL failed (will retry in background)', { error: optErr.message });
    }
    
    logger.info('✅ MySQL Sync completed', { totalInserted });
    return totalInserted;
    
  } catch (error: any) {
    logger.error('MySQL Sync failed', { error: error.message, stack: error.stack });
    throw error;
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

async function fullRefresh(dataset: any, connection: any, jobId?: string): Promise<number> {
  logger.info('Full refresh starting', { datasetId: dataset.id, table: dataset.clickhouse_table, jobId });
  
  try {
    // 🔧 SELF-HEALING: Tablo yoksa otomatik oluştur
    await ensureTableExists(dataset);
    
    const columnMapping = dataset.column_mapping || [];
    
    // PostgreSQL için STREAMING destekli ETL (200M+ satır destekler)
    if (connection.type === 'postgresql') {
      return await streamingPostgreSQLSync(dataset, connection, columnMapping, jobId);
    }
    
    // MSSQL için (Azure SQL dahil)
    if (connection.type === 'mssql') {
      return await mssqlSync(dataset, connection, columnMapping, jobId);
    }
    
    // MySQL için
    if (connection.type === 'mysql') {
      return await mysqlSync(dataset, connection, columnMapping, jobId);
    }
    
    // API ve diğer kaynaklar için (belleğe alarak işle)
    let rows: any[] = [];
    
    if (connection.type === 'api') {
      // API bağlantısı için fetch yap
      logger.info('Fetching from API', { host: connection.host });
      
      // source_query JSON formatında endpoint bilgisi içeriyor olabilir
      let apiConfig: any = connection.api_config || {};
      
      // source_query JSON ise parse et
      if (dataset.source_query && typeof dataset.source_query === 'string') {
        try {
          const queryConfig = JSON.parse(dataset.source_query);
          apiConfig = { ...apiConfig, ...queryConfig };
        } catch (e) {
          // JSON değilse endpoint olarak kullan
          apiConfig.endpoint = dataset.source_query;
        }
      }
      
      // URL oluştur - Trim ile boşlukları temizle
      let url = connection.host.trim().replace(/\/$/, '');
      
      // HTTP -> HTTPS otomatik dönüşüm (301 redirect'i önlemek için)
      if (url.startsWith('http://')) {
        const httpsUrl = url.replace('http://', 'https://');
        logger.info('Trying HTTPS first', { httpsUrl: httpsUrl.substring(0, 100) });
        
        try {
          const testRes = await fetch(httpsUrl, { method: 'HEAD' });
          if (testRes.ok || testRes.status < 400) {
            url = httpsUrl;
            logger.info('Using HTTPS', { url: url.substring(0, 100) });
          }
        } catch (e) {
          logger.debug('HTTPS not available, using HTTP', { url });
        }
      }
      
      if (apiConfig.endpoint) {
        url += '/' + apiConfig.endpoint.replace(/^\//, '');
      }
      if (apiConfig.queryParams) {
        url += (url.includes('?') ? '&' : '?') + apiConfig.queryParams;
      }
      
      logger.info('API URL', { url: url.substring(0, 100), method: apiConfig.method || 'GET' });
      
      // Headers oluştur
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(apiConfig.headers || {})
      };
      
      // API Key varsa custom header'a ekle (connection.api_config'den)
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
        logger.info('API Key header set', { headerName });
      }
      
      // Fetch options
      const fetchOptions: RequestInit = {
        method: apiConfig.method || 'GET',
        headers: fetchHeaders,
        redirect: 'follow'
      };
      
      // POST/PUT için body ekle
      if ((apiConfig.method === 'POST' || apiConfig.method === 'PUT') && apiConfig.requestBody) {
        try {
          fetchOptions.body = typeof apiConfig.requestBody === 'string' 
            ? apiConfig.requestBody 
            : JSON.stringify(apiConfig.requestBody);
          logger.info('Request body set', { bodyLength: fetchOptions.body?.length });
        } catch (e) {
          logger.warn('Could not set request body', { error: (e as Error).message });
        }
      }
      
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }
      
      let data: any = await response.json();
      
      // responsePath ile nested data çıkar
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
    
    // Column mapping yoksa otomatik oluştur (API verileri için)
    if (columnMapping.length === 0 && rows.length > 0) {
      logger.info('No column mapping, creating auto mapping from first row');
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
    
    // 2. ClickHouse tablosunu truncate et
    try {
      await clickhouse.execute(`TRUNCATE TABLE clixer_analytics.${dataset.clickhouse_table}`);
      logger.info('Truncated ClickHouse table', { table: dataset.clickhouse_table });
    } catch (truncErr: any) {
      logger.warn('Could not truncate, trying ALTER DELETE', { error: truncErr.message });
      await clickhouse.execute(`ALTER TABLE clixer_analytics.${dataset.clickhouse_table} DELETE WHERE 1=1`);
    }
    
    // 3. Column mapping'e göre veriyi dönüştür
    const transformedRows = rows.map(row => {
      const transformed: any = {};
      for (const mapping of columnMapping) {
        const sourceCol = mapping.source || mapping.sourceName;
        const targetCol = mapping.target || mapping.targetName;
        let value = row[sourceCol];
        const chType = mapping.clickhouseType || 'String';
        
        // Tip dönüşümü - boş string de null gibi işlenir
        const isNumericType = chType.includes('Int') || chType.includes('Float') || chType.includes('Decimal');
        
        if (value === null || value === undefined || (value === '' && isNumericType)) {
          // ClickHouse tiplerine göre varsayılan değer
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
          // String ama sayısal tip - sayıya dönüştür
          const numVal = parseFloat(value);
          value = isNaN(numVal) ? 0 : numVal;
        }
        
        transformed[targetCol] = value;
      }
      return transformed;
    });
    
    // 4. ClickHouse'a insert et (batch olarak - MEMORY OPTİMİZE)
    // BATCH_SIZE global sabiti kullanılır (5000 row = ~50MB RAM)
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
      
      // ⚠️ KILL CHECK: Job iptal edilmiş mi?
      if (jobId && await isJobCancelled(jobId)) {
        logger.info('Job cancelled during batch processing', { 
          jobId, 
          batchNumber, 
          processedSoFar: insertedCount 
        });
        return insertedCount; // Mevcut durumu döndür
      }
      
      // Memory kontrolü - limit aşılırsa GC tetikle
      const memCheck = checkMemory();
      if (!memCheck.ok) {
        logger.warn('Memory pressure, forcing GC', { usedMB: memCheck.usedMB });
        forceGC();
        // Kısa bir bekleme
        await new Promise(r => setTimeout(r, 100));
      }
      
      // Batch'i işle
      const batch = transformedRows.slice(i, i + BATCH_SIZE);
      
      // VALUES oluştur - Akıllı tarih dönüştürücü ile
      const values = batch.map(row => {
        const vals = columns.map((col: string) => {
          const val = row[col];
          if (val === null || val === undefined) {
            return 'NULL';
          }
          
          // Tarih/DateTime kontrolü - akıllı dönüştürücü
          if (val instanceof Date || (typeof val === 'string' && val.match(/\d{4}[-\/]\d{2}[-\/]\d{2}|\d{2}[-\/]\d{2}[-\/]\d{4}/))) {
            const converted = toClickHouseDateTime(val);
            if (converted) return `'${converted}'`;
            return 'NULL';
          }
          
          if (typeof val === 'string') {
            // String escape - SQL injection koruması
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
        
        // Progress log (her 10 batch'te bir)
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
        
        // Her GC_INTERVAL batch'te bir GC tetikle (memory basıncını azalt)
        if (batchNumber % (GC_INTERVAL / BATCH_SIZE) === 0) {
          forceGC();
        }
        
      } catch (insertErr: any) {
        logger.error('Insert error', { 
          error: insertErr.message, 
          batch: batchNumber,
          rowRange: `${i}-${i + batch.length}`
        });
        // Devam et, diğer batch'leri dene
      }
    }
    
    // Son GC
    forceGC();
    
    // ============================================
    // VERİ TUTARLILIK KONTROLÜ VE DUPLICATE TEMİZLİĞİ
    // ============================================
    const validation = await validateDataConsistency(dataset, null, transformedRows.length);
    
    if (!validation.isConsistent) {
      logger.warn('Data consistency warning', {
        datasetId: dataset.id,
        expected: transformedRows.length,
        actual: validation.targetCount,
        duplicatesRemoved: validation.duplicateCount
      });
    }
    
    const finalMem = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
    logger.info('Full refresh completed', { 
      datasetId: dataset.id, 
      rowsInserted: insertedCount,
      finalRowCount: validation.targetCount,
      duplicatesRemoved: validation.duplicateCount,
      isConsistent: validation.isConsistent,
      finalMemoryMB: finalMem
    });
    
    return validation.targetCount; // OPTIMIZE sonrası gerçek sayı
    
  } catch (error: any) {
    logger.error('Full refresh error', { datasetId: dataset.id, error: error.message });
    throw error;
  }
}

// ============================================
// PENDING JOBS PROCESSOR
// ============================================

/**
 * Veritabanındaki pending job'ları işle
 * Bu, ETL başlat butonuna basıldığında oluşturulan job'ları işler
 * 
 * ⚠️ KRİTİK KURAL: Aynı dataset için aynı anda sadece bir job çalışabilir!
 * Bu kural duplicate job'ları önler ve birbirini bloklamayı engeller.
 */
async function processPendingJobs(): Promise<void> {
  try {
    // Pending durumundaki job'ları al (en eski önce)
    const pendingJobs = await db.queryAll(`
      SELECT 
        e.id as job_id, 
        e.dataset_id, 
        e.action, 
        e.tenant_id,
        d.name as dataset_name,
        d.clickhouse_table
      FROM etl_jobs e
      JOIN datasets d ON e.dataset_id = d.id
      WHERE e.status = 'pending'
      ORDER BY e.started_at ASC
      LIMIT 10
    `);

    if (pendingJobs.length === 0) {
      return; // Bekleyen job yok
    }

    logger.info('Processing pending jobs', { count: pendingJobs.length });

    for (const job of pendingJobs) {
      // ⚠️ DUPLICATE PREVENTION: Dataset lock kontrolü
      const lockAcquired = await acquireDatasetLock(job.dataset_id);
      
      if (!lockAcquired) {
        // Bu dataset için zaten çalışan bir job var
        logger.warn('Skipping job - dataset already has running job (duplicate prevention)', {
          jobId: job.job_id,
          datasetId: job.dataset_id,
          dataset: job.dataset_name
        });
        
        // Job'ı skip olarak işaretle (tekrar denenmemesi için)
        await db.query(
          `UPDATE etl_jobs SET status = 'skipped', completed_at = NOW(), 
           error_message = 'Aynı dataset için zaten çalışan bir job var (duplicate prevention)' 
           WHERE id = $1`,
          [job.job_id]
        );
        continue;
      }
      
      try {
        // Job'ı running olarak işaretle
        await db.query(
          `UPDATE etl_jobs SET status = 'running', started_at = NOW() WHERE id = $1`,
          [job.job_id]
        );
        
        // Aktif job bilgisini Redis'e kaydet (kill için)
        await cache.set(`etl:active:${job.job_id}`, JSON.stringify({
          datasetId: job.dataset_id,
          datasetName: job.dataset_name,
          startedAt: new Date().toISOString(),
          pid: process.pid
        }), LOCK_TTL);

        logger.info('Starting pending job', { 
          jobId: job.job_id, 
          dataset: job.dataset_name, 
          action: job.action 
        });

        // Dataset bilgisini al
        const dataset = await db.queryOne(
          'SELECT * FROM datasets WHERE id = $1',
          [job.dataset_id]
        );

        if (!dataset) {
          throw new Error(`Dataset not found: ${job.dataset_id}`);
        }

        // Connection bilgisini al
        const connection = await db.queryOne(
          'SELECT * FROM data_connections WHERE id = $1',
          [dataset.connection_id]
        );

        if (!connection) {
          throw new Error(`Connection not found: ${dataset.connection_id}`);
        }

        const startTime = Date.now();
        let rowsProcessed = 0;

        // ✅ Önce ÖZEL ACTION'ları kontrol et (new_records_sync, missing_sync, partial_refresh)
        if (job.action === 'new_records_sync') {
          // 🚀 Sadece yeni kayıtları çek (max ID'den sonrası)
          logger.info('🚀 NEW RECORDS SYNC starting from pending job', { jobId: job.job_id });
          
          // ClickHouse'daki max ID'yi al
          const pkColumn = dataset.reference_column || 'id';
          const chStats = await clickhouse.query(`SELECT max(${pkColumn}) as max_id FROM clixer_analytics.${dataset.clickhouse_table}`);
          const chMaxId = Number(chStats[0]?.max_id) || 0;
          
          rowsProcessed = await syncNewRecordsAfterMaxId(dataset, connection, job.job_id, pkColumn, chMaxId);
        } 
        else if (job.action === 'partial_refresh') {
          // Kısmi yenileme (son X gün)
          const days = dataset.delete_days || 7;
          rowsProcessed = await syncByDateDeleteInsert(dataset, connection, job.job_id);
        }
        else {
          // Normal sync - stratejisine göre veri çek
          switch (dataset.sync_strategy) {
            case 'timestamp':
              rowsProcessed = await syncByTimestamp(dataset, connection, job.job_id);
              break;
            case 'id':
              rowsProcessed = await syncById(dataset, connection, job.job_id);
              break;
            case 'date_partition':
              rowsProcessed = await syncByDatePartition(dataset, connection, job.job_id);
              break;
            case 'date_delete_insert':
              rowsProcessed = await syncByDateDeleteInsert(dataset, connection, job.job_id);
              break;
            case 'full_refresh':
            default:
              rowsProcessed = await fullRefresh(dataset, connection, job.job_id);
          }
        }
        
        // Kill check - job iptal edilmiş olabilir
        if (await isJobCancelled(job.job_id)) {
          logger.info('Job was cancelled', { jobId: job.job_id });
          await db.query(
            `UPDATE etl_jobs SET status = 'cancelled', completed_at = NOW() WHERE id = $1`,
            [job.job_id]
          );
        } else {
          // Job başarılı
          await db.query(
            `UPDATE etl_jobs SET status = 'completed', completed_at = NOW(), rows_processed = $1 WHERE id = $2`,
            [rowsProcessed, job.job_id]
          );

          // Dataset güncelle
          let totalRows = rowsProcessed;
          try {
            if (dataset.clickhouse_table) {
              const countResult = await clickhouse.query(`SELECT count() as cnt FROM clixer_analytics.${dataset.clickhouse_table}`);
              totalRows = countResult[0]?.cnt || rowsProcessed;
            }
          } catch (e) {
            logger.warn('Could not get total rows from ClickHouse', { error: e });
          }
          
          await db.query(
            `UPDATE datasets SET last_sync_at = NOW(), last_sync_rows = $1, total_rows = $2, status = 'active' WHERE id = $3`,
            [rowsProcessed, totalRows, job.dataset_id]
          );

          // Cache invalidate
          await cache.invalidate(`kpi:${dataset.clickhouse_table}:*`, 'etl');

          logger.info('Pending job completed', {
            jobId: job.job_id,
            dataset: job.dataset_name,
            rowsProcessed,
            duration: `${Date.now() - startTime}ms`
          });
        }

      } catch (jobError: any) {
        // Job başarısız
        logger.error('Pending job failed', { 
          jobId: job.job_id, 
          dataset: job.dataset_name, 
          error: jobError.message 
        });

        await db.query(
          `UPDATE etl_jobs SET status = 'failed', completed_at = NOW(), error_message = $1 WHERE id = $2`,
          [jobError.message, job.job_id]
        );
      } finally {
        // ⚠️ ÖNEMLİ: Lock'ı her zaman serbest bırak!
        await releaseDatasetLock(job.dataset_id);
        // Aktif job kaydını temizle
        await cache.del(`etl:active:${job.job_id}`);
      }
    }
  } catch (error) {
    logger.error('Pending jobs processor error', { error });
  }
}

// ============================================
// SCHEDULER
// ============================================

async function checkScheduledJobs(): Promise<void> {
  try {
    // etl_schedules tablosundan zamanı gelen schedule'ları bul
    const schedules = await db.queryAll(
      `SELECT s.*, d.name as dataset_name, d.clickhouse_table
       FROM etl_schedules s
       JOIN datasets d ON s.dataset_id = d.id
       WHERE s.is_active = true
       AND d.status = 'active'
       AND (s.next_run_at IS NULL OR s.next_run_at <= NOW())`
    );

    logger.info('Checking scheduled jobs', { count: schedules.length });

    for (const schedule of schedules) {
      logger.info('Running scheduled sync', { dataset: schedule.dataset_name, cron: schedule.cron_expression });
      
      try {
        await processETLJob({
          datasetId: schedule.dataset_id,
          action: 'incremental_sync'
        });

        // Bir sonraki çalışma zamanını hesapla (basit: cron'a göre)
        let nextRun = new Date();
        const cron = schedule.cron_expression;
        
        // Basit cron parser
        if (cron === '* * * * *') nextRun.setMinutes(nextRun.getMinutes() + 1);
        else if (cron === '*/5 * * * *') nextRun.setMinutes(nextRun.getMinutes() + 5);
        else if (cron === '*/15 * * * *') nextRun.setMinutes(nextRun.getMinutes() + 15);
        else if (cron === '*/30 * * * *') nextRun.setMinutes(nextRun.getMinutes() + 30);
        else if (cron === '0 * * * *') nextRun.setHours(nextRun.getHours() + 1);
        else if (cron === '0 */6 * * *') nextRun.setHours(nextRun.getHours() + 6);
        else if (cron === '0 */12 * * *') nextRun.setHours(nextRun.getHours() + 12);
        else if (cron === '0 0 * * *') nextRun.setDate(nextRun.getDate() + 1);
        else nextRun.setMinutes(nextRun.getMinutes() + 1); // default: 1 dakika

        // Schedule'ı güncelle
        await db.query(
          `UPDATE etl_schedules SET next_run_at = $1, last_run_at = NOW() WHERE id = $2`,
          [nextRun, schedule.id]
        );
      } catch (jobError: any) {
        logger.error('Scheduled job failed', { dataset: schedule.dataset_name, error: jobError.message });
      }
    }
  } catch (error) {
    logger.error('Scheduler error', { error });
  }
}

// ============================================
// START WORKER
// ============================================

async function start() {
  try {
    db.createPool();
    await db.checkHealth();
    logger.info('PostgreSQL connected');

    clickhouse.createClickHouseClient();
    await clickhouse.checkHealth();
    logger.info('ClickHouse connected');

    cache.createRedisClient();
    await cache.checkHealth();
    logger.info('Redis connected');

    // ETL trigger event'lerini dinle
    cache.subscribe('etl:trigger', async (message: ETLJob) => {
      try {
        // Active jobs sayısını artır
        await cache.set('etl:worker:active_jobs', '1', 3600);
        await processETLJob(message);
        await cache.set('etl:worker:active_jobs', '0', 3600);
      } catch (error) {
        logger.error('ETL job processing failed', { message, error });
        await cache.set('etl:worker:active_jobs', '0', 3600);
      }
    });

    // İlk başlangıçta bekleyen job'ları kontrol et
    logger.info('Checking for pending jobs on startup...');
    await processPendingJobs();

    // Pending job'ları her 5 saniyede bir kontrol et
    setInterval(async () => {
      try {
        await processPendingJobs();
      } catch (e) {
        logger.error('Pending jobs check failed', { error: e });
      }
    }, 5 * 1000);

    // Scheduler - her dakika kontrol et
    setInterval(checkScheduledJobs, 60 * 1000);

    // Heartbeat - her 10 saniye
    const sendHeartbeat = async () => {
      try {
        await cache.set('etl:worker:heartbeat', Date.now().toString(), 60);
        await cache.set('etl:worker:status', JSON.stringify({
          startedAt: new Date().toISOString(),
          pid: process.pid,
          uptime: process.uptime()
        }), 60);
      } catch (e) {
        logger.error('Heartbeat failed', { error: e });
      }
    };
    
    // İlk heartbeat
    await sendHeartbeat();
    // Periyodik heartbeat
    setInterval(sendHeartbeat, 10 * 1000);

    logger.info('⚙️ ETL Worker started');

  } catch (error) {
    logger.error('Failed to start etl-worker', { error });
    process.exit(1);
  }
}

start();
