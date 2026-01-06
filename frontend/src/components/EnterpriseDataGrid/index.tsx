// Enterprise DataGrid - Ana Bileşen
// Modern, özelleştirilebilir, kullanıcı tasarımı kaydedilebilir

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getGroupedRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  GroupingState,
  ExpandedState,
  VisibilityState,
  ColumnOrderState,
  RowSelectionState,
  ColumnPinningState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import * as XLSX from 'xlsx'
import { saveAs } from 'file-saver'
import clsx from 'clsx'

import { DataGridProps, ColumnConfig, GridState, FilterConfig, ServerSideAggregates, LoadedDesignInfo } from './types'
import { DataGridToolbar } from './Toolbar'
import { DataGridFilter } from './Filter'
import { SaveDesignModal } from './SaveDesignModal'
import { LoadDesignModal } from './LoadDesignModal'
import { ExportModal } from './ExportModal'
import { useTheme } from '../../hooks/useTheme'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

// Sürüklenebilir Kolon Başlığı - Sadece grip ikonu sürüklenebilir
const DraggableHeader: React.FC<{
  column: any
  children: React.ReactNode
}> = ({ column, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : undefined,
    backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.2)' : undefined,
    borderRadius: isDragging ? '4px' : undefined,
    padding: isDragging ? '4px' : undefined,
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 w-full">
      {/* Grip ikonu - SADECE bu alan sürüklenebilir */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={clsx(
          'flex-shrink-0 p-1 rounded cursor-grab active:cursor-grabbing',
          'text-gray-400 hover:text-blue-400 hover:bg-blue-500/10',
          'transition-colors touch-none select-none',
          isDragging && 'cursor-grabbing text-blue-400'
        )}
        style={{ touchAction: 'none' }}
        title="Sürükleyerek sıra değiştir"
        onMouseDown={(e) => e.stopPropagation()} // Sort click'ini engelle
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="5" r="2"/>
          <circle cx="12" cy="5" r="2"/>
          <circle cx="19" cy="5" r="2"/>
          <circle cx="5" cy="12" r="2"/>
          <circle cx="12" cy="12" r="2"/>
          <circle cx="19" cy="12" r="2"/>
          <circle cx="5" cy="19" r="2"/>
          <circle cx="12" cy="19" r="2"/>
          <circle cx="19" cy="19" r="2"/>
        </svg>
      </button>
      {children}
    </div>
  )
}

