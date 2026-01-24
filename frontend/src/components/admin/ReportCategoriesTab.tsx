/**
 * Clixer - Report Categories Tab Component
 * Rapor kategorileri yönetimi (Güçler ayrılığı)
 */

import { useState, useCallback } from 'react'
import { FolderTree, Plus, Edit2, Trash2, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface ReportCategory {
  id: string
  code: string
  name: string
  description?: string
  color?: string
  icon?: string
}

interface CategoryForm {
  code: string
  name: string
  description: string
  color: string
  icon: string
}

interface ReportCategoriesTabProps {
  theme: any
  isDark: boolean
}

export function ReportCategoriesTab({ theme, isDark }: ReportCategoriesTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [reportCategories, setReportCategories] = useState<ReportCategory[]>([])
  const [reportCategoriesLoading, setReportCategoriesLoading] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ReportCategory | null>(null)
  const [categoryForm, setCategoryForm] = useState<CategoryForm>({
    code: '',
    name: '',
    description: '',
    color: '#6366f1',
    icon: 'Folder'
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

  // Load report categories
  const loadReportCategories = useCallback(async () => {
    setReportCategoriesLoading(true)
    try {
      const result = await apiCall('/core/report-categories')
      setReportCategories(result.data || [])
    } catch (err: any) {
      toast.error('Kategoriler yüklenemedi: ' + err.message)
    } finally {
      setReportCategoriesLoading(false)
    }
  }, [apiCall])

  // Save category
  const saveCategory = async () => {
    try {
      if (!categoryForm.code || !categoryForm.name) {
        toast.error('Kod ve ad zorunludur')
        return
      }
      
      const url = editingCategory 
        ? `/core/report-categories/${editingCategory.id}`
        : '/core/report-categories'
      
      await apiCall(url, {
        method: editingCategory ? 'PUT' : 'POST',
        body: JSON.stringify(categoryForm)
      })
      
      await loadReportCategories()
      setShowCategoryModal(false)
      setEditingCategory(null)
      toast.success(editingCategory ? 'Kategori güncellendi' : 'Kategori oluşturuldu')
    } catch (err: any) {
      toast.error('Kategori kaydedilemedi: ' + err.message)
    }
  }

  // Delete category
  const deleteCategory = async (id: string) => {
    if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/report-categories/${id}`, { method: 'DELETE' })
      await loadReportCategories()
      toast.success('Kategori silindi')
    } catch (err: any) {
      toast.error('Kategori silinemedi: ' + err.message)
    }
  }

  // Load on mount
  useState(() => {
    loadReportCategories()
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-violet-500/20' : 'bg-violet-100')}>
            <FolderTree size={24} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
          </div>
          <div>
            <h1 className={clsx('text-xl font-bold', theme.contentText)}>Rapor Kategorileri</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>
              Güçler ayrılığı: Raporları kategorilere ayırın, kullanıcılara farklı kategoriler atayın
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setEditingCategory(null)
            setCategoryForm({ code: '', name: '', description: '', color: '#6366f1', icon: 'Folder' })
            setShowCategoryModal(true)
          }}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}
        >
          <Plus size={16} />
          Yeni Kategori
        </button>
      </div>

      {reportCategoriesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-indigo-500" />
        </div>
      ) : reportCategories.length === 0 ? (
        <div className={clsx('rounded-2xl p-12 text-center', theme.cardBg)}>
          <FolderTree size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
          <h3 className={clsx('text-lg font-medium mb-2', theme.contentText)}>Henüz kategori yok</h3>
          <p className={clsx('text-sm mb-4', theme.contentTextMuted)}>
            Raporları gruplamak için kategoriler oluşturun. Örn: Finans, Pazarlama, Operasyon
          </p>
          <button
            onClick={() => setShowCategoryModal(true)}
            className={clsx('px-6 py-2 rounded-xl font-medium', theme.buttonPrimary)}
          >
            İlk Kategoriyi Oluştur
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reportCategories.map(cat => (
            <div key={cat.id} className={clsx('rounded-2xl p-5 transition-all border-l-4', theme.cardBg)} style={{ borderLeftColor: cat.color || '#6366f1' }}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: cat.color || '#6366f1' }}
                  >
                    {cat.name?.charAt(0)?.toUpperCase() || 'K'}
                  </div>
                  <div>
                    <h3 className={clsx('font-bold', theme.contentText)}>{cat.name}</h3>
                    <p className={clsx('text-xs font-mono', theme.contentTextMuted)}>{cat.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setEditingCategory(cat)
                      setCategoryForm({
                        code: cat.code || '',
                        name: cat.name || '',
                        description: cat.description || '',
                        color: cat.color || '#6366f1',
                        icon: cat.icon || 'Folder'
                      })
                      setShowCategoryModal(true)
                    }}
                    className={clsx('p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {cat.description && (
                <p className={clsx('text-sm mt-3', theme.contentTextMuted)}>{cat.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Kategori Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('w-full max-w-md rounded-2xl p-6', theme.cardBg)}>
            <h2 className={clsx('text-xl font-bold mb-4', theme.contentText)}>
              {editingCategory ? 'Kategori Düzenle' : 'Yeni Kategori'}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Kod *</label>
                <input
                  type="text"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                  placeholder="FINANS"
                  disabled={!!editingCategory}
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm uppercase', theme.inputBg, theme.inputText, editingCategory && 'opacity-50')}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Ad *</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="Finans Raporları"
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Açıklama</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Finans departmanı için raporlar"
                  rows={2}
                  className={clsx('w-full px-4 py-3 rounded-xl text-sm resize-none', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentTextMuted)}>Renk</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={categoryForm.color}
                    onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                    className="w-12 h-10 rounded-lg cursor-pointer"
                  />
                  <div className="flex gap-1 flex-wrap">
                    {['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setCategoryForm({ ...categoryForm, color })}
                        className={clsx('w-8 h-8 rounded-lg transition-all', categoryForm.color === color && 'ring-2 ring-offset-2 ring-indigo-500')}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCategoryModal(false)
                  setEditingCategory(null)
                }}
                className={clsx('px-6 py-2.5 rounded-xl font-medium', theme.buttonSecondary)}
              >
                İptal
              </button>
              <button
                onClick={saveCategory}
                className={clsx('px-6 py-2.5 rounded-xl font-medium text-white bg-indigo-500 hover:bg-indigo-600')}
              >
                {editingCategory ? 'Güncelle' : 'Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
