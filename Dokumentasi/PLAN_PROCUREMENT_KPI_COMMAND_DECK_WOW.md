# PLAN — Procurement KPI Master Deck “WOW”

**Status:** Plan + partial LIVE (usage/net-flow/top items sudah di kode; tabs penuh masih NEXT)  
**Tanggal:** 2026-07-22 (update status)  
**Target UI:** Command deck atas di `/report-center/procurement`  
**Kode sekarang:** `Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx`  
**Workspace:** `ProcurementModuleWorkspace.tsx` + `lib/reports/procurement-workspace.ts`  
**UI docs terkini:** `Dokumentasi/UI-REPORT-CENTER-CURRENT/` (mulai `00-INDEX.md`)

---

## 1. Apa yang sudah ada (baseline)

Command deck **sudah live** dengan:

### Filter pusat (satu scope untuk semua KPI)
| Filter | Opsi sekarang | Catatan |
|--------|----------------|---------|
| Periode | 8 bulan terakhir (`YYYY-MM`) | Calendar month UI |
| Movement window | all / 1m / 3m / 6m / 12m | Utama untuk movement category |
| Analysis group | StockAnalysis, ProductType, Category, Brand, Model, Material, MovementCategory | + scope code |
| Item type | all / gudang / workshop | Stock master = 1+4 kecuali workshop card |
| Location | free text | |

### KPI cards sekarang (3 grup)
**A. Valuasi (3)**  
1. Total Valuasi Inventory (full ItemType 1+4)  
2. Valuasi Gudang  
3. Valuasi Workshop  

**B. Process (3)**  
4. Nilai Goods Receive  
5. PR Outstanding (qty)  
6. PO Outstanding (qty)  

**C. Risk / quality (2)**  
7. Slow / Dead / Stale (count item)  
8. Quality Alert (zero qty/cost + missing PO cost + PR amount 0)  

### Sumber API (6 parallel fetch summary)
| Key | Report |
|-----|--------|
| stock | `asset-stock-valuasi-listing` |
| receive | `goods-receiving-receipt-activity` |
| po | `purchase-order-history` |
| pr | `purchase-request-inventory` |
| workshop | `asset-stock-valuasi-listing` + itemType workshop |
| movement | `all-stock-movement-analysis` |

### Yang masih “kurang wow” (gap jujur)
- **Issue / usage hampir tidak jadi hero** — amount issue hanya “chip” di Quality Alert, bukan deck sendiri.
- Tidak ada **Total Usage** (qty + nilai) untuk periode terpilih.
- Tidak ada **frekuensi usage** (berapa event issue / berapa hari aktif / berapa item aktif).
- Tidak ada **Issue Analysis** (top cost center / vehicle / block / item / department AccCode).
- Tidak ada **net flow** (Receive − Issue ± Return) di master.
- Tidak ada **trend mini** (sparkline / MoM Δ%) — terasa statis.
- Tidak ada **fuel usage** di master deck (ada report `fuel-usage` di catalog, belum di KPI strip).
- Periode 8 bulan agak sempit; tidak ada custom range / YTD / last 30d.
- Movement window vs period bisa membingungkan (dua “waktu” berbeda).
- Layout: 8 kartu flat — CEO sulit “cerita 5 detik”.

---

## 2. Visi “WOW” (product)

**Procurement Command Deck = control tower 5 detik:**

1. **Seberapa besar stock kita sekarang?** (stock value)  
2. **Seberapa kuat aliran masuk?** (receive / PO fill)  
3. **Seberapa agresif pemakaian?** (issue usage total + frekuensi)  
4. **Siapa / apa yang makan cost?** (issue analysis top drivers)  
5. **Di mana risiko?** (slow/dead + outstanding + data quality)

Semua dengan **satu filter periode + scope**, drill-down ke report detail yang sudah live.

Tone: forest navy/green, CEO-grade, **bukan** rainbow SaaS wall. Max **primary hero strip 4–6**, secondary collapsible.

---

## 3. Arsitektur KPI baru (4 baris)

