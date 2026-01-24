/**
 * Clixer - ClickHouse Tab Component
 * DataPage'den çıkarıldı - ClickHouse veri yönetimi
 */

import { 
  Zap,
  RefreshCw,
  Loader2,
  Eye,
  Trash2,
  Calendar,
  XCircle,
  X,
  AlertTriangle,
  Activity,
  Search,
  Download,
  Copy
} from 'lucide-react'
import clsx from 'clsx'
// Types defined locally since they may not be exported from store
interface ClickHouseTable {
  name: string
  total_rows?: number
  total_bytes?: number
  readable_size?: string
  engine?: string
  datasetName?: string
  isOrphan?: boolean
}

interface ChTableDetails {
  table?: ClickHouseTable & { partition_key?: string; sorting_key?: string }
  columns?: Array<{ name: string; type: string }>
  partitions?: Array<{ partition: string; rows: string }>
  sampleData?: any[]
}

interface ClickHouseTabProps {
  theme: any
  isDark: boolean
  clickhouseTables: ClickHouseTable[]
  clickhouseLoading: boolean
  showChTableModal: boolean
  selectedChTable: ChTableDetails | null
  systemActionLoading: string | null
  // Data Management Modal
  showDataManagementModal: boolean
  dataManagementTable: string
  dataManagementDatasetId: string | null
  dataManagementColumns: any[]
  dataManagementLoading: boolean
  dataManagementPreview: any
  dmActiveTab: 'delete' | 'validate'
  dmDateColumn: string
  dmDeleteMode: 'days' | 'range'
  dmDays: number
  dmStartDate: string
  dmEndDate: string
  pkColumn: string
  validationLoading: boolean
  comparisonData: any
  missingRanges: any
  duplicateAnalysis: any
  // Callbacks
  onRefresh: () => void
  onViewDetails: (tableName: string) => void
  onOptimize: (tableName: string) => void
  onTruncate: (tableName: string) => void
  onDelete: (tableName: string) => void
  onOpenDataManagement: (tableName: string, datasetId?: string) => void
  onCloseTableModal: () => void
  onCloseDataManagementModal: () => void
  // Data Management callbacks
  onSetDmActiveTab: (tab: 'delete' | 'validate') => void
  onSetDmDateColumn: (col: string) => void
  onSetDmDeleteMode: (mode: 'days' | 'range') => void
  onSetDmDays: (days: number) => void
  onSetDmStartDate: (date: string) => void
  onSetDmEndDate: (date: string) => void
  onSetPkColumn: (col: string) => void
  onPreviewDelete: () => void
  onExecuteDelete: () => void
  onLoadComparison: () => void
  onLoadMissingRanges: () => void
  onLoadDuplicateAnalysis: () => void
  onSyncMissingData: () => void
  onSyncNewRecordsOnly: () => void
  onClearComparisonData: () => void
}

