/**
 * iOS-style Picker Wheel Component
 * iPhone'daki tarih seçici gibi alttan dönen seçim alanı
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import clsx from 'clsx'
import { Check, X, Search } from 'lucide-react'

interface PickerOption {
  id: string
  label: string
  sublabel?: string
}

interface IOSPickerProps {
  isOpen: boolean
  onClose: () => void
  title: string
  options: PickerOption[]
  selectedIds: string[]
  onSelect: (ids: string[]) => void
  multiSelect?: boolean
  accentColor?: string
  showSearch?: boolean // Arama özelliği
  searchPlaceholder?: string
}

export default function IOSPicker({
  isOpen,
  onClose,
  title,
  options,
  selectedIds,
  onSelect,
  multiSelect = true,
  accentColor = '#6366F1',
  showSearch = false,
  searchPlaceholder = 'Ara...'
}: IOSPickerProps) {
  const [localSelected, setLocalSelected] = useState<string[]>(selectedIds)
  const [searchQuery, setSearchQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  
  // Arama sonuçları
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options
    const query = searchQuery.toLowerCase().trim()
    return options.filter(opt => 
      opt.label.toLowerCase().includes(query) ||
      opt.sublabel?.toLowerCase().includes(query)
    )
  }, [options, searchQuery])
  
  // Senkronize et
  useEffect(() => {
    if (isOpen) {
      setLocalSelected(selectedIds)
      setSearchQuery('')
    }
  }, [isOpen, selectedIds])

  const handleSelect = (id: string) => {
    if (multiSelect) {
      if (localSelected.includes(id)) {
        setLocalSelected(localSelected.filter(s => s !== id))
      } else {
        setLocalSelected([...localSelected, id])
      }
    } else {
      setLocalSelected([id])
    }
  }

  const handleConfirm = () => {
    onSelect(localSelected)
    onClose()
  }

  const handleSelectAll = () => {
    setLocalSelected(options.map(o => o.id))
  }

  const handleClear = () => {
    setLocalSelected([])
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 z-[60] transition-opacity"
        onClick={onClose}
      />
      
      {/* Picker Panel */}
      <div className="fixed inset-x-0 bottom-0 z-[60] animate-slide-up">
        <div className="bg-[#1C1C1E] rounded-t-[20px] overflow-hidden max-h-[70vh] flex flex-col">
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <button 
              onClick={onClose}
              className="text-[#FF453A] text-[17px] font-medium"
            >
              İptal
            </button>
            <span className="text-white text-[17px] font-semibold">{title}</span>
            <button 
              onClick={handleConfirm}
              className="text-[17px] font-semibold"
              style={{ color: accentColor }}
            >
              Tamam
            </button>
          </div>

          {/* Search Input */}
          {showSearch && (
            <div className="px-3 py-2 border-b border-white/10">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-white/10 text-white text-[15px] placeholder-white/40 outline-none focus:ring-2 focus:ring-white/20"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {multiSelect && (
            <div className="flex gap-2 px-4 py-2 border-b border-white/10">
              <button
                onClick={handleSelectAll}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-white/10 text-white"
              >
                Tümünü Seç
              </button>
              <button
                onClick={handleClear}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium bg-white/10 text-white"
              >
                Temizle
              </button>
            </div>
          )}

          {/* Options List - iOS Style */}
          <div 
            ref={listRef}
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-8 text-center text-white/50 text-[15px]">
                {searchQuery ? 'Sonuç bulunamadı' : 'Seçenek yok'}
              </div>
            ) : (
              filteredOptions.map((option, idx) => {
                const isSelected = localSelected.includes(option.id)
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className={clsx(
                      'w-full flex items-center justify-between px-4 py-3.5',
                      'transition-colors active:bg-white/10',
                      idx !== filteredOptions.length - 1 && 'border-b border-white/5'
                    )}
                  >
                    <div className="text-left">
                      <div className={clsx(
                        'text-[17px]',
                        isSelected ? 'text-white font-medium' : 'text-white/80'
                      )}>
                        {option.label}
                      </div>
                      {option.sublabel && (
                        <div className="text-[13px] text-white/40 mt-0.5">
                          {option.sublabel}
                        </div>
                      )}
                    </div>
                    
                    {/* Checkmark */}
                    <div className={clsx(
                      'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                      isSelected 
                        ? 'bg-white' 
                        : 'border-2 border-white/30'
                    )}
                    style={isSelected ? { backgroundColor: accentColor } : {}}
                    >
                      {isSelected && <Check size={14} className="text-white" strokeWidth={3} />}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Selected Count */}
          <div className="px-4 py-3 border-t border-white/10 bg-black/20">
            <div className="text-center text-[13px] text-white/50">
              {localSelected.length === 0 
                ? 'Seçim yapılmadı' 
                : localSelected.length === options.length 
                  ? 'Tümü seçili' 
                  : `${localSelected.length} / ${options.length} seçili`}
            </div>
          </div>
        </div>
      </div>

      {/* Animation Style */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  )
}
