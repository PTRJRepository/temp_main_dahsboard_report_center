# 11 — Changelog UI Snapshot

Living log: apa yang **terlihat di UI/kode** pada snapshot docs.  
Bukan git log otomatis.

---

## 2026-07-22 — Pack UI-REPORT-CENTER-CURRENT dibuat

### Dikonfirmasi LIVE di kode
- Procurement workspace: hero + source + tabs area kerja + process map  
- KPI Command Deck:
  - 8 parallel fetches termasuk `pengeluaran-barang` + `return-barang`
  - Master valuation + gudang/workshop bars
  - Hero: Net Flow, Total Usage
  - Sections: valuasi side, process GR/PR/PO, movement event/qty/amount
  - Top 5 usage items strip dari `usage.chart`
  - Filter labels: Periode usage/receive vs Jendela aging movement
- Inventory Overview: movement composition + exceptions + thresholds; embedded hideScopeControls  
- ReportControlBar + MonthlyStockRingkasan extracts  
- Auth gate login untuk /report-center  

### Masih gap (jujur)
- Tabs Issue Analysis formal  
- Top dept/vehicle  
- PO fill % card  
- Quality alert card di deck (tidak di section list terkini)  
- Composite command-deck API  
- Screenshot media (butuh login manual)  
- Viewer monolit shrink penuh  

### Docs actions
- Folder `Dokumentasi/UI-REPORT-CENTER-CURRENT/` 00–11  
- Plan wow status → partial LIVE + link folder  

---

## 2026-07-22 (lanjut) — Wireframe, filter matrix, QA

### Docs added
- `12-WIREFRAME-FULL-PAGE.md`
- `13-FILTER-MATRIX.md`
- `14-COMPONENT-INVENTORY.md`
- `15-UI-COPY-GLOSSARY.md`
- `16-QA-CHECKLIST-UI.md`

### Code surface covered
- Full procurement page stack A→E
- Filter ownership matrix
- Monthly sticky ringkasan notes
- Manual QA after login

---

## 2026-07-22 (audit) — Claude Code + executive summary

### Docs only (no production code changes)
- `17-AUDIT-UX-PDF-TABLE-PERF.md` — Hermes multi-aspect scores (overall 6.6)
- `17-CLAUDE-CODE-AUDIT-RAW.md` — Claude Code review-only (overall 6.4, EXIT 0)
- `18-PDF-REDESIGN-SPEC.md` — PDF-A/B/C spec
- `19-EXECUTIVE-SUMMARY-AUDIT.md` — consensus ~6.5, P0 PDF + dual export path

### Consensus P0
- PDF pipe dump 34×7
- Catalog PDF without pratinjau mark
- Dual monolit size
- KPI 8 parallel fetches

---

## Cara append entri baru

```
## YYYY-MM-DD — short title
### LIVE
- ...
### REMOVED/CHANGED
- ...
### PLANNED next
- ...
```

---

**End changelog.**

## 2026-07-23 — Premium workbench phases 3-7

- **LIVE:** Phase 3 detail answer-first committed: always-visible KPI/state band and two-tier drilldown model.
- **LIVE:** Phase 4 chart pass committed for monthly visuals and AI chart definitions with stable accessible semantics.
- **LIVE:** Phase 5 table readability/a11y committed: toolbar hierarchy, `aria-sort`, forest dark controls, min 11px type.
- **LIVE:** Phase 6 export honesty committed: shared structured PDF preview helper, `*-pratinjau.pdf`, `PRATINJAU` watermark, dialog Escape/focus handling.
- **LIVE:** Phase 7 role-token cleanup committed.
- **PLANNED:** official/full server PDF remains not implemented. Client PDF stays preview only.

