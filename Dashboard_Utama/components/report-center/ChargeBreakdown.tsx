'use client'

import { useMemo, useState } from 'react'

/**
 * ChargeBreakdown — analisis "charge ke mana" untuk issue movement.
 * Tiga kanal: Blok/Station (BlkCode), Vehicle (VehCode), Dept (AccCode).
 * v1 memakai topLists.costCenters + topLists.vehicles yang sudah ada di snapshot
 * usage (tanpa fetch baru). Blok belum punya toplist terpisah → diturunkan dari
 * split movementMonthly bila tersedia (station = BlkCode terisi).
 *
 * Calm-minimal: segmen dominan emerald, lainnya neutral lightness berjenjang.
 * Klik kanal/item → onSelect untuk mengunci konteks di deck.
 */

type ChargeItem = {
  code?: string
  name?: string
  events?: number
  qty?: number
  amount?: number
}

type ChannelKey = 'blok' | 'vehicle' | 'dept'

type ChargeBreakdownProps = {
  costCenters?: ChargeItem[]
  vehicles?: ChargeItem[]
  /** Share qty station (Blok) dari movementMonthly untuk proporsi kanal Blok. */
  stationQty?: number
  ledgerQty?: number
  vehicleQty?: number
  metric: 'qty' | 'amount'
  onSelect?: (channel: ChannelKey, item: ChargeItem) => void
}