```
┌─────────────────────────────────────────────────────────────┐
│  FILTER BAR (enriched)                                      │
│  Source · Period mode · Period · Location · ItemType        │
│  Usage window · Analysis dim · Scope · Reset                │
└─────────────────────────────────────────────────────────────┘
┌─ HERO (4) ──────────────────────────────────────────────────┐
│ Stock Value │ Net Period Flow │ Total Usage │ Risk Pulse    │
└─────────────────────────────────────────────────────────────┘
┌─ STORY RAILS (tabs / segments) ─────────────────────────────┐
│ [Valuasi] [Masuk/Procure] [Issue Analysis] [Movement Risk]  │
└─────────────────────────────────────────────────────────────┘
┌─ INSIGHT STRIP (opsional) ──────────────────────────────────┐
│ Top 3 driver issue · MoM spark · Quality badges             │
└─────────────────────────────────────────────────────────────┘
```

**Jangan** tempel 20 kartu sekaligus. Progressive disclosure.

---

## 4. Katalog KPI yang diusulkan

### 4.1 HERO (wajib — selalu terlihat)

| ID | Label ID | Definisi bisnis | Primary value | Secondary chips | Drill report |
|----|----------|-----------------|---------------|-----------------|--------------|
| H1 | Total Valuasi Inventory | Nilai stock full (IT1+IT4) | Rp | Gudang % · Workshop % · #item | asset-stock-valuasi-listing |
| H2 | Arus Bersih Periode | Receive − Issue + Return (nilai) | Rp (signed) | Receive · Issue · Return | monthly + receive + pengeluaran |
| H3 | **Total Usage (Issue)** | Pemakaian barang periode | Rp + optional Qty | #event · #item aktif · gudang/ws split | pengeluaran-barang / movement |
| H4 | Risk Pulse | Composite risk 0–100 atau count | score/count | Slow/Dead/Stale · Outstanding · Quality | movement + PR/PO |

**Net flow formula (nilai):**  
`Net = GoodsReceiveAmount − IssuedTotalAmount + ReturnAmount`  
(periode terpilih; hormati placeholder_zero di monthly bila dipakai)

### 4.2 RAIL A — Valuasi (sudah ada, polish)

| ID | Label | Notes |
|----|-------|-------|
| V1 | Valuasi Gudang | keep |
| V2 | Valuasi Workshop | keep |
| V3 | Qty On Hand / On Hold | promote dari chip jadi mini-metric |
| V4 | Concentration | Top 10 item % of value (wow untuk CEO) — **butuh summary field baru** |

### 4.3 RAIL B — Procurement process (sudah ada + enrich)

| ID | Label | Notes |
|----|-------|-------|
| P1 | Nilai GR | keep |
| P2 | PR Outstanding | keep; tampilkan juga nilai outstanding jika ada |
| P3 | PO Outstanding | keep; **fill rate** = QtyReceive/QtyOrder % |
| P4 | Supplier aktif (periode) | dari receive summary |
| P5 | Lead-time proxy (fase 2) | butuh PODate vs GoodsRcvRefDate — **query baru** |

### 4.4 RAIL C — Issue Analysis (BARU — prioritas user)

| ID | Label ID | Definisi | Grain | Sumber data usulan |
|----|----------|----------|-------|--------------------|
| I1 | Total Usage Nilai | SUM issue amount periode | period | `pengeluaran-barang` / `IN_STOCKISSUELN` (+ WS_JOBSTOCK TransType issue) |
| I2 | Total Usage Qty | SUM issue qty | period | same |
| I3 | Frekuensi Usage (Event) | COUNT distinct issue header/line events | period | StockIssueID / Job lines |
| I4 | Frekuensi per Hari | Events / active days in period | period | derived |
| I5 | Item Aktif Dipakai | COUNT distinct ItemCode issued | period | line |
| I6 | Usage Intensity | Issue amount / Stock value * 100 | period | issue ÷ stock |
| I7 | Top Item by Usage | Top 5 item by amount | period | group by ItemCode |
| I8 | Top Cost Center / Dept | Top 5 **AccCode (dept)** — **bukan GL** | period | IN_STOCKISSUELN.AccCode + lookup desc |
| I9 | Top Vehicle | Top 5 VehCode (line) | period | line VehCode + GL_VEHICLE |
| I10 | Top Block/Station | Top 5 BlkCode | period | line |
| I11 | Gudang vs Workshop Usage | Split amount IT1 vs IT4 / WS | period | itemType split |
| I12 | Regular vs Workshop Issue Event | counts already partial di movement summary | period | movement summary fields |
| I13 | Return vs Issue ratio | Return / Issue % | period | return + issue |
| I14 | Fuel Usage (opsional tab) | liter + amount | period | `fuel-usage` report |

