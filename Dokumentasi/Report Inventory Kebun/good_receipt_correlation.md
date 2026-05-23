# DOKUMENTASI GOOD RECEIPT — Korelasi Tabel db_ptrj
**Project:** Report Center — PT Rebinmas Jaya
**Tanggal:** 18 Mei 2026
**Database:** db_ptrj (SERVER_PROFILE_2, Estate)
**Author:** Hermes Agent (Claude Sonnet 4.6)
---

## 1. RINGKASAN
Laporan Good Receipt Listing P1A dibangun dari **6 tabel** yang saling berelasi.
Total data: **9,892** GR header, **45,183** baris item,
**105** supplier berbeda, rentang tanggal **2019-02-06** — **2026-05-18**.

**Kunci paling penting:**
Kolom `Cost` dan `Amount` TIDAK ada di `PU_GOODSRCVLN`. Untuk mendapatkannya,
HARUS JOIN ke `PU_POLN` via `POLnID`.

---
## 2. DIAGRAM KORELASI (ERD)

```
PU_SUPPLIER (referensi vendor)
  PK: SupplierCode
        |
PU_GOODSRCV (HEADER GR)
  PK: GoodsRcvID          <── 1 GR = 1 header
  FK: SupplierCode ────────┐
  POID                     │
  LocCode, Status          │
  TotalAmt, NetAmt         │
        │                  │
        ▼                  │
PU_GOODSRCVLN (LINE ITEM) ◄┘
  PK: GoodsRcvLnID
  FK: GoodsRcvID ──────────┘ (HEADER)
  FK: ItemCode ─────────────┐ (ke IN_ITEM)
  FK: POLnID ──────────────┤ (ke PU_POLN ← HARGA!
  ReceiveQty, AccCode       │
  ChargeTo, BlkCode        │
        │                  │
        ▼                  │
PU_POLN (HARGA PO) ◄────────┘
  PK: POLnID
  Cost, Amount, QtyOrder
  DiscAmt, TaxAmt, NetAmt

IN_ITEM (barang)
  PK: ItemCode ◄────────────┘
  FK: ProdTypeCode ──────────┐ (ke IN_PRODTYPE)
  UOMCode, ProdCatCode       │

IN_PRODTYPE (kategori)
  PK: ProdTypeCode ◄─────────┘
  Description
```

---
## 3. QUERY UTAMA — Good Receipt Listing P1A

```sql
SELECT
    h.GoodsRcvID                        AS [No. Good Receipt]
  , h.GoodsRcvRefNo                    AS [No. Referensi]
  , CONVERT(VARCHAR, h.GoodsRcvRefDate, 23) AS [Tgl. Referensi]
  , h.LocCode                          AS [Lokasi]
  , RTRIM(h.SupplierCode)              AS [Kode Supplier]
  , RTRIM(s.Name)                      AS [Nama Supplier]
  , h.POID                             AS [No. PO]
  , CASE h.Status
      WHEN '1' THEN 'Draft'
      WHEN '2' THEN 'Confirmed'
      WHEN '3' THEN 'Pending'
      WHEN '5' THEN 'Posted'
    END                                AS [Status]
  , l.GoodsRcvLnID                     AS [ID Line]
  , RTRIM(l.ItemCode)                  AS [Kode Barang]
  , RTRIM(i.Description)              AS [Nama Barang]
  , RTRIM(l.ReceiveUOM)                AS [Satuan]
  , l.ReceiveQty                       AS [Qty Diterima]
  , p.Cost                             AS [Harga Unit]    -- DARI PU_POLN!
  , p.Amount                           AS [Total]         -- DARI PU_POLN!
  , p.DiscAmt                          AS [Diskon]
  , p.TaxAmt                           AS [Pajak]
  , p.NetAmt                           AS [Net Amount]
  , RTRIM(i.ProdTypeCode)              AS [Tipe Produk]
  , RTRIM(pt.Description)              AS [Nama Tipe Produk]
  , RTRIM(i.ProdCatCode)               AS [Kategori]
  , RTRIM(l.AccCode)                  AS [Kode Akun]
  , RTRIM(l.ChargeTo)                  AS [Biaya Ke]
  , h.AccMonth                         AS [Bulan Akuntansi]
  , h.AccYear                          AS [Tahun Akuntansi]
FROM PU_GOODSRCVLN l
INNER JOIN PU_GOODSRCV h  ON l.GoodsRcvID  = h.GoodsRcvID
LEFT  JOIN PU_SUPPLIER s  ON RTRIM(h.SupplierCode) = RTRIM(s.SupplierCode)
LEFT  JOIN PU_POLN p      ON l.POLnID       = p.POLnID
LEFT  JOIN IN_ITEM i      ON RTRIM(l.ItemCode)     = RTRIM(i.ItemCode)
LEFT  JOIN IN_PRODTYPE pt ON RTRIM(i.ProdTypeCode) = RTRIM(pt.ProdTypeCode)
WHERE h.LocCode = 'P1A'
  -- Filter lain: date range, status, supplier, dll.
ORDER BY h.GoodsRcvRefDate DESC, h.GoodsRcvID
```

