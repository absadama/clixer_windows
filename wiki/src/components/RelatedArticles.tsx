import { Link } from 'react-router-dom'
import { ArrowRight, FileText } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { getArticleById } from '../content'
import type { Article } from '../types/article'

interface RelatedArticlesProps {
  articleIds: string[]
}

export default function RelatedArticles({ articleIds }: RelatedArticlesProps) {
  const { t, language } = useLanguage()
  
  const articles = articleIds
    .map(id => getArticleById(id, language))
    .filter((a): a is Article => a !== null)

  if (articles.length === 0) return null

  return (
    <div className="mt-12 pt-8 border-t border-dark-border">
      <h3 className="text-lg font-semibold text-white mb-4">
        {t('İlgili Makaleler', 'Related Articles')}
      </h3>
      <div className="grid gap-3">
        {articles.map(article => (
          <Link
            key={article.id}
            to={`/${article.category}/${article.slug}`}
            className="flex items-center gap-3 p-4 bg-dark-card border border-dark-border rounded-xl hover:border-primary-500/50 transition-colors group"
          >
            <FileText className="w-5 h-5 text-gray-500" />
            <div className="flex-1">
              <p className="font-medium text-white group-hover:text-primary-400 transition-colors">
                {article.title}
              </p>
              <p className="text-sm text-gray-500">{article.categoryLabel}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
          </Link>
        ))}
      </div>
    </div>
  )
}
