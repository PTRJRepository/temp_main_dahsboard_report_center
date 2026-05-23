import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const ROUTES_CONFIG_PATH = path.join(process.cwd(), '..', 'routes-config.json')

export async function syncRoutesConfig() {
    try {
        const services = await prisma.service.findMany({
            where: {
                path: { not: null },
                targetUrl: { not: null },
                enabled: true
            }
        })

        // Read existing to preserve non-DB routes if needed? 
        // Or overwrite? Requirements say Admin manages services.
        // Let's preserve items without IDs matching our pattern or valid services?
        // Actually, user wants dashboard to manage it. Let's overwrite safely or merge.
        // Simple approach: Map DB services to route objects.

        const dbRoutes = services.map(service => ({
            id: service.id,
            path: service.path!, // Checked in where clause
            target: service.targetUrl!,
            description: service.name,
            enabled: service.enabled
        }))

        // Load existing to keep manual ones if they don't conflict? 
        // For now, let's assume DB is source of truth for "Managed" routes.
        // We can append or just overwrite. User said "menu for config... displayed on web... accessible easily".
        // Let's write array to file.

        // Ensure directory exists (it should, parent)

        fs.writeFileSync(ROUTES_CONFIG_PATH, JSON.stringify(dbRoutes, null, 2))
        console.log('✅ Synced routes to ' + ROUTES_CONFIG_PATH)
        return true
    } catch (e) {
        console.error('Failed to sync routes:', e)
        return false
    }
}
