# PRD: Information Architecture & Navigation

## PT Rebinmas Jaya Report Center

## 1. IA Objective

The Report Center information architecture must make 151 reports discoverable, role-aware, and reachable in under 10 seconds from any page. The navigation model prioritizes global search, a persistent dark navy sidebar, direct module access, recents, favorites, and export status.

Primary shell:

| Region | Purpose |
|---|---|
| Dark navy sidebar `#071426` | Persistent navigation, module entry, collapsed icon mode |
| Top command bar | Global search, command mode, notifications, user scope |
| Main canvas | Dashboard, module lists, previews, report viewer, exports |
| Context rail | Optional filters, metadata, related reports, queue status |

## 2. Sidebar Structure

```text
PT REBINMAS JAYA
REPORT CENTER
│
├─ 🟢 Dashboard                         /
│
├─ Search & Shortcuts
│  ├─ Global Search                     Ctrl+K
│  ├─ Favorites                         /favorites
│  ├─ Recent Reports                    /recent
│  └─ Export Queue                      /exports
│
├─ Report Modules
│  ├─ Absensi                 (18)      /modules/absensi
│  ├─ Payroll                 (24)      /modules/payroll
│  ├─ Daftar Upah             (15)      /modules/daftar-upah
│  ├─ Inventory               (22)      /modules/inventory
│  ├─ Premi & Lembur          (12)      /modules/premi-lembur
│  ├─ Produktivitas           (16)      /modules/produktivitas
│  ├─ Karyawan                (20)      /modules/karyawan
│  ├─ Estate / Divisi         (10)      /modules/estate-divisi
│  └─ Integrasi & Audit       (14)      /modules/integrasi-audit
│
├─ Intelligence
│  ├─ Recommended Reports
│  ├─ Stale Data Alerts
│  ├─ Exception Highlights
│  └─ Executive Command Mode
│
└─ Administration
   ├─ Report Catalog                    /admin/reports
   ├─ Role Access                       /admin/access
   ├─ Audit Trail                       /admin/audit
   └─ System Health                     /admin/health
```

Visibility rules:

| Item | Visibility |
|---|---|
| Dashboard | All authenticated roles |
| Favorites | All authenticated roles |
| Recent Reports | All authenticated roles |
| Export Queue | All authenticated roles |
| Modules | Only if user can access at least one report in the module |
| Intelligence | Managers and Admins; limited recommendations for other roles |
| Administration | Admin only, with optional read-only audit view for Manager |

## 3. URL Routing Conventions

| Route | Purpose | Notes |
|---|---|---|
| `/` | Dashboard | Role-aware landing page |
| `/modules/[slug]` | Module report list | Example: `/modules/payroll` |
| `/reports/[id]` | Report preview or viewer | Query string stores filters and view mode |
| `/favorites` | Saved reports | User-specific |
| `/recent` | Recently opened reports | User-specific, audit-backed |
| `/exports` | Export queue and history | User-specific; admin can filter all jobs |
| `/admin` | Admin overview | Admin only |
| `/admin/reports` | Report catalog governance | Metadata and access policy, not source data CRUD |
| `/admin/access` | Role and report access policy | Admin only |
| `/admin/audit` | Audit trail | Admin; manager limited by scope |
| `/admin/health` | Source and export health | Admin only |

Report viewer query conventions:

| Pattern | Example |
|---|---|
| Filter | `/reports/absensi-daily?date=2026-05-17&division=D2` |
| Preview mode | `/reports/payroll-summary?mode=preview` |
| Table mode | `/reports/payroll-summary?mode=table&period=2026-04` |
| Export intent | `/reports/inventory-stock?export=xlsx` |

## 4. Slug Standards

| Entity | Convention | Example |
|---|---|---|
| Module slug | Lowercase kebab-case Indonesian module name | `premi-lembur` |
| Report ID | Module prefix plus report purpose | `payroll-summary-monthly` |
| Filter key | Lowercase camel or short stable key | `division`, `gang`, `period` |
| Date value | ISO date | `2026-05-17` |
| Period value | ISO month | `2026-04` |

## 5. Breadcrumb Standards

Breadcrumbs appear under the top command bar on module, report, export detail, and admin pages.

Format:

```text
Dashboard / [Module] / [Report Title]
Dashboard / Exports / [Export Job ID]
Dashboard / Admin / [Admin Section]
```

Rules:

| Rule | Requirement |
|---|---|
| First crumb | Always `Dashboard` and links to `/` |
| Module crumb | Links to `/modules/[slug]` |
| Current page | Plain text, not a link |
| Truncation | Long report names truncate after 48 characters with tooltip |
| Mobile | Shows previous page label plus current page title |
| Permission | Breadcrumb never reveals unauthorized module/report names |

Examples:

| Page | Breadcrumb |
|---|---|
| Absensi daily report | `Dashboard / Absensi / Laporan Absensi Harian` |
| Export detail | `Dashboard / Exports / EXP-20260517-00042` |
| Admin audit | `Dashboard / Admin / Audit Trail` |

## 6. Max-2-Click Journey

Every report must be accessible within two primary interactions after page readiness.

