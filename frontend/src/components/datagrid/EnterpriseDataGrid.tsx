import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ExpandedState,
  VisibilityState,
  ColumnOrderState,
  ColumnSizingState,
  Row,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { utils, writeFile } from 'xlsx'
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Filter,
  Columns,
  Save,
  FolderOpen,
  RotateCcw,
  Search,
  GripVertical,
  Eye,
  EyeOff,
  Pin,
  X,
  Check,
  Layers,
} from 'lucide-react'
import clsx from 'clsx'
import { DataGridProps, ColumnConfig, GridState, SavedGridDesign } from './types'

// Sortable Header Cell
const SortableHeaderCell: React.FC<{
  column: ColumnConfig
  children: React.ReactNode
  onSort: () => void
  sortDirection?: 'asc' | 'desc' | false
  onResize?: (width: number) => void
}> = ({ column, children, onSort, sortDirection, onResize }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    width: column.width || 150,
    minWidth: column.minWidth || 80,
    maxWidth: column.maxWidth || 500,
  }

  const resizeRef = useRef<HTMLDivElement>(null)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsResizing(true)
    const startX = e.clientX
    const startWidth = column.width || 150

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(80, Math.min(500, startWidth + moveEvent.clientX - startX))
      onResize?.(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={clsx(
        'relative select-none border-r border-gray-700 bg-gray-800 px-3 py-2',
        'text-left text-xs font-semibold uppercase tracking-wider text-gray-300',
        isDragging && 'z-50'
      )}
    >
      <div className="flex items-center gap-1">
        {/* Drag Handle */}
        <span {...attributes} {...listeners} className="cursor-grab text-gray-500 hover:text-gray-300">
          <GripVertical size={14} />
        </span>

        {/* Header Content */}
        <span
          className="flex-1 cursor-pointer truncate"
          onClick={onSort}
        >
          {children}
        </span>

        {/* Sort Indicator */}
        {sortDirection && (
          <span className="text-cyan-400">
            {sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </span>
        )}
      </div>

      {/* Resize Handle */}
      {column.resizable !== false && (
        <div
          ref={resizeRef}
          className={clsx(
            'absolute right-0 top-0 h-full w-1 cursor-col-resize',
            'hover:bg-cyan-500',
            isResizing && 'bg-cyan-500'
          )}
          onMouseDown={handleMouseDown}
        />
      )}
    </th>
  )
}

// Group Drop Zone
const GroupDropZone: React.FC<{
  groups: { columnId: string; label: string }[]
  onRemoveGroup: (columnId: string) => void
}> = ({ groups, onRemoveGroup }) => {
  return (
    <div className="flex min-h-[40px] flex-wrap items-center gap-2 rounded-lg border-2 border-dashed border-gray-600 bg-gray-800/50 px-3 py-2">
      <Layers size={16} className="text-gray-500" />
      <span className="text-xs text-gray-500">
        {groups.length === 0 ? 'Gruplamak için kolon sürükleyin' : 'Gruplama:'}
      </span>
      {groups.map((group) => (
        <span
          key={group.columnId}
          className="flex items-center gap-1 rounded bg-cyan-600/20 px-2 py-1 text-xs text-cyan-400"
        >
          {group.label}
          <X
            size={12}
            className="cursor-pointer hover:text-red-400"
            onClick={() => onRemoveGroup(group.columnId)}
          />
        </span>
      ))}
    </div>
  )
}

