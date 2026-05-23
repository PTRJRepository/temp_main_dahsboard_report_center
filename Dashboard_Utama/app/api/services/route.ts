import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/utils/jwt'
import { getUserServices } from '@/utils/auth-service'

// Use Node.js runtime for mssql compatibility
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
    try {
        // Get token from cookie or header (support both auth-token and payroll_auth_token)
        const token = request.cookies.get('auth-token')?.value ||
                     request.cookies.get('payroll_auth_token')?.value ||
                     request.headers.get('Authorization')?.replace('Bearer ', '')

        if (!token) {
            return NextResponse.json(
                { error: 'Token tidak ditemukan' },
                { status: 401 }
            )
        }

        // Verify token
        const payload = verifyToken(token)
        if (!payload) {
            return NextResponse.json(
                { error: 'Token tidak valid atau expired' },
                { status: 401 }
            )
        }

        // Get services for user's role
        const services = await getUserServices(payload.role)

        return NextResponse.json({
            success: true,
            user: {
                id: payload.userId,
                name: payload.name,
                email: payload.email,
                role: payload.role
            },
            services
        })

    } catch (error) {
        console.error('Services error:', error)
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        )
    }
}
