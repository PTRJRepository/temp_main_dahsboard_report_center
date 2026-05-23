# PRD: PT Rebinmas Jaya Report Center — Inventory Module
**Version:** 1.0  
**Date:** 2026-05-17  
**Status:** READY FOR DEVELOPMENT  
**Author:** Generated from comprehensive database analysis + PRD review

---

## 1. Project Overview

### 1.1 Product Summary
**Report Center** adalah portal web internal khusus laporan untuk PT Rebinmas Jaya. Portal ini terpisah dari sistem pengelolaan data (payroll, daftar upah, absensi, inventory) dan dirancang untuk memudahkan user menemukan, membuka, mem-preview, mem-filter, dan meng-export laporan berdasarkan modul.

Dashboard ini lebih modern, premium, intuitif, dan lebih mudah dikembangkan dibanding dashboard lama.

### 1.2 Problem Statement
- Report tersebar di banyak menu
- User harus masuk ke modul tertentu untuk mencari laporan
- Tidak ada pusat pencarian report yang cepat
- Report belum dikelompokkan secara visual berdasarkan modul
- Tidak ada preview laporan sebelum dibuka
- Favorite dan recent report belum menjadi fokus utama
- Dashboard lama terasa fungsional tapi kurang modern

### 1.3 Product Goals
User harus bisa:
- Mencari report dari satu search bar global
- Melihat semua report berdasarkan modul
- Membuka modul (misal Inventory) untuk melihat semua report Inventory saja
- Melihat preview laporan sebelum membuka halaman detail
- Melakukan export Excel, PDF, atau CSV dengan cepat
- Menyimpan report favorit
- Melihat report terakhir dibuka
- Mengakses report maksimal dalam 2 klik dari dashboard

### 1.4 Target Users
| Role | Description |
|------|-------------|
| **Kerani** | Membuka laporan harian dan bulanan. Export untuk operasional. |
| **HR/Payroll Staff** | Membuka laporan payroll, absensi, lembur, premi, karyawan. Validasi data. |
| **Admin** | Melihat semua report. Memantau status data, integrasi, audit. |
| **Manager** | Melihat summary report, produktivitas, payroll summary, performa. |

### 1.5 UX Principles
- **Report-only experience**: Tidak ada tombol tambah, edit, delete, input data, atau sync manual
- **Module-first navigation**: Semua report dikelompokkan berdasarkan modul
- **Search-first experience**: Search bar sangat menonjol
- **Preview sebelum buka**: Panel preview dengan tabel, grafik, metadata, action buttons
- **Maksimal 2 klik**: Dari dashboard utama ke report penting
- **Progressive disclosure**: Dashboard utama hanya menampilkan modul
- **Upgradeable design**: Mudah dikembangkan untuk modul baru

---

## 2. Database Schema — REAL DATA ANALYSIS

### 2.1 Base Tables with Row Counts

| Table | Rows | Purpose |
|-------|------|---------|
| IN_ITEM | 11,571 | Master item barang |
| IN_STOCKISSUELN | 30,637 | Detail pengeluaran barang |
| IN_STOCKISSUE | 15,514 | Header pengeluaran barang |
| IN_MTHENDITEM | 626,553 | Valuasi stok bulanan |
| IN_FUELISSUELN | 8,293 | Detail pengeluaran BBM |
| IN_FUELISSUE | 7,067 | Header pengeluaran BBM |
| IN_PRLN | 29,592 | Detail Purchase Requisition |
| IN_PR | 9,700 | Header Purchase Requisition |
| IN_STOCKADJ | 34 | Penyesuaian stok |
| IN_STOCKADJLN | 134 | Detail penyesuaian stok |
| IN_STOCKRTN | 31 | Retur stok |
| IN_STOCKRTNLN | 32 | Detail retur stok |
| IN_FUELRTN | 27 | Retur BBM |
| IN_FUELRTNLN | 34 | Detail retur BBM |
| IN_MTHENDTRX | 77,522 | Transaksi bulanan (all modules) |
| IN_PRODCAT | 9 | Kategori produk |
| IN_PRODTYPE | 52 | Tipe produk |
| GL_VEHICLE | 21 | Data kendaraan |
| GL_ACCOUNT | 277 | Chart of accounts |
| GL_BLOCK | N/A | Block/department codes |

### 2.2 IN_ITEM Schema (11,571 items)

**47 columns** — key columns:

| Column | Type | Notes |
|--------|------|-------|
| ItemCode | char(20) | Primary key |
| LocCode | char(8) | Location code |
| Description | nchar(128) | Item name |
| ItemType | char(8) | Type code |
| ProdTypeCode | char(8) | Product type |
| ProdCatCode | char(8) | Product category |
| UOMCode | char(8) | Unit of measure |
| ReOrderLevel | decimal | Minimum stock level |
| QtyOnHand | decimal | Current quantity |
| QtyOnHold | decimal | On hold |
| QtyOnOrder | decimal | On order |
| QtyReOrder | decimal | Reorder quantity |
| AverageCost | decimal | Average cost |
| LatestCost | decimal | Latest purchase cost |
| Status | char(2) | **ALWAYS '1 ' (with trailing space)** |
| LastIssueDate | datetime | Last stock issue date |
| LastOrderDate | datetime | Last purchase date |
| CreateDate | datetime | Record creation |
| UpdateDate | datetime | Last update |
| UpdateID | char(20) | User who updated |

### 2.3 IN_STOCKISSUELN Schema (30,637 lines)

| Column | Type | Notes |
|--------|------|-------|
| StockIssueLNID | char | Line ID |
| StockIssueID | char | Header link |
| AccCode | char | **Department code (NOT GL_ACCOUNT!)** |
| BlkCode | char | Block code |
| VehCode | char | Vehicle code |
| ItemCode | char | Item link |
| Qty | decimal | Quantity issued |
| Cost | decimal | Unit cost |
| Amount | decimal | Total amount |
| Price | decimal | Price |
| PriceAmount | decimal | Price total |

### 2.4 IN_MTHENDITEM Schema (626,553 records)

