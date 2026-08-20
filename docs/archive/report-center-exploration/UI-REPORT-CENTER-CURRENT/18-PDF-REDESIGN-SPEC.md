# 18 — PDF Report Redesign Spec (dari audit)

**Status:** SPEC only (belum implement)  
**Sumber skor:** `17-AUDIT-UX-PDF-TABLE-PERF.md` (PDF = 3.5/10)

---

## Problem statement

PDF saat ini = **dump teks pipe-separated** via jsPDF, max ~34×7.  
Cocok sebagai **debug/pratinjau**, **tidak** cocok sebagai laporan resmi CEO/finance/gudang.

Catalog path bahkan **tidak** menandai pratinjau di filename/watermark → risiko salah tafsir.

---

## Goals

1. Honesty: pratinjau selalu jelas.  
2. Official mode: tabular, branded, multi-page, filter metadata.  
3. Satu pipeline export (viewer + catalog).  
4. Numeric alignment & readable labels.

## Non-goals (v1)

- Pixel-perfect clone Crystal/SSRS legacy.  
- Realtime collaborative PDF.

---

## Modes

| Mode | Max rows | Max cols | Label | Generator |
|------|----------|----------|-------|-----------|
| `preview` | 34 | 7–8 | PRATINJAU | client jsPDF+autotable OK |
| `full` | ceiling 20k/100k | fit page / landscape | LAPORAN | **server job** recommended |

---

## Page template (A4 landscape)

```
┌ Logo Rebinmas │ Judul report │ Code RPT…          ┐
│ Source: Estate/Pabrik · Period · Printed at · User │
│ Filter chips: itemType, location, MC window…       │
├────────────────────────────────────────────────────┤
│ Table header (repeat)                              │
│ rows zebra, numeric right, code mono               │
├────────────────────────────────────────────────────┤
│ Halaman n/m · READ-ONLY · not for external audit*  │
└────────────────────────────────────────────────────┘
* official full may say "Internal use"
```

## Column rules

- Use `displayColumnLabel(column)`.  
- Prefer `formatMetric(value, column)`.  
- Hide technical noise columns in preview (ids panjang) unless selected.  
- Amount columns right; codes left; dates ISO→id-ID.

## Implementation plan

### Sprint PDF-A (1–2 hari) — MUST
- [ ] Catalog exportPdf: watermark + `-pratinjau.pdf` + same limits messaging  
- [ ] Shared `lib/reports/export-pdf-preview.ts` used by viewer+catalog  
- [ ] Metadata lines (source, period)  
- [ ] displayColumnLabel + formatMetric  
- [ ] Preflight dialog on catalog path too  

### Sprint PDF-B (3–5 hari)
- [ ] jspdf-autotable or HTML print template  
- [ ] Page numbers, logo, footer  
- [ ] Optional column picker for PDF  
- [ ] Unit test snapshot of metadata strings  

### Sprint PDF-C (1–2 minggu)
- [ ] Server PDF job + `useExport` alignment  
- [ ] Full mode beyond 34 rows  
- [ ] Template per report family (monthly vs movement vs valuation)

---

## Acceptance

- [ ] No catalog PDF without pratinjau mark  
- [ ] Preview always ≤ declared limits  
- [ ] Numbers readable (not mid-truncate currency)  
- [ ] Forest-neutral print (black text OK for ink; accent only header rule)  
- [ ] CEO can print 1 page summary without shame  

---

**End PDF spec.**

## 2026-07-23 LIVE vs PLANNED

- **LIVE:** client PDF is structured A4 landscape preview, not official/full PDF.
- **LIVE:** filename uses `*-pratinjau.pdf`; watermark text is `PRATINJAU`; footer says `bukan laporan resmi`.
- **LIVE:** preview includes report title/code, source, period, generated timestamp, active filters, labelled columns, formatted cells, numeric right alignment, repeated table header, and simple page breaks.
- **LIVE:** ceiling remains honest at 34 rows × 7 columns for detail preview.
- **PLANNED:** official full PDF generation, server-side layout, and exact RPTIN print fidelity are not implemented.

