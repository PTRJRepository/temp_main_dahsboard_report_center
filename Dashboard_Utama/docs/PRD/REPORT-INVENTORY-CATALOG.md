# Report Inventory Catalog — 27 Inventory Reports
**PT Rebinmas Jaya Report Center** | **Version 1.0**

---

## Complete Report Inventory

### GROUP A: STOCK OVERVIEW (4 Reports)

---

**INV-A1** | **Ringkasan Stok per Gudang** | *Stock Summary by Location*
| | |
|---|---|
| **Group** | Stock Overview |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Menampilkan total keseluruhan item yang terdaftar di sistem berdasarkan lokasi gudang. Includes qty, value, dan category breakdown per warehouse.

**Filters:**
| Filter | Type | Description |
|--------|------|-------------|
| LocCode | select | Lokasi/Gudang (default: PTRJ) |
| ProdCatCode | select | Kategori Produk |

**Kolom:** LocCode, TotalItems, TotalQty, TotalValue (Rp), BelowReorderCount, ZeroStockCount, DeadStockCount

**Tags:** `stok` `gudang` `lokasi` `persediaan` `warehouse` `inventory` `barang` `ringkasan`

**Semantic Queries:**
- "stok per gudang"
- "total item per lokasi"
- "ringkasan inventory"
- "barang di gudang mana aja"

**Mock Data:**
| LocCode | TotalItems | TotalQty | TotalValue |
|---------|-----------|----------|------------|
| PTRJ | 11,570 | 233,756 | Rp 133,928,568,376 |

---

**INV-A2** | **Ringkasan Stok per Kategori** | *Stock Summary by Category*
| | |
|---|---|
| **Group** | Stock Overview |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM + IN_PRODCAT |
| **Status** | LIVE |

**Deskripsi:** Mengelompokkan item berdasarkan kategori produk (Chemical, Electrical, Mechanical, Lubricant, General, dll) untuk analisis pengendalian persediaan.

**Filters:**
| Filter | Type | Description |
|--------|------|-------------|
| ProdCatCode | select | Kategori Produk (C/E/F/G/L/LLN/M/S/Z) |

**Kolom:** ProdCatCode, CategoryName, ItemCount, TotalQty, TotalValue, PctOfTotal

**Tags:** `stok` `kategori` `produk` `chemical` `electrical` `mechanical` `group` `jenis`

**Semantic Queries:**
- "stok per kategori"
- "barang chemical ada berapa"
- "mechanical spare totalnya"
- "inventory per type"

**Mock Data:**
| CatCode | Category | Items | TotalValue |
|--------|----------|-------|------------|
| LLN | Lainnya | 3,367 | Rp 38.75B |
| M | Mechanical | 1,980 | Rp 20.08B |
| G | General Hardware | 2,925 | Rp 17.47B |
| E | Electrical | 1,050 | Rp 5.95B |
| S | Sundry | 1,187 | Rp 1.12B |
| L | Lubricant | 94 | Rp 1.14B |
| C | Chemical | 58 | Rp 567M |

---

**INV-A3** | **Ringkasan Stok per Tipe Item** | *Stock by Item Type*
| | |
|---|---|
| **Group** | Stock Overview |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_ITEM + IN_PRODTYPE |
| **Status** | LIVE |

**Deskripsi:** Mengelompokkan item berdasarkan tipe item (1=Stock Item, 2=Non-Stock, dll) untuk analisis pengendalian persediaan.

**Kolom:** ItemType, TypeName, ItemCount, TotalQty, TotalValue

**Tags:** `stok` `tipe` `jenis` `type` `stock` `non-stock`

---

**INV-A4** | **Nilai Persediaan** | *Stock Valuation Summary*
| | |
|---|---|
| **Group** | Stock Overview |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_MTHENDITEM |
| **Status** | LIVE |

**Deskripsi:** Menampilkan total nilai persediaan saat ini berdasarkan AverageCost per periode. Incluye perbandingan dengan bulan sebelumnya (MoM).

**⚠️ Data Warning:** Data tersedia sampai September 2026.Bukan real-time.

**Kolom:** Period, ItemCount, TotalQty, TotalAmount, MoMChange, MoMChangePct

**Tags:** `nilai` `valuasi` `harga` `cost` `average` `rupiah` `financial` `amount`

**Semantic Queries:**
- "nilai persediaan berapa"
- "total inventory value"
- "stock valuation"
- "harga rata-rata item"

