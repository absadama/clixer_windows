import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'
import clsx from 'clsx'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * PWA Install Prompt
 * Kullanıcıya uygulamayı ana ekrana eklemesi için teşvik gösterir
 */
export const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // iOS kontrolü (Safari'de beforeinstallprompt yok)
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream
    setIsIOS(isIOSDevice)

    // Zaten yüklü mü kontrolü
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInWebAppiOS = (window.navigator as any).standalone === true
    setIsInstalled(isStandalone || isInWebAppiOS)

    // Daha önce reddedildi mi kontrolü
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    const dismissedTime = dismissed ? parseInt(dismissed) : 0
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const shouldShow = !dismissed || (Date.now() - dismissedTime > oneWeek)

    // Android/Chrome için beforeinstallprompt event
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      if (shouldShow && !isStandalone) {
        setTimeout(() => setShowPrompt(true), 3000) // 3 saniye sonra göster
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // iOS için manuel gösterim (3 saniye sonra)
    if (isIOSDevice && !isInWebAppiOS && shouldShow) {
      setTimeout(() => setShowPrompt(true), 3000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setShowPrompt(false)
        setDeferredPrompt(null)
      }
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('pwa-install-dismissed', Date.now().toString())
  }

  // Zaten yüklüyse veya gösterilmeyecekse
  if (isInstalled || !showPrompt) return null

  return (
    <div 
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[9998]
                 bg-gradient-to-br from-[#181B21] to-[#0F1116] 
                 border border-[#2F3542] rounded-2xl shadow-2xl
                 p-4 animate-slide-up"
      style={{ 
        boxShadow: '0 20px 60px rgba(0, 207, 222, 0.15), 0 8px 20px rgba(0, 0, 0, 0.4)'
      }}
    >
      {/* Kapat butonu */}
      <button 
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4 text-gray-400" />
      </button>

      <div className="flex items-start gap-4">
        {/* İkon */}
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#00CFDE] to-[#00A5B5] 
                        flex items-center justify-center flex-shrink-0 shadow-lg"
             style={{ boxShadow: '0 4px 20px rgba(0, 207, 222, 0.3)' }}>
          <Smartphone className="w-7 h-7 text-white" />
        </div>

        {/* İçerik */}
        <div className="flex-1 pr-4">
          <h3 className="text-white font-semibold text-base mb-1">
            Clixer'ı Yükle
          </h3>
          <p className="text-gray-400 text-sm mb-3 leading-relaxed">
            {isIOS 
              ? "Safari'de paylaş butonuna tıklayıp 'Ana Ekrana Ekle' seçin"
              : "Ana ekranınıza ekleyerek hızlı erişim sağlayın"
            }
          </p>

          {/* Butonlar */}
          {isIOS ? (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-white/5 rounded">1. Paylaş</span>
              <span>→</span>
              <span className="px-2 py-1 bg-white/5 rounded">2. Ana Ekrana Ekle</span>
            </div>
          ) : (
            <button
              onClick={handleInstall}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm",
                "bg-gradient-to-r from-[#00CFDE] to-[#00A5B5] text-white",
                "hover:from-[#00B5C4] hover:to-[#0095A5] transition-all",
                "shadow-lg hover:shadow-xl"
              )}
              style={{ boxShadow: '0 4px 15px rgba(0, 207, 222, 0.25)' }}
            >
              <Download className="w-4 h-4" />
              Şimdi Yükle
            </button>
          )}
        </div>
      </div>

      {/* Dekoratif çizgi */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#00CFDE] to-transparent rounded-t-2xl" />
    </div>
  )
}

export default PWAInstallPrompt

