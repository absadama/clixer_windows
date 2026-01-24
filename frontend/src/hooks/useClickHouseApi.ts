/**
 * Clixer - ClickHouse API Hook
 * ClickHouse tablo işlemleri ve veri yönetimi
 */

import { useCallback } from 'react'
import toast from 'react-hot-toast'

interface UseClickHouseApiProps {
  apiCall: (endpoint: string, options?: RequestInit) => Promise<any>
  loadClickhouseTables: () => Promise<void>
  loadETLJobs: () => Promise<void>
  // State setters
  setSystemActionLoading: (v: string | null) => void
  setSelectedChTable: (v: any) => void
  setShowChTableModal: (v: boolean) => void
  setShowDataManagementModal: (v: boolean) => void
  setDataManagementTable: (v: string) => void
  setDataManagementDatasetId: (v: string) => void
  setDataManagementColumns: (v: any[]) => void
  setDataManagementLoading: (v: boolean) => void
  setDataManagementPreview: (v: any) => void
  setDmDateColumn: (v: string) => void
  setDmDays: (v: number) => void
  setDmStartDate: (v: string) => void
  setDmEndDate: (v: string) => void
  setDmActiveTab: (v: 'delete' | 'validate') => void
  setComparisonData: (v: any) => void
  setMissingRanges: (v: any) => void
  setDuplicateAnalysis: (v: any) => void
  setValidationLoading: (v: boolean) => void
  // State values
  dataManagementTable: string
  dataManagementDatasetId: string
  dataManagementPreview: any
  dmDateColumn: string
  dmDeleteMode: 'days' | 'range'
  dmDays: number
  dmStartDate: string
  dmEndDate: string
  pkColumn: string
  comparisonData: any
  missingRanges: any
}

