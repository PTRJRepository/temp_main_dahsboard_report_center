# 📋 PRD: REPORT CENTER - INVENTORY MODULE
**Version:** 1.0  
**Date:** 2026-05-17  
**Project:** Dashboard Report Center - PT Rebinmas Jaya  
**Module:** INVENTORY (IN_*)  
**Database:** db_ptrj_mill (via SQL Gateway - READ ONLY)  
**Status:** ✅ COMPLETE v1.0 - Ready for Development

---

## 1. PROJECT OVERVIEW

### 1.1 Background
Dashboard utama PT Rebinmas Jaya membutuhkan sistem Report Center yang komprehensif untuk membaca/menampilkan laporan dari berbagai modul (Inventory, HR, FFB, Payroll, dll). Fokus Phase 1 adalah **Inventory Module** dengan 20+ laporan yang bisa dihasilkan dari data real yang tersedia.

### 1.2 Goal
Membangun dashboard Report Center profesional yang:
- Menampilkan 20 laporan Inventory dari data real (SELECT only)
- Dilengkapi semantic search (tag-based discovery)
- Responsive, modern enterprise UI
- Satu module per sub-page (bukan single-page-all)

### 1.3 Scope - Phase 1 (Inventory Only)
- ✅ 20 Reports (grouped dalam 7 categories)
- ✅ Semantic Search Engine
- ✅ Mock data dari SQL Gateway (real data)
- ✅ 1 Module = 1 Sub-page di navigation
- ❌ Payroll Module (Phase 2)
- ❌ HR/Attendance Module (Phase 2)
- ❌ FFB/CPO Module (Phase 2)

---

## 2. DATABASE SCHEMA (REAL DATA)

### 2.1 Server & Connectivity
```
SQL Gateway: http://localhost:8001/v1/query
Auth Header: x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6
Server: SERVER_PROFILE_1 (10.0.0.110:1433) - READ ONLY via gateway
Database: db_ptrj_mill
Rule: CUD DILARANG - hanya SELECT
```

### 2.2 Data Summary (REAL from SQL Gateway)

| Tabel | Rows | Description |
|-------|------|-------------|
| `IN_ITEM` | **11,571** | Master item - semua barang di PTRJ |
| `IN_STOCKISSUE` | **15,514** | Header pengeluaran barang |
| `IN_STOCKISSUELN` | **~30,000** | Line item pengeluaran |
| `IN_MTHENDITEM` | **626,553** | Monthly stock valuation |
| `IN_PRLN` | **29,592** | Purchase Requisition Line (5,752 outstanding) |
| `IN_FUELISSUE` | **7,067** | Header pengeluaran BBM/solar |
| `IN_FUELISSUELN` | **~8,000** | Line item BBM |
| `IN_PRODCAT` | 9 | Kategori: C/E/F/G/L/LLN/M/S/Z |
| `IN_PRODTYPE` | 52 | Tipe produk (BEAR, BENSIN, ELEC-MCB, dll) |
| `SH_UOM` | 63 | Unit of Measure |
| `IN_STOCKADJ` | 34 | Stock Adjustment header |
| `IN_STOCKRTN` | 31 | Stock Return header |

### 2.3 Key Metrics from Real Data

```
Total Stock Value (Latest Month: 2026-09):  Rp 129,376,161,787
Total Items in System:                        11,571 items
Dead Stock (>1 Year No Movement):            3,042 items
Never Issued Items:                          8,025 items
Zero Stock Items:                            4,963 items
Below Reorder Level:                           281 items
Outstanding PR Lines:                         5,752 lines
```

### 2.4 Lookup Tables (REAL - untuk AccCode, VehCode, BlkCode descriptions)

#### GL_ACCOUNT - Account Code Descriptions (277 accounts)
Key accounts untuk inventory reports:
```
OC7110: STATION FRUIT RECEPTION AND STORAGE
OC7120: STATION STERILIZER OPERATION
OC7130: STATION THRESHING STATION OPERATION
OC7140: STATION EFB HANDLING OPERATION
OC7150: STATION EFB PREBREAKER STATION
OC7160: STATION PRESS OPERATION
OC7170: STATION CLARIFICATION OPERATION
OC7180: STATION KERNEL OPERATION
OC7190: STATION BOILER OPERATION           ← highest usage: 9,026 rows, Rp 2.57B
OC7200: STATION ENGINE ROOM OPERATION
OC7210: STATION CPO STORAGE OPERATION
OC7220: EFFLUENT TREATMENT PLANT / TUNJANGAN TRANSPORT  ← 594 rows, Rp 764M
OC7230: STATION WATER PLANT OPERATION       ← 5,117 rows, Rp 1.44B
OC7240: STATION LABORATORY ANALYSIS
OC7250: STATION WORKSHOP MAINTENANCE
OC7260: STATION GENERAL WAREHOUSE
OC7311: DIRECT LABOUR - JAMSOSTEK
OC7312: CHECKROLL – TUNJANGAN HARI RAYA
OC7316: REFRESHMENT
OC7317: RETIREMENT GRATUITY / DANA PENSIUN
OC7318: SAFETY APPLIANCES & UNIFORMS
OC7319: UPKEEP OF WHELL LOADER
OC7320: UPKEEP OF FACTORY
OC7321: UPKEEP OF WEIGHBRIDGE

CA4810: MATERIAL COST                          ← 1,395 rows, Rp 3.36B
CA4812: PRODUCTION COST - PROCESS STATION     ← Rp 1.59M
CA4813: PRODUCTION COST - PACKING STATION     ← 1,330 rows, Rp 10.73B (highest value!)
CA4814: C/ROLL WAGES (Compos)
CA4821: UPKEEP OF MACHINERY                   ← 64 rows, Rp 26M
CA4822: UPKEEP OF FACTORY                     ← 97 rows, Rp 51M

GA9010: VEHICLE RUNNING                       ← 589 rows, Rp 92M
GA9050: WORKSHOP CONTROL ACCOUNT               ← 4,066 rows, Rp 386M
GA9110: PERSONNEL - SALARIES & WAGES
GA9120: MEDICAL
GA9215: ELECTRICITY & WATER                   ← Rp 485K
GA9218: GENERAL INSURANCE
GA9222: PRINTING & STATIONERY
GA9227: SECURITY CHARGES
GA9234: UPKEEP OF BUILDINGS                    ← 2,662 rows, Rp 1.57B
GA9236: UPKEEP OF OFFICE / EQUIPMENT          ← 243 rows, Rp 270M
GA9237: UPKEEP OF MOTOR VEHICLES              ← 4 rows, Rp 670K
GA9238: UPKEEP OF MACHINERY                   ← 54 rows, Rp 18.86M
GA9240: UPKEEP OF COMPUTER
GA9242: SAFETY & HEALTH EQUIPMENT

CL4310: INTERDIVISION                          ← 2 rows, Rp 2.7M
CW1260: CWIP - PLANT & MACHINERY              ← 3 rows, Rp 19.95M
CW1280: CWIP - ELECTRICITY SUPPLY             ← 21 rows, Rp 131M
```

