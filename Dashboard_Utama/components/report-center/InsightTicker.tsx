'use client'

type InsightTickerProps = {
  items: string[]
}

export default function InsightTicker({ items }: InsightTickerProps) {
  if (!items || items.length === 0) return null

  // Gandakan untuk loop marquee mulus.
  const loop = [...items, ...items]

  return (
    <div
      className="relative overflow-hidden rounded-full border-[var(--rc-border)] bg-[rgba(3,14,10,.55)] py-1.5"
      aria-label="Insight ringkas"
    >
      <div className="rc-ticker-track flex w-max items-center gap-8 whitespace-nowrap px-4">
        {loop.map((text, i) => (
          <span key={i} className="flex items-center gap-2 rc-data text-[11px] text-[var(--rc-text)]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--rc-forest-accent)]" aria-hidden />
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}
