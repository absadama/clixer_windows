/**
 * ParameterFilterWidget
 * Parametre tipindeki metrikleri FilterBar tarzı multi-select dropdown olarak render eder
 * 
 * Özellikler:
 * - Multi-select (checkbox'larla)
 * - Arama özelliği
 * - Tümünü Seç / Temizle butonları
 * - Uygula butonu ile dashboard yenileme
 * - React Portal ile body'ye render (overflow sorunlarını önler)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  Filter, ChevronDown, Search, X, CheckSquare, Square, Check,
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Database, Zap,
  ArrowUp, ArrowDown, Minus, Loader, DollarSign, ShoppingCart, Users,
  Store, Package, Percent, AlertCircle, Calendar, RefreshCw, Building2,
  Briefcase, MapPin, Tag, Layers, Settings, Box, Grid, List
} from 'lucide-react'
import clsx from 'clsx'
import { useParameterStore } from '../stores/parameterStore'

// İkon haritası - tüm kullanılabilir ikonlar
const iconMap: Record<string, React.ComponentType<any>> = {
  Filter, BarChart3, LineChart, PieChart, TrendingUp, TrendingDown, Hash, Gauge,
  Target, Table2, Trophy, Activity, GitCompare, Database, Zap,
  ArrowUp, ArrowDown, Minus, Loader, DollarSign, ShoppingCart, Users,
  Store, Package, Percent, AlertCircle, Calendar, RefreshCw, Building2,
  Briefcase, MapPin, Tag, Layers, Settings, Box, Grid, List
}

interface ParameterFilterWidgetProps {
  /** Widget ID */
  widgetId: string
  /** Bağlı metrik ID */
  metricId: string
  /** Widget başlığı */
  title: string
  /** Backend'den gelen parametre değerleri */
  options: string[]
  /** Tema objesi */
  theme: {
    cardBg: string
    contentText: string
    contentTextMuted: string
    inputBg: string
    inputText: string
    buttonPrimary: string
    buttonSecondary?: string
  }
  /** Seçim değiştiğinde çağrılacak callback */
  onSelectionChange?: () => void
  /** Widget boyutları (grid) */
  gridW?: number
  gridH?: number
  /** Dark mode */
  isDark?: boolean
  /** Widget rengi (hex) */
  color?: string
  /** İkon adı */
  icon?: string
  /** Kart renk modu: none (sade), accent (üst bar), full (tam renk) */
  colorMode?: 'none' | 'accent' | 'full'
}

