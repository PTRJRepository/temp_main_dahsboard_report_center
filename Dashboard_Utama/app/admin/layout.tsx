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
        <div className="flex h-screen bg-gray-50">
            {/* Sidebar - Reused Concept */}
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
                <div className="flex items-center h-16 px-6 border-b border-gray-200 bg-gray-900">
                    <span className="text-xl font-bold text-white">REBINMAS ADMIN</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <Link href="/config-path" className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <LayoutDashboard className="w-5 h-5 mr-3 text-gray-400" />
                        Konfigurasi Route
                    </Link>
                    <Link href="/admin" className="flex items-center px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg group transition-colors">
                        <Settings className="w-5 h-5 mr-3 text-white" />
                        Manajemen Pengguna
                    </Link>
                    {/* Add Service Management Link later */}
                </nav>
                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center px-4 py-3 bg-gray-50 rounded-lg">
                        {user?.image ? (
                            <Image src={user.image} alt="User" width={32} height={32} className="rounded-full" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-palm-green/20 flex items-center justify-center text-palm-green">
                                <User className="w-4 h-4" />
                            </div>
                        )}
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{user?.name || 'Pengguna'}</p>
                            <p className="text-xs text-gray-500 uppercase">{user?.role || 'Staf'}</p>
                        </div>
                    </div>
                    <LogoutButton />
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
