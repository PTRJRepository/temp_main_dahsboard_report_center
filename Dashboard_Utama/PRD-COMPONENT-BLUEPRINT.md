# PT Rebinmas Jaya Report Center - PRD Component Blueprint

## 1. Purpose

This document defines the production-ready component blueprint for the PT Rebinmas Jaya Report Center, an executive and operational reporting interface for accessing, previewing, filtering, exporting, and monitoring business reports.

The component system is designed for a dark navy application shell, white content cards, strong operational clarity, and restrained executive polish.

## 2. Design Tokens

### 2.1 Color Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `color.navy.950` | `#071426` | App background, sidebar background, topbar base, high-emphasis text on light surfaces when needed |
| `color.green.700` | `#167A3A` | Primary actions, success states, active navigation, approved status, positive indicators |
| `color.gold.500` | `#D9A514` | Highlights, executive emphasis, warnings, featured metrics, premium report badges |
| `color.white` | `#FFFFFF` | Cards, panels, popovers, report surfaces |
| `color.gray.50` | `#F8FAFC` | Page canvas inside shell, subtle card background |
| `color.gray.100` | `#EEF2F6` | Borders, skeleton fills, inactive chip background |
| `color.gray.300` | `#CBD5E1` | Dividers, disabled borders |
| `color.gray.500` | `#64748B` | Secondary text, placeholders, metadata |
| `color.gray.700` | `#334155` | Body text on light backgrounds |
| `color.red.600` | `#DC2626` | Error and failed export states |
| `color.blue.600` | `#2563EB` | Informational states and processing indicators |

### 2.2 Typography Tokens

| Token | Value | Usage |
| --- | --- | --- |
| `font.family.base` | `Inter, ui-sans-serif, system-ui, sans-serif` | All interface text |
| `font.size.xs` | `12px` | Metadata, badges, timestamps |
| `font.size.sm` | `14px` | Labels, compact controls |
| `font.size.md` | `16px` | Body text, form inputs |
| `font.size.lg` | `18px` | Card titles |
| `font.size.xl` | `24px` | Section headers |
| `font.size.2xl` | `32px` | Dashboard headers |
| `font.weight.regular` | `400` | Body text |
| `font.weight.medium` | `500` | Labels and metadata emphasis |
| `font.weight.semibold` | `600` | Component titles |
| `font.weight.bold` | `700` | Executive-level metric values |

### 2.3 Shape, Spacing, and Elevation

| Token | Value | Usage |
| --- | --- | --- |
| `radius.xl` | `12px` | Standard card and panel radius |
| `radius.lg` | `10px` | Buttons, chips, list items |
| `radius.md` | `8px` | Inputs, menus, compact controls |
| `space.1` | `4px` | Dense internal gaps |
| `space.2` | `8px` | Standard compact gap |
| `space.3` | `12px` | Control padding |
| `space.4` | `16px` | Card padding mobile |
| `space.5` | `20px` | Card padding desktop |
| `space.6` | `24px` | Section spacing |
| `space.8` | `32px` | Major layout spacing |
| `shadow.card` | `0 8px 24px rgba(7, 20, 38, 0.08)` | White cards on light canvas |
| `shadow.overlay` | `0 16px 40px rgba(7, 20, 38, 0.18)` | Popovers, drawers, preview panels |

### 2.4 Component Principles

1. White cards use `rounded-xl`, subtle borders, and low elevation.
2. Dark navy areas carry navigation, identity, and global controls.
3. Green represents primary operational action and healthy status.
4. Gold is reserved for executive emphasis, highlights, warnings, and priority reports.
5. All interactive controls must provide visible focus states with at least `2px` outline contrast.
6. Dense reporting interfaces prioritize scanability over decorative spacing.

## 3. Component Specifications

The requested inventory says 20 components, but the supplied list contains 21 unique components. This blueprint specifies all 21 named components to avoid omitting a requested surface.

---

## 3.1 AppShell

### Description

Primary application frame that establishes the Report Center layout. It owns the persistent sidebar, topbar, page content region, responsive layout behavior, global background, skip links, and shell-level loading/error boundaries. It is the top-level composition container for authenticated users.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `children` | `ReactNode` | Required | Main route content rendered inside the shell content region. |
| `sidebarCollapsed` | `boolean` | `false` | Controls whether the desktop sidebar is collapsed to icon-only width. |
| `sidebarOpen` | `boolean` | `false` | Controls mobile sidebar drawer visibility. |
| `activeModuleId` | `string` | `undefined` | Current active module identifier used by nested navigation. |
| `user` | `{ name: string; role: string; avatarUrl?: string; unit?: string }` | `undefined` | Authenticated user metadata displayed by Topbar and Sidebar. |
| `systemStatus` | `'healthy' \| 'degraded' \| 'maintenance' \| 'offline'` | `'healthy'` | Shell-level system status indicator. |
| `pageTitle` | `string` | `undefined` | Current page title for document title and topbar breadcrumb. |
| `breadcrumbs` | `{ label: string; href?: string }[]` | `[]` | Ordered breadcrumb trail. |
| `onToggleSidebar` | `() => void` | `undefined` | Called when user toggles desktop sidebar. |
| `onCloseMobileSidebar` | `() => void` | `undefined` | Called when mobile drawer should close. |
| `onLogout` | `() => void` | `undefined` | Called from account menu logout action. |
| `maintenanceMessage` | `string` | `undefined` | Optional banner message shown during degraded or maintenance mode. |

### States

| State | Description |
| --- | --- |
| `default` | Sidebar, topbar, and content render normally. |
| `sidebar-collapsed` | Sidebar is reduced to icon rail; content width expands. |
| `mobile-sidebar-open` | Sidebar appears as modal drawer over the content. |
| `loading-route` | Main content region shows route-level LoadingSkeleton. |
| `route-error` | Main content region shows recoverable route error with retry. |
| `maintenance` | Shell displays persistent maintenance banner and disables selected write actions. |
| `offline` | Shell shows connectivity notice and may serve cached reports only. |

### Behaviors

1. Render a skip link as the first focusable element that moves focus to the main content region.
2. Maintain fixed sidebar and sticky topbar on desktop viewports.
3. Convert sidebar into a modal drawer below the tablet breakpoint.
4. Preserve scroll independently inside the main content region when sidebar content is long.
5. Apply `#071426` to shell navigation surfaces and `#F8FAFC` to the content canvas.
6. Push route content below the topbar without overlaying interactive content.
7. Close mobile sidebar when route changes, escape is pressed, or backdrop is clicked.
8. Persist desktop collapsed state in user preferences when `onToggleSidebar` is provided.
9. Expose shell status to child components through context when the implementation supports context.
10. Set `document.title` from `pageTitle` using the pattern `{pageTitle} - PT Rebinmas Jaya Report Center`.
11. Prevent body scroll when mobile sidebar drawer is open.
12. Keep content readable down to `360px` viewport width without horizontal scrolling except inside data tables or report viewers.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use `role="banner"` for topbar, `role="navigation"` for sidebar, and `role="main"` for content. |
| Landmarks | Ensure only one visible `main` landmark exists per page. |
| Keyboard nav | Skip link must be reachable with `Tab`; `Esc` closes mobile sidebar. |
| Focus management | Opening mobile sidebar moves focus to first actionable item; closing restores focus to the opener. |
| Labels | Sidebar toggle must have `aria-label` reflecting the next action. |
| Reduced motion | Drawer transitions must respect `prefers-reduced-motion`. |

---

## 3.2 Sidebar

### Description

