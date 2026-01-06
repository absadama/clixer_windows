import { useState } from 'react'
import { useTheme } from '../components/Layout'
import { 
  User,
  Mail,
  Building,
  Shield,
  Calendar,
  Edit2,
  Save,
  Bell,
  Key,
  Sun,
  Moon,
  Zap,
  Loader2,
  Lock,
  Palette
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '../stores/authStore'
import { UserRole } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:4000/api`

export default function ProfilePage() {
  const { theme, isDark } = useTheme()
  const { user, accessToken, setUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'preferences'>('profile')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: user?.name || 'Admin Kullanıcı',
    email: user?.email || 'admin@demo.com'
  })

  const [preferences, setPreferences] = useState({
    theme: 'light',
    language: 'tr',
    emailNotifications: true,
    pushNotifications: false,
    weeklyReport: true,
  })

  // Şifre değiştirme state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  // 2FA state
  const [twoFALoading, setTwoFALoading] = useState(false)
  const [twoFAQRCode, setTwoFAQRCode] = useState<string | null>(null)
  const [twoFASecret, setTwoFASecret] = useState<string | null>(null)
  const [twoFAToken, setTwoFAToken] = useState('')
  const [twoFAEnabled, setTwoFAEnabled] = useState(false)
  const [twoFAError, setTwoFAError] = useState<string | null>(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch(`${API_BASE}/core/users/${user?.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email !== user?.email ? formData.email : undefined // Sadece değiştiyse gönder
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Güncelleme başarısız')
      }
      
      const data = await response.json()
      
      // Zustand store'u güncelle
      if (user) {
        setUser({ 
          ...user, 
          name: data.data?.name || formData.name,
          email: data.data?.email || formData.email
        })
      }
      
      // Email değiştiyse uyarı göster
      if (formData.email !== user?.email) {
        setSuccess('Profil güncellendi. Yeni e-posta adresinizle giriş yapmanız gerekecek!')
      } else {
        setSuccess('Profil başarıyla güncellendi')
      }
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Şifre değiştirme
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Yeni şifreler eşleşmiyor')
      return
    }
    
    if (passwordForm.newPassword.length < 8) {
      setPasswordError('Şifre en az 8 karakter olmalıdır')
      return
    }
    
    setPasswordLoading(true)
    setPasswordError(null)
    setPasswordSuccess(null)
    
    try {
      const response = await fetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Şifre değiştirme başarısız')
      }
      
      setPasswordSuccess('Şifre başarıyla değiştirildi')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err: any) {
      setPasswordError(err.message)
    } finally {
      setPasswordLoading(false)
    }
  }

  // 2FA Aktifleştirme başlat
  const handleSetup2FA = async () => {
    setTwoFALoading(true)
    setTwoFAError(null)
    
    try {
      const response = await fetch(`${API_BASE}/auth/2fa/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || '2FA kurulumu başarısız')
      }
      
      const data = await response.json()
      setTwoFAQRCode(data.data.qrCode)
      setTwoFASecret(data.data.secret)
    } catch (err: any) {
      setTwoFAError(err.message)
    } finally {
      setTwoFALoading(false)
    }
  }

  // 2FA Doğrula ve aktifleştir
  const handleVerify2FA = async () => {
    if (!twoFAToken || twoFAToken.length !== 6) {
      setTwoFAError('6 haneli kodu girin')
      return
    }
    
    setTwoFALoading(true)
    setTwoFAError(null)
    
    try {
      const response = await fetch(`${API_BASE}/auth/2fa/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ token: twoFAToken })
      })
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Doğrulama başarısız')
      }
      
      setTwoFAEnabled(true)
      setTwoFAQRCode(null)
      setTwoFASecret(null)
      setTwoFAToken('')
    } catch (err: any) {
      setTwoFAError(err.message)
    } finally {
      setTwoFALoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profil Başlığı */}
      <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
        {/* Cover */}
        <div className={clsx('h-32 bg-gradient-to-r', theme.accent)} />
        
        {/* Avatar ve Bilgiler */}
        <div className="px-8 pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12">
            <div className={clsx(
              'w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black border-4 shadow-xl',
              isDark 
                ? 'bg-slate-900 border-slate-950 text-indigo-400' 
                : 'bg-white border-white text-indigo-600'
            )}>
              {user?.name?.charAt(0) || 'A'}
            </div>
            <div className="flex-1">
              <h1 className={clsx('text-2xl font-black', theme.contentText)}>{formData.name}</h1>
              <p className={clsx(theme.contentTextMuted)}>{formData.email}</p>
            </div>
            <span className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-bold',
              user?.role === UserRole.ADMIN 
                ? (isDark ? 'bg-violet-500/20 text-violet-400' : 'bg-violet-100 text-violet-700')
                : user?.role === UserRole.MANAGEMENT 
                  ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700')
                  : (isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-600')
            )}>
              {user?.role || 'ADMIN'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Seçici */}
      <div className={clsx('flex gap-2 p-1 rounded-2xl', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
        {[
          { id: 'profile', label: 'Profil', icon: User },
          { id: 'security', label: 'Güvenlik', icon: Lock },
          { id: 'preferences', label: 'Tercihler', icon: Palette },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={clsx(
              'flex items-center gap-2 flex-1 px-4 py-3 rounded-xl text-sm font-bold transition-all justify-center',
              activeTab === tab.id
                ? theme.buttonPrimary
                : clsx(theme.contentTextMuted, isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-200')
            )}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Profil Sekmesi */}
      {activeTab === 'profile' && (
        <div className={clsx('rounded-2xl p-8', theme.cardBg)}>
          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">{error}</div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-xl text-sm">{success}</div>
          )}
          
          <div className="flex items-center justify-between mb-6">
            <h2 className={clsx('text-lg font-bold', theme.contentText)}>Kişisel Bilgiler</h2>
            {isEditing ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary, saving && 'opacity-50')}
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} 
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonSecondary)}
              >
                <Edit2 size={16} /> Düzenle
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>Ad Soyad</label>
              <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border', theme.inputBg)}>
                <User size={18} className={clsx(theme.contentTextMuted)} />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  disabled={!isEditing}
                  className={clsx('flex-1 bg-transparent outline-none', theme.inputText, !isEditing && theme.contentTextMuted)}
                />
              </div>
            </div>

            <div>
              <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>
                E-posta {!isEditing && <span className="text-xs opacity-60">(düzenlemek için "Düzenle" butonuna basın)</span>}
              </label>
              <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border', theme.inputBg, !isEditing && 'opacity-60')}>
                <Mail size={18} className={clsx(theme.contentTextMuted)} />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  disabled={!isEditing}
                  className={clsx('flex-1 bg-transparent outline-none', theme.inputText, !isEditing && 'cursor-not-allowed')}
                />
              </div>
            </div>

            <div>
              <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>Pozisyon</label>
              <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border opacity-60', theme.inputBg)}>
                <Building size={18} className={clsx(theme.contentTextMuted)} />
                <span className={clsx(theme.contentTextMuted)}>{user?.positionCode || 'Belirtilmemiş'}</span>
              </div>
            </div>

            <div>
              <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>Sistem Rolü</label>
              <div className={clsx('flex items-center gap-3 px-4 py-3 rounded-xl border opacity-60', theme.inputBg)}>
                <Shield size={18} className={clsx(theme.contentTextMuted)} />
                <span className={clsx(theme.contentTextMuted)}>{user?.role || 'USER'}</span>
              </div>
            </div>
          </div>

          {/* Hesap Bilgileri */}
          <div className={clsx('mt-8 pt-8 border-t', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <h3 className={clsx('text-sm font-bold mb-4', theme.contentTextMuted)}>Hesap Bilgileri</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={clsx('flex items-center gap-3 p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                <Shield size={20} className={isDark ? 'text-violet-400' : 'text-violet-600'} />
                <div>
                  <p className={clsx('text-xs', theme.contentTextMuted)}>Rol</p>
                  <p className={clsx('font-bold', theme.contentText)}>{user?.role || 'ADMIN'}</p>
                </div>
              </div>
              <div className={clsx('flex items-center gap-3 p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                <Calendar size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
                <div>
                  <p className={clsx('text-xs', theme.contentTextMuted)}>Kayıt Tarihi</p>
                  <p className={clsx('font-bold', theme.contentText)}>20 Aralık 2025</p>
                </div>
              </div>
              <div className={clsx('flex items-center gap-3 p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                <Key size={20} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                <div>
                  <p className={clsx('text-xs', theme.contentTextMuted)}>Son Giriş</p>
                  <p className={clsx('font-bold', theme.contentText)}>Bugün, 10:30</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Güvenlik Sekmesi */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className={clsx('rounded-2xl p-8', theme.cardBg)}>
            <h2 className={clsx('text-lg font-bold mb-6', theme.contentText)}>Şifre Değiştir</h2>
            
            {passwordError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">{passwordError}</div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-xl text-sm">{passwordSuccess}</div>
            )}
            
            <div className="space-y-4 max-w-md">
              <div>
                <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>Mevcut Şifre</label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="••••••••"
                  className={clsx('w-full px-4 py-3 rounded-xl border focus:outline-none focus:border-indigo-500', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                />
              </div>
              <div>
                <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>Yeni Şifre</label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className={clsx('w-full px-4 py-3 rounded-xl border focus:outline-none focus:border-indigo-500', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                />
              </div>
              <div>
                <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>Yeni Şifre (Tekrar)</label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className={clsx('w-full px-4 py-3 rounded-xl border focus:outline-none focus:border-indigo-500', theme.inputBg, theme.inputText, theme.inputPlaceholder)}
                />
              </div>
              <button 
                onClick={handleChangePassword}
                disabled={passwordLoading}
                className={clsx('px-6 py-3 rounded-xl font-medium flex items-center gap-2', theme.buttonPrimary, passwordLoading && 'opacity-50')}
              >
                {passwordLoading && <Loader2 size={16} className="animate-spin" />}
                Şifreyi Güncelle
              </button>
            </div>
          </div>

          <div className={clsx('rounded-2xl p-8', theme.cardBg)}>
            <h2 className={clsx('text-lg font-bold mb-6', theme.contentText)}>İki Faktörlü Doğrulama (2FA)</h2>
            
            {twoFAError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-xl text-sm">{twoFAError}</div>
            )}
            
            {twoFAEnabled ? (
              <div className="p-4 bg-green-100 text-green-700 rounded-xl flex items-center gap-3">
                <Shield size={24} />
                <span className="font-medium">2FA aktif! Hesabınız güvende.</span>
              </div>
            ) : twoFAQRCode ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-4">
                  <p className={clsx('text-sm', theme.contentTextMuted)}>
                    Google Authenticator veya benzeri uygulamayla QR kodu tarayın:
                  </p>
                  <img src={twoFAQRCode} alt="2FA QR Code" className="w-48 h-48 border rounded-xl" />
                  {twoFASecret && (
                    <p className={clsx('text-xs', theme.contentTextMuted)}>
                      Manuel giriş: <code className="bg-slate-200 px-2 py-1 rounded">{twoFASecret}</code>
                    </p>
                  )}
                </div>
                <div className="max-w-xs mx-auto">
                  <label className={clsx('block text-xs mb-2 font-medium', theme.contentTextMuted)}>6 Haneli Kod</label>
                  <input
                    type="text"
                    value={twoFAToken}
                    onChange={(e) => setTwoFAToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className={clsx('w-full px-4 py-3 rounded-xl border text-center text-2xl tracking-widest', theme.inputBg, theme.inputText)}
                  />
                  <button
                    onClick={handleVerify2FA}
                    disabled={twoFALoading}
                    className={clsx('w-full mt-4 px-6 py-3 rounded-xl font-medium flex items-center justify-center gap-2', theme.buttonPrimary, twoFALoading && 'opacity-50')}
                  >
                    {twoFALoading && <Loader2 size={16} className="animate-spin" />}
                    Doğrula ve Aktifleştir
                  </button>
                </div>
              </div>
            ) : (
              <div className={clsx('flex items-center justify-between p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                <div className="flex items-center gap-4">
                  <div className={clsx('p-3 rounded-xl', isDark ? 'bg-amber-500/20' : 'bg-amber-100')}>
                    <Key size={24} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
                  </div>
                  <div>
                    <p className={clsx('font-bold', theme.contentText)}>Authenticator App</p>
                    <p className={clsx('text-sm', theme.contentTextMuted)}>Google Authenticator veya benzeri uygulama ile</p>
                  </div>
                </div>
                <button 
                  onClick={handleSetup2FA}
                  disabled={twoFALoading}
                  className={clsx('px-4 py-2 rounded-xl font-medium flex items-center gap-2', theme.buttonSecondary, twoFALoading && 'opacity-50')}
                >
                  {twoFALoading && <Loader2 size={16} className="animate-spin" />}
                  Etkinleştir
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tercihler Sekmesi */}
      {activeTab === 'preferences' && (
        <div className={clsx('rounded-2xl p-8 space-y-8', theme.cardBg)}>
          <div>
            <h2 className={clsx('text-lg font-bold mb-6', theme.contentText)}>Görünüm</h2>
            <div className="grid grid-cols-2 gap-4 max-w-md">
              <button
                onClick={() => setPreferences({...preferences, theme: 'light'})}
                className={clsx(
                  'p-4 rounded-xl border-2 transition-all',
                  preferences.theme === 'light'
                    ? 'border-indigo-500 bg-indigo-50'
                    : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                )}
              >
                <div className="flex gap-2 mb-2">
                  <Sun size={20} className={preferences.theme === 'light' ? 'text-indigo-600' : theme.contentTextMuted} />
                </div>
                <p className={clsx('text-sm font-bold', preferences.theme === 'light' ? 'text-indigo-600' : theme.contentText)}>Aydınlık</p>
              </button>
              <button
                onClick={() => setPreferences({...preferences, theme: 'dark'})}
                className={clsx(
                  'p-4 rounded-xl border-2 transition-all',
                  preferences.theme === 'dark'
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                )}
              >
                <div className="flex gap-2 mb-2">
                  <Moon size={20} className={preferences.theme === 'dark' ? 'text-indigo-400' : theme.contentTextMuted} />
                </div>
                <p className={clsx('text-sm font-bold', preferences.theme === 'dark' ? 'text-indigo-400' : theme.contentText)}>Karanlık</p>
              </button>
              <button
                onClick={() => setPreferences({...preferences, theme: 'corporate'})}
                className={clsx(
                  'p-4 rounded-xl border-2 transition-all',
                  preferences.theme === 'corporate'
                    ? 'border-[#00ABBD] bg-[#00ABBD]/10'
                    : (isDark ? 'border-slate-700 hover:border-slate-600' : 'border-slate-200 hover:border-slate-300')
                )}
              >
                <div className="flex gap-2 mb-2">
                  <Zap size={20} className={preferences.theme === 'corporate' ? 'text-[#026E81]' : theme.contentTextMuted} />
                </div>
                <p className={clsx('text-sm font-bold', preferences.theme === 'corporate' ? 'text-[#026E81]' : theme.contentText)}>Kurumsal</p>
              </button>
            </div>
          </div>

          <div>
            <h2 className={clsx('text-lg font-bold mb-6', theme.contentText)}>Dil</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setPreferences({...preferences, language: 'tr'})}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-bold',
                  preferences.language === 'tr'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : clsx(isDark ? 'border-slate-700' : 'border-slate-200', theme.contentTextMuted)
                )}
              >
                🇹🇷 Türkçe
              </button>
              <button
                onClick={() => setPreferences({...preferences, language: 'en'})}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all font-bold',
                  preferences.language === 'en'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-600'
                    : clsx(isDark ? 'border-slate-700' : 'border-slate-200', theme.contentTextMuted)
                )}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          <div>
            <h2 className={clsx('text-lg font-bold mb-6', theme.contentText)}>Bildirimler</h2>
            <div className="space-y-4">
              {[
                { key: 'emailNotifications', label: 'E-posta Bildirimleri', desc: 'Önemli güncellemeler için e-posta al' },
                { key: 'pushNotifications', label: 'Push Bildirimleri', desc: 'Tarayıcı bildirimleri' },
                { key: 'weeklyReport', label: 'Haftalık Rapor', desc: 'Her pazartesi özet rapor' },
              ].map(item => (
                <div key={item.key} className={clsx('flex items-center justify-between p-4 rounded-xl', isDark ? 'bg-slate-800' : 'bg-slate-50')}>
                  <div>
                    <p className={clsx('font-bold', theme.contentText)}>{item.label}</p>
                    <p className={clsx('text-sm', theme.contentTextMuted)}>{item.desc}</p>
                  </div>
                  <button
                    onClick={() => setPreferences({...preferences, [item.key]: !preferences[item.key as keyof typeof preferences]})}
                    className={clsx(
                      'w-12 h-6 rounded-full transition-all relative',
                      preferences[item.key as keyof typeof preferences] ? 'bg-indigo-500' : (isDark ? 'bg-slate-700' : 'bg-slate-300')
                    )}
                  >
                    <div className={clsx(
                      'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow',
                      preferences[item.key as keyof typeof preferences] ? 'left-6' : 'left-0.5'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