| Column | Type | Notes |
|--------|------|-------|
| ItemCode | char | Item link |
| LocCode | char | Location |
| AccMonth | char | Accounting month (Padded: '01'-'12') |
| AccYear | char | Accounting year |
| Qty | decimal | Quantity |
| AverageCost | decimal | Avg cost |
| Amount | decimal | Total value |

**Period Coverage**: 77 periods from 2019-12 to 2026-09

### 2.5 IN_FUELISSUELN Schema (8,293 lines)

| Column | Type | Notes |
|--------|------|-------|
| FuelIssueLNID | char | Line ID |
| FuelIssueID | char | Header link |
| AccCode | char | Account/department |
| BlkCode | char | Block code |
| VehCode | char | **Vehicle code (IN LINE TABLE!)** |
| ItemCode | char | Fuel item code |
| Qty | decimal | Liters |
| Cost | decimal | Cost per liter |
| Amount | decimal | Total amount |

### 2.6 IN_PR / IN_PRLN Schema

**IN_PR** (9,700 headers):
| Column | Type |
|--------|------|
| PRID | char |
| PRType | char |
| TotalAmount | decimal |
| Status | char |
| PRDate | datetime |
| AccMonth/Year | char |
| LocCode | char |

**IN_PRLN** (29,592 lines):
| Column | Type |
|--------|------|
| StockIssueLNID | char |
| ItemCode | char |
| QtyReq | decimal |
| QtyRcv | decimal |
| QtyOutstanding | decimal |
| Status | char |

### 2.7 Lookup Tables

**IN_PRODCAT** (9 categories):
```
C   = Chemical        (58 items, Rp 567M)
E   = Electrical     (1,050 items, Rp 5.9B)
F   = Fuel           (3 items, Rp 246M)
G   = General Hardware (2,925 items, Rp 17.5B)
L   = Lubricant      (94 items, Rp 1.1B)
LLN = Lainnya        (3,367 items, Rp 38.8B)
M   = Mechanical     (1,980 items, Rp 20.1B)
S   = Sundry         (1,187 items, Rp 1.1B)
Z   = Fertilizer     (6 items, Rp 41M)
```

**GL_VEHICLE** (21 vehicles):
```
BE001-BE004 = Bulldozer / Excavator
DT001-DT002 = Dump Truck
FR001-FR003 = Forklift
GN001-GN003 = Genset
LN001-LN002 = Composting
T001-T002   = Tractor
VN005-VN010 = 4WD / Jeep
```

**Block Codes** (from IN_STOCKISSUELN BlkCode):
```
BLR = Boiler Station     WTP = Water Treatment Plant
ETP = Effluent Plant     ENG = Engine Room
STR = Sterilizer Station CPO = CPO Processing
PRS = Press Station      LAB = Laboratory
KER = Kernel Plant       GEN = Generator
CLR = Clarifier         COM = Compressor
OFFICE = Office/General
```

---

## 3. Real Data Statistics

### 3.1 IN_ITEM Summary
| Metric | Value |
|--------|-------|
| Total Items | 11,570 |
| Active Items | 11,570 (Status = '1') |
| Zero Stock | 4,962 (42.9%) |
| Below Reorder Level | 211 (1.8%) |
| Never Issued | 8,024 (69.4%) |
| Dead Stock (>6 months) | 3,324 |
| Dead Stock (>12 months) | 3,042 |
| Total Stock Value | **Rp 133.9 Billion** |

### 3.2 Dead Stock by Category
| Category | Dead Items | Value |
|----------|-----------|-------|
| LLN (Lainnya) | 3,366 | Rp 38.6B |
| M (Mechanical) | 1,980 | Rp 20.1B |
| G (General) | 2,910 | Rp 17.4B |
| E (Electrical) | 1,049 | Rp 5.9B |
| S (Sundry) | 999 | Rp 974M |
| Uncategorized | 890 | Rp 48.3B |
| **TOTAL** | **11,194 (96.8%)** | **Rp ~105B** |

**CRITICAL**: 78% of total inventory value is DEAD stock!

### 3.3 ABC Analysis (Top 20 by Value)
| Class | Item | Description | Value | Cumulative % |
|-------|------|-------------|-------|--------------|
| A | DC7715 | Generating Set 5625KVA | Rp 27.9B | 43.3% |
| A | DC05543 | Upgrading Boiler No.1&2 | Rp 9.0B | 57.2% |
| A | MM13016 | Turbine Rotor | Rp 4.7B | 64.5% |
| A | DC7617 | High Performance Generator | Rp 3.1B | 69.3% |
| A | DC7772 | Supply Install Testing | Rp 3.1B | 74.1% |
| A | ME14035 | 11/20KV Step-Up Transformer | Rp 3.1B | 78.9% |
| B | POMPM308 | Powermax Compost Turner | Rp 2.2B | 82.4% |
| B | DC7886 | Supply Material | Rp 1.1B | 84.1% |
| B | DC7619 | Repair VH35 Ton Boiler | Rp 1.1B | 85.8% |
| B | MG18004 | Chain Conveyor 6" | Rp 1.1B | 87.5% |

### 3.4 Top BlkCode (Department/Location) by Transactions
| BlkCode | Transactions | Amount | Description |
|---------|-------------|--------|-------------|
| BLR25001 | 5,703 | Rp 490M | Boiler Station |
| OFFICE | 2,827 | Rp 1.82B | Office/General |
| BLR24001 | 2,110 | Rp 389M | Boiler Station |
| WTP06001 | 1,661 | Rp 685M | Water Treatment |
| WTP05001 | 1,617 | Rp 275M | Water Treatment |
| WTP07001 | 1,573 | Rp 115M | Water Treatment |
| BLR30001 | 556 | Rp 505M | Boiler Station |
| KER51001 | 364 | Rp 464M | Kernel Plant |
| ETP17001 | 350 | Rp 642M | Effluent Plant |

