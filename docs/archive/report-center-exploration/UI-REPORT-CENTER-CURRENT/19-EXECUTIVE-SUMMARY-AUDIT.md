# 19 — Executive Summary Audit UI (Hermes + Claude Code)

**Tanggal:** 2026-07-22  
**Mode:** dokumentasi only — **tidak ada perubahan kode**  
**Sumber:**
- Hermes code audit → `17-AUDIT-UX-PDF-TABLE-PERF.md` (overall **6.6**)
- Claude Code raw → `17-CLAUDE-CODE-AUDIT-RAW.md` (overall **6.4**)
- PDF spec → `18-PDF-REDESIGN-SPEC.md`

---

## 1. Skor gabungan (consensus)

| Dimensi | Hermes | Claude | **Consensus** | Severity gap |
|---------|-------:|-------:|--------------:|--------------|
| Estetika overall | 7.5 | 7.2 | **7.3** | Med |
| KPI command deck | 7.0 | 7.5 | **7.2** | Med |
| Report detail / monthly | 6.5 | 6.8 | **6.6** | Med |
| Tabel & keterbacaan | 7.0 | 6.5 | **6.7** | Med–High |
| **PDF design** | **3.5** | **3.5** | **3.5** | **P0** |
| Excel/CSV honesty | 7.5 | 6.0 | **6.5*** | P0–P1 |
| Performa | 6.0 | 5.5 | **5.7** | P0–P1 |
| Accessibility | 5.5 | 5.0 | **5.2** | P1 |
| Mobile | 6.0 | 5.5 | **5.7** | P1–P2 |
| IA / cognitive load | 6.0 | 5.8 | **5.9** | P1 |
| **OVERALL** | **6.6** | **6.4** | **~6.5** | — |

\*Claude lebih ketat di Excel/CSV karena **catalog path tanpa preflight** + Excel hard-limit 500 vs detail ceiling — gap honesty path **valid P0–P1**.

**Kesimpulan satu kalimat:**  
Brand forest + deck + honesty detail **sudah kuat**; **PDF & dual-path export** merusak kepercayaan; densitas halaman + monolit + 8 fetch menekan performa/UX.

---

## 2. Temuan kritis yang disepakati kedua audit

### P0
1. **PDF detail = pipe text 34×7** (`ReportViewerClient` ~2047–2068) — pratinjau jujur, visual tidak layak resmi.  
2. **PDF catalog “menyamar resmi”** (`InventoryReportsClient` ~928–947) — tanpa watermark, filename tanpa `-pratinjau`.  
3. **Dual monolit** viewer ~5k L + catalog ~2.5k L — cost hydrate + maintenance.  
4. **KPI deck 8 parallel fetch** per ganti filter — risiko gateway + flicker.

### P1 (disepakati / saling melengkapi)
5. Export honesty **hanya kuat di detail** (preflight); catalog Excel/PDF longgar.  
6. Excel detail `limit=all` di browser — freeze risk.  
7. A11y dialog export: no focus trap / Escape / restore focus.  
8. Table: no `aria-sort`; row click expand kurang keyboard.  
9. Typography table expanded bisa **9px** — terlalu kecil.  
10. Chip filter **double-echo** di deck.  
11. Hero currency 4 desimal di `text-5xl` = noise (compact + tooltip lebih baik).  
12. Cognitive load: deck + overview + area + process map semua expanded.

---

## 3. Yang sudah kuat (keep — jangan dirombak asal)

- Forest tokens `--rc-forest-*`, focus-visible, reduced-motion.  
- Command deck: master valuation + share bars + formula transparency.  
- Export honesty **concept** di detail (`ExportPreflightDialog`).  
- Virtual table + group/subtotal model.  
- CSV server path (`format=csv`).  
- Live partial badge.  
- Monthly flow tones + anti double totals direction.  
- AnalyticsKpiStrip contract (status/selected/loading).

---

## 4. Insight Claude (disorot)

1. **Honesty UI > pretty export** — satu path catalog tanpa watermark merusak trust seluruh export.  
2. **Command deck vs densitas** — audit-grade chips bagus; butuh **compact mode** ops harian.  
3. **Virtualizer ≠ monolit solved** — row paint murah; 5k-line client tetap mahal parse/hydrate.

---

## 5. Prioritas dokumentasi → backlog (bukan coding di sesi ini)

Urutan disarankan bila **nanti** diimplementasi (tim/agent lain):

| # | Item | Doc acuan |
|---|------|-----------|
| 1 | Samakan kontrak PDF catalog+detail (pratinjau) | `18-PDF-REDESIGN-SPEC` PDF-A |
| 2 | PDF table layout + header/footer | `18` PDF-B |
| 3 | Preflight di catalog export | audit §export |
| 4 | Deck accordion / tabs + 1 chip row | `02` + audit IA |
| 5 | Table min 11px, aria-sort, dark chips | `04` + Claude table brief |
| 6 | Debounce/cache KPI fetch | perf section |
| 7 | Compact hero currency | KPI deck |
| 8 | A11y dialog | ExportPreflight |
| 9 | Server Excel large | export |
| 10 | Split monolit viewer | long horizon |

---

## 6. Cara baca pack audit

1. Ringkas ini (`19`) — 3 menit  
2. Detail skor Hermes (`17-AUDIT…`)  
3. Temuan line-level Claude (`17-CLAUDE-CODE-AUDIT-RAW`)  
4. Spec PDF (`18`) bila fokus print  

---

## 7. Batas sesi

- **Tidak ada patch production code** atas permintaan user.  
- Claude Code dijalankan **review-only** (find+report).  
- Screenshot live tetap butuh login manual.

---

**End executive summary.**
