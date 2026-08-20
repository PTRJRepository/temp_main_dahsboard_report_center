# 17 — Performance

**Last verified:** 2026-07-21

## Report Center

| Topic | Implementation notes |
|---|---|
| Initial table window | Often first N rows (e.g. 500) not full table |
| Payload filters | Many filters applied after SQL → large intermediate payloads risk |
| Virtualized tables | `@tanstack/react-virtual` in viewer |
| Export caps | `EXPORT_MAX_ROWS` / handler limits |
| KPI strip | Multiple parallel summary fetches — can be chatty |

## Monthly stock movement

- Snapshot mode uses month-end tables for past periods (cheaper than replaying all live transactions incorrectly).
- Limit clamping on JSON API (default 500, max 20000).
- Complex CTE SQL — avoid unbounded concurrent runs.

## Firebird gateway

- **Serialize** isql (`withIsqlLock`) — concurrency queues.
- Avoid `COUNT(DISTINCT)` across large UNIONs (timeout class of bugs).
- Temp SQL file names must be unique (pid/seq) to avoid collisions.

## Frontend

- Prefer not stacking multiple heavy panels above the catalog (scroll cost).
- Debounce URL search updates (implemented on inventory catalog search).
- Keep filter updates on current path to avoid remount/redirect loops.

## Related PRDs

- `docs/10-prd-docs/PRD-Report-Detail-Performance-Optimization.md`
- `lib/reports/report-detail-performance.ts`
