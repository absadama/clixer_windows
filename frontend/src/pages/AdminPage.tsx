import { useState, useEffect, useCallback } from 'react'
import { useTheme } from '../components/Layout'
import { useAuthStore } from '../stores/authStore'
import { 
  Shield,
  Settings,
  Users,
  Lock,
  Key,
  Activity,
  Globe,
  Bell,
  Palette,
  Plus,
  Edit2,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  Check,
  Database,
  Building2,
  MapPin,
  Upload,
  Download,
  FileSpreadsheet,
  Gauge,
  Zap,
  Clock,
  HardDrive,
  MemoryStick,
  Eraser,
  Tag,
  Save,
} from 'lucide-react'
import clsx from 'clsx'
import { SystemSetting } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || '/api'


// Menü öğeleri - Sadeleştirilmiş
const menuItems = [
  { id: 'settings', label: 'Sistem Ayarları', icon: Settings, category: 'SİSTEM' },
  { id: 'labels', label: 'Etiketler', icon: Tag, category: 'SİSTEM' },
  { id: 'performance', label: 'Performans', icon: Gauge, category: 'SİSTEM' },
  { id: 'master', label: 'Master Veriler', icon: Database, category: 'SİSTEM' },
  { id: 'monitor', label: 'Sistem Monitörü', icon: Activity, category: 'SİSTEM' },
  { id: 'backup', label: 'Yedekleme', icon: HardDrive, category: 'SİSTEM' },
  { id: 'users', label: 'Kullanıcı Yönetimi', icon: Users, category: 'KULLANICILAR' },
  { id: 'roles', label: 'Rol & Yetkiler', icon: Lock, category: 'KULLANICILAR' },
  { id: 'ldap', label: 'LDAP / SSO', icon: Key, category: 'KULLANICILAR' },
]

