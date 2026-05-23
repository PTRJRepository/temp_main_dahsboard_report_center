# 🚀 WAVE 6 — FULL IMPLEMENTATION DISPATCH
## PT Rebinmas Jaya Report Center
**Created:** 2026-05-17 18:20 | **Version:** 6.0 | **Orchestrator:** Hermes

---

## 📊 CURRENT SYSTEM STATE

### Servers
| Port | Content | Status |
|------|---------|--------|
| 3001 | OLD stale (Report Center broken) | ❌ KILLED |
| 3002 | Landing Page `/` | ✅ ACTIVE |
| 3002 | Report Center `/reports-center` | ✅ ACTIVE |

### Routing Architecture (CONFIRMED WORKING)
```
/                          → app/page.tsx (178L) → LANDING PAGE ✅
/reports-center           → app/reports-center/page.tsx (120L) → DASHBOARD ✅
/reports-center/inventory  → inventory module (partially built)
```

### Build Status
| Item | Status |
|------|--------|
| TypeScript | ✅ 0 errors |
| npm run build | ✅ Clean |
| CSS Framework | Tailwind + custom vars |
| State | Zustand (reportStore.ts) |
| Animations | framer-motion |

---

## 🎯 TEAM ROLES

| Role | Agent | Responsibility |
|------|-------|---------------|
| 🏛️ CEO | Hermes (me) | Orchestrate, merge, QA |
| 🏛️ Architect | Codex CLI (Ujang) | Design decisions, UI/UX, PRD |
| 💻 Frontend Lead | Claude Sonnet 4.6 (delegate) | CSS fixes, polish, module pages |
| 💻 Data Layer | Claude Sonnet 4.6 (delegate) | Mock data, hooks, API |
| 🔍 Auditor | Claude Sonnet 4.6 (delegate) | QA, screenshots, review |

---

## 📋 TASK QUEUE

### PHASE 0: CSS & RENDERING FIXES
**Priority: CRITICAL — App not usable until fixed**

#### TASK 0.1: Audit CSS imports across all pages
Check every .tsx file for:
- Broken Tailwind class names (e.g., `bg-white/8` should be `bg-white/80`)
- `marginLeft` inline styles instead of Tailwind (`ml-X`)
- Wrong Tailwind variants (`flex-1` vs `flex-grow`)
- Missing custom color tokens in tailwind.config

Files to audit: ALL .tsx in app/ and components/

