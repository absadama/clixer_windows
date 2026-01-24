/**
 * Clixer - Admin Page Store
 * AdminPage.tsx için merkezi state yönetimi
 * 37 useState → Zustand store
 */

import { create } from 'zustand'
import { SystemSetting } from '../types'

// ============================================
// TYPES
// ============================================

export interface UserForm {
  email: string
  name: string
  password: string
  role: string
  position_code: string
  stores: { store_id: string; store_name: string }[]
  filter_value: string
  categories: string[]
  canSeeAllCategories: boolean
}

export interface LdapForm {
  name: string
  server_url: string
  base_dn: string
  bind_dn: string
  bind_password: string
  user_search_base: string
  user_filter: string
  group_search_base: string
  group_filter: string
  sync_schedule: string
  is_active: boolean
}

export interface StoreForm {
  code: string
  name: string
  store_type: string
  ownership_group: string
  region_id: string
  city: string
  district: string
  address: string
  phone: string
  email: string
  manager_name: string
  manager_email: string
  opening_date: string
  square_meters: string
  employee_count: string
  rent_amount: string
  target_revenue: string
}

export interface RegionForm {
  code: string
  name: string
  description: string
  manager_name: string
  manager_email: string
}

export interface GroupForm {
  code: string
  name: string
  description: string
  color: string
  icon: string
}

export interface MappingForm {
  ldap_group_dn: string
  ldap_group_name: string
  position_code: string
  store_id: string
  store_name: string
  grants_all_stores: boolean
}

export interface DatasetImportMapping {
  code: string
  name: string
  store_type: string
  ownership_group: string
  region_code: string
  city: string
  district: string
  address: string
  phone: string
  email: string
  manager_name: string
}

export type AdminTab = 'settings' | 'labels' | 'performance' | 'master' | 'monitor' | 'backup' | 'users' | 'roles' | 'report-categories' | 'ldap'
export type MasterTab = 'stores' | 'regions' | 'groups'
export type LabelsTab = 'menu' | 'position' | 'data'

// ============================================
// STORE STATE
// ============================================

interface AdminState {
  // Active Tab
  activeTab: AdminTab
  
  // Settings
  settings: SystemSetting[]
  searchQuery: string
  loading: boolean
  saving: string | null
  editingKey: string | null
  editValue: string
  seeding: boolean
  
  // Performance
  perfSettings: any
  perfLoading: boolean
  cacheClearLoading: boolean
  redisInfo: any | null
  
  // Users
  users: any[]
  positions: any[]
  showUserModal: boolean
  editingUser: any | null
  userForm: UserForm
  
  // Roles
  editingRole: any | null
  rolePermissions: any[]
  
  // LDAP
  ldapConfig: any | null
  ldapForm: LdapForm
  ldapTesting: boolean
  ldapTestResult: { success: boolean; message: string } | null
  ldapGroups: any[]
  loadingLdapGroups: boolean
  positionMappings: any[]
  storeMappings: any[]
  syncLogs: any[]
  syncing: boolean
  showMappingModal: 'position' | 'store' | null
  mappingForm: MappingForm
  
  // System Monitor
  activeSessions: any[]
  sessionsLoading: boolean
  restartLoading: boolean
  
  // Logo Upload
  logoUploading: boolean
  logoPreview: string | null
  logoFile: File | null
  logoError: string | null
  logoInfo: {
    hasCustomLogo: boolean
    currentLogoUrl: string
    currentFaviconUrl: string
  } | null
  
  // Backup
  backups: any[]
  backupsLoading: boolean
  backupCreating: boolean
  
  // Stores & Regions
  availableStores: {
    store_id: string
    store_name: string
    store_type?: string
    region_id?: string
    region_name?: string
  }[]
  regions: { id: string; name: string }[]
  
  // Store Filters
  storeFilterRegion: string
  storeFilterType: string
  storeSearchTerm: string
  
