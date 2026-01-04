import { useState } from 'react'
import { useTheme } from '../components/Layout'
import FilterBar from '../components/FilterBar'
import { 
  Store, 
  MapPin, 
  Calendar,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Search,
  Plus,
  Eye,
  Edit2,
  MoreHorizontal,
  CheckCircle,
  XCircle
} from 'lucide-react'
import clsx from 'clsx'
import { StoreBrand, StoreType } from '../types'

// Demo mağaza verileri
const demoStores = [
  {
    id: 'TD001',
    name: 'İstanbul Kadıköy',
    brand: StoreBrand.TOST_DURO,
    type: StoreType.STREET,
    city: 'İstanbul',
    district: 'Kadıköy',
    address: 'Caferağa Mah. Moda Cad. No:123',
    isActive: true,
    openingDate: '2023-06-15',
    revenue: 2145320,
    orders: 892,
    change: 18.5,
    manager: 'Ahmet Yılmaz',
    phone: '+90 532 111 2233'
  },
  {
    id: 'TD002',
    name: 'İstanbul Beşiktaş',
    brand: StoreBrand.TOST_DURO,
    type: StoreType.AVM,
    city: 'İstanbul',
    district: 'Beşiktaş',
    address: 'Zorlu Center AVM No:45',
    isActive: true,
    openingDate: '2023-09-01',
    revenue: 1987650,
    orders: 756,
    change: 12.3,
    manager: 'Mehmet Kaya',
    phone: '+90 532 222 3344'
  },
  {
    id: 'TD003',
    name: 'Ankara Çankaya',
    brand: StoreBrand.TOST_DURO,
    type: StoreType.PLAZA,
    city: 'Ankara',
    district: 'Çankaya',
    address: 'Tunalı Hilmi Cad. No:67',
    isActive: true,
    openingDate: '2024-01-10',
    revenue: 1456890,
    orders: 634,
    change: 8.7,
    manager: 'Ayşe Demir',
    phone: '+90 532 333 4455'
  },
  {
    id: 'DRL001',
    name: 'Antalya Merkez',
    brand: StoreBrand.DORELLO,
    type: StoreType.STREET,
    city: 'Antalya',
    district: 'Muratpaşa',
    address: 'Konyaaltı Cad. No:89',
    isActive: true,
    openingDate: '2024-03-20',
    revenue: 987450,
    orders: 423,
    change: 25.6,
    manager: 'Fatma Şahin',
    phone: '+90 532 444 5566'
  },
  {
    id: 'TD004',
    name: 'İzmir Konak',
    brand: StoreBrand.TOST_DURO,
    type: StoreType.STREET,
    city: 'İzmir',
    district: 'Konak',
    address: 'Alsancak Kordon No:12',
    isActive: false,
    openingDate: '2024-06-01',
    revenue: 0,
    orders: 0,
    change: 0,
    manager: '-',
    phone: '-'
  },
]

