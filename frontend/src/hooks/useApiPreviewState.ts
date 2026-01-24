/**
 * Clixer - API Preview State Hook
 * API Preview modal state yönetimi
 */

import { useState, useCallback } from 'react'

export interface ApiPreviewState {
  showApiPreviewModal: boolean
  apiPreviewConnection: any
  apiEndpoint: string
  apiMethod: string
  apiQueryParams: string
  apiResponsePath: string
  apiBody: string
  apiPreviewLoading: boolean
  apiPreviewResult: any
  apiPreviewError: string | null
  showApiDatasetForm: boolean
  apiDatasetName: string
  apiSelectedColumns: string[]
  apiDatasetSaving: boolean
  apiSyncSchedule: string
  apiRowLimit: number
}

export interface ApiPreviewActions {
  setShowApiPreviewModal: (v: boolean) => void
  setApiPreviewConnection: (v: any) => void
  setApiEndpoint: (v: string) => void
  setApiMethod: (v: string) => void
  setApiQueryParams: (v: string) => void
  setApiResponsePath: (v: string) => void
  setApiBody: (v: string) => void
  setApiPreviewLoading: (v: boolean) => void
  setApiPreviewResult: (v: any) => void
  setApiPreviewError: (v: string | null) => void
  setShowApiDatasetForm: (v: boolean) => void
  setApiDatasetName: (v: string) => void
  setApiSelectedColumns: (v: string[]) => void
  setApiDatasetSaving: (v: boolean) => void
  setApiSyncSchedule: (v: string) => void
  setApiRowLimit: (v: number) => void
  resetApiPreview: () => void
  openApiPreview: (connection: any) => void
  closeApiPreview: () => void
}

const initialState: ApiPreviewState = {
  showApiPreviewModal: false,
  apiPreviewConnection: null,
  apiEndpoint: '',
  apiMethod: 'GET',
  apiQueryParams: '',
  apiResponsePath: '',
  apiBody: '',
  apiPreviewLoading: false,
  apiPreviewResult: null,
  apiPreviewError: null,
  showApiDatasetForm: false,
  apiDatasetName: '',
  apiSelectedColumns: [],
  apiDatasetSaving: false,
  apiSyncSchedule: 'manual',
  apiRowLimit: 10000,
}

export function useApiPreviewState(): ApiPreviewState & ApiPreviewActions {
  const [state, setState] = useState<ApiPreviewState>(initialState)

  const setField = useCallback(<K extends keyof ApiPreviewState>(key: K, value: ApiPreviewState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetApiPreview = useCallback(() => {
    setState(initialState)
  }, [])

  const openApiPreview = useCallback((connection: any) => {
    setState({
      ...initialState,
      showApiPreviewModal: true,
      apiPreviewConnection: connection,
    })
  }, [])

  const closeApiPreview = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    setShowApiPreviewModal: (v) => setField('showApiPreviewModal', v),
    setApiPreviewConnection: (v) => setField('apiPreviewConnection', v),
    setApiEndpoint: (v) => setField('apiEndpoint', v),
    setApiMethod: (v) => setField('apiMethod', v),
    setApiQueryParams: (v) => setField('apiQueryParams', v),
    setApiResponsePath: (v) => setField('apiResponsePath', v),
    setApiBody: (v) => setField('apiBody', v),
    setApiPreviewLoading: (v) => setField('apiPreviewLoading', v),
    setApiPreviewResult: (v) => setField('apiPreviewResult', v),
    setApiPreviewError: (v) => setField('apiPreviewError', v),
    setShowApiDatasetForm: (v) => setField('showApiDatasetForm', v),
    setApiDatasetName: (v) => setField('apiDatasetName', v),
    setApiSelectedColumns: (v) => setField('apiSelectedColumns', v),
    setApiDatasetSaving: (v) => setField('apiDatasetSaving', v),
    setApiSyncSchedule: (v) => setField('apiSyncSchedule', v),
    setApiRowLimit: (v) => setField('apiRowLimit', v),
    resetApiPreview,
    openApiPreview,
    closeApiPreview,
  }
}
