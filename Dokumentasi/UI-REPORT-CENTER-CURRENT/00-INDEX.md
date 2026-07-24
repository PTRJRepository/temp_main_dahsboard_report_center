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

### 9. Report catalog jadi sliding rail (2026-07-23)
- **ReportRail:** grid vertikal catalog diganti rail horizontal scroll-snap per group (edge-fade mask, counter mono, progress hairline, prev/next) — lihat `11-CHANGELOG-UI-SNAPSHOT.md`.

### 10. Movement deck: grafik tampak + tahun custom + sebaran barang (2026-07-23)
- **Grafik baru:** `MovementTrendChart` (Area amount + Bar qty + Line frekuensi dokumen) + `TopMovementScatter` (Top-N item movement, toggle metrik qty/amount/docs) menggantikan UsageTrendChart di deck.
- **Filter tahun custom:** segmen [Bulan|Tahun] di filter bar; mode Tahun = input tahun bebas (2000-2100) → `dateFrom=YYYY-01-01&dateTo=YYYY-12-31`, selalu live. Snapshot valuasi bulanan tetap terkunci periode fiskal.
- **API additive:** `issueFrequency.topItems` kini menyertakan `amount`; command-deck meneruskan `dateFrom`/`dateTo` ke spec usage.
- **Verifikasi:** tsc 0, eslint 0 error baru, build exit 0.

### 11. Stock River + Insight ticker (2026-07-23)
- **StockRiverChart:** sankey DIY murni SVG alur Opening → kanal (Goods Receive / Issue Ledger / Issue Station / Issue Vehicle) → Closing, tebal pita proporsional qty, warna konsisten tone movementCards, hover memudarkan kanal lain, chip selisih imbalance jujur.
- **InsightTicker:** marquee pelan di bawah chip konteks; butir deterministik (delta qty issue vs rata-rata 3 bulan, closing < opening, item baru Top movement, frekuensi dokumen × hari aktif).
- **Verifikasi:** tsc 0, eslint 0 error baru, build exit 0.

### 12. Filter pindah ke Analysis Drawer (2026-07-23)
- **AnalysisDrawer:** seluruh kontrol filter pindah ke panel geser kanan (backdrop blur + ESC + `role="dialog"`); deck hanya menyisakan tombol "Ruang Analisis" + chip konteks aktif + ticker. Isi: preset cepat, periode Bulan/Tahun, aging, group, kode filter, item scope, lokasi, preview sparkline + insight, Reset + Terapkan. Controlled via props — sumber kebenaran filter tetap di strip.
- **Verifikasi:** tsc 0, eslint drawer bersih, build exit 0.

### 13. Lihat cepat: Glance + muat bertahap + time-scrubber + hover kaya + auto-scroll rail (2026-07-23)
- **Glance + muat bertahap:** grafik berat tidak di-mount saat `glance`; bar "Lihat semua" + auto-expand setelah loading. First paint = angka utama saja.
- **PeriodScrubber:** strip 18 titik bulan di atas deck; klik = lompat periode instan (titik penuh = closed/agregasi, berongga = live). Hanya mode Bulan.
- **Hover kaya:** tooltip `TopMovementScatter` menampilkan Frekuensi + Qty + Amount sekaligus.
- **Auto-scroll rail:** `KpiCarousel autoScroll` — rail bergeser pelan (loop), berhenti saat hover/focus, jeda 6 detik setelah interaksi manual, reduced-motion statis. Snap/prev-next/dot utuh.
- **Verifikasi:** tsc 0, eslint bersih, build exit 0. Checkpoint `6919f16`, `087fd9a`.

