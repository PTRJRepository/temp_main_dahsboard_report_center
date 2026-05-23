# Design Document — PT Rebinmas Jaya Report Center
**Version:** 1.0 | **Date:** 2026-05-17

---

## 1. System Architecture

```
BROWSER (React Client)
├── Sidebar (260px, collapsible to 64px)
├── Topbar (64px)
├── Content Area (flex-1)
└── Preview Panel (400px, sticky right)

HTTPS REST API
↓

NEXT.JS 14 APP ROUTER (API Routes)
├── /api/reports/inventory → 27 report queries
├── /api/reports/search → semantic search
├── /api/modules → module list
├── /api/favorites → user favorites
└── /api/recent → recent reports

HTTP POST via x-api-key header
↓

SQL GATEWAY (Read-Only)
Server: SERVER_PROFILE_1 (10.0.0.110)
Database: db_ptrj_mill
```

---

## 2. Component Hierarchy

```
AppShell
├── Sidebar
│   ├── Logo + Brand
│   ├── NavGroup × N (UTAMA, LAPORAN, MODUL, ADMINISTRASI)
│   │   └── NavItem
│   ├── Divider
│   └── UserSection
├── Topbar
│   ├── Breadcrumb
│   ├── SearchBar (Ctrl+K)
│   ├── StatusBadges
│   └── UserAvatar
└── ContentArea
    ├── DashboardPage
    │   ├── HeroBanner
    │   ├── GlobalSearch
    │   ├── FilterChips
    │   ├── ModuleGrid (ModuleCard × 9)
    │   └── LowerPanels (Favorites, Recent, SystemInfo)
    ├── ModulePage
    │   ├── ModuleHeader
    │   ├── StatusBanner
    │   ├── SummaryCards
    │   ├── ModuleFilters
    │   ├── ReportList (ReportListItem × 27)
    │   └── PreviewPanel (sticky right)
    └── ReportViewerPage
        ├── ReportHeader
        ├── ReportFilters
        ├── SummaryCards
        └── DataTable + ExportBar
```

---

## 3. TypeScript Interfaces

```typescript
// types/report.ts
export type ReportPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ReportStatus = 'LIVE' | 'UPDATE' | 'DEPRECATED';
export type UserRole = 'kerani' | 'hr' | 'admin' | 'manager';

export interface ReportConfig {
  id: string;
  title: string;
  titleEn: string;
  description: string;
  group: string;
  module: string;
  priority: ReportPriority;
  status: ReportStatus;
  tags: string[];
  sqlSource: string;
  filters: FilterConfig[];
  columns: ColumnConfig[];
  defaultSort?: SortConfig;
  permissions: UserRole[];
  mockData?: Record<string, unknown>[];
}

export interface FilterConfig {
  name: string;
  type: 'select' | 'date' | 'date-range' | 'text' | 'number' | 'chips';
  label: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  defaultValue?: FilterValue;
  required?: boolean;
}

export interface ColumnConfig {
  key: string;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
  format?: 'currency' | 'date' | 'percent' | 'number';
  width?: string;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export interface ModuleConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  reportCount: number;
  description: string;
  lastUpdate: string;
}

export interface ReportDataResponse {
  rows: Record<string, unknown>[];
  pagination: { page: number; pageSize: number; totalRows: number; totalPages: number };
  summary?: Record<string, unknown>;
  meta: {
    queryTime: number;
    generatedAt: string;
    period?: string;
    isFuturePeriod?: boolean;
  };
}
```

---

## 4. Zustand Store

```typescript
// store/reportStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ReportState {
  selectedReportId: string | null;
  filters: Record<string, FilterValue>;
  pagination: { page: number; pageSize: number };
  sort: SortConfig;
  favorites: string[];
  recent: string[];
  sidebarCollapsed: boolean;
  searchQuery: string;
  activeModule: string | null;
  
  toggleFavorite: (id: string) => void;
  addRecent: (id: string) => void;
  toggleSidebar: () => void;
  setSearchQuery: (q: string) => void;
  setActiveModule: (m: string | null) => void;
}

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      selectedReportId: null,
      filters: {},
      pagination: { page: 1, pageSize: 20 },
      sort: { column: 'ItemCode', direction: 'asc' },
      favorites: [],
      recent: [],
      sidebarCollapsed: false,
      searchQuery: '',
      activeModule: null,
      
      toggleFavorite: (id) => set((s) => ({
        favorites: s.favorites.includes(id) ? s.favorites.filter(f => f !== id) : [...s.favorites, id]
      })),
      addRecent: (id) => set((s) => ({
        recent: [id, ...s.recent.filter(r => r !== id)].slice(0, 10)
      })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setActiveModule: (m) => set({ activeModule: m }),
    }),
    { name: 'report-center-storage' }
  )
);
```

---

## 5. TanStack Query Hooks

```typescript
// hooks/useReports.ts
import { useQuery, useMutation } from '@tanstack/react-query';

export function useReports(moduleId?: string) {
  return useQuery({
    queryKey: ['reports', moduleId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${moduleId || 'inventory'}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useReportData(reportId: string, filters: Record<string, FilterValue>) {
  return useQuery({
    queryKey: ['report-data', reportId, filters],
    queryFn: async () => {
      const res = await fetch(`/api/reports/inventory/${reportId}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters }),
      });
      return res.json();
    },
    enabled: !!reportId,
  });
}

export function useReportSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const res = await fetch('/api/reports/search', { method: 'POST', body: JSON.stringify({ query }) });
      return res.json();
    },
    enabled: query.length >= 2,
  });
}
```

---

## 6. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/inventory` | List 27 inventory reports metadata |
| POST | `/api/reports/inventory/[id]/data` | Execute report with filters |
| GET | `/api/reports/inventory/[id]/preview` | Top 5 rows preview |
| POST | `/api/reports/search` | Semantic search |
| GET | `/api/modules` | All 9 modules |
| GET | `/api/favorites` | User favorites |
| POST | `/api/favorites` | Toggle favorite |
| GET | `/api/recent` | Recent reports |