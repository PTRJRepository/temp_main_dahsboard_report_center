-- Row counts for all IN_* tables
SELECT
    t.NAME AS TableName,
    p.rows AS RowCounts
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
WHERE t.name LIKE 'IN[_]%'
  AND p.index_id IN (0, 1)
ORDER BY t.name;

-- Run via SQL Gateway:
-- curl -s -X POST http://localhost:8001/v1/query \
--   -H "Content-Type: application/json" \
--   -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
--   -d '{"sql":"SELECT t.NAME AS TableName, p.rows AS RowCounts FROM sys.tables t INNER JOIN sys.partitions p ON t.object_id = p.object_id INNER JOIN sys.schemas s ON t.schema_id = s.schema_id WHERE t.name LIKE '\''IN[_]%'\'' AND p.index_id IN (0, 1) ORDER BY t.name","database":"db_ptrj_mill"}'