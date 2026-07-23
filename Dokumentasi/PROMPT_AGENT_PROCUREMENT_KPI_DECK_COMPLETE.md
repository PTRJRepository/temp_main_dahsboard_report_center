# PROMPT MASTER — Procurement KPI Command Deck (sampai selesai & sempurna)

**Cara pakai:** salin seluruh isi di antara  
`===== BEGIN PROMPT =====` dan `===== END PROMPT =====`  
ke Claude Code / Codex / Cursor / Hermes agent.  
Prompt ini **self-contained**. Agent tidak perlu chat history.

**Dokumen pendukung (baca, jangan mengarang ulang):**
- `Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md`
- `Dokumentasi/KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md`
- `Dokumentasi/INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md`
- `Dokumentasi/procurement_documentation.md` (skema; **jangan salin API key** jika ada)
- `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` (jika ada)
- Skill/report-center iron laws bila tersedia

---

===== BEGIN PROMPT =====

# ROLE
Anda adalah **Principal Frontend + Data Engineer** untuk PT Rebinmas Jaya.  
Tugas: **implementasi penuh redesign Procurement KPI Command Deck** di Report Center sampai **production-ready, terverifikasi, CEO-grade**.

Bukan planning-only. **Kerjakan sampai selesai** mengikuti fase di bawah.  
Bahasa UI: **Indonesia**. Tone visual: forest **navy `#071426` + green `#167A3A`**, Windows-tile/matang — bukan rainbow SaaS.

# PRODUCT GOAL (5 DETIK)
Di `/report-center/procurement` user (CEO / gudang / finance) langsung jawab:
1. Seberapa besar **stock** sekarang?
2. Seberapa kuat **barang masuk** (GR / PO fill)?
3. Seberapa agresif **pemakaian/issue** (total + frekuensi)?
4. **Barang / dept / unit mana** paling boros?
5. Di mana **risiko** (slow-dead-stale + outstanding + data quality)?

# NON-GOALS
- Jangan rewrite monolit `ReportViewerClient.tsx` kecuali bug blocker drill-down.
- Jangan CUD ke database. SQL **SELECT only**.
- Jangan tampilkan 20+ kartu hero sekaligus.
- Jangan label `IN_STOCKISSUELN.AccCode` sebagai “GL Account” — itu **dept/cost center**.
- Jangan samakan **periode usage** dengan **movement window aging**.
- Jangan commit secret / API key ke repo.
- Jangan re-break report detail monthly IA (RPTIN1000015) yang sudah di-redesign.

# CODEBASE ENTRY (WAJIB BACA DULU)
| Path | Peran |
|------|--------|
| `Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx` | **Deck utama** (edit inti) |
| `Dashboard_Utama/components/report-center/ProcurementModuleWorkspace.tsx` | owner filter + links |
| `Dashboard_Utama/components/report-center/InventoryOverview.tsx` | sibling overview — sync filter |
| `Dashboard_Utama/lib/reports/procurement-workspace.ts` | href/report groups |
| `Dashboard_Utama/lib/reports/inventory/config.ts` | registry live reports |
| `Dashboard_Utama/app/api/reports/inventory/route.ts` | summary API |
| Domain issue/movement terkait di `lib/reports/inventory/*` | SQL builders |
| `Dashboard_Utama/utils/format.ts` | format currency/qty/period — **reuse** |

**Baseline deck sekarang (jangan hapus tanpa pengganti):**
- Filter: period, movementWindow, groupBy, scopeCode, itemType, location
- Fetch summary 6 report: asset-stock-valuasi-listing, goods-receiving-receipt-activity, purchase-order-history, purchase-request-inventory, workshop valuasi, all-stock-movement-analysis
- Cards: valuasi×3, GR, PR out, PO out, risk slow/dead/stale, quality alert
- **Gap:** issue/usage bukan hero; no frekuensi; no top item; no return; no net flow; no PO fill rate hero

