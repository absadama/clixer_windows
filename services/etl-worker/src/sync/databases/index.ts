/**
 * Database Sync Modules Index
 * Re-exports database-specific sync functions
 */

export { streamingPostgreSQLSync, insertToClickHouse, injectDependencies as injectPostgresDeps } from './postgresql-sync';

// Note: mssqlSync and mysqlSync remain in main index.ts for now due to complexity
// They will be migrated in a future refactoring phase
