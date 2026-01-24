/**
 * Data Validation Module
 * Validates data consistency and handles duplicates
 */

import { createLogger, clickhouse } from '@clixer/shared';
import { DataValidationResult } from '../types';

const logger = createLogger({ service: 'etl-worker' });

/**
 * Run OPTIMIZE for ReplacingMergeTree - removes duplicates
 * CRITICAL: Must be called after each sync!
 */
export async function optimizeTable(tableName: string): Promise<number> {
  try {
    const beforeCount = await clickhouse.queryOne(
      `SELECT count() as cnt FROM clixer_analytics.${tableName}`
    );
    
    await clickhouse.execute(`OPTIMIZE TABLE clixer_analytics.${tableName} FINAL`);
    
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
 * Validate data consistency
 * Compares source and target row counts
 */
export async function validateDataConsistency(
  dataset: any, 
  sourceClient: any, 
  expectedRows: number
): Promise<DataValidationResult> {
  try {
    const targetResult = await clickhouse.queryOne(
      `SELECT count() as cnt FROM clixer_analytics.${dataset.clickhouse_table}`
    );
    const targetCount = targetResult?.cnt || 0;
    
    let duplicateCount = 0;
    try {
      duplicateCount = await optimizeTable(dataset.clickhouse_table);
    } catch (e) {
      // Ignore
    }
    
    // Tolerance: 1% difference is acceptable
    const tolerance = Math.ceil(expectedRows * 0.01);
    const isConsistent = Math.abs(targetCount - expectedRows) <= tolerance;
    
    const result: DataValidationResult = {
      sourceCount: expectedRows,
      targetCount,
      isConsistent,
      duplicateCount,
      message: isConsistent 
        ? `Data consistent: ${targetCount} rows (expected: ${expectedRows})`
        : `Data mismatch: ${targetCount} rows (expected: ${expectedRows}, diff: ${Math.abs(targetCount - expectedRows)})`
    };
    
    logger.info('Data validation completed', result);
    return result;
  } catch (error: any) {
    return {
      sourceCount: expectedRows,
      targetCount: 0,
      isConsistent: false,
      duplicateCount: 0,
      message: `Validation error: ${error.message}`
    };
  }
}

/**
 * Check partition duplicates
 * Same date data should not repeat in date partitions
 */
export async function checkPartitionDuplicates(
  tableName: string, 
  partitionColumn: string,
  dateValue: string
): Promise<number> {
  try {
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
