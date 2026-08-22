'use client'

import { useState } from 'react'
import { KeyRound, User, ArrowRight, Loader2 } from 'lucide-react'

export default function LoginForm() {
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
            window.location.href = '/report-center'

        } catch (err) {
            setError('Terjadi kesalahan. Silakan coba lagi.')
        } finally {
            setIsLoading(false)
        }
    }

    const fieldCls = 'w-full rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-[var(--color-paper-soft)] pl-11 pr-4 py-3 text-[var(--color-ink)] text-sm outline-none transition-all duration-200 placeholder:text-[var(--color-ink-muted)] focus:bg-white focus:border-[var(--color-accent)] focus:ring-4 focus:ring-[var(--color-accent-glow)]'

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[var(--color-ink-soft)]" htmlFor="username">
                    Username
                </label>
                <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
                    <input
                        className={fieldCls}
                        id="username"
                        type="text"
                        name="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Masukkan username"
                        autoComplete="username"
                        required
                    />
                </div>
            </div>

            <div className="space-y-1.5">
                <label className="block text-sm font-semibold text-[var(--color-ink-soft)]" htmlFor="password">
                    Kata Sandi
                </label>
                <div className="relative group">
                    <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-muted)] group-focus-within:text-[var(--color-accent)] transition-colors" />
                    <input
                        className={fieldCls}
                        id="password"
                        type="password"
                        name="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Masukkan access key"
                        autoComplete="current-password"
                        required
                        minLength={6}
                    />
                </div>
                <p className="text-xs text-[var(--color-ink-muted)] pl-1">Access key: keys/report-center-access.key</p>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-[var(--radius-md)] text-sm font-medium animate-[fade-up_0.25s_var(--ease-out)_both]" role="alert">
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-ink)] px-6 py-3.5 text-sm font-semibold text-white shadow-[var(--shadow-md)] hover:bg-[var(--color-accent-hover)] hover:shadow-[var(--shadow-lg)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--color-accent-ring)] disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.99] overflow-hidden"
            >
                {/* Shine sweep on hover */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                {isLoading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sedang masuk…
                    </>
                ) : (
                    <>
                        Masuk ke Portal
                        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </>
                )}
            </button>
        </form>
    )
}