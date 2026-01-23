/**
 * Clixer - Global Filter Bar
 * Tüm ana sayfalarda kullanılan üst filtre çubuğu
 */

import { useEffect, useState, useMemo } from 'react'
import { useFilterStore, DATE_PRESETS } from '../stores/filterStore'
import { useAuthStore } from '../stores/authStore'
import { useSettingsStore } from '../stores/settingsStore'
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
  Square,
  SlidersHorizontal,
  ChevronRight
} from 'lucide-react'
import clsx from 'clsx'
import IOSPicker from './IOSPicker'

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}

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
    isLoaded,
    isMobileFilterOpen,
    setMobileFilterOpen
  } = useFilterStore()
  
  // Veri etiketleri (dinamik isimler)
  const { 
    storeLabel, 
    storeLabelPlural, 
    regionLabel, 
    regionLabelPlural,
    groupLabel,
    groupLabelPlural 
  } = useSettingsStore()

  const [showRegionDropdown, setShowRegionDropdown] = useState(false)
  const [showGroupDropdown, setShowGroupDropdown] = useState(false)
  const [showStoreDropdown, setShowStoreDropdown] = useState(false)
  const [showDateDropdown, setShowDateDropdown] = useState(false)
  
  // LOCAL STORE SEÇİMİ - Dropdown açıkken bu kullanılır, kapatılınca Zustand'a yazılır
  const [localSelectedStoreIds, setLocalSelectedStoreIds] = useState<string[]>(selectedStoreIds)
  const [localSelectedRegionIds, setLocalSelectedRegionIds] = useState<string[]>(selectedRegionIds)
  const [localSelectedGroupIds, setLocalSelectedGroupIds] = useState<string[]>(selectedGroupIds)
  
  // Zustand store değiştiğinde local state'i senkronize et (sadece dropdown kapalıyken)
  useEffect(() => {
    if (!showStoreDropdown) {
      setLocalSelectedStoreIds(selectedStoreIds)
    }
  }, [selectedStoreIds, showStoreDropdown])

  useEffect(() => {
    if (!showRegionDropdown) {
      setLocalSelectedRegionIds(selectedRegionIds)
    }
  }, [selectedRegionIds, showRegionDropdown])

  useEffect(() => {
    if (!showGroupDropdown) {
      setLocalSelectedGroupIds(selectedGroupIds)
    }
  }, [selectedGroupIds, showGroupDropdown])
  
  // Dropdown kapandığında store'u güncelle
  const handleCloseStoreDropdown = () => {
    setShowStoreDropdown(false)
    // Sadece değişiklik varsa store'u güncelle
    if (JSON.stringify([...localSelectedStoreIds].sort()) !== JSON.stringify([...selectedStoreIds].sort())) {
      setStores(localSelectedStoreIds)
    }
  }

  const handleCloseRegionDropdown = () => {
    setShowRegionDropdown(false)
    if (JSON.stringify([...localSelectedRegionIds].sort()) !== JSON.stringify([...selectedRegionIds].sort())) {
      setRegions(localSelectedRegionIds)
    }
  }

  const handleCloseGroupDropdown = () => {
    setShowGroupDropdown(false)
    if (JSON.stringify([...localSelectedGroupIds].sort()) !== JSON.stringify([...selectedGroupIds].sort())) {
      setGroups(localSelectedGroupIds)
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
  // Bölge seçim özeti (dinamik etiket)
  const regionSelectionText = () => {
    if (selectedRegionIds.length === 0) return `Tüm ${regionLabelPlural}`
    if (selectedRegionIds.length === 1) {
      // selectedRegionIds artık code değerleri içeriyor (UUID değil)
      const region = regions.find(r => r.code === selectedRegionIds[0])
      return region?.name || `1 ${regionLabel.toLowerCase()}`
    }
    return `${selectedRegionIds.length} ${regionLabel.toLowerCase()}`
  }

  // Grup seçim özeti (dinamik etiket)
  const groupSelectionText = () => {
    if (selectedGroupIds.length === 0) return `Tüm ${groupLabelPlural}`
    if (selectedGroupIds.length === 1) {
      const group = groups.find(g => g.id === selectedGroupIds[0])
      return group?.name || `1 ${groupLabel.toLowerCase()}`
    }
    return `${selectedGroupIds.length} ${groupLabel.toLowerCase()}`
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
    
    // Sıralama mantığı: Sadece dropdown kapalıyken veya arama yapılırken seçilenleri üste al
    // Dropdown açıkken kullanıcı seçim yaparsa listenin zıplamasını önlemek için
    // sadece ilk açılıştaki (veya arama sonucundaki) sırayı koruyoruz.
    result.sort((a, b) => {
      // Eğer arama sorgusu VEYA dropdown KAPALI ise seçilenleri üste al
      if (!showStoreDropdown || storeSearchQuery.trim()) {
        const aSelected = localSelectedStoreIds.includes(a.id) ? 0 : 1
        const bSelected = localSelectedStoreIds.includes(b.id) ? 0 : 1
        if (aSelected !== bSelected) return aSelected - bSelected
      }
      return a.name.localeCompare(b.name, 'tr')
    })
    
    return result
  }, [filteredStores, storeSearchQuery, localSelectedStoreIds, showStoreDropdown])

  // Seçili mağaza sayısı özeti (dinamik etiket)
  const storeSelectionText = () => {
    if (selectedStoreIds.length === 0) return `${storeLabel} seçin`
    if (selectedStoreIds.length === stores.length) return `Tüm ${storeLabelPlural}`
    if (selectedStoreIds.length === 1) {
      const store = stores.find(s => s.id === selectedStoreIds[0])
      return store?.name || `1 ${storeLabel.toLowerCase()}`
    }
    return `${selectedStoreIds.length} ${storeLabel.toLowerCase()}`
  }

  // Mobil detection
  const isMobile = useIsMobile()
  
  // Bottom Sheet artık filterStore'dan yönetiliyor: isMobileFilterOpen, setMobileFilterOpen
  
  // iOS Picker states (mobil için native hissi)
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const [showGroupPicker, setShowGroupPicker] = useState(false)
  const [showStorePicker, setShowStorePicker] = useState(false)
  
  // Aktif filtre sayısını hesapla
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (selectedRegionIds.length > 0 && selectedRegionIds.length < regions.length) count++
    if (selectedGroupIds.length > 0 && selectedGroupIds.length < groups.length) count++
    if (selectedStoreIds.length > 0 && selectedStoreIds.length < stores.length) count++
    if (datePreset !== 'all') count++
    return count
  }, [selectedRegionIds, selectedGroupIds, selectedStoreIds, datePreset, regions, groups, stores])

  // Bottom Sheet'i kapat ve tüm dropdown'ları kapat
  const closeBottomSheet = () => {
    setMobileFilterOpen(false)
    setShowRegionDropdown(false)
    setShowGroupDropdown(false)
    if (showStoreDropdown) handleCloseStoreDropdown()
    setShowDateDropdown(false)
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBİL BOTTOM SHEET UI
  // ═══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <>
        {/* Mobil Filtre Trigger artık Layout.tsx header'ından tetikleniyor */}
        
        {/* Bottom Sheet Backdrop */}
        {isMobileFilterOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-50 transition-opacity"
            onClick={closeBottomSheet}
          />
        )}

        {/* Bottom Sheet Panel */}
        <div
          className={clsx(
            'fixed inset-x-0 bottom-0 z-50',
            'transform transition-transform duration-300 ease-out',
            isMobileFilterOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className={clsx(
            'rounded-t-3xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col',
            theme.cardBg
          )}>
            {/* Handle bar */}
            <div className="flex justify-center pt-3 pb-2">
              <div className={clsx('w-12 h-1.5 rounded-full', isDark ? 'bg-slate-600' : 'bg-slate-300')} />
            </div>

            {/* Header */}
            <div className={clsx(
              'flex items-center justify-between px-5 pb-3 border-b',
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <div className="flex items-center gap-2">
                <Filter size={20} className="text-indigo-500" />
                <h3 className={clsx('text-lg font-semibold', theme.contentText)}>Filtreler</h3>
                {activeFilterCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-600 text-xs font-medium">
                    {activeFilterCount} aktif
                  </span>
                )}
              </div>
              <button
                onClick={closeBottomSheet}
                className={clsx('p-2 rounded-full', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100')}
              >
                <X size={20} className={theme.contentText} />
              </button>
            </div>

            {/* Filtre içerikleri - Scrollable */}
            {/* SIRALAMA: Tarih > Grup > Bölge > Mağaza (Kullanıcı talebi) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* 1. Tarih Filtresi - EN ÜSTTE */}
              {showDateFilter && (
                <div className={clsx('p-4 rounded-xl', isDark ? 'bg-slate-800/50' : 'bg-slate-50')}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar size={18} className="text-orange-500" />
                      <span className={clsx('font-medium', theme.contentText)}>Tarih</span>
                    </div>
                    <span className={clsx('text-sm', theme.contentTextMuted)}>
                      {selectedDatePreset?.label}
                      {datePreset === 'custom' && ` (${startDate} - ${endDate})`}
                    </span>
                  </div>
                  {/* Tarih presetleri */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {DATE_PRESETS.filter(p => p.id !== 'custom').map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => setDatePreset(preset.id)}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                          datePreset === preset.id
                            ? 'bg-orange-500 text-white'
                            : clsx(isDark ? 'bg-slate-700 text-slate-300' : 'bg-white text-slate-700 border border-slate-200')
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {/* Özel tarih seçimi */}
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setCustomDates(e.target.value, endDate)}
                      className={clsx(
                        'flex-1 px-3 py-2 rounded-lg text-sm',
                        theme.inputBg, theme.inputText
                      )}
                    />
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setCustomDates(startDate, e.target.value)}
                      className={clsx(
                        'flex-1 px-3 py-2 rounded-lg text-sm',
                        theme.inputBg, theme.inputText
                      )}
                    />
                  </div>
                </div>
              )}

              {/* 2. Grup Filtresi - iOS Picker Style */}
              {showTypeFilter && groups.length > 0 && (
                <button
                  onClick={() => setShowGroupPicker(true)}
                  className={clsx(
                    'w-full flex items-center justify-between p-4 rounded-xl active:scale-[0.98] transition-transform',
                    isDark ? 'bg-slate-800/50' : 'bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                      <Building size={18} className="text-purple-500" />
                    </div>
                    <div className="text-left">
                      <p className={clsx('text-sm font-medium', theme.contentText)}>Grup</p>
                      <p className={clsx('text-xs', theme.contentTextMuted)}>{groupSelectionText()}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className={theme.contentTextMuted} />
                </button>
              )}

              {/* 3. Bölge Filtresi - iOS Picker Style */}
              {showRegionFilter && regions.length > 0 && (
                <button
                  onClick={() => setShowRegionPicker(true)}
                  className={clsx(
                    'w-full flex items-center justify-between p-4 rounded-xl active:scale-[0.98] transition-transform',
                    isDark ? 'bg-slate-800/50' : 'bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <MapPin size={18} className="text-blue-500" />
                    </div>
                    <div className="text-left">
                      <p className={clsx('text-sm font-medium', theme.contentText)}>{regionLabel}</p>
                      <p className={clsx('text-xs', theme.contentTextMuted)}>{regionSelectionText()}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className={theme.contentTextMuted} />
                </button>
              )}

              {/* 4. Mağaza Filtresi - iOS Picker Style */}
              {showStoreFilter && stores.length > 0 && (
                <button
                  onClick={() => setShowStorePicker(true)}
                  className={clsx(
                    'w-full flex items-center justify-between p-4 rounded-xl active:scale-[0.98] transition-transform',
                    isDark ? 'bg-slate-800/50' : 'bg-slate-50'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Store size={18} className="text-emerald-500" />
                    </div>
                    <div className="text-left">
                      <p className={clsx('text-sm font-medium', theme.contentText)}>{storeLabel}</p>
                      <p className={clsx('text-xs', theme.contentTextMuted)}>{storeSelectionText()}</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className={theme.contentTextMuted} />
                </button>
              )}

            </div>

            {/* Footer - Uygula butonu */}
            <div className={clsx(
              'p-4 border-t',
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              <button
                onClick={() => {
                  // Mağaza seçimlerini kaydet
                  if (JSON.stringify(localSelectedStoreIds.sort()) !== JSON.stringify(selectedStoreIds.sort())) {
                    setStores(localSelectedStoreIds)
                  }
                  closeBottomSheet()
                }}
                className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-base transition-colors active:bg-indigo-700"
              >
                Filtreleri Uygula
              </button>
            </div>
          </div>
        </div>

        {/* iOS Style Pickers */}
        <IOSPicker
          isOpen={showGroupPicker}
          onClose={() => setShowGroupPicker(false)}
          title="Grup Seçin"
          options={groups.map(g => ({ id: g.code, label: g.name }))}
          selectedIds={selectedGroupIds}
          onSelect={(ids) => setGroups(ids)}
          accentColor="#A855F7"
        />

        <IOSPicker
          isOpen={showRegionPicker}
          onClose={() => setShowRegionPicker(false)}
          title={`${regionLabel} Seçin`}
          options={regions.map(r => ({ id: r.code, label: r.name }))}
          selectedIds={selectedRegionIds}
          onSelect={(ids) => setRegions(ids)}
          accentColor="#3B82F6"
        />

        <IOSPicker
          isOpen={showStorePicker}
          onClose={() => setShowStorePicker(false)}
          title={`${storeLabel} Seçin`}
          options={filteredStores.map(s => ({ id: s.id, label: s.name, sublabel: s.city || '' }))}
          selectedIds={selectedStoreIds}
          onSelect={(ids) => setStores(ids)}
          accentColor="#10B981"
          showSearch={true}
          searchPlaceholder={`${storeLabel} ara...`}
        />
      </>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESKTOP UI (Mevcut yapı korunuyor)
  // ═══════════════════════════════════════════════════════════════════════════
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
            <div 
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'absolute top-full left-0 mt-2 w-72 rounded-xl shadow-2xl z-50 border overflow-hidden',
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
                    placeholder={`${regionLabel} ara...`}
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
                    onClick={() => setLocalSelectedRegionIds(regions.map(r => r.code))}
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
                    onClick={() => setLocalSelectedRegionIds([])}
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
                  const isSelected = localSelectedRegionIds.includes(region.code)
                  return (
                    <div
                      key={region.id}
                      onClick={() => {
                        if (isSelected) {
                          setLocalSelectedRegionIds(localSelectedRegionIds.filter(code => code !== region.code))
                        } else {
                          setLocalSelectedRegionIds([...localSelectedRegionIds, region.code])
                        }
                      }}
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
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-3 border-t flex items-center justify-between',
                isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
              )}>
                <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  {localSelectedRegionIds.length} / {regions.length} seçili
                </span>
                <button
                  onClick={handleCloseRegionDropdown}
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
            <div 
              onClick={(e) => e.stopPropagation()}
              className={clsx(
                'absolute top-full left-0 mt-2 w-72 rounded-xl shadow-2xl z-50 border overflow-hidden',
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
                    onClick={() => setLocalSelectedGroupIds(groups.map(g => g.code))}
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
                    onClick={() => setLocalSelectedGroupIds([])}
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
                  const isSelected = localSelectedGroupIds.includes(group.code)
                  return (
                    <div
                      key={group.id}
                      onClick={() => {
                        if (isSelected) {
                          setLocalSelectedGroupIds(localSelectedGroupIds.filter(code => code !== group.code))
                        } else {
                          setLocalSelectedGroupIds([...localSelectedGroupIds, group.code])
                        }
                      }}
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
                    </div>
                  )
                })}
              </div>

              {/* Footer */}
              <div className={clsx(
                'p-3 border-t flex items-center justify-between',
                isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
              )}>
                <span className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-500')}>
                  {localSelectedGroupIds.length} / {groups.length} seçili
                </span>
                <button
                  onClick={handleCloseGroupDropdown}
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
      {showStoreFilter && stores.length > 0 && (
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
                    placeholder={`${storeLabel} veya şehir ara...`}
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
                        {/* Label yerine div kullan - tüm alanı tıklanabilir yap */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation() // Overlay'e gitmesini engelle
                            // Direkt state güncelle - checkbox'a bağımlılık yok
                            if (isSelected) {
                              setLocalSelectedStoreIds(localSelectedStoreIds.filter(id => id !== store.id))
                            } else {
                              setLocalSelectedStoreIds([...localSelectedStoreIds, store.id])
                            }
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
                          {/* Custom Checkbox - Görsel */}
                          <div 
                            className={clsx(
                              'w-5 h-5 rounded flex items-center justify-center transition-all flex-shrink-0',
                              isSelected 
                                ? 'bg-emerald-500 text-white' 
                                : isDark 
                                  ? 'border-2 border-gray-600' 
                                  : 'border-2 border-gray-300'
                            )}
                          >
                            {isSelected && <Check size={12} strokeWidth={3} />}
                          </div>
                          
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
                        </div>
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
              // Mobilde full-width, desktop'ta fixed width
              'absolute top-full right-0 mt-2 w-[calc(100vw-32px)] sm:w-80 max-w-sm rounded-xl shadow-xl z-50 border overflow-hidden',
              theme.cardBg,
              isDark ? 'border-slate-700' : 'border-slate-200'
            )}>
              {/* Tarih preset butonları - flex-wrap ile responsive */}
              <div className="flex flex-wrap gap-1.5 p-2.5">
                {DATE_PRESETS.filter(p => p.id !== 'custom').map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { setDatePreset(preset.id); setShowDateDropdown(false) }}
                    className={clsx(
                      // Mobilde daha küçük font ve padding
                      'px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
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
                {/* Mobilde alt alta, desktop'ta yan yana */}
                <div className="flex flex-col sm:flex-row gap-2">
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
            if (showRegionDropdown) handleCloseRegionDropdown()
            if (showGroupDropdown) handleCloseGroupDropdown()
            if (showStoreDropdown) handleCloseStoreDropdown()
            setShowDateDropdown(false)
          }}
        />
      )}
    </div>
  )
}




