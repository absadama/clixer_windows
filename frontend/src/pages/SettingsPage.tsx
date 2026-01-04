import { Settings as SettingsIcon, User, Building2, Shield, Bell } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'

export default function SettingsPage() {
  const { user } = useAuthStore()

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center">
          <SettingsIcon className="h-6 w-6 text-zinc-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Ayarlar</h1>
          <p className="text-sm text-zinc-500">Hesap ve uygulama ayarları</p>
        </div>
      </div>

      {/* Settings sections */}
      <div className="space-y-6">
        {/* Profile */}
        <div className="bg-white rounded-2xl p-6 border border-zinc-100">
          <div className="flex items-center gap-4 mb-6">
            <User className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-bold text-zinc-900">Profil</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ad Soyad</label>
              <input
                type="text"
                defaultValue={user?.name}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">E-posta</label>
              <input
                type="email"
                defaultValue={user?.email}
                className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl"
                disabled
              />
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-2xl p-6 border border-zinc-100">
          <div className="flex items-center gap-4 mb-6">
            <Shield className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-bold text-zinc-900">Güvenlik</h2>
          </div>
          <button className="px-4 py-2 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800">
            Şifre Değiştir
          </button>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-2xl p-6 border border-zinc-100">
          <div className="flex items-center gap-4 mb-6">
            <Bell className="h-5 w-5 text-zinc-400" />
            <h2 className="text-lg font-bold text-zinc-900">Bildirimler</h2>
          </div>
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
              <span className="text-sm text-zinc-700">E-posta bildirimleri</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" defaultChecked className="w-5 h-5 rounded" />
              <span className="text-sm text-zinc-700">ETL tamamlandı bildirimleri</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
