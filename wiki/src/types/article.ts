export interface ArticleImage {
  src: string
  alt: string
  caption?: string
}

export interface Article {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string
  category: string
  categoryLabel: string
  tags: string[]
  images: ArticleImage[]
  relatedArticles: string[]
  lastUpdated: string
  readingTime: number
  order: number
}

export interface Category {
  id: string
  label: string
  labelEn: string
  description: string
  descriptionEn: string
  icon: string
  articleCount: number
  order: number
}

export type Language = 'tr' | 'en'
