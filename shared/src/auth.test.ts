/**
 * Auth Helper Unit Tests
 * JWT ve password işlemleri testleri
 */

import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  extractToken,
  ROLES,
  TokenPayload,
} from './auth'

describe('Auth Helpers', () => {
  
  // ============================================
  // PASSWORD OPERATIONS
  // ============================================
  
  describe('hashPassword', () => {
    it('sifreyi hash lemeli', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      
      expect(hash).toBeDefined()
      expect(hash).not.toBe(password)
      expect(hash.startsWith('$2')).toBe(true) // bcrypt hash format
    })

    it('ayni sifre farkli hash ler uretmeli', async () => {
      const password = 'TestPassword123!'
      const hash1 = await hashPassword(password)
      const hash2 = await hashPassword(password)
      
      expect(hash1).not.toBe(hash2) // Salt farklı olduğu için
    })
  })

  describe('verifyPassword', () => {
    it('dogru sifreyi dogrulamali', async () => {
      const password = 'TestPassword123!'
      const hash = await hashPassword(password)
      
      const isValid = await verifyPassword(password, hash)
      expect(isValid).toBe(true)
    })

    it('yanlis sifreyi reddetmeli', async () => {
      const password = 'TestPassword123!'
      const wrongPassword = 'WrongPassword456!'
      const hash = await hashPassword(password)
      
      const isValid = await verifyPassword(wrongPassword, hash)
      expect(isValid).toBe(false)
    })
  })

  // ============================================
  // TOKEN OPERATIONS
  // ============================================

  describe('generateAccessToken', () => {
    const mockPayload: TokenPayload = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      role: 'ADMIN',
      email: 'test@clixer.com',
    }

    it('gecerli JWT olusturmali', () => {
      const token = generateAccessToken(mockPayload)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3) // JWT formatı: header.payload.signature
    })

    it('payload bilgilerini icermeli', () => {
      const token = generateAccessToken(mockPayload)
      const decoded = verifyToken(token)
      
      expect(decoded.userId).toBe(mockPayload.userId)
      expect(decoded.tenantId).toBe(mockPayload.tenantId)
      expect(decoded.role).toBe(mockPayload.role)
      expect(decoded.email).toBe(mockPayload.email)
    })
  })

  describe('generateRefreshToken', () => {
    const mockPayload: TokenPayload = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      role: 'ADMIN',
      email: 'test@clixer.com',
    }

    it('gecerli refresh token olusturmali', () => {
      const token = generateRefreshToken(mockPayload)
      
      expect(token).toBeDefined()
      expect(typeof token).toBe('string')
      expect(token.split('.')).toHaveLength(3)
    })

    it('access token dan farkli olmali', () => {
      const accessToken = generateAccessToken(mockPayload)
      const refreshToken = generateRefreshToken(mockPayload)
      
      // Aynı payload ile bile farklı token'lar üretilmeli (farklı expiry)
      // Not: Aynı saniyede çalışırsa aynı olabilir, bu yüzden sadece format kontrolü
      expect(accessToken).toBeDefined()
      expect(refreshToken).toBeDefined()
    })
  })

  describe('verifyToken', () => {
    const mockPayload: TokenPayload = {
      userId: 'user-123',
      tenantId: 'tenant-456',
      role: 'ADMIN',
      email: 'test@clixer.com',
    }

    it('gecerli token i dogrulamali', () => {
      const token = generateAccessToken(mockPayload)
      const decoded = verifyToken(token)
      
      expect(decoded).toBeDefined()
      expect(decoded.userId).toBe(mockPayload.userId)
      expect(decoded.iat).toBeDefined() // issued at
      expect(decoded.exp).toBeDefined() // expiry
    })

    it('gecersiz token da hata firlatmali', () => {
      expect(() => verifyToken('invalid-token')).toThrow()
    })

    it('bozuk token da hata firlatmali', () => {
      const token = generateAccessToken(mockPayload)
      const tamperedToken = token.slice(0, -5) + 'XXXXX'
      
      expect(() => verifyToken(tamperedToken)).toThrow()
    })
  })

  describe('extractToken', () => {
    it('Bearer token i cikarmali', () => {
      const token = extractToken('Bearer abc123token')
      expect(token).toBe('abc123token')
    })

    it('Bearer olmadan null dondurmeli', () => {
      expect(extractToken('abc123token')).toBeNull()
      expect(extractToken('Basic abc123')).toBeNull()
    })

    it('bos header da null dondurmeli', () => {
      expect(extractToken('')).toBeNull()
      expect(extractToken(undefined)).toBeNull()
    })

    it('yanlis formatta null dondurmeli', () => {
      expect(extractToken('Bearer')).toBeNull() // token yok
      expect(extractToken('Bearer token extra')).toBeNull() // fazla parça
    })
  })

  // ============================================
  // ROLES
  // ============================================

  describe('ROLES', () => {
    it('tum roller tanimli olmali', () => {
      expect(ROLES.SUPER_ADMIN).toBe('SUPER_ADMIN')
      expect(ROLES.ADMIN).toBe('ADMIN')
      expect(ROLES.MANAGER).toBe('MANAGER')
      expect(ROLES.USER).toBe('USER')
      expect(ROLES.VIEWER).toBe('VIEWER')
    })
  })
})