---
## 4. ATURAN PENTING — KESALAHAN UMUM

| # | Mistakes | Correction |
|---|----------|------------|
| 1 | `SELECT Cost FROM PU_GOODSRCVLN` | **SALAH** — Cost TIDAK ada di line! Harus dari `PU_POLN.Cost` via `POLnID` join |
| 2 | `LEFT JOIN PU_GOODSRCV` | Gunakan `INNER JOIN` — line tanpa header tidak punya makna |
| 3 | `SupplierCode` tanpa `RTRIM()` | Semua kode di database ini di-pad spaces kanan — SELALU RTRIM() |
| 4 | Filter `Status = '5'` | Status '5' = Posted (final). '2' = Confirmed. '3' = Pending. '1' = Draft |
| 5 | `GoodsRcvID` tanpa prefix | Format: `GCP1A` + YY (2 digit) + 6 digit. Contoh: `GCP1A26009896` |
| 6 | `POID` join langsung | POID ada di `PU_GOODSRCV` (header). Untuk harga, gunakan `POLnID` join |
| 7 | Join supplier tanpa RTRIM | `h.SupplierCode = s.SupplierCode` gagal karena padding. RTRIM di kedua sisi! |

---
## 5. REFERENSI KOLOM TIAP TABEL

### 5.1 PU_GOODSRCV — Header Good Receipt

| # | Nama Kolom | Tipe | Deskripsi |
|---|-----------|------|----------|
| 1 | `GoodsRcvID` | VARCHAR | PK. Format: GCP1AYYNNNNNN. P1A=Estate, HQ=HeadQuarter. Contoh: GCP1A26009896 |
| 2 | `GoodsRcvRefNo` | VARCHAR | Nomor referensi / surat jalan dari supplier |
| 3 | `GoodsRcvRefDate` | DATETIME | Tanggal referensi (tanggal barang diterima supplier) |
| 4 | `LocCode` | VARCHAR | Kode lokasi: P1A (Estate/Kebun), HQ (HeadQuarter/Pabrik) |
| 5 | `SupplierCode` | VARCHAR | Kode supplier — di-pad spaces kanan, selalu RTRIM() |
| 6 | `POID` | VARCHAR | No. Purchase Order. Format: 00/PRP/LOK/YY/M/XXXX. Contoh: 00/PRP/LOK/26/4/7694 |
| 7 | `Status` | CHAR | 1=Draft, 2=Confirmed, 3=Pending, 5=Posted |
| 8 | `AccMonth` | INT | Bulan periode akuntansi (1–12) |
| 9 | `AccYear` | INT | Tahun periode akuntansi |
| 10 | `TotalAmt` | DECIMAL | Total gross amount sebelum diskon & pajak |
| 11 | `DiscAmt` | DECIMAL | Total discount seluruh GR |
| 12 | `TaxAmt` | DECIMAL | Total pajak |
| 13 | `NetAmt` | DECIMAL | Total netto = TotalAmt - DiscAmt + TaxAmt |
| 14 | `GoodsRcvType` | VARCHAR | Tipe GR: Purchase, Return, Adjustment, dll. |
| 15 | `Remarks` | VARCHAR | Catatan/keterangan tambahan |
| 16 | `CreatedBy` | VARCHAR | User ID yang membuat record |
| 17 | `CreatedDate` | DATETIME | Tanggal dan waktu dibuat |
| 18 | `ModifiedBy` | VARCHAR | User ID terakhir yang modify |
| 19 | `ModifiedDate` | DATETIME | Tanggal modify terakhir |
| 20 | `ApprovedBy` | VARCHAR | User ID yang approve |
| 21 | `ApprovedDate` | DATETIME | Tanggal approve |

