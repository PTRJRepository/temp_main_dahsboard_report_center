'use client'

import { Trash2, Check, X } from 'lucide-react'
import { deleteService } from '@/app/admin/actions'
import { useRouter } from 'next/navigation'

interface Service {
    serviceId: string
    name: string
    description?: string
    serviceUrl: string
    path?: string | null
    enabled: boolean
}

export default function ServiceTable({ services }: { services: Service[] }) {
    const router = useRouter()

    const handleDelete = async (serviceId: string) => {
        if (confirm('Hapus layanan ini?')) {
            await deleteService(serviceId)
            router.refresh()
        }
    }

    return (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Path</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service URL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {services.length === 0 ? (
                        <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                Belum ada layanan. Tambahkan layanan pertama.
                            </td>
                        </tr>
                    ) : (
                        services.map(s => (
                            <tr key={s.serviceId}>
                                <td className="px-6 py-4 text-sm font-mono text-gray-900">{s.serviceId}</td>
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">{s.name}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{s.path || '-'}</td>
                                <td className="px-6 py-4 text-sm text-gray-500 font-mono">{s.serviceUrl}</td>
                                <td className="px-6 py-4">
                                    {s.enabled ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            <Check className="w-3 h-3" /> Aktif
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                                            <X className="w-3 h-3" /> Nonaktif
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button
                                        onClick={() => handleDelete(s.serviceId)}
                                        className="text-red-600 hover:text-red-900"
                                        title="Hapus layanan"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    )
}