// Varsayılan sistem ayarları (DB boşsa kullanılacak)
const defaultSettings: SystemSetting[] = [
  // GENEL
  { key: 'app_name', category: 'general', value: 'Clixer', label: 'Uygulama Adı', description: 'Uygulamanın görünen adı', type: 'string' },
  { key: 'app_logo', category: 'general', value: '/logo.png', label: 'Logo URL', description: 'Ana logo dosyası yolu', type: 'string' },
  { key: 'app_favicon', category: 'general', value: '/favicon.ico', label: 'Favicon', description: 'Tarayıcı sekmesi ikonu', type: 'string' },
  { key: 'app_tagline', category: 'general', value: 'Olağanüstü Veri Hızı', label: 'Slogan', description: 'Uygulama sloganı', type: 'string' },
  { key: 'support_email', category: 'general', value: 'support@clixer.io', label: 'Destek E-posta', description: 'Müşteri destek e-postası', type: 'string' },
  { key: 'company_name', category: 'general', value: 'Clixer Analytics', label: 'Şirket Adı', description: 'Yasal şirket adı', type: 'string' },
  // TEMA
  { key: 'default_theme', category: 'theme', value: 'clixer', label: 'Varsayılan Tema', description: 'Yeni kullanıcılar için varsayılan tema', type: 'select', options: ['clixer', 'light', 'corporate'] },
  { key: 'sidebar_collapsed', category: 'theme', value: 'false', label: 'Menü Kapalı Başlasın', description: 'Sidebar varsayılan olarak kapalı mı?', type: 'boolean' },
  { key: 'primary_color', category: 'theme', value: '#6366f1', label: 'Ana Renk', description: 'Uygulamanın ana rengi (hex)', type: 'string' },
  // DİL & BÖLGE
  { key: 'default_language', category: 'locale', value: 'tr', label: 'Varsayılan Dil', description: 'Uygulama dili', type: 'select', options: ['tr', 'en'] },
  { key: 'timezone', category: 'locale', value: 'Europe/Istanbul', label: 'Zaman Dilimi', description: 'Varsayılan timezone', type: 'string' },
  { key: 'date_format', category: 'locale', value: 'DD.MM.YYYY', label: 'Tarih Formatı', description: 'Tarih gösterim formatı', type: 'select', options: ['DD.MM.YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] },
  { key: 'currency', category: 'locale', value: 'TRY', label: 'Para Birimi', description: 'Varsayılan para birimi', type: 'select', options: ['TRY', 'USD', 'EUR'] },
  { key: 'number_format', category: 'locale', value: '1.234,56', label: 'Sayı Formatı', description: 'Sayısal değer gösterimi', type: 'select', options: ['1.234,56', '1,234.56'] },
  // GÜVENLİK
  { key: 'session_timeout', category: 'security', value: '30', label: 'Oturum Zaman Aşımı (dk)', description: 'İşlem yapılmadığında oturum kapanma süresi', type: 'number' },
  { key: 'password_min_length', category: 'security', value: '8', label: 'Min. Şifre Uzunluğu', description: 'Şifre için minimum karakter sayısı', type: 'number' },
  { key: 'require_2fa', category: 'security', value: 'false', label: '2FA Zorunlu', description: 'İki faktörlü doğrulama zorunlu mu?', type: 'boolean' },
  { key: 'max_login_attempts', category: 'security', value: '5', label: 'Max Giriş Denemesi', description: 'Hesap kilitlenmeden önce max deneme', type: 'number' },
  { key: 'lockout_duration', category: 'security', value: '15', label: 'Kilitleme Süresi (dk)', description: 'Hesap kilitleme süresi', type: 'number' },
  // BİLDİRİMLER
  { key: 'email_notifications', category: 'notifications', value: 'true', label: 'E-posta Bildirimleri', description: 'E-posta ile bildirim gönder', type: 'boolean' },
  { key: 'push_notifications', category: 'notifications', value: 'true', label: 'Push Bildirimleri', description: 'Tarayıcı push bildirimleri', type: 'boolean' },
  { key: 'daily_report', category: 'notifications', value: 'false', label: 'Günlük Rapor', description: 'Her gün özet rapor gönder', type: 'boolean' },
  { key: 'alert_threshold', category: 'notifications', value: '10', label: 'Uyarı Eşiği (%)', description: 'KPI değişim uyarı eşiği', type: 'number' },
  // FİNANS - Görünürlük
  { key: 'finance_show_roi', category: 'finance', value: 'true', label: 'ROI Göster', description: 'Finans sayfasında ROI kartını göster', type: 'boolean' },
  { key: 'finance_show_profit_margin', category: 'finance', value: 'true', label: 'Kar Marjı Göster', description: 'Finans sayfasında kar marjı kartını göster', type: 'boolean' },
  { key: 'finance_show_expense_breakdown', category: 'finance', value: 'true', label: 'Gider Dağılımı Göster', description: 'Finans sayfasında gider dağılım grafiğini göster', type: 'boolean' },
  { key: 'finance_show_amortization_warning', category: 'finance', value: 'true', label: 'Amorti Uyarısı Göster', description: 'Finans sayfasında "Amorti Edilemiyor" uyarı kartını göster', type: 'boolean' },
  // FİNANS - Genel
  { key: 'fiscal_year_start', category: 'finance', value: '01', label: 'Mali Yıl Başlangıç Ayı', description: 'Mali yılın başladığı ay (1-12)', type: 'number' },
  { key: 'budget_period', category: 'finance', value: 'monthly', label: 'Bütçe Periyodu', description: 'Bütçe takip periyodu', type: 'select', options: ['weekly', 'monthly', 'quarterly', 'yearly'] },
  { key: 'tax_rate', category: 'finance', value: '20', label: 'Vergi Oranı (%)', description: 'Varsayılan vergi oranı', type: 'number' },
  { key: 'finance_target_profit_margin', category: 'finance', value: '25', label: 'Hedef Kar Marjı (%)', description: 'Hedeflenen kar marjı yüzdesi', type: 'number' },
  { key: 'finance_target_roi', category: 'finance', value: '15', label: 'Hedef ROI (%)', description: 'Hedeflenen yatırım getirisi yüzdesi', type: 'number' },
  { key: 'finance_currency', category: 'finance', value: 'TRY', label: 'Para Birimi', description: 'Finans hesaplamalarında kullanılacak para birimi', type: 'select', options: ['TRY', 'USD', 'EUR'] },
]

export default function AdminPage() {
  const { theme, isDark } = useTheme()
  const { accessToken } = useAuthStore()
  const [activeTab, setActiveTab] = useState('settings')
  const [settings, setSettings] = useState<SystemSetting[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [seeding, setSeeding] = useState(false)
  
  // Performans Ayarları States
  const [perfSettings, setPerfSettings] = useState<any>({})
  const [perfLoading, setPerfLoading] = useState(false)
  const [cacheClearLoading, setCacheClearLoading] = useState(false)
  const [redisInfo, setRedisInfo] = useState<any>(null)
  
  // Kullanıcı Yönetimi States
  const [users, setUsers] = useState<any[]>([])
  const [positions, setPositions] = useState<any[]>([])
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userForm, setUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'USER',  // Sistem rolü (ADMIN, MANAGER, USER, VIEWER)
    position_code: 'VIEWER',
    stores: [] as { store_id: string; store_name: string }[],
    filter_value: ''  // RLS için filtre değeri (mağaza/bölge/grup kodu)
  })
  
  // Rol Düzenleme States
  const [editingRole, setEditingRole] = useState<any>(null)
  const [rolePermissions, setRolePermissions] = useState<any[]>([])
  
  // LDAP States
  const [ldapConfig, setLdapConfig] = useState<any>(null)
  const [ldapForm, setLdapForm] = useState({
    name: 'Default LDAP',
    server_url: '',
    base_dn: '',
    bind_dn: '',
    bind_password: '',
    user_search_base: '',
    user_filter: '(&(objectClass=user)(mail=*))',
    group_search_base: '',
    group_filter: '(objectClass=group)',
    sync_schedule: 'manual',
    is_active: false
  })
  const [ldapTesting, setLdapTesting] = useState(false)
  const [ldapTestResult, setLdapTestResult] = useState<{success: boolean; message: string} | null>(null)
  const [ldapGroups, setLdapGroups] = useState<any[]>([])
  const [loadingLdapGroups, setLoadingLdapGroups] = useState(false)
  const [positionMappings, setPositionMappings] = useState<any[]>([])
  const [storeMappings, setStoreMappings] = useState<any[]>([])
  const [syncLogs, setSyncLogs] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)
  const [showMappingModal, setShowMappingModal] = useState<'position' | 'store' | null>(null)
  const [mappingForm, setMappingForm] = useState({ ldap_group_dn: '', ldap_group_name: '', position_code: 'VIEWER', store_id: '', store_name: '', grants_all_stores: false })
  
  // Sistem Monitörü States
  const [activeSessions, setActiveSessions] = useState<any[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  
  
  // Logo Upload States
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [logoInfo, setLogoInfo] = useState<{
    hasCustomLogo: boolean
    currentLogoUrl: string
    currentFaviconUrl: string
  } | null>(null)
  
  // Yedekleme States
  const [backups, setBackups] = useState<any[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)
  
  // Mağaza ve bölge verileri (API'den gelecek)
  const [availableStores, setAvailableStores] = useState<{
    store_id: string
    store_name: string
    store_type?: string
    region_id?: string
    region_name?: string
  }[]>([])
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  
  // Kullanıcı atama filtreleri
  const [storeFilterRegion, setStoreFilterRegion] = useState<string>('')
  const [storeFilterType, setStoreFilterType] = useState<string>('')
  const [storeSearchTerm, setStoreSearchTerm] = useState<string>('')
  
  // Master Veriler States
  const [masterTab, setMasterTab] = useState<'stores' | 'regions' | 'groups'>('stores')
  const [allStores, setAllStores] = useState<any[]>([])
  const [allRegions, setAllRegions] = useState<any[]>([])
  const [ownershipGroups, setOwnershipGroups] = useState<any[]>([])
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  const [editingStore, setEditingStore] = useState<any>(null)
  const [editingRegion, setEditingRegion] = useState<any>(null)
  const [editingGroup, setEditingGroup] = useState<any>(null)
  const [storeForm, setStoreForm] = useState({
    code: '', name: '', store_type: 'MAGAZA', ownership_group: 'MERKEZ', region_id: '',
    city: '', district: '', address: '', phone: '', email: '', manager_name: '', manager_email: '',
    opening_date: '', square_meters: '', employee_count: '', rent_amount: '', target_revenue: ''
  })
  const [regionForm, setRegionForm] = useState({
    code: '', name: '', description: '', manager_name: '', manager_email: ''
  })
  const [groupForm, setGroupForm] = useState({
    code: '', name: '', description: '', color: '#3B82F6', icon: '🏢'
  })
  const [masterSearchQuery, setMasterSearchQuery] = useState('')
  const [showImportModal, setShowImportModal] = useState<'stores' | 'regions' | null>(null)
  const [importData, setImportData] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  
  // Dataset'ten Import States
  const [showDatasetImportModal, setShowDatasetImportModal] = useState(false)
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [datasetColumns, setDatasetColumns] = useState<{ name: string; type: string }[]>([])
  const [datasetPreview, setDatasetPreview] = useState<any[]>([])
  const [datasetTotalRows, setDatasetTotalRows] = useState(0)
  const [datasetImportMapping, setDatasetImportMapping] = useState<Record<string, string>>({
    code: '', name: '', store_type: '', ownership_group: '', region_code: '', 
    city: '', district: '', address: '', phone: '', email: '', manager_name: ''
  })
  const [datasetImporting, setDatasetImporting] = useState(false)
  const [datasetImportResult, setDatasetImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)
  
  // Etiketler States
  const [labels, setLabels] = useState<any[]>([])
  const [labelsLoading, setLabelsLoading] = useState(false)
  const [labelsSaving, setLabelsSaving] = useState(false)
  const [labelsTab, setLabelsTab] = useState<'menu' | 'position'>('menu')
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({})
  
  // Labels'dan pozisyon ismi çek (dinamik etiket desteği)
  const getPositionLabel = useCallback((positionCode: string, defaultName: string): string => {
    const label = labels.find(l => l.label_type === 'position' && l.label_key === positionCode)
    return label?.label_value || defaultName
  }, [labels])
  
  // Varsayılan etiketler (referans için - ASCII)
  const defaultMenuLabels: Record<string, string> = {
    dashboard: 'Kokpit',
    finance: 'Finans',
    operations: 'Operasyon',
    analysis: 'Detayli Analiz',
    stores: 'Magazalar',
    designer: 'Tasarim Studyosu',
    data: 'Veri Baglantilari',
    datagrid: 'DataGrid Demo',
    metrics: 'Metrik Yonetimi',
    admin: 'Yonetim Paneli',
    profile: 'Profilim'
  }
  
  const defaultPositionLabels: Record<string, string> = {
    GENERAL_MANAGER: 'Genel Mudur',
    DIRECTOR: 'Direktor',
    REGION_MANAGER: 'Bolge Muduru',
    STORE_MANAGER: 'Magaza Muduru',
    ANALYST: 'Analist',
    VIEWER: 'Izleyici'
  }

  // Filtrelenmiş mağazalar
  const filteredAvailableStores = availableStores.filter(store => {
    if (storeFilterRegion && store.region_id !== storeFilterRegion) return false
    if (storeFilterType && store.store_type !== storeFilterType) return false
    return true
  })

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

  // Ayarları yükle
  const loadSettings = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    try {
      const result = await apiCall('/core/settings')
      // JSON value'ları parse et
      const parsed = (result.data || []).map((s: any) => {
        let val = s.value
        try {
          val = typeof s.value === 'string' ? JSON.parse(s.value) : s.value
        } catch {
          // JSON değilse düz değer kullan
        }
        return {
          key: s.key,
          category: s.category,
          value: typeof val === 'object' ? (val.value || '') : (val || ''),
          label: typeof val === 'object' ? (val.label || s.key) : s.key,
          description: typeof val === 'object' ? (val.description || '') : '',
          type: typeof val === 'object' ? (val.type || 'string') : 'string',
          options: typeof val === 'object' ? (val.options || []) : []
        }
      })
      
      // Eğer DB'de ayar yoksa varsayılanları kullan
      if (parsed.length === 0) {
        setSettings(defaultSettings)
      } else {
        setSettings(parsed)
      }
    } catch (err) {
      console.error('Ayarlar yüklenemedi, varsayılanlar kullanılıyor:', err)
      setSettings(defaultSettings)
    } finally {
      setLoading(false)
    }
  }, [accessToken, apiCall])

  // Performans ayarlarını yükle
  const loadPerfSettings = useCallback(async () => {
    if (!accessToken) return
    setPerfLoading(true)
    try {
      const result = await apiCall('/core/settings?category=performance')
      const parsed: any = {}
      ;(result.data || []).forEach((s: any) => {
        try {
          parsed[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value
        } catch {
          parsed[s.key] = s.value
        }
      })
      setPerfSettings(parsed)
      
      // Redis bilgilerini al
      try {
        const redisResult = await apiCall('/data/performance/redis')
        setRedisInfo(redisResult.data)
      } catch {
        // Redis endpoint yoksa sessizce devam et
      }
    } catch (err) {
      console.error('Performans ayarları yüklenemedi:', err)
    } finally {
      setPerfLoading(false)
    }
  }, [accessToken, apiCall])

  // Etiketleri yükle
  const loadLabels = useCallback(async () => {
    if (!accessToken) return
    setLabelsLoading(true)
    try {
      const result = await apiCall('/core/labels')
      setLabels(result.data || [])
      
      // Düzenleme için mevcut değerleri hazırla
      const edited: Record<string, string> = {}
      ;(result.data || []).forEach((l: any) => {
        edited[`${l.label_type}:${l.label_key}`] = l.label_value
      })
      setEditedLabels(edited)
    } catch (err) {
      console.error('Etiketler yüklenemedi:', err)
    } finally {
      setLabelsLoading(false)
    }
  }, [accessToken, apiCall])
  
  // Etiketleri kaydet
  const saveLabels = async () => {
    setLabelsSaving(true)
    try {
      // Değişen etiketleri topla
      const labelsToSave = Object.entries(editedLabels).map(([key, value]) => {
        const [label_type, label_key] = key.split(':')
        return { label_type, label_key, label_value: value }
      })
      
      await apiCall('/core/labels/batch', {
        method: 'PUT',
        body: JSON.stringify({ labels: labelsToSave })
      })
      
      // Yeniden yükle
      await loadLabels()
      alert('Etiketler kaydedildi!')
    } catch (err: any) {
      alert('Kaydetme hatası: ' + err.message)
    } finally {
      setLabelsSaving(false)
    }
  }
  
  // Etiket değerini güncelle
  const updateLabel = (type: string, key: string, value: string) => {
    setEditedLabels(prev => ({
      ...prev,
      [`${type}:${key}`]: value
    }))
  }
  
  // Etiket değerini al
  const getLabelValue = (type: string, key: string): string => {
    return editedLabels[`${type}:${key}`] || 
           (type === 'menu' ? defaultMenuLabels[key] : defaultPositionLabels[key]) || 
           key
  }

  // Performans ayarını kaydet
  const savePerfSetting = async (key: string, value: any) => {
    setSaving(key)
    try {
      // Mevcut değeri al ve güncelle
      const currentValue = perfSettings[key] || {}
      const newValue = { ...currentValue, ...value }
      
      // Local state hemen güncelle (optimistic update)
      setPerfSettings((prev: any) => ({ ...prev, [key]: newValue }))
      
      // Backend'e gönder - value obje olarak, backend JSON yapacak
      await apiCall(`/core/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({
          value: newValue, // String değil, obje olarak gönder
          category: 'performance'
        })
      })
    } catch (err: any) {
      // Hata durumunda eski değere geri dön
      loadPerfSettings()
      alert('Kaydetme hatası: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // Cache temizle
  const clearCache = async (type: 'all' | 'dashboard' | 'metrics') => {
    setCacheClearLoading(true)
    try {
      await apiCall('/data/cache/clear', {
        method: 'POST',
        body: JSON.stringify({ type })
      })
      alert(`${type === 'all' ? 'Tüm cache' : type === 'dashboard' ? 'Dashboard cache' : 'Metrik cache'} temizlendi!`)
      loadPerfSettings() // Redis info güncelle
    } catch (err: any) {
      alert('Cache temizleme hatası: ' + err.message)
    } finally {
      setCacheClearLoading(false)
    }
  }

  // Ayar kaydet
  const saveSetting = async (key: string, newValue: string) => {
    setSaving(key)
    try {
      const setting = settings.find(s => s.key === key)
      await apiCall(`/core/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({
          value: newValue,
          label: setting?.label,
          description: setting?.description,
          type: setting?.type,
          category: setting?.category
        })
      })
      // Local state güncelle
      setSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s))
      setEditingKey(null)
      setEditValue('')
    } catch (err: any) {
      alert('Kaydetme hatası: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // Varsayılan ayarları DB'ye kaydet
  const seedDefaultSettings = async () => {
    if (!confirm('Varsayılan ayarlar veritabanına kaydedilecek. Mevcut ayarlar güncellenmeyecek. Devam?')) return
    setSeeding(true)
    try {
      for (const setting of defaultSettings) {
        try {
          await apiCall('/core/settings', {
            method: 'POST',
            body: JSON.stringify({
              key: setting.key,
              value: setting.value,
              category: setting.category,
              type: setting.type,
              label: setting.label,
              description: setting.description
            })
          })
        } catch (e: any) {
          // Zaten varsa atla
          if (!e.message?.includes('zaten')) console.warn(`Ayar atlandı: ${setting.key}`)
        }
      }
      alert('Varsayılan ayarlar kaydedildi!')
      loadSettings()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setSeeding(false)
    }
  }

  // Logo bilgisini yükle
  const loadLogoInfo = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/logo-info')
      if (result.data) {
        setLogoInfo(result.data)
      }
    } catch (err) {
      console.error('Logo bilgisi yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Logo dosyası seçildiğinde
  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setLogoError(null)

    // Dosya tipi kontrolü
    if (!['image/png', 'image/svg+xml'].includes(file.type)) {
      setLogoError('Sadece PNG veya SVG formatı kabul edilir')
      return
    }

    // Dosya boyutu kontrolü (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setLogoError('Dosya boyutu en fazla 5MB olabilir')
      return
    }

    // PNG ise boyut kontrolü
    if (file.type === 'image/png') {
      const img = new Image()
      img.onload = () => {
        if (img.width < 512 || img.height < 512) {
          setLogoError(`Logo en az 512x512 piksel olmalı. Yüklenen: ${img.width}x${img.height}`)
          setLogoFile(null)
          setLogoPreview(null)
        } else {
          setLogoFile(file)
          setLogoPreview(URL.createObjectURL(file))
        }
      }
      img.src = URL.createObjectURL(file)
    } else {
      // SVG için direkt kabul et
      setLogoFile(file)
      setLogoPreview(URL.createObjectURL(file))
    }
  }

  // Logo yükle
  const uploadLogo = async () => {
    if (!logoFile) return

    setLogoUploading(true)
    setLogoError(null)

    try {
      const formData = new FormData()
      formData.append('logo', logoFile)

      const response = await fetch(`${API_BASE}/core/upload/logo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        body: formData
      })

      // Response text olarak al, sonra JSON parse et
      const text = await response.text()
      let result
      try {
        result = JSON.parse(text)
      } catch {
        // JSON parse hatası - muhtemelen HTML veya proxy error
        if (!response.ok) {
          throw new Error(`Sunucu hatası: ${response.status}`)
        }
        // 200 ama JSON değilse bile devam et
        result = { success: true }
      }

      if (!response.ok) {
        throw new Error(result.error || 'Logo yüklenemedi')
      }

      // Başarılı - state temizle ve bilgiyi güncelle
      setLogoFile(null)
      setLogoPreview(null)
      await loadLogoInfo()
      alert('Logo başarıyla yüklendi! Sidebar ve PWA logosu güncellendi.')
      
      // Sayfayı yenile ki yeni logo görünsün
      window.location.reload()
    } catch (err: any) {
      setLogoError(err.message || 'Logo yüklenirken hata oluştu')
    } finally {
      setLogoUploading(false)
    }
  }

  // Aktif oturumları yükle
  const loadSessions = useCallback(async () => {
    if (!accessToken) return
    setSessionsLoading(true)
    try {
      const result = await apiCall('/data/admin/sessions')
      setActiveSessions(result.data || [])
    } catch (err) {
      console.error('Oturumlar yüklenemedi:', err)
      setActiveSessions([])
    } finally {
      setSessionsLoading(false)
    }
  }, [accessToken, apiCall])


  // Yedekleri yükle
  const loadBackups = useCallback(async () => {
    if (!accessToken) return
    setBackupsLoading(true)
    try {
      const result = await apiCall('/data/admin/backup/list')
      setBackups(result.data || [])
    } catch (err) {
      console.error('Yedekler yüklenemedi:', err)
      setBackups([])
    } finally {
      setBackupsLoading(false)
    }
  }, [accessToken, apiCall])

  // Yedek oluştur
  const createBackup = async () => {
    setBackupCreating(true)
    try {
      await apiCall('/data/admin/backup/create', { method: 'POST' })
      alert('✅ Yedek oluşturma başlatıldı!')
      loadBackups()
    } catch (err: any) {
      alert('Yedek oluşturulamadı: ' + err.message)
    } finally {
      setBackupCreating(false)
    }
  }

  // Oturumu sonlandır
  const killSession = async (userId: string) => {
    if (!confirm('Bu kullanıcının oturumunu sonlandırmak istediğinize emin misiniz?')) return
    try {
      await apiCall(`/data/admin/sessions/${userId}`, { method: 'DELETE' })
      alert('✅ Oturum sonlandırıldı')
      loadSessions()
    } catch (err: any) {
      alert('Oturum sonlandırılamadı: ' + err.message)
    }
  }

  // Kullanıcıları yükle
  const loadUsers = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/users')
      setUsers(result.data || [])
    } catch (err) {
      console.error('Kullanıcılar yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Pozisyonları yükle
  const loadPositions = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/positions')
      setPositions(result.data || [])
    } catch (err) {
      console.error('Pozisyonlar yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Mağazaları ve bölgeleri yükle
  const loadStoresAndRegions = useCallback(async () => {
    if (!accessToken) return
    try {
      // Bölgeleri çek
      const regionsResult = await apiCall('/core/regions')
      const regionsData = regionsResult.data || []
      setRegions(regionsData.map((r: any) => ({
        id: r.id,
        name: r.name
      })))
      setAllRegions(regionsData)
      
      // Mağazaları çek
      const storesResult = await apiCall('/core/stores')
      const storesData = storesResult.data || []
      setAvailableStores(storesData.map((s: any) => ({
        store_id: s.code,  // code kullanıyoruz, id değil
        store_name: s.name,
        store_type: s.store_type,
        region_id: s.region_id,
        region_name: s.region_name
      })))
      setAllStores(storesData)
      
      // Sahiplik gruplarını çek
      try {
        const groupsResult = await apiCall('/core/ownership-groups')
        setOwnershipGroups(groupsResult.data || [])
      } catch (e) {
        // ownership-groups endpoint yoksa varsayılan kullan
        setOwnershipGroups([
          { code: 'MERKEZ', name: 'Merkez Mağazalar' },
          { code: 'FRANCHISE', name: 'Franchise Mağazalar' }
        ])
      }
    } catch (err) {
      console.error('Mağazalar/bölgeler yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Dataset listesini yükle (Import için)
  const loadDatasetsForImport = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/data/datasets')
      setAvailableDatasets(result.data || [])
    } catch (err) {
      console.error('Dataset listesi yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Seçilen dataset'in önizlemesini al
  const loadDatasetPreview = useCallback(async (datasetId: string) => {
    if (!datasetId) {
      setDatasetColumns([])
      setDatasetPreview([])
      setDatasetTotalRows(0)
      return
    }
    try {
      const result = await apiCall('/core/stores/import-from-dataset/preview', {
        method: 'POST',
        body: JSON.stringify({ datasetId })
      })
      if (result.success) {
        setDatasetColumns(result.data.columns || [])
        setDatasetPreview(result.data.preview || [])
        setDatasetTotalRows(result.data.totalRows || 0)
      }
    } catch (err) {
      console.error('Dataset önizleme yüklenemedi:', err)
    }
  }, [apiCall])

  // Dataset'ten mağaza import et
  const importFromDataset = async () => {
    if (!selectedDatasetId || !datasetImportMapping.code) {
      alert('Lütfen dataset ve en az "Kod" alanını eşleştirin')
      return
    }
    
    setDatasetImporting(true)
    setDatasetImportResult(null)
    try {
      // Boş mapping'leri filtrele
      const cleanMapping: Record<string, string> = {}
      for (const [key, value] of Object.entries(datasetImportMapping)) {
        if (value) cleanMapping[key] = value
      }
      
      const result = await apiCall('/core/stores/import-from-dataset', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          mapping: cleanMapping
        })
      })
      
      setDatasetImportResult({
        imported: result.imported || 0,
        updated: result.updated || 0,
        errors: result.errors || []
      })
      
      // Mağazaları yenile
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Import başarısız')
    } finally {
      setDatasetImporting(false)
    }
  }

  // Dataset import modalı açılınca dataset listesini yükle
  useEffect(() => {
    if (showDatasetImportModal) {
      loadDatasetsForImport()
    }
  }, [showDatasetImportModal, loadDatasetsForImport])

  // Seçilen dataset değişince önizleme yükle
  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetPreview(selectedDatasetId)
    }
  }, [selectedDatasetId, loadDatasetPreview])

  // Mağaza kaydet
  const saveStore = async () => {
    setSaving('store')
    try {
      const payload = {
        ...storeForm,
        square_meters: storeForm.square_meters ? parseInt(storeForm.square_meters) : null,
        employee_count: storeForm.employee_count ? parseInt(storeForm.employee_count) : null,
        rent_amount: storeForm.rent_amount ? parseFloat(storeForm.rent_amount) : null,
        target_revenue: storeForm.target_revenue ? parseFloat(storeForm.target_revenue) : null,
        region_id: storeForm.region_id || null
      }
      
      if (editingStore) {
        await apiCall(`/core/stores/${editingStore.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await apiCall('/core/stores', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      setShowStoreModal(false)
      setEditingStore(null)
      setStoreForm({ code: '', name: '', store_type: 'MAGAZA', ownership_group: 'MERKEZ', region_id: '', city: '', district: '', address: '', phone: '', email: '', manager_name: '', manager_email: '', opening_date: '', square_meters: '', employee_count: '', rent_amount: '', target_revenue: '' })
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Mağaza kaydedilemedi')
    } finally {
      setSaving(null)
    }
  }

  // Bölge kaydet
  const saveRegion = async () => {
    setSaving('region')
    try {
      if (editingRegion) {
        await apiCall(`/core/regions/${editingRegion.id}`, {
          method: 'PUT',
          body: JSON.stringify(regionForm)
        })
      } else {
        await apiCall('/core/regions', {
          method: 'POST',
          body: JSON.stringify(regionForm)
        })
      }
      setShowRegionModal(false)
      setEditingRegion(null)
      setRegionForm({ code: '', name: '', description: '', manager_name: '', manager_email: '' })
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Bölge kaydedilemedi')
    } finally {
      setSaving(null)
    }
  }

  // Grup kaydet
  const saveGroup = async () => {
    setSaving('group')
    try {
      if (editingGroup) {
        await apiCall(`/core/ownership-groups/${editingGroup.id}`, {
          method: 'PUT',
          body: JSON.stringify(groupForm)
        })
      } else {
        await apiCall('/core/ownership-groups', {
          method: 'POST',
          body: JSON.stringify(groupForm)
        })
      }
      setShowGroupModal(false)
      setEditingGroup(null)
      setGroupForm({ code: '', name: '', description: '', color: '#3B82F6', icon: '🏢' })
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Grup kaydedilemedi')
    } finally {
      setSaving(null)
    }
  }

  // Silme işlemleri
  const deleteStore = async (id: string) => {
    if (!confirm('Bu mağazayı silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/stores/${id}`, { method: 'DELETE' })
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Mağaza silinemedi')
    }
  }

  const deleteRegion = async (id: string) => {
    if (!confirm('Bu bölgeyi silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/regions/${id}`, { method: 'DELETE' })
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Bölge silinemedi')
    }
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Bu grubu silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/ownership-groups/${id}`, { method: 'DELETE' })
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Grup silinemedi')
    }
  }

  // Excel Import
  const handleImport = async () => {
    if (importData.length === 0) return
    setImporting(true)
    try {
      const endpoint = showImportModal === 'stores' ? '/core/stores/import' : '/core/regions/import'
      const result = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({ data: importData })
      })
      alert(`${result.imported} kayıt başarıyla import edildi.${result.errors?.length ? ` ${result.errors.length} hata var.` : ''}`)
      setShowImportModal(null)
      setImportData([])
      loadStoresAndRegions()
    } catch (err: any) {
      alert(err.message || 'Import başarısız')
    } finally {
      setImporting(false)
    }
  }

  // CSV/Excel dosyası okuma (virgül veya noktalı virgül destekli)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      let text = event.target?.result as string
      // UTF-8 BOM karakterini temizle
      text = text.replace(/^\uFEFF/, '')
      
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        alert('Dosya boş veya geçersiz format. En az başlık + 1 veri satırı olmalı.')
        return
      }
      
      // Delimiter tespiti: noktalı virgül veya virgül
      const firstLine = lines[0]
      const delimiter = firstLine.includes(';') ? ';' : ','
      
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const data = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
        const obj: any = {}
        headers.forEach((h, i) => {
          obj[h] = values[i] || ''
        })
        return obj
      }).filter(row => Object.values(row).some(v => v)) // Boş satırları filtrele
      
      if (data.length === 0) {
        alert('Dosyada geçerli veri satırı bulunamadı.')
        return
      }
      
      setImportData(data)
    }
    reader.readAsText(file, 'UTF-8')
  }

  // CSV Template indir (UTF-8 BOM ile Excel uyumlu)
  const downloadTemplate = (type: 'stores' | 'regions') => {
    // UTF-8 BOM - Excel'in Türkçe karakterleri doğru okuması için
    const BOM = '\uFEFF'
    let csv = BOM
    
    if (type === 'stores') {
      // Başlık satırı
      csv += 'code;name;store_type;ownership_group;region_code;city;district;address;phone;email;manager_name\n'
      // Örnek satırlar - kullanıcı bunları silerek kendi verilerini girecek
      // store_type: Mağaza tipi (serbest metin - MAGAZA, DEPO, KAFE, RESTORAN vb.)
      // ownership_group: Sahiplik grubu (MERKEZ veya FRANCHISE)
      // region_code: Bölge kodu (mevcut bölgelerden: MARMARA, EGE, IC_ANADOLU, AKDENIZ vb.)
      csv += 'ORNEK001;İstanbul Kadıköy Şube;MAGAZA;MERKEZ;MARMARA;İstanbul;Kadıköy;Bahariye Cad. No:123;0216 123 4567;kadikoy@sirket.com;Ahmet Yılmaz\n'
      csv += 'ORNEK002;Ankara Kızılay Şube;MAGAZA;FRANCHISE;IC_ANADOLU;Ankara;Çankaya;Atatürk Bulvarı No:45;0312 456 7890;kizilay@sirket.com;Mehmet Demir\n'
      csv += 'ORNEK003;Merkez Depo;DEPO;MERKEZ;MARMARA;İstanbul;Esenyurt;OSB 3. Cadde No:10;0212 999 8888;depo@sirket.com;Fatma Kaya\n'
    } else {
      // Başlık satırı
      csv += 'code;name;description;manager_name;manager_email\n'
      // Örnek satır 1
      csv += 'MARMARA;Marmara Bölgesi;İstanbul, Kocaeli, Bursa, Edirne illeri;Ali Veli;marmara@sirket.com\n'
      // Örnek satır 2
      csv += 'EGE;Ege Bölgesi;İzmir, Aydın, Muğla, Denizli illeri;Ayşe Yıldız;ege@sirket.com\n'
      // Örnek satır 3
      csv += 'IC_ANADOLU;İç Anadolu Bölgesi;Ankara, Konya, Eskişehir, Kayseri illeri;Hasan Öz;icanadolu@sirket.com\n'
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${type}_sablon.csv`
    link.click()
  }

  // Kullanıcı kaydet
  const saveUser = async () => {
    setSaving('user')
    try {
      if (editingUser) {
        // Güncelle
        await apiCall(`/core/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: userForm.name,
            role: userForm.role,  // Sistem rolü
            position_code: userForm.position_code,
            stores: userForm.stores,
            filter_value: userForm.filter_value || null  // RLS için filtre değeri
          })
        })
      } else {
        // Yeni oluştur
        await apiCall('/core/users', {
          method: 'POST',
          body: JSON.stringify({
            ...userForm,
            role: userForm.role  // Sistem rolü
          })
        })
      }
      setShowUserModal(false)
      setEditingUser(null)
      setUserForm({ email: '', name: '', password: '', role: 'USER', position_code: 'VIEWER', stores: [], filter_value: '' })
      loadUsers()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // Kullanıcı sil
  const deleteUser = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/users/${userId}`, { method: 'DELETE' })
      loadUsers()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  // Kullanıcı düzenle - Detayları API'den çek (stores dahil)
  const editUser = async (user: any) => {
    try {
      // Kullanıcı detaylarını API'den çek (stores bilgisi dahil)
      const result = await apiCall(`/core/users/${user.id}`)
      const userDetail = result.data || user
      
      setEditingUser(userDetail)
      setUserForm({
        email: userDetail.email,
        name: userDetail.name,
        password: '',
        role: userDetail.role || 'USER',  // Sistem rolü
        filter_value: userDetail.filter_value || '',  // RLS için filtre değeri
        position_code: userDetail.position_code || 'VIEWER',
        stores: (userDetail.stores || []).map((s: any) => ({ store_id: s.store_id, store_name: s.store_name }))
      })
      setStoreSearchTerm('')
      setShowUserModal(true)
    } catch (err) {
      console.error('Kullanıcı detayı yüklenemedi:', err)
      // Fallback: mevcut veriyle aç
      setEditingUser(user)
      setUserForm({
        email: user.email,
        name: user.name,
        password: '',
        role: user.role || 'USER',
        position_code: user.position_code || 'VIEWER',
        stores: [],
        filter_value: ''
      })
      setStoreSearchTerm('')
      setShowUserModal(true)
    }
  }

  // Rol izinlerini yükle
  const loadRolePermissions = async (code: string) => {
    try {
      const result = await apiCall(`/core/positions/${code}/permissions`)
      setRolePermissions(result.data || [])
    } catch (err) {
      console.error('İzinler yüklenemedi:', err)
    }
  }

  // Rol izinlerini kaydet
  const saveRolePermissions = async () => {
    if (!editingRole) return
    setSaving('role')
    try {
      await apiCall(`/core/positions/${editingRole.code}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: rolePermissions })
      })
      setEditingRole(null)
      alert('İzinler güncellendi!')
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // LDAP Config yükle
  const loadLdapConfig = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/ldap/config')
      if (result.data) {
        setLdapConfig(result.data)
        setLdapForm({
          name: result.data.name || 'Default LDAP',
          server_url: result.data.server_url || '',
          base_dn: result.data.base_dn || '',
          bind_dn: result.data.bind_dn || '',
          bind_password: '',
          user_search_base: result.data.user_search_base || '',
          user_filter: result.data.user_filter || '(&(objectClass=user)(mail=*))',
          group_search_base: result.data.group_search_base || '',
          group_filter: result.data.group_filter || '(objectClass=group)',
          sync_schedule: result.data.sync_schedule || 'manual',
          is_active: result.data.is_active || false
        })
      }
    } catch (err) {
      console.error('LDAP config yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // LDAP Config kaydet
  const saveLdapConfig = async () => {
    setSaving('ldap')
    try {
      await apiCall('/core/ldap/config', {
        method: 'POST',
        body: JSON.stringify(ldapForm)
      })
      alert('LDAP ayarları kaydedildi!')
      loadLdapConfig()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // LDAP bağlantı testi
  const testLdapConnection = async () => {
    setLdapTesting(true)
    setLdapTestResult(null)
    try {
      const result = await apiCall('/core/ldap/test', {
        method: 'POST',
        body: JSON.stringify({
          server_url: ldapForm.server_url,
          base_dn: ldapForm.base_dn,
          bind_dn: ldapForm.bind_dn,
          bind_password: ldapForm.bind_password
        })
      })
      setLdapTestResult({ success: result.success, message: result.message })
    } catch (err: any) {
      setLdapTestResult({ success: false, message: err.message })
    } finally {
      setLdapTesting(false)
    }
  }

  // LDAP gruplarını çek
  const loadLdapGroups = async () => {
    setLoadingLdapGroups(true)
    try {
      const result = await apiCall('/core/ldap/groups')
      setLdapGroups(result.data || [])
    } catch (err: any) {
      alert('Gruplar yüklenemedi: ' + err.message)
    } finally {
      setLoadingLdapGroups(false)
    }
  }

  // Pozisyon eşlemelerini yükle
  const loadPositionMappings = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/ldap/position-mappings')
      setPositionMappings(result.data || [])
    } catch (err) {
      console.error('Pozisyon eşlemeleri yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Mağaza eşlemelerini yükle
  const loadStoreMappings = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/ldap/store-mappings')
      setStoreMappings(result.data || [])
    } catch (err) {
      console.error('Mağaza eşlemeleri yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Sync loglarını yükle
  const loadSyncLogs = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/ldap/sync-logs?limit=10')
      setSyncLogs(result.data || [])
    } catch (err) {
      console.error('Sync logları yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Pozisyon eşlemesi kaydet
  const savePositionMapping = async () => {
    try {
      await apiCall('/core/ldap/position-mappings', {
        method: 'POST',
        body: JSON.stringify({
          ldap_group_dn: mappingForm.ldap_group_dn,
          ldap_group_name: mappingForm.ldap_group_name,
          position_code: mappingForm.position_code
        })
      })
      setShowMappingModal(null)
      setMappingForm({ ldap_group_dn: '', ldap_group_name: '', position_code: 'VIEWER', store_id: '', store_name: '', grants_all_stores: false })
      loadPositionMappings()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  // Mağaza eşlemesi kaydet
  const saveStoreMapping = async () => {
    try {
      await apiCall('/core/ldap/store-mappings', {
        method: 'POST',
        body: JSON.stringify({
          ldap_group_dn: mappingForm.ldap_group_dn,
          ldap_group_name: mappingForm.ldap_group_name,
          store_id: mappingForm.store_id,
          store_name: mappingForm.store_name,
          grants_all_stores: mappingForm.grants_all_stores
        })
      })
      setShowMappingModal(null)
      setMappingForm({ ldap_group_dn: '', ldap_group_name: '', position_code: 'VIEWER', store_id: '', store_name: '', grants_all_stores: false })
      loadStoreMappings()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  // Eşleme sil
  const deleteMapping = async (type: 'position' | 'store', id: string) => {
    if (!confirm('Bu eşlemeyi silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/ldap/${type}-mappings/${id}`, { method: 'DELETE' })
      if (type === 'position') loadPositionMappings()
      else loadStoreMappings()
    } catch (err: any) {
      alert('Hata: ' + err.message)
    }
  }

  // LDAP sync başlat
  const startLdapSync = async () => {
    setSyncing(true)
    try {
      const result = await apiCall('/core/ldap/sync', { method: 'POST' })
      alert(result.message)
      loadSyncLogs()
      loadUsers()
    } catch (err: any) {
      alert('Sync hatası: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  // Sayfa yüklendiğinde ayarları çek
  useEffect(() => {
    loadSettings()
    loadUsers()
    loadPositions()
    loadStoresAndRegions()
    loadLdapConfig()
    loadPositionMappings()
    loadStoreMappings()
    loadSyncLogs()
    loadPerfSettings()
    loadLabels()
    loadLogoInfo()
  }, [loadSettings, loadUsers, loadPositions, loadStoresAndRegions, loadLdapConfig, loadPositionMappings, loadStoreMappings, loadSyncLogs, loadPerfSettings, loadLabels, loadLogoInfo])

  // Tab değiştiğinde ilgili verileri yükle
  useEffect(() => {
    if (activeTab === 'monitor') loadSessions()
    if (activeTab === 'backup') loadBackups()
  }, [activeTab, loadSessions, loadBackups])

  // Kategoriye göre grupla
  const groupedMenuItems = menuItems.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof menuItems>)

  // Ayar kategorileri
  const settingCategories = [
    { id: 'general', label: 'Genel', icon: Settings, count: settings.filter(s => s.category === 'general').length },
    { id: 'theme', label: 'Tema', icon: Palette, count: settings.filter(s => s.category === 'theme').length },
    { id: 'locale', label: 'Dil & Bölge', icon: Globe, count: settings.filter(s => s.category === 'locale').length },
    { id: 'security', label: 'Güvenlik', icon: Lock, count: settings.filter(s => s.category === 'security').length },
    { id: 'notifications', label: 'Bildirimler', icon: Bell, count: settings.filter(s => s.category === 'notifications').length },
    { id: 'finance', label: 'Finans', icon: Activity, count: settings.filter(s => s.category === 'finance').length },
  ]

  const [activeSettingCategory, setActiveSettingCategory] = useState('general')

  const filteredSettings = settings.filter(s => s.category === activeSettingCategory)

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Sol Menü */}
      <div className={clsx('w-72 rounded-2xl p-4 space-y-1 flex-shrink-0', theme.cardBg)}>
        <div className="p-4 mb-4">
          <div className="flex items-center gap-3">
            <div className={clsx('p-2 rounded-xl', isDark ? 'bg-violet-500/20' : 'bg-violet-100')}>
              <Shield size={24} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
            </div>
            <div>
              <h2 className={clsx('font-bold', theme.contentText)}>Yönetim Paneli</h2>
              <p className={clsx('text-xs', theme.contentTextMuted)}>Sistem yapılandırması</p>
            </div>
          </div>
        </div>

        {Object.entries(groupedMenuItems).map(([category, items]) => (
          <div key={category} className="mb-4">
            <p className={clsx('text-[10px] font-bold uppercase tracking-wider px-3 mb-2', theme.contentTextMuted)}>{category}</p>
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  activeTab === item.id
                    ? theme.buttonPrimary
                    : clsx(theme.contentTextMuted, 'hover:' + theme.contentText, isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100')
                )}
              >
                <item.icon size={18} />
                {item.label}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Ana İçerik */}
      <div className="flex-1 space-y-6">
        {/* Etiketler */}
        {activeTab === 'labels' && (
          <div className="space-y-6">
            {/* Başlık */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-purple-500/20' : 'bg-purple-100')}>
                  <Tag size={24} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
                </div>
                <div>
                  <h2 className={clsx('text-xl font-semibold', theme.contentText)}>Dinamik Etiketler</h2>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Menü ve pozisyon isimlerini şirketinize göre özelleştirin</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => loadLabels()}
                  disabled={labelsLoading}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonSecondary)}
                >
                  <RefreshCw size={16} className={labelsLoading ? 'animate-spin' : ''} />
                  Yenile
                </button>
                <button
                  onClick={saveLabels}
                  disabled={labelsSaving}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonPrimary)}
                >
                  {labelsSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Kaydet
                </button>
              </div>
            </div>

            {/* Tab Seçici */}
            <div className="flex gap-2">
              <button
                onClick={() => setLabelsTab('menu')}
                className={clsx(
                  'px-4 py-2 rounded-xl font-medium transition-all',
                  labelsTab === 'menu' 
                    ? theme.buttonPrimary 
                    : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
                )}
              >
                Menü Etiketleri
              </button>
              <button
                onClick={() => setLabelsTab('position')}
                className={clsx(
                  'px-4 py-2 rounded-xl font-medium transition-all',
                  labelsTab === 'position' 
                    ? theme.buttonPrimary 
                    : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
                )}
              >
                Pozisyon Etiketleri
              </button>
            </div>

            {labelsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-purple-500" />
              </div>
            ) : (
              <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
                {labelsTab === 'menu' && (
                  <div className="space-y-4">
                    <p className={clsx('text-sm mb-4', theme.contentTextMuted)}>
                      Sidebar menüsündeki başlıkları şirketinize uygun şekilde değiştirin. 
                      Örneğin "Mağazalar" yerine "Restoranlar" veya "Fakülteler" yazabilirsiniz.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(defaultMenuLabels).map(([key, defaultValue]) => (
                        <div key={key} className={clsx('p-4 rounded-xl border', theme.cardBg, isDark ? 'border-gray-700' : 'border-gray-200')}>
                          <label className={clsx('block text-xs font-medium mb-1 uppercase tracking-wide', theme.contentTextMuted)}>
                            {key}
                          </label>
                          <input
                            type="text"
                            value={getLabelValue('menu', key)}
                            onChange={(e) => updateLabel('menu', key, e.target.value)}
                            placeholder={defaultValue}
                            className={clsx(
                              'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500',
                              theme.inputBg, theme.inputText,
                              isDark ? 'border-gray-600' : 'border-gray-300'
                            )}
                          />
                          <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Varsayılan: {defaultValue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {labelsTab === 'position' && (
                  <div className="space-y-4">
                    <p className={clsx('text-sm mb-4', theme.contentTextMuted)}>
                      Pozisyon isimlerini şirketinize uygun şekilde değiştirin. 
                      Örneğin "Mağaza Müdürü" yerine "Restoran Müdürü" veya "Dekan" yazabilirsiniz.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(defaultPositionLabels).map(([key, defaultValue]) => (
                        <div key={key} className={clsx('p-4 rounded-xl border', theme.cardBg, isDark ? 'border-gray-700' : 'border-gray-200')}>
                          <label className={clsx('block text-xs font-medium mb-1 uppercase tracking-wide', theme.contentTextMuted)}>
                            {key}
                          </label>
                          <input
                            type="text"
                            value={getLabelValue('position', key)}
                            onChange={(e) => updateLabel('position', key, e.target.value)}
                            placeholder={defaultValue}
                            className={clsx(
                              'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500',
                              theme.inputBg, theme.inputText,
                              isDark ? 'border-gray-600' : 'border-gray-300'
                            )}
                          />
                          <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Varsayılan: {defaultValue}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bilgi Kutusu */}
            <div className={clsx('p-4 rounded-xl', isDark ? 'bg-purple-500/10 border border-purple-500/30' : 'bg-purple-50 border border-purple-200')}>
              <div className="flex gap-3">
                <Tag size={20} className="text-purple-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className={clsx('font-medium', theme.contentText)}>Etiket Kullanımı</p>
                  <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>
                    Etiketler değiştirildiğinde sidebar menüsü ve pozisyon isimleri otomatik olarak güncellenir.
                    Her müşteri (tenant) kendi etiketlerini bağımsız olarak özelleştirebilir.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Performans Ayarları */}
        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Başlık */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                  <Gauge size={24} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                </div>
                <div>
                  <h2 className={clsx('text-xl font-semibold', theme.contentText)}>Performans Ayarları</h2>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Cache, bellek ve performans optimizasyonları</p>
                </div>
              </div>
              <button
                onClick={() => loadPerfSettings()}
                disabled={perfLoading}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonSecondary)}
              >
                <RefreshCw size={16} className={perfLoading ? 'animate-spin' : ''} />
                Yenile
              </button>
            </div>

            {perfLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Cache Durumu */}
                <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
                  <div className="flex items-center gap-3 mb-4">
                    <HardDrive size={20} className="text-blue-500" />
                    <h3 className={clsx('font-semibold', theme.contentText)}>Cache Durumu</h3>
                  </div>
                  
                  {/* Cache Aktif/Pasif */}
                  <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-gray-700">
                    <div>
                      <p className={clsx('font-medium', theme.contentText)}>Cache Aktif</p>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>Tüm cache mekanizmasını aç/kapat</p>
                    </div>
                    <button
                      onClick={() => savePerfSetting('cache_enabled', { enabled: !perfSettings.cache_enabled?.enabled })}
                      className={clsx(
                        'relative w-14 h-7 rounded-full transition-colors',
                        perfSettings.cache_enabled?.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      )}
                    >
                      <span className={clsx(
                        'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        perfSettings.cache_enabled?.enabled ? 'right-1' : 'left-1'
                      )} />
                    </button>
                  </div>

                  {/* Bilgi Notu */}
                  <div className="mb-4 p-3 rounded-xl border border-blue-300 dark:border-blue-700">
                    <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      💡 <strong className="text-blue-600 dark:text-blue-400">İpucu:</strong> Cache, sık kullanılan verileri bellekte tutarak sayfa yüklemelerini hızlandırır. 
                      Daha fazla bellek = daha fazla veri önbellekte tutulur = daha hızlı sayfalar.
                    </p>
                  </div>

                  {/* Redis Bellek */}
                  <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>Redis Bellek Limiti</p>
                        <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                          Önbellek için ayrılan maksimum RAM miktarı
                        </p>
                      </div>
                      <select
                        value={perfSettings.cache_redis_max_memory?.value || '2gb'}
                        onChange={(e) => savePerfSetting('cache_redis_max_memory', { value: e.target.value })}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="512mb">512 MB - Düşük trafik</option>
                        <option value="1gb">1 GB - Orta trafik</option>
                        <option value="2gb">2 GB - Yüksek trafik (Önerilen)</option>
                        <option value="4gb">4 GB - Çok yoğun</option>
                        <option value="8gb">8 GB - Enterprise</option>
                      </select>
                    </div>
                  </div>

                  {/* Eviction Politikası */}
                  <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>Bellek Dolunca</p>
                        <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>
                          Limit aşıldığında hangi verilerin silineceği
                        </p>
                      </div>
                      <select
                        value={perfSettings.cache_redis_policy?.value || 'allkeys-lru'}
                        onChange={(e) => savePerfSetting('cache_redis_policy', { value: e.target.value })}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value="allkeys-lru">LRU - Son kullanılmayanı sil (Önerilen)</option>
                        <option value="allkeys-lfu">LFU - En az erişileni sil</option>
                        <option value="volatile-lru">Süresi dolanlardan LRU</option>
                        <option value="volatile-ttl">Süresi en yakın olanı sil</option>
                      </select>
                    </div>
                    <p className={clsx('text-xs mt-1', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      LRU: Uzun süredir kullanılmayanı siler • LFU: Nadiren erişileni siler
                    </p>
                  </div>

                  {/* Cache Temizle Butonları */}
                  <div className="pt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => clearCache('all')}
                      disabled={cacheClearLoading}
                      className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600')}
                    >
                      {cacheClearLoading ? <Loader2 size={14} className="animate-spin" /> : <Eraser size={14} />}
                      Tüm Cache Temizle
                    </button>
                    <button
                      onClick={() => clearCache('dashboard')}
                      disabled={cacheClearLoading}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg text-sm', theme.buttonSecondary)}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => clearCache('metrics')}
                      disabled={cacheClearLoading}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg text-sm', theme.buttonSecondary)}
                    >
                      Metrikler
                    </button>
                  </div>
                </div>

                {/* Cache TTL Ayarları */}
                <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
                  <div className="flex items-center gap-3 mb-4">
                    <Clock size={20} className="text-amber-500" />
                    <h3 className={clsx('font-semibold', theme.contentText)}>Cache Süreleri (TTL)</h3>
                  </div>

                  {/* Bilgi Notu */}
                  <div className="mb-4 p-3 rounded-xl border border-amber-300 dark:border-amber-700">
                    <p className={clsx('text-xs', isDark ? 'text-gray-400' : 'text-gray-600')}>
                      ⏱️ <strong className="text-amber-600 dark:text-amber-400">TTL (Time To Live):</strong> Verinin cache'te ne kadar süre tutulacağı. 
                      Kısa süre = daha güncel veri, uzun süre = daha hızlı yanıt. 
                      Veri sık değişiyorsa kısa, nadir değişiyorsa uzun tutun.
                    </p>
                  </div>

                  {/* Dashboard TTL */}
                  <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>Dashboard Cache</p>
                        <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>Tüm dashboard verisi (widget'lar dahil)</p>
                      </div>
                      <select
                        value={perfSettings.cache_dashboard_ttl?.value || 900}
                        onChange={(e) => savePerfSetting('cache_dashboard_ttl', { value: Number(e.target.value) })}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value={60}>1 dk - Çok güncel</option>
                        <option value={300}>5 dk - Güncel</option>
                        <option value={900}>15 dk - Dengeli (Önerilen)</option>
                        <option value={1800}>30 dk - Performans</option>
                        <option value={3600}>1 saat - Yüksek performans</option>
                      </select>
                    </div>
                  </div>

                  {/* KPI TTL */}
                  <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>KPI Kartları</p>
                        <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>Tek değer gösteren metrik kartları</p>
                      </div>
                      <select
                        value={perfSettings.cache_kpi_ttl?.value || 300}
                        onChange={(e) => savePerfSetting('cache_kpi_ttl', { value: Number(e.target.value) })}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value={60}>1 dk - Çok güncel</option>
                        <option value={300}>5 dk - Güncel (Önerilen)</option>
                        <option value={600}>10 dk - Orta</option>
                        <option value={900}>15 dk - Performans</option>
                      </select>
                    </div>
                  </div>

                  {/* Chart TTL */}
                  <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>Grafikler</p>
                        <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>Bar, çizgi, pasta grafikleri</p>
                      </div>
                      <select
                        value={perfSettings.cache_chart_ttl?.value || 900}
                        onChange={(e) => savePerfSetting('cache_chart_ttl', { value: Number(e.target.value) })}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value={300}>5 dk - Güncel</option>
                        <option value={900}>15 dk - Dengeli (Önerilen)</option>
                        <option value={1800}>30 dk - Performans</option>
                        <option value={3600}>1 saat - Yüksek performans</option>
                      </select>
                    </div>
                  </div>

                  {/* Table TTL */}
                  <div className="py-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>Tablolar</p>
                        <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>Veri tabloları ve listeler</p>
                      </div>
                      <select
                        value={perfSettings.cache_table_ttl?.value || 1800}
                        onChange={(e) => savePerfSetting('cache_table_ttl', { value: Number(e.target.value) })}
                        className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                      >
                        <option value={900}>15 dk - Güncel</option>
                        <option value={1800}>30 dk - Dengeli (Önerilen)</option>
                        <option value={3600}>1 saat - Performans</option>
                        <option value={7200}>2 saat - Yüksek performans</option>
                      </select>
                    </div>
                  </div>

                  {/* ETL sonrası cache invalidation */}
                  <div className="flex items-center justify-between pt-4">
                    <div>
                      <p className={clsx('font-medium', theme.contentText)}>ETL Sonrası Temizle</p>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>Veri güncelleme sonrası cache otomatik temizlensin</p>
                    </div>
                    <button
                      onClick={() => savePerfSetting('cache_invalidate_on_etl', { enabled: !perfSettings.cache_invalidate_on_etl?.enabled })}
                      className={clsx(
                        'relative w-14 h-7 rounded-full transition-colors',
                        perfSettings.cache_invalidate_on_etl?.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                      )}
                    >
                      <span className={clsx(
                        'absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        perfSettings.cache_invalidate_on_etl?.enabled ? 'right-1' : 'left-1'
                      )} />
                    </button>
                  </div>
                </div>

                {/* Redis İstatistikleri */}
                {redisInfo && (
                  <div className={clsx('p-6 rounded-2xl lg:col-span-2', theme.cardBg)}>
                    <div className="flex items-center gap-3 mb-4">
                      <Zap size={20} className="text-purple-500" />
                      <h3 className={clsx('font-semibold', theme.contentText)}>Redis İstatistikleri</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                        <p className="text-2xl font-bold text-blue-500">{redisInfo.usedMemory || 'N/A'}</p>
                        <p className={clsx('text-sm', theme.contentTextMuted)}>Kullanılan Bellek</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-600/5">
                        <p className="text-2xl font-bold text-emerald-500">{redisInfo.keys || 0}</p>
                        <p className={clsx('text-sm', theme.contentTextMuted)}>Toplam Key</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-600/5">
                        <p className="text-2xl font-bold text-amber-500">{redisInfo.hitRate || 'N/A'}</p>
                        <p className={clsx('text-sm', theme.contentTextMuted)}>Hit Rate</p>
                      </div>
                      <div className="text-center p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-600/5">
                        <p className="text-2xl font-bold text-purple-500">{redisInfo.uptime || 'N/A'}</p>
                        <p className={clsx('text-sm', theme.contentTextMuted)}>Uptime</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Master Veriler */}
        {activeTab === 'master' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                  <Database size={24} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
                </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>Master Veriler</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Mağaza, bölge ve grup verilerini yönetin</p>
                </div>
              </div>
            </div>

            {/* Alt Sekmeler */}
            <div className={clsx('p-1 rounded-xl flex gap-1', theme.cardBg)}>
              {[
                { id: 'stores', label: 'Mağazalar', icon: Building2, count: allStores.length },
                { id: 'regions', label: 'Bölgeler', icon: MapPin, count: allRegions.length },
                { id: 'groups', label: 'Gruplar', icon: Database, count: ownershipGroups.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMasterTab(tab.id as any)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                    masterTab === tab.id
                      ? clsx('shadow-sm', isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white text-emerald-600')
                      : clsx(theme.contentTextMuted, 'hover:bg-white/50 dark:hover:bg-white/5')
                  )}
                >
                  <tab.icon size={18} />
                  {tab.label}
                  <span className={clsx('px-2 py-0.5 rounded-full text-xs', isDark ? 'bg-white/10' : 'bg-gray-200')}>{tab.count}</span>
                </button>
              ))}
            </div>

            {/* Mağazalar Alt Sekmesi */}
            {masterTab === 'stores' && (
              <div className={clsx('rounded-2xl border p-6', theme.cardBg, theme.border)}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Mağaza ara..."
                      value={masterSearchQuery}
                      onChange={(e) => setMasterSearchQuery(e.target.value)}
                      className={clsx('px-4 py-2 rounded-xl text-sm w-64', theme.inputBg, theme.inputText)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadTemplate('stores')}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
                    >
                      <Download size={16} />
                      Şablon İndir
                    </button>
                    <button
                      onClick={() => setShowImportModal('stores')}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
                    >
                      <Upload size={16} />
                      CSV Import
                    </button>
                    <button
                      onClick={() => {
                        setShowDatasetImportModal(true)
                        setSelectedDatasetId('')
                        setDatasetImportMapping({ code: '', name: '', store_type: '', ownership_group: '', region_code: '', city: '', district: '', address: '', phone: '', email: '', manager_name: '' })
                        setDatasetImportResult(null)
                      }}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600')}
                    >
                      <Database size={16} />
                      Dataset'ten Import
                    </button>
                    <button
                      onClick={() => {
                        setEditingStore(null)
                        setStoreForm({ code: '', name: '', store_type: 'MAGAZA', ownership_group: 'MERKEZ', region_id: '', city: '', district: '', address: '', phone: '', email: '', manager_name: '', manager_email: '', opening_date: '', square_meters: '', employee_count: '', rent_amount: '', target_revenue: '' })
                        setShowStoreModal(true)
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus size={16} />
                      Mağaza Ekle
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className={clsx('border-b', theme.border)}>
                        <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Kod</th>
                        <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Mağaza Adı</th>
                        <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Tip</th>
                        <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Grup</th>
                        <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Bölge</th>
                        <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Şehir</th>
                        <th className={clsx('px-4 py-3 text-right text-xs font-medium uppercase', theme.contentTextMuted)}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStores
                        .filter(s => !masterSearchQuery || s.name?.toLowerCase().includes(masterSearchQuery.toLowerCase()) || s.code?.toLowerCase().includes(masterSearchQuery.toLowerCase()))
                        .map((store) => (
                        <tr key={store.id} className={clsx('border-b hover:bg-gray-50 dark:hover:bg-gray-800/50', theme.border)}>
                          <td className={clsx('px-4 py-3 text-sm font-mono', theme.contentText)}>{store.code}</td>
                          <td className={clsx('px-4 py-3 text-sm font-medium', theme.contentText)}>{store.name}</td>
                          <td className="px-4 py-3">
                            <span className={clsx(
                              'px-2.5 py-1 rounded-full text-xs font-semibold',
                              store.store_type === 'MERKEZ' ? 'bg-blue-500 text-white' :
                              store.store_type === 'MAGAZA' ? 'bg-emerald-500 text-white' :
                              store.store_type === 'DEPO' ? 'bg-amber-500 text-white' :
                              store.store_type === 'FRANCHISE' ? 'bg-purple-500 text-white' :
                              'bg-gray-500 text-white'
                            )}>
                              {store.store_type}
                            </span>
                          </td>
                          <td className={clsx('px-4 py-3 text-sm', theme.contentText)}>{store.ownership_group || '-'}</td>
                          <td className={clsx('px-4 py-3 text-sm', theme.contentText)}>{store.region_name || '-'}</td>
                          <td className={clsx('px-4 py-3 text-sm', theme.contentText)}>{store.city || '-'}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditingStore(store)
                                  // Tarih formatını YYYY-MM-DD'ye dönüştür (input type="date" için)
                                  const formatDate = (dateStr: string | null) => {
                                    if (!dateStr) return ''
                                    try {
                                      return new Date(dateStr).toISOString().split('T')[0]
                                    } catch {
                                      return ''
                                    }
                                  }
                                  setStoreForm({
                                    code: store.code || '',
                                    name: store.name || '',
                                    store_type: store.store_type || 'MAGAZA',
                                    ownership_group: store.ownership_group || 'MERKEZ',
                                    region_id: store.region_id || '',
                                    city: store.city || '',
                                    district: store.district || '',
                                    address: store.address || '',
                                    phone: store.phone || '',
                                    email: store.email || '',
                                    manager_name: store.manager_name || '',
                                    manager_email: store.manager_email || '',
                                    opening_date: formatDate(store.opening_date),
                                    square_meters: store.square_meters?.toString() || '',
                                    employee_count: store.employee_count?.toString() || '',
                                    rent_amount: store.rent_amount?.toString() || '',
                                    target_revenue: store.target_revenue?.toString() || ''
                                  })
                                  setShowStoreModal(true)
                                }}
                                className={clsx('p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => deleteStore(store.id)}
                                className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {allStores.length === 0 && (
                    <div className={clsx('text-center py-12', theme.contentTextMuted)}>
                      <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Henüz mağaza eklenmemiş</p>
                      <p className="text-sm mt-1">Üstteki "Mağaza Ekle" butonunu veya "CSV Import" kullanın</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bölgeler Alt Sekmesi */}
            {masterTab === 'regions' && (
              <div className={clsx('rounded-2xl border p-6', theme.cardBg, theme.border)}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      placeholder="Bölge ara..."
                      value={masterSearchQuery}
                      onChange={(e) => setMasterSearchQuery(e.target.value)}
                      className={clsx('px-4 py-2 rounded-xl text-sm w-64', theme.inputBg, theme.inputText)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => downloadTemplate('regions')}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
                    >
                      <Download size={16} />
                      Şablon İndir
                    </button>
                    <button
                      onClick={() => setShowImportModal('regions')}
                      className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
                    >
                      <Upload size={16} />
                      CSV Import
                    </button>
                    <button
                      onClick={() => {
                        setEditingRegion(null)
                        setRegionForm({ code: '', name: '', description: '', manager_name: '', manager_email: '' })
                        setShowRegionModal(true)
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Plus size={16} />
                      Bölge Ekle
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {allRegions
                    .filter(r => !masterSearchQuery || r.name?.toLowerCase().includes(masterSearchQuery.toLowerCase()) || r.code?.toLowerCase().includes(masterSearchQuery.toLowerCase()))
                    .map((region) => (
                    <div key={region.id} className={clsx('rounded-xl border p-4', theme.border, 'hover:shadow-md transition-shadow')}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={clsx('p-2 rounded-lg', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                            <MapPin size={20} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                          </div>
                          <div>
                            <h3 className={clsx('font-medium', theme.contentText)}>{region.name}</h3>
                            <p className={clsx('text-xs font-mono', theme.contentTextMuted)}>{region.code}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingRegion(region)
                              setRegionForm({
                                code: region.code || '',
                                name: region.name || '',
                                description: region.description || '',
                                manager_name: region.manager_name || '',
                                manager_email: region.manager_email || ''
                              })
                              setShowRegionModal(true)
                            }}
                            className={clsx('p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => deleteRegion(region.id)}
                            className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      {region.description && (
                        <p className={clsx('text-sm mt-3', theme.contentTextMuted)}>{region.description}</p>
                      )}
                      <div className={clsx('mt-3 pt-3 border-t', theme.border)}>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>
                          {allStores.filter(s => s.region_id === region.id).length} mağaza
                        </p>
                      </div>
                    </div>
                  ))}
                  {allRegions.length === 0 && (
                    <div className={clsx('col-span-full text-center py-12', theme.contentTextMuted)}>
                      <MapPin size={48} className="mx-auto mb-4 opacity-50" />
                      <p>Henüz bölge eklenmemiş</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Gruplar Alt Sekmesi */}
            {masterTab === 'groups' && (
              <div className={clsx('rounded-2xl border p-6', theme.cardBg, theme.border)}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={clsx('font-medium', theme.contentText)}>Sahiplik Grupları</h3>
                  <button
                    onClick={() => {
                      setEditingGroup(null)
                      setGroupForm({ code: '', name: '', description: '', color: '#3B82F6', icon: '🏢' })
                      setShowGroupModal(true)
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Plus size={16} />
                    Grup Ekle
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownershipGroups.map((group) => (
                    <div key={group.id || group.code} className={clsx('rounded-xl border p-4', theme.border, 'hover:shadow-md transition-shadow')}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{group.icon || '🏢'}</div>
                          <div>
                            <h3 className={clsx('font-medium', theme.contentText)}>{group.name}</h3>
                            <p className={clsx('text-xs font-mono', theme.contentTextMuted)}>{group.code}</p>
                          </div>
                        </div>
                        {group.id && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingGroup(group)
                                setGroupForm({
                                  code: group.code || '',
                                  name: group.name || '',
                                  description: group.description || '',
                                  color: group.color || '#3B82F6',
                                  icon: group.icon || '🏢'
                                })
                                setShowGroupModal(true)
                              }}
                              className={clsx('p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => deleteGroup(group.id)}
                              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {group.description && (
                        <p className={clsx('text-sm mt-3', theme.contentTextMuted)}>{group.description}</p>
                      )}
                      <div className={clsx('mt-3 pt-3 border-t', theme.border)}>
                        <p className={clsx('text-xs', theme.contentTextMuted)}>
                          {allStores.filter(s => s.ownership_group === group.code).length} mağaza
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Sistem Ayarları */}
        {activeTab === 'settings' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-indigo-500/20' : 'bg-indigo-100')}>
                  <Settings size={24} className={isDark ? 'text-indigo-400' : 'text-indigo-600'} />
                </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>Sistem Ayarları</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Uygulama geneli parametreleri yönetin</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={loadSettings}
                  disabled={loading}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl transition-colors', theme.buttonSecondary)}
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  Yenile
                </button>
                <button 
                  onClick={seedDefaultSettings}
                  disabled={seeding}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                >
                  {seeding ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  {seeding ? 'Kaydediliyor...' : 'Varsayılanları Yükle'}
                </button>
              </div>
            </div>

            {/* Logo Upload Bölümü */}
            <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
              <div className="flex items-center gap-4 mb-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-cyan-500/20' : 'bg-cyan-100')}>
                  <Upload size={24} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
                </div>
                <div>
                  <h3 className={clsx('font-bold', theme.contentText)}>Kurumsal Logo</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Şeffaf arka planlı PNG veya SVG yükleyin (min. 512x512 piksel)
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Mevcut Logo */}
                <div className={clsx('p-4 rounded-xl border', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50')}>
                  <p className={clsx('text-sm font-medium mb-3', theme.contentTextMuted)}>Mevcut Logo</p>
                  <div className="flex items-center justify-center p-4 rounded-lg" style={{ background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 16px 16px' }}>
                    <img 
                      src={logoInfo?.currentLogoUrl || '/logo.png'} 
                      alt="Mevcut Logo" 
                      className="h-24 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).src = '/logo.png' }}
                    />
                  </div>
                  <p className={clsx('text-xs mt-2 text-center', theme.contentTextMuted)}>
                    {logoInfo?.hasCustomLogo ? '✅ Özel logo yüklü' : '📌 Varsayılan Clixer logosu'}
                  </p>
                </div>

                {/* Yeni Logo Yükle */}
                <div className={clsx('p-4 rounded-xl border', isDark ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50')}>
                  <p className={clsx('text-sm font-medium mb-3', theme.contentTextMuted)}>Yeni Logo Yükle</p>
                  
                  {logoPreview ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center p-4 rounded-lg" style={{ background: 'repeating-conic-gradient(#808080 0% 25%, transparent 0% 50%) 50% / 16px 16px' }}>
                        <img src={logoPreview} alt="Önizleme" className="h-24 object-contain" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={uploadLogo}
                          disabled={logoUploading}
                          className={clsx('flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                        >
                          {logoUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          {logoUploading ? 'Yükleniyor...' : 'Yükle'}
                        </button>
                        <button
                          onClick={() => { setLogoFile(null); setLogoPreview(null); setLogoError(null) }}
                          className={clsx('px-4 py-2 rounded-xl', theme.buttonSecondary)}
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className={clsx(
                      'flex flex-col items-center justify-center p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                      isDark ? 'border-slate-600 hover:border-cyan-500 hover:bg-cyan-500/10' : 'border-slate-300 hover:border-cyan-500 hover:bg-cyan-50'
                    )}>
                      <Upload size={32} className={isDark ? 'text-slate-500' : 'text-slate-400'} />
                      <span className={clsx('mt-2 text-sm', theme.contentTextMuted)}>PNG veya SVG dosyası seçin</span>
                      <span className={clsx('text-xs', theme.contentTextMuted)}>veya sürükleyip bırakın</span>
                      <input
                        type="file"
                        accept="image/png,image/svg+xml"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                  
                  {logoError && (
                    <div className={clsx('mt-3 p-3 rounded-lg text-sm', isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')}>
                      ⚠️ {logoError}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Bilgi Kutusu */}
              <div className={clsx('mt-4 p-4 rounded-xl text-sm', isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600')}>
                <p className="font-medium mb-2">💡 Logo Gereksinimleri:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Format:</strong> PNG (şeffaf arka plan) veya SVG</li>
                  <li><strong>Minimum boyut:</strong> 512x512 piksel</li>
                  <li><strong>Önerilen:</strong> Hem açık hem koyu temada görünebilecek renklerde</li>
                  <li><strong>Kullanım alanları:</strong> Sidebar, PWA ikonu, Favicon, Tarayıcı sekmesi</li>
                </ul>
              </div>
            </div>

            {/* Ayar Kategorileri */}
            <div className={clsx('flex gap-2 p-1 rounded-2xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
              {settingCategories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveSettingCategory(cat.id)}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all',
                    activeSettingCategory === cat.id
                      ? theme.buttonPrimary
                      : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
                  )}
                >
                  <cat.icon size={16} />
                  {cat.label}
                  <span className={clsx('ml-1 px-1.5 py-0.5 rounded text-xs', isDark ? 'bg-slate-700' : 'bg-slate-200')}>{cat.count}</span>
                </button>
              ))}
            </div>

            {/* Ayarlar Tablosu */}
            <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
              <div className={clsx('grid grid-cols-12 gap-4 px-6 py-4 text-xs font-bold uppercase', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>
                <div className="col-span-4">Ayar</div>
                <div className="col-span-4">Değer</div>
                <div className="col-span-2">Tip</div>
                <div className="col-span-2 text-right">İşlemler</div>
              </div>
              <div className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <span className={clsx('ml-3', theme.contentTextMuted)}>Ayarlar yükleniyor...</span>
                  </div>
                ) : filteredSettings.length === 0 ? (
                  <div className="text-center py-12">
                    <p className={theme.contentTextMuted}>Bu kategoride ayar bulunamadı</p>
                  </div>
                ) : filteredSettings.map(setting => (
                  <div key={setting.key} className={clsx('grid grid-cols-12 gap-4 px-6 py-4 items-center transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                    <div className="col-span-4">
                      <p className={clsx('font-medium', theme.contentText)}>{setting.label}</p>
                      <p className={clsx('text-xs', theme.contentTextMuted)}>{setting.key}</p>
                      {setting.description && (
                        <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>{setting.description}</p>
                      )}
                    </div>
                    <div className="col-span-4">
                      {editingKey === setting.key ? (
                        setting.type === 'select' && setting.options ? (
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            className={clsx('w-full px-3 py-2 rounded-lg text-sm border-2 border-indigo-500', theme.inputBg, theme.inputText)}
                          >
                            {setting.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : setting.type === 'boolean' ? (
                          <select
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                            className={clsx('w-full px-3 py-2 rounded-lg text-sm border-2 border-indigo-500', theme.inputBg, theme.inputText)}
                          >
                            <option value="true">Evet</option>
                            <option value="false">Hayır</option>
                          </select>
                        ) : (
                      <input
                        type={setting.type === 'number' ? 'number' : 'text'}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveSetting(setting.key, editValue)
                              if (e.key === 'Escape') { setEditingKey(null); setEditValue('') }
                            }}
                            autoFocus
                            className={clsx('w-full px-3 py-2 rounded-lg text-sm border-2 border-indigo-500', theme.inputBg, theme.inputText)}
                          />
                        )
                      ) : (
                        <p className={clsx('font-medium', theme.contentText)}>
                          {setting.type === 'boolean' 
                            ? (setting.value === 'true' ? '✓ Evet' : '✗ Hayır')
                            : (setting.value || '-')
                          }
                        </p>
                      )}
                    </div>
                    <div className="col-span-2">
                      <span className={clsx('px-2 py-1 rounded text-xs font-medium', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>{setting.type}</span>
                    </div>
                    <div className="col-span-2 flex justify-end gap-2">
                      {editingKey === setting.key ? (
                        <>
                          <button 
                            onClick={() => saveSetting(setting.key, editValue)}
                            disabled={saving === setting.key}
                            className={clsx('p-2 rounded-lg transition-colors', 'bg-emerald-500 text-white hover:bg-emerald-600')}
                          >
                            {saving === setting.key ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                          </button>
                          <button 
                            onClick={() => { setEditingKey(null); setEditValue('') }}
                            className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => { setEditingKey(setting.key); setEditValue(setting.value) }}
                            className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                          >
                        <Edit2 size={16} />
                      </button>
                      <button className={clsx('p-2 rounded-lg transition-colors', 'hover:bg-rose-500/20 text-rose-500')}>
                        <Trash2 size={16} />
                      </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Kullanıcı Yönetimi */}
        {activeTab === 'users' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
                  <Users size={24} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>Kullanıcı Yönetimi</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Kullanıcıları görüntüle, ekle ve mağaza ata</p>
                </div>
              </div>
              <button 
                onClick={() => { setEditingUser(null); setUserForm({ email: '', name: '', password: '', role: 'USER', position_code: 'VIEWER', stores: [], filter_value: '' }); setStoreSearchTerm(''); setShowUserModal(true) }}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
              >
                <Plus size={16} /> Kullanıcı Ekle
              </button>
            </div>

            {/* Arama */}
            <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border', theme.inputBg)}>
              <Search size={18} className={clsx(theme.contentTextMuted)} />
              <input
                type="text"
                placeholder="İsim, e-posta veya pozisyon ara..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={clsx('flex-1 bg-transparent text-sm outline-none', theme.inputText, theme.inputPlaceholder)}
              />
            </div>

            {/* Kullanıcı Listesi */}
            <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
              <table className="w-full">
                <thead className={clsx(isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                  <tr className={clsx('text-xs font-bold uppercase', theme.contentTextMuted)}>
                    <th className="px-6 py-4 text-left">Kullanıcı</th>
                    <th className="px-6 py-4 text-left">Pozisyon</th>
                    <th className="px-6 py-4 text-left">Mağaza</th>
                    <th className="px-6 py-4 text-left">Oluşturulma</th>
                    <th className="px-6 py-4 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                  {users.filter(u => 
                    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.position_name?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map(user => (
                    <tr key={user.id} className={clsx('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-500 flex items-center justify-center text-white font-bold">
                            {user.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <p className={clsx('font-medium', theme.contentText)}>{user.name}</p>
                            <p className={clsx('text-xs', theme.contentTextMuted)}>{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={clsx(
                          'px-2 py-1 rounded-lg text-xs font-bold',
                          user.position_code === 'GENERAL_MANAGER' ? (isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-700') :
                          user.position_code === 'DIRECTOR' ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700') :
                          user.position_code === 'REGION_MANAGER' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                          user.position_code === 'STORE_MANAGER' ? (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700') :
                          (isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-600')
                        )}>
                          {user.position_name || user.position_code || 'Belirsiz'}
                        </span>
                      </td>
                      <td className={clsx('px-6 py-4 text-sm', theme.contentTextMuted)}>
                        {user.filter_value ? (
                          <span className={clsx('px-2 py-1 rounded-lg text-xs font-medium', isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')}>
                            🔐 {availableStores.find(s => s.store_id === user.filter_value)?.store_name || `Kod: ${user.filter_value}`}
                          </span>
                        ) : user.store_count > 0 ? (
                          <span className={clsx('px-2 py-1 rounded-lg text-xs', isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700')}>
                            {user.store_count} mağaza
                          </span>
                        ) : (
                          <span className={clsx('text-xs', theme.contentTextMuted)}>Atanmamış</span>
                        )}
                      </td>
                      <td className={clsx('px-6 py-4 text-sm', theme.contentTextMuted)}>
                        {new Date(user.created_at).toLocaleDateString('tr-TR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button 
                            onClick={() => editUser(user)}
                            className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button 
                            onClick={() => deleteUser(user.id)}
                            className={clsx('p-2 rounded-lg transition-colors', 'hover:bg-rose-500/20 text-rose-500')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className={theme.contentTextMuted}>Henüz kullanıcı yok</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Kullanıcı Ekleme/Düzenleme Modal */}
            {showUserModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className={clsx('w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto', theme.cardBg)}>
                  <h2 className={clsx('text-xl font-bold mb-6', theme.contentText)}>
                    {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}
                  </h2>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>E-posta *</label>
                      <input
                        type="email"
                        value={userForm.email}
                        onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                        disabled={!!editingUser}
                        placeholder="ornek@sirket.com"
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, editingUser && 'opacity-50')}
                      />
                    </div>
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>İsim *</label>
                      <input
                        type="text"
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        placeholder="Ad Soyad"
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                      />
                    </div>
                    {!editingUser && (
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Şifre *</label>
                        <input
                          type="password"
                          value={userForm.password}
                          onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                          placeholder="••••••••"
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                        />
                      </div>
                    )}
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Pozisyon *</label>
                      <select
                        value={userForm.position_code}
                        onChange={(e) => setUserForm({ ...userForm, position_code: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                      >
                        {positions.map(pos => (
                          <option key={pos.code} value={pos.code}>{getPositionLabel(pos.code, pos.name)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>
                        Sistem Rolü *
                        <span className={clsx('ml-2 text-xs', theme.contentTextMuted)}>(Menü & yetki erişimi)</span>
                      </label>
                      <select
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                      >
                        <option value="ADMIN">🔑 ADMIN (Tam yetki)</option>
                        <option value="MANAGER">📊 MANAGER (Yönetici)</option>
                        <option value="USER">👤 USER (Kullanıcı)</option>
                        <option value="VIEWER">👁️ VIEWER (İzleyici)</option>
                      </select>
                    </div>
                  </div>

                  {/* RLS (Row-Level Security) Filtre Değeri */}
                  {userForm.position_code !== 'GENERAL_MANAGER' && (
                    <div className={clsx('mt-4 p-4 rounded-xl border', 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700')}>
                      <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                        🔐 RLS Filtre Değeri
                        <span className={clsx('ml-2 text-xs font-normal', theme.contentTextMuted)}>
                          ({positions.find(p => p.code === userForm.position_code)?.filter_level === 'store' ? 'Mağaza Seç' :
                            positions.find(p => p.code === userForm.position_code)?.filter_level === 'region' ? 'Bölge Seç' :
                            positions.find(p => p.code === userForm.position_code)?.filter_level === 'group' ? 'Grup Seç' : 'Değer Seç'})
                        </span>
                      </label>
                      
                      {/* Pozisyona göre farklı dropdown */}
                      {positions.find(p => p.code === userForm.position_code)?.filter_level === 'store' ? (
                        // Mağaza seçimi - arama özellikli
                        <div className="space-y-2">
                          {/* Arama input'u */}
                          <div className="relative">
                            <input
                              type="text"
                              value={storeSearchTerm}
                              onChange={(e) => setStoreSearchTerm(e.target.value)}
                              placeholder="🔍 Mağaza ara... (isim veya kod)"
                              className={clsx('w-full px-4 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText, theme.inputBorder)}
                            />
                            {storeSearchTerm && (
                              <button
                                type="button"
                                onClick={() => setStoreSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          
                          {/* Seçili mağaza gösterimi */}
                          {userForm.filter_value && (
                            <div className={clsx('flex items-center justify-between px-3 py-2 rounded-lg', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                              <span className={clsx('text-sm font-medium', isDark ? 'text-emerald-400' : 'text-emerald-700')}>
                                ✅ {availableStores.find(s => s.store_id === userForm.filter_value)?.store_name || userForm.filter_value}
                              </span>
                              <button
                                type="button"
                                onClick={() => setUserForm({ ...userForm, filter_value: '' })}
                                className={clsx('text-xs px-2 py-1 rounded', isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600')}
                              >
                                Kaldır
                              </button>
                            </div>
                          )}
                          
                          {/* Mağaza listesi (scroll) */}
                          <div className={clsx('max-h-60 overflow-y-auto rounded-xl border', theme.inputBorder)}>
                            {availableStores
                              .filter(store => {
                                if (!storeSearchTerm) return true
                                const search = storeSearchTerm.toLowerCase()
                                return (
                                  store.store_name?.toLowerCase().includes(search) ||
                                  store.store_id?.toLowerCase().includes(search) ||
                                  store.region_name?.toLowerCase().includes(search)
                                )
                              })
                              .slice(0, 100) // İlk 100 sonuç
                              .map((store) => (
                                <div
                                  key={store.store_id}
                                  onClick={() => setUserForm({ ...userForm, filter_value: store.store_id })}
                                  className={clsx(
                                    'px-4 py-2 cursor-pointer border-b last:border-b-0 transition-colors',
                                    userForm.filter_value === store.store_id 
                                      ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-100') 
                                      : (isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'),
                                    theme.inputBorder
                                  )}
                                >
                                  <div className={clsx('text-sm font-medium', theme.contentText)}>
                                    {store.store_name} <span className="text-xs opacity-60">({store.store_id})</span>
                                  </div>
                                  <div className={clsx('text-xs', theme.contentTextMuted)}>
                                    {store.store_type || ''} • {store.region_name || ''}
                                  </div>
                                </div>
                              ))
                            }
                            {availableStores.filter(store => {
                              if (!storeSearchTerm) return true
                              const search = storeSearchTerm.toLowerCase()
                              return (
                                store.store_name?.toLowerCase().includes(search) ||
                                store.store_id?.toLowerCase().includes(search)
                              )
                            }).length === 0 && (
                              <div className={clsx('px-4 py-3 text-center text-sm', theme.contentTextMuted)}>
                                Mağaza bulunamadı
                              </div>
                            )}
                            {availableStores.length > 100 && !storeSearchTerm && (
                              <div className={clsx('px-4 py-2 text-center text-xs', theme.contentTextMuted)}>
                                📋 {availableStores.length} mağaza mevcut. Aramayı kullanarak filtreleyin.
                              </div>
                            )}
                          </div>
                        </div>
                      ) : positions.find(p => p.code === userForm.position_code)?.filter_level === 'region' ? (
                        // Bölge seçimi - region listesinden
                        <select
                          value={userForm.filter_value}
                          onChange={(e) => setUserForm({ ...userForm, filter_value: e.target.value })}
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                        >
                          <option value="">-- Bölge Seç --</option>
                          {regions.map((region) => (
                            <option key={region.id} value={region.id}>
                              {region.name}
                            </option>
                          ))}
                        </select>
                      ) : positions.find(p => p.code === userForm.position_code)?.filter_level === 'group' ? (
                        // Grup seçimi - sabit liste
                        <select
                          value={userForm.filter_value}
                          onChange={(e) => setUserForm({ ...userForm, filter_value: e.target.value })}
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                        >
                          <option value="">-- Grup Seç --</option>
                          <option value="MERKEZ">🏢 MERKEZ (Şirket Mağazaları)</option>
                          <option value="FRANCHISE">🏪 FRANCHISE (Bayiler)</option>
                        </select>
                      ) : (
                        // Fallback - text input
                        <input
                          type="text"
                          value={userForm.filter_value}
                          onChange={(e) => setUserForm({ ...userForm, filter_value: e.target.value })}
                          placeholder="Filtre değeri girin..."
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                        />
                      )}
                      
                      <p className={clsx('text-xs mt-2', theme.contentTextMuted)}>
                        Bu kullanıcı metrik çalıştırdığında seçilen değere göre otomatik filtreleme yapılacak.
                        {positions.find(p => p.code === userForm.position_code)?.filter_level === 'store' && ' Kullanıcı sadece seçilen mağazanın verilerini görecek.'}
                        {positions.find(p => p.code === userForm.position_code)?.filter_level === 'region' && ' Kullanıcı sadece seçilen bölgenin tüm mağazalarının verilerini görecek.'}
                        {positions.find(p => p.code === userForm.position_code)?.filter_level === 'group' && ' Kullanıcı sadece seçilen grubun (Merkez/Franchise) verilerini görecek.'}
                      </p>
                    </div>
                  )}

                  {/* Mağaza Ataması */}
                  <div className="mt-6">
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentTextMuted)}>
                      Atanacak Mağazalar
                      {positions.find(p => p.code === userForm.position_code)?.can_see_all_stores && (
                        <span className="ml-2 text-xs text-emerald-500">(Bu pozisyon tüm mağazaları görür)</span>
                      )}
                    </label>
                    
                    {/* Filtre ve Hızlı Seçim */}
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {/* Bölge Filtresi */}
                      <select
                        value={storeFilterRegion}
                        onChange={(e) => setStoreFilterRegion(e.target.value)}
                        className={clsx('px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                      >
                        <option value="">Tüm Bölgeler</option>
                        {regions.map(r => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      
                      {/* Tip Filtresi */}
                      <select
                        value={storeFilterType}
                        onChange={(e) => setStoreFilterType(e.target.value)}
                        className={clsx('px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                      >
                        <option value="">Tümü</option>
                        <option value="MERKEZ">Merkez</option>
                        <option value="FRANCHISE">Franchise</option>
                      </select>
                      
                      <div className="flex-1" />
                      
                      {/* Hızlı Seçim Butonları */}
                      <button
                        type="button"
                        onClick={() => {
                          const toSelect = filteredAvailableStores.map(s => ({ store_id: s.store_id, store_name: s.store_name }))
                          const existing = userForm.stores.filter(s => !filteredAvailableStores.some(f => f.store_id === s.store_id))
                          setUserForm({ ...userForm, stores: [...existing, ...toSelect] })
                        }}
                        className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium', theme.buttonSecondary)}
                      >
                        Filtrelenenleri Seç
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const allStores = availableStores.map(s => ({ store_id: s.store_id, store_name: s.store_name }))
                          setUserForm({ ...userForm, stores: allStores })
                        }}
                        className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600')}
                      >
                        Tümünü Seç
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserForm({ ...userForm, stores: [] })}
                        className={clsx('px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-600')}
                      >
                        Temizle
                      </button>
                    </div>
                    
                    {/* Seçim Özeti */}
                    <div className={clsx('text-xs mb-2 px-2', theme.contentTextMuted)}>
                      {userForm.stores.length} mağaza seçili 
                      {storeFilterRegion && ` (${regions.find(r => r.id === storeFilterRegion)?.name} bölgesi gösteriliyor)`}
                      {storeFilterType && ` (${storeFilterType} gösteriliyor)`}
                    </div>
                    
                    {/* Mağaza Listesi */}
                    <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                      {filteredAvailableStores.map(store => (
                        <label 
                          key={store.store_id}
                          className={clsx(
                            'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors',
                            userForm.stores.some(s => s.store_id === store.store_id)
                              ? (isDark ? 'bg-indigo-500/20 border-2 border-indigo-500' : 'bg-indigo-100 border-2 border-indigo-500')
                              : (isDark ? 'bg-slate-800' : 'bg-slate-100')
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={userForm.stores.some(s => s.store_id === store.store_id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setUserForm({ ...userForm, stores: [...userForm.stores, { store_id: store.store_id, store_name: store.store_name }] })
                              } else {
                                setUserForm({ ...userForm, stores: userForm.stores.filter(s => s.store_id !== store.store_id) })
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <div className="flex-1 min-w-0">
                            <span className={clsx('text-sm font-medium', theme.contentText)}>{store.store_name}</span>
                            <div className={clsx('text-xs', theme.contentTextMuted)}>
                              {store.store_type === 'MERKEZ' ? '🏢' : '🏪'} {store.store_type} {store.region_name && `• ${store.region_name}`}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => { setShowUserModal(false); setEditingUser(null) }}
                      className={clsx('px-6 py-2.5 rounded-xl font-medium', theme.buttonSecondary)}
                    >
                      İptal
                    </button>
                    <button
                      onClick={saveUser}
                      disabled={saving === 'user'}
                      className={clsx('px-6 py-2.5 rounded-xl font-medium flex items-center gap-2', theme.buttonPrimary)}
                    >
                      {saving === 'user' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      {editingUser ? 'Güncelle' : 'Kaydet'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Rol & Yetkiler */}
        {activeTab === 'roles' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                  <Lock size={24} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>Rol & Yetkiler</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>Her pozisyonun hangi menülere erişebileceğini yapılandırın</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map(pos => (
                <div key={pos.code} className={clsx('rounded-2xl p-6 transition-all', theme.cardBg, theme.cardHover)}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className={clsx('font-bold text-lg', theme.contentText)}>{getPositionLabel(pos.code, pos.name)}</h3>
                      <p className={clsx('text-sm', theme.contentTextMuted)}>{pos.description}</p>
                    </div>
                    <span className={clsx(
                      'px-2 py-1 rounded-lg text-xs font-bold',
                      pos.can_see_all_stores 
                        ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                        : (isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')
                    )}>
                      {pos.can_see_all_stores ? 'Tüm Mağazalar' : 'Atanan Mağazalar'}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <p className={clsx('text-xs font-bold uppercase tracking-wider', theme.contentTextMuted)}>Hiyerarşi Seviyesi</p>
                    <div className="flex items-center gap-2">
                      {[0,1,2,3,4].map(level => (
                        <div 
                          key={level}
                          className={clsx(
                            'w-6 h-2 rounded-full',
                            level <= pos.hierarchy_level 
                              ? (isDark ? 'bg-indigo-500' : 'bg-indigo-500')
                              : (isDark ? 'bg-slate-700' : 'bg-slate-200')
                          )}
                        />
                      ))}
                      <span className={clsx('text-xs ml-2', theme.contentTextMuted)}>
                        {pos.hierarchy_level === 0 ? 'En Yüksek' : pos.hierarchy_level === 4 ? 'En Düşük' : `Seviye ${pos.hierarchy_level}`}
                      </span>
                    </div>
                  </div>

                  <button 
                    onClick={async () => {
                      setEditingRole(pos)
                      await loadRolePermissions(pos.code)
                    }}
                    className={clsx('mt-4 w-full py-2 rounded-xl text-sm font-medium flex items-center justify-center gap-2', theme.buttonSecondary)}
                  >
                    <Edit2 size={14} /> Menü İzinlerini Düzenle
                  </button>
                </div>
              ))}
            </div>

            {/* Rol İzin Düzenleme Modal */}
            {editingRole && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className={clsx('w-full max-w-2xl rounded-2xl p-6', theme.cardBg)}>
                  <h2 className={clsx('text-xl font-bold mb-2', theme.contentText)}>
                    {editingRole.name} - Menü İzinleri
                  </h2>
                  <p className={clsx('text-sm mb-6', theme.contentTextMuted)}>
                    Bu pozisyonun hangi menüleri görebileceğini ve düzenleyebileceğini ayarlayın.
                  </p>
                  
                  <div className="space-y-3">
                    {['dashboard', 'finance', 'operations', 'analysis', 'stores', 'designer', 'data', 'datagrid', 'admin'].map(menuKey => {
                      const perm = rolePermissions.find(p => p.menu_key === menuKey) || { menu_key: menuKey, can_view: false, can_edit: false }
                      const menuLabels: Record<string, string> = {
                        dashboard: 'Dashboard (Ana Sayfa)',
                        finance: 'Finansal Şeffaflık',
                        operations: 'Operasyonlar',
                        analysis: 'Analiz',
                        stores: 'Mağaza Yönetimi',
                        designer: 'Tasarım Stüdyosu',
                        data: 'Veri Yönetimi',
                        datagrid: 'DataGrid Demo',
                        admin: 'Yönetim Paneli'
                      }
                      
                      return (
                        <div 
                          key={menuKey}
                          className={clsx('flex items-center justify-between p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}
                        >
                          <span className={clsx('font-medium', theme.contentText)}>{menuLabels[menuKey]}</span>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={perm.can_view}
                                onChange={(e) => {
                                  const newPerms = rolePermissions.filter(p => p.menu_key !== menuKey)
                                  newPerms.push({ menu_key: menuKey, can_view: e.target.checked, can_edit: perm.can_edit && e.target.checked })
                                  setRolePermissions(newPerms)
                                }}
                                className="w-4 h-4"
                              />
                              <span className={clsx('text-sm', theme.contentTextMuted)}>Görüntüle</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={perm.can_edit}
                                disabled={!perm.can_view}
                                onChange={(e) => {
                                  const newPerms = rolePermissions.filter(p => p.menu_key !== menuKey)
                                  newPerms.push({ menu_key: menuKey, can_view: perm.can_view, can_edit: e.target.checked })
                                  setRolePermissions(newPerms)
                                }}
                                className="w-4 h-4"
                              />
                              <span className={clsx('text-sm', theme.contentTextMuted)}>Düzenle</span>
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setEditingRole(null)}
                      className={clsx('px-6 py-2.5 rounded-xl font-medium', theme.buttonSecondary)}
                    >
                      İptal
                    </button>
                    <button
                      onClick={saveRolePermissions}
                      disabled={saving === 'role'}
                      className={clsx('px-6 py-2.5 rounded-xl font-medium flex items-center gap-2', theme.buttonPrimary)}
                    >
                      {saving === 'role' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* LDAP / SSO */}
        {activeTab === 'ldap' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
                  <Key size={24} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>LDAP Entegrasyonu</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Active Directory'den kullanıcıları otomatik senkronize edin
                    {ldapConfig?.is_active && <span className="ml-2 text-emerald-500">● Aktif</span>}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {ldapConfig?.is_active && (
                  <button 
                    onClick={startLdapSync}
                    disabled={syncing}
                    className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                  >
                    {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                    {syncing ? 'Senkronize ediliyor...' : 'Şimdi Senkronize Et'}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* LDAP Ayarları */}
              <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
                <h3 className={clsx('font-bold text-lg mb-4 flex items-center gap-2', theme.contentText)}>
                  <Key size={20} /> Bağlantı Ayarları
            </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>LDAP Sunucu *</label>
                      <input 
                        type="text" 
                        placeholder="ldap://domain.local:389"
                        value={ldapForm.server_url}
                        onChange={(e) => setLdapForm({ ...ldapForm, server_url: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Base DN *</label>
                      <input 
                        type="text" 
                        placeholder="DC=domain,DC=local"
                        value={ldapForm.base_dn}
                        onChange={(e) => setLdapForm({ ...ldapForm, base_dn: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Bind DN *</label>
                      <input 
                        type="text" 
                        placeholder="CN=ServiceAccount,OU=Users,DC=domain,DC=local"
                        value={ldapForm.bind_dn}
                        onChange={(e) => setLdapForm({ ...ldapForm, bind_dn: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>
                        Bind Şifre {ldapConfig ? '(Değiştirmek için yeni girin)' : '*'}
                      </label>
                      <input 
                        type="password" 
                        placeholder="••••••••"
                        value={ldapForm.bind_password}
                        onChange={(e) => setLdapForm({ ...ldapForm, bind_password: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                      />
                    </div>
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kullanıcı Arama Filtresi</label>
                      <input 
                        type="text" 
                        placeholder="(&(objectClass=user)(mail=*))"
                        value={ldapForm.user_filter}
                        onChange={(e) => setLdapForm({ ...ldapForm, user_filter: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm font-mono', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                      />
                    </div>
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Sync Sıklığı</label>
                      <select 
                        value={ldapForm.sync_schedule}
                        onChange={(e) => setLdapForm({ ...ldapForm, sync_schedule: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                      >
                        <option value="manual">Manuel</option>
                        <option value="1hour">Her Saat</option>
                        <option value="6hours">Her 6 Saat</option>
                        <option value="daily">Günlük</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ldapForm.is_active}
                          onChange={(e) => setLdapForm({ ...ldapForm, is_active: e.target.checked })}
                          className="w-5 h-5 rounded"
                        />
                        <span className={clsx('font-medium', theme.contentText)}>LDAP Entegrasyonunu Aktif Et</span>
                      </label>
                    </div>
                  </div>
                  
                  {/* Test sonucu */}
                  {ldapTestResult && (
                    <div className={clsx(
                      'p-4 rounded-xl text-sm',
                      ldapTestResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    )}>
                      {ldapTestResult.success ? '✓ ' : '✗ '}{ldapTestResult.message}
          </div>
                  )}
                  
                  <div className="flex gap-2 pt-2">
                    <button 
                      onClick={testLdapConnection}
                      disabled={ldapTesting || !ldapForm.server_url}
                      className={clsx('flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2', theme.buttonSecondary)}
                    >
                      {ldapTesting ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                      Bağlantıyı Test Et
                    </button>
                    <button 
                      onClick={saveLdapConfig}
                      disabled={saving === 'ldap'}
                      className={clsx('flex-1 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2', theme.buttonPrimary)}
                    >
                      {saving === 'ldap' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      Kaydet
                    </button>
                  </div>
                </div>
              </div>

              {/* Sync Geçmişi */}
              <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
                <h3 className={clsx('font-bold text-lg mb-4 flex items-center gap-2', theme.contentText)}>
                  <Activity size={20} /> Senkronizasyon Geçmişi
                </h3>
                {syncLogs.length === 0 ? (
                  <p className={clsx('text-sm text-center py-8', theme.contentTextMuted)}>
                    Henüz senkronizasyon yapılmadı
                  </p>
                ) : (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {syncLogs.map(log => (
                      <div 
                        key={log.id} 
                        className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={clsx(
                            'px-2 py-1 rounded text-xs font-bold',
                            log.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                            log.status === 'partial' ? 'bg-amber-500/20 text-amber-400' :
                            log.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-rose-500/20 text-rose-400'
                          )}>
                            {log.status === 'success' ? 'Başarılı' :
                             log.status === 'partial' ? 'Kısmi' :
                             log.status === 'running' ? 'Çalışıyor' : 'Başarısız'}
                          </span>
                          <span className={clsx('text-xs', theme.contentTextMuted)}>
                            {new Date(log.started_at).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <p className={clsx('text-sm', theme.contentText)}>{log.summary}</p>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className={theme.contentTextMuted}>Bulunan: {log.users_found}</span>
                          <span className="text-emerald-400">+{log.users_created}</span>
                          <span className="text-blue-400">↻{log.users_updated}</span>
                          <span className="text-rose-400">-{log.users_deactivated}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Pozisyon Eşlemeleri */}
            <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={clsx('font-bold text-lg', theme.contentText)}>Pozisyon Eşlemeleri</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    LDAP gruplarını Clixer pozisyonlarına eşleyin. Öncelik sırasına göre ilk eşleşen geçerli olur.
                  </p>
                </div>
                <button 
                  onClick={() => { setShowMappingModal('position'); setMappingForm({ ...mappingForm, ldap_group_dn: '', ldap_group_name: '', position_code: 'VIEWER' }) }}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                >
                  <Plus size={16} /> Eşleme Ekle
                </button>
              </div>
              
              {positionMappings.length === 0 ? (
                <p className={clsx('text-sm text-center py-6', theme.contentTextMuted)}>
                  Henüz pozisyon eşlemesi tanımlanmadı
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {positionMappings.map(m => (
                    <div key={m.id} className={clsx('p-4 rounded-xl flex items-start justify-between', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>{m.ldap_group_name}</p>
                        <p className={clsx('text-xs font-mono mt-1', theme.contentTextMuted)}>{m.ldap_group_dn}</p>
                        <p className="text-sm mt-2">
                          → <span className={clsx('px-2 py-0.5 rounded text-xs font-bold', isDark ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700')}>
                            {m.position_name}
                          </span>
                        </p>
                      </div>
                      <button 
                        onClick={() => deleteMapping('position', m.id)}
                        className="p-1 hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Mağaza Eşlemeleri */}
            <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={clsx('font-bold text-lg', theme.contentText)}>Mağaza Eşlemeleri</h3>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    LDAP gruplarını Clixer mağazalarına eşleyin. Kullanıcılar üye oldukları gruplara göre mağaza atanır.
                  </p>
                </div>
                <button 
                  onClick={() => { setShowMappingModal('store'); setMappingForm({ ...mappingForm, ldap_group_dn: '', ldap_group_name: '', store_id: '', store_name: '', grants_all_stores: false }) }}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                >
                  <Plus size={16} /> Eşleme Ekle
                </button>
              </div>
              
              {storeMappings.length === 0 ? (
                <p className={clsx('text-sm text-center py-6', theme.contentTextMuted)}>
                  Henüz mağaza eşlemesi tanımlanmadı
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storeMappings.map(m => (
                    <div key={m.id} className={clsx('p-4 rounded-xl flex items-start justify-between', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>{m.ldap_group_name}</p>
                        <p className={clsx('text-xs font-mono mt-1', theme.contentTextMuted)}>{m.ldap_group_dn}</p>
                        <p className="text-sm mt-2">
                          → <span className={clsx(
                            'px-2 py-0.5 rounded text-xs font-bold',
                            m.grants_all_stores 
                              ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                              : (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
                          )}>
                            {m.grants_all_stores ? '✓ Tüm Mağazalar' : m.store_name || m.store_id}
                          </span>
                        </p>
                      </div>
                      <button 
                        onClick={() => deleteMapping('store', m.id)}
                        className="p-1 hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Eşleme Modalları */}
            {showMappingModal && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className={clsx('w-full max-w-lg rounded-2xl p-6', theme.cardBg)}>
                  <h2 className={clsx('text-xl font-bold mb-4', theme.contentText)}>
                    {showMappingModal === 'position' ? 'Pozisyon Eşlemesi Ekle' : 'Mağaza Eşlemesi Ekle'}
                  </h2>
                  
                  <div className="space-y-4">
                    {/* LDAP Grup Seçimi */}
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>LDAP Grup</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          placeholder="LDAP Grup DN veya grupları yükleyin"
                          value={mappingForm.ldap_group_dn}
                          onChange={(e) => setMappingForm({ ...mappingForm, ldap_group_dn: e.target.value })}
                          className={clsx('flex-1 px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                        />
                        <button 
                          onClick={loadLdapGroups}
                          disabled={loadingLdapGroups || !ldapConfig?.is_active}
                          className={clsx('px-4 py-3 rounded-xl', theme.buttonSecondary)}
                        >
                          {loadingLdapGroups ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                        </button>
                      </div>
                      {ldapGroups.length > 0 && (
                        <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                          {ldapGroups.map(g => (
                            <button 
                              key={g.dn}
                              onClick={() => setMappingForm({ ...mappingForm, ldap_group_dn: g.dn, ldap_group_name: g.name })}
                              className={clsx(
                                'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                                mappingForm.ldap_group_dn === g.dn 
                                  ? 'bg-indigo-500/20 text-indigo-400' 
                                  : (isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100')
                              )}
                            >
                              <span className="font-medium">{g.name}</span>
                              <span className={clsx('text-xs ml-2', theme.contentTextMuted)}>({g.memberCount} üye)</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Grup Adı (Görüntüleme)</label>
                      <input 
                        type="text" 
                        placeholder="Grup adı"
                        value={mappingForm.ldap_group_name}
                        onChange={(e) => setMappingForm({ ...mappingForm, ldap_group_name: e.target.value })}
                        className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                      />
                    </div>

                    {showMappingModal === 'position' ? (
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Clixer Pozisyonu</label>
                        <select 
                          value={mappingForm.position_code}
                          onChange={(e) => setMappingForm({ ...mappingForm, position_code: e.target.value })}
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                        >
                          {positions.map(pos => (
                            <option key={pos.code} value={pos.code}>{pos.name}</option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            id="grants_all"
                            checked={mappingForm.grants_all_stores}
                            onChange={(e) => setMappingForm({ ...mappingForm, grants_all_stores: e.target.checked })}
                            className="w-5 h-5 rounded"
                          />
                          <label htmlFor="grants_all" className={clsx('font-medium', theme.contentText)}>
                            Tüm mağazalara erişim ver
                          </label>
                        </div>
                        {!mappingForm.grants_all_stores && (
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Mağaza ID</label>
                              <input 
                                type="text" 
                                placeholder="212avm"
                                value={mappingForm.store_id}
                                onChange={(e) => setMappingForm({ ...mappingForm, store_id: e.target.value })}
                                className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                              />
                            </div>
                            <div>
                              <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Mağaza Adı</label>
                              <input 
                                type="text" 
                                placeholder="212 AVM"
                                value={mappingForm.store_name}
                                onChange={(e) => setMappingForm({ ...mappingForm, store_name: e.target.value })}
                                className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowMappingModal(null)}
                      className={clsx('px-6 py-2.5 rounded-xl font-medium', theme.buttonSecondary)}
                    >
                      İptal
                    </button>
                    <button
                      onClick={showMappingModal === 'position' ? savePositionMapping : saveStoreMapping}
                      disabled={!mappingForm.ldap_group_dn}
                      className={clsx('px-6 py-2.5 rounded-xl font-medium flex items-center gap-2', theme.buttonPrimary)}
                    >
                      <Check size={16} /> Kaydet
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Sistem Monitörü */}
        {activeTab === 'monitor' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-cyan-500/20' : 'bg-cyan-100')}>
                  <Activity size={24} className={isDark ? 'text-cyan-400' : 'text-cyan-600'} />
                </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>Sistem Monitörü</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Aktif kullanıcılar ve sistem durumu
                  </p>
                </div>
              </div>
              <button
                onClick={loadSessions}
                disabled={sessionsLoading}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
              >
                <RefreshCw size={16} className={sessionsLoading ? 'animate-spin' : ''} />
                Yenile
              </button>
            </div>

            <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
              <h3 className={clsx('font-bold text-lg mb-4', theme.contentText)}>
                Aktif Oturumlar ({activeSessions.length})
              </h3>
              
              {sessionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={32} className="animate-spin text-cyan-500" />
                </div>
              ) : activeSessions.length === 0 ? (
                <p className={clsx('text-sm text-center py-6', theme.contentTextMuted)}>
                  Şu an aktif oturum bulunmuyor
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className={clsx('border-b', theme.border)}>
                        <th className={clsx('px-4 py-3 text-left font-medium', theme.contentTextMuted)}>Kullanıcı</th>
                        <th className={clsx('px-4 py-3 text-left font-medium', theme.contentTextMuted)}>Pozisyon</th>
                        <th className={clsx('px-4 py-3 text-left font-medium', theme.contentTextMuted)}>IP Adresi</th>
                        <th className={clsx('px-4 py-3 text-left font-medium', theme.contentTextMuted)}>Giriş Zamanı</th>
                        <th className={clsx('px-4 py-3 text-left font-medium', theme.contentTextMuted)}>Süre</th>
                        <th className={clsx('px-4 py-3 text-center font-medium', theme.contentTextMuted)}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeSessions.map((session: any) => (
                        <tr key={session.user_id} className={clsx('border-b', theme.border)}>
                          <td className={clsx('px-4 py-3', theme.contentText)}>
                            <div>
                              <p className="font-medium">{session.name || session.email}</p>
                              <p className={clsx('text-xs', theme.contentTextMuted)}>{session.email}</p>
                            </div>
                          </td>
                          <td className={clsx('px-4 py-3', theme.contentText)}>{session.position_code || '-'}</td>
                          <td className={clsx('px-4 py-3', theme.contentText)}>{session.ip_address || '-'}</td>
                          <td className={clsx('px-4 py-3', theme.contentText)}>
                            {session.session_start ? new Date(session.session_start).toLocaleString('tr-TR') : '-'}
                          </td>
                          <td className={clsx('px-4 py-3', theme.contentText)}>
                            {session.duration ? `${Math.floor(session.duration / 60)} dk` : '-'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => killSession(session.user_id)}
                              className="p-2 rounded-lg hover:bg-rose-500/20 text-rose-500"
                              title="Oturumu Sonlandır"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Yedekleme */}
        {activeTab === 'backup' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                  <HardDrive size={24} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                </div>
                <div>
                  <h1 className={clsx('text-xl font-bold', theme.contentText)}>Yedekleme</h1>
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Veritabanı yedekleme ve geri yükleme
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadBackups}
                  disabled={backupsLoading}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonSecondary)}
                >
                  <RefreshCw size={16} className={backupsLoading ? 'animate-spin' : ''} />
                  Yenile
                </button>
                <button
                  onClick={createBackup}
                  disabled={backupCreating}
                  className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
                >
                  {backupCreating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Yedek Al
                </button>
              </div>
            </div>

            <div className={clsx('rounded-2xl p-6', theme.cardBg)}>
              <h3 className={clsx('font-bold text-lg mb-4', theme.contentText)}>Yedek Listesi</h3>
              
              {backupsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={32} className="animate-spin text-amber-500" />
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-8">
                  <HardDrive size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Henüz yedek bulunmuyor. "Yedek Al" butonuna tıklayarak yeni bir yedek oluşturun.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {backups.map((backup: any, i: number) => (
                    <div
                      key={i}
                      className={clsx('p-4 rounded-xl flex items-center justify-between', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}
                    >
                      <div>
                        <p className={clsx('font-medium', theme.contentText)}>{backup.name || backup.filename}</p>
                        <p className={clsx('text-sm', theme.contentTextMuted)}>
                          {backup.date ? new Date(backup.date).toLocaleString('tr-TR') : '-'}
                          {backup.size && ` • ${backup.size}`}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button className={clsx('p-2 rounded-lg', theme.buttonSecondary)} title="İndir">
                          <Download size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* GLOBAL MODAL'LAR (Her sekmeden erişilebilir) */}
      {/* ========================= */}

      {/* Dataset'ten Mağaza Import Modal */}
      {showDatasetImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-4xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx('text-xl font-bold', theme.contentText)}>
                <Database className="inline-block mr-2" size={24} />
                Dataset'ten Mağaza Import
              </h2>
              <button
                onClick={() => setShowDatasetImportModal(false)}
                className={clsx('p-2 rounded-lg', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                ✕
              </button>
            </div>

            {/* Adım 1: Dataset Seçimi */}
            <div className="mb-6">
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                1. Kaynak Dataset Seçin
              </label>
              <select
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className={clsx('w-full px-4 py-3 rounded-xl text-sm border', theme.inputBg, theme.inputText, theme.border)}
              >
                <option value="">-- Dataset Seçin --</option>
                {availableDatasets.map((ds: any) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.total_rows?.toLocaleString('tr-TR') || '?'} satır)
                  </option>
                ))}
              </select>
            </div>

            {/* Dataset seçildiyse kolon mapping göster */}
            {selectedDatasetId && datasetColumns.length > 0 && (
              <>
                {/* Bilgi */}
                <div className={clsx('mb-4 p-3 rounded-xl text-sm', 'bg-blue-500/10 border border-blue-500/30')}>
                  <span className="text-blue-400">ℹ️ {datasetTotalRows.toLocaleString('tr-TR')} mağaza kaydı bulundu. Aşağıdan kolon eşleştirmesini yapın.</span>
                </div>

                {/* Adım 2: Kolon Mapping */}
                <div className="mb-6">
                  <label className={clsx('block text-sm font-medium mb-3', theme.contentText)}>
                    2. Kolon Eşleştirmesi
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* Zorunlu Alan: Kod */}
                    <div className={clsx('p-3 rounded-xl border', theme.border, 'bg-amber-500/5')}>
                      <label className={clsx('block text-xs font-medium mb-1 text-amber-400')}>
                        Kod (Zorunlu) *
                      </label>
                      <select
                        value={datasetImportMapping.code}
                        onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, code: e.target.value })}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.border)}
                      >
                        <option value="">-- Kolon Seçin --</option>
                        {datasetColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mağaza Adı */}
                    <div className={clsx('p-3 rounded-xl border', theme.border)}>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        Mağaza Adı
                      </label>
                      <select
                        value={datasetImportMapping.name}
                        onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, name: e.target.value })}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.border)}
                      >
                        <option value="">-- Kolon Seçin --</option>
                        {datasetColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tip (Location - AVM/CADDE) */}
                    <div className={clsx('p-3 rounded-xl border', theme.border)}>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        Tip (AVM/CADDE)
                      </label>
                      <select
                        value={datasetImportMapping.store_type}
                        onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, store_type: e.target.value })}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.border)}
                      >
                        <option value="">-- Kolon Seçin --</option>
                        {datasetColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sahiplik Grubu (BranchType - FR/TDUN) */}
                    <div className={clsx('p-3 rounded-xl border', theme.border)}>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        Sahiplik Grubu (FR/MERKEZ)
                      </label>
                      <select
                        value={datasetImportMapping.ownership_group}
                        onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, ownership_group: e.target.value })}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.border)}
                      >
                        <option value="">-- Kolon Seçin --</option>
                        {datasetColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Bölge */}
                    <div className={clsx('p-3 rounded-xl border', theme.border)}>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        Bölge Kodu
                      </label>
                      <select
                        value={datasetImportMapping.region_code}
                        onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, region_code: e.target.value })}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.border)}
                      >
                        <option value="">-- Kolon Seçin --</option>
                        {datasetColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Şehir */}
                    <div className={clsx('p-3 rounded-xl border', theme.border)}>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>
                        Şehir
                      </label>
                      <select
                        value={datasetImportMapping.city}
                        onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, city: e.target.value })}
                        className={clsx('w-full px-3 py-2 rounded-lg text-sm border', theme.inputBg, theme.inputText, theme.border)}
                      >
                        <option value="">-- Kolon Seçin --</option>
                        {datasetColumns.map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Önizleme Tablosu */}
                {datasetPreview.length > 0 && (
                  <div className="mb-6">
                    <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                      3. Önizleme (İlk 10 satır)
                    </label>
                    <div className="overflow-x-auto rounded-xl border" style={{ maxHeight: '200px' }}>
                      <table className="w-full text-xs">
                        <thead className={clsx('sticky top-0', theme.headerBg)}>
                          <tr>
                            {datasetColumns.slice(0, 6).map((col) => (
                              <th key={col.name} className={clsx('px-3 py-2 text-left font-medium', theme.contentTextMuted)}>
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {datasetPreview.map((row, idx) => (
                            <tr key={idx} className={clsx('border-t', theme.border)}>
                              {datasetColumns.slice(0, 6).map((col) => (
                                <td key={col.name} className={clsx('px-3 py-2', theme.contentText)}>
                                  {String(row[col.name] ?? '-').substring(0, 30)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Import Sonucu */}
                {datasetImportResult && (
                  <div className={clsx('mb-4 p-4 rounded-xl', 'bg-emerald-500/10 border border-emerald-500/30')}>
                    <div className="flex items-center gap-2 mb-2">
                      <Check size={20} className="text-emerald-400" />
                      <span className={clsx('font-medium', theme.contentText)}>Import Tamamlandı!</span>
                    </div>
                    <div className="text-sm text-emerald-400">
                      {datasetImportResult.imported} yeni mağaza eklendi, {datasetImportResult.updated} mağaza güncellendi
                    </div>
                    {datasetImportResult.errors.length > 0 && (
                      <div className="mt-2 text-xs text-amber-400">
                        {datasetImportResult.errors.length} hata: {datasetImportResult.errors.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Butonlar */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={() => setShowDatasetImportModal(false)}
                className={clsx('px-4 py-2 rounded-xl text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={importFromDataset}
                disabled={!selectedDatasetId || !datasetImportMapping.code || datasetImporting}
                className={clsx(
                  'flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-medium text-white',
                  (!selectedDatasetId || !datasetImportMapping.code || datasetImporting)
                    ? 'bg-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600'
                )}
              >
                {datasetImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Import Ediliyor...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    {datasetTotalRows.toLocaleString('tr-TR')} Mağaza Import Et
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mağaza Ekleme/Düzenleme Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-3xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto', theme.cardBg)}>
            <h2 className={clsx('text-xl font-bold mb-6', theme.contentText)}>
              {editingStore ? 'Mağaza Düzenle' : 'Yeni Mağaza Ekle'}
            </h2>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kod *</label>
                <input
                  type="text"
                  value={storeForm.code}
                  onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  placeholder="STORE001"
                  disabled={!!editingStore}
                />
              </div>
              <div className="col-span-2">
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Mağaza Adı *</label>
                <input
                  type="text"
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  placeholder="İstanbul Kadıköy"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Tip</label>
                <select
                  value={storeForm.store_type}
                  onChange={(e) => setStoreForm({ ...storeForm, store_type: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value="MAGAZA">Mağaza</option>
                  <option value="DEPO">Depo</option>
                  <option value="MERKEZ">Merkez</option>
                </select>
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Sahiplik Grubu</label>
                <select
                  value={storeForm.ownership_group}
                  onChange={(e) => setStoreForm({ ...storeForm, ownership_group: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                >
                  {ownershipGroups.map(g => (
                    <option key={g.code} value={g.code}>{g.icon || ''} {g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Bölge</label>
                <select
                  value={storeForm.region_id}
                  onChange={(e) => setStoreForm({ ...storeForm, region_id: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value="">-- Bölge Seç --</option>
                  {allRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Şehir</label>
                <input
                  type="text"
                  value={storeForm.city}
                  onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>İlçe</label>
                <input
                  type="text"
                  value={storeForm.district}
                  onChange={(e) => setStoreForm({ ...storeForm, district: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Telefon</label>
                <input
                  type="text"
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div className="col-span-3">
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Adres</label>
                <input
                  type="text"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>E-posta</label>
                <input
                  type="email"
                  value={storeForm.email}
                  onChange={(e) => setStoreForm({ ...storeForm, email: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Mağaza Müdürü</label>
                <input
                  type="text"
                  value={storeForm.manager_name}
                  onChange={(e) => setStoreForm({ ...storeForm, manager_name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Müdür E-posta</label>
                <input
                  type="email"
                  value={storeForm.manager_email}
                  onChange={(e) => setStoreForm({ ...storeForm, manager_email: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Açılış Tarihi</label>
                <input
                  type="date"
                  value={storeForm.opening_date}
                  onChange={(e) => setStoreForm({ ...storeForm, opening_date: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>m²</label>
                <input
                  type="number"
                  value={storeForm.square_meters}
                  onChange={(e) => setStoreForm({ ...storeForm, square_meters: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Çalışan Sayısı</label>
                <input
                  type="number"
                  value={storeForm.employee_count}
                  onChange={(e) => setStoreForm({ ...storeForm, employee_count: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kira (₺)</label>
                <input
                  type="number"
                  value={storeForm.rent_amount}
                  onChange={(e) => setStoreForm({ ...storeForm, rent_amount: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Hedef Ciro (₺)</label>
                <input
                  type="number"
                  value={storeForm.target_revenue}
                  onChange={(e) => setStoreForm({ ...storeForm, target_revenue: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowStoreModal(false)}
                className={clsx('px-4 py-2 rounded-xl text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={saveStore}
                disabled={saving === 'store' || !storeForm.code || !storeForm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving === 'store' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editingStore ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bölge Ekleme/Düzenleme Modal */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-md rounded-2xl p-6', theme.cardBg)}>
            <h2 className={clsx('text-xl font-bold mb-6', theme.contentText)}>
              {editingRegion ? 'Bölge Düzenle' : 'Yeni Bölge Ekle'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kod *</label>
                <input
                  type="text"
                  value={regionForm.code}
                  onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value.toUpperCase() })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  placeholder="MARMARA"
                  disabled={!!editingRegion}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Bölge Adı *</label>
                <input
                  type="text"
                  value={regionForm.name}
                  onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  placeholder="Marmara Bölgesi"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Açıklama</label>
                <textarea
                  value={regionForm.description}
                  onChange={(e) => setRegionForm({ ...regionForm, description: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  rows={2}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Bölge Müdürü</label>
                <input
                  type="text"
                  value={regionForm.manager_name}
                  onChange={(e) => setRegionForm({ ...regionForm, manager_name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Müdür E-posta</label>
                <input
                  type="email"
                  value={regionForm.manager_email}
                  onChange={(e) => setRegionForm({ ...regionForm, manager_email: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowRegionModal(false)}
                className={clsx('px-4 py-2 rounded-xl text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={saveRegion}
                disabled={saving === 'region' || !regionForm.code || !regionForm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving === 'region' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editingRegion ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grup Ekleme/Düzenleme Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-md rounded-2xl p-6', theme.cardBg)}>
            <h2 className={clsx('text-xl font-bold mb-6', theme.contentText)}>
              {editingGroup ? 'Grup Düzenle' : 'Yeni Grup Ekle'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kod *</label>
                <input
                  type="text"
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value.toUpperCase() })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  placeholder="FRANCHISE"
                  disabled={!!editingGroup}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Grup Adı *</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  placeholder="Franchise Mağazalar"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Açıklama</label>
                <textarea
                  value={groupForm.description}
                  onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>İkon</label>
                  <input
                    type="text"
                    value={groupForm.icon}
                    onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })}
                    className={clsx('w-full px-3 py-2 rounded-xl text-sm border', theme.inputBg, theme.inputText)}
                    placeholder="🏢"
                  />
                </div>
                <div>
                  <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Renk</label>
                  <input
                    type="color"
                    value={groupForm.color}
                    onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                    className={clsx('w-full h-10 px-1 py-1 rounded-xl', theme.inputBg)}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowGroupModal(false)}
                className={clsx('px-4 py-2 rounded-xl text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={saveGroup}
                disabled={saving === 'group' || !groupForm.code || !groupForm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving === 'group' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {editingGroup ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-2xl rounded-2xl p-6', theme.cardBg)}>
            <h2 className={clsx('text-xl font-bold mb-6', theme.contentText)}>
              CSV Import - {showImportModal === 'stores' ? 'Mağazalar' : 'Bölgeler'}
            </h2>
            
            <div className="space-y-4">
              <div className={clsx('border-2 border-dashed rounded-xl p-8 text-center', theme.border)}>
                <FileSpreadsheet size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
                <p className={clsx('mb-2', theme.contentText)}>CSV dosyası seçin</p>
                <p className={clsx('text-sm mb-4', theme.contentTextMuted)}>
                  İlk satır kolon başlıkları olmalı. Şablon için "Şablon İndir" butonunu kullanın.
                </p>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csvFileInput"
                />
                <label
                  htmlFor="csvFileInput"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 cursor-pointer"
                >
                  <Upload size={16} />
                  Dosya Seç
                </label>
              </div>

              {importData.length > 0 && (
                <div>
                  <p className={clsx('text-sm font-medium mb-2', theme.contentText)}>
                    Önizleme ({importData.length} kayıt)
                  </p>
                  <div className="overflow-x-auto max-h-64 border rounded-xl">
                    <table className="w-full text-sm">
                      <thead className={clsx('sticky top-0', theme.cardBg)}>
                        <tr>
                          {Object.keys(importData[0] || {}).map(key => (
                            <th key={key} className={clsx('px-3 py-2 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importData.slice(0, 5).map((row, i) => (
                          <tr key={i} className={clsx('border-t', theme.border)}>
                            {Object.values(row).map((val: any, j) => (
                              <td key={j} className={clsx('px-3 py-2', theme.contentText)}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {importData.length > 5 && (
                    <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>... ve {importData.length - 5} satır daha</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setShowImportModal(null); setImportData([]) }}
                className={clsx('px-4 py-2 rounded-xl text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={handleImport}
                disabled={importing || importData.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Import Et ({importData.length} kayıt)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
