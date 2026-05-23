# PT REBINMAS JAYA REPORT CENTER
# Dokumentasi Arsitektur Komprehensif
# Generated: May 2026

# =============================================================================
# BAGIAN 1: RINGKASAN EKSEKUTIF
# =============================================================================

## 1.1 Apa Itu Report Center?

Report Center adalah aplikasi web internal PT Rebinmas Jaya yang专门服务于palm oil plantation company ini. Tujuannya: مركز akses semua laporan operasional perusahaan — report-only experience, terpisah dari sistem pengelolaan data (input/edit/delete).

## 1.2 Ruang Lingkup

- Total Laporan: 151 reports across 9 modul
- Modul: Absensi, Payroll, Daftar Upah, Inventory, Premi & Lembur, Produktivitas Kebun, Karyawan, Estate/Divisi, Integrasi & Audit
- Pengguna: 5 role (Kerani, HR, Payroll, Manager, Admin)
- Database: SQL Gateway → MSSQL (read-only)
- Tech Stack: Next.js 14 + TypeScript + Tailwind CSS v4 + Zustand + React Query

# =============================================================================
# BAGIAN 2: ARSITEKTUR SISTEM
# =============================================================================

## 2.1 Arsitektur Keseluruhan

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BROWSER                                       │
│  (Chrome/Edge/Firefox)                                           │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP :3001
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│             EXPRESS PROXY SERVER (server.js)                          │
│  Port: 3001                                                   │
│  - Route: /, /dashboard → Next.js Landing                       │
│  - Route: /report-center/* → Next.js Report Center                 │
│  - Route: /login → Next.js Login                                   │
│  - Route: /api/* → Next.js API                                  │
│  - Route: /* → http://localhost:5176 (Next.js dev)               │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP
                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              NEXT.JS APP ROUTER (Dashboard_Utama/)                 │
│  - app/page.tsx → Landing PT Rebinmas                           │
│  - app/report-center/page.tsx → Report Center Dashboard         │
│  - app/report-center/[module]/page.tsx → Module Detail           │
│  - app/report-center/inventory/page.tsx → Inventory Reports     │
│  - app/api/reports/* → API Routes                              │
└──────────────────┬──────────────────────────────────────────────┘
                   │ HTTP POST :8001/v1/query
                   ▼
┌───────────────────────────���─────────────────────────────────────────────┐
│              SQL GATEWAY SERVICE                                 │
│  Endpoint: http://localhost:8001/v1/query                        │
│  Header: x-api-key                                            │
│  Database: db_ptrj (estate), db_ptrj_mill (mill)               │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Tech Stack Detail

| Komponen | Teknologi | Versi |
|---------|-----------|-------|
| Framework | Next.js | 14.x (App Router) |
| Bahasa | TypeScript | 5.x |
| Styling | Tailwind CSS | v4 (@tailwindcss/postcss) |
| State (Client) | Zustand | latest |
| State (Server) | React Query | 5.x |
| Animation | Framer Motion | 12.x |
| Icons | Lucide React | latest |
| Auth | JWT (HTTP-only cookie) | - |
| Database | MSSQL via SQL Gateway | - |

## 2.3 Direktori Project

```
D:/Gawean Rebinmas/Main Dashboard/
├── server.js                 # Express proxy server (port 3001)
├── Dashboard_Utama/         # Next.js app
│   ├── app/
│   │   ├── page.tsx                    # Landing PT Rebinmas
│   │   ├── login/page.tsx              # Login page
│   │   ├── dashboard/page.tsx           # Old dashboard
│   │   ├── report-center/
│   │   │   ├── page.tsx               # Report Center Dashboard
│   │   │   ├── layout.tsx              # AppShell (Sidebar+Topbar)
│   │   │   ├── [module]/page.tsx       # Dynamic module page
│   │   │   └── inventory/
│   │   │       ├── page.tsx             # Inventory module
│   │   │       └── InventoryReportsClient.tsx
│   │   └── api/
│   │       ├── auth/*                  # Auth routes
│   │       └── reports/*               # Report API routes
│   ├── components/
│   │   ├── layout/                   # Sidebar, Topbar
│   │   └── dashboard/               # ModuleCard, HeroBanner, etc.
│   ├── lib/reports/
│   │   ├── config.ts                # Module registry
│   │   ├── mock-data.ts             # Mock reports
│   │   └── inventory/config.ts      # Inventory config
│   ├── store/
│   │   └── reportStore.ts          # Zustand store
│   ├── docs/                      # PRD documents (this!)
│   └── .next/                    # Build cache
```

# =============================================================================
# BAGIAN 3: STRUKTUR ROUTING
# =============================================================================

## 3.1 Semua Route

| Path | Komponen | Keterangan |
|------|---------|-----------|
| / | app/page.tsx | Landing PT Rebinmas Jaya |
| /dashboard | app/dashboard/page.tsx | Old dashboard (backup) |
| /login | app/login/page.tsx | Login page |
| /report-center | app/report-center/page.tsx | Report Center Dashboard |
| /report-center/[module] | app/report-center/[module]/page.tsx |Dynamic module (absensi, payroll, dll) |
| /report-center/inventory | app/report-center/inventory/page.tsx | Inventory reports |
| /report-center/inventory/[report] | app/report-center/inventory/[report]/page.tsx | Report viewer |
| /admin | app/admin/page.tsx | Admin dashboard |
| /admin/executive | app/admin/executive/page.tsx | Executive dashboard |

## 3.2 Routing Convention

- Modul slug: lowercase, dash-separated (contoh: `absensi`, `payroll`, `inventory`)
- Report ID: uppercase dengan dash (contoh: `INV-A1`, `STOK-GUDANG`)
- breadcrumb format: `Dashboard / Modules / [ModuleName]`

# =============================================================================
# BAGIAN 4: KATALOG MODUL
# =============================================================================

## 4.1 Semua 9 Modul

| Modul |Reports |Warna |Status |Description |
|------|--------|-------|-------|-----------|
| Inventory | 27 | #167A3A (green) | Active | Stock position, movement, valuation |
| Absensi | 18 | #2563EB (blue) | Active | Attendance, schedules |
| Payroll | 24 | #7C3AED (purple) | Active | Salary computation |
| Daftar Upah | 15 | #EA8A13 (orange) | Active | Daily wage register |
| Premi & Lembur | 12 | #D9A514 (gold) | Active | Overtime, incentive |
| Produktivitas Kebun | 16 | #16A34A (green) | Active | Output metrics, KPIs |
| Karyawan | 20 | #0EA5E9 (cyan) | Active | Employee master data |
| Estate / Divisi | 10 | #8B5CF6 (violet) | Active | Estate-level data |
| Integrasi & Audit | 14 | #64748B (slate) | Active | Cross-module audit |

## 4.2 Module Config (lib/reports/config.ts)

```typescript
interface ModuleConfig {
  id: string;           // 'inventory', 'absensi', dll
  name: string;         // 'Inventory', 'Absensi'
  description: string;   // Deskripsi modul
  reportCount: number;  // Jumlah laporan
  route: string;      // '/report-center/inventory'
  status: 'active' | 'coming' | 'locked';
  lastUpdated: string;  // Tanggal last update
  color: string;       // Hex color
  icon: string;       // Lucide icon name
}
```

# =============================================================================
# BAGIAN 5: DATABASE SCHEMA
# =============================================================================

## 5.1 Database Connection

| Property | Value |
|---------|-------|
| SQL Gateway | http://localhost:8001/v1/query |
| Header | x-api-key |
| Estate DB | db_ptrj (SERVER_PROFILE_2) |
| Mill DB | db_ptrj_mill (SERVER_PROFILE_3) |
| Access | READ-ONLY (CUD DILARANG) |

## 5.2 IN_* Tables (Inventory)

| Table | Rows | Description |
|-------|------|------------|
| IN_ITEM | 7,483 | Master barang |
| IN_STOCKISSUELN | 119,603 | Detail pengeluaran |
| IN_STOCKISSUE | 72,244 | Header pengeluaran |
| IN_MTHENDITEM | 103,742 | Snapshot bulanan |
| IN_FUELISSUELN | 93,450 | Detail BBM |
| IN_FUELISSUE | 45,234 | Header BBM |
| IN_PR | 12,450 | Purchase Request |
| IN_PRLN | 48,293 | PR Line items |

## 5.3 SQL Gateway API

```typescript
// Request
POST /v1/query
{
  "query": "SELECT * FROM IN_ITEM WHERE QtyOnHand > 0",
  "params": [],
  "database": "db_ptrj"
}

// Response
{
  "success": true,
  "data": [...],
  "meta": {
    "rows": 7483,
    "columns": [...],
    "executionTime": "245ms"
  }
}
```

# =============================================================================
# BAGIAN 6: KOMPONEN ARSITEKTUR
# =============================================================================

## 6.1 Komponen Utama

### AppShell
- Layout utama dengan Sidebar + Topbar + Content
- Sidebar: 260px (collapsed: 72px)
- Topbar: 64px fixed
- Responsive: tablet (< 1200px), mobile (< 600px)

### Sidebar (components/layout/Sidebar.tsx)
- Dark navy background (#071426)
- logo PT Rebinmas Jaya
- Menu groups: UTAMA, LAPORAN, MODUL, ADMINISTRASI
- Collapse/expand toggle
- Active state indicator

### Topbar (components/layout/Topbar.tsx)
- Dark navy background (#071426)
- Global search input (Ctrl+K shortcut)
- User profile dropdown
- Notification badge
- Active periode/divisi display

### HeroBanner (components/dashboard/HeroBanner.tsx)
- Plantation background image
- Overlay dark gradient
- System status widget
- Quick action buttons

### GlobalSearch (components/dashboard/GlobalSearch.tsx)
- Ctrl+K to open
- Search across all modules
- Semantic tag suggestions
- Recent searches

### ModuleCard (components/dashboard/ModuleCard.tsx)
- Windows tile aesthetic
- Icon + module name + count
- Status badge (Active/Coming/Locked)
- Click → /report-center/[module]

### ReportListItem (components/dashboard/ReportListItem.tsx)
- Report name + description
- Last updated timestamp
- Status indicator
- Tags (searchable)
- Actions: View, Preview, Export

### ReportPreviewPanel (components/dashboard/ReportPreviewPanel.tsx)
- 380px sticky right panel
- Shows when report selected
- Table preview (top 5 rows)
- Chart placeholder
- Metadata + action buttons

### ReportViewer (components/dashboard/ReportViewer.tsx)
- Full page report view
- Filter bar
- Data table with pagination
- Column sorting
- Export buttons (Excel, PDF, CSV)

## 6.2 State Management

### Zustand Store (store/reportStore.ts)
```typescript
interface ReportState {
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
}
```

### TanStack Query Hooks
- useReports(moduleId) → fetch module reports
- useReportData(reportId, filters) → fetch report data
- useReportSearch(query, filters) → search reports
- useExport(reportId, format) → export report

# =============================================================================
# BAGIAN 7: API CONTRACT
# =============================================================================

## 7.1 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| /api/modules | GET | List all modules |
| /api/modules/[slug] | GET | Single module detail |
| /api/reports | GET | List all reports |
| /api/reports/[id] | GET | Single report data |
| /api/reports/[id]/preview | GET | Report preview (top 5) |
| /api/export | POST | Export request |
| /api/export/queue | GET | Export queue |
| /api/search | GET | Global search |
| /api/auth/login | POST | Login |
| /api/auth/logout | POST | Logout |
| /api/auth/verify | GET | Verify session |

## 7.2 Response Shape

```typescript
// Success Response
interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    rows: number;
    page: number;
    pageSize: number;
    executionTime: string;
  };
}

// Error Response
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
```

# =============================================================================
# BAGIAN 8: RBAC MATRIX
# =============================================================================

## 8.1 User Roles

| Role | Description | Scope |
|------|-------------|-------|
| kerani | Karyawan operasional | Gang/Kemandoran |
| hr | HR staff | Division |
| payroll | Payroll processor | Division |
| manager | Estate Manager | Estate |
| admin | System admin | Company |

## 8.2 Module Access Matrix

| Role | Inv | Abs | Pay | Upah | Premi | Produksi | Kary | Estate | Audit |
|------|-----|-----|-----|------|-------|--------|------|--------|-------|
| Kerani | F | S | L | S | S | L | L | - | - |
| HR | F | F | L | F | L | L | F | - | - |
| Payroll | F | F | F | F | F | L | L | - | - | - |
| Manager | S | S | S | S | S | S | S | S | S |
| Admin | F | F | F | F | F | F | F | F | F |

F = Full, S = Summary, L = Limited, - = No Access

## 8.3 Scope Hierarchy

```
Company (PT Rebinmas Jaya)
  └─ Estate (DME, DMB, dll)
      └─ Division (Kebun, Mill, dll)
          └─ Gang (G1, G2, dll)
              └─ Employee (NIK)
```

# =============================================================================
# BAGIAN 9: DESIGN SYSTEM
# =============================================================================

## 9.1 Warna

### Primary Colors
| Token | Hex | Usage |
|-------|-----|-------|
| navy-900 | #071426 | Sidebar, Topbar |
| navy-800 | #0B1D35 | Hover states |
| navy-700 | #102A4C | Active states |

### Accent Colors
| Token | Hex | Usage |
|-------|-----|-------|
| green-700 | #167A3A | Primary buttons, success |
| green-600 | #1F8F46 | Hover |
| green-100 | #EAF7EF | Backgrounds |

### Highlight Colors
| Token | Hex | Usage |
|-------|-----|-------|
| gold-600 | #D9A514 | Highlights, badges |
| gold-100 | #FFF7DF | Backgrounds |

### Chart Colors (8-color palette)
```
#16A34A (green), #2563EB (blue), #7C3AED (purple), 
#EA8A13 (orange), #EF4444 (red), #0EA5E9 (cyan),
#8B5CF6 (violet), #EC4899 (pink)
```

## 9.2 Typography

| Element | Font | Size | Weight |
|---------|------|------|--------|
| Display | Inter | 48px | 700 |
| H1 | Inter | 32px | 700 |
| H2 | Inter | 24px | 600 |
| H3 | Inter | 20px | 600 |
| Body | Inter | 16px | 400 |
| Small | Inter | 14px | 400 |
| Micro | Inter | 12px | 400 |
| Code | JetBrains Mono | 14px | 400 |

## 9.3 Spacing (4px base)

```
0: 0px
1: 4px
2: 8px
3: 12px
4: 16px
6: 24px
8: 32px
12: 48px
16: 64px
24: 96px
```

## 9.4 Border Radius

```
sm: 4px    (buttons)
md: 8px    (cards)
lg: 12px   (modals)
xl: 16px   (panels)
2xl: 24px  (hero)
full: 9999px (pills)
```

## 9.5 Shadows

```
sm: 0 1px 2px rgba(0,0,0,0.05)
md: 0 4px 6px rgba(0,0,0,0.07)
lg: 0 10px 15px rgba(0,0,0,0.10)
xl: 0 20px 25px rgba(0,0,0,0.15)
```

# =============================================================================
# BAGIAN 10: KATALOG LAPORAN INVENTORY
# =============================================================================

## 10.1 GROUP A: Stock Overview (4 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-A1 | Stok Gudang Overview | Ringkasan stok per gudang |
| INV-A2 | Stok Kategori Overview | Ringkasan per kategori |
| INV-A3 | Stok Tipe Overview | Ringkasan per tipe barang |
| INV-A4 | Total Nilai Stok | Total valuation semua gudang |

## 10.2 GROUP B: Stock Transactions (4 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-B1 | Mutasi Stok Bulanan | Movement bulanan |
| INV-B2 | Transaksi per Gudang | Detail transaksi per lokasi |
| INV-B3 | Transaksi Harian | Transaksi harian |
| INV-B4 | Block Transfer | Transfer antar block |

## 10.3 GROUP C: Stock Valuation (4 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-C1 | Valuation FIFO | Valuasi metode FIFO |
| INV-C2 | Valuation Average | Valuasi rata-rata |
| INV-C3 | Valuation Last Purchase | Valuasi last purchase |
| INV-C4 | Laporan HPP | Harga pokon |

## 10.4 GROUP D: Dead Stock (4 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-D1 | Dead Stock (>12 bulan) | Tidak bergerak > 1 tahun |
| INV-D2 | Slow Moving (6-12 bulan) | Gerak jarang |
| INV-D3 | Zero Stock | Stok nol tapi masih perlu |
| INV-D4 | Over Stock | Melebihi max |

## 10.5 GROUP E: Reorder & Planning (3 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-E1 | Below Reorder | Di bawah batas minimum |
| INV-E2 | Reorder Plan | Rencana pemesanan |
| INV-E3 | Lead Time Analysis | Analisis lead time |

## 10.6 GROUP F: Fuel / BBM (3 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-F1 | Fuel Consumption | Konsumsi BBM |
| INV-F2 | Fuel per Estate | BBM per estate |
| INV-F3 | Fuel Efficiency | Efisiensi BBM |

## 10.7 GROUP G: Purchase Requisition (2 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-G1 | PR Outstanding | PR belum terpenuhi |
| INV-G2 | PR History | Riwayat PR |

## 10.8 GROUP H: Adjustment & Others (3 reports)

| ID | Report Name | Description |
|----|-------------|-------------|
| INV-H1 | Stock Opname | Hasil stock opname |
| INV-H2 | Adjustment Log | Log penyesuaian |
| INV-H3 | Inventory Summary | Ringkasan inventory |

# =============================================================================
# BAGIAN 11: IMPLEMENTATION STATUS
# =============================================================================

## 11.1 Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation (AppShell, Sidebar, Topbar) | ✅ DONE |
| 2 | Core Navigation (ModuleCard, ReportList) | ✅ DONE |
| 3 | Report Viewing (DataTable, Export) | 🔄 WIP |
| 4 | Advanced (AI, ExportQueue) | ⏳ PENDING |
| 5 | Polish (EmptyState, A11y) | ⏳ PENDING |

## 11.2 Built Components

✅ app/layout.tsx - Root layout with CSS
✅ app/page.tsx - Landing page
✅ app/report-center/layout.tsx - Report Center shell
✅ app/report-center/page.tsx - Dashboard with 9 module cards
✅ app/report-center/[module]/page.tsx - Dynamic module page
✅ components/layout/Sidebar.tsx - Dark navy sidebar
✅ components/layout/Topbar.tsx - Top navigation
✅ components/dashboard/ModuleCard.tsx - Module cards grid
✅ components/dashboard/HeroBanner.tsx - Hero section
✅ components/dashboard/GlobalSearch.tsx - Search component
✅ lib/reports/config.ts - Module registry
✅ lib/reports/mock-data.ts - Mock report data

## 11.3 Pending Components

⏳ ReportViewer with DataTable
⏳ ReportPreviewPanel (380px)
⏳ ExportButtonGroup
⏳ ExportQueuePanel (420px slide-in)
⏳ IntelligenceWidget (AI recommendations)
⏳ ExecutiveDashboard (Admin KPIs)
⏳ EmptyState components
⏳ LoadingSkeleton variants

# =============================================================================
# BAGIAN 12: QUICK REFERENCE
# =============================================================================

## 12.1 Development Commands

```bash
# Development
cd D:/Gawean Rebinmas/Main Dashboard
bun run dev

# Production build
bun run build
bun run start

# Via Express proxy (recommended)
node server.js
```

## 12.2 Environment Variables

```
NODE_ENV=development
PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:8001/v1/query
```

## 12.3 Key Paths

| Path | Description |
|------|-------------|
| / | Landing page |
| /report-center | Report Center |
| /report-center/inventory | Inventory module |
| /api/reports/* | Report APIs |

## 12.4 SQL Gateway Testing

```bash
# Test query
curl -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_KEY" \
  -d '{"query": "SELECT TOP 1 * FROM IN_ITEM", "database": "db_ptrj"}'
```

# =============================================================================
# END OF DOCUMENTATION
# =============================================================================

Generated: May 2026
Version: 1.0.0
Project: PT Rebinmas Jaya Report Center
Location: D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/


# =============================================================================
# BAGIAN 13: PRD DOCUMENTS CROSS-REFERENCE
# =============================================================================

## 13.1 PRD Documents List

This architecture documentation references these PRD documents:

| PRD Document | Location | Lines | Description |
|--------------|----------|-------|-------------|
| PRD-PRODUCT-VISION.md | docs/ | 295 | Product vision, 151 reports, 5 personas |
| PRD-REPORT-CENTER-FULL.md | docs/ | 1076 | Complete inventory 27 reports detail |
| PRD-TECH-SPEC.md | docs/ | 470 | Technical stack, API contracts |
| PRD-DESIGN-SYSTEM.md | docs/ | 319 | Color, typography, spacing tokens |
| PRD-COMPONENT-BLUEPRINT.md | docs/ | 1000 | 22 component specs |
| PRD-IMPLEMENTATION-ORDER.md | docs/ | 166 | 5-phase plan |
| PRD-MISSING-SPECS.md | docs/ | 365 | RBAC, security gaps |
| PRD-ROLE-ACCESS-MATRIX.md | docs/ | 265 | RBAC matrix |
| PRD-UX-FLOWS.md | docs/ | 454 | UX flows |
| PRD-INFORMATION-ARCHITECTURE.md | docs/ | 338 | IA specs |
| PRD-WORLD-MONITOR-AI.md | docs/ | 531 | AI dashboard spec |
| PRD-DASHBOARD-REPORT-CENTER.md | docs/ | 378 | Dashboard layout |
| REPORT-INVENTORY-CATALOG.md | docs/ | 731 | 27 inventory reports |

# =============================================================================
# BAGIAN 14: COMPONENT BLUEPRINTS (DETAILED)
# =============================================================================

## 14.1 AppShell Specifications

**Dimensions:**
- Sidebar: 260px (collapsed: 72px)
- Topbar: 64px fixed
- Content: flexible width
- Responsive breakpoints: <1200px tablet, <600px mobile

**Structure:**
```tsx
<div className="flex min-h-screen">
  <Sidebar />
  <div className="flex-1 flex flex-col">
    <Topbar />
    <main>{children}</main>
  </div>
</div>
```

## 14.2 Sidebar Specifications

**Navigation Groups:**
- UTAMA: Dashboard
- LAPORAN: All Reports, Favorites, Recent
- MODUL: Modules (9 items)
- ADMINISTRASI: Export History, Settings

**States:**
- Default: Dark navy (#071426)
- Hover: Lighter navy (#0B1D35)  
- Active: Left border 3px green (#167A3A)

## 14.3 Topbar Specifications

**Elements:**
- Logo + Title
- Global search input with Ctrl+K
- Active periode badge
- Active divisi badge
- Notification bell with count
- User profile dropdown

## 14.4 ModuleCard Specifications

**Layout:** Windows tile aesthetic
**Size:** Min 280px
**Structure:**
- Icon (48px)
- Module name
- Report count badge
- Description (2 lines max)
- Last updated timestamp
- CTA button

**Colors per module:**
- Inventory: #167A3A
- Absensi: #2563EB
- Payroll: #7C3AED
- Daftar Upah: #EA8A13
- Premi & Lembur: #D9A514
- Produktivitas: #16A34A
- Karyawan: #0EA5E9
- Estate/Divisi: #8B5CF6
- Integrasi & Audit: #64748B

## 14.5 ReportListItem Specifications

**Columns:** Name, Description, Last Updated, Tags, Actions
**Actions:** View, Preview, Export (Excel/PDF)
**Status indicators:** Live (green), Update (yellow), Locked (gray)

## 14.6 ReportPreviewPanel Specifications

**Width:** 380px sticky right
**Sections:**
- Report title + description
- Table preview (5 rows)
- Chart placeholder
- Summary totals
- Metadata (source, period, updated)
- Action buttons

## 14.7 ReportViewer Specifications

**Components:**
- Filter bar (date, location, category)
- Summary cards (4 across)
- Data table with pagination
- Export button group
- Column visibility toggle

# =============================================================================
# BAGIAN 15: UX FLOWS
# =============================================================================

## 15.1 Search Flow

1. User opens page (focus on search)
2. Press Ctrl+K or click search
3. Type query
4. Server-side semantic parse
5. Filter by permissions
6. Show results dropdown
7. Click result or Enter
8. Navigate to preview or detail

## 15.2 Module Browse Flow

1. User on /report-center
2. See module cards grid
3. Click module card
4. Navigate to /report-center/[module]
5. Show: header, report list, preview
6. Click report row
7. Preview panel updates
8. Click Lihat Laporan

## 15.3 Report Viewer Flow

1. Report detail page loads
2. Filter bar available
3. Select filters + apply
4. Loading skeleton
5. Data loads / Empty / Error
6. Table with pagination
7. Sort / resize columns
8. Click Export

## 15.4 Error Handling

| Error | HTTP | Indonesian Message |
|-------|------|-----------------|
| Network | 0 | Tidak dapat terhubung. Periksa koneksi. |
| Auth | 401 | Sesi berakhir. Login kembali. |
| Access | 403 | Anda tidak punya akses. |
| Not Found | 404 | Laporan tidak ditemukan. |
| Server | 500 | Kesalahan server. Coba lagi. |
| Export | 400 | Export gagal. Coba lagi. |

# =============================================================================
# BAGIAN 16: DATABASE DETAILS
# =============================================================================

## 16.1 Key Tables

**IN_ITEM** (Master)
- 7,483 rows
- PK: ItemCode
- Columns: ItemName, LocCode, QtyOnHand, LastPurchasePrice

**IN_STOCKISSUE** (Pengeluaran)
- 72,244 rows
- PK: IssueNo
- Columns: IssueDate, LocCode, GangCode, TotalAmount

**IN_STOCKISSUELN** (Detail)
- 119,603 rows
- FK: IssueNo, ItemCode
- Columns: QtyIssue, UnitPrice, TotalAmount

**IN_MTHENDITEM** (Monthly)
- 103,742 rows
- PK: ItemCode, LocCode, YearMonth
- Columns: BeginQty, InQty, OutQty, EndQty, EndValue

**IN_FUELISSUELN** (BBM)
- 93,450 rows
- FK: IssueNo, ItemCode

**IN_PR** (Purchase Request)
- 12,450 rows
- PK: PRNo
- Columns: PRDate, DepartmentCode, Status

# =============================================================================
# BAGIAN 17: SQL STANDARDS
# =============================================================================

## 17.1 Required Headers
```sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
```

## 17.2 RTRIM for strings
```sql
WHERE RTRIM(ItemName) = 'Pupuk NPK'
```

## 17.3 Date filtering
```sql
WHERE PostDate >= '2000-01-01'
-- Exclude 1900-01-01 placeholders
```

## 17.4 Pagination
```sql
OFFSET @PageSize * (@Page - 1) ROWS
FETCH NEXT @PageSize ROWS ONLY
```

## 17.5 Division by zero
```sql
SELECT CASE WHEN Total > 0 THEN Amount / Total ELSE 0 END
```

# =============================================================================
# BAGIAN 18: VERSION HISTORY
# =============================================================================

| Wave | Date | Notes |
|------|------|-------|
| Wave 0 | May 2026 | Codex design |
| Wave 1 | Early May | Foundation |
| Wave 2 | Mid May | Module pages |
| Wave 3 | Mid May | Design polish |
| Wave 4 | Mid May | Data + hooks |
| Wave 5 | May 17 | CSS fixes |
| Wave 6 | May 17 | Final polish |

# =============================================================================
# END
# =============================================================================
