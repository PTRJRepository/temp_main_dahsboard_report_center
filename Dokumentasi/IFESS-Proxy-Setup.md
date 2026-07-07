# IFESS Proxy Configuration — Summary & Verification

## What Was Changed

### Client Configuration Updated
**File:** `D:\Gawean Rebinmas\Kerani_Super_App\IFESS.SuperApp\src\IFESS.SuperApp\appsettings.json`

**Changed:**
```json
"ControlServer": {
  "BaseUrl": "http://localhost:3001/ifess"  // Was: http://10.0.0.128:8003
}
```

This makes the client connect through the Main Dashboard proxy instead of direct to IFESS Control Server.

### Proxy Route (No Change Needed)
**File:** `D:\Gawean Rebinmas\Main Dashboard\routes-config.json`

The `/ifess` route was already configured correctly:
```json
{
  "id": "ifess",
  "path": "/ifess",
  "target": "http://localhost:8003",
  "rewriteContent": false,
  "rewritePath": true,
  "public": true
}
```

---

## Architecture Flow

```
[IFESS.SuperApp Client]
    │ POST http://localhost:3001/ifess/api/clients/.../heartbeat
    ▼
[Main Dashboard:3001] — Express Gateway
    │ Proxy passthrough: strip /ifess → forward to :8003
    ▼
[IFESS.ControlServer:8003] — Node.js HTTP Server
    │ stripBasePath('/ifess/api/...') → '/api/...'
    │ Processes request, returns JSON
    ▼
[Response flows back through proxy]
```

**Key Points:**
- Main Dashboard `rewritePath: true` strips `/ifess` → sends `/api/...` to port 8003
- IFESS Server `stripBasePath('/ifess')` also expects `/ifess` prefix and strips it
- This works correctly — both sides are aligned

---

## Verification Commands

### 1. Start IFESS Control Server
```powershell
cd "D:\Gawean Rebinmas\Kerani_Super_App\IFESS.ControlServer\js-server"
node server.js
```

**Expected Output:**
```
IFESS Client Gateway listening on http://0.0.0.0:8003
PID: <pid>
Direct URL: http://localhost:8003
Proxy path: /ifess
Proxy URL example: http://<main-dashboard-host>:3001/ifess
API key: See `IFESS_API_KEY` environment variable
```

### 2. Verify Proxy Route (IFESS Control Server Running)
```powershell
# Direct to IFESS server (bypass proxy)
curl -H "X-API-Key: $IFESS_API_KEY" http://localhost:8003/health

# Via Main Dashboard proxy
curl -H "X-API-Key: $IFESS_API_KEY" http://localhost:3001/ifess/health
```

**Expected JSON Response:**
```json
{
  "status": "Healthy",
  "service": "IFESS Client Gateway",
  "serviceCode": "IFESS_CLIENT_GATEWAY",
  "gatewayPath": "/ifess",
  "serverTime": "2026-05-30T...",
  "pid": <number>,
  "host": "0.0.0.0",
  "port": 8003,
  "directUrl": "http://localhost:8003",
  "proxyExample": "http://<main-dashboard-host>:3001/ifess"
}
```

### 3. Verify Proxy Route List
```powershell
curl http://localhost:3001/api/routes
```

**Should include:**
```json
{
  "id": "ifess",
  "path": "/ifess",
  "target": "http://localhost:8003",
  "description": "IFESS Client Gateway",
  "enabled": true,
  "rewriteContent": false,
  "rewritePath": true,
  "public": true
}
```

### 4. Browser Verification
- Navigate to: `http://localhost:3001/ifess/`
- Should see IFESS web dashboard (index.html from js-server/public/)

---

## Starting the Full System

### Terminal 1 — Main Dashboard Proxy
```powershell
cd "D:\Gawean Rebinmas\Main Dashboard"
npm run dev
# Server starts on http://localhost:3001
```

### Terminal 2 — IFESS Control Server
```powershell
cd "D:\Gawean Rebinmas\Kerani_Super_App\IFESS.ControlServer\js-server"
node server.js
# Server starts on http://localhost:8003
```

### Terminal 3 — IFESS SuperApp Client (on client machine)
```powershell
cd "D:\Gawean Rebinmas\Kerani_Super_App\IFESS.SuperApp\src\IFESS.SuperApp\bin\Release\net8.0\"
.\IFESS.SuperApp.exe
# Client polls to http://localhost:3001/ifess/api/...
```

---

## Troubleshooting

### Issue: "No route configured" error
- Verify Main Dashboard is running (`:3001`)
- Verify `/ifess` route is enabled in `routes-config.json`
- Restart Main Dashboard after config changes (hot-reload should work, but restart if unsure)

### Issue: Client can't connect (connection refused)
- Verify IFESS Control Server is running (`:8003`)
- Check `BaseUrl` in client appsettings.json is `http://localhost:3001/ifess`
- If client is on remote machine, change `BaseUrl` to `http://<main-dashboard-ip>:3001/ifess`

### Issue: Health endpoint returns 401 Unauthorized
- X-API-Key header is required. Check `IFESS_API_KEY` environment variable
- Check API key matches between server (`IFESS_API_KEY`) and client (`ControlServer:ApiKey`)

### Issue: Client heartbeat works but commands don't dispatch
- Verify both `/ifess` and `/backend/upah` (if used) routes are working
- Check IFESS Control Server logs for incoming requests
- Verify client module status in IFESS web dashboard

---

## Environment Variables (Optional)

### IFESS Control Server
Set these if you want to override defaults:
```powershell
$env:IFESS_PORT = "8003"              # Default: 8003
$env:IFESS_HOST = "0.0.0.0"          # Default: 0.0.0.0
$env:IFESS_API_KEY = "<your-api-key>"
$env:IFESS_BASE_PATH = "/ifess"      # Default: /ifess
```

### Main Dashboard
```powershell
$env:NODE_ENV = "development"        # or "production"
$env:BACKEND_HOST = "localhost"      # or remote IP
```