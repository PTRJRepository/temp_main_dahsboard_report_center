import { NextRequest, NextResponse } from 'next/server'

// GET handler - DO NOT delete cookies here!
// Next.js RSC prefetch will call this and accidentally log out users
// Real logout must use POST method
export async function GET(request: NextRequest) {
    // Just redirect to home page without deleting cookies
    // The actual logout is handled by POST method only
    return NextResponse.redirect(new URL('/login', request.url))
}

export async function POST() {
    const response = NextResponse.json({ success: true, message: 'Logged out successfully' })

    // Clear both auth token cookies
    response.cookies.delete('auth-token')
    response.cookies.delete('payroll_auth_token')
    response.cookies.delete('payroll_user_info')

    return response
}
