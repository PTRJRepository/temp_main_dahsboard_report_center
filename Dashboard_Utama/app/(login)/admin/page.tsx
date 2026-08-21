import { cookies } from 'next/headers'
import UserManagement from '@/components/UserManagement'
import ServiceTable from '@/components/ServiceTable'
import AddServiceForm from '@/components/AddServiceForm'
import AddRoleForm from '@/components/AddRoleForm'
import PermissionsTable from '@/components/PermissionsTable'
import { userRepository } from '@/utils/user-repository'
import { serviceRepository } from '@/utils/service-repository'
import { roleRepository } from '@/utils/role-repository'
import { verifyToken } from '@/utils/jwt'
import Link from 'next/link'

// Force Node.js runtime for mssql compatibility
export const runtime = 'nodejs'

async function getUsers() {
    return await userRepository.findAllWithPlainPassword()
}

async function getUserServiceMap(): Promise<Map<number, string[]>> {
    const map = new Map<number, string[]>()
    try {
        const users = await userRepository.findAll()
        for (const u of users) {
            const svcs = await userRepository.getUserServices(u.id)
            map.set(u.id, svcs)
        }
    } catch (e) {
        console.error('Failed to load user services:', e)
    }
    return map
}

async function getServices() {
    return await serviceRepository.findAll()
}

async function getPermissions() {
    return await serviceRepository.findAllPermissions()
}

async function getRoles() {
    return await roleRepository.findAll()
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
    // Get JWT token from cookie - use await for Next.js 16
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value ||
        cookieStore.get('payroll_auth_token')?.value

    // Await searchParams for Next.js 16
    const params = await searchParams
    const tab = params?.tab || 'users'

    let user = null
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

    // Check if user is admin
    if (!user || user.role !== 'ADMIN') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center py-12 px-8 bg-white rounded-2xl shadow-lg max-w-md">
                    <h1 className="text-2xl font-bold text-red-600">Akses Ditolak</h1>
                    <p className="mt-2 text-gray-600">Anda harus menjadi administrator untuk melihat halaman ini.</p>
                    <Link
                        href="/"
                        className="mt-6 inline-block px-6 py-3 bg-palm-green text-white rounded-lg hover:bg-palm-green-hover transition-colors"
                    >
                        Kembali ke Dashboard
                    </Link>
                </div>
            </div>
        )
    }

    const users = await getUsers()
    const services = await getServices()
    const permissions = await getPermissions()
    const roles = await getRoles()
    const userServices = await getUserServiceMap()

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">Panel Admin</h1>
                    <p className="text-sm text-[var(--color-ink-muted)]">Selamat datang, {user.name}</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/config-path"
                        className="px-4 py-2 bg-[var(--color-ink)] text-white rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors text-sm font-medium shadow-[var(--shadow-sm)]"
                    >
                        Konfigurasi Route
                    </Link>
                </div>
            </div>

            <div className="border-b border-[var(--color-border)]">
                <nav className="-mb-px flex space-x-2">
                    <Link
                        href="/admin?tab=users"
                        className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-colors ${tab === 'users' ? 'bg-white text-[var(--color-accent)] border border-[var(--color-border)] border-b-white -mb-px font-semibold' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'}`}
                    >
                        Pengguna
                    </Link>
                    <Link
                        href="/admin?tab=services"
                        className={`px-4 py-2.5 rounded-t-lg font-medium text-sm transition-colors ${tab === 'services' ? 'bg-white text-[var(--color-accent)] border border-[var(--color-border)] border-b-white -mb-px font-semibold' : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'}`}
                    >
                        Layanan & Hak Akses
                    </Link>
                </nav>
            </div>

            {tab === 'users' ? (
                <UserManagement users={users} services={services} roles={roles} userServices={userServices} />
            ) : (
                <div className="space-y-8">
                    <PermissionsTable services={services} permissions={permissions} roles={roles} />
                    <div className="border-t border-gray-200 pt-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Tambah Layanan Baru</h3>
                        <AddServiceForm />
                    </div>

                    <div className="mt-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Daftar Layanan</h3>
                        <ServiceTable services={services} />
                    </div>

                    <div className="border-t border-gray-200 pt-8">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Manajemen Peran</h3>
                        <AddRoleForm roles={roles} />
                    </div>
                </div>
            )}
        </div>
    )
}
