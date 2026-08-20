# PT REBINMAS JAYA REPORT CENTER
# Dokumentasi Project Lengkap

**Project:** PT Rebinmas Jaya Report Center  
**Location:** D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/  
**Generated:** May 2026  
**Version:** 1.0.0

---

# =============================================================================
# BAGIAN 1: DAFTAR ISI
# =============================================================================

1. [Project Overview](#bagian-2-project-overview)
2. [Struktur Direktori](#bagian-3-struktur-direktori)
3. [Routes & Pages](#bagian-4-routes--pages)
4. [Components](#bagian-5-components)
5. [API Endpoints](#bagian-6-api-endpoints)
6. [Database](#bagian-7-database)
7. [Reports Catalog](#bagian-8-reports-catalog)
8. [Modules](#bagian-9-modules)
9. [State Management](#bagian-10-state-management)
10. [Design System](#bagian-11-design-system)
11. [Configuration](#bagian-12-configuration)
12. [Build & Run](#bagian-13-build--run)
13. [Troubleshooting](#bagian-14-troubleshooting)

---

# BAGIAN 2: PROJECT OVERVIEW
# =============================================================================

## 2.1 Apa Itu Report Center?

Report Center adalah aplikasi web portal laporan PT Rebinmas Jaya — perusahaan perkebunan kelapa sapphire berlokasi di Belitung, Bangka Belitung.

**Karakteristik:**
- Report-only experience (tidak ada CRUD)
- 9 modul laporan (151 reports total)
- 5 role pengguna
- Database: SQL Gateway → MSSQL
- Tech: Next.js 14 + TypeScript + Tailwind CSS v4

## 2.2 Tech Stack

| Komponen | Teknologi | Versi |
|---------|-----------|-------|
| Framework | Next.js | 14.x (App Router) |
| Bahasa | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 |
| State Client | Zustand | latest |
| State Server | React Query | 5.x |
| Animation | Framer Motion | 12.x |
| Icons | Lucide React | latest |
| Auth | JWT | - |
| Database | MSSQL | - |
| Server | Express | - |
| Runtime | Bun/Node.js | - |

## 2.3 User Roles

| Role | Scope | Description |
|------|-------|-------------|
| kerani | Gang/Kemandoran | Karyawan operasional |
| hr | Division | HR staff |
| payroll | Division | Payroll processor |
| manager | Estate | Estate Manager |
| admin | Company | System admin |

---

# BAGIAN 3: STRUKTUR DIREKTORI
# =============================================================================

## 3.1 Structure Lengkap

```
D:/Gawean Rebinmas/Main Dashboard/
├── server.js                          # Express proxy server
├── package.json                       # Root dependencies
│
├── Dashboard_Utama/                  # Next.js application
│   ├── app/                        # App Router pages
│   │   ├── page.tsx               # Landing PT Rebinmas
│   │   ├── layout.tsx             # Root layout (Providers + Inter font)
│   │   ├── providers.tsx         # React Query provider
│   │   ├── globals.css          # Tailwind CSS + design tokens
│   │   ├── login/
│   │   │   └── page.tsx        # Login page
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Old dashboard
│   │   ├── dashboard-user/
│   │   │   └── page.tsx        # User dashboard
│   │   ├── admin/
│   │   │   ├── page.tsx        # Admin page
│   │   │   ├── layout.tsx      # Admin layout
│   │   │   └── executive/
│   │   │       └── page.tsx  # Executive dashboard
│   │   ├── modules/
│   │   │   ├── absensi/
│   │   │   │   └── page.tsx
│   │   │   ├── inventory/
│   │   │   │   └── page.tsx
│   │   │   └── payroll/
│   │   │       └── page.tsx
│   │   ├── report-center/              # Report Center ROOT
│   │   │   ├── page.tsx             # Dashboard with 9 module cards
│   │   │   ├── layout.tsx           # AppShell (Sidebar + Topbar)
│   │   │   ├── [module]/
│   │   │   │   ├── page.tsx      # Dynamic module page
│   │   │   │   └── ModuleToolbar.tsx
│   │   │   └── inventory/
│   │   │       ├── page.tsx          # Inventory reports
│   │   │       ├── InventoryReportsClient.tsx
│   │   │       └── [report]/
│   │   │           ├── page.tsx
│   │   │           └── ReportViewerClient.tsx
│   │   ├── api/                     # API Routes
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   ├── verify/route.ts
│   │   │   │   └── public-key/route.ts
│   │   │   ├── reports/
│   │   │   │   ├── inventory/route.ts
│   │   │   │   ├── ai-insight/route.ts
│   │   │   │   ├── natural-filter/route.ts
│   │   │   │   └── system-status/route.ts
│   │   │   └── services/route.ts
│   │   └── error.tsx
│   │
│   ├── components/                   # React components
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx      # Sidebar navigation
│   │   │   └── Topbar.tsx     # Topbar navigation
│   │   ├── dashboard/
│   │   │   ├── HeroBanner.tsx
│   │   │   ├── GlobalSearch.tsx
│   │   │   ├── ModuleCard.tsx
│   │   │   ├── AIInsightCard.tsx
│   │   │   ├── FavoritesPanel.tsx
│   │   │   ├── RecentPanel.tsx
│   │   │   ├── SystemInfoPanel.tsx
│   │   │   └── MonitoringVisualSection.tsx
│   │   └── ui/ (various)
│   │
│   ├── lib/                        # Utilities
│   │   ├── reports/
│   │   │   ├── config.ts          # Module registry
│   │   │   ├── mock-data.ts      # Mock reports
│   │   │   └── inventory/
│   │   │       └── config.ts      # Inventory config
│   │   └── (other utilities)
│   │
│   ├── store/                     # Zustand stores
│   │   └── reportStore.ts        # Report UI state
│   │
│   ├── docs/                      # Documentation (INI!)
│   │   ├── ARCHITECTURE-DOCUMENTATION.md
│   │   ├── PRD-*.md (various PRD docs)
│   │   └── inventory-in-database/
│   │
│   ├── public/                    # Static assets
│   │   ├── assets/
│   │   └── favicon.ico
│   │
│   ├── package.json               # Next.js dependencies
│   ├── next.config.js          # Next.js config
│   ├── tsconfig.json          # TypeScript config
│   ├── tailwind.config.ts     # Tailwind config (deprecated, v4)
│   └── postcss.config.mjs    # PostCSS v4 config
│
├── docs/                        # Canonical documentation (indexed)
│   └── ...
│
└── Keys/                       # RSA keys
```

## 3.2 Dependencies (package.json)

**Dependencies Utama:**
- `next` - Next.js framework
- `react` / `react-dom` - React library
- `@tanstack/react-query` - Server state
- `zustand` - Client state
- `framer-motion` - Animations
- `lucide-react` - Icons
- `jspdf` - PDF export
- `jsonwebtoken` - JWT auth
- `bcryptjs` - Password hashing
- `@prisma/client` - ORM (unused)

---

# BAGIAN 4: ROUTES & PAGES
# =============================================================================

## 4.1 All Routes

| Route | Page File | Description |
|-------|----------|-------------|
| / | app/page.tsx | Landing PT Rebinmas Jaya |
| /dashboard | app/dashboard/page.tsx | Old dashboard |
| /dashboard-user | app/dashboard-user/page.tsx | User dashboard |
| /login | app/login/page.tsx | Login page |
| /admin | app/admin/page.tsx | Admin dashboard |
| /admin/executive | app/admin/executive/page.tsx | Executive KPIs |
| /report-center | app/report-center/page.tsx | Report Center Dashboard |
| /report-center/[module] | app/report-center/[module]/page.tsx | Dynamic module |
| /report-center/inventory | app/report-center/inventory/page.tsx | Inventory reports |
| /report-center/inventory/[report] | app/report-center/inventory/[report]/page.tsx | Report viewer |
| /modules/absensi | app/modules/absensi/page.tsx | Absensi module |
| /modules/inventory | app/modules/inventory/page.tsx | Inventory module |
| /modules/payroll | app/modules/payroll/page.tsx | Payroll module |
| /api/auth/* | app/api/auth/* | Authentication |
| /api/reports/* | app/api/reports/* | Report APIs |

## 4.2 Page Details

### / (Landing)
- Full landing page untuk PT Rebinmas Jaya
- Sections: Navbar, HeroSection, Kilasan Perusahaan, Fitur Unggulan, Laporan Module Links, Footer
- Responsive design

### /report-center (Report Center Dashboard)
- AppShell layout (Sidebar + Topbar + Content)
- HeroBanner dengan system status
- 9 ModuleCard grid
- Favorites panel
- Recent panel
- System info panel

### /report-center/[module] (Dynamic Module)
- Breadcrumb navigation
- Module header dengan stats
- Filter toolbar
- Report list (table or card view)
- Preview panel (380px right)

### /report-center/inventory/[report] (Report Viewer)
- Full report view
- Filter bar
- Summary cards
- Data table dengan pagination
- Export buttons

---

# BAGIAN 5: COMPONENTS
# =============================================================================

## 5.1 Layout Components

### Sidebar.tsx
- Location: components/layout/Sidebar.tsx
- Lines: ~250
- Features:
  - Dark navy (#071426) background
  - Grouped navigation (UTAMA, LAPORAN, MODUL, ADMINISTRASI)
  - Collapse/expand (260px -> 72px)
  - Active state indicator (green left border)
  - Hover states

### Topbar.tsx
- Location: components/layout/Topbar.tsx
- Lines: ~200
- Features:
  - Dark navy background
  - Global search (Ctrl+K shortcut)
  - Active periode divisi badges
  - Notification bell with count
  - User profile dropdown

## 5.2 Dashboard Components

### HeroBanner.tsx
- Hero section dengan plantation background
- Title + subtitle + description
- System status widget (right aligned)

### GlobalSearch.tsx
- Search input dengan Ctrl+K focus
- Debounced search (300ms)
- Semantic tag suggestions
- Recent searches dropdown

### ModuleCard.tsx
- Windows tile aesthetic
- Module icon (lucide)
- Module name + report count
- Description
- Last updated
- Status badge (Active/Coming/Locked)
- CTA button

### ReportListItem.tsx
- Report name + description
- Tags (semantic search)
- Last updated timestamp
- Status indicator
- Actions: View, Preview, Export

### ReportPreviewPanel.tsx
- 380px sticky right panel
- Report metadata
- Table preview (5 rows)
- Summary totals
- Action buttons

## 5.3 Component Exports

```typescript
// All exports from components/
export { Sidebar } from './layout/Sidebar';
export { Topbar } from './layout/Topbar';
export { HeroBanner } from './dashboard/HeroBanner';
export { GlobalSearch } from './dashboard/GlobalSearch';
export { ModuleCard } from './dashboard/ModuleCard';
export { FavoritesPanel } from './dashboard/FavoritesPanel';
export { RecentPanel } from './dashboard/RecentPanel';
export { SystemInfoPanel } from './dashboard/SystemInfoPanel';
export { AIInsightCard } from './dashboard/AIInsightCard';
```

---

# BAGIAN 6: API ENDPOINTS
# =============================================================================

## 6.1 Auth API

### POST /api/auth/login
```typescript
// Request
{
  "email": "user@company.com",
  "password": "password123"
}

// Response
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": { "id", "name", "email", "role", "division" }
  }
}
```

### POST /api/auth/logout
```typescript
// Request (empty)

// Response
{ "success": true }
```

### GET /api/auth/verify
```typescript
// Request (with JWT cookie)

// Response
{
  "success": true,
  "data": { "user": {...} }
}
```

### GET /api/auth/public-key
```typescript
// Response
{
  "success": true,
  "data": { "publicKey": "RSA key" }
}
```

## 6.2 Reports API

### GET /api/reports/inventory
```typescript
// Query params: module, filters, pagination

// Response
{
  "success": true,
  "data": [...],
  "meta": { "rows": 100, "page": 1, "pageSize": 50 }
}
```

### GET /api/reports/inventory/[id]
```typescript
// Path: /api/reports/inventory/STOK-GUDANG

// Response
{
  "success": true,
  "data": [...],
  "meta": {...}
}
```

### GET /api/reports/ai-insight
```typescript
// AI-powered report recommendations

// Response
{
  "success": true,
  "data": {
    "recommendations": [
      { "reportId", "type", "confidence", "reason" }
    ]
  }
}
```

### GET /api/reports/system-status
```typescript
// Response
{
  "success": true,
  "data": {
    "database": "online",
    "integration": "connected",
    "lastSync": "2026-05-18T08:45:00Z"
  }
}
```

### GET /api/reports/natural-filter
```typescript
// Natural language filter parsing
// Query: "stok gudang A Mei 2026"

// Response
{
  "success": true,
  "data": {
    "filters": { "location": "A", "month": "2026-05" }
  }
}
```

---

# BAGIAN 7: DATABASE
# =============================================================================

## 7.1 SQL Gateway

| Property | Value |
|---------|-------|
| Endpoint | http://localhost:8001/v1/query |
| Header | x-api-key |
| Database | db_ptrj (estate), db_ptrj_mill (mill) |
| Access | READ-ONLY (CUD DILARANG) |

## 7.2 Inventory Tables

| Table | Rows | Description |
|-------|------|-------------|
| IN_ITEM | 7,483 | Master barang |
| IN_STOCKISSUELN | 119,603 | Detail pengeluaran |
| IN_STOCKISSUE | 72,244 | Header pengeluaran |
| IN_MTHENDITEM | 103,742 | Snapshot bulanan |
| IN_FUELISSUELN | 93,450 | Detail BBM |
| IN_FUELISSUE | 45,234 | Header BBM |
| IN_PR | 12,450 | Purchase Request |
| IN_PRLN | 48,293 | PR Line items |

## 7.3 Column Reference

### IN_ITEM
- ItemCode (PK, VARCHAR(20))
- ItemName (VARCHAR(100))
- LocCode (VARCHAR(10))
- CatCode (VARCHAR(10))
- TypeCode (VARCHAR(10))
- UnitCode (VARCHAR(5))
- QtyOnHand (DECIMAL(18,2))
- MinLevel (DECIMAL(18,2))
- MaxLevel (DECIMAL(18,2))
- LastPurchasePrice (DECIMAL(18,2))
- AvgPrice (DECIMAL(18,2))
- PostDate (DATETIME)
- Status (VARCHAR(1))

### IN_STOCKISSUE (Header)
- IssueNo (PK, VARCHAR(20))
- IssueDate (DATETIME)
- LocCode (VARCHAR(10))
- DepartmentCode (VARCHAR(10))
- GangCode (VARCHAR(10))
- EmployeeCode (VARCHAR(10))
- TotalAmount (DECIMAL(18,2))
- Status (VARCHAR(1))
- CreatedBy (VARCHAR(20))
- CreatedDate (DATETIME)

---

# BAGIAN 8: REPORTS CATALOG
# =============================================================================

## 8.1 All 27 Inventory Reports (Groups A-H)

### GROUP A: Stock Overview (4 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-A1 | Stok Gudang Overview | Ringkasan stok per gudang |
| INV-A2 | Stok Kategori Overview | Ringkasan per kategori |
| INV-A3 | Stok Tipe Overview | Ringkasan per tipe |
| INV-A4 | Total Nilai Stok | Total valuation |

### GROUP B: Stock Transactions (4 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-B1 | Mutasi Stok Bulanan | Movement bulanan |
| INV-B2 | Transaksi per Gudang | Detail per lokasi |
| INV-B3 | Transaksi Harian | Harian |
| INV-B4 | Block Transfer | Transfer |

### GROUP C: Stock Valuation (4 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-C1 | Valuation FIFO | Metode FIFO |
| INV-C2 | Valuation Average | Rata-rata |
| INV-C3 | Valuation Last Purchase | Last purchase |
| INV-C4 | Laporan HPP | Harga pokon |

### GROUP D: Dead Stock (4 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-D1 | Dead Stock | >12 bulan tidak gerak |
| INV-D2 | Slow Moving | 6-12 bulan |
| INV-D3 | Zero Stock | Nol tapi perlu |
| INV-D4 | Over Stock | Melebihi max |

### GROUP E: Reorder & Planning (3 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-E1 | Below Reorder | Di bawah minimum |
| INV-E2 | Reorder Plan | Rencana pesan |
| INV-E3 | Lead Time Analysis | Analisis lead time |

### GROUP F: Fuel / BBM (3 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-F1 | Fuel Consumption | Konsumsi |
| INV-F2 | Fuel per Estate | Per estate |
| INV-F3 | Fuel Efficiency | Efisiensi |

### GROUP G: Purchase Requisition (2 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-G1 | PR Outstanding | Belum terpenuhi |
| INV-G2 | PR History | Riwayat |

### GROUP H: Adjustment & Others (3 reports)
| ID | Report | Description |
|----|--------|-------------|
| INV-H1 | Stock Opname | Hasil opname |
| INV-H2 | Adjustment Log | Log penyesuaian |
| INV-H3 | Inventory Summary | Ringkasan |

---

# BAGIAN 9: MODULES
# =============================================================================

## 9.1 All 9 Modules

| Module | Reports | Color | Route |
|--------|---------|-------|-------|
| Inventory | 27 | #167A3A | /report-center/inventory |
| Absensi | 18 | #2563EB | /report-center/absensi |
| Payroll | 24 | #7C3AED | /report-center/payroll |
| Daftar Upah | 15 | #EA8A13 | /report-center/daftar-upah |
| Premi & Lembur | 12 | #D9A514 | /report-center/premi-lembur |
| Produktivitas Kebun | 16 | #16A34A | /report-center/produktivitas |
| Karyawan | 20 | #0EA5E9 | /report-center/karyawan |
| Estate / Divisi | 10 | #8B5CF6 | /report-center/estate-divisi |
| Integrasi & Audit | 14 | #64748B | /report-center/integrasi-audit |

## 9.2 Module Config (lib/reports/config.ts)

```typescript
interface ModuleConfig {
  id: string;           // 'inventory'
  name: string;        // 'Inventory'
  description: string; // 'Stock position...'
  reportCount: number;  // 27
  route: string;       // '/report-center/inventory'
  status: 'active' | 'coming' | 'locked';
  lastUpdated: string;  // '2026-05-20'
  color: string;       // '#167A3A'
  icon: string;       // 'Package'
}
```

---

# BAGIAN 10: STATE MANAGEMENT
# =============================================================================

## 10.1 Zustand Store (store/reportStore.ts)

```typescript
interface ReportStore {
  // UI State
  sidebarCollapsed: boolean;
  activeModule: string | null;
  selectedReportId: string | null;
  
  // Filter State
  filters: FilterConfig[];
  pagination: { page: number; pageSize: number };
  sort: { column: string; direction: 'asc' | 'desc' };
  
  // Data State
  favorites: string[];
  recent: string[];
  searchQuery: string;
  
  // Actions
  toggleSidebar: () => void;
  setActiveModule: (module: string) => void;
  setSelectedReport: (reportId: string) => void;
  setFilter: (filter: FilterConfig) => void;
  clearFilters: () => void;
  toggleFavorite: (reportId: string) => void;
  addRecent: (reportId: string) => void;
  setSearchQuery: (query: string) => void;
}
```

## 10.2 React Query Hooks

```typescript
// Available hooks
useModules() → GET /api/modules
useModule(slug) → GET /api/modules/[slug]
useReports(moduleId) → GET /api/reports?module=
useReportData(reportId, filters) → GET /api/reports/[id]
useReportPreview(reportId) → GET /api/reports/[id]/preview
useExportQueue() → GET /api/export/queue
useSearch(query) → GET /api/search
```

---

# BAGIAN 11: DESIGN SYSTEM
# =============================================================================

## 11.1 Colors

### Primary (Navy)
| Token | Hex | Usage |
|-------|-----|-------|
| navy-900 | #071426 | Sidebar, Topbar |
| navy-800 | #0B1D35 | Hover |
| navy-700 | #102A4C | Active |

### Accent (Green)
| Token | Hex | Usage |
|-------|-----|-------|
| green-700 | #167A3A | Primary buttons, success |
| green-600 | #1F8F46 | Hover |
| green-100 | #EAF7EF | Backgrounds |

### Highlight (Gold)
| Token | Hex | Usage |
|-------|-----|-------|
| gold-600 | #D9A514 | Highlights |
| gold-100 | #FFF7DF | Backgrounds |

### Chart Colors
```
#16A34A, #2563EB, #7C3AED, #EA8A13, 
#EF4444, #0EA5E9, #8B5CF6, #EC4899
```

## 11.2 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Display | Inter | 48px | 700 |
| H1 | Inter | 32px | 700 |
| H2 | Inter | 24px | 600 |
| H3 | Inter | 20px | 600 |
| Body | Inter | 16px | 400 |
| Small | Inter | 14px | 400 |
| Micro | Inter | 12px | 400 |

## 11.3 Spacing

```
0=0px, 1=4px, 2=8px, 3=12px, 4=16px,
6=24px, 8=32px, 12=48px, 16=64px
```

## 11.4 Border Radius

```
sm=4px, md=8px, lg=12px, xl=16px, 2xl=24px, full=9999px
```

---

# BAGIAN 12: CONFIGURATION
# =============================================================================

## 12.1 Environment Variables

```
NODE_ENV=development|production
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:8001/v1/query
DATABASE_HOST=localhost
DATABASE_NAME=db_ptrj
```

## 12.2 Next.js Config (next.config.js)

```javascript
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['http://localhost:3001'],
  // Turbopack config
  turbopack: { root: __dirname },
  // Dev watch options
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      config.watchOptions = { poll: 1000, aggregateTimeout: 300 };
    }
    return config;
  },
};
```

## 12.3 PostCSS Config (postcss.config.mjs)

```javascript
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};
export default config;
```

---

# BAGIAN 13: BUILD & RUN
# =============================================================================

## 13.1 Development Mode

```bash
# Using Bun (recommended)
cd D:/Gawean Rebinmas/Main Dashboard
bun run dev

# Or using Node
npm run dev
```

## 13.2 Production Mode

```bash
# Build
bun run build

# Start
bun run start
```

## 13.3 Via Express Proxy (Production)

```bash
# Kill existing processes
taskkill //F //IM node.exe

# Start server
cd D:/Gawean Rebinmas/Main Dashboard
node server.js

# Server runs on http://localhost:3001
```

## 13.4 Access Points

| URL | Page |
|-----|------|
| http://localhost:3001/ | Landing |
| http://localhost:3001/report-center | Report Center |
| http://localhost:3001/report-center/inventory | Inventory |
| http://localhost:3001/login | Login |
| http://localhost:3001/admin | Admin |

---

# BAGIAN 14: TROUBLESHOOTING
# =============================================================================

## 14.1 Common Issues

### Port Already in Use
```bash
# Find process on port 3001
netstat -ano | grep :3001

# Kill it
taskkill //F //PID <PID>
```

### Lock File Issues
```bash
# Delete Next.js lock
rm -f D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/.next/dev/lock
rm -f D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/.next/server/lock
```

### CSS Not Rendering
- Check: globals.css exists at app/globals.css
- Check: @import "tailwind" at top of globals.css
- Or: Use Tailwind v4 postcss plugin

### 404 on Routes
- Check: server.js isDashboardRoute includes the path
- Pattern: reqPath.startsWith('/report-center')

### 500 Server Error
- Check server logs: process(action='log')
- Check SQL Gateway: http://localhost:8001/v1/query
- Verify database connection

## 14.2 Debug Commands

```bash
# Check server status
curl http://localhost:3001/

# Check API
curl http://localhost:3001/api/reports/inventory

# Check routes
for path in "/" "/report-center" "/report-center/inventory" "/login"; do
  echo "$path: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001$path)"
done
```

---

# BAGIAN 15: FILE REFERENCE
# =============================================================================

## 15.1 Key Pages

| File | Lines | Purpose |
|------|-------|---------|
| app/page.tsx | 699 | Landing PT Rebinmas |
| app/report-center/page.tsx | 1183 | Report Center Dashboard |
| app/report-center/layout.tsx | 38 | AppShell |
| app/report-center/[module]/page.tsx | 241 | Dynamic module |
| components/layout/Sidebar.tsx | 250 | Navigation |
| components/layout/Topbar.tsx | 200 | Topbar |
| components/dashboard/ModuleCard.tsx | 150 | Module cards |
| lib/reports/config.ts | 138 | Module registry |
| lib/reports/mock-data.ts | 459 | Mock data |
| store/reportStore.ts | 100 | Zustand store |

## 15.2 PRD Documents

| Document | Lines | Purpose |
|----------|-------|---------|
| PRD-PRODUCT-VISION.md | 295 | Product vision |
| PRD-TECH-SPEC.md | 470 | Technical spec |
| PRD-DESIGN-SYSTEM.md | 319 | Design tokens |
| PRD-COMPONENT-BLUEPRINT.md | 1000 | Components |
| PRD-ROLE-ACCESS-MATRIX.md | 265 | RBAC |
| PRD-UX-FLOWS.md | 454 | UX flows |
| PRD-REPORT-CENTER-FULL.md | 1076 | Full reports |

---

# END OF DOCUMENTATION
# =============================================================================


---

# BAGIAN 16: REPORTING DETAILS (EXTENDED)
# =============================================================================

## 16.1 Report Architecture

### Report Stack
```
┌─────────────────────────────────────────────┐
│         REPORT CENTER BACKEND
├─────────────────────────────────────────────┤
│  API Layer (Next.js Route Handlers)          │
│  - /api/reports/inventory/route.ts           │
│  - /api/reports/ai-insight/route.ts       │
│  - /api/reports/natural-filter/route.ts  │
├─────────────────────────────────────────────┤
│  SQL Gateway (localhost:8001)              │
│  - Query validation                       │
│  - Parameter binding                     │
│  - Result caching
├─────────────────────────────────────────────┤
│  MSSQL Database (db_ptrj / db_ptrj_mill)   │
│  - IN_* tables                           │
│  - Stored procedures                    │
│  - Views
└─────────────────────────────────────────────┘
```

## 16.2 Report Flow

### User Request Flow
```
1. User navigates to /report-center/inventory
2. GET /api/reports/inventory?module=inventory
3. SQL Gateway validates request
4. Query IN_ITEM, IN_STOCKISSUELN tables
5. Return paginated results
6. TanStack Query caches response
7. UI renders data table
```

### Report Preview Flow
```
1. User clicks report item row
2. Preview panel shows loading
3. GET /api/reports/inventory/[id]/preview
4. SQL returns TOP 5 rows + metadata
5. Display: table, chart, summary, actions
```

## 16.3 Report Types

### A. Stock Position Reports
Focus: Current inventory levels across locations
- Real-time data from IN_ITEM + IN_STOCKISSUELN
- Grouped by: Gudang, Kategori, Tipe
- Metrics: Item count, Total qty, Total value

### B. Transaction Reports
Focus: Movement over time
- Historical from IN_STOCKISSUE/IN_STOCKISSUELN
- Date range filtering
- Aggregation: Daily, Weekly, Monthly
- Exportable

### C. Valuation Reports
Focus: Financial calculations
- FIFO: First-In-First-Out
- Average: Moving average
- Last Purchase: Latest price
- Standard: HPP calculation

### D. Dead Stock Reports
Focus: Identifying slow-moving items
- >12 months: Dead stock
- 6-12 months: Slow moving
- Zero stock: Active demand
- Over stock: Excess

### E. Reorder Reports
Focus: Planning and replenishment
- Below reorder point
- Lead time analysis
- Order recommendations

### F. Fuel Reports
Focus: Fuel consumption (IN_FUELISSUELN)
- By vehicle
- By estate
- Efficiency metrics

### G. Purchase Requisition
Focus: PR tracking
- Outstanding PRs
- Approval flow
- History

### H. Adjustment Reports
Focus: Inventory corrections
- Stock opname results
- Adjustment logs
- Summary

## 16.4 Report API Contract

### GET /api/reports/inventory
```typescript
// Query Parameters
interface ReportQuery {
  module: string;           // 'inventory'
  page?: number;            // 1
  pageSize?: number;       // 50
  sortBy?: string;         // column name
  sortDir?: 'asc' | 'desc';
  filters?: {
    location?: string[];
    category?: string[];
    dateFrom?: string;
    dateTo?: string;
    status?: string[];
  };
}

// Response
interface ReportResponse {
  success: true;
  data: ReportRow[];
  meta: {
    totalRows: number;
    page: number;
    pageSize: number;
    executionTime: string;
    columns: ColumnDef[];
  };
}
```

### GET /api/reports/[id]/preview
```typescript
// Returns top 5 rows + metadata
{
  success: true;
  data: {
    rows: [...],        // 5 rows
    summary: {
      totalItems: number;
      totalQty: number;
      totalValue: number;
    };
    columns: ColumnDef[];
  };
}
```

## 16.5 SQL Query Patterns

### Stock Overview (INV-A1)
```sql
SELECT 
    LocCode AS Gudang,
    COUNT(*) AS TotalItem,
    SUM(QtyOnHand) AS TotalQty,
    SUM(QtyOnHand * ISNULL(LastPurchasePrice,0)) AS Nilai
FROM IN_ITEM
WHERE Status = 'A' AND QtyOnHand > 0
GROUP BY LocCode
ORDER BY TotalQty DESC
```

### Transaction History (INV-B1)
```sql
SELECT 
    YEAR(IssueDate) AS Tahun,
    MONTH(IssueDate) AS Bulan,
    LocCode AS Gudang,
    COUNT(*) AS Transaksi,
    SUM(TotalAmount) AS Nilai
FROM IN_STOCKISSUE
WHERE IssueDate >= '2000-01-01'
GROUP BY YEAR(IssueDate), MONTH(IssueDate), LocCode
ORDER BY Tahun DESC, Bulan DESC
```

### Dead Stock Detection (INV-D1)
```sql
SELECT 
    i.ItemCode,
    i.ItemName,
    i.LocCode,
    i.QtyOnHand,
    i.MinLevel,
    DATEDIFF(MONTH, ISNULL(i.PostDate, '1900-01-01'), GETDATE()) AS BulanTidakGerak
FROM IN_ITEM i
WHERE i.Status = 'A' 
    AND i.QtyOnHand > 0
    AND DATEDIFF(MONTH, ISNULL(i.PostDate, '1900-01-01'), GETDATE()) > 12
```

## 16.6 Report Metadata

### Required Metadata per Report
```typescript
interface ReportConfig {
  id: string;           // 'INV-A1'
  code: string;        // 'STOK-GUDANG'
  name: string;       // 'Stok Gudang Overview'
  description: string; // 'Ringkasan stok per gudang'
  module: string;    // 'inventory'
  group: string;    // 'A'
  category: string; // 'Stock Overview'
  tags: string[];  // ['stok', 'gudang', 'overview']
  priority: 'high' | 'medium' | 'low';
  status: 'live' | 'update' | 'planned';
  sqlProcedure?: string;
  filters: FilterConfig[];
  columns: ColumnConfig[];
  cadences?: string[]; // ['daily', 'weekly', 'monthly']
}
```

## 16.7 Report Filters

### Common Filters
| Filter | Type | Source |
|--------|------|--------|
| Gudang/Lokasi | select | IN_LOC |
| Kategori | select | IN_CAT |
| Tipe | select | IN_TYPE |
| Periode | daterange | IssueDate |
| Status | select | Item status |
| Supplier | select | IN_SUPPLIER |

### Filter UI
```tsx
<FilterBar>
  <Select name="location" options={locations} />
  <Select name="category" options={categories} />
  <DateRange name="periode" />
  <Select name="status" options={['A', 'I']} />
  <Button>Reset</Button>
  <Button>Apply</Button>
</FilterBar>
```

## 16.8 Export Formats

### Excel Export
- Format: .xlsx
- Library: xlsx
- Sheet name: Report name
- Headers: Column names
- Data: Formatted values

### PDF Export
- Format: .pdf
- Library: jspdf + jspdf-autotable
- Page: A4 landscape/portrait
- Headers: Bold
- Pagination: Page X of Y

### CSV Export
- Format: .csv
- Delimiter: comma
- Encoding: UTF-8
- Headers: Included

## 16.9 Report Caching

### TanStack Query Config
```typescript
const reportQueryOptions = {
  queryKey: ['reports', module, filters],
  queryFn: () => fetchReports(module, filters),
  staleTime: 5 * 60 * 1000, // 5 minutes
  cacheTime: 30 * 60 * 1000, // 30 minutes
  refetchOnWindowFocus: false,
};
```

## 16.10 Report Permissions

### Access Matrix
| Role | View | Export | Admin |
|------|-----|--------|-------|
| kerani | own gang | limited | no |
| hr | division | division | no |
| payroll | division | division | no |
| manager | estate | estate | no |
| admin | company | company | yes |

---

# BAGIAN 17: INVENTORY MODULE DEEP DIVE
# =============================================================================

## 17.1 Module Overview

The Inventory module is the most comprehensive with 27 reports across 8 groups (A-H), covering all aspects of inventory management for a palm oil plantation.

### Key Capabilities
- Real-time stock position tracking
- Transaction history and analysis
- Financial valuation (FIFO, Average, Last Purchase)
- Dead stock and slow-moving identification
- Reorder point monitoring
- Fuel consumption tracking
- Purchase requisition management
- Stock opname reconciliation

## 17.2 Data Warehouse

### Primary Tables
- **IN_ITEM**: Master item (7,483 items)
- **IN_LOC**: Warehouse master (30 locations)
- **IN_CAT**: Category master (50 categories)
- **IN_TYPE**: Type master (25 types)
- **IN_UNIT**: Unit of measure (10 units)

### Transaction Tables
- **IN_STOCKISSUE**: Issue header (72,244 records)
- **IN_STOCKISSUELN**: Issue detail (119,603 records)
- **IN_STOCKRECEIVE**: Receive header
- **IN_STOCKRECEIVEN**: Receive detail
- **IN_TRANSFER**: Transfer header
- **IN_TRANSFERN**: Transfer detail

### Monthly Tables
- **IN_MTHENDITEM**: Monthly snapshot (103,742 records)
- **IN_MTHENDTRX**: Monthly transactions

### Fuel Tables
- **IN_FUELISSUE**: Fuel issue header (45,234 records)
- **IN_FUELISSUELN**: Fuel issue detail (93,450 records)

## 17.3 Report Group Details

### GROUP A: Stock Overview (4 Reports)
Reports: INV-A1 to INV-A4
Purpose: High-level stock position summaries
Data Source: IN_ITEM aggregated by location/category
Update Frequency: Real-time
Best For: Daily monitoring

### GROUP B: Stock Transactions (4 Reports)
Reports: INV-B1 to INV-B4
Purpose: Track all stock movements
Data Source: IN_STOCKISSUE/IN_STOCKISSUELN
Update Frequency: Real-time
Best For: Investigation and auditing

### GROUP C: Stock Valuation (4 Reports)
Reports: INV-C1 to INV-C4
Purpose: Financial reporting
Data Source: IN_ITEM + IN_MTHENDITEM
Update Frequency: End of day
Best For: Finance team

### GROUP D: Dead Stock (4 Reports)
Reports: INV-D1 to INV-D4
Purpose: Identify slow-moving inventory
Data Source: IN_ITEM + transaction history
Update Frequency: Weekly
Best For: Procurement planning

### GROUP E: Reorder & Planning (3 Reports)
Reports: INV-E1 to INV-E3
Purpose: Replenishment planning
Data Source: IN_ITEM with MinLevel
Update Frequency: Daily
Best For: Purchasing

### GROUP F: Fuel / BBM (3 Reports)
Reports: INV-F1 to INV-F3
Purpose: Fuel consumption tracking
Data Source: IN_FUELISSUE/IN_FUELISSUELN
Update Frequency: Real-time
Best For: Operations

### GROUP G: Purchase Requisition (2 Reports)
Reports: INV-G1 to INV-G2
Purpose: PR tracking and history
Data Source: IN_PR/IN_PRLN
Update Frequency: Real-time
Best For: Purchasing

### GROUP H: Adjustment & Others (3 Reports)
Reports: INV-H1 to INV-H3
Purpose: Reconciliation and audit
Data Source: Various
Update Frequency: As needed
Best For: Stock audit

## 17.4 Implementation Status

| Group | Status | Reports |
|-------|--------|---------|
| A | ✅ LIVE | INV-A1, INV-A2, INV-A3, INV-A4 |
| B | ✅ LIVE | INV-B1, INV-B2, INV-B3, INV-B4 |
| C | 🔄 WIP | INV-C1, INV-C2, INV-C3, INV-C4 |
| D | ⏳ PENDING | INV-D1, INV-D2, INV-D3, INV-D4 |
| E | ⏳ PENDING | INV-E1, INV-E2, INV-E3 |
| F | ⏳ PENDING | INV-F1, INV-F2, INV-F3 |
| G | ⏳ PENDING | INV-G1, INV-G2 |
| H | ⏳ PENDING | INV-H1, INV-H2, INV-H3 |

---

# BAGIAN 18: QUICK REFERENCE
# =============================================================================

## 18.1 Server Commands

```bash
# Development
bun run dev

# Production
bun run build
bun run start

# Via Express (recommended)
node server.js
```

## 18.2 Debug Commands

```bash
# Check server
curl localhost:3001

# Check API
curl localhost:3001/api/reports/inventory

# List processes
netstat -ano | grep :3001
```

## 18.3 Key Files

| File | Purpose |
|------|---------|
| server.js | Express proxy |
| app/page.tsx | Landing |
| app/report-center/page.tsx | Dashboard |
| components/layout/Sidebar.tsx | Navigation |
| components/layout/Topbar.tsx | Topbar |
| lib/reports/config.ts | Module config |
| store/reportStore.ts | Zustand store |
| docs/PROJECT-DOCUMENTATION.md | This file |

---

# END
# =============================================================================
