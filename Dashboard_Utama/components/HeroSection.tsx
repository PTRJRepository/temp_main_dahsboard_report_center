'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export default function HeroSection() {
    const { t } = useLanguage()

    return (
        <section className="relative h-screen flex items-center justify-center overflow-hidden">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/assets/kelapa-sawit-pohon.webp"
                    alt="Perkebunan Kelapa Sawit"
                    fill
                    sizes="100vw"
                    className="object-cover"
                    priority
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/70" />
                {/* Animated gradient accent */}
                <div className="absolute inset-0 bg-gradient-to-tr from-palm-green/20 via-transparent to-golden-yellow/10" />
            </div>

            {/* Floating particles effect */}
            <div className="absolute inset-0 z-5 overflow-hidden">
                {[...Array(20)].map((_, i) => {
                    // Use deterministic values to avoid hydration mismatch
                    const seed = i * 137.5; // Golden angle for better distribution
                    const x = 50 + (Math.sin(seed) * 40); // Percentage between 10% and 90%
                    const y = 20 + (i * 4); // Distribute vertically

                    return (
                        <motion.div
                            key={i}
                            className="absolute w-2 h-2 bg-golden-yellow/30 rounded-full"
                            style={{
                                left: `${x}%`,
                                top: `${y}%`,
                            }}
                            animate={{
                                y: [null, -100],
                                opacity: [0, 1, 0],
                            }}
                            transition={{
                                duration: 3 + (i * 0.1), // Deterministic duration
                                repeat: Infinity,
                                delay: i * 0.1, // Deterministic delay
                            }}
                        />
                    );
                })}
            </div>

            <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
                {/* Logo */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="mb-8"
                >
                    <div className="relative w-24 h-24 md:w-32 md:h-32 mx-auto rounded-full bg-white/10 backdrop-blur-md p-2 shadow-xl overflow-hidden mb-6">
                        <Image
                            src="/assets/logo.webp"
                            alt="PT Rebinmas Jaya"
                            fill
                            sizes="(max-width: 768px) 160px, 192px"
                            className="object-cover rounded-full"
                            loading="eager"
                        />
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                >
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                        <span className="block">{t.hero.title1}</span>
                        <span className="block mt-2 bg-gradient-to-r from-golden-yellow via-yellow-300 to-golden-yellow bg-clip-text text-transparent">
                            {t.hero.title2}
                        </span>
                    </h1>
                    <p className="text-lg md:text-xl lg:text-2xl mb-10 font-light max-w-3xl mx-auto text-gray-200 leading-relaxed">
                        {t.hero.description}
                    </p>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20"
                        >
                            <p className="text-3xl md:text-4xl font-bold text-golden-yellow">3</p>
                            <p className="text-sm text-white/80">{t.hero.stats.estateTitle}</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20"
                        >
                            <p className="text-3xl md:text-4xl font-bold text-golden-yellow">10+</p>
                            <p className="text-sm text-white/80">{t.hero.stats.divisionTitle}</p>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20"
                        >
                            <p className="text-3xl md:text-4xl font-bold text-golden-yellow">ISPO</p>
                            <p className="text-sm text-white/80">{t.hero.stats.ispoTitle}</p>
                        </motion.div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            href="/login"
                            className="group inline-flex items-center justify-center px-8 py-4 bg-palm-green hover:bg-palm-green-hover text-white font-semibold rounded-full transition-all duration-300 shadow-lg hover:shadow-2xl transform hover:-translate-y-1"
                        >
                            {t.hero.portalBtn}
                            <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                        <a
                            href="#about"
                            className="inline-flex items-center justify-center px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-semibold rounded-full border border-white/30 transition-all duration-300"
                        >
                            {t.hero.learnMoreBtn}
                        </a>
                    </div>
                </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
            >
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    <ChevronDown className="h-8 w-8 text-white/60" />
                </motion.div>
            </motion.div>

            {/* Decorative bottom gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent z-0" />
        </section>
    )
}
