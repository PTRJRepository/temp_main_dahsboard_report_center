# Report Center Redesign — Comprehensive Debug Report

**Date:** 2026-07-21  
**Method:** Systematic debugging (root cause first, no symptom-only patches)  
**Scope:** Report Detail redesign, first target `monthly-stock-account-movement-details` / `RPTIN1000015`  
**Branch:** `main`  
**Checkpoints:**
- Pre-redesign: `05dd66b` — `chore(report-center): checkpoint before total redesign of report detail`
- After readability pass: `4fe3253` — `fix(report-center): calm monthly Ringkasan hierarchy + typed metrics`

Rollback:
```bash
git reset --hard 05dd66b   # before redesign
git reset --hard 4fe3253   # after calm hierarchy + typed metrics
```

---

## 1. Executive summary

| Area | Status | Evidence |
| --- | --- | --- |
| Typed metric formatting | **Fixed at root** | `utils/format.ts` + tests; period/qty/count no longer forced to `Rp` |
| KPI call-site wiring | **Fixed** | 0 bare `compactMetric(value)` calls; all pass field/label |
| Primary value truncation | **Improved** | Primary KPI spans use `whitespace-normal break-all` / `rc-kpi-value` |
| Subtotal visual noise | **Improved** | Soft amber + left accent; CSS no longer remaps `#167A3A` to solid warning fill |
| SQL/debug prominence | **Improved** | Hover/focus-only SQL chips (`rc-sql-debug` + parent `group`) |
| Monthly hierarchy noise | **Improved** | Sticky grand hidden when flow KPIs present; secondary rails collapsed by default |
| Unit tests (report suite) | **Pass** | format, monthly stock, filtering, movement-category, column-glossary, ai-insight, module-panel, report-detail-performance |
| Typecheck | **Pass** | `npx tsc --noEmit` exit 0 |
| Browser visual QA | **Not run this session** | No live screenshot verification of monthly route |
| Full 4-workspace shell | **Not done** | Still monolith `ReportViewerClient.tsx` (~6461 lines) |
| Export scope honesty dialog | **Not done** | Existing export limits not re-verified end-to-end |
| AI sample labeling | **Partial** | Scope types exist in `report-experience.ts`; UI honesty not fully enforced everywhere |

---

## 2. Phase 1 — Root cause investigation

### 2.1 Defect: periods / counts / qty shown as currency

**Symptom:** KPI/rail could show `Actual Period` / counts / quantities with `Rp` prefix or money formatting.

**Root cause (confirmed in code):**
1. Local `compactMetric` in `ReportViewerClient.tsx` always called `formatAmount4` (currency) for any finite number.
2. `isAmountField` was a loose regex and not used by `compactMetric`.
3. Call sites often passed only the value, never the field key/label, so semantic kind could not be recovered.

**Not root cause:** Database payload storing periods as money; the bug was presentation-layer.

**Fix applied at source:**
- Shared `inferMetricKind` / `formatMetric` / `formatKpiValue` in `Dashboard_Utama/utils/format.ts`
- `compactMetric(value, field?, label?)` → `formatKpiValue`
- All call sites pass field + label

**Verification samples (runtime):**

| Field | Kind | Formatted sample |
| --- | --- | --- |
| `ActualPeriod` | period | `2025-07` |
| `ClosingQty` | quantity | `12,5` (no Rp) |
| `TotalItem` | count | `42` (no Rp) |
| `OpeningAmount` | currency | `Rp 1.000,0000` |
| `AccPeriod` | period | `0` (not `Rp 0`) |
| `StockIssueEventCount` | count | `7` |

Test: `npx tsx utils/format.test.ts` → **ok**

### 2.2 Defect: subtotals looked like warnings / primary CTAs

**Symptom:** Group subtotal rows loud green/orange, competing with data.

**Root causes:**
1. TSX used solid fills (`bg-amber-500`, `bg-[#167A3A]`).
2. `globals.css` remapped `.bg-[#167A3A]` under `.report-center-dark` to **primary accent** with dark text — made subtotals look like action buttons.

**Fix:**
- TSX: calm surface + left accent (`rc-subtotal-row`, `bg-[#13261c]`, `border-l-2 border-amber-400/70`, cell `bg-amber-500/15`)
- CSS: subtotal remap to muted premium gold tint, not solid accent

### 2.3 Defect: page too long / cognitively noisy (monthly)

**Symptom:** Sticky grand totals + official flow + global cards + product-type grids + movement cards + SQL badges on one canvas.

**Root causes:**
1. Multiple rails rendered always, no progressive disclosure for monthly.
2. Sticky “Grand total” duplicated flow KPI story when both present.
3. SQL affordances styled as high-contrast amber pills on every card.

**Fix (presentation hierarchy, not formula change):**
- Hide sticky grand strip when `isMonthlyStockMovement && flowKpiCards.length > 0`
- Cap monthly flow cards to 6 in render
- Collapse global/breakdown/sub/movement behind `monthlySecondaryOpen` (default false)
- SQL chips opacity 0 until hover/focus; parent containers get `group`

### 2.4 Defect: maintainability / agent drift

