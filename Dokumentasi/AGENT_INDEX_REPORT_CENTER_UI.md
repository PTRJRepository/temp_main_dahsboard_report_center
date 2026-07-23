# AGENT INDEX — Report Center UI + KPI + Audit Docs

**Purpose:** Fast onboarding for any coding/docs agent. Read this first.  
**Rule for agents:** Prefer this index over scanning all of `Dokumentasi/`.  
**Code changes:** Only if the human explicitly asks. Many packs below are **docs-only**.  
**Last updated:** 2026-07-22  

---

## 60-second briefing

| What | Where | Status |
|------|--------|--------|
| UI living docs (start here) | `Dokumentasi/UI-REPORT-CENTER-CURRENT/` | Living |
| KPI redesign plan | `Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md` | Plan + partial LIVE |
| KPI catalog pick-list | `Dokumentasi/KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md` | Reference |
| KPI implement prompt | `Dokumentasi/PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md` | Prompt for implement agents |
| **Refactor prompt (commit first)** | `Dokumentasi/PROMPT_AGENT_REPORT_CENTER_REFACTOR_COMMIT_FIRST.md` | **Handoff: commit → P0 PDF honesty → KPI/table** |
| UI/PDF/table audit (exec) | `Dokumentasi/UI-REPORT-CENTER-CURRENT/19-EXECUTIVE-SUMMARY-AUDIT.md` | Docs only · ~6.5/10 |
| PDF redesign spec | `Dokumentasi/UI-REPORT-CENTER-CURRENT/18-PDF-REDESIGN-SPEC.md` | Spec only · not implemented |
| Detail redesign (Jul 2026) | `Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md` | Exploration pack |
| Diagram one-file HTML | `Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html` | 14 boxed diagrams |
| Inventory diagram prompt | `Dokumentasi/PROMPT_AGENT_DIAGRAM_REPORT_CENTER_INVENTORY.md` | Prompt |

**Runtime:** gateway often `:3001` · production `bun run server_bun.js` · `/report-center/*` needs login.

---

## Read order by task

### A) Understand current UI (any agent)
1. `UI-REPORT-CENTER-CURRENT/00-INDEX.md`
2. `UI-REPORT-CENTER-CURRENT/19-EXECUTIVE-SUMMARY-AUDIT.md` (if quality/PDF matters)
3. `UI-REPORT-CENTER-CURRENT/02-KPI-COMMAND-DECK.md`
4. `UI-REPORT-CENTER-CURRENT/12-WIREFRAME-FULL-PAGE.md`
5. `UI-REPORT-CENTER-CURRENT/13-FILTER-MATRIX.md`
6. Deep as needed: `08` overview · `09` catalog · `10` monthly · `04` table

### B) Implement KPI deck (only if user says implement)
1. `PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md` (full contract)
2. `PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md`
3. `KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md`
4. Code: `Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx`
5. Parent: `ProcurementModuleWorkspace.tsx`

### C) PDF / export work (only if user says implement)
1. `UI-REPORT-CENTER-CURRENT/18-PDF-REDESIGN-SPEC.md`
2. `UI-REPORT-CENTER-CURRENT/17-AUDIT-UX-PDF-TABLE-PERF.md` §PDF
3. `UI-REPORT-CENTER-CURRENT/17-CLAUDE-CODE-AUDIT-RAW.md` P0 PDF findings
4. **Preferred full handoff:** `PROMPT_AGENT_REPORT_CENTER_REFACTOR_COMMIT_FIRST.md` (commit first + phases)
5. Code (read-only until implement):  
   - `ReportViewerClient.tsx` ~exportPdf 2047–2068  
   - `InventoryReportsClient.tsx` ~exportPdf 928–947  
   - `ExportPreflightDialog.tsx`

### F) Full refactor handoff (commit → PDF honesty → deck → table)
1. `PROMPT_AGENT_REPORT_CENTER_REFACTOR_COMMIT_FIRST.md` ★  
2. `AGENT_INDEX_REPORT_CENTER_UI.md` (this file)  
3. `19-EXECUTIVE-SUMMARY-AUDIT.md` + `18-PDF-REDESIGN-SPEC.md`  
4. Execute Phase 0 commit checkpoint before any app code

### D) Report detail monthly redesign
1. `REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md`
2. `UI-REPORT-CENTER-CURRENT/10-MONTHLY-DETAIL-RINGKASAN.md`
3. Code: `MonthlyStockRingkasan.tsx`, `ReportControlBar.tsx`, `ReportViewerClient.tsx`

### E) Inventory domain / SQL / diagrams
1. `PROMPT_AGENT_DIAGRAM_REPORT_CENTER_INVENTORY.md` or open HTML diagrams
2. `Monthly-Stock-Account-Movement-Details/README.md`
3. `Report Inventory Kebun/good_receipt_correlation.md`
4. `INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md`

---

## Full file map — `UI-REPORT-CENTER-CURRENT/`

Base: `D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/UI-REPORT-CENTER-CURRENT/`

