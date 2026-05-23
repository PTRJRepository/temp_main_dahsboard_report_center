#!/usr/bin/env python3
"""IN_STOCK tables deep-dive + comparative analysis."""
import json, urllib.request

GATEWAY = "http://localhost:8001/v1/query"
API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"

def sql(server, q):
    body = {"sql": q, "server": server, "database": "db_ptrj_mill"}
    req = urllib.request.Request(
        GATEWAY, data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "x-api-key": API_KEY},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        d = json.loads(r.read())
        if not d.get("success"):
            return {"data": {"recordset": []}, "error": d.get("error")}
        return d["data"]

def rows(server, q):
    return sql(server, q).get("recordset", [])

def cnt(server, table):
    r = rows(server, f"SELECT COUNT(*) as cnt FROM {table}")
    return r[0].get("cnt", "?") if r else "?"

def top_items(server, n=10):
    return rows(server, f"""
        SELECT TOP {n} i.ItemCode, RTRIM(i.Description) as Desc,
               i.QtyOnHand, i.AverageCost, i.UOMCode,
               (i.QtyOnHand * i.AverageCost) as StockValue,
               RTRIM(i.ItemType) as ItemType
        FROM IN_ITEMCODE i
        WHERE i.Status = '1 ' AND i.QtyOnHand > 0
        ORDER BY i.QtyOnHand DESC
    """)

print("=" * 65)
print("IN_STOCK TABLES + ESTATE vs MILL COMPARATIVE ANALYSIS")
print("=" * 65)

# Row counts
tables = ["IN_STOCKISSUE","IN_STOCKISSUELN","IN_STOCKRTN","IN_STOCKRTNLN",
          "IN_STOCKADJ","IN_STOCKADJLN","IN_STOCKRECEIVE","IN_STOCKTRANSFER"]
print("\n--- Row Counts ---")
print(f"{'Table':<22} {'Estate(SP1)':>12} {'Mill(SP3)':>12} {'Diff':>8}")
for t in tables:
    ce, cm = cnt("SERVER_PROFILE_1", t), cnt("SERVER_PROFILE_3", t)
    try: diff = int(cm) - int(ce)
    except: diff = "?"
    print(f"{t:<22} {str(ce):>12} {str(cm):>12} {str(diff):>8}")

# IN_STOCKISSUE schema
print("\n--- IN_STOCKISSUE (Header) ---")
r = sql("SERVER_PROFILE_1", "SELECT TOP 2 * FROM IN_STOCKISSUE WHERE 1=0")
cols = list(r.get("recordset", [{}])[0].keys()) if r.get("recordset") else []
print(f"Columns ({len(cols)}): {cols}")

r = rows("SERVER_PROFILE_1", """
    SELECT TOP 3 si.StockIssueID, si.LocCode, si.Status, si.TotalAmount,
           si.CreateDate, si.UpdateDate, sl.ItemCode, sl.Qty, sl.Amount as LineAmount
    FROM IN_STOCKISSUE si
    JOIN IN_STOCKISSUELN sl ON si.StockIssueID = sl.StockIssueID
    ORDER BY si.CreateDate DESC
""")
for row in r:
    print(f"  {row}")

# IN_STOCKISSUELN schema
print("\n--- IN_STOCKISSUELN (Line) ---")
r = sql("SERVER_PROFILE_1", "SELECT TOP 2 * FROM IN_STOCKISSUELN WHERE 1=0")
cols = list(r.get("recordset", [{}])[0].keys()) if r.get("recordset") else []
print(f"Columns ({len(cols)}): {cols}")

r = rows("SERVER_PROFILE_3", """
    SELECT TOP 5 sl.StockIssueLNID, sl.StockIssueID, sl.ItemCode,
           sl.Qty, sl.Unit, sl.Cost, sl.Amount, sl.AccCode, sl.BlkCode, sl.VehCode
    FROM IN_STOCKISSUELN sl
    ORDER BY sl.StockIssueLNID DESC
""")
for row in r:
    print(f"  {row}")

# Top items issued
print("\n--- Top 10 Items Issued (Estate SP1) ---")
r = rows("SERVER_PROFILE_1", """
    SELECT TOP 10 sl.ItemCode, RTRIM(i.Description) as Desc,
           SUM(sl.Qty) as TotalQty, SUM(sl.Amount) as TotalAmount
    FROM IN_STOCKISSUELN sl
    LEFT JOIN IN_ITEMCODE i ON RTRIM(sl.ItemCode) = RTRIM(i.ItemCode)
    GROUP BY sl.ItemCode, i.Description
    ORDER BY TotalQty DESC
""")
print(f"{'ItemCode':<15} {'Desc':<30} {'Qty':>12} {'Amount':>15}")
for row in r:
    desc = str(row.get('Desc',''))[:30]
    print(f"{row['ItemCode']:<15} {desc:<30} {row.get('TotalQty',0):>12,.2f} {row.get('TotalAmount',0):>15,.2f}")

