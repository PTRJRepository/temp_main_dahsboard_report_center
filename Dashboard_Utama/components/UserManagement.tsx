'use client'

import { useState } from 'react'
import AdminTableWrapper from './AdminTableWrapper'
import AddUserForm from './AddUserForm'
import { UserPlus } from 'lucide-react'

interface User {
    id: number
    name: string
    email: string
    role: string
    divisi?: string
    gang?: string
    plainPassword?: string
}

interface Service {
    serviceId: string
    name: string
    path?: string
}

interface Role {
    name: string
    description?: string
}

interface UserManagementProps {
    users: User[]
    services: Service[]
    roles: Role[]
}

export default function UserManagement({ users, services, roles }: UserManagementProps) {
    const [showAddForm, setShowAddForm] = useState(false)

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-2 bg-palm-green text-white rounded-lg hover:bg-palm-green-hover transition-colors flex items-center gap-2"
                >
                    <UserPlus className="h-4 w-4" />
                    Tambah Pengguna Baru
                </button>
            </div>
            <AdminTableWrapper users={users} services={services} roles={roles} />

            {showAddForm && (
                <AddUserForm onClose={() => setShowAddForm(false)} services={services} roles={roles} />
            )}
        </div>
    )
}
