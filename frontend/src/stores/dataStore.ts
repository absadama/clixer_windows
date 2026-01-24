/**
 * Clixer - Data Page Store
 * DataPage.tsx için merkezi state yönetimi
 * 17 useState → Zustand store (Enterprise standart: max 10 useState)
 */

import { create } from 'zustand'
import type { Connection, Dataset, ETLJob, Schedule, ETLWorkerStatus } from '../types/data'

// Re-export types for components that import from this store
export type { Connection, Dataset, ETLJob, Schedule, ETLWorkerStatus, TableInfo, ColumnInfo, QueryResult } from '../types/data'

// ============================================
// TYPES
// ============================================

export interface PreviewData {
  columns: { name: string; type?: string }[]
  rows: Record<string, any>[]
  totalRows?: number
}

// ============================================
// STORE STATE
// ============================================

interface DataState {
  // Data State (API'den gelen veriler)
  connections: Connection[]
  datasets: Dataset[]
  etlJobs: ETLJob[]
  schedules: Schedule[]
  workerStatus: ETLWorkerStatus | null
  previewData: PreviewData | null
  
  // Modal State
  showConnectionModal: boolean
  showDatasetModal: boolean
  showPreviewModal: boolean
  showSettingsModal: boolean
  
  // Selection State
  selectedConnection: Connection | null
  editingConnection: Connection | null
  selectedDataset: Dataset | null
  
  // Loading/Error State
  error: string | null
  triggeringAll: boolean
  previewLoading: boolean
  syncingDatasetId: string | null
}

// ============================================
// STORE ACTIONS
// ============================================

interface DataActions {
  // Data Actions
  setConnections: (connections: Connection[]) => void
  setDatasets: (datasets: Dataset[]) => void
  setETLJobs: (jobs: ETLJob[]) => void
  setSchedules: (schedules: Schedule[]) => void
  setWorkerStatus: (status: ETLWorkerStatus | null) => void
  setPreviewData: (data: PreviewData | null) => void
  
  // Modal Actions
  setShowConnectionModal: (show: boolean) => void
  setShowDatasetModal: (show: boolean) => void
  setShowPreviewModal: (show: boolean) => void
  setShowSettingsModal: (show: boolean) => void
  openConnectionModal: (connection?: Connection | null, editing?: boolean) => void
  closeConnectionModal: () => void
  openDatasetModal: (connection: Connection) => void
  closeDatasetModal: () => void
  openPreviewModal: (dataset: Dataset) => void
  closePreviewModal: () => void
  openSettingsModal: (dataset: Dataset) => void
  closeSettingsModal: () => void
  
  // Selection Actions
  setSelectedConnection: (connection: Connection | null) => void
  setEditingConnection: (connection: Connection | null) => void
  setSelectedDataset: (dataset: Dataset | null) => void
  
  // Loading/Error Actions
  setError: (error: string | null) => void
  setTriggeringAll: (triggering: boolean) => void
  setPreviewLoading: (loading: boolean) => void
  setSyncingDatasetId: (id: string | null) => void
  
  // Utility Actions
  resetModals: () => void
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useDataStore = create<DataState & DataActions>((set) => ({
  // Initial State
  connections: [],
  datasets: [],
  etlJobs: [],
  schedules: [],
  workerStatus: null,
  previewData: null,
  
  showConnectionModal: false,
  showDatasetModal: false,
  showPreviewModal: false,
  showSettingsModal: false,
  
  selectedConnection: null,
  editingConnection: null,
  selectedDataset: null,
  
  error: null,
  triggeringAll: false,
  previewLoading: false,
  syncingDatasetId: null,
  
  // Data Actions
  setConnections: (connections) => set({ connections }),
  setDatasets: (datasets) => set({ datasets }),
  setETLJobs: (etlJobs) => set({ etlJobs }),
  setSchedules: (schedules) => set({ schedules }),
  setWorkerStatus: (workerStatus) => set({ workerStatus }),
  setPreviewData: (previewData) => set({ previewData }),
  
  // Modal Actions
  setShowConnectionModal: (showConnectionModal) => set({ showConnectionModal }),
  setShowDatasetModal: (showDatasetModal) => set({ showDatasetModal }),
  setShowPreviewModal: (showPreviewModal) => set({ showPreviewModal }),
  setShowSettingsModal: (showSettingsModal) => set({ showSettingsModal }),
  
  openConnectionModal: (connection = null, editing = false) => set({
    showConnectionModal: true,
    selectedConnection: editing ? null : connection,
    editingConnection: editing ? connection : null,
  }),
  
  closeConnectionModal: () => set({
    showConnectionModal: false,
    selectedConnection: null,
    editingConnection: null,
  }),
  
  openDatasetModal: (connection) => set({
    showDatasetModal: true,
    selectedConnection: connection,
  }),
  
  closeDatasetModal: () => set({
    showDatasetModal: false,
    selectedConnection: null,
  }),
  
  openPreviewModal: (dataset) => set({
    showPreviewModal: true,
    selectedDataset: dataset,
  }),
  
  closePreviewModal: () => set({
    showPreviewModal: false,
    previewData: null,
  }),
  
  openSettingsModal: (dataset) => set({
    showSettingsModal: true,
    selectedDataset: dataset,
  }),
  
  closeSettingsModal: () => set({
    showSettingsModal: false,
  }),
  
  // Selection Actions
  setSelectedConnection: (selectedConnection) => set({ selectedConnection }),
  setEditingConnection: (editingConnection) => set({ editingConnection }),
  setSelectedDataset: (selectedDataset) => set({ selectedDataset }),
  
  // Loading/Error Actions
  setError: (error) => set({ error }),
  setTriggeringAll: (triggeringAll) => set({ triggeringAll }),
  setPreviewLoading: (previewLoading) => set({ previewLoading }),
  setSyncingDatasetId: (syncingDatasetId) => set({ syncingDatasetId }),
  
  // Utility Actions
  resetModals: () => set({
    showConnectionModal: false,
    showDatasetModal: false,
    showPreviewModal: false,
    showSettingsModal: false,
    selectedConnection: null,
    editingConnection: null,
    selectedDataset: null,
    previewData: null,
  }),
}))
