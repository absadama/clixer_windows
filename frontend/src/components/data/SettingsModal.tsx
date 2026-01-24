/**
 * Clixer - Settings Modal Component
 * DataPage'den çıkarıldı - Dataset ayarları
 */

import { 
  Settings,
  X,
  Trash2,
  AlertCircle,
  Info
} from 'lucide-react'
import clsx from 'clsx'

interface SettingsModalProps {
  theme: any
  isDark: boolean
  isOpen: boolean
  dataset: any
  // Form state
  newDatasetName: string
  newDatasetSyncStrategy: string
  newDatasetSyncSchedule: string
  newDatasetRowLimit: number | null
  newDatasetReferenceColumn: string
  scheduledHour: number
  customWhere: string
  deleteDays: number
  partitionColumn: string
  partitionType: 'monthly' | 'daily'
  refreshWindowDays: number
  engineType: 'MergeTree' | 'ReplacingMergeTree'
  detectModified: boolean
  modifiedColumn: string
  weeklyFullRefresh: boolean
  uniqueColumn: string
  autoDetectedUnique: string
  rlsStoreColumn: string
  rlsRegionColumn: string
  rlsGroupColumn: string
  settingsColumns: string[]
  sqlResult: any
  // Setters
  setNewDatasetName: (v: string) => void
  setNewDatasetSyncStrategy: (v: string) => void
  setNewDatasetSyncSchedule: (v: string) => void
  setNewDatasetRowLimit: (v: number | null) => void
  setNewDatasetReferenceColumn: (v: string) => void
  setScheduledHour: (v: number) => void
  setCustomWhere: (v: string) => void
  setDeleteDays: (v: number) => void
  setPartitionColumn: (v: string) => void
  setPartitionType: (v: 'monthly' | 'daily') => void
  setRefreshWindowDays: (v: number) => void
  setEngineType: (v: 'MergeTree' | 'ReplacingMergeTree') => void
  setDetectModified: (v: boolean) => void
  setModifiedColumn: (v: string) => void
  setWeeklyFullRefresh: (v: boolean) => void
  setUniqueColumn: (v: string) => void
  setRlsStoreColumn: (v: string) => void
  setRlsRegionColumn: (v: string) => void
  setRlsGroupColumn: (v: string) => void
  // Callbacks
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  translateErrorMessage: (msg: string) => string
}

