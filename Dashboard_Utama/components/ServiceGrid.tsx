'use client'

import { useEffect, useState } from 'react'
import ServiceCard from '@/components/ServiceCard'
import { LayoutGrid } from 'lucide-react'

export interface ServiceItem {
    serviceId: string
    name: string
    description: string | null
    path?: string | null
    imagePath?: string | null
}

export interface ServiceGroupData {
    key: string
    label: string
    hint: string
    items: ServiceItem[]
}

/** Live up/down per service path, from the gateway health probe. */
function useServiceStatus(): Map<string, boolean> | null {
    const [map, setMap] = useState<Map<string, boolean> | null>(null)
    useEffect(() => {
        let alive = true
        fetch('/api/services/status', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(j => {
                if (!alive || !j?.services) return
                const m = new Map<string, boolean>()
                for (const s of j.services) m.set(s.path, Boolean(s.up))
                setMap(m)
            })
            .catch(() => {})
        return () => { alive = false }
    }, [])
    return map
}

export default function ServiceGrid({ groups }: { groups: ServiceGroupData[] }) {
    const [active, setActive] = useState<string>('semua')
    const statusMap = useServiceStatus()

    const visible = active === 'semua'
        ? groups.flatMap(g => g.items)
        : (groups.find(g => g.key === active)?.items ?? [])

    return (
        <div>
            {/* ── Group tabs ──────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 mb-7">
                <button
                    onClick={() => setActive('semua')}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active === 'semua'
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400/30'
                        : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.1] ring-1 ring-white/10 backdrop-blur-sm'}`}
                >
                    <LayoutGrid className="w-4 h-4" />
                    Semua
                </button>
                {groups.map(g => (
                    <button
                        key={g.key}
                        onClick={() => setActive(g.key)}
                        className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${active === g.key
                            ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg shadow-emerald-900/40 ring-1 ring-emerald-400/30'
                            : 'bg-white/[0.06] text-slate-300 hover:text-white hover:bg-white/[0.1] ring-1 ring-white/10 backdrop-blur-sm'}`}
                    >
                        {g.label}
                        <span className={`ml-2 text-[11px] font-bold ${active === g.key ? 'text-emerald-100' : 'text-slate-500'}`}>
                            {g.items.length}
                        </span>
                    </button>
                ))}
            </div>

            {/* ── Compact cards grid ──────────────────────────────── */}
            <div key={active} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 animate-[fade-up_0.4s_var(--ease-out)_both]">
                {visible.map(service => (
                    <ServiceCard
                        key={service.serviceId}
                        name={service.name}
                        description={service.description || ''}
                        icon={null}
                        routeUrl={service.path || `/${service.serviceId}`}
                        imagePath={service.imagePath}
                        up={statusMap ? statusMap.get(service.path || `/${service.serviceId}`) : undefined}
                    />
                ))}
            </div>
        </div>
    )
}