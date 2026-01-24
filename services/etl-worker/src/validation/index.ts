/**
 * Validation Module Index
 */

export { sqlToClickHouseType, areTypesCompatible, validateTypeCompatibility } from './type-validator';
export { optimizeTable, validateDataConsistency, checkPartitionDuplicates } from './data-validator';
