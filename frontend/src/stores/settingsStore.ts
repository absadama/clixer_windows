import { create } from 'zustand'
import { useAuthStore } from './authStore'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

interface MenuPermission {
  menu_key: string
  can_view: boolean
  can_edit: boolean
}

// Sistem ayarları tipi - API yanıtı için (gelecek kullanım için)
type _SystemSetting = { key: string; value: string; category: string }

// Finans bölümü izin ayarları tipi (gelecek kullanım için)
type _FinanceSectionPermission = { section: string; allowedPositions: string[] }

interface SettingsState {
  // Sistem ayarları
  appName: string
  appLogo: string
  appFavicon: string
  defaultTheme: 'clixer' | 'light' | 'corporate'
  defaultLanguage: 'tr' | 'en'
  dateFormat: string
  currency: string
  numberFormat: string
  primaryColor: string
  
  // Finans ayarları - Gösterim
  financeShowRoi: boolean
  financeShowProfitMargin: boolean
  financeShowExpenseBreakdown: boolean
  financeShowAmortizationWarning: boolean
  financeTargetProfitMargin: number
  financeTargetRoi: number
  
  // Finans ayarları - Pozisyon bazlı izinler
  financeRoiPositions: string[]
  financeProfitMarginPositions: string[]
  financeExpenseBreakdownPositions: string[]
  financeAmortizationPositions: string[]
  financeSettingsPositions: string[]
  
  // Menü izinleri
  menuPermissions: MenuPermission[]
  
  // Dinamik etiketler
  positionLabels: Record<string, string>
  
  // Loading state
  isLoading: boolean
  isLoaded: boolean
  
  // Actions
  loadSettings: (accessToken: string) => Promise<void>
  loadMenuPermissions: (accessToken: string, positionCode: string) => Promise<void>
  loadPositionLabels: (accessToken: string) => Promise<void>
  canViewMenu: (menuKey: string) => boolean
  canEditMenu: (menuKey: string) => boolean
  canViewFinanceSection: (section: string, positionCode?: string) => boolean
  getSetting: (key: string) => string | undefined
  getPositionLabel: (code: string) => string
}

// Tüm pozisyonlar
const ALL_POSITIONS = ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER', 'STORE_MANAGER', 'ANALYST', 'VIEWER']

// Varsayılan pozisyon etiketleri (ASCII - Türkçe karaktersiz)
const DEFAULT_POSITION_LABELS: Record<string, string> = {
  GENERAL_MANAGER: 'Genel Mudur',
  DIRECTOR: 'Direktor',
  REGION_MANAGER: 'Bolge Muduru',
  STORE_MANAGER: 'Magaza Muduru',
  ANALYST: 'Analist',
  VIEWER: 'Izleyici'
}

