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
import { useDataStore } from '../stores/dataStore'
import { DatasetModal, ConnectionsTab, SqlEditorTab, DatasetsTab, ETLHistoryTab, ClickHouseTab, SystemHealthTab, PerformanceTab, PreviewModal, SettingsModal, ApiPreviewModal, ConnectionModal } from '../components/data'
import { sqlToClickHouseType, getTypeCompatibilityInfo, getTypeColor } from '../services/typeMapping'
import { copyToClipboard, translateErrorMessage, formatTimeAgo, formatDuration } from '../services/formatters'
import type { Connection, TableInfo, ColumnInfo, Dataset, ETLJob, Schedule, ETLWorkerStatus, QueryResult } from '../types/data'
import { isJobStuck, cronToShortCode } from '../types/data'
import { useDatasetSettings } from '../hooks/useDatasetSettings'
import { useClickHouseManagement } from '../hooks/useClickHouseManagement'
import { useSqlEditor } from '../hooks/useSqlEditor'
import { useApiPreviewState } from '../hooks/useApiPreviewState'
import { useSystemState } from '../hooks/useSystemState'
import { useDataApi } from '../hooks/useDataApi'
import { useClickHouseApi } from '../hooks/useClickHouseApi'

// API Base URL
const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Types ve helper fonksiyonları types/data.ts'den import ediliyor

// ============================================
// COMPONENT
// ============================================

