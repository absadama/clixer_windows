import { create } from 'zustand'
import api from '../services/api'
import { useFilterStore } from './filterStore'

interface Widget {
  id: string
  type: string
  label: string
  metricId?: string
  metricName?: string
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  icon?: string
  color?: string
  chartConfig?: {
    borderStyle?: 'rounded' | 'sharp' | 'pill'
    [key: string]: any
  }
  data?: {
    value?: number | string | any[]
    formatted?: string
    data?: any[]
    metadata?: any
    executionTime?: number
    cached?: boolean
  }
}

interface Design {
  id: string
  name: string
  type: 'cockpit' | 'analysis'
  description?: string
  layoutConfig?: {
    widgets?: Widget[]
  }
  widgets?: Widget[]
  targetRoles?: string[]
  allowed_positions?: string[] // 🔴 GÜVENLİK: Pozisyon bazlı yetkilendirme
}

interface MetricData {
  value?: number | string
  data?: any[]
  trend?: string
  change?: number
  label?: string
}

interface DashboardState {
  designs: Design[]
  currentDesign: Design | null
  widgets: Widget[]
  metricsData: Record<string, MetricData>
  isLoading: boolean
  error: string | null
  lastUpdated: Date | null

  fetchDesigns: () => Promise<void>
  selectDesign: (designId: string) => Promise<void>
  fetchDashboardData: (designId: string) => Promise<void>
  refreshMetrics: () => Promise<void>
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  designs: [],
  currentDesign: null,
  widgets: [],
  metricsData: {},
  isLoading: false,
  error: null,
  lastUpdated: null,

  fetchDesigns: async () => {
    set({ isLoading: true })
    try {
      const response = await api.get('/analytics/designs')
      const designsRaw = response.data.data || []
      
      // Parse designs with widgets from layout_config
      const designsData = designsRaw.map((d: any) => ({
        id: d.id,
        name: d.name,
        type: d.type || 'cockpit',
        description: d.description,
        targetRoles: d.target_roles || d.targetRoles || ['ADMIN'],
        allowed_positions: d.allowed_positions || d.allowedPositions || [], // 🔴 GÜVENLİK: Pozisyon bazlı yetkilendirme
        layoutConfig: d.layout_config || d.layoutConfig,
        widgets: d.layout_config?.widgets || d.layoutConfig?.widgets || []
      }))
      
      set({ designs: designsData, isLoading: false })
      
      // 🔴 GÜVENLİK: Auto-select KALDIRILDI!
      // Store kullanıcının pozisyonunu bilmiyor, bu yüzden yetkisiz tasarımı seçebilir.
      // Auto-select işlemi DashboardPage.tsx'de accessibleDesigns ile yapılmalı.
    } catch (error: any) {
      // 401 hatalarını sessizce geç - token yenileme devreye girecek
      if (error.response?.status !== 401) {
        set({ error: error.message, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    }
  },

  selectDesign: async (designId: string) => {
    const design = get().designs.find(d => d.id === designId)
    if (design) {
      // Extract widgets from layoutConfig or widgets field
      const widgets = design.layoutConfig?.widgets || design.widgets || []
      set({ currentDesign: design, widgets })
      await get().fetchDashboardData(designId)
    }
  },

  fetchDashboardData: async (designId: string) => {
    set({ isLoading: true })
    try {
      // Tüm filtreleri al (tarih, bölge, mağaza, tip)
      const { startDate, endDate, datePreset, selectedRegionId, selectedStoreIds, selectedStoreType } = useFilterStore.getState()
      
      // Query parametreleri oluştur
      const params = new URLSearchParams()
      
      // "Tüm Zamanlar" seçiliyse allTime=true gönder
      if (datePreset === 'all') {
        params.append('allTime', 'true')
      } else {
        if (startDate) params.append('startDate', startDate)
        if (endDate) params.append('endDate', endDate)
      }
      
      if (selectedRegionId) params.append('regionId', selectedRegionId)
      if (selectedStoreIds.length > 0 && selectedStoreIds.length < 100) {
        params.append('storeIds', selectedStoreIds.join(','))
      }
      if (selectedStoreType !== 'ALL') params.append('storeType', selectedStoreType)
      
      const queryString = params.toString() ? `?${params.toString()}` : ''
      
      const response = await api.get(`/analytics/dashboard/${designId}/full${queryString}`)
      const data = response.data.data || {}
      
      // Update widgets if provided - transform backend format
      if (data.widgets && Array.isArray(data.widgets)) {
        const widgetsWithData = data.widgets.map((w: any) => ({
          id: w.id,
          type: w.type,
          label: w.label,
          metricId: w.metricId,
          metricName: w.metricName,
          x: w.gridPosition?.x ?? w.x ?? 0,
          y: w.gridPosition?.y ?? w.y ?? 0,
          w: w.gridPosition?.w ?? w.w ?? 4,
          h: w.gridPosition?.h ?? w.h ?? 4,
          icon: w.icon,
          color: w.color,
          chartConfig: w.chartConfig || {},
          // Include metric data directly in widget
          data: w.data,
          // Metrik görselleştirme tipi (pie_chart, bar_chart, line_chart vb.) - AnalysisPage ile aynı
          metric_visualization_type: w.metric_visualization_type || w.metricVisualizationType,
          metricVisualizationType: w.metric_visualization_type || w.metricVisualizationType,
          widget_type: w.widget_type || w.widgetType,
          widgetType: w.widget_type || w.widgetType,
          // Target bilgisi (progress, gauge için) - AnalysisPage ile aynı
          target: w.target,
          target_value: w.target_value || w.targetValue,
          // Comparison bilgisi
          comparison: w.comparison,
          previousValue: w.previousValue,
          trend: w.trend,
          comparisonLabel: w.comparisonLabel,
          // Sparkline data
          sparklineData: w.sparklineData
        }))
        set({ widgets: widgetsWithData })
        
        // Also extract metricsData by widget id
        const metricsData: Record<string, MetricData> = {}
        data.widgets.forEach((w: any) => {
          if (w.metricId && w.data) {
            metricsData[w.metricId] = w.data
          }
          if (w.id && w.data) {
            metricsData[w.id] = w.data
          }
        })
        set({ metricsData })
      }
      
      set({
        isLoading: false,
        lastUpdated: new Date(),
      })
    } catch (error: any) {
      // 401 hatalarını sessizce geç - token yenileme devreye girecek
      set({ isLoading: false, lastUpdated: new Date() })
    }
  },
  
  refreshMetrics: async () => {
    const { currentDesign } = get()
    if (currentDesign) {
      await get().fetchDashboardData(currentDesign.id)
    }
  }
}))
