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
    selectedRegionIds,
    selectedGroupIds,
    selectedStoreIds,
    datePreset,
    startDate,
    endDate,
    loadFilters,
    setRegions,
    setGroups,
    setStores,
    setDatePreset,
    setCustomDates,
    selectAllStores,
    getFilteredStores,
    isLoaded
  } = useFilterStore()

  const [showRegionDropdown, setShowRegionDropdown] = useState(false)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  
  // LOCAL STORE SEÇİMİ - Dropdown açıkken bu kullanılır, kapatılınca Zustand'a yazılır
  const [localSelectedStoreIds, setLocalSelectedStoreIds] = useState<string[]>(selectedStoreIds)
  
  // Zustand store değiştiğinde local state'i senkronize et (sadece dropdown kapalıyken)
  useEffect(() => {
    if (!showStoreDropdown) {
      setLocalSelectedStoreIds(selectedStoreIds)
    }
  }, [selectedStoreIds, showStoreDropdown])
  
  // Dropdown kapandığında store'u güncelle
  const handleCloseStoreDropdown = () => {
    setShowStoreDropdown(false)
    // Sadece değişiklik varsa store'u güncelle
    if (JSON.stringify(localSelectedStoreIds.sort()) !== JSON.stringify(selectedStoreIds.sort())) {
      console.log('🔵 [FilterBar] Mağaza seçimleri kaydediliyor:', localSelectedStoreIds.length)
      setStores(localSelectedStoreIds)
    }
  }
  
  const [storeSearchQuery, setStoreSearchQuery] = useState('')
  const [regionSearchQuery, setRegionSearchQuery] = useState('')
  const [groupSearchQuery, setGroupSearchQuery] = useState('')

  // Filtreleri yükle
  useEffect(() => {
    if (accessToken && !isLoaded) {
      loadFilters(accessToken)
    }
  }, [accessToken, isLoaded, loadFilters])

  // getFilteredStores'u useMemo ile sarmalayarak gereksiz re-render'ları önle
  const filteredStores = useMemo(() => getFilteredStores(), [stores])
  const selectedDatePreset = DATE_PRESETS.find(p => p.id === datePreset)

  // Bölge seçim özeti
  const regionSelectionText = () => {
    if (selectedRegionIds.length === 0) return 'Tüm Bölgeler'
    if (selectedRegionIds.length === 1) {
      // selectedRegionIds artık code değerleri içeriyor (UUID değil)
      const region = regions.find(r => r.code === selectedRegionIds[0])
      return region?.name || '1 bölge'
    }
    return `${selectedRegionIds.length} bölge`
  }

  // Grup seçim özeti
  const groupSelectionText = () => {
    if (selectedGroupIds.length === 0) return 'Tüm Gruplar'
    if (selectedGroupIds.length === 1) {
      const group = groups.find(g => g.id === selectedGroupIds[0])
      return group?.name || '1 grup'
    }
    return `${selectedGroupIds.length} grup`
  }

  // Filtrelenmiş bölgeler (arama için)
  const searchedRegions = useMemo(() => {
    if (!regionSearchQuery.trim()) return regions
    const query = regionSearchQuery.toLowerCase().trim()
    return regions.filter(r => r.name.toLowerCase().includes(query) || r.code.toLowerCase().includes(query))
  }, [regions, regionSearchQuery])

  // Filtrelenmiş gruplar (arama için)
  const searchedGroups = useMemo(() => {
    if (!groupSearchQuery.trim()) return groups
    const query = groupSearchQuery.toLowerCase().trim()
    return groups.filter(g => g.name.toLowerCase().includes(query) || g.code.toLowerCase().includes(query))
  }, [groups, groupSearchQuery])

  // Arama ve sıralama ile filtrelenmiş mağazalar (LOCAL state kullan)
  const searchedStores = useMemo(() => {
    let result = [...filteredStores]
    
    // Arama filtresi
    if (storeSearchQuery.trim()) {
      const query = storeSearchQuery.toLowerCase().trim()
      result = result.filter(store => 
        store.name.toLowerCase().includes(query) ||
        store.city?.toLowerCase().includes(query) ||
        store.code?.toLowerCase().includes(query)
      )
    }
    
    // Seçili olanları üste al (LOCAL state kullan)
    result.sort((a, b) => {
      const aSelected = localSelectedStoreIds.includes(a.id) ? 0 : 1
      const bSelected = localSelectedStoreIds.includes(b.id) ? 0 : 1
      if (aSelected !== bSelected) return aSelected - bSelected
      return a.name.localeCompare(b.name, 'tr')
    })
    
    return result
  }, [filteredStores, storeSearchQuery, localSelectedStoreIds])

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

      {/* Bölge Seçimi - Çoklu Seçim */}
      {showRegionFilter && regions.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setShowRegionDropdown(!showRegionDropdown); setRegionSearchQuery('') }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedRegionIds.length > 0
                ? 'bg-blue-500/10 text-blue-600 border border-blue-500/30'
                : theme.buttonSecondary
            )}
          >
            <MapPin size={16} />
            {regionSelectionText()}
            <ChevronDown size={14} />
          </button>

          {showRegionDropdown && (
            <div className={clsx(
              'absolute top-full left-0 mt-2 w-72 rounded-xl shadow-2xl z-50 border overflow-hidden',
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
                    placeholder="Bölge ara..."
                    value={regionSearchQuery}
                    onChange={(e) => setRegionSearchQuery(e.target.value)}
                    className={clsx(
                      'flex-1 bg-transparent text-sm outline-none',
                      isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
                    )}
                    autoFocus
                  />
                  {regionSearchQuery && (
                    <button onClick={() => setRegionSearchQuery('')} className="text-gray-400 hover:text-gray-300">
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                {/* Hızlı seçim butonları */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setRegions(regions.map(r => r.id))}
                    className={clsx(
                      'flex items-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      isDark 
                        ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' 
                        : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                    )}
                  >
                    <CheckSquare size={12} />
                    Tümünü Seç
                  </button>
                  <button
                    onClick={() => setRegions([])}
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

              {/* Region List */}
              <div className="max-h-64 overflow-y-auto">
                {searchedRegions.map(region => {
                  // KRİTİK: region.code kullan, region.id DEĞİL!
                  // Backend MainRegionID (sayısal) bekliyor, regions.code = MainRegionID
                  const isSelected = selectedRegionIds.includes(region.code)
                  return (
                    <label
                      key={region.id}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all',
                        isSelected 
                          ? isDark 
                            ? 'bg-blue-500/15 border-l-2 border-blue-500' 
                            : 'bg-blue-50 border-l-2 border-blue-500'
                          : isDark 
                            ? 'hover:bg-[#21262d] border-l-2 border-transparent' 
                            : 'hover:bg-gray-50 border-l-2 border-transparent'
                      )}
                    >
                      <div 
                        className={clsx(
                          'w-5 h-5 rounded flex items-center justify-center transition-all',
                          isSelected 
                            ? 'bg-blue-500 text-white' 
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
                          // KRİTİK: region.code kullan, region.id DEĞİL!
                          if (e.target.checked) {
                            setRegions([...selectedRegionIds, region.code])
                          } else {
                            setRegions(selectedRegionIds.filter(code => code !== region.code))
                          }
                        }}
                        className="sr-only"
                      />
                      <div className="flex-1">
                        <span className={clsx(
                          'text-sm font-medium',
                          isSelected ? 'text-blue-600 dark:text-blue-400' : isDark ? 'text-gray-200' : 'text-gray-800'
                        )}>
                          {region.name}
                        </span>
                        <span className={clsx('text-xs ml-2', isDark ? 'text-gray-500' : 'text-gray-400')}>
                          #{region.code}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-3 border-t flex items-center justify-between',
                isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
              )}>
                <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  {selectedRegionIds.length} / {regions.length} seçili
                </span>
                <button
                  onClick={() => setShowRegionDropdown(false)}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-all"
                >
                  Uygula
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grup Seçimi - Dinamik Çoklu Seçim (ownership_groups tablosundan) */}
      {showTypeFilter && groups.length > 0 && (
        <div className="relative">
          <button
            onClick={() => { setShowGroupDropdown(!showGroupDropdown); setGroupSearchQuery('') }}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              selectedGroupIds.length > 0
                ? 'bg-purple-500/10 text-purple-600 border border-purple-500/30'
                : theme.buttonSecondary
            )}
          >
            <Building size={16} />
            {groupSelectionText()}
            <ChevronDown size={14} />
          </button>

          {showGroupDropdown && (
            <div className={clsx(
              'absolute top-full left-0 mt-2 w-72 rounded-xl shadow-2xl z-50 border overflow-hidden',
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
                    placeholder="Grup ara..."
                    value={groupSearchQuery}
                    onChange={(e) => setGroupSearchQuery(e.target.value)}
                    className={clsx(
                      'flex-1 bg-transparent text-sm outline-none',
                      isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
                    )}
                    autoFocus
                  />
                  {groupSearchQuery && (
                    <button onClick={() => setGroupSearchQuery('')} className="text-gray-400 hover:text-gray-300">
                      <X size={14} />
                    </button>
                  )}
                </div>
                
                {/* Hızlı seçim butonları */}
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setGroups(groups.map(g => g.code))}
                    className={clsx(
                      'flex items-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                      isDark 
                        ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30' 
                        : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                    )}
                  >
                    <CheckSquare size={12} />
                    Tümünü Seç
                  </button>
                  <button
                    onClick={() => setGroups([])}
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

              {/* Group List */}
              <div className="max-h-64 overflow-y-auto">
                {searchedGroups.map(group => {
                  const isSelected = selectedGroupIds.includes(group.code)
                  return (
                    <label
                      key={group.id}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 cursor-pointer transition-all',
                        isSelected 
                          ? isDark 
                            ? 'bg-purple-500/15 border-l-2 border-purple-500' 
                            : 'bg-purple-50 border-l-2 border-purple-500'
                          : isDark 
                            ? 'hover:bg-[#21262d] border-l-2 border-transparent' 
                            : 'hover:bg-gray-50 border-l-2 border-transparent'
                      )}
                    >
                      <div 
                        className={clsx(
                          'w-5 h-5 rounded flex items-center justify-center transition-all',
                          isSelected 
                            ? 'bg-purple-500 text-white' 
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
                            setGroups([...selectedGroupIds, group.code])
                          } else {
                            setGroups(selectedGroupIds.filter(code => code !== group.code))
                          }
                        }}
                        className="sr-only"
                      />
                      <div className="flex-1 flex items-center gap-2">
                        {group.color && (
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: group.color }}
                          />
                        )}
                        <span className={clsx(
                          'text-sm font-medium',
                          isSelected ? 'text-purple-600 dark:text-purple-400' : isDark ? 'text-gray-200' : 'text-gray-800'
                        )}>
                          {group.name}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-3 border-t flex items-center justify-between',
                isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
              )}>
                <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  {selectedGroupIds.length} / {groups.length} seçili
                </span>
                <button
                  onClick={() => setShowGroupDropdown(false)}
                  className="px-5 py-2 text-sm font-medium rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-all"
                >
                  Uygula
                </button>
              </div>
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
            <div 
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'absolute top-full left-0 mt-2 w-96 rounded-xl shadow-2xl z-50 border overflow-hidden',
                isDark ? 'bg-[#1a1d24] border-[#2a2f3a]' : 'bg-white border-gray-200'
              )}
            >
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
                    onClick={() => setLocalSelectedStoreIds(filteredStores.map(s => s.id))}
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
                    onClick={() => setLocalSelectedStoreIds([])}
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
              <div 
                className="max-h-72 overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {searchedStores.length === 0 ? (
                  <div className={clsx('p-6 text-center', isDark ? 'text-gray-500' : 'text-gray-400')}>
                    <Store size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Mağaza bulunamadı</p>
                  </div>
                ) : (
                  searchedStores.map((store, index) => {
                    // LOCAL state kullan - Zustand store değil
                    const isSelected = localSelectedStoreIds.includes(store.id)
                    const showDivider = index > 0 && 
                      localSelectedStoreIds.includes(searchedStores[index - 1].id) !== isSelected
                    
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
                          onClick={(e) => {
                            console.log('🟡 [FilterBar] Label tıklandı:', store.name, 'showStoreDropdown:', showStoreDropdown)
                            e.stopPropagation() // Overlay'e gitmesini engelle
                          }}
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
                          e.stopPropagation() // Event bubbling'i durdur
                          // LOCAL state güncelle - store'a yazmıyoruz, dropdown kapanınca yazılacak
                          if (e.target.checked) {
                            setLocalSelectedStoreIds([...localSelectedStoreIds, store.id])
                          } else {
                            setLocalSelectedStoreIds(localSelectedStoreIds.filter(id => id !== store.id))
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
                                store.storeType === 'MERKEZ' 
                                  ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700'
                                  : isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700'
                              )}>
                                {store.storeType === 'MERKEZ' ? 'Merkez' : 'Franchise'}
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
                  {localSelectedStoreIds.length} / {filteredStores.length} seçili
                </span>
                <button
                  onClick={handleCloseStoreDropdown}
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
      {(showRegionDropdown || showGroupDropdown || showStoreDropdown || showDateDropdown) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => {
            setShowRegionDropdown(false)
            setShowGroupDropdown(false)
            // Store dropdown için özel handler kullan - seçimleri kaydet
            if (showStoreDropdown) {
              handleCloseStoreDropdown()
            } else {
              setShowStoreDropdown(false)
            }
            setShowDateDropdown(false)
          }}
        />
      )}
    </div>
  )
}