# LOCKED PRODUCT DECISIONS (default — jangan tanya user lagi kecuali blocker)
1. **IssueEvents** = COUNT **line** issue (bukan header). Chip sekunder: **IssueDocuments** (header).
2. **NetFlowAmount** Phase 1 = `ReceiveAmount − IssueAmount + ReturnAmount` dari summary report (bukan wajib monthly CTE dulu).
3. **Period** = calendar `YYYY-MM` UI (tetap 8–18 bulan opsi). Movement window hanya aging.
4. **Top default** = Top item by **amount**; toggle ke qty & frekuensi; tab kedua dept (AccCode).
5. **Fuel** = rail opsional Phase 2+, bukan hero Phase 1.
6. **Stock KPI master** tetap ItemType **1+4** kecuali user pilih gudang/workshop filter.
7. Hero max **5** angka utama (boleh 4). Secondary di rails/tabs.
8. Partial fetch failure: kartu lain tetap hidup (sudah ada pattern).
9. Bahasa label ID-first.
10. Drill-down **wajib** bawa query filter (`hrefWithFilters` pattern existing).

# METRIC CONTRACT (implement + dokumentasikan di metric-dictionary bila file ada)

```
TotalIssueAmount   = SUM(issue line amount)  // gudang IN_STOCKISSUE(LN) + workshop WS_JOBSTOCK issue
TotalIssueQty      = SUM(issue qty)
IssueEvents        = COUNT(issue lines)
IssueDocuments     = COUNT(DISTINCT issue headers)
ActiveIssueDays    = COUNT(DISTINCT issue date in period)
FreqPerDay         = IssueEvents / NULLIF(ActiveIssueDays, 0)
ItemsUsed          = COUNT(DISTINCT ItemCode with issue)
ReturnAmount       = SUM(return amount in period)
ReturnRate         = ReturnAmount / NULLIF(TotalIssueAmount, 0)
NetFlowAmount      = ReceiveAmount - TotalIssueAmount + ReturnAmount
UsageIntensity     = TotalIssueAmount / NULLIF(StockValue, 0)
POFillRate         = QtyReceive / NULLIF(QtyOrder, 0)
RiskCount          = SlowMovingItem + DeadMovementItem + StaleItem
```

**Iron laws SQL:**
- `RTRIM()` pada Status, AccCode, LocCode, ItemCode, dll
- AccCode issue = dept → label “Pusat biaya / Dept”
- VehCode dari LINE
- Estate GR cost via `PU_POLN` / report receive yang sudah benar
- `1900-01-01` bukan tanggal valid
- Source `estate` | `pabrik` hormati prop `source`

Top arrays (max 5):
```ts
TopItems: { code, name, amount, qty, events }[]
TopCostCenters: { code, name, amount, events }[]
TopVehicles?: { code, name, amount }[]
```

# INFORMATION ARCHITECTURE (TARGET UI)

```
┌─ FILTER BAR ─────────────────────────────────────────────┐
│ Periode usage · Jendela aging movement · Item scope      │
│ Lokasi · Analysis group · Kode · Reset                   │
│ Helper text: “Periode = GR/PR/PO/Issue · Aging = fast/dead”│
└──────────────────────────────────────────────────────────┘
┌─ HERO (4–5) ─────────────────────────────────────────────┐
│ [Valuasi Stock] [Net Flow] [Total Issue +freq chips]     │
│ [Risk Pulse]   [opsional: PO Fill % atau Quality]        │
└──────────────────────────────────────────────────────────┘
┌─ RAILS (tabs) ───────────────────────────────────────────┐
│ Valuasi | Masuk/Procure | Issue Analysis | Return/Net    │
│ Aging/Quality | (opsional Fuel)                          │
└──────────────────────────────────────────────────────────┘
```

**Rail Issue Analysis (wajib sempurna):**
- KPI strip: Total issue Rp, Qty, Events, Freq/hari, Items used, Usage intensity, split gudang/ws
- Panel Top 5: toggle **Nilai | Qty | Frekuensi**
- Sub-toggle dimensi: **Item | Dept | Vehicle** (Vehicle P1 jika data ada)
- Setiap bar klik → `pengeluaran-barang` + filters

**Rail Masuk:**
- GR value/qty/docs/suppliers (existing)
- PR outstanding, PO outstanding
- **PO fill rate %** (derived)
- optional top supplier (Phase 2)

