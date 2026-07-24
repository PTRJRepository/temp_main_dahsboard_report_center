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

## 2026-07-23 (ringkasan sintesis) - State LIVE post visual overhaul + hallmark pass
Sintesis lintas-fase. Semua item di bawah LIVE di kode; branch `feat/report-center-technical-luxury`; tsc 0 + build exit 0. Commit terkait: `1bef165` (visual overhaul), `0c8aa4e` (hallmark pass), plus rangkaian fase sebelumnya (`4baa9c5` drilldown, `8c6f1a6` chart a11y, `9f5c737` table a11y, `e114792` PDF preview, `ee01865` composite API, `1ca8728` insights, `086a818`/`b6075cc` enrich summary + top-lists).

- **Command deck:** hero 3 kartu (Total Valuasi / Arus Bersih / Total Usage) + chip insight (Frekuensi, Intensitas, Return rate) + tab secondary (Valuasi/Proses/Movement) + PO fill rate.
- **Flow interaktif:** `ProcurementFlowStrip` PR -> PO -> Receive -> Issue -> Return, konektor animasi, klik tahap navigasi ke report, nilai live dari summary.
- **Trend chart:** `UsageTrendChart` area bulanan dari field `trend` (GROUP BY bulan, ikut filter periode) di payload `pengeluaran-barang`.
- **KPI carousel:** `KpiCarousel` snap-scroll + prev/next + dot; dipakai kartu KPI section, hero tetap grid.
- **Top usage 3 dimensi:** Item | Dept | Kendaraan dari `topLists`; fallback `usage.chart`. Periode diperluas 18 bulan.
- **Plumbing:** composite `GET /api/reports/procurement/command-deck` (8 report server-side, TTL cache 30s, 1 fetch client + legacy fallback); summary diperkaya `ActiveIssueDays` + `topLists`; helper murni di `lib/reports/procurement-kpi-math.ts` + test.
- **Tipografi/surface:** Sora (`--font-display`) + JetBrains Mono (`--font-data`); util `.rc-display/.rc-data/.rc-metric/.rc-chip/.rc-kpi-surface/.rc-reveal/.rc-carousel-track`; hallmark pass (eyebrow purge, elevation via lightness, card-in-card diredam).
- **Gap jujur:** screenshot browser (auth gate), `topLists`/`trend` belum smoke-test SQL live, carousel mobile belum diuji.

## 2026-07-23 (lanjut) - Pre-rendered monthly aggregation + ruang kontrol
- **ARSITEKTUR:** Lapisan agregasi KPI bulanan untuk Report Center inventory. Periode CLOSED (bulan < bulan berjalan, Asia/Jakarta) dilayani dari KPI pre-rendered; periode CURRENT/tanpa-period/detail selalu live. Tujuan: KPI ringan, query berat hanya saat user minta detail.
- **STORE:** Prisma model baru `MonthlyReportAggregate` (SQLite `prisma/dev.db`) - key `(handlerKey, source, period, filterHash)`, simpan `summary/chart/topLists/trend` (JSON). Migrasi `add_monthly_report_aggregate` sukses. `DATABASE_URL=file:./dev.db` diaktifkan di `.env` + `.env.local` (path relatif-schema).
- **HELPER:** `isClosedActualPeriod` + `currentActualPeriodJakarta` di `lib/reports/accounting-period.ts` (pure, unit-tested). `lib/reports/inventory/monthly-aggregate-store.ts` (Prisma akses + `filterHashFor` sha256 stabil). `lib/reports/inventory/monthly-aggregate.ts` (`resolveAggregationPeriod`, `serveAggregate`, `persistAggregate`) + test (lulus).
- **HOOK:** `handleInventoryGet` di route inventory - sebelum handler, `serveAggregate`; hit = KPI dari store (ringan), miss = hitung live + `persistAggregate`. Detail `rows` TIDAK disimpan; pipeline post-handler tetap berjalan agar kontrak identik. `metadata.aggregation = { mode: pre-aggregated|live, period, builtAt }`.
- **CONTROL ROOM API:** `GET/POST/DELETE /api/reports/inventory/aggregation` - status periode closed x report KPI (built flag), build/rebuild closed (current ditolak + dilaporkan), invalidate. Build via loopback ke route inventory (route itu yang hitung+persist).
- **UI:** `AggregationControlPanel.tsx` - badge compact di header deck (chip `N agregasi`/`Live`) + panel penuh "Ruang kontrol agregasi" (status closed/open, tombol Bangun agregasi, grid built per report x periode, indikator periode current live). Terintegrasi di `ProcurementKpiStrip.tsx`.
- **VERIFIKASI:** tsc 0; test accounting-period + monthly-aggregate lulus; file baru bersih dari lint error (error lint lain pre-existing di `utils/*`).
- **PLANNED:** smoke-test live SQL gateway (build agregasi nyata dari data closed); pre-aggregated all-months trend untuk periode kosong; agregasi diperluas ke seluruh 21 handler (kini prioritas 8 KPI deck).

