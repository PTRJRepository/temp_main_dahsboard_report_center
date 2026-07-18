'use client'

import { useEffect, useState } from 'react'
function HeroCube() {
  return (
    <svg className="relative z-10 w-full max-w-[360px] drop-shadow-[0_22px_34px_rgba(0,0,0,0.42)]" viewBox="0 0 420 280" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="cubeFaceA" x1="210" y1="40" x2="210" y2="220">
          <stop stopColor="#153F28" />
          <stop offset="1" stopColor="#0A1B11" />
        </linearGradient>
        <linearGradient id="cubeFaceB" x1="170" y1="85" x2="310" y2="185">
          <stop stopColor="#164B2D" />
          <stop offset="1" stopColor="#0C2015" />
        </linearGradient>
        <linearGradient id="cubeFaceC" x1="150" y1="90" x2="245" y2="220">
          <stop stopColor="#102E1E" />
          <stop offset="1" stopColor="#07140D" />
        </linearGradient>
        <filter id="forestGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d="M25 226 210 120l184 106-184 52L25 226Z" fill="#0A2015" stroke="rgba(155,226,61,.22)" />
      <path d="m210 41 102 58-102 59-102-59 102-58Z" fill="url(#cubeFaceA)" stroke="#9BE23D" strokeWidth="1.5" />
      <path d="m108 99 102 59v94l-102-59V99Z" fill="url(#cubeFaceC)" stroke="#18B96B" strokeWidth="1.5" />
      <path d="m312 99-102 59v94l102-59V99Z" fill="url(#cubeFaceB)" stroke="#29C7C8" strokeWidth="1.5" />
      <path d="M210 158v94M108 99l102 59 102-59" stroke="rgba(242,255,245,.22)" strokeWidth="1" />
      <path d="M210 18v23M353 82l-41 17M67 82l41 17M353 205l-41-12M67 205l41-12" stroke="#9BE23D" strokeWidth="1.4" strokeDasharray="4 6" />
      <circle cx="210" cy="14" r="6" fill="#9BE23D" filter="url(#forestGlow)" />
      <circle cx="360" cy="79" r="6" fill="#29C7C8" filter="url(#forestGlow)" />
      <circle cx="60" cy="79" r="6" fill="#D6B85C" filter="url(#forestGlow)" />
      <circle cx="360" cy="208" r="6" fill="#18B96B" filter="url(#forestGlow)" />
      <circle cx="60" cy="208" r="6" fill="#9F75FF" filter="url(#forestGlow)" />
      <path d="M177 109c17-4 28-15 34-32 8 24 0 40-23 48" stroke="#9BE23D" strokeWidth="3" strokeLinecap="round" />
      <path d="M193 120c18-4 31-15 39-34" stroke="#18B96B" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

type SystemStatus = {
  success?: boolean
  gatewayOnline?: boolean
  activeServer?: string
  activeDatabase?: string
  activeConnected?: boolean
  activeHealthy?: boolean
  checkedAt?: string
  error?: string
}

export default function HeroBanner() {
  const [status, setStatus] = useState<SystemStatus | null>(null)

  useEffect(() => {
    let active = true
    fetch('/api/reports/system-status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data: SystemStatus) => {
        if (active) setStatus(data)
      })
      .catch((error) => {
        if (active) setStatus({ success: false, error: error instanceof Error ? error.message : 'Gagal membaca status' })
      })
    return () => {
      active = false
    }
  }, [])

  const healthy = Boolean(status?.gatewayOnline && status.activeConnected && status.activeHealthy)

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[var(--rc-forest-border)] bg-[linear-gradient(135deg,rgba(11,43,27,.97),rgba(6,17,11,.99)_58%,rgba(22,41,15,.94))] p-8 shadow-[0_14px_40px_rgba(0,0,0,.28)]">
      <div className="rc-reference-grid pointer-events-none absolute inset-0" />
      <div className="relative grid min-h-[280px] gap-6 lg:grid-cols-[1.08fr_.92fr]">
        <div className="self-center">
          <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[var(--rc-forest-accent)]">Plantation intelligence workspace</p>
          <h1 className="max-w-3xl text-[clamp(34px,4vw,58px)] font-semibold leading-[1.03] tracking-[-0.055em] text-[var(--rc-text)]">
            Satu pusat untuk seluruh <span className="text-[var(--rc-forest-accent)]">laporan strategis.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-[var(--rc-text-muted)]">
            Temukan laporan berdasarkan proses bisnis, pahami fungsi setiap sub-modul, dan akses data operasional tanpa harus menghafal nama report.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <a href="#modules" className="inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-[rgba(155,226,61,.48)] bg-[linear-gradient(180deg,#20c875,#109456)] px-4 text-sm font-bold text-white shadow-[0_10px_30px_rgba(16,148,86,.18)]">
              Jelajahi modul <span aria-hidden="true">→</span>
            </a>
            <a href="#favorites" className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[var(--rc-forest-border)] bg-[rgba(12,30,20,.72)] px-4 text-sm text-[var(--rc-text)] hover:border-[var(--rc-forest-border-strong)]">Buka favorit</a>
            <button type="button" className="inline-flex min-h-[42px] items-center justify-center rounded-xl border border-[rgba(214,184,92,.55)] bg-[linear-gradient(180deg,#ead27f,#c8a84d)] px-4 text-sm font-bold text-[#171306]">Buat schedule</button>
          </div>
        </div>

        <div className="relative grid min-h-[216px] place-items-center isolate" aria-label="Graphic asset jaringan data perkebunan">
          <div className="absolute h-[340px] w-[340px] rounded-full border border-[rgba(155,226,61,.14)] bg-[radial-gradient(circle_at_center,rgba(24,185,107,.12),transparent_60%)] before:absolute before:inset-8 before:rounded-full before:border before:border-dashed before:border-[rgba(41,199,200,.18)] after:absolute after:inset-20 after:rounded-full after:border after:border-[rgba(214,184,92,.18)]" aria-hidden="true" />
          <HeroCube />
          <div className="absolute inset-x-0 bottom-0 z-20 grid grid-cols-3 gap-2.5">
            {[
              ['Report live', '151'],
              ['Data source', '8 terhubung'],
              ['System health', healthy ? '98% sehat' : 'checking'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[14px] border border-[var(--rc-forest-border)] bg-[rgba(5,16,10,.78)] p-3 backdrop-blur">
                <span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--rc-text-faint)]">{label}</span>
                <strong className="mt-1 block text-[17px] text-[var(--rc-text)]">{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
