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
const DEFAULT_IMAGES: { pattern: RegExp; url: string }[] = [
    {
        pattern: /absen|attendance|hadir/i,
        url: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?q=80&w=1200&auto=format&fit=crop',
    },
    {
        pattern: /upah|payroll|gaji|tunjangan/i,
        url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=1200&auto=format&fit=crop',
    },
    {
        pattern: /produksi|panen|basis|sawit/i,
        url: 'https://images.unsplash.com/photo-1535392432937-a27c36ec07b5?q=80&w=1200&auto=format&fit=crop',
    },
    {
        pattern: /server|network|jaringan|monitor/i,
        url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=1200&auto=format&fit=crop',
    },
    {
        pattern: /query|sql|database|data/i,
        url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?q=80&w=1200&auto=format&fit=crop',
    },
    {
        pattern: /file|drive|rjfm|dokumen/i,
        url: 'https://images.unsplash.com/photo-1568667256549-094345857637?q=80&w=1200&auto=format&fit=crop',
    },
    {
        pattern: /report|laporan|center/i,
        url: 'https://images.unsplash.com/photo-1543286386-713bdd548da4?q=80&w=1200&auto=format&fit=crop',
    },
]

function resolveDefaultImage(name: string): string {
    const hit = DEFAULT_IMAGES.find(d => d.pattern.test(name))
    return (
        hit?.url ??
        'https://images.unsplash.com/photo-1535392432937-a27c36ec07b5?q=80&w=1200&auto=format&fit=crop'
    )
}

export default function ServiceCard({ name, description, icon, routeUrl, imagePath }: ServiceCardProps) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Icon = icon && LucideIcons[icon as keyof typeof LucideIcons]
        ? LucideIcons[icon as keyof typeof LucideIcons] as any
        : LucideIcons.LayoutDashboard

    const imageSrc = imagePath || resolveDefaultImage(name)

    return (
        <a href={routeUrl} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] rounded-[var(--radius-xl)]">
            <div className="h-full bg-gradient-to-br from-[#fdfefd] to-[#eef3ee] rounded-[var(--radius-xl)] border border-white/70 shadow-[var(--shadow-neu)] hover:shadow-[var(--shadow-neu-hover)] overflow-hidden transition-all duration-400 hover:-translate-y-2 flex flex-col">
                {/* Banner image — always present, taller */}
                <div className="relative h-44 overflow-hidden shrink-0">
                    <Image
                        src={imageSrc}
                        alt={name}
                        fill
                        sizes="(min-width: 1280px) 33vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    {/* Gradient scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
                    {/* Embossed floating icon chip */}
                    <div className="absolute -bottom-5 left-5 w-14 h-14 rounded-2xl bg-gradient-to-br from-white to-[#e8efe8] shadow-[var(--shadow-neu-sm)] ring-1 ring-white/80 flex items-center justify-center text-[var(--color-accent)] transition-transform duration-400 group-hover:scale-110 group-hover:-rotate-6">
                        <Icon style={{ width: 24, height: 24 }} />
                    </div>
                    {/* Hover arrow */}
                    <div className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/40 flex items-center justify-center opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                        <LucideIcons.ArrowUpRight className="w-4 h-4 text-white" />
                    </div>
                </div>

                {/* Content — offset for the embossed icon chip */}
                <div className="px-5 pt-8 pb-5 flex-1 flex flex-col">
                    <h3 className="text-base font-bold text-[var(--color-ink)] tracking-tight group-hover:text-[var(--color-accent)] transition-colors leading-snug">
                        {name}
                    </h3>
                    {description && (
                        <p className="mt-1.5 text-[13px] text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed flex-1">
                            {description}
                        </p>
                    )}
                    {/* Embossed "Buka" pill */}
                    <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#eef3ee] px-3.5 py-1.5 text-[11px] font-semibold text-[var(--color-ink-soft)] shadow-[var(--shadow-neu-inset)] transition-all duration-300 group-hover:text-[var(--color-accent)]">
                        Buka Layanan
                        <LucideIcons.ArrowRight className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                </div>
            </div>
        </a>
    )
}