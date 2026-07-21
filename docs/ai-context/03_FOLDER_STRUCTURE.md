---
name: 03-folder-structure
description: Complete folder structure with explanations
metadata:
  type: documentation
  tags: [folder-structure, code-organization]
---

# Folder Structure

```
Main Dashboard/
│
├── Root Level
│   ├── server_bun.js              # Bun gateway (ACTIVE) - reverse proxy
│   ├── server.js                  # Express gateway (LEGACY)
│   ├── routes-config.json         # Proxy route definitions
│   ├── routes-config.production.json
│   ├── package.json               # Root package (gateway deps)
│   ├── .env.production           # Production env vars
│   └── keys/                      # JWT RSA keypairs
│       ├── private.pem
│       └── public.pem
│
├── Services/                      # Standalone microservices
│   ├── ifess-control-server/     # iFESS client management
│   │   ├── service.js            # Main business logic
│   │   ├── routes.js             # HTTP handlers
│   │   ├── auth.js               # API key validation
│   │   ├── README.md
│   │   └── QUICKSTART.md
│   ├── ifess-control-service/    # Standalone iFESS service
│   ├── firebird-query-service/   # Standalone Firebird service
│   ├── access_sql_server_from_3001/
│   └── query/                    # SQL query utilities
│
├── data/                         # Runtime data storage
│   └── ifess/                   # iFESS JSON data files
│       ├── clients.json
│       ├── configs.json
│       ├── commands.json
│       ├── module-statuses.json
│       ├── heartbeat-logs.json
│       └── query-templates.json
│
├── Dashboard_Utama/             # Next.js 16 application
│   ├── app/                     # Next.js App Router
│   │   ├── layout.tsx           # Root layout
│   │   ├── globals.css          # Global styles
│   │   ├── providers.tsx        # React providers
│   │   ├── error.tsx           # Error boundary
│   │   ├── not-found.tsx       # 404 page
│   │   │
│   │   ├── (landing-page)/      # Route group - public landing
│   │   │   └── page.tsx
│   │   │
│   │   ├── (login)/             # Route group - auth required
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── admin/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   └── executive/
│   │   │   │       └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   └── dashboard-user/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (report-center)/     # Route group - reports
│   │   │   ├── report-center/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── [module]/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── inventory/
│   │   │   │       ├── page.tsx
│   │   │   │       └── [report]/
│   │   │   │           └── page.tsx
│   │   │   └── modules/
│   │   │       └── inventory/
│   │   │           └── page.tsx
│   │   │
│   │   ├── ifess-control/       # iFESS admin UI
│   │   │   └── page.tsx
│   │   │
│   │   └── api/                # API routes
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   ├── logout/route.ts
│   │       │   ├── verify/route.ts
│   │       │   ├── public-key/route.ts
│   │       │   └── [...nextauth]/route.ts
│   │       ├── ifess/
│   │       │   ├── route.ts
│   │       │   └── sync/route.ts
│   │       ├── query-gateway/route.ts
│   │       ├── reports/
│   │       │   ├── inventory/route.ts
│   │       │   ├── ai-insight/route.ts
│   │       │   ├── natural-filter/route.ts
│   │       │   ├── system-status/route.ts
│   │       │   └── [reportCode]/
│   │       │       └── ai-analysis/route.ts
│   │       └── services/route.ts
│   │
│   ├── lib/                    # Shared libraries
│   │   ├── api/               # API utilities
│   │   ├── hooks/             # Custom React hooks
│   │   ├── reports/           # Report system
│   │   │   ├── config.ts      # Module registry
│   │   │   ├── intelligence.ts # AI insights
│   │   │   ├── filtering.ts    # SQL builder, filters
│   │   │   ├── movement-category.ts
│   │   │   ├── accounting-period.ts
│   │   │   ├── report-detail-performance.ts
│   │   │   └── inventory/     # Inventory reports
│   │   ├── utils/             # Utilities
│   │   │   ├── auth-service.ts
│   │   │   └── auth.ts
│   │   ├── ifess-sync/        # iFESS sync logic
│   │   ├── rbac/              # Role-based access
│   │   └── mock-data.ts
│   │
│   ├── public/                # Static assets
│   │   ├── ifess-app.html     # Standalone iFESS UI
│   │   └── assets/
│   │
│   ├── package.json           # Dashboard dependencies
│   ├── Dockerfile            # Container build
│   ├── docker-compose.yml    # Docker orchestration
│   └── .env.local           # Local overrides
│
├── docs/                      # Documentation
│   ├── architecture/         # Architecture docs (NEW)
│   ├── 01-project-overview/
│   ├── 02-server-architecture/
│   └── ...
│
├── sql/                       # SQL scripts
├── scripts/                   # Utility scripts
└── Dokumentasi/              # Service usage guides
```

## Folder Purpose Summary

| Folder | Purpose | Key Files |
|--------|---------|----------|
| `root` | Gateway, config, entry points | `server_bun.js`, `routes-config.json` |
| `Services/` | Microservices | `ifess-control-server/`, `firebird-query-service/` |
| `data/ifess/` | Runtime JSON storage | `clients.json`, `templates.json` |
| `Dashboard_Utama/app/` | Next.js pages | `page.tsx`, `route.ts` files |
| `Dashboard_Utama/lib/` | Shared code | `reports/`, `utils/`, `hooks/` |
| `docs/` | Documentation | `architecture/` |

## Key Entry Points

| Entry Point | Purpose | Port |
|-------------|---------|------|
| `server_bun.js` | Gateway (primary) | 3001 |
| `server.js` | Gateway (legacy) | 3001 |
| `Dashboard_Utama/app/` | Next.js app | 3100 (dev) / 3001 (prod) |

---

**Evidence**: Directory scan, `CLAUDE.md`
