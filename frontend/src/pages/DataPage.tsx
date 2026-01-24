import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useTheme } from '../components/Layout'
import { 
  Database, 
  Plus, 
  Link2, 
  FileSpreadsheet, 
  Globe, 
  Server,
  RefreshCw,
  Play,
  Settings,
  Clock,
  AlertCircle,
  CheckCircle,
  Table,
  ArrowRight,
  Trash2,
  Zap,
  HardDrive,
  X,
  ChevronRight,
  ChevronDown,
  Code,
  Copy,
  Download,
  Eye,
  Save,
  Loader2,
  Terminal,
  Columns,
  Calendar,
  Hash,
  Info,
  Activity,
  RotateCcw,
  Gauge,
  XCircle,
  Edit2,
  Lock,
  TrendingUp,
  AlertTriangle,
  Wrench,
  Search,
  Square
} from 'lucide-react'
// Play ve Zap zaten import edilmiş
import clsx from 'clsx'
import { useAuthStore } from '../stores/authStore'
import { DatasetModal, ConnectionsTab, SqlEditorTab, DatasetsTab, ETLHistoryTab, ClickHouseTab, SystemHealthTab, PerformanceTab, PreviewModal, SettingsModal, ApiPreviewModal, ConnectionModal } from '../components/data'

// API Base URL
const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ============================================
// TYPES
// ============================================

interface Connection {
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
  // API bağlantıları için
  api_auth_config?: {
    auth_type: 'none' | 'api_key' | 'bearer' | 'basic'
    api_key?: string
    bearer_token?: string
    basic_username?: string
    basic_password?: string
  }
}

interface TableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  clickhouseType?: string
}

interface Dataset {
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
  delete_days?: number | null  // Tarih Bazlı Sil-Yaz için
  status: string
  status_message?: string
  last_sync_at?: string
  last_sync_rows?: number
  total_rows?: number
  connection_name?: string
  connection_type?: string
  description?: string
  // RLS (Row-Level Security) kolonları
  store_column?: string | null   // Mağaza filtre kolonu
  region_column?: string | null  // Bölge filtre kolonu
  group_column?: string | null   // Grup filtre kolonu
  // Partition kolonu
  partition_column?: string | null
}

interface ETLJob {
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
  last_progress_at?: string // Progress güncellendiğinde set edilir
}

// Stuck job tespiti: 5 dakikadan fazla ilerleme yok
function isJobStuck(job: ETLJob): boolean {
  if (job.status !== 'running') return false
  if (!job.started_at) return false
  
  const startTime = new Date(job.started_at).getTime()
  const now = Date.now()
  const runningMinutes = (now - startTime) / 1000 / 60
  
  // 5 dakikadan fazla çalışıyor ve 0 satır işlenmiş = stuck
  // (İlk 5 dakika veri kaynaktan çekiliyor olabilir, bu normal)
  if (runningMinutes > 5 && (!job.rows_processed || job.rows_processed === 0)) {
    return true
  }
  
  return false
}

interface Schedule {
  id: string
  dataset_id: string
  dataset_name?: string
  cron_expression: string
  is_active: boolean
  next_run_at?: string
  last_run_at?: string
}

interface ETLWorkerStatus {
  status: 'running' | 'stopped' | 'unknown'
  lastHeartbeat: string | null
  activeJobs: number
  workerInfo: {
    startedAt: string
    pid: number
    uptime: number
  } | null
}

interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  rowCount: number
  executionTime: number
}

// Cron expression'ı kısa kod formatına çevir
function cronToShortCode(cron: string): string {
  const cronMap: Record<string, string> = {
    '* * * * *': '1m',
    '*/5 * * * *': '5m',
    '*/15 * * * *': '15m',
    '*/30 * * * *': '30m',
    '0 * * * *': '1h',
    '0 3 * * *': 'daily',
  }
  // Zaten kısa kod formatındaysa aynen dön
  if (['1m', '5m', '15m', '30m', '1h', 'daily', 'manual'].includes(cron)) {
    return cron
  }
  return cronMap[cron] || '1h'
}

// ============================================
// TİP UYUMLULUK KONTROLÜ
// ============================================

const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // ============ INTEGER TYPES ============
  // PostgreSQL
  'int': 'Int32', 'int4': 'Int32', 'integer': 'Int32',
  'int2': 'Int16', 'smallint': 'Int16',
  'int8': 'Int64', 'bigint': 'Int64',
  'serial': 'Int32', 'bigserial': 'Int64', 'smallserial': 'Int16',
  'oid': 'UInt32',
  // MySQL
  'tinyint': 'Int8', 'mediumint': 'Int32', 'year': 'Int16',
  // Oracle
  'number': 'Float64', 'pls_integer': 'Int32', 'binary_integer': 'Int32',
  
  // ============ FLOAT TYPES ============
  // PostgreSQL
  'float': 'Float64', 'float4': 'Float32', 'float8': 'Float64',
  'real': 'Float32', 'double': 'Float64', 'double precision': 'Float64',
  'decimal': 'Float64', 'numeric': 'Float64', 'money': 'Float64',
  // MySQL
  'newdecimal': 'Float64',  // MySQL decimal (internal type 246)
  // MSSQL
  'smallmoney': 'Float64',
  // Oracle
  'binary_float': 'Float32', 'binary_double': 'Float64',
  
  // ============ STRING TYPES ============
  // PostgreSQL
  'text': 'String', 'varchar': 'String', 'char': 'String',
  'character varying': 'String', 'character': 'String', 'bpchar': 'String',
  'name': 'String', 'uuid': 'String', 'json': 'String', 'jsonb': 'String',
  'xml': 'String', 'citext': 'String', 'inet': 'String', 'cidr': 'String', 'macaddr': 'String',
  // MySQL
  'tinytext': 'String', 'mediumtext': 'String', 'longtext': 'String',
  'enum': 'String', 'set': 'String',
  // MSSQL
  'nvarchar': 'String', 'nchar': 'String', 'ntext': 'String',
  'uniqueidentifier': 'String', 'sql_variant': 'String', 'sysname': 'String',
  // Oracle
  'varchar2': 'String', 'nvarchar2': 'String', 'clob': 'String', 'nclob': 'String',
  'long': 'String', 'rowid': 'String',
  
  // ============ DATE/TIME TYPES ============
  // PostgreSQL
  'date': 'Date', 'time': 'String', 'timetz': 'String', 'interval': 'String',
  'timestamp': 'DateTime', 'timestamptz': 'DateTime',
  'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
  // MySQL
  'datetime': 'DateTime', 'newdate': 'Date',
  // MSSQL
  'datetime2': 'DateTime', 'smalldatetime': 'DateTime', 'datetimeoffset': 'DateTime',
  // Oracle
  'timestamp with local time zone': 'DateTime',
  
  // ============ BOOLEAN TYPES ============
  'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  
  // ============ BINARY TYPES ============
  // PostgreSQL
  'bytea': 'String',
  // MySQL
  'blob': 'String', 'tinyblob': 'String', 'mediumblob': 'String', 'longblob': 'String',
  'binary': 'String', 'varbinary': 'String',
  // MSSQL
  'image': 'String',
  // Oracle
  'raw': 'String', 'long raw': 'String', 'bfile': 'String',
  
  // ============ GEOMETRY TYPES ============
  'geometry': 'String', 'geography': 'String', 'point': 'String',
  'linestring': 'String', 'polygon': 'String',
}

function sqlToClickHouseType(sqlType: string): string {
  if (!sqlType) return 'String'
  const normalized = sqlType.toLowerCase().trim()
  const baseType = normalized.replace(/\(.*\)/, '').trim()
  return SQL_TO_CLICKHOUSE_TYPE[baseType] || SQL_TO_CLICKHOUSE_TYPE[normalized] || 'String'
}

function getTypeCompatibilityInfo(sourceType: string): { 
  chType: string
  compatible: boolean
  suggestion: string | null
  isDateType: boolean
} {
  const chType = sqlToClickHouseType(sourceType)
  const normalizedSource = (sourceType || '').toLowerCase()
  
  // Date/DateTime tipi kontrolü
  const isDateType = ['date', 'datetime', 'datetime2', 'timestamp', 'smalldatetime', 'time'].some(t => normalizedSource.includes(t))
  
  // Uyumluluk ve öneri
  if (!sourceType) {
    return { 
      chType: 'String', 
      compatible: false, 
      suggestion: 'Kaynak tipi bilinmiyor. Varsayılan String kullanılacak.',
      isDateType: false
    }
  }
  
  // Date tipi için özel uyarı
  if (isDateType) {
    return {
      chType,
      compatible: true,
      suggestion: `⏰ Tarih kolonları MSSQL'den farklı formatta gelebilir. Sorun olursa CONVERT(VARCHAR, kolon, 120) kullanın.`,
      isDateType: true
    }
  }
  
  return { chType, compatible: true, suggestion: null, isDateType: false }
}

function getTypeColor(compatible: boolean, isDark: boolean): string {
  if (compatible) {
    return isDark ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-100 text-emerald-700 border-emerald-300'
  }
  return isDark ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-red-100 text-red-700 border-red-300'
}

// ============================================
// COMPONENT
// ============================================

