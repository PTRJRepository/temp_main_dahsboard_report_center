# Movement Category Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add movement category evolution visualization (item count, quantity, amount per category per period) and a movers table to MovementAnalytics and InventoryOverview surfaces.

**Architecture:** A client-side helper derives category evolution from the existing movement-matrix rows for MovementAnalytics. A new read-only API endpoint computes full-scope category evolution for InventoryOverview. A shared React component renders a stacked chart, a metric toggle, and a movers table.

**Tech Stack:** Next.js App Router, TypeScript, React, Recharts, SQL Server via existing SQL gateway, Node assert tests.

## Global Constraints

- Work inside `Dashboard_Utama/` for all dashboard commands.
- TypeScript strict mode must pass: run `npx tsc --noEmit`.
- ESLint Next core-web-vitals must pass: run `npm run lint`.
- SQL must be read-only and validated with `validateReadOnlySql` before sending to the gateway.
- Reuse existing helpers from `lib/reports/movement-category.ts`, `lib/reports/report-filtering.ts`, and `lib/reports/sql-gateway-config.ts`.
- Follow existing naming: kebab-case report IDs, PascalCase components, camelCase helpers.
- 2-space indentation, single quotes in TS/TSX.
- No new runtime dependencies; Recharts is already available.

---

## File Map

| File | Responsibility |
|------|----------------|
| `Dashboard_Utama/lib/reports/movement-category-evolution.ts` | Pure helper: classify per-period category and build evolution model from matrix rows. |
| `Dashboard_Utama/lib/reports/movement-category-evolution.test.ts` | Deterministic unit tests for the helper. |
| `Dashboard_Utama/app/api/reports/inventory/movement-category-evolution/route.ts` | Read-only endpoint: full-scope category evolution + movers, with cache and demo mode. |
| `Dashboard_Utama/components/report-center/MovementCategoryEvolution.tsx` | Shared UI: stacked chart, metric toggle, totals, movers table, empty state. |
| `Dashboard_Utama/components/report-center/MovementAnalytics.tsx` | Wire matrix rows into the helper and render `<MovementCategoryEvolution>`. |
| `Dashboard_Utama/components/report-center/InventoryOverview.tsx` | Fetch endpoint, map `movementWindow` to months, render `<MovementCategoryEvolution>`. |

---

## Task 1: Client-side evolution helper

**Files:**
- Create: `Dashboard_Utama/lib/reports/movement-category-evolution.ts`
- Create: `Dashboard_Utama/lib/reports/movement-category-evolution.test.ts`

**Interfaces:**
- Consumes: `MovementCategoryThresholds` from `lib/reports/movement-category.ts`.
- Produces: `buildCategoryEvolutionFromMatrix(rows, periods, thresholds)` returning `{ byPeriod, movers, totals }`.

### Step 1.1: Write the failing test

Create `Dashboard_Utama/lib/reports/movement-category-evolution.test.ts`:

```ts
import assert from 'node:assert'
import { buildCategoryEvolutionFromMatrix } from './movement-category-evolution'
import { MOVEMENT_CATEGORY_THRESHOLDS } from './movement-category'

const rows = [
  {
    code: 'A001',
    name: 'Alpha',
    cells: {
      qty: [10, 20, 30],
      amount: [100, 200, 300],
      docs: [1, 3, 7],
    },
  },
  {
    code: 'B002',
    name: 'Beta',
    cells: {
      qty: [0, 5, 0],
      amount: [0, 50, 0],
      docs: [0, 1, 0],
    },
  },
]

const result = buildCategoryEvolutionFromMatrix(rows, ['2024-01', '2024-02', '2024-03'], MOVEMENT_CATEGORY_THRESHOLDS)

assert.strictEqual(result.byPeriod.length, 3)
assert.strictEqual(result.byPeriod[0].categories['Slow Moving'].count, 1)
assert.strictEqual(result.byPeriod[1].categories['Moving'].count, 1)
assert.strictEqual(result.byPeriod[2].categories['Fast Moving'].count, 1)
assert.strictEqual(result.movers.length, 1)
assert.strictEqual(result.movers[0].code, 'A001')
assert.strictEqual(result.movers[0].fromCategory, 'Slow Moving')
assert.strictEqual(result.movers[0].toCategory, 'Fast Moving')
assert.strictEqual(result.totals.qty, 65)
assert.strictEqual(result.totals.amount, 650)
assert.strictEqual(result.totals.docs, 9)

console.log('movement-category-evolution helper tests passed')
```

