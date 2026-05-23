# PRD: AI-Powered Report Center — World Monitor Dashboard
**Version:** 1.0 | **Date:** 2026-05-17

---

## 1. Concept & Vision

**World Monitor** — seperti dashboard monitoring di ruang server atau NOC (Network Operations Center). Banyak tile/windows yang selalu aktif, menampilkan real-time summary metrics. Klik tile → panel preview muncul di kanan dengan data + chart mini. Bawah panel ada **AI Chat** untuk tanya-jawab tentang report tersebut pakai bahasa Indonesia.

**Mood:** Enterprise accounting/audit dashboard. Clean, authoritative, data-driven. Like Bloomberg Terminal meets Windows 11 Fluent Design — premium, precise, trustworthy.

---

## 2. Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR (260px)  │  TOPBAR (64px)                                                │
│  - Logo           │  ┌──────────────────────────────────────────────────────────┐ │
│  - Nav Groups     │  │ [☰] Report Center          [🔍] [Periode] [DB] [👤]      │ │
│  - User Section   │  └──────────────────────────────────────────────────────────┘ │
│                   ├───────────────────────────────────────────────────────────────┤
│                   │  WORLD MONITOR GRID (masonry-like, varied tile sizes)         │
│                   │                                                                     │
│                   │  ┌──────────────┐ ┌──────────────┐ ┌────────────────────────┐   │
│                   │  │  HERO TILE   │ │ TOTAL VALUE  │ │  DEAD STOCK           │   │
│                   │  │  (2x2)       │ │ (1x1)        │ │  (1x1) RED ALERT      │   │
│                   │  │  Overview     │ │ Rp 133.9B    │ │  11,194 items         │   │
│                   │  └──────────────┘ └──────────────┘ └────────────────────────┘   │
│                   │  ┌──────────────────────────┐  ┌──────────┐ ┌──────────────┐   │
│                   │  │  STOCK MOVEMENT CHART    │  │ BELOW    │ │ FUEL TOTAL   │   │
│                   │  │  (2x1) Bar chart        │  │ REORDER  │ │ (1x1)       │   │
│                   │  │                          │  │ (1x1)    │ │ Rp 12.5B     │   │
│                   │  └──────────────────────────┘  └──────────┘ └──────────────┘   │
│                   │  ┌──────────────┐ ┌──────────────────────────┐                 │
│                   │  │ ABC CLASS A  │ │  OUTSTANDING PR           │                 │
│                   │  │ (1x1)        │ │  (1x1)                   │                 │
│                   │  │ Top 10 items │ │  6,118 lines pending     │                 │
│                   │  └──────────────┘ └──────────────────────────┘                 │
│                   └───────────────────────────────────────────────────────────────┘ │
│                                                                                     │
│  [FLOATING AI CHAT BUTTON — bottom right, pulsing dot]                            │
└─────────────────────────────────────────────────────────────────────────────────────┘

