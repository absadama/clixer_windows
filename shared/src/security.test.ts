/**
 * Security Helper Unit Tests
 * SQL Injection koruması, input validation testleri
 */

import {
  sanitizeTableName,
  sanitizeColumnName,
  sanitizeAggFunction,
  sanitizeDateString,
  sanitizeNumber,
  sanitizeLimit,
  sanitizeOffset,
  isValidEmail,
  isValidUUID,
  sanitizeString,
  containsDangerousSQLKeywords,
  buildSafeWhereCondition,
  validatePassword,
  getPasswordStrength,
  PASSWORD_POLICY,
} from './security'

describe('Security Helpers', () => {
  
  // ============================================
  // SQL INJECTION KORUMASI
  // ============================================
  
  describe('sanitizeTableName', () => {
    it('gecerli tablo adini kabul etmeli', () => {
      expect(sanitizeTableName('users')).toBe('users')
      expect(sanitizeTableName('ds_12345')).toBe('ds_12345')
      expect(sanitizeTableName('clixer.sales_data')).toBe('clixer.sales_data')
    })

    it('gecersiz karakterleri temizlemeli', () => {
      // sanitizeTableName tire (-) karakterine izin verir
      expect(sanitizeTableName('users; DROP TABLE--')).toBe('usersDROPTABLE--')
      expect(sanitizeTableName("users' OR '1'='1")).toBe('usersOR11')
    })

    it('bos veya gecersiz inputta hata firlatmali', () => {
      expect(() => sanitizeTableName('')).toThrow()
      expect(() => sanitizeTableName(null as any)).toThrow()
      expect(() => sanitizeTableName(undefined as any)).toThrow()
    })

    it('cok uzun tablo adini reddetmeli', () => {
      const longName = 'a'.repeat(200)
      expect(() => sanitizeTableName(longName)).toThrow()
    })
  })

  describe('sanitizeColumnName', () => {
    it('gecerli kolon adini kabul etmeli', () => {
      expect(sanitizeColumnName('store_id')).toBe('store_id')
      expect(sanitizeColumnName('totalSales')).toBe('totalSales')
    })

    it('gecersiz karakterleri temizlemeli', () => {
      expect(sanitizeColumnName('column; DROP')).toBe('columnDROP')
      expect(sanitizeColumnName('col.name')).toBe('colname')
    })

    it('bos inputta hata firlatmali', () => {
      expect(() => sanitizeColumnName('')).toThrow()
    })
  })

  describe('sanitizeAggFunction', () => {
    it('whitelist teki fonksiyonlari kabul etmeli', () => {
      expect(sanitizeAggFunction('sum(amount)')).toBe('sum(amount)')
      expect(sanitizeAggFunction('COUNT(id)')).toBe('count(id)')
      expect(sanitizeAggFunction('avg(price)')).toBe('avg(price)')
      expect(sanitizeAggFunction('MAX(quantity)')).toBe('max(quantity)')
    })

    it('whitelist disindaki fonksiyonlari reddetmeli', () => {
      expect(() => sanitizeAggFunction('CONCAT(a,b)')).toThrow()
      expect(() => sanitizeAggFunction('EXEC(command)')).toThrow()
      expect(() => sanitizeAggFunction('SYSTEM(cmd)')).toThrow()
    })

    it('bos inputta hata firlatmali', () => {
      expect(() => sanitizeAggFunction('')).toThrow()
    })
  })

  describe('sanitizeDateString', () => {
    it('gecerli tarih formatini kabul etmeli', () => {
      expect(sanitizeDateString('2024-01-15')).toBe('2024-01-15')
      expect(sanitizeDateString('2024-12-31 23:59:59')).toBe('2024-12-31 23:59:59')
    })

    it('gecersiz tarih formatini reddetmeli', () => {
      expect(() => sanitizeDateString('15-01-2024')).toThrow()
      expect(() => sanitizeDateString('2024/01/15')).toThrow()
      expect(() => sanitizeDateString('not-a-date')).toThrow()
    })

    it('bos inputta hata firlatmali', () => {
      expect(() => sanitizeDateString('')).toThrow()
    })
  })

  describe('sanitizeNumber', () => {
    it('gecerli sayilari dondurmeli', () => {
      expect(sanitizeNumber(42)).toBe(42)
      expect(sanitizeNumber('100')).toBe(100)
      expect(sanitizeNumber(3.14)).toBe(3.14)
    })

    it('gecersiz degerler icin default dondurmeli', () => {
      expect(sanitizeNumber('abc')).toBe(0)
      expect(sanitizeNumber(null)).toBe(0)
      expect(sanitizeNumber(undefined)).toBe(0)
      expect(sanitizeNumber(NaN)).toBe(0)
      expect(sanitizeNumber(Infinity)).toBe(0)
    })

    it('ozel default deger kullanabilmeli', () => {
      expect(sanitizeNumber('abc', 10)).toBe(10)
      expect(sanitizeNumber(null, -1)).toBe(-1)
    })
  })

  describe('sanitizeLimit', () => {
    it('gecerli limiti dondurmeli', () => {
      expect(sanitizeLimit(50)).toBe(50)
      expect(sanitizeLimit(100)).toBe(100)
    })

    it('maksimum limiti asmamali', () => {
      expect(sanitizeLimit(50000)).toBe(10000) // default max
      expect(sanitizeLimit(200, 100)).toBe(100) // custom max
    })

    it('minimum 1 olmali', () => {
      expect(sanitizeLimit(0)).toBe(1)
      expect(sanitizeLimit(-10)).toBe(1)
    })
  })

  describe('sanitizeOffset', () => {
    it('gecerli offset dondurmeli', () => {
      expect(sanitizeOffset(0)).toBe(0)
      expect(sanitizeOffset(100)).toBe(100)
    })

    it('negatif offset icin 0 dondurmeli', () => {
      expect(sanitizeOffset(-10)).toBe(0)
    })
  })

  // ============================================
  // INPUT VALIDATION
  // ============================================

  describe('isValidEmail', () => {
    it('gecerli email adreslerini kabul etmeli', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
      expect(isValidEmail('user+tag@gmail.com')).toBe(true)
    })

    it('gecersiz email adreslerini reddetmeli', () => {
      expect(isValidEmail('invalid')).toBe(false)
      expect(isValidEmail('no@domain')).toBe(false)
      expect(isValidEmail('@nodomain.com')).toBe(false)
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail(null as any)).toBe(false)
    })
  })

  describe('isValidUUID', () => {
    it('gecerli UUID leri kabul etmeli', () => {
      expect(isValidUUID('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
      expect(isValidUUID('6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(true)
    })

    it('gecersiz UUID leri reddetmeli', () => {
      expect(isValidUUID('not-a-uuid')).toBe(false)
      expect(isValidUUID('550e8400-e29b-41d4-a716')).toBe(false) // too short
      expect(isValidUUID('')).toBe(false)
      expect(isValidUUID(null as any)).toBe(false)
    })
  })

  describe('sanitizeString', () => {
    it('HTML karakterlerini escape etmeli', () => {
      expect(sanitizeString('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
      expect(sanitizeString("it's a test")).toBe("it&#x27;s a test")
      expect(sanitizeString('a & b')).toBe('a &amp; b')
    })

    it('maksimum uzunlugu asmamali', () => {
      const longString = 'a'.repeat(2000)
      expect(sanitizeString(longString, 100).length).toBe(100)
    })

    it('bos veya gecersiz inputta bos string dondurmeli', () => {
      expect(sanitizeString('')).toBe('')
      expect(sanitizeString(null as any)).toBe('')
      expect(sanitizeString(undefined as any)).toBe('')
    })
  })

  describe('containsDangerousSQLKeywords', () => {
    it('tehlikeli keyword leri tespit etmeli', () => {
      expect(containsDangerousSQLKeywords('DROP TABLE users')).toBe(true)
      expect(containsDangerousSQLKeywords('DELETE FROM data')).toBe(true)
      expect(containsDangerousSQLKeywords("'; EXEC sp_MSforeachtable")).toBe(true)
      expect(containsDangerousSQLKeywords('SELECT * FROM users; --')).toBe(true)
      expect(containsDangerousSQLKeywords('UNION SELECT password')).toBe(true)
    })

    it('guvenli string leri kabul etmeli', () => {
      expect(containsDangerousSQLKeywords('normal search term')).toBe(false)
      expect(containsDangerousSQLKeywords('Kadıköy Mağaza')).toBe(false)
      expect(containsDangerousSQLKeywords('2024-01-15')).toBe(false)
    })
  })

  describe('buildSafeWhereCondition', () => {
    it('sayi degerler icin guvenli kosul olusturmali', () => {
      expect(buildSafeWhereCondition('store_id', 123)).toBe('store_id = 123')
      expect(buildSafeWhereCondition('amount', 99.5, '>')).toBe('amount > 99.5')
    })

    it('string degerler icin guvenli kosul olusturmali', () => {
      expect(buildSafeWhereCondition('name', 'Kadıköy')).toBe("name = 'Kadıköy'")
    })

    it('SQL injection denemelerini engellemeli', () => {
      const result = buildSafeWhereCondition('name', "test'; DROP TABLE--")
      expect(result).toBe("name = 'test''; DROP TABLE--'")
      // Tek tırnak escape edilmiş olmalı
    })
  })

  // ============================================
  // PASSWORD POLICY
  // ============================================

  describe('validatePassword', () => {
    it('guclu sifreleri kabul etmeli', () => {
      const result = validatePassword('SecurePass123!')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('kisa sifreleri reddetmeli', () => {
      const result = validatePassword('Ab1!')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('en az'))).toBe(true)
    })

    it('buyuk harf olmayan sifreleri reddetmeli', () => {
      const result = validatePassword('lowercase123!')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('büyük harf'))).toBe(true)
    })

    it('kucuk harf olmayan sifreleri reddetmeli', () => {
      const result = validatePassword('UPPERCASE123!')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('küçük harf'))).toBe(true)
    })

    it('rakam olmayan sifreleri reddetmeli', () => {
      const result = validatePassword('NoNumbers!')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('rakam'))).toBe(true)
    })

    it('ozel karakter olmayan sifreleri reddetmeli', () => {
      const result = validatePassword('NoSpecial123')
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('özel karakter'))).toBe(true)
    })

    it('sifre gucunu dogru hesaplamali', () => {
      const weak = validatePassword('weak')
      const medium = validatePassword('Medium1!')
      const strong = validatePassword('StrongPass123!')
      const veryStrong = validatePassword('VeryStrongPassword123!@#')

      expect(weak.strength).toBe('weak')
      expect(['medium', 'strong'].includes(medium.strength)).toBe(true)
      expect(['strong', 'very_strong'].includes(veryStrong.strength)).toBe(true)
    })
  })

  describe('getPasswordStrength', () => {
    it('sifre gucunu yuzde olarak dondurmeli', () => {
      expect(getPasswordStrength('weak')).toBeLessThan(50)
      expect(getPasswordStrength('StrongPass123!')).toBeGreaterThan(50)
      expect(getPasswordStrength('VeryStrongPassword123!@#')).toBeGreaterThanOrEqual(85)
    })
  })

  describe('PASSWORD_POLICY', () => {
    it('policy degerleri dogru tanimlanmis olmali', () => {
      expect(PASSWORD_POLICY.minLength).toBe(8)
      expect(PASSWORD_POLICY.requireUppercase).toBe(true)
      expect(PASSWORD_POLICY.requireLowercase).toBe(true)
      expect(PASSWORD_POLICY.requireNumber).toBe(true)
      expect(PASSWORD_POLICY.requireSpecial).toBe(true)
    })
  })
})