### 14. Estetika calm-minimal + sparkline momentum (2026-07-23)
- **Kurangi warna (H2):** `cardTitleTone` kini hanya 2 warna fungsional — emerald (nilai/positif), amber (perhatian/outstanding); seluruh kartu lain + ikon netral `border-white/10 bg-white/[0.045]`. Grafik: `TopMovementScatter` gradasi forest→abu (bukan pelangi), `StockRiverChart` receive=emerald & 3 issue=neutral lightness berjenjang, `MovementTrendChart` qty=neutral & docs=amber dashed.
- **Hirarki angka (H1):** satu protagonis — headline Master valuation diperbesar (`rc-display` ~2.8–3.4rem), label jadi meta mono redup; kartu standard diperkecil (`rc-metric` 1.15rem, label normal-case).
- **Kurangi gerakan (H3):** `InsightTicker` tak lagi marquee — statis, scroll manual; keyframes `.rc-ticker-track` dihapus dari globals.css. `KpiCarousel autoScroll` diperlambat 38→22px/s.
- **Keterbacaan (H4):** bar chip konteks aktif jadi meta mono satu baris (hanya chip "Period" amber; Code/Lokasi dineutralkan dari lime/cyan); tab section & "Lihat semua" jadi normal-case (bukan uppercase tracking lebar).
- **Kreativitas:** `Sparkline.tsx` baru (reusable) — sparkline SVG mini halus (smooth bezier, tanpa lib) + `MomentumDelta` (▲/▼ % vs rata-rata 3 periode). Disematkan di kartu hero Total Usage dari `usageTrend.amount`.
- **Verifikasi:** tsc 0, eslint 0 error baru (error `set-state-in-effect` pre-existing), build exit 0.

### 15. Movement jadi infografis penuh analisis (2026-07-23)
- **Endpoint baru:** `/api/reports/inventory/movement-matrix` — agregasi GROUP BY barang x bulan atas issue gudang + workshop (read-only, ekspresi persis report asli); periods kronologis + rows {qty[],amount[],docs[]} per barang; cache 60s.
- **Infografis baru:** `MovementMatrix` (heatmap X=periode, Y=barang, sel=jumlah movement, intensitas emerald, klik sel -> fokus periode, klik barang -> drilldown), `ChargeBreakdown` (stacked bar Blok/Vehicle/Dept + share%), `MovementTable` (pola sparkline + qty/amount/freq/momentum, sortable), `ItemDrilldown` (pop-up analisis per barang: sparkline besar, statistik, insight stagnan), dibungkus `MovementAnalytics` (satu fetch bersama, toggle Qty/Amount).
- **Integrasi:** blok reveal-order 5 setelah StockRiverChart di strip; lazy via `active={!glance}`.
- **Verifikasi:** tsc 0, eslint 0 error baru, build exit 0. Belum uji browser / data nyata.

### 16. Hierarki Procurement: PURCHASING + INVENTORY (2026-07-23)
- **Struktur kanonik:** workspace `/report-center/procurement` kini PURCHASING + INVENTORY, masing-masing dengan kategori Transactions Listing / Reports / Documents — menggantikan tab datar Semua/Gudang/Workshop/Ordering.
- **Sumber kebenaran:** `lib/reports/procurement-hierarchy.ts` (28 entri; 19 live dipetakan ke report existing, sisanya `soon`). **Nav:** `ProcurementHierarchyNav.tsx` (2-level + scope filter Gudang/Workshop di INVENTORY).
- **Integrasi:** section "Area kerja" lama diganti `<ProcurementHierarchyNav/>`; header/KPI/overview/process map/aside dipertahankan; import mati dibersihkan.
- **Verifikasi:** tsc 0, eslint bersih, build exit 0. Belum uji browser.

### 17. Katalog satu-pandangan + smart search (2026-07-23 lanjut)

- Chip group katalog = switcher group (klik = ganti, satu pandangan, scroll-spy dihapus); `groupedReports` flatten `{ group, title, reports }`.
- Saat `searching`, semua group hasil lintas katalog dirender + banner "N hasil lintas M group"; header katalog menegaskan "cari lintas group".
- **Verifikasi:** tsc 0, eslint 0 error, build exit 0. Belum uji browser.

### 18. Analisis ringkas tanpa rail taksonomi (2026-07-23 lanjut)

- Rail "Sub-category analysis" (taksonomi duplikatif) dihapus dari mode monthly; kategori analisis cukup dari Movement Category rail + kontrol kategori.
- Movement visual = panel angka besar + satu kalimat penjelasan per tahap + rincian issue Ledger/Station/Vehicle dengan share %; bukan lagi bar bertumpuk penuh teks.
- **Verifikasi:** tsc 0, eslint baseline, build exit 0. Belum uji browser.

### 19. Analisis berguna pengganti taksonomi (2026-07-23 lanjut)

