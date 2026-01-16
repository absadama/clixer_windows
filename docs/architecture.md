# CLİXER - Mimari Dokümantasyonu

Bu dosya detaylı mimari bilgileri içerir. `.cursorrules` dosyasında özet bilgi var.

---

## Teknoloji Yığını

### Frontend
- React 19 + TypeScript (strict mode)
- Vite (build tool)
- Zustand (state management) - Context API DEĞİL
- TailwindCSS (styling)
- TanStack Virtual (büyük listeler için)
- Recharts (grafikler, lazy loaded)
- Capacitor (native mobile)
- Service Worker + IndexedDB (offline support)

### Backend (Microservices)
- Node.js + Express.js
- TypeScript
- JWT + bcrypt (auth)

### Databases
- **PostgreSQL 15**: Uygulama ayarları (OLTP)
- **ClickHouse**: Analitik veriler (OLAP)
- **Redis**: Cache + Pub/Sub + Queue

### Infrastructure
- Docker + Docker Compose
- Bull Queue (job processing)
- WebSocket (Socket.io)
- systemd (production service management)

---

## Microservices Mimarisi

| Servis | Port | Sorumluluk |
|--------|------|------------|
| gateway | 4000 | API routing, proxy, health check |
| auth-service | 4001 | Login, JWT, 2FA, Şifre sıfırlama |
| core-service | 4002 | Users, Tenants, Designs, Components, Settings, Labels |
| data-service | 4003 | Connections, Datasets, ETL Jobs, ClickHouse yazma |
| notification-service | 4004 | Alerts, Cron, Email, WebSocket |
| analytics-service | 4005 | KPI okuma, Cache, Aggregation |
| etl-worker | - | Background ETL job processing |

---

## Dizin Yapısı

```
clixer/
├── frontend/                 # React uygulaması
│   ├── src/
│   │   ├── components/       # UI bileşenleri
│   │   ├── pages/            # Sayfa componentleri
│   │   ├── stores/           # Zustand stores
│   │   ├── services/         # API istemcileri
│   │   ├── hooks/            # Custom hooks
│   │   └── utils/            # Yardımcı fonksiyonlar
│   └── public/
├── services/
│   ├── auth-service/
│   ├── core-service/
│   ├── data-service/
│   ├── notification-service/
│   ├── analytics-service/
│   └── etl-worker/
├── shared/                   # Ortak modüller
│   ├── db.ts                 # Database helpers
│   ├── auth.ts               # JWT middleware
│   ├── cache.ts              # Redis helpers
│   ├── errors.ts             # Error classes
│   └── logger.ts             # Structured logging
├── gateway/                  # API Gateway
├── docker/
│   ├── docker-compose.yml
│   └── init-scripts/
├── deploy/
│   ├── install-ubuntu.sh     # Production kurulum
│   └── systemd/              # Service unit files
└── scripts/
    ├── start-all.sh
    ├── stop-all.sh
    ├── restart-all.sh
    └── setup-services.sh
```

---

## Veritabanı Mimarisi

### PostgreSQL (clixer) - Uygulama Ayarları

```sql
-- Kullanıcı ve yetki
users, tenants, roles, permissions, positions

-- Master veriler
regions, stores (bölgeler ve mağazalar)

-- Tasarım
designs, design_widgets, components, grid_designs

-- Veri bağlantıları
data_connections, datasets, etl_jobs, etl_schedules

-- Sistem
system_settings, audit_logs, notifications, labels, menu_permissions

-- LDAP
ldap_config
```

### ClickHouse (clixer_analytics) - Analitik Veriler

```sql
-- ETL ile doldurulan tablolar (dataset bazlı)
-- Her dataset için: ds_{dataset_id} tablosu

-- Materialized Views (pre-aggregation)
-- Partition by month (toYYYYMM)
```

### Kritik Kural
- PostgreSQL = Config, ayarlar, CRUD (sık güncellenen)
- ClickHouse = Analitik, büyük veri, aggregation (append-only)
- **Dashboard ASLA müşteri DB'ye direkt bağlanmaz!**
- Akış: Müşteri DB → ETL → ClickHouse → Dashboard

---

## Veri Akışı

