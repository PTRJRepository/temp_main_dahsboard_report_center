"""
Inventory Module - Generate All Reports
Queries Estate (SERVER_PROFILE_1) and Mill (SERVER_PROFILE_3) via SQL Gateway
"""
import json
import os
import time
from datetime import datetime

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

BASE_URL = "http://localhost:8001"
TOKEN = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
HEADERS = {
    "Content-Type": "application/json",
    "x-api-key": TOKEN
}
OUTPUT_DIR = "D:/Gawean Rebinmas/Main Dashboard/Services/module/inventory/reports"

os.makedirs(OUTPUT_DIR, exist_ok=True)


def q(sql, server, database, timeout=60):
    """Execute query via SQL Gateway"""
    payload = {"sql": sql, "server": server, "database": database}
    r = requests.post(f"{BASE_URL}/v1/query", json=payload, headers=HEADERS, timeout=timeout)
    d = r.json()
    if not d.get("success"):
        return {"error": d.get("error", "unknown"), "rows": [], "execution_ms": 0}
    recs = d.get("data", {}).get("recordset", [])
    return {"rows": recs, "execution_ms": d.get("execution_ms", 0), "error": None}


def save(name, data):
    path = os.path.join(OUTPUT_DIR, f"{name}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str, ensure_ascii=False)
    print(f"  Saved: {path}  ({len(data.get('rows',[]))} rows)")


# ─────────────────────────────────────────────
# 1. IN_ITEM - Stock Summary
# ─────────────────────────────────────────────
print("\n[1/7] IN_ITEM Stock Summary...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")

    # Overall summary
    summary = q(f"""
        SELECT
            COUNT(*) AS total_items,
            SUM(CAST(QtyOnHand AS decimal(20,4))) AS total_qty_on_hand,
            SUM(CAST(QtyOnHold AS decimal(20,4))) AS total_qty_on_hold,
            SUM(CAST(QtyOnOrder AS decimal(20,4))) AS total_qty_on_order,
            SUM(CAST(QtyOnHand * AverageCost AS decimal(20,2))) AS total_stock_value,
            SUM(CASE WHEN QtyOnHand <= 0 THEN 1 ELSE 0 END) AS zero_stock_count,
            SUM(CASE WHEN QtyOnHand < ReOrderLevel AND QtyOnHand > 0 THEN 1 ELSE 0 END) AS low_stock_count,
            SUM(CASE WHEN QtyOnHand >= ReOrderLevel THEN 1 ELSE 0 END) AS healthy_stock_count,
            AVG(CAST(AverageCost AS decimal(20,4))) AS avg_cost,
            MAX(CAST(AverageCost AS decimal(20,4))) AS max_cost,
            MIN(CAST(LatestCost AS decimal(20,4))) AS min_latest_cost
        FROM [db_ptrj_mill].[dbo].[IN_ITEM]
        WHERE Status = '1 '
    """, server, db)

    # By location
    by_loc = q(f"""
        SELECT
            RTRIM(LocCode) AS LocCode,
            COUNT(*) AS item_count,
            SUM(CAST(QtyOnHand AS decimal(20,4))) AS total_qty,
            SUM(CAST(QtyOnHand * AverageCost AS decimal(20,2))) AS total_value,
            SUM(CASE WHEN QtyOnHand <= 0 THEN 1 ELSE 0 END) AS zero_stock
        FROM [db_ptrj_mill].[dbo].[IN_ITEM]
        WHERE Status = '1 '
        GROUP BY LocCode
        ORDER BY total_value DESC
    """, server, db)

    # By item type (ProdTypeCode)
    by_type = q(f"""
        SELECT
            RTRIM(ISNULL(i.ProdTypeCode,'UNKNOWN')) AS ProdTypeCode,
            RTRIM(ISNULL(p.Description,'Unknown')) AS ProdTypeName,
            COUNT(*) AS item_count,
            SUM(CAST(i.QtyOnHand AS decimal(20,4))) AS total_qty,
            SUM(CAST(i.QtyOnHand * i.AverageCost AS decimal(20,2))) AS total_value
        FROM [db_ptrj_mill].[dbo].[IN_ITEM] i
        LEFT JOIN [db_ptrj_mill].[dbo].[IN_PRODTYPE] p ON RTRIM(i.ProdTypeCode) = RTRIM(p.Code)
        WHERE i.Status = '1 '
        GROUP BY RTRIM(i.ProdTypeCode), RTRIM(p.Description)
        ORDER BY total_value DESC
    """, server, db)

    # Top 50 highest value items
    top_value = q(f"""
        SELECT TOP 50
            RTRIM(ItemCode) AS ItemCode,
            RTRIM(Description) AS Description,
            RTRIM(LocCode) AS LocCode,
            CAST(QtyOnHand AS decimal(20,4)) AS QtyOnHand,
            CAST(AverageCost AS decimal(20,4)) AS AverageCost,
            CAST(QtyOnHand * AverageCost AS decimal(20,2)) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_ITEM]
        WHERE Status = '1 ' AND QtyOnHand > 0
        ORDER BY QtyOnHand * AverageCost DESC
    """, server, db)

    save(f"estate_{label}_in_item_summary" if label == "estate" else f"mill_{label}_in_item_summary",
         {"report": "IN_ITEM Stock Summary", "server": server, "db": db, "generated_at": datetime.now().isoformat(),
          "summary": summary.get("rows", [{}])[0] if summary.get("rows") else {}, "by_location": by_loc["rows"],
          "by_prod_type": by_type["rows"], "top_50_value": top_value["rows"]})


# ─────────────────────────────────────────────
# 2. Low Stock & Dead Stock
# ─────────────────────────────────────────────
print("\n[2/7] Low Stock & Dead Stock...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")

    # Zero stock (dead)
    zero = q(f"""
        SELECT
            RTRIM(ItemCode) AS ItemCode,
            RTRIM(Description) AS Description,
            RTRIM(LocCode) AS LocCode,
            CAST(AverageCost AS decimal(20,4)) AS AverageCost,
            CAST(QtyOnOrder AS decimal(20,4)) AS QtyOnOrder,
            CAST(ReOrderLevel AS decimal(20,4)) AS ReOrderLevel,
            CAST(InitialCost AS decimal(20,4)) AS InitialCost,
            CAST(LatestCost AS decimal(20,4)) AS LatestCost,
            UpdateDate
        FROM [db_ptrj_mill].[dbo].[IN_ITEM]
        WHERE Status = '1 ' AND QtyOnHand <= 0
        ORDER BY UpdateDate DESC
    """, server, db)

    # Low stock
    low = q(f"""
        SELECT TOP 100
            RTRIM(ItemCode) AS ItemCode,
            RTRIM(Description) AS Description,
            RTRIM(LocCode) AS LocCode,
            CAST(QtyOnHand AS decimal(20,4)) AS QtyOnHand,
            CAST(ReOrderLevel AS decimal(20,4)) AS ReOrderLevel,
            CAST(AverageCost AS decimal(20,4)) AS AverageCost,
            CAST(QtyOnOrder AS decimal(20,4)) AS QtyOnOrder,
            CAST(QtyOnHand * AverageCost AS decimal(20,2)) AS StockValue,
            CASE WHEN ReOrderLevel > 0 THEN CAST((QtyOnHand / NULLIF(ReOrderLevel,0)) * 100 AS decimal(10,1)) ELSE NULL END AS StockRatioPct
        FROM [db_ptrj_mill].[dbo].[IN_ITEM]
        WHERE Status = '1 ' AND QtyOnHand > 0 AND QtyOnHand < ReOrderLevel
        ORDER BY QtyOnHand ASC
    """, server, db)

    # Dead stock (> 6 months no movement)
    dead = q(f"""
        SELECT TOP 50
            RTRIM(ItemCode) AS ItemCode,
            RTRIM(Description) AS Description,
            RTRIM(LocCode) AS LocCode,
            CAST(QtyOnHand AS decimal(20,4)) AS QtyOnHand,
            CAST(AverageCost AS decimal(20,4)) AS AverageCost,
            CAST(QtyOnHand * AverageCost AS decimal(20,2)) AS TotalValue,
            LastIssueDate,
            LastOrderDate,
            UpdateDate
        FROM [db_ptrj_mill].[dbo].[IN_ITEM]
        WHERE Status = '1 ' AND QtyOnHand > 0
          AND (LastIssueDate IS NULL OR LastIssueDate < DATEADD(MONTH, -6, GETDATE()))
        ORDER BY QtyOnHand * AverageCost DESC
    """, server, db)

    fname = f"estate_low_dead_stock.json" if label == "estate" else f"mill_low_dead_stock.json"
    save(fname, {"report": "Low Stock & Dead Stock", "server": server, "db": db,
                 "generated_at": datetime.now().isoformat(),
                 "zero_stock": zero["rows"], "low_stock": low["rows"], "dead_stock_6months": dead["rows"]})


# ─────────────────────────────────────────────
# 3. IN_STOCKISSUE - Stock Issuance Analysis
# ─────────────────────────────────────────────
print("\n[3/7] IN_STOCKISSUE Analysis...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")

    # Monthly issuance trends
    monthly = q(f"""
        SELECT
            YEAR(h.DocDate) AS Year,
            MONTH(h.DocDate) AS Month,
            DATENAME(MONTH, h.DocDate) AS MonthName,
            COUNT(DISTINCT h.DocNo) AS TransactionCount,
            COUNT(l.LineNum) AS LineCount,
            SUM(CAST(l.Qty AS decimal(20,4))) AS TotalQtyIssued,
            SUM(CAST(l.Qty * l.UnitCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_STOCKISSUE] h
        INNER JOIN [db_ptrj_mill].[dbo].[IN_STOCKISSUELN] l ON h.DocNo = l.DocNo
        WHERE h.DocDate >= DATEADD(YEAR, -2, GETDATE())
        GROUP BY YEAR(h.DocDate), MONTH(h.DocDate), DATENAME(MONTH, h.DocDate)
        ORDER BY Year, Month
    """, server, db)

    # Top 30 items issued
    top_issued = q(f"""
        SELECT TOP 30
            RTRIM(l.ItemCode) AS ItemCode,
            RTRIM(MAX(i.Description)) AS Description,
            COUNT(*) AS TimesIssued,
            SUM(CAST(l.Qty AS decimal(20,4))) AS TotalQty,
            AVG(CAST(l.UnitCost AS decimal(20,4))) AS AvgUnitCost,
            SUM(CAST(l.Qty * l.UnitCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_STOCKISSUE] h
        INNER JOIN [db_ptrj_mill].[dbo].[IN_STOCKISSUELN] l ON h.DocNo = l.DocNo
        LEFT JOIN [db_ptrj_mill].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode
        WHERE h.DocDate >= DATEADD(YEAR, -1, GETDATE())
        GROUP BY RTRIM(l.ItemCode)
        ORDER BY TotalQty DESC
    """, server, db)

    # By department/cost center
    by_dept = q(f"""
        SELECT TOP 20
            RTRIM(h.DepartmentCode) AS DeptCode,
            COUNT(DISTINCT h.DocNo) AS DocCount,
            SUM(CAST(l.Qty AS decimal(20,4))) AS TotalQty,
            SUM(CAST(l.Qty * l.UnitCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_STOCKISSUE] h
        INNER JOIN [db_ptrj_mill].[dbo].[IN_STOCKISSUELN] l ON h.DocNo = l.DocNo
        WHERE h.DocDate >= DATEADD(YEAR, -1, GETDATE())
        GROUP BY RTRIM(h.DepartmentCode)
        ORDER BY TotalValue DESC
    """, server, db)

    fname = f"estate_stock_issue.json" if label == "estate" else f"mill_stock_issue.json"
    save(fname, {"report": "IN_STOCKISSUE Analysis", "server": server, "db": db,
                 "generated_at": datetime.now().isoformat(),
                 "monthly_trends": monthly["rows"], "top_30_issued": top_issued["rows"], "by_department": by_dept["rows"]})


# ─────────────────────────────────────────────
# 4. IN_PRLN - Purchase Requisition Analysis
# ─────────────────────────────────────────────
print("\n[4/7] IN_PRLN Analysis...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")

    # PR Status summary
    pr_status = q(f"""
        SELECT
            RTRIM(h.Status) AS PRStatus,
            COUNT(DISTINCT h.DocNo) AS PRCount,
            COUNT(l.LineNum) AS LineCount,
            SUM(CAST(l.Qty AS decimal(20,4))) AS TotalQty,
            SUM(CAST(l.Qty * l.UnitCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_PR] h
        INNER JOIN [db_ptrj_mill].[dbo].[IN_PRLN] l ON h.DocNo = l.DocNo
        WHERE h.DocDate >= DATEADD(YEAR, -1, GETDATE())
        GROUP BY RTRIM(h.Status)
        ORDER BY TotalValue DESC
    """, server, db)

    # Monthly PR trends
    monthly_pr = q(f"""
        SELECT
            YEAR(h.DocDate) AS Year,
            MONTH(h.DocDate) AS Month,
            DATENAME(MONTH, h.DocDate) AS MonthName,
            COUNT(DISTINCT h.DocNo) AS PRCount,
            COUNT(l.LineNum) AS LineCount,
            SUM(CAST(l.Qty * l.UnitCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_PR] h
        INNER JOIN [db_ptrj_mill].[dbo].[IN_PRLN] l ON h.DocNo = l.DocNo
        WHERE h.DocDate >= DATEADD(YEAR, -2, GETDATE())
        GROUP BY YEAR(h.DocDate), MONTH(h.DocDate), DATENAME(MONTH, h.DocDate)
        ORDER BY Year, Month
    """, server, db)

    # Top 30 items in PRs
    top_pr = q(f"""
        SELECT TOP 30
            RTRIM(l.ItemCode) AS ItemCode,
            RTRIM(MAX(i.Description)) AS Description,
            COUNT(l.LineNum) AS TimesInPR,
            SUM(CAST(l.Qty AS decimal(20,4))) AS TotalQty,
            AVG(CAST(l.UnitCost AS decimal(20,4))) AS AvgUnitCost,
            SUM(CAST(l.Qty * l.UnitCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_PRLN] l
        INNER JOIN [db_ptrj_mill].[dbo].[IN_PR] h ON l.DocNo = h.DocNo
        LEFT JOIN [db_ptrj_mill].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode
        WHERE h.DocDate >= DATEADD(YEAR, -1, GETDATE())
        GROUP BY RTRIM(l.ItemCode)
        ORDER BY TotalValue DESC
    """, server, db)

    fname = f"estate_pr.json" if label == "estate" else f"mill_pr.json"
    save(fname, {"report": "Purchase Requisition Analysis", "server": server, "db": db,
                 "generated_at": datetime.now().isoformat(),
                 "pr_status_summary": pr_status["rows"], "monthly_trends": monthly_pr["rows"], "top_30_items": top_pr["rows"]})


# ─────────────────────────────────────────────
# 5. IN_FUELISSUE - Fuel Consumption Analysis
# ─────────────────────────────────────────────
print("\n[5/7] IN_FUELISSUE Analysis...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")

    # Monthly fuel
    monthly_fuel = q(f"""
        SELECT
            YEAR(h.DocDate) AS Year,
            MONTH(h.DocDate) AS Month,
            DATENAME(MONTH, h.DocDate) AS MonthName,
            COUNT(DISTINCT h.DocNo) AS TransactionCount,
            SUM(CAST(h.TotalQty AS decimal(20,4))) AS TotalFuelQty,
            SUM(CAST(h.TotalAmount AS decimal(20,2))) AS TotalAmount,
            AVG(CAST(h.TotalQty AS decimal(20,4))) AS AvgQtyPerTransaction,
            AVG(CAST(h.TotalAmount / NULLIF(h.TotalQty,0) AS decimal(20,4))) AS AvgPricePerUnit
        FROM [db_ptrj_mill].[dbo].[IN_FUELISSUE] h
        WHERE h.DocDate >= DATEADD(YEAR, -2, GETDATE())
        GROUP BY YEAR(h.DocDate), MONTH(h.DocDate), DATENAME(MONTH, h.DocDate)
        ORDER BY Year, Month
    """, server, db)

    # By vehicle/equipment
    by_vehicle = q(f"""
        SELECT TOP 20
            RTRIM(h.VehicleCode) AS VehicleCode,
            RTRIM(MAX(h.VehicleName)) AS VehicleName,
            COUNT(DISTINCT h.DocNo) AS TransactionCount,
            SUM(CAST(h.TotalQty AS decimal(20,4))) AS TotalFuelQty,
            SUM(CAST(h.TotalAmount AS decimal(20,2))) AS TotalAmount,
            AVG(CAST(h.TotalQty AS decimal(20,4))) AS AvgQtyPerUse
        FROM [db_ptrj_mill].[dbo].[IN_FUELISSUE] h
        WHERE h.DocDate >= DATEADD(YEAR, -1, GETDATE())
        GROUP BY RTRIM(h.VehicleCode)
        HAVING SUM(CAST(h.TotalQty AS decimal(20,4))) > 0
        ORDER BY TotalFuelQty DESC
    """, server, db)

    fname = f"estate_fuel.json" if label == "estate" else f"mill_fuel.json"
    save(fname, {"report": "Fuel Consumption Analysis", "server": server, "db": db,
                 "generated_at": datetime.now().isoformat(),
                 "monthly_fuel": monthly_fuel["rows"], "by_vehicle": by_vehicle["rows"]})


# ─────────────────────────────────────────────
# 6. Month-End Snapshot (IN_MTHENDITEM)
# ─────────────────────────────────────────────
print("\n[6/7] IN_MTHENDITEM Month-End Valuation...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")

    # Latest month-end available
    latest_month = q(f"""
        SELECT TOP 1
            RTRIM(PeriodCode) AS PeriodCode,
            COUNT(*) AS ItemCount,
            SUM(CAST(Qty AS decimal(20,4))) AS TotalQty,
            SUM(CAST(Qty * AverageCost AS decimal(20,2))) AS TotalValue
        FROM [db_ptrj_mill].[dbo].[IN_MTHENDITEM]
        GROUP BY RTRIM(PeriodCode)
        ORDER BY PeriodCode DESC
    """, server, db)

    # By product type over time
    by_type_mth = q(f"""
        SELECT TOP 20
            RTRIM(t.Description) AS ProdTypeName,
            SUM(CAST(m.Qty * m.AverageCost AS decimal(20,2))) AS TotalValue,
            SUM(CAST(m.Qty AS decimal(20,4))) AS TotalQty
        FROM [db_ptrj_mill].[dbo].[IN_MTHENDITEM] m
        INNER JOIN [db_ptrj_mill].[dbo].[IN_PRODTYPE] t ON RTRIM(m.ProdTypeCode) = RTRIM(t.Code)
        WHERE m.PeriodCode = (SELECT MAX(PeriodCode) FROM [db_ptrj_mill].[dbo].[IN_MTHENDITEM])
        GROUP BY RTRIM(t.Description)
        ORDER BY TotalValue DESC
    """, server, db)

    fname = f"estate_mthend.json" if label == "estate" else f"mill_mthend.json"
    save(fname, {"report": "Month-End Stock Valuation", "server": server, "db": db,
                 "generated_at": datetime.now().isoformat(),
                 "latest_period": latest_month["rows"], "by_prod_type": by_type_mth["rows"]})


# ─────────────────────────────────────────────
# 7. Lookup Tables - Product Classification
# ─────────────────────────────────────────────
print("\n[7/7] Lookup Tables...")
for label, server, db in [("estate", "SERVER_PROFILE_1", "db_ptrj_mill"), ("mill", "SERVER_PROFILE_3", "db_ptrj_mill")]:
    print(f"  {label}...")
    prodtype = q("SELECT RTRIM(Code) AS Code, RTRIM(Description) AS Description FROM [db_ptrj_mill].[dbo].[IN_PRODTYPE] ORDER BY Code", server, db)
    prodcat = q("SELECT RTRIM(Code) AS Code, RTRIM(Description) AS Description FROM [db_ptrj_mill].[dbo].[IN_PRODCAT] ORDER BY Code", server, db)
    prodmat = q("SELECT RTRIM(Code) AS Code, RTRIM(Description) AS Description FROM [db_ptrj_mill].[dbo].[IN_PRODMAT] ORDER BY Code", server, db)
    prodbrand = q("SELECT RTRIM(Code) AS Code, RTRIM(Description) AS Description FROM [db_ptrj_mill].[dbo].[IN_PRODBRAND] ORDER BY Code", server, db)
    stockanalysis = q("SELECT RTRIM(Code) AS Code, RTRIM(Description) AS Description FROM [db_ptrj_mill].[dbo].[IN_STOCKANALYSIS] ORDER BY Code", server, db)

    fname = f"estate_lookup.json" if label == "estate" else f"mill_lookup.json"
    save(fname, {"report": "Product Classification Lookup Tables", "server": server, "db": db,
                 "generated_at": datetime.now().isoformat(),
                 "IN_PRODTYPE": prodtype["rows"], "IN_PRODCAT": prodcat["rows"],
                 "IN_PRODMAT": prodmat["rows"], "IN_PRODBRAND": prodbrand["rows"],
                 "IN_STOCKANALYSIS": stockanalysis["rows"]})


print(f"\n\nAll reports saved to: {OUTPUT_DIR}")
print(f"Total files: {len([f for f in os.listdir(OUTPUT_DIR) if f.endswith('.json')])}")
