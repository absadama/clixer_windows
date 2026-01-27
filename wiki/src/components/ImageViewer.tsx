import { useState } from 'react'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'

interface ImageViewerProps {
  src: string
  alt: string
  caption?: string
  onClose: () => void
}

export default function ImageViewer({ src, alt, caption, onClose }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5))

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = src
    link.download = alt || 'image'
    link.click()
  }

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut() }}
          className="p-2 bg-dark-card rounded-lg hover:bg-dark-hover transition-colors"
          disabled={zoom <= 0.5}
        >
          <ZoomOut className="w-5 h-5" />
        </button>
        <span className="px-3 py-2 bg-dark-card rounded-lg text-sm">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn() }}
          className="p-2 bg-dark-card rounded-lg hover:bg-dark-hover transition-colors"
          disabled={zoom >= 3}
        >
          <ZoomIn className="w-5 h-5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload() }}
          className="p-2 bg-dark-card rounded-lg hover:bg-dark-hover transition-colors"
        >
          <Download className="w-5 h-5" />
        </button>
        <button
          onClick={onClose}
          className="p-2 bg-dark-card rounded-lg hover:bg-dark-hover transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Image */}
      <div 
        className="max-w-[90vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          className="transition-transform duration-200"
        />
      </div>

      {/* Caption */}
      {caption && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-dark-card rounded-lg text-sm text-gray-300">
          {caption}
        </div>
      )}
    </div>
  )
}