**Mock Data:**
| Period | Items | Qty | Amount | MoM |
|--------|-------|-----|--------|-----|
| 2026-09 | 11,407 | 303,432 | Rp 129.38B | -1.1% |
| 2026-08 | 11,262 | 357,747 | Rp 130.81B | +2.0% |

---

### GROUP B: STOCK TRANSACTIONS (4 Reports)

---

**INV-B1** | **Mutasi Barang** | *Stock Movement Report*
| | |
|---|---|
| **Group** | Transactions |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_STOCKISSUE + IN_STOCKISSUELN |
| **Status** | LIVE |

**Deskripsi:** Laporan mutasi barang masuk dan keluar dalam periode tertentu. Menampilkan semua transaksi stock issue dengan detail per item termasuk department dan block code.

**Filters:**
| Filter | Type | Description |
|--------|------|-------------|
| AccYear | select | Tahun |
| AccMonth | select | Bulan |
| PostDateFrom | date | Tanggal mulai |
| PostDateTo | date | Tanggal akhir |
| ItemCode | text | Kode Item |
| BlkCode | select | Blok/Department |
| AccCode | select | Account Code |

**Kolom:** DocNo, PostDate, ItemCode, Description, Qty, Cost, Amount, AccCode, BlkCode, VehCode

**Tags:** `mutasi` `movement` `masuk` `keluar` `issue` `transaksi` `pemakaian` `daily`

**Semantic Queries:**
- "mutasi barang bulan ini"
- "barang keluar kemarin"
- "stock movement harian"
- "transaksi inventory"

---

**INV-B2** | **Mutasi per Blok/Department** | *Movement by Block/Department*
| | |
|---|---|
| **Group** | Transactions |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_STOCKISSUELN |
| **Status** | LIVE |

**Deskripsi:** Mengelompokkan transaksi stock berdasarkan blok/department (Boiler, Water Treatment, Kernel Plant, dll). Berguna untuk alokasi biaya ke department.

**Kolom:** BlkCode, TransactionCount, TotalQty, TotalAmount, UniqueItems

**Tags:** `mutasi` `blok` `department` `cost center` `boiler` `wtp` `kernel` `allocation`

**Semantic Queries:**
- "pengeluaran per department"
- "boiler consumes apa aja"
- "cost allocation blok"
- "biaya per unit"

**Mock Data (Top 5):**
| BlkCode | Transactions | Qty | Amount |
|---------|-------------|------|--------|
| BLR25001 | 5,703 | 5,703 | Rp 490M |
| OFFICE | 2,827 | 2,827 | Rp 1.82B |
| BLR24001 | 2,110 | 2,110 | Rp 389M |
| WTP06001 | 1,661 | 1,661 | Rp 685M |
| WTP05001 | 1,617 | 1,617 | Rp 275M |

---

**INV-B3** | **Pengeluaran Barang** | *Stock Issue Report*
| | |
|---|---|
| **Group** | Transactions |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_STOCKISSUELN |
| **Status** | LIVE |

**Deskripsi:** Laporan pengeluaran barang ke produksi/operasional. Includes vehicle code untuk tracking penggunaan alat berat dan kendaraan.

**Kolom:** DocNo, PostDate, ItemCode, Description, Qty, Cost, Amount, VehCode, AccCode, Remark

**Tags:** `pengeluaran` `issue` `keluar` `pemakaian` `produksi` `operasional` `vehicle`

---

**INV-B4** | **Transaksi Harian** | *Daily Transaction Log*
| | |
|---|---|
| **Group** | Transactions |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_STOCKISSUE + IN_MTHENDTRX |
| **Status** | LIVE |

**Deskripsi:** Log semua transaksi inventory per hari dengan aggregasi per jam. Berguna untuk audit trail dan tracking aktivitas harian.

**Kolom:** TransactionDate, HourOfDay, DocCount, TotalAmount, UniqueItems

**Tags:** `harian` `daily` `log` `audit` `trail` `aktivitas` `per jam`

---

### GROUP C: STOCK VALUATION (4 Reports)

---

**INV-C1** | **Valuasi Bulanan** | *Monthly Stock Valuation*
| | |
|---|---|
| **Group** | Valuation |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_MTHENDITEM |
| **Status** | LIVE |

**Deskripsi:** Valuasi stok bulanan per item dengan AverageCost dan TotalAmount. Digunakan untuk reporting keuangan bulanan.

