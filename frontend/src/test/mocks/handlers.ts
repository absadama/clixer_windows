/**
 * MSW (Mock Service Worker) Handlers
 * API isteklerini mock'lamak için kullanılır
 */

import { http, HttpResponse } from 'msw'

const API_BASE = '/api'

// Mock veriler
export const mockUser = {
  id: 'user-1',
  email: 'test@clixer.com',
  name: 'Test User',
  role: 'ADMIN',
  tenantId: 'tenant-1',
  positionCode: 'MGR',
}

export const mockTokens = {
  accessToken: 'mock-access-token-12345',
  refreshToken: 'mock-refresh-token-67890',
}

export const mockRegions = [
  { id: 'region-1', code: '1', name: 'Marmara' },
  { id: 'region-2', code: '2', name: 'Ege' },
  { id: 'region-3', code: '3', name: 'Akdeniz' },
  { id: 'region-4', code: '4', name: 'İç Anadolu' },
]

export const mockGroups = [
  { id: 'group-1', code: 'MERKEZ', name: 'Merkez Mağazalar', color: '#3B82F6' },
  { id: 'group-2', code: 'FRANCHISE', name: 'Franchise Mağazalar', color: '#10B981' },
]

export const mockStores = [
  { id: 'store-1', code: 'IST001', name: 'Kadıköy Mağaza', store_type: 'MERKEZ', region_id: 'region-1', region_name: 'Marmara', city: 'İstanbul' },
  { id: 'store-2', code: 'IST002', name: 'Beşiktaş Mağaza', store_type: 'MERKEZ', region_id: 'region-1', region_name: 'Marmara', city: 'İstanbul' },
  { id: 'store-3', code: 'IZM001', name: 'Alsancak Mağaza', store_type: 'FRANCHISE', region_id: 'region-2', region_name: 'Ege', city: 'İzmir' },
  { id: 'store-4', code: 'ANK001', name: 'Kızılay Mağaza', store_type: 'MERKEZ', region_id: 'region-4', region_name: 'İç Anadolu', city: 'Ankara' },
]

// API Handlers
export const handlers = [
  // Auth: Login
  http.post(`${API_BASE}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string }
    
    // Başarısız login senaryosu
    if (body.password === 'wrong-password') {
      return HttpResponse.json(
        { success: false, message: 'E-posta veya şifre hatalı' },
        { status: 401 }
      )
    }
    
    // Başarılı login
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        user: mockUser,
      },
    })
  }),

  // Auth: Refresh Token
  http.post(`${API_BASE}/auth/refresh`, async ({ request }) => {
    const body = await request.json() as { refreshToken: string }
    
    // Geçersiz refresh token
    if (body.refreshToken === 'invalid-refresh-token') {
      return HttpResponse.json(
        { success: false, message: 'Geçersiz token' },
        { status: 401 }
      )
    }
    
    // Başarılı refresh
    return HttpResponse.json({
      success: true,
      data: {
        accessToken: 'new-access-token-99999',
      },
    })
  }),

  // Core: Get Regions
  http.get(`${API_BASE}/core/regions`, () => {
    return HttpResponse.json({
      success: true,
      data: mockRegions,
    })
  }),

  // Core: Get Ownership Groups
  http.get(`${API_BASE}/core/ownership-groups`, () => {
    return HttpResponse.json({
      success: true,
      data: mockGroups,
    })
  }),

  // Core: Get Stores
  http.get(`${API_BASE}/core/stores`, () => {
    return HttpResponse.json({
      success: true,
      data: mockStores,
    })
  }),

  // Analytics: KPI (örnek)
  http.get(`${API_BASE}/analytics/kpi`, ({ request }) => {
    const url = new URL(request.url)
    const storeIds = url.searchParams.get('storeIds')
    
    return HttpResponse.json({
      success: true,
      data: {
        totalSales: 1250000,
        transactionCount: 4500,
        averageTicket: 278,
        storeCount: storeIds ? storeIds.split(',').length : 4,
      },
    })
  }),
]

// Hata senaryoları için özel handlers
export const errorHandlers = {
  // Network hatası simülasyonu
  networkError: http.get(`${API_BASE}/core/stores`, () => {
    return HttpResponse.error()
  }),

  // 500 Server Error
  serverError: http.get(`${API_BASE}/core/stores`, () => {
    return HttpResponse.json(
      { success: false, message: 'Internal Server Error' },
      { status: 500 }
    )
  }),

  // 401 Unauthorized (token expired)
  unauthorized: http.get(`${API_BASE}/core/stores`, () => {
    return HttpResponse.json(
      { success: false, message: 'Token expired' },
      { status: 401 }
    )
  }),
}
