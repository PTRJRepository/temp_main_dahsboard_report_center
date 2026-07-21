# Inventory Catalog — Target Wireframe Notes

**Date:** 2026-07-21  
**Page:** `/report-center/inventory`  
**Code today:** `InventoryReportsClient.tsx` (~2519 lines)

---

## Current strengths (keep)

- Flow-stage mental model (request → receive → movement → usage → valuation…)  
- Sticky **catalog jump** chips by group (`.rc-catalog-jump`)  
- Forest tokens / tile cards  
- Source estate|pabrik  
- Status badges live/preview/planned  

## Current weaknesses (fix)

- Second monolith; duplicate export/pdf vs detail  
- Duplicate analysis-group option lists  
- Dense filters + preview + AI tile on same page as catalog  
- Naming: sidebar “Procurement” vs Inventory Live  

## Target layout

```
Header: Inventory Live · source switch · search reports
Sticky jump: [Stok] [Mutasi] [Purchasing] [Fuel] …
Section cards:
  Group title + count
  Report tiles grid (name, status, cadence, Open)
Drawer/side: only when preview selected (optional)
Do NOT embed full mini-report-detail above the fold
```

## Shared with detail (must extract)

- SourceSwitch  
- AnalysisGroupSelect options module  
- ExportMenu (honesty)  
- Favorite star  

## Agent rule

Catalog changes must not break handoff URL to  
`/report-center/inventory/monthly-stock-account-movement-details?source=…`

---

**End catalog wireframe notes.**
