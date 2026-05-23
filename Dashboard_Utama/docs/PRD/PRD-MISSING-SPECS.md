# Report Center Missing Specifications

## Gap 1: RBAC Implementation Guide

RBAC must be enforced at three layers: route middleware, component rendering, and data query scope. Component checks are only for UX. API and SQL filters are the security boundary.

### Middleware Layer

Every API route must resolve the session and check role access before executing business logic.

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/session";
import { canAccessReport } from "@/lib/auth/permissions";

export async function requireReportAccess(
  request: NextRequest,
  reportId: string,
) {
  const session = await getSessionFromRequest(request);

  if (!session) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { data: null, meta: {}, error: { code: "AUTH_EXPIRED", message: "Sesi berakhir. Silakan login ulang." } },
        { status: 401 },
      ),
    };
  }

  const allowed = await canAccessReport(session, reportId);
  if (!allowed) {
    return {
      ok: false as const,
      response: NextResponse.json(
        { data: null, meta: {}, error: { code: "FORBIDDEN", message: "Anda tidak memiliki akses ke laporan ini." } },
        { status: 403 },
      ),
    };
  }

  return { ok: true as const, session };
}
```

Usage in route handlers:

```ts
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const access = await requireReportAccess(request, id);
  if (!access.ok) return access.response;

  // Continue with preview query using access.session.
}
```

### Component Layer

Create a `usePermission` hook for conditional navigation, buttons, and empty states.

```ts
import { useAppStore } from "@/store/app-store";
import type { Report, UserRole } from "@/types/report-center";

const roleRank: Record<UserRole, number> = {
  viewer: 1,
  supervisor: 2,
  manager: 3,
  admin: 4,
};

export function usePermission() {
  const user = useAppStore((state) => state.user);

  return {
    canViewModule(moduleSlug: string) {
      return Boolean(user?.moduleAccess.includes(moduleSlug));
    },
    canViewReport(report: Report) {
      if (!user) return false;
      return report.requiredRoles.some((role) => roleRank[user.role] >= roleRank[role]);
    },
    canExport(report: Report) {
      if (!user) return false;
      return ["admin", "manager", "supervisor"].includes(user.role) && this.canViewReport(report);
    },
  };
}
```

Component example:

```tsx
const permission = usePermission();

if (!permission.canViewReport(report)) {
  return <EmptyState title="Anda tidak memiliki akses ke laporan ini." />;
}

return (
  <Button disabled={!permission.canExport(report)} onClick={createExport}>
    Export
  </Button>
);
```

### Data Layer

All SQL sent to the SQL Gateway must include user scope. Never trust client-provided `division` or `gang` as the only filter.

```ts
export function buildScopeWhere(session: UserSession) {
  const where: string[] = [];
  const params: Record<string, string> = {};

  if (session.role !== "admin" && session.division) {
    where.push("division = :sessionDivision");
    params.sessionDivision = session.division;
  }

  if (["viewer", "supervisor"].includes(session.role) && session.gang) {
    where.push("gang = :sessionGang");
    params.sessionGang = session.gang;
  }

  return {
    sql: where.length ? `AND ${where.join(" AND ")}` : "",
    params,
  };
}
```

SQL Gateway request example:

```ts
const scope = buildScopeWhere(session);

await queryGateway({
  profile: process.env.DATABASE_PROFILE ?? "SERVER_PROFILE_3",
  queryKey: report.queryKey,
  params: {
    ...filters,
    ...scope.params,
  },
  scopeWhere: scope.sql,
});
```

## Gap 2: Search Security

Search must never leak unauthorized module names, report names, descriptions, row data, or counts.

Implementation rules:

- Search filtering is server-side only.
- The browser sends only `q`; it never sends access scopes.
- The API derives accessible modules and reports from the session.
- The result set must exclude every report the user cannot open.
- Search index entries must be scoped by module access, report role, division, and gang where applicable.
- Highlight snippets must come only from metadata the user can access.

Secure search route pattern:

```ts
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) return authExpiredResponse();

  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ data: [], meta: { query: q, count: 0 }, error: null });
  }

  const accessibleReportIds = await getAccessibleReportIds(session);
  const results = await searchReports({
    query: q,
    reportIds: accessibleReportIds,
    limit: Number(process.env.SEARCH_MAX_RESULTS ?? 50),
  });

  return NextResponse.json({
    data: results,
    meta: { query: q, count: results.length },
    error: null,
  });
}
```

Invalid behavior:

```ts
// Do not search all reports and filter later in the browser.
const allResults = await searchReports({ query: q });
return NextResponse.json(allResults);
```

## Gap 3: Export Audit Trail

Every export request must create an audit row before the job starts. Failed jobs remain in the log with status `failed` and an error message in application logs.

Schema:

```sql
CREATE TABLE export_audit_log (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  report_id VARCHAR(128) NOT NULL,
  format VARCHAR(16) NOT NULL,
  filters_applied JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  status VARCHAR(24) NOT NULL,
  file_path VARCHAR(512) NULL,
  file_size BIGINT NULL
);

