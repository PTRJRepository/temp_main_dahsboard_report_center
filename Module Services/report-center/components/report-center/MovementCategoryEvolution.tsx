'use client'

import { useMemo, useRef, useState } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import ScrollArea from './ScrollArea'

export type CategoryEvolutionPoint = {
  period: string
  categories: Record<string, { count: number; qty: number; amount: number }>
}

export type MovementMover = {
  code: string
  name: string
  fromCategory: string
  toCategory: string
  firstPeriod: string
  lastPeriod: string
  /** Periode pertama mencapai Fast Moving to-date (khusus mode akumulasi). */
  firstFastPeriod?: string | null
  totalQty: number
  totalAmount: number
}

type MovementCategoryEvolutionProps = {
  periods: string[]
  byPeriod: CategoryEvolutionPoint[]
  movers: MovementMover[]
  totals: { qty: number; amount: number; docs: number; itemCount: number }
  metric?: 'count' | 'qty' | 'amount'
  onMetricChange?: (metric: 'count' | 'qty' | 'amount') => void
  /** Mode perhitungan klasifikasi. */
  mode?: 'monthly' | 'cumulative'
  onModeChange?: (mode: 'monthly' | 'cumulative') => void
  /** Dimensi analisis: per item code vs per product type. */
  dimension?: 'item' | 'product-type'
  onDimensionChange?: (dimension: 'item' | 'product-type') => void
  /** Top-N baris movers yang ditampilkan. */
  topN?: number
  onTopNChange?: (topN: number) => void
  /** Range jendela frekuensi (indeks ke periods) — geser batas atas/bawah. */
  range?: { start: number; end: number }
  onRangeChange?: (range: { start: number; end: number }) => void
  loading?: boolean
  onDrilldown?: (item: { code: string; name: string }) => void
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const CATEGORY_ORDER = ['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock']
const TONE_FILL: Record<string, string> = {
  'Fast Moving': '#34d399',
  Moving: '#22d3ee',
  'Slow Moving': '#fbbf24',
  'Dead Stock': '#94a3b8',
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function periodLabel(period: string): string {
  const [y, m] = period.split('-')
  return `${MONTH_ID[(Number(m) - 1) % 12] ?? m} ${String(y).slice(2)}`
}

function CategoryGuidePopup({
  open,
  onClose,
  mode,
  metric,
}: {
  open: boolean
  onClose: () => void
  mode: 'monthly' | 'cumulative'
  metric: 'count' | 'qty' | 'amount'
}) {
  if (!open) return null
  const metricLabel = metric === 'count'
    ? 'jumlah barang (SKU) di tiap kategori'
    : metric === 'qty'
      ? 'qty issue barang di tiap kategori'
      : 'nilai (Rp) barang di tiap kategori — target: selaras valuasi bulan'
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-guide-title"
      onClick={onClose}
    >
      <div
        className="max-h-[min(88vh,760px)] w-full max-w-xl overflow-y-auto rounded-[24px] border border-emerald-300/25 bg-[linear-gradient(165deg,rgba(8,28,18,.98),rgba(4,14,10,.98))] p-4 shadow-[0_28px_80px_rgba(0,0,0,.55)] sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-200/80">Petunjuk baca</p>
            <h3 id="mc-guide-title" className="mt-1 text-lg font-black tracking-[-0.02em] text-[var(--rc-text)]">
              Komposisi barang per kategori movement tiap bulan
            </h3>
            <p className="mt-1 text-[12px] font-semibold leading-5 text-[var(--rc-text-muted)]">
              Mode: <span className="text-emerald-200">{mode === 'monthly' ? 'Per bulan' : 'Akumulasi'}</span>
              {' · '}metrik <span className="text-emerald-200">{metricLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-[var(--rc-text-muted)] hover:text-[var(--rc-text)]"
            aria-label="Tutup petunjuk"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-3 text-[13px] leading-6 text-[var(--rc-text-muted)]">
          <section className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.07] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100/85">Fokus utama (bukan Total Issue)</p>
            <p className="mt-1.5 text-[var(--rc-text)]">
              Chart ini <strong>mengelompokkan barang</strong> (SKU) ke Fast / Moving / Slow / Dead
              berdasarkan frekuensi issue di window. Bukan chart “total pemakaian bulan”.
            </p>
            <p className="mt-1.5">
              Idealnya saat metrik <strong className="text-emerald-100">Amount</strong>:
              Σ 4 kategori ≈ <strong className="text-emerald-100">Total Valuasi barang di bulan itu</strong>
              (nilai stok barang yang digolongkan), bukan Total Issue periode (barang yang sudah keluar).
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Maksud chart</p>
            <p className="mt-1.5">
              Tiap batang = <strong className="text-[var(--rc-text)]">satu bulan</strong>.
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li>Warna = <strong className="text-[var(--rc-text)]">kategori movement barang</strong> di bulan itu.</li>
              <li>Tinggi segmen = metrik barang di kategori itu (jumlah SKU / qty / nilai Rp).</li>
              <li>Tinggi batang total = Σ seluruh kategori bulan itu.</li>
              <li>Garis putus-putus = total yang sama (cek cek Σ warna = total).</li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Arti warna kategori</p>
            <ul className="mt-2 space-y-1.5">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#34d399]" />
                <span><strong className="text-emerald-200">Fast Moving</strong> — barang sering di-issue (default ≥ 6 event di window).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#22d3ee]" />
                <span><strong className="text-cyan-200">Moving</strong> — cukup aktif (biasanya 2–5 event).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#fbbf24]" />
                <span><strong className="text-amber-200">Slow Moving</strong> — jarang (biasanya 1 event).</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#94a3b8]" />
                <span><strong className="text-slate-200">Dead Stock</strong> — tidak ada issue di window (stok menganggur).</span>
              </li>
            </ul>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Cara baca cepat</p>
            <ol className="mt-1.5 list-decimal space-y-1 pl-4">
              <li>Lihat porsi warna dulu → mix Fast/Moving/Slow/Dead di bulan itu.</li>
              <li>Metrik Amount: porsi warna = porsi nilai barang (valuasi) per kategori.</li>
              <li>Metrik Jumlah: porsi = berapa banyak SKU di tiap kategori.</li>
              <li>Metrik Qty: porsi = qty issue barang di kategori (bukan valuasi).</li>
              <li>Bandingkan bulan ke bulan → apakah nilai Dead/Slow membesar.</li>
              <li>Porsi Dead/Slow naik = nilai stok macet naik — prioritas review.</li>
            </ol>
          </section>

          <section className="rounded-2xl border border-sky-300/20 bg-sky-400/[0.07] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-sky-100/85">Per bulan vs Akumulasi</p>
            <p className="mt-1.5">
              <strong className="text-sky-100">Per bulan</strong>: frekuensi dihitung ulang tiap bulan.
              Barang bisa Fast di Mei, Slow di Juni → pindah warna.
            </p>
            <p className="mt-1.5">
              <strong className="text-sky-100">Akumulasi</strong>: frekuensi to-date dalam jendela slider.
              Cocok lihat “siapa sudah Fast sampai bulan ini”.
            </p>
          </section>

          <section className="rounded-2xl border border-amber-300/20 bg-amber-400/[0.08] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-amber-100/85">Contoh sampel</p>
            <p className="mt-1.5 text-[var(--rc-text)]">
              Mei (Amount): batang total ≈ valuasi bulan, hijau Fast besar → banyak nilai stok di barang sering gerak.
            </p>
            <p className="mt-1">
              Jun: total valuasi mirip, abu Dead membesar → nilai stok “mati” naik walau total mirip.
              Cek movers “Moving → Dead/Slow”.
            </p>
            <p className="mt-1">
              Jul: Dead + Slow mendominasi → mayoritas nilai stok jarang/tidak bergerak; prioritaskan review Dead.
            </p>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">Kontrol penting</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              <li><strong className="text-[var(--rc-text)]">Jumlah</strong> — berapa SKU per kategori.</li>
              <li><strong className="text-[var(--rc-text)]">Qty</strong> — qty issue per kategori (bukan valuasi).</li>
              <li><strong className="text-[var(--rc-text)]">Amount</strong> — nilai barang per kategori (arah valuasi bulan).</li>
              <li><strong className="text-[var(--rc-text)]">Slider jendela</strong> — rentang bulan hitung frekuensi.</li>
              <li><strong className="text-[var(--rc-text)]">Movers</strong> — barang pindah kategori; klik drill-down.</li>
            </ul>
          </section>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-3 py-2.5 text-sm font-black text-emerald-50 transition hover:bg-emerald-400/25"
        >
          Mengerti — tutup petunjuk
        </button>
      </div>
    </div>
  )
}

export default function MovementCategoryEvolution({
  periods,
  byPeriod,
  movers,
  totals,
  metric = 'count',
  onMetricChange,
  mode = 'monthly',
  onModeChange,
  dimension = 'item',
  onDimensionChange,
  topN = 12,
  onTopNChange,
  range,
  onRangeChange,
  loading,
  onDrilldown,
}: MovementCategoryEvolutionProps) {
  const [sortKey, setSortKey] = useState<'amount' | 'qty'>('amount')
  const [guideOpen, setGuideOpen] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragTarget = useRef<'start' | 'end' | null>(null)
  const [dragging, setDragging] = useState(false)

  const lastIndex = periods.length - 1
  const selStart = Math.max(0, Math.min(range?.start ?? 0, lastIndex))
  const selEnd = Math.max(selStart, Math.min(range?.end ?? lastIndex, lastIndex))

  const points = useMemo(() => {
    return byPeriod.map((p) => {
      const row: Record<string, number | string> = { period: p.period, label: periodLabel(p.period) }
      let total = 0
      for (const category of CATEGORY_ORDER) {
        const v = p.categories[category]?.[metric] ?? 0
        row[category] = v
        total += v
      }
      row.total = total
      return row
    })
  }, [byPeriod, metric])

  const sortedMovers = useMemo(() => {
    const key = sortKey === 'qty' ? 'totalQty' : 'totalAmount'
    return [...movers].sort((a, b) => b[key] - a[key]).slice(0, 12)
  }, [movers, sortKey])

  if (loading && periods.length === 0) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03]">
        <p className="rc-data text-[11px] text-[var(--rc-text-faint)]">Memuat evolusi kategori…</p>
      </div>
    )
  }

  if (periods.length === 0) {
    return (
      <div className="grid h-full min-h-[260px] place-items-center rounded-[24px] border-white/10 bg-white/[0.03] p-4 text-center">
        <p className="text-sm font-bold text-[var(--rc-text-muted)]">Belum ada data evolusi kategori untuk filter ini.</p>
        <p className="rc-data mt-1 text-[11px] text-[var(--rc-text-faint)]">Ubah periode, lokasi, atau tipe barang.</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[13px] font-semibold text-[var(--rc-text)]">
              Komposisi nilai barang per kategori tiap bulan{mode === 'cumulative' ? ' · akumulasi' : ''}
            </p>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:bg-emerald-400/20"
              title="Buka petunjuk cara baca chart"
            >
              <HelpCircle size={12} />
              Cara baca
            </button>
          </div>
          <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
            {metric === 'count' && `Total ${totals.itemCount} barang digolongkan · ${movers.length} pindah kategori`}
            {metric === 'qty' && `Total qty di kategori ${formatCompact(totals.qty)}`}
            {metric === 'amount' && `Σ valuasi stok per kategori Rp ${formatCompact(totals.amount)}`}
            {' · '}Amount = valuasi stok barang (bukan issue flow)
            {' · '}klik “Cara baca”
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onDimensionChange ? (
            <div className="flex gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Dimensi analisis">
              {([['item', 'Per item'], ['product-type', 'Product type']] as const).map(([dim, label]) => (
                <button
                  key={dim}
                  type="button"
                  role="tab"
                  aria-selected={dimension === dim}
                  onClick={() => onDimensionChange(dim)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    dimension === dim ? 'bg-amber-400/20 text-amber-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          {onModeChange ? (
            <div className="flex gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist" aria-label="Mode perhitungan frekuensi">
              {(['monthly', 'cumulative'] as const).map((mm) => (
                <button
                  key={mm}
                  type="button"
                  role="tab"
                  aria-selected={mode === mm}
                  onClick={() => onModeChange(mm)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    mode === mm ? 'bg-sky-400/20 text-sky-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
                  }`}
                >
                  {mm === 'monthly' ? 'Per bulan' : 'Akumulasi'}
                </button>
              ))}
            </div>
          ) : null}
          {onMetricChange ? (
            <div className="flex shrink-0 gap-1 rounded-full border-white/10 bg-white/[0.04] p-0.5" role="tablist">
              {(['count', 'qty', 'amount'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={metric === m}
                  onClick={() => onMetricChange(m)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                    metric === m ? 'bg-emerald-400/20 text-emerald-100' : 'text-[var(--rc-text-muted)] hover:bg-white/[0.06]'
                  }`}
                >
                  {m === 'count' ? 'Jumlah' : m === 'qty' ? 'Qty' : 'Valuasi'}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Slider batas atas & bawah jendela frekuensi — geser untuk mengubah periode hitung. */}
      {onRangeChange && lastIndex > 0 ? (
        <div className="mb-2 rounded-xl border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="rc-data text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
              {mode === 'cumulative' ? 'Jendela akumulasi frekuensi' : 'Jendela frekuensi'}
            </span>
            <span className="rc-data text-[10px] font-bold text-[var(--rc-forest-accent)]" aria-live="polite">
              {periodLabel(periods[selStart])} → {periodLabel(periods[selEnd])} · {selEnd - selStart + 1} bln
            </span>
          </div>
          <div
            ref={trackRef}
            className={`relative h-6 select-none touch-none ${dragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
            onPointerDown={(event) => {
              if (lastIndex <= 0) return
              const rect = trackRef.current?.getBoundingClientRect()
              if (!rect || rect.width <= 0) return
              const idx = Math.max(0, Math.min(lastIndex, Math.round(((event.clientX - rect.left) / rect.width) * lastIndex)))
              if (Math.abs(idx - selStart) <= Math.abs(idx - selEnd)) onRangeChange({ start: Math.min(idx, selEnd), end: selEnd })
              else onRangeChange({ start: selStart, end: Math.max(idx, selStart) })
            }}
            onPointerMove={(event) => {
              if (dragTarget.current == null || lastIndex <= 0) return
              const rect = trackRef.current?.getBoundingClientRect()
              if (!rect || rect.width <= 0) return
              const idx = Math.max(0, Math.min(lastIndex, Math.round(((event.clientX - rect.left) / rect.width) * lastIndex)))
              if (dragTarget.current === 'start') onRangeChange({ start: Math.min(idx, selEnd), end: selEnd })
              else onRangeChange({ start: selStart, end: Math.max(idx, selStart) })
            }}
            onPointerUp={(event) => {
              dragTarget.current = null
              setDragging(false)
              ;(event.target as Element).releasePointerCapture?.(event.pointerId)
            }}
            onPointerCancel={() => {
              dragTarget.current = null
              setDragging(false)
            }}
            role="group"
            aria-label="Jendela frekuensi perhitungan movement"
          >
            <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-white/[0.08]" />
            <div
              className="absolute top-2.5 h-1.5 rounded-full bg-[var(--rc-forest-accent)]/70"
              style={{ left: `${(selStart / lastIndex) * 100}%`, width: `${((selEnd - selStart) / lastIndex) * 100}%` }}
            />
            {([['start', selStart], ['end', selEnd]] as const).map(([which, idx]) => (
              <button
                key={which}
                type="button"
                className="absolute top-1 z-10 grid h-[18px] w-3 -translate-x-1/2 cursor-ew-resize place-items-center rounded border-[var(--rc-forest-accent)]/70 bg-[#05130c] shadow hover:bg-[var(--rc-forest-accent)]/20"
                style={{ left: `${(idx / lastIndex) * 100}%` }}
                onPointerDown={(event) => {
                  event.preventDefault()
                  dragTarget.current = which
                  setDragging(true)
                  ;(event.target as Element).setPointerCapture?.(event.pointerId)
                }}
                role="slider"
                aria-label={which === 'start' ? 'Batas bawah jendela' : 'Batas atas jendela'}
                aria-valuemin={0}
                aria-valuemax={lastIndex}
                aria-valuenow={idx}
                aria-valuetext={periodLabel(periods[idx])}
                title={periodLabel(periods[idx])}
              >
                <span className="block h-2 w-0.5 rounded bg-[var(--rc-forest-accent)]" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={{ stroke: 'rgba(255,255,255,0.12)' }} tickLine={false} minTickGap={18} />
            <YAxis tick={{ fill: '#8fa89c', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
            <Tooltip
              contentStyle={{ background: '#0a1510', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, fontSize: 11 }}
              labelStyle={{ color: '#a7f3d0', fontWeight: 700 }}
              formatter={(value, name) => [metric === 'amount' ? `Rp ${formatCompact(Number(value))}` : formatCompact(Number(value)), name]}
              labelFormatter={(label) => `${label} · total ${metric === 'amount' ? 'Rp ' : ''}${formatCompact(Number((points.find((pt) => pt.label === label)?.total as number) ?? 0))}`}
            />
            {CATEGORY_ORDER.map((category) => (
              <Bar key={category} dataKey={category} stackId="a" fill={TONE_FILL[category]} radius={[2, 2, 0, 0]} maxBarSize={24} />
            ))}
            <Line type="monotone" dataKey="total" stroke="#a7f3d0" strokeWidth={2} dot={false} strokeDasharray="5 4" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 rounded-xl border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold leading-4 text-[var(--rc-text-faint)]">
        Cara baca: warna = kategori barang (Fast/Moving/Slow/Dead) · tinggi segmen = metrik barang di kategori · Σ 4 warna = total bulan (Amount ≈ Total Valuasi).
        <button type="button" onClick={() => setGuideOpen(true)} className="ml-1 font-black text-emerald-200 underline-offset-2 hover:underline">
          Lihat contoh
        </button>
      </p>

      <CategoryGuidePopup open={guideOpen} onClose={() => setGuideOpen(false)} mode={mode} metric={metric} />

      {movers.length > 0 && (
        <ScrollArea className="mt-3 min-h-0 flex-1 border-t border-white/[0.06] pt-2">
          <div className="mb-1.5 flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-[var(--rc-text)]">
              {dimension === 'product-type'
                ? `Product type ${mode === 'cumulative' ? 'to-date' : 'berpindah kategori'}`
                : mode === 'cumulative' ? 'Riwayat kategori to-date' : 'Barang berpindah kategori'}
            </p>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {(['amount', 'qty'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setSortKey(k)}
                    className={`text-[10px] font-semibold ${sortKey === k ? 'text-emerald-200' : 'text-[var(--rc-text-faint)]'}`}
                  >
                    {k === 'amount' ? 'Amount' : 'Qty'}
                  </button>
                ))}
              </div>
              {onTopNChange ? (
                <label className="flex items-center gap-1 text-[10px] font-semibold text-[var(--rc-text-faint)]">
                  Top
                  <select
                    value={topN}
                    onChange={(event) => onTopNChange(Number(event.target.value))}
                    className="rounded-md border-white/10 bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-bold text-[var(--rc-text)] focus:outline-none"
                    aria-label="Jumlah baris teratas"
                  >
                    {[5, 10, 12, 25, 50, 100].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          </div>
          <ul className="space-y-1">
            {sortedMovers.map((mover) => (
              <li key={mover.code}>
                <button
                  type="button"
                  onClick={() => onDrilldown?.({ code: mover.code, name: mover.name })}
                  className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left hover:bg-white/[0.05]"
                >
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-[var(--rc-text)]">
                    {mover.name}
                  </span>
                  <span className="rc-data text-[10px] text-[var(--rc-text-muted)]">
                    {mover.fromCategory} → {mover.toCategory}
                  </span>
                  <span className="rc-data shrink-0 text-[10px] text-[var(--rc-text-muted)]">
                    Rp {formatCompact(mover.totalAmount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </ScrollArea>
      )}
    </div>
  )
}