WHEN TILE CLICKED → SLIDE-IN PREVIEW PANEL (RIGHT SIDE, 480px)
┌─────────────────────────────────────────────┐
│  ┌─ PREVIEW HEADER ─────────────────────┐  │
│  │ [X] INV-A1: Ringkasan Stok Gudang   │  │
│  └──────────────────────────────────────┘  │
│  ┌─ SUMMARY METRICS ───────────────────┐  │
│  │ [Total Items] [Value] [Below] [Dead]│  │
│  └──────────────────────────────────────┘  │
│  ┌─ MINI CHART ────────────────────────┐  │
│  │ [Bar chart preview data]            │  │
│  └──────────────────────────────────────┘  │
│  ┌─ TOP 5 ROWS TABLE ─────────────────┐  │
│  │ LocCode | Items | Value             │  │
│  │ PTRJ    | 11,570| Rp 133.9B        │  │
│  └──────────────────────────────────────┘  │
│  ┌─ AI CHAT ──────────────────────────┐  │
│  │ 💬 Ask about this report...        │  │
│  │                                     │  │
│  │ [User]: dead stock di kategori M?  │  │
│  │ [AI M2.5]: Ada 1,980 items...     │  │
│  └──────────────────────────────────────┘  │
│  [Export Excel] [Export PDF]              │
└─────────────────────────────────────────────┘
```

---

## 3. World Monitor Grid — Tile System

### 3.1 Tile Sizes (World Monitor Style)
Tiles vary in size like Windows 11 widgets — not uniform grid:

| Tile | Size | Content |
|------|------|---------|
| Hero/Overview | 2×2 | System overview, largest |
| KPI Metric | 1×1 | Single big number |
| Alert | 1×1 | Red/orange highlight |
| Mini Chart | 2×1 | Bar/line chart |
| Mini Table | 1×2 | Top-N list |
| Progress | 1×1 | Circular or bar progress |

### 3.2 Tile Types

**KPI Tile (1×1)**
```
┌──────────────────┐
│  TOTAL VALUE     │
│                  │
│  Rp 133.9B      │  ← Big number, bold
│                  │
│  ▲ +2.1% MoM    │  ← Trend indicator
└──────────────────┘
```
- White card, rounded-xl
- Label: text-xs uppercase text-slate-500
- Value: text-2xl font-bold text-slate-900
- Trend: green/red with arrow
- Click: opens preview panel

**Alert Tile (1×1)**
```
┌──────────────────┐
│ ⚠ DEAD STOCK    │  ← Red accent
│                  │
│  11,194 items    │
│  Rp 105.8B       │
└──────────────────┘
```
- Red left border (4px)
- Red accent icon
- Critical metrics

**Mini Chart Tile (2×1)**
```
┌─────────────────────────────────┐
│ STOCK MOVEMENT — Mei 2026       │
│ [Bar chart: Jul→Agt→Sep→Okt]   │
│ Bar: hijau tinggi, value labels │
└─────────────────────────────────┘
```
- White card, rounded-xl
- Title top-left
- Recharts BarChart inside
- Hover bar: show tooltip with value

**Mini Table Tile (1×2)**
```
┌──────────────────┐
│ TOP 5 BY VALUE  │
├──────────────────┤
│ 1. DC7715 27.9B │
│ 2. DC05543  9.0B│
│ 3. MM13016  4.7B│
│ 4. DC7617   3.1B│
│ 5. DC7772   3.1B│
└──────────────────┘
```
- Scrollable list
- Rank number + description + value

### 3.3 World Monitor Grid Layout

```
ROW 1: [HERO 2x2]              [VALUE 1x1]  [DEAD 1x1]  [REORDER 1x1]
ROW 2: [MOVEMENT CHART 2x1]               [FUEL 1x1]  [PR 1x1]   [ABC 1x1]
ROW 3: [TOP ITEMS TABLE 2x1]              [ZERO 1x1]  [SLOW 1x1] [ADJ 1x1]
```

### 3.4 Tile Data Sources (from SQL)

| Tile | KPI | Data Source |
|------|-----|-------------|
| Total Value | Rp 133.9B | `SUM(IN_MTHENDITEM.Amount)` latest period |
| Dead Stock | 11,194 items | `IN_ITEM` where LastIssueDate < 6mo |
| Below Reorder | 211 items | `IN_ITEM` where QtyOnHand < ReOrderLevel |
| Fuel Total | Rp 12.5B | `SUM(IN_FUELISSUELN.Amount)` |
| Outstanding PR | 6,118 lines | `IN_PRLN` where QtyOutstanding > 0 |
| Zero Stock | 4,962 items | `IN_ITEM` where QtyOnHand = 0 |
| Slow Moving | ~100 items | `IN_ITEM` where 1-6 trans/12mo |
| Stock Adjustment | 34 trans | `IN_STOCKADJ` |

---

## 4. Preview Panel — AI Chat Integration

### 4.1 Trigger
Click any tile → Preview panel slides in from right (480px wide)

### 4.2 Panel Sections

**Header**
- Report ID + title
- "×" close button
- Status badge (LIVE / UPDATE)

**Summary Metrics (4 KPI cards)**
- 4 key numbers from the report
- Click metric → highlight in table

**Mini Chart**
- Recharts BarChart or LineChart
- Period comparison or top-N bar chart
- Hover: tooltip with exact value

**Data Table (top 10 rows)**
- Sortable columns
- Click row → highlight
- "Lihat Semua →" link to full report

**AI Chat Section** ← CORE FEATURE
```
┌─ AI Assistant ──────────────────────────────────┐
│ 💬 Bertanya tentang laporan ini...               │
│                                                 │
│ [User]: dead stock di kategori M berapa?       │
│                                                 │
│ [M2.5]: Berdasarkan data inventory per Mei 2026,│
│ dead stock di kategori Mechanical (M) adalah    │
│ 1,980 items dengan total nilai Rp 20.08 miliar.│
│ Item dengan nilai tertinggi:                     │
│ • ME14035 - 11/20KV Transformer - Rp 3.1B     │
│ • MG18004 - Chain Conveyor 6" - Rp 1.1B        │
│ • MG12011 - Pump Assembly - Rp 890M            │
│                                                 │
│ [Model: MiniMax-M2.5 | Local LLM Provider]      │
└─────────────────────────────────────────────────┘
```

**AI Chat Behavior:**
- Uses `local-llm` provider with `M2.5` model
- System prompt: "You are an inventory analyst assistant. Answer in Indonesian."
- Context: injects current report's data, filters, and column structure into prompt
- Streaming response (chunk by chunk)
- Show thinking indicator while loading
- Max 5 recent messages stored in state (not persisted)
- Reset chat button

### 4.3 AI API Integration

```typescript
// Call AI via local-llm provider
const response = await fetch('http://localhost:20128/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.LOCAL_LLM_API_KEY
  },
  body: JSON.stringify({
    model: 'MiniMax-M2.5',  // or 'M2.5'
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: USER_QUESTION + CONTEXT }
    ],
    stream: true
  })
})
```

### 4.4 Export Buttons
- "Export Excel" → generate xlsx client-side
- "Export PDF" → generate pdf client-side
- "Open Full Report →" → navigate to report viewer page

---

## 5. Color Palette — Enterprise Accounting

```css
/* Sidebar/Topbar */
--navy-900: #071426;
--navy-800: #0B1D35;

