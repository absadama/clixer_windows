/**
 * Clixer - Designer Page Store
 * DesignerPage.tsx için merkezi state yönetimi
 * 17 useState → Zustand store (Enterprise standart: max 10 useState)
 */

import { create } from 'zustand'
import { Layouts } from 'react-grid-layout'

// ============================================
// TYPES
// ============================================

export interface DesignWidget {
  i: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  type: string
  label: string
  metricId?: string
  metricName?: string
  color?: string
  icon?: string
  chartConfig?: {
    colorMode?: 'none' | 'accent' | 'full'
    [key: string]: any
  }
}

export interface Design {
  id: string
  name: string
  type: 'cockpit' | 'analysis'
  targetRoles: string[]
  allowedPositions: string[]
  widgets: DesignWidget[]
  categoryId?: string | null
  updatedAt?: string
}

export interface Metric {
  id: string
  name: string
  label: string
  visualizationType: string
  aggregationType: string
  datasetName?: string
}

export interface ReportCategory {
  id: string
  name: string
  description?: string
  color?: string
  icon?: string
}

// ============================================
// STORE STATE
// ============================================

interface DesignerState {
  // Design State
  currentDesign: Design | null
  designs: Design[]
  widgets: DesignWidget[]
  selectedWidget: string | null
  designName: string
  designType: 'cockpit' | 'analysis'
  designRoles: string[]
  allowedPositions: string[]
  selectedCategoryId: string | null
  layouts: Layouts
  
  // Data State
  metrics: Metric[]
  reportCategories: ReportCategory[]
  
  // Loading State
  saving: boolean
  designsLoading: boolean
  metricsLoading: boolean
  designLoading: boolean
}

// ============================================
// STORE ACTIONS
// ============================================

interface DesignerActions {
  // Design Actions
  setCurrentDesign: (design: Design | null) => void
  setDesigns: (designs: Design[] | ((prev: Design[]) => Design[])) => void
  setWidgets: (widgets: DesignWidget[] | ((prev: DesignWidget[]) => DesignWidget[])) => void
  addWidget: (widget: DesignWidget) => void
  updateWidget: (id: string, updates: Partial<DesignWidget>) => void
  removeWidget: (id: string) => void
  setSelectedWidget: (id: string | null) => void
  setDesignName: (name: string) => void
  setDesignType: (type: 'cockpit' | 'analysis') => void
  setDesignRoles: (roles: string[]) => void
  setAllowedPositions: (positions: string[]) => void
  setSelectedCategoryId: (id: string | null) => void
  setLayouts: (layouts: Layouts | ((prev: Layouts) => Layouts)) => void
  
  // Data Actions
  setMetrics: (metrics: Metric[]) => void
  setReportCategories: (categories: ReportCategory[]) => void
  
  // Loading Actions
  setSaving: (saving: boolean) => void
  setDesignsLoading: (loading: boolean) => void
  setMetricsLoading: (loading: boolean) => void
  setDesignLoading: (loading: boolean) => void
  
  // Utility Actions
  resetDesign: () => void
  loadDesign: (design: Design) => void
}

// ============================================
// DEFAULT VALUES
// ============================================

const defaultDesignState = {
  currentDesign: null,
  designs: [],
  widgets: [],
  selectedWidget: null,
  designName: 'Yeni Tasarım',
  designType: 'cockpit' as const,
  designRoles: ['ADMIN'],
  allowedPositions: [], // GÜVENLİ VARSAYILAN: kimse (kullanıcı açıkça seçmeli)
  selectedCategoryId: null,
  layouts: {},
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useDesignerStore = create<DesignerState & DesignerActions>((set, get) => ({
  // Initial State
  ...defaultDesignState,
  metrics: [],
  reportCategories: [],
  saving: false,
  designsLoading: false,
  metricsLoading: false,
  designLoading: false,
  
  // Design Actions
  setCurrentDesign: (currentDesign) => set({ currentDesign }),
  
  setDesigns: (designsOrUpdater) => set((state) => ({
    designs: typeof designsOrUpdater === 'function' 
      ? designsOrUpdater(state.designs) 
      : designsOrUpdater
  })),
  
  setWidgets: (widgetsOrUpdater) => set((state) => ({
    widgets: typeof widgetsOrUpdater === 'function' 
      ? widgetsOrUpdater(state.widgets) 
      : widgetsOrUpdater
  })),
  
  addWidget: (widget) => set((state) => ({ 
    widgets: [...state.widgets, widget] 
  })),
  
  updateWidget: (id, updates) => set((state) => ({
    widgets: state.widgets.map(w => w.i === id ? { ...w, ...updates } : w)
  })),
  
  removeWidget: (id) => set((state) => ({
    widgets: state.widgets.filter(w => w.i !== id),
    selectedWidget: state.selectedWidget === id ? null : state.selectedWidget
  })),
  
  setSelectedWidget: (selectedWidget) => set({ selectedWidget }),
  
  setDesignName: (designName) => set({ designName }),
  
  setDesignType: (designType) => set({ designType }),
  
  setDesignRoles: (designRoles) => set({ designRoles }),
  
  setAllowedPositions: (allowedPositions) => set({ allowedPositions }),
  
  setSelectedCategoryId: (selectedCategoryId) => set({ selectedCategoryId }),
  
  setLayouts: (layoutsOrUpdater) => set((state) => ({
    layouts: typeof layoutsOrUpdater === 'function' 
      ? layoutsOrUpdater(state.layouts) 
      : layoutsOrUpdater
  })),
  
  // Data Actions
  setMetrics: (metrics) => set({ metrics }),
  
  setReportCategories: (reportCategories) => set({ reportCategories }),
  
  // Loading Actions
  setSaving: (saving) => set({ saving }),
  
  setDesignsLoading: (designsLoading) => set({ designsLoading }),
  
  setMetricsLoading: (metricsLoading) => set({ metricsLoading }),
  
  setDesignLoading: (designLoading) => set({ designLoading }),
  
  // Utility Actions
  resetDesign: () => set({
    ...defaultDesignState,
  }),
  
  loadDesign: (design) => set({
    currentDesign: design,
    designName: design.name,
    designType: design.type,
    designRoles: design.targetRoles || ['ADMIN'],
    allowedPositions: design.allowedPositions || [],
    selectedCategoryId: design.categoryId || null,
    widgets: design.widgets || [],
    layouts: {},
  }),
}))
