# STATE-LOGIC-DEEP-DIVE.md

Complete Zustand store and React Query hook analysis for the Report Dashboard application.

---

## Table of Contents

1. [reportStore.ts - Zustand State Management](#1-reportstorets---zustand-state-management)
2. [useReports.ts - Report Data Fetching](#2-usereportsts---report-data-fetching)
3. [useSearch.ts - Search Functionality](#3-usesearchts---search-functionality)

---

## 1. reportStore.ts - Zustand State Management

**Path:** `store/reportStore.ts`

### Overview

This is the central Zustand store for the Report Dashboard, managing UI state, filtering, pagination, sorting, and user preferences with automatic persistence to localStorage.

### Complete Code

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FilterValue = string | number | boolean | null

export interface ReportState {
  sidebarCollapsed: boolean
  activeModule: string | null
  selectedReportId: string | null
  filters: Record<string, FilterValue>
  pagination: { page: number; pageSize: number }
  sort: { column: string; direction: 'asc' | 'desc' }
  favorites: string[]
  recent: { id: string; viewedAt: string }[]
  searchQuery: string

  toggleSidebar: () => void
  setActiveModule: (module: string | null) => void
  setSelectedReport: (id: string | null) => void
  setFilter: (key: string, value: FilterValue) => void
  clearFilters: () => void
  setPage: (page: number) => void
  setPageSize: (size: number) => void
  setSort: (column: string, direction: 'asc' | 'desc') => void
  toggleFavorite: (id: string) => void
  addRecent: (id: string) => void
  setSearchQuery: (q: string) => void
}

export const useReportStore = create<ReportState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      activeModule: null,
      selectedReportId: null,
      filters: {},
      pagination: { page: 1, pageSize: 20 },
      sort: { column: 'ItemCode', direction: 'asc' },
      favorites: [],
      recent: [],
      searchQuery: '',

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveModule: (module) => set({ activeModule: module }),
      setSelectedReport: (id) => set({ selectedReportId: id }),
      setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
      clearFilters: () => set({ filters: {} }),
      setPage: (page) => set((s) => ({ pagination: { ...s.pagination, page } })),
      setPageSize: (pageSize) => set({ pagination: { page: 1, pageSize } }),
      setSort: (column, direction) => set({ sort: { column, direction } }),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
      addRecent: (id) =>
        set((s) => {
          const entry = { id, viewedAt: new Date().toISOString() }
          const filtered = s.recent.filter((r) => r.id !== id)
          return { recent: [entry, ...filtered].slice(0, 10) }
        }),
      setSearchQuery: (q) => set({ searchQuery: q }),
    }),
    { name: 'report-center-storage' }
  )
)
```

### State Structure

| State Property | Type | Default | Description |
|----------------|------|---------|-------------|
| `sidebarCollapsed` | boolean | `false` | Sidebar collapsed state |
| `activeModule` | string \| null | `null` | Currently active module |
| `selectedReportId` | string \| null | `null` | Currently selected report |
| `filters` | Record<string, FilterValue> | `{}` | Active filters |
| `pagination.page` | number | `1` | Current page |
| `pagination.pageSize` | number | `20` | Rows per page |
| `sort.column` | string | `'ItemCode'` | Sort column |
| `sort.direction` | 'asc' \| 'desc' | `'asc'` | Sort direction |
| `favorites` | string[] | `[]` | Favorited report IDs |
| `recent` | { id, viewedAt }[] | `[]` | Recently viewed (max 10) |
| `searchQuery` | string | `''` | Global search query |

### Actions Detail

#### toggleSidebar()
```typescript
toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }))
```
**Behavior:** Toggles sidebar between expanded/collapsed. No parameters.

#### setActiveModule(module: string | null)
```typescript
setActiveModule: (module) => set({ activeModule: module })
```
**Behavior:** Sets the active module filter. Resets to `null` to show all modules.

#### setSelectedReport(id: string | null)
```typescript
setSelectedReport: (id) => set({ selectedReportId: id })
```
**Behavior:** Sets the currently selected report for detail view.

#### setFilter(key: string, value: FilterValue)
```typescript
setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } }))
```
**Behavior:** Adds or updates a filter. Merges with existing filters.

#### clearFilters()
```typescript
clearFilters: () => set({ filters: {} })
```
**Behavior:** Removes all active filters.

#### setPage(page: number)
```typescript
setPage: (page) => set((s) => ({ pagination: { ...s.pagination, page } }))
```
**Behavior:** Updates current page number while preserving pageSize.

#### setPageSize(size: number)
```typescript
setPageSize: (pageSize) => set({ pagination: { page: 1, pageSize } })
```
**Behavior:** Updates page size and resets to page 1.

#### setSort(column: string, direction: 'asc' | 'desc')
```typescript
setSort: (column, direction) => set({ sort: { column, direction } })
```
**Behavior:** Updates sort column and direction.

#### toggleFavorite(id: string)
```typescript
toggleFavorite: (id) =>
  set((s) => ({
    favorites: s.favorites.includes(id)
      ? s.favorites.filter((f) => f !== id)
      : [...s.favorites, id],
  }))
