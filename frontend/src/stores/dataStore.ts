/**
 * Clixer - Data Page Store
 * DataPage.tsx için merkezi state yönetimi
 * 67 useState → Zustand store
 */

import { create } from 'zustand'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ============================================
// TYPES
// ============================================

export interface Connection {
  id: string
  name: string
  description?: string
  type: 'postgresql' | 'mssql' | 'mysql' | 'api' | 'excel'
  host: string
  port: number
  database_name: string
  username?: string
  status: 'pending' | 'active' | 'error'
  status_message?: string
  last_tested_at?: string
  created_at: string
  api_auth_config?: {
    auth_type: 'none' | 'api_key' | 'bearer' | 'basic'
    api_key?: string
    bearer_token?: string
    basic_username?: string
    basic_password?: string
  }
}

export interface Dataset {
  id: string
  connection_id: string
  name: string
  source_table?: string
  source_query?: string
  clickhouse_table: string
  sync_strategy: string
  sync_schedule?: string
  reference_column?: string
  row_limit?: number | null
  delete_days?: number | null
  status: string
  status_message?: string
  last_sync_at?: string
  last_sync_rows?: number
  total_rows?: number
  connection_name?: string
  connection_type?: string
  description?: string
  store_column?: string | null
  region_column?: string | null
  group_column?: string | null
  partition_column?: string | null
}

export interface ETLJob {
  id: string
  dataset_id: string
  dataset_name?: string
  action: string
  status: string
  started_at?: string
  completed_at?: string
  rows_processed?: number
  row_limit?: number
  error_message?: string
  last_progress_at?: string
}

export interface Schedule {
  id: string
  dataset_id: string
  dataset_name?: string
  cron_expression: string
  is_active: boolean
  next_run_at?: string
  last_run_at?: string
}

export interface ETLWorkerStatus {
  status: 'running' | 'stopped' | 'unknown'
  lastHeartbeat: string | null
  activeJobs: number
  workerInfo: {
    startedAt: string
    pid: number
    uptime: number
  } | null
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  clickhouseType?: string
}

export interface TableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  rowCount: number
  executionTime: number
}

export type ActiveTab = 'connections' | 'datasets' | 'etl' | 'sql' | 'clickhouse' | 'system' | 'performance'

// ============================================
// STORE STATE
// ============================================

interface DataState {
  // Active Tab
  activeTab: ActiveTab
  
  // Core Data
  connections: Connection[]
  datasets: Dataset[]
  etlJobs: ETLJob[]
  schedules: Schedule[]
  
  // ClickHouse Tables
  clickhouseTables: any[]
  clickhouseLoading: boolean
  selectedChTable: any | null
  showChTableModal: boolean
  
  // Data Management (Date-based delete)
  showDataManagementModal: boolean
  dataManagementTable: string
  dataManagementDatasetId: string
  dataManagementColumns: any[]
  dataManagementLoading: boolean
  dataManagementPreview: any | null
  dmDateColumn: string
  dmDeleteMode: 'days' | 'range'
  dmDays: number
  dmStartDate: string
  dmEndDate: string
  dmActiveTab: 'delete' | 'validate'
  
  // Validation
  comparisonData: any | null
  missingRanges: any | null
  duplicateAnalysis: any | null
  validationLoading: boolean
  pkColumn: string
  
  // Error & Loading
  error: string | null
  
  // ETL Worker
  workerStatus: ETLWorkerStatus | null
  triggeringAll: boolean
  
  // Modals
  showConnectionModal: boolean
  showDatasetModal: boolean
  selectedConnection: Connection | null
  editingConnection: Connection | null
  
  // Dataset Preview & Settings
  showPreviewModal: boolean
  showSettingsModal: boolean
  selectedDataset: Dataset | null
  previewData: { columns: { name: string; type?: string }[], rows: Record<string, any>[], totalRows?: number } | null
  previewLoading: boolean
  
  // API Preview
  showApiPreviewModal: boolean
  apiPreviewConnection: any | null
  apiEndpoint: string
  apiMethod: string
  apiQueryParams: string
  apiResponsePath: string
  apiBody: string
  apiPreviewLoading: boolean
  apiPreviewResult: any | null
  apiPreviewError: string | null
  showApiDatasetForm: boolean
  apiDatasetName: string
  apiSelectedColumns: string[]
  apiDatasetSaving: boolean
  apiSyncSchedule: string
  apiRowLimit: number
  
