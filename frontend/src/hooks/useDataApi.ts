/**
 * Clixer - Data API Hook
 * DataPage için merkezi API çağrıları
 */

import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'
import type { Connection, Dataset, ETLJob, Schedule, ETLWorkerStatus } from '../types/data'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface UseDataApiProps {
  // Setters
  setConnections: (v: Connection[]) => void
  setDatasets: (v: Dataset[]) => void
  setETLJobs: (v: ETLJob[]) => void
  setSchedules: (v: Schedule[]) => void
  setWorkerStatus: (v: ETLWorkerStatus | null) => void
  setError: (v: string | null) => void
  setSqlConnectionId: (v: string) => void
  sqlConnectionId: string
  // System setters
  setSystemHealth: (v: any) => void
  setSystemHealthLoading: (v: boolean) => void
  setSystemActionLoading: (v: string | null) => void
  setEtlMonitoring: (v: any) => void
  // Performance setters
  setPerformanceData: (v: any) => void
  setPerformanceLoading: (v: string | null) => void
  setPerformanceActionLoading: (v: string | null) => void
  // ClickHouse setters
  setClickhouseTables: (v: any[]) => void
  setClickhouseLoading: (v: boolean) => void
}

export function useDataApi(props: UseDataApiProps) {
  const { accessToken, logout } = useAuthStore()
  const {
    setConnections, setDatasets, setETLJobs, setSchedules, setWorkerStatus,
    setError, setSqlConnectionId, sqlConnectionId,
    setSystemHealth, setSystemHealthLoading, setSystemActionLoading, setEtlMonitoring,
    setPerformanceData, setPerformanceLoading, setPerformanceActionLoading,
    setClickhouseTables, setClickhouseLoading
  } = props

  // Base API call
  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!accessToken) {
      throw new Error('Token yükleniyor...')
    }
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      }
    })
    
    if (response.status === 401) {
      logout()
      window.location.href = '/login'
      throw new Error('Oturum süresi doldu, lütfen tekrar giriş yapın')
    }
    
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'API hatası')
    return data
  }, [accessToken, logout])

  // Load connections
  const loadConnections = useCallback(async () => {
    try {
      const result = await apiCall('/data/connections')
      setConnections(result.data || [])
      if (result.data?.length > 0 && !sqlConnectionId) {
        setSqlConnectionId(result.data[0].id)
      }
    } catch (err: any) {
      console.error('Load connections error:', err)
      setError(err.message)
    }
  }, [apiCall, setConnections, setSqlConnectionId, sqlConnectionId, setError])

  // Load datasets
  const loadDatasets = useCallback(async () => {
    try {
      const result = await apiCall('/data/datasets')
      setDatasets(result.data || [])
    } catch (err: any) {
      console.error('Load datasets error:', err)
      setError(err.message)
    }
  }, [apiCall, setDatasets, setError])

  // Load ETL jobs
  const loadETLJobs = useCallback(async () => {
    try {
      const result = await apiCall('/data/etl-jobs?limit=20')
      setETLJobs(result.data || [])
    } catch (err: any) {
      console.error('Load ETL jobs error:', err)
      setError(err.message)
    }
  }, [apiCall, setETLJobs, setError])

  // Load schedules
  const loadSchedules = useCallback(async () => {
    try {
      const result = await apiCall('/data/schedules')
      setSchedules(result.data || [])
    } catch (err: any) {
      console.error('Load schedules error:', err)
    }
  }, [apiCall, setSchedules])

  // Load ETL Worker status
  const loadWorkerStatus = useCallback(async () => {
    try {
      const result = await apiCall('/data/etl/status')
      setWorkerStatus(result.data || null)
    } catch (err: any) {
      console.error('Load worker status error:', err)
      setWorkerStatus({ status: 'unknown', lastHeartbeat: null, activeJobs: 0, workerInfo: null })
    }
  }, [apiCall, setWorkerStatus])

  // Load ETL Monitoring
  const loadEtlMonitoring = useCallback(async () => {
    try {
      const [locksRes, stuckRes, runningRes] = await Promise.all([
        apiCall('/data/system/locks').catch(() => ({ data: [] })),
        apiCall('/data/system/stuck-jobs').catch(() => ({ data: [] })),
        apiCall('/data/system/running-jobs').catch(() => ({ data: [] }))
      ])
      
      setEtlMonitoring({
        locks: locksRes.data || [],
        stuckJobs: stuckRes.data || [],
        runningJobs: runningRes.data || []
      })
    } catch (err: any) {
      console.error('Load ETL monitoring error:', err)
    }
  }, [apiCall, setEtlMonitoring])

  // Load System Health
  const loadSystemHealth = useCallback(async (showLoading = false) => {
    if (showLoading) setSystemHealthLoading(true)
    try {
      const result = await apiCall('/admin/health')
      setSystemHealth(result.data || null)
      await loadEtlMonitoring()
    } catch (err: any) {
      console.error('Load system health error:', err)
      setSystemHealth(null)
    } finally {
      setSystemHealthLoading(false)
    }
  }, [apiCall, setSystemHealth, setSystemHealthLoading, loadEtlMonitoring])

  // Delete lock
  const deleteLock = useCallback(async (datasetId: string) => {
    if (!confirm('Bu lock silinecek. Devam etmek istiyor musunuz?')) return
    setSystemActionLoading(`lock-${datasetId}`)
    try {
      await apiCall(`/data/system/locks/${datasetId}`, { method: 'DELETE' })
      await loadEtlMonitoring()
    } catch (err: any) {
      toast.error('Lock silinemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }, [apiCall, setSystemActionLoading, loadEtlMonitoring])

  // Delete all locks
  const deleteAllLocks = useCallback(async () => {
    if (!confirm('TÜM lock\'lar silinecek. Bu işlem tehlikeli olabilir. Devam etmek istiyor musunuz?')) return
    setSystemActionLoading('all-locks')
    try {
      await apiCall('/data/system/locks', { method: 'DELETE' })
      await loadEtlMonitoring()
    } catch (err: any) {
      toast.error('Lock\'lar silinemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }, [apiCall, setSystemActionLoading, loadEtlMonitoring])

  // Cancel job
  const cancelJob = useCallback(async (jobId: string) => {
    if (!confirm('Bu job iptal edilecek. Devam etmek istiyor musunuz?')) return
    setSystemActionLoading(`job-${jobId}`)
    try {
      await apiCall(`/data/system/jobs/${jobId}/cancel`, { method: 'POST' })
      await loadEtlMonitoring()
      await loadETLJobs()
    } catch (err: any) {
      toast.error('Job iptal edilemedi: ' + err.message)
    } finally {
      setSystemActionLoading(null)
    }
  }, [apiCall, setSystemActionLoading, loadEtlMonitoring, loadETLJobs])

  // Load ClickHouse tables
  const loadClickhouseTables = useCallback(async () => {
    setClickhouseLoading(true)
    try {
      const result = await apiCall('/data/clickhouse/tables')
      setClickhouseTables(result.data || [])
    } catch (err: any) {
      console.error('Load ClickHouse tables error:', err)
    } finally {
      setClickhouseLoading(false)
    }
  }, [apiCall, setClickhouseTables, setClickhouseLoading])

  // Performance functions
  const loadPostgresPerformance = useCallback(async () => {
    setPerformanceLoading('postgres')
    try {
      const result = await apiCall('/data/performance/postgres')
      setPerformanceData((prev: any) => ({ ...prev, postgres: result.data }))
    } catch (err: any) {
      console.error('PostgreSQL performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }, [apiCall, setPerformanceData, setPerformanceLoading])

  const loadClickhousePerformance = useCallback(async () => {
    setPerformanceLoading('clickhouse')
    try {
      const result = await apiCall('/data/performance/clickhouse')
      setPerformanceData((prev: any) => ({ ...prev, clickhouse: result.data }))
    } catch (err: any) {
      console.error('ClickHouse performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }, [apiCall, setPerformanceData, setPerformanceLoading])

  const loadEtlPerformance = useCallback(async () => {
    setPerformanceLoading('etl')
    try {
      const result = await apiCall('/data/performance/etl')
      setPerformanceData((prev: any) => ({ ...prev, etl: result.data }))
    } catch (err: any) {
      console.error('ETL performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }, [apiCall, setPerformanceData, setPerformanceLoading])

  const loadConnectionPerformance = useCallback(async (connectionId: string) => {
    setPerformanceLoading(`connection-${connectionId}`)
    try {
      const result = await apiCall(`/data/performance/connections/${connectionId}`)
      setPerformanceData((prev: any) => ({
        ...prev,
        connections: { ...prev.connections, [connectionId]: result.data }
      }))
    } catch (err: any) {
      console.error('Connection performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }, [apiCall, setPerformanceData, setPerformanceLoading])

  const loadAllPerformance = useCallback(async () => {
    setPerformanceData({ postgres: null, clickhouse: null, etl: null, connections: {} })
    setPerformanceLoading('all')
    try {
      const [pgResult, chResult, etlResult] = await Promise.all([
        apiCall('/data/performance/postgres').catch(() => ({ data: null })),
        apiCall('/data/performance/clickhouse').catch(() => ({ data: null })),
        apiCall('/data/performance/etl').catch(() => ({ data: null }))
      ])
      
      setPerformanceData({
        postgres: pgResult.data,
        clickhouse: chResult.data,
        etl: etlResult.data,
        connections: {}
      })
    } catch (err: any) {
      console.error('Load all performance error:', err)
    } finally {
      setPerformanceLoading(null)
    }
  }, [apiCall, setPerformanceData, setPerformanceLoading])

  const runVacuum = useCallback(async (tableName: string, analyze = false) => {
    if (!confirm(`${tableName} tablosunda VACUUM ${analyze ? 'ANALYZE ' : ''}çalıştırılacak. Devam?`)) return
    setPerformanceActionLoading(`vacuum-${tableName}`)
    try {
      const result = await apiCall(`/data/performance/postgres/vacuum/${tableName}?analyze=${analyze}`, { method: 'POST' })
      toast.success(result.message)
      loadPostgresPerformance()
    } catch (err: any) {
      toast.error('VACUUM başarısız: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }, [apiCall, setPerformanceActionLoading, loadPostgresPerformance])

  const runReindex = useCallback(async (tableName: string) => {
    if (!confirm(`${tableName} tablosunda REINDEX çalıştırılacak. Bu işlem zaman alabilir. Devam?`)) return
    setPerformanceActionLoading(`reindex-${tableName}`)
    try {
      const result = await apiCall(`/data/performance/postgres/reindex/${tableName}`, { method: 'POST' })
      toast.success(result.message)
      loadPostgresPerformance()
    } catch (err: any) {
      toast.error('REINDEX başarısız: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }, [apiCall, setPerformanceActionLoading, loadPostgresPerformance])

  const optimizeChTable = useCallback(async (tableName: string) => {
    if (!confirm(`${tableName} tablosu optimize edilecek. Devam?`)) return
    setPerformanceActionLoading(`optimize-${tableName}`)
    try {
      const result = await apiCall(`/data/performance/clickhouse/optimize/${tableName}`, { method: 'POST' })
      toast.success(result.message)
      loadClickhousePerformance()
    } catch (err: any) {
      toast.error('Optimize başarısız: ' + err.message)
    } finally {
      setPerformanceActionLoading(null)
    }
  }, [apiCall, setPerformanceActionLoading, loadClickhousePerformance])

  return {
    apiCall,
    loadConnections,
    loadDatasets,
    loadETLJobs,
    loadSchedules,
    loadWorkerStatus,
    loadSystemHealth,
    loadEtlMonitoring,
    deleteLock,
    deleteAllLocks,
    cancelJob,
    loadClickhouseTables,
    loadPostgresPerformance,
    loadClickhousePerformance,
    loadEtlPerformance,
    loadConnectionPerformance,
    loadAllPerformance,
    runVacuum,
    runReindex,
    optimizeChTable,
  }
}
