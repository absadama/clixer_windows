import { ReactNode, useState, createContext, useContext, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ErrorBoundary } from './ErrorBoundary'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useFilterStore } from '../stores/filterStore'
import { useSearchStore } from '../stores/searchStore'
import { CommandPalette } from './search/CommandPalette'
import {
  LayoutDashboard,
  Palette,
  Database,
  LogOut,
  Menu,
  X,
  Zap,
  ChevronLeft,
  ChevronRight,
  Bell,
  Search,
  Activity,
  Wallet,
  ShieldAlert,
  PieChart,
  Store,
  Shield,
  User as UserIcon,
  Sun,
  Moon,
  Table2,
  SlidersHorizontal,
  GraduationCap,
  ExternalLink,
} from 'lucide-react'
import clsx from 'clsx'
import { UserRole } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface LayoutProps {
  children: ReactNode
}

// Varsayılan menü etiketleri (ASCII - Türkçe karaktersiz)
const defaultMenuLabels: Record<string, string> = {
  dashboard: 'Kokpit',
  finance: 'Finans',
  operations: 'Operasyon',
  analysis: 'Detayli Analiz',
  stores: 'Magazalar',
  designer: 'Tasarim Studyosu',
  data: 'Veri Baglantilari',
  datagrid: 'DataGrid Demo',
  admin: 'Yonetim Paneli',
  profile: 'Profilim',
  education: 'Egitim Merkezi'
}

// Menü öğesi tanımı (name dinamik olacak)
const menuItemsBase = [
  { id: 'dashboard', key: 'dashboard', href: '/dashboard', icon: LayoutDashboard, badge: null, isExternal: false, adminOnly: false },
  { id: 'finance', key: 'finance', href: '/finance', icon: Wallet, badge: 'YENİ', isExternal: false, adminOnly: false },
  { id: 'operation', key: 'operations', href: '/operations', icon: ShieldAlert, badge: 'YENİ', isExternal: false, adminOnly: false },
  { id: 'analysis', key: 'analysis', href: '/analysis', icon: PieChart, badge: null, isExternal: false, adminOnly: false },
  { id: 'stores', key: 'stores', href: '/stores', icon: Store, badge: null, isExternal: false, adminOnly: false },
  { id: 'settings', key: 'designer', href: '/designer', icon: Palette, badge: null, isExternal: false, adminOnly: false },
  { id: 'data', key: 'data', href: '/data', icon: Database, badge: null, isExternal: false, adminOnly: false },
  { id: 'datagrid', key: 'datagrid', href: '/datagrid-demo', icon: Table2, badge: 'YENİ', isExternal: false, adminOnly: false },
  { id: 'admin', key: 'admin', href: '/admin', icon: Shield, badge: null, isExternal: false, adminOnly: true },
  { id: 'education', key: 'education', href: 'education', icon: GraduationCap, badge: null, isExternal: true, adminOnly: true },
]