**Rail Valuasi:** keep gudang/workshop split + on hand/hold chips; improve hierarchy not clutter

**Rail Return/Net:** return amount, return rate, net flow explanation

**Rail Aging/Quality:** distribution Fast/Moving/Slow/Dead/Stale + quality composite

# IMPLEMENTATION PHASES — KERJAKAN BERURUTAN SAMPAI SELESAI

Anda **tidak berhenti di Phase 1** kecuali ada blocker data keras.  
Target akhir sesi: **Phase 1 + Phase 2 minimal**, Phase 3 jika waktu/latency memungkinkan.

## PHASE 0 — Discovery & contracts (wajib, singkat, evidence-based)
1. Baca file entry di atas + plan/katalog di `Dokumentasi/`.
2. Cek response summary aktual:
   - `GET /api/reports/inventory?report=pengeluaran-barang&source=estate&period=YYYY-MM&page=1&pageSize=5`
   - sama untuk `return-barang`, `goods-receiving-receipt-activity`, `purchase-order-history`, `all-stock-movement-analysis`
3. Catat field summary yang **sudah ada** vs **harus ditambah** di builder API.
4. Tulis singkat di `Dokumentasi/PROCUREMENT_KPI_DECK_IMPLEMENTATION_LOG.md`:
   - field map, keputusan event=line, gaps
5. Jangan invent field yang API tidak kirim — **enrich API** dulu.

**Exit P0:** peta field lengkap + list patch file.

## PHASE 1 — Data + Hero usage (ship foundation)
### 1A. API / domain
- Pastikan report `pengeluaran-barang` (dan idealnya `return-barang`) mengembalikan summary minimal:
  - TotalIssueAmount / TotalIssueQty / TotalIssueEvents (lines) / TotalIssueDocuments / ActiveIssueDays / TotalItemsUsed
  - bila mungkin: GudangIssueAmount, WorkshopIssueAmount
- Return summary: TotalReturnAmount, TotalReturnQty (atau alias konsisten)
- PO summary: pastikan QtyOrder, QtyReceive untuk fill rate
- **Jangan** break existing consumers; additive fields only.
- Pure helpers + unit test `*.test.ts` untuk formula NetFlow, FreqPerDay, ReturnRate, POFillRate, RiskCount (Node assert style proyek).

### 1B. Frontend `ProcurementKpiStrip`
- Extend `kpiRequests` dengan:
  - `issue` → `pengeluaran-barang`
  - `return` → `return-barang` (jika live; else graceful empty)
- Hero cards:
  1. Total Valuasi (keep, master 1+4)
  2. **Net Flow** (signed; warna beda +/−)
  3. **Total Issue** nilai + chips: events, freq/hari, items used
  4. Risk Pulse (slow+dead+stale) 
  5. optional row: PO Fill % **atau** Quality (jangan dobel padat)
- Filter labels diperjelas:
  - “Periode (usage & proses)”
  - “Jendela aging movement”
- Keep controlled filters dari parent workspace.
- Loading skeleton + partial badge tetap.

### 1C. Workspace links
- Di `ProcurementModuleWorkspace`, tambah link issue/return ke report yang benar dengan filter period/itemType/location.

**Exit P1:**  
Browser `/report-center/procurement?source=estate` menampilkan hero issue + net flow; ganti period → angka berubah; drill issue terbuka.

## PHASE 2 — Issue Analysis rail (sempurna untuk “top barang”)
### 2A. API enrichment
Tambah di summary issue (max 5 each):
- `TopItems[]` by amount (include qty, events)
- optional server support sort=qty|events **atau** kirim 3 list kecil
- `TopCostCenters[]` (AccCode + name lookup jika ada)
- `TopVehicles[]` jika VehCode tersedia

SQL: period filter benar; RTRIM; top 5 only; jangan kirim full dump.

### 2B. UI rail
- Tabs: `Valuasi | Masuk | Issue Analysis | Return | Risiko`
- Issue Analysis:
  - metric chips I01–I09
  - Top list UI (bar rows) + toggle Nilai/Qty/Frekuensi
  - dimensi Item/Dept/Vehicle
  - empty state elegan
