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
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  hasHydrated: boolean
  
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  clearError: () => void
  setHasHydrated: (state: boolean) => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null })
        try {
          const response = await api.post('/auth/login', { email, password })
          const { accessToken, user } = response.data.data
          
          set({
            user,
            accessToken,
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
          isAuthenticated: false,
        })
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
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
