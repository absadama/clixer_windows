import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, X, GraduationCap, ExternalLink } from 'lucide-react'
import clsx from 'clsx'
import Sidebar from './Sidebar'
import SearchBar from './SearchBar'
import LanguageSwitch from './LanguageSwitch'
import { useLanguage } from '../hooks/useLanguage'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { t } = useLanguage()

  // Dinamik URL - localhost'ta ise localhost, değilse production URL
  const getClixerAppUrl = () => {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:3000'
      }
      // Production'da aynı domain'in root'una yönlendir (/edu'dan /'a)
      return window.location.origin
    }
    return '/'
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed top-0 left-0 z-50 h-full w-72 bg-dark-card border-r border-dark-border',
        'transform transition-transform duration-200 ease-in-out',
        'lg:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-4 border-b border-dark-border">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-white">Clixer</h1>
                <p className="text-xs text-gray-400">{t('Eğitim Merkezi', 'Education Center')}</p>
              </div>
            </Link>
            <button 
              className="lg:hidden p-2 hover:bg-dark-hover rounded-lg"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4">
            <SearchBar />
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto">
            <Sidebar onNavigate={() => setSidebarOpen(false)} />
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-dark-border">
            <a 
              href={getClixerAppUrl()}
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {t('Clixer Uygulamasına Git', 'Go to Clixer App')}
            </a>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-72">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-dark-bg/80 backdrop-blur-lg border-b border-dark-border">
          <div className="flex items-center justify-between px-4 py-3">
            <button 
              className="lg:hidden p-2 hover:bg-dark-hover rounded-lg"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            
            <div className="flex-1 lg:hidden mx-4">
              <SearchBar compact />
            </div>

            <div className="flex items-center gap-4">
              <LanguageSwitch />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-dark-border p-6 text-center text-sm text-gray-500">
          <p>© 2026 Clixer. {t('Tüm hakları saklıdır.', 'All rights reserved.')}</p>
        </footer>
      </div>
    </div>
  )
}