- Valuasi/Process rails: pindahkan kartu existing ke tab (jangan hilangkan kemampuan)
- Aging: mini distribution (5 angka) bukan cuma risk count

### 2C. Docs
- Update `metric-dictionary` atau section di implementation log.
- Update `KATALOG` status LIVE untuk KPI yang sudah jalan (opsional).

**Exit P2:** Top 5 item terlihat, toggle jalan, dept list bila data ada, screenshot-ready.

## PHASE 3 — Composite + polish “sempurna”
Lakukan jika P1+P2 hijau:
1. **Opsional** endpoint `app/api/reports/procurement/command-deck/route.ts`  
   - 1 request mengembalikan `{ stock, receive, po, pr, issue, return, movement, meta }`  
   - fallback: parallel client fetch tetap jika endpoint belum stabil
2. Period options: naikkan ke **18 bulan** (bukan hanya 8) jika trivial
3. MoM delta chips pada hero Issue & Valuasi (prev period fetch atau dual summary) — skip jika latency jahat
4. Fuel mini-card di tab Workshop/Fuel jika report `fuel-usage` summary gampang
5. A11y: tablist keyboard, focus ring forest, contrast
6. Mobile: hero 2×2, tabs scroll-x, top list full width
7. Extract komponen bila `ProcurementKpiStrip.tsx` > ~900 lines:
   - `ProcurementKpiHero.tsx`
   - `ProcurementIssueAnalysisRail.tsx`
   - `procurement-kpi-math.ts` (pure)
   - Jangan big-bang rename export public tanpa update import

**Exit P3:** latency OK, struktur file rapi, UI polish CEO.

## PHASE 4 — Verification & handoff (WAJIB sebelum bilang SELESAI)
### Automated
```bash
cd "D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama"
npx tsc --noEmit
# jalankan test baru yang Anda buat, contoh:
npx tsx lib/reports/procurement-kpi-math.test.ts
# bila ada test strip/workspace:
npx tsx lib/reports/procurement-workspace.test.ts
```

### Manual / browser
1. `/report-center/procurement?source=estate`
2. `/report-center/procurement?source=pabrik`
3. Ganti period → hero issue & GR berubah
4. Ganti movement window → risk/aging berubah; usage period tidak “aneh”
5. Item scope gudang vs workshop
6. Klik hero issue → report detail filters benar
7. Klik top item → filter item/period terbawa bila feasible
8. Partial: matikan satu report di network → deck tidak blank total
9. Tidak ada API key di UI/source

### Spot-check data
- Total issue deck ≈ summary `pengeluaran-barang` periode sama (toleransi rounding)
- Net flow = GR − issue + return (hitung manual dari 3 summary)
- AccCode label dept

### Handoff artifacts
Tulis/update:
- `Dokumentasi/PROCUREMENT_KPI_DECK_IMPLEMENTATION_LOG.md` (apa berubah, field map, sisa gap)
- Opsional commit message usulan (jangan commit kecuali user minta):
  `feat(procurement): command deck issue usage + top analysis rails`

# FILE TOUCH RULES
- **Primary:** `ProcurementKpiStrip.tsx` (+ extract files)
- **Secondary:** API inventory route / issue domain summary only as needed
- **Workspace:** filter links only
- **Tests:** pure math + summary shape jika feasible
- **Docs:** implementation log
- Hindari edit massal catalog 2.5k / viewer 6k

# UI QUALITY BAR (SEMPURNA)
- Forest tokens / existing `--rc-*` classes; jangan fork tema baru
- Hero typography kuat; secondary chips tenang
- Formula/source di secondary line atau hover — tidak menyesakkan face KPI
- `format` currency: ikuti konvensi proyek (`format.ts` / existing strip). Jangan campur 0 vs 4 decimal tanpa alasan; **konsisten dengan kartu valuasi existing** di file yang sama
- Tidak ada layout shift parah saat loading
- Tab active state jelas (accent green)
- Empty: “Tidak ada issue pada periode ini” bukan error merah palsu
- Error partial: badge “Live sebagian”

