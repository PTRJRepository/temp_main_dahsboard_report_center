# SQL Queries — Inventory Module (27 Reports)
**Production-Ready SQL for PT Rebinmas Jaya Report Center**
**Database:** db_ptrj_mill on SERVER_PROFILE_1
**IMPORTANT:** All queries are READ-ONLY. CUD DILARANG.

---

## SQL Coding Standards

```sql
-- ALWAYS use RTRIM() for char column comparisons
WHERE RTRIM(Status) = '1'

-- ALWAYS use ISNULL() for nullable numerics
SUM(ISNULL(Qty, 0))

-- Handle '1900-01-01' as never issued (same as NULL)
WHERE LastIssueDate IS NULL
   OR LastIssueDate < '1990-01-01'

-- Division by zero protection
CASE 
  WHEN ISNULL(Denominator, 0) = 0 THEN 0 
  ELSE Numerator / NULLIF(Denominator, 0)
END

-- Pagination: ALWAYS use OFFSET/FETCH
ORDER BY SomeColumn
OFFSET (@Page - 1) * @PageSize ROWS
FETCH NEXT @PageSize ROWS ONLY

-- Count for pagination
SELECT COUNT(*) OVER() AS TotalRows
```

---

## GROUP A: STOCK OVERVIEW

### A1. Ringkasan Stok per Gudang

```sql
-- ============================================
-- A1: Ringkasan Stok per Gudang
-- Menampilkan ringkasan stok barang per lokasi gudang
-- Source: IN_ITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_A1_StockSummaryByLocation]
    @LocCode VARCHAR(20) = NULL,       -- NULL = all locations
    @ProdCatCode VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    -- Main query
    SELECT 
        RTRIM(i.LocCode) AS LocCode,
        COUNT(DISTINCT i.ItemCode) AS TotalItems,
        SUM(ISNULL(i.QtyOnHand, 0)) AS TotalQty,
        SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0)) AS TotalValue,
        SUM(CASE WHEN ISNULL(i.QtyOnHand, 0) < ISNULL(i.ReOrderLevel, 0) THEN 1 ELSE 0 END) AS BelowReorderCount,
        SUM(CASE WHEN ISNULL(i.QtyOnHand, 0) = 0 THEN 1 ELSE 0 END) AS ZeroStockCount,
        SUM(CASE 
            WHEN i.LastIssueDate IS NULL OR i.LastIssueDate < '1990-01-01' THEN 1 
            WHEN i.LastIssueDate < DATEADD(MONTH, -6, GETDATE()) THEN 1 
            ELSE 0 
        END) AS DeadStockCount,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND (@LocCode IS NULL OR RTRIM(i.LocCode) = @LocCode)
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
    GROUP BY RTRIM(i.LocCode)
    ORDER BY TotalValue DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
    
    -- Summary totals (for header cards)
    SELECT 
        SUM(TotalItems) AS GrandTotalItems,
        SUM(TotalQty) AS GrandTotalQty,
        SUM(TotalValue) AS GrandTotalValue
    FROM (
        SELECT 
            COUNT(DISTINCT i.ItemCode) AS TotalItems,
            SUM(ISNULL(i.QtyOnHand, 0)) AS TotalQty,
            SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0)) AS TotalValue
        FROM IN_ITEM i
        WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
          AND (@LocCode IS NULL OR RTRIM(i.LocCode) = @LocCode)
          AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
        GROUP BY RTRIM(i.LocCode)
    ) AS LocationSummary;
END;
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| @LocCode | varchar | NULL | Filter by location (NULL=all) |
| @ProdCatCode | varchar | NULL | Filter by category (NULL=all) |
| @Page | int | 1 | Page number |
| @PageSize | int | 20 | Rows per page (max 100) |

**Columns:**
| Column | Type | Description |
|--------|------|-------------|
| LocCode | varchar | Location/warehouse code |
| TotalItems | int | Number of distinct items |
| TotalQty | decimal | Sum of all quantities |
| TotalValue | decimal | Sum of QtyOnHand × AverageCost |
| BelowReorderCount | int | Items below reorder level |
| ZeroStockCount | int | Items with zero stock |
| DeadStockCount | int | Items with no movement >6mo |

**Performance:** Index on `IN_ITEM(Status, LocCode, ProdCatCode)` recommended.

---

### A2. Ringkasan Stok per Kategori

```sql
-- ============================================
-- A2: Ringkasan Stok per Kategori
-- Distribution item dan nilai berdasarkan kategori produk
-- Source: IN_ITEM + IN_PRODCAT
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_A2_StockSummaryByCategory]
    @ProdCatCode VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        RTRIM(ISNULL(c.CatName, 'Uncategorized')) AS CategoryName,
        COUNT(DISTINCT i.ItemCode) AS ItemCount,
        SUM(ISNULL(i.QtyOnHand, 0)) AS TotalQty,
        SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0)) AS TotalValue,
        COUNT(*) OVER() AS TotalRows,
        -- Percentage of total inventory value
        CASE 
            WHEN SUM(SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0))) OVER() = 0 THEN 0
            ELSE (SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0)) * 100.0) 
                 / SUM(SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0))) OVER()
        END AS PctOfTotalValue
    FROM IN_ITEM i
    LEFT JOIN IN_PRODCAT c ON RTRIM(i.ProdCatCode) = RTRIM(c.CatCode)
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
    GROUP BY RTRIM(ISNULL(i.ProdCatCode, '-')), RTRIM(ISNULL(c.CatName, 'Uncategorized'))
    ORDER BY TotalValue DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### A3. Ringkasan Stok per Tipe Item

