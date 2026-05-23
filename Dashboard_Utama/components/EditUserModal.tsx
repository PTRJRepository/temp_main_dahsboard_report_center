'use client'

import { updateUser, fetchUserServices, resetUserPassword } from '@/app/admin/actions'
import { fetchGangs, type GangItem } from '@/app/actions/gang-actions'
import { useEffect, useState } from 'react'
import { X, Loader2, Save, Key } from 'lucide-react'

interface Service {
    serviceId: string
    name: string
    path?: string
}

interface User {
    id: number
    name: string
    email: string
    role: string
    divisi?: string
    gang?: string
}

interface EditUserModalProps {
    user: User
    services: Service[]
    onClose: () => void
}

export default function EditUserModal({ user, services, onClose }: EditUserModalProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    // Form state
    const [role, setRole] = useState(user.role)
    const [divisi, setDivisi] = useState(user.divisi || '')
    const [gang, setGang] = useState(user.gang || '')
    const [gangs, setGangs] = useState<GangItem[]>([])
    const [isLoadingGangs, setIsLoadingGangs] = useState(false)
    const [selectedServices, setSelectedServices] = useState<string[]>([])
    const [isLoadingServices, setIsLoadingServices] = useState(true)

    // Password reset state
    const [showPasswordReset, setShowPasswordReset] = useState(false)
    const [newPassword, setNewPassword] = useState('')

    const divisOptions = [
        { value: '', label: 'Pilih Divisi', disabled: true },
        { value: 'AL', label: 'AL (Full Access)', disabled: false },
        { value: 'PG1A', label: 'Parit Gunung 1A', disabled: false },
        { value: 'PG1B', label: 'Parit Gunung 1B', disabled: false },
        { value: 'PG2A', label: 'Parit Gunung 2A', disabled: false },
        { value: 'PG2B', label: 'Parit Gunung 2B', disabled: false },
        { value: 'DME', label: 'Darul Makmur Estate', disabled: false },
        { value: 'ARA', label: 'Ara Estate', disabled: false },
        { value: 'ARB1', label: 'Arbei Estate 1', disabled: false },
        { value: 'ARB2', label: 'Arbei Estate 2', disabled: false },
        { value: 'INFRA', label: 'Infrastruktur', disabled: false },
        { value: 'AREC', label: 'Area Civil', disabled: false },
        { value: 'IJL', label: 'IJL Division', disabled: false },
        { value: 'STF-OFFICE', label: 'Office Staff', disabled: false },
        { value: 'SECURITY', label: 'Security', disabled: false },
        { value: 'MILL', label: 'Mill/PKS', disabled: false },
        { value: 'INF', label: 'Virtual: Infrastruktur', disabled: false },
        { value: 'NRS', label: 'Virtual: Nursery', disabled: false },
        { value: 'WKS_PG', label: 'Virtual: Workshop PG', disabled: false },
        { value: 'WKS_AR', label: 'Virtual: Workshop AR', disabled: false }
    ]

    useEffect(() => {
        // Fetch User Services
        const loadServices = async () => {
            setIsLoadingServices(true)
            try {
                const userServices = await fetchUserServices(user.id)
                setSelectedServices(userServices)
            } catch (err) {
                console.error('Failed to load user services')
            } finally {
                setIsLoadingServices(false)
            }
        }
        loadServices()
    }, [user.id])

    // Fetch gangs when divisi changes
    useEffect(() => {
        if (role === 'KERANI' && divisi) {
            setIsLoadingGangs(true)
            // Only reset gang if divisi actually changed from original
            if (divisi !== user.divisi) {
                setGang('')
            }
            fetchGangs(divisi)
                .then(setGangs)
                .catch(() => setGangs([]))
                .finally(() => setIsLoadingGangs(false))
        } else {
            setGangs([])
            setGang('')
        }
    }, [divisi, role, user.divisi])

    const handleServiceToggle = (serviceId: string) => {
        setSelectedServices(prev =>
            prev.includes(serviceId)
                ? prev.filter(id => id !== serviceId)
                : [...prev, serviceId]
        )
    }

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true)
        setError(null)
        setSuccessMessage(null)

        // Add updateServices flag and services list manually? 
        // No, we append to formData or use hidden inputs.
        // It's easier to append to formData if we control the submission.

        // However, we are using form action. 
        // Let's create a new FormData or modify the existing one in the action handler?
        // We can inject hidden inputs for services.
    }

    // Instead of pure form action, let's use client-side handler calling the server action
    const onSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)

        const formData = new FormData(e.currentTarget)

        // Add services
        selectedServices.forEach(id => {
            formData.append('services', id)
        })
        formData.append('updateServices', 'true')

        try {
            const result = await updateUser(String(user.id), formData)
            if (result.error) {
                setError(result.error)
            } else {
                onClose()
            }
        } catch (err) {
            setError('Gagal mengupdate user')
        } finally {
            setIsLoading(false)
        }
    }

    const onResetPass = async () => {
        if (newPassword.length < 6) {
            setError('Password minimal 6 karakter')
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const result = await resetUserPassword(String(user.id), newPassword)
            if (result.error) {
                setError(result.error)
            } else {
                setSuccessMessage('Password berhasil direset')
                setNewPassword('')
                setShowPasswordReset(false)
            }
        } catch (err) {
            setError('Gagal reset password')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-10">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl mx-4 my-auto">
                {/* Header */}
                <div className="bg-gradient-to-r from-palm-green to-emerald-600 px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-white">Edit Pengguna: {user.name}</h3>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4 font-semibold">
                            ⚠️ {error}
                        </div>
                    )}
                    {successMessage && (
                        <div className="bg-green-50 border-2 border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4 font-semibold">
                            ✓ {successMessage}
                        </div>
                    )}

                    <div className="flex gap-6 flex-col md:flex-row">
                        {/* Main User Details */}
                        <form onSubmit={onSave} className="flex-1 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">Nama Lengkap</label>
                                <input name="name" defaultValue={user.name} type="text" required
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">Username</label>
                                <input name="email" defaultValue={user.email} type="text" required
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">Peran</label>
                                <select name="role" value={role} onChange={(e) => setRole(e.target.value)} required
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all">
                                    <option value="KERANI" className="text-gray-900">Kerani</option>
                                    <option value="AKUNTING" className="text-gray-900">Akunting</option>
                                    <option value="HRD" className="text-gray-900">HRD</option>
                                    <option value="PAJAK" className="text-gray-900">Pajak</option>
                                    <option value="VISITOR" className="text-gray-900">Visitor</option>
                                    <option value="ADMIN" className="text-gray-900">Admin</option>
                                </select>
                            </div>

                            {role === 'KERANI' && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-1">Divisi</label>
                                    <select name="divisi" value={divisi} onChange={(e) => setDivisi(e.target.value)} required
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all">
                                        {divisOptions.map((option) => (
                                            <option key={option.value} value={option.value} disabled={option.disabled} className={option.disabled ? "text-gray-400" : "text-gray-900"}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {role === 'KERANI' && divisi && (
                                <div>
                                    <label className="block text-sm font-semibold text-gray-800 mb-1">Gang/Kemandoran</label>
                                    {isLoadingGangs ? (
                                        <div className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-500 bg-gray-50 flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Memuat gang...
                                        </div>
                                    ) : (
                                        <select name="gang" value={gang} onChange={(e) => setGang(e.target.value)}
                                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all">
                                            <option value="" className="text-gray-400">Pilih Gang (opsional)</option>
                                            {gangs.map((g) => (
                                                <option key={g.code} value={g.code} className="text-gray-900">
                                                    {g.code} - {g.description}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Kosongkan jika user dapat akses semua gang di divisi ini</p>
                                </div>
                            )}
                            <div className="mt-6">
                                <h4 className="text-sm font-semibold text-gray-800 mb-3 block">Hak Akses Layanan</h4>
                                {isLoadingServices ? (
                                    <div className="text-center py-4 text-gray-500 text-sm bg-gray-50 rounded-lg">Memuat layanan...</div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                                        {services.map(service => (
                                            <label key={service.serviceId} className="flex items-start gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedServices.includes(service.serviceId)}
                                                    onChange={() => handleServiceToggle(service.serviceId)}
                                                    className="mt-1 rounded border-gray-300 text-palm-green focus:ring-palm-green focus:ring-offset-0 w-4 h-4"
                                                />
                                                <div className="text-xs">
                                                    <div className="font-semibold text-gray-700">{service.name}</div>
                                                    <div className="text-gray-500">{service.path}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button type="submit" disabled={isLoading}
                                className="w-full mt-6 px-4 py-2.5 bg-palm-green text-white rounded-lg hover:bg-palm-green-hover transition-all text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Simpan Perubahan</>}
                            </button>
                        </form>

                        {/* Password Reset Section */}
                        <div className="w-full md:w-72 md:border-l md:pl-6 border-gray-200 pt-6 md:pt-0">
                            <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <Key className="h-4 w-4 text-earth-brown" /> Reset Password
                            </h4>

                            {!showPasswordReset ? (
                                <button onClick={() => setShowPasswordReset(true)}
                                    className="w-full px-4 py-2.5 border-2 border-earth-brown text-earth-brown rounded-lg hover:bg-earth-brown hover:text-white text-sm font-semibold transition-all active:scale-95">
                                    Ganti Password
                                </button>
                            ) : (
                                <div className="space-y-3 bg-amber-50 border-2 border-amber-200 p-4 rounded-lg">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-800 mb-1">Password Baru</label>
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                            className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent"
                                            placeholder="Min. 6 karakter"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={onResetPass} disabled={isLoading}
                                            className="flex-1 px-3 py-2 bg-palm-green text-white rounded text-xs font-semibold hover:bg-palm-green-hover transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">
                                            Simpan
                                        </button>
                                        <button onClick={() => setShowPasswordReset(false)}
                                            className="flex-1 px-3 py-2 bg-white border-2 border-gray-300 text-gray-600 rounded text-xs font-semibold hover:bg-gray-50 transition-all active:scale-95">
                                            Batal
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
