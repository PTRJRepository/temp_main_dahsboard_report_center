# Report Detail — Performance Exploration Notes

**Date:** 2026-07-21  
**Scope:** Client performance hotspots on inventory report detail (monthly especially).  
**Code:** ReportViewerClient fetch/stream/virtualizer + inventory API limits.

---

## 1. What is already good

| Mechanism | Benefit |
| --- | --- |
| `@tanstack/react-virtual` | Avoids DOM for all rows |
| First paint limit `min(pageSize, 500)` | Faster TTI |
| Monthly stream after paint | KPI first, rows later |
| KPI from `summary` not row reduce | Correct + cheap |
| AI delayed 2s + sessionStorage cache | Non-blocking |
| `AbortController` + request seq | Stale response guard |
| GUARDRAIL no setPage bounce | Prevents double full reload UX |

---

## 2. Hotspots / costs

| Hotspot | Why expensive |
| --- | --- |
| Single 6461-line client component | Huge parse/re-render surface; any state tick can re-run many memos |
| `kpiCards` rebuild + multi-rail filters | Extra arrays every payload |
| Client Excel `fetch all` + xlsx | Memory spike 20k–100k rows |
| PDF loops 34 rows OK | Cheap but dishonest |
| `uniqueValues` for filters | Can scan rows for option lists |
| Nested scroll + sticky blur | Paint cost on low-end GPUs |
| Framer motion on shell main | Remount animation on sidebar toggle |
| debugSql:true on fetch | Extra payload/work when admin debug |
| Catalog + detail both heavy | Navigating inventory feels heavy |

---

## 3. Stream model (monthly)

```
fetch page window → set payload → loading false
if monthly incomplete → stream more rows → merge rows
summary KPI stable; table row count grows
metadata.streamComplete when done
```

UI must not block interaction on stream; badge already exists — keep.

API ceilings: interactive window vs limitAll 100k monthly / 20k others.

---

## 4. Performance budget (target)

| Metric | Target |
| --- | --- |
| Time to interactive Ringkasan (summary only) | < 3s on LAN with warm server |
| Table first rows painted | < 4s |
| Scroll FPS virtualized | 50+ on mid laptop |
| Excel export | warn before >5k client rows |
| Re-render on filter chip remove | no full white reload flash |

---

## 5. Recommendations (implement later)

1. Extract workspaces → lazy `React.lazy` / dynamic import for Audit/AI  
2. Memo heavy pure builders outside component file  
3. Don’t default `debugSql: true` in production builds  
4. Virtualize column option lists if huge  
5. Prefer server export job for large Excel  
6. Reduce sticky blur layers  
7. Profile with React Profiler after P3 extract  

---

## 6. Related tests / modules

- `lib/reports/report-detail-performance.ts` (+ tests)  
- inventory route limit logic  
- monthly stream in viewer effect  

---

**End performance notes.**
