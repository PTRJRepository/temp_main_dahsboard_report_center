# Report Detail — Redundancy Kill List (Operational)

**Date:** 2026-07-21  
**Rule:** Each item is a **delete/merge** target, not a restyle. Check off when gone from default monthly path.

---

## Filters / period

| ID | Kill | Keep instead |
| --- | --- | --- |
| K1 | Standalone “Periode Report (Bulan Aktual)” section when control bar has period | ControlBar period |
| K2 | Second period block inside manual filter for monthly | same |
| K3 | Chip list inside Natural Filter panel as primary | AppliedFilterBar only |
| K4 | Mono “Parameter request report” on executive default | Audit tab |
| K5 | Triple groupBy (sticky + manual + table) without link | one Analysis group + optional table-only advanced |

## Ringkasan / cards

| ID | Kill | Keep instead |
| --- | --- | --- |
| K6 | Rainbow 5-step equal cards if dictionary 6 adopted | typed strip 6 |
| K7 | Full-width Issued rose callout reprinting metrics | disclosure on Pengeluaran |
| K8 | Sticky grand chips when flow KPIs present | already hidden — keep |
| K9 | Always-open secondary product-type card wall | Analisis DimensionExplorer |
| K10 | SQL buttons on default Ringkasan face | Audit / hover demoted only |
| K11 | English-only “Opening/Inventory/Purchasing” as final copy | ID glossary |
| K12 | Hero “Inventory” aggregate of placeholder_zero fields | hide or Audit |

## Table toolbar

| ID | Kill from toolbar | Move to |
| --- | --- | --- |
| K13 | SQL Debug | Audit |
| K14 | Tampilkan AI Insight | Analisis or overflow |
| K15 | Charts / Quality primary buttons | Analisis tabs |
| K16 | Print / Copy Link equal to Excel | overflow ⋮ |
| K17 | Light `#F0F4FA` context strip | dark token strip or remove |

## Export / AI

| ID | Kill | Keep instead |
| --- | --- | --- |
| K18 | Unlabeled “Export PDF” as full report | “PDF pratinjau” + watermark |
| K19 | Silent Excel full dump | preflight + ceiling |
| K20 | AI without sample chip | forced chips |

## Catalog

| ID | Kill | Keep instead |
| --- | --- | --- |
| K21 | Duplicate exportPdf/excel helpers drift | shared ExportMenu |
| K22 | Duplicate analysis group constant arrays | shared module |
| K23 | Full mini-detail above catalog fold | preview drawer only |

---

## Verification

Default monthly open should not show K1–K4, K7, K9–K10, K13–K15, K18–K20.

```
rg -n "Issued breakdown|Periode Report|Parameter request|Tampilkan AI|SQL Debug|Export PDF" ReportViewerClient.tsx
```

After kill, hits only in Audit/overflow/comments.

---

**End kill list.**
