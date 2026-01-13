#!/bin/bash
# PWA Logo Debug Script

echo "=== PWA LOGO DEBUG ==="
echo ""

echo "1. Logo dosyaları mevcut mu?"
echo "----------------------------"
ls -la /opt/clixer/uploads/ 2>/dev/null || echo "❌ /opt/clixer/uploads/ klasörü YOK!"
echo ""

echo "2. Nginx /uploads/ yapılandırması:"
echo "----------------------------------"
grep -A5 "location.*uploads" /etc/nginx/sites-available/default 2>/dev/null || echo "❌ Nginx uploads location bulunamadı"
echo ""

echo "3. manifest.json testi:"
echo "----------------------"
curl -s http://localhost:4002/manifest.json | head -20
echo ""

echo "4. Logo-info testi:"
echo "-------------------"
curl -s http://localhost:4002/logo-info | head -20
echo ""

echo "5. Frontend'den /uploads/ erişim testi:"
echo "---------------------------------------"
curl -sI http://localhost/uploads/logo-192.png | head -5
echo ""

echo "=== DEBUG TAMAMLANDI ==="
