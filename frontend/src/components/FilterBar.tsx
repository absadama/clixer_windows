/**
 * Clixer - Global Filter Bar
 * Tüm ana sayfalarda kullanılan üst filtre çubuğu
 */

import { useEffect, useState, useMemo } from 'react'
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
  Store,
  Search,
  CheckSquare,
  Square
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
    groups,
    stores,
    selectedRegionId,
    selectedStoreIds,
    selectedGroupId,
    datePreset,
    startDate,
    endDate,
    loadFilters,
    setRegion,
    setStores,
    setGroup,
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
  const [storeSearchQuery, setStoreSearchQuery] = useState('')

  // Filtreleri yükle
  useEffect(() => {
    if (accessToken && !isLoaded) {
      loadFilters(accessToken)
    }
  }, [accessToken, isLoaded, loadFilters])

  const filteredStores = getFilteredStores()
  const selectedRegion = regions.find(r => r.id === selectedRegionId)
  
  // Dinamik olarak kullanılabilir grupları belirle (seçili bölgeye göre)
  const availableGroups = useMemo(() => {
    if (!selectedRegionId) return groups;
    
    // Seçili bölgedeki mağazaların grup kodlarını bul
    const regionStores = stores.filter(s => s.regionId === selectedRegionId);
    const regionGroupCodes = new Set(regionStores.map(s => s.ownershipGroup).filter(Boolean));
    
    // Sadece bu kodlara sahip grupları döndür
    return groups.filter(g => regionGroupCodes.has(g.code));
  }, [groups, stores, selectedRegionId]);

  // Dinamik olarak kullanılabilir bölgeleri belirle (seçili gruba göre)
  const availableRegions = useMemo(() => {
    if (!selectedGroupId) return regions;
    
    // Seçili gruptaki mağazaların bölge ID'lerini bul
    const group = groups.find(g => g.id === selectedGroupId);
    if (!group) return regions;
    
    const groupStores = stores.filter(s => s.ownershipGroup === group.code);
    const groupRegionIds = new Set(groupStores.map(s => s.regionId).filter(Boolean));
    
    // Sadece bu ID'lere sahip bölgeleri döndür
    return regions.filter(r => groupRegionIds.has(r.id));
  }, [regions, groups, stores, selectedGroupId]);

  const selectedDatePreset = DATE_PRESETS.find(p => p.id === datePreset)

  // Arama ve sıralama ile filtrelenmiş mağazalar
  const searchedStores = useMemo(() => {
    let result = [...filteredStores]
    
    // Arama filtresi
    if (storeSearchQuery.trim()) {
      const query = storeSearchQuery.toLowerCase().trim()
      result = result.filter(store => 
        (store.name || '').toLowerCase().includes(query) ||
        (store.city || '').toLowerCase().includes(query) ||
        (store.code || '').toLowerCase().includes(query)
      )
    }
    
    // Seçili olanları üste al - Sadece arama yoksa sırala (UI stabilitesi için)
    if (!storeSearchQuery.trim()) {
      result.sort((a, b) => {
        const aSelected = selectedStoreIds.includes(a.id) ? 0 : 1
        const bSelected = selectedStoreIds.includes(b.id) ? 0 : 1
        if (aSelected !== bSelected) return aSelected - bSelected
        return (a.name || '').localeCompare(b.name || '', 'tr')
      })
    }
    
    return result
  }, [filteredStores, storeSearchQuery, selectedStoreIds])

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
              {availableRegions.map(region => (
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

      {/* Grup Seçimi (Dinamik Sahiplik Grubu) */}
      {showTypeFilter && groups.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedGroupId
                ? 'bg-purple-500/10 text-purple-600 border border-purple-500/30'
                : theme.buttonSecondary
            )}
          >
            <Building size={16} />
            {selectedGroupId ? groups.find(g => g.id === selectedGroupId)?.name : 'Tüm Gruplar'}
            <ChevronDown size={14} />
          </button>

          {showTypeDropdown && (
            <div className={clsx(
              'absolute top-full left-0 mt-2 w-44 rounded-xl shadow-xl z-50 border overflow-hidden',
              theme.cardBg,
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <button
                onClick={() => { setGroup(null); setShowTypeDropdown(false) }}
                className={clsx(
                  'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                  !selectedGroupId ? 'bg-purple-500/10 text-purple-600' : theme.contentText,
                  'hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
              >
                <Building2 size={16} />
                Tüm Gruplar
                {!selectedGroupId && <Check size={14} className="ml-auto" />}
              </button>
              {availableGroups.map(group => (
                <button
                  key={group.id}
                  onClick={() => { setGroup(group.id); setShowTypeDropdown(false) }}
                  className={clsx(
                    'w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors',
                    selectedGroupId === group.id ? 'bg-purple-500/10 text-purple-600' : theme.contentText,
                    'hover:bg-slate-100 dark:hover:bg-slate-800'
                  )}
                >
                  <Building size={16} />
                  {group.name}
                  {selectedGroupId === group.id && <Check size={14} className="ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mağaza Seçimi - Gelişmiş UI */}
      {showStoreFilter && (
        <div className="relative">
          <button
            onClick={() => { setShowStoreDropdown(!showStoreDropdown); setStoreSearchQuery('') }}
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
              'absolute top-full left-0 mt-2 w-96 rounded-xl shadow-2xl z-50 border overflow-hidden',
              isDark ? 'bg-[#1a1d24] border-[#2a2f3a]' : 'bg-white border-gray-200'
            )}>
              {/* Header - Search */}
              <div className={clsx(
                'p-3 border-b',
                isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
              )}>
                <div className={clsx(
                  'flex items-center gap-2 px-3 py-2 rounded-lg',
                  isDark ? 'bg-[#21262d]' : 'bg-white border border-gray-200'
                )}>
                  <Search size={16} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                  <input
                    type="text"
                    placeholder="Mağaza veya şehir ara..."
                    value={storeSearchQuery}
                    onChange={(e) => setStoreSearchQuery(e.target.value)}
                    className={clsx(
                      'flex-1 bg-transparent text-sm outline-none',
                      isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
                    )}
                    autoFocus
                  />
                  {storeSearchQuery && (
                    <button onClick={() => setStoreSearchQuery('')} className="text-gray-400 hover:text-gray-300">
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                {/* Hızlı seçim butonları */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={selectAllStores}
                    className={clsx(
                      'flex items-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      isDark 
                        ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' 
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    )}
                  >
                    <CheckSquare size={12} />
                    Tümünü Seç
                  </button>
                  <button
                    onClick={() => setStores([])}
                    className={clsx(
                      'flex items-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      isDark 
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                        : 'bg-red-50 text-red-600 hover:bg-red-100'
                    )}
                  >
                    <Square size={12} />
                    Temizle
                  </button>
                </div>
              </div>

              {/* Store List */}
              <div className="max-h-72 overflow-y-auto">
                {searchedStores.length === 0 ? (
                  <div className={clsx('p-6 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    <Store size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Mağaza bulunamadı</p>
                  </div>
                ) : (
                  searchedStores.map((store, index) => {
                    const isSelected = selectedStoreIds.includes(store.id)
                    const showDivider = index > 0 && 
                      selectedStoreIds.includes(searchedStores[index - 1].id) !== isSelected
                    
                    return (
                      <div key={store.id}>
                        {showDivider && (
                          <div className={clsx(
                            'px-4 py-1.5 text-xs font-medium',
                            isDark ? 'bg-[#14171c] text-gray-500' : 'bg-gray-50 text-gray-500'
                          )}>
                            Diğer Mağazalar ({filteredStores.length - selectedStoreIds.length})
                          </div>
                        )}
                        <label
                          className={clsx(
                            'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all',
                            isSelected 
                              ? isDark 
                                ? 'bg-emerald-500/15 border-l-2 border-emerald-500' 
                                : 'bg-emerald-50 border-l-2 border-emerald-500'
                              : isDark 
                                ? 'hover:bg-[#21262d] border-l-2 border-transparent' 
                                : 'hover:bg-gray-50 border-l-2 border-transparent'
                          )}
                        >
                          {/* Custom Checkbox */}
                          <div 
                            className={clsx(
                              'w-5 h-5 rounded flex items-center justify-center transition-all',
                              isSelected 
                                ? 'bg-emerald-500 text-white' 
                                : isDark 
                                  ? 'border-2 border-gray-600' 
                                  : 'border-2 border-gray-300'
                            )}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setStores([...selectedStoreIds, store.id])
                              } else {
                                setStores(selectedStoreIds.filter(id => id !== store.id))
                              }
                            }}
                            className="sr-only"
                          />
                          
                          {/* Store Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={clsx(
                                'text-sm font-semibold truncate',
                                isSelected 
                                  ? 'text-emerald-600 dark:text-emerald-400' 
                                  : isDark ? 'text-gray-200' : 'text-gray-800'
                              )}>
                                {store.name}
                              </span>
                              <span className={clsx(
                                'text-xs px-1.5 py-0.5 rounded',
                                store.ownershipGroup === 'MERKEZ' 
                                  ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                                  : isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                              )}>
                                {store.ownershipGroup || 'Belirtilmemiş'}
                              </span>
                            </div>
                            <div className={clsx(
                              'text-xs mt-0.5',
                              isDark ? 'text-gray-500' : 'text-gray-500'
                            )}>
                              📍 {store.city || 'Bilinmiyor'}
                              {store.code && <span className="ml-2 opacity-60">#{store.code}</span>}
                            </div>
                          </div>
                        </label>
                      </div>
                    )
                  })
                )}
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-3 border-t flex items-center justify-between',
                isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
              )}>
                <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  {selectedStoreIds.length} / {filteredStores.length} seçili
                </span>
                <button
                  onClick={() => setShowStoreDropdown(false)}
                  className={clsx(
                    'px-5 py-2 text-sm font-medium rounded-lg transition-all',
                    'bg-emerald-500 text-white hover:bg-emerald-600'
                  )}
                >
                  Uygula
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