**⚠️ Data Warning:** Latest period 2026-09 — bukan real-time.

**Kolom:** ItemCode, Description, Qty, AverageCost, Amount, Period

**Tags:** `valuasi` `bulanan` `bulan` `monthly` `financial` `amount` `cost` `periode`

---

**INV-C2** | **Valuasi per Kategori** | *Stock Valuation by Category*
| | |
|---|---|
| **Group** | Valuation |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_MTHENDITEM + IN_ITEM + IN_PRODCAT |
| **Status** | LIVE |

**Deskripsi:** Roll-up valuasi stok berdasarkan kategori produk. Shows value distribution across categories untuk analisis keuangan.

**Kolom:** ProdCatCode, CategoryName, ItemCount, TotalQty, TotalAmount, PctOfTotal

---

**INV-C3** | **Perbandingan Bulan ke Bulan** | *Month-over-Month Comparison*
| | |
|---|---|
| **Group** | Valuation |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_MTHENDITEM |
| **Status** | LIVE |

**Deskripsi:** Membandingkan nilai dan kuantitas stok bulan ini vs bulan lalu. Shows trend indicators dengan arrows (naik/turun/flat).

**Kolom:** ItemCode, CurrQty, CurrAmount, PrevQty, PrevAmount, ChangeQty, ChangePct, Trend

**Tags:** `comparison` `bandingkan` `bulan` `month` `mom` `trend` `naik` `turun` `vs` `periode`

**Semantic Queries:**
- "stok bulan ini vs lalu"
- "perbandingan inventory bulan lalu"
- "trend persediaan"
- "naik turun nilai stok"

---

**INV-C4** | **Analisis ABC** | *ABC Analysis*
| | |
|---|---|
| **Group** | Valuation |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Klasifikasi item berdasarkan nilai (Pareto 80/20). Class A: top items = 80% value. Priority untuk kontrol ketat.

**Kolom:** ItemCode, Description, TotalValue, PctOfTotal, CumulativePct, ABCClass

**Tags:** `abc` `pareto` `priority` `nilai` `klasifikasi` `80/20` `important` `kontrol`

**Semantic Queries:**
- "analisis abc"
- "item paling mahal"
- "prioritas inventory"
- "pareto analysis"

**Mock Data (Top 5 Class A):**
| Class | ItemCode | Description | Value | Cumulative% |
|-------|----------|-------------|-------|-------------|
| A | DC7715 | Generating Set 5625KVA | Rp 27.9B | 43.3% |
| A | DC05543 | Upgrading Boiler No.1&2 | Rp 9.0B | 57.2% |
| A | MM13016 | Turbine Rotor | Rp 4.7B | 64.5% |
| A | DC7617 | High Performance Generator | Rp 3.1B | 69.3% |
| A | DC7772 | Supply Install Testing | Rp 3.1B | 74.1% |
| A | ME14035 | 11/20KV Transformer | Rp 3.1B | 78.9% |

---

### GROUP D: DEAD STOCK (4 Reports)

---

**INV-D1** | **Dead Stock lebih dari 6 Bulan** | *Dead Stock >6 Months*
| | |
|---|---|
| **Group** | Dead Stock |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Item yang tidak ada movement selama lebih dari 6 bulan. Includes never-issued items (LastIssueDate = NULL or '1900-01-01').

**⚠️ Critical Finding:** 78% of total inventory value is DEAD stock (Rp ~105B stuck!)

**Kolom:** ItemCode, Description, QtyOnHand, AverageCost, TotalValue, LastIssueDate, MonthsSinceIssue, ProdCatCode

**Tags:** `dead stock` `idle` `tidak gerak` `lama` `obsolete` `asset` `modal` `6 bulan`

**Semantic Queries:**
- "dead stock"
- "barang yang lama ga dipake"
- "item tidak aktif"
- "asset mati"

**Mock Data:**
| Metric | Value |
|--------|-------|
| Total Dead Items | 11,194 |
| Dead Stock Value | Rp ~105B |
| % of Total Value | 78% |
| Never Issued | 8,024 |
| Dead >6mo | 3,324 |

---

**INV-D2** | **Dead Stock lebih dari 12 Bulan** | *Dead Stock >12 Months*
| | |
|---|---|
| **Group** | Dead Stock |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Item yang tidak ada movement selama lebih dari 12 bulan. Lebih критис untuk write-off decisions.

**Kolom:** ItemCode, Description, QtyOnHand, AverageCost, TotalValue, LastIssueDate, AgeMonths

