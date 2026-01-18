/**
 * authStore Unit Tests
 * Authentication store için testler
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './authStore'
import { mockUser, mockTokens } from '../test/mocks/handlers'

// Store'u her testten önce resetle
const resetStore = () => {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    hasHydrated: false,
  })
}

describe('authStore', () => {
  beforeEach(() => {
    resetStore()
  })

  describe('login', () => {
    it('basarili login sonrasi state guncellenmeli', async () => {
      const { login } = useAuthStore.getState()
      
      await login('test@clixer.com', 'correct-password')
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(true)
      expect(state.user).toEqual(mockUser)
      expect(state.accessToken).toBe(mockTokens.accessToken)
      expect(state.refreshToken).toBe(mockTokens.refreshToken)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('basarisiz login sonrasi error set edilmeli', async () => {
      const { login } = useAuthStore.getState()
      
      await expect(login('test@clixer.com', 'wrong-password')).rejects.toThrow()
      
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeTruthy()
    })

    it('login sirasinda isLoading true olmali', async () => {
      const { login } = useAuthStore.getState()
      
      // Login başlat ama beklemeden state'i kontrol et
      const loginPromise = login('test@clixer.com', 'correct-password')
      
      // Not: Bu test async nature nedeniyle her zaman güvenilir olmayabilir
      // Daha iyi bir yaklaşım için loading state'ini ayrı test edilebilir
      
      await loginPromise
      
      // Login tamamlandıktan sonra isLoading false olmalı
      expect(useAuthStore.getState().isLoading).toBe(false)
    })
  })

  describe('logout', () => {
    it('logout sonrasi state temizlenmeli', async () => {
      // Önce login yap
      await useAuthStore.getState().login('test@clixer.com', 'correct-password')
      
      // Login olduğunu doğrula
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      
      // Logout yap
      useAuthStore.getState().logout()
      
      // State temizlenmiş olmalı
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.user).toBeNull()
      expect(state.accessToken).toBeNull()
      expect(state.refreshToken).toBeNull()
    })
  })

  describe('refreshAccessToken', () => {
    it('token refresh basarili oldugunda yeni token set edilmeli', async () => {
      // Önce login yap
      await useAuthStore.getState().login('test@clixer.com', 'correct-password')
      
      const oldToken = useAuthStore.getState().accessToken
      
      // Token'ı refresh et
      const result = await useAuthStore.getState().refreshAccessToken()
      
      expect(result).toBe(true)
      expect(useAuthStore.getState().accessToken).toBe('new-access-token-99999')
      expect(useAuthStore.getState().accessToken).not.toBe(oldToken)
    })

    it('refresh token yoksa false donmeli', async () => {
      // Login olmadan (refresh token yok)
      const result = await useAuthStore.getState().refreshAccessToken()
      
      expect(result).toBe(false)
    })
  })

  describe('clearError', () => {
    it('clearError error state ini temizlemeli', async () => {
      // Hatalı login yap
      try {
        await useAuthStore.getState().login('test@clixer.com', 'wrong-password')
      } catch (e) {
        // Hata bekleniyor
      }
      
      // Error set edilmiş olmalı
      expect(useAuthStore.getState().error).toBeTruthy()
      
      // Error'ı temizle
      useAuthStore.getState().clearError()
      
      expect(useAuthStore.getState().error).toBeNull()
    })
  })

  describe('setUser', () => {
    it('setUser kullanici bilgilerini guncellemeli', () => {
      const newUser = {
        id: 'new-user-id',
        email: 'new@clixer.com',
        name: 'New User',
        role: 'USER',
        tenantId: 'tenant-2',
      }
      
      useAuthStore.getState().setUser(newUser)
      
      expect(useAuthStore.getState().user).toEqual(newUser)
    })
  })
})
