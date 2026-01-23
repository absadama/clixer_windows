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
        layoutConfig: d.layout_config || d.layoutConfig,
        widgets: d.layout_config?.widgets || d.layoutConfig?.widgets || []
      }))
      
      set({ designs: designsData, isLoading: false })
      
      // Auto-select first cockpit design with widgets if none selected
      const cockpitDesigns = designsData.filter((d: Design) => d.type === 'cockpit')
      const withWidgets = cockpitDesigns.find((d: Design) => d.widgets && d.widgets.length > 0)
      const firstCockpit = withWidgets || cockpitDesigns[0]
      
      if (firstCockpit && !get().currentDesign) {
        get().selectDesign(firstCockpit.id)
      }
    } catch (error: any) {
      console.warn('Tasarım yükleme hatası:', error.message)
      set({ error: error.message, isLoading: false })
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
      // Tüm filtreleri al (tarih, bölge, grup, mağaza)
      const { 
        startDate, 
        endDate, 
        datePreset, 
        selectedRegionIds,  // Çoklu bölge seçimi
        selectedGroupIds,   // Çoklu grup seçimi
        selectedStoreIds, 
        stores,
        groups
      } = useFilterStore.getState()
      
      // Request body oluştur (POST kullanacağız - URL uzunluğu limiti nedeniyle)
      // storeIds dizisi 400+ eleman içerebilir, URL'de göndermek 8KB limitini aşar
      const requestBody: Record<string, any> = {}
      
      // "Tüm Zamanlar" seçiliyse allTime=true gönder
      if (datePreset === 'all') {
        requestBody.allTime = 'true'
      } else {
        if (startDate) requestBody.startDate = startDate
        if (endDate) requestBody.endDate = endDate
      }
      
      // Bölge filtresi (çoklu seçim): Tüm bölgeler seçiliyse veya hiçbiri seçili değilse filtre GÖNDERİLMEZ
      if (selectedRegionIds.length > 0) {
        // regions.code değerlerini gönder (MainRegionID ile eşleşiyor)
        requestBody.regionIds = selectedRegionIds.join(',')
      }
      
      // Grup filtresi (çoklu seçim): Tüm gruplar seçiliyse veya hiçbiri seçili değilse filtre GÖNDERİLMEZ
      if (selectedGroupIds.length > 0) {
        // groups.code değerlerini gönder (BranchType ile eşleşiyor)
        requestBody.groupIds = selectedGroupIds.join(',')
      }
      
      // Mağaza filtresi: Tüm mağazalar seçiliyse (stores.length === selectedStoreIds.length) filtre GÖNDERİLMEZ
      // Bu "tüm mağazalar" demektir ve backend'de RLS dışında ek filtre uygulanmaz
      const allStoresSelected = stores.length > 0 && selectedStoreIds.length === stores.length
      
      if (selectedStoreIds.length > 0 && !allStoresSelected) {
        requestBody.storeIds = selectedStoreIds.join(',')
      }
      
      // POST kullan (URL limit aşımını önlemek için)
      const response = await api.post(`/analytics/dashboard/${designId}/full`, requestBody)
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
        
        // TÜM state güncellemelerini TEK set() ile yap - React re-render için kritik!
        set({ 
          widgets: widgetsWithData,
          metricsData,
          isLoading: false,
          lastUpdated: new Date()
        })
      } else {
        set({
          isLoading: false,
          lastUpdated: new Date(),
        })
      }
    } catch (error: any) {
      console.warn('Dashboard veri yükleme hatası:', error.message)
      // Don't fail completely, just log and continue
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
