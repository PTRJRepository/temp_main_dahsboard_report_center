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
