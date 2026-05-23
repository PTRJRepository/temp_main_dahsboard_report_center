'use server'

import { revalidatePath } from 'next/cache'
import { userRepository } from '@/utils/user-repository'
import { serviceRepository } from '@/utils/service-repository'

export interface ActionState {
    success: boolean
    message?: string
    error?: string
}

export async function createUser(data: {
    name: string
    email: string
    password: string
    role: string
    divisi: string
    serviceIds?: string[]
}): Promise<ActionState> {
    try {
        const existing = await userRepository.findByEmail(data.email)
        if (existing) {
            return { success: false, error: 'Email sudah terdaftar' }
        }

        const newUser = await userRepository.create({
            name: data.name,
            email: data.email,
            password: data.password,
            role: data.role,
            divisi: data.divisi
        })

        if (newUser && data.serviceIds && data.serviceIds.length > 0) {
            await userRepository.assignServices(newUser.id, data.serviceIds)
        }

        revalidatePath('/admin')
        return { success: true, message: 'Pengguna berhasil dibuat' }
    } catch (error) {
        console.error('Create user error:', error)
        return { success: false, error: 'Gagal membuat pengguna' }
    }
}

export async function updateUser(id: number, data: {
    name: string
    email: string
    role: string
    divisi: string
}): Promise<ActionState> {
    try {
        await userRepository.update(id, {
            name: data.name,
            email: data.email,
            role: data.role,
            divisi: data.divisi
        })

        revalidatePath('/admin')
        return { success: true, message: 'Data pengguna berhasil diperbarui' }
    } catch (error) {
        console.error('Update user error:', error)
        return { success: false, error: 'Gagal memperbarui data pengguna' }
    }
}

export async function resetPassword(id: number, newPassword: string): Promise<ActionState> {
    try {
        await userRepository.update(id, { password: newPassword })
        return { success: true, message: 'Password berhasil direset' }
    } catch (error) {
        console.error('Reset password error:', error)
        return { success: false, error: 'Gagal mereset password' }
    }
}

export async function deleteUser(id: number): Promise<ActionState> {
    try {
        await userRepository.delete(id)
        revalidatePath('/admin')
        return { success: true, message: 'Pengguna berhasil dihapus' }
    } catch (error) {
        console.error('Delete user error:', error)
        return { success: false, error: 'Gagal menghapus pengguna' }
    }
}

export async function updateUserServices(userId: number, serviceIds: string[]): Promise<ActionState> {
    try {
        await userRepository.assignServices(userId, serviceIds)
        revalidatePath('/admin')
        return { success: true, message: 'Hak akses layanan berhasil diperbarui' }
    } catch (error) {
        console.error('Update user services error:', error)
        return { success: false, error: 'Gagal memperbarui layanan' }
    }
}

export async function fetchUserServices(userId: number): Promise<string[]> {
    try {
        return await userRepository.getUserServices(userId)
    } catch (error) {
        console.error('Fetch user services error:', error)
        return []
    }
}

export async function changePassword(
    userId: number,
    oldPassword: string,
    newPassword: string
): Promise<ActionState> {
    try {
        // Get user by ID
        const user = await userRepository.findById(userId)
        if (!user) {
            return { success: false, error: 'User tidak ditemukan' }
        }

        // Verify old password
        const verified = await userRepository.verifyPassword(user.email, oldPassword)
        if (!verified) {
            return { success: false, error: 'Password lama tidak sesuai' }
        }

        // Validate new password
        if (newPassword.length < 6) {
            return { success: false, error: 'Password baru minimal 6 karakter' }
        }

        // Update to new password
        await userRepository.update(userId, { password: newPassword })
        return { success: true, message: 'Password berhasil diubah' }
    } catch (error) {
        console.error('Change password error:', error)
        return { success: false, error: 'Gagal mengubah password' }
    }
}
