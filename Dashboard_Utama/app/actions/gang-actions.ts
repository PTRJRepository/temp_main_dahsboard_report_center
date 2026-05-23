'use server'

/**
 * Gang item interface
 */
export interface GangItem {
    code: string
    description: string
    divisi: string
}

/**
 * Fetch gangs from the payroll backend
 * Returns gangs filtered by divisi if specified
 */
export async function fetchGangs(divisi?: string): Promise<GangItem[]> {
    try {
        // Call the backend API via internal network
        const backendUrl = process.env.PAYROLL_BACKEND_URL || 'http://localhost:8002'
        const response = await fetch(`${backendUrl}/payroll/divisions`, {
            cache: 'no-store'
        })

        if (!response.ok) {
            console.error('Failed to fetch gangs:', response.status)
            return []
        }

        const data = await response.json()

        // The API returns: { divisions: [{ code, description, divisi }] }
        let gangs: GangItem[] = data.divisions || []

        // Filter by divisi if specified
        if (divisi && divisi !== 'ALL') {
            gangs = gangs.filter(g => g.divisi === divisi)
        }

        return gangs
    } catch (error) {
        console.error('Error fetching gangs:', error)
        return []
    }
}