```sql
-- ============================================
-- A3: Ringkasan Stok per Tipe Item
-- Distribution berdasarkan item type (1=Stock, 2=Non-Stock, dll)
-- Source: IN_ITEM + IN_PRODTYPE
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_A3_StockSummaryByType]
    @ItemType VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        RTRIM(i.ItemType) AS ItemType,
        RTRIM(ISNULL(t.TypeName, 'Unknown')) AS TypeName,
        COUNT(DISTINCT i.ItemCode) AS ItemCount,
        SUM(ISNULL(i.QtyOnHand, 0)) AS TotalQty,
        SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0)) AS TotalValue,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    LEFT JOIN IN_PRODTYPE t ON RTRIM(i.ItemType) = RTRIM(t.TypeCode)
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND (@ItemType IS NULL OR RTRIM(i.ItemType) = @ItemType)
    GROUP BY RTRIM(i.ItemType), RTRIM(ISNULL(t.TypeName, 'Unknown'))
    ORDER BY TotalValue DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### A4. Nilai Persediaan Summary

```sql
-- ============================================
-- A4: Nilai Persediaan Summary
-- Total nilai persediaan dari IN_MTHENDITEM (current period)
-- Source: IN_MTHENDITEM + IN_ITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_A4_StockValuationSummary]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @LocCode VARCHAR(20) = NULL,
    @ProdCatCode VARCHAR(10) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;  -- Longer for large table
    
    -- Get latest available period if not specified
    DECLARE @Year VARCHAR(4) = @AccYear;
    DECLARE @Month VARCHAR(2) = @AccMonth;
    
    IF @Year IS NULL OR @Month IS NULL
    BEGIN
        SELECT TOP 1 
            @Year = AccYear, 
            @Month = AccMonth
        FROM IN_MTHENDITEM
        GROUP BY AccYear, AccMonth 
        ORDER BY CAST(AccYear AS INT) DESC, CAST(AccMonth AS INT) DESC;
    END;
    
    -- Main valuation summary
    SELECT 
        @Year + '-' + @Month AS Period,
        COUNT(DISTINCT m.ItemCode) AS ItemCount,
        SUM(ISNULL(m.Qty, 0)) AS TotalQty,
        SUM(ISNULL(m.Amount, 0)) AS TotalAmount,
        AVG(ISNULL(m.AverageCost, 0)) AS AvgCost,
        -- Filter to future period warning
        CASE 
            WHEN (CAST(@Year AS INT) * 100 + CAST(@Month AS INT)) > 
                 (YEAR(GETDATE()) * 100 + MONTH(GETDATE())) 
            THEN 1 ELSE 0 
        END AS IsFuturePeriod
    FROM IN_MTHENDITEM m
    WHERE m.AccYear = @Year AND m.AccMonth = @Month
      AND (@LocCode IS NULL OR RTRIM(m.LocCode) = @LocCode);
    
    -- Month-over-Month comparison
    DECLARE @PrevMonth VARCHAR(2) = @Month;
    DECLARE @PrevYear VARCHAR(4) = @Year;
    
    IF CAST(@Month AS INT) = 1
    BEGIN
        SET @PrevMonth = '12';
        SET @PrevYear = CAST(CAST(@Year AS INT) - 1 AS VARCHAR(4));
    END
    ELSE
    BEGIN
        SET @PrevMonth = RIGHT('0' + CAST(CAST(@Month AS INT) - 1 AS VARCHAR(2)), 2);
    END;
    
    SELECT 
        @PrevYear + '-' + @PrevMonth AS PrevPeriod,
        SUM(ISNULL(m.Amount, 0)) AS PrevAmount
    FROM IN_MTHENDITEM m
    WHERE m.AccYear = @PrevYear AND m.AccMonth = @PrevMonth
      AND (@LocCode IS NULL OR RTRIM(m.LocCode) = @LocCode);
    
    -- Top 10 items by value this period
    SELECT TOP 10
        m.ItemCode,
        RTRIM(ISNULL(i.Description, m.ItemCode)) AS ItemName,
        m.Qty,
        m.AverageCost,
        m.Amount AS TotalValue,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode
    FROM IN_MTHENDITEM m
    LEFT JOIN IN_ITEM i ON m.ItemCode = i.ItemCode
    WHERE m.AccYear = @Year AND m.AccMonth = @Month
    ORDER BY m.Amount DESC;
END;
```

---

## GROUP B: STOCK TRANSACTIONS

### B1. Mutasi Barang (Stock Movement)

```sql
-- ============================================
-- B1: Mutasi Barang
-- Laporan mutasi barang masuk dan keluar per periode
-- Source: IN_STOCKISSUE + IN_STOCKISSUELN
-- NOTE: AccCode in line is DEPT code, NOT GL_ACCOUNT
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_B1_StockMovement]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @PostDateFrom DATETIME = NULL,
    @PostDateTo DATETIME = NULL,
    @ItemCode VARCHAR(20) = NULL,
    @BlkCode VARCHAR(20) = NULL,
    @AccCode VARCHAR(20) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        h.DocNo,
        h.PostDate,
        l.ItemCode,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
        l.Qty,
        l.Cost,
        l.Amount,
        RTRIM(l.AccCode) AS AccCode,          -- Dept code
        RTRIM(l.BlkCode) AS BlkCode,          -- Block code
        RTRIM(l.VehCode) AS VehCode,
        RTRIM(h.Status) AS Status,
        COUNT(*) OVER() AS TotalRows
    FROM IN_STOCKISSUELN l
    INNER JOIN IN_STOCKISSUE h ON l.DocNo = h.DocNo
    LEFT JOIN IN_ITEM i ON l.ItemCode = i.ItemCode
    WHERE 1=1
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@PostDateFrom IS NULL OR h.PostDate >= @PostDateFrom)
      AND (@PostDateTo IS NULL OR h.PostDate <= @PostDateTo)
      AND (@ItemCode IS NULL OR l.ItemCode = @ItemCode)
      AND (@BlkCode IS NULL OR RTRIM(l.BlkCode) = @BlkCode)
      AND (@AccCode IS NULL OR RTRIM(l.AccCode) = @AccCode)
      AND h.PostDate >= '2019-01-01'  -- Exclude invalid dates
    ORDER BY h.PostDate DESC, h.DocNo
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### B2. Mutasi per Blok/Department