/* Background */
--bg: #F0F2F5;           /* Light gray bg, not stark white */
--card: #FFFFFF;
--card-hover: #FAFBFC;

/* Text */
--text-primary: #1A202C;   /* Near black */
--text-secondary: #718096;
--text-muted: #A0AEC0;

/* Accent — Professional Green */
--accent: #167A3A;
--accent-hover: #1F8F46;
--accent-light: #E6F4ED;

/* Alerts */
--alert-red: #C53030;
--alert-red-bg: #FFF5F5;
--alert-orange: #C05621;
--alert-orange-bg: #FFFAF0;
--alert-yellow: #B7791F;
--alert-yellow-bg: #FFFBEB;

/* Borders */
--border: #E2E8F0;
--border-hover: #CBD5E0;

/* Charts */
--chart-green: #16A34A;
--chart-blue: #2563EB;
--chart-orange: #EA580C;
--chart-red: #DC2626;
--chart-gray: #94A3B8;

/* AI Chat */
--chat-user-bg: #E6F4ED;    /* Green tint */
--chat-ai-bg: #F7FAFC;      /* Light gray */
--chat-border: #E2E8F0;
```

---

## 6. Typography

```css
/* Font: Inter (Google Fonts) — clean, professional */
--font: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Scale */
--text-xs: 0.75rem;    /* 12px — labels, badges */
--text-sm: 0.875rem;   /* 14px — body, descriptions */
--text-base: 1rem;     /* 16px — main content */
--text-lg: 1.125rem;   /* 18px — card titles */
--text-xl: 1.25rem;    /* 20px — section headers */
--text-2xl: 1.5rem;    /* 24px — KPI values */
--text-3xl: 1.875rem;  /* 30px — hero numbers */
--text-4xl: 2.25rem;   /* 36px — hero title */
```

---

## 7. Components

| Component | Description |
|-----------|-------------|
| `WorldMonitorGrid` | Masonry-like CSS grid, 3-4 columns |
| `MonitorTile` | Base tile with size variants (1x1, 2x1, 2x2) |
| `KPITile` | Single metric tile with trend |
| `AlertTile` | Red/orange accent tile for critical metrics |
| `ChartTile` | Mini Recharts bar/line chart |
| `TableTile` | Top-N list tile |
| `PreviewPanel` | Slide-in right panel (480px) |
| `AIChatBox` | Chat interface with streaming M2.5 responses |
| `MiniDataTable` | Top 10 rows table in preview |
| `SummaryMetrics` | 4 KPI cards row in preview |

---

## 8. AI Integration Spec

### 8.1 Local LLM Provider Config
```typescript
// Provider: local-llm
// Base URL: https://api.local-llm.ai/v1
// Model: MiniMax-M2.5 (preferred for speed + Indonesian)
// Fallback: M2.1, qwen-turbo

