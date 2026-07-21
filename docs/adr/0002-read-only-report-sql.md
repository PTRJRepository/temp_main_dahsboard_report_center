# ADR 0002 — Read-only SQL for report databases

- **Status:** Accepted
- **Date:** 2026-07-21 (documented)

## Context

Report Center queries production-like MSSQL estate/mill databases. Write access would risk operational data.

## Decision

All report SQL must be read-only. Enforce with `validateReadOnlySql` and natural-language write-verb rejection. Application policy: never write/delete/alter `db_ptrj` / `db_ptrj_mill`.

## Alternatives

1. Dedicated read replicas only — still need query guards.
2. Materialized warehouse — larger project.

## Consequences

- Some analytics must be computed in app after SELECT.
- Export and AI operate on fetched payloads, not ad-hoc writes.

## Evidence

- `lib/reports/report-filtering.ts`
- Project feedback memory DB read-only policy
- Inventory handlers pattern

## Follow-up

- Expand static analysis CI for raw SQL strings.
