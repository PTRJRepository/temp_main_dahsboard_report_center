# 🚀 WAVE 5 — DETAILED DISPATCH
## PT Rebinmas Jaya Report Center — Full Implementation
**Created:** 2026-05-17 17:45 | **Version:** 5.0 | **Orchestrator:** Hermes (CEO)

---

## 📋 EXECUTIVE SUMMARY

| Item | Status |
|------|--------|
| `npm run build` | ✅ CLEAN — TypeScript 0 errors |
| Dev Server | ✅ http://localhost:3002 |
| Build Routes | ✅ 18 routes (static + dynamic) |
| Last Audit | ✅ 3 bugs fixed (Critical: layout metadata, HIGH: 2x fetch errors) |

**Current State:** Dashboard renders but module cards stack vertically (needs CSS grid). Module detail pages are skeleton-only. No real data yet. Executive dashboard has RBAC gating.

---

## 🎯 TEAM ROLES & TOOL ASSIGNMENTS

| Role | Agent | Tool | Focus |
|------|-------|------|-------|
| 🏛️ CEO/Orchestrator | Hermes (me) | All tools | Orchestrate, merge, review, quality gate |
| 🏛️ Architect | Codex CLI | codex exec | Design specs, PRD validation |
| 💻 Frontend Dev #1 | Claude Sonnet 4.6 | delegate_task (leaf) | CSS/UI fixes, module pages |
| 💻 Frontend Dev #2 | Claude Sonnet 4.6 | delegate_task (leaf) | API integration, hooks |
| 🔍 Security Auditor | Claude Sonnet 4.6 | delegate_task (leaf) | RBAC audit, vulnerability check |
| 🧪 QA Tester | Claude Sonnet 4.6 | delegate_task (leaf) | Browser testing, acceptance criteria |

---

## 📌 TASK QUEUE — PRIORITY ORDER

### 🔴 PRIORITY 1 — CRITICAL (Must Fix Before Demo)

#### TASK 1: CSS Grid Fix — Module Cards
**Assigned:** Frontend Dev #1  
**File:** `app/page.tsx` (line ~580 grid container)  
**Problem:** Cards stacked vertically instead of grid. `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` not applying.  
**Root Cause:** The module card grid div may need explicit `display: grid` or width constraint.  
**Goal:** 9 cards → 4 per row on desktop (3 cols at wide, 2 at medium, 1 at mobile).  
**Acceptance:** Cards render in CSS grid, each card ~280px wide.

#### TASK 2: Fix getIcon() Size Consistency  
**Assigned:** Frontend Dev #1  
**Files:** `app/page.tsx`, `components/shared/ModuleCard.tsx`  
**Problem:** `getIcon()` defaults to `w-5 h-5` which is small for module cards. Module icons should use `w-6 h-6`.  
**Fix:** Ensure `getIcon(name, "w-6 h-6")` is called for all module card icons.

#### TASK 3: Build Module Detail Pages (3 modules)
**Assigned:** Frontend Dev #1  
**Files to create:**  
- `app/modules/payroll/page.tsx` — 24 reports, Payroll module
- `app/modules/absensi/page.tsx` — 18 reports, Absensi module  
- `app/modules/produktivitas/page.tsx` — 16 reports, Produktivitas module

Each page must include:
- ModuleHeader component (icon, name, count, breadcrumb)
- ModuleStatusBanner (last update, status indicator)
- ModuleSummaryCards (key metrics)
- ModuleFilterRow (date range, division filter)
- ReportList (list of reports with icons, descriptions, timestamps)
- ReportPreviewPanel (sticky right sidebar)
- Use `app/modules/inventory/page.tsx` as template

#### TASK 4: RBAC Fix — Executive Dashboard Access
**Assigned:** Security Auditor  
**Problem:** `/admin/executive` returns "Akses Ditolak" for all users (even admin). RBAC too strict.  
**Root Cause:** ProtectedRoute blocking all requests. For demo purposes, allow admin role through.  
**Fix:** Temporarily relax RBAC for demo — check localStorage for role, allow 'admin' to bypass. Update AuthContext to include admin in mock users.

#### TASK 5: Global Search Modal — Fix Close Behavior
**Assigned:** Frontend Dev #1  
**File:** `app/page.tsx` (GlobalSearchModal)  
**Problem:** `onClose` not triggered when clicking overlay backdrop.  
**Fix:** Ensure backdrop click calls `onClose()`, escape key closes modal.

---

### 🟡 PRIORITY 2 — HIGH (Features that need building)

