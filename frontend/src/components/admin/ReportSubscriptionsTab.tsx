/**
 * Report Subscriptions Tab
 * Admin Panel tab for managing scheduled report email subscriptions
 * 
 * Features:
 * - Subscription list with status, schedule, recipients
 * - Email settings configuration
 * - Create/Edit/Delete subscriptions
 * - Manual trigger support
 */

import { useEffect, useCallback } from 'react';
import clsx from 'clsx';
import {
  Mail,
  Calendar,
  Users,
  Play,
  Pause,
  Trash2,
  Edit,
  Send,
  Settings,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2
} from 'lucide-react';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useSubscriptionApi } from '../../hooks/useSubscriptionApi';
import { SubscriptionModal, EmailSettingsSection } from './subscriptions';

interface ReportSubscriptionsTabProps {
  theme: any;
  isDark: boolean;
}

export function ReportSubscriptionsTab({ theme, isDark }: ReportSubscriptionsTabProps) {
  const {
    subscriptions,
    emailSettings,
    loading,
    saving,
    showSubscriptionModal,
    showEmailSettingsModal,
    openCreateModal,
    openEditModal,
    openEmailSettingsModal,
    closeEmailSettingsModal
  } = useSubscriptionStore();

  const {
    loadAllData,
    toggleSubscription,
    deleteSubscription,
    sendNow
  } = useSubscriptionApi();

  // Load data on mount
  useEffect(() => {
    loadAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Format date
  const formatDate = useCallback((dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  // Handle delete with confirmation
  const handleDelete = useCallback(async (id: string, name: string) => {
    if (window.confirm(`"${name}" aboneliğini silmek istediğinize emin misiniz?`)) {
      await deleteSubscription(id);
    }
  }, [deleteSubscription]);

  // Check if email is configured
  const isEmailConfigured = emailSettings?.is_configured === true;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-blue-500/20' : 'bg-blue-100')}>
            <Mail size={24} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
          </div>
          <div>
            <h2 className={clsx('text-xl font-semibold', theme.contentText)}>
              Rapor Abonelikleri
            </h2>
            <p className={clsx('text-sm', theme.contentTextMuted)}>
              Zamanlanmış rapor email gönderimleri
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadAllData}
            disabled={loading}
            className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl', theme.buttonSecondary)}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Yenile
          </button>

          <button
            onClick={openEmailSettingsModal}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              isEmailConfigured ? theme.buttonSecondary : 'bg-orange-500 text-white hover:bg-orange-600'
            )}
          >
            <Settings size={16} />
            Email Ayarları
            {!isEmailConfigured && (
              <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">Gerekli</span>
            )}
          </button>

          <button
            onClick={openCreateModal}
            disabled={!isEmailConfigured}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl',
              isEmailConfigured ? theme.buttonPrimary : 'bg-gray-400 cursor-not-allowed text-white'
            )}
            title={!isEmailConfigured ? 'Önce email ayarlarını yapılandırın' : undefined}
          >
            <Plus size={16} />
            Yeni Abonelik
          </button>
        </div>
      </div>

      {/* Email not configured warning */}
      {!isEmailConfigured && (
        <div className={clsx(
          'flex items-center gap-3 p-4 rounded-xl',
          isDark ? 'bg-orange-500/20 border border-orange-500/30' : 'bg-orange-50 border border-orange-200'
        )}>
          <AlertCircle className="text-orange-500" size={20} />
          <div>
            <p className={clsx('font-medium', isDark ? 'text-orange-400' : 'text-orange-700')}>
              Email Ayarları Gerekli
            </p>
            <p className={clsx('text-sm', isDark ? 'text-orange-300' : 'text-orange-600')}>
              Rapor abonelikleri oluşturabilmek için önce SMTP email ayarlarını yapılandırmalısınız.
            </p>
          </div>
        </div>
      )}

      {/* Subscriptions List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-blue-500" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className={clsx(
          'text-center py-12 rounded-xl',
          isDark ? 'bg-slate-800/50' : 'bg-slate-50'
        )}>
          <Mail size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
          <p className={clsx('text-lg font-medium', theme.contentText)}>
            Henüz abonelik yok
          </p>
          <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>
            Raporlarınızı belirli kullanıcılara zamanlanmış olarak göndermek için abonelik oluşturun.
          </p>
        </div>
      ) : (
        <div className={clsx('rounded-xl overflow-hidden', isDark ? 'bg-slate-800/50' : 'bg-white border border-slate-200')}>
          <table className="w-full">
            <thead>
              <tr className={clsx('border-b', isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50')}>
                <th className={clsx('text-left px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  Abonelik
                </th>
                <th className={clsx('text-left px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  Rapor
                </th>
                <th className={clsx('text-left px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  Alıcılar
                </th>
                <th className={clsx('text-left px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  Zamanlama
                </th>
                <th className={clsx('text-left px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  Son Gönderim
                </th>
                <th className={clsx('text-left px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  Durum
                </th>
                <th className={clsx('text-right px-4 py-3 text-sm font-medium', theme.contentTextMuted)}>
                  İşlemler
                </th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr
                  key={sub.id}
                  className={clsx(
                    'border-b last:border-0 transition-colors',
                    isDark ? 'border-slate-700 hover:bg-slate-700/50' : 'border-slate-100 hover:bg-slate-50'
                  )}
                >
                  {/* Name */}
                  <td className="px-4 py-3">
                    <div className={clsx('font-medium', theme.contentText)}>{sub.name}</div>
                    {sub.description && (
                      <div className={clsx('text-xs mt-0.5', theme.contentTextMuted)}>
                        {sub.description}
                      </div>
                    )}
                  </td>

                  {/* Design */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        sub.design_type === 'cockpit'
                          ? (isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700')
                          : (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700')
                      )}>
                        {sub.design_type === 'cockpit' ? 'Kokpit' : 'Analiz'}
                      </span>
                      <span className={clsx('text-sm', theme.contentText)}>
                        {sub.design_name || '-'}
                      </span>
                    </div>
                  </td>

                  {/* Recipients */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Users size={14} className={theme.contentTextMuted} />
                      <span className={clsx('text-sm', theme.contentText)}>
                        {sub.recipients?.length || sub.recipient_user_ids?.length || 0} kişi
                      </span>
                    </div>
                  </td>

                  {/* Schedule */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={14} className={theme.contentTextMuted} />
                      <span className={clsx('text-sm', theme.contentText)}>
                        {sub.schedule_description || sub.schedule_cron}
                      </span>
                    </div>
                  </td>

                  {/* Last Sent */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className={theme.contentTextMuted} />
                      <span className={clsx('text-sm', theme.contentText)}>
                        {formatDate(sub.last_sent_at)}
                      </span>
                    </div>
                    {sub.last_error && (
                      <div className="flex items-center gap-1 mt-1">
                        <XCircle size={12} className="text-red-500" />
                        <span className="text-xs text-red-500 truncate max-w-[150px]" title={sub.last_error}>
                          {sub.last_error}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    {sub.is_active ? (
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-700'
                      )}>
                        <CheckCircle size={12} />
                        Aktif
                      </span>
                    ) : (
                      <span className={clsx(
                        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                        isDark ? 'bg-slate-500/20 text-slate-400' : 'bg-slate-100 text-slate-600'
                      )}>
                        <Pause size={12} />
                        Durduruldu
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {/* Send Now */}
                      <button
                        onClick={() => sendNow(sub.id)}
                        disabled={saving || !sub.is_active}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          sub.is_active
                            ? (isDark ? 'hover:bg-slate-600 text-blue-400' : 'hover:bg-slate-100 text-blue-600')
                            : 'opacity-50 cursor-not-allowed'
                        )}
                        title="Şimdi Gönder"
                      >
                        <Send size={16} />
                      </button>

                      {/* Toggle */}
                      <button
                        onClick={() => toggleSubscription(sub.id)}
                        disabled={saving}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-100',
                          sub.is_active ? 'text-orange-500' : 'text-green-500'
                        )}
                        title={sub.is_active ? 'Durdur' : 'Aktifleştir'}
                      >
                        {sub.is_active ? <Pause size={16} /> : <Play size={16} />}
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => openEditModal(sub)}
                        disabled={saving}
                        className={clsx(
                          'p-2 rounded-lg transition-colors',
                          isDark ? 'hover:bg-slate-600 text-slate-300' : 'hover:bg-slate-100 text-slate-600'
                        )}
                        title="Düzenle"
                      >
                        <Edit size={16} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDelete(sub.id, sub.name)}
                        disabled={saving}
                        className={clsx(
                          'p-2 rounded-lg transition-colors text-red-500',
                          isDark ? 'hover:bg-red-500/20' : 'hover:bg-red-50'
                        )}
                        title="Sil"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Stats */}
      {subscriptions.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
            <div className={clsx('text-2xl font-bold', theme.contentText)}>
              {subscriptions.length}
            </div>
            <div className={clsx('text-sm', theme.contentTextMuted)}>Toplam Abonelik</div>
          </div>
          <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
            <div className={clsx('text-2xl font-bold text-green-500')}>
              {subscriptions.filter(s => s.is_active).length}
            </div>
            <div className={clsx('text-sm', theme.contentTextMuted)}>Aktif</div>
          </div>
          <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
            <div className={clsx('text-2xl font-bold', theme.contentText)}>
              {subscriptions.reduce((sum, s) => sum + (s.send_count || 0), 0)}
            </div>
            <div className={clsx('text-sm', theme.contentTextMuted)}>Toplam Gönderim</div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showSubscriptionModal && (
        <SubscriptionModal theme={theme} isDark={isDark} />
      )}

      {showEmailSettingsModal && (
        <EmailSettingsSection
          theme={theme}
          isDark={isDark}
          onClose={closeEmailSettingsModal}
        />
      )}
    </div>
  );
}
