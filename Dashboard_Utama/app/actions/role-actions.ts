'use server'

import { revalidatePath } from 'next/cache'
import { roleRepository } from '@/utils/role-repository'

export async function addRole(formData: FormData) {
    const name = (formData.get('name') as string || '').trim().toUpperCase()
    const description = (formData.get('description') as string || '').trim()

    if (!name) {
        return { error: 'Nama peran harus diisi' }
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) {
        return { error: 'Nama peran hanya huruf besar, angka, underscore (contoh: SUPERVISOR, KEPALA_ESTATE)' }
    }

    try {
        const existing = await roleRepository.findAll()
        if (existing.some(r => r.name.toUpperCase() === name)) {
            return { error: `Peran ${name} sudah ada` }
        }

        await roleRepository.create({ name, description: description || undefined })
        revalidatePath('/admin')
        return { message: `Peran ${name} berhasil ditambahkan` }
    } catch (e) {
        console.error('Error adding role:', e)
        return { error: 'Gagal menambahkan peran' }
    }
}

export async function deleteRole(name: string) {
    try {
        await roleRepository.delete(name)
        revalidatePath('/admin')
        return { message: `Peran ${name} berhasil dihapus` }
    } catch (e) {
        console.error('Error deleting role:', e)
        return { error: 'Gagal menghapus peran' }
    }
}

export async function updateRole(formData: FormData) {
    const oldName = (formData.get('oldName') as string || '').trim().toUpperCase()
    const newName = (formData.get('newName') as string || '').trim().toUpperCase()

    if (!oldName || !newName) {
        return { error: 'Nama peran lama dan baru harus diisi' }
    }
    if (!/^[A-Z][A-Z0-9_]*$/.test(newName)) {
        return { error: 'Nama peran hanya huruf besar, angka, underscore (contoh: SUPERVISOR, KEPALA_ESTATE)' }
    }

    try {
        const existing = await roleRepository.findAll()
        if (existing.some(r => r.name.toUpperCase() === newName && r.name.toUpperCase() !== oldName)) {
            return { error: `Peran ${newName} sudah ada` }
        }

        await roleRepository.update(oldName, newName)
        revalidatePath('/admin')
        return { message: `Peran ${oldName} diubah menjadi ${newName}` }
    } catch (e) {
        console.error('Error updating role:', e)
        return { error: 'Gagal mengubah peran' }
    }
}
