'use client'

/**
 * MarketTicker — pita KPI berjalan ala papan bursa/market.
 *
 * Setiap butir menampilkan LABEL + nilai (+ delta ▲/▼ opsional) yang berjalan
 * halus (marquee); berhenti saat hover/focus agar tetap terbaca. Konten
 * diduplikasi agar loop mulus tanpa lompatan. Menghormati prefers-reduced-motion
 * (statis, scroll manual). Animasi via kelas `rc-ticker-track` (globals.css).
 */

export type MarketTickerItem = {
  label: string
  value: string
  /** Positif = emerald ▲, negatif = rose ▼, undefined = tanpa delta. */
  deltaPct?: number
}

type MarketTickerProps = {
  items: MarketTickerItem[]
}

export default function MarketTicker({ items }: MarketTickerProps) {
  if (!items || items.length === 0) return null

  const renderItems = (ariaHidden: boolean) =>
    items.map((item, i) => {
      const up = typeof item.deltaPct === 'number' && item.deltaPct > 0
      const down = typeof item.deltaPct === 'number' && item.deltaPct < 0
      return (
        <span
          key={`${ariaHidden ? 'b' : 'a'}-${i}`}
          aria-hidden={ariaHidden}
          className="rc-data flex items-center gap-2 whitespace-nowrap text-[11px]"
        >
          <span className="font-semibold uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">{item.label}</span>
          <span className="font-bold text-[var(--rc-text)]">{item.value}</span>
          {typeof item.deltaPct === 'number' ? (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                up
                  ? 'bg-emerald-400/15 text-emerald-200'
                  : down
                    ? 'bg-rose-400/15 text-rose-200'
                    : 'bg-white/[0.06] text-[var(--rc-text-muted)]'
              }`}
            >
              {up ? '▲' : down ? '▼' : '•'} {Math.abs(item.deltaPct).toFixed(1)}%
            </span>
          ) : null}
        </span>
      )
    })

  return (
    <div
      className="group/ticker relative flex items-center gap-2 overflow-hidden rounded-full border-white/10 bg-[rgba(2,9,6,.72)] py-1.5 pl-3 pr-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]"
      aria-label="Pita KPI berjalan"
      role="marquee"
    >
      {/* Penanda live — pulsa halus */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/50 [animation-duration:1.8s]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/90" />
      </span>
      <span className="rc-data shrink-0 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-200/80">Live</span>

      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <div className="rc-ticker-track flex w-max items-center gap-10 group-hover/ticker:[animation-play-state:paused]">
          {renderItems(false)}
          {renderItems(true)}
        </div>
      </div>
    </div>
  )
}