### 5.2 PU_GOODSRCVLN — Line Item Good Receipt

| # | Nama Kolom | Tipe | Deskripsi |
|---|-----------|------|----------|
| 1 | `GoodsRcvLnID` | VARCHAR | PK Line. ID unik per baris. Format: GCLP1A + YY + 6 digit |
| 2 | `GoodsRcvID` | VARCHAR | FK → PU_GOODSRCV.GoodsRcvID. Menghubungkan ke header GR |
| 3 | `ItemCode` | VARCHAR | Kode barang — di-pad spaces kanan, selalu RTRIM() |
| 4 | `ReceiveUOM` | VARCHAR | Satuan barang saat diterima |
| 5 | `ReceiveQty` | DECIMAL | Jumlah yang benar-benar diterima dari supplier |
| 6 | `ReturnQty` | DECIMAL | Jumlah yang diretur/dikembalikan ke supplier |
| 7 | `InvoiceQty` | DECIMAL | Jumlah yang tercantum di faktur supplier |
| 8 | `AccCode` | VARCHAR | Kode akun biaya / Cost Account (misal: CA2116) |
| 9 | `ChargeTo` | VARCHAR | Lokasi/biaya yang dibebani (misal: P1A) |
| 10 | `POLnID` | VARCHAR | FK → PU_POLN.POLnID. **DIGUNAKAN UNTUK MENDAPATKAN HARGA** |
| 11 | `FixedAssetCode` | VARCHAR | Kode aset tetap (jika barang adalah aset) |
| 12 | `BlkCode` | VARCHAR | Kode blok / divisi di Estate |
| 13 | `VehCode` | VARCHAR | Kode kendaraan pengantar |
| 14 | `Remarks` | VARCHAR | Catatan per line item |

**PERINGATAN:** Kolom `Cost` dan `Amount` TIDAK ada di tabel ini!
Untuk mendapatkannya, JOIN ke `PU_POLN` melalui `POLnID`:
```sql
LEFT JOIN PU_POLN p ON l.POLnID = p.POLnID
-- lalu ambil: p.Cost, p.Amount
```

### 5.3 PU_POLN — Purchase Order Line (Sumber Harga)

| # | Nama Kolom | Tipe | Deskripsi |
|---|-----------|------|----------|
| 1 | `POLnID` | VARCHAR | PK. ID baris PO. Format: NPOL + YY + 6 digit. Contoh: NPOL26044335 |
| 2 | `POLID` | VARCHAR | FK → PU_PO Header (header Purchase Order) |
| 3 | `ItemCode` | VARCHAR | Kode barang dalam PO |
| 4 | `UOMCode` | VARCHAR | Satuan PO |
| 5 | `QtyOrder` | DECIMAL | Jumlah yang dipesan (seharusnya ≥ ReceiveQty di GR) |
| 6 | `QtyDelv` | DECIMAL | Jumlah yang sudah delivered sampai saat ini |
| 7 | `Cost` | DECIMAL | **HARGA SATUAN** — ini yang dicari orang! |
| 8 | `Amount` | DECIMAL | Total = Cost × QtyOrder |
| 9 | `DiscAmt` | DECIMAL | Diskon per line |
| 10 | `TaxAmt` | DECIMAL | Pajak per line |
| 11 | `NetAmt` | DECIMAL | Net amount per line = Amount - DiscAmt + TaxAmt |

Contoh (NPOL26044335): Cost=65.000, Amount=130.000, QtyOrder=2

