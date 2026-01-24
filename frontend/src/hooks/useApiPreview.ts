/**
 * Clixer - useApiPreview Hook
 * API Preview modal için state ve fonksiyonları yönetir
 */

import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

export function useApiPreview() {
  const { accessToken } = useAuthStore()
  
  // Modal state
  const [showApiPreviewModal, setShowApiPreviewModal] = useState(false)
  const [apiPreviewConnection, setApiPreviewConnection] = useState<any>(null)
  
  // Request state
  const [apiEndpoint, setApiEndpoint] = useState('')
  const [apiMethod, setApiMethod] = useState('GET')
  const [apiQueryParams, setApiQueryParams] = useState('')
  const [apiResponsePath, setApiResponsePath] = useState('')
  const [apiBody, setApiBody] = useState('')
  
  // Loading & Result state
  const [apiPreviewLoading, setApiPreviewLoading] = useState(false)
  const [apiPreviewResult, setApiPreviewResult] = useState<any>(null)
  const [apiPreviewError, setApiPreviewError] = useState<string | null>(null)
  
  // Dataset form state
  const [showApiDatasetForm, setShowApiDatasetForm] = useState(false)
  const [apiDatasetName, setApiDatasetName] = useState('')
  const [apiSelectedColumns, setApiSelectedColumns] = useState<string[]>([])
  const [apiDatasetSaving, setApiDatasetSaving] = useState(false)
  const [apiSyncSchedule, setApiSyncSchedule] = useState('manual')
  const [apiRowLimit, setApiRowLimit] = useState(10000)

  // API call helper
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers,
      },
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'API hatası')
    }
    return data
  }

  // Open API Preview Modal
  const openApiPreview = (connection: any) => {
    setApiPreviewConnection(connection)
    setShowApiPreviewModal(true)
    setApiPreviewResult(null)
    setApiPreviewError(null)
    setShowApiDatasetForm(false)
    setApiDatasetName('')
    setApiSelectedColumns([])
    
    // API config'den endpoint'i al
    const config = connection.api_config 
      ? (typeof connection.api_config === 'string' ? JSON.parse(connection.api_config) : connection.api_config)
      : {}
    setApiEndpoint(config.defaultEndpoint || '')
    setApiResponsePath(config.responsePath || '')
  }

  // Run API Preview
  const runApiPreview = async () => {
    if (!apiPreviewConnection) return
    
    setApiPreviewLoading(true)
    setApiPreviewError(null)
    setApiPreviewResult(null)

    try {
      const result = await apiCall(`/data/connections/${apiPreviewConnection.id}/api-preview`, {
        method: 'POST',
        body: JSON.stringify({
          endpoint: apiEndpoint,
          method: apiMethod,
          queryParams: apiQueryParams,
          responsePath: apiResponsePath,
          body: apiBody || undefined
        })
      })

      if (result.success) {
        setApiPreviewResult(result.data)
        // Tüm kolonları varsayılan olarak seç
        if (result.data?.columns) {
          setApiSelectedColumns(result.data.columns.map((c: any) => c.name))
        }
      } else {
        setApiPreviewError(result.error || 'Bilinmeyen hata')
      }
    } catch (err: any) {
      setApiPreviewError(err.message)
    } finally {
      setApiPreviewLoading(false)
    }
  }

  // Save API as Dataset
  const saveApiAsDataset = async (onSuccess?: () => void) => {
    if (!apiDatasetName.trim() || !apiPreviewConnection) return

    setApiDatasetSaving(true)
    try {
      const result = await apiCall('/data/datasets/from-api', {
        method: 'POST',
        body: JSON.stringify({
          connectionId: apiPreviewConnection.id,
          name: apiDatasetName,
          endpoint: apiEndpoint,
          method: apiMethod,
          queryParams: apiQueryParams,
          responsePath: apiResponsePath,
          body: apiBody || undefined,
          selectedColumns: apiSelectedColumns,
          syncSchedule: apiSyncSchedule,
          rowLimit: apiRowLimit
        })
      })

      if (result.success) {
        toast.success('Dataset başarıyla oluşturuldu!')
        setShowApiPreviewModal(false)
        setShowApiDatasetForm(false)
        onSuccess?.()
      } else {
        toast.error(result.error || 'Dataset oluşturulamadı')
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setApiDatasetSaving(false)
    }
  }

  // Close modal
  const closeApiPreview = () => {
    setShowApiPreviewModal(false)
    setApiPreviewConnection(null)
    setApiPreviewResult(null)
    setApiPreviewError(null)
  }

  return {
    // Modal state
    showApiPreviewModal,
    setShowApiPreviewModal,
    apiPreviewConnection,
    setApiPreviewConnection,
    
    // Request state
    apiEndpoint,
    setApiEndpoint,
    apiMethod,
    setApiMethod,
    apiQueryParams,
    setApiQueryParams,
    apiResponsePath,
    setApiResponsePath,
    apiBody,
    setApiBody,
    
    // Loading & Result
    apiPreviewLoading,
    apiPreviewResult,
    apiPreviewError,
    
    // Dataset form
    showApiDatasetForm,
    setShowApiDatasetForm,
    apiDatasetName,
    setApiDatasetName,
    apiSelectedColumns,
    setApiSelectedColumns,
    apiDatasetSaving,
    apiSyncSchedule,
    setApiSyncSchedule,
    apiRowLimit,
    setApiRowLimit,
    
    // Actions
    openApiPreview,
    runApiPreview,
    saveApiAsDataset,
    closeApiPreview
  }
}
