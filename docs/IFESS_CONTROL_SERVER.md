# IFESS Control Server

## Overview

IFESS Control Server adalah service untuk mengelola client aplikasi Kerani/IFESS yang berjalan di berbagai perangkat. Server ini menyediakan:
- **Client Registration** - Menerima pendaftaran client baru
- **Heartbeat Monitoring** - Memantau status koneksi client
- **Module Management** - Mengelola modul yang berjalan di client
- **Command Dispatching** - Mengirim perintah ke client (start/stop module, dll)
- **Dashboard Monitoring** - Visualisasi status semua client

## Server Details

| Property | Value |
|----------|-------|
| **Default Port** | `3001` |
| **API Base Path** | `/api/ifess` |
| **Control Panel** | `/ifess-control` |
| **Runtime** | Node.js / Express |

## API Endpoints

### Public Endpoints (No Auth Required)

```
GET  /api/ifess/health
     → Returns server health status

GET  /api/ifess/server-info
     → Returns server configuration for client discovery
     → Contains: serverUrl, serverPort, apiBase, endpoints
```

### Protected Endpoints (Requires API Key)

```
GET  /api/ifess/clients
     → List all registered clients

GET  /api/ifess/clients/:clientId
     → Get specific client details

GET  /api/ifess/clients/:clientId/config
     → Get client configuration

PUT  /api/ifess/clients/:clientId/config
     → Update client configuration

POST /api/ifess/clients/register
     → Register new client
     Body: { clientId, clientName, machineName, environment, appVersion, os }

POST /api/ifess/clients/:clientId/heartbeat
     → Receive client heartbeat
     Body: { status, uptimeSeconds, modules }

GET  /api/ifess/clients/:clientId/modules/status
     → Get module statuses for client

POST /api/ifess/clients/:clientId/modules/status
     → Report module status from client

POST /api/ifess/clients/:clientId/commands
     → Create command for client
     Body: { commandType, moduleCode, payload }

GET  /api/ifess/clients/:clientId/commands/pending
     → Poll pending commands

POST /api/ifess/clients/:clientId/commands/:commandId/result
     → Report command result

GET  /api/ifess/commands
     → List all commands (with optional filters)

GET  /api/ifess/dashboard
     → Get dashboard summary
```

## Authentication

Protected endpoints require `X-API-Key` header:
```
X-API-Key: <configured_api_key>
```

## Client Integration

### 1. Discover Server
```javascript
// Fetch server info to get connection details
const response = await fetch('http://server:3001/api/ifess/server-info');
const info = await response.json();
// info.serverUrl, info.apiBase, info.serverPort
```

### 2. Register Client
```javascript
await fetch(`${serverUrl}/api/ifess/clients/register`, {
  method: 'POST',
  headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clientId: 'unique-client-id',
    clientName: 'Client Display Name',
    machineName: 'HOSTNAME',
    environment: 'production',
    appVersion: '1.0.0',
    os: 'Windows'
  })
});
```

### 3. Send Heartbeat
```javascript
await fetch(`${serverUrl}/api/ifess/clients/${clientId}/heartbeat`, {
  method: 'POST',
  headers: { 'X-API-Key': apiKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'Online',
    uptimeSeconds: process.uptime(),
    modules: [{ moduleCode: 'MODULE1', status: 'Running' }]
  })
});
```

## Configuration

### Environment Variables

```bash
# Server Configuration
PORT=3001                    # Server port

# IFESS Configuration
IFESS_API_KEY=<key>          # API key for protected endpoints
IFESS_SERVER_HOST=localhost  # Server host
IFESS_SERVER_PORT=3001       # Server port
IFESS_SERVER_PROTOCOL=http    # Protocol (http/https)
IFESS_BASE_URL=http://...    # Complete base URL (optional)
```

## Data Storage

Data disimpan di `data/ifess/`:
- `clients.json` - Registered clients
- `configs.json` - Client configurations
- `commands.json` - Command queue
- `module-statuses.json` - Module statuses
- `heartbeat-logs.json` - Heartbeat history

## Command Types

| Type | Description |
|------|-------------|
| `StartModule` | Start a module |
| `StopModule` | Stop a module |
| `RestartModule` | Restart a module |
| `UpdateConfig` | Update client config |
| `ShutdownApp` | Shutdown the app |
| `RestartApp` | Restart the app |

## Module Status

| Status | Description |
|--------|-------------|
| `Running` | Module is running |
| `Stopped` | Module is stopped |
| `Error` | Module has errors |
| `Unknown` | Status unknown |

## Running the Server

```bash
# Using Node.js
node server.js

# Using Bun (faster)
bun run server_bun.js
```

## Testing

```bash
node scripts/test-ifess.js
```

## Project Structure

```
Main Dashboard/
├── server.js                 # Express gateway with IFESS integration
├── Services/
│   └── ifess-control-server/
│       ├── routes.js         # Express router for IFESS endpoints
│       ├── service.js        # Business logic
│       └── auth.js           # API key authentication
├── Dashboard_Utama/
│   └── app/
│       └── ifess-control/
│           └── page.tsx       # Control panel UI
└── data/
    └── ifess/                # JSON data storage
```

## Related Documentation

- Main gateway: `routes-config.json`
- Production config: `.env.production`
- IFESS Control Panel: `/ifess-control`
