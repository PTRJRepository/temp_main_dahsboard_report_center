# Implementation Plan — PT Rebinmas Jaya Report Center
**Version:** 1.0 | **Date:** 2026-05-17 | **Duration:** 6 Weeks

---

## Overview

Build PT Rebinmas Jaya Report Center — modern enterprise report portal with 27 Inventory reports (Group A-H), semantic search, preview panel, and export functionality. Phased approach, 6 weeks.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, TanStack Query, Zustand, Shadcn/UI

---

## Phase 0: Foundation (Week 0) — 2 days

### Goals
- [ ] Project setup (Next.js 14, TypeScript, Tailwind)
- [ ] Design system: colors, typography, spacing tokens
- [ ] AppShell layout: Sidebar + Topbar + ContentArea
- [ ] Route structure and middleware
- [ ] API route skeleton for SQL Gateway

### Deliverables
- [ ] `app/report-center/page.tsx` — public page shell
- [ ] `app/report-center/layout.tsx` — AppShell wrapper
- [ ] `components/layout/Sidebar.tsx` — collapsible sidebar
- [ ] `components/layout/Topbar.tsx` — topbar with search
- [ ] `lib/reports/inventory/config.ts` — 27 report configs
- [ ] `app/api/reports/inventory/route.ts` — API skeleton

### Checkpoint
- Sidebar collapses/expands ✓
- Topbar shows with placeholder search ✓
- Reports-center page loads without error ✓

---

## Phase 1: Dashboard & Module Cards (Week 1) — 3 days

### Goals
- [ ] HeroBanner with system status
- [ ] ModuleGrid with 9 module cards
- [ ] GlobalSearch (Ctrl+K modal)
- [ ] FilterChips for quick filters
- [ ] Favorites/Recent panels
- [ ] SystemInfo panel

### Deliverables
- [ ] `components/dashboard/HeroBanner.tsx`
- [ ] `components/dashboard/ModuleCard.tsx` × 9
- [ ] `components/search/GlobalSearch.tsx` — Ctrl+K trigger
- [ ] `components/dashboard/FavoritesPanel.tsx`
- [ ] `components/dashboard/RecentReportsPanel.tsx`
- [ ] `components/dashboard/SystemInfoPanel.tsx`
- [ ] `store/reportStore.ts` — Zustand store

### Checkpoint
- 9 module cards visible on dashboard ✓
- Ctrl+K opens search modal ✓
- Module cards link to module pages ✓

---

## Phase 2: Module Page & Report List (Week 2) — 4 days

### Goals
- [ ] `/report-center/inventory` page
- [ ] ReportList with all 27 inventory reports
- [ ] ReportListItem with priority indicators
- [ ] Module-level filters
- [ ] SummaryCards (KPIs)
- [ ] PreviewPanel (sticky right sidebar)

### Deliverables
- [ ] `app/report-center/inventory/page.tsx`
- [ ] `components/reports/ReportListItem.tsx`
- [ ] `components/reports/PreviewPanel.tsx`
- [ ] `components/filters/FilterBar.tsx`
- [ ] `components/ui/SummaryCard.tsx`
- [ ] `components/ui/StatusBanner.tsx`

### Checkpoint
- 27 reports listed ✓
- Priority colors (red/orange/gold/gray) ✓
- Preview panel shows on report click ✓

---

## Phase 3: Report Viewer (Week 3) — 4 days

### Goals
- [ ] `/report-center/inventory/[reportId]` page
- [ ] DataTable with sort, pagination, column visibility
- [ ] Report-level filters
- [ ] Export buttons (Excel, PDF, CSV)
- [ ] Loading skeletons
- [ ] Error states

### Deliverables
- [ ] `app/report-center/inventory/[reportId]/page.tsx`
- [ ] `components/ui/DataTable.tsx`
- [ ] `components/filters/ReportFilters.tsx`
- [ ] `components/actions/ExportButtonGroup.tsx`
- [ ] `components/ui/LoadingSkeleton.tsx`
- [ ] `components/ui/ErrorState.tsx`

### Checkpoint
- Full report data loads ✓
- Sort by any column ✓
- Pagination works (20/50/100 rows) ✓

---

## Phase 4: API & SQL Integration (Week 4) — 4 days

### Goals
- [ ] Connect API routes to SQL Gateway
- [ ] Implement all 27 stored procedures
- [ ] Handle future period disclaimer
- [ ] Query timeout handling
- [ ] Pagination at database level

### Deliverables
- [ ] `app/api/reports/inventory/[id]/data/route.ts` — execute SP
- [ ] `app/api/reports/inventory/[id]/preview/route.ts` — top 5 rows
- [ ] `app/api/reports/search/route.ts` — semantic search
- [ ] `app/api/modules/route.ts` — module list
- [ ] `lib/sql/gateway.ts` — SQL Gateway client
- [ ] 27 stored procedures in SQL file

