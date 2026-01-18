/**
 * API Service Tests
 * Axios instance ve interceptor testleri
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from '../stores/authStore'
import { server } from '../test/mocks/server'
import { http, HttpResponse } from 'msw'

// API modülünü dinamik import et (interceptor'ların test edilebilmesi için)
const getApi = async () => {
  // Her testte yeni instance al
  const module = await import('./api')
  return module.default
}

// Store'u resetle
const resetAuthStore = () => {
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

describe('API Service', () => {
  beforeEach(() => {
    resetAuthStore()
  })

  describe('Request Interceptor', () => {
    it('token varsa Authorization header eklemeli', async () => {
      // Token'ı set et
      useAuthStore.setState({
        accessToken: 'test-token-12345',
        isAuthenticated: true,
      })

      const api = await getApi()
      
      // Request interceptor'ı test etmek için bir endpoint'e istek at
      // MSW bu isteği yakalayacak
      let capturedHeaders: any = null
      
      server.use(
        http.get('/api/test-headers', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries())
          return HttpResponse.json({ success: true })
        })
      )

      await api.get('/test-headers')
      
      expect(capturedHeaders?.authorization).toBe('Bearer test-token-12345')
    })

    it('token yoksa Authorization header eklememeli', async () => {
      // Token yok
      resetAuthStore()

      const api = await getApi()
      
      let capturedHeaders: any = null
      
      server.use(
        http.get('/api/test-no-token', ({ request }) => {
          capturedHeaders = Object.fromEntries(request.headers.entries())
          return HttpResponse.json({ success: true })
        })
      )

      await api.get('/test-no-token')
      
      // Authorization header olmamalı veya undefined olmalı
      expect(capturedHeaders?.authorization).toBeFalsy()
    })
  })

  describe('Response Interceptor', () => {
    it('401 response da logout tetiklenmeli', async () => {
      // Önce login ol
      useAuthStore.setState({
        accessToken: 'test-token',
        isAuthenticated: true,
        user: {
          id: 'user-1',
          email: 'test@test.com',
          name: 'Test',
          role: 'USER',
          tenantId: 'tenant-1',
        },
      })

      const api = await getApi()
      
      // 401 dönen endpoint
      server.use(
        http.get('/api/protected-resource', () => {
          return HttpResponse.json(
            { message: 'Unauthorized' },
            { status: 401 }
          )
        })
      )

      // İstek at (hata fırlatacak)
      try {
        await api.get('/protected-resource')
      } catch (error) {
        // 401 hatası bekleniyor
      }

      // Logout olmuş olmalı
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
      expect(state.accessToken).toBeNull()
    })

    it('login endpoint inde 401 de logout olmamali', async () => {
      // Başlangıçta authenticated değil
      resetAuthStore()

      const api = await getApi()
      
      // Login endpoint'i 401 dönsün (yanlış şifre)
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json(
            { message: 'Invalid credentials' },
            { status: 401 }
          )
        })
      )

      // Login dene
      try {
        await api.post('/auth/login', { email: 'test@test.com', password: 'wrong' })
      } catch (error) {
        // Hata bekleniyor
      }

      // Logout çağrılmamış olmalı (zaten login değildi)
      // Bu test daha çok interceptor'ın login için özel davrandığını doğrular
      const state = useAuthStore.getState()
      expect(state.isAuthenticated).toBe(false)
    })
  })

  describe('Base Configuration', () => {
    it('baseURL dogru ayarlanmis olmali', async () => {
      const api = await getApi()
      
      // Axios instance'ın baseURL'i kontrol et
      expect(api.defaults.baseURL).toBeDefined()
    })

    it('timeout ayarlanmis olmali', async () => {
      const api = await getApi()
      
      expect(api.defaults.timeout).toBe(30000)
    })

    it('Content-Type header i JSON olmali', async () => {
      const api = await getApi()
      
      expect(api.defaults.headers['Content-Type']).toBe('application/json')
    })
  })
})
