/**
 * Email Settings Section
 * SMTP configuration modal for email sending
 */

import { useState, useEffect } from 'react';
import clsx from 'clsx';
import {
  X,
  Save,
  Loader2,
  Mail,
  Server,
  Lock,
  User,
  CheckCircle,
  XCircle,
  Zap
} from 'lucide-react';
import { useSubscriptionStore } from '../../../stores/subscriptionStore';
import { useSubscriptionApi } from '../../../hooks/useSubscriptionApi';

interface EmailSettingsSectionProps {
  theme: any;
  isDark: boolean;
  onClose: () => void;
}

// Provider presets
const PROVIDER_PRESETS = [
  { 
    label: 'Gmail', 
    host: 'smtp.gmail.com', 
    port: 587, 
    secure: false,
    note: 'Google Hesabı → Güvenlik → Uygulama şifreleri oluşturun'
  },
  { 
    label: 'Office 365', 
    host: 'smtp.office365.com', 
    port: 587, 
    secure: false,
    note: 'Microsoft 365 hesabınızı kullanın'
  },
  { 
    label: 'Yandex', 
    host: 'smtp.yandex.com', 
    port: 465, 
    secure: true,
    note: 'Yandex Mail ayarlarından SMTP\'yi etkinleştirin'
  },
  { 
    label: 'Özel SMTP', 
    host: '', 
    port: 587, 
    secure: false,
    note: 'Kendi SMTP sunucunuzu yapılandırın'
  }
];

