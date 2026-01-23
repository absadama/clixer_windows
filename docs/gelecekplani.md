# CLIXER REFACTOR PROJESİ - TAM SOHBET ÖZETİ VE GELECEK PLANI

**Oluşturulma Tarihi:** 23 Ocak 2026  
**Son Güncelleme:** Bu sohbet oturumu  
**Durum:** Yedekleme ve Modüler Yapıya Geçiş planlandı, uygulanmayı bekliyor

---

## BÖLÜM 1: PROJE BİLGİLERİ

### Genel Bilgiler
- **Proje:** Clixer Enterprise Analytics Platform
- **Versiyon:** v4.33
- **Konum:** `C:\projeler\clixer_windows-main`
- **Ortam:** Windows, Docker (PostgreSQL, ClickHouse, Redis)
- **Müşteriler:** 2 müşteri kendi sunucularında (TD, Nişantaşı Üniv) - SaaS değil

### Teknoloji Stack
- **Frontend:** React 19, TypeScript, Vite, Zustand, TailwindCSS
- **Backend:** Node.js, Express, TypeScript
- **Veritabanları:** PostgreSQL (config), ClickHouse (analytics), Redis (cache)
- **Altyapı:** Docker, systemd, Nginx

---

## BÖLÜM 2: YAPILAN KAPSAMLı CODE REVIEW

### 90 Maddelik Analiz Tamamlandı

| Kategori | Kritik | Yüksek | Orta | Toplam |
|----------|--------|--------|------|--------|
| Güvenlik | 10 | 8 | 9 | **27** |
| Mimari | 2 | 5 | 5 | **12** |
| Veritabanı | 3 | 5 | 6 | **14** |
| Frontend | - | 2 | 6 | **8** |
| Performance | - | 3 | 7 | **10** |
| Operasyonel | - | 4 | 8 | **12** |
| İş Mantığı | 2 | 3 | 2 | **7** |
| **TOPLAM** | **17** | **30** | **43** | **90** |

### Kritik Güvenlik Bulguları

#### 1. Cross-Tenant Data Leak
**Dosya:** `services/core-service/src/index.ts`
**Endpoint'ler:**
- `GET /users/:id/categories` (satır 358) - Tenant kontrolü yok
- `PUT /users/:id/categories` (satır 388) - Tenant kontrolü yok
- `POST /users/:id/categories/:categoryId` (satır 424) - Tenant kontrolü yok
- `DELETE /users/:id/categories/:categoryId` (satır 439) - Tenant kontrolü yok

**Sorun:** Herhangi bir authenticated kullanıcı, başka tenant'ların kullanıcılarının kategorilerini okuyabilir/değiştirebilir.

#### 2. Frontend-Only Filtering
**Dosya:** `services/analytics-service/src/index.ts` (GET /designs endpoint)
**Sorun:** Backend tüm tasarımları döndürüyor, filtreleme sadece frontend'de yapılıyor.
**Risk:** API'ye direkt erişimle tüm raporlar görünür.

#### 3. Token Refresh Sorunu
**Dosya:** `services/auth-service/src/index.ts` (satır 317-322)
**Sorun:** Refresh token kullanıldığında yeni token'a `categoryIds`, `canSeeAllCategories`, `filterLevel`, `filterValue` eklenmiyor.
**Risk:** Token refresh sonrası kullanıcı yetkisi değişebilir.

#### 4. Hardcoded Secrets
```typescript
// shared/src/auth.ts:15
const JWT_SECRET = process.env.JWT_SECRET || 'clixer_dev_secret';

// shared/src/db.ts:38
password: config?.password || process.env.POSTGRES_PASSWORD || 'clixer_secret_2025',
```
**Risk:** Environment variable yoksa production'da bile dev secret'lar kullanılır.

#### 5. SSL Validation Disabled
```typescript
// services/data-service/src/index.ts:16
// services/etl-worker/src/index.ts:16
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```
**Risk:** Man-in-the-Middle saldırısına açık.

#### 6. Teknik Borç - Dev Dosyalar
- `core-service/src/index.ts` → 4196 satır, 91 endpoint
- `analytics-service/src/index.ts` → 3739 satır
- `data-service/src/index.ts` → 5143 satır

### Diğer Önemli Bulgular

#### Güvenlik
- CORS wildcard default (`NODE_ENV` yoksa `*`)
- Rate limit bypass (`x-user-id` header manipülasyonu)
- Token localStorage'da (XSS riski)
- Password not encrypted (`password_encrypted` aslında plain text)
- LDAP password Base64 (encryption değil encoding)
- 2FA backup codes güçsüz (6 karakter)
- categoryId validation yok

#### Mimari
- Tenant isolation middleware yetersiz
- Single point of failure (global singletons)
- Shared database anti-pattern
- No health check for dependencies
- Memory leak (event listeners)
- No circuit breaker
- No API versioning

