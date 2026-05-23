# 🏛️ ROUTING & ARCHITECTURE FIX PLAN
## PT Rebinmas Jaya — Report Center
**Date:** 2026-05-17 | **Status:** IN PROGRESS | **Architect:** Codex + Hermes

---

## 📊 CURRENT STATE AUDIT

```
/                          → app/page.tsx (656L) ← REPORT CENTER DASHBOARD ❌ WRONG
/reports-center           → app/reports-center/page.tsx (54L) ← uses external components
/reports-center/layout.tsx→ Has Sidebar+Topbar+reportStore shell ✅
/admin/executive           → 398L dashboard with RBAC
/modules/inventory          → 506L inventory module page
```

**The Problem:** Root `/` should be LANDING PAGE. Dashboard goes to `/reports-center`.

**The Opportunity:** Clean architecture already partially built:
- `app/reports-center/layout.tsx` ✅ — Shell with Sidebar+Topbar+framer-motion
- `components/layout/Sidebar.tsx` (287L) ✅ — Full sidebar with UTAMA/LAPORAN/MODUL/ADMIN groups
- `components/dashboard/` ✅ — 6 components: HeroBanner, ModuleCard, GlobalSearch, FavoritesPanel, RecentPanel, SystemInfoPanel
- `store/reportStore.ts` ✅ — Zustand store with sidebarCollapse + filters
- `components/layout/Topbar.tsx` — EXISTS, need to verify

---

## ✅ CORRECT ARCHITECTURE

```
/                              → app/page.tsx → LANDING PAGE (Branding, CTA)
/reports-center                → app/reports-center/page.tsx → DASHBOARD (hero+modules+favorites)
/reports-center/all-reports    → app/reports-center/all-reports/page.tsx
/reports-center/favorites      → app/reports-center/favorites/page.tsx
/reports-center/recent         → app/reports-center/recent/page.tsx
/reports-center/inventory      → app/reports-center/inventory/page.tsx
/modules/*                     → app/modules/* (detail pages)
/admin/*                       → app/admin/* (admin pages)
```

---

## 🔨 EXECUTION PLAN

### PHASE 0: Routing Fix (THIS SESSION)
**Task:** Make `/` → Landing Page, `/reports-center` → Dashboard
**Files to touch:** `app/page.tsx`, `app/reports-center/page.tsx`, `next.config.js`

### PHASE 1: Dashboard Enhancement
**Task:** Enhance `/reports-center` with full dashboard
**Files:** `app/reports-center/page.tsx`, `components/dashboard/*`

### PHASE 2: Module Detail Pages
**Task:** Build 9 module pages using existing components
**Files:** `app/reports-center/modules/*/page.tsx`

### PHASE 3: Integration + Real Data
**Task:** Connect to SQL Gateway, real reports
**Files:** `lib/api/*`, `lib/hooks/*`

### PHASE 4: Design Polish + Screenshots
**Task:** Full visual QA, screenshots for Codex review

---

## 👥 TEAM DELEGATION

| Role | Agent | Responsibility |
|------|-------|---------------|
| 🏛️ CEO | Hermes | Orchestrate, merge, quality gate |
| 🏛️ Architect | Codex (exec) | Design decisions, PRD validation, component specs |
| 💻 Impl A | Sonnet 4.6 (delegate_task) | Landing page + routing |
| 💻 Impl B | Sonnet 4.6 (delegate_task) | Dashboard enhancement + module pages |
| 🔍 Auditor | Sonnet 4.6 (delegate_task) | Security audit |

---

*End of Plan*