### Stored Procedures to Create
```sql
-- Phase 4 SPs (27 total)
sp_INV_A1_StockSummaryByLocation
sp_INV_A2_StockSummaryByCategory
sp_INV_A3_StockSummaryByType
sp_INV_A4_StockValuationSummary
sp_INV_B1_StockMovement
sp_INV_B2_MovementByBlock
sp_INV_B3_StockIssue
sp_INV_B4_DailyTransactionLog
sp_INV_C1_MonthlyValuation
sp_INV_C2_ValuationByCategory
sp_INV_C3_MonthOverMonth
sp_INV_C4_ABCAnalysis
sp_INV_D1_DeadStock6Mo
sp_INV_D2_DeadStock12Mo
sp_INV_D3_ZeroStock
sp_INV_D4_SlowMoving
sp_INV_E1_BelowReorderLevel
sp_INV_E2_ReorderRecommendation
sp_INV_E3_NeverOrdered
sp_INV_F1_FuelByVehicle
sp_INV_F2_FuelByDepartment
sp_INV_F3_FuelReturn
sp_INV_G1_OutstandingPR
sp_INV_G2_PRByStatus
sp_INV_H1_StockAdjustment
sp_INV_H2_StockReturn
sp_INV_H3_MonthlyTransactionSummary
```

### Checkpoint
- Real data flows from SQL Gateway ✓
- No CUD operations ✓
- Timeout handling works ✓
- Future period shows disclaimer ✓

---

## Phase 5: Polish & Enhancement (Week 5) — 4 days

### Goals
- [ ] Semantic search with bilingual tag matching
- [ ] Favorites persistence (localStorage/Zustand persist)
- [ ] Recent reports tracking
- [ ] Export functionality (Excel via xlsx, PDF via jspdf)
- [ ] Empty states per report
- [ ] Mobile responsive adjustments

### Deliverables
- [ ] `lib/search/semantic.ts` — bilingual tag matching
- [ ] `components/actions/ExportExcel.tsx`
- [ ] `components/actions/ExportPDF.tsx`
- [ ] Empty states for all reports
- [ ] Mobile sidebar (hamburger menu)

### Checkpoint
- Search finds "dead stock" → INV-D1, D2 ✓
- Export produces valid Excel file ✓
- Empty state for zero-result queries ✓

---

## Phase 6: Performance & QA (Week 6) — 3 days

### Goals
- [ ] Performance audit (Lighthouse)
- [ ] Database index optimization
- [ ] Caching strategy validation
- [ ] Cross-browser testing
- [ ] Final bug fixes
- [ ] Documentation

### Deliverables
- [ ] Performance report
- [ ] SQL index script
- [ ] README.md
- [ ] DEPLOY.md (deployment guide)

### Checkpoint
- Lighthouse score >= 80 ✓
- No CUD errors in logs ✓
- All 27 reports functional ✓

---

## Task Breakdown

### Week 1 Tasks (Phase 1)
```
TD-001: Setup Zustand store
TD-002: Create ModuleCard component (×9 modules)
TD-003: Create HeroBanner component
TD-004: Create GlobalSearch modal (Ctrl+K)
TD-005: Create FavoritesPanel
TD-006: Create RecentReportsPanel
TD-007: Create SystemInfoPanel
TD-008: Wire up module cards → navigation
TD-009: Responsive grid (4→3→2 columns)
TD-010: Integration test Phase 1
```

### Week 2 Tasks (Phase 2)
```
TD-011: Create inventory module page
TD-012: Create FilterBar component
TD-013: Create ReportListItem (×27 reports)
TD-014: Create PreviewPanel component
TD-015: Create SummaryCard component
TD-016: Create StatusBanner
TD-017: Wire up report list → preview
TD-018: Integration test Phase 2
```

### Week 3 Tasks (Phase 3)
```
TD-019: Create DataTable component
TD-020: Add sorting logic
TD-021: Add pagination UI
TD-022: Create ReportFilters component
TD-023: Create ExportButtonGroup
TD-024: Add LoadingSkeleton
TD-025: Add ErrorState
TD-026: Create report viewer page
TD-027: Integration test Phase 3
```

### Week 4 Tasks (Phase 4)
```
TD-028: Create SQL Gateway client
TD-029: Create API route handlers (×27)
TD-030: Create stored procedure script
TD-031: Test each SP with real data
TD-032: Add pagination to all queries
TD-033: Add timeout handling
TD-034: Add future period disclaimer
TD-035: Integration test Phase 4
```

### Week 5 Tasks (Phase 5)
```
TD-036: Implement semantic search
TD-037: Add ExportExcel functionality
TD-038: Add ExportPDF functionality
TD-039: Polish empty states
TD-040: Add mobile responsive
TD-041: Polish animations/transitions
TD-042: Integration test Phase 5
```

### Week 6 Tasks (Phase 6)
```
TD-043: Run Lighthouse audit
TD-044: Apply performance fixes
TD-045: Create SQL index script
TD-046: Write README.md
TD-047: Cross-browser test
TD-048: Final bug fixes
TD-049: Final QA checklist
TD-050: Handover documentation
```

---

## Dependencies & Risks

### Dependencies
- SQL Gateway must be running on `localhost:8001`
- Database `db_ptrj_mill` accessible via `SERVER_PROFILE_1`
- 27 stored procedures must be created in database
- `x-api-key` header must be valid

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| SQL query timeout (>30s) | High | Add index recommendations; show timeout error |
| Future period data (2026-09) | Medium | Always show disclaimer |
| Large result sets | Medium | Server-side pagination; LIMIT 100 |
| CUD accidentally triggered | Critical | Strict READ-ONLY; no write endpoints |
| Missing lookup tables | Low | Graceful fallback to code |

---

## Success Criteria

- [ ] All 27 inventory reports load with real data
- [ ] Search finds reports within 200ms
- [ ] Export produces valid Excel/PDF files
- [ ] No CUD operations executed
- [ ] Lighthouse Performance >= 80
- [ ] Mobile responsive (375px+)
- [ ] All error states handled gracefully
