'use server'

import { serviceRepository } from '@/utils/service-repository'
import { revalidatePath } from 'next/cache'

export async function togglePermission(role: string, serviceId: string, hasAccess: boolean) {
    try {
        if (hasAccess) {
            // Remove access
            await serviceRepository.removeFromRole(role, serviceId)
        } else {
            // Grant access
            await serviceRepository.assignToRole(role, serviceId)
        }
        revalidatePath('/admin')
        revalidatePath('/dashboard-user')
        return { success: true }
    } catch (error) {
        console.error('Failed to toggle permission:', error)
        return { success: false, error: 'Failed to update permission' }
    }
}