// CLIXER TEMA PALETİ
// Clixer: Ana tema - koyu, profesyonel
// Light: Aydınlık tema - yüksek kontrast
// Corporate: Kurumsal tema - teal/mavi
export const themes = {
  // CLIXER ENTERPRISE THEME - Website Renk Paleti (VARSAYILAN)
  // Coal: #0F1116 | Anthracite: #181B21 | Surface: #21252E | Neon Cyan: #00CFDE
  clixer: {
    name: 'Clixer',
    // Sidebar - Deep coal with glow effect
    sidebar: 'bg-gradient-to-b from-[#181B21] via-[#0F1116] to-[#0a0c10] backdrop-blur-xl border-r border-[#2F3542]/50 shadow-[inset_-2px_0_20px_rgba(0,207,222,0.03),4px_0_24px_rgba(0,0,0,0.4)]',
    sidebarText: 'text-[#e2e8f0]',
    sidebarTextMuted: 'text-[#94a3b8]',
    sidebarHover: 'hover:bg-[#21252E]/80 hover:shadow-inner',
    sidebarActive: 'bg-gradient-to-r from-[#00CFDE] to-[#22D3EE] text-[#0F1116] shadow-lg shadow-[#00CFDE]/30',
    sidebarBorder: 'border-[#2F3542]/50',
    sidebarBgAlt: 'bg-gradient-to-b from-[#21252E]/50 to-transparent backdrop-blur-sm',
    // Ana alan - Transparent to show body radial gradient glow
    mainBg: 'bg-transparent',
    // Header
    headerBg: 'bg-[#181B21]/95 border-[#2F3542]',
    headerText: 'text-[#e2e8f0]',
    // İçerik
    contentText: 'text-[#e2e8f0]',
    contentTextMuted: 'text-[#94a3b8]',
    // Accent renkler - Neon Cyan
    accent: 'from-[#00CFDE] to-[#22D3EE]',
    accentSolid: 'bg-[#00CFDE]',
    badge: 'bg-[#00CFDE]',
    badgeText: 'text-[#0F1116]',
    // Kartlar - Minimal shadow (border-based depth)
    cardBg: 'bg-gradient-to-br from-[#181B21] to-[#1a1e26] border border-[#2F3542] rounded-2xl',
    cardHover: 'hover:border-[#00CFDE]/40 transition-all duration-300',
    // Input
    inputBg: 'bg-[#21252E] border-[#2F3542]',
    inputText: 'text-[#e2e8f0]',
    inputBorder: 'border-[#2F3542]',
    inputPlaceholder: 'placeholder:text-[#64748b]',
    // Border
    border: 'border-[#2F3542]',
    // Butonlar
    buttonPrimary: 'bg-gradient-to-r from-[#00CFDE] to-[#22D3EE] text-[#0F1116] font-semibold hover:shadow-lg hover:shadow-[#00CFDE]/40',
    buttonSecondary: 'bg-[#21252E] text-[#e2e8f0] border border-[#2F3542] hover:bg-[#2F3542] hover:border-[#00CFDE]/30',
    // Status
    success: 'text-emerald-400 bg-emerald-500/10',
    warning: 'text-[#FBBF24] bg-[#FBBF24]/10',
    error: 'text-rose-400 bg-rose-500/10',
    // Ek property'ler (DataGrid uyumluluğu için)
    mutedText: 'text-[#94a3b8]',
    pageBackground: 'bg-[#0F1116]',
    input: 'bg-[#21252E] border-[#2F3542] text-[#e2e8f0]',
  },
  // AYDINLIK TEMA
  light: {
    name: 'Aydınlık',
    // Sidebar - 3D white gradient with depth
    sidebar: 'bg-gradient-to-br from-white via-slate-50 to-slate-100 backdrop-blur-xl border-r border-slate-200/30 shadow-[inset_-1px_0_10px_rgba(0,0,0,0.03),4px_0_16px_rgba(0,0,0,0.05)]',
    sidebarText: 'text-slate-900',
    sidebarTextMuted: 'text-slate-500',
    sidebarHover: 'hover:bg-slate-100/80 hover:shadow-inner',
    sidebarActive: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/25',
    sidebarBorder: 'border-slate-200/30',
    sidebarBgAlt: 'bg-gradient-to-b from-slate-100/80 to-transparent backdrop-blur-sm',
    // Ana alan
    mainBg: 'bg-slate-100',
    // Header
    headerBg: 'bg-white/95 border-slate-200',
    headerText: 'text-slate-900',
    // İçerik
    contentText: 'text-slate-900',
    contentTextMuted: 'text-slate-500',
    // Accent renkler
    accent: 'from-indigo-600 to-blue-600',
    accentSolid: 'bg-indigo-600',
    badge: 'bg-indigo-600',
    badgeText: 'text-white',
    // Kartlar
    cardBg: 'bg-white border border-slate-200',
    cardHover: 'hover:border-indigo-500 hover:shadow-lg',
    // Input
    inputBg: 'bg-slate-100 border-slate-200',
    inputText: 'text-slate-900',
    inputBorder: 'border-slate-200',
    inputPlaceholder: 'placeholder:text-slate-400',
    // Border
    border: 'border-slate-200',
    // Butonlar
    buttonPrimary: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:shadow-lg hover:shadow-indigo-500/25',
    buttonSecondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    // Status
    success: 'text-emerald-600 bg-emerald-50',
    warning: 'text-amber-600 bg-amber-50',
    error: 'text-rose-600 bg-rose-50',
    // Ek property'ler (DataGrid uyumluluğu için)
    mutedText: 'text-slate-500',
    pageBackground: 'bg-slate-100',
    input: 'bg-slate-100 border-slate-200 text-slate-900',
  },
  // KURUMSAL TEMA - Teal/Mavi/Turuncu Paleti
  // #026E81 Dark Teal | #00ABBD Aqua | #0099DD Blue | #FF9933 Orange | #A1C7E0 Light Blue
  corporate: {
    name: 'Kurumsal',
    // Sidebar - 3D gradient with depth effect
    sidebar: 'bg-gradient-to-br from-[#037589] via-[#026E81] to-[#024050] backdrop-blur-xl border-r border-white/5 shadow-[inset_-2px_0_20px_rgba(0,0,0,0.3),4px_0_24px_rgba(0,0,0,0.15)]',
    sidebarText: 'text-white',
    sidebarTextMuted: 'text-white/75',
    sidebarHover: 'hover:bg-white/10 hover:shadow-inner',
    sidebarActive: 'bg-gradient-to-r from-[#FF9933] to-[#FF7700] text-white shadow-lg shadow-orange-500/30',
    sidebarBorder: 'border-white/5',
    sidebarBgAlt: 'bg-gradient-to-b from-white/5 to-transparent backdrop-blur-sm',
    // Ana alan
    mainBg: 'bg-gradient-to-br from-slate-50 to-[#A1C7E0]/20',
    // Header
    headerBg: 'bg-white/95 border-[#A1C7E0]',
    headerText: 'text-[#024959]',  // Daha koyu
    // İçerik - DAHA KOYU VE OKUNAKLI
    contentText: 'text-[#024959]',  // Daha koyu teal
    contentTextMuted: 'text-slate-600',  // Standart koyu gri - çok daha okunabilir
    // Accent renkler - Orange accent
    accent: 'from-[#00ABBD] to-[#0099DD]',
    accentSolid: 'bg-[#00ABBD]',
    badge: 'bg-[#FF9933]',
    badgeText: 'text-white',
    // Kartlar
    cardBg: 'bg-white border border-[#A1C7E0]/50',
    cardHover: 'hover:border-[#00ABBD] hover:shadow-lg hover:shadow-[#00ABBD]/20',
    // Input
    inputBg: 'bg-white border-[#A1C7E0]',
    inputText: 'text-[#024959]',  // Daha koyu
    inputBorder: 'border-[#A1C7E0]',
    inputPlaceholder: 'placeholder:text-slate-400',  // Standart placeholder
    // Border
    border: 'border-[#A1C7E0]/50',
    // Butonlar
    buttonPrimary: 'bg-gradient-to-r from-[#00ABBD] to-[#0099DD] text-white hover:shadow-lg hover:shadow-[#0099DD]/30',
    buttonSecondary: 'bg-[#A1C7E0]/30 text-[#024959] hover:bg-[#A1C7E0]/50',
    // Status
    success: 'text-emerald-700 bg-emerald-50',
    warning: 'text-[#FF9933] bg-orange-50',
    error: 'text-rose-700 bg-rose-50',
    // Ek property'ler (DataGrid uyumluluğu için)
    mutedText: 'text-slate-600',
    pageBackground: 'bg-gradient-to-br from-slate-50 to-[#A1C7E0]/20',
    input: 'bg-white border-[#A1C7E0] text-[#024959]',
  }
}