```sql
-- ============================================
-- B2: Mutasi per Blok/Department
-- Aggregasi transaksi berdasarkan blok/department
-- Source: IN_STOCKISSUELN (AccCode = dept code)
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_B2_MovementByBlock]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @BlkCode VARCHAR(20) = NULL,
    @AccCode VARCHAR(20) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        RTRIM(l.BlkCode) AS BlkCode,
        RTRIM(l.AccCode) AS AccCode,
        COUNT(*) AS TransactionCount,
        SUM(ISNULL(l.Qty, 0)) AS TotalQty,
        SUM(ISNULL(l.Amount, 0)) AS TotalAmount,
        SUM(ISNULL(l.Amount, 0)) / NULLIF(SUM(ISNULL(l.Qty, 0)), 0) AS AvgCostPerUnit,
        COUNT(DISTINCT l.ItemCode) AS UniqueItems,
        COUNT(*) OVER() AS TotalRows
    FROM IN_STOCKISSUELN l
    INNER JOIN IN_STOCKISSUE h ON l.DocNo = h.DocNo
    WHERE 1=1
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@BlkCode IS NULL OR RTRIM(l.BlkCode) = @BlkCode)
      AND (@AccCode IS NULL OR RTRIM(l.AccCode) = @AccCode)
      AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0
      AND h.PostDate >= '2019-01-01'
    GROUP BY RTRIM(l.BlkCode), RTRIM(l.AccCode)
    HAVING SUM(ISNULL(l.Amount, 0)) > 0
    ORDER BY TotalAmount DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### B3. Pengeluaran Barang (Stock Issue)

```sql
-- ============================================
-- B3: Pengeluaran Barang
-- Detail pengeluaran barang ke produksi/operasional
-- Includes vehicle code untuk tracking alat
-- Source: IN_STOCKISSUE + IN_STOCKISSUELN
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_B3_StockIssue]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @PostDateFrom DATETIME = NULL,
    @PostDateTo DATETIME = NULL,
    @VehCode VARCHAR(20) = NULL,
    @ItemCode VARCHAR(20) = NULL,
    @AccCode VARCHAR(20) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        h.DocNo,
        h.PostDate,
        l.ItemCode,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
        RTRIM(i.ProdCatCode) AS ProdCatCode,
        l.Qty,
        l.Cost,
        l.Amount,
        RTRIM(l.VehCode) AS VehCode,
        RTRIM(l.AccCode) AS AccCode,
        RTRIM(l.BlkCode) AS BlkCode,
        RTRIM(h.Status) AS Status,
        h.Remark,
        COUNT(*) OVER() AS TotalRows
    FROM IN_STOCKISSUELN l
    INNER JOIN IN_STOCKISSUE h ON l.DocNo = h.DocNo
    LEFT JOIN IN_ITEM i ON l.ItemCode = i.ItemCode
    WHERE 1=1
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@PostDateFrom IS NULL OR h.PostDate >= @PostDateFrom)
      AND (@PostDateTo IS NULL OR h.PostDate <= @PostDateTo)
      AND (@VehCode IS NULL OR RTRIM(l.VehCode) = @VehCode)
      AND (@ItemCode IS NULL OR l.ItemCode = @ItemCode)
      AND (@AccCode IS NULL OR RTRIM(l.AccCode) = @AccCode)
      AND h.PostDate >= '2019-01-01'
    ORDER BY h.PostDate DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
    
    -- Summary totals
    SELECT 
        SUM(ISNULL(l.Qty, 0)) AS GrandTotalQty,
        SUM(ISNULL(l.Amount, 0)) AS GrandTotalAmount,
        COUNT(DISTINCT h.DocNo) AS TotalDocs,
        COUNT(DISTINCT l.ItemCode) AS TotalItems
    FROM IN_STOCKISSUELN l
    INNER JOIN IN_STOCKISSUE h ON l.DocNo = h.DocNo
    WHERE (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@PostDateFrom IS NULL OR h.PostDate >= @PostDateFrom)
      AND (@PostDateTo IS NULL OR h.PostDate <= @PostDateTo)
      AND (@VehCode IS NULL OR RTRIM(l.VehCode) = @VehCode)
      AND (@ItemCode IS NULL OR l.ItemCode = @ItemCode)
      AND (@AccCode IS NULL OR RTRIM(l.AccCode) = @AccCode)
      AND h.PostDate >= '2019-01-01';
END;
```

---

### B4. Transaksi Harian (Daily Transaction Log)

```sql
-- ============================================
-- B4: Transaksi Harian
-- Log transaksi inventory per hari dengan aggregasi per jam
-- Source: IN_STOCKISSUE + IN_MTHENDTRX
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_B4_DailyTransactionLog]
    @PostDateFrom DATETIME = NULL,
    @PostDateTo DATETIME = NULL,
    @LocCode VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    -- Default to last 7 days if no dates specified
    IF @PostDateFrom IS NULL
        SET @PostDateFrom = DATEADD(DAY, -7, CAST(GETDATE() AS DATE));
    IF @PostDateTo IS NULL
        SET @PostDateTo = CAST(GETDATE() AS DATE);
    
    SELECT 
        CAST(h.PostDate AS DATE) AS TransactionDate,
        DATEPART(HOUR, h.PostDate) AS HourOfDay,
        COUNT(DISTINCT h.DocNo) AS DocCount,
        SUM(ISNULL(h.TotalAmount, 0)) AS TotalAmount,
        COUNT(DISTINCT l.ItemCode) AS UniqueItems,
        COUNT(*) AS LineCount
    FROM IN_STOCKISSUE h
    LEFT JOIN IN_STOCKISSUELN l ON h.DocNo = l.DocNo
    WHERE h.PostDate BETWEEN @PostDateFrom AND DATEADD(DAY, 1, @PostDateTo)
      AND (@LocCode IS NULL OR RTRIM(h.LocCode) = @LocCode)
      AND h.PostDate >= '2019-01-01'
    GROUP BY CAST(h.PostDate AS DATE), DATEPART(HOUR, h.PostDate)
    ORDER BY TransactionDate DESC, HourOfDay;