- Panel "Konsentrasi issue per barang": top 5 item issue terbesar (angka, share %, qty) + makna ketergantungan stok.
- Panel "Sehat arus stok": coverage closing vs issue (×) + opening→closing (%) dengan interpretasi kondisional satu kalimat.
- **Verifikasi:** tsc 0, eslint baseline, build exit 0. Belum uji browser.

### 20. Analisis frekuensi movement (2026-07-23 lanjut)

- Metric `freq` (jumlah dok issue) menyertai qty & amount: heatmap matriks, tabel per barang (kolom Aktif x/y + ringkasan sebaran), dan drill-down (kerutinan %, rata dok/periode aktif, interpretasi fast/regular/slow-moving).
- **Verifikasi:** tsc 0, eslint 0 error baru, build exit 0. Belum uji browser.

### 21. Kontrol timeline movement (2026-07-23 lanjut)

- Bar kontrol timeline di atas deck: preset 6/12/24 bln + input kustom 3–36 bln + label rentang aktual; matriks/tabel/drill-down ikut refetch sesuai rentang.
- **Verifikasi:** tsc 0, eslint baseline, build exit 0. Belum uji browser.

### 22. Verifikasi browser nyata (playwright-cli)

- Katalog chip-switcher + smart search lintas group (banner hitungan benar), timeline 6/12/24/kustom (label rentang ikut berubah) — semua terverifikasi di Chrome nyata.
- Gap jujur: konten data movement (tab Freq, matriks, drill-down) belum bisa diverifikasi dengan data nyata — DB sumber tak terjangkau dari mesin ini (API matrix `fetch failed`); empty-state-nya tampil benar.

### 23. Grafik tren dinamis Qty/Valuasi/Freq di movement deck (2026-07-24)

Panel **Tren movement** baru di atas matriks: grafik tren agregat periode yang
mengikuti metric toggle yang sama (satu sumber kebenaran di MovementAnalytics).
Komponen: `components/report-center/MovementTrend.tsx` (recharts ComposedChart;
dipasang di `MovementAnalytics.tsx` di bawah bar timeline, h-[260px]).

- Toggle **Qty / Valuasi / Freq** di header panel — sinkron dengan matriks, tabel,
  dan drill-down (state `metric` bersama). Valuasi/Qty = area emerald; Freq =
  garis amber dengan dot; batang frekuensi abu jadi konteks ritme saat metrik utama
  bukan freq.
- Header merangkum: total metrik terpilih, periode puncak, dan delta % vs periode
  lalu (emerald = naik, amber = turun).
- Data = agregasi `sum` periode dari seluruh baris matriks
  (`/api/reports/inventory/movement-matrix`) — tanpa fetch baru.
- Empty-state netral (bukan error) saat DB tak terjangkau — terverifikasi via
  playwright: toggle Qty/Valuasi/Freq mengubah label header ('Total nilai (Rp)' →
  'Total quantity' → 'Total frekuensi dok'), 0 error JS.

Verifikasi: `npx tsc --noEmit` ✓, `npx eslint` kedua file ✓ (0 error baru),
`npm run build` ✓ (exit 0), playwright interaksi toggle ✓. Catatan: perilaku
dengan data nyata belum terverifikasi — DB sumber tak terjangkau dari mesin ini.

### 24. Trend pengeluaran selalu 5 bulan ke belakang (2026-07-24)

Masalah: "Trend butuh rentang lebih lebar" — grafik tren usage hanya berisi satu
titik saat user memilih periode bulan tunggal (trend mengikuti filter periode).

Solusi di `app/api/reports/inventory/route.ts` (handler stockIssue /
pengeluaran-barang): CTE baru `issueTrendRowsCte` — kolom identik dengan
`issueRowsCte`, tapi rentang tanggal **selalu 5 bulan ke belakang dari bulan
anchor** (anchor = dateTo / bulan period / bulan berjalan; bulan anchor ikut
inklusif). Query `trend` dan `issueFrequency.byMonth` kini memakai CTE ini.
Filter lokasi/itemType tetap dihormati; filter periode utama TIDAK memengaruhi
rentang tren. KPI ringkasan lain tetap memakai periode terpilih.

UI `MovementTrendChart.tsx`: label header "Trend movement · 5 bulan" + "N titik";
empty-state baru "Belum ada movement pada 5 bulan terakhir" dengan penjelasan
rentang tetap (bukan lagi menyuruh user ganti mode).