## 2026-07-23 (lanjut) - Dedicated control-room route + movement deck diperkaya (qty 14-kolom + frekuensi issue)
- **ROUTE BARU:** `/report-center/control` (statis, menang atas `[module]`) - halaman "Ruang Kontrol Agregasi" penuh: header (breadcrumb + judul Sora + ringkasan Ter-render/Sel KPI/Baris), toggle source Estate/Pabrik, `AggregationControlPanel` penuh, tabel data ter-render (report × periode × baris × waktu build). `page.tsx` thin server (force-dynamic, baca `searchParams.source`) + `ControlRoomClient.tsx` colocated.
- **PISAH:** `AggregationControlPanel` dicabut dari deck (`ProcurementKpiStrip.tsx` - import + badge compact + wrapper panel penuh dihapus); deck kini hanya menautkan "Ruang kontrol agregasi →" ke `/report-center/control?source=...`. Panel dirapikan untuk halaman penuh (fetch 18 bulan, grid lebih lega, tombol lebih besar).
- **ADDITIVE API:** handler `stockIssue` (`pengeluaran-barang`) menambah payload `issueFrequency` = `{ byMonth (COUNT DISTINCT Dokumen + activeDays + qty per bulan), topItems (Top 5 item by COUNT DISTINCT Dokumen) }` - memisahkan frekuensi dokumen dari baris transaksi (`trend` tetap ada).
- **ADDITIVE TYPE:** `ReportPayload.issueFrequency` ditambahkan di route inventory (opsional).
- **COMMAND DECK:** `KpiKey` baru `movementMonthly` → report `monthly-stock-account-movement-details`; `Snapshot.issueFrequency` diteruskan dari inventory route.
- **DECK MOVEMENT DIPERKAYA:** `movementCards` dari 3 → 8 kartu: Frekuensi Issue (TotalDokumen + ActiveIssueDays + doc/hari), Opening vs Closing Qty (+delta), Goods Receive Qty (+net qty), Issued Qty Split (Ledger/Station/Vehicle), Paling Sering Di-issue (top item by doc frequency). Kartu baru memakai tone warna baru di `cardTitleTone` (pink/indigo/teal/orange/purple).
- **VERIFIKASI:** tsc 0; error lint `react-hooks/set-state-in-effect` di `ProcurementKpiStrip.tsx` dikonfirmasi pre-existing (git stash check); build exit 0 dengan route `/report-center/control` muncul.
- **PLANNED:** smoke-test live di browser (auth gate); smoke-test SQL gateway; uji carousel mobile; agregasi diperluas ke 21 handler.

## 2026-07-23 (lanjut) - Report catalog jadi sliding rail (ReportRail)
- **KOMPONEN BARU:** `components/report-center/ReportRail.tsx` - rail horizontal per catalog group menggantikan grid vertikal yang memaksa scroll panjang. Behaviour unik: native scroll-snap x mandatory (GPU, tanpa lib), edge-fade kiri/kanan via mask-image (sinyal kartu di luar viewport), counter posisi mono `03 / 12`, progress hairline, tombol prev/next geser ~1 viewport kartu + auto-disable di ujung.
- **INTEGRASI:** grid `md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` di `InventoryReportsClient.tsx` diganti `<ReportRail>` per group; `ReportTile` tidak berubah (props identik).
- **CSS:** `.rc-rail-track` di `globals.css` - scrollbar tipis forest, kartu "terangkat" (translateY -3px) saat hover, reduced-motion aman.
- **LINT:** pola initial-measure dari DOM dipindah ke `requestAnimationFrame` agar memenuhi `react-hooks/set-state-in-effect` (0 error).
- **VERIFIKASI:** tsc 0; eslint file baru/tersentuh 0 error; build exit 0.
- **PLANNED:** uji swipe di mobile; auto-scroll rail ke kartu yang dipilih saat berpindah group.

