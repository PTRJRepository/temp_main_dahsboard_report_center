import { cookies } from 'next/headers'
import { verifyToken } from '@/utils/jwt'
import { getGatewayFallbackServices, serviceRepository, Service } from '@/utils/service-repository'
import { userRepository } from '@/utils/user-repository'
import Link from 'next/link'
import {
    Shield, Settings, Grid3X3, TrendingUp, Database, LayoutDashboard,
    HardDrive, ArrowRight, Sparkles,
} from 'lucide-react'
import LogoutButton from '@/components/LogoutButton'
import ChangePasswordButton from '@/components/ChangePasswordButton'
import ServiceCard from '@/components/ServiceCard'

// Force Node.js runtime
export const runtime = 'nodejs'

/**
 * Services a user may actually access.
 * = role-based services ∩ per-user AccessControl assignment.
 */
async function getAccessibleServices(user: { id: number; role: string }): Promise<Service[]> {
    try {
        const roleServices = await serviceRepository.findByRole(user.role)
        const assigned = await userRepository.getUserServices(user.id)
        if (assigned.length === 0) {
            return roleServices
        }
        const allowed = new Set(assigned)
        return roleServices.filter(s => allowed.has(s.serviceId))
    } catch (e) {
        console.error('Error resolving accessible services:', e)
        return []
    }
}

// Group services into functional clusters.
interface ServiceGroup {
    key: string
    label: string
    hint: string
    icon: typeof Grid3X3
    filter?: (s: Service) => boolean
}

const SERVICE_GROUPS: ServiceGroup[] = [
    {
        key: 'operasi',
        label: 'Operasional Kebun',
        hint: 'Absensi, produksi, monitoring lapangan',
        icon: Grid3X3,
        filter: (s: Service) => /absen|absensi|produksi|basis-panen|monitoring|panen/i.test(s.serviceId + ' ' + s.name),
    },
    {
        key: 'keuangan',
        label: 'Keuangan & Payroll',
        hint: 'Penggajian, tunjangan, pajak, upah',
        icon: TrendingUp,
        filter: (s: Service) => /payroll|upah|tunjangan|tax|pajak|spreadsheet|gaji/i.test(s.serviceId + ' ' + s.name),
    },
    {
        key: 'sistem',
        label: 'Sistem & Monitoring',
        hint: 'Server, jaringan, query gateway',
        icon: Database,
        filter: (s: Service) => /server|network|monitor|query|file|rjfm|ifess/i.test(s.serviceId + ' ' + s.name),
    },
]

const FALLBACK_GROUP: Omit<ServiceGroup, 'filter'> = {
    key: 'lainnya',
    label: 'Layanan Lainnya',
    hint: 'Modul dan layanan tambahan',
    icon: LayoutDashboard,
}