const CHANNEL_META: Record<ChannelKey, { label: string; hint: string }> = {
  blok: { label: 'Blok / Station', hint: 'BlkCode terisi tanpa VehCode' },
  vehicle: { label: 'Vehicle', hint: 'VehCode terisi' },
  dept: { label: 'Dept / Cost Center', hint: 'AccCode (ledger) sebagai dept' },
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}rb`
  return `${Math.round(value)}`
}

function sumAmount(items: ChargeItem[] | undefined): number {
  return (items ?? []).reduce((s, it) => s + Number(it.amount ?? 0), 0)
}

function sumEvents(items: ChargeItem[] | undefined): number {
  return (items ?? []).reduce((s, it) => s + Number(it.events ?? 0), 0)
}

export default function ChargeBreakdown({
  costCenters,
  vehicles,
  stationQty = 0,
  ledgerQty = 0,
  vehicleQty = 0,
  metric,
  onSelect,
}: ChargeBreakdownProps) {
  const [openChannel, setOpenChannel] = useState<ChannelKey>('vehicle')

  // Proporsi kanal. Untuk amount: blok≈station, dept≈ledger, vehicle≈vehicle (dari monthly qty share).
  const channels = useMemo(() => {
    const deptAmount = sumAmount(costCenters)
    const vehicleAmount = sumAmount(vehicles)
    const totalQty = Math.max(stationQty + ledgerQty + vehicleQty, 0)
    const stationShare = totalQty > 0 ? stationQty / totalQty : 0
    const ledgerShare = totalQty > 0 ? ledgerQty / totalQty : 0
    const vehicleShare = totalQty > 0 ? vehicleQty / totalQty : 0

    // Nilai tampilan per kanal mengikuti metrik.
    const blokValue = metric === 'qty' ? stationQty : Math.round((deptAmount + vehicleAmount) * stationShare)
    const deptValue = metric === 'qty' ? ledgerQty : deptAmount
    const vehicleValue = metric === 'qty' ? vehicleQty : vehicleAmount

    const total = blokValue + deptValue + vehicleValue
    const shareOf = (v: number) => (total > 0 ? v / total : 0)

    return [
      { key: 'blok' as ChannelKey, value: blokValue, share: shareOf(blokValue), items: [] as ChargeItem[], events: 0 },
      { key: 'vehicle' as ChannelKey, value: vehicleValue, share: shareOf(vehicleValue), items: vehicles ?? [], events: sumEvents(vehicles) },
      { key: 'dept' as ChannelKey, value: deptValue, share: shareOf(deptValue), items: costCenters ?? [], events: sumEvents(costCenters) },
    ]
  }, [costCenters, vehicles, stationQty, ledgerQty, vehicleQty, metric])

  const maxShare = Math.max(...channels.map((c) => c.share), 0)
  const active = channels.find((c) => c.key === openChannel) ?? channels[0]

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[24px] border-white/10 bg-[rgba(3,14,10,.4)] p-3">
      <div className="mb-2">
        <p className="text-[13px] font-semibold text-[var(--rc-text)]">Charge ke mana</p>
        <p className="rc-data mt-0.5 text-[10px] text-[var(--rc-text-faint)]">
          Distribusi issue per kanal · {metric === 'qty' ? 'quantity' : 'amount'}
        </p>
      </div>

      {/* Stacked bar proporsi */}
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.05]" role="img" aria-label="Proporsi charge per kanal">
        {channels.map((c, i) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOpenChannel(c.key)}
            title={`${CHANNEL_META[c.key].label}: ${(c.share * 100).toFixed(0)}%`}
            className={`h-full transition-opacity ${openChannel === c.key ? 'opacity-100' : 'opacity-70 hover:opacity-90'}`}
            style={{
              width: `${Math.max(c.share * 100, 1.5)}%`,
              backgroundColor:
                c.share === maxShare && c.share > 0
                  ? 'rgba(52,211,153,0.85)'
                  : `rgba(148,163,164,${0.5 - i * 0.12})`,
            }}
          />
        ))}
      </div>

      {/* Label kanal + share */}
      <div className="mt-2 grid-cols-3 gap-1">
        {channels.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setOpenChannel(c.key)}
            aria-pressed={openChannel === c.key}
            className={`rounded-xl border px-2 py-1.5 text-left transition ${
              openChannel === c.key
                ? 'border-emerald-300/30 bg-emerald-400/10'
                : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'
            }`}
          >
            <span className="block truncate text-[10px] font-semibold text-[var(--rc-text)]">{CHANNEL_META[c.key].label}</span>
            <span className="rc-data mt-0.5 block text-[10px] text-[var(--rc-text-muted)]">
              <strong className="text-[var(--rc-text)]">{(c.share * 100).toFixed(0)}%</strong>
              {' · '}
              {metric === 'qty' ? formatCompact(c.value) : `Rp ${formatCompact(c.value)}`}
            </span>
          </button>
        ))}
      </div>

      {/* Daftar top item kanal aktif */}
      <div className="mt-2 min-h-0 flex-1 overflow-auto">
        <p className="rc-data mb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--rc-text-faint)]">
          Top {CHANNEL_META[active.key].label}
        </p>
        {active.items.length === 0 ? (
          <p className="rc-data py-2 text-center text-[10px] text-[var(--rc-text-faint)]">
            {CHANNEL_META[active.key].hint}. {active.key === 'blok' ? 'Detail per blok tersedia di drill-down barang.' : 'Belum ada data.'}
          </p>
        ) : (
          <ul className="space-y-1">
            {active.items.slice(0, 6).map((item, i) => {
              const value = metric === 'qty' ? Number(item.qty ?? 0) : Number(item.amount ?? 0)
              const maxItem = Math.max(...active.items.slice(0, 6).map((it) => (metric === 'qty' ? Number(it.qty ?? 0) : Number(it.amount ?? 0))), 1)
              return (
                <li key={`${active.key}-${item.code ?? i}`}>
                  <button
                    type="button"
                    onClick={() => onSelect?.(active.key, item)}
                    className="group flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="rc-data w-4 shrink-0 text-[9px] text-[var(--rc-text-faint)]">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[10px] font-semibold text-[var(--rc-text)] group-hover:text-emerald-200">
                          {item.code ?? '—'}
                        </span>
                        <span className="rc-data shrink-0 text-[10px] text-[var(--rc-text-muted)]">
                          {metric === 'qty' ? formatCompact(value) : `Rp ${formatCompact(value)}`}
                        </span>
                      </span>
                      <span className="mt-0.5 block h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <span
                          className={`block h-full rounded-full ${i === 0 ? 'bg-emerald-400/80' : 'bg-white/25'}`}
                          style={{ width: `${Math.max((value / maxItem) * 100, 3)}%` }}
                        />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
