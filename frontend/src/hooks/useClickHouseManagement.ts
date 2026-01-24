/**
 * Clixer - ClickHouse Management Hook
 * ClickHouse tablo yönetimi ve veri doğrulama state'leri
 */

import { useState, useCallback } from 'react'

export interface ClickHouseManagementState {
  // Clixer Tablo Yönetimi
  clickhouseTables: any[]
  clickhouseLoading: boolean
  selectedChTable: any
  showChTableModal: boolean
  
  // ClickHouse Veri Yönetimi (Tarih bazlı silme)
  showDataManagementModal: boolean
  dataManagementTable: string
  dataManagementDatasetId: string
  dataManagementColumns: any[]
  dataManagementLoading: boolean
  dataManagementPreview: any
  dmDateColumn: string
  dmDeleteMode: 'days' | 'range'
  dmDays: number
  dmStartDate: string
  dmEndDate: string
  dmActiveTab: 'delete' | 'validate'
  
  // Veri Doğrulama State'leri
  comparisonData: any
  missingRanges: any
  duplicateAnalysis: any
  validationLoading: boolean
  pkColumn: string
}

export interface ClickHouseManagementActions {
  setClickhouseTables: (v: any[]) => void
  setClickhouseLoading: (v: boolean) => void
  setSelectedChTable: (v: any) => void
  setShowChTableModal: (v: boolean) => void
  setShowDataManagementModal: (v: boolean) => void
  setDataManagementTable: (v: string) => void
  setDataManagementDatasetId: (v: string) => void
  setDataManagementColumns: (v: any[]) => void
  setDataManagementLoading: (v: boolean) => void
  setDataManagementPreview: (v: any) => void
  setDmDateColumn: (v: string) => void
  setDmDeleteMode: (v: 'days' | 'range') => void
  setDmDays: (v: number) => void
  setDmStartDate: (v: string) => void
  setDmEndDate: (v: string) => void
  setDmActiveTab: (v: 'delete' | 'validate') => void
  setComparisonData: (v: any) => void
  setMissingRanges: (v: any) => void
  setDuplicateAnalysis: (v: any) => void
  setValidationLoading: (v: boolean) => void
  setPkColumn: (v: string) => void
  resetDataManagement: () => void
  clearComparisonData: () => void
}

const initialState: ClickHouseManagementState = {
  clickhouseTables: [],
  clickhouseLoading: false,
  selectedChTable: null,
  showChTableModal: false,
  showDataManagementModal: false,
  dataManagementTable: '',
  dataManagementDatasetId: '',
  dataManagementColumns: [],
  dataManagementLoading: false,
  dataManagementPreview: null,
  dmDateColumn: '',
  dmDeleteMode: 'days',
  dmDays: 7,
  dmStartDate: '',
  dmEndDate: '',
  dmActiveTab: 'delete',
  comparisonData: null,
  missingRanges: null,
  duplicateAnalysis: null,
  validationLoading: false,
  pkColumn: 'id',
}

export function useClickHouseManagement(): ClickHouseManagementState & ClickHouseManagementActions {
  const [state, setState] = useState<ClickHouseManagementState>(initialState)

  const setField = useCallback(<K extends keyof ClickHouseManagementState>(key: K, value: ClickHouseManagementState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetDataManagement = useCallback(() => {
    setState(prev => ({
      ...prev,
      showDataManagementModal: false,
      dataManagementTable: '',
      dataManagementDatasetId: '',
      dataManagementColumns: [],
      dataManagementPreview: null,
      dmDateColumn: '',
      dmDeleteMode: 'days',
      dmDays: 7,
      dmStartDate: '',
      dmEndDate: '',
    }))
  }, [])

  const clearComparisonData = useCallback(() => {
    setState(prev => ({
      ...prev,
      comparisonData: null,
      missingRanges: null,
    }))
  }, [])

  return {
    ...state,
    setClickhouseTables: (v) => setField('clickhouseTables', v),
    setClickhouseLoading: (v) => setField('clickhouseLoading', v),
    setSelectedChTable: (v) => setField('selectedChTable', v),
    setShowChTableModal: (v) => setField('showChTableModal', v),
    setShowDataManagementModal: (v) => setField('showDataManagementModal', v),
    setDataManagementTable: (v) => setField('dataManagementTable', v),
    setDataManagementDatasetId: (v) => setField('dataManagementDatasetId', v),
    setDataManagementColumns: (v) => setField('dataManagementColumns', v),
    setDataManagementLoading: (v) => setField('dataManagementLoading', v),
    setDataManagementPreview: (v) => setField('dataManagementPreview', v),
    setDmDateColumn: (v) => setField('dmDateColumn', v),
    setDmDeleteMode: (v) => setField('dmDeleteMode', v),
    setDmDays: (v) => setField('dmDays', v),
    setDmStartDate: (v) => setField('dmStartDate', v),
    setDmEndDate: (v) => setField('dmEndDate', v),
    setDmActiveTab: (v) => setField('dmActiveTab', v),
    setComparisonData: (v) => setField('comparisonData', v),
    setMissingRanges: (v) => setField('missingRanges', v),
    setDuplicateAnalysis: (v) => setField('duplicateAnalysis', v),
    setValidationLoading: (v) => setField('validationLoading', v),
    setPkColumn: (v) => setField('pkColumn', v),
    resetDataManagement,
    clearComparisonData,
  }
}
