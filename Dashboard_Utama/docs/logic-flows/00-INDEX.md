# LOGIC & FLOWS - Complete Documentation

**Project:** PT Rebinmas Jaya Report Center  
**Location:** D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/docs/logic-flows/

---

## Table of Contents

| File | Description |
|------|-------------|
| [01-PAGE-LOGIC.md](./01-PAGE-LOGIC.md) | Page-level logic and flows |
| [02-API-LOGIC.md](./02-API-LOGIC.md) | API endpoints and SQL queries |
| [03-STATE-LOGIC.md](./03-STATE-LOGIC.md) | State management (Zustand + React Query) |
| [04-COMPONENT-LOGIC.md](./04-COMPONENT-LOGIC.md) | Component structure and patterns |

---

## Quick Reference

### User Journey

```
1. User opens http://localhost:3001/
   ↓
2. Landing page loads (static, no API)
   ↓
3. User clicks "Masuk ke Report Center"
   ↓
4. Navigate to /report-center
   ↓
5. Report Center loads
   - Sidebar + Topbar mount
   - Fetch system status
   - Fetch inventory data
   ↓
6. User searches (Ctrl+K or type)
   - Query stored in state
   - Filter modules
   ↓
7. User clicks module (e.g., Inventory)
   - Navigate to /report-center/inventory
   - Fetch reports for module
   ↓
8. User clicks report
   - Preview panel shows
   - Show top 5 rows
   ↓
9. User clicks "Lihat Laporan"
   - Full page view
   - Filter options
   - Data table with pagination
   ↓
10. User exports (Excel/PDF/CSV)
    - Request queued
    - Download triggers
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────┐
│             CLIENT (Browser)                      │
├─────────────────────────────────────────────────────┤
│  Page Component (e.g., ReportsCenterPage)    │
│    │                                       │
│    ├── useState (local UI state)             │
│    ├── useEffect (side effects)            │
│    └── useMemo (derived)                  │
│         │                               │
│         ↓                               │
│    useQuery (React Query)                 │
│    │  (TanStack Query)                   │
│    ↓                                   │
│  fetch('/api/reports/...')              │
└──────────────┬──────────────────────────────┘
               │ HTTP
               ↓
┌──────────────────────────────────────────────────────┐
│            API ROUTE                         │
│  (Next.js Route Handler)                    │
├──────────────────────────────────────────────────┤
│  app/api/reports/inventory/route.ts         │
│    │                                   │
│    ├── Validate params                   │
│    ├── Build SQL                      │
│    │  (select handler function)         │
│    │  executes SQL query              │
│    ↓                               │
│  HTTP POST to SQL Gateway            │
│  ├─ URL: http://localhost:8001/v1/query│
│  ├─ Header: x-api-key               │
│  └─ Body: { query, params, database } │
└──────────────┬──────��───────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│          SQL GATEWAY                       │
│  (Express Service)                      │
├──────────────────────────────────────────────────────┤
│  Query validation                   │
│  Execute on MSSQL                  │
│  Return results                   │
└──────────────┬──────────────────────────────┘
               │
               ↓
┌──────────────────────────────────────────────────────┐
│          MSSQL DATABASE                   │
│  (db_ptrj / db_ptrj_mill)               │
├──────────────────────────────────────────────────────┤
│  IN_ITEM (7,483 rows)                │
│  IN_STOCKISSUELN (119,603 rows)         │
│  IN_STOCKISSUE (72,244 rows)        │
│  IN_MTHENDITEM (103,742 rows)      │
│  ... (more tables)                 │
└──────────────────────────────────────────────────────┘
```

### State Flow

```
1. User Action
   ↓
2. Event Handler (onClick, onChange)
   ↓
3. Update State
   └─ useState → setState(value)
   └─ useStore → action(value)
   ↓
4. Trigger Effect (if needed)
   └─ useEffect → API call
   ↓
5. API Call (fetch/axios)
   ↓
6. Response (data/error)
   ↓
7. Update UI
   └─ useQuery → cache update
   └─ setState → re-render
   ↓
8. Persistence (optional)
   └─ localStorage (via Zustand persist)
```

### API Endpoints Matrix

| Endpoint | Method | Params | Returns |
|----------|--------|-------|---------|
| /api/reports/inventory | GET | report, source, limit | Reports |
| /api/reports/system-status | GET | source | Status |
| /api/reports/ai-insight | GET | - | AI recommendations |
| /api/reports/natural-filter | GET | query | Parsed filters |
| /api/auth/login | POST | email, password | Token + user |
| /api/auth/logout | POST | - | Success |
| /api/auth/verify | GET | (cookie) | User |

### Key Files

| File | Purpose |
|------|---------|
| app/page.tsx | Landing page |
| app/report-center/page.tsx | Report dashboard |
| app/report-center/layout.tsx | App shell |
| app/report-center/[module]/page.tsx | Dynamic module |
| app/api/reports/inventory/route.ts | Inventory API |
| store/reportStore.ts | Zustand store |
| lib/reports/config.ts | Module registry |
| components/layout/Sidebar.tsx | Navigation |
| components/layout/Topbar.tsx | Top bar |

### Testing Commands

```bash
# Check server
curl http://localhost:3001/

# Test API
curl http://localhost:3001/api/reports/inventory

# Test system status
curl http://localhost:3001/api/reports/system-status?source=estate

# Test with report
curl "http://localhost:3001/api/reports/inventory?report=stok-gudang&limit=10"
```

---

## Related Documentation

- [PROJECT-DOCUMENTATION.md](../PROJECT-DOCUMENTATION.md) - Complete project overview
- [ARCHITECTURE-DOCUMENTATION.md](../ARCHITECTURE-DOCUMENTATION.md) - Architecture details

---

**End of Logic & Flows Overview**