#### GL_VEHICLE - Vehicle Code Descriptions (21 vehicles)
```
BE001: (XGMA1) Whell Loader           Type: BE (Bulldozer & Excavator)
BE002: (XGMA2) Whell Loader           Type: BE
BE003: (CASE512E) WHEEL LOADER CASE 512E   Type: BE
BE004: Backhoe Loader CASE             Type: BE
DT001: (BN8011WQ) TRUK CPO            Type: DT (Dump Truck)
DT002: (BN8004WQ) TRUCK CPO           Type: DT
FR001: (FORKLIFT) TOYOTA             Type: LN (Lain-Lain)
FR002: (FORKLIFT) KOMATSU 01         Type: LN
FR003: (FORKLIFT) KOMATSU 02         Type: LN
GN001: (ENG03001) Diesel Engine Generator Set No.1   Type: G (Genset)
GN002: (ENG04001) Diesel Engine Generator Set No.2   Type: G
GN003: (ENG05001) Diesel Engine Generator Set No.3   Type: G
LN001: (POWERMAX) COMPOSTING          Type: LN
LN002: (POWERMAX) COMPOSTING 2 2024  Type: LN
T001:  (TR001) Tractor               Type: T (Tractor)
T002:  (TR002) Tractor Putih RJT65   Type: T
VN005: (BN8780WP) PANTHER            Type: VN (4WD/Jeep)
VN007: TOYOTA FOTUNER BN 1328 RMJ    Type: VN
VN008: TOYOTA HILUX DC 2,4 4X4 G M/T DIESEL ATTITUDE BLACK  Type: VN
VN009: Ford Putih (BN8900WO)          Type: VN
VN010: Isuzu Panther (BN1693WP)       Type: VN
```

#### GL_VEHTYPE - Vehicle Type Reference
```
BE: BULLDOZER & EXCAVATOR
DT: Dump Truck
G:  GENSET
LN: LAIN-LAIN (Forklift, Loader, etc.)
MC: MOTORCYCLE
T:  Tractor
TT: Trailer
VN: 4 WHEEL DRIVE / JEEP
```

#### GL_BLOCK - Block/Station Code Descriptions
```
STN-BLR: STATION BOILER
STN-CLR: STATION CLARIFICATION
STN-COM: STATION COMPOSTING
STN-CPO: STATION CPO STORAGE
STN-DPR: STATION DEPERICARPING
STN-efb: STATION EMPTY FRUIT BUNCH
STN-ENG: STATION ENGINE ROOM
STN-ETP: STATION EFFLUENT TREATMENT PLANT
STN-FRC: STATION FRUIT RECEPTION
STN-GEN: STATION GENERAL
STN-KER: STATION KERNEL
STN-LAB: STATION LABORATORY
STN-LCP: LOGISTIC CPO
STN-LKR: LOGISTIC KERNEL
STN-MFS: STATION MOVING FLOOR SYSTEM
STN-OFF: STATION OFFICE
STN-PBS: STATION PREBREAKER (EFB)
STN-PRS: STATION PRESS
STN-STR: STATION STERILIZER
STN-THR: STATION THRESHING
STN-WEG: STATION WEIGHBRIDGE
STN-WKP: STATION WORKSHOP
STN-WTP: STATION WATER PLANT
```

#### IN_PRODCAT - Product Category (9 categories)
```
C:   CHEMICAL (Bahan Kimia)
E:   ELECTRICAL (Listrik)
F:   FUEL (BBM/Solar)
G:   GENERAL ENGINEERING HARDWARE
L:   LUBRICANT AND OIL (Pelumas)
LLN: LAINNYA (Others/Smisc)
M:   MECHANICAL SPARE (Suku Cadang)
S:   SUNDRY
Z:   FERTILIZER (Pupuk)
```

#### IN_PRODTYPE - Product Type (52 types, top examples)
```
BEAR:  Bearing
BENSIN: Bensin
ELEC:  Electrical-MCB
FUEL:  Fuel
HYDO:  Hydraulic Oil
LUB:   Lubricant
MECH:  Mechanical
PIPE:  Piping
SPPAR: Spare Part
TOOL:  Tool
```

#### SH_UOM - Unit of Measure (top)
```
BOX:  Box
KG:   Kilogram
LTR:  Liter
PCS:  Piece
SET:  Set
UNIT: Unit
```

### 2.5 Data Quality Notes (from real data analysis)

1. **LastIssueDate = '1900-01-01'**: Items never issued → treat as "Never Issued"
2. **LastIssueDate = NULL**: Also treat as "Never Issued" / Dead Stock candidate
3. **Future dates in IN_MTHENDITEM**: PeriodCode 2026-09 exists (beyond today May 2026) → show "Latest Available Period" dynamically, add disclaimer
4. **Status = '1 ' (with trailing space)**: Always use `RTRIM(Status) = '1'`
5. **GL_ACCOUNT.Description padding**: Always use `RTRIM()` on AccCode and Description
6. **Vehicle codes in fuel**: VN005 (564), VN007 (106), etc → join to GL_VEHICLE for names
7. **Top fuel consumers**: VN005 (564), VN007 (106), VN003 (244), VN006 (240) → selaluax plant vehicles

### 2.6 Open Questions (RESOLVED)
| # | Question | Resolution |
|---|----------|------------|
| 1 | AccCode lookup | Use GL_ACCOUNT (277 accounts), key inventory codes documented above |
| 2 | VehCode lookup | Use GL_VEHICLE (21 vehicles), VehTypeCode → GL_VEHTYPE |
| 3 | BlkCode lookup | Use GL_BLOCK (station codes), pattern STN-XXX |
| 4 | LastIssueDate NULL/'1900-01-01' | Treat as "Never Issued" |
| 5 | Future period data (2026-09) | Show dynamic "Latest Available Period" + disclaimer |
| 6 | TOP 50 pagination | Remove hardcoded limit, implement proper OFFSET/FETCH |
| 7 | IN_PR vs IN_PRLN for PR reports | Use IN_PRLN directly, IN_PR header join optional |
| 8 | Server: SP1 vs SP3 | SERVER_PROFILE_1 (10.0.0.110) = canonical DB |
| 9 | Duplicate page files | app/dashboard/report-center/ = dead code, use app/reports-center/ only |