export function EmailSettingsSection({ theme, isDark, onClose }: EmailSettingsSectionProps) {
  const { emailSettings, saving, testing } = useSubscriptionStore();
  const { saveEmailSettings, testEmailSettings, deleteEmailSettings } = useSubscriptionApi();

  // Form state
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [fromEmail, setFromEmail] = useState('');
  const [fromName, setFromName] = useState('Clixer Analytics');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; duration?: number } | null>(null);

  // Load initial values
  useEffect(() => {
    if (emailSettings) {
      setSmtpHost(emailSettings.smtp_host || '');
      setSmtpPort(emailSettings.smtp_port || 587);
      setSmtpSecure(emailSettings.smtp_secure || false);
      setSmtpUser(emailSettings.smtp_user || '');
      setFromEmail(emailSettings.from_email || '');
      setFromName(emailSettings.from_name || 'Clixer Analytics');
    }
  }, [emailSettings]);

  // Handle provider selection
  const handleProviderSelect = (preset: typeof PROVIDER_PRESETS[0]) => {
    setSelectedProvider(preset.label);
    if (preset.host) {
      setSmtpHost(preset.host);
      setSmtpPort(preset.port);
      setSmtpSecure(preset.secure);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!smtpHost.trim()) {
      alert('SMTP host gerekli');
      return;
    }
    if (!smtpUser.trim()) {
      alert('SMTP kullanıcı adı gerekli');
      return;
    }
    if (!fromEmail.trim()) {
      alert('Gönderen email adresi gerekli');
      return;
    }

    // Password required for new settings
    if (!emailSettings?.is_configured && !smtpPassword.trim()) {
      alert('SMTP şifresi gerekli');
      return;
    }

    const data: any = {
      smtp_host: smtpHost.trim(),
      smtp_port: smtpPort,
      smtp_secure: smtpSecure,
      smtp_user: smtpUser.trim(),
      from_email: fromEmail.trim(),
      from_name: fromName.trim()
    };

    // Only include password if changed
    if (smtpPassword.trim()) {
      data.smtp_password = smtpPassword.trim();
    }

    const success = await saveEmailSettings(data);
    if (success) {
      setSmtpPassword(''); // Clear password field after save
    }
  };

  // Handle test
  const handleTest = async () => {
    setTestResult(null);
    const result = await testEmailSettings();
    setTestResult(result);
  };

  // Handle delete
  const handleDelete = async () => {
    if (window.confirm('Email ayarlarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      const success = await deleteEmailSettings();
      if (success) {
        onClose();
      }
    }
  };

  const isConfigured = emailSettings?.is_configured === true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={clsx(
        'w-full max-w-xl max-h-[90vh] rounded-2xl shadow-xl overflow-hidden',
        isDark ? 'bg-slate-800' : 'bg-white'
      )}>
        {/* Header */}
        <div className={clsx(
          'flex items-center justify-between px-6 py-4 border-b',
          isDark ? 'border-slate-700' : 'border-slate-200'
        )}>
          <div className="flex items-center gap-3">
            <div className={clsx('p-2 rounded-lg', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
              <Mail size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            </div>
            <div>
              <h3 className={clsx('text-lg font-semibold', theme.contentText)}>
                Email Ayarları
              </h3>
              <p className={clsx('text-xs', theme.contentTextMuted)}>
                SMTP sunucu yapılandırması
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
            )}
          >
            <X size={20} className={theme.contentTextMuted} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)] space-y-6">
          {/* Provider Selection */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
              Hızlı Ayarlar
            </label>
            <div className="grid grid-cols-4 gap-2">
              {PROVIDER_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handleProviderSelect(preset)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedProvider === preset.label
                      ? 'bg-blue-500 text-white'
                      : (isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200')
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            {selectedProvider && (
              <p className={clsx('text-xs mt-2', theme.contentTextMuted)}>
                {PROVIDER_PRESETS.find(p => p.label === selectedProvider)?.note}
              </p>
            )}
          </div>

          {/* SMTP Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                <Server size={14} className="inline mr-2" />
                SMTP Host *
              </label>
              <input
                type="text"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                placeholder="smtp.example.com"
                className={clsx(
                  'w-full px-4 py-2 rounded-xl border',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            </div>

            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                Port
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value))}
                  className={clsx(
                    'flex-1 px-4 py-2 rounded-xl border',
                    isDark
                      ? 'bg-slate-700 border-slate-600 text-white'
                      : 'bg-white border-slate-300 text-slate-900'
                  )}
                />
                <label className="flex items-center gap-2 px-3">
                  <input
                    type="checkbox"
                    checked={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-500"
                  />
                  <span className={clsx('text-sm', theme.contentText)}>SSL/TLS</span>
                </label>
              </div>
            </div>
          </div>

          {/* Auth */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                <User size={14} className="inline mr-2" />
                Kullanıcı Adı *
              </label>
              <input
                type="text"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                placeholder="user@example.com"
                className={clsx(
                  'w-full px-4 py-2 rounded-xl border',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            </div>

            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                <Lock size={14} className="inline mr-2" />
                Şifre {!isConfigured && '*'}
              </label>
              <input
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={isConfigured ? '••••••••' : 'Şifre girin'}
                className={clsx(
                  'w-full px-4 py-2 rounded-xl border',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                )}
              />
              {isConfigured && (
                <p className={clsx('text-xs mt-1', theme.contentTextMuted)}>
                  Değiştirmek istemiyorsanız boş bırakın
                </p>
              )}
            </div>
          </div>

          {/* From */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                <Mail size={14} className="inline mr-2" />
                Gönderen Email *
              </label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="noreply@example.com"
                className={clsx(
                  'w-full px-4 py-2 rounded-xl border',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            </div>

            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                Gönderen Adı
              </label>
              <input
                type="text"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Clixer Analytics"
                className={clsx(
                  'w-full px-4 py-2 rounded-xl border',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={clsx(
              'flex items-center gap-3 p-4 rounded-xl',
              testResult.success
                ? (isDark ? 'bg-green-500/20' : 'bg-green-50')
                : (isDark ? 'bg-red-500/20' : 'bg-red-50')
            )}>
              {testResult.success ? (
                <>
                  <CheckCircle className="text-green-500" size={20} />
                  <div>
                    <p className={clsx('font-medium', isDark ? 'text-green-400' : 'text-green-700')}>
                      Bağlantı Başarılı
                    </p>
                    {testResult.duration && (
                      <p className={clsx('text-sm', isDark ? 'text-green-300' : 'text-green-600')}>
                        Yanıt süresi: {testResult.duration}ms
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="text-red-500" size={20} />
                  <div>
                    <p className={clsx('font-medium', isDark ? 'text-red-400' : 'text-red-700')}>
                      Bağlantı Başarısız
                    </p>
                    <p className={clsx('text-sm', isDark ? 'text-red-300' : 'text-red-600')}>
                      Ayarları kontrol edin ve tekrar deneyin
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Status */}
          {isConfigured && emailSettings?.last_test_at && (
            <div className={clsx(
              'flex items-center gap-2 text-sm',
              theme.contentTextMuted
            )}>
              <Zap size={14} />
              Son test: {new Date(emailSettings.last_test_at).toLocaleString('tr-TR')}
              {emailSettings.last_test_result && (
                <span className={
                  emailSettings.last_test_result === 'SUCCESS' ? 'text-green-500' : 'text-red-500'
                }>
                  ({emailSettings.last_test_result === 'SUCCESS' ? 'Başarılı' : 'Başarısız'})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx(
          'flex items-center justify-between px-6 py-4 border-t',
          isDark ? 'border-slate-700' : 'border-slate-200'
        )}>
          <div>
            {isConfigured && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="text-red-500 hover:text-red-600 text-sm"
              >
                Ayarları Sil
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing || saving || !smtpHost || !smtpUser}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl',
                theme.buttonSecondary,
                (!smtpHost || !smtpUser) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {testing ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Zap size={16} />
              )}
              Bağlantıyı Test Et
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonPrimary)}
            >
              {saving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