END;
```

---

## GROUP C: STOCK VALUATION

### C1. Valuasi Bulanan (Monthly Valuation)

```sql
-- ============================================
-- C1: Valuasi Bulanan
-- Valuasi stok bulanan per item dengan AverageCost
-- Source: IN_MTHENDITEM
-- WARNING: Future period (2026-09) exists - show disclaimer
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_C1_MonthlyValuation]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @LocCode VARCHAR(20) = NULL,
    @ProdCatCode VARCHAR(10) = NULL,
    @ItemCode VARCHAR(20) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    -- Get latest period if not specified
    IF @AccYear IS NULL OR @AccMonth IS NULL
    BEGIN
        SELECT TOP 1 
            @AccYear = AccYear, 
            @AccMonth = AccMonth
        FROM IN_MTHENDITEM
        GROUP BY AccYear, AccMonth 
        ORDER BY CAST(AccYear AS INT) DESC, CAST(AccMonth AS INT) DESC;
    END;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    -- Check if future period
    DECLARE @IsFuture BIT = 0;
    IF (CAST(@AccYear AS INT) * 100 + CAST(@AccMonth AS INT)) > 
       (YEAR(GETDATE()) * 100 + MONTH(GETDATE()))
        SET @IsFuture = 1;
    
    SELECT 
        m.ItemCode,
        RTRIM(ISNULL(i.Description, m.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        RTRIM(ISNULL(i.UOMCode, 'UNIT')) AS UOMCode,
        m.LocCode,
        m.AccYear + '-' + m.AccMonth AS Period,
        m.Qty,
        m.AverageCost,
        m.Amount,
        @IsFuture AS IsFuturePeriod,
        COUNT(*) OVER() AS TotalRows
    FROM IN_MTHENDITEM m
    LEFT JOIN IN_ITEM i ON m.ItemCode = i.ItemCode
    WHERE m.AccYear = @AccYear 
      AND m.AccMonth = @AccMonth
      AND (@LocCode IS NULL OR RTRIM(m.LocCode) = @LocCode)
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
      AND (@ItemCode IS NULL OR m.ItemCode = @ItemCode)
    ORDER BY m.Amount DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### C2. Valuasi per Kategori

```sql
-- ============================================
-- C2: Valuasi per Kategori
-- Roll-up valuasi berdasarkan kategori produk
-- Source: IN_MTHENDITEM + IN_ITEM + IN_PRODCAT
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_C2_ValuationByCategory]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @LocCode VARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    -- Get latest period if not specified
    IF @AccYear IS NULL OR @AccMonth IS NULL
    BEGIN
        SELECT TOP 1 
            @AccYear = AccYear, 
            @AccMonth = AccMonth
        FROM IN_MTHENDITEM
        GROUP BY AccYear, AccMonth 
        ORDER BY CAST(AccYear AS INT) DESC, CAST(AccMonth AS INT) DESC;
    END;
    
    -- Get grand total for percentage calculation
    DECLARE @GrandTotal DECIMAL(18,2);
    SELECT @GrandTotal = SUM(ISNULL(Amount, 0))
    FROM IN_MTHENDITEM m
    WHERE m.AccYear = @AccYear AND m.AccMonth = @AccMonth
      AND (@LocCode IS NULL OR RTRIM(m.LocCode) = @LocCode);
    
    SELECT 
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        RTRIM(ISNULL(c.CatName, 'Uncategorized')) AS CategoryName,
        COUNT(DISTINCT m.ItemCode) AS ItemCount,
        SUM(ISNULL(m.Qty, 0)) AS TotalQty,
        SUM(ISNULL(m.Amount, 0)) AS TotalAmount,
        CASE WHEN @GrandTotal = 0 THEN 0 
             ELSE (SUM(ISNULL(m.Amount, 0)) * 100.0) / @GrandTotal 
        END AS PctOfTotal,
        @AccYear + '-' + @AccMonth AS Period
    FROM IN_MTHENDITEM m
    LEFT JOIN IN_ITEM i ON m.ItemCode = i.ItemCode
    LEFT JOIN IN_PRODCAT c ON RTRIM(i.ProdCatCode) = RTRIM(c.CatCode)
    WHERE m.AccYear = @AccYear AND m.AccMonth = @AccMonth
      AND (@LocCode IS NULL OR RTRIM(m.LocCode) = @LocCode)
    GROUP BY RTRIM(ISNULL(i.ProdCatCode, '-')), RTRIM(ISNULL(c.CatName, 'Uncategorized'))
    ORDER BY TotalAmount DESC;
END;
```

---

### C3. Perbandingan Bulan ke Bulan (MoM Comparison)

```sql
-- ============================================
-- C3: Perbandingan Bulan ke Bulan
-- Compare stock value this month vs last month
-- Source: IN_MTHENDITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_C3_MonthOverMonth]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @LocCode VARCHAR(20) = NULL,
    @ProdCatCode VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 90000;  -- Heavy query
    
    -- Get latest period if not specified
    IF @AccYear IS NULL OR @AccMonth IS NULL
    BEGIN
        SELECT TOP 1 
            @AccYear = AccYear, 
            @AccMonth = AccMonth
        FROM IN_MTHENDITEM
        GROUP BY AccYear, AccMonth 
        ORDER BY CAST(AccYear AS INT) DESC, CAST(AccMonth AS INT) DESC;
    END;
    
    -- Calculate previous period
    DECLARE @PrevMonth VARCHAR(2) = @Month;
    DECLARE @PrevYear VARCHAR(4) = @AccYear;
    
    IF CAST(@AccMonth AS INT) = 1
    BEGIN
        SET @PrevMonth = '12';
        SET @PrevYear = CAST(CAST(@AccYear AS INT) - 1 AS VARCHAR(4));
    END
    ELSE
    BEGIN
        SET @PrevMonth = RIGHT('0' + CAST(CAST(@AccMonth AS INT) - 1 AS VARCHAR(2)), 2);
    END;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        curr.ItemCode,
        RTRIM(ISNULL(i.Description, curr.ItemCode)) AS ItemName,
        curr.Qty AS CurrQty,
        curr.Amount AS CurrAmount,
        prev.Qty AS PrevQty,
        prev.Amount AS PrevAmount,
        curr.Qty - ISNULL(prev.Qty, 0) AS ChangeQty,
        curr.Amount - ISNULL(prev.Amount, 0) AS ChangeAmount,
        CASE 
            WHEN ISNULL(prev.Amount, 0) = 0 THEN 100 
            ELSE ((curr.Amount - ISNULL(prev.Amount, 0)) * 100.0) / ISNULL(prev.Amount, 0)
        END AS ChangePct,
        CASE 
            WHEN curr.Amount > ISNULL(prev.Amount, 0) THEN 'UP'
            WHEN curr.Amount < ISNULL(prev.Amount, 0) THEN 'DOWN'
            ELSE 'FLAT'
        END AS Trend,
        COUNT(*) OVER() AS TotalRows
    FROM IN_MTHENDITEM curr
    LEFT JOIN IN_MTHENDITEM prev ON curr.ItemCode = prev.ItemCode 
        AND prev.AccYear = @PrevYear AND prev.AccMonth = @PrevMonth
    LEFT JOIN IN_ITEM i ON curr.ItemCode = i.ItemCode
    WHERE curr.AccYear = @AccYear AND curr.AccMonth = @AccMonth
      AND (@LocCode IS NULL OR RTRIM(curr.LocCode) = @LocCode)
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
    ORDER BY ChangeAmount DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### C4. Analisis ABC (ABC Analysis)

```sql
-- ============================================
-- C4: Analisis ABC
-- Pareto analysis: A=top 20% items = 80% value
-- Source: IN_ITEM + IN_MTHENDITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_C4_ABCAnalysis]
    @LocCode VARCHAR(20) = NULL,
    @ProdCatCode VARCHAR(10) = NULL,
    @ClassOnly CHAR(1) = NULL,  -- 'A', 'B', 'C', or NULL for all
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 90000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    -- Get latest period for valuation
    DECLARE @Year VARCHAR(4), @Month VARCHAR(2);
    SELECT TOP 1 @Year = AccYear, @Month = AccMonth
    FROM IN_MTHENDITEM
    GROUP BY AccYear, AccMonth 
    ORDER BY CAST(AccYear AS INT) DESC, CAST(AccMonth AS INT) DESC;
    
    -- Get grand total
    DECLARE @GrandTotal DECIMAL(18,2);
    SELECT @GrandTotal = SUM(ISNULL(m.Amount, 0))
    FROM IN_MTHENDITEM m
    LEFT JOIN IN_ITEM i ON m.ItemCode = i.ItemCode
    WHERE m.AccYear = @Year AND m.AccMonth = @Month
      AND (@LocCode IS NULL OR RTRIM(m.LocCode) = @LocCode)
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode);
    
    IF @GrandTotal IS NULL OR @GrandTotal = 0
    BEGIN
        -- Fallback to IN_ITEM if no MTHEND data
        SELECT @GrandTotal = SUM(ISNULL(QtyOnHand, 0) * ISNULL(AverageCost, 0))
        FROM IN_ITEM
        WHERE RTRIM(ISNULL(Status, '0')) = '1'
          AND (@LocCode IS NULL OR RTRIM(LocCode) = @LocCode)
          AND (@ProdCatCode IS NULL OR RTRIM(ProdCatCode) = @ProdCatCode);
    END;
    
    -- ABC classification query
    WITH ItemValue AS (
        SELECT 
            i.ItemCode,
            RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
            RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
            i.QtyOnHand,
            i.AverageCost,
            i.QtyOnHand * i.AverageCost AS TotalValue,
            i.UOMCode
        FROM IN_ITEM i
        WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
          AND ISNULL(i.QtyOnHand, 0) > 0 AND ISNULL(i.AverageCost, 0) > 0
          AND (@LocCode IS NULL OR RTRIM(i.LocCode) = @LocCode)
          AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
    ),
    Ranked AS (
        SELECT 
            *,
            TotalValue * 100.0 / NULLIF(@GrandTotal, 0) AS PctOfTotal,
            SUM(TotalValue) OVER (ORDER BY TotalValue DESC) AS CumulativeValue,
            ROW_NUMBER() OVER (ORDER BY TotalValue DESC) AS RowNum,
            COUNT(*) OVER() AS TotalItems
        FROM ItemValue
    )
    SELECT 
        ItemCode,
        ItemName,
        ProdCatCode,
        QtyOnHand,
        AverageCost,
        TotalValue,
        PctOfTotal,
        CumulativeValue * 100.0 / NULLIF(@GrandTotal, 0) AS CumulativePct,
        CASE 
            WHEN (RowNum * 100.0) / NULLIF(TotalItems, 0) <= 20 THEN 'A'
            WHEN (RowNum * 100.0) / NULLIF(TotalItems, 0) <= 80 THEN 'B'
            ELSE 'C'
        END AS ABCClass,
        UOMCode,
        COUNT(*) OVER() AS TotalRows
    FROM Ranked
    WHERE @ClassOnly IS NULL OR ABCClass = @ClassOnly
    ORDER BY TotalValue DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