---

## 3. REPORT INVENTORY (20 REPORTS)

### GROUP A: STOCK OVERVIEW (4 Reports)

#### A1. Stock Summary
```
ID:           INV-A1
Title:        Ringkasan Stok
Description:  Menampilkan daftar lengkap seluruh item yang terdaftar di sistem gudang PTRJ 
              berdasarkan lokasi gudang. Menampilkan jumlah item, total nilai, rata-rata 
              harga per item.
Tags:         ["stok", "item", "gudang", "total", "persediaan", "inventory", "barang", 
               "daftar", "list", "ringkasan", "overview", "semua item"]
Icon:         Package
SQL Source:   IN_ITEM
Filters:      LocCode (default: PTRJ), ItemType, ProdCatCode, Status (1=Active)
Columns:      ItemCode, Description, ItemType, ProdCatCode, QtyOnHand, AverageCost, 
              LatestCost, ReOrderLevel, UOMCode, Status
Mock Data:    11,571 items di PTRJ
```

#### A2. Stock by Category
```
ID:           INV-A2
Title:        Stok per Kategori
Description:  Mengelompokkan seluruh item berdasarkan kategori produk (Chemical, Electrical,
              Fuel, General, Lubricant, Mechanical, dll). Cocok untuk analisis spend per 
              kategori dan identifikasi item yang perlu di-review.
Tags:         ["kategori", "category", "chemical", "electrical", "fuel", "group", 
               "pengelompokan", "pengeluaran per kategori", "spend by category", 
               "lubricant", "mechanical", "sundries"]
Icon:         Grid3x3
SQL Source:   IN_ITEM + IN_PRODCAT
Filters:      LocCode, AccMonth, AccYear
Columns:      ProdCatCode, CategoryName, ItemCount, TotalQtyOnHand, TotalValue
Mock Data:    9 kategori, distribusikan 11,571 items
```

#### A3. Stock by Type
```
ID:           INV-A3
Title:        Stok per Tipe Produk
Description:  Melihat distribusi item berdasarkan tipe produk seperti BEAR (Bearings),
              BENSIN (Petrol), ELEC-MCB (MCB), GRS (Grease), dll. Berguna untuk
              maintenance planning dan procurement scheduling.
Tags:         ["tipe", "type", "produk", "bearing", "grease", "fuel", "chemical", 
               "electrical", "motor", "spare", "jenis barang", "classifier"]
Icon:         Layers
SQL Source:   IN_ITEM + IN_PRODTYPE
Filters:      LocCode, ProdCatCode
Columns:      ProdTypeCode, TypeName, ItemCount, TotalValue, AvgCost
Mock Data:    52 types, distribusi 11,571 items
```

#### A4. Stock Value Summary
```
ID:           INV-A4
Title:        Nilai Persediaan
Description:  Menampilkan total nilai persediaan inventory berdasarkan data monthly 
              valuation (IN_MTHENDITEM). Menampilkan nilai per bulan, trend, dan 
              breakdown berdasarkan lokasi gudang.
Tags:         ["nilai", "value", "valuation", "harga", "total", "persediaan", "amount",
               "worth", "stock value", "asset", " bulan ini", "bulanan"]
Icon:         DollarSign
SQL Source:   IN_MTHENDITEM (grouped by AccMonth, AccYear)
Filters:      AccMonth, AccYear, LocCode
Columns:      AccMonth, AccYear, TotalItems, TotalQty, TotalAmount, AvgCostPerItem
Mock Data:    626,553 records, total value Rp 129B (Sep 2026)
```

---

### GROUP B: STOCK ISSUE (4 Reports)

#### B1. Stock Issue Daily
```
ID:           INV-B1
Title:        Pengeluaran Barang
Description:  Menampilkan semua pengeluaran barang dari gudang secara kronologis.
              Setiap pengeluaran memiliki header (IN_STOCKISSUE) dan detail items
              (IN_STOCKISSUELN). Filterable by date range, location, dan account code.
Tags:         ["keluar", "issue", "pengeluaran", "barang keluar", "material", 
               "daily", "harian", "delivery", "retur", "return", "issue barang"]
Icon:         ArrowUpCircle
SQL Source:   IN_STOCKISSUE + IN_STOCKISSUELN
Filters:      DateRange (PostDate), LocCode, AccCode, AccMonth, AccYear, BlkCode, VehCode
Columns:      StockIssueID, PostDate, LocCode, AccCode, BlkCode, ItemCode, Description,
              Qty, Cost, Amount, TotalPrice, Remark
Mock Data:    15,514 headers / ~30,000 lines
```

#### B2. Stock Issue by Account Code
```
ID:           INV-B2
Title:        Pengeluaran per Kode Akun
Description:  Mengelompokkan pengeluaran barang berdasarkan account code (cost center).
              OC7190 untuk maintenance, GA9050 untuk general, dll. Berguna untuk
              budget tracking dan cost allocation per departemen.
Tags:         ["account", "akun", "cost center", "budget", "department", "pengeluaran",
               "allocation", "OC", "GA", "CA", "kode akun", "per biaya"]
Icon:         Receipt
SQL Source:   IN_STOCKISSUELN GROUP BY AccCode
Filters:      AccMonth, AccYear, LocCode, TopN
Columns:      AccCode, TransactionCount, TotalQty, TotalAmount, AvgAmountPerTrans
Mock Data:    OC7190 (9,026), OC7230 (5,117), GA9050 (4,066), GA9234 (2,662), CA4810 (1,395)
```

#### B3. Stock Issue by Block (Estate)
```
ID:           INV-B3
Title:        Pengeluaran per Blok Kebun
Description:  Tracking pengeluaran material berdasarkan blok estate (BLR25001, 
              WTP06001, ETP17001, dll). Untuk monitoring penggunaan material 
              per area plantation.
Tags:         ["blok", "block", "estate", "kebun", "area", "planting", "LR", "WR",
               "plant", "pengeluaran blok", "material per area", "AF", "ETP", "WTP"]
Icon:         MapPin
SQL Source:   IN_STOCKISSUELN WHERE BlkCode IS NOT NULL
Filters:      AccMonth, AccYear, BlkCode, LocCode
Columns:      BlkCode, TransactionCount, TotalAmount, TopItems (Qty desc)
Mock Data:    BLR25001 (5,703), OFFICE (2,827), BLR24001 (2,110), WTP06001 (1,661)
```