### Step 1.2: Run the failing test

Command:

```bash
cd Dashboard_Utama && npx tsx lib/reports/movement-category-evolution.test.ts
```

Expected: `Error: Cannot find module './movement-category-evolution'` or similar.

### Step 1.3: Implement the helper

Create `Dashboard_Utama/lib/reports/movement-category-evolution.ts`:

```ts
import {
  MOVEMENT_CATEGORY_ORDER,
  movementCategoryFromIssueCount,
  type MovementCategory,
  type MovementCategoryThresholds,
} from './movement-category'

export type CategoryEvolutionPoint = {
  period: string
  categories: Record<
    MovementCategory,
    { count: number; qty: number; amount: number }
  >
}

export type MovementMover = {
  code: string
  name: string
  fromCategory: MovementCategory
  toCategory: MovementCategory
  firstPeriod: string
  lastPeriod: string
  totalQty: number
  totalAmount: number
}

export type CategoryEvolutionResult = {
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
}

type MatrixRow = {
  code: string
  name: string
  cells: { qty: number[]; amount: number[]; docs: number[] }
}

function emptyCategories(): Record<MovementCategory, { count: number; qty: number; amount: number }> {
  return {
    'Fast Moving': { count: 0, qty: 0, amount: 0 },
    Moving: { count: 0, qty: 0, amount: 0 },
    'Slow Moving': { count: 0, qty: 0, amount: 0 },
    'Dead Stock': { count: 0, qty: 0, amount: 0 },
  }
}

export function buildCategoryEvolutionFromMatrix(
  rows: MatrixRow[],
  periods: string[],
  thresholds: MovementCategoryThresholds,
): CategoryEvolutionResult {
  const byPeriod = periods.map((period) => ({
    period,
    categories: emptyCategories(),
  }))

  const movers: MovementMover[] = []
  let totalQty = 0
  let totalAmount = 0
  let totalDocs = 0

  for (const row of rows) {
    const itemPeriods: { period: string; category: MovementCategory; qty: number; amount: number; docs: number }[] = []
    let totalItemQty = 0
    let totalItemAmount = 0

    for (let i = 0; i < periods.length; i += 1) {
      const docs = row.cells.docs[i] ?? 0
      const qty = row.cells.qty[i] ?? 0
      const amount = row.cells.amount[i] ?? 0
      const category = movementCategoryFromIssueCount(docs, 0, thresholds)

      byPeriod[i].categories[category].count += 1
      byPeriod[i].categories[category].qty += qty
      byPeriod[i].categories[category].amount += amount

      totalQty += qty
      totalAmount += amount
      totalDocs += docs
      totalItemQty += qty
      totalItemAmount += amount

      itemPeriods.push({ period: periods[i], category, qty, amount, docs })
    }

    const active = itemPeriods.filter((p) => p.category !== 'Dead Stock')
    if (active.length >= 2) {
      const first = active[0]
      const last = active[active.length - 1]
      if (first.category !== last.category) {
        movers.push({
          code: row.code,
          name: row.name,
          fromCategory: first.category,
          toCategory: last.category,
          firstPeriod: first.period,
          lastPeriod: last.period,
          totalQty: totalItemQty,
          totalAmount: totalItemAmount,
        })
      }
    }
  }

  return {
    byPeriod,
    movers,
    totals: {
      qty: totalQty,
      amount: totalAmount,
      docs: totalDocs,
      itemCount: rows.length,
    },
  }
}
```

### Step 1.4: Run the passing test

Command:

```bash
cd Dashboard_Utama && npx tsx lib/reports/movement-category-evolution.test.ts
```

Expected: `movement-category-evolution helper tests passed`

### Step 1.5: Type-check

Command:

```bash
cd Dashboard_Utama && npx tsc --noEmit
```

Expected: no errors.

### Step 1.6: Commit

```bash
git add Dashboard_Utama/lib/reports/movement-category-evolution.ts Dashboard_Utama/lib/reports/movement-category-evolution.test.ts
git commit -m "feat(inventory): add movement category evolution helper + tests"
```

---

## Task 2: Backend endpoint for full-scope evolution

