# Component Logic Documentation

## 1. Layout Components

### Sidebar.tsx

#### Location
```
components/layout/Sidebar.tsx
(~250 lines)
```

#### Structure
```tsx
<nav className="sidebar">
  {/* Logo */}
  <Logo />
  
  {/* Navigation Groups */}
  <NavGroup title="UTAMA">
    <NavItem icon="Home" label="Dashboard" href="/report-center" />
  </NavGroup>
  
  <NavGroup title="LAPORAN">
    <NavItem icon="FileText" label="All Reports" />
    <NavItem icon="Star" label="Favorites" />
    <NavItem icon="Clock" label="Recent" />
  </NavGroup>
  
  <NavGroup title="MODUL">
    {MODULE_CONFIGS.map(m => (
      <NavItem icon={m.icon} label={m.name} count={m.reportCount} />
    ))}
  </NavGroup>
  
  <NavGroup title="ADMINISTRASI">
    <NavItem icon="Download" label="Export History" />
    <NavItem icon="Settings" label="Settings" />
  </NavGroup>
  
  {/* Footer */}
  <CollapseButton />
</nav>
```

#### Props & State
```typescript
interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

const { sidebarCollapsed, toggleSidebar } = useReportStore();
```

#### Styles
- Background: #071426 (navy-900)
- Width: 260px (expanded), 72px (collapsed)
- Animation: 200ms ease

---

### Topbar.tsx

#### Location
```
components/layout/Topbar.tsx
(~200 lines)
```

#### Structure
```tsx
<header className="topbar">
  {/* Left: Title */}
  <Title>
    <h1>Report Center</h1>
    <span>Pusat Akses Laporan</span>
  </Title>
  
  {/* Center: Search */}
  <GlobalSearch 
    placeholder="Cari laporan..."
    shortcut="Ctrl+K"
  />
  
  {/* Right: Badges & Profile */}
  <Badge label="Periode: Mei 2026" />
  <Badge label="Divisi: DME" />
  <NotificationBell count={2} />
  <UserProfileDropdown user={currentUser} />
</header>
```

#### State
```typescript
const [query, setQuery] = useState('');
const [showSearch, setShowSearch] = useState(false);
const [notifications, setNotifications] = useState(0);
const [user, setUser] = useState(null);
```

---

## 2. Dashboard Components

### HeroBanner.tsx

#### Location
```
components/dashboard/HeroBanner.tsx
```

#### Purpose
Hero section with title, description, system status widget

#### Props
```typescript
interface HeroBannerProps {
  title: string;
  subtitle?: string;
  description?: string;
  systemStatus?: {
    database: 'online' | 'offline';
    integration: 'connected' | 'disconnected';
    lastSync: string;
  };
}
```

---

### GlobalSearch.tsx

#### Location
```
components/dashboard/GlobalSearch.tsx
```

#### Functionality
- Ctrl+K shortcut to focus
- Debounced search (300ms)
- Recent searches dropdown
- Tag suggestions

#### State
```typescript
const [query, setQuery] = useState('');
const [showDropdown, setShowDropdown] = useState(false);
const [recent, setRecent] = useState([]);
```

---

### ModuleCard.tsx

#### Location
```
components/dashboard/ModuleCard.tsx
```

#### Props
```typescript
interface ModuleCardProps {
  module: ModuleConfig;
  reportCount: number;
  isActive?: boolean;
  onClick?: () => void;
  onFavorite?: () => void;
}
```

#### Visual
- Windows tile aesthetic
- 280px min-width
- Module-specific color icon
- Report count badge
- Last updated timestamp

---

### ReportListItem.tsx

#### Props
```typescript
interface ReportListItemProps {
  report: ReportConfig;
  onView?: () => void;
  onPreview?: () => void;
  onExport?: (format: string) => void;
}
```

#### Actions
- View → Navigate to report detail
- Preview → Open preview panel
- Export → Download Excel/PDF/CSV

---

### ReportPreviewPanel.tsx

#### Location
```
components/dashboard/ReportPreviewPanel.tsx
```

#### Props
```typescript
interface ReportPreviewPanelProps {
  report: ReportConfig;
  data?: ReportRow[];
  summary?: ReportSummary;
  onViewFull?: () => void;
  onExport?: (format: string) => void;
}
```

#### Features
- 380px width, sticky right
- Table preview (5 rows)
- Summary totals
- Metadata
- Action buttons

---

## 3. Component Communication

### Parent → Child
```typescript
// Parent passes props
<ReportListItem 
  report={report}
  onView={() => handleView(report.id)}
  onExport={(fmt) => handleExport(report.id, fmt)}
/>

// Child calls prop
function ReportListItem({ report, onView, onExport }) {
  return (
    <button onClick={onView}>View</button>
  );
}
```

### Child → Parent (callback)
```typescript
// Parent defines handler
const handleSelect = (reportId) => {
  setSelected(reportId);
  addRecent(reportId);
};

// Parent passes handler
<ReportList 
  onSelect={handleSelect}
/>

// Child calls it
function ReportList({ onSelect }) {
  return <div onClick={() => onSelect(id)} />;
}
```

### Shared State (Zustand)
```typescript
// Store defined
const useStore = create((set) => ({
  favorites: [],
  toggleFavorite: (id) => set(s => ({...s, favorites: toggle(s.favorites, id)}))
}));

// Any component can use
function Foo() {
  const { favorites, toggleFavorite } = useStore();
  return <button onClick={() => toggleFavorite(id)}>★</button>;
}

function Bar() {
  const { favorites } = useStore();
  return favorites.includes(id) ? '★' : '☆';
}
```

---

## 4. Component Patterns

### Container + Presentational
```typescript
// Container: data fetching, state
function ReportListContainer({ moduleId }) {
  const { data } = useQuery({ queryKey: ['reports', moduleId] });
  return <ReportList reports={data} />;
}

// Presentational: just UI
function ReportList({ reports }) {
  return reports.map(r => <ReportListItem report={r} />);
}
```

### Error Boundary
```typescript
function ErrorBoundary({ children }) {
  try {
    return children;
  } catch (err) {
    return <ErrorDisplay error={err} />;
  }
}
```

### Loading State
```typescript
function ReportPage({ isLoading }) {
  if (isLoading) return <Skeleton />;
  return <ReportContent />;
}
```

---

## 5. Key Imports

### From Components
```typescript
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { HeroBanner } from '@/components/dashboard/HeroBanner';
import { GlobalSearch } from '@/components/dashboard/GlobalSearch';
import { ModuleCard } from '@/components/dashboard/ModuleCard';
```

### From Lib
```typescript
import { MODULE_CONFIGS, getModuleConfig } from '@/lib/reports/config';
import { useReportStore } from '@/store/reportStore';
```

---

## 6. Directory Structure

```
components/
├── layout/
│   ├── Sidebar.tsx       # Main nav
│   └── Topbar.tsx       # Top nav
├── dashboard/
│   ├── HeroBanner.tsx    # Hero section
│   ├── GlobalSearch.tsx   # Search input
│   ├── ModuleCard.tsx   # Module tiles
│   ├── ReportListItem.tsx
│   ├── ReportPreviewPanel.tsx
│   └── ... (more)
└── ui/
    ├── Button.tsx
    ├── Input.tsx
    ├── Select.tsx
    └── ...
```
