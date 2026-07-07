# IFESS Control Server - Quick Start Guide

## Server Status

**Status:** ✅ Fully Working
- **API:** `/api/ifess` (Built-in Bun handler)
- **UI:** `/ifess-control` (Next.js Dashboard)

## Running the Server

### Bun Server (Unified - Frontend + Backend)

```bash
cd "D:\Gawean Rebinmas\Main Dashboard"
bun run server_bun.js
```

**Unified single port 3001 serves:**
- Next.js Dashboard (all UI pages)
- IFESS API (built-in, no external dependency)
- Proxy to other services (upah, absen, etc.)

## Access Points

| Service | URL |
|---------|-----|
| **Main Dashboard** | http://localhost:3001 |
| **IFESS Control UI** | http://localhost:3001/ifess-control |
| **IFESS API** | http://localhost:3001/api/ifess |
| **Health Check** | http://localhost:3001/api/ifess/health |

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/ifess/health` | GET | No | Health check |
| `/api/ifess/server-info` | GET | No | Server config for client discovery |
| `/api/ifess/clients` | GET | Yes | List all registered clients |
| `/api/ifess/clients/register` | POST | Yes | Register new client |
| `/api/ifess/clients/:id/heartbeat` | POST | Yes | Client heartbeat |
| `/api/ifess/dashboard` | GET | Yes | Dashboard summary |

## Authentication

Protected endpoints require header:
```
X-API-Key: ptrj-rebinmas-air-ruak-parit-gunung-darul
```

## Testing

```bash
node scripts/test-ifess.js
```

## Environment Variables

```bash
# Server
PORT=3001

# IFESS (optional - defaults work)
IFESS_API_KEY=ptrj-rebinmas-air-ruak-parit-gunung-darul
IFESS_SERVER_HOST=localhost
IFESS_SERVER_PORT=3001
IFESS_SERVER_PROTOCOL=http
IFESS_BASE_URL=http://localhost:3001
```

## Architecture

```
Client Apps → Bun Gateway (port 3001)
                  ↓
              Next.js (UI pages) OR IFESS API (built-in)
                  ↓
              Proxy to other services
```

## Troubleshooting

### Port already in use
```bash
taskkill /F /IM bun.exe
taskkill /F /IM node.exe
```