  // Master Data
  masterTab: MasterTab
  allStores: any[]
  allRegions: any[]
  ownershipGroups: any[]
  showStoreModal: boolean
  showRegionModal: boolean
  showGroupModal: boolean
  editingStore: any | null
  editingRegion: any | null
  editingGroup: any | null
  storeForm: StoreForm
  regionForm: RegionForm
  groupForm: GroupForm
  masterSearchQuery: string
  showImportModal: 'stores' | 'regions' | null
  importData: any[]
  importing: boolean
  
  // Dataset Import
  showDatasetImportModal: boolean
  availableDatasets: any[]
  selectedDatasetId: string
  datasetColumns: { name: string; type: string }[]
  datasetPreview: any[]
  datasetTotalRows: number
  datasetImportMapping: DatasetImportMapping
  datasetImporting: boolean
  datasetImportResult: { imported: number; updated: number; errors: string[] } | null
  
  // Labels
  labels: any[]
  labelsLoading: boolean
  labelsSaving: boolean
  labelsTab: LabelsTab
}

// ============================================
// STORE ACTIONS
// ============================================

interface AdminActions {
  // Tab
  setActiveTab: (tab: AdminTab) => void
  
  // Settings
  setSettings: (settings: SystemSetting[] | ((prev: SystemSetting[]) => SystemSetting[])) => void
  setSearchQuery: (query: string) => void
  setLoading: (loading: boolean) => void
  setSaving: (saving: string | null) => void
  setEditingKey: (key: string | null) => void
  setEditValue: (value: string) => void
  setSeeding: (seeding: boolean) => void
  
  // Performance
  setPerfSettings: (settings: any) => void
  setPerfLoading: (loading: boolean) => void
  setCacheClearLoading: (loading: boolean) => void
  setRedisInfo: (info: any | null) => void
  
  // Users
  setUsers: (users: any[]) => void
  setPositions: (positions: any[]) => void
  setShowUserModal: (show: boolean) => void
  setEditingUser: (user: any | null) => void
  setUserForm: (form: Partial<UserForm>) => void
  resetUserForm: () => void
  
  // Roles
  setEditingRole: (role: any | null) => void
  setRolePermissions: (permissions: any[]) => void
  
  // LDAP
  setLdapConfig: (config: any | null) => void
  setLdapForm: (form: Partial<LdapForm>) => void
  setLdapTesting: (testing: boolean) => void
  setLdapTestResult: (result: { success: boolean; message: string } | null) => void
  setLdapGroups: (groups: any[]) => void
  setLoadingLdapGroups: (loading: boolean) => void
  setPositionMappings: (mappings: any[]) => void
  setStoreMappings: (mappings: any[]) => void
  setSyncLogs: (logs: any[]) => void
  setSyncing: (syncing: boolean) => void
  setShowMappingModal: (modal: 'position' | 'store' | null) => void
  setMappingForm: (form: Partial<MappingForm>) => void
  
  // System Monitor
  setActiveSessions: (sessions: any[]) => void
  setSessionsLoading: (loading: boolean) => void
  setRestartLoading: (loading: boolean) => void
  
  // Logo Upload
  setLogoUploading: (uploading: boolean) => void
  setLogoPreview: (preview: string | null) => void
  setLogoFile: (file: File | null) => void
  setLogoError: (error: string | null) => void
  setLogoInfo: (info: any | null) => void
  
  // Backup
  setBackups: (backups: any[]) => void
  setBackupsLoading: (loading: boolean) => void
  setBackupCreating: (creating: boolean) => void
  
  // Stores & Regions
  setAvailableStores: (stores: any[]) => void
  setRegions: (regions: any[]) => void
  
  // Store Filters
  setStoreFilterRegion: (region: string) => void
  setStoreFilterType: (type: string) => void
  setStoreSearchTerm: (term: string) => void
  
