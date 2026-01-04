// Enterprise DataGrid - Filtre Bileşeni

import React from 'react'
import clsx from 'clsx'
import { X } from 'lucide-react'
import { ColumnConfig } from './types'
import { ColumnFiltersState } from '@tanstack/react-table'

interface FilterProps {
  columns: ColumnConfig[]
  columnFilters: ColumnFiltersState
  onColumnFiltersChange: (filters: ColumnFiltersState) => void
  theme: any
}

export const DataGridFilter: React.FC<FilterProps> = ({
  columns,
  columnFilters,
  onColumnFiltersChange,
  theme,
}) => {
  const getFilterValue = (columnId: string): string => {
    const filter = columnFilters.find(f => f.id === columnId)
    const value = filter?.value
    return value !== undefined && value !== null ? String(value) : ''
  }

  const setFilterValue = (columnId: string, value: any) => {
    onColumnFiltersChange(
      columnFilters.some(f => f.id === columnId)
        ? columnFilters.map(f => f.id === columnId ? { ...f, value } : f)
        : [...columnFilters, { id: columnId, value }]
    )
  }

  const clearFilter = (columnId: string) => {
    onColumnFiltersChange(columnFilters.filter(f => f.id !== columnId))
  }

  const filterableColumns = columns.filter(c => c.filterable !== false)

  return (
    <div className={clsx('px-4 py-3 border-b', theme.border, 'bg-blue-500/5')}>
      <div className="flex items-center gap-4 flex-wrap">
        <span className={clsx('text-sm font-medium', theme.contentText)}>
          Filtreler:
        </span>
        
        {filterableColumns.map(column => {
          const value = getFilterValue(column.id)
          const hasValue = value !== '' && value !== undefined && value !== null
          
          return (
            <div key={column.id} className="relative">
              {column.type === 'boolean' ? (
                <select
                  value={String(value)}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      clearFilter(column.id)
                    } else {
                      setFilterValue(column.id, val === 'true')
                    }
                  }}
                  className={clsx(
                    'px-3 py-1.5 pr-8 rounded border text-sm min-w-[120px]',
                    theme.inputBg,
                    theme.inputText,
                    theme.inputBorder,
                    hasValue && 'border-blue-500/50 bg-blue-500/10'
                  )}
                >
                  <option value="">{column.header}</option>
                  <option value="true">Evet</option>
                  <option value="false">Hayır</option>
                </select>
              ) : column.type === 'number' || column.type === 'currency' || column.type === 'percentage' ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={Array.isArray(value) ? value[0] ?? '' : value}
                    onChange={(e) => setFilterValue(column.id, e.target.value)}
                    placeholder={`${column.header} (min)`}
                    className={clsx(
                      'px-3 py-1.5 rounded border text-sm w-28',
                      theme.inputBg,
                      theme.inputText,
                      theme.inputBorder,
                      hasValue && 'border-blue-500/50 bg-blue-500/10'
                    )}
                  />
                </div>
              ) : column.type === 'date' ? (
                <input
                  type="date"
                  value={value}
                  onChange={(e) => setFilterValue(column.id, e.target.value)}
                  className={clsx(
                    'px-3 py-1.5 rounded border text-sm',
                    theme.inputBg,
                    theme.inputText,
                    theme.inputBorder,
                    hasValue && 'border-blue-500/50 bg-blue-500/10'
                  )}
                />
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => setFilterValue(column.id, e.target.value)}
                    placeholder={column.header}
                    className={clsx(
                      'px-3 py-1.5 rounded border text-sm min-w-[120px]',
                      theme.inputBg,
                      theme.inputText,
                      theme.inputBorder,
                      theme.inputPlaceholder,
                      hasValue && 'border-blue-500/50 bg-blue-500/10'
                    )}
                  />
                  {hasValue && (
                    <button
                      onClick={() => clearFilter(column.id)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
        
        {columnFilters.length > 0 && (
          <button
            onClick={() => onColumnFiltersChange([])}
            className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Tümünü Temizle
          </button>
        )}
      </div>
    </div>
  )
}

export default DataGridFilter