Persistent navigation component for report modules, executive dashboards, recent destinations, and administrative areas. It supports expanded and collapsed modes, permission-aware item visibility, nested groups, badges, and mobile drawer rendering.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `items` | `SidebarItem[]` | `[]` | Navigation tree. Each item includes `id`, `label`, `icon`, `href`, `children`, `badge`, and `permission`. |
| `activeItemId` | `string` | `undefined` | Currently selected navigation item. |
| `collapsed` | `boolean` | `false` | Enables icon-only sidebar. |
| `mobile` | `boolean` | `false` | Renders sidebar in drawer mode. |
| `brandName` | `string` | `'PT Rebinmas Jaya'` | Brand text displayed in header. |
| `brandSubtitle` | `string` | `'Report Center'` | Secondary brand text. |
| `logoSrc` | `string` | `undefined` | Optional company logo asset. |
| `userRole` | `string` | `undefined` | Used to filter permission-based navigation items. |
| `expandedGroupIds` | `string[]` | `[]` | Controlled expanded group identifiers. |
| `onItemSelect` | `(item: SidebarItem) => void` | `undefined` | Called when a navigation item is selected. |
| `onGroupToggle` | `(groupId: string) => void` | `undefined` | Called when a nested group expands or collapses. |
| `onCollapseToggle` | `() => void` | `undefined` | Called from the desktop collapse control. |

### States

| State | Description |
| --- | --- |
| `expanded` | Full labels, icons, badges, and group headings are visible. |
| `collapsed` | Only icons and active indicators are visible; labels move to tooltips. |
| `mobile-drawer` | Sidebar appears as modal navigation over the page. |
| `item-active` | Active navigation item uses green left rail or background treatment. |
| `item-hover` | Item uses subtle navy tint or white overlay depending on shell mode. |
| `group-expanded` | Nested children are visible. |
| `group-collapsed` | Nested children are hidden. |
| `permission-filtered` | Items unavailable to current role are not rendered. |

### Behaviors

1. Render brand block at the top with company identity and Report Center subtitle.
2. Use `#071426` as base background and white text for primary navigation labels.
3. Use `#167A3A` for active item background, indicator, or icon depending on contrast.
4. Use `#D9A514` for priority badges and executive dashboard markers.
5. Hide unauthorized items completely rather than disabling them.
6. In collapsed mode, expose item labels through accessible tooltips.
7. Preserve expanded group state across sidebar collapse and re-expansion.
8. Use roving focus only within composite menu groups if arrow-key navigation is implemented.
9. Close mobile drawer after a terminal navigation item is selected.
10. Keep destructive or session actions visually separated from report module navigation.
11. Display badges with compact counts and cap large counts, for example `99+`.
12. Ensure group headers are not focusable unless they expand or collapse content.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use `nav` with `aria-label="Primary report navigation"`. |
| Current item | Active link must include `aria-current="page"`. |
| Expandable groups | Group toggles use `aria-expanded` and `aria-controls`. |
| Keyboard nav | `Tab` moves through links; `Enter` activates links; `Space` toggles groups. |
| Tooltips | Collapsed labels must be available to screen readers without relying only on hover. |
| Contrast | Text and active states must meet WCAG AA contrast on navy background. |

---

## 3.3 Topbar

### Description

Sticky top navigation bar containing page context, breadcrumbs, global search entry, date scope, notifications, system status, and account actions. It provides operational orientation without taking over report content space.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `undefined` | Current page or module title. |
| `breadcrumbs` | `{ label: string; href?: string }[]` | `[]` | Page hierarchy. |
| `showSearch` | `boolean` | `true` | Whether to render GlobalSearch within the topbar. |
| `searchValue` | `string` | `''` | Controlled search query. |
| `dateRangeLabel` | `string` | `undefined` | Current reporting period label. |
| `notificationCount` | `number` | `0` | Number of unread notifications. |
| `systemStatus` | `'healthy' \| 'degraded' \| 'maintenance' \| 'offline'` | `'healthy'` | Status indicator shown near account controls. |
| `user` | `{ name: string; role: string; avatarUrl?: string }` | `undefined` | Current user information. |
| `onMenuClick` | `() => void` | `undefined` | Opens mobile sidebar. |
| `onSearchChange` | `(value: string) => void` | `undefined` | Called when search value changes. |
| `onNotificationsClick` | `() => void` | `undefined` | Opens notifications panel. |
| `onAccountAction` | `(action: string) => void` | `undefined` | Handles account menu selections. |

### States

| State | Description |
| --- | --- |
| `default` | Breadcrumbs, title, search, and actions render normally. |
| `scrolled` | Topbar elevation increases after content scroll. |
| `search-focused` | Search input expands or raises visual priority. |
| `notifications-unread` | Notification button displays count badge. |
| `status-degraded` | Status indicator changes to warning treatment. |
| `mobile` | Menu button appears; breadcrumbs are compressed. |
| `account-menu-open` | Account menu popover is visible. |

### Behaviors

1. Remain sticky at the top of the content area.
2. Display breadcrumbs on desktop and compress to current title on small screens.
3. Keep the mobile menu button as the first topbar action on mobile.
4. Use GlobalSearch either inline or as a trigger to a command-style overlay.
5. Show notification count only when greater than zero.
6. Use status color mapping: green healthy, gold degraded or maintenance, red offline.
7. Truncate long titles with accessible full text available through `title` attribute or tooltip.
8. Account menu closes on outside click, escape, or route change.
9. Avoid layout shift when notification count changes.
10. Announce system status changes through a polite live region.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Topbar container uses `role="banner"` when not nested inside another banner. |
| Breadcrumbs | Use `nav aria-label="Breadcrumb"` and ordered list semantics. |
| Menus | Account menu trigger uses `aria-haspopup="menu"` and `aria-expanded`. |
| Keyboard nav | `Enter` and `Space` open menus; `Esc` closes popovers. |
| Notifications | Button label includes unread count, for example `Notifications, 3 unread`. |
| Focus order | Focus order follows visual order from left to right. |

---

## 3.4 HeroBanner

### Description

High-level page introduction component for the Report Center home and executive dashboard entry points. It communicates current reporting context, operational period, headline metric, and primary actions without becoming a marketing section.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | Required | Main banner title. |
| `subtitle` | `string` | `undefined` | Supporting operational context. |
| `periodLabel` | `string` | `undefined` | Active report period, for example `May 2026`. |
| `primaryMetric` | `{ label: string; value: string; delta?: string; tone?: 'positive' \| 'neutral' \| 'negative' }` | `undefined` | Optional headline KPI. |
| `actions` | `{ label: string; icon?: ReactNode; variant?: 'primary' \| 'secondary'; onClick: () => void }[]` | `[]` | Banner-level actions. |
| `backgroundMode` | `'navy' \| 'green' \| 'image'` | `'navy'` | Visual treatment. |
| `imageSrc` | `string` | `undefined` | Optional relevant background image when using image mode. |
| `statusText` | `string` | `undefined` | Small operational status statement. |
| `compact` | `boolean` | `false` | Reduces height for module pages. |

### States

| State | Description |
| --- | --- |
| `default` | Title, subtitle, period, and actions render on navy background. |
| `with-metric` | Primary metric is shown as a compact emphasis block. |
| `with-image` | Background image is visible with navy overlay for legibility. |
| `compact` | Banner height and typography scale down. |
| `loading` | Text and metric areas show skeleton placeholders. |
| `error` | Banner renders fallback title and no metric. |

### Behaviors

1. Use `#071426` as default banner background.
2. Use `#D9A514` for period label or executive highlight accent.
3. Render primary actions as green buttons on dark backgrounds.
4. Maintain enough bottom spacing to show content immediately below the first viewport when used on dashboard home.
5. Keep copy operational and direct, avoiding marketing language.
6. Never place hero text inside a floating card.
7. Ensure background image has overlay contrast sufficient for white text.
8. Stack actions below text on narrow screens.
9. Reserve large heading scale for page-level hero only.
10. Support loading skeletons without changing banner height.

