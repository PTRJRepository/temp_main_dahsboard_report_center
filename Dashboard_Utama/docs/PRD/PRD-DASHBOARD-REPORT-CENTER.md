# PRD: Report Center Dashboard — PT Rebinmas Jaya
**Version:** 1.0 | **Date:** 2026-05-17

---

## 1. Concept & Vision

**Report Center** adalah portal web internal untuk karyawan PT Rebinmas Jaya — designed untuk menemukan, melihat, dan meng-export laporan dengan cepat. Tampilan modern ala enterprise dashboard dengan Windows tile aesthetic — clean, profesional, dan actionable. Fokus pada *report-only experience* — tidak ada CUD (Create, Update, Delete).

**Mood:** Premium enterprise tool. Like a high-end analytics platform — calm, organized, trustworthy. Not flashy.

---

## 2. Layout Structure

```
┌──────────────────────────────────────────────────────────────────┐
│  SIDEBAR (260px)  │  TOPBAR (64px)                               │
│  - Logo           │  ┌─────────────────────────────────────────┐ │
│  - Nav Groups     │  │ Breadcrumb │ Search │ Badges │ Avatar  │ │
│  - User Section   │  └─────────────────────────────────────────┘ │
│                   ├──────────────────────────────────────────────┤
│                   │  CONTENT AREA (flex-1, scrollable)          │
│                   │                                              │
│                   │  ┌─ HERO BANNER ─────────────────────────┐   │
│                   │  │ Title + Stats Row + Period Badge    │   │
│                   │  └──────────────────────────────────────┘   │
│                   │                                              │
│                   │  ┌─ MODULE GRID (Windows Tiles) ─────────┐   │
│                   │  │ [Inv] [Pay] [Abs] [Upah] [Premi]...  │   │
│                   │  └──────────────────────────────────────┘   │
│                   │                                              │
│                   │  ┌─ PANELS ──────────────────────────────┐   │
│                   │  │ [Favorites] [Recent] [System Status] │   │
│                   │  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Dashboard Sections

### 3.1 Hero Banner
Full-width card di atas. Kiri: title "Report Center" + subtitle. Kanan: 3 stat pills (Total Reports, Modules, Last Sync).

**Visual:**
- Background: subtle gradient navy-to-slate
- Border: 1px slate-200, rounded-2xl
- Height: ~160px
- Margin bottom: 24px

### 3.2 Module Grid — Windows Tile Design

**9 Module Cards** dalam responsive grid (4 cols desktop → 3 tablet → 2 mobile):

```
┌─────────────────────────────────────────────┐
│ [ICON]  Title                    [COUNT]    │
│                                             │
│ Description text here...                    │
│                                             │
│ ─────────────────────────────────────────── │
│ metric              Open →                  │
└─────────────────────────────────────────────┘
```

**Visual specs per card:**
- White background, rounded-2xl (16px)
- Border: 1px slate-200
- Padding: 20px
- Hover: translateY(-4px) + shadow-lg + border-slate-400
- Icon: 48px circle, module color as background
- Title: text-xl, font-semibold, slate-950
- Count badge: bg-slate-950, text-white, px-2 py-1, top-right
- Description: text-sm, text-slate-600, line-clamp-2
- Footer: divider, metric (left) + status (right)
- Status: green text if unlocked, gray if locked

**9 Modules:**
| # | Name | Icon | Color | Reports | Metric |
|---|------|------|-------|---------|--------|
| 1 | Inventory | Package | #16A34A | 27 | 8 groups |
| 2 | Absensi | Calendar | #2563EB | 18 | coming next |
| 3 | Payroll | Wallet | #7C3AED | 24 | coming next |
| 4 | Daftar Upah | FileSpreadsheet | #EA8A13 | 15 | coming next |
| 5 | Premi & Lembur | Clock | #DC2626 | 12 | coming next |
| 6 | Produktivitas | TrendingUp | #0D9488 | 16 | coming next |
| 7 | Karyawan | Users | #DB2777 | 20 | coming next |
| 8 | Estate / Divisi | Map | #4F46E5 | 10 | coming next |
| 9 | Integrasi & Audit | Shield | #475569 | 14 | coming next |

Only **Inventory** is unlocked (active). Others show "Locked" badge.

### 3.3 Bottom Panels (3-column row)

**Left: Favorites Panel**
- Title "Favorites"
- List of starred reports (max 5)
- Empty state: "No favorites yet. Star a report to see it here."
- Click → navigate to report

**Center: Recent Reports Panel**
- Title "Recent"
- Last 5 viewed reports with timestamp
- Empty state: "No recent reports. Open a report to start tracking."
- Click → navigate to report

**Right: System Info Panel**
- Database: "Connected ✓"
- Last Sync: timestamp
- Server: SPROFILE_1
- User: current user name
- Compact card, no interactive

### 3.4 Sidebar Navigation

```
┌────────────────────────┐
│ [LOGO] Report Center   │
├────────────────────────┤
│ UTAMA                  │
│  ◇ Dashboard    (Home) │
│  ◇ All Reports         │
│  ◇ Favorites           │
│  ◇ Recent              │
├────────────────────────┤
│ MODUL                  │
│  ▸ Inventory    [27]   │
│  ▸ Absensi      [18]   │
│  ▸ Payroll      [24]   │
│  ▸ Daftar Upah  [15]   │
│  ▸ Premi        [12]   │
│  ▸ Produktivitas [16]   │
│  ▸ Karyawan     [20]   │
│  ▸ Estate       [10]   │
│  ▸ Integrasi    [14]   │
├────────────────────────┤
│ ADMINISTRASI           │
│  ◇ Export History      │
│  ◇ Settings            │
├────────────────────────┤
│ [Avatar] User Name     │
│   role                 │
└────────────────────────┘
```

- Width: 260px, collapsible to 64px (icon only)
- Background: #071426 (dark navy)
- Text: white/slate-300
- Active item: green left border + green text
- Hover: bg-navy-800
- Section headers: uppercase, text-xs, text-slate-500, tracking-widest

### 3.5 Topbar

```
┌────────────────────────────────────────────────────────────────┐
│ [≡]  Dashboard / Modules / Inventory                           │
│      [🔍 Search reports... Ctrl+K]        [Periode] [DB] [👤]  │
└────────────────────────────────────────────────────────────────┘
```

- Background: #0B1D35
- Height: 64px
- Breadcrumb: white/slate-300
- Search bar: centered, rounded-full, bg-navy-800, placeholder "Cari laporan..."
- Ctrl+K hint badge
- Right: status badges (Periode: 2026-05, DB: connected) + user avatar

---

## 4. Inventory Module Page

### 4.1 Layout

```
┌────────────────────────────────────────────────────────┬──────────┐
│ MODULE CONTENT (flex-1)                                │ PREVIEW  │
│                                                        │ PANEL    │
│ ┌─ Module Header ────────────────────────────────┐     │ (400px)  │
│ │ [Package] Inventory          27 Reports       │     │          │
│ │ 8 Groups  |  10 need attention               │     │ Selected │
│ └───────────────────────────────────────────────┘     │ Report   │
│                                                        │ Preview  │
│ ┌─ Filter Bar ──────────────────────────────────┐     │          │
│ │ [LocCode ▼] [Category ▼] [Period ▼]  [Clear]  │     │ Columns  │
│ └───────────────────────────────────────────────┘     │ preview  │
│                                                        │          │
│ ┌─ Group A: Stock Position ────────────────────┐     │ Summary  │
│ │ [A] Stock Position          4 reports   READ ONLY │     │ cards   │
│ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │     │          │
│ │ │INV-A1│ │INV-A2│ │INV-A3│ │INV-A4│        │     │ Actions  │
│ └───────────────────────────────────────────────┘     │          │
│                                                        │          │
│ ... (Groups B-H)                                       │          │
└────────────────────────────────────────────────────────┴──────────┘
```

### 4.2 Filter Bar
- LocCode dropdown (location/gudang)
- Category dropdown (from IN_PRODCAT: Chemical, Electrical, etc.)
- Period dropdown (AccYear + AccMonth)
- "Clear Filters" text button

### 4.3 Report Cards per Group
Each report card:
- Left: priority color border (CRITICAL=red, HIGH=orange, MEDIUM=amber, LOW=gray)
- Top: report ID badge + title
- Middle: description (2 lines max)
- Bottom: tags as small pills + metrics (primaryMetric + totalRows)
- Right side: star (favorite toggle) + arrow (view)

### 4.4 Preview Panel (Sticky Right)
400px wide, sticky. Shows when a report is selected:
1. Report title + status badge
2. Description
3. Key metrics (from mockData)
4. Column structure preview (table headers)
5. "Open Report →" button
6. "Export" dropdown (Excel, PDF, CSV)
7. Tags

---

## 5. Report Viewer Page

Full page view when opening a specific report:

```
┌──────────────────────────────────────────────────────────────────┐
│ [← Back]  INV-A1: Ringkasan Stok per Gudang        [Export ▼]  │
├──────────────────────────────────────────────────────────────────┤
│ ┌─ Filters ────────────────────────────────────────────────────┐│
│ │ [LocCode ▼] [Category ▼] [Period ▼]    [Apply] [Reset]        ││
│ └──────────────────────────────────────────────────────────────┘│
│ ┌─ Summary Cards ──────────────────────────────────────────────┐│
│ │ [Total Items] [Total Value] [Below Reorder] [Dead Stock]     ││
│ └──────────────────────────────────────────────────────────────┘│
│ ┌─ Data Table ─────────────────────────────────────────────────┐│
│ │ [Col1 ▲] [Col2 ▲] [Col3]  ← Sort                            ││
│ │ ─────────────────────────────────────────────────────────────││
│ │ Row 1 data...                                              ││
│ │ Row 2 data...                                              ││
│ └──────────────────────────────────────────────────────────────┘│
│ ┌─ Pagination ─────────────────────────────────────────────────┐│
│ │ Showing 1-20 of 50   [< Prev] [1] [2] [3] [Next >]         ││
│ └──────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Component Inventory

