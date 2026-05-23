'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ArrowRight, Globe } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

// navLinks removed, will be built dynamically inside component

export default function Navbar() {
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { language, setLanguage, t } = useLanguage()

    const navLinks = [
        { name: t.nav.home, href: '#' },
        { name: t.nav.about, href: '#about' },
        { name: t.nav.operations, href: '#operations' },
        { name: t.nav.sustainability, href: '#sustainability' },
        { name: t.nav.news, href: '#news' },
        { name: t.nav.gallery, href: '#gallery' },
        { name: t.nav.contact, href: '#contact' },
    ]

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50)
        }
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <nav
            className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled
                ? 'bg-white/95 backdrop-blur-md shadow-lg py-2'
                : 'bg-gradient-to-b from-black/50 to-transparent py-4'
                }`}
        >
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between">
                    {/* Logo */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white shadow-md group-hover:shadow-lg transition-shadow">
                            <Image
                                src="/assets/logo.webp"
                                alt="PT Rebinmas Jaya"
                                fill
                                className="object-contain p-1"
                            />
                        </div>
                        <div className={`hidden sm:block transition-colors ${isScrolled ? 'text-gray-900' : 'text-white'}`}>
                            <p className="font-bold text-lg leading-tight">{t.nav.company}</p>
                            <p className={`text-xs ${isScrolled ? 'text-gray-500' : 'text-white/80'}`}>{t.nav.tagline}</p>
                        </div>
                    </Link>

                    {/* Desktop Navigation */}
                    <div className="hidden md:flex items-center gap-1">
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105 ${isScrolled
                                    ? 'text-gray-700 hover:text-palm-green hover:bg-palm-green/10'
                                    : 'text-white/90 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                {link.name}
                            </a>
                        ))}
                        <button
                            onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                            className={`ml-2 p-2 rounded-full transition-all duration-300 flex items-center gap-2 ${isScrolled
                                ? 'text-gray-700 hover:bg-gray-100 border border-gray-200'
                                : 'text-white hover:bg-white/20 border border-white/30'
                                }`}
                            aria-label="Toggle Language"
                        >
                            <Globe className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase">{language}</span>
                        </button>
                        <Link
                            href="/login"
                            className={`ml-4 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 flex items-center gap-2 ${isScrolled
                                ? 'bg-palm-green text-white hover:bg-palm-green-hover shadow-md hover:shadow-lg'
                                : 'bg-white/20 backdrop-blur-md text-white border border-white/30 hover:bg-white/30'
                                }`}
                        >
                            {t.nav.portal} <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className={`md:hidden p-2 rounded-lg transition-colors ${isScrolled ? 'text-gray-700 hover:bg-gray-100' : 'text-white hover:bg-white/10'
                            }`}
                    >
                        {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden mt-4 pb-4 border-t border-white/20">
                        <div className="pt-4 space-y-2">
                            {/* Language Switcher Mobile */}
                            <button
                                onClick={() => setLanguage(language === 'id' ? 'en' : 'id')}
                                className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors border ${isScrolled
                                    ? 'text-gray-700 hover:bg-gray-100 border-gray-200'
                                    : 'text-white hover:bg-white/10 border-white/30'
                                    }`}
                            >
                                <Globe className="h-4 w-4" />
                                <span>Language: {language === 'id' ? 'EN' : 'ID'}</span>
                            </button>
                            {navLinks.map((link) => (
                                <a
                                    key={link.name}
                                    href={link.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isScrolled
                                        ? 'text-gray-700 hover:bg-gray-100'
                                        : 'text-white hover:bg-white/10'
                                        }`}
                                >
                                    {link.name}
                                </a>
                            ))}
                            <Link
                                href="/login"
                                onClick={() => setIsMobileMenuOpen(false)}
                                className="block px-4 py-3 bg-palm-green text-white rounded-lg text-sm font-semibold text-center mt-4"
                            >
                                {t.nav.portal}
                            </Link>
                        </div>
                    </div>
                )}
            </div>
        </nav>
    )
}
