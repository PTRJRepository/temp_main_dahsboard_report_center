# AGENT_GUIDE.md

This guide provides essential context for AI agents working on the Main Dashboard project.

## Project Purpose

The Main Dashboard is a plantware/estate inventory management system with two main functions:

1. **Inventory Reports** - MSSQL-based reporting for estate and mill operations
2. **iFESS Client Management** - Server for iFESS SuperApp desktop clients

## Quick Architecture

```
Browser → Next.js :3001 → MSSQL (db_ptrj / db_ptrj_mill)
                    ↓
            Express Gateway (proxy routes, auth, ifess)
```

## Key Components

### Next.js App (Dashboard_Utama)
- Route handlers in `app/api/`
- Report viewers in `app/(report-center)/` (thin pages) backed by the self-contained `modules/report-center/` module
- iFESS dashboard in `app/ifess-control/`

### Express Gateway (server.js)
- Port 3001 (standalone mode)
- Dynamic proxy routes via `routes-config.json`
- iFESS Control Server endpoints

### Report System
- Raw SQL via `mssql` library
- Movement categories: Fast Moving (≥6), Moving (2-5), Slow Moving (1), Dead Stock (0+stock), No Movement (0, no stock)
- Data sources: `pabrik` → `db_ptrj_mill`, `estate` → `db_ptrj`

## Development Workflow

### Start Development
```bash
npm run dev  # From root - gateway + Next.js
```

### Key Files
| File | Purpose |
|------|---------|
| `server.js` | Express gateway, proxy routes |
| `routes-config.json` | Proxy configuration |
| `Dashboard_Utama/app/api/reports/` | Report SQL handlers |
| `Services/ifess-control-server/` | iFESS server module |

## Coding Standards

- TypeScript strict mode
- 2-space indentation, single quotes
- Report routes: kebab-case
- React components: PascalCase
- Functions/variables: camelCase

## Important Rules

1. **Never commit secrets** - `.env`, `.env.local`, `keys/` are gitignored
2. **Read-only SQL** - Use `validateReadOnlySql` for report queries
3. **iFESS API requires key** - Server-side proxy handles auth automatically
4. **Cookie-based auth** - JWT stored in cookies, not localStorage

## Getting Help

- `CLAUDE.md` - Detailed project documentation
- `Dokumentasi/` - Service usage guides
- `Services/*/README.md` - Module-specific docs
