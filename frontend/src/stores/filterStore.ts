/**
 * Clixer - Global Filter Store
 * Tüm sayfalarda kullanılan mağaza/bölge/tarih filtreleri
 */

import { create } from 'zustand'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Tarih seçenekleri
export const DATE_PRESETS = [
  { id: 'all', label: 'Tüm Zamanlar', days: -100 }, // Tarih filtresi yok
  { id: 'today', label: 'Bugün', days: 0 },
  { id: 'yesterday', label: 'Dün', days: 1 },
  { id: 'last7', label: 'Son 7 Gün', days: 7 },
  { id: 'last30', label: 'Son 30 Gün', days: 30 },
  { id: 'thisMonth', label: 'Bu Ay', days: -1 }, // Özel hesaplama
  { id: 'lastMonth', label: 'Geçen Ay', days: -2 },
  { id: 'thisYear', label: 'Bu Yıl', days: -3 },
  { id: 'custom', label: 'Özel Tarih', days: -99 },
] as const

export type DatePreset = typeof DATE_PRESETS[number]['id']

export interface Region {
  id: string
  code: string
  name: string
}

export interface OwnershipGroup {
  id: string
  code: string
  name: string
}

export interface Store {
  id: string
  code: string
  name: string
  ownershipGroup?: string // MERKEZ, FRANCHISE veya dinamik grup kodu
  regionId?: string
  regionName?: string
  city?: string
}

// Cross-Filter: Widget'tan tıklamayla gelen filtre
export interface CrossFilter {
  widgetId: string        // Hangi widget'tan geldi
  field: string           // Hangi alan (store_id, category, product_name)
  value: string | number  // Değer
  label?: string          // Görünen isim
}

// Drill-Down: Detaya inme
export interface DrillDown {
  isOpen: boolean
  sourceWidgetId: string | null
  sourceMetricId: string | null
  field: string | null
  value: string | number | null
  label?: string
  data?: any[]           // Drill-down sonuç verisi
  loading?: boolean
}

interface FilterState {
  // Veriler
  regions: Region[]
  groups: OwnershipGroup[]
  stores: Store[]
  
  // Seçimler
  selectedRegionId: string | null  // null = tümü
  selectedStoreIds: string[]       // boş = tümü
  selectedGroupId: string | null   // null = tümü
  
  // Tarih
  datePreset: DatePreset
  startDate: string  // YYYY-MM-DD
  endDate: string    // YYYY-MM-DD
  
  // Cross-Filter (Widget'tan filtre)
  crossFilters: CrossFilter[]
  
  // Drill-Down (Detaya inme)
  drillDown: DrillDown
  
  // Loading
  isLoading: boolean
  isLoaded: boolean
  
  // Actions
  loadFilters: (accessToken: string) => Promise<void>
  setRegion: (regionId: string | null) => void
  setStores: (storeIds: string[]) => void
  setGroup: (groupId: string | null) => void
  setDatePreset: (preset: DatePreset) => void
  setCustomDates: (start: string, end: string) => void
  selectAllStores: () => void
  selectRegionStores: (regionId: string) => void
  getFilteredStores: () => Store[]
  getDateRange: () => { start: string; end: string }
  resetFilters: () => void
  
  // Cross-Filter Actions
  addCrossFilter: (filter: CrossFilter) => void
  removeCrossFilter: (widgetId: string) => void
  clearCrossFilters: () => void
  
  // Drill-Down Actions
  openDrillDown: (widgetId: string, metricId: string, field: string, value: string | number, label?: string) => void
  closeDrillDown: () => void
  setDrillDownData: (data: any[]) => void
  setDrillDownLoading: (loading: boolean) => void
}

// Tarih yardımcı fonksiyonları
// NOT: toISOString() UTC kullanır, Türkiye UTC+3 olduğu için 1 gün kayma olur!
// Bu yüzden yerel tarih formatı kullanıyoruz.
const formatDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const today = () => new Date()
const daysAgo = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1)
const endOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0)
const startOfYear = (date: Date) => new Date(date.getFullYear(), 0, 1)

