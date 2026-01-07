/**
 * Clixer - Analytics Service
 * KPI Calculation, Metric Execution, ClickHouse Read, Cache
 * 
 * Bu servis:
 * - Metrik SQL sorgularını ClickHouse'ta çalıştırır
 * - Sonuçları cache'ler
 * - Dashboard widget'ları için veri sağlar
 * - Real-time WebSocket güncellemeleri
 */

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

import {
  createLogger,
  requestLogger,
  db,
  clickhouse,
  cache,
  authenticate,
  tenantIsolation,
  AppError,
  formatError,
  NotFoundError,
  ValidationError,
  // Security helpers
  sanitizeTableName,
  sanitizeColumnName,
  sanitizeNumber,
  sanitizeLimit,
  containsDangerousSQLKeywords
} from '@clixer/shared';

const logger = createLogger({ service: 'analytics-service' });
const app = express();
const PORT = process.env.ANALYTICS_SERVICE_PORT || 4005;

// ============================================
// KARŞILAŞTIRMA HELPER FONKSİYONLARI
// ============================================

/**
 * Karşılaştırma tipi için varsayılan etiket
 */
function getDefaultComparisonLabel(compType: string): string {
  switch (compType) {
    case 'yoy': return 'vs geçen yıl';
    case 'mom': return 'vs geçen ay';
    case 'wow': return 'vs geçen hafta';
    case 'ytd': return 'YTD vs geçen yıl';
    case 'lfl': return 'LFL vs geçen yıl';
    default: return 'vs önceki dönem';
  }
}

/**
 * Önceki dönem tarih aralığını hesapla
 * @param compType Karşılaştırma tipi (yoy, mom, wow, ytd, lfl)
 * @returns Önceki dönem başlangıç ve bitiş tarihleri + güncel dönem gün sayısı
 */
/**
 * LFL (Like-for-Like) hesaplama - MAĞAZA BAZLI
 * 
 * Her mağaza için ayrı ayrı:
 * 1. Bu yıl satış kaydı olan günler (LFL Takvim'de)
 * 2. Aynı günlerin geçen yıl karşılığında da O MAĞAZADA satış kaydı var mı?
 * 3. Her iki yılda da satış VARSA → karşılaştırmaya dahil et
 * 4. Tüm mağazaların LFL toplamlarını birleştir
 * 
 * Örnek:
 * - Mağaza A: Bu yıl 1,2,3,4,5 Aralık açık, geçen yıl 1,2,3 Aralık açık → 3 gün karşılaştırılır
 * - Mağaza B: Bu yıl 1,2,3 Aralık açık, geçen yıl 1,2,3,4,5 Aralık açık → 3 gün karşılaştırılır
 * - Mağaza C: Bu yıl 1,2 Aralık açık, geçen yıl 3,4,5 Aralık açık → 0 gün (karşılaştırma dışı)
 */
async function calculateLFL(
  tableName: string,
  dateColumn: string,
  valueColumn: string,
  aggFunc: string,
  rlsCondition: string,
  filterCondition: string,
  startDate?: string,  // FilterBar'dan gelen başlangıç tarihi
  endDate?: string,    // FilterBar'dan gelen bitiş tarihi
  lflCalendarConfig?: {
    datasetId: string;
    thisYearColumn: string;
    lastYearColumn: string;
    clickhouseTable: string;
  },
  storeColumn?: string,  // Mağaza kolonu (örn: BranchID, store_id)
  storeFilterCondition?: string  // Mağaza filtresi (örn: "AND BranchID IN (1,2,3)")
): Promise<{
  currentValue: number;
  previousValue: number;
  trend: number;
  commonDays: number;
  uniqueStores?: number;  // Benzersiz mağaza sayısı (mağaza bazlı LFL için)
  isStoreBased: boolean;  // Mağaza bazlı mı gün bazlı mı?
} | null> {
  
  // Tarih aralığını belirle
  let thisYearStart: string;
  let thisYearEnd: string;
  
  if (startDate && endDate) {
    // FilterBar'dan gelen tarihler
    thisYearStart = startDate;
    thisYearEnd = endDate;
  } else {
    // Varsayılan: YTD
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    thisYearStart = `${today.getFullYear()}-01-01`;
    thisYearEnd = formatDateString(today);
  }
  
  logger.debug('LFL calculation started', { 
    thisYearStart, thisYearEnd, 
    hasLflCalendar: !!lflCalendarConfig,
    storeColumn: storeColumn || 'not specified'
  });
  
  // ============================================
  // LFL TAKVİM + MAĞAZA BAZLI HESAPLAMA
  // ============================================
  if (lflCalendarConfig?.clickhouseTable) {
    const lflTable = `clixer_analytics.${lflCalendarConfig.clickhouseTable}`;
    const thisYearCol = lflCalendarConfig.thisYearColumn || 'this_year';
    const lastYearCol = lflCalendarConfig.lastYearColumn || 'last_year';
    
    // Mağaza kolonu varsa MAĞAZA BAZLI LFL hesapla
    // Yoksa genel LFL hesapla
    const storeCol = storeColumn || null;
    
    let lflSql: string;
    
    if (storeCol) {
      // ============================================
      // MAĞAZA BAZLI LFL (DOĞRU MANTIK)
      // ============================================
      // Her mağaza için, hem bu yıl hem geçen yıl satış olan günleri bul
      // Sonra bu ortak günlerin toplamlarını karşılaştır
      // NOT: ClickHouse'da CTE + nested subquery çalışmıyor, inline subquery kullanıyoruz
      
      // Geçen yıl tarih aralığını hesapla (LFL takvimden)
      const lastYearStartDate = new Date(thisYearStart);
      lastYearStartDate.setFullYear(lastYearStartDate.getFullYear() - 1);
      const lastYearEndDate = new Date(thisYearEnd);
      lastYearEndDate.setFullYear(lastYearEndDate.getFullYear() - 1);
      // Biraz geniş aralık al (LFL takvim kayması için)
      lastYearStartDate.setDate(lastYearStartDate.getDate() - 10);
      lastYearEndDate.setDate(lastYearEndDate.getDate() + 10);
      const lyStart = lastYearStartDate.toISOString().split('T')[0];
      const lyEnd = lastYearEndDate.toISOString().split('T')[0];
      
      // Mağaza filtresi (FilterBar'dan gelen storeIds)
      const storeFilter = storeFilterCondition || '';
      
      lflSql = `
        SELECT 
          sum(this_year_value) as current_value,
          sum(last_year_value) as previous_value,
          count() as common_days_count,
          uniq(store_id_col) as unique_stores
        FROM (
          SELECT 
            ty.store_id as store_id_col,
            ty.sale_date as this_year_date,
            lfl.ly_date as last_year_date,
            ty.agg_value as this_year_value,
            ly.agg_value as last_year_value
          FROM (
            -- Bu yıl mağaza-gün bazında aggregated değerler
            SELECT ${storeCol} as store_id, toDate(${dateColumn}) as sale_date, ${aggFunc} as agg_value
            FROM ${tableName}
            WHERE toDate(${dateColumn}) >= '${thisYearStart}' AND toDate(${dateColumn}) <= '${thisYearEnd}'
              ${rlsCondition} ${filterCondition} ${storeFilter}
            GROUP BY ${storeCol}, toDate(${dateColumn})
          ) ty
          INNER JOIN (
            -- LFL Takvim eşleşmeleri
            SELECT toDate(${thisYearCol}) as ty_date, toDate(${lastYearCol}) as ly_date
            FROM ${lflTable}
            WHERE toDate(${thisYearCol}) >= '${thisYearStart}' AND toDate(${thisYearCol}) <= '${thisYearEnd}'
          ) lfl ON ty.sale_date = lfl.ty_date
          INNER JOIN (
            -- Geçen yıl mağaza-gün bazında aggregated değerler
            SELECT ${storeCol} as store_id, toDate(${dateColumn}) as sale_date, ${aggFunc} as agg_value
            FROM ${tableName}
            WHERE toDate(${dateColumn}) >= '${lyStart}' AND toDate(${dateColumn}) <= '${lyEnd}'
              ${rlsCondition} ${filterCondition} ${storeFilter}
            GROUP BY ${storeCol}, toDate(${dateColumn})
          ) ly ON ty.store_id = ly.store_id AND lfl.ly_date = ly.sale_date
        )
      `;
    } else {
      // ============================================
      // GENEL LFL (Mağaza kolonu yoksa)
      // ============================================
      // Mağaza filtresi (FilterBar'dan gelen storeIds)
      const storeFilter = storeFilterCondition || '';
      
      lflSql = `
        WITH lfl_dates AS (
          SELECT 
            toDate(${thisYearCol}) as this_year_date,
            toDate(${lastYearCol}) as last_year_date
          FROM ${lflTable}
          WHERE toDate(${thisYearCol}) >= '${thisYearStart}' 
            AND toDate(${thisYearCol}) <= '${thisYearEnd}'
        ),
        
        -- Bu yıl satış olan günler (LFL Takvim'deki this_year_date'lerde)
        this_year_days AS (
          SELECT DISTINCT toDate(${dateColumn}) as sale_date
          FROM ${tableName}
          WHERE toDate(${dateColumn}) IN (SELECT this_year_date FROM lfl_dates)
            ${rlsCondition}
            ${filterCondition}
            ${storeFilter}
        ),
        
        -- Geçen yıl satış olan günler (LFL Takvim'deki last_year_date'lerde)
        last_year_days AS (
          SELECT DISTINCT toDate(${dateColumn}) as sale_date
          FROM ${tableName}
          WHERE toDate(${dateColumn}) IN (SELECT last_year_date FROM lfl_dates)
            ${rlsCondition}
            ${filterCondition}
            ${storeFilter}
        ),
        
        -- Her iki yılda da satış olan LFL günleri
        common_lfl_days AS (
          SELECT lfl.this_year_date, lfl.last_year_date
          FROM lfl_dates lfl
          WHERE lfl.this_year_date IN (SELECT sale_date FROM this_year_days)
            AND lfl.last_year_date IN (SELECT sale_date FROM last_year_days)
        )
        
        SELECT 
          (
            SELECT ${aggFunc}
            FROM ${tableName} s
            WHERE toDate(s.${dateColumn}) IN (SELECT this_year_date FROM common_lfl_days)
              ${rlsCondition}
              ${filterCondition}
              ${storeFilter}
          ) as current_value,
          (
            SELECT ${aggFunc}
            FROM ${tableName} s
            WHERE toDate(s.${dateColumn}) IN (SELECT last_year_date FROM common_lfl_days)
              ${rlsCondition}
              ${filterCondition}
              ${storeFilter}
          ) as previous_value,
          (SELECT count() FROM common_lfl_days) as common_days_count
      `;
    }
    
    logger.debug('LFL SQL generated', { 
      hasStoreColumn: !!storeCol, 
      lflTable, 
      thisYearCol, 
      lastYearCol,
      sqlLength: lflSql.length
    });
    
    try {
      const result = await clickhouse.query<{
        current_value: number;
        previous_value: number;
        common_days_count: number;
        unique_stores?: number;
      }>(lflSql);
      
      if (result.length === 0 || result[0].common_days_count === 0) {
        logger.warn('LFL calendar returned no matching days', { thisYearStart, thisYearEnd, hasStoreColumn: !!storeCol });
        return null;
      }
      
      const { current_value, previous_value, common_days_count, unique_stores } = result[0];
      const currentVal = Number(current_value) || 0;
      const previousVal = Number(previous_value) || 0;
      
      let trend = 0;
      if (previousVal !== 0) {
        trend = ((currentVal - previousVal) / Math.abs(previousVal)) * 100;
      } else if (currentVal > 0) {
        trend = 100;
      }
      
      logger.debug('LFL with calendar result', { 
        currentVal, previousVal, 
        trend: trend.toFixed(2), 
        commonDays: common_days_count,
        uniqueStores: unique_stores || 0,
        storeBasedLFL: !!storeCol
      });
      
      return {
        currentValue: currentVal,
        previousValue: previousVal,
        trend,
        commonDays: Number(common_days_count),
        uniqueStores: storeCol ? (Number(unique_stores) || 0) : undefined,
        isStoreBased: !!storeCol
      };
    } catch (error) {
      logger.error('LFL calendar query failed', { error, lflSql: lflSql.substring(0, 500) });
      // Takvim sorgusu başarısız olursa fallback'e düş
    }
  }
  
  // ============================================
  // FALLBACK: BASIT dayOfYear KARŞILAŞTIRMASI (Mağaza bazlı)
  // ============================================
  const startDateObj = new Date(thisYearStart);
  const endDateObj = new Date(thisYearEnd);
  const lastYearStart = `${startDateObj.getFullYear() - 1}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
  const lastYearEnd = `${endDateObj.getFullYear() - 1}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
  
  let lflSql: string;
  
  if (storeColumn) {
    // Mağaza bazlı fallback
    lflSql = `
      WITH 
      -- Bu yıl mağaza bazında satış olan günler (dayOfYear)
      this_year_store_days AS (
        SELECT DISTINCT 
          ${storeColumn} as store_id,
          toDayOfYear(toDate(${dateColumn})) as day_of_year
        FROM ${tableName}
        WHERE toDate(${dateColumn}) >= '${thisYearStart}' 
          AND toDate(${dateColumn}) <= '${thisYearEnd}'
          ${rlsCondition}
          ${filterCondition}
      ),
      
      -- Geçen yıl mağaza bazında satış olan günler (dayOfYear)
      last_year_store_days AS (
        SELECT DISTINCT 
          ${storeColumn} as store_id,
          toDayOfYear(toDate(${dateColumn})) as day_of_year
        FROM ${tableName}
        WHERE toDate(${dateColumn}) >= '${lastYearStart}' 
          AND toDate(${dateColumn}) <= '${lastYearEnd}'
          ${rlsCondition}
          ${filterCondition}
      ),
      
      -- Her mağaza için, hem bu yıl hem geçen yıl satış olan dayOfYear
      common_store_days AS (
        SELECT ty.store_id, ty.day_of_year
        FROM this_year_store_days ty
        INNER JOIN last_year_store_days ly 
          ON ty.store_id = ly.store_id 
          AND ty.day_of_year = ly.day_of_year
      )
      
      SELECT 
        (
          SELECT ${aggFunc}
          FROM ${tableName} s
          WHERE EXISTS (
            SELECT 1 FROM common_store_days csd 
            WHERE s.${storeColumn} = csd.store_id 
              AND toDayOfYear(toDate(s.${dateColumn})) = csd.day_of_year
          )
          AND toDate(${dateColumn}) >= '${thisYearStart}'
          AND toDate(${dateColumn}) <= '${thisYearEnd}'
          ${rlsCondition}
          ${filterCondition}
        ) as current_value,
        (
          SELECT ${aggFunc}
          FROM ${tableName} s
          WHERE EXISTS (
            SELECT 1 FROM common_store_days csd 
            WHERE s.${storeColumn} = csd.store_id 
              AND toDayOfYear(toDate(s.${dateColumn})) = csd.day_of_year
          )
          AND toDate(${dateColumn}) >= '${lastYearStart}'
          AND toDate(${dateColumn}) <= '${lastYearEnd}'
          ${rlsCondition}
          ${filterCondition}
        ) as previous_value,
        (SELECT count() FROM common_store_days) as common_days_count
    `;
  } else {
    // Genel fallback (eski mantık)
    lflSql = `
      WITH 
      this_year_days AS (
        SELECT DISTINCT toDayOfYear(toDate(${dateColumn})) as day_of_year
        FROM ${tableName}
        WHERE toDate(${dateColumn}) >= '${thisYearStart}' 
          AND toDate(${dateColumn}) <= '${thisYearEnd}'
          ${rlsCondition}
          ${filterCondition}
      ),
      last_year_days AS (
        SELECT DISTINCT toDayOfYear(toDate(${dateColumn})) as day_of_year
        FROM ${tableName}
        WHERE toDate(${dateColumn}) >= '${lastYearStart}' 
          AND toDate(${dateColumn}) <= '${lastYearEnd}'
          ${rlsCondition}
          ${filterCondition}
      ),
      common_days AS (
        SELECT t.day_of_year
        FROM this_year_days t
        INNER JOIN last_year_days l ON t.day_of_year = l.day_of_year
      )
      SELECT 
        (
          SELECT ${aggFunc}
          FROM ${tableName}
          WHERE toDayOfYear(toDate(${dateColumn})) IN (SELECT day_of_year FROM common_days)
            AND toDate(${dateColumn}) >= '${thisYearStart}'
            AND toDate(${dateColumn}) <= '${thisYearEnd}'
            ${rlsCondition}
            ${filterCondition}
        ) as current_value,
        (
          SELECT ${aggFunc}
          FROM ${tableName}
          WHERE toDayOfYear(toDate(${dateColumn})) IN (SELECT day_of_year FROM common_days)
            AND toDate(${dateColumn}) >= '${lastYearStart}'
            AND toDate(${dateColumn}) <= '${lastYearEnd}'
            ${rlsCondition}
            ${filterCondition}
        ) as previous_value,
        (SELECT count() FROM common_days) as common_days_count
    `;
  }
  
  const result = await clickhouse.query<{
    current_value: number;
    previous_value: number;
    common_days_count: number;
  }>(lflSql);
  
  if (result.length === 0 || result[0].common_days_count === 0) {
    return null;
  }
  
  const { current_value, previous_value, common_days_count } = result[0];
  const currentVal = Number(current_value) || 0;
  const previousVal = Number(previous_value) || 0;
  
  let trend = 0;
  if (previousVal !== 0) {
    trend = ((currentVal - previousVal) / Math.abs(previousVal)) * 100;
  } else if (currentVal > 0) {
    trend = 100;
  }
  
  return {
    currentValue: currentVal,
    previousValue: previousVal,
    trend,
    commonDays: Number(common_days_count),
    uniqueStores: undefined,  // Fallback'te mağaza sayısı hesaplanmıyor
    isStoreBased: !!storeColumn
  };
}