| # | File | Agent use |
|---|------|-----------|
| 00 | `00-INDEX.md` | Pack TOC + principles |
| 01 | `01-SCREEN-MAP-AND-IA.md` | Routes, page stack, dual monolit |
| 02 | `02-KPI-COMMAND-DECK.md` | **Current KPI UI** filters/cards/fetches |
| 03 | `03-UX-FLOWS.md` | User flows CEO→detail |
| 04 | `04-TABLE-AND-DETAIL-DESIGN.md` | Table + export honesty layers |
| 05 | `05-DESIGN-SYSTEM-TOKENS.md` | Forest tokens `.rc-*` |
| 06 | `06-LONG-HORIZON-ROADMAP.md` | NOW→VISION backlog |
| 07 | `07-SOURCE-OF-TRUTH-AND-GAPS.md` | Hierarchy + gaps + update procedure |
| 08 | `08-INVENTORY-OVERVIEW.md` | Movement mix panel |
| 09 | `09-CATALOG-AND-PROCESS-MAP.md` | Tabs + process map 6 stages |
| 10 | `10-MONTHLY-DETAIL-RINGKASAN.md` | RPTIN1000015 sticky UI |
| 11 | `11-CHANGELOG-UI-SNAPSHOT.md` | What docs/UI snapshot when |
| 12 | `12-WIREFRAME-FULL-PAGE.md` | ASCII wireframe |
| 13 | `13-FILTER-MATRIX.md` | Filter × surface matrix |
| 14 | `14-COMPONENT-INVENTORY.md` | Component list |
| 15 | `15-UI-COPY-GLOSSARY.md` | ID copy (AccCode=dept, etc.) |
| 16 | `16-QA-CHECKLIST-UI.md` | Manual QA after login |
| 17a | `17-AUDIT-UX-PDF-TABLE-PERF.md` | Hermes audit scores |
| 17b | `17-CLAUDE-CODE-AUDIT-RAW.md` | Claude audit + line refs |
| 18 | `18-PDF-REDESIGN-SPEC.md` | PDF-A/B/C **spec only** |
| 19 | `19-EXECUTIVE-SUMMARY-AUDIT.md` | **Consensus ~6.5** · start for quality |

---

## Critical code entry points (read, don't invent)

| Area | Path under `Dashboard_Utama/` |
|------|-------------------------------|
| KPI deck | `components/report-center/ProcurementKpiStrip.tsx` |
| Workspace | `components/report-center/ProcurementModuleWorkspace.tsx` |
| Overview | `components/report-center/InventoryOverview.tsx` |
| Control bar | `components/report-center/ReportControlBar.tsx` |
| Monthly ringkasan | `components/report-center/MonthlyStockRingkasan.tsx` |
| Table | `components/report-center/ReportDataTable.tsx` |
| Table cells | `components/report-center/reportTableCells.tsx` |
| Table toolbar | `components/report-center/ReportTableToolbar.tsx` |
| Export preflight | `components/report-center/ExportPreflightDialog.tsx` |
| Viewer monolit | `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` |
| Catalog monolit | `app/(report-center)/report-center/inventory/InventoryReportsClient.tsx` |
| Tokens | `app/globals.css` |
| Format metrics | `utils/format.ts` |
| Registry | `lib/reports/inventory/config.ts` |
| Workspace links | `lib/reports/procurement-workspace.ts` |

---

## Iron laws (never violate in docs or code)

1. SQL **READ-ONLY** — no CUD.  
2. `IN_STOCKISSUELN.AccCode` = **dept/cost center**, not GL.  
3. `VehCode` on **LINE** tables.  
4. Estate GR cost via **PU_POLN**; `IN_STOCKRECEIVE` often empty.  
5. `1900-01-01` = sentinel. Use `RTRIM` on char codes.  
6. **Period usage** ≠ **movement aging window**.  
7. Export layers: summary server ≠ table window ≠ AI sample ≠ PDF preview.  
8. Live registry ≈ **19 + 1 hold** — don't trust stale “27 reports” without `config.ts`.  
9. Conflicts: **code + tests > these docs > old PRDs**.  
10. No secrets/API keys in docs or commits.

---

## Consensus audit scores (do not re-litigate without new evidence)

- Overall **~6.5/10**  
- PDF **3.5/10** = largest gap  
- Estetika forest **~7.3** · KPI deck **~7.2** · Table **~6.7**  
- Full tables: `19-EXECUTIVE-SUMMARY-AUDIT.md`

---

## Related docs outside the UI pack

| Path | Topic |
|------|--------|
| `Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md` | Detail redesign exploration |
| `Dokumentasi/MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` | Multi-agent charter |
| `Dokumentasi/INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md` | Live report IDs |
| `Dokumentasi/Monthly-Stock-Account-Movement-Details/` | RPTIN domain 01–12 |
| `Dokumentasi/Report Inventory Kebun/good_receipt_correlation.md` | GR 6-table join |
| `Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html` | 14 Mermaid boxes |
| `Dokumentasi/PROMPT_AGENT_DIAGRAM_REPORT_CENTER_INVENTORY.md` | Diagram agent prompt |
| `Dokumentasi/PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md` | KPI implement prompt |
| `Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md` | KPI plan |
| `Dokumentasi/KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md` | KPI catalog |

---

## Agent response contract (suggested)

When user asks about UI/KPI/PDF without “implement”:
- Answer from this index + linked docs  
- Label LIVE / PARTIAL / PLANNED  
- Do **not** edit production code  

When user says **implement**:
- Load the matching prompt (KPI or PDF or detail)  
- Touch only listed files  
- Verify with tsc/tests/browser as prompt requires  

---

## Absolute paths (Windows)

```
D:\Gawean Rebinmas\Main Dashboard\Dokumentasi\AGENT_INDEX_REPORT_CENTER_UI.md
D:\Gawean Rebinmas\Main Dashboard\Dokumentasi\UI-REPORT-CENTER-CURRENT\
D:\Gawean Rebinmas\Main Dashboard\Dashboard_Utama\
```

---

**End agent index.**
