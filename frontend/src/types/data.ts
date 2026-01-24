/**
 * Clixer - Data Page Types
 * DataPage ve ilgili componentler için tip tanımları
 */

export interface Connection {
  id: string
  name: string
  description?: string
  type: 'postgresql' | 'mssql' | 'mysql' | 'api' | 'excel'
  host: string
  port: number
  database_name: string
  username?: string
  status: 'pending' | 'active' | 'error'
  status_message?: string
  last_tested_at?: string
  created_at: string
  api_auth_config?: {
    auth_type: 'none' | 'api_key' | 'bearer' | 'basic'
    api_key?: string
    bearer_token?: string
    basic_username?: string
    basic_password?: string
  }
  api_config?: any
}

export interface TableInfo {
  schema: string
  name: string
  type: 'table' | 'view'
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  clickhouseType?: string
}

export interface Dataset {
  id: string
  connection_id: string
  name: string
  source_table?: string
  source_query?: string
  clickhouse_table: string
  sync_strategy: string
  sync_schedule?: string
  reference_column?: string
  row_limit?: number | null
  delete_days?: number | null
  status: string
  status_message?: string
  last_sync_at?: string
  last_sync_rows?: number
  total_rows?: number
  connection_name?: string
  connection_type?: string
  description?: string
  store_column?: string | null
  region_column?: string | null
  group_column?: string | null
  partition_column?: string | null
}

export interface ETLJob {
  id: string
  dataset_id: string
  dataset_name?: string
  action: string
  status: string
  started_at?: string
  completed_at?: string
  rows_processed?: number
  row_limit?: number
  error_message?: string
  last_progress_at?: string
}

export interface Schedule {
  id: string
  dataset_id: string
  dataset_name?: string
  cron_expression: string
  is_active: boolean
  next_run_at?: string
  last_run_at?: string
}

export interface ETLWorkerStatus {
  status: 'running' | 'stopped' | 'unknown'
  lastHeartbeat: string | null
  activeJobs: number
  workerInfo: {
    startedAt: string
    pid: number
    uptime: number
  } | null
}

export interface QueryResult {
  columns: ColumnInfo[]
  rows: Record<string, any>[]
  rowCount: number
  executionTime: number
}

/**
 * Stuck job tespiti: 5 dakikadan fazla ilerleme yok
 */
export function isJobStuck(job: ETLJob): boolean {
  if (job.status !== 'running') return false
  if (!job.started_at) return false
  
  const startTime = new Date(job.started_at).getTime()
  const now = Date.now()
  const runningMinutes = (now - startTime) / 1000 / 60
  
  // 5 dakikadan fazla çalışıyor ve 0 satır işlenmiş = stuck
  if (runningMinutes > 5 && (!job.rows_processed || job.rows_processed === 0)) {
    return true
  }
  
  return false
}

/**
 * Cron expression'ı kısa kod formatına çevir
 */
export function cronToShortCode(cron: string): string {
  const cronMap: Record<string, string> = {
    '* * * * *': '1m',
    '*/5 * * * *': '5m',
    '*/15 * * * *': '15m',
    '*/30 * * * *': '30m',
    '0 * * * *': '1h',
    '0 3 * * *': 'daily',
  }
  // Zaten kısa kod formatındaysa aynen dön
  if (['1m', '5m', '15m', '30m', '1h', 'daily', 'manual'].includes(cron)) {
    return cron
  }
  return cronMap[cron] || '1h'
}
