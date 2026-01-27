import { Link } from 'react-router-dom'
import { 
  BookOpen, 
  Palette, 
  BarChart3, 
  Database, 
  Settings, 
  Zap,
  ArrowRight,
  Search,
  Sparkles
} from 'lucide-react'
import clsx from 'clsx'
import { useLanguage } from '../hooks/useLanguage'
import { getPopularArticles, getCategoryArticleCount } from '../content'
import ArticleCard from '../components/ArticleCard'

const categories = [
  { 
    id: 'getting-started', 
    labelTr: 'Başlangıç', 
    labelEn: 'Getting Started',
    descTr: 'Clixer\'a ilk adımlarınızı atın',
    descEn: 'Take your first steps with Clixer',
    icon: BookOpen,
    color: 'from-green-500 to-emerald-600'
  },
  { 
    id: 'designer', 
    labelTr: 'Tasarım Stüdyosu', 
    labelEn: 'Design Studio',
    descTr: 'Dashboard ve widget tasarımı',
    descEn: 'Dashboard and widget design',
    icon: Palette,
    color: 'from-purple-500 to-violet-600'
  },
  { 
    id: 'metrics', 
    labelTr: 'Metrikler', 
    labelEn: 'Metrics',
    descTr: 'KPI ve metrik oluşturma',
    descEn: 'Create KPIs and metrics',
    icon: BarChart3,
    color: 'from-blue-500 to-cyan-600'
  },
  { 
    id: 'data', 
    labelTr: 'Veri Yönetimi', 
    labelEn: 'Data Management',
    descTr: 'Bağlantı, dataset ve ETL',
    descEn: 'Connections, datasets and ETL',
    icon: Database,
    color: 'from-orange-500 to-amber-600'
  },
  { 
    id: 'admin', 
    labelTr: 'Yönetim Paneli', 
    labelEn: 'Admin Panel',
    descTr: 'Kullanıcı ve yetki yönetimi',
    descEn: 'User and permission management',
    icon: Settings,
    color: 'from-red-500 to-rose-600'
  },
  { 
    id: 'advanced', 
    labelTr: 'İleri Düzey', 
    labelEn: 'Advanced',
    descTr: 'Performans ve entegrasyonlar',
    descEn: 'Performance and integrations',
    icon: Zap,
    color: 'from-yellow-500 to-orange-600'
  },
]

export default function HomePage() {
  const { t, language } = useLanguage()
  const popularArticles = getPopularArticles(language, 4)

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/20 text-primary-400 rounded-full text-sm font-medium mb-6">
          <Sparkles className="w-4 h-4" />
          {t('Clixer Eğitim Merkezi', 'Clixer Education Center')}
        </div>
        
        <h1 className="text-4xl lg:text-5xl font-bold text-white mb-4">
          {t('Her şeyi öğrenin', 'Learn everything')}
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          {t(
            'Clixer\'ı en verimli şekilde kullanmak için adım adım rehberler, örnekler ve ipuçları.',
            'Step-by-step guides, examples and tips to use Clixer most efficiently.'
          )}
        </p>

        {/* Quick search hint */}
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Search className="w-4 h-4" />
          <span className="text-sm">
            {t('Aramak için Ctrl+K tuşlarını kullanın', 'Press Ctrl+K to search')}
          </span>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {categories.map((category) => {
          const Icon = category.icon
          const articleCount = getCategoryArticleCount(category.id, language)
          
          return (
            <Link
              key={category.id}
              to={`/${category.id}`}
              className="group relative bg-dark-card border border-dark-border rounded-2xl p-6 hover:border-primary-500/50 transition-all card-hover overflow-hidden"
            >
              {/* Gradient background on hover */}
              <div className={clsx(
                'absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br',
                category.color
              )} />
              
              <div className="relative">
                <div className={clsx(
                  'w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br',
                  category.color
                )}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                
                <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary-400 transition-colors">
                  {language === 'tr' ? category.labelTr : category.labelEn}
                </h3>
                
                <p className="text-sm text-gray-400 mb-4">
                  {language === 'tr' ? category.descTr : category.descEn}
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {articleCount} {t('makale', 'articles')}
                  </span>
                  <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-primary-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Popular Articles */}
      {popularArticles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">
              {t('Popüler Makaleler', 'Popular Articles')}
            </h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {popularArticles.map(article => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="mt-12 p-6 bg-gradient-to-r from-primary-500/20 to-purple-500/20 border border-primary-500/30 rounded-2xl">
        <h3 className="text-lg font-semibold text-white mb-4">
          {t('Hızlı Başlangıç', 'Quick Start')}
        </h3>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link 
            to="/getting-started/hizli-baslangic"
            className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-xl hover:bg-dark-bg transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 font-bold">1</span>
            </div>
            <span className="text-white group-hover:text-primary-400 transition-colors">
              {t('5 Dakikada İlk Dashboard', '5 Min First Dashboard')}
            </span>
          </Link>
          <Link 
            to="/metrics/yeni-metrik-olusturma"
            className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-xl hover:bg-dark-bg transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold">2</span>
            </div>
            <span className="text-white group-hover:text-primary-400 transition-colors">
              {t('İlk Metriğinizi Oluşturun', 'Create Your First Metric')}
            </span>
          </Link>
          <Link 
            to="/data/dataset-olusturma"
            className="flex items-center gap-3 p-3 bg-dark-bg/50 rounded-xl hover:bg-dark-bg transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <span className="text-orange-400 font-bold">3</span>
            </div>
            <span className="text-white group-hover:text-primary-400 transition-colors">
              {t('Dataset Oluşturma', 'Create Dataset')}
            </span>
          </Link>
        </div>
      </div>
    </div>
  )
}
