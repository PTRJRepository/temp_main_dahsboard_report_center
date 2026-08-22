import Image from 'next/image'
import Link from 'next/link'
import * as LucideIcons from 'lucide-react'

interface ServiceCardProps {
    name: string
    description: string | null
    icon: string | null
    routeUrl: string
    imagePath?: string | null
    /** undefined = probe pending; true/false = gateway health result */
    up?: boolean
}

// Curated Unsplash imagery per service keyword — used when the service has no
// custom imagePath set in the admin panel. All hosts already allowed in
// next.config.js remotePatterns.
const DEFAULT_IMAGES: { pattern: RegExp; url: string; tint: string }[] = [
    {
        pattern: /absen|attendance|hadir/i,
        url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-sky-500/80 to-indigo-700/80',
    },
    {
        pattern: /upah|payroll|gaji|tunjangan/i,
        url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-emerald-500/80 to-teal-700/80',
    },
    {
        pattern: /produksi|panen|basis|sawit/i,
        url: 'https://images.unsplash.com/photo-1535392432937-a27c36ec07b5?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-amber-500/80 to-orange-700/80',
    },
    {
        pattern: /server|network|jaringan|monitor/i,
        url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-slate-600/80 to-slate-800/80',
    },
    {
        pattern: /query|sql|database|data/i,
        url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-violet-500/80 to-purple-700/80',
    },
    {
        pattern: /file|drive|rjfm|dokumen/i,
        url: 'https://images.unsplash.com/photo-1568667256549-094345857637?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-rose-500/80 to-pink-700/80',
    },
    {
        pattern: /report|laporan|center/i,
        url: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?q=80&w=1200&auto=format&fit=crop',
        tint: 'from-cyan-500/80 to-blue-700/80',
    },
]

const FALLBACK_IMAGE = {
    url: 'https://images.unsplash.com/photo-1535392432937-a27c36ec07b5?q=80&w=1200&auto=format&fit=crop',
    tint: 'from-emerald-500/80 to-emerald-800/80',
}

function resolveStyle(name: string) {
    return DEFAULT_IMAGES.find(d => d.pattern.test(name)) ?? FALLBACK_IMAGE
}

export default function ServiceCard({ name, description, icon, routeUrl, imagePath, up }: ServiceCardProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = icon && LucideIcons[icon as keyof typeof LucideIcons]
        ? LucideIcons[icon as keyof typeof LucideIcons] as any
        : LucideIcons.LayoutDashboard

    const custom = Boolean(imagePath)
    const { url, tint } = custom
        ? { url: imagePath as string, tint: 'from-emerald-500/75 to-emerald-800/75' }
        : resolveStyle(name)

    const statusLabel = up === undefined ? 'Memuat' : up ? 'Aktif' : 'Offline'
    const statusDot = up === undefined
        ? <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-slate-400 animate-pulse" />
        : up
            ? (
                <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
            )
            : <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />

    return (
        <Link href={routeUrl} className="group block h-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded-[20px]">
            <div className="relative h-full flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-white to-slate-100 shadow-[0_12px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_18px_44px_rgba(0,0,0,0.5),0_0_0_1px_rgba(52,211,153,0.35)] transition-all duration-400 hover:-translate-y-1.5">

                {/* ── Banner (compact) ───────────────────────────── */}
                <div className="relative h-36 overflow-hidden shrink-0">
                    <Image
                        src={url}
                        alt={name}
                        fill
                        sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.15]"
                    />
                    {/* Color tint + depth scrim */}
                    <div className={`absolute inset-0 bg-gradient-to-tr ${tint} mix-blend-multiply`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/5" />

                    {/* Top-right arrow button */}
                    <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/35 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                        <LucideIcons.ArrowUpRight className="w-4 h-4 text-white" />
                    </div>

                    {/* Bottom-left icon chip — overlaps the body */}
                    <div className="absolute -bottom-6 left-5">
                        <div className="relative">
                            <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${tint} blur-lg opacity-60 group-hover:opacity-90 transition-opacity`} />
                            <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-slate-100 shadow-lg ring-1 ring-white/80 flex items-center justify-center text-slate-700 transition-transform duration-400 group-hover:scale-110 group-hover:-rotate-6">
                                <Icon style={{ width: 24, height: 24 }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Body (compact) ─────────────────────────────── */}
                <div className="flex-1 flex flex-col px-5 pb-4" style={{ paddingTop: 34 }}>
                    <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug group-hover:text-emerald-600 transition-colors line-clamp-1">
                        {name}
                    </h3>
                    {description && (
                        <p className="mt-1.5 text-xs text-slate-500 leading-relaxed line-clamp-2 flex-1">
                            {description}
                        </p>
                    )}

                    {/* Footer row — status + CTA */}
                    <div className="mt-3 pt-3 border-t border-slate-200/70 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${up === false ? 'text-red-500' : 'text-slate-400'}`}>
                            {statusDot}
                            {statusLabel}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3.5 py-1.5 text-xs font-bold text-slate-700 transition-all duration-300 group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-emerald-700">
                            Buka
                            <LucideIcons.ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </span>
                    </div>
                </div>
            </div>
        </Link>
    )
}