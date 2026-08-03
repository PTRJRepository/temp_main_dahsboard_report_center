/* Hallmark · component: navbar · genre: editorial · theme: Palm (brand green, dark→light morph)
 * states: default · hover · focus-visible · active · open(dropdown) · scrolled · reduced-motion
 * contrast: pass (green-on-white ≥ 4.5; white-on-20% ≥ 3) */
'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ArrowRight, Globe } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { language, setLanguage, t } = useLanguage()
    const navRef = useRef<HTMLElement>(null)

    const navLinks = [
        { name: t.nav.about, href: '#about' },
        { name: t.nav.operations, href: '#operations' },
        { name: t.nav.sustainability, href: '#sustainability' },
        { name: t.nav.news, href: '#news' },
        { name: t.nav.contact, href: '#contact' },
    ]

    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 48)
        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    // Close dropdown / mobile menu on outside click
    useEffect(() => {
        const onDocClick = (e: MouseEvent) => {
            if (navRef.current && !navRef.current.contains(e.target as Node)) {
                setIsMobileMenuOpen(false)
            }
        }
        document.addEventListener('mousedown', onDocClick)
        return () => document.removeEventListener('mousedown', onDocClick)
    }, [])

    const chrome = isScrolled
        ? 'bg-white/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] border-b border-black/5 py-2.5'
        : 'bg-transparent py-5'
    const baseHover = isScrolled
        ? 'text-slate-600 hover:text-palm-green'
        : 'text-white/85 hover:text-white'

    return (
        <nav ref={navRef} className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${chrome}`}>
            {/* subtle top hairline, gives edge even over hero */}
            <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-70" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    {/* Brand */}
                    <Link href="/" className="group flex items-center gap-3" aria-label="PT Rebinmas Jaya — home">
                        <span className="relative grid place-items-center h-11 w-11 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-105">
                            <Image src="/assets/logo.webp" alt="" fill sizes="44px" className="object-contain p-1" aria-hidden />
                        </span>
                        <span className="hidden sm:block">
                            <span className={`block font-semibold tracking-tight leading-tight transition-colors ${isScrolled ? 'text-slate-900' : 'text-white'}`}>
                                {t.nav.company}
                            </span>
                            <span className={`block text-[11px] tracking-wide transition-colors ${isScrolled ? 'text-slate-500' : 'text-white/75'}`}>
                                {t.nav.tagline}
                            </span>
                        </span>
                    </Link>

                    {/* Desktop nav */}
                    <div className="hidden md:flex items-center gap-0.5">
                        {/* Basis Panen — primary action, always visible */}
                        <Link
                            href="/basis-panen"
                            className="group relative mx-1 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-300 bg-gradient-to-br from-[#1b5e3f] to-[#156c31] text-white shadow-[0_4px_14px_rgba(27,94,63,0.35)] hover:shadow-[0_8px_24px_rgba(27,94,63,0.45)] hover:-translate-y-0.5 active:translate-y-0"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200" />
                            </span>
                            Basis Panen
                        </Link>

                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className={`group relative px-3.5 py-2 text-sm font-medium rounded-full transition-colors duration-300 ${baseHover}`}
                            >
                                {link.name}
                                <span
                                    className={`pointer-events-none absolute inset-x-3.5 -bottom-0.5 h-px origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${isScrolled
                                        ? 'bg-palm-green'
                                        : 'bg-white'
                                        }`}
                                />
                            </a>
                        ))}

                        {/* Language */}
                        <button
                            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                            aria-label="Toggle language"
                            className={`mx-1 ml-3 flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-bold uppercase transition-colors duration-300 border ${isScrolled
                                ? 'text-slate-600 hover:bg-slate-100 border-black/10'
                                : 'text-white hover:bg-white/15 border-white/25'
                            }`}
                        >
                            <Globe className="h-3.5 w-3.5" />
                            {language}
                        </button>

                        {/* Portal */}
                        <Link
                            href="/login"
                            className={`group mx-1 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 active:scale-95 ${isScrolled
                                ? 'bg-palm-green text-white hover:bg-[#156c31] shadow-md hover:shadow-lg hover:-translate-y-0.5'
                                : 'bg-white text-palm-green hover:bg-white/90 shadow-md hover:shadow-lg hover:-translate-y-0.5'
                            }`}
                        >
                            {t.nav.portal} <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </Link>
                    </div>

                    {/* Mobile toggle */}
                    <div className="relative md:hidden">
                        <button
                            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                            aria-label="Toggle language"
                            className={`mr-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase transition-colors border ${isScrolled
                                ? 'text-slate-600 border-black/10'
                                : 'text-white border-white/25'
                            }`}
                        >
                            <Globe className="h-3.5 w-3.5" />
                            {language}
                        </button>
                        <button
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
                            aria-expanded={isMobileMenuOpen}
                            className={`inline-flex items-center justify-center h-10 w-10 rounded-full transition-colors ${isScrolled
                                ? 'text-slate-700 hover:bg-slate-100'
                                : 'text-white hover:bg-white/10'
                            }`}
                        >
                            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile menu */}
                <div
                    className={`md:hidden overflow-hidden transition-[max-height,opacity] duration-400 ease-out ${isMobileMenuOpen ? 'max-h-[560px] opacity-100 mt-3' : 'max-h-0 opacity-0'
                    }`}
                >
                    <div className={`rounded-2xl p-3 ${isScrolled
                        ? 'bg-white/95 backdrop-blur-xl border border-black/5 shadow-xl'
                        : 'bg-black/35 backdrop-blur-xl border border-white/10 shadow-xl'
                    }`}>
                        <Link
                            href="/basis-panen"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="flex items-center justify-between rounded-xl bg-gradient-to-br from-[#1b5e3f] to-[#156c31] px-4 py-3.5 text-white font-semibold"
                        >
                            Basis Panen <ArrowRight className="h-4 w-4" />
                        </Link>
                        <div className="mt-2 grid gap-0.5">
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${isScrolled
                                        ? 'text-slate-700 hover:bg-slate-100'
                                        : 'text-white/90 hover:bg-white/10'
                                    }`}
                                >
                                    {link.name}
                                </a>
                            ))}
                        </div>
                        <Link
                            href="/login"
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="mt-2 block rounded-xl bg-palm-green text-white text-center px-4 py-3.5 text-sm font-semibold"
                        >
                            {t.nav.portal}
                        </Link>
                    </div>
                </div>
            </div>
        </nav>
    )
}
