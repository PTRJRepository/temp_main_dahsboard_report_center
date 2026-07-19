'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, ArrowRight, Boxes, ChevronDown, ChevronRight, CircleDollarSign, Database, Factory, FileText, Fuel, Hammer, Landmark, Leaf, PackageCheck, Route, Users, Warehouse, X } from 'lucide-react'
import GlobalSearch from '@/components/dashboard/GlobalSearch'
import HeroBanner from '@/components/dashboard/HeroBanner'
import FavoritesPanel from '@/components/dashboard/FavoritesPanel'
import RecentPanel from '@/components/dashboard/RecentPanel'
import SystemInfoPanel from '@/components/dashboard/SystemInfoPanel'
import { IntelligenceWidget } from '@/components/intelligence/IntelligenceWidget'

const MOCK_RECOMMENDATIONS = [
  { id: '1', reportName: 'Stok Persediaan per Gudang', module: 'Procurement / Inventory', reason: 'similar' as const, reasonText: 'Report Inventory live siap dibuka', confidence: 0.92, subtitle: 'Gudang PG1A' },
  { id: '2', reportName: 'Produktivitas Panen Harian', module: 'Financial', reason: 'updated' as const, reasonText: 'Masuk ke sub-modul Produktivitas', confidence: 0.85, subtitle: 'DME Estate', timestamp: '30 menit lalu' },
  { id: '3', reportName: 'Rekap Lembur Mingguan', module: 'Human Resources', reason: 'due' as const, reasonText: 'Masuk ke sub-modul Lembur', confidence: 0.95, timestamp: 'Besok' },
  { id: '4', reportName: 'Budget vs Actual', module: 'Budget', reason: 'time_based' as const, reasonText: 'Katalog budget siap ditinjau', confidence: 0.78 },
]

const BUSINESS_CATEGORIES = [
  { title: 'Warehouse & Inventory', description: 'Posisi stok, gudang, umur stok, kualitas master, dan stock opname.', icon: Warehouse, submodules: 6, reports: 42, status: 'Live', route: '/report-center/inventory', accent: 'emerald' },
  { title: 'Receiving & Purchase', description: 'Penerimaan barang, PR/PO, supplier, return, dan audit receipt.', icon: PackageCheck, submodules: 6, reports: 24, status: 'Catalog', route: '/report-center/receiving-purchase', accent: 'lime' },
  { title: 'Workshop & Vehicle', description: 'Spare part, kendaraan, running, service history, dan biaya maintenance.', icon: Hammer, submodules: 5, reports: 18, status: 'Catalog', route: '/report-center/workshop', accent: 'gold' },
  { title: 'Fuel Inventory', description: 'Stok BBM, issue kendaraan, konsumsi blok, dan variance fuel.', icon: Fuel, submodules: 5, reports: 15, status: 'Catalog', route: '/report-center/fuel-inventory', accent: 'cyan' },
  { title: 'Stock Movement', description: 'Masuk, keluar, transfer, adjustment, return, dan tren movement.', icon: Route, submodules: 5, reports: 21, status: 'Live', route: '/report-center/inventory', accent: 'emerald' },
  { title: 'Asset & Valuation', description: 'Valuasi stok, aset, unit cost, quantity on hand, dan valuation history.', icon: Boxes, submodules: 6, reports: 19, status: 'Live', route: '/report-center/inventory', accent: 'gold' },
  { title: 'Financial & Accounting', description: 'Jurnal, biaya, budget, accounting period, dan kontrol finansial.', icon: CircleDollarSign, submodules: 5, reports: 13, status: 'Catalog', route: '/report-center/financial', accent: 'gold' },
  { title: 'Human Resources', description: 'Absensi, lembur, payroll, produktivitas tenaga kerja, dan audit HR.', icon: Users, submodules: 5, reports: 12, status: 'Catalog', route: '/report-center/human-resources', accent: 'lime' },
  { title: 'Budget & Planning', description: 'Budget vs actual, rencana kerja, forecast, dan monitoring deviasi.', icon: Landmark, submodules: 4, reports: 9, status: 'Catalog', route: '/report-center/budget', accent: 'cyan' },
  { title: 'Production & Operation', description: 'Produksi kebun/pabrik, operasi harian, KPI, dan data health.', icon: Factory, submodules: 5, reports: 11, status: 'Catalog', route: '/report-center/production', accent: 'emerald' },
  { title: 'General & Others', description: 'Report pendukung, audit trail, data sources, dan administrasi katalog.', icon: Leaf, submodules: 4, reports: 7, status: 'Catalog', route: '/report-center', accent: 'lime' },
]

