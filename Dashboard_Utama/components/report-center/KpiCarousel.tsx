'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

type KpiCarouselProps = {
  children: React.ReactNode[]
  ariaLabel: string
}

/**
 * Snap-scroll carousel untuk KPI cards — dynamic slide cards.
 * Native scroll-snap (GPU, tanpa lib) + tombol prev/next + dot indicator.
 */
export default function KpiCarousel({ children, ariaLabel }: KpiCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [pages, setPages] = useState(1)

  const recompute = useCallback(() => {
    const el = trackRef.current
    if (!el) return
    const pageWidth = el.clientWidth
    setPages(Math.max(1, Math.ceil(el.scrollWidth / pageWidth)))
    setActive(Math.round(el.scrollLeft / pageWidth))
  }, [])

  useEffect(() => {
    recompute()
    const el = trackRef.current
    if (!el) return
    const onScroll = () => {
      const pageWidth = el.clientWidth || 1
      setActive(Math.round(el.scrollLeft / pageWidth))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(recompute)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [recompute])

  const go = (dir: -1 | 1) => {
    const el = trackRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' })
  }

  const goTo = (index: number) => {
    const el = trackRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <div className="group/carousel relative" aria-roledescription="carousel" aria-label={ariaLabel}>
      <div
        ref={trackRef}
        className="rc-carousel-track grid auto-cols-[minmax(248px,78%)] grid-flow-col gap-2 overflow-x-auto scroll-smooth pb-1 sm:auto-cols-[minmax(248px,46%)] xl:auto-cols-[minmax(260px,31.5%)]"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {children.map((child, i) => (
          <div key={i} style={{ scrollSnapAlign: 'start' }} className="min-w-0">
            {child}
          </div>
        ))}
      </div>

      {pages > 1 ? (
        <div className="mt-2 flex items-center justify-between">
          <div className="flex gap-1.5" role="tablist" aria-label="Halaman kartu">
            {Array.from({ length: pages }).map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={`Halaman ${i + 1}`}
                onClick={() => goTo(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  active === i
                    ? 'w-6 bg-[var(--rc-forest-accent)]'
                    : 'w-1.5 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={active === 0}
              aria-label="Geser kiri"
              className="grid h-7 w-7 place-items-center rounded-full border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:text-[var(--rc-text)] disabled:opacity-30"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={active >= pages - 1}
              aria-label="Geser kanan"
              className="grid h-7 w-7 place-items-center rounded-full border-[var(--rc-forest-border)] bg-white/[0.05] text-[var(--rc-text-muted)] transition hover:border-[var(--rc-forest-border-strong)] hover:text-[var(--rc-text)] disabled:opacity-30"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
