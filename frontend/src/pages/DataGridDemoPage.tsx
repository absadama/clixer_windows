// Enterprise DataGrid Demo Sayfası
// Test ve demo amaçlı

import React, { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import { EnterpriseDataGrid } from '../components/EnterpriseDataGrid'
import { ColumnConfig, ServerSideAggregates, LoadedDesignInfo } from '../components/EnterpriseDataGrid/types'
import { useTheme } from '../hooks/useTheme'
import { useAuthStore } from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Demo veri oluşturucu
const generateDemoData = (count: number) => {
  const categories = ['Elektronik', 'Giyim', 'Gıda', 'Mobilya', 'Kozmetik', 'Spor', 'Kitap', 'Oyuncak']
  const cities = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Adana', 'Konya', 'Gaziantep']
  const stores = ['Mağaza A', 'Mağaza B', 'Mağaza C', 'Mağaza D', 'Mağaza E']
  
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    date: new Date(2025, 0, 1 + Math.floor(Math.random() * 365)).toISOString().split('T')[0],
    category: categories[Math.floor(Math.random() * categories.length)],
    product: `Ürün ${i + 1}`,
    city: cities[Math.floor(Math.random() * cities.length)],
    store: stores[Math.floor(Math.random() * stores.length)],
    quantity: Math.floor(Math.random() * 100) + 1,
    unit_price: Math.floor(Math.random() * 1000) + 10,
    total: 0,
    discount: Math.random() * 20,
    profit_margin: Math.random() * 30 + 5,
    is_promotion: Math.random() > 0.7,
  })).map(row => ({
    ...row,
    total: row.quantity * row.unit_price * (1 - row.discount / 100)
  }))
}

// Demo kolon yapılandırması
const demoColumns: ColumnConfig[] = [
  { id: 'id', accessorKey: 'id', header: 'ID', type: 'number', width: 80, groupable: false },
  { id: 'date', accessorKey: 'date', header: 'Tarih', type: 'date', width: 120 },
  { id: 'category', accessorKey: 'category', header: 'Kategori', type: 'text', width: 120 },
  { id: 'product', accessorKey: 'product', header: 'Ürün', type: 'text', width: 150 },
  { id: 'city', accessorKey: 'city', header: 'Şehir', type: 'text', width: 120 },
  { id: 'store', accessorKey: 'store', header: 'Mağaza', type: 'text', width: 120 },
  { id: 'quantity', accessorKey: 'quantity', header: 'Adet', type: 'number', width: 100, aggregation: 'sum' },
  { id: 'unit_price', accessorKey: 'unit_price', header: 'Birim Fiyat', type: 'currency', width: 130 },
  { id: 'total', accessorKey: 'total', header: 'Toplam', type: 'currency', width: 130, aggregation: 'sum' },
  { id: 'discount', accessorKey: 'discount', header: 'İndirim %', type: 'percentage', width: 100, aggregation: 'avg' },
  { id: 'profit_margin', accessorKey: 'profit_margin', header: 'Kar Marjı %', type: 'percentage', width: 110, aggregation: 'avg' },
  { id: 'is_promotion', accessorKey: 'is_promotion', header: 'Promosyon', type: 'boolean', width: 100 },
]

