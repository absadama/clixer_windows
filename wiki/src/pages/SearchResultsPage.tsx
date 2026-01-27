import { useSearchParams } from 'react-router-dom'
import { Search, FileText } from 'lucide-react'
import { useLanguage } from '../hooks/useLanguage'
import { searchArticles } from '../utils/searchIndex'
import Breadcrumb from '../components/Breadcrumb'
import ArticleCard from '../components/ArticleCard'

export default function SearchResultsPage() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const { language, t } = useLanguage()

  const results = query.length >= 2 ? searchArticles(query, language) : []

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumb items={[
        { label: t('Arama Sonuçları', 'Search Results') }
      ]} />

      {/* Search Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary-500/20 flex items-center justify-center">
            <Search className="w-6 h-6 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t('Arama Sonuçları', 'Search Results')}
            </h1>
            <p className="text-gray-400">
              "{query}" {t('için', 'for')} {results.length} {t('sonuç bulundu', 'results found')}
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-4">
          {results.map(article => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      ) : query.length >= 2 ? (
        <div className="text-center py-16 bg-dark-card border border-dark-border rounded-2xl">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {t('Sonuç Bulunamadı', 'No Results Found')}
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            {t(
              'Aramanızla eşleşen makale bulunamadı. Farklı anahtar kelimeler deneyin.',
              'No articles match your search. Try different keywords.'
            )}
          </p>
        </div>
      ) : (
        <div className="text-center py-16 bg-dark-card border border-dark-border rounded-2xl">
          <Search className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-white mb-2">
            {t('Aramaya Başlayın', 'Start Searching')}
          </h3>
          <p className="text-gray-500">
            {t('En az 2 karakter girin', 'Enter at least 2 characters')}
          </p>
        </div>
      )}
    </div>
  )
}
