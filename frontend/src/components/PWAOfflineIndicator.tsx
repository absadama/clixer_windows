import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * PWA Offline Indicator
 * İnternet bağlantısı kesildiğinde kullanıcıya uyarı gösterir
 * Sabit pozisyonda, her zaman görünür
 */
export const PWAOfflineIndicator = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [showToast, setShowToast] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      // Bağlantı geldiğinde kısa süre yeşil toast göster
      setShowToast(true)
      setTimeout(() => setShowToast(false), 3000)
    }
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Bağlantı geri geldi toast'u
  if (showToast && !isOffline) {
    return (
      <div 
        className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] 
                   bg-emerald-500 text-white px-4 py-3 rounded-xl shadow-2xl
                   flex items-center gap-3 animate-bounce"
        style={{ 
          boxShadow: '0 10px 40px rgba(16, 185, 129, 0.4)',
          minWidth: '200px'
        }}
      >
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
          ✓
        </div>
        <span className="font-medium">Bağlantı Kuruldu</span>
      </div>
    )
  }

  if (!isOffline) return null

  return (
    <div 
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[9999] 
                 bg-rose-500 text-white px-4 py-3 rounded-xl shadow-2xl
                 flex items-center gap-3 animate-pulse"
      style={{ 
        boxShadow: '0 10px 40px rgba(239, 68, 68, 0.4)',
        minWidth: '200px'
      }}
    >
      <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
        <WifiOff className="w-4 h-4" />
      </div>
      <div className="flex flex-col">
        <span className="font-semibold text-sm">Çevrimdışı Mod</span>
        <span className="text-xs text-white/80">İnternet bağlantısı yok</span>
      </div>
    </div>
  )
}

export default PWAOfflineIndicator

