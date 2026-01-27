import FlexSearch from 'flexsearch'
import type { Article, Language } from '../types/article'
import { getAllArticles } from '../content'

// FlexSearch index for Turkish
const indexTr = new FlexSearch.Document({
  document: {
    id: 'id',
    index: ['title', 'content', 'excerpt'],
    store: ['id', 'slug', 'title', 'excerpt', 'category', 'categoryLabel', 'readingTime', 'images']
  },
  tokenize: 'forward',
  cache: true
})

// FlexSearch index for English
const indexEn = new FlexSearch.Document({
  document: {
    id: 'id',
    index: ['title', 'content', 'excerpt'],
    store: ['id', 'slug', 'title', 'excerpt', 'category', 'categoryLabel', 'readingTime', 'images']
  },
  tokenize: 'forward',
  cache: true
})

let isIndexed = { tr: false, en: false }

// Build search index
export function buildSearchIndex(language: Language): void {
  if (isIndexed[language]) return

  const articles = getAllArticles(language)
  const index = language === 'tr' ? indexTr : indexEn

  articles.forEach(article => {
    index.add(article)
  })

  isIndexed[language] = true
}

// Search articles
export function searchArticles(query: string, language: Language): Article[] {
  buildSearchIndex(language)
  
  const index = language === 'tr' ? indexTr : indexEn
  const results = index.search(query, {
    limit: 20,
    enrich: true
  })

  // Flatten and deduplicate results
  const articleMap = new Map<string, Article>()
  
  results.forEach(result => {
    if (result.result) {
      result.result.forEach((item: any) => {
        if (item.doc && !articleMap.has(item.doc.id)) {
          articleMap.set(item.doc.id, item.doc as Article)
        }
      })
    }
  })

  return Array.from(articleMap.values())
}

// Rebuild index (call when language changes or content updates)
export function rebuildSearchIndex(language: Language): void {
  isIndexed[language] = false
  buildSearchIndex(language)
}
