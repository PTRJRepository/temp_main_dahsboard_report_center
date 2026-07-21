import { accountingToActualPeriod, actualToAccountingPeriod } from '../accounting-period'
import {
  MOVEMENT_CATEGORY_CLASSIFICATION_VERSION,
  MOVEMENT_CATEGORY_THRESHOLDS,
  movementCategoryFromIssueCount,
  normalizeMovementCategoryThresholds,
  type MovementCategory,
  type MovementCategoryThresholdInput,
} from '../movement-category'

export const MOVEMENT_PERIOD_TIMEZONE = 'Asia/Jakarta'
export const MIN_VALID_MOVEMENT_DATE = '2000-01-01'

export type MovementPeriodInput = {
  period?: string
  actualYear?: number | string
  actualMonth?: number | string
  accYear?: number | string
  accMonth?: number | string
  now?: Date
  timezone?: string
}

export type MovementPeriodScope = {
  actualYear: number
  actualMonth: number
  actualPeriod: string
  accountingYear: number
  accountingMonth: number
  accountingPeriod: string
  periodStartInclusive: string
  periodEndExclusive: string
  timezone: string
  inputMode: 'actual' | 'accounting' | 'period' | 'current'
}

export type MovementSourceSet = {
  itemType: '1' | '4' | 'other'
  source: 'STOCK_ISSUE_REGULAR' | 'WS_JOBSTOCK' | 'UNSUPPORTED'
  validTransType?: string
  dateField: string
}

function integer(value: number | string | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : undefined
  const text = String(value ?? '').trim()
  return /^\d+$/.test(text) ? Number(text) : undefined
}

function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

function addOneMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

function periodFromActual(actualYear: number, actualMonth: number, inputMode: MovementPeriodScope['inputMode'], timezone: string): MovementPeriodScope {
  const accounting = actualToAccountingPeriod(actualYear, actualMonth)
  if (!accounting) throw new Error('Periode movement aktual tidak valid')

  const next = addOneMonth(actualYear, actualMonth)
  return {
    actualYear,
    actualMonth,
    actualPeriod: `${actualYear}-${padMonth(actualMonth)}`,
    accountingYear: accounting.accYear,
    accountingMonth: accounting.accMonth,
    accountingPeriod: accounting.accountingPeriod,
    periodStartInclusive: `${actualYear}-${padMonth(actualMonth)}-01`,
    periodEndExclusive: `${next.year}-${padMonth(next.month)}-01`,
    timezone,
    inputMode,
  }
}

export function resolveMovementPeriodScope(input: MovementPeriodInput = {}): MovementPeriodScope {
  const timezone = input.timezone ?? MOVEMENT_PERIOD_TIMEZONE
  const accYear = integer(input.accYear)
  const accMonth = integer(input.accMonth)
  const accounting = accYear && accMonth ? accountingToActualPeriod(accYear, accMonth) : null
  if (accounting) {
    return periodFromActual(accounting.actualYear, accounting.actualMonth, 'accounting', timezone)
  }

  const actualYear = integer(input.actualYear)
  const actualMonth = integer(input.actualMonth)
  if (actualYear && actualMonth) return periodFromActual(actualYear, actualMonth, 'actual', timezone)

  const periodMatch = input.period?.trim().match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  if (periodMatch) return periodFromActual(Number(periodMatch[1]), Number(periodMatch[2]), 'period', timezone)

  const now = input.now ?? new Date()
  return periodFromActual(now.getFullYear(), now.getMonth() + 1, 'current', timezone)
}

export function movementSourceForItemType(itemType: unknown): MovementSourceSet {
  const normalized = String(itemType ?? '').trim()
  if (normalized === '4') {
    return {
      itemType: '4',
      source: 'WS_JOBSTOCK',
      validTransType: '1',
      dateField: 'WS_JOBSTOCK.PostDate/TransDate/DocDate',
    }
  }
  if (normalized === '1' || normalized === '') {
    return {
      itemType: '1',
      source: 'STOCK_ISSUE_REGULAR',
      dateField: 'IN_STOCKISSUE.PostDate',
    }
  }
  return {
    itemType: 'other',
    source: 'UNSUPPORTED',
    dateField: '-',
  }
}

export function isValidMovementDate(value: Date | string | null | undefined, scope: MovementPeriodScope, now = new Date()) {
  if (!value) return false
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return false

  const min = new Date(`${MIN_VALID_MOVEMENT_DATE}T00:00:00.000Z`)
  const start = new Date(`${scope.periodStartInclusive}T00:00:00.000Z`)
  const end = new Date(`${scope.periodEndExclusive}T00:00:00.000Z`)

  return date >= min && date >= start && date < end && date <= now
}

export function classifyPeriodMovement(options: {
  itemType: unknown
  regularIssueCount?: unknown
  workshopIssueCount?: unknown
  quantityClosing: unknown
  thresholds?: MovementCategoryThresholdInput
}): { category: MovementCategory; source: MovementSourceSet; issueCount: number } {
  const source = movementSourceForItemType(options.itemType)
  const rawCount = source.source === 'WS_JOBSTOCK' ? options.workshopIssueCount : options.regularIssueCount
  const issueCount = Math.max(0, Math.trunc(Number(rawCount) || 0))
  return {
    source,
    issueCount,
    category: movementCategoryFromIssueCount(issueCount, options.quantityClosing, options.thresholds),
  }
}

export type MovementWindowPreset = 'all' | '1m' | '3m' | '6m' | '12m' | 'custom'

