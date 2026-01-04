-- Clixer ClickHouse Schema
-- Analytic data storage (OLAP)

-- Create database
CREATE DATABASE IF NOT EXISTS clixer_analytics;

-- Example: Pre-aggregated daily sales materialized view template
-- Real tables will be created dynamically via ETL

-- System tables for tracking
CREATE TABLE IF NOT EXISTS clixer_analytics._etl_log (
    dataset_id String,
    sync_type String,
    rows_inserted UInt64,
    duration_ms UInt32,
    synced_at DateTime DEFAULT now()
)
ENGINE = MergeTree()
ORDER BY (dataset_id, synced_at)
TTL synced_at + INTERVAL 30 DAY;
