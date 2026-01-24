/**
 * Clixer - ETL History Tab Component
 * DataPage'den çıkarıldı - ETL işlem geçmişi ve schedule yönetimi
 */

import { 
  Clock,
  RefreshCw,
  Zap,
  ArrowRight,
  AlertCircle,
  XCircle,
  CheckCircle,
  Info,
  Loader2
} from 'lucide-react'
import clsx from 'clsx'
import { ETLJob, Schedule } from '../../stores/dataStore'

interface ETLHistoryTabProps {
  theme: any
  isDark: boolean
  etlJobs: ETLJob[]
  schedules: Schedule[]
  onRefreshSchedules: () => void
  onRefreshJobs: () => void
  onUpdateScheduleInterval: (datasetId: string, interval: string) => void
  onToggleSchedule: (scheduleId: string, isActive: boolean) => void
  onKillJob: (jobId: string, datasetName: string) => void
  formatTimeAgo: (dateStr: string, showTime?: boolean) => string
  formatDuration: (seconds: number) => string
  getStatusColor: (status: string) => string
  cronToShortCode: (cron: string) => string
  isJobStuck: (job: ETLJob) => boolean
}

export function ETLHistoryTab({
  theme,
  isDark,
  etlJobs,
  schedules,
  onRefreshSchedules,
  onRefreshJobs,
  onUpdateScheduleInterval,
  onToggleSchedule,
  onKillJob,
  formatTimeAgo,
  formatDuration,
  getStatusColor,
  cronToShortCode,
  isJobStuck
}: ETLHistoryTabProps) {

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle
      case 'failed': return XCircle
      case 'running': return Loader2
      default: return RefreshCw
    }
  }

  const getCronLabel = (cronExpression: string) => {
    if (cronExpression === '* * * * *' || cronExpression === '1m') return '⚡ Her dakika'
    if (cronExpression === '*/5 * * * *' || cronExpression === '5m') return '🕐 Her 5 dakika'
    if (cronExpression === '*/15 * * * *' || cronExpression === '15m') return '🕐 Her 15 dakika'
    if (cronExpression === '*/30 * * * *' || cronExpression === '30m') return '🕐 Her 30 dakika'
    if (cronExpression === '0 * * * *' || cronExpression === '1h') return '⏰ Her saat başı'
    
    // Günlük schedule: 0 X * * * formatı
    if ((cronExpression?.match(/^0 \d{1,2} \* \* \*$/) || cronExpression === 'daily') && cronExpression !== '0 * * * *') {
      const hour = cronExpression === 'daily' ? 2 : parseInt(cronExpression.split(' ')[1], 10)
      const emoji = hour >= 0 && hour < 6 ? '🌙' : hour < 12 ? '🌅' : hour < 18 ? '☀️' : '🌆'
      return `${emoji} Her gün ${String(hour).padStart(2, '0')}:00`
    }
    
    if (!['* * * * *', '*/5 * * * *', '*/15 * * * *', '*/30 * * * *', '0 * * * *', '0 3 * * *', '1m', '5m', '15m', '30m', '1h', 'daily', 'manual'].includes(cronExpression) && !cronExpression?.match(/^0 \d{1,2} \* \* \*$/)) {
      return `📅 ${cronExpression}`
    }
    
    return null
  }

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'initial_sync': return 'İlk Sync'
      case 'incremental_sync': return 'Artımlı Sync'
      case 'full_refresh': return 'Tam Yenileme'
      case 'manual_sync': return 'Manuel Sync'
      default: return action
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'Tamamlandı'
      case 'running': return 'Çalışıyor'
      case 'failed': return 'Hata'
      case 'cancelled': return 'İptal'
      case 'skipped': return 'Atlandı'
      case 'pending': return 'Bekliyor'
      default: return status
    }
  }

  return (
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
            onClick={onRefreshSchedules}
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
                        {getCronLabel(schedule.cron_expression)}
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
                      onChange={(e) => onUpdateScheduleInterval(schedule.dataset_id, e.target.value)}
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
                      onClick={() => onToggleSchedule(schedule.id, !schedule.is_active)}
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
                        {getActionLabel(job.action)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    {/* Progress Info - Running/Pending job'lar için */}
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
                            <div 
                              className="h-full w-1/3 bg-gradient-to-r from-blue-500 via-teal-500 to-blue-500 rounded-full animate-pulse"
                              style={{ animation: 'shimmer 1.5s ease-in-out infinite' }}
                            />
                          ) : job.row_limit ? (
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, (job.rows_processed / job.row_limit) * 100)}%` }}
                            />
                          ) : (
                            <div 
                              className="h-full w-2/3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full"
                              style={{ animation: 'shimmer 2s ease-in-out infinite' }}
                            />
                          )}
                        </div>
                        <p className={clsx('text-xs mt-1 flex items-center gap-1', theme.contentTextMuted)}>
                          {isJobStuck(job) ? (
                            <span className="flex items-center gap-2 text-amber-500">
                              <AlertCircle className="w-3 h-3" />
                              <span>Yanıt alınamıyor!</span>
                              <button
                                onClick={() => onKillJob(job.id, job.dataset_name || 'Dataset')}
                                className="px-2 py-0.5 bg-amber-500 text-white rounded text-xs hover:bg-amber-600"
                              >
                                Temizle
                              </button>
                            </span>
                          ) : job.rows_processed && job.rows_processed > 0 ? (
                            job.row_limit && job.started_at ? (() => {
                              const elapsed = (Date.now() - new Date(job.started_at).getTime()) / 1000
                              const rate = job.rows_processed / elapsed
                              const remaining = job.row_limit - job.rows_processed
                              const eta = remaining / rate
                              return eta > 60 
                                ? `~${Math.round(eta / 60)} dk kaldı` 
                                : `~${Math.round(eta)} sn kaldı`
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
                      {getStatusLabel(job.status)}
                    </div>
                    
                    {/* Kill Button */}
                    {(job.status === 'pending' || job.status === 'running') && (
                      <button
                        onClick={() => onKillJob(job.id, job.dataset_name || 'Dataset')}
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
  )
}