### Accessibility

| Area | Requirement |
| --- | --- |
| Heading | `title` should render as the page `h1` when no higher heading exists. |
| Buttons | Actions use native `button` or link semantics. |
| Images | Decorative background image must use CSS background or empty alt equivalent. |
| Contrast | White and gold text must meet contrast requirements on overlay. |
| Keyboard nav | Banner actions follow normal tab order. |
| Motion | Avoid auto-animated background treatments. |

---

## 3.5 SystemStatusCard

### Description

Compact status card summarizing health of report data pipelines, export services, authentication, and scheduled refresh processes. Used on dashboard home, admin panels, and system info surfaces.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `'System Status'` | Card title. |
| `status` | `'healthy' \| 'degraded' \| 'maintenance' \| 'offline'` | `'healthy'` | Overall service status. |
| `lastUpdatedAt` | `string \| Date` | `undefined` | Timestamp of latest health check. |
| `services` | `{ id: string; name: string; status: string; latencyMs?: number; message?: string }[]` | `[]` | Individual service checks. |
| `refreshing` | `boolean` | `false` | Indicates live refresh is running. |
| `showDetails` | `boolean` | `true` | Whether service-level detail rows are visible. |
| `onRefresh` | `() => void` | `undefined` | Manual refresh callback. |
| `onViewDetails` | `() => void` | `undefined` | Opens detailed system info panel. |

### States

| State | Description |
| --- | --- |
| `healthy` | All services operational; green indicator. |
| `degraded` | One or more services impaired; gold indicator. |
| `maintenance` | Planned maintenance in effect; gold indicator with maintenance label. |
| `offline` | Core services unavailable; red indicator. |
| `refreshing` | Refresh button shows loading spinner and is temporarily disabled. |
| `empty` | No service checks are available. |

### Behaviors

1. Show overall status first with clear label and colored indicator.
2. Sort services by severity before healthy services.
3. Display last updated time in local timezone.
4. Use green only for fully healthy state.
5. Use gold for warning and maintenance states.
6. Disable refresh button during active refresh.
7. Show latency only when available and meaningful.
8. Keep card height stable when refreshing.
9. Provide an escalation action when status is degraded or offline.
10. Allow service details to collapse on constrained layouts.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use `section` with accessible heading. |
| Status | Overall status uses `role="status"` for changes. |
| Keyboard nav | Refresh and details actions are keyboard operable. |
| Labels | Status dots include text labels, not color alone. |
| Live updates | Health changes should be announced politely. |
| Tables/lists | Service rows use semantic list or table structure. |

---

## 3.6 GlobalSearch

### Description

Application-wide search control for locating reports, modules, dashboards, saved filters, and recent searches. Supports inline search, command overlay mode, grouped results, keyboard navigation, and result previews.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `value` | `string` | `''` | Controlled query value. |
| `placeholder` | `string` | `'Search reports, modules, or dashboards'` | Input placeholder. |
| `results` | `SearchResult[]` | `[]` | Search result collection. |
| `recentSearches` | `string[]` | `[]` | Recently submitted searches. |
| `loading` | `boolean` | `false` | Indicates result fetch is active. |
| `open` | `boolean` | `false` | Controls result popover or overlay visibility. |
| `mode` | `'inline' \| 'overlay'` | `'inline'` | Presentation mode. |
| `minQueryLength` | `number` | `2` | Minimum characters before remote search. |
| `onChange` | `(value: string) => void` | Required | Called when query changes. |
| `onSubmit` | `(value: string) => void` | `undefined` | Called when user submits search. |
| `onResultSelect` | `(result: SearchResult) => void` | `undefined` | Called when a result is selected. |
| `onOpenChange` | `(open: boolean) => void` | `undefined` | Called when popover visibility changes. |

### States

| State | Description |
| --- | --- |
| `idle` | Empty or unfocused search input. |
| `focused` | Input is focused and ready for query. |
| `typing` | Query is changing and debounce may be active. |
| `loading` | Results are being fetched. |
| `results` | Results are grouped and selectable. |
| `empty` | No results for current query. |
| `error` | Search request failed with retry option. |
| `recent` | Recent searches are shown before a qualifying query exists. |

### Behaviors

1. Debounce remote queries according to implementation standard, usually `250ms` to `400ms`.
2. Do not fetch remote results until `minQueryLength` is reached.
3. Show recent searches when input is focused and query is empty.
4. Group results by type: reports, modules, dashboards, saved filters.
5. Highlight matched substrings without breaking screen reader readability.
6. Allow arrow keys to move through visible results.
7. Submit current query when `Enter` is pressed with no highlighted result.
8. Select highlighted result when `Enter` is pressed with an active result.
9. Close result surface on `Esc`, outside click, or route navigation.
10. Keep selected result visible while navigating with keyboard.
11. Provide loading and empty states inside the result surface.
12. Support command shortcut display if the platform provides one, for example `Ctrl+K`.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use combobox pattern with `role="combobox"`, `aria-expanded`, and listbox results where applicable. |
| Input label | Provide visible label or `aria-label="Search reports"`. |
| Results | Results use `role="option"` and expose active descendant. |
| Keyboard nav | `ArrowDown`, `ArrowUp`, `Enter`, and `Esc` are supported. |
| Announcements | Loading and result count changes are announced politely. |
| Focus | Overlay mode traps focus while open and restores focus on close. |

---

## 3.7 FilterChips

### Description

Compact filter display and control component for active report filters such as business unit, estate, mill, period, status, owner, file type, and favorite state. Supports removable chips, selectable chips, overflow handling, and clear-all behavior.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `chips` | `FilterChip[]` | `[]` | Active or available filter chips. |
| `variant` | `'active' \| 'selectable' \| 'mixed'` | `'active'` | Determines interaction pattern. |
| `maxVisible` | `number` | `6` | Number of chips shown before overflow. |
| `showClearAll` | `boolean` | `true` | Displays clear-all control when removable chips exist. |
| `disabled` | `boolean` | `false` | Disables all chip interactions. |
| `size` | `'sm' \| 'md'` | `'md'` | Chip density. |
| `onRemove` | `(chipId: string) => void` | `undefined` | Called when removable chip is removed. |
| `onToggle` | `(chipId: string, selected: boolean) => void` | `undefined` | Called when selectable chip changes. |
| `onClearAll` | `() => void` | `undefined` | Called when all active filters should clear. |
| `onOverflowClick` | `() => void` | `undefined` | Opens full filter panel or menu. |

### States

| State | Description |
| --- | --- |
| `default` | Chips render with neutral styling. |
| `selected` | Selectable chip is active with green emphasis. |
| `removable` | Chip includes remove control. |
| `disabled` | Chip interactions are unavailable. |
| `overflow` | Extra chips are represented by `+N` control. |
| `empty` | No chips are rendered or an optional empty label is shown. |
| `focused` | Chip or remove control has visible focus ring. |

### Behaviors

1. Render active filters in the order applied unless a custom order is provided.
2. Use green styling for selected or active filters.
3. Use gold styling for high-priority filters such as executive-only or critical reports.
4. Remove only the selected chip when its close control is activated.
5. Clear all removable filters when clear-all is activated.
6. Collapse chips beyond `maxVisible` into an overflow control.
7. Keep chip height fixed to avoid toolbar layout shift.
8. Do not render clear-all when no active removable chips exist.
9. Preserve focus logically after chip removal, moving to the next chip or clear-all control.
10. Support long chip labels with truncation and accessible full labels.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use list semantics for chip collections. |
| Removable chips | Remove buttons include `aria-label="Remove {label} filter"`. |
| Selectable chips | Use `aria-pressed` for toggle chips or checkbox semantics for multi-select. |
| Keyboard nav | `Tab` reaches each interactive chip; `Enter` and `Space` activate. |
| Announcements | Removing a chip should update result count through the parent live region. |
| Color | Selected state must not rely on color alone. |

