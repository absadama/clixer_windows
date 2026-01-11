import React, { useEffect, useState, useMemo } from 'react'
import { useDashboardStore } from '../stores/dashboardStore'
import { useAuthStore } from '../stores/authStore'
import { useFilterStore } from '../stores/filterStore'
import { useTheme } from '../components/Layout'
import FilterBar from '../components/FilterBar'
import { MapErrorBoundary } from '../components/MapErrorBoundary'
import { 
  LayoutDashboard, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Store,
  ArrowUpRight,
  Calendar,
  Filter,
  ChevronLeft,
  ChevronRight,
  // Ek ikonlar - Görselleştirme için
  BarChart3,
  LineChart,
  PieChart,
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
  Loader,
  Package,
  Percent,
  AlertCircle
} from 'lucide-react'
import clsx from 'clsx'
import { enrichWithCoordinates, getCoordinatesOffline } from '../services/geographicApi'
import { Sparklines, SparklinesLine, SparklinesSpots } from 'react-sparklines'
import { 
  BarChart, 
  Bar, 
  LineChart as RechartsLineChart, 
  Line, 
  AreaChart, 
  Area, 
  PieChart as RechartsPieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ScatterChart, Scatter, ZAxis,
  Treemap,
  FunnelChart, Funnel, LabelList
} from 'recharts'

// İkon haritası - Metrik ikonlarını component'lere eşle
const iconMap: Record<string, React.ComponentType<any>> = {
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Database, Zap,
  ArrowUp, ArrowDown, Minus, Loader, DollarSign, ShoppingCart, Users,
  Store, Package, Percent, AlertCircle, Calendar, RefreshCw
}

// Renk paleti
const CHART_COLORS = ['#14B8A6', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#EC4899', '#6366F1']

// Responsive hook
const useWindowSize = () => {
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
  })

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth })
    }
    
    window.addEventListener('resize', handleResize)
    handleResize()
    
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return windowSize
}


