/**
 * ParameterFilterWidget
 * Parametre tipindeki metrikleri combobox olarak render eder
 * 
 * Kullanım:
 * - Dashboard/Analysis sayfalarında parameter_filter widget tipi için kullanılır
 * - Backend'den gelen DISTINCT değerler combobox'ta gösterilir
 * - Seçim yapıldığında parameterStore güncellenir ve dashboard yenilenir
 */

import React, { useMemo } from 'react'
import { Filter, ChevronDown, X } from 'lucide-react'
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
  }
  /** Seçim değiştiğinde çağrılacak callback */
  onSelectionChange?: () => void
  /** Widget boyutları (grid) */
  gridW?: number
  gridH?: number
}

export const ParameterFilterWidget: React.FC<ParameterFilterWidgetProps> = ({
  widgetId,
  metricId,
  title,
  options = [],
  theme,
  onSelectionChange,
  gridW = 4,
  gridH = 2
}) => {
  const { selectedValues, setParameterValue } = useParameterStore()
  
  // Mevcut seçili değer
  const selectedValue = selectedValues[metricId] || 'ALL'
  
  // Seçenekleri hazırla (ALL ekle)
  const selectOptions = useMemo(() => {
    const opts = [{ value: 'ALL', label: 'Tümü' }]
    options.forEach(opt => {
      if (opt && opt !== '') {
        opts.push({ value: opt, label: opt })
      }
    })
    return opts
  }, [options])
  
  // Seçim değiştiğinde
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    setParameterValue(metricId, newValue)
    
    // Parent'a bildir (dashboard yenilemesi için)
    if (onSelectionChange) {
      onSelectionChange()
    }
  }
  
  // Filtreyi temizle
  const handleClear = () => {
    setParameterValue(metricId, 'ALL')
    if (onSelectionChange) {
      onSelectionChange()
    }
  }
  
  // Kompakt mod (küçük widget için)
  const isCompact = gridH <= 2
  
  return (
    <div 
      className={clsx(
        'h-full flex flex-col rounded-xl overflow-hidden',
        theme.cardBg
      )}
    >
      {/* Header */}
      <div className={clsx(
        'flex items-center gap-2 px-3',
        isCompact ? 'py-1.5' : 'py-2',
        'border-b border-gray-200 dark:border-gray-700'
      )}>
        <Filter size={isCompact ? 14 : 16} className="text-indigo-500 flex-shrink-0" />
        <span className={clsx(
          'font-medium truncate',
          isCompact ? 'text-xs' : 'text-sm',
          theme.contentText
        )}>
          {title}
        </span>
        
        {/* Aktif filtre göstergesi */}
        {selectedValue !== 'ALL' && (
          <button
            onClick={handleClear}
            className="ml-auto p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            title="Filtreyi temizle"
          >
            <X size={12} className={theme.contentTextMuted} />
          </button>
        )}
      </div>
      
      {/* Select */}
      <div className={clsx(
        'flex-1 flex items-center px-3',
        isCompact ? 'py-1' : 'py-2'
      )}>
        <div className="relative w-full">
          <select
            value={selectedValue}
            onChange={handleChange}
            className={clsx(
              'w-full appearance-none rounded-lg border transition-all cursor-pointer',
              isCompact ? 'px-2 py-1 pr-6 text-xs' : 'px-3 py-2 pr-8 text-sm',
              theme.inputBg,
              theme.inputText,
              'border-gray-300 dark:border-gray-600',
              'hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800',
              selectedValue !== 'ALL' && 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
            )}
          >
            {selectOptions.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          
          {/* Dropdown arrow */}
          <ChevronDown 
            size={isCompact ? 12 : 16} 
            className={clsx(
              'absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none',
              theme.contentTextMuted
            )} 
          />
        </div>
      </div>
      
      {/* Seçili değer badge (büyük widget için) */}
      {!isCompact && selectedValue !== 'ALL' && (
        <div className="px-3 pb-2">
          <span className={clsx(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
            'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
          )}>
            <Filter size={10} />
            {selectedValue}
          </span>
        </div>
      )}
    </div>
  )
}

export default ParameterFilterWidget
