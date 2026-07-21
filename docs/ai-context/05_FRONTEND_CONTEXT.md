---
name: 05-frontend-context
description: Frontend analysis and UI structure
metadata:
  type: documentation
  tags: [frontend, ui, react]
---

# Frontend Analysis

## Framework & Architecture

| Aspect | Technology | Version | Evidence |
|--------|------------|---------|----------|
| Framework | Next.js | 16.0.7 | `package.json` |
| Router | App Router | - | `app/` directory |
| Language | TypeScript | 5 | `tsconfig.json` |
| State | Zustand | 5.0.13 | `package.json` |
| Server State | TanStack Query | 5.100.10 | `package.json` |

## Page Structure

### Route Groups

| Route Group | Layout | Auth | Purpose |
|-------------|--------|------|---------|
| `(landing-page)` | Default | Public | Marketing landing |
| `(login)` | Default | Required | Authenticated pages |
| `(report-center)` | Default | Required | Report viewer |
| Without group | Root | Mixed | API routes, iFESS control |

### Pages

| Page | Path | Purpose |
|------|------|---------|
| Landing | `/` | Public landing page |
| Login | `/login` | User authentication |
| Admin Dashboard | `/admin` | Admin main dashboard |
| Executive | `/admin/executive` | Executive view |
| User Dashboard | `/dashboard` | User dashboard |
| Dashboard User | `/dashboard-user` | Alternative user view |
| Report Center | `/report-center` | Main report hub |
| Module Report | `/report-center/[module]` | Module-specific reports |
| Report Detail | `/report-center/inventory/[report]` | Single report view |
| Inventory Modules | `/modules/inventory` | Inventory module list |
| iFESS Control | `/ifess-control` | iFESS admin panel |

## Components

### Core Components

| Component | Location | Purpose |
|-----------|---------|---------|
| `ReportViewerClient` | `lib/reports/` | Generic report renderer |
| `ModulePanel` | `lib/reports/module-panel.ts` | Module selection UI |
| `ModuleConfig` | `lib/reports/config.ts` | Module definitions |

### Layout Components

| Component | Purpose |
|-----------|---------|
| `layout.tsx` | Root layout with providers |
| `providers.tsx` | React context providers |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 page |

## State Management

### Zustand Store

```typescript
// Example usage pattern
import { create } from 'zustand';

interface AppState {
  user: User | null;
  setUser: (user: User) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
```

### React Query Usage

```typescript
// Example query hook
const { data, isLoading, error } = useQuery({
  queryKey: ['reports', reportCode],
  queryFn: () => fetchReport(reportCode),
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

## API Client

### Auth API

```typescript
// POST /api/auth/login
const login = async (email: string, password: string) => {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};
```

### Report API

```typescript
// GET /api/reports/inventory
const fetchReports = async (params: ReportParams) => {
  const searchParams = new URLSearchParams(params);
  const res = await fetch(`/api/reports/inventory?${searchParams}`);
  return res.json();
};
```

## Styling

### Tailwind CSS

```tsx
// Example component
export function ReportCard({ report }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold">{report.name}</h3>
      <p className="text-gray-600">{report.description}</p>
    </div>
  );
}
```

### CSS Variables

```css
/* globals.css */
:root {
  --color-primary: #167A3A;
  --color-secondary: #2563EB;
}
```

## Loading & Error States

```tsx
// Standard loading state
if (isLoading) {
  return <div className="animate-pulse">Loading...</div>;
}

// Error state
if (error) {
  return <div className="text-red-500">Error: {error.message}</div>;
}
```

## Form Validation

Uses **Zod** for schema validation:

```typescript
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
```

## Key Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout |
| `app/providers.tsx` | Context providers |
| `lib/hooks/` | Custom React hooks |
| `lib/utils/auth.ts` | Auth utilities |

---

**Evidence**: `Dashboard_Utama/app/` directory, `package.json`