  // Master Data
  setMasterTab: (tab: MasterTab) => void
  setAllStores: (stores: any[]) => void
  setAllRegions: (regions: any[]) => void
  setOwnershipGroups: (groups: any[]) => void
  setShowStoreModal: (show: boolean) => void
  setShowRegionModal: (show: boolean) => void
  setShowGroupModal: (show: boolean) => void
  setEditingStore: (store: any | null) => void
  setEditingRegion: (region: any | null) => void
  setEditingGroup: (group: any | null) => void
  setStoreForm: (form: Partial<StoreForm>) => void
  setRegionForm: (form: Partial<RegionForm>) => void
  setGroupForm: (form: Partial<GroupForm>) => void
  resetStoreForm: () => void
  resetRegionForm: () => void
  resetGroupForm: () => void
  setMasterSearchQuery: (query: string) => void
  setShowImportModal: (modal: 'stores' | 'regions' | null) => void
  setImportData: (data: any[]) => void
  setImporting: (importing: boolean) => void
  
  // Dataset Import
  setShowDatasetImportModal: (show: boolean) => void
  setAvailableDatasets: (datasets: any[]) => void
  setSelectedDatasetId: (id: string) => void
  setDatasetColumns: (columns: any[]) => void
  setDatasetPreview: (preview: any[]) => void
  setDatasetTotalRows: (rows: number) => void
  setDatasetImportMapping: (mapping: Partial<DatasetImportMapping>) => void
  setDatasetImporting: (importing: boolean) => void
  setDatasetImportResult: (result: any | null) => void
  resetDatasetImport: () => void
  
  // Labels
  setLabels: (labels: any[]) => void
  setLabelsLoading: (loading: boolean) => void
  setLabelsSaving: (saving: boolean) => void
  setLabelsTab: (tab: LabelsTab) => void
}

// ============================================
// DEFAULT VALUES
// ============================================

const defaultUserForm: UserForm = {
  email: '',
  name: '',
  password: '',
  role: 'USER',
  position_code: 'VIEWER',
  stores: [],
  filter_value: '',
  categories: [],
  canSeeAllCategories: false
}

const defaultLdapForm: LdapForm = {
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
}

const defaultStoreForm: StoreForm = {
  code: '',
  name: '',
  store_type: 'MAGAZA',
  ownership_group: 'MERKEZ',
  region_id: '',
  city: '',
  district: '',
  address: '',
  phone: '',
  email: '',
  manager_name: '',
  manager_email: '',
  opening_date: '',
  square_meters: '',
  employee_count: '',
  rent_amount: '',
  target_revenue: ''
}

const defaultRegionForm: RegionForm = {
  code: '',
  name: '',
  description: '',
  manager_name: '',
  manager_email: ''
}

const defaultGroupForm: GroupForm = {
  code: '',
  name: '',
  description: '',
  color: '#3B82F6',
  icon: '🏢'
}

const defaultMappingForm: MappingForm = {
  ldap_group_dn: '',
  ldap_group_name: '',
  position_code: 'VIEWER',
  store_id: '',
  store_name: '',
  grants_all_stores: false
}

