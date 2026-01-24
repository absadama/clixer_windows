/**
 * Clixer - Labels Tab Component
 * Dinamik etiketler yönetimi (menü, pozisyon, veri etiketleri)
 */

import { useState, useCallback } from 'react'
import { Tag, RefreshCw, Save, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Default labels
const defaultMenuLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  analysis: 'Analiz',
  designer: 'Tasarımcı',
  metrics: 'Metrikler',
  data: 'Veri Yönetimi',
  admin: 'Yönetim',
  stores: 'Mağazalar',
  regions: 'Bölgeler',
  groups: 'Gruplar',
  users: 'Kullanıcılar',
  settings: 'Ayarlar'
}

const defaultPositionLabels: Record<string, string> = {
  ADMIN: 'Sistem Yöneticisi',
  GENEL_MUDUR: 'Genel Müdür',
  BOLGE_MUDURU: 'Bölge Müdürü',
  MAGAZA_MUDURU: 'Mağaza Müdürü',
  SATIS_TEMSILCISI: 'Satış Temsilcisi',
  ANALIST: 'Analist',
  IZLEYICI: 'İzleyici'
}

const defaultDataLabels: Record<string, string> = {
  store: 'Mağaza',
  store_plural: 'Mağazalar',
  region: 'Bölge',
  region_plural: 'Bölgeler',
  group: 'Grup',
  group_plural: 'Gruplar'
}

interface LabelsTabProps {
  theme: any
  isDark: boolean
}

export function LabelsTab({ theme, isDark }: LabelsTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [labels, setLabels] = useState<any[]>([])
  const [labelsLoading, setLabelsLoading] = useState(false)
  const [labelsSaving, setLabelsSaving] = useState(false)
  const [labelsTab, setLabelsTab] = useState<'menu' | 'position' | 'data'>('menu')
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({})

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

  // Load labels
  const loadLabels = useCallback(async () => {
    setLabelsLoading(true)
    try {
      const result = await apiCall('/core/labels')
      setLabels(result.data || [])
      
      // Mevcut değerleri editedLabels'a yükle
      const edited: Record<string, string> = {}
      ;(result.data || []).forEach((label: any) => {
        edited[`${label.label_type}:${label.label_key}`] = label.label_value
      })
      setEditedLabels(edited)
    } catch (err: any) {
      toast.error('Etiketler yüklenemedi: ' + err.message)
    } finally {
      setLabelsLoading(false)
    }
  }, [apiCall])

  // Save labels
  const saveLabels = async () => {
    setLabelsSaving(true)
    try {
      const labelsToSave = Object.entries(editedLabels).map(([key, value]) => {
        const [type, labelKey] = key.split(':')
        return { label_type: type, label_key: labelKey, label_value: value }
      })
      await apiCall('/core/labels/batch', {
        method: 'POST',
        body: JSON.stringify({ labels: labelsToSave })
      })
      toast.success('Etiketler kaydedildi')
      await loadLabels()
    } catch (err: any) {
      toast.error('Etiketler kaydedilemedi: ' + err.message)
    } finally {
      setLabelsSaving(false)
    }
  }

  // Update label
  const updateLabel = (type: string, key: string, value: string) => {
    setEditedLabels(prev => ({
      ...prev,
      [`${type}:${key}`]: value
    }))
  }

  // Get label value
  const getLabelValue = (type: string, key: string) => {
    const defaultValue = type === 'menu' 
      ? defaultMenuLabels[key] 
      : type === 'position' 
        ? defaultPositionLabels[key] 
        : defaultDataLabels[key]
    return editedLabels[`${type}:${key}`] || defaultValue || key
  }

  return (
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
        <button
          onClick={() => setLabelsTab('data')}
          className={clsx(
            'px-4 py-2 rounded-xl font-medium transition-all',
            labelsTab === 'data' 
              ? theme.buttonPrimary 
              : clsx(theme.contentTextMuted, 'hover:' + theme.contentText)
          )}
        >
          Veri Etiketleri
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

          {labelsTab === 'data' && (
            <div className="space-y-4">
              <p className={clsx('text-sm mb-4', theme.contentTextMuted)}>
                Mağaza, Bölge ve Grup terimlerini şirketinize uygun şekilde değiştirin.
                Örneğin bir üniversite için "Mağaza" yerine "Fakülte", "Bölge" yerine "Kampüs" yazabilirsiniz.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(defaultDataLabels).map(([key, defaultValue]) => {
                  const labelMap: Record<string, string> = {
                    store: 'Tekil (örn: Mağaza)',
                    store_plural: 'Çoğul (örn: Mağazalar)',
                    region: 'Tekil (örn: Bölge)',
                    region_plural: 'Çoğul (örn: Bölgeler)',
                    group: 'Tekil (örn: Grup)',
                    group_plural: 'Çoğul (örn: Gruplar)'
                  }
                  const categoryMap: Record<string, string> = {
                    store: 'MAĞAZA',
                    store_plural: 'MAĞAZA',
                    region: 'BÖLGE',
                    region_plural: 'BÖLGE',
                    group: 'GRUP',
                    group_plural: 'GRUP'
                  }
                  return (
                    <div key={key} className={clsx('p-4 rounded-xl border', theme.cardBg, isDark ? 'border-gray-700' : 'border-gray-200')}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={clsx('text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded', 
                          key.startsWith('store') ? 'bg-emerald-500/20 text-emerald-500' :
                          key.startsWith('region') ? 'bg-blue-500/20 text-blue-500' :
                          'bg-purple-500/20 text-purple-500'
                        )}>
                          {categoryMap[key]}
                        </span>
                        <span className={clsx('text-xs', theme.contentTextMuted)}>{labelMap[key]}</span>
                      </div>
                      <input
                        type="text"
                        value={getLabelValue('data', key)}
                        onChange={(e) => updateLabel('data', key, e.target.value)}
                        placeholder={defaultValue}
                        className={clsx(
                          'w-full px-3 py-2 rounded-lg border focus:outline-none focus:ring-2 focus:ring-purple-500',
                          theme.inputBg, theme.inputText,
                          isDark ? 'border-gray-600' : 'border-gray-300'
                        )}
                      />
                      <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>Varsayılan: {defaultValue}</p>
                    </div>
                  )
                })}
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
  )
}
