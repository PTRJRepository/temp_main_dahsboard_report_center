import { NextRequest, NextResponse } from 'next/server'
import { authenticateUser } from '@/utils/auth-service'

// Use Node.js runtime for mssql compatibility
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { email, password } = body

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email dan password harus diisi' },
                { status: 400 }
            )
        }

        const result = await authenticateUser(email, password)

        if (!result.success) {
            console.warn('Login failed:', result.error)
            return NextResponse.json(
                { error: result.error },
                { status: 401 }
            )
        }

        // Set token in HTTP-only cookie for security
        const response = NextResponse.json({
            success: true,
            user: result.user,
            token: result.token // Also return token for API usage
        })

        // Set cookie - FOR LOCALHOST ALWAYS USE HTTP
        // Don't set explicit domain - let browser set it automatically
        // This ensures maximum compatibility across different environments
        response.cookies.set('auth-token', result.token!, {
            httpOnly: false, // Allow client-side access for localStorage sync
            secure: false, // MUST be false for HTTP localhost
            sameSite: 'lax',
            maxAge: 60 * 60 * 8, // 8 hours
            path: '/'
            // NOTE: Do NOT set 'domain' - this can cause cookie issues
            // Browser will automatically use the current domain
        })

        return response

    } catch (error) {
        console.error('Login error:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