## GROUP D: DEAD STOCK

### D1. Dead Stock >6 Bulan

```sql
-- ============================================
-- D1: Dead Stock >6 Bulan
-- Item tidak ada movement lebih dari 6 bulan
-- Includes never-issued (LastIssueDate = NULL or '1900-01-01')
-- Source: IN_ITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_D1_DeadStock6Mo]
    @ProdCatCode VARCHAR(10) = NULL,
    @ItemType VARCHAR(10) = NULL,
    @MinValue DECIMAL(18,2) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    DECLARE @CutoffDate DATETIME = DATEADD(MONTH, -6, GETDATE());
    
    SELECT 
        i.ItemCode,
        RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        RTRIM(ISNULL(i.UOMCode, 'UNIT')) AS UOMCode,
        i.QtyOnHand,
        i.AverageCost,
        i.QtyOnHand * i.AverageCost AS TotalValue,
        i.LastIssueDate,
        CASE 
            WHEN i.LastIssueDate IS NULL THEN 'Never Issued'
            WHEN i.LastIssueDate < '1990-01-01' THEN 'Never Issued'
            ELSE CAST(DATEDIFF(DAY, i.LastIssueDate, GETDATE()) / 30 AS VARCHAR(10)) + ' months'
        END AS MonthsSinceIssue,
        i.ReOrderLevel,
        i.LocCode,
        i.CreateDate,
        CASE 
            WHEN i.LastIssueDate IS NULL OR i.LastIssueDate < '1990-01-01' THEN 1
            WHEN i.LastIssueDate < @CutoffDate THEN 1
            ELSE 0
        END AS IsDeadStock,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND (
          i.LastIssueDate IS NULL 
          OR i.LastIssueDate < '1990-01-01'
          OR i.LastIssueDate < @CutoffDate
      )
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
      AND (@ItemType IS NULL OR RTRIM(i.ItemType) = @ItemType)
      AND (@MinValue IS NULL OR (i.QtyOnHand * i.AverageCost) >= @MinValue)
    ORDER BY (i.QtyOnHand * i.AverageCost) DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
    
    -- Summary
    SELECT 
        COUNT(*) AS TotalDeadItems,
        SUM(ISNULL(i.QtyOnHand, 0) * ISNULL(i.AverageCost, 0)) AS TotalDeadValue
    FROM IN_ITEM i
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND (i.LastIssueDate IS NULL OR i.LastIssueDate < '1990-01-01' OR i.LastIssueDate < @CutoffDate)
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode);
END;
```

