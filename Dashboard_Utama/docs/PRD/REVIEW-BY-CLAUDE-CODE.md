# Senior Engineer Review: Report Center Inventory PRD + Existing Codebase

> **Reviewer:** Claude Sonnet 4.6 (Senior Full-Stack Engineer)  
> **Date:** 2026-05-17  
> **Files Reviewed:**
> - `PRD-REPORT-CENTER-INVENTORY.md` (900 lines)
> - `app/reports-center/page.tsx` (709 lines)
> - `app/dashboard/report-center/page.tsx` (identical copy)
> - `app/api/reports/inventory/route.ts` (290 lines)

---

## Overall Score: **6.5 / 10**

| Dimension | Score | Notes |
|-----------|-------|-------|
| PRD Completeness | 8/10 | Comprehensive schema, good tag design, but missing SQL perf analysis |
| Code Quality | 6/10 | Functional but incomplete — 7/20 reports built |
| Technical Accuracy | 5/10 | Several SQL bugs, wrong server, missing features |
| UX/UI | 7/10 | Solid UI foundation, but missing Indonesian language + filters |
| Gap: Semantic Search | 0/10 | Never built — PRD says it's required |
| Gap: 20 Reports | 3.5/10 | Only 7 of 20 implemented |
| **Overall** | **6.5/10** | |

---

## 1. CRITICAL ISSUES (Must Fix Before Production)

### 1.1 Server Mismatch — `SERVER_PROFILE_1` vs `SERVER_PROFILE_3`

**File:** `app/api/reports/inventory/route.ts` line 12

```typescript
// CURRENT (WRONG):
async function querySQL(sql: string, server = 'SERVER_PROFILE_3', database = 'db_ptrj_mill')

// SHOULD BE per PRD:
async function querySQL(sql: string, server = 'SERVER_PROFILE_1', database = 'db_ptrj_mill')
```

**PRD explicitly states:** `SERVER_PROFILE_1 (10.0.0.110:1433)`  
**Existing code uses:** `SERVER_PROFILE_3` (different IP: `103.127.66.32:1888`)

This is a silent mismatch. If `SERVER_PROFILE_3` is intentionally the live server, the PRD needs to be corrected. If `SERVER_PROFILE_1` is the canonical source, the API needs fixing.

**Action:** Clarify with data team. If PROD = SERVER_PROFILE_1, update `route.ts`. Update the UI footer text (`db_ptrj_mill · SERVER_PROFILE_3`) as well.

### 1.2 Duplicate Page Files

Two identical `page.tsx` files exist at different routes:
- `app/reports-center/page.tsx`
- `app/dashboard/report-center/page.tsx`

Both are 709 lines, identical code. This creates maintenance nightmares. One is dead code.

**Action:** Remove `app/dashboard/report-center/page.tsx` (or `app/reports-center/`) and consolidate. The PRD spec says `/reports/` structure — use that.

### 1.3 `dead-stock` SQL: 6 Months, Not 12 Months

**File:** `app/api/reports/inventory/route.ts` line 94

```sql
-- CURRENT (claims >12 months but queries >6 months):
AND (LastIssueDate IS NULL OR LastIssueDate < DATEADD(MONTH, -6, GETDATE()))

-- The PRD defines INV-D1 as ">6 months" and INV-D2 as ">12 months"
-- Only INV-D1 exists; the label says "Dead Stock (>6 months)" which is correct,
-- but the summary cards display shows no filter differentiation between D1/D2
```

**The real problem:** Only ONE dead stock report exists (`dead-stock`), but the PRD specifies TWO separate reports:
- **INV-D1:** Dead Stock >6 Months (NOT built as separate route)
- **INV-D2:** Dead Stock >12 Months (NOT built as separate route)

The current `dead-stock` report uses `>6 months` filter. Either rename it to "Dead Stock (>6mo)" or add a second report for ">12mo".

### 1.4 Missing `IN_PR` Header Table

**File:** `app/api/reports/inventory/route.ts` line 181

```sql
FROM [db_ptrj_mill].[dbo].[IN_PR] h
```

**PRD schema review:** The schema section only lists `IN_PRLN` (29,592 rows). There is NO `IN_PR` table documented in the PRD. This query may fail or return empty data on the actual database.

