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
  
  // 2FA State
  requiresTwoFactor: boolean
  twoFactorEmail: string | null  // 2FA bekleyen kullanıcının email'i
  
  // 2FA Setup State (ilk kurulum için)
  requires2FASetup: boolean
  setupToken: string | null  // 2FA kurulumu için geçici token
  
  login: (email: string, password: string, twoFactorCode?: string, rememberDevice?: boolean) => Promise<void>
  logout: () => void
  refreshAccessToken: () => Promise<boolean>
  clearError: () => void
  setHasHydrated: (state: boolean) => void
  setUser: (user: User) => void
  clearTwoFactor: () => void  // 2FA state'ini temizle
  clear2FASetup: () => void   // 2FA setup state'ini temizle
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
      
      // 2FA State
      requiresTwoFactor: false,
      twoFactorEmail: null,
      
      // 2FA Setup State
      requires2FASetup: false,
      setupToken: null,

      login: async (email: string, password: string, twoFactorCode?: string, rememberDevice?: boolean) => {
        set({ isLoading: true, error: null })
        try {
          // Device token varsa gönder (trusted device kontrolü için)
          const deviceToken = localStorage.getItem('trusted_device_token')
          
          const response = await api.post('/auth/login', { 
            email, 
            password,
            twoFactorCode,
            rememberDevice,
            deviceToken
          })
          
          // 2FA Setup gerekiyorsa (ilk kurulum)
          if (response.data.requires2FASetup) {
            set({
              isLoading: false,
              requires2FASetup: true,
              setupToken: response.data.setupToken,
              twoFactorEmail: email,
              error: null
            })
            return
          }
          
          // 2FA gerekiyorsa (zaten kurulu, kod lazım)
          if (response.data.requiresTwoFactor) {
            set({
              isLoading: false,
              requiresTwoFactor: true,
              twoFactorEmail: email,
              error: null
            })
            return
          }
          
          const { accessToken, refreshToken, user, trustedDeviceToken } = response.data.data
          
          // Trusted device token'ı kaydet (30 gün hatırla)
          if (trustedDeviceToken) {
            localStorage.setItem('trusted_device_token', trustedDeviceToken)
          }
          
          set({
            user,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            requiresTwoFactor: false,
            twoFactorEmail: null,
            requires2FASetup: false,
            setupToken: null,
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
      
      // 2FA state'ini temizle (iptal veya yeni giriş denemesi için)
      clearTwoFactor: () => set({ 
        requiresTwoFactor: false, 
        twoFactorEmail: null,
        error: null 
      }),
      
      // 2FA setup state'ini temizle
      clear2FASetup: () => set({
        requires2FASetup: false,
        setupToken: null,
        twoFactorEmail: null,
        error: null
      }),
    }),
    {
      name: 'clixer-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        // 2FA state persist edilmez - her seferinde yeniden sorulmalı
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
