/**
 * Clixer - Performance Tab Component
 * Cache, bellek ve performans optimizasyonları
 */

import { useState, useCallback, useEffect } from 'react'
import { Gauge, RefreshCw, HardDrive, Clock, Zap, Eraser, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface PerformanceTabProps {
  theme: any
  isDark: boolean
}

export function PerformanceTab({ theme, isDark }: PerformanceTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [perfSettings, setPerfSettings] = useState<any>({})
  const [perfLoading, setPerfLoading] = useState(false)
  const [cacheClearLoading, setCacheClearLoading] = useState(false)
  const [redisInfo, setRedisInfo] = useState<any>(null)

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

  // Load performance settings
  const loadPerfSettings = useCallback(async () => {
    setPerfLoading(true)
    try {
      const result = await apiCall('/core/settings?category=performance')
      // Parse settings
      const parsed: any = {}
      ;(result.data || []).forEach((s: any) => {
        try {
          parsed[s.key] = JSON.parse(s.value)
        } catch {
          parsed[s.key] = s.value
        }
      })
      setPerfSettings(parsed)
      
      // Redis info
      if (parsed.redis_info) {
        setRedisInfo(parsed.redis_info)
      }
    } catch (err: any) {
      toast.error('Performans ayarları yüklenemedi: ' + err.message)
    } finally {
      setPerfLoading(false)
    }
  }, [apiCall])

  // Save performance setting
  const savePerfSetting = async (key: string, value: any) => {
    try {
      // Mevcut değeri al ve güncelle
      const currentValue = perfSettings[key] || {}
      const newValue = { ...currentValue, ...value }
      
      // Önce state'i güncelle (optimistic update)
      setPerfSettings((prev: any) => ({ ...prev, [key]: newValue }))
      
      await apiCall(`/core/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({
          value: JSON.stringify(newValue),
          category: 'performance'
        })
      })
      toast.success('Ayar kaydedildi')
      loadPerfSettings()
    } catch (err: any) {
      toast.error('Ayar kaydedilemedi: ' + err.message)
    }
  }

  // Clear cache
  const clearCache = async (type: 'all' | 'dashboard' | 'metrics') => {
    setCacheClearLoading(true)
    try {
      // Analytics service DELETE /cache endpoint'i kullanıyor
      const pattern = type === 'all' ? '*' : type === 'dashboard' ? 'dashboard:*' : 'metric:*'
      await apiCall(`/analytics/cache?pattern=${encodeURIComponent(pattern)}`, { method: 'DELETE' })
      toast.success(`${type === 'all' ? 'Tüm' : type} cache temizlendi`)
      loadPerfSettings() // Redis info güncelle
    } catch (err: any) {
      toast.error('Cache temizlenemedi: ' + err.message)
    } finally {
      setCacheClearLoading(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadPerfSettings()
  }, [loadPerfSettings])

  return (
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
                  className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
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
                  className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value="allkeys-lru">LRU - Son kullanılmayanı sil (Önerilen)</option>
                  <option value="allkeys-lfu">LFU - En az erişileni sil</option>
                  <option value="volatile-lru">Süresi dolanlardan LRU</option>
                  <option value="volatile-ttl">Süresi en yakın olanı sil</option>
                </select>
              </div>
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
              </p>
            </div>

            {/* Dashboard TTL */}
            <div className="py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={clsx('font-medium', theme.contentText)}>Dashboard Cache</p>
                  <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>Tüm dashboard verisi</p>
                </div>
                <select
                  value={perfSettings.cache_dashboard_ttl?.value || 900}
                  onChange={(e) => savePerfSetting('cache_dashboard_ttl', { value: Number(e.target.value) })}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value={60}>1 dk</option>
                  <option value={300}>5 dk</option>
                  <option value={900}>15 dk (Önerilen)</option>
                  <option value={1800}>30 dk</option>
                  <option value={3600}>1 saat</option>
                </select>
              </div>
            </div>

            {/* KPI TTL */}
            <div className="py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className={clsx('font-medium', theme.contentText)}>KPI Kartları</p>
                  <p className={clsx('text-xs mt-0.5', isDark ? 'text-gray-400' : 'text-gray-600')}>Tek değer gösteren kartlar</p>
                </div>
                <select
                  value={perfSettings.cache_kpi_ttl?.value || 300}
                  onChange={(e) => savePerfSetting('cache_kpi_ttl', { value: Number(e.target.value) })}
                  className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value={60}>1 dk</option>
                  <option value={300}>5 dk (Önerilen)</option>
                  <option value={600}>10 dk</option>
                  <option value={900}>15 dk</option>
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
                  className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value={300}>5 dk</option>
                  <option value={900}>15 dk (Önerilen)</option>
                  <option value={1800}>30 dk</option>
                  <option value={3600}>1 saat</option>
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
                  className={clsx('px-3 py-1.5 rounded-lg text-sm border', theme.inputBg, theme.inputText)}
                >
                  <option value={900}>15 dk</option>
                  <option value={1800}>30 dk (Önerilen)</option>
                  <option value={3600}>1 saat</option>
                  <option value={7200}>2 saat</option>
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
  )
}
