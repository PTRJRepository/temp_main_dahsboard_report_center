@echo off
REM ============================================
REM IFESS Control Server - Restart Script
REM ============================================
REM This script restarts the Main Dashboard server
REM which serves as the IFESS Control Server
REM ============================================

echo.
echo ============================================
echo   IFESS Control Server - Restart Script
echo ============================================
echo.

REM Check if Node or Bun is available
where bun >nul 2>&1
if %errorlevel% equ 0 (
    set "RUNTIME=bun"
    set "START_CMD=bun run server_bun.js"
    echo Runtime detected: Bun
) else (
    where node >nul 2>&1
    if %errorlevel% equ 0 (
        set "RUNTIME=node"
        set "START_CMD=node server.js"
        echo Runtime detected: Node.js
    ) else (
        echo ERROR: Neither Bun nor Node.js is installed!
        echo Please install Bun or Node.js first.
        pause
        exit /b 1
    )
)

REM Kill existing process on port 3001
echo.
echo Killing existing processes on port 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001 ^| findstr LISTENING') do (
    echo Stopping process %%a...
    taskkill /F /PID %%a >nul 2>&1
)

REM Also kill any Next.js dev servers
echo.
echo Killing any Next.js dev servers...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3100 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)

REM Wait a moment for processes to terminate
timeout /t 2 /nobreak >nul

echo.
echo ============================================
echo   Starting IFESS Control Server...
echo ============================================
echo.
echo Server will run on: http://localhost:3001
echo IFESS Control Panel: http://localhost:3001/ifess-control
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start the server with appropriate runtime
if "%RUNTIME%"=="bun" (
    bun run server_bun.js
) else (
    node server.js
)

pause
