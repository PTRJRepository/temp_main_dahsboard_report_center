import Image from 'next/image'
import * as LucideIcons from 'lucide-react'

interface ServiceCardProps {
    name: string
    description: string | null
    icon: string | null
    routeUrl: string
    imagePath?: string | null
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

export default function ServiceCard({ name, description, icon, routeUrl, imagePath }: ServiceCardProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = icon && LucideIcons[icon as keyof typeof LucideIcons]
        ? LucideIcons[icon as keyof typeof LucideIcons] as any
        : LucideIcons.LayoutDashboard

    const custom = Boolean(imagePath)
    const { url, tint } = custom
        ? { url: imagePath as string, tint: 'from-emerald-500/75 to-emerald-800/75' }
        : resolveStyle(name)

    return (
        <a href={routeUrl} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] rounded-[24px]">
            <div className="relative h-full flex flex-col overflow-hidden rounded-[24px] border border-white/60 bg-gradient-to-br from-[#fdfefd] to-[#edf3ed] shadow-[var(--shadow-neu)] hover:shadow-[var(--shadow-neu-accent)] transition-all duration-500 hover:-translate-y-2.5">

                {/* ── Banner ─────────────────────────────────────── */}
                <div className="relative h-52 overflow-hidden shrink-0">
                    <Image
                        src={url}
                        alt={name}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-[1.2s] group-hover:scale-[1.15]"
                    />
                    {/* Color tint + depth scrim */}
                    <div className={`absolute inset-0 bg-gradient-to-tr ${tint} mix-blend-multiply`} />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />

                    {/* Top-right arrow button */}
                    <div className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/15 backdrop-blur-md ring-1 ring-white/35 flex items-center justify-center opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-400">
                        <LucideIcons.ArrowUpRight className="w-5 h-5 text-white" />
                    </div>

                    {/* Bottom-left embossed icon chip — overlaps the body */}
                    <div className="absolute -bottom-7 left-6">
                        <div className="relative">
                            <div className={`absolute inset-0 rounded-[20px] bg-gradient-to-br ${tint} blur-lg opacity-50 group-hover:opacity-80 transition-opacity`} />
                            <div className="relative w-16 h-16 rounded-[20px] bg-gradient-to-br from-white to-[#e6efe6] shadow-[var(--shadow-neu-sm)] ring-1 ring-white/90 flex items-center justify-center text-[var(--color-accent)] transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6">
                                <Icon style={{ width: 28, height: 28 }} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Body ───────────────────────────────────────── */}
                <div className="flex-1 flex flex-col px-6 pt-11 pb-5">
                    <h3 className="text-lg font-bold text-[var(--color-ink)] tracking-tight leading-snug group-hover:text-[var(--color-accent)] transition-colors">
                        {name}
                    </h3>
                    {description && (
                        <p className="mt-2 text-[13.5px] text-[var(--color-ink-muted)] leading-relaxed line-clamp-2 flex-1">
                            {description}
                        </p>
                    )}

                    {/* Footer row — status + CTA */}
                    <div className="mt-5 pt-4 border-t border-[var(--color-border)] flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wider">
                            <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                            </span>
                            Aktif
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[var(--color-accent)] shadow-[var(--shadow-neu-inset)] transition-all duration-300 group-hover:shadow-[var(--shadow-neu-sm)] group-hover:text-white group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-emerald-700">
                            Buka
                            <LucideIcons.ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </span>
                    </div>
                </div>
            </div>
        </a>
    )
}