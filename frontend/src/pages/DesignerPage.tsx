import { useState, useCallback, useMemo, useEffect, useRef, lazy, Suspense } from 'react'
import { debounce } from 'lodash'
import toast from 'react-hot-toast'
import { useTheme } from '../components/Layout'

const API_BASE = import.meta.env.VITE_API_URL || '/api'
import { useAuthStore } from '../stores/authStore'
import { useDesignerStore } from '../stores/designerStore'
import RGL, { WidthProvider, Layout as GridLayout, Layouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import clsx from 'clsx'
import {
  Palette,
  Plus,
  Save,
  FolderOpen,
  Trash2,
  Copy,
  Settings,
  BarChart3,
  Table,
  TrendingUp,
  TrendingDown,
  PieChart,
  Activity,
  Target,
  Gauge,
  Grid3X3,
  Monitor,
  Tablet,
  Smartphone,
  Eye,
  EyeOff,
  ChevronDown,
  X,
  GripVertical,
  Maximize2,
  LayoutGrid,
  Layers,
  Database,
  Loader,
  Filter,
  Hash,
  DollarSign,
  ShoppingCart,
  Users,
  Store,
  Package,
  Percent,
  AlertCircle,
  Calendar,
  RefreshCw,
  Building2,
  Briefcase,
  MapPin,
  Tag,
  Box,
  List,
  LineChart,
  ArrowUp,
  ArrowDown,
  Minus,
  Zap,
  GitCompare,
  Trophy,
  Table2,
} from 'lucide-react'

// Renk paleti - Widget renk seçenekleri
const colorPalette = [
  '#6366F1', // Indigo (default)
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
]

// İkon haritası - Widget ikonları
const designerIconMap: Record<string, React.ComponentType<any>> = {
  Filter, BarChart3, LineChart, PieChart, TrendingUp, TrendingDown, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Database, Zap,
  ArrowUp, ArrowDown, Minus, Loader, DollarSign, ShoppingCart, Users,
  Store, Package, Percent, AlertCircle, Calendar, RefreshCw, Building2,
  Briefcase, MapPin, Tag, Layers, Settings, Box, Grid3X3, List
}

// İkon listesi (select için)
const iconOptions = [
  { value: 'Filter', label: 'Filtre' },
  { value: 'Users', label: 'Kullanıcılar' },
  { value: 'Building2', label: 'Bina' },
  { value: 'Briefcase', label: 'İş' },
  { value: 'MapPin', label: 'Konum' },
  { value: 'Tag', label: 'Etiket' },
  { value: 'Layers', label: 'Katmanlar' },
  { value: 'Database', label: 'Veritabanı' },
  { value: 'Calendar', label: 'Takvim' },
  { value: 'Store', label: 'Mağaza' },
  { value: 'Package', label: 'Paket' },
  { value: 'DollarSign', label: 'Para' },
  { value: 'ShoppingCart', label: 'Sepet' },
  { value: 'Target', label: 'Hedef' },
  { value: 'TrendingUp', label: 'Trend Yukarı' },
  { value: 'TrendingDown', label: 'Trend Aşağı' },
  { value: 'BarChart3', label: 'Bar Grafik' },
  { value: 'PieChart', label: 'Pasta Grafik' },
  { value: 'Activity', label: 'Aktivite' },
  { value: 'Percent', label: 'Yüzde' },
]

// Lazy load MetricsPage
const MetricsPage = lazy(() => import('./MetricsPage'));

// MetricsContent wrapper for embedded use
const MetricsContent = () => {
  const { theme } = useTheme();
  return (
    <Suspense fallback={
      <div className={clsx('flex items-center justify-center h-64 rounded-2xl', theme.cardBg)}>
        <Loader className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    }>
      <MetricsPage embedded={true} />
    </Suspense>
  );
};

// React Grid Layout setup
const ResponsiveGridLayout = WidthProvider(RGL.Responsive)

// 24-kolon grid sabitleri (Grafana-style) - TÜM breakpoint'lerde 24 kolon
const GRID_COLS = { lg: 24, md: 24, sm: 24, xs: 24, xxs: 24 }
const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }
const GRID_ROW_HEIGHT = 40
const GRID_MARGIN: [number, number] = [12, 12]

// Widget tipleri - 17 farklı görselleştirme
// minW/minH: İçerik bozulmadan minimum boyut (24 kolonlu grid için)
const WIDGET_TYPES = [
  { id: 'card', name: 'Büyük Kart', icon: LayoutGrid, defaultW: 6, defaultH: 4, minW: 4, minH: 3, description: 'Ana KPI gösterimi' },
  { id: 'mini_card', name: 'Mini Kart', icon: Grid3X3, defaultW: 4, defaultH: 3, minW: 3, minH: 2, description: 'Kompakt KPI' },
  { id: 'chart', name: 'Grafik', icon: BarChart3, defaultW: 8, defaultH: 6, minW: 6, minH: 4, description: 'Line, Bar, Area, Pie' },
  { id: 'grid', name: 'Tablo', icon: Table, defaultW: 12, defaultH: 8, minW: 8, minH: 5, description: 'Veri tablosu' },
  { id: 'gauge', name: 'Gösterge', icon: Gauge, defaultW: 6, defaultH: 4, minW: 4, minH: 3, description: 'Hedef takibi' },
  { id: 'sparkline', name: 'Sparkline', icon: TrendingUp, defaultW: 4, defaultH: 3, minW: 3, minH: 2, description: 'Mini trend çizgisi' },
  { id: 'progress_ring', name: 'İlerleme Halkası', icon: Activity, defaultW: 4, defaultH: 4, minW: 3, minH: 3, description: 'Yüzde gösterimi' },
  { id: 'comparison', name: 'Karşılaştırma', icon: Target, defaultW: 6, defaultH: 4, minW: 5, minH: 3, description: 'Dönem karşılaştırma' },
  { id: 'bullet', name: 'Bullet Chart', icon: Target, defaultW: 8, defaultH: 3, minW: 6, minH: 2, description: 'Hedef vs gerçekleşen' },
  { id: 'heatmap', name: 'Isı Haritası', icon: Layers, defaultW: 8, defaultH: 6, minW: 6, minH: 4, description: 'Yoğunluk haritası' },
  { id: 'treemap', name: 'Treemap', icon: PieChart, defaultW: 8, defaultH: 6, minW: 6, minH: 4, description: 'Hiyerarşik veri' },
  { id: 'waterfall', name: 'Şelale', icon: BarChart3, defaultW: 8, defaultH: 6, minW: 6, minH: 4, description: 'Akış analizi' },
  { id: 'stat_card', name: 'İstatistik Kartı', icon: Grid3X3, defaultW: 6, defaultH: 4, minW: 4, minH: 3, description: 'Çoklu istatistik' },
  { id: 'kpi_scorecard', name: 'KPI Scorecard', icon: Target, defaultW: 12, defaultH: 4, minW: 8, minH: 3, description: 'KPI özet tablosu' },
  { id: 'pulse_widget', name: 'Pulse Widget', icon: Activity, defaultW: 16, defaultH: 6, minW: 10, minH: 4, description: 'Canlı aktivite' },
  { id: 'gamification_widget', name: 'Gamification', icon: Target, defaultW: 8, defaultH: 6, minW: 6, minH: 4, description: 'Başarı & rozetler' },
  { id: 'product_flow_widget', name: 'Ürün Akışı', icon: Database, defaultW: 8, defaultH: 6, minW: 6, minH: 4, description: 'Ürün hareketleri' },
  { id: 'parameter_filter', name: 'Parametre Filtresi', icon: Filter, defaultW: 4, defaultH: 2, minW: 3, minH: 2, description: 'Dinamik kategori filtresi' },
]

