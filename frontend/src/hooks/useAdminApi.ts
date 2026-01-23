/**
 * Admin API Hook
 * Centralized API calls for AdminPage
 */

import { useCallback } from 'react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../stores/authStore'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

interface ApiOptions extends RequestInit {
  showSuccessToast?: boolean
  showErrorToast?: boolean
  successMessage?: string
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
}

export function useAdminApi() {
  const { accessToken } = useAuthStore()

  /**
   * Generic API call with error handling
   */
  const apiCall = useCallback(async <T = any>(
    endpoint: string, 
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> => {
    const { 
      showSuccessToast = false, 
      showErrorToast = true,
      successMessage,
      ...fetchOptions 
    } = options

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
          ...fetchOptions.headers,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'API hatası')
      }

      if (showSuccessToast && successMessage) {
        toast.success(successMessage)
      }

      return { success: true, data: data.data, message: data.message }
    } catch (err: any) {
      if (showErrorToast) {
        toast.error(err.message || 'Bir hata oluştu')
      }
      return { success: false, message: err.message }
    }
  }, [accessToken])

  // ============================================
  // SETTINGS API
  // ============================================

  const getSettings = useCallback(async () => {
    return apiCall('/core/settings')
  }, [apiCall])

  const updateSetting = useCallback(async (key: string, value: any) => {
    return apiCall(`/core/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
      showSuccessToast: true,
      successMessage: 'Ayar güncellendi'
    })
  }, [apiCall])

  const createSetting = useCallback(async (data: any) => {
    return apiCall('/core/settings', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Ayar oluşturuldu'
    })
  }, [apiCall])

  const deleteSetting = useCallback(async (key: string) => {
    return apiCall(`/core/settings/${key}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Ayar silindi'
    })
  }, [apiCall])

  // ============================================
  // USERS API
  // ============================================

  const getUsers = useCallback(async () => {
    return apiCall('/core/users')
  }, [apiCall])

  const createUser = useCallback(async (data: any) => {
    return apiCall('/core/users', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Kullanıcı oluşturuldu'
    })
  }, [apiCall])

  const updateUser = useCallback(async (id: string, data: any) => {
    return apiCall(`/core/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Kullanıcı güncellendi'
    })
  }, [apiCall])

  const deleteUser = useCallback(async (id: string) => {
    return apiCall(`/core/users/${id}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Kullanıcı silindi'
    })
  }, [apiCall])

  // ============================================
  // MASTER DATA API (Stores, Regions, Groups)
  // ============================================

  const getStores = useCallback(async () => {
    return apiCall('/core/stores')
  }, [apiCall])

  const createStore = useCallback(async (data: any) => {
    return apiCall('/core/stores', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Mağaza oluşturuldu'
    })
  }, [apiCall])

  const updateStore = useCallback(async (id: string, data: any) => {
    return apiCall(`/core/stores/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Mağaza güncellendi'
    })
  }, [apiCall])

  const deleteStore = useCallback(async (id: string) => {
    return apiCall(`/core/stores/${id}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Mağaza silindi'
    })
  }, [apiCall])

  const getRegions = useCallback(async () => {
    return apiCall('/core/regions')
  }, [apiCall])

  const createRegion = useCallback(async (data: any) => {
    return apiCall('/core/regions', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Bölge oluşturuldu'
    })
  }, [apiCall])

  const updateRegion = useCallback(async (id: string, data: any) => {
    return apiCall(`/core/regions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Bölge güncellendi'
    })
  }, [apiCall])

  const deleteRegion = useCallback(async (id: string) => {
    return apiCall(`/core/regions/${id}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Bölge silindi'
    })
  }, [apiCall])

  const getGroups = useCallback(async () => {
    return apiCall('/core/groups')
  }, [apiCall])

  const createGroup = useCallback(async (data: any) => {
    return apiCall('/core/groups', {
      method: 'POST',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Grup oluşturuldu'
    })
  }, [apiCall])

  const updateGroup = useCallback(async (id: string, data: any) => {
    return apiCall(`/core/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'Grup güncellendi'
    })
  }, [apiCall])

  const deleteGroup = useCallback(async (id: string) => {
    return apiCall(`/core/groups/${id}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Grup silindi'
    })
  }, [apiCall])

  // ============================================
  // LDAP API
  // ============================================

  const getLdapConfig = useCallback(async () => {
    return apiCall('/core/ldap/config')
  }, [apiCall])

  const updateLdapConfig = useCallback(async (data: any) => {
    return apiCall('/core/ldap/config', {
      method: 'PUT',
      body: JSON.stringify(data),
      showSuccessToast: true,
      successMessage: 'LDAP ayarları güncellendi'
    })
  }, [apiCall])

  const testLdapConnection = useCallback(async () => {
    return apiCall('/core/ldap/test', {
      method: 'POST',
      showErrorToast: false
    })
  }, [apiCall])

  const syncLdapUsers = useCallback(async () => {
    return apiCall('/core/ldap/sync', {
      method: 'POST',
      showSuccessToast: true,
      successMessage: 'LDAP senkronizasyonu başlatıldı'
    })
  }, [apiCall])

  // ============================================
  // BACKUP API
  // ============================================

  const getBackups = useCallback(async () => {
    return apiCall('/data/admin/backup/list')
  }, [apiCall])

  const createBackup = useCallback(async () => {
    return apiCall('/data/admin/backup/create', {
      method: 'POST',
      showSuccessToast: true,
      successMessage: 'Yedekleme başlatıldı'
    })
  }, [apiCall])

  // ============================================
  // SESSIONS API
  // ============================================

  const getSessions = useCallback(async () => {
    return apiCall('/data/admin/sessions')
  }, [apiCall])

  const terminateSession = useCallback(async (userId: string) => {
    return apiCall(`/data/admin/sessions/${userId}`, {
      method: 'DELETE',
      showSuccessToast: true,
      successMessage: 'Oturum sonlandırıldı'
    })
  }, [apiCall])

  // ============================================
  // SYSTEM API
  // ============================================

  const restartSystem = useCallback(async () => {
    return apiCall('/data/admin/system/restart', {
      method: 'POST',
      showSuccessToast: true,
      successMessage: 'Sistem yeniden başlatılıyor'
    })
  }, [apiCall])

  const getRedisInfo = useCallback(async () => {
    return apiCall('/data/cache/info')
  }, [apiCall])

  const clearCache = useCallback(async (pattern?: string) => {
    return apiCall('/data/cache/clear', {
      method: 'POST',
      body: JSON.stringify({ pattern }),
      showSuccessToast: true,
      successMessage: 'Cache temizlendi'
    })
  }, [apiCall])

  return {
    // Generic
    apiCall,
    
    // Settings
    getSettings,
    updateSetting,
    createSetting,
    deleteSetting,
    
    // Users
    getUsers,
    createUser,
    updateUser,
    deleteUser,
    
    // Stores
    getStores,
    createStore,
    updateStore,
    deleteStore,
    
    // Regions
    getRegions,
    createRegion,
    updateRegion,
    deleteRegion,
    
    // Groups
    getGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    
    // LDAP
    getLdapConfig,
    updateLdapConfig,
    testLdapConnection,
    syncLdapUsers,
    
    // Backup
    getBackups,
    createBackup,
    
    // Sessions
    getSessions,
    terminateSession,
    
    // System
    restartSystem,
    getRedisInfo,
    clearCache
  }
}

export type AdminApi = ReturnType<typeof useAdminApi>
