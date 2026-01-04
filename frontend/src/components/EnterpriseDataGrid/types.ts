// Enterprise DataGrid Tipleri

export interface ColumnConfig {
  id: string
  accessorKey: string
  header: string
  type: 'text' | 'number' | 'date' | 'currency' | 'percentage' | 'boolean'
  width?: number
  minWidth?: number
  maxWidth?: number
  visible?: boolean
  sortable?: boolean
  filterable?: boolean
  groupable?: boolean
  aggregation?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none'
  format?: string
  align?: 'left' | 'center' | 'right'
  pinned?: 'left' | 'right' | false
}

export interface FilterConfig {
  columnId: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'isEmpty' | 'isNotEmpty'
  value: any
  value2?: any // for 'between' operator
}

export interface SortConfig {
  columnId: string
  direction: 'asc' | 'desc'
}

export interface GroupConfig {
  columnId: string
  expanded?: boolean
}

export interface PivotConfig {
  rowFields: string[]      // Satır alanları (sol taraf)
  columnFields: string[]   // Kolon alanları (üst taraf)
  valueFields: {           // Değer alanları (kesişim)
    field: string
    aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max'
    label?: string
  }[]
}

export interface GridState {
  columns: ColumnConfig[]
  filters: FilterConfig[]
  sorting: SortConfig[]
  grouping: GroupConfig[]
  columnOrder: string[]
  hiddenColumns: string[]
  columnWidths: Record<string, number>
  pinnedColumns: { left: string[], right: string[] }
  pageSize: number
  density: 'compact' | 'normal' | 'comfortable'
  pivotMode?: boolean
  pivotConfig?: PivotConfig
}

export interface SavedGridDesign {
  id: string
  name: string
  description?: string
  userId: string
  tenantId: string
  metricId?: string
  datasetId?: string
  gridState: GridState
  isDefault: boolean
  isShared: boolean
  createdAt: string
  updatedAt: string
}

// Server-side aggregate değerleri
export interface ServerSideAggregates {
  [columnId: string]: {
    sum?: number
    avg?: number
    count?: number
    min?: number
    max?: number
  }
}

// Tasarım yüklendiğinde dönen bilgi
export interface LoadedDesignInfo {
  designId: string
  designName: string
  datasetId?: string
  datasetName?: string
  state: GridState
}

export interface DataGridProps {
  // Identity - tasarımları ayırt etmek için
  gridId: string
  
  // Data
  data: any[]
  columns: ColumnConfig[]
  
  // Dataset bilgisi (tasarım kaydetme için)
  datasetId?: string
  
  // Server-side data info
  totalRows?: number // TÜM dataset satır sayısı (örn: 10M)
  serverSideAggregates?: ServerSideAggregates // TÜM dataset için aggregate değerler
  
  // Features
  enableFiltering?: boolean
  enableSorting?: boolean
  enableGrouping?: boolean
  enableColumnReorder?: boolean
  enableColumnResize?: boolean
  enableColumnHide?: boolean
  enableExport?: boolean
  enablePagination?: boolean
  enableVirtualization?: boolean
  enableRowSelection?: boolean
  enableDensityToggle?: boolean
  hideGroupedColumns?: boolean // Gruplanan kolonları otomatik gizle
  enablePivot?: boolean // Pivot tablo modu
  
  // State
  initialState?: Partial<GridState>
  savedDesign?: SavedGridDesign
  autoLoadDefaultDesign?: boolean // Varsayılan tasarımı otomatik yükle (default: true)
  
  // Callbacks
  onStateChange?: (state: GridState) => void
  onSaveDesign?: (design: Omit<SavedGridDesign, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  onLoadDesign?: (designId: string) => Promise<SavedGridDesign>
  onDesignLoaded?: (info: LoadedDesignInfo) => void // Tasarım yüklendiğinde parent'a haber ver
  onRowClick?: (row: any) => void
  onRowDoubleClick?: (row: any) => void
  onSelectionChange?: (selectedRows: any[]) => void
  
  // Styling
  className?: string
  height?: string | number
  loading?: boolean
  emptyMessage?: string
}

export interface ToolbarProps {
  // Search
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  
  // Column visibility
  columns: ColumnConfig[]
  hiddenColumns: string[]
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void
  
  // Grouping
  grouping: GroupConfig[]
  onGroupingChange: (grouping: GroupConfig[]) => void
  
  // Density
  density: 'compact' | 'normal' | 'comfortable'
  onDensityChange: (density: 'compact' | 'normal' | 'comfortable') => void
  
  // Export
  onExportExcel: () => void
  onExportCSV: () => void
  
  // Design
  onSaveDesign: () => void
  onLoadDesign: () => void
  
  // Filters
  activeFiltersCount: number
  onClearFilters: () => void
}

