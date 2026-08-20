DECLARE @LocCode varchar(8) = 'PTRJ';
DECLARE @ReportYear char(4) = '2027';
DECLARE @ReportMonth varchar(2) = '2';
DECLARE @OpeningYear char(4) = '2027';
DECLARE @OpeningMonth varchar(2) = '1';

WITH base AS (
    SELECT
        RTRIM(i.ItemCode) AS ItemCode,
        RTRIM(i.Description) AS Description,
        RTRIM(i.UOMCode) AS UOM,
        RTRIM(i.StockAnalysisCode) AS StockAnalysisCode,
        RTRIM(sa.Description) AS StockAnalysisName
    FROM [db_ptrj_mill].[dbo].[IN_ITEM] i
    LEFT JOIN [db_ptrj_mill].[dbo].[IN_STOCKANALYSIS] sa
        ON sa.StockAnalysisCode = i.StockAnalysisCode
    WHERE RTRIM(i.LocCode) = @LocCode
      AND RTRIM(i.Status) = '1'
      AND RTRIM(i.StockAnalysisCode) IN ('DEADS', 'MEMOV', 'SLMOV')
      AND RTRIM(i.ProdTypeCode) <> 'DC'
      AND RTRIM(i.ItemCode) COLLATE Latin1_General_BIN LIKE 'M%'
),
movements AS (
    SELECT
        RTRIM(ItemCode) AS ItemCode,
        Qty AS opening_qty,
        Amount AS opening_amt,
        0.0 AS received_qty,
        0.0 AS received_amt,
        0.0 AS return_advice_qty,
        0.0 AS return_advice_amt,
        0.0 AS transferred_qty,
        0.0 AS transferred_amt,
        0.0 AS adjustment_qty,
        0.0 AS adjustment_amt,
        0.0 AS ledger_qty,
        0.0 AS ledger_amt,
        0.0 AS issued_station_qty,
        0.0 AS issued_station_amt,
        0.0 AS issued_vehicle_qty,
        0.0 AS issued_vehicle_amt,
        0.0 AS return_qty,
        0.0 AS return_amt,
        0.0 AS goods_receive_qty,
        0.0 AS goods_receive_amt,
        0.0 AS goods_return_qty,
        0.0 AS goods_return_amt,
        0.0 AS dispatch_adv_qty,
        0.0 AS dispatch_adv_amt
    FROM [db_ptrj_mill].[dbo].[IN_MTHENDITEM]
    WHERE AccYear = @OpeningYear
      AND RTRIM(AccMonth) = @OpeningMonth
      AND RTRIM(LocCode) = @LocCode

    UNION ALL

    SELECT
        RTRIM(l.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN LEN(RTRIM(l.BlkCode)) = 0 AND LEN(RTRIM(l.VehCode)) = 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.BlkCode)) = 0 AND LEN(RTRIM(l.VehCode)) = 0 THEN l.Amount ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) = 0 AND LEN(RTRIM(l.BlkCode)) > 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) = 0 AND LEN(RTRIM(l.BlkCode)) > 0 THEN l.Amount ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) > 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) > 0 THEN l.Amount ELSE 0 END,
        0, 0, 0, 0, 0, 0, 0, 0
    FROM [db_ptrj_mill].[dbo].[IN_STOCKISSUE] h
    JOIN [db_ptrj_mill].[dbo].[IN_STOCKISSUELN] l
        ON h.StockIssueID = l.StockIssueID
    WHERE h.AccYear = @ReportYear
      AND RTRIM(h.AccMonth) = @ReportMonth
      AND RTRIM(h.Status) = '2'
      AND RTRIM(h.LocCode) = @LocCode

    UNION ALL

    SELECT
        RTRIM(s.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) = 0 THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) = 0 THEN s.Amount ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) > 0 THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) > 0 THEN s.Amount ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) > 0 THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) > 0 THEN s.Amount ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '2' THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '2' THEN s.Amount ELSE 0 END,
        0, 0, 0, 0, 0, 0
    FROM [db_ptrj_mill].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [db_ptrj_mill].[dbo].[WS_JOB] j
        ON s.JobID = j.JobID
    WHERE s.AccYear = @ReportYear
      AND RTRIM(s.AccMonth) = @ReportMonth
      AND RTRIM(s.LocCode) = @LocCode

    UNION ALL

    SELECT
        RTRIM(gl.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        gl.StockQty,
        CAST(gl.StockQty * ISNULL(p.Cost, 0) AS decimal(18, 6)),
        0, 0, 0, 0
    FROM [db_ptrj_mill].[dbo].[PU_GOODSRCV] g
    JOIN [db_ptrj_mill].[dbo].[PU_GOODSRCVLN] gl
        ON g.GoodsRcvID = gl.GoodsRcvID
    LEFT JOIN [db_ptrj_mill].[dbo].[PU_POLN] p
        ON gl.POLnID = p.POLnID
    WHERE g.AccYear = @ReportYear
      AND RTRIM(g.AccMonth) = @ReportMonth
      AND RTRIM(g.Status) = '2'
      AND RTRIM(g.LocCode) = @LocCode
),
agg AS (
    SELECT
        ItemCode,
        SUM(opening_qty) AS opening_qty,
        SUM(opening_amt) AS opening_amt,
        SUM(received_qty) AS received_qty,
        SUM(received_amt) AS received_amt,
        SUM(return_advice_qty) AS return_advice_qty,
        SUM(return_advice_amt) AS return_advice_amt,
        SUM(transferred_qty) AS transferred_qty,
        SUM(transferred_amt) AS transferred_amt,
        SUM(adjustment_qty) AS adjustment_qty,
        SUM(adjustment_amt) AS adjustment_amt,
        SUM(ledger_qty) AS ledger_qty,
        SUM(ledger_amt) AS ledger_amt,
        SUM(issued_station_qty) AS issued_station_qty,
        SUM(issued_station_amt) AS issued_station_amt,
        SUM(issued_vehicle_qty) AS issued_vehicle_qty,
        SUM(issued_vehicle_amt) AS issued_vehicle_amt,
        SUM(return_qty) AS return_qty,
        SUM(return_amt) AS return_amt,
        SUM(goods_receive_qty) AS goods_receive_qty,
        SUM(goods_receive_amt) AS goods_receive_amt,
        SUM(goods_return_qty) AS goods_return_qty,
        SUM(goods_return_amt) AS goods_return_amt,
        SUM(dispatch_adv_qty) AS dispatch_adv_qty,
        SUM(dispatch_adv_amt) AS dispatch_adv_amt
    FROM movements
    GROUP BY ItemCode
),
final AS (
    SELECT
        b.StockAnalysisCode,
        b.StockAnalysisName,
        ROW_NUMBER() OVER (PARTITION BY b.StockAnalysisCode ORDER BY b.ItemCode) AS no,
        b.ItemCode,
        b.Description,
        b.UOM,
        CAST(ISNULL(a.opening_qty, 0) AS decimal(18, 6)) AS opening_qty,
        CAST(ISNULL(a.opening_amt, 0) AS decimal(18, 6)) AS opening_amt,
        CAST(ISNULL(a.received_qty, 0) AS decimal(18, 6)) AS received_qty,
        CAST(ISNULL(a.received_amt, 0) AS decimal(18, 6)) AS received_amt,
        CAST(ISNULL(a.return_advice_qty, 0) AS decimal(18, 6)) AS return_advice_qty,
        CAST(ISNULL(a.return_advice_amt, 0) AS decimal(18, 6)) AS return_advice_amt,
        CAST(ISNULL(a.transferred_qty, 0) AS decimal(18, 6)) AS transferred_qty,
        CAST(ISNULL(a.transferred_amt, 0) AS decimal(18, 6)) AS transferred_amt,
        CAST(ISNULL(a.adjustment_qty, 0) AS decimal(18, 6)) AS adjustment_qty,
        CAST(ISNULL(a.adjustment_amt, 0) AS decimal(18, 6)) AS adjustment_amt,
        CAST(ISNULL(a.ledger_qty, 0) AS decimal(18, 6)) AS ledger_qty,
        CAST(ISNULL(a.ledger_amt, 0) AS decimal(18, 6)) AS ledger_amt,
        CAST(ISNULL(a.issued_station_qty, 0) AS decimal(18, 6)) AS issued_station_qty,
        CAST(ISNULL(a.issued_station_amt, 0) AS decimal(18, 6)) AS issued_station_amt,
        CAST(ISNULL(a.issued_vehicle_qty, 0) AS decimal(18, 6)) AS issued_vehicle_qty,
        CAST(ISNULL(a.issued_vehicle_amt, 0) AS decimal(18, 6)) AS issued_vehicle_amt,
        CAST(ISNULL(a.return_qty, 0) AS decimal(18, 6)) AS return_qty,
        CAST(ISNULL(a.return_amt, 0) AS decimal(18, 6)) AS return_amt,
        CAST(ISNULL(a.goods_receive_qty, 0) AS decimal(18, 6)) AS goods_receive_qty,
        CAST(ISNULL(a.goods_receive_amt, 0) AS decimal(18, 6)) AS goods_receive_amt,
        CAST(ISNULL(a.goods_return_qty, 0) AS decimal(18, 6)) AS goods_return_qty,
        CAST(ISNULL(a.goods_return_amt, 0) AS decimal(18, 6)) AS goods_return_amt,
        CAST(ISNULL(a.dispatch_adv_qty, 0) AS decimal(18, 6)) AS dispatch_adv_qty,
        CAST(ISNULL(a.dispatch_adv_amt, 0) AS decimal(18, 6)) AS dispatch_adv_amt
    FROM base b
    LEFT JOIN agg a ON a.ItemCode = b.ItemCode
)
SELECT
    StockAnalysisCode AS stock_analysis_code,
    StockAnalysisName AS stock_analysis_name,
    no,
    ItemCode AS item_code,
    Description AS description,
    UOM AS unit,
    opening_qty,
    received_qty,
    return_advice_qty,
    transferred_qty,
    adjustment_qty,
    ledger_qty,
    issued_station_qty,
    issued_vehicle_qty,
    ledger_qty + issued_station_qty + issued_vehicle_qty AS issued_total_qty,
    return_qty,
    goods_receive_qty,
    goods_return_qty,
    dispatch_adv_qty,
    opening_qty + received_qty + return_advice_qty + transferred_qty + adjustment_qty
        - (ledger_qty + issued_station_qty + issued_vehicle_qty)
        + return_qty + goods_receive_qty - goods_return_qty - dispatch_adv_qty AS closing_qty,
    opening_amt,
    received_amt,
    return_advice_amt,
    transferred_amt,
    adjustment_amt,
    ledger_amt,
    issued_station_amt,
    issued_vehicle_amt,
    ledger_amt + issued_station_amt + issued_vehicle_amt AS issued_total_amt,
    return_amt,
    goods_receive_amt,
    goods_return_amt,
    dispatch_adv_amt,
    opening_amt + received_amt + return_advice_amt + transferred_amt + adjustment_amt
        - (ledger_amt + issued_station_amt + issued_vehicle_amt)
        + return_amt + goods_receive_amt - goods_return_amt - dispatch_adv_amt AS closing_amt
FROM final
ORDER BY stock_analysis_code, item_code;