#### B4. Stock Issue by Vehicle
```
ID:           INV-B4
Title:        Pengeluaran per Kendaraan
Description:  Menganalisa pengeluaran spare parts/material berdasarkan kendaraan
              (BE001, FR001, LN001, dll). Berguna untuk vehicle maintenance
              budgeting dan analisis biaya operasional kendaraan.
Tags:         ["kendaraan", "vehicle", "mobil", "alat berat", "spare part", 
               "operational cost", "fuel", "maintenance", "BE", "LN", "FR", "truck"]
Icon:         Truck
SQL Source:   IN_STOCKISSUELN WHERE VehCode IS NOT NULL
Filters:      AccMonth, AccYear, VehCode
Columns:      VehCode, TransactionCount, TotalAmount, ItemCount, LastIssueDate
Mock Data:    LN001 (197), BE001 (83), FR001 (61), BE002 (59), T001 (48)
```

---

### GROUP C: STOCK VALUATION (4 Reports)

#### C1. Monthly Valuation
```
ID:           INV-C1
Title:        Valuasi Bulanan
Description:  Menampilkan nilai inventory per bulan menggunakan data IN_MTHENDITEM.
              Setiap bulan menyimpan snapshot Qty, AverageCost, dan Amount untuk
              setiap item. Cocok untuk monthly reporting dan financial reconciliation.
Tags:         ["valuasi", "bulanan", "monthly", "nilai", "amount", "reconciliation",
               "month end", "stock card", "evaluation", "monthly valuation"]
Icon:         BarChart3
SQL Source:   IN_MTHENDITEM
Filters:      AccMonth, AccYear, LocCode, ProdCatCode
Columns:      AccYear, AccMonth, ItemCount, TotalQty, TotalAmount, AvgValuePerItem
Mock Data:    626,553 records, latest 2026-09: Rp 129,376,161,787
```

#### C2. Stock Value by Category
```
ID:           INV-C2
Title:        Nilai Stok per Kategori
Description:  Breakdown nilai persediaan berdasarkan kategori produk per bulan.
              Mengidentifikasi category mana yang memiliki nilai tertinggi dan
              trend perubahannya dari waktu ke waktu.
Tags:         ["nilai kategori", "value by category", "spend analysis", "category value",
               "inventory value", "kategori", "chemical value", "fuel value"]
Icon:         PieChart
SQL Source:   IN_MTHENDITEM + IN_PRODCAT
Filters:      AccMonth, AccYear, TopN
Columns:      ProdCatCode, CategoryName, ItemCount, TotalAmount, PercentageOfTotal
Mock Data:    9 kategori breakdown
```

#### C3. Stock Card (Item Movement)
```
ID:           INV-C3
Title:        Kartu Stok
Description:  Menampilkan movement/history satu item dari waktu ke waktu.
              Berguna untuk tracking harga dan quantity per item. Single item view.
Tags:         ["kartu stok", "stock card", "movement", "history", "item", "tracking",
               "harga per item", "qty trend", "item detail", "by item"]
Icon:         Activity
SQL Source:   IN_MTHENDITEM (per ItemCode)
Filters:      ItemCode (required), AccYear, LocCode
Columns:      AccYear, AccMonth, Qty, AverageCost, Amount, DiffFromPrevMonth
Mock Data:    626,553 records, one item can have multiple rows (one per month)
```

#### C4. ABC Analysis (Pareto)
```
ID:           INV-C4
Title:        Analisis ABC (Pareto)
Description:  Klasifikasi item berdasarkan nilai (Amount) untuk identifikasi
              items yang paling penting. A = Top 20% items (80% value),
              B = Next 30% (15% value), C = Bottom 50% (5% value).
Tags:         ["abc", "pareto", "analysis", "penting", "priority", "klasifikasi",
               "value", "top items", "slow moving", "fast moving", "most valuable"]
Icon:         TrendingUp
SQL Source:   IN_MTHENDITEM (latest month, grouped by ItemCode)
Filters:      AccMonth, AccYear, Category
Columns:      ItemCode, Description, TotalAmount, CumulativeAmount, Class (A/B/C)
Mock Data:    11,571 items, klasifikasi berdasarkan Amount
```

---

### GROUP D: DEAD STOCK / SLOW MOVING (4 Reports)

#### D1. Dead Stock (>6 Months)
```
ID:           INV-D1
Title:        Dead Stock (>6 Bulan)
Description:  Mengidentifikasi item yang tidak ada movement dalam 6 bulan terakhir.
              Items ini mungkin tidak diperlukan atau sudah obsolete. Perlu di-review
              untuk divestment atau write-off decision.
Tags:         ["dead stock", "tidak bergerak", "idle", "obsolete", " lama", "6 bulan",
               "no movement", "inactive", "unused", "hampa", "kosong", "dorman"]
Icon:         AlertTriangle
SQL Source:   IN_ITEM WHERE LastIssueDate < DATEADD(month, -6, GETDATE())
Filters:      LocCode, ProdCatCode
Columns:      ItemCode, Description, QtyOnHand, AverageCost, LastIssueDate, DaysSinceIssue
Mock Data:    282 items (6-12 months) + 3,042 (>1 year) + 8,025 (never issued)
```

#### D2. Dead Stock (>12 Months)
```
ID:           INV-D2
Title:        Dead Stock (>12 Bulan)
Description:  Item yang tidak ada movement lebih dari 1 tahun. Prioritas tertinggi
              untuk dead stock analysis. Segera perlu decision: dispose, transfer,
              atau keep as safety stock.
Tags:         ["dead stock", "lama", "1 tahun", "12 bulan", "no movement", "idle",
               "obsolete", "unused", "inactive", "years", "annual", "critical"]
Icon:         AlertOctagon
SQL Source:   IN_ITEM WHERE LastIssueDate < DATEADD(year, -1, GETDATE())
Filters:      LocCode, ProdCatCode, MinValue
Columns:      ItemCode, Description, QtyOnHand, TotalValue, LastIssueDate, AgeInDays
Mock Data:    3,042 items >1 year no movement
```

#### D3. Zero Stock Items
```
ID:           INV-D3
Title:        Item Stok Nol
Description:  Daftar item yang QtyOnHand = 0 (habis/stock out). Perlu di-check
              apakah perlu reorder urgent atau memang sudah tidak dipakai.
Tags:         ["zero stock", "stok habis", "out of stock", "stock out", "empty",
               "kosong", "habis", "missing", "shortage", "deficit", "unavailable"]
Icon:         XCircle
SQL Source:   IN_ITEM WHERE QtyOnHand = 0
Filters:      LocCode, ProdCatCode, LastOrderDate
Columns:      ItemCode, Description, ReOrderLevel, LastOrderDate, LastIssueDate
Mock Data:    4,963 items with QtyOnHand = 0
```

