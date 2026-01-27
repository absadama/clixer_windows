import { useParams, Navigate } from 'react-router-dom'
import { 
  BookOpen, 
  Palette, 
  BarChart3, 
  Database, 
  Settings, 
  Zap 
} from 'lucide-react'
import clsx from 'clsx'
import { useLanguage } from '../hooks/useLanguage'
import { getArticlesByCategory } from '../content'
import Breadcrumb from '../components/Breadcrumb'
import ArticleCard from '../components/ArticleCard'

const categoryMeta: Record<string, {
  labelTr: string
  labelEn: string
  descTr: string
  descEn: string
  icon: any
  color: string
}> = {
  'getting-started': {
    labelTr: 'Başlangıç',
    labelEn: 'Getting Started',
    descTr: 'Clixer\'a ilk adımlarınızı atın. Temel kavramları öğrenin ve hızlıca başlayın.',
    descEn: 'Take your first steps with Clixer. Learn basic concepts and get started quickly.',
    icon: BookOpen,
    color: 'from-green-500 to-emerald-600'
  },
  'designer': {
    labelTr: 'Tasarım Stüdyosu',
    labelEn: 'Design Studio',
    descTr: 'Dashboard ve widget tasarımı yapın. Görsel raporlar oluşturun.',
    descEn: 'Design dashboards and widgets. Create visual reports.',
    icon: Palette,
    color: 'from-purple-500 to-violet-600'
  },
  'metrics': {
    labelTr: 'Metrikler',
    labelEn: 'Metrics',
    descTr: 'KPI ve metrikler oluşturun. Verilerinizi anlamlı göstergelere dönüştürün.',
    descEn: 'Create KPIs and metrics. Transform your data into meaningful indicators.',
    icon: BarChart3,
    color: 'from-blue-500 to-cyan-600'
  },
  'data': {
    labelTr: 'Veri Yönetimi',
    labelEn: 'Data Management',
    descTr: 'Veritabanı bağlantıları, dataset\'ler ve ETL işlemlerini yönetin.',
    descEn: 'Manage database connections, datasets and ETL operations.',
    icon: Database,
    color: 'from-orange-500 to-amber-600'
  },
  'admin': {
    labelTr: 'Yönetim Paneli',
    labelEn: 'Admin Panel',
    descTr: 'Kullanıcıları, yetkileri ve sistem ayarlarını yönetin.',
    descEn: 'Manage users, permissions and system settings.',
    icon: Settings,
    color: 'from-red-500 to-rose-600'
  },
  'advanced': {
    labelTr: 'İleri Düzey',
    labelEn: 'Advanced',
    descTr: 'Performans optimizasyonu, entegrasyonlar ve ileri düzey özellikler.',
    descEn: 'Performance optimization, integrations and advanced features.',
    icon: Zap,
    color: 'from-yellow-500 to-orange-600'
  }
}

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>()
  const { language, t } = useLanguage()

  if (!category || !categoryMeta[category]) {
    return <Navigate to="/" replace />
  }

  const meta = categoryMeta[category]
  const articles = getArticlesByCategory(category, language)
  const Icon = meta.icon

  return (
    <div className="max-w-4xl mx-auto">
      <Breadcrumb items={[
        { label: language === 'tr' ? meta.labelTr : meta.labelEn }
      ]} />

      {/* Category Header */}
      <div className="mb-8">
        <div className={clsx(
          'w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br',
          meta.color
        )}>
          <Icon className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3">
          {language === 'tr' ? meta.labelTr : meta.labelEn}
        </h1>
        
        <p className="text-lg text-gray-400">
          {language === 'tr' ? meta.descTr : meta.descEn}
        </p>
        
        <div className="mt-4 text-sm text-gray-500">
          {articles.length} {t('makale', 'articles')}
        </div>
      </div>

      {/* Articles List */}
      {articles.length > 0 ? (
        <div className="space-y-4">
          {articles.map((article, index) => (
            <div key={article.id} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-dark-card border border-dark-border flex items-center justify-center">
                <span className="text-sm font-medium text-gray-400">{index + 1}</span>
              </div>
              <div className="flex-1">
                <ArticleCard article={article} compact />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-dark-card border border-dark-border rounded-2xl">
          <p className="text-gray-500">
            {t('Bu kategoride henüz makale bulunmuyor.', 'No articles in this category yet.')}
          </p>
        </div>
      )}
    </div>
  )
}
