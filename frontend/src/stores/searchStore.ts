/**
 * Clixer - Search Store
 * Akıllı arama state yönetimi (Command Palette)
 * Zustand ile client-side + backend hybrid arama
 * 
 * ÖNEMLİ: Navigasyon öğeleri artık veritabanından dinamik olarak yüklenir
 * Yeni sayfa/tab eklemek için: Admin Panel > Navigasyon veya SQL ile navigation_items tablosuna ekle
 */

import { create } from 'zustand'
import Fuse, { IFuseOptions } from 'fuse.js'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Aranabilir öğe tipleri
export type SearchItemType = 
  | 'page' 
  | 'tab' 
  | 'setting' 
  | 'command' 
  | 'metric' 
  | 'store' 
  | 'user' 
  | 'dashboard'
  | 'dataset'
  | 'connection'
  | 'region'

// Aranabilir öğe
export interface SearchItem {
  id: string
  type: SearchItemType
  label: string
  description?: string
  path?: string
  action?: () => void
  icon?: string
  parent?: string
  keywords?: string[]
  metadata?: Record<string, any>
}

// Kategori bazlı sonuçlar
export interface SearchResultGroup {
  type: SearchItemType
  label: string
  items: SearchItem[]
}

// Navigation API'den gelen item
interface NavigationApiItem {
  id: string
  item_type: string
  code: string
  label: string
  description?: string
  path?: string
  icon?: string
  parent_code?: string
  keywords?: string[]
  search_priority: number
  sort_order: number
  is_searchable: boolean
  is_visible_in_menu: boolean
}

// Search Store State
interface SearchState {
  // UI State
  query: string
  isOpen: boolean
  selectedIndex: number
  loading: boolean
  navigationLoaded: boolean
  navigationError: string | null
  
  // Results
  staticResults: SearchItem[]
  backendResults: SearchItem[]
  
  // Client-side index
  staticIndex: SearchItem[]
  fuseInstance: Fuse<SearchItem> | null
  
  // Actions
  setQuery: (query: string) => void
  setOpen: (open: boolean) => void
  toggle: () => void
  setSelectedIndex: (index: number) => void
  moveSelection: (direction: 'up' | 'down') => void
  search: (query: string, accessToken?: string) => Promise<void>
  executeSelected: (navigate: (path: string) => void) => void
  executeItem: (item: SearchItem, navigate: (path: string) => void) => void
  initializeIndex: (accessToken?: string) => Promise<void>
  reset: () => void
}

/**
 * Navigasyon öğelerini API'den çek ve SearchItem formatına dönüştür
 * Bu fonksiyon veritabanındaki navigation_items tablosundan veri çeker
 */
async function fetchNavigationItems(accessToken: string): Promise<SearchItem[]> {
  try {
    const response = await fetch(`${API_BASE}/core/navigation`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      console.error('Navigation API error:', response.status)
      return getFallbackNavigationItems()
    }

    const data = await response.json()
    
    if (!data.success || !data.data) {
      console.error('Navigation API returned invalid data')
      return getFallbackNavigationItems()
    }

    // API response'u SearchItem formatına dönüştür
    const items: SearchItem[] = data.data
      .filter((item: NavigationApiItem) => item.is_searchable)
      .map((item: NavigationApiItem) => ({
        id: item.code,
        type: item.item_type as SearchItemType,
        label: item.label,
        description: item.description,
        path: item.path,
        icon: item.icon,
        parent: item.parent_code,
        keywords: item.keywords || []
      }))

    console.log(`[SearchStore] Loaded ${items.length} navigation items from API`)
    return items

  } catch (error) {
    console.error('Failed to fetch navigation items:', error)
    return getFallbackNavigationItems()
  }
}

/**
 * Fallback navigasyon öğeleri - API erişilemezse kullanılır
 * Minimum set - sadece kritik sayfalar
 */
function getFallbackNavigationItems(): SearchItem[] {
  console.warn('[SearchStore] Using fallback navigation items')
  return [
    {
      id: 'page-dashboard',
      type: 'page',
      label: 'Dashboard',
      description: 'Ana gösterge paneli',
      path: '/dashboard',
      icon: 'LayoutDashboard',
      keywords: ['anasayfa', 'home', 'gösterge']
    },
    {
      id: 'page-designer',
      type: 'page',
      label: 'Tasarımcı',
      description: 'Rapor ve dashboard tasarımı',
      path: '/designer',
      icon: 'Palette',
      keywords: ['rapor', 'report', 'tasarım']
    },
    {
      id: 'page-stores',
      type: 'page',
      label: 'Mağazalar',
      description: 'Mağaza listesi',
      path: '/stores',
      icon: 'Store',
      keywords: ['mağaza', 'store']
    },
    {
      id: 'page-data',
      type: 'page',
      label: 'Veri Bağlantıları',
      description: 'Veri kaynakları',
      path: '/data',
      icon: 'Database',
      keywords: ['veri', 'data', 'bağlantı']
    },
    {
      id: 'page-admin',
      type: 'page',
      label: 'Yönetim',
      description: 'Sistem yönetimi',
      path: '/admin',
      icon: 'Shield',
      keywords: ['admin', 'yönetim']
    },
    {
      id: 'cmd-logout',
      type: 'command',
      label: 'Çıkış Yap',
      description: 'Oturumu sonlandır',
      icon: 'LogOut',
      keywords: ['logout', 'çıkış']
    },
    {
      id: 'cmd-refresh',
      type: 'command',
      label: 'Sayfayı Yenile',
      description: 'Yeniden yükle',
      icon: 'RefreshCw',
      keywords: ['refresh', 'yenile']
    }
  ]
}

