# 03 — Architecture

**Last verified:** 2026-07-21

## System context

```mermaid
flowchart LR
  Browser[Browser]
  Gateway[Bun Gateway server_bun.js]
  Next[Next.js Dashboard_Utama]
  MSSQL[(MSSQL db_ptrj / db_ptrj_mill)]
  FB[(Firebird PTRJ_ARC.FDB)]
  Upstreams[Upstream local services]
  SQLite[(SQLite prisma/dev.db users)]

  Browser --> Gateway
  Browser --> Next
  Gateway --> Next
  Gateway --> Upstreams
  Gateway --> FB
  Next --> MSSQL
  Next --> SQLite
  Next --> Gateway
```

## Dual deployment modes

| Mode | Components | Evidence |
|---|---|---|
| **Standalone** | `server_bun.js` reverse proxy + IFESS API + Firebird query gateway; optional spawn Next on 3100 | Root `package.json` scripts, `CLAUDE.md` |
| **Docker** | Next standalone + nginx on 8080 | `Dashboard_Utama/docker-compose.yml`, `Dockerfile` |

## Containers / processes

```mermaid
flowchart TB
  subgraph standalone [Standalone host]
    BUN[Bun :3001]
    NEXTDEV[Next :3100]
    ISQL[isql.exe]
    BUN --> NEXTDEV
    BUN --> ISQL
  end
  subgraph docker [Docker compose]
    NGINX[nginx :8080]
    APP[next standalone :3001]
    NGINX --> APP
  end
```

## Request lifecycles

### Report Center inventory report

```mermaid
sequenceDiagram
  participant U as Browser
  participant N as Next.js
  participant API as /api/reports/inventory
  participant Q as SQL gateway / mssql
  participant DB as MSSQL

  U->>N: Open report viewer + filters
  N->>API: GET/POST with source, period, filters
  API->>API: auth cookie check, validateReadOnlySql where applicable
  API->>Q: execute inventory handler
  Q->>DB: SELECT only
  DB-->>Q: rows
  Q-->>API: payload summary/chart/rows
  API-->>N: JSON
  N-->>U: KPI + table + export
```

### Firebird query gateway

```mermaid
sequenceDiagram
  participant U as Client/HTML UI
  participant G as server_bun.js
  participant L as withIsqlLock
  participant I as isql.exe
  participant F as Firebird

  U->>G: POST /api/query-gateway/exec-sync
  G->>L: queue single flight
  L->>I: execFileSync temp .sql
  I->>F: query
  F-->>I: text
  I-->>G: parseIsqlOutput
  G-->>U: headers/rows
```

Critical correctness notes (from `CLAUDE.md`):

- Scanner month partitions hold multi-year data; always filter `TRANSDATE` range.
- Serialize isql (Firebird 1.5 single-threaded).
- No window functions / many modern SQL features.

## Authentication flow (dashboard)

```mermaid
sequenceDiagram
  participant U as Browser
  participant Login as /api/auth/login
  participant Svc as auth-service / MSSQL or user store
  U->>Login: email/username + password
  Login->>Svc: verify
  Svc-->>Login: user + token
  Login-->>U: Set-Cookie auth-token / payroll_auth_token
  U->>U: subsequent pages read cookies (report-center layout)
```

## Design decisions (evidence)

| Decision | Why (from code/docs) |
|---|---|
| Bun gateway primary | Active scripts; Express retained legacy |
| Read-only report SQL | `validateReadOnlySql`, DB policy memory |
| Payload-side filters often after SQL | Inventory route applies `applyReportFilters` on payload |
| SQLite Prisma for app users | `prisma/schema.prisma` provider sqlite |
| MSSQL for business reports | `mssql` package + inventory handlers |

## Dev vs production differences

| Topic | Development | Production |
|---|---|---|
| Gateway | `npm run dev` / PORT override | `npm run start` NODE_ENV=production |
| Dashboard | Turbopack `next dev` | `next build` standalone / Docker |
| Cookies | often non-secure | set `COOKIE_SECURE` when HTTPS |
| Routes config | `routes-config.json` | `routes-config.production.json` |

## Related

- [04-project-structure.md](./04-project-structure.md)
- [07-api-reference.md](./07-api-reference.md)
- [diagrams/README.md](./diagrams/README.md)
