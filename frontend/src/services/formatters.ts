/**
 * Clixer - Formatter Utilities
 * Tarih, süre ve metin formatlama yardımcıları
 */

import toast from 'react-hot-toast'

/**
 * Panoya metin kopyalar ve toast gösterir
 */
export function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text)
  toast.success('Panoya kopyalandı!')
}

/**
 * Hata mesajlarını Türkçe'ye çevirir
 */
export function translateErrorMessage(message: string): string {
  if (!message) return ''
  
  const translations: Record<string, string> = {
    // ClickHouse hataları
    'Table .* does not exist': 'Clixer tablosu bulunamadı. Tabloyu oluşturmak için "Şimdi Sync Et" butonuna tıklayın.',
    'does not exist': 'Clixer tablosu mevcut değil. Sync işlemi başlatıldığında otomatik oluşturulacak.',
    'Connection refused': 'Clixer DB bağlantısı reddedildi. Servis çalışıyor mu kontrol edin.',
    'Authentication failed': 'Kimlik doğrulama başarısız. Kullanıcı adı veya şifre hatalı.',
    'timeout': 'Bağlantı zaman aşımına uğradı. Sunucu erişilebilir mi kontrol edin.',
    'ECONNREFUSED': 'Bağlantı reddedildi. Hedef sunucu çalışmıyor olabilir.',
    'ENOTFOUND': 'Sunucu bulunamadı. Host adresini kontrol edin.',
    'ETIMEDOUT': 'Bağlantı zaman aşımı. Ağ bağlantınızı kontrol edin.',
    // PostgreSQL hataları
    'relation .* does not exist': 'Tablo veya view bulunamadı. Kaynak sorguyu kontrol edin.',
    'permission denied': 'Yetki hatası. Veritabanı kullanıcısının gerekli izinleri var mı kontrol edin.',
    'syntax error': 'SQL söz dizimi hatası. Sorguyu kontrol edin.',
    // Genel hatalar
    'Network Error': 'Ağ hatası. İnternet bağlantınızı kontrol edin.',
    'Internal Server Error': 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
  }
  
  for (const [pattern, translation] of Object.entries(translations)) {
    if (new RegExp(pattern, 'i').test(message)) {
      return translation
    }
  }
  
  // Türkçe değilse orijinal mesajı döndür ama bazı temel çeviriler yap
  return message
    .replace('Table', 'Tablo')
    .replace('does not exist', 'bulunamadı')
    .replace('Connection', 'Bağlantı')
    .replace('failed', 'başarısız')
    .replace('error', 'hata')
    .replace('timeout', 'zaman aşımı')
}

/**
 * Tarihi "X dk önce" formatına çevirir
 */
export function formatTimeAgo(dateStr: string, showTime = false): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  const timeStr = date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  
  if (diffMins < 1) return showTime ? `Az önce (${timeStr})` : 'Az önce'
  if (diffMins < 60) return showTime ? `${diffMins} dk önce (${timeStr})` : `${diffMins} dk önce`
  if (diffHours < 24) return showTime ? `${diffHours} saat önce (${timeStr})` : `${diffHours} saat önce`
  
  const dateFormatted = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  return showTime ? `${dateFormatted} ${timeStr}` : `${diffDays} gün önce`
}

/**
 * Saniyeyi okunabilir süreye çevirir: 306s → "5dk 6sn"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}sn`
  }
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins < 60) {
    return secs > 0 ? `${mins}dk ${secs}sn` : `${mins}dk`
  }
  const hours = Math.floor(mins / 60)
  const remainingMins = mins % 60
  return remainingMins > 0 ? `${hours}sa ${remainingMins}dk` : `${hours}sa`
}
