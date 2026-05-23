# PAGE-LOGIC-DEEP-DIVE.md - PT Rebinmas Jaya Dashboard

## Overview
This document provides a detailed line-by-line analysis of the key pages in the PT Rebinmas Jaya Dashboard application.

---

## 1. Home Page (`app/page.tsx`)

### Summary
- **Type**: Static Server Component (default export)
- **Purpose**: Landing page showcasing company information
- **Total Lines**: 699 (truncated to first 200 for this analysis)

### Page Flow
```
Home Page
├── Navbar (imported component)
├── HeroSection (imported component)
├── Kilasan Perusahaan Section (static company overview)
├── Tentang Kami Section (about + vision/mission)
├── Operasional Section (3 estates + map + quality standards)
└── [Additional sections continue after line 200]
```

### Key Sections Documented (Lines 1-200)

#### 1.1 Imports (Lines 1-4)
```tsx
import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import SatelliteMap from '@/components/SatelliteMapWrapper'
import { MapPin, Phone, Mail, Building2, Factory, Leaf, Users, Award, TreePine, Heart, Globe, Shield, Newspaper, ExternalLink, PlayCircle } from 'lucide-react'
```
- Uses path alias `@/` for components
- Imports icon set from lucide-react library

#### 1.2 Main Component (Lines 6-9)
```tsx
export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <HeroSection />
```
- Server component (no 'use client' directive)
- Main container with gray-50 background

#### 1.3 Kilasan Perusahaan Section (Lines 12-23)
- Static company quote/overview section
- No data fetching - hardcoded content
- Company mission statement about palm oil plantation business

#### 1.4 Tentang Kami Section (Lines 25-112)
Contains two main subsections:

**Profil Perusahaan (Lines 34-69)**
- Company profile text
- Image background with gradient overlay
- Location info: Jakarta (headquarters), Belitung & Belitung Timur (operational bases)

**Visi & Misi (Lines 72-110)**
- Visi: Quality CPO and Kernel production with professional management
- Misi: 4 bullet points covering environment, quality, continuous improvement, community responsibility

#### 1.5 Operasional Section (Lines 114-199)

**Three Estate Cards (Lines 123-167)**:

1. **Parit Gunung Estate**
   - Location: Kecamatan Badau, Belitung
   - Blocks: 1A, 1B, 2A, 2B

2. **Air Ruak Estate**
   - Location: Kabupaten Belitung Timur
   - Blocks: ARE A, ARE B1, ARE B2, ARE C

3. **Darul Makmur Estate**
   - Location: Kabupaten Belitung
   - Blocks: Air Raya, Kandis, Cendong

**Satellite Map (Lines 170-176)**
- `SatelliteMap` component displays operational locations
- Uses imported SatelliteMapWrapper component

**Standar Kualitas (Lines 178-197)**
- GAP Certified, High Yield TBS, Quality CPO, ISPO Compliant badges

### Data Fetching
- **None** - This is a static marketing/information page
- All content is hardcoded in the component

### User Interactions
- Navigation via Navbar component (links to sections)
- Scroll-based section navigation
- Responsive design (grid layouts)

---

## 2. Report Center Page (`app/report-center/page.tsx`)

### Summary
- **Type**: Client Component ('use client' directive)
- **Purpose**: Main dashboard for viewing reports across multiple modules
- **Total Lines**: 1183 (truncated to first 300 for this analysis)
- **Dependencies**: Zustand store, API calls, Framer Motion

### Page Flow
```
ReportsCenter Page
├── Module Tiles Grid (Inventory, Payroll, Absensi, etc.)
├── Quick Filters (Bulan Ini, Bulan Lalu, Q2 2026, etc.)
├── Report Source Toggle (Estate vs Pabrik)
├── System Status Panel
├── Search Component (GlobalSearch)
└── [Report Display Area - continues after line 300]
```

### Key Components Documented (Lines 1-300)

#### 2.1 Imports (Lines 1-44)
```tsx
'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
// lucide-react icons
// Components
import GlobalSearch from '@/components/dashboard/GlobalSearch'
// Reports lib
import { liveInventoryReports } from '@/lib/reports/inventory/config'
import { createInventoryInsightFromPayload, hasInventoryQueryData } from '@/lib/reports/inventory/monitoring'
import type { InsightContent } from '@/lib/reports/intelligence'
// Store
import { useReportStore } from '@/store/reportStore'
```

#### 2.2 Type Definitions (Lines 46-105)