---

### D2. Dead Stock >12 Bulan

```sql
-- Same as D1 but with @CutoffDate = DATEADD(MONTH, -12, GETDATE())
-- More critical for write-off decisions
```

### D3. Zero Stock (Stok Habis)

```sql
-- ============================================
-- D3: Zero Stock / Stok Habis
-- Item dengan QtyOnHand = 0
-- Source: IN_ITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_D3_ZeroStock]
    @ProdCatCode VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        i.ItemCode,
        RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        i.QtyOnHand,
        i.QtyOnOrder,
        i.ReOrderLevel,
        i.LastIssueDate,
        i.LastOrderDate,
        i.AverageCost,
        i.LatestCost,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND ISNULL(i.QtyOnHand, 0) = 0
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
    ORDER BY i.ItemCode
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### D4. Slow Moving Items

```sql
-- ============================================
-- D4: Slow Moving Items
-- Item dengan movement rendah (1-6 transaksi per 12 bulan)
-- Source: IN_ITEM + IN_STOCKISSUELN
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_D4_SlowMoving]
    @ProdCatCode VARCHAR(10) = NULL,
    @MinTrans INT = 1,
    @MaxTrans INT = 6,
    @MinValue DECIMAL(18,2) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    DECLARE @CutoffDate DATETIME = DATEADD(MONTH, -12, GETDATE());
    
    -- Get transaction counts per item in last 12 months
    WITH TransCount AS (
        SELECT 
            l.ItemCode,
            COUNT(*) AS TransCount,
            MAX(h.PostDate) AS LastIssueDate
        FROM IN_STOCKISSUELN l
        INNER JOIN IN_STOCKISSUE h ON l.DocNo = h.DocNo
        WHERE h.PostDate >= @CutoffDate
        GROUP BY l.ItemCode
        HAVING COUNT(*) BETWEEN @MinTrans AND @MaxTrans
    )
    SELECT 
        i.ItemCode,
        RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        i.QtyOnHand,
        i.AverageCost,
        i.QtyOnHand * i.AverageCost AS TotalValue,
        tc.TransCount,
        tc.LastIssueDate,
        DATEDIFF(DAY, tc.LastIssueDate, GETDATE()) / 30 AS MonthsSinceLastIssue,
        CASE 
            WHEN tc.TransCount <= 3 THEN 'HIGH RISK'
            ELSE 'MEDIUM RISK'
        END AS RiskLevel,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    INNER JOIN TransCount tc ON i.ItemCode = tc.ItemCode
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND ISNULL(i.QtyOnHand, 0) > 0
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
      AND (@MinValue IS NULL OR (i.QtyOnHand * i.AverageCost) >= @MinValue)
    ORDER BY RiskLevel, tc.TransCount ASC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

## GROUP E: REORDER

### E1. Below Reorder Level

