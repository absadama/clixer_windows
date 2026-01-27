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
import { Filter, ChevronDown, Search, X, CheckSquare, Square, Check } from 'lucide-react'
import clsx from 'clsx'
import { useParameterStore } from '../stores/parameterStore'

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
  isDark = false
}) => {
  const { selectedValues, setParameterValue } = useParameterStore()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [localSelected, setLocalSelected] = useState<string[]>([])
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  
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
  
  // Dropdown pozisyonunu hesapla
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8, // 8px gap
        left: rect.left
      })
    }
  }, [isOpen])
  
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
  
  // Scroll veya resize'da dropdown'u kapat
  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      window.addEventListener('scroll', handleScrollOrResize, true)
      window.addEventListener('resize', handleScrollOrResize)
    }
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isOpen])
  
  // Filtrelenmiş opsiyonlar
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options
    const query = searchQuery.toLowerCase()
    return options.filter(opt => opt.toLowerCase().includes(query))
  }, [options, searchQuery])
  
  // Seçim text'i
  const selectionText = useMemo(() => {
    if (localSelected.length === 0) return 'Tümü'
    if (localSelected.length === 1) return localSelected[0]
    if (localSelected.length === options.length) return 'Tümü'
    return `${localSelected.length} seçili`
  }, [localSelected, options.length])
  
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
  
  // Tümünü Seç
  const selectAll = () => {
    setLocalSelected([...options])
  }
  
  // Temizle
  const clearAll = () => {
    setLocalSelected([])
  }
  
  // Uygula - Store'u güncelle ve dashboard'u yenile
  const applyFilter = () => {
    // Tümü seçili veya hiçbiri seçili değilse ALL olarak işaretle
    if (localSelected.length === 0 || localSelected.length === options.length) {
      setParameterValue(metricId, 'ALL')
    } else {
      // Virgülle ayrılmış string olarak kaydet
      setParameterValue(metricId, localSelected.join(','))
    }
    
    setIsOpen(false)
    
    // Dashboard'u yenile
    if (onSelectionChange) {
      onSelectionChange()
    }
  }
  
  // Aktif filtre var mı?
  const hasActiveFilter = localSelected.length > 0 && localSelected.length < options.length
  
  // Dropdown portal içeriği
  const dropdownContent = isOpen ? createPortal(
    <div 
      ref={dropdownRef}
      onClick={(e) => e.stopPropagation()}
      className={clsx(
        'fixed w-72 rounded-xl shadow-2xl border overflow-hidden',
        isDark ? 'bg-[#1a1d24] border-[#2a2f3a]' : 'bg-white border-gray-200'
      )}
      style={{
        top: dropdownPosition.top,
        left: dropdownPosition.left,
        zIndex: 9999
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
      <div className="max-h-64 overflow-y-auto">
        {filteredOptions.length === 0 ? (
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
            {localSelected.length} / {options.length} seçili
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
      {/* Trigger Button - FilterBar tarzı */}
      <button
        ref={buttonRef}
        onClick={() => { setIsOpen(!isOpen); setSearchQuery('') }}
        className={clsx(
          'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
          hasActiveFilter
            ? 'bg-indigo-500/10 text-indigo-600 border border-indigo-500/30'
            : isDark 
              ? 'bg-[#21262d] text-gray-300 hover:bg-[#2a2f3a] border border-[#2a2f3a]'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
        )}
      >
        <Filter size={16} className={hasActiveFilter ? 'text-indigo-500' : ''} />
        <span className="truncate max-w-[120px]">{title}</span>
        <span className={clsx(
          'text-xs px-2 py-0.5 rounded-full',
          hasActiveFilter
            ? 'bg-indigo-500/20 text-indigo-600'
            : isDark ? 'bg-[#2a2f3a] text-gray-400' : 'bg-gray-200 text-gray-500'
        )}>
          {selectionText}
        </span>
        <ChevronDown size={14} className={clsx(
          'transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown - Portal ile body'ye render edilir */}
      {dropdownContent}
    </div>
  )
}

export default ParameterFilterWidget
