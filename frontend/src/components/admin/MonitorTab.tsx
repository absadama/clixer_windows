/**
 * Clixer - Monitor Tab Component
 * Sistem monitörü - aktif kullanıcılar ve sistem durumu
 */

import { useState, useCallback, useEffect } from 'react'
import { Activity, RefreshCw, Zap, Loader2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface Session {
  user_id: string
  name?: string
  email?: string
  position_code?: string
  ip_address?: string
  session_start?: string
  duration?: number
}

interface MonitorTabProps {
  theme: any
  isDark: boolean
}

export function MonitorTab({ theme, isDark }: MonitorTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [restartLoading, setRestartLoading] = useState(false)

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

  // Load sessions
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true)
    try {
      const result = await apiCall('/core/sessions')
      setActiveSessions(result.data || [])
    } catch (err: any) {
      toast.error('Oturumlar yüklenemedi: ' + err.message)
    } finally {
      setSessionsLoading(false)
    }
  }, [apiCall])

  // Kill session
  const killSession = async (userId: string) => {
    try {
      await apiCall(`/core/sessions/${userId}`, { method: 'DELETE' })
      toast.success('Oturum sonlandırıldı')
      loadSessions()
    } catch (err: any) {
      toast.error('Oturum sonlandırılamadı: ' + err.message)
    }
  }

  // System restart
  const handleSystemRestart = async () => {
    if (!confirm('Tüm servisleri yeniden başlatmak istediğinize emin misiniz? Bu işlem birkaç dakika sürebilir.')) return
    
    setRestartLoading(true)
    try {
      await apiCall('/core/system/restart', { method: 'POST' })
      toast.success('Sistem yeniden başlatıldı')
      // Biraz bekleyip oturumları yenile
      setTimeout(() => {
        loadSessions()
      }, 3000)
    } catch (err: any) {
      toast.error('Sistem yeniden başlatılamadı: ' + err.message)
    } finally {
      setRestartLoading(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  return (
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

      {/* Sistem Acil Müdahale (Restart) */}
      <div className={clsx('rounded-2xl p-6 border-2', isDark ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-200')}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className={clsx('p-3 rounded-xl', isDark ? 'bg-rose-500/20' : 'bg-rose-100')}>
              <Zap size={24} className="text-rose-500" />
            </div>
            <div>
              <h3 className={clsx('font-bold text-lg', theme.contentText)}>Sistem Acil Müdahale</h3>
              <p className={clsx('text-sm', theme.contentTextMuted)}>
                Eğer sistem yavaşsa veya bazı servisler çalışmıyorsa "Temiz Restart" yapın
              </p>
            </div>
          </div>
          <button
            onClick={handleSystemRestart}
            disabled={restartLoading}
            className={clsx(
              'flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg min-w-[220px]',
              restartLoading 
                ? 'bg-slate-400 cursor-not-allowed text-white' 
                : 'bg-rose-600 hover:bg-rose-700 text-white hover:scale-105 active:scale-95'
            )}
          >
            {restartLoading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Yeniden Başlatılıyor...
              </>
            ) : (
              <>
                <RefreshCw size={20} />
                Sistemi Yeniden Başlat
              </>
            )}
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className={clsx('px-2 py-1 rounded font-medium', isDark ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-100 text-rose-700')}>
            ⚠️ Bu işlem tüm arka plan servislerini (Gateway, Auth, Core, Data, Analytics) durdurup temizleyerek yeniden başlatır.
          </span>
        </div>
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
                {activeSessions.map((session) => (
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
  )
}
