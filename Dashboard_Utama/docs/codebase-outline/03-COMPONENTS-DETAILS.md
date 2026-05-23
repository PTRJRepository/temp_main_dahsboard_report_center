# Components Details

This document provides detailed documentation for all 19 React components in the dashboard application. Components are organized into three categories: layout, dashboard, and shared.

---

## Layout Components (2)

### 1. Sidebar

**File:** `components/layout/Sidebar.tsx`

**Export:** Default export `Sidebar`

**Props Interface:** None (no props accepted)

**State Used:**
- `sidebarCollapsed` — boolean from `useReportStore()` (Zustand store for UI state)
- `mobileOpen` — local state `boolean` (controls mobile sidebar visibility)

**Key Functions:**
- `isActive(href: string)` — checks if a nav item is active based on current pathname
- `toggleSidebar()` — toggles collapsible sidebar state via store
- `logout()` — calls logout from `useAuth()` hook

**Description:** Collapsible navigation sidebar with grouped menu items, mobile responsive with overlay, animated width transitions using Framer Motion.

---

### 2. Topbar

**File:** `components/layout/Topbar.tsx`

**Export:** Default export `Topbar`

**Props Interface:** None

**State Used:**
- `currentUser` — local state `UserProfile | null` (retrieved from localStorage)
- `searchRef` — `useRef<HTMLInputElement>` for search input focus

**Key Functions:**
- `readStoredUser()` — parses user object from `localStorage.getItem('user')`
- `roleLabel(role?)` — normalizes role string to display label
- `displayName(user)` — returns display name from user object
- `initials(value)` — generates two-letter initials
- `pageTitle(pathname)` — derives page title/subtitle from pathname

**Description:** Top navigation bar with page title, global search input (Ctrl+K shortcut), notifications bell, and user profile dropdown. Reads user info from localStorage on mount.

---

## Dashboard Components (8)

### 3. AIInsightCard

**File:** `components/dashboard/AIInsightCard.tsx`

**Export:** Default export `AIInsightCard`

**Props Interface:**
```typescript
type AIInsightCardProps = {
  title?: string
  insight: InsightContent
  compact?: boolean
  className?: string
  requestContext?: AIInsightRequestContext
  variant?: 'dark' | 'light'
}
```

**State Used:**
- `generatedInsight` — local state `InsightContent | null`
- `generating` — local state `boolean`
- `generateError` — local state `string | null`

**Key Functions:**
- `copyInsight()` — copies formatted insight text to clipboard
- `generateInsight()` — calls `/api/reports/ai-insight` POST endpoint to generate AI insight from query context

**Description:** AI-powered insight card that displays summary, trend detection, anomaly detection, and recommendations. Supports both dark and light variants, can generate new insights via local LLM API.

---

### 4. FavoritesPanel

**File:** `components/dashboard/FavoritesPanel.tsx`

**Export:** Default export `FavoritesPanel`

**Props Interface:** None

**State Used:**
- `favorites` — array from `useReportStore()`

**Key Functions:**
- `getReport(id)` — looks up report by ID from `inventoryReports` config
- `openReport(id)` — adds to recent and navigates to report page

**Description:** Displays up to 5 favorited reports as clickable cards with star icons.

---

### 5. GlobalSearch (Dashboard)

**File:** `components/dashboard/GlobalSearch.tsx`

**Export:** Default export `GlobalSearch`

**Props Interface:** None

**State Used:**
- `open` — local state `boolean` (dropdown visibility)
- `query` — local state `string`
- `cursor` — local state `number` (keyboard navigation index)
- `inputRef` — `useRef<HTMLInputElement>`
- `favorites`, `toggleFavorite` — from store

**Key Functions:**
- Filters `inventoryReports` by title/category/keywords matching query
- Keyboard navigation (arrow keys, Enter to select)
- Toggle favorite on star click

**Description:** Full-text search dropdown for reports with keyboard support, shows top 10 results or filtered list.

---

