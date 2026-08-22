
import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenEdge } from '@/utils/jwt-edge'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { token } = body

        if (!token) {
            return NextResponse.json({ valid: false }, { status: 400 })
        }

        // Verify token using Edge-compatible verifier
        const payload = await verifyTokenEdge(token)

        if (!payload) {
            return NextResponse.json({ valid: false }, { status: 401 })
        }

        // If valid, restore the cookie
        const response = NextResponse.json({
            valid: true,
            user: {
                id: payload.userId,
                email: payload.email,
                name: payload.name,
                role: payload.role
            }
        })

        // Set cookie - FOR LOCALHOST ALWAYS USE HTTP
        response.cookies.set('auth-token', token, {
            httpOnly: false, // Allow client-side access
            secure: false, // MUST be false for HTTP localhost
            sameSite: 'lax',
            maxAge: 60 * 60 * 8, // 8 hours
            path: '/'
        })

        return response
    } catch (error) {
        console.error('Token verification error:', error)
        return NextResponse.json({ valid: false }, { status: 500 })
    }
}
