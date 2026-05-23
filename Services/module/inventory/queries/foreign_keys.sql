-- Foreign keys involving IN_* tables
-- Note: No formal FK constraints defined; relationships are implicit via column naming
SELECT
    tp.name AS ParentTable,
    cp.name AS ParentCol,
    tr.name AS RefTable,
    cr.name AS RefCol
FROM sys.foreign_keys fk
INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
WHERE tp.name LIKE 'IN[_]%' OR tr.name LIKE 'IN[_]%';

-- Implicit relationships (no FK constraints):
-- IN_ITEM.ItemCode        → IN_ITEMCODE.ItemCode
-- IN_ITEM.ProdTypeCode    → IN_PRODTYPE.ProdTypeCode
-- IN_ITEM.ProdCatCode     → IN_PRODCAT.ProdCatCode
-- IN_ITEM.ProdBrandCode   → IN_PRODBRAND.ProdBrandCode
-- IN_ITEM.ProdModelCode   → IN_PRODMODEL.ProdModelCode
-- IN_ITEM.ProdMatCode     → IN_PRODMAT.ProdMatCode
-- IN_ITEM.StockAnalysisCode → IN_STOCKANALYSIS.StockAnalysisCode