### 5.4 PU_SUPPLIER — Referensi Supplier/Vendor

| # | Nama Kolom | Tipe | Deskripsi |
|---|-----------|------|----------|
| 1 | `SupplierCode` | VARCHAR | PK. Kode supplier — di-pad spaces, SELALU RTRIM() |
| 2 | `Name` | VARCHAR | Nama lengkap supplier/vendor |
| 3 | `ContactPerson` | VARCHAR | Nama orang kontak di supplier |
| 4 | `PhoneNo` | VARCHAR | Nomor telepon |
| 5 | `FaxNo` | VARCHAR | Nomor fax |
| 6 | `Email` | VARCHAR | Alamat email |
| 7 | `Address` | VARCHAR | Alamat lengkap supplier |

Contoh: PT006 = TATA BANGUNAN

### 5.5 IN_ITEM — Referensi Barang/Item

| # | Nama Kolom | Tipe | Deskripsi |
|---|-----------|------|----------|
| 1 | `ItemCode` | VARCHAR | PK. Kode barang — di-pad spaces, SELALU RTRIM() |
| 2 | `Description` | VARCHAR | Nama/deskripsi barang |
| 3 | `UOMCode` | VARCHAR | Satuan barang (Unit of Measure) |
| 4 | `ProdTypeCode` | VARCHAR | FK → IN_PRODTYPE.ProdTypeCode. Kategori besar barang |
| 5 | `ProdCatCode` | VARCHAR | Kode kategori produk / Cost Account (misal: CA2116) |
| 6 | `ReorderLevel` | DECIMAL | Level minimum untuk reorder (stok) |
| 7 | `MaxLevel` | DECIMAL | Level maximum (stok) |
| 8 | `MinLevel` | DECIMAL | Level minimum (stok) |
| 9 | `AvgCost` | DECIMAL | Average/historical cost barang |
| 10 | `LastCost` | DECIMAL | Harga terakhir kali beli |
| 11 | `ItemType` | VARCHAR | Tipe item: Inventory, Non-Inventory, Service, dll. |

Contoh: INV050 = METERAN 10 METER, ProdTypeCode=INVTR, ProdCatCode=CA2116

### 5.6 IN_PRODTYPE — Kategori / Tipe Produk

| # | Nama Kolom | Tipe | Deskripsi |
|---|-----------|------|----------|
| 1 | `ProdTypeCode` | VARCHAR | PK. Kode tipe produk. Contoh: INVTR, PUPUK, PSTDA |
| 2 | `Description` | VARCHAR | Nama lengkap tipe produk |
| 3 | `ParentCode` | VARCHAR | Kode parent jika ada hierarki tipe produk |

Contoh kode umum di Estate:
- `INVTR` = INVENTARIS PERUMAHAN & KANTOR
- `PUPUK` = PUPUK
- `PSTDA` = PESTISIDA
- `PMKBN` = BAHAN DAN MATERIAL KEBUN
- `BBMIN` = BAHAN BAKAR MINYAK
- `PLMS` = OLI AND GREASSE
- `SCUMS` = SUKU CADANG UMUM MESIN-MESIN
- `KLAIN` = SUKU CADANG UMUM KENDARAAN & ALAT BERAT
- `KNSTR` = BAHAN KONSTRUKSI/PABRIK/BANGUNAN
- `ETRIK` = BARANG ELEKTRIK & WATER

---
## 6. KODE STATUS Good Receipt

| Status | Nama | Arti | Count (P1A) |
|--------|------|------|------------|
| '1' | Draft | — | 0 |
| '2' | Confirmed | — | 51 |
| '3' | Pending | — | 55 |
| '5' | Posted | — | 9,786 |

**Untuk laporan operasional:** Filter `Status = '5'` (Posted) agar hanya GR yang sudah final.

---
## 7. KODE TIPE PRODUK LENGKAP (IN_PRODTYPE) — 44 Tipe