**Tags:** `dead stock` `12 bulan` `setahun` `lama` `obsolete` `write off` `hapus`

**Semantic Queries:**
- "dead stock 1 tahun"
- "barang tidak bergerak 12 bulan"
- "write off candidate"
- "hapus barang lama"

---

**INV-D3** | **Stok Zero / Habis** | *Zero Stock / Out of Stock*
| | |
|---|---|
| **Group** | Dead Stock |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Item dengan QtyOnHand = 0. These items need immediate reorder attention untuk preventing stock-out.

**Kolom:** ItemCode, Description, LastIssueDate, LastOrderDate, QtyOnOrder, ReOrderLevel, AverageCost

**Tags:** `zero` `habis` `kosong` `out of stock` `stok habis` `empty` `need reorder`

**Semantic Queries:**
- "stok habis"
- "barang kosong"
- "out of stock"
- "yang perlu dipesan"

**Mock Data:**
| Metric | Value |
|--------|-------|
| Zero Stock Items | 4,962 |
| % of Total Items | 42.9% |

---

**INV-D4** | **Slow Moving Items** | *Slow Moving Items*
| | |
|---|---|
| **Group** | Dead Stock |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_ITEM + IN_STOCKISSUELN |
| **Status** | LIVE |

**Deskripsi:** Item dengan movement rendah (1-6 transaksi per 12 bulan) tapi bukan zero stock. Middle category between fast-moving dan dead stock.

**Kolom:** ItemCode, Description, TransCount, LastIssueDate, QtyOnHand, TotalValue, RiskLevel

**Tags:** `slow moving` `gerak lambat` `kurang aktif` `low movement` `risiko` `perlahan`

---

### GROUP E: REORDER & PLANNING (3 Reports)

---

**INV-E1** | **Below Reorder Level** | *Below Reorder Level*
| | |
|---|---|
| **Group** | Reorder |
| **Priority** | 🔴 CRITICAL |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Item yang QtyOnHand sudah di bawah ReOrderLevel. Trigger point untuk procurement — prevents stock-out.

**Kolom:** ItemCode, Description, QtyOnHand, ReOrderLevel, Shortage, UOMCode, LatestCost

**Tags:** `reorder` `minimum` `below` `below minimum` `trigger` `procurement` `purchase` `urgent`

**Semantic Queries:**
- "below reorder"
- "yang perlu reorder"
- "stok di bawah minimum"
- "urgent purchase"

**Mock Data:**
| Metric | Value |
|--------|-------|
| Below Reorder Level | 211 items |
| % of Total | 1.8% |

---

**INV-E2** | **Rekomendasi Reorder** | *Reorder Recommendation*
| | |
|---|---|
| **Group** | Reorder |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_ITEM + IN_STOCKISSUELN |
| **Status** | LIVE |

**Deskripsi:** Auto-calculate reorder quantity berdasarkan average usage dan lead time. Shows projected stock-out date dan recommended order qty.

**Kolom:** ItemCode, QtyOnHand, AvgMonthlyUsage, MonthsOfStock, RecommendedQty, EstimatedCost, ReorderStatus

**Tags:** `reorder` `recommendation` `rekomendasi` `order` `beli` `procurement` `quantity`

---

**INV-E3** | **Items Belum Pernah Dipesan** | *Never Ordered Items*
| | |
|---|---|
| **Group** | Reorder |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** Item dengan LastOrderDate = NULL. Never purchased — check if still needed atau bisa di-remove dari catalog.

**Kolom:** ItemCode, Description, CreateDate, QtyOnHand, AverageCost, TotalValue, Age

**Tags:** `never ordered` `belum pernah` `tidak pernah` `unused` `catalog` `cleanup`

---

### GROUP F: FUEL / BBM (3 Reports)

---

**INV-F1** | **Penggunaan BBM per Kendaraan** | *Fuel Consumption by Vehicle*
| | |
|---|---|
| **Group** | Fuel |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_FUELISSUE + IN_FUELISSUELN + GL_VEHICLE |
| **Status** | LIVE |

**Deskripsi:** Total konsumsi BBM per kendaraan dalam periode tertentu. Includes vehicle type dan cost per liter.

**Kolom:** VehCode, VehicleName, VehicleType, TotalLiters, TotalAmount, AvgCostPerLiter, LastTransDate

