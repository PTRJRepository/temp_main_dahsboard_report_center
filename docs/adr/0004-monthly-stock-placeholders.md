# ADR 0004 — Monthly stock placeholder measures

- **Status:** Proposed (implementation already partial)
- **Date:** 2026-07-21

## Context

RPTIN1000015 reconstruction implements opening, issues, returns, purchasing receive/return, and closing. Several legacy columns remain unimplemented.

## Decision (current code)

Ship measures with `status: 'placeholder_zero'` for: received, return_advice, transferred, adjustment, purchasing_dispatch_advice — returning zeros rather than failing the report.

## Alternatives

1. Hide unimplemented columns in UI until SQL exists.
2. Block report release until full parity.

## Consequences

- Users may misread zeros as true business zero.
- Nested JSON exposes status for honest clients.

## Evidence

- `MONTHLY_MOVEMENT_DEFINITIONS` in `monthly-stock-account-movement.ts`

## Follow-up

- Prefer UI hide or watermark for placeholder columns.
- Implement remaining SQL with tests.
