/**
 * Parameter Store
 * Tasarımdaki parametre filtrelerinin seçili değerlerini yönetir
 * 
 * Kullanım:
 * - Dashboard/Analysis sayfalarında parametre widget'ları combobox olarak render edilir
 * - Kullanıcı bir değer seçtiğinde bu store güncellenir
 * - fetchDashboardData çağrıldığında selectedValues backend'e gönderilir
 * - Backend bu değerleri WHERE koşullarına ekler
 */

import { create } from 'zustand'

interface ParameterState {
  // Metrik ID -> Seçili değer (string)
  // Örnek: { "metricId1": "2025", "metricId2": "Bot" }
  selectedValues: Record<string, string>
  
  // Metrik ID -> Mevcut opsiyonlar (backend'den gelen)
  // Örnek: { "metricId1": ["2024", "2025", "2026"], "metricId2": ["Bot", "Ayakkabı", "Çizme"] }
  options: Record<string, string[]>
  
  // Parametre metrik ID'leri (hangi metrikler parametre tipi)
  parameterMetricIds: string[]
  
  // Actions
  setParameterValue: (metricId: string, value: string) => void
  setOptions: (metricId: string, options: string[]) => void
  setParameterMetricIds: (ids: string[]) => void
  clearAll: () => void
  clearDesignParameters: () => void
  
  // Helpers
  getParametersForRequest: () => Record<string, string>
  hasActiveFilters: () => boolean
}

export const useParameterStore = create<ParameterState>((set, get) => ({
  selectedValues: {},
  options: {},
  parameterMetricIds: [],
  
  /**
   * Parametre değerini güncelle
   * @param metricId - Parametre metriğinin ID'si
   * @param value - Seçilen değer (veya 'ALL' tümü için)
   */
  setParameterValue: (metricId: string, value: string) => {
    set((state) => ({
      selectedValues: {
        ...state.selectedValues,
        [metricId]: value
      }
    }))
  },
  
  /**
   * Parametre için mevcut seçenekleri güncelle
   * @param metricId - Parametre metriğinin ID'si
   * @param options - Backend'den gelen benzersiz değerler
   */
  setOptions: (metricId: string, options: string[]) => {
    set((state) => ({
      options: {
        ...state.options,
        [metricId]: options
      }
    }))
  },
  
  /**
   * Mevcut tasarımdaki parametre metrik ID'lerini ayarla
   */
  setParameterMetricIds: (ids: string[]) => {
    set({ parameterMetricIds: ids })
  },
  
  /**
   * Tüm seçimleri ve opsiyonları temizle
   */
  clearAll: () => {
    set({
      selectedValues: {},
      options: {},
      parameterMetricIds: []
    })
  },
  
  /**
   * Sadece seçili değerleri temizle (tasarım değiştiğinde)
   */
  clearDesignParameters: () => {
    set({
      selectedValues: {},
      options: {}
    })
  },
  
  /**
   * API isteği için parametre objesini döndür
   * Sadece 'ALL' olmayan değerleri dahil eder
   */
  getParametersForRequest: () => {
    const { selectedValues } = get()
    const params: Record<string, string> = {}
    
    for (const [metricId, value] of Object.entries(selectedValues)) {
      // ALL veya boş değilse dahil et
      if (value && value !== 'ALL' && value !== '') {
        params[metricId] = value
      }
    }
    
    return params
  },
  
  /**
   * Aktif filtre var mı kontrol et
   */
  hasActiveFilters: () => {
    const { selectedValues } = get()
    return Object.values(selectedValues).some(v => v && v !== 'ALL' && v !== '')
  }
}))
