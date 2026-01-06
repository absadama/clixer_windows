import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTheme } from '../components/Layout'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import FilterBar from '../components/FilterBar'
import { 
  Wallet, 
  Settings, 
  PieChart, 
  TrendingUp, 
  AlertCircle,
  Zap,
  Building,
  DollarSign,
  Users,
  Save,
  Loader2,
  Check
} from 'lucide-react'
import clsx from 'clsx'
import { FinancialSettings } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`

// Store tipi
interface StoreItem {
  id: string
  code: string
  name: string
  store_type?: string
  region_name?: string
}

// Varsayılan finansal ayarlar
const defaultSettings: FinancialSettings = {
  rent_amount: 85000,
  turnover_rent_share_percent: 8,
  common_area_expenses: 12000,
  other_expenses: 8000,
  royalty_percent: 5,
  marketing_percent: 3,
  target_cogs_percent: 35,
  other_percent_1: 0,
  other_percent_2: 0,
  electricity_budget: 15000,
  water_budget: 3000,
  staff_manager_count: 1,
  staff_manager_salary: 45000,
  staff_kitchen_count: 4,
  staff_kitchen_salary: 25000,
  staff_service_count: 6,
  staff_service_salary: 22000,
  staff_courier_count: 2,
  staff_courier_salary: 20000,
  investment_amount: 1500000,
  investment_date: '2024-12-08',
}

export default function FinancePage() {
  const { theme, isDark } = useTheme()
  const { accessToken, user } = useAuthStore()
  const { canViewFinanceSection, loadSettings, isLoaded } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings'>('dashboard')
  const [stores, setStores] = useState<StoreItem[]>([])
  const [selectedStoreCode, setSelectedStoreCode] = useState('')
  const [settings, setSettings] = useState<FinancialSettings>(defaultSettings)
  const [simulatedRevenue, setSimulatedRevenue] = useState(465034)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  
  // Pozisyon kodu
  const positionCode = user?.positionCode || 'VIEWER'
  
  // Yönetici mi? (Tüm mağazaları görebilir)
  const isManager = ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER'].includes(positionCode)
  
  // Ayarları yükle
  useEffect(() => {
    if (accessToken && !isLoaded) {
      loadSettings(accessToken)
    }
  }, [accessToken, isLoaded, loadSettings])
  
  // Kullanıcının mağazalarını yükle
  useEffect(() => {
    const loadUserStores = async () => {
      if (!accessToken) return
      
      try {
        // Yöneticiyse tüm mağazaları, değilse sadece atanmış mağazaları al
        if (isManager) {
          // Tüm mağazaları API'den getir
          const response = await fetch(`${API_BASE}/core/stores`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          if (response.ok) {
            const result = await response.json()
            const allStores = result.data || []
            const mappedStores = allStores.map((s: any) => ({
              id: s.id,
              code: s.code,
              name: s.name,
              store_type: s.store_type,
              region_name: s.region_name
            }))
            setStores(mappedStores)
            if (mappedStores.length > 0) {
              setSelectedStoreCode(mappedStores[0].code)
            }
          }
        } else if (user?.id) {
          // Kullanıcının atanmış mağazalarını getir
          const response = await fetch(`${API_BASE}/core/users/${user.id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          if (response.ok) {
            const result = await response.json()
            const userStores = result.data?.stores || []
            if (userStores.length > 0) {
              const mappedStores = userStores.map((s: any) => ({
                id: s.store_id,
                code: s.store_code || s.store_id,
                name: s.store_name,
                store_type: s.store_type,
                region_name: s.region_name
              }))
              setStores(mappedStores)
              setSelectedStoreCode(mappedStores[0].code)
            } else {
              setStores([])
              setSelectedStoreCode('')
            }
          }
        }
      } catch (err) {
        console.error('Mağazalar yüklenemedi:', err)
      }
    }
    
    loadUserStores()
  }, [accessToken, user?.id, isManager])
  
  // Pozisyon bazlı görünürlük kontrolleri
  const canViewRoi = canViewFinanceSection('roi', positionCode)
  const canViewProfitMargin = canViewFinanceSection('profit_margin', positionCode)
  const canViewExpenseBreakdown = canViewFinanceSection('expense_breakdown', positionCode)
  const canViewAmortizationWarning = canViewFinanceSection('amortization_warning', positionCode)
  const canViewSettings = canViewFinanceSection('settings', positionCode)

  // API çağrısı helper
  const apiCall = useCallback(async (endpoint: string, options: any = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(err.message || 'API hatası')
    }
    return response.json()
  }, [accessToken])

  // Mağaza finansal ayarlarını yükle
  const loadStoreFinance = useCallback(async () => {
    if (!accessToken || !selectedStoreCode) return
    setLoading(true)
    try {
      const result = await apiCall(`/core/store-finance?store_id=${selectedStoreCode}`)
      if (result.data) {
        const data = result.data
        setSettings({
          rent_amount: parseFloat(data.fixed_rent) || 85000,
          turnover_rent_share_percent: parseFloat(data.revenue_share_percent) || 8,
          common_area_expenses: parseFloat(data.common_area_cost) || 12000,
          other_expenses: 0,
          royalty_percent: parseFloat(data.royalty_percent) || 5,
          marketing_percent: parseFloat(data.marketing_percent) || 3,
          target_cogs_percent: parseFloat(data.target_cogs_percent) || 35,
          other_percent_1: 0,
          other_percent_2: 0,
          electricity_budget: parseFloat(data.electricity_budget) || 15000,
          water_budget: parseFloat(data.water_budget) || 3000,
          staff_manager_count: data.manager_count || 1,
          staff_manager_salary: parseFloat(data.manager_salary) || 45000,
          staff_kitchen_count: data.kitchen_count || 4,
          staff_kitchen_salary: parseFloat(data.kitchen_salary) || 25000,
          staff_service_count: data.service_count || 6,
          staff_service_salary: parseFloat(data.service_salary) || 22000,
          staff_courier_count: data.courier_count || 2,
          staff_courier_salary: parseFloat(data.courier_salary) || 20000,
          investment_amount: parseFloat(data.initial_investment) || 0,
          investment_date: data.opening_date ? data.opening_date.split('T')[0] : '',
        })
      } else {
        // Kayıt yoksa varsayılanları kullan
        setSettings(defaultSettings)
      }
    } catch (err) {
      console.error('Finansal ayarlar yüklenemedi:', err)
    } finally {
      setLoading(false)
    }
  }, [accessToken, selectedStoreCode, apiCall])

  // Finansal ayarları kaydet
  const saveStoreFinance = async () => {
    if (!accessToken || !selectedStoreCode) return
    setSaving(true)
    setSaved(false)
    try {
      const store = stores.find(s => s.code === selectedStoreCode)
      await apiCall('/core/store-finance', {
        method: 'POST',
        body: JSON.stringify({
          store_id: selectedStoreCode,
          store_name: store?.name || selectedStoreCode,
          fixed_rent: settings.rent_amount,
          revenue_share_percent: settings.turnover_rent_share_percent,
          common_area_cost: settings.common_area_expenses,
          target_cogs_percent: settings.target_cogs_percent,
          royalty_percent: settings.royalty_percent,
          marketing_percent: settings.marketing_percent,
          electricity_budget: settings.electricity_budget,
          water_budget: settings.water_budget,
          manager_count: settings.staff_manager_count,
          manager_salary: settings.staff_manager_salary,
          kitchen_count: settings.staff_kitchen_count,
          kitchen_salary: settings.staff_kitchen_salary,
          service_count: settings.staff_service_count,
          service_salary: settings.staff_service_salary,
          courier_count: settings.staff_courier_count,
          courier_salary: settings.staff_courier_salary,
          initial_investment: settings.investment_amount,
          opening_date: settings.investment_date || null
        })
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      alert('Kaydetme hatası: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  // Mağaza değiştiğinde ayarları yükle
  useEffect(() => {
    loadStoreFinance()
  }, [loadStoreFinance])

  // P&L Hesaplamaları
  const pnl = useMemo(() => {
    const revenue = simulatedRevenue
    const cogs = revenue * (settings.target_cogs_percent / 100)
    const grossProfit = revenue - cogs

    const variableRent = revenue * (settings.turnover_rent_share_percent / 100)
    const actualRent = Math.max(settings.rent_amount, variableRent)
    const isRentVariable = variableRent > settings.rent_amount

    const royalty = revenue * (settings.royalty_percent / 100)
    const marketing = revenue * (settings.marketing_percent / 100)
    const other1 = revenue * (settings.other_percent_1 / 100)
    const other2 = revenue * (settings.other_percent_2 / 100)

    const personnelCost = 
      (settings.staff_manager_count * settings.staff_manager_salary) +
      (settings.staff_kitchen_count * settings.staff_kitchen_salary) +
      (settings.staff_service_count * settings.staff_service_salary) +
      (settings.staff_courier_count * settings.staff_courier_salary)

    const utilities = settings.electricity_budget + settings.water_budget
    const otherFixedCosts = settings.common_area_expenses + settings.other_expenses

    const totalExpenses = cogs + actualRent + royalty + marketing + other1 + other2 + personnelCost + utilities + otherFixedCosts
    const netProfit = revenue - totalExpenses
    const netProfitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0

    let roiYears = 0
    let roiMonths = 0
    const isProfitable = netProfit > 0

    if (settings.investment_amount > 0 && isProfitable) {
      const monthsToBreakEven = settings.investment_amount / netProfit
      roiYears = Math.floor(monthsToBreakEven / 12)
      roiMonths = Math.ceil(monthsToBreakEven % 12)
    }

    return {
      revenue,
      cogs,
      grossProfit,
      expenses: {
        rent: actualRent,
        isRentVariable,
        variableRentAmount: variableRent,
        royalty,
        marketing,
        other1,
        other2,
        personnel: personnelCost,
        utilities,
        commonArea: settings.common_area_expenses,
        other: settings.other_expenses,
      },
      totalExpenses,
      netProfit,
      netProfitMargin,
      roi: {
        years: roiYears,
        months: roiMonths,
        hasInvestment: settings.investment_amount > 0,
        isProfitable,
      },
    }
  }, [simulatedRevenue, settings])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Global Filter Bar */}
      <FilterBar />
      
      {/* Header */}
      <div className={clsx('flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl', theme.cardBg)}>
        <div className="flex items-center gap-4">
          <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br shadow-lg', theme.accent)}>
            <Wallet size={24} className="text-white" />
          </div>
          <div>
            <h1 className={clsx('text-2xl font-bold', theme.contentText)}>Finansal Şeffaflık & Karlılık</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Yatırımcı Gözüyle ROI ve P&L Simülasyonu</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <select
            value={selectedStoreCode}
            onChange={(e) => setSelectedStoreCode(e.target.value)}
            className={clsx('flex-1 min-w-0 md:flex-none md:w-auto px-3 py-2 rounded-xl text-sm font-medium border truncate', theme.inputBg, theme.inputText)}
          >
            {stores.length === 0 ? (
              <option value="">Mağaza atanmamış</option>
            ) : (
              stores.map(store => (
                <option key={store.code} value={store.code}>
                  {store.name} {store.store_type && `(${store.store_type})`}
                </option>
              ))
            )}
          </select>

          <div className={clsx('flex rounded-xl p-1 flex-shrink-0', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                activeTab === 'dashboard' ? theme.buttonPrimary : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
              )}
            >
              <PieChart size={16} />
              P&L Analizi
            </button>
            {/* Ayarlar tab - Sadece yetkili pozisyonlar görebilir */}
            {canViewSettings && (
              <button
                onClick={() => setActiveTab('settings')}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  activeTab === 'settings' ? theme.buttonPrimary : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
                )}
              >
                <Settings size={16} />
                Ayarlar
              </button>
            )}
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' ? (
        <>
          {/* Simülasyon Modu */}
          <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-amber-500" />
                <div>
                  <h3 className={clsx('font-bold', theme.contentText)}>Simülasyon Modu</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Aylık ciroyu değiştirerek karlılık ve ROI üzerindeki etkiyi analiz edin.</p>
                </div>
              </div>
              <div className="text-right">
                <p className={clsx('text-xs uppercase tracking-wide mb-1', theme.contentTextMuted)}>Simüle Edilen Ciro</p>
                <p className={clsx('text-2xl font-bold', theme.contentText)}>{formatCurrency(simulatedRevenue)}</p>
              </div>
            </div>
            <div className="mt-4">
              <input
                type="range"
                min={100000}
                max={3000000}
                step={10000}
                value={simulatedRevenue}
                onChange={(e) => setSimulatedRevenue(Number(e.target.value))}
                className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                style={{
                  background: isDark 
                    ? 'linear-gradient(to right, #4f46e5, #3b82f6)' 
                    : 'linear-gradient(to right, #e2e8f0, #e2e8f0)'
                }}
              />
              <div className={clsx('flex justify-between text-xs mt-1', theme.contentTextMuted)}>
                <span>100.000 ₺</span>
                <span>3.000.000 ₺</span>
              </div>
            </div>
          </div>

          {/* Kritik Uyarı - Sadece yetkili pozisyonlar görebilir */}
          {!pnl.roi.isProfitable && canViewAmortizationWarning && (
            <div className={clsx('p-6 rounded-2xl border flex items-start gap-4', theme.error)}>
              <div className={clsx('p-3 rounded-xl', isDark ? 'bg-rose-500/20' : 'bg-rose-100')}>
                <AlertCircle size={24} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-wider mb-1">⚠ KRİTİK UYARI</p>
                <h3 className={clsx('text-2xl font-bold mb-2', theme.contentText)}>Amorti Edilemiyor</h3>
                <p className={clsx(theme.contentTextMuted)}>
                  Mevcut ciro ve gider yapısıyla işletme <span className="font-bold text-rose-500">zarar etmektedir ({formatCurrency(pnl.netProfit)}/ay)</span>.
                  Yatırım geri dönüşü hesaplanamaz. Lütfen ciro hedefini artırın veya giderleri optimize edin.
                </p>
              </div>
              <div className={clsx('p-4 rounded-xl text-right', isDark ? 'bg-slate-800' : 'bg-white')}>
                <p className={clsx('text-xs mb-1', theme.contentTextMuted)}>Açılış Tarihi</p>
                <p className={clsx('text-lg font-bold', theme.contentText)}>{settings.investment_date ? new Date(settings.investment_date).toLocaleDateString('tr-TR') : '-'}</p>
                <p className={clsx('text-xs mt-2', theme.contentTextMuted)}>İlk Yatırım</p>
                <p className="text-lg font-bold text-amber-500">{formatCurrency(settings.investment_amount)}</p>
              </div>
            </div>
          )}

          {/* KPI Kartları - Pozisyon bazlı */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Tahmini Ciro (Aylık)', value: pnl.revenue, color: theme.contentText, bg: theme.cardBg, visible: true },
              { label: 'Toplam Gider', value: pnl.totalExpenses, color: 'text-orange-500', bg: isDark ? 'bg-orange-500/10' : 'bg-orange-50', visible: canViewExpenseBreakdown },
              { label: 'Net Kar (EBITDA)', value: pnl.netProfit, color: pnl.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: pnl.netProfit >= 0 ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-rose-500/10' : 'bg-rose-50'), visible: true },
              { label: 'Kar Marjı', value: `%${pnl.netProfitMargin.toFixed(1)}`, isPercent: true, color: pnl.netProfitMargin >= 0 ? 'text-emerald-500' : 'text-rose-500', bg: pnl.netProfitMargin >= 0 ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-rose-500/10' : 'bg-rose-50'), visible: canViewProfitMargin },
            ].filter(kpi => kpi.visible).map((kpi, index) => (
              <div key={index} className={clsx('p-6 rounded-2xl border', isDark ? 'border-slate-800' : 'border-slate-200', kpi.bg)}>
                <p className={clsx('text-xs uppercase tracking-wider font-bold mb-2', theme.contentTextMuted)}>{kpi.label}</p>
                <p className={clsx('text-3xl font-bold', kpi.color)}>
                  {kpi.isPercent ? kpi.value : formatCurrency(kpi.value as number)}
                </p>
              </div>
            ))}
          </div>

          {/* ROI Bilgisi - Kritik Metrik (Yukarıda) - Pozisyon kontrolü */}
          {canViewRoi && pnl.roi.hasInvestment && pnl.roi.isProfitable && (
            <div className={clsx('p-6 rounded-2xl border', theme.success)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={clsx('p-3 rounded-xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                    <TrendingUp size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">Yatırım Geri Dönüş Süresi (ROI)</p>
                    <p className={clsx('text-3xl font-bold', theme.contentText)}>
                      {pnl.roi.years > 0 && `${pnl.roi.years} Yıl `}
                      {pnl.roi.months} Ay
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={clsx('text-xs', theme.contentTextMuted)}>İlk Yatırım</p>
                  <p className="text-xl font-bold text-amber-500">{formatCurrency(settings.investment_amount)}</p>
                  <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Aylık Net Kar</p>
                  <p className="text-lg font-bold text-emerald-500">+{formatCurrency(pnl.netProfit)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Gelir Tablosu ve Gider Dağılımı - Pozisyon bazlı */}
          <div className={clsx('grid gap-6', canViewExpenseBreakdown ? 'grid-cols-1 lg:grid-cols-5' : 'grid-cols-1')}>
            {/* Gelir Tablosu */}
            <div className={clsx(canViewExpenseBreakdown ? 'lg:col-span-3' : '', 'rounded-2xl overflow-hidden', theme.cardBg)}>
              <div className={clsx('p-6 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
                <h3 className={clsx('font-bold text-lg', theme.contentText)}>Gelir Tablosu Detayı</h3>
              </div>
              <div className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentText)}>Toplam Satış Geliri</span>
                  <span className={clsx('font-bold', theme.contentText)}>{formatCurrency(pnl.revenue)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className="text-rose-500">Mal Maliyeti (COGS - %{settings.target_cogs_percent})</span>
                  <span className="font-bold text-rose-500">-{formatCurrency(pnl.cogs)}</span>
                </div>
                <div className={clsx('flex justify-between px-6 py-4', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                  <span className={clsx('font-bold', theme.contentText)}>Brüt Kar</span>
                  <span className={clsx('font-bold', theme.contentText)}>{formatCurrency(pnl.grossProfit)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentTextMuted)}>Kira Gideri {pnl.expenses.isRentVariable && <span className="text-xs text-amber-500">(Ciroya dayalı)</span>}</span>
                  <span className={clsx(theme.contentText)}>-{formatCurrency(pnl.expenses.rent)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentTextMuted)}>Personel Gideri</span>
                  <span className={clsx(theme.contentText)}>-{formatCurrency(pnl.expenses.personnel)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentTextMuted)}>Royalty (%{settings.royalty_percent})</span>
                  <span className={clsx(theme.contentText)}>-{formatCurrency(pnl.expenses.royalty)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentTextMuted)}>Pazarlama (%{settings.marketing_percent})</span>
                  <span className={clsx(theme.contentText)}>-{formatCurrency(pnl.expenses.marketing)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentTextMuted)}>Utilities (Elektrik + Su)</span>
                  <span className={clsx(theme.contentText)}>-{formatCurrency(pnl.expenses.utilities)}</span>
                </div>
                <div className="flex justify-between px-6 py-4">
                  <span className={clsx(theme.contentTextMuted)}>Diğer Giderler</span>
                  <span className={clsx(theme.contentText)}>-{formatCurrency(pnl.expenses.commonArea + pnl.expenses.other)}</span>
                </div>
                <div className={clsx('flex justify-between px-6 py-4', pnl.netProfit >= 0 ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (isDark ? 'bg-rose-500/10' : 'bg-rose-50'))}>
                  <span className={clsx('font-bold', theme.contentText)}>Net Kar (EBITDA)</span>
                  <span className={clsx('font-bold text-xl', pnl.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                    {formatCurrency(pnl.netProfit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Gider Dağılımı - Sadece yetkili pozisyonlar görebilir */}
            {canViewExpenseBreakdown && (
              <div className={clsx('lg:col-span-2 rounded-2xl p-6', theme.cardBg)}>
                <h3 className={clsx('font-bold text-lg mb-6', theme.contentText)}>Gider Dağılımı</h3>
                
                <div className="relative w-48 h-48 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 via-blue-500 to-cyan-500" />
                  <div className={clsx('absolute inset-4 rounded-full flex items-center justify-center', isDark ? 'bg-slate-900' : 'bg-white')}>
                    <div className="text-center">
                      <p className={clsx('text-xs', theme.contentTextMuted)}>TOPLAM GİDER</p>
                      <p className={clsx('text-lg font-bold', theme.contentText)}>{formatCurrency(pnl.totalExpenses)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    { label: 'Mal Maliyeti', value: pnl.cogs, color: 'bg-rose-500' },
                    { label: 'Personel', value: pnl.expenses.personnel, color: 'bg-orange-500' },
                    { label: 'Kira', value: pnl.expenses.rent, color: 'bg-amber-500' },
                    { label: 'Royalty + Paz.', value: pnl.expenses.royalty + pnl.expenses.marketing, color: 'bg-blue-500' },
                    { label: 'Utilities + Diğer', value: pnl.expenses.utilities + pnl.expenses.commonArea + pnl.expenses.other, color: 'bg-violet-500' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={clsx('w-3 h-3 rounded-full', item.color)} />
                        <span className={clsx('text-sm', theme.contentTextMuted)}>{item.label}</span>
                      </div>
                      <span className={clsx('text-sm font-bold', theme.contentText)}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </>
      ) : canViewSettings ? (
        /* Settings Tab - Sadece yetkili pozisyonlar görebilir */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
            <h3 className={clsx('font-bold text-lg mb-6 flex items-center gap-2', theme.contentText)}>
              <Building size={20} className="text-indigo-500" />
              Operasyonel Giderler
            </h3>
            <div className="space-y-4">
              <InputField label="Sabit Kira" value={settings.rent_amount} onChange={(v) => setSettings({...settings, rent_amount: v})} suffix="₺" theme={theme}  />
              <InputField label="Ciro Kira Payı" value={settings.turnover_rent_share_percent} onChange={(v) => setSettings({...settings, turnover_rent_share_percent: v})} suffix="%" theme={theme}  />
              <InputField label="Ortak Alan Gideri" value={settings.common_area_expenses} onChange={(v) => setSettings({...settings, common_area_expenses: v})} suffix="₺" theme={theme}  />
              <InputField label="Hedef COGS" value={settings.target_cogs_percent} onChange={(v) => setSettings({...settings, target_cogs_percent: v})} suffix="%" theme={theme}  />
              <InputField label="Royalty" value={settings.royalty_percent} onChange={(v) => setSettings({...settings, royalty_percent: v})} suffix="%" theme={theme}  />
              <InputField label="Pazarlama" value={settings.marketing_percent} onChange={(v) => setSettings({...settings, marketing_percent: v})} suffix="%" theme={theme}  />
              <InputField label="Elektrik Bütçesi" value={settings.electricity_budget} onChange={(v) => setSettings({...settings, electricity_budget: v})} suffix="₺" theme={theme}  />
              <InputField label="Su Bütçesi" value={settings.water_budget} onChange={(v) => setSettings({...settings, water_budget: v})} suffix="₺" theme={theme}  />
            </div>
          </div>

          <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
            <h3 className={clsx('font-bold text-lg mb-6 flex items-center gap-2', theme.contentText)}>
              <Users size={20} className="text-blue-500" />
              Personel Giderleri
            </h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Müdür Sayısı" value={settings.staff_manager_count} onChange={(v) => setSettings({...settings, staff_manager_count: v})} theme={theme}  />
                <InputField label="Müdür Maaşı" value={settings.staff_manager_salary} onChange={(v) => setSettings({...settings, staff_manager_salary: v})} suffix="₺" theme={theme}  />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Mutfak Sayısı" value={settings.staff_kitchen_count} onChange={(v) => setSettings({...settings, staff_kitchen_count: v})} theme={theme}  />
                <InputField label="Mutfak Maaşı" value={settings.staff_kitchen_salary} onChange={(v) => setSettings({...settings, staff_kitchen_salary: v})} suffix="₺" theme={theme}  />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Servis Sayısı" value={settings.staff_service_count} onChange={(v) => setSettings({...settings, staff_service_count: v})} theme={theme}  />
                <InputField label="Servis Maaşı" value={settings.staff_service_salary} onChange={(v) => setSettings({...settings, staff_service_salary: v})} suffix="₺" theme={theme}  />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Kurye Sayısı" value={settings.staff_courier_count} onChange={(v) => setSettings({...settings, staff_courier_count: v})} theme={theme}  />
                <InputField label="Kurye Maaşı" value={settings.staff_courier_salary} onChange={(v) => setSettings({...settings, staff_courier_salary: v})} suffix="₺" theme={theme}  />
              </div>
              
              <div className={clsx('pt-4 border-t', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <div className="flex justify-between">
                  <span className={clsx(theme.contentTextMuted)}>Toplam Personel Maliyeti</span>
                  <span className={clsx('font-bold', theme.contentText)}>{formatCurrency(pnl.expenses.personnel)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
            <h3 className={clsx('font-bold text-lg mb-6 flex items-center gap-2', theme.contentText)}>
              <DollarSign size={20} className="text-amber-500" />
              Yatırım & ROI
            </h3>
            <div className="space-y-4">
              <InputField label="İlk Yatırım Tutarı" value={settings.investment_amount} onChange={(v) => setSettings({...settings, investment_amount: v})} suffix="₺" theme={theme}  />
              <div>
                <label className={clsx('block text-xs mb-1', theme.contentTextMuted)}>Açılış Tarihi</label>
                <input
                  type="date"
                  value={settings.investment_date || ''}
                  onChange={(e) => setSettings({...settings, investment_date: e.target.value})}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>

              <div className={clsx('pt-4 mt-4 border-t space-y-3', isDark ? 'border-slate-700' : 'border-slate-200')}>
                <div className="flex justify-between">
                  <span className={clsx(theme.contentTextMuted)}>Aylık Net Kar</span>
                  <span className={clsx('font-bold', pnl.netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
                    {formatCurrency(pnl.netProfit)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={clsx(theme.contentTextMuted)}>Geri Dönüş Süresi</span>
                  <span className={clsx('font-bold', theme.contentText)}>
                    {pnl.roi.isProfitable 
                      ? `${pnl.roi.years > 0 ? `${pnl.roi.years} Yıl ` : ''}${pnl.roi.months} Ay`
                      : 'Hesaplanamıyor'}
                  </span>
                </div>
              </div>

              {/* Kaydet Butonu */}
              <button
                onClick={saveStoreFinance}
                disabled={saving || loading}
                className={clsx(
                  'w-full mt-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all',
                  saved 
                    ? 'bg-emerald-500 text-white' 
                    : theme.buttonPrimary
                )}
              >
                {saving ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Kaydediliyor...
                  </>
                ) : saved ? (
                  <>
                    <Check size={18} />
                    Kaydedildi!
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    {stores.find(s => s.code === selectedStoreCode)?.name || 'Mağaza'} için Kaydet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Yetkisiz kullanıcıya mesaj */
        <div className={clsx('p-8 rounded-2xl text-center', theme.cardBg)}>
          <Settings size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
          <h3 className={clsx('text-lg font-bold mb-2', theme.contentText)}>Erişim Kısıtlı</h3>
          <p className={clsx(theme.contentTextMuted)}>
            Bu ayarlara erişim yetkiniz bulunmamaktadır. Yetki almak için yöneticinizle iletişime geçin.
          </p>
        </div>
      )}
    </div>
  )
}

function InputField({ 
  label, 
  value, 
  onChange, 
  suffix,
  theme
}: { 
  label: string
  value: number
  onChange: (val: number) => void
  suffix?: string
  theme: any
}) {
  return (
    <div>
      <label className={clsx('block text-xs mb-1', theme.contentTextMuted)}>{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          onFocus={(e) => e.target.select()}
          className={clsx('w-full px-3 py-2 rounded-xl text-sm border pr-8', theme.inputBg, theme.inputText)}
        />
        {suffix && (
          <span className={clsx('absolute right-3 top-1/2 -translate-y-1/2 text-sm', theme.contentTextMuted)}>{suffix}</span>
        )}
      </div>
    </div>
  )
}