#### Veritabanı
- Missing composite indexes
- No FK on designs.category_id
- Password hash in users table
- No audit trail for sensitive ops
- No migration versioning
- No soft delete
- No connection pooler (PgBouncer)

#### Frontend
- Type safety bypass (`as any` kullanımı)
- No useMemo (her render'da filter)
- Alert() kullanımı
- No error boundaries
- No accessibility (a11y)

#### Operasyonel
- No graceful shutdown
- No structured logging
- No distributed tracing
- Empty env.example
- No CI/CD pipeline
- No test coverage

---

## BÖLÜM 3: ONAYLANAN PLAN

### Aşama 1: Tam Yedekleme

#### 1.1 PostgreSQL Full Backup
```bash
docker exec clixer_postgres pg_dump -U clixer -d clixer > db-backup/postgresql_full_YYYYMMDD.sql
```

#### 1.2 ClickHouse Full Backup
```bash
docker exec clixer_clickhouse clickhouse-client --query "SHOW TABLES FROM clixer_analytics" > db-backup/clickhouse_tables_YYYYMMDD.txt
# Her tablo için CREATE TABLE ve INSERT
```

#### 1.3 Git Tag
```bash
git add -A
git commit -m "Pre-refactor backup v4.33"
git tag v4.33-pre-refactor
```

### Aşama 2: Core-Service Modüler Yapıya Geçiş

#### Mevcut Yapı
```
services/core-service/src/
└── index.ts (4196 satır, 91 endpoint)
```

#### Hedef Yapı
```
services/core-service/src/
├── index.ts                    (50 satır - sadece app setup)
├── routes/
│   ├── index.ts                (tüm route'ları birleştir)
│   ├── health.routes.ts        (1 endpoint)
│   ├── users.routes.ts         (5 endpoint)
│   ├── user-stores.routes.ts   (3 endpoint)
│   ├── user-categories.routes.ts (4 endpoint) ← Tenant isolation düzeltilecek
│   ├── positions.routes.ts     (2 endpoint)
│   ├── stores.routes.ts        (4 endpoint)
│   ├── regions.routes.ts       (4 endpoint)
│   ├── ownership-groups.routes.ts (4 endpoint)
│   ├── report-categories.routes.ts (5 endpoint)
│   ├── store-finance.routes.ts (3 endpoint)
│   ├── tenants.routes.ts       (1 endpoint)
│   ├── designs.routes.ts       (1 endpoint)
│   ├── components.routes.ts    (1 endpoint)
│   ├── settings.routes.ts      (4 endpoint)
│   ├── admin.routes.ts         (sistem sağlık merkezi)
│   ├── ldap.routes.ts          (15 endpoint)
│   ├── geographic.routes.ts    (5 endpoint)
│   ├── labels.routes.ts        (5 endpoint)
│   └── import.routes.ts        (excel/dataset import)
├── services/
│   ├── user.service.ts
│   ├── store.service.ts
│   ├── category.service.ts
│   ├── ldap.service.ts
│   ├── settings.service.ts
│   └── ...
├── validators/
│   ├── user.validator.ts       (Zod schemas)
│   ├── store.validator.ts
│   ├── category.validator.ts
│   └── ...
├── middlewares/
│   └── validate.middleware.ts  (Zod validation middleware)
└── types/
    └── index.ts                (shared interfaces)
```

### Aşama 3: Kararlar

| Karar | Seçim | Neden |
|-------|-------|-------|
| Validation Library | **Zod** | TypeScript-first, modern, otomatik type inference |
| Refactor Sırası | **core-service önce** | En büyük dosya, en çok değişen |
| Test Ortamı | **Lokal** | Production riski yok |

### Aşama 4: Refactor Sırası (Bağımlılık Sırasına Göre)

| Sıra | Dosya | Endpoint | Bağımlılık |
|------|-------|----------|------------|
| 1 | health.routes.ts | 1 | Yok |
| 2 | positions.routes.ts | 2 | Yok |
| 3 | regions.routes.ts | 4 | Yok |
| 4 | ownership-groups.routes.ts | 4 | Yok |
| 5 | stores.routes.ts | 4 | regions |
| 6 | users.routes.ts | 5 | positions |
| 7 | user-stores.routes.ts | 3 | users, stores |
| 8 | report-categories.routes.ts | 5 | Yok |
| 9 | user-categories.routes.ts | 4 | users, report-categories |
| 10 | store-finance.routes.ts | 3 | stores |
| 11 | settings.routes.ts | 4 | Yok |
| 12 | labels.routes.ts | 5 | Yok |
| 13 | geographic.routes.ts | 5 | Yok |
| 14 | tenants.routes.ts | 1 | Yok |
| 15 | designs.routes.ts | 1 | Yok |
| 16 | components.routes.ts | 1 | designs |
| 17 | admin.routes.ts | - | Tüm servisler |
| 18 | ldap.routes.ts | 15 | users, stores, positions |
| 19 | import.routes.ts | 2 | stores, regions |
| 20 | index.ts temizle | - | Tüm route'lar |

### Aşama 5: Zod Entegrasyonu

#### Kurulum
```bash
cd services/core-service
npm install zod
```

#### Örnek Validator
```typescript
// validators/user.validator.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email('Geçerli email giriniz'),
  name: z.string().min(2, 'İsim en az 2 karakter'),
  password: z.string().min(8, 'Şifre en az 8 karakter'),
  role: z.enum(['ADMIN', 'MANAGER', 'USER', 'VIEWER']),
  position_code: z.string().optional()
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

#### Validation Middleware
```typescript
// middlewares/validate.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';

export const validate = (schema: AnyZodObject) => 
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          errors: error.errors.map(e => e.message)
        });
      }
      next(error);
    }
  };