  // Dataset Creation
  newDatasetName: string
  newDatasetDescription: string
  newDatasetSyncStrategy: string
  newDatasetSyncSchedule: string
  scheduledHour: number
  newDatasetReferenceColumn: string
  newDatasetRowLimit: number | null
  settingsColumns: string[]
  datasetCreating: boolean
  
  // Partition & Refresh
  partitionColumn: string
  partitionType: 'monthly' | 'daily'
  refreshWindowDays: number
  detectModified: boolean
  modifiedColumn: string
  weeklyFullRefresh: boolean
  engineType: 'MergeTree' | 'ReplacingMergeTree'
  customWhere: string
  deleteDays: number
  
  // RLS Columns
  rlsStoreColumn: string
  rlsRegionColumn: string
  rlsGroupColumn: string
  
  // Unique Column
  uniqueColumn: string
  autoDetectedUnique: string | null
  
  // SQL Editor
  sqlQuery: string
  sqlConnectionId: string
  sqlResult: QueryResult | null
  sqlLoading: boolean
  sqlError: string | null
  
  // Tables Explorer
  tables: TableInfo[]
  expandedTable: string | null
  tableColumns: Record<string, ColumnInfo[]>
  
  // System Health
  systemHealth: any | null
  systemHealthLoading: boolean
  systemActionLoading: string | null
  systemAutoRefresh: boolean
  
  // Performance
  performanceData: {
    postgres: any | null
    clickhouse: any | null
    etl: any | null
    connections: Record<string, any>
  }
  performanceLoading: string | null
  performanceActionLoading: string | null
  
  // ETL Monitoring
  etlMonitoring: {
    locks: { key: string; datasetId: string; pid: number; startedAt: string; ttlSeconds: number }[]
    stuckJobs: { id: string; dataset_name: string; runningMinutes: number; rows_processed: number }[]
    runningJobs: { id: string; dataset_name: string; runningMinutes: number; rows_processed: number; status: string }[]
  }
}

// ============================================
// STORE ACTIONS
// ============================================

interface DataActions {
  // Tab
  setActiveTab: (tab: ActiveTab) => void
  
  // Core Data
  setConnections: (connections: Connection[]) => void
  setDatasets: (datasets: Dataset[]) => void
  setETLJobs: (jobs: ETLJob[]) => void
  setSchedules: (schedules: Schedule[]) => void
  
  // ClickHouse
  setClickhouseTables: (tables: any[]) => void
  setClickhouseLoading: (loading: boolean) => void
  setSelectedChTable: (table: any | null) => void
  setShowChTableModal: (show: boolean) => void
  
  // Data Management
  setShowDataManagementModal: (show: boolean) => void
  setDataManagementTable: (table: string) => void
  setDataManagementDatasetId: (id: string) => void
  setDataManagementColumns: (columns: any[]) => void
  setDataManagementLoading: (loading: boolean) => void
  setDataManagementPreview: (preview: any | null) => void
  setDmDateColumn: (column: string) => void
  setDmDeleteMode: (mode: 'days' | 'range') => void
  setDmDays: (days: number) => void
  setDmStartDate: (date: string) => void
  setDmEndDate: (date: string) => void
  setDmActiveTab: (tab: 'delete' | 'validate') => void
  
  // Validation
  setComparisonData: (data: any | null) => void
  setMissingRanges: (ranges: any | null) => void
  setDuplicateAnalysis: (analysis: any | null) => void
  setValidationLoading: (loading: boolean) => void
  setPkColumn: (column: string) => void
  
  // Error
  setError: (error: string | null) => void
  
  // ETL Worker
  setWorkerStatus: (status: ETLWorkerStatus | null) => void
  setTriggeringAll: (triggering: boolean) => void
  
  // Modals
  setShowConnectionModal: (show: boolean) => void
  setShowDatasetModal: (show: boolean) => void
  setSelectedConnection: (connection: Connection | null) => void
  setEditingConnection: (connection: Connection | null) => void
  
