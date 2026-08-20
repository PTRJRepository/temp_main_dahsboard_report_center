'use client'

/**
 * TopNSelect — selector "Top N" yang seragam untuk semua panel top-list
 * (movers, fuel, return, product-type). Satu komponen agar konsisten.
 */
export default function TopNSelect({
  value,
  onChange,
  options = [5, 10, 12, 25, 50, 100],
  ariaLabel = 'Jumlah baris teratas',
}: {
  value: number
  onChange: (value: number) => void
  options?: number[]
  ariaLabel?: string
}) {
  return (
    <label className="flex items-center gap-1 text-[10px] font-semibold text-[var(--rc-text-faint)]">
      Top
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rounded-md border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-[var(--rc-text)] focus:outline-none"
        aria-label={ariaLabel}
      >
        {options.map((n) => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
    </label>
  )
}