# ACCEPTANCE CHECKLIST (semua harus ✅)
- [ ] Hero menampilkan valuasi + net flow + total issue + risk
- [ ] Issue menampilkan frekuensi (events + freq/hari + items used)
- [ ] Top barang (min by amount) di rail Issue Analysis
- [ ] Return amount + return rate (atau explicit empty)
- [ ] PO fill rate tersedia di rail Masuk
- [ ] Filter period vs movement window label jelas
- [ ] Drill-down bawa filter
- [ ] Estate & pabrik tidak crash
- [ ] `tsc --noEmit` clean untuk perubahan Anda
- [ ] Test formula pure pass
- [ ] Tidak ada secret di diff
- [ ] Implementation log terisi
- [ ] Tidak merusak InventoryOverview filter sync

# WORKING STYLE
1. Baca → ukur API → patch data → UI → test → browser → log
2. Commit atomic hanya jika user minta commit
3. Jika API summary tidak bisa di-enrich dalam environment ini, **document blocker** + UI pakai best-effort fields + jangan fake numbers
4. Jangan klaim “sempurna” tanpa checklist di atas
5. Prefer small pure modules untuk math
6. Windows paths: `D:/Gawean Rebinmas/Main Dashboard/...`

# RETURN FORMAT (akhir ke user)
```
OK/FAIL
Phases done: P0 / P1 / P2 / P3 / P4
Files changed: (list)
API fields added: (list)
Hero KPIs: (list)
Issue top: yes/no
Verify: tsc= / tests= / browser=
Known gaps: (honest)
Log: Dokumentasi/PROCUREMENT_KPI_DECK_IMPLEMENTATION_LOG.md
```

# ORDER OF EXECUTION (COPY THIS AS YOUR TODO)
1. P0 discovery summaries  
2. Pure math helpers + tests  
3. API summary enrichment issue/return/top  
4. Wire fetches in ProcurementKpiStrip  
5. Hero redesign  
6. Tabs + Issue Analysis + Top list  
7. Return/Net + PO fill + aging distribution  
8. Workspace links  
9. Extract files if oversized  
10. tsc + tests + browser both sources  
11. Implementation log  
12. Final OK/FAIL report  

Kerjakan sekarang sampai checklist hijau. Jangan berhenti di “rencana”.

===== END PROMPT =====

---

## Versi super-pendek (token ketat)

```
Implement FULL Procurement KPI Command Deck di Dashboard_Utama sampai production-ready.
Primary: components/report-center/ProcurementKpiStrip.tsx + API inventory summary enrichment.
Baca: Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md + KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md.
Locked: IssueEvents=COUNT lines; NetFlow=Receive−Issue+Return; Top default item by amount; AccCode=dept not GL; period≠movementWindow; hero≤5; forest UI; READ-ONLY SQL.
P0: map existing summary fields. P1: fetch pengeluaran-barang+return; hero valuasi/net/issue/risk; clear filter labels. P2: TopItems/TopCostCenters in summary + Issue Analysis tab (toggle amount/qty/freq). P3: optional command-deck composite + polish/a11y/extract. P4: tsc, formula tests, browser estate+pabrik, implementation log.
Reuse format.ts + hrefWithFilters. Jangan edit ReportViewerClient monolit. Jangan secrets. Jangan fake KPI.
Return OK/FAIL + files + verify.
```

---

## Prompt Phase-only (jika agent lemah / sesi pendek)

### Phase 1 only
```
Implement Phase 1 only of Dokumentasi/PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md:
enrich/use pengeluaran-barang (+return) summaries; hero Net Flow + Total Issue + freq chips; keep existing valuasi/process/risk; clarify period vs movement labels; tests for NetFlow/Freq/ReturnRate/POFillRate; tsc clean. No top-list yet unless free.
```

### Phase 2 only (butuh Phase 1 sudah merge)
```
Continue Phase 2 of PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md:
API TopItems(5)+TopCostCenters; Issue Analysis rail with toggles; tabs layout; browser QA; update implementation log.
```

---

**Lokasi file prompt ini:**  
`D:\Gawean Rebinmas\Main Dashboard\Dokumentasi\PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md`