```text
FROM ANY PAGE
│
├─ Path A: Search-first
│  1. Type in global search or Ctrl+K
│  2. Select report result
│  → Report preview opens
│
├─ Path B: Sidebar module
│  1. Click module
│  2. Click report card
│  → Report preview opens
│
├─ Path C: Favorites
│  1. Click Favorites
│  2. Click saved report
│  → Report preview opens
│
├─ Path D: Recent
│  1. Click Recent Reports
│  2. Click recent report
│  → Report preview opens with last filters
│
└─ Path E: Executive Command Mode
   1. Open command mode
   2. Confirm command result
   → Report preview, viewer, or export queue
```

Journey requirements:

| Requirement | Target |
|---|---:|
| Global search visible or keyboard accessible | `100%` of pages |
| Sidebar module access | `<= 2 clicks` |
| Favorite access | `<= 2 clicks` |
| Recent report access | `<= 2 clicks` |
| Search result preview open | `<= 10 sec` median |

## 7. Dashboard IA

```text
Dashboard
│
├─ Command Search Bar
├─ Quick Stats
│  ├─ Reports Available
│  ├─ Exports Processing
│  ├─ Stale Sources
│  └─ Favorites
│
├─ Recommended for You
│  ├─ Role-based reports
│  ├─ Recently used filters
│  └─ Closing-period shortcuts
│
├─ Module Grid
│  ├─ Absensi
│  ├─ Payroll
│  ├─ ...
│  └─ Integrasi & Audit
│
└─ Activity Rail
   ├─ Recent reports
   ├─ Export status
   └─ Data freshness alerts
```

## 8. Module Page IA

```text
/modules/[slug]
│
├─ Module Header
│  ├─ Name
│  ├─ Report count user can access
│  ├─ Data freshness summary
│  └─ Module-level search
│
├─ Filter Chips
│  ├─ Favorites
│  ├─ Recently used
│  ├─ Requires attention
│  └─ Export available
│
├─ Report List
│  ├─ Report card
│  │  ├─ Title
│  │  ├─ Business purpose
│  │  ├─ Owner
│  │  ├─ Freshness
│  │  ├─ Sensitivity label
│  │  └─ Preview action
│  └─ ...
│
└─ Related Modules
```

## 9. Report Page IA

```text
/reports/[id]
│
├─ Report Header
│  ├─ Title
│  ├─ Module
│  ├─ Favorite toggle
│  ├─ Freshness indicator
│  └─ Export actions
│
├─ Preview / Viewer Tabs
│  ├─ Preview
│  ├─ Table
│  ├─ Summary
│  └─ Audit
│
├─ Filter Panel
│  ├─ Date / period
│  ├─ Estate
│  ├─ Division
│  ├─ Gang
│  └─ Employee where permitted
│
├─ Data Region
│  ├─ Preview contract
│  ├─ Table result
│  ├─ Empty state
│  └─ Error state
│
└─ Context Rail
   ├─ Related reports
   ├─ Report owner
   ├─ Column definitions
   └─ Export history
```

## 10. Mobile Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `>= 1200px` | Full sidebar, top command bar, optional context rail |
| `900px - 1199px` | Collapsible sidebar, context rail becomes drawer |
| `600px - 899px` | Icon sidebar or bottom nav, filters in drawer, table horizontal scroll |
| `< 600px` | Sidebar becomes full-screen menu, command search prominent, report cards stacked |

Mobile rules:

| Area | Requirement |
|---|---|
| Sidebar | Hidden behind menu button; active route shown in header |
| Search | Fixed in top area; command mode available through search button |
| Filters | Bottom sheet with apply/reset actions |
| Table | Sticky first column where feasible; horizontal scroll; column density controls |
| Export queue | Toast plus notification center; download opens browser-safe flow |
| Breadcrumb | Back link plus current title |
| Touch targets | Minimum 44px height |

## 11. Navigation States

### 11.1 Sidebar States

| State | Visual Treatment | Behavior |
|---|---|---|
| Default | Dark navy background, muted text | Item is visible and permitted |
| Hover | Slight glass highlight, green left glow | Shows tooltip in collapsed mode |
| Active | Green accent `#167A3A`, gold micro-highlight | Indicates current route or parent module |
| Collapsed | Icon-only, tooltip on hover/focus | Preserves active state |
| Disabled | Not shown for unauthorized users | Avoids revealing restricted modules |
| Alert | Gold dot or badge | Indicates stale source, failed export, or pending attention |

### 11.2 Report Card States

| State | Visual Treatment | Behavior |
|---|---|---|
| Available | Glass card with clear title and preview action | Opens preview |
| Favorite | Gold pin/star marker | Available under `/favorites` |
| Recent | Timestamp marker | Available under `/recent` |
| Stale | Gold warning chip | Preview allowed with warning |
| Restricted | Hidden by default | If directly accessed, no-access page |
| Loading | Skeleton card | Prevents layout shift |

### 11.3 Search States

| State | Behavior |
|---|---|
| Idle | Shows placeholder and shortcut hint |
| Typing | Debounced suggestions with report, module, filter, and command groups |
| No result | Suggest broader terms and accessible modules |
| Restricted match | Do not show unauthorized result |
| Error | Keep typed query and show retry |

## 12. Accessibility Navigation Requirements

| Requirement | Standard |
|---|---|
| Keyboard navigation | Sidebar, search, command mode, filters, report tabs, and export actions are keyboard accessible |
| Focus state | Visible green/gold focus ring on dark backgrounds |
| ARIA labels | Icon-only controls require labels |
| Reduced motion | Glass hover and command transitions respect reduced-motion settings |
| Contrast | Sidebar and text meet WCAG AA contrast |

