/**
 * Clixer - Connections Tab Component
 * DataPage'den çıkarıldı - Bağlantı yönetimi
 */

import { 
  Database, 
  Plus, 
  Link2, 
  FileSpreadsheet, 
  Globe, 
  Server,
  RefreshCw,
  Table,
  Trash2,
  CheckCircle,
  XCircle,
  Edit2,
  Eye,
  Terminal
} from 'lucide-react'
import clsx from 'clsx'
import { Connection, Dataset, useDataStore } from '../../stores/dataStore'

interface ConnectionsTabProps {
  theme: any
  isDark: boolean
  connections: Connection[]
  datasets: Dataset[]
  onEditConnection: (conn: Connection) => void
  onTestConnection: (id: string) => void
  onDeleteConnection: (conn: Connection) => void
  onOpenApiPreview: (conn: Connection) => void
}

export function ConnectionsTab({
  theme,
  isDark,
  connections,
  datasets,
  onEditConnection,
  onTestConnection,
  onDeleteConnection,
  onOpenApiPreview
}: ConnectionsTabProps) {
  const { 
    setShowConnectionModal, 
    setSelectedConnection, 
    setShowDatasetModal,
    setSqlConnectionId,
    setActiveTab
  } = useDataStore()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return CheckCircle
      case 'error': return XCircle
      default: return RefreshCw
    }
  }

  return (
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
                      {/* Connection Status */}
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
                          onClick={() => onEditConnection(conn)}
                          className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                          title="Düzenle"
                        >
                          <Edit2 className={clsx('h-4 w-4', theme.contentTextMuted)} />
                        </button>
                        <button 
                          onClick={() => onTestConnection(conn.id)}
                          className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                          title="Bağlantıyı Test Et"
                        >
                          <RefreshCw className={clsx('h-4 w-4', theme.contentTextMuted)} />
                        </button>
                        {/* API bağlantısı için Önizleme butonu */}
                        {conn.type === 'api' ? (
                          <button 
                            onClick={() => onOpenApiPreview(conn)}
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
                          onClick={() => onDeleteConnection(conn)}
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
  )
}