---

## 3.8 ModuleCard

### Description

Card representing a report module such as Finance, Operations, HR, Procurement, Sustainability, or Executive Summary. It displays module identity, availability, report counts, freshness, favorite state, and primary navigation.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `id` | `string` | Required | Unique module identifier. |
| `title` | `string` | Required | Module display name. |
| `description` | `string` | `undefined` | Short module description. |
| `icon` | `ReactNode` | `undefined` | Module icon. |
| `href` | `string` | `undefined` | Navigation destination. |
| `reportCount` | `number` | `0` | Number of available reports. |
| `newReportCount` | `number` | `0` | Number of new reports since last visit. |
| `lastUpdatedAt` | `string \| Date` | `undefined` | Latest report update timestamp. |
| `status` | `'available' \| 'limited' \| 'locked' \| 'maintenance'` | `'available'` | Module access and availability state. |
| `favorite` | `boolean` | `false` | Whether module is marked as favorite. |
| `featured` | `boolean` | `false` | Whether module receives gold highlight treatment. |
| `onOpen` | `(id: string) => void` | `undefined` | Called when card is opened. |
| `onFavoriteChange` | `(id: string, favorite: boolean) => void` | `undefined` | Called when favorite state changes. |

### States

| State | Description |
| --- | --- |
| `default` | Available module with neutral white card styling. |
| `hover` | Card elevation increases and primary action becomes clearer. |
| `focused` | Card receives visible focus ring. |
| `featured` | Gold accent line or badge identifies executive priority. |
| `locked` | Access restricted; card explains required permission. |
| `maintenance` | Module is visible but temporarily unavailable. |
| `empty` | Module has zero reports but remains accessible. |

### Behaviors

1. Render as a link when `href` is provided; otherwise render as button-like card.
2. Use white card background, `rounded-xl`, and subtle border.
3. Show report count and latest update timestamp in a predictable location.
4. Display new report badge only when `newReportCount > 0`.
5. Use gold accent for `featured` modules.
6. Use green accent for available active modules.
7. Prevent navigation for locked and maintenance states unless a details action is explicitly provided.
8. Keep favorite interaction separate from card open action.
9. Avoid nested interactive controls inside links; split layout implementation if necessary.
10. Truncate long descriptions after two lines.
11. Preserve card height consistency in responsive grids.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use native anchor or button semantics. |
| Labels | Accessible name includes module title and status if not available. |
| Keyboard nav | `Enter` opens link; `Space` activates button variant. |
| Favorite | FavoriteButton inside card must be separately focusable. |
| Status | Locked and maintenance states include text, not only icon or color. |
| Focus | Focus ring must be visible against white card and light canvas. |

---

## 3.9 ReportListItem

### Description

Row component for a report search result, module report list, recent report list, or favorites list. It presents report metadata, status, owner, period, file type, updated timestamp, favorite action, preview action, and export shortcut.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `report` | `ReportSummary` | Required | Report data object. |
| `selected` | `boolean` | `false` | Indicates current selected report. |
| `favorite` | `boolean` | `false` | Favorite state. |
| `compact` | `boolean` | `false` | Reduces metadata density. |
| `showModule` | `boolean` | `true` | Shows module name badge. |
| `showActions` | `boolean` | `true` | Displays inline actions. |
| `downloadState` | `'idle' \| 'queued' \| 'processing' \| 'complete' \| 'failed'` | `'idle'` | Export state for this report. |
| `onSelect` | `(reportId: string) => void` | `undefined` | Called when row is selected. |
| `onOpen` | `(reportId: string) => void` | `undefined` | Opens full report viewer. |
| `onPreview` | `(reportId: string) => void` | `undefined` | Opens preview panel. |
| `onFavoriteChange` | `(reportId: string, favorite: boolean) => void` | `undefined` | Toggles favorite state. |
| `onExport` | `(reportId: string, format: ExportFormat) => void` | `undefined` | Starts export. |

### States

| State | Description |
| --- | --- |
| `default` | Report item is available and unselected. |
| `hover` | Row background changes subtly and actions become visible. |
| `selected` | Row uses green left rail or tinted background. |
| `focused` | Keyboard focus is visible on row or primary action. |
| `queued` | Export indicator shows queued state. |
| `processing` | Export indicator shows progress spinner. |
| `failed` | Export indicator shows failure and retry option. |
| `restricted` | Report visible but locked due to permissions. |

### Behaviors

1. Primary row click selects or opens the report according to parent context.
2. Double-click behavior should not be required for any core action.
3. Inline actions appear on hover and remain visible on keyboard focus.
4. Metadata order is title, module, period, owner, updated time, status.
5. Use file type badges for PDF, XLSX, CSV, PPTX, or dashboard formats.
6. Indicate restricted reports clearly and disable preview/export actions.
7. Keep favorite button independent from row selection.
8. Support multi-select only when parent list provides selection controls.
9. Use stable row height in virtualized lists.
10. Provide retry action when export failed.
11. Avoid truncating critical identifiers such as period labels before less important metadata.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use `listitem`, `row`, or native table row depending on parent structure. |
| Selection | Selected rows expose `aria-selected` when inside selectable listbox/grid. |
| Keyboard nav | `Enter` opens or selects; inline buttons are reachable by `Tab`. |
| Actions | Icon-only actions include descriptive `aria-label`. |
| Status | Export and permission states are available as text. |
| Focus | Hover-only actions must appear on focus-within. |

---

## 3.10 ReportPreviewPanel

### Description