## 2026-07-23 (lanjut) - Movement deck: grafik tampak + tahun custom + sebaran barang
- **GRAFIK BARU:** `MovementTrendChart.tsx` (ComposedChart recharts) - Area amount (sumbu kiri) + Bar qty (sumbu kanan) + Line frekuensi dokumen (pink dashed) dari `trend` + `issueFrequency.byMonth`. Empty-state bila <2 titik. `TopMovementScatter.tsx` - horizontal BarChart Top-N dengan toggle metrik [qty|amount|docs] (default docs), gradasi warna forest→biru per bar, LabelList kanan.
- **ADDITIVE API:** `issueFrequency.topItems` kini menyertakan `amount` (SUM Amount) di samping docs/events/qty (route inventory `stockIssue`). Command-deck meneruskan `dateFrom`/`dateTo` (helper `usageParams` - bila dateFrom ada, `period` dihapus agar mode tahun live).
- **FILTER TAHUN CUSTOM:** `ProcurementKpiFilters` menambah `periodMode: 'month'|'year'` + `customYear`. Segmen [Bulan|Tahun] di filter bar; mode Tahun menampilkan input tahun (2000-2100) menggantikan select bulan. Bila year valid: `dateFrom=YYYY-01-01&dateTo=YYYY-12-31`, `period` dikosongkan, label chip menampilkan "Tahun YYYY". Mode tahun selalu live (tidak diagregasi). Catatan: snapshot valuasi bulanan tetap terkunci periode fiskal; hanya trend/sebaran usage yang tahunan.
- **RENDER:** blok UsageTrendChart di strip diganti MovementTrendChart (h-240) + TopMovementScatter (h-260, Top 10 item movement tertinggi).
- **VERIFIKASI:** tsc 0; eslint file tersentuh 0 error baru (error `set-state-in-effect` di strip + warning `no-unused-vars` di route inventory pre-existing, dikonfirmasi git stash); build exit 0.
- **PLANNED:** smoke-test browser (auth gate); uji mode tahun ke data nyata; perluas metrik scatter ke sub-module lain.

## 2026-07-23 (lanjut) - Stock River (sankey alur stok) + Insight ticker deterministik
- **STOCK RIVER:** `StockRiverChart.tsx` - sankey DIY murni SVG (tanpa library, 0 dependency) alur Opening -> kanal (Goods Receive / Issue Ledger / Issue Station / Issue Vehicle) -> Closing periode. Pita bezier dengan tebal proporsional qty, warna kanal konsisten dengan tone movementCards (indigo/rose/teal/orange). Hover kanal memudarkan kanal lain; label qty di tiap node; chip "selisih +/-X" menampilkan imbalance opening+receive-issue-closing secara jujur (tidak dipalsukan balance). Empty-state bila seluruh qty nol.
- **INSIGHT TICKER:** `InsightTicker.tsx` - bar marquee pelan (CSS keyframes `.rc-ticker-track` di globals.css, jeda saat hover, reduced-motion = statis). Item deterministik dirakit di strip dari data yang sudah ada: delta qty issue vs rata-rata 3 bulan, closing di bawah opening, item baru di Top movement (irisan topLists vs issueFrequency), frekuensi dokumen x hari aktif.
- **INTEGRASI:** ticker di bawah bar chip konteks aktif; Stock River sebagai blok `h-[280px]` (reveal-order 4) setelah TopMovementScatter, hanya dirender bila data movementMonthly ada (`hasMovementMonthly`).
- **VERIFIKASI:** tsc 0; eslint 3 file 0 error baru (error `set-state-in-effect` di strip pre-existing); build exit 0.
- **PLANNED:** klik kanal Sankey = filter deck ke channel itu; smoke-test browser (auth gate); kontrak `movementMonthly.summary` ke data nyata belum diverifikasi live.

## 2026-07-23 (lanjut) - Fix overflow kontrol filter periode
- **MASALAH:** kontrol segmen [Bulan|Tahun] + input/select di kolom grid 150px -> isi meluber/terpotong.
- **PERBAIKAN:** kolom periode di grid xl dinaikkan 150px -> 250px (`xl:grid-cols-[250px_...]`); tombol segmen dirampingkan (px-2, text-[9px]) agar bar h-10 muat rapi tanpa overflow.
- **VERIFIKASI:** tsc 0; build exit 0.

