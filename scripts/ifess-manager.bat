@echo off
REM ============================================
REM IFESS Control Server - Quick Status & Start
REM ============================================
REM Shows server status and provides quick actions
REM ============================================

setlocal enabledelayedexpansion

echo.
echo ============================================
echo   IFESS Control Server Manager
echo ============================================
echo.

REM Check what's running on port 3001
echo Checking port 3001...
netstat -ano | findstr :3001 | findstr LISTENING >nul
if %errorlevel% equ 0 (
    echo [RUNNING] Server is running on port 3001
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING ^| findstr TCP') do (
        echo [PID] %%a
    )
    echo.
    echo URLs:
    echo   Main:      http://localhost:3001
    echo   IFESS UI: http://localhost:3001/ifess-control
    echo   Health:    http://localhost:3001/api/ifess/health
    echo   ServerInfo:http://localhost:3001/api/ifess/server-info
) else (
    echo [STOPPED] Server is NOT running on port 3001
)

echo.
echo ============================================
echo   Actions
echo ============================================
echo.
echo  [1] Start Server
echo  [2] Restart Server
echo  [3] View Server Info API
echo  [4] View Health Check
echo  [5] Exit
echo.

set /p choice="Select action (1-5): "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto restart
if "%choice%"=="3" goto info
if "%choice%"=="4" goto health
if "%choice%"=="5" goto end

:start
echo.
echo Starting server...
start "" cmd /k "bun run server_bun.js"
goto end

:restart
echo.
echo Restarting server...
call scripts\restart-ifess.bat
goto end

:info
echo.
echo Fetching server info...
curl -s http://localhost:3001/api/ifess/server-info
echo.
goto end

:health
echo.
echo Checking health...
curl -s http://localhost:3001/api/ifess/health
echo.
goto end

:end
echo.
pause
