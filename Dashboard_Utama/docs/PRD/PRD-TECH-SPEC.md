# Report Center Technical Specification

## Tech Stack Definition

Report Center is built as a Next.js App Router application with TypeScript and Tailwind CSS. UI icons use `lucide-react`. Client state can use Zustand for shared app state; React Context is acceptable only for narrow, static providers such as theme or auth hydration.

Backend access from the Next.js app is routed through internal API routes. These routes call the SQL Gateway at `localhost:8001/v1/query` using the `x-api-key` header. The browser must never receive `SQL_GATEWAY_API_KEY`.

Authentication is session-based. The session token is stored in an HTTP-only secure cookie and contains a JWT with user identity, role, division, gang, and access claims.

## Environment Variables Needed

```bash
# Public browser-safe configuration
NEXT_PUBLIC_APP_NAME="Report Center"
NEXT_PUBLIC_APP_ENV="development"
NEXT_PUBLIC_SQL_GATEWAY_URL="http://localhost:8001/v1/query"
NEXT_PUBLIC_DEFAULT_PERIOD=""

# Server-only SQL Gateway configuration
SQL_GATEWAY_URL="http://localhost:8001/v1/query"
SQL_GATEWAY_API_KEY=""
DATABASE_PROFILE="SERVER_PROFILE_3"
SQL_GATEWAY_TIMEOUT_MS="15000"

# Auth and session
SESSION_COOKIE_NAME="report_center_session"
SESSION_SECRET=""
JWT_ISSUER="report-center"
JWT_AUDIENCE="report-center-web"
JWT_EXPIRES_IN="8h"

# Export storage and queue
EXPORT_STORAGE_PATH="./storage/exports"
EXPORT_PUBLIC_BASE_URL="/api/export/download"
EXPORT_RETENTION_DAYS="90"
EXPORT_MAX_ROWS="100000"
EXPORT_QUEUE_CONCURRENCY="2"

# Search
SEARCH_MAX_RESULTS="50"
SEARCH_TIMEOUT_MS="500"

# AI assistant
MINIMAX_API_KEY=""
MINIMAX_BASE_URL=""
MINIMAX_MODEL="MiniMax-M2.5"
AI_CHAT_TIMEOUT_MS="20000"

# Observability
LOG_LEVEL="info"
AUDIT_LOG_ENABLED="true"
```

`NEXT_PUBLIC_SQL_GATEWAY_URL` may exist for diagnostics, but production data calls must use `SQL_GATEWAY_URL` from server-side routes to keep the API key private.

## API Contract

All internal API routes require a valid session cookie. API responses use this envelope unless noted:

```json
{
  "data": {},
  "meta": {},
  "error": null
}
```

### GET `/api/modules`

Lists modules accessible to the current user.

Response:

```json
{
  "data": [
    {
      "id": "mod-production",
      "slug": "production",
      "name": "Produksi",
      "description": "Laporan produksi harian dan bulanan",
      "icon": "Factory",
      "sortOrder": 10,
      "requiredRoles": ["admin", "manager", "viewer"],
      "reportCount": 12
    }
  ],
  "meta": {
    "count": 1
  },
  "error": null
}
```

### GET `/api/modules/[slug]`

Returns module detail and reports accessible to the current user.

Response:

```json
{
  "data": {
    "id": "mod-production",
    "slug": "production",
    "name": "Produksi",
    "description": "Laporan produksi harian dan bulanan",
    "icon": "Factory",
    "sortOrder": 10,
    "requiredRoles": ["admin", "manager", "viewer"],
    "reports": [
      {
        "id": "rpt-daily-production",
        "moduleId": "mod-production",
        "slug": "daily-production",
        "name": "Produksi Harian",
        "description": "Output produksi per hari",
        "queryKey": "daily_production",
        "defaultFormat": "xlsx",
        "availableFormats": ["xlsx", "csv", "pdf"],
        "filters": [
          {
            "key": "period",
            "label": "Periode",
            "type": "period",
            "required": true,
            "defaultValue": "2026-05"
          }
        ],
        "requiredRoles": ["admin", "manager"],
        "divisionScoped": true,
        "gangScoped": false,
        "updatedAt": "2026-05-17T00:00:00.000Z"
      }
    ]
  },
  "meta": {},
  "error": null
}
```

### GET `/api/reports/[id]`

Returns one report definition if the user can access it.

Response:

```json
{
  "data": {
    "id": "rpt-daily-production",
    "moduleId": "mod-production",
    "slug": "daily-production",
    "name": "Produksi Harian",
    "description": "Output produksi per hari",
    "queryKey": "daily_production",
    "columns": [
      { "key": "tanggal", "label": "Tanggal", "type": "date" },
      { "key": "division", "label": "Divisi", "type": "text" },
      { "key": "total_output", "label": "Total Output", "type": "number" }
    ],
    "filters": [
      {
        "key": "period",
        "label": "Periode",
        "type": "period",
        "required": true,
        "defaultValue": "2026-05"
      }
    ],
    "availableFormats": ["xlsx", "csv", "pdf"],
    "requiredRoles": ["admin", "manager"],
    "divisionScoped": true,
    "gangScoped": false
  },
  "meta": {},
  "error": null
}
```

### POST `/api/reports/[id]/preview`

Returns preview rows. Pagination must be server-side when the result can exceed 100 rows.

Request:

```json
{
  "filters": {
    "period": "2026-05",
    "division": "A"
  },
  "pagination": {
    "page": 1,
    "pageSize": 50
  },
  "sort": {
    "key": "tanggal",
    "direction": "desc"
  }
}
```

Response:

