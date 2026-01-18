import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Mail, Lock, Loader2, Zap } from 'lucide-react'

// LocalStorage'dan önbellek logo URL'si al (flash önleme)
const getCachedLogoUrl = (): string => {
  try {
    const cached = localStorage.getItem('cachedLogoUrl')
    if (cached && cached.startsWith('/uploads/')) {
      // PNG tercih et (SVG'de arka plan sorunu olabilir)
      if (cached.endsWith('.svg')) {
        return '/uploads/logo-512.png'
      }
      return cached
    }
  } catch {}
  // Hiç custom logo yoksa varsayılan Clixer logosu
  return '/logo-dark.png'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { login, isLoading, error, clearError } = useAuthStore()
  
  // Login sayfası logosu - önce localStorage'dan oku (flash önleme)
  const [logoUrl, setLogoUrl] = useState<string>(getCachedLogoUrl())
  
  useEffect(() => {
    // Sistem ayarlarından logo URL'ini al (public endpoint)
    const fetchLogoInfo = async () => {
      try {
        const response = await fetch('/api/core/logo-info')
        if (response.ok) {
          const data = await response.json()
          // LoginPage için PNG tercih et (SVG'de arka plan sorunu olabilir)
          // Önce 512 PNG kontrol et, yoksa logoUrl kullan
          let newLogoUrl = '/logo-dark.png'
          if (data.data?.files?.['logo-512.png']) {
            newLogoUrl = '/uploads/logo-512.png'
          } else if (data.data?.logoUrl) {
            newLogoUrl = data.data.logoUrl
          }
          setLogoUrl(newLogoUrl)
          // LocalStorage'a kaydet (sonraki refresh için)
          try { localStorage.setItem('cachedLogoUrl', newLogoUrl) } catch {}
        }
      } catch {
        // Hata durumunda varsayılan logo kullan
      }
    }
    fetchLogoInfo()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
    } catch {
      // Error handled in store
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: '#0F1116' }}>
      {/* Background Logo Silhouette - Sayfanın üst kısmında görünür */}
      <div className="absolute top-16 left-1/2 transform -translate-x-1/2 overflow-hidden pointer-events-none z-0">
        <img 
          src={logoUrl} 
          alt="" 
          className="w-[500px] h-auto opacity-[0.06] select-none"
        />
      </div>

      {/* Clixer Theme Background - Neon Cyan Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-15"
          style={{ background: 'radial-gradient(circle, #00CFDE 0%, transparent 70%)' }}
        />
        <div 
          className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10"
          style={{ background: 'radial-gradient(circle, #00CFDE 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-md z-10">
        {/* Login Card - Clixer Dark Theme */}
        <div 
          className="rounded-2xl overflow-hidden border relative"
          style={{ 
            backgroundColor: '#181B21',
            borderColor: '#2F3542'
          }}
        >
          {/* Header - Neon Cyan Accent */}
          <div className="h-1" style={{ background: 'linear-gradient(90deg, #00CFDE 0%, #00A5B5 100%)' }} />
          
          <div className="p-8 relative z-10">
            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase mb-2 tracking-wide" style={{ color: '#9CA3AF' }}>
                  E-Mail
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6B7280' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl font-medium transition-all duration-200 focus:outline-none"
                    style={{ 
                      backgroundColor: '#21252E',
                      border: '1px solid #2F3542',
                      color: '#E5E7EB'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#00CFDE'
                      e.target.style.boxShadow = '0 0 0 3px rgba(0, 207, 222, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#2F3542'
                      e.target.style.boxShadow = 'none'
                    }}
                    placeholder="ornek@sirket.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase mb-2 tracking-wide" style={{ color: '#9CA3AF' }}>
                  Şifre
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6B7280' }} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl font-medium transition-all duration-200 focus:outline-none"
                    style={{ 
                      backgroundColor: '#21252E',
                      border: '1px solid #2F3542',
                      color: '#E5E7EB'
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#00CFDE'
                      e.target.style.boxShadow = '0 0 0 3px rgba(0, 207, 222, 0.1)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#2F3542'
                      e.target.style.boxShadow = 'none'
                    }}
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

              {error && (
                <div 
                  className="p-3 rounded-xl text-sm flex items-center gap-2"
                  style={{ 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#F87171'
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full font-bold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg"
                style={{ 
                  background: 'linear-gradient(135deg, #00CFDE 0%, #00A5B5 100%)',
                  color: '#0F1116'
                }}
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-5 w-5" />
                    Giriş Yap
                  </>
                )}
              </button>
            </form>

            <p className="mt-8 text-center text-xs" style={{ color: '#4B5563' }}>
              © 2025 Clixer Analytics
            </p>
          </div>
        </div>

        {/* Subtle glow under card */}
        <div 
          className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-3/4 h-8 rounded-full blur-xl opacity-20"
          style={{ backgroundColor: '#00CFDE' }}
        />
      </div>
    </div>
  )
}
