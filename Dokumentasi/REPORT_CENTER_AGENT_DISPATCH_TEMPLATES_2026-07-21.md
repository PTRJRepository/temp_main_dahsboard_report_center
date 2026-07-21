# Agent Dispatch Templates — Report Center Redesign

**Date:** 2026-07-21  
**Use:** Copy one block into Codex/Claude/Hermes. Attach exploration pack paths; do not rely on chat memory.

**Pack root:** `D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/`  
**Index:** `REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md`  
**Checklist:** `REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md`  
**Risks:** `REPORT_CENTER_RISK_REGRESSION_REGISTER_2026-07-21.md`  
**Line map:** `REPORT_VIEWER_CLIENT_SECTION_LINE_MAP_2026-07-21.md`  
**Wireframe:** `mocks/report-detail-monthly-wireframe-2026-07-21.html`

**Iron laws:** no invented accounting formulas; no currency on period/qty/count; no big-bang 6k rewrite; no secrets in commits; preserve forest theme; monthly first.

**Checkpoints:** `05dd66b` pre-redesign · `4fe3253` typed metrics.

---

## Dispatch A — Honesty labels only (P1)

```
GOAL: Phase P1 scope honesty labels only. No SQL/formula changes.

READ:
- Dokumentasi/REPORT_DETAIL_EXPORT_AI_SCOPE_EXPLORATION_2026-07-21.md
- Dokumentasi/REPORT_CENTER_RISK_REGRESSION_REGISTER_2026-07-21.md

DO:
1. PDF button label + PDF document text watermark: pratinjau max 34 baris / 7 kolom
2. Excel/CSV: after action, user-visible note about system ceiling (100k monthly / 20k other)
3. AI panel: chips from aiSampleRows / aiPayloadCompacted metadata
4. Table footer line: loaded/filtered + KPI dari ringkasan server

FILES: ReportViewerClient.tsx export helpers + AI panel + table footer only.
TEST: format.test.ts, tsc --noEmit
RETURN: OK/FAIL + files + commands
```

---

## Dispatch B — Filter collapse (P2)

```
GOAL: Single period + single chip bar for monthly detail. No accounting SQL change.

READ:
- Dokumentasi/REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md
- Dokumentasi/REPORT_VIEWER_CLIENT_SECTION_LINE_MAP_2026-07-21.md (JSX 4949-5700)

DO:
1. Create AppliedFilterBar + thin control ownership for period/group/window
2. Hide standalone period section when monthly sticky/control already has period
3. Do not show second chip list as primary inside natural filter panel
4. Keep URL sync + commitReportFilters behavior

FILES: prefer new components under components/report-center/; wire from viewer
TEST: report-filtering.test.ts, tsc
RETURN: OK/FAIL + screenshots if server up
```

---

## Dispatch C — Monthly Ringkasan (P3)

```
GOAL: Professional ≤6 KPI strip for RPTIN1000015. Match metric-dictionary labels (ID).

READ:
- Dokumentasi/REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md
- Dokumentasi/REPORT_DETAIL_TARGET_WIREFRAME_2026-07-21.md
- Dashboard_Utama/lib/reports/inventory/metric-dictionary.md
- mocks/report-detail-monthly-wireframe-2026-07-21.html

DO:
1. Adapter from summary → Saldo Awal, Penerimaan, Pengeluaran, Retur, Saldo Akhir, Jumlah Item
2. Remove/hide full-width issued callout; optional disclosure under Pengeluaran
3. Prefer AnalyticsKpiStrip or rc-kpi tokens; no rainbow equal borders
4. Keep pickSummaryOnly guardrail
5. Extract MonthlyStockRingkasan if stable

TEST: monthly-stock-account-movement.test.ts, format.test.ts, tsc
RETURN: OK/FAIL + before/after notes
```

---

## Dispatch D — Viewer profiles extract (P4)

```
GOAL: Move getReportViewerProfile + column constants out of ReportViewerClient with ZERO behavior change.

READ:
- Dokumentasi/REPORT_CENTER_SHELL_CATALOG_PROFILES_EXPLORATION_2026-07-21.md
- Line map zone 2168-2340

DO:
1. Create lib/reports/inventory/viewer-profiles/*
2. Re-export getReportViewerProfile
3. Viewer imports from new module
4. No JSX redesign in this task

TEST: tsc --noEmit + smoke monthly profile columns
RETURN: OK/FAIL + file list
```

---

## Dispatch E — Table toolbar triage (P5 partial)

```
GOAL: Table toolbar = table tools only. Move AI/Charts/SQL/Quality to non-toolbar entry.

READ:
- Dokumentasi/REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md

DO:
1. Overflow menu for secondary actions
2. Hide SQL Debug from default toolbar (Audit later)
3. Fix light #F0F4FA context strip to dark tokens if touched

TEST: tsc
RETURN: OK/FAIL
```

---

## Dispatch F — Read-only auditor

```
GOAL: FIND + REPORT only. No file writes.

READ full exploration index. Open monthly route if possible.
RETURN: top 10 remaining UX defects with severity + file:line if known.
```

---

## Lead merge order

A → B → C → D → E. Never two writers on ReportViewerClient without D first or explicit line-range split.

---

**End dispatch templates.**
