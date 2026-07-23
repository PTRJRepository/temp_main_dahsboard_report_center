'use client'

type InsightTickerProps = {
  items: string[]
}

/**
 * Baris insight ringkas — statis (calm-minimal).
 * Tidak marquee: mengurangi gerakan otomatis di deck agar mata fokus ke angka.
 * Item digulir manual via scroll horizontal bila melebihi lebar.
 */
export default function InsightTicker({ items }: InsightTickerProps) {
  if (!items || items.length === 0) return null

  return (
    <div
      className="relative overflow-hidden rounded-full border-[var(--rc-border)] bg-[rgba(3,14,10,.55)] py-1.5"
      aria-label="Insight ringkas"
    >
      <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((text, i) => (
          <span key={i} className="flex items-center gap-2 rc-data text-[11px] text-[var(--rc-text-muted)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--rc-forest-accent)]/70" aria-hidden />
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