// Varsayılan değerler
const defaultSettings = {
  appName: 'Clixer',
  appLogo: '/logo.png',
  appFavicon: '/favicon.ico',
  defaultTheme: 'clixer' as const, // Clixer teması varsayılan
  defaultLanguage: 'tr' as const,
  dateFormat: 'DD.MM.YYYY',
  currency: 'TRY',
  numberFormat: '1.234,56',
  primaryColor: '#6366f1',
  // Finans gösterim ayarları
  financeShowRoi: true,
  financeShowProfitMargin: true,
  financeShowExpenseBreakdown: true,
  financeShowAmortizationWarning: true,
  financeTargetProfitMargin: 25,
  financeTargetRoi: 15,
  // Finans pozisyon bazlı izinler - varsayılan: sadece yöneticiler görebilir
  financeRoiPositions: ['GENERAL_MANAGER', 'DIRECTOR'],
  financeProfitMarginPositions: ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER'],
  financeExpenseBreakdownPositions: ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER'],
  financeAmortizationPositions: ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER'],
  financeSettingsPositions: ['GENERAL_MANAGER', 'DIRECTOR'],
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  // Varsayılan değerler
  ...defaultSettings,
  menuPermissions: [],
  positionLabels: DEFAULT_POSITION_LABELS,
  isLoading: false,
  isLoaded: false,

  // Sistem ayarlarını yükle
  loadSettings: async (accessToken: string) => {
    if (!accessToken) return
    
    set({ isLoading: true })
    
    try {
      const response = await fetch(`${API_BASE}/core/settings`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        // 401 hatasını sessizce geç (token henüz hazır değil)
        set({ isLoading: false, isLoaded: true })
        return
      }
      
      const result = await response.json()
      const settings = result.data || []
      
      // Ayarları parse et ve state'e aktar
      const updates: Partial<SettingsState> = {}
      
      for (const setting of settings) {
        let value = setting.value
        
        // JSON parse dene
        try {
          const parsed = typeof value === 'string' ? JSON.parse(value) : value
          
          // Array ise doğrudan kullan (pozisyon listesi gibi)
          if (Array.isArray(parsed)) {
            value = parsed
          }
          // Obje ise value alanını al
          else if (typeof parsed === 'object' && parsed !== null) {
            value = parsed.value !== undefined ? parsed.value : value
          }
          // Primitive ise doğrudan kullan
          else {
            value = parsed
          }
        } catch {
          // JSON değilse düz değer kullan
        }
        
        // Ayarları map et
        switch (setting.key) {
          case 'app_name':
            updates.appName = value
            break
          case 'app_logo':
          case 'app_logo_url':
            updates.appLogo = value
            break
          case 'app_favicon':
          case 'app_favicon_url':
            updates.appFavicon = value
            break
          case 'default_theme':
            if (['clixer', 'light', 'corporate'].includes(value)) {
              updates.defaultTheme = value
            }
            break
          case 'default_language':
            if (['tr', 'en'].includes(value)) {
              updates.defaultLanguage = value
            }
            break
          case 'date_format':
            updates.dateFormat = value
            break
          case 'currency':
          case 'finance_currency':
            updates.currency = value
            break
          case 'number_format':
            updates.numberFormat = value
            break
          case 'primary_color':
            updates.primaryColor = value
            break
          case 'finance_show_roi':
            updates.financeShowRoi = value === 'true' || value === true
            break
          case 'finance_show_profit_margin':
            updates.financeShowProfitMargin = value === 'true' || value === true
            break
          case 'finance_show_expense_breakdown':
            updates.financeShowExpenseBreakdown = value === 'true' || value === true
            break
          case 'finance_show_amortization_warning':
            updates.financeShowAmortizationWarning = value === 'true' || value === true
            break
          case 'finance_target_profit_margin':
            updates.financeTargetProfitMargin = parseInt(value) || 25
            break
          case 'finance_target_roi':
            updates.financeTargetRoi = parseInt(value) || 15
            break
          // Pozisyon bazlı izinler
          case 'finance_roi_positions':
            try {
              updates.financeRoiPositions = typeof value === 'string' ? JSON.parse(value) : (value || ALL_POSITIONS)
            } catch { updates.financeRoiPositions = ALL_POSITIONS }
            break
          case 'finance_profit_margin_positions':
            try {
              updates.financeProfitMarginPositions = typeof value === 'string' ? JSON.parse(value) : (value || ALL_POSITIONS)
            } catch { updates.financeProfitMarginPositions = ALL_POSITIONS }
            break
          case 'finance_expense_breakdown_positions':
            try {
              updates.financeExpenseBreakdownPositions = typeof value === 'string' ? JSON.parse(value) : (value || ALL_POSITIONS)
            } catch { updates.financeExpenseBreakdownPositions = ALL_POSITIONS }
            break
          case 'finance_amortization_positions':
            try {
              updates.financeAmortizationPositions = typeof value === 'string' ? JSON.parse(value) : (value || ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER'])
            } catch { updates.financeAmortizationPositions = ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER'] }
            break
          case 'finance_settings_positions':
            try {
              updates.financeSettingsPositions = typeof value === 'string' ? JSON.parse(value) : (value || ['GENERAL_MANAGER', 'DIRECTOR'])
            } catch { updates.financeSettingsPositions = ['GENERAL_MANAGER', 'DIRECTOR'] }
            break
        }
      }
      
      set({ ...updates, isLoading: false, isLoaded: true })
    } catch (_error) {
      // 401 hatalarını sessizce geç - token yenileme devreye girecek
      set({ isLoading: false, isLoaded: true })
    }
  },

  // Menü izinlerini yükle
  loadMenuPermissions: async (accessToken: string, positionCode: string) => {
    if (!accessToken || !positionCode) {
      // Token veya pozisyon yoksa sessizce çık
      return
    }
    
    try {
      const response = await fetch(`${API_BASE}/core/positions/${positionCode}/permissions`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        // 401 hatasını sessizce geç
        return
      }
      
      const result = await response.json()
      const permissions = result.data || []
      
      set({ menuPermissions: permissions })
    } catch (_error) {
      // 401 hatalarını sessizce geç - token yenileme devreye girecek
    }
  },

  // Menü görüntüleme izni kontrol
  canViewMenu: (menuKey: string) => {
    const { menuPermissions } = get()
    
    // ADMIN rolü tüm menülere erişebilir (pozisyon izinlerini bypass)
    const user = useAuthStore.getState().user
    if (user?.role === 'ADMIN') return true
    
    // Profil her zaman erişilebilir
    if (menuKey === 'profile') return true
    
    // İzin listesi boşsa (henüz yüklenmemiş) bekle
    if (menuPermissions.length === 0) return false
    
    const permission = menuPermissions.find(p => p.menu_key === menuKey)
    
    // Bu menü için izin tanımlanmamışsa GÖSTERİLMEZ (güvenli varsayılan)
    if (!permission) return false
    
    return permission.can_view
  },

  // Menü düzenleme izni kontrol
  canEditMenu: (menuKey: string) => {
    const { menuPermissions } = get()
    
    // ADMIN rolü tüm menüleri düzenleyebilir (pozisyon izinlerini bypass)
    const user = useAuthStore.getState().user
    if (user?.role === 'ADMIN') return true
    
    if (menuPermissions.length === 0) return true
    
    const permission = menuPermissions.find(p => p.menu_key === menuKey)
    if (!permission) return false
    
    return permission.can_edit
  },

  // Finans bölümü görünürlük kontrolü
  canViewFinanceSection: (section: string, positionCode?: string) => {
    const state = get()
    
    // Pozisyon kodu yoksa gösterme
    if (!positionCode) return false
    
    // Önce global gösterim ayarını kontrol et
    // Sonra pozisyon bazlı izni kontrol et
    switch (section) {
      case 'roi':
        if (!state.financeShowRoi) return false
        return state.financeRoiPositions.includes(positionCode)
      case 'profit_margin':
        if (!state.financeShowProfitMargin) return false
        return state.financeProfitMarginPositions.includes(positionCode)
      case 'expense_breakdown':
        if (!state.financeShowExpenseBreakdown) return false
        return state.financeExpenseBreakdownPositions.includes(positionCode)
      case 'amortization_warning':
        if (!state.financeShowAmortizationWarning) return false
        return state.financeAmortizationPositions.includes(positionCode)
      case 'settings':
        return state.financeSettingsPositions.includes(positionCode)
      default:
        return true
    }
  },

  // Genel ayar getir
  getSetting: (key: string) => {
    const state = get() as any
    return state[key]
  },

  // Pozisyon etiketlerini yükle
  loadPositionLabels: async (accessToken: string) => {
    if (!accessToken) return
    
    try {
      const response = await fetch(`${API_BASE}/core/labels/position`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          set({ positionLabels: { ...DEFAULT_POSITION_LABELS, ...result.data } })
        }
      }
    } catch {
      // Hata durumunda varsayılan etiketler kullanılır
    }
  },

  // Pozisyon etiketi getir
  getPositionLabel: (code: string) => {
    const { positionLabels } = get()
    return positionLabels[code] || DEFAULT_POSITION_LABELS[code] || code
  }
}))

