import { Link } from 'react-router-dom'
import { Clock, ArrowRight } from 'lucide-react'
import type { Article } from '../types/article'
import { useLanguage } from '../hooks/useLanguage'

interface ArticleCardProps {
  article: Article
  compact?: boolean
}

export default function ArticleCard({ article, compact = false }: ArticleCardProps) {
  const { t } = useLanguage()

  if (compact) {
    return (
      <Link
        to={`/${article.category}/${article.slug}`}
        className="flex items-center gap-3 p-3 bg-dark-card border border-dark-border rounded-xl hover:border-primary-500/50 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-white truncate group-hover:text-primary-400 transition-colors">
            {article.title}
          </h3>
          <p className="text-sm text-gray-500 truncate">{article.excerpt}</p>
        </div>
        <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
      </Link>
    )
  }

  return (
    <Link
      to={`/${article.category}/${article.slug}`}
      className="block bg-dark-card border border-dark-border rounded-2xl p-6 hover:border-primary-500/50 transition-all card-hover group"
    >
      {/* Thumbnail placeholder */}
      {article.images.length > 0 && (
        <div className="aspect-video bg-dark-bg rounded-xl mb-4 overflow-hidden">
          <img 
            src={article.images[0].src} 
            alt={article.images[0].alt}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-primary-500/20 text-primary-400 text-xs font-medium rounded-lg">
            {article.categoryLabel}
          </span>
        </div>

        <h3 className="text-lg font-semibold text-white group-hover:text-primary-400 transition-colors">
          {article.title}
        </h3>

        <p className="text-gray-400 text-sm line-clamp-2">
          {article.excerpt}
        </p>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{article.readingTime} {t('dk okuma', 'min read')}</span>
          </div>
          <div className="flex items-center gap-1 text-primary-400 text-sm font-medium">
            <span>{t('Oku', 'Read')}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </Link>
  )
}
