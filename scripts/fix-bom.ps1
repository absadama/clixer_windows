# SQL dosyalarindan BOM kaldir
# Bu script Windows'ta kaydedilen SQL dosyalarindaki UTF-8 BOM karakterlerini kaldirir
# PostgreSQL bu karakterleri parse edemez ve "invalid byte sequence" hatasi verir

$files = @(
    "docker/init-scripts/postgres/00-schema-and-seed.sql",
    "docker/init-scripts/postgres/05-geographic-locations.sql",
    "docker/init-scripts/postgres/05-grid-designs.sql",
    "docker/init-scripts/postgres/06-labels-seed.sql",
    "docker/init-scripts/postgres/07-labels.sql",
    "docker/init-scripts/postgres/08-grid-designs.sql"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

$fixed = 0
$notFound = 0

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = [System.IO.File]::ReadAllText($file)
        [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
        Write-Host "[OK] BOM kaldirildi: $file" -ForegroundColor Green
        $fixed++
    } else {
        Write-Host "[SKIP] Dosya bulunamadi: $file" -ForegroundColor Yellow
        $notFound++
    }
}

Write-Host ""
Write-Host "Tamamlandi: $fixed dosya duzeltildi, $notFound dosya bulunamadi." -ForegroundColor Cyan
Write-Host "Tum dosyalar UTF-8 (BOM'suz) olarak kaydedildi."