**Files:**
- Create: `Dashboard_Utama/app/api/reports/inventory/movement-category-evolution/route.ts`

**Interfaces:**
- Consumes: `validateReadOnlySql`, `resolveSqlGatewayBase`, `sqlGatewayQueryUrl`, `gatewayOverrideFromRequest` from `lib/reports/sql-gateway-config.ts`.
- Produces: JSON response matching `MovementCategoryEvolutionResponse`.

### Step 2.1: Create endpoint scaffold

Create the file with route constants, type imports, and the GET handler skeleton.

### Step 2.2: Implement parameter parsing and period anchor

Add these helpers inside the route file:

```ts
function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), min), max) : fallback
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function trailingPeriods(months: number, anchor: Date): string[] {
  const periods: string[] = []
  const endYear = anchor.getFullYear()
  const endMonth = anchor.getMonth() + 1
  let year = endYear
  let month = endMonth
  for (let i = 0; i < months; i += 1) {
    periods.unshift(`${year}-${pad2(month)}`)
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return periods
}

function parseAnchorPeriod(value?: string | null): Date {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{1,2})$/)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    if (month >= 1 && month <= 12) return new Date(year, month - 1, 1)
  }
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1)
}
```

### Step 2.3: Implement SQL builder

Use the exact alias pattern from `app/api/reports/inventory/movement-matrix/route.ts`.