const defaultDatasetImportMapping: DatasetImportMapping = {
  code: '',
  name: '',
  store_type: '',
  ownership_group: '',
  region_code: '',
  city: '',
  district: '',
  address: '',
  phone: '',
  email: '',
  manager_name: ''
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useAdminStore = create<AdminState & AdminActions>((set) => ({
  // Initial State
  activeTab: 'settings',
  
  settings: [],
  searchQuery: '',
  loading: false,
  saving: null,
  editingKey: null,
  editValue: '',
  seeding: false,
  
  perfSettings: {},
  perfLoading: false,
  cacheClearLoading: false,
  redisInfo: null,
  
  users: [],
  positions: [],
  showUserModal: false,
  editingUser: null,
  userForm: { ...defaultUserForm },
  
  editingRole: null,
  rolePermissions: [],
  
  ldapConfig: null,
  ldapForm: { ...defaultLdapForm },
  ldapTesting: false,
  ldapTestResult: null,
  ldapGroups: [],
  loadingLdapGroups: false,
  positionMappings: [],
  storeMappings: [],
  syncLogs: [],
  syncing: false,
  showMappingModal: null,
  mappingForm: { ...defaultMappingForm },
  
  activeSessions: [],
  sessionsLoading: false,
  restartLoading: false,
  
  logoUploading: false,
  logoPreview: null,
  logoFile: null,
  logoError: null,
  logoInfo: null,
  
  backups: [],
  backupsLoading: false,
  backupCreating: false,
  
  availableStores: [],
  regions: [],
  
  storeFilterRegion: '',
  storeFilterType: '',
  storeSearchTerm: '',
  
  masterTab: 'stores',
  allStores: [],
  allRegions: [],
  ownershipGroups: [],
  showStoreModal: false,
  showRegionModal: false,
  showGroupModal: false,
  editingStore: null,
  editingRegion: null,
  editingGroup: null,
  storeForm: { ...defaultStoreForm },
  regionForm: { ...defaultRegionForm },
  groupForm: { ...defaultGroupForm },
  masterSearchQuery: '',
  showImportModal: null,
  importData: [],
  importing: false,
  
  showDatasetImportModal: false,
  availableDatasets: [],
  selectedDatasetId: '',
  datasetColumns: [],
  datasetPreview: [],
  datasetTotalRows: 0,
  datasetImportMapping: { ...defaultDatasetImportMapping },
  datasetImporting: false,
  datasetImportResult: null,
  
  labels: [],
  labelsLoading: false,
  labelsSaving: false,
  labelsTab: 'menu',
  
  // Actions
  setActiveTab: (activeTab) => set({ activeTab }),
  
  setSettings: (settingsOrUpdater) => set((state) => ({
    settings: typeof settingsOrUpdater === 'function' 
      ? settingsOrUpdater(state.settings) 
      : settingsOrUpdater
  })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setLoading: (loading) => set({ loading }),
  setSaving: (saving) => set({ saving }),
  setEditingKey: (editingKey) => set({ editingKey }),
  setEditValue: (editValue) => set({ editValue }),
  setSeeding: (seeding) => set({ seeding }),
  
  setPerfSettings: (perfSettings) => set({ perfSettings }),
  setPerfLoading: (perfLoading) => set({ perfLoading }),
  setCacheClearLoading: (cacheClearLoading) => set({ cacheClearLoading }),
  setRedisInfo: (redisInfo) => set({ redisInfo }),
  
  setUsers: (users) => set({ users }),
  setPositions: (positions) => set({ positions }),
  setShowUserModal: (showUserModal) => set({ showUserModal }),
  setEditingUser: (editingUser) => set({ editingUser }),
  setUserForm: (form) => set((state) => ({ userForm: { ...state.userForm, ...form } })),
  resetUserForm: () => set({ userForm: { ...defaultUserForm } }),
  
  setEditingRole: (editingRole) => set({ editingRole }),
  setRolePermissions: (rolePermissions) => set({ rolePermissions }),
  
  setLdapConfig: (ldapConfig) => set({ ldapConfig }),
  setLdapForm: (form) => set((state) => ({ ldapForm: { ...state.ldapForm, ...form } })),
  setLdapTesting: (ldapTesting) => set({ ldapTesting }),
  setLdapTestResult: (ldapTestResult) => set({ ldapTestResult }),
  setLdapGroups: (ldapGroups) => set({ ldapGroups }),
  setLoadingLdapGroups: (loadingLdapGroups) => set({ loadingLdapGroups }),
  setPositionMappings: (positionMappings) => set({ positionMappings }),
  setStoreMappings: (storeMappings) => set({ storeMappings }),
  setSyncLogs: (syncLogs) => set({ syncLogs }),
  setSyncing: (syncing) => set({ syncing }),
  setShowMappingModal: (showMappingModal) => set({ showMappingModal }),
  setMappingForm: (form) => set((state) => ({ mappingForm: { ...state.mappingForm, ...form } })),
  
  setActiveSessions: (activeSessions) => set({ activeSessions }),
  setSessionsLoading: (sessionsLoading) => set({ sessionsLoading }),
  setRestartLoading: (restartLoading) => set({ restartLoading }),
  
  setLogoUploading: (logoUploading) => set({ logoUploading }),
  setLogoPreview: (logoPreview) => set({ logoPreview }),
  setLogoFile: (logoFile) => set({ logoFile }),
  setLogoError: (logoError) => set({ logoError }),
  setLogoInfo: (logoInfo) => set({ logoInfo }),
  
  setBackups: (backups) => set({ backups }),
  setBackupsLoading: (backupsLoading) => set({ backupsLoading }),
  setBackupCreating: (backupCreating) => set({ backupCreating }),
  
  setAvailableStores: (availableStores) => set({ availableStores }),
  setRegions: (regions) => set({ regions }),
  
  setStoreFilterRegion: (storeFilterRegion) => set({ storeFilterRegion }),
  setStoreFilterType: (storeFilterType) => set({ storeFilterType }),
  setStoreSearchTerm: (storeSearchTerm) => set({ storeSearchTerm }),
  
  setMasterTab: (masterTab) => set({ masterTab }),
  setAllStores: (allStores) => set({ allStores }),
  setAllRegions: (allRegions) => set({ allRegions }),
  setOwnershipGroups: (ownershipGroups) => set({ ownershipGroups }),
  setShowStoreModal: (showStoreModal) => set({ showStoreModal }),
  setShowRegionModal: (showRegionModal) => set({ showRegionModal }),
  setShowGroupModal: (showGroupModal) => set({ showGroupModal }),
  setEditingStore: (editingStore) => set({ editingStore }),
  setEditingRegion: (editingRegion) => set({ editingRegion }),
  setEditingGroup: (editingGroup) => set({ editingGroup }),
  setStoreForm: (form) => set((state) => ({ storeForm: { ...state.storeForm, ...form } })),
  setRegionForm: (form) => set((state) => ({ regionForm: { ...state.regionForm, ...form } })),
  setGroupForm: (form) => set((state) => ({ groupForm: { ...state.groupForm, ...form } })),
  resetStoreForm: () => set({ storeForm: { ...defaultStoreForm } }),
  resetRegionForm: () => set({ regionForm: { ...defaultRegionForm } }),
  resetGroupForm: () => set({ groupForm: { ...defaultGroupForm } }),
  setMasterSearchQuery: (masterSearchQuery) => set({ masterSearchQuery }),
  setShowImportModal: (showImportModal) => set({ showImportModal }),
  setImportData: (importData) => set({ importData }),
  setImporting: (importing) => set({ importing }),
  
  setShowDatasetImportModal: (showDatasetImportModal) => set({ showDatasetImportModal }),
  setAvailableDatasets: (availableDatasets) => set({ availableDatasets }),
  setSelectedDatasetId: (selectedDatasetId) => set({ selectedDatasetId }),
  setDatasetColumns: (datasetColumns) => set({ datasetColumns }),
  setDatasetPreview: (datasetPreview) => set({ datasetPreview }),
  setDatasetTotalRows: (datasetTotalRows) => set({ datasetTotalRows }),
  setDatasetImportMapping: (mapping) => set((state) => ({ datasetImportMapping: { ...state.datasetImportMapping, ...mapping } })),
  setDatasetImporting: (datasetImporting) => set({ datasetImporting }),
  setDatasetImportResult: (datasetImportResult) => set({ datasetImportResult }),
  resetDatasetImport: () => set({
    selectedDatasetId: '',
    datasetColumns: [],
    datasetPreview: [],
    datasetTotalRows: 0,
    datasetImportMapping: { ...defaultDatasetImportMapping },
    datasetImportResult: null
  }),
  
  setLabels: (labels) => set({ labels }),
  setLabelsLoading: (labelsLoading) => set({ labelsLoading }),
  setLabelsSaving: (labelsSaving) => set({ labelsSaving }),
  setLabelsTab: (labelsTab) => set({ labelsTab }),
}))

// ============================================
// CONSTANTS (Export edilecek)
// ============================================

export const menuItems = [
  { id: 'settings', label: 'Sistem Ayarları', icon: 'Settings', category: 'SİSTEM' },
  { id: 'labels', label: 'Etiketler', icon: 'Tag', category: 'SİSTEM' },
  { id: 'performance', label: 'Performans', icon: 'Gauge', category: 'SİSTEM' },
  { id: 'master', label: 'Master Veriler', icon: 'Database', category: 'SİSTEM' },
  { id: 'monitor', label: 'Sistem Monitörü', icon: 'Activity', category: 'SİSTEM' },
  { id: 'backup', label: 'Yedekleme', icon: 'HardDrive', category: 'SİSTEM' },
  { id: 'users', label: 'Kullanıcı Yönetimi', icon: 'Users', category: 'KULLANICILAR' },
  { id: 'roles', label: 'Rol & Yetkiler', icon: 'Lock', category: 'KULLANICILAR' },
  { id: 'report-categories', label: 'Rapor Kategorileri', icon: 'FolderTree', category: 'KULLANICILAR' },
  { id: 'ldap', label: 'LDAP / SSO', icon: 'Key', category: 'KULLANICILAR' },
] as const

export const defaultSettings: SystemSetting[] = [
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
  // FİNANS
  { key: 'finance_show_roi', category: 'finance', value: 'true', label: 'ROI Göster', description: 'Finans sayfasında ROI kartını göster', type: 'boolean' },
  { key: 'finance_show_profit_margin', category: 'finance', value: 'true', label: 'Kar Marjı Göster', description: 'Finans sayfasında kar marjı kartını göster', type: 'boolean' },
  { key: 'finance_show_expense_breakdown', category: 'finance', value: 'true', label: 'Gider Dağılımı Göster', description: 'Finans sayfasında gider dağılım grafiğini göster', type: 'boolean' },
  { key: 'finance_show_amortization_warning', category: 'finance', value: 'true', label: 'Amorti Uyarısı Göster', description: 'Finans sayfasında "Amorti Edilemiyor" uyarı kartını göster', type: 'boolean' },
  { key: 'fiscal_year_start', category: 'finance', value: '01', label: 'Mali Yıl Başlangıç Ayı', description: 'Mali yılın başladığı ay (1-12)', type: 'number' },
  { key: 'budget_period', category: 'finance', value: 'monthly', label: 'Bütçe Periyodu', description: 'Bütçe takip periyodu', type: 'select', options: ['weekly', 'monthly', 'quarterly', 'yearly'] },
  { key: 'tax_rate', category: 'finance', value: '20', label: 'Vergi Oranı (%)', description: 'Varsayılan vergi oranı', type: 'number' },
  { key: 'finance_target_profit_margin', category: 'finance', value: '25', label: 'Hedef Kar Marjı (%)', description: 'Hedeflenen kar marjı yüzdesi', type: 'number' },
  { key: 'finance_target_roi', category: 'finance', value: '15', label: 'Hedef ROI (%)', description: 'Hedeflenen yatırım getirisi yüzdesi', type: 'number' },
  { key: 'finance_currency', category: 'finance', value: 'TRY', label: 'Para Birimi', description: 'Finans hesaplamalarında kullanılacak para birimi', type: 'select', options: ['TRY', 'USD', 'EUR'] },
]
