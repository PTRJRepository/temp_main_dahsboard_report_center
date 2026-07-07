# IFESS Control Server - Node.js Integration

This module provides a JavaScript/Node.js implementation of the iFESS Control Server, integrated directly into the Main Dashboard's Express gateway on port 3001.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Main Dashboard :3001                        │
│  ┌─────────────────┐  ┌─────────────────────────────────┐   │
│  │  Next.js App    │  │    Express Gateway               │   │
│  │  (React UI)     │  │  ┌─────────────────────────┐    │   │
│  │                 │  │  │  /api/ifess/*           │    │   │
│  │  /ifess-control │──┼──│  (iFESS Router)         │    │   │
│  │  (Admin UI)     │  │  └─────────────────────────┘    │   │
│  │                 │  │  ┌─────────────────────────┐    │   │
│  │                 │  │  │  /api/routes/*          │    │   │
│  │                 │  │  │  (Proxy Config)         │    │   │
│  └─────────────────┘  │  └─────────────────────────┘    │   │
│                        └─────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ X-API-Key Auth
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  iFESS SuperApp Clients                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │ Client 1    │  │ Client 2    │  │ Client N    │         │
│  │ (Kerani)    │  │ (Mandor)    │  │ (Admin)     │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
```

## API Endpoints

All endpoints are prefixed with `/api/ifess/` and require `X-API-Key` header authentication.

### Health Check (Public)
- `GET /api/ifess/health` - Server health status

### Client Management
- `POST /api/ifess/clients/register` - Register new client
- `GET /api/ifess/clients` - List all clients
- `GET /api/ifess/clients/:clientId` - Get client details
- `GET /api/ifess/clients/:clientId/config` - Get client configuration
- `PUT /api/ifess/clients/:clientId/config` - Update client configuration

### Heartbeat & Status
- `POST /api/ifess/clients/:clientId/heartbeat` - Receive heartbeat
- `POST /api/ifess/clients/:clientId/modules/status` - Report module status
- `GET /api/ifess/clients/:clientId/modules/status` - Get module statuses
- `GET /api/ifess/module-statuses` - Get all module statuses

### Command Management
- `POST /api/ifess/clients/:clientId/commands` - Create command
- `GET /api/ifess/clients/:clientId/commands/pending` - Poll pending commands
- `POST /api/ifess/clients/:clientId/commands/:commandId/result` - Report result
- `GET /api/ifess/commands` - List all commands

### Dashboard
- `GET /api/ifess/dashboard` - Get dashboard summary

## Authentication

All API endpoints (except `/api/ifess/health`) require the `X-API-Key` header.

Configure via environment variable:
```
IFESS_API_KEY=<your-api-key>
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `IFESS_API_KEY` | Required | API key for server authentication |
| `GATEWAY_BASE` | `http://localhost:3001` | Gateway base URL for Next.js proxy |

**Note:** `NEXT_PUBLIC_IFESS_API_KEY` is NOT needed. The Next.js dashboard uses a server-side proxy (`/api/ifess`) that handles authentication automatically.

### Data Storage

Data is stored in JSON files under `data/ifess/`:
- `clients.json` - Registered clients
- `configs.json` - Client configurations
- `commands.json` - Command queue
- `module-statuses.json` - Module status reports
- `heartbeat-logs.json` - Heartbeat history

## Admin Dashboard

Access the web-based control panel at:

```
http://localhost:3001/ifess-control
```

Features:
- Real-time dashboard with client/module status
- Client management interface
- Command dispatch
- Configuration editor
- Module status monitoring

## Migration from .NET Control Server

This Node.js implementation provides the same API contract as the original .NET `IFESS.ControlServer.Api`. Clients can switch to the integrated gateway by updating their configuration:

**Old (port 8003):**
```
http://localhost:8003
```

**New (port 3001 gateway):**
```
http://localhost:3001/api/ifess
```

The API endpoints and authentication remain the same.

## File Structure

```
Services/
└── ifess-control-server/
    ├── service.js    # Core business logic & data storage
    ├── auth.js       # API key authentication (timing-safe)
    └── routes.js     # Express router with all endpoints

data/
└── ifess/           # JSON data storage (auto-created)
    ├── clients.json
    ├── configs.json
    ├── commands.json
    ├── module-statuses.json
    └── heartbeat-logs.json

Dashboard_Utama/app/
├── api/
│   └── ifess/
│       └── route.ts   # Next.js server-side proxy
└── ifess-control/
    ├── page.tsx     # Admin dashboard UI
    └── config.ts    # Client-side configuration
```

## Next.js API Proxy

The Next.js dashboard (`/ifess-control`) uses a server-side proxy at `/api/ifess` to communicate with the gateway. This:

1. Handles authentication server-side (API key never exposed to client)
2. Provides a clean interface for the React dashboard
3. Supports both GET and POST methods via action-based routing

Example usage from React:
```typescript
const data = await callProxy<Client[]>('listClients');
```
