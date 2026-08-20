# Audit Month-End vs Realtime — Inventory 2027-1

> Scope: `db_ptrj_mill`, `AccYear = 2027`, `AccMonth = 1`.
> Fokus: `IN_STOCKISSUE`, `IN_STOCKISSUELN`, `IN_MTHENDTRX`, `IN_MTHENDITEM`.
> Tujuan: buktikan hubungan realtime ↔ jurnal month-end ↔ snapshot.

## 1. Realtime Issue Summary

```sql
SELECT
  COUNT(DISTINCT h.StockIssueID) AS IssueDocs,
  COUNT(*) AS IssueLines,
  COUNT(DISTINCT RTRIM(l.ItemCode)) AS IssueItems,
  CAST(SUM(l.Qty) AS decimal(18,2)) AS IssueQty,
  CAST(SUM(l.Amount) AS decimal(18,2)) AS IssueAmount
FROM IN_STOCKISSUE h
JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
WHERE RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6');
```

### Result Real

| IssueDocs | IssueLines | IssueItems | IssueQty | IssueAmount |
|---:|---:|---:|---:|---:|
| 270 | 537 | 137 | 72,873.80 | 747,041,642.31 |

---

## 2. Month-End Journal Summary

```sql
SELECT
  RTRIM(DocType) AS DocType,
  COUNT(*) AS TotalRows,
  COUNT(DISTINCT RTRIM(DocId)) AS DistinctDocs,
  COUNT(DISTINCT RTRIM(DocLnId)) AS DistinctLines,
  CAST(SUM(Unit) AS decimal(18,2)) AS SumUnit,
  CAST(SUM(Amount) AS decimal(18,2)) AS NetAmount,
  CAST(SUM(CASE WHEN Amount > 0 THEN Amount ELSE 0 END) AS decimal(18,2)) AS PositiveAmount,
  CAST(SUM(CASE WHEN Amount < 0 THEN Amount ELSE 0 END) AS decimal(18,2)) AS NegativeAmount
FROM IN_MTHENDTRX
WHERE RTRIM(AccYear) = '2027'
  AND CAST(RTRIM(AccMonth) AS int) = 1
GROUP BY RTRIM(DocType)
ORDER BY RTRIM(DocType);
```

### Result Real

| DocType | TotalRows | DistinctDocs | DistinctLines | SumUnit | NetAmount | PositiveAmount | NegativeAmount |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 24 | 1,074 | 270 | 537 | 145,747.60 | 0.00 | 747,041,642.31 | -747,041,642.31 |
| 25 | 262 | 123 | 131 | 20,290.00 | 0.00 | 171,913,818.43 | -171,913,818.43 |

### Interpretasi

- `DocType = 24` cocok ke stock issue.
- `TotalRows = 1,074` karena 1 issue line jadi 2 row jurnal.
- `NetAmount = 0` karena double-entry.
- `PositiveAmount` sama dengan nilai issue realtime.

---

## 3. One Real Line Reconciliation

Source realtime:

```text
StockIssueID   = SI26016036
StockIssueLNID = SIL26031950
ItemCode       = MO03003
Qty            = 2
Cost           = 3,750
Amount         = 7,500
```

Jurnal month-end:

| DocId | DocLnId | DocType | AccCode | BlkCode | Unit | Cost | Amount |
|---|---|---:|---|---|---:|---:|---:|
| `SI26016036` | `SIL26031950` | `24` | `OC7318` | `GEN01001` | 2.00 | 3,750.00 | 7,500.00 |
| `SI26016036` | `SIL26031950` | `24` | `CA2118` | blank | 2.00 | -3,750.00 | -7,500.00 |

### Rule

```text
IN_STOCKISSUELN.Amount = 7,500
IN_MTHENDTRX positive row = 7,500
IN_MTHENDTRX negative row = -7,500
Net = 0
```

---

## 4. Month-End Snapshot Summary

```sql
SELECT
  COUNT(*) AS SnapshotRows,
  COUNT(DISTINCT RTRIM(ItemCode)) AS SnapshotItems,
  CAST(SUM(Qty) AS decimal(18,2)) AS SnapshotQty,
  CAST(SUM(Amount) AS decimal(18,2)) AS SnapshotAmount
FROM IN_MTHENDITEM
WHERE RTRIM(AccYear) = '2027'
  AND CAST(RTRIM(AccMonth) AS int) = 1;
```

### Result Real

| SnapshotRows | SnapshotItems | SnapshotQty | SnapshotAmount |
|---:|---:|---:|---:|
| 11,760 | 11,760 | 316,050.18 | 132,439,078,100.92 |

### Interpretasi

Snapshot adalah closing stock value, bukan issue value.

