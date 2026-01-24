/**
 * Clixer - System Health Tab Component
 * DataPage'den çıkarıldı - Sistem sağlık merkezi
 */

import { 
  Activity,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Server,
  Database,
  Zap,
  HardDrive,
  Gauge,
  RotateCcw,
  Play,
  Lock,
  Trash2,
  Clock
} from 'lucide-react'
import clsx from 'clsx'

interface SystemHealthTabProps {
  theme: any
  isDark: boolean
  systemHealth: any
  systemHealthLoading: boolean
  systemAutoRefresh: boolean
  systemActionLoading: string | null
  workerStatus: any
  etlMonitoring: {
    runningJobs: any[]
    stuckJobs: any[]
    locks: any[]
  }
  // Callbacks
  onRefresh: (force?: boolean) => void
  onToggleAutoRefresh: () => void
  onRestartService: (serviceId: string) => void
  onReconnectClickhouse: () => void
  onReconnectRedis: () => void
  onWorkerStart: () => void
  onWorkerStop: () => void
  onWorkerRestart: () => void
  onCancelJob: (jobId: string) => void
  onDeleteLock: (datasetId: string) => void
  onDeleteAllLocks: () => void
  onClearCache: () => void
  onTriggerETL: () => void
  onCancelAllETL: () => void
  setSystemActionLoading: (loading: string | null) => void
}

export function SystemHealthTab({
  theme,
  isDark,
  systemHealth,
  systemHealthLoading,
  systemAutoRefresh,
  systemActionLoading,
  workerStatus,
  etlMonitoring,
  onRefresh,
  onToggleAutoRefresh,
  onRestartService,
  onReconnectClickhouse,
  onReconnectRedis,
  onWorkerStart,
  onWorkerStop,
  onWorkerRestart,
  onCancelJob,
  onDeleteLock,
  onDeleteAllLocks,
  onClearCache,
  onTriggerETL,
  onCancelAllETL,
  setSystemActionLoading
}: SystemHealthTabProps) {

  return (
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
              onClick={onToggleAutoRefresh}
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
              onClick={() => onRefresh(true)}
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
                
                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => onRestartService(service.id)}
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
                <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {systemHealth?.databases?.clickhouse?.error || 'Clixer DB bağlantısı kurulamadı'}
                  </p>
                </div>
                <button
                  onClick={onReconnectClickhouse}
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
                  onClick={onReconnectRedis}
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
                  onClick={onWorkerRestart}
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
                  onClick={onWorkerStop}
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
                onClick={onWorkerStart}
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
        
        {/* CRASH UYARISI */}
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
                onClick={onDeleteAllLocks}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600"
              >
                <Trash2 className="w-4 h-4" />
                Lock'ları Temizle
              </button>
              <button
                onClick={async () => {
                  for (const job of etlMonitoring.runningJobs) {
                    await onCancelJob(job.id)
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
                    onClick={() => onCancelJob(job.id)}
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
                      onClick={() => onCancelJob(job.id)}
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
                  
                  {/* Progress Bar */}
                  {job.status === 'running' && (
                    <div className="space-y-1">
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
                      
                      <div className={clsx('h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
                        {job.rows_processed === 0 ? (
                          <div 
                            className="h-full w-1/4 bg-gradient-to-r from-blue-500 via-teal-500 to-blue-500 rounded-full"
                            style={{ 
                              animation: 'shimmer 1.5s ease-in-out infinite',
                              backgroundSize: '200% 100%'
                            }} 
                          />
                        ) : (
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
                onClick={onDeleteAllLocks}
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
                    onClick={() => onDeleteLock(lock.datasetId)}
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
            onClick={onTriggerETL}
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
          onClick={() => onRefresh(true)}
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
          onClick={onClearCache}
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
          onClick={onTriggerETL}
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

        {/* Tümünü İptal Et */}
        {(systemHealth?.etl?.pendingJobs > 0 || systemHealth?.etl?.running > 0) && (
          <button
            onClick={onCancelAllETL}
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
  )
}