// Gruplama Alanı
const GroupingArea: React.FC<{
  grouping: string[]
  columns: ColumnConfig[]
  onRemove: (columnId: string) => void
  theme: any
}> = ({ grouping, columns, onRemove, theme }) => {
  if (grouping.length === 0) {
    return (
      <div className={clsx(
        'px-4 py-2 text-sm border-b border-dashed',
        theme.border,
        theme.contentTextMuted
      )}>
        💡 Gruplamak için kolon başlığını buraya sürükleyin
      </div>
    )
  }

  return (
    <div className={clsx('px-4 py-2 flex items-center gap-2 border-b', theme.border)}>
      <span className={clsx('text-sm', theme.contentTextMuted)}>Gruplama:</span>
      {grouping.map((columnId) => {
        const col = columns.find(c => c.id === columnId)
        return (
          <div
            key={columnId}
            className={clsx(
              'px-3 py-1 rounded-full text-sm flex items-center gap-2',
              'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            )}
          >
            {col?.header || columnId}
            <button
              onClick={() => onRemove(columnId)}
              className="hover:text-red-400 transition-colors"
            >
              ✕
            </button>
          </div>
        )
      })}
    </div>
  )
}

// Ana DataGrid Bileşeni
export const EnterpriseDataGrid: React.FC<DataGridProps> = ({
  gridId,
  data = [],
  columns: columnConfigs,
  datasetId, // Hangi dataset ile çalışıyoruz
  totalRows, // TÜM dataset satır sayısı (server-side)
  serverSideAggregates, // TÜM dataset için aggregate değerler (server-side)
  enableFiltering = true,
  enableSorting = true,
  enableGrouping = true,
  enableColumnReorder = true,
  enableColumnResize = true,
  enableColumnHide = true,
  enableExport = true,
  enablePagination = true,
  enableVirtualization = true,
  enableRowSelection = false,
  enableDensityToggle = true,
  hideGroupedColumns = true, // Varsayılan: gruplanan kolonları gizle
  enablePivot = false, // Pivot modu
  initialState,
  savedDesign,
  autoLoadDefaultDesign = true, // Varsayılan tasarımı otomatik yükle
  onStateChange,
  onDesignLoaded, // Tasarım yüklendiğinde parent'a haber ver
  onRowClick,
  onRowDoubleClick,
  onSelectionChange,
  className,
  height = 600,
  loading = false,
  emptyMessage = 'Veri bulunamadı',
}) => {
  const { theme } = useTheme()
  const { accessToken } = useAuthStore()
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)
  const isInitializedRef = useRef(false)
  const isUnmountedRef = useRef(false)

  // Component mount olduktan sonra ready state'ini ayarla
  useEffect(() => {
    isUnmountedRef.current = false
    // Bir sonraki render cycle'da ready ol
    const timer = requestAnimationFrame(() => {
      if (!isUnmountedRef.current) {
        setIsReady(true)
      }
    })
    return () => {
      cancelAnimationFrame(timer)
      isUnmountedRef.current = true
    }
  }, [])

  // Modal State
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [savedDesigns, setSavedDesigns] = useState<any[]>([])
  const [loadingDesigns, setLoadingDesigns] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [defaultDesignApplied, setDefaultDesignApplied] = useState(false)
  const [pendingDefaultDesign, setPendingDefaultDesign] = useState<any>(null)

  // State
  const [sorting, setSorting] = useState<SortingState>(
    savedDesign?.gridState?.sorting?.map(s => ({ id: s.columnId, desc: s.direction === 'desc' })) || []
  )
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [grouping, setGrouping] = useState<GroupingState>(
    savedDesign?.gridState?.grouping?.map(g => g.columnId) || []
  )
  const [expanded, setExpanded] = useState<ExpandedState>({})
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
    savedDesign?.gridState?.hiddenColumns?.reduce((acc, id) => ({ ...acc, [id]: false }), {}) || {}
  )
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    savedDesign?.gridState?.columnOrder || columnConfigs.map(c => c.id)
  )
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [density, setDensity] = useState<'compact' | 'normal' | 'comfortable'>(
    savedDesign?.gridState?.density || 'normal'
  )
  const [showFilters, setShowFilters] = useState(false)
  const [pivotMode, setPivotMode] = useState(false)
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(
    savedDesign?.gridState?.columnWidths || {}
  )
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(
    savedDesign?.gridState?.pinnedColumns 
      ? { left: savedDesign.gridState.pinnedColumns.left, right: savedDesign.gridState.pinnedColumns.right }
      : { left: [], right: [] }
  )
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean
    x: number
    y: number
    type: 'header' | 'cell'
    columnId: string
    value?: any
  } | null>(null)

  // Gruplanan kolonları otomatik gizle
  useEffect(() => {
    if (hideGroupedColumns) {
      setColumnVisibility(prev => {
        const newVisibility = { ...prev }
        // Tüm kolonları görünür yap (gruplama kalktığında)
        columnConfigs.forEach(col => {
          if (newVisibility[col.id] === false && !grouping.includes(col.id)) {
            // Sadece gruplama nedeniyle gizlenmişleri göster
            // Manuel gizlenenleri etkileme
          }
        })
        // Gruplanan kolonları gizle
        grouping.forEach(colId => {
          newVisibility[colId] = false
        })
        return newVisibility
      })
    }
  }, [grouping, hideGroupedColumns, columnConfigs])

  // API çağrıları - Tasarım kaydetme/yükleme
  const loadDesigns = useCallback(async () => {
    // Mount kontrolü - component hazır değilse çık
    if (isUnmountedRef.current) return
    if (!accessToken || !gridId) return
    
    // State güncellemeden önce mount kontrolü
    if (!isUnmountedRef.current) {
      setLoadingDesigns(true)
    }
    
    try {
      const response = await fetch(`${API_BASE}/core/grid-designs/${gridId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      // Async işlem sonrası tekrar kontrol
      if (isUnmountedRef.current) return
      
      const result = await response.json()
      if (result.success && !isUnmountedRef.current) {
        setSavedDesigns(result.data || [])
      }
    } catch (error) {
      if (!isUnmountedRef.current) {
        console.error('Failed to load designs:', error)
      }
    } finally {
      if (!isUnmountedRef.current) {
        setLoadingDesigns(false)
      }
    }
  }, [accessToken, gridId])

  const saveDesign = useCallback(async (name: string, isDefault: boolean) => {
    if (!accessToken || !gridId) return

    const currentState: GridState = {
      columns: columnConfigs,
      filters: columnFilters.map(f => ({
        columnId: f.id,
        operator: 'contains',
        value: f.value,
      })),
      sorting: sorting.map(s => ({
        columnId: s.id,
        direction: s.desc ? 'desc' : 'asc',
      })),
      grouping: grouping.map(g => ({ columnId: g })),
      columnOrder,
      hiddenColumns: Object.entries(columnVisibility)
        .filter(([_, visible]) => !visible)
        .map(([id]) => id),
      columnWidths,
      pinnedColumns: { left: columnPinning.left || [], right: columnPinning.right || [] },
      pageSize: 50,
      density,
    }

    const response = await fetch(`${API_BASE}/core/grid-designs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        gridId,
        name,
        state: currentState,
        isDefault,
        datasetId: datasetId || null // Dataset bilgisini de kaydet
      })
    })

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Kaydetme başarısız')
    }

    // Listeyi yenile
    await loadDesigns()
  }, [accessToken, gridId, columnConfigs, columnFilters, sorting, grouping, columnOrder, columnVisibility, columnWidths, density, loadDesigns, datasetId])

  const deleteDesign = useCallback(async (designId: string) => {
    if (!accessToken) return

    const response = await fetch(`${API_BASE}/core/grid-designs/${designId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` }
    })

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Silme başarısız')
    }

    // Listeyi yenile
    await loadDesigns()
  }, [accessToken, loadDesigns])

  const setDefaultDesign = useCallback(async (designId: string) => {
    if (!accessToken) return

    const response = await fetch(`${API_BASE}/core/grid-designs/${designId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ isDefault: true })
    })

    const result = await response.json()
    if (!result.success) {
      throw new Error(result.error || 'Güncelleme başarısız')
    }

    // Listeyi yenile
    await loadDesigns()
  }, [accessToken, loadDesigns])

  const applyDesign = useCallback((design: any) => {
    const state = typeof design.state === 'string' ? JSON.parse(design.state) : design.state
    
    // State'leri uygula - sadece mevcut kolonları kullan
    if (state.sorting) {
      const validSorting = state.sorting
        .filter((s: any) => columnConfigs.some(c => c.id === s.columnId))
        .map((s: any) => ({ id: s.columnId, desc: s.direction === 'desc' }))
      setSorting(validSorting)
    }
    if (state.grouping) {
      const validGrouping = state.grouping
        .map((g: any) => g.columnId)
        .filter((id: string) => columnConfigs.some(c => c.id === id))
      setGrouping(validGrouping)
    }
    if (state.columnOrder) {
      const validOrder = state.columnOrder.filter((id: string) => 
        columnConfigs.some(c => c.id === id)
      )
      setColumnOrder(validOrder.length > 0 ? validOrder : columnConfigs.map(c => c.id))
    }
    if (state.hiddenColumns) {
      setColumnVisibility(state.hiddenColumns.reduce((acc: any, id: string) => ({ ...acc, [id]: false }), {}))
    }
    if (state.columnWidths) {
      setColumnWidths(state.columnWidths)
    }
    if (state.density) {
      setDensity(state.density)
    }
    if (state.pinnedColumns) {
      setColumnPinning({
        left: state.pinnedColumns.left || [],
        right: state.pinnedColumns.right || []
      })
    }
    
    // Parent'a tasarım ve dataset bilgisini bildir
    if (onDesignLoaded) {
      onDesignLoaded({
        designId: design.id,
        designName: design.name,
        datasetId: design.dataset_id,
        datasetName: design.dataset_name,
        state
      })
    }
  }, [onDesignLoaded, columnConfigs])

  // İlk yüklemede ve accessToken değiştiğinde tasarımları al
  useEffect(() => {
    if (!isReady) return // Component henüz hazır değil
    if (!accessToken || !gridId) return
    if (isInitializedRef.current) return // Zaten yüklendi
    
    const initDesigns = async () => {
      isInitializedRef.current = true
      await loadDesigns()
    }
    initDesigns()
  }, [isReady, loadDesigns, accessToken, gridId])

  // Varsayılan tasarımı BUL ve dataset bilgisini parent'a bildir
  // AMA state'leri hemen uygulama - veri yüklenene kadar bekle
  // autoLoadDefaultDesign=false ise bu adımı atla
  useEffect(() => {
    if (!isReady) return
    if (!autoLoadDefaultDesign) return // Otomatik yükleme kapalı
    if (defaultDesignApplied) return
    
    const defaultDesign = savedDesigns.find(d => d.is_default)
    if (defaultDesign && !savedDesign) {
      // Dataset varsa, önce parent'a bildir ki veriyi yüklesin
      if (defaultDesign.dataset_id && onDesignLoaded) {
        setPendingDefaultDesign(defaultDesign)
        // Callback'i senkron çağır - handleDesignLoaded içinde loading state ayarlanacak
        if (!isUnmountedRef.current) {
          onDesignLoaded({
            designId: defaultDesign.id,
            designName: defaultDesign.name,
            datasetId: defaultDesign.dataset_id,
            datasetName: defaultDesign.dataset_name,
            state: typeof defaultDesign.state === 'string' 
              ? JSON.parse(defaultDesign.state) 
              : defaultDesign.state
          })
        }
      } else {
        // Dataset yoksa doğrudan uygula
        applyDesign(defaultDesign)
        setDefaultDesignApplied(true)
      }
    }
  }, [isReady, autoLoadDefaultDesign, savedDesigns, savedDesign, defaultDesignApplied, onDesignLoaded, applyDesign])

  // VERİ yüklendikten sonra pending tasarımı uygula
  useEffect(() => {
    if (!isReady) return
    if (!pendingDefaultDesign || data.length === 0 || columnConfigs.length === 0 || defaultDesignApplied) return
    
    // Gruplama kolonlarının mevcut olduğundan emin ol
    const state = typeof pendingDefaultDesign.state === 'string' 
      ? JSON.parse(pendingDefaultDesign.state) 
      : pendingDefaultDesign.state
    
    // Sadece mevcut kolonları gruplama/sıralamaya ekle
    if (state.sorting) {
      const validSorting = state.sorting
        .filter((s: any) => columnConfigs.some(c => c.id === s.columnId))
        .map((s: any) => ({ id: s.columnId, desc: s.direction === 'desc' }))
      setSorting(validSorting)
    }
    if (state.grouping) {
      const validGrouping = state.grouping
        .map((g: any) => g.columnId)
        .filter((id: string) => columnConfigs.some(c => c.id === id))
      setGrouping(validGrouping)
    }
    if (state.columnOrder) {
      const validOrder = state.columnOrder.filter((id: string) => 
        columnConfigs.some(c => c.id === id)
      )
      setColumnOrder(validOrder.length > 0 ? validOrder : columnConfigs.map(c => c.id))
    }
    if (state.hiddenColumns) {
      setColumnVisibility(state.hiddenColumns.reduce((acc: any, id: string) => ({ ...acc, [id]: false }), {}))
    }
    if (state.columnWidths) {
      setColumnWidths(state.columnWidths)
    }
    if (state.density) {
      setDensity(state.density)
    }
    
    setPendingDefaultDesign(null)
    setDefaultDesignApplied(true)
  }, [pendingDefaultDesign, data.length, columnConfigs, defaultDesignApplied])

  // Kolon tanımları
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const cols: ColumnDef<any>[] = columnConfigs.map((config) => ({
      id: config.id,
      accessorKey: config.accessorKey,
      header: config.header,
      size: columnWidths[config.id] || config.width || 150,
      minSize: config.minWidth || 50,
      maxSize: config.maxWidth || 500,
      enableSorting: config.sortable !== false,
      enableGrouping: config.groupable !== false,
      enableColumnFilter: config.filterable !== false,
      aggregationFn: config.aggregation === 'sum' ? 'sum' 
        : config.aggregation === 'avg' ? 'mean'
        : config.aggregation === 'count' ? 'count'
        : config.aggregation === 'min' ? 'min'
        : config.aggregation === 'max' ? 'max'
        : undefined,
      cell: ({ getValue, row }) => {
        const value = getValue()
        
        // Değer formatlama
        if (value === null || value === undefined) return '-'
        
        // Fonksiyon veya karmaşık obje kontrolü - bunları render etme
        if (typeof value === 'function') return '-'
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          return JSON.stringify(value)
        }
        
        switch (config.type) {
          case 'currency':
            return new Intl.NumberFormat('tr-TR', { 
              style: 'currency', 
              currency: 'TRY' 
            }).format(Number(value))
          case 'number':
            return new Intl.NumberFormat('tr-TR').format(Number(value))
          case 'percentage':
            return `${Number(value).toFixed(2)}%`
          case 'date':
            return new Date(value as string | number | Date).toLocaleDateString('tr-TR')
          case 'boolean':
            return value ? '✓' : '✗'
          default:
            return String(value)
        }
      },
      aggregatedCell: ({ getValue }) => {
        const value = getValue()
        if (value === null || value === undefined) return '-'
        
        // Fonksiyon veya karmaşık obje kontrolü
        if (typeof value === 'function') return '-'
        if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          return '-'
        }
        
        if (config.aggregation === 'count') {
          return `${value} kayıt`
        }
        
        if (config.type === 'currency') {
          return new Intl.NumberFormat('tr-TR', { 
            style: 'currency', 
            currency: 'TRY' 
          }).format(Number(value))
        }
        
        if (config.type === 'number' || config.type === 'percentage') {
          return new Intl.NumberFormat('tr-TR').format(Number(value))
        }
        
        return String(value)
      },
    }))

    // Seçim kolonu
    if (enableRowSelection) {
      cols.unshift({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="w-4 h-4 rounded"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="w-4 h-4 rounded"
          />
        ),
        size: 40,
        enableSorting: false,
        enableGrouping: false,
      })
    }

    return cols
  }, [columnConfigs, columnWidths, enableRowSelection])

  // State'leri filtrele - sadece mevcut kolonları içersin
  const validColumnIds = useMemo(() => columnConfigs.map(c => c.id), [columnConfigs])
  
  const validGrouping = useMemo(() => {
    if (!grouping || grouping.length === 0) return []
    return grouping.filter(id => validColumnIds.includes(id))
  }, [grouping, validColumnIds])

  const validSorting = useMemo(() => {
    if (!sorting || sorting.length === 0) return []
    return sorting.filter(s => validColumnIds.includes(s.id))
  }, [sorting, validColumnIds])

  const validColumnFilters = useMemo(() => {
    if (!columnFilters || columnFilters.length === 0) return []
    return columnFilters.filter(f => validColumnIds.includes(f.id))
  }, [columnFilters, validColumnIds])

  const validColumnVisibility = useMemo(() => {
    if (!columnVisibility || Object.keys(columnVisibility).length === 0) return {}
    const valid: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(columnVisibility)) {
      if (validColumnIds.includes(key)) {
        valid[key] = value
      }
    }
    return valid
  }, [columnVisibility, validColumnIds])

  const validColumnOrder = useMemo(() => {
    if (!columnOrder || columnOrder.length === 0) return []
    return columnOrder.filter(id => validColumnIds.includes(id))
  }, [columnOrder, validColumnIds])

  // Özel global filter fonksiyonu - tarih formatlarını da destekler
  const globalFilterFn = useCallback((row: any, columnId: string, filterValue: string) => {
    const value = row.getValue(columnId)
    if (value === null || value === undefined) return false
    
    const searchValue = filterValue.toLowerCase().trim()
    if (!searchValue) return true
    
    // String değer
    const stringValue = String(value).toLowerCase()
    if (stringValue.includes(searchValue)) return true
    
    // Tarih değeri için farklı formatları dene
    const config = columnConfigs.find(c => c.id === columnId)
    if (config?.type === 'date' || config?.type === 'datetime') {
      try {
        const dateValue = new Date(value as string | number | Date)
        if (!isNaN(dateValue.getTime())) {
          // Türkçe format: dd.MM.yyyy
          const trFormat = dateValue.toLocaleDateString('tr-TR')
          if (trFormat.includes(searchValue)) return true
          
          // ISO format: yyyy-MM-dd
          const isoFormat = dateValue.toISOString().split('T')[0]
          if (isoFormat.includes(searchValue)) return true
          
          // Kısa format: dd.MM.yy
          const shortFormat = `${String(dateValue.getDate()).padStart(2, '0')}.${String(dateValue.getMonth() + 1).padStart(2, '0')}.${String(dateValue.getFullYear()).slice(-2)}`
          if (shortFormat.includes(searchValue)) return true
        }
      } catch {
        // Tarih parse hatası, devam et
      }
    }
    
    return false
  }, [columnConfigs])

  // Tablo instance
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting: validSorting,
      columnFilters: validColumnFilters,
      globalFilter,
      grouping: validGrouping,
      expanded,
      columnVisibility: validColumnVisibility,
      columnOrder: validColumnOrder,
      rowSelection,
      columnPinning,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onRowSelectionChange: setRowSelection,
    onColumnPinningChange: setColumnPinning,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: enableFiltering ? getFilteredRowModel() : undefined,
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getGroupedRowModel: enableGrouping ? getGroupedRowModel() : undefined,
    getExpandedRowModel: enableGrouping ? getExpandedRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    globalFilterFn, // Özel global filter fonksiyonu
    enableRowSelection,
    debugTable: false,
  })

  // Virtual scrolling
  const { rows } = table.getRowModel()
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => density === 'compact' ? 32 : density === 'comfortable' ? 48 : 40,
    overscan: 10,
  })
  const virtualRows = rowVirtualizer.getVirtualItems()

  // DnD sensörler - düşük mesafe ile hızlı aktivasyon
  const sensors = useSensors(
    useSensor(PointerSensor, { 
      activationConstraint: { 
        distance: 3, // Çok az hareketle başlasın
      } 
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Kolon sıralaması değiştiğinde
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (active && over && active.id !== over.id) {
      // Mevcut header sırasını al
      const currentOrder = table.getAllLeafColumns().map(col => col.id)
      const oldIndex = currentOrder.indexOf(active.id as string)
      const newIndex = currentOrder.indexOf(over.id as string)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(currentOrder, oldIndex, newIndex)
        setColumnOrder(newOrder)
      }
    }
  }, [table])

  // Export fonksiyonları - Tasarıma uygun (gruplama, sıralama, format desteği)
  // Modal aç (kullanıcıdan satır sayısı sor)
  const exportToExcel = useCallback(() => {
    setShowExportModal(true)
  }, [])

  // Gerçek export fonksiyonu - Backend'den veri çeker, Excel outline ile export eder
  const performExcelExport = useCallback(async (rowLimit: number) => {
    const EXCEL_ROW_LIMIT = 1000000 // Excel satır limiti
    const BATCH_SIZE = 100000 // Her batch'te çekilecek satır
    
    // Görünen kolonları al (select hariç)
    const visibleColumns = table.getVisibleLeafColumns().filter(col => col.id !== 'select')
    const headers = visibleColumns.map(col => col.columnDef.header as string)
    const hasGrouping = grouping.length > 0
    
    let allData: any[] = []
    
    setExportProgress(5)
    
    // DatasetId varsa backend'den çek, yoksa mevcut veriyi kullan
    if (datasetId && accessToken) {
      // 1. Backend'den veri çek (pagination ile)
      let offset = 0
      let hasMore = true
      
      // Sıralama parametresi
      const orderBy = sorting.length > 0 ? sorting[0].id : ''
      const sortOrder = sorting.length > 0 && sorting[0].desc ? 'DESC' : 'ASC'
      
      while (hasMore && allData.length < rowLimit) {
        const batchLimit = Math.min(BATCH_SIZE, rowLimit - allData.length)
        const url = `${API_BASE}/data/datasets/${datasetId}/export?limit=${batchLimit}&offset=${offset}&orderBy=${orderBy}&sortOrder=${sortOrder}`
        
        try {
          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
          })
          const result = await response.json()
          
          if (result.success && result.data?.rows) {
            allData = [...allData, ...result.data.rows]
            hasMore = result.data.hasMore && allData.length < rowLimit
            offset += batchLimit
            
            // Progress güncelle (veri çekme %5-50)
            const fetchProgress = Math.min(45, Math.floor((allData.length / rowLimit) * 45))
            setExportProgress(5 + fetchProgress)
          } else {
            hasMore = false
          }
        } catch (error) {
          console.error('Export data fetch error:', error)
          throw error
        }
      }
    } else {
      // Dataset yok, mevcut grid verisini kullan
      allData = data.slice(0, rowLimit)
      setExportProgress(45)
    }
    
    // Veri yoksa hata fırlat
    if (allData.length === 0) {
      throw new Error('Export edilecek veri bulunamadı')
    }
    
    setExportProgress(50)
    
    // 2. Gruplama varsa client-side gruplama yap
    type ExportRow = {
      data: any[]
      isGroup: boolean
      level: number
      collapsed?: boolean
    }
    
    const processedRows: ExportRow[] = []
    
    if (hasGrouping && allData.length > 0) {
      // Gruplama mantığı
      const groupData = (data: any[], groupColumns: string[], depth: number = 0): void => {
        if (groupColumns.length === 0) {
          // Artık grup yok, veri satırlarını ekle
          data.forEach(row => {
            const rowData = visibleColumns.map(col => row[col.id] ?? '')
            processedRows.push({ data: rowData, isGroup: false, level: depth })
          })
          return
        }
        
        const currentGroupCol = groupColumns[0]
        const remainingGroupCols = groupColumns.slice(1)
        
        // Gruplara ayır
        const groups: Record<string, any[]> = {}
        data.forEach(row => {
          const key = String(row[currentGroupCol] ?? 'Tanımsız')
          if (!groups[key]) groups[key] = []
          groups[key].push(row)
        })
        
        // Her grubu işle
        Object.entries(groups).forEach(([groupValue, groupItems]) => {
          // Grup başlık satırı
          const groupColConfig = columnConfigs.find(c => c.id === currentGroupCol)
          const groupColName = groupColConfig?.header || currentGroupCol
          const groupRow = new Array(visibleColumns.length).fill('')
          groupRow[0] = `${groupColName}: ${groupValue} (${groupItems.length} kayıt)`
          
          // Aggregated değerleri hesapla
          visibleColumns.forEach((col, idx) => {
            const config = columnConfigs.find(c => c.id === col.id)
            if (config?.aggregation && idx > 0) {
              const values = groupItems.map(item => parseFloat(item[col.id]) || 0)
              switch (config.aggregation) {
                case 'sum': groupRow[idx] = values.reduce((a, b) => a + b, 0); break
                case 'avg': groupRow[idx] = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0; break
                case 'count': groupRow[idx] = values.length; break
                case 'min': groupRow[idx] = Math.min(...values); break
                case 'max': groupRow[idx] = Math.max(...values); break
              }
            }
          })
          
          processedRows.push({ data: groupRow, isGroup: true, level: depth, collapsed: false })
          
          // Alt grupları veya veriyi işle
          groupData(groupItems, remainingGroupCols, depth + 1)
        })
      }
      
      groupData(allData, [...grouping])
    } else {
      // Gruplama yok, direkt ekle
      allData.forEach(row => {
        const rowData = visibleColumns.map(col => row[col.id] ?? '')
        processedRows.push({ data: rowData, isGroup: false, level: 0 })
      })
    }
    
    setExportProgress(70)
    
    // 3. Excel workbook oluştur
    const wb = XLSX.utils.book_new()
    const totalDataRows = processedRows.length
    const sheetsNeeded = Math.ceil(totalDataRows / EXCEL_ROW_LIMIT)
    
    for (let sheetIdx = 0; sheetIdx < sheetsNeeded; sheetIdx++) {
      const startRow = sheetIdx * EXCEL_ROW_LIMIT
      const endRow = Math.min(startRow + EXCEL_ROW_LIMIT, totalDataRows)
      const sheetRows = processedRows.slice(startRow, endRow)
      
      // Header + data
      const wsData: any[][] = [headers]
      const rowOutlines: { level: number; hidden?: boolean }[] = [{ level: 0 }] // Header için
      
      sheetRows.forEach(row => {
        wsData.push(row.data)
        // Excel outline level (grup satırları level 0-1, alt satırlar level 2+)
        rowOutlines.push({ 
          level: row.isGroup ? row.level : row.level + 1,
          hidden: false // Başlangıçta açık
        })
      })
      
      // Footer toplamları (son sayfaya)
      if (sheetIdx === sheetsNeeded - 1 && columnConfigs.some(c => c.aggregation)) {
        wsData.push(new Array(visibleColumns.length).fill(''))
        rowOutlines.push({ level: 0 })
        
        const footerRow: any[] = ['Σ TOPLAM']
        visibleColumns.slice(1).forEach(col => {
          const config = columnConfigs.find(c => c.id === col.id)
          if (config?.aggregation && serverSideAggregates) {
            const serverAggKey = config.accessorKey || col.id
            const serverAgg = serverSideAggregates[serverAggKey]
            if (typeof serverAgg === 'object') {
              switch (config.aggregation) {
                case 'sum': footerRow.push(serverAgg.sum); break
                case 'avg': footerRow.push(serverAgg.avg); break
                case 'count': footerRow.push(serverAgg.count); break
                case 'min': footerRow.push(serverAgg.min); break
                case 'max': footerRow.push(serverAgg.max); break
                default: footerRow.push('')
              }
            } else {
              footerRow.push('')
            }
          } else {
            footerRow.push('')
          }
        })
        wsData.push(footerRow)
        rowOutlines.push({ level: 0 })
      }
      
      const ws = XLSX.utils.aoa_to_sheet(wsData)
      
      // Excel Row Outline (açılır/kapanır gruplar)
      if (hasGrouping) {
        ws['!rows'] = rowOutlines
        ws['!outline'] = { above: false, left: false }
      }
      
      // Kolon genişlikleri
      const colWidths = headers.map((h, idx) => {
        const maxLen = Math.max(h.length, ...wsData.slice(0, 100).map(row => String(row[idx] || '').length))
        return { wch: Math.min(Math.max(maxLen + 2, 10), 50) }
      })
      ws['!cols'] = colWidths
      
      const sheetName = sheetsNeeded > 1 ? `Sayfa ${sheetIdx + 1}` : 'Data'
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
      
      // Progress güncelle (%70-95)
      const sheetProgress = Math.floor(((sheetIdx + 1) / sheetsNeeded) * 25)
      setExportProgress(70 + sheetProgress)
    }
    
    setExportProgress(95)
    
    // 4. Dosyayı indir
    const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    
    const dateStr = new Date().toISOString().split('T')[0]
    const fileName = `export_${dateStr}_${allData.length}rows.xlsx`
    saveAs(blob, fileName)
    
    setExportProgress(100)
  }, [table, grouping, sorting, columnConfigs, serverSideAggregates, datasetId, accessToken, data])

  const exportToCSV = useCallback(() => {
    // Görünen kolonları al (select hariç)
    const visibleColumns = table.getVisibleLeafColumns().filter(col => col.id !== 'select')
    const headers = visibleColumns.map(col => col.columnDef.header as string)
    
    // Gruplama var mı?
    const hasGrouping = grouping.length > 0
    
    // Tüm satırları topla
    const allRows: any[][] = []
    
    const processRows = (rows: any[], depth: number = 0) => {
      rows.forEach(row => {
        if (row.getIsGrouped()) {
          const groupColumn = row.groupingColumnId
          const groupValue = row.getValue(groupColumn!)
          const subRowCount = row.subRows.length
          const groupRow: any[] = new Array(visibleColumns.length).fill('')
          const indent = '  '.repeat(depth)
          const groupColConfig = columnConfigs.find(c => c.id === groupColumn)
          const groupColName = groupColConfig?.header || groupColumn
          groupRow[0] = `${indent}[${groupColName}: ${groupValue}] (${subRowCount} kayıt)`
          allRows.push(groupRow)
          if (row.subRows.length > 0) {
            processRows(row.subRows, depth + 1)
          }
        } else {
          const rowData: any[] = []
          const indent = hasGrouping ? '  '.repeat(depth) : ''
          visibleColumns.forEach((col, idx) => {
            const cellValue = row.getValue(col.id)
            if (idx === 0 && hasGrouping) {
              rowData.push(`${indent}${cellValue ?? ''}`)
            } else {
              rowData.push(cellValue ?? '')
            }
          })
          allRows.push(rowData)
        }
      })
    }
    
    processRows(table.getRowModel().rows)
    
    // CSV oluştur
    const wsData = [headers, ...allRows]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const csv = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    saveAs(blob, `export_${new Date().toISOString().split('T')[0]}.csv`)
  }, [table, grouping, columnConfigs])

  // Context Menu Handler
  const handleContextMenu = useCallback((e: React.MouseEvent, type: 'header' | 'cell', columnId: string, value?: any) => {
    e.preventDefault()
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      columnId,
      value
    })
  }, [])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Document click ile context menu kapat
  useEffect(() => {
    const handleClick = () => closeContextMenu()
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [closeContextMenu])

  // Clipboard - Ctrl+C desteği
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+C veya Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selectedRows = table.getSelectedRowModel().rows
        if (selectedRows.length > 0) {
          e.preventDefault()
          
          // Seçili satırları TSV formatında kopyala
          const visibleColumns = table.getVisibleLeafColumns().filter(col => col.id !== 'select')
          const headers = visibleColumns.map(col => col.columnDef.header as string).join('\t')
          
          const rows = selectedRows.map(row => 
            visibleColumns.map(col => {
              const value = row.getValue(col.id)
              return value ?? ''
            }).join('\t')
          ).join('\n')
          
          const clipboardData = `${headers}\n${rows}`
          navigator.clipboard.writeText(clipboardData).then(() => {
            // Kopyalama başarılı bildirimi (opsiyonel toast)
          }).catch(err => {
            console.error('Kopyalama başarısız:', err)
          })
        }
      }
      
      // Ctrl+A - Tümünü seç
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // Grid container'ı focus'taysa tümünü seç
        if (tableContainerRef.current?.contains(document.activeElement)) {
          e.preventDefault()
          table.toggleAllRowsSelected(true)
        }
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [table])

  // State değişikliklerini bildir
  useEffect(() => {
    if (onStateChange) {
      const currentState: GridState = {
        columns: columnConfigs,
        filters: columnFilters.map(f => ({
          columnId: f.id,
          operator: 'contains',
          value: f.value,
        })),
        sorting: sorting.map(s => ({
          columnId: s.id,
          direction: s.desc ? 'desc' : 'asc',
        })),
        grouping: grouping.map(g => ({ columnId: g })),
        columnOrder,
        hiddenColumns: Object.entries(columnVisibility)
          .filter(([_, visible]) => !visible)
          .map(([id]) => id),
        columnWidths,
        pinnedColumns: { left: columnPinning.left || [], right: columnPinning.right || [] },
        pageSize: table.getState().pagination.pageSize,
        density,
      }
      onStateChange(currentState)
    }
  }, [sorting, columnFilters, grouping, columnOrder, columnVisibility, columnWidths, density])

  // Seçim değişikliklerini bildir
  useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map(row => row.original)
      onSelectionChange(selectedRows)
    }
  }, [rowSelection, onSelectionChange])

  // Yoğunluk stilleri
  const densityStyles = {
    compact: 'py-1 text-xs',
    normal: 'py-2 text-sm',
    comfortable: 'py-3 text-base',
  }

  return (
    <div className={clsx('flex flex-col rounded-lg overflow-hidden border', theme.border, theme.cardBg, className)}>
      {/* Toolbar */}
      <DataGridToolbar
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
        columns={columnConfigs}
        hiddenColumns={Object.entries(columnVisibility).filter(([_, v]) => !v).map(([k]) => k)}
        onColumnVisibilityChange={(id, visible) => setColumnVisibility(prev => ({ ...prev, [id]: visible }))}
        grouping={grouping.map(g => ({ columnId: g }))}
        onGroupingChange={(g) => setGrouping(g.map(gg => gg.columnId))}
        density={density}
        onDensityChange={setDensity}
        onExportExcel={exportToExcel}
        onExportCSV={exportToCSV}
        onSaveDesign={() => setShowSaveModal(true)}
        onLoadDesign={() => {
          setShowLoadModal(true)
          loadDesigns() // Modal açıkken yüklenir, loading spinner gösterilir
        }}
        activeFiltersCount={columnFilters.length}
        onClearFilters={() => setColumnFilters([])}
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        enableExport={enableExport}
        enableColumnHide={enableColumnHide}
        enableDensityToggle={enableDensityToggle}
        enablePivot={enablePivot}
        pivotMode={pivotMode}
        onPivotModeChange={setPivotMode}
        theme={theme}
      />

      {/* Gruplama Alanı */}
      {enableGrouping && (
        <GroupingArea
          grouping={grouping}
          columns={columnConfigs}
          onRemove={(id) => setGrouping(prev => prev.filter(g => g !== id))}
          theme={theme}
        />
      )}

      {/* Filtre Satırı */}
      {showFilters && enableFiltering && (
        <DataGridFilter
          columns={columnConfigs}
          columnFilters={columnFilters}
          onColumnFiltersChange={setColumnFilters}
          theme={theme}
        />
      )}

      {/* Pivot Panel */}
      {pivotMode && enablePivot && (
        <div className={clsx('px-4 py-3 border-b', theme.border, 'bg-purple-500/5')}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className={clsx('text-sm font-medium', theme.contentText)}>Pivot Modu:</span>
              <span className="text-xs text-purple-400">
                Gruplama özelliğini kullanarak verileri özetleyin. Birden fazla kolon gruplayarak pivot tablo oluşturabilirsiniz.
              </span>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-gray-400">İpucu: Kolon başlığındaki ⊞ butonuna tıklayarak grupla</span>
            </div>
          </div>
          {grouping.length > 0 && (
            <div className="mt-2 text-xs text-purple-400">
              ✓ {grouping.length} kolon gruplandı - Agregasyon değerleri gösteriliyor
            </div>
          )}
        </div>
      )}

      {/* Tablo */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <div 
          ref={tableContainerRef}
          className="overflow-auto"
          style={{ height: typeof height === 'number' ? `${height}px` : height }}
        >
          <table className="w-full border-collapse">
            {/* Header */}
            <thead className={clsx('sticky top-0 z-10', theme.cardBg)}>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  <SortableContext
                    items={headerGroup.headers.map(h => h.column.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map(header => {
                      const isPinnedLeft = columnPinning.left?.includes(header.column.id)
                      const isPinnedRight = columnPinning.right?.includes(header.column.id)
                      return (
                      <th
                        key={header.id}
                        className={clsx(
                          'px-3 text-left font-semibold border-b-2 group relative',
                          densityStyles[density],
                          theme.border,
                          theme.contentText,
                          isPinnedLeft && 'sticky left-0 z-20 bg-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.3)]',
                          isPinnedRight && 'sticky right-0 z-20 bg-slate-800 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]'
                        )}
                        style={{ 
                          width: header.getSize(),
                          ...(isPinnedLeft && { left: 0 }),
                          ...(isPinnedRight && { right: 0 })
                        }}
                        onContextMenu={(e) => handleContextMenu(e, 'header', header.column.id)}
                      >
                        {header.isPlaceholder ? null : (
                          <div className="flex items-center gap-2">
                            {enableColumnReorder && header.column.id !== 'select' ? (
                              <DraggableHeader column={header.column}>
                                <div
                                  className={clsx(
                                    'flex items-center gap-1',
                                    header.column.getCanSort() && 'cursor-pointer select-none'
                                  )}
                                  onClick={header.column.getToggleSortingHandler()}
                                >
                                  {flexRender(header.column.columnDef.header, header.getContext())}
                                  {header.column.getIsSorted() && (
                                    <span className="text-blue-400">
                                      {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                                    </span>
                                  )}
                                </div>
                              </DraggableHeader>
                            ) : (
                              <div
                                className={clsx(
                                  'flex items-center gap-1',
                                  header.column.getCanSort() && 'cursor-pointer select-none'
                                )}
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                {flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() && (
                                  <span className="text-blue-400">
                                    {header.column.getIsSorted() === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {/* Gruplama butonu */}
                            {enableGrouping && header.column.getCanGroup() && (
                              <button
                                onClick={() => {
                                  if (grouping.includes(header.column.id)) {
                                    setGrouping(prev => prev.filter(g => g !== header.column.id))
                                  } else {
                                    setGrouping(prev => [...prev, header.column.id])
                                  }
                                }}
                                className={clsx(
                                  'p-1 rounded hover:bg-blue-500/20 transition-colors',
                                  grouping.includes(header.column.id) && 'text-blue-400'
                                )}
                                title={grouping.includes(header.column.id) ? 'Grubu kaldır' : 'Grupla'}
                              >
                                {grouping.includes(header.column.id) ? '⊟' : '⊞'}
                              </button>
                            )}
                            
                            {/* Kolon sabitleme butonu */}
                            {header.column.id !== 'select' && (
                              <div className="relative opacity-0 group-hover:opacity-100">
                                {columnPinning.left?.includes(header.column.id) ? (
                                  <button
                                    onClick={() => setColumnPinning(prev => ({
                                      ...prev,
                                      left: prev.left?.filter(id => id !== header.column.id) || []
                                    }))}
                                    className="p-1 rounded hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                                    title="Sabitlemeyi kaldır"
                                  >
                                    📌
                                  </button>
                                ) : columnPinning.right?.includes(header.column.id) ? (
                                  <button
                                    onClick={() => setColumnPinning(prev => ({
                                      ...prev,
                                      right: prev.right?.filter(id => id !== header.column.id) || []
                                    }))}
                                    className="p-1 rounded hover:bg-yellow-500/20 text-yellow-400 transition-colors"
                                    title="Sabitlemeyi kaldır"
                                  >
                                    📌
                                  </button>
                                ) : (
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => setColumnPinning(prev => ({
                                        ...prev,
                                        left: [...(prev.left || []), header.column.id]
                                      }))}
                                      className="p-0.5 text-xs rounded hover:bg-blue-500/20 transition-colors"
                                      title="Sola sabitle"
                                    >
                                      ◀
                                    </button>
                                    <button
                                      onClick={() => setColumnPinning(prev => ({
                                        ...prev,
                                        right: [...(prev.right || []), header.column.id]
                                      }))}
                                      className="p-0.5 text-xs rounded hover:bg-blue-500/20 transition-colors"
                                      title="Sağa sabitle"
                                    >
                                      ▶
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Kolon gizle butonu */}
                            {enableColumnHide && header.column.id !== 'select' && (
                              <button
                                onClick={() => setColumnVisibility(prev => ({ ...prev, [header.column.id]: false }))}
                                className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Kolonu gizle"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                        
                        {/* Kolon yeniden boyutlandırma */}
                        {enableColumnResize && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={clsx(
                              'absolute right-0 top-0 h-full w-1 cursor-col-resize',
                              'hover:bg-blue-500 transition-colors',
                              header.column.getIsResizing() && 'bg-blue-500'
                            )}
                          />
                        )}
                      </th>
                    )})}
                  </SortableContext>
                </tr>
              ))}
            </thead>

            {/* Body */}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length} className={clsx('text-center py-8', theme.contentTextMuted)}>
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      Yükleniyor...
                    </div>
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className={clsx('text-center py-8', theme.contentTextMuted)}>
                    {emptyMessage}
                  </td>
                </tr>
              ) : enableVirtualization ? (
                <>
                  {virtualRows.length > 0 && (
                    <tr style={{ height: `${virtualRows[0].start}px` }}>
                      <td colSpan={columns.length} />
                    </tr>
                  )}
                  {virtualRows.map(virtualRow => {
                    const row = rows[virtualRow.index]
                    const isGroupRow = row.getIsGrouped()
                    const groupDepth = row.depth || 0
                    
                    // Grup satırı için özel render
                    if (isGroupRow) {
                      // Bu satırın hangi kolon için grup olduğunu bul
                      const groupingColumnId = grouping[groupDepth]
                      const groupingColumn = columnConfigs.find(c => c.id === groupingColumnId)
                      const groupValue = row.getGroupingValue(groupingColumnId)
                      
                      return (
                        <tr
                          key={row.id}
                          className={clsx(
                            'border-b transition-colors cursor-pointer',
                            theme.border,
                            groupDepth === 0 ? 'bg-blue-500/10' : 'bg-blue-500/5',
                            'hover:bg-blue-500/20'
                          )}
                          onClick={() => row.getToggleExpandedHandler()()}
                        >
                          <td
                            colSpan={table.getVisibleLeafColumns().length}
                            className={clsx('px-3', densityStyles[density])}
                          >
                            <div 
                              className="flex items-center gap-2"
                              style={{ paddingLeft: `${groupDepth * 24}px` }}
                            >
                              <span className="text-blue-400">
                                {row.getIsExpanded() ? '▼' : '▶'}
                              </span>
                              <span className={clsx('text-xs px-2 py-0.5 rounded', 'bg-blue-500/20 text-blue-400')}>
                                {groupingColumn?.header || groupingColumnId}
                              </span>
                              <span className={clsx('font-semibold', theme.contentText)}>
                                {String(groupValue ?? '-')}
                              </span>
                              <span className={clsx('text-xs', theme.contentTextMuted)}>
                                ({row.subRows.length} kayıt)
                              </span>
                              {/* Aggregated değerler */}
                              <div className="flex items-center gap-4 ml-auto">
                                {row.getVisibleCells()
                                  .filter(cell => cell.getIsAggregated())
                                  .map(cell => {
                                    // Aggregated değeri doğrudan al (flexRender kullanmadan)
                                    const rawValue = cell.getValue()
                                    
                                    // Değer yoksa veya geçersizse atla
                                    if (rawValue === null || rawValue === undefined || typeof rawValue === 'function') {
                                      return null
                                    }
                                    
                                    // Sayısal değerleri formatla
                                    let displayValue: string
                                    if (typeof rawValue === 'number') {
                                      displayValue = new Intl.NumberFormat('tr-TR', {
                                        maximumFractionDigits: 2
                                      }).format(rawValue)
                                    } else {
                                      displayValue = String(rawValue)
                                    }
                                    
                                    // Kolon başlığını güvenli şekilde al
                                    const header = typeof cell.column.columnDef.header === 'string' 
                                      ? cell.column.columnDef.header 
                                      : cell.column.id
                                    
                                    return (
                                      <span key={cell.id} className="text-sm text-blue-400">
                                        <span className="text-xs text-gray-500 mr-1">
                                          {header}:
                                        </span>
                                        {displayValue}
                                      </span>
                                    )
                                  })
                                }
                              </div>
                            </div>
                          </td>
                        </tr>
                      )
                    }
                    
                    // Normal veri satırı
                    return (
                      <tr
                        key={row.id}
                        className={clsx(
                          'border-b transition-colors',
                          theme.border,
                          row.getIsSelected() && 'bg-blue-500/10',
                          'hover:bg-white/5'
                        )}
                        style={{ paddingLeft: grouping.length > 0 ? `${grouping.length * 24}px` : undefined }}
                        onClick={() => onRowClick?.(row.original)}
                        onDoubleClick={() => onRowDoubleClick?.(row.original)}
                      >
                        {row.getVisibleCells().map(cell => {
                          const isPinnedLeft = columnPinning.left?.includes(cell.column.id)
                          const isPinnedRight = columnPinning.right?.includes(cell.column.id)
                          const cellValue = cell.getValue()
                          return (
                          <td
                            key={cell.id}
                            className={clsx(
                              'px-3',
                              densityStyles[density],
                              theme.contentText,
                              isPinnedLeft && 'sticky left-0 z-10 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.3)]',
                              isPinnedRight && 'sticky right-0 z-10 bg-slate-900 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]'
                            )}
                            style={{
                              ...(isPinnedLeft && { left: 0 }),
                              ...(isPinnedRight && { right: 0 })
                            }}
                            onContextMenu={(e) => handleContextMenu(e, 'cell', cell.column.id, cellValue)}
                          >
                            {cell.getIsPlaceholder() ? null : (
                              flexRender(cell.column.columnDef.cell, cell.getContext())
                            )}
                          </td>
                        )})}
                      </tr>
                    )
                  })}
                  {virtualRows.length > 0 && (
                    <tr style={{ height: `${rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0)}px` }}>
                      <td colSpan={columns.length} />
                    </tr>
                  )}
                </>
              ) : (
                rows.map(row => {
                  const isGroupRow = row.getIsGrouped()
                  const groupDepth = row.depth || 0
                  
                  // Grup satırı için özel render
                  if (isGroupRow) {
                    const groupingColumnId = grouping[groupDepth]
                    const groupingColumn = columnConfigs.find(c => c.id === groupingColumnId)
                    const groupValue = row.getGroupingValue(groupingColumnId)
                    
                    return (
                      <tr
                        key={row.id}
                        className={clsx(
                          'border-b transition-colors cursor-pointer',
                          theme.border,
                          groupDepth === 0 ? 'bg-blue-500/10' : 'bg-blue-500/5',
                          'hover:bg-blue-500/20'
                        )}
                        onClick={() => row.getToggleExpandedHandler()()}
                      >
                        <td
                          colSpan={table.getVisibleLeafColumns().length}
                          className={clsx('px-3', densityStyles[density])}
                        >
                          <div 
                            className="flex items-center gap-2"
                            style={{ paddingLeft: `${groupDepth * 24}px` }}
                          >
                            <span className="text-blue-400">
                              {row.getIsExpanded() ? '▼' : '▶'}
                            </span>
                            <span className={clsx('text-xs px-2 py-0.5 rounded', 'bg-blue-500/20 text-blue-400')}>
                              {groupingColumn?.header || groupingColumnId}
                            </span>
                            <span className={clsx('font-semibold', theme.contentText)}>
                              {String(groupValue ?? '-')}
                            </span>
                            <span className={clsx('text-xs', theme.contentTextMuted)}>
                              ({row.subRows.length} kayıt)
                            </span>
                            {/* Aggregated değerler */}
                            <div className="flex items-center gap-4 ml-auto">
                              {row.getVisibleCells()
                                .filter(cell => cell.getIsAggregated())
                                .map(cell => {
                                  // Aggregated değeri doğrudan al (flexRender kullanmadan)
                                  const rawValue = cell.getValue()
                                  
                                  // Değer yoksa veya geçersizse atla
                                  if (rawValue === null || rawValue === undefined || typeof rawValue === 'function') {
                                    return null
                                  }
                                  
                                  // Sayısal değerleri formatla
                                  let displayValue: string
                                  if (typeof rawValue === 'number') {
                                    displayValue = new Intl.NumberFormat('tr-TR', {
                                      maximumFractionDigits: 2
                                    }).format(rawValue)
                                  } else {
                                    displayValue = String(rawValue)
                                  }
                                  
                                  // Kolon başlığını güvenli şekilde al
                                  const header = typeof cell.column.columnDef.header === 'string' 
                                    ? cell.column.columnDef.header 
                                    : cell.column.id
                                  
                                  return (
                                    <span key={cell.id} className="text-sm text-blue-400">
                                      <span className="text-xs text-gray-500 mr-1">
                                        {header}:
                                      </span>
                                      {displayValue}
                                    </span>
                                  )
                                })
                              }
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  }
                  
                  // Normal veri satırı
                  return (
                    <tr
                      key={row.id}
                      className={clsx(
                        'border-b transition-colors',
                        theme.border,
                        row.getIsSelected() && 'bg-blue-500/10',
                        'hover:bg-white/5'
                      )}
                      onClick={() => onRowClick?.(row.original)}
                      onDoubleClick={() => onRowDoubleClick?.(row.original)}
                    >
                      {row.getVisibleCells().map(cell => {
                        const isPinnedLeft = columnPinning.left?.includes(cell.column.id)
                        const isPinnedRight = columnPinning.right?.includes(cell.column.id)
                        const cellValue = cell.getValue()
                        return (
                        <td
                          key={cell.id}
                          className={clsx(
                            'px-3', 
                            densityStyles[density], 
                            theme.contentText,
                            isPinnedLeft && 'sticky left-0 z-10 bg-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.3)]',
                            isPinnedRight && 'sticky right-0 z-10 bg-slate-900 shadow-[-2px_0_5px_rgba(0,0,0,0.3)]'
                          )}
                          style={{
                            ...(isPinnedLeft && { left: 0 }),
                            ...(isPinnedRight && { right: 0 })
                          }}
                          onContextMenu={(e) => handleContextMenu(e, 'cell', cell.column.id, cellValue)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )})}
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* Footer - Toplamlar (Server-side veya Client-side) */}
            {columnConfigs.some(c => c.aggregation) && (
              <tfoot className={clsx('sticky bottom-0', theme.cardBg, 'border-t-2', theme.border)}>
                <tr>
                  {table.getVisibleLeafColumns().map((column, index) => {
                    const config = columnConfigs.find(c => c.id === column.id)
                    
                    // Aggregation tanımlı değilse boş göster
                    if (!config?.aggregation) {
                      return (
                        <td
                          key={column.id}
                          className={clsx('px-3', densityStyles[density], theme.contentText)}
                        >
                          {index === 0 && (
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-blue-400">Σ Toplam</span>
                              {(() => {
                                const hasActiveFilters = globalFilter || columnFilters.length > 0
                                const filteredRowCount = table.getFilteredRowModel().rows.length
                                
                                if (hasActiveFilters) {
                                  return (
                                    <span className="text-xs text-amber-400 font-normal">
                                      ({new Intl.NumberFormat('tr-TR').format(filteredRowCount)} filtrelenmiş satır)
                                    </span>
                                  )
                                } else if (totalRows && totalRows > data.length) {
                                  return (
                                    <span className="text-xs text-emerald-400 font-normal">
                                      (Tüm veri: {new Intl.NumberFormat('tr-TR').format(totalRows)} satır)
                                    </span>
                                  )
                                }
                                return null
                              })()}
                            </div>
                          )}
                        </td>
                      )
                    }
                    
                    let aggregatedValue: number | string = 0
                    
                    // Arama veya filtre aktifse CLIENT-SIDE hesaplama yap
                    // Aksi halde server-side aggregates varsa onları kullan
                    const hasActiveFilters = globalFilter || columnFilters.length > 0
                    
                    // Server-side aggregates varsa ve filtre yoksa onları kullan (TÜM dataset için)
                    const serverAggKey = serverSideAggregates ? 
                      (serverSideAggregates[config.accessorKey] ? config.accessorKey : 
                       serverSideAggregates[config.id] ? config.id : null) : null
                    
                    if (!hasActiveFilters && serverSideAggregates && serverAggKey) {
                      const serverAgg = serverSideAggregates[serverAggKey]
                      // Değerin fonksiyon olmadığından emin ol
                      if (serverAgg && typeof serverAgg === 'object') {
                        switch (config.aggregation) {
                          case 'sum':
                            aggregatedValue = typeof serverAgg.sum === 'number' ? serverAgg.sum : 0
                            break
                          case 'avg':
                            aggregatedValue = typeof serverAgg.avg === 'number' ? serverAgg.avg : 0
                            break
                          case 'count':
                            aggregatedValue = typeof serverAgg.count === 'number' ? serverAgg.count : 0
                            break
                          case 'min':
                            aggregatedValue = typeof serverAgg.min === 'number' ? serverAgg.min : 0
                            break
                          case 'max':
                            aggregatedValue = typeof serverAgg.max === 'number' ? serverAgg.max : 0
                            break
                        }
                      }
                    } else {
                      // Client-side hesaplama (filtrelenmiş/aranan veri için)
                      const allRows = table.getFilteredRowModel().rows
                      const flatRows = allRows.flatMap(row => 
                        row.subRows.length > 0 ? row.getLeafRows() : [row]
                      )
                      
                      const values = flatRows.map(row => {
                        const val = row.getValue(column.id)
                        return typeof val === 'number' ? val : parseFloat(val as string) || 0
                      })
                      
                      switch (config.aggregation) {
                        case 'sum':
                          aggregatedValue = values.reduce((a, b) => a + b, 0)
                          break
                        case 'avg':
                          aggregatedValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0
                          break
                        case 'count':
                          aggregatedValue = flatRows.length
                          break
                        case 'min':
                          aggregatedValue = Math.min(...values)
                          break
                        case 'max':
                          aggregatedValue = Math.max(...values)
                          break
                      }
                    }
                    
                    // Format
                    let formattedValue: string
                    if (config.type === 'currency') {
                      formattedValue = new Intl.NumberFormat('tr-TR', { 
                        style: 'currency', 
                        currency: 'TRY' 
                      }).format(aggregatedValue as number)
                    } else if (config.type === 'number' || config.type === 'percentage') {
                      formattedValue = new Intl.NumberFormat('tr-TR', {
                        maximumFractionDigits: 2
                      }).format(aggregatedValue as number)
                    } else if (config.aggregation === 'count') {
                      formattedValue = `${new Intl.NumberFormat('tr-TR').format(aggregatedValue as number)} kayıt`
                    } else {
                      formattedValue = String(aggregatedValue)
                    }
                    
                    return (
                      <td
                        key={column.id}
                        className={clsx('px-3 font-bold', densityStyles[density], 'text-blue-400')}
                      >
                        {formattedValue}
                      </td>
                    )
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </DndContext>

      {/* Status Bar */}
      <div className={clsx('flex items-center justify-between px-4 py-2 border-t text-xs', theme.border, theme.contentTextMuted)}>
        <div className="flex items-center gap-4">
          {/* Satır Sayıları */}
          <span className="flex items-center gap-1">
            📊 <span className="font-medium">{new Intl.NumberFormat('tr-TR').format(data.length)}</span> yüklenmiş
          </span>
          {totalRows && totalRows > data.length && (
            <span className="flex items-center gap-1 text-emerald-400">
              📈 <span className="font-medium">{new Intl.NumberFormat('tr-TR').format(totalRows)}</span> toplam
            </span>
          )}
          {globalFilter && (
            <span className="flex items-center gap-1 text-yellow-400">
              🔍 <span className="font-medium">{new Intl.NumberFormat('tr-TR').format(table.getFilteredRowModel().rows.length)}</span> filtrelenmiş
            </span>
          )}
          {table.getSelectedRowModel().rows.length > 0 && (
            <span className="flex items-center gap-1 text-blue-400">
              ✓ <span className="font-medium">{table.getSelectedRowModel().rows.length}</span> seçili
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Gruplama & Sabitleme Durumu */}
          {grouping.length > 0 && (
            <span className="flex items-center gap-1 text-purple-400">
              ⊞ {grouping.length} gruplu
            </span>
          )}
          {(columnPinning.left?.length || 0) + (columnPinning.right?.length || 0) > 0 && (
            <span className="flex items-center gap-1 text-orange-400">
              📌 {(columnPinning.left?.length || 0) + (columnPinning.right?.length || 0)} sabit
            </span>
          )}
          {Object.values(columnVisibility).filter(v => !v).length > 0 && (
            <span className="flex items-center gap-1 text-gray-400">
              👁 {Object.values(columnVisibility).filter(v => !v).length} gizli
            </span>
          )}
        </div>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className={clsx('flex items-center justify-between px-4 py-3 border-t', theme.border)}>
          <div className={clsx('text-sm', theme.contentTextMuted)}>
            Sayfa: {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            <span className="ml-2">
              (Satır {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} - 
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)})
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <select
              value={table.getState().pagination.pageSize}
              onChange={e => table.setPageSize(Number(e.target.value))}
              className={clsx('px-2 py-1 rounded border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
            >
              {[10, 25, 50, 100, 500].map(size => (
                <option key={size} value={size}>
                  {size} / sayfa
                </option>
              ))}
            </select>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                className={clsx(
                  'px-2 py-1 rounded border text-sm',
                  theme.border,
                  !table.getCanPreviousPage() && 'opacity-50 cursor-not-allowed'
                )}
              >
                ⟪
              </button>
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className={clsx(
                  'px-2 py-1 rounded border text-sm',
                  theme.border,
                  !table.getCanPreviousPage() && 'opacity-50 cursor-not-allowed'
                )}
              >
                ⟨
              </button>
              <span className={clsx('px-3 text-sm', theme.contentText)}>
                {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className={clsx(
                  'px-2 py-1 rounded border text-sm',
                  theme.border,
                  !table.getCanNextPage() && 'opacity-50 cursor-not-allowed'
                )}
              >
                ⟩
              </button>
              <button
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                className={clsx(
                  'px-2 py-1 rounded border text-sm',
                  theme.border,
                  !table.getCanNextPage() && 'opacity-50 cursor-not-allowed'
                )}
              >
                ⟫
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <SaveDesignModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={saveDesign}
        existingDesigns={savedDesigns}
        theme={theme}
      />

      <LoadDesignModal
        isOpen={showLoadModal}
        onClose={() => setShowLoadModal(false)}
        onLoad={(design) => {
          // Eğer tasarımda dataset varsa, önce parent'a haber ver
          if (design.dataset_id && onDesignLoaded) {
            setDefaultDesignApplied(false) // Flag'i sıfırla - yeni tasarım bekletiliyor
            setPendingDefaultDesign(design) // Pending olarak beklet
            onDesignLoaded({
              designId: design.id,
              designName: design.name,
              datasetId: design.dataset_id,
              datasetName: design.dataset_name,
              state: typeof design.state === 'string' 
                ? JSON.parse(design.state) 
                : design.state
            })
          } else {
            // Dataset yoksa direkt uygula
            applyDesign(design)
          }
        }}
        onDelete={deleteDesign}
        onSetDefault={setDefaultDesign}
        designs={savedDesigns}
        loading={loadingDesigns}
        theme={theme}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={performExcelExport}
        totalRows={totalRows || data.length}
        theme={theme}
        gridId={gridId}
      />

      {/* Context Menu */}
      {contextMenu?.visible && (
        <div
          className={clsx(
            'fixed z-50 min-w-48 rounded-lg shadow-xl border py-1',
            theme.cardBg,
            theme.border
          )}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'header' ? (
            // Kolon Başlığı Menüsü
            <>
              <button
                onClick={() => {
                  const col = table.getColumn(contextMenu.columnId)
                  if (col) col.toggleSorting(false)
                  closeContextMenu()
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
              >
                ↑ A'dan Z'ye Sırala
              </button>
              <button
                onClick={() => {
                  const col = table.getColumn(contextMenu.columnId)
                  if (col) col.toggleSorting(true)
                  closeContextMenu()
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
              >
                ↓ Z'den A'ya Sırala
              </button>
              <div className={clsx('h-px my-1', theme.border)} />
              {!columnPinning.left?.includes(contextMenu.columnId) && !columnPinning.right?.includes(contextMenu.columnId) ? (
                <>
                  <button
                    onClick={() => {
                      setColumnPinning(prev => ({ ...prev, left: [...(prev.left || []), contextMenu.columnId] }))
                      closeContextMenu()
                    }}
                    className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
                  >
                    ◀ Sola Sabitle
                  </button>
                  <button
                    onClick={() => {
                      setColumnPinning(prev => ({ ...prev, right: [...(prev.right || []), contextMenu.columnId] }))
                      closeContextMenu()
                    }}
                    className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
                  >
                    ▶ Sağa Sabitle
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setColumnPinning(prev => ({
                      left: prev.left?.filter(id => id !== contextMenu.columnId) || [],
                      right: prev.right?.filter(id => id !== contextMenu.columnId) || []
                    }))
                    closeContextMenu()
                  }}
                  className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
                >
                  📌 Sabitlemeyi Kaldır
                </button>
              )}
              <div className={clsx('h-px my-1', theme.border)} />
              {!grouping.includes(contextMenu.columnId) ? (
                <button
                  onClick={() => {
                    setGrouping(prev => [...prev, contextMenu.columnId])
                    closeContextMenu()
                  }}
                  className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
                >
                  ⊞ Grupla
                </button>
              ) : (
                <button
                  onClick={() => {
                    setGrouping(prev => prev.filter(g => g !== contextMenu.columnId))
                    closeContextMenu()
                  }}
                  className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
                >
                  ⊟ Grubu Kaldır
                </button>
              )}
              <div className={clsx('h-px my-1', theme.border)} />
              <button
                onClick={() => {
                  setColumnVisibility(prev => ({ ...prev, [contextMenu.columnId]: false }))
                  closeContextMenu()
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-red-500/20 text-red-400 flex items-center gap-2')}
              >
                ✕ Kolonu Gizle
              </button>
            </>
          ) : (
            // Hücre Menüsü
            <>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(String(contextMenu.value ?? ''))
                  closeContextMenu()
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
              >
                📋 Kopyala
              </button>
              <button
                onClick={() => {
                  setColumnFilters(prev => [
                    ...prev.filter(f => f.id !== contextMenu.columnId),
                    { id: contextMenu.columnId, value: String(contextMenu.value ?? '') }
                  ])
                  closeContextMenu()
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
              >
                🔍 Bu Değere Göre Filtrele
              </button>
              <button
                onClick={() => {
                  setGlobalFilter(String(contextMenu.value ?? ''))
                  closeContextMenu()
                }}
                className={clsx('w-full px-4 py-2 text-left text-sm hover:bg-white/10 flex items-center gap-2', theme.contentText)}
              >
                🔎 Genel Aramaya Ekle
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default EnterpriseDataGrid

