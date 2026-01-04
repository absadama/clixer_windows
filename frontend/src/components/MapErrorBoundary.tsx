/**
 * MapChart Error Boundary
 * Leaflet crash'lerini yakalar ve sayfa çökmesini önler
 */

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorCount: number;
}

export class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorCount: 0 };
  }

  static getDerivedStateFromError(_: Error): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Leaflet hatalarını sessizce yakala
    if (error.message.includes('Map container is already initialized')) {
      console.warn('[MapErrorBoundary] Leaflet container hatası yakalandı');
    } else {
      console.error('[MapErrorBoundary] Harita hatası:', error, errorInfo);
    }
  }

  // Retry mekanizması
  handleRetry = () => {
    this.setState(prev => ({ 
      hasError: false, 
      errorCount: prev.errorCount + 1 
    }));
  };

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex flex-col items-center justify-center h-full bg-slate-800/30 rounded-lg p-4">
          <p className="text-slate-400 text-sm mb-2">Harita yüklenemedi</p>
          <button
            onClick={this.handleRetry}
            className="text-xs px-3 py-1 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Tekrar Dene
          </button>
        </div>
      );
    }

    // Key olarak errorCount kullan - her retry'da yeni instance
    return (
      <React.Fragment key={`map-boundary-${this.state.errorCount}`}>
        {this.props.children}
      </React.Fragment>
    );
  }
}

export default MapErrorBoundary;