| Kode | Nama Tipe Produk |
|------|----------------|
| `ABKEL` | BAHAN DAN ALAT BENGKEL |
| `AKTVA` | AKTIVA |
| `ANGAN` | SANDANG PANGAN |
| `BBMIN` | BAHAN BAKAR MINYAK |
| `BDZER` | SUKU CADANG BULDOZER |
| `BMTARIS` | BAHAN DAN MATERIAL PERAWATAN INVENTARIS |
| `BVBUS` | SUKU CADANG BOX VAN / MINI BUS |
| `COMPOS` | BAHAN BAHAN COMPOS |
| `CPTOR` | SUKU CADANG COMPACTOR |
| `DDCER` | SUKU CADANG DONDY DITCHER |
| `ETRIK` | BARANG ELEKTRIK & WATER |
| `EXTOR` | SUKU CADANG EXCAVATOR |
| `GENSET` | SUKU CADANG GENSET |
| `GRDER` | SUKU CADANG GRADER |
| `INVTR` | INVENTARIS PERUMAHAN & KANTOR |
| `ISPOK3` | PERLENGKAPAK ISPO & K3 |
| `ITPNG` | ITEM PENAMPUNG |
| `JEPUP` | SUKU CADANG JEEP / PICKUP |
| `KACNG` | KACANGAN |
| `KDAIR` | SUKU CADANG KENDARAAN AIR |
| `KEDOK` | OBAT & ALAT KEDOKTERAN |
| `KEMAN` | KESEHATAN DAN KEAMANAN |
| `KIMIA` | BAHAN KIMIA |
| `KLAIN` | SUKU CADANG UMUM KENDARAAN & ALAT BERAT |
| `KNSTR` | BAHAN KONSTRUKSI/PABRIK/BANGUNAN |
| `LABOR` | PERALATAN LABORATORIUM |
| `LODER` | SUKU CADANG  BECHO LOADER |
| `PERKEB` | PERALATAN KEBERSIHAN |
| `PLMS` | OLI AND GREASSE |
| `PMKBN` | BAHAN DAN MATERIAL KEBUN |
| `PPKAN` | PERLENGKAPAN & PERALATAN KANTOR |
| `PSTDA` | PESTISIDA |
| `PUPUK` | PUPUK |
| `ROBIN` | SUKU CADANG MESIN ROBIN, MESIN POTONG RUMPUT & CHAINSHOW |
| `SCMSN` | SUKU CADANG MESIN PABRIK |
| `SCUMS` | SUKU CADANG UMUM MESIN-MESIN |
| `SEPAN` | ALAT SEMPROT DAN PANEN |
| `SPTOR` | SUKU CADANG SEPEDA MOTOR |
| `SUND` | SUNDRY STORE |
| `TLBCH` | SUKU CADANG TLB |
| `TRLER` | SUKU CADANG TRAILER |
| `TRTOR` | SUKU CADANG TRAKTOR |
| `TRUCK` | SUKU CADANG TRUCK |
| `VIBRO` | SUKU CADANG VIBRO |

---
## 8. STATISTIK DATABASE (P1A)

| Metric | Value |
|--------|-------|
| Total GR Header | 9,892 |
| Total GR Line Items | 45,183 |
| Total Supplier berbeda | 105 |
| Rentang Tanggal GR | 2019-02-06 s/d 2026-05-18 |

**Top 3 Supplier (P1A):**
| Kode | Nama | Jumlah GR |
|------|------|-----------|
| `ST005` | TOKO DIRGANTARA | 1,137 |
| `ST041` | TOKO MAJU MAKMUR | 956 |
| `ST009` | TOKO MITRA JAYA MAKMUR | 872 |

---
## 9. SAMPLE RECORD — GCP1A26009896