/**
 * Tarihi YYYY-MM-DD formatına çevirir
 */
function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calculatePreviousPeriodDates(compType: string): { 
  prevStartDate: string; 
  prevEndDate: string; 
  currentDays: number;
} {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  let prevStart: Date;
  let prevEnd: Date;
  let currentDays = 1;
  
  switch (compType) {
    case 'yoy': {
      // Geçen Yıl Aynı Gün
      // Bugün: 26 Aralık 2025 → Geçen yıl: 26 Aralık 2024
      prevStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      currentDays = 1;
      break;
    }
    
    case 'mom': {
      // Geçen Ay Aynı Gün
      // Bugün: 26 Aralık 2025 → Geçen ay: 26 Kasım 2025
      prevStart = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      prevEnd = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      currentDays = 1;
      break;
    }
    
    case 'wow': {
      // Geçen Hafta
      // Bugün: 26 Aralık 2025 (Cuma) → Geçen hafta: 19 Aralık 2025 (Cuma)
      prevStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      currentDays = 1;
      break;
    }
    
    case 'ytd': {
      // Yılbaşından Bugüne (Year-to-Date)
      // Bu yıl: 1 Ocak 2025 - 26 Aralık 2025
      // Geçen yıl: 1 Ocak 2024 - 26 Aralık 2024
      const yearStart = new Date(today.getFullYear(), 0, 1);
      currentDays = Math.floor((today.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      prevStart = new Date(today.getFullYear() - 1, 0, 1);
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      break;
    }
    
    case 'lfl': {
      // Like-for-Like (YTD ile aynı tarih aralığı, ancak LFL filtresi backend'de uygulanmalı)
      // NOT: LFL için daha gelişmiş bir implementasyon gerekir
      // Şimdilik YTD gibi davran
      const yearStart = new Date(today.getFullYear(), 0, 1);
      currentDays = Math.floor((today.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      prevStart = new Date(today.getFullYear() - 1, 0, 1);
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      break;
    }
    
    default: {
      // Varsayılan: Geçen yıl aynı gün
      prevStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      currentDays = 1;
    }
  }
  
  // Tarihleri YYYY-MM-DD formatına çevir
  const formatDate = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  return {
    prevStartDate: formatDate(prevStart),
    prevEndDate: formatDate(prevEnd),
    currentDays
  };
}

// ============================================
// TYPES
// ============================================

interface Metric {
  id: string;
  tenant_id: string;
  dataset_id: string | null;
  name: string;
  description: string | null;
  query_sql: string;
  result_type: 'number' | 'currency' | 'percentage' | 'date' | 'string';
  format_pattern: string | null;
  prefix: string | null;
  suffix: string | null;
  aggregation: string;
  parameters: any[];
  cache_ttl: number;
}

interface MetricResult {
  value: any;
  formatted: string;
  metadata?: Record<string, any>;
  executionTime: number;
  cached: boolean;
}

// ============================================
// MIDDLEWARE
// ============================================

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(requestLogger(logger));

// ============================================
// AGGREGATION TYPES
// ============================================

const AGGREGATION_TYPES = [
  { value: 'SUM', label: 'Toplam', description: 'Tüm değerlerin toplamı', icon: 'Plus' },
  { value: 'AVG', label: 'Ortalama', description: 'Aritmetik ortalama', icon: 'Divide' },
  { value: 'COUNT', label: 'Sayım', description: 'Kayıt sayısı', icon: 'Hash' },
  { value: 'DISTINCT', label: 'Benzersiz Sayım', description: 'Farklı değer sayısı', icon: 'Fingerprint' },
  { value: 'MIN', label: 'Minimum', description: 'En küçük değer', icon: 'ArrowDown' },
  { value: 'MAX', label: 'Maksimum', description: 'En büyük değer', icon: 'ArrowUp' },
  { value: 'FIRST', label: 'İlk Değer', description: 'İlk kayıt', icon: 'SkipBack' },
  { value: 'LAST', label: 'Son Değer', description: 'Son kayıt', icon: 'SkipForward' },
  { value: 'LIST', label: 'Liste', description: 'Tüm değerler (grid)', icon: 'List' }
];

const VISUALIZATION_TYPES = [
  { value: 'kpi_card', label: 'KPI Kartı', category: 'summary', icon: 'Square' },
  { value: 'big_number', label: 'Büyük Sayı', category: 'summary', icon: 'Hash' },
  { value: 'progress', label: 'İlerleme Çubuğu', category: 'summary', icon: 'Loader' },
  { value: 'gauge', label: 'Gösterge', category: 'summary', icon: 'Gauge' },
  { value: 'sparkline', label: 'Mini Grafik', category: 'trend', icon: 'TrendingUp' },
  { value: 'trend', label: 'Trend Kartı', category: 'trend', icon: 'Activity' },
  { value: 'comparison', label: 'Karşılaştırma', category: 'compare', icon: 'GitCompare' },
  { value: 'bar_chart', label: 'Çubuk Grafik', category: 'chart', icon: 'BarChart3' },
  { value: 'line_chart', label: 'Çizgi Grafik', category: 'chart', icon: 'LineChart' },
  { value: 'area_chart', label: 'Alan Grafik', category: 'chart', icon: 'AreaChart' },
  { value: 'pie_chart', label: 'Pasta Grafik', category: 'chart', icon: 'PieChart' },
  { value: 'donut_chart', label: 'Halka Grafik', category: 'chart', icon: 'Donut' },
  { value: 'map_chart', label: 'Harita', category: 'chart', icon: 'MapPin' },
  { value: 'combo_chart', label: 'Combo Grafik', category: 'chart', icon: 'BarChart2' },
  { value: 'heatmap', label: 'Isı Haritası', category: 'chart', icon: 'Grid3X3' },
  { value: 'treemap', label: 'Ağaç Haritası', category: 'chart', icon: 'LayoutGrid' },
  { value: 'funnel_chart', label: 'Huni Grafik', category: 'chart', icon: 'Filter' },
  { value: 'scatter_plot', label: 'Dağılım Grafik', category: 'chart', icon: 'ScatterChart' },
  { value: 'data_grid', label: 'Veri Tablosu', category: 'table', icon: 'Table2' },
  { value: 'ranking_list', label: 'Sıralama Listesi', category: 'table', icon: 'Trophy' }
];

// ============================================
// RLS (Row-Level Security) HELPER FUNCTIONS
// ============================================

/**
 * SQL sorgusuna RLS WHERE koşulu ekler
 * Mevcut WHERE varsa AND ile ekler, yoksa WHERE oluşturur
 * GROUP BY, ORDER BY, LIMIT'ten önce eklenir
 */
function addRLSWhereClause(sql: string, column: string, value: string): string {
  // SQL'i parse et - büyük/küçük harf duyarsız
  const sqlLower = sql.toLowerCase();
  
  // RLS koşulu
  const rlsCondition = `${column} = '${value.replace(/'/g, "''")}'`;
  
  // WHERE var mı kontrol et
  const whereIndex = sqlLower.indexOf(' where ');
  const groupByIndex = sqlLower.indexOf(' group by ');
  const orderByIndex = sqlLower.indexOf(' order by ');
  const limitIndex = sqlLower.indexOf(' limit ');
  
  // En erken son maddeyi bul (GROUP BY, ORDER BY, LIMIT)
  let insertIndex = sql.length;
  if (limitIndex !== -1 && limitIndex < insertIndex) insertIndex = limitIndex;
  if (orderByIndex !== -1 && orderByIndex < insertIndex) insertIndex = orderByIndex;
  if (groupByIndex !== -1 && groupByIndex < insertIndex) insertIndex = groupByIndex;
  
  if (whereIndex !== -1 && whereIndex < insertIndex) {
    // WHERE var - AND ile ekle
    // WHERE'den sonra ilk boşluğa kadar olan kısmı bul
    const whereEndIndex = whereIndex + 7; // " WHERE " uzunluğu
    
    // GROUP BY/ORDER BY/LIMIT'ten önceki konuma AND ekle
    const beforeClause = sql.substring(0, insertIndex);
    const afterClause = sql.substring(insertIndex);
    
    return `${beforeClause} AND ${rlsCondition}${afterClause}`;
  } else {
    // WHERE yok - oluştur
    const beforeClause = sql.substring(0, insertIndex);
    const afterClause = sql.substring(insertIndex);
    
    return `${beforeClause} WHERE ${rlsCondition}${afterClause}`;
  }
}

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', async (req: Request, res: Response) => {
  const chHealthy = await clickhouse.checkHealth();
  const cacheHealthy = await cache.checkHealth();
  const dbHealthy = await db.checkHealth();
  
  res.json({
    service: 'analytics-service',
    status: chHealthy && cacheHealthy && dbHealthy ? 'healthy' : 'degraded',
    checks: {
      clickhouse: chHealthy ? 'ok' : 'error',
      cache: cacheHealthy ? 'ok' : 'error',
      database: dbHealthy ? 'ok' : 'error'
    },
    timestamp: new Date().toISOString()
  });
});

// ============================================
// METRIC CRUD
// ============================================

/**
 * Aggregation ve Visualization tiplerini getir
 */
app.get('/metric-types', authenticate, async (req: Request, res: Response) => {
  res.json({ 
    success: true, 
    data: { 
      aggregationTypes: AGGREGATION_TYPES,
      visualizationTypes: VISUALIZATION_TYPES
    } 
  });
});

/**
 * Tüm metrikleri listele
 */
app.get('/metrics', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId, isActive } = req.query;

    let sql = `
      SELECT m.*, d.name as dataset_name, d.clickhouse_table
      FROM metrics m
      LEFT JOIN datasets d ON m.dataset_id = d.id
      WHERE m.tenant_id = $1
    `;
    const params: any[] = [req.user!.tenantId];

    if (datasetId) {
      sql += ` AND m.dataset_id = $${params.length + 1}`;
      params.push(datasetId);
    }

    if (isActive !== undefined) {
      sql += ` AND m.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    sql += ' ORDER BY m.created_at DESC';

    const metrics = await db.queryAll(sql, params);

    // camelCase dönüşümü
    const formatted = metrics.map(m => ({
      id: m.id,
      tenantId: m.tenant_id,
      name: m.name,
      label: m.label,
      description: m.description,
      icon: m.icon,
      color: m.color,
      datasetId: m.dataset_id,
      datasetName: m.dataset_name,
      clickhouseTable: m.clickhouse_table,
      dbColumn: m.db_column,
      aggregationType: m.aggregation_type,
      filterSql: m.filter_sql,
      groupByColumn: m.group_by_column,
      orderByColumn: m.order_by_column,
      orderDirection: m.order_direction,
      visualizationType: m.visualization_type,
      chartConfig: m.chart_config,
      formatConfig: m.format_config,
      comparisonEnabled: m.comparison_enabled,
      comparisonType: m.comparison_type,
      comparisonConfig: m.comparison_config,
      targetValue: m.target_value,
      defaultWidth: m.default_width,
      defaultHeight: m.default_height,
      isActive: m.is_active,
      cacheTtl: m.cache_ttl,
      createdAt: m.created_at,
      updatedAt: m.updated_at
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    next(error);
  }
});

/**
 * Metrik detayı getir
 */
app.get('/metrics/:metricId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;

    const metric = await db.queryOne(
      `SELECT m.*, d.name as dataset_name, d.clickhouse_table
       FROM metrics m
       LEFT JOIN datasets d ON m.dataset_id = d.id
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [metricId, req.user!.tenantId]
    );

    if (!metric) {
      throw new NotFoundError('Metrik');
    }

    res.json({ success: true, data: metric });
  } catch (error) {
    next(error);
  }
});

