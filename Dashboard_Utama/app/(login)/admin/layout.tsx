import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { User, LayoutDashboard, Settings, Users, Route } from 'lucide-react'
import { verifyToken } from '@/utils/jwt'
import LogoutButton from '@/components/LogoutButton'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Get JWT token from cookie - use await for Next.js 16
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value ||
        cookieStore.get('payroll_auth_token')?.value

    let user = null
    if (token) {
        const payload = verifyToken(token)
        if (payload) {
            user = {
                id: payload.userId,
                name: payload.name,
                email: payload.email,
                role: payload.role,
                image: null
            }
        }
    }

    // Double check admin role here for layout security
    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="flex h-screen items-center justify-center bg-[var(--color-paper-soft)]">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600">Akses Ditolak</h1>
                    <p className="mt-2 text-gray-600">Anda harus menjadi administrator untuk melihat halaman ini.</p>
                    <Link href="/dashboard-user" className="mt-4 inline-block px-4 py-2 bg-[var(--color-accent)] text-white rounded-lg">
                        Kembali ke Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    const navItems = [
        { href: '/admin', label: 'Manajemen Pengguna', icon: Users, activePrefix: '/admin' },
        { href: '/config-path', label: 'Konfigurasi Route', icon: Route, activePrefix: '/config-path' },
    ]

    return (
        <div className="flex h-screen bg-[var(--color-paper-soft)] relative overflow-hidden">
            {/* Ambient background */}
            <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
                <span className="absolute -top-32 right-0 h-96 w-96 rounded-full bg-emerald-200/20 blur-[130px] animate-[drift_22s_var(--ease-in-out)_infinite_alternate]" />
                <span className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-200/15 blur-[120px] animate-[drift_26s_var(--ease-in-out)_infinite_alternate-reverse]" />
            </div>

            {/* ── Premium dark sidebar ─────────────────────────────── */}
            <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-[#0c231a] via-[#10291e] to-[#0c231a] text-white relative z-10 shadow-2xl">
                {/* Brand */}
                <div className="flex items-center gap-3 h-16 px-5 border-b border-white/10">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-sm shadow-lg ring-1 ring-emerald-300/30">
                        R
                    </div>
                    <div className="leading-tight">
                        <p className="text-sm font-bold tracking-tight">REBINMAS ADMIN</p>
                        <p className="text-[10px] text-emerald-300/70 uppercase tracking-wider">Control Center</p>
                    </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
                    <p className="px-3 pt-2 pb-1.5 text-[10px] font-semibold text-white/40 uppercase tracking-wider">Menu</p>
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/65 hover:text-white hover:bg-white/[0.08] transition-all duration-200 relative"
                        >
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-emerald-400 scale-y-0 group-hover:scale-y-100 transition-transform" />
                            <item.icon className="w-4 h-4 text-white/45 group-hover:text-emerald-300 transition-colors" />
                            {item.label}
                            <Settings className="w-0 h-0 opacity-0" />
                        </Link>
                    ))}
                </nav>

                {/* User card */}
                <div className="p-4 border-t border-white/10">
                    <div className="flex items-center gap-3 px-3 py-3 bg-white/[0.06] rounded-xl ring-1 ring-white/10">
                        {user?.image ? (
                            <Image src={user.image} alt="User" width={34} height={34} className="rounded-full" />
                        ) : (
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shrink-0 shadow-md">
                                <User className="w-4 h-4" />
                            </div>
                        )}
                        <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{user?.name || 'Pengguna'}</p>
                            <p className="text-[11px] text-emerald-300/80 uppercase tracking-wide">{user?.role || 'Staf'}</p>
                        </div>
                    </div>
                    <div className="mt-2.5 [&_button]:!text-white/50 [&_button:hover]:!text-red-300">
                        <LogoutButton />
                    </div>
                </div>
            </aside>

            {/* ── Main content ─────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden relative z-10">
                {/* Mobile topbar */}
                <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#0c231a] text-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center font-bold text-xs">R</div>
                        <span className="text-sm font-bold">Admin</span>
                    </div>
                    <nav className="flex items-center gap-2">
                        <Link href="/admin" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors">Users</Link>
                        <Link href="/config-path" className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 hover:bg-white/20 transition-colors">Routes</Link>
                    </nav>
                </div>

                <main className="flex-1 overflow-y-auto p-4 md:p-8 animate-[fade-in_0.4s_var(--ease-out)_both]">
                    {children}
                </main>
            </div>
        </div>
    )
}