```json
{
  "data": {
    "columns": [
      { "key": "tanggal", "label": "Tanggal", "type": "date" },
      { "key": "division", "label": "Divisi", "type": "text" },
      { "key": "total_output", "label": "Total Output", "type": "number" }
    ],
    "rows": [
      {
        "tanggal": "2026-05-17",
        "division": "A",
        "total_output": 1200
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalRows": 320,
    "hasNextPage": true
  },
  "error": null
}
```

### POST `/api/export`

Creates an export job for the authenticated user.

Request:

```json
{
  "reportId": "rpt-daily-production",
  "format": "xlsx",
  "filters": {
    "period": "2026-05",
    "division": "A"
  }
}
```

Response:

```json
{
  "data": {
    "id": "exp_01HX0000000000000000000000",
    "userId": "usr_123",
    "reportId": "rpt-daily-production",
    "format": "xlsx",
    "filtersApplied": {
      "period": "2026-05",
      "division": "A"
    },
    "status": "queued",
    "createdAt": "2026-05-17T08:00:00.000Z",
    "completedAt": null,
    "filePath": null,
    "fileSize": null,
    "errorMessage": null
  },
  "meta": {},
  "error": null
}
```

### GET `/api/export/queue`

Returns the current user's export queue and recent completed jobs.

Response:

```json
{
  "data": [
    {
      "id": "exp_01HX0000000000000000000000",
      "userId": "usr_123",
      "reportId": "rpt-daily-production",
      "reportName": "Produksi Harian",
      "format": "xlsx",
      "status": "completed",
      "createdAt": "2026-05-17T08:00:00.000Z",
      "completedAt": "2026-05-17T08:00:06.000Z",
      "downloadUrl": "/api/export/download/exp_01HX0000000000000000000000",
      "fileSize": 88412
    }
  ],
  "meta": {
    "retentionDays": 90
  },
  "error": null
}
```

### GET `/api/search?q=`

Searches reports accessible to the current user only.

Response:

```json
{
  "data": [
    {
      "type": "report",
      "id": "rpt-daily-production",
      "title": "Produksi Harian",
      "description": "Output produksi per hari",
      "moduleId": "mod-production",
      "moduleName": "Produksi",
      "url": "/modules/production/reports/rpt-daily-production",
      "score": 0.92
    }
  ],
  "meta": {
    "query": "produksi",
    "count": 1,
    "limit": 50
  },
  "error": null
}
```

## Data Models

```ts
export type UserRole = "admin" | "manager" | "supervisor" | "viewer";
export type ExportFormat = "xlsx" | "csv" | "pdf";
export type ExportStatus = "queued" | "processing" | "completed" | "failed" | "expired";

export interface Module {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  requiredRoles: UserRole[];
  reportCount?: number;
  reports?: Report[];
}

export interface Report {
  id: string;
  moduleId: string;
  slug: string;
  name: string;
  description?: string;
  queryKey: string;
  columns?: ReportColumn[];
  filters: ReportFilter[];
  defaultFormat?: ExportFormat;
  availableFormats: ExportFormat[];
  requiredRoles: UserRole[];
  divisionScoped: boolean;
  gangScoped: boolean;
  updatedAt?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "datetime" | "currency" | "percent";
}

export interface ReportFilter {
  key: string;
  label: string;
  type: "text" | "select" | "date" | "dateRange" | "period" | "number";
  required: boolean;
  defaultValue?: string | number | boolean | null;
  options?: Array<{ label: string; value: string }>;
}

export interface ExportJob {
  id: string;
  userId: string;
  reportId: string;
  reportName?: string;
  format: ExportFormat;
  filtersApplied: Record<string, unknown>;
  status: ExportStatus;
  createdAt: string;
  completedAt: string | null;
  filePath: string | null;
  downloadUrl?: string | null;
  fileSize: number | null;
  errorMessage?: string | null;
}

export interface UserSession {
  userId: string;
  username: string;
  displayName: string;
  role: UserRole;
  division?: string | null;
  gang?: string | null;
  moduleAccess: string[];
  reportAccess?: string[];
  issuedAt: number;
  expiresAt: number;
}

export interface SearchResult {
  type: "module" | "report";
  id: string;
  title: string;
  description?: string;
  moduleId?: string;
  moduleName?: string;
  url: string;
  score: number;
}
```

## State Architecture

Global state belongs in a small Zustand store:

```ts
interface AppState {
  auth: "loading" | "authenticated" | "anonymous";
  user: UserSession | null;
  activePeriod: string | null;
  activeDivision: string | null;
  sidebarCollapsed: boolean;
  setUser: (user: UserSession | null) => void;
  setActivePeriod: (period: string | null) => void;
  setActiveDivision: (division: string | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}
```

Server state is managed by React Query:

- `["modules"]`: GET `/api/modules`
- `["module", slug]`: GET `/api/modules/[slug]`
- `["report", id]`: GET `/api/reports/[id]`
- `["preview", reportId, filters, pagination, sort]`: POST `/api/reports/[id]/preview`
- `["exportQueue"]`: GET `/api/export/queue`
- `["search", query]`: GET `/api/search?q=`

UI state remains local unless it must survive navigation:

- `selectedModule`
- `selectedReport`
- `previewData`
- `exportQueue`
- filter drawer state
- table column visibility

## Performance Requirements

- Initial authenticated load must complete in under 2 seconds on the office LAN.
- Search responses must complete in under 500 ms for indexed report metadata.
- Preview load must complete in under 1 second for the first page.
- Table pagination must be server-side for any report that can return more than 100 rows.
- API routes must set SQL Gateway timeout to `SQL_GATEWAY_TIMEOUT_MS`.
- Search input must debounce requests by 250 ms.
- Preview requests must cancel stale in-flight requests when filters change.
- Export creation must return the queued job immediately; file generation runs asynchronously.
