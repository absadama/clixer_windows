/**
 * Clixer - Search Results Component
 * Kategorize edilmiş arama sonuçları listesi
 * CommandPalette'in içinde veya standalone kullanılabilir
 */

import { Fragment } from 'react'
import clsx from 'clsx'
import {
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
  BarChart3,
  ChevronRight
} from 'lucide-react'
import { SearchItem, SearchItemType, categoryLabels } from '../../stores/searchStore'

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

// Kategori renkleri
const categoryColors: Record<SearchItemType, { bg: string; text: string; darkBg: string; darkText: string }> = {
  page: { bg: 'bg-blue-50', text: 'text-blue-600', darkBg: 'bg-blue-500/10', darkText: 'text-blue-400' },
  tab: { bg: 'bg-purple-50', text: 'text-purple-600', darkBg: 'bg-purple-500/10', darkText: 'text-purple-400' },
  setting: { bg: 'bg-slate-50', text: 'text-slate-600', darkBg: 'bg-slate-500/10', darkText: 'text-slate-400' },
  command: { bg: 'bg-amber-50', text: 'text-amber-600', darkBg: 'bg-amber-500/10', darkText: 'text-amber-400' },
  metric: { bg: 'bg-emerald-50', text: 'text-emerald-600', darkBg: 'bg-emerald-500/10', darkText: 'text-emerald-400' },
  store: { bg: 'bg-rose-50', text: 'text-rose-600', darkBg: 'bg-rose-500/10', darkText: 'text-rose-400' },
  user: { bg: 'bg-indigo-50', text: 'text-indigo-600', darkBg: 'bg-indigo-500/10', darkText: 'text-indigo-400' },
  dashboard: { bg: 'bg-cyan-50', text: 'text-cyan-600', darkBg: 'bg-cyan-500/10', darkText: 'text-cyan-400' },
  dataset: { bg: 'bg-orange-50', text: 'text-orange-600', darkBg: 'bg-orange-500/10', darkText: 'text-orange-400' },
  connection: { bg: 'bg-teal-50', text: 'text-teal-600', darkBg: 'bg-teal-500/10', darkText: 'text-teal-400' },
  region: { bg: 'bg-lime-50', text: 'text-lime-600', darkBg: 'bg-lime-500/10', darkText: 'text-lime-400' }
}

interface SearchResultsProps {
  results: SearchItem[]
  selectedIndex: number
  onSelect: (item: SearchItem) => void
  onHover?: (index: number) => void
  isDark?: boolean
  showCategories?: boolean
  maxHeight?: string
  emptyMessage?: string
  className?: string
}