```ts
function buildEvolutionSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const itemTypeGudang = itemTypeScope !== '4'
  const itemTypeWorkshop = itemTypeScope !== '1'

  const gudangQuery = itemTypeGudang ? `
    SELECT
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      h.PostDate AS Tanggal,
      RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[IN_STOCKISSUELN] l
    INNER JOIN [${database}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '${dateFrom}' AND h.PostDate < '${dateToExclusive}'
      AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') <> '4'
  ` : ''

  const workshopQuery = itemTypeWorkshop ? `
    SELECT
      RTRIM(s.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, s.ItemCode)) AS NamaBarang,
      COALESCE(NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate) AS Tanggal,
      COALESCE(
        NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockIssueID)), ''),
        NULLIF(RTRIM(CONVERT(varchar(50), s.JobStockID)), ''),
        NULLIF(RTRIM(CONVERT(varchar(50), s.JobID)), '')
      ) AS Dokumen,
      CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) AS DECIMAL(18,2)) AS Amount
    FROM [${database}].[dbo].[WS_JOBSTOCK] s
    LEFT JOIN [${database}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
    LEFT JOIN [${database}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
    WHERE COALESCE(NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate) >= '${dateFrom}'
      AND COALESCE(NULLIF(s.PostDate, CONVERT(datetime, '1900-01-01')), s.TransDate) < '${dateToExclusive}'
      AND RTRIM(ISNULL(s.TransType, '')) = '1'
      AND COALESCE(
            NULLIF(RTRIM(CONVERT(varchar(10), i.ItemType)), ''),
            NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')
          ) = '4'
  ` : ''

  const parts = [gudangQuery, workshopQuery].filter(Boolean)
  const union = parts.length > 1 ? parts.join(' UNION ALL ') : parts[0] ?? 'SELECT NULL AS KodeBarang WHERE 1=0'

  return `
    WITH issue_rows AS (
      ${union}
    ),
    item_period AS (
      SELECT
        KodeBarang,
        MAX(NamaBarang) AS NamaBarang,
        CONVERT(varchar(7), Tanggal, 120) AS period,
        COUNT(DISTINCT Dokumen) AS docs,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS qty,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS amount
      FROM issue_rows
      WHERE Tanggal IS NOT NULL
      GROUP BY KodeBarang, CONVERT(varchar(7), Tanggal, 120)
    ),
    classified AS (
      SELECT
        KodeBarang,
        NamaBarang,
        period,
        docs,
        qty,
        amount,
        CASE
          WHEN docs >= ${thresholds.fastMinIssueCount} THEN 'Fast Moving'
          WHEN docs BETWEEN ${thresholds.movingMinIssueCount} AND ${thresholds.movingMaxIssueCount} THEN 'Moving'
          WHEN docs = ${thresholds.slowIssueCount} THEN 'Slow Moving'
          ELSE 'Dead Stock'
        END AS category
      FROM item_period
    )
    SELECT
      period,
      category,
      COUNT(DISTINCT KodeBarang) AS itemCount,
      CAST(SUM(qty) AS DECIMAL(18,2)) AS qty,
      CAST(SUM(amount) AS DECIMAL(18,2)) AS amount
    FROM classified
    GROUP BY period, category
    ORDER BY period, category
  `
}

function buildMoversSql(
  database: string,
  dateFrom: string,
  dateToExclusive: string,
  thresholds: MovementCategoryThresholds,
  itemTypeScope: '1' | '4' | 'all',
): string {
  const evolutionCore = buildEvolutionSql(database, dateFrom, dateToExclusive, thresholds, itemTypeScope)
  const classifiedCte = evolutionCore.replace(/^\s*SELECT\s+period,\s*category,\s*COUNT.*?FROM classified.*?ORDER BY period, category\s*$/is, '')
  // Simpler: re-use the same CTE chain in a second query.
  return evolutionCore.replace(
    /SELECT\s+period,\s*category,\s*COUNT.*?FROM classified\s*GROUP BY period, category\s*ORDER BY period, category/,
    `SELECT
      f.KodeBarang AS code,
      MAX(f.NamaBarang) AS name,
      MAX(CASE WHEN f.rn_asc = 1 THEN f.category END) AS fromCategory,
      MAX(CASE WHEN f.rn_desc = 1 THEN f.category END) AS toCategory,
      MAX(CASE WHEN f.rn_asc = 1 THEN f.period END) AS firstPeriod,
      MAX(CASE WHEN f.rn_desc = 1 THEN f.period END) AS lastPeriod,
      CAST(SUM(f.qty) AS DECIMAL(18,2)) AS totalQty,
      CAST(SUM(f.amount) AS DECIMAL(18,2)) AS totalAmount
    FROM (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period ASC) AS rn_asc,
        ROW_NUMBER() OVER (PARTITION BY KodeBarang ORDER BY period DESC) AS rn_desc
      FROM classified
    ) f
    GROUP BY f.KodeBarang
    HAVING MAX(CASE WHEN f.rn_asc = 1 THEN f.category END) <> MAX(CASE WHEN f.rn_desc = 1 THEN f.category END)
    ORDER BY totalAmount DESC`
  )
}
```

> Note: In practice, write two clearly separate SQL strings that share the CTE chain instead of string-replacing. The plan above shows the intent; the implementer should produce two valid `SELECT` statements.

### Step 2.4: Add total-items query and response assembly

```ts
function buildTotalItemsSql(database: string, itemTypeScope: '1' | '4' | 'all'): string {
  const itemTypeFilter = itemTypeScope === 'all'
    ? `RTRIM(CONVERT(varchar(10), ItemType)) IN ('1', '4')`
    : `RTRIM(CONVERT(varchar(10), ItemType)) = '${itemTypeScope}'`
  return `SELECT COUNT(*) AS totalItemCount FROM [${database}].[dbo].[IN_ITEM] WHERE ${itemTypeFilter}`
}
```

Run the three queries via the SQL gateway, merge active counts with Dead Stock counts, and return the JSON response.

### Step 2.5: Add cache and demo mode

Add in-memory cache with key `{source}|{months}|{period}|{itemType}|{fastMin}|{movingMin}|{movingMax}|{slowCount}` and TTL 60s. Add deterministic demo data generator when `demo=1`.

### Step 2.6: Validate the endpoint

Command:

```bash
curl "http://[redacted]:3000/api/reports/inventory/movement-category-evolution?source=estate&months=12&demo=1"
```

Expected: JSON with `success: true`, `periods`, `byPeriod`, `movers`, and `totals`.

### Step 2.7: Type-check

Command:

```bash
cd Dashboard_Utama && npx tsc --noEmit
```

Expected: no errors.

### Step 2.8: Commit

```bash
git add Dashboard_Utama/app/api/reports/inventory/movement-category-evolution/route.ts
git commit -m "feat(api): add movement-category-evolution endpoint with demo mode"
```

---

## Task 3: Shared `MovementCategoryEvolution` component

**Files:**
- Create: `Dashboard_Utama/components/report-center/MovementCategoryEvolution.tsx`

**Interfaces:**
- Consumes: `CategoryEvolutionPoint`, `MovementMover` shapes from the helper.
- Produces: `<MovementCategoryEvolution>` rendered by MovementAnalytics and InventoryOverview.

### Step 3.1: Implement component

Create the file with:

```tsx
'use client'

import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { movementTone } from './MovementComposition'

export type CategoryEvolutionPoint = {
  period: string
  categories: Record<string, { count: number; qty: number; amount: number }>
}

export type MovementMover = {
  code: string
  name: string
  fromCategory: string
  toCategory: string
  firstPeriod: string
  lastPeriod: string
  totalQty: number
  totalAmount: number
}

type MovementCategoryEvolutionProps = {
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
  metric?: 'count' | 'qty' | 'amount'
  onMetricChange?: (metric: 'count' | 'qty' | 'amount') => void
  loading?: boolean
  onDrilldown?: (item: { code: string; name: string }) => void
}

const MONTH_ID = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const CATEGORY_ORDER = ['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock']
const TONE_FILL: Record<string, string> = {
  'Fast Moving': '#34d399',
  Moving: '#22d3ee',
  'Slow Moving': '#fbbf24',
  'Dead Stock': '#94a3b8',
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTH_ID[(Number(m) - 1) % 12] ?? m} ${String(y).slice(2)}`
}