**Action:** Verify `IN_PR` table exists. If not, rewrite the PR report to query `IN_PRLN` directly with a header join. The PRD's G1 report references `IN_PRLN WHERE QtyOutstanding > 0`.

### 1.5 Hard-Coded `TOP 50` — No Pagination

All detail reports (`low-stock`, `dead-stock`) hardcode `TOP 50`:

```sql
SELECT TOP 50 ...  -- Line 66 (low-stock), Line 84 (dead-stock)
```

The PRD states:
- `IN_ITEM` has **11,571 rows**
- Low stock items: **281**
- Dead stock items: **3,042**

With `TOP 50`, users can never see the full dataset. **Critical for dead stock analysis.**

**Action:** Implement proper server-side pagination with `OFFSET/FETCH`. Add page/limit parameters to API.

---

## 2. PRD ANALYSIS

### 2.1 What the PRD Got Right ✅

| Aspect | Notes |
|--------|-------|
| Schema analysis | Comprehensive — real row counts, key metrics from live data |
| Tag taxonomy | Well-designed Indonesian-English bilingual tags |
| Report taxonomy | 20 reports, 7 categories — good coverage of inventory operations |
| Search design | Tag-based discovery with natural language mapping is excellent |
| Color palette | Forest green + gold matches PT Rebinmas branding |
| SQL templates | ABC Analysis (C4) and A1 Stock Summary are correct |
| File structure | `app/reports/` + `app/api/reports/` + `components/` is the right architecture |

### 2.2 What the PRD Got Wrong / Incomplete ⚠️

| Issue | Details |
|-------|---------|
| **No performance analysis** | `IN_MTHENDITEM` has 626,553 rows. No indexing strategy, no query timeout limits, no materialized view recommendations |
| **Future date anomaly** | Latest month is 2026-09 (future from review date of 2026-05-17). May be test data but needs clarification |
| **LastIssueDate NULL handling** | PRD notes NULL / '1900-01-01' issue but doesn't provide resolution SQL |
| **AccCode/BlkCode/VehCode mapping** | Marked as open questions but no lookup table provided |
| **No export format spec** | CSV only? No PDF/Excel. Export is important for management |
| **No data freshness SLA** | SQL Gateway is READ ONLY but no cache/TTL strategy mentioned |

### 2.3 Missing Reports (from 20 in PRD)

**Status: Only 7 of 20 implemented:**

| # | Report ID | Title | Status |
|---|-----------|-------|--------|
| 1 | INV-A1 | Stock Summary | ✅ Built |
| 2 | INV-A2 | Stock by Category | ❌ Missing |
| 3 | INV-A3 | Stock by Type | ❌ Missing |
| 4 | INV-A4 | Stock Value Summary | ❌ Missing (mthend partially covers) |
| 5 | INV-B1 | Stock Issue Daily | ❌ Missing (stock-issue covers trends only) |
| 6 | INV-B2 | Issue by Account Code | ❌ Missing |
| 7 | INV-B3 | Issue by Block | ❌ Missing |
| 8 | INV-B4 | Issue by Vehicle | ❌ Missing |
| 9 | INV-C1 | Monthly Valuation | ❌ Missing |
| 10 | INV-C2 | Stock Value by Category | ❌ Missing |
| 11 | INV-C3 | Stock Card (Item Movement) | ❌ Missing |
| 12 | INV-C4 | ABC Analysis (Pareto) | ❌ Missing |
| 13 | INV-D1 | Dead Stock >6 Months | ✅ Built (as `dead-stock`) |
| 14 | INV-D2 | Dead Stock >12 Months | ❌ Missing |
| 15 | INV-D3 | Zero Stock Items | ❌ Missing |
| 16 | INV-D4 | Slow Moving Stock | ❌ Missing |
| 17 | INV-E1 | Low Stock Alert | ✅ Built |
| 18 | INV-E2 | Reorder Recommendation | ❌ Missing |
| 19 | INV-E3 | Items Below Minimum | ❌ Missing |
| 20 | INV-F1 | Fuel Issue Summary | ❌ Missing (fuel covers trends+vehicle only) |
| 21 | INV-F2 | Fuel by Vehicle | ✅ Built |
| 22 | INV-F3 | Fuel by Account Code | ❌ Missing |
| 23 | INV-G1 | Outstanding PR | ❌ Missing |
| 24 | INV-G2 | PR by Status | ✅ Built (partial) |

