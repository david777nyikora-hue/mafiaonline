# MAFIA - Multiplayer Server Starter
# PowerShell Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   MAFIA - Multiplayer Server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Schimbă în directorul scriptului
Set-Location $PSScriptRoot

# Verifică Node.js
Write-Host "Verificare Node.js..." -ForegroundColor Gray
try {
    $nodeVersion = node --version
    Write-Host "Node.js găsit: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[EROARE] Node.js nu este instalat!" -ForegroundColor Red
    Write-Host "Descarcă de pe: https://nodejs.org/" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host ""

# Verifică și instalează dependențe
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalez dependențe..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[EROARE] Instalarea a eșuat!" -ForegroundColor Red
        pause
        exit 1
    }
    Write-Host ""
}

Write-Host "Dependențe OK!" -ForegroundColor Green
Write-Host ""

# Afișează informații
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Pornesc serverul..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Server disponibil la:" -ForegroundColor White
Write-Host "  - Local:    http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Pentru alte dispozitive (telefoane):" -ForegroundColor White
Write-Host "  - Găsește IP-ul: " -NoNewline -ForegroundColor Gray
Write-Host "ipconfig" -ForegroundColor Yellow
Write-Host "  - Accesează:    " -NoNewline -ForegroundColor Gray
Write-Host "http://[IP-ul-tău]:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[Apasă Ctrl+C pentru a opri serverul]" -ForegroundColor Red
Write-Host ""

# Pornește serverul
npm start