```
Header (PU_GOODSRCV):
  GoodsRcvID      : GCP1A26009896
  GoodsRcvRefNo   : 17
  GoodsRcvRefDate : 2026-05-05
  LocCode         : P1A (Estate Kebun)
  SupplierCode    : PT006
  Supplier Name   : TATA BANGUNAN
  POID            : 00/PRP/LOK/26/4/7694
  Status          : 2 (Confirmed)
  AccMonth/Year   : 2 / 2027

Line (PU_GOODSRCVLN):
  GoodsRcvLnID    : GCLP1A26045440
  ItemCode        : INV050
  Item Name       : METERAN 10 METER
  ReceiveUOM      : PCS
  ReceiveQty      : 2
  AccCode         : CA2116
  ChargeTo        : P1A
  POLnID          : NPOL26044335   <-- JOIN KE SINI UNTUK HARGA!

Harga (from PU_POLN via POLnID):
  Cost            : Rp 65.000
  Amount          : Rp 130.000  (2 × 65.000)
  QtyOrder        : 2

Item Info (from IN_ITEM + IN_PRODTYPE):
  ProdTypeCode    : INVTR
  ProdTypeDesc    : INVENTARIS PERUMAHAN & KANTOR
  ProdCatCode     : CA2116
  UOMCode         : PCS
```

---
## 10. BAGAIMANA GOOD RECEIPT DIHASILKAN — ALUR LENGKAP

```
1. ESTATE memesan barang ke SUPPLIER via PO
   └── PU_POLN (PO Line): ItemCode, QtyOrder, Cost, Amount
       └── Cost dan Amount ditentukan saat PO dibuat

2. SUPPLIER mengirim barang ke Estate
   └── GR dicatat oleh Estate:
       ├── PU_GOODSRCV (Header): No. GR, Tgl, Supplier, PO ID, Lokasi
       └── PU_GOODSRCVLN (Line): Item, Qty Diterima, POLnID (link ke harga!)

3. GR di-Confirmed / Posted (Status='2' atau '5')
   └── Qty di-GR harus ≤ Qty di-PO (QtyOrder)
   └── AccCode dan ChargeTo menentukan biaya dibebani ke mana

4. Setelah Posted (Status='5'):
   └── GR menjadi dasar untuk:
       ├── Update Stok (IN_STOCKRECEIVE)
       ├── Akuntansi Biaya (AccCode, ChargeTo)
       └── Laporan Good Receipt Listing P1A ← REPORT INI
```

---
## 11. QUERY REKAPITULASI

### 11.1 Rekap per Supplier (P1A, Posted)

```sql
SELECT
    RTRIM(h.SupplierCode)              AS [Kode]
  , RTRIM(s.Name)                      AS [Supplier]
  , COUNT(DISTINCT h.GoodsRcvID)      AS [Jumlah GR]
  , SUM(l.ReceiveQty)                  AS [Total Qty]
  , SUM(p.Amount)                      AS [Total Nilai]
  , COUNT(DISTINCT RTRIM(l.ItemCode))   AS [Item Berbeda]
FROM PU_GOODSRCVLN l
INNER JOIN PU_GOODSRCV h ON l.GoodsRcvID = h.GoodsRcvID
LEFT  JOIN PU_SUPPLIER s ON RTRIM(h.SupplierCode) = RTRIM(s.SupplierCode)
LEFT  JOIN PU_POLN p     ON l.POLnID = p.POLnID
WHERE h.LocCode = 'P1A'
  AND h.Status = '5'
GROUP BY RTRIM(h.SupplierCode), RTRIM(s.Name)
ORDER BY SUM(p.Amount) DESC
```

### 11.2 Rekap per Tipe Produk (P1A, Posted)

```sql
SELECT
    RTRIM(i.ProdTypeCode)              AS [Kode Tipe]
  , RTRIM(pt.Description)              AS [Nama Tipe]
  , COUNT(DISTINCT h.GoodsRcvID)        AS [Jumlah GR]
  , SUM(l.ReceiveQty)                   AS [Total Qty]
  , SUM(p.Amount)                       AS [Total Nilai]
  , COUNT(DISTINCT RTRIM(l.ItemCode))    AS [Item Berbeda]
FROM PU_GOODSRCVLN l
INNER JOIN PU_GOODSRCV h ON l.GoodsRcvID = h.GoodsRcvID
LEFT  JOIN IN_ITEM i     ON RTRIM(l.ItemCode)     = RTRIM(i.ItemCode)
LEFT  JOIN IN_PRODTYPE pt ON RTRIM(i.ProdTypeCode) = RTRIM(pt.ProdTypeCode)
LEFT  JOIN PU_POLN p     ON l.POLnID = p.POLnID
WHERE h.LocCode = 'P1A'
  AND h.Status = '5'
GROUP BY RTRIM(i.ProdTypeCode), RTRIM(pt.Description)
ORDER BY SUM(p.Amount) DESC
```

