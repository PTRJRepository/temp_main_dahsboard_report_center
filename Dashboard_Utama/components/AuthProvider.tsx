'use client'

import { useEffect, createContext, useContext, useState, useRef, ReactNode } from 'react'
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

function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null
    return null
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [token, setToken] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const pathname = usePathname()
    const router = useRouter()
    const verifiedThisSession = useRef(false)

    useEffect(() => {
        if (verifiedThisSession.current) {
            setIsLoading(false)
            return
        }

        const lsToken = localStorage.getItem('auth-token')
        const cookieToken = getCookie('auth-token')
        const tokenToVerify = lsToken || cookieToken

        if (!tokenToVerify) {
            setToken(null)
            setUser(null)
            setIsLoading(false)
            return
        }

        console.log('🔄 AuthProvider mount sync:', {
            pathname,
            hasLocalStorageToken: !!lsToken,
            hasCookieToken: !!cookieToken
        })

        fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: tokenToVerify })
        })
            .then(res => res.json())
            .then(data => {
                if (data.valid) {
                    console.log('✅ Token verified')
                    verifiedThisSession.current = true
                    setToken(tokenToVerify)
                    setUser(data.user)
                    if (!lsToken) {
                        localStorage.setItem('auth-token', tokenToVerify!)
                        localStorage.setItem('user', JSON.stringify(data.user))
                    }
                    if (pathname === '/login') {
                        router.push('/dashboard-user')
                    }
                } else {
                    console.log('❌ Token invalid, clearing session')
                    localStorage.removeItem('auth-token')
                    localStorage.removeItem('user')
                    document.cookie = 'auth-token=; path=/; max-age=0'
                    setToken(null)
                    setUser(null)
                }
            })
            .catch(err => console.error('Auth verify error:', err))
            .finally(() => setIsLoading(false))
    }, [])

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            })
        } catch (error) {
            console.error('Logout error:', error)
        }
        localStorage.removeItem('auth-token')
        localStorage.removeItem('user')
        document.cookie = 'auth-token=; path=/; max-age=0'
        document.cookie = 'payroll_auth_token=; path=/; max-age=0'
        verifiedThisSession.current = false
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