'use client'

import { useState } from 'react'
import { X, Eye, EyeOff, Lock, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { changePassword } from '@/app/actions/user-actions'

interface ChangePasswordModalProps {
    userId: number
    onClose: () => void
}

export default function ChangePasswordModal({ userId, onClose }: ChangePasswordModalProps) {
    const [oldPassword, setOldPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showOldPassword, setShowOldPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setSuccess('')

        // Validate inputs
        if (!oldPassword || !newPassword || !confirmPassword) {
            setError('Semua field harus diisi')
            return
        }

        if (newPassword !== confirmPassword) {
            setError('Password baru dan konfirmasi tidak cocok')
            return
        }

        if (newPassword.length < 6) {
            setError('Password baru minimal 6 karakter')
            return
        }

        if (oldPassword === newPassword) {
            setError('Password baru harus berbeda dengan password lama')
            return
        }

        setIsLoading(true)

        try {
            const result = await changePassword(userId, oldPassword, newPassword)

            if (result.success) {
                setSuccess(result.message || 'Password berhasil diubah')
                // Clear form
                setOldPassword('')
                setNewPassword('')
                setConfirmPassword('')
                // Close modal after 2 seconds
                setTimeout(() => {
                    onClose()
                }, 2000)
            } else {
                setError(result.error || 'Gagal mengubah password')
            }
        } catch (err) {
            console.error('Change password error:', err)
            setError('Terjadi kesalahan saat mengubah password')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-palm-green to-emerald-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                            <Lock className="w-5 h-5 text-white" />
                        </div>
                        <h2 className="text-xl font-bold text-white">Ubah Password</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
                            <CheckCircle className="w-5 h-5 flex-shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}

                    {/* Old Password */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Password Lama
                        </label>
                        <div className="relative">
                            <input
                                type={showOldPassword ? 'text' : 'password'}
                                value={oldPassword}
                                onChange={(e) => setOldPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palm-green focus:border-palm-green transition-all"
                                placeholder="Masukkan password lama"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowOldPassword(!showOldPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* New Password */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Password Baru
                        </label>
                        <div className="relative">
                            <input
                                type={showNewPassword ? 'text' : 'password'}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palm-green focus:border-palm-green transition-all"
                                placeholder="Masukkan password baru (min. 6 karakter)"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowNewPassword(!showNewPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700">
                            Konfirmasi Password Baru
                        </label>
                        <div className="relative">
                            <input
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-palm-green focus:border-palm-green transition-all"
                                placeholder="Ulangi password baru"
                                disabled={isLoading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* Password Requirements */}
                    <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
                        <p className="font-medium mb-1">Ketentuan password:</p>
                        <ul className="list-disc list-inside space-y-0.5">
                            <li>Minimal 6 karakter</li>
                            <li>Harus berbeda dengan password lama</li>
                        </ul>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                            disabled={isLoading}
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-3 bg-palm-green text-white rounded-lg hover:bg-palm-green-hover transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Menyimpan...
                                </>
                            ) : (
                                'Simpan Password'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