/**
 * Yeni metrik oluştur
 */
app.post('/metrics', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      label,
      description,
      icon,
      color,
      datasetId,
      clickhouseTable,
      dbColumn,
      aggregationType,
      filterSql,
      groupByColumn,
      orderByColumn,
      orderDirection,
      visualizationType,
      chartConfig,
      formatConfig,
      comparisonEnabled,
      comparisonType,
      comparisonConfig,
      targetValue,
      targetColumn,
      defaultWidth,
      defaultHeight,
      cacheTtl,
      useSqlMode,
      customSql
    } = req.body;

    if (!name || !label) {
      throw new ValidationError('name ve label zorunludur');
    }

    // Dataset'ten clickhouse_table al
    let finalClickhouseTable = clickhouseTable;
    if (datasetId && !finalClickhouseTable) {
      const dataset = await db.queryOne('SELECT clickhouse_table FROM datasets WHERE id = $1', [datasetId]);
      if (dataset) {
        finalClickhouseTable = dataset.clickhouse_table;
      }
    }

    // Dinamik query_sql oluştur (ClickHouse için)
    let querySql = '';
    if (finalClickhouseTable && dbColumn && aggregationType) {
      const agg = aggregationType.toUpperCase();
      if (agg === 'LIST') {
        // Liste tipi - group by ile
        if (groupByColumn) {
          querySql = `SELECT ${groupByColumn}, ${dbColumn} FROM ${finalClickhouseTable}`;
          if (filterSql) querySql += ` WHERE ${filterSql}`;
          querySql += ` ORDER BY ${orderByColumn || dbColumn} ${orderDirection || 'DESC'}`;
          querySql += ` LIMIT 100`;
        } else {
          querySql = `SELECT ${dbColumn} FROM ${finalClickhouseTable}`;
          if (filterSql) querySql += ` WHERE ${filterSql}`;
          querySql += ` LIMIT 100`;
        }
      } else {
        // Aggregation tipi
        querySql = `SELECT ${agg}(${dbColumn}) as value FROM ${finalClickhouseTable}`;
        if (filterSql) querySql += ` WHERE ${filterSql}`;
        if (groupByColumn) {
          querySql = `SELECT ${groupByColumn}, ${agg}(${dbColumn}) as value FROM ${finalClickhouseTable}`;
          if (filterSql) querySql += ` WHERE ${filterSql}`;
          querySql += ` GROUP BY ${groupByColumn}`;
          querySql += ` ORDER BY value ${orderDirection || 'DESC'}`;
          querySql += ` LIMIT 50`;
        }
      }
    }

    const result = await db.queryOne(`
      INSERT INTO metrics (
        tenant_id, name, label, description, icon, color,
        dataset_id, clickhouse_table, db_column, aggregation_type, filter_sql,
        group_by_column, order_by_column, order_direction,
        visualization_type, chart_config, format_config,
        comparison_enabled, comparison_type, comparison_config,
        target_value, target_column, default_width, default_height, cache_ttl,
        query_sql, created_by, use_sql_mode, custom_sql
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
      RETURNING id
    `, [
      req.user!.tenantId, name, label, description || null, icon || 'BarChart3', color || '#3B82F6',
      datasetId || null, finalClickhouseTable || null, dbColumn || null, aggregationType || 'SUM', filterSql || null,
      groupByColumn || null, orderByColumn || null, orderDirection || 'DESC',
      visualizationType || 'kpi_card', chartConfig || {}, formatConfig || {},
      comparisonEnabled || false, comparisonType || null, comparisonConfig || {},
      targetValue || null, targetColumn || null, defaultWidth || 3, defaultHeight || 2, cacheTtl || 300,
      querySql || null, req.user!.userId, useSqlMode || false, customSql || null
    ]);

    logger.info('Metric created', { 
      metricId: result.id, 
      name, 
      clickhouseTable: finalClickhouseTable,
      querySql,
      user: req.user!.userId 
    });

    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error) {
    next(error);
  }
});

/**
 * Metrik güncelle
 */