#### D4. Slow Moving Stock
```
ID:           INV-D4
Title:        Slow Moving Stock
Description:  Item dengan movement rendah tapi bukan zero stock. Middle category
              antara fast-moving dan dead stock. Perlu dipantau agar tidak menjadi
              dead stock. Dikalkulasi dari frekuensi transaksi IN_STOCKISSUELN.
Tags:         ["slow moving", "low movement", "kurang aktif", "rarely used",
               "infrequent", "moderate", "movement", "lambat", "jarang gerak"]
Icon:         TrendingDown
SQL Source:   IN_ITEM + IN_STOCKISSUELN (LEFT JOIN)
SQL:
SELECT i.ItemCode, RTRIM(i.Description) as Description,
       RTRIM(i.ProdCatCode) as Category,
       ISNULL(i.QtyOnHand,0) as QtyOnHand,
       ISNULL(i.AverageCost,0) as AverageCost,
       ISNULL(i.QtyOnHand,0) * ISNULL(i.AverageCost,0) as TotalValue,
       COUNT(sil.StockIssueID) AS MovementScore,
       MAX(sil.DocDate) as LastIssueDate
FROM IN_ITEM i
LEFT JOIN IN_STOCKISSUELN sil ON i.ItemCode = sil.ItemCode
WHERE i.Status = '1'
GROUP BY i.ItemCode, i.Description, i.QtyOnHand, i.AverageCost, i.ProdCatCode
HAVING COUNT(sil.StockIssueID) BETWEEN 1 AND 6  -- aktif tapi jarang
ORDER BY COUNT(sil.StockIssueID) ASC, TotalValue DESC
OFFSET @PageSize * (@PageNumber - 1) ROWS
FETCH NEXT @PageSize ROWS ONLY
Filters:      Category, MinMovementScore, MaxMovementScore, PageSize, PageNumber
Columns:      ItemCode, Description, Category, QtyOnHand, AverageCost, TotalValue,
              MovementScore, LastIssueDate
Mock Data:    Items dengan 1-6 kali issue dalam history
Lookup:       Category → IN_PRODCAT
```

---

### GROUP E: REORDER & LOW STOCK (3 Reports)

#### E1. Low Stock Alert
```
ID:           INV-E1
Title:        Peringatan Stok Rendah
Description:  Item yang QtyOnHand sudah di bawah atau sama dengan ReOrderLevel.
              Ini adalah signal untuk melakukan reorder. Prioritas tinggi untuk
              procurement team.
Tags:         ["low stock", "reorder", "stok rendah", "alert", "warning", "understock",
               "below minimum", "minimum", " shortage", "urgently", "need to order"]
Icon:         Bell
SQL Source:   IN_ITEM WHERE QtyOnHand <= ReOrderLevel AND ReOrderLevel > 0
Filters:      LocCode, Category, UrgencyLevel
Columns:      ItemCode, Description, QtyOnHand, ReOrderLevel, Shortage, UnitCost, 
              EstimatedOrderValue
Mock Data:    281 items below reorder level
```

#### E2. Reorder Recommendation
```
ID:           INV-E2
Title:        Rekomendasi Reorder
Description:  Auto-calculate reorder quantity berdasarkan average usage dan lead time.
              Menggunakan data history untuk menentukan optimal order quantity.
Tags:         ["reorder", "recommendation", "order", "purchase", "procurement",
               "buying", "kapan order", "quantity", "EOQ", "optimal order",
               "when to order", "restock", "pemesanan", "pembelian", "beli"]
Icon:         ShoppingCart
SQL Source:   IN_ITEM + IN_STOCKISSUELN (historical usage)
SQL:
WITH MonthlyUsage AS (
    SELECT ItemCode,
           SUM(Qty) as TotalQty,
           COUNT(DISTINCT FORMAT(DocDate, 'yyyy-MM')) as ActiveMonths,
           CAST(SUM(Qty) AS FLOAT) / NULLIF(COUNT(DISTINCT FORMAT(DocDate, 'yyyy-MM')),0) as AvgMonthlyUsage
    FROM IN_STOCKISSUELN
    WHERE DocDate >= DATEADD(MONTH, -6, GETDATE())
    GROUP BY ItemCode
)
SELECT i.ItemCode, RTRIM(i.Description) as Description,
       RTRIM(i.ProdCatCode) as Category,
       ISNULL(i.QtyOnHand,0) as QtyOnHand,
       ISNULL(i.AverageCost,0) as AverageCost,
       ISNULL(m.AvgMonthlyUsage,0) as AvgMonthlyUsage,
       ISNULL(m.ActiveMonths,0) as ActiveMonths,
       ISNULL(i.QtyOnHand,0) / NULLIF(ISNULL(m.AvgMonthlyUsage,1),0) as MonthsOfStock,
       CASE WHEN ISNULL(i.QtyOnHand,0) / NULLIF(ISNULL(m.AvgMonthlyUsage,1),0) < 2 THEN 'URGENT'
            WHEN ISNULL(i.QtyOnHand,0) / NULLIF(ISNULL(m.AvgMonthlyUsage,1),0) < 4 THEN 'SOON'
            ELSE 'OK' END as ReorderUrgency,
       ROUND(ISNULL(m.AvgMonthlyUsage,0) * 2, 0) as RecommendedOrderQty,  -- 2 months buffer
       ROUND(ISNULL(m.AvgMonthlyUsage,0) * 2, 0) * ISNULL(i.AverageCost,0) as EstimatedCost
FROM IN_ITEM i
LEFT JOIN MonthlyUsage m ON i.ItemCode = m.ItemCode
WHERE i.Status = '1'
  AND ISNULL(i.QtyOnHand,0) < ISNULL(m.AvgMonthlyUsage,0) * 2  -- below 2 months stock
ORDER BY (CASE WHEN ISNULL(i.QtyOnHand,0) / NULLIF(ISNULL(m.AvgMonthlyUsage,1),0) < 2 THEN 1
               WHEN ISNULL(i.QtyOnHand,0) / NULLIF(ISNULL(m.AvgMonthlyUsage,1),0) < 4 THEN 2
               ELSE 3 END), i.QtyOnHand ASC
OFFSET @PageSize * (@PageNumber - 1) ROWS
FETCH NEXT @PageSize ROWS ONLY
Filters:      Category, Urgency (URGENT/SOON/OK), PageSize, PageNumber
Columns:      ItemCode, Description, Category, QtyOnHand, AvgMonthlyUsage,
              MonthsOfStock, ReorderUrgency, RecommendedOrderQty, EstimatedCost
Mock Data:    ~50 items with less than 2 months stock
Lookup:       Category → IN_PRODCAT
Notes:        AvgMonthlyUsage derived from IN_STOCKISSUELN last 6 months
```