#### TASK 6: SQL Gateway Integration — Real Data Hook
**Assigned:** Frontend Dev #2  
**Files:** `lib/api/sql-gateway.ts`, `lib/hooks/useReports.ts`  
**Context:** SQL Gateway URL: `http://localhost:8001/v1/query`  
Auth header: `x-api-key: 2a9934...4df6` (use env var)  
Default DB: `db_ptrj_mill`  
Server: `103.127.66.32:1888`

Build mock data that simulates real SQL Gateway responses:
- Reports have real field names (kd_divisi, period_bulan, gang, etc.)
- Include proper loading states with skeleton
- Include error states with retry button
- Include empty states with suggestion

#### TASK 7: Export Button Group — Full Implementation
**Assigned:** Frontend Dev #1  
**File:** `components/shared/ExportButtonGroup.tsx`  
**Context:** Export to CSV, Excel, PDF. Should trigger SQL query and format results.
For MVP: Use client-side CSV export with mock data (no server call yet).
Include: ExportQueuePanel with progress indicator.

#### TASK 8: Report Viewer Page Template
**Assigned:** Frontend Dev #1  
**Files to create:**  
- `app/reports-center/inventory/page.tsx` (already exists — verify it works)
- Create `app/reports/inventory/page.tsx` with full DataTable

Each report page needs:
- ReportHeader (report name, module, period, last updated)
- ReportFilters (date range picker, division select, gang multi-select)
- ReportSummary (6 metric cards)
- DataTable (sortable, searchable, paginated, column visibility)
- ExportButtonGroup (CSV, Excel, PDF)
- Loading skeleton (while data loads)
- Error boundary (if API fails)

#### TASK 9: IntelligenceWidget — Full Demo Data
**Assigned:** Frontend Dev #2  
**File:** `components/intelligence/IntelligenceWidget.tsx`  
**Context:** The widget needs real recommendation data structure. Build 5-8 mock recommendations with different reason types (time_based, updated, similar, due, anomaly). Each recommendation links to a report.

#### TASK 10: Notification System — Bell Icon
**Assigned:** Frontend Dev #1  
**File:** Topbar component in `app/page.tsx`  
**Context:** Bell icon shows "3 unread" badge. Click should open dropdown with:
- 3 mock notifications (overdue report, data sync failure, export complete)
- Mark all as read button
- Click navigates to relevant page

---

### 🟢 PRIORITY 3 — MEDIUM (Polish & UX)

#### TASK 11: Sidebar — Collapsible Module Dropdown
**Assigned:** Frontend Dev #1  
**File:** `app/page.tsx` (Sidebar component)  
**Problem:** Module dropdown not expanding. `openDropdown` state not working properly.  
**Fix:** Ensure clicking "Modul" button toggles the module list dropdown. Add checkmark for active module. Icons for each module.

#### TASK 12: Hero Banner — Add Realistic Estate Stats
**Assigned:** Frontend Dev #1  
**File:** `app/page.tsx` (HeroBanner)  
**Context:** Add 3 estate stats badges (DME: 3,846 Ha, ARE: 2,120 Ha, DMS: 1,540 Ha) in the hero banner right side. Use accent colors.

#### TASK 13: Loading Skeleton — Global Application
**Assigned:** Frontend Dev #2  
**Files:** All page components  
**Context:** Ensure all pages show LoadingSkeleton while data loads. Create a page-level skeleton wrapper component.

#### TASK 14: Dark Navy Sidebar — Hover States
**Assigned:** Frontend Dev #1  
**Files:** `app/page.tsx` (Sidebar)  
**Context:** Nav buttons should have hover states with green left border. Active item should have green background tint + left border 3px. Smooth transition.

#### TASK 15: Global CSS — Design Token Variables
**Assigned:** Frontend Dev #1  
**File:** `app/globals.css`  
**Context:** Ensure design tokens (--color-navy-900, --color-green-700, etc.) are applied consistently. Update Tailwind config to include custom colors.

---

### 🔵 PRIORITY 4 — SECURITY & QUALITY

#### TASK 16: RBAC Security Audit
**Assigned:** Security Auditor  
**Files:** `lib/rbac/*`, all page components  
**Audit Checklist:**
- [ ] No route accessible without auth (except `/login` and `/`)
- [ ] Admin routes protected (`/admin/*`)
- [ ] Module routes check `useModuleAccess()`
- [ ] Export functions check `canExport()`
- [ ] API routes validate session/token
- [ ] No SQL injection in query builder
- [ ] No XSS in user-generated content (descriptions, names)
- [ ] Environment variables properly loaded (no secrets in code)

