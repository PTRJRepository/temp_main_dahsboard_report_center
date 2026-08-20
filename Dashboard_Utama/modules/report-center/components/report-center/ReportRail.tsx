'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * ReportRail — sliding rail horizontal untuk report catalog (satu rail per group).
 *
 * Behaviour unik (bukan grid generik):
 * - Native scroll-snap x mandatory (GPU, tanpa lib) — kartu "terkunci" saat geser.
 * - Tombol prev/next bergaya rel/lift: label posisi "03 / 12" yang ikut bergerak.
 * - Edge fade kiri/kanan via mask-image — sinyal masih ada kartu di luar viewport.
 * - Tombol prev/next auto-disable di ujung; drag/swipe tetap bebas.
 * - Kartu aktif (selected) "terangkat" via prop render (parent yang tentukan).
 *
 * Visual mengikuti technical-luxury forest: hairline, chip mono, tanpa glow berwarna.
 */

type ReportRailProps = {
  children: React.ReactNode[]
  ariaLabel: string
  /** ID unik rail untuk aria/anchor. */
  railId?: string
}

export default function ReportRail({ children, ariaLabel, railId }: ReportRailProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [total, setTotal] = useState(children.length)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  const count = children.length

  const recompute = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-rail-card]')
    const step = card ? card.offsetWidth + 12 : el.clientWidth // 12 = gap-3
    const maxIndex = Math.max(0, count - Math.max(1, Math.floor(el.clientWidth / step)))
    setTotal(count)
    const next = Math.round(el.scrollLeft / step)
    setIndex(Math.min(next, maxIndex))
    setAtStart(el.scrollLeft <= 4)
    setAtEnd(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4)
  }, [count])

  useEffect(() => {
    // Tunda ke frame berikutnya agar tidak setState sinkron di body effect
    // (aturan react-hooks/set-state-in-effect). Initial measure tetap jalan.
    const raf = requestAnimationFrame(() => recompute())
    const el = trackRef.current
    if (!el) return () => cancelAnimationFrame(raf)
    const onScroll = () => recompute()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [recompute])

  const go = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-rail-card]')
    const step = card ? card.offsetWidth + 12 : el.clientWidth
    // Geser ~1 viewport kartu (bukan 1 kartu) agar terasa seperti "halaman rail".
    const visible = Math.max(1, Math.floor(el.clientWidth / step))
    el.scrollBy({ left: dir * step * visible, behavior: 'smooth' })
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <div className="group/rail relative" aria-roledescription="carousel" aria-label={ariaLabel} id={railId}>
      {/* Track */}
      <div
        ref={trackRef}
        className="rc-rail-track flex gap-3 overflow-x-auto scroll-smooth pb-1 pr-1"
        style={{
          scrollSnapType: 'x mandatory',
          maskImage: atStart && atEnd
            ? undefined
            : atStart
              ? 'linear-gradient(to right, black 88%, transparent 100%)'
              : atEnd
                ? 'linear-gradient(to right, transparent 0%, black 12%)'
                : 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
          WebkitMaskImage: atStart && atEnd
            ? undefined
            : atStart
              ? 'linear-gradient(to right, black 88%, transparent 100%)'
              : atEnd
                ? 'linear-gradient(to right, transparent 0%, black 12%)'
                : 'linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)',
        }}
      >
        {children.map((child, i) => (
          <div
            key={i}
            data-rail-card
            className="w-[268px] shrink-0 sm:w-[292px]"
            style={{ scrollSnapAlign: 'start' }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Rail controls — posisi + prev/next */}
      {total > 1 ? (
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-full border-[var(--rc-forest-border)] bg-black/25 px-3 py-1 text-[11px] font-bold text-[var(--rc-text-faint)]"
            style={{ fontFamily: 'var(--font-data)' }}
            aria-live="polite"
          >
            <span className="text-[var(--rc-forest-accent)]">{pad(Math.min(index + 1, total))}</span>
            <span className="opacity-40">/</span>
            <span>{pad(total)}</span>
          </span>

          <div className="flex items-center gap-1.5">
            {/* progress hairline */}
            <span className="relative hidden h-px w-24 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden="true">
              <span
                className="absolute left-0 top-0 h-full bg-[var(--rc-forest-accent)] transition-[width] duration-300"
                style={{ width: total > 1 ? `${(Math.min(index + 1, total) / total) * 100}%` : '0%' }}
              />
            </span>
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={atStart}
              aria-label="Geser rail ke kiri"
              className="grid h-8 w-8 place-items-center rounded-full border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.09] hover:text-[var(--rc-text)] disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={atEnd}
              aria-label="Geser rail ke kanan"
              className="grid h-8 w-8 place-items-center rounded-full border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:bg-white/[0.09] hover:text-[var(--rc-text)] disabled:cursor-not-allowed disabled:opacity-25"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
