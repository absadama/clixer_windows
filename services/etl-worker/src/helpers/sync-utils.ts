/**
 * Sync Utilities
 * Common helper functions for ETL sync operations
 */

import { clickhouse, db, createLogger } from '@clixer/shared';

const logger = createLogger({ service: 'etl-worker' });

// ============================================
// COLUMN MAPPING
// ============================================

/**
 * Parse column mapping from dataset
 * Handles both string (JSON) and array formats
 */
export function parseColumnMapping(dataset: any): any[] {
  let columnMapping = dataset.column_mapping || [];
  if (typeof columnMapping === 'string') {
    try {
      columnMapping = JSON.parse(columnMapping);
    } catch (e) {
      columnMapping = [];
    }
  }
  return columnMapping;
}

// ============================================
// CLICKHOUSE TABLE OPERATIONS
// ============================================

/**
 * Truncate ClickHouse table with fallback
 * Uses TRUNCATE first, falls back to ALTER DELETE if that fails
 */
export async function truncateClickHouseTable(tableName: string): Promise<void> {
  const fullTableName = tableName.includes('.') ? tableName : `clixer_analytics.${tableName}`;
  
  try {
    await clickhouse.execute(`TRUNCATE TABLE ${fullTableName}`);
    logger.info('Truncated ClickHouse table', { table: fullTableName });
  } catch (truncErr: any) {
    logger.warn('Could not truncate, trying ALTER DELETE', { error: truncErr.message });
    await clickhouse.execute(`ALTER TABLE ${fullTableName} DELETE WHERE 1=1`);
    logger.info('Table cleared via ALTER DELETE', { table: fullTableName });
  }
}

/**
 * Optimize ClickHouse table (ReplacingMergeTree duplicate cleanup)
 * Skip for large tables to avoid long operations
 */
export async function optimizeClickHouseTable(
  tableName: string, 
  options: { skipIfLargerThan?: number; silent?: boolean } = {}
): Promise<boolean> {
  const fullTableName = tableName.includes('.') ? tableName : `clixer_analytics.${tableName}`;
  const { skipIfLargerThan = 1000000, silent = false } = options;
  
  try {
    // Check row count if limit specified
    if (skipIfLargerThan > 0) {
      const countResult = await clickhouse.queryOne<{ cnt: number }>(
        `SELECT count() as cnt FROM ${fullTableName}`
      );
      if (countResult && countResult.cnt > skipIfLargerThan) {
        if (!silent) {
          logger.info('Skipping OPTIMIZE for large table', { 
            table: fullTableName, 
            rows: countResult.cnt,
            limit: skipIfLargerThan 
          });
        }
        return false;
      }
    }
    
    await clickhouse.execute(`OPTIMIZE TABLE ${fullTableName} FINAL`);
    if (!silent) {
      logger.info('OPTIMIZE FINAL completed', { table: fullTableName });
    }
    return true;
  } catch (optErr: any) {
    if (!silent) {
      logger.warn('OPTIMIZE failed (non-critical)', { error: optErr.message });
    }
    return false;
  }
}

// ============================================
// JOB PROGRESS
// ============================================

/**
 * Update ETL job progress
 */
export async function updateJobProgress(
  jobId: string | null | undefined,
  rowsProcessed: number,
  message?: string
): Promise<void> {
  if (!jobId) return;
  
  try {
    if (message) {
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1, error_message = $2 WHERE id = $3`,
        [rowsProcessed, message, jobId]
      );
    } else {
      await db.query(
        `UPDATE etl_jobs SET rows_processed = $1 WHERE id = $2`,
        [rowsProcessed, jobId]
      );
    }
  } catch (err: any) {
    logger.warn('Failed to update job progress', { jobId, error: err.message });
  }
}

// ============================================
// VALUE TRANSFORMATION
// ============================================

/**
 * Get default value for ClickHouse column type
 * Used when source value is null/undefined
 */
export function getDefaultValueForType(clickhouseType: string | undefined): any {
  if (!clickhouseType) return '';
  
  if (clickhouseType === 'String') return '';
  if (clickhouseType.includes('Int') || clickhouseType.includes('Float')) return 0;
  if (clickhouseType === 'Date') return '1970-01-01';
  if (clickhouseType === 'DateTime') return '1970-01-01 00:00:00';
  
  return '';
}

/**
 * Apply null handling to a value based on ClickHouse type
 */
export function applyNullHandling(value: any, clickhouseType: string | undefined): any {
  if (value === null || value === undefined) {
    return getDefaultValueForType(clickhouseType);
  }
  return value;
}

// ============================================
// QUERY UTILITIES
// ============================================

/**
 * Remove LIMIT clause from SQL query
 * Handles different database syntaxes
 */
export function removeQueryLimits(query: string, dbType?: string): string {
  let cleanQuery = query;
  
  // Remove standard LIMIT clause
  cleanQuery = cleanQuery.replace(/\s+LIMIT\s+\d+\s*/gi, ' ').trim();
  
  // Remove MSSQL TOP clause
  if (dbType === 'mssql') {
    cleanQuery = cleanQuery.replace(/\bSELECT\s+TOP\s*\(?(\d+)\)?\s+/gi, 'SELECT ').trim();
  }
  
  return cleanQuery;
}

/**
 * Extract table name from SQL query
 */
export function extractTableFromQuery(query: string): string | null {
  // MSSQL format: [schema].[table] or schema.table
  const mssqlMatch = query.match(/FROM\s+\[?(\w+)\]?\.\[?(\w+)\]?/i);
  if (mssqlMatch) {
    return mssqlMatch[2] || mssqlMatch[1];
  }
  
  // Simple format: FROM table
  const simpleMatch = query.match(/FROM\s+\[?(\w+)\]?/i);
  if (simpleMatch) {
    return simpleMatch[1];
  }
  
  return null;
}
