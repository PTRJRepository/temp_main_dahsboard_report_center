# IFESS Control Server - Quick Start

## Overview

The iFESS Control Server manages iFESS SuperApp desktop clients. It was integrated into the Main Dashboard gateway on port 3001.

## Quick Test

```bash
# 1. Start the gateway
cd "D:\Gawean Rebinmas\Main Dashboard"
npm run dev

# 2. Test health endpoint (no auth required)
curl http://localhost:3001/api/ifess/health

# 3. Test API with authentication
curl -H "X-API-Key: $IFESS_API_KEY" \
     http://localhost:3001/api/ifess/clients

# 4. Open admin dashboard
# http://localhost:3001/ifess-control
```

## Register a Test Client

```bash
curl -X POST http://localhost:3001/api/ifess/clients/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ptrj-rebinmas-air-ruak-parit-gunung-darul" \
  -d '{
    "clientId": "test-client-01",
    "clientName": "Test Client",
    "machineName": "DESKTOP-TEST",
    "environment": "development",
    "appVersion": "1.0.0",
    "os": "Windows 11"
  }'
```

## Send a Heartbeat

```bash
curl -X POST http://localhost:3001/api/ifess/clients/test-client-01/heartbeat \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ptrj-rebinmas-air-ruak-parit-gunung-darul" \
  -d '{
    "timestamp": "2026-06-26T10:00:00Z",
    "status": "Online",
    "uptimeSeconds": 3600,
    "modules": [
      {
        "moduleCode": "DAERAH_KERA_HARIAN",
        "status": "Running",
        "pid": 12345,
        "restartCount": 0
      }
    ]
  }'
```

## Create a Command

```bash
curl -X POST http://localhost:3001/api/ifess/clients/test-client-01/commands \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ptrj-rebinmas-air-ruak-parit-gunung-darul" \
  -d '{
    "commandType": "StopModule",
    "moduleCode": "DAERAH_KERA_HARIAN",
    "payload": {}
  }'
```

## Poll for Pending Commands

```bash
curl http://localhost:3001/api/ifess/clients/test-client-01/commands/pending \
  -H "X-API-Key: ptrj-rebinmas-air-ruak-parit-gunung-darul"
```

## Common Issues

### 401 Unauthorized
- Check that `X-API-Key` header is present
- Verify the key matches `IFESS_API_KEY` in environment

### Gateway not responding
- Ensure gateway is running on port 3001
- Check logs for IFESS module loading errors

### Dashboard shows "Failed to load"
- Check browser console for errors
- Verify `/api/ifess` route is not being proxied elsewhere