export type MovementWindowInput = {
  movementWindow?: string | null
  dateFrom?: string | null
  dateTo?: string | null
  period?: string | null
  now?: Date
}

export type MovementWindowScope = {
  preset: MovementWindowPreset
  startInclusive: string
  endExclusive: string
  label: string
  rule: string
}

function ymd(date: Date) {
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}-${String(date.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, days: number) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

function startOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1)
}

function parseYmd(value?: string | null) {
  const match = String(value ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(year, month - 1, day)
}

export function normalizeMovementWindowPreset(value?: string | null): MovementWindowPreset {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === '1m' || raw === '1' || raw === '1month' || raw === 'bulan-ini' || raw === '1-bulan') return '1m'
  if (raw === '3m' || raw === '3' || raw === '3month' || raw === '3-bulan') return '3m'
  if (raw === '6m' || raw === '6' || raw === '6month' || raw === '6-bulan') return '6m'
  if (raw === '12m' || raw === '12' || raw === '1y' || raw === '12-bulan' || raw === '1-tahun') return '12m'
  if (raw === 'custom' || raw === 'range') return 'custom'
  return 'all'
}

/** Read-only issue-count window for Movement Category. Default: all-period. */
export function resolveMovementWindowScope(input: MovementWindowInput = {}): MovementWindowScope {
  const now = input.now ?? new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const endExclusive = ymd(addDays(todayStart, 1))
  const preset = normalizeMovementWindowPreset(input.movementWindow)

  if (preset === 'custom') {
    const from = parseYmd(input.dateFrom) ?? new Date(MIN_VALID_MOVEMENT_DATE + 'T00:00:00')
    const to = parseYmd(input.dateTo) ?? todayStart
    const start = from <= to ? from : to
    const endDay = from <= to ? to : from
    const startClamped = start < new Date(MIN_VALID_MOVEMENT_DATE + 'T00:00:00')
      ? new Date(MIN_VALID_MOVEMENT_DATE + 'T00:00:00')
      : start
    return {
      preset: 'custom',
      startInclusive: ymd(startClamped),
      endExclusive: ymd(addDays(endDay, 1)),
      label: `Custom ${ymd(startClamped)} s/d ${ymd(endDay)}`,
      rule: 'Custom dateFrom/dateTo bounds distinct stock-issue events (read-only SELECT).',
    }
  }

  if (preset === '1m') {
    // Prefer explicit calendar month if period=YYYY-MM provided; else rolling current month-to-date.
    const periodMatch = String(input.period ?? '').trim().match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
    if (periodMatch) {
      const year = Number(periodMatch[1])
      const month = Number(periodMatch[2])
      const start = startOfMonth(year, month)
      const next = month === 12 ? startOfMonth(year + 1, 1) : startOfMonth(year, month + 1)
      return {
        preset: '1m',
        startInclusive: ymd(start),
        endExclusive: ymd(next),
        label: `1 bulan (${year}-${padMonth(month)})`,
        rule: 'Single calendar month issue-count window.',
      }
    }
    const start = startOfMonth(now.getFullYear(), now.getMonth() + 1)
    return {
      preset: '1m',
      startInclusive: ymd(start),
      endExclusive,
      label: '1 bulan (bulan berjalan)',
      rule: 'Current calendar month through today.',
    }
  }

  if (preset === '3m' || preset === '6m' || preset === '12m') {
    const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
    return {
      preset,
      startInclusive: ymd(start),
      endExclusive,
      label: `${months} bulan terakhir`,
      rule: `Rolling last ${months} calendar months through today.`,
    }
  }

  return {
    preset: 'all',
    startInclusive: MIN_VALID_MOVEMENT_DATE,
    endExclusive,
    label: 'All period',
    rule: `All valid stock-issue events from ${MIN_VALID_MOVEMENT_DATE} through today (exclude future).`,
  }
}

export function buildMovementPeriodMetadata(
  scope?: MovementPeriodScope,
  windowScope?: MovementWindowScope,
  thresholdsInput: MovementCategoryThresholdInput = {},
) {
  const window = windowScope ?? resolveMovementWindowScope()
  const thresholds = normalizeMovementCategoryThresholds(thresholdsInput)
  return {
    classificationVersion: MOVEMENT_CATEGORY_CLASSIFICATION_VERSION,
    periodScope: window.preset === 'all' ? 'all-period' : `window:${window.preset}`,
    movementWindow: window.preset,
    movementWindowLabel: window.label,
    movementWindowStartInclusive: window.startInclusive,
    movementWindowEndExclusive: window.endExclusive,
    movementWindowRule: window.rule,
    actualPeriod: scope?.actualPeriod,
    actualYear: scope?.actualYear,
    actualMonth: scope?.actualMonth,
    accountingPeriod: scope?.accountingPeriod,
    accYear: scope?.accountingYear,
    accMonth: scope?.accountingMonth,
    contextPeriodStartInclusive: scope?.periodStartInclusive,
    contextPeriodEndExclusive: scope?.periodEndExclusive,
    timezone: scope?.timezone ?? MOVEMENT_PERIOD_TIMEZONE,
    inputMode: scope?.inputMode ?? 'current',
    thresholds,
    defaultThresholds: MOVEMENT_CATEGORY_THRESHOLDS,
    sourceSet: [
      movementSourceForItemType('1'),
      movementSourceForItemType('4'),
    ],
    invalidDateRule: `Exclude null/invalid dates, dates before ${MIN_VALID_MOVEMENT_DATE}, and future dates.`,
    dbWritePolicy: 'read-only SELECT only against db_ptrj / db_ptrj_mill',
  }
}
