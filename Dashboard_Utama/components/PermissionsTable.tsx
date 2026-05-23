'use client'

import { Service, RolePermission } from '@/utils/service-repository'
import { togglePermission } from '@/app/actions/admin-permissions'
import { useState, useTransition } from 'react'
import { Shield, Check, X, Loader2 } from 'lucide-react'

interface PermissionsTableProps {
    services: Service[]
    permissions: RolePermission[]
}

const ROLES = ['ADMIN', 'KERANI', 'MNGR', 'ASISTEN', 'MANDOR', 'VISITOR'] // Add other roles as needed

export default function PermissionsTable({ services, permissions }: PermissionsTableProps) {
    const [isPending, startTransition] = useTransition()
    const [optimisticPermissions, setOptimisticPermissions] = useState<RolePermission[]>(permissions)

    const hasPermission = (role: string, serviceId: string) => {
        return optimisticPermissions.some(p => p.role === role && p.serviceId === serviceId)
    }

    const handleToggle = (role: string, serviceId: string) => {
        const currentlyHasAccess = hasPermission(role, serviceId)

        // Optimistic update
        if (currentlyHasAccess) {
            setOptimisticPermissions(prev => prev.filter(p => !(p.role === role && p.serviceId === serviceId)))
        } else {
            setOptimisticPermissions(prev => [...prev, { id: -1, role, serviceId }])
        }

        startTransition(async () => {
            const result = await togglePermission(role, serviceId, currentlyHasAccess)
            if (!result.success) {
                // Revert on failure (simple reload would be better but this is MVP)
                alert('Gagal update permission')
            }
        })
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Shield className="w-5 h-5 text-palm-green" />
                        Kontrol Akses Layanan
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">Atur hak akses layanan untuk setiap role</p>
                </div>
                {isPending && <Loader2 className="w-5 h-5 animate-spin text-palm-green" />}
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50 text-gray-600 text-sm uppercas tracking-wider">
                            <th className="px-6 py-4 font-semibold border-b border-gray-200">Layanan</th>
                            {ROLES.map(role => (
                                <th key={role} className="px-6 py-4 font-semibold border-b border-gray-200 text-center w-32">
                                    {role}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {services.map((service) => (
                            <tr key={service.serviceId} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        {service.imagePath ? (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 overflow-hidden relative">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={service.imagePath} alt="" className="w-full h-full object-cover" />
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold text-xs shadow-inner">
                                                {service.name.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <div className="font-medium text-gray-900">{service.name}</div>
                                            <div className="text-xs text-gray-500">{service.description}</div>
                                        </div>
                                    </div>
                                </td>
                                {ROLES.map(role => {
                                    const access = hasPermission(role, service.serviceId)
                                    return (
                                        <td key={`${role}-${service.serviceId}`} className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => handleToggle(role, service.serviceId)}
                                                disabled={isPending}
                                                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200 ${access
                                                    ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200 shadow-sm'
                                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
                                                    }`}
                                            >
                                                {access ? <Check className="w-5 h-5" /> : <X className="w-4 h-4" />}
                                            </button>
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="p-4 bg-gray-50 text-xs text-gray-500 text-center border-t border-gray-100">
                Klik tombol centang/silang untuk mengubah akses. Perubahan tersimpan otomatis.
            </div>
        </div>
    )
}