### 6. HeroBanner

**File:** `components/dashboard/HeroBanner.tsx`

**Export:** Default export `HeroBanner`

**Props Interface:** None

**State Used:**
- `status` — local state `SystemStatus | null`

**Key Functions:**
- `formatCheckedAt(value?)` — formats ISO timestamp to localized date/time
- Polls `/api/system/status` endpoint on mount and every 30 seconds

**Description:** Large banner showing system connectivity status (gateway, server, database) with real-time health indicators.

---

### 7. ModuleCard

**File:** `components/dashboard/ModuleCard.tsx`

**Export:** Default export `ModuleCard`, also exports `MODULES` array

**Props Interface:**
```typescript
type ModuleCardProps = {
  module: IntelligenceModule
  active?: boolean
  pinned?: boolean
  onPreview?: (module: IntelligenceModule) => void
  onPin?: (module: IntelligenceModule) => void
  className?: string
}
```

**State Used:** None (stateless)

**Description:** Card component for displaying an intelligence module (category) with icon, description, and pin/unpin functionality.

---

### 8. MonitoringVisualSection

**File:** `components/dashboard/MonitoringVisualSection.tsx`

**Export:** Default export `MonitoringVisualSection`

**Props Interface:**
```typescript
type MonitoringVisualSectionProps = {
  module?: IntelligenceModule | null
  data?: MonitoringVisualData | null
  title?: string
  description?: string
  className?: string
  loading?: boolean
  error?: string | null
}
```

**State Used:** None (receives data via props)

**Key Functions:**
- `toneClass(tone)` — maps tone string ('green', 'blue', 'gold') to Tailwind classes

**Description:** Visual section displaying monitoring charts and metrics for a selected module, supports loading and error states.

---

### 9. RecentPanel

**File:** `components/dashboard/RecentPanel.tsx`

**Export:** Default export `RecentPanel`

**Props Interface:** None

**State Used:**
- `recent` — array from `useReportStore()`

**Key Functions:**
- `formatRelative(isoString)` — converts ISO timestamp to relative time (e.g. "2 jam lalu")
- Navigates to report on click

**Description:** Displays up to 5 recently accessed reports with relative timestamps.

---

### 10. SystemInfoPanel

**File:** `components/dashboard/SystemInfoPanel.tsx`

**Export:** Default export `SystemInfoPanel`

**Props Interface:** None

**State Used:**
- `status` — local state `SystemStatus | null`
- `lastRefresh` — local state for auto-refresh timing

**Key Functions:**
- `formatCheckedAt(value?)` — formats timestamp
- Polls system status endpoint

**Description:** Compact panel showing connectivity status for gateway, server, database; displays green/red indicators and last check time.

---

## Shared Components (9)

### 11. EmptyState

**File:** `components/shared/EmptyState.tsx`

**Export:** Default export `EmptyState`, also exports `EmptyStateProps` interface

**Props Interface:**
```typescript
export interface EmptyStateProps {
  title: string
  description?: string
  illustration?: React.ReactNode
  illustrationSrc?: string
  action?: React.ReactNode
  variant?: 'info' | 'warning' | 'error' | 'search' | 'custom'
  className?: string
  center?: boolean
}
```

**State Used:** None (stateless)

**Description:** Placeholder UI for empty lists, search results, or no-content states. Supports multiple variants with appropriate icons/colors.

---

### 12. ExportButtonGroup

**File:** `components/shared/ExportButtonGroup.tsx`

**Export:** Default export `ExportButtonGroup`, also exports `ExportFormat`, `ExportOption` types

**Props Interface:**
```typescript
export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'sql' | 'tsv'

export interface ExportOption {
  format: ExportFormat
  label: string
  description?: string
  mimeType?: string
  extension?: string
  icon?: React.ReactNode
  disabled?: boolean
  badgeColor?: string
}

export interface ExportButtonGroupProps {
  data: Record<string, unknown>[]
  options?: ExportOption[]
  onExport?: (format: ExportFormat, data: Record<string, unknown>[]) => void
  className?: string
  disabled?: boolean
}
```

