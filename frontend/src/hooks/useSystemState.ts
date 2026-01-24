/**
 * Clixer - System State Hook
 * Sistem Sağlığı ve Performans Danışmanı state yönetimi
 */

import { useState, useCallback } from 'react'

export interface SystemState {
  // Sistem Sağlığı
  systemHealth: any
  systemHealthLoading: boolean
  systemActionLoading: string | null
  systemAutoRefresh: boolean
  
  // Performans Danışmanı
  performanceData: {
    postgres: any | null
    clickhouse: any | null
    etl: any | null
    connections: Record<string, any>
  }
  performanceLoading: string | null
  performanceActionLoading: string | null
  
  // ETL Monitoring
  etlMonitoring: {
    locks: { key: string; datasetId: string; pid: number; startedAt: string; ttlSeconds: number }[]
    stuckJobs: { id: string; dataset_name: string; runningMinutes: number; rows_processed: number }[]
    runningJobs: { id: string; dataset_name: string; runningMinutes: number; rows_processed: number; status: string }[]
  }
}

export interface SystemActions {
  setSystemHealth: (v: any) => void
  setSystemHealthLoading: (v: boolean) => void
  setSystemActionLoading: (v: string | null) => void
  setSystemAutoRefresh: (v: boolean) => void
  setPerformanceData: (v: SystemState['performanceData'] | ((prev: SystemState['performanceData']) => SystemState['performanceData'])) => void
  setPerformanceLoading: (v: string | null) => void
  setPerformanceActionLoading: (v: string | null) => void
  setEtlMonitoring: (v: SystemState['etlMonitoring']) => void
  resetSystemState: () => void
}

const initialState: SystemState = {
  systemHealth: null,
  systemHealthLoading: false,
  systemActionLoading: null,
  systemAutoRefresh: true,
  performanceData: { postgres: null, clickhouse: null, etl: null, connections: {} },
  performanceLoading: null,
  performanceActionLoading: null,
  etlMonitoring: { locks: [], stuckJobs: [], runningJobs: [] },
}

export function useSystemState(): SystemState & SystemActions {
  const [state, setState] = useState<SystemState>(initialState)

  const setField = useCallback(<K extends keyof SystemState>(key: K, value: SystemState[K]) => {
    setState(prev => ({ ...prev, [key]: value }))
  }, [])

  const setPerformanceData = useCallback((v: SystemState['performanceData'] | ((prev: SystemState['performanceData']) => SystemState['performanceData'])) => {
    setState(prev => ({
      ...prev,
      performanceData: typeof v === 'function' ? v(prev.performanceData) : v
    }))
  }, [])

  const resetSystemState = useCallback(() => {
    setState(initialState)
  }, [])

  return {
    ...state,
    setSystemHealth: (v) => setField('systemHealth', v),
    setSystemHealthLoading: (v) => setField('systemHealthLoading', v),
    setSystemActionLoading: (v) => setField('systemActionLoading', v),
    setSystemAutoRefresh: (v) => setField('systemAutoRefresh', v),
    setPerformanceData,
    setPerformanceLoading: (v) => setField('performanceLoading', v),
    setPerformanceActionLoading: (v) => setField('performanceActionLoading', v),
    setEtlMonitoring: (v) => setField('etlMonitoring', v),
    resetSystemState,
  }
}
