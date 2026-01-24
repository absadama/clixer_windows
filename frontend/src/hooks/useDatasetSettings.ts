/**
 * Clixer - Dataset Settings Hook
 * Dataset oluşturma ve düzenleme için state yönetimi
 */

import { useState, useCallback } from 'react'

export interface DatasetSettingsState {
  // Dataset creation
  newDatasetName: string
  newDatasetDescription: string
  newDatasetSyncStrategy: string
  newDatasetSyncSchedule: string
  scheduledHour: number
  newDatasetReferenceColumn: string
  newDatasetRowLimit: number | null
  settingsColumns: string[]
  datasetCreating: boolean
  
  // Partition & Refresh Settings
  partitionColumn: string
  partitionType: 'monthly' | 'daily'
  refreshWindowDays: number
  detectModified: boolean
  modifiedColumn: string
  weeklyFullRefresh: boolean
  engineType: 'MergeTree' | 'ReplacingMergeTree'
  customWhere: string
  deleteDays: number
  
  // RLS (Row-Level Security)
  rlsStoreColumn: string
  rlsRegionColumn: string
  rlsGroupColumn: string
  
  // Unique Column
  uniqueColumn: string
  autoDetectedUnique: string | null
}

export interface DatasetSettingsActions {
  setNewDatasetName: (v: string) => void
  setNewDatasetDescription: (v: string) => void
  setNewDatasetSyncStrategy: (v: string) => void
  setNewDatasetSyncSchedule: (v: string) => void
  setScheduledHour: (v: number) => void
  setNewDatasetReferenceColumn: (v: string) => void
  setNewDatasetRowLimit: (v: number | null) => void
  setSettingsColumns: (v: string[]) => void
  setDatasetCreating: (v: boolean) => void
  setPartitionColumn: (v: string) => void
  setPartitionType: (v: 'monthly' | 'daily') => void
  setRefreshWindowDays: (v: number) => void
  setDetectModified: (v: boolean) => void
  setModifiedColumn: (v: string) => void
  setWeeklyFullRefresh: (v: boolean) => void
  setEngineType: (v: 'MergeTree' | 'ReplacingMergeTree') => void
  setCustomWhere: (v: string) => void
  setDeleteDays: (v: number) => void
  setRlsStoreColumn: (v: string) => void
  setRlsRegionColumn: (v: string) => void
  setRlsGroupColumn: (v: string) => void
  setUniqueColumn: (v: string) => void
  setAutoDetectedUnique: (v: string | null) => void
  resetSettings: () => void
}

const initialState: DatasetSettingsState = {
  newDatasetName: '',
  newDatasetDescription: '',
  newDatasetSyncStrategy: 'full_refresh',
  newDatasetSyncSchedule: 'manual',
  scheduledHour: 2,
  newDatasetReferenceColumn: '',
  newDatasetRowLimit: null,
  settingsColumns: [],
  datasetCreating: false,
  partitionColumn: '',
  partitionType: 'monthly',
  refreshWindowDays: 7,
  detectModified: false,
  modifiedColumn: '',
  weeklyFullRefresh: false,
  engineType: 'MergeTree',
  customWhere: '',
  deleteDays: 1,
  rlsStoreColumn: '',
  rlsRegionColumn: '',
  rlsGroupColumn: '',
  uniqueColumn: '',
  autoDetectedUnique: null,
}

export function useDatasetSettings(): DatasetSettingsState & DatasetSettingsActions {
  const [state, setState] = useState<DatasetSettingsState>(initialState)

  const setField = useCallback(<K extends keyof DatasetSettingsState>(key: K, value: DatasetSettingsState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetSettings = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    setNewDatasetName: (v) => setField('newDatasetName', v),
    setNewDatasetDescription: (v) => setField('newDatasetDescription', v),
    setNewDatasetSyncStrategy: (v) => setField('newDatasetSyncStrategy', v),
    setNewDatasetSyncSchedule: (v) => setField('newDatasetSyncSchedule', v),
    setScheduledHour: (v) => setField('scheduledHour', v),
    setNewDatasetReferenceColumn: (v) => setField('newDatasetReferenceColumn', v),
    setNewDatasetRowLimit: (v) => setField('newDatasetRowLimit', v),
    setSettingsColumns: (v) => setField('settingsColumns', v),
    setDatasetCreating: (v) => setField('datasetCreating', v),
    setPartitionColumn: (v) => setField('partitionColumn', v),
    setPartitionType: (v) => setField('partitionType', v),
    setRefreshWindowDays: (v) => setField('refreshWindowDays', v),
    setDetectModified: (v) => setField('detectModified', v),
    setModifiedColumn: (v) => setField('modifiedColumn', v),
    setWeeklyFullRefresh: (v) => setField('weeklyFullRefresh', v),
    setEngineType: (v) => setField('engineType', v),
    setCustomWhere: (v) => setField('customWhere', v),
    setDeleteDays: (v) => setField('deleteDays', v),
    setRlsStoreColumn: (v) => setField('rlsStoreColumn', v),
    setRlsRegionColumn: (v) => setField('rlsRegionColumn', v),
    setRlsGroupColumn: (v) => setField('rlsGroupColumn', v),
    setUniqueColumn: (v) => setField('uniqueColumn', v),
    setAutoDetectedUnique: (v) => setField('autoDetectedUnique', v),
    resetSettings,
  }
}