  // Preview & Settings
  setShowPreviewModal: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  setSelectedDataset: (dataset: Dataset | null) => void
  setPreviewData: (data: any | null) => void
  setPreviewLoading: (loading: boolean) => void
  
  // API Preview
  setShowApiPreviewModal: (show: boolean) => void
  setApiPreviewConnection: (connection: any | null) => void
  setApiEndpoint: (endpoint: string) => void
  setApiMethod: (method: string) => void
  setApiQueryParams: (params: string) => void
  setApiResponsePath: (path: string) => void
  setApiBody: (body: string) => void
  setApiPreviewLoading: (loading: boolean) => void
  setApiPreviewResult: (result: any | null) => void
  setApiPreviewError: (error: string | null) => void
  setShowApiDatasetForm: (show: boolean) => void
  setApiDatasetName: (name: string) => void
  setApiSelectedColumns: (columns: string[]) => void
  setApiDatasetSaving: (saving: boolean) => void
  setApiSyncSchedule: (schedule: string) => void
  setApiRowLimit: (limit: number) => void
  
  // Dataset Creation
  setNewDatasetName: (name: string) => void
  setNewDatasetDescription: (description: string) => void
  setNewDatasetSyncStrategy: (strategy: string) => void
  setNewDatasetSyncSchedule: (schedule: string) => void
  setScheduledHour: (hour: number) => void
  setNewDatasetReferenceColumn: (column: string) => void
  setNewDatasetRowLimit: (limit: number | null) => void
  setSettingsColumns: (columns: string[]) => void
  setDatasetCreating: (creating: boolean) => void
  
  // Partition & Refresh
  setPartitionColumn: (column: string) => void
  setPartitionType: (type: 'monthly' | 'daily') => void
  setRefreshWindowDays: (days: number) => void
  setDetectModified: (detect: boolean) => void
  setModifiedColumn: (column: string) => void
  setWeeklyFullRefresh: (refresh: boolean) => void
  setEngineType: (type: 'MergeTree' | 'ReplacingMergeTree') => void
  setCustomWhere: (where: string) => void
  setDeleteDays: (days: number) => void
  
  // RLS
  setRlsStoreColumn: (column: string) => void
  setRlsRegionColumn: (column: string) => void
  setRlsGroupColumn: (column: string) => void
  
  // Unique Column
  setUniqueColumn: (column: string) => void
  setAutoDetectedUnique: (column: string | null) => void
  
  // SQL Editor
  setSqlQuery: (query: string) => void
  setSqlConnectionId: (id: string) => void
  setSqlResult: (result: QueryResult | null) => void
  setSqlLoading: (loading: boolean) => void
  setSqlError: (error: string | null) => void
  
  // Tables Explorer
  setTables: (tables: TableInfo[]) => void
  setExpandedTable: (table: string | null) => void
  setTableColumns: (columns: Record<string, ColumnInfo[]>) => void
  
  // System Health
  setSystemHealth: (health: any | null) => void
  setSystemHealthLoading: (loading: boolean) => void
  setSystemActionLoading: (action: string | null) => void
  setSystemAutoRefresh: (refresh: boolean) => void
  
  // Performance
  setPerformanceData: (data: any) => void
  setPerformanceLoading: (loading: string | null) => void
  setPerformanceActionLoading: (action: string | null) => void
  
  // ETL Monitoring
  setEtlMonitoring: (monitoring: any) => void
  