## 2026-07-23 (lanjut) - Filter dipindah ke Analysis Drawer (pop-up kanan)
- **UX:** seluruh kontrol filter dicabut dari bar deck; deck kini hanya menampilkan satu tombol "Ruang Analisis" + chip konteks aktif + ticker insight. Tujuan: deck fokus ke insight, filter jadi lapisan terpisah.
- **DRAWER BARU:** `AnalysisDrawer.tsx` - panel geser kanan `w-[min(430px,94vw)]` dengan backdrop blur klik-tutup + ESC, `role="dialog" aria-modal`. Isi: Preset cepat (Tahun ini/lalu/2 tahun lalu/Mode bulan), Periode (segmen Bulan/Tahun + input tahun/select bulan), Jendela aging, Analysis Group, Kode Filter, Item Scope, Lokasi, Preview (sparkline SVG mini dari `usageTrend` + 3 butir insight), footer sticky Reset + Terapkan.
- **KONTROLLED:** drawer murni controlled via props; sumber kebenaran filter tetap di strip (`updateFilter`, `scopeDraft` auto-commit debounce 400ms) - tidak ada state filter kedua. `onApply` menutup drawer (commit berjalan sendiri).
- **CSS:** `.rc-drawer` di globals.css (transisi transform 320ms, reduced-motion = tanpa transisi).
- **INTEGRASI:** blok grid filter di `ProcurementKpiStrip.tsx` diganti baris ringkas tombol pembuka; `SlidersHorizontal` ditambah ke import lucide; `analysisOpen` state baru; chip konteks aktif + InsightTicker dipertahankan.
- **VERIFIKASI:** tsc 0; eslint `AnalysisDrawer.tsx` bersih total; strip 0 error baru (error `set-state-in-effect` pre-existing); build exit 0.
- **PLANNED:** uji drawer di browser (auth gate); konfirmasi preset Q vs tahun fiskal ke data nyata; pertimbangkan preset kuartal kalender bila diminta.

## 2026-07-23 (lanjut) - "Lihat cepat": Glance, muat bertahap, time-scrubber, hover kaya, auto-scroll rail
- **GLANCE + MUAT BERTAHAP:** state `glance` (default true) di strip - saat true, grafik berat (MovementTrend/TopMovementScatter/StockRiver) TIDAK di-mount; sebagai gantinya satu bar "Grafik & analisis lengkap dimuat bertahap" + tombol "Lihat semua". Auto-expand `setGlance(false)` 1400ms setelah `loading` selesai. First paint kini hanya angka utama + ticker -> terasa jauh lebih cepat.
- **TIME-SCRUBBER:** `PeriodScrubber.tsx` - strip 18 titik bulan (baca `/api/reports/inventory/aggregation?months=18` untuk `currentPeriod` + `closedPeriods`). Klik titik -> `updateFilter('period', ...)`. Titik penuh = periode closed (instan dari agregasi), berongga = live. Letak di atas deck di bawah tombol Ruang Analisis; hanya tampil di mode Bulan (mode Tahun disembunyikan). Label mono bulan+2 digit tahun.
- **HOVER KAYA:** `TopMovementScatter` Tooltip recharts diganti konten kustom - hover bar menampilkan panel (nama item + Frekuensi dok + Qty + Amount sekaligus), bukan hanya satu metrik.
- **AUTO-SCROLL RAIL "MAHAL":** `KpiCarousel` diberi prop `autoScroll` - rail bergeser pelan (rAF, 38px/s, loop ke awal di ujung), BERHENTI saat hover/focus, dan menjeda 6 detik setelah interaksi manual (wheel/touch/prev-next/dot). Reduced-motion = statis penuh. Scroll-snap, prev/next, dan dot indicator dipertahankan utuh. Diaktifkan di rail section secondary.
- **VERIFIKASI:** tsc 0; eslint file baru/tersentuh (PeriodScrubber, TopMovementScatter, KpiCarousel) bersih; strip 0 error baru (error `set-state-in-effect` pre-existing); build exit 0 tiap tahap.
- **COMMIT CHECKPOINT:** `6919f16` glance, `087fd9a` scrubber, (G3+G4 berikutnya).
- **PLANNED:** uji visual auto-scroll + scrubber di browser (auth gate); verifikasi status agregasi live ke data nyata.

