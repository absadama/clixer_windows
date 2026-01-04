// Enterprise DataGrid - Toolbar Bileşeni

import React, { useState } from 'react'
import clsx from 'clsx'
import { 
  Search, 
  Download, 
  Columns, 
  Filter, 
  Save, 
  FolderOpen,
  LayoutGrid,
  X,
  FileSpreadsheet,
  FileText,
  TableProperties
} from 'lucide-react'
import { ColumnConfig, GroupConfig } from './types'

interface ToolbarProps {
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  columns: ColumnConfig[]
  hiddenColumns: string[]
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void
  grouping: GroupConfig[]
  onGroupingChange: (grouping: GroupConfig[]) => void
  density: 'compact' | 'normal' | 'comfortable'
  onDensityChange: (density: 'compact' | 'normal' | 'comfortable') => void
  onExportExcel: () => void
  onExportCSV: () => void
  onSaveDesign: () => void
  onLoadDesign: () => void
  activeFiltersCount: number
  onClearFilters: () => void
  showFilters: boolean
  onToggleFilters: () => void
  enableExport: boolean
  enableColumnHide: boolean
  enableDensityToggle: boolean
  enablePivot?: boolean
  pivotMode?: boolean
  onPivotModeChange?: (enabled: boolean) => void
  theme: any
}

export const DataGridToolbar: React.FC<ToolbarProps> = ({
  globalFilter,
  onGlobalFilterChange,
  columns,
  hiddenColumns,
  onColumnVisibilityChange,
  grouping,
  onGroupingChange,
  density,
  onDensityChange,
  onExportExcel,
  onExportCSV,
  onSaveDesign,
  onLoadDesign,
  activeFiltersCount,
  onClearFilters,
  showFilters,
  onToggleFilters,
  enableExport,
  enableColumnHide,
  enableDensityToggle,
  enablePivot,
  pivotMode,
  onPivotModeChange,
  theme,
}) => {
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showDensityMenu, setShowDensityMenu] = useState(false)

  return (
    <div className={clsx('flex items-center justify-between px-4 py-3 border-b gap-4', theme.border)}>
      {/* Sol Taraf - Arama ve Filtre */}
      <div className="flex items-center gap-3">
        {/* Global Arama */}
        <div className="relative">
          <Search className={clsx('absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4', theme.mutedText)} />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            placeholder="Ara..."
            className={clsx(
              'pl-9 pr-3 py-2 rounded-lg border text-sm w-64',
              theme.inputBg,
              theme.inputText,
              theme.inputBorder,
              theme.inputPlaceholder,
              'focus:outline-none focus:ring-2 focus:ring-blue-500/50'
            )}
          />
          {globalFilter && (
            <button
              onClick={() => onGlobalFilterChange('')}
              className={clsx('absolute right-3 top-1/2 -translate-y-1/2', theme.mutedText, 'hover:text-red-400')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filtre Toggle */}
        <button
          onClick={onToggleFilters}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
            theme.border,
            showFilters ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'hover:bg-white/5'
          )}
        >
          <Filter className="w-4 h-4" />
          Filtreler
          {activeFiltersCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-500 text-white text-xs">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Aktif Filtre Temizle */}
        {activeFiltersCount > 0 && (
          <button
            onClick={onClearFilters}
            className={clsx('text-sm text-red-400 hover:text-red-300')}
          >
            Temizle
          </button>
        )}

        {/* Pivot Modu */}
        {enablePivot && (
          <button
            onClick={() => onPivotModeChange?.(!pivotMode)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
              theme.border,
              pivotMode ? 'bg-purple-500/20 text-purple-400 border-purple-500/50' : 'hover:bg-white/5'
            )}
          >
            <TableProperties className="w-4 h-4" />
            Pivot
          </button>
        )}
      </div>

      {/* Sağ Taraf - Aksiyonlar */}
      <div className="flex items-center gap-2">
        {/* Kolon Görünürlüğü */}
        {enableColumnHide && (
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                theme.border,
                'hover:bg-white/5'
              )}
            >
              <Columns className="w-4 h-4" />
              Kolonlar
            </button>

            {showColumnMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowColumnMenu(false)} 
                />
                <div className={clsx(
                  'absolute right-0 top-full mt-2 z-50 w-64 rounded-lg border shadow-xl p-3',
                  theme.cardBg,
                  theme.border
                )}>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-700">
                    <span className={clsx('text-sm font-semibold', theme.contentText)}>Kolon Görünürlüğü</span>
                    <button
                      onClick={() => {
                        columns.forEach(col => onColumnVisibilityChange(col.id, true))
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      Tümünü Göster
                    </button>
                  </div>
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {columns.map(col => (
                      <label
                        key={col.id}
                        className={clsx(
                          'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
                          'hover:bg-white/5 transition-colors'
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={!hiddenColumns.includes(col.id)}
                          onChange={(e) => onColumnVisibilityChange(col.id, e.target.checked)}
                          className="w-4 h-4 rounded"
                        />
                        <span className={clsx('text-sm', theme.contentText)}>{col.header}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Yoğunluk */}
        {enableDensityToggle && (
          <div className="relative">
            <button
              onClick={() => setShowDensityMenu(!showDensityMenu)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                theme.border,
                'hover:bg-white/5'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              {density === 'compact' ? 'Sıkı' : density === 'comfortable' ? 'Geniş' : 'Normal'}
            </button>

            {showDensityMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowDensityMenu(false)} 
                />
                <div className={clsx(
                  'absolute right-0 top-full mt-2 z-50 w-40 rounded-lg border shadow-xl overflow-hidden',
                  theme.cardBg,
                  theme.border
                )}>
                  {[
                    { value: 'compact', label: 'Sıkı' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'comfortable', label: 'Geniş' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        onDensityChange(opt.value as any)
                        setShowDensityMenu(false)
                      }}
                      className={clsx(
                        'w-full px-4 py-2 text-left text-sm transition-colors',
                        density === opt.value ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-white/5',
                        theme.contentText
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Export */}
        {enableExport && (
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                theme.border,
                'hover:bg-white/5'
              )}
            >
              <Download className="w-4 h-4" />
              İndir
            </button>

            {showExportMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowExportMenu(false)} 
                />
                <div className={clsx(
                  'absolute right-0 top-full mt-2 z-50 w-48 rounded-lg border shadow-xl overflow-hidden',
                  theme.cardBg,
                  theme.border
                )}>
                  <button
                    onClick={() => {
                      onExportExcel()
                      setShowExportMenu(false)
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      'hover:bg-white/5',
                      theme.contentText
                    )}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-green-500" />
                    Excel (.xlsx)
                  </button>
                  <button
                    onClick={() => {
                      onExportCSV()
                      setShowExportMenu(false)
                    }}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors',
                      'hover:bg-white/5',
                      theme.contentText
                    )}
                  >
                    <FileText className="w-4 h-4 text-blue-500" />
                    CSV (.csv)
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Ayırıcı */}
        <div className="w-px h-6 bg-gray-700 mx-1" />

        {/* Tasarım Yükle */}
        <button
          onClick={onLoadDesign}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
            theme.border,
            'hover:bg-white/5'
          )}
          title="Kayıtlı tasarımı yükle"
        >
          <FolderOpen className="w-4 h-4" />
        </button>

        {/* Tasarım Kaydet */}
        <button
          onClick={onSaveDesign}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
            'bg-blue-600 hover:bg-blue-700 text-white'
          )}
        >
          <Save className="w-4 h-4" />
          Kaydet
        </button>
      </div>
    </div>
  )
}

export default DataGridToolbar