export default function DataPage() {
  const { theme, isDark } = useTheme()
  const { accessToken, logout } = useAuthStore()
  
  // State
  const [activeTab, setActiveTab] = useState<'connections' | 'datasets' | 'etl' | 'sql' | 'clickhouse' | 'system' | 'performance'>('connections')
  const [connections, setConnections] = useState<Connection[]>([])
  const [datasets, setDatasets] = useState<Dataset[]>([])
  
  // Clixer Tablo Yönetimi
  const [clickhouseTables, setClickhouseTables] = useState<any[]>([])
  const [clickhouseLoading, setClickhouseLoading] = useState(false)
  const [selectedChTable, setSelectedChTable] = useState<any>(null)
  const [showChTableModal, setShowChTableModal] = useState(false)
  
  // ClickHouse Veri Yönetimi (Tarih bazlı silme)
  const [showDataManagementModal, setShowDataManagementModal] = useState(false)
  const [dataManagementTable, setDataManagementTable] = useState<string>('')
  const [dataManagementDatasetId, setDataManagementDatasetId] = useState<string>('')
  const [dataManagementColumns, setDataManagementColumns] = useState<any[]>([])
  const [dataManagementLoading, setDataManagementLoading] = useState(false)
  const [dataManagementPreview, setDataManagementPreview] = useState<any>(null)
  const [dmDateColumn, setDmDateColumn] = useState('')
  const [dmDeleteMode, setDmDeleteMode] = useState<'days' | 'range'>('days')
  const [dmDays, setDmDays] = useState(7)
  const [dmStartDate, setDmStartDate] = useState('')
  const [dmEndDate, setDmEndDate] = useState('')
  const [dmActiveTab, setDmActiveTab] = useState<'delete' | 'validate'>('delete')
  
  // Veri Doğrulama State'leri
  const [comparisonData, setComparisonData] = useState<any>(null)
  const [missingRanges, setMissingRanges] = useState<any>(null)
  const [duplicateAnalysis, setDuplicateAnalysis] = useState<any>(null)
  const [validationLoading, setValidationLoading] = useState(false)
  const [pkColumn, setPkColumn] = useState<string>('id') // Primary Key kolonu - kullanıcı seçer
  const [etlJobs, setETLJobs] = useState<ETLJob[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [error, setError] = useState<string | null>(null)
  
  // ETL Worker Status
  const [workerStatus, setWorkerStatus] = useState<ETLWorkerStatus | null>(null)
  const [triggeringAll, setTriggeringAll] = useState(false)

  // Modals
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [showDatasetModal, setShowDatasetModal] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null)
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null)
  
  // Dataset Preview & Settings
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null)
  const [previewData, setPreviewData] = useState<{ columns: { name: string; type?: string }[], rows: Record<string, any>[], totalRows?: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  
  // API Preview State (Dinamo'dan)
  const [showApiPreviewModal, setShowApiPreviewModal] = useState(false)
  const [apiPreviewConnection, setApiPreviewConnection] = useState<any>(null)
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiMethod, setApiMethod] = useState('GET')
  const [apiQueryParams, setApiQueryParams] = useState('')
  const [apiResponsePath, setApiResponsePath] = useState('')
  const [apiBody, setApiBody] = useState('') // POST/PUT için body
  const [apiPreviewLoading, setApiPreviewLoading] = useState(false)
  const [apiPreviewResult, setApiPreviewResult] = useState<any>(null)
  const [apiPreviewError, setApiPreviewError] = useState<string | null>(null)
  const [showApiDatasetForm, setShowApiDatasetForm] = useState(false)
  const [apiDatasetName, setApiDatasetName] = useState('')
  const [apiSelectedColumns, setApiSelectedColumns] = useState<string[]>([])
  const [apiDatasetSaving, setApiDatasetSaving] = useState(false)
  const [apiSyncSchedule, setApiSyncSchedule] = useState('manual')
  const [apiRowLimit, setApiRowLimit] = useState(10000)
  
  // Dataset creation state
  const [newDatasetName, setNewDatasetName] = useState('')
  const [newDatasetDescription, setNewDatasetDescription] = useState('')
  const [newDatasetSyncStrategy, setNewDatasetSyncStrategy] = useState('full_refresh')
  const [newDatasetSyncSchedule, setNewDatasetSyncSchedule] = useState('manual')
  const [scheduledHour, setScheduledHour] = useState(2) // Günlük/Haftalık için saat (varsayılan: 02:00)
  const [newDatasetReferenceColumn, setNewDatasetReferenceColumn] = useState('')
  const [newDatasetRowLimit, setNewDatasetRowLimit] = useState<number | null>(null) // null = sınırsız
  const [settingsColumns, setSettingsColumns] = useState<string[]>([])
  const [datasetCreating, setDatasetCreating] = useState(false)
  
  // Partition & Refresh Settings (Power BI benzeri)
  const [partitionColumn, setPartitionColumn] = useState('')
  const [partitionType, setPartitionType] = useState<'monthly' | 'daily'>('monthly')
  const [refreshWindowDays, setRefreshWindowDays] = useState(7)
  const [detectModified, setDetectModified] = useState(false)
  const [modifiedColumn, setModifiedColumn] = useState('')
  const [weeklyFullRefresh, setWeeklyFullRefresh] = useState(false)
  const [engineType, setEngineType] = useState<'MergeTree' | 'ReplacingMergeTree'>('MergeTree')
  const [customWhere, setCustomWhere] = useState('')  // Full Refresh için WHERE koşulu
  const [deleteDays, setDeleteDays] = useState(1)  // Tarih Bazlı Sil-Yaz: Son X gün
  
  // RLS (Row-Level Security) kolonları
  const [rlsStoreColumn, setRlsStoreColumn] = useState('')   // Mağaza filtre kolonu
  const [rlsRegionColumn, setRlsRegionColumn] = useState('')  // Bölge filtre kolonu
  const [rlsGroupColumn, setRlsGroupColumn] = useState('')    // Grup filtre kolonu (franchise/merkez)
  
  // Unique Kolon (ORDER BY için zorunlu!)
  const [uniqueColumn, setUniqueColumn] = useState('')        // ClickHouse ORDER BY kolonu
  const [autoDetectedUnique, setAutoDetectedUnique] = useState<string | null>(null)  // Otomatik algılanan

  // SQL Editor state
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM stores LIMIT 10')
  const [sqlConnectionId, setSqlConnectionId] = useState<string>('')
  const [sqlResult, setSqlResult] = useState<QueryResult | null>(null)
  const [sqlLoading, setSqlLoading] = useState(false)
  const [sqlError, setSqlError] = useState<string | null>(null)

  // Tables explorer
  const [tables, setTables] = useState<TableInfo[]>([])
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [tableColumns, setTableColumns] = useState<Record<string, ColumnInfo[]>>({})

  // Sistem Sağlığı state
  const [systemHealth, setSystemHealth] = useState<any>(null)
  const [systemHealthLoading, setSystemHealthLoading] = useState(false)
  const [systemActionLoading, setSystemActionLoading] = useState<string | null>(null)
  const [systemAutoRefresh, setSystemAutoRefresh] = useState(true)
  
  // Performans Danışmanı state
  const [performanceData, setPerformanceData] = useState<{
    postgres: any | null
    clickhouse: any | null
    etl: any | null
    connections: Record<string, any>
  }>({ postgres: null, clickhouse: null, etl: null, connections: {} })
  const [performanceLoading, setPerformanceLoading] = useState<string | null>(null)
  const [performanceActionLoading, setPerformanceActionLoading] = useState<string | null>(null)
  
  // ETL Monitoring state (Lock'lar, Stuck Jobs, Running Jobs)
  const [etlMonitoring, setEtlMonitoring] = useState<{
    locks: { key: string; datasetId: string; pid: number; startedAt: string; ttlSeconds: number }[];
    stuckJobs: { id: string; dataset_name: string; runningMinutes: number; rows_processed: number }[];
    runningJobs: { id: string; dataset_name: string; runningMinutes: number; rows_processed: number; status: string }[];
  }>({ locks: [], stuckJobs: [], runningJobs: [] })

  // ============================================
  // API CALLS
  // ============================================

  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    // Token henüz yüklenmemiş olabilir, bekle
    if (!accessToken) {
      throw new Error('Token yükleniyor...')
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    })
    
    // 401 Unauthorized - Token geçersiz veya süresi dolmuş
    if (response.status === 401) {
      logout()
      window.location.href = '/login'
      throw new Error('Oturum süresi doldu, lütfen tekrar giriş yapın')
    }
    
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'API hatası')
    return data
  }

  // Load connections
  const loadConnections = async () => {
    try {
      const result = await apiCall('/data/connections')
      setConnections(result.data || [])
      if (result.data?.length > 0 && !sqlConnectionId) {
        setSqlConnectionId(result.data[0].id)
      }
    } catch (err: any) {
      console.error('Load connections error:', err)
      setError(err.message)
    }
  }

  // Edit connection - bağlantıyı düzenleme modunda aç
  const editConnection = (conn: Connection) => {
    setEditingConnection(conn)
    setShowConnectionModal(true)
  }

  // Load datasets
  const loadDatasets = async () => {
    try {
      const result = await apiCall('/data/datasets')
      setDatasets(result.data || [])
    } catch (err: any) {
      console.error('Load datasets error:', err)
      setError(err.message)
    }
  }

  // Load ETL jobs
  const loadETLJobs = async () => {
    try {
      const result = await apiCall('/data/etl-jobs?limit=20')
      setETLJobs(result.data || [])
    } catch (err: any) {
      console.error('Load ETL jobs error:', err)
      setError(err.message)
    }
  }

  // Load schedules
  const loadSchedules = async () => {
    try {
      const result = await apiCall('/data/schedules')
      setSchedules(result.data || [])
    } catch (err: any) {
      console.error('Load schedules error:', err)
    }
  }

  // Load ETL Worker status
  const loadWorkerStatus = async () => {
    try {
      const result = await apiCall('/data/etl/status')
      setWorkerStatus(result.data || null)
    } catch (err: any) {
      console.error('Load worker status error:', err)
      setWorkerStatus({ status: 'unknown', lastHeartbeat: null, activeJobs: 0, workerInfo: null })
    }
  }

  // Load System Health
  const loadSystemHealth = async (showLoading = false) => {
    if (showLoading) setSystemHealthLoading(true)
    try {
      const result = await apiCall('/admin/health')
      setSystemHealth(result.data || null)
      
      // ETL Monitoring verilerini de yükle
      await loadEtlMonitoring()
    } catch (err: any) {
      console.error('Load system health error:', err)
      setSystemHealth(null)
    } finally {
      setSystemHealthLoading(false)
    }
  }

  // Load ETL Monitoring (Locks, Stuck Jobs, Running Jobs)
  const loadEtlMonitoring = async () => {
    try {
      const [locksRes, stuckRes, runningRes] = await Promise.all([
        apiCall('/data/system/locks').catch(() => ({ data: [] })),
        apiCall('/data/system/stuck-jobs').catch(() => ({ data: [] })),
        apiCall('/data/system/running-jobs').catch(() => ({ data: [] }))
      ])
      
      setEtlMonitoring({
        locks: locksRes.data || [],
        stuckJobs: stuckRes.data || [],
        runningJobs: runningRes.data || []
      })
    } catch (err: any) {
      console.error('Load ETL monitoring error:', err)
    }
  }
  
  // Delete specific lock
  const deleteLock = async (datasetId: string) => {
    if (!confirm('Bu lock silinecek. Devam etmek istiyor musunuz?')) return
    setSystemActionLoading(`lock-${datasetId}`)
    try {
      await apiCall(`/data/system/locks/${datasetId}`, { method: 'DELETE' })
      await loadEtlMonitoring()
    } catch (err: any) {
      toast.error('Lock silinemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }
  
  // Delete all locks
  const deleteAllLocks = async () => {
    if (!confirm('TÜM lock\'lar silinecek. Bu işlem tehlikeli olabilir. Devam etmek istiyor musunuz?')) return
    setSystemActionLoading('all-locks')
    try {
      await apiCall('/data/system/locks', { method: 'DELETE' })
      await loadEtlMonitoring()
    } catch (err: any) {
      toast.error('Lock\'lar silinemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }
  
  // Cancel specific job
  const cancelJob = async (jobId: string) => {
    if (!confirm('Bu job iptal edilecek. Devam etmek istiyor musunuz?')) return
    setSystemActionLoading(`job-${jobId}`)
    try {
      await apiCall(`/data/system/jobs/${jobId}/cancel`, { method: 'POST' })
      await loadEtlMonitoring()
      await loadETLJobs()
    } catch (err: any) {
      toast.error('Job iptal edilemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // ============================================
  // PERFORMANS DANIŞMANI FONKSİYONLARI
  // ============================================

  // Load PostgreSQL Performance
  const loadPostgresPerformance = async () => {
    setPerformanceLoading('postgres')
    try {
      const result = await apiCall('/data/performance/postgres')
      setPerformanceData(prev => ({ ...prev, postgres: result.data }))
    } catch (err: any) {
      console.error('PostgreSQL performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }

  // Load ClickHouse Performance
  const loadClickhousePerformance = async () => {
    setPerformanceLoading('clickhouse')
    try {
      const result = await apiCall('/data/performance/clickhouse')
      setPerformanceData(prev => ({ ...prev, clickhouse: result.data }))
    } catch (err: any) {
      console.error('ClickHouse performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }

  // Load ETL Performance
  const loadEtlPerformance = async () => {
    setPerformanceLoading('etl')
    try {
      const result = await apiCall('/data/performance/etl')
      setPerformanceData(prev => ({ ...prev, etl: result.data }))
    } catch (err: any) {
      console.error('ETL performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }

  // Load Connection Performance
  const loadConnectionPerformance = async (connectionId: string) => {
    setPerformanceLoading(`connection-${connectionId}`)
    try {
      const result = await apiCall(`/data/performance/connections/${connectionId}`)
      setPerformanceData(prev => ({
        ...prev,
        connections: { ...prev.connections, [connectionId]: result.data }
      }))
    } catch (err: any) {
      console.error('Connection performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }

  // Load All Performance Data
  const loadAllPerformance = async () => {
    // Tüm performans verilerini sıfırla ve yeniden yükle
    setPerformanceData({ postgres: null, clickhouse: null, etl: null, connections: {} })
    setPerformanceLoading('all')
    try {
      // Paralel yükleme - her biri kendi state'ini set eder
      const [pgResult, chResult, etlResult] = await Promise.all([
        apiCall('/data/performance/postgres').catch(() => ({ data: null })),
        apiCall('/data/performance/clickhouse').catch(() => ({ data: null })),
        apiCall('/data/performance/etl').catch(() => ({ data: null }))
      ])
      
      setPerformanceData({
        postgres: pgResult.data,
        clickhouse: chResult.data,
        etl: etlResult.data,
        connections: {}
      })
    } catch (err: any) {
      console.error('Load all performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }

  // PostgreSQL VACUUM
  const runVacuum = async (tableName: string, analyze = false) => {
    if (!confirm(`${tableName} tablosunda VACUUM ${analyze ? 'ANALYZE ' : ''}çalıştırılacak. Devam?`)) return
    setPerformanceActionLoading(`vacuum-${tableName}`)
    try {
      const result = await apiCall(`/data/performance/postgres/vacuum/${tableName}?analyze=${analyze}`, { method: 'POST' })
      toast.success(result.message)
      loadPostgresPerformance()
    } catch (err: any) {
      toast.error('VACUUM başarısız: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }

  // PostgreSQL Index Sil
  const dropIndex = async (indexName: string) => {
    if (!confirm(`"${indexName}" index'i silinecek. Bu işlem geri alınamaz. Devam?`)) return
    setPerformanceActionLoading(`drop-${indexName}`)
    try {
      const result = await apiCall(`/data/performance/postgres/index/${indexName}`, { method: 'DELETE' })
      toast.success(result.message)
      loadPostgresPerformance()
    } catch (err: any) {
      toast.error('Index silinemedi: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }

  // ClickHouse Tüm Tabloları Optimize Et
  const optimizeAllClickhouse = async () => {
    if (!confirm('Tüm Clixer tabloları optimize edilecek. Bu işlem birkaç dakika sürebilir. Devam?')) return
    setPerformanceActionLoading('optimize-all')
    try {
      const result = await apiCall('/data/performance/clickhouse/optimize-all', { method: 'POST' })
      toast.success(result.message)
      // Optimize sonrası verileri yenile
      await loadClickhousePerformance()
    } catch (err: any) {
      toast.error('Optimize başarısız: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }

  // Metni panoya kopyala
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Panoya kopyalandı!')
  }
  
  // Load ClickHouse tables
  const loadClickhouseTables = async () => {
    setClickhouseLoading(true)
    try {
      const result = await apiCall('/data/clickhouse/tables')
      setClickhouseTables(result.data || [])
    } catch (err: any) {
      console.error('Load ClickHouse tables error:', err)
    } finally {
      setClickhouseLoading(false)
    }
  }
  
  // View ClickHouse table details
  const viewChTableDetails = async (tableName: string) => {
    try {
      const result = await apiCall(`/data/clickhouse/tables/${tableName}`)
      setSelectedChTable(result.data)
      setShowChTableModal(true)
    } catch (err: any) {
      toast.error('Tablo detayları yüklenemedi: ' + err.message)
    }
  }
  
  // Truncate ClickHouse table
  const truncateChTable = async (tableName: string) => {
    if (!confirm(`"${tableName}" tablosundaki TÜM VERİLER silinecek. Devam etmek istiyor musunuz?`)) return
    setSystemActionLoading(`ch-truncate-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}/truncate`, { method: 'POST' })
      await loadClickhouseTables()
      toast.success('Tablo temizlendi')
    } catch (err: any) {
      toast.error('Tablo temizlenemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }
  
  // Optimize ClickHouse table
  const optimizeChTable = async (tableName: string) => {
    setSystemActionLoading(`ch-optimize-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}/optimize`, { method: 'POST' })
      await loadClickhouseTables()
      toast.success('Tablo optimize edildi (duplicate\'lar temizlendi)')
    } catch (err: any) {
      toast.error('Optimize edilemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }
  
  // Veri Yönetimi Modal Aç
  const openDataManagementModal = async (tableName: string, datasetId?: string) => {
    setDataManagementTable(tableName)
    setDataManagementDatasetId(datasetId || '')
    setDataManagementPreview(null)
    setDmDateColumn('')
    setDmDays(7)
    setDmStartDate('')
    setDmEndDate('')
    setDmActiveTab('delete')
    setComparisonData(null)
    setMissingRanges(null)
    setDuplicateAnalysis(null)
    setShowDataManagementModal(true)
    
    // Kolonları yükle
    try {
      const result = await apiCall(`/data/clickhouse/tables/${tableName}/columns`)
      setDataManagementColumns(result.data || [])
      // İlk tarih kolonunu otomatik seç
      const dateCol = (result.data || []).find((c: any) => c.isDateColumn)
      if (dateCol) setDmDateColumn(dateCol.name)
    } catch (err) {
      console.error('Kolonlar yüklenemedi:', err)
    }
  }
  
  // Veri Doğrulama - Kaynak vs ClickHouse Karşılaştırma
  const loadComparison = async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı. Lütfen dataset listesinden açın.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/compare?pkColumn=${pkColumn}`)
      setComparisonData(result.data)
    } catch (err: any) {
      toast.error('Karşılaştırma yapılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Eksik ID Aralıklarını Bul
  const loadMissingRanges = async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/missing-ranges?pkColumn=${pkColumn}`)
      setMissingRanges(result.data)
    } catch (err: any) {
      toast.error('Eksik aralıklar bulunamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Duplicate Analizi
  const loadDuplicateAnalysis = async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/duplicate-analysis`)
      setDuplicateAnalysis(result.data)
    } catch (err: any) {
      toast.error('Duplicate analizi yapılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Eksik Verileri Sync Et
  const syncMissingData = async () => {
    if (!dataManagementDatasetId || !missingRanges?.missing_ranges?.length) {
      toast.error('Önce eksik aralıkları bulun.')
      return
    }
    
    if (!confirm(`${missingRanges.missing_ranges.length} aralıktaki eksik veriler çekilecek. Devam?`)) return
    
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/sync-missing`, {
        method: 'POST',
        body: JSON.stringify({ ranges: missingRanges.missing_ranges, pkColumn })
      })
      toast.success('Eksik veri sync işlemi başlatıldı.')
      loadETLJobs()
    } catch (err: any) {
      toast.error('Sync başlatılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // 🚀 Sadece Yeni Kayıtları Çek (En hızlı yöntem - 100M+ tablolar için)
  const syncNewRecordsOnly = async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı.')
      return
    }
    
    const chMaxId = comparisonData?.clickhouse?.max_id || 0
    if (!confirm(`ClickHouse'daki max ID: ${chMaxId.toLocaleString('tr-TR')}\n\nBu ID'den sonraki TÜM kayıtlar kaynaktan çekilecek.\n\n100M+ tablolar için en hızlı yöntem!\n\nDevam?`)) return
    
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/sync-new-records`, {
        method: 'POST',
        body: JSON.stringify({ pkColumn })
      })
      toast.success(`Yeni kayıt sync başlatıldı! Max ID: ${result.data.clickhouse_max_id}'den sonraki kayıtlar çekilecek.`)
      loadETLJobs()
    } catch (err: any) {
      toast.error('Sync başlatılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Silinecek satır sayısını önizle
  const previewDataManagementDelete = async () => {
    if (!dmDateColumn) {
      toast.error('Lütfen tarih kolonu seçin')
      return
    }
    setDataManagementLoading(true)
    try {
      const params = new URLSearchParams({ dateColumn: dmDateColumn })
      if (dmDeleteMode === 'days') {
        params.append('days', dmDays.toString())
      } else {
        params.append('startDate', dmStartDate)
        params.append('endDate', dmEndDate)
      }
      const result = await apiCall(`/data/clickhouse/tables/${dataManagementTable}/preview-delete?${params}`)
      setDataManagementPreview(result.data)
    } catch (err: any) {
      toast.error('Önizleme hatası: ' + err.message)
    } finally {
      setDataManagementLoading(false)
    }
  }
  
  // Veriyi sil
  const executeDataManagementDelete = async () => {
    if (!dataManagementPreview || dataManagementPreview.rowsToDelete === 0) {
      toast.error('Silinecek veri yok')
      return
    }
    
    if (!confirm(`${dataManagementPreview.rowsToDelete.toLocaleString('tr-TR')} satır silinecek. Devam etmek istiyor musunuz?`)) {
      return
    }
    
    setDataManagementLoading(true)
    try {
      const body: any = { dateColumn: dmDateColumn }
      if (dmDeleteMode === 'days') {
        body.days = dmDays
      } else {
        body.startDate = dmStartDate
        body.endDate = dmEndDate
      }
      const result = await apiCall(`/data/clickhouse/tables/${dataManagementTable}/rows`, { 
        method: 'DELETE',
        body: JSON.stringify(body)
      })
      toast.success(result.data?.message || 'Silme işlemi başlatıldı')
      setShowDataManagementModal(false)
      await loadClickhouseTables()
    } catch (err: any) {
      toast.error('Silme hatası: ' + err.message)
    } finally {
      setDataManagementLoading(false)
    }
  }
  
  // Delete ClickHouse table
  const deleteChTable = async (tableName: string) => {
    if (!confirm(`"${tableName}" tablosu tamamen silinecek. Bu işlem geri alınamaz! Devam etmek istiyor musunuz?`)) return
    setSystemActionLoading(`ch-delete-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}`, { method: 'DELETE' })
      await loadClickhouseTables()
      toast.success('Tablo silindi')
    } catch (err: any) {
      toast.error('Tablo silinemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // Clear cache (Sadece KPI/Veri cache - Oturumlar korunur)
  const clearSystemCache = async () => {
    // Kullanıcıya onay sor
    if (!confirm('Veri önbelleğini temizlemek istiyor musunuz?\n\nBu işlem:\n✓ KPI ve dashboard cache\'ini temizler\n✓ Oturumunuz korunur\n✓ Veriler yeniden yüklenir')) {
      return
    }
    
    setSystemActionLoading('cache')
    try {
      const result = await apiCall('/admin/cache/clear', { method: 'POST' })
      toast.success(`${result.message || 'Önbellek temizlendi'} - Silinen: ${result.data?.deletedCount || 0}`)
      loadSystemHealth()
    } catch (err: any) {
      toast.error('Önbellek temizlenemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // Trigger ETL from system tab
  const triggerSystemETL = async () => {
    setSystemActionLoading('etl')
    try {
      const result = await apiCall('/admin/etl/trigger', { method: 'POST' })
      toast.success(result.message || 'ETL tetiklendi')
      loadSystemHealth()
      loadETLJobs()
    } catch (err: any) {
      toast.error('ETL tetiklenemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // Cancel all pending ETL jobs
  const cancelAllETLJobs = async () => {
    if (!confirm('Tüm bekleyen ve çalışan ETL job\'ları iptal etmek istediğinize emin misiniz?')) return
    
    setSystemActionLoading('cancel')
    try {
      const result = await apiCall('/admin/etl/cancel-all', { method: 'POST' })
      toast.success(result.message || 'Tüm job\'lar iptal edildi')
      loadSystemHealth()
      loadETLJobs()
    } catch (err: any) {
      toast.error('İptal işlemi başarısız: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // Trigger all datasets sync
  const triggerAllSync = async () => {
    setTriggeringAll(true)
    try {
      const result = await apiCall('/data/etl/trigger-all', { method: 'POST' })
      toast.success(result.message || 'Tüm datasetler için sync tetiklendi')
      loadETLJobs()
      loadWorkerStatus()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setTriggeringAll(false)
    }
  }

  // Update schedule interval
  const updateScheduleInterval = async (datasetId: string, interval: string) => {
    try {
      await apiCall(`/data/datasets/${datasetId}/schedule`, {
        method: 'PUT',
        body: JSON.stringify({ interval })
      })
      // Tüm ilgili verileri yenile
      loadSchedules()
      loadDatasets()
      loadETLJobs()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Toggle schedule active/inactive
  const toggleSchedule = async (scheduleId: string, isActive: boolean) => {
    try {
      await apiCall(`/data/schedules/${scheduleId}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive })
      })
      // Tüm ilgili verileri yenile
      loadSchedules()
      loadDatasets()
      loadETLJobs()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Handle create dataset from SQL query
  const handleCreateDataset = async () => {
    if (!newDatasetName || !sqlResult || !sqlConnectionId) {
      toast.error('Dataset adı ve SQL sonucu gerekli')
      return
    }
    
    // Unique Kolon Kontrolü (View'lar için opsiyonel)
    if (!uniqueColumn) {
      const confirmCreate = confirm(
        '⚠️ Unique Kolon Seçilmedi!\n\n' +
        'View veya aggregate sorgularda unique kolon olmayabilir.\n\n' +
        '• Unique kolon YOKSA: Tüm kolonlar ORDER BY olarak kullanılır\n' +
        '• Bu durumda ID-Based sync ÇALIŞMAZ\n' +
        '• Full Refresh veya Timestamp-Based sync kullanmanız önerilir\n\n' +
        'Devam etmek istiyor musunuz?'
      )
      if (!confirmCreate) {
        return
      }
    }

    setDatasetCreating(true)
    try {
      const columnMapping = sqlResult.columns.map(col => ({
        sourceName: col.name,
        targetName: col.name,
        sourceType: col.type,
        clickhouseType: col.clickhouseType,
        include: true
      }))

      // source_query LIMIT dahil kaydedilir (ilk oluşturmada 10 satır tip testi)
      // Sonra sync sırasında ETL Worker LIMIT'i kaldırarak TÜM veriyi çeker
      const result = await apiCall('/data/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name: newDatasetName,
          description: newDatasetDescription,
          connectionId: sqlConnectionId,
          sourceType: 'query',
          sourceQuery: sqlQuery,  // LIMIT dahil (ilk test için)
          columnMapping,
          syncStrategy: newDatasetSyncStrategy,
          syncSchedule: newDatasetSyncSchedule,
          scheduledHour: newDatasetSyncSchedule === 'daily' ? scheduledHour : null,
          referenceColumn: newDatasetReferenceColumn || null,
          rowLimit: newDatasetRowLimit,
          deleteDays: newDatasetSyncStrategy === 'date_delete_insert' ? deleteDays : null,  // Tarih Bazlı Sil-Yaz için
          // RLS (Row-Level Security) kolonları
          storeColumn: rlsStoreColumn || null,
          regionColumn: rlsRegionColumn || null,
          groupColumn: rlsGroupColumn || null,
          // Partition & Big Data ayarları
          partitionColumn: partitionColumn || null,
          partitionType: partitionType,
          refreshWindowDays: refreshWindowDays,
          detectModified: detectModified,
          modifiedColumn: detectModified ? modifiedColumn : null,
          weeklyFullRefresh: weeklyFullRefresh,
          engineType: engineType,
          customWhere: customWhere || null,  // Full Refresh için WHERE koşulu
          uniqueColumn: uniqueColumn  // ORDER BY için zorunlu unique kolon
        })
      })

      toast.success(`Dataset "${newDatasetName}" başarıyla oluşturuldu! Tablo: ${result.data.clickhouseTable}`)
      setShowDatasetModal(false)
      setNewDatasetName('')
      setNewDatasetDescription('')
      loadDatasets()
    } catch (err: any) {
      console.error('Create dataset error:', err)
      toast.error('Dataset oluşturulurken hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setDatasetCreating(false)
    }
  }

  // Load tables for connection
  const loadTables = async (connectionId: string) => {
    try {
      const result = await apiCall(`/data/connections/${connectionId}/tables`)
      setTables(result.data || [])
    } catch (err: any) {
      console.error('Load tables error:', err)
      setTables([])
    }
  }

  // Load columns for table
  const loadTableColumns = async (connectionId: string, tableName: string, schema: string = 'public') => {
    try {
      const result = await apiCall(`/data/connections/${connectionId}/tables/${tableName}/columns?schema=${schema}`)
      setTableColumns(prev => ({ ...prev, [tableName]: result.data?.columns || [] }))
    } catch (err: any) {
      console.error('Load columns error:', err)
      setTableColumns(prev => ({ ...prev, [tableName]: [] }))
    }
  }

  // Execute SQL query
  const executeQuery = async () => {
    if (!sqlQuery.trim() || !sqlConnectionId) return

    setSqlLoading(true)
    setSqlError(null)
    setSqlResult(null)

    try {
      const result = await apiCall(`/data/connections/${sqlConnectionId}/query`, {
        method: 'POST',
        body: JSON.stringify({ sql: sqlQuery, limit: 1000 })
      })
      setSqlResult(result.data)
      
      // Otomatik Unique Kolon Algılama
      if (result.data?.columns) {
        const columns = result.data.columns.map((c: any) => c.name.toLowerCase())
        const uniqueCandidates = ['id', 'code', 'kod', 'uuid', 'pk', 'primary_key', '_id', 'key', 'unique_id', 'magaza_kodu', 'store_code']
        const detected = uniqueCandidates.find(candidate => columns.includes(candidate))
        if (detected) {
          const originalName = result.data.columns.find((c: any) => c.name.toLowerCase() === detected)?.name || detected
          setAutoDetectedUnique(originalName)
          setUniqueColumn(originalName)
        } else {
          setAutoDetectedUnique(null)
          setUniqueColumn('')
        }
      }
    } catch (err: any) {
      setSqlError(err.message)
    } finally {
      setSqlLoading(false)
    }
  }

  // Test connection
  const testConnection = async (connectionId: string) => {
    try {
      const result = await apiCall(`/data/connections/${connectionId}/test`, { method: 'POST' })
      loadConnections()
      return result.data
    } catch (err: any) {
      throw err
    }
  }

  // ============================================
  // API PREVIEW FUNCTIONS (Dinamo'dan)
  // ============================================

  const openApiPreview = (connection: any) => {
    setApiPreviewConnection(connection)
    
    // api_config'den default değerleri al
    const config = connection.api_config 
      ? (typeof connection.api_config === 'string' ? JSON.parse(connection.api_config) : connection.api_config)
      : {}
    
    setApiEndpoint(config.defaultEndpoint || '')
    setApiMethod(config.method || 'GET')
    setApiQueryParams(config.defaultParams || '')
    setApiResponsePath(config.responsePath || '')
    setApiBody(config.body || '') // Default body
    setApiPreviewResult(null)
    setApiPreviewError(null)
    setShowApiDatasetForm(false)
    setApiDatasetName('')
    setApiSelectedColumns([])
    setShowApiPreviewModal(true)
  }

  const runApiPreview = async () => {
    if (!apiPreviewConnection) return

    setApiPreviewLoading(true)
    setApiPreviewError(null)
    setApiPreviewResult(null)
    setShowApiDatasetForm(false)

    try {
      const fullEndpoint = apiEndpoint + (apiQueryParams ? `?${apiQueryParams}` : '')
      
      const result = await apiCall('/data/api-preview', {
        method: 'POST',
        body: JSON.stringify({
          connectionId: apiPreviewConnection.id,
          endpoint: apiEndpoint,
          method: apiMethod,
          queryParams: apiQueryParams,
          responsePath: apiResponsePath,
          requestBody: apiBody, // POST/PUT için body
          limit: 20
        })
      })

      if (result.success && result.data) {
        setApiPreviewResult(result.data)
        // Tüm kolonları varsayılan olarak seç
        if (result.data.columns) {
          setApiSelectedColumns(result.data.columns.map((c: any) => c.name))
        }
      } else {
        setApiPreviewError(result.error || result.message || 'Bilinmeyen hata')
      }
    } catch (err: any) {
      setApiPreviewError(err.message)
    } finally {
      setApiPreviewLoading(false)
    }
  }

  const saveApiAsDataset = async () => {
    if (!apiPreviewConnection || !apiPreviewResult || !apiDatasetName.trim()) {
      setApiPreviewError('Dataset adı gerekli')
      return
    }

    if (apiSelectedColumns.length === 0) {
      setApiPreviewError('En az bir kolon seçmelisiniz')
      return
    }

    setApiDatasetSaving(true)
    try {
      await apiCall('/data/datasets', {
        method: 'POST',
        body: JSON.stringify({
          connectionId: apiPreviewConnection.id,
          name: apiDatasetName,
          sourceType: 'api',
          sourceQuery: JSON.stringify({
            endpoint: apiEndpoint,
            method: apiMethod,
            responsePath: apiResponsePath,
            queryParams: apiQueryParams,
            requestBody: apiBody // POST/PUT için body
          }),
          columnMapping: apiSelectedColumns.map((col: string) => {
            const colInfo = apiPreviewResult.columns?.find((c: any) => c.name === col)
            return {
              source: col,
              target: col,
              type: colInfo?.type || 'string',
              include: true
            }
          }),
          syncStrategy: 'full_refresh',
          syncSchedule: apiSyncSchedule,
          rowLimit: apiRowLimit
        })
      })

      setShowApiPreviewModal(false)
      setShowApiDatasetForm(false)
      setApiDatasetName('')
      setApiSelectedColumns([])
      setApiSyncSchedule('manual')
      setApiRowLimit(10000)
      loadDatasets()
      loadSchedules()
      loadConnections()
    } catch (err: any) {
      setApiPreviewError(err.message)
    } finally {
      setApiDatasetSaving(false)
    }
  }

  // Sync durumu takibi
  const [syncingDatasetId, setSyncingDatasetId] = useState<string | null>(null)

  // Trigger sync
  const triggerSync = async (datasetId: string, action: string = 'manual_sync') => {
    // Zaten sync yapılıyorsa engelle
    if (syncingDatasetId === datasetId) {
      return
    }
    
    setSyncingDatasetId(datasetId)
    
    try {
      const result = await apiCall(`/data/datasets/${datasetId}/sync`, {
        method: 'POST',
        body: JSON.stringify({ action })
      })
      
      if (result.success) {
        // Başarı mesajı göster
        toast.success(`Sync başlatıldı! Job ID: ${result.jobId?.slice(0, 8) || 'N/A'}`)
      } else {
        // Hata veya uyarı mesajı
        toast(result.error || 'Sync başlatılamadı', { icon: '⚠️' })
      }
      
      loadDatasets()
      loadETLJobs()
    } catch (err: any) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      // 2 saniye sonra butonları tekrar aktif et
      setTimeout(() => setSyncingDatasetId(null), 2000)
    }
  }

  // Preview dataset data from ClickHouse
  const handlePreviewDataset = async (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setShowPreviewModal(true)
    setPreviewLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataset.id}/preview?limit=100`)
      setPreviewData(result.data)
    } catch (err: any) {
      console.error('Preview error:', err)
      setPreviewData({ columns: [], rows: [] })
    } finally {
      setPreviewLoading(false)
    }
  }

  // Open settings modal
  const handleSettingsDataset = async (dataset: Dataset) => {
    setSelectedDataset(dataset)
    setShowSettingsModal(true)
    setNewDatasetName(dataset.name)
    setNewDatasetSyncStrategy(dataset.sync_strategy)
    setNewDatasetSyncSchedule(dataset.sync_schedule || 'manual')
    
    // Eğer günlük schedule ise cron_expression'dan saati parse et
    if (dataset.sync_schedule === 'daily') {
      // schedules array'ından bu dataset'in schedule'ını bul
      const schedule = schedules.find(s => s.dataset_id === dataset.id)
      if (schedule?.cron_expression) {
        // cron_expression formatı: "0 3 * * *" -> saat 3
        const match = schedule.cron_expression.match(/^0\s+(\d+)\s+\*\s+\*\s+\*$/)
        if (match) {
          setScheduledHour(parseInt(match[1]))
        } else {
          // Parse edilemezse varsayılan 2 kullan
          setScheduledHour(2)
        }
      } else {
        // Schedule yoksa varsayılan 2 kullan
        setScheduledHour(2)
      }
    }
    setNewDatasetReferenceColumn(dataset.reference_column || '')
    setNewDatasetRowLimit(dataset.row_limit || null)
    setDeleteDays(dataset.delete_days || 1)  // Tarih Bazlı Sil-Yaz için
    
    // Dataset'in kolonlarını ve partition ayarlarını çek
    try {
      const response = await apiCall(`/data/datasets/${dataset.id}`)
      if (response.data?.column_mapping && Array.isArray(response.data.column_mapping)) {
        const cols = response.data.column_mapping.map((col: any) => 
          col.target || col.targetName || col.source || col.name
        ).filter(Boolean)
        setSettingsColumns(cols)
      } else {
        setSettingsColumns([])
      }
      
      // Partition ayarlarını yükle
      const data = response.data || dataset
      setPartitionColumn(data.partition_column || '')
      setPartitionType(data.partition_type || 'monthly')
      setRefreshWindowDays(data.refresh_window_days || 7)
      setDetectModified(data.detect_modified || false)
      setModifiedColumn(data.modified_column || '')
      setWeeklyFullRefresh(data.weekly_full_refresh || false)
      setEngineType(data.engine_type || 'MergeTree')
      setCustomWhere(data.custom_where || '')  // Full Refresh WHERE koşulu
      setDeleteDays(data.delete_days ?? 1)  // Tarih Bazlı Sil-Yaz
      
      // RLS (Row-Level Security) kolonlarını yükle
      setRlsStoreColumn(data.store_column || '')
      setRlsRegionColumn(data.region_column || '')
      setRlsGroupColumn(data.group_column || '')
    } catch (err) {
      // Kolon listesi alınamazsa boş bırak
      setSettingsColumns([])
      // Partition ayarlarını varsayılana çek
      setPartitionColumn('')
      setPartitionType('monthly')
      setRefreshWindowDays(7)
      setDetectModified(false)
      setModifiedColumn('')
      setWeeklyFullRefresh(false)
      setEngineType('MergeTree')
      setDeleteDays(1)
      // RLS kolonlarını boşalt
      setRlsStoreColumn('')
      setRlsRegionColumn('')
      setRlsGroupColumn('')
    }
  }

  // Update dataset settings
  const handleUpdateDataset = async () => {
    if (!selectedDataset) return
    try {
      await apiCall(`/data/datasets/${selectedDataset.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: newDatasetName,
          syncStrategy: newDatasetSyncStrategy,
          syncSchedule: newDatasetSyncSchedule,
          scheduledHour: newDatasetSyncSchedule === 'daily' ? scheduledHour : null,
          referenceColumn: newDatasetReferenceColumn || null,
          rowLimit: newDatasetRowLimit,  // Satır limiti
          deleteDays: newDatasetSyncStrategy === 'date_delete_insert' ? deleteDays : null,  // Tarih Bazlı Sil-Yaz
          // RLS (Row-Level Security) kolonları
          storeColumn: rlsStoreColumn || null,
          regionColumn: rlsRegionColumn || null,
          groupColumn: rlsGroupColumn || null,
          // Partition ayarları
          partitionColumn: partitionColumn || null,
          partitionType: partitionType,
          refreshWindowDays: refreshWindowDays,
          detectModified: detectModified,
          modifiedColumn: detectModified ? modifiedColumn : null,
          weeklyFullRefresh: weeklyFullRefresh,
          engineType: engineType,
          customWhere: customWhere || null  // Full Refresh için WHERE koşulu
        })
      })
      setShowSettingsModal(false)
      // Tüm ilgili verileri yenile
      loadDatasets()
      loadSchedules()
      loadETLJobs()
      // Başarı mesajı
      toast.success('Dataset ayarları kaydedildi!')
    } catch (err: any) {
      setError(err.message)
      toast.error('Kaydetme hatası: ' + err.message)
    }
  }

  // Delete dataset
  const handleDeleteDataset = async () => {
    if (!selectedDataset) return
    if (!confirm(`"${selectedDataset.name}" dataset'ini silmek istediğinizden emin misiniz?`)) return
    try {
      await apiCall(`/data/datasets/${selectedDataset.id}`, { method: 'DELETE' })
      setShowSettingsModal(false)
      loadDatasets()
    } catch (err: any) {
      setError(err.message)
    }
  }

  // Delete connection
  const handleDeleteConnection = async (conn: any) => {
    // Bu bağlantıya ait dataset var mı kontrol et
    const linkedDatasets = datasets.filter(d => d.connection_id === conn.id)
    if (linkedDatasets.length > 0) {
      toast.error(`Bu bağlantıya ait ${linkedDatasets.length} dataset var. Önce datasetleri silin.`)
      return
    }
    
    if (!confirm(`"${conn.name}" bağlantısını silmek istediğinizden emin misiniz?`)) return
    
    try {
      await apiCall(`/data/connections/${conn.id}`, { method: 'DELETE' })
      loadConnections()
      loadDatasets()
    } catch (err: any) {
      toast.error('Silme hatası: ' + err.message)
    }
  }

  // ============================================
  // EFFECTS
  // ============================================

  // URL'den tab parametresi oku
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['connections', 'datasets', 'etl', 'sql', 'clickhouse', 'system'].includes(tabParam)) {
      setActiveTab(tabParam as any);
      // URL'den parametreyi temizle
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // GÜVENLİK: isMounted flag ile memory leak önleme
  // Component unmount olduktan sonra setState çağrılmasını engeller
  useEffect(() => {
    let isMounted = true
    
    const loadInitialData = async () => {
      if (!accessToken) return
      
      try {
        // Paralel yükleme - Promise.allSettled ile hata yönetimi
        const results = await Promise.allSettled([
          loadConnections(),
          loadDatasets(),
          loadETLJobs(),
          loadSchedules(),
          loadWorkerStatus()
        ])
        
        // Unmount olduysa state güncelleme
        if (!isMounted) return
        
        // Hataları logla
        results.forEach((r, i) => {
          if (r.status === 'rejected') {
            const names = ['connections', 'datasets', 'etlJobs', 'schedules', 'workerStatus']
            console.warn(`[DataPage] ${names[i]} yüklenemedi:`, r.reason)
          }
        })
      } catch (err) {
        console.error('[DataPage] Initial load error:', err)
      }
    }
    
    loadInitialData()
    
    return () => { isMounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // Auto-refresh worker status every 15 seconds
  useEffect(() => {
    if (!accessToken) return
    
    const interval = setInterval(loadWorkerStatus, 15000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  // Load system health when system tab is active
  useEffect(() => {
    let isMounted = true
    
    if (accessToken && activeTab === 'system') {
      loadSystemHealth(true).then(() => {
        if (!isMounted) return
      })
    }
    
    return () => { isMounted = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeTab])

  // Auto-refresh system health every 10 seconds when tab is active
  useEffect(() => {
    if (!accessToken || activeTab !== 'system' || !systemAutoRefresh) return
    
    const interval = setInterval(() => loadSystemHealth(), 10000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeTab, systemAutoRefresh])

  // Load ClickHouse tables when clickhouse tab is active
  useEffect(() => {
    if (accessToken && activeTab === 'clickhouse') {
      loadClickhouseTables()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeTab])

  // Load performance data when performance tab is active
  useEffect(() => {
    if (accessToken && activeTab === 'performance') {
      loadAllPerformance()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, activeTab])

  // Auto-refresh for running ETL jobs - faster refresh for progress bar
  useEffect(() => {
    const hasRunningJobs = etlJobs.some(j => j.status === 'running' || j.status === 'pending')
    if (!hasRunningJobs) return
    
    const interval = setInterval(() => {
      loadETLJobs()
      loadDatasets()
    }, 2000) // Refresh every 2 seconds for smoother progress
    
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etlJobs.length]) // etlJobs.length daha stabil, gereksiz re-render önler

  useEffect(() => {
    if (sqlConnectionId && accessToken) {
      loadTables(sqlConnectionId)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sqlConnectionId, accessToken])

  // ============================================
  // HELPERS
  // ============================================

  const getStatusColor = (status: string) => {
    if (isDark) {
      switch (status) {
        case 'active': case 'completed': return 'text-emerald-400 bg-emerald-500/10'
        case 'error': case 'failed': return 'text-red-400 bg-red-500/10'
        case 'running': case 'syncing': return 'text-blue-400 bg-blue-500/10'
        default: return 'text-amber-400 bg-amber-500/10'
      }
    }
    switch (status) {
      case 'active': case 'completed': return 'text-emerald-600 bg-emerald-50'
      case 'error': case 'failed': return 'text-red-600 bg-red-50'
      case 'running': case 'syncing': return 'text-blue-600 bg-blue-50'
      default: return 'text-amber-600 bg-amber-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': case 'completed': return CheckCircle
      case 'error': case 'failed': return AlertCircle
      case 'running': case 'syncing': return RefreshCw
      default: return Clock
    }
  }

  // Hata mesajlarını Türkçeleştir
  const translateErrorMessage = (message: string): string => {
    if (!message) return ''
    
    const translations: Record<string, string> = {
      // ClickHouse hataları
      'Table .* does not exist': 'Clixer tablosu bulunamadı. Tabloyu oluşturmak için "Şimdi Sync Et" butonuna tıklayın.',
      'does not exist': 'Clixer tablosu mevcut değil. Sync işlemi başlatıldığında otomatik oluşturulacak.',
      'Connection refused': 'Clixer DB bağlantısı reddedildi. Servis çalışıyor mu kontrol edin.',
      'Authentication failed': 'Kimlik doğrulama başarısız. Kullanıcı adı veya şifre hatalı.',
      'timeout': 'Bağlantı zaman aşımına uğradı. Sunucu erişilebilir mi kontrol edin.',
      'ECONNREFUSED': 'Bağlantı reddedildi. Hedef sunucu çalışmıyor olabilir.',
      'ENOTFOUND': 'Sunucu bulunamadı. Host adresini kontrol edin.',
      'ETIMEDOUT': 'Bağlantı zaman aşımı. Ağ bağlantınızı kontrol edin.',
      // PostgreSQL hataları
      'relation .* does not exist': 'Tablo veya view bulunamadı. Kaynak sorguyu kontrol edin.',
      'permission denied': 'Yetki hatası. Veritabanı kullanıcısının gerekli izinleri var mı kontrol edin.',
      'syntax error': 'SQL söz dizimi hatası. Sorguyu kontrol edin.',
      // Genel hatalar
      'Network Error': 'Ağ hatası. İnternet bağlantınızı kontrol edin.',
      'Internal Server Error': 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
    }
    
    for (const [pattern, translation] of Object.entries(translations)) {
      if (new RegExp(pattern, 'i').test(message)) {
        return translation
      }
    }
    
    // Türkçe değilse orijinal mesajı döndür ama bazı temel çeviriler yap
    return message
      .replace('Table', 'Tablo')
      .replace('does not exist', 'bulunamadı')
      .replace('Connection', 'Bağlantı')
      .replace('failed', 'başarısız')
      .replace('error', 'hata')
      .replace('timeout', 'zaman aşımı')
  }

  const formatTimeAgo = (dateStr: string, showTime = false) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    
    if (diffMins < 1) return showTime ? `Az önce (${timeStr})` : 'Az önce'
    if (diffMins < 60) return showTime ? `${diffMins} dk önce (${timeStr})` : `${diffMins} dk önce`
    if (diffHours < 24) return showTime ? `${diffHours} saat önce (${timeStr})` : `${diffHours} saat önce`
    
    const dateFormatted = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
    return showTime ? `${dateFormatted} ${timeStr}` : `${diffDays} gün önce`
  }

  // Süre formatı: 306s → "5dk 6sn", 58s → "58sn"
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}sn`
    }
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    if (mins < 60) {
      return secs > 0 ? `${mins}dk ${secs}sn` : `${mins}dk`
    }
    const hours = Math.floor(mins / 60)
    const remainingMins = mins % 60
    return remainingMins > 0 ? `${hours}sa ${remainingMins}dk` : `${hours}sa`
  }

  const getTypeIcon = (type: string) => {
    const t = type.toLowerCase()
    if (t.includes('int')) return Hash
    if (t.includes('date') || t.includes('time')) return Calendar
    return Code
  }

  const handleTableClick = (tableName: string, schema: string) => {
    if (expandedTable === tableName) {
      setExpandedTable(null)
    } else {
      setExpandedTable(tableName)
      if (!tableColumns[tableName]) {
        loadTableColumns(sqlConnectionId, tableName, schema)
      }
    }
  }

  const insertTableToQuery = (tableName: string) => {
    setSqlQuery(`SELECT * FROM ${tableName} LIMIT 10`)
  }

  // ============================================
  // RENDER
  // ============================================

  // Token henüz yüklenmemişse loading göster
  if (!accessToken) {
  return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin text-indigo-500" />
          <span className={clsx('text-lg', theme.contentTextMuted)}>Yükleniyor...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={clsx('w-12 h-12 bg-gradient-to-br rounded-2xl flex items-center justify-center shadow-lg', theme.accent)}>
            <Database className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className={clsx('text-2xl font-bold', theme.contentText)}>Veri Yönetimi</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Kaynak DB → ETL → Clixer → Dashboard</p>
          </div>
        </div>

        <button 
          onClick={() => setShowConnectionModal(true)}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
        >
          <Plus className="h-4 w-4" />
          Bağlantı Ekle
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-500 text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto">
            <X className="h-4 w-4 text-red-500" />
          </button>
          </div>
      )}

      {/* Tabs */}
      <div className={clsx('flex items-center gap-1 p-1 rounded-xl w-fit', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
        {[
          { id: 'connections', label: 'Bağlantılar', count: connections.length, icon: Link2 },
          { id: 'datasets', label: 'Dataset\'ler', count: datasets.length, icon: Table },
          { id: 'sql', label: 'SQL Editör', icon: Terminal },
          { id: 'etl', label: 'ETL Geçmişi', count: etlJobs.length, icon: Zap },
          { id: 'clickhouse', label: 'Clixer DB', icon: Database },
          { id: 'performance', label: 'Performans Danışmanı', icon: TrendingUp },
          { id: 'system', label: 'Sistem Sağlığı', icon: Activity },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id
                ? theme.buttonPrimary
                : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span className={clsx(
                'px-1.5 py-0.5 text-[10px] font-bold rounded',
                activeTab === tab.id ? 'bg-white/20' : isDark ? 'bg-slate-700' : 'bg-slate-200'
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
        </div>

      {/* ============================================ */}
      {/* CONNECTIONS TAB */}
      {/* ============================================ */}
      {activeTab === 'connections' && (
        <ConnectionsTab
          theme={theme}
          isDark={isDark}
          connections={connections}
          datasets={datasets}
          onEditConnection={editConnection}
          onTestConnection={testConnection}
          onDeleteConnection={handleDeleteConnection}
          onOpenApiPreview={openApiPreview}
          onShowConnectionModal={() => setShowConnectionModal(true)}
          onSelectConnectionForDataset={(conn) => {
            setSelectedConnection(conn)
            setShowDatasetModal(true)
          }}
          onNavigateToSql={(connectionId) => {
            setSqlConnectionId(connectionId)
            setActiveTab('sql')
          }}
        />
      )}

      {/* ============================================ */}
      {/* SQL EDITOR TAB */}
      {/* ============================================ */}
      {activeTab === 'sql' && (
        <SqlEditorTab
          theme={theme}
          isDark={isDark}
          connections={connections}
          sqlConnectionId={sqlConnectionId}
          sqlQuery={sqlQuery}
          sqlResult={sqlResult}
          sqlLoading={sqlLoading}
          sqlError={sqlError}
          tables={tables}
          expandedTable={expandedTable}
          tableColumns={tableColumns}
          onConnectionChange={setSqlConnectionId}
          onQueryChange={setSqlQuery}
          onExecuteQuery={executeQuery}
          onTableClick={handleTableClick}
          onInsertTableToQuery={insertTableToQuery}
          onSaveToDataset={() => setShowDatasetModal(true)}
        />
      )}

      {/* ============================================ */}
      {/* DATASETS TAB */}
      {/* ============================================ */}
      {activeTab === 'datasets' && (
        <DatasetsTab
          theme={theme}
          isDark={isDark}
          datasets={datasets}
          workerStatus={workerStatus}
          triggeringAll={triggeringAll}
          syncingDatasetId={syncingDatasetId}
          onRefreshWorkerStatus={loadWorkerStatus}
          onStartWorker={async () => {
            try {
              await apiCall('/data/etl/worker/start', { method: 'POST' })
              setTimeout(loadWorkerStatus, 2000)
            } catch (err) {
              console.error('Worker start error:', err)
            }
          }}
          onRestartWorker={async () => {
            try {
              await apiCall('/data/etl/worker/restart', { method: 'POST' })
              setTimeout(loadWorkerStatus, 3000)
            } catch (err) {
              console.error('Worker restart error:', err)
            }
          }}
          onStopWorker={async () => {
            try {
              await apiCall('/data/etl/worker/stop', { method: 'POST' })
              setTimeout(loadWorkerStatus, 1000)
            } catch (err) {
              console.error('Worker stop error:', err)
            }
          }}
          onTriggerAllSync={triggerAllSync}
          onTriggerSync={triggerSync}
          onPreviewDataset={handlePreviewDataset}
          onSettingsDataset={handleSettingsDataset}
          onShowDatasetModal={() => setShowDatasetModal(true)}
          formatTimeAgo={formatTimeAgo}
          getStatusColor={getStatusColor}
          translateErrorMessage={translateErrorMessage}
        />
      )}

      {/* ============================================ */}
      {/* ETL HISTORY TAB */}
      {/* ============================================ */}
      {activeTab === 'etl' && (
        <ETLHistoryTab
          theme={theme}
          isDark={isDark}
          etlJobs={etlJobs}
          schedules={schedules}
          onRefreshSchedules={loadSchedules}
          onRefreshJobs={loadETLJobs}
          onUpdateScheduleInterval={updateScheduleInterval}
          onToggleSchedule={toggleSchedule}
          onKillJob={async (jobId, datasetName) => {
            if (!confirm(`"${datasetName}" için çalışan sync işlemini iptal etmek istediğinize emin misiniz?`)) return
            try {
              await apiCall(`/data/etl-jobs/${jobId}/kill`, { method: 'POST' })
              loadETLJobs()
            } catch (err: any) {
              toast.error(err instanceof Error ? err.message : 'İptal işlemi başarısız')
            }
          }}
          formatTimeAgo={formatTimeAgo}
          formatDuration={formatDuration}
          getStatusColor={getStatusColor}
          cronToShortCode={cronToShortCode}
          isJobStuck={isJobStuck}
        />
      )}

      {/* ============================================ */}
      {/* CLICKHOUSE TAB */}
      {/* ============================================ */}
      {activeTab === 'clickhouse' && (
        <ClickHouseTab
          theme={theme}
          isDark={isDark}
          clickhouseTables={clickhouseTables}
          clickhouseLoading={clickhouseLoading}
          showChTableModal={showChTableModal}
          selectedChTable={selectedChTable}
          systemActionLoading={systemActionLoading}
          showDataManagementModal={showDataManagementModal}
          dataManagementTable={dataManagementTable}
          dataManagementDatasetId={dataManagementDatasetId}
          dataManagementColumns={dataManagementColumns}
          dataManagementLoading={dataManagementLoading}
          dataManagementPreview={dataManagementPreview}
          dmActiveTab={dmActiveTab}
          dmDateColumn={dmDateColumn}
          dmDeleteMode={dmDeleteMode}
          dmDays={dmDays}
          dmStartDate={dmStartDate}
          dmEndDate={dmEndDate}
          pkColumn={pkColumn}
          validationLoading={validationLoading}
          comparisonData={comparisonData}
          missingRanges={missingRanges}
          duplicateAnalysis={duplicateAnalysis}
          onRefresh={loadClickhouseTables}
          onViewDetails={viewChTableDetails}
          onOptimize={optimizeChTable}
          onTruncate={truncateChTable}
          onDelete={deleteChTable}
          onOpenDataManagement={openDataManagementModal}
          onCloseTableModal={() => setShowChTableModal(false)}
          onCloseDataManagementModal={() => setShowDataManagementModal(false)}
          onSetDmActiveTab={setDmActiveTab}
          onSetDmDateColumn={setDmDateColumn}
          onSetDmDeleteMode={setDmDeleteMode}
          onSetDmDays={setDmDays}
          onSetDmStartDate={setDmStartDate}
          onSetDmEndDate={setDmEndDate}
          onSetPkColumn={setPkColumn}
          onPreviewDelete={previewDataManagementDelete}
          onExecuteDelete={executeDataManagementDelete}
          onLoadComparison={loadComparison}
          onLoadMissingRanges={loadMissingRanges}
          onLoadDuplicateAnalysis={loadDuplicateAnalysis}
          onSyncMissingData={syncMissingData}
          onSyncNewRecordsOnly={syncNewRecordsOnly}
          onClearComparisonData={() => {
            setComparisonData(null)
            setMissingRanges(null)
          }}
        />
      )}

      {/* ============================================ */}
      {/* SYSTEM HEALTH TAB */}
      {/* ============================================ */}
      {activeTab === 'system' && (
        <SystemHealthTab
          theme={theme}
          isDark={isDark}
          systemHealth={systemHealth}
          systemHealthLoading={systemHealthLoading}
          systemAutoRefresh={systemAutoRefresh}
          systemActionLoading={systemActionLoading}
          workerStatus={workerStatus}
          etlMonitoring={etlMonitoring}
          onRefresh={loadSystemHealth}
          onToggleAutoRefresh={() => setSystemAutoRefresh(!systemAutoRefresh)}
          onRestartService={async (serviceId) => {
            setSystemActionLoading(`restart-${serviceId}`)
            try {
              const result = await apiCall(`/admin/service/${serviceId}/restart`, { method: 'POST' })
              toast.success(result.message || 'Servis yeniden başlatıldı')
              setTimeout(() => loadSystemHealth(true), 2000)
            } catch (err: any) {
              toast.error(err.message || 'Servis başlatılamadı')
            } finally {
              setSystemActionLoading(null)
            }
          }}
          onReconnectClickhouse={async () => {
            setSystemActionLoading('clickhouse-reconnect')
            try {
              await apiCall('/admin/clickhouse/reconnect', { method: 'POST' })
              await loadSystemHealth(true)
              toast.success('Clixer DB bağlantısı yenilendi')
            } catch (e: any) {
              toast.error('Clixer DB bağlantısı kurulamadı: ' + e.message)
            } finally {
              setSystemActionLoading(null)
            }
          }}
          onReconnectRedis={async () => {
            setSystemActionLoading('redis-reconnect')
            try {
              await apiCall('/admin/redis/reconnect', { method: 'POST' })
              await loadSystemHealth(true)
              toast.success('Redis bağlantısı yenilendi')
            } catch (e: any) {
              toast.error('Redis bağlantısı kurulamadı: ' + e.message)
            } finally {
              setSystemActionLoading(null)
            }
          }}
          onWorkerStart={async () => {
            setSystemActionLoading('worker-start')
            try {
              await apiCall('/data/etl/worker/start', { method: 'POST' })
              setTimeout(async () => {
                await loadWorkerStatus()
                setSystemActionLoading(null)
              }, 4000)
            } catch (e: any) {
              console.error('Worker start error:', e)
              setSystemActionLoading(null)
            }
          }}
          onWorkerStop={async () => {
            if (!confirm('ETL Worker durdurulacak. Devam etmek istiyor musunuz?')) return
            setSystemActionLoading('worker-stop')
            try {
              await apiCall('/data/etl/worker/stop', { method: 'POST' })
              await loadWorkerStatus()
            } catch (e: any) {
              console.error('Worker stop error:', e)
            } finally {
              setSystemActionLoading(null)
            }
          }}
          onWorkerRestart={async () => {
            setSystemActionLoading('worker-restart')
            try {
              await apiCall('/data/etl/worker/restart', { method: 'POST' })
              await loadWorkerStatus()
            } catch (e: any) {
              console.error('Worker restart error:', e)
            } finally {
              setSystemActionLoading(null)
            }
          }}
          onCancelJob={cancelJob}
          onDeleteLock={deleteLock}
          onDeleteAllLocks={deleteAllLocks}
          onClearCache={clearSystemCache}
          onTriggerETL={triggerSystemETL}
          onCancelAllETL={cancelAllETLJobs}
          setSystemActionLoading={setSystemActionLoading}
        />
      )}

      {/* ============================================ */}
      {/* PERFORMANS DANIŞMANI TAB */}
      {/* ============================================ */}
      {activeTab === 'performance' && (
        <PerformanceTab
          theme={theme}
          isDark={isDark}
          performanceLoading={performanceLoading}
          performanceActionLoading={performanceActionLoading}
          performanceData={performanceData}
          connections={connections}
          onLoadAll={loadAllPerformance}
          onLoadPostgres={loadPostgresPerformance}
          onLoadClickhouse={loadClickhousePerformance}
          onLoadEtl={loadEtlPerformance}
          onLoadConnection={loadConnectionPerformance}
          onDropIndex={dropIndex}
          onRunVacuum={runVacuum}
          onOptimizeAll={optimizeAllClickhouse}
          onCopyToClipboard={copyToClipboard}
        />
      )}

      {/* ============================================ */}
      {/* Dataset Creation Modal */}
      {/* ============================================ */}
      <DatasetModal
        isOpen={showDatasetModal}
        onClose={() => setShowDatasetModal(false)}
        onSuccess={loadDatasets}
        sqlResult={sqlResult}
        sqlQuery={sqlQuery}
        sqlConnectionId={sqlConnectionId}
        theme={theme}
        isDark={isDark}
      />

      {/* ============================================ */}
      {/* ClickHouse Info Card */}
      {/* ============================================ */}
      <div className={clsx(
        'rounded-2xl border p-6',
        isDark ? 'bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/20' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
      )}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center shrink-0">
            <HardDrive className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className={clsx('font-bold mb-1', isDark ? 'text-amber-400' : 'text-amber-600')}>Clixer Veri Mimarisi</h3>
            <p className={clsx('text-sm mb-3', theme.contentTextMuted)}>
              Kaynak veritabanları (PostgreSQL, MSSQL) → ETL Worker → Clixer → Dashboard.
              Dashboard'lar asla kaynak DB'ye bağlanmaz, böylece ultra hızlı sorgular ve gerçek zamanlı analitik mümkün olur.
            </p>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className={clsx(theme.contentTextMuted)}>Pre-aggregation</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className={clsx(theme.contentTextMuted)}>4-Level Cache</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                <span className={clsx(theme.contentTextMuted)}>Real-time Sync</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* PREVIEW MODAL */}
      {/* ============================================ */}
      <PreviewModal
        theme={theme}
        isDark={isDark}
        isOpen={showPreviewModal}
        dataset={selectedDataset}
        previewData={previewData}
        previewLoading={previewLoading}
        syncingDatasetId={syncingDatasetId}
        onClose={() => setShowPreviewModal(false)}
        onSync={triggerSync}
        onPartialRefresh={async (datasetId, days) => {
          if (!confirm(`${selectedDataset?.name} için son ${days} günlük veri silinip yeniden çekilecek. Devam?`)) return
          try {
            const result = await apiCall(`/data/datasets/${datasetId}/partial-refresh`, {
              method: 'POST',
              body: JSON.stringify({ days })
            })
            if (result.success) {
              toast.success(`Son ${days} gün yenileme başlatıldı!`)
              loadETLJobs()
            } else {
              toast(result.error || 'Başlatılamadı', { icon: '⚠️' })
            }
          } catch (err: any) {
            toast.error(err.message)
          }
        }}
        formatTimeAgo={formatTimeAgo}
      />

      {/* ============================================ */}
      {/* SETTINGS MODAL */}
      {/* ============================================ */}
      <SettingsModal
        theme={theme}
        isDark={isDark}
        isOpen={showSettingsModal}
        dataset={selectedDataset}
        newDatasetName={newDatasetName}
        newDatasetSyncStrategy={newDatasetSyncStrategy}
        newDatasetSyncSchedule={newDatasetSyncSchedule}
        newDatasetRowLimit={newDatasetRowLimit}
        newDatasetReferenceColumn={newDatasetReferenceColumn}
        scheduledHour={scheduledHour}
        customWhere={customWhere}
        deleteDays={deleteDays}
        partitionColumn={partitionColumn}
        partitionType={partitionType}
        refreshWindowDays={refreshWindowDays}
        engineType={engineType}
        detectModified={detectModified}
        modifiedColumn={modifiedColumn}
        weeklyFullRefresh={weeklyFullRefresh}
        uniqueColumn={uniqueColumn}
        autoDetectedUnique={autoDetectedUnique}
        rlsStoreColumn={rlsStoreColumn}
        rlsRegionColumn={rlsRegionColumn}
        rlsGroupColumn={rlsGroupColumn}
        settingsColumns={settingsColumns}
        sqlResult={sqlResult}
        setNewDatasetName={setNewDatasetName}
        setNewDatasetSyncStrategy={setNewDatasetSyncStrategy}
        setNewDatasetSyncSchedule={setNewDatasetSyncSchedule}
        setNewDatasetRowLimit={setNewDatasetRowLimit}
        setNewDatasetReferenceColumn={setNewDatasetReferenceColumn}
        setScheduledHour={setScheduledHour}
        setCustomWhere={setCustomWhere}
        setDeleteDays={setDeleteDays}
        setPartitionColumn={setPartitionColumn}
        setPartitionType={setPartitionType}
        setRefreshWindowDays={setRefreshWindowDays}
        setEngineType={setEngineType}
        setDetectModified={setDetectModified}
        setModifiedColumn={setModifiedColumn}
        setWeeklyFullRefresh={setWeeklyFullRefresh}
        setUniqueColumn={setUniqueColumn}
        setRlsStoreColumn={setRlsStoreColumn}
        setRlsRegionColumn={setRlsRegionColumn}
        setRlsGroupColumn={setRlsGroupColumn}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleUpdateDataset}
        onDelete={handleDeleteDataset}
        translateErrorMessage={translateErrorMessage}
      />

      {/* ============================================ */}
      {/* API PREVIEW MODAL */}
      {/* ============================================ */}
      <ApiPreviewModal
        theme={theme}
        isDark={isDark}
        isOpen={showApiPreviewModal}
        connection={apiPreviewConnection}
        apiMethod={apiMethod}
        apiEndpoint={apiEndpoint}
        apiQueryParams={apiQueryParams}
        apiResponsePath={apiResponsePath}
        apiBody={apiBody}
        apiPreviewLoading={apiPreviewLoading}
        apiPreviewError={apiPreviewError}
        apiPreviewResult={apiPreviewResult}
        showApiDatasetForm={showApiDatasetForm}
        apiDatasetName={apiDatasetName}
        apiSelectedColumns={apiSelectedColumns}
        apiSyncSchedule={apiSyncSchedule}
        apiRowLimit={apiRowLimit}
        apiDatasetSaving={apiDatasetSaving}
        setApiMethod={setApiMethod}
        setApiEndpoint={setApiEndpoint}
        setApiQueryParams={setApiQueryParams}
        setApiResponsePath={setApiResponsePath}
        setApiBody={setApiBody}
        setShowApiDatasetForm={setShowApiDatasetForm}
        setApiDatasetName={setApiDatasetName}
        setApiSelectedColumns={setApiSelectedColumns}
        setApiSyncSchedule={setApiSyncSchedule}
        setApiRowLimit={setApiRowLimit}
        onClose={() => setShowApiPreviewModal(false)}
        onRunPreview={runApiPreview}
        onSaveAsDataset={saveApiAsDataset}
      />

      {/* ============================================ */}
      {/* CONNECTION MODAL - Yeni Bağlantı Ekle */}
      {/* ============================================ */}
      {showConnectionModal && (
        <ConnectionModal 
          isOpen={showConnectionModal}
          onClose={() => { setShowConnectionModal(false); setEditingConnection(null) }}
          onSuccess={() => {
            setShowConnectionModal(false)
            setEditingConnection(null)
            loadConnections()
          }}
          editingConnection={editingConnection}
          theme={theme}
          isDark={isDark}
        />
      )}
    </div>
  )
}
