# 17 — Audit UX · Estetika · PDF · Tabel · Performa

**Tanggal:** 2026-07-22  
**Mode:** Audit kode production path (review-only)  
**Auditor:** Hermes (code-grounded) + Claude Code review (async, lihat `17-CLAUDE-CODE-AUDIT-RAW.md` bila terisi)  
**Scope:** Report Center procurement + inventory detail (bukan modul HR/FFB)

---

## Overall score: **6.6 / 10**

| Dimensi | Skor | Ringkas |
|---------|------|---------|
| 1. Estetika overall / brand forest | **7.5** | Kuat, mature, konsisten navy/green |
| 2. KPI command deck | **7.0** | Wow-factor bagus; densitas & section stack berat |
| 3. Report detail / monthly | **6.5** | Extract bagus; monolit masih bikin “banyak permukaan” |
| 4. Tabel & keterbacaan | **7.0** | Virtual + typed cells bagus; density/toolbar padat |
| 5. **PDF export design** | **3.5** | Hanya pratinjau teks pipe; **bukan** laporan resmi |
| 6. Excel/CSV honesty | **7.5** | Preflight + ceiling jujur di detail path |
| 7. Performa | **6.0** | Virtualizer OK; monolit + multi-fetch + Excel client risk |
| 8. Accessibility | **5.5** | Sebagian dialog/aria; fokus/focus/table a11y belum elite |
| 9. Mobile/responsive | **6.0** | Grid collapse ada; toolbar/export padat di small |
| 10. IA / cognitive load | **6.0** | Hierarchy membaik; page procurement masih panjang |

**CEO-facing “glass” (KPI):** ~7.2  
**Official printable PDF:** ~3.5 — **prioritas redesign tertinggi**

---

## 1. Estetika UI overall — 7.5

### Kuat
- Forest tokens `.rc-*`, gradient depth, glass cards, accent lime — identitas PT Rebinmas jelas.
- Typography: `font-black`, tight tracking pada hero numbers = executive.
- Hover lift halus, border forest-strong, tidak “generic SaaS purple”.
- Banner report detail (`rc-report-banner`) dan deck header selaras visual language.

### Lemah
- **Density stacking:** KPI deck (hero+4 section+top5) + overview + catalog + process map = scroll marathon.
- Beberapa **tone pill multiwarna** per kartu (sky/amber/rose/cyan) bisa terasa “dashboard template” jika terlalu banyak selevel.
- Dual format money: deck local 4-dec OK; pastikan tidak campur compact di tempat lain.
- Light-theme cell chips (`bg-red-50`) di dalam dark table context bisa **kontras janggal** (badge aging/movement di `reportTableCells.tsx` pakai light pastel).

### Rekomendasi estetika
1. Progressive disclosure: collapse section 2–4 deck di balik tabs.  
2. Seragamkan badge table ke dark-forest chips (bukan light `bg-*-50`).  
3. Batasi accent rainbow: hero 1 primary + neutrals; status hanya untuk risk.

---

## 2. KPI Command Deck — 7.0

### Kuat (LIVE)
- Master valuation + share bars gudang/workshop.
- Net flow + Total Usage + movement metrics + top 5 usage.
- Filter period vs aging **dilabel terpisah**.
- Live / partial badge.
- Drill-down Link per kartu.

### Lemah
- Empat section grid di kanan = visual noise vs “5 detik CEO”.
- Risk pulse / quality alert tidak sejelas plan wow (diganti movement triple).
- Freq/hari & ActiveDays kurang hero.
- 8 parallel fetches: partial OK, tapi first paint bisa “...” lama di LAN lemah.

### Skor sub
| Aspek | Skor |
|-------|------|
| Visual hierarchy master | 8 |
| Information density | 5.5 |
| Metric honesty | 7.5 |
| Interaction polish | 7 |

---

## 3. Report detail / monthly ringkasan — 6.5

### Kuat
- `MonthlyStockRingkasan` sticky + anti double grand totals saat flow KPI ada.
- Dual label Actual vs Accounting.
- `ReportControlBar` single surface direction.
- Typed metrics via `format.ts` / `formatMetric`.

### Lemah
- Host `ReportViewerClient.tsx` ~5k+ lines: sulit jaga konsistensi visual.
- Masih risiko permukaan filter/KPI sekunder di monolit.
- Cognitive load: banner + sticky ringkasan + toolbar + table + analysis tabs.

---

## 4. Tabel & keterbacaan — 7.0

### File
- `ReportDataTable.tsx`, `reportTableCells.tsx`, `ReportTableToolbar.tsx`
- Virtualizer di viewer ~L3501

### Kuat
- Group header / subtotal / detail row model jelas.
- Amount: `tabular-nums`, mono, right-align.
- Movement/risk/aging badges dengan tone.
- Density compact/comfortable toggle.
- Sticky cell support, column toggle, search, group expand/collapse.
- Empty state copy Indonesia.

