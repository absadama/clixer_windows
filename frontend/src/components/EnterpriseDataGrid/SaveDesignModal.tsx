// Enterprise DataGrid - Tasarım Kaydetme Modalı

import React, { useState } from 'react'
import clsx from 'clsx'
import { X, Save, Check } from 'lucide-react'
import { GridState } from './types'

interface SaveDesignModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (name: string, isDefault: boolean) => Promise<void>
  existingDesigns: { id: string; name: string; is_default: boolean }[]
  theme: any
}

export const SaveDesignModal: React.FC<SaveDesignModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingDesigns,
  theme,
}) => {
  const [name, setName] = useState('')
  const [isDefault, setIsDefault] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Tasarım adı zorunludur')
      return
    }

    if (existingDesigns.some(d => d.name.toLowerCase() === name.toLowerCase())) {
      setError('Bu isimde bir tasarım zaten mevcut')
      return
    }

    setSaving(true)
    setError('')
    try {
      await onSave(name.trim(), isDefault)
      setName('')
      setIsDefault(false)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Kaydetme başarısız')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={clsx(
        'relative w-full max-w-md rounded-xl border shadow-2xl',
        theme.cardBg,
        theme.border
      )}>
        {/* Header */}
        <div className={clsx('flex items-center justify-between px-6 py-4 border-b', theme.border)}>
          <h3 className={clsx('text-lg font-semibold', theme.contentText)}>
            Tablo Tasarımını Kaydet
          </h3>
          <button
            onClick={onClose}
            className={clsx('p-1 rounded-lg hover:bg-white/10', theme.mutedText)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className={clsx('text-sm', theme.mutedText)}>
            Mevcut kolon sıralaması, gizli kolonlar, gruplamalar ve filtreler kaydedilecek.
          </p>

          {/* Tasarım Adı */}
          <div>
            <label className={clsx('block text-sm font-medium mb-2', theme.contentText)}>
              Tasarım Adı
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              placeholder="Örn: Satış Analizi Görünümü"
              className={clsx(
                'w-full px-4 py-2.5 rounded-lg border text-sm',
                theme.inputBg,
                theme.inputText,
                theme.inputBorder,
                theme.inputPlaceholder,
                error && 'border-red-500'
              )}
              autoFocus
            />
            {error && (
              <p className="mt-1 text-sm text-red-400">{error}</p>
            )}
          </div>

          {/* Varsayılan Yap */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span className={clsx('text-sm', theme.contentText)}>
              Varsayılan tasarım olarak ayarla
            </span>
          </label>

          {/* Mevcut Tasarımlar */}
          {existingDesigns.length > 0 && (
            <div>
              <label className={clsx('block text-sm font-medium mb-2', theme.mutedText)}>
                Mevcut Tasarımlarınız ({existingDesigns.length})
              </label>
              <div className={clsx('max-h-32 overflow-y-auto rounded-lg border p-2', theme.border)}>
                {existingDesigns.map(d => (
                  <div key={d.id} className={clsx(
                    'flex items-center gap-2 px-2 py-1 text-sm',
                    theme.contentText
                  )}>
                    {d.is_default && <Check className="w-4 h-4 text-green-500" />}
                    {d.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx('flex items-center justify-end gap-3 px-6 py-4 border-t', theme.border)}>
          <button
            onClick={onClose}
            className={clsx(
              'px-4 py-2 rounded-lg border text-sm',
              theme.border,
              'hover:bg-white/5'
            )}
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm',
              'bg-blue-600 hover:bg-blue-700 text-white',
              saving && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SaveDesignModal