  // Reset
  resetDatasetForm: () => void
  resetApiPreview: () => void
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useDataStore = create<DataState & DataActions>((set) => ({
  // Initial State
  activeTab: 'connections',
  connections: [],
  datasets: [],
  etlJobs: [],
  schedules: [],
  
  clickhouseTables: [],
  clickhouseLoading: false,
  selectedChTable: null,
  showChTableModal: false,
  
  showDataManagementModal: false,
  dataManagementTable: '',
  dataManagementDatasetId: '',
  dataManagementColumns: [],
  dataManagementLoading: false,
  dataManagementPreview: null,
  dmDateColumn: '',
  dmDeleteMode: 'days',
  dmDays: 7,
  dmStartDate: '',
  dmEndDate: '',
  dmActiveTab: 'delete',
  
  comparisonData: null,
  missingRanges: null,
  duplicateAnalysis: null,
  validationLoading: false,
  pkColumn: 'id',
  
  error: null,
  
  workerStatus: null,
  triggeringAll: false,
  
  showConnectionModal: false,
  showDatasetModal: false,
  selectedConnection: null,
  editingConnection: null,
  
  showPreviewModal: false,
  showSettingsModal: false,
  selectedDataset: null,
  previewData: null,
  previewLoading: false,
  
  showApiPreviewModal: false,
  apiPreviewConnection: null,
  apiEndpoint: '',
  apiMethod: 'GET',
  apiQueryParams: '',
  apiResponsePath: '',
  apiBody: '',
  apiPreviewLoading: false,
  apiPreviewResult: null,
  apiPreviewError: null,
  showApiDatasetForm: false,
  apiDatasetName: '',
  apiSelectedColumns: [],
  apiDatasetSaving: false,
  apiSyncSchedule: 'manual',
  apiRowLimit: 10000,
  
  newDatasetName: '',
  newDatasetDescription: '',
  newDatasetSyncStrategy: 'full_refresh',
  newDatasetSyncSchedule: 'manual',
  scheduledHour: 2,
  newDatasetReferenceColumn: '',
  newDatasetRowLimit: null,
  settingsColumns: [],
  datasetCreating: false,
  
  partitionColumn: '',
  partitionType: 'monthly',
  refreshWindowDays: 7,
  detectModified: false,
  modifiedColumn: '',
  weeklyFullRefresh: false,
  engineType: 'MergeTree',
  customWhere: '',
  deleteDays: 1,
  
  rlsStoreColumn: '',
  rlsRegionColumn: '',
  rlsGroupColumn: '',
  
  uniqueColumn: '',
  autoDetectedUnique: null,
  
  sqlQuery: 'SELECT * FROM stores LIMIT 10',
  sqlConnectionId: '',
  sqlResult: null,
  sqlLoading: false,
  sqlError: null,
  
  tables: [],
  expandedTable: null,
  tableColumns: {},
  
  systemHealth: null,
  systemHealthLoading: false,
  systemActionLoading: null,
  systemAutoRefresh: true,
  
  performanceData: { postgres: null, clickhouse: null, etl: null, connections: {} },
  performanceLoading: null,
  performanceActionLoading: null,
  
  etlMonitoring: { locks: [], stuckJobs: [], runningJobs: [] },
  
  // Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  setConnections: (connections) => set({ connections }),
  setDatasets: (datasets) => set({ datasets }),
  setETLJobs: (etlJobs) => set({ etlJobs }),
  setSchedules: (schedules) => set({ schedules }),
  
  setClickhouseTables: (clickhouseTables) => set({ clickhouseTables }),
  setClickhouseLoading: (clickhouseLoading) => set({ clickhouseLoading }),
  setSelectedChTable: (selectedChTable) => set({ selectedChTable }),
  setShowChTableModal: (showChTableModal) => set({ showChTableModal }),
  
  setShowDataManagementModal: (showDataManagementModal) => set({ showDataManagementModal }),
  setDataManagementTable: (dataManagementTable) => set({ dataManagementTable }),
  setDataManagementDatasetId: (dataManagementDatasetId) => set({ dataManagementDatasetId }),
  setDataManagementColumns: (dataManagementColumns) => set({ dataManagementColumns }),
  setDataManagementLoading: (dataManagementLoading) => set({ dataManagementLoading }),
  setDataManagementPreview: (dataManagementPreview) => set({ dataManagementPreview }),
  setDmDateColumn: (dmDateColumn) => set({ dmDateColumn }),
  setDmDeleteMode: (dmDeleteMode) => set({ dmDeleteMode }),
  setDmDays: (dmDays) => set({ dmDays }),
  setDmStartDate: (dmStartDate) => set({ dmStartDate }),
  setDmEndDate: (dmEndDate) => set({ dmEndDate }),
  setDmActiveTab: (dmActiveTab) => set({ dmActiveTab }),
  
  setComparisonData: (comparisonData) => set({ comparisonData }),
  setMissingRanges: (missingRanges) => set({ missingRanges }),
  setDuplicateAnalysis: (duplicateAnalysis) => set({ duplicateAnalysis }),
  setValidationLoading: (validationLoading) => set({ validationLoading }),
  setPkColumn: (pkColumn) => set({ pkColumn }),
  
  setError: (error) => set({ error }),
  
  setWorkerStatus: (workerStatus) => set({ workerStatus }),
  setTriggeringAll: (triggeringAll) => set({ triggeringAll }),
  
  setShowConnectionModal: (showConnectionModal) => set({ showConnectionModal }),
  setShowDatasetModal: (showDatasetModal) => set({ showDatasetModal }),
  setSelectedConnection: (selectedConnection) => set({ selectedConnection }),
  setEditingConnection: (editingConnection) => set({ editingConnection }),
  
  setShowPreviewModal: (showPreviewModal) => set({ showPreviewModal }),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
  setSelectedDataset: (selectedDataset) => set({ selectedDataset }),
  setPreviewData: (previewData) => set({ previewData }),
  setPreviewLoading: (previewLoading) => set({ previewLoading }),
  
  setShowApiPreviewModal: (showApiPreviewModal) => set({ showApiPreviewModal }),
  setApiPreviewConnection: (apiPreviewConnection) => set({ apiPreviewConnection }),
  setApiEndpoint: (apiEndpoint) => set({ apiEndpoint }),
  setApiMethod: (apiMethod) => set({ apiMethod }),
  setApiQueryParams: (apiQueryParams) => set({ apiQueryParams }),
  setApiResponsePath: (apiResponsePath) => set({ apiResponsePath }),
  setApiBody: (apiBody) => set({ apiBody }),
  setApiPreviewLoading: (apiPreviewLoading) => set({ apiPreviewLoading }),
  setApiPreviewResult: (apiPreviewResult) => set({ apiPreviewResult }),
  setApiPreviewError: (apiPreviewError) => set({ apiPreviewError }),
  setShowApiDatasetForm: (showApiDatasetForm) => set({ showApiDatasetForm }),
  setApiDatasetName: (apiDatasetName) => set({ apiDatasetName }),
  setApiSelectedColumns: (apiSelectedColumns) => set({ apiSelectedColumns }),
  setApiDatasetSaving: (apiDatasetSaving) => set({ apiDatasetSaving }),
  setApiSyncSchedule: (apiSyncSchedule) => set({ apiSyncSchedule }),
  setApiRowLimit: (apiRowLimit) => set({ apiRowLimit }),
  
  setNewDatasetName: (newDatasetName) => set({ newDatasetName }),
  setNewDatasetDescription: (newDatasetDescription) => set({ newDatasetDescription }),
  setNewDatasetSyncStrategy: (newDatasetSyncStrategy) => set({ newDatasetSyncStrategy }),
  setNewDatasetSyncSchedule: (newDatasetSyncSchedule) => set({ newDatasetSyncSchedule }),
  setScheduledHour: (scheduledHour) => set({ scheduledHour }),
  setNewDatasetReferenceColumn: (newDatasetReferenceColumn) => set({ newDatasetReferenceColumn }),
  setNewDatasetRowLimit: (newDatasetRowLimit) => set({ newDatasetRowLimit }),
  setSettingsColumns: (settingsColumns) => set({ settingsColumns }),
  setDatasetCreating: (datasetCreating) => set({ datasetCreating }),
  
  setPartitionColumn: (partitionColumn) => set({ partitionColumn }),
  setPartitionType: (partitionType) => set({ partitionType }),
  setRefreshWindowDays: (refreshWindowDays) => set({ refreshWindowDays }),
  setDetectModified: (detectModified) => set({ detectModified }),
  setModifiedColumn: (modifiedColumn) => set({ modifiedColumn }),
  setWeeklyFullRefresh: (weeklyFullRefresh) => set({ weeklyFullRefresh }),
  setEngineType: (engineType) => set({ engineType }),
  setCustomWhere: (customWhere) => set({ customWhere }),
  setDeleteDays: (deleteDays) => set({ deleteDays }),
  
  setRlsStoreColumn: (rlsStoreColumn) => set({ rlsStoreColumn }),
  setRlsRegionColumn: (rlsRegionColumn) => set({ rlsRegionColumn }),
  setRlsGroupColumn: (rlsGroupColumn) => set({ rlsGroupColumn }),
  
  setUniqueColumn: (uniqueColumn) => set({ uniqueColumn }),
  setAutoDetectedUnique: (autoDetectedUnique) => set({ autoDetectedUnique }),
  
  setSqlQuery: (sqlQuery) => set({ sqlQuery }),
  setSqlConnectionId: (sqlConnectionId) => set({ sqlConnectionId }),
  setSqlResult: (sqlResult) => set({ sqlResult }),
  setSqlLoading: (sqlLoading) => set({ sqlLoading }),
  setSqlError: (sqlError) => set({ sqlError }),
  
  setTables: (tables) => set({ tables }),
  setExpandedTable: (expandedTable) => set({ expandedTable }),
  setTableColumns: (tableColumns) => set({ tableColumns }),
  
  setSystemHealth: (systemHealth) => set({ systemHealth }),
  setSystemHealthLoading: (systemHealthLoading) => set({ systemHealthLoading }),
  setSystemActionLoading: (systemActionLoading) => set({ systemActionLoading }),
  setSystemAutoRefresh: (systemAutoRefresh) => set({ systemAutoRefresh }),
  
  setPerformanceData: (performanceData) => set({ performanceData }),
  setPerformanceLoading: (performanceLoading) => set({ performanceLoading }),
  setPerformanceActionLoading: (performanceActionLoading) => set({ performanceActionLoading }),
  
  setEtlMonitoring: (etlMonitoring) => set({ etlMonitoring }),
  
  // Reset helpers
  resetDatasetForm: () => set({
    newDatasetName: '',
    newDatasetDescription: '',
    newDatasetSyncStrategy: 'full_refresh',
    newDatasetSyncSchedule: 'manual',
    scheduledHour: 2,
    newDatasetReferenceColumn: '',
    newDatasetRowLimit: null,
    partitionColumn: '',
    partitionType: 'monthly',
    refreshWindowDays: 7,
    detectModified: false,
    modifiedColumn: '',
    weeklyFullRefresh: false,
    engineType: 'MergeTree',
    customWhere: '',
    deleteDays: 1,
    rlsStoreColumn: '',
    rlsRegionColumn: '',
    rlsGroupColumn: '',
    uniqueColumn: '',
    autoDetectedUnique: null,
  }),
  
  resetApiPreview: () => set({
    apiEndpoint: '',
    apiMethod: 'GET',
    apiQueryParams: '',
    apiResponsePath: '',
    apiBody: '',
    apiPreviewResult: null,
    apiPreviewError: null,
    showApiDatasetForm: false,
    apiDatasetName: '',
    apiSelectedColumns: [],
    apiSyncSchedule: 'manual',
    apiRowLimit: 10000,
  }),
}))

// ============================================
// HELPER FUNCTIONS (Export edilecek)
// ============================================

export function isJobStuck(job: ETLJob): boolean {
  if (job.status !== 'running') return false
  if (!job.started_at) return false
  
  const startTime = new Date(job.started_at).getTime()
  const now = Date.now()
  const runningMinutes = (now - startTime) / 1000 / 60
  
  if (runningMinutes > 5 && (!job.rows_processed || job.rows_processed === 0)) {
    return true
  }
  
  return false
}

export function cronToShortCode(cron: string): string {
  const cronMap: Record<string, string> = {
    '* * * * *': '1m',
    '*/5 * * * *': '5m',
    '*/15 * * * *': '15m',
    '*/30 * * * *': '30m',
    '0 * * * *': '1h',
    '0 3 * * *': 'daily',
  }
  if (['1m', '5m', '15m', '30m', '1h', 'daily', 'manual'].includes(cron)) {
    return cron
  }
  return cronMap[cron] || '1h'
}

// Type mapping helpers
export const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // INTEGER TYPES
  'int': 'Int32', 'int4': 'Int32', 'integer': 'Int32',
  'int2': 'Int16', 'smallint': 'Int16',
  'int8': 'Int64', 'bigint': 'Int64',
  'serial': 'Int32', 'bigserial': 'Int64', 'smallserial': 'Int16',
  'oid': 'UInt32',
  'tinyint': 'Int8', 'mediumint': 'Int32', 'year': 'Int16',
  'number': 'Float64', 'pls_integer': 'Int32', 'binary_integer': 'Int32',
  