const AI_CONFIG = {
  provider: 'local-llm',
  model: 'MiniMax-M2.5',
  baseUrl: 'https://api.local-llm.ai/v1',
  maxTokens: 1024,
  temperature: 0.7,
  systemPrompt: `Kamu adalah asisten analis inventory untuk PT Rebinmas Jaya.
Kamu menjawab dalam Bahasa Indonesia yang formal dan profesional.
Selalu refer ke data spesifik dari laporan yang sedang dilihat.
Jangan membuat angka — gunakan data yang disediakan.`
}
```

### 8.2 Chat Context Injection
```typescript
function buildChatContext(report: ReportConfig, data: ReportDataResponse): string {
  return `
LAPORAN: ${report.title} (${report.code})
DESKRIPSI: ${report.description}
PERIODE: ${data.meta?.period || 'latest'}

KOLOM DATA:
${report.columns.map(c => `- ${c.label} (${c.key})`).join('\n')}

SAMPLE DATA (5 baris pertama):
${JSON.stringify(data.rows?.slice(0, 5), null, 2)}

TOTAL ROWS: ${data.pagination?.totalRows || 0}
  `
}
```

### 8.3 Streaming Response
```typescript
async function* streamAIResponse(messages: ChatMessage[]) {
  const response = await fetch(`${AI_CONFIG.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LOCAL_LLM_API_KEY}`
    },
    body: JSON.stringify({
      model: AI_CONFIG.model,
      messages,
      stream: true
    })
  })

  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader!.read()
    if (done) break
    const chunk = decoder.decode(value)
    // SSE format: data: {"choices":[{"delta":{"content":"..."}}]}
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6))
        yield data.choices?.[0]?.delta?.content || ''
      }
    }
  }
}
```

---

## 9. World Monitor Tiles — Full Layout

```
┌──────────────────────────────────────────────────────────────────────────┐
│  WORLD MONITOR — PT REBINMAS JAYA | Inventory | Periode: Mei 2026      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────┐  ┌───────────┐  ┌───────────┐        │
│  │  HERO: SYSTEM OVERVIEW     │  │  TOTAL    │  │  DEAD     │        │
│  │  (2x2 tile)                │  │  VALUE    │  │  STOCK    │        │
│  │                            │  │  Rp 133.9B│  │  11,194   │        │
│  │  [Summary of all metrics]  │  │  ▲ +2.1%  │  │  ⚠ ALERT  │        │
│  │  Last sync: Today 09:00    │  └───────────┘  └───────────┘        │
│  └─────────────────────────────┘  ┌───────────┐  ┌───────────┐        │
│                                   │  BELOW    │  │  FUEL     │        │
│                                   │  REORDER  │  │  TOTAL    │        │
│                                   │  211      │  │  Rp 12.5B │        │
│                                   └───────────┘  └───────────┘        │
│  ┌───────────────────────────────────────┐  ┌───────────┐              │
│  │  STOCK MOVEMENT — Mei 2026            │  │  OUTST.   │              │
│  │  [Bar chart by BlkCode]              │  │  PR       │              │
│  │  BLR | OFFICE | WTP | KER | ...    │  │  6,118    │              │
│  └───────────────────────────────────────┘  └───────────┘              │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐         │
│  │  ZERO     │  │  SLOW    │  │  ABC      │  │  ADJ      │         │
│  │  STOCK    │  │  MOVING  │  │  CLASS A  │  │  TOTAL    │         │
│  │  4,962    │  │  ~100    │  │  10 items │  │  34       │         │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘         │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  TOP 10 ITEMS BY VALUE                                           │  │
│  │  1. DC7715 — Generating Set 5625KVA        Rp 27.9B  ████████   │  │
│  │  2. DC05543 — Upgrading Boiler No.1&2      Rp 9.0B   █████      │  │
│  │  3. MM13016 — Turbine Rotor                Rp 4.7B   ███        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘

