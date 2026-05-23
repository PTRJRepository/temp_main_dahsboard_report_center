'use client'

import { useState } from 'react'
import { Edit2, Trash2, Key, Eye, EyeOff } from 'lucide-react'

// User interface for SQL Server
interface User {
    id: number
    name: string
    email: string
    role: string
    divisi?: string
    plainPassword?: string
}

interface AdminTableProps {
    users: User[]
    onDelete: (id: number) => void
    onEdit: (id: number) => void
    onResetPassword: (id: number) => void
}

export default function AdminTable({ users, onDelete, onEdit, onResetPassword }: AdminTableProps) {
    const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set())

    const togglePasswordVisibility = (userId: number) => {
        setVisiblePasswords(prev => {
            const newSet = new Set(prev)
            if (newSet.has(userId)) {
                newSet.delete(userId)
            } else {
                newSet.add(userId)
            }
            return newSet
        })
    }

    return (
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Nama
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Username
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Password
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Peran
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Divisi
                        </th>
                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Aksi
                        </th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => (
                        <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="h-10 w-10 flex-shrink-0">
                                        <div className="h-10 w-10 rounded-full bg-palm-green/20 flex items-center justify-center text-palm-green font-bold">
                                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-500">{user.email}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-gray-900 font-mono">
                                        {user.plainPassword
                                            ? (visiblePasswords.has(user.id)
                                                ? user.plainPassword
                                                : '••••••••')
                                            : <span className="text-gray-400 italic">Tidak tersedia</span>
                                        }
                                    </span>
                                    {user.plainPassword && (
                                        <button
                                            onClick={() => togglePasswordVisibility(user.id)}
                                            className="text-gray-400 hover:text-gray-600 transition-colors"
                                            title={visiblePasswords.has(user.id) ? "Sembunyikan Password" : "Lihat Password"}
                                        >
                                            {visiblePasswords.has(user.id)
                                                ? <EyeOff className="h-4 w-4" />
                                                : <Eye className="h-4 w-4" />
                                            }
                                        </button>
                                    )}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' :
                                        ['ACCOUNTING', 'AKUNTING', 'HRD', 'PAJAK'].includes(user.role) ? 'bg-blue-100 text-blue-800' :
                                            user.role === 'VISITOR' ? 'bg-gray-100 text-gray-800' :
                                                'bg-green-100 text-green-800'}`}>
                                    {user.role}
                                </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                    {user.divisi || '-'}
                                </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <button
                                    onClick={() => onResetPassword(user.id)}
                                    className="text-yellow-600 hover:text-yellow-900 mr-3"
                                    title="Reset Password"
                                >
                                    <Key className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => onEdit(user.id)}
                                    className="text-indigo-600 hover:text-indigo-900 mr-3"
                                    title="Edit User"
                                >
                                    <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => onDelete(user.id)}
                                    className="text-red-600 hover:text-red-900"
                                    title="Delete User"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
