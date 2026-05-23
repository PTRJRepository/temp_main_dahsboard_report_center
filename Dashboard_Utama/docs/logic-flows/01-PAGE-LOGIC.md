# Page Logic & Flows Documentation

## 1. Landing Page (/page.tsx)

### Overview
Halaman utama PT Rebinmas Jaya yang menampilkan profil perusahaan.

### Components Used
- Navbar - Navigasi utama dengan menu links
- HeroSection - Section hero dengan company intro
- SatelliteMap - Peta interaktif lokasi estate

### Data Flow
```
User visits / 
  ↓
app/page.tsx loads (static, no API)
  ↓
Render: Navbar → HeroSection → Sections (kilasan, about, operations, inovasi, sustainability, news, gallery, contact)
  ↓
Interactive elements:
- Contact form (mailto: link)
- News click → open external
- Map interactions
```

### Static Sections
1. **kilasan** - Company quote/overview
2. **about** - Vision,misi,sejarah
3. **operations** - Estate locations + map
4. **inovasi** - Innovation cards
5. **sustainability** - CSR/ISPO
6. **news** - News articles (hardcoded)
7. **gallery** - Photo gallery
8. **contact** - Contact form

### User Interactions
- Scroll through sections
- Click navigation menu → scroll to section
- Click news → open external link
- Click map markers → show location info
- Submit contact form → mailto link

---

## 2. Report Center Dashboard (/report-center)

### Main Component: ReportsCenterPage

### Components (Internal)
| Component | Lines | Purpose |
|-----------|-------|---------|
| Sparkline | ~30 | Mini bar chart (7 segments) |
| ModuleTileCard | ~40 | Module selection tile |
| KpiCard | ~30 | KPI metric display |
| BarChartCard | ~50 | Horizontal bar chart |
| LineChartCard | ~50 | SVG line chart |
| DonutCard | ~40 | Donut chart |
| AICommandPanel | ~60 | AI insight sidebar |

### State Management
```typescript
// Local State (useState)
query               → Search input value
activeFilter        → Quick filter (Bulan Ini/Bulan Lalu/dll)
activeModuleId      → Currently selected module (default: 'inventory')
selectedSource    → estate | pabrik (toggle)
currentUser       → User from localStorage
inventoryPayload  → API response data
inventoryLoading  → Loading boolean
inventoryError   → Error message
systemStatus     → Gateway status

// External (Zustand store/useReportStore)
favorites        → array of favorite report IDs
recent          → array of recent report IDs
```

### Data Flows

#### 1. Initialization
```
Mount (useEffect)
  ↓
Read URL param ?source=estate|pabrik
  ↓
Set selectedSource
  ↓
Read localStorage 'user'
  ↓
Set currentUser
```

#### 2. System Status Fetch
```
selectedSource changes (useEffect)
  ↓
fetch /api/reports/system-status?source=${selectedSource}
  ↓
success → setSystemStatus(data)
  ↓
error → setSystemStatus({success: false, error})
```

#### 3. Inventory Query
```
activeModuleId === 'inventory' && selectedSource changes (useEffect)
  ↓
fetch /api/reports/inventory?report=stok-gudang&limit=80&source=${selectedSource}
  ↓
setInventoryPayload(data)
  ↓
setInventoryLoading(false)
  ↓
error → setInventoryError(message)
```

#### 4. Computed Values (useMemo)
```typescript
// After data arrives
kpis = inventoryPayload.summary
stockChart = inventoryPayload.chart?.rows.map(r => ({label, value}))
composition = groupBy(inventoryPayload.rows, 'Kategori|Tipe|Gudang')
insight = createInventoryInsightFromPayload(inventoryPayload)
filteredModules = MODULES.filter(m => m.name.includes(query))
```

### Event Handlers

| Handler | Trigger | Action |
|---------|---------|--------|
| onSelect ModuleTileCard | Click tile | setActiveModuleId(id) → navigate/filter |
| onChange search | Type input | setQuery(value) → filter modules |
| onClick filter | Click quick filter | setActiveFilter(filter) |
| onClick source | Click estate/pabrik | setSelectedSource(id) |
| selectByStep | Click nav arrows | Cycle through modules |
| copyInsight | Click copy | Copy to clipboard |
| toggleFavorite | Click star | toggleFavorite in store |
| onClick reset | Click reset | Clear query + filter |

### Key Imports
```typescript
// Components
import GlobalSearch from '@/components/dashboard/GlobalSearch'

// Config & Data
import { liveInventoryReports } from '@/lib/reports/inventory/config'
import { createInventoryInsightFromPayload, hasInventoryQueryData } from '@/lib/reports/inventory/monitoring'
import { InsightContent } from '@/lib/reports/intelligence'

// Store
import { useReportStore } from '@/store/reportStore'
```

---

## 3. Report Center Layout (/report-center/layout)

### Structure
```tsx
<motion.div className="app-shell">
  <Sidebar />
  <div className="main-area">
    <Topbar />
    <main>{children}</main>
  </div>
</motion.div>
```

### Providers
- Sidebar from: '@/components/layout/Sidebar'
- Topbar from: '@/components/layout/Topbar'
- Store: useReportStore for sidebarCollapsed state

### Animations
- Sidebar collapse: 200ms ease
- Page transitions via Framer Motion

---

## 4. Inventory Page (/report-center/inventory)

### Structure
```
app/report-center/inventory/
├── page.tsx              # Server component (Suspense wrapper)
├── InventoryReportsClient.tsx  # Client component
└── [report]/
    ├── page.tsx          # Server component
    └── ReportViewerClient.tsx  # Client viewer
```

### InventoryReportsClient.tsx
- Lists all inventory reports
- Filter by category/group
- Sort options
- Pagination

### ReportViewerClient.tsx
- Full data table view
- Export buttons (Excel/PDF/CSV)
- Column sorting
- Column visibility toggle

---

## 5. Dynamic Module (/report-center/[module])

### File: [module]/page.tsx
- Uses: generateStaticParams() for pre-render
- Fetches module config via getModuleConfig(id)
- Gets mock reports via getMockReportsByModule(id)
- Renders: ModuleToolbar + report list

### Function: generateStaticParams()
```typescript
export async function generateStaticParams() {
  return MODULE_IDS.map(id => ({ module: id }))
}
```

---

## 6. Login Page (/login)

### Auth Flow
```
User enters email + password
  ↓
POST /api/auth/login
  ↓
Success → JWT cookie set → redirect to /report-center
  ↓
Error → show error message
```

### Implementation
- Uses NextAuth.js pattern (or custom JWT)
- Session stored in HTTP-only cookie
- Protected routes redirect to /login
