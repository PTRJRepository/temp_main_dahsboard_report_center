import { NextResponse } from 'next/server'
import { getPublicKey } from '@/utils/jwt'

// Public endpoint to get the JWT public key
// Other services can use this to verify tokens
export async function GET() {
    try {
        const publicKey = getPublicKey()

        if (!publicKey) {
            return NextResponse.json(
                { error: 'Public key not available' },
                { status: 500 }
            )
        }

        return NextResponse.json({
            algorithm: 'RS256',
            publicKey: publicKey
        })

    } catch (error) {
        console.error('Error getting public key:', error)
        return NextResponse.json(
            { error: 'Failed to get public key' },
            { status: 500 }
        )
    }
}
