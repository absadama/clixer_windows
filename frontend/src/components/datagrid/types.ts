// Enterprise DataGrid Types

export interface ColumnConfig {
  id: string
  accessorKey: string
  header: string
  width?: number
  minWidth?: number
  maxWidth?: number
  visible?: boolean
  sortable?: boolean
  filterable?: boolean
  resizable?: boolean
  pinned?: 'left' | 'right' | false
  aggregationType?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'none'
  format?: 'text' | 'number' | 'currency' | 'percent' | 'date' | 'datetime'
  align?: 'left' | 'center' | 'right'
}

export interface GroupConfig {
  columnId: string
  direction: 'asc' | 'desc'
}

export interface FilterConfig {
  columnId: string
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'lt' | 'gte' | 'lte' | 'between'
  value: string | number | [number, number]
}

export interface SortConfig {
  columnId: string
  direction: 'asc' | 'desc'
}

export interface GridState {
  columns: ColumnConfig[]
  groups: GroupConfig[]
  filters: FilterConfig[]
  sorts: SortConfig[]
  pageSize: number
  pinnedColumns: { left: string[], right: string[] }
}

export interface SavedGridDesign {
  id: string
  name: string
  userId: string
  gridId: string
  state: GridState
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface DataGridProps {
  // Data
  data: Record<string, unknown>[]
  columns: ColumnConfig[]
  
  // Features
  enableVirtualization?: boolean
  enableColumnResize?: boolean
  enableColumnReorder?: boolean
  enableGrouping?: boolean
  enableFiltering?: boolean
  enableSorting?: boolean
  enableRowSelection?: boolean
  enableExport?: boolean
  enablePinning?: boolean
  enableGrandTotal?: boolean
  enableSubtotals?: boolean
  
  // State
  initialState?: Partial<GridState>
  
  // Callbacks
  onStateChange?: (state: GridState) => void
  onRowClick?: (row: Record<string, unknown>) => void
  onRowDoubleClick?: (row: Record<string, unknown>) => void
  onSelectionChange?: (selectedRows: Record<string, unknown>[]) => void
  
  // Design
  gridId?: string
  onSaveDesign?: (design: Omit<SavedGridDesign, 'id' | 'createdAt' | 'updatedAt'>) => void
  savedDesigns?: SavedGridDesign[]
  onLoadDesign?: (designId: string) => void
  
  // Styling
  height?: number | string
  className?: string
  headerClassName?: string
  rowClassName?: string | ((row: Record<string, unknown>, index: number) => string)
  
  // Loading
  isLoading?: boolean
  loadingText?: string
  emptyText?: string
}

export interface ColumnMenuProps {
  column: ColumnConfig
  onSort: (direction: 'asc' | 'desc' | null) => void
  onFilter: (filter: FilterConfig | null) => void
  onHide: () => void
  onPin: (side: 'left' | 'right' | false) => void
  onGroup: () => void
  currentSort?: 'asc' | 'desc' | null
  currentFilter?: FilterConfig | null
  isGrouped?: boolean
}

export interface ToolbarProps {
  onExport: (format: 'excel' | 'csv') => void
  onSaveDesign: () => void
  onLoadDesign: (designId: string) => void
  onResetDesign: () => void
  savedDesigns: SavedGridDesign[]
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
  selectedCount: number
  totalCount: number
}