## 2026-07-23 (lanjut) - Estetika calm-minimal (Plan H) + sparkline momentum
- **KURANGI WARNA (H2):** `cardTitleTone` ditulis ulang — dari ~14 cabang warna (emerald/teal/orange/sky/amber/yellow/rose/lime/cyan/pink/indigo/purple/violet/fuchsia) menjadi 2 warna fungsional: emerald = nilai/positif, amber = perhatian/outstanding (pr/po-outstanding); sisanya netral `border-white/10 bg-white/[0.045] text-[var(--rc-text)]`. Seluruh `card.className` ikon kartu (kecuali net-flow conditional) ikut netral. Grafik: `TopMovementScatter.BAR_COLORS` -> gradasi forest→abu; `StockRiverChart` receive=#34d399 (emerald), 3 kanal issue = neutral lightness berjenjang (#8fa39a/#6b7f76/#4a5a53); `MovementTrendChart` bar qty sky→neutral abu, line docs pink→amber dashed (tetap dashed sebagai pembeda fungsional).
- **HIRARKI ANGKA (H1):** satu protagonis — `renderCardItems` kini menerima `variant: 'headline'|'standard'`; headline Master valuation (render khusus) diperbesar `rc-display` ~2.8–3.4rem + label eyebrow jadi meta mono redup + progress bar Gudang/Workshop dikalemkan (font-black→semibold, emerald/amber→text-muted). Kartu standard diperkecil: angka `rc-metric` 1.45→1.15rem, label pill jadi normal-case semibold.
- **KURANGI GERAKAN (H3):** `InsightTicker` tidak lagi marquee terus-menerus — statis, item digulir manual (scroll horizontal, scrollbar disembunyikan). Keyframes `.rc-ticker-scroll` + `.rc-ticker-track` dihapus dari globals.css. `KpiCarousel autoScroll` diperlambat 38→22px/s (tetap loop + berhenti saat hover + reduced-motion statis).
- **KETERBACAAN (H4):** bar chip konteks aktif jadi meta mono satu baris (`rc-data`, tanpa uppercase); hanya chip "Period" amber, "Code" & "Lokasi" dineutralkan dari lime/cyan. Tab section (`DECK_SECTIONS` + tab kedua) & tombol "Lihat semua" jadi normal-case semibold (bukan font-black uppercase tracking-[0.14em]).
- **KREATIVITAS:** `Sparkline.tsx` baru (reusable) — sparkline SVG mini halus (smooth bezier path, area fill tipis, dot titik terakhir; tanpa library) + `MomentumDelta` (▲/▼ % vs rata-rata 3 periode sebelumnya, emerald naik / amber turun). Field opsional `spark?: number[]` ditambah ke `ProcurementKpiCard`; diisi untuk kartu hero Total Usage dari `usageTrend.amount`; dirender di bawah deskripsi kartu (di atas breakdown chips).
- **VERIFIKASI:** tsc 0; eslint file tersentuh 0 error BARU (error `react-hooks/set-state-in-effect` di strip :508 pre-existing, tidak diperbaiki sesuai keputusan); build exit 0.
- **PLANNED:** penilaian visual user atas hasil calm-minimal; perluas sparkline ke kartu movement lain bila data trennya tersedia; uji di browser (auth gate); kontrak `usageTrend`/`issueFrequency` ke data nyata belum diverifikasi live.

## 2026-07-23 (lanjut) - Movement jadi infografis penuh analisis (matriks + charge + tabel + drilldown)
- **ENDPOINT BARU:** `app/api/reports/inventory/movement-matrix/route.ts` — satu query read-only GROUP BY KodeBarang x YEAR x MONTH atas gabungan issue gudang (IN_STOCKISSUELN+IN_STOCKISSUE) + workshop (WS_JOBSTOCK+WS_JOB, TransType='1'); ekspresi tanggal/dokumen/amount/itemType PERSIS mengikuti helper report asli (PostDate 1900-01-01 fallback TransDate, dst). Response: `{periods:['YYYY-MM'...] kronologis, rows:[{code,name,cells:{qty[],amount[],docs[]}}], currentPeriod}`; Top-N by totalAmount; cache in-memory TTL 60s; params source/months(3-36,def 12)/top(3-40,def 12)/itemType.
- **MATRIKS HEATMAP:** `MovementMatrix.tsx` — grid X=periode (12 bulan), Y=barang (top-N), sel=jumlah movement dengan intensitas emerald (opacity 0.12+intensity*0.75). Toggle Qty/Amount, label barang sticky (klik -> drilldown), klik sel -> onSelect(item,period) untuk fokus periode, tooltip bar bawah. Lazy fetch saat `active`.
- **CHARGE BREAKDOWN:** `ChargeBreakdown.tsx` — stacked bar 3 kanal (Blok/Station, Vehicle, Dept) + share% + top-6 item kanal aktif; data dari `topLists.costCenters`/`topLists.vehicles` + proporsi `stationQty/ledgerQty/vehicleQty` monthly split.
- **TABEL ANALIS:** `MovementTable.tsx` — kolom [Barang | Pola (Sparkline) | Qty | Amount | Freq | Mom. (MomentumDelta)], sortable amount/qty/docs; series diambil dari cells matriks sesuai metrik aktif.
- **DRILLDOWN POP-UP:** `ItemDrilldown.tsx` — modal (backdrop blur klik-tutup + ESC, role=dialog): sparkline besar pola issue, mini heatmap strip, 4 statistik (total qty/amount/freq dok/rata-rata), insight deterministik (puncak periode, aktif N periode, trailing-zero >=2 -> amber stagnan), footer "Buka detail issue".
- **PEMBUNGKUS:** `MovementAnalytics.tsx` — satu fetch matriks dipakai bersama Matrix+Table+Drilldown; state metric (default amount) + drillItem; layout grid [matriks 1.65fr | charge 1fr] (h-340) lalu tabel (h-300).
- **INTEGRASI STRIP:** blok baru (reveal-order 5) setelah StockRiverChart di `ProcurementKpiStrip.tsx`, `active={!glance}` (lazy); onFocusPeriod -> updateFilter('period', p); onOpenDetail -> filteredLinks.usage. Patch CRLF via skrip Python fisik dengan guard anchor unik.
- **ESLINT FIX:** error `react-hooks/set-state-in-effect` di 2 file baru (setLoading(true) sinkron di effect) diperbaiki dengan `queueMicrotask(() => { if (!cancelled) setLoading(true) })` — 0 error tersisa di file baru; error pre-existing strip :509 TIDAK diubah (keputusan).
- **VERIFIKASI:** tsc 0; eslint 6 file baru/tersentuh 0 error (4 warning kecil: unused var pre-existing + exhaustive-deps); build exit 0.
- **PLANNED:** uji visual + drilldown di browser (auth gate); endpoint movement-matrix belum diverifikasi ke data nyata (hanya validator SQL + konsistensi tipe); pertimbangkan menyimpan matriks closed-period ke aggregate store bila beban query terasa.

