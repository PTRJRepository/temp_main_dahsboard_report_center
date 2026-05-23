import LoginForm from '@/components/LoginForm'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default function LoginPage() {
    return (
        <main className="flex min-h-screen items-center justify-center relative overflow-hidden bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
            {/* Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-20">
                <Image
                    src="/assets/kebun sawit.webp"
                    alt="Perkebunan Kelapa Sawit"
                    fill
                    className="object-cover"
                    priority
                />
            </div>

            {/* Decorative Shapes */}
            <div className="absolute top-0 left-0 w-96 h-96 bg-palm-green/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-golden-yellow/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />

            {/* Back to Home */}
            <Link
                href="/"
                className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-300 hover:text-white transition-colors bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 hover:bg-white/20"
            >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm font-medium">Beranda</span>
            </Link>

            <div className="relative z-10 w-full max-w-md p-6">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header with Logo */}
                    <div className="bg-gradient-to-br from-palm-green via-emerald-600 to-emerald-700 px-8 py-10 text-center">
                        {/* Logo Container - Fixed circular */}
                        <div className="w-24 h-24 mx-auto mb-5 rounded-full bg-white p-1.5 shadow-xl ring-4 ring-white/30">
                            <div className="w-full h-full rounded-full bg-white overflow-hidden flex items-center justify-center">
                                <Image
                                    src="/assets/logo.webp"
                                    alt="PT Rebinmas Jaya"
                                    width={80}
                                    height={80}
                                    className="object-contain"
                                />
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight">Portal Karyawan</h1>
                        <p className="text-sm text-emerald-100 mt-2">PT Rebinmas Jaya</p>
                    </div>

                    {/* Form Section */}
                    <div className="p-8">
                        <div className="text-center mb-6">
                            <h2 className="text-lg font-semibold text-gray-900">Selamat Datang</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Masuk untuk mengakses dashboard
                            </p>
                        </div>
                        <LoginForm />
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
                        <p className="text-xs text-gray-500">
                            &copy; {new Date().getFullYear()} PT Rebinmas Jaya. Hak Cipta Dilindungi.
                        </p>
                    </div>
                </div>

                {/* Additional decorative elements */}
                <div className="text-center mt-6">
                    <p className="text-gray-400 text-sm">
                        Butuh bantuan? Hubungi IT Support
                    </p>
                </div>
            </div>
        </main>
    )
}
