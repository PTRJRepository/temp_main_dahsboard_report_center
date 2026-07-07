@echo off
cd /d "D:\Gawean Rebinmas\Main Dashboard"
set IFESS_CLIENT_ID=CLIENT-PTRJ-ARE-A
set IFESS_DB_PATH=D:\Gawean Rebinmas\Monitoring Database\Database Ifess\IFESS_ARE_A_15-05-2026\PTRJ_ARA.FDB
node scripts/ifess-client-sim.js