#### TASK 17: TypeScript Strict Audit
**Assigned:** Security Auditor  
**Command:** `cd /d/... && npx tsc --noEmit`  
**Goal:** Zero errors. Fix any `any` types, missing prop types, unhandled Promise rejections.

#### TASK 18: Build Verification — All Routes
**Assigned:** QA Tester  
**Command:** `cd /d/... && npm run build`  
**Goal:** All 18 routes compile clean. No TypeScript errors, no runtime warnings.

---

## 📊 BUG TRACKING

| # | Bug | Severity | Status | Fix By |
|---|-----|----------|--------|--------|
| B1 | Module cards stacked vertically (CSS grid) | HIGH | IN PROGRESS | Frontend Dev #1 |
| B2 | getIcon() size inconsistency | MEDIUM | PENDING | Frontend Dev #1 |
| B3 | Module dropdown not expanding | MEDIUM | PENDING | Frontend Dev #1 |
| B4 | Global search modal backdrop click | MEDIUM | PENDING | Frontend Dev #1 |
| B5 | Executive dashboard access denied | HIGH | PENDING | Security Auditor |
| B6 | No loading skeletons on page load | MEDIUM | PENDING | Frontend Dev #2 |
| B7 | Export button not functional | MEDIUM | PENDING | Frontend Dev #1 |
| B8 | Notification dropdown empty | LOW | PENDING | Frontend Dev #1 |

---

## ✅ COMPLETED (do not touch)

- `app/layout.tsx` — Fixed 'use client' metadata conflict ✅
- `app/dashboard/report-center/page.tsx` — Added HTTP status check ✅  
- `app/api/reports/inventory/route.ts` — Added try-catch error handling ✅
- `lib/rbac/ProtectedRoute.tsx` — Fixed JSDoc parse error ✅
- `lib/hooks/useSearch.ts` — Fixed infinite query type ✅
- `components/intelligence/IntelligenceWidget.tsx` — Fixed ClockIcon hoisting ✅
- `components/report/DataTable.tsx` — Fixed ColumnDef generic type ✅
- `components/report/ReportSummary.tsx` — Fixed accentColor optional prop ✅
- `app/page.tsx` — Fixed ICON_MAP → getIcon() syntax ✅

---

## 📁 FILE STRUCTURE TARGET

```
app/
├── page.tsx                          ← MAIN DASHBOARD (635 lines)
├── layout.tsx                        ← ROOT LAYOUT ✅ FIXED
├── providers.tsx                     ← React Query + AppContext
├── globals.css                        ← Design tokens
├── error.tsx / not-found.tsx         ← Error boundaries
├── admin/
│   └── executive/page.tsx             ← KPI Dashboard
├── modules/
│   ├── inventory/page.tsx            ← 22 reports
│   ├── payroll/page.tsx              ← 24 reports  [TODO]
│   ├── absensi/page.tsx              ← 18 reports  [TODO]
│   └── produktivitas/page.tsx        ← 16 reports  [TODO]
└── reports/
    └── inventory/page.tsx            ← Full DataTable viewer [TODO]

components/
├── shared/     (8 components)
├── module/     (6 components)
├── report/     (5 components)
├── dashboard/  (8 components)
├── layout/     (Sidebar, Topbar)
└── intelligence/IntelligenceWidget.tsx

lib/
├── api/        (sql-gateway, types, queries, reports)
├── hooks/      (useReports, useExport, useSearch)
└── rbac/       (permissions, AuthContext, ProtectedRoute, usePermission)
```

---

## 🚀 EXECUTION ORDER

**Parallel Track A (Frontend Dev #1):**
TASK 1 (CSS grid) → TASK 2 (icon sizes) → TASK 3 (module pages 1/2) → TASK 4 (RBAC fix)

**Parallel Track B (Frontend Dev #2):**  
TASK 6 (SQL Gateway mock) → TASK 7 (export buttons) → TASK 9 (IntelligenceWidget) → TASK 10 (notifications)

**Sequential (Security Auditor):**
TASK 16 (RBAC audit) → TASK 17 (TS strict audit) → TASK 18 (build verification)

**After all fixes:**
→ Final build + screenshot each page → Send to Codex for design review

---

*End of WAVE 5 Dispatch Document*
*CEO: Hermes | Date: 2026-05-17 | Status: ACTIVE*