```
**Behavior:** Adds to favorites if not present, removes if present.

#### addRecent(id: string)
```typescript
addRecent: (id) =>
  set((s) => {
    const entry = { id, viewedAt: new Date().toISOString() }
    const filtered = s.recent.filter((r) => r.id !== id)
    return { recent: [entry, ...filtered].slice(0, 10) }
  })
```
**Behavior:** Adds report to recent list (max 10). Moves to top if already exists.

#### setSearchQuery(q: string)
```typescript
setSearchQuery: (q) => set({ searchQuery: q })
```
**Behavior:** Sets global search query string.

### Persistence

```typescript
{ name: 'report-center-storage' }
```
**Storage Key:** `report-center-storage` in localStorage

---

## 2. useReports.ts - Report Data Fetching

**Path:** `lib/hooks/useReports.ts`

### Overview

React Query hook for fetching reports from the SQL Gateway API with automatic fallback to mock data. Uses `@tanstack/react-query` for caching and state management.

### Complete Code

```typescript
/**
 * lib/hooks/useReports.ts
 * Thin, focused hook for fetching Report[] from the SQL Gateway API.
 * Falls back to mock data when the backend is unavailable.
 *
 * SQL Gateway: POST http://localhost:8001/v1/query
 * Headers  : x-api-key: [REDACTED], Content-Type: application/json
 * DB       : db_ptrj_mill (READ-ONLY)
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { getMockReportsByModule, type Report } from '@/lib/mock-data'

// ─── Exported types ────────────────────────────────────────────────────────────

export type { Report }

export interface UseReportsOptions {
  /** Filter by module slug (e.g. 'inventory', 'payroll'). Omit for all modules. */
  moduleId?: string
  /** Override the staleTime (default: 5 min) */
  staleTime?: number
  /** Disable the query (default: true) */
  enabled?: boolean
}

// ─── SQL Gateway fetch ─────────────────────────────────────────────────────────

async function fetchReportsFromApi(moduleId?: string): Promise<Report[]> {
  const body = moduleId
    ? { query: 'SELECT TOP 50 * FROM reports WHERE module_id = @moduleId ORDER BY last_run DESC', params: [{ name: 'moduleId', value: moduleId }] }
    : { query: 'SELECT TOP 50 * FROM reports ORDER BY last_run DESC', params: [] }

  const res = await fetch('http://localhost:8001/v1/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': '[REDACTED]',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  })

  if (!res.ok) throw new Error(`SQL Gateway error: ${res.status}`)

  // Normalise snake_case API response → camelCase Report fields
  const rows: Record<string, unknown>[] = await res.json()
  return rows.map((r) => ({
    id:        String(r.id ?? ''),
    moduleId:  String(r.module_id ?? ''),
    name:      String(r.name ?? ''),
    category:  String(r.category ?? ''),
    description: String(r.description ?? ''),
    lastRun:   String(r.last_run ?? ''),
    status:   (r.status as Report['status']) ?? 'completed',
    rowCount: Number(r.row_count ?? 0),
  }))
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useReports({ moduleId, staleTime = 5 * 60 * 1000, enabled = true }: UseReportsOptions = {}) {
  return useQuery<Report[]>({
    queryKey: ['reports', moduleId],
    enabled,

    queryFn: async () => {
      try {
        return await fetchReportsFromApi(moduleId)
      } catch {
        // API unavailable or timed out — serve mock data instead
        return getMockReportsByModule(moduleId)
      }
    },

    staleTime,
  })
}