**State Used:**
- `open` — local state `boolean` (dropdown)
- `exporting` — local state `boolean`
- `ref` — useRef for click-outside detection

**Key Functions:**
- `handleExport(format)` — converts data to requested format and triggers download

**Description:** Dropdown button for exporting data in multiple formats (CSV, JSON, XLSX, SQL, TSV). Handles format conversion client-side.

---

### 13. ExportQueuePanel

**File:** `components/shared/ExportQueuePanel.tsx`

**Export:** Default export `ExportQueuePanel`, also exports `ExportJobStatus`, `ExportJob` types

**Props Interface:**
```typescript
export type ExportJobStatus = 'pending' | 'exporting' | 'completed' | 'failed' | 'cancelled'

export interface ExportJob {
  id: string
  label: string
  format: ExportFormat
  status: ExportJobStatus
  progress?: number
  size?: string
  error?: string
  createdAt: Date
}
```

**State Used:** None (likely connected to export queue store or context)

**Description:** Slide-in panel showing in-progress and completed export jobs with progress bars, status badges, and retry/cancel actions.

---

### 14. FavoriteButton

**File:** `components/shared/FavoriteButton.tsx`

**Export:** Default export `FavoriteButton`, also exports `FavoriteButtonProps` interface

**Props Interface:**
```typescript
export interface FavoriteButtonProps {
  isFavorite: boolean
  onToggle: (isFavorite: boolean) => void
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
  disabled?: boolean
  ariaLabelSuffix?: string
  useHeart?: boolean
}
```

**State Used:**
- `pressed` — local state for animation

**Key Functions:**
- `handleClick()` — calls onToggle with inverted state

**Description:** Toggle button for favoriting/bookmarking items. Supports star or heart icon, three sizes, animated press feedback.

---

### 15. FilterChips

**File:** `components/shared/FilterChips.tsx`

**Export:** Default export `FilterChips`, also exports `FilterChip`, `FilterChipsProps` interfaces

**Props Interface:**
```typescript
export interface FilterChip {
  id: string
  label: string
  icon?: React.ReactNode
  disabled?: boolean
  meta?: Record<string, unknown>
}

export interface FilterChipsProps {
  chips: FilterChip[]
  selectedIds: string[]
  onChange?: (selectedIds: string[], changedId: string, meta?: Record<string, unknown>) => void
  className?: string
  multiSelect?: boolean
}
```

**State Used:** None (controlled via selectedIds prop)

**Description:** Toggleable filter chip component for multi-select filtering. Supports icons, disabled state, and metadata pass-through.

---

### 16. GlobalSearch (Shared)

**File:** `components/shared/GlobalSearch.tsx`

**Export:** Default export `GlobalSearch`, also exports `SearchSuggestion`, `GlobalSearchProps` interfaces

**Props Interface:**
```typescript
export interface SearchSuggestion {
  id: string
  label: string
  type?: 'recent' | 'suggestion' | 'result'
  icon?: React.ReactNode
}

export interface GlobalSearchProps {
  value?: string
  onSearch?: (query: string) => void
  onChange?: (query: string) => void
  suggestions?: SearchSuggestion[]
  placeholder?: string
  className?: string
  autoFocus?: boolean
}
```

**State Used:**
- `query` ��� local state
- `focused` — local state for dropdown visibility
- Debounce timer via useEffect

**Key Functions:**
- Debounced call to onChange (300ms)
- Keyboard navigation for suggestions

**Description:** Reusable search input component with debouncing, suggestions dropdown, and keyboard support.

---

### 17. LoadingSkeleton

**File:** `components/shared/LoadingSkeleton.tsx`

**Export:** Default export `LoadingSkeleton`, also exports `LoadingSkeletonProps`, `SkeletonCardProps` interfaces