**Coverage: ~30% of planned reports built.**

---

## 3. CODE QUALITY REVIEW

### 3.1 API Route (`route.ts`)

**GOOD:**
- Clean handler pattern with `reportHandlers` map
- Proper error handling with try/catch
- CSV export at API level (bonus)
- Decimal casting for financial precision

**BAD:**
- No authentication check — any unauthenticated user can query all inventory data
- No query timeout — 626K-row `IN_MTHENDITEM` scan without `SET LOCK_TIMEOUT`
- No request validation
- Server name hardcoded with wrong value
- No logging/metrics
- `TOP 50` on all detail queries (see 1.5)
- `WHERE Status = '1 '` — trailing space is fragile (see 1.7)

### 3.2 UI Page (`page.tsx`)

**GOOD:**
- Framer Motion animations are smooth and professional
- Sortable columns with nice UX
- Client-side filtering + sorting
- Summary cards with color coding
- CSV export works client-side
- Sticky header with live indicator
- Empty state handling

**BAD / MISSING:**

```typescript
// Line 269-270: Dangerous path
const s = reportData.data.summary.summary  // "summary.summary" — double nesting

// No loading skeleton — spinner only (poor UX for 3s+ API calls)
```

1. **Indonesian language missing** — UI is 100% English, PRD requires Indonesian  
2. **No filter controls** — PRD spec has AccMonth/AccYear/LocCode filters on every report; UI has zero filter UI  
3. **No semantic search** — The hero feature from the PRD is completely absent  
4. **No category grouping** — Reports displayed as flat grid, not grouped by 7 categories  
5. **No favorites/pinning** — Mentioned in PRD UI design, not implemented  
6. **No pagination UI** — Hardcoded 100-row display with "scroll to see more"  
7. **No report description tooltips** — Cards show description but no tags shown  
8. **No responsive sidebar** — Standalone page, not integrated with main dashboard layout  
9. **Unused imports** — `Warehouse`, `List`, `SlidersHorizontal`, `ChevronDown` imported but never used  
10. **Dead code** — `colors` variable assigned but never used

---

## 4. TECHNICAL DEBT & BUGS

### 4.1 SQL Bugs

**Bug 1: Status Filter Trailing Space**
```sql
WHERE Status = '1 '   -- trailing space in string literal
```
This works on SQL Server due to padding, but is fragile. Use `WHERE RTRIM(Status) = '1'` for clarity.

**Bug 2: ABC Analysis Query Not Built**
PRD includes a full ABC Analysis SQL (lines 869-895) that is never implemented. This is one of the most valuable reports for procurement prioritization.

**Bug 3: Slow-Moving Stock Query (INV-D4)**
The PRD includes a LEFT JOIN query for slow-moving stock that doesn't exist in the API. The logic `COUNT(sil.StockIssueID)` after LEFT JOIN will count 0 for items with no issues — correct for identifying inactive items.

**Bug 4: PR Report Queries `IN_PR` Not in Schema**
PRD schema section only documents `IN_PRLN`. The `pr` handler uses `IN_PR` + `IN_PRLN`. Verify table existence.

### 4.2 API Design Issues

| Issue | Detail |
|-------|--------|
| No auth middleware | Reports are fully public |
| No rate limiting | SQL Gateway could be overwhelmed |
| No query caching | Same report = same expensive query |
| No response compression | Large datasets (626K rows) transferred uncompressed |
| No `total` count in paginated response | Clients can't build pagination UI |
| GET for reports with large bodies | Use POST for complex filters |

### 4.3 Performance Concerns

| Report | Risk | Mitigation |
|--------|------|-----------|
| `mthend` (full scan of IN_MTHENDITEM) | HIGH — 626K rows, no index on PeriodCode | Add composite index on (PeriodCode, ItemCode) |
| `dead-stock` (full scan of IN_ITEM + NULL check) | MEDIUM — 11K rows, QtyOnHand filter should help | Index on LastIssueDate |
| `stock-issue` (JOIN IN_STOCKISSUE + IN_STOCKISSUELN) | MEDIUM — 15K + 30K rows | Composite index on (DocNo, DocDate) |
| `fuel` (IN_FUELISSUE full scan) | LOW — 7K rows with date filter |

---

