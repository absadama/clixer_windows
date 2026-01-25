/**
 * ETL Worker Constants
 * Performance optimized for 100M+ row tables
 */

// Memory Optimization
export const MAX_MEMORY_MB = parseInt(process.env.ETL_MAX_MEMORY_MB || '2048'); // 2GB default (sunucuya göre ayarla)
export const BATCH_SIZE = parseInt(process.env.ETL_BATCH_SIZE || '10000'); // Büyük tablolar için optimize edildi
export const GC_INTERVAL = 10000; // GC trigger every 10 batches

// Lock Management
export const LOCK_TTL = parseInt(process.env.ETL_LOCK_TTL || '7200'); // 2 saat - 100M+ satır sync için

// Streaming Configuration
export const STREAM_BATCH_SIZE = parseInt(process.env.ETL_STREAM_BATCH_SIZE || '20000'); // Daha az DB round-trip
export const INSERT_BATCH_SIZE = parseInt(process.env.ETL_INSERT_BATCH_SIZE || '10000');  // ClickHouse insert batch
