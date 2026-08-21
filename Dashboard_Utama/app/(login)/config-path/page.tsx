import { cookies } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { LayoutDashboard, Settings, RefreshCw } from 'lucide-react'
import { verifyToken } from '@/utils/jwt'
import { getRouteConfig, toggleRouteEnabled, removeRoute } from './actions'
import LogoutButton from '@/components/LogoutButton'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export default async function ConfigPathPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value ||
        cookieStore.get('payroll_auth_token')?.value

    let user = null
    if (token) {
        const payload = verifyToken(token)
        if (payload) {
            user = { name: payload.name, email: payload.email, role: payload.role }
        }
    }

    if (!user || user.role !== 'ADMIN') {
        redirect('/login')
    }

    const { dev, prod } = await getRouteConfig()

    return (
        <div className="flex h-screen bg-gray-50">
            <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200">
                <div className="flex items-center h-16 px-6 border-b border-gray-200 bg-gray-900">
                    <span className="text-xl font-bold text-white">REBINMAS ADMIN</span>
                </div>
                <nav className="flex-1 p-4 space-y-1">
                    <Link href="/config-path" className="flex items-center px-4 py-2.5 text-sm font-medium text-white bg-gray-900 rounded-lg group transition-colors">
                        <LayoutDashboard className="w-5 h-5 mr-3 text-white" />
                        Konfigurasi Route
                    </Link>
                    <Link href="/admin" className="flex items-center px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                        <Settings className="w-5 h-5 mr-3 text-gray-400" />
                        Manajemen Pengguna
                    </Link>
                </nav>
                <div className="p-4 border-t border-gray-200">
                    <div className="flex items-center px-4 py-3 bg-gray-50 rounded-lg">
                        <div className="w-8 h-8 rounded-full bg-palm-green/20 flex items-center justify-center text-palm-green">
                            <span className="text-sm font-bold">{user.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                        </div>
                        <div className="ml-3">
                            <p className="text-sm font-medium text-gray-900">{user.name}</p>
                            <p className="text-xs text-gray-500 uppercase">{user.role}</p>
                        </div>
                    </div>
                    <LogoutButton />
                </div>
            </aside>

            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Konfigurasi Route</h1>
                        <p className="text-sm text-gray-500">Kelola proxy route gateway (routes-config.json)</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
                        <RefreshCw className="w-4 h-4" />
                        Perubahan aktif setelah gateway restart
                    </div>
                </div>

                <RouteTable title="Development (routes-config.json)" routes={dev} />

                <div className="mt-8">
                    <RouteTable title="Production (routes-config.production.json)" routes={prod} />
                </div>
            </main>
        </div>
    )
}

interface RouteRow {
    id: string
    path?: string
    target?: string
    name?: string
    description?: string
    enabled?: boolean
    public?: boolean
    hidden?: boolean
    [key: string]: unknown
}

function RouteTable({ title, routes }: { title: string; routes: RouteRow[] }) {
    return (
        <div className="bg-white rounded-lg shadow border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
                <p className="text-xs text-gray-500">{routes.length} route</p>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Path</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {routes.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                    Tidak ada route
                                </td>
                            </tr>
                        )}
                        {routes.map(route => (
                            <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{route.id}</td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{route.path || '/'}</code>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">{route.target || '—'}</td>
                                <td className="px-6 py-3 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${route.enabled === false ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                        {route.enabled === false ? 'Nonaktif' : 'Aktif'}
                                    </span>
                                </td>
                                <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                                    <form action={toggleRouteEnabled} className="inline mr-2">
                                        <input type="hidden" name="routeId" value={route.id} />
                                        <input type="hidden" name="enabled" value={route.enabled === false ? 'true' : 'false'} />
                                        <button type="submit" className="text-indigo-600 hover:text-indigo-900">
                                            {route.enabled === false ? 'Aktifkan' : 'Nonaktifkan'}
                                        </button>
                                    </form>
                                    <form action={removeRoute} className="inline">
                                        <input type="hidden" name="routeId" value={route.id} />
                                        <button type="submit" className="text-red-600 hover:text-red-900">Hapus</button>
                                    </form>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