export function ClickHouseTab({
  theme,
  isDark,
  clickhouseTables,
  clickhouseLoading,
  showChTableModal,
  selectedChTable,
  systemActionLoading,
  showDataManagementModal,
  dataManagementTable,
  dataManagementDatasetId,
  dataManagementColumns,
  dataManagementLoading,
  dataManagementPreview,
  dmActiveTab,
  dmDateColumn,
  dmDeleteMode,
  dmDays,
  dmStartDate,
  dmEndDate,
  pkColumn,
  validationLoading,
  comparisonData,
  missingRanges,
  duplicateAnalysis,
  onRefresh,
  onViewDetails,
  onOptimize,
  onTruncate,
  onDelete,
  onOpenDataManagement,
  onCloseTableModal,
  onCloseDataManagementModal,
  onSetDmActiveTab,
  onSetDmDateColumn,
  onSetDmDeleteMode,
  onSetDmDays,
  onSetDmStartDate,
  onSetDmEndDate,
  onSetPkColumn,
  onPreviewDelete,
  onExecuteDelete,
  onLoadComparison,
  onLoadMissingRanges,
  onLoadDuplicateAnalysis,
  onSyncMissingData,
  onSyncNewRecordsOnly,
  onClearComparisonData
}: ClickHouseTabProps) {

  const totalRows = clickhouseTables.reduce((acc, t) => acc + (t.total_rows || 0), 0)
  const totalBytes = clickhouseTables.reduce((acc, t) => acc + (t.total_bytes || 0), 0)
  const orphanCount = clickhouseTables.filter(t => t.isOrphan).length

  const formatSize = (bytes: number) => {
    if (bytes > 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
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
            onClick={onRefresh}
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
              {totalRows.toLocaleString('tr-TR')}
            </p>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Satır</p>
          </div>
          <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
            <p className={clsx('text-2xl font-bold', theme.contentText)}>
              {formatSize(totalBytes)}
            </p>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Boyut</p>
          </div>
          <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-100')}>
            <p className={clsx('text-2xl font-bold text-amber-500')}>{orphanCount}</p>
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
                {clickhouseTables.map((table) => (
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
                          onClick={() => onViewDetails(table.name)}
                          className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                          title="Detaylar"
                        >
                          <Eye className="w-4 h-4 text-slate-400" />
                        </button>
                        <button
                          onClick={() => onOptimize(table.name)}
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
                            const datasetId = table.name.startsWith('ds_') 
                              ? table.name.replace('ds_', '').replace(/_/g, '-')
                              : undefined
                            onOpenDataManagement(table.name, datasetId)
                          }}
                          className={clsx('p-1.5 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
                          title="Veri Yönetimi"
                        >
                          <Calendar className="w-4 h-4 text-cyan-400" />
                        </button>
                        <button
                          onClick={() => onTruncate(table.name)}
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
                            onClick={() => onDelete(table.name)}
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
                onClick={onCloseTableModal}
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
      
      {/* Veri Yönetimi Modalı */}
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
                onClick={onCloseDataManagementModal}
                className={clsx('p-2 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Tab Buttons */}
            <div className={clsx('px-6 py-3 border-b flex gap-2', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <button
                onClick={() => onSetDmActiveTab('delete')}
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
                onClick={() => onSetDmActiveTab('validate')}
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
                  {!dataManagementDatasetId && (
                    <div className="p-4 rounded-xl bg-amber-500/20 border border-amber-500/50">
                      <p className="text-sm text-amber-400">
                        ⚠️ Bu tablo bir dataset'e bağlı değil. Lütfen Datasets listesinden açın.
                      </p>
                    </div>
                  )}
                  
                  {dataManagementDatasetId && (
                    <>
                      <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                        <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                          🔑 Primary Key / ID Kolonu
                        </label>
                        <select
                          value={pkColumn}
                          onChange={(e) => {
                            onSetPkColumn(e.target.value)
                            onClearComparisonData()
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
                      
                      <div className="flex gap-2">
                        <button
                          onClick={onLoadComparison}
                          disabled={validationLoading}
                          className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                        >
                          {validationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                          Kaynak-Hedef Karşılaştır
                        </button>
                        <button
                          onClick={onLoadDuplicateAnalysis}
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
                                <th className={clsx('py-2 text-right', theme.contentTextMuted)}>Kaynak ({comparisonData.dataset?.connection_type})</th>
                                <th className={clsx('py-2 text-right', theme.contentTextMuted)}>ClickHouse</th>
                              </tr>
                            </thead>
                            <tbody className={theme.contentText}>
                              <tr className={clsx('border-b', isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                                <td className="py-2">Toplam Satır</td>
                                <td className={clsx('py-2 text-right font-mono', comparisonData.source?.error && 'text-red-400')}>
                                  {comparisonData.source?.error ? '⚠️ Hata' : comparisonData.source?.total_rows?.toLocaleString('tr-TR')}
                                </td>
                                <td className="py-2 text-right font-mono">{comparisonData.clickhouse?.total_rows?.toLocaleString('tr-TR')}</td>
                              </tr>
                              <tr className={clsx('border-b', isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                                <td className="py-2">Min ID</td>
                                <td className={clsx('py-2 text-right font-mono', comparisonData.source?.error && 'text-red-400')}>
                                  {comparisonData.source?.error ? '-' : comparisonData.source?.min_id?.toLocaleString('tr-TR')}
                                </td>
                                <td className="py-2 text-right font-mono">{comparisonData.clickhouse?.min_id?.toLocaleString('tr-TR')}</td>
                              </tr>
                              <tr className={clsx('border-b', isDark ? 'border-slate-700/50' : 'border-slate-100')}>
                                <td className="py-2">Max ID</td>
                                <td className={clsx('py-2 text-right font-mono', comparisonData.source?.error && 'text-red-400')}>
                                  {comparisonData.source?.error ? '-' : comparisonData.source?.max_id?.toLocaleString('tr-TR')}
                                </td>
                                <td className="py-2 text-right font-mono">{comparisonData.clickhouse?.max_id?.toLocaleString('tr-TR')}</td>
                              </tr>
                            </tbody>
                          </table>
                          
                          <div className={clsx('p-3 rounded-xl', comparisonData.diff?.row_difference === 0 ? 'bg-green-500/20 border border-green-500/50' : 'bg-amber-500/20 border border-amber-500/50')}>
                            <p className={clsx('text-sm font-medium', comparisonData.diff?.row_difference === 0 ? 'text-green-400' : 'text-amber-400')}>
                              {comparisonData.diff?.row_difference === 0 
                                ? '✅ Satır sayıları eşit!' 
                                : `⚠️ Fark: ${Math.abs(comparisonData.diff?.row_difference || 0).toLocaleString('tr-TR')} satır ${(comparisonData.diff?.row_difference || 0) > 0 ? '(Kaynakta fazla)' : '(ClickHouse\'da fazla - duplicate?)'}`
                              }
                            </p>
                            {comparisonData.diff?.has_duplicates && (
                              <p className="text-xs text-red-400 mt-1">🔴 Duplicate tespit edildi!</p>
                            )}
                          </div>
                          
                          {comparisonData.diff?.row_difference > 0 && (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={onSyncNewRecordsOnly}
                                disabled={validationLoading}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                                title="100M+ tablolar için önerilen!"
                              >
                                {validationLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                🚀 Yeni Kayıtları Çek
                              </button>
                              
                              <button
                                onClick={onLoadMissingRanges}
                                disabled={validationLoading}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm flex items-center justify-center gap-2"
                                title="Ortadaki boşlukları bulur."
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
                            Eksik ID Aralıkları ({missingRanges.missing_ranges?.length} aralık, ~{missingRanges.total_missing_estimate?.toLocaleString('tr-TR')} satır)
                          </p>
                          <div className={clsx('max-h-40 overflow-y-auto rounded-xl p-3', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            {missingRanges.missing_ranges?.slice(0, 20).map((range: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs font-mono py-1">
                                <span className={theme.contentTextMuted}>ID {range.start?.toLocaleString('tr-TR')} - {range.end?.toLocaleString('tr-TR')}</span>
                                <span className="text-amber-400">~{range.missing_count?.toLocaleString('tr-TR')} eksik</span>
                              </div>
                            ))}
                          </div>
                          
                          <button
                            onClick={onSyncMissingData}
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
                              ? `🔴 ~${duplicateAnalysis.duplicate_estimate?.toLocaleString('tr-TR')} duplicate satır (${duplicateAnalysis.duplicate_percentage}%)`
                              : '✅ Duplicate bulunamadı'
                            }
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className={theme.contentTextMuted}>Toplam: {duplicateAnalysis.total_rows?.toLocaleString('tr-TR')}</div>
                            <div className={theme.contentTextMuted}>Unique beklenen: {duplicateAnalysis.expected_unique?.toLocaleString('tr-TR')}</div>
                          </div>
                          {duplicateAnalysis.can_optimize && (
                            <button
                              onClick={() => onOptimize(dataManagementTable)}
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
                  <div>
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                      Tarih Kolonu
                    </label>
                    <select
                      value={dmDateColumn}
                      onChange={(e) => onSetDmDateColumn(e.target.value)}
                      className={clsx('w-full px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                    >
                      <option value="">Seçiniz...</option>
                      {dataManagementColumns.filter((c: any) => c.isDateColumn).map((col: any) => (
                        <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                      ))}
                      <optgroup label="Diğer Kolonlar">
                        {dataManagementColumns.filter((c: any) => !c.isDateColumn).map((col: any) => (
                          <option key={col.name} value={col.name}>{col.name} ({col.type})</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  
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
                          onChange={() => onSetDmDeleteMode('days')}
                          className="w-4 h-4 text-cyan-500"
                        />
                        <span className={clsx('text-sm', theme.contentText)}>Son X Gün</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="deleteMode"
                          checked={dmDeleteMode === 'range'}
                          onChange={() => onSetDmDeleteMode('range')}
                          className="w-4 h-4 text-cyan-500"
                        />
                        <span className={clsx('text-sm', theme.contentText)}>Tarih Aralığı</span>
                      </label>
                    </div>
                  </div>
                  
                  {dmDeleteMode === 'days' && (
                    <div>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                        Son Kaç Gün?
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          value={dmDays}
                          onChange={(e) => onSetDmDays(parseInt(e.target.value) || 0)}
                          min={0}
                          className={clsx('w-24 px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                        />
                        <span className={clsx('text-sm', theme.contentTextMuted)}>gün</span>
                        <div className="flex gap-2 ml-auto">
                          {[1, 3, 7, 14, 30].map(d => (
                            <button
                              key={d}
                              onClick={() => onSetDmDays(d)}
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
                  
                  {dmDeleteMode === 'range' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                          Başlangıç
                        </label>
                        <input
                          type="date"
                          value={dmStartDate}
                          onChange={(e) => onSetDmStartDate(e.target.value)}
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
                          onChange={(e) => onSetDmEndDate(e.target.value)}
                          className={clsx('w-full px-4 py-2 rounded-xl border', theme.inputBg, theme.inputBorder)}
                        />
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={onPreviewDelete}
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
                            {dataManagementPreview.rowsToDelete?.toLocaleString('tr-TR')} satır
                          </p>
                          <p className={clsx('text-sm', theme.contentTextMuted)}>
                            Toplam {dataManagementPreview.totalRows?.toLocaleString('tr-TR')} satırdan 
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
                onClick={onCloseDataManagementModal}
                className={clsx('px-4 py-2 rounded-xl', theme.buttonSecondary)}
              >
                İptal
              </button>
              <button
                onClick={onExecuteDelete}
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
  )
}