// Fuse.js konfigürasyonu
const fuseOptions: IFuseOptions<SearchItem> = {
  keys: [
    { name: 'label', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'keywords', weight: 0.3 },
    { name: 'parent', weight: 0.1 }
  ],
  threshold: 0.4, // Daha toleranslı fuzzy matching
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
  ignoreLocation: true
}

// Backend search debounce
let searchTimeout: ReturnType<typeof setTimeout> | null = null
const SEARCH_DEBOUNCE_MS = 300

export const useSearchStore = create<SearchState>((set, get) => ({
  // Initial state
  query: '',
  isOpen: false,
  selectedIndex: 0,
  loading: false,
  navigationLoaded: false,
  navigationError: null,
  staticResults: [],
  backendResults: [],
  staticIndex: [],
  fuseInstance: null,

  // Actions
  setQuery: (query: string) => {
    set({ query, selectedIndex: 0 })
  },

  setOpen: (isOpen: boolean) => {
    set({ isOpen })
    if (!isOpen) {
      // Modal kapandığında state'i temizle
      set({ query: '', selectedIndex: 0, staticResults: [], backendResults: [] })
    }
  },

  toggle: () => {
    const { isOpen, setOpen } = get()
    setOpen(!isOpen)
  },

  setSelectedIndex: (selectedIndex: number) => {
    set({ selectedIndex })
  },

  moveSelection: (direction: 'up' | 'down') => {
    const { selectedIndex, staticResults, backendResults } = get()
    const totalResults = staticResults.length + backendResults.length
    
    if (totalResults === 0) return

    let newIndex: number
    if (direction === 'up') {
      newIndex = selectedIndex <= 0 ? totalResults - 1 : selectedIndex - 1
    } else {
      newIndex = selectedIndex >= totalResults - 1 ? 0 : selectedIndex + 1
    }
    
    set({ selectedIndex: newIndex })
  },

  search: async (query: string, accessToken?: string) => {
    const { fuseInstance, staticIndex } = get()
    
    set({ query, selectedIndex: 0 })

    if (!query || query.length < 2) {
      set({ staticResults: [], backendResults: [], loading: false })
      return
    }

    // 1. Client-side arama (anında)
    if (fuseInstance) {
      const results = fuseInstance.search(query)
      const staticResults = results.slice(0, 10).map(r => r.item)
      set({ staticResults })
    }

    // 2. Backend arama (debounced)
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }

    set({ loading: true })

    searchTimeout = setTimeout(async () => {
      if (!accessToken) {
        set({ loading: false })
        return
      }

      try {
        const response = await fetch(
          `${API_BASE}/core/search?q=${encodeURIComponent(query)}&limit=15`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          }
        )

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data?.results) {
            // Backend sonuçlarını SearchItem formatına dönüştür
            const backendResults: SearchItem[] = data.data.results.flatMap((group: any) => 
              group.items.map((item: any) => ({
                id: `backend-${group.type}-${item.id}`,
                type: group.type as SearchItemType,
                label: item.name || item.label || item.code,
                description: item.description || item.city || item.email,
                path: getPathForBackendItem(group.type, item),
                metadata: item
              }))
            )
            set({ backendResults })
          }
        }
      } catch (error) {
        console.error('Backend search error:', error)
      } finally {
        set({ loading: false })
      }
    }, SEARCH_DEBOUNCE_MS)
  },

  executeSelected: (navigate: (path: string) => void) => {
    const { selectedIndex, staticResults, backendResults } = get()
    const allResults = [...staticResults, ...backendResults]
    
    if (allResults[selectedIndex]) {
      get().executeItem(allResults[selectedIndex], navigate)
    }
  },

  executeItem: (item: SearchItem, navigate: (path: string) => void) => {
    const { setOpen } = get()

    // Komutları işle
    if (item.type === 'command') {
      handleCommand(item.id)
      setOpen(false)
      return
    }

    // Sayfa/Tab navigasyonu
    if (item.path) {
      navigate(item.path)
      setOpen(false)
      return
    }

    // Custom action
    if (item.action) {
      item.action()
      setOpen(false)
      return
    }
  },

  initializeIndex: async (accessToken?: string) => {
    // Eğer zaten yüklenmişse tekrar yükleme
    const { navigationLoaded } = get()
    if (navigationLoaded) return

    try {
      let staticIndex: SearchItem[]
      
      if (accessToken) {
        // API'den dinamik olarak çek
        staticIndex = await fetchNavigationItems(accessToken)
        set({ navigationError: null })
      } else {
        // Token yoksa fallback kullan
        staticIndex = getFallbackNavigationItems()
        set({ navigationError: 'Token not available, using fallback' })
      }
      
      const fuseInstance = new Fuse(staticIndex, fuseOptions)
      set({ staticIndex, fuseInstance, navigationLoaded: true })
      
    } catch (error: any) {
      console.error('Failed to initialize search index:', error)
      // Hata durumunda fallback kullan
      const staticIndex = getFallbackNavigationItems()
      const fuseInstance = new Fuse(staticIndex, fuseOptions)
      set({ 
        staticIndex, 
        fuseInstance, 
        navigationLoaded: true,
        navigationError: error.message 
      })
    }
  },

  reset: () => {
    set({
      query: '',
      isOpen: false,
      selectedIndex: 0,
      loading: false,
      staticResults: [],
      backendResults: []
    })
  }
}))

