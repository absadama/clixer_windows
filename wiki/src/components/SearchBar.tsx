import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, X, FileText, ArrowRight } from 'lucide-react'
import clsx from 'clsx'
import { useLanguage } from '../hooks/useLanguage'
import { searchArticles } from '../utils/searchIndex'
import type { Article } from '../types/article'

interface SearchBarProps {
  compact?: boolean
}

export default function SearchBar({ compact = false }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Article[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { t, language } = useLanguage()

  useEffect(() => {
    if (query.length >= 2) {
      const searchResults = searchArticles(query, language)
      setResults(searchResults.slice(0, 5))
      setIsOpen(true)
      setSelectedIndex(0)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [query, language])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[selectedIndex]) {
        navigateToArticle(results[selectedIndex])
      } else if (query.length >= 2) {
        navigate(`/search?q=${encodeURIComponent(query)}`)
        setIsOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const navigateToArticle = (article: Article) => {
    navigate(`/${article.category}/${article.slug}`)
    setIsOpen(false)
    setQuery('')
  }

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      <div className={clsx(
        'relative flex items-center',
        compact ? 'w-full' : ''
      )}>
        <Search className="absolute left-3 w-4 h-4 text-gray-500" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={t('Ara... (Ctrl+K)', 'Search... (Ctrl+K)')}
          className={clsx(
            'w-full bg-dark-bg border border-dark-border rounded-xl',
            'pl-10 pr-10 py-2.5 text-sm',
            'placeholder-gray-500 text-white',
            'focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
            'transition-colors'
          )}
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-1 hover:bg-dark-hover rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-xl shadow-xl overflow-hidden z-50">
          {results.map((article, index) => (
            <button
              key={article.id}
              onClick={() => navigateToArticle(article)}
              className={clsx(
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                index === selectedIndex 
                  ? 'bg-primary-500/20 text-white' 
                  : 'text-gray-300 hover:bg-dark-hover'
              )}
            >
              <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{article.title}</p>
                <p className="text-xs text-gray-500 truncate">{article.categoryLabel}</p>
              </div>
              <ArrowRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
            </button>
          ))}
          
          {/* View all results */}
          <button
            onClick={() => {
              navigate(`/search?q=${encodeURIComponent(query)}`)
              setIsOpen(false)
              setQuery('')
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm text-primary-400 hover:bg-dark-hover border-t border-dark-border"
          >
            {t('Tüm sonuçları gör', 'View all results')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* No results */}
      {isOpen && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-card border border-dark-border rounded-xl shadow-xl p-4 z-50">
          <p className="text-center text-gray-500">
            {t('Sonuç bulunamadı', 'No results found')}
          </p>
        </div>
      )}
    </div>
  )
}