// Demo tasarımlar KALDIRILDI - Artık sadece API'den gelen gerçek tasarımlar kullanılıyor
// Not: Eski demo tasarımlar ("demo-1", "demo-2", "demo-3") geçersiz UUID formatındaydı ve silme hatalarına neden oluyordu

interface DesignWidget extends GridLayout {
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

// Tüm pozisyonlar
const ALL_POSITIONS = [
  { code: 'GENERAL_MANAGER', name: 'Genel Müdür' },
  { code: 'DIRECTOR', name: 'Direktör' },
  { code: 'REGION_MANAGER', name: 'Bölge Müdürü' },
  { code: 'STORE_MANAGER', name: 'Mağaza Müdürü' },
  { code: 'ANALYST', name: 'Analist' },
  { code: 'VIEWER', name: 'İzleyici' },
]

interface Design {
  id: string
  name: string
  type: 'cockpit' | 'analysis'
  targetRoles: string[]
  allowedPositions: string[] // Yeni: pozisyon bazlı yetkilendirme
  widgets: DesignWidget[]
  categoryId?: string | null
  updatedAt?: string // Optimistic locking için
}

interface Metric {
  id: string
  name: string
  label: string
  visualizationType: string
  aggregationType: string
  datasetName?: string
}

export default function DesignerPage() {
  const { theme, isDark } = useTheme()
  const { accessToken } = useAuthStore()
  
  // Zustand Store - Enterprise standart (17 state store'da)
  const {
    currentDesign, setCurrentDesign,
    designs, setDesigns,
    widgets, setWidgets,
    selectedWidget, setSelectedWidget,
    metrics, setMetrics,
    saving, setSaving,
    designName, setDesignName,
    designType, setDesignType,
    designRoles, setDesignRoles,
    allowedPositions, setAllowedPositions,
    selectedCategoryId, setSelectedCategoryId,
    reportCategories, setReportCategories,
    designsLoading, setDesignsLoading,
    metricsLoading, setMetricsLoading,
    designLoading, setDesignLoading,
    layouts, setLayouts,
    resetDesign, loadDesign,
  } = useDesignerStore()
  
  // Lokal UI State (6 useState - limit 10'un altında)
  const [activeTab, setActiveTab] = useState<'studio' | 'metrics'>('studio')
  const [showGridLines, setShowGridLines] = useState(true)
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [currentBreakpoint, setCurrentBreakpoint] = useState<string>('lg')
  const [showWidgetPanel, setShowWidgetPanel] = useState(true)
  const [showDesignDropdown, setShowDesignDropdown] = useState(false)
  
  // Ref to track latest widget positions (for save)
  const widgetsRef = useRef<DesignWidget[]>([])
  
  // Keep ref in sync with widgets state
  useEffect(() => {
    widgetsRef.current = widgets
  }, [widgets])
  
  // Initialize - load metrics, designs and categories from API
  useEffect(() => {
    // Load metrics
    loadMetrics()
    // Load saved designs from API
    loadDesigns()
    // Load report categories
    loadReportCategories()
  }, [])
  
  // Load metrics from API
  const loadMetrics = async () => {
    if (!accessToken) return
    setMetricsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/analytics/metrics`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setMetrics(data.data || [])
      }
    } catch (err) {
      console.warn('Metrik yükleme hatası:', err)
    } finally {
      setMetricsLoading(false)
    }
  }
  
  // Load report categories from API
  const loadReportCategories = async () => {
    if (!accessToken) return
    try {
      const res = await fetch(`${API_BASE}/core/report-categories`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        setReportCategories(data.data || [])
      }
    } catch (err) {
      console.warn('Kategori yükleme hatası:', err)
    }
  }
  
  // Load designs from API
  const loadDesigns = async () => {
    if (!accessToken) return
    setDesignsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/analytics/designs`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        if (data.data?.length > 0) {
          // Parse API designs and merge with demo designs
          const apiDesigns = data.data.map((d: any) => {
            // Parse widgets from layout_config if available
            let rawWidgets: any[] = []
            if (d.layout_config?.widgets) {
              rawWidgets = d.layout_config.widgets
            } else if (d.layoutConfig?.widgets) {
              rawWidgets = d.layoutConfig.widgets
            }
            
            // Transform widgets to expected format
            const widgets: DesignWidget[] = rawWidgets.map((w: any) => ({
              i: w.id || w.i || `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              x: w.x ?? 0,
              y: w.y ?? 0,
              w: w.w ?? 6,
              h: w.h ?? 4,
              minW: w.minW ?? 2,
              minH: w.minH ?? 2,
              type: w.type || 'card',
              label: w.label || 'Widget',
              metricId: w.metricId,
              metricName: w.metricName,
              color: w.color,
              icon: w.icon,
              chartConfig: w.chartConfig
            }))
            
            return {
              id: d.id,
              name: d.name,
              type: d.type || 'cockpit',
              targetRoles: d.target_roles || d.targetRoles || ['ADMIN'],
              // GÜVENLİK: Boş array = kimse göremez (ADMIN hariç), ALL_POSITIONS fallback KALDIRILDI
              allowedPositions: d.allowed_positions || d.allowedPositions || [],
              categoryId: d.category_id || d.categoryId || null,
              updatedAt: d.updated_at || d.updatedAt || null, // Optimistic locking
              widgets
            }
          })
          
          // Filter out demo designs that might already exist
          setDesigns(prev => {
            const demoDesigns = prev.filter(p => p.id.startsWith('demo-'))
            return [...demoDesigns, ...apiDesigns]
          })
        }
      }
    } catch (err) {
      console.warn('Tasarım yükleme hatası:', err)
    } finally {
      setDesignsLoading(false)
    }
  }
  
  // Save design to API
  const saveDesign = async () => {
    if (!accessToken || !currentDesign) {
      toast.error('Önce bir tasarım seçin veya oluşturun')
      return
    }
    
    // GÜVENLİK: Kategori zorunlu kontrolü
    if (!selectedCategoryId) {
      toast('Rapor Kategorisi seçilmeden kaydedemezsiniz! Sağ panelden bir kategori seçin.', { icon: '⚠️', duration: 5000 })
      return
    }
    
    // GÜVENLİK: En az bir pozisyon seçilmeli uyarısı (isteğe bağlı)
    if (allowedPositions.length === 0) {
      const confirm = window.confirm('⚠️ Hiçbir pozisyon seçilmedi!\n\nBu raporu sadece siz ve ADMIN kullanıcılar görebilecek.\n\nDevam etmek istiyor musunuz?')
      if (!confirm) return
    }
    
    setSaving(true)
    try {
      // widgetsRef en güncel pozisyonları içerir (handleLayoutChange'de güncelleniyor)
      // Eğer ref boşsa widgets state'ini kullan
      const currentWidgets = widgetsRef.current.length > 0 ? widgetsRef.current : widgets
      
      const payload = {
        name: designName || currentDesign.name,
        type: designType,
        targetRoles: designRoles,
        allowedPositions: allowedPositions, // Pozisyon bazlı yetkilendirme
        categoryId: selectedCategoryId, // Kategori bazlı yetkilendirme (Güçler Ayrılığı)
        lastUpdatedAt: currentDesign.updatedAt, // OPTIMISTIC LOCKING: Concurrent edit kontrolü
        layoutConfig: {
          widgets: currentWidgets.map(w => ({
            id: w.i,
            x: w.x,
            y: w.y,
            w: w.w,
            h: w.h,
            minW: w.minW,
            minH: w.minH,
            type: w.type,
            label: w.label,
            metricId: w.metricId,
            metricName: w.metricName,
            color: w.color,
            icon: w.icon,
            chartConfig: w.chartConfig
          }))
        },
        settings: {
          gridColumns: GRID_COLS.lg,
          responsive: true
        }
      }
      
      const isNew = currentDesign.id.startsWith('design-')
      const url = isNew 
        ? `${API_BASE}/analytics/designs`
        : `${API_BASE}/analytics/designs/${currentDesign.id}`
      
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(payload)
      })
      
      if (res.ok) {
        const data = await res.json()
        toast.success('Tasarım kaydedildi!')
        
        // Update current design with new ID if it was new
        if (isNew && data.data?.id) {
          setCurrentDesign({ ...currentDesign, id: data.data.id, name: designName })
        }
        
        // Reload designs
        loadDesigns()
      } else {
        const error = await res.json()
        
        // OPTIMISTIC LOCKING: Concurrent edit hatası
        if (res.status === 409 || error.errorCode === 'CONCURRENT_EDIT') {
          const reload = window.confirm(
            '⚠️ UYARI: Bu tasarım başka bir kullanıcı tarafından değiştirilmiş!\n\n' +
            'Değişiklikleriniz kaybolabilir. Güncel versiyonu yüklemek için sayfayı yenilemek ister misiniz?'
          )
          if (reload) {
            loadDesigns()
          }
        } else {
          toast.error(error.message || 'Tasarım kaydedilemedi')
        }
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }
  
  // Delete design
  const deleteDesign = async (designId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    
    if (!confirm('Bu tasarımı silmek istediğinizden emin misiniz?')) {
      return
    }
    
    try {
      const res = await fetch(`${API_BASE}/analytics/designs/${designId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      
      if (res.ok) {
        toast.success('Tasarım silindi!')
        // Clear current design if it was deleted
        if (currentDesign?.id === designId) {
          setCurrentDesign(null)
          setWidgets([])
        }
        // Remove from local state
        setDesigns(prev => prev.filter(d => d.id !== designId))
      } else {
        const error = await res.json()
        toast.error(error.message || 'Tasarım silinemedi')
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }
  
  // Reload metrics when tab changes
  useEffect(() => {
    if (activeTab === 'studio') {
      loadMetrics()
    }
  }, [activeTab])
  
  // Load design into editor (local function, different from store's loadDesign)
  const selectDesign = (design: Design) => {
    setCurrentDesign(design)
    
    // Load widgets from design - handle different formats
    let rawWidgets = design.widgets || []
    
    // Transform widgets to expected format (ensure 'i' is set)
    const designWidgets: DesignWidget[] = rawWidgets.map((w: any) => ({
      i: w.i || w.id || `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      x: w.x ?? 0,
      y: w.y ?? 0,
      w: w.w ?? 6,
      h: w.h ?? 4,
      minW: w.minW ?? 2,
      minH: w.minH ?? 2,
      type: w.type || 'card',
      label: w.label || 'Widget',
      metricId: w.metricId,
      metricName: w.metricName,
      color: w.color,
      icon: w.icon,
      chartConfig: w.chartConfig
    }))
    
    setWidgets(designWidgets)
    
    // Update design settings
    setDesignName(design.name)
    setDesignType(design.type)
    setDesignRoles(design.targetRoles || ['ADMIN'])
    setAllowedPositions(design.allowedPositions || []) // Boşsa boş kalmalı, ALL_POSITIONS değil
    setSelectedCategoryId((design as any).categoryId || null)
    
    // Generate layouts for all breakpoints
    const baseLayout = designWidgets.map(w => ({
      i: w.i,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      minW: w.minW,
      minH: w.minH,
    }))
    
    setLayouts({
      lg: baseLayout,
      md: baseLayout,
      sm: baseLayout,
      xs: baseLayout,
      xxs: baseLayout,
    })
    
    setShowDesignDropdown(false)
  }
  
  // Create new design
  const createNewDesign = () => {
    const newDesign: Design = {
      id: `design-${Date.now()}`,
      name: 'Yeni Tasarım',
      type: 'cockpit',
      targetRoles: ['ADMIN'],
      allowedPositions: [], // GÜVENLİ VARSAYILAN: boş (kullanıcı açıkça seçmeli)
      widgets: []
    }
    setDesigns(prev => [...prev, newDesign])
    selectDesign(newDesign)
  }
  
  // Add widget
  const addWidget = (widgetType: typeof WIDGET_TYPES[0]) => {
    if (!currentDesign) {
      toast.error('Önce bir tasarım seçin veya yeni tasarım oluşturun')
      return
    }
    
    // Find next available position
    let maxY = 0
    widgets.forEach(w => {
      if (w.y + w.h > maxY) maxY = w.y + w.h
    })
    
    const newWidget: DesignWidget = {
      i: `widget-${Date.now()}`,
      x: 0,
      y: maxY,
      w: widgetType.defaultW,
      h: widgetType.defaultH,
      minW: widgetType.minW || Math.max(3, Math.floor(widgetType.defaultW / 2)),
      minH: widgetType.minH || Math.max(2, Math.floor(widgetType.defaultH / 2)),
      type: widgetType.id,
      label: widgetType.name,
    }
    
    setWidgets(prev => [...prev, newWidget])
    setSelectedWidget(newWidget.i)
    
    // Update layouts
    setLayouts(prev => {
      const newLayouts: Layouts = {}
      Object.keys(GRID_COLS).forEach(bp => {
        newLayouts[bp] = [
          ...(prev[bp] || []),
          { i: newWidget.i, x: newWidget.x, y: newWidget.y, w: newWidget.w, h: newWidget.h, minW: newWidget.minW, minH: newWidget.minH }
        ]
      })
      return newLayouts
    })
  }
  
  // Delete widget
  const deleteWidget = (widgetId: string) => {
    setWidgets(prev => {
      const filtered = prev.filter(w => w.i !== widgetId)
      return filtered
    })
    setLayouts(prev => {
      const newLayouts: Layouts = {}
      Object.keys(prev).forEach(bp => {
        newLayouts[bp] = prev[bp].filter(item => item.i !== widgetId)
      })
      return newLayouts
    })
    if (selectedWidget === widgetId) setSelectedWidget(null)
  }
  
  // Duplicate widget
  const duplicateWidget = (widgetId: string) => {
    const widget = widgets.find(w => w.i === widgetId)
    if (!widget) return
    
    let maxY = 0
    widgets.forEach(w => {
      if (w.y + w.h > maxY) maxY = w.y + w.h
    })
    
    const newWidget: DesignWidget = {
      ...widget,
      i: `widget-${Date.now()}`,
      y: maxY,
      label: widget.label + ' (Kopya)'
    }
    
    setWidgets(prev => [...prev, newWidget])
    setSelectedWidget(newWidget.i)
  }
  
  // Handle layout change (drag & resize)
  // GÜVENLİK: Debounce ile gereksiz state güncellemelerini önle (performans)
  const debouncedWidgetUpdate = useMemo(
    () => debounce((layout: GridLayout[]) => {
      setWidgets(prev => {
        // Sadece değişen widget'ları güncelle
        let hasChanges = false
        const updated = prev.map(widget => {
          const layoutItem = layout.find(l => l.i === widget.i)
          if (layoutItem && (
            widget.x !== layoutItem.x || 
            widget.y !== layoutItem.y || 
            widget.w !== layoutItem.w || 
            widget.h !== layoutItem.h
          )) {
            hasChanges = true
            return {
              ...widget,
              x: layoutItem.x,
              y: layoutItem.y,
              w: layoutItem.w,
              h: layoutItem.h,
            }
          }
          return widget
        })
        
        // Değişiklik yoksa aynı referansı döndür (gereksiz re-render önle)
        if (!hasChanges) return prev
        
        // Update ref for save function
        widgetsRef.current = updated
        return updated
      })
    }, 100),
    []
  )
  
  const handleLayoutChange = useCallback((layout: GridLayout[], allLayouts: Layouts) => {
    setLayouts(allLayouts)
    debouncedWidgetUpdate(layout)
  }, [debouncedWidgetUpdate])
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedWidgetUpdate.cancel()
    }
  }, [debouncedWidgetUpdate])
  
  // Handle breakpoint change
  const handleBreakpointChange = useCallback((bp: string) => {
    setCurrentBreakpoint(bp)
  }, [])
  
  // Get widget type info
  const getWidgetTypeInfo = (typeId: string) => {
    return WIDGET_TYPES.find(t => t.id === typeId) || WIDGET_TYPES[0]
  }
  
  // Preview container width and cols based on mode
  const previewConfig = useMemo(() => {
    switch (previewMode) {
      case 'mobile': 
        return { 
          width: 'max-w-sm mx-auto', 
          cols: { lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 },
          breakpoints: { lg: 0, md: 0, sm: 0, xs: 0, xxs: 0 }
        }
      case 'tablet': 
        return { 
          width: 'max-w-2xl mx-auto', 
          cols: { lg: 18, md: 18, sm: 18, xs: 18, xxs: 18 },
          breakpoints: { lg: 0, md: 0, sm: 0, xs: 0, xxs: 0 }
        }
      default: 
        return { 
          width: 'w-full', 
          cols: GRID_COLS,
          breakpoints: GRID_BREAKPOINTS
        }
    }
  }, [previewMode])
  
  // For backwards compatibility
  const previewWidth = previewConfig.width
  
  // Selected widget info
  const selectedWidgetInfo = useMemo(() => {
    if (!selectedWidget) return null
    return widgets.find(w => w.i === selectedWidget)
  }, [selectedWidget, widgets])
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={clsx('flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl', theme.cardBg)}>
        <div className="flex items-center gap-4">
          <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg', theme.accent)}>
            <Palette className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className={clsx('text-2xl font-bold', theme.contentText)}>Tasarım Stüdyosu</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Dashboard ve widget tasarımları oluşturun</p>
          </div>
        </div>

        {/* Tabs */}
        <div className={clsx('flex items-center rounded-xl p-1', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
          {[
            { id: 'studio', label: 'Stüdyo', icon: LayoutGrid },
            { id: 'metrics', label: 'Metrikler', icon: Database },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all',
                activeTab === tab.id
                  ? theme.buttonPrimary
                  : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
              )}
            >
              <tab.icon size={16} />
              {tab.label}
        </button>
          ))}
        </div>
      </div>

      {activeTab === 'studio' && (
        <div className="flex gap-6">
          {/* Left Panel - Designs & Widgets */}
          <div className={clsx('w-64 shrink-0 space-y-4', showWidgetPanel ? '' : 'hidden')}>
            {/* Design Selector */}
            <div className={clsx('rounded-2xl p-4', theme.cardBg)}>
              <div className="flex items-center justify-between mb-3">
                <h3 className={clsx('font-bold text-sm', theme.contentText)}>Tasarımlar</h3>
                <button
                  onClick={createNewDesign}
                  className={clsx('p-1.5 rounded-lg transition-colors', theme.buttonSecondary)}
                  title="Yeni Tasarım"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setShowDesignDropdown(!showDesignDropdown)}
                  className={clsx(
                    'w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-medium',
                    theme.inputBg,
                    theme.inputText
                  )}
                >
                  <span className="truncate">{currentDesign?.name || 'Tasarım Seçin...'}</span>
                  <ChevronDown size={16} className={clsx(theme.contentTextMuted)} />
                </button>
                
                {showDesignDropdown && (
                  <div className={clsx(
                    'absolute top-full left-0 right-0 mt-1 rounded-xl border shadow-xl z-50 max-h-48 overflow-y-auto',
                    theme.cardBg,
                    isDark ? 'border-slate-700' : 'border-slate-200'
                  )}>
                    {designs.map(design => (
                      <div
                        key={design.id}
                        className={clsx(
                          'w-full flex items-center px-3 py-2 text-sm group',
                          currentDesign?.id === design.id
                            ? isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                            : clsx(theme.contentText, 'hover:' + (isDark ? 'bg-slate-800' : 'bg-slate-50'))
                        )}
                      >
                        <button
                          onClick={() => selectDesign(design)}
                          className="flex-1 flex items-center text-left"
                        >
                          <LayoutGrid size={14} className="mr-2 shrink-0" />
                          <span className="truncate">{design.name}</span>
                          <span className={clsx('ml-2 text-xs', theme.contentTextMuted)}>
                            {design.type === 'cockpit' ? 'Kokpit' : 'Analiz'}
                          </span>
                        </button>
                        {!design.id.startsWith('demo-') && (
                          <button
                            onClick={(e) => deleteDesign(design.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 text-rose-500 transition-all"
                            title="Tasarımı Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Widget Types */}
            <div className={clsx('rounded-2xl p-4', theme.cardBg)}>
              <h3 className={clsx('font-bold text-sm mb-3', theme.contentText)}>Widget Ekle</h3>
              <button
                onClick={() => addWidget(WIDGET_TYPES[0])}
                disabled={!currentDesign}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-medium transition-all',
                  currentDesign
                    ? theme.buttonPrimary
                    : 'opacity-50 cursor-not-allowed ' + (isDark ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')
                )}
              >
                <Plus size={18} />
                Yeni Widget
              </button>
              
              <div className="mt-4 space-y-1 max-h-[300px] overflow-y-auto">
                {WIDGET_TYPES.map(widgetType => (
                  <button
                    key={widgetType.id}
                    onClick={() => addWidget(widgetType)}
                    disabled={!currentDesign}
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left text-sm transition-colors',
                      currentDesign
                        ? clsx(theme.contentText, 'hover:' + (isDark ? 'bg-slate-800' : 'bg-slate-50'))
                        : 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    <widgetType.icon size={16} className={clsx(theme.contentTextMuted)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{widgetType.name}</p>
                      <p className={clsx('text-xs truncate', theme.contentTextMuted)}>{widgetType.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Preview Mode */}
            <div className={clsx('rounded-2xl p-4', theme.cardBg)}>
              <h3 className={clsx('font-bold text-sm mb-3', theme.contentText)}>Görünüm</h3>
              <div className="flex gap-2">
                {[
                  { id: 'desktop', icon: Monitor },
                  { id: 'tablet', icon: Tablet },
                  { id: 'mobile', icon: Smartphone },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setPreviewMode(mode.id as any)}
                    className={clsx(
                      'flex-1 flex items-center justify-center p-2 rounded-lg transition-colors',
                      previewMode === mode.id
                        ? theme.buttonPrimary
                        : theme.buttonSecondary
                    )}
                  >
                    <mode.icon size={18} />
                  </button>
                ))}
              </div>
              
              <button
                onClick={() => setShowGridLines(!showGridLines)}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 mt-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  theme.buttonSecondary
                )}
              >
                {showGridLines ? <Eye size={16} /> : <EyeOff size={16} />}
                Grid Çizgileri
              </button>
            </div>
            
            {/* Design Settings - SAĞDA GÖSTERİLİYOR, buradan kaldırıldı */}
          </div>
          
          {/* Main Canvas */}
          <div className="flex-1 min-w-0">
            <div 
              className={clsx(
                'rounded-2xl p-4 min-h-[600px] overflow-x-auto',
                theme.cardBg
              )}
              style={showGridLines ? {
                backgroundImage: isDark 
                  ? 'linear-gradient(to right, #1e293b 1px, transparent 1px), linear-gradient(to bottom, #1e293b 1px, transparent 1px)'
                  : 'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
                backgroundSize: previewMode === 'mobile' ? '30px 40px' : previewMode === 'tablet' ? '35px 40px' : '40px 40px'
              } : {}}
            >
              {!currentDesign ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <LayoutGrid size={40} className={clsx(theme.contentTextMuted)} />
                  </div>
                  <h3 className={clsx('text-xl font-bold mb-2', theme.contentText)}>Tasarım Seçin veya Oluşturun</h3>
                  <p className={clsx('text-sm max-w-md', theme.contentTextMuted)}>
                    Sol panelden mevcut bir tasarım seçin veya yeni bir tasarım oluşturarak widget eklemeye başlayın.
                  </p>
                  <button
                    onClick={createNewDesign}
                    className={clsx('mt-6 flex items-center gap-2 px-6 py-3 rounded-xl font-medium', theme.buttonPrimary)}
                  >
                    <Plus size={18} />
                    Yeni Tasarım Oluştur
                  </button>
                </div>
              ) : widgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[500px] text-center">
                  <div className={clsx('w-20 h-20 rounded-2xl flex items-center justify-center mb-4', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                    <Plus size={40} className={clsx(theme.contentTextMuted)} />
                  </div>
                  <h3 className={clsx('text-xl font-bold mb-2', theme.contentText)}>Widget Ekleyin</h3>
                  <p className={clsx('text-sm max-w-md', theme.contentTextMuted)}>
                    Sol panelden widget seçerek tasarımınıza ekleyin. Eklenen widget'ları sürükleyerek konumlandırabilir, köşelerinden tutarak boyutlandırabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className={clsx('mx-auto', previewWidth)}>
                  <ResponsiveGridLayout
                    className="layout"
                    layouts={layouts}
                    breakpoints={previewConfig.breakpoints}
                    cols={previewConfig.cols}
                    rowHeight={GRID_ROW_HEIGHT}
                    margin={previewMode === 'mobile' ? [8, 8] : GRID_MARGIN}
                    containerPadding={[0, 0]}
                    onLayoutChange={handleLayoutChange}
                    onBreakpointChange={handleBreakpointChange}
                    isDraggable={true}
                    isResizable={true}
                    draggableHandle=".widget-drag-handle"
                    draggableCancel=".widget-action-btn"
                    resizeHandles={['se', 'sw', 'ne', 'nw', 'e', 'w', 'n', 's']}
                    compactType={null}
                    preventCollision={true}
                  >
                    {widgets.map(widget => {
                      const typeInfo = getWidgetTypeInfo(widget.type)
                      const isSelected = selectedWidget === widget.i
                      
                      return (
                        <div
                          key={widget.i}
                          className={clsx(
                            'rounded-xl border-2 overflow-hidden transition-all group',
                            isSelected
                              ? 'border-indigo-500 shadow-lg shadow-indigo-500/20'
                              : isDark 
                                ? 'border-slate-700 hover:border-slate-600' 
                                : 'border-slate-200 hover:border-slate-300',
                            isDark ? 'bg-slate-900' : 'bg-white'
                          )}
                          onClick={() => setSelectedWidget(widget.i)}
                        >
                          {/* Widget Header */}
                          <div className={clsx(
                            'widget-drag-handle flex items-center justify-between px-3 py-2 cursor-move',
                            isDark ? 'bg-slate-800' : 'bg-slate-50'
                          )}>
                            <div className="flex items-center gap-2 min-w-0">
                              <GripVertical size={14} className={clsx(theme.contentTextMuted, 'shrink-0')} />
                              <typeInfo.icon size={14} className={clsx(theme.contentTextMuted, 'shrink-0')} />
                              <span className={clsx('text-sm font-medium truncate', theme.contentText)}>{widget.label}</span>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative z-50">
                              <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { 
                                  e.stopPropagation()
                                  e.preventDefault()
                                  setSelectedWidget(widget.i) 
                                }}
                                className={clsx('widget-action-btn p-1.5 rounded transition-colors cursor-pointer', theme.buttonSecondary)}
                                title="Ayarlar"
                              >
                                <Settings size={14} />
                              </button>
                              <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { 
                                  e.stopPropagation()
                                  e.preventDefault()
                                  duplicateWidget(widget.i) 
                                }}
                                className={clsx('widget-action-btn p-1.5 rounded transition-colors cursor-pointer', theme.buttonSecondary)}
                                title="Kopyala"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={(e) => { 
                                  e.stopPropagation()
                                  e.preventDefault()
                                  deleteWidget(widget.i) 
                                }}
                                className="widget-action-btn p-1.5 rounded transition-colors hover:bg-rose-500/20 text-rose-500 cursor-pointer"
                                title="Sil"
                              >
                                <Trash2 size={14} />
        </button>
      </div>
                          </div>
                          
                          {/* Widget Content (Placeholder) */}
                          <div className="flex-1 flex items-center justify-center p-4">
                            <div className="text-center">
                              <typeInfo.icon size={32} className={clsx(theme.contentTextMuted, 'mx-auto mb-2')} />
                              <p className={clsx('text-xs', theme.contentTextMuted)}>{typeInfo.description}</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </ResponsiveGridLayout>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel - Widget Properties + Design Settings */}
          <div className="w-72 shrink-0">
            <div className={clsx('rounded-2xl p-4 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto', theme.cardBg)}>
              
              {currentDesign ? (
                <div className="space-y-4">
                  
                  {/* Widget seçiliyse Widget Özellikleri göster */}
                  {selectedWidgetInfo && (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className={clsx('font-bold', theme.contentText)}>Widget Özellikleri</h3>
                        <button
                          onClick={() => setSelectedWidget(null)}
                          className={clsx('p-1 rounded-lg transition-colors', theme.buttonSecondary)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      
                      {/* Label */}
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1.5', theme.contentTextMuted)}>Başlık</label>
                        <input
                          type="text"
                          value={selectedWidgetInfo.label}
                          onChange={(e) => {
                            setWidgets(prev => prev.map(w => 
                              w.i === selectedWidgetInfo.i ? { ...w, label: e.target.value } : w
                            ))
                          }}
                          className={clsx(
                            'w-full px-3 py-2 rounded-xl text-sm border',
                            theme.inputBg,
                            theme.inputText
                          )}
                        />
                      </div>
                      
                      {/* Type */}
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1.5', theme.contentTextMuted)}>Widget Tipi</label>
                        <select
                          value={selectedWidgetInfo.type}
                          onChange={(e) => {
                            const newType = WIDGET_TYPES.find(t => t.id === e.target.value)
                            if (newType) {
                              setWidgets(prev => prev.map(w => 
                                w.i === selectedWidgetInfo.i ? { ...w, type: newType.id } : w
                              ))
                            }
                          }}
                          className={clsx(
                            'w-full px-3 py-2 rounded-xl text-sm border',
                            theme.inputBg,
                            theme.inputText
                          )}
                        >
                          {WIDGET_TYPES.map(type => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      {/* Metric Selection */}
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1.5', theme.contentTextMuted)}>
                          Bağlı Metrik
                        </label>
                        <select
                          value={selectedWidgetInfo.metricId || ''}
                          onChange={(e) => {
                            const metric = metrics.find(m => m.id === e.target.value)
                            setWidgets(prev => prev.map(w => 
                              w.i === selectedWidgetInfo.i 
                                ? { ...w, metricId: e.target.value || undefined, metricName: metric?.label || metric?.name } 
                                : w
                            ))
                          }}
                          className={clsx(
                            'w-full px-3 py-2 rounded-xl text-sm border',
                            theme.inputBg,
                            theme.inputText
                          )}
                        >
                          <option value="">Metrik seçin...</option>
                          {metrics.map(metric => (
                            <option key={metric.id} value={metric.id}>
                              {metric.label || metric.name} ({metric.aggregationType})
                            </option>
                          ))}
                        </select>
                        {selectedWidgetInfo.metricId && (
                          <p className={clsx('mt-1 text-xs', 'text-emerald-500')}>
                            ✓ {selectedWidgetInfo.metricName || 'Metrik bağlandı'}
                          </p>
                        )}
                      </div>
                      
                      {/* Position & Size */}
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1.5', theme.contentTextMuted)}>Konum & Boyut</label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={clsx('px-3 py-2 rounded-lg text-sm text-center', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <span className={clsx(theme.contentTextMuted)}>X:</span> {selectedWidgetInfo.x}
                          </div>
                          <div className={clsx('px-3 py-2 rounded-lg text-sm text-center', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <span className={clsx(theme.contentTextMuted)}>Y:</span> {selectedWidgetInfo.y}
                          </div>
                          <div className={clsx('px-3 py-2 rounded-lg text-sm text-center', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <span className={clsx(theme.contentTextMuted)}>W:</span> {selectedWidgetInfo.w}
                          </div>
                          <div className={clsx('px-3 py-2 rounded-lg text-sm text-center', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                            <span className={clsx(theme.contentTextMuted)}>H:</span> {selectedWidgetInfo.h}
                          </div>
                        </div>
                      </div>
                      
                      {/* Stil Seçenekleri - Tüm widget tipleri için */}
                      <div className={clsx('p-3 rounded-xl mt-3', isDark ? 'bg-indigo-900/20 border border-indigo-500/30' : 'bg-indigo-50 border border-indigo-200')}>
                        <h4 className={clsx('text-sm font-bold mb-3 flex items-center gap-2', theme.contentText)}>
                          <Palette size={14} /> Görünüm
                        </h4>
                        
                        {/* Renk Seçimi */}
                        <div className="mb-3">
                          <label className={clsx('block text-xs mb-1.5', theme.contentTextMuted)}>Renk</label>
                          <div className="flex flex-wrap gap-1.5">
                            {colorPalette.map((c) => (
                              <button
                                key={c}
                                onClick={() => {
                                  setWidgets(prev => prev.map(w => 
                                    w.i === selectedWidgetInfo.i ? { ...w, color: c } : w
                                  ))
                                }}
                                className={clsx(
                                  'w-6 h-6 rounded-lg transition-all',
                                  selectedWidgetInfo.color === c 
                                    ? 'ring-2 ring-offset-2 ring-indigo-500' 
                                    : 'hover:scale-110'
                                )}
                                style={{ backgroundColor: c }}
                                title={c}
                              />
                            ))}
                          </div>
                        </div>
                        
                        {/* İkon Seçimi */}
                        <div className="mb-3">
                          <label className={clsx('block text-xs mb-1.5', theme.contentTextMuted)}>İkon</label>
                          <select
                            value={selectedWidgetInfo.icon || 'Filter'}
                            onChange={(e) => {
                              setWidgets(prev => prev.map(w => 
                                w.i === selectedWidgetInfo.i ? { ...w, icon: e.target.value } : w
                              ))
                            }}
                            className={clsx(
                              'w-full px-3 py-2 rounded-lg text-sm border',
                              theme.inputBg,
                              theme.inputText
                            )}
                          >
                            {iconOptions.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                        
                        {/* Kart Renk Modu */}
                        <div>
                          <label className={clsx('block text-xs mb-1.5', theme.contentTextMuted)}>Kart Stili</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { value: 'none', label: 'Sade' },
                              { value: 'accent', label: 'Üst Bar' },
                              { value: 'full', label: 'Tam Renk' },
                            ].map(mode => (
                              <button
                                key={mode.value}
                                onClick={() => {
                                  setWidgets(prev => prev.map(w => 
                                    w.i === selectedWidgetInfo.i 
                                      ? { ...w, chartConfig: { ...w.chartConfig, colorMode: mode.value as 'none' | 'accent' | 'full' } } 
                                      : w
                                  ))
                                }}
                                className={clsx(
                                  'px-2 py-1.5 rounded-lg text-xs font-medium transition-all border',
                                  (selectedWidgetInfo.chartConfig?.colorMode || 'none') === mode.value
                                    ? 'bg-indigo-500 text-white border-indigo-500'
                                    : clsx(theme.buttonSecondary, 'border-transparent')
                                )}
                              >
                                {mode.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Ayırıcı */}
                      <div className={clsx('border-t my-4', isDark ? 'border-slate-700' : 'border-slate-200')} />
                    </>
                  )}
                  
                  {/* HER ZAMAN Tasarım Ayarları göster */}
                  <div className={clsx('p-3 rounded-xl', isDark ? 'bg-emerald-900/20 border border-emerald-500/30' : 'bg-emerald-50 border border-emerald-200')}>
                    <h4 className={clsx('text-sm font-bold mb-3 flex items-center gap-2', theme.contentText)}>
                      <span>⚙️</span> Tasarım Ayarları
                    </h4>
                    
                    {/* Tasarım Adı */}
                    <div className="mb-3">
                      <label className={clsx('block text-xs mb-1', theme.contentTextMuted)}>Tasarım Adı</label>
                      <input
                        type="text"
                        value={designName}
                        onChange={(e) => setDesignName(e.target.value)}
                        placeholder="Tasarım adı..."
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                      />
                    </div>
                    
                    {/* Görüntüleme Yeri */}
                    <div className="mb-3">
                      <label className={clsx('block text-xs mb-1', theme.contentTextMuted)}>Görüntüleme Yeri</label>
                      <select
                        value={designType}
                        onChange={(e) => setDesignType(e.target.value as 'cockpit' | 'analysis')}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                      >
                        <option value="cockpit">Kokpit (Ana Sayfa)</option>
                        <option value="analysis">Detaylı Analiz</option>
                      </select>
                    </div>
                  </div>
                  
                  {/* Pozisyon Yetkilendirme */}
                  <div className={clsx('p-3 rounded-xl', isDark ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200')}>
                    <h4 className={clsx('text-sm font-bold mb-3 flex items-center gap-2', theme.contentText)}>
                      <span>🔐</span> Rapor Yetkileri
                    </h4>
                    <p className={clsx('text-xs mb-2', theme.contentTextMuted)}>Bu raporu görebilecek pozisyonlar:</p>
                    <div className="grid grid-cols-1 gap-1.5">
                      {ALL_POSITIONS.map(pos => (
                        <label 
                          key={pos.code}
                          className={clsx(
                            'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border text-xs',
                            allowedPositions.includes(pos.code)
                              ? 'bg-purple-500/10 border-purple-500 text-purple-600'
                              : clsx(theme.cardBg, 'border-transparent hover:border-slate-300')
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={allowedPositions.includes(pos.code)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAllowedPositions([...allowedPositions, pos.code])
                              } else {
                                setAllowedPositions(allowedPositions.filter(p => p !== pos.code))
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                          />
                          <span className={clsx('font-medium', allowedPositions.includes(pos.code) ? '' : theme.contentTextMuted)}>
                            {pos.name}
                          </span>
                        </label>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-1.5 flex-wrap">
                      <button 
                        type="button"
                        onClick={() => setAllowedPositions(ALL_POSITIONS.map(p => p.code))}
                        className={clsx('text-xs px-2 py-1 rounded', theme.buttonSecondary)}
                      >
                        Tümü
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAllowedPositions(['GENERAL_MANAGER', 'DIRECTOR'])}
                        className={clsx('text-xs px-2 py-1 rounded', theme.buttonSecondary)}
                      >
                        Yönetim
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAllowedPositions([])}
                        className={clsx('text-xs px-2 py-1 rounded', theme.buttonSecondary)}
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                  
                  {/* Rapor Kategorisi (Güçler Ayrılığı) */}
                  {reportCategories.length > 0 && (
                    <div className={clsx('p-3 rounded-xl', isDark ? 'bg-violet-900/20 border border-violet-500/30' : 'bg-violet-50 border border-violet-200')}>
                      <h4 className={clsx('text-sm font-bold mb-2 flex items-center gap-2', theme.contentText)}>
                        <span>📁</span> Rapor Kategorisi
                      </h4>
                      <p className={clsx('text-xs mb-2', theme.contentTextMuted)}>
                        Bu raporu sadece belirli kategorideki kullanıcılar görsün (Güçler Ayrılığı)
                      </p>
                      <select
                        value={selectedCategoryId || ''}
                        onChange={(e) => setSelectedCategoryId(e.target.value || null)}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                      >
                        <option value="">-- Kategori Seçiniz --</option>
                        {reportCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                      {selectedCategoryId && (
                        <p className={clsx('text-xs mt-2', isDark ? 'text-violet-400' : 'text-violet-600')}>
                          Bu rapor sadece &quot;{reportCategories.find(c => c.id === selectedCategoryId)?.name}&quot; kategorisine atanmış kullanıcılar tarafından görülecek.
                        </p>
                      )}
                    </div>
                  )}
                  
                  {/* Kaydet & Aç Butonları */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        // Tasarımı Aç (Preview) - Açık tasarımı direkt göster
                        if (!currentDesign?.id) {
                          toast.error('Önce tasarımı kaydedin veya bir tasarım seçin');
                          return;
                        }
                        // currentDesign.type'ı kullan (tasarımdan gelen gerçek tip)
                        const actualType = currentDesign.type || designType;
                        const targetPath = actualType === 'cockpit' 
                          ? `/kokpit?designId=${currentDesign.id}` 
                          : `/detayli-analiz?designId=${currentDesign.id}`;
                        // Aynı sekmede aç
                        window.location.href = targetPath;
                      }}
                      disabled={!currentDesign?.id}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                        theme.buttonSecondary,
                        !currentDesign?.id && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <FolderOpen size={16} />
                      Aç
                    </button>
                    <button
                      onClick={saveDesign}
                      className={clsx(
                        'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                        'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg'
                      )}
                    >
                      <Save size={16} />
                      Kaydet
                    </button>
                  </div>
                  
                  {/* Tasarım Bilgisi */}
                  <div className={clsx('p-3 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                    <h4 className={clsx('text-xs font-bold mb-2 uppercase tracking-wider', theme.contentTextMuted)}>Tasarım Bilgisi</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className={clsx(theme.contentTextMuted)}>Widget Sayısı</span>
                        <span className={clsx('font-medium', theme.contentText)}>{widgets.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={clsx(theme.contentTextMuted)}>Grid Kolonları</span>
                        <span className={clsx('font-medium', theme.contentText)}>{previewConfig.cols.lg}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Tasarım seçili değil */
                <div className="text-center py-8">
                  <Settings size={40} className={clsx(theme.contentTextMuted, 'mx-auto mb-3')} />
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Bir tasarım seçin veya yeni oluşturun</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {activeTab === 'metrics' && (
        <MetricsContent />
      )}
    </div>
  )
}
