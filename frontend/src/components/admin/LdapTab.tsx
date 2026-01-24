/**
 * Clixer - LDAP Tab Component
 * LDAP entegrasyonu ve senkronizasyon yönetimi
 */

import { useState, useCallback, useEffect } from 'react'
import { Key, RefreshCw, Activity, Plus, Trash2, Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface LdapConfig {
  is_active: boolean
  server_url: string
  base_dn: string
  bind_dn: string
  user_filter: string
  sync_schedule: string
}

interface LdapForm {
  server_url: string
  base_dn: string
  bind_dn: string
  bind_password: string
  user_filter: string
  sync_schedule: string
  is_active: boolean
}

interface SyncLog {
  id: string
  status: 'success' | 'partial' | 'running' | 'failed'
  started_at: string
  summary: string
  users_found: number
  users_created: number
  users_updated: number
  users_deactivated: number
}

interface Position {
  code: string
  name: string
}

interface LdapTabProps {
  theme: any
  isDark: boolean
  positions: Position[]
}

export function LdapTab({ theme, isDark, positions }: LdapTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [ldapConfig, setLdapConfig] = useState<LdapConfig | null>(null)
  const [ldapForm, setLdapForm] = useState<LdapForm>({
    server_url: '',
    base_dn: '',
    bind_dn: '',
    bind_password: '',
    user_filter: '(&(objectClass=user)(mail=*))',
    sync_schedule: 'manual',
    is_active: false
  })
  const [ldapTesting, setLdapTesting] = useState(false)
  const [ldapTestResult, setLdapTestResult] = useState<{success: boolean; message: string} | null>(null)
  const [ldapGroups, setLdapGroups] = useState<any[]>([])
  const [loadingLdapGroups, setLoadingLdapGroups] = useState(false)
  const [positionMappings, setPositionMappings] = useState<any[]>([])
  const [storeMappings, setStoreMappings] = useState<any[]>([])
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([])
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [showMappingModal, setShowMappingModal] = useState<'position' | 'store' | null>(null)
  const [mappingForm, setMappingForm] = useState({
    ldap_group_dn: '',
    ldap_group_name: '',
    position_code: 'VIEWER',
    store_id: '',
    store_name: '',
    grants_all_stores: false
  })

  // API call helper
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!accessToken) throw new Error('Token yükleniyor...')
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    })
    
    if (response.status === 401) {
      logout()
      window.location.href = '/login'
      throw new Error('Oturum süresi doldu')
    }
    
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'API hatası')
    return data
  }, [accessToken, logout])

  // Load LDAP config
  const loadLdapConfig = useCallback(async () => {
    try {
      const result = await apiCall('/core/ldap/config')
      if (result.data) {
        setLdapConfig(result.data)
        setLdapForm({
          server_url: result.data.server_url || '',
          base_dn: result.data.base_dn || '',
          bind_dn: result.data.bind_dn || '',
          bind_password: '',
          user_filter: result.data.user_filter || '(&(objectClass=user)(mail=*))',
          sync_schedule: result.data.sync_schedule || 'manual',
          is_active: result.data.is_active || false
        })
      }
    } catch (err: any) {
      // Config yoksa normal
    }
  }, [apiCall])

  // Save LDAP config
  const saveLdapConfig = async () => {
    setSaving('ldap')
    try {
      await apiCall('/core/ldap/config', {
        method: 'POST',
        body: JSON.stringify(ldapForm)
      })
      toast.success('LDAP ayarları kaydedildi')
      loadLdapConfig()
    } catch (err: any) {
      toast.error('LDAP ayarları kaydedilemedi: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // Test LDAP connection
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

  // Load LDAP groups
  const loadLdapGroups = async () => {
    setLoadingLdapGroups(true)
    try {
      const result = await apiCall('/core/ldap/groups')
      setLdapGroups(result.data || [])
    } catch (err: any) {
      toast.error('LDAP grupları yüklenemedi: ' + err.message)
    } finally {
      setLoadingLdapGroups(false)
    }
  }

  // Load position mappings
  const loadPositionMappings = useCallback(async () => {
    try {
      const result = await apiCall('/core/ldap/position-mappings')
      setPositionMappings(result.data || [])
    } catch (err: any) {
      // Silent fail
    }
  }, [apiCall])

  // Load store mappings
  const loadStoreMappings = useCallback(async () => {
    try {
      const result = await apiCall('/core/ldap/store-mappings')
      setStoreMappings(result.data || [])
    } catch (err: any) {
      // Silent fail
    }
  }, [apiCall])

  // Load sync logs
  const loadSyncLogs = useCallback(async () => {
    try {
      const result = await apiCall('/core/ldap/sync-logs?limit=10')
      setSyncLogs(result.data || [])
    } catch (err: any) {
      // Silent fail
    }
  }, [apiCall])

  // Save position mapping
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
      toast.success('Pozisyon eşlemesi kaydedildi')
      setShowMappingModal(null)
      setMappingForm({ ldap_group_dn: '', ldap_group_name: '', position_code: 'VIEWER', store_id: '', store_name: '', grants_all_stores: false })
      loadPositionMappings()
    } catch (err: any) {
      toast.error('Eşleme kaydedilemedi: ' + err.message)
    }
  }

  // Save store mapping
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
      toast.success('Mağaza eşlemesi kaydedildi')
      setShowMappingModal(null)
      setMappingForm({ ldap_group_dn: '', ldap_group_name: '', position_code: 'VIEWER', store_id: '', store_name: '', grants_all_stores: false })
      loadStoreMappings()
    } catch (err: any) {
      toast.error('Eşleme kaydedilemedi: ' + err.message)
    }
  }

  // Delete mapping
  const deleteMapping = async (type: 'position' | 'store', id: string) => {
    if (!confirm('Bu eşlemeyi silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/ldap/${type}-mappings/${id}`, { method: 'DELETE' })
      toast.success('Eşleme silindi')
      if (type === 'position') loadPositionMappings()
      else loadStoreMappings()
    } catch (err: any) {
      toast.error('Eşleme silinemedi: ' + err.message)
    }
  }

  // Start LDAP sync
  const startLdapSync = async () => {
    setSyncing(true)
    try {
      await apiCall('/core/ldap/sync', { method: 'POST' })
      toast.success('Senkronizasyon başlatıldı')
      loadSyncLogs()
    } catch (err: any) {
      toast.error('Senkronizasyon başlatılamadı: ' + err.message)
    } finally {
      setSyncing(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadLdapConfig()
    loadPositionMappings()
    loadStoreMappings()
    loadSyncLogs()
  }, [loadLdapConfig, loadPositionMappings, loadStoreMappings, loadSyncLogs])

  return (
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
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div className="col-span-2">
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Base DN *</label>
                <input 
                  type="text" 
                  placeholder="DC=domain,DC=local"
                  value={ldapForm.base_dn}
                  onChange={(e) => setLdapForm({ ...ldapForm, base_dn: e.target.value })}
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div className="col-span-2">
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Bind DN *</label>
                <input 
                  type="text" 
                  placeholder="CN=ServiceAccount,OU=Users,DC=domain,DC=local"
                  value={ldapForm.bind_dn}
                  onChange={(e) => setLdapForm({ ...ldapForm, bind_dn: e.target.value })}
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
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
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kullanıcı Arama Filtresi</label>
                <input 
                  type="text" 
                  placeholder="(&(objectClass=user)(mail=*))"
                  value={ldapForm.user_filter}
                  onChange={(e) => setLdapForm({ ...ldapForm, user_filter: e.target.value })}
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm font-mono', theme.inputBg, theme.inputText)}
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
            {positionMappings.map((m: any) => (
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
            {storeMappings.map((m: any) => (
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
                    className={clsx('flex-1 px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
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
                    {ldapGroups.map((g: any) => (
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
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
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
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                        />
                      </div>
                      <div>
                        <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Mağaza Adı</label>
                        <input 
                          type="text" 
                          placeholder="212 AVM"
                          value={mappingForm.store_name}
                          onChange={(e) => setMappingForm({ ...mappingForm, store_name: e.target.value })}
                          className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
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
  )
}
