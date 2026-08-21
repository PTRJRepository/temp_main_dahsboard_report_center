'use client'

import { addRole, deleteRole, updateRole } from '@/app/actions/role-actions'
import { useRef, useState } from 'react'
import { Plus, Trash2, Pencil, Check, X, Loader2 } from 'lucide-react'

interface Role {
    name: string
    description?: string
}

export default function AddRoleForm({ roles }: { roles: Role[] }) {
    const formRef = useRef<HTMLFormElement>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [pending, setPending] = useState(false)
    const [editing, setEditing] = useState<string | null>(null)
    const [editName, setEditName] = useState('')

    const show = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text })
        setTimeout(() => setMessage(null), 3000)
    }

    const handleSubmit = async (formData: FormData) => {
        setPending(true)
        const result = await addRole(formData)
        setPending(false)
        if (result.error) show('error', result.error)
        else if (result.message) {
            show('success', result.message)
            formRef.current?.reset()
        }
    }

    const handleDelete = async (name: string) => {
        if (!confirm(`Hapus peran ${name}? Semua hak akses terkait juga akan dihapus.`)) return
        setPending(true)
        const result = await deleteRole(name)
        setPending(false)
        if (result.error) show('error', result.error)
        else if (result.message) show('success', result.message)
    }

    const startEdit = (name: string) => {
        setEditing(name)
        setEditName(name)
    }

    const cancelEdit = () => {
        setEditing(null)
        setEditName('')
    }

    const submitEdit = async (formData: FormData) => {
        if (!editing) return
        setPending(true)
        const result = await updateRole(formData)
        setPending(false)
        if (result.error) show('error', result.error)
        else if (result.message) {
            show('success', result.message)
            cancelEdit()
        }
    }

    return (
        <div className="space-y-4">
            <form
                ref={formRef}
                action={handleSubmit}
                className="space-y-3 bg-gray-50 p-6 rounded-lg border border-gray-200"
            >
                <h3 className="font-semibold text-gray-900">Tambah Peran Baru</h3>

                {message && (
                    <div className={`p-3 rounded-lg text-sm ${message.type === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nama Peran *</label>
                        <input
                            name="name"
                            required
                            placeholder="SUPERVISOR"
                            className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm font-mono uppercase"
                        />
                        <p className="mt-1 text-xs text-gray-500">Huruf besar, tanpa spasi</p>
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700">Deskripsi</label>
                        <input
                            name="description"
                            placeholder="Deskripsi singkat peran"
                            className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                        />
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-palm-green text-white rounded-md text-sm hover:bg-palm-green-hover transition-colors disabled:opacity-50"
                >
                    {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Tambah Peran
                </button>
            </form>

            <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Peran</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deskripsi</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {roles.map(r => (
                            <tr key={r.name}>
                                <td className="px-6 py-3 text-sm font-mono font-semibold text-gray-900">
                                    {editing === r.name ? (
                                        <form action={submitEdit} className="flex items-center gap-2">
                                            <input type="hidden" name="oldName" value={editing} />
                                            <input
                                                name="newName"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value.toUpperCase())}
                                                required
                                                className="rounded-md border border-gray-300 p-1.5 text-sm font-mono uppercase"
                                            />
                                            <button type="submit" disabled={pending} className="text-green-600 hover:text-green-900" title="Simpan">
                                                <Check className="w-4 h-4" />
                                            </button>
                                            <button type="button" onClick={cancelEdit} className="text-gray-500 hover:text-gray-700" title="Batal">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </form>
                                    ) : (
                                        r.name
                                    )}
                                </td>
                                <td className="px-6 py-3 text-sm text-gray-500">{r.description || '-'}</td>
                                <td className="px-6 py-3 text-right space-x-3">
                                    {editing !== r.name && (
                                        <>
                                            <button
                                                onClick={() => startEdit(r.name)}
                                                className="text-indigo-600 hover:text-indigo-900"
                                                title="Ubah nama peran"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(r.name)}
                                                className="text-red-600 hover:text-red-900"
                                                title="Hapus peran"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