#### E3. Items Below Minimum
```
ID:           INV-E3
Title:        Item di Bawah Minimum
Description:  Variant dari low stock alert yang fokus ke items yang sudah below
              minimum level. Priority list untuk purchasing action.
Tags:         ["below minimum", "minimum", "reorder level", "critical", "minimum stock",
               "safety stock", "buffer", "level", "batas bawah"]
Icon:         AlertCircle
SQL Source:   IN_ITEM WHERE QtyOnHand < ReOrderLevel
Filters:      LocCode, Category
Columns:      ItemCode, Description, QtyOnHand, ReOrderLevel, Gap, Urgency
Mock Data:    Subset of items where QtyOnHand < ReOrderLevel
```

---

### GROUP F: FUEL MANAGEMENT (3 Reports)

#### F1. Fuel Issue Summary
```
ID:           INV-F1
Title:        Ringkasan Pengeluaran BBM
Description:  Overview seluruh pengeluaran BBM/solar dari gudang. Menampilkan
              total volume, total cost, dan trend per bulan. Semua fuel issue
              menggunakan item code MF01001 (Solar) dan variantnya.
Tags:         ["bbm", "fuel", "solar", "diesel", "minyak", "bahan bakar", "fuel issue",
               "consumption", "pemakaian", "solar", "bensin", "fuel summary"]
Icon:         Droplet
SQL Source:   IN_FUELISSUE + IN_FUELISSUELN
Filters:      AccMonth, AccYear, LocCode, AccCode
Columns:      FuelIssueID, PostDate, TotalAmount, TotalQty, AccCode, VehicleCount
Mock Data:    7,067 headers, ~8,000 lines
```

#### F2. Fuel Consumption by Vehicle
```
ID:           INV-F2
Title:        Konsumsi BBM per Kendaraan
Description:  Tracking konsumsi BBM per kendaraan/unit. BE001, BE002 (berat unit),
              LN001 (loader), FR001 (forklift), VN005 (van). Berguna untuk
              operational cost analysis dan fuel efficiency monitoring.
Tags:         ["fuel vehicle", "konsumsi kendaraan", "bbm kendaraan", "fuel per unit",
               "vehicle consumption", "liter kendaraan", "operational cost", 
               "fuel efficiency", "BE", "LN", "FR", "VN", "alat berat"]
Icon:         Fuel
SQL Source:   IN_FUELISSUELN GROUP BY VehCode
Filters:      AccMonth, AccYear, VehCode, TopN
Columns:      VehCode, TransactionCount, TotalQty (liter), TotalAmount, AvgPerTransaction
Mock Data:    BE002 (1,027), BE001 (760), LN001 (648), VN005 (564), FR001 (517)
```

#### F3. Fuel Cost by Account Code
```
ID:           INV-F3
Title:        Biaya BBM per Kode Akun
Description:  Breakdown biaya BBM berdasarkan account code (cost center). GA9010
              untuk general, OC7220 untuk workshop, dll. Untuk tracking budget
              consumption per department.
Tags:         ["fuel cost", "bbm biaya", "account code fuel", "cost by dept", 
               "GA", "OC", "fuel budget", "dept fuel", "department", "biaya bbm"]
Icon:         CreditCard
SQL Source:   IN_FUELISSUELN GROUP BY AccCode
Filters:      AccMonth, AccYear, TopN
Columns:      AccCode, TransactionCount, TotalQty, TotalAmount, AvgCostPerMonth
Mock Data:    Based on IN_FUELISSUELN AccCode distribution
```

---

### GROUP G: PURCHASE REQUISITION (2 Reports)

#### G1. Outstanding PR
```
ID:           INV-G1
Title:        Purchase Requisition Outstanding
Description:  Daftar PR line yang belum fulfilled sepenuhnya (QtyOutstanding > 0).
              Setiap PR memiliki multiple line items. Berguna untuk tracking
              pending orders dan follow-up dengan supplier.
Tags:         ["pr", "purchase requisition", "outstanding", "pending", "po", 
               "purchase order", "belum datang", "on order", "outstanding pr",
               "open pr", "procurement", "belum terima"]
Icon:         FileText
SQL Source:   IN_PRLN WHERE QtyOutstanding > 0
Filters:      Status (1=Active, 2=Closed), AccMonth, AccYear
Columns:      PRID, ItemCode, Description, QtyReq, QtyRcv, QtyOutstanding, 
              Status, AccCodeDesc
Mock Data:    5,752 outstanding PR lines out of 29,592 total
```

#### G2. PR by Status
```
ID:           INV-G2
Title:        Status Purchase Requisition
Description:  Overview status PR: Active (1) = masih open, Closed (2) = completed.
              Distribution PR per status dan analytics untuk procurement cycle time.
Tags:         ["pr status", "status", "open", "closed", "purchase requisition status",
               "completed", "active pr", "procurement cycle", "pr analysis"]
Icon:         CheckCircle
SQL Source:   IN_PRLN GROUP BY Status
Filters:      AccMonth, AccYear, LocCode
Columns:      Status, PRCount, TotalQtyReq, TotalQtyOutstanding, AvgOutstandingQty
Mock Data:    Status 1 (Active): 29,222 lines, Status 2 (Closed): 370 lines
```

---

## 4. SEMANTIC SEARCH DESIGN

### 4.1 Tag Taxonomy (Indonesian-focused)

```javascript
const REPORT_TAGS = {
  // Inventory Core
  "stok": ["stock", "inventory", "persediaan", "barang"],
  "barang": ["item", "material", "produk", "goods"],
  "gudang": ["warehouse", "loc", "storage", "lokasi"],
  
  // Actions
  "keluar": ["issue", "keluarkan", "keluar", "deliver"],
  "masuk": ["receive", "terima", "masuk", "inbound"],
  "pengeluaran": ["usage", "consumption", "spent"],
  "penerimaan": ["receive", "receive"],
  
  // Analysis Types
  "dead stock": ["idle", "tidak aktif", "lama tidak gerak", "obsolete"],
  "nilai": ["value", "amount", "harga", "worth"],
  "kategori": ["category", "group", "type"],
  "kendaraan": ["vehicle", "mobil", "alat berat"],
  "blok": ["block", "area", "estate", "kebun"],
  
  // Time/Period
  "bulanan": ["monthly", "per bulan", "bulan ini"],
  "harian": ["daily", "per hari"],
  "tahunan": ["yearly", "per tahun", "annual"],
  
  // Alerts
  "rendah": ["low", "below", "under", "kurang"],
  "habis": ["zero", "empty", "out of stock", "kosong"],
  "dead": ["idle", "inactive", "unused", "no movement"],
  
  // Finance
  "biaya": ["cost", "expense", "spending"],
  "budget": ["anggaran", "budget", "allocation"]
}
```

