# PRD: Optimasi Performa Halaman Report Detail

## 1. Context & Problem Statement

Halaman `/report-center/inventory/[report]` saat ini sangat berat. Analisis root cause menemukan multi-layered performance bottleneck:

| # | Bottleneck | Dampak | Severity |
|---|-----------|--------|----------|
| 1 | `loadAllRows: true` → fetch seluruh dataset (bisa 10K+ row) | Memori & network latency tinggi | Critical |
| 2 | `filteredRows` → client-side filter + sort seluruh rows setiap render | Main thread blocking, UI freeze | Critical |
| 3 | `buildTableGroups` → `shouldSubtotalColumn` scan 20 sample rows per kolom × N grup | O(n×cols) recomputation | High |
| 4 | AI analysis POST → kirim full `ReportPayload` (rows + columns + metadata) | Payload size bisa 5-10MB+ | High |
| 5 | `uniqueValues(rows, field)` → scan 500 rows per filter kolom | 30+ filter columns = 15K iterations | Medium |
| 6 | `useMemo` dengan dependency `payload` → setiap payload change recalculate 8+ memoized values | Double computation on data change | Medium |
| 7 | AI analysis fires on every `aiRefreshKey` increment | Tanpa debounce, spam API call | Medium |
| 8 | `dynamicFilterColumns` useMemo → recalculate entire column list per payload change | Expensive column inference | Medium |

## 2. Design Constraint

**TIDAK mengubah design/tampilan UI.** Semua optimasi dilakukan pada layer data fetching, memoization, dan rendering strategy.

---

## 3. Proposed Solutions (Phase-based)

### Phase 1: Server-side Pagination + Initial Row Limit (Critical Fix)

**Problem:** `loadAllRows: true` fetch seluruh dataset. Tidak ada pagination.

**Solution:**

1. Hapus `loadAllRows: true` → ganti dengan default limit 500 rows.
2. API endpoint `/api/reports/inventory` perlu support pagination params:
   - `page` (default: 1)
   - `pageSize` (default: 100, max: 500)
   - `totalRows` → response include total count untuk pagination UI

3. Update `fetchReport` function:
```typescript
// Before: loadAllRows ? 'all' : 500
// After: use page + pageSize from state, default 100 rows
```

4. Replace infinite scroll → proper paginated table with page numbers.
5. Client-side search/sort hanya berlaku pada loaded page (bukan full dataset).
6. Add "Load More" button untuk append next page (max 5 pages = 500 rows).

**Impact:** Reduce initial payload from ~10K rows → ~500 rows. Loading time 80% faster.

---

### Phase 2: Virtual Scrolling untuk Tabel (Critical Fix)

**Problem:** Rendering 100+ DOM rows = browser lag.

**Solution:**

1. Implement `@tanstack/react-virtual` untuk virtualized table body.
2. Only render visible rows (viewport + 10 buffer rows).
3. Maintain scroll position on filter/sort.

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

// Wrap table body with virtualizer
const rowVirtualizer = useVirtualizer({
  count: pageRows.length,
  getScrollElement: () => tableContainerRef.current,
  estimateSize: () => density === 'compact' ? 36 : 48,
  overscan: 10,
})
```

**Impact:** Render only ~15-20 rows instead of 100+. FPS improvement.

---

### Phase 3: Lazy AI Analysis + Payload Reduction (High Fix)

**Problem:** Full payload sent to AI endpoint (5-10MB+), fires on every filter change.

**Solution:**

1. **Separate AI analysis from main load:**
   - Load report data first → display table immediately
   - AI analysis fires only on explicit "Generate AI Insight" button OR on page idle (after 2s)
   - Remove `aiRefreshKey` auto-fire on payload change

2. **Send minimal payload to AI:**
   - Instead of full `rows[]`, send `summary` + `metadata` + `top 50 samples` (first 50 rows)
   - Remove `chart` from AI payload (AI generates its own charts)

```typescript
// AI payload: before vs after
const before = { rows: payload.rows, columns: payload.columns, summary, metadata, chart }
const after = { 
  summary: payload.summary, 
  metadata: payload.metadata,
  columns: payload.columns.slice(0, 20), // only 20 columns
  sampleRows: payload.rows.slice(0, 50), // only 50 sample rows
}
```

3. **Cache AI result** in sessionStorage with key `${reportId}:${JSON.stringify(filters)}`.
   - Re-display cached AI dashboard on filter revert within same session.

**Impact:** AI API payload reduced 90%+. No AI blocking table load.

---

### Phase 4: Memoization & Computation Optimization (Medium Fix)

**Problem:** Multiple expensive computations on every payload change.

**Solution:**

1. **Debounce filteredRows computation:**
```typescript
// Before: immediate recompute
const filteredRows = useMemo(() => { ... }, [payload, tableSearch, sortColumn, sortDirection])