**Symptom:** Large prompts + 6k-line viewer → agents invent inconsistent structures.

**Root cause:** No single shared implementation contract checked into repo.

**Fix:**
- `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md`
- `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md`
- Advanced master prompt (companion file in this session)

---

## 3. Phase 2 — Pattern analysis

| Working pattern | Broken pattern (before) | Difference |
| --- | --- | --- |
| `report-experience.ts` already defines `ReportValueFormat` and `ReportKpiScope` | Viewer ignored kinds and used currency everywhere | Presentation not connected to type model |
| Column glossary for labels/help | KPI strip used free labels + currency | Inconsistent semantic layer |
| CSS tokens `.report-center-dark` / forest | Inline bright Tailwind fills + bad remap | Tokens not used for subtotal/SQL |
| Summary-first SQL aggregates | Client window totals sometimes mixed | Scope honesty incomplete |

---

## 4. Phase 3 — Hypotheses tested

| Hypothesis | Test | Result |
| --- | --- | --- |
| H1: currency force is in `compactMetric` | Code read + replace with kind inference | Confirmed; tests pass |
| H2: CSS remap makes subtotals loud | Inspect `globals.css` `#167A3A` rule | Confirmed; remap softened |
| H3: sticky grand duplicates flow on monthly | Conditional hide when flow present | Confirmed by structure |
| H4: bare call sites still force wrong kind | Scan for `compactMetric(` without comma | **0 bare** remaining |

---

## 5. Test matrix (executed)

| Command / suite | Result |
| --- | --- |
| `npx tsx utils/format.test.ts` | pass |
| `npx tsc --noEmit` | pass (exit 0) |
| `npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts` | pass |
| `npx tsx lib/reports/report-detail-performance.test.ts` | pass |
| `npx tsx lib/reports/movement-category.test.ts` | pass |
| `npx tsx lib/reports/report-filtering.test.ts` | pass |
| `npx tsx lib/reports/module-panel.test.ts` | pass |
| `npx tsx lib/reports/inventory/column-glossary.test.ts` | pass |
| `npx tsx app/api/reports/ai-insight/route.test.ts` | pass |
| Browser E2E monthly report | **not run** |
| Export Excel/PDF full-scope check | **not re-verified** |

---

## 6. Files changed in redesign pass (`4fe3253`)

| File | Role |
| --- | --- |
| `Dashboard_Utama/utils/format.ts` | Typed `MetricKind` formatters |
| `Dashboard_Utama/utils/format.test.ts` | Guardrails for period/qty/count/currency |
| `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` | Wire formatters, calm subtotals, SQL demotion, monthly collapse |
| `Dashboard_Utama/app/globals.css` | Subtotal remap fix + hierarchy utilities |
| `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` | Metric/scope dictionary for RPTIN1000015 |
| `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` | Agent-shared implementation contract |

Unrelated dirty tree (not part of redesign commit): `README.md` modified; untracked `.env.development`, `Dokumentasi.zip`, some scripts — **do not commit secrets**.

---

## 7. Remaining risks (ordered)

1. **No live browser proof** of monthly report after hierarchy change.  
2. **Flow KPI builder still produces more than 6** at data layer; UI only slices to 6.  
3. **Monolith remains** (~6461 lines) — high conflict risk for parallel agents.  
4. **Placeholder_zero movements** may still appear as real if cards not status-aware.  
5. **Export/AI scope honesty** not fully productized (dialog + labels).  
6. **CSS `!important` remaps** can still fight Tailwind in edge cases — watch non-subtotal greens.  
7. **Agent drift** if agents ignore `REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md`.

---

## 8. Recommended next debug/implement order

1. Live open `/report-center/inventory/monthly-stock-account-movement-details` — screenshot Ringkasan before/after.  
2. Cap `buildOfficialMovementFlowKpis` / monthly KPI builder to verified primary 6 fields.  
3. Add automated assertion: `formatKpiValue` never emits `Rp` for known period/qty/count fields (extend tests).  
4. Extract `MonthlyStockRingkasan.tsx` only after visual sign-off.  
5. Export dialog: declare scope + expected row count.  
6. AI panel: always show sample vs full-scope chip.

---

## 9. Quality gate snapshot (design)

| Question | Now |
| --- | --- |
| Page calmer for monthly? | Better (secondary collapsed) — needs visual confirm |
| ≤ meaningful primary KPIs? | UI cap 6 flow; builder not fully capped |
| Period/qty not currency? | Yes (unit verified) |
| SQL not default noise? | Yes (hover) |
| Subtotals calm? | Yes (code+CSS) |
| Same app identity (forest)? | Yes, preserved |
| 5-second understanding? | Improved; not fully proven |

---

## 10. Conclusion

Root causes for the worst readability defects (currency-everything, loud subtotals, duplicate totals, SQL noise) were **presentation-layer**, not accounting SQL. Fixes were applied at those sources with unit-test evidence. Architecture-level goals (4 workspaces, export honesty, full shell extract) remain open and must continue under the advanced master prompt so agents stay aligned.

**Do not claim production-complete** until browser QA + export/AI scope checks pass.
