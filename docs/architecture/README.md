# PT Rebinmas Jaya - Main Dashboard Architecture

## System Overview

Enterprise dashboard system for PT Rebinmas Jaya (oil palm plantation & mill) providing unified access to multiple services including:
- **Inventory Management** - Procurement, stock tracking, material movements
- **Attendance/HR** - Employee attendance, overtime, payroll integration
- **Production** - FFB (Fresh Fruit Bunch) harvesting analytics
- **Financial** - Cost analysis, budget tracking
- **iFESS Control** - Desktop client management for field data collection

## Technology Stack

### Frontend
- **Framework**: Next.js 16 (React 19)
- **Styling**: Tailwind CSS 4
- **State Management**: Zustand 5
- **Data Fetching**: TanStack React Query 5
- **UI Components**: Lucide React (icons), Framer Motion (animations)
- **Maps**: React Leaflet with OpenStreetMap

### Backend / Gateway
- **Primary Gateway**: Bun native HTTP server (`server_bun.js`)
- **Legacy Gateway**: Express.js (`server.js`)
- **Authentication**: JWT RS256 with RSA keypairs

### Databases
| Database | Type | Purpose |
|----------|------|---------|
| MSSQL (extend_db_ptrj) | SQL Server | Primary business data, users, inventory |
| Firebird (PTRJ_ARC.FDB) | Embedded | Attendance scanners, FFB production data |
| JSON Files | File-based | iFESS configuration, cache |

### External Services (via reverse proxy)
- `/upah` → Payroll system (port 8002)
- `/absen` → Attendance system (port 5176)
- `/monitoring-beras` → Rice monitoring (port 5177)
- `/query` → SQL Gateway (port 8001)
- `/file` → Google Drive gateway (port 5178)
- `/ifess` → iFESS Client gateway (port 8003)

## Repository Structure

```
Main Dashboard/
├── server_bun.js                 # Bun gateway (active) - reverse proxy + iFESS
├── server.js                     # Express gateway (legacy)
├── routes-config.json            # Proxy route definitions
├── keys/                        # JWT RSA keypairs
├── data/ifess/                  # iFESS JSON data storage
├── Services/
│   ├── ifess-control-server/    # iFESS client management
│   ├── firebird-query-service/  # Standalone Firebird service
│   └── ifess-control-service/   # Standalone iFESS service
├── Dashboard_Utama/             # Next.js 16 App
│   ├── app/                     # Next.js App Router
│   │   ├── (landing-page)/      # Landing page
│   │   ├── (login)/             # Auth pages
│   │   ├── (report-center)/     # Report viewer pages
│   │   ├── ifess-control/       # iFESS admin UI
│   │   └── api/                 # API routes
│   ├── lib/                     # Shared utilities
│   │   ├── reports/             # Report configurations
│   │   ├── utils/               # Auth, helpers
│   │   ├── api/                 # API client utilities
│   │   └── hooks/               # Custom React hooks
│   ├── public/                  # Static assets
│   ├── Dockerfile               # Container build
│   └── docker-compose.yml       # Docker orchestration
└── docs/                        # Documentation
```

## Main Components

### 1. Gateway Layer (`server_bun.js`)
- Reverse proxy to upstream services
- JWT authentication middleware
- iFESS Control Server API (`/api/ifess/*`)
- Firebird Query Gateway (`/api/query-gateway/*`)
- Static file serving with LRU cache

### 2. Dashboard Application (`Dashboard_Utama/`)
- Next.js 16 App Router for all UI
- Route groups: `(landing-page)`, `(login)`, `(report-center)`
- API routes for: auth, reports, iFESS sync, services

### 3. iFESS Control Server
- Client registration & heartbeat tracking
- Module status management
- Command dispatch to desktop clients
- JSON file-based data persistence

### 4. Report System
- Modular report architecture
- MSSQL queries via `mssql` library
- Report viewer with filtering, pagination, export
- AI-powered insights (`ai-insight`, `ai-analysis`)

## Local Development Flow

```bash
# Standalone mode - Gateway + Next.js
npm run dev

# Gateway only (fastest for iFESS work)
PORT=3002 START_DASHBOARD=false bun run server_bun.js

# Docker mode
cd Dashboard_Utama && docker-compose up --build
```

## Architecture Documents

| Document | Description |
|----------|-------------|
| [system-architecture.md](system-architecture.md) | High-level architecture & components |
| [backend.md](backend.md) | Gateway, services, middleware |
| [api-reference.md](api-reference.md) | All API endpoints |
| [data-model.md](data-model.md) | Database schemas & entities |
| [operations.md](operations.md) | Environment, deployment,运维 |
| [assumptions-and-gaps.md](assumptions-and-gaps.md) | Missing info & risks |
| [diagrams.md](diagrams.md) | Mermaid architecture diagrams |

---

**Generated**: 2026-07-18  
**Project**: PT Rebinmas Jaya Dashboard  
**Version**: 1.0.0
