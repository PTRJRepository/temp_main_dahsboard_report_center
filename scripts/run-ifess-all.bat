@echo off
REM IFESS Control Server - Start gateway + sim together
REM Run this once. Both stay alive while this window is open.
REM Close the window to stop both.

cd /d "D:\Gawean Rebinmas\Main Dashboard"

echo Starting IFESS gateway...
start "IFESS Gateway" /min cmd /c "cd /d D:\Gawean Rebinmas\Main Dashboard && set NODE_ENV=development && set DASHBOARD_PORT=3100 && set START_DASHBOARD=true && bun run server_bun.js"

echo Waiting for gateway to be ready...
timeout /t 20 /nobreak >nul

echo Starting IFESS client simulator (ARE-A)...
start "IFESS Sim" /min cmd /c "cd /d D:\Gawean Rebinmas\Main Dashboard && set IFESS_CLIENT_ID=CLIENT-PTRJ-ARE-A && set IFESS_DB_PATH=D:\Gawean Rebinmas\Monitoring Database\Database Ifess\IFESS_ARE_A_15-05-2026\PTRJ_ARA.FDB && node scripts/ifess-client-sim.js"

echo.
echo ========================================
echo  IFESS Control Server running:
echo    UI:      http://localhost:3001/ifess-control
echo    Gateway: http://localhost:3001
echo    Client:  CLIENT-PTRJ-ARE-A (PTRJ_ARA.FDB)
echo  Close this window to stop.
echo ========================================
echo.
echo Press any key to stop everything...
pause >nul
taskkill /FI "WINDOWTITLE eq IFESS Gateway*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq IFESS Sim*" /F >nul 2>&1
taskkill /IM bun.exe /F >nul 2>&1
taskkill /IM node.exe /F >nul 2>&1
