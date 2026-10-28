@echo off
title ZNY Browser
cd /d "%~dp0"
echo ========================================================
echo               ZNY Browser Baslatiliyor...
echo        Arc Stili Chromium Tabanli Ozel Tarayici
echo ========================================================

echo [BILGI] Uygulama derleniyor ve kontrol ediliyor...
call npm run build

if %ERRORLEVEL% NEQ 0 (
    echo [HATA] Proje derlemesi basarisiz oldu. Lutfen TypeScript/derleme hatalarini giderin.
    pause
    exit /b %ERRORLEVEL%
)

echo [BASARILI] Derleme tamamlandi. ZNY Browser calistiriliyor...
npx electron .

