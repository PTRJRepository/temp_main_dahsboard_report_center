@echo off
REM superapp-watchdog.bat — keep IFESS.SuperApp.exe running AND restart on update.
REM Two triggers:
REM   1. Crash: exe exits unexpectedly → restart in 2s.
REM   2. Update: exe file mtime changes (rebuild/redeploy) → kill old instance, start new.
REM Run from a Console session (not Services) so it can manage the process.
REM Usage: scripts\superapp-watchdog.bat

setlocal
set EXE_DIR=D:\Gawean Rebinmas\Kerani_Super_App\IFESS.SuperApp\src\IFESS.SuperApp\bin\Release\net8.0-windows\win-x64
set EXE=%EXE_DIR%\IFESS.SuperApp.exe

if not exist "%EXE%" (
  echo [watchdog] ERROR: exe not found at %EXE%
  echo [watchdog] Build first: dotnet build src\IFESS.SuperApp\IFESS.SuperApp.csproj -c Release
  exit /b 1
)

REM remember the exe mtime at start — a change means an update landed
for %%F in ("%EXE%") do set MTIME_KNOWN=%%~tF

:loop
echo [watchdog] starting SuperApp...
cd /d "%EXE_DIR%"
start "IFESS.SuperApp" /B "%EXE%"

:watch
REM poll every 3s
timeout /t 3 /nobreak >nul

REM --- update detection: did the exe mtime change? ---
for %%F in ("%EXE%") do set MTIME_NOW=%%~tF
if not "%MTIME_NOW%"=="%MTIME_KNOWN%" (
  echo [watchdog] UPDATE detected (exe mtime %MTIME_KNOWN% -^> %MTIME_NOW%). Restarting...
  set MTIME_KNOWN=%MTIME_NOW%
  goto restart
)

REM --- crash detection: is the process still alive? ---
tasklist /FI "IMAGENAME eq IFESS.SuperApp.exe" 2>nul | find /I "IFESS.SuperApp.exe" >nul
if errorlevel 1 (
  echo [watchdog] process not running. Restarting in 2s...
  timeout /t 2 /nobreak >nul
  goto loop
)
goto watch

:restart
REM kill any existing instance, then loop back to start a fresh one
taskkill /IM IFESS.SuperApp.exe /F >nul 2>&1
timeout /t 2 /nobreak >nul
goto loop
