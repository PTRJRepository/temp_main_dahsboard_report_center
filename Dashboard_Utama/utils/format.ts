// ─── Number / Currency formatters ───────────────────────────────────────────

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const NUMBER = new Intl.NumberFormat('id-ID')

export function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)}B`
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1)}M`
  }
  return IDR.format(value)
}

export function formatCurrencyFull(value: number): string {
  return IDR.format(value)
}

export function formatNumber(value: number): string {
  return NUMBER.format(value)
}

export function formatCompact(value: number): string {
  return NUMBER.format(value)
}
