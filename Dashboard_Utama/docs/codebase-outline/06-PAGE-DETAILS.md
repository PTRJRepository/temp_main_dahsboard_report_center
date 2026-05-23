# PAGE DETAILS - Complete Page Documentation
# Dokumentasi Detail Halaman PT Rebinmas Jaya Report Center

**Location:** D:/Gawean Rebinmas/Main Dashboard/Dashboard_Utama/docs/codebase-outline/06-PAGE-DETAILS.md
**Generated:** May 18, 2026
**Based on:** Code scan results

---

## DAFTAR ISI

1. [Landing Page (/)](#1-landing-page--)
2. [Report Center (/report-center)](#2-report-center-report-center)
3. [Layout (Report Center Layout)](#3-layout-report-center-layout)
4. [Inventory Reports (/report-center/inventory)](#4-inventory-reports-report-centerinventory)
5. [Login Page (/login)](#5-login-page-login)

---

## 1. LANDING PAGE (/)

**File Path:** `app/page.tsx`
**Route:** `/` (root)
**Type:** Server Component (RSC)

### Deskripsi Halaman

Halaman landing PT Rebinmas Jaya yang menampilkan informasi perusahaan, operasional, dan berita terkini. Halaman ini bersifat informatif dan tidak memerlukan autentikasi.

### Komponen Utama

| Komponen | File | Fungsi |
|---------|------|--------|
| Navbar | `components/Navbar.tsx` | Navigasi utama dengan link ke section |
| HeroSection | `components/HeroSection.tsx` | Banner utama dengan judul |
| SatelliteMap | `components/SatelliteMapWrapper.tsx` | Peta lokasi operasional |

### Struktur Section Halaman

```
Landing Page (/)
├── Navbar
├── HeroSection
├── Kilasan Perusahaan
│   └── Quote perusahaan
├── Tentang Kami
│   ├── Profil Perusahaan
│   ├── Visi
│   └── Misi
├── Operasional
│   ├── Estates Grid (3 estate)
│   ├── Satellite Map
│   └── Standar Kualitas
├── Inovasi & Sistem Pendukung
│   └── 4 kartu inovasi
├── Keberlanjutan & CSR
│   ├── Komitmen Lingkungan (ISPO)
│   ├── Pemberdayaan Masyarakat
│   └── CSR & Bantuan Sosial
├── Berita & CSR
│   ├── News Cards (4 articles)
│   └── Video Section
└── Foto & Dokumentasi
    └── Gallery Grid
```

### Data yang Ditampilkan

- **Perusahaan Info:**
  - Nama: PT Rebinmas Jaya
  - Lokasi: Kepulauan Bangka Belitung
  - Bidang: Perkebunan & Pengolahan Kelapa Sawit

- **Estates:**
  - Parit Gunung Estate (Badau, Belitung)
  - Air Ruak Estate (Belitung Timur)
  - Darul Makmur Estate (Kabupaten Belitung)

- **Estatistik Statis:**
  - Jumlah laporan inventory: liveInventoryReports.length
  - Module status: "Query real aktif" untuk inventory

### User Interactions

| Interaksi | Aksi |
|----------|------|
| Navigation | Scroll ke section dengan anchor link (#id) |
| External Links | Buka link berita di tab baru |
| Back to Home | Dari login page link ke "/" |

### Tidak Ada API Calls

Halaman ini murni statis/tanpa data fetching. Semua informasi adalah hardcoded atau dari asset lokal.

### Rute Navigation

```
/ → Landing (current)
/login → Login Page
/dashboard → Dashboard (redirect jika tidak login)
/report-center → Report Center (redirect jika tidak login)
```

---

## 2. REPORT CENTER (/report-center)

**File Path:** `app/report-center/page.tsx`
**Route:** `/report-center`
**Type:** Client Component ('use client')

### Deskripsi Halaman

Halaman utama dashboard report center yang menampilkan overview semua module laporan yang tersedia. Hanya module Inventory yang aktif, module lain masih disabled.

### Komponen Utama

| Komponen | File | Import |
|---------|------|--------|
| GlobalSearch | `components/dashboard/GlobalSearch.tsx` | @/components/dashboard/GlobalSearch |
| ModuleTileCard | Local function | - |
| KpiCard | Local function | - |
| BarChartCard | Local function | - |
| LineChartCard | Local function | - |

### State Management

```typescript
// useState hooks
const [activeModule, setActiveModule] = useState<ModuleId>('inventory')
const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
const [source, setSource] = useState<ReportSource>('estate')

// useEffect - Fetch inventory data on mount
useEffect(() => {
  const loadInventoryData = async () => {
    const data = await fetchInventoryPayload(source)
    // Update charts dan KPI
  }
  loadInventoryData()
}, [source])
```

### Module Configuration

| Module | ID | Status | Report Count | API Active |
|--------|-----|--------|------------|-----------|
| Inventory | inventory | Active | liveInventoryReports.length | Yes |
| Payroll | payroll | Disabled | 24 | No |
| Daftar Upah | daftar-upah | Disabled | 15 | No |
| Absensi | absensi | Disabled | 18 | No |
| Produktivitas | produktivitas | Disabled | 16 | No |
| Premi | premi | Disabled | 12 | No |
| Lembur | lembur | Disabled | 5 | No |
| Summary Report | summary | Disabled | 9 | No |
| Wages Comparison | wages | Disabled | 6 | No |
| Dampak Report | dampak | Disabled | 5 | No |

### Data Fetching - Inventory Real-Time

```typescript
async function fetchInventoryPayload(source: ReportSource) {
  const params = new URLSearchParams({
    report: 'stok-gudang',
    limit: '80',
    source: source
  })
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, {
    cache: 'no-store'
  })
  const result = await response.json() as InventoryApiResponse
  if (!response.ok || !result.success || !result.data) {
    throw new Error(result.error ?? 'Gagal memuat real data inventory')
  }
  return result.data
}
```

### API Endpoints Called

| Endpoint | Method | Params | Purpose |
|----------|--------|--------|---------|
| `/api/reports/inventory` | GET | `report=stok-gudang&limit=80&source=estate\|pabrik` | Fetch real inventory data |
| `/api/reports/system-status` | GET | - | Check SQL Gateway status |

### KPI Cards Ditampilkan

| Label | Value Source | Icon |
|-------|------------|------|
| Total Item | payload.summary.TotalItem | Database |
| Total Gudang | payload.summary.TotalGudang | Warehouse |
| Nilai Persediaan | formatMetric(payload.summary.NilaiPersediaan) | Wallet |
| Item Minimum Stock | payload.summary.ItemMinimumStock | AlertTriangle |

### Chart Components

1. **BarChartCard - Stock Monitor**
   - Title: "Nilai Persediaan per Gudang"
   - Data: payload.chart (top 8 gudang)
   - Loading: Skeleton animation
   - Error: Alert message jika query gagal

2. **LineChartCard - Trend Analysis**
   - Title: "Item Bergerak vs Stok Nol"
   - Data: Aggregated trends
   - Fallback: Static placeholder jika loading/error

### User Interactions

| Interaksi | Aksi |
|----------|------|
| Click Module Tile | Update activeModule, fetch new data |
| Source Toggle | Switch antara estate/pabrik |
| Quick Filters Click | Apply filter (Belum implement) |
| Search Reports | Filter modulelist (belum implement) |

### Navigation Routes

```
/report-center → Current page
/report-center/inventory → Inventory Module
/report-center/inventory/[report-id] → Report Viewer
```

### Data Flow Diagram

```
+--------------------+     +-------------------+
| Load /report-center | --> | Fetch Inventory    |
+--------------------+     | Payload (API)     |
                          +--------+----------+
                                   |
                                   v
                          +----------------+
                          | Update State    |
                          | - payload      |
                          | - loading      |
                          | - error        |
                          +--------+-------+
                                   |
            +----------------------+----------------------+
            |                      |                      |
            v                      v                      v
     +-------------+       +-------------+         +-------------+
     | KPI Cards   |       | Bar Charts |       | Line Charts |
     +-------------+       +-------------+         +-------------+
```

---

## 3. LAYOUT (Report Center Layout)

**File Path:** `app/report-center/layout.tsx`
**Route:** `/report-center` (layout wrapper)
**Type:** Client Component ('use client')

### Deskripsi Layout

Layout wrapper untuk semua halaman di bawah route `/report-center`. Menyediakan struktur sidebar + topbar + content area.

### Struktur Layout

```
ReportCenterLayout
├── Sidebar (fixed left)
│   ├── Logo
│   ├── Navigation Menu
│   └── Collapse Toggle
├── Topbar (fixed top)
│   ├── Page Title
│   ├── User Menu
│   └── Quick Actions
└── Main Content
    └── {children}
    (animated with framer-motion)
```

### Komponen Layout

| Komponen | File | type |
|---------|------|------|
| Sidebar | `components/layout/Sidebar.tsx` | Client |
| Topbar | `components/layout/Topbar.tsx` | Client |
| Motion | framer-motion | Library |

### State Management - via Zustand

```typescript
import { useReportStore } from '@/store/reportStore'

export default function ReportsCenterLayout({ children }) {
  const { sidebarCollapsed } = useReportStore()
  // Sidebar state dari global store
}
```

### Sidebar Features

- **Collapsible:** toggle dengan sidebarCollapsed state
- **Navigation Items:**
  - Dashboard (/report-center)
  - Inventory (/report-center/inventory)
  - Payroll module (disabled)
  - Andere modules (disabled)
- **Active State:** Highlight berdasarkan current route

### Topbar Features

- **Dynamic Title:** Berdasarkan route aktif
- **User Profile:** Dari localStorage user object
- **Logout Button:** Clear auth + redirect ke /login

### Animation

```typescript
<motion.main
  key={sidebarCollapsed ? 'collapsed' : 'expanded'}
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2, ease: 'easeOut' }}
  className="flex-1 overflow-y-auto"
>
  {children}
</motion.main>
```

### CSS Classes

```css
.flex h-screen overflow-hidden bg-slate-50
  ↓
.flex-1 flex-col overflow-hidden
  ↓
.flex-1 overflow-y-auto (content)
```

### Protected Routes

Semua halaman di bawah `/report-center` memerlukan autentikasi. Cek via:

```typescript
// middleware.ts or client-side check
const user = readStoredUser() // dari localStorage
if (!user) {
  window.location.href = '/login'
}
```

---

## 4. INVENTORY REPORTS (/report-center/inventory)

**File Path:** 
- `app/report-center/inventory/page.tsx` (wrapper)
- `app/report-center/inventory/InventoryReportsClient.tsx` (main component)

**Route:** `/report-center/inventory`
**Type:** Client Component ('use client')

### Deskripsi Halaman

Halaman module inventory yang menampilkan list semua laporan inventory. Hanya module yang aktif dengan real-time data dari SQL Gateway.

### List Reports Configuration

Jumlah laporan: liveInventoryReports.length (dynamic dari config)

### Main Component State

```typescript
const [selectedReportId, setSelectedReportId] = useState(initialReport)
const [selectedSource, setSelectedSource] = useState<ReportSource>(initialSource)
const [search, setSearch] = useState('')
const [statusFilter, setStatusFilter] = useState('Semua Status')
const [staleFilter, setStaleFilter] = useState('lebih-1-tahun')
const [payload, setPayload] = useState<ReportPayload | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)
```

### Source Options

| ID | Label | Database |
|-----|-------|----------|
| estate | Estate / Kebun | db_ptrj |
| pabrik | Pabrik | db_ptrj_mill |

### Filter Options

```typescript
const FILTER_OPTIONS = {
  period: ['Mei 2026', 'April 2026', 'Maret 2026'],
  location: ['Semua Lokasi', 'PTRJ'],
  category: ['Semua Kategori', 'Chemical', 'Electrical', 'Mechanical', 'General', 'Lubricant'],
  format: ['Semua Format', 'Tabel', 'Summary'],
  status: ['Semua Status', 'Live', 'Update']
}

const STALE_FILTER_OPTIONS = [
  { value: 'lebih-1-tahun', label: 'Tidak update > 1 tahun' },
  { value: 'kurang-1-tahun', label: 'Update < 1 tahun' },
  { value: 'semua', label: 'Semua item aktif' }
]
```

### Data Fetching Functions

```typescript
async function fetchReport(
  report: InventoryReport,
  search: string,
  source: ReportSource,
  stale: string,
  limit = 50
) {
  const params = new URLSearchParams({
    report: report.apiReport,
    limit: String(limit),
    source: source
  })
  if (search.trim()) params.set('search', search.trim())
  if (report.id === 'item-stale-update') params.set('stale', stale)
  
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, {
    cache: 'no-store'
  })
  const data = await response.json() as ApiResponse
  
  if (!response.ok || !data.success || !data.data) {
    throw new Error(data.error ?? 'Gagal memuat laporan')
  }
  return data.data
}
```

### API Endpoint Called

| Endpoint | Method | Params |
|----------|--------|--------|
| `/api/reports/inventory` | GET | `report={reportId}&limit=25&source={source}&search={search}&stale={stale}` |

### Report Fetch Trigger

```typescript
useEffect(() => {
  let active = true
  const timer = window.setTimeout(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchReport(selectedReport, search, selectedSource, staleFilter, 25)
      if (!active) return
      setPayload(data)
    } catch (err) {
      if (!active) return
      setPayload(null)
      setError(err instanceof Error ? err.message : 'Gagal memuat laporan')
    } finally {
      if (active) setLoading(false)
    }
  }, 250) // Debounce 250ms

  return () => {
    active = false
    window.clearTimeout(timer)
  }
}, [selectedReport, search, selectedSource, staleFilter])
```

### Export Functions

```typescript
async function exportExcel(report, search, source, stale) {
  const payload = await fetchReport(report, search, source, stale, 500)
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(payload.rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31))
  XLSX.writeFile(workbook, `${report.id}.xlsx`)
}

async function exportPdf(report, search, source, stale) {
  const payload = await fetchReport(report, search, source, stale, 80)
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt' })
  // ... render PDF
  doc.save(`${report.id}.pdf`)
}
```

### User Interactions

| Interaksi | Aksi |
|----------|------|
| Click Report Card | `selectReport(report)` → Update URL + fetch |
| Click "Lihat" Button | `viewReport(report)` → Navigate ke `/report-center/inventory/{reportId}` |
| Click Star (Favorite) | `toggleFavorite(reportId)` → Update store |
| Click "Excel" | `exportExcel(...)` → Download .xlsx |
| Click "PDF" | `exportPdf(...)` → Download .pdf |
| Change Source Toggle | Update source + fetch new data |
| Search Input | Debounced filter pada reportlist |
| Reset Button | Clear all filters |

### Zustand Store Integration

```typescript
const { favorites, toggleFavorite, addRecent } = useReportStore()

// toggleFavorite(report.id)
// addRecent(report.id)
// favorites array untuk tracking favorites
```

### AI Insight Card

 Setiap halaman inventory menampilkan AI insight yang dihasilkan dari payload:

```typescript
const insight = useMemo(
  () => payload ? createInventoryInsightFromPayload(payload) : defaultInsight,
  [payload]
)

const aiContext = useMemo(() => ({
  moduleId: 'inventory',
  moduleName: 'Inventory',
  reportName: selectedReport.title,
  dataSource: `${server}/${database}`,
  summary: payload?.summary,
  sampleRows: payload?.rows.slice(0, 8)
}), [payload, selectedReport])
```

### Monitoring Visual Section

```typescript
<MonitoringVisualSection
  data={monitoringData}
  loading={loading}
  error={error}
  title="Inventory Monitoring"
  description="Level stok, mutasi, komposisi..."
/>
```

### Navigation Routes

```
/report-center
  └── /report-center/inventory
        └── /report-center/inventory/[report-id]
```

---

## 5. LOGIN PAGE (/login)

**File Path:**
- `app/login/page.tsx` (wrapper)
- `components/LoginForm.tsx` (form component)

**Route:** `/login`
**Type:** Server Component + Client Component

### Deskripsi Halaman

Halaman login untuk autentikasi pengguna. Menggunakan NextAuth strategy dengan custom credentials provider.

### Page Structure

```
LoginPage (Server Component)
└── LoginForm (Client Component)
    ├── Username Input
    ├── Password Input
    ├── Error Display
    └── Submit Button
```

### LoginForm State

```typescript
const [username, setUsername] = useState('')
const [password, setPassword] = useState('')
const [error, setError] = useState('')
const [isLoading, setIsLoading] = useState(false)
```

### Login Flow - User Interactions

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsLoading(true)
  setError('')

  try {
    // 1. Call login API
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email: username, password })
    })

    const data = await response.json()

    // 2. Handle error
    if (!response.ok) {
      setError(data.error || 'Login gagal')
      return
    }

    // 3. Store token in localStorage
    if (data.token) {
      localStorage.setItem('auth-token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
    }

    // 4. Redirect ke dashboard
    window.location.href = '/dashboard-user'

  } catch (err) {
    setError('Terjadi kesalahan. Silakan coba lagi.')
  } finally {
    setIsLoading(false)
  }
}
```

### API Endpoint Called

| Endpoint | Method | Body |
|----------|--------|------|
| `/api/auth/login` | POST | `{ email: username, password: string }` |

### Server-Side Login Handler

**File:** `app/api/auth/login/route.ts`

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, password } = body

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email dan password harus diisi' },
        { status: 400 }
      )
    }

    // Authenticate user
    const result = await authenticateUser(email, password)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      )
    }

    // Return success with token
    const response = NextResponse.json({
      success: true,
      user: result.user,
      token: result.token
    })

    // Set cookie
    response.cookies.set('auth-token', result.token!, {
      httpOnly: false,
      secure: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/'
    })

    return response

  } catch (error) {
    return NextResponse.json(
      { error: 'Terjadi kesalahan server' },
      { status: 500 }
    )
  }
}
```

### Authentication Service

**File:** `utils/auth-service.ts`

```typescript
import { authenticateUser } from '@/lib/auth'
// Menggunakan database untuk verifikasi
// Return { success: boolean, user: object, token: string }
```

### User Object Structure

```typescript
type User = {
  id: string
  email: string
  name?: string
  role: string // 'admin' | 'kerani' | 'hr' | 'payroll' | 'manager'
  division?: string
}
```

### Error Handling

| Error | Message |
|-------|---------|
| Missing credentials | "Email dan password harus diisi" |
| Invalid credentials | "Email atau password salah" |
| Network error | "Terjadi kesalahan. Silakan coba lagi." |
| Server error | "Terjadi kesalahan server" |

### Login Page UI Elements

- **Logo:** PT Rebinmas Jaya logo dari `/assets/logo.webp`
- **Background:** Plantation image blend
- **Form Container:** White card dengan shadow
- **Input Fields:**
  - Username dengan User icon
  - Password dengan Key icon
- **Submit Button:**
  - Loading state dengan spinner
  - "Sedang Masuk..." text
  - Disabled saat loading

### Post-Login Redirect

```typescript
// Jika success
window.location.href = '/dashboard-user'

// alternatif menggunakan Next.js router
router.push('/dashboard-user')
```

### Route Protection (Before Login)

Jika user mengakses `/login` tapi sudah login:

```typescript
// Check localStorage
const user = localStorage.getItem('user')
if (user) {
  window.location.href = '/dashboard-user'
}
```

### Navigation Routes

```
/ → Landing (bisa tanpa login)
/login → Login Page (jika sudah login → /dashboard-user)
/dashboard-user → User Dashboard (protected)
/report-center → Report Center (protected)
/report-center/inventory → Inventory (protected)
```

---

## RINGKASAN FLOW DATA ANTAR HALAMAN

```
USER LOGIN FLOW:
/login
  |
  +-- POST /api/auth/login
  |     |
  |     +-- authenticateUser() → DB
  |     |
  |     +-- Return { token, user }
  |     |
  +-- localStorage.setItem('auth-token', token)
  +-- localStorage.setItem('user', user)
  |
  +-- window.location.href = '/dashboard-user'

REPORT CENTER FLOW:
/report-center
  |
  +-- /api/reports/inventory?report=stok-gudang&source=estate
  |     |
  |     +-- querySQL() → SQL Gateway
  |     |
  |     +-- Return { rows, columns, summary, chart, metadata }
  |
  +-- Display KPI Cards (from summary)
  +-- Display Charts (from chart)

INVENTORY MODULE FLOW:
/report-center/inventory
  |
  +-- Fetch liveInventoryReports (from config)
  |
  +-- User select report
  |     |
  |     +-- /api/reports/inventory?report={reportId}&source={source}
  |     |
  +-- Display Report List
  +-- Display Monitoring/AI Insight

EXPORT FLOW:
/report-center/inventory
  |
  +-- User click Export
  |     |
  |     +-- fetchReport(limit=500 for Excel)
  |     |
  |     +-- XLSX.writeFile()
  |     |
  |     +-- Download .xlsx

  or

  +-- fetchReport(limit=80 for PDF)
  +-- JsPDF.render()
  +-- Download .pdf
```

---

## API ROUTES SUMMARY

| Route | File | Method | Auth |
|------|------|--------|------|
| `/api/auth/login` | `app/api/auth/login/route.ts` | POST | No |
| `/api/auth/logout` | `app/api/auth/logout/route.ts` | POST | Yes |
| `/api/auth/verify` | `app/api/auth/verify/route.ts` | GET | Yes |
| `/api/reports/inventory` | `app/api/reports/inventory/route.ts` | GET | Yes |
| `/api/reports/system-status` | `app/api/reports/system-status/route.ts` | GET | Yes |
| `/api/reports/ai-insight` | `app/api/reports/ai-insight/route.ts` | GET | Yes |

---

## KEY FILES REFERENCE

| Purpose | Files |
|---------|-------|
| Pages | `app/page.tsx`, `app/login/page.tsx`, `app/report-center/page.tsx`, `app/report-center/layout.tsx`, `app/report-center/inventory/page.tsx` |
| Components | `components/LoginForm.tsx`, `components/layout/Sidebar.tsx`, `components/layout/Topbar.tsx` |
| API Routes | `app/api/auth/login/route.ts`, `app/api/reports/inventory/route.ts` |
| Store | `store/reportStore.ts` |
| Config | `lib/reports/inventory/config.ts` |

---

**END PAGE DETAILS**