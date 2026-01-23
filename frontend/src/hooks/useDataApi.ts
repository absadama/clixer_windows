/**
 * Data API Hook
 * Centralized API calls for DataPage
 */

import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface ApiOptions extends RequestInit {
  showSuccessToast?: boolean
  showErrorToast?: boolean
  successMessage?: string
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

export function useDataApi() {
  const { accessToken } = useAuthStore()

  /**
   * Generic API call with error handling
   */
  const apiCall = useCallback(async <T = any>(
    endpoint: string, 
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> => {
    const { 
      showSuccessToast = false, 
      showErrorToast = true,
      successMessage,
      ...fetchOptions 
    } = options

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...fetchOptions.headers,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'API hatası')
      }

      if (showSuccessToast && successMessage) {
        toast.success(successMessage)
      }

      return { success: true, data: data.data, message: data.message }
    } catch (err: any) {
      if (showErrorToast) {
        toast.error(err.message || 'Bir hata oluştu')
      }
      return { success: false, message: err.message }
    }
  }, [accessToken])

  // ============================================
  // CONNECTION API
  // ============================================

  const getConnections = useCallback(async () => {
    return apiCall('/data/connections')
  }, [apiCall])

  const createConnection = useCallback(async (data: any) => {
    return apiCall('/data/connections', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Bağlantı oluşturuldu'
    })
  }, [apiCall])

  const updateConnection = useCallback(async (id: string, data: any) => {
    return apiCall(`/data/connections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Bağlantı güncellendi'
    })
  }, [apiCall])

  const deleteConnection = useCallback(async (id: string) => {
    return apiCall(`/data/connections/${id}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Bağlantı silindi'
    })
  }, [apiCall])

  const testConnection = useCallback(async (data: any) => {
    return apiCall('/data/connections/test', {
      method: 'POST',
      body: JSON.stringify(data),
      showErrorToast: false
    })
  }, [apiCall])

  const getConnectionTables = useCallback(async (connectionId: string) => {
    return apiCall(`/data/connections/${connectionId}/tables`)
  }, [apiCall])

  const getTableColumns = useCallback(async (connectionId: string, tableName: string) => {
    return apiCall(`/data/connections/${connectionId}/tables/${encodeURIComponent(tableName)}/columns`)
  }, [apiCall])

  // ============================================
  // DATASET API
  // ============================================

  const getDatasets = useCallback(async () => {
    return apiCall('/data/datasets')
  }, [apiCall])

  const createDataset = useCallback(async (data: any) => {
    return apiCall('/data/datasets', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Dataset oluşturuldu'
    })
  }, [apiCall])

  const updateDataset = useCallback(async (id: string, data: any) => {
    return apiCall(`/data/datasets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Dataset güncellendi'
    })
  }, [apiCall])

  const deleteDataset = useCallback(async (id: string) => {
    return apiCall(`/data/datasets/${id}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Dataset silindi'
    })
  }, [apiCall])

  const syncDataset = useCallback(async (id: string) => {
    return apiCall(`/data/datasets/${id}/sync`, {
      method: 'POST',
      showSuccessToast: true,
      successMessage: 'Sync başlatıldı'
    })
  }, [apiCall])

  const getDatasetPreview = useCallback(async (id: string, params?: { limit?: number, offset?: number }) => {
    const query = params ? `?limit=${params.limit || 100}&offset=${params.offset || 0}` : ''
    return apiCall(`/data/datasets/${id}/preview${query}`)
  }, [apiCall])

  // ============================================
  // ETL JOBS API
  // ============================================

  const getETLJobs = useCallback(async () => {
    return apiCall('/data/etl/jobs')
  }, [apiCall])

  const cancelETLJob = useCallback(async (id: string) => {
    return apiCall(`/data/system/jobs/${id}/cancel`, {
      method: 'POST',
      showSuccessToast: true,
      successMessage: 'Job iptal edildi'
    })
  }, [apiCall])

  // ============================================
  // CLICKHOUSE API
  // ============================================

  const getClickHouseTables = useCallback(async () => {
    return apiCall('/data/clickhouse/tables')
  }, [apiCall])

  const deleteClickHouseData = useCallback(async (tableName: string, options: { startDate?: string, endDate?: string, deleteAll?: boolean }) => {
    return apiCall(`/data/clickhouse/tables/${encodeURIComponent(tableName)}/data`, {
      method: 'DELETE',
      body: JSON.stringify(options),
      showSuccessToast: true,
      successMessage: 'Veriler silindi'
    })
  }, [apiCall])

  const optimizeClickHouseTable = useCallback(async (tableName: string) => {
    return apiCall(`/data/clickhouse/tables/${encodeURIComponent(tableName)}/optimize`, {
      method: 'POST',
      showSuccessToast: true,
      successMessage: 'Tablo optimize edildi'
    })
  }, [apiCall])

  // ============================================
  // SYSTEM API
  // ============================================

  const getSystemStatus = useCallback(async () => {
    return apiCall('/data/admin/system/status')
  }, [apiCall])

  const getSystemStats = useCallback(async () => {
    return apiCall('/data/admin/system/stats')
  }, [apiCall])

  const clearCache = useCallback(async (pattern?: string) => {
    return apiCall('/data/cache/clear', {
      method: 'POST',
      body: JSON.stringify({ pattern }),
      showSuccessToast: true,
      successMessage: 'Cache temizlendi'
    })
  }, [apiCall])

  return {
    // Generic
    apiCall,
    
    // Connections
    getConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
    getConnectionTables,
    getTableColumns,
    
    // Datasets
    getDatasets,
    createDataset,
    updateDataset,
    deleteDataset,
    syncDataset,
    getDatasetPreview,
    
    // ETL Jobs
    getETLJobs,
    cancelETLJob,
    
    // ClickHouse
    getClickHouseTables,
    deleteClickHouseData,
    optimizeClickHouseTable,
    
    // System
    getSystemStatus,
    getSystemStats,
    clearCache
  }
}

export type DataApi = ReturnType<typeof useDataApi>
