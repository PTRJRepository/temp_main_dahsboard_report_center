# CODEBASE OUTLINE - CONCISE
# Quick Reference untuk Developer

---

## 📁 STRUKTUR PROJECT

```
Dashboard_Utama/
├── app/                    # 20 .tsx pages, 15 .ts routes
│   ├── page.tsx           # Landing /
│   ├── login/page.tsx      # Login /login
│   ├── report-center/     # Report Center
│   │   ├── page.tsx     # Dashboard /report-center
│   │   ├── layout.tsx   # Shell (Sidebar+Topbar)
│   │   ├── [module]/   # Dynamic /report-center/[module]
│   │   └── inventory/ # /report-center/inventory
│   └── api/           # API Routes
│       ├── auth/       # /api/auth/*
│       └── reports/    # /api/reports/*
├── components/         # 19 components
│   ├── layout/        # Sidebar, Topbar
│   ├── dashboard/    # ModuleCard, HeroBanner, dll
│   └── shared/      # Button, Input, dll
├── lib/              # 22 utilities
│   ├── api/         # SQL Gateway client
│   ├── hooks/       # useReports, useSearch
│   ├── rbac/        # Permission system
│   └── reports/     # Module configs
└── store/           # Zustand store
```

---

## 🛣️ ROUTES

| URL | File | Type |
|-----|------|------|
| / | app/page.tsx | Server |
| /login | app/login/page.tsx | Server |
| /dashboard | app/dashboard/page.tsx | Server |
| /report-center | app/report-center/page.tsx | Client |
| /report-center/[module] | app/report-center/[module]/page.tsx | Client |
| /report-center/inventory | app/report-center/inventory/page.tsx | Client |

---

## 🔌 API ENDPOINTS

### Reports
```
GET /api/reports/inventory?report=stok-gudang&source=estate&limit=50
```
**Responses:** 17 report types (stok-gudang, kartu-stok, mutasi-barang, dll)

```
GET /api/reports/system-status?source=estate
```
**Returns:** database, integration, lastSync

### Auth
```
POST /api/auth/login      → { token, user }
POST /api/auth/logout    → { success }
GET  /api/auth/verify     → { user }
```

---

## 🗄️ DATABASE TABLES

### Inventory (db_ptrj)
| Table | Rows | Purpose |
|-------|------|---------|
| IN_ITEM | 7,483 | Master items |
| IN_STOCKISSUE | 72,244 | Pengeluaran header |
| IN_STOCKISSUELN | 119,603 | Pengeluaran detail |
| IN_STOCKRECEIVE | 45,123 | Penerimaan |
| IN_FUELISSUE | 45,234 | BBM |
| IN_MTHENDITEM | 103,742 | Snapshot bulanan |

### Mill (db_ptrj_mill)
Same structure, separate database

---

## 🎨 COMPONENTS

### Layout (2)
```tsx
<Sidebar />    // Nav, 260px, collapsible
<Topbar />    // Search, badges, profile
```

### Dashboard (8)
```tsx
<HeroBanner />        // Hero section
<GlobalSearch />     // Ctrl+K search
<ModuleCard />       // 9 module tiles
<AIInsightCard />    // AI panel
<FavoritesPanel />  // Favorites
<RecentPanel />     // Recent
<SystemInfoPanel /> // Status
```

### Shared (9)
```tsx
<SummaryCard />      // KPI
<ExportButtonGroup /> // Excel/PDF/CSV
<FilterChips />    // Quick filters
<LoadingSkeleton /> // Loading
```

---

## 🗃️ STATE

### Zustand (store/reportStore.ts)
```tsx
{
  sidebarCollapsed: boolean,
  activeModule: string | null,
  selectedReportId: string | null,
  filters: FilterConfig[],
  pagination: { page, pageSize },
  favorites: string[],
  recent: string[]
}
```
**Persist:** localStorage

### React Query
```tsx
useQuery({ 
  queryKey: ['reports', module],
  queryFn: () => fetch(...),
  staleTime: 5 min 
})
```

---

## ⚙�� KEY FUNCTIONS

### API Handler (route.ts)
```tsx
// Extract params
const source = getSource(request);  // estate|pabrik
const limit = getLimit(request);    // 5-500
const search = sanitizeLike(search);

// Create context
const ctx = sourceToContext(source); // { server, database }

// Route to handler
switch (report) {
  case 'stok-gudang': return stockSummary({limit, search, ctx});
  case 'kartu-stok': return stockCard({limit, search, ctx});
  // ... 17 handlers
}
```

### Search (GlobalSearch.tsx)
```tsx
// Debounce 300ms
// Fuzzy filter on: name, description, tags, module, category
// Keyboard: Arrow keys, Enter, Escape
// Favorites toggle
```

---

## 📊 REPORTS (17 types)

| Code | Handler | SQL Table |
|------|---------|-----------|
| INV-A1 | stockSummary | IN_ITEM |
| INV-A2 | stockCard | IN_ITEM |
| INV-B1 | stockMovement | IN_STOCKISSUE |
| INV-B2 | stockReceive | IN_STOCKRECEIVE |
| INV-B3 | stockIssue | IN_STOCKISSUELN |
| INV-G1 | purchaseRequestInventory | IN_PR |
| INV-F1 | fuelUsage | IN_FUELISSUE |
| INV-E1 | reorderLevel | IN_ITEM |
| INV-D1 | itemUpdateAge | IN_ITEM |
| ... | ... | ... |

---

## 🚀 QUICK START

```bash
# Development
bun run dev

# Test API
curl localhost:3001/api/reports/inventory

# Check routes
curl localhost:3001/
curl localhost:3001/report-center
```

---

## 📝 KEY FILES

| File | Purpose |
|------|---------|
| app/api/reports/inventory/route.ts | 17 reports |
| store/reportStore.ts | Zustand |
| lib/hooks/useReports.ts | React Query |
| lib/api/sql-gateway.ts | SQL client |
| lib/reports/config.ts | Modules |

---

**END CONCISE**
