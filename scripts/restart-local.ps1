# ============================================
# CLIXER - FULL SYSTEM RESTART (Windows)
# ============================================
# This script wraps start-local.ps1 which already handles cleanup.
# ============================================

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StartScript = Join-Path $ScriptDir "start-local.ps1"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   CLIXER - SISTEM YENIDEN BASLATILIYOR" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Run the start script which performs cleanup first
& $StartScript
