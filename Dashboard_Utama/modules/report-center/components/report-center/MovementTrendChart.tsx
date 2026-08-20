'use client'

import { useMemo } from 'react'
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import MicroReportHeader, { type MicroReportStat } from './MicroReportHeader'

/**
 * MovementTrendChart — grafik movement yang "ramai" (bukan sunyi).
 *
 * Menggabungkan 3 sinyal per bulan dalam satu composed chart:
 * - Area  : nilai (amount, IDR) — sumbu kiri.
 * - Bar   : quantity (qty)      — sumbu kanan.
 * - Line  : frekuensi dokumen issue (docs) dari issueFrequency.byMonth.
 *
 * Sumber data: `usage.trend` (qty/amount/events per bulan) digabung dengan
 * `usage.issueFrequency.byMonth` (docs/activeDays/qty per bulan) by `month`.
 * Bila < 2 titik → empty-state yang mengarahkan user ke rentang lebih lebar.
 */

type TrendRow = {
  month?: string
  events?: number | string
  qty?: number | string
  amount?: number | string
}

type FrequencyRow = {
  month?: string
  docs?: number | string
  activeDays?: number | string
  qty?: number | string
}

type MovementTrendChartProps = {
  trend: TrendRow[]
  frequency?: FrequencyRow[]
  loading?: boolean
  failed?: boolean
}

