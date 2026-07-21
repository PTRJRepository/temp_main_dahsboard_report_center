# 15 — Testing

**Last verified:** 2026-07-21

## Framework

- No Jest/Vitest/Playwright test script in root or `Dashboard_Utama` `package.json` `test` field.
- Pattern: **standalone Node assert modules** named `*.test.ts` run via `npx tsx`.

## Commands

| Check | Command | Result (session) |
|---|---|---|
| Typecheck | `cd Dashboard_Utama && npx tsc --noEmit` | Pass (2026-07-21) |
| Lint | `cd Dashboard_Utama && npm run lint` | Not re-run in final doc pass |
| Report filtering | `npx tsx lib/reports/report-filtering.test.ts` | Pass |
| Accounting period | `npx tsx lib/reports/accounting-period.test.ts` | Available |
| Module panel | `npx tsx lib/reports/module-panel.test.ts` | Pass |
| Monthly stock | `npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts` | Pass when executed in session |
| Inventory overview KPI helpers | `npx tsx components/report-center/InventoryOverview.test.tsx` | Pass earlier session |
| Gateway smoke | `npm run smoke:gateway` | Script exists; not executed this pass |
| E2E browser | Manual Playwright against login + procurement | Partial (auth + KPI groups observed) |
| Production build | `npm run build` / `build:dashboard` | Not executed this pass |

## Test locations

- `Dashboard_Utama/lib/reports/**/*.test.ts`
- `Dashboard_Utama/lib/reports/inventory/**/*.test.ts`
- `Dashboard_Utama/components/report-center/*.test.tsx`
- `Dashboard_Utama/app/api/reports/**/*.test.ts` (e.g. ai-insight)
- Root `tests/` (if populated)

## Guidance for new tests

1. Prefer pure functions (filters, period math, movement definitions).
2. Keep tests free of real DB credentials.
3. Mark integration tests that need MSSQL as optional/manual.
4. Do not claim coverage % without a coverage runner.

## CI

No verified required GitHub Actions workflow documented in this pass. **Unverified** whether remote CI enforces `tsc`/lint.