```sql
-- ============================================
-- E1: Below Reorder Level
-- Item yang QtyOnHand < ReOrderLevel
-- Source: IN_ITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_E1_BelowReorderLevel]
    @ProdCatCode VARCHAR(10) = NULL,
    @ItemType VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        i.ItemCode,
        RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        RTRIM(ISNULL(i.UOMCode, 'UNIT')) AS UOMCode,
        i.QtyOnHand,
        i.ReOrderLevel,
        i.ReOrderLevel - i.QtyOnHand AS Shortage,
        CASE 
            WHEN ISNULL(i.ReOrderLevel, 0) = 0 THEN 0
            ELSE (i.QtyOnHand * 100.0) / i.ReOrderLevel
        END AS PctOfReorderLevel,
        i.AverageCost,
        i.LatestCost,
        i.QtyOnOrder,
        i.LastIssueDate,
        i.LastOrderDate,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND ISNULL(i.QtyOnHand, 0) < ISNULL(i.ReOrderLevel, 0)
      AND ISNULL(i.ReOrderLevel, 0) > 0
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
      AND (@ItemType IS NULL OR RTRIM(i.ItemType) = @ItemType)
    ORDER BY Shortage DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### E2. Reorder Recommendation

```sql
-- ============================================
-- E2: Reorder Recommendation
-- Auto-calculate reorder qty based on avg usage + lead time
-- Source: IN_ITEM + IN_STOCKISSUELN (12 month history)
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_E2_ReorderRecommendation]
    @ProdCatCode VARCHAR(10) = NULL,
    @LeadTimeDays INT = 30,  -- Default lead time in days
    @MinMonthsOfStock INT = 1,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 90000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    DECLARE @CutoffDate DATETIME = DATEADD(MONTH, -12, GETDATE());
    
    -- Calculate average monthly usage per item
    ;WITH AvgUsage AS (
        SELECT 
            l.ItemCode,
            SUM(ISNULL(l.Qty, 0)) / 12.0 AS AvgMonthlyUsage
        FROM IN_STOCKISSUELN l
        INNER JOIN IN_STOCKISSUE h ON l.DocNo = h.DocNo
        WHERE h.PostDate >= @CutoffDate
        GROUP BY l.ItemCode
    )
    SELECT 
        i.ItemCode,
        RTRIM(ISNULL(i.Description, i.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        i.QtyOnHand,
        ISNULL(a.AvgMonthlyUsage, 0) AS AvgMonthlyUsage,
        CASE 
            WHEN ISNULL(a.AvgMonthlyUsage, 0) = 0 THEN 999
            ELSE i.QtyOnHand / NULLIF(a.AvgMonthlyUsage, 0)
        END AS MonthsOfStock,
        ISNULL(a.AvgMonthlyUsage, 0) * @LeadTimeDays / 30.0 AS UsageDuringLeadTime,
        CASE 
            WHEN ISNULL(a.AvgMonthlyUsage, 0) = 0 THEN 0
            ELSE (ISNULL(a.AvgMonthlyUsage, 0) * (@MinMonthsOfStock + (@LeadTimeDays / 30.0))) - i.QtyOnHand
        END AS RecommendedQty,
        CASE 
            WHEN ISNULL(a.AvgMonthlyUsage, 0) = 0 THEN 0
            ELSE ((ISNULL(a.AvgMonthlyUsage, 0) * (@MinMonthsOfStock + (@LeadTimeDays / 30.0))) - i.QtyOnHand) * i.LatestCost
        END AS EstimatedOrderCost,
        CASE 
            WHEN ISNULL(a.AvgMonthlyUsage, 0) = 0 THEN 'NO USAGE DATA'
            WHEN (i.QtyOnHand / NULLIF(a.AvgMonthlyUsage, 0)) <= 1 THEN 'URGENT'
            WHEN (i.QtyOnHand / NULLIF(a.AvgMonthlyUsage, 0)) <= @MinMonthsOfStock THEN 'REORDER NOW'
            ELSE 'OK'
        END AS ReorderStatus,
        i.ReOrderLevel,
        i.LatestCost,
        i.UOMCode,
        COUNT(*) OVER() AS TotalRows
    FROM IN_ITEM i
    LEFT JOIN AvgUsage a ON i.ItemCode = a.ItemCode
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND ISNULL(i.QtyOnHand, 0) > 0
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
      AND (
          ISNULL(a.AvgMonthlyUsage, 0) = 0 
          OR (i.QtyOnHand / NULLIF(a.AvgMonthlyUsage, 0)) <= @MinMonthsOfStock
      )
    ORDER BY 
        CASE ReorderStatus 
            WHEN 'URGENT' THEN 1 
            WHEN 'REORDER NOW' THEN 2 
            ELSE 3 
        END,
        RecommendedQty DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

## GROUP F: FUEL

### F1. Penggunaan BBM per Kendaraan

```sql
-- ============================================
-- F1: Penggunaan BBM per Kendaraan
-- Total konsumsi BBM per kendaraan
-- Source: IN_FUELISSUE + IN_FUELISSUELN + GL_VEHICLE
-- NOTE: VehCode is in LINE table, NOT header!
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_F1_FuelByVehicle]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @PostDateFrom DATETIME = NULL,
    @PostDateTo DATETIME = NULL,
    @VehCode VARCHAR(20) = NULL,
    @AccCode VARCHAR(20) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        RTRIM(l.VehCode) AS VehCode,
        RTRIM(ISNULL(v.VehName, RTRIM(l.VehCode))) AS VehicleName,
        RTRIM(ISNULL(v.VehTypeCode, '-')) AS VehicleType,
        COUNT(*) AS TransCount,
        SUM(ISNULL(l.Qty, 0)) AS TotalLiters,
        SUM(ISNULL(l.Amount, 0)) AS TotalAmount,
        SUM(ISNULL(l.Amount, 0)) / NULLIF(SUM(ISNULL(l.Qty, 0)), 0) AS AvgCostPerLiter,
        MAX(h.PostDate) AS LastTransDate,
        COUNT(DISTINCT l.ItemCode) AS FuelTypesUsed,
        COUNT(*) OVER() AS TotalRows
    FROM IN_FUELISSUELN l
    INNER JOIN IN_FUELISSUE h ON l.DocNo = h.DocNo
    LEFT JOIN GL_VEHICLE v ON RTRIM(l.VehCode) = RTRIM(v.VehCode)
    WHERE 1=1
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@PostDateFrom IS NULL OR h.PostDate >= @PostDateFrom)
      AND (@PostDateTo IS NULL OR h.PostDate <= @PostDateTo)
      AND (@VehCode IS NULL OR RTRIM(l.VehCode) = @VehCode)
      AND (@AccCode IS NULL OR RTRIM(l.AccCode) = @AccCode)
      AND LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0
    GROUP BY RTRIM(l.VehCode), RTRIM(ISNULL(v.VehName, RTRIM(l.VehCode))), RTRIM(ISNULL(v.VehTypeCode, '-'))
    ORDER BY TotalLiters DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

### F2. Penggunaan BBM per Department

```sql
-- ============================================
-- F2: Penggunaan BBM per Department
-- Total BBM per department/acccode
-- Source: IN_FUELISSUELN + GL_ACCOUNT
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_F2_FuelByDepartment]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @AccCode VARCHAR(20) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        RTRIM(l.AccCode) AS AccCode,
        RTRIM(ISNULL(g.Description, RTRIM(l.AccCode))) AS AccDescription,
        COUNT(*) AS TransCount,
        SUM(ISNULL(l.Qty, 0)) AS TotalLiters,
        SUM(ISNULL(l.Amount, 0)) AS TotalAmount,
        SUM(ISNULL(l.Amount, 0)) / NULLIF(SUM(ISNULL(l.Qty, 0)), 0) AS AvgCostPerLiter,
        COUNT(DISTINCT l.VehCode) AS VehicleCount,
        COUNT(*) OVER() AS TotalRows
    FROM IN_FUELISSUELN l
    INNER JOIN IN_FUELISSUE h ON l.DocNo = h.DocNo
    LEFT JOIN GL_ACCOUNT g ON RTRIM(l.AccCode) = RTRIM(g.AccountCode)
    WHERE 1=1
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@AccCode IS NULL OR RTRIM(l.AccCode) = @AccCode)
      AND LEN(RTRIM(ISNULL(l.AccCode, ''))) > 0
    GROUP BY RTRIM(l.AccCode), RTRIM(ISNULL(g.Description, RTRIM(l.AccCode)))
    ORDER BY TotalLiters DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

## GROUP G: PURCHASE REQUISITION

### G1. Outstanding PR

```sql
-- ============================================
-- G1: Outstanding Purchase Requisition
-- PR lines with QtyOutstanding > 0
-- Source: IN_PRLN + IN_PR + IN_ITEM
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_G1_OutstandingPR]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @PRStatus VARCHAR(10) = NULL,
    @ProdCatCode VARCHAR(10) = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 60000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        h.PRID,
        h.PRDate,
        l.ItemCode,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemName,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS ProdCatCode,
        l.QtyReq,
        l.QtyRcv,
        l.QtyOutstanding,
        CASE 
            WHEN ISNULL(l.QtyReq, 0) = 0 THEN 0
            ELSE (l.QtyOutstanding * 100.0) / l.QtyReq
        END AS PctOutstanding,
        RTRIM(h.Status) AS PRStatus,
        RTRIM(h.PRType) AS PRType,
        h.CreateDate,
        h.Remark,
        COUNT(*) OVER() AS TotalRows
    FROM IN_PRLN l
    INNER JOIN IN_PR h ON l.StockIssueLNID LIKE h.PRID + '%'
    LEFT JOIN IN_ITEM i ON l.ItemCode = i.ItemCode
    WHERE ISNULL(l.QtyOutstanding, 0) > 0
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@PRStatus IS NULL OR RTRIM(h.Status) = @PRStatus)
      AND (@ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = @ProdCatCode)
    ORDER BY l.QtyOutstanding DESC, h.PRDate DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
    
    -- Summary
    SELECT 
        COUNT(DISTINCT h.PRID) AS TotalOutstandingPRs,
        SUM(ISNULL(l.QtyOutstanding, 0)) AS TotalOutstandingQty,
        COUNT(l.StockIssueLNID) AS OutstandingLines
    FROM IN_PRLN l
    INNER JOIN IN_PR h ON l.StockIssueLNID LIKE h.PRID + '%'
    WHERE ISNULL(l.QtyOutstanding, 0) > 0;
END;
```

