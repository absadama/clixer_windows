/**
 * Clixer - Command Palette
 * iPhone Spotlight benzeri akıllı arama modal
 * Cmd+K / Ctrl+K ile açılır
 */

import { useEffect, useRef, useCallback, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Transition } from '@headlessui/react'
import clsx from 'clsx'
import {
  Search,
  X,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  // İkonlar
  LayoutDashboard,
  Wallet,
  ShieldAlert,
  PieChart,
  Store,
  Palette,
  Database,
  Table2,
  Shield,
  User,
  Settings,
  Lock,
  Users,
  UserCog,
  Network,
  HardDrive,
  Tag,
  Activity,
  FolderTree,
  Plug,
  FileSpreadsheet,
  Code,
  RefreshCw,
  Gauge,
  HeartPulse,
  LogOut,
  Moon,
  Sun,
  Building,
  Globe,
  Maximize,
  FileText,
  Layers,
  Zap,
  BarChart3
} from 'lucide-react'
import { useSearchStore, categoryLabels, SearchItem, SearchItemType } from '../../stores/searchStore'
import { useAuthStore } from '../../stores/authStore'
import { useTheme } from '../Layout'

// İkon mapping
const iconMap: Record<string, React.ComponentType<any>> = {
  LayoutDashboard,
  Wallet,
  ShieldAlert,
  PieChart,
  Store,
  Palette,
  Database,
  Table2,
  Shield,
  User,
  Settings,
  Lock,
  Users,
  UserCog,
  Network,
  HardDrive,
  Tag,
  Activity,
  FolderTree,
  Plug,
  FileSpreadsheet,
  Code,
  RefreshCw,
  Gauge,
  HeartPulse,
  LogOut,
  Moon,
  Sun,
  Building,
  Globe,
  Maximize,
  FileText,
  Layers,
  Zap,
  BarChart3
}

// Kategori varsayılan ikonları
const categoryDefaultIcons: Record<SearchItemType, React.ComponentType<any>> = {
  page: FileText,
  tab: Layers,
  setting: Settings,
  command: Zap,
  metric: BarChart3,
  store: Store,
  user: Users,
  dashboard: LayoutDashboard,
  dataset: FileSpreadsheet,
  connection: Plug,
  region: Building
}