# IN_STOCKRTN
print("\n--- IN_STOCKRTN (Return Header) ---")
r = sql("SERVER_PROFILE_1", "SELECT TOP 2 * FROM IN_STOCKRTN WHERE 1=0")
cols = list(r.get("recordset", [{}])[0].keys()) if r.get("recordset") else []
print(f"Columns ({len(cols)}): {cols}")
r = rows("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKRTN ORDER BY CreateDate DESC")
for row in r:
    print(f"  {row}")

# IN_STOCKRTNLN
print("\n--- IN_STOCKRTNLN (Return Line) ---")
r = sql("SERVER_PROFILE_1", "SELECT TOP 2 * FROM IN_STOCKRTNLN WHERE 1=0")
cols = list(r.get("recordset", [{}])[0].keys()) if r.get("recordset") else []
print(f"Columns ({len(cols)}): {cols}")
r = rows("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKRTNLN ORDER BY 1 DESC")
for row in r:
    print(f"  {row}")

# IN_STOCKADJ
print("\n--- IN_STOCKADJ (Adjustment Header) ---")
r = sql("SERVER_PROFILE_1", "SELECT TOP 2 * FROM IN_STOCKADJ WHERE 1=0")
cols = list(r.get("recordset", [{}])[0].keys()) if r.get("recordset") else []
print(f"Columns ({len(cols)}): {cols}")
r = rows("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKADJ ORDER BY CreateDate DESC")
for row in r:
    print(f"  {row}")

# IN_STOCKADJLN
print("\n--- IN_STOCKADJLN (Adjustment Line) ---")
r = sql("SERVER_PROFILE_1", "SELECT TOP 2 * FROM IN_STOCKADJLN WHERE 1=0")
cols = list(r.get("recordset", [{}])[0].keys()) if r.get("recordset") else []
print(f"Columns ({len(cols)}): {cols}")
r = rows("SERVER_PROFILE_1", "SELECT TOP 5 * FROM IN_STOCKADJLN ORDER BY 1 DESC")
for row in r:
    print(f"  {row}")

# Monthly stock issue trend
print("\n--- Monthly Stock Issue Lines (Estate SP1, last 12 months) ---")
r = rows("SERVER_PROFILE_1", """
    SELECT RTRIM(h.AccYear)+'/'+RTRIM(h.AccMonth) as Period,
           COUNT(*) as Issues, SUM(l.Qty) as TotalQty, SUM(l.Amount) as TotalAmount
    FROM IN_STOCKISSUE h
    JOIN IN_STOCKISSUELN l ON h.StockIssueID = l.StockIssueID
    WHERE h.AccYear >= '2025'
    GROUP BY RTRIM(h.AccYear), RTRIM(h.AccMonth)
    ORDER BY h.AccYear DESC, h.AccMonth DESC
""")
print(f"{'Period':<12} {'Issues':>8} {'Qty (Lns)':>12} {'Amount':>18}")
for row in r:
    print(f"{row['Period']:<12} {row.get('Issues',0):>8} {row.get('TotalQty',0):>12,.0f} {row.get('TotalAmount',0):>18,.2f}")

# COMPARATIVE
print("\n" + "=" * 65)
print("COMPARATIVE: ESTATE (SP1) vs MILL (SP3)")
print("=" * 65)

all_tables = [
    "IN_ITEM","IN_ITEMCODE","IN_FUELISSUE","IN_FUELISSUELN","IN_FUELRTN","IN_FUELRTNLN",
    "IN_PR","IN_PRLN","IN_PRLN_ACC","IN_MTHENDITEM","IN_MTHENDTRX","IN_ITEM_ACC",
    "IN_PRODTYPE","IN_PRODCAT","IN_PRODMAT","IN_PRODBRAND","IN_PRODMODEL","IN_STOCKANALYSIS",
    "IN_STOCKISSUE","IN_STOCKISSUELN","IN_STOCKRTN","IN_STOCKRTNLN","IN_STOCKADJ","IN_STOCKADJLN"
]
print(f"\n{'Table':<22} {'Estate(SP1)':>12} {'Mill(SP3)':>12} {'Diff':>8}")
for t in all_tables:
    ce = cnt("SERVER_PROFILE_1", t)
    cm = cnt("SERVER_PROFILE_3", t)
    try: diff = int(cm) - int(ce)
    except: diff = "?"
    print(f"{t:<22} {str(ce):>12} {str(cm):>12} {str(diff):>8}")

# Stock value comparison
print("\n--- Stock Value Summary (Estate SP1) ---")
r = rows("SERVER_PROFILE_1", """
    SELECT RTRIM(ItemType) as ItemType, COUNT(*) as Items,
           SUM(QtyOnHand) as TotalQty, SUM(QtyOnHand*AverageCost) as TotalValue
    FROM IN_ITEMCODE
    WHERE Status = '1 '
    GROUP BY RTRIM(ItemType)
    ORDER BY TotalValue DESC
""")
print(f"{'ItemType':<12} {'Items':>8} {'Qty On Hand':>15} {'Stock Value':>18}")
for row in r:
    print(f"{row.get('ItemType',''):<12} {row.get('Items',0):>8} {row.get('TotalQty',0):>15,.2f} {row.get('TotalValue',0):>18,.2f}")

print("\nDONE.")