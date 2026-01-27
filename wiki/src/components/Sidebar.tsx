import { NavLink, useLocation } from 'react-router-dom'
import { 
  BookOpen, 
  Palette, 
  BarChart3, 
  Database, 
  Settings, 
  Zap,
  ChevronRight,
  Home
} from 'lucide-react'
import clsx from 'clsx'
import { useLanguage } from '../hooks/useLanguage'

interface SidebarProps {
  onNavigate?: () => void
}

const categories = [
  { 
    id: 'getting-started', 
    labelTr: 'Başlangıç', 
    labelEn: 'Getting Started',
    icon: BookOpen,
    color: 'text-green-400'
  },
  { 
    id: 'designer', 
    labelTr: 'Tasarım Stüdyosu', 
    labelEn: 'Design Studio',
    icon: Palette,
    color: 'text-purple-400'
  },
  { 
    id: 'metrics', 
    labelTr: 'Metrikler', 
    labelEn: 'Metrics',
    icon: BarChart3,
    color: 'text-blue-400'
  },
  { 
    id: 'data', 
    labelTr: 'Veri Yönetimi', 
    labelEn: 'Data Management',
    icon: Database,
    color: 'text-orange-400'
  },
  { 
    id: 'admin', 
    labelTr: 'Yönetim Paneli', 
    labelEn: 'Admin Panel',
    icon: Settings,
    color: 'text-red-400'
  },
  { 
    id: 'advanced', 
    labelTr: 'İleri Düzey', 
    labelEn: 'Advanced',
    icon: Zap,
    color: 'text-yellow-400'
  },
]

export default function Sidebar({ onNavigate }: SidebarProps) {
  const location = useLocation()
  const { language } = useLanguage()

  return (
    <nav className="px-3 py-2">
      {/* Home link */}
      <NavLink
        to="/"
        onClick={onNavigate}
        className={({ isActive }) => clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 transition-colors',
          isActive 
            ? 'bg-primary-500/20 text-primary-400' 
            : 'text-gray-400 hover:bg-dark-hover hover:text-white'
        )}
      >
        <Home className="w-5 h-5" />
        <span className="font-medium">
          {language === 'tr' ? 'Ana Sayfa' : 'Home'}
        </span>
      </NavLink>

      {/* Divider */}
      <div className="h-px bg-dark-border my-3" />

      {/* Categories */}
      <div className="space-y-1">
        <p className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {language === 'tr' ? 'Kategoriler' : 'Categories'}
        </p>
        
        {categories.map((category) => {
          const Icon = category.icon
          const isActive = location.pathname.startsWith(`/${category.id}`)
          
          return (
            <NavLink
              key={category.id}
              to={`/${category.id}`}
              onClick={onNavigate}
              className={clsx(
                'flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors group',
                isActive 
                  ? 'bg-dark-hover text-white' 
                  : 'text-gray-400 hover:bg-dark-hover hover:text-white'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={clsx('w-5 h-5', category.color)} />
                <span className="font-medium">
                  {language === 'tr' ? category.labelTr : category.labelEn}
                </span>
              </div>
              <ChevronRight className={clsx(
                'w-4 h-4 transition-transform',
                isActive ? 'rotate-90' : 'group-hover:translate-x-1'
              )} />
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
