/**
 * ETL Worker Type Definitions
 */

export interface ETLJob {
  datasetId: string;
  jobId?: string;
  action: 'initial_sync' | 'incremental_sync' | 'full_refresh' | 'manual_sync' | 'partial_refresh' | 'missing_sync' | 'new_records_sync';
  triggeredBy?: string;
  days?: number; // Partial refresh için gün sayısı
  ranges?: Array<{start: number; end: number; missing_count?: number}>; // missing_sync için eksik ID aralıkları
  pkColumn?: string; // Kullanıcı seçtiği PK kolonu
  afterId?: number; // new_records_sync için: Bu ID'den sonraki kayıtları çek
  limit?: number; // Opsiyonel satır limiti
}

export interface TypeMismatch {
  column: string;
  sourceType: string;
  clickhouseType: string;
  compatible: boolean;
}

export interface DataValidationResult {
  sourceCount: number;
  targetCount: number;
  isConsistent: boolean;
  duplicateCount: number;
  message: string;
}
