# UI Report Center — Dokumentasi Tampilan Terkini

**Folder:** `Dokumentasi/UI-REPORT-CENTER-CURRENT/`  
**Status:** living docs (update saat UI berubah)  
**Snapshot kode:** 2026-07-23 (post visual overhaul + hallmark pass)  
**Branch aktif:** `feat/report-center-technical-luxury`  
**Commit terakhir:** `0c8aa4e` (hallmark audit pass)  
**Runtime acuan:** production `bun run server_bun.js` · gateway **:3001** · Next dashboard **:3100**  
**Mode auth:** `/report-center/*` butuh login (`returnTo` redirect) — browser agent tanpa session tidak bisa screenshot live; dokumentasi ini berbasis **kode UI production path** + plan terkait.

**Agent entry (baca dulu):** `Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md` — peta cepat semua pack UI/KPI/audit/prompt.

---

## Ringkasan terkini (post visual overhaul, 2026-07-23)

State **LIVE** di `ProcurementKpiStrip.tsx` + komponen baru (commit `1bef165` visual overhaul → `0c8aa4e` hallmark pass). Semua terverifikasi `tsc` 0 + `next build` exit 0.

### 1. Procurement Command Deck (KPI master)
- **Hero always-on** (3 kartu): Total Valuasi (Master valuation) · Arus Bersih · Total Usage.
- **Chip insight** di kartu hero: Frekuensi (event/hari aktif), Intensitas (usage/valuasi), Return rate (return/usage amount, all-time — label jujur).
- **Tab secondary**: Valuasi · Proses · Movement. Kartu KPI section di dalam tab kini **carousel slide** (`KpiCarousel.tsx`) — snap-scroll horizontal + tombol prev/next + dot indicator. Hero tetap grid.
- **PO fill rate** (Qty Receive / Qty Order) via helper `poFillRate()` di kartu PO Outstanding.

### 2. Procurement Flow Strip (interaktif)
- `ProcurementFlowStrip.tsx` — alur **PR → PO → Receive → Issue → Return** dengan konektor animasi (framer-motion).
- Klik tahap = navigasi ke report terkait. Nilai per tahap live dari `summary` (PR count/outstanding, PO count/fill, receive docs/qty, issue docs/qty, return amount/rate).

### 3. Usage Trend Chart
- `UsageTrendChart.tsx` — area chart bulanan (recharts) dari field `trend` baru di payload `pengeluaran-barang` (GROUP BY bulan, ikut filter periode). Gradient forest, tooltip mono, label puncak.

### 4. Top usage periode (3 dimensi)
- Footer toggle **Item | Dept | Kendaraan** dari `topLists` (Top 5 by amount); fallback ke `usage.chart` bila kosong.
- Pilihan periode diperluas 8 → **18 bulan**.

### 5. Data plumbing
- **Composite endpoint** `GET /api/reports/procurement/command-deck` — 8 report KPI server-side paralel, in-memory TTL cache 30s. Client fetch SATU kali; fallback otomatis ke 8-fetch legacy bila gagal.
- `stockIssue` summary diperkaya: `ActiveIssueDays` + `topLists` (`items`/`costCenters`/`vehicles`).
- `lib/reports/procurement-kpi-math.ts` — pure helpers `frequencyPerDay`, `poFillRate`, `returnRate`, `usageIntensity` + unit test (lulus).

### 6. Tipografi & surface
- Font: **Sora** (display, `--font-display`) untuk angka KPI + **JetBrains Mono** (data, `--font-data`) untuk chip/label teknis. Inter tetap body.
- Utility `.rc-*` baru di `globals.css`: `.rc-display`, `.rc-data`, `.rc-eyebrow`, `.rc-metric`, `.rc-chip`, `.rc-hairline`, `.rc-kpi-surface`, `.rc-reveal` (staggered rise), `.rc-carousel-track`.
- **Hallmark audit pass** (`0c8aa4e`): eyebrow dekoratif dipurge (default OFF), elevation on dark via lightness (bukan glow berwarna), card-in-card di trend chart diredam.

### Komponen baru (semua LIVE)
| File | Peran |
|------|-------|
| `ProcurementFlowStrip.tsx` | Flow interaktif 5 tahap |
| `UsageTrendChart.tsx` | Area chart bulanan |
| `KpiCarousel.tsx` | Carousel slide kartu KPI |
| `ProcurementKpiStrip.tsx` | Orchestrator deck (hero, tab, flow, trend, top usage) |
| `AggregationControlPanel.tsx` | Ruang kontrol agregasi (status closed/open, bangun agregasi) |

### 7. Pre-rendered monthly aggregation + ruang kontrol (2026-07-23)
- **Arsitektur:** KPI bulanan untuk periode CLOSED (immutable) di-render sekali & disimpan; periode CURRENT / tanpa-period / detail selalu live. KPI ringan; query berat hanya saat user minta detail.
- **Store:** Prisma `MonthlyReportAggregate` (SQLite) — key `(handlerKey, source, period, filterHash)`, simpan `summary/chart/topLists/trend`. Detail `rows` tidak disimpan.
- **Helper:** `isClosedActualPeriod` + `currentActualPeriodJakarta` (`accounting-period.ts`); `monthly-aggregate-store.ts` (Prisma + `filterHashFor`); `monthly-aggregate.ts` (`resolveAggregationPeriod`/`serveAggregate`/`persistAggregate`). Unit test lulus.
- **Hook:** `handleInventoryGet` melayani periode closed dari store (hit) atau hitung live + persist (miss); pipeline post-handler tetap → kontrak identik. `metadata.aggregation.mode = pre-aggregated|live`.
- **Control room:** `GET/POST/DELETE /api/reports/inventory/aggregation` + halaman penuh `/report-center/control` (dipisah dari deck).
- **Status:** tsc 0, test lulus, build exit 0. Belum smoke-test SQL gateway live; prioritas 8 KPI deck (report lain ikuti jalur yang sama).

### 8. Dedicated control-room route + movement deck diperkaya (2026-07-23)
- **Route baru:** `/report-center/control` (statis) — halaman Ruang Kontrol Agregasi penuh (ringkasan ter-render/sel/baris, toggle source, panel penuh, tabel data ter-render). Panel dicabut dari deck; deck hanya menautkan ke sana.
- **API additive:** `stockIssue` menambah `issueFrequency` (dokumen unik per bulan + Top 5 item by frekuensi dokumen); `ReportPayload.issueFrequency` ditambahkan.
- **Command deck:** `KpiKey movementMonthly` → `monthly-stock-account-movement-details`; `issueFrequency` diteruskan ke client.
- **Movement deck:** `movementCards` 3 → 8 kartu (Frekuensi Issue, Opening vs Closing Qty, Goods Receive Qty, Issued Qty Split Ledger/Station/Vehicle, Paling Sering Di-issue) — quantity 14-kolom, bukan hanya amount.
- **Verifikasi:** tsc 0, build exit 0, route `/report-center/control` muncul.

### Gap jujur (belum terverifikasi)
- Screenshot media browser (butuh login manual — auth gate).
- `topLists` / `trend` belum smoke-test ke SQL Gateway live.
- Carousel behavior di mobile belum diuji.

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