Side panel or drawer for quick inspection of a selected report without leaving the current list. It shows report metadata, miniature preview, summary, related reports, export actions, and open-in-viewer action.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` | `false` | Controls panel visibility. |
| `report` | `ReportDetail \| null` | `null` | Report data displayed in the panel. |
| `loading` | `boolean` | `false` | Indicates detail or preview content is loading. |
| `error` | `string` | `undefined` | Error message for failed preview load. |
| `placement` | `'right' \| 'bottom'` | `'right'` | Panel placement. |
| `previewUrl` | `string` | `undefined` | URL for embedded preview asset. |
| `relatedReports` | `ReportSummary[]` | `[]` | Reports shown as related items. |
| `exportFormats` | `ExportFormat[]` | `['pdf', 'xlsx']` | Available export formats. |
| `onClose` | `() => void` | Required | Closes the panel. |
| `onOpenFull` | `(reportId: string) => void` | `undefined` | Opens full ReportViewer. |
| `onExport` | `(reportId: string, format: ExportFormat) => void` | `undefined` | Starts export. |
| `onRelatedSelect` | `(reportId: string) => void` | `undefined` | Loads related report into panel. |

### States

| State | Description |
| --- | --- |
| `closed` | Panel is not visible and not focusable. |
| `opening` | Entry transition is active. |
| `open` | Report preview and metadata are visible. |
| `loading` | Skeleton layout appears. |
| `error` | Error message and retry option appear. |
| `empty` | No report is selected. |
| `restricted` | Metadata is shown but preview is blocked. |

### Behaviors

1. Open from list context without resetting list scroll.
2. Lock focus inside panel only when rendered as modal drawer on mobile.
3. On desktop, allow interaction with the list if panel is non-modal and layout supports it.
4. Close on `Esc`, close button, or parent selection clear.
5. Display report title, module, period, owner, updated time, and classification.
6. Show preview content only after permission checks pass.
7. Provide full viewer action as the primary action.
8. Keep export actions grouped and secondary to opening the full report.
9. Show related reports only when at least one exists.
10. Preserve panel width between loading and loaded states.
11. Replace content when another report is selected without closing panel.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Modal variant uses `role="dialog"` and `aria-modal="true"`. Non-modal variant uses complementary region. |
| Labeling | Panel is labelled by report title or fallback `Report preview`. |
| Keyboard nav | `Esc` closes; focus moves to close button or first action on modal open. |
| Focus return | Closing restores focus to the triggering report item. |
| Preview | Embedded documents require meaningful title attribute. |
| Status | Loading and error states are announced. |

---

## 3.11 ReportViewer

### Description

Full report reading and analysis surface. Supports PDF, spreadsheet, dashboard, image, and HTML report formats with toolbar controls for zoom, page navigation, search within report, export, print, favorite, and metadata display.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `report` | `ReportDetail` | Required | Full report metadata and content references. |
| `sourceUrl` | `string` | Required | Source URL for the report content. |
| `format` | `'pdf' \| 'xlsx' \| 'csv' \| 'html' \| 'image' \| 'dashboard'` | Required | Viewer rendering mode. |
| `loading` | `boolean` | `false` | Indicates viewer content is loading. |
| `error` | `string` | `undefined` | Viewer load error. |
| `page` | `number` | `1` | Current page for paginated formats. |
| `pageCount` | `number` | `undefined` | Total page count when known. |
| `zoom` | `number` | `1` | Current zoom scale. |
| `favorite` | `boolean` | `false` | Favorite state. |
| `annotationsEnabled` | `boolean` | `false` | Enables annotation tools when supported. |
| `onPageChange` | `(page: number) => void` | `undefined` | Called when page changes. |
| `onZoomChange` | `(zoom: number) => void` | `undefined` | Called when zoom changes. |
| `onSearchWithin` | `(query: string) => void` | `undefined` | Searches within report. |
| `onExport` | `(format: ExportFormat) => void` | `undefined` | Starts export from viewer. |
| `onPrint` | `() => void` | `undefined` | Starts print flow. |
| `onFavoriteChange` | `(favorite: boolean) => void` | `undefined` | Updates favorite state. |

### States

| State | Description |
| --- | --- |
| `loading` | Viewer skeleton and toolbar placeholders are visible. |
| `ready` | Report content is loaded and interactive. |
| `error` | Content failed to load; retry and download fallback are shown. |
| `unsupported` | Format cannot be previewed inline; download option is shown. |
| `restricted` | User lacks permission to view content. |
| `searching` | In-report search is active. |
| `fullscreen` | Viewer expands to use available screen area. |
| `printing` | Print action is in progress. |

### Behaviors

1. Render a sticky toolbar above the report content.
2. Select the correct renderer based on `format`.
3. Show unsupported fallback for formats that cannot be safely embedded.
4. Keep report metadata accessible through a details drawer or panel.
5. Support zoom controls with defined min and max values.
6. Clamp page navigation between `1` and `pageCount`.
7. Preserve current page and zoom when metadata panel opens.
8. Use download fallback when inline preview fails.
9. Disable print when permissions or format do not allow printing.
10. Track viewer interactions for audit if required by system policy.
11. Avoid loading third-party embedded content without sandboxing.
12. Use content security restrictions for embedded report URLs.
13. Provide full-width reading mode on desktop and simplified toolbar on mobile.
14. Show source freshness and generated timestamp in viewer chrome.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Viewer region uses `role="region"` with `aria-label` containing report title. |
| Toolbar | Use `role="toolbar"` with grouped controls. |
| Keyboard nav | Support `+` and `-` for zoom when focus is in viewer, arrow keys for page movement where safe. |
| Buttons | Icon buttons include labels such as `Zoom in`, `Next page`, and `Export PDF`. |
| Documents | Embedded frames include `title="{report title} preview"`. |
| Focus | Fullscreen entry and exit preserve focus. |
| Announcements | Page changes and search result counts are announced politely. |

---

## 3.12 SummaryCard

### Description

Metric card for executive dashboard KPIs and module summaries. Displays a value, label, comparison delta, sparkline, status tone, and optional drill-down action.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `label` | `string` | Required | Metric name. |
| `value` | `string \| number` | Required | Primary metric value. |
| `unit` | `string` | `undefined` | Unit suffix or prefix context. |
| `delta` | `{ value: string; direction: 'up' \| 'down' \| 'flat'; label?: string }` | `undefined` | Comparison indicator. |
| `tone` | `'positive' \| 'neutral' \| 'warning' \| 'negative'` | `'neutral'` | Visual tone. |
| `icon` | `ReactNode` | `undefined` | Supporting icon. |
| `sparklineData` | `number[]` | `[]` | Optional trend data. |
| `loading` | `boolean` | `false` | Shows metric skeleton. |
| `href` | `string` | `undefined` | Optional drill-down link. |
| `onClick` | `() => void` | `undefined` | Optional drill-down callback. |

### States

| State | Description |
| --- | --- |
| `default` | Neutral metric card. |
| `positive` | Green indicator for favorable movement. |
| `warning` | Gold indicator for attention-needed movement. |
| `negative` | Red indicator for unfavorable movement. |
| `loading` | Skeleton for value and labels. |
| `empty` | Value is unavailable and fallback text is shown. |
| `interactive` | Card is clickable or linked. |

### Behaviors

1. Render value as the highest visual priority.
2. Use white card background, `rounded-xl`, border, and restrained shadow.
3. Format large numbers before rendering when data is numeric and formatter is supplied by parent.
4. Show delta only when comparison data is available.
5. Use green for favorable state only when business meaning is positive.
6. Use gold for warning and threshold-near states.
7. Render sparkline as secondary visual detail.
8. Keep card height consistent across dashboard grids.
9. Make the entire card interactive only when a drill-down exists.
10. Avoid placing multiple unrelated KPIs inside one SummaryCard.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use `article` or `section` with accessible label. |
| Interactive | Use anchor or button semantics when clickable. |
| Trends | Delta must be expressed in text, not only arrow direction or color. |
| Charts | Sparkline is decorative unless it communicates unique data; then provide text summary. |
| Keyboard nav | Interactive cards are reachable and activatable with keyboard. |
| Loading | Skeleton should expose `aria-busy="true"` on card region. |

---

## 3.13 ExportButtonGroup

### Description

Grouped export controls for downloading or queuing reports in supported formats. Handles direct export, export menu, disabled formats, queued state, progress feedback, and export permissions.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `formats` | `ExportFormat[]` | `['pdf', 'xlsx']` | Available export formats. |
| `defaultFormat` | `ExportFormat` | `'pdf'` | Primary one-click export format. |
| `disabledFormats` | `ExportFormat[]` | `[]` | Formats shown as unavailable. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button sizing. |
| `variant` | `'primary' \| 'secondary' \| 'compact'` | `'secondary'` | Visual treatment. |
| `state` | `'idle' \| 'queued' \| 'processing' \| 'complete' \| 'failed'` | `'idle'` | Current export state. |
| `permissionDenied` | `boolean` | `false` | Disables export due to access control. |
| `includeMenu` | `boolean` | `true` | Shows additional format menu. |
| `onExport` | `(format: ExportFormat) => void` | Required | Called when export is selected. |
| `onViewQueue` | `() => void` | `undefined` | Opens ExportQueuePanel. |

### States

| State | Description |
| --- | --- |
| `idle` | Export controls are ready. |
| `menu-open` | Format menu is visible. |
| `queued` | Export request has entered queue. |
| `processing` | Export is being generated. |
| `complete` | Export completed and may show confirmation. |
| `failed` | Export failed; retry is available. |
| `disabled` | No export action is available. |
| `permission-denied` | User lacks export permission. |

### Behaviors

1. Primary button exports using `defaultFormat`.
2. Menu lists all supported formats in a stable order.
3. Disabled formats remain visible with reason text when useful.
4. Prevent duplicate export requests while current request is queued or processing.
5. Show queue action when export is queued or processing.
6. Use green for primary export action.
7. Use gold for queued or processing indicator.
8. Show failure state with retry option.
9. Close menu after a format is selected.
10. Support compact icon-only mode only when tooltip and accessible label exist.
11. Respect report-level and user-level export restrictions.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Menu trigger uses `aria-haspopup="menu"` and `aria-expanded`. |
| Menu items | Format options use `role="menuitem"` or native buttons. |
| Keyboard nav | `Enter` opens or activates; `ArrowDown` enters menu; `Esc` closes. |
| Labels | Include format in labels, for example `Export as PDF`. |
| Status | Queue and processing changes are announced. |
| Disabled | Permission-denied reason must be programmatically available. |

---

## 3.14 FavoriteButton

### Description

Reusable toggle button for marking reports, modules, dashboards, or saved filters as favorites. Supports optimistic updates, loading state, error recovery, and compact usage inside cards or rows.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `favorited` | `boolean` | `false` | Current favorite state. |
| `entityType` | `'report' \| 'module' \| 'dashboard' \| 'filter'` | `'report'` | Entity type for accessible labels. |
| `entityName` | `string` | `undefined` | Entity name included in accessible label. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size. |
| `disabled` | `boolean` | `false` | Disables interaction. |
| `loading` | `boolean` | `false` | Shows pending state after toggle. |
| `variant` | `'ghost' \| 'contained'` | `'ghost'` | Visual treatment. |
| `onChange` | `(favorited: boolean) => void` | Required | Called with next favorite state. |

### States

| State | Description |
| --- | --- |
| `off` | Entity is not favorited. |
| `on` | Entity is favorited with gold icon fill. |
| `hover` | Button indicates toggle affordance. |
| `focused` | Focus ring is visible. |
| `loading` | Toggle request is pending. |
| `error` | Last toggle failed and state is reverted or retriable. |
| `disabled` | Toggle unavailable. |

### Behaviors

1. Toggle favorite state on click, `Enter`, or `Space`.
2. Use gold fill for favorited state.
3. Support optimistic update if parent data layer allows rollback.
4. Disable repeated toggles while `loading` is true.
5. Stop event propagation when placed inside clickable cards or rows.
6. Provide error feedback through tooltip, inline message, or parent toast.
7. Keep button dimensions stable across on/off states.
8. Use icon-only presentation with accessible label.
9. Reflect state through `aria-pressed`.
10. Avoid using favorite as the only way to save report access history.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use native `button` with `aria-pressed`. |
| Labels | Label changes between `Add {name} to favorites` and `Remove {name} from favorites`. |
| Keyboard nav | `Enter` and `Space` toggle. |
| Focus | Focus ring visible in card, row, and dark shell contexts. |
| Status | Loading state exposes `aria-busy` or disabled state. |
| Color | Favorited state must include pressed state, not only gold color. |

---

## 3.15 RecentReportsPanel

### Description

Panel listing recently viewed, exported, or updated reports. It supports grouped recency, quick reopening, preview, clearing history, and empty state guidance.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `reports` | `RecentReport[]` | `[]` | Recent report records. |
| `title` | `string` | `'Recent Reports'` | Panel title. |
| `groupBy` | `'none' \| 'date' \| 'module'` | `'date'` | Grouping strategy. |
| `maxItems` | `number` | `8` | Maximum visible items before view-all action. |
| `loading` | `boolean` | `false` | Shows loading state. |
| `showClear` | `boolean` | `true` | Displays clear history action. |
| `onOpen` | `(reportId: string) => void` | `undefined` | Opens report. |
| `onPreview` | `(reportId: string) => void` | `undefined` | Opens preview. |
| `onClear` | `() => void` | `undefined` | Clears recent report history. |
| `onViewAll` | `() => void` | `undefined` | Opens full recent reports view. |

### States

| State | Description |
| --- | --- |
| `loading` | Skeleton rows appear. |
| `populated` | Recent reports render in groups or flat list. |
| `empty` | EmptyState appears with useful next action. |
| `clearing` | Clear action is pending. |
| `error` | Recent history failed to load. |

### Behaviors

1. Sort reports by most recent interaction descending.
2. Group by date using labels such as `Today`, `Yesterday`, and older date labels.
3. Limit visible items according to `maxItems`.
4. Show view-all only when total report count exceeds visible count.
5. Confirm clear history if the action is destructive or cannot be undone.
6. Render each report using ReportListItem compact variant where practical.
7. Preserve recent item order after favorite state changes.
8. Show interaction type when available, for example viewed or exported.
9. Do not show reports the user can no longer access.
10. Handle empty history with direct link to report modules or search.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Panel uses `section` with accessible heading. |
| Lists | Recent reports use semantic list structure. |
| Keyboard nav | Report rows and actions are reachable in logical order. |
| Clear action | Clear button label states scope, for example `Clear recent report history`. |
| Empty state | Empty message is readable without relying on icon. |
| Loading | Panel sets `aria-busy="true"` while loading. |

---

## 3.16 SystemInfoPanel

### Description

Detailed operational information panel for application version, environment, data refresh schedule, connected data sources, service health, user permissions, and support references.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` | `false` | Controls panel visibility. |
| `appVersion` | `string` | `undefined` | Current application version. |
| `environment` | `'production' \| 'staging' \| 'development'` | `'production'` | Current environment label. |
| `buildDate` | `string \| Date` | `undefined` | Build timestamp. |
| `dataSources` | `{ name: string; status: string; lastSyncAt?: string \| Date }[]` | `[]` | Connected reporting data sources. |
| `refreshSchedule` | `{ label: string; nextRunAt?: string \| Date }[]` | `[]` | Scheduled refresh jobs. |
| `permissions` | `string[]` | `[]` | Current user permission labels. |
| `supportContact` | `{ label: string; href: string }` | `undefined` | Support escalation link. |
| `onClose` | `() => void` | Required | Closes panel. |
| `onRefreshStatus` | `() => void` | `undefined` | Refreshes system information. |