CREATE INDEX idx_export_audit_user_created
  ON export_audit_log (user_id, created_at DESC);

CREATE INDEX idx_export_audit_report_created
  ON export_audit_log (report_id, created_at DESC);

CREATE INDEX idx_export_audit_status
  ON export_audit_log (status);
```

Allowed statuses:

- `queued`
- `processing`
- `completed`
- `failed`
- `expired`

Retention policy:

- Keep audit rows and generated files for 90 days.
- A daily cleanup job marks old completed jobs as `expired`.
- Physical files older than 90 days are deleted from `EXPORT_STORAGE_PATH`.
- Audit rows may be archived after 90 days if compliance requires long-term history.

Cleanup query:

```sql
UPDATE export_audit_log
SET status = 'expired'
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
  AND status IN ('completed', 'failed');
```

## Gap 4: AI Chat Grounding

MiniMax M2.5 integration must be grounded in the current Report Center context. The assistant may explain visible report data, filters, and export steps. It must not invent database values or claim access to hidden reports.

System prompt:

```text
Anda adalah asisten AI untuk Report Center. Jawab dalam Bahasa Indonesia yang ringkas dan operasional.
Gunakan hanya konteks yang diberikan: nama modul, nama laporan, filter aktif, kolom, dan data preview.
Jangan menebak data yang tidak tersedia. Jika data tidak cukup, minta pengguna membuka preview atau mempersempit filter.
Jangan menampilkan laporan, modul, divisi, gang, atau data yang tidak ada dalam konteks.
Jika pengguna meminta export, jelaskan langkah di UI. Jangan membuat file langsung kecuali API export tersedia di konteks tool.
```

Context window shape:

```json
{
  "module": {
    "name": "Produksi",
    "slug": "production"
  },
  "report": {
    "id": "rpt-daily-production",
    "name": "Produksi Harian"
  },
  "filters": {
    "period": "2026-05",
    "division": "A"
  },
  "columns": ["tanggal", "division", "total_output"],
  "previewData": [
    {
      "tanggal": "2026-05-17",
      "division": "A",
      "total_output": 1200
    }
  ]
}
```

Fallback when MiniMax API is unavailable:

- Keep the chat panel open.
- Show a retry action.
- Do not drop the user's typed message.
- Log the provider error server-side without exposing API details.

Indonesian fallback messages:

- Timeout: `AI membutuhkan waktu terlalu lama. Coba lagi beberapa saat.`
- Provider unavailable: `Layanan AI sedang tidak tersedia. Coba lagi nanti.`
- Missing context: `Buka preview laporan terlebih dahulu agar AI bisa membaca konteks data.`
- Permission mismatch: `AI tidak dapat membaca laporan yang tidak bisa Anda akses.`

## Gap 5: Error Handling Matrix

| Case | Detection | HTTP Status | User Message | Action |
| --- | --- | --- | --- | --- |
| Network error | `fetch` throws, timeout, offline | N/A | `Koneksi terputus. Periksa jaringan Anda.` | Keep current screen, allow retry |
| Auth error | Missing or expired session | 401 | `Sesi berakhir. Silakan login ulang.` | Redirect to login after acknowledgement |
| Permission error | Role, module, report, division, or gang denied | 403 | `Anda tidak memiliki akses ke laporan ini.` | Hide data, show empty state |
| Server error | Unhandled exception or SQL Gateway 5xx | 500 | `Server sedang sibuk. Coba beberapa saat.` | Log error ID, allow retry |
| Not found | Module/report/export ID missing | 404 | `Laporan tidak ditemukan.` | Return to module list |
| Export failed | Export worker status `failed` | 200 queue response with failed job | `Export gagal. File akan dihapus dari antrian.` | Mark failed, remove generated partial file |

Shared API error helper:

```ts
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json(
    {
      data: null,
      meta: {},
      error: { code, message },
    },
    { status },
  );
}

export const errors = {
  network: "Koneksi terputus. Periksa jaringan Anda.",
  auth: "Sesi berakhir. Silakan login ulang.",
  permission: "Anda tidak memiliki akses ke laporan ini.",
  server: "Server sedang sibuk. Coba beberapa saat.",
  notFound: "Laporan tidak ditemukan.",
  exportFailed: "Export gagal. File akan dihapus dari antrian.",
};
```

Client-side handling:

```ts
try {
  const response = await fetch("/api/export", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  if (!response.ok) {
    toast.error(body.error?.message ?? errors.server);
    return;
  }

  toast.success("Export masuk antrian.");
} catch {
  toast.error(errors.network);
}
```