### Lemah
- Toolbar **sangat padat** (search, group, density, columns, page, 3 export, analysis jump, full table) — keterbacaan kontrol menurun.
- Group header chips “Item/Amt/Qty” singkatan EN; campur ID/EN.
- Light pastel badges di dark theme (lihat §1).
- Truncate agresif: butuh tooltip (sebagian ada `title=`).
- PDF tabulasi **tidak** mewarisi table design sama sekali.

### Keterbacaan angka
| Jenis | Implementasi | Skor |
|-------|--------------|------|
| Currency | 4 desimal id-ID | 8 (tepat akuntansi; panjang di sel sempit) |
| Qty | 0–4 dec | 7 |
| Period codes | kind inference | 8 |
| Wide tables | horizontal scroll + virtual | 7 |

---

## 5. PDF export — 3.5  (PRIORITAS)

### Implementasi detail (`ReportViewerClient` ~2047–2068)

```
orientation: landscape
title 14pt
warning 9pt merah: PRATINJAU 34×7
header: columns.join(' | ')
rows: formatValue join ' | ' slice 0..165
filename: {id}-pratinjau.pdf
```

### Implementasi catalog (`InventoryReportsClient` ~928–947)

```
28 rows × 6 cols
description line
filename: {id}.pdf  ← TANPA -pratinjau
TIDAK ada watermark pratinjau
```

### Masalah desain PDF (P0)

| # | Issue | Severity |
|---|-------|----------|
| P0-1 | Bukan tabular grid — pipe text = **tidak layak laporan resmi** | Critical |
| P0-2 | Catalog PDF **inkonsisten honesty** vs detail (nama file + watermark) | Critical |
| P0-3 | Tidak ada logo, periode filter, source estate/pabrik, printed-at, page numbers | High |
| P0-4 | Tidak ada header/footer company, confidentiality | High |
| P0-5 | Kolom raw field names, bukan `displayColumnLabel` | High |
| P0-6 | Truncate 150–165 char potong angka penting | High |
| P0-7 | Tidak multi-page layout professional; y+=12 hardcoded overflow risk | Med |
| P0-8 | Tidak ada auto table (jspdf-autotable) / HTML print CSS | High |
| P0-9 | Dual path export (catalog vs viewer) drift | High |
| P0-10 | `useExport` job queue ada di lib tapi **detail path ad-hoc** — arsitektur belah | Med |

### Yang sudah benar (keep)
- Detail path menyebut **PRATINJAU** + preflight dialog.
- Batas 34×7 jujur (bukan pura-pura full dump).

### Brief redesign PDF (target “sempurna”)

**Phase PDF-A (honest polish, 1–2 hari)**  
1. Samakan catalog & viewer: selalu watermark + `*-pratinjau.pdf` + preflight.  
2. Gunakan `displayColumnLabel` + `formatMetric`.  
3. Metadata block: source, period, filter chips, printed timestamp, user.  
4. Page numbers `Halaman n/m`.  
5. Jangan pipe — minimal monospaced columns dengan fixed x positions ATAU autotable.

**Phase PDF-B (official landscape report, 1 minggu)**  
1. `jspdf-autotable` atau print route `react-to-print` / dedicated `/print/[report]`.  
2. Template: logo Rebinmas, judul, subtitle report code, filter summary table.  
3. Header repeat per page; zebra rows; right-align numerics.  
4. Footer: “Dokumen sistem · READ-ONLY · generated …”  
5. Mode: **Pratinjau** vs **Laporan penuh** (penuh = server-side PDF job, async).  
6. Max columns by orientation; landscape 8–10 cols with ellipsis + appendix.  
7. Optional: landscape A4 stock movement official matching accounting pack.

**Phase PDF-C (enterprise)**  
- Server-side PDF (Puppeteer/Playwright) dari HTML template forest.  
- Queue + download URL (align `useExport`).  
- Digital stamp / approval line kosong untuk print fisik.

---

## 6. Excel / CSV — 7.5

### Kuat
- `ExportPreflightDialog`: ceiling, loaded rows, honesty copy.
- CSV server `format=csv` + ceiling 20k / monthly 100k.
- Excel alert baris count.

### Lemah
- Excel **client-side** full JSON → memory spike (P1).
- Catalog Excel limit 500 hardcode — beda dari viewer ceiling (inkonsisten).
- Sheet name = title slice 31; no freeze header / column widths / number formats as true Excel numbers (semua stringy dari json_to_sheet).
- `window.alert` / confirm = UX kasar vs dialog forest.

---

## 7. Performa — 6.0

### Kuat
- `@tanstack/react-virtual` + estimateSize per row type + overscan 12–18.
- Streaming metadata `streamComplete`, windowed table helpers.
- Dynamic import xlsx/jspdf.
- pageSize default 100, first limit capped.

### Lemah / risiko
| Risk | Why |
|------|-----|
| Monolit viewer 5k+ LOC | Parse/hydrate cost, re-render surface luas |
| KPI deck 8 parallel | Waterfall gateway; partial storms |
| Excel fetch-all | Main thread + memory |
| Group rebuild large arrays | CPU on filter change |
| No request dedupe/cache on deck | Re-fetch on every filter keystroke (scopeCode) |
| estimateSize fixed | Variable wrap rows → scroll jump |