---

### G2. PR per Status

```sql
-- ============================================
-- G2: PR per Status
-- Summary of PR by status code
-- Source: IN_PR + IN_PRLN
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_G2_PRByStatus]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    SELECT 
        RTRIM(h.Status) AS Status,
        CASE RTRIM(h.Status)
            WHEN '1' THEN 'New'
            WHEN '2' THEN 'Pending'
            WHEN '3' THEN 'Rejected'
            WHEN '4' THEN 'Partial'
            WHEN '6' THEN 'Approved/Complete'
            ELSE 'Unknown'
        END AS StatusDescription,
        COUNT(DISTINCT h.PRID) AS PRCount,
        SUM(l.QtyReq) AS TotalQtyReq,
        SUM(l.QtyRcv) AS TotalQtyRcv,
        SUM(ISNULL(l.QtyOutstanding, 0)) AS TotalQtyOutstanding,
        SUM(h.TotalAmount) AS TotalAmount,
        MIN(h.PRDate) AS OldestPR,
        MAX(h.PRDate) AS NewestPR
    FROM IN_PR h
    LEFT JOIN IN_PRLN l ON l.StockIssueLNID LIKE h.PRID + '%'
    WHERE (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
    GROUP BY RTRIM(h.Status)
    ORDER BY PRCount DESC;
END;
```

---

## GROUP H: ADJUSTMENT & OTHERS

### H1. Stock Adjustment

```sql
-- ============================================
-- H1: Stock Adjustment
-- Laporan penyesuaian stok (stock opname differences)
-- Source: IN_STOCKADJ + IN_STOCKADJLN
-- ============================================

ALTER PROCEDURE [dbo].[sp_INV_H1_StockAdjustment]
    @AccYear VARCHAR(4) = NULL,
    @AccMonth VARCHAR(2) = NULL,
    @AdjType VARCHAR(10) = NULL,
    @PostDateFrom DATETIME = NULL,
    @PostDateTo DATETIME = NULL,
    @Page INT = 1,
    @PageSize INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SET LOCK_TIMEOUT 30000;
    
    DECLARE @Offset INT = (@Page - 1) * @PageSize;
    
    SELECT 
        h.StockAdjID AS DocNo,
        h.PostDate,
        h.StockAdjDate,
        RTRIM(h.AdjType) AS AdjType,
        RTRIM(h.TransType) AS TransType,
        l.ItemCode,
        l.N_Quantity AS NewQty,
        l.D_Quantity AS OldQty,
        l.N_Quantity - l.D_Quantity AS DiffQty,
        l.N_TotalCost - l.D_TotalCost AS DiffAmount,
        l.N_AverageCost AS NewAvgCost,
        l.D_AverageCost AS OldAvgCost,
        l.Remark,
        h.Remark AS HeaderRemark,
        COUNT(*) OVER() AS TotalRows
    FROM IN_STOCKADJLN l
    INNER JOIN IN_STOCKADJ h ON l.StockAdjID = h.StockAdjID
    WHERE 1=1
      AND (@AccYear IS NULL OR h.AccYear = @AccYear)
      AND (@AccMonth IS NULL OR h.AccMonth = @AccMonth)
      AND (@AdjType IS NULL OR RTRIM(h.AdjType) = @AdjType)
      AND (@PostDateFrom IS NULL OR h.PostDate >= @PostDateFrom)
      AND (@PostDateTo IS NULL OR h.PostDate <= @PostDateTo)
    ORDER BY h.PostDate DESC
    OFFSET @Offset ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END;
```

---

## INDEX RECOMMENDATIONS

For optimal performance, create these indexes on `db_ptrj_mill`:

```sql
-- IN_ITEM: Status + category filtering
CREATE NONCLUSTERED INDEX IX_IN_ITEM_Status_Cat 
ON IN_ITEM(Status, ProdCatCode, LocCode) 
INCLUDE (QtyOnHand, AverageCost, LastIssueDate, ReOrderLevel);

-- IN_MTHENDITEM: Period + location filtering
CREATE NONCLUSTERED INDEX IX_IN_MTHENDITEM_Period_Loc 
ON IN_MTHENDITEM(AccYear, AccMonth, LocCode, ItemCode) 
INCLUDE (Qty, Amount);

-- IN_STOCKISSUELN: Document + item lookup
CREATE NONCLUSTERED INDEX IX_IN_STOCKISSUELN_DocNo 
ON IN_STOCKISSUELN(DocNo, ItemCode) 
INCLUDE (Qty, Amount, AccCode, BlkCode, VehCode);

-- IN_STOCKISSUE: Period + date filtering
CREATE NONCLUSTERED INDEX IX_IN_STOCKISSUE_PostDate 
ON IN_STOCKISSUE(PostDate, AccYear, AccMonth) 
INCLUDE (DocNo, Status, TotalAmount);

-- IN_FUELISSUELN: Vehicle + period
CREATE NONCLUSTERED INDEX IX_IN_FUELISSUELN_VehCode 
ON IN_FUELISSUELN(VehCode, AccCode);

-- IN_PRLN: Outstanding PR lookup
CREATE NONCLUSTERED INDEX IX_IN_PRLN_Outstanding 
ON IN_PRLN(QtyOutstanding) 
INCLUDE (ItemCode, QtyReq, QtyRcv);
```

---

*SQL Queries Generated for PT Rebinmas Jaya Report Center — Inventory Module v1.0*
*All queries are READ-ONLY. CUD DILARANG.*
