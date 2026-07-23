'use client'

import { useMemo, useState } from 'react'

type StockRiverChartProps = {
  opening: number
  goodsReceive: number
  ledger: number
  station: number
  vehicle: number
  closing: number
  loading?: boolean
}

type Channel = {
  key: string
  label: string
  value: number
  color: string
}

const W = 760
const H = 250
const COL1_X = 12
const COL2_X = 268
const COL3_X = 548
const NODE_W = 18
const TOP = 16
const BOTTOM = H - 34
const SPAN = BOTTOM - TOP

function clampQty(value: number) {
  return Number.isFinite(value) && value > 0 ? value : 0
}

function fmt(value: number) {
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function ribbon(x1: number, y1a: number, y1b: number, x2: number, y2a: number, y2b: number) {
  const mx = (x1 + x2) / 2
  return [
    `M ${x1} ${y1a}`,
    `C ${mx} ${y1a}, ${mx} ${y2a}, ${x2} ${y2a}`,
    `L ${x2} ${y2b}`,
    `C ${mx} ${y2b}, ${mx} ${y1b}, ${x1} ${y1b}`,
    'Z',
  ].join(' ')
}

export default function StockRiverChart({
  opening,
  goodsReceive,
  ledger,
  station,
  vehicle,
  closing,
  loading,
}: StockRiverChartProps) {
  const [active, setActive] = useState<string | null>(null)

  const model = useMemo(() => {
    const open = clampQty(opening)
    const gr = clampQty(goodsReceive)
    const led = clampQty(ledger)
    const sta = clampQty(station)
    const veh = clampQty(vehicle)
    const close = clampQty(closing)

    const inflows: Channel[] = [{ key: 'gr', label: 'Goods Receive', value: gr, color: '#818cf8' }]
    const outflows: Channel[] = [
      { key: 'ledger', label: 'Issue Ledger', value: led, color: '#fb7185' },
      { key: 'station', label: 'Issue Station', value: sta, color: '#2dd4bf' },
      { key: 'vehicle', label: 'Issue Vehicle', value: veh, color: '#fb923c' },
    ]

    const leftTotal = open + gr
    const rightTotal = led + sta + veh + close
    const scaleTotal = Math.max(leftTotal, rightTotal, 1)
    const unit = SPAN / scaleTotal

    // Kolom 1: Opening menempati porsi `open` dari total kiri.
    const openH = open * unit
    const openY = TOP + (SPAN - leftTotal * unit) / 2

    // Kolom 2 kanal ditata berurutan di tengah; receive di atas, issue di bawah.
    const channelTotal = gr + led + sta + veh
    const chanStart = TOP + (SPAN - channelTotal * unit) / 2
    let cursor = chanStart
    const chanPos: Record<string, { y: number; h: number }> = {}
    for (const c of [...inflows, ...outflows]) {
      const h = c.value * unit
      chanPos[c.key] = { y: cursor, h }
      cursor += h
    }

    // Kolom 3: Closing.
    const closeH = close * unit
    const closeY = TOP + (SPAN - closeH) / 2

    const imbalance = open + gr - (led + sta + veh) - close

    return { open, gr, led, sta, veh, close, openY, openH, closeY, closeH, chanPos, inflows, outflows, imbalance, unit }
  }, [opening, goodsReceive, ledger, station, vehicle, closing])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border-[var(--rc-border)] bg-[rgba(3,14,10,.5)]">
        <span className="rc-data text-xs text-[var(--rc-text-faint)]">Memuat alur stok…</span>
      </div>
    )
  }

  const hasData = model.open + model.gr + model.led + model.sta + model.veh + model.close > 0
  if (!hasData) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border-[var(--rc-border)] bg-[rgba(3,14,10,.5)]">
        <span className="rc-data text-xs text-[var(--rc-text-faint)]">Belum ada data alur untuk periode ini</span>
      </div>
    )
  }

  const dim = (key: string) => (active && active !== key ? 0.14 : 0.78)
  const nodeDim = (key: string) => (active && active !== key ? 0.3 : 1)

  const openRightX = COL1_X + NODE_W
  const chanLeftX = COL2_X
  const chanRightX = COL2_X + NODE_W
  const closeLeftX = COL3_X

  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border-[var(--rc-border)] bg-[rgba(3,14,10,.5)] px-3 py-2">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rc-data text-[10px] uppercase tracking-[0.16em] text-[var(--rc-text-faint)]">Alur stok periode</span>
        {Math.abs(model.imbalance) > 0.5 ? (
          <span className="rounded-full border-white/10 bg-white/[0.035] px-2 py-0.5 rc-data text-[10px] text-[var(--rc-text-faint)]" title="opening + receive − issue − closing">
            selisih {model.imbalance > 0 ? '+' : ''}{fmt(model.imbalance)}
          </span>
        ) : null}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img" aria-label="Sankey alur stok">
        {/* pita: opening -> kanal (opening mengalir ke seluruh kanal secara proporsional via receive+issue) */}
        {[...model.inflows, ...model.outflows].map((c) => {
          const p = model.chanPos[c.key]
          if (!p || p.h <= 0 || model.openH <= 0) return null
          return (
            <path
              key={`in-${c.key}`}
              d={ribbon(openRightX, model.openY, model.openY + model.openH, chanLeftX, p.y, p.y + p.h)}
              fill={c.color}
              fillOpacity={dim(c.key) * 0.28}
              onMouseEnter={() => setActive(c.key)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`Opening → ${c.label}: ${fmt(c.value)}`}</title>
            </path>
          )
        })}

        {/* pita: kanal -> closing (hanya kanal receive yang mengalir langsung ke closing secara visual; issue berakhir di kanal) */}
        {model.inflows.map((c) => {
          const p = model.chanPos[c.key]
          if (!p || p.h <= 0 || model.closeH <= 0) return null
          return (
            <path
              key={`out-${c.key}`}
              d={ribbon(chanRightX, p.y, p.y + p.h, closeLeftX, model.closeY, model.closeY + model.closeH)}
              fill={c.color}
              fillOpacity={dim(c.key) * 0.4}
              onMouseEnter={() => setActive(c.key)}
              onMouseLeave={() => setActive(null)}
            >
              <title>{`${c.label} → Closing: ${fmt(c.value)}`}</title>
            </path>
          )
        })}

        {/* node opening */}
        <rect x={COL1_X} y={model.openY} width={NODE_W} height={Math.max(model.openH, 2)} rx={3} fill="#34d399" fillOpacity={nodeDim('opening')} />
        <text x={COL1_X} y={model.openY - 5} className="rc-data" fontSize={10} fill="#7ea88f">Opening</text>
        <text x={COL1_X} y={model.openY + model.openH + 14} className="rc-data" fontSize={11} fontWeight={700} fill="#d7ffe9">{fmt(model.open)}</text>

        {/* node kanal */}
        {[...model.inflows, ...model.outflows].map((c) => {
          const p = model.chanPos[c.key]
          if (!p) return null
          return (
            <g key={`node-${c.key}`} opacity={nodeDim(c.key)} onMouseEnter={() => setActive(c.key)} onMouseLeave={() => setActive(null)}>
              <rect x={COL2_X} y={p.y} width={NODE_W} height={Math.max(p.h, 2)} rx={3} fill={c.color} />
              <text x={COL2_X + NODE_W + 8} y={p.y + Math.max(p.h, 2) / 2 + 3} className="rc-data" fontSize={10} fill="#b9d8c6">
                {c.label} · {fmt(c.value)}
              </text>
            </g>
          )
        })}

        {/* node closing */}
        <rect x={COL3_X} y={model.closeY} width={NODE_W} height={Math.max(model.closeH, 2)} rx={3} fill="#34d399" fillOpacity={nodeDim('closing')} />
        <text x={COL3_X} y={model.closeY - 5} className="rc-data" fontSize={10} fill="#7ea88f">Closing</text>
        <text x={COL3_X} y={model.closeY + model.closeH + 14} className="rc-data" fontSize={11} fontWeight={700} fill="#d7ffe9">{fmt(model.close)}</text>
      </svg>
    </div>
  )
}
