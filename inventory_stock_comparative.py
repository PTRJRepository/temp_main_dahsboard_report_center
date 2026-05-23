#!/usr/bin/env python3
"""IN_STOCK tables deep-dive + Estate vs Mill comparative analysis."""
import json, urllib.request, urllib.error

GATEWAY = "http://localhost:8001/v1/query"
API_KEY = "2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"

def sql(server, query, params=None):
    body = {"server": server, "query": query}
    if params: body["params"] = params
    req = urllib.request.Request(
        GATEWAY,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {API_KEY}"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())

def col_defs(rows):
    """Guess column definitions from row data."""
    if not rows: return []
    return [{"name": k, "type": type(v).__name__} for k, v in rows[0].items()]

def sample(server, table, n=5, where="", extra=""):
    q = f"SELECT TOP {n} * FROM {table}"
    if where: q += f" WHERE {where}"
    q += f" {extra}".rstrip()
    try:
        r = sql(server, q)
        return r.get("rows", [])
    except Exception as e:
        return [{"error": str(e)}]

def count(server, table):
    try:
        r = sql(server, f"SELECT COUNT(*) as cnt FROM {table}")
        return r.get("rows", [{}])[0].get("cnt", "?")
    except:
        return "?"

print("=" * 60)
print("IN_STOCK TABLES DEEP-DIVE")
print("=" * 60)

# ── Row counts ──────────────────────────────────────────────
tables = ["IN_STOCKISSUE","IN_STOCKISSUELN","IN_STOCKRTN","IN_STOCKRTNLN","IN_STOCKADJ","IN_STOCKADJLN"]
print("\n### Row Counts (Estate=SP1, Mill=SP3)")
print(f"{'Table':<22} {'Estate':>10} {'Mill':>10}")
for t in tables:
    ce, cm = count("SERVER_PROFILE_1", t), count("SERVER_PROFILE_3", t)
    print(f"{t:<22} {str(ce):>10} {str(cm):>10}")

# ── IN_STOCKISSUE schema + sample ──────────────────────────
print("\n## IN_STOCKISSUE (Header)")
r = sql("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKISSUE WHERE 1=0")
cols = list(r.get("columns", []))
print(f"Columns ({len(cols)}): {cols}")

rows = sample("SERVER_PROFILE_1", "IN_STOCKISSUE", n=3, extra="ORDER BY CreateDate DESC")
for row in rows:
    print(f"  {row}")

# ── IN_STOCKISSUELN schema + sample ────────────────────────
print("\n## IN_STOCKISSUELN (Line)")
r = sql("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKISSUELN WHERE 1=0")
cols = list(r.get("columns", []))
print(f"Columns ({len(cols)}): {cols}")

rows = sample("SERVER_PROFILE_1", "IN_STOCKISSUELN", n=5, extra="ORDER BY 1 DESC")
for row in rows:
    print(f"  {row}")

# Top items issued
print("\n## Top 10 Items Issued (Estate SP1)")
r = sql("SERVER_PROFILE_1", """
    SELECT TOP 10 l.ItemCode, i.Description, SUM(l.Qty) as TotalQty, SUM(l.Amount) as TotalAmount
    FROM IN_STOCKISSUELN l
    LEFT JOIN IN_ITEMCODE i ON l.ItemCode = i.ItemCode
    GROUP BY l.ItemCode, i.Description
    ORDER BY TotalQty DESC
""")
for row in r.get("rows", []):
    print(f"  {row}")

# ── IN_STOCKRTN schema + sample ────────────────────────────
print("\n## IN_STOCKRTN (Return Header)")
r = sql("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKRTN WHERE 1=0")
cols = list(r.get("columns", []))
print(f"Columns ({len(cols)}): {cols}")

rows = sample("SERVER_PROFILE_1", "IN_STOCKRTN", n=3, extra="ORDER BY CreateDate DESC")
for row in rows:
    print(f"  {row}")

# ── IN_STOCKADJ schema + sample ────────────────────────────
print("\n## IN_STOCKADJ (Adjustment Header)")
r = sql("SERVER_PROFILE_1", "SELECT TOP 3 * FROM IN_STOCKADJ WHERE 1=0")
cols = list(r.get("columns", []))
print(f"Columns ({len(cols)}): {cols}")

rows = sample("SERVER_PROFILE_1", "IN_STOCKADJ", n=3, extra="ORDER BY CreateDate DESC")
for row in rows:
    print(f"  {row}")

# ── Comparative: Estate vs Mill ────────────────────────────
print("\n" + "=" * 60)
print("COMPARATIVE: ESTATE (SP1) vs MILL (SP3)")
print("=" * 60)

# Row count comparison across all IN_* tables
all_tables = [
    "IN_ITEM","IN_ITEMCODE","IN_FUELISSUE","IN_FUELISSUELN",
    "IN_FUELRTN","IN_FUELRTNLN","IN_PR","IN_PRLN","IN_PRLN_ACC",
    "IN_MTHENDITEM","IN_MTHENDTRX","IN_ITEM_ACC",
    "IN_PRODTYPE","IN_PRODCAT","IN_PRODMAT","IN_PRODBRAND",
    "IN_PRODMODEL","IN_STOCKANALYSIS",
    "IN_STOCKISSUE","IN_STOCKISSUELN","IN_STOCKRTN","IN_STOCKRTNLN",
    "IN_STOCKADJ","IN_STOCKADJLN"
]

print(f"\n{'Table':<22} {'Estate':>10} {'Mill':>10} {'Diff':>8}")
for t in all_tables:
    ce = count("SERVER_PROFILE_1", t)
    cm = count("SERVER_PROFILE_3", t)
    try:
        diff = int(cm) - int(ce)
    except:
        diff = "?"
    print(f"{t:<22} {str(ce):>10} {str(cm):>10} {str(diff):>8}")

# Monthly fuel issue comparison
print("\n## Monthly Fuel Issue Qty (Estate vs Mill, Last 6 months)")
r1 = sql("SERVER_PROFILE_1", """
    SELECT RTRIM(AccYear)+'/'+RTRIM(AccMonth) as Period, COUNT(*) as Issues, SUM(l.Qty) as TotalLiters
    FROM IN_FUELISSUE h
    JOIN IN_FUELISSUELN l ON h.FuelIssueID = l.FuelIssueID
    WHERE AccYear IN ('2026','2025') AND AccMonth IN ('01','02','03','04','05','06','07','08','09','10','11','12')
    GROUP BY RTRIM(AccYear), RTRIM(AccMonth)
    ORDER BY AccYear DESC, AccMonth DESC
    OFFSET 0 ROWS FETCH NEXT 12 ROWS ONLY
""")
r3 = sql("SERVER_PROFILE_3", """
    SELECT RTRIM(AccYear)+'/'+RTRIM(AccMonth) as Period, COUNT(*) as Issues, SUM(l.Qty) as TotalLiters
    FROM IN_FUELISSUE h
    JOIN IN_FUELISSUELN l ON h.FuelIssueID = l.FuelIssueID
    WHERE AccYear IN ('2026','2025') AND AccMonth IN ('01','02','03','04','05','06','07','08','09','10','11','12')
    GROUP BY RTRIM(AccYear), RTRIM(AccMonth)
    ORDER BY AccYear DESC, AccMonth DESC
    OFFSET 0 ROWS FETCH NEXT 12 ROWS ONLY
""")
est_m = {row["Period"]: row for row in r1.get("rows", [])}
mill_m = {row["Period"]: row for row in r3.get("rows", [])}
all_periods = sorted(set(list(est_m.keys()) + list(mill_m.keys())), reverse=True)[:12]
print(f"{'Period':<12} {'Estate-Liters':>15} {'Mill-Liters':>15}")
for p in all_periods:
    ev = est_m.get(p, {}).get("TotalLiters", 0) or 0
    mv = mill_m.get(p, {}).get("TotalLiters", 0) or 0
    print(f"{p:<12} {ev:>15,.0f} {mv:>15,.0f}")

# Top stock items by value
print("\n## Top 10 Stock Items by Qty On Hand (Estate SP1)")
r = sql("SERVER_PROFILE_1", """
    SELECT TOP 10 ItemCode, RTRIM(UOMCode) as UOM, QtyOnHand, AverageCost,
           (QtyOnHand * AverageCost) as StockValue
    FROM IN_ITEMCODE
    WHERE QtyOnHand > 0
    ORDER BY QtyOnHand DESC
""")
print(f"{'ItemCode':<15} {'UOM':<8} {'QtyOnHand':>15} {'AvgCost':>18} {'StockValue':>20}")
for row in r.get("rows", []):
    print(f"{row['ItemCode']:<15} {str(row.get('UOM','')):<8} {row.get('QtyOnHand',0):>15,.2f} {row.get('AverageCost',0):>18,.2f} {row.get('StockValue',0):>20,.2f}")

# PR status summary
print("\n## PR Status Distribution (Estate vs Mill)")
r1 = sql("SERVER_PROFILE_1", """
    SELECT RTRIM(Status) as Status, COUNT(*) as cnt
    FROM IN_PR GROUP BY RTRIM(Status) ORDER BY Status
""")
r3 = sql("SERVER_PROFILE_3", """
    SELECT RTRIM(Status) as Status, COUNT(*) as cnt
    FROM IN_PR GROUP BY RTRIM(Status) ORDER BY Status
""")
print(f"{'Status':<10} {'Estate':>10} {'Mill':>10} {'Meaning'}")
status_meaning = {'1':'Open','2':'Approved','3':'Partial','4':'Fulfilled','6':'Closed'}
for row in r1.get("rows", []):
    st = row["Status"].strip()
    ec = row["cnt"]
    mc = next((r["cnt"] for r in r3.get("rows",[]) if r["Status"].strip()==st), 0)
    print(f"{st:<10} {ec:>10} {mc:>10}   {status_meaning.get(st,'?')}")

print("\nDONE.")
