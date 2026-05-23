# Inventory Module - Quick Reference

## Bash / cURL Cheatsheet

```bash
# Variables
API="http://localhost:8001"
TOKEN="2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
DB="db_ptrj_mill"

# 1. Health check
curl -s $API/health

# 2. List databases
curl -s $API/v1/databases -H "x-api-key: $TOKEN"

# 3. Count IN_ITEM rows
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d "{\"sql\":\"SELECT COUNT(*) AS TotalRows FROM [db_ptrj_mill].[dbo].[IN_ITEM]\",\"database\":\"$DB\"}"

# 4. Get top 5 items by QtyOnHand
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 5 ItemCode, LocCode, Description, QtyOnHand, AverageCost, Status FROM [db_ptrj_mill].[dbo].[IN_ITEM] ORDER BY QtyOnHand DESC","database":"db_ptrj_mill"}'

# 5. Get items with low stock (QtyOnHand < ReOrderLevel)
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT ItemCode, LocCode, Description, QtyOnHand, ReOrderLevel FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE QtyOnHand < ReOrderLevel AND Status = '\''1 '\'' ORDER BY QtyOnHand ASC","database":"db_ptrj_mill"}'

# 6. Search items by description
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 10 ItemCode, Description, QtyOnHand, UOMCode FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE Description LIKE '\''%bolt%'\''","database":"db_ptrj_mill"}'

# 7. Get stock value summary by location
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT LocCode, COUNT(*) AS ItemCount, SUM(QtyOnHand * AverageCost) AS TotalValue FROM [db_ptrj_mill].[dbo].[IN_ITEM] GROUP BY LocCode ORDER BY TotalValue DESC","database":"db_ptrj_mill"}'

# 8. List all location codes
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT DISTINCT LocCode FROM [db_ptrj_mill].[dbo].[IN_ITEM] ORDER BY LocCode","database":"db_ptrj_mill"}'

# 9. Get items by type
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT ItemType, COUNT(*) AS Count FROM [db_ptrj_mill].[dbo].[IN_ITEM] GROUP BY ItemType ORDER BY Count DESC","database":"db_ptrj_mill"}'

# 10. Recent updates
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 10 ItemCode, LocCode, Description, UpdateDate, UpdateID FROM [db_ptrj_mill].[dbo].[IN_ITEM] ORDER BY UpdateDate DESC","database":"db_ptrj_mill"}'

# 11. List product types
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT * FROM [db_ptrj_mill].[dbo].[IN_PRODTYPE] ORDER BY ProdTypeCode","database":"db_ptrj_mill"}'

# 12. List product categories
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT * FROM [db_ptrj_mill].[dbo].[IN_PRODCAT] ORDER BY ProdCatCode","database":"db_ptrj_mill"}'

# 13. Get item master data (IN_ITEMCODE)
curl -s -X POST $API/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"sql":"SELECT TOP 5 * FROM [db_ptrj_mill].[dbo].[IN_ITEMCODE] ORDER BY ItemCode","database":"db_ptrj_mill"}'

# 14. Batch: Insert + verify (transaction)
curl -s -X POST $API/v1/query/batch \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TOKEN" \
  -d '{"database":"db_ptrj_mill","queries":[{"sql":"SELECT TOP 1 * FROM [db_ptrj_mill].[dbo].[IN_ITEM]"},{"sql":"SELECT COUNT(*) AS Total FROM [db_ptrj_mill].[dbo].[IN_ITEM]"}]}'
```

## Python Example

```python
import requests

API = "http://localhost:8001"
TOKEN = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
DB = "db_ptrj_mill"
HEADERS = {"x-api-key": TOKEN, "Content-Type": "application/json"}

def query(sql, database=DB):
    r = requests.post(f"{API}/v1/query",
        json={"sql": sql, "database": database},
        headers=HEADERS)
    return r.json()

# Get low stock items
result = query(
    "SELECT ItemCode, Description, QtyOnHand, ReOrderLevel "
    "FROM [db_ptrj_mill].[dbo].[IN_ITEM] "
    "WHERE QtyOnHand < ReOrderLevel AND Status = '1 '"
)
for row in result["data"]["recordset"]:
    print(f"{row['ItemCode']} | {row['Description']} | Stock: {row['QtyOnHand']} / Reorder: {row['ReOrderLevel']}")
```

## PowerShell Example

```powershell
$headers = @{
    "x-api-key" = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
    "Content-Type" = "application/json"
}

# Get low stock items
$body = '{"sql":"SELECT TOP 20 ItemCode, Description, QtyOnHand, ReOrderLevel FROM [db_ptrj_mill].[dbo].[IN_ITEM] WHERE QtyOnHand < ReOrderLevel AND Status = '\''1 '\'' ORDER BY QtyOnHand ASC","database":"db_ptrj_mill"}'
$r = Invoke-RestMethod -Uri "http://localhost:8001/v1/query" -Method POST -Headers $headers -Body $body
$r.data.recordset | ForEach-Object { Write-Host "$($_.ItemCode) | $($_.Description) | Stock: $($_.QtyOnHand)" }
```