export function SearchResults({
  results,
  selectedIndex,
  onSelect,
  onHover,
  isDark = false,
  showCategories = true,
  maxHeight = '400px',
  emptyMessage = 'Sonuç bulunamadı',
  className
}: SearchResultsProps) {
  
  // Group results by type
  const groupedResults = results.reduce((acc, item) => {
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
    return IconComponent ? <IconComponent size={16} /> : null
  }

  if (results.length === 0) {
    return (
      <div className={clsx(
        'flex flex-col items-center justify-center py-8',
        isDark ? 'text-slate-500' : 'text-slate-400',
        className
      )}>
        <FileText size={32} className="mb-2 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div 
      className={clsx('overflow-y-auto', className)}
      style={{ maxHeight }}
    >
      {showCategories ? (
        // Grouped view
        Object.entries(groupedResults).map(([type, items]) => {
          const colors = categoryColors[type as SearchItemType]
          
          return (
            <div key={type} className="mb-2">
              {/* Category header */}
              <div className={clsx(
                'sticky top-0 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider flex items-center gap-2 backdrop-blur-sm z-10',
                isDark 
                  ? 'bg-[#1a1e26]/90 text-slate-500 border-b border-[#2F3542]/50' 
                  : 'bg-white/90 text-slate-400 border-b border-slate-100'
              )}>
                {React.createElement(categoryDefaultIcons[type as SearchItemType], { size: 12 })}
                {categoryLabels[type as SearchItemType] || type}
                <span className={clsx(
                  'ml-auto px-1.5 py-0.5 rounded text-[10px] font-medium',
                  isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
                )}>
                  {items.length}
                </span>
              </div>
              
              {/* Items */}
              {items.map((item, itemIndex) => {
                const flatIndex = getFlatIndex(type as SearchItemType, itemIndex)
                const isSelected = flatIndex === selectedIndex
                
                return (
                  <SearchResultItem
                    key={item.id}
                    item={item}
                    isSelected={isSelected}
                    isDark={isDark}
                    onSelect={() => onSelect(item)}
                    onHover={() => onHover?.(flatIndex)}
                    renderIcon={renderIcon}
                    colors={colors}
                  />
                )
              })}
            </div>
          )
        })
      ) : (
        // Flat view
        results.map((item, index) => {
          const isSelected = index === selectedIndex
          const colors = categoryColors[item.type]
          
          return (
            <SearchResultItem
              key={item.id}
              item={item}
              isSelected={isSelected}
              isDark={isDark}
              onSelect={() => onSelect(item)}
              onHover={() => onHover?.(index)}
              renderIcon={renderIcon}
              colors={colors}
              showType
            />
          )
        })
      )}
    </div>
  )
}

interface SearchResultItemProps {
  item: SearchItem
  isSelected: boolean
  isDark: boolean
  onSelect: () => void
  onHover: () => void
  renderIcon: (item: SearchItem) => React.ReactNode
  colors: { bg: string; text: string; darkBg: string; darkText: string }
  showType?: boolean
}

function SearchResultItem({
  item,
  isSelected,
  isDark,
  onSelect,
  onHover,
  renderIcon,
  colors,
  showType = false
}: SearchResultItemProps) {
  return (
    <button
      onClick={onSelect}
      onMouseEnter={onHover}
      data-selected={isSelected}
      className={clsx(
        'w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-150',
        isSelected
          ? isDark 
            ? 'bg-[#00CFDE]/10 text-[#00CFDE]' 
            : 'bg-indigo-50 text-indigo-700'
          : isDark 
            ? 'text-slate-300 hover:bg-[#21252E]' 
            : 'text-slate-700 hover:bg-slate-50'
      )}
    >
      {/* Icon */}
      <span className={clsx(
        'flex-shrink-0 p-2 rounded-lg transition-colors',
        isSelected
          ? isDark 
            ? 'bg-[#00CFDE]/20' 
            : 'bg-indigo-100'
          : isDark 
            ? colors.darkBg 
            : colors.bg,
        isSelected
          ? isDark 
            ? 'text-[#00CFDE]' 
            : 'text-indigo-600'
          : isDark 
            ? colors.darkText 
            : colors.text
      )}>
        {renderIcon(item)}
      </span>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{item.label}</span>
          {showType && (
            <span className={clsx(
              'flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium uppercase',
              isDark ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'
            )}>
              {categoryLabels[item.type]}
            </span>
          )}
        </div>
        {(item.description || item.parent) && (
          <div className={clsx(
            'text-xs truncate mt-0.5 flex items-center gap-1',
            isDark ? 'text-slate-500' : 'text-slate-400'
          )}>
            {item.parent && (
              <>
                <span>{item.parent}</span>
                <ChevronRight size={10} />
              </>
            )}
            {item.description && <span>{item.description}</span>}
          </div>
        )}
      </div>
      
      {/* Navigation indicator */}
      <ChevronRight 
        size={16} 
        className={clsx(
          'flex-shrink-0 transition-opacity',
          isSelected ? 'opacity-100' : 'opacity-0'
        )} 
      />
    </button>
  )
}

// Import React for createElement
import React from 'react'

export default SearchResults