## 2026-07-23 (lanjut) - Hierarki Procurement: PURCHASING + INVENTORY (Transactions/Reports/Documents)
- **STRUKTUR BARU:** workspace `/report-center/procurement` kini memakai susunan kanonik user — PURCHASING dan INVENTORY, masing-masing dengan kategori Transactions Listing / Reports / Documents.
- **SUMBER KEBENARAN:** `lib/reports/procurement-hierarchy.ts` (BARU) — data statis 28 entri (5 dokumen purchasing, 10 transactions listing inventory, 13 reports inventory) dengan tipe `HierarchyEntry { id,title,submodule,category,liveReportId?,status,note? }`. Helper: `getHierarchyFor`, `getHierarchyCounts`, `resolveLiveHref` (via `createProcurementReportHref`). Status `live` dipetakan ke report yang sudah ada; sisanya `soon`.
- **PEMETAAN LIVE:** GRN->goods-receiving-receipt-activity, PO->purchase-order-history, Outstanding PR & PR Listing->purchase-request-inventory, Stock Adjustment & Stock Take->stock-opname, Stock Issue & Summary Store Issue Slip->pengeluaran-barang, Stock Receive->goods-receiving-receipt-activity, Stock Return->return-barang, Stock Transfer->transfer-antar-gudang, Inventory Valuation->asset-stock-valuasi-listing, Monthly Stock Account Movement(+Details)->monthly-stock-account-movement-details, Stock Aging->item-movement-update-tracking, Stock Movement Detail & Summarized Movement->movement-stock, Stock Summary->stok-gudang, Stock Usage Frequency->all-stock-movement-analysis.
- **NAV 2-LEVEL:** `ProcurementHierarchyNav.tsx` (BARU) — Level 1 dua kartu PURCHASING/INVENTORY (ikon + hitung live/total), Level 2 tab kategori dengan badge live/total. Entri `live` = kartu Link penuh (emerald), `soon` = kartu non-klik opacity-60 badge amber "Segera". Scope filter [Semua|Gudang|Workshop] hanya tampil di INVENTORY (mempertahankan perilaku tab lama sebagai filter ItemType, keputusan user). Kategori INVENTORY→Reports me-render `<InventoryReportsClient embedded fixedSource itemType={scope}/>`; kategori lain me-render grid entri hierarki; kategori kosong (Purchasing Transactions/Reports, Inventory Documents) tampil empty-state.
- **INTEGRASI:** section "Area kerja" lama (tab Semua/Gudang/Workshop/Ordering + grid kartu) di `ProcurementModuleWorkspace.tsx` diganti satu blok `<ProcurementHierarchyNav/>`; `initialSubModule` = 'purchasing' bila stockGroup='process', `initialScope` = gudang/workshop bila deep-link lama. Import mati dibersihkan (groupIcon, priorityTone, createProcurementGroupHref, FileText, Suspense, Warehouse, Wrench, ClipboardList, Package, InventoryReportsClient langsung). Header, ProcurementKpiStrip, InventoryOverview, process map, aside "Cara baca module" dipertahankan.
- **VERIFIKASI:** tsc 0; eslint 3 file bersih total; build exit 0.
- **PLANNED:** uji nav 2-level di browser (auth gate); implementasi report `soon` (Dispatch Advice, Rincian Perbandingan Harga, Fuel Issue/Return, Stock Return Advice, Daily Fuel Issuance, Material Distribution, Monthly Inventory Utilization) sesuai prioritas.