// Backend item için path hesapla
// Her entity kendi sayfasında highlight/open edilecek şekilde
function getPathForBackendItem(type: string, item: any): string {
  switch (type) {
    case 'metric':
      // Tasarımcı > Metrikler tabına git, metriği vurgula
      return `/designer?tab=metrics&highlight=${item.id}`
    case 'store':
      // Mağazalar sayfasına git, mağazayı vurgula/aç
      return `/stores?highlight=${item.id}`
    case 'dashboard':
      // Dashboard'u direkt aç
      return `/dashboard?design=${item.id}`
    case 'user':
      // Kullanıcı yönetimi, kullanıcı kartını aç
      return `/admin?tab=users&edit=${item.id}`
    case 'dataset':
      // Dataset'ler tabı, dataset'i vurgula
      return `/data?tab=datasets&highlight=${item.id}`
    case 'connection':
      // Bağlantılar tabı, bağlantıyı vurgula
      return `/data?tab=connections&highlight=${item.id}`
    case 'region':
      // Bölgeler master data, bölgeyi vurgula
      return `/admin?tab=master&section=regions&highlight=${item.id}`
    default:
      return '/'
  }
}

// Komut işleyici
function handleCommand(commandId: string) {
  switch (commandId) {
    case 'cmd-logout':
      // authStore'dan logout çağrılacak
      window.dispatchEvent(new CustomEvent('clixer:logout'))
      break
    case 'cmd-theme-clixer':
      window.dispatchEvent(new CustomEvent('clixer:theme', { detail: 'clixer' }))
      break
    case 'cmd-theme-light':
      window.dispatchEvent(new CustomEvent('clixer:theme', { detail: 'light' }))
      break
    case 'cmd-theme-corporate':
      window.dispatchEvent(new CustomEvent('clixer:theme', { detail: 'corporate' }))
      break
    case 'cmd-lang-tr':
      window.dispatchEvent(new CustomEvent('clixer:language', { detail: 'tr' }))
      break
    case 'cmd-lang-en':
      window.dispatchEvent(new CustomEvent('clixer:language', { detail: 'en' }))
      break
    case 'cmd-refresh':
      window.location.reload()
      break
    case 'cmd-fullscreen':
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
      break
    default:
      console.warn('Unknown command:', commandId)
  }
}

// Kategori label'ları
export const categoryLabels: Record<SearchItemType, string> = {
  page: 'Sayfalar',
  tab: 'Sekmeler',
  setting: 'Ayarlar',
  command: 'Hızlı Komutlar',
  metric: 'Metrikler',
  store: 'Mağazalar',
  user: 'Kullanıcılar',
  dashboard: 'Dashboard\'lar',
  dataset: 'Dataset\'ler',
  connection: 'Bağlantılar',
  region: 'Bölgeler'
}

// Kategori ikonları
export const categoryIcons: Record<SearchItemType, string> = {
  page: 'FileText',
  tab: 'Layers',
  setting: 'Settings',
  command: 'Zap',
  metric: 'BarChart3',
  store: 'Store',
  user: 'Users',
  dashboard: 'LayoutDashboard',
  dataset: 'FileSpreadsheet',
  connection: 'Plug',
  region: 'Building'
}

export default useSearchStore
