import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  const { t } = useLanguage()

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-400 mb-6">
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-white transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>{t('Ana Sayfa', 'Home')}</span>
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4" />
          {item.href ? (
            <Link 
              to={item.href}
              className="hover:text-white transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-white">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
