# SQL dosyalarindan BOM kaldir
$files = @(
    "docker/init-scripts/postgres/00-schema-and-seed.sql",
    "docker/init-scripts/postgres/07-labels.sql",
    "docker/init-scripts/postgres/08-grid-designs.sql"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding $false

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = [System.IO.File]::ReadAllText($file)
        [System.IO.File]::WriteAllText($file, $content, $utf8NoBom)
        Write-Host "BOM kaldirildi: $file"
    } else {
        Write-Host "Dosya bulunamadi: $file"
    }
}

Write-Host "Tum dosyalar UTF-8 (BOM'suz) olarak kaydedildi."
