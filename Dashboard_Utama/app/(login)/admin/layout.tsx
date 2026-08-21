import { cookies } from 'next/headers'
import Image from 'next/image'
import Link from 'next/link'
import { User, LayoutDashboard, Settings } from 'lucide-react'
import { verifyToken } from '@/utils/jwt'
import LogoutButton from '@/components/LogoutButton'

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // Get JWT token from cookie - use await for Next.js 16
    const cookieStore = await cookies()
    // Check both auth-token and legacy payroll_auth_token for consistency with middleware
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
            <div className="flex h-screen items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600">Akses Ditolak</h1>
                    <p className="mt-2 text-gray-600">Anda harus menjadi administrator untuk melihat halaman ini.</p>
                    <Link href="/config-path" className="mt-4 inline-block px-4 py-2 bg-palm-green text-white rounded-lg">
                        Kembali ke Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-[var(--color-paper-soft)]">
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-64 bg-[var(--color-paper)] border-r border-[var(--color-border)]">
                <div className="flex items-center gap-2.5 h-16 px-5 border-b border-[var(--color-border)]">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] flex items-center justify-center text-white font-bold text-sm shadow-[var(--shadow-sm)]">
                        R
                    </div>
                    <div>
                        <span className="text-sm font-bold text-[var(--color-ink)] tracking-tight leading-none block">REBINMAS ADMIN</span>
                        <span className="text-[10px] text-[var(--color-ink-muted)] uppercase tracking-wider">Control Center</span>
                    </div>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-[var(--color-ink-muted)] uppercase tracking-wider">Navigasi</p>
                    <Link href="/config-path" className="flex items-center px-3 py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-accent)] rounded-lg transition-colors">
                        <LayoutDashboard className="w-4 h-4 mr-3 text-[var(--color-ink-muted)] group-hover:text-[var(--color-accent)]" />
                        Konfigurasi Route
                    </Link>
                    <Link href="/admin" className="flex items-center px-3 py-2.5 text-sm font-medium text-white bg-[var(--color-accent)] rounded-lg shadow-[var(--shadow-sm)]">
                        <Settings className="w-4 h-4 mr-3 text-white" />
                        Manajemen Pengguna
                    </Link>
                </nav>
                <div className="p-4 border-t border-[var(--color-border)]">
                    <div className="flex items-center px-3 py-3 bg-[var(--color-paper-soft)] rounded-lg border border-[var(--color-border)]">
                        {user?.image ? (
                            <Image src={user.image} alt="User" width={32} height={32} className="rounded-full" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-[var(--color-accent-soft)] flex items-center justify-center text-[var(--color-accent)]">
                                <User className="w-4 h-4" />
                            </div>
                        )}
                        <div className="ml-3 min-w-0">
                            <p className="text-sm font-medium text-[var(--color-ink)] truncate">{user?.name || 'Pengguna'}</p>
                            <p className="text-xs text-[var(--color-ink-muted)] uppercase">{user?.role || 'Staf'}</p>
                        </div>
                    </div>
                    <div className="mt-2">
                        <LogoutButton />
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    )
}