| Component | File | Description |
|-----------|------|-------------|
| `AppShell` | `components/layout/AppShell.tsx` | Main layout wrapper (Sidebar + Topbar + Content) |
| `Sidebar` | `components/layout/Sidebar.tsx` | Collapsible nav sidebar |
| `Topbar` | `components/layout/Topbar.tsx` | Header with breadcrumb + search |
| `HeroBanner` | `components/dashboard/HeroBanner.tsx` | Dashboard welcome banner |
| `ModuleCard` | `components/dashboard/ModuleCard.tsx` | Windows tile card for modules |
| `GlobalSearch` | `components/dashboard/GlobalSearch.tsx` | Ctrl+K search modal |
| `FilterBar` | `components/filters/FilterBar.tsx` | Module/report filter controls |
| `ReportListItem` | `components/reports/ReportListItem.tsx` | Report card with priority border |
| `PreviewPanel` | `components/reports/PreviewPanel.tsx` | Sticky preview sidebar |
| `SummaryCard` | `components/ui/SummaryCard.tsx` | KPI card |
| `DataTable` | `components/ui/DataTable.tsx` | Sortable paginated table |
| `ExportButton` | `components/actions/ExportButton.tsx` | Export dropdown |
| `FavoritesPanel` | `components/dashboard/FavoritesPanel.tsx` | Favorites list |
| `RecentPanel` | `components/dashboard/RecentPanel.tsx` | Recent reports list |
| `SystemInfoPanel` | `components/dashboard/SystemInfoPanel.tsx` | DB/server status |