export function SettingsModal({
  theme,
  isDark,
  isOpen,
  dataset,
  newDatasetName,
  newDatasetSyncStrategy,
  newDatasetSyncSchedule,
  newDatasetRowLimit,
  newDatasetReferenceColumn,
  scheduledHour,
  customWhere,
  deleteDays,
  partitionColumn,
  partitionType,
  refreshWindowDays,
  engineType,
  detectModified,
  modifiedColumn,
  weeklyFullRefresh,
  uniqueColumn,
  autoDetectedUnique,
  rlsStoreColumn,
  rlsRegionColumn,
  rlsGroupColumn,
  settingsColumns,
  sqlResult,
  setNewDatasetName,
  setNewDatasetSyncStrategy,
  setNewDatasetSyncSchedule,
  setNewDatasetRowLimit,
  setNewDatasetReferenceColumn,
  setScheduledHour,
  setCustomWhere,
  setDeleteDays,
  setPartitionColumn,
  setPartitionType,
  setRefreshWindowDays,
  setEngineType,
  setDetectModified,
  setModifiedColumn,
  setWeeklyFullRefresh,
  setUniqueColumn,
  setRlsStoreColumn,
  setRlsRegionColumn,
  setRlsGroupColumn,
  onClose,
  onSave,
  onDelete,
  translateErrorMessage
}: SettingsModalProps) {
  if (!isOpen || !dataset) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={clsx('rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col', theme.cardBg)}>
        <div className={clsx('p-4 border-b flex items-center justify-between flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-slate-500 to-slate-700 rounded-lg flex items-center justify-center">
              <Settings className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className={clsx('font-bold', theme.contentText)}>Dataset Ayarları</h3>
              <p className={clsx('text-xs', theme.contentTextMuted)}>{dataset.clickhouse_table}</p>
            </div>
          </div>
          <button onClick={onClose} className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-4 space-y-3 overflow-y-auto flex-1">
          <div>
            <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Dataset Adı</label>
            <input
              type="text"
              value={newDatasetName}
              onChange={(e) => setNewDatasetName(e.target.value)}
              className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Stratejisi</label>
              <select 
                value={newDatasetSyncStrategy}
                onChange={(e) => setNewDatasetSyncStrategy(e.target.value)}
                className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
              >
                <option value="full_refresh">Full Refresh (Her şeyi sil-yaz)</option>
                <option value="timestamp">Timestamp-Based (Değişenleri çek)</option>
                <option value="id">ID-Based (Yeni kayıtları çek)</option>
                <option value="date_delete_insert">📅 Tarih Bazlı Sil-Yaz (Son X gün)</option>
                <option value="date_partition">🗓️ Date Partition (Sliding Window)</option>
              </select>
            </div>
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Sync Sıklığı</label>
              <select 
                value={newDatasetSyncSchedule}
                onChange={(e) => setNewDatasetSyncSchedule(e.target.value)}
                className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
              >
                <option value="manual">Manuel</option>
                <option value="1m">⚡ 1 dk (Test)</option>
                <option value="5m">Her 5 Dakika</option>
                <option value="15m">Her 15 Dakika</option>
                <option value="30m">Her 30 Dakika</option>
                <option value="1h">Saatlik</option>
                <option value="daily">Günlük</option>
              </select>
            </div>
          </div>

          {/* Günlük seçildiğinde saat seçici */}
          {newDatasetSyncSchedule === 'daily' && (
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                🕐 Çalışma Saati
              </label>
              <select
                value={scheduledHour}
                onChange={(e) => setScheduledHour(parseInt(e.target.value))}
                className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00 {i >= 0 && i < 6 ? '🌙' : i >= 6 && i < 12 ? '🌅' : i >= 12 && i < 18 ? '☀️' : '🌆'}
                  </option>
                ))}
              </select>
              <p className={clsx('mt-1 text-xs', theme.contentTextMuted)}>
                Günlük senkronizasyon her gün bu saatte çalışır
              </p>
            </div>
          )}

          {/* Satır Limiti */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
              Satır Limiti
              <span className={clsx('ml-2 font-normal text-xs', theme.contentTextMuted)}>(Boş = Sınırsız)</span>
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={newDatasetRowLimit ?? ''}
                onChange={(e) => setNewDatasetRowLimit(e.target.value ? parseInt(e.target.value) : null)}
                placeholder="Örn: 50000000"
                className={clsx('flex-1 px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setNewDatasetRowLimit(10000000)}
                  className={clsx('px-2 py-1.5 rounded text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                >
                  10M
                </button>
                <button
                  type="button"
                  onClick={() => setNewDatasetRowLimit(50000000)}
                  className={clsx('px-2 py-1.5 rounded text-xs font-medium', isDark ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-700')}
                >
                  50M
                </button>
                <button
                  type="button"
                  onClick={() => setNewDatasetRowLimit(null)}
                  className={clsx('px-2 py-1.5 rounded text-xs font-medium', isDark ? 'bg-teal-700 hover:bg-teal-600 text-white' : 'bg-teal-200 hover:bg-teal-300 text-teal-700')}
                >
                  ∞
                </button>
              </div>
            </div>
            <p className={clsx('mt-1 text-xs', theme.contentTextMuted)}>
              Mevcut: <strong>{dataset.row_limit ? `${(dataset.row_limit / 1000000).toFixed(0)}M` : '∞ Sınırsız'}</strong>
            </p>
          </div>

          {/* Referans Kolon */}
          {(newDatasetSyncStrategy === 'timestamp' || newDatasetSyncStrategy === 'id' || newDatasetSyncStrategy === 'date_partition') && (
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
                Referans Kolon
                <span className="text-red-500 ml-1">*</span>
              </label>
              {settingsColumns.length > 0 ? (
                <select
                  value={newDatasetReferenceColumn}
                  onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                  className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                >
                  <option value="">Kolon Seçin...</option>
                  {settingsColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={newDatasetReferenceColumn}
                  onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                  placeholder={newDatasetSyncStrategy === 'timestamp' ? 'örn: updated_at, modified_date' : 'örn: id, row_id'}
                  className={clsx('w-full px-4 py-2 rounded-lg border', theme.inputBg, theme.inputText, theme.inputBorder)}
                />
              )}
              <p className={clsx('text-xs mt-1.5', theme.contentTextMuted)}>
                {newDatasetSyncStrategy === 'timestamp' 
                  ? '⏰ Kaynak tablodaki tarih/zaman kolonu. Sadece bu kolondan sonraki değişiklikler çekilir.' 
                  : '🔢 Kaynak tablodaki ID kolonu. Sadece son ID\'den büyük yeni kayıtlar çekilir.'}
              </p>
            </div>
          )}

          {/* Full Refresh için Custom WHERE */}
          {newDatasetSyncStrategy === 'full_refresh' && (
            <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-emerald-900/30 border-emerald-500/50' : 'bg-emerald-100 border-emerald-300')}>
              <h5 className={clsx('font-semibold mb-2 flex items-center gap-2 text-sm', theme.contentText)}>
                🎯 Filtre Koşulu (Opsiyonel)
              </h5>
              <p className={clsx('text-xs mb-3', theme.contentTextMuted)}>
                Tüm tablo yerine belirli bir kısmı senkronize etmek için WHERE koşulu yazın.
              </p>
              <textarea
                value={customWhere}
                onChange={(e) => setCustomWhere(e.target.value)}
                placeholder="Örnek: tarih >= CURRENT_DATE - INTERVAL '7 days'"
                rows={2}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm font-mono', theme.inputBg, theme.inputText, theme.inputBorder)}
              />
            </div>
          )}

          {/* Tarih Bazlı Sil-Yaz Ayarları */}
          {newDatasetSyncStrategy === 'date_delete_insert' && (
            <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-orange-900/30 border-orange-500/50' : 'bg-orange-100 border-orange-300')}>
              <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                📅 Tarih Bazlı Sil-Yaz Ayarları
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Tarih Kolonu *</label>
                  <select
                    value={newDatasetReferenceColumn}
                    onChange={(e) => setNewDatasetReferenceColumn(e.target.value)}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="">Tarih kolonu seçin</option>
                    {settingsColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Sil-Yaz Aralığı</label>
                  <select
                    value={deleteDays}
                    onChange={(e) => setDeleteDays(parseInt(e.target.value))}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value={0}>🔥 Bugün (Sadece bugün)</option>
                    <option value={1}>📆 Son 1 gün</option>
                    <option value={3}>📆 Son 3 gün</option>
                    <option value={7}>📆 Son 7 gün</option>
                    <option value={30}>📆 Son 30 gün</option>
                    <option value={90}>📆 Son 3 ay</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Date Partition Ayarları */}
          {newDatasetSyncStrategy === 'date_partition' && (
            <div className={clsx('p-4 rounded-xl border', isDark ? 'bg-blue-900/20 border-blue-500/30' : 'bg-blue-50 border-blue-200')}>
              <h5 className={clsx('font-semibold mb-3 flex items-center gap-2 text-sm', theme.contentText)}>
                📊 Partition & Refresh Ayarları
              </h5>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Partition Kolonu *</label>
                  <select
                    value={partitionColumn}
                    onChange={(e) => setPartitionColumn(e.target.value)}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="">Tarih kolonu seçin</option>
                    {settingsColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Partition Tipi</label>
                  <select
                    value={partitionType}
                    onChange={(e) => setPartitionType(e.target.value as 'monthly' | 'daily')}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="monthly">Aylık (YYYYMM)</option>
                    <option value="daily">Günlük (YYYYMMDD)</option>
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Sliding Window (Gün)</label>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={refreshWindowDays}
                    onChange={(e) => setRefreshWindowDays(parseInt(e.target.value) || 0)}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  />
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Clixer Engine</label>
                  <select
                    value={engineType}
                    onChange={(e) => setEngineType(e.target.value as 'MergeTree' | 'ReplacingMergeTree')}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="MergeTree">MergeTree</option>
                    <option value="ReplacingMergeTree">ReplacingMergeTree</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <label className={clsx('flex items-center gap-2 cursor-pointer')}>
                  <input
                    type="checkbox"
                    checked={detectModified}
                    onChange={(e) => setDetectModified(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className={clsx('text-sm', theme.contentText)}>Geçmiş değişiklikleri algıla</span>
                </label>
                {detectModified && (
                  <select
                    value={modifiedColumn}
                    onChange={(e) => setModifiedColumn(e.target.value)}
                    className={clsx('w-full px-3 py-2 rounded-lg border text-sm ml-6', theme.inputBg, theme.inputText, theme.inputBorder)}
                  >
                    <option value="">modified_at kolonu seçin</option>
                    {settingsColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                )}
                <label className={clsx('flex items-center gap-2 cursor-pointer')}>
                  <input
                    type="checkbox"
                    checked={weeklyFullRefresh}
                    onChange={(e) => setWeeklyFullRefresh(e.target.checked)}
                    className="w-4 h-4 rounded"
                  />
                  <span className={clsx('text-sm', theme.contentText)}>Haftalık full refresh</span>
                </label>
              </div>
            </div>
          )}

          {/* Strateji Açıklaması */}
          <p className={clsx('text-xs p-2 rounded-lg flex items-center gap-1.5', isDark ? 'bg-slate-800/50 text-slate-400' : 'bg-blue-50 text-blue-700')}>
            <Info className="h-3.5 w-3.5 flex-shrink-0" />
            {newDatasetSyncStrategy === 'full_refresh' && 'Full Refresh: Tüm veri sil-yaz. Küçük tablolar için.'}
            {newDatasetSyncStrategy === 'timestamp' && 'Timestamp: Değişen kayıtları çek. Büyük tablolar için.'}
            {newDatasetSyncStrategy === 'id' && 'ID-Based: Yeni kayıtları çek. Log tabloları için.'}
            {newDatasetSyncStrategy === 'date_partition' && 'Date Partition: Sliding window. Büyük satış tabloları için.'}
            {newDatasetSyncStrategy === 'date_delete_insert' && 'Tarih Bazlı: Son X günü sil-yaz. Günlük güncellenen tablolar için.'}
          </p>

          {/* Unique Kolon */}
          <div className={clsx('p-3 rounded-lg border-2', 
            uniqueColumn 
              ? (isDark ? 'bg-green-900/20 border-green-500/50' : 'bg-green-50 border-green-300')
              : (isDark ? 'bg-red-900/30 border-red-500' : 'bg-red-50 border-red-400')
          )}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🔑</span>
              <span className={clsx('font-medium text-sm', theme.contentText)}>
                Unique Kolon (Zorunlu)
              </span>
              {uniqueColumn ? (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500 text-white">✓ Seçildi</span>
              ) : (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500 text-white">⚠ Zorunlu</span>
              )}
            </div>
            <select
              value={uniqueColumn}
              onChange={(e) => setUniqueColumn(e.target.value)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm',
                theme.inputBg, theme.inputText,
                uniqueColumn ? 'border-green-500' : 'border-red-500'
              )}
            >
              <option value="">-- Unique Kolon Seçin --</option>
              {sqlResult?.columns?.map((col: any) => (
                <option key={col.name} value={col.name}>
                  {col.name} ({col.type})
                  {autoDetectedUnique === col.name ? ' ✓ Önerilen' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* RLS Ayarları */}
          <details className={clsx('rounded-lg', isDark ? 'bg-purple-900/20 border border-purple-500/30' : 'bg-purple-50 border border-purple-200')}>
            <summary className={clsx('p-3 cursor-pointer font-medium text-sm flex items-center gap-2', theme.contentText)}>
              <span>🔒 Satır Güvenliği (RLS)</span>
              {(rlsStoreColumn || rlsRegionColumn || rlsGroupColumn) && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-500 text-white">Aktif</span>
              )}
            </summary>
            <div className="px-3 pb-3 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Mağaza Kolonu</label>
                  <select
                    value={rlsStoreColumn}
                    onChange={(e) => setRlsStoreColumn(e.target.value)}
                    className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', theme.inputBg, theme.inputText)}
                  >
                    <option value="">Seçilmedi</option>
                    {settingsColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Bölge Kolonu</label>
                  <select
                    value={rlsRegionColumn}
                    onChange={(e) => setRlsRegionColumn(e.target.value)}
                    className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', theme.inputBg, theme.inputText)}
                  >
                    <option value="">Seçilmedi</option>
                    {settingsColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={clsx('block text-xs font-medium mb-1', theme.contentTextMuted)}>Grup Kolonu</label>
                  <select
                    value={rlsGroupColumn}
                    onChange={(e) => setRlsGroupColumn(e.target.value)}
                    className={clsx('w-full px-2 py-1.5 rounded-lg border text-xs', theme.inputBg, theme.inputText)}
                  >
                    <option value="">Seçilmedi</option>
                    {settingsColumns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </details>

          {/* Dataset Bilgileri */}
          <details className={clsx('rounded-lg', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
            <summary className={clsx('p-3 cursor-pointer font-medium text-sm flex items-center justify-between', theme.contentText)}>
              <span>Dataset Bilgileri</span>
              <span className={clsx(
                'px-2 py-0.5 rounded text-xs font-medium',
                dataset.status === 'active' ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') :
                dataset.status === 'error' ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700') :
                (isDark ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-700')
              )}>
                {dataset.status === 'active' ? 'Aktif' : dataset.status === 'error' ? 'Hata' : dataset.status}
              </span>
            </summary>
            <div className="px-3 pb-3">
              <ul className={clsx('text-xs space-y-1', theme.contentTextMuted)}>
                <li className="flex justify-between">
                  <span>Bağlantı:</span>
                  <span className={theme.contentText}>{dataset.connection_name || '-'}</span>
                </li>
                <li className="flex justify-between">
                  <span>Son Sync:</span>
                  <span>{dataset.last_sync_at ? new Date(dataset.last_sync_at).toLocaleString('tr-TR') : 'Hiç'}</span>
                </li>
                <li className="flex justify-between">
                  <span>Toplam Satır:</span>
                  <span className={theme.contentText}>{(dataset.total_rows || dataset.last_sync_rows)?.toLocaleString() || '0'}</span>
                </li>
              </ul>
            </div>
          </details>

          {/* Hata Mesajı */}
          {dataset.status === 'error' && dataset.status_message && (
            <p className={clsx('text-xs p-2 rounded-lg flex items-center gap-1.5', isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')}>
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {translateErrorMessage(dataset.status_message)}
            </p>
          )}
        </div>

        <div className={clsx('p-4 border-t flex items-center justify-between flex-shrink-0', isDark ? 'border-slate-700' : 'border-slate-200')}>
          <button
            onClick={onDelete}
            className="px-3 py-1.5 rounded-lg text-red-500 hover:bg-red-500/10 flex items-center gap-2 text-sm"
          >
            <Trash2 className="h-4 w-4" />
            Sil
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className={clsx('px-3 py-1.5 rounded-lg text-sm', theme.buttonSecondary)}
            >
              İptal
            </button>
            <button
              onClick={onSave}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 text-sm font-medium"
            >
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
