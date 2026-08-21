import {
  accountingToActualPeriod,
  isClosedActualPeriod,
  normalizeAccountingMonth,
  normalizeAccountingYear,
} from '@modules/report-center/lib/reports/accounting-period'
import {
  filterHashFor,
  readAggregate,
  writeAggregate,
  type AggregateKpiPayload,
  type StoredAggregate,
} from './monthly-aggregate-store'

/**
 * Orchestrator lapisan agregasi bulanan.
 *
 * Menentukan apakah sebuah request report mengacu ke periode CLOSED (immutable,
 * boleh dilayani dari agregasi pre-rendered) atau CURRENT/tanpa-period (harus live).
 * Tidak bergantung pada Next request — murni dari `filters` + tanggal sekarang,
 * sehingga bisa di-unit-test dan dipakai baik oleh route maupun control room.
 */

export type AggregationPeriodResolution = {
  /** True bila periode yang dimaksud closed & aman diagregasi. */
  closed: boolean
  /** Actual period 'YYYY-MM' bila berhasil di-resolve; null bila tanpa period. */
  period: string | null
  actualYear: number | null
  actualMonth: number | null
  /** True bila user eksplisit meminta period tertentu (bukan default current). */
  requested: boolean
}

type PeriodLikeFilters = {
  period?: string | null
  actualYear?: string | number | null
  actualMonth?: string | number | null
  accYear?: string | number | null
  accMonth?: string | number | null
}

/**
 * Resolve periode dari filter — cermin prioritas `resolveAssetValuationPeriod`
 * di route inventory: period=YYYY-MM → actualYear+actualMonth → acc:YYYY-MM →
 * accYear+accMonth → (tanpa period = current).
 */
export function resolveAggregationPeriod(
  filters: PeriodLikeFilters | null | undefined,
  now: Date = new Date(),
): AggregationPeriodResolution {
  const none: AggregationPeriodResolution = {
    closed: false,
    period: null,
    actualYear: null,
    actualMonth: null,
    requested: false,
  }
  if (!filters) return none

  let actualYear: number | null = null
  let actualMonth: number | null = null

  const rawPeriod = typeof filters.period === 'string' ? filters.period.trim() : ''
  if (rawPeriod) {
    const accMatch = rawPeriod.match(/^acc:(\d{4})-(\d{2})$/)
    const actualMatch = rawPeriod.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
    if (accMatch) {
      const resolved = accountingToActualPeriod(accMatch[1], accMatch[2])
      if (resolved) {
        actualYear = resolved.actualYear
        actualMonth = resolved.actualMonth
      }
    } else if (actualMatch) {
      actualYear = normalizeAccountingYear(actualMatch[1])
      actualMonth = normalizeAccountingMonth(actualMatch[2])
    }
  }

  if (actualYear === null || actualMonth === null) {
    const ay = normalizeAccountingYear(filters.actualYear)
    const am = normalizeAccountingMonth(filters.actualMonth)
    if (ay !== null && am !== null) {
      actualYear = ay
      actualMonth = am
    }
  }

  if (actualYear === null || actualMonth === null) {
    const accY = normalizeAccountingYear(filters.accYear)
    const accM = normalizeAccountingMonth(filters.accMonth)
    if (accY !== null && accM !== null) {
      const resolved = accountingToActualPeriod(accY, accM)
      if (resolved) {
        actualYear = resolved.actualYear
        actualMonth = resolved.actualMonth
      }
    }
  }

  // Tanpa period yang valid → diperlakukan sebagai current → live, tidak diagregasi.
  if (actualYear === null || actualMonth === null) return none

  const closed = isClosedActualPeriod(actualYear, actualMonth, now)
  return {
    closed,
    period: `${actualYear}-${String(actualMonth).padStart(2, '0')}`,
    actualYear,
    actualMonth,
    requested: true,
  }
}

export type AggregationServeResult =
  | { mode: 'pre-aggregated'; stored: StoredAggregate }
  | { mode: 'live'; resolution: AggregationPeriodResolution }

/**
 * Coba layani KPI dari agregasi pre-rendered.
 * - Periode current / tanpa period → `{ mode: 'live' }` (caller jalankan handler live).
 * - Periode closed + ada di store → `{ mode: 'pre-aggregated' }`.
 * - Periode closed + belum ada → `{ mode: 'live' }`; caller boleh build+simpan via `persistAggregate`.
 */
export async function serveAggregate(args: {
  handlerKey: string
  source: string
  filters: PeriodLikeFilters & Record<string, unknown>
  now?: Date
}): Promise<AggregationServeResult> {
  const resolution = resolveAggregationPeriod(args.filters, args.now)
  if (!resolution.closed || !resolution.period) {
    return { mode: 'live', resolution }
  }
  const filterHash = filterHashFor(args.filters)
  const stored = await readAggregate({
    handlerKey: args.handlerKey,
    source: args.source,
    period: resolution.period,
    filterHash,
  })
  if (stored) return { mode: 'pre-aggregated', stored }
  return { mode: 'live', resolution }
}

/** Simpan KPI hasil hitung live untuk periode CLOSED (abaikan bila bukan closed). */
export async function persistAggregate(args: {
  handlerKey: string
  source: string
  resolution: AggregationPeriodResolution
  filters: Record<string, unknown>
  payload: AggregateKpiPayload
}): Promise<boolean> {
  const { resolution } = args
  if (!resolution.closed || !resolution.period) return false
  await writeAggregate({
    handlerKey: args.handlerKey,
    source: args.source,
    period: resolution.period,
    filterHash: filterHashFor(args.filters),
    payload: args.payload,
  })
  return true
}
