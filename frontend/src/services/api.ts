import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuthStore } from '../stores/authStore'

const baseURL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token refresh durumu - çoklu istek sırasında tek refresh yapılmasını sağlar
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value?: unknown) => void
  reject: (reason?: any) => void
}> = []

const processQueue = (error: any = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

// Request interceptor - Add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState()
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor - Token refresh with retry
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError<{ message?: string; errorCode?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // Login/refresh endpoint'inde 401 dönerse direkt reject (sonsuz döngü önleme)
    const isAuthRequest = originalRequest?.url?.includes('/auth/login') || 
                          originalRequest?.url?.includes('/auth/refresh')
    
    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
      // Token expired - refresh dene
      
      if (isRefreshing) {
        // Zaten refresh yapılıyor, kuyruğa ekle
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => {
          // Refresh başarılı, yeni token ile tekrar dene
          const { accessToken } = useAuthStore.getState()
          if (accessToken) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
          }
          return api(originalRequest)
        })
      }
      
      originalRequest._retry = true
      isRefreshing = true
      
      try {
        const refreshed = await useAuthStore.getState().refreshAccessToken()
        
        if (refreshed) {
          processQueue()
          
          // Yeni token ile isteği tekrarla
          const { accessToken } = useAuthStore.getState()
          if (accessToken) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`
          }
          return api(originalRequest)
        } else {
          // Refresh başarısız - logout
          processQueue(new Error('Token refresh failed'))
          useAuthStore.getState().logout()
          return Promise.reject(error)
        }
      } catch (refreshError) {
        processQueue(refreshError)
        useAuthStore.getState().logout()
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }
    
    return Promise.reject(error)
  }
)

export default api
