/**
 * Column Detection Helpers
 * Auto-detect column types based on naming patterns
 */

/**
 * Tarih/DateTime kolonlarını otomatik algıla (kolon adına göre)
 */
export function isDateTimeColumn(columnName: string): boolean {
  const datePatterns = [
    'date', 'tarih', 'time', 'timestamp', 'created', 'updated', 'modified',
    '_at', '_on', '_date', '_time', 'datetime'
  ];
  const lowerName = columnName.toLowerCase();
  return datePatterns.some(pattern => lowerName.includes(pattern));
}

/**
 * Sayısal kolonları otomatik algıla (kolon adına göre)
 */
export function isNumericColumn(columnName: string): boolean {
  const numericPatterns = [
    'amount', 'tutar', 'price', 'fiyat', 'total', 'toplam', 'count', 'adet',
    'quantity', 'miktar', 'sum', 'avg', 'min', 'max', '_id', 'id$',
    'indirim', 'discount', 'brut', 'net', 'gross'
  ];
  const lowerName = columnName.toLowerCase();
  return numericPatterns.some(pattern => lowerName.includes(pattern));
}