**ModuleId Type** (Lines 46-56)
```tsx
type ModuleId =
  | 'inventory'
  | 'payroll'
  | 'daftar-upah'
  | 'absensi'
  | 'premi'
  | 'lembur'
  | 'produktivitas'
  | 'summary'
  | 'wages'
  | 'dampak'
```

**ModuleTile Type** (Lines 68-79)
```tsx
type ModuleTile = {
  id: ModuleId
  name: string
  description: string
  reportCount: number
  status: string
  icon: LucideIcon
  color: string
  soft: string
  available: boolean
  sparkline: number[]
}
```

**SystemStatus Type** (Lines 87-105)
```tsx
type SystemStatus = {
  success?: boolean
  gatewayOnline?: boolean
  activeSource?: ReportSource
  activeServer?: string
  activeDatabase?: string
  activeConnected?: boolean
  activeHealthy?: boolean
  sources?: Array<{...}>
  checkedAt?: string
  error?: string
}
```

#### 2.3 Module Configuration (Lines 107-228)

**MODULES Array** - Defines all available modules:
| Module | Status | Available |
|--------|--------|-----------|
| Inventory | Query real aktif | TRUE |
| Payroll | Belum aktif | FALSE |
| Daftar Upah | Belum aktif | FALSE |
| Absensi | Belum aktif | FALSE |
| Produktivitas Kebun | Belum aktif | FALSE |
| Premi | Belumaktif | FALSE |
| Lembur | Belum aktif | FALSE |
| Summary Report | Belum aktif | FALSE |
| Wages Comparison | Belum aktif | FALSE |
| Dampak Report | Belum aktif | FALSE |

#### 2.4 Quick Filters (Line 230)
```tsx
const QUICK_FILTERS = ['Bulan Ini', 'Bulan Lalu', 'Q2 2026', 'YTD 2026', 'Semua Divisi', 'Semua Kebun']
```

#### 2.5 Report Sources (Lines 231-234)
```tsx
const REPORT_SOURCES = [
  { id: 'estate', label: 'Estate / Kebun', description: 'SERVER_PROFILE_2 / db_ptrj' },
  { id: 'pabrik', label: 'Pabrik', description: 'SERVER_PROFILE_3 / db_ptrj_mill' },
]
```

#### 2.6 Data Fetching Logic (Lines 236-244)

**fetchInventoryPayload Function**:
```tsx
async function fetchInventoryPayload(source: ReportSource) {
  const params = new URLSearchParams({ report: 'stok-gudang', limit: '80', source })
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: 'no-store' })
  const result = (await response.json()) as InventoryApiResponse
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'Gagal memuat real data inventory')
  }
  return result.data
}
```

**API Endpoint**: `/api/reports/inventory`
**Parameters**:
- `report`: 'stok-gudang'
- `limit`: '80'
- `source`: 'estate' or 'pabrik'

**Response Type**: `InventoryApiResponse`
```tsx
type InventoryApiResponse = {
  success: boolean
  data?: InventoryQueryPayload
  error?: string
}
```

#### 2.7 Utility Functions (Lines 246-301)

**toNumber** (Lines 246-253): Type coercion from string/number to number

**firstMetric** (Lines 255-261): Extract metric value from summary object

**formatMetric** (Lines 263-275): Format numbers for display (K, M, B suffixes for Indonesian locale)

**formatDateTime** (Lines 272-277): Format date strings to Indonesian locale format

**sourceLabel / sourceDescription** (Lines 279-285): Get label/description for report source

**normalizeSource** (Lines 287-289): Normalize source string to ReportSource type

**roleLabel** (Lines 291-300): Convert role string to display label

### Data Fetching

| Module | Endpoint | Status |
|--------|----------|--------|
| Inventory | `/api/reports/inventory?report=stok-gudang&limit=80&source={source}` | Active |
| Payroll | - | Not Active |
| Absensi | - | Not Active |
| others | - | Not Active |

### User Interactions
- Module tile clicks (navigation to specific reports)
- Quick filter selection (date period)
- Report source toggle (Estate/Pabrik)
- System status checks
- Search functionality via GlobalSearch component

---

## 3. Report Center Layout (`app/report-center/layout.tsx`)

### Summary
- **Type**: Client Component (layout with animations)
- **Purpose**: Shell layout withSidebar, Topbar, and content area
- **Total Lines**: 38