### States

| State | Description |
| --- | --- |
| `closed` | Panel hidden. |
| `open` | System details visible. |
| `loading` | Details are loading. |
| `refreshing` | Manual status refresh is active. |
| `partial` | Some system sections unavailable. |
| `error` | System info failed to load. |

### Behaviors

1. Render as drawer or modal depending on viewport.
2. Group information into application, data sources, schedules, permissions, and support sections.
3. Use green, gold, and red status treatments for data source health.
4. Show timestamps in local timezone with source timezone available when relevant.
5. Provide copyable app version and environment values if support workflows require them.
6. Hide sensitive infrastructure details from non-admin users.
7. Allow manual refresh with visible pending state.
8. Keep support contact visible even if system status data fails.
9. Close on `Esc`, close button, or route-level dismissal.
10. Avoid exposing secrets, connection strings, hostnames, or internal tokens.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Modal variant uses `role="dialog"` with `aria-modal="true"`. |
| Labeling | Panel title labels the dialog. |
| Keyboard nav | Focus is trapped in modal variant and restored on close. |
| Tables | Data source and schedule details use semantic tables or description lists. |
| Status | Status labels include text. |
| Copy controls | Copy buttons announce success or failure. |

---

## 3.17 EmptyState

### Description

Reusable empty, no-results, permission, or error-adjacent placeholder component. It explains the current lack of content and provides relevant next actions without visual clutter.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | Required | Primary empty state message. |
| `description` | `string` | `undefined` | Supporting explanation. |
| `icon` | `ReactNode` | `undefined` | Optional visual indicator. |
| `tone` | `'neutral' \| 'search' \| 'permission' \| 'error'` | `'neutral'` | Semantic presentation. |
| `primaryAction` | `{ label: string; onClick: () => void; href?: string }` | `undefined` | Main recovery action. |
| `secondaryAction` | `{ label: string; onClick: () => void; href?: string }` | `undefined` | Secondary action. |
| `compact` | `boolean` | `false` | Reduces spacing for panels. |
| `illustration` | `ReactNode` | `undefined` | Optional larger visual for full-page states. |

