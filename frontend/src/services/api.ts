import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

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

// Response interceptor - Handle errors
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string; errorCode?: string }>) => {
    // Login endpoint'inde 401 dönerse logout YAPMA (şifre yanlış olabilir)
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    
    if (error.response?.status === 401 && !isLoginRequest) {
      // Token expired - logout
      console.warn('[API] 401 Unauthorized - Logging out')
      useAuthStore.getState().logout()
    }
    return Promise.reject(error)
  }
)

export default api
