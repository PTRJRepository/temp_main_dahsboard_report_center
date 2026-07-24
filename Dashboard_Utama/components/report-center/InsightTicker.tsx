'use client'

/**
 * InsightTicker — pita insight ala market ticker (crypto/finance).
 *
 * Baris insight berjalan halus (marquee) di dalam pill; berhenti saat hover /
 * focus agar tetap bisa dibaca. Satu dot pulsa emerald di kiri sebagai penanda
 * "live". Konten diduplikasi agar loop mulus tanpa lompatan.
 * Menghormati prefers-reduced-motion: statis (scroll manual) bila user minta.
 * Catatan: animasi memakai kelas utilitas `rc-ticker-track` (globals.css),
 * BUKAN arbitrary `animate-[...]` Tailwind, agar tidak bergantung build CSS.
 */

type InsightTickerProps = {
  items: string[]
}

export default function InsightTicker({ items }: InsightTickerProps) {
  if (!items || items.length === 0) return null

  const renderItems = (ariaHidden: boolean) =>
    items.map((text, i) => (
      <span
        key={`${ariaHidden ? 'b' : 'a'}-${i}`}
        aria-hidden={ariaHidden}
        className="rc-data flex items-center gap-2 whitespace-nowrap text-[11px] text-[var(--rc-text-muted)]"
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-300/70" />
        {text}
      </span>
    ))

  return (
    <div
      className="group/ticker relative flex items-center gap-2 overflow-hidden rounded-full border-white/10 bg-[rgba(3,14,10,.55)] py-1.5 pl-2 pr-3"
      aria-label="Insight ringkas"
      role="marquee"
    >
      {/* Penanda live — pulsa halus */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300/50 [animation-duration:1.8s]" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300/90" />
      </span>

      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
        <div className="rc-ticker-track flex w-max items-center gap-8 group-hover/ticker:[animation-play-state:paused]">
          {renderItems(false)}
          {renderItems(true)}
        </div>
      </div>
    </div>
  )
}
