import { useState } from 'react'
import { useTheme } from '../components/Layout'
import FilterBar from '../components/FilterBar'
import { 
  ShieldAlert, 
  Trash2, 
  Clock, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Filter,
  CheckCircle,
  XCircle,
  Eye
} from 'lucide-react'
import clsx from 'clsx'
import { Anomaly, DailyOperation } from '../types'

// Demo veriler
const demoStores = [
  { id: 'ALL', name: 'Tüm Mağazalar' },
  { id: 'TD001', name: 'İstanbul Kadıköy' },
  { id: 'TD002', name: 'İstanbul Beşiktaş' },
  { id: 'TD003', name: 'Ankara Çankaya' },
  { id: 'DRL001', name: 'Antalya Merkez' },
]

const mockAnomalies: Anomaly[] = [
  { id: 1, store_id: 'TD001', type: 'CANCELLATION', description: 'Peş peşe 3 iptal işlemi (Aynı Personel)', severity: 'HIGH', value: 450.00, detected_at: new Date().toISOString(), is_resolved: false },
  { id: 2, store_id: 'TD002', type: 'WASTE', description: 'Kapanış sayımında yüksek zayi oranı (%5)', severity: 'MEDIUM', value: 1200.50, detected_at: new Date(Date.now() - 86400000).toISOString(), is_resolved: true },
  { id: 3, store_id: 'TD001', type: 'DISCOUNT', description: 'Yetkisiz indirim kullanımı tespiti', severity: 'CRITICAL', value: 2500.00, detected_at: new Date(Date.now() - 3600000).toISOString(), is_resolved: false },
  { id: 4, store_id: 'DRL001', type: 'SERVICE_TIME', description: 'Ortalama servis süresi limiti aşıldı (25dk)', severity: 'LOW', value: 0, detected_at: new Date().toISOString(), is_resolved: false },
  { id: 5, store_id: 'TD003', type: 'INVENTORY', description: 'Stok sayım farkı tespit edildi', severity: 'HIGH', value: 3200.00, detected_at: new Date(Date.now() - 7200000).toISOString(), is_resolved: false },
]

const mockOperations: DailyOperation[] = [
  { store_id: 'TD001', date: '2025-12-06', waste_amount: 850, cancellation_amount: 320, avg_service_time: 12, kitchen_incident_count: 1, audit_score: 92, hygiene_score: 95 },
  { store_id: 'TD002', date: '2025-12-06', waste_amount: 450, cancellation_amount: 120, avg_service_time: 9, kitchen_incident_count: 0, audit_score: 98, hygiene_score: 99 },
  { store_id: 'TD003', date: '2025-12-06', waste_amount: 600, cancellation_amount: 200, avg_service_time: 15, kitchen_incident_count: 2, audit_score: 85, hygiene_score: 88 },
  { store_id: 'DRL001', date: '2025-12-06', waste_amount: 720, cancellation_amount: 280, avg_service_time: 18, kitchen_incident_count: 1, audit_score: 90, hygiene_score: 93 },
]