### Structure
```tsx
'use client'
import { motion } from 'framer-motion'
import Sidebar from '@/components/layout/Sidebar'
import Topbar from '@/components/layout/Topbar'
import { useReportStore } from '@/store/reportStore'

export default function ReportsCenterLayout({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed } = useReportStore()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />  {/* Fixed left sidebar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />  {/* Fixed top bar */}
        <motion.main  {/* Animated content area */}
          key={sidebarCollapsed ? 'collapsed' : 'expanded'}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 overflow-y-auto"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}
```

### Key Features
- **Sidebar**: Fixed left navigation from `@/components/layout/Sidebar`
- **Topbar**: Fixed top bar from `@/components/layout/Topbar`
- **State Management**: Uses `useReportStore` for sidebar collapsed state
- **Animations**: Framer Motion for smooth content transitions
- Animation triggers on sidebar state change (key changes)

### Data Fetching
- **None** - Purely presentational layout component

### User Interactions
- Sidebar toggle (controlled by reportStore)
- Smooth page transitions via Framer Motion

---

## 4. Login Page (`app/login/page.tsx`)

### Summary
- **Type**: Static Server Component
- **Purpose**: User authentication portal
- **Total Lines**: 81

### Page Flow
```
Login Page
├── Background Image (kebun sawit.webp)
├── Decorative Blur Shapes
├── Back to Home Link
├── Login Card Container
│   ├── Header with Logo
│   ├── Form Section with LoginForm
│   └── Footer with Copyright
└── Help Text
```

### Structure (Lines 1-81)

#### 4.1 Layout Container (Lines 7-18)
- Full viewport height: `min-h-screen`
- Centered content: `items-center justify-center`
- Background: Gradient from gray-900 to gray-900

#### 4.2 Background Elements (Lines 10-22)
- **Image Layer**: `/assets/kebun sawit.webp` with 20% opacity
- **Decorative Blur 1**: palm-green gradient, top-left
- **Decorative Blur 2**: golden-yellow gradient, bottom-right

#### 4.3 Navigation Link (Lines 25-31)
- Back to home link: `/`
- Glassmorphism style: `backdrop-blur-md`
- Icon: ArrowLeft from lucide-react

#### 4.4 Login Card (Lines 33-71)

**Header (Lines 36-51)**
- Logo container: Fixed circular (24x24), white border ring
- Image: `/assets/logo.webp` (80x80)
- Company name: "Portal Karyawan PT Rebinmas Jaya"

**Form Section (Lines 54-62)**
- Welcome text
- LoginForm component (from `@/components/LoginForm`)

**Footer (Lines 65-69)**
- Copyright text with dynamic year: `new Date().getFullYear()`

**Help Text (Lines 74-77)**
- Contact IT Support message

### Imports (Lines 1-4)
```tsx
import LoginForm from '@/components/LoginForm'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
```

### Data Fetching
- **None** - This is purely a presentation page
- Form handling is delegated to LoginForm component

### User Interactions
- Click "Beranda" link → Navigate to home (`/`)
- Fill login form → Submit credentials via LoginForm component
- (Login logic handled by imported LoginForm component)

---

## Summary: Page Comparison

| Page | Component Type | Data Fetching | State Management | Dynamic Content |
|------|---------------|---------------|------------------|------------------|
| Home | Server | None | None | Static |
| Report Center | Client | API calls | Zustand store | Active reports |
| Report Layout | Client | None | Zustand store | Layout only |
| Login | Server | None | None | Static form |

---

## Key Dependencies

### External Libraries
- `react` - Core React hooks (useState, useEffect, useMemo)
- `next/link` - Next.js routing
- `next/image` - Next.js image optimization
- `lucide-react` - Icon library
- `framer-motion` - Animations (layout.tsx only)
- `zustand` - State management (report center)

### Internal Components
- `@/components/Navbar`
- `@/components/HeroSection`
- `@/components/SatelliteMapWrapper`
- `@/components/dashboard/GlobalSearch`
- `@/components/layout/Sidebar`
- `@/components/layout/Topbar`
- `@/components/LoginForm`

### Internal Libraries
- `@/lib/reports/inventory/config`
- `@/lib/reports/inventory/monitoring`
- `@/lib/reports/intelligence`
- `@/store/reportStore`

---

## API Endpoints Used

| Endpoint | Parameters | Purpose |
|----------|------------|---------|
| `/api/reports/inventory` | `report`, `limit`, `source` | Fetch inventory data |

---

*Document generated from codebase analysis of PT Rebinmas Jaya Dashboard*