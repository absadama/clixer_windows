/**
 * Format Helper Functions
 * Value formatting, escaping, date formatting
 */

import { FormatConfig } from '../types';

/**
 * Escape value for ClickHouse SQL
 */
export function escapeValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (value instanceof Date) return `'${value.toISOString()}'`;
  
  // String escape
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Format date to YYYY-MM-DD string
 */
export function formatDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get default parameter value based on type
 */
export function getDefaultParameterValue(param: any): any {
  const { type, default: defaultValue } = param;
  
  if (defaultValue === undefined) {
    switch (type) {
      case 'date': return new Date().toISOString().split('T')[0];
      case 'number': return 0;
      case 'boolean': return false;
      default: return '';
    }
  }

  // Special default values
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

/**
 * Format metric value for display
 */
export function formatMetricValue(value: any, formatConfig?: FormatConfig): string {
  if (value === null || value === undefined) return '-';
  
  // Array - show count
  if (Array.isArray(value)) {
    return `${value.length} kayıt`;
  }

  let formatted = String(value);
  const config = formatConfig || {};

  // Number formatting
  if (typeof value === 'number') {
    const format = config.type || 'number';
    
    switch (format) {
      case 'currency':
        formatted = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: config.decimals || 2
        }).format(value);
        break;
      case 'percentage':
        formatted = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }).format(value);
        break;
      case 'compact':
        // Abbreviate large numbers (1.5M, 2.3K etc)
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

  // Add prefix and suffix
  if (config.prefix) formatted = config.prefix + formatted;
  if (config.suffix) formatted = formatted + config.suffix;

  return formatted;
}
