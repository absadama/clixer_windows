/**
 * Clixer - Global Filter Bar
 * Tüm ana sayfalarda kullanılan üst filtre çubuğu
 */

import { useEffect, useState } from 'react'
import { useFilterStore, DATE_PRESETS } from '../stores/filterStore'
import { useAuthStore } from '../stores/authStore'
import { useTheme } from './Layout'
import { 
  Building2, 
  MapPin, 
  Calendar, 
  ChevronDown, 
  Check,
  Filter,
  X,
  Building,
  Store
} from 'lucide-react'
import clsx from 'clsx'

interface FilterBarProps {
  showStoreFilter?: boolean
  showRegionFilter?: boolean
  showTypeFilter?: boolean
  showDateFilter?: boolean
  compact?: boolean
}

export default function FilterBar({
  showStoreFilter = true,
  showRegionFilter = true,
  showTypeFilter = true,
  showDateFilter = true,
  compact = false
}: FilterBarProps) {
  const { theme, isDark } = useTheme()
  const { accessToken } = useAuthStore()
  const {
    regions,
    stores,
    selectedRegionId,
    selectedStoreIds,
    selectedStoreType,
    datePreset,
    startDate,
    endDate,
    loadFilters,
    setRegion,
    setStores,
    setStoreType,
    setDatePreset,
    setCustomDates,
    selectAllStores,
    getFilteredStores,
    isLoaded
  } = useFilterStore()

  const [showRegionDropdown, setShowRegionDropdown] = useState(false)
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  const [showTypeDropdown, setShowTypeDropdown] = useState(false)

  // Filtreleri yükle
  useEffect(() => {
    if (accessToken && !isLoaded) {
      loadFilters(accessToken)
    }
  }, [accessToken, isLoaded, loadFilters])

  const filteredStores = getFilteredStores()
  const selectedRegion = regions.find(r => r.id === selectedRegionId)
  const selectedDatePreset = DATE_PRESETS.find(p => p.id === datePreset)

  // Seçili mağaza sayısı özeti
  const storeSelectionText = () => {
    if (selectedStoreIds.length === 0) return 'Mağaza seçin'
    if (selectedStoreIds.length === stores.length) return 'Tüm Mağazalar'
    if (selectedStoreIds.length === 1) {
      const store = stores.find(s => s.id === selectedStoreIds[0])
      return store?.name || '1 mağaza'
    }
    return `${selectedStoreIds.length} mağaza`
  }

  return (
    <div className={clsx(
      'flex flex-wrap items-center gap-3 p-4 rounded-2xl mb-6',
      theme.cardBg
    )}>
      <div className={clsx('flex items-center gap-2', theme.contentTextMuted)}>
        <Filter size={18} />
        <span className="text-sm font-medium">Filtreler:</span>
      </div>

      {/* Bölge Seçimi */}
      {showRegionFilter && regions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowRegionDropdown(!showRegionDropdown)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedRegionId
                ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                : theme.buttonSecondary
            )}
          >
            <MapPin size={16} />
            {selectedRegion?.name || 'Tüm Bölgeler'}
            <ChevronDown size={14} />
          </button>

          {showRegionDropdown && (
            <div className={clsx(
              'absolute top-full left-0 mt-2 w-56 rounded-xl shadow-xl z-50 border overflow-hidden',
              theme.cardBg,
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <button
                onClick={() => { setRegion(null); selectAllStores(); setShowRegionDropdown(false) }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                  !selectedRegionId ? 'bg-blue-500/10 text-blue-600' : theme.contentText,
                  'hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Building2 size={16} />
                Tüm Bölgeler
                {!selectedRegionId && <Check size={14} className="ml-auto" />}
              </button>
              {regions.map(region => (
                <button
                  key={region.id}
                  onClick={() => { setRegion(region.id); setShowRegionDropdown(false) }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                    selectedRegionId === region.id ? 'bg-blue-500/10 text-blue-600' : theme.contentText,
                    'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <MapPin size={16} />
                  {region.name}
                  {selectedRegionId === region.id && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tip Seçimi (Merkez/Franchise) */}
      {showTypeFilter && (
        <div className="relative">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedStoreType !== 'ALL'
                ? 'bg-purple-500/10 text-purple-600 border border-purple-500/30'
                : theme.buttonSecondary
            )}
          >
            <Building size={16} />
            {selectedStoreType === 'ALL' ? 'Tümü' : selectedStoreType === 'MERKEZ' ? 'Merkez' : 'Franchise'}
            <ChevronDown size={14} />
          </button>

          {showTypeDropdown && (
            <div className={clsx(
              'absolute top-full left-0 mt-2 w-44 rounded-xl shadow-xl z-50 border overflow-hidden',
              theme.cardBg,
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              {[
                { id: 'ALL', label: 'Tümü', icon: Building2 },
                { id: 'MERKEZ', label: 'Merkez', icon: Building },
                { id: 'FRANCHISE', label: 'Franchise', icon: Store }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => { setStoreType(type.id as any); setShowTypeDropdown(false) }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                    selectedStoreType === type.id ? 'bg-purple-500/10 text-purple-600' : theme.contentText,
                    'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <type.icon size={16} />
                  {type.label}
                  {selectedStoreType === type.id && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mağaza Seçimi */}
      {showStoreFilter && (
        <div className="relative">
          <button
            onClick={() => setShowStoreDropdown(!showStoreDropdown)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedStoreIds.length > 0 && selectedStoreIds.length < stores.length
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                : theme.buttonSecondary
            )}
          >
            <Store size={16} />
            {storeSelectionText()}
            <ChevronDown size={14} />
          </button>

          {showStoreDropdown && (
            <div className={clsx(
              'absolute top-full left-0 mt-2 w-72 max-h-80 rounded-xl shadow-xl z-50 border overflow-hidden',
              theme.cardBg,
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <div className="p-3 border-b flex gap-2">
                <button
                  onClick={selectAllStores}
                  className={clsx('flex-1 px-3 py-1.5 text-xs font-medium rounded-lg', theme.buttonSecondary)}
                >
                  Tümünü Seç
                </button>
                <button
                  onClick={() => setStores([])}
                  className={clsx('flex-1 px-3 py-1.5 text-xs font-medium rounded-lg', theme.buttonSecondary)}
                >
                  Temizle
                </button>
              </div>
              <div className="max-h-60 overflow-y-auto">
                {filteredStores.map(store => (
                  <label
                    key={store.id}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                      selectedStoreIds.includes(store.id) 
                        ? 'bg-emerald-500/10' 
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStoreIds.includes(store.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setStores([...selectedStoreIds, store.id])
                        } else {
                          setStores(selectedStoreIds.filter(id => id !== store.id))
                        }
                      }}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <span className={clsx('text-sm font-medium', theme.contentText)}>{store.name}</span>
                      <span className={clsx('text-xs ml-2', theme.contentTextMuted)}>
                        {store.storeType === 'MERKEZ' ? '🏢' : '🏪'} {store.city}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
              <div className="p-2 border-t">
                <button
                  onClick={() => setShowStoreDropdown(false)}
                  className={clsx('w-full px-4 py-2 text-sm font-medium rounded-lg', theme.buttonPrimary)}
                >
                  Uygula ({selectedStoreIds.length} seçili)
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tarih Seçimi */}
      {showDateFilter && (
        <div className="relative ml-auto">
          <button
            onClick={() => setShowDateDropdown(!showDateDropdown)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              theme.buttonSecondary
            )}
          >
            <Calendar size={16} />
            {selectedDatePreset?.label || 'Tarih Seç'}
            {datePreset === 'custom' && (
              <span className={clsx('text-xs', theme.contentTextMuted)}>
                ({startDate} - {endDate})
              </span>
            )}
            <ChevronDown size={14} />
          </button>

          {showDateDropdown && (
            <div className={clsx(
              'absolute top-full right-0 mt-2 w-72 rounded-xl shadow-xl z-50 border overflow-hidden',
              theme.cardBg,
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <div className="grid grid-cols-2 gap-1 p-2">
                {DATE_PRESETS.filter(p => p.id !== 'custom').map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { setDatePreset(preset.id); setShowDateDropdown(false) }}
                    className={clsx(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      datePreset === preset.id 
                        ? 'bg-indigo-500 text-white' 
                        : clsx(theme.contentText, 'hover:bg-slate-100 dark:hover:bg-slate-800')
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t">
                <p className={clsx('text-xs font-medium mb-2', theme.contentTextMuted)}>Özel Tarih Aralığı</p>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setCustomDates(e.target.value, endDate)}
                    className={clsx('flex-1 px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setCustomDates(startDate, e.target.value)}
                    className={clsx('flex-1 px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dropdown kapatma overlay */}
      {(showRegionDropdown || showStoreDropdown || showDateDropdown || showTypeDropdown) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowRegionDropdown(false)
            setShowStoreDropdown(false)
            setShowDateDropdown(false)
            setShowTypeDropdown(false)
          }}
        />
      )}
    </div>
  )
}




