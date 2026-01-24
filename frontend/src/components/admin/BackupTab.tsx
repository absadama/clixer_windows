/**
 * Clixer - Backup Tab Component
 * Veritabanı yedekleme ve geri yükleme
 */

import { useState, useCallback, useEffect } from 'react'
import { HardDrive, RefreshCw, Plus, Download, Loader2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface Backup {
  name?: string
  filename?: string
  date?: string
  size?: string
}

interface BackupTabProps {
  theme: any
  isDark: boolean
}

export function BackupTab({ theme, isDark }: BackupTabProps) {
  const { accessToken, logout } = useAuthStore()
  
  // Local state
  const [backups, setBackups] = useState<Backup[]>([])
  const [backupsLoading, setBackupsLoading] = useState(false)
  const [backupCreating, setBackupCreating] = useState(false)

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

  // Load backups
  const loadBackups = useCallback(async () => {
    setBackupsLoading(true)
    try {
      const result = await apiCall('/data/admin/backup/list')
      setBackups(result.data || [])
    } catch (err: any) {
      toast.error('Yedekler yüklenemedi: ' + err.message)
    } finally {
      setBackupsLoading(false)
    }
  }, [apiCall])

  // Create backup
  const createBackup = async () => {
    setBackupCreating(true)
    try {
      await apiCall('/data/admin/backup/create', { method: 'POST' })
      toast.success('Yedek oluşturuldu')
      loadBackups()
    } catch (err: any) {
      toast.error('Yedek oluşturulamadı: ' + err.message)
    } finally {
      setBackupCreating(false)
    }
  }

  // Load on mount
  useEffect(() => {
    loadBackups()
  }, [loadBackups])

  return (
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
            {backups.map((backup, i) => (
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
  )
}
