# 02 — KPI Command Deck (Tampilan Terkini)

**Komponen:** `Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx`  
**Parent:** `ProcurementModuleWorkspace.tsx` (controlled filters)  
**Status:** LIVE (production path) — terus berevolusi

---

## 1. Anatomi visual (atas → bawah)

```
┌─ Header ─────────────────────────────────────────────────┐
│ "Procurement command deck"                               │
│ Subtitle: valuasi · PR/PO/receive · movement             │
│ Chips: Periode aktif · YYYY-MM · MC window               │
│ Badge: Live / Live sebagian / Loading                    │
├─ Filter bar ─────────────────────────────────────────────┤
│ Periode usage/receive | Jendela aging movement           │
│ Analysis Group | Kode Filter | Item Scope | Lokasi | Reset│
│ Active chips mirror                                      │
├─ Body grid (lg: 2 kolom) ────────────────────────────────┤
│ LEFT: Master valuation (hero besar)                      │
│ RIGHT:                                                   │
│   1. Hero control tower (Net Flow, Total Usage)          │
│   2. Valuasi stock (Gudang, Workshop)                    │
│   3. Proses procurement (GR, PR out, PO out)             │
│   4. Movement KPI (event, qty, amount)                   │
├─ Footer strip (jika chart usage ada) ────────────────────┤
│ Top item usage periode (Top 5 cards) · link detail issue │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Filter pusat (satu scope)

| Control | Label UI (LIVE) | Nilai | Mempengaruhi |
|---------|-----------------|-------|--------------|
| `period` | **Periode usage/receive** | `YYYY-MM` (8 opsi mundur) | GR, PR, PO, usage, return, sebagian stock |
| `movementWindow` | **Jendela aging movement** | all / 1m / 3m / 6m / 12m | Movement analysis / aging |
| `groupBy` | Analysis Group | StockAnalysis, ProductType, Category, Brand, Model, Material | scope filter params |
| `scopeCode` | Kode Filter | free text | stockAnalysis / productType / … |
| `itemType` | Item Scope | `` \| gudang \| workshop | workshop card + params; stock master tetap 1+4 kecuali diset |
| `location` | Lokasi | free text | location param |

**UX rule LIVE:** label memisahkan **periode transaksi/usage** vs **jendela aging** — jangan digabung mental model user.

**Reset:** kembali ke default `createDefaultProcurementKpiFilters()` (period = bulan berjalan).

---

## 3. Parallel data fetches (LIVE)

`kpiRequests` (8):

| Key | Report ID | Dipakai untuk |
|-----|-----------|---------------|
| stock | `asset-stock-valuasi-listing` | valuasi master + gudang/workshop split |
| receive | `goods-receiving-receipt-activity` | GR value/qty/docs/supplier |
| po | `purchase-order-history` | PO outstanding / amounts |
| pr | `purchase-request-inventory` | PR outstanding / amounts |
| workshop | `asset-stock-valuasi-listing` + itemType workshop/gudang | fallback workshop value |
| movement | `all-stock-movement-analysis` | event/qty/amount issue movement |
| **usage** | **`pengeluaran-barang`** | Total Usage, events, items, **chart top items** |
| **return** | **`return-barang`** | Return amount untuk Net Flow |

Fetch: `GET /api/reports/inventory?report=…&source=…&page=1&pageSize=5&limit=5` + filter params.  
Header opsional: `x-sql-gateway-base` dari localStorage (default gateway LAN).

**Partial live:** jika salah satu gagal → badge *Live sebagian, fallback aktif*; kartu lain tetap render.

---

## 4. Kartu KPI — inventaris LIVE

### 4.1 Master valuation (headline kiri)

| ID | Label | Value | Breakdown / UI |
|----|-------|-------|----------------|
| stock | Total Valuasi Inventory | Rp (4 desimal style strip) | Bar share Gudang % · Workshop % · formula on face |

**Formula:** `SUM((QtyOnHand + QtyOnHold) × AverageCost)` ItemType 1+4.  
**Drill:** `links.stock` + filters.

### 4.2 Hero control tower (section 1)

| ID | Label | Value | Breakdown chips | Formula |
|----|-------|-------|-----------------|---------|
| net-flow | **Arus Bersih Periode** | Rp signed | Receive · Issue · Return | `Receive − Issue + Return` |
| total-usage | **Total Usage (Issue)** | Rp | Qty issue · Event line · Item dipakai | SUM issue; event = line |

Tone Net Flow: hijau jika ≥0, amber jika negatif. Icon TrendingUp/Down.

### 4.3 Valuasi stock (section 2)

| ID | Label | Notes |
|----|-------|-------|
| gudang-value | Valuasi Gudang | chips: item gudang, on hand, on hold |
| workshop | Valuasi Workshop | chips: item workshop, total qty, lokasi |

### 4.4 Proses procurement (section 3)

| ID | Label | Primary | Chips |
|----|-------|---------|-------|
| receive-value | Nilai Goods Receive | Rp | docs, qty, supplier aktif |
| pr-outstanding | PR Outstanding | qty outstanding | total PR, qty request, nilai PR |
| po-outstanding | PO Outstanding | qty outstanding | total PO, qty order, nilai PO |

### 4.5 Movement KPI (section 4)

| ID | Label | Primary | Chips |
|----|-------|---------|-------|
| movement-total | Total Issue Movement | # event | Regular · Workshop · Docs |
| movement-qty | Issue Qty | qty | Usage qty · Event line · Issue docs |
| movement-amount | Issue Amount | Rp | Usage amount · Qty · Docs |

### 4.6 Top item usage (footer strip) — LIVE jika `usage.chart` ada

- Judul: **Top item usage periode**
- Copy: Top 5 dari `pengeluaran-barang`; AccCode = cost center/dept
- Card: rank · kode · nama · Rp · Qty
- CTA: Buka detail issue → `links.usage`

---

## 5. Pola kartu (desain)

Setiap secondary card:
1. **Pill label** berwarna per-id (`cardTitleTone`) + dot  
2. **Value** besar tabular feel  
3. Icon rounded border (tone class)  
4. Description 1 baris  
5. **Breakdown chips** (max ~3)  
6. Footer: source report + ArrowRight  
7. Hover: lift `-translate-y-0.5`, border forest strong  
8. Seluruh card = `Link` drill-down

Master valuation: typography hero `text-5xl`, gradient emerald/gold, dual progress bars.

---

## 6. Formula & field resolution (implementasi)

```
inventoryValue = stock.total_amount | TotalAssetAmount | … | gudang+workshop
usageAmount    = usage.TotalAmount | TotalIssueAmount | fallback movementAmount
usageEvents    = usage.TotalBaris | TotalIssueEvents
usageDocuments = usage.TotalDokumen | TotalIssueDocuments
usageItems     = usage.TotalItem | TotalItemsUsed
usageQty       = usage.TotalQty | … | fallback movementQty
returnAmount   = return.TotalAmount | TotalReturnAmount
netFlowAmount  = receiveAmount - usageAmount + returnAmount
usageIntensity = usageAmount / inventoryValue   // dihitung di kode; belum tentu kartu sendiri
```

**Honesty:** Net Flow Phase-1 = ad-hoc 3 summary, **bukan** wajib RPTIN1000015 CTE.

---

## 7. Sinkron filter ke sibling

`ProcurementModuleWorkspace` menyimpan `moduleFilters` dan:
- Pass ke `ProcurementKpiStrip` (controlled)
- Pass `period` / `movementWindow` / `itemType` ke `InventoryOverview`
- `hideScopeControls` di overview agar filter tidak dobel

---

## 8. Status vs plan “WOW”

| Fitur plan | Status UI kini |
|------------|----------------|
| Hero valuasi + net + usage | **LIVE** |
| Risk pulse slow/dead/stale card | **Diganti** movement total/qty/amount section (risk count card lama tidak di hero list saat ini) |
| Top 5 item | **LIVE** (chart usage) |
| Top dept/vehicle toggle | **PLANNED** |
| Tabs Issue Analysis | **PLANNED** (masih section 1–4) |
| PO fill rate % card | **PLANNED** (data qty ada, % belum hero) |
| Freq/hari explicit card | **PARTIAL** (event line chip, ActiveDays belum menonjol) |
| Composite API | **PLANNED** |
| Quality alert card | **REMOVED/not in current sections** — cek gap |

---

## 9. Akses QA manual (setelah login)

1. Buka `http://127.0.0.1:3001/report-center/procurement?source=estate`  
2. Pastikan badge Live  
3. Ganti **Periode usage/receive** → Net Flow / Usage / GR berubah  
4. Ganti **Jendela aging** → Movement KPI berubah  
5. Scroll Top item usage  
6. Klik kartu → detail report dengan query filters  

---

**Next:** `03-UX-FLOWS.md`

## 10. 2026-07-23 Premium workbench sync

- **LIVE:** procurement command deck is committed as technical-luxury workbench (`84c608f`) with controlled filters and command-palette catalog follow-up (`5f0d318`).
- **LIVE:** detail pages now add answer-first state band above drilldown surfaces.
- **PLANNED:** composite API, PO fill-rate hero, and dept/vehicle toggle remain planned.

