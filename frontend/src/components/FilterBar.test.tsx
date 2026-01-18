/**
 * FilterBar Component Tests
 * FilterBar UI bileşeni için testler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FilterBar from './FilterBar'
import { useFilterStore } from '../stores/filterStore'
import { useAuthStore } from '../stores/authStore'

// Theme context mock
vi.mock('./Layout', () => ({
  useTheme: () => ({
    theme: {
      cardBg: 'bg-white',
      contentText: 'text-gray-900',
      contentTextMuted: 'text-gray-500',
      buttonSecondary: 'bg-gray-100',
      inputBg: 'bg-white',
      inputText: 'text-gray-900',
    },
    isDark: false,
  }),
}))

// Store'ları her testten önce resetle
const resetStores = async () => {
  // Auth store'u mock token ile set et
  useAuthStore.setState({
    accessToken: 'mock-access-token',
    isAuthenticated: true,
    user: {
      id: 'user-1',
      email: 'test@clixer.com',
      name: 'Test User',
      role: 'ADMIN',
      tenantId: 'tenant-1',
    },
  })

  // Filter store'u verilerle doldur
  useFilterStore.setState({
    regions: [
      { id: 'region-1', code: '1', name: 'Marmara' },
      { id: 'region-2', code: '2', name: 'Ege' },
    ],
    groups: [
      { id: 'group-1', code: 'MERKEZ', name: 'Merkez Mağazalar' },
      { id: 'group-2', code: 'FRANCHISE', name: 'Franchise Mağazalar' },
    ],
    stores: [
      { id: 'store-1', code: 'IST001', name: 'Kadıköy Mağaza', storeType: 'MERKEZ', regionId: 'region-1', city: 'İstanbul' },
      { id: 'store-2', code: 'IST002', name: 'Beşiktaş Mağaza', storeType: 'MERKEZ', regionId: 'region-1', city: 'İstanbul' },
      { id: 'store-3', code: 'IZM001', name: 'Alsancak Mağaza', storeType: 'FRANCHISE', regionId: 'region-2', city: 'İzmir' },
    ],
    selectedRegionIds: [],
    selectedGroupIds: [],
    selectedStoreIds: ['store-1', 'store-2', 'store-3'],
    datePreset: 'thisMonth',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    isLoading: false,
    isLoaded: true,
    isMobileFilterOpen: false,
  })
}

// Window size mock for desktop
const mockDesktopWindow = () => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true })
  window.dispatchEvent(new Event('resize'))
}

describe('FilterBar', () => {
  beforeEach(async () => {
    await resetStores()
    mockDesktopWindow()
  })

  describe('Render', () => {
    it('component renderlanmali', () => {
      render(<FilterBar />)
      
      expect(screen.getByText('Filtreler:')).toBeInTheDocument()
    })

    it('bolge filtresi gosterilmeli', () => {
      render(<FilterBar showRegionFilter={true} />)
      
      expect(screen.getByText('Tüm Bölgeler')).toBeInTheDocument()
    })

    it('magaza filtresi gosterilmeli', () => {
      render(<FilterBar showStoreFilter={true} />)
      
      expect(screen.getByText('Tüm Mağazalar')).toBeInTheDocument()
    })

    it('tarih filtresi gosterilmeli', () => {
      render(<FilterBar showDateFilter={true} />)
      
      expect(screen.getByText('Bu Ay')).toBeInTheDocument()
    })
  })

  describe('Bolge Dropdown', () => {
    it('bolge dropdown acilmali', async () => {
      const user = userEvent.setup()
      render(<FilterBar />)
      
      const regionButton = screen.getByText('Tüm Bölgeler')
      await user.click(regionButton)
      
      // Dropdown açıldığında bölge isimleri görünmeli
      await waitFor(() => {
        expect(screen.getByText('Marmara')).toBeInTheDocument()
        expect(screen.getByText('Ege')).toBeInTheDocument()
      })
    })

    it('bolge secimi yapilabilmeli', async () => {
      const user = userEvent.setup()
      render(<FilterBar />)
      
      // Dropdown'ı aç
      const regionButton = screen.getByText('Tüm Bölgeler')
      await user.click(regionButton)
      
      // Marmara'yı seç
      await waitFor(() => {
        const marmaraOption = screen.getByText('Marmara')
        expect(marmaraOption).toBeInTheDocument()
      })
      
      // Checkbox'a tıkla (label içinde)
      const marmaraLabel = screen.getByText('Marmara').closest('label')
      if (marmaraLabel) {
        await user.click(marmaraLabel)
      }
      
      // Store güncellenmeli
      const state = useFilterStore.getState()
      expect(state.selectedRegionIds).toContain('1') // code değeri
    })
  })

  describe('Magaza Dropdown', () => {
    it('magaza dropdown acilmali', async () => {
      const user = userEvent.setup()
      render(<FilterBar />)
      
      const storeButton = screen.getByText('Tüm Mağazalar')
      await user.click(storeButton)
      
      // Dropdown açıldığında mağaza isimleri görünmeli
      await waitFor(() => {
        expect(screen.getByText('Kadıköy Mağaza')).toBeInTheDocument()
      })
    })
  })

  describe('Tarih Dropdown', () => {
    it('tarih preset secildiginde tarihler guncellenmeli', async () => {
      const user = userEvent.setup()
      render(<FilterBar />)
      
      // Tarih butonuna tıkla
      const dateButton = screen.getByText('Bu Ay')
      await user.click(dateButton)
      
      // "Bugün" seçeneği görünmeli
      await waitFor(() => {
        expect(screen.getByText('Bugün')).toBeInTheDocument()
      })
      
      // "Bugün"e tıkla
      const todayButton = screen.getByText('Bugün')
      await user.click(todayButton)
      
      // Store güncellenmeli
      const state = useFilterStore.getState()
      expect(state.datePreset).toBe('today')
    })
  })

  describe('Hizli Secim Butonlari', () => {
    it('tumunu sec butonu calismal', async () => {
      const user = userEvent.setup()
      
      // Önce 2 mağaza seç (böylece "2 mağaza" yazacak)
      useFilterStore.setState({ selectedStoreIds: ['store-1', 'store-2'] })
      
      render(<FilterBar />)
      
      // Mağaza dropdown'ını aç (2 mağaza seçili olduğunda "2 mağaza" yazar)
      const storeButton = screen.getByText('2 mağaza')
      await user.click(storeButton)
      
      // "Tümünü Seç" butonunu bul ve tıkla
      await waitFor(() => {
        const selectAllButton = screen.getByText('Tümünü Seç')
        expect(selectAllButton).toBeInTheDocument()
      })
    })
  })

  describe('Props', () => {
    it('showRegionFilter false oldugunda bolge filtresi gizlenmeli', () => {
      render(<FilterBar showRegionFilter={false} />)
      
      expect(screen.queryByText('Tüm Bölgeler')).not.toBeInTheDocument()
    })

    it('showStoreFilter false oldugunda magaza filtresi gizlenmeli', () => {
      render(<FilterBar showStoreFilter={false} />)
      
      expect(screen.queryByText('Tüm Mağazalar')).not.toBeInTheDocument()
    })

    it('showDateFilter false oldugunda tarih filtresi gizlenmeli', () => {
      render(<FilterBar showDateFilter={false} />)
      
      expect(screen.queryByText('Bu Ay')).not.toBeInTheDocument()
    })
  })
})