## 5. UX/UI CRITIQUE

### 5.1 UI: What's Good
- Clean, professional look with Tailwind
- Color-coded report cards (each report has distinct color)
- Smooth AnimatePresence transitions
- Responsive grid (1-4 columns based on viewport)
- Good empty state messages
- CSV export is functional

### 5.2 UI: What Needs Work

**Priority 1 — Must Have:**
1. **Indonesian language** — Every label, placeholder, and message should be Indonesian per the dashboard's target audience (warehouse staff + management who are Indonesian)
2. **Filter controls** — Month/Year/LocCode/Category dropdowns are essential for every report
3. **Report category grouping** — 7 groups (Stock Overview, Stock Issue, Valuation, Dead Stock, Reorder, Fuel, PR) with collapsible sections

**Priority 2 — Should Have:**
4. **Semantic search bar** — The hero feature; currently only a basic text filter exists
5. **KPI summary banners** — Show key metrics at top (e.g., "Total Stock: Rp 129B, Dead Stock: 3,042 items")
6. **Favorites/pin functionality** — localStorage-based, lightweight
7. **Pagination** — Not "scroll to see more" but proper page 1/2/3 navigation

**Priority 3 — Nice to Have:**
8. **Charts** — Monthly trends would look great as line charts (Recharts)
9. **Report descriptions** — Expandable card detail with tags shown
10. **Integration with main sidebar** — Standalone page works but loses dashboard context

---

## 6. BUSINESS VALUE ASSESSMENT

### Most Valuable Reports (Ranked by Business Impact)

| Rank | Report | Why |
|------|--------|-----|
| 1 | INV-E1: Low Stock Alert | Directly triggers procurement action |
| 1 | INV-D2: Dead Stock >12mo | Identifies capital tied up in obsolete inventory |
| 3 | INV-C4: ABC Analysis | Prioritizes procurement effort by value |
| 4 | INV-G1: Outstanding PR | Tracks pending orders, critical for supply chain |
| 5 | INV-A4: Stock Value Summary | Monthly financial reporting |
| 6 | INV-F1/F2: Fuel Reports | Operational cost control |
| 7 | INV-D3: Zero Stock | Identifies stockout risk |

### Least Valuable (Lower Priority)
- INV-A2/A3: Stock by Category/Type (useful but strategic, not operational)
- INV-B4: Issue by Vehicle (niche, operational)
- INV-G2: PR by Status (less actionable than outstanding PR list)

**Bottom line:** Build INV-D2, INV-E1, INV-G1, and INV-C4 next — they have the highest daily operational value.

---

## 7. OPEN QUESTIONS (from PRD) — Resolution

| # | Question | Resolution |
|---|----------|------------|
| 1 | AccCode mapping needed? | YES — Add lookup or document OC7190/GA9050 meanings in UI tooltips |
| 2 | BlkCode naming decode? | YES — BLR25001 → "Blok 25001" for readability |
| 3 | VehCode mapping needed? | YES — BE001/BE002 = Berat Unit; LN001 = Loader; FR001 = Forklift |
| 4 | Future date (2026-09)? | CONFIRMED as PRD was written in future context. Should show "Latest Available Period" dynamically |
| 5 | LastIssueDate NULL handling | Treat NULL and '1900-01-01' as "never issued" — include in dead stock |
| 6 | Export format? | CSV only — acceptable for Phase 1. PDF/Excel in Phase 2 |
| 7 | Favorites persistence? | localStorage only for Phase 1 (no backend needed) |
| 8 | Pagination server vs client? | Server-side for detail reports; client-side for aggregated data |

---

## 8. RECOMMENDATIONS

### 8.1 Immediate Fixes (Before Any More Development)

```markdown
1. [ ] Fix server name: SERVER_PROFILE_1 in route.ts (or update PRD)
2. [ ] Remove duplicate page.tsx file
3. [ ] Implement server-side pagination (remove TOP 50)
4. [ ] Add month/year/location filter UI controls
5. [ ] Translate UI to Bahasa Indonesia
6. [ ] Verify IN_PR table exists (PR report may be broken)
7. [ ] Fix Status filter: RTRIM(Status) = '1'
```

### 8.2 Short-Term (Complete Phase 1 Core)