### States

| State | Description |
| --- | --- |
| `neutral` | Generic absence of content. |
| `search` | No results for filters or query. |
| `permission` | User lacks access to content. |
| `error` | Recoverable data issue. |
| `compact` | Small panel or card usage. |
| `with-actions` | One or two actions are shown. |

### Behaviors

1. Keep title concise and specific to the missing content.
2. Use description to suggest why content is absent or what to do next.
3. Render primary action as green button when present.
4. Render secondary action as neutral button or link.
5. Use gold accent for permission or attention states where appropriate.
6. Avoid showing actions that the user lacks permission to perform.
7. Center content inside the available region unless used in dense panel mode.
8. Do not overuse illustration in operational dashboards.
9. Adapt spacing for compact panel contexts.
10. Allow parent to provide result count live region updates.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Use normal section semantics; use `role="alert"` only for urgent error states. |
| Headings | Title should use heading level appropriate to page hierarchy. |
| Actions | Actions use native button or anchor semantics. |
| Icons | Decorative icons are hidden from assistive technology. |
| Focus | When replacing a result list after search, avoid stealing focus from search input. |
| Contrast | Muted description text remains readable. |

---

## 3.18 LoadingSkeleton

### Description

Reusable placeholder system for loading cards, rows, dashboards, panels, and viewer surfaces. It maintains layout stability while data loads and prevents abrupt content shifts.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `variant` | `'card' \| 'row' \| 'text' \| 'dashboard' \| 'viewer' \| 'panel'` | `'card'` | Skeleton layout pattern. |
| `rows` | `number` | `3` | Number of repeated rows for row/text variants. |
| `showAvatar` | `boolean` | `false` | Adds circular placeholder. |
| `animated` | `boolean` | `true` | Enables shimmer or pulse animation. |
| `height` | `number \| string` | `undefined` | Optional fixed height. |
| `width` | `number \| string` | `'100%'` | Optional width. |
| `rounded` | `'md' \| 'lg' \| 'xl'` | `'xl'` | Border radius token. |
| `label` | `string` | `'Loading content'` | Accessible loading label. |

### States

| State | Description |
| --- | --- |
| `static` | Non-animated placeholder. |
| `animated` | Subtle shimmer or pulse. |
| `card` | Card-shaped placeholder. |
| `row` | List-row placeholder. |
| `dashboard` | Grid placeholder for KPI cards and panels. |
| `viewer` | Large document loading placeholder. |

### Behaviors

1. Match final component dimensions as closely as possible.
2. Use gray neutral fills on white or light backgrounds.
3. Use reduced contrast skeletons on navy surfaces.
4. Respect `prefers-reduced-motion` by disabling shimmer animation.
5. Avoid infinite high-cost animation on large dashboards.
6. Reserve image, title, metadata, and action areas in the skeleton layout.
7. Use `rounded-xl` for card skeletons.
8. Keep skeleton visible until minimum meaningful data is ready, not merely until request starts resolving.
9. Avoid layout shift when replacing skeleton with content.
10. Allow parent containers to set `aria-busy`.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Skeleton itself should usually be `aria-hidden="true"`. |
| Loading label | Parent region should expose loading text through `aria-label` or live region. |
| Motion | Disable shimmer for reduced-motion users. |
| Focus | Skeletons must not be focusable. |
| Contrast | Skeleton should be visible but not mistaken for disabled controls. |
| Announcements | Avoid repeatedly announcing every skeleton row. |

---

## 3.19 ExportQueuePanel

### Description

Panel showing queued, processing, completed, and failed report export jobs. It supports progress tracking, cancellation, retry, download, clearing completed jobs, and export audit visibility.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `open` | `boolean` | `false` | Controls panel visibility. |
| `jobs` | `ExportJob[]` | `[]` | Export queue jobs. |
| `loading` | `boolean` | `false` | Indicates queue data is loading. |
| `polling` | `boolean` | `false` | Indicates live queue polling is active. |
| `maxVisible` | `number` | `10` | Visible jobs before scrolling. |
| `onClose` | `() => void` | Required | Closes the panel. |
| `onCancel` | `(jobId: string) => void` | `undefined` | Cancels queued or processing job. |
| `onRetry` | `(jobId: string) => void` | `undefined` | Retries failed job. |
| `onDownload` | `(jobId: string) => void` | `undefined` | Downloads completed export. |
| `onClearCompleted` | `() => void` | `undefined` | Clears completed jobs. |
| `onOpenReport` | `(reportId: string) => void` | `undefined` | Opens source report. |

### States

| State | Description |
| --- | --- |
| `closed` | Panel hidden. |
| `loading` | Queue skeleton appears. |
| `empty` | No export jobs exist. |
| `queued` | Job waits for processing. |
| `processing` | Job shows progress or indeterminate activity. |
| `complete` | Job can be downloaded. |
| `failed` | Job shows failure reason and retry. |
| `cancelling` | Cancel action is pending. |

### Behaviors

1. Sort active jobs before completed jobs, then by creation time descending.
2. Poll active jobs at a controlled interval when panel is open.
3. Stop or reduce polling when no active jobs exist.
4. Show job report title, format, requested time, status, and progress.
5. Allow cancellation only for queued or cancellable processing jobs.
6. Allow retry only for failed jobs when source report is still accessible.
7. Allow download only for completed jobs with valid file URL.
8. Use gold for queued and processing states, green for complete, red for failed.
9. Provide clear completed action only when completed jobs exist.
10. Do not clear failed jobs unless a dedicated action is provided.
11. Surface server-provided failure messages in concise language.
12. Preserve focus after job action changes the list.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Modal variant uses dialog semantics; embedded variant uses `section`. |
| Progress | Determinate jobs use `role="progressbar"` with value attributes. |
| Keyboard nav | Job actions are reachable and labelled. |
| Live updates | Job state changes are announced politely. |
| Focus | Panel open and close restore focus correctly. |
| Status text | Status is textual and not color-only. |

---

## 3.20 IntelligenceWidget

### Description

Insight widget that surfaces automated observations, anomalies, report recommendations, and executive summaries. It is designed as assistive intelligence, not an autonomous decision maker, and must expose confidence and source context.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `title` | `string` | `'Intelligence'` | Widget title. |
| `insights` | `Insight[]` | `[]` | Insight cards or messages. |
| `loading` | `boolean` | `false` | Indicates insights are being generated or fetched. |
| `error` | `string` | `undefined` | Error message. |
| `scope` | `{ moduleId?: string; reportId?: string; period?: string }` | `{}` | Context used to generate insights. |
| `confidenceVisible` | `boolean` | `true` | Shows confidence labels. |
| `sourceLinksVisible` | `boolean` | `true` | Shows links to source reports or metrics. |
| `feedbackEnabled` | `boolean` | `true` | Allows useful/not useful feedback. |
| `maxInsights` | `number` | `4` | Maximum visible insights. |
| `onInsightOpen` | `(insightId: string) => void` | `undefined` | Opens insight detail. |
| `onSourceOpen` | `(sourceId: string) => void` | `undefined` | Opens source report or metric. |
| `onFeedback` | `(insightId: string, feedback: 'useful' \| 'not_useful') => void` | `undefined` | Captures feedback. |
| `onRefresh` | `() => void` | `undefined` | Refreshes insights. |