// After: debounce search/sort by 150ms
const debouncedSearch = useDebouncedValue(tableSearch, 150)
const filteredRows = useMemo(() => { ... }, [payload, debouncedSearch, sortColumn, sortDirection])
```

2. **Cache uniqueValues:**
```typescript
// Before: compute every time
const options = type === 'string' ? uniqueValues(rows, field).slice(0, 80) : []

// After: memoize per field
const uniqueCache = useRef<Map<string, string[]>>(new Map())
const options = uniqueCache.current.get(field) ?? uniqueValues(rows, field).slice(0, 80)
```

3. **Memoize dynamicFilterColumns:**
```typescript
// Only recompute when columns actually change, not on every payload change
const prevColumnsRef = useRef<string[]>([])
const shouldRecompute = prevColumnsRef.current !== payloadColumns
// ...
```

4. **Lazy compute tableTotals:**
```typescript
// Compute totals only when group mode is active, not on every render
const tableTotals = useMemo(() => {
  if (!groupedTableActive) return {}
  return computeTotals(...)
}, [groupedTableActive, filteredRows, visibleColumns])
```

5. **Split `stockAgingKpis` into web worker** if row count > 5000:
   - Move `rows.filter()` → web worker
   - Main thread stays responsive during KPI computation

**Impact:** Reduce recomputation on filter change by 60%.

---

### Phase 5: API-level Optimization (Medium Fix)

**Problem:** `uniqueValues` compute client-side (500 rows × 30 columns = 15K iterations).

**Solution:**

1. API endpoint returns `distinctValues: { [columnName]: string[] }` in response metadata.
   - Server computes via `SELECT DISTINCT col FROM table WHERE ... LIMIT 50`
   - Only for filterable columns (string type)

2. Remove `uniqueValues()` client-side function.

```typescript
// Before: client compute
const options = uniqueValues(rows, field).slice(0, 80)

// After: from metadata
const options = payload.metadata?.distinctValues?.[field] ?? []
```

3. Reduce filterable columns from 30 → 10 (business-critical columns only).
   - Rest can be searched via `contains` operator without dropdown.

**Impact:** Remove 15K+ row iterations on each load.

---

## 4. Implementation Order

| Phase | Priority | Effort | Risk | Impact |
|-------|----------|--------|------|--------|
| Phase 1: Pagination + Row Limit | **P0** | Medium | Low | 80% faster load |
| Phase 2: Virtual Scrolling | **P0** | Medium | Low | Smooth 60fps scrolling |
| Phase 3: Lazy AI + Payload Reduction | **P1** | Medium | Medium | AI tidak block table |
| Phase 4: Memoization | **P1** | Low | Low | 40% less recomputation |
| Phase 5: Server Distinct Values | **P2** | Medium | Medium | Remove 15K iterations |

---

## 5. Acceptance Criteria

- [ ] Initial load: < 2s for 1000+ row reports (Phase 1)
- [ ] Table scroll: smooth 60fps with 10K rows (Phase 2)
- [ ] Table visible before AI analysis starts (Phase 3)
- [ ] Filter change: < 100ms response time (Phase 4)
- [ ] No design changes visible to user
- [ ] All existing features (preset, natural filter, export) still functional

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `ReportViewerClient.tsx` | Phase 1-5 implementation |
| `app/api/reports/inventory/route.ts` | Add pagination, distinct values |
| `app/api/reports/[reportCode]/ai-analysis/route.ts` | Accept minimal payload, caching |

---

## 7. Monitoring Metrics

- Initial load time (LCP): target < 2s
- Time to interactive (TTI): target < 3s
- Memory usage: target < 150MB for 10K rows
- AI analysis latency: non-blocking table load