export default function DataPage() {
  const { theme, isDark } = useTheme()
  const { accessToken, logout } = useAuthStore()
  
  // Custom Hooks
  const datasetSettings = useDatasetSettings()
  const chManagement = useClickHouseManagement()
  const sqlEditor = useSqlEditor()
  const apiPreview = useApiPreviewState()
  const systemState = useSystemState()
  
  // Zustand Store - Enterprise standart (17 state store'da)
  const {
    connections, setConnections,
    datasets, setDatasets,
    etlJobs, setETLJobs,
    schedules, setSchedules,
    workerStatus, setWorkerStatus,
    error, setError,
    triggeringAll, setTriggeringAll,
    showConnectionModal, setShowConnectionModal,
    showDatasetModal, setShowDatasetModal,
    showPreviewModal, setShowPreviewModal,
    showSettingsModal, setShowSettingsModal,
    selectedConnection, setSelectedConnection,
    editingConnection, setEditingConnection,
    selectedDataset, setSelectedDataset,
    previewData, setPreviewData,
    previewLoading, setPreviewLoading,
  } = useDataStore()
  
  // Lokal UI State (1 useState - limit 10'un altında)
  const [activeTab, setActiveTab] = useState<'connections' | 'datasets' | 'etl' | 'sql' | 'clickhouse' | 'system' | 'performance'>('connections')

  // System state from hook
  const {
    systemHealth, systemHealthLoading, systemActionLoading, systemAutoRefresh,
    performanceData, performanceLoading, performanceActionLoading, etlMonitoring,
    setSystemHealth, setSystemHealthLoading, setSystemActionLoading, setSystemAutoRefresh,
    setPerformanceData, setPerformanceLoading, setPerformanceActionLoading, setEtlMonitoring
  } = systemState
  
  // Destructure hook values for easier access
  const {
    clickhouseTables, clickhouseLoading, selectedChTable, showChTableModal,
    showDataManagementModal, dataManagementTable, dataManagementDatasetId,
    dataManagementColumns, dataManagementLoading, dataManagementPreview,
    dmDateColumn, dmDeleteMode, dmDays, dmStartDate, dmEndDate, dmActiveTab,
    comparisonData, missingRanges, duplicateAnalysis, validationLoading, pkColumn,
    setClickhouseTables, setClickhouseLoading, setSelectedChTable, setShowChTableModal,
    setShowDataManagementModal, setDataManagementTable, setDataManagementDatasetId,
    setDataManagementColumns, setDataManagementLoading, setDataManagementPreview,
    setDmDateColumn, setDmDeleteMode, setDmDays, setDmStartDate, setDmEndDate, setDmActiveTab,
    setComparisonData, setMissingRanges, setDuplicateAnalysis, setValidationLoading, setPkColumn,
    clearComparisonData
  } = chManagement
  
  const {
    newDatasetName, newDatasetDescription, newDatasetSyncStrategy, newDatasetSyncSchedule,
    scheduledHour, newDatasetReferenceColumn, newDatasetRowLimit, settingsColumns, datasetCreating,
    partitionColumn, partitionType, refreshWindowDays, detectModified, modifiedColumn,
    weeklyFullRefresh, engineType, customWhere, deleteDays,
    rlsStoreColumn, rlsRegionColumn, rlsGroupColumn, uniqueColumn, autoDetectedUnique,
    setNewDatasetName, setNewDatasetDescription, setNewDatasetSyncStrategy, setNewDatasetSyncSchedule,
    setScheduledHour, setNewDatasetReferenceColumn, setNewDatasetRowLimit, setSettingsColumns, setDatasetCreating,
    setPartitionColumn, setPartitionType, setRefreshWindowDays, setDetectModified, setModifiedColumn,
    setWeeklyFullRefresh, setEngineType, setCustomWhere, setDeleteDays,
    setRlsStoreColumn, setRlsRegionColumn, setRlsGroupColumn, setUniqueColumn, setAutoDetectedUnique
  } = datasetSettings
  
  const {
    sqlQuery, sqlConnectionId, sqlResult, sqlLoading, sqlError,
    tables, expandedTable, tableColumns,
    setSqlQuery, setSqlConnectionId, setSqlResult, setSqlLoading, setSqlError,
    setTables, setExpandedTable, setTableColumns, addTableColumns
  } = sqlEditor
  
  const {
    showApiPreviewModal, apiPreviewConnection, apiEndpoint, apiMethod,
    apiQueryParams, apiResponsePath, apiBody, apiPreviewLoading,
    apiPreviewResult, apiPreviewError, showApiDatasetForm, apiDatasetName,
    apiSelectedColumns, apiDatasetSaving, apiSyncSchedule, apiRowLimit,
    setShowApiPreviewModal, setApiPreviewConnection, setApiEndpoint, setApiMethod,
    setApiQueryParams, setApiResponsePath, setApiBody, setApiPreviewLoading,
    setApiPreviewResult, setApiPreviewError, setShowApiDatasetForm, setApiDatasetName,
    setApiSelectedColumns, setApiDatasetSaving, setApiSyncSchedule, setApiRowLimit,
    closeApiPreview
  } = apiPreview

  // Data API Hook
  const dataApi = useDataApi({
    setConnections, setDatasets, setETLJobs, setSchedules, setWorkerStatus,
    setError, setSqlConnectionId, sqlConnectionId,
    setSystemHealth, setSystemHealthLoading, setSystemActionLoading, setEtlMonitoring,
    setPerformanceData, setPerformanceLoading, setPerformanceActionLoading,
    setClickhouseTables, setClickhouseLoading
  })
  
  const {
    apiCall, loadConnections, loadDatasets, loadETLJobs, loadSchedules,
    loadWorkerStatus, loadSystemHealth, loadEtlMonitoring, deleteLock, deleteAllLocks,
    cancelJob, loadClickhouseTables, loadPostgresPerformance, loadClickhousePerformance,
    loadEtlPerformance, loadConnectionPerformance, loadAllPerformance, runVacuum, runReindex,
    optimizeChTable: optimizeChTablePerf
  } = dataApi

  // ClickHouse API Hook
  const chApi = useClickHouseApi({
    apiCall, loadClickhouseTables, loadETLJobs,
    setSystemActionLoading, setSelectedChTable, setShowChTableModal,
    setShowDataManagementModal, setDataManagementTable, setDataManagementDatasetId,
    setDataManagementColumns, setDataManagementLoading, setDataManagementPreview,
    setDmDateColumn, setDmDays, setDmStartDate, setDmEndDate, setDmActiveTab,
    setComparisonData, setMissingRanges, setDuplicateAnalysis, setValidationLoading,
    dataManagementTable, dataManagementDatasetId, dataManagementPreview,
    dmDateColumn, dmDeleteMode, dmDays, dmStartDate, dmEndDate, pkColumn,
    comparisonData, missingRanges
  })
  
  const {
    viewChTableDetails, truncateChTable, optimizeChTable, deleteChTable,
    openDataManagementModal, loadComparison, loadMissingRanges, loadDuplicateAnalysis,
    syncMissingData, syncNewRecordsOnly, previewDataManagementDelete, executeDataManagementDelete
  } = chApi

  // Edit connection
  const editConnection = (conn: Connection) => {
    setEditingConnection(conn)
    setShowConnectionModal(true)
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
      addTableColumns(tableName, result.data?.columns || [])
    } catch (err: any) {
      console.error('Load columns error:', err)
      addTableColumns(tableName, [])
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

  // Sync durumu - store'dan
  const { syncingDatasetId, setSyncingDatasetId } = useDataStore()

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
  const hasRunningJobs = etlJobs.some(j => j.status === 'running' || j.status === 'pending')
  
  useEffect(() => {
    if (!hasRunningJobs) return
    
    const interval = setInterval(() => {
      loadETLJobs()
      loadDatasets()
    }, 2000) // Refresh every 2 seconds for smoother progress
    
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasRunningJobs]) // Running job varlığına göre interval başlat/durdur

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
  // Utility fonksiyonları services/formatters.ts'den import ediliyor

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
