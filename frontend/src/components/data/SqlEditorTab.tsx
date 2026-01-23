/**
 * Clixer - SQL Editor Tab Component
 * DataPage'den çıkarıldı - SQL sorgu editörü
 */

import { 
  Table,
  ChevronRight,
  ChevronDown,
  Copy,
  Download,
  Save,
  Loader2,
  Terminal,
  Columns,
  Hash,
  Calendar,
  AlertCircle,
  Play,
  Zap
} from 'lucide-react'
import clsx from 'clsx'
import { Connection, TableInfo, ColumnInfo, QueryResult } from '../../stores/dataStore'

interface SqlEditorTabProps {
  theme: any
  isDark: boolean
  connections: Connection[]
  sqlConnectionId: string
  sqlQuery: string
  sqlResult: QueryResult | null
  sqlLoading: boolean
  sqlError: string | null
  tables: TableInfo[]
  expandedTable: string | null
  tableColumns: Record<string, ColumnInfo[]>
  onConnectionChange: (id: string) => void
  onQueryChange: (query: string) => void
  onExecuteQuery: () => void
  onTableClick: (tableName: string, schema: string) => void
  onInsertTableToQuery: (tableName: string) => void
  onSaveToDataset: () => void
}

export function SqlEditorTab({
  theme,
  isDark,
  connections,
  sqlConnectionId,
  sqlQuery,
  sqlResult,
  sqlLoading,
  sqlError,
  tables,
  expandedTable,
  tableColumns,
  onConnectionChange,
  onQueryChange,
  onExecuteQuery,
  onTableClick,
  onInsertTableToQuery,
  onSaveToDataset
}: SqlEditorTabProps) {
  
  const getTypeIcon = (type: string) => {
    const t = (type || '').toLowerCase()
    if (t.includes('int') || t.includes('decimal') || t.includes('numeric') || t.includes('float') || t.includes('double')) {
      return Hash
    }
    if (t.includes('date') || t.includes('time')) {
      return Calendar
    }
    return Terminal
  }

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Tables Explorer */}
      <div className={clsx('col-span-3 rounded-2xl overflow-hidden', theme.cardBg)}>
        <div className={clsx('px-4 py-3 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={clsx('font-bold text-sm', theme.contentText)}>Tablolar</h3>
            <Columns className={clsx('h-4 w-4', theme.contentTextMuted)} />
          </div>
          {/* Connection selector */}
          <select
            value={sqlConnectionId}
            onChange={(e) => onConnectionChange(e.target.value)}
            className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
          >
            {connections.map(conn => (
              <option key={conn.id} value={conn.id} className={isDark ? 'bg-slate-900' : 'bg-white'}>
                {conn.name}
              </option>
            ))}
          </select>
        </div>

        <div className="max-h-[500px] overflow-y-auto p-2">
          {tables.map((table) => (
            <div key={`${table.schema}.${table.name}`} className="mb-1">
              <button
                onClick={() => onTableClick(table.name, table.schema)}
                onDoubleClick={() => onInsertTableToQuery(table.name)}
                className={clsx(
                  'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors',
                  expandedTable === table.name 
                    ? (isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600')
                    : clsx(theme.contentText, isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100')
                )}
              >
                {expandedTable === table.name ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Table className={clsx('h-4 w-4', table.type === 'view' ? 'text-purple-500' : 'text-blue-500')} />
                <span className="flex-1 truncate">{table.name}</span>
                <span className={clsx('text-[10px] uppercase', theme.contentTextMuted)}>
                  {table.type === 'view' ? 'VIEW' : ''}
                </span>
              </button>
              
              {/* Columns */}
              {expandedTable === table.name && tableColumns[table.name] && (
                <div className={clsx('ml-4 mt-1 pl-4 border-l-2 space-y-0.5', isDark ? 'border-slate-700' : 'border-slate-200')}>
                  {tableColumns[table.name].map((col) => {
                    const TypeIcon = getTypeIcon(col.type)
                    return (
                      <div 
                        key={col.name}
                        className={clsx('flex items-center gap-2 px-2 py-1 rounded text-xs', theme.contentTextMuted)}
                      >
                        {col.isPrimaryKey ? (
                          <span className="text-amber-500 text-[10px] font-bold">PK</span>
                        ) : (
                          <TypeIcon className="h-3 w-3" />
                        )}
                        <span className={clsx(theme.contentText)}>{col.name}</span>
                        <span className="text-[10px]">{col.type}</span>
                        {col.clickhouseType && (
                          <span className="ml-auto text-[10px] text-emerald-500">→ {col.clickhouseType}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* SQL Editor & Results */}
      <div className="col-span-9 space-y-4">
        {/* Editor */}
        <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
          <div className={clsx('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <div className="flex items-center gap-2">
              <Terminal className={clsx('h-4 w-4', theme.contentTextMuted)} />
              <span className={clsx('font-bold text-sm', theme.contentText)}>SQL Sorgusu</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onExecuteQuery}
                disabled={sqlLoading || !sqlQuery.trim()}
                className={clsx('flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50', theme.buttonPrimary)}
              >
                {sqlLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Çalıştır
              </button>
            </div>
          </div>

          <textarea
            value={sqlQuery}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="SELECT * FROM ..."
            rows={6}
            className={clsx(
              'w-full p-4 font-mono text-sm resize-none focus:outline-none',
              isDark ? 'bg-slate-900 text-slate-200' : 'bg-slate-50 text-slate-800',
              'placeholder:text-slate-500'
            )}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                onExecuteQuery()
              }
            }}
          />

          <div className={clsx('px-4 py-2 border-t text-xs', isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-500')}>
            <kbd className={clsx('px-1.5 py-0.5 rounded', isDark ? 'bg-slate-800' : 'bg-slate-200')}>⌘</kbd> + <kbd className={clsx('px-1.5 py-0.5 rounded', isDark ? 'bg-slate-800' : 'bg-slate-200')}>Enter</kbd> ile çalıştır • Tabloyu çift tıkla → Sorguya ekle
          </div>
        </div>

        {/* Error */}
        {sqlError && (
          <div className={clsx('flex items-start gap-3 p-4 rounded-xl', isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200')}>
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-red-500 text-sm font-medium">Sorgu Hatası</p>
              <p className={clsx('text-sm', theme.contentTextMuted)}>{sqlError}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {sqlResult && (
          <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
            <div className={clsx('px-4 py-3 border-b flex items-center justify-between', isDark ? 'border-slate-800' : 'border-slate-200')}>
              <div className="flex items-center gap-4">
                <span className={clsx('font-bold text-sm', theme.contentText)}>Sonuçlar</span>
                <span className={clsx('text-xs', theme.contentTextMuted)}>
                  {sqlResult.rowCount} satır • {sqlResult.executionTime}ms
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button className={clsx('p-2 rounded-lg', theme.buttonSecondary)} title="Kopyala">
                  <Copy className={clsx('h-4 w-4', theme.contentTextMuted)} />
                </button>
                <button className={clsx('p-2 rounded-lg', theme.buttonSecondary)} title="İndir">
                  <Download className={clsx('h-4 w-4', theme.contentTextMuted)} />
                </button>
                <button 
                  onClick={onSaveToDataset}
                  className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium', isDark ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200')}
                >
                  <Save className="h-4 w-4" />
                  Clixer'a Kaydet
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full">
                <thead className={clsx('sticky top-0', isDark ? 'bg-slate-900' : 'bg-slate-100')}>
                  <tr className={clsx('text-left text-xs font-bold uppercase tracking-wider', isDark ? 'text-slate-500' : 'text-slate-500')}>
                    {sqlResult.columns.map((col) => (
                      <th key={col.name} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {col.name}
                          {col.clickhouseType && (
                            <span className="text-[10px] font-normal text-emerald-500 normal-case">
                              {col.clickhouseType}
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                  {sqlResult.rows.map((row, i) => (
                    <tr key={i} className={clsx('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                      {sqlResult.columns.map((col) => (
                        <td key={col.name} className={clsx('px-4 py-3 text-sm', theme.contentText)}>
                          {row[col.name] === null ? (
                            <span className={clsx('text-xs', theme.contentTextMuted)}>NULL</span>
                          ) : typeof row[col.name] === 'object' ? (
                            JSON.stringify(row[col.name])
                          ) : (
                            String(row[col.name])
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Type mapping info */}
            <div className={clsx('px-4 py-3 border-t', isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-slate-50')}>
              <p className={clsx('text-xs', theme.contentTextMuted)}>
                <Zap className="h-3 w-3 inline mr-1 text-amber-500" />
                Kolonlar otomatik olarak Clixer tiplerine dönüştürülür. "Clixer'a Kaydet" ile bu veriyi dataset olarak kaydedin.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
