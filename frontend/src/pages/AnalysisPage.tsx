import React, { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../components/Layout'
import { useAuthStore } from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`
import { useFilterStore } from '../stores/filterStore'
import { useSocket } from '../hooks/useSocket'
import FilterBar from '../components/FilterBar'
import { 
  PieChart as PieChartIcon, 
  ArrowRight, 
  ArrowUpRight,
  LayoutTemplate,
  TrendingUp,
  TrendingDown,
  BarChart3,
  LineChart,
  Table,
  Loader,
  ChevronLeft,
  ChevronRight,
  Hash,
  Gauge,
  Target,
  Table2,
  Trophy,
  Activity,
  GitCompare,
  Database,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus,
  DollarSign,
  ShoppingCart,
  Users,
  Store,
  Package,
  Percent,
  AlertCircle,
  Calendar,
  RefreshCw
} from 'lucide-react'
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines'

// İkon haritası - Dinamik ikon seçimi için
const iconMap: Record<string, React.ComponentType<any>> = {
  BarChart3, LineChart, PieChart: PieChartIcon, TrendingUp, TrendingDown, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Database, Zap,
  ArrowUp, ArrowDown, Minus, Loader, DollarSign, ShoppingCart, Users,
  Store, Package, Percent, AlertCircle, Calendar, RefreshCw
}
import clsx from 'clsx'
import { enrichWithCoordinates, getCoordinatesOffline } from '../services/geographicApi'
import { DashboardType } from '../types'
import { 
  ResponsiveContainer, 
  BarChart, Bar, 
  LineChart as RechartsLineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, Legend,
  ComposedChart,
  ScatterChart, Scatter, ZAxis,
  Treemap,
  FunnelChart, Funnel, LabelList
} from 'recharts'

// Responsive hook with debounce - sayfa boyutu değişince crash önleme
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  })

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let isUnmounted = false;
    
    const handleResize = () => {
      // Debounce - 300ms bekle, sürekli tetiklenmeyi önle
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        if (!isUnmounted) {
          setWindowSize({ 
            width: window.innerWidth,
            height: window.innerHeight
          });
        }
      }, 300);
    }
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      isUnmounted = true;
      window.removeEventListener('resize', handleResize);
      if (timeoutId) clearTimeout(timeoutId);
    }
  }, [])

  return windowSize
}

interface Widget {
  id: string;
  label: string;
  type: string;
  metricId?: string;
  metricName?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  icon?: string;
  color?: string;
  chartConfig?: {
    borderStyle?: 'rounded' | 'sharp' | 'pill';
    [key: string]: any;
  };
  data?: {
    value?: number | string | any[];
    formatted?: string;
    data?: any[];
    metadata?: any;
    executionTime?: number;
    cached?: boolean;
  };
}

interface SavedDesign {
  id: string;
  name: string;
  description?: string;
  type: string;
  layoutConfig?: {
    widgets?: any[];
  };
  createdAt?: string;
}

// Demo analiz raporları
const demoReports = [
  {
    id: 'report-1',
    title: 'Satış Trend Analizi',
    description: 'Günlük, haftalık ve aylık satış trendlerinin detaylı analizi',
    type: 'analysis' as DashboardType,
    metrics: 8,
    lastUpdated: '2025-12-20',
    icon: LineChart,
    color: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'report-2',
    title: 'Ürün Performans Raporu',
    description: 'En çok satan ürünler, stok devir hızı ve karlılık analizi',
    type: 'analysis' as DashboardType,
    metrics: 12,
    lastUpdated: '2025-12-19',
    icon: BarChart3,
    color: 'from-violet-500 to-purple-500'
  },
  {
    id: 'report-3',
    title: 'Mağaza Karşılaştırma',
    description: 'Mağazalar arası performans karşılaştırması ve benchmark',
    type: 'analysis' as DashboardType,
    metrics: 15,
    lastUpdated: '2025-12-18',
    icon: PieChart,
    color: 'from-emerald-500 to-teal-500'
  },
  {
    id: 'report-4',
    title: 'Müşteri Segmentasyonu',
    description: 'Müşteri davranış analizi ve segmentasyon raporu',
    type: 'analysis' as DashboardType,
    metrics: 6,
    lastUpdated: '2025-12-17',
    icon: Table,
    color: 'from-amber-500 to-orange-500'
  },
  {
    id: 'report-5',
    title: 'Finansal Özet Raporu',
    description: 'Aylık P&L, nakit akışı ve kar marjı analizi',
    type: 'analysis' as DashboardType,
    metrics: 10,
    lastUpdated: '2025-12-15',
    icon: TrendingUp,
    color: 'from-rose-500 to-pink-500'
  },
]

export default function AnalysisPage() {
  const { theme, isDark, currentTheme } = useTheme()
  const { accessToken, user } = useAuthStore()
  const { 
    startDate, endDate, datePreset, selectedRegionId, selectedStoreIds, selectedStoreType,
    crossFilters, drillDown, 
    addCrossFilter, removeCrossFilter, clearCrossFilters,
    openDrillDown, closeDrillDown, setDrillDownData, setDrillDownLoading
  } = useFilterStore()
  
  // WebSocket for real-time updates
  const { isConnected, subscribe, unsubscribe, on } = useSocket()
  
  const [selectedReport, setSelectedReport] = useState<string | null>(null)
  const [selectedDesign, setSelectedDesign] = useState<SavedDesign | null>(null)
  const [designWidgets, setDesignWidgets] = useState<Widget[]>([])
  const [dateRange, setDateRange] = useState('30d')
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingDesign, setLoadingDesign] = useState(false)
  const { width, height } = useWindowSize()
  
  // Pagination state for each widget
  const [widgetPages, setWidgetPages] = useState<Record<string, number>>({})
  
  // Responsive breakpoints - Landscape için özel kontrol
  const isLandscape = width > height
  const isMobilePortrait = width < 768 && !isLandscape // Dikey telefon
  const isMobileLandscape = width < 1024 && isLandscape && height < 500 // Yatay telefon
  const isMobile = isMobilePortrait || isMobileLandscape
  const isTablet = width >= 768 && width < 1024 && !isMobileLandscape

  // Kullanıcı pozisyon kodu
  const userPositionCode = user?.positionCode || 'VIEWER'

  // Pozisyon bazlı tasarım filtreleme
  const getAccessibleDesigns = (designs: SavedDesign[]) => {
    return designs.filter(d => {
      // allowedPositions alanı varsa kontrol et
      const allowedPositions = (d as any).allowed_positions || (d as any).allowedPositions
      
      // Eğer allowedPositions tanımlı değilse veya boş array ise herkese açık
      if (!allowedPositions || !Array.isArray(allowedPositions) || allowedPositions.length === 0) {
        return true
      }
      
      // Kullanıcının pozisyonu izin listesinde mi?
      return allowedPositions.includes(userPositionCode)
    })
  }
  
  // Sayfa unmount olduğunda drill-down modal'ı kapat
  useEffect(() => {
    return () => {
      closeDrillDown()
      clearCrossFilters()
    }
  }, [])
  
  // Kaydedilen analysis tasarımlarını yükle
  useEffect(() => {
    if (accessToken) {
      loadSavedDesigns()
    }
  }, [accessToken])
  
  // URL'den designId parametresi varsa otomatik yükle
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlDesignId = urlParams.get('designId');
    
    if (urlDesignId && savedDesigns.length > 0 && !selectedDesign) {
      // URL'deki tasarım erişilebilir mi kontrol et
      const targetDesign = savedDesigns.find(d => d.id === urlDesignId);
      if (targetDesign) {
        loadDesignDetail(urlDesignId);
        // URL'den parametreyi temizle
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [savedDesigns, selectedDesign])

  // Filtreler değiştiğinde verileri yeniden yükle (tarih, bölge, mağaza, tip)
  useEffect(() => {
    if (selectedDesign && accessToken) {
      loadDesignDetail(selectedDesign.id)
    }
  }, [startDate, endDate, selectedRegionId, selectedStoreIds.length, selectedStoreType])
  
  // WebSocket: Dashboard'a abone ol ve real-time güncellemeleri dinle
  useEffect(() => {
    if (!isConnected || !selectedDesign?.id) return
    
    // Dashboard room'una abone ol
    subscribe('dashboard', selectedDesign.id)
    
    // Dashboard refresh event'ini dinle
    const unsubRefresh = on('dashboard:refresh', (data) => {
      if (data.designId === selectedDesign.id) {
        loadDesignDetail(selectedDesign.id)
      }
    })
    
    // ETL tamamlandığında verileri yenile
    const unsubEtl = on('etl:completed', () => {
      if (selectedDesign?.id) {
        loadDesignDetail(selectedDesign.id)
      }
    })
    
    return () => {
      unsubscribe('dashboard', selectedDesign.id)
      unsubRefresh()
      unsubEtl()
    }
  }, [isConnected, selectedDesign?.id, subscribe, unsubscribe, on])
  
  // Drill-Down verisi çek
  const fetchDrillDownData = async (metricId: string, field: string, value: string | number) => {
    try {
      setDrillDownLoading(true);
      const response = await fetch(`${API_BASE}/analytics/metrics/${metricId}/drill-down`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ field, value, limit: 100 })
      });
      
      if (response.ok) {
        const result = await response.json();
        setDrillDownData(result.data?.rows || []);
      } else {
        console.error('Drill-down fetch failed');
        setDrillDownData([]);
      }
    } catch (error) {
      console.error('Drill-down error:', error);
      setDrillDownData([]);
    }
  };
  
  // Tasarım detayını yükle
  const loadDesignDetail = async (designId: string) => {
    setLoadingDesign(true)
    try {
      // Tüm filtreleri al (tarih, bölge, mağaza, tip, cross-filter)
      const { startDate, endDate, datePreset, selectedRegionId, selectedStoreIds, selectedStoreType, crossFilters } = useFilterStore.getState()
      
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
      
      // Cross-Filter parametreleri
      if (crossFilters.length > 0) {
        params.append('crossFilters', JSON.stringify(crossFilters))
      }
      
      const queryString = params.toString() ? `?${params.toString()}` : ''
      
      const res = await fetch(`${API_BASE}/analytics/dashboard/${designId}/full${queryString}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        const design = data.data?.design
        const widgets = data.data?.widgets || []
        
        if (design) {
          setSelectedDesign({
            id: design.id,
            name: design.name,
            description: design.description,
            type: design.type,
            layoutConfig: design.layoutConfig
          })
          setDesignWidgets(widgets.map((w: any) => ({
            id: w.id,
            label: w.label,
            type: w.type,
            metric_visualization_type: w.metric_visualization_type, // Backend'den gelen gerçek grafik tipi
            metricId: w.metricId,
            metricName: w.metricName,
            x: w.gridPosition?.x ?? w.x ?? 0,
            y: w.gridPosition?.y ?? w.y ?? 0,
            w: w.gridPosition?.w ?? w.w ?? 4,
            h: w.gridPosition?.h ?? w.h ?? 4,
            icon: w.icon,
            color: w.color,
            chartConfig: w.chartConfig || {}, // Renk modu ve diğer ayarlar
            data: w.data,
            target: w.target, // Hedef değeri { value, progress }
            sparklineData: w.sparklineData, // Trend verisi
            comparison: w.comparison, // Karşılaştırma verisi { enabled, type, previousValue, trend, label }
            previousValue: w.previousValue, // Önceki dönem değeri
            trend: w.trend, // Trend yüzdesi
            comparisonLabel: w.comparisonLabel // Karşılaştırma etiketi
          })))
        }
      }
    } catch (err) {
      console.warn('Tasarım detay yükleme hatası:', err)
    } finally {
      setLoadingDesign(false)
    }
  }
  
  // Kaydedilen tasarıma tıklandığında
  const handleSelectDesign = (design: SavedDesign) => {
    setSelectedReport(null) // Demo rapor seçimini temizle
    loadDesignDetail(design.id)
  }
  
  const loadSavedDesigns = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/analytics/designs`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      })
      if (res.ok) {
        const data = await res.json()
        // Sadece analysis tipindeki tasarımları filtrele
        const analysisDesigns = (data.data || []).filter((d: SavedDesign) => d.type === 'analysis')
        // Pozisyon bazlı yetkilendirme uygula
        const accessibleDesigns = getAccessibleDesigns(analysisDesigns)
        setSavedDesigns(accessibleDesigns)
      }
    } catch (err) {
      console.warn('Tasarım yükleme hatası:', err)
    } finally {
      setLoading(false)
    }
  }

  // Kaydedilen tasarım görüntüleme
  if (selectedDesign) {
    return (
      <div className="space-y-6">
        {/* Global Filter Bar - Her zaman görünür */}
        <FilterBar />
        
        {/* Tasarım Başlığı */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => { setSelectedDesign(null); setDesignWidgets([]); }}
              className={clsx('p-2 rounded-xl transition-colors', theme.buttonSecondary)}
            >
              <ArrowRight size={20} className="rotate-180" />
            </button>
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl">
              <BarChart3 size={24} className="text-white" />
            </div>
            <div>
              <h1 className={clsx('text-2xl font-bold', theme.contentText)}>{selectedDesign.name}</h1>
              <p className={clsx('text-sm', theme.contentTextMuted)}>
                {selectedDesign.description || 'Özel analiz tasarımı'} • {designWidgets.length} Widget
              </p>
            </div>
          </div>
        </div>

        {/* Loading */}
        {loadingDesign && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        )}

        {/* Widget'lar - Responsive Grid Layout */}
        {/* Mobil: 2 kolon flex/grid, Tablet: 12 kolon, Desktop: 24 kolon */}
        {!loadingDesign && designWidgets.length > 0 && (
          <div 
            className="relative gap-2 sm:gap-3 lg:gap-4 overflow-hidden"
            style={isMobile ? {
              display: 'grid',
              gridTemplateColumns: isMobileLandscape ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)', // Yatay: 2 kolon, Dikey: 1 kolon
              gap: '12px',
            } : {
              display: 'grid',
              gridTemplateColumns: isTablet ? 'repeat(12, 1fr)' : 'repeat(24, 1fr)',
              gridAutoRows: '40px',
              minHeight: '200px',
            }}
          >
            {designWidgets.map((widget) => {
              // Grid pozisyonları - 24 kolonlu grid (1-indexed)
              const rawX = widget.x || 0
              const rawY = widget.y || 0
              const rawW = widget.w || 6
              const rawH = widget.h || 4
              
              const widgetColor = widget.color || '#6366F1'
              const chartConfig = (widget as any).chartConfig || (widget as any).chart_config || {}
              const colorMode = chartConfig?.colorMode || 'none'
              const isFullColorMode = colorMode === 'full'
              const isAccentMode = colorMode === 'accent'
              
              // Responsive pozisyon hesaplama (24 kolondan 12 kolona ölçekleme)
              let gridX: number, gridW: number, gridH: number
              
              if (isMobile || isTablet) {
                // 24 kolondan 12 kolona ölçekle
                gridX = Math.floor(rawX / 2)
                gridW = Math.max(Math.ceil(rawW / 2), 2) // minimum 2 kolon
                gridH = Math.max(rawH, 3) // mobilde minimum yükseklik
                // Taşma kontrolü
                if (gridX + gridW > 12) {
                  gridX = Math.max(0, 12 - gridW)
                }
              } else {
                // Desktop - orijinal değerler
                gridX = rawX
                gridW = rawW
                gridH = rawH
                // Taşma kontrolü
                if (gridX + gridW > 24) {
                  gridX = Math.max(0, 24 - gridW)
                }
              }
              
              const rowHeight = isMobile ? 30 : 40
              const gap = isMobile ? 12 : 16
              
              // Widget için trend verisi (backend'den gelebilir)
              const widgetData = widget.data as any
              const widgetTrend = widgetData?.trend || widgetData?.change || widgetData?.metadata?.trend
              const trendValue = typeof widgetTrend === 'number' ? widgetTrend : null
              const trendDirection = trendValue !== null ? (trendValue >= 0 ? 'up' : 'down') : null
              const periodLabel = widgetData?.period || widgetData?.subtitle || widgetData?.metadata?.period || 'Son 30 gün'
              
              return (
                <div
                  key={widget.id}
                  className={clsx(
                    'rounded-[20px] p-5 transition-all duration-300 group overflow-hidden flex flex-col',
                    // Renk moduna göre arka plan
                    isFullColorMode 
                      ? '' // Full renk modu - style'da uygulanacak
                      : currentTheme === 'clixer'
                        ? 'bg-gradient-to-br from-[#181B21] to-[#1a1e26]'
                        : (isDark 
                            ? 'bg-slate-800/80 backdrop-blur-sm' 
                            : 'bg-white'),
                    // Border - Clixer temasında gölge yok, sadece border
                    isFullColorMode 
                      ? '' 
                      : currentTheme === 'clixer'
                        ? 'border border-[#2F3542] hover:border-[#00CFDE]/40'
                        : (isDark ? 'border border-slate-700/50' : 'border border-slate-100'),
                    // Shadow - Clixer temasında yok
                    currentTheme !== 'clixer' && (isDark
                      ? 'shadow-[0_4px_24px_rgba(0,0,0,0.2)]'
                      : 'shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]'),
                    // Hover effect - Clixer temasında shadow yok
                    currentTheme !== 'clixer' && 'hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:-translate-y-0.5'
                  )}
                  style={{ 
                    gridColumn: isMobile ? undefined : `${gridX + 1} / span ${gridW}`,
                    gridRow: isMobile ? undefined : `${rawY + 1} / span ${gridH}`,
                    minHeight: isMobile ? 'auto' : `${gridH * rowHeight + (gridH - 1) * gap}px`,
                    // Mobilde padding azalt
                    ...(isMobile && { padding: '16px' }),
                    // Renk moduna göre stil
                    ...(isFullColorMode ? { 
                      // Gradient arka plan - yumuşak geçiş
                      background: `linear-gradient(135deg, ${widgetColor} 0%, ${widgetColor}99 50%, ${widgetColor}66 100%)`,
                      // Clixer temasında gölge yok
                      ...(currentTheme !== 'clixer' && { boxShadow: `0 8px 32px ${widgetColor}40` }),
                    } : isAccentMode ? {
                      // Accent modu - üst bar
                      borderTop: `3px solid ${widgetColor}`
                    } : {
                      // Sade mod - çizgisiz
                    }),
                  }}
                >
                  {/* Header - Demo kartları gibi */}
                  <div className="flex items-center justify-between mb-4">
                    {(() => {
                      // Widget'ın ikonunu al (metrik veya widget'tan)
                      const widgetIcon = widget.icon || (widget as any).metricIcon || 'BarChart3';
                      const IconComponent = iconMap[widgetIcon] || BarChart3;
                      return (
                        <div 
                          className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                      style={{ backgroundColor: widgetColor }}
                    >
                          <IconComponent className="h-5 w-5 text-white" />
                    </div>
                      );
                    })()}
                    <button 
                      className={clsx(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-all',
                        isDark 
                          ? 'bg-slate-700/50 hover:bg-slate-600 text-slate-400 hover:text-white' 
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700',
                        'shadow-sm hover:shadow-md'
                      )}
                      title="Detay"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Widget Label - Demo gibi küçük ve muted */}
                  <p className={clsx('text-sm mb-1', isFullColorMode ? 'text-white/80' : theme.contentTextMuted)} title={widget.label}>
                    {widget.label}
                  </p>
                  
                  {/* ============================================ */}
                  {/* GÖRSELLEŞTİRME TİPİNE GÖRE CHART RENDER */}
                  {/* ============================================ */}
                  {(() => {
                    // Metrik görselleştirme tipi HER ZAMAN öncelikli!
                    const metricVizType = (widget as any).metric_visualization_type || (widget as any).metricVisualizationType;
                    const widgetType = (widget as any).type || (widget as any).widgetType;
                    
                    // Öncelik sırası: metricVizType > widgetType > varsayılan
                    // Metrik oluştururken seçilen görselleştirme tipi (progress, sparkline, gauge) HER ZAMAN kullanılmalı
                    let vizType = metricVizType || widgetType || 'kpi_card';
                    // Veri widget.data.data veya widget.data.value içinde olabilir
                    const chartData = widget.data?.data || (Array.isArray(widget.data?.value) ? widget.data.value : []) || (widget.data as any)?.chartData || [];
                    const CHART_COLORS = ['#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
                    
                    
                    // PIE CHART / DONUT CHART - Cross-Filter & Drill-Down destekli
                    if ((vizType === 'pie_chart' || vizType === 'donut_chart') && chartData.length > 0) {
                      // chartData'yı PieChart formatına dönüştür
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                      const pieData = chartData.map((item: any, idx: number) => {
                        const valueKey = keys.find(k => typeof item[k] === 'number') || keys[1];
                        return {
                          name: item[nameKey] || `Item ${idx + 1}`,
                          value: Number(item[valueKey]) || 0,
                          originalData: item
                        };
                      });
                      
                      // Pie dilimi tıklama handler'ı
                      const handlePieClick = (_data: any, index: number) => {
                        const clickedItem = pieData[index];
                        if (!clickedItem) return;
                        
                        // Drill-Down aç
                        if (widget.metricId) {
                          openDrillDown(widget.id, widget.metricId, nameKey, clickedItem.name, clickedItem.name);
                          fetchDrillDownData(widget.metricId, nameKey, clickedItem.name);
                        }
                      };
                      
                      // Responsive label render - sadece yeterli alan varsa göster
                      const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
                        // %5'ten küçük dilimlerde label gösterme
                        if (percent < 0.05) return null;
                        
                        const RADIAN = Math.PI / 180;
                        const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                        const x = cx + radius * Math.cos(-midAngle * RADIAN);
                        const y = cy + radius * Math.sin(-midAngle * RADIAN);
                        
                        return (
                          <text 
                            x={x} 
                            y={y} 
                            fill="white" 
                            textAnchor="middle" 
                            dominantBaseline="central"
                            fontSize={11}
                            fontWeight={600}
                          >
                            {`${(percent * 100).toFixed(0)}%`}
                          </text>
                        );
                      };
                      
                      return (
                        <div className="flex-1 flex flex-col min-h-0">
                          <div className="flex-1 min-h-[120px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                                <Pie
                                  data={pieData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={vizType === 'donut_chart' ? '35%' : 0}
                                  outerRadius="75%"
                                  paddingAngle={2}
                                  dataKey="value"
                                  label={renderCustomLabel}
                                  labelLine={false}
                                  onClick={handlePieClick}
                                  style={{ cursor: 'pointer' }}
                                >
                                  {pieData.map((_: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip 
                                  formatter={(value: number, name: string) => [value.toLocaleString('tr-TR'), name]} 
                                  contentStyle={{ 
                                    borderRadius: '8px', 
                                    border: 'none', 
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                    fontSize: '12px'
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          {/* Legend - Alt kısımda yatay scroll ile */}
                          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 px-1 max-h-[60px] overflow-y-auto">
                            {pieData.slice(0, 8).map((item: any, index: number) => (
                              <div key={index} className="flex items-center gap-1 text-xs whitespace-nowrap">
                                <div 
                                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                <span className={clsx('truncate max-w-[80px]', theme.contentTextMuted)}>
                                  {item.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    
                    // BAR CHART - Cross-Filter & Drill-Down destekli
                    if (vizType === 'bar_chart' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                      const valueKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                      
                      // Grafiğe tıklama handler'ı
                      const handleBarClick = (data: any, _index: number) => {
                        if (!data || !data.activePayload?.[0]) return;
                        const payload = data.activePayload[0].payload;
                        const clickedValue = payload[nameKey];
                        
                        // Cross-Filter DEVRE DIŞI - şimdilik etkilemesin
                        // addCrossFilter({
                        //   widgetId: widget.id,
                        //   field: nameKey,
                        //   value: clickedValue,
                        //   label: String(clickedValue)
                        // });
                        
                        // Drill-Down aç
                        if (widget.metricId) {
                          openDrillDown(widget.id, widget.metricId, nameKey, clickedValue, String(clickedValue));
                          // Drill-down verisi çek
                          fetchDrillDownData(widget.metricId, nameKey, clickedValue);
                        }
                      };
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} onClick={handleBarClick} style={{ cursor: 'pointer' }}>
                              <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} />
                              {valueKeys.map((key, idx) => (
                                <Bar key={key} dataKey={key} fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // LINE CHART
                    if (vizType === 'line_chart' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                      const valueKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={chartData}>
                              <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} />
                              {valueKeys.map((key, idx) => (
                                <Line key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[idx % CHART_COLORS.length]} strokeWidth={2} dot={false} />
                              ))}
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // AREA CHART
                    if (vizType === 'area_chart' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                      const valueKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                              <defs>
                                {valueKeys.map((key, idx) => (
                                  <linearGradient key={`gradient-${key}`} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={CHART_COLORS[idx % CHART_COLORS.length]} stopOpacity={0.1}/>
                                  </linearGradient>
                                ))}
                              </defs>
                              <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} />
                              {valueKeys.map((key, idx) => (
                                <Area key={key} type="monotone" dataKey={key} stroke={CHART_COLORS[idx % CHART_COLORS.length]} fill={`url(#color-${key})`} />
                              ))}
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // MAP CHART (Harita)
                    if (vizType === 'map_chart' && chartData.length > 0) {
                      // Lazy load MapChart component
                      const MapChart = React.lazy(() => import('../components/MapChart'));
                      
                      // chartData'yı harita formatına dönüştür
                      // Önce koordinat zenginleştirme yap (şehir isimlerinden koordinat bul)
                      const enrichedData = enrichWithCoordinates(chartData);
                      
                      const mapData = enrichedData.map((item: any, idx: number) => {
                        const keys = Object.keys(item);
                        
                        // İsim kolonu bul
                        const nameColumns = ['name', 'store_name', 'city', 'il', 'sehir', 'city_name', 'district', 'ilce'];
                        let pointName = `Nokta ${idx + 1}`;
                        for (const col of nameColumns) {
                          if (item[col]) {
                            pointName = item[col];
                            break;
                          }
                        }
                        // Fallback: İlk string kolon
                        if (pointName === `Nokta ${idx + 1}`) {
                          const firstStringCol = keys.find(k => typeof item[k] === 'string');
                          if (firstStringCol) pointName = item[firstStringCol];
                        }
                        
                        // Koordinatları al (zenginleştirilmiş veriden veya orijinal)
                        let lat = Number(item.lat || item.latitude || item.enlem);
                        let lng = Number(item.lng || item.longitude || item.boylam);
                        
                        // Koordinat hala yoksa şehir isminden bulmayı dene
                        if (!lat || !lng) {
                          const coords = getCoordinatesOffline(pointName);
                          if (coords) {
                            lat = coords.lat;
                            lng = coords.lng;
                          } else {
                            // Son çare: Türkiye merkezi (random değil!)
                            lat = 39.0;
                            lng = 35.0;
                          }
                        }
                        
                        // Değer kolonu bul
                        const valueColumns = ['value', 'total', 'amount', 'tutar', 'ciro', 'count', 'adet', 'toplam'];
                        let pointValue = 0;
                        for (const col of valueColumns) {
                          if (typeof item[col] === 'number') {
                            pointValue = item[col];
                            break;
                          }
                        }
                        // Fallback: İlk sayısal kolon
                        if (pointValue === 0) {
                          const numericCol = keys.find(k => typeof item[k] === 'number');
                          if (numericCol) pointValue = item[numericCol];
                        }
                        
                        return {
                          id: item.id || `point-${idx}`,
                          name: pointName,
                          lat,
                          lng,
                          value: pointValue,
                          category: item.category || item.region || item.bolge || item.type
                        };
                      });
                      
                      return (
                        <div className="flex-1 min-h-0 h-full">
                          <React.Suspense fallback={<div className="flex items-center justify-center h-full"><span className={theme.contentTextMuted}>Harita yükleniyor...</span></div>}>
                            <MapChart
                              data={mapData}
                              height={undefined} // Otomatik height - container'a göre
                              color={widgetColor}
                              showCircles={true}
                              showMarkers={false}
                            />
                          </React.Suspense>
                        </div>
                      );
                    }
                    
                    // COMBO CHART (Çubuk + Çizgi)
                    if (vizType === 'combo_chart' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                      const valueKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                              <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                              <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} />
                              <Legend />
                              {valueKeys[0] && (
                                <Bar yAxisId="left" dataKey={valueKeys[0]} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                              )}
                              {valueKeys[1] && (
                                <Line yAxisId="right" type="monotone" dataKey={valueKeys[1]} stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                              )}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // SCATTER PLOT (Dağılım Grafiği)
                    if (vizType === 'scatter_plot' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const numericKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                      const xKey = numericKeys[0] || 'x';
                      const yKey = numericKeys[1] || 'y';
                      const zKey = numericKeys[2]; // Opsiyonel - bubble boyutu için
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart>
                              <XAxis dataKey={xKey} tick={{ fontSize: 10 }} name={xKey} />
                              <YAxis dataKey={yKey} tick={{ fontSize: 10 }} name={yKey} />
                              {zKey && <ZAxis dataKey={zKey} range={[50, 400]} />}
                              <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                              <Scatter data={chartData} fill={widgetColor}>
                                {chartData.map((_: any, index: number) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                ))}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // TREEMAP (Ağaç Haritası)
                    if (vizType === 'treemap' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || 'name';
                      const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || 'value';
                      
                      const treemapData = chartData.map((item: any, idx: number) => ({
                        name: item[nameKey] || `Item ${idx + 1}`,
                        size: Number(item[valueKey]) || 0,
                        fill: CHART_COLORS[idx % CHART_COLORS.length]
                      }));
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <Treemap
                              data={treemapData}
                              dataKey="size"
                              stroke="#fff"
                              fill={widgetColor}
                            >
                              <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} />
                            </Treemap>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // FUNNEL CHART (Huni Grafiği)
                    if (vizType === 'funnel_chart' && chartData.length > 0) {
                      const keys = Object.keys(chartData[0] || {});
                      const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || 'name';
                      const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || 'value';
                      
                      const funnelData = chartData.map((item: any, idx: number) => ({
                        name: item[nameKey] || `Aşama ${idx + 1}`,
                        value: Number(item[valueKey]) || 0,
                        fill: CHART_COLORS[idx % CHART_COLORS.length]
                      }));
                      
                      return (
                        <div className="flex-1 min-h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <FunnelChart>
                              <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} />
                              <Funnel
                                dataKey="value"
                                data={funnelData}
                                isAnimationActive
                              >
                                <LabelList position="center" fill="#fff" stroke="none" fontSize={12} />
                              </Funnel>
                            </FunnelChart>
                          </ResponsiveContainer>
                        </div>
                      );
                    }
                    
                    // HEATMAP (Isı Haritası) - Grid tabanlı
                    if (vizType === 'heatmap' && chartData.length > 0) {
                      // Heatmap için basit grid render
                      const keys = Object.keys(chartData[0] || {});
                      const rowKey = keys[0];
                      const colKey = keys[1];
                      const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || keys[2];
                      
                      // Değer aralığını bul
                      const values = chartData.map((d: any) => Number(d[valueKey]) || 0);
                      const minVal = Math.min(...values);
                      const maxVal = Math.max(...values);
                      const range = maxVal - minVal || 1;
                      
                      // Renk hesapla
                      const getColor = (val: number) => {
                        const normalized = (val - minVal) / range;
                        const r = Math.round(255 * normalized);
                        const g = Math.round(100 * (1 - normalized));
                        const b = Math.round(100 * (1 - normalized));
                        return `rgb(${r}, ${g}, ${b})`;
                      };
                      
                      // Unique satır ve sütunlar
                      const rows = [...new Set(chartData.map((d: any) => d[rowKey]))];
                      const cols = [...new Set(chartData.map((d: any) => d[colKey]))];
                      
                      return (
                        <div className="flex-1 overflow-auto">
                          <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
                            {/* Header */}
                            <div></div>
                            {cols.map((col: any, i: number) => (
                              <div key={i} className="text-xs text-center truncate p-1">{String(col)}</div>
                            ))}
                            {/* Rows */}
                            {rows.map((row: any, ri: number) => (
                              <React.Fragment key={ri}>
                                <div className="text-xs truncate p-1">{String(row)}</div>
                                {cols.map((col: any, ci: number) => {
                                  const cell = chartData.find((d: any) => d[rowKey] === row && d[colKey] === col);
                                  const val = cell ? Number(cell[valueKey]) || 0 : 0;
                                  return (
                                    <div
                                      key={ci}
                                      className="rounded text-xs text-white text-center p-1"
                                      style={{ backgroundColor: getColor(val) }}
                                      title={`${row} / ${col}: ${val.toLocaleString('tr-TR')}`}
                                    >
                                      {val > 0 ? (val >= 1000 ? `${(val/1000).toFixed(0)}K` : val) : '-'}
                                    </div>
                                  );
                                })}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    
                    // PROGRESS BAR (İlerleme Çubuğu)
                    if (vizType === 'progress' || vizType === 'progress_bar') {
                      const value = typeof widgetData?.value === 'number' ? widgetData.value : 0;
                      // Backend'den gelen target objesi: { value, progress }
                      const targetObj = (widget as any).target || widgetData?.target;
                      const target = targetObj?.value || widgetData?.metadata?.target || 100;
                      const percent = targetObj?.progress ?? Math.min(100, Math.max(0, (value / target) * 100));
                      
                      return (
                        <div className="flex-1 flex flex-col justify-center">
                          {/* Ana değer - Diğer kartlarla tutarlı */}
                          <p className={clsx('text-2xl font-bold mb-3', theme.contentText)}>
                            {value.toLocaleString('tr-TR')}
                          </p>
                          
                          {/* Progress bar */}
                          <div className="flex justify-between text-sm mb-2">
                            <span className={theme.contentTextMuted}>İlerleme</span>
                            <span className={clsx('font-semibold', theme.contentText)}>{percent.toFixed(1)}%</span>
                          </div>
                          <div className={clsx('h-4 rounded-full overflow-hidden relative', isDark ? 'bg-slate-600' : 'bg-slate-300')}>
                            {/* İlerleme - Dolu kısım */}
                            <div 
                              className="h-full rounded-full transition-all duration-500 relative z-10"
                              style={{ 
                                width: `${percent}%`, 
                                backgroundColor: widgetColor 
                              }} 
                            />
                            {/* Kalan kısım - Daha belirgin gri */}
                            <div 
                              className="absolute top-0 right-0 h-full rounded-r-full"
                              style={{ 
                                width: `${100 - percent}%`,
                                backgroundColor: isDark ? '#475569' : '#cbd5e1'
                              }} 
                            />
                          </div>
                          <div className="flex justify-between text-xs mt-2">
                            <span className={theme.contentTextMuted}>Güncel: {value.toLocaleString('tr-TR')}</span>
                            <span className={theme.contentTextMuted}>Hedef: {target.toLocaleString('tr-TR')}</span>
                          </div>
                        </div>
                      );
                    }
                    
                    // GAUGE (Gösterge)
                    if (vizType === 'gauge') {
                      const value = typeof widgetData?.value === 'number' ? widgetData.value : 0;
                      // Backend'den gelen target objesi: { value, progress }
                      const targetObj = (widget as any).target || widgetData?.target;
                      const target = targetObj?.value || widgetData?.metadata?.target || 100;
                      const percent = targetObj?.progress ?? Math.min(100, Math.max(0, (value / target) * 100));
                      
                      // SVG Gauge için hesaplama
                      const radius = 40;
                      const strokeWidth = 8;
                      const circumference = Math.PI * radius; // Yarım daire
                      const filledLength = (percent / 100) * circumference;
                      const emptyLength = circumference - filledLength;
                      const emptyColor = isDark ? '#475569' : '#cbd5e1';
                      
                      return (
                        <div className="flex-1 flex flex-col justify-center">
                          {/* Ana değer - Diğer kartlarla tutarlı */}
                          <p className={clsx('text-2xl font-bold mb-3', isFullColorMode ? 'text-white' : theme.contentText)}>
                            {value.toLocaleString('tr-TR')}
                          </p>
                          
                          {/* Gauge Section */}
                          <div className="flex items-center gap-4">
                            {/* Gauge SVG */}
                            <svg viewBox="0 0 100 55" className="w-20 h-12 flex-shrink-0">
                              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={emptyColor} strokeWidth={strokeWidth} strokeLinecap="round" />
                              <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={widgetColor} strokeWidth={strokeWidth} strokeLinecap="round"
                                strokeDasharray={`${filledLength} ${emptyLength}`} style={{ transition: 'stroke-dasharray 0.5s ease' }} />
                            </svg>
                            <div>
                              <p className={clsx('text-xl font-bold', isFullColorMode ? 'text-white' : theme.contentText)}>
                                {percent.toFixed(0)}%
                              </p>
                              <p className={clsx('text-xs', isFullColorMode ? 'text-white/80' : theme.contentTextMuted)}>
                                Hedef: {target.toLocaleString('tr-TR')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    // SPARKLINE (Mini Grafik)
                    if (vizType === 'sparkline') {
                      // Güvenli veri alma
                      const rawSparkData = (widget as any).sparklineData || widgetData?.sparklineData || widgetData?.data;
                      const sparkData = Array.isArray(rawSparkData) && rawSparkData.length > 0 
                        ? rawSparkData.map((v: any) => Number(v) || 0)
                        : [5, 10, 5, 20, 8, 15, 12, 18, 14, 22, 16, 25];
                      
                      // Toplam değeri hesapla - sparkData array ise topla, değilse value kullan
                      let totalValue: number | null = null;
                      if (typeof widgetData?.value === 'number') {
                        totalValue = widgetData.value;
                      } else if (sparkData.length > 0) {
                        // sparkData'dan toplam al
                        totalValue = sparkData.reduce((sum: number, val: number) => sum + val, 0);
                      }
                      
                      // Trend hesapla - son değer ile ilk değerin karşılaştırması
                      let sparkTrend: number | null = trendValue;
                      let sparkTrendDirection = trendDirection;
                      if (sparkTrend === null && sparkData.length >= 2) {
                        const firstHalf = sparkData.slice(0, Math.floor(sparkData.length / 2));
                        const secondHalf = sparkData.slice(Math.floor(sparkData.length / 2));
                        const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length : 0;
                        const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length : 0;
                        if (firstAvg > 0) {
                          sparkTrend = ((secondAvg - firstAvg) / firstAvg) * 100;
                          sparkTrendDirection = sparkTrend >= 0 ? 'up' : 'down';
                        }
                      }
                      
                      return (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {/* Üst: Değer + Trend */}
                          <div className="flex-shrink-0">
                            <p className={clsx('text-2xl font-bold', isFullColorMode ? 'text-white' : theme.contentText)}>
                              {totalValue !== null 
                                ? `₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` 
                                : widgetData?.formatted || '-'}
                            </p>
                            {sparkTrend !== null && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className={clsx(
                                  'text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                                  sparkTrendDirection === 'up' 
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                    : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                                )}>
                                  {sparkTrendDirection === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {sparkTrend >= 0 ? '+' : ''}{sparkTrend.toFixed(1)}%
                                </span>
                                <span className={clsx('text-xs', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>
                                  {periodLabel || 'Son 30 gün'}
                                </span>
                              </div>
                            )}
                          </div>
                          
                          {/* Alt: Sparkline Grafik - Kalan alanı doldur ama taşma */}
                          <div className="flex-1 min-h-0 mt-2 max-h-16 overflow-hidden">
                            <Sparklines data={Array.isArray(sparkData) ? sparkData : [5, 10, 8, 15, 12, 20]} margin={4} height={64} style={{ width: '100%', height: '100%' }}>
                              <SparklinesLine color={widgetColor} style={{ strokeWidth: 2, fill: 'none' }} />
                              <SparklinesSpots size={2} style={{ fill: widgetColor }} />
                            </Sparklines>
                          </div>
                        </div>
                      );
                    }
                    
                    // TREND CARD (Trend Kartı)
                    if (vizType === 'trend' || vizType === 'trend_card') {
                      // Güvenli veri alma
                      const rawSparkData = (widget as any).sparklineData || widgetData?.sparklineData || widgetData?.data;
                      const sparkData = Array.isArray(rawSparkData) && rawSparkData.length > 0 
                        ? rawSparkData.map((v: any) => Number(v) || 0)
                        : [5, 10, 5, 20, 8, 15, 12, 18, 14, 22, 16, 25];
                      
                      // Toplam değeri hesapla
                      let totalValue: number | null = null;
                      if (typeof widgetData?.value === 'number') {
                        totalValue = widgetData.value;
                      } else if (sparkData.length > 0) {
                        totalValue = sparkData.reduce((sum: number, val: number) => sum + val, 0);
                      }
                      
                      // Trend hesapla
                      let sparkTrend: number | null = trendValue;
                      let sparkTrendDirection = trendDirection;
                      if (sparkTrend === null && sparkData.length >= 2) {
                        const firstHalf = sparkData.slice(0, Math.floor(sparkData.length / 2));
                        const secondHalf = sparkData.slice(Math.floor(sparkData.length / 2));
                        const firstAvg = firstHalf.length > 0 ? firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length : 0;
                        const secondAvg = secondHalf.length > 0 ? secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length : 0;
                        if (firstAvg > 0) {
                          sparkTrend = ((secondAvg - firstAvg) / firstAvg) * 100;
                          sparkTrendDirection = sparkTrend >= 0 ? 'up' : 'down';
                        }
                      }
                      
                      return (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {/* Üst: Değer + Trend */}
                          <div className="flex-shrink-0">
                            <p className={clsx('text-2xl font-bold', isFullColorMode ? 'text-white' : theme.contentText)}>
                              {totalValue !== null 
                                ? `₺${totalValue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` 
                                : widgetData?.formatted || '-'}
                            </p>
                            {sparkTrend !== null && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className={clsx(
                                  'text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                                  sparkTrendDirection === 'up' 
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                    : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                                )}>
                                  {sparkTrendDirection === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {sparkTrend >= 0 ? '+' : ''}{sparkTrend.toFixed(1)}%
                                </span>
                                <span className={clsx('text-xs', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>{periodLabel}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Alt: Trend Grafik */}
                          <div className="flex-1 min-h-0 mt-2 max-h-16 overflow-hidden">
                            <Sparklines data={Array.isArray(sparkData) ? sparkData : [5, 10, 8, 15, 12, 20]} margin={4} height={64} style={{ width: '100%', height: '100%' }}>
                              <SparklinesLine color={widgetColor} style={{ strokeWidth: 2, fill: 'none' }} />
                            </Sparklines>
                          </div>
                        </div>
                      );
                    }
                    
                    // COMPARISON (Karşılaştırma)
                    if (vizType === 'comparison') {
                      const currentValue = typeof widgetData?.value === 'number' ? widgetData.value : 0;
                      // Widget'tan veya data'dan previousValue al
                      const comparisonData = (widget as any).comparison || {};
                      const previousValue = (widget as any).previousValue || comparisonData.previousValue || widgetData?.previousValue || widgetData?.metadata?.previousValue || 0;
                      const trendFromBackend = (widget as any).trend || comparisonData.trend || widgetData?.metadata?.trend;
                      const compLabel = (widget as any).comparisonLabel || comparisonData.label || widgetData?.metadata?.comparisonLabel || periodLabel;
                      // Trend backend'den geliyorsa kullan, yoksa hesapla
                      const change = trendFromBackend !== null && trendFromBackend !== undefined 
                        ? trendFromBackend 
                        : (previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0);
                      
                      // Sayıları kısalt (1M, 1B formatı)
                      const formatCompactNumber = (num: number) => {
                        if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
                        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
                        if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
                        return num.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
                      };
                      
                      return (
                        <div className="flex-1 flex flex-col justify-center min-w-0">
                          <div className="flex flex-wrap gap-x-4 gap-y-2">
                            <div className="min-w-0 flex-1">
                              <p className={clsx('text-xs font-medium mb-0.5', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>Güncel</p>
                              <p className={clsx('text-lg sm:text-xl font-bold truncate', isFullColorMode ? 'text-white' : theme.contentText)}>
                                {formatCompactNumber(currentValue)}
                              </p>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={clsx('text-xs font-medium mb-0.5', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>Önceki</p>
                              <p className={clsx('text-lg sm:text-xl font-bold truncate', isFullColorMode ? 'text-white/70' : theme.contentTextMuted)}>
                                {formatCompactNumber(previousValue)}
                              </p>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className={clsx(
                              'text-xs font-medium px-2 py-0.5 rounded-lg inline-flex items-center gap-1',
                              isFullColorMode 
                                ? (change >= 0 ? 'bg-white/20 text-white' : 'bg-white/20 text-white')
                                : (change >= 0 
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                    : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400')
                            )}>
                              {change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                            </span>
                            <span className={clsx('text-xs font-medium', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>{compLabel}</span>
                          </div>
                        </div>
                      );
                    }
                    
                    // RANKING LIST (Sıralama Listesi) - 4 Kolonlu: label, value, subtitle, trend
                    if (vizType === 'ranking_list' || vizType === 'ranking') {
                      const rankData = widget.data?.data || (Array.isArray(widget.data?.value) ? widget.data.value : []) || (widget.data as any)?.chartData || [];
                      const isArray = Array.isArray(rankData);
                      
                      if (!isArray || rankData.length === 0) {
                        return (
                          <div className="flex-1 flex items-center justify-center">
                            <p className={clsx('text-sm', theme.contentTextMuted)}>Sıralama verisi yok</p>
                          </div>
                        );
                      }
                      
                      // İlk satırdan kolon isimlerini al
                      const columns = Object.keys(rankData[0] || {});
                      
                      // Kolon isimleri (sırayla: label, value, subtitle, trend)
                      // Akıllı kolon tespiti
                      let labelColumn = columns[0];
                      let valueColumn = columns[1] || columns[0];
                      let subtitleColumn: string | null = null;
                      let trendColumn: string | null = null;
                      
                      // Trend kolonunu bul (trend, growth, change, yüzde içeren)
                      const trendKeywords = ['trend', 'growth', 'change', 'percent', 'yuzde', 'degisim', 'oran'];
                      for (const col of columns) {
                        const colLower = col.toLowerCase();
                        if (trendKeywords.some(k => colLower.includes(k))) {
                          trendColumn = col;
                          break;
                        }
                      }
                      
                      // En büyük sayısal değere sahip kolonu bul (value)
                      let maxValueFound = 0;
                      for (const col of columns) {
                        if (col === trendColumn) continue; // Trend kolonu value değil
                        const firstVal = Number(rankData[0][col]);
                        if (!isNaN(firstVal) && firstVal > maxValueFound) {
                          maxValueFound = firstVal;
                          valueColumn = col;
                        }
                      }
                      
                      // Label kolonu value kolonundan farklı olmalı
                      if (labelColumn === valueColumn && columns.length > 1) {
                        labelColumn = columns.find(c => c !== valueColumn && c !== trendColumn) || columns[0];
                      }
                      
                      // Subtitle kolonu: label, value, trend dışındaki ilk kolon
                      const usedColumns = [labelColumn, valueColumn, trendColumn].filter(Boolean);
                      subtitleColumn = columns.find(c => !usedColumns.includes(c)) || null;
                      
                      // Eğer 4. kolon varsa ve trend bulunamadıysa, 4. kolonu trend yap
                      if (!trendColumn && columns.length >= 4) {
                        trendColumn = columns[3];
                      }
                      
                      // En yüksek değeri bul (progress bar için)
                      const maxValue = Math.max(...rankData.map((r: any) => Number(r[valueColumn]) || 0));
                      
                      // İlk 10'u göster
                      const topItems = rankData.slice(0, 10);
                      
                      return (
                        <div className="flex-1 flex flex-col gap-2 overflow-auto">
                          {topItems.map((item: any, idx: number) => {
                            const value = Number(item[valueColumn]) || 0;
                            const percent = maxValue > 0 ? (value / maxValue) * 100 : 0;
                            const subtitle = subtitleColumn ? item[subtitleColumn] : null;
                            const trend = trendColumn ? Number(item[trendColumn]) : null;
                            
                            // Sıra badge renkleri
                            const badgeColors = [
                              'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30', // 1. Altın
                              'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-lg shadow-slate-400/30', // 2. Gümüş
                              'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30', // 3. Bronz
                            ];
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={clsx(
                                  'flex items-center gap-3 p-3 rounded-xl transition-all duration-200',
                                  isDark ? 'bg-slate-800/50 hover:bg-slate-700/50' : 'bg-white hover:bg-slate-50',
                                  'border',
                                  isDark ? 'border-slate-700/50' : 'border-slate-200',
                                  idx < 3 && 'shadow-sm'
                                )}
                              >
                                {/* Sıra Badge */}
                                  <div className={clsx(
                                  'w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0',
                                  idx < 3 ? badgeColors[idx] : (isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600')
                                )}>
                                  {idx + 1}
                                  </div>
                                  
                                {/* İsim + Subtitle */}
                                <div className="flex-1 min-w-0">
                                  <div className={clsx('text-sm font-semibold truncate', theme.contentText)}>
                                    {item[labelColumn]}
                                          </div>
                                  {subtitle !== null && (
                                    <div className={clsx('text-xs mt-0.5', theme.contentTextMuted)}>
                                      {typeof subtitle === 'number' 
                                        ? `${subtitle.toLocaleString('tr-TR')} sipariş` 
                                        : subtitle
                                      }
                                    </div>
                                  )}
                                </div>
                                
                                {/* Değer + Trend */}
                                <div className="text-right shrink-0">
                                  <div className={clsx('text-sm font-bold tabular-nums', theme.contentText)}>
                                    {value >= 1000000 
                                      ? `₺${(value / 1000000).toFixed(1)}M`
                                      : value >= 1000 
                                        ? `₺${Math.round(value / 1000)}K`
                                        : `₺${value.toLocaleString('tr-TR')}`
                                    }
                                  </div>
                                  {trend !== null && !isNaN(trend) && (
                                    <div className={clsx(
                                      'text-xs font-medium mt-0.5 flex items-center justify-end gap-0.5',
                                      trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : theme.contentTextMuted
                                    )}>
                                      <span>{trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}</span>
                                      <span>{Math.abs(trend).toFixed(1)}%</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                      );
                    }
                    
                    return null;
                  })()}
                  
                  {/* LIST tipi widget - Tema Uyumlu Tablo */}
                  {(() => {
                    // Metrik görselleştirme tipi HER ZAMAN öncelikli!
                    const metricVizType = (widget as any).metric_visualization_type || (widget as any).metricVisualizationType;
                    const widgetType = (widget as any).type || (widget as any).widgetType;
                    const vizType = metricVizType || widgetType || 'kpi_card';
                    
                    // Chart ve özel görselleştirme tipleri için tablo gösterme
                    const skipTableTypes = [
                      'pie_chart', 'donut_chart', 'bar_chart', 'line_chart', 'area_chart',
                      'progress', 'progress_bar', 'gauge', 'sparkline', 'trend', 'trend_card', 'comparison',
                      'ranking_list', 'ranking', 'combo_chart', 'scatter_plot', 'treemap', 'funnel_chart', 'heatmap', 'map_chart'
                    ];
                    if (skipTableTypes.includes(vizType)) {
                      return null;
                    }
                    const tableData = widget.data?.data || (Array.isArray(widget.data?.value) ? widget.data.value : null);
                    if (tableData && tableData.length > 0) {
                      const pageSize = isMobile ? 5 : 10;
                      const currentPage = widgetPages[widget.id] || 0;
                      const totalPages = Math.ceil(tableData.length / pageSize);
                      const startIdx = currentPage * pageSize;
                      const endIdx = startIdx + pageSize;
                      const pageData = tableData.slice(startIdx, endIdx);
                      const columns = Object.keys(tableData[0] || {});
                      
                      // Kolon adını formatla: TRANSACTION_ID -> Transaction Id
                      const formatColumnName = (col: string) => {
                        return col
                          .toLowerCase()
                          .replace(/_/g, ' ')
                          .replace(/\b\w/g, l => l.toUpperCase());
                      };
                      
                      // Kolon tipini belirle (ilk satırdan)
                      const getColumnType = (col: string) => {
                        const val = tableData[0]?.[col];
                        return typeof val === 'number' ? 'number' : 'text';
                      };
                              
                              return (
                        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                          {/* Tema Uyumlu Tablo Container */}
                          <div 
                            className={clsx(
                              'overflow-auto flex-1 rounded-xl border',
                              isDark 
                                ? 'bg-slate-800/50 border-slate-700/50' 
                                : 'bg-teal-600/10 border-teal-200/50'
                            )} 
                            style={{ maxHeight: isMobile ? '240px' : '400px' }}
                          >
                            <table className="w-full min-w-[400px]">
                              {/* Başlık - Sidebar rengiyle uyumlu */}
                              <thead>
                                <tr className={clsx(
                                  'sticky top-0 z-10',
                                  isDark 
                                    ? 'bg-slate-700/90 backdrop-blur-sm' 
                                    : 'bg-teal-600/90 backdrop-blur-sm'
                                )}>
                                  <th className={clsx(
                                    'px-2 py-2 text-center text-xs font-semibold',
                                    isDark ? 'text-slate-400' : 'text-white/80'
                                  )}>
                                    #
                                  </th>
                                  {columns.map((col, i) => {
                                    const isNumeric = getColumnType(col) === 'number';
                                    return (
                                      <th 
                                        key={i}
                                        className={clsx(
                                          'px-4 py-2 text-xs font-semibold',
                                          isDark ? 'text-slate-300' : 'text-white',
                                          isNumeric ? 'text-right' : 'text-left'
                                        )}
                                      >
                                        {formatColumnName(col)}
                                      </th>
                                    );
                                  })}
                                </tr>
                              </thead>
                              {/* Tablo Gövdesi */}
                              <tbody>
                                {pageData.map((row: any, idx: number) => (
                                  <tr 
                                  key={idx} 
                                  className={clsx(
                                      'transition-colors duration-150',
                                      isDark 
                                        ? 'hover:bg-slate-700/50' 
                                        : 'hover:bg-teal-100/50',
                                      idx % 2 === 0 
                                        ? (isDark ? 'bg-slate-800/30' : 'bg-white/40')
                                        : (isDark ? 'bg-slate-800/60' : 'bg-teal-50/60')
                                    )}
                                  >
                                    <td className={clsx(
                                      'px-2 py-1.5 text-center text-xs tabular-nums',
                                      isDark ? 'text-slate-500' : 'text-teal-600/60'
                                  )}>
                                    {startIdx + idx + 1}
                                    </td>
                                    {columns.map((col, i) => {
                                      const val = row[col];
                                      const isNumber = typeof val === 'number';
                                      return (
                                        <td 
                                          key={i}
                                          className={clsx(
                                            'px-4 py-1.5 text-sm',
                                            isNumber ? 'text-right font-mono tabular-nums' : 'text-left',
                                            isDark ? 'text-slate-300' : 'text-slate-700'
                                          )}
                                        >
                                          {isNumber 
                                            ? val.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
                                            : (val?.toString() || '-')}
                                        </td>
                              );
                            })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          
                          {/* Pagination - Kompakt ve modern */}
                          {totalPages > 1 && (
                            <div className="flex items-center justify-between mt-3 px-1">
                              <span className={clsx('text-xs', isDark ? 'text-slate-500' : 'text-slate-500')}>
                                {tableData.length} kayıt
                              </span>
                              <div className="flex items-center gap-1">
                                <button 
                                  onClick={() => setWidgetPages(prev => ({ ...prev, [widget.id]: Math.max(0, currentPage - 1) }))}
                                  disabled={currentPage === 0}
                                  className={clsx(
                                    'p-1.5 rounded-lg transition-all',
                                    currentPage === 0 
                                      ? 'opacity-30 cursor-not-allowed' 
                                      : isDark 
                                        ? 'hover:bg-slate-700' 
                                        : 'hover:bg-teal-100'
                                  )}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                </button>
                                
                                {/* Sayfa numaraları */}
                                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                  let pageNum = i;
                                  if (totalPages > 5) {
                                    if (currentPage < 3) pageNum = i;
                                    else if (currentPage > totalPages - 3) pageNum = totalPages - 5 + i;
                                    else pageNum = currentPage - 2 + i;
                                  }
                                  return (
                                    <button
                                      key={pageNum}
                                      onClick={() => setWidgetPages(prev => ({ ...prev, [widget.id]: pageNum }))}
                                      className={clsx(
                                        'w-7 h-7 rounded-md text-xs font-medium transition-all',
                                        pageNum === currentPage
                                          ? (isDark 
                                              ? 'bg-teal-600 text-white' 
                                              : 'bg-teal-600 text-white')
                                          : (isDark 
                                              ? 'text-slate-400 hover:bg-slate-700' 
                                              : 'text-slate-600 hover:bg-teal-100')
                                      )}
                                    >
                                      {pageNum + 1}
                                    </button>
                                  );
                                })}
                                
                                <button 
                                  onClick={() => setWidgetPages(prev => ({ ...prev, [widget.id]: Math.min(totalPages - 1, currentPage + 1) }))}
                                  disabled={currentPage >= totalPages - 1}
                                  className={clsx(
                                    'p-1.5 rounded-lg transition-all',
                                    currentPage >= totalPages - 1 
                                      ? 'opacity-30 cursor-not-allowed' 
                                      : isDark 
                                        ? 'hover:bg-slate-700' 
                                        : 'hover:bg-teal-100'
                                  )}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  
                  {/* KPI tipi widget - Sadece özel tipler değilse göster */}
                  {(() => {
                    const metricVizType = (widget as any).metric_visualization_type || (widget as any).metricVisualizationType;
                    const widgetType = (widget as any).type || (widget as any).widgetType;
                    const vizType = metricVizType || widgetType || 'kpi_card';
                    
                    // Özel tipler için KPI gösterme
                    const specialTypes = [
                      'pie_chart', 'donut_chart', 'bar_chart', 'line_chart', 'area_chart',
                      'progress', 'progress_bar', 'gauge', 'sparkline', 'trend', 'trend_card', 'comparison',
                      'data_grid', 'ranking_list', 'LIST', 'combo_chart', 'scatter_plot', 'treemap', 'funnel_chart', 'heatmap', 'map_chart'
                    ];
                    
                    // Tablo verisi varsa da gösterme
                    const tableData = widget.data?.data || (Array.isArray(widget.data?.value) ? widget.data.value : null);
                    
                    if (specialTypes.includes(vizType) || (tableData && tableData.length > 0)) {
                      return null;
                    }
                    
                    return (
                    <div className="flex-1 flex flex-col justify-between min-w-0 overflow-hidden">
                      {/* Büyük Değer */}
                      <p className={clsx('text-2xl font-bold mb-2', isFullColorMode ? 'text-white' : theme.contentText)} 
                         title={widget.data?.formatted || widget.data?.value?.toString()}>
                        {widget.data?.formatted || 
                         (typeof widget.data?.value === 'number' 
                           ? widget.data.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })
                           : widget.data?.value || '-')}
                      </p>
                      
                      {/* Alt Kısım: Trend + Dönem + Cache */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {/* Trend Badge - Varsa göster */}
                          {trendValue !== null && (
                            <span className={clsx(
                              'text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                              trendDirection === 'up' 
                                ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                            )}>
                              {trendDirection === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {trendDirection === 'up' ? '+' : ''}{trendValue.toFixed(1)}%
                            </span>
                          )}
                          {/* Dönem bilgisi */}
                          <span className={clsx('text-xs font-medium', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>{periodLabel}</span>
                    </div>
                        
                        {/* Cache indicator */}
                        {widget.data?.cached && (
                          <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600')}>
                            ⚡
                          </span>
                        )}
                      </div>
                    </div>
                    );
                  })()}
                </div>
              )
            })}
          </div>
        )}

        {/* Widget yoksa */}
        {!loadingDesign && designWidgets.length === 0 && (
          <div className={clsx('border-2 border-dashed rounded-2xl p-12 text-center', isDark ? 'border-slate-700' : 'border-slate-200')}>
            <BarChart3 size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
            <p className={clsx('font-bold text-lg', theme.contentText)}>Bu tasarımda widget bulunamadı</p>
            <p className={clsx('text-sm mt-2', theme.contentTextMuted)}>
              Tasarım Stüdyosu'na gidip widget ekleyebilirsiniz.
            </p>
          </div>
        )}
      </div>
    )
  }

  if (selectedReport) {
    const report = demoReports.find(r => r.id === selectedReport)
    if (!report) return null

    return (
      <div className="space-y-6">
        {/* Rapor Başlığı */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSelectedReport(null)}
              className={clsx('p-2 rounded-xl transition-colors', theme.buttonSecondary)}
            >
              <ArrowRight size={20} className="rotate-180" />
            </button>
            <div className={clsx('p-3 bg-gradient-to-br rounded-2xl', report.color)}>
              <report.icon size={24} className="text-white" />
            </div>
            <div>
              <h1 className={clsx('text-2xl font-bold', theme.contentText)}>{report.title}</h1>
              <p className={clsx('text-sm', theme.contentTextMuted)}>{report.description}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Tarih Aralığı */}
            <div className={clsx('flex p-1 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
              {['7d', '30d', '90d', '1y'].map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={clsx(
                    'px-3 py-1.5 text-sm font-bold rounded-lg transition-all',
                    dateRange === range 
                      ? theme.buttonPrimary
                      : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
                  )}
                >
                  {range === '7d' ? '7 Gün' : range === '30d' ? '30 Gün' : range === '90d' ? '90 Gün' : '1 Yıl'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rapor İçeriği - Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ana Grafik */}
          <div className={clsx('lg:col-span-2 rounded-2xl p-6', theme.cardBg)}>
            <h3 className={clsx('font-bold text-lg mb-4', theme.contentText)}>Trend Grafiği</h3>
            <div className={clsx('h-80 flex items-center justify-center border-2 border-dashed rounded-2xl', isDark ? 'border-slate-700' : 'border-slate-200')}>
              <div className="text-center">
                <LineChart size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
                <p className={clsx('font-medium', theme.contentTextMuted)}>Grafik verisi yükleniyor...</p>
                <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>API entegrasyonu tamamlandığında gerçek veri gösterilecek</p>
              </div>
            </div>
          </div>

          {/* KPI Kartları */}
          <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
            <h3 className={clsx('font-bold text-lg mb-4', theme.contentText)}>Özet Metrikler</h3>
            <div className="space-y-4">
              {[
                { label: 'Toplam Satış', value: '₺14.326.602', change: 12.5 },
                { label: 'Ortalama Sipariş', value: '₺3.081', change: -2.1 },
                { label: 'Müşteri Sayısı', value: '4.650', change: 8.2 },
                { label: 'Dönüşüm Oranı', value: '%3.2', change: 0.5 },
              ].map((metric, i) => (
                <div key={i} className={clsx('flex items-center justify-between p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                  <div>
                    <p className={clsx('text-sm', theme.contentTextMuted)}>{metric.label}</p>
                    <p className={clsx('text-xl font-bold', theme.contentText)}>{metric.value}</p>
                  </div>
                  <div className={clsx(
                    'flex items-center gap-1 text-sm font-bold',
                    metric.change >= 0 
                      ? (isDark ? 'text-emerald-400' : 'text-emerald-600') 
                      : (isDark ? 'text-rose-400' : 'text-rose-600')
                  )}>
                    <TrendingUp size={16} className={metric.change < 0 ? 'rotate-180' : ''} />
                    {Math.abs(metric.change)}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tablo */}
          <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
            <h3 className={clsx('font-bold text-lg mb-4', theme.contentText)}>Detay Tablosu</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead className={clsx('text-xs font-bold uppercase', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>
                  <tr>
                    <th className="px-4 py-3 text-left rounded-l-lg">Kategori</th>
                    <th className="px-4 py-3 text-right">Değer</th>
                    <th className="px-4 py-3 text-right rounded-r-lg">Değişim</th>
                  </tr>
                </thead>
                <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                  {[
                    { name: 'Kategori A', value: '₺5.2M', change: '+15%' },
                    { name: 'Kategori B', value: '₺4.1M', change: '+8%' },
                    { name: 'Kategori C', value: '₺3.0M', change: '-3%' },
                    { name: 'Kategori D', value: '₺2.0M', change: '+22%' },
                  ].map((row, i) => (
                    <tr key={i} className={clsx('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                      <td className={clsx('px-4 py-3 font-medium', theme.contentText)}>{row.name}</td>
                      <td className={clsx('px-4 py-3 text-right font-bold', theme.contentText)}>{row.value}</td>
                      <td className={clsx(
                        'px-4 py-3 text-right font-bold',
                        row.change.startsWith('+') 
                          ? (isDark ? 'text-emerald-400' : 'text-emerald-600') 
                          : (isDark ? 'text-rose-400' : 'text-rose-600')
                      )}>{row.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Global Filter Bar */}
      <FilterBar />

      {/* Cross-Filter Badge'leri - DEVRE DIŞI */}
      {/* crossFilters özelliği şimdilik devre dışı
      {crossFilters.length > 0 && (
        <div className={clsx('flex items-center gap-2 flex-wrap p-3 rounded-xl', theme.cardBg)}>
          <span className={clsx('text-sm font-medium', theme.contentTextMuted)}>Aktif Filtreler:</span>
          {crossFilters.map((cf) => (
            <div 
              key={cf.widgetId} 
              className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
            >
              <span>{cf.field}: {cf.label || cf.value}</span>
              <button 
                onClick={() => removeCrossFilter(cf.widgetId)}
                className="ml-1 hover:text-blue-200"
              >
                ✕
              </button>
            </div>
          ))}
          <button 
            onClick={clearCrossFilters}
            className="text-sm text-rose-400 hover:text-rose-300 ml-2"
          >
            Tümünü Temizle
          </button>
        </div>
      )}
      */}

      {/* Drill-Down Modal */}
      {drillDown.isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden', theme.cardBg)}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h3 className={clsx('text-lg font-bold', theme.contentText)}>
                  Detay Görünümü
                </h3>
                <p className={clsx('text-sm', theme.contentTextMuted)}>
                  {drillDown.field}: {drillDown.label || drillDown.value}
                </p>
              </div>
              <button 
                onClick={closeDrillDown}
                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 overflow-auto max-h-[60vh]">
              {drillDown.loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-2 text-slate-400">Veriler yükleniyor...</span>
                </div>
              ) : drillDown.data && drillDown.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={clsx('border-b', isDark ? 'border-slate-700' : 'border-slate-200')}>
                        {Object.keys(drillDown.data[0]).slice(0, 8).map((key) => (
                          <th key={key} className={clsx('text-left p-2 font-medium', theme.contentTextMuted)}>
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {drillDown.data.slice(0, 50).map((row: any, idx: number) => (
                        <tr key={idx} className={clsx('border-b', isDark ? 'border-slate-800 hover:bg-slate-800/50' : 'border-slate-100 hover:bg-slate-50')}>
                          {Object.keys(row).slice(0, 8).map((key) => (
                            <td key={key} className={clsx('p-2', theme.contentText)}>
                              {typeof row[key] === 'number' 
                                ? row[key].toLocaleString('tr-TR') 
                                : String(row[key] || '-').substring(0, 50)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {drillDown.data.length > 50 && (
                    <p className={clsx('text-sm text-center py-2', theme.contentTextMuted)}>
                      ... ve {drillDown.data.length - 50} satır daha
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className={theme.contentTextMuted}>Veri bulunamadı</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={clsx('p-8 rounded-2xl', theme.cardBg)}>
        <div className="flex items-center gap-4 mb-4">
          <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-orange-500/20' : 'bg-orange-100')}>
            <PieChartIcon size={32} className={isDark ? 'text-orange-400' : 'text-orange-600'} />
          </div>
          <div>
            <h1 className={clsx('text-3xl font-black tracking-tight', theme.contentText)}>Detaylı Analiz Merkezi</h1>
            <p className={clsx('font-medium', theme.contentTextMuted)}>Derinlemesine raporlar ve özel analiz panoları.</p>
          </div>
        </div>
      </div>

      {/* Kaydedilen Tasarımlar */}
      {savedDesigns.length > 0 && (
        <>
          <h2 className={clsx('text-xl font-bold', theme.contentText)}>
            Kaydedilen Analizlerim
            <span className={clsx('ml-2 text-sm font-normal', theme.contentTextMuted)}>({savedDesigns.length})</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {savedDesigns.map(design => (
              <div
                key={design.id}
                onClick={() => handleSelectDesign(design)}
                className={clsx(
                  'p-6 rounded-2xl transition-all cursor-pointer group relative overflow-hidden border-2',
                  theme.cardBg,
                  theme.cardHover,
                  'hover:-translate-y-1',
                  isDark ? 'border-indigo-500/30' : 'border-indigo-200'
                )}
              >
                <div className={clsx(
                  'absolute top-0 right-0 w-24 h-24 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-500',
                  'bg-gradient-to-br from-indigo-500/20 to-purple-500/20'
                )} />

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <span className={clsx('px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider bg-indigo-500/20 text-indigo-400')}>
                      {design.layoutConfig?.widgets?.length || 0} Widget
                    </span>
                    <div className={clsx('p-2 rounded-xl transition-colors', theme.buttonSecondary, 'group-hover:text-indigo-500')}>
                      <ArrowRight size={20} />
                    </div>
                  </div>

                  <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-indigo-500 to-purple-500')}>
                    <BarChart3 size={24} className="text-white" />
                  </div>

                  <h3 className={clsx('text-xl font-bold mb-2 transition-colors', theme.contentText, 'group-hover:text-indigo-500')}>
                    {design.name}
                  </h3>
                  <p className={clsx('text-sm font-medium line-clamp-2', theme.contentTextMuted)}>
                    {design.description || 'Özel analiz tasarımı'}
                  </p>

                  <div className={clsx('mt-6 pt-4 flex items-center text-xs font-bold', isDark ? 'border-t border-slate-800' : 'border-t border-slate-100', theme.contentTextMuted)}>
                    <LayoutTemplate size={14} className="mr-2" />
                    Kaydedilen Tasarım
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Demo Rapor Kartları */}
      <h2 className={clsx('text-xl font-bold', theme.contentText)}>Hazır Raporlar</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {demoReports.map(report => (
          <div
            key={report.id}
            onClick={() => setSelectedReport(report.id)}
            className={clsx(
              'p-6 rounded-2xl transition-all cursor-pointer group relative overflow-hidden',
              theme.cardBg,
              theme.cardHover,
              'hover:-translate-y-1'
            )}
          >
            <div className={clsx(
              'absolute top-0 right-0 w-24 h-24 rounded-full -mr-10 -mt-10 opacity-50 group-hover:scale-150 transition-transform duration-500',
              isDark ? 'bg-indigo-500/10' : 'bg-indigo-100'
            )} />

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-4">
                <span className={clsx('px-3 py-1 text-xs font-bold rounded-lg uppercase tracking-wider', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>
                  {report.metrics} Metrik
                </span>
                <div className={clsx('p-2 rounded-xl transition-colors', theme.buttonSecondary, 'group-hover:text-indigo-500')}>
                  <ArrowRight size={20} />
                </div>
              </div>

              <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br', report.color)}>
                <report.icon size={24} className="text-white" />
              </div>

              <h3 className={clsx('text-xl font-bold mb-2 transition-colors', theme.contentText, 'group-hover:text-indigo-500')}>
                {report.title}
              </h3>
              <p className={clsx('text-sm font-medium line-clamp-2', theme.contentTextMuted)}>{report.description}</p>

              <div className={clsx('mt-6 pt-4 flex items-center text-xs font-bold', isDark ? 'border-t border-slate-800' : 'border-t border-slate-100', theme.contentTextMuted)}>
                <LayoutTemplate size={14} className="mr-2" />
                Son Güncelleme: {new Date(report.lastUpdated).toLocaleDateString('tr-TR')}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Yükleniyor */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Boş durum - kullanıcıya özel rapor yoksa */}
      {savedDesigns.length === 0 && !loading && (
        <div className={clsx('border-2 border-dashed rounded-2xl p-8 text-center', isDark ? 'border-slate-800' : 'border-slate-200')}>
          <PieChartIcon size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
          <p className={clsx('font-bold text-lg', theme.contentTextMuted)}>Henüz kaydedilmiş analiz tasarımınız yok.</p>
          <p className={clsx('text-sm mt-2', theme.contentTextMuted)}>
            Tasarım Stüdyosu'ndan yeni bir tasarım oluşturup "Detaylı Analiz" olarak kaydedin.
          </p>
        </div>
      )}
    </div>
  )
}
