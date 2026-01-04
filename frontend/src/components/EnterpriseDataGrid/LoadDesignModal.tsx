// Enterprise DataGrid - Tasarım Yükleme Modalı

import React, { useState } from 'react'
import clsx from 'clsx'
import { X, Check, Trash2, Star, Clock } from 'lucide-react'

interface GridDesign {
  id: string
  name: string
  grid_id: string
  state: any
  is_default: boolean
  dataset_id?: string
  dataset_name?: string
  created_at: string
  updated_at: string
}

interface LoadDesignModalProps {
  isOpen: boolean
  onClose: () => void
  onLoad: (design: GridDesign) => void
  onDelete: (designId: string) => Promise<void>
  onSetDefault: (designId: string) => Promise<void>
  designs: GridDesign[]
  loading: boolean
  theme: any
}

export const LoadDesignModal: React.FC<LoadDesignModalProps> = ({
  isOpen,
  onClose,
  onLoad,
  onDelete,
  onSetDefault,
  designs,
  loading,
  theme,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  if (!isOpen) return null

  const handleDelete = async (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id)
      return
    }

    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
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
        'relative w-full max-w-lg rounded-xl border shadow-2xl',
        theme.cardBg,
        theme.border
      )}>
        {/* Header */}
        <div className={clsx('flex items-center justify-between px-6 py-4 border-b', theme.border)}>
          <h3 className={clsx('text-lg font-semibold', theme.contentText)}>
            Kayıtlı Tasarımlar
          </h3>
          <button
            onClick={onClose}
            className={clsx('p-1 rounded-lg hover:bg-white/10', theme.mutedText)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : designs.length === 0 ? (
            <div className={clsx('text-center py-8', theme.mutedText)}>
              <p>Henüz kayıtlı tasarım yok.</p>
              <p className="text-sm mt-1">Tabloyu özelleştirin ve "Kaydet" butonuna tıklayın.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {designs.map(design => (
                <div
                  key={design.id}
                  className={clsx(
                    'flex items-center justify-between p-4 rounded-lg border transition-colors',
                    theme.border,
                    'hover:bg-white/5 group'
                  )}
                >
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => {
                      onLoad(design)
                      onClose()
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className={clsx('font-medium', theme.contentText)}>
                        {design.name}
                      </span>
                      {design.is_default && (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-xs">
                          Varsayılan
                        </span>
                      )}
                    </div>
                    <div className={clsx('flex items-center gap-2 text-xs mt-1', theme.mutedText)}>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(design.updated_at)}
                      </div>
                      {design.dataset_name && (
                        <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                          📊 {design.dataset_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!design.is_default && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSetDefault(design.id)
                        }}
                        className={clsx(
                          'p-2 rounded-lg hover:bg-white/10 transition-colors',
                          theme.mutedText,
                          'hover:text-yellow-400'
                        )}
                        title="Varsayılan yap"
                      >
                        <Star className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(design.id)
                      }}
                      disabled={deletingId === design.id}
                      className={clsx(
                        'p-2 rounded-lg hover:bg-white/10 transition-colors',
                        confirmDeleteId === design.id 
                          ? 'text-red-400 bg-red-500/20' 
                          : theme.mutedText,
                        'hover:text-red-400'
                      )}
                      title={confirmDeleteId === design.id ? 'Silmeyi onayla' : 'Sil'}
                    >
                      {deletingId === design.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={clsx('flex items-center justify-between px-6 py-4 border-t', theme.border)}>
          <span className={clsx('text-sm', theme.mutedText)}>
            {designs.length} tasarım
          </span>
          <button
            onClick={onClose}
            className={clsx(
              'px-4 py-2 rounded-lg border text-sm',
              theme.border,
              'hover:bg-white/5'
            )}
          >
            Kapat
          </button>
        </div>
      </div>
    </div>
  )
}

export default LoadDesignModal


