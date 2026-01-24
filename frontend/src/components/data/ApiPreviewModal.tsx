/**
 * Clixer - API Preview Modal Component
 * DataPage'den çıkarıldı - API önizleme ve dataset oluşturma
 */

import { 
  Globe,
  X,
  Play,
  Loader2,
  AlertCircle,
  Clock,
  Zap,
  Database,
  Info,
  CheckCircle,
  Columns
} from 'lucide-react'
import clsx from 'clsx'

interface ApiPreviewModalProps {
  theme: any
  isDark: boolean
  isOpen: boolean
  connection: any
  // API state
  apiMethod: string
  apiEndpoint: string
  apiQueryParams: string
  apiResponsePath: string
  apiBody: string
  apiPreviewLoading: boolean
  apiPreviewError: string | null
  apiPreviewResult: any
  // Dataset form state
  showApiDatasetForm: boolean
  apiDatasetName: string
  apiSelectedColumns: string[]
  apiSyncSchedule: string
  apiRowLimit: number
  apiDatasetSaving: boolean
  // Setters
  setApiMethod: (v: string) => void
  setApiEndpoint: (v: string) => void
  setApiQueryParams: (v: string) => void
  setApiResponsePath: (v: string) => void
  setApiBody: (v: string) => void
  setShowApiDatasetForm: (v: boolean) => void
  setApiDatasetName: (v: string) => void
  setApiSelectedColumns: (v: string[]) => void
  setApiSyncSchedule: (v: string) => void
  setApiRowLimit: (v: number) => void
  // Callbacks
  onClose: () => void
  onRunPreview: () => void
  onSaveAsDataset: () => void
}

export function ApiPreviewModal({
  theme,
  isDark,
  isOpen,
  connection,
  apiMethod,
  apiEndpoint,
  apiQueryParams,
  apiResponsePath,
  apiBody,
  apiPreviewLoading,
  apiPreviewError,
  apiPreviewResult,
  showApiDatasetForm,
  apiDatasetName,
  apiSelectedColumns,
  apiSyncSchedule,
  apiRowLimit,
  apiDatasetSaving,
  setApiMethod,
  setApiEndpoint,
  setApiQueryParams,
  setApiResponsePath,
  setApiBody,
  setShowApiDatasetForm,
  setApiDatasetName,
  setApiSelectedColumns,
  setApiSyncSchedule,
  setApiRowLimit,
  onClose,
  onRunPreview,
  onSaveAsDataset
}: ApiPreviewModalProps) {
  if (!isOpen || !connection) return null

  const getBaseUrl = () => {
    const config = connection.api_config 
      ? (typeof connection.api_config === 'string' ? JSON.parse(connection.api_config) : connection.api_config)
      : {}
    return config.baseUrl || connection.host
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
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
                {connection.name} • {getBaseUrl()}
              </p>
            </div>
          </div>
          <button onClick={onClose} className={clsx('p-2 rounded-lg', theme.buttonSecondary)}>
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
              onClick={onRunPreview}
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
              {getBaseUrl()}{apiEndpoint}{apiQueryParams ? `?${apiQueryParams}` : ''}
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
                      onClick={onSaveAsDataset}
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
            onClick={onClose} 
            className={clsx('px-5 py-2 font-bold rounded-xl', theme.buttonSecondary)}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}