export default function DashboardPage() {
  const { designs, currentDesign, widgets, isLoading, lastUpdated, fetchDesigns, selectDesign, fetchDashboardData } = useDashboardStore()
  const { accessToken, user } = useAuthStore()
  const { startDate, endDate, datePreset, selectedRegionId, selectedStoreIds, selectedGroupId, groups } = useFilterStore()
  const [showDesignSelector, setShowDesignSelector] = useState(false)
  
  // Mağaza seçimlerini stabil string'e çevir - useEffect dependency için
  // sort() ile sıralama yaparak aynı mağazaların farklı sırada seçilmesinde gereksiz fetch'i önle
  const storeIdsKey = useMemo(() => [...selectedStoreIds].sort().join(','), [selectedStoreIds])
  const { theme, isDark, currentTheme } = useTheme()
  const { width } = useWindowSize()
  
  // Pagination state for each widget
  const [widgetPages, setWidgetPages] = useState<Record<string, number>>({})
  
  // Responsive breakpoints
  const isMobile = width < 768
  const isTablet = width >= 768 && width < 1024

  // Kullanıcı pozisyon kodu
  const userPositionCode = user?.positionCode || 'VIEWER'

  // Pozisyon bazlı tasarım filtreleme
  const getAccessibleDesigns = () => {
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

  const accessibleDesigns = getAccessibleDesigns()

  useEffect(() => {
    // Token hazır olduğunda API çağrısı yap
    if (accessToken) {
    fetchDesigns()
    }
  }, [fetchDesigns, accessToken])

  // Filtreler değiştiğinde verileri yeniden yükle (tarih, bölge, mağaza, tip)
  // Debounce ile çoklu mağaza seçiminde gereksiz istekleri önle
  useEffect(() => {
    if (currentDesign && accessToken) {
      const timeoutId = setTimeout(() => {
        console.log('[DashboardPage] Filters changed, refetching...', { startDate, endDate, storeCount: selectedStoreIds.length, storeIdsKey })
        fetchDashboardData(currentDesign.id)
      }, 300) // 300ms debounce - kullanıcı mağaza seçmeyi bitirene kadar bekle
      
      return () => clearTimeout(timeoutId)
    }
  // storeIdsKey: useMemo ile hesaplanan stabil string - mağaza değişikliklerini doğru yakalar
  }, [startDate, endDate, selectedRegionId, storeIdsKey, selectedGroupId, currentDesign?.id, fetchDashboardData, accessToken])

  useEffect(() => {
    // URL'den designId parametresini oku
    const urlParams = new URLSearchParams(window.location.search);
    const urlDesignId = urlParams.get('designId');
    
    // Kokpit tipi ve ERİŞİLEBİLİR tasarımları filtrele
    const cockpitDesigns = accessibleDesigns.filter(d => d.type === 'cockpit')
    
    if (urlDesignId) {
      // URL'de designId varsa, o tasarımı seç (erişilebilir olmalı)
      const targetDesign = cockpitDesigns.find(d => d.id === urlDesignId);
      if (targetDesign) {
        selectDesign(urlDesignId);
        // URL'den parametreyi temizle (history'yi bozmadan)
        window.history.replaceState({}, '', window.location.pathname);
      } else if (cockpitDesigns.length > 0 && !currentDesign) {
        selectDesign(cockpitDesigns[0].id);
      }
    } else if (cockpitDesigns.length > 0 && !currentDesign) {
      selectDesign(cockpitDesigns[0].id)
    }
  }, [accessibleDesigns, currentDesign, selectDesign])

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; text: string; icon: string }> = {
      indigo: { 
        bg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50', 
        text: isDark ? 'text-indigo-400' : 'text-indigo-600', 
        icon: 'bg-gradient-to-br from-indigo-500 to-indigo-600' 
      },
      blue: { 
        bg: isDark ? 'bg-blue-500/10' : 'bg-blue-50', 
        text: isDark ? 'text-blue-400' : 'text-blue-600', 
        icon: 'bg-gradient-to-br from-blue-500 to-cyan-500' 
      },
      emerald: { 
        bg: isDark ? 'bg-emerald-500/10' : 'bg-emerald-50', 
        text: isDark ? 'text-emerald-400' : 'text-emerald-600', 
        icon: 'bg-gradient-to-br from-emerald-500 to-teal-500' 
      },
      amber: { 
        bg: isDark ? 'bg-amber-500/10' : 'bg-amber-50', 
        text: isDark ? 'text-amber-400' : 'text-amber-600', 
        icon: 'bg-gradient-to-br from-amber-500 to-orange-500' 
      },
    }
    return colors[color] || colors.indigo
  }

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Global Filter Bar */}
      <FilterBar />

      {/* Header - Detaylı Analiz ile aynı format */}
      {currentDesign && (
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl">
              <LayoutDashboard size={24} className="text-white" />
          </div>
          <div>
              <h1 className={clsx('text-2xl font-bold', theme.contentText)}>{currentDesign.name}</h1>
              <p className={clsx('text-sm', theme.contentTextMuted)}>
                {currentDesign.description || 'Kokpit tasarımı'} • {widgets.length} Widget
              </p>
            </div>
          </div>
          
          {/* Tasarım Seçici - Birden fazla cockpit varsa göster */}
                {accessibleDesigns.filter(d => d.type === 'cockpit').length > 1 && (
            <div className="relative">
                  <button 
                    onClick={() => setShowDesignSelector(!showDesignSelector)}
                className={clsx('px-4 py-2 rounded-xl text-sm font-medium', theme.buttonSecondary)}
                  >
                    Tasarım Değiştir
                  </button>
            {showDesignSelector && (
                <div className={clsx('absolute right-0 mt-2 z-50 rounded-xl border shadow-xl min-w-48', theme.cardBg, isDark ? 'border-slate-700' : 'border-slate-200')}>
                {accessibleDesigns.filter(d => d.type === 'cockpit').map(design => (
                  <button
                    key={design.id}
                    onClick={() => { selectDesign(design.id); setShowDesignSelector(false); }}
                    className={clsx(
                        'w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700/50 first:rounded-t-xl last:rounded-b-xl',
                      currentDesign?.id === design.id ? (isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600') : theme.contentText
                    )}
                  >
                    {design.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          )}
            </div>
          )}

      {/* Dynamic Widgets from Backend - Responsive Grid Layout */}
      {/* Mobil: auto-fit responsive, Tablet: 12 kolon, Desktop: 24 kolon */}
      {widgets.length > 0 && (
        <div 
          className="relative gap-3 sm:gap-4 overflow-hidden"
          style={isMobile ? {
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)', // Mobilde 2 kolon sabit
            gap: '12px',
          } : {
            display: 'grid',
            gridTemplateColumns: isTablet ? 'repeat(12, 1fr)' : 'repeat(24, 1fr)',
            gridAutoRows: '40px',
            minHeight: '200px',
          }}
        >
        
          {widgets.map((widget) => {
            const bgColor = widget.color || '#3B82F6'
            const chartConfig = (widget as any).chartConfig || (widget as any).chart_config || {}
            const colorMode = chartConfig?.colorMode || 'none'
            const isFullColorMode = colorMode === 'full'
            const isAccentMode = colorMode === 'accent'
            // Grid pozisyonları için CSS Grid kullan (1-indexed)
            const rawX = widget.x || 0
            const rawY = widget.y || 0
            const rawW = widget.w || 6
            const rawH = widget.h || 4
            
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
            
            // Dinamik tarih etiketi oluştur
            const showPeriodLabel = chartConfig?.showPeriodLabel !== false // Varsayılan true
            let periodLabel = widgetData?.period || widgetData?.subtitle || widgetData?.metadata?.period
            if (!periodLabel && startDate && endDate) {
              const formatDate = (d: Date | string) => {
                const date = typeof d === 'string' ? new Date(d) : d
                return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              }
              periodLabel = `${formatDate(startDate)} - ${formatDate(endDate)}`
            }
            if (!periodLabel) periodLabel = 'Son 30 gün'
            
            // Widget'ın ikonunu al (backend'den gelen)
            const widgetIcon = (widget as any).icon || (widget as any).metricIcon || 'BarChart3'
            const IconComponent = iconMap[widgetIcon] || BarChart3
            
            // Görselleştirme tipi (backend'de: type, widgetType veya metric_visualization_type)
            // Metrik oluştururken seçilen görselleştirme tipi HER ZAMAN kullanılmalı
            const metricVizType = (widget as any).metric_visualization_type || (widget as any).metricVisualizationType;
            const widgetType = (widget as any).type || (widget as any).widgetType || (widget as any).visualization_type || (widget as any).visualizationType;
            const vizType = metricVizType || widgetType || 'kpi_card';
            
            // Veri widget.data.data veya widget.data.value içinde olabilir (AnalysisPage ile aynı)
            const chartData = widget.data?.data || (Array.isArray(widget.data?.value) ? widget.data.value : []) || (widgetData as any)?.chartData || [];
            const CHART_COLORS = ['#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444', '#6366F1'];
            
            // Değer - obje/array değilse render et, değilse '-'
            const rawValue = widgetData?.formatted || widgetData?.value;
            const displayValue = (() => {
              if (rawValue === null || rawValue === undefined) return '-';
              if (typeof rawValue === 'string') return rawValue;
              if (typeof rawValue === 'number') return rawValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 });
              if (Array.isArray(rawValue)) return '-'; // Array ise KPI olarak gösterme
              if (typeof rawValue === 'object') return '-'; // Obje ise KPI olarak gösterme
              return String(rawValue);
            })();
            
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
                  minHeight: isMobile ? '100px' : `${gridH * rowHeight + (gridH - 1) * gap}px`,
                  // Renk moduna göre stil - AnalysisPage ile aynı (GRADIENT!)
                  ...(isFullColorMode ? { 
                    // Gradient arka plan - yumuşak geçiş
                    background: `linear-gradient(135deg, ${bgColor} 0%, ${bgColor}99 50%, ${bgColor}66 100%)`,
                    // Clixer temasında gölge yok
                    ...(currentTheme !== 'clixer' && { boxShadow: `0 8px 32px ${bgColor}40` }),
                  } : isAccentMode ? {
                    // Accent modu - üst bar
                    borderTop: `3px solid ${bgColor}`
                  } : {
                    // Sade mod - çizgisiz
                  }),
                }}
              >
                {/* Header - İkon + Detay butonu */}
                <div className="flex items-center justify-between mb-4">
                  <div 
                    className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm"
                    style={{ backgroundColor: bgColor }}
                  >
                    <IconComponent className="h-5 w-5 text-white" />
                  </div>
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
                
                {/* Widget Label */}
                <p className={clsx('text-sm font-medium mb-2 uppercase tracking-wide', isFullColorMode ? 'text-white/80' : theme.contentTextMuted)} title={widget.label}>
                  {widget.label}
                </p>
                
                {/* ============================================ */}
                {/* GÖRSELLEŞTİRME TİPİNE GÖRE RENDER */}
                {/* ============================================ */}
                
                {/* PROGRESS BAR (İlerleme Çubuğu) - AnalysisPage ile aynı */}
                {(vizType === 'progress' || vizType === 'progress_bar') && (() => {
                  const value = typeof widgetData?.value === 'number' ? widgetData.value : 0;
                  const targetObj = (widget as any).target || widgetData?.target;
                  const target = targetObj?.value || (widget as any).target_value || widgetData?.metadata?.target || 100;
                  const percent = targetObj?.progress ?? Math.min(100, Math.max(0, (value / target) * 100));
                  
                  // Full color modda progress bar renkleri
                  const progressBgColor = isFullColorMode ? 'rgba(255,255,255,0.3)' : (isDark ? '#475569' : '#e2e8f0');
                  const progressEmptyColor = isFullColorMode ? 'rgba(255,255,255,0.15)' : (isDark ? '#334155' : '#cbd5e1');
                  const progressFillColor = isFullColorMode ? 'rgba(255,255,255,0.9)' : bgColor;
                  
                  return (
                  <div className="flex-1 flex flex-col justify-center">
                      {/* Ana değer */}
                      <p className={clsx('text-2xl font-bold mb-3', isFullColorMode ? 'text-white' : theme.contentText)}>
                        {value.toLocaleString('tr-TR')}
                      </p>
                      
                      {/* Progress bar */}
                      <div className="flex justify-between text-sm mb-2">
                        <span className={clsx(isFullColorMode ? 'text-white/80' : theme.contentTextMuted)}>İlerleme</span>
                        <span className={clsx('font-semibold', isFullColorMode ? 'text-white' : theme.contentText)}>{percent.toFixed(1)}%</span>
                    </div>
                      <div 
                        className="h-4 rounded-full overflow-hidden relative"
                        style={{ backgroundColor: progressBgColor }}
                      >
                        {/* Dolu kısım */}
                        <div 
                          className="h-full rounded-full transition-all duration-500 relative z-10"
                          style={{ width: `${percent}%`, backgroundColor: progressFillColor }} 
                        />
                        {/* Kalan kısım */}
                        <div 
                          className="absolute top-0 right-0 h-full rounded-r-full"
                          style={{ width: `${100 - percent}%`, backgroundColor: progressEmptyColor }} 
                      />
                    </div>
                      <div className="flex justify-between text-xs mt-2">
                        <span className={clsx(isFullColorMode ? 'text-white/80' : theme.contentTextMuted)}>Güncel: {value.toLocaleString('tr-TR')}</span>
                        <span className={clsx(isFullColorMode ? 'text-white/80' : theme.contentTextMuted)}>Hedef: {target.toLocaleString('tr-TR')}</span>
                      </div>
                    </div>
                  );
                })()}
                
                {/* GAUGE (Gösterge) */}
                {vizType === 'gauge' && (() => {
                  const value = Number(widgetData?.value) || 0;
                  const target = (widget as any).target?.value || (widget as any).target_value || widgetData?.metadata?.target || 100;
                  const percent = Math.min(100, Math.max(0, (value / target) * 100));
                  const radius = 40;
                  const strokeWidth = 8;
                  const circumference = Math.PI * radius;
                  const filledLength = (percent / 100) * circumference;
                  const emptyLength = circumference - filledLength;
                  
                  // Full color modda gauge renkleri
                  const gaugeEmptyColor = isFullColorMode ? 'rgba(255,255,255,0.25)' : (isDark ? '#475569' : '#cbd5e1');
                  const gaugeFillColor = isFullColorMode ? 'rgba(255,255,255,0.9)' : bgColor;
                  
                  return (
                    <div className="flex-1 flex flex-col justify-center">
                      {/* Ana değer - Diğer kartlarla tutarlı */}
                      <p className={clsx('text-2xl font-bold mb-3', isFullColorMode ? 'text-white' : theme.contentText)}>
                        {value.toLocaleString('tr-TR')}
                      </p>
                      
                      {/* Gauge Section */}
                      <div className="flex items-center gap-4">
                        <svg viewBox="0 0 100 55" className="w-20 h-12 flex-shrink-0">
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={gaugeEmptyColor} strokeWidth={strokeWidth} strokeLinecap="round" />
                          <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={gaugeFillColor} strokeWidth={strokeWidth} strokeLinecap="round"
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
                })()}
                
                {/* SPARKLINE (Mini Grafik) - AnalysisPage ile aynı */}
                {vizType === 'sparkline' && (() => {
                  const rawSparkData = (widget as any).sparklineData || widgetData?.sparklineData || widgetData?.data;
                  const sparkData = Array.isArray(rawSparkData) && rawSparkData.length > 0 
                    ? rawSparkData.map((v: any) => Number(v) || 0)
                    : [5, 10, 5, 20, 8, 15, 12, 18, 14, 22, 16, 25];
                  
                  let totalValue: number | null = null;
                  if (typeof widgetData?.value === 'number') {
                    totalValue = widgetData.value;
                  } else if (sparkData.length > 0) {
                    totalValue = sparkData.reduce((sum: number, val: number) => sum + val, 0);
                  }
                  
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
                            {showPeriodLabel && (
                              <span className={clsx('text-xs', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>{periodLabel}</span>
                            )}
                      </div>
                    )}
                  </div>
                      <div className="flex-1 min-h-0 mt-2 max-h-16 overflow-hidden">
                        <Sparklines data={sparkData} margin={4} height={64} style={{ width: '100%', height: '100%' }}>
                        <SparklinesLine color={bgColor} style={{ strokeWidth: 2, fill: 'none' }} />
                        <SparklinesSpots size={2} style={{ fill: bgColor }} />
                      </Sparklines>
                    </div>
                    </div>
                  );
                })()}
                
                {/* TREND CARD - 'trend' veya 'trend_card' olarak gelebilir */}
                {(vizType === 'trend' || vizType === 'trend_card') && (
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    {/* Üst: Değer + Trend */}
                    <div className="flex-shrink-0">
                      <p className={clsx('text-2xl font-bold', isFullColorMode ? 'text-white' : theme.contentText)}>
                        {displayValue}
                      </p>
                    {trendValue !== null && (
                        <div className="flex items-center gap-2 mt-1">
                        <span className={clsx(
                          'text-xs font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1',
                          trendDirection === 'up' 
                            ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' 
                            : 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400'
                        )}>
                          {trendDirection === 'up' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {trendDirection === 'up' ? '+' : ''}{trendValue.toFixed(1)}%
                        </span>
                          {showPeriodLabel && (
                            <span className={clsx('text-xs', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>{periodLabel}</span>
                          )}
                      </div>
                    )}
                  </div>
                    
                    {/* Alt: Trend Grafik */}
                    <div className="flex-1 min-h-0 mt-2 max-h-16 overflow-hidden">
                      <Sparklines data={widgetData?.sparklineData || [5, 10, 5, 20, 8, 15, 12, 18, 14, 22, 16, 25]} margin={4} height={64} style={{ width: '100%', height: '100%' }}>
                        <SparklinesLine color={bgColor} style={{ strokeWidth: 2, fill: 'none' }} />
                      </Sparklines>
                    </div>
                  </div>
                )}
                
                {/* BAR CHART (Çubuk Grafik) - AnalysisPage ile aynı */}
                {vizType === 'bar_chart' && chartData.length > 0 && (() => {
                  // chartData formatını belirle (AnalysisPage ile aynı)
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                  const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || keys[1] || 'value';
                  
                  return (
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff', 
                            border: 'none', 
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }} 
                        />
                          <Bar dataKey={valueKey} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  );
                })()}
                
                {/* LINE CHART (Çizgi Grafik) - AnalysisPage ile aynı */}
                {vizType === 'line_chart' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                  const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || keys[1] || 'value';
                  
                  return (
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <RechartsLineChart data={chartData}>
                          <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff', 
                            border: 'none', 
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }} 
                        />
                          <Line type="monotone" dataKey={valueKey} stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </div>
                  );
                })()}
                
                {/* AREA CHART (Alan Grafik) - AnalysisPage ile aynı */}
                {vizType === 'area_chart' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                  const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || keys[1] || 'value';
                  
                  return (
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <XAxis dataKey={nameKey} tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                        <YAxis tick={{ fontSize: 10, fill: isDark ? '#94a3b8' : '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff', 
                            border: 'none', 
                            borderRadius: '8px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                          }} 
                        />
                          <defs>
                            <linearGradient id={`gradient-${widget.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={CHART_COLORS[0]} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={CHART_COLORS[0]} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey={valueKey} stroke={CHART_COLORS[0]} fill={`url(#gradient-${widget.id})`} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  );
                })()}
                
                {/* PIE CHART (Pasta Grafik) - Responsive - AnalysisPage ile aynı */}
                {(vizType === 'pie_chart' || vizType === 'donut_chart') && chartData.length > 0 && (() => {
                  // chartData'yı PieChart formatına dönüştür (AnalysisPage ile aynı)
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || keys[0];
                  const pieData = chartData.map((item: any, idx: number) => {
                    const valueKey = keys.find(k => typeof item[k] === 'number') || keys[1];
                    // name güvenli string dönüşümü - obje ise JSON.stringify
                    const rawName = item[nameKey];
                    const safeName = (typeof rawName === 'object' && rawName !== null) 
                      ? JSON.stringify(rawName) 
                      : (rawName || `Item ${idx + 1}`);
                    return {
                      name: String(safeName),
                      value: Number(item[valueKey]) || 0,
                      originalData: item
                    };
                  });
                  
                  // Responsive label - sadece içeride yüzde göster
                  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
                    if (percent < 0.05) return null;
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    return (
                      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  };
                  
                  return (
                    <div className="flex-1 flex flex-col min-h-0">
                      <div className="flex-1 min-h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                          <RechartsPieChart margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
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
                        >
                              {pieData.map((_: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip 
                              formatter={(value: number, name: string) => [value.toLocaleString('tr-TR'), name]}
                          contentStyle={{ 
                            backgroundColor: isDark ? '#1e293b' : '#fff', 
                            border: 'none', 
                            borderRadius: '8px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                fontSize: '12px'
                          }} 
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                      {/* Legend - Alt kısımda yatay */}
                      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 px-1 max-h-[60px] overflow-y-auto">
                        {pieData.slice(0, 8).map((item: any, index: number) => (
                          <div key={index} className="flex items-center gap-1 text-xs whitespace-nowrap">
                            <div 
                              className="w-2.5 h-2.5 rounded-sm flex-shrink-0" 
                              style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                            />
                            <span className={isDark ? 'text-slate-400' : 'text-slate-600'} style={{ maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* COMBO CHART (Çubuk + Çizgi) - chartData kullanarak */}
                {vizType === 'combo_chart' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || 'name';
                  const numericKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                  
                  return (
                  <div className="flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <XAxis dataKey={nameKey} tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar yAxisId="left" dataKey={numericKeys[0] || 'value'} fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                          <Line yAxisId="right" type="monotone" dataKey={numericKeys[1] || numericKeys[0] || 'value'} stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  );
                })()}
                
                {/* SCATTER PLOT (Dağılım Grafiği) - chartData kullanarak */}
                {vizType === 'scatter_plot' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const numericKeys = keys.filter(k => typeof chartData[0][k] === 'number');
                  return (
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <XAxis dataKey={numericKeys[0] || 'x'} tick={{ fontSize: 10 }} />
                          <YAxis dataKey={numericKeys[1] || 'y'} tick={{ fontSize: 10 }} />
                          {numericKeys[2] && <ZAxis dataKey={numericKeys[2]} range={[50, 400]} />}
                          <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                          <Scatter data={chartData} fill={CHART_COLORS[0]}>
                            {chartData.map((_: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                
                {/* TREEMAP (Ağaç Haritası) - chartData kullanarak */}
                {vizType === 'treemap' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || 'name';
                  const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || 'value';
                  const treemapData = chartData.map((item: any, idx: number) => ({
                    name: item[nameKey] || `Item ${idx + 1}`,
                    size: Number(item[valueKey]) || 0,
                    fill: CHART_COLORS[idx % CHART_COLORS.length]
                  }));
                  return (
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <Treemap data={treemapData} dataKey="size" stroke="#fff" fill={CHART_COLORS[0]}>
                          <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                        </Treemap>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                
                {/* FUNNEL CHART (Huni Grafiği) - chartData kullanarak */}
                {vizType === 'funnel_chart' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const nameKey = keys.find(k => typeof chartData[0][k] === 'string') || 'name';
                  const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || 'value';
                  const funnelData = chartData.map((item: any, idx: number) => ({
                    name: item[nameKey] || `Aşama ${idx + 1}`,
                    value: Number(item[valueKey]) || 0,
                    fill: CHART_COLORS[idx % CHART_COLORS.length]
                  }));
                  return (
                    <div className="flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <FunnelChart>
                          <Tooltip formatter={(value: number) => value.toLocaleString('tr-TR')} contentStyle={{ backgroundColor: isDark ? '#1e293b' : '#fff', border: 'none', borderRadius: '8px' }} />
                          <Funnel dataKey="value" data={funnelData} isAnimationActive>
                            <LabelList position="center" fill="#fff" stroke="none" fontSize={12} />
                          </Funnel>
                        </FunnelChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
                
                {/* HEATMAP (Isı Haritası) - chartData kullanarak */}
                {vizType === 'heatmap' && chartData.length > 0 && (() => {
                  const keys = Object.keys(chartData[0] || {});
                  const rowKey = keys[0];
                  const colKey = keys[1];
                  const valueKey = keys.find(k => typeof chartData[0][k] === 'number') || keys[2];
                  const values = chartData.map((d: any) => Number(d[valueKey]) || 0);
                  const minVal = Math.min(...values);
                  const maxVal = Math.max(...values);
                  const range = maxVal - minVal || 1;
                  const getColor = (val: number) => {
                    const normalized = (val - minVal) / range;
                    const r = Math.round(255 * normalized);
                    const g = Math.round(100 * (1 - normalized));
                    const b = Math.round(100 * (1 - normalized));
                    return `rgb(${r}, ${g}, ${b})`;
                  };
                  const rows = [...new Set(chartData.map((d: any) => d[rowKey]))];
                  const cols = [...new Set(chartData.map((d: any) => d[colKey]))];
                  return (
                    <div className="flex-1 overflow-auto">
                      <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${cols.length}, 1fr)` }}>
                        <div></div>
                        {cols.map((col: any, i: number) => (
                          <div key={i} className="text-xs text-center truncate p-1">{String(col)}</div>
                        ))}
                        {rows.map((row: any, ri: number) => (
                          <React.Fragment key={ri}>
                            <div className="text-xs truncate p-1">{String(row)}</div>
                            {cols.map((col: any, ci: number) => {
                              const cell = chartData.find((d: any) => d[rowKey] === row && d[colKey] === col);
                              const val = cell ? Number(cell[valueKey]) || 0 : 0;
                              return (
                                <div key={ci} className="rounded text-xs text-white text-center p-1" style={{ backgroundColor: getColor(val) }} title={`${row} / ${col}: ${val.toLocaleString('tr-TR')}`}>
                                  {val > 0 ? (val >= 1000 ? `${(val/1000).toFixed(0)}K` : val) : '-'}
                                </div>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                
                {/* MAP CHART (Harita) - Koordinat zenginleştirme ile */}
                {vizType === 'map_chart' && chartData.length > 0 && (() => {
                  const MapChart = React.lazy(() => import('../components/MapChart'));
                  
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
                    if (pointName === `Nokta ${idx + 1}`) {
                      const firstStringCol = keys.find(k => typeof item[k] === 'string');
                      if (firstStringCol) pointName = item[firstStringCol];
                    }
                    
                    // Koordinatları al
                    let lat = Number(item.lat || item.latitude || item.enlem);
                    let lng = Number(item.lng || item.longitude || item.boylam);
                    
                    if (!lat || !lng) {
                      const coords = getCoordinatesOffline(pointName);
                      if (coords) {
                        lat = coords.lat;
                        lng = coords.lng;
                      } else {
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
                    <div key={`map-${widget.id}-${currentTheme}`} className="flex-1 min-h-0 h-full">
                      <MapErrorBoundary>
                        <React.Suspense fallback={<div className="flex items-center justify-center h-full text-sm text-slate-500">Harita yükleniyor...</div>}>
                          <MapChart key={`mapchart-${widget.id}-${currentTheme}-${Date.now()}`} data={mapData} color={bgColor} showCircles={true} showMarkers={false} />
                        </React.Suspense>
                      </MapErrorBoundary>
                    </div>
                  );
                })()}
                
                {/* COMPARISON (Karşılaştırma) - AnalysisPage ile aynı yapı */}
                {vizType === 'comparison' && (() => {
                  const currentValue = typeof widgetData?.value === 'number' ? widgetData.value : 0;
                  const comparisonData = (widget as any).comparison || {};
                  const previousValue = (widget as any).previousValue || comparisonData.previousValue || widgetData?.previousValue || widgetData?.metadata?.previousValue || 0;
                  const trendFromBackend = (widget as any).trend || comparisonData.trend || widgetData?.metadata?.trend;
                  const compLabel = (widget as any).comparisonLabel || comparisonData.label || widgetData?.metadata?.comparisonLabel || periodLabel;
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
                })()}
                
                {/* RANKING LIST (Sıralama Listesi) - AnalysisPage ile aynı */}
                {(vizType === 'ranking_list' || vizType === 'ranking') && chartData.length > 0 && (() => {
                  // İlk satırdan kolon isimlerini al
                  const columns = Object.keys(chartData[0] || {});
                  
                  // Akıllı kolon tespiti
                  let labelColumn = columns[0];
                  let valueColumn = columns[1] || columns[0];
                  let subtitleColumn: string | null = null;
                  let trendColumn: string | null = null;
                  
                  // Trend kolonunu bul
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
                    if (col === trendColumn) continue;
                    const firstVal = Number(chartData[0][col]);
                    if (!isNaN(firstVal) && firstVal > maxValueFound) {
                      maxValueFound = firstVal;
                      valueColumn = col;
                    }
                  }
                  
                  if (labelColumn === valueColumn && columns.length > 1) {
                    labelColumn = columns.find(c => c !== valueColumn && c !== trendColumn) || columns[0];
                  }
                  
                  const usedColumns = [labelColumn, valueColumn, trendColumn].filter(Boolean);
                  subtitleColumn = columns.find(c => !usedColumns.includes(c)) || null;
                  
                  const maxValue = Math.max(...chartData.map((r: any) => Number(r[valueColumn]) || 0));
                  const topItems = chartData.slice(0, 10);
                  
                  // Sıra badge renkleri
                  const badgeColors = [
                    'bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-lg shadow-yellow-500/30',
                    'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-700 shadow-lg shadow-slate-400/30',
                    'bg-gradient-to-br from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30',
                  ];
                  
                  return (
                    <div className="flex-1 flex flex-col gap-2 overflow-auto">
                      {topItems.map((item: any, idx: number) => {
                        const value = Number(item[valueColumn]) || 0;
                        const subtitle = subtitleColumn ? item[subtitleColumn] : null;
                        const trend = trendColumn ? Number(item[trendColumn]) : null;
                        
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
                                {typeof item[labelColumn] === 'object' ? JSON.stringify(item[labelColumn]) : String(item[labelColumn] || '')}
                              </div>
                              {subtitle !== null && (
                                <div className={clsx('text-xs mt-0.5', theme.contentTextMuted)}>
                                  {typeof subtitle === 'number' 
                                    ? `${subtitle.toLocaleString('tr-TR')} adet` 
                                    : (typeof subtitle === 'object' ? JSON.stringify(subtitle) : String(subtitle))
                                  }
                  </div>
                )}
                            </div>
                            
                            {/* Değer + Trend */}
                            <div className="text-right shrink-0">
                              <div className={clsx('text-sm font-bold tabular-nums', theme.contentText)}>
                                ₺{value.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>
                              {trend !== null && !isNaN(trend) && (
                                <div className={clsx(
                                  'text-xs font-medium mt-0.5 flex items-center justify-end gap-0.5',
                                  trend > 0 ? 'text-emerald-500' : trend < 0 ? 'text-rose-500' : theme.contentTextMuted
                                )}>
                                  {trend > 0 ? <TrendingUp className="h-3 w-3" /> : trend < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                  <span>↗ {Math.abs(trend).toFixed(1)}%</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                
                {/* KPI CARD / BIG NUMBER / DEFAULT - Tablo verisi yoksa - AnalysisPage ile aynı */}
                {(vizType === 'kpi_card' || vizType === 'big_number' || !['progress', 'progress_bar', 'gauge', 'sparkline', 'trend', 'trend_card', 'bar_chart', 'line_chart', 'area_chart', 'pie_chart', 'donut_chart', 'comparison', 'data_table', 'ranking_list', 'ranking', 'combo_chart', 'scatter_plot', 'treemap', 'funnel_chart', 'heatmap', 'map_chart'].includes(vizType)) && chartData.length === 0 && (
                  <div className="flex-1 flex flex-col justify-between min-w-0 overflow-hidden">
                    {/* Büyük Değer - text-2xl (AnalysisPage ile aynı) */}
                    <p className={clsx('text-2xl font-bold mb-2', isFullColorMode ? 'text-white' : theme.contentText)} 
                       title={displayValue}>
                      {displayValue}
                    </p>
                    
                    {/* Alt Kısım: Trend + Dönem */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
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
                      {showPeriodLabel && (
                        <span className={clsx('text-xs font-medium', isFullColorMode ? 'text-white/90' : theme.contentTextMuted)}>{periodLabel}</span>
                      )}
                      </div>
                      
                      {/* Cache indicator */}
                      {widgetData?.cached && (
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full', isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-600')}>
                          ⚡
                        </span>
                      )}
                    </div>
                  </div>
                )}
                
                {/* DATA TABLE / RANKING LIST - Tablo verisi varsa (grafik tipleri hariç!) */}
                {(() => {
                  // Chart ve özel görselleştirme tipleri için tablo gösterme - AnalysisPage ile aynı
                  const skipTableTypes = [
                    'pie_chart', 'donut_chart', 'bar_chart', 'line_chart', 'area_chart',
                    'progress', 'progress_bar', 'gauge', 'sparkline', 'trend', 'trend_card', 'comparison',
                    'ranking_list', 'ranking', 'combo_chart', 'scatter_plot', 'treemap', 'funnel_chart', 'heatmap', 'map_chart', 'kpi_card', 'big_number'
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
                          <table className="w-full">
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
              </div>
            )
          })}
        </div>
      )}

      {/* Widget yoksa boş durum mesajı */}
      {widgets.length === 0 && !currentDesign && (
        <div className={clsx(
          'rounded-[20px] p-12 text-center',
          isDark 
            ? 'bg-slate-800/80 backdrop-blur-sm border border-slate-700/50' 
            : 'bg-white/90 backdrop-blur-sm border border-slate-100'
        )}>
          <BarChart3 className={clsx('w-16 h-16 mx-auto mb-4', theme.contentTextMuted)} />
          <h3 className={clsx('text-xl font-bold mb-2', theme.contentText)}>Kokpit Boş</h3>
          <p className={clsx('text-sm mb-6', theme.contentTextMuted)}>
            Tasarım Stüdyosu'ndan bir dashboard oluşturun veya yukarıdan mevcut bir tasarım seçin.
          </p>
            <button 
            onClick={() => setShowDesignSelector(true)}
            className="px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-500 text-white rounded-xl font-medium hover:opacity-90 transition-opacity"
          >
            Tasarım Seç
            </button>
          </div>
      )}

    </div>
  )
}