export type ThemeType = keyof typeof themes
export type ThemeColors = typeof themes.light

// Tema Context'i - diğer componentler tarafından kullanılabilir
interface ThemeContextType {
  theme: ThemeColors
  currentTheme: ThemeType
  setCurrentTheme: (theme: ThemeType) => void
  isDark: boolean
}

// Menu item tipi
interface MenuItem {
  id: string
  name: string
  icon: React.ComponentType<any>
  href: string
  key: string
  badge?: string | null
  isExternal?: boolean
  adminOnly?: boolean
}

const ThemeContext = createContext<ThemeContextType | null>(null)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    // Fallback - context yoksa light tema döndür
    return {
      theme: themes.light,
      currentTheme: 'light' as ThemeType,
      setCurrentTheme: () => {},
      isDark: false
    }
  }
  return context
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [currentTheme, setCurrentTheme] = useState<ThemeType>('clixer') // Default: clixer
  const [language, setLanguage] = useState<'tr' | 'en'>('tr')
  const [menuLabels, setMenuLabels] = useState<Record<string, string>>(defaultMenuLabels)
  const location = useLocation()
  const { user, logout, accessToken } = useAuthStore()
  const { 
    loadSettings, 
    loadMenuPermissions,
    canViewMenu, 
    isLoaded,
    defaultTheme,
    defaultLanguage,
    appName,
    appLogo: storeAppLogo
  } = useSettingsStore()
  
  // Mobil filtre kontrolü için
  const { setMobileFilterOpen } = useFilterStore()
  
  // Search store
  const { setOpen: setSearchOpen } = useSearchStore()
  
  // Logo için localStorage öncelikli - flash önleme
  const getEffectiveLogo = (): string => {
    // 1. Store'dan gelen değer uploads ise kullan
    if (storeAppLogo?.startsWith('/uploads/')) {
      return storeAppLogo;
    }
    // 2. localStorage'dan kontrol et
    try {
      const cached = localStorage.getItem('cachedLogoUrl');
      if (cached && cached.startsWith('/uploads/')) {
        return cached;
      }
    } catch {}
    // 3. Fallback
    return '/logo.png';
  };
  const appLogo = getEffectiveLogo();

  // Menü etiketlerini yükle
  const loadMenuLabels = useCallback(async () => {
    if (!accessToken) return
    try {
      const response = await fetch(`${API_BASE}/core/labels/menu`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          setMenuLabels({ ...defaultMenuLabels, ...result.data })
        }
      }
    } catch {
      // Hata durumunda varsayılan etiketler kullanılır
    }
  }, [accessToken])

  // Ayarları ve menü izinlerini yükle
  useEffect(() => {
    if (accessToken && !isLoaded) {
      loadSettings(accessToken)
    }
  }, [accessToken, isLoaded, loadSettings])

  // Menü etiketlerini yükle
  useEffect(() => {
    if (accessToken) {
      loadMenuLabels()
    }
  }, [accessToken, loadMenuLabels])

  // Kullanıcının pozisyon koduna göre menü izinlerini yükle
  useEffect(() => {
    if (accessToken && user?.positionCode) {
      loadMenuPermissions(accessToken, user.positionCode)
    }
  }, [accessToken, user?.positionCode, loadMenuPermissions])

  // Kullanıcı tercihlerini yükle (öncelikli)
  useEffect(() => {
    const loadUserPreferences = async () => {
      if (!accessToken || !user?.id) return
      
      try {
        const response = await fetch(`${API_BASE}/core/users/${user.id}/preferences`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        
        if (response.ok) {
          const result = await response.json()
          const prefs = result.data || {}
          
          console.debug('User preferences loaded:', prefs)
          
          // Kullanıcı teması varsa uygula
          if (prefs.theme && ['clixer', 'light', 'corporate'].includes(prefs.theme)) {
            setCurrentTheme(prefs.theme as ThemeType)
            localStorage.setItem('clixer-user-theme', prefs.theme)
          }
          
          // Kullanıcı dili varsa uygula
          if (prefs.language && ['tr', 'en'].includes(prefs.language)) {
            setLanguage(prefs.language as 'tr' | 'en')
            localStorage.setItem('clixer-user-language', prefs.language)
          }
        } else {
          console.debug('User preferences API returned:', response.status)
        }
      } catch (err) {
        console.debug('User preferences could not be loaded, using defaults:', err)
      }
    }
    
    loadUserPreferences()
  }, [accessToken, user?.id])

  // Sistem varsayılan temasını uygula (kullanıcı tercihi yoksa)
  useEffect(() => {
    // Sadece kullanıcı tercihi yüklenmemişse sistem varsayılanını kullan
    // Bu useEffect, yukarıdaki loadUserPreferences'dan sonra çalışır
    // ama kullanıcı tercihi varsa override edilir
    if (isLoaded && defaultTheme) {
      // localStorage'da kullanıcı tercihi var mı kontrol et
      const cachedUserTheme = localStorage.getItem('clixer-user-theme')
      if (!cachedUserTheme) {
        setCurrentTheme(defaultTheme)
      }
    }
  }, [isLoaded, defaultTheme])

  // Varsayılan dili uygula (kullanıcı tercihi yoksa)
  useEffect(() => {
    if (isLoaded && defaultLanguage) {
      const cachedUserLang = localStorage.getItem('clixer-user-language')
      if (!cachedUserLang) {
        setLanguage(defaultLanguage)
      }
    }
  }, [isLoaded, defaultLanguage])

  // Tema değiştiğinde localStorage'a kaydet (flash önleme)
  useEffect(() => {
    localStorage.setItem('clixer-user-theme', currentTheme)
  }, [currentTheme])

  // Dil değiştiğinde localStorage'a kaydet
  useEffect(() => {
    localStorage.setItem('clixer-user-language', language)
  }, [language])

  // Body class'ını tema değişikliğine göre güncelle (Clixer glow efekti için)
  useEffect(() => {
    document.body.classList.remove('theme-light', 'theme-dark', 'theme-corporate', 'theme-clixer')
    document.body.classList.add(`theme-${currentTheme}`)
  }, [currentTheme])

  // Command Palette event listeners (theme, language, logout)
  useEffect(() => {
    const handleThemeChange = (e: CustomEvent) => {
      const newTheme = e.detail as ThemeType
      if (newTheme && themes[newTheme]) {
        setCurrentTheme(newTheme)
      }
    }
    
    const handleLanguageChange = (e: CustomEvent) => {
      const newLang = e.detail as 'tr' | 'en'
      if (newLang) {
        setLanguage(newLang)
      }
    }
    
    const handleLogout = () => {
      logout()
    }
    
    window.addEventListener('clixer:theme', handleThemeChange as EventListener)
    window.addEventListener('clixer:language', handleLanguageChange as EventListener)
    window.addEventListener('clixer:logout', handleLogout)
    
    return () => {
      window.removeEventListener('clixer:theme', handleThemeChange as EventListener)
      window.removeEventListener('clixer:language', handleLanguageChange as EventListener)
      window.removeEventListener('clixer:logout', handleLogout)
    }
  }, [setCurrentTheme, setLanguage, logout])

  const theme = themes[currentTheme]
  const isDark = currentTheme === 'clixer'

  // Dinamik menü öğelerini oluştur (etiketlerle birlikte)
  const allMenuItems = menuItemsBase.map(item => ({
    ...item,
    name: menuLabels[item.key] || defaultMenuLabels[item.key] || item.key
  }))

  // Menü izinlerine göre filtreleme
  const getVisibleMenuItems = () => {
    const userRole = user?.role || UserRole.VIEWER
    
    return allMenuItems.filter(item => {
      // adminOnly menüler sadece ADMIN rolüne açık (admin paneli, eğitim merkezi vb.)
      if (item.adminOnly && userRole !== UserRole.ADMIN) return false
      
      // Menu permission kontrolü - veritabanından gelen izinlere bak
      // Menü key mapping (sidebar id -> database menu_key)
      const menuKeyMap: Record<string, string> = {
        'dashboard': 'dashboard',
        'finance': 'finance',
        'operation': 'operations',
        'analysis': 'analysis',
        'stores': 'stores',
        'settings': 'data', // Tasarım Stüdyosu -> data izni
        'data': 'data',
        'admin': 'admin',
        'education': 'education'
      }
      
      const menuKey = menuKeyMap[item.id] || item.id
      
      // canViewMenu ile veritabanından izin kontrolü
      return canViewMenu(menuKey)
    })
  }

  const menuItems = getVisibleMenuItems()
  
  // Uygulama adı
  const displayAppName = appName || 'CLIXER'

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, setCurrentTheme, isDark }}>
      <div className={clsx('min-h-screen', theme.mainBg)}>
        {/* Mobile sidebar overlay */}
        <div className={clsx(
          'fixed inset-0 z-50 lg:hidden transition-opacity duration-300',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
      <div className={clsx(
            'fixed inset-y-0 left-0 w-72 transform transition-transform duration-300',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}>
            <SidebarContent 
              location={location}
              user={user}
              logout={logout}
              isCollapsed={false}
              currentTheme={currentTheme}
              setCurrentTheme={setCurrentTheme}
              language={language}
              setLanguage={setLanguage}
              menuItems={menuItems}
              theme={theme}
              isDark={isDark}
              onClose={() => setSidebarOpen(false)}
              displayAppName={displayAppName}
              appLogo={appLogo}
            />
          </div>
      </div>

        {/* Desktop sidebar - ALWAYS visible with lg:flex */}
        <div 
          data-sidebar="desktop"
          className={clsx(
          'hidden lg:flex lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 transition-all duration-300 flex-col',
          isCollapsed ? 'lg:w-20' : 'lg:w-72'
        )}>
          <SidebarContent 
            location={location}
            user={user}
            logout={logout}
            isCollapsed={isCollapsed}
            toggleCollapse={() => setIsCollapsed(!isCollapsed)}
            currentTheme={currentTheme}
            setCurrentTheme={setCurrentTheme}
            language={language}
            setLanguage={setLanguage}
            menuItems={menuItems}
            theme={theme}
            isDark={isDark}
            displayAppName={displayAppName}
            appLogo={appLogo}
          />
      </div>

      {/* Main content */}
        <div className={clsx(
          'transition-all duration-300',
          isCollapsed ? 'lg:pl-20' : 'lg:pl-72'
        )}>
          {/* Top header */}
          <header className={clsx(
            'sticky top-0 z-30 h-16 flex items-center justify-between px-4 lg:px-8 border-b backdrop-blur-xl',
            theme.headerBg
          )}>
            {/* Mobil: Sol - Hamburger */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className={clsx('lg:hidden p-2 rounded-xl transition-colors', theme.buttonSecondary)}
              aria-label="Menüyü aç"
              aria-expanded={sidebarOpen}
            >
              <Menu className={clsx('h-6 w-6', theme.headerText)} aria-hidden="true" />
            </button>

            {/* Mobil: Orta - Logo (absolute ile tam ortada) */}
            <div className="absolute left-1/2 -translate-x-1/2 lg:hidden">
              <img 
                src={appLogo} 
                alt={appName || 'Clixer'} 
                className="h-8 object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (target.src !== window.location.origin + '/logo.png') {
                    target.src = '/logo.png';
                  }
                }}
              />
            </div>
            
            {/* Mobil: Sağ - Filtre İkonu (Sadece Dashboard/Analiz sayfalarında) */}
            {(location.pathname === '/dashboard' || location.pathname === '/analysis' || location.pathname.startsWith('/analysis/')) && (
              <button
                onClick={() => setMobileFilterOpen(true)}
                className={clsx('lg:hidden p-2 rounded-xl transition-colors ml-auto', theme.buttonSecondary)}
                aria-label="Filtreleri aç"
              >
                <SlidersHorizontal className={clsx('h-5 w-5', theme.headerText)} aria-hidden="true" />
              </button>
            )}

            {/* Search bar - Desktop (Command Palette Trigger) */}
            <div className="hidden lg:flex items-center flex-1 max-w-xl">
              <button
                onClick={() => setSearchOpen(true)}
                className={clsx(
                  'flex items-center w-full px-4 py-2 rounded-xl border transition-colors text-left',
                  theme.inputBg,
                  'hover:border-indigo-500/50'
                )}
              >
                <Search className={clsx('h-4 w-4', theme.contentTextMuted)} aria-hidden="true" />
                <span className={clsx(
                  'flex-1 ml-3 text-sm',
                  theme.inputPlaceholder?.replace('placeholder:', '') || 'text-slate-400'
                )}>
                  Sayfa, metrik veya komut ara...
                </span>
                <kbd className={clsx(
                  'hidden sm:block px-2 py-0.5 text-xs font-medium rounded',
                  isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-200 text-slate-500'
                )}>⌘K</kbd>
              </button>
            </div>

            {/* Right side actions - Mobilde gizli */}
            <div className="hidden lg:flex items-center gap-2">
              {/* Notifications */}
              <button className={clsx(
                'relative p-2 rounded-xl transition-colors',
                theme.buttonSecondary
              )}>
                <Bell className={clsx('h-5 w-5', theme.contentTextMuted)} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full" />
              </button>

              {/* Activity indicator */}
              <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg', theme.success)}>
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium">Canlı</span>
              </div>
            </div>
          </header>

        {/* Page content */}
          <main className={clsx('p-4 lg:p-8 min-h-[calc(100vh-4rem)]', theme.contentText)}>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      
      {/* Command Palette - Akıllı Arama Modal */}
      <CommandPalette />
      
      {/* Toast Notifications - Tutarlı hata/başarı mesajları */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            padding: '12px 16px',
            fontSize: '14px',
            fontWeight: '500',
          },
        }}
      />
    </div>
    </ThemeContext.Provider>
  )
}

