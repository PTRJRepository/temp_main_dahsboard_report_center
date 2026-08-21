'use client'

import { addService } from '@/app/(login)/admin/actions'
import { useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'

export default function AddServiceForm() {
    const formRef = useRef<HTMLFormElement>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [pending, setPending] = useState(false)
    const [enabled, setEnabled] = useState(true)

    const handleSubmit = async (formData: FormData) => {
        setPending(true)
        const result = await addService(formData)
        setPending(false)

        if (result.error) {
            setMessage({ type: 'error', text: result.error })
        } else if (result.message) {
            setMessage({ type: 'success', text: result.message })
            formRef.current?.reset()
            setEnabled(true)
        }

        setTimeout(() => setMessage(null), 3000)
    }

    return (
        <form
            ref={formRef}
            action={handleSubmit}
            className="space-y-4 bg-gray-50 p-6 rounded-lg border border-gray-200"
        >
            <h3 className="font-semibold text-gray-900">Tambah Layanan Baru</h3>

            {message && (
                <div className={`p-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Service ID *</label>
                    <input
                        name="serviceId"
                        required
                        placeholder="payroll-frontend"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">ID unik untuk service (huruf kecil, tanpa spasi)</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Nama Layanan *</label>
                    <input
                        name="name"
                        required
                        placeholder="Dashboard Utama"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                    <input
                        name="description"
                        placeholder="Deskripsi singkat layanan"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Service URL *</label>
                    <input
                        name="serviceUrl"
                        required
                        placeholder="http://localhost:5175"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">URL target service</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Path</label>
                    <input
                        name="path"
                        placeholder="/upah"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">Path untuk proxy (opsional)</p>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Image URL</label>
                    <input
                        name="imagePath"
                        placeholder="https://example.com/icon.png"
                        className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">URL gambar/layanan (opsional)</p>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                    <input
                        type="checkbox"
                        name="enabled"
                        checked={enabled}
                        onChange={e => setEnabled(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-palm-green"></div>
                </label>
                <span className="text-sm text-gray-700">Aktif</span>
            </div>

            <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-palm-green text-white rounded-md text-sm hover:bg-palm-green-hover transition-colors disabled:opacity-50"
            >
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Tambah Layanan
            </button>
        </form>
    )
}
