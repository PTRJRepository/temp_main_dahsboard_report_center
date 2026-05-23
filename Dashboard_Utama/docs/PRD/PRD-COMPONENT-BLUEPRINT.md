# PRD — Component Blueprint
**Document Version:** 1.0.0
**Project:** PT Rebinmas Jaya — Report Center
**Last Updated:** 2026-05-17
**Author:** Ujang (Codex Architecture Agent)

---

## 1. Overview

This document specifies every UI component in the Report Center application. Each component includes a description, prop definitions, state tables, behavior specifications, and accessibility requirements. The design follows dark navy (#071426) sidebar, green (#167A3A) accent, gold (#D9A514) highlight, white cards with rounded-xl corners and soft shadows, and glassmorphism overlays.

---

## 2. AppShell

**Description:** Root layout wrapper that orchestrates Sidebar, Topbar, and Content Area. Manages responsive breakpoints and global state for sidebar collapse/expand.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `sidebarCollapsed` | `boolean` | `false` | Whether sidebar starts in collapsed state |
| `activeModule` | `string` | `null` | Currently active module ID |
| `userRole` | `'kerani' \| 'hr' \| 'payroll' \| 'manager' \| 'admin'` | `'kerani'` | Current user role for RBAC |
| `onSidebarToggle` | `() => void` | required | Callback when sidebar collapse button clicked |
| `children` | `ReactNode` | required | Page content |

### States

| State | Description |
|-------|-------------|
| `expanded` | Sidebar visible at full width (260px), all labels shown |
| `collapsed` | Sidebar icon-only (64px), tooltips on hover |
| `mobile-drawer` | Sidebar becomes slide-in drawer on screens < 768px |

### Behaviors

1. On mount: check `localStorage` for saved sidebar state, apply or default to `expanded`.
2. On `onSidebarToggle`: toggle `sidebarCollapsed`, persist to `localStorage`.
3. Breakpoint `768px`: auto-collapse sidebar to icon-only.
4. Breakpoint `640px`: convert sidebar to drawer overlay.
5. Content area `margin-left` transitions smoothly (260ms ease).
6. Pass `sidebarCollapsed` context to Sidebar, Topbar, and all children.

### Accessibility

- `role="application"` on shell
- Sidebar toggle: `aria-label="Toggle sidebar navigation"`, `aria-expanded={!sidebarCollapsed}`
- Focus trap when mobile drawer is open

---

## 3. Sidebar

**Description:** Collapsible left navigation panel. Dark navy (#071426) background. Contains logo, grouped navigation sections (UTAMA, LAPORAN, MODUL, ADMIN), user section, and version badge.

### Layout Structure

```
┌─────────────────────────┐
│  [Logo] PT REBINMAS     │
│         Report Center   │
├─────────────────────────┤
│  UTAMA                   │
│  ├─ 🏠 Dashboard         │
│  └─ ⚙️ Settings          │
├─────────────────────────┤
│  LAPORAN                 │
│  ├─ 📋 All Reports      │
│  ├─ ⭐ Favorites         │
│  └─ 🕐 Recent            │
├─────────────────────────┤
│  MODUL                   │
│  ├─ Absensi             │
│  ├─ Payroll             │
│  ├─ Daftar Upah         │
│  ├─ Inventory           │
│  ├─ Premi & Lembur      │
│  ├─ Produktivitas       │
│  ├─ Karyawan            │
│  ├─ Estate/Divisi       │
│  └─ Integrasi & Audit  │
├─────────────────────────┤
│  ADMINISTRASI            │
│  ├─ 📤 Export History   │
│  └─ 🔧 Settings         │
├─────────────────────────┤
│  [👤 User Name    v]    │
│  [Collapse] [Logout]    │
│  ── Report Center v2.0 ─│
└─────────────────────────┘
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `collapsed` | `boolean` | `false` | Icon-only mode |
| `activePath` | `string` | `'/'` | Current route for active state |
| `onNavigate` | `(path: string) => void` | required | Navigation callback |
| `user` | `{ name: string, role: string, avatar?: string }` | required | User info |

### States

| State | Description |
|-------|-------------|
| `expanded` | Full width 260px, all labels visible |
| `collapsed` | Icon-only 64px, labels hidden, tooltips appear on hover |
| `drawer` | Mobile overlay drawer, backdrop blur |
| `hover-item` | Hover on nav item shows subtle highlight |

### Behaviors

1. **Collapse toggle**: Click button at bottom → toggle between 260px and 64px width with 260ms CSS transition.
2. **Navigation**: Click any item → call `onNavigate(path)` with appropriate route.
3. **Active state**: Current route item gets left green border (#167A3A) + green text.
4. **Module group**: Click module item → navigate to `/modules/[slug]`.
5. **User section**: Avatar + name click → show dropdown (Profile, Settings, Logout).
6. **Version badge**: Static text at bottom, non-interactive.
7. **Hover tooltip**: When `collapsed=true` and item hovered → show tooltip with item label.

### Accessibility

- `nav` landmark with `aria-label="Main navigation"`
- Each `a`/`button` has `aria-current={isActive ? 'page' : undefined}`
- Collapse button: `aria-label="Collapse sidebar"` / `aria-label="Expand sidebar"`
- Mobile: close button with `aria-label="Close navigation"`

---

## 4. Topbar

**Description:** Fixed top bar (64px height) with dark navy (#071426) background. Contains left title block, center info badges, and right action icons.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `activePeriod` | `string` | `'MEI 2026'` | Active reporting period |
| `activeDivision` | `string` | `'DME'` | Active division/estate |
| `sidebarCollapsed` | `boolean` | `false` | For content margin offset |
| `notificationCount` | `number` | `0` | Unread notification badge |
| `user` | `{ name: string, avatar?: string }` | required | User info |

### States

| State | Description |
|-------|-------------|
| `default` | Normal display |
| `has-notifications` | Bell icon shows red badge with count |
| `user-menu-open` | Avatar dropdown visible |

### Behaviors

1. **Ctrl+K shortcut**: Click search area or press `Ctrl+K` → open GlobalSearch modal.
2. **Notification bell**: Click → open notification panel/dropdown.
3. **User avatar**: Click → open user menu (Profile, Settings, Logout).
4. **Period/Division badges**: Non-clickable info display.
5. **Content offset**: `margin-top: 64px` applied to page content based on `sidebarCollapsed` state.
6. **Scroll behavior**: Stays fixed at top, does not scroll with content.

### Accessibility

- `header` landmark with `role="banner"`
- Search shortcut: `aria-label="Open global search (Ctrl+K)"`
- Notification: `aria-label="Notifications, {n} unread"`
- User menu: `aria-expanded={isOpen}` on avatar button

---

## 5. HeroBanner

**Description:** Full-width banner (280px height) at top of dashboard content. Features a plantation/oil palm photo background with dark green semi-transparent overlay. Contains title, subtitle, description, and SystemStatusCard.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | `string` | `'Dashboard Report'` | Main heading |
| `subtitle` | `string` | `'Pusat akses laporan operasional'` | Subheading |
| `description` | `string` | required | Body description text |
| `backgroundImage` | `string` | null | Optional custom bg image URL |

### States

| State | Description |
|-------|-------------|
| `default` | Photo background with overlay |
| `loading` | Skeleton shimmer while image loads |
| `no-image` | Fallback to solid dark navy gradient |

### Behaviors

1. Background: oil palm plantation photo from `assets/palm-bg.jpg` (or `backgroundImage` prop).
2. Overlay: `linear-gradient(135deg, rgba(7,20,38,0.85), rgba(22,122,58,0.6))`.
3. Content centered vertically.
4. SystemStatusCard floats on right side.
5. Subtle parallax effect on scroll (translateY 0.1x scroll speed).
6. On mobile: height reduces to 220px, text sizes scale down.

### Accessibility

- `role="banner"` content area with `aria-label="Dashboard header"`
- Decorative background image marked `aria-hidden="true"`

---

## 6. SystemStatusCard

**Description:** Compact status widget showing database connection, integration status, and last update timestamp. Lives inside HeroBanner.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `databaseStatus` | `'online' \| 'offline'` | `'online'` | DB connection state |
| `integrationStatus` | `'connected' \| 'disconnected'` | `'connected'` | Integration state |
| `lastUpdate` | `Date \| string` | new Date() | Last data sync time |

### States

| State | Description |
|-------|-------------|
| `normal` | All green dots, "Sistem berjalan dengan normal" |
| `warning` | Yellow dot for any item, message changes |
| `critical` | Red dot, bold warning message |

### Behaviors

1. **Database indicator**: Green dot (#167A3A) = online, Red dot (#DC2626) = offline.
2. **Integration indicator**: Green dot = connected, Red dot = disconnected.
3. **Last update**: Format "DD MMM YYYY HH:mm" e.g., "20 Mei 2026 08:45".
4. **Status text**: "Sistem berjalan dengan normal" (green), "Peringatan sistem" (yellow), "Koneksi terputus" (red).
5. **Hover**: Slight elevation shadow.

### Accessibility

- `aria-label="System status: Database {status}, Integration {status}, Last update {time}"`
- Status text readable by screen reader

---

## 7. GlobalSearch

**Description:** Prominent search input with Ctrl+K shortcut badge. Debounced query (300ms). Dropdown shows categorized results (Recent, Modules, Reports).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Modal/dropdown open state |
| `onClose` | `() => void` | required | Close callback |
| `recentSearches` | `string[]` | `[]` | Recent search history |
| `modules` | `ModuleConfig[]` | `[]` | Available modules for suggestions |
| `reports` | `ReportConfig[]` | `[]` | All reports for suggestions |

### States

| State | Description |
|-------|-------------|
| `idle` | Empty input, placeholder visible |
| `typing` | Input has value, debounce countdown |
| `suggesting` | Dropdown open with results grouped |
| `no-results` | Empty dropdown with message |
| `loading` | Spinner in input while fetching |

### Behaviors

1. **Open**: Click topbar search area or press `Ctrl+K`.
2. **Input**: Type query → debounce 300ms → filter modules + reports.
3. **Results dropdown**: Grouped sections — "Modul", "Laporan" — max 8 items each.
4. **Keyboard nav**: Arrow up/down to navigate, Enter to select, Escape to close.
5. **Select result**: Click or Enter → navigate to result's route, close modal.
6. **Recent searches**: Shown when input empty, click to re-search.
7. **Close**: Click outside, Escape key, or X button.

### Accessibility

- Modal with `role="dialog"`, `aria-modal="true"`, `aria-label="Global search"`
- Input: `aria-label="Search reports and modules"`
- Results list: `role="listbox"`, items `role="option"`
- `aria-activedescendant` tracks focused option

---

## 8. FilterChips

**Description:** Horizontal scrollable row of module filter chips. Selected chip gets green background and white text.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `modules` | `{ id: string, label: string }[]` | all 9 modules | Chip options |
| `selected` | `string \| null` | `null` | Currently selected module ID |
| `onChange` | `(moduleId: string \| null) => void` | required | Selection change callback |

### States

| State | Description |
|-------|-------------|
| `default` | All chips neutral (white bg, gray text) |
| `selected` | Active chip: green bg (#167A3A), white text |
| `hover` | Chip lightens slightly |
| `focused` | Keyboard focus ring (green) |

### Behaviors

1. **Horizontal scroll**: Overflow hidden, scroll buttons appear at edges if overflow.
2. **Select chip**: Click → `onChange(moduleId)` — "Semua Modul" sends `null`.
3. **Deselect**: Click active chip again → `onChange(null)`.
4. **Scroll**: Left/right scroll buttons if total width > container width.

### Accessibility

- Container: `role="group"`, `aria-label="Filter by module"`
- Each chip: `role="radio"`, `aria-checked={isSelected}`
- Keyboard: Left/Right arrows navigate within group

---

## 9. ModuleCard

**Description:** Windows tile-inspired card representing one module (e.g., Inventory, Payroll). White card with colored left border, large icon, report count badge, description, last update, and CTA button.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `module` | `{ id: string, name: string, icon: string, reportCount: number, description: string, accentColor: string }` | required | Module data |
| `lastUpdate` | `Date \| string` | required | Last data update |
| `onOpen` | `(moduleId: string) => void` | required | CTA click callback |

### States

| State | Description |
|-------|-------------|
| `default` | Resting card with subtle shadow |
| `hover` | Shadow deepens, slight translateY(-2px), cursor pointer |
| `active` | Click feedback, scale(0.98) briefly |
| `disabled` | Grayed out if no access (RBAC) |

### Module Accent Colors

| Module | Accent Color |
|--------|-------------|
| Absensi | Blue `#2563EB` |
| Payroll | Green `#167A3A` |
| Daftar Upah | Teal `#0D9488` |
| Inventory | Orange `#EA8A13` |
| Premi & Lembur | Purple `#7C3AED` |
| Produktivitas Kebun | Amber `#D97706` |
| Karyawan | Pink `#DB2777` |
| Estate/Divisi | Indigo `#4F46E5` |
| Integrasi & Audit | Slate `#475569` |

### Behaviors

1. **Click anywhere**: Call `onOpen(module.id)` → navigate to module page.
2. **Hover**: Shadow `0 8px 25px rgba(0,0,0,0.12)`, `transform: translateY(-2px)`.
3. **Report count badge**: Green pill on top-right of icon.
4. **Last update**: Format "Terakhir update: DD MMM YYYY"
5. **CTA button**: "Buka Modul" → same action as card click.
6. **RBAC**: If user role cannot access module, show lock icon and "Akses dibatasi" label.

### Accessibility

- Card: `role="button"` if interactive, `aria-label="{module.name}, {n} reports"`
- Report count: `aria-label="{n} reports available"`
- CTA button: `aria-label="Open {module.name} module"`

---

## 10. ReportListItem

**Description:** A row/card in the module report list. Shows report name, description, status badge, tags, and action buttons.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `report` | `{ id: string, name: string, description: string, status: 'live' \| 'update', tags: string[], lastUpdate: string }` | required | Report data |
| `onView` | `(id: string) => void` | required | View action |
| `onPreview` | `(id: string) => void` | required | Preview action |
| `onExport` | `(id: string, format: string) => void` | required | Export action |
| `isSelected` | `boolean` | `false` | Highlighted when selected |

### States

| State | Description |
|-------|-------------|
| `default` | White row, light border |
| `selected` | Light green bg tint (#EAF7EF), left green border |
| `hover` | Slight shadow, background tint |
| `disabled` | Grayed text, no actions |

### Behaviors

1. **Click row**: Call `onView(report.id)`.
2. **Click "Preview"**: Call `onPreview(report.id)` — populate right panel.
3. **Click "Excel"**: Call `onExport(report.id, 'xlsx')`.
4. **Click "PDF"**: Call `onExport(report.id, 'pdf')`.
5. **Status badge**: "Live" (green pill), "Update" (yellow pill).
6. **Tags**: Small gray chips, truncated if > 3 tags.
7. **Selected**: Row highlights and preview panel updates.

### Accessibility

- Row: `role="button"` for the whole row, `aria-label="{report.name}, {status}"`
- Actions: Accessible button labels "View {name}", "Preview {name}", etc.
- Status badge: `aria-label="Status: {status}"`

---

## 11. ReportPreviewPanel

**Description:** Sticky right-side panel (380px width) on module detail page. Shows preview data for the selected report.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `report` | `ReportConfig \| null` | `null` | Currently selected report |
| `previewData` | `object[]` | `[]` | Top 5 rows of preview data |
| `chartData` | `ChartDataConfig` | null | Data for mini bar chart |
| `metadata` | `{ source: string, period: string, lastUpdate: string, updatedBy: string }` | required | Report metadata |
| `onViewFull` | `() => void` | required | Navigate to full report |
| `onExport` | `(format: string) => void` | required | Export callback |

### States

| State | Description |
|-------|-------------|
| `empty` | No report selected — show placeholder message |
| `loading` | Skeleton table + chart while data loads |
| `loaded` | Full preview with table, chart, metadata |
| `error` | "Gagal memuat preview" message with retry button |

### Layout Structure

```
┌──────────────────────────┐
│ Preview: [Report Name]   │ ← Sticky header
│ [Description text]       │
│ Status: [Live Badge]      │
├──────────────────────────┤
│ Preview Table (top 5)     │ ← Scrollable if overflow
│ ┌──────────────────────┐  │
│ │ Col1 | Col2 | Col3  │  │
│ │ val  | val  | val   │  │
│ │ ...  | ...  | ...   │  │
│ └──────────────────────┘  │
├──────────────────────────┤
│ Mini Bar Chart           │
│ [====  ] Gudang Aik      │
│ [===   ] Gudang Batu    │
│ [==    ] Gudang Simpang │
├──────────────────────────┤
│ Summary Stats            │
│ Total Item: 1,248        │
│ Total Stok: 28,745       │
│ Satuan: Beragam          │
├──────────────────────────┤
│ Metadata                 │
│ Sumber: Inventory DB     │
│ Periode: Mei 2026        │
│ Update: 28 Mei 08:30    │
│ Oleh: Sistem Otomatis   │
├──────────────────────────┤
│ [Lihat Laporan - primary] │
│ [Preview] [Excel] [PDF]  │
└──────────────────────────┘
```

### Behaviors

1. **Sticky positioning**: `position: sticky; top: 80px; height: calc(100vh - 100px)`.
2. **Scrollable content**: Panel body scrolls independently.
3. **Empty state**: "Pilih laporan untuk melihat preview" centered.
4. **Table**: Click column header → sort (visual only, full data on view page).
5. **Chart**: Responsive bar chart (horizontal bars), shows distribution.
6. **Action buttons**: Primary "Lihat Laporan" calls `onViewFull()`.

### Accessibility

- `aside` landmark with `aria-label="Report preview panel"`
- Table: `aria-label="Preview data for {report.name}"`
- Empty state: `aria-live="polite"` announcement

---

## 12. ReportViewer

**Description:** Full report page with filters, summary cards, and full data table. The destination page when user clicks "Lihat Laporan".

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `report` | `ReportConfig` | required | Report configuration |
| `initialFilters` | `FilterConfig` | `{}` | Pre-applied filter values |
| `onExport` | `(format: string) => void` | required | Export callback |

### Filters Row

| Filter | Type | Default | Options |
|--------|------|---------|---------|
| `periode` | `select` | current period | List of available periods |
| `dateStart` | `date` | period start | Date picker |
| `dateEnd` | `date` | period end | Date picker |
| `lokasi` | `select` | all | Location/gudang list |
| `kategori` | `select` | all | Category list |
| `supplier` | `select` | all | Supplier list |
| `status` | `select` | all | Status options |

### States

| State | Description |
|-------|-------------|
| `loading` | Full-page skeleton |
| `loaded` | Data table visible |
| `empty` | No data for filters → "Tidak ada data" |
| `error` | "Gagal memuat laporan" with retry |

### Behaviors

1. **Filter apply**: Click "Terapkan Filter" → refetch data with filters.
2. **Filter reset**: Click "Reset" → restore defaults.
3. **Table search**: Input above table → client-side filter on visible rows.
4. **Column sort**: Click header → toggle asc/desc.
5. **Pagination**: Change per-page (10/25/50/100), page navigation.
6. **Column visibility**: Dropdown to show/hide columns.
7. **Export**: Click "Export Excel/PDF/CSV" → call `onExport(format)`.
8. **Copy link**: Click "Copy Link" → copy URL with filter state.

### Accessibility

- Filter form: `aria-label="Report filters"`
- Table: `role="grid"` with `aria-label="{report.name} data table"`
- Pagination: `aria-label="Table pagination, page {n} of {total}"`
- Export buttons: descriptive labels

---

## 13. SummaryCard

**Description:** Small metric card showing a KPI label, large value, optional icon, and trend indicator.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | required | Metric label |
| `value` | `string \| number` | required | Metric value |
| `unit` | `string` | `''` | Unit suffix (e.g., "items", "KG") |
| `icon` | `ReactNode` | null | Optional icon |
| `trend` | `'up' \| 'down' \| 'neutral'` | `'neutral'` | Trend direction |
| `trendValue` | `string` | `''` | Change amount (e.g., "+12%") |

### States

| State | Description |
|-------|-------------|
| `default` | Neutral display |
| `positive` | Trend up = green text + arrow |
| `negative` | Trend down = red text + arrow |
| `loading` | Skeleton placeholder |

### Behaviors

1. **Trend arrow**: Up = green ↑, Down = red ↓, Neutral = gray →
2. **Icon**: Optional lucide icon, tinted with module accent color.
3. **Hover**: Subtle elevation.
4. **Click**: Optional — if `onClick` prop provided, card is interactive.

### Accessibility

- Card: `role="region"`, `aria-label="{label}: {value} {unit}"`
- Trend: `aria-label="Trend: {direction}, {value} change"`

---

## 14. ExportButtonGroup

**Description:** Grouped export action buttons (Excel, PDF, CSV, Print, Copy Link) with icon + label.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onExport` | `(format: 'xlsx' \| 'pdf' \| 'csv') => void` | required | Export callback |
| `onPrint` | `() => void` | required | Print callback |
| `onCopyLink` | `() => void` | required | Copy link callback |
| `loading` | `boolean` | `false` | Export in progress |
| `loadingFormat` | `string` | `''` | Currently exporting format |

### States

| State | Description |
|-------|-------------|
| `default` | All buttons enabled |
| `loading` | Active format button shows spinner, others disabled |
| `success` | Brief green checkmark after export completes |
| `error` | Red state on failed export |

### Behaviors

1. **Click export button**: Set loading state, call `onExport(format)`.
2. **Success feedback**: Green checkmark + "File siap" for 3 seconds.
3. **Error feedback**: Red highlight + "Gagal" message with retry.
4. **Print**: Opens browser print dialog for current view.
5. **Copy link**: Copies current URL to clipboard, shows "Link disalin!" toast.

### Accessibility

- Group: `role="group"`, `aria-label="Export actions"`
- Each button: `aria-label="Export as {format}"`
- Loading: `aria-busy="true"` on loading button

---

## 15. FavoriteButton

**Description:** Heart toggle button for marking reports as favorites. Animated on toggle.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isFavorite` | `boolean` | `false` | Current favorite state |
| `onToggle` | `(newState: boolean) => void` | required | Toggle callback |
| `reportId` | `string` | required | Report ID for storage |

### States

| State | Description |
|-------|-------------|
| `inactive` | Outline heart, gray (#9CA3AF) |
| `active` | Filled heart, green (#167A3A) |
| `hover-inactive` | Outline heart, dark gray |
| `hover-active` | Filled heart, slightly lighter green |
| `animating` | Pulse scale animation on toggle |

### Behaviors

1. **Toggle**: Click → call `onToggle(!isFavorite)`, persist to user preferences.
2. **Animation**: Scale 1 → 1.2 → 1 on toggle (200ms).
3. **Hover**: Scale 1.05 on hover.
4. **Tooltip**: "Tambah ke favorit" / "Hapus dari favorit" on hover.

### Accessibility

- Button: `role="button"`, `aria-pressed={isFavorite}`
- `aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}`

---

## 16. RecentReportsPanel

**Description:** Panel showing the last 5 accessed reports with timestamp.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `reports` | `{ id: string, name: string, module: string, timestamp: string, icon: string }[]` | `[]` | Recent reports list |
| `onSelect` | `(reportId: string) => void` | required | Click callback |

### States

| State | Description |
|-------|-------------|
| `default` | List of 5 items |
| `empty` | "Belum ada laporan yang dilihat" message |
| `hover-item` | Item highlights on hover |

### Behaviors

1. **Click item**: Navigate to `/reports/[id]`.
2. **Timestamp**: Format "HH:mm" if today, "DD MMM" if older.
3. **Max items**: Show last 5, stored in localStorage.
4. **Overflow**: If < 5 items, show "Lihat semua" link.

### Accessibility

- Section: `aria-label="Recently viewed reports"`
- List: `role="list"`, items `role="listitem"`
- Item: `aria-label="{report.name}, {module}, dilihat {timestamp}"`

---

## 17. SystemInfoPanel

**Description:** Compact information widget showing current system state.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `periodeAktif` | `string` | `'Mei 2026'` | Active period |
| `divisiAktif` | `string` | `'DME'` | Active division |
| `databaseStatus` | `string` | `'Online'` | DB status text |
| `integrationStatus` | `string` | `'Terhubung'` | Integration status |
| `lastUpdate` | `string` | required | Last data update |

### Behaviors

1. **Display**: Read-only info panel, non-interactive.
2. **Link**: "Lihat Status" link at bottom → navigate to Integrasi & Audit module.
3. **Status colors**: Online (green), Offline (red), Warning (yellow).

### Accessibility

- `role="region"`, `aria-label="System information"`
- Status values read aloud by screen readers

---

## 18. EmptyState

**Description:** Displayed when no data is available for the current query or filter.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `icon` | `ReactNode` | search icon | Large centered icon |
| `title` | `string` | `'Tidak ada laporan ditemukan'` | Main message |
| `description` | `string` | `'Coba ubah kata kunci atau filter pencarian.'` | Suggestion text |
| `action` | `{ label: string, onClick: () => void }` | null | Optional CTA button |

### States

| State | Description |
|-------|-------------|
| `no-results` | Search/filter returned nothing |
| `no-access` | User has no permission for this content |
| `no-data` | Module has no reports yet |

### Behaviors

1. **Icon**: Large (64px) centered icon, colored gray.
2. **Title**: Bold, centered, gray-900.
3. **Description**: Regular, centered, gray-500.
4. **Action button**: Optional primary/secondary button.
5. **Contextual**: Different icon/message per state type.

### Accessibility

- `role="status"`, `aria-live="polite"`
- Icon marked `aria-hidden="true"`

---

## 19. LoadingSkeleton

**Description:** Shimmer animation placeholder for content being loaded.

### Variants

| Variant | Dimensions | Usage |
|---------|-----------|-------|
| `ModuleCardSkeleton` | 280px × 200px | Grid of module cards |
| `ReportListItemSkeleton` | Full width × 72px | List of report items |
| `TableRowSkeleton` | Full width × 48px | Table data rows |
| `PreviewPanelSkeleton` | 380px × calc(100vh) | Right preview panel |
| `SummaryCardSkeleton` | 180px × 100px | Summary metric cards |

### States

| State | Description |
|-------|-------------|
| `shimmer` | Animated gradient sweep left to right (1.5s loop) |
| `static` | Static gray placeholder (no animation) |

### Behaviors

1. **Shimmer**: `background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)` animated.
2. **Match layout**: Skeleton shape matches actual component layout.
3. **No flash**: No abrupt appearance/disappearance — maintain skeleton until data ready.

### Accessibility

- Container: `role="progressbar"`, `aria-label="Loading content"`
- `aria-busy="true"` on parent container

---

## 20. ExportQueuePanel

**Description:** Slide-in panel (420px wide) from right showing all export requests with their status.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `isOpen` | `boolean` | `false` | Panel open state |
| `onClose` | `() => void` | required | Close callback |
| `queue` | `ExportQueueItem[]` | `[]` | List of export items |

### ExportQueueItem Schema

```typescript
interface ExportQueueItem {
  id: string;
  reportName: string;
  format: 'xlsx' | 'pdf' | 'csv';
  size: string;        // e.g., "2.4 MB"
  status: 'processing' | 'ready' | 'failed' | 'expired';
  requestedAt: Date;
  completedAt?: Date;
  error?: string;
  downloadUrl?: string;
}
```

### States

| State | Description |
|-------|-------------|
| `empty` | "Tidak ada export dalam antrian" message |
| `has-items` | List of queue items |
| `item-processing` | Spinner + "Memproses..." text |
| `item-ready` | Green checkmark + "Siap diunduh" + download button |
| `item-failed` | Red X + error message + "Coba lagi" button |
| `item-expired` | Yellow clock + "File kedaluwarsa" + "Buat ulang" button |

### Behaviors

1. **Slide in**: From right edge, 300ms ease-out.
2. **Backdrop**: Semi-transparent overlay behind panel.
3. **Item actions**: Download (ready), Retry (failed), Recreate (expired), Delete (any).
4. **Auto-cleanup**: Expired items auto-removed after 24 hours.
5. **Notification**: When item becomes "ready", show system notification.
6. **Sound**: Optional ding sound on ready (user preference).
7. **Download**: Click → download file via `downloadUrl`.

### Accessibility

- Panel: `role="dialog"`, `aria-modal="true"`, `aria-label="Export queue"`
- List: `role="list"`, items `role="listitem"`
- Status badges: `aria-label="Export {reportName}: {status}"`
- Close button: `aria-label="Close export queue"`

---

## 21. IntelligenceWidget

**Description:** Proactive recommendation widget showing reports the user likely needs based on behavior patterns.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `recommendations` | `{ reportId: string, reason: string, confidence: number }[]` | `[]` | AI-generated recommendations |
| `onSelect` | `(reportId: string) => void` | required | Click callback |

### Recommendation Reasons

| Reason Type | Example |
|-------------|---------|
| `"time_based"` | "Biasanya dibuka pagi ini" |
| `"updated"` | "Sudah diperbarui hari ini" |
| `"similar"` | "Mirip laporan yang sering Anda buka" |
| `"due"` | "Payroll period ends in 3 days" |
| `"anomaly"` | "Terdeteksi anomaly di data昨日" |

### States

| State | Description |
|-------|-------------|
| `loading` | Skeleton cards while computing |
| `has-recommendations` | 3-5 recommendation cards |
| `empty` | "Tidak ada rekomendasi saat ini" |

### Behaviors

1. **Fetch on mount**: Call recommendation API with user ID + current time.
2. **Confidence threshold**: Only show recommendations with confidence > 0.6.
3. **Max display**: Show top 5 recommendations.
4. **Click**: Navigate to recommended report.
5. **Refresh**: Pull-to-refresh or button to re-compute.
6. **Dismiss**: X button to hide recommendation temporarily.

### Accessibility

- Widget: `role="region"`, `aria-label="Report recommendations for you"`
- Cards: `role="button"`, `aria-label="{reportName}, recommended because {reason}"`
- Reason text: `aria-label="Reason: {reason}"`

---

## 22. ExecutiveDashboard

**Description:** Full-screen KPI cockpit view for Manager/Admin role. Reaches via `/admin/executive` route.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `period` | `string` | current period | Reporting period |
| `division` | `string` | all divisions | Division filter |

### Layout Structure

```
┌──────────────────────────────────────────────────────────┐
│ Executive Dashboard          [Period ▼] [Divisi ▼]       │
├──────────────────────────────────────────────────────────┤
│ KPI Row (4 cards)                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │ Total   │ │ Total   │ │ Payroll │ │ Inventory│         │
│ │ Reports │ │ Export  │ │ This Mo │ │ Value    │         │
│ │   151   │ │  1,248  │ │ Rp 2.4B │ │ Rp 8.7B  │         │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
├──────────────────────────────────────────────────────────┤
│ Anomaly Alerts          │  Delayed Reports               │
│ ⚠ 3 integration failures│  ⏰ 2 reports not updated >3d   │
│ ⚠ Payroll data mismatch│  ⏰ 1 inventory sync delayed    │
├──────────────────────────────────────────────────────────┤
│ Quick Export Paket                                       │
│ [ 📦 Payroll Bulanan ] [ 📦 Absensi Harian ]             │
│ [ 📦 Inventory Mingguan ] [ 📦 Produktivitas ]           │
├──────────────────────────────────────────────────────────┤
│ Cross-Module Summary Table                                │
│ Module | Reports | Last Update | Status | Actions        │
└──────────────────────────────────────────────────────────┘
```

### States

| State | Description |
|-------|-------------|
| `loading` | KPI cards + table skeleton |
| `loaded` | Full dashboard with live data |
| `error` | "Gagal memuat dashboard" with retry |
| `filtered` | Data filtered by period/division |

### Behaviors

1. **Period selector**: Dropdown to change reporting period.
2. **Division selector**: Filter data by estate/division.
3. **KPI cards**: Click → navigate to relevant module summary.
4. **Anomaly alerts**: Click → navigate to relevant module's Integrasi & Audit.
5. **Delayed reports**: Click → navigate to specific report.
6. **Quick Export Paket**: Single click → queues all reports in that category for export.
7. **Auto-refresh**: Data refreshes every 5 minutes (configurable).

### Accessibility

- Page: `role="main"`, `aria-label="Executive dashboard"`
- KPI cards: `role="region"`, each `aria-label="{label}: {value}"`
- Alerts: `role="alert"` for anomaly items
- Period/Division selectors: labeled dropdowns

---

## Appendix: Common Prop Types

```typescript
type ModuleConfig = {
  id: string;
  name: string;
  icon: string;
  reportCount: number;
  description: string;
  accentColor: string;
};

type ReportConfig = {
  id: string;
  name: string;
  description: string;
  moduleId: string;
  status: 'live' | 'update';
  tags: string[];
  lastUpdate: string;
  filters: FilterField[];
  exportFormats: ('xlsx' | 'pdf' | 'csv')[];
};

type FilterField = {
  key: string;
  label: string;
  type: 'select' | 'date' | 'text';
  options?: string[];
  default?: string;
};

type ChartDataConfig = {
  labels: string[];
  values: number[];
  colors: string[];
};
```

---

*End of Component Blueprint — PT Rebinmas Jaya Report Center v1.0*
