import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  Database,
  Building2,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Search,
  Upload,
  Download,
  Loader2,
  Check,
  X
} from 'lucide-react'
import clsx from 'clsx'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface MasterDataTabProps {
  theme: any
  isDark: boolean
  accessToken: string | null
}

interface Store {
  id: string
  code: string
  name: string
  store_type: string
  ownership_group: string
  region_id: string
  region_name: string
  city: string
  district: string
  address: string
  phone: string
  email: string
  manager_name: string
  manager_email: string
  opening_date: string
  square_meters: number
  employee_count: number
  rent_amount: number
  target_revenue: number
}

interface Region {
  id: string
  code: string
  name: string
  description: string
  manager_name: string
  manager_email: string
}

interface OwnershipGroup {
  id: string
  code: string
  name: string
  description: string
  color: string
  icon: string
}

export function MasterDataTab({ theme, isDark, accessToken }: MasterDataTabProps) {
  // Tab State
  const [masterTab, setMasterTab] = useState<'stores' | 'regions' | 'groups'>('stores')
  const [masterSearchQuery, setMasterSearchQuery] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  
  // Data States
  const [allStores, setAllStores] = useState<Store[]>([])
  const [allRegions, setAllRegions] = useState<Region[]>([])
  const [ownershipGroups, setOwnershipGroups] = useState<OwnershipGroup[]>([])
  
  // Modal States
  const [showStoreModal, setShowStoreModal] = useState(false)
  const [showRegionModal, setShowRegionModal] = useState(false)
  const [showGroupModal, setShowGroupModal] = useState(false)
  
  // Editing States
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [editingRegion, setEditingRegion] = useState<Region | null>(null)
  const [editingGroup, setEditingGroup] = useState<OwnershipGroup | null>(null)
  
  // Form States
  const [storeForm, setStoreForm] = useState({
    code: '', name: '', store_type: 'MAGAZA', ownership_group: 'MERKEZ', region_id: '',
    city: '', district: '', address: '', phone: '', email: '', manager_name: '', manager_email: '',
    opening_date: '', square_meters: '', employee_count: '', rent_amount: '', target_revenue: ''
  })
  const [regionForm, setRegionForm] = useState({
    code: '', name: '', description: '', manager_name: '', manager_email: ''
  })
  const [groupForm, setGroupForm] = useState({
    code: '', name: '', description: '', color: '#3B82F6', icon: '🏢'
  })
  
  // Import States
  const [showImportModal, setShowImportModal] = useState<'stores' | 'regions' | null>(null)
  const [importData, setImportData] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  
  // Dataset Import States
  const [showDatasetImportModal, setShowDatasetImportModal] = useState(false)
  const [availableDatasets, setAvailableDatasets] = useState<any[]>([])
  const [selectedDatasetId, setSelectedDatasetId] = useState('')
  const [datasetColumns, setDatasetColumns] = useState<{ name: string; type: string }[]>([])
  const [datasetPreview, setDatasetPreview] = useState<any[]>([])
  const [datasetTotalRows, setDatasetTotalRows] = useState(0)
  const [datasetImportMapping, setDatasetImportMapping] = useState<Record<string, string>>({
    code: '', name: '', store_type: '', ownership_group: '', region_code: '', 
    city: '', district: '', address: '', phone: '', email: '', manager_name: ''
  })
  const [datasetImporting, setDatasetImporting] = useState(false)
  const [datasetImportResult, setDatasetImportResult] = useState<{ imported: number; updated: number; errors: string[] } | null>(null)

  // API helper
  const apiCall = useCallback(async (endpoint: string, options: any = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: response.statusText }))
      throw new Error(err.message || 'API hatası')
    }
    return response.json()
  }, [accessToken])

  // Load stores and regions
  const loadStoresAndRegions = useCallback(async () => {
    if (!accessToken) return
    try {
      // Get regions
      const regionsResult = await apiCall('/core/regions')
      setAllRegions(regionsResult.data || [])
      
      // Get stores
      const storesResult = await apiCall('/core/stores')
      setAllStores(storesResult.data || [])
      
      // Get ownership groups
      try {
        const groupsResult = await apiCall('/core/ownership-groups')
        setOwnershipGroups(groupsResult.data || [])
      } catch {
        setOwnershipGroups([
          { id: '1', code: 'MERKEZ', name: 'Merkez Mağazalar', description: '', color: '#3B82F6', icon: '🏢' },
          { id: '2', code: 'FRANCHISE', name: 'Franchise Mağazalar', description: '', color: '#10B981', icon: '🏪' }
        ])
      }
    } catch (err) {
      console.error('Master data yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Load datasets for import
  const loadDatasetsForImport = useCallback(async () => {
    if (!accessToken) return
    try {
      const result = await apiCall('/data/datasets')
      setAvailableDatasets(result.data || [])
    } catch (err) {
      console.error('Dataset listesi yüklenemedi:', err)
    }
  }, [accessToken, apiCall])

  // Load dataset preview
  const loadDatasetPreview = useCallback(async (datasetId: string) => {
    if (!datasetId) {
      setDatasetColumns([])
      setDatasetPreview([])
      setDatasetTotalRows(0)
      return
    }
    try {
      const result = await apiCall('/core/stores/import-from-dataset/preview', {
        method: 'POST',
        body: JSON.stringify({ datasetId })
      })
      if (result.success) {
        setDatasetColumns(result.data.columns || [])
        setDatasetPreview(result.data.preview || [])
        setDatasetTotalRows(result.data.totalRows || 0)
      }
    } catch (err) {
      console.error('Dataset önizleme yüklenemedi:', err)
    }
  }, [apiCall])

  // Import from dataset
  const importFromDataset = async () => {
    if (!selectedDatasetId || !datasetImportMapping.code) {
      toast.error('Lütfen dataset ve en az "Kod" alanını eşleştirin')
      return
    }
    
    setDatasetImporting(true)
    setDatasetImportResult(null)
    try {
      const cleanMapping: Record<string, string> = {}
      for (const [key, value] of Object.entries(datasetImportMapping)) {
        if (value) cleanMapping[key] = value
      }
      
      const result = await apiCall('/core/stores/import-from-dataset', {
        method: 'POST',
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          mapping: cleanMapping
        })
      })
      
      setDatasetImportResult({
        imported: result.imported || 0,
        updated: result.updated || 0,
        errors: result.errors || []
      })
      
      loadStoresAndRegions()
    } catch (err: any) {
      toast.error(err.message || 'Import başarısız')
    } finally {
      setDatasetImporting(false)
    }
  }

  // Save store
  const saveStore = async () => {
    setSaving('store')
    try {
      const payload = {
        ...storeForm,
        square_meters: storeForm.square_meters ? parseInt(storeForm.square_meters) : null,
        employee_count: storeForm.employee_count ? parseInt(storeForm.employee_count) : null,
        rent_amount: storeForm.rent_amount ? parseFloat(storeForm.rent_amount) : null,
        target_revenue: storeForm.target_revenue ? parseFloat(storeForm.target_revenue) : null,
        region_id: storeForm.region_id || null
      }
      
      if (editingStore) {
        await apiCall(`/core/stores/${editingStore.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        })
      } else {
        await apiCall('/core/stores', {
          method: 'POST',
          body: JSON.stringify(payload)
        })
      }
      setShowStoreModal(false)
      setEditingStore(null)
      setStoreForm({ code: '', name: '', store_type: 'MAGAZA', ownership_group: 'MERKEZ', region_id: '', city: '', district: '', address: '', phone: '', email: '', manager_name: '', manager_email: '', opening_date: '', square_meters: '', employee_count: '', rent_amount: '', target_revenue: '' })
      loadStoresAndRegions()
      toast.success(editingStore ? 'Mağaza güncellendi' : 'Mağaza eklendi')
    } catch (err: any) {
      toast.error(err.message || 'Mağaza kaydedilemedi')
    } finally {
      setSaving(null)
    }
  }

  // Save region
  const saveRegion = async () => {
    setSaving('region')
    try {
      if (editingRegion) {
        await apiCall(`/core/regions/${editingRegion.id}`, {
          method: 'PUT',
          body: JSON.stringify(regionForm)
        })
      } else {
        await apiCall('/core/regions', {
          method: 'POST',
          body: JSON.stringify(regionForm)
        })
      }
      setShowRegionModal(false)
      setEditingRegion(null)
      setRegionForm({ code: '', name: '', description: '', manager_name: '', manager_email: '' })
      loadStoresAndRegions()
      toast.success(editingRegion ? 'Bölge güncellendi' : 'Bölge eklendi')
    } catch (err: any) {
      toast.error(err.message || 'Bölge kaydedilemedi')
    } finally {
      setSaving(null)
    }
  }

  // Save group
  const saveGroup = async () => {
    setSaving('group')
    try {
      if (editingGroup) {
        await apiCall(`/core/ownership-groups/${editingGroup.id}`, {
          method: 'PUT',
          body: JSON.stringify(groupForm)
        })
      } else {
        await apiCall('/core/ownership-groups', {
          method: 'POST',
          body: JSON.stringify(groupForm)
        })
      }
      setShowGroupModal(false)
      setEditingGroup(null)
      setGroupForm({ code: '', name: '', description: '', color: '#3B82F6', icon: '🏢' })
      loadStoresAndRegions()
      toast.success(editingGroup ? 'Grup güncellendi' : 'Grup eklendi')
    } catch (err: any) {
      toast.error(err.message || 'Grup kaydedilemedi')
    } finally {
      setSaving(null)
    }
  }

  // Delete functions
  const deleteStore = async (id: string) => {
    if (!confirm('Bu mağazayı silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/stores/${id}`, { method: 'DELETE' })
      loadStoresAndRegions()
      toast.success('Mağaza silindi')
    } catch (err: any) {
      toast.error(err.message || 'Mağaza silinemedi')
    }
  }

  const deleteRegion = async (id: string) => {
    if (!confirm('Bu bölgeyi silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/regions/${id}`, { method: 'DELETE' })
      loadStoresAndRegions()
      toast.success('Bölge silindi')
    } catch (err: any) {
      toast.error(err.message || 'Bölge silinemedi')
    }
  }

  const deleteGroup = async (id: string) => {
    if (!confirm('Bu grubu silmek istediğinize emin misiniz?')) return
    try {
      await apiCall(`/core/ownership-groups/${id}`, { method: 'DELETE' })
      loadStoresAndRegions()
      toast.success('Grup silindi')
    } catch (err: any) {
      toast.error(err.message || 'Grup silinemedi')
    }
  }

  // CSV Import
  const handleImport = async () => {
    if (importData.length === 0) return
    setImporting(true)
    try {
      const endpoint = showImportModal === 'stores' ? '/core/stores/import' : '/core/regions/import'
      const result = await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({ data: importData })
      })
      toast.success(`${result.imported} kayıt başarıyla import edildi.${result.errors?.length ? ` ${result.errors.length} hata var.` : ''}`)
      setShowImportModal(null)
      setImportData([])
      loadStoresAndRegions()
    } catch (err: any) {
      toast.error(err.message || 'Import başarısız')
    } finally {
      setImporting(false)
    }
  }

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (event) => {
      let text = event.target?.result as string
      text = text.replace(/^\uFEFF/, '')
      
      const lines = text.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        toast.error('Dosya boş veya geçersiz format.')
        return
      }
      
      const firstLine = lines[0]
      const delimiter = firstLine.includes(';') ? ';' : ','
      
      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''))
      const data = lines.slice(1).map(line => {
        const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''))
        const obj: any = {}
        headers.forEach((h, i) => {
          obj[h] = values[i] || ''
        })
        return obj
      }).filter(row => Object.values(row).some(v => v))
      
      if (data.length === 0) {
        toast.error('Dosyada geçerli veri satırı bulunamadı.')
        return
      }
      
      setImportData(data)
    }
    reader.readAsText(file, 'UTF-8')
  }

  // Download template
  const downloadTemplate = (type: 'stores' | 'regions') => {
    const BOM = '\uFEFF'
    let csv = BOM
    
    if (type === 'stores') {
      csv += 'code;name;store_type;ownership_group;region_code;city;district;address;phone;email;manager_name\n'
      csv += 'ORNEK001;İstanbul Kadıköy Şube;MAGAZA;MERKEZ;MARMARA;İstanbul;Kadıköy;Bahariye Cad. No:123;0216 123 4567;kadikoy@sirket.com;Ahmet Yılmaz\n'
    } else {
      csv += 'code;name;description;manager_name;manager_email\n'
      csv += 'MARMARA;Marmara Bölgesi;İstanbul, Kocaeli, Bursa;Ali Veli;marmara@sirket.com\n'
    }
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${type}_sablon.csv`
    link.click()
  }

  // Effects
  useEffect(() => {
    loadStoresAndRegions()
  }, [loadStoresAndRegions])

  useEffect(() => {
    if (showDatasetImportModal) {
      loadDatasetsForImport()
    }
  }, [showDatasetImportModal, loadDatasetsForImport])

  useEffect(() => {
    if (selectedDatasetId) {
      loadDatasetPreview(selectedDatasetId)
    }
  }, [selectedDatasetId, loadDatasetPreview])

  // Helper to format date for input
  const formatDateForInput = (dateStr: string | null) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toISOString().split('T')[0]
    } catch {
      return ''
    }
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={clsx('p-3 rounded-2xl', isDark ? 'bg-emerald-500/20' : 'bg-emerald-100')}>
            <Database size={24} className={isDark ? 'text-emerald-400' : 'text-emerald-600'} />
          </div>
          <div>
            <h1 className={clsx('text-xl font-bold', theme.contentText)}>Master Veriler</h1>
            <p className={clsx('text-sm', theme.contentTextMuted)}>Mağaza, bölge ve grup verilerini yönetin</p>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className={clsx('p-1 rounded-xl flex gap-1', theme.cardBg)}>
        {[
          { id: 'stores', label: 'Mağazalar', icon: Building2, count: allStores.length },
          { id: 'regions', label: 'Bölgeler', icon: MapPin, count: allRegions.length },
          { id: 'groups', label: 'Gruplar', icon: Database, count: ownershipGroups.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMasterTab(tab.id as any)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
              masterTab === tab.id
                ? clsx('shadow-sm', isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white text-emerald-600')
                : clsx(theme.contentTextMuted, 'hover:bg-white/50 dark:hover:bg-white/5')
            )}
          >
            <tab.icon size={18} />
            {tab.label}
            <span className={clsx('px-2 py-0.5 rounded-full text-xs', isDark ? 'bg-white/10' : 'bg-gray-200')}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Stores Tab */}
      {masterTab === 'stores' && (
        <div className={clsx('rounded-2xl border p-6', theme.cardBg, theme.border)}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Mağaza ara..."
                value={masterSearchQuery}
                onChange={(e) => setMasterSearchQuery(e.target.value)}
                className={clsx('px-4 py-2 rounded-xl text-sm w-64', theme.inputBg, theme.inputText)}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplate('stores')}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                <Download size={16} />
                Şablon İndir
              </button>
              <button
                onClick={() => setShowImportModal('stores')}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                <Upload size={16} />
                CSV Import
              </button>
              <button
                onClick={() => {
                  setShowDatasetImportModal(true)
                  setSelectedDatasetId('')
                  setDatasetImportMapping({ code: '', name: '', store_type: '', ownership_group: '', region_code: '', city: '', district: '', address: '', phone: '', email: '', manager_name: '' })
                  setDatasetImportResult(null)
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-white bg-blue-500 hover:bg-blue-600"
              >
                <Database size={16} />
                Dataset'ten Import
              </button>
              <button
                onClick={() => {
                  setEditingStore(null)
                  setStoreForm({ code: '', name: '', store_type: 'MAGAZA', ownership_group: 'MERKEZ', region_id: '', city: '', district: '', address: '', phone: '', email: '', manager_name: '', manager_email: '', opening_date: '', square_meters: '', employee_count: '', rent_amount: '', target_revenue: '' })
                  setShowStoreModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
              >
                <Plus size={16} />
                Mağaza Ekle
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={clsx('border-b', theme.border)}>
                  <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Kod</th>
                  <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Mağaza Adı</th>
                  <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Tip</th>
                  <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Grup</th>
                  <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Bölge</th>
                  <th className={clsx('px-4 py-3 text-left text-xs font-medium uppercase', theme.contentTextMuted)}>Şehir</th>
                  <th className={clsx('px-4 py-3 text-right text-xs font-medium uppercase', theme.contentTextMuted)}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {allStores
                  .filter(s => !masterSearchQuery || s.name?.toLowerCase().includes(masterSearchQuery.toLowerCase()) || s.code?.toLowerCase().includes(masterSearchQuery.toLowerCase()))
                  .map((store) => (
                  <tr key={store.id} className={clsx('border-b hover:bg-gray-50 dark:hover:bg-gray-800/50', theme.border)}>
                    <td className={clsx('px-4 py-3 text-sm font-mono', theme.contentText)}>{store.code}</td>
                    <td className={clsx('px-4 py-3 text-sm font-medium', theme.contentText)}>{store.name}</td>
                    <td className="px-4 py-3">
                      <span className={clsx(
                        'px-2.5 py-1 rounded-full text-xs font-semibold',
                        store.store_type === 'MERKEZ' ? 'bg-blue-500 text-white' :
                        store.store_type === 'MAGAZA' ? 'bg-emerald-500 text-white' :
                        store.store_type === 'DEPO' ? 'bg-amber-500 text-white' :
                        store.store_type === 'FRANCHISE' ? 'bg-purple-500 text-white' :
                        'bg-gray-500 text-white'
                      )}>
                        {store.store_type}
                      </span>
                    </td>
                    <td className={clsx('px-4 py-3 text-sm', theme.contentText)}>{store.ownership_group || '-'}</td>
                    <td className={clsx('px-4 py-3 text-sm', theme.contentText)}>{store.region_name || '-'}</td>
                    <td className={clsx('px-4 py-3 text-sm', theme.contentText)}>{store.city || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingStore(store)
                            setStoreForm({
                              code: store.code || '',
                              name: store.name || '',
                              store_type: store.store_type || 'MAGAZA',
                              ownership_group: store.ownership_group || 'MERKEZ',
                              region_id: store.region_id || '',
                              city: store.city || '',
                              district: store.district || '',
                              address: store.address || '',
                              phone: store.phone || '',
                              email: store.email || '',
                              manager_name: store.manager_name || '',
                              manager_email: store.manager_email || '',
                              opening_date: formatDateForInput(store.opening_date),
                              square_meters: store.square_meters?.toString() || '',
                              employee_count: store.employee_count?.toString() || '',
                              rent_amount: store.rent_amount?.toString() || '',
                              target_revenue: store.target_revenue?.toString() || ''
                            })
                            setShowStoreModal(true)
                          }}
                          className={clsx('p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => deleteStore(store.id)}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allStores.length === 0 && (
              <div className={clsx('text-center py-12', theme.contentTextMuted)}>
                <Building2 size={48} className="mx-auto mb-4 opacity-50" />
                <p>Henüz mağaza eklenmemiş</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regions Tab */}
      {masterTab === 'regions' && (
        <div className={clsx('rounded-2xl border p-6', theme.cardBg, theme.border)}>
          <div className="flex items-center justify-between mb-6">
            <input
              type="text"
              placeholder="Bölge ara..."
              value={masterSearchQuery}
              onChange={(e) => setMasterSearchQuery(e.target.value)}
              className={clsx('px-4 py-2 rounded-xl text-sm w-64', theme.inputBg, theme.inputText)}
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => downloadTemplate('regions')}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                <Download size={16} />
                Şablon İndir
              </button>
              <button
                onClick={() => setShowImportModal('regions')}
                className={clsx('flex items-center gap-2 px-3 py-2 rounded-xl text-sm', theme.contentTextMuted, 'hover:bg-gray-100 dark:hover:bg-gray-800')}
              >
                <Upload size={16} />
                CSV Import
              </button>
              <button
                onClick={() => {
                  setEditingRegion(null)
                  setRegionForm({ code: '', name: '', description: '', manager_name: '', manager_email: '' })
                  setShowRegionModal(true)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
              >
                <Plus size={16} />
                Bölge Ekle
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {allRegions
              .filter(r => !masterSearchQuery || r.name?.toLowerCase().includes(masterSearchQuery.toLowerCase()) || r.code?.toLowerCase().includes(masterSearchQuery.toLowerCase()))
              .map((region) => (
              <div key={region.id} className={clsx('rounded-xl border p-4', theme.cardBg, theme.border)}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MapPin size={18} className="text-emerald-500" />
                    <span className={clsx('font-medium', theme.contentText)}>{region.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingRegion(region)
                        setRegionForm({
                          code: region.code || '',
                          name: region.name || '',
                          description: region.description || '',
                          manager_name: region.manager_name || '',
                          manager_email: region.manager_email || ''
                        })
                        setShowRegionModal(true)
                      }}
                      className={clsx('p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => deleteRegion(region.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className={clsx('text-xs font-mono', theme.contentTextMuted)}>{region.code}</p>
                {region.description && (
                  <p className={clsx('text-sm mt-2', theme.contentTextMuted)}>{region.description}</p>
                )}
              </div>
            ))}
          </div>
          {allRegions.length === 0 && (
            <div className={clsx('text-center py-12', theme.contentTextMuted)}>
              <MapPin size={48} className="mx-auto mb-4 opacity-50" />
              <p>Henüz bölge eklenmemiş</p>
            </div>
          )}
        </div>
      )}

      {/* Groups Tab */}
      {masterTab === 'groups' && (
        <div className={clsx('rounded-2xl border p-6', theme.cardBg, theme.border)}>
          <div className="flex items-center justify-between mb-6">
            <input
              type="text"
              placeholder="Grup ara..."
              value={masterSearchQuery}
              onChange={(e) => setMasterSearchQuery(e.target.value)}
              className={clsx('px-4 py-2 rounded-xl text-sm w-64', theme.inputBg, theme.inputText)}
            />
            <button
              onClick={() => {
                setEditingGroup(null)
                setGroupForm({ code: '', name: '', description: '', color: '#3B82F6', icon: '🏢' })
                setShowGroupModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600"
            >
              <Plus size={16} />
              Grup Ekle
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownershipGroups
              .filter(g => !masterSearchQuery || g.name?.toLowerCase().includes(masterSearchQuery.toLowerCase()) || g.code?.toLowerCase().includes(masterSearchQuery.toLowerCase()))
              .map((group) => (
              <div key={group.id} className={clsx('rounded-xl border p-4', theme.cardBg, theme.border)} style={{ borderLeftColor: group.color, borderLeftWidth: 4 }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{group.icon}</span>
                    <span className={clsx('font-medium', theme.contentText)}>{group.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingGroup(group)
                        setGroupForm({
                          code: group.code || '',
                          name: group.name || '',
                          description: group.description || '',
                          color: group.color || '#3B82F6',
                          icon: group.icon || '🏢'
                        })
                        setShowGroupModal(true)
                      }}
                      className={clsx('p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700', theme.contentTextMuted)}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <p className={clsx('text-xs font-mono', theme.contentTextMuted)}>{group.code}</p>
              </div>
            ))}
          </div>
          {ownershipGroups.length === 0 && (
            <div className={clsx('text-center py-12', theme.contentTextMuted)}>
              <Database size={48} className="mx-auto mb-4 opacity-50" />
              <p>Henüz grup eklenmemiş</p>
            </div>
          )}
        </div>
      )}

      {/* Store Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx('text-lg font-bold', theme.contentText)}>
                {editingStore ? 'Mağaza Düzenle' : 'Yeni Mağaza'}
              </h2>
              <button onClick={() => setShowStoreModal(false)} className={theme.contentTextMuted}>
                <X size={20} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Kod *</label>
                <input
                  type="text"
                  value={storeForm.code}
                  onChange={(e) => setStoreForm({ ...storeForm, code: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  placeholder="STR001"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Ad *</label>
                <input
                  type="text"
                  value={storeForm.name}
                  onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  placeholder="Kadıköy Şubesi"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Tip</label>
                <select
                  value={storeForm.store_type}
                  onChange={(e) => setStoreForm({ ...storeForm, store_type: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                >
                  <option value="MAGAZA">Mağaza</option>
                  <option value="MERKEZ">Merkez</option>
                  <option value="DEPO">Depo</option>
                  <option value="FRANCHISE">Franchise</option>
                </select>
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Grup</label>
                <select
                  value={storeForm.ownership_group}
                  onChange={(e) => setStoreForm({ ...storeForm, ownership_group: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                >
                  {ownershipGroups.map(g => (
                    <option key={g.code} value={g.code}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Bölge</label>
                <select
                  value={storeForm.region_id}
                  onChange={(e) => setStoreForm({ ...storeForm, region_id: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                >
                  <option value="">Seçiniz</option>
                  {allRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Şehir</label>
                <input
                  type="text"
                  value={storeForm.city}
                  onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>İlçe</label>
                <input
                  type="text"
                  value={storeForm.district}
                  onChange={(e) => setStoreForm({ ...storeForm, district: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Telefon</label>
                <input
                  type="text"
                  value={storeForm.phone}
                  onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
              <div className="col-span-2">
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Adres</label>
                <input
                  type="text"
                  value={storeForm.address}
                  onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowStoreModal(false)}
                className={clsx('px-4 py-2 rounded-lg text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={saveStore}
                disabled={saving === 'store' || !storeForm.code || !storeForm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving === 'store' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Region Modal */}
      {showRegionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl p-6 w-full max-w-md', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx('text-lg font-bold', theme.contentText)}>
                {editingRegion ? 'Bölge Düzenle' : 'Yeni Bölge'}
              </h2>
              <button onClick={() => setShowRegionModal(false)} className={theme.contentTextMuted}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Kod *</label>
                <input
                  type="text"
                  value={regionForm.code}
                  onChange={(e) => setRegionForm({ ...regionForm, code: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  placeholder="MARMARA"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Ad *</label>
                <input
                  type="text"
                  value={regionForm.name}
                  onChange={(e) => setRegionForm({ ...regionForm, name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  placeholder="Marmara Bölgesi"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Açıklama</label>
                <textarea
                  value={regionForm.description}
                  onChange={(e) => setRegionForm({ ...regionForm, description: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  rows={2}
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Yönetici</label>
                <input
                  type="text"
                  value={regionForm.manager_name}
                  onChange={(e) => setRegionForm({ ...regionForm, manager_name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRegionModal(false)}
                className={clsx('px-4 py-2 rounded-lg text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={saveRegion}
                disabled={saving === 'region' || !regionForm.code || !regionForm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving === 'region' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl p-6 w-full max-w-md', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx('text-lg font-bold', theme.contentText)}>
                {editingGroup ? 'Grup Düzenle' : 'Yeni Grup'}
              </h2>
              <button onClick={() => setShowGroupModal(false)} className={theme.contentTextMuted}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Kod *</label>
                <input
                  type="text"
                  value={groupForm.code}
                  onChange={(e) => setGroupForm({ ...groupForm, code: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  placeholder="MERKEZ"
                />
              </div>
              <div>
                <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Ad *</label>
                <input
                  type="text"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                  placeholder="Merkez Mağazalar"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>Renk</label>
                  <input
                    type="color"
                    value={groupForm.color}
                    onChange={(e) => setGroupForm({ ...groupForm, color: e.target.value })}
                    className="w-full h-10 rounded-lg cursor-pointer"
                  />
                </div>
                <div className="flex-1">
                  <label className={clsx('block text-sm font-medium mb-1', theme.contentText)}>İkon</label>
                  <input
                    type="text"
                    value={groupForm.icon}
                    onChange={(e) => setGroupForm({ ...groupForm, icon: e.target.value })}
                    className={clsx('w-full px-3 py-2 rounded-lg text-sm text-center', theme.inputBg, theme.inputText)}
                    placeholder="🏢"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowGroupModal(false)}
                className={clsx('px-4 py-2 rounded-lg text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={saveGroup}
                disabled={saving === 'group' || !groupForm.code || !groupForm.name}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50"
              >
                {saving === 'group' ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl p-6 w-full max-w-lg', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx('text-lg font-bold', theme.contentText)}>
                {showImportModal === 'stores' ? 'Mağaza' : 'Bölge'} Import
              </h2>
              <button onClick={() => { setShowImportModal(null); setImportData([]) }} className={theme.contentTextMuted}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>CSV Dosyası Seçin</label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                />
              </div>

              {importData.length > 0 && (
                <div className={clsx('p-3 rounded-lg', isDark ? 'bg-green-500/20' : 'bg-green-100')}>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {importData.length} kayıt okundu. Import edilmeye hazır.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => { setShowImportModal(null); setImportData([]) }}
                className={clsx('px-4 py-2 rounded-lg text-sm', theme.contentTextMuted)}
              >
                İptal
              </button>
              <button
                onClick={handleImport}
                disabled={importing || importData.length === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Import Et
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dataset Import Modal */}
      {showDatasetImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className={clsx('rounded-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto', theme.cardBg)}>
            <div className="flex items-center justify-between mb-6">
              <h2 className={clsx('text-lg font-bold', theme.contentText)}>Dataset'ten Mağaza Import</h2>
              <button onClick={() => setShowDatasetImportModal(false)} className={theme.contentTextMuted}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Dataset Selection */}
              <div>
                <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Dataset Seçin</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className={clsx('w-full px-3 py-2 rounded-lg text-sm', theme.inputBg, theme.inputText)}
                >
                  <option value="">Seçiniz...</option>
                  {availableDatasets.map(ds => (
                    <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
              </div>

              {/* Column Mapping */}
              {datasetColumns.length > 0 && (
                <div>
                  <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>Kolon Eşleştirme</label>
                  <div className="grid grid-cols-2 gap-3">
                    {Object.keys(datasetImportMapping).map(field => (
                      <div key={field} className="flex items-center gap-2">
                        <span className={clsx('text-sm w-24', theme.contentTextMuted)}>{field}:</span>
                        <select
                          value={datasetImportMapping[field]}
                          onChange={(e) => setDatasetImportMapping({ ...datasetImportMapping, [field]: e.target.value })}
                          className={clsx('flex-1 px-2 py-1 rounded text-sm', theme.inputBg, theme.inputText)}
                        >
                          <option value="">-</option>
                          {datasetColumns.map(col => (
                            <option key={col.name} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview */}
              {datasetPreview.length > 0 && (
                <div>
                  <p className={clsx('text-sm mb-2', theme.contentTextMuted)}>
                    Önizleme (toplam {datasetTotalRows} kayıt)
                  </p>
                  <div className="overflow-x-auto max-h-48">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className={clsx('border-b', theme.border)}>
                          {datasetColumns.slice(0, 6).map(col => (
                            <th key={col.name} className={clsx('px-2 py-1 text-left', theme.contentTextMuted)}>{col.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {datasetPreview.slice(0, 5).map((row, i) => (
                          <tr key={i} className={clsx('border-b', theme.border)}>
                            {datasetColumns.slice(0, 6).map(col => (
                              <td key={col.name} className={clsx('px-2 py-1', theme.contentText)}>{row[col.name]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Result */}
              {datasetImportResult && (
                <div className={clsx('p-4 rounded-lg', datasetImportResult.errors.length > 0 ? 'bg-yellow-500/20' : 'bg-green-500/20')}>
                  <p className={clsx('text-sm font-medium', datasetImportResult.errors.length > 0 ? 'text-yellow-600' : 'text-green-600')}>
                    {datasetImportResult.imported} yeni kayıt eklendi, {datasetImportResult.updated} kayıt güncellendi
                    {datasetImportResult.errors.length > 0 && ` (${datasetImportResult.errors.length} hata)`}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowDatasetImportModal(false)}
                className={clsx('px-4 py-2 rounded-lg text-sm', theme.contentTextMuted)}
              >
                Kapat
              </button>
              <button
                onClick={importFromDataset}
                disabled={datasetImporting || !selectedDatasetId || !datasetImportMapping.code}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50"
              >
                {datasetImporting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
                Import Et
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
