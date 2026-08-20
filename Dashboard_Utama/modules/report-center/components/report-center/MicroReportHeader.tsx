'use client'

import { TrendingDown, TrendingUp } from 'lucide-react'

/**
 * MicroReportHeader — header "ticker tape" ala pasar saham untuk tiap panel
 * mikro-report (trend, komposisi, exception, analisis). Ticker kiri tegas,
 * statistik kanan dipisah divider vertikal — segmentasi antar panel terlihat.
 */

export type MicroReportStat = {
  label: string
  value: string
  /** Arah perubahan → warna hijau/merah ala bursa. */
  delta?: string
  deltaDir?: 'up' | 'down' | 'flat'
}

type MicroReportHeaderProps = {
  /** Label kecil caps-lock (mis. "TREND MOVEMENT"). */
  ticker: string
  /** Judul besar. */
  title: string
  /** Deskripsi satu baris di bawah judul. */
  subtitle?: string
  /** Statistik kanan — dipisah divider vertikal ala bursa. */
  stats?: MicroReportStat[]
  /** Aksen warna tepi kiri ticker. */
  accent?: 'emerald' | 'sky' | 'amber' | 'rose' | 'slate' | 'forest'
  className?: string
}

const accentBar: Record<NonNullable<MicroReportHeaderProps['accent']>, string> = {
  emerald: 'bg-emerald-400',
  sky: 'bg-sky-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  slate: 'bg-slate-400',
  forest: 'bg-[var(--rc-forest-accent)]',
}

const accentText: Record<NonNullable<MicroReportHeaderProps['accent']>, string> = {
  emerald: 'text-emerald-300',
  sky: 'text-sky-300',
  amber: 'text-amber-300',
  rose: 'text-rose-300',
  slate: 'text-slate-300',
  forest: 'text-[var(--rc-forest-accent)]',
}

function deltaClass(dir?: MicroReportStat['deltaDir']) {
  if (dir === 'up') return 'text-emerald-300'
  if (dir === 'down') return 'text-rose-300'
  return 'text-[var(--rc-text-faint)]'
}

export default function MicroReportHeader({
  ticker,
  title,
  subtitle,
  stats,
  accent = 'emerald',
  className,
}: MicroReportHeaderProps) {
  return (
    <div
      className={[
        'flex flex-wrap items-stretch justify-between gap-x-5 gap-y-2 border-b border-white/[0.08] pb-3',
        className ?? '',
      ].join(' ')}
    >
      <div className="flex min-w-0 items-stretch gap-3">
        <span className={`w-1 shrink-0 rounded-full ${accentBar[accent]}`} aria-hidden />
        <div className="min-w-0 py-0.5">
          <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${accentText[accent]}`}>
            {ticker}
          </p>
          <h3 className="mt-1 truncate text-xl font-black tracking-[-0.03em] text-[var(--rc-text)] sm:text-2xl">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-1 text-[11px] font-semibold leading-5 text-[var(--rc-text-muted)]">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {stats && stats.length > 0 ? (
        <dl className="flex shrink-0 items-stretch divide-x divide-white/10" aria-label="Statistik ringkas">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col justify-center px-4 first:pl-0 last:pr-0">
              <dt className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">
                {stat.label}
              </dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="rc-data text-base font-black leading-none text-[var(--rc-text)]">{stat.value}</span>
                {stat.delta ? (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-black ${deltaClass(stat.deltaDir)}`}>
                    {stat.deltaDir === 'up' ? <TrendingUp size={11} /> : stat.deltaDir === 'down' ? <TrendingDown size={11} /> : null}
                    {stat.delta}
                  </span>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}
