/**
 * Date Converter Helper
 * Converts various date formats to ClickHouse DateTime format
 */

import { createLogger } from '@clixer/shared';

const logger = createLogger({ service: 'etl-worker' });

// ============================================
// AKILLI TARİH DÖNÜŞTÜRÜCÜ
// Farklı kaynaklardan gelen formatları ClickHouse'a uygun hale getirir
// ============================================
export function toClickHouseDateTime(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  
  // Date objesi
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
  }
  
  // String değer
  if (typeof val === 'string') {
    const str = val.trim();
    
    // 1. ISO 8601: 2025-12-13T20:33:42.722Z veya 2025-12-13T20:33:42
    if (str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
      return str.replace('T', ' ').replace('Z', '').split('.')[0];
    }
    
    // 2. ClickHouse formatı zaten: 2025-12-13 20:33:42
    if (str.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
      return str.split('.')[0]; // Milisaniye varsa at
    }
    
    // 3. Sadece tarih: 2025-12-13
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return str + ' 00:00:00';
    }
    
    // 4. Avrupa formatı: DD-MM-YYYY veya DD/MM/YYYY (gün > 12 ise kesin bu)
    const euMatch = str.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
    if (euMatch) {
      const day = parseInt(euMatch[1]);
      const month = parseInt(euMatch[2]);
      const year = euMatch[3];
      const time = euMatch[4] || '00:00:00';
      
      // Gün 12'den büyükse kesinlikle DD-MM-YYYY
      if (day > 12 && month <= 12) {
        return `${year}-${euMatch[2]}-${euMatch[1]} ${time}`;
      }
      // Ay 12'den büyükse kesinlikle MM-DD-YYYY (ABD)
      if (month > 12 && day <= 12) {
        return `${year}-${euMatch[1]}-${euMatch[2]} ${time}`;
      }
      // İkisi de <=12 ise varsayılan olarak DD-MM-YYYY kabul et (Türkiye için)
      return `${year}-${euMatch[2]}-${euMatch[1]} ${time}`;
    }
    
    // 5. ABD formatı açık: MM/DD/YYYY
    const usMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}:\d{2}:\d{2}))?/);
    if (usMatch) {
      const month = usMatch[1].padStart(2, '0');
      const day = usMatch[2].padStart(2, '0');
      const year = usMatch[3];
      const time = usMatch[4] || '00:00:00';
      return `${year}-${month}-${day} ${time}`;
    }
    
    // 6. PostgreSQL timestamp without time zone: 2025-12-13 20:33:42.123456
    if (str.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+/)) {
      return str.split('.')[0];
    }
    
    // 7. Son çare: Date.parse dene
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }
    
    // Tanınamadı - null dön, log at
    logger.warn('Unknown date format, returning NULL', { value: val });
    return null;
  }
  
  // Number (timestamp)
  if (typeof val === 'number') {
    const date = new Date(val);
    if (!isNaN(date.getTime())) {
      return date.toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }
  }
  
  return null;
}

// ============================================
// KAPSAMLI TARİH FORMAT DÖNÜŞTÜRÜCÜ
// Tüm SQL tarih formatlarını ClickHouse DateTime'a çevirir
// ============================================

/**
 * TÜM SQL TARİH FORMATLARINI ClickHouse DateTime'a çevirir
 * 
 * Desteklenen formatlar:
 * - ISO 8601: 2025-12-23T16:00:00.000Z, 2025-12-23T16:00:00Z
 * - ISO with offset: 2025-12-23T16:00:00+03:00
 * - SQL Server: 2025-12-23 16:00:00.0000000
 * - MySQL: 2025-12-23 16:00:00
 * - PostgreSQL: 2025-12-23 16:00:00.123456
 * - Date only: 2025-12-23
 * - European: 23/12/2025, 23.12.2025
 * - US: 12/23/2025
 * - JavaScript Date object
 * - Unix timestamp (number)
 * 
 * ClickHouse çıktı formatı: 'YYYY-MM-DD HH:mm:ss'
 */
export function convertToClickHouseDateTime(value: any): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  
  // 1. JavaScript Date objesi
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  
  // 2. Unix timestamp (number - milliseconds)
  if (typeof value === 'number') {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    }
    return null;
  }
  
  // 3. String formatları
  if (typeof value === 'string') {
    const val = value.trim();
    
    // A. ISO 8601 with T and optional timezone: 2025-12-23T16:00:00.000Z
    let match = val.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
    }
    
    // B. SQL Server format: 2025-12-23 16:00:00.0000000
    match = val.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
    }
    
    // C. MySQL/PostgreSQL: 2025-12-23 16:00:00
    match = val.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/);
    if (match) {
      return val; // Zaten doğru format
    }
    
    // D. Date only: 2025-12-23
    match = val.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      return `${val} 00:00:00`;
    }
    
    // E. European format: 23/12/2025 veya 23.12.2025
    match = val.match(/^(\d{2})[\/\.](\d{2})[\/\.](\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (match) {
      const time = match[4] ? ` ${match[4]}:${match[5]}:${match[6]}` : ' 00:00:00';
      return `${match[3]}-${match[2]}-${match[1]}${time}`;
    }
    
    // F. US format: 12/23/2025 (MM/DD/YYYY)
    match = val.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
    if (match) {
      const time = match[4] ? ` ${match[4]}:${match[5]}:${match[6]}` : ' 00:00:00';
      return `${match[3]}-${match[1]}-${match[2]}${time}`;
    }
    
    // G. YYYYMMDD format: 20251223
    match = val.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]} 00:00:00`;
    }
    
    // H. SQL Server short: Dec 23 2025 4:00PM
    match = val.match(/^([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})([AP]M)?$/i);
    if (match) {
      const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
      const mon = months[match[1].toLowerCase()] || '01';
      let hour = parseInt(match[4]);
      if (match[6]?.toUpperCase() === 'PM' && hour < 12) hour += 12;
      if (match[6]?.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${match[3]}-${mon}-${match[2].padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${match[5]}:00`;
    }
    
    // Tanınamadı - null dön
    logger.warn('Unknown date format, returning null', { value: val });
    return null;
  }
  
  return null;
}

/**
 * Bir değerin tarih olup olmadığını kontrol et
 */
export function isDateLikeValue(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return true;
  if (typeof value !== 'string') return false;
  
  const val = value.trim();
  
  // ISO format check
  if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(val)) return true;
  // Date only
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return true;
  // European/US format
  if (/^\d{2}[\/\.]\d{2}[\/\.]\d{4}/.test(val)) return true;
  
  return false;
}
