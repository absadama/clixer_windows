/**
 * Clixer - Performance Tab Component
 * DataPage'den çıkarıldı - Performans danışmanı
 */

import { 
  TrendingUp,
  RefreshCw,
  Loader2,
  Database,
  HardDrive,
  Zap,
  Server,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  Trash2,
  Wrench,
  Clock,
  Copy,
  XCircle
} from 'lucide-react'
import clsx from 'clsx'

interface PerformanceTabProps {
  theme: any
  isDark: boolean
  performanceLoading: string | null
  performanceActionLoading: string | null
  performanceData: {
    postgres: any
    clickhouse: any
    etl: any
    connections: Record<string, any>
  }
  connections: any[]
  // Callbacks
  onLoadAll: () => void
  onLoadPostgres: () => void
  onLoadClickhouse: () => void
  onLoadEtl: () => void
  onLoadConnection: (connectionId: string) => void
  onDropIndex: (indexName: string) => void
  onRunVacuum: (tableName: string, analyze: boolean) => void
  onOptimizeAll: () => void
  onCopyToClipboard: (text: string) => void
}

export function PerformanceTab({
  theme,
  isDark,
  performanceLoading,
  performanceActionLoading,
  performanceData,
  connections,
  onLoadAll,
  onLoadPostgres,
  onLoadClickhouse,
  onLoadEtl,
  onLoadConnection,
  onDropIndex,
  onRunVacuum,
  onOptimizeAll,
  onCopyToClipboard
}: PerformanceTabProps) {

  return (
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
            onClick={onLoadAll}
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
              onClick={onLoadPostgres}
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
                            onClick={() => onDropIndex(idx.index_name)}
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
                            onClick={() => onRunVacuum(tbl.table_name, true)}
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

                {/* Seq Scan Fazla Tablolar */}
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
                onClick={onOptimizeAll}
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
                onClick={onLoadClickhouse}
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
                              onClick={() => onCopyToClipboard(q.query_preview)}
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
            onClick={onLoadEtl}
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
                      onClick={() => onLoadConnection(conn.id)}
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
  )
}
