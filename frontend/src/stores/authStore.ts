import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '../services/api'

interface User {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
  positionCode?: string
  filterLevel?: string      // RLS için
  filterValue?: string      // RLS için
  canSeeAllCategories?: boolean  // Güçler Ayrılığı - tüm kategorilere erişim
  categoryIds?: string[]         // Güçler Ayrılığı - atanan kategori ID'leri
}

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasHydrated: boolean
  
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
  clearError: () => void
  setHasHydrated: (state: boolean) => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', { email, password })
          const { accessToken, refreshToken, user } = response.data.data
          
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.response?.data?.message || 'Giriş başarısız',
          })
          throw error
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get()
        if (!refreshToken) {
          return false
        }

        try {
          const response = await api.post('/auth/refresh', { refreshToken })
          const { accessToken: newAccessToken } = response.data.data
          
          set({ accessToken: newAccessToken })
          return true
        } catch (error) {
          // Refresh token da geçersiz - logout
          get().logout()
          return false
        }
      },

      clearError: () => set({ error: null }),
      
      setHasHydrated: (state: boolean) => set({ hasHydrated: state }),
      
      setUser: (user: User) => set({ user }),
    }),
    {
      name: 'clixer-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