---

## 5. Snapshot vs Realtime Sample

### Item dengan issue besar dan snapshot masih ada

| ItemCode | LocCode | SnapshotQty | SnapshotAmount | IssueQty | IssueAmount | IssueDocs |
|---|---|---:|---:|---:|---:|---:|
| `MO04164` | `PTRJ` | 105,000.00 | 246,749,888.74 | 60,000.00 | 140,999,919.80 | 11 |
| `MO04036` | `PTRJ` | 767.00 | 65,109,358.57 | 241.00 | 20,439,118.93 | 22 |
| `MC01005` | `PTRJ` | 727.00 | 16,575,420.88 | 570.00 | 12,995,859.54 | 25 |

### Item dengan issue tapi snapshot 0

| ItemCode | LocCode | SnapshotQty | SnapshotAmount | IssueQty | IssueAmount | IssueDocs |
|---|---|---:|---:|---:|---:|---:|
| `MC02018` | `PTRJ` | 0.00 | 0.00 | 100.00 | 108,750,000.00 | 1 |
| `MO09285` | `PTRJ` | 0.00 | 0.00 | 21.00 | 105,525,000.00 | 2 |
| `MO04288` | `PTRJ` | 0.00 | 0.00 | 42.00 | 52,920,000.00 | 1 |

### Interpretasi

- snapshot 0 bukan bug otomatis;
- bisa berarti item habis di bulan itu;
- bisa juga karena issue besar lalu closing ditutup movement lain.

---

## 6. Audit Check Yang Harus Lulus

### Check A — Issue source punya jurnal

```sql
SELECT TOP 50
  RTRIM(h.StockIssueID) AS StockIssueID,
  RTRIM(l.StockIssueLNID) AS StockIssueLNID,
  RTRIM(l.ItemCode) AS ItemCode,
  CAST(l.Qty AS decimal(18,2)) AS Qty,
  CAST(l.Amount AS decimal(18,2)) AS Amount
FROM IN_STOCKISSUE h
JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
LEFT JOIN IN_MTHENDTRX t
  ON RTRIM(t.DocId) = RTRIM(h.StockIssueID)
 AND RTRIM(t.DocLnId) = RTRIM(l.StockIssueLNID)
 AND RTRIM(t.ItemCode) = RTRIM(l.ItemCode)
 AND RTRIM(t.DocType) = '24'
 AND RTRIM(t.AccYear) = RTRIM(h.AccYear)
 AND CAST(RTRIM(t.AccMonth) AS int) = CAST(RTRIM(h.AccMonth) AS int)
WHERE RTRIM(h.AccYear) = '2027'
  AND CAST(RTRIM(h.AccMonth) AS int) = 1
  AND RTRIM(ISNULL(h.Status, '')) IN ('2','5','6')
GROUP BY h.StockIssueID, l.StockIssueLNID, l.ItemCode, l.Qty, l.Amount
HAVING COUNT(t.DocId) = 0;
```

Expected: 0 row.

### Check B — Jurnal punya source issue line

```sql
SELECT TOP 50
  RTRIM(t.DocId) AS DocId,
  RTRIM(t.DocLnId) AS DocLnId,
  RTRIM(t.ItemCode) AS ItemCode,
  CAST(t.Unit AS decimal(18,2)) AS Unit,
  CAST(t.Amount AS decimal(18,2)) AS Amount
FROM IN_MTHENDTRX t
LEFT JOIN IN_STOCKISSUE h
  ON RTRIM(h.StockIssueID) = RTRIM(t.DocId)
 AND RTRIM(h.AccYear) = RTRIM(t.AccYear)
 AND CAST(RTRIM(h.AccMonth) AS int) = CAST(RTRIM(t.AccMonth) AS int)
LEFT JOIN IN_STOCKISSUELN l
  ON RTRIM(l.StockIssueID) = RTRIM(t.DocId)
 AND RTRIM(l.StockIssueLNID) = RTRIM(t.DocLnId)
 AND RTRIM(l.ItemCode) = RTRIM(t.ItemCode)
WHERE RTRIM(t.AccYear) = '2027'
  AND CAST(RTRIM(t.AccMonth) AS int) = 1
  AND RTRIM(t.DocType) = '24'
  AND l.StockIssueLNID IS NULL;
```

Expected: 0 row.

---

## 7. Kenapa Audit Ini Penting

Karena ada 3 angka yang sering tertukar:

1. `IssueAmount` realtime = barang dipakai.
2. `JournalAmount` month-end = posting double-entry, net 0.
3. `SnapshotAmount` month-end = stok sisa.

Kalau salah baca, report bisa kelihatan benar padahal maknanya beda.