### 3.5 Fuel Consumption by Account
| AccCode | Transactions | Liters | Amount |
|---------|-------------|--------|--------|
| GA9010 | 9,295 | 939,532L | Rp 11.65B |
| OC7220 | 287 | 32,542L | Rp 464M |
| OC7230 | 209 | 25,845L | Rp 410M |
| OC7200 | 20 | 8,259L | Rp 133M |
| GA9050 | 161 | 5,714L | Rp 86M |

### 3.6 Purchase Requisition Status
| Status | Count | Notes |
|--------|-------|-------|
| 6 | 7,241 | Approved/Completed |
| 4 | 1,534 | Partial |
| 2 | 770 | Pending |
| 3 | 130 | Rejected |
| 1 | 25 | New |

- Outstanding PR Lines: **6,118** with 718,474 units outstanding

### 3.7 Monthly Valuation (Recent Periods)
| Period | Items | Quantity | Amount |
|--------|-------|----------|--------|
| 2026-09 | 11,407 | 303,432 | Rp 129.4B |
| 2026-08 | 11,262 | 357,747 | Rp 130.8B |
| 2026-07 | 11,146 | 296,298 | Rp 128.3B |
| 2026-06 | 10,995 | 294,406 | Rp 125.0B |
| 2026-05 | 10,673 | 205,745 | Rp 125.8B |

---

## 4. Critical Data Quality Issues

### 4.1 Status Column — Trailing Space
```sql
-- WRONG (returns 0 rows):
WHERE Status = '1'

-- CORRECT:
WHERE RTRIM(Status) = '1'
```
**Always use RTRIM() for Status comparisons on IN_ITEM**

### 4.2 LastIssueDate — '1900-01-01' vs NULL
Both `'1900-01-01'` and `NULL` mean "Never Issued" / "Dead Stock"
```sql
-- Include both as dead stock:
WHERE LastIssueDate IS NULL
   OR LastIssueDate < '1990-01-01'
   OR LastIssueDate < DATEADD(MONTH, -6, GETDATE())
```

### 4.3 Future Period in IN_MTHENDITEM
Period `2026-09` exists but current date is May 2026. This is future data — show disclaimer.
```sql
-- Filter to current or past periods only:
WHERE (AccYear + AccMonth) <= CONVERT(VARCHAR(6), GETDATE(), 112)
```

### 4.4 AccCode in IN_STOCKISSUELN — NOT GL_ACCOUNT
The `AccCode` in `IN_STOCKISSUELN` is a **department/block code**, NOT the same as `GL_ACCOUNT`. They come from different systems. Use `GL_BLOCK` or treat as department codes.

### 4.5 VehCode Location in Fuel Tables
`VehCode` exists in `IN_FUELISSUELN` (LINE), NOT in `IN_FUELISSUE` (header). Always JOIN from line table.

### 4.6 Division by Zero in Calculations
```sql
-- WRONG:
QtyOnHand / AvgMonthlyUsage  -- crashes if AvgMonthlyUsage = 0

-- CORRECT:
CASE 
  WHEN ISNULL(AvgMonthlyUsage, 0) = 0 THEN 999
  ELSE QtyOnHand / NULLIF(AvgMonthlyUsage, 0)
END
```

---

## 5. 22 Inventory Reports — Complete Specifications

### GROUP A: STOCK OVERVIEW (Ringkasan Stok)

#### A1. Ringkasan Stok per Gudang
```
ID:           INV-A1
Title:        Ringkasan Stok per Gudang
Title(EN):    Stock Summary by Location
Description:  Menampilkan total keseluruhan item yang terdaftar di sistem 
              berdasarkan lokasi gudang. Includes qty, value, and category breakdown.
SQL Source:   IN_ITEM
Priority:     HIGH
Business Impact: Operasi harian — know what's where
Tags:         ["stok","gudang","lokasi","persediaan","warehouse","inventory","-barang"]
Filters:      LocCode, ProdCatCode, ItemType, Status
Columns:      LocCode, TotalItems, TotalQty, TotalValue, BelowReorderCount
```

#### A2. Ringkasan Stok per Kategori
```
ID:           INV-A2
Title:        Ringkasan Stok per Kategori
Title(EN):    Stock Summary by Category
Description:  Menampilkan distribusi item dan nilai persediaan berdasarkan 
              kategori produk (Chemical, Electrical, Mechanical, dll).
SQL Source:   IN_ITEM + IN_PRODCAT
Priority:     HIGH
Business Impact: Procurement planning by category
Tags:         ["stok","kategori","produk","chemical","electrical","mechanical","group"]
Filters:      ProdCatCode, ItemType, Status
Columns:      ProdCatCode, CategoryName, ItemCount, TotalQty, TotalValue
```

#### A3. Ringkasan Stok per Tipe Item
```
ID:           INV-A3
Title:        Ringkasan Stok per Tipe Item
Title(EN):    Stock by Item Type
Description:  Mengelompokkan item berdasarkan tipe item (1=Stock, 2=Non-Stock, dll)
              untuk analisis pengendalian persediaan.
SQL Source:   IN_ITEM + IN_PRODTYPE
Priority:     MEDIUM
Business Impact: Stock vs non-stock classification
Tags:         ["stok","tipe","jenis","item type","stock","non-stock"]
Filters:      ItemType, ProdTypeCode, Status
Columns:      ItemType, TypeName, ItemCount, TotalQty, TotalValue
```

#### A4. Nilai Persediaan Summary
```
ID:           INV-A4
Title:        Nilai Persediaan
Title(EN):    Stock Valuation Summary
Description:  Menampilkan total nilai persediaan saat ini berdasarkan AverageCost
              dan perbandingan dengan nilai periode sebelumnya.
SQL Source:   IN_MTHENDITEM
Priority:     HIGH
Business Impact: Financial reporting — inventory value
Tags:         ["nilai","valuasi","harga","cost","average","amount","rupiah","financial"]
Filters:      AccYear, AccMonth, LocCode, ProdCatCode
Columns:      Period, ItemCount, TotalQty, TotalAmount, MoMChange, MoMChangePct
```

---

### GROUP B: STOCK TRANSACTIONS (Mutasi & Transaksi)