### 4.5 RAIL D — Movement risk (sudah ada, clarify)

| ID | Label | Notes |
|----|-------|-------|
| M1 | Fast / Moving / Slow / Dead / Stale | stacked mini-bar, not only risk count |
| M2 | Issue amount window | already partially in movement summary |
| M3 | Quality Alert | keep, tapi pisah dari issue story |

---

## 5. Filter “periode & frekuensi” (product rules)

### 5.1 Period modes (upgrade filter bar)

| Mode | Meaning | Default |
|------|---------|---------|
| `month` | Satu bulan kalender UI → map accounting bila report butuh | **default** |
| `ytd` | Jan–bulan berjalan | optional |
| `last_n_days` | 30 / 90 | optional fase 2 |
| `custom` | from–to | fase 2 |

**Tetap** movement window terpisah hanya untuk **klasifikasi Fast/Slow/Dead** (bukan untuk Total Usage).  
**Copy UI:**  
- “Periode usage/receive/PR/PO” = period  
- “Jendela aging movement” = movementWindow  

Jangan pakai satu label “waktu” untuk keduanya.

### 5.2 Frekuensi usage — definisi formal

```
Events          = COUNT issue transactions (header or line — pilih 1, dokumentasikan)
ActiveDays      = COUNT DISTINCT issue dates in period
ItemsUsed       = COUNT DISTINCT ItemCode with issue qty > 0
FreqPerDay      = Events / NULLIF(ActiveDays, 0)
FreqPerItem     = Events / NULLIF(ItemsUsed, 0)
UsageIntensity  = IssueAmount / NULLIF(StockValue, 0)
```

**Keputusan desain (harus dikunci sebelum code):**
- Event = **header** (`IN_STOCKISSUE`) atau **line**?  
  Rekomendasi: **line events** untuk frekuensi operasional; tampilkan juga #dokumen header sebagai chip.
- Workshop: include `WS_JOBSTOCK` TransType issue (1) + optional return (2) terpisah.
- AccCode = **dept** — label UI “Cost center / Dept”, never “GL Account”.

---

## 6. Data & API plan

### 6.1 Fase data (urut)

| Fase | Apa | Endpoint strategy | Effort |
|------|-----|-------------------|--------|
| **D0** | Manfaatkan summary yang sudah ada | stock/receive/po/pr/movement | 0 |
| **D1** | Tambah fetch summary `pengeluaran-barang` (+ optional `return-barang`, `fuel-usage`) | extend `kpiRequests` | S |
| **D2** | Enrich summary fields di report issue (top-N arrays, freq metrics) | `app/api/reports/inventory` summary builder | M |
| **D3** | Endpoint khusus `procurement-command-deck` 1 round-trip | new route aggregating 4 rails | M–L |
| **D4** | Lead-time / fill-rate advanced SQL | CTE PR→PO→GR | L |

**Rekomendasi:** D1 → polish UI → D2 top drivers → D3 hanya jika latency 6+ fetch terasa lambat.

### 6.2 Field summary yang perlu ada (kontrak)

Untuk issue/usage summary (nama final menyusul di code):

```ts
type IssueUsageSummary = {
  // totals
  TotalIssueAmount: number
  TotalIssueQty: number
  TotalIssueEvents: number      // lines or headers — document
  TotalIssueDocuments: number
  TotalItemsUsed: number
  ActiveIssueDays: number
  FreqPerDay: number
  // split
  GudangIssueAmount: number
  WorkshopIssueAmount: number
  RegularIssueEvents: number
  WorkshopIssueEvents: number
  // returns
  TotalReturnAmount?: number
  // top drivers (max 5)
  TopItems: Array<{ code: string; name: string; amount: number; qty: number; events: number }>
  TopCostCenters: Array<{ code: string; name: string; amount: number }>
  TopVehicles: Array<{ code: string; name: string; amount: number }>
  TopBlocks: Array<{ code: string; name: string; amount: number }>
}
```

