/**
 * Clixer - Datasets Tab Component
 * DataPage'den çıkarıldı - Dataset yönetimi ve ETL Worker durumu
 */

import { 
  Table,
  Plus,
  Play,
  Eye,
  Settings,
  RefreshCw,
  Loader2,
  Zap,
  Square,
  CheckCircle,
  XCircle
} from 'lucide-react'
import clsx from 'clsx'
import { Dataset, ETLWorkerStatus } from '../../stores/dataStore'

interface DatasetsTabProps {
  theme: any
  isDark: boolean
  datasets: Dataset[]
  workerStatus: ETLWorkerStatus | null
  triggeringAll: boolean
  syncingDatasetId: string | null
  onRefreshWorkerStatus: () => void
  onStartWorker: () => void
  onRestartWorker: () => void
  onStopWorker: () => void
  onTriggerAllSync: () => void
  onTriggerSync: (datasetId: string) => void
  onPreviewDataset: (dataset: Dataset) => void
  onSettingsDataset: (dataset: Dataset) => void
  onShowDatasetModal: () => void
  formatTimeAgo: (dateStr: string) => string
  getStatusColor: (status: string) => string
  translateErrorMessage: (msg: string) => string
}

export function DatasetsTab({
  theme,
  isDark,
  datasets,
  workerStatus,
  triggeringAll,
  syncingDatasetId,
  onRefreshWorkerStatus,
  onStartWorker,
  onRestartWorker,
  onStopWorker,
  onTriggerAllSync,
  onTriggerSync,
  onPreviewDataset,
  onSettingsDataset,
  onShowDatasetModal,
  formatTimeAgo,
  getStatusColor,
  translateErrorMessage
}: DatasetsTabProps) {

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'completed': return CheckCircle
      case 'error':
      case 'failed': return XCircle
      default: return RefreshCw
    }
  }

  return (
    <>
      {/* ETL WORKER STATUS PANEL */}
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
              {workerStatus?.activeJobs && workerStatus.activeJobs > 0 && (
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
            onClick={onRefreshWorkerStatus}
            className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
            title="Durumu Yenile"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          
          {/* Worker Control Buttons */}
          {workerStatus?.status !== 'running' ? (
            <button
              onClick={onStartWorker}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                isDark ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              )}
            >
              <Play className="h-4 w-4" />
              Worker'ı Başlat
            </button>
          ) : (
            <>
              <button
                onClick={onRestartWorker}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors',
                  isDark ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                )}
              >
                <RefreshCw className="h-4 w-4" />
                Yeniden Başlat
              </button>
              <button
                onClick={onStopWorker}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors',
                  isDark ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
                )}
              >
                <Square className="h-4 w-4" />
                Durdur
              </button>
            </>
          )}
          
          <button
            onClick={onTriggerAllSync}
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

      {/* DATASETS TABLE */}
      <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
        <div className={clsx('px-6 py-4 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
          <h3 className={clsx('font-bold', theme.contentText)}>Dataset'ler</h3>
          <button 
            onClick={onShowDatasetModal}
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
                          onClick={() => onTriggerSync(dataset.id)}
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
                          onClick={() => onPreviewDataset(dataset)}
                          className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)} 
                          title="Önizle"
                        >
                          <Eye className={clsx('h-4 w-4', theme.contentTextMuted)} />
                        </button>
                        <button 
                          onClick={() => onSettingsDataset(dataset)}
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
    </>
  )
}
