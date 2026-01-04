import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Token refresh işlemi devam ediyorsa bekle
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: any) => void
  reject: (error: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
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

// Response interceptor - Handle errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; errorCode?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    
    // Login veya refresh endpoint'inde 401 dönerse direkt hata dön
    const isAuthRequest = originalRequest?.url?.includes('/auth/login') || 
                          originalRequest?.url?.includes('/auth/refresh')
    
    if (error.response?.status === 401 && !isAuthRequest && !originalRequest._retry) {
      if (isRefreshing) {
        // Başka bir refresh işlemi devam ediyorsa bekle
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch((err) => {
          return Promise.reject(err)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Token yenileme dene
        const success = await useAuthStore.getState().refreshAccessToken()
        
        if (success) {
          const newToken = useAuthStore.getState().accessToken
          processQueue(null, newToken)
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api(originalRequest)
        } else {
          // Refresh başarısız - logout
          processQueue(error, null)
          return Promise.reject(error)
        }
      } catch (refreshError) {
        processQueue(refreshError, null)
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
