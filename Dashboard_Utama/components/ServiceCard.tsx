import * as LucideIcons from 'lucide-react'

interface ServiceCardProps {
    name: string
    description: string | null
    icon: string | null
    routeUrl: string
    imagePath?: string | null
}

// Map common service names to an icon for the tile.
function resolveIcon(name: string, icon: string | null) {
    if (icon && LucideIcons[icon as keyof typeof LucideIcons]) {
        return LucideIcons[icon as keyof typeof LucideIcons] as typeof LucideIcons.LayoutDashboard
    }
    const n = name.toLowerCase()
    if (/absen|attendance|hadir/.test(n)) return LucideIcons.CalendarCheck2
    if (/upah|payroll|gaji|tunjangan/.test(n)) return LucideIcons.Wallet
    if (/produksi|panen|basis/.test(n)) return LucideIcons.Wheat
    if (/server|monitor|network|jaringan/.test(n)) return LucideIcons.ServerCog
    if (/query|sql|database|data/.test(n)) return LucideIcons.Database
    if (/file|drive|rjfm|dokumen/.test(n)) return LucideIcons.FolderKanban
    if (/report|laporan/.test(n)) return LucideIcons.BarChart3
    return LucideIcons.LayoutDashboard
}

export default function ServiceCard({ name, description, icon, routeUrl, imagePath }: ServiceCardProps) {
    const Icon = resolveIcon(name, icon)

    return (
        <a href={routeUrl} className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] rounded-[var(--radius-lg)]">
            <div className="h-full bg-[var(--color-paper)] rounded-[var(--radius-lg)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)] shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] overflow-hidden transition-all duration-300 hover:-translate-y-1 flex flex-col">
                {/* Icon tile + arrow */}
                <div className="p-5 pb-3">
                    <div className="flex items-start justify-between">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)] transition-all duration-300 group-hover:bg-[var(--color-accent)] group-hover:text-white">
                                <Icon className="w-6 h-6" />
                            </div>
                            {imagePath && (
                                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-accent)] ring-2 ring-white" />
                            )}
                        </div>
                        <LucideIcons.ArrowUpRight className="h-5 w-5 text-[var(--color-ink-muted)] group-hover:text-[var(--color-accent)] transition-all duration-300 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0" />
                    </div>
                </div>

                {/* Content */}
                <div className="px-5 pb-5 flex-1 flex flex-col">
                    <h3 className="text-base font-semibold text-[var(--color-ink)] group-hover:text-[var(--color-accent)] transition-colors leading-snug">
                        {name}
                    </h3>
                    {description && (
                        <p className="mt-1 text-sm text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed flex-1">
                            {description}
                        </p>
                    )}
                </div>

                {/* Bottom accent line */}
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:from-[var(--color-accent)] group-hover:via-[var(--color-accent-soft)] group-hover:to-transparent transition-all duration-500" />
            </div>
        </a>
    )
}