export function useClickHouseApi(props: UseClickHouseApiProps) {
  const {
    apiCall, loadClickhouseTables, loadETLJobs,
    setSystemActionLoading, setSelectedChTable, setShowChTableModal,
    setShowDataManagementModal, setDataManagementTable, setDataManagementDatasetId,
    setDataManagementColumns, setDataManagementLoading, setDataManagementPreview,
    setDmDateColumn, setDmDays, setDmStartDate, setDmEndDate, setDmActiveTab,
    setComparisonData, setMissingRanges, setDuplicateAnalysis, setValidationLoading,
    dataManagementTable, dataManagementDatasetId, dataManagementPreview,
    dmDateColumn, dmDeleteMode, dmDays, dmStartDate, dmEndDate, pkColumn,
    comparisonData, missingRanges
  } = props

  // View ClickHouse table details
  const viewChTableDetails = useCallback(async (tableName: string) => {
    try {
      const result = await apiCall(`/data/clickhouse/tables/${tableName}`)
      setSelectedChTable(result.data)
      setShowChTableModal(true)
    } catch (err: any) {
      toast.error('Tablo detayları yüklenemedi: ' + err.message)
    }
  }, [apiCall, setSelectedChTable, setShowChTableModal])

  // Truncate ClickHouse table
  const truncateChTable = useCallback(async (tableName: string) => {
    if (!confirm(`"${tableName}" tablosundaki TÜM VERİLER silinecek. Devam etmek istiyor musunuz?`)) return
    setSystemActionLoading(`ch-truncate-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}/truncate`, { method: 'POST' })
      await loadClickhouseTables()
      toast.success('Tablo temizlendi')
    } catch (err: any) {
      toast.error('Tablo temizlenemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }, [apiCall, loadClickhouseTables, setSystemActionLoading])

  // Optimize ClickHouse table
  const optimizeChTable = useCallback(async (tableName: string) => {
    setSystemActionLoading(`ch-optimize-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}/optimize`, { method: 'POST' })
      await loadClickhouseTables()
      toast.success('Tablo optimize edildi (duplicate\'lar temizlendi)')
    } catch (err: any) {
      toast.error('Optimize edilemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }, [apiCall, loadClickhouseTables, setSystemActionLoading])

  // Delete ClickHouse table
  const deleteChTable = useCallback(async (tableName: string) => {
    if (!confirm(`"${tableName}" tablosu tamamen silinecek. Bu işlem geri alınamaz! Devam etmek istiyor musunuz?`)) return
    setSystemActionLoading(`ch-delete-${tableName}`)
    try {
      await apiCall(`/data/clickhouse/tables/${tableName}`, { method: 'DELETE' })
      await loadClickhouseTables()
      toast.success('Tablo silindi')
    } catch (err: any) {
      toast.error('Tablo silinemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }, [apiCall, loadClickhouseTables, setSystemActionLoading])

  // Open Data Management Modal
  const openDataManagementModal = useCallback(async (tableName: string, datasetId?: string) => {
    setDataManagementTable(tableName)
    setDataManagementDatasetId(datasetId || '')
    setDataManagementPreview(null)
    setDmDateColumn('')
    setDmDays(7)
    setDmStartDate('')
    setDmEndDate('')
    setDmActiveTab('delete')
    setComparisonData(null)
    setMissingRanges(null)
    setDuplicateAnalysis(null)
    setShowDataManagementModal(true)
    
    try {
      const result = await apiCall(`/data/clickhouse/tables/${tableName}/columns`)
      setDataManagementColumns(result.data || [])
      const dateCol = (result.data || []).find((c: any) => c.isDateColumn)
      if (dateCol) setDmDateColumn(dateCol.name)
    } catch (err) {
      console.error('Kolonlar yüklenemedi:', err)
    }
  }, [apiCall, setDataManagementTable, setDataManagementDatasetId, setDataManagementPreview,
      setDmDateColumn, setDmDays, setDmStartDate, setDmEndDate, setDmActiveTab,
      setComparisonData, setMissingRanges, setDuplicateAnalysis, setShowDataManagementModal,
      setDataManagementColumns])

  // Load Comparison
  const loadComparison = useCallback(async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı. Lütfen dataset listesinden açın.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/compare?pkColumn=${pkColumn}`)
      setComparisonData(result.data)
    } catch (err: any) {
      toast.error('Karşılaştırma yapılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }, [apiCall, dataManagementDatasetId, pkColumn, setComparisonData, setValidationLoading])

  // Load Missing Ranges
  const loadMissingRanges = useCallback(async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/missing-ranges?pkColumn=${pkColumn}`)
      setMissingRanges(result.data)
    } catch (err: any) {
      toast.error('Eksik aralıklar bulunamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }, [apiCall, dataManagementDatasetId, pkColumn, setMissingRanges, setValidationLoading])

  // Load Duplicate Analysis
  const loadDuplicateAnalysis = useCallback(async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı.')
      return
    }
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/duplicate-analysis`)
      setDuplicateAnalysis(result.data)
    } catch (err: any) {
      toast.error('Duplicate analizi yapılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }, [apiCall, dataManagementDatasetId, setDuplicateAnalysis, setValidationLoading])

  // Sync Missing Data
  const syncMissingData = useCallback(async () => {
    if (!dataManagementDatasetId || !missingRanges?.missing_ranges?.length) {
      toast.error('Önce eksik aralıkları bulun.')
      return
    }
    if (!confirm(`${missingRanges.missing_ranges.length} aralıktaki eksik veriler çekilecek. Devam?`)) return
    
    setValidationLoading(true)
    try {
      await apiCall(`/data/datasets/${dataManagementDatasetId}/sync-missing`, {
        method: 'POST',
        body: JSON.stringify({ ranges: missingRanges.missing_ranges, pkColumn })
      })
      toast.success('Eksik veri sync işlemi başlatıldı.')
      loadETLJobs()
    } catch (err: any) {
      toast.error('Sync başlatılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }, [apiCall, dataManagementDatasetId, missingRanges, pkColumn, loadETLJobs, setValidationLoading])

  // Sync New Records Only
  const syncNewRecordsOnly = useCallback(async () => {
    if (!dataManagementDatasetId) {
      toast.error('Dataset ID bulunamadı.')
      return
    }
    const chMaxId = comparisonData?.clickhouse?.max_id || 0
    if (!confirm(`ClickHouse'daki max ID: ${chMaxId.toLocaleString('tr-TR')}\n\nBu ID'den sonraki TÜM kayıtlar kaynaktan çekilecek.\n\nDevam?`)) return
    
    setValidationLoading(true)
    try {
      const result = await apiCall(`/data/datasets/${dataManagementDatasetId}/sync-new-records`, {
        method: 'POST',
        body: JSON.stringify({ pkColumn })
      })
      toast.success(`Yeni kayıt sync başlatıldı! Max ID: ${result.data.clickhouse_max_id}'den sonraki kayıtlar çekilecek.`)
      loadETLJobs()
    } catch (err: any) {
      toast.error('Sync başlatılamadı: ' + err.message)
    } finally {
      setValidationLoading(false)
    }
  }, [apiCall, dataManagementDatasetId, comparisonData, pkColumn, loadETLJobs, setValidationLoading])

  // Preview Delete
  const previewDataManagementDelete = useCallback(async () => {
    if (!dmDateColumn) {
      toast.error('Lütfen tarih kolonu seçin')
      return
    }
    setDataManagementLoading(true)
    try {
      const params = new URLSearchParams({ dateColumn: dmDateColumn })
      if (dmDeleteMode === 'days') {
        params.append('days', dmDays.toString())
      } else {
        params.append('startDate', dmStartDate)
        params.append('endDate', dmEndDate)
      }
      const result = await apiCall(`/data/clickhouse/tables/${dataManagementTable}/preview-delete?${params}`)
      setDataManagementPreview(result.data)
    } catch (err: any) {
      toast.error('Önizleme hatası: ' + err.message)
    } finally {
      setDataManagementLoading(false)
    }
  }, [apiCall, dataManagementTable, dmDateColumn, dmDeleteMode, dmDays, dmStartDate, dmEndDate, setDataManagementLoading, setDataManagementPreview])

  // Execute Delete
  const executeDataManagementDelete = useCallback(async () => {
    if (!dataManagementPreview || dataManagementPreview.rowsToDelete === 0) {
      toast.error('Silinecek veri yok')
      return
    }
    if (!confirm(`${dataManagementPreview.rowsToDelete.toLocaleString('tr-TR')} satır silinecek. Devam etmek istiyor musunuz?`)) return
    
    setDataManagementLoading(true)
    try {
      const body: any = { dateColumn: dmDateColumn }
      if (dmDeleteMode === 'days') {
        body.days = dmDays
      } else {
        body.startDate = dmStartDate
        body.endDate = dmEndDate
      }
      const result = await apiCall(`/data/clickhouse/tables/${dataManagementTable}/rows`, { 
        method: 'DELETE',
        body: JSON.stringify(body)
      })
      toast.success(result.data?.message || 'Silme işlemi başlatıldı')
      setShowDataManagementModal(false)
      await loadClickhouseTables()
    } catch (err: any) {
      toast.error('Silme hatası: ' + err.message)
    } finally {
      setDataManagementLoading(false)
    }
  }, [apiCall, dataManagementTable, dataManagementPreview, dmDateColumn, dmDeleteMode, dmDays, dmStartDate, dmEndDate, loadClickhouseTables, setDataManagementLoading, setShowDataManagementModal])

  return {
    viewChTableDetails,
    truncateChTable,
    optimizeChTable,
    deleteChTable,
    openDataManagementModal,
    loadComparison,
    loadMissingRanges,
    loadDuplicateAnalysis,
    syncMissingData,
    syncNewRecordsOnly,
    previewDataManagementDelete,
    executeDataManagementDelete,
  }
}
