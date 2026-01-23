/**
 * RLS (Row-Level Security) Helper Functions
 * SQL query manipulation for tenant isolation
 */

import { createLogger } from '@clixer/shared';

const logger = createLogger({ service: 'analytics-service' });

/**
 * Add RLS WHERE clause to SQL query
 * Adds AND if WHERE exists, creates WHERE if not
 * Inserted before GROUP BY, ORDER BY, LIMIT
 */
export function addRLSWhereClause(sql: string, column: string, value: string): string {
  const sqlLower = sql.toLowerCase();
  
  // RLS condition
  const rlsCondition = `${column} = '${value.replace(/'/g, "''")}'`;
  
  // Find WHERE clause
  const whereIndex = sqlLower.indexOf(' where ');
  const groupByIndex = sqlLower.indexOf(' group by ');
  const orderByIndex = sqlLower.indexOf(' order by ');
  const limitIndex = sqlLower.indexOf(' limit ');
  
  // Find earliest terminator clause
  let insertIndex = sql.length;
  if (limitIndex !== -1 && limitIndex < insertIndex) insertIndex = limitIndex;
  if (orderByIndex !== -1 && orderByIndex < insertIndex) insertIndex = orderByIndex;
  if (groupByIndex !== -1 && groupByIndex < insertIndex) insertIndex = groupByIndex;
  
  if (whereIndex !== -1 && whereIndex < insertIndex) {
    // WHERE exists - add with AND
    const beforeClause = sql.substring(0, insertIndex);
    const afterClause = sql.substring(insertIndex);
    
    return `${beforeClause} AND ${rlsCondition}${afterClause}`;
  } else {
    // No WHERE - create one
    const beforeClause = sql.substring(0, insertIndex);
    const afterClause = sql.substring(insertIndex);
    
    return `${beforeClause} WHERE ${rlsCondition}${afterClause}`;
  }
}

/**
 * Build RLS condition string based on user's filter level
 */
export function buildRLSCondition(
  filterLevel: string | undefined,
  filterValue: string | undefined,
  storeColumn: string = 'store_id',
  regionColumn: string = 'region_id',
  ownershipGroupColumn: string = 'ownership_group_id'
): string {
  if (!filterLevel || !filterValue || filterLevel === 'all') {
    return '';
  }
  
  switch (filterLevel) {
    case 'store':
      return ` AND ${storeColumn} = '${filterValue.replace(/'/g, "''")}'`;
    case 'region':
      return ` AND ${regionColumn} = '${filterValue.replace(/'/g, "''")}'`;
    case 'ownership_group':
      return ` AND ${ownershipGroupColumn} = '${filterValue.replace(/'/g, "''")}'`;
    default:
      logger.warn('Unknown filter level', { filterLevel, filterValue });
      return '';
  }
}

/**
 * Build store filter condition from storeIds array
 */
export function buildStoreFilterCondition(
  storeIds: string[] | undefined,
  storeColumn: string = 'store_id'
): string {
  if (!storeIds || storeIds.length === 0) {
    return '';
  }
  
  const escapedIds = storeIds.map(id => `'${id.replace(/'/g, "''")}'`).join(',');
  return ` AND ${storeColumn} IN (${escapedIds})`;
}