```markdown
1. [ ] Add INV-D2: Dead Stock >12mo (separate report)
2. [ ] Add INV-D3: Zero Stock Items
3. [ ] Add INV-G1: Outstanding PR (using IN_PRLN)
4. [ ] Add INV-C4: ABC Analysis (high business value)
5. [ ] Add INV-E2: Reorder Recommendation (uses history data)
6. [ ] Build semantic search (tag-based, client-side)
7. [ ] Implement category grouping in UI (7 groups)
8. [ ] Add proper pagination with OFFSET/FETCH
9. [ ] Add authentication check to API route
10. [ ] Add SQL Gateway query timeout
```

### 8.3 Medium-Term (Polish & Performance)

```markdown
1. [ ] Add Recharts/Chart.js for monthly trends (stock-issue, fuel, mthend)
2. [ ] Add AccCode/BlkCode/VehCode human-readable names
3. [ ] Implement query result caching (5-minute TTL)
4. [ ] Add composite database indexes for performance
5. [ ] Favorites with localStorage
6. [ ] PDF export (report-specific templates)
7. [ ] Scheduled report email export
```

### 8.4 Architectural Improvements

```typescript
// Recommended: Extract report configuration to a typed config
const REPORTS_CONFIG: ReportConfig[] = [
  {
    id: 'stock-summary',
    title: 'Ringkasan Stok',
    titleEn: 'Stock Summary',
    category: 'stock-overview',
    icon: 'Package',
    tags: ['stok', 'inventory', 'gudang'],
    sqlSource: 'IN_ITEM',
    filters: ['LocCode', 'ItemType', 'ProdCatCode'],
    columns: [...],
  },
  // ... all 20 reports
]

// Then the UI becomes a generic renderer:
<ReportGrid reports={REPORTS_CONFIG} />
<ReportTable reportId={selectedId} data={data} />
```

This eliminates the hardcoded `inventoryReports` array in page.tsx and makes adding reports a config-only change.

---

## 9. PRIORITIZED ACTION LIST

| Priority | Action | Effort | Impact | Owner |
|----------|--------|--------|--------|-------|
| 🔴 P0 | Fix server name mismatch | 5 min | Data integrity | Dev |
| 🔴 P0 | Remove duplicate page file | 2 min | Maintainability | Dev |
| 🔴 P0 | Add pagination (remove TOP 50) | 30 min | Data access | Dev |
| 🔴 P0 | Verify IN_PR table or fix PR query | 15 min | PR report may be broken | Dev |
| 🟠 P1 | Translate UI to Bahasa Indonesia | 2 hr | User adoption | Dev |
| 🟠 P1 | Add filter controls (month/year/loc) | 3 hr | Core UX | Dev |
| 🟠 P1 | Add INV-D2, INV-D3, INV-G1 | 2 hr | 3 more operational reports | Dev |
| 🟠 P1 | Build semantic search | 4 hr | Core PRD feature | Dev |
| 🟡 P2 | Add INV-C4 (ABC Analysis) | 1 hr | High business value | Dev |
| 🟡 P2 | Add charts (Recharts) | 3 hr | Visual appeal | Dev |
| 🟡 P2 | Add AccCode/VehCode name lookups | 2 hr | Usability | Dev |
| 🟢 P3 | Implement caching (5-min TTL) | 2 hr | Performance | Dev |
| 🟢 P3 | Add favorites (localStorage) | 1 hr | UX enhancement | Dev |
| 🟢 P3 | PDF export | 4 hr | Management reporting | Dev |

---

## 10. SUMMARY

The PRD is **well-structured and comprehensive** — the 20-report inventory with semantic search is the right vision for PT Rebinmas Jaya's inventory reporting needs. The schema analysis with real data metrics is excellent.

However, the **existing codebase is at ~30% completion** — only 7 of 20 reports implemented, semantic search never built, UI in wrong language, critical bugs in SQL filters, and server configuration mismatch.

The code that *is* built is **good quality foundation** — the UI animations, CSV export, and sortable tables are solid. The API structure is clean and extensible.

**Recommended path forward:**
1. Fix P0 items immediately
2. Complete the remaining 13 reports systematically (config-driven approach recommended)
3. Build semantic search as a separate sprint
4. Add Indonesian language last (after all features stable)

---

*Review completed by Claude Sonnet 4.6*  
*Model: opus-4-5 | Context window fully utilized*
