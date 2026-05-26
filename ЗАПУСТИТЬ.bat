@echo off
title AcuTwin

:: Проверка Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found. Installing...
    set "MSI=%~dp0..\node-v24.16.0-x64.msi"
    if not exist "%MSI%" set "MSI=%~dp0node-v24.16.0-x64.msi"
    if exist "%MSI%" (
        start /wait msiexec /i "%MSI%"
        echo Done. Please run ZAPUSTIT.bat again.
        pause
        exit /b
    ) else (
        echo Installer not found. Download: https://nodejs.org
        pause
        exit /b 1
    )
)

cd /d "%~dp0"

:: Остановить старый сервер
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr :5500 ^| findstr LISTENING') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 1 /nobreak >nul

:: Пробуем запустить
echo Starting server...
start "" /B node server.js > server.log 2>&1
timeout /t 3 /nobreak >nul

:: Проверяем — запустился?
netstat -ano 2>nul | findstr :5500 | findstr LISTENING >nul
if not errorlevel 1 goto :open

:: Не запустился — пересобираем модули (нужен интернет ~1 мин)
echo.
echo  Rebuilding modules for this Node.js version...
echo  (internet required, ~1 minute)
echo.
rmdir /s /q node_modules 2>nul
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed.
    echo Check internet connection and try again.
    pause
    exit /b 1
)

:: Второй запуск
start "" /B node server.js > server.log 2>&1
timeout /t 3 /nobreak >nul

netstat -ano 2>nul | findstr :5500 | findstr LISTENING >nul
if errorlevel 1 (
    echo ERROR: Server still not starting. Log:
    type server.log
    pause
    exit /b 1
)

:open
start "" http://localhost:5500
echo.
echo  ==========================================
echo   AcuTwin: http://localhost:5500
echo  ==========================================
echo   ivanov  / 1
echo   petrov  / 2
echo   sidorov / 3
echo  ==========================================
echo.
pause >nul
