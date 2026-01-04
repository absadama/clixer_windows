# verify-app Agent

Clixer uygulamasının tam çalışır durumda olduğunu doğrular.

## Görev

End-to-end uygulama doğrulaması yapar:
1. Frontend erişilebilir mi?
2. API Gateway çalışıyor mu?
3. Tüm microservisler aktif mi?
4. Login akışı çalışıyor mu?
5. Token doğrulama başarılı mı?

## Kontrol Komutları

### Frontend Kontrolü
```bash
curl -sf http://localhost:3000 > /dev/null && echo "✅ Frontend OK" || echo "❌ Frontend FAIL"
```

### API Gateway Kontrolü
```bash
curl -sf http://localhost:4000/health && echo "✅ Gateway OK" || echo "❌ Gateway FAIL"
```

### Microservice Kontrolü
```bash
for port in 4001 4002 4003 4004 4005; do
  curl -sf http://localhost:$port/health && echo "✅ Port $port OK" || echo "❌ Port $port FAIL"
done
```

### Login Test
```bash
TOKEN=$(curl -sf -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@clixer","password":"Admin1234!"}' | jq -r '.data.accessToken')

if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
  echo "✅ Login OK, token alındı"
  
  # Me endpoint test
  USER=$(curl -sf http://localhost:4000/api/auth/me \
    -H "Authorization: Bearer $TOKEN" | jq -r '.data.email')
  echo "✅ User doğrulandı: $USER"
else
  echo "❌ Login FAIL"
fi
```

## Beklenen Sonuç

```
✅ Frontend OK
✅ Gateway OK
✅ Port 4001 OK (Auth)
✅ Port 4002 OK (Core)
✅ Port 4003 OK (Data)
✅ Port 4004 OK (Notification)
✅ Port 4005 OK (Analytics)
✅ Login OK, token alındı
✅ User doğrulandı: admin@clixer
```

## Hata Durumunda

| Hata | Çözüm |
|------|-------|
| Frontend FAIL | `cd frontend && npm run dev` |
| Gateway FAIL | `cd gateway && npm run dev` |
| Service FAIL | İlgili servisi yeniden başlat |
| Login FAIL | Auth service loglarını kontrol et |
| Token FAIL | JWT_SECRET .env'de mi? |
