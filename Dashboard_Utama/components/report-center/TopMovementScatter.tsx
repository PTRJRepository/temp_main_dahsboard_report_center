'use client'

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * TopMovementScatter — sebaran barang dengan movement tertinggi.
 *
 * Horizontal bar Top-N item dari `issueFrequency.topItems` (by frekuensi dokumen
 * issue) dengan fallback `topLists.items` (by amount). Toggle metrik:
 * [Qty | Amount | Frekuensi]. Tooltip menampilkan ketiga metrik + nama item.
 * Warna bar gradasi forest (terang → gelap) sebagai penanda peringkat.
 */

type ItemRow = {
  code?: string
  name?: string
  docs?: number | string
  events?: number | string
  qty?: number | string
  amount?: number | string
}

type TopMovementScatterProps = {
  items: ItemRow[]
  loading?: boolean
  /** Jumlah bar yang ditampilkan. */
  top?: number
}

type MetricKey = 'qty' | 'amount' | 'docs'

const METRIC_LABEL: Record<MetricKey, string> = {
  qty: 'Qty',
  amount: 'Amount',
  docs: 'Frekuensi',
}

// Calm-minimal: gradasi forest -> abu netral (bukan pelangi)
const BAR_COLORS = ['#34d399', '#3bb98f', '#419f86', '#47857c', '#4d6b73', '#535f63', '#565a5c', '#525254', '#4c4a4d', '#464547']

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

export default function TopMovementScatter({ items, loading, top = 10 }: TopMovementScatterProps) {
  const [metric, setMetric] = useState<MetricKey>('docs')

  const rows = useMemo(() => {
    return (items ?? [])
      .map((row) => ({
        code: row.code ?? '—',
        name: row.name ?? '',
        qty: Number(row.qty ?? 0) || 0,
        amount: Number(row.amount ?? 0) || 0,
        docs: Number(row.docs ?? 0) || 0,
      }))
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, top)
  }, [items, metric, top])

  if (!rows.length) {
    return (
      <div className="grid h-full min-h-[200px] place-items-center rounded-2xl border-[var(--rc-forest-border)] bg-black/20 p-4 text-center">
        <p className="text-sm font-bold text-[var(--rc-text-muted)]">
          {loading ? 'Memuat sebaran barang…' : 'Belum ada data sebaran barang untuk filter ini.'}
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2">
        <div>
          <p className="text-[11px] font-semibold text-[var(--rc-forest-accent)]">Sebaran movement barang</p>
          <p className="mt-0.5 text-[11px] font-semibold text-[var(--rc-text-muted)]">
            Top {rows.length} item · metrik {METRIC_LABEL[metric].toLowerCase()}
          </p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border-[var(--rc-forest-border)] bg-black/25 p-1">
          {(Object.keys(METRIC_LABEL) as MetricKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setMetric(key)}
              aria-pressed={metric === key}
              className={
                metric === key
                  ? 'rounded-full bg-[var(--rc-forest-primary)] px-2.5 py-1 text-[10px] font-black text-[#03130b]'
                  : 'rounded-full px-2.5 py-1 text-[10px] font-bold text-[var(--rc-text-faint)] transition hover:text-[var(--rc-text)]'
              }
            >
              {METRIC_LABEL[key]}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 2, right: 40, bottom: 2, left: 8 }}>
            <CartesianGrid stroke="rgba(172,255,188,0.07)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#7ea88f', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={{ stroke: 'rgba(172,255,188,0.14)' }}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <YAxis
              type="category"
              dataKey="code"
              width={92}
              tick={{ fill: '#9be23d', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: 'rgba(155,226,61,0.06)' }}
              contentStyle={{
                background: '#07110d',
                border: '1px solid rgba(172,255,188,0.22)',
                borderRadius: 12,
                fontFamily: 'var(--font-data)',
                fontSize: 11,
              }}
              labelStyle={{ color: '#9be23d', fontWeight: 700 }}
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                const row = (payload[0]?.payload ?? {}) as { name?: string; qty?: number; amount?: number; docs?: number }
                return (
                  <div className="rounded-xl border-[rgba(172,255,188,0.22)] bg-[#07110d] px-3 py-2" style={{ fontFamily: 'var(--font-data)', fontSize: 11 }}>
                    <p className="mb-1 font-bold text-[#9be23d]">{row.name ?? '—'}</p>
                    <div className="space-y-0.5 text-[#d7ffe9]">
                      <p>Frekuensi: <span className="font-bold">{formatCompact(Number(row.docs ?? 0))}</span> dok</p>
                      <p>Qty: <span className="font-bold">{formatCompact(Number(row.qty ?? 0))}</span></p>
                      <p>Amount: <span className="font-bold">Rp {formatCompact(Number(row.amount ?? 0))}</span></p>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey={metric} radius={[0, 4, 4, 0]} maxBarSize={18}>
              {rows.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} fillOpacity={0.85} />
              ))}
              <LabelList
                dataKey={metric}
                position="right"
                formatter={(v: unknown) => formatCompact(Number(v ?? 0))}
                style={{ fill: '#7ea88f', fontSize: 10, fontFamily: 'var(--font-data)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
