/**
 * Clixer - Users Tab Component
 * Kullanıcı yönetimi, mağaza atama, kategori yetkilendirme
 */

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Users, Plus, Edit2, Trash2, Search, Loader2, Check, FolderTree, KeyRound } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface UsersTabProps {
  theme: any
  isDark: boolean
  positions: any[]
  availableStores: {
    store_id: string
    store_name: string
    store_type?: string
    region_id?: string
    region_name?: string
  }[]
  regions: { id: string; name: string }[]
  getPositionLabel: (code: string, name?: string) => string
}

export function UsersTab({ theme, isDark, positions, availableStores, regions, getPositionLabel }: UsersTabProps) {
  const { accessToken, logout } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  
  // Local state
  const [users, setUsers] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userForm, setUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'USER',
    position_code: 'VIEWER',
    stores: [] as { store_id: string; store_name: string }[],
    filter_value: '',
    categories: [] as string[],
    canSeeAllCategories: true,
    phone_number: '',
    phone_active: true
  })
  const [saving, setSaving] = useState<string | null>(null)
  
  // Store filters
  const [storeFilterRegion, setStoreFilterRegion] = useState<string>('')
  const [storeFilterType, setStoreFilterType] = useState<string>('')
  const [storeSearchTerm, setStoreSearchTerm] = useState<string>('')
  
  // Report categories
  const [reportCategories, setReportCategories] = useState<any[]>([])

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

  // Filtered stores based on filters
  const filteredAvailableStores = availableStores.filter(store => {
    if (storeFilterRegion && store.region_id !== storeFilterRegion) return false
    if (storeFilterType && store.store_type !== storeFilterType) return false
    return true
  })

  // Load users
  const loadUsers = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/users')
      setUsers(result.data || [])
    } catch (err) {
      console.error('Kullanıcılar yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Load report categories
  const loadReportCategories = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/core/report-categories')
      setReportCategories(result.data || [])
    } catch (err) {
      console.error('Rapor kategorileri yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Save user
  const saveUser = async () => {
    setSaving('user')
    let userId: string | null = editingUser?.id || null
    let isNewUser = !editingUser
    let userCreated = false
    
    try {
      if (editingUser) {
        // Update
        await apiCall(`/core/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: userForm.name,
            role: userForm.role,
            position_code: userForm.position_code,
            stores: userForm.stores,
            filter_value: userForm.filter_value || null,
            phone_number: userForm.phone_number || null,
            phone_active: userForm.phone_active
          })
        })
      } else {
        // Create new
        const result = await apiCall('/core/users', {
          method: 'POST',
          body: JSON.stringify({
            ...userForm,
            role: userForm.role
          })
        })
        userId = result.data?.id
        userCreated = true
      }
      
      // Save user categories
      if (userId) {
        try {
          await apiCall(`/core/users/${userId}/categories`, {
            method: 'PUT',
            body: JSON.stringify({
              categoryIds: userForm.categories,
              canSeeAllCategories: userForm.canSeeAllCategories
            })
          })
        } catch (catErr: any) {
          console.error('Kategori ataması başarısız:', catErr)
          
          // Rollback: Delete user if category assignment failed for new user
          if (isNewUser && userCreated && userId) {
            try {
              await apiCall(`/core/users/${userId}`, { method: 'DELETE' })
              console.warn('Rollback: Yeni kullanıcı silindi çünkü kategori ataması başarısız')
            } catch (rollbackErr) {
              console.error('Rollback başarısız:', rollbackErr)
            }
            throw new Error(`Kullanıcı oluşturuldu ama kategori ataması başarısız oldu: ${catErr.message}. Kullanıcı geri alındı.`)
          }
          
          // For existing user, just warn
          if (!isNewUser) {
            toast(`Kullanıcı güncellendi ancak kategori ataması başarısız: ${catErr.message}`, { icon: '⚠️', duration: 6000 })
          }
        }
      }
      
      setShowUserModal(false)
      setEditingUser(null)
      setUserForm({ email: '', name: '', password: '', role: 'USER', position_code: 'VIEWER', stores: [], filter_value: '', categories: [], canSeeAllCategories: false, phone_number: '', phone_active: true })
      loadUsers()
      toast.success(editingUser ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu')
    } catch (err: any) {
      toast.error('Hata: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  // Delete user
  const deleteUser = async (userId: string) => {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/users/${userId}`, { method: 'DELETE' })
      loadUsers()
      toast.success('Kullanıcı silindi')
    } catch (err: any) {
      toast.error('Hata: ' + err.message)
    }
  }

  // Reset 2FA for user
  const reset2FA = async (userId: string, userName: string) => {
    if (!confirm(`${userName} için 2FA'yı sıfırlamak istediğinize emin misiniz?\n\nKullanıcı bir sonraki girişte 2FA kurulumunu tekrar yapacak.`)) return
    try {
      await apiCall(`/core/users/${userId}/reset-2fa`, { method: 'POST' })
      toast.success('2FA sıfırlandı')
    } catch (err: any) {
      toast.error('Hata: ' + err.message)
    }
  }

  // Edit user
  const editUser = async (user: any) => {
    try {
      // Get user details from API (including stores)
      const result = await apiCall(`/core/users/${user.id}`)
      const userDetail = result.data || user
      
      // Get user categories
      let userCategories: string[] = []
      let canSeeAll = false
      try {
        const catResult = await apiCall(`/core/users/${user.id}/categories`)
        userCategories = (catResult.data?.categories || []).map((c: any) => c.id)
        canSeeAll = catResult.data?.canSeeAllCategories ?? false
      } catch {
        // Default values if categories fail to load
      }
      
      setEditingUser(userDetail)
      setUserForm({
        email: userDetail.email,
        name: userDetail.name,
        password: '',
        role: userDetail.role || 'USER',
        filter_value: userDetail.filter_value || '',
        position_code: userDetail.position_code || 'VIEWER',
        stores: (userDetail.stores || []).map((s: any) => ({ store_id: s.store_id, store_name: s.store_name })),
        categories: userCategories,
        canSeeAllCategories: canSeeAll,
        phone_number: userDetail.phone_number || '',
        phone_active: userDetail.phone_active !== false // null veya undefined ise true
      })
      setStoreSearchTerm('')
      setShowUserModal(true)
    } catch (err) {
      console.error('Kullanıcı detayı yüklenemedi:', err)
      // Fallback
      setEditingUser(user)
      setUserForm({
        email: user.email,
        name: user.name,
        password: '',
        role: user.role || 'USER',
        position_code: user.position_code || 'VIEWER',
        stores: [],
        filter_value: '',
        categories: [],
        canSeeAllCategories: false,
        phone_number: user.phone_number || '',
        phone_active: user.phone_active !== false
      })
      setStoreSearchTerm('')
      setShowUserModal(true)
    }
  }

  // Handle URL edit parameter IMMEDIATELY (from search) - don't wait for users list
  useEffect(() => {
    const editUserId = searchParams.get('edit')
    if (editUserId && !showUserModal && accessToken) {
      // Directly fetch and open this user - no waiting for list
      const openUserDirectly = async () => {
        try {
          // Fetch user details directly by ID
          const result = await apiCall(`/core/users/${editUserId}`)
          const userDetail = result.data
          
          if (userDetail) {
            // Get user categories
            let userCategories: string[] = []
            let canSeeAll = false
            try {
              const catResult = await apiCall(`/core/users/${editUserId}/categories`)
              userCategories = (catResult.data?.categories || []).map((c: any) => c.id)
              canSeeAll = catResult.data?.canSeeAllCategories ?? false
            } catch {
              // Default values if categories fail to load
            }
            
            setEditingUser(userDetail)
            setUserForm({
              email: userDetail.email,
              name: userDetail.name,
              password: '',
              role: userDetail.role || 'USER',
              filter_value: userDetail.filter_value || '',
              position_code: userDetail.position_code || 'VIEWER',
              stores: (userDetail.stores || []).map((s: any) => ({ store_id: s.store_id, store_name: s.store_name })),
              categories: userCategories,
              canSeeAllCategories: canSeeAll,
              phone_number: userDetail.phone_number || '',
              phone_active: userDetail.phone_active !== false
            })
            setStoreSearchTerm('')
            setShowUserModal(true)
          }
        } catch (err) {
          console.error('Kullanıcı yüklenemedi:', err)
        }
        
        // Clear the edit param from URL
        searchParams.delete('edit')
        setSearchParams(searchParams, { replace: true })
      }
      
      openUserDirectly()
    }
  }, [searchParams, accessToken]) // Only depend on searchParams and accessToken

  // Load on mount (parallel with edit check)
  useEffect(() => {
    loadUsers()
    loadReportCategories()
  }, [loadUsers, loadReportCategories])

  return (
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
          onClick={() => { setEditingUser(null); setUserForm({ email: '', name: '', password: '', role: 'USER', position_code: 'VIEWER', stores: [], filter_value: '', categories: [], canSeeAllCategories: true, phone_number: '', phone_active: true }); setStoreSearchTerm(''); setShowUserModal(true) }}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
        >
          <Plus size={16} /> Kullanıcı Ekle
        </button>
      </div>

      {/* Search */}
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

      {/* User List */}
      <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
        <table className="w-full">
          <thead className={clsx(isDark ? 'bg-slate-800' : 'bg-slate-100')}>
            <tr className={clsx('text-xs font-bold uppercase', theme.contentTextMuted)}>
              <th className="px-6 py-4 text-left">Kullanıcı</th>
              <th className="px-6 py-4 text-left">Pozisyon</th>
              <th className="px-6 py-4 text-left">Mağaza</th>
              <th className="px-6 py-4 text-left">📱 Telefon</th>
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
                  {user.phone_number ? (
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'px-2 py-1 rounded-lg text-xs font-medium',
                        user.phone_active !== false 
                          ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                          : (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                      )}>
                        {user.phone_active !== false ? '✅' : '🚫'} {user.phone_number}
                      </span>
                    </div>
                  ) : (
                    <span className={clsx('text-xs', theme.contentTextMuted)}>—</span>
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
                      title="Düzenle"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => reset2FA(user.id, user.name)}
                      className={clsx('p-2 rounded-lg transition-colors', 'hover:bg-amber-500/20 text-amber-500')}
                      title="2FA Sıfırla"
                    >
                      <KeyRound size={16} />
                    </button>
                    <button 
                      onClick={() => deleteUser(user.id)}
                      className={clsx('p-2 rounded-lg transition-colors', 'hover:bg-rose-500/20 text-rose-500')}
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <p className={theme.contentTextMuted}>Henüz kullanıcı yok</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* User Add/Edit Modal */}
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
              
              {/* Telefon Güvenlik Katmanı */}
              <div className="col-span-2">
                <div className={clsx('p-4 rounded-xl border', isDark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-300 bg-amber-50')}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg">📱</span>
                    <span className={clsx('text-sm font-semibold', isDark ? 'text-amber-400' : 'text-amber-700')}>
                      Telefon Güvenlik Katmanı
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Telefon Numarası</label>
                      <input
                        type="tel"
                        value={userForm.phone_number}
                        onChange={(e) => setUserForm({ ...userForm, phone_number: e.target.value })}
                        placeholder="+90 5XX XXX XX XX"
                        className={clsx('w-full px-4 py-2.5 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={userForm.phone_active}
                          onChange={(e) => setUserForm({ ...userForm, phone_active: e.target.checked })}
                          className="w-5 h-5 rounded"
                        />
                        <span className={clsx('text-sm font-medium', userForm.phone_active ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-red-400' : 'text-red-600'))}>
                          {userForm.phone_active ? '✅ Telefon Aktif' : '🚫 Telefon Pasif (Giriş Engellenecek)'}
                        </span>
                      </label>
                    </div>
                  </div>
                  <p className={clsx('mt-2 text-xs', theme.contentTextMuted)}>
                    💡 Telefon numarası girilip pasife alınırsa kullanıcı giriş yapamaz
                  </p>
                </div>
              </div>
              
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

            {/* RLS Filter Value */}
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
                
                {positions.find(p => p.code === userForm.position_code)?.filter_level === 'store' ? (
                  <div className="space-y-2">
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
                        .slice(0, 100)
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
                    </div>
                  </div>
                ) : positions.find(p => p.code === userForm.position_code)?.filter_level === 'region' ? (
                  <select
                    value={userForm.filter_value}
                    onChange={(e) => setUserForm({ ...userForm, filter_value: e.target.value })}
                    className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                  >
                    <option value="">-- Bölge Seç --</option>
                    {regions.map((region) => (
                      <option key={region.id} value={region.id}>{region.name}</option>
                    ))}
                  </select>
                ) : positions.find(p => p.code === userForm.position_code)?.filter_level === 'group' ? (
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
                </p>
              </div>
            )}

            {/* Store Assignment */}
            <div className="mt-6">
              <label className={clsx('block text-sm font-medium mb-2', theme.contentTextMuted)}>
                Atanacak Mağazalar
                {positions.find(p => p.code === userForm.position_code)?.can_see_all_stores && (
                  <span className="ml-2 text-xs text-emerald-500">(Bu pozisyon tüm mağazaları görür)</span>
                )}
              </label>
              
              <div className="flex flex-wrap items-center gap-2 mb-3">
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
              
              <div className={clsx('text-xs mb-2 px-2', theme.contentTextMuted)}>
                {userForm.stores.length} mağaza seçili 
                {storeFilterRegion && ` (${regions.find(r => r.id === storeFilterRegion)?.name} bölgesi gösteriliyor)`}
                {storeFilterType && ` (${storeFilterType} gösteriliyor)`}
              </div>
              
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

            {/* Report Categories */}
            {reportCategories.length > 0 && (
              <div className={clsx('mt-4 p-4 rounded-xl border', 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700')}>
                <div className="flex items-center justify-between mb-3">
                  <label className={clsx('text-sm font-medium flex items-center gap-2', theme.contentText)}>
                    <FolderTree size={16} className="text-violet-500" />
                    Rapor Kategorileri
                    <span className={clsx('text-xs font-normal', theme.contentTextMuted)}>(Güçler Ayrılığı)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userForm.canSeeAllCategories}
                      onChange={(e) => setUserForm({ ...userForm, canSeeAllCategories: e.target.checked, categories: e.target.checked ? [] : userForm.categories })}
                      className="w-4 h-4 rounded"
                    />
                    <span className={clsx('text-xs font-medium', isDark ? 'text-violet-400' : 'text-violet-600')}>Tüm Kategoriler</span>
                  </label>
                </div>
                
                {!userForm.canSeeAllCategories && (
                  <div className="grid grid-cols-2 gap-2">
                    {reportCategories.map(cat => (
                      <label 
                        key={cat.id}
                        className={clsx(
                          'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors border',
                          userForm.categories.includes(cat.id)
                            ? 'bg-violet-500/10 border-violet-500'
                            : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={userForm.categories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setUserForm({ ...userForm, categories: [...userForm.categories, cat.id] })
                            } else {
                              setUserForm({ ...userForm, categories: userForm.categories.filter(c => c !== cat.id) })
                            }
                          }}
                          className="w-4 h-4 rounded"
                        />
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: cat.color || '#6366f1' }}
                        />
                        <span className={clsx('text-sm', theme.contentText)}>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                )}
                
                {userForm.canSeeAllCategories && (
                  <p className={clsx('text-xs', theme.contentTextMuted)}>
                    Bu kullanıcı tüm rapor kategorilerini görebilir.
                  </p>
                )}
              </div>
            )}

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
  )
}
