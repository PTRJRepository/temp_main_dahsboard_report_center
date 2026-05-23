'use client'

import { createUser } from '@/app/admin/actions'
import { fetchGangs, type GangItem } from '@/app/actions/gang-actions'
import { useRef, useState, useEffect } from 'react'
import { X, UserPlus, Loader2 } from 'lucide-react'

interface Service {
    serviceId: string
    name: string
    path?: string
}

interface AddUserFormProps {
    onClose: () => void
    services: Service[]
}

export default function AddUserForm({ onClose, services }: AddUserFormProps) {
    const formRef = useRef<HTMLFormElement>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedRole, setSelectedRole] = useState('KERANI')

    // Services selection state
    const [selectedServices, setSelectedServices] = useState<string[]>([])

    // Divisi and Gang state
    const [selectedDivisi, setSelectedDivisi] = useState('')
    const [selectedGang, setSelectedGang] = useState('')
    const [gangs, setGangs] = useState<GangItem[]>([])
    const [isLoadingGangs, setIsLoadingGangs] = useState(false)

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

    // Fetch gangs when divisi changes
    useEffect(() => {
        if (selectedRole === 'KERANI' && selectedDivisi) {
            setIsLoadingGangs(true)
            setSelectedGang('')
            fetchGangs(selectedDivisi)
                .then(setGangs)
                .catch(() => setGangs([]))
                .finally(() => setIsLoadingGangs(false))
        } else {
            setGangs([])
            setSelectedGang('')
        }
    }, [selectedDivisi, selectedRole])

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

        // Validate password confirmation
        const password = formData.get('password') as string
        const confirmPassword = formData.get('confirmPassword') as string

        if (password !== confirmPassword) {
            setError('Password dan konfirmasi password tidak cocok')
            setIsLoading(false)
            return
        }

        if (password.length < 6) {
            setError('Password minimal 6 karakter')
            setIsLoading(false)
            return
        }

        // Append selected services to formData
        selectedServices.forEach(id => {
            formData.append('services', id)
        })

        try {
            const result = await createUser(formData)
            if (result.error) {
                setError(result.error)
            } else {
                formRef.current?.reset()
                onClose()
            }
        } catch (e) {
            setError('Gagal membuat pengguna')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 my-8 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-gradient-to-r from-palm-green to-emerald-600 px-6 py-4 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <UserPlus className="h-6 w-6 text-white" />
                        <h3 className="text-lg font-semibold text-white">Tambah Pengguna Baru</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form - Scrollable Area */}
                <div className="overflow-y-auto p-6">
                    <form
                        ref={formRef}
                        action={handleSubmit}
                        className="space-y-4"
                    >
                        {error && (
                            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-semibold">
                                ⚠️ {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-1">
                                Nama Lengkap
                            </label>
                            <input
                                name="name"
                                type="text"
                                required
                                placeholder="Masukkan nama lengkap"
                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all placeholder:text-gray-500"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-1">
                                Username
                            </label>
                            <input
                                name="email"
                                type="text"
                                required
                                placeholder="Masukkan username"
                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all placeholder:text-gray-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">
                                    Password
                                </label>
                                <input
                                    name="password"
                                    type="password"
                                    required
                                    minLength={6}
                                    placeholder="Min. 6 karakter"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all placeholder:text-gray-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">
                                    Konfirmasi
                                </label>
                                <input
                                    name="confirmPassword"
                                    type="password"
                                    required
                                    minLength={6}
                                    placeholder="Ulangi password"
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all placeholder:text-gray-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-1">
                                Peran
                            </label>
                            <select
                                name="role"
                                required
                                value={selectedRole}
                                onChange={(e) => setSelectedRole(e.target.value)}
                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all"
                            >
                                <option value="KERANI" className="text-gray-900">Kerani</option>
                                <option value="AKUNTING" className="text-gray-900">Akunting</option>
                                <option value="HRD" className="text-gray-900">HRD</option>
                                <option value="PAJAK" className="text-gray-900">Pajak</option>
                                <option value="VISITOR" className="text-gray-900">Visitor</option>
                                <option value="ADMIN" className="text-gray-900">Admin</option>
                            </select>
                        </div>

                        {selectedRole === 'KERANI' && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">
                                    Divisi
                                </label>
                                <select
                                    name="divisi"
                                    required={selectedRole === 'KERANI'}
                                    value={selectedDivisi}
                                    onChange={(e) => setSelectedDivisi(e.target.value)}
                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all"
                                >
                                    {divisOptions.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                            disabled={option.disabled}
                                            className={option.disabled ? "text-gray-400" : "text-gray-900"}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {selectedRole === 'KERANI' && selectedDivisi && (
                            <div>
                                <label className="block text-sm font-semibold text-gray-800 mb-1">
                                    Gang/Kemandoran
                                </label>
                                {isLoadingGangs ? (
                                    <div className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-500 bg-gray-50 flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Memuat gang...
                                    </div>
                                ) : (
                                    <select
                                        name="gang"
                                        value={selectedGang}
                                        onChange={(e) => setSelectedGang(e.target.value)}
                                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-900 bg-gray-50 focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all"
                                    >
                                        <option value="" className="text-gray-400">Pilih Gang (opsional)</option>
                                        {gangs.map((gang) => (
                                            <option key={gang.code} value={gang.code} className="text-gray-900">
                                                {gang.code} - {gang.description}
                                            </option>
                                        ))}
                                    </select>
                                )}
                                <p className="text-xs text-gray-500 mt-1">Kosongkan jika user dapat akses semua gang di divisi ini</p>
                            </div>
                        )}

                        {/* Service Selection */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-800 mb-2">
                                Hak Akses Layanan
                            </label>
                            <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1 bg-gray-50">
                                {services.length === 0 ? (
                                    <p className="text-xs text-gray-500 text-center py-2">Tidak ada layanan tersedia</p>
                                ) : services.map(service => (
                                    <label key={service.serviceId} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={selectedServices.includes(service.serviceId)}
                                            onChange={() => handleServiceToggle(service.serviceId)}
                                            className="rounded border-gray-300 text-palm-green focus:ring-palm-green focus:ring-offset-0 w-4 h-4"
                                        />
                                        <span className="text-sm text-gray-700 font-medium">{service.name}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all text-sm font-semibold hover:border-gray-400 active:scale-95"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isLoading}
                                className="flex-1 px-4 py-2.5 bg-palm-green text-white rounded-lg hover:bg-palm-green-hover transition-all text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Menyimpan...
                                    </>
                                ) : (
                                    'Simpan Pengguna'
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