Stock/receive/PO/PR: reuse existing keys; add only if missing:
- PO fill rate %
- Receive amount already ada
- MoM deltas (fase 2): compare previous period

### 6.3 SQL iron laws (wajib di plan implementasi)

- `RTRIM` semua char compare  
- AccCode issue = dept, join description via block/dept lookup **bukan** GL_ACCOUNT asal  
- VehCode dari LINE  
- Estate GR cost dari `PU_POLN`  
- READ ONLY  
- Source estate vs pabrik hormati workspace `ReportSource`

### 6.4 Performance budget

| Metric | Target |
|--------|--------|
| Deck first paint with skeleton | < 200ms UI |
| All hero numbers ready | < 2.5s LAN gateway |
| Parallel fetches | ≤ 8; prefer 1 composite later |
| Top-N arrays | max 5 each; no full row dump di deck |
| pageSize for KPI fetch | keep small (5) if only summary used |

---

## 7. UX / visual “WOW” (tanpa gimmick kosong)

### 7.1 Hierarchy
1. **Hero 4** angka besar + spark/delta  
2. Segmented rails (bukan 3 grid sama berat)  
3. **Issue Analysis** rail:  
   - kiri: Total Usage + freq meters  
   - kanan: horizontal bar Top 5 (item / dept / vehicle) toggle  
4. Risk: mini distribution bar Fast→Stale  

### 7.2 Interactions
- Klik hero → report + query filters preserved (sudah ada pattern `hrefWithFilters`)  
- Toggle Top driver dimension: Item | Dept | Vehicle | Block  
- Hover formula + source (sudah ada di card model — expose di UI detail, not clutter face)  
- Skeleton shimmer + partial live badge (sudah ada)  
- Optional: “Bandingkan bulan lalu” chip MoM  

### 7.3 Anti-pattern (jangan)
- 20 kartu seukuran sama  
- KPI issue double di InventoryOverview + deck tanpa sync  
- Label PDF/full export di deck  
- Rainbow per-card tanpa sistem tone forest  
- Menampilkan AccCode sebagai “akun GL”

### 7.4 Copy ID (contoh)
- “Total pemakaian (issue)”  
- “Frekuensi pemakaian / hari”  
- “Pusat biaya (dept)”  
- “Arus bersih periode”  
- “Denyut risiko stok”

---

## 8. Mapping ke report live (drill-down)

| KPI group | Report id | Params penting |
|-----------|-----------|----------------|
| Valuasi | asset-stock-valuasi-listing | itemType, location, period? |
| GR | goods-receiving-receipt-activity | period, location |
| PR | purchase-request-inventory | period |
| PO | purchase-order-history | period |
| Movement risk | all-stock-movement-analysis | movementWindow, groupBy=MovementCategory |
| **Issue usage** | **pengeluaran-barang** | period, itemType, location |
| Return | return-barang | period |
| Monthly bridge | monthly-stock-account-movement-details | period (RPTIN1000015) |
| Fuel | fuel-usage | period |
| Vehicle | vehicle-running-workshop | period |

---

## 9. Roadmap implementasi (nanti)

### Phase 0 — Spec lock (0.5–1 hari)
- [ ] Kunci definisi Event (header vs line)  
- [ ] Kunci formula Net Flow & Usage Intensity  
- [ ] Kunci period modes v1 (month only + movement window)  
- [ ] Wireframe 1 layar (ASCII/HTML mock)  
- [ ] Metric dictionary entries baru  

### Phase 1 — Quick wow (1–2 hari) — **recommended first ship**
- [ ] Tambah `pengeluaran-barang` (+ optional return) ke `kpiRequests`  
- [ ] Hero strip: Stock · Net Flow (approx dari receive−issue) · Total Usage · Risk  
- [ ] Rail Issue: I1–I6 dari summary fields yang sudah bisa diekstrak  
- [ ] Clarify filter labels period vs movement window  
- [ ] Sync filter dengan InventoryOverview (sudah partial)  
- [ ] Screenshot QA CEO  

