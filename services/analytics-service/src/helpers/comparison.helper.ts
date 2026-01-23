/**
 * Comparison Helper Functions
 * YoY, MoM, WoW, YTD, LFL calculations
 */

import { clickhouse, createLogger } from '@clixer/shared';
import { ComparisonType, LFLCalendarConfig, LFLResult } from '../types';
import { formatDateString } from './format.helper';

const logger = createLogger({ service: 'analytics-service' });

/**
 * Get default label for comparison type
 */
export function getDefaultComparisonLabel(compType: ComparisonType | string): string {
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
 * Calculate previous period dates based on comparison type
 */
export function calculatePreviousPeriodDates(compType: ComparisonType | string): { 
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
      // Same day last year
      prevStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      currentDays = 1;
      break;
    }
    
    case 'mom': {
      // Same day last month
      prevStart = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      prevEnd = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
      currentDays = 1;
      break;
    }
    
    case 'wow': {
      // Same day last week
      prevStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      prevEnd = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      currentDays = 1;
      break;
    }
    
    case 'ytd': {
      // Year-to-Date
      const yearStart = new Date(today.getFullYear(), 0, 1);
      currentDays = Math.floor((today.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      prevStart = new Date(today.getFullYear() - 1, 0, 1);
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      break;
    }
    
    case 'lfl': {
      // Like-for-Like (same as YTD for date range)
      const yearStart = new Date(today.getFullYear(), 0, 1);
      currentDays = Math.floor((today.getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
      
      prevStart = new Date(today.getFullYear() - 1, 0, 1);
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      break;
    }
    
    default: {
      // Default: same day last year
      prevStart = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      prevEnd = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
      currentDays = 1;
    }
  }
  
  return {
    prevStartDate: formatDateString(prevStart),
    prevEndDate: formatDateString(prevEnd),
    currentDays
  };
}

/**
 * Calculate LFL (Like-for-Like) comparison
 * Store-based comparison for accurate YoY matching
 */
export async function calculateLFL(
  tableName: string,
  dateColumn: string,
  valueColumn: string,
  aggFunc: string,
  rlsCondition: string,
  filterCondition: string,
  startDate?: string,
  endDate?: string,
  lflCalendarConfig?: LFLCalendarConfig,
  storeColumn?: string,
  storeFilterCondition?: string
): Promise<LFLResult | null> {
  
  // Determine date range
  let thisYearStart: string;
  let thisYearEnd: string;
  
  if (startDate && endDate) {
    thisYearStart = startDate;
    thisYearEnd = endDate;
  } else {
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
  
  // LFL Calendar + Store-based calculation
  if (lflCalendarConfig?.clickhouseTable) {
    const lflTable = `clixer_analytics.${lflCalendarConfig.clickhouseTable}`;
    const thisYearCol = lflCalendarConfig.thisYearColumn || 'this_year';
    const lastYearCol = lflCalendarConfig.lastYearColumn || 'last_year';
    const storeCol = storeColumn || null;
    const storeFilter = storeFilterCondition || '';
    
    let lflSql: string;
    
    if (storeCol) {
      // Store-based LFL
      const lastYearStartDate = new Date(thisYearStart);
      lastYearStartDate.setFullYear(lastYearStartDate.getFullYear() - 1);
      const lastYearEndDate = new Date(thisYearEnd);
      lastYearEndDate.setFullYear(lastYearEndDate.getFullYear() - 1);
      lastYearStartDate.setDate(lastYearStartDate.getDate() - 10);
      lastYearEndDate.setDate(lastYearEndDate.getDate() + 10);
      const lyStart = lastYearStartDate.toISOString().split('T')[0];
      const lyEnd = lastYearEndDate.toISOString().split('T')[0];
      
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
            SELECT ${storeCol} as store_id, toDate(${dateColumn}) as sale_date, ${aggFunc} as agg_value
            FROM ${tableName}
            WHERE toDate(${dateColumn}) >= '${thisYearStart}' AND toDate(${dateColumn}) <= '${thisYearEnd}'
              ${rlsCondition} ${filterCondition} ${storeFilter}
            GROUP BY ${storeCol}, toDate(${dateColumn})
          ) ty
          INNER JOIN (
            SELECT toDate(${thisYearCol}) as ty_date, toDate(${lastYearCol}) as ly_date
            FROM ${lflTable}
            WHERE toDate(${thisYearCol}) >= '${thisYearStart}' AND toDate(${thisYearCol}) <= '${thisYearEnd}'
          ) lfl ON ty.sale_date = lfl.ty_date
          INNER JOIN (
            SELECT ${storeCol} as store_id, toDate(${dateColumn}) as sale_date, ${aggFunc} as agg_value
            FROM ${tableName}
            WHERE toDate(${dateColumn}) >= '${lyStart}' AND toDate(${dateColumn}) <= '${lyEnd}'
              ${rlsCondition} ${filterCondition} ${storeFilter}
            GROUP BY ${storeCol}, toDate(${dateColumn})
          ) ly ON ty.store_id = ly.store_id AND lfl.ly_date = ly.sale_date
        )
      `;
    } else {
      // General LFL without store column
      lflSql = `
        WITH lfl_dates AS (
          SELECT 
            toDate(${thisYearCol}) as this_year_date,
            toDate(${lastYearCol}) as last_year_date
          FROM ${lflTable}
          WHERE toDate(${thisYearCol}) >= '${thisYearStart}' 
            AND toDate(${thisYearCol}) <= '${thisYearEnd}'
        ),
        this_year_days AS (
          SELECT DISTINCT toDate(${dateColumn}) as sale_date
          FROM ${tableName}
          WHERE toDate(${dateColumn}) IN (SELECT this_year_date FROM lfl_dates)
            ${rlsCondition} ${filterCondition} ${storeFilter}
        ),
        last_year_days AS (
          SELECT DISTINCT toDate(${dateColumn}) as sale_date
          FROM ${tableName}
          WHERE toDate(${dateColumn}) IN (SELECT last_year_date FROM lfl_dates)
            ${rlsCondition} ${filterCondition} ${storeFilter}
        ),
        common_lfl_days AS (
          SELECT lfl.this_year_date, lfl.last_year_date
          FROM lfl_dates lfl
          WHERE lfl.this_year_date IN (SELECT sale_date FROM this_year_days)
            AND lfl.last_year_date IN (SELECT sale_date FROM last_year_days)
        )
        SELECT 
          (SELECT ${aggFunc} FROM ${tableName} s WHERE toDate(s.${dateColumn}) IN (SELECT this_year_date FROM common_lfl_days) ${rlsCondition} ${filterCondition} ${storeFilter}) as current_value,
          (SELECT ${aggFunc} FROM ${tableName} s WHERE toDate(s.${dateColumn}) IN (SELECT last_year_date FROM common_lfl_days) ${rlsCondition} ${filterCondition} ${storeFilter}) as previous_value,
          (SELECT count() FROM common_lfl_days) as common_days_count
      `;
    }
    
    try {
      const result = await clickhouse.query<{
        current_value: number;
        previous_value: number;
        common_days_count: number;
        unique_stores?: number;
      }>(lflSql);
      
      if (result.length === 0 || result[0].common_days_count === 0) {
        logger.warn('LFL calendar returned no matching days', { thisYearStart, thisYearEnd });
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
      
      return {
        currentValue: currentVal,
        previousValue: previousVal,
        trend,
        commonDays: Number(common_days_count),
        uniqueStores: storeCol ? (Number(unique_stores) || 0) : undefined,
        isStoreBased: !!storeCol
      };
    } catch (error) {
      logger.error('LFL calendar query failed', { error });
    }
  }
  
  // Fallback: Simple dayOfYear comparison
  const startDateObj = new Date(thisYearStart);
  const endDateObj = new Date(thisYearEnd);
  const lastYearStart = `${startDateObj.getFullYear() - 1}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}-${String(startDateObj.getDate()).padStart(2, '0')}`;
  const lastYearEnd = `${endDateObj.getFullYear() - 1}-${String(endDateObj.getMonth() + 1).padStart(2, '0')}-${String(endDateObj.getDate()).padStart(2, '0')}`;
  const fallbackStoreFilter = storeFilterCondition || '';
  
  const lflSql = `
    WITH 
    this_year_days AS (
      SELECT DISTINCT toDayOfYear(toDate(${dateColumn})) as day_of_year
      FROM ${tableName}
      WHERE toDate(${dateColumn}) >= '${thisYearStart}' AND toDate(${dateColumn}) <= '${thisYearEnd}'
        ${rlsCondition} ${filterCondition} ${fallbackStoreFilter}
    ),
    last_year_days AS (
      SELECT DISTINCT toDayOfYear(toDate(${dateColumn})) as day_of_year
      FROM ${tableName}
      WHERE toDate(${dateColumn}) >= '${lastYearStart}' AND toDate(${dateColumn}) <= '${lastYearEnd}'
        ${rlsCondition} ${filterCondition} ${fallbackStoreFilter}
    ),
    common_days AS (
      SELECT t.day_of_year FROM this_year_days t
      INNER JOIN last_year_days l ON t.day_of_year = l.day_of_year
    )
    SELECT 
      (SELECT ${aggFunc} FROM ${tableName} WHERE toDayOfYear(toDate(${dateColumn})) IN (SELECT day_of_year FROM common_days) AND toDate(${dateColumn}) >= '${thisYearStart}' AND toDate(${dateColumn}) <= '${thisYearEnd}' ${rlsCondition} ${filterCondition} ${fallbackStoreFilter}) as current_value,
      (SELECT ${aggFunc} FROM ${tableName} WHERE toDayOfYear(toDate(${dateColumn})) IN (SELECT day_of_year FROM common_days) AND toDate(${dateColumn}) >= '${lastYearStart}' AND toDate(${dateColumn}) <= '${lastYearEnd}' ${rlsCondition} ${filterCondition} ${fallbackStoreFilter}) as previous_value,
      (SELECT count() FROM common_days) as common_days_count
  `;
  
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
    isStoreBased: false
  };
}