  // FLOAT TYPES
  'float': 'Float64', 'float4': 'Float32', 'float8': 'Float64',
  'real': 'Float32', 'double': 'Float64', 'double precision': 'Float64',
  'decimal': 'Float64', 'numeric': 'Float64', 'money': 'Float64',
  'newdecimal': 'Float64',
  'smallmoney': 'Float64',
  'binary_float': 'Float32', 'binary_double': 'Float64',
  
  // STRING TYPES
  'text': 'String', 'varchar': 'String', 'char': 'String',
  'character varying': 'String', 'character': 'String', 'bpchar': 'String',
  'name': 'String', 'uuid': 'String', 'json': 'String', 'jsonb': 'String',
  'xml': 'String', 'citext': 'String', 'inet': 'String', 'cidr': 'String', 'macaddr': 'String',
  'tinytext': 'String', 'mediumtext': 'String', 'longtext': 'String',
  'enum': 'String', 'set': 'String',
  'nvarchar': 'String', 'nchar': 'String', 'ntext': 'String',
  'uniqueidentifier': 'String', 'sql_variant': 'String', 'sysname': 'String',
  'varchar2': 'String', 'nvarchar2': 'String', 'clob': 'String', 'nclob': 'String',
  'long': 'String', 'rowid': 'String',
  
