import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Leaf, ShieldCheck, Clock } from 'lucide-react'
import LoginForm from '@/components/LoginForm'

export default function LoginPage() {
    return (
        <main className="relative flex min-h-screen overflow-hidden bg-[#071009]">
            {/* ── Cinematic backdrop ─────────────────────────────────── */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="https://images.unsplash.com/photo-1535392432937-a27c36ec07b5?q=80&w=2400&auto=format&fit=crop"
                    alt="Perkebunan kelapa sawit"
                    fill
                    sizes="100vw"
                    className="object-cover opacity-60 animate-[kenburns_28s_var(--ease-in-out)_infinite_alternate]"
                    priority
                />
                {/* Depth gradients */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#071009] via-[#071009]/70 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071009] via-transparent to-[#071009]/40" />
            </div>

            {/* ── Floating light orbs ────────────────────────────────── */}
            <div className="pointer-events-none absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full bg-[var(--color-accent)]/20 blur-[140px] animate-[drift_18s_var(--ease-in-out)_infinite_alternate]" />
            <div className="pointer-events-none absolute bottom-[-160px] right-[-120px] w-[420px] h-[420px] rounded-full bg-emerald-400/10 blur-[130px] animate-[drift_22s_var(--ease-in-out)_infinite_alternate-reverse]" />

            {/* ── Back to home ───────────────────────────────────────── */}
            <Link
                href="/"
                className="absolute top-6 left-6 z-30 flex items-center gap-2 text-white/70 hover:text-white transition-colors px-4 py-2 rounded-full border border-white/15 hover:border-white/40 text-sm font-medium animate-[fade-in_0.8s_var(--ease-out)_both]"
            >
                <ArrowLeft className="h-4 w-4" />
                Beranda
            </Link>

            {/* ── Split layout ───────────────────────────────────────── */}
            <div className="relative z-10 flex flex-col lg:flex-row w-full max-w-7xl mx-auto items-center justify-center lg:justify-between gap-12 lg:gap-20 px-6 py-16 lg:py-0">

                {/* Brand story — left */}
                <section className="hidden lg:block max-w-xl animate-[fade-up_0.8s_var(--ease-out)_0.1s_both]">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-white/20">
                            <div className="w-full h-full rounded-xl overflow-hidden">
                                <Image src="/assets/logo.webp" alt="PT Rebinmas Jaya" width={48} height={48} className="object-contain" />
                            </div>
                        </div>
                        <div>
                            <p className="text-white font-semibold tracking-tight">PT Rebinmas Jaya</p>
                            <p className="text-white/50 text-xs">Sawit Berkelanjutan · Belitung</p>
                        </div>
                    </div>

                    <h1 className="text-5xl xl:text-6xl font-bold text-white tracking-tight leading-[1.05] font-display">
                        Satu portal.<br />
                        Seluruh<br />
                        <span className="text-emerald-400">operasi kebun.</span>
                    </h1>
                    <p className="mt-6 text-white/60 text-lg leading-relaxed max-w-md">
                        Absensi, payroll, produksi, sampai monitoring jaringan — semua layanan
                        operasional PT Rebinmas Jaya dalam satu pintu masuk.
                    </p>

                    {/* Trust points */}
                    <ul className="mt-10 space-y-4">
                        {[
                            { icon: ShieldCheck, text: 'Akses berbasis peran & divisi' },
                            { icon: Clock, text: 'Data operasional real-time' },
                            { icon: Leaf, text: 'Terhubung seluruh estate & pabrik' },
                        ].map(({ icon: Icon, text }, i) => (
                            <li
                                key={text}
                                className="flex items-center gap-3 text-white/75 text-sm animate-[slide-right_0.6s_var(--ease-out)_both]"
                                style={{ animationDelay: `${0.4 + i * 0.15}s` }}
                            >
                                <span className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                                    <Icon className="w-4 h-4 text-emerald-400" />
                                </span>
                                {text}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Login card — right */}
                <section className="w-full max-w-md animate-[fade-up_0.7s_var(--ease-out)_0.25s_both]">
                    <div className="bg-white rounded-[var(--radius-xl)] shadow-[0_24px_80px_rgba(0,0,0,0.45)] overflow-hidden border border-white/40">
                        {/* Mobile-only brand header */}
                        <div className="lg:hidden bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-accent-hover)] px-8 pt-8 pb-6 text-center">
                            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-white p-1 shadow-lg">
                                <div className="w-full h-full rounded-full overflow-hidden">
                                    <Image src="/assets/logo.webp" alt="PT Rebinmas Jaya" width={56} height={56} className="object-contain" />
                                </div>
                            </div>
                            <h1 className="text-lg font-bold text-white tracking-tight">Portal Karyawan</h1>
                            <p className="text-xs text-emerald-100 mt-0.5">PT Rebinmas Jaya</p>
                        </div>

                        <div className="p-8 sm:p-10">
                            <div className="mb-7 hidden lg:block">
                                <h2 className="text-xl font-bold text-[var(--color-ink)] tracking-tight font-display">Selamat datang kembali</h2>
                                <p className="text-sm text-[var(--color-ink-muted)] mt-1">Masuk untuk melanjutkan ke dashboard</p>
                            </div>
                            <LoginForm />
                        </div>

                        <div className="px-8 sm:px-10 py-4 bg-[var(--color-paper-soft)] border-t border-[var(--color-border)] text-center">
                            <p className="text-xs text-[var(--color-ink-muted)]">
                                &copy; {new Date().getFullYear()} PT Rebinmas Jaya
                            </p>
                        </div>
                    </div>

                    <p className="text-center mt-5 text-white/40 text-sm">
                        Butuh bantuan? Hubungi IT Support
                    </p>
                </section>
            </div>
        </main>
    )
}