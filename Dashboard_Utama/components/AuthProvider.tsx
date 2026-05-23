'use client'

import { useEffect, createContext, useContext, useState, ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface User {
    id: number
    name: string
    email: string
    role: string
}

interface AuthContextType {
    user: User | null
    token: string | null
    isLoading: boolean
    logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    isLoading: true,
    logout: async () => { }
})

export function useAuth() {
    return useContext(AuthContext)
}

// Helper function to get cookie value
function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null
    return null
}

// Helper function to set cookie
function setCookie(name: string, value: string, maxAgeSecs: number = 60 * 60 * 8) {
    if (typeof document === 'undefined') return
    document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSecs}; SameSite=Lax`
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const pathname = usePathname()
    const router = useRouter()

    // Sync auth state on mount and pathname change
    useEffect(() => {
        const syncAuth = async () => {
            // Get token from best available source
            const lsToken = localStorage.getItem('auth-token')
            const cookieToken = getCookie('auth-token')
            const tokenToVerify = cookieToken || lsToken

            console.log('🔄 AuthProvider sync:', {
                pathname,
                hasLocalStorageToken: !!lsToken,
                hasCookieToken: !!cookieToken,
                tokenToVerifyLength: tokenToVerify?.length || 0
            })

            // If no token anywhere, stop loading
            if (!tokenToVerify) {
                setToken(null)
                setUser(null)
                setIsLoading(false)
                return
            }

            // Verify token with server to check validity and restore cookie if needed
            try {
                // Determine if we need to verify/restore
                // 1. If we are on login page and have a token -> Verify & Redirect
                // 2. If we have LS token but no cookie -> Verify & Restore Cookie
                // 3. Just periodic check

                const response = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ token: tokenToVerify })
                })

                const data = await response.json()

                if (data.valid) {
                    console.log('✅ Token verified valid by server')
                    setToken(tokenToVerify)
                    setUser(data.user)

                    // Ensure LS is in sync
                    if (!lsToken) {
                        localStorage.setItem('auth-token', tokenToVerify!)
                        localStorage.setItem('user', JSON.stringify(data.user))
                    }

                    // If on login page and valid, redirect to dashboard
                    if (pathname === '/login') {
                        console.log('🚀 Auto-redirecting from login to dashboard')
                        router.push('/dashboard-user')
                    }
                } else {
                    console.log('❌ Token invalid, clearing session')
                    // Token invalid - clear everything
                    localStorage.removeItem('auth-token')
                    localStorage.removeItem('user')
                    document.cookie = 'auth-token=; path=/; max-age=0'
                    setToken(null)
                    setUser(null)
                }
            } catch (error) {
                console.error('Auth verification error:', error)
                // Don't clear immediately on network error, but stop loading
            } finally {
                setIsLoading(false)
            }
        }

        syncAuth()
    }, [pathname, router])

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            })
        } catch (error) {
            console.error('Logout error:', error)
        }

        // Clear localStorage
        localStorage.removeItem('auth-token')
        localStorage.removeItem('user')

        // Clear cookie
        document.cookie = 'auth-token=; path=/; max-age=0'
        document.cookie = 'payroll_auth_token=; path=/; max-age=0'

        setUser(null)
        setToken(null)

        router.push('/login')
    }

    return (
        <AuthContext.Provider value={{ user, token, isLoading, logout }}>
            {children}
        </AuthContext.Provider>
    )
}