**Tags:** `bbm` `bahan bakar` `fuel` `kendaraan` `vehicle` `diesel` `solar` `liter` `konsumsi`

**Semantic Queries:**
- "bbm per kendaraan"
- "fuel consumption vehicle"
- "kendaraan paling boros"
- "diesel usage alat berat"

**Mock Data (Top 5):**
| VehCode | VehicleName | Type | TotalLiters | Amount |
|---------|-------------|------|-------------|--------|
| GA9010 | Vehicle Running (pool) | Pool | 939,532L | Rp 11.65B |
| - | Other/Untracked | - | 32,542L | Rp 464M |

---

**INV-F2** | **Penggunaan BBM per Department** | *Fuel Consumption by Department*
| | |
|---|---|
| **Group** | Fuel |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_FUELISSUELN |
| **Status** | LIVE |

**Deskripsi:** Total konsumsi BBM per department/account code. Shows fuel allocation across operational units.

**Kolom:** AccCode, AccDescription, TotalLiters, TotalAmount, TransactionCount

**Tags:** `bbm` `department` `cost center` `allocation` `fuel` `account` `boiler` `wtp`

---

**INV-F3** | **Return BBM** | *Fuel Return Report*
| | |
|---|---|
| **Group** | Fuel |
| **Priority** | ⚪ LOW |
| **SQL Source** | IN_FUELRTN + IN_FUELRTNLN |
| **Status** | LIVE |

**Deskripsi:** Laporan pengembalian BBM (fuel yang tidak terpakai dan dikembalikan ke gudang).

**Kolom:** DocNo, PostDate, ItemCode, VehCode, Qty, Amount, Remark

**Tags:** `return` `retur` `bbm` `fuel` `kembali` `loss` `waste`

---

### GROUP G: PURCHASE REQUISITION (2 Reports)

---

**INV-G1** | **Outstanding Purchase Requisition** | *Outstanding PR*
| | |
|---|---|
| **Group** | Purchase Requisition |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_PRLN + IN_PR + IN_ITEM |
| **Status** | LIVE |

**Deskripsi:** PR lines yang belum diterima sepenuhnya (QtyOutstanding > 0). Shows which items are pending delivery dari supplier.

**Kolom:** PRID, ItemCode, Description, QtyReq, QtyRcv, QtyOutstanding, Status, PRDate

**Tags:** `pr` `purchase requisition` `outstanding` `pending` `belum` `terpenuhi` `delivery` `supplier`

**Semantic Queries:**
- "pr yang belum datang"
- "outstanding purchase"
- "pending delivery"
- "barang belum diterima"

**Mock Data:**
| Metric | Value |
|--------|-------|
| Outstanding Lines | 6,118 |
| Fulfilled Lines | 23,047 |
| Total Outstanding Qty | 718,474 units |

---

**INV-G2** | **Purchase Requisition per Status** | *PR by Status*
| | |
|---|---|
| **Group** | Purchase Requisition |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_PR + IN_PRLN |
| **Status** | LIVE |

**Deskripsi:** Ringkasan PR berdasarkan status code. Shows procurement pipeline health: New, Pending, Partial, Approved, Rejected.

**Kolom:** Status, StatusDescription, PRCount, OutstandingLines, TotalAmount

**Tags:** `pr` `status` `pipeline` `pending` `approved` `rejected` `complete` `progress`

---

### GROUP H: ADJUSTMENT & OTHERS (3 Reports)

---

**INV-H1** | **Penyesuaian Stok** | *Stock Adjustment Report*
| | |
|---|---|
| **Group** | Adjustment |
| **Priority** | ⭐ HIGH |
| **SQL Source** | IN_STOCKADJ + IN_STOCKADJLN |
| **Status** | LIVE |

**Deskripsi:** Laporan penyesuaian stok (selisih hasil stock opname vs sistem). Includes adjustment type dan reason.

**Kolom:** DocNo, PostDate, ItemCode, OldQty, NewQty, DiffQty, DiffAmount, Remark

**Tags:** `adjustment` `penyesuaian` `selisih` `opname` `difference` `stock take` `audit`

**Mock Data:**
| Metric | Value |
|--------|-------|
| Total Adjustments | 34 |
| Total Adjustment Amount | Rp -4.94M |
| Reason Examples | "Recondisi", "Selisih Cut Off April May Juni" |

---

**INV-H2** | **Retur Stok** | *Stock Return Report*
| | |
|---|---|
| **Group** | Adjustment |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_STOCKRTN + IN_STOCKRTNLN |
| **Status** | LIVE |

