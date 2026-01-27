/**
 * Clixer - Roles Tab Component
 * Rol ve yetki yönetimi
 */

import { useState, useCallback } from 'react'
import { Lock, Edit2, Check, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface Position {
  code: string
  name: string
  description: string
  can_see_all_stores: boolean
  hierarchy_level: number
}

interface RolePermission {
  menu_key: string
  can_view: boolean
  can_edit: boolean
}

interface RolesTabProps {
  theme: any
  isDark: boolean
  positions: Position[]
  getPositionLabel: (positionCode: string, defaultName: string) => string
}

export function RolesTab({ theme, isDark, positions, getPositionLabel }: RolesTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [editingRole, setEditingRole] = useState<Position | null>(null)
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([])
  const [saving, setSaving] = useState<string | null>(null)

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

  // Load role permissions
  const loadRolePermissions = async (code: string) => {
    try {
      const result = await apiCall(`/core/positions/${code}/permissions`)
      setRolePermissions(result.data || [])
    } catch (err: any) {
      toast.error('Rol izinleri yüklenemedi: ' + err.message)
    }
  }

  // Save role permissions
  const saveRolePermissions = async () => {
    if (!editingRole) return
    setSaving('role')
    try {
      await apiCall(`/core/positions/${editingRole.code}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissions: rolePermissions })
      })
      toast.success('Rol izinleri güncellendi')
      setEditingRole(null)
    } catch (err: any) {
      toast.error('Rol izinleri kaydedilemedi: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

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
    // education: Eğitim Merkezi - Sadece ADMIN rolü görebilir, pozisyon izni gerekmez
  }

  return (
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
  )
}
