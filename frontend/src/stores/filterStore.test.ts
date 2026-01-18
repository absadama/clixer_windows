/**
 * filterStore Unit Tests
 * Filter store için testler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFilterStore } from './filterStore'
import { mockRegions, mockGroups, mockStores } from '../test/mocks/handlers'

// Store'u her testten önce resetle
const resetStore = () => {
  useFilterStore.setState({
    regions: [],
    groups: [],
    stores: [],
    selectedRegionIds: [],
    selectedGroupIds: [],
    selectedRegionId: null,
    selectedStoreIds: [],
    selectedStoreType: 'ALL',
    datePreset: 'thisMonth',
    startDate: '',
    endDate: '',
    isLoading: false,
    isLoaded: false,
    isMobileFilterOpen: false,
    crossFilters: [],
    drillDown: {
      isOpen: false,
      sourceWidgetId: null,
      sourceMetricId: null,
      field: null,
      value: null,
      label: undefined,
      data: undefined,
      loading: false,
    },
  })
}

describe('filterStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('loadFilters', () => {
    it('API den verileri yuklemeli', async () => {
      const { loadFilters } = useFilterStore.getState()
      
      await loadFilters('mock-access-token')
      
      const state = useFilterStore.getState()
      expect(state.isLoaded).toBe(true)
      expect(state.isLoading).toBe(false)
      expect(state.regions.length).toBeGreaterThan(0)
      expect(state.stores.length).toBeGreaterThan(0)
      expect(state.groups.length).toBeGreaterThan(0)
    })

    it('zaten yuklenmisse tekrar yuklememeli', async () => {
      // İlk yükleme
      await useFilterStore.getState().loadFilters('mock-access-token')
      
      const firstLoadRegions = useFilterStore.getState().regions
      
      // İkinci yükleme denemesi
      await useFilterStore.getState().loadFilters('mock-access-token')
      
      // Aynı veri olmalı (tekrar yüklenmemiş)
      expect(useFilterStore.getState().regions).toBe(firstLoadRegions)
    })
  })

  describe('setRegions', () => {
    it('secilen bolgeleri guncellemeli', () => {
      useFilterStore.getState().setRegions(['region-1', 'region-2'])
      
      expect(useFilterStore.getState().selectedRegionIds).toEqual(['region-1', 'region-2'])
    })

    it('bos array ile temizleyebilmeli', () => {
      useFilterStore.getState().setRegions(['region-1'])
      useFilterStore.getState().setRegions([])
      
      expect(useFilterStore.getState().selectedRegionIds).toEqual([])
    })
  })

  describe('setGroups', () => {
    it('secilen gruplari guncellemeli', () => {
      useFilterStore.getState().setGroups(['group-1', 'group-2'])
      
      expect(useFilterStore.getState().selectedGroupIds).toEqual(['group-1', 'group-2'])
    })
  })

  describe('setStores', () => {
    it('secilen magazalari guncellemeli', () => {
      useFilterStore.getState().setStores(['store-1', 'store-2'])
      
      expect(useFilterStore.getState().selectedStoreIds).toEqual(['store-1', 'store-2'])
    })
  })

  describe('setDatePreset', () => {
    it('today preset i bugunun tarihini set etmeli', () => {
      useFilterStore.getState().setDatePreset('today')
      
      const state = useFilterStore.getState()
      const today = new Date()
      const expectedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      
      expect(state.datePreset).toBe('today')
      expect(state.startDate).toBe(expectedDate)
      expect(state.endDate).toBe(expectedDate)
    })

    it('all preset i tarihleri bosaltmali', () => {
      // Önce bir tarih set et
      useFilterStore.getState().setDatePreset('today')
      
      // Sonra "all" seç
      useFilterStore.getState().setDatePreset('all')
      
      const state = useFilterStore.getState()
      expect(state.datePreset).toBe('all')
      expect(state.startDate).toBe('')
      expect(state.endDate).toBe('')
    })

    it('last7 preset i 7 gun oncesini baslangic yapmali', () => {
      useFilterStore.getState().setDatePreset('last7')
      
      const state = useFilterStore.getState()
      const today = new Date()
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      const expectedStart = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`
      
      expect(state.datePreset).toBe('last7')
      expect(state.startDate).toBe(expectedStart)
    })
  })

  describe('setCustomDates', () => {
    it('ozel tarihleri set etmeli', () => {
      useFilterStore.getState().setCustomDates('2024-01-01', '2024-01-31')
      
      const state = useFilterStore.getState()
      expect(state.datePreset).toBe('custom')
      expect(state.startDate).toBe('2024-01-01')
      expect(state.endDate).toBe('2024-01-31')
    })
  })

  describe('resetFilters', () => {
    it('tum state i sifirlamali', async () => {
      // Önce filtreler yükle
      await useFilterStore.getState().loadFilters('mock-access-token')
      
      // Bazı seçimler yap
      useFilterStore.getState().setRegions(['region-1'])
      useFilterStore.getState().setDatePreset('last30')
      
      // Reset
      useFilterStore.getState().resetFilters()
      
      const state = useFilterStore.getState()
      expect(state.selectedRegionIds).toEqual([])
      expect(state.selectedGroupIds).toEqual([])
      expect(state.datePreset).toBe('thisMonth')
      expect(state.crossFilters).toEqual([])
    })
  })

  describe('Cross-Filter', () => {
    it('cross filter eklenebilmeli', () => {
      const filter = {
        widgetId: 'widget-1',
        field: 'category',
        value: 'Electronics',
        label: 'Elektronik',
      }
      
      useFilterStore.getState().addCrossFilter(filter)
      
      expect(useFilterStore.getState().crossFilters).toContainEqual(filter)
    })

    it('ayni widget dan gelen filter guncellemeli', () => {
      const filter1 = { widgetId: 'widget-1', field: 'category', value: 'Electronics' }
      const filter2 = { widgetId: 'widget-1', field: 'category', value: 'Clothing' }
      
      useFilterStore.getState().addCrossFilter(filter1)
      useFilterStore.getState().addCrossFilter(filter2)
      
      const crossFilters = useFilterStore.getState().crossFilters
      expect(crossFilters.length).toBe(1)
      expect(crossFilters[0].value).toBe('Clothing')
    })

    it('cross filter cikarilabilmeli', () => {
      const filter = { widgetId: 'widget-1', field: 'category', value: 'Electronics' }
      
      useFilterStore.getState().addCrossFilter(filter)
      useFilterStore.getState().removeCrossFilter('widget-1')
      
      expect(useFilterStore.getState().crossFilters).toEqual([])
    })

    it('tum cross filter lar temizlenebilmeli', () => {
      useFilterStore.getState().addCrossFilter({ widgetId: 'w1', field: 'f1', value: 'v1' })
      useFilterStore.getState().addCrossFilter({ widgetId: 'w2', field: 'f2', value: 'v2' })
      
      useFilterStore.getState().clearCrossFilters()
      
      expect(useFilterStore.getState().crossFilters).toEqual([])
    })
  })

  describe('Drill-Down', () => {
    it('drill down acilabilmeli', () => {
      useFilterStore.getState().openDrillDown('widget-1', 'metric-1', 'store_id', 'store-1', 'Kadıköy')
      
      const drillDown = useFilterStore.getState().drillDown
      expect(drillDown.isOpen).toBe(true)
      expect(drillDown.sourceWidgetId).toBe('widget-1')
      expect(drillDown.sourceMetricId).toBe('metric-1')
      expect(drillDown.field).toBe('store_id')
      expect(drillDown.value).toBe('store-1')
      expect(drillDown.label).toBe('Kadıköy')
      expect(drillDown.loading).toBe(true)
    })

    it('drill down kapatilabilmeli', () => {
      useFilterStore.getState().openDrillDown('widget-1', 'metric-1', 'store_id', 'store-1')
      useFilterStore.getState().closeDrillDown()
      
      const drillDown = useFilterStore.getState().drillDown
      expect(drillDown.isOpen).toBe(false)
      expect(drillDown.sourceWidgetId).toBeNull()
    })

    it('drill down verisi set edilebilmeli', () => {
      useFilterStore.getState().openDrillDown('widget-1', 'metric-1', 'store_id', 'store-1')
      
      const mockData = [{ id: 1, name: 'Product 1' }, { id: 2, name: 'Product 2' }]
      useFilterStore.getState().setDrillDownData(mockData)
      
      const drillDown = useFilterStore.getState().drillDown
      expect(drillDown.data).toEqual(mockData)
      expect(drillDown.loading).toBe(false)
    })
  })

  describe('getDateRange', () => {
    it('tarih araligini dondurmeli', () => {
      useFilterStore.getState().setCustomDates('2024-01-01', '2024-01-31')
      
      const range = useFilterStore.getState().getDateRange()
      expect(range.start).toBe('2024-01-01')
      expect(range.end).toBe('2024-01-31')
    })
  })

  describe('getFilteredStores', () => {
    it('tum magazalari dondurmeli', async () => {
      await useFilterStore.getState().loadFilters('mock-access-token')
      
      const filtered = useFilterStore.getState().getFilteredStores()
      const allStores = useFilterStore.getState().stores
      
      // Kullanıcı isteği: Mağaza dropdown'ı filtrelenmeyecek
      expect(filtered.length).toBe(allStores.length)
    })
  })
})
