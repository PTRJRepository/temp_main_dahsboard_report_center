# STATE MANAGEMENT

This document describes the state management architecture in the Dashboard application, covering Zustand stores, React Query configuration, local component state, URL parameters, and localStorage persistence.

---

## Table of Contents

1. [State Management Strategies](#1-state-management-strategies)
2. [React Context (AppState)](#2-react-context-appstate)
3. [React Query Configuration](#3-react-query-configuration)
4. [Zustand Stores](#4-zustand-stores)
5. [Local useState in Pages](#5-local-usestate-in-pages)
6. [URL Parameters](#6-url-parameters)
7. [localStorage Persistence](#7-localstorage-persistence)

---

## 1. State Management Strategies

The Dashboard uses a layered approach to state management based on scope and persistence needs:

| Strategy | Use Case | Scope | Persistence |
|----------|---------|-------|--------------|
| React Context | App-wide UI state (sidebar, period, division, user) | Global | None (in-memory) |
| React Query (`useQuery`) | Server data (reports, inventory, monitoring) | Query-specific | Cache (memory) |
| Zustand + persist | Favorites, recent searches, filter state | Module-level | localStorage |
| Local useState | UI interactions, form inputs, modals | Component | None |
| URL params | Navigation state, deep linking | Page | URL |
| Direct localStorage | Auth tokens, user preferences | Session | localStorage |

---

## 2. React Context (AppState)

**Location:** `app/providers.tsx`

The `AppContext` provides global UI state using React's built-inContext API. This is the primary mechanism for sharing state across the entire application without external dependencies.

### State Shape

```typescript
interface AppState {
  sidebarCollapsed: boolean;
  activePeriod: string;
  activeDivision: string;
  user: User | null;
}
```

### Implementation

```typescript
// app/providers.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, createContext, useContext, ReactNode } from 'react';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  division?: string;
  gang?: string;
  avatar?: string;
}

export interface AppContextValue {
  sidebarCollapsed: boolean;
  activePeriod: string;
  activeDivision: string;
  user: User | null;
  setSidebarCollapsed: (v: boolean) => void;
  setActivePeriod: (v: string) => void;
  setActiveDivision: (v: string) => void;
  setUser: (u: User | null) => void;
}

export const AppContext = createContext<AppContextValue>({
  sidebarCollapsed: false,
  activePeriod: 'Mei 2026',
  activeDivision: 'DME - Divisi Kebun',
  user: null,
  setSidebarCollapsed: () => {},
  setActivePeriod: () => {},
  setActiveDivision: () => {},
  setUser: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activePeriod, setActivePeriod] = useState('Mei 2026');
  const [activeDivision, setActiveDivision] = useState('DME - Divisi Kebun');
  const [user, setUser] = useState<User | null>({
    id: 'u1',
    name: 'Admin User',
    email: 'admin@rebinmas.com',
    role: 'admin',
    division: 'DME',
  });

  return (
    <AppContext.Provider value={{
      sidebarCollapsed,
      activePeriod,
      activeDivision,
      user,
      setSidebarCollapsed,
      setActivePeriod,
      setActiveDivision,
      setUser,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
```

### Usage in Components

```typescript
import { useAppContext } from '@/app/providers';

function MyComponent() {
  const { sidebarCollapsed, setSidebarCollapsed, activePeriod } = useAppContext();
  
  return (
    <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
      Toggle Sidebar (Periode: {activePeriod})
    </button>
  );
}
```

---

## 3. React Query Configuration

**Location:** `app/providers.tsx`

React Query (`@tanstack/react-query` v5) handles all server-state management including caching, background refetching, and error handling. The query client is configured in the `Providers` component and shared via the `QueryClientProvider`.

### Query Client Setup

```typescript
// app/providers.tsx
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,          // 30 seconds
        gcTime: 5 * 60 * 1000,           // 5 minutes (formerly cacheTime)
        retry: 3,
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: reuse singleton client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
      </AppProvider>
    </QueryClientProvider>
  );
}
```

### Custom Hook: useReports

**Location:** `lib/hooks/useReports.ts`

The `useReports` hook provides a thin, focused interface for fetching reports from the SQL Gateway API with automatic fallback to mock data when the backend is unavailable.

```typescript
// lib/hooks/useReports.ts
'use client';

import { useQuery } from '@tanstack/react-query';
import { getMockReportsByModule, type Report } from '@/lib/mock-data';

export interface UseReportsOptions {
  /** Filter by module slug (e.g. 'inventory', 'payroll'). Omit for all modules. */
  moduleId?: string;
  /** Override the staleTime (default: 5 min) */
  staleTime?: number;
  /** Disable the query (default: true) */
  enabled?: boolean;
}

async function fetchReportsFromApi(moduleId?: string): Promise<Report[]> {
  const body = moduleId
    ? { query: 'SELECT TOP 50 * FROM reports WHERE module_id = @moduleId ORDER BY last_run DESC', params: [{ name: 'moduleId', value: moduleId }] }
    : { query: 'SELECT TOP 50 * FROM reports ORDER BY last_run DESC', params: [] };

  const res = await fetch('http://localhost:8001/v1/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '[REDACTED]',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) throw new Error(`SQL Gateway error: ${res.status}`);

  const rows: Record<string, unknown>[] = await res.json();
  return rows.map((r) => ({
    id:        String(r.id ?? ''),
    moduleId:  String(r.module_id ?? ''),
    name:      String(r.name ?? ''),
    category:  String(r.category ?? ''),
    description: String(r.description ?? ''),
    lastRun:   String(r.last_run ?? ''),
    status:   (r.status as Report['status']) ?? 'completed',
    rowCount: Number(r.row_count ?? 0),
  }));
}

export function useReports({ moduleId, staleTime = 5 * 60 * 1000, enabled = true }: UseReportsOptions = {}) {
  return useQuery<Report[]>({
    queryKey: ['reports', moduleId],
    enabled,
    queryFn: async () => {
      try {
        return await fetchReportsFromApi(moduleId);
      } catch {
        // API unavailable — serve mock data instead
        return getMockReportsByModule(moduleId);
      }
    },
    staleTime,
  });
}

// Query key factory for consistent cache management
export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (moduleId?: string) => [...reportKeys.lists(), moduleId] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportKeys.details(), id] as const,
} as const;
```

### Usage Example

```typescript
import { useReports } from '@/lib/hooks/useReports';

function ReportList({ moduleId }: { moduleId: string }) {
  const { data: reports, isLoading, error } = useReports({ moduleId });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading reports</div>;

  return (
    <ul>
      {reports?.map((report) => (
        <li key={report.id}>{report.name}</li>
      ))}
    </ul>
  );
}
```

---

## 4. Zustand Stores

**Note:** Zustand (`zustand` v5) is installed in `package.json` and available for use. The persist middleware enables localStorage persistence.

Although no dedicated Zustand store file (`reportStore.ts`) exists in the current codebase, Zustand is available for application-level state that requires persistence. The architecture supports adding stores like:

### Example: Future reportStore.ts Structure

```typescript
// lib/store/reportStore.ts (template for future use)
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface ReportFilterState {
  selectedModule: string | null;
  dateRange: { from: string; to: string };
  status: string[];
  searchQuery: string;
}

interface ReportStore {
  filters: ReportFilterState;
  favorites: string[];
  recentReports: string[];
  
  setFilters: (filters: Partial<ReportFilterState>) => void;
  addFavorite: (reportId: string) => void;
  removeFavorite: (reportId: string) => void;
  addRecentReport: (reportId: string) => void;
  clearFilters: () => void;
}

export const useReportStore = create<ReportStore>()(
  persist(
    (set) => ({
      filters: {
        selectedModule: null,
        dateRange: { from: '', to: '' },
        status: [],
        searchQuery: '',
      },
      favorites: [],
      recentReports: [],

      setFilters: (newFilters) =>
        set((state) => ({
          filters: { ...state.filters, ...newFilters },
        })),

      addFavorite: (reportId) =>
        set((state) => ({
          favorites: state.favorites.includes(reportId)
            ? state.favorites
            : [...state.favorites, reportId],
        })),

      removeFavorite: (reportId) =>
        set((state) => ({
          favorites: state.favorites.filter((id) => id !== reportId),
        })),

      addRecentReport: (reportId) =>
        set((state) => ({
          recentReports: [
            reportId,
            ...state.recentReports.filter((id) => id !== reportId),
          ].slice(0, 10),
        })),

      clearFilters: () =>
        set({
          filters: {
            selectedModule: null,
            dateRange: { from: '', to: '' },
            status: [],
            searchQuery: '',
          },
        }),
    }),
    {
      name: 'report-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

---

## 5. Local useState in Pages

Local React `useState` is used for component-level UI state that does not need to persist beyond the component lifecycle. This is the most common state management pattern in the codebase.

### Example: Report Center Page

**Location:** `app/report-center/page.tsx`

```typescript
// app/report-center/page.tsx
'use client';

import { useState } from 'react';

type ModuleId = 'inventory' | 'payroll' | 'hr' | 'production';
type ReportSource = 'estate' | 'kebun' | 'mill';

export default function ReportCenterPage() {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Bulan Ini');
  const [activeModuleId, setActiveModuleId] = useState<ModuleId>('inventory');
  const [selectedSource, setSelectedSource] = useState<ReportSource>('estate');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [inventoryPayload, setInventoryPayload] = useState<InventoryQueryPayload | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // ... component logic
}
```

### Example: Inventory Module Page

**Location:** `app/modules/inventory/page.tsx`

```typescript
// app/modules/inventory/page.tsx
import React, { useState, useCallback, useMemo } from 'react';

interface FilterState {
  status: string;
  category: string;
  dateFrom: string;
  dateTo: string;
}

const DEFAULT_FILTERS: FilterState = {
  status: 'all',
  category: 'all',
  dateFrom: '',
  dateTo: '',
};

export default function InventoryPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [runningIds, setRunningIds]       = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds]      = useState<Set<string>>(new Set());

  // Filter state reset
  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (filters.status !== 'all' && report.status !== filters.status) return false;
      if (filters.category !== 'all' && report.category !== filters.category) return false;
      // ... more filtering logic
      return true;
    });
  }, [reports, filters]);

  // ... remaining component logic
}
```

---

## 6. URL Parameters

The Dashboard uses Next.js URL parameters (`useSearchParams`) for navigation state that should be shareable via deep links.

### Reading URL Parameters

**Location:** `app/report-center/inventory/[report]/ReportViewerClient.tsx`

```typescript
// app/report-center/inventory/[report]/ReportViewerClient.tsx
'use client';

import { useSearchParams } from 'next/navigation';

export default function ReportViewerClient() {
  const searchParams = useSearchParams();

  // Example: Read query parameters
  const filter = searchParams.get('filter');
  const page = searchParams.get('page') ?? '1';
  const sort = searchParams.get('sort') ?? 'date-desc';

  // Use the parameters
  // ... component logic
}
```

### Building URLs with Parameters

```typescript
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

function FilterControls() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <button onClick={() => updateFilter('filter', 'month')}>
      Filter by Month
    </button>
  );
}
```

---

## 7. localStorage Persistence

The application uses localStorage directly for session persistence and UI preferences. This approach bypasses the React Context lifecycle, making it suitable for data that must survive page reloads.

### Storage Keys and Usage

| Key | Purpose | Data Shape |
|-----|---------|------------|
| `auth-token` | JWT authentication token | `string` |
| `user` | Current user profile | `{ id: string; name: string; ... }` |
| `language` | Selected UI language | `'en' \| 'id'` |
| `dbq_session` | RBAC session data | `{ user: User; expiry: number }` |
| `recent-searches` | Recent search terms | `string[]` |

### Auth Token Storage

**Location:** `components/LoginForm.tsx`

```typescript
// components/LoginForm.tsx
async function handleLogin(values: LoginFormValues) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(values),
  });

  if (!res.ok) {
    // Handle error
    return;
  }

  const data = await res.json();

  // Store token in localStorage for API usage
  localStorage.setItem('auth-token', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));

  router.push('/dashboard');
}
```

### Language Persistence

**Location:** `context/LanguageContext.tsx`

```typescript
// context/LanguageContext.tsx
import { useState, useEffect, createContext, useContext, ReactNode } from 'react';

