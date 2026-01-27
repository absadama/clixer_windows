import type { Article, Language } from '../types/article'

// Import all articles
import { articlesTr as gettingStartedTr } from './tr/getting-started'
import { articlesEn as gettingStartedEn } from './en/getting-started'
import { articlesTr as designerTr } from './tr/designer'
import { articlesEn as designerEn } from './en/designer'
import { articlesTr as metricsTr } from './tr/metrics'
import { articlesEn as metricsEn } from './en/metrics'
import { articlesTr as dataTr } from './tr/data'
import { articlesEn as dataEn } from './en/data'
import { articlesTr as adminTr } from './tr/admin'
import { articlesEn as adminEn } from './en/admin'
import { articlesTr as advancedTr } from './tr/advanced'
import { articlesEn as advancedEn } from './en/advanced'

// Combine all articles by language
const allArticlesTr: Article[] = [
  ...gettingStartedTr,
  ...designerTr,
  ...metricsTr,
  ...dataTr,
  ...adminTr,
  ...advancedTr
]

const allArticlesEn: Article[] = [
  ...gettingStartedEn,
  ...designerEn,
  ...metricsEn,
  ...dataEn,
  ...adminEn,
  ...advancedEn
]

// Get all articles for a language
export function getAllArticles(language: Language): Article[] {
  return language === 'tr' ? allArticlesTr : allArticlesEn
}

// Get articles by category
export function getArticlesByCategory(category: string, language: Language): Article[] {
  const articles = getAllArticles(language)
  return articles
    .filter(a => a.category === category)
    .sort((a, b) => a.order - b.order)
}

// Get article by slug
export function getArticleBySlug(category: string, slug: string, language: Language): Article | null {
  const articles = getAllArticles(language)
  return articles.find(a => a.category === category && a.slug === slug) || null
}

// Get article by ID
export function getArticleById(id: string, language: Language): Article | null {
  const articles = getAllArticles(language)
  return articles.find(a => a.id === id) || null
}

// Get popular articles (for homepage)
export function getPopularArticles(language: Language, limit: number = 4): Article[] {
  const popularIds = [
    'getting-started-hizli-baslangic',
    'metrics-yeni-metrik-olusturma',
    'data-dataset-olusturma',
    'designer-widget-ekleme'
  ]
  
  const articles = getAllArticles(language)
  return popularIds
    .map(id => articles.find(a => a.id === id))
    .filter((a): a is Article => a !== null)
    .slice(0, limit)
}

// Get category article count
export function getCategoryArticleCount(category: string, language: Language): number {
  return getArticlesByCategory(category, language).length
}