### 4.2 Search Examples (Bahasa Natural → Report)

| User Query (Natural) | Matched Report | Score |
|----------------------|----------------|-------|
| "barang yang lama ga dipake" | INV-D1 (Dead Stock >6mo) | 0.85 |
| "stok yang udah habis" | INV-D3 (Zero Stock) | 0.88 |
| "nilai persediaan sekarang" | INV-A4 (Stock Value Summary) | 0.82 |
| "pengeluaran bbm kendaraan" | INV-F2 (Fuel by Vehicle) | 0.90 |
| "dead stock 1 tahun" | INV-D2 (Dead Stock >12mo) | 0.92 |
| "yang perlu reorder" | INV-E1 (Low Stock Alert) | 0.78 |
| "pengeluaran bulan ini" | INV-B1 (Stock Issue Daily) | 0.75 |
| "harga rata-rata item" | INV-C3 (Stock Card) | 0.72 |
| "material per blok" | INV-B3 (Issue by Block) | 0.87 |
| "abc analysis" | INV-C4 (Pareto/ABC) | 0.95 |

### 4.3 Search Engine Implementation

```typescript
// Semantic Search Algorithm
// 1. Tokenize user query (Indonesian stemming)
// 2. Match tokens against report tags (fuzzy matching)
// 3. Score each report (0-1)
// 4. Return top 3 matches with descriptions
// 5. If no good match (score < 0.5), show browse-by-category

interface ReportMetadata {
  id: string;           // "INV-A1"
  title: string;        // "Ringkasan Stok"
  description: string;  // Full description
  tags: string[];       // Searchable tags
  keywords: string[];   // Alternative terms (synonyms)
  category: string;     // "Stock Overview"
  icon: string;         // Lucide icon name
  route: string;        // "/reports/inventory/stock-summary"
  sqlQuery: string;     // SQL for fetching data
  filters: FilterConfig[];
  columns: ColumnConfig[];
  mockData?: object[];  // For dev/testing
}
```

### 4.4 Search UI

```
┌─────────────────────────────────────────────────────────┐
│  🔍 Cari laporan...                                     │
│  "barang yang lama ga dipake"                           │
├─────────────────────────────────────────────────────────┤
│  💡 Suggestion:                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📦 Dead Stock (>6 Bulan)                         │  │
│  │    Item yang tidak ada movement > 6 bulan        │  │
│  │    Tags: dead stock, idle, obsolete, tidak gerak  │  │
│  │    Score: 85%  │  [Lihat Report]                 │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📦 Dead Stock (>12 Bulan)                        │  │
│  │    Item tidak bergerak > 1 tahun                │  │
│  │    Score: 75%  │  [Lihat Report]                │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 📦 Slow Moving Stock                             │  │
│  │    Item dengan movement rendah                   │  │
│  │    Score: 60%  │  [Lihat Report]                │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 5. UI/UX DESIGN CONCEPT

### 5.1 Layout Structure

```
┌────────────────────────────────────────────────────────────┐
│  SIDEBAR (240px)      │  TOPBAR                            │
│  ─────────────────     │  PT Rebinmas Jaya │ Report Center  │
│  📊 Dashboard         ├────────────────────────────────────┤
│  📋 All Reports       │  HERO BANNER (Estate image bg)     │
│  🔍 Search...         │  "Inventory Module" + stats        │
│                       ├────────────────────────────────────┤
│  📦 INVENTORY         │  SEMANTIC SEARCH BAR               │
│    ├ Ringkasan Stok   │  [🔍 Cari laporan...]              │
│    ├ Stok per Kategori├────────────────────────────────────┤
│    ├ Stok per Tipe    │  REPORT CATEGORIES (7 groups)      │
│    └ Nilai Persedia.. │  ┌────┐┌────┐┌────┐┌────┐┌────┐   │
│                       │  │ A  ││ B  ││ C  ││ D  ││ E  │   │
│  🔧 STOCK ISSUE       │  │Stock││Issue││Valua││Dead││Reord│  │
│    ├ ...              │  │    ││     ││tion ││Stock││    │   │
│                       │  └────┘└────┘└────┘└────┘└────┘   │
│  ⛽ FUEL              │  ┌────┐┌────┐                       │
│                       │  │ F  ││ G  │                       │
│  📝 PURCHASE REQ      │  │Fuel││ PR  │                      │
│                       │  └────┘└────┘                       │
├───────────────────────┴────────────────────────────────────┤
│  REPORT PREVIEW PANEL (full width when report selected)    │
│  ┌─ Filters ─────────────────────────────────────────────┐│
│  │ [Bulan ▼] [Tahun ▼] [Lokasi ▼] [Export ▼]           ││
│  └───────────────────────────────────────────────────────┘│
│  ┌─ Data Table ──────────────────────────────────────────┐│
│  │ No │ Item │ Desc │ Qty │ Cost │ Amount │            ││
│  │ 1  │ D012 │ ...  │  1  │ 14M  │ 14.6M  │            ││
│  │ 2  │ ...  │ ...  │ ... │ ...  │ ...    │            ││
│  └───────────────────────────────────────────────────────┘│
│  ┌─ Pagination ──────────────────────────────────────────┐│
│  │ Showing 1-20 of 11,571  [◀ 1 2 3 ... 579 ▶]         ││
│  └───────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────┘
```

### 5.2 Color Palette

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary | Deep Forest Green | `#1B4332` | Sidebar, headers, buttons |
| Secondary | Warm Gold | `#D4A574` | Accent, highlights, icons |
| Background | Off White | `#F8F6F3` | Main content area |
| Surface | Pure White | `#FFFFFF` | Cards, panels |
| Text Primary | Charcoal | `#2D2D2D` | Body text |
| Text Muted | Slate | `#6B7280` | Secondary text |
| Success | Emerald | `#059669` | Positive values, stock in |
| Warning | Amber | `#D97706` | Low stock alerts |
| Danger | Coral Red | `#DC2626` | Dead stock, out of stock |
| Border | Light Gray | `#E5E7EB` | Dividers, borders |