type Language = 'en' | 'id';

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
}

export const LanguageContext = createContext<LanguageContextValue>({
  language: 'id',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('id');

  useEffect(() => {
    const savedLang = localStorage.getItem('language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'id')) {
      setLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}
```

### Recent Searches Persistence

**Location:** `lib/hooks/useSearch.ts`

```typescript
// lib/hooks/useSearch.ts
const RECENT_KEY = 'recent-searches';
const MAX_RECENT = 5;

interface UseSearchReturn {
  recentSearches: string[];
  addSearch: (term: string) => void;
  clearSearches: () => void;
}

export function useSearch(): UseSearchReturn {
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        setRecentSearches(JSON.parse(raw));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const addSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;

    const updated = [
      trimmed,
      ...recentSearches.filter((t) => t !== trimmed),
    ].slice(0, MAX_RECENT);

    setRecentSearches(updated);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  };

  const clearSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_KEY);
  };

  return { recentSearches, addSearch, clearSearches };
}
```

### Sidebar State Persistence

The sidebar collapsed state is stored in localStorage for persistence across sessions. Components read the initial state from localStorage on mount and persist changes on toggle.

```typescript
// In a sidebar component:
// 1. On mount: load from localStorage or default to expanded
// 2. On toggle: save to localStorage
```

---

## Summary

| Strategy | File(s) | Persistence | Use Case |
|---------|---------|------------|----------|
| React Context | `app/providers.tsx` | None | Global UI state (sidebar, period, division, user) |
| React Query | `app/providers.tsx`, `lib/hooks/useReports.ts` | In-memory cache | Server data fetching with caching |
| Zustand | (available for future stores) | localStorage (via persist middleware) | Module-level state with persistence |
| useState | Various pages | None | Component-level | UI interactions, form inputs |
| URL params | `app/report-center/.../*` | URL | Shareable navigation state |
| localStorage | Direct API calls | Browser localStorage | Auth tokens, user preferences, recent searches |

The architecture provides multiple state management options, allowing developers to choose the appropriate strategy based on scope, persistence requirements, and data complexity.