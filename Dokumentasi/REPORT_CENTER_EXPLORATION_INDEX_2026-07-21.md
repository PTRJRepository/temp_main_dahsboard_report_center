# Report Center Redesign — Documentation Index (Exploration Pack)

**Date:** 2026-07-21  
**Folder:** `D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/`  
**Mode:** exploration + contracts only (production UI not redesigned in this pack unless separate commit)

---

## Read order for a new agent

1. **This index** (1 min)  
2. `MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` — charter / iron laws  
3. `REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md` — app map + IA  
4. `REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md` — what to build when  
5. Deep dives as needed (cards / table / export / shell)  
6. `REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` + `metric-dictionary.md` — contracts  
7. `REPORT_CENTER_DEBUG_REPORT_2026-07-21.md` — already fixed, do not re-break  
8. Wireframe + HTML mock — visual target  

---

## Pack contents

| Doc | Topic |
| --- | --- |
| `REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md` | Monolith map, redundancy, phases, git checkpoints |
| `REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md` | How KPI cards are built/laid out; target ≤6 |
| `REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md` | 6+ filter surfaces; table virtualizer/toolbar |
| `REPORT_DETAIL_EXPORT_AI_SCOPE_EXPLORATION_2026-07-21.md` | CSV/Excel/PDF honesty; AI sample 50×40 |
| `REPORT_CENTER_SHELL_CATALOG_PROFILES_EXPLORATION_2026-07-21.md` | Shell, catalog 2.5k, viewer profiles |
| `REPORT_CENTER_UNIFIED_IMPLEMENTATION_CHECKLIST_2026-07-21.md` | Component tree + P0–P9 |
| `REPORT_DETAIL_TARGET_WIREFRAME_2026-07-21.md` | ASCII target IA + copy deck |
| `mocks/report-detail-monthly-wireframe-2026-07-21.html` | Open in browser |
| `REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md` | Master read order for this pack |
| `REPORT_CENTER_RISK_REGRESSION_REGISTER_2026-07-21.md` | Risks + regression gates |
| `REPORT_VIEWER_CLIENT_SECTION_LINE_MAP_2026-07-21.md` | Line map of 6461-line viewer |
| `REPORT_CENTER_AGENT_DISPATCH_TEMPLATES_2026-07-21.md` | Copy-paste agent goals A–F |
| `MASTER_AGENT_BRIEF_REPORT_CENTER_REDESIGN_2026-07-21.md` | One-page brief for any agent |
| `INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md` | Live report ids from config.ts |
| `INVENTORY_CATALOG_TARGET_WIREFRAME_2026-07-21.md` | Catalog page target notes |
| `REPORT_CENTER_PRODUCT_GLOSSARY_ID_EN_2026-07-21.md` | UI copy glossary |
| `REPORT_CENTER_OPEN_QUESTIONS_2026-07-21.md` | Unresolved decisions |
| `REPORT_DETAIL_PERFORMANCE_EXPLORATION_2026-07-21.md` | Perf hotspots + budgets |
| `REPORT_DETAIL_A11Y_EXPLORATION_2026-07-21.md` | Keyboard/SR/focus contract |
| `REPORT_CENTER_SCREENSHOT_QA_CHECKLIST_2026-07-21.md` | Visual QA shot list |
| `REPORT_DETAIL_REDUNDANCY_KILL_LIST_2026-07-21.md` | Delete/merge targets K1–K23 |
| `PRD-REPORT-CENTER-DETAIL-REDESIGN.md` | **PRD v1.1 agent contract (start here for coding)** |
| `../Dashboard_Utama/docs/PRD/PRD-REPORT-CENTER-DETAIL-REDESIGN.md` | Same PRD under docs/PRD |
| `REPORT_CENTER_DEBUG_REPORT_2026-07-21.md` | Root-cause fixes already landed |
| `MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` | Full multi-agent charter |
| `REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` | Shared output contract |
| `../Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` | RPTIN metrics |

---

## Git checkpoints

| SHA | Meaning |
| --- | --- |
| `05dd66b` | Pre-redesign baseline |
| `4fe3253` | Typed metrics + calmer monthly hierarchy |
| `386c710` | Debug report + master prompt |

---

## Critical code entry points

```
Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx  (~6461)
Dashboard_Utama/app/(report-center)/report-center/inventory/InventoryReportsClient.tsx       (~2519)
Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts
Dashboard_Utama/app/api/reports/inventory/route.ts
Dashboard_Utama/utils/format.ts
Dashboard_Utama/app/globals.css  (.rc-*)
```

---

## One-page problem summary

Detail page feels unprofessional because **one business story is rendered as many equal-weight surfaces** (duplicate periods/filters, rainbow flow cards, issued callout, secondary KPI walls, crowded table toolbar, PDF mislabeled as full export, AI unlabeled sample), all inside a **6.5k-line client** that also embeds **viewer profiles**. Shell/home forest design is fine; detail diverges. Fix with **IA + extraction + honesty**, not more cards.

---

## Next if exploration continues

- Risk register / regression matrix  
- Before/after DOM inventory of ReportViewerClient sections with line ranges  
- Catalog-only wireframe  
- Start Phase P1 implementation  

**Stop exploration only when user says stop; otherwise continue docs or begin code when user switches to implement.**

---

**End index.**
