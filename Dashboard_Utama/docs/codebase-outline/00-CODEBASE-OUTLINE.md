# PT REBINMAS JAYA REPORT CENTER
# CODEBASE OUTLINE - COMPLETE REFERENCE

**Project:** D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/  
**Generated:** May 2026  
**Purpose:** Complete reference for understanding the codebase

---

## DAFTAR ISI

1. [Directory Structure](#1-directory-structure)
2. [Page Routes](#2-page-routes)
3. [API Endpoints](#3-api-endpoints)
4. [Components](#4-components)
5. [State Management](#5-state-management)
6. [Lib Utils](#6-lib-utils)
7. [Config Files](#7-config-files)
8. [Server Actions](#8-server-actions)

---

## 1. DIRECTORY STRUCTURE

```
D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/
├── app/                          # NEXT.JS APP ROUTER (35 files)
│   ├── actions/                  # Server actions
│   │   ├── actions.ts           # authenticate
│   │   ├── admin-permissions.ts
│   │   ├── gang-actions.ts
│   │   └── user-actions.ts
│   ├── admin/                   # Admin pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── executive/page.tsx
│   ├── api/                     # API routes
│   │   ├── auth/               # Auth endpoints
│   │   │   ├── [...nextauth]/route.ts
│   │   │   ├── login/route.ts
│   │   │   ├── logout/route.ts
│   │   │   ├── public-key/route.ts
│   │   │   └── verify/route.ts
│   │   └── reports/            # Report endpoints
│   │       ├── ai-insight/route.ts
│   │       ├── inventory/route.ts
│   │       ├── natural-filter/route.ts
│   │       └── system-status/route.ts
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── dashboard-user/page.tsx
│   ├── modules/                # Module pages (partial)
│   │   └── inventory/page.tsx
│   ├── report-center/          # REPORT CENTER
│   │   ├── layout.tsx
│   │   ├── page.tsx           # Main dashboard
│   │   ├── [module]/         # Dynamic module
│   │   │   ├── ModuleToolbar.tsx
│   │   │   └── page.tsx
│   │   └── inventory/       # Inventory module
│   │       ├── page.tsx
│   │       ├── InventoryReportsClient.tsx
│   │       └── [report]/     # Report viewer
│   │           ├── page.tsx
│   │           └── ReportViewerClient.tsx
│   ├── layout.tsx             # Root layout
│   ├── providers.tsx          # React providers
│   └── page.tsx              # Landing page
│
├── components/                # REACT COMPONENTS (19 files)
│   ├── layout/
│   │   ├── Sidebar.tsx       # Navigation sidebar
│   │   └── Topbar.tsx       # Top bar
│   ├── dashboard/
│   │   ├── AIInsightCard.tsx
│   │   ├── ModuleCard.tsx
│   │   ├── SystemInfoPanel.tsx
│   │   ├── HeroBanner.tsx
│   │   ├── GlobalSearch.tsx
│   │   ├── MonitoringVisualSection.tsx
│   │   ├── RecentPanel.tsx
│   │   └── FavoritesPanel.tsx
│   └── shared/
│       ├── SummaryCard.tsx
│       ├── FavoriteButton.tsx
│       ├── EmptyState.tsx
│       ├── ExportButtonGroup.tsx
│       ├── ExportQueuePanel.tsx
│       ├── FilterChips.tsx
│       ├── GlobalSearch.tsx
│       ├── LoadingSkeleton.tsx
│       └── NotificationDropdown.tsx
│
├── lib/                      # LIBRARIES & UTILS
│   ├── api/                  # API utilities
│   │   ├── queries.ts
│   │   ├── reports.ts
│   │   ├── sql-gateway.ts
│   │   └── types.ts
│   ├── hooks/                # Custom React hooks
│   │   ├── useExport.ts
│   │   ├── useReports.ts
│   │   └── useSearch.ts
│   ├── rbac/                # Role-based access
│   │   ├── index.ts
│   │   ├── permissions.ts
│   │   ├── types.ts
│   │   └── usePermission.ts
│   ├── reports/              # Report config
│   │   ├── config.ts         # MODULE_CONFIGS
│   │   ├── intelligence.ts
│   │   ├── monitoring.ts
│   │   ├── report-filtering.ts
│   │   └── inventory/        # Inventory-specific
│   │       ├── config.ts
│   │       └── monitoring.ts
│   ├── utils.ts
│   └── mock-data.ts
│
├── store/                   # ZUSTAND STATE (1 file)
│   └── reportStore.ts
│
├── docs/                   # DOCUMENTATION
│   ├── logic-flows/          # Logic & flows docs
│   ├── PROJECT-DOCUMENTATION.md
│   └── ARCHITECTURE-DOCUMENTATION.md
│
└── public/                 # Static assets
```

---

## 2. PAGE ROUTES

| Route | File | Description |
|-------|------|-------------|
| / | app/page.tsx | Landing PT Rebinmas Jaya |
| /login | app/login/page.tsx | Login page |
| /dashboard | app/dashboard/page.tsx | User dashboard |
| /dashboard-user | app/dashboard-user/page.tsx | User dashboard alt |
| /admin | app/admin/page.tsx | Admin dashboard |
| /admin/executive | app/admin/executive/page.tsx | Executive KPIs |
| /modules/inventory | app/modules/inventory/page.tsx | Inventory module |
| /report-center | app/report-center/page.tsx | Report Center Dashboard |
| /report-center/[module] | app/report-center/[module]/page.tsx | Dynamic module |
| /report-center/inventory | app/report-center/inventory/page.tsx | Inventory reports |
| /report-center/inventory/[report] | app/report-center/inventory/[report]/page.tsx | Report viewer |

---

## 3. API ENDPOINTS

### Auth API
| Endpoint | Method | Handler |
|----------|--------|---------|
| /api/auth/login | POST | Login handler |
| /api/auth/logout | POST | Logout handler |
| /api/auth/verify | GET | Verify JWT |
| /api/auth/public-key | GET | RSA public key |
| /api/auth/[...nextauth] | * | NextAuth.js |

### Reports API
| Endpoint | Method | Handler |
|----------|--------|---------|
| /api/reports/inventory | GET | 17 report types |
| /api/reports/system-status | GET | DB + integration status |
| /api/reports/ai-insight | GET | AI recommendations |
| /api/reports/natural-filter | GET | Parse natural query |

---

## 4. COMPONENTS

### Layout Components (2)
| Component | File | Purpose |
|-----------|------|---------|
| Sidebar | components/layout/Sidebar.tsx | Navigation |
| Topbar | components/layout/Topbar.tsx | Top bar |

### Dashboard Components (8)
| Component | File | Purpose |
|-----------|------|---------|
| HeroBanner | components/dashboard/HeroBanner.tsx | Hero section |
| GlobalSearch | components/dashboard/GlobalSearch.tsx | Search |
| ModuleCard | components/dashboard/ModuleCard.tsx | Module tiles |
| AIInsightCard | components/dashboard/AIInsightCard.tsx | AI panel |
| SystemInfoPanel | components/dashboard/SystemInfoPanel.tsx | System status |
| MonitoringVisualSection | components/dashboard/MonitoringVisualSection.tsx | Charts |
| RecentPanel | components/dashboard/RecentPanel.tsx | Recent reports |
| FavoritesPanel | components/dashboard/FavoritesPanel.tsx | Favorites |

### Shared/UI Components (9)
| Component | File | Purpose |
|-----------|------|---------|
| SummaryCard | components/shared/SummaryCard.tsx | KPI cards |
| FavoriteButton | components/shared/FavoriteButton.tsx | Star toggle |
| EmptyState | components/shared/EmptyState.tsx | Empty message |
| ExportButtonGroup | components/shared/ExportButtonGroup.tsx | Export buttons |
| ExportQueuePanel | components/shared/ExportQueuePanel.tsx | Export queue |
| FilterChips | components/shared/FilterChips.tsx | Quick filters |
| GlobalSearch | components/shared/GlobalSearch.tsx | Search input |
| LoadingSkeleton | components/shared/LoadingSkeleton.tsx | Loading state |
| NotificationDropdown | components/shared/NotificationDropdown.tsx | Notifications |

---

## 5. STATE MANAGEMENT

### Zustand Store (store/reportStore.ts)
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
  setActiveModule: (moduleId: string) => void;
  setSelectedReport: (reportId: string) => void;
  toggleFavorite: (reportId: string) => void;
  addRecent: (reportId: string) => void;
}
```

### React Query (via app/providers.tsx)
```typescript
// Default options
{
  staleTime: 5 * 60 * 1000,    // 5 min
  cacheTime: 30 * 60 * 1000,   // 30 min
  refetchOnWindowFocus: false,
}
```

---

## 6. LIB UTILS

### lib/api/ (4 files)
| File | Exports | Purpose |
|------|---------|---------|
| queries.ts | createQueryHelpers | SQL query helpers |
| reports.ts | createReportHelpers | Report formatting |
| sql-gateway.ts | SqlGateway | HTTP client |
| types.ts | QueryResponse, QueryOptions | Type definitions |

### lib/hooks/ (3 files)
| File | Exports | Purpose |
|------|---------|---------|
| useExport.ts | useExport | Export hook |
| useReports.ts | useReports | Reports hook |
| useSearch.ts | useSearch, useDebounce | Search hook |

### lib/rbac/ (4 files)
| File | Exports | Purpose |
|------|---------|---------|
| index.ts | canAccessModule | Permission check |
| permissions.ts | getAccessibleModules | Module access |
| types.ts | Role, UserSession | RBAC types |
| usePermission.ts | usePermission | Permission hook |

### lib/reports/ (5 files)
| File | Exports | Purpose |
|------|---------|---------|
| config.ts | MODULE_CONFIGS | Module registry |
| intelligence.ts | InsightContent | AI insights |
| monitoring.ts | MonitoringVisualData | Charts data |
| report-filtering.ts | ReportColumnFilter | Filtering |
| inventory/config.ts | InventoryReport | Inventory config |

---

## 7. CONFIG FILES

| File | Purpose |
|------|---------|
| package.json | Dependencies |
| next.config.js | Next.js config |
| tsconfig.json | TypeScript config |
| postcss.config.mjs | PostCSS (Tailwind v4) |
| tailwind.config.ts | Tailwind config |

---

## 8. SERVER ACTIONS

| File | Exports | Purpose |
|------|---------|---------|
| actions.ts | authenticate | Login action |
| admin-permissions.ts | updatePermissions | RBAC |
| gang-actions.ts | gangOperations | Gang management |
| user-actions.ts | userOperations | User management |

---

## FILE COUNTS SUMMARY

| Category | Files |
|----------|--------|
| app/ (.tsx) | 20 |
| app/ (.ts) | 15 |
| components/ (.tsx) | 19 |
| lib/ (.ts) | 22 |
| store/ | 1 |
| **Total** | **77 files** |

---

## KEY DEPENDENCIES

```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.0.0",
  "framer-motion": "^12.0.0",
  "lucide-react": "latest",
  "next-auth": "^4.0.0",
  "jspdf": "latest"
}
```

---

## RELATED DOCUMENTATION

| File | Description |
|------|-------------|
| [logic-flows/](./logic-flows/00-INDEX.md) | Logic & flows docs |
| [PROJECT-DOCUMENTATION.md](./PROJECT-DOCUMENTATION.md) | Complete project |
| [ARCHITECTURE-DOCUMENTATION.md](./ARCHITECTURE-DOCUMENTATION.md) | Architecture |

---

**END OF CODEBASE OUTLINE**
