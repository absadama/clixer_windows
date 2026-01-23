/**
 * Dataset Creation Modal Component
 * Modal for creating datasets from SQL query results
 */

import { useState } from 'react'
import { 
  X,
  RefreshCw,
  Save,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

// ============================================
// TYPES
// ============================================

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  clickhouseType?: string
}

interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  rowCount: number
  executionTime: number
}

interface ThemeConfig {
  cardBg: string
  contentText: string
  contentTextMuted: string
  inputBg: string
  inputText: string
  inputBorder: string
  buttonSecondary: string
}

export interface DatasetModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  
  // SQL data
  sqlResult: QueryResult | null
  sqlQuery: string
  sqlConnectionId: string
  
  // Theme
  theme: ThemeConfig
  isDark: boolean
}

// ============================================
// TYPE COMPATIBILITY CHECK
// ============================================

const SQL_TO_CLICKHOUSE_TYPE: Record<string, string> = {
  // Integer types
  'int': 'Int32', 'int4': 'Int32', 'integer': 'Int32',
  'int2': 'Int16', 'smallint': 'Int16',
  'int8': 'Int64', 'bigint': 'Int64',
  'serial': 'Int32', 'bigserial': 'Int64', 'smallserial': 'Int16',
  'oid': 'UInt32',
  'tinyint': 'Int8', 'mediumint': 'Int32', 'year': 'Int16',
  'number': 'Float64', 'pls_integer': 'Int32', 'binary_integer': 'Int32',
  
  // Float types
  'float': 'Float64', 'float4': 'Float32', 'float8': 'Float64',
  'real': 'Float32', 'double': 'Float64', 'double precision': 'Float64',
  'decimal': 'Float64', 'numeric': 'Float64', 'money': 'Float64',
  'newdecimal': 'Float64',
  'smallmoney': 'Float64',
  'binary_float': 'Float32', 'binary_double': 'Float64',
  
  // String types
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
  
  // Date/Time types
  'date': 'Date', 'time': 'String', 'timetz': 'String', 'interval': 'String',
  'timestamp': 'DateTime', 'timestamptz': 'DateTime',
  'timestamp without time zone': 'DateTime', 'timestamp with time zone': 'DateTime',
  'datetime': 'DateTime', 'newdate': 'Date',
  'datetime2': 'DateTime', 'smalldatetime': 'DateTime', 'datetimeoffset': 'DateTime',
  'timestamp with local time zone': 'DateTime',
  
  // Boolean types
  'boolean': 'UInt8', 'bool': 'UInt8', 'bit': 'UInt8',
  
  // Binary types
  'bytea': 'String',
  'blob': 'String', 'tinyblob': 'String', 'mediumblob': 'String', 'longblob': 'String',
  'binary': 'String', 'varbinary': 'String',
  'image': 'String',
  'raw': 'String', 'long raw': 'String', 'bfile': 'String',
  
  // Geometry types
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
  
  const isDateType = ['date', 'datetime', 'datetime2', 'timestamp', 'smalldatetime', 'time'].some(t => normalizedSource.includes(t))
  
  if (!sourceType) {
    return { 
      chType: 'String', 
      compatible: false, 
      suggestion: 'Kaynak tipi bilinmiyor. Varsayılan String kullanılacak.',
      isDateType: false
    }
  }
  
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
// API HELPER
// ============================================

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// ============================================
// COMPONENT
// ============================================

export function DatasetModal({
  isOpen,
  onClose,
  onSuccess,
  sqlResult,
  sqlQuery,
  sqlConnectionId,
  theme,
  isDark
}: DatasetModalProps) {
  const { accessToken } = useAuthStore()
  
  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [syncStrategy, setSyncStrategy] = useState('full_refresh')
  const [syncSchedule, setSyncSchedule] = useState('manual')
  const [scheduledHour, setScheduledHour] = useState(2)
  const [referenceColumn, setReferenceColumn] = useState('')
  const [rowLimit, setRowLimit] = useState<number | null>(null)
  const [deleteDays, setDeleteDays] = useState(1)
  const [customWhere, setCustomWhere] = useState('')
  
  // Partition settings
  const [partitionColumn, setPartitionColumn] = useState('')
  const [partitionType, setPartitionType] = useState<'monthly' | 'daily'>('monthly')
  const [refreshWindowDays, setRefreshWindowDays] = useState(7)
  const [detectModified, setDetectModified] = useState(false)
  const [modifiedColumn, setModifiedColumn] = useState('')
  const [weeklyFullRefresh, setWeeklyFullRefresh] = useState(false)
  const [engineType, setEngineType] = useState<'MergeTree' | 'ReplacingMergeTree'>('MergeTree')
  
  // RLS columns
  const [rlsStoreColumn, setRlsStoreColumn] = useState('')
  const [rlsRegionColumn, setRlsRegionColumn] = useState('')
  const [rlsGroupColumn, setRlsGroupColumn] = useState('')
  
  // Unique column
  const [uniqueColumn, setUniqueColumn] = useState('')
  
  // Loading state
  const [creating, setCreating] = useState(false)

  // API call helper
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    })
    
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'API hatası')
    return data
  }

  // Handle create dataset
  const handleSubmit = async () => {
    if (!name || !sqlResult || !sqlConnectionId) {
      toast.error('Dataset adı ve SQL sonucu gerekli')
      return
    }
    
    // Unique column warning
    if (!uniqueColumn) {
      const confirmCreate = confirm(
        '⚠️ Unique Kolon Seçilmedi!\n\n' +
        'View veya aggregate sorgularda unique kolon olmayabilir.\n\n' +
        '• Unique kolon YOKSA: Tüm kolonlar ORDER BY olarak kullanılır\n' +
        '• Bu durumda ID-Based sync ÇALIŞMAZ\n' +
        '• Full Refresh veya Timestamp-Based sync kullanmanız önerilir\n\n' +
        'Devam etmek istiyor musunuz?'
      )
      if (!confirmCreate) return
    }

    setCreating(true)
    try {
      const columnMapping = sqlResult.columns.map(col => ({
        sourceName: col.name,
        targetName: col.name,
        sourceType: col.type,
        clickhouseType: col.clickhouseType,
        include: true
      }))

      const result = await apiCall('/data/datasets', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          connectionId: sqlConnectionId,
          sourceType: 'query',
          sourceQuery: sqlQuery,
          columnMapping,
          syncStrategy,
          syncSchedule,
          scheduledHour: syncSchedule === 'daily' ? scheduledHour : null,
          referenceColumn: referenceColumn || null,
          rowLimit,
          deleteDays: syncStrategy === 'date_delete_insert' ? deleteDays : null,
          storeColumn: rlsStoreColumn || null,
          regionColumn: rlsRegionColumn || null,
          groupColumn: rlsGroupColumn || null,
          partitionColumn: partitionColumn || null,
          partitionType,
          refreshWindowDays,
          detectModified,
          modifiedColumn: detectModified ? modifiedColumn : null,
          weeklyFullRefresh,
          engineType,
          customWhere: customWhere || null,
          uniqueColumn
        })
      })

      toast.success(`Dataset "${name}" başarıyla oluşturuldu! Tablo: ${result.data.clickhouseTable}`)
      
      // Reset form
      setName('')
      setDescription('')
      setSyncStrategy('full_refresh')
      setSyncSchedule('manual')
      setReferenceColumn('')
      setRowLimit(null)
      setCustomWhere('')
      setPartitionColumn('')
      setRlsStoreColumn('')
      setRlsRegionColumn('')
      setRlsGroupColumn('')
      setUniqueColumn('')
      
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Dataset oluşturulurken hata: ' + (err.message || 'Bilinmeyen hata'))
    } finally {
      setCreating(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={clsx('w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col', theme.cardBg)}>
        {/* Header */}
        <div className={clsx('p-6 border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <div className="flex items-center justify-between">
            <h2 className={clsx('text-xl font-bold', theme.contentText)}>Dataset Oluştur</h2>
            <button 
              onClick={onClose}
              className={clsx('p-2 rounded-lg', theme.buttonSecondary)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>
            SQL sorgu sonuçlarını Clixer'a kaydedin
          </p>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Dataset Name */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dataset Adı *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Günlük Satışlar"
              className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          {/* Description */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Açıklama</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dataset açıklaması..."
              rows={2}
              className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          {/* Sync Settings */}
          <div className={clsx('p-4 rounded-xl border-2', isDark ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-indigo-50 border-indigo-300')}>
            <h4 className={clsx('font-semibold mb-3 flex items-center gap-2', theme.contentText)}>
              ⚙️ Sync Ayarları
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Stratejisi</label>
                <select 
                  value={syncStrategy}
                  onChange={(e) => setSyncStrategy(e.target.value)}
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
                  value={syncSchedule}
                  onChange={(e) => setSyncSchedule(e.target.value)}
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
                
                {/* Hour selection for daily schedule */}
                {syncSchedule === 'daily' && (
                  <div className="mt-3">
                    <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                      🕐 Çalışma Saati
                    </label>
                    <select 
                      value={scheduledHour}
                      onChange={(e) => setScheduledHour(parseInt(e.target.value))}
                      className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {String(i).padStart(2, '0')}:00 {i >= 0 && i < 6 ? '🌙' : i >= 6 && i < 12 ? '🌅' : i >= 12 && i < 18 ? '☀️' : '🌆'}
                        </option>
                      ))}
                    </select>
                    <p className={clsx('mt-1 text-xs', theme.contentTextMuted)}>
                      💡 Önerilen: Gece saatleri (02:00-04:00) - Sunucu yükü düşük
                    </p>
                  </div>
                )}
              </div>
            </div>
              
            {/* Row Limit */}
            <div className="mt-4">
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                Satır Limiti
                <span className={clsx('ml-2 font-normal', theme.contentTextMuted)}>(Boş = Sınırsız)</span>
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={rowLimit ?? ''}
                  onChange={(e) => setRowLimit(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Örn: 50000000 (50M)"
                  className={clsx('flex-1 px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
                <div className="flex gap-1">
                  {[1000000, 10000000, 50000000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setRowLimit(val)}
                      className={clsx('px-3 py-2 rounded-lg text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                    >
                      {val / 1000000}M
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setRowLimit(null)}
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

            {/* Full Refresh Custom WHERE */}
            {syncStrategy === 'full_refresh' && (
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
              </div>
            )}

            {/* Date Delete Insert Settings */}
            {syncStrategy === 'date_delete_insert' && (
              <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-orange-900/30 border-orange-500/50' : 'bg-orange-100 border-orange-300')}>
                <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                  📅 Tarih Bazlı Sil-Yaz Ayarları
                </h5>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Tarih Kolonu *</label>
                    <select
                      value={referenceColumn}
                      onChange={(e) => setReferenceColumn(e.target.value)}
                      className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                    >
                      <option value="">Tarih kolonu seçin</option>
                      {sqlResult?.columns?.map(col => (
                        <option key={col.name} value={col.name}>{col.name}</option>
                      ))}
                    </select>
                  </div>
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
              </div>
            )}

            {/* RLS Settings */}
            <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-purple-900/20 border-purple-500/30' : 'bg-purple-50 border-purple-200')}>
              <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                🔐 Satır Güvenliği (Row-Level Security)
                <span className={clsx('text-xs font-normal', theme.contentTextMuted)}>(Opsiyonel)</span>
              </h5>
              
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>🏪 Mağaza Kolonu</label>
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
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>🗺️ Bölge Kolonu</label>
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
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>🏢 Grup Kolonu</label>
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
                </div>
              </div>
            </div>

            {/* Date Partition Settings */}
            {syncStrategy === 'date_partition' && (
              <div className={clsx('mt-4 p-4 rounded-xl border', isDark ? 'bg-blue-900/30 border-blue-500/50' : 'bg-blue-100 border-blue-300')}>
                <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                  📊 Partition & Refresh Ayarları (Big Data)
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
                      {sqlResult?.columns?.map(col => (
                        <option key={col.name} value={col.name}>{col.name}</option>
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
                      <option value="MergeTree">MergeTree (Hızlı)</option>
                      <option value="ReplacingMergeTree">ReplacingMergeTree (Upsert)</option>
                    </select>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-500/30">
                  <label className="flex items-center gap-2 cursor-pointer">
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

                <div className="mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                </div>
              </div>
            )}
          </div>

          {/* SQL Query Preview */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>SQL Sorgusu</label>
            <pre className={clsx('p-3 rounded-lg text-xs overflow-x-auto max-h-16', isDark ? 'bg-slate-900 text-slate-300' : 'bg-slate-100 text-slate-700')}>
              {sqlQuery}
            </pre>
          </div>

          {/* Column Mapping */}
          {sqlResult && (
            <details className={clsx('rounded-lg border', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <summary className={clsx('px-4 py-2 cursor-pointer font-medium', theme.contentText)}>
                Kolonlar ({sqlResult.columns.length}) - Detayları göster
              </summary>
              <div className="max-h-64 overflow-y-auto">
                {/* Type compatibility summary */}
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
                        </div>
                      </div>
                    )
                  }
                  
                  const dateCols = sqlResult.columns.filter(col => {
                    const info = getTypeCompatibilityInfo(col.type)
                    return info.isDateType
                  })
                  
                  return (
                    <div className={clsx('p-3 mb-2 rounded-lg border flex items-center gap-2', isDark ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')}>
                      <CheckCircle className="h-5 w-5" />
                      <span className="text-sm font-medium">✅ Tüm kolonlar uyumlu</span>
                    </div>
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
                                <Clock className="h-4 w-4 inline-block text-amber-500" />
                              ) : (
                                <CheckCircle className="h-4 w-4 inline-block text-emerald-500" />
                              )
                            ) : (
                              <AlertCircle className="h-4 w-4 inline-block text-red-500" />
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

        {/* Footer */}
        <div className={clsx('p-6 border-t flex justify-end gap-3', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <button
            onClick={onClose}
            className={clsx('px-4 py-2 rounded-lg', theme.buttonSecondary)}
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name || !sqlResult || creating}
            className={clsx(
              'px-4 py-2 rounded-lg font-medium flex items-center gap-2',
              'bg-gradient-to-r from-indigo-500 to-purple-500 text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {creating ? (
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
  )
}

export default DatasetModal