Terverifikasi playwright dengan DATA NYATA: grafik kini terisi — "3 titik ·
puncak Jun 26 — Rp 11.5 M · Total Rp 27.7 M" (Apr/Jun/Jul 26) padahal periode
terpilih bulan tunggal. 0 error JS. Verifikasi statis: simulasi node
string-replace CTE cocok untuk cabang bulan & custom year; tsc 0; eslint 0
error baru (13 warning pre-existing); build exit 0.

### 25. Analisis frekuensi issue level deck + mode demo matriks (2026-07-24)

Panel **Analisis frekuensi issue** baru di bawah tabel movement
(`components/report-center/FrequencyInsights.tsx`, dipasang di
`MovementAnalytics.tsx` h-[280px]) — agregat deck, melengkapi analisis frekuensi
per-barang di ItemDrilldown:

- **Ritme dokumen issue** — bar strip periode (hover = jumlah dok);
  ringkasan: total dok, periode aktif x/y + % konsisten, rata dok/periode,
  periode teramai & tersepi.
- **Sebaran kerutinan barang** — stacked bar + legenda: Fast (≥80% periode
  aktif) / Reguler (≥40%) / Slow (<40%).
- **Paling sering di-issue** — top 5 barang by jumlah dok + share %; klik
  membuka ItemDrilldown barang itu.
- Data dari rows matriks yang sama (cells.docs) — tanpa fetch baru.

Mode demo matriks: `GET /api/reports/inventory/movement-matrix?demo=1`
menghasilkan matriks sintetis deterministik (mulberry32, 12 item pola
fast/reguler/slow/seasonal) tanpa DB — hanya aktif dengan param eksplisit;
dipakai untuk verifikasi UI saat DB tak terjangkau.

Terverifikasi playwright (patch fetch window → demo=1): panel render penuh —
"132 dok · 6/6 periode aktif (100% konsisten) · rata 22.0 dok/periode",
ritme 25/23/23/18/17/26, sebaran Fast 4 Reguler 5 Slow 3, top list "NPK
12/12/17/2 + TE · 28 dok · 21%"; klik top item membuka dialog drilldown barang
itu. 0 error JS. tsc 0, eslint 0, build exit 0.

### 26. 2026-07-24 - Restyle deck ala market/crypto
- Ticker insight marquee + leaderboard Top movement (gradient emerald) + badge delta ▲/▼ pada kartu KPI.

### 27. 2026-07-24 - Input tahun custom untuk timeline movement
- Custom timeline movement diisi tahun (1-10) mundur dari sekarang + penjelasan periode eksplisit; fix submit terblokir validasi HTML5.

### 28. 2026-07-24 - Panel Jumlah Issue selalu terlihat
- Panel always-visible berisi jumlah issue (event/qty/dokumen/top item) + breakdown, terpisah dari carousel Movement.

### 29. 2026-07-24 - MarketTicker ala bursa di deck procurement
- Pita KPI berjalan (LABEL + nilai + ▲/▼) di atas panel Total Usage, mengikuti scope & periode KPI.

### 30. 2026-07-24 - Analisis tren lengkap di MovementTrend
- Rata-rata/periode, tertinggi & terendah, arah tren (naik/turun/datar), jumlah titik — mengikuti toggle metrik.

### 31. 2026-07-24 - Analisis lintas-metrik di MovementTrend
- Chip: harga rata-rata/unit, qty/dok, nilai/dok, konsentrasi puncak — dihitung dari agregat penuh, independen dari toggle aktif.

### 32. 2026-07-24 - Fix anchor tren movement ke bulan terakhir berdata
- Anchor window 12 bulan = bulan dengan issue terakhir (bukan periode terpilih), jadi tren tidak lagi kosong saat periode terpilih belum berdata.

### 33. 2026-07-24 - Aturan pemilihan tabel: periode lampau = monthend
- Periode lampau memakai snapshot monthend (IN_MTHENDITEM); periode berjalan memakai balance live. Sudah diterapkan di valuation & opening/closing.

### Gap jujur (belum terverifikasi)
- Screenshot media browser (butuh login manual — auth gate).
- `topLists` / `trend` / `issueFrequency` belum smoke-test ke SQL Gateway live.
- Carousel behavior di mobile belum diuji.
- Grafik movement + mode tahun belum diuji ke data nyata (hanya konsistensi tipe).

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
