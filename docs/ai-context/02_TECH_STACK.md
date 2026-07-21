---
name: 02-tech-stack
description: Complete technology stack documentation
metadata:
  type: documentation
  tags: [tech-stack, technologies]
---

# Technology Stack

## Frontend Technologies

### Core Framework

| Technology | Version | Purpose | Evidence |
|------------|---------|---------|----------|
| Next.js | 16.0.7 | React framework, App Router | `Dashboard_Utama/package.json` |
| React | 19.2.0 | UI library | `Dashboard_Utama/package.json` |
| React DOM | 19.2.0 | DOM rendering | `Dashboard_Utama/package.json` |

### Styling & UI

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4 | Utility-first CSS |
| Lucide React | 0.555.0 | Icon library |
| Framer Motion | 12.23.25 | Animations |

### State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| Zustand | 5.0.13 | Lightweight state management |
| TanStack React Query | 5.100.10 | Server state, caching |

### Data Export

| Technology | Version | Purpose |
|------------|---------|---------|
| xlsx | 0.18.5 | Excel export |
| jspdf | 4.2.1 | PDF generation |

### Maps

| Technology | Version | Purpose |
|------------|---------|---------|
| Leaflet | 1.9.4 | Map library |
| React Leaflet | 5.0.0 | React bindings |

## Backend Technologies

### Gateway

| Technology | Purpose | Evidence |
|------------|---------|----------|
| Bun | High-performance HTTP server | `server_bun.js` |
| Express.js | Legacy gateway (deprecated) | `server.js` |

### Database Clients

| Technology | Version | Purpose |
|------------|---------|---------|
| mssql | 12.2.0 | MSSQL connection |
| @prisma/client | 5.22.0 | ORM (imported but unused?) |

### Authentication

| Technology | Version | Purpose |
|------------|---------|---------|
| bcryptjs | 3.0.3 | Password hashing |
| jsonwebtoken | 9.0.3 | JWT handling |
| next-auth | 5.0.0-beta.30 | Auth framework (partially used) |

### Validation

| Technology | Version | Purpose |
|------------|---------|---------|
| zod | 4.1.13 | Schema validation |

### Dev Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5 | Type safety |
| ESLint | 9 | Linting |
| Prisma | 5.22.0 | ORM CLI |

## Database Technologies

### Primary Database

| Technology | Version | Purpose | Evidence |
|------------|---------|---------|----------|
| MSSQL (SQL Server) | - | Business data, users, inventory | `.env.production` |
| Firebird | 1.5 | Scanner data, production data | `CLAUDE.md` |

### Data Storage

| Technology | Location | Purpose |
|------------|----------|---------|
| JSON Files | `/data/ifess/` | iFESS configuration |
| File System | Various | Static assets, logs |

## External Services

| Service | Port | Purpose | Auth |
|---------|------|---------|------|
| Payroll | 5175/8002 | Wage management | Proxy |
| Attendance | 5176 | Employee attendance | Proxy |
| Rice Monitor | 5177 | Distribution monitoring | Proxy |
| Google Drive | 5178 | Document storage | Proxy |
| SQL Gateway | 8001 | Firebird queries | API Key |
| iFESS Client | 8003 | Desktop clients | API Key |

## Development Tools

| Tool | Purpose |
|------|---------|
| Bun | JavaScript runtime, bundler |
| npm | Package manager |
| Docker | Containerization |
| nginx | Reverse proxy (production) |

## Architecture Pattern

```
Browser → Bun Gateway → Next.js → MSSQL
                ↓
          Firebird (isql CLI)
```

---

**Evidence**: `package.json` files, `routes-config.json`
