# CLIXER - Enterprise Analytics Platform

> "Olağanüstü Veri Hızı" 🚀

Power BI, Tableau ve Qlik'e alternatif enterprise analytics platformu.

## 🎯 Özellikler

- **No-Code ETL**: UI üzerinden veri bağlantısı, dataset ve ETL yapılandırması
- **ClickHouse Embed**: Ultra hızlı analitik sorgular
- **Real-time Dashboard**: WebSocket ile anlık güncelleme
- **Multi-Tenant**: İzole tenant yapısı
- **RBAC**: Rol bazlı erişim kontrolü
- **Mobile Ready**: Capacitor ile native app desteği

## 🏗️ Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                   (React + Zustand)                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY                             │
│                    (Port 4000)                               │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Auth Service  │   │ Core Service  │   │ Data Service  │
│   (4001)      │   │   (4002)      │   │   (4003)      │
└───────────────┘   └───────────────┘   └───────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────────────────────────────────────────────────┐
│                     DATABASES                              │
│  PostgreSQL (Config) │ ClickHouse (Analytics) │ Redis     │
└───────────────────────────────────────────────────────────┘
```

## 🚀 Hızlı Başlangıç

### Gereksinimler
- **Docker Desktop** (PostgreSQL, ClickHouse, Redis için)
- **Node.js 18+**
- **Git**

---

### Windows Kurulumu

```batch
git clone https://github.com/absadama/clixer.git
cd clixer
setup-windows.bat     # Docker container'ları başlat (bir kez)
start-services.bat    # Servisleri başlat
```

Durdurmak için: `stop-services.bat`

> ⚠️ Detaylı kurulum için: [README-WINDOWS.md](README-WINDOWS.md)

---

### Mac/Linux Kurulumu (Tek Komut)

```bash
git clone https://github.com/absadama/clixer.git
cd clixer
chmod +x install.sh scripts/*.sh
./install.sh              # Tüm bağımlılıkları kur (bir kez)
./scripts/start-all.sh    # Servisleri başlat
```

Durdurmak için: `./scripts/stop-all.sh`

---

### Tarayıcıda Aç
http://localhost:3000

**Admin Kullanıcı:**
- Email: admin@clixer
- Şifre: Admin1234!

## 📂 Proje Yapısı

```
clixer/
├── frontend/           # React uygulaması
├── gateway/            # API Gateway
├── services/
│   ├── auth-service/      # Auth (4001)
│   ├── core-service/      # Users, Designs (4002)
│   ├── data-service/      # Connections, ETL (4003)
│   ├── notification-service/ # Alerts (4004)
│   ├── analytics-service/ # KPI (4005)
│   └── etl-worker/        # Background ETL
├── shared/             # Ortak modüller
├── docker/             # Docker configs
├── scripts/            # Utility scripts
└── backupapp/          # Yedekler
```

## 🔧 Portlar

| Servis | Port |
|--------|------|
| Frontend | 3000 |
| Gateway | 4000 |
| Auth | 4001 |
| Core | 4002 |
| Data | 4003 |
| Notification | 4004 |
| Analytics | 4005 |
| PostgreSQL | 5432 |
| ClickHouse | 8123 |
| Redis | 6379 |

## 📝 Teknolojiler

**Frontend:** React 18, TypeScript, Zustand, TailwindCSS, Recharts  
**Backend:** Node.js, Express, TypeScript  
**Databases:** PostgreSQL 15, ClickHouse, Redis 7  
**Infrastructure:** Docker, Docker Compose

## 📄 Lisans

© 2025 Clixer Analytics. All rights reserved.
