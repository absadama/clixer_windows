# Security Audit Agent

## Görev
Güvenlik açıklarını tara, raporla ve düzeltme öner.

## Çalıştırma
```
claude "Güvenlik denetimi yap"
```

## Kontroller

### 1. Bağımlılık Güvenliği
```bash
# npm audit
cd frontend && npm audit
cd ../gateway && npm audit
cd ../services/auth-service && npm audit
cd ../services/core-service && npm audit
cd ../services/data-service && npm audit
cd ../services/analytics-service && npm audit
```

**Kritik/High vulnerability varsa:**
```bash
npm audit fix
```

### 2. Environment Güvenliği
```bash
# .env GitHub'a gitmemiş mi?
git ls-files | grep -E "^\.env$" && echo "UYARI: .env git'te!" || echo "OK"

# .gitignore'da .env var mı?
grep -q "^\.env$" .gitignore && echo "OK" || echo "UYARI: .env gitignore'da değil!"

# Hardcoded şifre kontrolü
grep -rn "password.*=" --include="*.ts" --include="*.tsx" | grep -v "process.env" | grep -v "password:" | head -20
```

### 3. JWT Güvenliği
```bash
# JWT_SECRET güçlü mü? (en az 32 karakter)
JWT_SECRET=$(grep JWT_SECRET .env | cut -d'=' -f2)
[ ${#JWT_SECRET} -ge 32 ] && echo "JWT Secret OK" || echo "UYARI: JWT Secret çok kısa!"

# Token süreleri
grep -rn "expiresIn" --include="*.ts" services/auth-service/
```

### 4. Rate Limiting
```bash
# Gateway'de rate limit var mı?
grep -n "rateLimit" gateway/src/index.ts

# Limitler
grep -A5 "rateLimit" gateway/src/index.ts | grep -E "(max|windowMs)"
```

**Önerilen limitler:**
- Genel: 200 istek/dakika
- Login: 10 istek/15 dakika
- Analytics: 60 istek/dakika

### 5. CORS Kontrolü
```bash
# CORS yapılandırması
grep -A10 "app.use(cors" gateway/src/index.ts
```

**Production'da:**
- `origin: '*'` OLMAMALI
- Spesifik domain'ler tanımlı olmalı

### 6. SQL Injection Kontrolü
```bash
# Parameterized query kullanılıyor mu?
grep -rn "query\|execute" --include="*.ts" services/ | grep -v "\.d\.ts" | head -20

# Template literal ile SQL var mı? (potansiyel risk)
grep -rn '`SELECT\|`INSERT\|`UPDATE\|`DELETE' --include="*.ts" services/ | head -10
```

### 7. Helmet.js Kontrolü
```bash
# Helmet aktif mi?
grep -n "helmet" gateway/src/index.ts

# CSP var mı?
grep -A10 "contentSecurityPolicy" gateway/src/index.ts
```

### 8. Şifre Politikası
```bash
# Password validation var mı?
grep -rn "validatePassword\|password.*policy\|password.*strength" --include="*.ts" shared/

# bcrypt kullanılıyor mu?
grep -rn "bcrypt" --include="*.ts" services/auth-service/
```

### 9. Açık Portlar (Production)
```bash
# Sadece 22, 80, 443 açık olmalı
ufw status

# Veritabanı portları dışarıya kapalı mı?
netstat -tlnp | grep -E "(5432|8123|6379)" | grep -v "127.0.0.1\|::1"
```

### 10. SSL/TLS Kontrolü
```bash
# HTTPS aktif mi?
curl -I https://DOMAIN 2>/dev/null | head -1

# Sertifika geçerlilik
echo | openssl s_client -servername DOMAIN -connect DOMAIN:443 2>/dev/null | openssl x509 -noout -dates
```

## Güvenlik Skoru

| Kategori | Puan | Açıklama |
|----------|------|----------|
| Bağımlılıklar | /20 | npm audit sonucu |
| Environment | /15 | Şifre yönetimi |
| Authentication | /20 | JWT, password |
| Rate Limiting | /10 | DDoS koruması |
| CORS/Headers | /10 | Güvenlik başlıkları |
| SQL Injection | /15 | Input validation |
| Network | /10 | Port güvenliği |
| **TOPLAM** | **/100** | |

## Rapor Formatı

```
╔══════════════════════════════════════════════════════════════╗
║                  GÜVENLİK DENETİM RAPORU                     ║
╠══════════════════════════════════════════════════════════════╣
║ Tarih:          [TARIH]                                      ║
║ Denetçi:        Claude Security Agent                        ║
╠══════════════════════════════════════════════════════════════╣
║ Bağımlılıklar:  ✅ / ⚠️ [X] yüksek risk                      ║
║ Environment:    ✅ / ❌                                       ║
║ JWT:            ✅ / ❌                                       ║
║ Rate Limiting:  ✅ / ❌                                       ║
║ CORS:           ✅ / ❌                                       ║
║ SQL Injection:  ✅ / ⚠️                                       ║
║ Helmet:         ✅ / ❌                                       ║
║ SSL:            ✅ / ❌                                       ║
╠══════════════════════════════════════════════════════════════╣
║ SKOR:           [X]/100                                      ║
║ DURUM:          GÜVENLİ / RİSKLİ / KRİTİK                    ║
╚══════════════════════════════════════════════════════════════╝
```

## Acil Düzeltmeler

1. **Kritik:** npm audit fix çalıştır
2. **Yüksek:** .env'i gitignore'a ekle
3. **Orta:** Rate limit'leri güçlendir
4. **Düşük:** Log rotation ekle