export function CommandPalette() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  
  const { theme, isDark } = useTheme()
  const { accessToken } = useAuthStore()
  
  const {
    query,
    isOpen,
    selectedIndex,
    loading,
    staticResults,
    backendResults,
    setOpen,
    search,
    moveSelection,
    executeSelected,
    executeItem,
    initializeIndex
  } = useSearchStore()

  // Initialize index on mount with accessToken
  useEffect(() => {
    if (accessToken) {
      initializeIndex(accessToken)
    }
  }, [initializeIndex, accessToken])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, setOpen])

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    search(e.target.value, accessToken || undefined)
  }, [search, accessToken])

  // Handle keyboard navigation in modal
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault()
        moveSelection('up')
        break
      case 'ArrowDown':
        e.preventDefault()
        moveSelection('down')
        break
      case 'Enter':
        e.preventDefault()
        executeSelected(navigate)
        break
      case 'Tab':
        e.preventDefault()
        moveSelection(e.shiftKey ? 'up' : 'down')
        break
    }
  }, [moveSelection, executeSelected, navigate])

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.querySelector('[data-selected="true"]')
      if (selected) {
        selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [selectedIndex])

  // Combine results
  const allResults = [...staticResults, ...backendResults]
  
  // Group results by type
  const groupedResults = allResults.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = []
    }
    acc[item.type].push(item)
    return acc
  }, {} as Record<SearchItemType, SearchItem[]>)

  // Calculate flat index for selection
  const getFlatIndex = (type: SearchItemType, itemIndex: number): number => {
    let flatIndex = 0
    for (const [t, items] of Object.entries(groupedResults)) {
      if (t === type) {
        return flatIndex + itemIndex
      }
      flatIndex += items.length
    }
    return flatIndex
  }

  // Render icon
  const renderIcon = (item: SearchItem) => {
    const IconComponent = item.icon ? iconMap[item.icon] : categoryDefaultIcons[item.type]
    return IconComponent ? <IconComponent size={18} /> : null
  }

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog 
        as="div" 
        className="relative z-50" 
        onClose={() => setOpen(false)}
      >
        {/* Backdrop */}
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        {/* Modal container */}
        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-start justify-center p-4 pt-[15vh]">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95 translate-y-4"
              enterTo="opacity-100 scale-100 translate-y-0"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100 translate-y-0"
              leaveTo="opacity-0 scale-95 translate-y-4"
            >
              <Dialog.Panel 
                className={clsx(
                  'w-full max-w-2xl transform overflow-hidden rounded-2xl shadow-2xl transition-all',
                  isDark 
                    ? 'bg-[#1a1e26] border border-[#2F3542]' 
                    : 'bg-white border border-slate-200'
                )}
                onKeyDown={handleKeyDown}
              >
                {/* Search input */}
                <div className={clsx(
                  'flex items-center gap-3 px-4 py-4 border-b',
                  isDark ? 'border-[#2F3542]' : 'border-slate-200'
                )}>
                  <Search 
                    size={20} 
                    className={isDark ? 'text-[#00CFDE]' : 'text-indigo-500'} 
                  />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    placeholder="Sayfa, metrik veya komut ara..."
                    className={clsx(
                      'flex-1 bg-transparent text-base outline-none',
                      isDark 
                        ? 'text-white placeholder:text-slate-500' 
                        : 'text-slate-900 placeholder:text-slate-400'
                    )}
                  />
                  {loading && (
                    <Loader2 
                      size={18} 
                      className={clsx(
                        'animate-spin',
                        isDark ? 'text-[#00CFDE]' : 'text-indigo-500'
                      )} 
                    />
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className={clsx(
                      'p-1.5 rounded-lg transition-colors',
                      isDark 
                        ? 'hover:bg-[#2F3542] text-slate-400' 
                        : 'hover:bg-slate-100 text-slate-500'
                    )}
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Results */}
                <div 
                  ref={resultsRef}
                  className={clsx(
                    'max-h-[50vh] overflow-y-auto',
                    isDark ? 'scrollbar-dark' : 'scrollbar-light'
                  )}
                >
                  {query.length < 2 ? (
                    // Empty state - hints
                    <div className={clsx(
                      'px-4 py-8 text-center',
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    )}>
                      <Search size={32} className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm">Aramaya başlamak için en az 2 karakter yazın</p>
                      <p className="text-xs mt-2 opacity-60">
                        Sayfa, sekme, metrik veya komut arayabilirsiniz
                      </p>
                    </div>
                  ) : allResults.length === 0 ? (
                    // No results
                    <div className={clsx(
                      'px-4 py-8 text-center',
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    )}>
                      <Search size={32} className="mx-auto mb-3 opacity-40" />
                      <p className="text-sm">"{query}" için sonuç bulunamadı</p>
                      <p className="text-xs mt-2 opacity-60">
                        Farklı anahtar kelimeler deneyin
                      </p>
                    </div>
                  ) : (
                    // Grouped results
                    <div className="py-2">
                      {Object.entries(groupedResults).map(([type, items]) => (
                        <div key={type}>
                          {/* Category header */}
                          <div className={clsx(
                            'px-4 py-2 text-xs font-semibold uppercase tracking-wider',
                            isDark ? 'text-slate-500' : 'text-slate-400'
                          )}>
                            {categoryLabels[type as SearchItemType] || type}
                          </div>
                          
                          {/* Items */}
                          {items.map((item, itemIndex) => {
                            const flatIndex = getFlatIndex(type as SearchItemType, itemIndex)
                            const isSelected = flatIndex === selectedIndex
                            
                            return (
                              <button
                                key={item.id}
                                data-selected={isSelected}
                                onClick={() => executeItem(item, navigate)}
                                className={clsx(
                                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                                  isSelected
                                    ? isDark 
                                      ? 'bg-[#00CFDE]/10 text-[#00CFDE]' 
                                      : 'bg-indigo-50 text-indigo-600'
                                    : isDark 
                                      ? 'text-slate-300 hover:bg-[#21252E]' 
                                      : 'text-slate-700 hover:bg-slate-50'
                                )}
                              >
                                {/* Icon */}
                                <span className={clsx(
                                  'flex-shrink-0 p-2 rounded-lg',
                                  isSelected
                                    ? isDark 
                                      ? 'bg-[#00CFDE]/20' 
                                      : 'bg-indigo-100'
                                    : isDark 
                                      ? 'bg-[#21252E]' 
                                      : 'bg-slate-100'
                                )}>
                                  {renderIcon(item)}
                                </span>
                                
                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">
                                    {item.label}
                                  </div>
                                  {(item.description || item.parent) && (
                                    <div className={clsx(
                                      'text-xs truncate mt-0.5',
                                      isDark ? 'text-slate-500' : 'text-slate-400'
                                    )}>
                                      {item.parent && <span>{item.parent} → </span>}
                                      {item.description}
                                    </div>
                                  )}
                                </div>
                                
                                {/* Enter hint for selected */}
                                {isSelected && (
                                  <span className={clsx(
                                    'flex-shrink-0 text-xs px-2 py-1 rounded',
                                    isDark 
                                      ? 'bg-[#00CFDE]/20 text-[#00CFDE]' 
                                      : 'bg-indigo-100 text-indigo-600'
                                  )}>
                                    Enter
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer - keyboard hints */}
                <div className={clsx(
                  'flex items-center justify-between px-4 py-3 border-t text-xs',
                  isDark 
                    ? 'border-[#2F3542] text-slate-500' 
                    : 'border-slate-200 text-slate-400'
                )}>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <kbd className={clsx(
                        'px-1.5 py-0.5 rounded font-mono',
                        isDark ? 'bg-[#21252E]' : 'bg-slate-100'
                      )}>
                        <ArrowUp size={12} />
                      </kbd>
                      <kbd className={clsx(
                        'px-1.5 py-0.5 rounded font-mono',
                        isDark ? 'bg-[#21252E]' : 'bg-slate-100'
                      )}>
                        <ArrowDown size={12} />
                      </kbd>
                      <span className="ml-1">gezin</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className={clsx(
                        'px-1.5 py-0.5 rounded font-mono',
                        isDark ? 'bg-[#21252E]' : 'bg-slate-100'
                      )}>
                        <CornerDownLeft size={12} />
                      </kbd>
                      <span className="ml-1">seç</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <kbd className={clsx(
                        'px-1.5 py-0.5 rounded font-mono',
                        isDark ? 'bg-[#21252E]' : 'bg-slate-100'
                      )}>
                        esc
                      </kbd>
                      <span className="ml-1">kapat</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <span>Hızlı aç:</span>
                    <kbd className={clsx(
                      'px-1.5 py-0.5 rounded font-mono',
                      isDark ? 'bg-[#21252E]' : 'bg-slate-100'
                    )}>
                      ⌘K
                    </kbd>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}

export default CommandPalette
