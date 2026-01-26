# Clixer v4.36+ Hızlı Deploy Rehberi

## Tek Komutla Migration

```bash
cd /opt/clixer
sudo git pull origin master
sudo bash deploy/migrate-v436.sh
```

---

## Manuel Adımlar (Migration script sonrası)

### 1. .env Kontrolü
```bash
# ENCRYPTION_KEY yoksa ekle:
echo "ENCRYPTION_KEY=$(openssl rand -hex 32)" | sudo tee -a /opt/clixer/.env

# JWT_SECRET 32+ karakter olmalı
# CORS_ORIGIN=https://YOUR_DOMAIN.com olmalı (* DEĞİL!)
```

### 2. Frontend Build
```bash
cd /opt/clixer/frontend
sudo npm install
sudo npm run build
```

### 3. Servisleri Yeniden Başlat
```bash
sudo systemctl restart clixer-auth clixer-core clixer-data clixer-analytics clixer-etl-worker clixer-notification clixer-gateway
```

### 4. Firewall (İlk kurulumda)
```bash
sudo ufw delete allow 4000/tcp
sudo ufw delete allow 3000/tcp
sudo ufw reload
```

---

## Doğrulama

```bash
# Health check
curl -s http://localhost:4000/health | grep healthy

# Tüm servisler aktif mi?
systemctl is-active clixer-gateway clixer-auth clixer-core clixer-data clixer-analytics
```

---

## Sık Karşılaşılan Hatalar

| Hata | Çözüm |
|------|-------|
| `JWT_SECRET must be at least 32 characters` | .env'de JWT_SECRET'ı uzat |
| `IP_NOT_ALLOWED` | `cd gateway && npm install pg` |
| `column X does not exist` | Migration script'i çalıştır |
| `MODULE_NOT_FOUND pg` | `cd gateway && npm install pg` |
| MSSQL login failed | Bağlantı şifresini yeniden gir |

---

## Dosya Konumları

- Checklist: `deploy/PRODUCTION-DEPLOYMENT-CHECKLIST.md`
- Migration Script: `deploy/migrate-v436.sh`
- DB Migrations: `docker/init-scripts/postgres/migrations/`
- Systemd Services: `/etc/systemd/system/clixer-*.service`
- Env File: `/opt/clixer/.env`
- Logs: `/opt/clixer/logs/`