### 5.3 Report Card Design

```
┌──────────────────────────────────────────┐
│  📦 STOCK OVERVIEW                        │  ← Group Badge
├──────────────────────────────────────────┤
│  💰 Ringkasan Stok                        │  ← Icon + Title
│  11,571 items · PTRJ                      │  ← Summary stats
│                                          │
│  Menampilkan daftar lengkap seluruh      │  ← Description (2 lines max)
│  item yang terdaftar di gudang PTRJ...    │
│                                          │
│  Tags: #stok #gudang #item               │  ← Searchable tags
│                                          │
│  [Lihat Report]  [Pin to Favorites]      │  ← Actions
└──────────────────────────────────────────┘
```

---

## 6. TECHNICAL REQUIREMENTS

### 6.1 Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + custom design tokens
- **Icons:** Lucide React
- **Data Fetching:** API Routes via SQL Gateway
- **State Management:** React Server Components + client interactivity
- **Search:** Client-side fuzzy search (no external service)

### 6.2 API Structure

```
POST /api/reports/inventory/[report-id]
Body: { filters: { month, year, locCode, ... }, page, pageSize }
Response: { data: [...], total: number, page: number, pageSize: number }

GET /api/reports/inventory/schema/[report-id]
Response: { columns: [...], filters: [...], description: string }

GET /api/reports/inventory/search?q=[query]
Response: { matches: [{ report, score, highlighted_tags }...] }
```

### 6.3 File Structure

```
app/
├── reports/
│   ├── page.tsx                    ← Report Center main page
│   └── inventory/
│       ├── page.tsx                ← Inventory module landing
│       ├── stock-summary/
│       │   └── page.tsx            ← Report A1
│       ├── stock-by-category/
│       │   └── page.tsx            ← Report A2
│       ├── ... (20 reports)
│       └── layout.tsx              ← Shared inventory layout
├── api/
│   └── reports/
│       └── inventory/
│           ├── [report-id]/
│           │   └── route.ts         ← Dynamic report API
│           └── search/
│               └── route.ts         ← Semantic search API
components/
├── reports/
│   ├── ReportCard.tsx
│   ├── ReportFilters.tsx
│   ├── ReportTable.tsx
│   ├── SemanticSearch.tsx
│   └── ReportMetadata.ts            ← 20 report configs
lib/
├── reports/
│   ├── inventory/
│   │   ├── queries.ts               ← SQL query builders
│   │   ├── metadata.ts              ← Report configs + tags
│   │   └── mock-data.ts            ← Mock data generators
│   └── semantic-search.ts           ← Search engine
```

### 6.4 Performance Requirements
- Initial load: < 2s (dashboard)
- Report data fetch: < 3s (SQL Gateway)
- Search response: < 100ms (client-side)
- Pagination: 20 rows default, max 100 per page

---

## 7. PHASES & MILESTONES

### Phase 0: PRD & Design Document ✅ (THIS DOCUMENT)
- Schema analysis ✅
- Report inventory (20 reports) ✅
- Semantic search design ✅
- UI/UX concept ✅

### Phase 1: Creative Sessions (Multi-Agent Review)
- [ ] UX Reviewer Agent
- [ ] Data Analyst Agent  
- [ ] Business Analyst Agent
- [ ] Security Reviewer Agent

### Phase 2: Development (Delegated to Codex)
- [ ] API Routes (SQL queries for all 20 reports)
- [ ] UI Components
- [ ] Semantic Search Engine

### Phase 3: Checkpoint Testing
- [ ] API returns real data
- [ ] UI renders correctly
- [ ] Semantic search works
- [ ] All 20 reports accessible

### Phase 4: Integration & Deploy
- [ ] Connect to existing dashboard
- [ ] Final QA
- [ ] Deploy

---

## 8. OPEN QUESTIONS / DECISIONS NEEDED

1. **AccCode mapping** - OC7190, GA9050, dll belum ada deskripsi. Perlu lookup table?
2. **BlkCode naming** - BLR25001, WTP06001, ETP17001 - perlu decode jadi nama blok?
3. **VehCode mapping** - BE001, LN001, FR001 - perlu lookup ke GL_VEHICLE?
4. **Monthly data** - IN_MTHENDITEM ada 2026-09 (future date?). How to handle?
5. **LastIssueDate** - Banyak NULL atau '1900-01-01'. How to interpret?
6. **Export format** - CSV only, atau add Excel/PDF?
7. **Favorites** - Need backend persistence or localStorage only?
8. **Pagination** - Server-side (default) or client-side?

---

## 9. APPENDIX: SQL QUERY TEMPLATES

### A1: Stock Summary
```sql
SELECT 
    i.ItemCode,
    RTRIM(i.Description) as Description,
    RTRIM(i.ItemType) as ItemType,
    RTRIM(i.ProdCatCode) as ProdCatCode,
    RTRIM(cat.Description) as CategoryName,
    i.QtyOnHand,
    i.AverageCost,
    i.LatestCost,
    i.ReOrderLevel,
    RTRIM(i.UOMCode) as UOMCode,
    RTRIM(i.Status) as Status
FROM IN_ITEM i
LEFT JOIN IN_PRODCAT cat ON i.ProdCatCode = cat.ProdCatCode
WHERE i.Status = '1'
ORDER BY i.ItemCode
```

### C4: ABC Analysis
```sql
WITH ItemValue AS (
    SELECT 
        ItemCode,
        SUM(Amount) as TotalAmount
    FROM IN_MTHENDITEM
    WHERE AccYear = '2026' AND AccMonth = '09'
    GROUP BY ItemCode
),
Ranked AS (
    SELECT 
        ItemCode,
        TotalAmount,
        SUM(TotalAmount) OVER() as GrandTotal,
        ROW_NUMBER() OVER(ORDER BY TotalAmount DESC) as RowNum
    FROM ItemValue
)
SELECT 
    ItemCode,
    TotalAmount,
    CAST(RowNum AS FLOAT) / (SELECT COUNT(*) FROM ItemValue) * 100 as Percentile,
    CASE 
        WHEN RowNum <= (SELECT COUNT(*) * 0.2 FROM ItemValue) THEN 'A'
        WHEN RowNum <= (SELECT COUNT(*) * 0.5 FROM ItemValue) THEN 'B'
        ELSE 'C'
    END as Class
FROM Ranked
```

---

**Document Status:** DRAFT  
**Next Step:** Phase 1 - Creative Session (Multi-Agent Review)  
**Prepared by:** Hermes Agent (Data Science + Business Analysis perspective)