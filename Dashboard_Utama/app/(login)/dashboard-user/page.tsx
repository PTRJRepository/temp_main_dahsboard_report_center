import { cookies } from 'next/headers'
import { verifyToken } from '@/utils/jwt'
import { getGatewayFallbackServices, serviceRepository, Service } from '@/utils/service-repository'
import { userRepository } from '@/utils/user-repository'
import Link from 'next/link'
import { Shield, Settings, Grid3X3, TrendingUp, Database, LayoutDashboard, HardDrive } from 'lucide-react'
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
const SERVICE_GROUPS: { key: string; label: string; hint: string; icon: typeof Database; filter: (s: Service) => boolean }[] = [
    { key: 'operasi', label: 'Operasional Kebun', hint: 'Absensi, produksi, monitoring lapangan', icon: Grid3X3, filter: s => /absen|absensi|produksi|basis-panen|monitoring|panen/i.test(s.serviceId + s.name) },
    { key: 'keuangan', label: 'Keuangan & Payroll', hint: 'Penggajian, tunjangan, pajak, upah', icon: TrendingUp, filter: s => /payroll|upah|tunjangan|tax|pajak|spreadsheet|gaji/i.test(s.serviceId + s.name) },
    { key: 'sistem', label: 'Sistem & Monitoring', hint: 'Server, jaringan, query gateway', icon: Database, filter: s => /server|network|monitor|query|file|rjfm|ifess/i.test(s.serviceId + s.name) },
    { key: 'lainnya', label: 'Layanan Lainnya', hint: 'Modul dan layanan tambahan', icon: LayoutDashboard, filter: () => true },
]

const UNGROUPED = (s: Service) => true

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

    // Build groups, skip empty ones.
    const groups = SERVICE_GROUPS
        .map(g => ({
            ...g,
            items: services.filter(g.filter),
        }))
        .filter(g => g.items.length > 0)

    const ungrouped = groups.length === 0 ? services : []
    const now = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Selamat pagi' : hour < 18 ? 'Selamat siang' : 'Selamat malam'

    return (
        <div className="min-h-screen bg-[var(--color-paper-soft)] relative">
            {/* Ambient accent wash */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] overflow-hidden">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[420px] rounded-full bg-[var(--color-accent-soft)] blur-[120px]" />
            </div>

            {/* Header */}
            <header className="relative border-b border-[var(--color-border)] bg-[var(--color-paper)]/80 backdrop-blur-xl sticky top-0 z-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-11 h-11 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center text-white font-bold text-lg shadow-[var(--shadow-md)]">
                                    {user.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--color-success)] ring-2 ring-white" />
                            </div>
                            <div>
                                <p className="text-xs text-[var(--color-ink-muted)]">{greeting} · {now}</p>
                                <h1 className="text-lg font-bold text-[var(--color-ink)] tracking-tight leading-tight">
                                    {user.name}
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-paper-soft)] text-[var(--color-ink-soft)] rounded-full text-xs font-medium border border-[var(--color-border)]">
                                <Shield className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                                {user.role}
                            </div>
                            <ChangePasswordButton userId={Number(user.id)} />
                            {user.role === 'ADMIN' && (
                                <Link
                                    href="/admin"
                                    className="flex items-center gap-2 px-3.5 py-2 bg-[var(--color-ink)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors text-sm font-medium shadow-[var(--shadow-sm)]"
                                >
                                    <Settings className="w-4 h-4" />
                                    Admin Panel
                                </Link>
                            )}
                            <LogoutButton variant="header" />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-16">
                {/* Section header */}
                <div className="mb-8 animate-[fade-up_0.5s_var(--ease-out)_both]">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-accent-soft)] flex items-center justify-center">
                            <HardDrive className="w-4 h-4 text-[var(--color-accent)]" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight font-display">Layanan Anda</h2>
                            <p className="text-sm text-[var(--color-ink-muted)]">Daftar layanan yang dapat Anda akses</p>
                        </div>
                    </div>
                </div>

                {services.length > 0 ? (
                    <div className="space-y-10">
                        {groups.map((group, gi) => (
                            <section
                                key={group.key}
                                className="animate-[fade-up_0.5s_var(--ease-out)_both]"
                                style={{ animationDelay: `${gi * 80}ms` }}
                            >
                                <div className="flex items-center gap-2.5 mb-4">
                                    <div className="w-7 h-7 rounded-[var(--radius-sm)] bg-[var(--color-accent-soft)] flex items-center justify-center">
                                        <group.icon className="w-4 h-4 text-[var(--color-accent)]" />
                                    </div>
                                    <h3 className="text-base font-semibold text-[var(--color-ink)]">{group.label}</h3>
                                    <span className="text-xs text-[var(--color-ink-muted)]">{group.hint}</span>
                                    <span className="ml-auto px-2 py-0.5 rounded-full bg-[var(--color-paper-muted)] text-[var(--color-ink-muted)] text-[11px] font-medium border border-[var(--color-border)]">
                                        {group.items.length}
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {group.items.map((service, si) => (
                                        <div
                                            key={service.serviceId}
                                            className="animate-[fade-up_0.5s_var(--ease-out)_both]"
                                            style={{ animationDelay: `${gi * 80 + si * 50}ms` }}
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

                        {ungrouped.length > 0 && (
                            <section className="animate-[fade-up_0.5s_var(--ease-out)_both]">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <LayoutDashboard className="w-4 h-4 text-[var(--color-accent)]" />
                                    <h3 className="text-base font-semibold text-[var(--color-ink)]">Layanan</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                                    {ungrouped.map((service) => (
                                        <ServiceCard
                                            key={service.serviceId}
                                            name={service.name}
                                            description={service.description || ''}
                                            icon={null}
                                            routeUrl={service.path || `/${service.serviceId}`}
                                            imagePath={service.imagePath}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-16 bg-white rounded-[var(--radius-xl)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] animate-[scale-in_0.4s_var(--ease-out)_both]">
                        <div className="w-20 h-20 bg-[var(--color-paper-soft)] rounded-full flex items-center justify-center mx-auto mb-4">
                            <Database className="w-10 h-10 text-[var(--color-ink-muted)]" />
                        </div>
                        <h3 className="text-xl font-semibold text-[var(--color-ink)]">Belum Ada Layanan</h3>
                        <p className="mt-2 text-[var(--color-ink-muted)] max-w-md mx-auto">
                            Anda belum memiliki akses ke layanan apapun. Hubungi administrator untuk mendapatkan akses.
                        </p>
                        {user.role === 'ADMIN' && (
                            <Link
                                href="/admin"
                                className="mt-6 inline-block px-6 py-3 bg-[var(--color-accent)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors font-medium shadow-[var(--shadow-sm)]"
                            >
                                Kelola Layanan
                            </Link>
                        )}
                    </div>
                )}
            </main>
        </div>
    )
}