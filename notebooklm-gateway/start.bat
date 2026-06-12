@echo off
title NotebookLM Gateway (Bun.js) - Port 8003
cd /d "D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway"
echo.
echo ==========================================
echo   NotebookLM Gateway (Bun.js)
echo   http://localhost:8003
echo ==========================================
echo   Python: C:\Users\nbgmf\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe
echo   Notebook: 10b4e732-ccb0-45f2-80a9-354502ebf89c
echo   Docs: D:\Gawean Rebinmas\Main Dashboard\docs
echo ==========================================
echo.
bun run server.ts
pause