```
┌──────────────────┐
│   Müşteri DB     │ (SQL Server, MySQL, PostgreSQL, vs.)
└────────┬─────────┘
         │
         ▼ ETL Job (data-service)
┌──────────────────┐
│   ClickHouse     │ (Analitik veriler)
└────────┬─────────┘
         │
         ▼ Query
┌──────────────────┐
│   Redis Cache    │ (KPI sonuçları cache)
└────────┬─────────┘
         │
         ▼ API
┌──────────────────┐
│   Dashboard UI   │ (React frontend)
└──────────────────┘
```

---

## Performans Optimizasyonları

### 1. Pre-Aggregation (ClickHouse Materialized Views)
Dashboard açılınca hesaplama YAPILMAZ, veri ETL sırasında aggregated olur.

### 2. Multi-Level Cache (4 Katman)
```
L1: Browser (Service Worker, IndexedDB) → 1ms
L2: CDN/Edge (opsiyonel) → 10ms
L3: Redis (query results) → 5ms
L4: ClickHouse Materialized Views → 50ms
```

### 3. Event-Driven Cache Invalidation
ETL veri yazdığında Redis cache temizlenir, WebSocket ile frontend anında güncellenir.

### 4. CQRS
- Write Path: Müşteri DB → ETL → ClickHouse (yavaş olabilir)
- Read Path: Redis Cache → ClickHouse MV → Dashboard (ultra hızlı)

### 5. Virtual Rendering
Büyük listeler için TanStack Virtual kullanılır (1M+ satır).

---

## API Endpoint Yapısı

### Gateway Routes
```
/api/auth/*     → auth-service (4001)
/api/core/*     → core-service (4002)
/api/data/*     → data-service (4003)
/api/analytics/* → analytics-service (4005)
/health         → gateway health check
```

### Önemli Endpointler
```
POST /api/auth/login              → Login
GET  /api/core/designs            → Tasarım listesi
GET  /api/data/datasets           → Dataset listesi
GET  /api/analytics/kpi           → KPI verileri
POST /api/data/admin/system/restart → Sistem restart (Admin)
```

---

## Frontend Yapısı

### Önemli Sayfalar
| Sayfa | Dosya | Açıklama |
|-------|-------|----------|
| Dashboard | `DashboardPage.tsx` | Ana gösterge paneli |
| Analiz | `AnalysisPage.tsx` | Detaylı analiz |
| Tasarım Stüdyosu | `DesignStudioPage.tsx` | Dashboard tasarımı |
| Admin Panel | `AdminPage.tsx` | Sistem yönetimi |
| Veri Bağlantıları | `DataConnectionsPage.tsx` | ETL ve bağlantılar |

### Önemli Componentler
| Component | Açıklama |
|-----------|----------|
| FilterBar | Bölge/Grup/Mağaza filtresi (DOKUNMA!) |
| EnterpriseDataGrid | Gelişmiş veri tablosu |
| KPIWidget | KPI gösterge kartı |
| ChartWidget | Grafik bileşeni |

### Önemli Store'lar (Zustand)
| Store | Açıklama |
|-------|----------|
| filterStore | Filtre state yönetimi (DOKUNMA!) |
| authStore | Kullanıcı oturumu |
| themeStore | Tema ayarları |
| dashboardStore | Dashboard verileri |

---

## Production Deployment

### Systemd Servisleri
Her mikroservis ayrı systemd unit olarak çalışır:
- `clixer-gateway.service`
- `clixer-auth.service`
- `clixer-core.service`
- `clixer-data.service`
- `clixer-analytics.service`
- `clixer-notification.service`
- `clixer-etl-worker.service`

### Kurulum
```bash
sudo /opt/clixer/scripts/setup-services.sh
```

### Yönetim
```bash
sudo systemctl status clixer-*
sudo systemctl restart clixer-gateway
sudo journalctl -u clixer-data -f
```

### Docker Servisleri
Veritabanları Docker ile çalışır:
```bash
cd /opt/clixer/docker
docker-compose up -d postgres clickhouse redis
```

---

## White-Label Desteği

- Logo: `/opt/clixer/uploads/` dizininde
- Tema: `system_settings` tablosunda
- CSS: TailwindCSS değişkenleri ile

---

## Güvenlik

- JWT token bazlı authentication
- Role-based access control (RBAC)
- Row-level security (RLS) - mağaza bazlı
- LDAP/SSO entegrasyonu
- Rate limiting
- CORS yapılandırması

---
