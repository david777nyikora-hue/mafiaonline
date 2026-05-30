ozitor@echo off
echo ========================================
echo    MAFIA - Multiplayer Server
echo ========================================
echo.

cd /d "%~dp0"

echo Verificare Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [EROARE] Node.js nu este instalat!
    echo Descarca de pe: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo Node.js gasit!
echo.

echo Verificare dependente...
if not exist "node_modules\" (
    echo Instalez dependente...
    call npm install
    if errorlevel 1 (
        echo [EROARE] Instalarea a esuat!
        pause
        exit /b 1
    )
    echo.
)

echo Dependente OK!
echo.
echo ========================================
echo Pornesc serverul...
echo ========================================
echo.
echo Server disponibil la:
echo   - Local:    http://localhost:3000
echo.
echo Pentru alte dispozitive (telefoane):
echo   - Gaseste IP-ul: ipconfig
echo   - Acceseaza:    http://[IP-ul-tau]:3000
echo.
echo ========================================
echo.
echo [Apasa Ctrl+C pentru a opri serverul]
echo.

call npm start

pause
