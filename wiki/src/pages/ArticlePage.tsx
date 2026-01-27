import { useState } from 'react'
import { useParams, Navigate, Link } from 'react-router-dom'
import { Clock, Calendar, ChevronLeft, ChevronRight, Tag } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useLanguage } from '../hooks/useLanguage'
import { getArticleBySlug, getArticlesByCategory } from '../content'
import Breadcrumb from '../components/Breadcrumb'
import RelatedArticles from '../components/RelatedArticles'
import ImageViewer from '../components/ImageViewer'
import CodeBlock from '../components/CodeBlock'

const categoryLabels: Record<string, { tr: string; en: string }> = {
  'getting-started': { tr: 'Başlangıç', en: 'Getting Started' },
  'designer': { tr: 'Tasarım Stüdyosu', en: 'Design Studio' },
  'metrics': { tr: 'Metrikler', en: 'Metrics' },
  'data': { tr: 'Veri Yönetimi', en: 'Data Management' },
  'admin': { tr: 'Yönetim Paneli', en: 'Admin Panel' },
  'advanced': { tr: 'İleri Düzey', en: 'Advanced' }
}

export default function ArticlePage() {
  const { category, slug } = useParams<{ category: string; slug: string }>()
  const { language, t } = useLanguage()
  const [viewerImage, setViewerImage] = useState<{ src: string; alt: string; caption?: string } | null>(null)

  if (!category || !slug) {
    return <Navigate to="/" replace />
  }

  const article = getArticleBySlug(category, slug, language)

  if (!article) {
    return <Navigate to={`/${category}`} replace />
  }

  // Get prev/next articles
  const categoryArticles = getArticlesByCategory(category, language)
  const currentIndex = categoryArticles.findIndex(a => a.slug === slug)
  const prevArticle = currentIndex > 0 ? categoryArticles[currentIndex - 1] : null
  const nextArticle = currentIndex < categoryArticles.length - 1 ? categoryArticles[currentIndex + 1] : null

  const categoryLabel = categoryLabels[category]?.[language] || category

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumb items={[
        { label: categoryLabel, href: `/${category}` },
        { label: article.title }
      ]} />

      {/* Article Header */}
      <header className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-white mb-4">
          {article.title}
        </h1>
        
        <p className="text-lg text-gray-400 mb-6">
          {article.excerpt}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>{article.readingTime} {t('dk okuma', 'min read')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>{t('Son güncelleme:', 'Last updated:')} {article.lastUpdated}</span>
          </div>
        </div>

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {article.tags.map(tag => (
              <span 
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-dark-card border border-dark-border rounded-lg text-xs text-gray-400"
              >
                <Tag className="w-3 h-3" />
                {tag}
              </span>
            ))}
          </div>
        )}
      </header>

      {/* Article Content */}
      <article className="article-content">
        <ReactMarkdown
          components={{
            // Custom code block rendering
            code({ node, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              const isInline = !match
              
              if (isInline) {
                return <code className={className} {...props}>{children}</code>
              }
              
              return (
                <CodeBlock 
                  code={String(children).replace(/\n$/, '')}
                  language={match[1]}
                />
              )
            },
            // Custom image rendering with click to zoom
            img({ src, alt }) {
              return (
                <img
                  src={src}
                  alt={alt || ''}
                  onClick={() => setViewerImage({ src: src || '', alt: alt || '' })}
                  className="cursor-pointer"
                />
              )
            },
            // Custom blockquote for tips/warnings
            blockquote({ children }) {
              const content = String(children)
              if (content.includes('💡') || content.toLowerCase().includes('tip:')) {
                return <div className="tip-box">{children}</div>
              }
              if (content.includes('⚠️') || content.toLowerCase().includes('warning:')) {
                return <div className="warning-box">{children}</div>
              }
              if (content.includes('ℹ️') || content.toLowerCase().includes('info:')) {
                return <div className="info-box">{children}</div>
              }
              if (content.includes('🚫') || content.toLowerCase().includes('danger:')) {
                return <div className="danger-box">{children}</div>
              }
              return <blockquote>{children}</blockquote>
            }
          }}
        >
          {article.content}
        </ReactMarkdown>
      </article>

      {/* Related Articles */}
      {article.relatedArticles.length > 0 && (
        <RelatedArticles articleIds={article.relatedArticles} />
      )}

      {/* Prev/Next Navigation */}
      <div className="mt-12 pt-8 border-t border-dark-border">
        <div className="grid grid-cols-2 gap-4">
          {prevArticle ? (
            <Link
              to={`/${category}/${prevArticle.slug}`}
              className="flex items-center gap-3 p-4 bg-dark-card border border-dark-border rounded-xl hover:border-primary-500/50 transition-colors group"
            >
              <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-primary-400 group-hover:-translate-x-1 transition-all" />
              <div className="text-left">
                <p className="text-xs text-gray-500 mb-1">{t('Önceki', 'Previous')}</p>
                <p className="font-medium text-white group-hover:text-primary-400 transition-colors line-clamp-1">
                  {prevArticle.title}
                </p>
              </div>
            </Link>
          ) : (
            <div />
          )}
          
          {nextArticle ? (
            <Link
              to={`/${category}/${nextArticle.slug}`}
              className="flex items-center justify-end gap-3 p-4 bg-dark-card border border-dark-border rounded-xl hover:border-primary-500/50 transition-colors group"
            >
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">{t('Sonraki', 'Next')}</p>
                <p className="font-medium text-white group-hover:text-primary-400 transition-colors line-clamp-1">
                  {nextArticle.title}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {viewerImage && (
        <ImageViewer
          src={viewerImage.src}
          alt={viewerImage.alt}
          caption={viewerImage.caption}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  )
}
