import { useState, useEffect } from 'react'
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
  Search
} from 'lucide-react'
// Play ve Zap zaten import edilmiş
import clsx from 'clsx'
import { useAuthStore } from '../stores/authStore'

// API Base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

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
      alert('Lock silinemedi: ' + err.message)
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
      alert('Lock\'lar silinemedi: ' + err.message)
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
      alert('Job iptal edilemedi: ' + err.message)
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
      alert(`✅ ${result.message}`)
      loadPostgresPerformance()
    } catch (err: any) {
      alert('❌ VACUUM başarısız: ' + err.message)
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
      alert(`✅ ${result.message}`)
      loadPostgresPerformance()
    } catch (err: any) {
      alert('❌ Index silinemedi: ' + err.message)
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
      alert(`✅ ${result.message}`)
      // Optimize sonrası verileri yenile
      await loadClickhousePerformance()
    } catch (err: any) {
      alert('❌ Optimize başarısız: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }

  // Metni panoya kopyala
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('✅ Panoya kopyalandı!')
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
      alert('Tablo detayları yüklenemedi: ' + err.message)
    }
  }
  
  // Truncate ClickHouse table
  const truncateChTable = async (tableName: string) => {
    if (!confirm(`"${tableName}" tablosundaki TÜM VERİLER silinecek. Devam etmek istiyor musunuz?`)) return
    setSystemActionLoading(`ch-truncate-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}/truncate`, { method: 'POST' })
      await loadClickhouseTables()
      alert('Tablo temizlendi')
    } catch (err: any) {
      alert('Tablo temizlenemedi: ' + err.message)
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
      alert('Tablo optimize edildi (duplicate\'lar temizlendi)')
    } catch (err: any) {
      alert('Optimize edilemedi: ' + err.message)
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
      alert('Dataset ID bulunamadı. Lütfen dataset listesinden açın.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/compare?pkColumn=${pkColumn}`)
      setComparisonData(result.data)
    } catch (err: any) {
      alert('Karşılaştırma yapılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Eksik ID Aralıklarını Bul
  const loadMissingRanges = async () => {
    if (!dataManagementDatasetId) {
      alert('Dataset ID bulunamadı.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/missing-ranges?pkColumn=${pkColumn}`)
      setMissingRanges(result.data)
    } catch (err: any) {
      alert('Eksik aralıklar bulunamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Duplicate Analizi
  const loadDuplicateAnalysis = async () => {
    if (!dataManagementDatasetId) {
      alert('Dataset ID bulunamadı.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/duplicate-analysis`)
      setDuplicateAnalysis(result.data)
    } catch (err: any) {
      alert('Duplicate analizi yapılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Eksik Verileri Sync Et
  const syncMissingData = async () => {
    if (!dataManagementDatasetId || !missingRanges?.missing_ranges?.length) {
      alert('Önce eksik aralıkları bulun.')
      return
    }
    
    if (!confirm(`${missingRanges.missing_ranges.length} aralıktaki eksik veriler çekilecek. Devam?`)) return
    
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/sync-missing`, {
        method: 'POST',
        body: JSON.stringify({ ranges: missingRanges.missing_ranges, pkColumn })
      })
      alert(`Eksik veri sync işlemi başlatıldı.`)
      loadETLJobs()
    } catch (err: any) {
      alert('Sync başlatılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // 🚀 Sadece Yeni Kayıtları Çek (En hızlı yöntem - 100M+ tablolar için)
  const syncNewRecordsOnly = async () => {
    if (!dataManagementDatasetId) {
      alert('Dataset ID bulunamadı.')
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
      alert(`✅ Yeni kayıt sync başlatıldı!\n\nMax ID: ${result.data.clickhouse_max_id}'den sonraki tüm kayıtlar çekilecek.`)
      loadETLJobs()
    } catch (err: any) {
      alert('Sync başlatılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }
  
  // Silinecek satır sayısını önizle
  const previewDataManagementDelete = async () => {
    if (!dmDateColumn) {
      alert('Lütfen tarih kolonu seçin')
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
      alert('Önizleme hatası: ' + err.message)
    } finally {
      setDataManagementLoading(false)
    }
  }
  
  // Veriyi sil
  const executeDataManagementDelete = async () => {
    if (!dataManagementPreview || dataManagementPreview.rowsToDelete === 0) {
      alert('Silinecek veri yok')
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
      alert(result.data?.message || 'Silme işlemi başlatıldı')
      setShowDataManagementModal(false)
      await loadClickhouseTables()
    } catch (err: any) {
      alert('Silme hatası: ' + err.message)
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
      alert('Tablo silindi')
    } catch (err: any) {
      alert('Tablo silinemedi: ' + err.message)
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
      alert(`✅ ${result.message || 'Önbellek temizlendi'}\n\nSilinen kayıt: ${result.data?.deletedCount || 0}`)
      loadSystemHealth()
    } catch (err: any) {
      alert('❌ Önbellek temizlenemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // Trigger ETL from system tab
  const triggerSystemETL = async () => {
    setSystemActionLoading('etl')
    try {
      const result = await apiCall('/admin/etl/trigger', { method: 'POST' })
      alert(result.message || 'ETL tetiklendi')
      loadSystemHealth()
      loadETLJobs()
    } catch (err: any) {
      alert('ETL tetiklenemedi: ' + err.message)
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
      alert(result.message || 'Tüm job\'lar iptal edildi')
      loadSystemHealth()
      loadETLJobs()
    } catch (err: any) {
      alert('İptal işlemi başarısız: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }

  // Trigger all datasets sync
  const triggerAllSync = async () => {
    setTriggeringAll(true)
    try {
      const result = await apiCall('/data/etl/trigger-all', { method: 'POST' })
      alert(result.message || 'Tüm datasetler için sync tetiklendi')
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
      alert('Dataset adı ve SQL sonucu gerekli')
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

      alert(`Dataset "${newDatasetName}" başarıyla oluşturuldu! Clixer tablosu: ${result.data.clickhouseTable}`)
      setShowDatasetModal(false)
      setNewDatasetName('')
      setNewDatasetDescription('')
      loadDatasets()
    } catch (err: any) {
      console.error('Create dataset error:', err)
      alert('Dataset oluşturulurken hata: ' + (err.message || 'Bilinmeyen hata'))
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
        alert(`✅ Sync başlatıldı! Job ID: ${result.jobId?.slice(0, 8) || 'N/A'}`)
      } else {
        // Hata veya uyarı mesajı
        alert(`⚠️ ${result.error || 'Sync başlatılamadı'}`)
      }
      
      loadDatasets()
      loadETLJobs()
    } catch (err: any) {
      setError(err.message)
      alert(`❌ Hata: ${err.message}`)
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
      alert('Dataset ayarları kaydedildi!')
    } catch (err: any) {
      setError(err.message)
      alert('Kaydetme hatası: ' + err.message)
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
      alert(`Bu bağlantıya ait ${linkedDatasets.length} dataset var. Önce datasetleri silin:\n${linkedDatasets.map(d => '- ' + d.name).join('\n')}`)
      return
    }
    
    if (!confirm(`"${conn.name}" bağlantısını silmek istediğinizden emin misiniz?`)) return
    
    try {
      await apiCall(`/data/connections/${conn.id}`, { method: 'DELETE' })
      loadConnections()
      loadDatasets()
    } catch (err: any) {
      alert('Silme hatası: ' + err.message)
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

  useEffect(() => {
    // accessToken yüklendiğinde verileri yükle
    if (accessToken) {
      loadConnections()
      loadDatasets()
      loadETLJobs()
      loadSchedules()
      loadWorkerStatus()
    }
  }, [accessToken])

  // Auto-refresh worker status every 15 seconds
  useEffect(() => {
    if (accessToken) {
      const interval = setInterval(loadWorkerStatus, 15000)
      return () => clearInterval(interval)
    }
  }, [accessToken])

  // Load system health when system tab is active
  useEffect(() => {
    if (accessToken && activeTab === 'system') {
      loadSystemHealth(true)
    }
  }, [accessToken, activeTab])

  // Auto-refresh system health every 10 seconds when tab is active
  useEffect(() => {
    if (accessToken && activeTab === 'system' && systemAutoRefresh) {
      const interval = setInterval(() => loadSystemHealth(), 10000)
      return () => clearInterval(interval)
    }
  }, [accessToken, activeTab, systemAutoRefresh])

  // Load ClickHouse tables when clickhouse tab is active
  useEffect(() => {
    if (accessToken && activeTab === 'clickhouse') {
      loadClickhouseTables()
    }
  }, [accessToken, activeTab])

  // Load performance data when performance tab is active
  useEffect(() => {
    if (accessToken && activeTab === 'performance') {
      loadAllPerformance()
    }
  }, [accessToken, activeTab])

  // Auto-refresh for running ETL jobs - faster refresh for progress bar
  useEffect(() => {
    const hasRunningJobs = etlJobs.some(j => j.status === 'running' || j.status === 'pending')
    if (hasRunningJobs) {
      const interval = setInterval(() => {
        loadETLJobs()
        loadDatasets()
      }, 2000) // Refresh every 2 seconds for smoother progress
      return () => clearInterval(interval)
    }
  }, [etlJobs])

  useEffect(() => {
    if (sqlConnectionId && accessToken) {
      loadTables(sqlConnectionId)
    }
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
        <div className="space-y-6">
          {/* Connection Types */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[
              { type: 'postgresql', name: 'PostgreSQL', icon: Server, color: 'from-blue-500 to-indigo-500' },
              { type: 'mssql', name: 'SQL Server', icon: Database, color: 'from-red-500 to-orange-500' },
              { type: 'api', name: 'REST API', icon: Globe, color: 'from-emerald-500 to-teal-500', disabled: true },
              { type: 'excel', name: 'Excel / CSV', icon: FileSpreadsheet, color: 'from-green-500 to-lime-500', disabled: true },
            ].map((source) => (
              <button
                key={source.type}
                onClick={() => !source.disabled && setShowConnectionModal(true)}
                disabled={source.disabled}
                className={clsx(
                  'p-4 rounded-2xl transition-all group relative',
                  theme.cardBg,
                  source.disabled ? 'opacity-50 cursor-not-allowed' : theme.cardHover
                )}
              >
                {source.disabled && (
                  <span className={clsx('absolute top-2 right-2 px-2 py-0.5 rounded text-[10px] font-bold', isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500')}>
                    YAKINDA
                  </span>
                )}
                <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center mb-3 bg-gradient-to-br', source.color)}>
                  <source.icon className="h-6 w-6 text-white" />
          </div>
                <h3 className={clsx('font-bold text-sm mb-1', theme.contentText)}>{source.name}</h3>
                <p className={clsx('text-xs', theme.contentTextMuted)}>Bağlantı ekle</p>
              </button>
            ))}
        </div>

          {/* Existing Connections */}
          <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
            <div className={clsx('px-6 py-4 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
              <h3 className={clsx('font-bold', theme.contentText)}>Aktif Bağlantılar</h3>
          </div>

            {connections.length > 0 ? (
              <div className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                {connections.map((conn) => {
                  const StatusIcon = getStatusIcon(conn.status)
                  const isApi = conn.type === 'api'
                  const isExcel = conn.type === 'excel'
                  const ConnIcon = isApi ? Globe : isExcel ? FileSpreadsheet : Server
                  const gradientClass = isApi 
                    ? 'from-emerald-500 to-teal-500' 
                    : isExcel 
                    ? 'from-green-500 to-lime-500' 
                    : 'from-blue-500 to-indigo-500'
                  
                  return (
                    <div key={conn.id} className={clsx('px-6 py-4 transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={clsx('w-12 h-12 bg-gradient-to-br rounded-xl flex items-center justify-center', gradientClass)}>
                            <ConnIcon className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <h4 className={clsx('font-bold', theme.contentText)}>{conn.name}</h4>
                            <p className={clsx('text-sm', theme.contentTextMuted)}>
                              {isApi ? 'REST API' : isExcel ? 'Excel/CSV' : conn.type.toUpperCase()} • {conn.host}{!isApi && conn.port ? `:${conn.port}` : ''}{conn.database_name ? `/${conn.database_name}` : ''}
                            </p>
        </div>
      </div>

                        <div className="flex items-center gap-4">
                          {/* Connection Status - Basit: Bağlı / Bağlı Değil */}
                          <div className={clsx(
                            'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium',
                            conn.status === 'active' 
                              ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                              : (isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-700')
                          )}>
                            {conn.status === 'active' ? (
                              <>
                                <CheckCircle className="h-3 w-3" />
                                Bağlı
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3" />
                                Bağlı Değil
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => editConnection(conn)}
                              className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                              title="Düzenle"
                            >
                              <Edit2 className={clsx('h-4 w-4', theme.contentTextMuted)} />
                            </button>
                            <button 
                              onClick={() => testConnection(conn.id)}
                              className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                              title="Bağlantıyı Test Et"
                            >
                              <RefreshCw className={clsx('h-4 w-4', theme.contentTextMuted)} />
                            </button>
                            {/* API bağlantısı için Önizleme butonu */}
                            {conn.type === 'api' ? (
                              <button 
                                onClick={() => openApiPreview(conn)}
                                className={clsx('p-2 rounded-lg transition-colors bg-emerald-500/10 hover:bg-emerald-500/20')}
                                title="API Önizleme"
                              >
                                <Eye className="h-4 w-4 text-emerald-500" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => {
                                  setSqlConnectionId(conn.id)
                                  setActiveTab('sql')
                                }}
                                className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                                title="SQL Editör"
                              >
                                <Terminal className={clsx('h-4 w-4', theme.contentTextMuted)} />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteConnection(conn)}
                              className="p-2 hover:bg-rose-500/10 rounded-lg transition-colors" 
                              title="Sil"
                            >
                              <Trash2 className="h-4 w-4 text-rose-500" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Associated Datasets */}
                      <div className="mt-4 pl-16">
                        <p className={clsx('text-xs mb-2', theme.contentTextMuted)}>Bağlı Dataset'ler</p>
                        <div className="flex flex-wrap gap-2">
                          {datasets.filter(d => d.connection_id === conn.id).map((ds) => (
                            <div key={ds.id} className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                              <Table className="h-3 w-3 text-blue-500" />
                              <span className={clsx(theme.contentText)}>{ds.name}</span>
                              <span className={clsx(theme.contentTextMuted)}>({ds.last_sync_rows?.toLocaleString()} satır)</span>
                            </div>
                          ))}
                          <button 
                            onClick={() => {
                              setSelectedConnection(conn)
                              setShowDatasetModal(true)
                            }}
                            className={clsx(
                              'flex items-center gap-1.5 px-3 py-1.5 border border-dashed rounded-lg text-xs transition-all',
                              isDark ? 'border-slate-700 hover:border-indigo-500 text-slate-500 hover:text-indigo-400' : 'border-slate-300 hover:border-indigo-500 text-slate-500 hover:text-indigo-600'
                            )}
                          >
                            <Plus className="h-3 w-3" />
                            Dataset Ekle
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center">
                <Link2 className={clsx('h-12 w-12 mx-auto mb-4', theme.contentTextMuted)} />
                <h3 className={clsx('text-lg font-bold mb-2', theme.contentText)}>Henüz Bağlantı Yok</h3>
                <p className={clsx('text-sm max-w-md mx-auto mb-4', theme.contentTextMuted)}>
          Veri kaynaklarınızı bağlayarak dashboard'larınızı gerçek verilerle besleyin.
        </p>
                <button 
                  onClick={() => setShowConnectionModal(true)}
                  className={clsx('inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                >
                  <Plus className="h-4 w-4" />
                  İlk Bağlantıyı Ekle
                </button>
      </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* SQL EDITOR TAB */}
      {/* ============================================ */}
      {activeTab === 'sql' && (
        <div className="grid grid-cols-12 gap-6">
          {/* Tables Explorer */}
          <div className={clsx('col-span-3 rounded-2xl overflow-hidden', theme.cardBg)}>
            <div className={clsx('px-4 py-3 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={clsx('font-bold text-sm', theme.contentText)}>Tablolar</h3>
                <Columns className={clsx('h-4 w-4', theme.contentTextMuted)} />
              </div>
              {/* Connection selector */}
              <select
                value={sqlConnectionId}
                onChange={(e) => setSqlConnectionId(e.target.value)}
                className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
              >
                {connections.map(conn => (
                  <option key={conn.id} value={conn.id} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                    {conn.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="max-h-[500px] overflow-y-auto p-2">
              {tables.map((table) => (
                <div key={`${table.schema}.${table.name}`} className="mb-1">
                  <button
                    onClick={() => handleTableClick(table.name, table.schema)}
                    onDoubleClick={() => insertTableToQuery(table.name)}
                    className={clsx(
                      'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors',
                      expandedTable === table.name 
                        ? (isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600')
                        : clsx(theme.contentText, isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100')
                    )}
                  >
                    {expandedTable === table.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    <Table className={clsx('h-4 w-4', table.type === 'view' ? 'text-purple-500' : 'text-blue-500')} />
                    <span className="flex-1 truncate">{table.name}</span>
                    <span className={clsx('text-[10px] uppercase', theme.contentTextMuted)}>
                      {table.type === 'view' ? 'VIEW' : ''}
                    </span>
                  </button>
                  
                  {/* Columns */}
                  {expandedTable === table.name && tableColumns[table.name] && (
                    <div className={clsx('ml-4 mt-1 pl-4 border-l-2 space-y-0.5', isDark ? 'border-slate-700' : 'border-slate-200')}>
                      {tableColumns[table.name].map((col) => {
                        const TypeIcon = getTypeIcon(col.type)
                        return (
                          <div 
                            key={col.name}
                            className={clsx('flex items-center gap-2 px-2 py-1 rounded text-xs', theme.contentTextMuted)}
                          >
                            {col.isPrimaryKey ? (
                              <span className="text-amber-500 text-[10px] font-bold">PK</span>
                            ) : (
                              <TypeIcon className="h-3 w-3" />
                            )}
                            <span className={clsx(theme.contentText)}>{col.name}</span>
                            <span className="text-[10px]">{col.type}</span>
                            {col.clickhouseType && (
                              <span className="ml-auto text-[10px] text-emerald-500">→ {col.clickhouseType}</span>
                            )}
    </div>
  )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SQL Editor & Results */}
          <div className="col-span-9 space-y-4">
            {/* Editor */}
            <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
              <div className={clsx('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
                <div className="flex items-center gap-2">
                  <Terminal className={clsx('h-4 w-4', theme.contentTextMuted)} />
                  <span className={clsx('font-bold text-sm', theme.contentText)}>SQL Sorgusu</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={executeQuery}
                    disabled={sqlLoading || !sqlQuery.trim()}
                    className={clsx('flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50', theme.buttonPrimary)}
                  >
                    {sqlLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Çalıştır
                  </button>
                </div>
              </div>

              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM ..."
                rows={6}
                className={clsx(
                  'w-full p-4 font-mono text-sm resize-none focus:outline-none',
                  isDark ? 'bg-slate-900 text-slate-200' : 'bg-slate-50 text-slate-800',
                  'placeholder:text-slate-500'
                )}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                    executeQuery()
                  }
                }}
              />

              <div className={clsx('px-4 py-2 border-t text-xs', isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500')}>
                <kbd className={clsx('px-1.5 py-0.5 rounded', isDark ? 'bg-slate-800' : 'bg-slate-200')}>⌘</kbd> + <kbd className={clsx('px-1.5 py-0.5 rounded', isDark ? 'bg-slate-800' : 'bg-slate-200')}>Enter</kbd> ile çalıştır • Tabloyu çift tıkla → Sorguya ekle
              </div>
            </div>

            {/* Error */}
            {sqlError && (
              <div className={clsx('flex items-start gap-3 p-4 rounded-xl', isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200')}>
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-red-500 text-sm font-medium">Sorgu Hatası</p>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>{sqlError}</p>
                </div>
              </div>
            )}

            {/* Results */}
            {sqlResult && (
              <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
                <div className={clsx('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
                  <div className="flex items-center gap-4">
                    <span className={clsx('font-bold text-sm', theme.contentText)}>Sonuçlar</span>
                    <span className={clsx('text-xs', theme.contentTextMuted)}>
                      {sqlResult.rowCount} satır • {sqlResult.executionTime}ms
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className={clsx('p-2 rounded-lg', theme.buttonSecondary)} title="Kopyala">
                      <Copy className={clsx('h-4 w-4', theme.contentTextMuted)} />
                    </button>
                    <button className={clsx('p-2 rounded-lg', theme.buttonSecondary)} title="İndir">
                      <Download className={clsx('h-4 w-4', theme.contentTextMuted)} />
                    </button>
                    <button 
                      onClick={() => setShowDatasetModal(true)}
                      className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium', isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200')}
                    >
                      <Save className="h-4 w-4" />
                      Clixer'a Kaydet
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full">
                    <thead className={clsx('sticky top-0', isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                      <tr className={clsx('text-left text-xs font-bold uppercase tracking-wider', isDark ? 'text-slate-500' : 'text-slate-500')}>
                        {sqlResult.columns.map((col) => (
                          <th key={col.name} className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {col.name}
                              {col.clickhouseType && (
                                <span className="text-[10px] font-normal text-emerald-500 normal-case">
                                  {col.clickhouseType}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                      {sqlResult.rows.map((row, i) => (
                        <tr key={i} className={clsx('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                          {sqlResult.columns.map((col) => (
                            <td key={col.name} className={clsx('px-4 py-3 text-sm', theme.contentText)}>
                              {row[col.name] === null ? (
                                <span className={clsx('text-xs', theme.contentTextMuted)}>NULL</span>
                              ) : typeof row[col.name] === 'object' ? (
                                JSON.stringify(row[col.name])
                              ) : (
                                String(row[col.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Type mapping info */}
                <div className={clsx('px-4 py-3 border-t', isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50')}>
                  <p className={clsx('text-xs', theme.contentTextMuted)}>
                    <Zap className="h-3 w-3 inline mr-1 text-amber-500" />
                    Kolonlar otomatik olarak Clixer tiplerine dönüştürülür. "Clixer'a Kaydet" ile bu veriyi dataset olarak kaydedin.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ETL WORKER STATUS PANEL */}
      {/* ============================================ */}
      {activeTab === 'datasets' && (
        <div className={clsx('rounded-2xl p-4 mb-4 flex items-center justify-between', 
          workerStatus?.status === 'running' 
            ? (isDark ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200')
            : (isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200')
        )}>
          <div className="flex items-center gap-4">
            <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center', 
              workerStatus?.status === 'running'
                ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')
                : (isDark ? 'bg-red-500/20' : 'bg-red-100')
            )}>
              <Zap className={clsx('h-5 w-5', 
                workerStatus?.status === 'running' ? 'text-emerald-500' : 'text-red-500'
              )} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className={clsx('font-bold', theme.contentText)}>ETL Worker</h4>
                <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium',
                  workerStatus?.status === 'running'
                    ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600')
                    : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')
                )}>
                  {workerStatus?.status === 'running' ? '● Çalışıyor' : '○ Durduruldu'}
                </span>
                {workerStatus?.activeJobs > 0 && (
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs font-medium animate-pulse',
                    isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600'
                  )}>
                    {workerStatus.activeJobs} aktif iş
                  </span>
                )}
              </div>
              <p className={clsx('text-xs', theme.contentTextMuted)}>
                {workerStatus?.lastHeartbeat 
                  ? `Son sinyal: ${new Date(workerStatus.lastHeartbeat).toLocaleTimeString('tr-TR')}`
                  : 'Sinyal alınamıyor'
                }
                {workerStatus?.workerInfo?.uptime && (
                  <span className="ml-2">• Çalışma süresi: {Math.floor(workerStatus.workerInfo.uptime / 60)} dk</span>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={loadWorkerStatus}
              className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
              title="Durumu Yenile"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={triggerAllSync}
              disabled={triggeringAll || workerStatus?.status !== 'running'}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50',
                isDark ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              {triggeringAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Tümünü Sync Et
            </button>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* DATASETS TAB */}
      {/* ============================================ */}
      {activeTab === 'datasets' && (
        <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
          <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <h3 className={clsx('font-bold', theme.contentText)}>Dataset'ler</h3>
            <button 
              onClick={() => setShowDatasetModal(true)}
              className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium', isDark ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200')}
            >
              <Plus className="h-4 w-4" />
              Yeni Dataset
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={clsx('text-left text-xs font-bold uppercase tracking-wider', isDark ? 'border-b border-slate-800 text-slate-500' : 'border-b border-slate-200 text-slate-500')}>
                  <th className="px-6 py-3">Dataset</th>
                  <th className="px-6 py-3">Clixer Tablo</th>
                  <th className="px-6 py-3">Strateji</th>
                  <th className="px-6 py-3">Son Sync</th>
                  <th className="px-6 py-3">Satır</th>
                  <th className="px-6 py-3">Durum</th>
                  <th className="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                {datasets.map((dataset) => {
                  const StatusIcon = getStatusIcon(dataset.status)
                  return (
                    <tr key={dataset.id} className={clsx('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
                            <Table className="h-4 w-4 text-blue-500" />
                          </div>
                          <div>
                            <span className={clsx('font-medium', theme.contentText)}>{dataset.name}</span>
                            {dataset.connection_name && (
                              <p className={clsx('text-xs', theme.contentTextMuted)}>{dataset.connection_name}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <code className={clsx('px-2 py-1 rounded text-xs font-mono', isDark ? 'bg-slate-800' : 'bg-slate-100', theme.contentText)}>
                          {dataset.clickhouse_table}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx('text-sm', theme.contentTextMuted)}>{dataset.sync_strategy}</span>
                        {dataset.sync_schedule && (
                          <span className={clsx('text-xs ml-2 px-1.5 py-0.5 rounded', isDark ? 'bg-slate-800' : 'bg-slate-100', theme.contentTextMuted)}>
                            {dataset.sync_schedule}
                          </span>
                        )}
                      </td>
                      <td className={clsx('px-6 py-4 text-sm', theme.contentTextMuted)}>
                        {dataset.last_sync_at ? formatTimeAgo(dataset.last_sync_at) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx('font-mono text-sm', theme.contentText)}>
                          {(dataset.total_rows || dataset.last_sync_rows)?.toLocaleString() || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className={clsx(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium w-fit',
                            getStatusColor(dataset.status)
                          )}>
                            <StatusIcon className="h-3 w-3" />
                            {dataset.status === 'active' ? 'Aktif' : 
                             dataset.status === 'error' ? 'Hata' :
                             dataset.status === 'syncing' ? 'Senkronize...' :
                             dataset.status === 'pending' ? 'Bekliyor' : dataset.status}
                          </div>
                          {dataset.status === 'error' && dataset.status_message && (
                            <p className={clsx('text-xs max-w-[200px] truncate', isDark ? 'text-red-400' : 'text-red-600')} title={translateErrorMessage(dataset.status_message)}>
                              {translateErrorMessage(dataset.status_message)}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => triggerSync(dataset.id)}
                            disabled={syncingDatasetId === dataset.id}
                            className={clsx(
                              'p-2 rounded-lg transition-all',
                              theme.buttonSecondary,
                              syncingDatasetId === dataset.id && 'opacity-50 cursor-not-allowed'
                            )} 
                            title={syncingDatasetId === dataset.id ? 'Sync başlatılıyor...' : 'Şimdi Sync Et'}
                          >
                            {syncingDatasetId === dataset.id ? (
                              <Loader2 className="h-4 w-4 text-emerald-500 animate-spin" />
                            ) : (
                            <Play className="h-4 w-4 text-emerald-500" />
                            )}
                          </button>
                          <button 
                            onClick={() => handlePreviewDataset(dataset)}
                            className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)} 
                            title="Önizle"
                          >
                            <Eye className={clsx('h-4 w-4', theme.contentTextMuted)} />
                          </button>
                          <button 
                            onClick={() => handleSettingsDataset(dataset)}
                            className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)} 
                            title="Ayarlar"
                          >
                            <Settings className={clsx('h-4 w-4', theme.contentTextMuted)} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* ETL HISTORY TAB */}
      {/* ============================================ */}
      {activeTab === 'etl' && (
        <div className="space-y-6">
          {/* SCHEDULER CONTROL PANEL */}
          <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
            <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className={clsx('font-bold', theme.contentText)}>Zamanlanmış Görevler</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    {schedules.filter(s => s.is_active).length} aktif schedule
                  </p>
                </div>
              </div>
              <button
                onClick={loadSchedules}
                className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6">
              {schedules.filter(s => s.is_active).length === 0 ? (
                <div className={clsx('text-center py-8', theme.contentTextMuted)}>
                  <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>Aktif zamanlanmış görev yok</p>
                  <p className="text-sm mt-1">Dataset ayarlarından schedule ekleyebilirsiniz</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {schedules.filter(s => s.is_active).map((schedule) => (
                    <div 
                      key={schedule.id}
                      className={clsx(
                        'p-4 rounded-xl border flex items-center justify-between',
                        isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div className={clsx(
                          'w-3 h-3 rounded-full',
                          schedule.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                        )} />
                        <div>
                          <p className={clsx('font-medium', theme.contentText)}>
                            {schedule.dataset_name || 'Dataset'}
                          </p>
                          <p className={clsx('text-xs', theme.contentTextMuted)}>
                            {(schedule.cron_expression === '* * * * *' || schedule.cron_expression === '1m') && '⚡ Her dakika'}
                            {(schedule.cron_expression === '*/5 * * * *' || schedule.cron_expression === '5m') && '🕐 Her 5 dakika'}
                            {(schedule.cron_expression === '*/15 * * * *' || schedule.cron_expression === '15m') && '🕐 Her 15 dakika'}
                            {(schedule.cron_expression === '*/30 * * * *' || schedule.cron_expression === '30m') && '🕐 Her 30 dakika'}
                            {(schedule.cron_expression === '0 * * * *' || schedule.cron_expression === '1h') && '⏰ Her saat başı'}
                            {(schedule.cron_expression === '0 3 * * *' || schedule.cron_expression === 'daily') && '🌙 Her gün 03:00'}
                            {!['* * * * *', '*/5 * * * *', '*/15 * * * *', '*/30 * * * *', '0 * * * *', '0 3 * * *', '1m', '5m', '15m', '30m', '1h', 'daily', 'manual'].includes(schedule.cron_expression) && 
                              `📅 ${schedule.cron_expression}`}
                            {schedule.last_run_at && (
                              <span className="ml-2">
                                | Son: {new Date(schedule.last_run_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {/* Interval Selector */}
                        <select
                          value={cronToShortCode(schedule.cron_expression)}
                          onChange={(e) => updateScheduleInterval(schedule.dataset_id, e.target.value)}
                          className={clsx('px-3 py-1.5 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        >
                          <option value="1m">⚡ 1 dk (Test)</option>
                          <option value="5m">Her 5 dk</option>
                          <option value="15m">Her 15 dk</option>
                          <option value="30m">Her 30 dk</option>
                          <option value="1h">Saatlik</option>
                          <option value="daily">Günlük</option>
                          <option value="manual">Manuel</option>
                        </select>

                        {/* Toggle Button */}
                        <button
                          onClick={() => toggleSchedule(schedule.id, !schedule.is_active)}
                          className={clsx(
                            'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                            schedule.is_active 
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-200 text-slate-600 hover:bg-slate-300')
                          )}
                        >
                          {schedule.is_active ? 'Aktif' : 'Pasif'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ETL JOBS HISTORY */}
          <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
            <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
              <h3 className={clsx('font-bold', theme.contentText)}>ETL İşlem Geçmişi</h3>
              <div className="flex items-center gap-2 text-xs">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className={clsx(theme.contentTextMuted)}>Clixer'a veri akışı</span>
              </div>
            </div>

          <div className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
            {etlJobs.map((job) => {
              const StatusIcon = getStatusIcon(job.status)
              return (
                <div key={job.id} className={clsx('px-6 py-4 transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center',
                        job.status === 'completed' ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100') :
                        job.status === 'running' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') :
                        job.status === 'failed' ? (isDark ? 'bg-red-500/20' : 'bg-red-100') : (isDark ? 'bg-amber-500/20' : 'bg-amber-100')
                      )}>
                        <StatusIcon className={clsx(
                          'h-5 w-5',
                          job.status === 'completed' ? 'text-emerald-500' :
                          job.status === 'running' ? 'text-blue-500 animate-spin' :
                          job.status === 'failed' ? 'text-red-500' : 'text-amber-500'
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={clsx('font-medium', theme.contentText)}>{job.dataset_name || 'Dataset'}</span>
                          <ArrowRight className={clsx('h-3 w-3', theme.contentTextMuted)} />
                          <span className={clsx('text-sm', theme.contentTextMuted)}>Clixer</span>
                        </div>
                        <p className={clsx('text-xs mt-0.5', theme.contentTextMuted)}>
                          {job.action === 'initial_sync' ? 'İlk Sync' :
                           job.action === 'incremental_sync' ? 'Artımlı Sync' :
                           job.action === 'full_refresh' ? 'Tam Yenileme' :
                           job.action === 'manual_sync' ? 'Manuel Sync' : job.action}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      {/* Progress Info - Running/Pending job'lar için her zaman göster */}
                      {(job.status === 'running' || job.status === 'pending') ? (
                        <div className="min-w-[180px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className={clsx('text-xs font-medium', theme.contentText)}>
                              {(job.rows_processed || 0).toLocaleString()} {job.row_limit ? `/ ${job.row_limit.toLocaleString()}` : 'satır'}
                            </span>
                            {job.row_limit && (
                              <span className={clsx('text-xs font-bold', 'text-blue-500')}>
                                {job.rows_processed 
                                  ? `${Math.min(99, Math.round((job.rows_processed / job.row_limit) * 100))}%`
                                  : '0%'}
                              </span>
                            )}
                          </div>
                          <div className={clsx('h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
                            {job.rows_processed === 0 || !job.rows_processed ? (
                              /* Indeterminate - kaynaktan çekiliyor */
                              <div 
                                className="h-full w-1/3 bg-gradient-to-r from-blue-500 via-teal-500 to-blue-500 rounded-full animate-pulse"
                                style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                              />
                            ) : job.row_limit ? (
                              /* Determinate - yüzde göster */
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, (job.rows_processed / job.row_limit) * 100)}%` }}
                              />
                            ) : (
                              /* row_limit yok ama rows_processed var - sürekli hareket */
                              <div 
                                className="h-full w-2/3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                                style={{ animation: 'shimmer 2s ease-in-out infinite' }}
                              />
                            )}
                          </div>
                          <p className={clsx('text-xs mt-1 flex items-center gap-1', theme.contentTextMuted)}>
                            {/* STUCK JOB UYARISI */}
                            {isJobStuck(job) ? (
                              <span className="flex items-center gap-2 text-amber-500">
                                <AlertCircle className="w-3 h-3" />
                                <span>Yanıt alınamıyor!</span>
                                <button
                                  onClick={async () => {
                                    if (confirm('Bu işlemi iptal etmek istediğinize emin misiniz?')) {
                                      try {
                                        await apiCall(`/data/etl-jobs/${job.id}/kill`, { method: 'POST' })
                                        loadETLJobs()
                                      } catch (e) {
                                        console.error('Cancel error:', e)
                                      }
                                    }
                                  }}
                                  className="px-2 py-0.5 bg-amber-500 text-white rounded text-xs hover:bg-amber-600"
                                >
                                  Temizle
                                </button>
                              </span>
                            ) : job.rows_processed && job.rows_processed > 0 ? (
                              job.row_limit && job.started_at ? (() => {
                                const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000;
                                const rate = job.rows_processed / elapsed;
                                const remaining = job.row_limit - job.rows_processed;
                                const eta = remaining / rate;
                                return eta > 60 
                                  ? `~${Math.round(eta / 60)} dk kaldı` 
                                  : `~${Math.round(eta)} sn kaldı`;
                              })() : (
                                <>
                                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Clixer'a yazılıyor...
                                </>
                              )
                            ) : (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                Kaynaktan veri çekiliyor...
                              </>
                            )}
                          </p>
                        </div>
                      ) : (
                      <div className="text-right">
                        <p className={clsx('font-mono font-medium', theme.contentText)}>
                          {job.rows_processed?.toLocaleString() || '-'}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>satır</p>
                      </div>
                      )}
                      <div className="text-right min-w-[120px]">
                        <p className={clsx(theme.contentTextMuted)}>
                          {job.started_at ? formatTimeAgo(job.started_at, true) : '-'}
                        </p>
                        {job.completed_at && job.started_at && (
                          <p className={clsx('text-xs font-medium', theme.contentTextMuted)}>
                            {formatDuration(Math.round((new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000))}
                          </p>
                        )}
                      </div>
                      <div className={clsx(
                        'px-2.5 py-1 rounded-lg text-xs font-medium min-w-[80px] text-center',
                        getStatusColor(job.status)
                      )}>
                        {job.status === 'completed' ? 'Tamamlandı' :
                         job.status === 'running' ? 'Çalışıyor' :
                         job.status === 'failed' ? 'Hata' :
                         job.status === 'cancelled' ? 'İptal' :
                         job.status === 'skipped' ? 'Atlandı' :
                         job.status === 'pending' ? 'Bekliyor' : job.status}
                      </div>
                      
                      {/* Kill Button - sadece pending veya running job'lar için */}
                      {(job.status === 'pending' || job.status === 'running') && (
                        <button
                          onClick={async () => {
                            if (!confirm(`"${job.dataset_name}" için çalışan sync işlemini iptal etmek istediğinize emin misiniz?`)) return;
                            try {
                              await apiCall(`/data/etl-jobs/${job.id}/kill`, { method: 'POST' });
                              // ETL jobs listesini yenile
                              loadETLJobs();
                            } catch (err: any) {
                              alert(err instanceof Error ? err.message : 'İptal işlemi başarısız');
                            }
                          }}
                          className={clsx(
                            'p-2 rounded-lg transition-colors',
                            isDark 
                              ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400' 
                              : 'bg-red-100 hover:bg-red-200 text-red-600'
                          )}
                          title="İşlemi İptal Et"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {job.error_message && (
                    <div className={clsx(
                      'mt-3 ml-14 p-3 rounded-lg text-sm flex items-start gap-2',
                      // Verification warning (Kaynak: ile başlıyorsa) = amber/sarı
                      // Hata mesajı = kırmızı
                      job.error_message.startsWith('Kaynak:') 
                        ? (isDark ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-200')
                        : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                    )}>
                      {job.error_message.startsWith('Kaynak:') ? (
                        <>
                          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">📊 Count Verification</span>
                            <p className="mt-1 text-xs opacity-80">{job.error_message}</p>
                          </div>
                        </>
                      ) : (
                        <>{job.error_message}</>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {etlJobs.length === 0 && (
              <div className="p-12 text-center">
                <Zap className={clsx('h-12 w-12 mx-auto mb-4', theme.contentTextMuted)} />
                <h3 className={clsx('text-lg font-bold mb-2', theme.contentText)}>Henüz ETL İşlemi Yok</h3>
                <p className={clsx('text-sm', theme.contentTextMuted)}>
                  Dataset oluşturduğunuzda ilk senkronizasyon otomatik başlar.
                </p>
              </div>
            )}
          </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* CLICKHOUSE TAB */}
      {/* ============================================ */}
      {activeTab === 'clickhouse' && (
        <div className="space-y-6">
          {/* Header */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Zap className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className={clsx('text-xl font-bold', theme.contentText)}>Clixer Veri Yönetimi</h2>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Analitik tablolarınızı görüntüleyin ve yönetin
                  </p>
                </div>
              </div>
              
              <button
                onClick={loadClickhouseTables}
                disabled={clickhouseLoading}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all', theme.buttonPrimary)}
              >
                <RefreshCw className={clsx('w-4 h-4', clickhouseLoading && 'animate-spin')} />
                Yenile
              </button>
            </div>
            
            {/* Özet İstatistikler */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
              <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
                <p className={clsx('text-2xl font-bold', theme.contentText)}>{clickhouseTables.length}</p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Tablo</p>
              </div>
              <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
                <p className={clsx('text-2xl font-bold', theme.contentText)}>
                  {clickhouseTables.reduce((acc, t) => acc + (t.total_rows || 0), 0).toLocaleString('tr-TR')}
                </p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Satır</p>
              </div>
              <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
                <p className={clsx('text-2xl font-bold', theme.contentText)}>
                  {clickhouseTables.reduce((acc, t) => acc + (t.total_bytes || 0), 0) > 1024*1024*1024 
                    ? `${(clickhouseTables.reduce((acc, t) => acc + (t.total_bytes || 0), 0) / (1024*1024*1024)).toFixed(2)} GB`
                    : `${(clickhouseTables.reduce((acc, t) => acc + (t.total_bytes || 0), 0) / (1024*1024)).toFixed(2)} MB`
                  }
                </p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Boyut</p>
              </div>
              <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
                <p className={clsx('text-2xl font-bold text-amber-500')}>{clickhouseTables.filter(t => t.isOrphan).length}</p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Orphan Tablo</p>
              </div>
            </div>
          </div>
          
          {/* Tablo Listesi */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <h3 className={clsx('text-lg font-bold mb-4', theme.contentText)}>Tablolar</h3>
            
            {clickhouseLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
              </div>
            ) : clickhouseTables.length === 0 ? (
              <div className={clsx('text-center py-12', theme.contentTextMuted)}>
                Henüz tablo yok
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={clsx('text-left text-sm', theme.contentTextMuted)}>
                      <th className="pb-3 font-medium">Tablo</th>
                      <th className="pb-3 font-medium">Dataset</th>
                      <th className="pb-3 font-medium text-right">Satır</th>
                      <th className="pb-3 font-medium text-right">Boyut</th>
                      <th className="pb-3 font-medium">Engine</th>
                      <th className="pb-3 font-medium text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {clickhouseTables.map((table: any) => (
                      <tr key={table.name} className={clsx('hover:bg-slate-50 dark:hover:bg-slate-800/50')}>
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            {table.isOrphan && (
                              <span className="w-2 h-2 rounded-full bg-amber-500" title="Dataset bağlantısı yok" />
                            )}
                            <span className={clsx('font-mono text-sm', theme.contentText)}>{table.name}</span>
                          </div>
                        </td>
                        <td className="py-3">
                          <span className={clsx('text-sm', table.datasetName ? theme.contentText : theme.contentTextMuted)}>
                            {table.datasetName || '-'}
                          </span>
                        </td>
                        <td className={clsx('py-3 text-right font-mono text-sm', theme.contentText)}>
                          {(table.total_rows || 0).toLocaleString('tr-TR')}
                        </td>
                        <td className={clsx('py-3 text-right text-sm', theme.contentText)}>
                          {table.readable_size || '0 B'}
                        </td>
                        <td className={clsx('py-3 text-sm', theme.contentTextMuted)}>
                          {table.engine}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => viewChTableDetails(table.name)}
                              className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                              title="Detaylar"
                            >
                              <Eye className="w-4 h-4 text-slate-400" />
                            </button>
                            <button
                              onClick={() => optimizeChTable(table.name)}
                              disabled={systemActionLoading === `ch-optimize-${table.name}`}
                              className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                              title="Optimize Et"
                            >
                              {systemActionLoading === `ch-optimize-${table.name}` ? (
                                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                              ) : (
                                <Zap className="w-4 h-4 text-slate-400" />
                              )}
                            </button>
                            <button
                              onClick={() => {
                                // ds_ prefix'li tablolar dataset'e ait - ID'yi çıkar
                                const datasetId = table.name.startsWith('ds_') 
                                  ? table.name.replace('ds_', '').replace(/_/g, '-')
                                  : undefined;
                                openDataManagementModal(table.name, datasetId);
                              }}
                              className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                              title="Veri Yönetimi"
                            >
                              <Calendar className="w-4 h-4 text-cyan-400" />
                            </button>
                            <button
                              onClick={() => truncateChTable(table.name)}
                              disabled={systemActionLoading === `ch-truncate-${table.name}`}
                              className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                              title="Tümünü Temizle"
                            >
                              {systemActionLoading === `ch-truncate-${table.name}` ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-amber-400" />
                              )}
                            </button>
                            {table.isOrphan && (
                              <button
                                onClick={() => deleteChTable(table.name)}
                                disabled={systemActionLoading === `ch-delete-${table.name}`}
                                className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                                title="Tabloyu Sil"
                              >
                                {systemActionLoading === `ch-delete-${table.name}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-rose-400" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-rose-400" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          {/* Tablo Detay Modalı */}
          {showChTableModal && selectedChTable && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className={clsx('w-full max-w-4xl max-h-[90vh] overflow-y-auto m-4 p-6 rounded-2xl', theme.cardBg)}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className={clsx('text-xl font-bold', theme.contentText)}>
                      {selectedChTable.table?.name}
                    </h3>
                    <p className={clsx('text-sm', theme.contentTextMuted)}>
                      {selectedChTable.table?.engine} • {selectedChTable.table?.readable_size}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowChTableModal(false)}
                    className={clsx('p-2 rounded-xl', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Tablo Bilgileri */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Toplam Satır</p>
                    <p className={clsx('text-lg font-bold', theme.contentText)}>
                      {(selectedChTable.table?.total_rows || 0).toLocaleString('tr-TR')}
                    </p>
                  </div>
                  <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Boyut</p>
                    <p className={clsx('text-lg font-bold', theme.contentText)}>
                      {selectedChTable.table?.readable_size}
                    </p>
                  </div>
                </div>
                
                {/* Partition Key & Sorting Key */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>Partition Key</p>
                    <code className={clsx('text-xs p-2 rounded block', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      {selectedChTable.table?.partition_key || 'Yok'}
                    </code>
                  </div>
                  <div>
                    <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>Sorting Key</p>
                    <code className={clsx('text-xs p-2 rounded block', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      {selectedChTable.table?.sorting_key || 'Yok'}
                    </code>
                  </div>
                </div>
                
                {/* Kolonlar */}
                <div className="mb-6">
                  <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>
                    Kolonlar ({selectedChTable.columns?.length || 0})
                  </p>
                  <div className={clsx('p-4 rounded-xl max-h-40 overflow-y-auto', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedChTable.columns?.map((col: any) => (
                        <div key={col.name} className="flex items-center gap-2">
                          <span className={clsx('text-sm font-mono', theme.contentText)}>{col.name}</span>
                          <span className={clsx('text-xs', theme.contentTextMuted)}>({col.type})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Partition'lar */}
                {selectedChTable.partitions && selectedChTable.partitions.length > 0 && (
                  <div className="mb-6">
                    <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>
                      Partition'lar (Son 12)
                    </p>
                    <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {selectedChTable.partitions.map((p: any) => (
                          <div key={p.partition} className={clsx('p-2 rounded text-center', isDark ? 'bg-slate-700' : 'bg-white')}>
                            <p className={clsx('text-sm font-mono', theme.contentText)}>{p.partition}</p>
                            <p className={clsx('text-xs', theme.contentTextMuted)}>
                              {parseInt(p.rows).toLocaleString('tr-TR')} satır
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Örnek Veri */}
                {selectedChTable.sampleData && selectedChTable.sampleData.length > 0 && (
                  <div>
                    <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>
                      Örnek Veri (İlk 5 Satır)
                    </p>
                    <div className={clsx('p-4 rounded-xl overflow-x-auto', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(selectedChTable.sampleData, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Veri Yönetimi Modalı (Tarih Bazlı Silme) */}
          {showDataManagementModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className={clsx('w-full max-w-xl m-4 rounded-2xl', theme.cardBg)}>
                {/* Header */}
                <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className={clsx('font-bold', theme.contentText)}>Veri Yönetimi</h3>
                      <p className={clsx('text-xs', theme.contentTextMuted)}>{dataManagementTable}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowDataManagementModal(false)}
                    className={clsx('p-2 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Tab Buttons */}
                <div className={clsx('px-6 py-3 border-b flex gap-2', isDark ? 'border-slate-700' : 'border-slate-200')}>
                  <button
                    onClick={() => setDmActiveTab('delete')}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      dmActiveTab === 'delete' 
                        ? 'bg-cyan-500 text-white' 
                        : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    🗑️ Tarih Bazlı Sil
                  </button>
                  <button
                    onClick={() => setDmActiveTab('validate')}
                    className={clsx(
                      'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                      dmActiveTab === 'validate' 
                        ? 'bg-cyan-500 text-white' 
                        : isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    )}
                  >
                    📊 Veri Doğrula
                  </button>
                </div>
                
                {/* Body */}
                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                  
                  {/* === VERİ DOĞRULA SEKMESİ === */}
                  {dmActiveTab === 'validate' && (
                    <div className="space-y-4">
                      {/* Dataset ID Uyarısı */}
                      {!dataManagementDatasetId && (
                        <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/50">
                          <p className="text-sm text-amber-400">
                            ⚠️ Bu tablo bir dataset'e bağlı değil. Lütfen Datasets listesinden açın.
                          </p>
                        </div>
                      )}
                      
                      {/* Primary Key Kolon Seçici */}
                      {dataManagementDatasetId && (
                        <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                          <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                            🔑 Primary Key / ID Kolonu
                          </label>
                          <select
                            value={pkColumn}
                            onChange={(e) => {
                              setPkColumn(e.target.value)
                              setComparisonData(null) // Yeni kolon seçilince sonuçları temizle
                              setMissingRanges(null)
                            }}
                            className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputBorder, theme.contentText)}
                          >
                            {dataManagementColumns.length > 0 ? (
                              dataManagementColumns.map((col: any) => (
                                <option key={col.name} value={col.name}>
                                  {col.name} ({col.type})
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="id">id</option>
                                <option value="code">code</option>
                              </>
                            )}
                          </select>
                          <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>
                            Kaynak ve ClickHouse karşılaştırması bu kolona göre yapılacak
                          </p>
                        </div>
                      )}
                      
                      {/* Karşılaştırma Butonu */}
                      {dataManagementDatasetId && (
                        <>
                          <div className="flex gap-2">
                            <button
                              onClick={loadComparison}
                              disabled={validationLoading}
                              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                            >
                              {validationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                              Kaynak-Hedef Karşılaştır
                            </button>
                            <button
                              onClick={loadDuplicateAnalysis}
                              disabled={validationLoading}
                              className={clsx('px-4 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2', isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300')}
                            >
                              <Copy className="w-4 h-4" />
                              Duplicate
                            </button>
                          </div>
                          
                          {/* Karşılaştırma Sonuçları */}
                          {comparisonData && (
                            <div className="space-y-3">
                              {/* Kaynak Bağlantı Hatası Uyarısı */}
                              {comparisonData.source?.error && (
                                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50">
                                  <p className="text-sm font-medium text-red-400">
                                    ❌ Kaynak veritabanına bağlanılamadı:
                                  </p>
                                  <p className="text-xs text-red-300 mt-1 font-mono break-all">
                                    {comparisonData.source.error}
                                  </p>
                                </div>
                              )}
                              
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className={clsx('border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
                                    <th className={clsx('py-2 text-left', theme.contentTextMuted)}>Metrik</th>
                                    <th className={clsx('py-2 text-right', theme.contentTextMuted)}>Kaynak ({comparisonData.dataset.connection_type})</th>
                                    <th className={clsx('py-2 text-right', theme.contentTextMuted)}>ClickHouse</th>
                                  </tr>
                                </thead>
                                <tbody className={theme.contentText}>
                                  <tr className={clsx('border-b', isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                                    <td className="py-2">Toplam Satır</td>
                                    <td className={clsx('py-2 text-right font-mono', comparisonData.source?.error && 'text-red-400')}>
                                      {comparisonData.source?.error ? '⚠️ Hata' : comparisonData.source.total_rows.toLocaleString('tr-TR')}
                                    </td>
                                    <td className="py-2 text-right font-mono">{comparisonData.clickhouse.total_rows.toLocaleString('tr-TR')}</td>
                                  </tr>
                                  <tr className={clsx('border-b', isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                                    <td className="py-2">Min ID</td>
                                    <td className={clsx('py-2 text-right font-mono', comparisonData.source?.error && 'text-red-400')}>
                                      {comparisonData.source?.error ? '-' : comparisonData.source.min_id.toLocaleString('tr-TR')}
                                    </td>
                                    <td className="py-2 text-right font-mono">{comparisonData.clickhouse.min_id.toLocaleString('tr-TR')}</td>
                                  </tr>
                                  <tr className={clsx('border-b', isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                                    <td className="py-2">Max ID</td>
                                    <td className={clsx('py-2 text-right font-mono', comparisonData.source?.error && 'text-red-400')}>
                                      {comparisonData.source?.error ? '-' : comparisonData.source.max_id.toLocaleString('tr-TR')}
                                    </td>
                                    <td className="py-2 text-right font-mono">{comparisonData.clickhouse.max_id.toLocaleString('tr-TR')}</td>
                                  </tr>
                                </tbody>
                              </table>
                              
                              {/* Fark Özeti */}
                              <div className={clsx('p-3 rounded-xl', comparisonData.diff.row_difference === 0 ? 'bg-green-500/20 border border-green-500/50' : 'bg-amber-500/20 border border-amber-500/50')}>
                                <p className={clsx('text-sm font-medium', comparisonData.diff.row_difference === 0 ? 'text-green-400' : 'text-amber-400')}>
                                  {comparisonData.diff.row_difference === 0 
                                    ? '✅ Satır sayıları eşit!' 
                                    : `⚠️ Fark: ${Math.abs(comparisonData.diff.row_difference).toLocaleString('tr-TR')} satır ${comparisonData.diff.row_difference > 0 ? '(Kaynakta fazla)' : '(ClickHouse\'da fazla - duplicate?)'}`
                                  }
                                </p>
                                {comparisonData.diff.has_duplicates && (
                                  <p className="text-xs text-red-400 mt-1">🔴 Duplicate tespit edildi!</p>
                                )}
                              </div>
                              
                              {/* Eksik veri varsa aksiyonlar */}
                              {comparisonData.diff.row_difference > 0 && (
                                <div className="grid grid-cols-2 gap-2">
                                  {/* 🚀 Hızlı Yöntem: Sadece yeni kayıtları çek */}
                                  <button
                                    onClick={syncNewRecordsOnly}
                                    disabled={validationLoading}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                                    title="100M+ tablolar için önerilen! Max ID'den sonraki tüm kayıtları çeker."
                                  >
                                    {validationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    🚀 Yeni Kayıtları Çek
                                  </button>
                                  
                                  {/* Detaylı Yöntem: Eksik aralıkları bul */}
                                  <button
                                    onClick={loadMissingRanges}
                                    disabled={validationLoading}
                                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                                    title="Ortadaki boşlukları bulur. 10M+ tablolarda yavaş olabilir."
                                  >
                                    {validationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                    Eksik Aralıkları Bul
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          
                          {/* Eksik Aralıklar */}
                          {missingRanges && (
                            <div className="space-y-3">
                              <p className={clsx('text-sm font-medium', theme.contentText)}>
                                Eksik ID Aralıkları ({missingRanges.missing_ranges.length} aralık, ~{missingRanges.total_missing_estimate.toLocaleString('tr-TR')} satır)
                              </p>
                              <div className={clsx('max-h-40 overflow-y-auto rounded-xl p-3', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                                {missingRanges.missing_ranges.slice(0, 20).map((range: any, idx: number) => (
                                  <div key={idx} className="flex justify-between text-xs font-mono py-1">
                                    <span className={theme.contentTextMuted}>ID {range.start.toLocaleString('tr-TR')} - {range.end.toLocaleString('tr-TR')}</span>
                                    <span className="text-amber-400">~{range.missing_count.toLocaleString('tr-TR')} eksik</span>
                                  </div>
                                ))}
                              </div>
                              
                              <button
                                onClick={syncMissingData}
                                disabled={validationLoading}
                                className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                              >
                                {validationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                Eksik Verileri Çek
                              </button>
                            </div>
                          )}
                          
                          {/* Duplicate Analizi */}
                          {duplicateAnalysis && (
                            <div className={clsx('p-4 rounded-xl space-y-2', duplicateAnalysis.duplicate_estimate > 0 ? 'bg-red-500/20 border border-red-500/50' : 'bg-green-500/20 border border-green-500/50')}>
                              <p className={clsx('font-medium', duplicateAnalysis.duplicate_estimate > 0 ? 'text-red-400' : 'text-green-400')}>
                                {duplicateAnalysis.duplicate_estimate > 0 
                                  ? `🔴 ~${duplicateAnalysis.duplicate_estimate.toLocaleString('tr-TR')} duplicate satır (${duplicateAnalysis.duplicate_percentage}%)`
                                  : '✅ Duplicate bulunamadı'
                                }
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className={theme.contentTextMuted}>Toplam: {duplicateAnalysis.total_rows.toLocaleString('tr-TR')}</div>
                                <div className={theme.contentTextMuted}>Unique beklenen: {duplicateAnalysis.expected_unique.toLocaleString('tr-TR')}</div>
                              </div>
                              {duplicateAnalysis.can_optimize && (
                                <button
                                  onClick={() => optimizeChTable(dataManagementTable)}
                                  disabled={!!systemActionLoading}
                                  className="w-full mt-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium"
                                >
                                  {systemActionLoading === `ch-optimize-${dataManagementTable}` ? 'Optimizing...' : 'OPTIMIZE TABLE (Duplicate Temizle)'}
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  
                  {/* === TARİH BAZLI SİL SEKMESİ === */}
                  {dmActiveTab === 'delete' && (
                    <>
                  {/* Tarih Kolonu Seçimi */}
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                      Tarih Kolonu
                    </label>
                    <select
                      value={dmDateColumn}
                      onChange={(e) => setDmDateColumn(e.target.value)}
                      className={clsx('w-full px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                    >
                      <option value="">Seçiniz...</option>
                      {dataManagementColumns.filter(c => c.isDateColumn).map((col: any) => (
                        <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                      ))}
                      {/* Tüm kolonları göster (tarih olmasa bile) */}
                      <optgroup label="Diğer Kolonlar">
                        {dataManagementColumns.filter(c => !c.isDateColumn).map((col: any) => (
                          <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  
                  {/* Silme Modu */}
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                      Silme Yöntemi
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteMode"
                          checked={dmDeleteMode === 'days'}
                          onChange={() => setDmDeleteMode('days')}
                          className="w-4 h-4 text-cyan-500"
                        />
                        <span className={clsx('text-sm', theme.contentText)}>Son X Gün</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteMode"
                          checked={dmDeleteMode === 'range'}
                          onChange={() => setDmDeleteMode('range')}
                          className="w-4 h-4 text-cyan-500"
                        />
                        <span className={clsx('text-sm', theme.contentText)}>Tarih Aralığı</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Son X Gün */}
                  {dmDeleteMode === 'days' && (
                    <div>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                        Son Kaç Gün?
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={dmDays}
                          onChange={(e) => setDmDays(parseInt(e.target.value) || 0)}
                          min={0}
                          className={clsx('w-24 px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                        />
                        <span className={clsx('text-sm', theme.contentTextMuted)}>gün</span>
                        <div className="flex gap-2 ml-auto">
                          {[1, 3, 7, 14, 30].map(d => (
                            <button
                              key={d}
                              onClick={() => setDmDays(d)}
                              className={clsx(
                                'px-3 py-1 rounded-lg text-sm',
                                dmDays === d 
                                  ? 'bg-cyan-500 text-white' 
                                  : isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300',
                                theme.contentText
                              )}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Tarih Aralığı */}
                  {dmDeleteMode === 'range' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                          Başlangıç
                        </label>
                        <input
                          type="date"
                          value={dmStartDate}
                          onChange={(e) => setDmStartDate(e.target.value)}
                          className={clsx('w-full px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                        />
                      </div>
                      <div>
                        <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                          Bitiş
                        </label>
                        <input
                          type="date"
                          value={dmEndDate}
                          onChange={(e) => setDmEndDate(e.target.value)}
                          className={clsx('w-full px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                        />
                      </div>
                    </div>
                  )}
                  
                  {/* Önizleme Butonu */}
                  <button
                    onClick={previewDataManagementDelete}
                    disabled={!dmDateColumn || dataManagementLoading}
                    className={clsx(
                      'w-full py-3 rounded-xl font-medium flex items-center justify-center gap-2',
                      !dmDateColumn || dataManagementLoading 
                        ? 'opacity-50 cursor-not-allowed bg-slate-500' 
                        : 'bg-cyan-500 hover:bg-cyan-600',
                      'text-white'
                    )}
                  >
                    {dataManagementLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                    Önizle - Kaç Satır Silinecek?
                  </button>
                  
                  {/* Önizleme Sonucu */}
                  {dataManagementPreview && (
                    <div className={clsx(
                      'p-4 rounded-xl',
                      dataManagementPreview.rowsToDelete > 0 
                        ? 'bg-amber-500/20 border border-amber-500/30'
                        : 'bg-emerald-500/20 border border-emerald-500/30'
                    )}>
                      <div className="flex items-center gap-3">
                        <AlertTriangle className={clsx(
                          'w-6 h-6',
                          dataManagementPreview.rowsToDelete > 0 ? 'text-amber-500' : 'text-emerald-500'
                        )} />
                        <div>
                          <p className={clsx('font-bold text-lg', theme.contentText)}>
                            {dataManagementPreview.rowsToDelete.toLocaleString('tr-TR')} satır
                          </p>
                          <p className={clsx('text-sm', theme.contentTextMuted)}>
                            Toplam {dataManagementPreview.totalRows.toLocaleString('tr-TR')} satırdan 
                            %{dataManagementPreview.percentageToDelete} silinecek
                          </p>
                        </div>
                      </div>
                      <p className={clsx('text-xs mt-2 font-mono', theme.contentTextMuted)}>
                        WHERE: {dataManagementPreview.whereClause}
                      </p>
                    </div>
                  )}
                    </>
                  )}
                </div>
                
                {/* Footer */}
                <div className={clsx('px-6 py-4 border-t flex items-center justify-end gap-3', isDark ? 'border-slate-700' : 'border-slate-200')}>
                  <button
                    onClick={() => setShowDataManagementModal(false)}
                    className={clsx('px-4 py-2 rounded-xl', theme.buttonSecondary)}
                  >
                    İptal
                  </button>
                  <button
                    onClick={executeDataManagementDelete}
                    disabled={!dataManagementPreview || dataManagementPreview.rowsToDelete === 0 || dataManagementLoading}
                    className={clsx(
                      'px-4 py-2 rounded-xl font-medium flex items-center gap-2',
                      !dataManagementPreview || dataManagementPreview.rowsToDelete === 0 || dataManagementLoading
                        ? 'opacity-50 cursor-not-allowed bg-rose-500'
                        : 'bg-rose-500 hover:bg-rose-600',
                      'text-white'
                    )}
                  >
                    {dataManagementLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Sil
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* SYSTEM HEALTH TAB */}
      {/* ============================================ */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          {/* Header */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={clsx(
                  'w-14 h-14 rounded-2xl flex items-center justify-center',
                  systemHealth?.overall?.status === 'healthy' 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500'
                    : systemHealth?.overall?.status === 'warning'
                    ? 'bg-gradient-to-br from-amber-500 to-orange-500'
                    : 'bg-gradient-to-br from-rose-500 to-red-500'
                )}>
                  <Activity className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className={clsx('text-xl font-bold', theme.contentText)}>Sistem Sağlık Merkezi</h2>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Tüm servislerin durumunu izleyin ve yönetin
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSystemAutoRefresh(!systemAutoRefresh)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                    systemAutoRefresh 
                      ? 'bg-emerald-500/10 text-emerald-500' 
                      : isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  <div className={clsx(
                    'w-2 h-2 rounded-full',
                    systemAutoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  )} />
                  Canlı
                </button>

                <button
                  onClick={() => loadSystemHealth(true)}
                  disabled={systemHealthLoading}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all', theme.buttonPrimary)}
                >
                  <RefreshCw className={clsx('w-4 h-4', systemHealthLoading && 'animate-spin')} />
                  Yenile
                </button>
              </div>
            </div>

            {/* Genel Durum */}
            {systemHealth && (
              <div className={clsx(
                'mt-6 p-4 rounded-xl flex items-center gap-4',
                systemHealth.overall?.status === 'healthy' 
                  ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50')
                  : systemHealth.overall?.status === 'warning'
                  ? (isDark ? 'bg-amber-500/10' : 'bg-amber-50')
                  : (isDark ? 'bg-rose-500/10' : 'bg-rose-50')
              )}>
                {systemHealth.overall?.status === 'healthy' ? (
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                ) : systemHealth.overall?.status === 'warning' ? (
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-500" />
                )}
                <div className="flex-1">
                  <p className={clsx('font-semibold', theme.contentText)}>
                    Genel Durum: {systemHealth.overall?.statusText || 'Bilinmiyor'}
                  </p>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>{systemHealth.overall?.message}</p>
                </div>
                <span className={clsx('text-xs', theme.contentTextMuted)}>
                  Son kontrol: {systemHealth.overall?.timestamp ? new Date(systemHealth.overall.timestamp).toLocaleTimeString('tr-TR') : '-'}
                </span>
              </div>
            )}
          </div>

          {/* Motor Servisleri */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex items-center gap-3 mb-6">
              <div className={clsx('p-2 rounded-xl', isDark ? 'bg-indigo-500/20' : 'bg-indigo-100')}>
                <Server className={clsx('w-5 h-5', isDark ? 'text-indigo-400' : 'text-indigo-600')} />
              </div>
              <div>
                <h3 className={clsx('text-lg font-bold', theme.contentText)}>Motor Servisleri</h3>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Clixer'ı çalıştıran temel servisler</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {systemHealth?.services?.map((service: any) => (
                <div
                  key={service.id}
                  className={clsx(
                    'p-4 rounded-xl border-2 transition-all',
                    service.status === 'down' ? 'border-rose-300 dark:border-rose-500/30' : 'border-transparent',
                    isDark ? 'bg-slate-800/50' : 'bg-slate-50'
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {service.status === 'healthy' ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : service.status === 'degraded' ? (
                        <AlertCircle className="w-5 h-5 text-amber-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-500" />
                      )}
                      <span className={clsx('font-semibold', theme.contentText)}>{service.name}</span>
                    </div>
                    {service.critical && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                        Kritik
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Port</span>
                      <span className={clsx('text-sm font-mono', theme.contentText)}>{service.port}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Durum</span>
                      <span className={clsx('text-sm font-medium', 
                        service.status === 'healthy' ? 'text-emerald-500' : 
                        service.status === 'degraded' ? 'text-amber-500' : 'text-rose-500'
                      )}>
                        {service.statusText}
                      </span>
                    </div>
                    {service.status === 'healthy' && service.responseTime && (
                      <div className="flex items-center justify-between">
                        <span className={clsx('text-sm', theme.contentTextMuted)}>Yanıt</span>
                        <span className={clsx('text-sm', theme.contentText)}>{service.responseTime}ms</span>
                      </div>
                    )}
                    
                    {/* Yeniden Başlat Butonu - Servis durmuşsa veya sorunluysa göster */}
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={async () => {
                          setSystemActionLoading(`restart-${service.id}`)
                          try {
                            const result = await apiCall('/admin/service/restart', {
                              method: 'POST',
                              body: JSON.stringify({ serviceId: service.id })
                            })
                            alert(result.message || `${service.name} yeniden başlatıldı`)
                            // 2 saniye bekle ve durumu yenile
                            setTimeout(() => loadSystemHealth(true), 2000)
                          } catch (err: any) {
                            alert('❌ ' + (err.message || 'Servis başlatılamadı'))
                          } finally {
                            setSystemActionLoading(null)
                          }
                        }}
                        disabled={systemActionLoading === `restart-${service.id}`}
                        className={clsx(
                          'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                          service.status === 'down' 
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                            : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                        )}
                      >
                        {systemActionLoading === `restart-${service.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3 h-3" />
                        )}
                        {service.status === 'down' ? 'Başlat' : 'Yeniden Başlat'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Veritabanları */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex items-center gap-3 mb-6">
              <div className={clsx('p-2 rounded-xl', isDark ? 'bg-violet-500/20' : 'bg-violet-100')}>
                <Database className={clsx('w-5 h-5', isDark ? 'text-violet-400' : 'text-violet-600')} />
              </div>
              <div>
                <h3 className={clsx('text-lg font-bold', theme.contentText)}>Veritabanları</h3>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Veri depolama ve önbellek sistemleri</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ClickHouse */}
              <div className={clsx(
                'p-4 rounded-xl',
                systemHealth?.databases?.clickhouse?.status !== 'healthy' 
                  ? 'border-2 border-amber-500/50 bg-amber-500/10' 
                  : isDark ? 'bg-slate-800/50' : 'bg-slate-50'
              )}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={clsx('font-semibold', theme.contentText)}>Clixer DB</p>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Analitik Veritabanı</p>
                  </div>
                  {systemHealth?.databases?.clickhouse?.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 ml-auto text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 ml-auto text-rose-500" />
                  )}
                </div>
                {systemHealth?.databases?.clickhouse?.status === 'healthy' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Tablo</span>
                      <span className={clsx('text-sm', theme.contentText)}>{systemHealth.databases.clickhouse.tables}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Toplam Satır</span>
                      <span className={clsx('text-sm font-semibold', theme.contentText)}>
                        {systemHealth.databases.clickhouse.totalRows?.toLocaleString('tr-TR')}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Hata Mesajı */}
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                      <p className="text-xs text-rose-600 dark:text-rose-400">
                        {systemHealth?.databases?.clickhouse?.error || 'Clixer DB bağlantısı kurulamadı'}
                      </p>
                    </div>
                    {/* Yeniden Bağlan Butonu */}
                    <button
                      onClick={async () => {
                        setSystemActionLoading('clickhouse-reconnect')
                        try {
                          await apiCall('/admin/clickhouse/reconnect', { method: 'POST' })
                          await loadSystemHealth(true)
                          alert('✅ Clixer DB bağlantısı yenilendi')
                        } catch (e: any) {
                          alert('❌ Clixer DB bağlantısı kurulamadı: ' + e.message)
                        } finally {
                          setSystemActionLoading(null)
                        }
                      }}
                      disabled={systemActionLoading === 'clickhouse-reconnect'}
                      className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600"
                    >
                      {systemActionLoading === 'clickhouse-reconnect' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Yeniden Bağlan
                    </button>
                  </div>
                )}
              </div>

              {/* PostgreSQL */}
              <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                    <HardDrive className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={clsx('font-semibold', theme.contentText)}>PostgreSQL</p>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Ana Veritabanı</p>
                  </div>
                  {systemHealth?.databases?.postgres?.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 ml-auto text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 ml-auto text-rose-500" />
                  )}
                </div>
                {systemHealth?.databases?.postgres?.status === 'healthy' && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Tablo</span>
                      <span className={clsx('text-sm', theme.contentText)}>{systemHealth.databases.postgres.tables}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Redis */}
              <div className={clsx(
                'p-4 rounded-xl',
                systemHealth?.databases?.redis?.status !== 'healthy' 
                  ? 'border-2 border-rose-500/50 bg-rose-500/10' 
                  : isDark ? 'bg-slate-800/50' : 'bg-slate-50'
              )}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                    <Gauge className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className={clsx('font-semibold', theme.contentText)}>Redis</p>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Önbellek</p>
                  </div>
                  {systemHealth?.databases?.redis?.status === 'healthy' ? (
                    <CheckCircle className="w-5 h-5 ml-auto text-emerald-500" />
                  ) : (
                    <XCircle className="w-5 h-5 ml-auto text-rose-500" />
                  )}
                </div>
                
                {systemHealth?.databases?.redis?.status === 'healthy' ? (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Bellek</span>
                      <span className={clsx('text-sm', theme.contentText)}>{systemHealth.databases.redis.memory}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className={clsx('text-sm', theme.contentTextMuted)}>Key Sayısı</span>
                      <span className={clsx('text-sm', theme.contentText)}>{systemHealth.databases.redis.keys?.toLocaleString('tr-TR')}</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-rose-500">
                      ⚠️ {systemHealth?.databases?.redis?.error || 'Bağlantı hatası'}
                    </p>
                    <button
                      onClick={async () => {
                        setSystemActionLoading('redis-reconnect')
                        try {
                          await apiCall('/admin/redis/reconnect', { method: 'POST' })
                          await loadSystemHealth(true)
                          alert('✅ Redis bağlantısı yenilendi')
                        } catch (e: any) {
                          alert('❌ Redis bağlantısı kurulamadı: ' + e.message)
                        } finally {
                          setSystemActionLoading(null)
                        }
                      }}
                      disabled={systemActionLoading === 'redis-reconnect'}
                      className="flex items-center gap-2 w-full justify-center px-3 py-2 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600"
                    >
                      {systemActionLoading === 'redis-reconnect' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Yeniden Bağlan
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ETL Worker Kontrol Paneli */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={clsx(
                  'p-2 rounded-xl',
                  workerStatus?.status === 'running' 
                    ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')
                    : (isDark ? 'bg-rose-500/20' : 'bg-rose-100')
                )}>
                  <Zap className={clsx(
                    'w-5 h-5',
                    workerStatus?.status === 'running' 
                      ? (isDark ? 'text-emerald-400' : 'text-emerald-600')
                      : (isDark ? 'text-rose-400' : 'text-rose-600')
                  )} />
                </div>
                <div>
                  <h3 className={clsx('text-lg font-bold', theme.contentText)}>ETL Worker</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    {workerStatus?.status === 'running' 
                      ? `Çalışıyor • Son sinyal: ${workerStatus?.lastHeartbeat ? new Date(workerStatus.lastHeartbeat).toLocaleTimeString('tr-TR') : '-'}`
                      : 'Durduruldu • Worker çalışmıyor'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {workerStatus?.status === 'running' ? (
                  <>
                    <button
                      onClick={async () => {
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
                      disabled={systemActionLoading === 'worker-restart'}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                        isDark ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30' : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                      )}
                    >
                      {systemActionLoading === 'worker-restart' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Yeniden Başlat
                    </button>
                    <button
                      onClick={async () => {
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
                      disabled={systemActionLoading === 'worker-stop'}
                      className={clsx(
                        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all',
                        isDark ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      )}
                    >
                      {systemActionLoading === 'worker-stop' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Durdur
                    </button>
                  </>
                ) : (
                  <button
                    onClick={async () => {
                      setSystemActionLoading('worker-start')
                      try {
                        await apiCall('/data/etl/worker/start', { method: 'POST' })
                        // Birkaç saniye bekle ve durumu yenile
                        setTimeout(async () => {
                          await loadWorkerStatus()
                          setSystemActionLoading(null)
                        }, 4000)
                      } catch (e: any) {
                        console.error('Worker start error:', e)
                        setSystemActionLoading(null)
                      }
                    }}
                    disabled={systemActionLoading === 'worker-start'}
                    className={clsx(
                      'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                      'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600',
                      'disabled:opacity-50'
                    )}
                  >
                    {systemActionLoading === 'worker-start' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    Worker'ı Başlat
                  </button>
                )}
              </div>
            </div>

            {/* Worker Info */}
            {workerStatus?.workerInfo && (
              <div className={clsx('p-4 rounded-xl mb-6', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>PID</p>
                    <p className={clsx('text-sm font-mono', theme.contentText)}>{workerStatus.workerInfo.pid}</p>
                  </div>
                  <div>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Uptime</p>
                    <p className={clsx('text-sm font-mono', theme.contentText)}>
                      {Math.floor(workerStatus.workerInfo.uptime / 60)}dk {Math.floor(workerStatus.workerInfo.uptime % 60)}sn
                    </p>
                  </div>
                  <div>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Başlama</p>
                    <p className={clsx('text-sm', theme.contentText)}>
                      {new Date(workerStatus.workerInfo.startedAt).toLocaleTimeString('tr-TR')}
                    </p>
                  </div>
                  <div>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>Aktif Job</p>
                    <p className={clsx('text-sm font-bold', workerStatus.activeJobs > 0 ? 'text-amber-500' : theme.contentText)}>
                      {workerStatus.activeJobs}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Stuck Jobs Uyarısı */}
            {/* CRASH UYARISI - Worker durmuş ama job running */}
            {workerStatus?.status !== 'running' && etlMonitoring.runningJobs.length > 0 && (
              <div className={clsx('p-4 rounded-xl border-2 border-rose-500', isDark ? 'bg-rose-500/20' : 'bg-rose-100')}>
                <div className="flex items-center gap-3 mb-2">
                  <XCircle className="w-6 h-6 text-rose-500" />
                  <span className="text-lg font-bold text-rose-500">
                    🚨 ETL Worker Crash Tespit Edildi!
                  </span>
                </div>
                <p className={clsx('text-sm mb-3', theme.contentText)}>
                  Worker durmuş ama {etlMonitoring.runningJobs.length} job hala "çalışıyor" görünüyor. 
                  Bu genellikle <strong>bellek hatası (heap out of memory)</strong> nedeniyle oluşur.
                </p>
                <div className={clsx('p-3 rounded-lg mb-3 font-mono text-xs', isDark ? 'bg-slate-800' : 'bg-white')}>
                  <p className="text-rose-500">Olası sebep: JavaScript heap out of memory</p>
                  <p className={theme.contentTextMuted}>Çözüm: Dataset satır limitini düşürün (5M veya daha az)</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={deleteAllLocks}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600"
                  >
                    <Trash2 className="w-4 h-4" />
                    Lock'ları Temizle
                  </button>
                  <button
                    onClick={async () => {
                      for (const job of etlMonitoring.runningJobs) {
                        await cancelJob(job.id)
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-rose-500 text-white hover:bg-rose-600"
                  >
                    <XCircle className="w-4 h-4" />
                    Job'ları İptal Et
                  </button>
                </div>
              </div>
            )}
            
            {/* STUCK JOBS UYARISI */}
            {etlMonitoring.stuckJobs.length > 0 && (
              <div className={clsx('p-4 rounded-xl border-2 border-rose-500/50', isDark ? 'bg-rose-500/10' : 'bg-rose-50')}>
                <div className="flex items-center gap-3 mb-3">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  <span className={clsx('font-semibold', 'text-rose-500')}>
                    ⚠️ {etlMonitoring.stuckJobs.length} Stuck Job Tespit Edildi!
                  </span>
                  <span className={clsx('text-xs', theme.contentTextMuted)}>
                    (10+ dakikadır çalışan job'lar - Worker crash olmuş olabilir)
                  </span>
                </div>
                <div className="space-y-2">
                  {etlMonitoring.stuckJobs.map((job: any) => (
                    <div key={job.id} className={clsx('flex items-center justify-between p-3 rounded-lg', isDark ? 'bg-slate-800' : 'bg-white')}>
                      <div>
                        <p className={clsx('font-medium text-sm', theme.contentText)}>{job.dataset_name}</p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>
                          {job.runningMinutes} dakikadır çalışıyor • {job.rows_processed?.toLocaleString('tr-TR') || 0} satır işlendi
                        </p>
                      </div>
                      <button
                        onClick={() => cancelJob(job.id)}
                        disabled={systemActionLoading === `job-${job.id}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500 text-white hover:bg-rose-600"
                      >
                        {systemActionLoading === `job-${job.id}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        İptal Et
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Running Jobs */}
            {etlMonitoring.runningJobs.length > 0 && (
              <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <div className="flex items-center gap-3 mb-3">
                  <Play className="w-4 h-4 text-emerald-500" />
                  <span className={clsx('font-medium text-sm', theme.contentText)}>
                    Çalışan/Bekleyen Job'lar ({etlMonitoring.runningJobs.length})
                  </span>
                </div>
                <div className="space-y-3">
                  {etlMonitoring.runningJobs.slice(0, 5).map((job: any) => (
                    <div key={job.id} className={clsx('p-3 rounded-lg', isDark ? 'bg-slate-700/50' : 'bg-white')}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className={clsx(
                            'w-2 h-2 rounded-full',
                            job.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          )} />
                          <span className={clsx('font-medium text-sm', theme.contentText)}>{job.dataset_name}</span>
                          <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-medium',
                            job.status === 'running' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          )}>
                            {job.status === 'running' ? 'Çalışıyor' : 'Bekliyor'}
                          </span>
                        </div>
                        <button
                          onClick={() => cancelJob(job.id)}
                          disabled={systemActionLoading === `job-${job.id}`}
                          className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200')}
                          title="İptal Et"
                        >
                          {systemActionLoading === `job-${job.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                          ) : (
                            <XCircle className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                          )}
                        </button>
                      </div>
                      
                      {/* Progress Info */}
                      <div className="grid grid-cols-3 gap-4 text-xs mb-2">
                        <div>
                          <span className={theme.contentTextMuted}>Süre: </span>
                          <span className={theme.contentText}>{job.runningMinutes || 0} dk</span>
                        </div>
                        <div>
                          <span className={theme.contentTextMuted}>İşlenen: </span>
                          <span className={clsx('font-mono', theme.contentText)}>
                            {(job.rows_processed || 0).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <div>
                          <span className={theme.contentTextMuted}>Hız: </span>
                          <span className={clsx('font-mono', theme.contentText)}>
                            {job.runningMinutes > 0 
                              ? Math.round((job.rows_processed || 0) / (job.runningMinutes * 60)).toLocaleString('tr-TR')
                              : '0'
                            } satır/sn
                          </span>
                        </div>
                      </div>
                      
                      {/* Progress Bar - Veri çekiliyor veya yazılıyor */}
                      {job.status === 'running' && (
                        <div className="space-y-1">
                          {/* Durum mesajı */}
                          <div className="flex items-center gap-2 text-xs">
                            {job.rows_processed === 0 ? (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                <span className={theme.contentTextMuted}>Kaynaktan veri çekiliyor... (bu uzun sürebilir)</span>
                              </>
                            ) : (
                              <>
                                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className={theme.contentTextMuted}>Clixer'a yazılıyor...</span>
                              </>
                            )}
                          </div>
                          
                          {/* Progress Bar */}
                          <div className={clsx('h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
                            {job.rows_processed === 0 ? (
                              /* Indeterminate - sürekli hareket eden */
                              <div 
                                className="h-full w-1/4 bg-gradient-to-r from-blue-500 via-teal-500 to-blue-500 rounded-full"
                                style={{ 
                                  animation: 'shimmer 1.5s ease-in-out infinite',
                                  backgroundSize: '200% 100%'
                                }} 
                              />
                            ) : (
                              /* Determinate - gerçek yüzde */
                              <div 
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                                style={{ width: `${Math.min(100, Math.round((job.rows_processed / 10000000) * 100))}%` }}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Active Locks */}
            {etlMonitoring.locks.length > 0 && (
              <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200')}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <Lock className="w-4 h-4 text-amber-500" />
                    <span className={clsx('font-medium text-sm', theme.contentText)}>
                      Aktif Lock'lar ({etlMonitoring.locks.length})
                    </span>
                  </div>
                  <button
                    onClick={deleteAllLocks}
                    disabled={systemActionLoading === 'all-locks'}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-amber-600 hover:bg-amber-200/50"
                  >
                    {systemActionLoading === 'all-locks' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Tümünü Temizle
                  </button>
                </div>
                <div className="space-y-2">
                  {etlMonitoring.locks.map((lock: any) => (
                    <div key={lock.key} className={clsx('flex items-center justify-between p-2 rounded-lg', isDark ? 'bg-slate-800' : 'bg-white')}>
                      <div>
                        <p className={clsx('text-sm font-mono', theme.contentText)}>{lock.key}</p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>
                          PID: {lock.pid || '?'} • TTL: {lock.ttlSeconds > 0 ? `${Math.floor(lock.ttlSeconds / 60)}dk` : 'Sonsuz'}
                        </p>
                      </div>
                      <button
                        onClick={() => deleteLock(lock.datasetId)}
                        disabled={systemActionLoading === `lock-${lock.datasetId}`}
                        className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-200')}
                        title="Lock'u Sil"
                      >
                        {systemActionLoading === `lock-${lock.datasetId}` ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                        ) : (
                          <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ETL Durumu */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className={clsx('p-2 rounded-xl', isDark ? 'bg-indigo-500/20' : 'bg-indigo-100')}>
                  <RotateCcw className={clsx('w-5 h-5', isDark ? 'text-indigo-400' : 'text-indigo-600')} />
                </div>
                <div>
                  <h3 className={clsx('text-lg font-bold', theme.contentText)}>ETL İstatistikleri</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Veri senkronizasyon işlemleri</p>
                </div>
              </div>

              <button
                onClick={triggerSystemETL}
                disabled={systemActionLoading === 'etl' || workerStatus?.status !== 'running'}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all',
                  workerStatus?.status === 'running'
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed',
                  'disabled:opacity-50'
                )}
                title={workerStatus?.status !== 'running' ? 'ETL Worker çalışmıyor' : ''}
              >
                {systemActionLoading === 'etl' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Tümünü Sync Et
              </button>
            </div>

            {/* ETL Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <p className="text-2xl font-bold text-emerald-500">{systemHealth?.etl?.successful || 0}</p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Başarılı</p>
              </div>
              <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <p className="text-2xl font-bold text-rose-500">{systemHealth?.etl?.failed || 0}</p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Başarısız</p>
              </div>
              <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <p className="text-2xl font-bold text-amber-500">{systemHealth?.etl?.running || 0}</p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Çalışan</p>
              </div>
              <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                <p className={clsx('text-2xl font-bold', systemHealth?.etl?.pendingJobs > 0 ? 'text-amber-500' : theme.contentText)}>{systemHealth?.etl?.pendingJobs || 0}</p>
                <p className={clsx('text-sm', theme.contentTextMuted)}>Bekleyen</p>
              </div>
            </div>
            
            {/* Bekleyen Job Uyarısı */}
            {(systemHealth?.etl?.pendingJobs > 0 || systemHealth?.etl?.running > 0) && (
              <div className={clsx(
                'mt-4 p-4 rounded-xl flex items-center gap-3',
                isDark ? 'bg-amber-500/20 border border-amber-500/30' : 'bg-amber-50 border border-amber-200'
              )}>
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className={clsx('font-medium', isDark ? 'text-amber-400' : 'text-amber-700')}>
                    {systemHealth?.etl?.pendingJobs > 0 
                      ? `${systemHealth.etl.pendingJobs} adet bekleyen ETL job var` 
                      : `${systemHealth?.etl?.running} adet çalışan ETL job var`}
                  </p>
                  <p className={clsx('text-sm', isDark ? 'text-amber-400/70' : 'text-amber-600')}>
                    Yeni sync tetikleyemezsiniz. Tamamlanmasını bekleyin veya "Tümünü İptal Et" butonunu kullanın.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Hızlı Aksiyonlar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => loadSystemHealth(true)}
              className={clsx(
                'p-4 rounded-xl flex items-center gap-3 transition-all',
                theme.cardBg, theme.cardHover
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                <RefreshCw className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className={clsx('font-semibold', theme.contentText)}>Tümünü Yenile</p>
                <p className={clsx('text-xs', theme.contentTextMuted)}>Durumları kontrol et</p>
              </div>
            </button>

            <button
              onClick={clearSystemCache}
              disabled={systemActionLoading === 'cache'}
              className={clsx(
                'p-4 rounded-xl flex items-center gap-3 transition-all',
                theme.cardBg, theme.cardHover,
                'disabled:opacity-50'
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 flex items-center justify-center">
                {systemActionLoading === 'cache' ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Trash2 className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="text-left">
                <p className={clsx('font-semibold', theme.contentText)}>Önbellek Temizle</p>
                <p className={clsx('text-xs', theme.contentTextMuted)}>Veri cache'i temizle (oturumlar korunur)</p>
              </div>
            </button>

            <button
              onClick={triggerSystemETL}
              disabled={systemActionLoading === 'etl'}
              className={clsx(
                'p-4 rounded-xl flex items-center gap-3 transition-all',
                theme.cardBg, theme.cardHover,
                'disabled:opacity-50'
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                {systemActionLoading === 'etl' ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Play className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="text-left">
                <p className={clsx('font-semibold', theme.contentText)}>ETL Başlat</p>
                <p className={clsx('text-xs', theme.contentTextMuted)}>Verileri güncelle</p>
              </div>
            </button>

            {/* Tümünü İptal Et - sadece bekleyen job varsa göster */}
            {(systemHealth?.etl?.pendingJobs > 0 || systemHealth?.etl?.running > 0) && (
              <button
                onClick={cancelAllETLJobs}
                disabled={systemActionLoading === 'cancel'}
                className={clsx(
                  'p-4 rounded-xl flex items-center gap-3 transition-all',
                  'bg-gradient-to-br from-rose-500 to-red-600 text-white',
                  'hover:from-rose-600 hover:to-red-700',
                  'disabled:opacity-50'
                )}
              >
                <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                  {systemActionLoading === 'cancel' ? (
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className="text-left">
                  <p className="font-semibold">Tümünü İptal Et</p>
                  <p className="text-xs text-white/70">{(systemHealth?.etl?.pendingJobs || 0) + (systemHealth?.etl?.running || 0)} job bekliyor</p>
                </div>
              </button>
            )}

            <div className={clsx('p-4 rounded-xl flex items-center gap-3', theme.cardBg)}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div className="text-left">
                <p className={clsx('font-semibold', theme.contentText)}>Son Sync</p>
                <p className={clsx('text-xs', theme.contentTextMuted)}>{systemHealth?.etl?.lastSyncText || 'Henüz yok'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* PERFORMANS DANIŞMANI TAB */}
      {/* ============================================ */}
      {activeTab === 'performance' && (
        <div className="space-y-6">
          {/* Header */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className={clsx('text-xl font-bold', theme.contentText)}>Performans Danışmanı</h2>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Veritabanı performansı ve optimizasyon önerileri
                  </p>
                </div>
              </div>
              <button
                onClick={loadAllPerformance}
                disabled={performanceLoading === 'all'}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all', theme.buttonPrimary)}
              >
                <RefreshCw className={clsx('w-4 h-4', performanceLoading === 'all' && 'animate-spin')} />
                Tümünü Yenile
              </button>
            </div>
          </div>

          {/* Clixer Sistem Sağlığı */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PostgreSQL Analizi */}
            <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
              <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-blue-500" />
                  <h3 className={clsx('font-bold', theme.contentText)}>PostgreSQL</h3>
                </div>
                <button
                  onClick={loadPostgresPerformance}
                  disabled={performanceLoading === 'postgres'}
                  className={clsx('p-2 rounded-lg transition-all', theme.buttonSecondary)}
                >
                  <RefreshCw className={clsx('w-4 h-4', performanceLoading === 'postgres' && 'animate-spin')} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {performanceData.postgres ? (
                  <>
                    {/* Özet Kartları */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className={clsx('p-3 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                        <p className={clsx('text-lg font-bold', performanceData.postgres.summary?.unusedIndexCount > 0 ? 'text-amber-500' : 'text-emerald-500')}>
                          {performanceData.postgres.summary?.unusedIndexCount || 0}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>Kullanılmayan Index</p>
                      </div>
                      <div className={clsx('p-3 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                        <p className={clsx('text-lg font-bold', performanceData.postgres.summary?.vacuumNeededCount > 0 ? 'text-amber-500' : 'text-emerald-500')}>
                          {performanceData.postgres.summary?.vacuumNeededCount || 0}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>VACUUM Gerekli</p>
                      </div>
                      <div className={clsx('p-3 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                        <p className={clsx('text-lg font-bold', theme.contentText)}>
                          {performanceData.postgres.dbSize || 'N/A'}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>Veritabanı Boyutu</p>
                      </div>
                    </div>

                    {/* Bağlantı Durumu */}
                    <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                      <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>Bağlantı Durumu</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-700/30 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                            style={{ 
                              width: `${(performanceData.postgres.connectionStats?.active_connections / performanceData.postgres.connectionStats?.max_connections * 100) || 0}%` 
                            }}
                          />
                        </div>
                        <span className={clsx('text-sm font-medium', theme.contentText)}>
                          {performanceData.postgres.connectionStats?.active_connections || 0} / {performanceData.postgres.connectionStats?.max_connections || 200}
                        </span>
                      </div>
                    </div>

                    {/* Kullanılmayan Index'ler */}
                    {performanceData.postgres.unusedIndexes?.length > 0 && (
                      <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-200')}>
                        <p className={clsx('text-sm font-medium mb-2 flex items-center gap-2', isDark ? 'text-amber-400' : 'text-amber-700')}>
                          <AlertTriangle className="w-4 h-4" />
                          Kullanılmayan Index'ler ({performanceData.postgres.unusedIndexes.length})
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {performanceData.postgres.unusedIndexes.slice(0, 5).map((idx: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                              <div>
                                <p className={clsx('text-sm font-mono', theme.contentText)}>{idx.index_name}</p>
                                <p className={clsx('text-xs', theme.contentTextMuted)}>{idx.table_name} • {idx.index_size}</p>
                              </div>
                              <button
                                onClick={() => dropIndex(idx.index_name)}
                                disabled={performanceActionLoading === `drop-${idx.index_name}`}
                                className="text-rose-500 hover:text-rose-400 p-1"
                                title="Index'i Sil"
                              >
                                {performanceActionLoading === `drop-${idx.index_name}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Dead Tuple'lar */}
                    {performanceData.postgres.deadTuples?.length > 0 && (
                      <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-rose-900/20 border-rose-500/30' : 'bg-rose-50 border-rose-200')}>
                        <p className={clsx('text-sm font-medium mb-2 flex items-center gap-2', isDark ? 'text-rose-400' : 'text-rose-700')}>
                          <AlertCircle className="w-4 h-4" />
                          VACUUM Gerekli ({performanceData.postgres.deadTuples.length} tablo)
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {performanceData.postgres.deadTuples.slice(0, 5).map((tbl: any, i: number) => (
                            <div key={i} className="flex items-center justify-between">
                              <div>
                                <p className={clsx('text-sm font-mono', theme.contentText)}>{tbl.table_name}</p>
                                <p className={clsx('text-xs', theme.contentTextMuted)}>
                                  {tbl.dead_tuples?.toLocaleString()} dead tuple ({tbl.dead_pct}%)
                                </p>
                              </div>
                              <button
                                onClick={() => runVacuum(tbl.table_name, true)}
                                disabled={performanceActionLoading === `vacuum-${tbl.table_name}`}
                                className="text-emerald-500 hover:text-emerald-400 px-2 py-1 text-xs font-medium"
                              >
                                {performanceActionLoading === `vacuum-${tbl.table_name}` ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'VACUUM'
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Seq Scan Fazla Tablolar - Index Önerileri */}
                    {performanceData.postgres.seqScanTables?.filter((t: any) => t.recommendation)?.length > 0 && (
                      <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200')}>
                        <p className={clsx('text-sm font-medium mb-2 flex items-center gap-2', isDark ? 'text-blue-400' : 'text-blue-700')}>
                          <Info className="w-4 h-4" />
                          Index Önerileri ({performanceData.postgres.seqScanTables.filter((t: any) => t.recommendation).length} tablo)
                        </p>
                        <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                          Bu tablolarda çok fazla sequential scan yapılıyor. Sık kullanılan WHERE/JOIN kolonlarına index eklenebilir.
                        </p>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {performanceData.postgres.seqScanTables.filter((t: any) => t.recommendation).slice(0, 5).map((tbl: any, i: number) => (
                            <div key={i} className={clsx('p-2 rounded-lg text-xs', isDark ? 'bg-slate-800/50' : 'bg-white')}>
                              <div className="flex items-center justify-between">
                                <p className={clsx('font-mono font-medium', theme.contentText)}>{tbl.table_name}</p>
                                <span className={clsx('text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')}>
                                  %{tbl.seq_pct} seq scan
                                </span>
                              </div>
                              <p className={theme.contentTextMuted}>
                                {Number(tbl.row_count)?.toLocaleString()} satır • {Number(tbl.seq_scan)?.toLocaleString()} seq scan
                              </p>
                              <p className={clsx('text-xs mt-1', isDark ? 'text-blue-400' : 'text-blue-600')}>
                                💡 {tbl.recommendation}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Her şey iyi ise */}
                    {!performanceData.postgres.unusedIndexes?.length && 
                     !performanceData.postgres.deadTuples?.length && 
                     !performanceData.postgres.seqScanTables?.filter((t: any) => t.recommendation)?.length && (
                      <div className={clsx('p-4 rounded-xl flex items-center gap-3', isDark ? 'bg-emerald-900/20' : 'bg-emerald-50')}>
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                        <p className={clsx('text-sm', isDark ? 'text-emerald-400' : 'text-emerald-700')}>
                          PostgreSQL sağlıklı durumda!
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    {performanceLoading === 'postgres' ? (
                      <Loader2 className={clsx('w-8 h-8 animate-spin', theme.contentTextMuted)} />
                    ) : (
                      <p className={theme.contentTextMuted}>Veri yüklenmedi</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ClickHouse Analizi */}
            <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
              <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-amber-500" />
                  <h3 className={clsx('font-bold', theme.contentText)}>Clixer DB</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={optimizeAllClickhouse}
                    disabled={performanceActionLoading === 'optimize-all'}
                    className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1', theme.buttonSecondary)}
                  >
                    {performanceActionLoading === 'optimize-all' ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Wrench className="w-3 h-3" />
                    )}
                    Tümünü Optimize Et
                  </button>
                  <button
                    onClick={loadClickhousePerformance}
                    disabled={performanceLoading === 'clickhouse'}
                    className={clsx('p-2 rounded-lg transition-all', theme.buttonSecondary)}
                  >
                    <RefreshCw className={clsx('w-4 h-4', performanceLoading === 'clickhouse' && 'animate-spin')} />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {performanceData.clickhouse ? (
                  <>
                    {/* Özet Kartları */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className={clsx('p-3 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                        <p className={clsx('text-lg font-bold', theme.contentText)}>
                          {performanceData.clickhouse.summary?.tableCount || 0}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>Tablo</p>
                      </div>
                      <div className={clsx('p-3 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                        <p className={clsx('text-lg font-bold', performanceData.clickhouse.summary?.optimizeNeededCount > 0 ? 'text-amber-500' : 'text-emerald-500')}>
                          {performanceData.clickhouse.summary?.optimizeNeededCount || 0}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>OPTIMIZE Gerekli</p>
                      </div>
                      <div className={clsx('p-3 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                        <p className={clsx('text-lg font-bold', theme.contentText)}>
                          {performanceData.clickhouse.dbSize || '0 B'}
                        </p>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>Toplam Boyut</p>
                      </div>
                    </div>

                    {/* Tablo Listesi */}
                    {performanceData.clickhouse.tableStats?.length > 0 && (
                      <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-slate-200')}>
                        <table className="w-full text-sm">
                          <thead className={clsx(isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <tr>
                              <th className={clsx('px-4 py-2 text-left font-medium', theme.contentText)}>Tablo</th>
                              <th className={clsx('px-4 py-2 text-right font-medium', theme.contentText)}>Satır</th>
                              <th className={clsx('px-4 py-2 text-right font-medium', theme.contentText)}>Boyut</th>
                              <th className={clsx('px-4 py-2 text-right font-medium', theme.contentText)}>Part</th>
                            </tr>
                          </thead>
                          <tbody>
                            {performanceData.clickhouse.tableStats.slice(0, 8).map((tbl: any, i: number) => (
                              <tr key={i} className={clsx('border-t', isDark ? 'border-slate-800' : 'border-slate-200')}>
                                <td className={clsx('px-4 py-2 font-mono text-xs', theme.contentText)}>{tbl.table}</td>
                                <td className={clsx('px-4 py-2 text-right', theme.contentTextMuted)}>
                                  {Number(tbl.total_rows)?.toLocaleString() || 0}
                                </td>
                                <td className={clsx('px-4 py-2 text-right', theme.contentTextMuted)}>{tbl.disk_size}</td>
                                <td className={clsx('px-4 py-2 text-right', Number(tbl.parts_count) > 50 ? 'text-amber-500' : theme.contentTextMuted)}>
                                  {tbl.parts_count}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Optimize Gerekli Uyarısı */}
                    {performanceData.clickhouse.tablesNeedOptimize?.length > 0 && (
                      <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-200')}>
                        <p className={clsx('text-sm font-medium flex items-center gap-2', isDark ? 'text-amber-400' : 'text-amber-700')}>
                          <AlertTriangle className="w-4 h-4" />
                          {performanceData.clickhouse.tablesNeedOptimize.length} tabloda çok fazla part var (OPTIMIZE önerilir)
                        </p>
                      </div>
                    )}

                    {/* Yavaş Sorgular */}
                    {performanceData.clickhouse.slowQueries?.length > 0 && (
                      <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-rose-900/20 border-rose-500/30' : 'bg-rose-50 border-rose-200')}>
                        <p className={clsx('text-sm font-medium mb-2 flex items-center gap-2', isDark ? 'text-rose-400' : 'text-rose-700')}>
                          <Clock className="w-4 h-4" />
                          Son 24 Saat Yavaş Sorgular ({performanceData.clickhouse.slowQueries.length})
                        </p>
                        <p className={clsx('text-xs mb-2', theme.contentTextMuted)}>
                          💡 İpucu: Yavaş sorgular için WHERE koşulu ekleyin veya tarih filtresi kullanın.
                        </p>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {performanceData.clickhouse.slowQueries.slice(0, 5).map((q: any, i: number) => (
                            <div key={i} className={clsx('p-2 rounded-lg text-xs group', isDark ? 'bg-slate-800/50' : 'bg-white')}>
                              <div className="flex items-start justify-between gap-2">
                                <p className={clsx('font-mono flex-1', theme.contentText)} title={q.query_preview}>
                                  {q.query_preview}
                                </p>
                                <button
                                  onClick={() => copyToClipboard(q.query_preview)}
                                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-700/50 rounded"
                                  title="Sorguyu Kopyala"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                              <p className={theme.contentTextMuted}>
                                ⏱️ {(q.query_duration_ms / 1000).toFixed(1)}s • 📊 {Number(q.read_rows)?.toLocaleString()} satır
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center py-8">
                    {performanceLoading === 'clickhouse' ? (
                      <Loader2 className={clsx('w-8 h-8 animate-spin', theme.contentTextMuted)} />
                    ) : (
                      <p className={theme.contentTextMuted}>Veri yüklenmedi</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ETL Performansı */}
          <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
            <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
              <div className="flex items-center gap-3">
                <Zap className="w-5 h-5 text-emerald-500" />
                <h3 className={clsx('font-bold', theme.contentText)}>ETL Performansı</h3>
              </div>
              <button
                onClick={loadEtlPerformance}
                disabled={performanceLoading === 'etl'}
                className={clsx('p-2 rounded-lg transition-all', theme.buttonSecondary)}
              >
                <RefreshCw className={clsx('w-4 h-4', performanceLoading === 'etl' && 'animate-spin')} />
              </button>
            </div>
            <div className="p-6">
              {performanceData.etl ? (
                <>
                  {/* Özet Kartları */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                      <p className={clsx('text-2xl font-bold', theme.contentText)}>
                        {performanceData.etl.summary?.totalJobs || 0}
                      </p>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Job</p>
                    </div>
                    <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                      <p className="text-2xl font-bold text-emerald-500">
                        {performanceData.etl.summary?.successRate || 0}%
                      </p>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>Başarı Oranı</p>
                    </div>
                    <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                      <p className={clsx('text-2xl font-bold', theme.contentText)}>
                        {Number(performanceData.etl.summary?.totalRowsProcessed || 0).toLocaleString()}
                      </p>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Satır</p>
                    </div>
                    <div className={clsx('p-4 rounded-xl text-center', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                      <p className={clsx('text-2xl font-bold', theme.contentText)}>
                        {performanceData.etl.datasetPerformance?.length || 0}
                      </p>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>Dataset</p>
                    </div>
                  </div>

                  {/* Dataset Performans Tablosu */}
                  {performanceData.etl.datasetPerformance?.length > 0 && (
                    <div className={clsx('rounded-xl border overflow-hidden', isDark ? 'border-slate-700' : 'border-slate-200')}>
                      <table className="w-full text-sm">
                        <thead className={clsx(isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                          <tr>
                            <th className={clsx('px-4 py-3 text-left font-medium', theme.contentText)}>Dataset</th>
                            <th className={clsx('px-4 py-3 text-center font-medium', theme.contentText)}>Toplam</th>
                            <th className={clsx('px-4 py-3 text-center font-medium', theme.contentText)}>Başarılı</th>
                            <th className={clsx('px-4 py-3 text-center font-medium', theme.contentText)}>Başarısız</th>
                            <th className={clsx('px-4 py-3 text-right font-medium', theme.contentText)}>Ort. Süre</th>
                            <th className={clsx('px-4 py-3 text-right font-medium', theme.contentText)}>Max Satır</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performanceData.etl.datasetPerformance.slice(0, 10).map((ds: any, i: number) => (
                            <tr key={i} className={clsx('border-t', isDark ? 'border-slate-800' : 'border-slate-200')}>
                              <td className={clsx('px-4 py-3 font-medium', theme.contentText)}>{ds.dataset_name}</td>
                              <td className={clsx('px-4 py-3 text-center', theme.contentTextMuted)}>{ds.total_jobs}</td>
                              <td className="px-4 py-3 text-center text-emerald-500">{ds.successful_jobs}</td>
                              <td className={clsx('px-4 py-3 text-center', ds.failed_jobs > 0 ? 'text-rose-500' : theme.contentTextMuted)}>
                                {ds.failed_jobs}
                              </td>
                              <td className={clsx('px-4 py-3 text-right', theme.contentTextMuted)}>
                                {ds.avg_duration_seconds ? `${Number(ds.avg_duration_seconds).toFixed(1)}s` : '-'}
                              </td>
                              <td className={clsx('px-4 py-3 text-right', theme.contentTextMuted)}>
                                {Number(ds.max_rows || 0).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Hata Patternleri */}
                  {performanceData.etl.errorPatterns?.length > 0 && (
                    <div className={clsx('mt-6 p-4 rounded-xl border', isDark ? 'bg-rose-900/20 border-rose-500/30' : 'bg-rose-50 border-rose-200')}>
                      <p className={clsx('text-sm font-medium mb-3 flex items-center gap-2', isDark ? 'text-rose-400' : 'text-rose-700')}>
                        <XCircle className="w-4 h-4" />
                        Sık Karşılaşılan Hatalar
                      </p>
                      <div className="space-y-2">
                        {performanceData.etl.errorPatterns.slice(0, 5).map((err: any, i: number) => (
                          <div key={i} className={clsx('p-3 rounded-lg', isDark ? 'bg-slate-800/50' : 'bg-white')}>
                            <div className="flex items-center justify-between mb-1">
                              <p className={clsx('text-sm font-medium', theme.contentText)}>{err.dataset_name}</p>
                              <span className={clsx('text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600')}>
                                {err.occurrence_count}x
                              </span>
                            </div>
                            <p className={clsx('text-xs font-mono truncate', theme.contentTextMuted)}>{err.error_message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center py-8">
                  {performanceLoading === 'etl' ? (
                    <Loader2 className={clsx('w-8 h-8 animate-spin', theme.contentTextMuted)} />
                  ) : (
                    <p className={theme.contentTextMuted}>Veri yüklenmedi</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Müşteri Veri Kaynakları */}
          {connections.length > 0 && (
            <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
              <div className={clsx('px-6 py-4 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
                <div className="flex items-center gap-3">
                  <Server className="w-5 h-5 text-purple-500" />
                  <h3 className={clsx('font-bold', theme.contentText)}>Müşteri Veri Kaynakları</h3>
                </div>
                <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>
                  Bağlı veritabanlarının performans analizi
                </p>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connections.filter(c => c.status === 'active').map((conn) => (
                    <div 
                      key={conn.id}
                      className={clsx('p-4 rounded-xl border transition-all', isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-blue-500" />
                          <p className={clsx('font-medium', theme.contentText)}>{conn.name}</p>
                        </div>
                        <span className={clsx('text-xs px-2 py-0.5 rounded-full uppercase', isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-600')}>
                          {conn.type}
                        </span>
                      </div>
                      <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>{conn.host}:{conn.port}</p>
                      
                      {performanceData.connections[conn.id] ? (
                        <div className="space-y-2">
                          {performanceData.connections[conn.id].summary && (
                            <>
                              {performanceData.connections[conn.id].missingIndexes?.length > 0 && (
                                <div className="flex items-center gap-2 text-amber-500">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="text-xs">{performanceData.connections[conn.id].missingIndexes.length} eksik index önerisi</span>
                                </div>
                              )}
                              {performanceData.connections[conn.id].fragmentedIndexes?.length > 0 && (
                                <div className="flex items-center gap-2 text-amber-500">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span className="text-xs">{performanceData.connections[conn.id].fragmentedIndexes.length} parçalanmış index</span>
                                </div>
                              )}
                              {!performanceData.connections[conn.id].missingIndexes?.length && !performanceData.connections[conn.id].fragmentedIndexes?.length && (
                                <div className="flex items-center gap-2 text-emerald-500">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="text-xs">Sağlıklı</span>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => loadConnectionPerformance(conn.id)}
                          disabled={performanceLoading === `connection-${conn.id}`}
                          className={clsx('w-full py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2', theme.buttonSecondary)}
                        >
                          {performanceLoading === `connection-${conn.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <TrendingUp className="w-4 h-4" />
                              Analiz Et
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================ */}
      {/* Dataset Creation Modal */}
      {/* ============================================ */}
      {showDatasetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col', theme.cardBg)}>
            <div className={clsx('p-6 border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <div className="flex items-center justify-between">
                <h2 className={clsx('text-xl font-bold', theme.contentText)}>Dataset Oluştur</h2>
                <button 
                  onClick={() => setShowDatasetModal(false)}
                  className={clsx('p-2 rounded-lg', theme.buttonSecondary)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>
                SQL sorgu sonuçlarını Clixer'a kaydedin
              </p>
      </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* Dataset Name */}
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dataset Adı *</label>
                <input
                  type="text"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  placeholder="Örn: Günlük Satışlar"
                  className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              </div>

              {/* Description */}
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Açıklama</label>
                <textarea
                  value={newDatasetDescription}
                  onChange={(e) => setNewDatasetDescription(e.target.value)}
                  placeholder="Dataset açıklaması..."
                  rows={2}
                  className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              </div>

              {/* Sync Settings - ÖNCELİKLİ ALAN (En üstte görünür) */}
              <div className={clsx('p-4 rounded-xl border-2', isDark ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-indigo-50 border-indigo-300')}>
                <h4 className={clsx('font-semibold mb-3 flex items-center gap-2', theme.contentText)}>
                  ⚙️ Sync Ayarları
                </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Stratejisi</label>
                  <select 
                    value={newDatasetSyncStrategy}
                    onChange={(e) => setNewDatasetSyncStrategy(e.target.value)}
                    className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="full_refresh">Full Refresh (Her şeyi sil-yaz)</option>
                    <option value="timestamp">Timestamp-Based (Değişenleri çek)</option>
                    <option value="id">ID-Based (Yeni kayıtları çek)</option>
                    <option value="date_delete_insert">📅 Tarih Bazlı Sil-Yaz (Son X gün)</option>
                    <option value="date_partition">🗓️ Date Partition (Sliding Window)</option>
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Sıklığı</label>
                  <select 
                    value={newDatasetSyncSchedule}
                    onChange={(e) => setNewDatasetSyncSchedule(e.target.value)}
                    className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="manual">Manuel</option>
                    <option value="1m">⚡ 1 dk (Test)</option>
                    <option value="5m">Her 5 Dakika</option>
                    <option value="15m">Her 15 Dakika</option>
                    <option value="30m">Her 30 Dakika</option>
                    <option value="1h">Saatlik</option>
                    <option value="daily">Günlük</option>
                  </select>
                </div>
              </div>
                
                {/* Satır Limiti */}
                <div className="mt-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                    Satır Limiti
                    <span className={clsx('ml-2 font-normal', theme.contentTextMuted)}>(Boş = Sınırsız)</span>
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      value={newDatasetRowLimit ?? ''}
                      onChange={(e) => setNewDatasetRowLimit(e.target.value ? parseInt(e.target.value) : null)}
                      placeholder="Örn: 50000000 (50M)"
                      className={clsx('flex-1 px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => setNewDatasetRowLimit(1000000)}
                        className={clsx('px-3 py-2 rounded-lg text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                      >
                        1M
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDatasetRowLimit(10000000)}
                        className={clsx('px-3 py-2 rounded-lg text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                      >
                        10M
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDatasetRowLimit(50000000)}
                        className={clsx('px-3 py-2 rounded-lg text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                      >
                        50M
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewDatasetRowLimit(null)}
                        className={clsx('px-3 py-2 rounded-lg text-xs font-medium', isDark ? 'bg-teal-700 hover:bg-teal-600 text-white' : 'bg-teal-200 hover:bg-teal-300 text-teal-700')}
                      >
                        ∞
                      </button>
                    </div>
                  </div>
                  <p className={clsx('mt-1 text-xs', theme.contentTextMuted)}>
                    💡 Big Data için sınırsız bırakın. Clixer milyarlarca satır destekler.
                  </p>
                </div>

                {/* Full Refresh için Custom WHERE Koşulu */}
                {newDatasetSyncStrategy === 'full_refresh' && (
                  <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-emerald-100 border-emerald-300')}>
                    <h5 className={clsx('font-semibold mb-2 flex items-center gap-2 text-sm', theme.contentText)}>
                      🎯 Filtre Koşulu (Opsiyonel)
                    </h5>
                    <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                      Tüm tablo yerine belirli bir kısmı senkronize etmek için WHERE koşulu yazın.
                    </p>
                    <textarea
                      value={customWhere}
                      onChange={(e) => setCustomWhere(e.target.value)}
                      placeholder="Örnek: tarih >= CURRENT_DATE - INTERVAL '7 days'"
                      rows={2}
                      className={clsx('w-full px-3 py-2 rounded-lg border text-sm font-mono', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                    <div className={clsx('mt-2 text-xs', theme.contentTextMuted)}>
                      <p className="font-medium mb-1">Örnek Koşullar:</p>
                      <ul className="space-y-0.5 ml-3">
                        <li>• <code className="bg-slate-700/50 px-1 rounded">tarih &gt;= CURRENT_DATE - 7</code> → Son 7 gün</li>
                        <li>• <code className="bg-slate-700/50 px-1 rounded">yil = 2025</code> → Sadece 2025</li>
                        <li>• <code className="bg-slate-700/50 px-1 rounded">status = 'active'</code> → Aktif kayıtlar</li>
                      </ul>
                    </div>
                  </div>
                )}

                {/* Tarih Bazlı Sil-Yaz Ayarları (date_delete_insert seçilince görünür) */}
                {newDatasetSyncStrategy === 'date_delete_insert' && (
                  <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-orange-900/30 border-orange-500/50' : 'bg-orange-100 border-orange-300')}>
                    <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                      📅 Tarih Bazlı Sil-Yaz Ayarları
                    </h5>
                    <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                      Partition kurmadan, seçtiğin tarih kolonuna göre "Son X gün" verisini sil ve yeniden yaz.
                      Küçük-orta tablolar için idealdir.
                    </p>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Tarih Kolonu */}
                      <div>
                        <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Tarih Kolonu *</label>
                        <select
                          value={newDatasetReferenceColumn}
                          onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                          className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        >
                          <option value="">Tarih kolonu seçin</option>
                          {sqlResult?.columns?.map(col => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Kaç Gün Sil-Yaz */}
                      <div>
                        <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Sil-Yaz Aralığı</label>
                        <select
                          value={deleteDays}
                          onChange={(e) => setDeleteDays(parseInt(e.target.value))}
                          className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        >
                          <option value={0}>🔥 Bugün (Sadece bugün)</option>
                          <option value={1}>📆 Son 1 gün (Dün + Bugün)</option>
                          <option value={3}>📆 Son 3 gün</option>
                          <option value={7}>📆 Son 7 gün</option>
                          <option value={30}>📆 Son 30 gün</option>
                          <option value={90}>📆 Son 3 ay</option>
                        </select>
                      </div>
                    </div>

                    <div className={clsx('mt-3 p-3 rounded-lg text-xs', isDark ? 'bg-slate-800/50' : 'bg-white/50')}>
                      <p className={clsx('font-medium mb-1', theme.contentText)}>🔄 Çalışma Mantığı:</p>
                      <ol className={clsx('list-decimal list-inside space-y-0.5', theme.contentTextMuted)}>
                        <li>Clixer'dan son {deleteDays === 0 ? 'bugün' : `${deleteDays} gün`} verileri silinir</li>
                        <li>Kaynak DB'den aynı tarih aralığı çekilir</li>
                        <li>Yeni veriler Clixer'a yazılır</li>
                      </ol>
                      <p className={clsx('mt-2 text-xs italic', theme.contentTextMuted)}>
                        💡 Partition gerektirmez, küçük tablolar için hızlı ve etkilidir.
                      </p>
                    </div>
                  </div>
                )}

                {/* ============================================ */}
                {/* RLS (Row-Level Security) Ayarları */}
                {/* ============================================ */}
                <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200')}>
                  <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                    🔐 Satır Güvenliği (Row-Level Security)
                    <span className={clsx('text-xs font-normal', theme.contentTextMuted)}>(Opsiyonel)</span>
                  </h5>
                  
                  <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                    Kullanıcıların sadece kendi yetki seviyelerindeki verileri görmesini sağlar.
                    Her kullanıcı pozisyonuna göre (Genel Müdür, Bölge Müdürü, Mağaza Müdürü) farklı veriler görür.
                  </p>
                  
                  <div className="grid grid-cols-3 gap-3">
                    {/* Mağaza Kolonu */}
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        🏪 Mağaza Kolonu
                      </label>
                      <select
                        value={rlsStoreColumn}
                        onChange={(e) => setRlsStoreColumn(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="">-- Seçilmedi --</option>
                        {sqlResult?.columns?.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                      <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Mağaza müdürü filtresi</p>
                    </div>
                    
                    {/* Bölge Kolonu */}
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        🗺️ Bölge Kolonu
                      </label>
                      <select
                        value={rlsRegionColumn}
                        onChange={(e) => setRlsRegionColumn(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="">-- Seçilmedi --</option>
                        {sqlResult?.columns?.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                      <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Bölge müdürü filtresi</p>
                    </div>
                    
                    {/* Grup Kolonu */}
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        🏢 Grup Kolonu
                      </label>
                      <select
                        value={rlsGroupColumn}
                        onChange={(e) => setRlsGroupColumn(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="">-- Seçilmedi --</option>
                        {sqlResult?.columns?.map(col => (
                          <option key={col.name} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                      <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Direktör filtresi (Franchise/Merkez)</p>
                    </div>
                  </div>
                  
                  <div className={clsx('mt-3 p-3 rounded-lg text-xs', isDark ? 'bg-purple-950/50' : 'bg-purple-100')}>
                    <p className={clsx('font-medium mb-1', theme.contentText)}>📋 RLS Nasıl Çalışır?</p>
                    <ul className={clsx('list-disc list-inside space-y-0.5', theme.contentTextMuted)}>
                      <li><strong>Genel Müdür:</strong> Tüm verileri görür (filtre yok)</li>
                      <li><strong>Direktör:</strong> Grup kolonuna göre filtrelenir (örn: ownership_type = 'FRANCHISE')</li>
                      <li><strong>Bölge Müdürü:</strong> Bölge kolonuna göre filtrelenir (örn: region = 'MARMARA')</li>
                      <li><strong>Mağaza Müdürü:</strong> Mağaza kolonuna göre filtrelenir (örn: store_id = '212AVM')</li>
                    </ul>
                  </div>
                </div>

                {/* Big Data & Partition Ayarları (Date Partition seçilince görünür) */}
                {newDatasetSyncStrategy === 'date_partition' && (
                  <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-100 border-blue-300')}>
                    <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                      📊 Partition & Refresh Ayarları (Big Data)
                    </h5>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {/* Partition Kolonu */}
                      <div>
                        <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Partition Kolonu *</label>
                        <select
                          value={partitionColumn}
                          onChange={(e) => setPartitionColumn(e.target.value)}
                          className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        >
                          <option value="">Tarih kolonu seçin</option>
                          {sqlResult?.columns?.map(col => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Partition Tipi */}
                      <div>
                        <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Partition Tipi</label>
                        <select
                          value={partitionType}
                          onChange={(e) => setPartitionType(e.target.value as 'monthly' | 'daily')}
                          className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        >
                          <option value="monthly">Aylık (YYYYMM)</option>
                          <option value="daily">Günlük (YYYYMMDD)</option>
                        </select>
                      </div>

                      {/* Sliding Window */}
                      <div>
                        <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Sliding Window (Gün)</label>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          value={refreshWindowDays}
                          onChange={(e) => setRefreshWindowDays(parseInt(e.target.value) || 0)}
                          className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        />
                        <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Son X gün yenilenir</p>
                      </div>

                      {/* Engine Type */}
                      <div>
                        <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Clixer Engine</label>
                        <select
                          value={engineType}
                          onChange={(e) => setEngineType(e.target.value as 'MergeTree' | 'ReplacingMergeTree')}
                          className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                        >
                          <option value="MergeTree">MergeTree (Hızlı)</option>
                          <option value="ReplacingMergeTree">ReplacingMergeTree (Upsert)</option>
                        </select>
                      </div>
                    </div>

                    {/* Geçmiş Değişiklik Algılama */}
                    <div className="mt-3 pt-3 border-t border-slate-500/30">
                      <label className={clsx('flex items-center gap-2 cursor-pointer')}>
                        <input
                          type="checkbox"
                          checked={detectModified}
                          onChange={(e) => setDetectModified(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-400"
                        />
                        <span className={clsx('text-sm font-medium', theme.contentText)}>
                          Geçmiş değişiklikleri algıla (modified_at)
                        </span>
                      </label>
                      <p className={clsx('text-xs mt-1 ml-6', theme.contentTextMuted)}>
                        Power BI'dan farklı: Geçmişte değişen kayıtları da günceller!
                      </p>
                      
                      {detectModified && (
                        <div className="mt-2 ml-6">
                          <select
                            value={modifiedColumn}
                            onChange={(e) => setModifiedColumn(e.target.value)}
                            className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                          >
                            <option value="">Değişiklik tarih kolonu seçin</option>
                            {sqlResult?.columns?.map(col => (
                              <option key={col.name} value={col.name}>{col.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Haftalık Full Refresh */}
                    <div className="mt-3">
                      <label className={clsx('flex items-center gap-2 cursor-pointer')}>
                        <input
                          type="checkbox"
                          checked={weeklyFullRefresh}
                          onChange={(e) => setWeeklyFullRefresh(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-400"
                        />
                        <span className={clsx('text-sm font-medium', theme.contentText)}>
                          Haftalık full refresh
                        </span>
                      </label>
                      <p className={clsx('text-xs mt-1 ml-6', theme.contentTextMuted)}>
                        Haftada bir kez tüm veri yenilenir
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* SQL Query Preview (kısa) */}
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>SQL Sorgusu</label>
                <pre className={clsx('p-3 rounded-lg text-xs overflow-x-auto max-h-16', isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-700')}>
                  {sqlQuery}
                </pre>
              </div>

              {/* Column Mapping (collapse) */}
              {sqlResult && (
                <details className={clsx('rounded-lg border', isDark ? 'border-slate-700' : 'border-slate-200')}>
                  <summary className={clsx('px-4 py-2 cursor-pointer font-medium', theme.contentText)}>
                    Kolonlar ({sqlResult.columns.length}) - Detayları göster
                  </summary>
                  <div className="max-h-64 overflow-y-auto">
                    {/* Tip Uyumluluk Özeti */}
                    {(() => {
                      const incompatibleCols = sqlResult.columns.filter(col => {
                        const info = getTypeCompatibilityInfo(col.type)
                        return !info.compatible
                      })
                      if (incompatibleCols.length > 0) {
                        return (
                          <div className={clsx('p-3 mb-2 rounded-lg border flex items-start gap-2', isDark ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-700')}>
                            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">⚠️ Tip Uyumsuzluğu Tespit Edildi!</p>
                              <p className="text-xs mt-1">
                                {incompatibleCols.length} kolonda sorun var: {incompatibleCols.map(c => c.name).join(', ')}
                              </p>
                              <p className="text-xs mt-1 opacity-80">
                                Öneri: Kaynaktan gelen tip bilgisini kontrol edin veya kolon mapping'i düzenleyin.
                              </p>
                            </div>
                          </div>
                        )
                      }
                      // Date kolonlarını kontrol et
                      const dateCols = sqlResult.columns.filter(col => {
                        const info = getTypeCompatibilityInfo(col.type)
                        return info.isDateType
                      })
                      
                      return (
                        <>
                          <div className={clsx('p-3 mb-2 rounded-lg border flex items-center gap-2', isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                            <CheckCircle className="h-5 w-5" />
                            <span className="text-sm font-medium">✅ Tüm kolonlar uyumlu</span>
                          </div>
                          
                          {dateCols.length > 0 && (
                            <div className={clsx('p-3 mb-2 rounded-lg border', isDark ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700')}>
                              <div className="flex items-start gap-2">
                                <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
                                <div>
                                  <p className="font-medium">⏰ {dateCols.length} Date/DateTime Kolon Tespit Edildi</p>
                                  <p className="text-xs mt-1 opacity-80">
                                    Kolonlar: {dateCols.map(c => c.name).join(', ')}
                                  </p>
                                  <p className="text-xs mt-2">
                                    <span className="font-medium">💡 Öneri:</span> SELECT * yerine kolon adlarını yazarak sorguyu optimize edin. 
                                    MSSQL Date tipi sorun çıkarırsa:
                                  </p>
                                  <code className={clsx('block mt-1 p-2 rounded text-xs font-mono', isDark ? 'bg-slate-800' : 'bg-white')}>
                                    CONVERT(VARCHAR, {dateCols[0]?.name || 'tarih_kolonu'}, 120) AS {dateCols[0]?.name || 'tarih_kolonu'}
                                  </code>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )
                    })()}
                    
                    <table className="w-full text-sm">
                      <thead className={clsx(isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                        <tr>
                          <th className="px-3 py-2 text-left">Kolon</th>
                          <th className="px-3 py-2 text-left">Kaynak Tip</th>
                          <th className="px-3 py-2 text-center">→</th>
                          <th className="px-3 py-2 text-left">Clixer Tip</th>
                          <th className="px-3 py-2 text-center">Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResult.columns.map((col, idx) => {
                          const typeInfo = getTypeCompatibilityInfo(col.type)
                          return (
                            <tr key={col.name} className={clsx(
                              isDark ? 'border-slate-700' : 'border-slate-200', 
                              idx > 0 && 'border-t',
                              !typeInfo.compatible && (isDark ? 'bg-red-500/5' : 'bg-red-50')
                            )}>
                              <td className={clsx('px-3 py-1.5 font-mono text-xs', theme.contentText)}>
                                {col.name}
                                {col.name.toLowerCase() === 'id' && (
                                  <span className={clsx('ml-1 text-[10px] px-1 py-0.5 rounded', isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')}>
                                    PK
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={clsx('text-xs px-2 py-0.5 rounded border', isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-300')}>
                                  {col.type || 'bilinmiyor'}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                <ArrowRight className="h-3 w-3 inline-block text-slate-400" />
                              </td>
                              <td className="px-3 py-1.5">
                                <span className={clsx('text-xs px-2 py-0.5 rounded border', getTypeColor(typeInfo.compatible, isDark))}>
                                  {col.clickhouseType || typeInfo.chType}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-center">
                                {typeInfo.compatible ? (
                                  typeInfo.isDateType ? (
                                    <div className="relative group">
                                      <Clock className="h-4 w-4 inline-block text-amber-500 cursor-help" />
                                      <div className={clsx('absolute z-10 right-0 top-6 w-56 p-2 rounded shadow-lg text-xs hidden group-hover:block', isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700 border')}>
                                        {typeInfo.suggestion}
                                      </div>
                                    </div>
                                  ) : (
                                    <CheckCircle className="h-4 w-4 inline-block text-emerald-500" />
                                  )
                                ) : (
                                  <div className="relative group">
                                    <AlertCircle className="h-4 w-4 inline-block text-red-500 cursor-help" />
                                    {typeInfo.suggestion && (
                                      <div className={clsx('absolute z-10 right-0 top-6 w-48 p-2 rounded shadow-lg text-xs hidden group-hover:block', isDark ? 'bg-slate-700 text-slate-200' : 'bg-white text-slate-700 border')}>
                                        {typeInfo.suggestion}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              )}
            </div>

            <div className={clsx('p-6 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <button
                onClick={() => setShowDatasetModal(false)}
                className={clsx('px-4 py-2 rounded-lg', theme.buttonSecondary)}
              >
                İptal
              </button>
              <button
                onClick={handleCreateDataset}
                disabled={!newDatasetName || !sqlResult || datasetCreating}
                className={clsx(
                  'px-4 py-2 rounded-lg font-medium flex items-center gap-2',
                  'bg-gradient-to-r from-indigo-500 to-purple-500 text-white',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                {datasetCreating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Dataset Oluştur
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
      {showPreviewModal && selectedDataset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col', theme.cardBg)}>
            <div className={clsx('p-6 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className={clsx('font-bold text-lg', theme.contentText)}>{selectedDataset.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <code className={clsx('px-1.5 py-0.5 rounded text-xs', isDark ? 'bg-slate-700' : 'bg-slate-100')}>
                      {selectedDataset.clickhouse_table}
                    </code>
                    <span className={clsx(
                      'px-2 py-0.5 rounded text-xs font-medium',
                      selectedDataset.status === 'active' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                      selectedDataset.status === 'syncing' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') :
                      selectedDataset.status === 'error' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') :
                      (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                    )}>
                      {selectedDataset.status === 'active' ? 'Aktif' :
                       selectedDataset.status === 'syncing' ? 'Sync...' :
                       selectedDataset.status === 'error' ? 'Hata' : selectedDataset.status}
                    </span>
                    {(selectedDataset.total_rows || selectedDataset.last_sync_rows) && (
                      <span className={clsx('text-xs', theme.contentTextMuted)}>
                        {(selectedDataset.total_rows || selectedDataset.last_sync_rows)?.toLocaleString()} satır
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Normal Sync */}
                <button 
                  onClick={() => triggerSync(selectedDataset.id, 'manual_sync')}
                  disabled={syncingDatasetId === selectedDataset.id}
                  className={clsx(
                    "px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 hover:bg-emerald-600 transition-all",
                    syncingDatasetId === selectedDataset.id && "opacity-50 cursor-not-allowed"
                  )}
                  title={syncingDatasetId === selectedDataset.id ? 'Sync başlatılıyor...' : 'Şimdi Sync Et'}
                >
                  {syncingDatasetId === selectedDataset.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {syncingDatasetId === selectedDataset.id ? 'Başlatılıyor...' : 'Sync'}
                </button>
                
                {/* Partial Refresh - Tarih aralığı ile yenile */}
                {selectedDataset.partition_column && (
                  <div className="relative group">
                    <button 
                      className={clsx(
                        "px-3 py-1.5 text-sm rounded-lg flex items-center gap-1.5 transition-all",
                        isDark ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-amber-500 hover:bg-amber-600 text-white'
                      )}
                      title="Son X günü sil ve yeniden çek"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Kısmi Yenile
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <div className={clsx(
                      "absolute right-0 top-full mt-1 py-1 rounded-lg shadow-xl border z-50 min-w-[160px] hidden group-hover:block",
                      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                    )}>
                      {[
                        { days: 7, label: 'Son 7 Gün' },
                        { days: 30, label: 'Son 30 Gün' },
                        { days: 90, label: 'Son 3 Ay' },
                        { days: 180, label: 'Son 6 Ay' }
                      ].map(opt => (
                        <button
                          key={opt.days}
                          onClick={async () => {
                            if (!confirm(`${selectedDataset.name} için son ${opt.days} günlük veri silinip yeniden çekilecek. Devam?`)) return;
                            try {
                              const result = await apiCall(`/data/datasets/${selectedDataset.id}/partial-refresh`, {
                                method: 'POST',
                                body: JSON.stringify({ days: opt.days })
                              });
                              if (result.success) {
                                alert(`✅ ${opt.label} yenileme başlatıldı!`);
                                loadETLJobs();
                              } else {
                                alert(`⚠️ ${result.error || 'Başlatılamadı'}`);
                              }
                            } catch (err: any) {
                              alert(`❌ Hata: ${err.message}`);
                            }
                          }}
                          className={clsx(
                            "w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors",
                            theme.contentText
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                
                <button onClick={() => setShowPreviewModal(false)} className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-auto p-6">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                  <span className={clsx('ml-3', theme.contentTextMuted)}>Veri yükleniyor...</span>
                </div>
              ) : previewData && previewData.rows.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={clsx(isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                        {previewData.columns.map((col, i) => (
                          <th key={i} className={clsx('px-4 py-3 text-left font-medium', theme.contentText)}>
                            {typeof col === 'string' ? col : col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className={clsx('divide-y', isDark ? 'divide-slate-700' : 'divide-slate-200')}>
                      {previewData.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className={clsx(isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                          {previewData.columns.map((col, colIdx) => {
                            const colName = typeof col === 'string' ? col : col.name
                            return (
                              <td key={colIdx} className={clsx('px-4 py-2 font-mono text-xs', theme.contentTextMuted)}>
                                {String(row[colName] ?? '')}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Database className={clsx('h-12 w-12 mb-4', theme.contentTextMuted)} />
                  <h4 className={clsx('font-medium mb-2', theme.contentText)}>Veri Bulunamadı</h4>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Bu dataset henüz senkronize edilmedi veya veri içermiyor.
                  </p>
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      triggerSync(selectedDataset.id, 'manual_sync')
                    }}
                    disabled={syncingDatasetId === selectedDataset.id}
                    className={clsx(
                      "mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-600 transition-all",
                      syncingDatasetId === selectedDataset.id && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {syncingDatasetId === selectedDataset.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                    <Play className="h-4 w-4" />
                    )}
                    {syncingDatasetId === selectedDataset.id ? 'Başlatılıyor...' : 'Şimdi Sync Et'}
                  </button>
                </div>
              )}
            </div>

            <div className={clsx('p-4 border-t flex items-center justify-between text-sm', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <div className="flex items-center gap-4">
                <span className={clsx(theme.contentTextMuted)}>
                  {previewData?.rows.length || 0} satır gösteriliyor
                  {previewData?.totalRows && previewData.totalRows > 100 && (
                    <span> (toplam: {previewData.totalRows.toLocaleString()})</span>
                  )}
                </span>
                {selectedDataset.last_sync_at && (
                  <span className={clsx('flex items-center gap-1', theme.contentTextMuted)}>
                    <Clock className="h-3.5 w-3.5" />
                    Son sync: {formatTimeAgo(selectedDataset.last_sync_at, true)}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className={clsx('px-4 py-2 rounded-lg', theme.buttonSecondary)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* SETTINGS MODAL */}
      {/* ============================================ */}
      {showSettingsModal && selectedDataset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col', theme.cardBg)}>
            <div className={clsx('p-4 border-b flex items-center justify-between flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-700 rounded-lg flex items-center justify-center">
                  <Settings className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h3 className={clsx('font-bold', theme.contentText)}>Dataset Ayarları</h3>
                  <p className={clsx('text-xs', theme.contentTextMuted)}>{selectedDataset.clickhouse_table}</p>
                </div>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3 overflow-y-auto flex-1">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Dataset Adı</label>
                <input
                  type="text"
                  value={newDatasetName}
                  onChange={(e) => setNewDatasetName(e.target.value)}
                  className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Stratejisi</label>
                  <select 
                    value={newDatasetSyncStrategy}
                    onChange={(e) => setNewDatasetSyncStrategy(e.target.value)}
                    className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="full_refresh">Full Refresh (Her şeyi sil-yaz)</option>
                    <option value="timestamp">Timestamp-Based (Değişenleri çek)</option>
                    <option value="id">ID-Based (Yeni kayıtları çek)</option>
                    <option value="date_delete_insert">📅 Tarih Bazlı Sil-Yaz (Son X gün)</option>
                    <option value="date_partition">🗓️ Date Partition (Sliding Window)</option>
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Sıklığı</label>
                  <select 
                    value={newDatasetSyncSchedule}
                    onChange={(e) => setNewDatasetSyncSchedule(e.target.value)}
                    className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="manual">Manuel</option>
                    <option value="1m">⚡ 1 dk (Test)</option>
                    <option value="5m">Her 5 Dakika</option>
                    <option value="15m">Her 15 Dakika</option>
                    <option value="30m">Her 30 Dakika</option>
                    <option value="1h">Saatlik</option>
                    <option value="daily">Günlük</option>
                  </select>
                </div>
              </div>

              {/* Satır Limiti */}
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                  Satır Limiti
                  <span className={clsx('ml-2 font-normal text-xs', theme.contentTextMuted)}>(Boş = Sınırsız)</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={newDatasetRowLimit ?? ''}
                    onChange={(e) => setNewDatasetRowLimit(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Örn: 50000000"
                    className={clsx('flex-1 px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setNewDatasetRowLimit(10000000)}
                      className={clsx('px-2 py-1.5 rounded text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                    >
                      10M
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDatasetRowLimit(50000000)}
                      className={clsx('px-2 py-1.5 rounded text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                    >
                      50M
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewDatasetRowLimit(null)}
                      className={clsx('px-2 py-1.5 rounded text-xs font-medium', isDark ? 'bg-teal-700 hover:bg-teal-600 text-white' : 'bg-teal-200 hover:bg-teal-300 text-teal-700')}
                    >
                      ∞
                    </button>
                  </div>
                </div>
                <p className={clsx('mt-1 text-xs', theme.contentTextMuted)}>
                  Mevcut: <strong>{selectedDataset.row_limit ? `${(selectedDataset.row_limit / 1000000).toFixed(0)}M` : '∞ Sınırsız'}</strong>
                </p>
              </div>

              {/* Referans Kolon - Timestamp/ID/DatePartition stratejisi için */}
              {(newDatasetSyncStrategy === 'timestamp' || newDatasetSyncStrategy === 'id' || newDatasetSyncStrategy === 'date_partition') && (
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                    Referans Kolon
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  {settingsColumns.length > 0 ? (
                    <select
                      value={newDatasetReferenceColumn}
                      onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                      className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    >
                      <option value="">Kolon Seçin...</option>
                      {settingsColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={newDatasetReferenceColumn}
                      onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                      placeholder={newDatasetSyncStrategy === 'timestamp' ? 'örn: updated_at, modified_date' : 'örn: id, row_id'}
                      className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  )}
                  <p className={clsx('text-xs mt-1.5', theme.contentTextMuted)}>
                    {newDatasetSyncStrategy === 'timestamp' 
                      ? '⏰ Kaynak tablodaki tarih/zaman kolonu. Sadece bu kolondan sonraki değişiklikler çekilir.' 
                      : '🔢 Kaynak tablodaki ID kolonu. Sadece son ID\'den büyük yeni kayıtlar çekilir.'}
                  </p>
                </div>
              )}

              {/* Full Refresh için Custom WHERE Koşulu */}
                    {newDatasetSyncStrategy === 'full_refresh' && (
                <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-emerald-100 border-emerald-300')}>
                  <h5 className={clsx('font-semibold mb-2 flex items-center gap-2 text-sm', theme.contentText)}>
                    🎯 Filtre Koşulu (Opsiyonel)
                  </h5>
                  <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                    Tüm tablo yerine belirli bir kısmı senkronize etmek için WHERE koşulu yazın.
                  </p>
                  <textarea
                    value={customWhere}
                    onChange={(e) => setCustomWhere(e.target.value)}
                    placeholder="Örnek: tarih >= CURRENT_DATE - INTERVAL '7 days'"
                    rows={2}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm font-mono', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                  <div className={clsx('mt-2 text-xs', theme.contentTextMuted)}>
                    <p className="font-medium mb-1">Örnek Koşullar:</p>
                    <ul className="space-y-0.5 ml-3">
                      <li>• <code className="bg-slate-700/50 px-1 rounded">tarih &gt;= CURRENT_DATE - 7</code> → Son 7 gün</li>
                      <li>• <code className="bg-slate-700/50 px-1 rounded">yil = 2025</code> → Sadece 2025</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Tarih Bazlı Sil-Yaz Ayarları (date_delete_insert seçilince görünür) */}
              {newDatasetSyncStrategy === 'date_delete_insert' && (
                <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-orange-900/30 border-orange-500/50' : 'bg-orange-100 border-orange-300')}>
                  <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                    📅 Tarih Bazlı Sil-Yaz Ayarları
                  </h5>
                  <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                    Partition kurmadan, seçtiğin tarih kolonuna göre "Son X gün" verisini sil ve yeniden yaz.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {/* Tarih Kolonu */}
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Tarih Kolonu *</label>
                      <select
                        value={newDatasetReferenceColumn}
                        onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="">Tarih kolonu seçin</option>
                        {settingsColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>

                    {/* Kaç Gün Sil-Yaz */}
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Sil-Yaz Aralığı</label>
                      <select
                        value={deleteDays}
                        onChange={(e) => setDeleteDays(parseInt(e.target.value))}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value={0}>🔥 Bugün (Sadece bugün)</option>
                        <option value={1}>📆 Son 1 gün</option>
                        <option value={3}>📆 Son 3 gün</option>
                        <option value={7}>📆 Son 7 gün</option>
                        <option value={30}>📆 Son 30 gün</option>
                        <option value={90}>📆 Son 3 ay</option>
                      </select>
                    </div>
                  </div>

                  <div className={clsx('mt-3 p-3 rounded-lg text-xs', isDark ? 'bg-slate-800/50' : 'bg-white/50')}>
                    <p className={clsx('font-medium mb-1', theme.contentText)}>🔄 Çalışma Mantığı:</p>
                    <ol className={clsx('list-decimal list-inside space-y-0.5', theme.contentTextMuted)}>
                      <li>Clixer'dan son {deleteDays === 0 ? 'bugün' : `${deleteDays} gün`} verileri silinir</li>
                      <li>Kaynak DB'den aynı tarih aralığı çekilir</li>
                      <li>Yeni veriler Clixer'a yazılır</li>
                    </ol>
                  </div>
                </div>
              )}

              {/* Partition Ayarları (date_partition seçilince) */}
                    {newDatasetSyncStrategy === 'date_partition' && (
                <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200')}>
                  <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                    📊 Partition & Refresh Ayarları
                  </h5>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Partition Kolonu *</label>
                      <select
                        value={partitionColumn}
                        onChange={(e) => setPartitionColumn(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="">Tarih kolonu seçin</option>
                        {settingsColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                  </div>

                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Partition Tipi</label>
                      <select
                        value={partitionType}
                        onChange={(e) => setPartitionType(e.target.value as 'monthly' | 'daily')}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="monthly">Aylık (YYYYMM)</option>
                        <option value="daily">Günlük (YYYYMMDD)</option>
                      </select>
                </div>

                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Sliding Window (Gün)</label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={refreshWindowDays}
                        onChange={(e) => setRefreshWindowDays(parseInt(e.target.value) || 0)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      />
              </div>

                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Clixer Engine</label>
                      <select
                        value={engineType}
                        onChange={(e) => setEngineType(e.target.value as 'MergeTree' | 'ReplacingMergeTree')}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="MergeTree">MergeTree</option>
                        <option value="ReplacingMergeTree">ReplacingMergeTree</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className={clsx('flex items-center gap-2 cursor-pointer')}>
                      <input
                        type="checkbox"
                        checked={detectModified}
                        onChange={(e) => setDetectModified(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className={clsx('text-sm', theme.contentText)}>Geçmiş değişiklikleri algıla</span>
                    </label>
                    
                    {detectModified && (
                      <select
                        value={modifiedColumn}
                        onChange={(e) => setModifiedColumn(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border text-sm ml-6', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="">modified_at kolonu seçin</option>
                        {settingsColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    )}

                    <label className={clsx('flex items-center gap-2 cursor-pointer')}>
                      <input
                        type="checkbox"
                        checked={weeklyFullRefresh}
                        onChange={(e) => setWeeklyFullRefresh(e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      <span className={clsx('text-sm', theme.contentText)}>Haftalık full refresh</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Strateji Açıklaması - Kompakt */}
              <p className={clsx('text-xs p-2 rounded-lg flex items-center gap-1.5', isDark ? 'bg-slate-800/50 text-slate-400' : 'bg-blue-50 text-blue-700')}>
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                {newDatasetSyncStrategy === 'full_refresh' && 'Full Refresh: Tüm veri sil-yaz. Küçük tablolar için.'}
                {newDatasetSyncStrategy === 'timestamp' && 'Timestamp: Değişen kayıtları çek. Büyük tablolar için.'}
                {newDatasetSyncStrategy === 'id' && 'ID-Based: Yeni kayıtları çek. Log tabloları için.'}
                {newDatasetSyncStrategy === 'date_partition' && 'Date Partition: Sliding window. Büyük satış tabloları için.'}
              </p>

              {/* Unique Kolon (ORDER BY) - ZORUNLU */}
              <div className={clsx('p-3 rounded-lg border-2', 
                uniqueColumn 
                  ? (isDark ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-300')
                  : (isDark ? 'bg-red-900/30 border-red-500' : 'bg-red-50 border-red-400')
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🔑</span>
                  <span className={clsx('font-medium text-sm', theme.contentText)}>
                    Unique Kolon (Zorunlu)
                  </span>
                  {uniqueColumn ? (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white">✓ Seçildi</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">⚠ Zorunlu</span>
                  )}
                </div>
                <p className={clsx('text-xs mb-2', theme.contentTextMuted)}>
                  Clixer'da veri kaybını önlemek için benzersiz bir kolon seçin. Bu kolon ORDER BY olarak kullanılacak.
                </p>
                <select
                  value={uniqueColumn}
                  onChange={(e) => setUniqueColumn(e.target.value)}
                  className={clsx(
                    'w-full px-3 py-2 rounded-lg border text-sm',
                    theme.inputBg, theme.inputText,
                    uniqueColumn ? 'border-green-500' : 'border-red-500'
                  )}
                >
                  <option value="">-- Unique Kolon Seçin --</option>
                  {sqlResult?.columns?.map(col => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.type})
                      {autoDetectedUnique === col.name ? ' ✓ Önerilen' : ''}
                    </option>
                  ))}
                </select>
                {autoDetectedUnique && (
                  <p className={clsx('text-xs mt-1', 'text-green-600')}>
                    💡 "{autoDetectedUnique}" kolonu otomatik algılandı
                  </p>
                )}
                {!uniqueColumn && (
                  <p className={clsx('text-xs mt-1 font-medium', 'text-amber-600')}>
                    ⚠️ View/Aggregate için unique olmayabilir. Uyarı ile devam edilebilir.
                  </p>
                )}
              </div>

              {/* RLS (Row-Level Security) Ayarları */}
              <details className={clsx('rounded-lg', isDark ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200')}>
                <summary className={clsx('p-3 cursor-pointer font-medium text-sm flex items-center gap-2', theme.contentText)}>
                  <span>🔒 Satır Güvenliği (RLS)</span>
                  {(rlsStoreColumn || rlsRegionColumn || rlsGroupColumn) && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500 text-white">Aktif</span>
                  )}
                </summary>
                <div className="px-3 pb-3 space-y-3">
                  <p className={clsx('text-xs', theme.contentTextMuted)}>
                    Kullanıcıların sadece yetkili oldukları verileri görmesini sağlar.
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Mağaza Kolonu</label>
                      <select
                        value={rlsStoreColumn}
                        onChange={(e) => setRlsStoreColumn(e.target.value)}
                        className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', theme.inputBg, theme.inputText)}
                      >
                        <option value="">Seçilmedi</option>
                        {settingsColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Bölge Kolonu</label>
                      <select
                        value={rlsRegionColumn}
                        onChange={(e) => setRlsRegionColumn(e.target.value)}
                        className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', theme.inputBg, theme.inputText)}
                      >
                        <option value="">Seçilmedi</option>
                        {settingsColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Grup Kolonu</label>
                      <select
                        value={rlsGroupColumn}
                        onChange={(e) => setRlsGroupColumn(e.target.value)}
                        className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', theme.inputBg, theme.inputText)}
                      >
                        <option value="">Seçilmedi</option>
                        {settingsColumns.map(col => (
                          <option key={col} value={col}>{col}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className={clsx('text-xs', theme.contentTextMuted)}>
                    💡 Bu kolonlar kullanıcının <code>filter_level</code> ve <code>filter_value</code> ayarlarına göre WHERE koşulu oluşturur.
                  </p>
                </div>
              </details>

              {/* Durum ve Bilgi - Kompakt */}
              <details className={clsx('rounded-lg', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                <summary className={clsx('p-3 cursor-pointer font-medium text-sm flex items-center justify-between', theme.contentText)}>
                  <span>Dataset Bilgileri</span>
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    selectedDataset.status === 'active' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                    selectedDataset.status === 'error' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') :
                    (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                  )}>
                    {selectedDataset.status === 'active' ? 'Aktif' : selectedDataset.status === 'error' ? 'Hata' : selectedDataset.status}
                  </span>
                </summary>
                <div className="px-3 pb-3">
                  <ul className={clsx('text-xs space-y-1', theme.contentTextMuted)}>
                  <li className="flex justify-between">
                    <span>Bağlantı:</span>
                    <span className={theme.contentText}>{selectedDataset.connection_name || '-'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Son Sync:</span>
                    <span>{selectedDataset.last_sync_at ? new Date(selectedDataset.last_sync_at).toLocaleString('tr-TR') : 'Hiç'}</span>
                  </li>
                  <li className="flex justify-between">
                    <span>Toplam Satır:</span>
                      <span className={theme.contentText}>{(selectedDataset.total_rows || selectedDataset.last_sync_rows)?.toLocaleString() || '0'}</span>
                  </li>
                </ul>
              </div>
              </details>

              {/* Hata Mesajı - Kompakt */}
              {selectedDataset.status === 'error' && selectedDataset.status_message && (
                <p className={clsx('text-xs p-2 rounded-lg flex items-center gap-1.5', isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')}>
                  <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        {translateErrorMessage(selectedDataset.status_message)}
        </p>
              )}

              {/* Source Query - Kompakt */}
              {selectedDataset.source_query && (
                <details className={clsx('rounded-lg', isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                  <summary className={clsx('p-2 cursor-pointer text-xs font-medium', theme.contentText)}>
                    SQL Sorgusu
                  </summary>
                  <pre className={clsx('p-2 text-xs overflow-x-auto max-h-20', isDark ? 'text-slate-300' : 'text-slate-700')}>
                    {selectedDataset.source_query}
                  </pre>
                </details>
              )}
            </div>

            <div className={clsx('p-4 border-t flex items-center justify-between flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <button
                onClick={handleDeleteDataset}
                className="px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 flex items-center gap-2 text-sm"
              >
                <Trash2 className="h-4 w-4" />
                Sil
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm', theme.buttonSecondary)}
                >
                  İptal
                </button>
                <button
                  onClick={handleUpdateDataset}
                  className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 text-sm font-medium"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* API PREVIEW MODAL (Dinamo'dan) */}
      {/* ============================================ */}
      {showApiPreviewModal && apiPreviewConnection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowApiPreviewModal(false)} />
          <div className={clsx('relative w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col', theme.cardBg)}>
            {/* Header */}
            <div className={clsx('px-6 py-4 border-b flex items-center justify-between bg-gradient-to-r', isDark ? 'border-slate-700 from-emerald-900/30 to-slate-900' : 'border-slate-200 from-emerald-50 to-white')}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className={clsx('text-lg font-bold', theme.contentText)}>API Önizleme</h2>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    {apiPreviewConnection.name} • {(() => {
                      const config = apiPreviewConnection.api_config 
                        ? (typeof apiPreviewConnection.api_config === 'string' ? JSON.parse(apiPreviewConnection.api_config) : apiPreviewConnection.api_config)
                        : {}
                      return config.baseUrl || apiPreviewConnection.host
                    })()}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowApiPreviewModal(false)} className={clsx('p-2 rounded-lg', theme.buttonSecondary)}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Request Config */}
            <div className={clsx('p-4 border-b space-y-3', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50')}>
              <div className="flex gap-3 items-end flex-wrap">
                <div className="w-24">
                  <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Method</label>
                  <select 
                    className={clsx('w-full px-3 py-2 rounded-lg font-bold text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    value={apiMethod}
                    onChange={e => setApiMethod(e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Endpoint</label>
                  <input 
                    className={clsx('w-full px-3 py-2 rounded-lg font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    placeholder=""
                    value={apiEndpoint}
                    onChange={e => setApiEndpoint(e.target.value)}
                  />
                </div>
                <div className="flex-1 min-w-[250px]">
                  <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Query Params</label>
                  <input 
                    className={clsx('w-full px-3 py-2 rounded-lg font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    placeholder=""
                    value={apiQueryParams}
                    onChange={e => setApiQueryParams(e.target.value)}
                  />
                </div>
                <div className="w-40">
                  <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Response Path</label>
                  <input 
                    className={clsx('w-full px-3 py-2 rounded-lg font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    placeholder="data.grades"
                    value={apiResponsePath}
                    onChange={e => setApiResponsePath(e.target.value)}
                  />
                </div>
                <button 
                  onClick={runApiPreview}
                  disabled={apiPreviewLoading}
                  className="px-5 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50"
                >
                  {apiPreviewLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Çalıştır
                </button>
              </div>
              
              {/* POST/PUT Body */}
              {(apiMethod === 'POST' || apiMethod === 'PUT') && (
                <div>
                  <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Request Body (JSON)</label>
                  <textarea 
                    className={clsx('w-full px-3 py-2 rounded-lg font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    placeholder='{"number": "20247000031"}'
                    rows={4}
                    value={apiBody}
                    onChange={e => setApiBody(e.target.value)}
                  />
                </div>
              )}
              
              <div className={clsx('text-xs font-mono px-3 py-2 rounded border break-all', isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200')}>
                <span className="text-emerald-500 font-bold">{apiMethod}</span>{' '}
                <span className={theme.contentTextMuted}>
                  {(() => {
                    const config = apiPreviewConnection.api_config 
                      ? (typeof apiPreviewConnection.api_config === 'string' ? JSON.parse(apiPreviewConnection.api_config) : apiPreviewConnection.api_config)
                      : {}
                    return config.baseUrl || apiPreviewConnection.host
                  })()}{apiEndpoint}{apiQueryParams ? `?${apiQueryParams}` : ''}
                </span>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-auto p-4">
              {apiPreviewError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-red-500">Hata</div>
                    <div className="text-red-400 text-sm mt-1">{apiPreviewError}</div>
                  </div>
                </div>
              )}

              {apiPreviewResult && (
                <div className="space-y-4">
                  {/* Status Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 text-sm">
                      <span className={clsx(
                        'px-3 py-1 rounded-full font-bold',
                        apiPreviewResult.statusCode >= 200 && apiPreviewResult.statusCode < 300 
                          ? 'bg-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/20 text-red-400'
                      )}>
                        HTTP {apiPreviewResult.statusCode}
                      </span>
                      <span className={clsx('flex items-center gap-1', theme.contentTextMuted)}>
                        <Clock className="h-3.5 w-3.5" /> {apiPreviewResult.duration}ms
                      </span>
                      <span className={clsx('flex items-center gap-1', theme.contentTextMuted)}>
                        <Zap className="h-3.5 w-3.5" /> {apiPreviewResult.totalCount} kayıt
                      </span>
                    </div>
                    <button
                      onClick={() => setShowApiDatasetForm(!showApiDatasetForm)}
                      className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 flex items-center gap-2 text-sm"
                    >
                      <Database className="h-4 w-4" />
                      Dataset Olarak Kaydet
                    </button>
                  </div>
                  
                  {/* Dataset Form */}
                  {showApiDatasetForm && (
                    <div className={clsx('p-4 rounded-xl border space-y-4', isDark ? 'bg-indigo-900/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200')}>
                      <h4 className={clsx('font-bold flex items-center gap-2', isDark ? 'text-indigo-300' : 'text-indigo-900')}>
                        <Database className="h-4 w-4" />
                        Yeni Dataset Oluştur
                      </h4>
                      
                      <div>
                        <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Dataset Adı *</label>
                        <input
                          className={clsx('w-full px-3 py-2 rounded-lg font-bold', theme.inputBg, theme.inputText, theme.inputBorder)}
                          placeholder="Haberler, Çalışanlar, vs."
                          value={apiDatasetName}
                          onChange={e => setApiDatasetName(e.target.value)}
                        />
                      </div>
                      
                      <div>
                        <label className={clsx('block text-xs font-bold mb-2', theme.contentTextMuted)}>
                          Kullanılacak Kolonlar ({apiSelectedColumns.length} seçili)
                        </label>
                        <div className={clsx('flex flex-wrap gap-2 max-h-32 overflow-auto p-2 rounded-lg border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}>
                          {apiPreviewResult.columns?.map((col: any) => (
                            <label 
                              key={col.name}
                              className={clsx(
                                'px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-2 transition-colors',
                                apiSelectedColumns.includes(col.name)
                                  ? 'bg-indigo-600 text-white'
                                  : (isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')
                              )}
                            >
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={apiSelectedColumns.includes(col.name)}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setApiSelectedColumns([...apiSelectedColumns, col.name])
                                  } else {
                                    setApiSelectedColumns(apiSelectedColumns.filter(c => c !== col.name))
                                  }
                                }}
                              />
                              {col.name}
                              <span className={clsx(
                                'text-[10px] px-1 rounded',
                                apiSelectedColumns.includes(col.name) ? 'bg-indigo-500' : (isDark ? 'bg-slate-600' : 'bg-slate-200')
                              )}>
                                {col.type}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Sync Ayarları */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Sync Sıklığı</label>
                          <select
                            className={clsx('w-full px-3 py-2 rounded-lg font-bold', theme.inputBg, theme.inputText, theme.inputBorder)}
                            value={apiSyncSchedule}
                            onChange={e => setApiSyncSchedule(e.target.value)}
                          >
                            <option value="manual">Manuel</option>
                            <option value="5m">5 Dakika</option>
                            <option value="15m">15 Dakika</option>
                            <option value="30m">30 Dakika</option>
                            <option value="1h">1 Saat</option>
                            <option value="daily">Günlük (03:00)</option>
                          </select>
                        </div>
                        <div>
                          <label className={clsx('block text-xs font-bold mb-1', theme.contentTextMuted)}>Maks. Kayıt Sayısı</label>
                          <input
                            type="number"
                            className={clsx('w-full px-3 py-2 rounded-lg font-bold', theme.inputBg, theme.inputText, theme.inputBorder)}
                            value={apiRowLimit}
                            onChange={e => setApiRowLimit(parseInt(e.target.value) || 10000)}
                            min={100}
                            max={1000000}
                          />
                        </div>
                      </div>

                      <div className={clsx('text-xs p-2 rounded-lg flex items-start gap-2', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>
                        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        <span>API verileri her sync'te Clixer'a <strong>full refresh</strong> olarak yazılır. Eski veriler silinir, yeni veriler eklenir.</span>
                      </div>
                      
                      <div className={clsx('flex justify-end gap-2 pt-2 border-t', isDark ? 'border-indigo-500/30' : 'border-indigo-200')}>
                        <button
                          onClick={() => setShowApiDatasetForm(false)}
                          className={clsx('px-4 py-2 font-bold rounded-lg', theme.buttonSecondary)}
                        >
                          Vazgeç
                        </button>
                        <button
                          onClick={saveApiAsDataset}
                          disabled={!apiDatasetName.trim() || apiDatasetSaving}
                          className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          {apiDatasetSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                          Dataset Oluştur
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Columns */}
                  {apiPreviewResult.columns?.length > 0 && (
                    <div>
                      <h4 className={clsx('font-bold text-sm mb-2 flex items-center gap-2', theme.contentText)}>
                        <Columns className="h-4 w-4" /> Tespit Edilen Kolonlar ({apiPreviewResult.columns.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {apiPreviewResult.columns.map((col: any, i: number) => (
                          <div 
                            key={i} 
                            className={clsx('px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2', isDark ? 'bg-slate-800' : 'bg-slate-100')}
                          >
                            <span className={clsx('font-bold', theme.contentText)}>{col.name}</span>
                            <span className={clsx(
                              'px-1.5 py-0.5 rounded text-[10px] font-bold uppercase',
                              col.type === 'string' ? 'bg-blue-500/20 text-blue-400' :
                              col.type === 'integer' || col.type === 'decimal' ? 'bg-emerald-500/20 text-emerald-400' :
                              col.type === 'boolean' ? 'bg-purple-500/20 text-purple-400' :
                              col.type === 'date' ? 'bg-orange-500/20 text-orange-400' :
                              col.type === 'array' || col.type === 'object' ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-slate-500/20 text-slate-400'
                            )}>
                              {col.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Data Table */}
                  {apiPreviewResult.sampleData?.length > 0 && (
                    <div>
                      <h4 className={clsx('font-bold text-sm mb-2', theme.contentText)}>
                        Örnek Veri (ilk {Math.min(apiPreviewResult.sampleData.length, 20)} kayıt)
                      </h4>
                      <div className={clsx('overflow-auto max-h-[300px] rounded-xl border', isDark ? 'border-slate-700' : 'border-slate-200')}>
                        <table className="w-full text-sm">
                          <thead className={clsx('sticky top-0', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <tr>
                              {apiPreviewResult.columns?.slice(0, 8).map((col: any, i: number) => (
                                <th key={i} className={clsx('px-3 py-2 text-left font-bold border-b whitespace-nowrap', theme.contentText, isDark ? 'border-slate-700' : 'border-slate-200')}>
                                  {col.name}
                                </th>
                              ))}
                              {apiPreviewResult.columns?.length > 8 && (
                                <th className={clsx('px-3 py-2 text-left font-bold border-b', theme.contentTextMuted, isDark ? 'border-slate-700' : 'border-slate-200')}>
                                  +{apiPreviewResult.columns.length - 8} daha
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                            {apiPreviewResult.sampleData.map((row: any, rowIdx: number) => (
                              <tr key={rowIdx} className={clsx(isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                                {apiPreviewResult.columns?.slice(0, 8).map((col: any, colIdx: number) => (
                                  <td key={colIdx} className={clsx('px-3 py-2 max-w-[200px] truncate font-mono text-xs', theme.contentTextMuted)}>
                                    {typeof row[col.name] === 'object' 
                                      ? JSON.stringify(row[col.name]).slice(0, 50) + '...'
                                      : String(row[col.name] ?? '-')
                                    }
                                  </td>
                                ))}
                                {apiPreviewResult.columns?.length > 8 && (
                                  <td className={clsx('px-3 py-2 text-xs', theme.contentTextMuted)}>...</td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Response Structure */}
                  {apiPreviewResult.responseStructure && (
                    <div>
                      <h4 className={clsx('font-bold text-sm mb-2', theme.contentText)}>Response Yapısı</h4>
                      <pre className={clsx('p-4 rounded-xl text-xs overflow-auto font-mono', isDark ? 'bg-slate-900 text-emerald-400' : 'bg-slate-800 text-emerald-300')}>
                        {apiPreviewResult.responseStructure}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {!apiPreviewError && !apiPreviewResult && !apiPreviewLoading && (
                <div className="text-center py-12">
                  <Globe className={clsx('h-12 w-12 mx-auto mb-4 opacity-30', theme.contentTextMuted)} />
                  <p className={theme.contentTextMuted}>Endpoint'i girin ve <strong>Çalıştır</strong> butonuna tıklayın</p>
                  <p className={clsx('text-sm mt-2', theme.contentTextMuted)}>API'den dönen verileri göreceksiniz</p>
                </div>
              )}

              {apiPreviewLoading && (
                <div className="text-center py-12">
                  <Loader2 className={clsx('h-8 w-8 mx-auto mb-4 animate-spin', theme.contentTextMuted)} />
                  <p className={theme.contentTextMuted}>API'ye istek gönderiliyor...</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className={clsx('p-4 border-t flex justify-between items-center', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50')}>
              <div className={clsx('text-xs', theme.contentTextMuted)}>
                💡 <strong>İpucu:</strong> Response Path ile nested veriyi çıkarabilirsiniz (örn: <code className={clsx('px-1 rounded', isDark ? 'bg-slate-700' : 'bg-slate-200')}>articles</code> veya <code className={clsx('px-1 rounded', isDark ? 'bg-slate-700' : 'bg-slate-200')}>data.results</code>)
              </div>
              <button 
                onClick={() => setShowApiPreviewModal(false)} 
                className={clsx('px-5 py-2 font-bold rounded-xl', theme.buttonSecondary)}
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

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

// ============================================
// CONNECTION MODAL COMPONENT
// ============================================

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  editingConnection?: Connection | null
  theme: any
  isDark: boolean
}

type ConnectionCategory = 'database' | 'api' | 'excel'
type DbType = 'postgresql' | 'mssql' | 'mysql'
type ApiAuthType = 'none' | 'api_key' | 'bearer' | 'basic'

function ConnectionModal({ isOpen, onClose, onSuccess, editingConnection, theme, isDark }: ConnectionModalProps) {
  const { accessToken } = useAuthStore()
  
  // Ana kategori: database, api, excel
  const [category, setCategory] = useState<ConnectionCategory>('database')
  
  // Database ayarları
  const [dbType, setDbType] = useState<DbType>('postgresql')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('5432')
  const [database, setDatabase] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  
  // API ayarları
  const [apiBaseUrl, setApiBaseUrl] = useState('')
  const [apiAuthType, setApiAuthType] = useState<ApiAuthType>('none')
  const [apiKey, setApiKey] = useState('')
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key')
  const [bearerToken, setBearerToken] = useState('')
  const [basicUsername, setBasicUsername] = useState('')
  const [basicPassword, setBasicPassword] = useState('')
  
  // Excel/CSV ayarları
  const [fileType, setFileType] = useState<'xlsx' | 'csv'>('xlsx')
  const [filePath, setFilePath] = useState('')
  const [sheetName, setSheetName] = useState('')
  const [hasHeader, setHasHeader] = useState(true)
  
  // Ortak alanlar
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // API call helper
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'API hatası')
    }
    return data
  }

  // Düzenleme modunda form alanlarını doldur
  useEffect(() => {
    if (editingConnection) {
      setName(editingConnection.name || '')
      setDescription(editingConnection.description || '')
      
      if (editingConnection.type === 'api') {
        setCategory('api')
        setApiBaseUrl(editingConnection.host || '')
        // API auth config'i parse et
        const authConfig = (editingConnection.api_auth_config || {}) as any
        if (authConfig.type) {
          setApiAuthType(authConfig.type as ApiAuthType)
          if (authConfig.type === 'api_key') {
            setApiKey(authConfig.api_key || '')
            setApiKeyHeader(authConfig.header_name || 'X-API-Key')
          } else if (authConfig.type === 'bearer') {
            setBearerToken(authConfig.token || '')
          } else if (authConfig.type === 'basic') {
            setBasicUsername(authConfig.username || '')
            setBasicPassword(authConfig.password || '')
          }
        }
      } else if (editingConnection.type === 'excel') {
        setCategory('excel')
        setFilePath(editingConnection.host || '')
      } else {
        // Database
        setCategory('database')
        setDbType((editingConnection.type as DbType) || 'postgresql')
        setHost(editingConnection.host || '')
        setPort(String(editingConnection.port || 5432))
        setDatabase(editingConnection.database_name || '')
        setUsername(editingConnection.username || '')
        // Şifre güvenlik nedeniyle dolmuyor, kullanıcı yeniden girmeli
      }
    }
  }, [editingConnection])

  // DB type değişince port güncelle
  useEffect(() => {
    if (!editingConnection) {
      // Sadece yeni bağlantıda port otomatik değişsin
    if (dbType === 'postgresql') setPort('5432')
    else if (dbType === 'mssql') setPort('1433')
    else if (dbType === 'mysql') setPort('3306')
    }
  }, [dbType, editingConnection])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    setError(null)

    try {
      let testPayload: any = { category }
      
      if (category === 'database') {
        testPayload = {
          ...testPayload,
          type: dbType,
          host,
          port: parseInt(port),
          databaseName: database,
          username,
          password,
        }
      } else if (category === 'api') {
        testPayload = {
          ...testPayload,
          type: 'api',
          apiBaseUrl,
          apiAuthType,
          apiAuthConfig: apiAuthType === 'api_key' 
            ? { apiKey, headerName: apiKeyHeader }
            : apiAuthType === 'bearer'
            ? { token: bearerToken }
            : apiAuthType === 'basic'
            ? { username: basicUsername, password: basicPassword }
            : undefined
        }
      } else if (category === 'excel') {
        testPayload = {
          ...testPayload,
          type: 'excel',
          filePath,
          fileType,
          sheetName,
          hasHeader
        }
      }
      
      const result = await apiCall('/data/connections/test', {
        method: 'POST',
        body: JSON.stringify(testPayload)
      })
      setTestResult({ success: true, message: result.data?.message || 'Bağlantı başarılı!' })
    } catch (err: any) {
      setTestResult({ success: false, message: err.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!name) {
      setError('Bağlantı adı gerekli')
      return
    }
    
    if (category === 'database' && (!host || !database || !username)) {
      setError('Host, veritabanı adı ve kullanıcı adı gerekli')
      return
    }
    
    if (category === 'api' && !apiBaseUrl) {
      setError('API Base URL gerekli')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let savePayload: any = { name, description, category }
      
      if (category === 'database') {
        savePayload = {
          ...savePayload,
          type: dbType,
          host,
          port: parseInt(port),
          databaseName: database,
          username,
          password,
        }
      } else if (category === 'api') {
        savePayload = {
          ...savePayload,
          type: 'api',
          apiBaseUrl,
          apiAuthType,
          apiAuthConfig: apiAuthType === 'api_key' 
            ? { apiKey, headerName: apiKeyHeader }
            : apiAuthType === 'bearer'
            ? { token: bearerToken }
            : apiAuthType === 'basic'
            ? { username: basicUsername, password: basicPassword }
            : undefined
        }
      } else if (category === 'excel') {
        savePayload = {
          ...savePayload,
          type: 'excel',
          filePath,
          fileType,
          sheetName,
          hasHeader
        }
      }
      
      // Düzenleme modunda PUT, yeni bağlantıda POST
      if (editingConnection) {
        await apiCall(`/data/connections/${editingConnection.id}`, {
          method: 'PUT',
          body: JSON.stringify(savePayload)
        })
      } else {
      await apiCall('/data/connections', {
        method: 'POST',
        body: JSON.stringify(savePayload)
      })
      }
      onSuccess()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  const getCategoryIcon = () => {
    if (category === 'database') return <Database className="h-5 w-5 text-white" />
    if (category === 'api') return <Globe className="h-5 w-5 text-white" />
    return <FileSpreadsheet className="h-5 w-5 text-white" />
  }
  
  const getCategoryGradient = () => {
    if (category === 'database') return 'from-blue-500 to-indigo-600'
    if (category === 'api') return 'from-emerald-500 to-teal-600'
    return 'from-green-500 to-lime-600'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative w-full max-w-2xl rounded-2xl shadow-2xl', theme.cardBg)}>
        {/* Header */}
        <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <div className="flex items-center gap-3">
            <div className={clsx('w-10 h-10 bg-gradient-to-br rounded-xl flex items-center justify-center', getCategoryGradient())}>
              {getCategoryIcon()}
            </div>
            <div>
              <h2 className={clsx('text-lg font-bold', theme.contentText)}>
                {editingConnection ? 'Bağlantıyı Düzenle' : 'Yeni Bağlantı'}
              </h2>
              <p className={clsx('text-sm', theme.contentTextMuted)}>
                {editingConnection ? 'Bağlantı ayarlarını güncelleyin' : 'Veri kaynağı bağlantısı ekle'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={clsx('p-2 rounded-lg', theme.buttonSecondary)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {error}
            </div>
          )}

          {/* Kaynak Tipi Seçimi */}
          <div>
            <label className={clsx('block text-sm font-medium mb-3', theme.contentText)}>Kaynak Tipi *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { type: 'database' as ConnectionCategory, label: 'Veritabanı', icon: Database, color: 'blue', desc: 'PostgreSQL, MSSQL, MySQL' },
                { type: 'api' as ConnectionCategory, label: 'REST API', icon: Globe, color: 'emerald', desc: 'Web servisleri' },
                { type: 'excel' as ConnectionCategory, label: 'Excel / CSV', icon: FileSpreadsheet, color: 'green', desc: 'Dosya kaynakları' },
              ].map(({ type, label, icon: Icon, color, desc }) => (
                <button
                  key={type}
                  onClick={() => setCategory(type)}
                  className={clsx(
                    'p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2',
                    category === type 
                      ? `border-${color}-500 bg-${color}-500/10` 
                      : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                  )}
                >
                  <Icon className={clsx('h-6 w-6', category === type ? `text-${color}-500` : theme.contentTextMuted)} />
                  <span className={clsx('font-bold text-sm', theme.contentText)}>{label}</span>
                  <span className={clsx('text-xs', theme.contentTextMuted)}>{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bağlantı Adı - Her tip için ortak */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Bağlantı Adı *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Ana Veritabanı, Satış API, Günlük Rapor"
              className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          {/* ============================================ */}
          {/* DATABASE ALANLARI */}
          {/* ============================================ */}
          {category === 'database' && (
            <>
              <div className={clsx('border-t pt-4', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <h4 className={clsx('text-sm font-bold flex items-center gap-2 mb-4', theme.contentText)}>
                  <Database className="h-4 w-4 text-blue-500" /> Veritabanı Ayarları
                </h4>
                
                {/* DB Type */}
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Veritabanı Tipi</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'postgresql' as DbType, label: 'PostgreSQL' },
                      { type: 'mssql' as DbType, label: 'SQL Server' },
                      { type: 'mysql' as DbType, label: 'MySQL' },
                    ].map(({ type, label }) => (
                      <button
                        key={type}
                        onClick={() => setDbType(type)}
                        className={clsx(
                          'p-2 rounded-lg border-2 text-sm font-medium transition-all',
                          dbType === type
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                            : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Host & Port */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="col-span-2">
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Host *</label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      placeholder="localhost veya IP"
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Port</label>
                    <input
                      type="text"
                      value={port}
                      onChange={(e) => setPort(e.target.value)}
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                </div>

                {/* Database Name */}
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Veritabanı Adı *</label>
                  <input
                    type="text"
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    placeholder="database_name"
                    className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>

                {/* Username & Password */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kullanıcı Adı *</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Şifre</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ============================================ */}
          {/* API ALANLARI */}
          {/* ============================================ */}
          {category === 'api' && (
            <>
              <div className={clsx('border-t pt-4', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <h4 className={clsx('text-sm font-bold flex items-center gap-2 mb-4', theme.contentText)}>
                  <Globe className="h-4 w-4 text-emerald-500" /> API Ayarları
                </h4>
                
                {/* Base URL */}
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Base URL *</label>
                  <input
                    type="text"
                    value={apiBaseUrl}
                    onChange={(e) => setApiBaseUrl(e.target.value)}
                    placeholder="https://api.example.com/v1"
                    className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>

                {/* Auth Type */}
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kimlik Doğrulama</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { type: 'none' as ApiAuthType, label: 'Yok' },
                      { type: 'api_key' as ApiAuthType, label: 'API Key' },
                      { type: 'bearer' as ApiAuthType, label: 'Bearer Token' },
                      { type: 'basic' as ApiAuthType, label: 'Basic Auth' },
                    ].map(({ type, label }) => (
                      <button
                        key={type}
                        onClick={() => setApiAuthType(type)}
                        className={clsx(
                          'p-2 rounded-lg border-2 text-xs font-medium transition-all',
                          apiAuthType === type
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600'
                            : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* API Key alanları */}
                {apiAuthType === 'api_key' && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>API Key</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk_live_..."
                        className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      />
                    </div>
                    <div>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Header Adı</label>
                      <input
                        type="text"
                        value={apiKeyHeader}
                        onChange={(e) => setApiKeyHeader(e.target.value)}
                        placeholder="X-API-Key"
                        className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                      />
                    </div>
                  </div>
                )}

                {/* Bearer Token alanı */}
                {apiAuthType === 'bearer' && (
                  <div className="mb-4">
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Bearer Token</label>
                    <input
                      type="password"
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      placeholder="eyJhbGciOiJIUzI1NiIs..."
                      className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                )}

                {/* Basic Auth alanları */}
                {apiAuthType === 'basic' && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kullanıcı Adı</label>
                      <input
                        type="text"
                        value={basicUsername}
                        onChange={(e) => setBasicUsername(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      />
                    </div>
                    <div>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Şifre</label>
                      <input
                        type="password"
                        value={basicPassword}
                        onChange={(e) => setBasicPassword(e.target.value)}
                        className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ============================================ */}
          {/* EXCEL/CSV ALANLARI */}
          {/* ============================================ */}
          {category === 'excel' && (
            <>
              <div className={clsx('border-t pt-4', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <h4 className={clsx('text-sm font-bold flex items-center gap-2 mb-4', theme.contentText)}>
                  <FileSpreadsheet className="h-4 w-4 text-green-500" /> Excel / CSV Ayarları
                </h4>
                
                {/* File Type */}
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dosya Tipi</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFileType('xlsx')}
                      className={clsx(
                        'p-2 rounded-lg border-2 text-sm font-medium transition-all',
                        fileType === 'xlsx'
                          ? 'border-green-500 bg-green-500/10 text-green-600'
                          : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                      )}
                    >
                      Excel (.xlsx)
                    </button>
                    <button
                      onClick={() => setFileType('csv')}
                      className={clsx(
                        'p-2 rounded-lg border-2 text-sm font-medium transition-all',
                        fileType === 'csv'
                          ? 'border-green-500 bg-green-500/10 text-green-600'
                          : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                      )}
                    >
                      CSV (.csv)
                    </button>
                  </div>
                </div>

                {/* File Path */}
                <div className="mb-4">
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dosya Yolu veya URL</label>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="/data/sales.xlsx veya https://..."
                    className={clsx('w-full px-3 py-2 rounded-lg border font-mono text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>

                {/* Sheet Name (only for xlsx) */}
                {fileType === 'xlsx' && (
                  <div className="mb-4">
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sayfa Adı (Opsiyonel)</label>
                    <input
                      type="text"
                      value={sheetName}
                      onChange={(e) => setSheetName(e.target.value)}
                      placeholder="Sheet1 (boş bırakılırsa ilk sayfa)"
                      className={clsx('w-full px-3 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    />
                  </div>
                )}

                {/* Has Header */}
                <label className={clsx(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer',
                  isDark ? 'border-slate-700 hover:bg-slate-800' : 'border-slate-200 hover:bg-slate-50'
                )}>
                  <input
                    type="checkbox"
                    checked={hasHeader}
                    onChange={(e) => setHasHeader(e.target.checked)}
                    className="w-5 h-5 text-green-600 rounded"
                  />
                  <span className={clsx('font-medium text-sm', theme.contentText)}>İlk satır başlık satırı</span>
                </label>
              </div>
            </>
          )}

          {/* Açıklama - Her tip için ortak */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opsiyonel açıklama..."
              rows={2}
              className={clsx('w-full px-3 py-2 rounded-lg border resize-none', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={clsx(
              'p-3 rounded-lg flex items-center gap-2',
              testResult.success 
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500'
                : 'bg-red-500/10 border border-red-500/20 text-red-500'
            )}>
              {testResult.success ? <CheckCircle className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              <span className="text-sm">{testResult.message}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx('px-6 py-4 border-t flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <button
            onClick={handleTest}
            disabled={testing || (category === 'database' ? (!host || !database || !username) : (category === 'api' ? !apiBaseUrl : !filePath))}
            className={clsx(
              'px-4 py-2 rounded-lg flex items-center gap-2 transition-colors',
              (testing || (category === 'database' ? (!host || !database || !username) : (category === 'api' ? !apiBaseUrl : !filePath)))
                ? 'opacity-50 cursor-not-allowed'
                : '',
              theme.buttonSecondary
            )}
          >
            {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Bağlantıyı Test Et
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={clsx('px-4 py-2 rounded-lg', theme.buttonSecondary)}
            >
              İptal
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name || (category === 'database' ? (!host || !database || !username) : (category === 'api' ? !apiBaseUrl : !filePath))}
              className={clsx(
                'px-4 py-2 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 flex items-center gap-2',
                (saving || !name || (category === 'database' ? (!host || !database || !username) : (category === 'api' ? !apiBaseUrl : !filePath))) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editingConnection ? 'Güncelle' : 'Kaydet'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
