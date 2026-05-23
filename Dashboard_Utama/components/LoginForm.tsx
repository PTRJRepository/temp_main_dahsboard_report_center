'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound, User, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginForm() {
    const router = useRouter()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError('')

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include', // Important: include cookies in request/response
                body: JSON.stringify({ email: username, password }),
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error || 'Login gagal')
                return
            }

            // Store token in localStorage for API usage
            if (data.token) {
                localStorage.setItem('auth-token', data.token)
                localStorage.setItem('user', JSON.stringify(data.user))
            }

            // Use window.location for full page reload to ensure cookies are processed
            window.location.href = '/dashboard-user'

        } catch (err) {
            setError('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800" htmlFor="username">
                    Username
                </label>
                <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-palm-green" />
                    <input
                        className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 pl-12 pr-4 py-3.5 text-gray-900 text-sm focus:border-palm-green focus:bg-white focus:ring-2 focus:ring-palm-green/20 outline-none transition-all placeholder:text-gray-400"
                        id="username"
                        type="text"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-800" htmlFor="password">
                    Kata Sandi
                </label>
                <div className="relative">
                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-palm-green" />
                    <input
                        className="w-full rounded-xl border-2 border-gray-200 bg-gray-50 pl-12 pr-4 py-3.5 text-gray-900 text-sm focus:border-palm-green focus:bg-white focus:ring-2 focus:ring-palm-green/20 outline-none transition-all placeholder:text-gray-400"
                        id="password"
                        type="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan kata sandi"
                        required
                        minLength={6}
                    />
                </div>
            </div>

            {error && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm font-semibold">
                    ⚠️ {error}
                </div>
            )}

            <div className="pt-3">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-palm-green to-emerald-600 px-6 py-4 text-base font-semibold text-white shadow-lg hover:shadow-xl hover:from-palm-green-hover hover:to-emerald-700 focus:outline-none focus:ring-4 focus:ring-palm-green/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Sedang Masuk...
                        </>
                    ) : (
                        <>
                            Masuk
                            <ArrowRight className="h-5 w-5" />
                        </>
                    )}
                </button>
            </div>
        </form>
    )
}
