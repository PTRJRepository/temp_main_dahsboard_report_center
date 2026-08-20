'use client'

/**
 * Sparkline mini — tren halus tanpa lib chart, tanpa animasi berlebih.
 * Dipakai untuk memberi konteks "arah" pada sebuah angka KPI:
 * apakah naik/turun terhadap periode sebelumnya, dan bagaimana bentuknya.
 * Calm-minimal: satu warna netral; delta momentum pakai 2 warna fungsional
 * (emerald = naik/positif, amber = turun/perhatian).
 */

type SparklineProps = {
  /** Deret nilai (urut waktu, lama -> baru). Nilai non-finite di-skip. */
  values: number[]
  width?: number
  height?: number
  className?: string
}

function smoothPath(pts: Array<[number, number]>): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0][0]} ${pts[0][1]}`
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const mx = (x0 + x1) / 2
    d += ` C ${mx} ${y0}, ${mx} ${y1}, ${x1} ${y1}`
  }
  return d
}

export default function Sparkline({ values, width = 120, height = 34, className }: SparklineProps) {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length < 2) return null

  const min = Math.min(...clean)
  const max = Math.max(...clean)
  const span = max - min || 1
  const pad = 2
  const stepX = (width - pad * 2) / (clean.length - 1)
  const pts: Array<[number, number]> = clean.map((v, i) => [
    pad + i * stepX,
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ])

  const d = smoothPath(pts)
  const area = `${d} L ${pts[pts.length - 1][0]} ${height} L ${pts[0][0]} ${height} Z`
  const [lastX, lastY] = pts[pts.length - 1]

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <path d={area} fill="rgba(52,211,153,0.10)" />
      <path d={d} fill="none" stroke="rgba(52,211,153,0.85)" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r={2.2} fill="#34d399" stroke="#04130c" strokeWidth={1} />
    </svg>
  )
}

/** Delta momentum: perubahan terakhir vs rata-rata N periode sebelumnya. */
export function MomentumDelta({ values, lookback = 3 }: { values: number[]; lookback?: number }) {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length < 2) return null
  const last = clean[clean.length - 1]
  const prev = clean.slice(-1 - lookback, -1)
  if (prev.length === 0) return null
  const base = prev.reduce((a, b) => a + b, 0) / prev.length
  if (!Number.isFinite(base) || base === 0) return null
  const pct = ((last - base) / Math.abs(base)) * 100
  const up = pct >= 0
  const label = `${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%`
  return (
    <span
      className={`rc-data inline-flex items-center gap-1 text-[10px] ${
        up ? 'text-emerald-300/90' : 'text-amber-300/90'
      }`}
      title={`Momentum vs rata-rata ${prev.length} periode sebelumnya`}
    >
      {label}
    </span>
  )
}