### Phase 2 — Issue Analysis depth (2–4 hari)
- [ ] Enrich API summary TopItems / TopCostCenters / TopVehicles / TopBlocks  
- [ ] UI toggle + bar list  
- [ ] FreqPerDay / ActiveDays di SQL  
- [ ] Fuel mini-card optional  
- [ ] Tests assert summary keys  

### Phase 3 — Composite + trend (3–5 hari)
- [ ] `GET /api/reports/procurement/command-deck` one payload  
- [ ] MoM delta + sparkline (12 points max)  
- [ ] PO fill rate + simple lead-time  
- [ ] Concentration top-10 stock value  

### Phase 4 — Polish
- [ ] A11y keyboard on rails  
- [ ] Empty/partial states premium  
- [ ] Perf: cache short TTL client for same filter key  
- [ ] Docs update + diagram deck  

**Rollback:** feature flag `procurementKpiDeckV2` atau revert `ProcurementKpiStrip` only.

---

## 10. File yang kemungkinan disentuh (saat implement)

| File | Peran |
|------|--------|
| `components/report-center/ProcurementKpiStrip.tsx` | UI deck utama |
| `components/report-center/ProcurementModuleWorkspace.tsx` | filter ownership |
| `app/api/reports/inventory/route.ts` (atau domain issue) | summary enrichment |
| `lib/reports/inventory/*` issue/movement helpers | SQL |
| `lib/reports/inventory/metric-dictionary.md` | kontrak metrik |
| optional new `components/report-center/ProcurementIssueAnalysisRail.tsx` | extract |
| optional `app/api/reports/procurement/command-deck/route.ts` | composite |

**Jangan** campur edit monolit `ReportViewerClient` untuk deck master.

---

## 11. Acceptance criteria (Definition of Done)

### Product
- [ ] User pilih periode → Total Usage + frekuensi + valuasi ikut berubah  
- [ ] Issue Analysis menampilkan minimal Total Usage, Events, Items used, Top 5 item  
- [ ] AccCode berlabel dept/cost center  
- [ ] Hero ≤ 6; secondary di rail  
- [ ] Drill-down bawa filter  

### Data
- [ ] Angka usage cocok spot-check vs report `pengeluaran-barang` periode sama  
- [ ] Estate vs pabrik source benar  
- [ ] RTRIM / empty GR traps tidak merusak  

### UX
- [ ] Loading skeleton tidak layout-shift parah  
- [ ] Partial failure: hero lain tetap hidup  
- [ ] Mobile: hero 2×2, rails scroll  

### Verify commands (saat coding)
```bash
cd Dashboard_Utama
npx tsc --noEmit
# targeted tests bila ada summary helpers
# browser: /report-center/procurement?source=estate
```

---

## 12. Open questions (perlu keputusan user)

1. **Event usage** dihitung per **dokumen** atau per **baris**? (rekomendasi: baris + chip dokumen)  
2. Net flow pakai **monthly RPTIN1000015** atau **receive report − issue report** ad-hoc? (rekomendasi Phase1 ad-hoc; Phase2 align monthly)  
3. Fuel masuk hero atau hanya sub-rail workshop?  
4. Apakah KPI master harus **identik** di Estate & Pabrik, atau field beda per source?  
5. Periode default: bulan berjalan atau **bulan akuntansi last closed**?  
6. Top driver default: Item atau Dept?

---

## 13. Ringkas arah (1 paragraf)

KPI master atas procurement **sudah kuat di valuasi + PR/PO/GR + aging risk**, tapi **belum jadi control tower pemakaian**. Langkah berikutnya: naikkan **Issue/Usage** jadi hero setara stock/receive, tambah **frekuensi & top drivers (item/dept/vehicle)**, perjelas **periode vs movement window**, batasi hero 4–6, rails progressive — data dulu dari report `pengeluaran-barang` + enrichment summary, baru composite API jika perlu.

---

## 14. Next step suggested

**Belum coding.** Review plan ini → jawab open questions §12 → setujui Phase 1 scope → baru implement.

Kalau setuju Phase 1 only, bilang: **“lanjut implement phase 1 KPI deck”**.
