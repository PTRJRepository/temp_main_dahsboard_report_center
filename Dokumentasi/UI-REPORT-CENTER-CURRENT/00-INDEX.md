# UI Report Center — Dokumentasi Tampilan Terkini

**Folder:** `Dokumentasi/UI-REPORT-CENTER-CURRENT/`  
**Status:** living docs (update saat UI berubah)  
**Snapshot kode:** 2026-07-22  
**Runtime acuan:** production `bun run server_bun.js` · gateway **:3001** · Next dashboard **:3100**  
**Mode auth:** `/report-center/*` butuh login (`returnTo` redirect) — browser agent tanpa session tidak bisa screenshot live; dokumentasi ini berbasis **kode UI production path** + plan terkait.

**Agent entry (baca dulu):** `Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md` — peta cepat semua pack UI/KPI/audit/prompt.

---

## Baca cepat (5 menit)

1. `01-SCREEN-MAP-AND-IA.md` — peta layar & hirarki  
2. `02-KPI-COMMAND-DECK.md` — **KPI master atas (terbaru)**  
3. `12-WIREFRAME-FULL-PAGE.md` — wireframe full page  
4. `03-UX-FLOWS.md` + `13-FILTER-MATRIX.md` — alur & filter  
5. `08` + `09` — overview + catalog  
6. `04` + `10` — tabel & monthly detail  
7. `16-QA-CHECKLIST-UI.md` — cek manual  
8. `06` + `11` — horizon & changelog  

Deep: `05` tokens · `14` components · `15` copy · `07` gaps  

---

## Isi folder

| File | Isi |
|------|-----|
| `00-INDEX.md` | Indeks ini |
| `01-SCREEN-MAP-AND-IA.md` | Sitemap, modul, dual monolith |
| `02-KPI-COMMAND-DECK.md` | Filter, hero, rails, top usage, formula, API fetches |
| `03-UX-FLOWS.md` | Flow end-to-end + filter ownership |
| `04-TABLE-AND-DETAIL-DESIGN.md` | Catalog cards, detail table, control bar, monthly ringkasan |
| `05-DESIGN-SYSTEM-TOKENS.md` | Warna, `.rc-*`, pola kartu |
| `06-LONG-HORIZON-ROADMAP.md` | Near / mid / long term |
| `07-SOURCE-OF-TRUTH-AND-GAPS.md` | File kode, docs terkait, yang sudah/belum |
| `08-INVENTORY-OVERVIEW.md` | Overview movement composition + exceptions |
| `09-CATALOG-AND-PROCESS-MAP.md` | Tabs area kerja, ordering cards, process map 6 stage |
| `10-MONTHLY-DETAIL-RINGKASAN.md` | RPTIN1000015 ringkasan + control bar |
| `11-CHANGELOG-UI-SNAPSHOT.md` | Changelog living UI |
| `12-WIREFRAME-FULL-PAGE.md` | ASCII wireframe desktop/mobile/detail |
| `13-FILTER-MATRIX.md` | Matriks filter × surface |
| `14-COMPONENT-INVENTORY.md` | Inventaris komponen UI |
| `15-UI-COPY-GLOSSARY.md` | Glossary copy ID |
| `16-QA-CHECKLIST-UI.md` | Checklist QA manual |
| `17-AUDIT-UX-PDF-TABLE-PERF.md` | **Audit skor estetika/PDF/tabel/perf** (Hermes) |
| `17-CLAUDE-CODE-AUDIT-RAW.md` | Output mentah Claude Code (overall 6.4) |
| `18-PDF-REDESIGN-SPEC.md` | Spec redesign PDF pratinjau → resmi |
| `19-EXECUTIVE-SUMMARY-AUDIT.md` | **Ringkas gabungan Hermes + Claude** |

---

## Dokumen terkait (luar folder)

| Path | Peran |
|------|--------|
| `Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md` | Plan redesign KPI |
| `Dokumentasi/KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md` | Katalog KPI pick-list |
| `Dokumentasi/PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md` | Prompt implement agent |
| `Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md` | Pack redesign detail report |
| `Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx` | **Implementasi KPI deck live** |

---

## Prinsip dokumentasi di folder ini

1. **Describe current UI** dulu, baru “target ideal”.  
2. Label jelas: `LIVE` / `PARTIAL` / `PLANNED`.  
3. Konflik → **kode menang** atas dokumen lama.  
4. Jangan salin secret/API key.  
5. User boleh stop manual kapan saja; folder ini tetap valid sebagai baseline.

---

**End index.**
