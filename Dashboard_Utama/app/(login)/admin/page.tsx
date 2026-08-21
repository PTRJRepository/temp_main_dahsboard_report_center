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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Panel Admin</h1>
                    <p className="text-sm text-gray-500">Selamat datang, {user.name}</p>
                </div>
                <div className="flex gap-2">
                    <Link
                        href="/config-path"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                        ⚙️ Konfigurasi Route
                    </Link>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="-mb-px flex space-x-8">
                    <Link
                        href="/admin?tab=users"
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${tab === 'users' ? 'border-palm-green text-palm-green' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        Pengguna
                    </Link>
                    <Link
                        href="/admin?tab=services"
                        className={`pb-4 px-1 border-b-2 font-medium text-sm ${tab === 'services' ? 'border-palm-green text-palm-green' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                    >
                        Layanan & Hak Akses
                    </Link>
                </nav>
            </div>

            {tab === 'users' ? (
                <UserManagement users={users} services={services} roles={roles} />
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