#### B1. Mutasi Barang (Stock Movement)
```
ID:           INV-B1
Title:        Mutasi Barang
Title(EN):    Stock Movement Report
Description:  Laporan mutasi barang masuk dan keluar dalam periode tertentu.
              Menampilkan semua transaksi stock issue dengan detail per item.
SQL Source:   IN_STOCKISSUE + IN_STOCKISSUELN
Priority:     HIGH
Business Impact: Daily operational tracking
Tags:         ["mutasi","movement","masuk","keluar","issue","receive","transaksi"]
Filters:      AccYear, AccMonth, PostDateFrom, PostDateTo, ItemCode, BlkCode, AccCode
Columns:      DocNo, PostDate, ItemCode, Description, Qty, Cost, Amount, AccCode, BlkCode
```

#### B2. Mutasi per Blok/Department
```
ID:           INV-B2
Title:        Mutasi per Blok/Department
Title(EN):    Movement by Block/Department
Description:  Mengelompokkan transaksi stock berdasarkan blok/department
              (Boiler, Water Treatment, Kernel Plant, dll).
SQL Source:   IN_STOCKISSUELN
Priority:     HIGH
Business Impact: Cost allocation to departments
Tags:         ["mutasi","blok","department","cost center","boiler","wtp","kernel","allocation"]
Filters:      AccYear, AccMonth, BlkCode, AccCode, ItemCode
Columns:      BlkCode, TransactionCount, TotalQty, TotalAmount
```

#### B3. Pengeluaran Barang (Stock Issue)
```
ID:           INV-B3
Title:        Pengeluaran Barang
Title(EN):    Stock Issue Report
Description:  Laporan pengeluaran barang ke produksi/operasional.
              Includes vehicle code untuk tracking penggunaan alat.
SQL Source:   IN_STOCKISSUELN
Priority:     HIGH
Business Impact: Operational expense tracking
Tags:         ["pengeluaran","issue","keluar","pemakaian","produksi","operasional","vehicle"]
Filters:      AccYear, AccMonth, PostDateFrom, PostDateTo, VehCode, ItemCode, AccCode
Columns:      DocNo, PostDate, ItemCode, Description, Qty, Cost, Amount, VehCode, AccCode
```

#### B4. Transaksi Harian (Daily Transaction Log)
```
ID:           INV-B4
Title:        Transaksi Harian
Title(EN):    Daily Transaction Log
Description:  Log semua transaksi inventory per hari dengan aggregasi per jam.
              Berguna untuk audit trail dan tracking aktivitas.
SQL Source:   IN_STOCKISSUE + IN_MTHENDTRX
Priority:     MEDIUM
Business Impact: Audit and compliance
Tags:         ["harian","daily","log","transaksi","audit","trail","aktivitas"]
Filters:      PostDateFrom, PostDateTo, LocCode, ModuleCode
Columns:      TransactionDate, Hour, Module, DocCount, TotalAmount
```

---

### GROUP C: STOCK VALUATION (Valuasi Stok)

#### C1. Valuasi Bulanan (Monthly Valuation)
```
ID:           INV-C1
Title:        Valuasi Bulanan
Title(EN):    Monthly Stock Valuation
Description:  Valuasi stok bulanan per item dengan AverageCost dan TotalAmount.
              Digunakan untuk reporting keuangan bulanan.
SQL Source:   IN_MTHENDITEM
Priority:     HIGH
Business Impact: Monthly financial reporting
Tags:         ["valuasi","bulanan","bulan","monthly","financial","amount","cost"]
Filters:      AccYear, AccMonth, LocCode, ProdCatCode, ItemCode
Columns:      ItemCode, Description, Qty, AverageCost, Amount, LocCode
```

#### C2. Valuasi per Kategori (Valuation by Category)
```
ID:           INV-C2
Title:        Valuasi per Kategori
Title(EN):    Stock Valuation by Category
Description:  Roll-up valuasi stok berdasarkan kategori produk.
              Shows value distribution across categories.
SQL Source:   IN_MTHENDITEM + IN_ITEM + IN_PRODCAT
Priority:     MEDIUM
Business Impact: Category-level financial analysis
Tags:         ["valuasi","kategori","category","amount","distribution","financial"]
Filters:      AccYear, AccMonth, ProdCatCode, LocCode
Columns:      ProdCatCode, CategoryName, ItemCount, TotalQty, TotalAmount, PctOfTotal
```

#### C3. Perbandingan Bulan ke Bulan (MoM Comparison)
```
ID:           INV-C3
Title:        Perbandingan Bulan ke Bulan
Title(EN):    Month-over-Month Comparison
Description:  Membandingkan nilai dan kuantitas stok bulan ini vs bulan lalu.
              Shows trend indicators (up/down arrows).
SQL Source:   IN_MTHENDITEM
Priority:     HIGH
Business Impact: Trend analysis and anomaly detection
Tags:         ["comparison","bandingkan","bulan","month","mom","trend","naik","turun","vs"]
Filters:      AccYear, AccMonth, LocCode, ProdCatCode
Columns:      ItemCode, CurrQty, CurrAmount, PrevQty, PrevAmount, ChangeQty, ChangePct
```

#### C4. Analisis ABC (ABC Analysis)
```
ID:           INV-C4
Title:        Analisis ABC
Title(EN):    ABC Analysis
Description:  Klasifikasi item berdasarkan nilai (Pareto 80/20).
              Class A: top 20% items = 80% value. Priority for control.
SQL Source:   IN_ITEM + IN_MTHENDITEM
Priority:     HIGH
Business Impact: Inventory control prioritization — HIGH VALUE items need tight control
Tags:         ["abc","analysis","pareto","priority","nilai","klasifikasi","80/20","important"]
Filters:      LocCode, ProdCatCode, ClassOnly (A/B/C)
Columns:      ItemCode, Description, TotalValue, PctOfTotal, CumulativePct, ABCClass
```

---

### GROUP D: DEAD STOCK & SLOW MOVING