interface SidebarContentProps {
  location: { pathname: string }
  user: any
  logout: () => void
  isCollapsed?: boolean
  toggleCollapse?: () => void
  currentTheme: ThemeType
  setCurrentTheme: (theme: ThemeType) => void
  language: 'tr' | 'en'
  setLanguage: (lang: 'tr' | 'en') => void
  menuItems: MenuItem[]
  theme: ThemeColors
  isDark: boolean
  onClose?: () => void
  displayAppName?: string
  appLogo?: string
}

function SidebarContent({ 
  location, 
  user, 
  logout, 
  isCollapsed = false,
  toggleCollapse,
  currentTheme,
  setCurrentTheme,
  language,
  setLanguage,
  menuItems,
  theme,
  isDark,
  onClose,
  displayAppName = 'CLIXER',
  appLogo
}: SidebarContentProps) {
  const navigate = useNavigate()

  const handleNavClick = (href: string) => {
    navigate(href)
    if (onClose) onClose()
  }

  return (
    <div className={clsx('flex h-full flex-col', theme.sidebar)}>
      {/* Logo */}
      <div className={clsx(
        'flex items-center border-b relative',
        theme.sidebarBorder,
        isCollapsed ? 'h-20 justify-center px-2' : 'h-36 justify-center px-4'
      )}>
        <button 
          onClick={() => handleNavClick('/dashboard')}
          className="flex items-center justify-center hover:opacity-80 transition-opacity w-full h-full py-4"
        >
          <img 
            src={appLogo} 
            alt={displayAppName || 'Clixer'} 
            className={clsx(
              'object-contain transition-all drop-shadow-lg',
              // Collapse durumuna göre boyut ayarla - daha büyük ve okunabilir
              isCollapsed ? 'h-12 w-12' : 'h-20 max-w-[180px]',
              // Açık temada logo'ya hafif gölge ekle
              !isDark && 'brightness-95'
            )} 
            onError={(e) => {
              // Yükleme hatası olursa fallback logo kullan
              const target = e.target as HTMLImageElement;
              if (target.src !== window.location.origin + '/logo.png') {
                target.src = '/logo.png';
              }
            }}
          />
        </button>
        
        {onClose && (
          <button onClick={onClose} className={clsx('lg:hidden p-1 absolute right-4 top-1/2 -translate-y-1/2', theme.sidebarTextMuted)}>
            <X size={24} />
          </button>
        )}
      </div>

      {/* User info */}
      <div className={clsx(
        'border-b',
        theme.sidebarBorder,
        theme.sidebarBgAlt,
        isCollapsed ? 'px-2 py-6 flex justify-center' : 'px-6 py-6'
      )}>
        <div className={clsx('flex items-center', isCollapsed ? 'justify-center' : 'gap-4')}>
          <div className={clsx(
            'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shadow-inner bg-gradient-to-br text-white',
            theme.accent
          )}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden">
              <p className={clsx('text-sm font-bold truncate', theme.sidebarText)}>{user?.name || 'Kullanıcı'}</p>
              <p className={clsx('text-xs truncate uppercase tracking-wide font-medium', theme.sidebarTextMuted)}>
                {user?.role?.replace('_', ' ') || 'VIEWER'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = !item.isExternal && (location.pathname === item.href || 
            (item.href !== '/dashboard' && location.pathname.startsWith(item.href)))
          
          // External link (Eğitim Merkezi gibi)
          if (item.isExternal) {
            const getExternalUrl = () => {
              const hostname = window.location.hostname
              if (hostname === 'localhost' || hostname === '127.0.0.1') {
                return 'http://localhost:3001/edu'
              }
              // Production'da aynı domain üzerinde /edu path'i kullan
              return `${window.location.origin}/edu`
            }
            
            return (
              <a
                key={item.id}
                href={getExternalUrl()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  e.stopPropagation()
                  // Manuel olarak yeni sekmede aç
                  window.open(getExternalUrl(), '_blank', 'noopener,noreferrer')
                  e.preventDefault()
                }}
                className={clsx(
                  'flex items-center w-full py-3 text-sm font-bold rounded-xl transition-all duration-200 group relative',
                  theme.sidebarTextMuted,
                  theme.sidebarHover,
                  isCollapsed ? 'justify-center px-0' : 'px-4'
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon 
                  size={20} 
                  className={clsx(
                    'transition-transform duration-300 shrink-0 group-hover:scale-110',
                    !isCollapsed && 'mr-3'
                  )} 
                />
                {!isCollapsed && (
                  <>
                    <span className={clsx('group-hover:' + theme.sidebarText)}>{item.name}</span>
                    <ExternalLink size={14} className="ml-auto opacity-50" />
                  </>
                )}
              </a>
            )
          }
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.href)}
              className={clsx(
                'flex items-center w-full py-3 text-sm font-bold rounded-xl transition-all duration-200 group relative',
                isActive
                  ? theme.sidebarActive
                  : clsx(theme.sidebarTextMuted, theme.sidebarHover),
                isCollapsed ? 'justify-center px-0' : 'px-4'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon 
                size={20} 
                className={clsx(
                  'transition-transform duration-300 shrink-0',
                  isActive ? 'scale-110' : 'group-hover:scale-110',
                  !isCollapsed && 'mr-3'
                )} 
              />
              
              {!isCollapsed && (
                <>
                  <span className={clsx(!isActive && 'group-hover:' + theme.sidebarText)}>{item.name}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                  {item.badge && (
                    <span className={clsx(
                      'ml-2 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider',
                      theme.badge,
                      theme.badgeText
                    )}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </button>
          )
        })}

        {/* Profile Menu Item */}
        <button
          onClick={() => handleNavClick('/profile')}
          className={clsx(
            'flex items-center w-full py-3 text-sm font-bold rounded-xl transition-all duration-200 group relative',
            location.pathname === '/profile'
              ? theme.sidebarActive
              : clsx(theme.sidebarTextMuted, theme.sidebarHover),
            isCollapsed ? 'justify-center px-0' : 'px-4'
          )}
          title={isCollapsed ? 'Profilim' : undefined}
        >
          <UserIcon 
            size={20} 
            className={clsx(
              'transition-transform duration-300 shrink-0',
              location.pathname === '/profile' ? 'scale-110' : 'group-hover:scale-110',
              !isCollapsed && 'mr-3'
            )} 
          />
          {!isCollapsed && (
            <>
              <span className={clsx(location.pathname !== '/profile' && 'group-hover:' + theme.sidebarText)}>Profilim</span>
              {location.pathname === '/profile' && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </>
          )}
        </button>

      </nav>

      {/* Collapse Button (Desktop Only) */}
      {toggleCollapse && (
        <div className={clsx(
          'hidden lg:flex justify-center p-2 border-t',
          theme.sidebarBorder
        )}>
          <button
            onClick={toggleCollapse}
            className={clsx(
              'p-2 rounded-full transition-colors',
              theme.buttonSecondary
            )}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
      )}

      {/* Theme & Language Switcher */}
      <div className={clsx(
        'border-t space-y-4',
        theme.sidebarBorder,
        theme.sidebarBgAlt,
        isCollapsed ? 'p-2' : 'p-4'
      )}>
        {!isCollapsed && (
          <>
            {/* Theme Toggles - 3 Tema */}
            <div className="grid grid-cols-3 gap-1.5">
              <button
                onClick={() => setCurrentTheme('clixer')}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg border-2 transition-all text-xs font-bold',
                  currentTheme === 'clixer'
                    ? 'border-[#00CFDE] bg-[#00CFDE]/10 text-[#00CFDE]'
                    : clsx('border-transparent', theme.buttonSecondary)
                )}
              >
                <Activity size={14} />
                Clixer
              </button>
              <button
                onClick={() => setCurrentTheme('light')}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg border-2 transition-all text-xs font-bold',
                  currentTheme === 'light'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600'
                    : clsx('border-transparent', theme.buttonSecondary)
                )}
              >
                <Sun size={14} />
                Aydınlık
              </button>
              <button
                onClick={() => setCurrentTheme('corporate')}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 p-2 rounded-lg border-2 transition-all text-xs font-bold',
                  currentTheme === 'corporate'
                    ? 'border-[#00ABBD] bg-[#00ABBD]/10 text-[#026E81]'
                    : clsx('border-transparent', theme.buttonSecondary)
                )}
              >
                <Zap size={14} />
                Kurumsal
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setLanguage('tr')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  language === 'tr'
                    ? theme.buttonSecondary
                    : theme.sidebarTextMuted
                )}
              >
                🇹🇷 Türkçe
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
                  language === 'en'
                    ? theme.buttonSecondary
                    : theme.sidebarTextMuted
                )}
              >
                🇬🇧 English
              </button>
            </div>
          </>
        )}

        <button
          onClick={logout}
          className={clsx(
            'flex items-center w-full py-3 text-sm font-bold rounded-xl transition-all',
            theme.sidebarTextMuted,
            theme.sidebarHover,
            isCollapsed ? 'justify-center px-0' : 'justify-center px-4'
          )}
          title={isCollapsed ? 'Çıkış Yap' : undefined}
        >
          <LogOut size={18} className={!isCollapsed ? 'mr-2' : ''} />
          {!isCollapsed && 'Çıkış Yap'}
        </button>
      </div>
    </div>
  )
}
