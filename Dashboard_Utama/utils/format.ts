// ─── Typed metric formatters (shared by KPI, table, export metadata) ─────────

export type MetricKind =
  | 'currency'
  | 'quantity'
  | 'count'
  | 'percentage'
  | 'date'
  | 'period'
  | 'duration'
  | 'status'
  | 'code'
  | 'text'

const IDR_AMOUNT = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

const NUMBER = new Intl.NumberFormat('id-ID')
const QTY = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
})
const COUNT = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
})
const PCT = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Amount / valuation always keep 4 decimal places (id-ID). */
export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return 'Rp0,0000'
  return IDR_AMOUNT.format(value)
}

/** Alias — same 4-decimal amount rule. */
export function formatCurrencyFull(value: number): string {
  return formatCurrency(value)
}

export function formatNumber(value: number): string {
  return NUMBER.format(value)
}

export function formatCompact(value: number): string {
  return NUMBER.format(value)
}

export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return QTY.format(value)
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '-'
  return COUNT.format(Math.round(value))
}

/**
 * Infer semantic kind from field name / label.
 * Periods, counts, qty must never become currency.
 */
export function inferMetricKind(field?: string | null, label?: string | null): MetricKind {
  const token = `${field ?? ''} ${label ?? ''}`.trim()
  if (!token) return 'text'
  const t = token.toLowerCase()

  if (/period|acc\s*period|actual\s*period|accyear|accmonth|actualyear|actualmonth|tahun|bulan/i.test(token)) {
    return 'period'
  }
  if (/\b(date|tanggal|timestamp|asof|as_of|lastupdate|lastmovement)\b/i.test(t)) return 'date'
  if (/\b(status|state|flag|valid|enabled)\b/i.test(t)) return 'status'
  if (/\b(code|id|sku|kode)\b/i.test(t) && !/amount|qty|count|total/i.test(t)) return 'code'
  if (/%|percent|percentage|share|ratio/i.test(t)) return 'percentage'
  if (/duration|umur|age\s*days|hari|minutes|seconds|ms\b/i.test(t)) return 'duration'
  if (/\b(count|event|rows|items?|itemcount|totalitem|filteredrows|returnedrows|pagecount)\b/i.test(t)
    || /(Count|Event|Rows|Items?|Item)$/.test(token)) {
    return 'count'
  }
  if (/\b(qty|quantity|qtyonhand|qtyonhold|stok|stock)\b/i.test(t)
    || /(Qty|Quantity)$/.test(token)
    || /Qty[A-Z]/.test(token)
    || /Quantity[A-Z]/.test(token)) {
    return 'quantity'
  }
  if (/amount|nilai|valuasi|cost|price|assetamount|onhandholdamount|total_amount|rupiah|\brp\b/i.test(t)
    || /(Amount|Nilai|Cost|Price|Value)$/.test(token)) {
    return 'currency'
  }
  return 'text'
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    // Keep pure period-like strings out of numeric path
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(trimmed)) return null
    if (/^\d{4}\/\d{1,2}$/.test(trimmed)) return null
    const parsed = Number(trimmed.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export function formatMetric(
  value: unknown,
  kindOrField?: MetricKind | string,
  label?: string,
): string {
  if (value === null || value === undefined || value === '') return '-'

  const kind: MetricKind =
    kindOrField && ['currency', 'quantity', 'count', 'percentage', 'date', 'period', 'duration', 'status', 'code', 'text'].includes(kindOrField)
      ? (kindOrField as MetricKind)
      : inferMetricKind(kindOrField, label)

  if (kind === 'period' || kind === 'status' || kind === 'code' || kind === 'text') {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value)
    }
    return String(value)
  }

  if (kind === 'date') {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
    }
    if (typeof value === 'string') {
      const date = new Date(value)
      if (!Number.isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(value)) {
        return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
      }
      return value
    }
  }

  const numeric = toFiniteNumber(value)
  if (numeric === null) {
    return typeof value === 'string' ? value : String(value)
  }

  switch (kind) {
    case 'currency':
      return formatCurrency(numeric)
    case 'quantity':
      return formatQuantity(numeric)
    case 'count':
      return formatCount(numeric)
    case 'percentage':
      // Accept either 0–1 or 0–100; values > 1 treated as already-percent
      return PCT.format(Math.abs(numeric) > 1 ? numeric / 100 : numeric)
    case 'duration':
      return formatNumber(numeric)
    default:
      return formatNumber(numeric)
  }
}

/** KPI helper: field-aware, never force Rp on count/qty/period. */
export function formatKpiValue(value: unknown, field?: string, label?: string): string {
  return formatMetric(value, field, label)
}