```

---

## BÖLÜM 4: ROLLBACK PLANI

Herhangi bir sorun olursa:

### Git Rollback
```bash
git checkout v4.33-pre-refactor
```

### Database Rollback
```bash
# PostgreSQL
docker exec -i clixer_postgres psql -U clixer -d clixer < db-backup/postgresql_full_YYYYMMDD.sql

# ClickHouse
docker exec -i clixer_clickhouse clickhouse-client < db-backup/clickhouse_full_YYYYMMDD.sql
```

---

## BÖLÜM 5: TODO LİSTESİ

### Yedekleme
- [ ] PostgreSQL tam yedek al (db-backup/postgresql_full_YYYYMMDD.sql)
- [ ] ClickHouse tam yedek al (db-backup/clickhouse_full_YYYYMMDD.sql)
- [ ] Git commit ve tag oluştur (v4.33-pre-refactor)

### Hazırlık
- [ ] core-service'e Zod kütüphanesi ekle
- [ ] routes/, services/, validators/, middlewares/, types/ klasörlerini oluştur
- [ ] Zod validation middleware oluştur

### Route Taşıma (Sırayla)
- [ ] health.routes.ts
- [ ] positions.routes.ts
- [ ] regions.routes.ts
- [ ] ownership-groups.routes.ts
- [ ] stores.routes.ts
- [ ] users.routes.ts
- [ ] user-stores.routes.ts
- [ ] report-categories.routes.ts
- [ ] user-categories.routes.ts (+ tenant isolation fix)
- [ ] store-finance.routes.ts
- [ ] settings.routes.ts
- [ ] labels.routes.ts
- [ ] geographic.routes.ts
- [ ] tenants.routes.ts
- [ ] designs.routes.ts
- [ ] components.routes.ts
- [ ] admin.routes.ts
- [ ] ldap.routes.ts
- [ ] import.routes.ts

### Finalizasyon
- [ ] index.ts temizle - Sadece app setup kalsın
- [ ] Tüm endpoint'leri test et
- [ ] Final commit

---

## BÖLÜM 6: GELECEK ADIMLAR (Modüler Yapıdan Sonra)

### Öncelik 1 - Güvenlik (Hemen)
1. Hardcoded secrets kaldır - Environment variable zorunlu yap
2. SSL validation düzelt - Bağlantı bazlı yap
3. Token refresh düzelt - DB'den güncel yetkileri çek
4. Password encryption - Gerçek encryption uygula

### Öncelik 2 - Analytics Service Refactor
- Aynı modüler yapıyı analytics-service'e uygula

### Öncelik 3 - Data Service Refactor
- Aynı modüler yapıyı data-service'e uygula

### Öncelik 4 - Test Altyapısı
- Unit test kurulumu (Jest/Vitest)
- Integration test kurulumu

### Öncelik 5 - CI/CD
- GitHub Actions pipeline
- Otomatik deployment

---

## BÖLÜM 7: YENİ SOHBETTE KULLANILACAK PROMPT

Yeni sohbet açtığında bu promptu yapıştır:

```
Clixer projesinde kapsamlı code review ve refactor çalışması yapıyoruz.

Proje: C:\projeler\clixer_windows-main
Durum: 90 maddelik analiz tamamlandı, modüler yapıya geçiş planlandı

Detaylar için oku: @docs/gelecekplani.md

Şimdi planı uygulamaya başla:
1. Önce yedekleme yap
2. Sonra core-service'i modüler yapıya geçir
```

---

## BÖLÜM 8: ÖNEMLİ NOTLAR

1. **Docker container'lar çalışıyor** - clixer_postgres, clixer_clickhouse, clixer_redis
2. **Yedekler db-backup/ klasörüne** alınacak
3. **Lokal test ortamı** - Production riski yok
4. **Her route taşındıktan sonra test edilecek**
5. **Sorun olursa rollback yapılabilir**

---

*Bu dosya Cursor AI ile yapılan sohbet oturumundan otomatik oluşturulmuştur.*