export const useFilterStore = create<FilterState>((set, get) => ({
  // Başlangıç değerleri
  regions: [],
  groups: [],
  stores: [],
  selectedRegionId: null,
  selectedStoreIds: [],
  selectedGroupId: null,
  datePreset: 'thisMonth',
  startDate: formatDate(startOfMonth(today())),
  endDate: formatDate(today()),
  isLoading: false,
  isLoaded: false,
  
  // Cross-Filter başlangıç
  crossFilters: [],
  
  // Drill-Down başlangıç
  drillDown: {
    isOpen: false,
    sourceWidgetId: null,
    sourceMetricId: null,
    field: null,
    value: null,
    label: undefined,
    data: undefined,
    loading: false
  },

  // Filtreleri API'den yükle
  loadFilters: async (accessToken: string) => {
    if (!accessToken || get().isLoaded) return
    
    set({ isLoading: true })
    
    try {
      // Paralel olarak tüm master verileri çek
      const [regionsRes, storesRes, groupsRes] = await Promise.all([
        fetch(`${API_BASE}/core/regions`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
        fetch(`${API_BASE}/core/stores`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
        fetch(`${API_BASE}/core/ownership-groups`, { headers: { 'Authorization': `Bearer ${accessToken}` } })
      ])

      const [regionsData, storesData, groupsData] = await Promise.all([
        regionsRes.ok ? regionsRes.json() : { data: [] },
        storesRes.ok ? storesRes.json() : { data: [] },
        groupsRes.ok ? groupsRes.json() : { data: [] }
      ])
      
      const regions = (regionsData.data || []).map((r: any) => ({
        id: r.id,
        code: r.code,
        name: r.name
      }))

      const groups = (groupsData.data || []).map((g: any) => ({
        id: g.id,
        code: g.code,
        name: g.name
      }))
      
      const stores = (storesData.data || []).map((s: any) => ({
        id: s.id,
        code: s.code,
        name: s.name,
        ownershipGroup: s.ownership_group, // store_type yerine ownership_group kullanıyoruz
        regionId: s.region_id,
        regionName: s.region_name,
        city: s.city
      }))
      
      set({ 
        regions,
        groups,
        stores, 
        isLoading: false, 
        isLoaded: true,
        // Varsayılan: tüm mağazalar seçili
        selectedStoreIds: stores.map((s: Store) => s.id)
      })
    } catch (error) {
      console.error('[FILTER] Load error:', error)
      set({ isLoading: false, isLoaded: true })
    }
  },

  // Bölge seç
  setRegion: (regionId: string | null) => {
    set({ selectedRegionId: regionId })
    // Seçim sonrası mağazaları güncelle
    const filtered = get().getFilteredStores()
    set({ selectedStoreIds: filtered.map(s => s.id) })
  },

  // Mağazaları seç
  setStores: (storeIds: string[]) => {
    set({ selectedStoreIds: storeIds })
  },

  // Grup seç (Merkez/Franchise/TDUN vb.)
  setGroup: (groupId: string | null) => {
    set({ selectedGroupId: groupId })
    // Seçim sonrası mağazaları güncelle
    const filtered = get().getFilteredStores()
    set({ selectedStoreIds: filtered.map(s => s.id) })
  },

  // Tarih preset seç
  setDatePreset: (preset: DatePreset) => {
    let start: Date
    let end: Date = today()
    
    switch (preset) {
      case 'all':
        // Tüm Zamanlar - tarih filtresi yok
        return set({
          datePreset: preset,
          startDate: '',
          endDate: ''
        })
      case 'today':
        start = today()
        break
      case 'yesterday':
        start = daysAgo(1)
        end = daysAgo(1)
        break
      case 'last7':
        start = daysAgo(7)
        break
      case 'last30':
        start = daysAgo(30)
        break
      case 'thisMonth':
        start = startOfMonth(today())
        break
      case 'lastMonth':
        const lastMonth = new Date()
        lastMonth.setMonth(lastMonth.getMonth() - 1)
        start = startOfMonth(lastMonth)
        end = endOfMonth(lastMonth)
        break
      case 'thisYear':
        start = startOfYear(today())
        break
      case 'custom':
        // Custom için mevcut tarihleri koru
        return set({ datePreset: preset })
      default:
        start = startOfMonth(today())
    }
    
    set({
      datePreset: preset,
      startDate: formatDate(start),
      endDate: formatDate(end)
    })
  },

  // Özel tarih seç
  setCustomDates: (start: string, end: string) => {
    set({
      datePreset: 'custom',
      startDate: start,
      endDate: end
    })
  },

  // Tüm mağazaları seç
  selectAllStores: () => {
    const { stores } = get()
    set({ 
      selectedRegionId: null,
      selectedGroupId: null,
      selectedStoreIds: stores.map(s => s.id)
    })
  },

  // Bölge mağazalarını seç
  selectRegionStores: (regionId: string) => {
    const { stores, selectedGroupId } = get()
    let filtered = stores.filter(s => s.regionId === regionId)
    
    if (selectedGroupId) {
      const group = get().groups.find(g => g.id === selectedGroupId)
      if (group) {
        filtered = filtered.filter(s => s.ownershipGroup === group.code)
      }
    }
    
    set({ selectedStoreIds: filtered.map(s => s.id) })
  },

  // Filtrelenmiş mağazaları getir (Bölge ve Grup kesişimi)
  getFilteredStores: () => {
    const { stores, regions, groups, selectedRegionId, selectedGroupId } = get()
    
    let filtered = stores
    
    if (selectedRegionId) {
      filtered = filtered.filter(s => s.regionId === selectedRegionId)
    }
    
    if (selectedGroupId) {
      const group = groups.find(g => g.id === selectedGroupId)
      if (group) {
        filtered = filtered.filter(s => s.ownershipGroup === group.code)
      }
    }
    
    return filtered
  },

  // Tarih aralığını getir
  getDateRange: () => {
    const { startDate, endDate } = get()
    return { start: startDate, end: endDate }
  },

  // Filtreleri sıfırla
  resetFilters: () => {
    const { stores } = get()
    set({
      selectedRegionId: null,
      selectedStoreIds: stores.map(s => s.id),
      selectedGroupId: null,
      datePreset: 'thisMonth',
      startDate: formatDate(startOfMonth(today())),
      endDate: formatDate(today()),
      crossFilters: []
    })
  },

  // ============================================
  // CROSS-FILTER ACTIONS
  // ============================================
  
  // Cross-filter ekle (aynı widget'tan gelen varsa güncelle)
  addCrossFilter: (filter: CrossFilter) => {
    const { crossFilters } = get()
    // Aynı widget'tan gelen filtreyi kaldır, yenisini ekle
    const updated = crossFilters.filter(f => f.widgetId !== filter.widgetId)
    set({ crossFilters: [...updated, filter] })
  },

  // Widget'a ait cross-filter'ı kaldır
  removeCrossFilter: (widgetId: string) => {
    const { crossFilters } = get()
    set({ crossFilters: crossFilters.filter(f => f.widgetId !== widgetId) })
  },

  // Tüm cross-filter'ları temizle
  clearCrossFilters: () => {
    set({ crossFilters: [] })
  },

  // ============================================
  // DRILL-DOWN ACTIONS
  // ============================================
  
  // Drill-down aç
  openDrillDown: (widgetId: string, metricId: string, field: string, value: string | number, label?: string) => {
    set({
      drillDown: {
        isOpen: true,
        sourceWidgetId: widgetId,
        sourceMetricId: metricId,
        field,
        value,
        label,
        data: undefined,
        loading: true
      }
    })
  },

  // Drill-down kapat
  closeDrillDown: () => {
    set({
      drillDown: {
        isOpen: false,
        sourceWidgetId: null,
        sourceMetricId: null,
        field: null,
        value: null,
        label: undefined,
        data: undefined,
        loading: false
      }
    })
  },

  // Drill-down verisi ayarla
  setDrillDownData: (data: any[]) => {
    set(state => ({
      drillDown: { ...state.drillDown, data, loading: false }
    }))
  },

  // Drill-down loading durumu
  setDrillDownLoading: (loading: boolean) => {
    set(state => ({
      drillDown: { ...state.drillDown, loading }
    }))
  }
}))