const accentClass = {
  emerald: 'text-[var(--rc-forest-primary)] bg-[var(--rc-forest-primary-soft)]',
  lime: 'text-[var(--rc-forest-accent)] bg-[var(--rc-forest-accent-soft)]',
  gold: 'text-[var(--rc-forest-premium)] bg-[var(--rc-forest-premium-soft)]',
  cyan: 'text-[var(--rc-forest-info)] bg-cyan-400/10',
} as const

const KPI_ITEMS = [
  { icon: Boxes, value: '11', label: 'Kategori bisnis', stroke: '#9be23d' },
  { icon: FileText, value: '151', label: 'Total laporan', stroke: '#29c7c8' },
  { icon: Database, value: '8', label: 'Data source live', stroke: '#18b96b' },
  { icon: Users, value: '12', label: 'Pengguna aktif', stroke: '#d6b85c' },
  { icon: Activity, value: 'Normal', label: 'System status', stroke: '#20ce79' },
]

type BusinessCategory = typeof BUSINESS_CATEGORIES[number]

const SUBMODULES: Record<string, Array<{ title: string; description: string; count: number; route: string }>> = {
  'Warehouse & Inventory': [
    { title: 'Inventory Position', description: 'Posisi stok, nilai gudang, dan summary inventory.', count: 19, route: '/report-center/inventory' },
    { title: 'Gudang & Stock', description: 'Stok per gudang, transfer, opname, dan adjustment.', count: 11, route: '/report-center/inventory' },
    { title: 'Stock Aging & Health', description: 'Dead stock, slow moving, umur stok, dan kualitas master.', count: 7, route: '/report-center/inventory' },
    { title: 'Item Master Quality', description: 'Kelengkapan item, kategori, UOM, dan data master.', count: 4, route: '/report-center/inventory' },
    { title: 'Stock Opname', description: 'Selisih fisik, adjustment, dan rekonsiliasi stok.', count: 5, route: '/report-center/inventory' },
    { title: 'Transfer Antar Gudang', description: 'Pergerakan antar lokasi dan nilai transfer.', count: 4, route: '/report-center/inventory' },
  ],
  'Stock Movement': [
    { title: 'Real-time Movement', description: 'Event pergerakan stok terbaru per item.', count: 5, route: '/report-center/inventory' },
    { title: 'Monthly Movement', description: 'Opening, issued, return, receiving, dan closing.', count: 4, route: '/report-center/inventory' },
    { title: 'Movement by Item', description: 'Mutasi item per dokumen dan sumber transaksi.', count: 5, route: '/report-center/inventory' },
    { title: 'Movement by Location', description: 'Mutasi per gudang, blok, dan lokasi.', count: 4, route: '/report-center/inventory' },
    { title: 'Movement Audit', description: 'Audit transaksi, dokumen, dan sumber movement.', count: 3, route: '/report-center/inventory' },
  ],
  'Asset & Valuation': [
    { title: 'Inventory Valuation', description: 'Quantity, unit cost, total amount, dan kategori produk.', count: 7, route: '/report-center/inventory' },
    { title: 'Asset Stock', description: 'Stock aset dan nilai current inventory.', count: 5, route: '/report-center/inventory' },
    { title: 'Quantity on Hand', description: 'Qty tersedia, on hold, dan nilai current stock.', count: 3, route: '/report-center/inventory' },
    { title: 'Cost Variance', description: 'Perubahan unit cost dan differential cost.', count: 4, route: '/report-center/inventory' },
    { title: 'Valuation History', description: 'Riwayat nilai inventory per periode.', count: 3, route: '/report-center/inventory' },
  ],
}