### Target budgets (usulan)
| Metric | Target |
|--------|--------|
| Detail interactive | < 2.5s LAN after login |
| Scroll table 10k virtual | 60fps effort |
| Deck ready hero | < 2.5s partial OK |
| Excel >5k rows | server job, not browser |

---

## 8. Accessibility — 5.5

### Ada
- Export dialog `role=dialog` `aria-modal` `aria-label`.
- Beberapa `aria-label` refresh/export.
- Keyboard sort headers (assume button headers — verify per column).

### Kurang
- Focus trap di export dialog belum jelas.
- Table virtualization + screen reader: row count announcements.
- Color-only net flow / movement tones.
- Icon-only controls tanpa text di toolbar padat.
- Contrast light badges on dark may fail WCAG in places.

---

## 9. Mobile — 6.0

- Grid `sm/xl` di deck & overview ada.
- Toolbar h-11 desktop vs h-8 expanded — masih crowded.
- PDF landscape pratinjau tidak mobile-relevant (OK).
- Sticky monthly ringkasan memakan viewport phone.

---

## 10. IA / cognitive load — 6.0

**Procurement page length:** Hero + Deck + Overview + Area + Process map = 5 “apps” stacked.  
**Good:** “Mulai dari KPI lalu drill”.  
**Bad:** Semua expanded by default.

**Fix IA:**  
1) Deck hero only default; “Lihat semua KPI” expand.  
2) Overview collapsed summary 3 lines + “Buka movement mix”.  
3) Process map secondary.

---

## Findings prioritas

### P0
1. **PDF bukan laporan** — redesign tabular + metadata + samakan honesty catalog/viewer.  
2. **Catalog PDF tanpa pratinjau label** — mislead pejabat yang “export PDF” dari catalog.  

### P1
3. Toolbar table overload — group actions ke menu “Lainnya”.  
4. Excel client ceiling path + number formats.  
5. Dark-theme table badges.  
6. Deck progressive disclosure / tabs.  
7. Debounce scopeCode + cache KPI fetches.  
8. Reduce monolit viewer (continue extract).  

### P2
9. A11y focus trap + SR table.  
10. Official server PDF queue.  
11. Unify `useExport` vs ad-hoc viewer export.  
12. Mobile compact deck mode.

---

## Top 10 rekomendasi (urut dampak)

1. **PDF-A honesty unify** catalog+viewer (1 hari).  
2. **PDF-B autotable official template** (3–5 hari).  
3. **Collapse KPI sections** behind tabs (2 hari).  
4. **Table toolbar → overflow menu** (1–2 hari).  
5. **Dark chips** di `reportTableCells` (0.5 hari).  
6. **Server Excel** for large exports (3 hari).  
7. **Debounce + SWR cache** deck (1 hari).  
8. **Continue monolit extract** (ongoing).  
9. **Print CSS route** alternative to jspdf text (parallel to PDF-B).  
10. **A11y pass** dialog + table (2 hari).

---

## Yang sudah kuat (JANGAN dirombak tanpa alasan)

- Forest brand system & command deck metaphor.  
- Export honesty **concept** (preflight, pratinjau naming di detail).  
- Typed metrics `format.ts` (period ≠ currency).  
- Virtualized table architecture.  
- Net flow / usage / top items direction di deck.  
- Filter period vs movement window labeling.  
- Monthly sticky anti-double-totals rule.

---

## Scorecard visual (ringkas)

```
Estetika     ████████░░  7.5
KPI deck     ███████░░░  7.0
Detail UI    ██████░░░░  6.5
Tabel        ███████░░░  7.0
PDF          ███░░░░░░░  3.5  ← gap terbesar
Excel/CSV    ████████░░  7.5
Perf         ██████░░░░  6.0
A11y         █████░░░░░  5.5
Mobile       ██████░░░░  6.0
IA load      ██████░░░░  6.0
─────────────────────────
OVERALL                 6.6
```

---

## Lampiran path kunci

| Topic | Path |
|-------|------|
| PDF detail | `ReportViewerClient.tsx` L2047–2068 |
| Excel detail | L2030–2044 |
| CSV | L2017–2027 |
| Ceiling | L2013–2015 |
| PDF catalog | `InventoryReportsClient.tsx` L928–947 |
| Preflight | `ExportPreflightDialog.tsx` |
| Table | `ReportDataTable.tsx` |
| Cells | `reportTableCells.tsx` |
| Toolbar | `ReportTableToolbar.tsx` |
| Virtualizer | `ReportViewerClient.tsx` L3501–3511 |
| Format | `utils/format.ts` |
| Perf helpers | `lib/reports/report-detail-performance.ts` |

---

## Next actions (jika user setuju)

1. Implement **PDF-A** honesty unify (cepat, risiko rendah).  
2. Desain mock **PDF resmi 1 halaman** (HTML/CSS) sebelum autotable.  
3. UI pass: toolbar overflow + deck tabs.  

---

**End audit.** Claude Code raw output (jika selesai): `17-CLAUDE-CODE-AUDIT-RAW.md`