┌─ FLOATING AI CHAT BUTTON ──────────────────────────────────────────────┐
│  💬 [FAB — bottom right, pulsing green dot]                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Animations

| Element | Animation |
|---------|-----------|
| Tile hover | `scale(1.02)` + shadow increase, 150ms |
| Tile click | ripple effect + open preview |
| Preview panel | `translateX(100%)` → `translateX(0)`, 300ms ease-out |
| Chart bars | grow from bottom, staggered 50ms |
| AI streaming | text appears chunk by chunk |
| FAB pulse | green dot pulse animation |
| KPI number | count-up animation on load |

---

## 11. Responsive Behavior

| Breakpoint | Grid | Tiles |
|------------|------|-------|
| < 640px | 1 col | all tiles 1x1 or stacked |
| 640-1024px | 2 cols | some 2x1 combine |
| 1024-1440px | 3 cols | full layout |
| >= 1440px | 4 cols | full layout, preview panel 480px |

---

## 12. Empty / Loading States

| State | Display |
|-------|---------|
| Loading tile | Skeleton with pulse animation |
| No data | "No data for this period" with icon |
| AI loading | "M2.5 sedang berpikir..." with spinner |
| AI error | "AI tidak tersedia. Coba lagi." + retry button |
| Network error | Red banner at top |

---

## 13. Technical Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React
- **Animations:** Framer Motion
- **AI:** Local LLM provider (M2.5 model) via fetch to `http://localhost:20128/v1`
- **State:** Zustand (store/reportStore.ts)
- **API:** SQL Gateway via `/api/reports/inventory`

---

## 14. Files to Build

```
Phase 1: World Monitor Grid
- components/monitor/WorldMonitorGrid.tsx
- components/monitor/MonitorTile.tsx (base)
- components/monitor/KPITile.tsx
- components/monitor/AlertTile.tsx
- components/monitor/ChartTile.tsx
- components/monitor/TableTile.tsx
- app/reports-center/page.tsx (replace with WorldMonitor)

Phase 2: Preview Panel + AI Chat
- components/panel/PreviewPanel.tsx
- components/panel/AIChatBox.tsx
- components/panel/MiniDataTable.tsx
- components/panel/SummaryMetrics.tsx
- lib/ai/chat.ts (local-llm M2.5 integration)
- app/api/ai/chat/route.ts (optional server-side proxy)

Phase 3: Real Data Integration
- Connect each tile to /api/reports/inventory/[id]/data
- Fetch all KPIs in parallel on mount
- Loading skeletons while fetching
```
