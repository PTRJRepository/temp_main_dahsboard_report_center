'use client'

import { motion, useScroll, useTransform } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useRef } from 'react'
import { useLanguage } from '@/context/LanguageContext'

// Word-by-word reveal for the display headline.
function WordReveal({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
    return (
        <span className={className}>
            {text.split(' ').map((word, i) => (
                <span key={`${word}-${i}`} className="inline-block overflow-hidden pb-[0.08em] -mb-[0.08em] align-bottom">
                    <motion.span
                        className="inline-block will-change-transform"
                        initial={{ y: '110%' }}
                        animate={{ y: 0 }}
                        transition={{ duration: 0.9, delay: delay + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {word}
                    </motion.span>
                    {i < text.split(' ').length - 1 && <span>&nbsp;</span>}
                </span>
            ))}
        </span>
    )
}

export default function HeroSection() {
    const { t } = useLanguage()
    const sectionRef = useRef<HTMLElement>(null)

    // Parallax: background drifts slower than content on scroll.
    const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] })
    const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '22%'])
    const bgScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18])
    const contentOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0])
    const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '35%'])

    return (
        <section ref={sectionRef} className="relative h-[100svh] min-h-[640px] flex items-center justify-center overflow-hidden">
            {/* ── Cinematic backdrop with parallax ─────────────────── */}
            <motion.div className="absolute inset-0 z-0" style={{ y: bgY, scale: bgScale }}>
                <Image
                    src="/assets/kelapa-sawit-pohon.webp"
                    alt="Perkebunan Kelapa Sawit"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-[#04120a]/80 via-[#04120a]/45 to-[#04120a]/85" />
                <div className="absolute inset-0 bg-gradient-to-tr from-emerald-900/30 via-transparent to-transparent" />
            </motion.div>

            {/* ── Firefly particles ────────────────────────────────── */}
            <div className="absolute inset-0 z-[5] overflow-hidden pointer-events-none">
                {[...Array(18)].map((_, i) => {
                    const seed = i * 137.5
                    const x = 50 + (Math.sin(seed) * 42)
                    const y = 15 + ((i * 53) % 70)
                    return (
                        <motion.div
                            key={i}
                            className="absolute rounded-full bg-amber-200/40 blur-[2px]"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                                width: i % 3 === 0 ? 3 : 2,
                                height: i % 3 === 0 ? 3 : 2,
                            }}
                            animate={{
                                y: [null, -120],
                                opacity: [0, 0.9, 0],
                                x: [0, Math.sin(seed) * 24],
                            }}
                            transition={{
                                duration: 6 + (i % 5),
                                repeat: Infinity,
                                delay: i * 0.45,
                                ease: 'easeOut',
                            }}
                        />
                    )
                })}
            </div>

            {/* ── Content ──────────────────────────────────────────── */}
            <motion.div style={{ opacity: contentOpacity, y: contentY }} className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white w-full">
                {/* Logo — breathing ring */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                    className="mb-8 flex justify-center"
                >
                    <div className="relative">
                        {/* Rotating dashed ring */}
                        <motion.div
                            className="absolute -inset-3 rounded-full border border-dashed border-white/25"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                        />
                        <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-full bg-white/10 backdrop-blur-md p-1.5 shadow-2xl overflow-hidden ring-1 ring-white/25">
                            <Image
                                src="/assets/logo.webp"
                                alt="PT Rebinmas Jaya"
                                fill
                                sizes="(max-width: 768px) 112px, 144px"
                                className="object-cover rounded-full"
                                loading="eager"
                            />
                        </div>
                    </div>
                </motion.div>

                {/* Eyebrow */}
                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: 0.15 }}
                    className="mb-5 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/85 backdrop-blur-md"
                >
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-300" />
                    </span>
                    PT Rebinmas Jaya · Belitung
                </motion.p>

                {/* Headline — word reveal */}
                <h1 className="text-[clamp(2.4rem,7vw,5.5rem)] font-bold tracking-tight leading-[1.02] mb-6 font-display">
                    <WordReveal text={t.hero.title1} delay={0.3} />
                    <br />
                    <WordReveal
                        text={t.hero.title2}
                        delay={0.55}
                        className="bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 bg-clip-text text-transparent"
                    />
                </h1>

                <motion.p
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.9 }}
                    className="text-base md:text-xl max-w-2xl mx-auto text-white/70 leading-relaxed mb-10"
                >
                    {t.hero.description}
                </motion.p>

                {/* Stats — glass strip */}
                <motion.div
                    initial={{ opacity: 0, y: 26 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.05 }}
                    className="mx-auto mb-11 grid max-w-xl grid-cols-3 divide-x divide-white/15 rounded-2xl border border-white/15 bg-white/[0.07] backdrop-blur-xl shadow-2xl"
                >
                    {[
                        { v: '3', l: t.hero.stats.estateTitle },
                        { v: '10+', l: t.hero.stats.divisionTitle },
                        { v: 'ISPO', l: t.hero.stats.ispoTitle },
                    ].map(s => (
                        <div key={s.l} className="group px-3 py-5 transition-colors hover:bg-white/[0.06]">
                            <p className="text-2xl md:text-4xl font-bold text-amber-200 font-display">{s.v}</p>
                            <p className="mt-1 text-[11px] md:text-sm text-white/70">{s.l}</p>
                        </div>
                    ))}
                </motion.div>

                {/* CTAs */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 1.2 }}
                    className="flex flex-col sm:flex-row gap-4 justify-center"
                >
                    <Link
                        href="/login"
                        className="group relative inline-flex items-center justify-center overflow-hidden px-9 py-4 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white font-semibold rounded-full transition-all duration-300 shadow-[0_12px_40px_rgba(16,185,129,0.35)] hover:shadow-[0_16px_50px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0"
                    >
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                        <span className="relative">{t.hero.portalBtn}</span>
                        <ArrowRight className="relative ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <a
                        href="#about"
                        className="inline-flex items-center justify-center px-9 py-4 bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md text-white font-semibold rounded-full border border-white/25 transition-all duration-300 hover:border-white/50"
                    >
                        {t.hero.learnMoreBtn}
                    </a>
                </motion.div>
            </motion.div>

            {/* Scroll cue */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.8 }}
                className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
            >
                <span className="text-[10px] uppercase tracking-[0.3em] text-white/45">Gulir</span>
                <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
                    <ChevronDown className="h-5 w-5 text-white/60" />
                </motion.div>
            </motion.div>
        </section>
    )
}