**Deskripsi:** Laporan retur barang (barang yang dikembalikan ke gudang dari department/proyek).

**Kolom:** DocNo, PostDate, ItemCode, Description, Qty, Amount, Remark

**Tags:** `return` `retur` `barang kembali` `supplier` `rma` `exchange`

---

**INV-H3** | **Rekap Transaksi Bulanan** | *Monthly Transaction Summary*
| | |
|---|---|
| **Group** | Adjustment |
| **Priority** | ⚪ MEDIUM |
| **SQL Source** | IN_STOCKISSUE + IN_STOCKADJ + IN_STOCKRTN |
| **Status** | LIVE |

**Deskripsi:** Summary semua transaksi inventory per bulan dalam satu view. Shows inventory activity overview.

**Kolom:** Month, IssueCount, IssueAmount, AdjCount, AdjAmount, ReturnCount, ReturnAmount, NetMovement

**Tags:** `rekap` `summary` `bulanan` `monthly` `overview` `activity` `total`

---

## Semantic Search Tag Mapping

### Natural Language Query → Report

| User Query (Bahasa Indonesia) | Matching Reports |
|------------------------------|-----------------|
| "barang yang lama ga dipake" | INV-D1, INV-D2 |
| "stok yang udah habis" | INV-D3 |
| "nilai persediaan sekarang" | INV-A4, INV-C1 |
| "pengeluaran bbm per kendaraan" | INV-F1 |
| "dead stock 1 tahun" | INV-D2 |
| "apa aja yang perlu reorder" | INV-E1, INV-E2 |
| "movement barang bulan ini" | INV-B1 |
| "harga rata-rata item" | INV-A4, INV-C1 |
| "item paling mahal" | INV-C4 |
| "analisis abc" | INV-C4 |
| "kendaraan paling boros bbm" | INV-F1 |
| "pr yang belum datang" | INV-G1 |
| "dead stock 6 bulan" | INV-D1 |
| "perbandingan bulan ini vs lalu" | INV-C3 |
| "slow moving" | INV-D4 |
| "penyesuaian stok" | INV-H1 |
| "retur barang" | INV-H2 |
| "summary transaksi bulanan" | INV-H3 |
| "stok per kategori" | INV-A2 |
| "stok di bawah minimum" | INV-E1 |
| "valuasi bulanan" | INV-C1 |
| "below reorder" | INV-E1 |
| "zero stock" | INV-D3 |
| "top 10 item mahal" | INV-C4 |
| "biaya boiler" | INV-B2, INV-F2 |

---

## Priority Matrix

| Priority | Count | Reports |
|----------|-------|---------|
| 🔴 CRITICAL | 1 | INV-E1 |
| ⭐ HIGH | 14 | INV-A1, A2, A4, B1, B2, B3, C1, C3, C4, D1, D2, D3, F1, F2, G1 |
| ⚪ MEDIUM | 9 | INV-A3, B4, C2, D4, E2, E3, F3, G2, H2, H3 |
| ⚪ LOW | 2 | INV-F3, H1 |

---

## Mock Data Catalog (Sample per Report)

### INV-D1 Dead Stock Mock
```
ItemCode       Description                    Qty     AvgCost    TotalValue
MO03001        OIL ( CLEANING ) MO030        0       9,994      0
MO04036        u/cor lantai rabat composting 0       70,391     0
MO13026        Sand Filter Media             0       45,000     0
MO20001        CLEANING CHEMICAL             0       27,000     0
MO21001        COAGULANT                     0       21,500     0
```

### INV-E1 Below Reorder Mock
```
ItemCode  Description             QtyOnHand  ReOrderLevel  Shortage
BRG-001   Pupuk NPK 16-16-16      100        200           100
BRG-002   Herbisida 480 SL        50         100           50
BRG-003   Solar Industri          500        1,000         500
```

### INV-F1 Fuel Mock
```
VehCode   VehicleName       Type        TotalLiters  TotalAmount
BE001     Bulldozer #1      Bulldozer   12,500       Rp 187,500,000
BE002     Excavator #2      Excavator   15,200       Rp 228,000,000
DT001     Dump Truck #1     Dump Truck  18,000       Rp 270,000,000
VN005     Jeep 4WD #1       4WD         8,500        Rp 127,500,000
FR001     Forklift #1       Forklift    4,200        Rp 63,000,000
```
