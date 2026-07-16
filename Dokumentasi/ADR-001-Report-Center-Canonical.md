# ADR-001: Mark `Module Services/report-center` as Deprecated

**Date:** 2026-07-16
**Status:** Accepted
**Context:** Phase 0 discovery found a divergent UI clone of the Report Center.

## Background

During Phase 0 discovery (`Dokumentasi/PHASE_0-Discovery-Baseline.md`), scanning revealed
two Report Center codebases:

| Aspect | `Dashboard_Utama/` | `Module Services/report-center/` |
|--------|-------------------|-------------------------------|
| Gateway route | `http://127.0.0.1:3100` (active) | Not routed |
| `app/api/reports/` | **YES** — live API handlers | **NO** — not present |
| `lib/reports/` | Yes | Yes |
| Report handlers | MSSQL via `mssql` library | MSSQL via `mssql` library |
| Unique components | Full dashboard, auth, all modules | `ReportCenterShell.tsx`, `MonitoringVisualSection`, AI cards |
| Last active | Current | Unknown (not routed) |

## Decision

Mark `Module Services/report-center/` as **deprecated**.

- It is not routed by the gateway — no user impact from deprecation.
- It has no API route handlers — cannot serve reports independently.
- It contains unique UI components (`ReportCenterShell`, monitoring visuals, AI cards) that should be evaluated for merge into `Dashboard_Utama`.
- The canonical Report Center is `Dashboard_Utama/app/(report-center)/`.

## Consequences

### Before deletion

1. **Merge unique components** into `Dashboard_Utama`:
   - `ReportCenterShell.tsx` — evaluate if it adds functionality not in `Dashboard_Utama`'s shell
   - `MonitoringVisualSection` — evaluate if monitoring-specific UI belongs in the dashboard
   - AI insight card components — check if they differ from `Dashboard_Utama`'s AI components

2. **Audit for divergence** — any report business logic, filters, or configurations in the module that don't exist in `Dashboard_Utama` must be preserved.

3. **Verify no shared data** — check that neither codebase references the other's file paths at runtime.

### After deletion

- Remove `Module Services/report-center/` from the repository.
- Update any documentation that references it.

## Alternatives considered

| Option | Decision | Rationale |
|--------|---------|-----------|
| Keep both, reconcile on read | Rejected | Dual maintenance burden, diverges further |
| Route `Module Services/report-center` as canonical | Rejected | No API handlers = reports don't work |
| Archive only (don't delete) | Rejected | Dead code; keep only if there's a rollback requirement |
| Delete immediately | Rejected | Unique UI components need merge first |

## Action items

- [ ] Audit unique components in `Module Services/report-center/` for merge into `Dashboard_Utama`
- [ ] Verify no runtime references to `Module Services/report-center/` from other services
- [ ] Merge or discard unique UI components
- [ ] Delete `Module Services/report-center/` after merge approval
