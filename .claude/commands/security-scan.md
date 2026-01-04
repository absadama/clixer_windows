# /security-scan - Güvenlik Taraması

Kod ve konfigürasyonda güvenlik açıklarını tara.

## Kontrol Listesi

### 1. Hassas Veri Kontrolü
```bash
# .env dosyası gitignore'da mı?
grep -q "^\.env$" .gitignore && echo "✅ .env gitignore'da" || echo "❌ .env EKSİK!"

# Hardcoded şifre var mı?
echo "Hardcoded password araması:"
grep -rn "password\s*=\s*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" | grep -v node_modules | grep -v ".env" | head -10

# API key leak kontrolü
echo "API key araması:"
grep -rn "api[_-]?key\s*=\s*['\"]" --include="*.ts" --include="*.tsx" --include="*.js" | grep -v node_modules | head -10
```

### 2. Güvenlik Header Kontrolü
```bash
# Helmet.js aktif mi?
curl -sI http://localhost:4000/health | grep -i "x-content-type-options"
curl -sI http://localhost:4000/health | grep -i "x-frame-options"
curl -sI http://localhost:4000/health | grep -i "strict-transport-security"
```

### 3. CORS Kontrolü
```bash
# CORS header kontrolü
curl -sI http://localhost:4000/health -H "Origin: http://localhost:3000" | grep -i "access-control"
```

### 4. Rate Limiting
```bash
# Rate limit header kontrolü
curl -sI http://localhost:4000/health | grep -i "x-ratelimit"
```

### 5. JWT Kontrolü
```bash
# JWT secret .env'de mi?
grep -q "JWT_SECRET" .env && echo "✅ JWT_SECRET .env'de" || echo "❌ JWT_SECRET EKSİK!"
```

### 6. Bağımlılık Güvenliği
```bash
# npm audit (known vulnerabilities)
cd frontend && npm audit --audit-level=high
cd ../gateway && npm audit --audit-level=high
cd ../services/auth-service && npm audit --audit-level=high
```

## Güvenlik Skoru

| Kontrol | Durum |
|---------|-------|
| .env gitignore | ✅/❌ |
| Hardcoded secrets | ✅/❌ |
| Helmet.js | ✅/❌ |
| CORS | ✅/❌ |
| Rate Limiting | ✅/❌ |
| JWT Secret | ✅/❌ |
| npm audit | ✅/❌ |

**Tüm kontroller ✅ olmalı!**