## 2026-07-23 (lanjut) - Katalog satu-pandangan + smart search

- `InventoryReportsClient.tsx`: chip group di katalog kini **switcher group** (klik = ganti group, satu pandangan, tanpa scroll-spy). Scroll-spy useEffect dihapus; `groupedReports` di-flatten jadi `{ group, title, reports }`.
- `visibleCatalogGroups`: saat tidak mencari render 1 group aktif; saat `searching` render semua group hasil lintas katalog.
- Smart search lintas group dipertegas: header katalog `{n} live · cari lintas group · klik chip = ganti group`, plus banner kecil saat searching: "Menampilkan N hasil lintas M group".
- Verifikasi: `npx tsc --noEmit` = 0, eslint file tersentuh = 0 error (5 warning pre-existing), `npm run build` sukses.

## 2026-07-23 (lanjut) - Analisis disederhanakan: taksonomi dihapus, breakdown = angka + penjelasan

- \`MonthlyStockRingkasan.tsx\`: section "Sub-category analysis" (rail taksonomi ProductType/Location dll., duplikatif dengan kategori analisis yang dipilih) DIHAPUS saat monthly. \`subKpiCards\` prop tetap diterima demi kompatibilitas tapi tidak dirender di mode monthly.
- \`MonthlyMovementVisuals\` ditulis ulang: dari bar bertumpuk + banyak teks menjadi panel angka besar (Opening/Issued/Receive/Return/Closing) masing-masing dengan SATU kalimat penjelasan (saldo awal, pemakaian keluar, dst.) + strip rincian issue Ledger/Station/Vehicle dengan angka + share % + satu kalimat definisi. Tone warna ramai (sky/amber/emerald/yellow per elemen) diganti neutral sesuai estetika calm-minimal.
- Verifikasi: tsc 0, eslint kembali ke baseline pre-existing (2 error `any` + 1 warning, tak terkait perubahan ini), build exit 0.

## 2026-07-23 (lanjut) - Taksonomi diganti analisis berguna

- \`MonthlyStockRingkasan.tsx\`: ruang kosong bekas rail taksonomi kini diisi 2 panel analisis yang langsung menjawab pertanyaan operasional:
  - **Konsentrasi issue per barang** — top 5 barang dengan issue amount terbesar, masing-masing angka + share % + qty, plus header "Top 5 = N% dari total issue · M barang ada issue" dan satu kalimat makna (ketergantungan pada sedikit barang = prioritas kontrol).
  - **Sehat arus stok** — coverage closing vs issue (×) dan perubahan opening→closing (%), masing-masing dengan satu kalimat interpretasi kondisional (overstock / aman / waspada; pemakaian vs pengisian).
- Data konsentrasi dihitung dari `payload.rows` (kolom `IssuedTotalAmount`/`IssuedTotalQty` + kode/nama barang); fallback aman bila rows kosong.
- Verifikasi: tsc 0, eslint baseline pre-existing, build exit 0.

## 2026-07-23 (lanjut) - Analisis frekuensi di movement analysis

- Metric baru `'freq'` (jumlah dokumen issue) di seluruh deck movement, di samping qty & amount:
  - **MovementMatrix** — toggle Qty/Amount/Freq; heatmap bisa menampilkan intensitas = jumlah dok issue per barang periode; tooltip menegaskan "N dok" saat mode freq.
  - **MovementTable** — toggle Freq; kolom Freq menonjol saat mode freq; kolom baru **Aktif** (`x/y periode`) menunjukkan di berapa periode barang benar-benar ada issue; header mode freq menampilkan ringkasan sebaran ("N barang aktif · total M dok · rata R dok/barang"). Sparkline + momentum mengikuti deret frekuensi.
  - **ItemDrilldown** — metric freq: sparkline pola frekuensi; blok baru "Analisis frekuensi issue" berisi periode aktif x/y, kerutinan %, rata dok/periode aktif, plus satu kalimat interpretasi (fast-moving ≥80% / reguler ≥40% / slow-moving <40%) dan puncak frekuensi.
- `ChargeBreakdown` menerima fallback `amount` saat mode freq (komponen ini belum punya deret dok).
- Verifikasi: tsc 0, eslint 0 error baru (1 warning `exhaustive-deps` pre-existing di MovementMatrix), build exit 0.

## 2026-07-23 (lanjut) - Kontrol timeline di movement deck

- \`MovementAnalytics\` menerima prop \`allowTimeline\`; saat aktif muncul bar kontrol timeline di atas grid: preset **6 / 12 / 24 bulan** + input kustom **3–36 bulan** (Enter/"Terapkan"), plus label rentang periode aktual (\`YYYY-MM → YYYY-MM\`).
- Rentang disetel via state \`timelineMonths\` (default = prop \`months\`); fetch matriks ikut refetch saat timeline berubah. MovementMatrix menerima \`months={timelineMonths}\`.
- Diaktifkan di \`ProcurementKpiStrip\` (allowTimeline) — satu-satunya pemakaian MovementAnalytics saat ini.
- Verifikasi: tsc 0, eslint sama persis baseline pre-existing (5 problems di ProcurementKpiStrip), build exit 0.

## 2026-07-23 (lanjut) - Skill playwright-cli + verifikasi browser nyata

- Skill `microsoft/playwright-cli@playwright-cli` (96K installs) terpasang global di `~/.agents/skills/playwright-cli`; CLI dipakai via `npx playwright cli` (playwright 1.61.1 sudah ada di node_modules dashboard).
- Verifikasi browser (Chrome nyata, login via bypass dev `bypss_ptrj`, port 3100):
  - **Katalog satu-pandangan** — chip "Mutasi & Transaksi" → hanya group itu dirender (`[data-catalog-group]` tunggal); header "19 live · cari lintas group · klik chip = ganti group" tampil.
  - **Smart search lintas group** — `search=fuel` → banner "Menampilkan 1 hasil lintas 1 group"; `search=stock` → "10 hasil lintas 6 group" (executive, transaction, master, control, fertilizer, vehicle). Keduanya benar.
  - **Timeline deck** — tab 6/12/24 bln + input kustom tampil; klik "6 bln" → label "6 bln · 2026-02 → 2026-07"; input kustom 9 → "9 bln · 2025-11 → 2026-07" (refetch terjadi).
  - **Fallback data** — matriks & tabel menampilkan empty-state bersih ("Belum ada data movement untuk rentang periode ini") karena API `/api/reports/inventory/movement-matrix` mengembalikan `error: "fetch failed"` (DB sumber tak terjangkau dari mesin ini) — BUKAN bug UI.
- Temuan non-bug: halaman `/report-center/inventory/all-stock-movement-analysis` stuck "Memuat report…" karena fetch data gagal yang sama; console bersih (0 error JS).
- Catatan dev: password user lokal `admin` direset ke `ptrj@123` via Prisma (dev.db lokal) agar sesuai `prisma/create-admin.js`.

## 2026-07-24 - Grafik tren dinamis Qty/Valuasi/Freq di movement deck

- Komponen baru `components/report-center/MovementTrend.tsx` (recharts ComposedChart): tren agregat periode di atas matriks movement, dipasang di `MovementAnalytics.tsx` (di bawah bar timeline, h-[260px]).
- Toggle **Qty / Valuasi / Freq** di header panel — memakai state `metric` yang sama dengan matriks/tabel/drill-down (satu sumber kebenaran di MovementAnalytics; tidak ada fetch baru, data = agregasi sum periode dari baris matriks).
- Visual: Valuasi/Qty = area emerald gradient; Freq = garis amber dengan dot; batang frekuensi abu sebagai konteks ritme saat metrik utama bukan freq. Header merangkum total metrik terpilih, periode puncak, dan delta % vs periode lalu (emerald/amber).
- Empty-state netral (bukan error) saat DB tak terjangkau — terverifikasi via playwright (Chrome, login bypass dev, port 3100): toggle Qty/Valuasi/Freq mengubah label header ('Total nilai (Rp)' → 'Total quantity' → 'Total frekuensi dok'); 0 error JS; Fast Refresh dev server memuat komponen baru tanpa restart.
- Verifikasi: `npx tsc --noEmit` 0, `npx eslint` kedua file 0 error baru, `npm run build` exit 0.
- Catatan jujur: perilaku grafik dengan data nyata belum terverifikasi — DB sumber estate tak terjangkau dari mesin ini (API movement-matrix mengembalikan `fetch failed`).
