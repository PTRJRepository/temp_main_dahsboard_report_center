'use client'

import { useState } from 'react'
import { Key } from 'lucide-react'
import ChangePasswordModal from './ChangePasswordModal'

interface ChangePasswordButtonProps {
    userId: number
}

export default function ChangePasswordButton({ userId }: ChangePasswordButtonProps) {
    const [showModal, setShowModal] = useState(false)

    return (
        <>
            <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-sm"
                title="Ubah Password"
            >
                <Key className="w-4 h-4" />
                Ubah Password
            </button>

            {showModal && (
                <ChangePasswordModal
                    userId={userId}
                    onClose={() => setShowModal(false)}
                />
            )}
        </>
    )
}