#### D1. Dead Stock >6 Bulan
```
ID:           INV-D1
Title:        Dead Stock lebih dari 6 Bulan
Title(EN):    Dead Stock >6 Months
Description:  Item yang tidak ada movement (tidak ada issue) selama lebih dari 6 bulan.
              Includes never-issued items (LastIssueDate = NULL or '1900-01-01').
SQL Source:   IN_ITEM
Priority:     HIGH
Business Impact: Identify obsolete inventory tying up capital
Tags:         ["dead stock","idle","tidak gerak","lama","obsolete","6 bulan","asset","modal"]
Filters:      ProdCatCode, ItemType, LocCode, MinValue
Columns:      ItemCode, Description, QtyOnHand, AverageCost, TotalValue, LastIssueDate, MonthsSinceIssue
```

#### D2. Dead Stock >12 Bulan
```
ID:           INV-D2
Title:        Dead Stock lebih dari 12 Bulan
Title(EN):    Dead Stock >12 Months
Description:  Item yang tidak ada movement selama lebih dari 12 bulan.
              Lebih критис untuk write-off decisions.
SQL Source:   IN_ITEM
Priority:     HIGH
Business Impact: Long-term obsolete inventory — write-off candidate
Tags:         ["dead stock","12 bulan","setahun","lama","obsolete","write off","hapus"]
Filters:      ProdCatCode, ItemType, MinValue
Columns:      ItemCode, Description, QtyOnHand, AverageCost, TotalValue, LastIssueDate, AgeMonths
```

#### D3. Zero Stock (Stok Habis)
```
ID:           INV-D3
Title:        Stok Zero / Habis
Title(EN):    Zero Stock / Out of Stock
Description:  Item dengan QtyOnHand = 0. These items need immediate reorder attention.
SQL Source:   IN_ITEM
Priority:     HIGH
Business Impact: Stock-out prevention
Tags:         ["zero","habis","kosong","out of stock","stok habis","empty","need reorder"]
Filters:      ProdCatCode, ItemType, LocCode
Columns:      ItemCode, Description, LastIssueDate, LastOrderDate, QtyOnOrder, ReOrderLevel
```

#### D4. Slow Moving Items (Item Gerak Lambat)
```
ID:           INV-D4
Title:        Slow Moving Items
Title(EN):    Slow Moving Items
Description:  Item dengan movement rendah (1-6 transaksi per 12 bulan) tapi bukan zero stock.
              Middle category between fast-moving dan dead stock.
SQL Source:   IN_ITEM + IN_STOCKISSUELN
Priority:     MEDIUM
Business Impact: Identify items at risk of becoming dead stock
Tags:         ["slow moving","gerak lambat","kurang aktif","low movement","risiko","perlahan"]
Filters:      ProdCatCode, TransactionRange (1-3, 4-6), MinValue
Columns:      ItemCode, Description, TransCount, LastIssueDate, QtyOnHand, TotalValue, RiskLevel
```

---

### GROUP E: REORDER & PLANNING

#### E1. Below Reorder Level (Di Bawah Minimum)
```
ID:           INV-E1
Title:        Below Reorder Level
Title(EN):    Below Reorder Level
Description:  Item yang QtyOnHand sudah di bawah ReOrderLevel.
              Trigger point untuk procurement.
SQL Source:   IN_ITEM
Priority:     CRITICAL
Business Impact: Procurement trigger — prevents stock-out
Tags:         ["reorder","minimum","below","below minimum","触发","procurement","purchase"]
Filters:      ProdCatCode, ItemType, LocCode
Columns:      ItemCode, Description, QtyOnHand, ReOrderLevel, Shortage, UOMCode, LatestCost
```

#### E2. Reorder Recommendation (Rekomendasi Reorder)
```
ID:           INV-E2
Title:        Rekomendasi Reorder
Title(EN):    Reorder Recommendation
Description:  Auto-calculate reorder quantity berdasarkan average usage dan lead time.
              Shows projected stock-out date dan recommended order qty.
SQL Source:   IN_ITEM + IN_STOCKISSUELN (historical)
Priority:     HIGH
Business Impact: Automated procurement planning
Tags:         ["reorder","recommendation","rekomendasi","order","beli","procurement","quantity"]
Filters:      ProdCatCode, LeadTime, MinMonthsOfStock
Columns:      ItemCode, Description, QtyOnHand, AvgMonthlyUsage, MonthsOfStock, RecommendedQty, EstimatedCost
```

#### E3. Items Never Ordered (Belum Pernah Dipesan)
```
ID:           INV-E3
Title:        Items Belum Pernah Dipesan
Title(EN):    Never Ordered Items
Description:  Item dengan LastOrderDate = NULL. Never purchased — check if still needed.
SQL Source:   IN_ITEM
Priority:     MEDIUM
Business Impact: Rationalize inventory catalog
Tags:         ["never ordered","belum pernah","tidak pernah","unused","catalog","cleanup"]
Filters:      ProdCatCode, ItemType, CreateDateFrom, CreateDateTo
Columns:      ItemCode, Description, CreateDate, QtyOnHand, AverageCost, TotalValue, Age
```

---

### GROUP F: FUEL (BBM)

#### F1. Penggunaan BBM per Kendaraan
```
ID:           INV-F1
Title:        Penggunaan BBM per Kendaraan
Title(EN):    Fuel Consumption by Vehicle
Description:  Total konsumsi BBM per kendaraan dalam periode tertentu.
              Includes vehicle type, hours, dan cost per liter.
SQL Source:   IN_FUELISSUE + IN_FUELISSUELN + GL_VEHICLE
Priority:     HIGH
Business Impact: Vehicle cost tracking and fuel efficiency
Tags:         ["bbm","bahan bakar","fuel","kendaraan","vehicle","diesel","solar","liter","konsumsi"]
Filters:      AccYear, AccMonth, PostDateFrom, PostDateTo, VehCode, AccCode
Columns:      VehCode, VehicleName, VehicleType, TotalLiters, TotalAmount, AvgCostPerLiter, LastTrans
```

