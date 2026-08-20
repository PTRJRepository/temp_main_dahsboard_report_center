import { createHash } from 'node:crypto'

/**
 * Akses persisten (Prisma/SQLite) untuk agregasi KPI bulanan pre-rendered.
 *
 * Hanya menyimpan KPI ringan (summary/chart/topLists/trend) untuk periode CLOSED.
 * Periode current tidak pernah ditulis di sini — selalu live. Detail `rows` tidak
 * disimpan; detail selalu di-query live.
 */

type DbRow = Record<string, unknown>

export type AggregateKpiPayload = {
  summary: DbRow
  chart?: DbRow[]
  topLists?: { items?: DbRow[]; costCenters?: DbRow[]; vehicles?: DbRow[] }
  trend?: DbRow[]
  rowCount?: number
}

export type StoredAggregate = AggregateKpiPayload & {
  id: string
  handlerKey: string
  source: string
  period: string
  filterHash: string
  builtAt: Date
}

/**
 * Field filter yang benar-benar memengaruhi SQL/summary per handler.
 * Cermin whitelist `sqlScopedFilters`/`itemScopeSqlScopedFilters`/`periodScopedFilters`
 * di `app/api/reports/inventory/route.ts` — key agregasi harus stabil terhadap
 * filter yang tidak mengubah hasil (search/sort/page) dan membedakan filter yang mengubah.
 */
const SQL_RELEVANT_FILTER_KEYS = [
  'period',
  'accYear',
  'accMonth',
  'actualYear',
  'actualMonth',
  'dateFrom',
  'dateTo',
  'location',
  'category',
  'stockAnalysis',
  'productType',
  'productCategory',
  'productBrand',
  'productModel',
  'productMaterial',
  'itemType',
  'includeWorkshopItem',
  'movementWindow',
  'groupBy',
  'chartDimension',
  'aggregateField',
  'aggregateFn',
] as const

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    const source = value as Record<string, unknown>
    return Object.keys(source)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = canonicalize(source[key])
        return acc
      }, {})
  }
  return value
}

/** Hash stabil (sha256) dari subset filter SQL-relevant. Deterministik lintas proses. */
export function filterHashFor(filters: Record<string, unknown> | null | undefined): string {
  const subset: Record<string, unknown> = {}
  for (const key of SQL_RELEVANT_FILTER_KEYS) {
    const value = filters?.[key]
    if (value === undefined || value === null || value === '') continue
    subset[key] = value
  }
  return createHash('sha256').update(JSON.stringify(canonicalize(subset))).digest('hex')
}

// Prisma client lazy singleton — hindari koneksi berganda saat hot-reload dev.
// Stub class (__prisma_stub.ts) — Prisma engine tidak di-generate di module ini.
import { PrismaClient } from './__prisma_stub'

const globalForPrisma = globalThis as unknown as { __rcPrisma?: PrismaClient }

function prismaClient(): PrismaClient {
  if (!globalForPrisma.__rcPrisma) {
    globalForPrisma.__rcPrisma = new PrismaClient()
  }
  return globalForPrisma.__rcPrisma
}

function parseJson<T>(text: string | null | undefined): T | undefined {
  if (!text) return undefined
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

export async function readAggregate(args: {
  handlerKey: string
  source: string
  period: string
  filterHash: string
}): Promise<StoredAggregate | null> {
  const row = await prismaClient().monthlyReportAggregate.findUnique({
    where: {
      handlerKey_source_period_filterHash: {
        handlerKey: args.handlerKey,
        source: args.source,
        period: args.period,
        filterHash: args.filterHash,
      },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    handlerKey: row.handlerKey,
    source: row.source,
    period: row.period,
    filterHash: row.filterHash,
    builtAt: row.builtAt,
    summary: parseJson<DbRow>(row.summaryJson) ?? {},
    chart: parseJson<DbRow[]>(row.chartJson),
    topLists: parseJson<StoredAggregate['topLists']>(row.topListsJson),
    trend: parseJson<DbRow[]>(row.trendJson),
    rowCount: row.rowCount,
  }
}

export async function writeAggregate(args: {
  handlerKey: string
  source: string
  period: string
  filterHash: string
  payload: AggregateKpiPayload
}): Promise<void> {
  const data = {
    summaryJson: JSON.stringify(args.payload.summary ?? {}),
    chartJson: args.payload.chart ? JSON.stringify(args.payload.chart) : null,
    topListsJson: args.payload.topLists ? JSON.stringify(args.payload.topLists) : null,
    trendJson: args.payload.trend ? JSON.stringify(args.payload.trend) : null,
    rowCount: args.payload.rowCount ?? 0,
  }
  await prismaClient().monthlyReportAggregate.upsert({
    where: {
      handlerKey_source_period_filterHash: {
        handlerKey: args.handlerKey,
        source: args.source,
        period: args.period,
        filterHash: args.filterHash,
      },
    },
    create: {
      handlerKey: args.handlerKey,
      source: args.source,
      period: args.period,
      filterHash: args.filterHash,
      ...data,
    },
    update: { ...data, builtAt: new Date() },
  })
}

export async function listAggregates(args: { handlerKey?: string; period?: string } = {}) {
  return prismaClient().monthlyReportAggregate.findMany({
    where: {
      ...(args.handlerKey ? { handlerKey: args.handlerKey } : {}),
      ...(args.period ? { period: args.period } : {}),
    },
    select: {
      id: true,
      handlerKey: true,
      source: true,
      period: true,
      filterHash: true,
      rowCount: true,
      builtAt: true,
    },
    orderBy: [{ period: 'desc' }, { handlerKey: 'asc' }],
  })
}

export async function deleteAggregate(args: { id?: string; handlerKey?: string; period?: string }): Promise<number> {
  if (args.id) {
    await prismaClient().monthlyReportAggregate.delete({ where: { id: args.id } }).catch(() => null)
    return 1
  }
  const result = await prismaClient().monthlyReportAggregate.deleteMany({
    where: {
      ...(args.handlerKey ? { handlerKey: args.handlerKey } : {}),
      ...(args.period ? { period: args.period } : {}),
    },
  })
  return result.count
}
