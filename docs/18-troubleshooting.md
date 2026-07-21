# 18 — Troubleshooting

**Last verified:** 2026-07-21

### Symptom: Application / gateway does not start
**Likely causes:** Port in use; missing Bun/Node; bad env.  
**Diagnostic:** `netstat`/Task Manager for port 3001; check `server_bun.err.log`.  
**Resolution:** `PORT=3002` for gateway; kill zombie only if session allows; reinstall deps.  
**Related:** `CLAUDE.md` port 3001 zombie note.

### Symptom: Dependencies fail to install
**Likely causes:** Network registry; peer deps on Next 16.  
**Diagnostic:** npm error log.  
**Resolution:** `npm ci --legacy-peer-deps` (Docker build uses legacy-peer-deps).

### Symptom: Missing environment variables
**Likely causes:** No `.env.local`; Docker without `.env.docker`.  
**Diagnostic:** Feature fails only in one environment.  
**Resolution:** Copy examples; see [05-configuration.md](./05-configuration.md).

### Symptom: Login fails
**Likely causes:** Wrong credentials; auth DB unreachable; JWT keys missing.  
**Diagnostic:** Network tab `/api/auth/login`; server logs.  
**Resolution:** Verify user store; generate keys; check cookie domain/path.

### Symptom: Report Center redirects to login
**Likely causes:** Missing `auth-token`/`payroll_auth_token`.  
**Diagnostic:** Application cookies in browser.  
**Resolution:** Re-login; ensure API sets cookies `credentials: 'include'`.

### Symptom: Inventory report empty / wrong multi-year totals (Firebird)
**Likely causes:** Missing `TRANSDATE` filter on scanner partitions.  
**Diagnostic:** Compare with known monthly headcount.  
**Resolution:** Inject year/month bounds; see Firebird rules in [03-architecture.md](./03-architecture.md).

### Symptom: Inventory report timeout
**Likely causes:** Heavy SQL; concurrent isql; MSSQL timeout.  
**Diagnostic:** Gateway logs ETIMEDOUT; zombie isql.  
**Resolution:** Serialize queries; raise timeout carefully; kill orphan isql >60s.

### Symptom: Filter change reloads whole page / loses scroll
**Likely causes:** URL written to `/report-center/inventory` causing redirect remount.  
**Diagnostic:** Watch location bar on filter change.  
**Resolution:** Keep path `/report-center/procurement` when embedded (fixed in `InventoryReportsClient`).

### Symptom: KPI numbers disagree between strips
**Likely causes:** Different reports/scopes; duplicate KPI UIs historically.  
**Diagnostic:** Check which component rendered; source/period chips.  
**Resolution:** Prefer Procurement command deck groups; InventoryOverview KPI strip removed.

### Symptom: Monthly stock columns always zero for Received/Transfer
**Likely causes:** `placeholder_zero` measures not implemented.  
**Diagnostic:** Nested JSON `column_definitions.status`.  
**Resolution:** Treat as known limitation; implement SQL or hide columns.

### Symptom: Docker blank page on 8080
**Likely causes:** Static volume mismatch; app unhealthy.  
**Diagnostic:** `docker-compose ps`; nginx error logs; curl app:3001.  
**Resolution:** Rebuild; ensure `.next/static` volumes match Dockerfile standalone output.

### Symptom: Export fails
**Likely causes:** Row cap; browser memory; API error mid-fetch.  
**Diagnostic:** Console errors; reduce date range.  
**Resolution:** Lower `EXPORT_MAX_ROWS`; filter first.

### Symptom: AI insight useless / generic
**Likely causes:** No payload; model env missing; fallback path.  
**Diagnostic:** `/api/reports/ai-insight` response warnings.  
**Resolution:** Ensure report payload loaded; configure `LOCAL_LLM_*` or Anthropic token.

### Escalation
Include: URL, source estate/pabrik, report id, period, screenshot, response body (redact secrets), gateway log excerpt.