export default function StoresPage() {
  const { theme, isDark } = useTheme()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterBrand, setFilterBrand] = useState<string>('ALL')
  const [filterCity, setFilterCity] = useState<string>('ALL')

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  const filteredStores = demoStores.filter(store => {
    const matchesSearch = store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.district.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesBrand = filterBrand === 'ALL' || store.brand === filterBrand
    const matchesCity = filterCity === 'ALL' || store.city === filterCity
    return matchesSearch && matchesBrand && matchesCity
  })

  const uniqueCities = [...new Set(demoStores.map(s => s.city))]
  const uniqueBrands = [...new Set(demoStores.map(s => s.brand))]

  const totalRevenue = demoStores.filter(s => s.isActive).reduce((sum, s) => sum + s.revenue, 0)
  const totalOrders = demoStores.filter(s => s.isActive).reduce((sum, s) => sum + s.orders, 0)
  const activeStores = demoStores.filter(s => s.isActive).length

  return (
    <div className="space-y-6">
      {/* Global Filter Bar */}
      <FilterBar />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
            <Store size={28} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
          </div>
          <div>
            <h1 className={clsx('text-2xl font-black', theme.contentText)}>Mağaza Yönetimi</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Tüm mağazaları görüntüle ve yönet</p>
          </div>
        </div>

        <button className={clsx('flex items-center gap-2 px-4 py-2 rounded-xl font-medium', theme.buttonPrimary)}>
          <Plus size={16} /> Mağaza Ekle
        </button>
      </div>

      {/* Özet KPI'lar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
          <div className="flex items-center gap-3 mb-2">
            <DollarSign size={20} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
            <span className={clsx('text-sm font-medium', theme.contentTextMuted)}>Toplam Ciro</span>
          </div>
          <p className={clsx('text-2xl font-black', theme.contentText)}>{formatCurrency(totalRevenue)}</p>
        </div>
        <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
          <div className="flex items-center gap-3 mb-2">
            <Users size={20} className={isDark ? 'text-blue-400' : 'text-blue-600'} />
            <span className={clsx('text-sm font-medium', theme.contentTextMuted)}>Toplam Sipariş</span>
          </div>
          <p className={clsx('text-2xl font-black', theme.contentText)}>{totalOrders.toLocaleString()}</p>
        </div>
        <div className={clsx('p-6 rounded-2xl', theme.cardBg)}>
          <div className="flex items-center gap-3 mb-2">
            <Store size={20} className={isDark ? 'text-amber-400' : 'text-amber-600'} />
            <span className={clsx('text-sm font-medium', theme.contentTextMuted)}>Aktif Mağaza</span>
          </div>
          <p className={clsx('text-2xl font-black', theme.contentText)}>{activeStores} / {demoStores.length}</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-center gap-3">
        <div className={clsx('flex-1 min-w-[200px] flex items-center gap-3 px-4 py-3 rounded-xl border', theme.inputBg)}>
          <Search size={18} className={clsx(theme.contentTextMuted)} />
          <input
            type="text"
            placeholder="Mağaza ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={clsx('flex-1 bg-transparent text-sm outline-none', theme.inputText, theme.inputPlaceholder)}
          />
        </div>

        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(e.target.value)}
          className={clsx('px-4 py-3 rounded-xl border text-sm', theme.inputBg, theme.inputText)}
        >
          <option value="ALL">Tüm Markalar</option>
          {uniqueBrands.map(brand => (
            <option key={brand} value={brand}>{brand}</option>
          ))}
        </select>

        <select
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          className={clsx('px-4 py-3 rounded-xl border text-sm', theme.inputBg, theme.inputText)}
        >
          <option value="ALL">Tüm Şehirler</option>
          {uniqueCities.map(city => (
            <option key={city} value={city}>{city}</option>
          ))}
        </select>
      </div>

      {/* Mağaza Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredStores.map(store => (
          <div
            key={store.id}
            className={clsx(
              'rounded-2xl overflow-hidden transition-all hover:shadow-xl',
              theme.cardBg,
              store.isActive 
                ? theme.cardHover 
                : (isDark ? 'border-rose-500/20 opacity-60' : 'border-rose-200 opacity-70')
            )}
          >
            {/* Üst Bölüm */}
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg',
                    store.brand === StoreBrand.TOST_DURO 
                      ? 'bg-gradient-to-br from-indigo-500 to-blue-500' 
                      : 'bg-gradient-to-br from-emerald-500 to-teal-500'
                  )}>
                    {store.brand === StoreBrand.TOST_DURO ? 'TD' : 'DL'}
                  </div>
                  <div>
                    <h3 className={clsx('font-bold', theme.contentText)}>{store.name}</h3>
                    <p className={clsx('text-xs', theme.contentTextMuted)}>{store.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {store.isActive ? (
                    <span className={clsx('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold', theme.success)}>
                      <CheckCircle size={12} /> Aktif
                    </span>
                  ) : (
                    <span className={clsx('flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold', theme.error)}>
                      <XCircle size={12} /> Pasif
                    </span>
                  )}
                </div>
              </div>

              {/* Adres */}
              <div className={clsx('flex items-start gap-2 mb-4 text-sm', theme.contentTextMuted)}>
                <MapPin size={16} className="shrink-0 mt-0.5" />
                <span>{store.address}, {store.district}/{store.city}</span>
              </div>

              {/* Tip ve Tarih */}
              <div className={clsx('flex items-center gap-4 text-xs', theme.contentTextMuted)}>
                <span className={clsx('px-2 py-1 rounded font-medium', isDark ? 'bg-slate-800' : 'bg-slate-100')}>{store.type}</span>
                <div className="flex items-center gap-1">
                  <Calendar size={12} />
                  {new Date(store.openingDate).toLocaleDateString('tr-TR')}
                </div>
              </div>
            </div>

            {/* Performans Bölümü */}
            {store.isActive && (
              <div className={clsx('px-6 py-4', isDark ? 'border-t border-slate-800 bg-slate-900/50' : 'border-t border-slate-100 bg-slate-50')}>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className={clsx('text-xs mb-1', theme.contentTextMuted)}>Ciro</p>
                    <p className={clsx('font-bold', theme.contentText)}>{formatCurrency(store.revenue)}</p>
                  </div>
                  <div>
                    <p className={clsx('text-xs mb-1', theme.contentTextMuted)}>Sipariş</p>
                    <p className={clsx('font-bold', theme.contentText)}>{store.orders}</p>
                  </div>
                  <div>
                    <p className={clsx('text-xs mb-1', theme.contentTextMuted)}>Değişim</p>
                    <p className={clsx(
                      'font-bold flex items-center justify-center gap-1',
                      store.change >= 0 
                        ? (isDark ? 'text-emerald-400' : 'text-emerald-600') 
                        : (isDark ? 'text-rose-400' : 'text-rose-600')
                    )}>
                      {store.change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {Math.abs(store.change)}%
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Alt Bölüm - Aksiyonlar */}
            <div className={clsx('px-6 py-3 flex items-center justify-between', isDark ? 'border-t border-slate-800' : 'border-t border-slate-100')}>
              <div className={clsx('flex items-center gap-2 text-xs', theme.contentTextMuted)}>
                <Users size={14} />
                {store.manager}
              </div>
              <div className="flex items-center gap-1">
                <button className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
                  <Eye size={16} />
                </button>
                <button className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
                  <Edit2 size={16} />
                </button>
                <button className={clsx('p-2 rounded-lg transition-colors', theme.buttonSecondary)}>
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sonuç yok */}
      {filteredStores.length === 0 && (
        <div className="text-center py-16">
          <Store size={48} className={clsx('mx-auto mb-4', theme.contentTextMuted)} />
          <p className={clsx('font-bold', theme.contentTextMuted)}>Arama kriterlerine uygun mağaza bulunamadı.</p>
        </div>
      )}
    </div>
  )
}
