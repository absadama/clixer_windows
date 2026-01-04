# Clixer - Windows Kurulum Kılavuzu

## 📋 Gereksinimler

| Yazılım | Versiyon | İndirme |
|---------|----------|---------|
| **Docker Desktop** | 4.0+ | [İndir](https://www.docker.com/products/docker-desktop/) |
| **Node.js** | 18+ LTS | [İndir](https://nodejs.org/) |
| **Git** | 2.0+ | [İndir](https://git-scm.com/download/win) |

## 🚀 Hızlı Kurulum

### Adım 1: Docker Desktop'ı Başlatın
- Docker Desktop uygulamasını açın
- Yeşil "Running" durumuna geçmesini bekleyin

### Adım 2: Projeyi İndirin
```cmd
git clone https://github.com/YOUR_USERNAME/clixer.git
cd clixer
```

### Adım 3: Docker Container'ları Başlatın
```cmd
setup-windows.bat
```
Bu script:
- Docker'ı kontrol eder
- PostgreSQL, ClickHouse, Redis container'larını başlatır
- Veritabanlarını hazırlar

### Adım 4: Servisleri Başlatın
```cmd
start-services.bat
```
Bu script:
- Shared modülü derler
- Tüm backend servisleri başlatır
- Frontend'i başlatır

### Adım 5: Tarayıcıda Açın
```
http://localhost:3000
```

**Giriş Bilgileri:**
- Email: `admin@clixer`
- Şifre: `Admin1234!`

## 📦 Servis Portları

| Servis | Port | Açıklama |
|--------|------|----------|
| Frontend | 3000 | React Web UI |
| Gateway | 4000 | API Gateway |
| Auth | 4001 | Kimlik Doğrulama |
| Core | 4002 | Kullanıcı/Tenant/Tasarım |
| Data | 4003 | Veri Bağlantıları/ETL |
| Notification | 4004 | Bildirimler |
| Analytics | 4005 | Metrik/Dashboard |
| PostgreSQL | 5432 | Uygulama DB |
| ClickHouse | 8123 | Analitik DB |
| Redis | 6379 | Cache |

## ⚠️ Sorun Giderme

### "Docker Desktop is not running"
1. Docker Desktop uygulamasını açın
2. Sistem tepsisinde Docker ikonunun yeşil olmasını bekleyin
3. Tekrar deneyin

### "Port already in use"
```cmd
netstat -ano | findstr :3000
taskkill /PID [PID_NUMARASI] /F
```

### "npm install failed"
1. Node.js'in yüklü olduğundan emin olun: `node --version`
2. npm cache temizleyin: `npm cache clean --force`
3. node_modules silin ve tekrar deneyin

### "Cannot connect to database"
1. Docker container'ların çalıştığını kontrol edin:
```cmd
docker ps
```
2. Container'ları yeniden başlatın:
```cmd
cd docker
docker-compose restart
```

## 🔧 Geliştirme Modunda Çalıştırma

Her servisi ayrı terminal penceresinde manuel olarak başlatabilirsiniz:

```cmd
REM Terminal 1 - Docker
cd docker
docker-compose up -d

REM Terminal 2 - Shared
cd shared
npm install
npm run build

REM Terminal 3 - Gateway
cd gateway
npm install
npm run dev

REM Terminal 4 - Frontend
cd frontend
npm install
npm run dev

REM ... (diğer servisler için benzer)
```

## 🛑 Durdurma

```cmd
stop-services.bat
```

Veya manuel olarak:
```cmd
REM Node.js işlemlerini sonlandır
taskkill /f /im node.exe

REM Docker container'ları durdur
cd docker
docker-compose stop
```

## 📁 Klasör Yapısı

```
clixer/
├── docker/                 # Docker Compose dosyaları
├── frontend/               # React uygulaması
├── gateway/                # API Gateway
├── services/
│   ├── auth-service/       # Kimlik doğrulama
│   ├── core-service/       # Kullanıcı/Tenant
│   ├── data-service/       # Veri bağlantıları
│   ├── analytics-service/  # Metrikler
│   ├── notification-service/
│   └── etl-worker/         # ETL işlemleri
├── shared/                 # Ortak modüller
├── setup-windows.bat       # Windows kurulum scripti
├── start-services.bat      # Servisleri başlat
└── stop-services.bat       # Servisleri durdur
```

## 📝 Notlar

- İlk kurulumda `npm install` biraz uzun sürebilir
- Docker container'ları ilk başlatmada image indireceği için bekleme süresi olabilir
- Tüm veriler Docker volume'larında saklanır, container'lar silinse bile korunur

## 🆘 Destek

Sorun yaşarsanız:
1. Docker loglarını kontrol edin: `docker logs clixer_postgres`
2. Servis loglarını kontrol edin (her servis penceresinde)
3. GitHub Issues açın

