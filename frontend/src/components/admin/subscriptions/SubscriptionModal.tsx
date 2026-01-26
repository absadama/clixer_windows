/**
 * Subscription Modal
 * Create/Edit subscription form
 */

import { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { X, Save, Loader2, Calendar, Users, FileText, Search } from 'lucide-react';
import { useSubscriptionStore } from '../../../stores/subscriptionStore';
import { useSubscriptionApi } from '../../../hooks/useSubscriptionApi';

interface SubscriptionModalProps {
  theme: any;
  isDark: boolean;
}

// Schedule presets
const SCHEDULE_PRESETS = [
  { label: 'Her gün 08:00', cron: '0 8 * * *', description: 'Her gün saat 08:00' },
  { label: 'Her gün 18:00', cron: '0 18 * * *', description: 'Her gün saat 18:00' },
  { label: 'Pazartesi 08:00', cron: '0 8 * * 1', description: 'Her Pazartesi 08:00' },
  { label: 'Pazartesi-Cuma 08:00', cron: '0 8 * * 1-5', description: 'Hafta içi her gün 08:00' },
  { label: 'Ayın 1\'i 08:00', cron: '0 8 1 * *', description: 'Her ayın 1\'i 08:00' },
  { label: 'Özel', cron: '', description: '' }
];

export function SubscriptionModal({ theme, isDark }: SubscriptionModalProps) {
  const { editingSubscription, designs, users, saving, closeSubscriptionModal } = useSubscriptionStore();
  const { createSubscription, updateSubscription } = useSubscriptionApi();

  const isEditing = !!editingSubscription;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [designId, setDesignId] = useState('');
  const [designType, setDesignType] = useState<'cockpit' | 'analysis'>('cockpit');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [schedulePreset, setSchedulePreset] = useState('');
  const [scheduleCron, setScheduleCron] = useState('0 8 * * 1');
  const [scheduleDescription, setScheduleDescription] = useState('Her Pazartesi 08:00');
  const [userSearch, setUserSearch] = useState('');

  // Filter users by search term
  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const search = userSearch.toLowerCase().trim();
    return users.filter(user => 
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search)
    );
  }, [users, userSearch]);

  // Load initial values if editing
  useEffect(() => {
    if (editingSubscription) {
      setName(editingSubscription.name);
      setDescription(editingSubscription.description || '');
      setDesignId(editingSubscription.design_id || '');
      setDesignType(editingSubscription.design_type);
      setSelectedUserIds(editingSubscription.recipient_user_ids || []);
      setScheduleCron(editingSubscription.schedule_cron);
      setScheduleDescription(editingSubscription.schedule_description || '');
      
      // Find matching preset
      const preset = SCHEDULE_PRESETS.find(p => p.cron === editingSubscription.schedule_cron);
      setSchedulePreset(preset?.cron || '');
    }
  }, [editingSubscription]);

  // Handle preset change
  const handlePresetChange = (presetCron: string) => {
    setSchedulePreset(presetCron);
    if (presetCron) {
      const preset = SCHEDULE_PRESETS.find(p => p.cron === presetCron);
      if (preset) {
        setScheduleCron(preset.cron);
        setScheduleDescription(preset.description);
      }
    }
  };

  // Toggle user selection
  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim()) {
      alert('Abonelik adı gerekli');
      return;
    }

    if (selectedUserIds.length === 0) {
      alert('En az bir alıcı seçilmeli');
      return;
    }

    if (!scheduleCron.trim()) {
      alert('Zamanlama gerekli');
      return;
    }

    const data = {
      name: name.trim(),
      description: description.trim() || null,
      design_id: designId || null,
      design_type: designType,
      recipient_user_ids: selectedUserIds,
      schedule_cron: scheduleCron.trim(),
      schedule_description: scheduleDescription.trim() || null
    };

    let success: boolean;
    if (isEditing && editingSubscription) {
      const result = await updateSubscription(editingSubscription.id, data);
      success = !!result;
    } else {
      const result = await createSubscription(data);
      success = !!result;
    }

    if (success) {
      closeSubscriptionModal();
    }
  };

  // Filter designs by type
  const filteredDesigns = designs.filter(d => d.type === designType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className={clsx(
        'w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-xl overflow-hidden',
        isDark ? 'bg-slate-800' : 'bg-white'
      )}>
        {/* Header */}
        <div className={clsx(
          'flex items-center justify-between px-6 py-4 border-b',
          isDark ? 'border-slate-700' : 'border-slate-200'
        )}>
          <h3 className={clsx('text-lg font-semibold', theme.contentText)}>
            {isEditing ? 'Abonelik Düzenle' : 'Yeni Abonelik Oluştur'}
          </h3>
          <button
            onClick={closeSubscriptionModal}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100'
            )}
          >
            <X size={20} className={theme.contentTextMuted} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
          {/* Name & Description */}
          <div className="space-y-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                <FileText size={14} className="inline mr-2" />
                Abonelik Adı *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Örn: Haftalık Satış Raporu"
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
                Açıklama
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="İsteğe bağlı açıklama..."
                rows={2}
                className={clsx(
                  'w-full px-4 py-2 rounded-xl border resize-none',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white'
                    : 'bg-white border-slate-300 text-slate-900'
                )}
              />
            </div>
          </div>

          {/* Report Selection */}
          <div className="space-y-4">
            <label className={clsx('block text-sm font-medium', theme.contentText)}>
              Rapor Seçimi
            </label>

            {/* Design Type */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="designType"
                  checked={designType === 'cockpit'}
                  onChange={() => { setDesignType('cockpit'); setDesignId(''); }}
                  className="w-4 h-4 text-blue-500"
                />
                <span className={theme.contentText}>Kokpit</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="designType"
                  checked={designType === 'analysis'}
                  onChange={() => { setDesignType('analysis'); setDesignId(''); }}
                  className="w-4 h-4 text-blue-500"
                />
                <span className={theme.contentText}>Detaylı Analiz</span>
              </label>
            </div>

            {/* Design Dropdown */}
            <select
              value={designId}
              onChange={(e) => setDesignId(e.target.value)}
              className={clsx(
                'w-full px-4 py-2 rounded-xl border',
                isDark
                  ? 'bg-slate-700 border-slate-600 text-white'
                  : 'bg-white border-slate-300 text-slate-900'
              )}
            >
              <option value="">Rapor seçin...</option>
              {filteredDesigns.map(design => (
                <option key={design.id} value={design.id}>
                  {design.name}
                </option>
              ))}
            </select>
          </div>

          {/* Recipients */}
          <div className="space-y-4">
            <label className={clsx('block text-sm font-medium', theme.contentText)}>
              <Users size={14} className="inline mr-2" />
              Alıcılar * ({selectedUserIds.length} seçili)
            </label>

            {/* User Search */}
            <div className="relative">
              <Search size={16} className={clsx(
                'absolute left-3 top-1/2 -translate-y-1/2',
                theme.contentTextMuted
              )} />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Kullanıcı ara (isim veya email)..."
                className={clsx(
                  'w-full pl-10 pr-4 py-2 rounded-xl border',
                  isDark
                    ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400'
                    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                )}
              />
              {userSearch && (
                <button
                  onClick={() => setUserSearch('')}
                  className={clsx(
                    'absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-500/20',
                    theme.contentTextMuted
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className={clsx(
              'max-h-48 overflow-y-auto rounded-xl border p-2',
              isDark ? 'bg-slate-700/50 border-slate-600' : 'bg-slate-50 border-slate-200'
            )}>
              {filteredUsers.length === 0 ? (
                <p className={clsx('text-sm text-center py-4', theme.contentTextMuted)}>
                  {userSearch ? 'Aramayla eşleşen kullanıcı bulunamadı' : 'Kullanıcı bulunamadı'}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className={clsx(
                        'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                        selectedUserIds.includes(user.id)
                          ? (isDark ? 'bg-blue-500/20' : 'bg-blue-50')
                          : (isDark ? 'hover:bg-slate-600' : 'hover:bg-slate-100')
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(user.id)}
                        onChange={() => toggleUser(user.id)}
                        className="w-4 h-4 rounded text-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={clsx('font-medium truncate', theme.contentText)}>
                          {user.name}
                        </div>
                        <div className={clsx('text-xs truncate', theme.contentTextMuted)}>
                          {user.email}
                        </div>
                      </div>
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded',
                        isDark ? 'bg-slate-600' : 'bg-slate-200'
                      )}>
                        {user.role}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Schedule */}
          <div className="space-y-4">
            <label className={clsx('block text-sm font-medium', theme.contentText)}>
              <Calendar size={14} className="inline mr-2" />
              Zamanlama *
            </label>

            {/* Presets */}
            <div className="grid grid-cols-3 gap-2">
              {SCHEDULE_PRESETS.map(preset => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetChange(preset.cron)}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    schedulePreset === preset.cron || (preset.cron === '' && schedulePreset === '')
                      ? 'bg-blue-500 text-white'
                      : (isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200')
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Cron */}
            {schedulePreset === '' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={clsx('block text-xs mb-1', theme.contentTextMuted)}>
                    Cron İfadesi
                  </label>
                  <input
                    type="text"
                    value={scheduleCron}
                    onChange={(e) => setScheduleCron(e.target.value)}
                    placeholder="0 8 * * 1"
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg border font-mono text-sm',
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    )}
                  />
                </div>
                <div>
                  <label className={clsx('block text-xs mb-1', theme.contentTextMuted)}>
                    Açıklama
                  </label>
                  <input
                    type="text"
                    value={scheduleDescription}
                    onChange={(e) => setScheduleDescription(e.target.value)}
                    placeholder="Her Pazartesi 08:00"
                    className={clsx(
                      'w-full px-3 py-2 rounded-lg border text-sm',
                      isDark
                        ? 'bg-slate-700 border-slate-600 text-white'
                        : 'bg-white border-slate-300 text-slate-900'
                    )}
                  />
                </div>
              </div>
            )}

            <p className={clsx('text-xs', theme.contentTextMuted)}>
              Cron formatı: dakika saat gün ay haftanın_günü (Timezone: Europe/Istanbul)
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className={clsx(
          'flex items-center justify-end gap-3 px-6 py-4 border-t',
          isDark ? 'border-slate-700' : 'border-slate-200'
        )}>
          <button
            onClick={closeSubscriptionModal}
            disabled={saving}
            className={clsx('px-4 py-2 rounded-xl', theme.buttonSecondary)}
          >
            İptal
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
            {isEditing ? 'Güncelle' : 'Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
}