### States

| State | Description |
| --- | --- |
| `loading` | Insight skeleton or generation state appears. |
| `ready` | Insights are available. |
| `empty` | No insights for current scope. |
| `error` | Insight generation failed. |
| `limited-confidence` | Insight is shown with caution treatment. |
| `feedback-submitted` | Feedback controls acknowledge submission. |

### Behaviors

1. Display insights in priority order based on severity, confidence, and recency.
2. Label insight types such as anomaly, recommendation, summary, or risk.
3. Show confidence when `confidenceVisible` is true.
4. Link every insight to at least one source when source data is available.
5. Use gold accent for attention-worthy insights and green for favorable findings.
6. Avoid presenting generated text as verified fact without source context.
7. Provide refresh action when insights can be regenerated.
8. Limit visible insights to `maxInsights` and provide view-all behavior if needed.
9. Allow feedback once per insight per user session or persisted account rule.
10. Show empty state when data is insufficient rather than inventing insight content.
11. Include timestamp or freshness label for generated insights.
12. Degrade gracefully if intelligence service is unavailable.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Widget uses `section` with accessible heading. |
| Insight list | Use semantic list of insight items. |
| Confidence | Confidence labels are text, not color-only. |
| Keyboard nav | Insight, source, refresh, and feedback controls are keyboard accessible. |
| Live updates | New insight generation completion is announced politely. |
| Disclosure | Generated or assistive nature should be programmatically available in the widget text. |

---

## 3.21 ExecutiveDashboard

### Description

Composite dashboard experience for executive users. It assembles HeroBanner, SummaryCard grids, IntelligenceWidget, SystemStatusCard, RecentReportsPanel, ModuleCards, and report trend panels into an at-a-glance command surface for strategic reporting.

### Props

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `period` | `{ label: string; startDate: string; endDate: string }` | Required | Active reporting period. |
| `user` | `{ name: string; role: string; unit?: string }` | Required | Current executive user context. |
| `metrics` | `ExecutiveMetric[]` | `[]` | KPI metrics for SummaryCards. |
| `modules` | `ModuleSummary[]` | `[]` | Module cards shown on dashboard. |
| `recentReports` | `RecentReport[]` | `[]` | Recent reports panel data. |
| `insights` | `Insight[]` | `[]` | Intelligence widget data. |
| `systemStatus` | `SystemStatus` | `undefined` | System status card data. |
| `loading` | `boolean` | `false` | Page-level loading state. |
| `error` | `string` | `undefined` | Page-level error message. |
| `layout` | `'default' \| 'compact' \| 'wide'` | `'default'` | Dashboard layout density. |
| `onPeriodChange` | `(period: DateRange) => void` | `undefined` | Changes active reporting period. |
| `onMetricOpen` | `(metricId: string) => void` | `undefined` | Opens KPI drill-down. |
| `onModuleOpen` | `(moduleId: string) => void` | `undefined` | Opens report module. |
| `onReportOpen` | `(reportId: string) => void` | `undefined` | Opens report viewer. |
| `onRefresh` | `() => void` | `undefined` | Refreshes dashboard data. |

### States

| State | Description |
| --- | --- |
| `loading` | Dashboard skeleton renders with preserved layout. |
| `ready` | Metrics, modules, reports, insights, and status are visible. |
| `partial-data` | Some sections render unavailable states while others remain usable. |
| `empty` | No dashboard data for selected period. |
| `error` | Dashboard-level load failed with retry. |
| `refreshing` | Existing data remains visible while refresh is in progress. |
| `compact` | Layout density increases for smaller displays or user preference. |

### Behaviors

1. Render HeroBanner at the top with active period and executive summary.
2. Render KPI SummaryCards immediately below the hero in a responsive grid.
3. Prioritize the most decision-critical metrics in the first row.
4. Render IntelligenceWidget in a high-visibility but non-blocking position.
5. Render RecentReportsPanel and SystemStatusCard as supporting operational panels.
6. Render ModuleCards for major report areas with permission filtering applied before display.
7. Keep dashboard usable when one data section fails by showing section-level error or empty states.
8. Refresh data without clearing already visible values unless stale data is unsafe to display.
9. Show last refreshed timestamp near the refresh control.
10. Keep cards aligned across desktop, tablet, and mobile breakpoints.
11. Use white cards with `rounded-xl` for all contained dashboard panels.
12. Use navy background only in shell and hero areas, not as the dominant card surface.
13. Use gold sparingly for priority metrics, warning indicators, and executive highlights.
14. Allow KPI cards and modules to drill down into filtered report views.
15. Preserve selected period across dashboard navigation.
16. Respect role-based visibility for executive-only metrics and reports.
17. Avoid horizontal scrolling for dashboard grids at standard mobile widths.
18. Provide print/export dashboard summary only if data policy permits it.
19. Track dashboard interactions for analytics or audit when required.
20. Render partial loading for individual panels when data arrives independently.

### Accessibility

| Area | Requirement |
| --- | --- |
| ARIA roles | Dashboard uses `main` through AppShell; internal sections use labelled `section` elements. |
| Headings | Heading hierarchy starts with HeroBanner `h1`, followed by section `h2` headings. |
| Keyboard nav | All cards with drill-down actions are reachable in logical visual order. |
| Refresh | Refresh button announces start and completion states. |
| Metrics | KPI values include labels and trend text for screen readers. |
| Charts | Any visual-only chart must have table, summary, or textual alternative. |
| Responsiveness | Reading and focus order remain consistent when layout stacks on mobile. |
| Errors | Section errors are announced without moving focus unexpectedly. |

## 4. Cross-Component Requirements

### 4.1 Responsiveness

1. Mobile minimum supported width is `360px`.
2. Desktop layouts should optimize for `1280px` and scale cleanly to wide monitors.
3. Sidebar collapses or converts to drawer on tablet and mobile breakpoints.
4. Cards should use responsive grids with stable min widths.
5. ReportViewer may use internal scrolling, but the application shell should avoid page-level horizontal overflow.

### 4.2 Data and Permissions

1. Components must never render restricted report content before permission checks complete.
2. Permission-denied states must explain access limitations without exposing sensitive report data.
3. Export and print controls must respect report-level and user-level policy.
4. Report metadata may be visible separately from report content only when policy permits.
5. Administrative system details must be filtered for non-admin users.

### 4.3 Loading and Error Handling

1. Use LoadingSkeleton for first-load states that affect layout.
2. Use stale-while-refresh behavior where existing data remains valid.
3. Prefer section-level error handling over blanking the entire dashboard.
4. Provide retry actions for network or service failures.
5. Avoid infinite spinners without explanatory text for operations longer than three seconds.

### 4.4 Accessibility Baseline

1. Target WCAG 2.2 AA.
2. Every icon-only button must have an accessible name.
3. Color must never be the only status indicator.
4. Keyboard users must be able to reach and operate every interactive feature.
5. Focus must be visible across navy, white, and gray surfaces.
6. Dialogs and drawers must manage focus correctly.
7. Live updates must use polite announcements unless urgent.

### 4.5 Visual QA Checklist

1. Confirm all white cards use `rounded-xl` and consistent padding.
2. Confirm navy, green, and gold tokens are used consistently and sparingly.
3. Confirm text does not overflow buttons, chips, cards, or toolbar controls.
4. Confirm hover, focus, active, disabled, loading, empty, and error states are visible.
5. Confirm mobile stacked layouts preserve reading order.
6. Confirm report viewer and preview panel do not overlap topbar or sidebar.
7. Confirm skeleton dimensions match final loaded content.
8. Confirm executive dashboard does not read as a one-color palette.