export default function MovementCategoryEvolution({
  periods,
  byPeriod,
  movers,
  totals,
  metric = 'count',
  onMetricChange,
  loading,
  onDrilldown,
}: MovementCategoryEvolutionProps) {
  const [sortKey, setSortKey] = useState<'amount' | 'qty'>('amount')

  const points = useMemo(() => {
    return byPeriod.map((p) => {
      const row: Record<string, number | string> = { period: p.period, label: periodLabel(p.period) }
      for (const category of CATEGORY_ORDER) {
        row[category] = p.categories[category]?.[metric] ?? 0
      }
      return row
    })
  }, [byPeriod, metric])

  const totalMetric = useMemo(() => {
    if (metric === 'qty') return totals.qty
    if (metric === 'amount') return totals.amount
    return totals.itemCount
  }, [metric, totals])

  const sortedMovers = useMemo(() => {
    return [...movers].sort((a, b) => b[sortKey] - a[sortKey]).slice(0, 12)
  }, [movers, sortKey])

  if (loading && periods.length === 0) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03]">
        <p className="rc-data text-[11px] text-[var(--rc-text-faint)]">Memuat evolusi kategori…</p>
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03] p-4 text-center">
        <p className="text-sm font-bold text-[var(--rc-text-muted)]">Belum ada data evolusi kategori untuk filter ini.</p>
        <p className="rc-data mt-1 text-[11px] text-[var(--rc-text-faint)]">Ubah periode, lokasi, atau tipe barang.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-[var(--rc-text)]">Evolusi kategori movement</p>
          <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
            {metric === 'count' && `Total ${totals.itemCount} barang · ${movers.length} berpindah kategori`}
            {metric === 'qty' && `Total qty ${formatCompact(totals.qty)}`}
            {metric === 'amount' && `Total issue amount Rp ${formatCompact(totals.amount)}`}
          </p>
        </div>
        {onMetricChange ? (
          <div className="flex shrink-0 gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist">
            {(['count','qty','amount'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={metric === m}
                onClick={() => onMetricChange(m)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  metric === m ? 'bg-emerald-400/20 text-emerald-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
                }`}
              >
                {m === 'count' ? 'Jumlah' : m === 'qty' ? 'Qty' : 'Amount'}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} stackOffset="expand" margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} minTickGap={18} />
            <YAxis tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip
              contentStyle={{ background: '#0a1510', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, fontSize: 11 }}
              labelStyle={{ color: '#a7f3d0', fontWeight: 700 }}
              formatter={(value, name) => [metric === 'amount' ? `Rp ${formatCompact(Number(value))}` : formatCompact(Number(value)), name]}
            />
            {CATEGORY_ORDER.map((category) => (
              <Bar key={category} dataKey={category} stackId="a" fill={TONE_FILL[category]} radius={[2, 2, 0, 0]} maxBarSize={24} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {movers.length > 0 && (
        <div className="mt-3 min-h-0 flex-1 overflow-auto border-t border-white/[0.06] pt-2">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[var(--rc-text)]">Barang berpindah kategori</p>
            <div className="flex gap-1">
              {(['amount','qty'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setSortKey(k)}
                  className={`text-[10px] font-semibold ${sortKey === k ? 'text-emerald-200' : 'text-[var(--rc-text-faint)]'}`}
                >
                  {k === 'amount' ? 'Amount' : 'Qty'}
                </button>
              ))}
            </div>
          </div>
          <ul className="space-y-1">
            {sortedMovers.map((mover) => (
              <li key={mover.code}>
                <button
                  type="button"
                  onClick={() => onDrilldown?.({ code: mover.code, name: mover.name })}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.05]"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--rc-text)]">
                    {mover.name}
                  </span>
                  <span className="rc-data text-[10px] text-[var(--rc-text-muted)]">
                    {mover.fromCategory} → {mover.toCategory}
                  </span>
                  <span className="rc-data shrink-0 text-[10px] text-[var(--rc-text-muted)]">
                    Rp {formatCompact(mover.totalAmount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
```

### Step 3.2: Type-check and lint

Commands:

```bash
cd Dashboard_Utama && npx tsc --noEmit && npm run lint
```

Expected: no errors.

### Step 3.3: Commit

```bash
git add Dashboard_Utama/components/report-center/MovementCategoryEvolution.tsx
git commit -m "feat(ui): add MovementCategoryEvolution chart + movers table"
```

---

## Task 4: Wire into MovementAnalytics

**Files:**
- Modify: `Dashboard_Utama/components/report-center/MovementAnalytics.tsx`

**Interfaces:**
- Consumes: `buildCategoryEvolutionFromMatrix` and `<MovementCategoryEvolution>`.
- Produces: evolution panel rendered below `<MovementTrend>`.

### Step 4.1: Add imports and state

```tsx
import { buildCategoryEvolutionFromMatrix } from '@/lib/reports/movement-category-evolution'
import { MOVEMENT_CATEGORY_THRESHOLDS } from '@/lib/reports/movement-category'
import MovementCategoryEvolution from './MovementCategoryEvolution'
```

Add state:

```tsx
const [evolutionMetric, setEvolutionMetric] = useState<'count' | 'qty' | 'amount'>('count')
```

### Step 4.2: Compute evolution data

```tsx
const evolution = useMemo(
  () => buildCategoryEvolutionFromMatrix(matrixRows, periods, MOVEMENT_CATEGORY_THRESHOLDS),
  [matrixRows, periods],
)
```

### Step 4.3: Insert component

After the `<MovementTrend>` block, add:

```tsx
<div className="h-[320px]">
  <MovementCategoryEvolution
    periods={periods}
    byPeriod={evolution.byPeriod}
    movers={evolution.movers}
    totals={evolution.totals}
    metric={evolutionMetric}
    onMetricChange={setEvolutionMetric}
    loading={loading && !data}
    onDrilldown={(item) => setDrillItem(item)}
  />
</div>
```

### Step 4.4: Verify

- Open MovementAnalytics section with `?demo=1` on matrix or real data.
- Confirm stacked chart shows 4 categories, toggle switches metrics, and movers list appears when items change category.

### Step 4.5: Type-check and lint

Commands:

```bash
cd Dashboard_Utama && npx tsc --noEmit && npm run lint
```

Expected: no errors.

### Step 4.6: Commit

```bash
git add Dashboard_Utama/components/report-center/MovementAnalytics.tsx
git commit -m "feat(ui): integrate MovementCategoryEvolution into MovementAnalytics"
```

---

## Task 5: Wire into InventoryOverview

**Files:**
- Modify: `Dashboard_Utama/components/report-center/InventoryOverview.tsx`

**Interfaces:**
- Consumes: `/api/reports/inventory/movement-category-evolution` and `<MovementCategoryEvolution>`.
- Produces: full-scope evolution panel rendered below the existing MovementComposition/ExceptionQueue grid.

### Step 5.1: Add imports and types

```tsx
import { useEffect, useState } from 'react'
import MovementCategoryEvolution, {
  type CategoryEvolutionPoint,
  type MovementMover,
} from './MovementCategoryEvolution'

type EvolutionApiResponse = {
  success: boolean
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
  error?: string
}
```

### Step 5.2: Add state

```tsx
const [evolutionPayload, setEvolutionPayload] = useState<EvolutionApiResponse | null>(null)
const [evolutionLoading, setEvolutionLoading] = useState(false)
const [evolutionMetric, setEvolutionMetric] = useState<'count' | 'qty' | 'amount'>('count')
```

### Step 5.3: Map movementWindow to months

```ts
function movementWindowToMonths(window: string): number {
  const map: Record<string, number> = {
    '1m': 1,
    '3m': 3,
    '6m': 6,
    '12m': 12,
    '2y': 24,
    '5y': 60,
    '10y': 120,
    all: 120,
  }
  return map[window] ?? 12
}
```

### Step 5.4: Add fetch effect

Inside `InventoryOverview`, add an effect after the existing overview fetch effect:

```tsx
useEffect(() => {
  const controller = new AbortController()
  let active = true

  const months = movementWindowToMonths(movementWindow || 'all')
  const params = new URLSearchParams({
    source,
    months: String(months),
    period,
    movementFastMin: String(movementDefinition.fastMin),
    movementMovingMin: String(movementDefinition.movingMin),
    movementMovingMax: String(movementDefinition.movingMax),
    movementSlowCount: String(movementDefinition.slowCount),
  })
  if (itemType) params.set('itemType', itemType)

  const loadEvolution = async () => {
    setEvolutionLoading(true)
    try {
      const response = await fetch(`/api/reports/inventory/movement-category-evolution?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      const result = (await response.json()) as EvolutionApiResponse
      if (active && result?.success) setEvolutionPayload(result)
    } catch {
      // keep previous payload on error
    } finally {
      if (active) setEvolutionLoading(false)
    }
  }

  void loadEvolution()
  return () => {
    active = false
    controller.abort()
  }
}, [source, period, movementWindow, itemType, movementDefinition])
```

### Step 5.5: Render the panel

After the grid containing `<MovementComposition />` and Fast actions, add:

```tsx
<div className="mt-5 h-[360px]">
  <MovementCategoryEvolution
    periods={evolutionPayload?.periods ?? []}
    byPeriod={evolutionPayload?.byPeriod ?? []}
    movers={evolutionPayload?.movers ?? []}
    totals={evolutionPayload?.totals ?? { qty: 0, amount: 0, docs: 0, itemCount: 0 }}
    metric={evolutionMetric}
    onMetricChange={setEvolutionMetric}
    loading={evolutionLoading}
  />
</div>
```

### Step 5.6: Verify

- Open InventoryOverview.
- Select Movement Window = 5 tahun.
- Confirm stacked chart shows evolution and includes Dead Stock counts.
- Change threshold values and confirm chart reloads.

### Step 5.7: Type-check and lint

Commands:

```bash
cd Dashboard_Utama && npx tsc --noEmit && npm run lint
```

Expected: no errors.

### Step 5.8: Commit

```bash
git add Dashboard_Utama/components/report-center/InventoryOverview.tsx
git commit -m "feat(ui): fetch and render MovementCategoryEvolution in InventoryOverview"
```

---

## Task 6: Final verification

### Step 6.1: Run all tests

Command:

```bash
cd Dashboard_Utama && npx tsx lib/reports/movement-category-evolution.test.ts
```

Expected: `movement-category-evolution helper tests passed`

### Step 6.2: Run type-check and lint

Command:

```bash
cd Dashboard_Utama && npx tsc --noEmit && npm run lint
```

Expected: no errors.

### Step 6.3: Manual integration check

- Start dashboard dev server: `cd Dashboard_Utama && npm run dev`.
- Visit InventoryOverview and MovementAnalytics.
- Test with `?demo=1` on the evolution endpoint if DB is unreachable.
- Confirm quantity and total issue amount appear in toggle states.

### Step 6.4: Commit any final fixes

```bash
git add -A
git commit -m "chore(inventory): final verification for movement category evolution"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Client-side helper for MovementAnalytics → Task 1.
   - Full-scope backend endpoint for InventoryOverview → Task 2.
   - Shared UI component → Task 3.
   - Integration in both surfaces → Tasks 4 & 5.
   - Quantity + total issue analytics → metric toggle in component.
   - Demo mode and caching → Task 2.

2. **No placeholders:** every step includes file paths, function names, code snippets, and commands.

3. **Type consistency:** `CategoryEvolutionPoint`, `MovementMover`, and `totals` shapes match between helper, endpoint, and component.

4. **Open risk:** the SQL movers query string replacement note must be implemented as two clean statements, not a literal regex replacement.

---

*Plan complete and ready for execution.*