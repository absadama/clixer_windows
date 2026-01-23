# Enterprise Service Manager - Test & Kullanım Kılavuzu

## Kurulum Tamamlandı ✅

### Eklenen Dosyalar
1. `shared/src/service-manager.ts` - Platform-agnostic service manager
2. `services/core-service/src/routes/admin.routes.ts` - Updated (start/stop/restart endpoints)
3. `services/data-service/src/routes/etl-worker.routes.ts` - NEW (ETL Worker management)

---

## API Endpoints

### Service Management (Core Service)

#### 1. Start Service
```bash
POST /api/admin/service/:serviceId/start
Authorization: Bearer <admin_token>

# Örnek
POST /api/admin/service/data-service/start
```

**Response:**
```json
{
  "success": true,
  "message": "Data Service başlatıldı",
  "data": {
    "id": "data-service",
    "name": "Data Service",
    "status": "running",
    "pid": 12345,
    "port": 4003
  }
}
```

#### 2. Stop Service
```bash
POST /api/admin/service/:serviceId/stop
Authorization: Bearer <admin_token>

# Örnek
POST /api/admin/service/data-service/stop
```

#### 3. Restart Service
```bash
POST /api/admin/service/:serviceId/restart
Authorization: Bearer <admin_token>

# Örnek
POST /api/admin/service/data-service/restart
```

#### 4. Get All Services Status
```bash
GET /api/admin/services
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "auth-service",
      "name": "Auth Service",
      "status": "running",
      "pid": 11111,
      "port": 4001
    },
    {
      "id": "core-service",
      "name": "Core Service",
      "status": "running",
      "pid": 22222,
      "port": 4002
    },
    ...
  ]
}
```

---

### ETL Worker Management (Data Service)

#### 1. Start ETL Worker
```bash
POST /api/data/etl/worker/start
Authorization: Bearer <admin_token>
```

#### 2. Stop ETL Worker
```bash
POST /api/data/etl/worker/stop
Authorization: Bearer <admin_token>
```

#### 3. Restart ETL Worker
```bash
POST /api/data/etl/worker/restart
Authorization: Bearer <admin_token>
```

#### 4. Get ETL Worker Status
```bash
GET /api/data/etl/worker/status
Authorization: Bearer <token>
```

---

## Desteklenen Servisler

| Service ID | Name | Port |
|------------|------|------|
| `auth-service` | Auth Service | 4001 |
| `core-service` | Core Service | 4002 |
| `data-service` | Data Service | 4003 |
| `notification-service` | Notification Service | 4004 |
| `analytics-service` | Analytics Service | 4005 |
| `etl-worker` | ETL Worker | - |
| `gateway` | API Gateway | 3000 |

---

## Platform Desteği

Service Manager otomatik olarak platformu algılar:

### Windows Development (Şu An)
- `child_process.spawn()` ile process yönetimi
- Port-based health check
- Graceful shutdown (SIGTERM → SIGKILL)

### Linux Production (systemd)
```bash
sudo systemctl start clixer-data-service
sudo systemctl stop clixer-data-service
sudo systemctl restart clixer-data-service
```

### PM2 (Alternative)
```bash
pm2 start clixer-data-service
pm2 stop clixer-data-service
pm2 restart clixer-data-service
```

---

## UI Entegrasyonu

### Mevcut Butonlar Artık Çalışıyor ✅

#### DataPage.tsx - "Worker'ı Başlat" Butonu
**Önce (Satır 4045):**
```typescript
await apiCall('/data/etl/worker/start', { method: 'POST' })
// ❌ 502 Bad Gateway hatası
```

**Şimdi:**
```typescript
await apiCall('/data/etl/worker/start', { method: 'POST' })
// ✅ Gerçekten başlatıyor!
```

#### DataPage.tsx - "Servisi Yeniden Başlat" Butonu
**Önce (Satır 3746):**
```typescript
await apiCall('/admin/service/restart', { 
  method: 'POST',
  body: JSON.stringify({ serviceId: service.id })
})
// ❌ "Manuel terminalden başlatın" mesajı
```

**Şimdi:**
```typescript
// ✅ Gerçekten restart ediyor!
// service.id -> 'data-service', 'analytics-service', vb.
```

---

## Güvenlik

### Audit Logging ✅
Tüm servis yönetim işlemleri audit log'a kaydedilir:
```sql
INSERT INTO audit_logs (
  user_id, tenant_id, action, resource_type, resource_id,
  resource_name, ip_address, user_agent
) VALUES (...)
```

### Authorization ✅
Sadece **ADMIN** rolü servis yönetimi yapabilir.

### Platform Güvenliği
- **Windows**: Process isolation
- **Linux**: systemd user permissions
- **PM2**: PM2 daemon permissions

---

## Troubleshooting

### Problem: Servis başlamıyor
**Çözüm 1:** Port zaten kullanımda mı?
```powershell
Get-NetTCPConnection -LocalPort 4003
```

**Çözüm 2:** Log'ları kontrol et
```bash
# Windows
cd services/data-service
npm run dev

# Log çıktısına bak
```

**Çözüm 3:** Shared modülü güncel mi?
```bash
cd shared
npm run build
```

### Problem: "Servis geçici olarak kullanılamıyor" hatası
**Çözüm:** Gateway'in servise erişimi var mı?
```bash
curl http://localhost:4003/health
```

---

## Gelecek Geliştirmeler (Opsiyonel)

1. **Auto-restart on crash** - Servis çökerse otomatik yeniden başlat
2. **Resource monitoring** - CPU, Memory, Disk kullanımı
3. **Health check scheduling** - Periyodik health check
4. **Graceful restart** - Zero-downtime restart
5. **Service logs streaming** - UI'da real-time log görüntüleme
6. **Docker/K8s support** - Container orchestration

---

## Müşteri İçin

### Artık Terminal'e Gerek Yok! 🎉

**Önce:**
1. Problem görüldü → SSH ile bağlan
2. Terminal'de `cd services/data-service`
3. `npx ts-node-dev ...` komutu çalıştır
4. Sorun mu var? Log'ları kontrol et
5. Yeniden başlat

**Şimdi:**
1. Problem görüldü → Admin Panel'e git
2. "Sistem Monitörü" → "Motor Servisleri"
3. Kırmızı servisi bul
4. "Yeniden Başlat" butonuna tık
5. ✅ Hazır!

---

**Enterprise-grade self-healing platform! 🚀**
