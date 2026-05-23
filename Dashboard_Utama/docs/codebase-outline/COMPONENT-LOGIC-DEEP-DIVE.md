# Component Logic Deep Dive

**Document Version:** 1.0  
**Last Updated:** May 2026  
**Target Components:** Sidebar.tsx, Topbar.tsx, ModuleCard.tsx, GlobalSearch.tsx

---

## Table of Contents

1. [Sidebar.tsx](#1-sidebartsx)
2. [Topbar.tsx](#2-topbartsx)
3. [ModuleCard.tsx](#3-modulecardtsx)
4. [GlobalSearch.tsx](#4-globalsearchtsx)

---

## 1. Sidebar.tsx

**File Path:** `components/layout/Sidebar.tsx`  
**Total Lines:** 228  
**Framework:** Next.js (App Router) + Framer Motion + Zustand Store

### 1.1 Purpose

Navigation sidebar component providing:
- Brand header with PT REBINMAS JAYA logo
- Collapsible/expandable navigation groups (LAPORAN, ANALISIS & PERBANDINGAN, PENGELOLAAN)
- Responsive mobile drawer with overlay
- Logout functionality
- Sidebar collapse toggle

### 1.2 Imports

```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity, BarChart3, ChevronLeft, ChevronRight, Database,
  FileText, Grid2X2, HelpCircle, Home, LogOut, Menu,
  Settings, ShieldCheck, Star, X,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useReportStore } from '@/store/reportStore'
import { useAuth } from '@/components/AuthProvider'
```

### 1.3 Type Definitions

```typescript
type NavItem = {
  label: string      // Display text for navigation item
  subtitle: string   // Secondary description text
  href: string       // Target route path
  icon: React.ReactNode  // Lucide icon component
}

type NavGroup = {
  title?: string    // Optional group header (e.g., "LAPORAN")
  items: NavItem[]  // Array of navigation items
}
```

### 1.4 Constants

```typescript
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: 'Dashboard Report', subtitle: 'Ringkasan & akses cepat', href: '/report-center', icon: <Home size={18} /> },
    ],
  },
  {
    title: 'LAPORAN',
    items: [
      { label: 'Daftar Laporan', subtitle: 'Semua kategori laporan', href: '/report-center#modules', icon: <FileText size={18} /> },
      { label: 'Kategori Laporan', subtitle: 'Jelajahi berdasarkan kategori', href: '/report-center#modules', icon: <Grid2X2 size={18} /> },
      { label: 'Favorit Saya', subtitle: 'Laporan yang disimpan', href: '/report-center#favorites', icon: <Star size={18} /> },
    ],
  },
  {
    title: 'ANALISIS & PERBANDINGAN',
    items: [
      { label: 'Summary Report', subtitle: 'Rekap per divisi', href: '/report-center#modules', icon: <BarChart3 size={18} /> },
      { label: 'Wages Comparison', subtitle: 'Perbandingan upah', href: '/report-center#modules', icon: <ShieldCheck size={18} /> },
      { label: 'Dampak Report', subtitle: 'Analisis dampak', href: '/report-center#modules', icon: <Activity size={18} /> },
    ],
  },
  {
    title: 'PENGELOLAAN',
    items: [
      { label: 'Integrasi Data', subtitle: 'Status & sinkronisasi data', href: '/report-center#integration', icon: <Database size={18} /> },
      { label: 'Pengaturan', subtitle: 'Pengaturan laporan & akses', href: '/report-center#settings', icon: <Settings size={18} /> },
    ],
  },
]
```

### 1.5 State

```typescript
const Sidebar() {
  // Zustand store state (from @/store/reportStore)
  const { sidebarCollapsed, toggleSidebar } = useReportStore()
  
  // Auth state (from @/components/AuthProvider)
  const { logout } = useAuth()
  
  // Local state
  const [mobileOpen, setMobileOpen] = useState(false)
```

### 1.6 Hooks Used

```typescript
const pathname = usePathname()  // from 'next/navigation' - retrieves current route path
```

### 1.7 Component Functions

#### 1.7.1 `isActive(href: string): boolean`

**Purpose:** Determines if a navigation item is currently active based on the current pathname.

**Logic:**
- Splits href on `#` to get base path
- Returns `false` if href contains `#` (anchor links)
- For `/report-center`: exact match or trailing slash
- For other paths: `startsWith` match

**Code Snippet:**
```typescript
const isActive = (href: string) => {
  const path = href.split('#')[0]
  if (href.includes('#')) return false
  return path === '/report-center' ? pathname === '/report-center' || pathname === '/report-center/' : pathname.startsWith(path)
}
```

### 1.8 Event Handlers

#### 1.8.1 `toggleSidebar` Handler
```typescript
<button
  type="button"
  onClick={toggleSidebar}
  className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
>
  {sidebarCollapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} />Sembunyikan Menu</>}
</button>
```

#### 1.8.2 `logout` Handler
```typescript
<button
  type="button"
  onClick={() => logout?.()}
  className="flex h-[42px] w-full items-center justify-center gap-2 rounded-[10px] border border-white/15 text-sm font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
>
  <LogOut size={18} />
  {!sidebarCollapsed && 'Logout'}
</button>
```

#### 1.8.3 Mobile Close Handler
```typescript
<button
  type="button"
  onClick={() => setMobileOpen(false)}
  className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
  aria-label="Tutup sidebar"
>
  <X size={18} />
</button>
```

#### 1.8.4 Mobile Open Handler
```typescript
<button
  id="mobile-sidebar-opener"
  type="button"
  onClick={() => setMobileOpen(true)}
  className="hidden"
  aria-label="Buka sidebar"
>
  <Menu size={20} />
</button>
```

#### 1.8.5 Mobile Overlay Click Handler
```typescript
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  className="fixed inset-0 z-40 bg-slate-950/55 lg:hidden"
  onClick={() => setMobileOpen(false)}
/>
```

### 1.9 Animation Configurations

```typescript
// Desktop sidebar animation
<motion.aside
  animate={{ width: sidebarCollapsed ? 84 : 250 }}
  transition={{ duration: 0.18, ease: 'easeOut' }}
  className="hidden h-screen shrink-0 border-r border-[#102A4C] bg-[#071B34] lg:block"
>
  {navContent}
</motion.aside>

// Mobile drawer animation
<motion.aside
  initial={{ x: -290 }}
  animate={{ x: 0 }}
  exit={{ x: -290 }}
  transition={{ duration: 0.22, ease: 'easeOut' }}
  className="fixed inset-y-0 left-0 z-50 w-[288px] lg:hidden"
>
  {navContent}
</motion.aside>
```

### 1.10 Render Structure

```
<>
  ├── Desktop Sidebar (motion.aside) - lg:block, hidden on mobile
  │   └── navContent
  │       ├── Header (brand logo + company name)
  │       ├── Navigation (NAV_GROUPS mapped)
  │       │   └── Each group → items mapped to Link components
  │       └── Footer (help card + collapse toggle + logout + version)
  │
  ├── Mobile Drawer (AnimatePresence)
  │   ├── Backdrop overlay (motion.div)
  │   └── Mobile sidebar (motion.aside) - lg:hidden
  │
  └── Mobile Trigger Button (id="mobile-sidebar-opener")
       └── Hidden but programmatically clickable
</>
```

---

## 2. Topbar.tsx

**File Path:** `components/layout/Topbar.tsx`  
**Total Lines:** 160  
**Framework:** Next.js (App Router) + Local Storage Access

### 2.1 Purpose

Top navigation bar component providing:
- Page title and subtitle based on current route
- Global search input (Ctrl+K shortcut)
- User profile display with initials
- Notification bell indicator
- Language toggle (ID)
- Mobile menu trigger

### 2.2 Imports

```typescript
'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, ChevronLeft, Globe2, Menu, Search } from 'lucide-react'
import { usePathname } from 'next/navigation'
```

### 2.3 Type Definitions

```typescript
type UserProfile = {
  name?: string    // Display name from localStorage
  email?: string   // Email from localStorage
  role?: string    // Role from localStorage
}
```

### 2.4 Constants

```typescript
// Route to display label mapping
const LABELS: Record<string, string> = {
  inventory: 'Inventory',
  absensi: 'Absensi',
  payroll: 'Payroll',
  'daftar-upah': 'Daftar Upah',
  premi: 'Premi & Lembur',
  produktivitas: 'Produktivitas Kebun',
  karyawan: 'Karyawan',
  estate: 'Estate / Divisi',
  integrasi: 'Integrasi & Audit',
}
```

### 2.5 Utility Functions

#### 2.5.1 `roleLabel(role?: string): string`

**Purpose:** Normalizes and returns human-readable role label.

**Code Snippet:**
```typescript
function roleLabel(role?: string) {
  const normalized = String(role ?? '').trim().toLowerCase()
  const labels: Record<string, string> = {
    admin: 'Administrator',
    administrator: 'Administrator',
    kerani: 'Kerani',
    hr: 'HR Staff',
    payroll: 'Payroll Staff',
    mngr: 'Manager',
    manager: 'Manager',
    asisten: 'Asisten',
    mandor: 'Mandor',
    visitor: 'Visitor',
    superadmin: 'Super Administrator',
  }
  return labels[normalized] ?? (role ? String(role).trim() : 'Administrator')
}
```

#### 2.5.2 `readStoredUser(): UserProfile | null`

**Purpose:** Reads user profile from browser localStorage.

**Code Snippet:**
```typescript
function readStoredUser() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem('user')
    if (!raw) return null
    return JSON.parse(raw) as UserProfile
  } catch {
    return null
  }
}
```

#### 2.5.3 `displayName(user: UserProfile | null): string`

**Purpose:** Returns priority display name (name > email > role label).

**Code Snippet:**
```typescript
function displayName(user: UserProfile | null) {
  return user?.name || user?.email || roleLabel(user?.role)
}
```

#### 2.5.4 `initials(value: string): string`

**Purpose:** Generates initials from a name string (first letters of first two words).

**Code Snippet:**
```typescript
function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
  return value.slice(0, 2).toUpperCase()
}
```

#### 2.5.5 `pageTitle(pathname: string): [string, string]`

**Purpose:** Extracts title and subtitle from current route.

**Code Snippet:**
```typescript
function pageTitle(pathname: string) {
  if (pathname === '/report-center' || pathname === '/report-center/') return ['Dashboard Report', 'Pusat akses laporan perusahaan']
  const parts = pathname.replace('/report-center/', '').split('/').filter(Boolean)
  const last = parts[parts.length - 1]
  return [LABELS[last] ?? last?.replace(/-/g, ' ') ?? 'Dashboard Report', 'Pusat akses laporan perusahaan']
}
```

### 2.6 State

```typescript
const Topbar() {
  const pathname = usePathname()  // Current route
  const searchRef = useRef<HTMLInputElement>(null)  // Reference to search input
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null)  // Loaded from localStorage
  
  // Derived values
  const [title, subtitle] = pageTitle(pathname)
  const name = displayName(currentUser)
  const role = roleLabel(currentUser?.role)
```

### 2.7 Effects

#### 2.7.1 User Load + Keyboard Shortcut Effect

```typescript
useEffect(() => {
  // Load user from localStorage on mount
  setCurrentUser(readStoredUser())
  
  // Register Ctrl+K keyboard shortcut
  const handler = (event: KeyboardEvent) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      searchRef.current?.focus()  // Focus topbar search
      window.dispatchEvent(new CustomEvent('report-center-open-search'))  // Open global search
    }
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [])
```

### 2.8 Event Handlers

#### 2.8.1 `openSidebar` Handler

**Purpose:** Programmatically clicks hidden mobile sidebar opener button.

```typescript
const openSidebar = () => document.getElementById('mobile-sidebar-opener')?.click()

// Usage:
<button
  type="button"
  onClick={openSidebar}
  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
  aria-label="Buka sidebar"
>
  <Menu size={20} />
</button>
```

### 2.9 Render Structure

```
<header className="sticky top-0 z-30 flex h-[78px] shrink-0 items-center gap-4 border-b border-[#E2E8F0] bg-white px-4 text-slate-950 shadow-sm lg:px-7">
  ├── Mobile Menu Button (lg:hidden)
  │
  ├── Page Title Block
  │   ├── Hidden Back Button (ChevronLeft) - lg:grid
  │   └── Title + Subtitle (h1 + p)
  │
  ├── Search Input (md:flex, hidden on mobile)
  │   ├── Search Icon (absolute positioned)
  │   ├── Input Field with placeholder
  │   └── Keyboard shortcut hint (Ctrl + K)
  │
  └── User Actions Area (ml-auto)
      ├── Language Toggle (ID) - hidden sm:inline-flex
      ├── Notification Bell with green dot indicator
      └── User Profile Button
          ├── Initials Avatar (bg-green-600)
          └── Name + Role (hidden xl:block)
</header>
```

---

## 3. ModuleCard.tsx

**File Path:** `components/dashboard/ModuleCard.tsx`  
**Total Lines:** 128  
**Framework:** Next.js + Lucide React Icons

### 3.1 Purpose

Displays an intelligence module/report category with:
- Dynamic icon with accent color
- Accent color top border strip
- Live/Preview status badge
- Pin/Unpin functionality
- Report count display
- Primary chart information
- Insight summary on hover
- Navigation link to module route

### 3.2 Imports

```typescript
'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, Pin, PinOff } from 'lucide-react'
import { intelligenceModules, type IntelligenceModule } from '@/lib/reports/intelligence'
```

### 3.3 Exports

```typescript
export type Module = IntelligenceModule
export const MODULES = intelligenceModules
```

### 3.4 Type Definitions

```typescript
type ModuleCardProps = {
  module: IntelligenceModule        // Module data from intelligence config
  active?: boolean               // Whether card is active (default: false)
  pinned?: boolean              // Whether module is pinned (default: false)
  onPreview?: (module: IntelligenceModule) => void   // Preview click handler
  onPin?: (module: IntelligenceModule) => void       // Pin toggle handler
  className?: string            // Additional CSS classes
}
```

**IntelligenceModule Type** (from `@/lib/reports/intelligence`):
```typescript
type IntelligenceModule = {
  id: string
  name: string           // Display name
  description: string   // Full description
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>
  accent: string        // Hex color code for theming
  route: string         // Next.js route path
  primaryChart: string  // Primary visualization type
  reportCount: number  // Number of reports in module
  available: boolean   // Live vs Preview status
  insight: {
    summary: string     // Hover tooltip summary
  }
  tags: string[]       // Search tags
  groupTitle: string  // Group category
}
```

### 3.5 Component Function

```typescript
export default function ModuleCard({
  module,
  active = false,
  pinned = false,
  onPreview,
  onPin,
  className = '',
}: ModuleCardProps) {
  const Icon = module.icon
  
  return (
    <article
      onMouseEnter={() => onPreview?.(module)}
      className={[...]}
    >
      // ... content
    </article>
  )
}
```

### 3.6 Event Handlers

#### 3.6.1 `onPreview` Handler

Triggers on:
- Icon button click
- Title area click  
- Hover (onMouseEnter for preview tooltip)
- "Monitoring" button click

```typescript
// Icon button
<button
  type="button"
  onClick={() => onPreview?.(module)}
  className="grid h-14 w-14 place-items-center rounded-2xl text-white shadow-lg"
  style={{ backgroundColor: module.accent }}
  aria-label={`Lihat monitoring ${module.name}`}
>
  <Icon size={27} strokeWidth={1.8} />
</button>

// Title area
<button type="button" onClick={() => onPreview?.(module)} className="mt-5 min-w-0 flex-1 text-left">
  // ...
</button>

// Monitoring button
<button
  type="button"
  onClick={() => onPreview?.(module)}
  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
>
  Monitoring
</button>
```

#### 3.6.2 `onPin` Handler

Toggles pinned state with visual feedback.

```typescript
<button
  type="button"
  onClick={() => onPin?.(module)}
  className={[
    'grid h-8 w-8 place-items-center rounded-xl border transition',
    pinned
      ? 'border-amber-200 bg-amber-50 text-amber-600'
      : 'border-slate-200 bg-white text-slate-400 hover:text-amber-600',
  ].join(' ')}
  aria-label={pinned ? 'Unpin module' : 'Pin module'}
>
  {pinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
</button>
```

### 3.7 Render Structure

```
<article (with dynamic classes based on active/pinned state)
  ├── Accent Top Strip (height: 1.5, backgroundColor: module.accent)
  │
  ├── Header Row
  │   ├── Icon Button (grid, rounded-2xl, module.accent background)
  │   └── Status + Pin Row
  │       ├── Status Badge (Live/Preview)
  │       └── Pin Button (toggleable)
  │
  ├── Content Button (onPreview)
  │   ├── Title + Report Count Row
  │   └── Description (line-clamp-3)
  │
  ├── Primary Chart Info Box (rounded-2xl, bg-slate-50/80)
  │   ├── Label "Primary chart" + BarChart3 icon
  │   ├── Primary Chart Type (replace underscores with spaces)
  │   └── Hover summary text
  │
  └── Action Row (grid-cols-[1fr_auto])
      ├── Monitoring Button (if available: else disabled)
      └── Link Button (Buka Modul / Belum Real)
```

---

## 4. GlobalSearch.tsx

**File Path:** `components/dashboard/GlobalSearch.tsx`  
**Total Lines:** 231  
**Framework:** Next.js + Zustand + React Hooks

### 4.1 Purpose

Global search modal overlay for searching inventory reports:
- Triggered via Ctrl+K or external event
- Fuzzy search across title, code, description, tags, groupTitle
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Recent/recent results display when no query
- Favorite toggle for each result
- Auto-focus on open
- Backdrop with blur effect

### 4.2 Imports

```typescript
'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Search, X, FileText, ArrowRight, Star, StarOff } from 'lucide-react'
import { inventoryReports } from '@/lib/reports/inventory/config'
import { useReportStore } from '@/store/reportStore'
import { useRouter } from 'next/navigation'
```

### 4.3 Type Definitions

```typescript
type ReportEntry = typeof inventoryReports[number]
// Inferred from inventoryReports array export
```

### 4.4 State

```typescript
const GlobalSearch() {
  const router = useRouter()
  const { favorites, toggleFavorite } = useReportStore()
  
  const [open, setOpen] = useState(false)           // Modal visibility
  const [query, setQuery] = useState('')            // Search input value
  const [cursor, setCursor] = useState(0)            // Active result index
  const inputRef = useRef<HTMLInputElement>(null)     // Focus reference
```

### 4.5 Derived State

```typescript
const results: ReportEntry[] = query.trim().length === 0
  ? inventoryReports.slice(0, 10)                   // Show first 10 when empty
  : inventoryReports.filter((r) => {
      const q = query.toLowerCase()
      return (
        r.title.toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.groupTitle.toLowerCase().includes(q)
      )
    }).slice(0, 12)                                  // Show max 12 filtered results
```

### 4.6 Effects

#### 4.6.1 Ctrl+K Keyboard Shortcut Effect

```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      setOpen(true)
      setQuery('')
      setCursor(0)
    }
  }
  window.addEventListener('keydown', handler)
  
  const openFromTopbar = () => {
    setOpen(true)
    setQuery('')
    setCursor(0)
  }
  window.addEventListener('report-center-open-search', openFromTopbar)
  
  return () => {
    window.removeEventListener('keydown', handler)
    window.removeEventListener('report-center-open-search', openFromTopbar)
  }
}, [])
```

#### 4.6.2 Auto-Focus Effect

```typescript
useEffect(() => {
  if (open) {
    setTimeout(() => inputRef.current?.focus(), 50)
  }
}, [open])
```

### 4.7 Event Handlers

#### 4.7.1 `handleKeyDown` Handler

**Purpose:** Handles keyboard navigation inside modal.

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    setCursor((c) => Math.min(c + 1, results.length - 1))
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    setCursor((c) => Math.max(c - 1, 0))
  } else if (e.key === 'Enter' && results.length > 0) {
    e.preventDefault()
    const item = results[cursor]
    if (item) navigateTo(item)
  } else if (e.key === 'Escape') {
    setOpen(false)
  }
}, [results, cursor])
```

#### 4.7.2 `navigateTo` Handler

**Purpose:** Navigates to selected report and closes modal.

```typescript
const navigateTo = (report: ReportEntry) => {
  useReportStore.getState().addRecent(report.id)  // Add to recent reports
  router.push(`/report-center/inventory?report=${report.id}`)
  setOpen(false)
  setQuery('')
}
```

#### 4.7.3 `toggleFav` Handler

**Purpose:** Toggles favorite status without closing modal.

```typescript
const toggleFav = (e: React.MouseEvent, id: string) => {
  e.stopPropagation()
  toggleFavorite(id)
}
```

#### 4.7.4 `close` Handler

**Purpose:** Clars search state and closes modal.

```typescript
const close = () => {
  setOpen(false)
  setQuery('')
  setCursor(0)
}
```

### 4.8 Render Structure

```
if (!open) return null

<div> (backdrop - fixed inset-0 z-50)
  <div> (modal - w-full max-w-2xl)
    ├── Search Input Row
    │   ├── Search Icon
    │   ├── Input Field (ref: inputRef)
    │   ├── Clear Button (X icon, visible when query)
    │   └── ESC hint (kbd)
    │
    ├── Results Container (max-h-96 overflow-y-auto)
    │   └── if results.length === 0
    │       └── No Results Message
    │   └── else
    │       └── <ul role="listbox">
    │           └── {results.map((report, idx) => {
    │               // Each result item with:
    │               // - FileText icon
    │               // - Code + Title
    │               // - Group subtitle
    │               // - Tags (lg: flex)
    │               // - Favorite toggle button
    │               // - ArrowRight icon
    │           })}
    │
    └── Footer Hints (keyboard shortcuts)
        ├── ↑↓ navigate
        ├── ↵ open
        └── ESC close
</div>
```

### 4.9 Key Features

| Feature | Implementation |
|---------|----------------|
| Search Trigger | Ctrl+K from anywhere + `report-center-open-search` custom event |
| Empty State | Shows first 10 inventoryReports |
| Filtering | title, code, description, tags, groupTitle (case-insensitive) |
| Max Results | 10 empty query, 12 filtered |
| Keyboard Nav | ArrowUp/ArrowDown cursor, Enter select, Escape close |
| Auto-focus | 50ms delay after open |
| Recent Tracking | Adds to recent via store on navigation |
| Favorites | Toggle via store, persists |
| Accessibility | role="dialog", aria-modal, aria-label, aria-selected |

---

## Summary

| Component | Purpose | Key States | Key Handlers |
|-----------|---------|------------|--------------|
| **Sidebar** | Navigation, collapsible | `sidebarCollapsed`, `mobileOpen` | `toggleSidebar`, `logout`, `setMobileOpen` |
| **Topbar** | Page header, search trigger | `currentUser` | `openSidebar`, Ctrl+K |
| **ModuleCard** | Module display | `active`, `pinned` | `onPreview`, `onPin` |
| **GlobalSearch** | Report search modal | `open`, `query`, `cursor` | `handleKeyDown`, `navigateTo`, `toggleFav`, `close` |

**Shared Dependencies:**
- `@/store/reportStore` (Zustand) - sidebar state, favorites, recent
- `lucide-react` - icons
- `next/navigation` - routing
- `framer-motion` - (Sidebar only) animations

---

*End of Component Logic Deep Dive*