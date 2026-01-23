/**
 * Data Service Types
 */

import { Request } from 'express';

// ============================================
// AUTHENTICATED REQUEST
// ============================================

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    role: string;
    email: string;
    filterLevel?: string;
    filterValue?: string;
  };
}

// ============================================
// CONNECTION TYPES
// ============================================

export type ConnectionType = 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'api';

export interface DataConnection {
  id: string;
  tenantId: string;
  name: string;
  type: ConnectionType;
  host?: string;
  port?: number;
  databaseName?: string;
  username?: string;
  passwordEncrypted?: string;
  apiConfig?: ApiConfig;
  sslEnabled?: boolean;
  status: 'active' | 'inactive' | 'error';
  lastTestedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  bodyTemplate?: string;
  authType?: 'none' | 'basic' | 'bearer' | 'api_key';
  authConfig?: Record<string, string>;
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latency?: number;
  version?: string;
  error?: string;
}

// ============================================
// DATASET TYPES
// ============================================

export interface Dataset {
  id: string;
  tenantId: string;
  connectionId: string;
  name: string;
  description?: string;
  sourceType: 'table' | 'query' | 'api';
  sourceTable?: string;
  sourceQuery?: string;
  clickhouseTable: string;
  columns: DatasetColumn[];
  primaryKeyColumn?: string;
  dateColumn?: string;
  storeColumn?: string;
  regionColumn?: string;
  groupColumn?: string;
  syncMode: 'full' | 'incremental' | 'append';
  syncSchedule?: string;
  lastSyncAt?: Date;
  lastSyncStatus?: 'success' | 'failed' | 'running';
  lastSyncRowCount?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetColumn {
  name: string;
  sourceType: string;
  clickhouseType: string;
  isNullable: boolean;
  isPrimaryKey?: boolean;
  isDateColumn?: boolean;
}

// ============================================
// ETL TYPES
// ============================================

export interface ETLJob {
  id: string;
  tenantId: string;
  datasetId: string;
  datasetName?: string;
  status: ETLJobStatus;
  syncMode: 'full' | 'incremental' | 'append';
  startedAt: Date;
  completedAt?: Date;
  rowsProcessed: number;
  rowsInserted: number;
  rowsUpdated: number;
  rowsDeleted: number;
  errorMessage?: string;
  progress: number;
  createdBy?: string;
}

export type ETLJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ETLSchedule {
  id: string;
  datasetId: string;
  cronExpression: string;
  isActive: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

export interface ETLWorkerStatus {
  isRunning: boolean;
  pid?: number;
  startedAt?: Date;
  jobsProcessed?: number;
  currentJob?: string;
}

// ============================================
// SYSTEM TYPES
// ============================================

export interface SystemLock {
  datasetId: string;
  datasetName: string;
  lockedAt: Date;
  lockedBy: string;
  jobId?: string;
}

export interface SystemStats {
  postgres: {
    connections: number;
    maxConnections: number;
    databaseSize: string;
    activeQueries: number;
  };
  clickhouse: {
    totalRows: number;
    totalBytes: string;
    tablesCount: number;
    partsCount: number;
  };
  redis: {
    usedMemory: string;
    connectedClients: number;
    keys: number;
    hitRate: number;
  };
  etl: {
    runningJobs: number;
    pendingJobs: number;
    completedToday: number;
    failedToday: number;
  };
}

// ============================================
// PERFORMANCE TYPES
// ============================================

export interface PerformanceMetrics {
  postgres?: PostgresPerformance;
  clickhouse?: ClickHousePerformance;
  redis?: RedisPerformance;
  etl?: ETLPerformance;
}

export interface PostgresPerformance {
  databaseSize: string;
  tableCount: number;
  indexCount: number;
  activeConnections: number;
  cacheHitRatio: number;
  slowQueries: number;
  deadTuples: number;
}

export interface ClickHousePerformance {
  totalRows: number;
  totalBytes: string;
  partsCount: number;
  tablesCount: number;
  queriesPerSecond: number;
  insertedRowsPerSecond: number;
}

export interface RedisPerformance {
  usedMemory: string;
  peakMemory: string;
  connectedClients: number;
  totalKeys: number;
  hitRate: number;
  evictedKeys: number;
}

export interface ETLPerformance {
  averageDuration: number;
  averageRowsPerSecond: number;
  successRate: number;
  totalJobsToday: number;
  totalRowsToday: number;
}