#### F2. Penggunaan BBM per Department
```
ID:           INV-F2
Title:        Penggunaan BBM per Department
Title(EN):    Fuel Consumption by Department
Description:  Total konsumsi BBM per department/account code.
              Shows fuel allocation across operational units.
SQL Source:   IN_FUELISSUELN + GL_ACCOUNT
Priority:     HIGH
Business Impact: Department cost allocation
Tags:         ["bbm","department","cost center","allocation","fuel","account","boiler","wtp"]
Filters:      AccYear, AccMonth, AccCode, BlkCode
Columns:      AccCode, AccDescription, TotalLiters, TotalAmount, TransactionCount
```

#### F3. Return BBM (Fuel Return)
```
ID:           INV-F3
Title:        Return BBM
Title(EN):    Fuel Return Report
Description:  Laporan pengembalian BBM (fuel yang tidak terpakai dan dikembalikan).
SQL Source:   IN_FUELRTN + IN_FUELRTNLN
Priority:     LOW
Business Impact: Fuel loss tracking
Tags:         ["return","retur","bbm","fuel","kembali","loss","waste"]
Filters:      AccYear, AccMonth, PostDateFrom, PostDateTo
Columns:      DocNo, PostDate, ItemCode, VehCode, Qty, Amount, Remark
```

---

### GROUP G: PURCHASE REQUISITION

#### G1. Outstanding PR (PR Belum Terpenuhi)
```
ID:           INV-G1
Title:        Outstanding Purchase Requisition
Title(EN):    Outstanding Purchase Requisition
Description:  PR lines yang belum diterima sepenuhnya (QtyOutstanding > 0).
              Shows which items are pending delivery.
SQL Source:   IN_PRLN + IN_PR + IN_ITEM
Priority:     HIGH
Business Impact: Procurement tracking and follow-up
Tags:         ["pr","purchase requisition","outstanding","pending","belum","terpenuhi","delivery","supplier"]
Filters:      AccYear, AccMonth, PRStatus, ProdCatCode
Columns:      PRID, ItemCode, Description, QtyReq, QtyRcv, QtyOutstanding, Status, PRDate
```

#### G2. PR per Status
```
ID:           INV-G2
Title:        Purchase Requisition per Status
Title(EN):    PR by Status
Description:  Ringkasan PR berdasarkan status (1=New, 2=Pending, 3=Rejected, 4=Partial, 6=Complete).
              Shows procurement pipeline health.
SQL Source:   IN_PR + IN_PRLN
Priority:     MEDIUM
Business Impact: Procurement pipeline management
Tags:         ["pr","status","pipeline","pending","approved","rejected","complete","progress"]
Filters:      AccYear, AccMonth, PRType, CreateDateFrom, CreateDateTo
Columns:      Status, PRCount, TotalLines, OutstandingLines, TotalAmount
```

---

### GROUP H: ADJUSTMENT & TRANSACTION SUMMARY

#### H1. Stock Adjustment (Penyesuaian Stok)
```
ID:           INV-H1
Title:        Penyesuaian Stok
Title(EN):    Stock Adjustment Report
Description:  Laporan penyesuaian stok (selisih hasil stock opname vs sistem).
              Includes adjustment type dan reason.
SQL Source:   IN_STOCKADJ + IN_STOCKADJLN
Priority:     HIGH
Business Impact: Inventory accuracy and audit
Tags:         ["adjustment","penyesuaian","selisih","opname","difference","stock take","audit"]
Filters:      AccYear, AccMonth, AdjType, TransType, PostDateFrom, PostDateTo
Columns:      DocNo, PostDate, ItemCode, Description, OldQty, NewQty, Diff, Amount, Remark
```

#### H2. Stock Return (Retur Stok)
```
ID:           INV-H2
Title:        Retur Stok
Title(EN):    Stock Return Report
Description:  Laporan retur barang (barang yang dikembalikan ke gudang).
SQL Source:   IN_STOCKRTN + IN_STOCKRTNLN
Priority:     MEDIUM
Business Impact: Return tracking and supplier accountability
Tags:         ["return","retur","barang kembali","supplier","rma","exchange"]
Filters:      AccYear, AccMonth, PostDateFrom, PostDateTo
Columns:      DocNo, PostDate, ItemCode, Description, Qty, Amount, Remark
```

#### H3. Rekap Transaksi Bulanan (Monthly Transaction Summary)
```
ID:           INV-H3
Title:        Rekap Transaksi Bulanan
Title(EN):    Monthly Transaction Summary
Description:  Summary semua transaksi inventory per bulan: total issue, adjustment, 
              return dalam satu view. Shows inventory activity overview.
SQL Source:   IN_STOCKISSUE + IN_STOCKADJ + IN_STOCKRTN + IN_MTHENDTRX
Priority:     MEDIUM
Business Impact: High-level inventory activity dashboard
Tags:         ["rekap","summary","bulanan","monthly","overview","activity","total","overview"]
Filters:      AccYear, AccMonth, LocCode
Columns:      Month, IssueCount, IssueAmount, AdjCount, AdjAmount, ReturnCount, ReturnAmount, NetMovement
```

---

## 6. Semantic Search Design

### 6.1 Bilingual Tag Taxonomy