// Column Visibility Panel
const ColumnVisibilityPanel: React.FC<{
  columns: ColumnConfig[]
  visibility: VisibilityState
  onToggle: (columnId: string) => void
  onClose: () => void
}> = ({ columns, visibility, onToggle, onClose }) => {
  return (
    <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-700 bg-gray-800 p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white">Kolonlar</span>
        <X size={16} className="cursor-pointer text-gray-400 hover:text-white" onClick={onClose} />
      </div>
      <div className="max-h-64 space-y-1 overflow-y-auto">
        {columns.map((col) => (
          <label
            key={col.id}
            className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-gray-700"
          >
            <input
              type="checkbox"
              checked={visibility[col.id] !== false}
              onChange={() => onToggle(col.id)}
              className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-sm text-gray-300">{col.header}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// Save Design Modal
const SaveDesignModal: React.FC<{
  onSave: (name: string, isDefault: boolean) => void
  onClose: () => void
}> = ({ onSave, onClose }) => {
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-semibold text-white">Tasarımı Kaydet</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tasarım adı"
          className="mb-3 w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-cyan-500 focus:outline-none"
        />
        <label className="mb-4 flex items-center gap-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Varsayılan tasarım olarak ayarla</span>
        </label>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-gray-400 hover:bg-gray-700 hover:text-white"
          >
            İptal
          </button>
          <button
            onClick={() => onSave(name, isDefault)}
            disabled={!name.trim()}
            className="rounded-lg bg-cyan-600 px-4 py-2 text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  )
}

// Format cell value
const formatValue = (value: unknown, format?: string): string => {
  if (value === null || value === undefined) return '-'
  
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(Number(value))
    case 'number':
      return new Intl.NumberFormat('tr-TR').format(Number(value))
    case 'percent':
      return `%${Number(value).toFixed(2)}`
    case 'date':
      return new Date(String(value)).toLocaleDateString('tr-TR')
    case 'datetime':
      return new Date(String(value)).toLocaleString('tr-TR')
    default:
      return String(value)
  }
}

// Main Component
export const EnterpriseDataGrid: React.FC<DataGridProps> = ({
  data,
  columns: columnConfigs,
  enableVirtualization = true,
  enableColumnResize = true,
  enableColumnReorder = true,
  enableGrouping = true,
  enableFiltering = true,
  enableSorting = true,
  enableRowSelection = false,
  enableExport = true,
  enablePinning = true,
  enableGrandTotal = false,
  enableSubtotals = false,
  initialState,
  onStateChange,
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
  gridId,
  onSaveDesign,
  savedDesigns = [],
  onLoadDesign,
  height = 600,
  className,
  isLoading = false,
  loadingText = 'Yükleniyor...',
  emptyText = 'Veri bulunamadı',
}) => {
  // State
  const [sorting, setSorting] = useState<SortingState>(initialState?.sorts?.map(s => ({ id: s.columnId, desc: s.direction === 'desc' })) || [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [grouping, setGrouping] = useState<GroupingState>(initialState?.groups?.map(g => g.columnId) || [])
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    Object.fromEntries(columnConfigs.map(c => [c.id, c.visible !== false]))
  )
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(columnConfigs.map(c => c.id))
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(
    Object.fromEntries(columnConfigs.map(c => [c.id, c.width || 150]))
  )
  const [rowSelection, setRowSelection] = useState({})
  
  // UI State
  const [showColumnPanel, setShowColumnPanel] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [activeColumn, setActiveColumn] = useState<string | null>(null)

  // Refs
  const tableContainerRef = useRef<HTMLDivElement>(null)

  // Sensors for DnD
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Build columns
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    return columnConfigs.map((col) => ({
      id: col.id,
      accessorKey: col.accessorKey,
      header: col.header,
      size: columnSizing[col.id] || col.width || 150,
      minSize: col.minWidth || 80,
      maxSize: col.maxWidth || 500,
      enableSorting: col.sortable !== false && enableSorting,
      enableColumnFilter: col.filterable !== false && enableFiltering,
      enableGrouping: enableGrouping,
      enableResizing: col.resizable !== false && enableColumnResize,
      aggregationFn: col.aggregationType !== 'none' ? col.aggregationType : undefined,
      cell: ({ getValue, row }) => {
        const value = getValue()
        if (row.getIsGrouped()) {
          return (
            <span className="font-medium text-cyan-400">
              {formatValue(value, col.format)} ({row.subRows.length})
            </span>
          )
        }
        return <span className={clsx(col.align === 'right' && 'text-right', col.align === 'center' && 'text-center')}>
          {formatValue(value, col.format)}
        </span>
      },
      footer: enableGrandTotal && col.aggregationType ? ({ table }) => {
        const rows = table.getFilteredRowModel().rows
        const values = rows.map(r => Number(r.getValue(col.id)) || 0)
        let result = 0
        switch (col.aggregationType) {
          case 'sum': result = values.reduce((a, b) => a + b, 0); break
          case 'avg': result = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; break
          case 'count': result = values.length; break
          case 'min': result = Math.min(...values); break
          case 'max': result = Math.max(...values); break
        }
        return <span className="font-bold text-cyan-400">{formatValue(result, col.format)}</span>
      } : undefined,
    }))
  }, [columnConfigs, columnSizing, enableSorting, enableFiltering, enableGrouping, enableColumnResize, enableGrandTotal])

  // Table instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      grouping,
      expanded,
      columnVisibility,
      columnOrder,
      columnSizing,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection,
    enableMultiRowSelection: true,
    columnResizeMode: 'onChange',
  })

  const { rows } = table.getRowModel()

  // Virtual scrolling
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  })

  const virtualRows = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  // Handlers
  const handleDragStart = (event: DragStartEvent) => {
    setActiveColumn(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveColumn(null)

    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(String(active.id))
        const newIndex = prev.indexOf(String(over.id))
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const handleResize = (columnId: string, width: number) => {
    setColumnSizing((prev) => ({ ...prev, [columnId]: width }))
  }

  const handleExport = (format: 'excel' | 'csv') => {
    const exportData = table.getFilteredRowModel().rows.map((row) =>
      Object.fromEntries(
        columnConfigs
          .filter((col) => columnVisibility[col.id] !== false)
          .map((col) => [col.header, row.getValue(col.id)])
      )
    )

    const ws = utils.json_to_sheet(exportData)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Data')
    writeFile(wb, `export.${format === 'excel' ? 'xlsx' : 'csv'}`)
  }

  const handleSaveDesign = (name: string, isDefault: boolean) => {
    const state: GridState = {
      columns: columnConfigs.map((c) => ({
        ...c,
        width: columnSizing[c.id],
        visible: columnVisibility[c.id] !== false,
      })),
      groups: grouping.map((g) => ({ columnId: g, direction: 'asc' as const })),
      filters: columnFilters.map((f) => ({
        columnId: f.id,
        operator: 'contains' as const,
        value: String(f.value),
      })),
      sorts: sorting.map((s) => ({ columnId: s.id, direction: s.desc ? 'desc' as const : 'asc' as const })),
      pageSize: 50,
      pinnedColumns: { left: [], right: [] },
    }

    onSaveDesign?.({
      name,
      userId: '',
      gridId: gridId || 'default',
      state,
      isDefault,
    })
    setShowSaveModal(false)
  }

  // Notify state changes
  useEffect(() => {
    onStateChange?.({
      columns: columnConfigs.map((c) => ({
        ...c,
        width: columnSizing[c.id],
        visible: columnVisibility[c.id] !== false,
      })),
      groups: grouping.map((g) => ({ columnId: g, direction: 'asc' })),
      filters: columnFilters.map((f) => ({ columnId: f.id, operator: 'contains', value: String(f.value) })),
      sorts: sorting.map((s) => ({ columnId: s.id, direction: s.desc ? 'desc' : 'asc' })),
      pageSize: 50,
      pinnedColumns: { left: [], right: [] },
    })
  }, [sorting, columnFilters, grouping, columnVisibility, columnOrder, columnSizing])

  // Selection change
  useEffect(() => {
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original)
    onSelectionChange?.(selectedRows)
  }, [rowSelection])

  return (
    <div className={clsx('flex flex-col rounded-xl border border-gray-700 bg-gray-900', className)}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-700 bg-gray-800/50 p-3">
        {/* Global Search */}
        {enableFiltering && (
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Ara..."
              className="rounded-lg border border-gray-600 bg-gray-700 py-1.5 pl-9 pr-3 text-sm text-white placeholder-gray-400 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex-1" />

        {/* Column Visibility */}
        <div className="relative">
          <button
            onClick={() => setShowColumnPanel(!showColumnPanel)}
            className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
          >
            <Columns size={16} />
            Kolonlar
          </button>
          {showColumnPanel && (
            <ColumnVisibilityPanel
              columns={columnConfigs}
              visibility={columnVisibility}
              onToggle={(id) => setColumnVisibility((prev) => ({ ...prev, [id]: !prev[id] }))}
              onClose={() => setShowColumnPanel(false)}
            />
          )}
        </div>

        {/* Export */}
        {enableExport && (
          <div className="flex gap-1">
            <button
              onClick={() => handleExport('excel')}
              className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-600"
            >
              <Download size={16} />
              Excel
            </button>
          </div>
        )}

        {/* Save/Load Design */}
        {onSaveDesign && (
          <>
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center gap-1 rounded-lg bg-cyan-600 px-3 py-1.5 text-sm text-white hover:bg-cyan-500"
            >
              <Save size={16} />
              Kaydet
            </button>
            {savedDesigns.length > 0 && (
              <select
                onChange={(e) => onLoadDesign?.(e.target.value)}
                className="rounded-lg border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-gray-300"
                defaultValue=""
              >
                <option value="" disabled>Tasarım Yükle</option>
                {savedDesigns.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </>
        )}

        {/* Row Count */}
        <span className="text-xs text-gray-500">
          {enableRowSelection && Object.keys(rowSelection).length > 0
            ? `${Object.keys(rowSelection).length} / ${data.length} seçili`
            : `${rows.length} kayıt`}
        </span>
      </div>

      {/* Grouping Drop Zone */}
      {enableGrouping && (
        <div className="border-b border-gray-700 p-2">
          <GroupDropZone
            groups={grouping.map((g) => ({
              columnId: g,
              label: columnConfigs.find((c) => c.id === g)?.header || g,
            }))}
            onRemoveGroup={(id) => setGrouping((prev) => prev.filter((g) => g !== id))}
          />
        </div>
      )}

      {/* Table Container */}
      <div
        ref={tableContainerRef}
        className="overflow-auto"
        style={{ height: typeof height === 'number' ? `${height}px` : height }}
      >
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
              <span className="text-gray-400">{loadingText}</span>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-gray-500">{emptyText}</span>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <table className="w-full border-collapse">
              <thead className="sticky top-0 z-10">
                <SortableContext
                  items={columnOrder}
                  strategy={horizontalListSortingStrategy}
                >
                  <tr>
                    {table.getHeaderGroups()[0]?.headers.map((header) => {
                      const colConfig = columnConfigs.find((c) => c.id === header.id)
                      if (!colConfig) return null
                      return (
                        <SortableHeaderCell
                          key={header.id}
                          column={{
                            ...colConfig,
                            width: columnSizing[header.id] || colConfig.width,
                          }}
                          onSort={() => header.column.toggleSorting()}
                          sortDirection={header.column.getIsSorted()}
                          onResize={(w) => handleResize(header.id, w)}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </SortableHeaderCell>
                      )
                    })}
                  </tr>
                </SortableContext>
              </thead>
              <tbody>
                {/* Padding top for virtual scroll */}
                {enableVirtualization && virtualRows[0]?.start > 0 && (
                  <tr>
                    <td style={{ height: virtualRows[0].start }} colSpan={columns.length} />
                  </tr>
                )}

                {(enableVirtualization ? virtualRows : rows.map((r, i) => ({ index: i }))).map((virtualRow) => {
                  const row = rows[virtualRow.index]
                  if (!row) return null

                  return (
                    <tr
                      key={row.id}
                      onClick={() => onRowClick?.(row.original)}
                      onDoubleClick={() => onRowDoubleClick?.(row.original)}
                      className={clsx(
                        'border-b border-gray-800 transition-colors',
                        'hover:bg-gray-800/50',
                        row.getIsSelected() && 'bg-cyan-900/30',
                        row.getIsGrouped() && 'bg-gray-800'
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-3 py-2 text-sm text-gray-300"
                          style={{ width: cell.column.getSize() }}
                        >
                          {cell.getIsGrouped() ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                row.toggleExpanded()
                              }}
                              className="flex items-center gap-1"
                            >
                              {row.getIsExpanded() ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </button>
                          ) : cell.getIsAggregated() ? (
                            flexRender(cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell, cell.getContext())
                          ) : cell.getIsPlaceholder() ? null : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}

                {/* Padding bottom for virtual scroll */}
                {enableVirtualization && virtualRows[virtualRows.length - 1]?.end < totalSize && (
                  <tr>
                    <td style={{ height: totalSize - virtualRows[virtualRows.length - 1].end }} colSpan={columns.length} />
                  </tr>
                )}
              </tbody>

              {/* Footer with Grand Total */}
              {enableGrandTotal && (
                <tfoot className="sticky bottom-0 bg-gray-800">
                  <tr>
                    {table.getFooterGroups()[0]?.headers.map((header) => (
                      <th
                        key={header.id}
                        className="border-t border-gray-700 px-3 py-2 text-left text-sm"
                      >
                        {flexRender(header.column.columnDef.footer, header.getContext())}
                      </th>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>

            <DragOverlay>
              {activeColumn && (
                <div className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium text-white shadow-lg">
                  {columnConfigs.find((c) => c.id === activeColumn)?.header}
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Save Design Modal */}
      {showSaveModal && (
        <SaveDesignModal
          onSave={handleSaveDesign}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  )
}

export default EnterpriseDataGrid

