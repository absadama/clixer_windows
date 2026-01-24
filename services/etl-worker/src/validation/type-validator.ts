/**
 * Type Validation Module
 * Validates SQL to ClickHouse type compatibility
 */

import { createLogger, clickhouse } from '@clixer/shared';
import { TypeMismatch } from '../types';

const logger = createLogger({ service: 'etl-worker' });

/**
 * Convert SQL type to ClickHouse type
 */
export function sqlToClickHouseType(sqlType: string): string {
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
  
  const baseType = normalized.replace(/\(.*\)/, '').trim();
  
  return typeMap[baseType] || typeMap[normalized] || 'String';
}

/**
 * Check if two ClickHouse types are compatible
 */
export function areTypesCompatible(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  
  // Int32 ↔ Int64 compatible (upcast)
  if (expected.startsWith('Int') && actual.startsWith('Int')) return true;
  
  // Float32 ↔ Float64 compatible
  if (expected.startsWith('Float') && actual.startsWith('Float')) return true;
  
  // String is compatible with everything
  if (actual === 'String') return true;
  
  return false;
}

/**
 * Validate source table and ClickHouse table type compatibility
 */
export async function validateTypeCompatibility(
  dataset: any, 
  connection: any
): Promise<{ valid: boolean; mismatches: TypeMismatch[]; warning: string | null }> {
  const mismatches: TypeMismatch[] = [];
  
  try {
    const columnMapping = typeof dataset.column_mapping === 'string' 
      ? JSON.parse(dataset.column_mapping) 
      : dataset.column_mapping;
    
    if (!columnMapping || columnMapping.length === 0) {
      logger.warn('No column mapping found, skipping type validation');
      return { valid: true, mismatches: [], warning: null };
    }
    
    if (!dataset.clickhouse_table) {
      return { valid: true, mismatches: [], warning: null };
    }
    
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
      const warning = `Type mismatch: ${mismatches.map(m => `${m.column}(${m.sourceType}→${m.clickhouseType})`).join(', ')}`;
      logger.error('TYPE MISMATCH DETECTED!', { mismatches, dataset: dataset.name });
      return { valid: false, mismatches, warning };
    }
    
    return { valid: true, mismatches: [], warning: null };
    
  } catch (error: any) {
    logger.warn('Type validation failed, proceeding with caution', { error: error.message });
    return { valid: true, mismatches: [], warning: `Type validation failed: ${error.message}` };
  }
}
