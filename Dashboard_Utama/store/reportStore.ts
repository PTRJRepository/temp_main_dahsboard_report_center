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