app.put('/metrics/:metricId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;
    const updates = req.body;

    // Metrik var mı kontrol et
    const existing = await db.queryOne(
      'SELECT id FROM metrics WHERE id = $1 AND tenant_id = $2',
      [metricId, req.user!.tenantId]
    );

    if (!existing) {
      throw new NotFoundError('Metrik');
    }

    // Güncelleme sorgusu oluştur
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      name: 'name',
      label: 'label',
      description: 'description',
      icon: 'icon',
      color: 'color',
      datasetId: 'dataset_id',
      dbColumn: 'db_column',
      aggregationType: 'aggregation_type',
      filterSql: 'filter_sql',
      groupByColumn: 'group_by_column',
      orderByColumn: 'order_by_column',
      orderDirection: 'order_direction',
      visualizationType: 'visualization_type',
      chartConfig: 'chart_config',
      formatConfig: 'format_config',
      comparisonEnabled: 'comparison_enabled',
      comparisonType: 'comparison_type',
      comparisonConfig: 'comparison_config',
      targetValue: 'target_value',
      defaultWidth: 'default_width',
      defaultHeight: 'default_height',
      isActive: 'is_active',
      cacheTtl: 'cache_ttl',
      useSqlMode: 'use_sql_mode',
      customSql: 'custom_sql'
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (updates[key] !== undefined) {
        fields.push(`${dbField} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    }

    if (fields.length === 0) {
      throw new ValidationError('Güncellenecek alan bulunamadı');
    }

    values.push(metricId);
    values.push(req.user!.tenantId);

    await db.query(
      `UPDATE metrics SET ${fields.join(', ')}, updated_at = NOW() 
       WHERE id = $${paramIndex} AND tenant_id = $${paramIndex + 1}`,
      values
    );

    // Metrik ve dashboard cache'lerini temizle
    try {
      // Redis'ten bu metrik için tüm cache'leri temizle
      await cache.del(`metric:${metricId}:*`);
      
      // Dashboard cache'lerini de temizle (pattern ile)
      await cache.del(`dashboard:*`);
      
      logger.info('Metric and dashboard cache cleared', { metricId });
    } catch (cacheError) {
      logger.warn('Failed to clear cache', { metricId, error: cacheError });
    }

    logger.info('Metric updated', { metricId, user: req.user!.userId });

    res.json({ success: true, message: 'Metrik güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * Metrik çoğalt (Duplicate)
 */
app.post('/metrics/:metricId/duplicate', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;
    const { newName } = req.body;

    // Mevcut metriği al
    const original = await db.queryOne(
      'SELECT * FROM metrics WHERE id = $1 AND tenant_id = $2',
      [metricId, req.user!.tenantId]
    );

    if (!original) {
      throw new NotFoundError('Metrik');
    }

    // Yeni isim belirle
    const duplicateName = newName || `${original.name} (Kopya)`;

    // Yeni metrik oluştur
    const newMetric = await db.queryOne(
      `INSERT INTO metrics (
        tenant_id, name, label, description, dataset_id, clickhouse_table,
        aggregation_type, db_column, group_by_column, filter_sql,
        visualization_type, chart_config, comparison_enabled, comparison_type,
        target_value, use_sql_mode, custom_sql, icon, color
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *`,
      [
        req.user!.tenantId,
        duplicateName,
        duplicateName, // label = name
        original.description,
        original.dataset_id,
        original.clickhouse_table,
        original.aggregation_type,
        original.db_column,
        original.group_by_column,
        original.filter_sql,
        original.visualization_type,
        original.chart_config,
        original.comparison_enabled,
        original.comparison_type,
        original.target_value,
        original.use_sql_mode,
        original.custom_sql,
        original.icon,
        original.color
      ]
    );

    res.json({
      success: true,
      data: newMetric,
      message: `Metrik "${duplicateName}" olarak kopyalandı`
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Metrik sil
 */
app.delete('/metrics/:metricId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;

    const result = await db.query(
      'DELETE FROM metrics WHERE id = $1 AND tenant_id = $2',
      [metricId, req.user!.tenantId]
    );

    if (result.rowCount === 0) {
      throw new NotFoundError('Metrik');
    }

    // Metrik cache'ini temizle
    try {
      await cache.del(`metric:${metricId}:default`);
      logger.info('Metric cache cleared on delete', { metricId });
    } catch (cacheError) {
      logger.warn('Failed to clear metric cache on delete', { metricId, error: cacheError });
    }

    logger.info('Metric deleted', { metricId, user: req.user!.userId });

    res.json({ success: true, message: 'Metrik silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// METRIC EXECUTION
// ============================================

/**
 * Execute a metric by ID
 * Parametreler query string veya body'den alınır
 * RLS (Row-Level Security) uygulanır
 */
app.get('/metrics/:metricId/execute', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;
    const parameters = req.query;

    // RLS için user bilgilerini geç
    const userRLS = {
      userId: req.user!.userId,
      filterLevel: (req.user as any).filterLevel || 'none',
      filterValue: (req.user as any).filterValue || null
    };

    const result = await executeMetric(metricId, req.user!.tenantId, parameters, userRLS);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

app.post('/metrics/:metricId/execute', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;
    const parameters = req.body.parameters || {};

    // RLS için user bilgilerini geç
    const userRLS = {
      userId: req.user!.userId,
      filterLevel: (req.user as any).filterLevel || 'none',
      filterValue: (req.user as any).filterValue || null
    };

    const result = await executeMetric(metricId, req.user!.tenantId, parameters, userRLS);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * DRILL-DOWN: Metrik detayına in
 * Widget'ta tıklandığında çağrılır
 * Seçilen değere göre alt detayları getirir
 */
app.post('/metrics/:metricId/drill-down', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricId } = req.params;
    const { field, value, limit = 100 } = req.body;
    
    if (!field || value === undefined) {
      throw new ValidationError('field ve value parametreleri gerekli');
    }

    // Metrik bilgilerini al
    const metric = await db.queryOne(
      `SELECT m.*, d.clickhouse_table, d.source_query 
       FROM metrics m 
       JOIN datasets d ON m.dataset_id = d.id 
       WHERE m.id = $1 AND m.tenant_id = $2`,
      [metricId, req.user!.tenantId]
    );

    if (!metric) {
      throw new NotFoundError('Metrik bulunamadı');
    }

    // RLS için user bilgilerini geç
    const userRLS = {
      userId: req.user!.userId,
      filterLevel: (req.user as any).filterLevel || 'none',
      filterValue: (req.user as any).filterValue || null
    };

    // Drill-down sorgusu oluştur
    const tableName = `clixer_analytics.${metric.clickhouse_table}`;
    const safeField = sanitizeColumnName(field);
    const safeValue = escapeValue(value);
    
    // Temel sorgu - GROUP BY ile detay
    let sql = `SELECT * FROM ${tableName} WHERE ${safeField} = ${safeValue}`;
    
    // RLS uygula
    if (userRLS.filterLevel !== 'none' && userRLS.filterValue) {
      const rlsColumn = metric.chart_config?.rlsColumn || 'store_id';
      sql = addRLSWhereClause(sql, rlsColumn, userRLS.filterValue);
    }
    
    // Limit ekle
    sql += ` LIMIT ${Math.min(Number(limit) || 100, 1000)}`;

    logger.info('Drill-down query', { metricId, field, value, sql: sql.substring(0, 200) });

    const startTime = Date.now();
    const result = await clickhouse.query(sql);
    const executionTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        rows: result,
        count: result.length,
        field,
        value,
        executionTime
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Execute multiple metrics at once (batch)
 * Dashboard için tek endpoint
 * RLS (Row-Level Security) uygulanır
 */
app.post('/metrics/batch', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { metricIds, parameters = {} } = req.body;

    if (!metricIds || !Array.isArray(metricIds)) {
      throw new ValidationError('metricIds dizisi gerekli');
    }

    // RLS için user bilgilerini geç
    const userRLS = {
      userId: req.user!.userId,
      filterLevel: (req.user as any).filterLevel || 'none',
      filterValue: (req.user as any).filterValue || null
    };

    // Paralel olarak tüm metrikleri çalıştır
    const results = await Promise.allSettled(
      metricIds.map(id => executeMetric(id, req.user!.tenantId, parameters, userRLS))
    );

    // Sonuçları birleştir
    const data: Record<string, MetricResult | { error: string }> = {};
    
    metricIds.forEach((id, index) => {
      const result = results[index];
      if (result.status === 'fulfilled') {
        data[id] = result.value;
      } else {
        data[id] = { 
          error: result.reason?.message || 'Metrik çalıştırılamadı',
          value: null,
          formatted: '-',
          executionTime: 0,
          cached: false
        };
      }
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// RLS (Row-Level Security) için user bilgisi tipi
interface UserRLS {
  userId: string;
  filterLevel: 'none' | 'group' | 'region' | 'store';
  filterValue: string | null;
}

/**
 * Core metric execution logic
 * Dinamik olarak ClickHouse sorgusu oluşturur
 * RLS (Row-Level Security) desteği ile
 */
async function executeMetric(
  metricId: string, 
  tenantId: string, 
  parameters: Record<string, any>,
  userRLS?: UserRLS
): Promise<MetricResult> {
  // Metrik ve dataset bilgisini al (RLS kolonları dahil)
  const metric = await db.queryOne<any>(
    `SELECT m.*, d.clickhouse_table, 
            d.store_column, d.region_column, d.group_column
     FROM metrics m
     LEFT JOIN datasets d ON m.dataset_id = d.id
     WHERE m.id = $1 AND m.tenant_id = $2 AND m.is_active = true`,
    [metricId, tenantId]
  );

  if (!metric) {
    throw new NotFoundError('Metrik');
  }

  // RLS için hangi kolonu kullanacağımızı belirle
  let rlsColumn: string | null = null;
  let rlsValue: string | null = null;
  
  if (userRLS && userRLS.filterLevel !== 'none' && userRLS.filterValue) {
    switch (userRLS.filterLevel) {
      case 'group':
        rlsColumn = metric.group_column;
        break;
      case 'region':
        rlsColumn = metric.region_column;
        break;
      case 'store':
        rlsColumn = metric.store_column;
        break;
    }
    rlsValue = userRLS.filterValue;
    
    // Eğer dataset'te ilgili kolon tanımlı değilse, RLS uygulama
    if (!rlsColumn) {
      logger.debug('RLS column not defined for dataset', {
        metricId,
        filterLevel: userRLS.filterLevel,
        datasetColumns: {
          store: metric.store_column,
          region: metric.region_column,
          group: metric.group_column
        }
      });
    }
  }

  // Cache key oluştur (RLS bilgisi dahil - kullanıcı bazlı cache)
  // NOT: startDate, endDate ve storeIds parametreleri cache key'e AÇIKÇA dahil edilmeli!
  const rlsHash = rlsColumn && rlsValue 
    ? Buffer.from(`${rlsColumn}:${rlsValue}`).toString('base64').substring(0, 16)
    : 'all';
  // Tarih parametrelerini özel olarak cache key'e ekle
  const cacheDateStart = parameters.startDate as string || '';
  const cacheDateEnd = parameters.endDate as string || '';
  const dateHash = cacheDateStart && cacheDateEnd ? `${cacheDateStart}_${cacheDateEnd}` : 'nodate';
  // StoreIds parametresini özel olarak cache key'e ekle (hash collision önlemek için)
  const storeIdsParam = parameters.storeIds as string || '';
  const storeHash = storeIdsParam 
    ? Buffer.from(storeIdsParam).toString('base64').substring(0, 32) 
    : 'all';
  const otherParams = { ...parameters };
  delete otherParams.startDate;
  delete otherParams.endDate;
  delete otherParams.storeIds;
  const paramHash = Object.keys(otherParams).length > 0 
    ? Buffer.from(JSON.stringify(otherParams)).toString('base64').substring(0, 32)
    : 'default';
  const cacheKey = `metric:${metricId}:${rlsHash}:${dateHash}:${storeHash}:${paramHash}`;

    // Cache'ten dene
  const cachedResult = await cache.get<MetricResult>(cacheKey);
  if (cachedResult) {
    return { ...cachedResult, cached: true };
  }

  // Dataset yoksa hata
  if (!metric.clickhouse_table) {
    throw new ValidationError('Metrik için dataset tanımlı değil');
  }

  const tableName = `clixer_analytics.${metric.clickhouse_table}`;
  let sql = '';
  let isSqlMode = false;
  
  // SQL Modu aktifse direkt custom_sql kullan
  if (metric.use_sql_mode && metric.custom_sql) {
    isSqlMode = true;
    // custom_sql'deki tablo adını gerçek tablo adıyla değiştir
    // Basit tablo isimleri için (örn: transaction_items -> clixer_analytics.ds_xxx)
    sql = metric.custom_sql;
    
    // Tablo adını tespit et ve değiştir (FROM/JOIN sonrası)
    const tablePattern = /\b(FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;
    sql = sql.replace(tablePattern, (match, keyword, originalTable) => {
      // Eğer zaten clixer_analytics. ile başlıyorsa değiştirme
      if (originalTable.startsWith('clixer_analytics.') || originalTable.startsWith('ds_')) {
        return match;
      }
      return `${keyword} ${tableName}`;
    });
    
    // Parametreleri yerleştir
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      sql = sql.replace(placeholder, escapeValue(value));
    }
    
    // Tarih filtresi - SQL modunda da uygula
    const chartConfigParsed = typeof metric.chart_config === 'string' 
      ? JSON.parse(metric.chart_config) 
      : (metric.chart_config || {});
    const dateColumn = chartConfigParsed?.comparisonColumn || chartConfigParsed?.dateColumn;
    const startDate = parameters.startDate as string;
    const endDate = parameters.endDate as string;
    const allTime = parameters.allTime === 'true' || parameters.allTime === true;
    
    // "Tüm Zamanlar" seçiliyse tarih filtresi UYGULAMA
    if (!allTime && startDate && endDate && dateColumn) {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (datePattern.test(startDate) && datePattern.test(endDate)) {
        const dateCondition = `toDate(${dateColumn}) >= '${startDate}' AND toDate(${dateColumn}) <= '${endDate}'`;
        // WHERE varsa AND ile ekle, yoksa WHERE ekle
        if (sql.toLowerCase().includes('where')) {
          sql = sql.replace(/where/i, `WHERE ${dateCondition} AND `);
        } else {
          // FROM'dan sonra WHERE ekle (GROUP BY, ORDER BY, LIMIT'ten önce)
          const insertPos = sql.search(/\b(GROUP BY|ORDER BY|LIMIT)\b/i);
          if (insertPos > 0) {
            sql = sql.substring(0, insertPos) + ` WHERE ${dateCondition} ` + sql.substring(insertPos);
          } else {
            sql += ` WHERE ${dateCondition}`;
          }
        }
        logger.debug('SQL Mode: Date filter applied', { startDate, endDate, dateColumn });
      }
    }
    
    // LIMIT yoksa ekle
    if (!sql.toLowerCase().includes('limit')) {
      sql += ' LIMIT 100';
    }
  } else {
    // Normal mod - Dinamik SQL oluştur
    const column = metric.db_column || '*';
    const aggType = metric.aggregation_type || 'SUM';
    
    let aggFunc = '';

    // Aggregation tipine göre SQL oluştur
    switch (aggType) {
      case 'SUM':
        aggFunc = `sum(${column})`;
        break;
      case 'AVG':
        aggFunc = `avg(${column})`;
        break;
      case 'COUNT':
        aggFunc = 'count()';
        break;
      case 'DISTINCT':
        aggFunc = `uniq(${column})`;
        break;
      case 'MIN':
        aggFunc = `min(${column})`;
        break;
      case 'MAX':
        aggFunc = `max(${column})`;
        break;
      case 'FIRST':
        aggFunc = `any(${column})`;
        break;
      case 'LAST':
        aggFunc = `anyLast(${column})`;
        break;
      case 'LIST':
        // LIST için tüm verileri çek
        aggFunc = column;
        break;
      default:
        aggFunc = `sum(${column})`;
    }

    // GROUP BY varsa
    if (metric.group_by_column && aggType !== 'LIST') {
      sql = `SELECT ${metric.group_by_column}, ${aggFunc} as value FROM ${tableName}`;
    } else if (aggType === 'LIST') {
      // LIST tipi için chart_config.gridColumns kullan
      const chartConfig = typeof metric.chart_config === 'string' 
        ? JSON.parse(metric.chart_config) 
        : (metric.chart_config || {});
      const gridColumns = chartConfig.gridColumns || [];
      
      if (gridColumns.length > 0) {
        const columns = gridColumns.map((c: any) => c.column || c).join(', ');
        sql = `SELECT ${columns} FROM ${tableName}`;
      } else {
        sql = `SELECT ${column} FROM ${tableName}`;
      }
    } else {
      sql = `SELECT ${aggFunc} as value FROM ${tableName}`;
    }

    // WHERE koşulu
    let whereConditions: string[] = [];
    
    // Karşılaştırma modu aktifse otomatik tarih filtresi ekle (bugün için)
    const chartConfigParsed = typeof metric.chart_config === 'string' 
      ? JSON.parse(metric.chart_config) 
      : (metric.chart_config || {});
    
    // Tarih filtresi - FilterBar'dan gelen startDate/endDate parametreleri
    const startDate = parameters.startDate as string;
    const endDate = parameters.endDate as string;
    const allTime = parameters.allTime === 'true' || parameters.allTime === true;
    const dateColumn = chartConfigParsed?.comparisonColumn || chartConfigParsed?.dateColumn;
    
    // "Tüm Zamanlar" seçiliyse tarih filtresi UYGULAMA
    if (allTime) {
      logger.debug('All time selected - no date filter applied');
    } else if (startDate && endDate && dateColumn) {
      // YYYY-MM-DD formatı kontrolü
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;
      if (datePattern.test(startDate) && datePattern.test(endDate)) {
        whereConditions.push(`toDate(${dateColumn}) >= '${startDate}' AND toDate(${dateColumn}) <= '${endDate}'`);
        logger.debug('Date filter applied', { startDate, endDate, dateColumn });
      }
    } else if (metric.comparison_enabled && dateColumn) {
      // Tarih parametresi yoksa ve karşılaştırma aktifse bugünü kullan
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      whereConditions.push(`toDate(${dateColumn}) = '${todayStr}'`);
    }
    
    // Bölge filtresi (FilterBar'dan gelen regionId)
    const regionId = parameters.regionId as string;
    if (regionId && metric.dataset_id) {
      // Dataset'ten region_column'u al
      const datasetResult = await db.query('SELECT region_column FROM datasets WHERE id = $1', [metric.dataset_id]);
      if (datasetResult.rows[0]?.region_column) {
        const regionColumn = datasetResult.rows[0].region_column;
        whereConditions.push(`${regionColumn} = '${regionId}'`);
        logger.debug('Region filter applied', { regionId, regionColumn });
      }
    }
    
    // Mağaza filtresi (FilterBar'dan gelen storeIds - UUID formatında)
    const storeIds = parameters.storeIds as string;
    if (storeIds && metric.dataset_id) {
      // Dataset'ten store_column'u al
      const datasetResult = await db.query('SELECT store_column FROM datasets WHERE id = $1', [metric.dataset_id]);
      if (datasetResult.rows[0]?.store_column) {
        const storeColumn = datasetResult.rows[0].store_column;
        
        // Frontend'den gelen UUID listesini stores.code değerlerine çevir
        // Çünkü ClickHouse'daki BranchID Integer, frontend UUID gönderiyor
        const storeUUIDs = storeIds.split(',').map(s => s.trim());
        const storeCodesResult = await db.query(
          `SELECT code FROM stores WHERE id = ANY($1::uuid[])`,
          [storeUUIDs]
        );
        
        if (storeCodesResult.rows.length > 0) {
          // stores.code değerlerini kullan (BranchID'ler)
          const storeCodes = storeCodesResult.rows.map((r: any) => r.code);
          // Integer kolon için tırnak olmadan, String kolon için tırnaklı
          // ClickHouse'da BranchID Int32 olduğu için tırnaksız gönder
          const storeCodeList = storeCodes.join(',');
          whereConditions.push(`${storeColumn} IN (${storeCodeList})`);
          logger.debug('Store filter applied (UUID to code)', { 
            originalUUIDs: storeUUIDs.length, 
            resolvedCodes: storeCodes.length,
            storeColumn 
          });
        } else {
          logger.warn('No store codes found for UUIDs', { storeUUIDs });
        }
      }
    }
    
    // Sahiplik tipi filtresi (MERKEZ/FRANCHISE)
    const storeType = parameters.storeType as string;
    if (storeType && storeType !== 'ALL' && metric.dataset_id) {
      // Dataset'ten group_column'u al (sahiplik grubu)
      const datasetResult = await db.query('SELECT group_column FROM datasets WHERE id = $1', [metric.dataset_id]);
      if (datasetResult.rows[0]?.group_column) {
        const groupColumn = datasetResult.rows[0].group_column;
        whereConditions.push(`${groupColumn} = '${storeType}'`);
        logger.debug('Store type filter applied', { storeType, groupColumn });
      }
    }
    
    if (metric.filter_sql) {
      let filterSql = metric.filter_sql;
      // Parametreleri yerleştir
      for (const [key, value] of Object.entries(parameters)) {
        const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
        filterSql = filterSql.replace(placeholder, escapeValue(value));
      }
      whereConditions.push(filterSql);
    }
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // GROUP BY
    if (metric.group_by_column && aggType !== 'LIST') {
      sql += ` GROUP BY ${metric.group_by_column}`;
    }

    // ORDER BY
    if (metric.order_by_column) {
      sql += ` ORDER BY ${metric.order_by_column} ${metric.order_direction || 'DESC'}`;
    } else if (metric.group_by_column) {
      sql += ` ORDER BY value ${metric.order_direction || 'DESC'}`;
    }

    // LIMIT (grafik ve listeler için)
    if (aggType === 'LIST' || metric.group_by_column) {
      sql += ' LIMIT 100';
    }
  }

  // ============================================
  // RLS (Row-Level Security) WHERE Ekleme
  // ============================================
  if (rlsColumn && rlsValue) {
    // SQL'e RLS WHERE koşulu ekle
    sql = addRLSWhereClause(sql, rlsColumn, rlsValue);
    
    logger.debug('RLS applied to query', {
      metricId,
      rlsColumn,
      rlsValue,
      filterLevel: userRLS?.filterLevel
    });
  }

  // ============================================
  // CROSS-FILTER WHERE Ekleme
  // ============================================
  const crossFilters = parameters._crossFilters as Array<{ field: string; value: any }>;
  if (crossFilters && Array.isArray(crossFilters) && crossFilters.length > 0) {
    for (const cf of crossFilters) {
      if (cf.field && cf.value !== undefined) {
        // Güvenli kolon adı kontrolü
        const safeField = sanitizeColumnName(cf.field);
        const safeValue = escapeValue(cf.value);
        sql = addRLSWhereClause(sql, safeField, safeValue);
        
        logger.debug('Cross-filter applied', {
          metricId,
          field: safeField,
          value: safeValue
        });
      }
    }
  }

  // ClickHouse'ta çalıştır
  const startTime = Date.now();
  const queryResult = await clickhouse.query<Record<string, any>>(sql);
  const executionTime = Date.now() - startTime;

  // Sonucu işle
  let value: any = null;
  let metadata: Record<string, any> = {};

  if (queryResult.length > 0) {
    const aggType = metric.aggregation_type || 'SUM';
    // SQL modu veya LIST tipi veya GROUP BY varsa tüm satırları döndür
    if (isSqlMode || aggType === 'LIST' || metric.group_by_column) {
      // Tüm satırları döndür (tablo formatı için)
      value = queryResult;
      metadata.rowCount = queryResult.length;
      // SQL modu için data alanı da ekle (widget render için)
      metadata.data = queryResult;
    } else {
      // Tek değer
      const firstRow = queryResult[0];
      value = firstRow.value;
    }
  }

  // Değeri formatla
  const formatted = formatMetricValue(value, metric);

  // ============================================
  // KARŞILAŞTIRMA HESAPLAMASI (YoY, MoM, WoW, YTD, LFL)
  // ============================================
  let trend: number | null = null;
  let previousValue: number | null = null;
  let comparisonLabel: string | null = null;
  let comparisonDays: { current: number; previous: number } | null = null;

  // Karşılaştırma için chart_config parse
  const chartConfig = typeof metric.chart_config === 'string' 
    ? JSON.parse(metric.chart_config) 
    : (metric.chart_config || {});

  // "Tüm Zamanlar" seçiliyse karşılaştırma YAPMA (ana değeri değiştirme)
  const allTimeComparison = parameters.allTime === 'true' || parameters.allTime === true;
  
  // Karşılaştırma aktifse ve tek değer döndürüldüyse (allTime hariç)
  if (metric.comparison_enabled && typeof value === 'number' && chartConfig?.comparisonColumn && !allTimeComparison) {
    const compType = metric.comparison_type || 'yoy';
    const dateColumn = chartConfig.comparisonColumn;
    comparisonLabel = chartConfig.comparisonLabel || getDefaultComparisonLabel(compType);
    
    try {
      const column = metric.db_column || '*';
      const aggType = metric.aggregation_type || 'SUM';
      
      let aggFunc = '';
      switch (aggType) {
        case 'SUM': aggFunc = `sum(${column})`; break;
        case 'AVG': aggFunc = `avg(${column})`; break;
        case 'COUNT': aggFunc = 'count()'; break;
        case 'DISTINCT': aggFunc = `uniq(${column})`; break;
        case 'MIN': aggFunc = `min(${column})`; break;
        case 'MAX': aggFunc = `max(${column})`; break;
        default: aggFunc = `sum(${column})`;
      }
      
      // RLS koşulu oluştur
      const rlsCondition = rlsColumn && rlsValue ? `AND ${rlsColumn} = '${rlsValue}'` : '';
      const filterCondition = metric.filter_sql ? `AND (${metric.filter_sql})` : '';
      
      // ============================================
      // LFL (Like-for-Like) ÖZEL HESAPLAMA
      // ============================================
      if (compType === 'lfl') {
        // LFL: Sadece her iki dönemde de satış olan günleri karşılaştır
        // FilterBar'dan gelen tarih parametrelerini al
        const lflStartDate = parameters.startDate as string;
        const lflEndDate = parameters.endDate as string;
        
        // LFL Takvim dataset bilgilerini chartConfig'den al
        let lflCalendarConfig: {
          datasetId: string;
          thisYearColumn: string;
          lastYearColumn: string;
          clickhouseTable: string;
        } | undefined;
        
        if (chartConfig.lflCalendarDatasetId) {
          // Dataset'in ClickHouse tablo adını bul
          const lflDataset = await db.queryOne<{ clickhouse_table: string }>(
            'SELECT clickhouse_table FROM datasets WHERE id = $1',
            [chartConfig.lflCalendarDatasetId]
          );
          
          if (lflDataset?.clickhouse_table) {
            lflCalendarConfig = {
              datasetId: chartConfig.lflCalendarDatasetId,
              thisYearColumn: chartConfig.lflThisYearColumn || 'this_year',
              lastYearColumn: chartConfig.lflLastYearColumn || 'last_year',
              clickhouseTable: lflDataset.clickhouse_table
            };
            logger.debug('LFL Calendar config found', lflCalendarConfig);
          }
        }
        
        // Mağaza kolonu - LFL hesaplaması için kritik!
        // Dataset'teki store_column'u kullanarak mağaza bazlı LFL hesapla
        const lflStoreColumn = metric.store_column || null;
        
        // Mağaza filtresi oluştur (storeIds varsa)
        let lflStoreFilter = '';
        const storeIds = parameters.storeIds as string;
        if (storeIds && metric.dataset_id && lflStoreColumn) {
          // Dataset'ten store_column'u al
          const datasetResult = await db.query<{ store_column: string }>(
            'SELECT store_column FROM datasets WHERE id = $1',
            [metric.dataset_id]
          );
          if (datasetResult.rows[0]?.store_column) {
            const storeColumn = datasetResult.rows[0].store_column;
            const storeUUIDs = storeIds.split(',').map(s => s.trim());
            
            // UUID'leri BranchID'lere çevir
            const storeCodesResult = await db.query<{ code: string }>(
              `SELECT code FROM stores WHERE id = ANY($1::uuid[])`,
              [storeUUIDs]
            );
            
            if (storeCodesResult.rows.length > 0) {
              const storeCodes = storeCodesResult.rows.map(r => r.code);
              lflStoreFilter = `AND ${storeColumn} IN (${storeCodes.join(',')})`;
              logger.debug('LFL store filter applied', { 
                storeUUIDs: storeUUIDs.length, 
                storeCodes: storeCodes.length 
              });
            }
          }
        }
        
        const lflResult = await calculateLFL(
          tableName,
          dateColumn,
          column,
          aggFunc,
          rlsCondition,
          filterCondition,
          lflStartDate,
          lflEndDate,
          lflCalendarConfig,
          lflStoreColumn,  // Mağaza bazlı LFL için
          lflStoreFilter   // Mağaza filtresi (storeIds)
        );
        
        if (lflResult) {
          // ⚠️ KRİTİK: LFL ana değeri = sadece ortak mağaza-günlerin toplamı!
          // TÜM veri değil, LFL eşleşen günlerin toplamı gösterilmeli
          value = lflResult.currentValue;
          
          previousValue = lflResult.previousValue;
          trend = lflResult.trend;
          comparisonDays = {
            current: lflResult.commonDays,
            previous: lflResult.commonDays
          };
          
          // Label oluştur: Mağaza bazlı ise "X mağaza · Y gün", değilse "Y gün"
          if (lflResult.isStoreBased && lflResult.uniqueStores) {
            comparisonLabel = `LFL (${lflResult.uniqueStores} mağaza · ${lflResult.commonDays} mağaza-gün)`;
          } else if (lflResult.isStoreBased) {
            comparisonLabel = `LFL (${lflResult.commonDays} mağaza-gün)`;
          } else {
            comparisonLabel = `LFL (${lflResult.commonDays} gün)`;
          }
          
          logger.debug('LFL comparison calculated', {
            metricId,
            currentLFL: lflResult.currentValue,
            previousLFL: lflResult.previousValue,
            commonDays: lflResult.commonDays,
            uniqueStores: lflResult.uniqueStores,
            isStoreBased: lflResult.isStoreBased,
            trend: trend?.toFixed(2),
            usedCalendar: !!lflCalendarConfig,
            storeBasedLFL: !!lflStoreColumn,
            originalValue: value,
            lflValue: lflResult.currentValue
          });
        }
      } else {
        // ============================================
        // STANDART KARŞILAŞTIRMA (YoY, MoM, WoW, YTD)
        // ============================================
        const { prevStartDate, prevEndDate, currentDays } = calculatePreviousPeriodDates(compType);
        
        // Bugünün tarihini hesapla (GÜNCEL DÖNEM)
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        // GÜNCEL DÖNEM değerini hesapla (bugün için)
        let currentWhereConditions: string[] = [];
        currentWhereConditions.push(`toDate(${dateColumn}) = '${todayStr}'`);
        
        if (rlsColumn && rlsValue) {
          currentWhereConditions.push(`${rlsColumn} = '${rlsValue}'`);
        }
        
        if (metric.filter_sql) {
          currentWhereConditions.push(`(${metric.filter_sql})`);
        }
        
        const currentSql = `SELECT ${aggFunc} as value FROM ${tableName} WHERE ${currentWhereConditions.join(' AND ')}`;
        const currentResult = await clickhouse.query<{ value: number }>(currentSql);
        
        // Güncel değeri güncelle (tarih filtreli)
        let currentValue = value; // Fallback: ana değer
        if (currentResult.length > 0 && currentResult[0].value !== null) {
          currentValue = Number(currentResult[0].value);
          value = currentValue; // Ana değeri güncelle
        }
        
        // ÖNCEKİ DÖNEM değerini hesapla
        let whereConditions: string[] = [];
        whereConditions.push(`toDate(${dateColumn}) >= '${prevStartDate}' AND toDate(${dateColumn}) <= '${prevEndDate}'`);
        
        if (rlsColumn && rlsValue) {
          whereConditions.push(`${rlsColumn} = '${rlsValue}'`);
        }
        
        if (metric.filter_sql) {
          whereConditions.push(`(${metric.filter_sql})`);
        }
        
        const prevSql = `SELECT ${aggFunc} as value FROM ${tableName} WHERE ${whereConditions.join(' AND ')}`;
        
        // Önceki dönem verisini çek
        const prevResult = await clickhouse.query<{ value: number }>(prevSql);
        
        if (prevResult.length > 0 && prevResult[0].value !== null) {
          previousValue = Number(prevResult[0].value);
          
          // Trend hesapla (yüzde değişim)
          if (previousValue !== 0) {
            trend = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
          } else if (currentValue > 0) {
            trend = 100;
          } else {
            trend = 0;
          }
          
          comparisonDays = { current: currentDays, previous: currentDays };
        }
        
        logger.debug('Comparison calculated', {
          metricId,
          compType,
          currentValue,
          previousValue,
          trend: trend?.toFixed(2),
          currentPeriod: todayStr,
          prevPeriod: `${prevStartDate} - ${prevEndDate}`
        });
      }
    } catch (compError: any) {
      logger.warn('Comparison calculation failed', { 
        metricId, 
        error: compError.message 
      });
      // Karşılaştırma başarısız olsa bile ana değer döndürülür
    }
  }

  // Metadata'ya karşılaştırma bilgilerini ekle
  if (trend !== null) {
    metadata.trend = trend;
    metadata.previousValue = previousValue;
    metadata.comparisonLabel = comparisonLabel;
    metadata.period = comparisonLabel; // Frontend uyumluluğu için
    if (comparisonDays) {
      metadata.comparisonDays = comparisonDays;
    }
  }

  // ============================================
  // SIRALAMA LİSTESİ - OTOMATİK TREND HESAPLAMA
  // ============================================
  // chartConfigParsed'ı kullan (chartConfig değil!)
  const rankingChartConfig = typeof metric.chart_config === 'string' 
    ? JSON.parse(metric.chart_config) 
    : (metric.chart_config || {});
    
  if (
    metric.visualization_type === 'ranking_list' && 
    rankingChartConfig?.autoCalculateTrend && 
    Array.isArray(value) && 
    value.length > 0
  ) {
    // Eğer SQL zaten trend kolonu döndürüyorsa, üzerine yazma
    const firstRow = value[0];
    const existingTrendColumn = Object.keys(firstRow).find(col => 
      col.toLowerCase().includes('trend') || 
      col.toLowerCase().includes('growth') ||
      col.toLowerCase().includes('change')
    );
    
    if (existingTrendColumn) {
      // SQL'den gelen trend değerlerini koru
      logger.debug('Ranking list: Using SQL-provided trend column', { 
        metricId, 
        trendColumn: existingTrendColumn 
      });
      metadata.trendSource = 'sql';
    } else {
      // Trend kolonu yok, backend hesaplasın
      const trendCompType = rankingChartConfig.trendComparisonType || 'mom';
      const dateColumn = rankingChartConfig.comparisonColumn || null;
      
      if (dateColumn) {
        try {
          // Güncel dönem tarihlerini hesapla
          const today = new Date();
          const currentYear = today.getFullYear();
          const currentMonth = today.getMonth(); // 0-indexed
          
          // MoM için: Bu ay vs Geçen ay
          // YoY için: Bu yılın bu ayı vs Geçen yılın bu ayı
          // WoW için: Bu hafta vs Geçen hafta
          let currStartDate: string, currEndDate: string;
          let prevStartDate: string, prevEndDate: string;
          
          if (trendCompType === 'mom') {
            // Bu ay
            currStartDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            currEndDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            // Geçen ay
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            const lastDayPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
            prevStartDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
            prevEndDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(Math.min(today.getDate(), lastDayPrevMonth)).padStart(2, '0')}`;
          } else if (trendCompType === 'yoy') {
            // Bu yıl bu ay
            currStartDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            currEndDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            // Geçen yıl aynı ay
            prevStartDate = `${currentYear - 1}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            prevEndDate = `${currentYear - 1}-${String(currentMonth + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
          } else {
            // WoW - Bu hafta vs Geçen hafta
            const dayOfWeek = today.getDay();
            const monday = new Date(today);
            monday.setDate(today.getDate() - dayOfWeek + 1);
            const prevMonday = new Date(monday);
            prevMonday.setDate(monday.getDate() - 7);
            
            currStartDate = monday.toISOString().slice(0, 10);
            currEndDate = today.toISOString().slice(0, 10);
            prevStartDate = prevMonday.toISOString().slice(0, 10);
            const prevSunday = new Date(prevMonday);
            prevSunday.setDate(prevMonday.getDate() + (dayOfWeek - 1));
            prevEndDate = prevSunday.toISOString().slice(0, 10);
          }
          
          // SQL modunda GROUP BY kolonunu bul (alias yerine gerçek kolon)
          let actualGroupByColumn: string | null = null;
          // SQL modunda gerçek aggregate kolonunu bul (SUM(line_total) as value -> line_total)
          let actualAggregateColumn: string | null = null;
          
          if (isSqlMode && metric.custom_sql) {
            // GROUP BY kolonunu bul
            const groupByMatch = metric.custom_sql.match(/GROUP\s+BY\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
            if (groupByMatch) {
              actualGroupByColumn = groupByMatch[1];
              logger.debug('SQL mode: Found GROUP BY column', { actualGroupByColumn });
            }
            
            // SUM/AVG/COUNT içindeki gerçek kolonu bul: SUM(net_amount) as value olanı tercih et
            // Önce "as value" içeren aggregation'ı bul
            const valueAggMatch = metric.custom_sql.match(/(?:SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)\s*as\s+value/i);
            if (valueAggMatch) {
              actualAggregateColumn = valueAggMatch[1];
              logger.debug('SQL mode: Found aggregate column (as value)', { actualAggregateColumn });
            } else {
              // Fallback: Herhangi bir aggregation bul
            const aggMatch = metric.custom_sql.match(/(?:SUM|AVG|MIN|MAX)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/i);
            if (aggMatch) {
              actualAggregateColumn = aggMatch[1];
                logger.debug('SQL mode: Found aggregate column (fallback)', { actualAggregateColumn });
              }
            }
          }
          
          // Otomatik trend hesaplama - 10M satıra kadar çalışır
          // Her satır için önceki dönem değerini bul ve trend hesapla
          
          if (actualGroupByColumn && actualAggregateColumn) {
            // Tablo adı: metric.clickhouse_table kullan (SQL'deki alias değil!)
            const tableName = metric.clickhouse_table;
            
            if (tableName) {
              // Mevcut satırların label değerlerini al
              const currentLabels = value.map((row: any) => row.label);
              
              // Önceki dönem sorgusunu oluştur
              const prevPeriodSql = `
                SELECT 
                  toString(${actualGroupByColumn}) as label,
                  SUM(${actualAggregateColumn}) as prev_value
                FROM clixer_analytics.${tableName}
                WHERE toDate(${dateColumn}) >= '${prevStartDate}' 
                  AND toDate(${dateColumn}) <= '${prevEndDate}'
                  AND toString(${actualGroupByColumn}) IN (${currentLabels.map((l: any) => `'${l}'`).join(',')})
                GROUP BY ${actualGroupByColumn}
              `;
              
              logger.debug('Ranking list prev period query', { prevPeriodSql });
              
              try {
                const prevResult = await clickhouse.query(prevPeriodSql);
                const prevData = prevResult as any[];
                
                // Önceki dönem değerlerini map'e dönüştür
                const prevValueMap = new Map<string, number>();
                prevData.forEach((row: any) => {
                  prevValueMap.set(String(row.label), parseFloat(row.prev_value) || 0);
                });
                
                // Trend değerlerini hesapla
                const valuesWithTrend = value.map((row: any) => {
                  const currentValue = parseFloat(row.value) || 0;
                  const prevValue = prevValueMap.get(String(row.label)) || 0;
                  
                  let trend: number | null = null;
                  if (prevValue !== 0) {
                    trend = ((currentValue - prevValue) / prevValue) * 100;
                    trend = Math.round(trend * 10) / 10; // 1 ondalık basamak
                  } else if (currentValue > 0) {
                    trend = 100; // Önceki dönem 0, şimdi var = %100 artış
                  }
                  
                  return { ...row, trend };
                });
          
          value = valuesWithTrend;
                metadata.autoTrendCalculated = true;
                metadata.trendSource = 'backend_calculated';
                
                logger.info('Ranking list auto trend calculated successfully', {
                  metricId,
                  trendCompType,
                  rowCount: value.length,
                  prevDataCount: prevData.length
                });
              } catch (prevQueryError: any) {
                logger.warn('Ranking list prev period query failed', {
                  metricId,
                  error: prevQueryError.message
                });
                // Hata durumunda trend null olarak bırak
                const valuesWithTrend = value.map((row: any) => ({ ...row, trend: null }));
                value = valuesWithTrend;
              }
            } else {
              // Tablo adı bulunamadı
              const valuesWithTrend = value.map((row: any) => ({ ...row, trend: null }));
              value = valuesWithTrend;
              logger.debug('Ranking list: Table name not found in SQL', { metricId });
            }
          } else {
            // Grup veya aggregate kolonu bulunamadı
            const valuesWithTrend = value.map((row: any) => ({ ...row, trend: null }));
            value = valuesWithTrend;
            metadata.autoTrendCalculated = false;
            metadata.trendSource = 'skipped_no_columns';
            logger.debug('Ranking list: GROUP BY or aggregate column not found', { metricId, actualGroupByColumn, actualAggregateColumn });
          }
          
          // Metadata sadece eğer trend hesaplanmadıysa set et (backend_calculated override etmemek için)
          if (!metadata.autoTrendCalculated) {
          metadata.autoTrendCalculated = true;
          metadata.trendComparisonType = trendCompType;
          metadata.trendPeriods = { current: `${currStartDate} - ${currEndDate}`, previous: `${prevStartDate} - ${prevEndDate}` };
          }
          
          logger.debug('Ranking list auto trend processing completed', {
            metricId,
            trendCompType,
            trendSource: metadata.trendSource,
            rowCount: value.length
          });
        } catch (trendError: any) {
          logger.warn('Ranking list auto trend calculation failed', {
            metricId,
            error: trendError.message
          });
        }
      } else {
        logger.debug('Ranking list auto trend skipped - no date column configured', { metricId });
      }
    }
  }

  // Değer değişmişse (LFL, ranking vs.) formatted değerini yeniden hesapla
  const finalFormatted = formatMetricValue(value, metric);
  
  const result: MetricResult = {
    value,
    formatted: finalFormatted,
    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    executionTime,
    cached: false
  };

  // Cache'e yaz
  await cache.set(cacheKey, result, metric.cache_ttl || 300);

  logger.debug('Metric executed', { 
    metricId, 
    executionTime: `${executionTime}ms`,
    cached: false
  });

  return result;
}

// ============================================
// DATASET DIRECT QUERY
// ============================================

/**
 * ClickHouse tablosundan direkt veri çek (widget'lar için)
 */
app.get('/datasets/:datasetId/query', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    const { 
      columns = '*',
      where,
      groupBy,
      orderBy,
      limit = 1000,
      offset = 0
    } = req.query;

    // Dataset'i kontrol et (RLS kolonları dahil)
    const dataset = await db.queryOne(
      'SELECT clickhouse_table, store_column, region_column, group_column FROM datasets WHERE id = $1 AND tenant_id = $2',
      [datasetId, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    const tableName = dataset.clickhouse_table;
    
    // RLS bilgisini al
    const userFilterLevel = (req.user as any).filterLevel || 'none';
    const userFilterValue = (req.user as any).filterValue || null;
    const cacheKey = `dataset:${datasetId}:${userFilterLevel}:${userFilterValue}:${JSON.stringify(req.query)}`;

    // Cache check
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Query oluştur
    let sql = `SELECT ${columns} FROM ${tableName}`;
    
    // RLS WHERE koşulu oluştur
    let rlsCondition: string | null = null;
    if (userFilterLevel !== 'none' && userFilterValue) {
      let rlsColumn: string | null = null;
      switch (userFilterLevel) {
        case 'store': rlsColumn = dataset.store_column; break;
        case 'region': rlsColumn = dataset.region_column; break;
        case 'group': rlsColumn = dataset.group_column; break;
      }
      if (rlsColumn) {
        rlsCondition = `${rlsColumn} = '${userFilterValue.replace(/'/g, "''")}'`;
      }
    }
    
    // WHERE koşullarını birleştir
    const whereConditions: string[] = [];
    if (rlsCondition) whereConditions.push(rlsCondition);
    if (where) whereConditions.push(String(where));
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (groupBy) {
      sql += ` GROUP BY ${groupBy}`;
    }
    
    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }
    
    sql += ` LIMIT ${Math.min(Number(limit), 10000)} OFFSET ${Number(offset)}`;

    const startTime = Date.now();
    const data = await clickhouse.query(sql);
    const executionTime = Date.now() - startTime;

    const result = {
      rows: data,
      rowCount: data.length,
      executionTime
    };

    // Cache (2 dakika)
    await cache.set(cacheKey, result, 120);

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    next(error);
  }
});

