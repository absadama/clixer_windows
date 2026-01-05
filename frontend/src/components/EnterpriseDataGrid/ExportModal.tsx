// Export Modal - Satır sayısı seçimi ve progress
import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import { X, Download, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  onExport: (rowLimit: number) => Promise<void>
  totalRows: number
  theme: any
  gridId: string
}

const ROW_OPTIONS = [
  { value: 10000, label: '10.000 satır' },
  { value: 50000, label: '50.000 satır' },
  { value: 100000, label: '100.000 satır' },
  { value: 500000, label: '500.000 satır' },
  { value: 1000000, label: '1.000.000 satır' },
  { value: 2000000, label: '2.000.000 satır' },
  { value: 5000000, label: '5.000.000 satır' },
  { value: 10000000, label: '10.000.000 satır' },
  { value: -1, label: 'Tüm Veri' },
]

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  onExport,
  totalRows,
  theme,
  gridId
}) => {
  const [selectedRows, setSelectedRows] = useState<number>(100000)
  const [customRows, setCustomRows] = useState<string>('')
  const [isCustom, setIsCustom] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')

  // Toplam satıra göre mantıklı varsayılan
  useEffect(() => {
    if (totalRows > 0) {
      if (totalRows <= 10000) setSelectedRows(totalRows)
      else if (totalRows <= 100000) setSelectedRows(100000)
      else if (totalRows <= 1000000) setSelectedRows(1000000)
      else setSelectedRows(-1) // Tüm veri
    }
  }, [totalRows])

  if (!isOpen) return null

  const formatNumber = (num: number) => new Intl.NumberFormat('tr-TR').format(num)

  const getEffectiveRowCount = () => {
    if (isCustom && customRows) {
      const num = parseInt(customRows.replace(/\./g, ''), 10)
      return isNaN(num) ? 0 : Math.min(num, totalRows)
    }
    return selectedRows === -1 ? totalRows : Math.min(selectedRows, totalRows)
  }

  const handleExport = async () => {
    const rowLimit = getEffectiveRowCount()
    if (rowLimit <= 0) return

    setExporting(true)
    setProgress(0)
    setProgressMessage('Export hazırlanıyor...')

    try {
      await onExport(rowLimit)
      setProgressMessage('Tamamlandı!')
      setProgress(100)
      setTimeout(() => {
        onClose()
        setExporting(false)
        setProgress(0)
      }, 1000)
    } catch (error) {
      console.error('Export failed:', error)
      setProgressMessage('Hata oluştu!')
      setExporting(false)
    }
  }

  const effectiveRows = getEffectiveRowCount()
  const estimatedSheets = Math.ceil(effectiveRows / 1000000)
  const estimatedTime = Math.ceil(effectiveRows / 50000) // ~50K satır/saniye tahmini

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className={clsx('w-full max-w-lg rounded-xl shadow-2xl', theme.cardBg, theme.border, 'border')}>
        {/* Header */}
        <div className={clsx('flex items-center justify-between px-6 py-4 border-b', theme.border)}>
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            <h3 className={clsx('text-lg font-semibold', theme.contentText)}>Excel Export</h3>
          </div>
          <button 
            onClick={onClose} 
            disabled={exporting}
            className={clsx('p-1 rounded hover:bg-white/10', theme.contentTextMuted)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Dataset bilgisi */}
          <div className={clsx('p-4 rounded-lg border', theme.border, theme.inputBg)}>
            <div className="flex justify-between items-center">
              <span className={theme.contentTextMuted}>Toplam Satır:</span>
              <span className={clsx('font-bold text-lg', theme.contentText)}>
                {formatNumber(totalRows)}
              </span>
            </div>
          </div>

          {/* Satır sayısı seçimi */}
          <div className="space-y-3">
            <label className={clsx('block font-medium', theme.contentText)}>
              Kaç satır export etmek istiyorsunuz?
            </label>

            {/* Hazır seçenekler */}
            <div className="grid grid-cols-3 gap-2">
              {ROW_OPTIONS.filter(opt => opt.value === -1 || opt.value <= totalRows).map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setSelectedRows(option.value)
                    setIsCustom(false)
                  }}
                  disabled={exporting}
                  className={clsx(
                    'px-3 py-2 rounded-lg text-sm font-medium border transition-all',
                    selectedRows === option.value && !isCustom
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                      : clsx(theme.border, theme.contentTextMuted, 'hover:bg-white/5')
                  )}
                >
                  {option.value === -1 ? `Tüm Veri (${formatNumber(totalRows)})` : option.label}
                </button>
              ))}
            </div>

            {/* Özel miktar */}
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={isCustom}
                onChange={(e) => setIsCustom(e.target.checked)}
                disabled={exporting}
                className="w-4 h-4 rounded"
              />
              <label className={theme.contentTextMuted}>Özel miktar:</label>
              <input
                type="text"
                value={customRows}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '')
                  setCustomRows(val)
                  setIsCustom(true)
                }}
                placeholder="örn: 2.500.000"
                disabled={exporting || !isCustom}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg border',
                  theme.border, theme.inputBg, theme.contentText,
                  !isCustom && 'opacity-50'
                )}
              />
            </div>
          </div>

          {/* Bilgi kutusu */}
          {effectiveRows > 1000000 && (
            <div className={clsx('p-4 rounded-lg border flex items-start gap-3', 'border-amber-500/50 bg-amber-500/10')}>
              <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-400 font-medium">Büyük Veri Uyarısı</p>
                <p className={theme.contentTextMuted}>
                  {formatNumber(effectiveRows)} satır export edilecek. 
                  Excel maksimum 1 milyon satır desteklediği için veri <strong>{estimatedSheets} sayfa</strong>ya bölünecek.
                  Tahmini süre: <strong>~{estimatedTime > 60 ? `${Math.ceil(estimatedTime/60)} dakika` : `${estimatedTime} saniye`}</strong>
                </p>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {exporting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={theme.contentTextMuted}>{progressMessage}</span>
                <span className={theme.contentText}>{progress}%</span>
              </div>
              <div className={clsx('h-2 rounded-full overflow-hidden', theme.inputBg)}>
                <div 
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx('flex items-center justify-between px-6 py-4 border-t', theme.border)}>
          <div className={clsx('text-sm', theme.contentTextMuted)}>
            Export edilecek: <span className={clsx('font-bold', theme.contentText)}>{formatNumber(effectiveRows)}</span> satır
            {estimatedSheets > 1 && ` (${estimatedSheets} sayfa)`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={exporting}
              className={clsx(
                'px-4 py-2 rounded-lg border font-medium',
                theme.border, theme.contentTextMuted,
                'hover:bg-white/5'
              )}
            >
              İptal
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || effectiveRows <= 0}
              className={clsx(
                'px-4 py-2 rounded-lg font-medium flex items-center gap-2',
                'bg-emerald-600 hover:bg-emerald-500 text-white',
                (exporting || effectiveRows <= 0) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {exporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Export ediliyor...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Excel'e Export Et
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


