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
