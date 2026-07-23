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

## 2026-07-23 (lanjut) — Composite command-deck API + insight deck

- **LIVE:** `GET /api/reports/procurement/command-deck` — composite endpoint menjalankan 8 report KPI secara server-side (paralel, loopback ke `/api/reports/inventory`) dan menggabungkan `summary`+`chart` dalam satu payload. In-memory TTL cache 30s per filter+source untuk meredam beban SQL Server.
- **LIVE:** `ProcurementKpiStrip` kini memakai SATU fetch ke composite; fallback otomatis ke jalur 8-fetch paralel lama bila endpoint gagal (kontrak `Snapshot` identik). Mengatasi "8 parallel fetch storm" dari audit.
- **LIVE:** Insight deck ditambah tanpa menambah kartu: **Fill rate** (Qty Receive / Qty Order) di kartu PO Outstanding, **Intensitas usage** (Usage Amount / Total Valuasi) di kartu Total Usage.
- **PLANNED:** composite endpoint belum di-smoke-test terhadap gateway SQL live di sesi ini (tsc + contract test lulus). Dept/vehicle toggle & server PDF resmi tetap planned.

## 2026-07-23 (lanjut) — Enrich summary + insight chips + Top lists toggle

- **LIVE:** `stockIssue` summary diperkaya: `ActiveIssueDays` (hari unik dengan aktivitas issue) + `topLists` (`items`, `costCenters`, `vehicles` — masing-masing Top 5 by amount). Additive, tidak mengubah field lama.
- **LIVE:** Composite command-deck meneruskan `topLists` dari inventory route ke client.
- **LIVE:** `lib/reports/procurement-kpi-math.ts` — pure helpers `frequencyPerDay`, `poFillRate`, `returnRate`, `usageIntensity` + unit test (`procurement-kpi-math.test.ts`, lulus).
- **LIVE:** Kartu **Total Usage** sekarang menampilkan chip: **Frekuensi** (event/hari aktif), **Intensitas** (usage/valuasi), **Return rate** (return amount / usage amount, all-time — label jujur karena `stockReturn` mengabaikan filter periode).
- **LIVE:** Kartu **PO** memakai `poFillRate()` helper (Qty Receive / Qty Order).
- **LIVE:** **Top usage periode** footer sekarang punya toggle 3 dimensi: **Item | Dept | Kendaraan**. Data dari `topLists`; fallback ke `usage.chart` bila `topLists` kosong.
- **LIVE:** Pilihan periode diperluas dari 8 → **18 bulan**.
- **PLANNED:** smoke-test live DB untuk memastikan `topLists` benar terisi saat runtime; split monolit `ProcurementKpiStrip.tsx` masih planned.

## 2026-07-23 (lanjut) — Visual overhaul: flow strip, trend chart, KPI carousel, display font

- **LIVE:** Font baru: **Sora** (display, `--font-display`) untuk angka KPI + **JetBrains Mono** (data, `--font-data`) untuk chip/eyebrow/label teknis. Inter tetap sebagai body.
- **LIVE:** Utility CSS baru di `globals.css`: `.rc-display`, `.rc-data`, `.rc-eyebrow`, `.rc-metric`, `.rc-chip`, `.rc-hairline`, `.rc-kpi-surface`, `.rc-reveal` (staggered rise), `.rc-carousel-track`.
- **LIVE:** **ProcurementFlowStrip** — alur PR → PO → Receive → Issue → Return dengan konektor animasi (framer-motion), klik tahap = navigasi ke report terkait. Nilai per tahap live dari summary (PR count/outstanding, PO count/fill, receive docs/qty, issue docs/qty, return amount/rate).
- **LIVE:** **UsageTrendChart** — area chart bulanan (recharts) dari `trend` baru di payload `pengeluaran-barang` (GROUP BY bulan, mengikuti filter periode). Gradient forest, tooltip mono, label puncak.
- **LIVE:** **KpiCarousel** — kartu KPI section sekarang snap-scroll horizontal (dynamic slide cards): auto-col grid + scroll-snap native + tombol prev/next + dot indicator. Hero cards tetap grid.
- **LIVE:** Composite command-deck meneruskan `trend` ke client (additive).
- **CHANGED:** `renderCardGrid` dipecah — `renderCardItems` (elemen) dipakai carousel & grid wrapper.
- **PLANNED:** smoke-test visual di browser (butuh login manual); sparkline per kartu; density pass untuk tabel report detail.


## 2026-07-23 (lanjut) - Hallmark audit pass (skill terinstall)

- **SKILL:** hallmark terinstall via `npx skills add nutlope/hallmark@hallmark -g -y` (+ 8 lainnya sesi ini: web-design-guidelines, vercel-react-best-practices, systematic-debugging, writing-plans, frontend-design, design-taste-frontend, context7 find-docs, using-superpowers).
- **FIX:** Eyebrow purge - eyebrow dipakai dekoratif melanggar Hallmark (default OFF). Deck header, hero "Master valuation", flow note, dan label "Top usage periode" diganti text 11-12px semibold plain.
- **FIX:** Elevation on dark via lightness, bukan colored glow - `.rc-kpi-surface:hover` tidak lagi shadow-glow emas; naik ke surface-raised + gradient lebih terang + inset hairline.
- **FIX:** Card-in-card di trend chart wrapper diredam (border/bg wrapper dihapus, sisa container ukuran netral).
- **SCORE:** self-critique P4 H4 E4 S4 R4 V4 (semua >=3).
- **PLANNED:** screenshot media tetap gap (butuh login manual); `topLists`/`trend` belum smoke-test ke SQL live; carousel di mobile belum diuji.