**Props Interface:**
```typescript
export interface LoadingSkeletonProps {
  variant?: 'text' | 'card' | 'row' | 'circle' | 'rect' | 'chart'
  width?: string
  height?: string
  count?: number
  className?: string
  ariaLabel?: string
}
```

**State Used:** None (stateless)

**Description:** Configurable skeleton/placeholder for loading states. Provides shimmer animation and various shapes.

---

### 18. NotificationDropdown

**File:** `components/shared/NotificationDropdown.tsx`

**Export:** Default export `NotificationDropdown`, also exports `Notification` interface

**Props Interface:**
```typescript
export interface Notification {
  id: string
  type: 'new_report' | 'data_sync' | 'export_complete' | 'system_alert'
  title: string
  message: string
  time: string
  read: boolean
}
```

**State Used:**
- `open` — local state `boolean`
- `notifications` — local state array (mock data in component)

**Key Functions:**
- Filters by read/unread status
- Mark as read via click

**Description:** Dropdown notification panel showing system alerts, report notifications, with read/unread states.

---

### 19. SummaryCard

**File:** `components/shared/SummaryCard.tsx`

**Export:** Default export `SummaryCard`, also exports `SummaryCardProps` interface

**Props Interface:**
```typescript
export interface SummaryCardProps {
  value: string | number
  label: string
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  trendDescription?: string
  icon?: React.ReactNode
  iconBgClass?: string
  className?: string
  loading?: boolean
}
```

**State Used:**
- `loading` — local state (optional prop)

**Key Functions:** None (stateless display)

**Description:** Stat card for displaying a single metric with optional trend indicator, icon, and description.

---

## Component Dependencies Summary

| Category | Component | Imports From |
|----------|-----------|--------------|
| Layout | Sidebar | `@/store/reportStore`, `@/components/AuthProvider`, `framer-motion` |
| Layout | Topbar | `@/store/authStore` (via localStorage) |
| Dashboard | AIInsightCard | `@/lib/reports/intelligence`, `/api/reports/ai-insight` |
| Dashboard | FavoritesPanel | `@/lib/reports/inventory/config`, `@/store/reportStore` |
| Dashboard | GlobalSearch | `@/lib/reports/inventory/config`, `@/store/reportStore` |
| Dashboard | HeroBanner | `/api/system/status` |
| Dashboard | ModuleCard | `@/lib/reports/intelligence` |
| Dashboard | MonitoringVisualSection | `@/lib/reports/intelligence`, `@/lib/reports/monitoring` |
| Dashboard | RecentPanel | `@/lib/reports/inventory/config`, `@/store/reportStore` |
| Dashboard | SystemInfoPanel | `/api/system/status` |
| Shared | EmptyState | React only |
| Shared | ExportButtonGroup | React, file conversion utilities |
| Shared | ExportQueuePanel | React, export queue context |
| Shared | FavoriteButton | React, framer-motion (implied) |
| Shared | FilterChips | React only |
| Shared | GlobalSearch | React only |
| Shared | LoadingSkeleton | React only |
| Shared | NotificationDropdown | `@/lib/utils` |
| Shared | SummaryCard | React only |

---

## Usage Patterns

### Store-Dependent Components
Components that read from Zustand stores (`useReportStore`, `useAuth`):
- Sidebar (sidebarCollapsed, toggle, logout)
- FavoritesPanel (favorites)
- GlobalSearch Dashboard (favorites, toggleFavorite)
- RecentPanel (recent)

### API-Dependent Components
Components that fetch from backend endpoints:
- AIInsightCard (`POST /api/reports/ai-insight`)
- HeroBanner (`GET /api/system/status`)
- SystemInfoPanel (`GET /api/system/status`)

### Reusable Shared Components
These are designed for reuse across pages:
- EmptyState
- ExportButtonGroup
- ExportQueuePanel
- FavoriteButton
- FilterChips
- GlobalSearch
- LoadingSkeleton
- NotificationDropdown
- SummaryCard

---

*Generated from codebase scan of Dashboard_Utama components directory*