// ─── Backward-compatible query key factory (used by useExport.ts) ─────────────

export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (moduleId?: string) => [...reportKeys.lists(), moduleId] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportKeys.details(), id] as const,
} as const

// ─── Convenience exports ───────────────────────────────────────────────────────

/** Returns a single report by id. */
export function useReport(id: string) {
  return useQuery<Report | undefined>({
    queryKey: ['report', id],
    queryFn: async () => {
      try {
        const res = await fetch(`http://localhost:8001/v1/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': '[REDACTED]' },
          body: JSON.stringify({
            query: 'SELECT * FROM reports WHERE id = @id',
            params: [{ name: 'id', value: id }],
          }),
          signal: AbortSignal.timeout(5000),
        })
        if (!res.ok) throw new Error('not found')
        const rows: Record<string, unknown>[] = await res.json()
        if (!rows.length) return undefined
        const r = rows[0]
        return {
          id:        String(r.id ?? ''),
          moduleId:  String(r.module_id ?? ''),
          name:      String(r.name ?? ''),
          category:  String(r.category ?? ''),
          description: String(r.description ?? ''),
          lastRun:   String(r.last_run ?? ''),
          status:   (r.status as Report['status']) ?? 'completed',
          rowCount: Number(r.row_count ?? 0),
        }
      } catch {
        return getMockReportsByModule().find((rep) => rep.id === id)
      }
    },
    staleTime: 5 * 60 * 1000,
  })
}
```

### API Configuration

| Property | Value |
|----------|-------|
| Endpoint | `http://localhost:8001/v1/query` |
| Method | `POST` |
| Headers | `Content-Type: application/json`, `x-api-key: [REDACTED]` |
| Database | `db_ptrj_mill` (READ-ONLY) |
| Timeout | 5000ms |

### Types

```typescript
export interface UseReportsOptions {
  moduleId?: string      // Filter by module slug
  staleTime?: number     // Cache duration (default: 5 min)
  enabled?: boolean      // Query enabled (default: true)
}
```

### Query Keys Factory

```typescript
export const reportKeys = {
  all: ['reports'] as const,
  lists: () => [...reportKeys.all, 'list'] as const,
  list: (moduleId?: string) => [...reportKeys.lists(), moduleId] as const,
  details: () => [...reportKeys.all, 'detail'] as const,
  detail: (id: string) => [...reportKeys.details(), id] as const,
} as const
```

### useReports() Flow

```
1. Create query with ['reports', moduleId]
2. Execute fetchReportsFromApi(moduleId)
3. POST to SQL Gateway with SQL query
4. Transform snake_case → camelCase
5. Fallback to getMockReportsByModule() on error
6. Cache result for staleTime (default 5 min)
```

### useReport(id: string) Flow

```
1. Create query with ['report', id]
2. Fetch single report from API
3. Transform response fields
4. Fallback to mock data on error
5. Cache result for 5 min
```

---

## 3. useSearch.ts - Search Functionality

**Path:** `lib/hooks/useSearch.ts`

### Overview

Comprehensive search functionality with debounce, pagination (infinite scroll), autocomplete suggestions, and recent searches persistence. Uses React Query for caching.

### Complete Code

```typescript
/**
 * useSearch.ts
 * React Query hooks for paginated search with debounce support.
 * Designed for the search bar in ModuleFilterRow.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type UseInfiniteQueryOptions,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type { ReportSummary } from '../../components/module/reportTypes';

// ─── Debounce ──────────────────────────────────────────────────────────────────

/**
 * Returns a debounced version of `value` that only updates after `delay` ms
 * of inactivity.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

// ─── API helper ────────────────────────────────────────────────────────────────

const API_BASE = '/api';

async function searchRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    credentials: 'include',
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const searchKeys = {
  all: ['search'] as const,
  results: (q: string, type: string) => [...searchKeys.all, { q, type }] as const,
  suggestions: (q: string) => [...searchKeys.all, 'suggestions', q] as const,
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  items: ReportSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchParams {
  q: string;
  type?: 'reports' | 'queries' | 'all';
  page?: number;
  pageSize?: number;
  filters?: {
    status?: string;
    category?: string;
    serverProfile?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'report' | 'tag' | 'author';
  /** Displayed as a secondary label (e.g. author name) */
  meta?: string;
}

// ─── Hook: useSearch ───────────────────────────────────────────────────────────

export interface UseSearchOptions {
  /** Raw (un-debounced) search query — debounce is applied internally. */
  query: string;
  /**
   * Debounce delay in ms (default 300).
   * Set to 0 to disable debounce (useful when query is already debounced upstream).
   */
  debounceMs?: number;
  type?: SearchParams['type'];
  pageSize?: number;
  enabled?: boolean;
  queryOptions?: UseInfiniteQueryOptions<
    { pages: SearchResult[]; pageParams: number[] },
    Error,
    { pages: SearchResult[]; pageParams: number[] },
    ReturnType<typeof searchKeys.results>
  >;
}

export function useSearch({
  query,
  debounceMs = 300,
  type = 'reports',
  pageSize = 20,
  enabled = true,
  queryOptions,
}: UseSearchOptions) {
  const debouncedQuery = useDebounce(query, debounceMs);

  const isEnabled = Boolean(enabled && debouncedQuery.trim().length > 0);

  const result = useInfiniteQuery({
    queryKey: searchKeys.results(debouncedQuery, type ?? 'reports'),
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({
        q: debouncedQuery,
        type: type ?? 'reports',
        page: String(pageParam),
        pageSize: String(pageSize),
      });

      const result = await searchRequest<SearchResult>(`/search?${params}`);
      return { pages: [result], pageParams: [pageParam] } as { pages: SearchResult[]; pageParams: number[] };
    },
    initialPageParam: 1,
    enabled: isEnabled,
    staleTime: 10_000,
    getNextPageParam: (last) => {
      const lastPage = last.pages[last.pages.length - 1];
      return lastPage?.hasMore ? (lastPage.page + 1) as unknown : undefined;
    },
    ...queryOptions,
  });

  /** Flat list of all items across pages (convenience accessor). */
  const allItems = useMemo(
    () => result.data?.pages.flatMap((p) => p.items) ?? [],
    [result.data]
  );

  return {
    ...result,
    allItems,
    /** True when the current request has a non-empty query but no results. */
    isEmpty: !result.isLoading && !result.isFetchingNextPage && result.data?.pages.every((p) => p.total === 0),
  };
}

// ─── Hook: useSearchSuggestions ────────────────────────────────────────────────

/**
 * Lightweight autocomplete for the search input.
 * Uses a shorter debounce to stay responsive.
 */
export interface UseSearchSuggestionsOptions {
  query: string;
  /** Debounce delay in ms (default 150 — faster for suggestions). */
  debounceMs?: number;
  /** Maximum suggestions to return (default 6). */
  limit?: number;
  enabled?: boolean;
  queryOptions?: UseQueryOptions<SearchSuggestion[], Error>;
}

export function useSearchSuggestions({
  query,
  debounceMs = 150,
  limit = 6,
  enabled = true,
  queryOptions,
}: UseSearchSuggestionsOptions) {
  const debouncedQuery = useDebounce(query, debounceMs);

  const isEnabled = Boolean(
    enabled && debouncedQuery.trim().length >= 2
  );

  return useQuery({
    queryKey: searchKeys.suggestions(debouncedQuery),
    queryFn: async (): Promise<SearchSuggestion[]> => {
      const params = new URLSearchParams({ q: debouncedQuery, limit: String(limit) });
      const data = await searchRequest<SearchSuggestion[]>(`/search/suggestions?${params}`);
      return data;
    },
    enabled: isEnabled,
    staleTime: 5_000, // suggestions are cheap — keep them fresh
    ...queryOptions,
  });
}

// ─── Hook: useRecentSearches ───────────────────────────────────────────────────

/**
 * Persists and manages the user's recent search terms in localStorage.
 * Useful for a "Recent searches" dropdown or clearing history.
 */
const RECENT_KEY = 'dbq_recent_searches';
const MAX_RECENT = 8;

export interface RecentSearch {
  term: string;
  timestamp: number; // Date.now()
  type?: string;
}

export function useRecentSearches() {
  const queryClient = useQueryClient();

  const queryOptions: UseQueryOptions<RecentSearch[], Error> = {
    queryKey: ['search', 'recent'] as const,
    queryFn: (): RecentSearch[] => {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        return raw ? (JSON.parse(raw) as RecentSearch[]) : [];
      } catch {
        return [];
      }
    },
    staleTime: Infinity,
  };

  const { data: recentSearches = [] } = useQuery(queryOptions);

  const addRecent = useCallback(
    (term: string, type?: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;

      const updated: RecentSearch[] = [
        { term: trimmed, timestamp: Date.now(), type },
        ...recentSearches.filter((r) => r.term !== trimmed),
      ].slice(0, MAX_RECENT);

      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      queryClient.setQueryData<RecentSearch[]>(['search', 'recent'], updated);
    },
    [recentSearches, queryClient]
  );

  const removeRecent = useCallback(
    (term: string) => {
      const updated = recentSearches.filter((r) => r.term !== term);
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      queryClient.setQueryData<RecentSearch[]>(['search', 'recent'], updated);
    },
    [recentSearches, queryClient]
  );

  const clearRecent = useCallback(() => {
    localStorage.removeItem(RECENT_KEY);
    queryClient.setQueryData<RecentSearch[]>(['search', 'recent'], []);
  }, [queryClient]);

  return { recentSearches, addRecent, removeRecent, clearRecent };
}

// ─── Hook: useSearchPrefetch ───────────────────────────────────────────────────

/**
 * Imperatively prefetches the next search page.
 * Call this when the user is near the bottom of the results list.
 */
export function useSearchPrefetch(
  searchOptions: Omit<UseSearchOptions, 'queryOptions'>
) {
  const { query, debounceMs = 300, type, pageSize, enabled } = searchOptions;
  const debouncedQuery = useDebounce(query, debounceMs);
  const queryClient = useQueryClient();
  const prefetchedRef = useRef<Set<number>>(new Set());

  const prefetchNextPage = useCallback(() => {
    if (!enabled || !debouncedQuery.trim()) return;

    const currentData = queryClient.getQueryData<{
      pages: SearchResult[];
      pageParams: (number | undefined)[];
    }>(searchKeys.results(debouncedQuery, type ?? 'reports'));

    if (!currentData) {
      // Trigger the initial query so the prefetch below has something to extend
      queryClient.prefetchInfiniteQuery({
        queryKey: searchKeys.results(debouncedQuery, type ?? 'reports'),
        queryFn: async ({ pageParam = 1 }) => {
          const params = new URLSearchParams({
            q: debouncedQuery,
            type: type ?? 'reports',
            page: String(pageParam),
            pageSize: String(pageSize ?? 20),
          });
          return searchRequest<SearchResult>(`/search?${params}`);
        },
        initialPageParam: 1,
        staleTime: 10_000,
      });
      return;
    }

    const lastPage = currentData.pages[currentData.pages.length - 1];
    if (!lastPage?.hasMore || prefetchedRef.current.has(lastPage.page + 1)) return;

    const nextPage = lastPage.page + 1;
    prefetchedRef.current.add(nextPage);

    queryClient.prefetchQuery({
      queryKey: [
        ...searchKeys.results(debouncedQuery, type ?? 'reports'),
        '__page',
        nextPage,
      ] as const,
      queryFn: async () => {
        const params = new URLSearchParams({
          q: debouncedQuery,
          type: type ?? 'reports',
          page: String(nextPage),
          pageSize: String(pageSize ?? 20),
        });
        return searchRequest<SearchResult>(`/search?${params}`);
      },
      staleTime: 10_000,
    });
  }, [debouncedQuery, queryClient, type, pageSize, enabled]);

  return { prefetchNextPage };
}
```

### Types

```typescript
export interface SearchResult {
  items: ReportSummary[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface SearchParams {
  q: string;
  type?: 'reports' | 'queries' | 'all';
  page?: number;
  pageSize?: number;
  filters?: {
    status?: string;
    category?: string;
    serverProfile?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

export interface SearchSuggestion {
  id: string;
  text: string;
  type: 'report' | 'tag' | 'author';
  meta?: string;
}

export interface RecentSearch {
  term: string;
  timestamp: number;
  type?: string;
}
```

### Hooks Overview

| Hook | Purpose | Debounce | API |
|------|---------|----------|-----|
| `useSearch()` | Paginated infinite search | 300ms | `/api/search` |
| `useSearchSuggestions()` | Autocomplete suggestions | 150ms | `/api/search/suggestions` |
| `useRecentSearches()` | Recent searches in localStorage | N/A | N/A |
| `useSearchPrefetch()` | Prefetch next page | N/A | N/A |
| `useDebounce()` | Value debouncer | N/A | N/A |

### useSearch() Options

```typescript
export interface UseSearchOptions {
  query: string;                    // Raw search query
  debounceMs?: number;              // Debounce delay (default 300)
  type?: 'reports' | 'queries' | 'all';
  pageSize?: number;               // Items per page (default 20)
  enabled?: boolean;              // Enable query (default true)
  queryOptions?: UseInfiniteQueryOptions<...>;
}
```

### Return Value (useSearch)

```typescript
{
  ...result,              // React Query infinite query result
  allItems: ReportSummary[],  // Flattened items
  isEmpty: boolean           // True when no results
}
```

### useSearchSuggestions() Options

```typescript
export interface UseSearchSuggestionsOptions {
  query: string;              // Raw query
  debounceMs?: number;        // Debounce delay (default 150)
  limit?: number;             // Max suggestions (default 6)
  enabled?: boolean;
  queryOptions?: UseQueryOptions<SearchSuggestion[], Error>;
}
```

### Recent Searches Storage

| Key | Value |
|-----|-------|
| localStorage key | `dbq_recent_searches` |
| Max entries | 8 |
| Persistence | Infinite staleTime |

### Query Keys Factory

```typescript
export const searchKeys = {
  all: ['search'] as const,
  results: (q: string, type: string) => [...searchKeys.all, { q, type }] as const,
  suggestions: (q: string) => [...searchKeys.all, 'suggestions', q] as const,
} as const;
```

### API Endpoints

| Endpoint | Method | Query Params |
|----------|--------|------------|
| `/api/search` | GET | q, type, page, pageSize |
| `/api/search/suggestions` | GET | q, limit |

---

## State Flow Diagrams

### Report Selection Flow

```
User clicks report
       ↓
setSelectedReport(id)     [reportStore]
       ↓
addRecent(id)              [reportStore]
       ↓
useReport(id) query        [useReports]
       ↓
Display report details
```

### Search Flow

```
User types in search bar
       ↓
useSearch({ query })       [useSearch]
       ↓
useDebounce(300ms)         [delay]
       ↓
useInfiniteQuery          [React Query]
       ↓
GET /api/search?q=...    [API]
       ↓
Return SearchResult      [paginated]
       ↓
Display results
```

### Favorites Flow

```
User clicks favorite button
       ↓
toggleFavorite(id)        [reportStore]
       ↓
Update favorites[]       [localStorage]
       ↓
Re-render UI            [persisted]
```

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | latest | State management |
| `@tanstack/react-query` | latest | Server state management |
| `react` | latest | UI framework |

---

*Document generated: May 2026*