const MONTH_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1e12) return `${(value / 1e12).toFixed(1)} T`
  if (abs >= 1e9) return `${(value / 1e9).toFixed(1)} M`
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)} jt`
  if (abs >= 1e3) return `${(value / 1e3).toFixed(0)} rb`
  return String(Math.round(value))
}

function monthLabel(month: string) {
  const [y, m] = month.split('-')
  const idx = Number(m) - 1
  return `${MONTH_ID[idx] ?? m} ${String(y).slice(2)}`
}

export default function MovementTrendChart({ trend, frequency, loading, failed }: MovementTrendChartProps) {
  const points = useMemo(() => {
    const freqByMonth = new Map<string, { docs: number; activeDays: number }>()
    ;(frequency ?? []).forEach((row) => {
      if (!row?.month) return
      freqByMonth.set(row.month, {
        docs: Number(row.docs ?? 0),
        activeDays: Number(row.activeDays ?? 0),
      })
    })
    return (trend ?? [])
      .filter((row) => row?.month)
      .map((row) => {
        const freq = freqByMonth.get(row.month as string)
        return {
          month: row.month as string,
          label: monthLabel(row.month as string),
          amount: Number(row.amount ?? 0),
          qty: Number(row.qty ?? 0),
          docs: freq?.docs ?? 0,
        }
      })
      .sort((a, b) => (a.month < b.month ? -1 : 1))
  }, [trend, frequency])

  const activeMonths = points.filter((p) => p.amount > 0 || p.qty > 0 || p.docs > 0).length
  const hasSignal = activeMonths > 0

  if (points.length < 2) {
    return (
      <div className="grid h-full min-h-[200px] place-items-center rounded-2xl border-[var(--rc-forest-border)] bg-black/20 p-4 text-center">
        <div>
          <p className="text-sm font-bold text-[var(--rc-text-muted)]">
            {loading ? 'Memuat trend movement…' : failed ? 'Data usage gagal dimuat — trend tidak dihitung.' : 'Belum ada data trend movement'}
          </p>
          {!loading && (
            <p className="mt-1 text-[11px] font-semibold text-[var(--rc-text-faint)]">
              {failed
                ? 'Sumber pengeluaran-barang gagal/timeout. Refresh atau cek gateway SQL sebelum membaca trend.'
                : 'Tren menampilkan 12 bulan ke belakang dari periode terpilih (bulan kosong diisi 0). Tidak ada transaksi issue — coba periode lain atau periksa filter lokasi/tipe barang.'}
            </p>
          )}
        </div>
      </div>
    )
  }

  const peak = points.reduce((acc, p) => (p.amount > acc.amount ? p : acc), points[0])
  const rangeLabel = points.length >= 2
    ? `${points[0].label} → ${points[points.length - 1].label}`
    : `${points.length} bln`
  const totalAmount = points.reduce((s, p) => s + p.amount, 0)

  const trendStats: MicroReportStat[] = [
    {
      label: 'Bln aktif',
      value: hasSignal ? `${activeMonths}/${points.length}` : '0',
      delta: rangeLabel,
      deltaDir: 'flat',
    },
    {
      label: 'Puncak',
      value: hasSignal ? `Rp ${formatCompact(peak.amount)}` : '—',
      delta: hasSignal ? peak.label : 'tak ada issue',
      deltaDir: hasSignal ? 'up' : 'flat',
    },
    {
      label: 'Total',
      value: `Rp ${formatCompact(totalAmount)}`,
      delta: `${points.length} bln`,
      deltaDir: 'flat',
    },
  ]

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      <MicroReportHeader
        className="mx-1 mb-1"
        ticker="Trend movement"
        title={`${points.length} bulan`}
        subtitle={hasSignal ? `${rangeLabel} · semua bulan diisi (kosong=0)` : `${rangeLabel} · tidak ada issue di window`}
        stats={trendStats}
        accent="emerald"
      />
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rcMoveFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#9be23d" stopOpacity={0.4} />
                <stop offset="55%" stopColor="#18b96b" stopOpacity={0.14} />
                <stop offset="100%" stopColor="#18b96b" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="rcMoveStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#18b96b" />
                <stop offset="100%" stopColor="#9be23d" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(172,255,188,0.07)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: '#7ea88f', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={{ stroke: 'rgba(172,255,188,0.14)' }}
              tickLine={false}
              minTickGap={16}
            />
            <YAxis
              yAxisId="amt"
              width={44}
              tick={{ fill: '#7ea88f', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <YAxis
              yAxisId="qty"
              orientation="right"
              width={40}
              tick={{ fill: '#6f8ba0', fontSize: 10, fontFamily: 'var(--font-data)' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => formatCompact(v)}
            />
            <Tooltip
              cursor={{ stroke: 'rgba(155,226,61,0.35)', strokeDasharray: '3 3' }}
              contentStyle={{
                background: '#07110d',
                border: '1px solid rgba(172,255,188,0.22)',
                borderRadius: 12,
                fontFamily: 'var(--font-data)',
                fontSize: 11,
              }}
              labelStyle={{ color: '#9be23d', fontWeight: 700 }}
              formatter={(value, name) => {
                const v = typeof value === 'number' ? value : Number(value ?? 0)
                if (name === 'amount') return [`Rp ${formatCompact(v)}`, 'Nilai']
                if (name === 'qty') return [formatCompact(v), 'Qty']
                return [formatCompact(v), 'Doc issue']
              }}
            />
            <Legend
              wrapperStyle={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#7ea88f' }}
              formatter={(value) => (value === 'amount' ? 'Nilai' : value === 'qty' ? 'Qty' : 'Doc issue')}
            />
            <Bar yAxisId="qty" dataKey="qty" fill="rgba(148,163,164,0.4)" radius={[3, 3, 0, 0]} maxBarSize={18} />
            <Area
              yAxisId="amt"
              type="monotone"
              dataKey="amount"
              stroke="url(#rcMoveStroke)"
              strokeWidth={2.2}
              fill="url(#rcMoveFill)"
              dot={false}
              activeDot={{ r: 4, fill: '#9be23d', stroke: '#050b08', strokeWidth: 2 }}
            />
            <Line
              yAxisId="qty"
              type="monotone"
              dataKey="docs"
              stroke="#f59e0b"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
              activeDot={{ r: 3, fill: '#f59e0b', stroke: '#050b08', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