export default async function DashboardUserPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value ||
        cookieStore.get('payroll_auth_token')?.value

    let user: { id: number; name: string; email: string; role: string } | null = null
    if (token) {
        const payload = verifyToken(token)
        if (payload) {
            user = {
                id: payload.userId,
                name: payload.name,
                email: payload.email,
                role: payload.role
            }
        }
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[var(--color-paper-soft)]">
                <div className="text-center py-12 px-8 bg-white rounded-2xl shadow-lg max-w-md">
                    <h1 className="text-2xl font-bold text-red-600">Akses Ditolak</h1>
                    <p className="mt-2 text-gray-600">Silakan login terlebih dahulu.</p>
                    <Link
                        href="/login"
                        className="mt-6 inline-block px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors font-medium shadow-sm"
                    >
                        Login
                    </Link>
                </div>
            </div>
        )
    }

    const services = user.id === 0
        ? getGatewayFallbackServices(user.role)
        : await getAccessibleServices(user)

    // Assign services to groups; leftovers go to fallback group.
    const groupedIds = new Set<string>()
    const groups = SERVICE_GROUPS
        .map(g => {
            const match = g.filter ?? (() => false)
            const items = services.filter(s => {
                if (groupedIds.has(s.serviceId)) return false
                if (match(s)) {
                    groupedIds.add(s.serviceId)
                    return true
                }
                return false
            })
            return { ...g, items }
        })
        .filter(g => g.items.length > 0)

    const rest = services.filter(s => !groupedIds.has(s.serviceId))
    if (rest.length > 0) groups.push({ ...FALLBACK_GROUP, items: rest })

    const now = new Date()
    const hour = now.getHours()
    const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const initials = user.name?.charAt(0).toUpperCase() || 'U'

    return (
        <div className="min-h-screen relative bg-[var(--color-paper-soft)]">
            {/* ── Ambient visual background (non-flat) ────────────────── */}
            <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
                <span className="absolute -top-40 -left-40 h-[480px] w-[480px] rounded-full bg-emerald-200/25 blur-[130px] animate-[drift_20s_var(--ease-in-out)_infinite_alternate]" />
                <span className="absolute top-1/3 -right-48 h-[520px] w-[520px] rounded-full bg-amber-200/20 blur-[140px] animate-[drift_26s_var(--ease-in-out)_infinite_alternate-reverse]" />
                <span className="absolute bottom-0 left-1/4 h-[380px] w-[380px] rounded-full bg-emerald-100/30 blur-[120px] animate-[drift_22s_var(--ease-in-out)_infinite_alternate]" />
                {/* Dot grid texture */}
                <div
                    className="absolute inset-0 opacity-[0.35]"
                    style={{
                        backgroundImage: 'radial-gradient(rgba(58,125,68,0.10) 1px, transparent 1px)',
                        backgroundSize: '26px 26px',
                    }}
                />
            </div>
            {/* ── Hero welcome band ─────────────────────────────────── */}
            <section className="relative z-10 overflow-hidden bg-gradient-to-br from-[#0c231a] via-[#123526] to-[#1b4a33] text-white">
                {/* Decorative rings + constant-motion orbs */}
                <span aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 rounded-full border border-white/10 animate-[spin_60s_linear_infinite] border-dashed" />
                <span aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full border border-white/15" />
                <span aria-hidden className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl animate-[drift_14s_var(--ease-in-out)_infinite_alternate]" />
                <span aria-hidden className="pointer-events-none absolute top-10 right-1/3 h-40 w-40 rounded-full bg-amber-300/10 blur-3xl animate-[drift_18s_var(--ease-in-out)_infinite_alternate-reverse]" />

                <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                        <div className="animate-[fade-up_0.6s_var(--ease-out)_both]">
                            <p className="text-emerald-200/70 text-sm mb-2">{greeting},</p>
                            <h1 className="text-3xl lg:text-5xl font-bold tracking-tight font-display leading-tight">
                                {user.name}
                            </h1>
                            <div className="mt-4 flex flex-wrap items-center gap-2.5">
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 px-3.5 py-1.5 text-xs font-semibold ring-1 ring-white/10">
                                    <Shield className="w-3.5 h-3.5 text-emerald-300" />
                                    {user.role}
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-xs text-white/60">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                    Portal layanan internal PT Rebinmas Jaya
                                </span>
                            </div>
                        </div>

                        {/* Quick actions */}
                        <div className="flex flex-wrap items-center gap-2.5 animate-[fade-up_0.6s_var(--ease-out)_0.15s_both]">
                            <ChangePasswordButton userId={Number(user.id)} />
                            {user.role === 'ADMIN' && (
                                <Link
                                    href="/admin"
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#123526] rounded-xl hover:bg-emerald-50 transition-colors text-sm font-semibold shadow-lg"
                                >
                                    <Settings className="w-4 h-4" />
                                    Admin Panel
                                </Link>
                            )}
                            <LogoutButton variant="header" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ── Constant-motion marquee ticker ────────────────────── */}
            {services.length > 0 && (
                <div className="relative z-20 -mt-5 mb-2 overflow-hidden">
                    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                        <div className="relative overflow-hidden rounded-full border border-[var(--color-border)] bg-white shadow-[var(--shadow-md)]">
                            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white to-transparent z-10" />
                            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white to-transparent z-10" />
                            <div className="flex w-max animate-[marquee_28s_linear_infinite] py-2.5">
                                {[...services, ...services].map((s, i) => (
                                    <span key={`${s.serviceId}-${i}`} className="mx-5 inline-flex items-center gap-2 text-xs font-medium text-[var(--color-ink-soft)] whitespace-nowrap">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" />
                                        {s.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Services ──────────────────────────────────────────── */}
            <main className="relative z-10 max-w-[1600px] mx-auto px-4 sm:px-8 lg:px-12 py-12 pb-24 -mt-6">
                {/* Motif backdrop — topographic contour lines */}
                <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.55]">
                    <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="topo" width="280" height="280" patternUnits="userSpaceOnUse">
                                <path d="M0 70 Q70 40 140 70 T280 70" fill="none" stroke="rgba(58,125,68,0.09)" strokeWidth="1.2" />
                                <path d="M0 120 Q70 85 140 120 T280 120" fill="none" stroke="rgba(58,125,68,0.07)" strokeWidth="1.2" />
                                <path d="M0 170 Q70 130 140 170 T280 170" fill="none" stroke="rgba(58,125,68,0.09)" strokeWidth="1.2" />
                                <path d="M0 220 Q70 180 140 220 T280 220" fill="none" stroke="rgba(58,125,68,0.06)" strokeWidth="1.2" />
                                <circle cx="60" cy="60" r="22" fill="none" stroke="rgba(58,125,68,0.08)" strokeWidth="1.2" />
                                <circle cx="60" cy="60" r="38" fill="none" stroke="rgba(58,125,68,0.05)" strokeWidth="1.2" />
                                <circle cx="215" cy="200" r="28" fill="none" stroke="rgba(92,64,51,0.08)" strokeWidth="1.2" />
                                <circle cx="215" cy="200" r="46" fill="none" stroke="rgba(92,64,51,0.05)" strokeWidth="1.2" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#topo)" />
                    </svg>
                </div>

                {services.length === 0 ? (
                    /* Empty state */
                    <div className="text-center py-20 bg-white/80 backdrop-blur-sm rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] animate-[scale-in_0.4s_var(--ease-out)_both]">
                        <div className="w-20 h-20 bg-[var(--color-paper-muted)] rounded-full flex items-center justify-center mx-auto mb-4">
                            <HardDrive className="w-9 h-9 text-[var(--color-ink-muted)]" />
                        </div>
                        <h3 className="text-xl font-semibold text-[var(--color-ink)]">Belum Ada Layanan</h3>
                        <p className="mt-2 text-[var(--color-ink-muted)] max-w-md mx-auto">
                            Anda belum memiliki akses ke layanan apapun. Hubungi administrator untuk mendapatkan akses.
                        </p>
                        {user.role === 'ADMIN' && (
                            <Link
                                href="/admin"
                                className="mt-6 inline-block px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors font-medium shadow-sm"
                            >
                                Kelola Layanan
                            </Link>
                        )}
                    </div>
                ) : (
                    <div className="space-y-14">
                        {groups.map((group, gi) => (
                            <section
                                key={group.key}
                                className="animate-[fade-up_0.55s_var(--ease-out)_both]"
                                style={{ animationDelay: `${gi * 90}ms` }}
                            >
                                {/* Group header */}
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-md flex items-center justify-center shrink-0 text-white">
                                        <group.icon className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                        <h2 className="text-xl font-bold text-[var(--color-ink)] tracking-tight leading-tight">{group.label}</h2>
                                        <p className="text-xs text-[var(--color-ink-muted)]">{group.hint}</p>
                                    </div>
                                    <span className="ml-auto shrink-0 h-px flex-1 max-w-[80px] bg-gradient-to-r from-[var(--color-border-strong)] to-transparent" />
                                    <span className="shrink-0 px-3 py-1 rounded-full bg-white text-[var(--color-ink-soft)] text-xs font-bold shadow-[var(--shadow-neu-sm)]">
                                        {group.items.length} layanan
                                    </span>
                                </div>

                                {/* Cards */}
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                                    {group.items.map((service, si) => (
                                        <div
                                            key={service.serviceId}
                                            className="animate-[fade-up_0.5s_var(--ease-out)_both]"
                                            style={{ animationDelay: `${gi * 90 + si * 60}ms` }}
                                        >
                                            <ServiceCard
                                                name={service.name}
                                                description={service.description || ''}
                                                icon={null}
                                                routeUrl={service.path || `/${service.serviceId}`}
                                                imagePath={service.imagePath}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ))}
                    </div>
                )}
            </main>

            {/* ── Footer strip ──────────────────────────────────────── */}
            <footer className="relative z-10 border-t border-[var(--color-border)] bg-white/60 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--color-ink-muted)]">
                    <p>&copy; {new Date().getFullYear()} PT Rebinmas Jaya · Portal Layanan Internal</p>
                    <p>{dateStr}</p>
                </div>
            </footer>
        </div>
    )
}