  // DATE/TIME TYPES
  'date': 'Date', 'time': 'String', 'timetz': 'String', 'interval': 'String',
  'timestamp': 'DateTime', 'timestamptz': 'DateTime',
  'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
  'datetime': 'DateTime', 'newdate': 'Date',
  'datetime2': 'DateTime', 'smalldatetime': 'DateTime', 'datetimeoffset': 'DateTime',
  'timestamp with local time zone': 'DateTime',
  
  // BOOLEAN TYPES
  'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  
  // BINARY TYPES
  'bytea': 'String',
  'blob': 'String', 'tinyblob': 'String', 'mediumblob': 'String', 'longblob': 'String',
  'binary': 'String', 'varbinary': 'String',
  'image': 'String',
  'raw': 'String', 'long raw': 'String', 'bfile': 'String',
  
  // GEOMETRY TYPES
  'geometry': 'String', 'geography': 'String', 'point': 'String',
  'linestring': 'String', 'polygon': 'String',
}

export function sqlToClickHouseType(sqlType: string): string {
  if (!sqlType) return 'String'
  const normalized = sqlType.toLowerCase().trim()
  const baseType = normalized.replace(/\(.*\)/, '').trim()
  return SQL_TO_CLICKHOUSE_TYPE[baseType] || SQL_TO_CLICKHOUSE_TYPE[normalized] || 'String'
}

export function getTypeCompatibilityInfo(sourceType: string): { 
  chType: string
  compatible: boolean
  suggestion: string | null
  isDateType: boolean
} {
  const chType = sqlToClickHouseType(sourceType)
  const normalizedSource = (sourceType || '').toLowerCase()
  
  const isDateType = ['date', 'datetime', 'datetime2', 'timestamp', 'smalldatetime', 'time'].some(t => normalizedSource.includes(t))
  
  if (!sourceType) {
    return { 
      chType: 'String', 
      compatible: true, 
      suggestion: 'Tip bilgisi yok, String olarak alınacak.',
      isDateType: false
    }
  }
  
  if (isDateType) {
    return {
      chType,
      compatible: true,
      suggestion: 'Tarih kolonları MSSQL\'den farklı formatta gelebilir. Sorun olursa CONVERT(VARCHAR, kolon, 120) kullanın.',
      isDateType: true
    }
  }
  
  return { chType, compatible: true, suggestion: null, isDateType: false }
}

export function getTypeColor(compatible: boolean, isDark: boolean): string {
  if (compatible) {
    return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
  }
  return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300'
}