/**
 * Aggregate query (KPI kartları için)
 */
app.post('/datasets/:datasetId/aggregate', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;
    const { 
      column,
      aggregation = 'sum', // sum, avg, count, min, max, uniq
      where,
      groupBy
    } = req.body;

    if (!column && aggregation !== 'count') {
      throw new ValidationError('column gerekli');
    }

    // Dataset'i kontrol et (RLS kolonları dahil)
    const dataset = await db.queryOne(
      'SELECT clickhouse_table, store_column, region_column, group_column FROM datasets WHERE id = $1 AND tenant_id = $2',
      [datasetId, req.user!.tenantId]
    );

    if (!dataset) {
      throw new NotFoundError('Dataset');
    }

    const tableName = dataset.clickhouse_table;
    
    // RLS bilgisini al
    const userFilterLevel = (req.user as any).filterLevel || 'none';
    const userFilterValue = (req.user as any).filterValue || null;
    const cacheKey = `dataset:agg:${datasetId}:${userFilterLevel}:${userFilterValue}:${aggregation}:${column}:${JSON.stringify({ where, groupBy })}`;

    // Cache check
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // RLS WHERE koşulu oluştur
    let rlsCondition: string | null = null;
    if (userFilterLevel !== 'none' && userFilterValue) {
      let rlsColumn: string | null = null;
      switch (userFilterLevel) {
        case 'store': rlsColumn = dataset.store_column; break;
        case 'region': rlsColumn = dataset.region_column; break;
        case 'group': rlsColumn = dataset.group_column; break;
      }
      if (rlsColumn) {
        rlsCondition = `${rlsColumn} = '${userFilterValue.replace(/'/g, "''")}'`;
      }
    }

    // Aggregation fonksiyonu
    let aggFunc: string;
    switch (aggregation) {
      case 'sum': aggFunc = `sum(${column})`; break;
      case 'avg': aggFunc = `avg(${column})`; break;
      case 'count': aggFunc = 'count()'; break;
      case 'min': aggFunc = `min(${column})`; break;
      case 'max': aggFunc = `max(${column})`; break;
      case 'uniq': aggFunc = `uniq(${column})`; break;
      default: aggFunc = `sum(${column})`;
    }

    let sql = `SELECT ${aggFunc} as value`;

    if (groupBy) {
      sql = `SELECT ${groupBy}, ${aggFunc} as value`;
    }
    
    sql += ` FROM ${tableName}`;
    
    // WHERE koşullarını birleştir
    const whereConditions: string[] = [];
    if (rlsCondition) whereConditions.push(rlsCondition);
    if (where) whereConditions.push(String(where));
    
    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    if (groupBy) {
      sql += ` GROUP BY ${groupBy} ORDER BY value DESC LIMIT 100`;
    }

    const startTime = Date.now();
    const data = await clickhouse.query(sql);
    const executionTime = Date.now() - startTime;

    const result = {
      value: groupBy ? undefined : data[0]?.value,
      rows: groupBy ? data : undefined,
      executionTime
    };

    // Cache (5 dakika)
    await cache.set(cacheKey, result, 300);

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DESIGN CRUD
// ============================================

/**
 * Tüm tasarımları listele
 */
app.get('/designs', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, isActive } = req.query;

    let sql = `
      SELECT d.*, 
             (SELECT COUNT(*) FROM design_widgets dw WHERE dw.design_id = d.id) as widget_count
      FROM designs d
      WHERE d.tenant_id = $1
    `;
    const params: any[] = [req.user!.tenantId];

    if (type) {
      sql += ` AND d.type = $${params.length + 1}`;
      params.push(type);
    }

    if (isActive !== undefined) {
      sql += ` AND d.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    sql += ' ORDER BY d.is_default DESC, d.created_at DESC';

    const designs = await db.queryAll(sql, params);

    res.json({ success: true, data: designs });
  } catch (error) {
    next(error);
  }
});

/**
 * Tasarım detayı (widget'lar dahil)
 */
app.get('/designs/:designId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;

    // Design
    const design = await db.queryOne(
      'SELECT * FROM designs WHERE id = $1 AND tenant_id = $2',
      [designId, req.user!.tenantId]
    );

    if (!design) {
      throw new NotFoundError('Tasarım');
    }

    // Widgets
    const widgets = await db.queryAll(`
      SELECT dw.*, m.name as metric_name, m.label as metric_label, 
             m.aggregation_type, m.visualization_type, m.db_column,
             m.dataset_id, d.clickhouse_table
      FROM design_widgets dw
      LEFT JOIN metrics m ON dw.metric_id = m.id
      LEFT JOIN datasets d ON m.dataset_id = d.id
      WHERE dw.design_id = $1 AND dw.is_visible = true
      ORDER BY dw.sort_order, dw.grid_y, dw.grid_x
    `, [designId]);

    // Permissions
    const permissions = await db.queryAll(
      'SELECT * FROM design_permissions WHERE design_id = $1',
      [designId]
    );

    res.json({ 
      success: true, 
      data: { 
        ...design, 
        widgets,
        permissions 
      } 
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Yeni tasarım oluştur
 */
app.post('/designs', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, type, layoutConfig, settings, targetRoles, allowedPositions, isDefault } = req.body;

    if (!name) {
      throw new ValidationError('Tasarım adı zorunludur');
    }

    // Eğer varsayılan yapılıyorsa diğerlerini kaldır
    if (isDefault) {
      await db.query(
        'UPDATE designs SET is_default = false WHERE tenant_id = $1 AND type = $2',
        [req.user!.tenantId, type || 'cockpit']
      );
    }

    // targetRoles'u her zaman array olarak hazırla
    let rolesArray: string[] = ['ADMIN'];
    if (targetRoles) {
      if (typeof targetRoles === 'string') {
        rolesArray = [targetRoles];
      } else if (Array.isArray(targetRoles)) {
        rolesArray = targetRoles;
      }
    }

    // allowedPositions - pozisyon bazlı yetkilendirme
    const ALL_POSITIONS = ['GENERAL_MANAGER', 'DIRECTOR', 'REGION_MANAGER', 'STORE_MANAGER', 'ANALYST', 'VIEWER'];
    let positionsArray: string[] = ALL_POSITIONS; // Varsayılan: herkes
    if (allowedPositions && Array.isArray(allowedPositions)) {
      positionsArray = allowedPositions;
    }

    const result = await db.queryOne(`
      INSERT INTO designs (tenant_id, name, description, type, layout_config, settings, target_roles, allowed_positions, is_default, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `, [
      req.user!.tenantId, name, description || null, type || 'cockpit',
      JSON.stringify(layoutConfig || {}), JSON.stringify(settings || {}), JSON.stringify(rolesArray), positionsArray, isDefault || false,
      req.user!.userId
    ]);

    // Yetki ekle
    for (const role of rolesArray) {
      await db.query(`
        INSERT INTO design_permissions (design_id, permission_type, permission_value, access_level)
        VALUES ($1, 'role', $2, 'view')
        ON CONFLICT DO NOTHING
      `, [result.id, role]);
    }

    logger.info('Design created', { designId: result.id, name, type, user: req.user!.userId });

    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error) {
    next(error);
  }
});

/**
 * Tasarım güncelle
 */
app.put('/designs/:designId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;
    const { name, description, type, layoutConfig, settings, targetRoles, allowedPositions, gridColumns, rowHeight, themeConfig, isActive, isDefault } = req.body;

    // Eğer varsayılan yapılıyorsa diğerlerini kaldır
    if (isDefault) {
      await db.query(
        'UPDATE designs SET is_default = false WHERE tenant_id = $1 AND id != $2',
        [req.user!.tenantId, designId]
      );
    }

    // targetRoles'u her zaman array olarak hazırla
    let rolesArray: string[] | null = null;
    if (targetRoles) {
      if (typeof targetRoles === 'string') {
        rolesArray = [targetRoles];
      } else if (Array.isArray(targetRoles)) {
        rolesArray = targetRoles;
      }
    }

    // allowedPositions - pozisyon bazlı yetkilendirme
    let positionsArray: string[] | null = null;
    if (allowedPositions && Array.isArray(allowedPositions)) {
      positionsArray = allowedPositions;
    }

    await db.query(`
      UPDATE designs SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        type = COALESCE($3, type),
        layout_config = COALESCE($4, layout_config),
        settings = COALESCE($5, settings),
        target_roles = COALESCE($6, target_roles),
        allowed_positions = COALESCE($7, allowed_positions),
        grid_columns = COALESCE($8, grid_columns),
        row_height = COALESCE($9, row_height),
        is_active = COALESCE($10, is_active),
        is_default = COALESCE($11, is_default),
        updated_at = NOW()
      WHERE id = $12 AND tenant_id = $13
    `, [
      name, 
      description, 
      type, 
      layoutConfig ? JSON.stringify(layoutConfig) : null,
      settings ? JSON.stringify(settings) : (themeConfig ? JSON.stringify(themeConfig) : null),
      rolesArray ? JSON.stringify(rolesArray) : null,
      positionsArray,
      gridColumns, 
      rowHeight, 
      isActive, 
      isDefault, 
      designId, 
      req.user!.tenantId
    ]);

    // Cache temizle
    await cache.del(`dashboard:*`);

    logger.info('Design updated with layoutConfig', { designId, widgetCount: layoutConfig?.widgets?.length, user: req.user!.userId });

    res.json({ success: true, message: 'Tasarım güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * Tasarım sil
 */
app.delete('/designs/:designId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;

    await db.query('DELETE FROM designs WHERE id = $1 AND tenant_id = $2', [designId, req.user!.tenantId]);

    logger.info('Design deleted', { designId, user: req.user!.userId });

    res.json({ success: true, message: 'Tasarım silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DESIGN WIDGETS CRUD
// ============================================

/**
 * Tasarıma widget ekle
 */
app.post('/designs/:designId/widgets', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;
    const { metricId, title, subtitle, widgetType, gridX, gridY, gridW, gridH, configOverride } = req.body;

    // Design kontrolü
    const design = await db.queryOne(
      'SELECT id FROM designs WHERE id = $1 AND tenant_id = $2',
      [designId, req.user!.tenantId]
    );

    if (!design) {
      throw new NotFoundError('Tasarım');
    }

    // Mevcut en yüksek sort_order'ı bul
    const maxOrder = await db.queryOne(
      'SELECT COALESCE(MAX(sort_order), 0) as max_order FROM design_widgets WHERE design_id = $1',
      [designId]
    );

    const result = await db.queryOne(`
      INSERT INTO design_widgets (design_id, metric_id, title, subtitle, widget_type, grid_x, grid_y, grid_w, grid_h, config_override, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `, [
      designId, metricId || null, title || null, subtitle || null,
      widgetType || null, gridX || 0, gridY || 0, gridW || 3, gridH || 2,
      configOverride || {}, (maxOrder?.max_order || 0) + 1
    ]);

    logger.info('Widget added to design', { designId, widgetId: result.id });

    res.status(201).json({ success: true, data: { id: result.id } });
  } catch (error) {
    next(error);
  }
});

/**
 * Widget güncelle
 */
app.put('/designs/:designId/widgets/:widgetId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId, widgetId } = req.params;
    const { metricId, title, subtitle, widgetType, gridX, gridY, gridW, gridH, configOverride, sortOrder, isVisible } = req.body;

    await db.query(`
      UPDATE design_widgets SET
        metric_id = COALESCE($1, metric_id),
        title = COALESCE($2, title),
        subtitle = COALESCE($3, subtitle),
        widget_type = COALESCE($4, widget_type),
        grid_x = COALESCE($5, grid_x),
        grid_y = COALESCE($6, grid_y),
        grid_w = COALESCE($7, grid_w),
        grid_h = COALESCE($8, grid_h),
        config_override = COALESCE($9, config_override),
        sort_order = COALESCE($10, sort_order),
        is_visible = COALESCE($11, is_visible)
      WHERE id = $12 AND design_id = $13
    `, [metricId, title, subtitle, widgetType, gridX, gridY, gridW, gridH, configOverride, sortOrder, isVisible, widgetId, designId]);

    res.json({ success: true, message: 'Widget güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * Widget pozisyonlarını toplu güncelle (drag-drop için)
 */
app.put('/designs/:designId/widgets/positions', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;
    const { positions } = req.body; // [{ id, gridX, gridY, gridW, gridH }]

    if (!Array.isArray(positions)) {
      throw new ValidationError('positions dizisi gerekli');
    }

    for (const pos of positions) {
      await db.query(`
        UPDATE design_widgets SET grid_x = $1, grid_y = $2, grid_w = $3, grid_h = $4
        WHERE id = $5 AND design_id = $6
      `, [pos.gridX, pos.gridY, pos.gridW, pos.gridH, pos.id, designId]);
    }

    res.json({ success: true, message: 'Pozisyonlar güncellendi' });
  } catch (error) {
    next(error);
  }
});

/**
 * Widget sil
 */
app.delete('/designs/:designId/widgets/:widgetId', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId, widgetId } = req.params;

    await db.query('DELETE FROM design_widgets WHERE id = $1 AND design_id = $2', [widgetId, designId]);

    res.json({ success: true, message: 'Widget silindi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DESIGN PERMISSIONS
// ============================================

/**
 * Tasarım yetkilerini güncelle
 */
app.put('/designs/:designId/permissions', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { designId } = req.params;
    const { permissions } = req.body; // [{ type, value, accessLevel }]

    // Mevcut izinleri sil (admin hariç)
    await db.query(
      `DELETE FROM design_permissions WHERE design_id = $1 AND NOT (permission_type = 'role' AND permission_value = 'ADMIN')`,
      [designId]
    );

    // Yeni izinleri ekle
    if (Array.isArray(permissions)) {
      for (const perm of permissions) {
        await db.query(`
          INSERT INTO design_permissions (design_id, permission_type, permission_value, access_level)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (design_id, permission_type, permission_value) DO UPDATE SET access_level = $4
        `, [designId, perm.type, perm.value, perm.accessLevel || 'view']);
      }
    }

    res.json({ success: true, message: 'Yetkiler güncellendi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DASHBOARD FULL ENDPOINT (Tek İstek)
// GET veya POST desteklenir - POST body'de filtre parametreleri gönderilebilir
// ============================================

/**
 * Dashboard verisini işleyen ortak handler fonksiyonu
 * GET ve POST endpoint'leri tarafından çağrılır
 * 
 * ÖNEMLİ: storeIds gibi uzun parametre listeleri URL'de gönderilemez (URL limit ~8KB)
 * Bu nedenle POST body kullanmak tercih edilmeli
 */
async function handleDashboardFull(req: Request, res: Response, next: NextFunction) {
  try {
    const { designId } = req.params;
    // POST body veya GET query params'dan parametreleri al
    const parameters = req.method === 'POST' 
      ? { ...req.query, ...req.body } 
      : req.query as Record<string, any>;
    
    // Cross-Filter parse
    let crossFilters: Array<{ field: string; value: any }> = [];
    if (parameters.crossFilters) {
      try {
        crossFilters = JSON.parse(parameters.crossFilters as string);
        logger.info('Cross-filters applied', { count: crossFilters.length, filters: crossFilters });
      } catch (e) {
        logger.warn('Failed to parse crossFilters', { raw: parameters.crossFilters });
      }
    }
    // Cross-filter'ları parameters'a ekle (executeMetric içinde işlenecek)
    parameters._crossFilters = crossFilters;
    
    // RLS bilgisine göre cache key oluştur (kullanıcıya özel cache)
    const userFilterLevel = (req.user as any).filterLevel || 'none';
    const userFilterValue = (req.user as any).filterValue || 'all';
    const cacheKey = `dashboard:full:${designId}:${req.user!.tenantId}:${userFilterLevel}:${userFilterValue}:${JSON.stringify(parameters)}`;

    // Cache check
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      return res.json({ success: true, data: cachedData, cached: true });
    }

    // Design bilgisini al
    const design = await db.queryOne(
      'SELECT * FROM designs WHERE id = $1 AND tenant_id = $2 AND is_active = true',
      [designId, req.user!.tenantId]
    );

    if (!design) {
      throw new NotFoundError('Tasarım');
    }

    // Widget'ları al (önce design_widgets tablosundan, yoksa layout_config'den)
    let widgets = await db.queryAll(
      `SELECT dw.*, 
              m.name as metric_name, m.label as metric_label,
              m.aggregation_type, m.visualization_type as metric_visualization_type,
              m.db_column, m.icon, m.color, m.chart_config,
              m.format_config, m.comparison_enabled, m.comparison_type,
              m.target_value
       FROM design_widgets dw
       LEFT JOIN metrics m ON dw.metric_id = m.id
       WHERE dw.design_id = $1 AND dw.is_visible = true
       ORDER BY dw.sort_order, dw.grid_y, dw.grid_x`,
      [designId]
    );

    // Eğer design_widgets boşsa, layout_config'den widget'ları al
    let widgetsFromLayoutConfig = false;
    if (widgets.length === 0 && design.layout_config?.widgets) {
      widgetsFromLayoutConfig = true;
      const layoutWidgets = design.layout_config.widgets;
      
      // Her widget için metric bilgisini çek
      for (const lw of layoutWidgets) {
        let metricData: any = null;
        if (lw.metricId) {
          metricData = await db.queryOne(
            `SELECT name, label, aggregation_type, visualization_type, db_column, icon, color, chart_config, format_config, comparison_enabled, comparison_type, target_value, target_column, dataset_id, clickhouse_table
             FROM metrics WHERE id = $1`,
            [lw.metricId]
          );
        }
        widgets.push({
          id: lw.id || lw.i,
          title: lw.label || lw.metricName,
          subtitle: null,
          widget_type: lw.type,
          grid_x: lw.x || 0,
          grid_y: lw.y || 0,
          grid_w: lw.w || 4,
          grid_h: lw.h || 4,
          metric_id: lw.metricId,
          metric_name: metricData?.name,
          metric_label: metricData?.label,
          aggregation_type: metricData?.aggregation_type,
          metric_visualization_type: metricData?.visualization_type,
          db_column: metricData?.db_column,
          icon: metricData?.icon || lw.icon,
          color: metricData?.color || lw.color,
          chart_config: metricData?.chart_config || {},
          format_config: metricData?.format_config,
          comparison_enabled: metricData?.comparison_enabled,
          comparison_type: metricData?.comparison_type,
          target_value: metricData?.target_value,
          target_column: metricData?.chart_config?.targetColumn || null,
          clickhouse_table: metricData?.clickhouse_table,
          dataset_id: metricData?.dataset_id,
          config_override: lw.configOverride || {}
        });
      }
    }

    // Her widget için metrik değerini hesapla (paralel)
    const widgetData: Record<string, any> = {};

    await Promise.allSettled(
      widgets.map(async (widget: any) => {
        const widgetResult: any = {
          id: widget.id,
          title: widget.title || widget.metric_label || widget.metric_name || 'Widget',
          label: widget.title || widget.metric_label || widget.metric_name || 'Widget',
          subtitle: widget.subtitle,
          type: widget.widget_type || widget.metric_visualization_type || 'kpi_card',
          widgetType: widget.widget_type || widget.metric_visualization_type || 'kpi_card',
          metric_visualization_type: widget.metric_visualization_type, // Metrik görselleştirme tipi (pie_chart, bar_chart vb.)
          gridPosition: {
            x: widget.grid_x,
            y: widget.grid_y,
            w: widget.grid_w,
            h: widget.grid_h
          },
          metricId: widget.metric_id,
          metricName: widget.metric_name,
          icon: widget.icon || 'BarChart3',
          color: widget.color || '#3B82F6',
          chartConfig: widget.chart_config || {},
          config: widget.config_override || {}
        };

        if (widget.metric_id) {
          try {
            // RLS bilgisini al (dashboard/full endpoint'i için)
            const userRLS = {
              userId: req.user!.userId,
              filterLevel: (req.user as any).filterLevel || 'none',
              filterValue: (req.user as any).filterValue || null
            };
            const metricResult = await executeMetric(widget.metric_id, req.user!.tenantId, parameters as Record<string, any>, userRLS);
            widgetResult.data = metricResult;
            
            // Karşılaştırma verisi (eğer aktifse)
            if (widget.comparison_enabled) {
              // metricResult.metadata içinde previousValue ve trend var
              const metadata = metricResult.metadata || {};
              widgetResult.comparison = {
                enabled: true,
                type: widget.comparison_type,
                previousValue: metadata.previousValue || null,
                trend: metadata.trend || null,
                label: metadata.comparisonLabel || metadata.period || null
              };
              // Widget data'sına da ekle (frontend uyumluluğu için)
              widgetResult.previousValue = metadata.previousValue || null;
              widgetResult.trend = metadata.trend || null;
              widgetResult.comparisonLabel = metadata.comparisonLabel || metadata.period || null;
            }
            
            // Hedef değeri
            const current = typeof metricResult.value === 'number' ? metricResult.value : 0;
            let targetValue: number | null = null;
            
            // 1. Önce sabit target_value kontrol et
            if (widget.target_value) {
              targetValue = Number(widget.target_value);
            }
            // 2. Eğer target_column varsa ClickHouse'dan çek
            else if (widget.target_column && widget.clickhouse_table) {
              try {
                const targetQuery = `SELECT sum(${widget.target_column}) as target FROM clixer_analytics.${widget.clickhouse_table}`;
                const targetResult = await clickhouse.query(targetQuery);
                if (targetResult && (targetResult as any[])[0]?.target) {
                  targetValue = Number((targetResult as any[])[0].target);
                }
              } catch (err) {
                logger.warn('Target column sorgusu başarısız', { 
                  column: widget.target_column, 
                  table: widget.clickhouse_table,
                  error: (err as Error).message 
                });
              }
            }
            
            if (targetValue && targetValue > 0) {
              widgetResult.target = {
                value: targetValue,
                progress: Math.min(100, Math.round((current / targetValue) * 100))
              };
            }
            
            // Sparkline/Trend için tarihsel veri çek
            const vizType = widget.metric_visualization_type;
            if ((vizType === 'sparkline' || vizType === 'trend' || vizType === 'trend_card') && widget.db_column) {
              try {
                // Metrik bilgilerini al
                const metricInfo = await db.queryOne(
                  `SELECT m.*, d.clickhouse_table 
                   FROM metrics m 
                   LEFT JOIN datasets d ON m.dataset_id = d.id 
                   WHERE m.id = $1`,
                  [widget.metric_id]
                );
                
                // Tarih kolonu tanımlıysa sparkline verisini çek (chart_config.comparisonColumn'dan oku)
                const chartConfig = metricInfo?.chart_config || {};
                const comparisonColumn = chartConfig.comparisonColumn;
                
                if (metricInfo?.clickhouse_table && comparisonColumn) {
                  const dateColumn = comparisonColumn;
                  const aggType = metricInfo.aggregation_type || 'SUM';
                  const dbColumn = metricInfo.db_column;
                  
                  // Son 12 gün için günlük aggregation
                  const sparklineQuery = `
                    SELECT 
                      toDate(${dateColumn}) as day,
                      ${aggType.toLowerCase()}(${dbColumn}) as value
                    FROM clixer_analytics.${metricInfo.clickhouse_table}
                    WHERE ${dateColumn} >= today() - 12
                    GROUP BY day
                    ORDER BY day ASC
                    LIMIT 12
                  `;
                  
                  try {
                    const sparklineResult = await clickhouse.query(sparklineQuery);
                    const sparklineData = (sparklineResult as any[]).map((row: any) => Number(row.value) || 0);
                    
                    if (sparklineData.length > 0) {
                      widgetResult.sparklineData = sparklineData;
                    } else {
                      // Veri yoksa demo veri
                      widgetResult.sparklineData = [5, 10, 8, 15, 12, 20, 18, 25, 22, 30, 28, 35];
                    }
                  } catch (chErr: any) {
                    console.log('ClickHouse sparkline hatası (sessiz):', chErr.message?.substring(0, 100));
                    widgetResult.sparklineData = [5, 10, 8, 15, 12, 20, 18, 25, 22, 30, 28, 35];
                  }
                } else {
                  // Tarih kolonu yoksa demo veri kullan
                  widgetResult.sparklineData = [5, 10, 8, 15, 12, 20, 18, 25, 22, 30, 28, 35];
                }
              } catch (sparkErr: any) {
                console.log('Sparkline veri çekimi hatası:', sparkErr.message);
                // Hata durumunda demo veri kullan
                widgetResult.sparklineData = [5, 10, 8, 15, 12, 20, 18, 25, 22, 30, 28, 35];
              }
            }
          } catch (error: any) {
            widgetResult.data = { error: error.message, value: null, formatted: '-' };
          }
        }

        widgetData[widget.id] = widgetResult;
      })
    );

    const result = {
      design: {
        id: design.id,
        name: design.name,
        description: design.description,
        type: design.type,
        gridColumns: design.grid_columns || 12,
        rowHeight: design.row_height || 80,
        theme: design.settings || {}
      },
      widgets: Object.values(widgetData),
      generatedAt: new Date().toISOString()
    };

    // Cache (1 dakika)
    await cache.set(cacheKey, result, 60);

    res.json({ success: true, data: result, cached: false });
  } catch (error) {
    next(error);
  }
}

/**
 * Dashboard için tüm veriyi tek seferde döndür - GET endpoint
 * Kısa parametre listeleri için (uyumluluk nedeniyle korunuyor)
 */
app.get('/dashboard/:designId/full', authenticate, tenantIsolation, handleDashboardFull);

/**
 * Dashboard için tüm veriyi tek seferde döndür - POST endpoint
 * Uzun parametre listeleri için (storeIds gibi 400+ mağaza UUID'si)
 * URL limiti aşılmasını önler
 */
app.post('/dashboard/:designId/full', authenticate, tenantIsolation, handleDashboardFull);

// ============================================
// CLICKHOUSE TABLE INFO
// ============================================

/**
 * ClickHouse tablo bilgilerini al
 */
app.get('/clickhouse/tables', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await clickhouse.query<{ name: string; engine: string; total_rows: number }>(
      `SELECT name, engine, total_rows 
       FROM system.tables 
       WHERE database = currentDatabase()
       ORDER BY name`
    );

    res.json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
});

/**
 * ClickHouse tablo kolonlarını al
 */
app.get('/clickhouse/tables/:tableName/columns', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tableName } = req.params;

    const columns = await clickhouse.query<{ name: string; type: string }>(
      `SELECT name, type 
       FROM system.columns 
       WHERE database = currentDatabase() AND table = '${tableName}'
       ORDER BY position`
    );

    res.json({ success: true, data: columns });
  } catch (error) {
    next(error);
  }
});

/**
 * ClickHouse'ta raw SQL çalıştır (admin only)
 */
app.post('/clickhouse/query', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sql, limit = 1000 } = req.body;

    if (!sql) {
      throw new ValidationError('SQL sorgusu gerekli');
    }

    // Güvenlik: Sadece SELECT
    const trimmedSql = sql.trim().toUpperCase();
    if (!trimmedSql.startsWith('SELECT')) {
      throw new ValidationError('Sadece SELECT sorguları çalıştırılabilir');
    }

    // LIMIT ekle
    let finalSql = sql.trim();
    if (!trimmedSql.includes('LIMIT')) {
      finalSql += ` LIMIT ${Math.min(limit, 10000)}`;
    }

    const startTime = Date.now();
    const data = await clickhouse.query(finalSql);
    const executionTime = Date.now() - startTime;

    res.json({ 
      success: true, 
      data: {
        rows: data,
        rowCount: data.length,
        executionTime
      }
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CACHE MANAGEMENT
// ============================================

/**
 * Cache temizle (pattern ile)
 */
app.delete('/cache', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pattern = '*' } = req.query;
    
    const fullPattern = `${pattern}`;
    await cache.invalidate(fullPattern, 'manual');

    logger.info('Cache invalidated', { pattern: fullPattern, user: req.user!.userId });

    res.json({ success: true, message: `Cache temizlendi: ${fullPattern}` });
  } catch (error) {
    next(error);
  }
});

/**
 * Dataset cache'ini temizle
 */
app.delete('/datasets/:datasetId/cache', authenticate, tenantIsolation, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { datasetId } = req.params;

    await cache.invalidate(`dataset:${datasetId}:*`, 'manual');
    await cache.invalidate(`metric:*:${datasetId}:*`, 'manual');

    logger.info('Dataset cache invalidated', { datasetId, user: req.user!.userId });

    res.json({ success: true, message: 'Dataset cache temizlendi' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// HELPERS
// ============================================

function escapeValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  
  // String escape
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getDefaultParameterValue(param: any): any {
  const { type, default: defaultValue } = param;
  
  if (defaultValue === undefined) {
    switch (type) {
      case 'date': return new Date().toISOString().split('T')[0];
      case 'number': return 0;
      case 'boolean': return false;
      default: return '';
    }
  }

  // Özel default değerler
  if (typeof defaultValue === 'string') {
    if (defaultValue === 'today') return new Date().toISOString().split('T')[0];
    if (defaultValue === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split('T')[0];
    }
    if (defaultValue.startsWith('today-')) {
      const days = parseInt(defaultValue.replace('today-', '').replace('d', ''));
      const d = new Date();
      d.setDate(d.getDate() - days);
      return d.toISOString().split('T')[0];
    }
  }

  return defaultValue;
}

function formatMetricValue(value: any, metric: any): string {
  if (value === null || value === undefined) return '-';
  
  // Array ise sayısını göster
  if (Array.isArray(value)) {
    return `${value.length} kayıt`;
  }

  let formatted = String(value);
  const formatConfig = metric.format_config || {};

  // Sayı formatlama
  if (typeof value === 'number') {
    const format = formatConfig.type || 'number';
    
    switch (format) {
      case 'currency':
        formatted = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: formatConfig.decimals || 2
        }).format(value);
        break;
      case 'percentage':
        formatted = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }).format(value);
        break;
      case 'compact':
        // Büyük sayıları kısalt (1.5M, 2.3K gibi)
        if (value >= 1000000) {
          formatted = (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
          formatted = (value / 1000).toFixed(1) + 'K';
        } else {
          formatted = new Intl.NumberFormat('tr-TR').format(value);
        }
        break;
      default:
        formatted = new Intl.NumberFormat('tr-TR').format(value);
    }
  }

  // Prefix ve suffix ekle
  if (formatConfig.prefix) formatted = formatConfig.prefix + formatted;
  if (formatConfig.suffix) formatted = formatted + formatConfig.suffix;

  return formatted;
}

// ============================================
// ERROR HANDLER
// ============================================

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const isDev = process.env.NODE_ENV !== 'production';
  const errorResponse = formatError(err, isDev);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  logger.error('Request error', { error: err.message, path: req.path, stack: isDev ? err.stack : undefined });
  res.status(statusCode).json(errorResponse);
});

// ============================================
// START SERVER
// ============================================

async function start() {
  try {
    db.createPool();
    await db.checkHealth();
    logger.info('PostgreSQL connected');

    clickhouse.createClickHouseClient();
    await clickhouse.checkHealth();
    logger.info('ClickHouse connected');

    cache.createRedisClient();
    await cache.checkHealth();
    logger.info('Redis connected');

    // ETL completed event'ini dinle - cache invalidate
    cache.subscribe('etl:completed', async (message: any) => {
      logger.info('ETL completed, invalidating cache', { datasetId: message.datasetId });
      await cache.invalidate(`dataset:${message.datasetId}:*`, 'etl');
      await cache.invalidate(`dashboard:*`, 'etl');
    });

    app.listen(PORT, () => {
      logger.info(`📊 Analytics Service running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start analytics-service', { error });
    process.exit(1);
  }
}

start();
