# State Management Documentation

## 1. Zustand Store (reportStore.ts)

### Location
```
store/reportStore.ts
```

### Middleware
- persist: localStorage with key 'report-center-storage'

### State Properties
```typescript
interface ReportStore {
  // UI State
  sidebarCollapsed: boolean;
  activeModule: string | null;
  selectedReportId: string | null;
  
  // Filter State
  filters: FilterConfig[];
  pagination: { page: number; pageSize: number };
  sort: { column: string; direction: 'asc' | 'desc' };
  
  // Data State
  favorites: string[];
  recent: string[];
  searchQuery: string;
}
```

### Actions
```typescript
// UI Actions
toggleSidebar: () => void;
setActiveModule: (moduleId: string) => void;
setSelectedReport: (reportId: string) => void;

// Filter Actions
setFilter: (filter: FilterConfig) => void;
clearFilters: () => void;
setPage: (page: number) => void;
setPageSize: (size: number) => void;
setSort: (column: string, direction: 'asc' | 'desc') => void;

// Data Actions
toggleFavorite: (reportId: string) => void;
addRecent: (reportId: string) => void;
setSearchQuery: (query: string) => void;
```

### Usage in Components
```typescript
import { useReportStore } from '@/store/reportStore';

function MyComponent() {
  const { favorites, toggleFavorite, recent, addRecent } = useReportStore();
  
  const handleSelect = (reportId) => {
    addRecent(reportId);
    toggleFavorite(reportId);
  };
}
```

### Persistence
- Key: 'report-center-storage'
- Storage: localStorage
- Persisted: favorites, recent, sidebarCollapsed
- Not persisted: activeModule, filters (session-only)

---

## 2. React Query (TanStack Query)

### Configuration
```typescript
// In app/providers.tsx
<QueryClientProvider>
  <QueryClient defaultOptions={{
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }} />
</QueryClientProvider>
```

### Custom Hooks (pattern)
```typescript
// hooks/useReports.ts
function useReports(moduleId: string) {
  return useQuery({
    queryKey: ['reports', moduleId],
    queryFn: () => fetchReports(moduleId),
  });
}

// hooks/useReportData.ts
function useReportData(reportId: string, filters: FilterConfig[]) {
  return useQuery({
    queryKey: ['report', reportId, filters],
    queryFn: () => fetchReportData(reportId, filters),
    enabled: !!reportId,
  });
}
```

### Query Keys
```typescript
['reports']                    // All reports
['reports', 'inventory']       // Inventory reports
['report', 'INV-A1', {...}] // Specific report data
['modules']                 // All modules
['system-status']           // System status
['search', 'query']        // Search results
```

### Caching Strategy
- Reports list: 5 min stale time
- Report data: 2 min stale time  
- System status: 30 sec stale time
- User data: no cache (always fetch)

---

## 3. Local State (useState)

### In report-center/page.tsx
```typescript
// Search & Filter
const [query, setQuery] = useState('');
const [activeFilter, setActiveFilter] = useState('Bulan Ini');

// Module Selection
const [activeModuleId, setActiveModuleId] = useState('inventory');

// Data Source
const [selectedSource, setSelectedSource] = useState('estate' | 'pabrik');

// User
const [currentUser, setCurrentUser] = useState(null);

// API Response
const [inventoryPayload, setInventoryPayload] = useState(null);
const [inventoryLoading, setInventoryLoading] = useState(false);
const [inventoryError, setInventoryError] = useState(null);

// System
const [systemStatus, setSystemStatus] = useState({ success: true });
```

---

## 4. URL State

### URL Parameters
```
/report-center?source=estate      → selectedSource
/report-center?filter=bulan-ini   → activeFilter
/report-center/inventory?report=INV-A1 → selectedReportId
```

### Reading URL Params
```typescript
useEffect(() => {
  const source = searchParams.get('source');
  if (source) setSelectedSource(source as 'estate' | 'pabrik');
}, [searchParams]);
```

---

## 5. Data Flow Summary

```
User Action
  ↓
Component State (useState)
  ↓
Event Handler
  ↓
Store Action (Zustand)
  ↓
API Call (fetch)
  ↓
React Query Cache
  ↓
UI Update
  ↓
localStorage (persist)
```

### Example: Toggle Favorite
```typescript
const { toggleFavorite } = useReportStore();

function handleFavorite(reportId) {
  toggleFavorite(reportId);  // → Zustand update
  // → Persisted to localStorage
  // → UI re-renders
}
```

### Example: Fetch Reports
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['reports', 'inventory'],
  queryFn: () => fetch('/api/reports/inventory').then(r => r.json()),
});

if (isLoading) return <Skeleton />;
return <ReportList data={data} />;
```
