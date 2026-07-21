---
name: 11-ui-ux-flow
description: User journey and UI states
metadata:
  type: documentation
  tags: [ui, ux, user-journey]
---

# UI/UX Flow

## User Journeys

### Journey 1: View Inventory Report

```
[Landing Page]
    │
    ▼ (Click "Login")
[Login Page] ── Fail ──► [Error Message]
    │
    │ Success
    ▼
[Dashboard] ── Navigate ──► [Report Center]
    │
    ▼ (Select "Inventory")
[Module List] ── Select ──► [Report Detail]
    │
    │ View Data
    ▼
[Report Viewer] ── Search ──► [Filtered Results]
    │
    │ Export
    ▼
[Excel/PDF Download]
```

### Journey 2: Admin iFESS Management

```
[Login] ── Admin credentials ──► [Admin Dashboard]
    │
    ▼ (Navigate)
[iFESS Control] ── View ──► [Client List]
    │
    │ View Details
    ▼
[Client Details] ── Commands ──► [Send Command]
    │
    │ Monitor
    ▼
[Heartbeat Monitor] ── Status ──► [Online/Offline Clients]
```

### Journey 3: Executive View

```
[Login] ── Executive credentials ──► [Executive Dashboard]
    │
    ▼
[KPI Overview] ── Drill Down ──► [Detailed Reports]
    │
    ▼
[Export Summary]
```

## Page States

### Login Page States

| State | UI | Action |
|-------|-----|--------|
| Default | Empty form | Enter credentials |
| Loading | Spinner | Wait for response |
| Error | Error message | Retry |
| Success | Redirect | Go to dashboard |

### Report Viewer States

| State | UI | Action |
|-------|-----|--------|
| Loading | Skeleton | Wait for data |
| Empty | "No data" message | Adjust filters |
| Data | Table with pagination | Browse, search, export |
| Error | Error message | Retry |

### iFESS Control States

| State | UI | Action |
|-------|-----|--------|
| Online | Green indicator | Normal |
| Offline | Red indicator | Check client |
| Pending Command | Badge | Send command |

## UI Components

### Navigation

| Component | Location | Purpose |
|-----------|---------|---------|
| Sidebar | Dashboard layout | Main navigation |
| Header | Page top | User menu, breadcrumbs |
| Breadcrumbs | Below header | Location path |

### Forms

| Component | Validation | Feedback |
|-----------|------------|----------|
| Login Form | Email, password required | Inline errors |
| Report Filters | Dynamic based on report | Apply/Clear buttons |
| Search | Real-time | Debounced search |

### Data Display

| Component | Purpose | Features |
|-----------|---------|----------|
| Table | Primary data view | Sort, paginate, resize columns |
| Card | Summary display | Key metrics |
| Chart | Visual data | Trends, comparisons |
| Export Button | Data export | XLSX, PDF formats |

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 640px | Single column |
| Tablet | 640-1024px | Two columns |
| Desktop | > 1024px | Full layout with sidebar |

## Error States

### Network Error
```
┌─────────────────────────────────────┐
│         ⚠️ Connection Error         │
│                                     │
│   Unable to connect to server.       │
│                                     │
│         [ Retry ]                   │
└─────────────────────────────────────┘
```

### Empty State
```
┌─────────────────────────────────────┐
│         📊 No Data Found            │
│                                     │
│   No results match your filters.    │
│   Try adjusting your search criteria.│
│                                     │
│         [ Clear Filters ]           │
└─────────────────────────────────────┘
```

### Loading State
```
┌─────────────────────────────────────┐
│         ⏳ Loading...               │
│                                     │
│   ████████████████░░░░  75%       │
│                                     │
└─────────────────────────────────────┘
```

## Accessibility

| Feature | Implementation |
|---------|----------------|
| Keyboard Navigation | Tabindex, Enter key support |
| Screen Reader | ARIA labels |
| Focus Indicators | Visible focus ring |
| Color Contrast | WCAG AA compliant |

---

**Evidence**: `app/` pages, `lib/reports/` components