export const ParameterFilterWidget: React.FC<ParameterFilterWidgetProps> = ({
  widgetId,
  metricId,
  title,
  options = [],
  theme,
  onSelectionChange,
  gridW = 4,
  gridH = 2,
  isDark = false,
  color = '#6366F1', // Default indigo
  icon = 'Filter',
  colorMode = 'none'
}) => {
  // Dinamik ikon
  const IconComponent = iconMap[icon] || Filter
  
  // Renk modları için stil hesaplamaları
  const isFullColorMode = colorMode === 'full'
  const isAccentMode = colorMode === 'accent'
  const { selectedValues, setParameterValue } = useParameterStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [localSelected, setLocalSelected] = useState<string[]>([])
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
  // FilterBar pattern: Dropdown AÇIKKEN dışarıdan gelen options değişikliklerini YOKSAY
  // Bu sayede dashboard refresh sırasında dropdown içeriği boşalmaz
  // KRITIK: options ile initialize et, boş array ile DEĞİL
  const optionsWhenOpenedRef = useRef<string[]>(options)
  
  // Dropdown açıldığında veya kapalıyken options değiştiğinde ref'i güncelle
  useEffect(() => {
    // Dropdown kapalıyken her zaman güncel options'ı kullan
    if (!isOpen && options.length > 0) {
      optionsWhenOpenedRef.current = options
    }
    // Dropdown açıkken VE ref boşsa VE options doluysa güncelle (ilk açılış)
    else if (isOpen && optionsWhenOpenedRef.current.length === 0 && options.length > 0) {
      optionsWhenOpenedRef.current = options
    }
    // Dropdown açıkken options değişirse YOKSAY (FilterBar pattern)
  }, [options, isOpen])
  
  // Dropdown açıkken ref'teki options'ı kullan (sabit), kapalıyken güncel options
  const stableOptions = isOpen 
    ? (optionsWhenOpenedRef.current.length > 0 ? optionsWhenOpenedRef.current : options)
    : options
  
  // Mevcut seçili değerleri parse et (virgülle ayrılmış string veya array)
  const currentValue = selectedValues[metricId] || 'ALL'
  
  // Sayfa yüklendiğinde mevcut seçimleri local state'e aktar
  useEffect(() => {
    if (currentValue === 'ALL' || currentValue === '') {
      setLocalSelected([])
    } else {
      // Virgülle ayrılmış string'i array'e çevir
      const values = currentValue.split(',').filter(v => v.trim())
      setLocalSelected(values)
    }
  }, [currentValue])
  
  // Dışarı tıklandığında dropdown'u kapat
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])
  
  // Sadece resize'da dropdown'u kapat (scroll'da kapatma - dropdown içi scroll için)
  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      window.addEventListener('resize', handleResize)
    }
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [isOpen])
  
  // Filtrelenmiş opsiyonlar (stableOptions kullan - race condition önleme)
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return stableOptions
    const query = searchQuery.toLowerCase()
    return stableOptions.filter(opt => opt.toLowerCase().includes(query))
  }, [stableOptions, searchQuery])
  
  // Seçim text'i (stableOptions kullan)
  const selectionText = useMemo(() => {
    if (localSelected.length === 0) return 'Tümü'
    if (localSelected.length === 1) return localSelected[0]
    if (localSelected.length === stableOptions.length) return 'Tümü'
    return `${localSelected.length} seçili`
  }, [localSelected, stableOptions.length])
  
  // Checkbox toggle
  const toggleOption = (value: string) => {
    setLocalSelected(prev => {
      if (prev.includes(value)) {
        return prev.filter(v => v !== value)
      } else {
        return [...prev, value]
      }
    })
  }
  
  // Tümünü Seç (stableOptions kullan)
  const selectAll = () => {
    setLocalSelected([...stableOptions])
  }
  
  // Temizle
  const clearAll = () => {
    setLocalSelected([])
  }
  
  // Uygula - Store'u güncelle ve dashboard'u yenile (stableOptions kullan)
  const applyFilter = () => {
    // Tümü seçili veya hiçbiri seçili değilse ALL olarak işaretle
    if (localSelected.length === 0 || localSelected.length === stableOptions.length) {
      setParameterValue(metricId, 'ALL')
    } else {
      // Virgülle ayrılmış string olarak kaydet
      setParameterValue(metricId, localSelected.join(','))
    }
    
    setIsOpen(false)
    
    // State güncellemesinin tamamlanmasını bekle, sonra dashboard'u yenile
    // setTimeout(0) Zustand state güncellemesinin event loop'ta tamamlanmasını sağlar
    if (onSelectionChange) {
      setTimeout(() => {
        onSelectionChange()
      }, 0)
    }
  }
  
  // Aktif filtre var mı? (stableOptions kullan)
  const hasActiveFilter = localSelected.length > 0 && localSelected.length < stableOptions.length
  
  // Dropdown portal içeriği
  const dropdownContent = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        'fixed w-72 rounded-xl shadow-2xl border flex flex-col',
        isDark ? 'bg-[#1a1d24] border-[#2a2f3a]' : 'bg-white border-gray-200'
      )}
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999,
        maxHeight: `calc(100vh - ${dropdownPosition.top + 16}px)`
      }}
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
            placeholder="Ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={clsx(
              'flex-1 bg-transparent text-sm outline-none',
              isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
            )}
            autoFocus
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-gray-400 hover:text-gray-300">
              <X size={14} />
            </button>
          )}
        </div>
        
        {/* Hızlı seçim butonları */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={selectAll}
            className={clsx(
              'flex items-center gap-1.5 flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
              isDark 
                ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' 
                : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
            )}
          >
            <CheckSquare size={12} />
            Tümünü Seç
          </button>
          <button
            onClick={clearAll}
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

      {/* Options List */}
      <div className="flex-1 min-h-0 max-h-64 overflow-y-auto">
        {filteredOptions.length === 0 && stableOptions.length === 0 ? (
          <div className={clsx(
            'p-4 text-center text-sm',
            isDark ? 'text-gray-500' : 'text-gray-400'
          )}>
            Yükleniyor...
          </div>
        ) : filteredOptions.length === 0 ? (
          <div className={clsx(
            'p-4 text-center text-sm',
            isDark ? 'text-gray-500' : 'text-gray-400'
          )}>
            Sonuç bulunamadı
          </div>
        ) : (
          filteredOptions.map((option, index) => {
            const isSelected = localSelected.includes(option)
            return (
              <label
                key={`${option}-${index}`}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                  isDark 
                    ? 'hover:bg-[#21262d]' 
                    : 'hover:bg-gray-50',
                  isSelected && (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50')
                )}
              >
                <div className={clsx(
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                  isSelected
                    ? 'bg-indigo-500 border-indigo-500'
                    : isDark 
                      ? 'border-gray-600 bg-transparent' 
                      : 'border-gray-300 bg-white'
                )}>
                  {isSelected && <Check size={12} className="text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOption(option)}
                  className="sr-only"
                />
                <span className={clsx(
                  'text-sm',
                  isDark ? 'text-gray-200' : 'text-gray-700'
                )}>
                  {option}
                </span>
              </label>
            )
          })
        )}
      </div>

      {/* Footer - Apply Button */}
      <div className={clsx(
        'p-3 border-t',
        isDark ? 'border-[#2a2f3a] bg-[#14171c]' : 'border-gray-100 bg-gray-50'
      )}>
        <div className="flex items-center justify-between">
          <span className={clsx(
            'text-xs',
            isDark ? 'text-gray-500' : 'text-gray-400'
          )}>
            {localSelected.length} / {stableOptions.length} seçili
          </span>
          <button
            onClick={applyFilter}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              'bg-indigo-500 text-white hover:bg-indigo-600'
            )}
          >
            Uygula
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <div className="inline-block">
      {/* Trigger Button - ColorMode destekli */}
      <button
        ref={buttonRef}
        onClick={() => {
          if (!isOpen && buttonRef.current) {
            // Pozisyonu ÖNCE hesapla, sonra aç (flash önleme)
            const rect = buttonRef.current.getBoundingClientRect()
            const dropdownHeight = 400 // Tahmini dropdown yüksekliği
            const viewportHeight = window.innerHeight
            
            // Dropdown aşağı sığıyor mu kontrol et
            let top = rect.bottom + 8
            if (rect.bottom + dropdownHeight > viewportHeight) {
              // Aşağı sığmıyor, yukarı aç
              top = Math.max(8, rect.top - dropdownHeight - 8)
            }
            
            // Soldan taşma kontrolü
            let left = rect.left
            const dropdownWidth = 288 // w-72 = 18rem = 288px
            if (left + dropdownWidth > window.innerWidth) {
              left = window.innerWidth - dropdownWidth - 16
            }
            
            setDropdownPosition({ top, left })
          }
          setIsOpen(!isOpen)
          setSearchQuery('')
        }}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
          // Full color mode
          isFullColorMode && 'text-white border-transparent',
          // Accent mode - üst bar için border-top
          isAccentMode && 'border-t-2',
          // None mode veya active filter durumu
          !isFullColorMode && !isAccentMode && (
            hasActiveFilter
              ? 'border'
              : isDark 
                ? 'bg-[#21262d] text-gray-300 hover:bg-[#2a2f3a] border border-[#2a2f3a]'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
          ),
          // Accent mode base style
          isAccentMode && (
            isDark 
              ? 'bg-[#21262d] text-gray-300 hover:bg-[#2a2f3a] border-x border-b border-[#2a2f3a]'
              : 'bg-white text-gray-700 hover:bg-gray-50 border-x border-b border-gray-200 shadow-sm'
          )
        )}
        style={{
          // Full color mode - gradient arka plan
          ...(isFullColorMode ? {
            background: `linear-gradient(135deg, ${color} 0%, ${color}dd 100%)`,
            boxShadow: `0 4px 12px ${color}40`,
          } : {}),
          // Accent mode - üst bar rengi
          ...(isAccentMode ? {
            borderTopColor: color,
          } : {}),
          // Active filter durumunda renk vurgusu (none mode)
          ...(!isFullColorMode && !isAccentMode && hasActiveFilter ? {
            backgroundColor: `${color}15`,
            color: color,
            borderColor: `${color}40`,
          } : {}),
        }}
      >
        {/* İkon - Dinamik */}
        <div 
          className={clsx(
            'flex items-center justify-center rounded-lg',
            isFullColorMode ? 'bg-white/20 p-1' : ''
          )}
          style={{
            color: isFullColorMode ? 'white' : (hasActiveFilter ? color : undefined)
          }}
        >
          <IconComponent size={16} />
        </div>
        <span className="truncate max-w-[120px]">{title}</span>
        <span 
          className={clsx(
            'text-xs px-2 py-0.5 rounded-full',
            isFullColorMode 
              ? 'bg-white/20 text-white'
              : isAccentMode
                ? 'bg-gray-100 text-gray-600'
                : hasActiveFilter
                  ? ''
                  : isDark ? 'bg-[#2a2f3a] text-gray-400' : 'bg-gray-200 text-gray-500'
          )}
          style={{
            ...(hasActiveFilter && !isFullColorMode && !isAccentMode ? {
              backgroundColor: `${color}20`,
              color: color,
            } : {}),
            ...(isAccentMode && hasActiveFilter ? {
              backgroundColor: `${color}15`,
              color: color,
            } : {}),
          }}
        >
          {selectionText}
        </span>
        <ChevronDown 
          size={14} 
          className={clsx(
            'transition-transform',
            isOpen && 'rotate-180'
          )} 
        />
      </button>

      {/* Dropdown - Portal ile body'ye render edilir */}
      {dropdownContent}
    </div>
  )
}

export default ParameterFilterWidget