#### TASK 0.2: Fix app/page.tsx (Landing Page)
Verify it has NO broken imports:
- `'use client'` NOT needed (it's a server component)
- No framer-motion imports (no animations on landing)
- All Tailwind classes valid

#### TASK 0.3: Fix app/reports-center/page.tsx
Verify:
- All component imports resolve
- IntelligenceWidget receives correct props (named import `{ IntelligenceWidget }`)
- Mock recommendations array typed correctly

#### TASK 0.4: Verify Sidebar + Topbar render correctly
Check: components/layout/Sidebar.tsx, components/layout/Topbar.tsx
- No broken CSS classes
- Nav items link to correct paths (/reports-center paths, not / paths)
- Collapsible works

---

### PHASE 1: MODULE DETAIL PAGES (9 modules)

#### TASK 1.1: Create module detail page template
File: `app/reports-center/[module]/page.tsx` (or `app/modules/[module]/page.tsx`)
Use Next.js dynamic route — single template handles all 9 modules.

Template must include:
- ModuleHeader: icon, name, report count, breadcrumb
- ModuleStatusBanner: last update, status badge
- ModuleSummaryCards: 4 key metrics (cards with numbers)
- ModuleFilterRow: date range, division select, gang multi-select
- ReportList: sortable list with icons, descriptions, timestamps
- ReportPreviewPanel: sticky right sidebar, shows report details
- Skeleton loading state

#### TASK 1.2: Populate with mock data for all 9 modules
Mock data per module:
```
Absensi (18 reports): attendance, leave, overtime, schedules
Payroll (24 reports): salary, deductions, tax, bank transfer
Daftar Upah (15 reports): wage register, daily wages, borongan
Inventory (22 reports): stock, warehouse, assets, audit (EXISTING)
Premi & Lembur (12 reports): overtime, incentives, bonuses
Produktivitas (16 reports): harvest, TBS, yield, efficiency
Karyawan (20 reports): biodata, contracts, mutations
Estate/Divisi (10 reports): divisions, blocks, planted area
Integrasi & Audit (14 reports): audit trail, sync logs
```

#### TASK 1.3: Connect to real data (when SQL Gateway available)
Hook up `lib/api/sql-gateway.ts` to actual SQL Server
Use `useReports()` hook for data fetching

---

### PHASE 2: DESIGN POLISH (Codex Review Follow-up)

Based on Codex design review, implement:

#### TASK 2.1: Module Card Grid Fix
Current: Cards stacked vertically
Fix: Ensure `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` applies
Root cause check: Is the parent container wide enough?

#### TASK 2.2: AI Recommendations Widget Polish
- Glassmorphism card background
- Confidence bar with smooth gradient
- Reason type badges (color-coded)
- Expand/collapse with smooth animation

#### TASK 2.3: Sidebar Polish
- Hover: green left border 2px + bg tint
- Active: green bg tint + border 3px
- Module count badges (e.g., "Inventory27")
- Smooth collapsible transition

#### TASK 2.4: Topbar Polish
- Global search input styled (rounded, shadow)
- Notification bell with count badge
- User avatar dropdown
- Breadcrumb navigation

#### TASK 2.5: Hero Banner Enhancement
- Add estate stats (DME: 3,846 Ha, ARE: 2,120 Ha, DMS: 1,540 Ha)
- Glassmorphism effect
- Gradient animated border

---

### PHASE 3: DATA & HOOKS

#### TASK 3.1: lib/mock-data.ts — All 9 modules
Create `lib/mock-data.ts` with report definitions for all 9 modules.
Each report: { id, name, module, group, fields[], lastUpdate, rowCount }

#### TASK 3.2: lib/hooks/useReports.ts
Create custom hook for fetching report data
- Loading state with skeleton
- Error state with retry
- Empty state with suggestions

#### TASK 3.3: Export functionality
ExportButtonGroup.tsx — client-side CSV export with Blob
Add: ExportQueuePanel.tsx for progress tracking

#### TASK 3.4: Global search enhancement
Expand beyond inventoryReports — search all 9 modules

---

### PHASE 4: RBAC & SECURITY

#### TASK 4.1: RBAC Audit
- All admin routes protected
- Module access per role (kerani sees only their module)
- Export permissions

#### TASK 4.2: TypeScript strict mode
Run `npx tsc --noEmit` — fix ALL errors

---

### PHASE 5: FINAL QA

#### TASK 5.1: Screenshot every page
For each page, take browser screenshot and save to docs/
Pages to screenshot:
1. `/` — Landing Page
2. `/reports-center` — Dashboard
3. `/reports-center/inventory` — Inventory module
4. `/reports-center/payroll` — Payroll module
5. `/admin/executive` — Executive dashboard (with mock auth)

#### TASK 5.2: Send to Codex for final design review
Codex reviews screenshots and provides final polish list

#### TASK 5.3: Final build verification
`npm run build` must be 100% clean

---

## 📁 TARGET FILE STRUCTURE

```
app/
├── page.tsx                           → LANDING PAGE (178L server)
├── layout.tsx                         → root layout
├── providers.tsx
├── reports-center/
│   ├── layout.tsx                     → Shell: Sidebar + Topbar
│   ├── page.tsx                       → Dashboard (120L)
│   ├── inventory/page.tsx             → Inventory (EXISTING - verify)
│   └── [module]/page.tsx              → Dynamic module pages
├── modules/inventory/page.tsx         → (verify no conflict)
└── admin/executive/page.tsx           → KPI dashboard

components/
├── layout/Sidebar.tsx (287L)          → FULL SIDEBAR
├── layout/Topbar.tsx                  → Topbar with search/bell
├── dashboard/
│   ├── HeroBanner.tsx
│   ├── ModuleCard.tsx
│   ├── GlobalSearch.tsx
│   ├── FavoritesPanel.tsx
│   ├── RecentPanel.tsx
│   └── SystemInfoPanel.tsx
├── intelligence/IntelligenceWidget.tsx
└── shared/
    └── [existing components]

lib/
├── mock-data.ts                       → [TODO: create]
├── api/sql-gateway.ts                 → [TODO: enhance]
└── hooks/useReports.ts               → [TODO: create]
```

---

## ✅ COMPLETED (do not modify)

| Item | Status |
|------|--------|
| Routing: `/` = Landing, `/reports-center` = Dashboard | ✅ DONE |
| app/page.tsx (178L server component landing page) | ✅ DONE |
| app/reports-center/page.tsx (120L with IntelligenceWidget) | ✅ DONE |
| app/reports-center/layout.tsx (Sidebar+Topbar shell) | ✅ DONE |
| components/layout/Sidebar.tsx (287L full nav) | ✅ DONE |
| components/layout/Topbar.tsx | ✅ DONE |
| components/dashboard/* (6 components) | ✅ DONE |
| store/reportStore.ts (Zustand) | ✅ DONE |
| TypeScript build clean | ✅ DONE |

---

## 🏃 EXECUTION ORDER

**PARALLEL TRACK A (Frontend Lead - Sonnet 4.6):**
T0.1 → T0.2 → T0.3 → T0.4 → T1.1 → T2.1 → T2.2 → T2.3 → T2.4 → T2.5

**PARALLEL TRACK B (Data Layer - Sonnet 4.6):**
T0.1 → T3.1 → T3.2 → T3.3 → T3.4

**SEQUENTIAL (Auditor):**
T0.1 → T4.1 → T4.2 → T5.1 → T5.2 → T5.3

**AFTER ALL:**
→ Final screenshots → Send to user for review → Iterate

---

*End of WAVE 6 Dispatch*
*CEO: Hermes | Date: 2026-05-17 | Status: ACTIVE*