function submodulesFor(category: BusinessCategory) {
  return SUBMODULES[category.title] ?? Array.from({ length: Math.min(category.submodules, 6) }, (_, index) => ({
    title: `${category.title.split(' & ')[0]} ${index + 1}`,
    description: `${category.description} Area kerja sub-modul ${index + 1}.`,
    count: Math.max(1, Math.round(category.reports / category.submodules)),
    route: category.route,
  }))
}

export default function ReportCenterPage() {
  const router = useRouter()
  const [insightsOpen, setInsightsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<BusinessCategory | null>(null)
  const lastFocusRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!selectedCategory) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedCategory(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCategory])

  const openCategory = (category: BusinessCategory, target: EventTarget | null) => {
    lastFocusRef.current = target instanceof HTMLElement ? target : null
    setSelectedCategory(category)
  }

  const closeCategory = () => {
    setSelectedCategory(null)
    requestAnimationFrame(() => lastFocusRef.current?.focus())
  }

  const openSubmodule = (route: string) => {
    const source = typeof window === 'undefined' ? 'estate' : window.localStorage.getItem('report-center:last-source') === 'pabrik' ? 'pabrik' : 'estate'
    setSelectedCategory(null)
    router.push(`${route}${route.includes('?') ? '&' : '?'}source=${source}`)
  }

  const SelectedIcon = selectedCategory?.icon

  return (
    <>
      <GlobalSearch />
      <div className="mx-auto max-w-screen-2xl space-y-5 px-4 pb-8 pt-5 sm:px-6 lg:px-8">
        <HeroBanner />

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Ringkasan sistem">
          {KPI_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.label} className="rc-kpi-card min-h-[132px] p-[18px]">
                <div className="relative z-10 flex items-center gap-3">
                  <div className="grid h-[42px] w-[42px] place-items-center rounded-[13px] border border-[rgba(155,226,61,.22)] bg-[rgba(24,185,107,.1)] text-[var(--rc-forest-accent)]">
                    <Icon size={22} strokeWidth={1.8} />
                  </div>
                  <div>
                    <strong className="block text-[26px] leading-none tracking-[-0.04em] text-[var(--rc-text)]">{item.value}</strong>
                    <p className="mt-1 text-xs text-[var(--rc-text-faint)]">{item.label}</p>
                  </div>
                </div>
                <svg className="relative z-10 mt-4 h-9 w-full" viewBox="0 0 220 36" fill="none" aria-hidden="true">
                  <path d="M2 28c18-4 28 2 42-3s20-14 34-7 25 10 41 2 27-11 45-5 27 5 54-7" stroke={item.stroke} strokeWidth="2" strokeLinecap="round" />
                </svg>
              </article>
            )
          })}
        </section>

        <section id="modules" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--rc-forest-accent)]">Business report map</p>
              <h2 className="mt-1 text-base font-bold text-[var(--rc-text)]">Kategori Bisnis Forest Intelligence</h2>
            </div>
            <span className="rounded-full rc-forest-badge px-3 py-1 text-xs font-semibold">
              {BUSINESS_CATEGORIES.length} kategori bisnis
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {BUSINESS_CATEGORIES.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.title}
                  type="button"
                  onClick={(event) => openCategory(category, event.currentTarget)}
                  className="rc-forest-card rc-forest-focus group relative flex min-h-[236px] flex-col rounded-[18px] p-[19px] text-left transition hover:-translate-y-1 hover:border-[var(--rc-forest-border-strong)] hover:shadow-[0_22px_44px_rgba(0,0,0,.27)]"
                  aria-label={`Buka kategori ${category.title}`}
                >
                  <span className="absolute inset-y-0 left-0 w-1 bg-[var(--rc-forest-accent)] opacity-80" aria-hidden="true" />
                  <div className="relative z-10 flex items-start justify-between gap-3">
                    <div className={`grid h-12 w-12 place-items-center rounded-2xl border border-[var(--rc-forest-border)] ${accentClass[category.accent as keyof typeof accentClass]}`}>
                      <Icon size={23} strokeWidth={1.8} />
                    </div>
                    <span className="rounded-full border border-[var(--rc-forest-border)] bg-white/5 px-2.5 py-1 text-xs font-semibold text-[var(--rc-text-muted)]">
                      {category.status}
                    </span>
                  </div>

                  <div className="relative z-10 mt-4 flex-1">
                    <h3 className="text-lg font-bold text-[var(--rc-text)]">{category.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--rc-text-muted)]">{category.description}</p>
                  </div>

                  <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 border-t border-[var(--rc-forest-border)] pt-3 text-xs">
                    <span className="rounded-xl bg-white/[0.04] px-3 py-2 text-[var(--rc-text-muted)]">
                      <strong className="block text-base text-[var(--rc-forest-accent)]">{category.submodules}</strong>
                      sub-modul
                    </span>
                    <span className="rounded-xl bg-white/[0.04] px-3 py-2 text-[var(--rc-text-muted)]">
                      <strong className="block text-base text-[var(--rc-forest-accent)]">{category.reports}</strong>
                      laporan
                    </span>
                  </div>

                  <span className="relative z-10 mt-3 inline-flex items-center gap-2 text-sm font-bold text-[var(--rc-forest-accent)]">
                    Pilih kategori
                    <ArrowRight size={15} className="transition group-hover:translate-x-1" />
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <section className="rc-panel overflow-hidden rounded-3xl">
          <button
            type="button"
            onClick={() => setInsightsOpen((value) => !value)}
            className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/5"
            aria-expanded={insightsOpen}
          >
            <span>
              <span className="block text-xs font-bold uppercase tracking-[0.24em] text-amber-300">Insight tambahan</span>
              <span className="mt-1 block text-sm font-semibold text-[var(--rc-text)]">
                Rekomendasi, favorit, recent, dan status sistem
              </span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--rc-border)] px-3 py-1 text-xs font-bold text-[var(--rc-text-muted)]">
              {insightsOpen ? 'Tutup' : 'Buka jika perlu'}
              {insightsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
          </button>

          {insightsOpen && (
            <div className="grid grid-cols-1 gap-4 border-t border-[var(--rc-border)] p-4 xl:grid-cols-[1.45fr_1fr]">
              <IntelligenceWidget
                recommendations={MOCK_RECOMMENDATIONS}
                onSelect={(rec) => console.log('Selected:', rec.reportName)}
              />
              <div id="favorites" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <FavoritesPanel />
                <RecentPanel />
                <SystemInfoPanel />
              </div>
            </div>
          )}
        </section>
      </div>

      {selectedCategory && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[rgba(2,8,5,.76)] p-6 backdrop-blur-xl max-sm:items-end max-sm:p-0"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCategory()
          }}
        >
          <section
            className="flex max-h-[calc(100vh-48px)] w-full max-w-[940px] flex-col overflow-hidden rounded-[24px] border border-[rgba(155,226,61,.32)] bg-[radial-gradient(circle_at_15%_0%,rgba(24,185,107,.15),transparent_32%),linear-gradient(180deg,#0e2318,#07140d)] shadow-[0_35px_120px_rgba(0,0,0,.55),0_0_48px_rgba(24,185,107,.09)] max-sm:max-h-[92vh] max-sm:rounded-b-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="submodule-dialog-title"
            onKeyDown={(event) => {
              if (event.key !== 'Tab') return
              const focusable = Array.from(event.currentTarget.querySelectorAll('button'))
              const first = focusable[0]
              const last = focusable[focusable.length - 1]
              if (!first || !last) return
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
              }
            }}
          >
            <header className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4 border-b border-[var(--rc-forest-border)] p-5">
              <div className="grid h-[58px] w-[58px] place-items-center rounded-[17px] border border-[rgba(155,226,61,.38)] bg-[radial-gradient(circle,rgba(155,226,61,.18),rgba(24,185,107,.05))] text-[var(--rc-forest-accent)]">
                {SelectedIcon ? <SelectedIcon size={30} strokeWidth={1.8} /> : null}
              </div>
              <div>
                <h2 id="submodule-dialog-title" className="text-2xl font-semibold tracking-[-0.03em] text-[var(--rc-text)]">{selectedCategory.title}</h2>
                <p className="mt-2 max-w-2xl text-xs leading-6 text-[var(--rc-text-muted)]">{selectedCategory.description}</p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeCategory}
                className="rc-forest-focus grid h-10 w-10 place-items-center rounded-xl border border-[var(--rc-forest-border)] bg-white/[0.02] text-[var(--rc-text-muted)] hover:text-[var(--rc-text)]"
                aria-label="Tutup dialog sub-modul"
              >
                <X size={18} />
              </button>
            </header>

            <div className="mx-5 mt-4 grid grid-cols-2 overflow-hidden rounded-[15px] border border-[var(--rc-forest-border)] bg-[rgba(5,17,10,.52)] md:grid-cols-4">
              {[
                ['Total laporan', selectedCategory.reports],
                ['Sub-modul', selectedCategory.submodules],
                ['Sumber data', Math.max(3, Math.ceil(selectedCategory.submodules / 2))],
                ['Status', selectedCategory.status],
              ].map(([label, value]) => (
                <div key={label} className="border-r border-b border-[var(--rc-forest-border)] p-4 last:border-r-0 md:border-b-0">
                  <span className="block text-[10px] uppercase tracking-[0.1em] text-[var(--rc-text-faint)]">{label}</span>
                  <strong className="mt-1 block text-lg text-[var(--rc-text)]">{value}</strong>
                </div>
              ))}
            </div>

            <div className="px-5 pb-3 pt-5">
              <h3 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--rc-text)]">Daftar sub-modul</h3>
              <p className="mt-1 text-[11px] text-[var(--rc-text-faint)]">Pilih area kerja untuk melihat daftar laporan dan informasi lebih lengkap.</p>
            </div>

            <div className="grid gap-2.5 overflow-y-auto px-5 pb-5 md:grid-cols-2">
              {submodulesFor(selectedCategory).map((submodule) => (
                <button
                  key={submodule.title}
                  type="button"
                  onClick={() => openSubmodule(submodule.route)}
                  className="rc-forest-focus grid min-h-[92px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] border border-[var(--rc-forest-border)] bg-[linear-gradient(145deg,rgba(24,185,107,.05),transparent),rgba(12,29,20,.92)] p-3 text-left transition hover:-translate-y-0.5 hover:border-[rgba(155,226,61,.38)] hover:bg-[rgba(15,35,24,.96)]"
                >
                  <span className="grid h-[42px] w-[42px] place-items-center rounded-xl border border-[rgba(24,185,107,.24)] bg-[rgba(24,185,107,.11)] text-[var(--rc-forest-accent)]">
                    {SelectedIcon ? <SelectedIcon size={22} strokeWidth={1.8} /> : null}
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm text-[var(--rc-text)]">{submodule.title}</strong>
                    <span className="mt-1 block text-[11px] leading-5 text-[var(--rc-text-faint)]">{submodule.description}</span>
                  </span>
                  <span className="text-right text-[10px] text-[var(--rc-text-faint)]">
                    <strong className="block text-base text-[var(--rc-text)]">{submodule.count}</strong>
                    laporan →
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
