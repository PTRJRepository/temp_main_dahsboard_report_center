'use server'

import { revalidatePath } from 'next/cache'
import { userRepository } from '@/utils/user-repository'
import { serviceRepository } from '@/utils/service-repository'

// USER ACTIONS
export async function createUser(formData: FormData) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const role = formData.get('role') as string
    const divisi = formData.get('divisi') as string

    // Validate required fields
    if (!name || !email || !password || !role) {
        return { error: 'Semua field harus diisi' }
    }

    // Validate password length
    if (password.length < 6) {
        return { error: 'Password minimal 6 karakter' }
    }

    // Validate role
    const validRoles = ['ADMIN', 'KERANI', 'ACCOUNTING', 'VISITOR']
    if (!validRoles.includes(role)) {
        return { error: 'Peran tidak valid' }
    }

    // Validate divisi for KERANI role
    if (role === 'KERANI' && !divisi) {
        return { error: 'Divisi harus dipilih untuk role KERANI' }
    }

    try {
        // Check if email already exists
        const existingUser = await userRepository.findByEmail(email)

        if (existingUser) {
            return { error: 'Email sudah terdaftar' }
        }

        // Create user using repository
        const newUser = await userRepository.create({ name, email, password, role, divisi })

        // Assign services if provided
        // formData.getAll('services') returns an array of strings (service IDs)
        const serviceIds = formData.getAll('services') as string[]
        if (newUser && serviceIds.length > 0) {
            await userRepository.assignServices(newUser.id, serviceIds)
        }

        revalidatePath('/admin')
        return { message: 'Pengguna berhasil dibuat' }
    } catch (e) {
        console.error('Error creating user:', e)
        return { error: 'Gagal membuat pengguna' }
    }
}

export async function deleteUser(userId: string) {
    try {
        await userRepository.delete(parseInt(userId))
        revalidatePath('/admin')
        return { message: 'User berhasil dihapus' }
    } catch (e) {
        return { error: 'Gagal menghapus user' }
    }
}

export async function updateUser(userId: string, formData: FormData) {
    const name = formData.get('name') as string
    const email = formData.get('email') as string
    const role = formData.get('role') as string
    const divisi = formData.get('divisi') as string
    const password = formData.get('password') as string
    const serviceIds = formData.getAll('services') as string[] // Get services

    // Validate required fields
    if (!name || !email || !role) {
        return { error: 'Nama, email, dan role harus diisi' }
    }

    // Validate password if provided
    if (password && password.length < 6) {
        return { error: 'Password minimal 6 karakter' }
    }

    // Validate role
    const validRoles = ['ADMIN', 'KERANI', 'ACCOUNTING', 'VISITOR']
    if (!validRoles.includes(role)) {
        return { error: 'Peran tidak valid' }
    }

    // Validate divisi for KERANI role
    if (role === 'KERANI' && !divisi) {
        return { error: 'Divisi harus dipilih untuk role KERANI' }
    }

    try {
        // Check if email exists for other user
        const existingUser = await userRepository.findByEmail(email)
        if (existingUser && existingUser.id !== parseInt(userId)) {
            return { error: 'Email sudah terdaftar untuk user lain' }
        }

        // Update user data
        const updateData: any = { name, email, role, divisi }
        if (password) {
            updateData.password = password
        }

        const success = await userRepository.update(parseInt(userId), updateData)

        if (success) {
            const shouldUpdateServices = formData.get('updateServices') === 'true'

            if (shouldUpdateServices) {
                await userRepository.assignServices(parseInt(userId), serviceIds)
            }

            revalidatePath('/admin')
            return { message: 'User berhasil diupdate' }
        } else {
            return { error: 'User tidak ditemukan' }
        }
    } catch (e) {
        console.error('Error updating user:', e)
        return { error: 'Gagal mengupdate user' }
    }
}

// Fetch user services
export async function fetchUserServices(userId: number) {
    try {
        const services = await userRepository.getUserServices(userId)
        return services
    } catch (e) {
        console.error('Error fetching user services:', e)
        return []
    }
}

export async function resetUserPassword(userId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
        return { error: 'Password minimal 6 karakter' }
    }

    try {
        const success = await userRepository.update(parseInt(userId), { password: newPassword })

        if (success) {
            revalidatePath('/admin')
            return { message: 'Password berhasil direset' }
        } else {
            return { error: 'User tidak ditemukan' }
        }
    } catch (e) {
        console.error('Error resetting password:', e)
        return { error: 'Gagal reset password' }
    }
}

// SERVICE ACTIONS
export async function addService(formData: FormData) {
    const serviceId = formData.get('serviceId') as string
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    const serviceUrl = formData.get('serviceUrl') as string
    const path = formData.get('path') as string
    const imagePath = formData.get('imagePath') as string // Add imagePath support

    if (!serviceId || !name || !serviceUrl) {
        return { error: 'Service ID, Nama, dan URL harus diisi' }
    }

    try {
        await serviceRepository.create({
            serviceId,
            name,
            description: description || '',
            serviceUrl,
            path: path || undefined,
            enabled: true,
            imagePath: imagePath || null
        })

        revalidatePath('/admin')
        return { message: 'Service berhasil ditambahkan' }
    } catch (e) {
        console.error('Error adding service:', e)
        return { error: 'Gagal menambahkan service' }
    }
}

export async function deleteService(serviceId: string) {
    try {
        await serviceRepository.delete(serviceId)
        revalidatePath('/admin')
        return { message: 'Service berhasil dihapus' }
    } catch (e) {
        return { error: 'Gagal menghapus service' }
    }
}

// ROLE PERMISSION ACTIONS
export async function assignServiceToRole(formData: FormData) {
    const role = formData.get('role') as string
    const serviceId = formData.get('serviceId') as string

    if (!role || !serviceId) {
        return { error: 'Role dan Service ID harus diisi' }
    }

    try {
        await serviceRepository.assignToRole(role, serviceId)
        revalidatePath('/admin')
        return { message: 'Hak akses berhasil diberikan' }
    } catch (e) {
        return { error: 'Gagal memberikan hak akses' }
    }
}

export async function removeServiceFromRole(formData: FormData) {
    const role = formData.get('role') as string
    const serviceId = formData.get('serviceId') as string

    if (!role || !serviceId) {
        return { error: 'Role dan Service ID harus diisi' }
    }

    try {
        await serviceRepository.removeFromRole(role, serviceId)
        revalidatePath('/admin')
        return { message: 'Hak akses berhasil dicabut' }
    } catch (e) {
        return { error: 'Gagal mencabut hak akses' }
    }
}
