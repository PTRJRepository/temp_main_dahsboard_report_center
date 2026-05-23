'use client'

import AdminTable from './AdminTable'
import EditUserModal from './EditUserModal'
import { deleteUser, resetUserPassword } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface User {
    id: number
    name: string
    email: string
    role: string
    divisi?: string
    plainPassword?: string
}

interface Service {
    serviceId: string
    name: string
    path?: string
}

interface AdminTableWrapperProps {
    users: User[]
    services: Service[]
}

export default function AdminTableWrapper({ users, services }: AdminTableWrapperProps) {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [editingUser, setEditingUser] = useState<User | null>(null)

    const handleDelete = async (id: number) => {
        if (confirm('Yakin ingin menghapus pengguna ini?')) {
            setIsLoading(true)
            try {
                await deleteUser(String(id))
                router.refresh()
            } catch (error) {
                alert('Gagal menghapus user')
            } finally {
                setIsLoading(false)
            }
        }
    }

    const handleEdit = (id: number) => {
        const userToEdit = users.find(u => u.id === id)
        if (userToEdit) {
            setEditingUser(userToEdit)
        }
    }

    const handleResetPassword = async (id: number) => {
        // ... (Logic moved to EditUserModal, but kept here for fallback or specific button access if needed)
        // Since we have "Reset Password" button in the table, we should keep this OR map it to opening the modal.
        // The implementation plan says "Allow resetting user password". EditUserModal has it.
        // Should we remove the key button from the table? Or make it open the modal with password focus?
        // Let's keep the legacy inline reset for quick access, as implemented in EditUserModal too.

        const newPassword = prompt('Masukkan password baru (minimal 6 karakter):')
        if (!newPassword) return

        if (newPassword.length < 6) {
            alert('Password minimal 6 karakter')
            return
        }

        if (confirm(`Reset password user dengan password: ${newPassword}?`)) {
            setIsLoading(true)
            try {
                const result = await resetUserPassword(String(id), newPassword)
                if (result.error) {
                    alert(result.error)
                } else {
                    alert(result.message)
                    router.refresh()
                }
            } catch (error) {
                alert('Gagal reset password')
            } finally {
                setIsLoading(false)
            }
        }
    }

    return (
        <>
            <AdminTable
                users={users}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onResetPassword={handleResetPassword}
            />

            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    services={services}
                    onClose={() => {
                        setEditingUser(null)
                        router.refresh()
                    }}
                />
            )}
        </>
    )
}