export default function OperationsPage() {
  const { theme, isDark } = useTheme()
  const [selectedStoreId, setSelectedStoreId] = useState('ALL')
  
  const filteredAnomalies = selectedStoreId === 'ALL' 
    ? mockAnomalies 
    : mockAnomalies.filter(a => a.store_id === selectedStoreId)
  
  const filteredOps = selectedStoreId === 'ALL' 
    ? mockOperations 
    : mockOperations.filter(o => o.store_id === selectedStoreId)

  const totalWaste = filteredOps.reduce((sum, op) => sum + op.waste_amount, 0)
  const totalCancel = filteredOps.reduce((sum, op) => sum + op.cancellation_amount, 0)
  const avgSpeed = filteredOps.length > 0 
    ? Math.round(filteredOps.reduce((sum, op) => sum + op.avg_service_time, 0) / filteredOps.length) 
    : 0

  const getSeverityColor = (severity: string) => {
    if (isDark) {
      switch(severity) {
        case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30'
        case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
        case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
        default: return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      }
    }
    switch(severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200'
      case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      default: return 'bg-blue-100 text-blue-700 border-blue-200'
    }
  }

  const getTypeIcon = (type: string) => {
    switch(type) {
      case 'CANCELLATION': return <XCircle size={16} />
      case 'WASTE': return <Trash2 size={16} />
      case 'DISCOUNT': return <AlertTriangle size={16} />
      case 'SERVICE_TIME': return <Clock size={16} />
      case 'INVENTORY': return <Activity size={16} />
      default: return <AlertTriangle size={16} />
    }
  }

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val)
  }

  return (
    <div className="space-y-6">
      {/* Global Filter Bar */}
      <FilterBar />
      
      {/* Header */}
      <div className={clsx('flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-6 rounded-2xl', theme.cardBg)}>
        <div className="flex items-center gap-4">
          <div className={clsx('w-12 h-12 rounded-2xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg')}>
            <ShieldAlert size={24} className="text-white" />
          </div>
          <div>
            <h1 className={clsx('text-2xl font-bold', theme.contentText)}>Operasyonel Mükemmellik & Denetim</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Kayıp/Kaçak takibi, anomali tespiti ve operasyonel verimlilik raporları.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={clsx('flex items-center px-3 py-2 rounded-xl border', theme.inputBg)}>
            <Filter size={16} className={clsx('mr-2', theme.contentTextMuted)} />
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className={clsx('bg-transparent text-sm font-medium focus:outline-none cursor-pointer', theme.inputText)}
            >
              {demoStores.map(store => (
                <option key={store.id} value={store.id}>{store.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI Kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Toplam Zayi */}
        <div className={clsx('p-6 rounded-2xl flex items-center relative overflow-hidden group', theme.cardBg)}>
          <div className={clsx('absolute right-0 top-0 w-32 h-32 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110', isDark ? 'bg-red-500/10' : 'bg-red-50')} />
          <div className="relative z-10 flex-1">
            <p className={clsx('text-xs font-bold uppercase tracking-wider mb-1', theme.contentTextMuted)}>Toplam Zayi (Waste)</p>
            <h3 className={clsx('text-3xl font-bold', theme.contentText)}>{formatCurrency(totalWaste)}</h3>
            <div className="flex items-center mt-2 text-rose-500 text-xs font-bold">
              <ArrowUpRight size={14} className="mr-1" />
              <span>Geçen haftaya göre %12 artış</span>
            </div>
          </div>
          <div className={clsx('relative z-10 p-3 rounded-xl', isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-600')}>
            <Trash2 size={24} />
          </div>
        </div>

        {/* İptal & İade */}
        <div className={clsx('p-6 rounded-2xl flex items-center relative overflow-hidden group', theme.cardBg)}>
          <div className={clsx('absolute right-0 top-0 w-32 h-32 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110', isDark ? 'bg-orange-500/10' : 'bg-orange-50')} />
          <div className="relative z-10 flex-1">
            <p className={clsx('text-xs font-bold uppercase tracking-wider mb-1', theme.contentTextMuted)}>İptal & İade İşlemleri</p>
            <h3 className={clsx('text-3xl font-bold', theme.contentText)}>{formatCurrency(totalCancel)}</h3>
            <div className="flex items-center mt-2 text-emerald-500 text-xs font-bold">
              <ArrowDownRight size={14} className="mr-1" />
              <span>Limitlerin altında</span>
            </div>
          </div>
          <div className={clsx('relative z-10 p-3 rounded-xl', isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-600')}>
            <AlertTriangle size={24} />
          </div>
        </div>

        {/* Ortalama Servis Hızı */}
        <div className={clsx('p-6 rounded-2xl flex items-center relative overflow-hidden group', theme.cardBg)}>
          <div className={clsx('absolute right-0 top-0 w-32 h-32 rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-110', isDark ? 'bg-blue-500/10' : 'bg-blue-50')} />
          <div className="relative z-10 flex-1">
            <p className={clsx('text-xs font-bold uppercase tracking-wider mb-1', theme.contentTextMuted)}>Ortalama Servis Hızı</p>
            <h3 className={clsx('text-3xl font-bold', theme.contentText)}>{avgSpeed} dk</h3>
            <div className={clsx('flex items-center mt-2 text-xs font-bold', theme.contentTextMuted)}>
              <Activity size={14} className="mr-1" />
              <span>Hedef: 12 dk</span>
            </div>
          </div>
          <div className={clsx('relative z-10 p-3 rounded-xl', isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-600')}>
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Anomaliler ve Operasyonel Detay */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Anomali Tablosu */}
        <div className={clsx('lg:col-span-2 rounded-2xl overflow-hidden', theme.cardBg)}>
          <div className={clsx('p-6 border-b flex justify-between items-center', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <h3 className={clsx('font-bold text-lg', theme.contentText)}>Tespit Edilen Anomaliler</h3>
            <span className={clsx('text-xs font-bold px-3 py-1 rounded-lg', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600')}>
              {filteredAnomalies.filter(a => !a.is_resolved).length} Aktif
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className={clsx('text-xs font-bold uppercase', isDark ? 'bg-slate-800/50 text-slate-400' : 'bg-slate-50 text-slate-500')}>
                <tr>
                  <th className="px-6 py-4">Olay</th>
                  <th className="px-6 py-4">Ciddiyet</th>
                  <th className="px-6 py-4">Tutar</th>
                  <th className="px-6 py-4">Zaman</th>
                  <th className="px-6 py-4">Durum</th>
                </tr>
              </thead>
              <tbody className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
                {filteredAnomalies.map(anomaly => (
                  <tr key={anomaly.id} className={clsx('transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={clsx('p-2 rounded-lg', isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500')}>
                          {getTypeIcon(anomaly.type)}
                        </div>
                        <div>
                          <p className={clsx('font-medium text-sm', theme.contentText)}>{anomaly.description}</p>
                          <p className={clsx('text-xs', theme.contentTextMuted)}>{anomaly.store_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        'px-2 py-1 rounded-lg text-xs font-bold border',
                        getSeverityColor(anomaly.severity)
                      )}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className={clsx('px-6 py-4 font-bold', theme.contentText)}>
                      {anomaly.value > 0 ? formatCurrency(anomaly.value) : '-'}
                    </td>
                    <td className={clsx('px-6 py-4 text-sm', theme.contentTextMuted)}>
                      {new Date(anomaly.detected_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">
                      {anomaly.is_resolved ? (
                        <span className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                          <CheckCircle size={14} /> Çözüldü
                        </span>
                      ) : (
                        <button className="flex items-center gap-1 text-amber-500 hover:text-amber-400 text-xs font-bold transition-colors">
                          <Eye size={14} /> İncele
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mağaza Performans */}
        <div className={clsx('rounded-2xl overflow-hidden', theme.cardBg)}>
          <div className={clsx('p-6 border-b', isDark ? 'border-slate-800' : 'border-slate-200')}>
            <h3 className={clsx('font-bold text-lg', theme.contentText)}>Operasyonel Skorlar</h3>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Mağaza bazlı denetim puanları</p>
          </div>
          
          <div className={clsx('divide-y', isDark ? 'divide-slate-800' : 'divide-slate-100')}>
            {filteredOps.map(op => {
              const store = demoStores.find(s => s.id === op.store_id)
              return (
                <div key={op.store_id} className={clsx('p-4 transition-colors', isDark ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={clsx('font-medium text-sm', theme.contentText)}>{store?.name || op.store_id}</span>
                    <span className={clsx('text-xs', theme.contentTextMuted)}>{op.date}</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className={clsx('text-xs mb-1', theme.contentTextMuted)}>Denetim Skoru</p>
                      <div className="flex items-center gap-2">
                        <div className={clsx('flex-1 h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
                          <div 
                            className={clsx(
                              'h-full rounded-full',
                              op.audit_score >= 90 ? 'bg-emerald-500' : op.audit_score >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            )}
                            style={{ width: `${op.audit_score}%` }}
                          />
                        </div>
                        <span className={clsx('text-sm font-bold', theme.contentText)}>{op.audit_score}</span>
                      </div>
                    </div>
                    <div>
                      <p className={clsx('text-xs mb-1', theme.contentTextMuted)}>Hijyen Skoru</p>
                      <div className="flex items-center gap-2">
                        <div className={clsx('flex-1 h-2 rounded-full overflow-hidden', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
                          <div 
                            className={clsx(
                              'h-full rounded-full',
                              op.hygiene_score >= 90 ? 'bg-emerald-500' : op.hygiene_score >= 70 ? 'bg-amber-500' : 'bg-red-500'
                            )}
                            style={{ width: `${op.hygiene_score}%` }}
                          />
                        </div>
                        <span className={clsx('text-sm font-bold', theme.contentText)}>{op.hygiene_score}</span>
                      </div>
                    </div>
                  </div>

                  <div className={clsx('grid grid-cols-3 gap-2 mt-3 pt-3 border-t', isDark ? 'border-slate-700' : 'border-slate-100')}>
                    <div className="text-center">
                      <p className={clsx('text-xs', theme.contentTextMuted)}>Zayi</p>
                      <p className="text-sm font-bold text-rose-500">{formatCurrency(op.waste_amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className={clsx('text-xs', theme.contentTextMuted)}>İptal</p>
                      <p className="text-sm font-bold text-orange-500">{formatCurrency(op.cancellation_amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className={clsx('text-xs', theme.contentTextMuted)}>Servis</p>
                      <p className="text-sm font-bold text-blue-500">{op.avg_service_time} dk</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