```typescript
const SEMANTIC_TAGS = {
  // Core concepts
  "stok": ["stock", "inventory", "persediaan", "barang", " gudang"],
  "nilai": ["value", "amount", "harga", "cost", "rupiah", "financial"],
  "mutasi": ["movement", "masuk", "keluar", "transaksi", "movement", "flow"],
  "dead stock": ["idle", "tidak aktif", "lama tidak gerak", "obsolete", "asset"],
  "zero stock": ["habis", "kosong", "out of stock", "stok habis", "empty"],
  
  // Actions
  "reorder": ["order", "beli", "purchase", "procurement", "minimum", "trigger"],
  "export": ["download", "excel", "pdf", "csv", "print"],
  "preview": ["lihat", "table", "chart", "preview"],
  "filter": ["cari", "sort", "group", "period", "tanggal"],
  
  // Item types
  "dead stock": ["idle", "tidak aktif", "lama tidak gerak", "obsolete", "asset"],
  "abc": ["pareto", "priority", "nilai", "80/20", "important", "klasifikasi"],
  "valuasi": ["bulanan", "bulan", "monthly", "financial", "amount", "cost"],
  
  // Transactions
  "pengeluaran": ["issue", "keluar", "pemakaian", "production", "operational"],
  "penerimaan": ["receive", "masuk", "supplier", "gr", "goods receipt"],
  "bbm": ["fuel", "diesel", "solar", "kendaraan", "vehicle", "liter"],
  
  // Time filters
  "harian": ["daily", "hari", "today", "day"],
  "bulanan": ["monthly", "bulan", "month", "periode"],
  "tahunan": ["yearly", "tahun", "annual", "year"],
  
  // Module
  "inventory": ["stok", "barang", "gudang", "warehouse", "inventory"],
  "payroll": ["gaji", "upah", "pay", "compensation", "payroll"],
  "absensi": ["hadir", "attendance", "kehadiran", "absence", "cuti"],
  "premi": ["bonus", "incentive", "premium", "lembur", "overtime"],
  "karyawan": ["employee", "staff", "personil", "HR"],
  "produktivitas": ["productivity", "panen", "TBS", "rendemen", "yield"],
  "estate": ["kebun", "estate", "divisi", "plantation", "unit"],
}

// Semantic query → report mapping
const SEMANTIC_MAP = {
  "barang yang lama ga dipake": ["INV-D1", "INV-D2"],
  "stok yang udah habis": ["INV-D3"],
  "nilai persediaan sekarang": ["INV-A4", "INV-C1"],
  "pengeluaran bbm per kendaraan": ["INV-F1"],
  "dead stock 1 tahun": ["INV-D2"],
  "apa aja yang perlu reorder": ["INV-E1", "INV-E2"],
  "movement barang bulan ini": ["INV-B1"],
  "harga rata-rata item": ["INV-A4", "INV-C1"],
  "item paling mahal": ["INV-C4"],
  "analisis abc": ["INV-C4"],
  "kendaraan paling boros bbm": ["INV-F1"],
  "pr yang belum datang": ["INV-G1"],
  "dead stock 6 bulan": ["INV-D1"],
  "perbandingan bulan ini vs lalu": ["INV-C3"],
  "slow moving": ["INV-D4"],
  "penyesuaian stok": ["INV-H1"],
  "retur barang": ["INV-H2"],
  "summary transaksi bulanan": ["INV-H3"],
}
```

### 6.2 Search Algorithm

```typescript
function semanticSearch(query: string, reports: ReportConfig[]): ReportConfig[] {
  const normalizedQuery = normalize(query.toLowerCase()); // remove accents, lowercase
  
  // Score each report
  const scored = reports.map(report => {
    let score = 0;
    
    // Direct title match
    if (report.title.toLowerCase().includes(normalizedQuery)) score += 10;
    if (report.titleEn.toLowerCase().includes(normalizedQuery)) score += 10;
    
    // Description match
    if (report.description.toLowerCase().includes(normalizedQuery)) score += 5;
    
    // Tag match (fuzzy)
    for (const tag of report.tags) {
      if (tag.includes(normalizedQuery) || normalizedQuery.includes(tag)) {
        score += 3;
      }
      // Fuzzy match with threshold
      if (levenshteinDistance(tag, normalizedQuery) <= 2) {
        score += 5;
      }
    }
    
    // Semantic map match
    for (const [semanticQuery, reportIds] of Object.entries(SEMANTIC_MAP)) {
      if (semanticQuery.includes(normalizedQuery) || normalizedQuery.includes(semanticQuery)) {
        if (reportIds.includes(report.id)) score += 8;
      }
    }
    
    return { report, score };
  });
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.report);
}
```

---

## 7. UI/UX Design Specification

### 7.1 Color Palette
```css
:root {
  /* Navy (Sidebar & Topbar) */
  --color-navy-900: #071426;
  --color-navy-800: #0B1D35;
  --color-navy-700: #102A4C;
  
  /* Green (Corporate Accent) */
  --color-green-700: #167A3A;
  --color-green-600: #1F8F46;
  --color-green-100: #EAF7EF;
  
  /* Gold (Highlight) */
  --color-gold-600: #D9A514;
  --color-gold-100: #FFF7DF;
  
  /* Module Colors */
  --color-blue-600: #2563EB;     /* Absensi */
  --color-purple-600: #7C3AED;  /* Payroll */
  --color-orange-600: #EA8A13;   /* Daftar Upah */
  --color-green-600: #16A34A;   /* Inventory */
  --color-red-600: #DC2626;      /* Premi & Lembur */
  --color-teal-600: #0D9488;    /* Produktivitas */
  --color-pink-600: #DB2777;     /* Karyawan */
  --color-indigo-600: #4F46E5;   /* Estate/Divisi */
  --color-gray-600: #475569;     /* Integrasi & Audit */
  
  /* Base */
  --color-bg: #F6F8FB;
  --color-card: #FFFFFF;
  --color-border: #E2E8F0;
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
}
```

### 7.2 Layout Specifications

