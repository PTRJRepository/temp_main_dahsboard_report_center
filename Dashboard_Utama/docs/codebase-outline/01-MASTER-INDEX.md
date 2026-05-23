# CODEBASE OUTLINE - MASTER INDEX
# Dokumentasi Lengkap PT Rebinmas Jaya Report Center

**Location:** D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/docs/codebase-outline/
**Total:** ~76 KB documentation

---

## DAFTAR ISI

| File | Ukuran | Deskripsi |
|------|--------|-----------|
| [00-CODEBASE-OUTLINE.md](./00-CODEBASE-OUTLINE.md) | 11.9 KB | Struktur direktori, routes, komponen overview |
| [02-API-DETAILS.md](./02-API-DETAILS.md) | 17.4 KB | API endpoints, SQL tables, 17 report types |
| [03-COMPONENTS-DETAILS.md](./03-COMPONENTS-DETAILS.md) | 15.7 KB | 19 React components dengan props/state |
| [04-STATE-MANAGEMENT.md](./04-STATE-MANAGEMENT.md) | 19.3 KB | Zustand, React Query, useState |
| [05-LIB-UTILS.md](./05-LIB-UTILS.md) | 12.0 KB | Libraries, hooks, RBAC, configs |

---

## CARA MENGGUNAKAN

**Step 1: START HERE →** `00-CODEBASE-OUTLINE.md`
- Lihat strukturproject secara keseluruhan
- Temukan file yang relevan

**Step 2: PAGES & ROUTES**
- Lihat route di section 2 di outline

**Step 3: API DETAILS →** `02-API-DETAILS.md`
- Jika butuh memahami endpoint
- Lihat SQL tables

**Step 4: COMPONENTS →** `03-COMPONENTS-DETAILS.md`
- Jika butuh memahami komponen
- Lihat props interface

**Step 5: STATE →** `04-STATE-MANAGEMENT.md`
- Jika butuh memahami state flow
- Lihat Zustand + React Query

**Step 6: UTILS →** `05-LIB-UTILS.md`
- Jika butuh memahami helper functions
- Lihat hooks

---

## QUICK REFERENCE

### File Counts
- app/ pages (.tsx): 20
- app/ routes (.ts): 15
- components/: 19
- lib/ utils: 22
- Total: ~77 files

### Page Routes (/path)
- / → Landing
- /login → Login
- /dashboard → Dashboard
- /report-center → Report Center
- /report-center/[module] → Dynamic module
- /report-center/inventory → Inventory reports

### API Routes (/api/*)
- /api/auth/login, /logout, /verify
- /api/reports/inventory (17 types)
- /api/reports/system-status
- /api/reports/ai-insight
- /api/reports/natural-filter

### State Management
- Zustand: store/reportStore.ts
- React Query: app/providers.tsx
- Local useState: pages

### Key Components
- Layout: Sidebar, Topbar (2)
- Dashboard: ModuleCard, GlobalSearch, HeroBanner (8)
- Shared: SummaryCard, ExportButtonGroup (9)

---

## RELATED DOCS

| Folder | Description |
|--------|-------------|
| [logic-flows/](../logic-flows/) | Logic & flows (22 KB) |
| [PROJECT-DOCUMENTATION.md](../PROJECT-DOCUMENTATION.md) | Project overview (37 KB) |
| [ARCHITECTURE-DOCUMENTATION.md](../ARCHITECTURE-DOCUMENTATION.md) | Architecture (30 KB) |

---

**END INDEX**
