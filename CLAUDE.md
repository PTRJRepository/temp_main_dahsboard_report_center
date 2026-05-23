# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

This is a dual-layer application:
- **Root** (`/`) — Bun/Express proxy gateway (`server.js`) on port 3001 that routes to multiple backend services.
- **`Dashboard_Utama/`** — Next.js 16 (React 19, App Router, TypeScript strict) dashboard; the main development workspace.

```
Main Dashboard/
├── server.js                    # Express gateway entrypoint (port 3001)
├── routes-config.json           # Proxy route definitions (hot-reload)
├── keys/                        # JWT RSA keypairs
├── Dokumentasi/                 # Service usage guides
└── Dashboard_Utama/
    └── app/
        ├── api/                 # Route Handlers (auth/, reports/, services/)
        ├── report-center/      # Report viewer pages
        ├── actions/             # Server Actions
        └── ...                  # pages and layouts
    └── lib/
        └── reports/             # Report SQL builders, filters, accounting periods
            └── inventory/        # Per-domain report config
```

## Development Commands

**Root (proxy gateway):**
```bash
npm run dev       # start gateway in watch mode
npm run start     # production
npm run build:dashboard  # build Next.js from root
```

**Dashboard_Utama (Next.js):**
```bash
cd Dashboard_Utama
npm run dev       # Next.js dev server (port 3000)
npm run build     # production build
npm run lint      # ESLint
npx tsc --noEmit  # TypeScript validation
```

**Standalone test (assert-based):**
```bash
cd Dashboard_Utama && npx tsx lib/reports/accounting-period.test.ts
```

## Key Architectural Patterns

### Report System (MSSQL)

Reports use raw SQL via the `mssql` library through helpers in `Dashboard_Utama/lib/reports/`. Key concepts:

- **Report handlers** are registered in `app/api/reports/inventory/route.ts` — a large file containing all inventory report handlers as async functions. Each handler accepts `{ limit, limitAll, search, ctx, filters }` and returns a `ReportPayload`.
- **MovementCategory** is determined by `StockIssueEventCount` (total stock issue events per item):
  - `>= 6` → Fast Moving
  - `2-5` → Moving
  - `1` → Slow Moving
  - `0` with stock > 0 → Dead Stock
  - `0` with stock = 0 → No Movement
- **ReportViewerClient** (`app/report-center/inventory/[report]/ReportViewerClient.tsx`) is a generic client that renders any inventory report. It has profile-specific configurations for different report IDs (using `MOVEMENT_ANALYSIS_REPORT_IDS`, `STOCK_AGING_REPORT_IDS`, `ASSET_VALUATION_REPORT_IDS`).
- **Data source** per location is controlled via `source` param: `source=pabrik` uses `db_ptrj_mill`; `source=estate` uses `db_ptrj`. The `QueryContext.database` field switches between them.
- Initial load is **500 rows** (TABLE_FIRST_LIMIT). Pagination is client-side unless `metadata.paginated` is set.

### Auth & DB

- **Auth** uses NextAuth.js with JWT. Session stored in `prisma/` SQLite (Prisma ORM).
- **MSSQL** (reporting DB) is configured in `env-config.txt` / env vars. Helper functions in `lib/reports/` handle period resolution, filters, and SQL safety.
- **Local DB** (Prisma SQLite) is for users, services, and access control — not for reporting data.

### Reuse Helpers (don't duplicate)

`lib/reports/` contains:
- `report-filtering.ts` — `sanitizeLike`, `textSearch`, `stockIssueUsageApply`, `warehouseInventoryItemTypeExpression`, `resolveAssetValuationPeriod`
- `accounting-period.ts` — period conversion logic
- `inventory/config.ts` — report metadata (tags, sourceTables, availableFilters, chartDefinitions)

## Coding Standards

- **TypeScript strict** mode throughout.
- **2-space indentation**, single quotes in TS/TSX.
- Report IDs and routes use **kebab-case** (e.g., `all-stock-movement-analysis`).
- React components use `PascalCase`; functions/variables/hooks use `camelCase`.
- Prefer existing helpers over duplicating logic. Keep SQL routes read-only.

## Security

- Do not commit `.env`, `.env.local`, `keys/`, or any secrets.
- All report SQL routes must be read-only; use `validateReadOnlySql` where applicable.