**Sidebar**: 260px wide, dark navy (#071426), collapsible to 64px

**Topbar**: 64px height, dark navy (#0B1D35)

**Content**: 
- Max width: 1440px
- Padding: 24px
- Card border-radius: 16px (rounded-2xl)
- Card shadow: `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`
- Card border: 1px solid #E2E8F0

**Module Cards**: 
- Min height: 180px
- Grid: 4 columns on 1280px+, 3 columns on 1024px+, 2 columns on 768px+
- Hover: lift effect with shadow increase

### 7.3 Component List

| Component | Purpose |
|-----------|---------|
| AppShell | Main layout wrapper |
| Sidebar | Navigation sidebar (collapsible) |
| Topbar | Header with search, badges, profile |
| HeroBanner | Dashboard hero with system status |
| GlobalSearch | Ctrl+K search with semantic matching |
| FilterChips | Quick filter pills |
| ModuleCard | Windows-tile inspired module cards |
| ReportListItem | Individual report row/card |
| ReportPreviewPanel | Right-side preview with table/chart |
| ReportViewer | Full report page with filters |
| SummaryCard | KPI summary cards |
| ExportButtonGroup | Export Excel/PDF/CSV buttons |
| FavoriteButton | Star toggle for favorites |
| RecentReportsPanel | Last viewed reports |
| SystemInfoPanel | System status display |
| EmptyState | No results state |
| LoadingSkeleton | Loading placeholders |
| ErrorState | Error display |

---

## 8. Report Catalog Summary

| ID | Title | Group | Priority | SQL Source |
|----|-------|-------|----------|------------|
| INV-A1 | Ringkasan Stok per Gudang | Stock Overview | HIGH | IN_ITEM |
| INV-A2 | Ringkasan Stok per Kategori | Stock Overview | HIGH | IN_ITEM |
| INV-A3 | Ringkasan Stok per Tipe | Stock Overview | MEDIUM | IN_ITEM |
| INV-A4 | Nilai Persediaan | Stock Overview | HIGH | IN_MTHENDITEM |
| INV-B1 | Mutasi Barang | Transactions | HIGH | IN_STOCKISSUELN |
| INV-B2 | Mutasi per Blok/Dept | Transactions | HIGH | IN_STOCKISSUELN |
| INV-B3 | Pengeluaran Barang | Transactions | HIGH | IN_STOCKISSUELN |
| INV-B4 | Transaksi Harian | Transactions | MEDIUM | IN_STOCKISSUE |
| INV-C1 | Valuasi Bulanan | Valuation | HIGH | IN_MTHENDITEM |
| INV-C2 | Valuasi per Kategori | Valuation | MEDIUM | IN_MTHENDITEM |
| INV-C3 | Perbandingan Bulan ke Bulan | Valuation | HIGH | IN_MTHENDITEM |
| INV-C4 | Analisis ABC | Valuation | HIGH | IN_ITEM |
| INV-D1 | Dead Stock >6 Bulan | Dead Stock | HIGH | IN_ITEM |
| INV-D2 | Dead Stock >12 Bulan | Dead Stock | HIGH | IN_ITEM |
| INV-D3 | Zero Stock | Dead Stock | HIGH | IN_ITEM |
| INV-D4 | Slow Moving Items | Dead Stock | MEDIUM | IN_STOCKISSUELN |
| INV-E1 | Below Reorder Level | Reorder | CRITICAL | IN_ITEM |
| INV-E2 | Reorder Recommendation | Reorder | HIGH | IN_ITEM + IN_STOCKISSUELN |
| INV-E3 | Items Belum Pernah Dipesan | Reorder | MEDIUM | IN_ITEM |
| INV-F1 | BBM per Kendaraan | Fuel | HIGH | IN_FUELISSUELN |
| INV-F2 | BBM per Department | Fuel | HIGH | IN_FUELISSUELN |
| INV-F3 | Return BBM | Fuel | LOW | IN_FUELRTNLN |
| INV-G1 | Outstanding PR | Purchase Req | HIGH | IN_PRLN |
| INV-G2 | PR per Status | Purchase Req | MEDIUM | IN_PR |
| INV-H1 | Penyesuaian Stok | Adjustment | HIGH | IN_STOCKADJLN |
| INV-H2 | Retur Stok | Adjustment | MEDIUM | IN_STOCKRTNLN |
| INV-H3 | Rekap Transaksi Bulanan | Adjustment | MEDIUM | IN_STOCKISSUE |

**Total: 27 Inventory Reports**

---

## 9. Role-Based Access

| Report | Kerani | HR | Admin | Manager |
|--------|--------|-----|-------|---------|
| A1-A4 (Overview) | ✅ | ✅ | ✅ | ✅ |
| B1-B4 (Transactions) | ✅ | ❌ | ✅ | ✅ |
| C1-C4 (Valuation) | ❌ | ❌ | ✅ | ✅ |
| D1-D4 (Dead Stock) | ✅ | ❌ | ✅ | ✅ |
| E1-E3 (Reorder) | ✅ | ❌ | ✅ | ✅ |
| F1-F3 (Fuel) | ❌ | ❌ | ✅ | ✅ |
| G1-G2 (PR) | ❌ | ✅ | ✅ | ✅ |
| H1-H3 (Adjustment) | ❌ | ❌ | ✅ | ❌ |

---

## 10. Config-Driven Architecture

All 27 reports are defined as TypeScript configuration objects — NO hardcoded arrays:

```typescript
// lib/reports/inventory/config.ts
export const INVENTORY_REPORTS: Record<string, ReportConfig> = {
  'INV-A1': {
    id: 'INV-A1',
    title: 'Ringkasan Stok per Gudang',
    titleEn: 'Stock Summary by Location',
    description: 'Menampilkan total keseluruhan item...',
    group: 'Stock Overview',
    priority: 'HIGH',
    tags: ['stok', 'gudang', 'lokasi', 'persediaan', 'warehouse'],
    sqlSource: 'IN_ITEM',
    filters: [
      { name: 'LocCode', type: 'select', label: 'Lokasi/Gudang', options: [...] },
      { name: 'ProdCatCode', type: 'select', label: 'Kategori', options: [...] },
    ],
    columns: [
      { key: 'LocCode', label: 'Lokasi', sortable: true },
      { key: 'TotalItems', label: 'Total Item', sortable: true, numeric: true },
      { key: 'TotalQty', label: 'Total Qty', sortable: true, numeric: true },
      { key: 'TotalValue', label: 'Nilai (Rp)', sortable: true, numeric: true, format: 'currency' },
    ],
    defaultSort: { column: 'TotalValue', direction: 'desc' },
    permissions: ['kerani', 'hr', 'admin', 'manager'],
  },
  // ... all 27 reports
}

// UI renders from config — adding new report = add config object only
```

---

## 11. Data Quality Disclaimer

Reports that pull from `IN_MTHENDITEM` with future period data (2026-09) will show:
> ⚠️ *Data tersedia sampai periode September 2026. Data bukan real-time.*

Reports that show LastIssueDate = '1900-01-01' or NULL will display:
> *Belum pernahissue / Never Issued*

All percentage calculations that result in division by zero will show:
> *N/A* or *∞* with tooltip explanation.
