import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import { Mail, Lock, Loader2, Zap, Shield, ArrowLeft, Smartphone, QrCode, Key, Copy, Check } from 'lucide-react'
import api from '../services/api'

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
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [rememberDevice, setRememberDevice] = useState(true)
  
  // 2FA Setup State
  const [setupQrCode, setSetupQrCode] = useState<string | null>(null)
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [setupBackupCodes, setSetupBackupCodes] = useState<string[]>([])
  const [setupVerifyCode, setSetupVerifyCode] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupStep, setSetupStep] = useState<'qr' | 'verify' | 'backup'>('qr')
  const [copiedCode, setCopiedCode] = useState(false)
  
  const { 
    login, 
    isLoading, 
    error, 
    clearError, 
    requiresTwoFactor, 
    twoFactorEmail,
    clearTwoFactor,
    requires2FASetup,
    setupToken,
    clear2FASetup
  } = useAuthStore()
  
  // 2FA input refs for auto-focus
  const twoFactorInputRef = useRef<HTMLInputElement>(null)
  
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
  
  // 2FA ekranına geçildiğinde input'a focus
  useEffect(() => {
    if (requiresTwoFactor && twoFactorInputRef.current) {
      twoFactorInputRef.current.focus()
    }
  }, [requiresTwoFactor])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(email, password)
    } catch {
      // Error handled in store
    }
  }
  
  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    try {
      await login(twoFactorEmail || email, password, twoFactorCode, rememberDevice)
    } catch {
      // Error handled in store
    }
  }
  
  // 2FA Setup - QR kod al
  const initiate2FASetup = async () => {
    if (!setupToken) return
    setSetupLoading(true)
    setSetupError(null)
    try {
      const response = await api.post('/auth/2fa/setup', {}, {
        headers: { Authorization: `Bearer ${setupToken}` }
      })
      setSetupQrCode(response.data.data.qrCode)
      setSetupSecret(response.data.data.secret)
      setSetupBackupCodes(response.data.data.backupCodes)
      setSetupStep('qr')
    } catch (err: any) {
      setSetupError(err.response?.data?.message || '2FA kurulumu başlatılamadı')
    } finally {
      setSetupLoading(false)
    }
  }
  
  // 2FA Setup - Kodu doğrula ve aktifleştir
  const verify2FASetup = async () => {
    if (!setupToken || !setupVerifyCode) return
    setSetupLoading(true)
    setSetupError(null)
    try {
      await api.post('/auth/2fa/verify', { code: setupVerifyCode }, {
        headers: { Authorization: `Bearer ${setupToken}` }
      })
      setSetupStep('backup')
    } catch (err: any) {
      setSetupError(err.response?.data?.message || 'Kod doğrulanamadı')
    } finally {
      setSetupLoading(false)
    }
  }
  
  // 2FA Setup tamamlandı - tekrar login
  const complete2FASetup = () => {
    clear2FASetup()
    setSetupQrCode(null)
    setSetupSecret(null)
    setSetupBackupCodes([])
    setSetupVerifyCode('')
    setSetupStep('qr')
    setPassword('')
    // Kullanıcı artık normal login yapabilir
  }
  
  // Kopyala butonu
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }
  
  // 2FA Setup başlat (requires2FASetup true olduğunda)
  useEffect(() => {
    if (requires2FASetup && setupToken && !setupQrCode) {
      initiate2FASetup()
    }
  }, [requires2FASetup, setupToken])
  
  const handleBackToLogin = () => {
    clearTwoFactor()
    setTwoFactorCode('')
    setPassword('')
  }
  
  // 2FA kodu otomatik gönder (6 hane girildiğinde)
  useEffect(() => {
    if (twoFactorCode.length === 6 && requiresTwoFactor) {
      handleTwoFactorSubmit(new Event('submit') as any)
    }
  }, [twoFactorCode])

  // 2FA Setup Ekranı (İlk kurulum)
  if (requires2FASetup) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: '#0F1116' }}>
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-15"
            style={{ background: 'radial-gradient(circle, #10B981 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative w-full max-w-lg z-10">
          <div 
            className="rounded-2xl overflow-hidden border relative"
            style={{ backgroundColor: '#181B21', borderColor: '#2F3542' }}
          >
            {/* Header */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #10B981 0%, #059669 100%)' }} />
            
            <div className="p-8">
              {/* Step: QR Code */}
              {setupStep === 'qr' && (
                <>
                  <div className="text-center mb-6">
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                    >
                      <QrCode size={32} style={{ color: '#10B981' }} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">2FA Kurulumu</h2>
                    <p className="text-sm" style={{ color: '#9CA3AF' }}>
                      Google Authenticator uygulamanızla QR kodu tarayın
                    </p>
                  </div>

                  {setupLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#10B981' }} />
                    </div>
                  ) : setupQrCode ? (
                    <div className="space-y-6">
                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="p-4 bg-white rounded-xl">
                          <img src={setupQrCode} alt="2FA QR Code" className="w-48 h-48" />
                        </div>
                      </div>
                      
                      {/* Manuel giriş için secret */}
                      <div className="p-4 rounded-xl" style={{ backgroundColor: '#21252E' }}>
                        <p className="text-xs mb-2" style={{ color: '#9CA3AF' }}>QR tarayamıyorsanız bu kodu manuel girin:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-sm font-mono p-2 rounded" style={{ backgroundColor: '#0F1116', color: '#10B981' }}>
                            {setupSecret}
                          </code>
                          <button
                            onClick={() => copyToClipboard(setupSecret || '')}
                            className="p-2 rounded-lg transition-colors hover:bg-white/10"
                          >
                            {copiedCode ? <Check size={16} className="text-green-500" /> : <Copy size={16} style={{ color: '#9CA3AF' }} />}
                          </button>
                        </div>
                      </div>
                      
                      {/* Devam butonu */}
                      <button
                        onClick={() => setSetupStep('verify')}
                        className="w-full font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                        style={{ 
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          color: '#FFFFFF'
                        }}
                      >
                        QR Kodunu Taradım, Devam Et
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-red-400">{setupError || 'Bir hata oluştu'}</p>
                      <button
                        onClick={initiate2FASetup}
                        className="mt-4 px-4 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: '#21252E', color: '#9CA3AF' }}
                      >
                        Tekrar Dene
                      </button>
                    </div>
                  )}
                </>
              )}
              
              {/* Step: Verify Code */}
              {setupStep === 'verify' && (
                <>
                  <button
                    onClick={() => setSetupStep('qr')}
                    className="flex items-center gap-2 text-sm mb-6 transition-colors hover:opacity-80"
                    style={{ color: '#9CA3AF' }}
                  >
                    <ArrowLeft size={16} />
                    QR Koda Geri Dön
                  </button>
                  
                  <div className="text-center mb-6">
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                    >
                      <Key size={32} style={{ color: '#10B981' }} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Kodu Doğrulayın</h2>
                    <p className="text-sm" style={{ color: '#9CA3AF' }}>
                      Authenticator uygulamasındaki 6 haneli kodu girin
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={setupVerifyCode}
                        onChange={(e) => setSetupVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-4 rounded-xl font-mono text-2xl text-center tracking-[0.5em] transition-all duration-200 focus:outline-none"
                        style={{ 
                          backgroundColor: '#21252E',
                          border: '1px solid #2F3542',
                          color: '#E5E7EB'
                        }}
                        onFocus={(e) => {
                          e.target.style.borderColor = '#10B981'
                          e.target.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderColor = '#2F3542'
                          e.target.style.boxShadow = 'none'
                        }}
                        placeholder="000000"
                        autoFocus
                      />
                    </div>

                    {setupError && (
                      <div 
                        className="p-3 rounded-xl text-sm"
                        style={{ 
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#F87171'
                        }}
                      >
                        {setupError}
                      </div>
                    )}

                    <button
                      onClick={verify2FASetup}
                      disabled={setupLoading || setupVerifyCode.length !== 6}
                      className="w-full font-bold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ 
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF'
                      }}
                    >
                      {setupLoading ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Shield className="h-5 w-5" />
                          Doğrula ve Aktifleştir
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
              
              {/* Step: Backup Codes */}
              {setupStep === 'backup' && (
                <>
                  <div className="text-center mb-6">
                    <div 
                      className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)' }}
                    >
                      <Check size={32} style={{ color: '#10B981' }} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">2FA Aktif!</h2>
                    <p className="text-sm" style={{ color: '#9CA3AF' }}>
                      Yedek kodlarınızı güvenli bir yere kaydedin
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div 
                      className="p-4 rounded-xl"
                      style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)' }}
                    >
                      <p className="text-xs font-medium mb-2" style={{ color: '#F59E0B' }}>
                        ⚠️ Bu kodları sadece bir kez göreceksiniz!
                      </p>
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        Telefonunuzu kaybederseniz bu kodlarla giriş yapabilirsiniz.
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 p-4 rounded-xl" style={{ backgroundColor: '#21252E' }}>
                      {setupBackupCodes.map((code, i) => (
                        <code key={i} className="text-xs font-mono p-2 rounded text-center" style={{ backgroundColor: '#0F1116', color: '#10B981' }}>
                          {code}
                        </code>
                      ))}
                    </div>
                    
                    <button
                      onClick={() => copyToClipboard(setupBackupCodes.join('\n'))}
                      className="w-full py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
                      style={{ backgroundColor: '#21252E', color: '#9CA3AF' }}
                    >
                      {copiedCode ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                      {copiedCode ? 'Kopyalandı!' : 'Tüm Kodları Kopyala'}
                    </button>

                    <button
                      onClick={complete2FASetup}
                      className="w-full font-bold py-4 rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
                      style={{ 
                        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                        color: '#FFFFFF'
                      }}
                    >
                      <Zap className="h-5 w-5" />
                      Giriş Yap
                    </button>
                  </div>
                </>
              )}
              
              {/* Back to login */}
              <div className="mt-6 text-center">
                <button
                  onClick={() => { clear2FASetup(); setPassword('') }}
                  className="text-sm transition-colors hover:opacity-80"
                  style={{ color: '#6B7280' }}
                >
                  Farklı hesapla giriş yap
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 2FA Ekranı
  if (requiresTwoFactor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 relative" style={{ backgroundColor: '#0F1116' }}>
        {/* Background Logo Silhouette */}
        <div className="absolute top-16 left-1/2 transform -translate-x-1/2 overflow-hidden pointer-events-none z-0">
          <img src={logoUrl} alt="" className="w-[500px] h-auto opacity-[0.06] select-none" />
        </div>

        {/* Clixer Theme Background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full blur-[150px] opacity-15"
            style={{ background: 'radial-gradient(circle, #00CFDE 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative w-full max-w-md z-10">
          <div 
            className="rounded-2xl overflow-hidden border relative"
            style={{ backgroundColor: '#181B21', borderColor: '#2F3542' }}
          >
            {/* Header - 2FA Accent */}
            <div className="h-1" style={{ background: 'linear-gradient(90deg, #8B5CF6 0%, #6366F1 100%)' }} />
            
            <div className="p-8 relative z-10">
              {/* Back Button */}
              <button
                onClick={handleBackToLogin}
                className="flex items-center gap-2 text-sm mb-6 transition-colors hover:opacity-80"
                style={{ color: '#9CA3AF' }}
              >
                <ArrowLeft size={16} />
                Geri Dön
              </button>
              
              {/* 2FA Icon & Title */}
              <div className="text-center mb-6">
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: 'rgba(139, 92, 246, 0.15)' }}
                >
                  <Shield size={32} style={{ color: '#8B5CF6' }} />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">İki Faktörlü Doğrulama</h2>
                <p className="text-sm" style={{ color: '#9CA3AF' }}>
                  Google Authenticator uygulamanızdaki 6 haneli kodu girin
                </p>
              </div>

              <form onSubmit={handleTwoFactorSubmit} className="space-y-5">
                {/* 2FA Code Input */}
                <div>
                  <label className="block text-xs font-semibold uppercase mb-2 tracking-wide" style={{ color: '#9CA3AF' }}>
                    Doğrulama Kodu
                  </label>
                  <div className="relative">
                    <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5" style={{ color: '#6B7280' }} />
                    <input
                      ref={twoFactorInputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={twoFactorCode}
                      onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full pl-12 pr-4 py-4 rounded-xl font-mono text-2xl text-center tracking-[0.5em] transition-all duration-200 focus:outline-none"
                      style={{ 
                        backgroundColor: '#21252E',
                        border: '1px solid #2F3542',
                        color: '#E5E7EB',
                        letterSpacing: '0.5em'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = '#8B5CF6'
                        e.target.style.boxShadow = '0 0 0 3px rgba(139, 92, 246, 0.1)'
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = '#2F3542'
                        e.target.style.boxShadow = 'none'
                      }}
                      placeholder="000000"
                      autoComplete="one-time-code"
                      required
                    />
                  </div>
                </div>
                
                {/* Remember Device Checkbox */}
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      className="sr-only"
                    />
                    <div 
                      className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                      style={{ 
                        borderColor: rememberDevice ? '#8B5CF6' : '#4B5563',
                        backgroundColor: rememberDevice ? '#8B5CF6' : 'transparent'
                      }}
                    >
                      {rememberDevice && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="text-sm" style={{ color: '#9CA3AF' }}>
                    Bu cihazda 30 gün hatırla
                  </span>
                </label>

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
                  disabled={isLoading || twoFactorCode.length !== 6}
                  className="w-full font-bold py-4 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:shadow-lg"
                  style={{ 
                    background: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)',
                    color: '#FFFFFF'
                  }}
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Doğrula
                    </>
                  )}
                </button>
              </form>

              <p className="mt-6 text-center text-xs" style={{ color: '#4B5563' }}>
                Kod her 30 saniyede bir yenilenir
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Normal Login Ekranı
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
