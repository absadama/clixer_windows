import { useState, useEffect, useCallback } from 'react'
import { searchArticles, buildSearchIndex } from '../utils/searchIndex'
import { useLanguage } from './useLanguage'
import type { Article } from '../types/article'

export function useSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Article[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const { language } = useLanguage()

  // Build index on mount
  useEffect(() => {
    buildSearchIndex(language)
  }, [language])

  // Search with debounce
  useEffect(() => {
    if (query.length < 2) {
      setResults([])
      return
    }

    setIsSearching(true)
    const timer = setTimeout(() => {
      const searchResults = searchArticles(query, language)
      setResults(searchResults)
      setIsSearching(false)
    }, 150)

    return () => clearTimeout(timer)
  }, [query, language])

  const search = useCallback((q: string) => {
    setQuery(q)
  }, [])

  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
  }, [])

  return {
    query,
    results,
    isSearching,
    search,
    clearSearch,
    setQuery
  }
}
