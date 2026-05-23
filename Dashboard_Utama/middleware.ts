import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Skip middleware for static files and API routes
  if (
    request.nextUrl.pathname.startsWith('/_next') ||
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.includes('.') // static files
  ) {
    return NextResponse.next();
  }

  // Check for auth session (localStorage-based for demo)
  // In production, this would verify a JWT or session cookie
  const authHeader = request.headers.get('x-user-role');
  const pathname = request.nextUrl.pathname;

  // Admin routes require admin role
  if (pathname.startsWith('/admin')) {
    if (!authHeader || authHeader !== 'admin') {
      // In demo mode, allow all users through
      // In production, redirect to /unauthorized
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
