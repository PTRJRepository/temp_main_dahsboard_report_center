// ─── Number / Currency formatters ───────────────────────────────────────────

/** Amount / valuation always keep 4 decimal places (id-ID). */
const IDR_AMOUNT = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

const NUMBER = new Intl.NumberFormat('id-ID')

/**
 * Format money / valuation. Always 4 digits after decimal.
 * Large values stay full (not compact) so precision stays readable on KPI.
 */
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
