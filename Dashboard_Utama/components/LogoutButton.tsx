'use client'

import { LogOut } from 'lucide-react'
import { useState } from 'react'

interface LogoutButtonProps {
    variant?: 'sidebar' | 'header'
}

export default function LogoutButton({ variant = 'sidebar' }: LogoutButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleLogout = async () => {
        setIsLoading(true)
        try {
            const response = await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            })

            if (response.ok) {
                // Clear localStorage
                localStorage.removeItem('auth-token')
                localStorage.removeItem('user')

                // Clear cookies via document.cookie
                document.cookie = 'auth-token=; path=/; max-age=0'
                document.cookie = 'payroll_auth_token=; path=/; max-age=0'

                // Force full page reload to clear all state
                window.location.href = '/login'
            }
        } catch (error) {
            console.error('Logout error:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const buttonClass = variant === 'header'
        ? "flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm disabled:opacity-50"
        : "flex w-full items-center px-4 py-2 mt-2 text-sm text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"

    return (
        <button
            onClick={handleLogout}
            disabled={isLoading}
            className={buttonClass}
        >
            <LogOut className="w-4 h-4 mr-2" />
            {isLoading ? 'Keluar...' : 'Keluar'}
        </button>
    )
}
