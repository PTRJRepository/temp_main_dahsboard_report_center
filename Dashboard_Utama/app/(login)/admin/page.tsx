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
import { Route } from 'lucide-react'

// Force Node.js runtime for mssql compatibility
export const runtime = 'nodejs'

async function getUsers() {
    return await userRepository.findAllWithPlainPassword()
}

async function getUserServiceMap(): Promise<Map<number, string[]>> {
    // Single AccessControl scan instead of one query per user (N+1).
    return userRepository.getAllUserServices()
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
            {/* Header band */}
            <div className="relative overflow-hidden rounded-[var(--radius-xl)] bg-gradient-to-br from-[#0c231a] via-[#123526] to-[#1b4a33] text-white p-7 md:p-9 shadow-xl">
                <span aria-hidden className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full border border-white/10 animate-[spin_50s_linear_infinite] border-dashed" />
                <span aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl animate-[drift_18s_var(--ease-in-out)_infinite_alternate]" />
                <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div>
                        <p className="text-emerald-200/70 text-xs uppercase tracking-wider mb-1.5">Control Center</p>
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight font-display">Panel Admin</h1>
                        <p className="text-sm text-white/60 mt-1.5">Kelola pengguna, layanan, peran, dan hak akses sistem</p>
                    </div>
                    <Link
                        href="/config-path"
                        className="group inline-flex w-fit items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-sm ring-1 ring-white/25 text-white rounded-xl transition-all text-sm font-semibold hover:-translate-y-0.5 duration-300"
                    >
                        Konfigurasi Route
                        <Route className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Segmented tab pills */}
            <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-[var(--shadow-neu-sm)] w-fit">
                <Link
                    href="/admin?tab=users"
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${tab === 'users'
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md'
                        : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-muted)]'}`}
                >
                    Pengguna
                </Link>
                <Link
                    href="/admin?tab=services"
                    className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${tab === 'services'
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md'
                        : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-muted)]'}`}
                >
                    Layanan & Hak Akses
                </Link>
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