export default function DataGridDemoPage() {
  const { theme, isDark } = useTheme()
  const { accessToken } = useAuthStore()
  
  // Mount kontrolü - sidebar navigasyonunda race condition önler
  const [isPageMounted, setIsPageMounted] = useState(false)
  const isMountedRef = useRef(false)
  
  useEffect(() => {
    isMountedRef.current = true
    // Component mount olduktan sonra bir frame bekle
    const timer = requestAnimationFrame(() => {
      if (isMountedRef.current) {
        setIsPageMounted(true)
      }
    })
    return () => {
      isMountedRef.current = false
      cancelAnimationFrame(timer)
    }
  }, [])
  
  // State - Basit ve temiz
  const [data, setData] = useState<any[]>([])
  const [columns, setColumns] = useState<ColumnConfig[]>([])
  const [loading, setLoading] = useState(false)
  const [dataSource, setDataSource] = useState<'demo' | 'api'>('demo')
  const [rowCount, setRowCount] = useState(1000)
  const [datasets, setDatasets] = useState<any[]>([])
  const [selectedDataset, setSelectedDataset] = useState('')
  const [totalRows, setTotalRows] = useState<number>(0)
  const [serverAggregates, setServerAggregates] = useState<ServerSideAggregates>({})

  // Dataset'leri yükle (sadece bir kez)
  useEffect(() => {
    if (!accessToken) return
    
    const loadDatasets = async () => {
      try {
        const response = await fetch(`${API_BASE}/data/datasets`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        const result = await response.json()
        if (result.success) {
          setDatasets(result.data || [])
        }
      } catch (error) {
        console.error('Failed to load datasets:', error)
      }
    }
    loadDatasets()
  }, [accessToken])

  // Demo veri yükle
  const loadDemoData = (count: number) => {
    setLoading(true)
    setData([])
    setColumns(demoColumns)
    setTotalRows(0)
    setServerAggregates({})
    
    setTimeout(() => {
      setData(generateDemoData(count))
      setLoading(false)
    }, 300)
  }

  // Dataset'ten veri yükle
  const loadDatasetData = async (datasetId: string) => {
    if (!accessToken || !datasetId) return

    setLoading(true)
    setData([])
    setColumns([])
    
    try {
      const response = await fetch(`${API_BASE}/data/datasets/${datasetId}/preview?limit=10000`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const result = await response.json()
      
      if (result.success && result.data?.rows && result.data.rows.length > 0) {
        const rows = result.data.rows
        setTotalRows(result.data.totalRows || rows.length)
        
        // Kolon yapılandırmasını otomatik oluştur
        const firstRow = rows[0]
        const numericColumns: string[] = []
        const cols: ColumnConfig[] = Object.keys(firstRow).map(key => {
          const value = firstRow[key]
          let type: ColumnConfig['type'] = 'text'
          let aggregation: ColumnConfig['aggregation'] = undefined
          
          if (typeof value === 'number') {
            const isCurrency = key.toLowerCase().includes('price') || 
                               key.toLowerCase().includes('total') || 
                               key.toLowerCase().includes('amount') || 
                               key.toLowerCase().includes('tutar') ||
                               key.toLowerCase().includes('fiyat')
            type = isCurrency ? 'currency' : 'number'
            aggregation = 'sum'
            numericColumns.push(key)
          } else if (typeof value === 'boolean') {
            type = 'boolean'
          } else if (value && typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-')) {
            type = 'date'
          }
          
          return {
            id: key,
            accessorKey: key,
            header: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            type,
            width: 150,
            aggregation
          }
        })
        
        setColumns(cols)
        setData(rows)
        
        // Server-side aggregates
        if (numericColumns.length > 0) {
          loadAggregates(datasetId, numericColumns)
        }
      } else {
        setData([])
        setColumns([])
        setTotalRows(0)
        setServerAggregates({})
      }
    } catch (error) {
      console.error('Failed to load dataset data:', error)
      setData([])
      setColumns([])
    } finally {
      setLoading(false)
    }
  }

  // Server-side aggregates yükle
  const loadAggregates = async (datasetId: string, numericColumns: string[]) => {
    if (!accessToken || numericColumns.length === 0) return

    try {
      const columnsParam = numericColumns.map(col => `${col}:sum`).join(',')
      const response = await fetch(`${API_BASE}/data/datasets/${datasetId}/aggregates?columns=${encodeURIComponent(columnsParam)}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      const result = await response.json()
      
      if (result.success && result.data) {
        if (result.data.totalCount) {
          setTotalRows(result.data.totalCount)
        }
        if (result.data.aggregates) {
          setServerAggregates(result.data.aggregates)
        }
      }
    } catch (error) {
      console.error('Failed to load aggregates:', error)
    }
  }

  // Kaynak değiştiğinde
  const handleDataSourceChange = (source: 'demo' | 'api') => {
    setDataSource(source)
    setSelectedDataset('')
    setData([])
    setColumns([])
    setTotalRows(0)
    setServerAggregates({})
    
    if (source === 'demo') {
      loadDemoData(rowCount)
    }
  }

  // Satır sayısı değiştiğinde (demo)
  const handleRowCountChange = (count: number) => {
    setRowCount(count)
    if (dataSource === 'demo') {
      loadDemoData(count)
    }
  }

  // Dataset seçildiğinde
  const handleDatasetChange = (datasetId: string) => {
    setSelectedDataset(datasetId)
    if (datasetId) {
      loadDatasetData(datasetId)
    } else {
      setData([])
      setColumns([])
    }
  }

  // Kaydedilmiş tasarım yüklendiğinde
  const handleDesignLoaded = async (info: LoadedDesignInfo) => {
    if (info.datasetId) {
      setDataSource('api')
      setSelectedDataset(info.datasetId)
      await loadDatasetData(info.datasetId)
    }
  }

  return (
    <div className={clsx('p-6 space-y-6', theme.mainBg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={clsx('text-2xl font-bold', theme.contentText)}>
            Enterprise DataGrid Demo
          </h1>
          <p className={clsx('text-sm mt-1', theme.contentTextMuted)}>
            Modern, özelleştirilebilir, kullanıcı tasarımı kaydedilebilir grid
          </p>
        </div>

        {/* Ayarlar */}
        <div className="flex items-center gap-4">
          {/* Veri Kaynağı */}
          <div className="flex items-center gap-2">
            <label className={clsx('text-sm', theme.contentText)}>Kaynak:</label>
            <select
              value={dataSource}
              onChange={(e) => handleDataSourceChange(e.target.value as any)}
              className={clsx(
                'px-3 py-1.5 rounded-lg border text-sm',
                isDark ? 'bg-[#21252E] text-gray-200 border-[#2F3542]' : 'bg-white text-gray-800 border-gray-300'
              )}
            >
              <option value="demo">Demo Veri</option>
              <option value="api">Dataset</option>
            </select>
          </div>

          {/* Demo veri satır sayısı */}
          {dataSource === 'demo' && (
            <div className="flex items-center gap-2">
              <label className={clsx('text-sm', theme.contentText)}>Satır:</label>
              <select
                value={rowCount}
                onChange={(e) => handleRowCountChange(Number(e.target.value))}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-sm',
                  isDark ? 'bg-[#21252E] text-gray-200 border-[#2F3542]' : 'bg-white text-gray-800 border-gray-300'
                )}
              >
                <option value={100}>100</option>
                <option value={1000}>1,000</option>
                <option value={10000}>10,000</option>
                <option value={50000}>50,000</option>
                <option value={100000}>100,000</option>
              </select>
            </div>
          )}

          {/* Dataset seçimi */}
          {dataSource === 'api' && (
            <div className="flex items-center gap-2">
              <label className={clsx('text-sm', theme.contentText)}>Dataset:</label>
              <select
                value={selectedDataset}
                onChange={(e) => handleDatasetChange(e.target.value)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg border text-sm min-w-[200px]',
                  isDark ? 'bg-[#21252E] text-gray-200 border-[#2F3542]' : 'bg-white text-gray-800 border-gray-300'
                )}
              >
                <option value="">Seçin...</option>
                {datasets.map((ds: any) => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Özellik Listesi */}
      <div className={clsx('grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3')}>
        {[
          { icon: '🔍', label: 'Arama & Filtre' },
          { icon: '↕️', label: 'Sıralama' },
          { icon: '📊', label: 'Gruplama' },
          { icon: '📁', label: 'Kolon Gizle' },
          { icon: '↔️', label: 'Kolon Sırala' },
          { icon: '📥', label: 'Excel/CSV' },
          { icon: '💾', label: 'Tasarım Kaydet' },
          { icon: '⚡', label: 'Virtual Scroll' },
        ].map((feature, i) => (
          <div
            key={i}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border',
              theme.border,
              isDark ? 'bg-white/5' : 'bg-slate-50'
            )}
          >
            <span className="text-lg">{feature.icon}</span>
            <span className={clsx('text-sm', theme.contentText)}>{feature.label}</span>
          </div>
        ))}
      </div>

      {/* DataGrid - Sayfa mount olduktan sonra render et */}
      {isPageMounted ? (
        <EnterpriseDataGrid
          gridId="demo-grid"
          data={data}
          columns={columns.length > 0 ? columns : demoColumns}
          datasetId={dataSource === 'api' ? selectedDataset : undefined}
          totalRows={dataSource === 'api' ? totalRows : undefined}
          serverSideAggregates={dataSource === 'api' ? serverAggregates : undefined}
          loading={loading}
          height={600}
          enableFiltering
          enableSorting
          enableGrouping
          enableColumnReorder
          enableColumnResize
          enableColumnHide
          enableExport
          enablePagination
          enableVirtualization
          enableRowSelection
          enableDensityToggle
          enablePivot
          autoLoadDefaultDesign={false}
          onDesignLoaded={handleDesignLoaded}
          onRowClick={(row) => {
            // Row clicked
          }}
          onSelectionChange={(rows) => {
            // Selection changed
          }}
        />
      ) : (
        <div 
          className={clsx(
            'flex items-center justify-center rounded-lg border',
            theme.border,
            isDark ? 'bg-[#181B21]' : 'bg-white'
          )}
          style={{ height: 600 }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" 
              style={{ borderColor: '#00CFDE', borderTopColor: 'transparent' }} 
            />
            <span className={theme.contentTextMuted}>Grid yükleniyor...</span>
          </div>
        </div>
      )}

      {/* Bilgi */}
      <div className={clsx('p-4 rounded-lg border', theme.border, isDark ? 'bg-blue-500/10' : 'bg-blue-50')}>
        <h3 className={clsx('font-semibold mb-2', theme.contentText)}>💡 Kullanım İpuçları</h3>
        <ul className={clsx('text-sm space-y-1', theme.contentTextMuted)}>
          <li>• <strong>Gruplama:</strong> Kolon başlığındaki ⊞ butonuna tıklayın veya sürükleyip bırakın</li>
          <li>• <strong>Sıralama:</strong> Kolon başlığına tıklayın (çoklu sıralama için Shift+tıklama)</li>
          <li>• <strong>Filtre:</strong> "Filtreler" butonuna tıklayarak filtre satırını açın</li>
          <li>• <strong>Kolon Gizle:</strong> "Kolonlar" menüsünden istediğiniz kolonları gizleyin</li>
          <li>• <strong>Kolon Sırala:</strong> Kolon başlıklarını sürükleyerek sırayı değiştirin</li>
          <li>• <strong>Tasarım Kaydet:</strong> Mevcut ayarları kaydedin ve sonra yeniden yükleyin</li>
          <li>• <strong>Export:</strong> Excel veya CSV olarak indirin</li>
        </ul>
      </div>
    </div>
  )
}
