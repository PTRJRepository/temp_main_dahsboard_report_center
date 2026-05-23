-- Sample rows from IN_ITEM (all columns)
SELECT TOP 10
    RTRIM(ItemCode) AS ItemCode,
    RTRIM(LocCode) AS LocCode,
    RTRIM(Description) AS Description,
    RTRIM(Bin) AS Bin,
    RTRIM(ItemType) AS ItemType,
    RTRIM(ProdTypeCode) AS ProdTypeCode,
    RTRIM(ProdCatCode) AS ProdCatCode,
    FuelTypeInd,
    RTRIM(ProdBrandCode) AS ProdBrandCode,
    RTRIM(ProdModelCode) AS ProdModelCode,
    RTRIM(ProdMatCode) AS ProdMatCode,
    RTRIM(StockAnalysisCode) AS StockAnalysisCode,
    RTRIM(UOMCode) AS UOMCode,
    QtyOnHand,
    QtyOnHold,
    QtyOnOrder,
    AverageCost,
    LatestCost,
    DiffAverageCost,
    ClosingBal,
    Status,
    CreateDate,
    UpdateDate,
    RTRIM(UpdateID) AS UpdateID
FROM [db_ptrj_mill].[dbo].[IN_ITEM]
ORDER BY UpdateDate DESC;