---

## 7. Color Palette

```css
/* Sidebar/Topbar */
--navy-900: #071426;
--navy-800: #0B1D35;
--navy-700: #102A4C;

/* Accent */
--green-700: #167A3A;
--green-600: #1F8F46;

/* Page */
--bg: #F6F8FB;
--card: #FFFFFF;
--border: #E2E8F0;

/* Text */
--text-primary: #0F172A;
--text-secondary: #64748B;

/* Module Colors */
--blue: #2563EB;    /* Absensi */
--purple: #7C3AED;  /* Payroll */
--orange: #EA8A13;  /* Daftar Upah */
--green: #16A34A;   /* Inventory */
--red: #DC2626;     /* Premi */
--teal: #0D9488;    /* Produktivitas */
--pink: #DB2777;    /* Karyawan */
--indigo: #4F46E5;  /* Estate */
--gray: #475569;    /* Integrasi */

/* Priority */
--priority-critical: #DC2626;
--priority-high: #EA8A13;
--priority-medium: #D9A514;
--priority-low: #94A3B8;
```

---

## 8. State Management

**Zustand store** (`store/reportStore.ts`):
```typescript
{
  sidebarCollapsed: boolean;
  activeModule: string | null;
  selectedReportId: string | null;
  filters: Record<string, FilterValue>;
  pagination: { page: number; pageSize: number };
  sort: { column: string; direction: 'asc' | 'desc' };
  favorites: string[];      // report IDs
  recent: string[];         // report IDs (max 10)
  searchQuery: string;
}
```

**Persistence:** Zustand with `persist` middleware → localStorage.

---

## 9. Responsive Breakpoints

| Breakpoint | Grid cols | Sidebar | Notes |
|------------|-----------|---------|-------|
| < 640px | 1 | Collapsed | Mobile |
| 640-1024px | 2 | Collapsed | Tablet |
| 1024-1280px | 3 | Expanded | Small desktop |
| >= 1280px | 4 | Expanded | Large desktop |

---

## 10. Empty States

| Component | Empty State |
|-----------|-------------|
| Favorites | "No favorites yet. Star a report to see it here." + icon |
| Recent | "No recent reports. Open a report to start tracking." + icon |
| Search | "No reports found for '[query]'. Try different keywords." |
| Report Data | "No data for selected filters. Try adjusting the period or location." |
| Preview | "Select a report to see preview." + icon |

---

## 11. Animations & Transitions

| Element | Animation |
|---------|-----------|
| ModuleCard hover | `translateY(-4px)` + shadow increase, 200ms ease |
| Page transitions | Fade in, 150ms |
| Preview panel slide | Slide in from right, 250ms ease-out |
| Search modal | Fade + scale, 200ms |
| Sidebar collapse | Width transition, 300ms ease |
| Report card hover | Border color change, 150ms |

---

## 12. Accessibility

- All interactive elements keyboard navigable
- Focus visible indicators
- ARIA labels on icon buttons
- Color contrast >= 4.5:1
- Reduced motion via `prefers-reduced-motion`