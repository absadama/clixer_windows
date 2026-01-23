/**
 * ETL Worker Constants
 */

// Memory Optimization
export const MAX_MEMORY_MB = 1024; // 1GB limit
export const BATCH_SIZE = 5000; // Small batches = less memory
export const GC_INTERVAL = 10000; // GC trigger every 10 batches

// Lock Management
export const LOCK_TTL = 3600; // 1 hour lock timeout (prevents infinite runs)

// Streaming Configuration
export const STREAM_BATCH_SIZE = 10000; // Rows to read from cursor at once
export const INSERT_BATCH_SIZE = 5000;  // Batch size for ClickHouse inserts
