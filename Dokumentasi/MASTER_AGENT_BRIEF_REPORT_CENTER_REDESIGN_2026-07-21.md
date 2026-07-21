# MASTER AGENT BRIEF — Report Center Total Redesign Context

**Generated:** 2026-07-21  
**Audience:** Any coding agent starting implementation or further audit  
**User intent:** Report Center (especially inventory report detail / monthly movement) looks messy, redundant, unprofessional. Need deep shared context so agents refactor optimally.

---

## Start here

```
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md
```

Then:

1. `MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md`  
2. `REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md`  
3. `REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md`  
4. `REPORT_CENTER_AGENT_DISPATCH_TEMPLATES_2026-07-21.md`  
5. Deep dives + wireframe HTML  

---

## Problem (one paragraph)

Inventory **report detail** is a **~6461-line** `ReportViewerClient` that paints one accounting story as many equal-weight surfaces: duplicate period/filter UI, rainbow flow KPI cards, issued metrics twice, collapsible but still heavy secondary card walls, crowded table toolbar (AI/SQL/charts mixed with table tools), PDF that is only 34×7 rows unlabeled, AI on 50×40 sample unlabeled. Shell/home forest design is relatively good; **detail diverges**. Catalog is a **second ~2519-line monolith**. Fix = **information architecture + extraction + scope honesty**, not more cards or formula invention.

---

## First report

- id: `monthly-stock-account-movement-details`  
- code: `RPTIN1000015`  
- domain: `lib/reports/inventory/monthly-stock-account-movement.ts`  
- API: `app/api/reports/inventory/route.ts`  

Primary Ringkasan metrics (dictionary): Opening, GR, Issued total, Return, Closing, TotalItem — typed via `utils/format.ts`.

---

## Already fixed (do not re-break)

Typed metrics; calm subtotals; SQL hover-only; monthly secondary default collapsed; hide sticky grand when flow KPIs present. Checkpoint `4fe3253`. Baseline `05dd66b`.

---

## Target IA

Context → Controls (1) → ≤6 Summary → Analysis explorer → Detail table → Audit SQL  
Tabs; forest theme; ID copy; export preflight; AI sample chips.

---

## Implement order

P1 honesty labels → P2 filter collapse → P3 monthly summary → P4 profile extract → P5 table → P6 workspaces → P7 export system → P8 catalog share → P9 polish  

Use dispatch templates A–F.

---

## Forbidden

- Invent accounting math  
- Currency on period/qty/count  
- Big-bang rewrite without extract  
- Parallel free-for-all on ReportViewerClient  
- Generic SaaS reskin  
- Commit secrets  
- Claim done without tests (+ screenshots when UI)

---

## Visual target

Open: `Dokumentasi/mocks/report-detail-monthly-wireframe-2026-07-21.html`

---

## Status of this documentation effort

Exploration pack **complete enough to implement**. Production UI **not** redesigned in the doc-only session unless a later message starts Phase P1 coding.

---

**End master brief.**