### 11.3 Detail Item per GR

```sql
SELECT
    h.GoodsRcvID
  , h.GoodsRcvRefDate
  , RTRIM(l.ItemCode)      AS Item
  , RTRIM(i.Description)   AS NamaBarang
  , l.ReceiveQty
  , p.Cost
  , p.Amount
  , RTRIM(i.ProdTypeCode)  AS Tipe
FROM PU_GOODSRCVLN l
INNER JOIN PU_GOODSRCV h ON l.GoodsRcvID = h.GoodsRcvID
LEFT  JOIN PU_POLN p     ON l.POLnID = p.POLnID
LEFT  JOIN IN_ITEM i     ON RTRIM(l.ItemCode) = RTRIM(i.ItemCode)
WHERE h.GoodsRcvID = 'GCP1A26009896'
ORDER BY l.GoodsRcvLnID
```

---
## 12. KOLOM LENGKAP (依法治)

### PU_SUPPLIER columns:
- `SupplierCode`
- `Name`
- `ContactPerson`
- `Address`
- `Town`
- `PostCode`
- `CountryCode`
- `TelNo`
- `FaxNo`
- `Email`
- `FinAccCode`
- `AccCode`
- `CreditTerm`
- `TermType`
- `CreditLimit`
- `BankCode`
- `BankAccName`
- `BankAccNo`
- `Status`
- `CreateDate`
- `UpdateDate`
- `UpdateID`
- `SuppType`
- `TermCond`
- `MobileTel`
- `Currency`
- `ComRegisterNum`
- `SuppBRN`
- `SuppGSTNo`
- `DateGST`
- `TaxCode`
- `FinSupplierCode`
- `IsEnabledSelfBilled`
- `RMCDApproveNo`
- `RMCDAgreementPeriodFrom`
- `RMCDAgreementPeriodTo`
- `InvoiceRunningNo`
- `Address2`
- `Address3`
- `Address4`
- `State`
- `DefaultTaxCode1`
- `DefaultTaxCode2`
- `LoginPassword`
- `TINNo`
- `SSTNo`
- `MSICCOde`
- `eInvRegType`
- `NeedToPayTenderFee`
- `EInvIsConsol`

### IN_ITEM columns:
- `ItemCode`
- `LocCode`
- `Description`
- `Bin`
- `ItemType`
- `ProdTypeCode`
- `ProdCatCode`
- `FuelTypeInd`
- `ProdBrandCode`
- `ProdModelCode`
- `ProdMatCode`
- `StockAnalysisCode`
- `ExpenseCode`
- `ActCode`
- `UOMCode`
- `PurchaseUOM`
- `FuelMeterReading`
- `ReOrderLevel`
- `QtyOnHand`
- `QtyOnHold`
- `QtyOnOrder`
- `QtyReOrder`
- `InitialCost`
- `HighCost`
- `LowCost`
- `AverageCost`
- `LatestCost`
- `DiffAverageCost`
- `ClosingBal`
- `ClosingAvrgCost`
- `ClosingDiffAvrgCost`
- `PurchaseAccNo`
- `IssueAccNo`
- `UsePrice`
- `SellFixedPrice`
- `SellLatestCost`
- `SellAverageCost`
- `Remark`
- `Status`
- `LastOrderDate`
- `LastIssueDate`
- `CreateDate`
- `UpdateDate`
- `UpdateID`
- `SMInd`
- `ExDateReq`
- `NUInd`
- `TaxCode`
- `SuppTaxCode`
- `DefaultTaxCode2`
- `DefaultSuppTaxCode2`
- `ExtSellFixedPrice`
- `ExtSellLatestCost`
- `ExtSellAverageCost`

---
*Generated: 18 Mei 2026 — Hermes Agent (Claude Sonnet 4.6) for PT Rebinmas Jaya*
*Data: db_ptrj SERVER_PROFILE_2 — SQL Gateway localhost:8001*
