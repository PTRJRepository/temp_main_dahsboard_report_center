'use server'

import { revalidatePath } from 'next/cache'
import { listAllRoutes, setRouteEnabled, deleteRoute } from '@/utils/route-config-sync'

export async function getRouteConfig() {
    const { dev, prod } = listAllRoutes()
    return { dev, prod }
}

// Form-action wrappers (hidden inputs carry routeId + enabled).
export async function toggleRouteEnabled(formData: FormData): Promise<void> {
    const routeId = formData.get('routeId') as string
    const enabled = formData.get('enabled') === 'true'
    if (routeId) setRouteEnabled(routeId, enabled)
    revalidatePath('/config-path')
}

export async function removeRoute(formData: FormData): Promise<void> {
    const routeId = formData.get('routeId') as string
    if (routeId) deleteRoute(routeId)
    revalidatePath('/config-path')
}
