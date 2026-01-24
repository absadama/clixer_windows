/**
 * Clixer - Preview Modal Component
 * DataPage'den çıkarıldı - Dataset önizleme
 */

import { 
  Eye,
  RefreshCw,
  Loader2,
  X,
  Calendar,
  ChevronDown,
  Clock,
  Database,
  Play
} from 'lucide-react'
import clsx from 'clsx'

interface PreviewModalProps {
  theme: any
  isDark: boolean
  isOpen: boolean
  dataset: any
  previewData: any
  previewLoading: boolean
  syncingDatasetId: string | null
  onClose: () => void
  onSync: (datasetId: string, triggerType: string) => void
  onPartialRefresh: (datasetId: string, days: number) => void
  formatTimeAgo: (date: string, short?: boolean) => string
}

export function PreviewModal({
  theme,
  isDark,
  isOpen,
  dataset,
  previewData,
  previewLoading,
  syncingDatasetId,
  onClose,
  onSync,
  onPartialRefresh,
  formatTimeAgo
}: PreviewModalProps) {
  if (!isOpen || !dataset) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={clsx('rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col', theme.cardBg)}>
        <div className={clsx('p-6 border-b flex items-center justify-between', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className={clsx('font-bold text-lg', theme.contentText)}>{dataset.name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <code className={clsx('px-1.5 py-0.5 rounded text-xs', isDark ? 'bg-slate-700' : 'bg-slate-100')}>
                  {dataset.clickhouse_table}
                </code>
                <span className={clsx(
                  'px-2 py-0.5 rounded text-xs font-medium',
                  dataset.status === 'active' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                  dataset.status === 'syncing' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') :
                  dataset.status === 'error' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') :
                  (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                )}>
                  {dataset.status === 'active' ? 'Aktif' :
                   dataset.status === 'syncing' ? 'Sync...' :
                   dataset.status === 'error' ? 'Hata' : dataset.status}
                </span>
                {(dataset.total_rows || dataset.last_sync_rows) && (
                  <span className={clsx('text-xs', theme.contentTextMuted)}>
                    {(dataset.total_rows || dataset.last_sync_rows)?.toLocaleString()} satır
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Normal Sync */}
            <button 
              onClick={() => onSync(dataset.id, 'manual_sync')}
              disabled={syncingDatasetId === dataset.id}
              className={clsx(
                "px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 hover:bg-emerald-600 transition-all",
                syncingDatasetId === dataset.id && "opacity-50 cursor-not-allowed"
              )}
              title={syncingDatasetId === dataset.id ? 'Sync başlatılıyor...' : 'Şimdi Sync Et'}
            >
              {syncingDatasetId === dataset.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {syncingDatasetId === dataset.id ? 'Başlatılıyor...' : 'Sync'}
            </button>
            
            {/* Partial Refresh */}
            {dataset.partition_column && (
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
                      onClick={() => onPartialRefresh(dataset.id, opt.days)}
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
            
            <button onClick={onClose} className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
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
                    {previewData.columns.map((col: any, i: number) => (
                      <th key={i} className={clsx('px-4 py-3 text-left font-medium', theme.contentText)}>
                        {typeof col === 'string' ? col : col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={clsx('divide-y', isDark ? 'divide-slate-700' : 'divide-slate-200')}>
                  {previewData.rows.map((row: any, rowIdx: number) => (
                    <tr key={rowIdx} className={clsx(isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                      {previewData.columns.map((col: any, colIdx: number) => {
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
                  onClose()
                  onSync(dataset.id, 'manual_sync')
                }}
                disabled={syncingDatasetId === dataset.id}
                className={clsx(
                  "mt-4 px-4 py-2 bg-indigo-500 text-white rounded-lg flex items-center gap-2 hover:bg-indigo-600 transition-all",
                  syncingDatasetId === dataset.id && "opacity-50 cursor-not-allowed"
                )}
              >
                {syncingDatasetId === dataset.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {syncingDatasetId === dataset.id ? 'Başlatılıyor...' : 'Şimdi Sync Et'}
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
            {dataset.last_sync_at && (
              <span className={clsx('flex items-center gap-1', theme.contentTextMuted)}>
                <Clock className="h-3.5 w-3.5" />
                Son sync: {formatTimeAgo(dataset.last_sync_at, true)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className={clsx('px-4 py-2 rounded-lg', theme.buttonSecondary)}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
