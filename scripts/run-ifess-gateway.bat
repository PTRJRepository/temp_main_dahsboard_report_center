@echo off
cd /d "D:\Gawean Rebinmas\Main Dashboard"
set NODE_ENV=development
set DASHBOARD_PORT=3100
set START_DASHBOARD=true
bun run server_bun.js
