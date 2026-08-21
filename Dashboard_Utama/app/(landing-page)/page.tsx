'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import SatelliteMap from '@/components/SatelliteMapWrapper'
import Image from 'next/image'
import { AnimatePresence, motion, useInView } from 'framer-motion'
import { MapPin, Phone, Mail, Building2, Factory, Leaf, Users, Award, TreePine, Heart, Globe, Shield, ExternalLink, PlayCircle, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'

const reveal = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
}

const revealSoft = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
}

const revealScale = {
  hidden: { opacity: 0, scale: 0.94 },
  visible: { opacity: 1, scale: 1 },
}

const revealTransition = { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const }

function RevealBlock({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      variants={reveal}
      transition={{ ...revealTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function RevealItem({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={revealSoft}
      transition={{ ...revealTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function RevealScale({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={revealScale}
      transition={{ ...revealTransition, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Animated number counter — counts up when scrolled into view.
function CountUp({ value, suffix = '', className = '' }: { value: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    const duration = 1400
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setDisplay(Math.round(eased * value))
      if (p < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [inView, value])

  return (
    <span ref={ref} className={className}>
      {display}{suffix}
    </span>
  )
}

const newsItems = [
  {
    title: 'Penandatanganan MoU Pembangunan Kebun Plasma Desa Aik Batu Buding',
    summary: 'PT Rebinmas Jaya terus memperkuat komitmen kemitraan ekonomi dengan masyarakat melalui penandatanganan Memorandum of Understanding (MoU) untuk pembangunan kebun kelapa sawit plasma. Sinergi strategis dengan Desa Aik Batu Buding ini bertujuan untuk mendorong kemandirian ekonomi warga lokal, sekaligus memastikan bahwa kehadiran perusahaan mampu memberikan dampak kesejahteraan yang inklusif dan berkelanjutan.',
    image: 'https://assets.pikiran-rakyat.com/crop/0x0:0x0/720x0/webp/photo/2025/05/22/3924964735.jpg',
    link: 'https://bangkabelitung.pikiran-rakyat.com/babel/pr-3809352786/pt-rebinmas-jaya-dan-desa-aik-batu-buding-teken-mou-pembangunan-plasma',
  },
  {
    title: 'Penyaluran Bantuan CSR oleh Jajaran Direksi Perusahaan',
    summary: 'Sebagai wujud nyata dari tata kelola perusahaan yang baik, jajaran manajemen yang dipimpin langsung oleh Direktur PT Rebinmas Jaya, Datuk Seri Ramli Sutanegara, turun langsung untuk menyalurkan bantuan Tanggung Jawab Sosial (CSR). Hal ini membuktikan dedikasi penuh manajemen dalam menjaga hubungan harmonis dan memastikan operasional perkebunan membawa nilai tambah bagi masyarakat di lingkar Hak Guna Usaha (HGU).',
    image: 'https://asset.tribunnews.com/uvA_6_LIkwH9xXci-0waso3kmVg=/1200x675/filters:upscale():quality(30):format(webp):focal(0.5x0.5:0.5x0.5)/belitung/foto/bank/originals/direktur-pt-rebinmas-jaya-datuk-seri-ramli-sutanegara-saat.jpg',
    link: 'https://belitung.tribunnews.com/2020/11/26/pt-rebinmas-jaya-salurkan-bantuan-csr',
  },
  {
    title: 'Penyaluran Beasiswa Pendidikan dan Bantuan Sosial Sembako',
    summary: 'Berfokus pada peningkatan kualitas Sumber Daya Manusia (SDM) dan ketahanan pangan warga, PT Rebinmas Jaya menyalurkan dana CSR berupa beasiswa bagi mahasiswa berprestasi serta paket bantuan sembako untuk masyarakat Desa Air Batu Buding, Kecamatan Badau. Program ini adalah bentuk investasi sosial perusahaan untuk mendukung generasi muda Belitung dan meringankan beban kebutuhan dasar masyarakat.',
    image: 'https://setda.belitung.go.id/wp-content/uploads/2020/11/T.jpg',
    link: 'https://setda.belitung.go.id/desa-aik-batu-buding-terima-bantuan-csr-pt-rebinmas-jaya/',
  },
  {
    title: 'Penyerahan 12 Hewan Kurban dan Dana Pemberdayaan Masyarakat',
    summary: 'Menjaga kearifan lokal dan tradisi berbagi, PT Rebinmas Jaya rutin menyalurkan hewan kurban setiap perayaan Idul Adha. Pada tahun ini, perusahaan menyerahkan 12 ekor sapi kurban yang didistribusikan bersamaan dengan kucuran dana CSR untuk pemberdayaan masyarakat. Bantuan ini merupakan wujud rasa syukur sekaligus upaya mempererat tali silaturahmi dengan warga di sekitar area perkebunan.',
    image: 'https://asset.tribunnews.com/tJvavNSQWZuhbxBh5uKmwBx4BGY=/1200x675/filters:upscale():quality(30):format(webp):focal(0.5x0.5:0.5x0.5)/belitung/foto/bank/originals/rebinmas-jaya_20180814_102501.jpg',
    link: 'https://belitung.tribunnews.com/2018/08/14/pt-rebinmas-jaya-serahkan-12-hewan-kurban-dan-dana-csr',
  },
]

const csrGalleryImages = [
  { src: '/assets/CSR_1.webp', alt: 'Distribusi Sembako', featured: true },
  { src: '/assets/CSR_2.webp', alt: 'Bantuan ke Desa' },
  { src: '/assets/CSR_3.webp', alt: 'Kegiatan Sosial' },
  { src: '/assets/CSR_4.webp', alt: 'Pemberdayaan Masyarakat' },
  { src: '/assets/CSR_5.webp', alt: 'Bersama Warga' },
]

export default function Home() {
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState<number | null>(null)
  const selectedGalleryItem = selectedGalleryIndex === null ? null : csrGalleryImages[selectedGalleryIndex]

  const closeGallery = () => setSelectedGalleryIndex(null)
  const showPreviousGalleryImage = () => {
    setSelectedGalleryIndex((current) => (current === null ? current : (current - 1 + csrGalleryImages.length) % csrGalleryImages.length))
  }
  const showNextGalleryImage = () => {
    setSelectedGalleryIndex((current) => (current === null ? current : (current + 1) % csrGalleryImages.length))
  }

  useEffect(() => {
    if (selectedGalleryIndex === null) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedGalleryIndex(null)
      if (event.key === 'ArrowLeft') {
        setSelectedGalleryIndex((current) => (current === null ? current : (current - 1 + csrGalleryImages.length) % csrGalleryImages.length))
      }
      if (event.key === 'ArrowRight') {
        setSelectedGalleryIndex((current) => (current === null ? current : (current + 1) % csrGalleryImages.length))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedGalleryIndex])

  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <HeroSection />

      {/* Kilasan Perusahaan Section */}
      <section id="kilasan" className="relative py-24 lg:py-32 bg-white overflow-hidden">
        {/* Giant watermark */}
        <span aria-hidden className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 text-[22vw] leading-none font-bold text-palm-green/[0.04] select-none whitespace-nowrap font-display">
          REBINMAS
        </span>
        <RevealBlock className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <motion.span
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mb-8 block h-px w-16 origin-center bg-palm-green"
            />
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green mb-6">Kilasan Perusahaan</h2>
            <div className="relative">
              <span aria-hidden className="absolute -top-8 -left-2 text-[120px] leading-none text-palm-green/10 font-display select-none">&ldquo;</span>
              <p className="relative text-xl md:text-2xl lg:text-[1.75rem] text-gray-700 leading-relaxed font-light">
                Berbasis di jantung Kepulauan Bangka Belitung, <strong className="font-semibold text-gray-900">PT Rebinmas Jaya</strong> adalah perusahaan perkebunan kelapa sawit yang memadukan efisiensi operasional dengan tanggung jawab sosial. Kami percaya bahwa pertumbuhan bisnis harus berjalan seiring dengan kesejahteraan masyarakat dan kelestarian lingkungan.
              </p>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Tentang Kami Section */}
      <section id="about" className="py-24 bg-gradient-to-b from-[#f6f8f6] to-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green mb-3">Tentang Kami</h2>
            <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight">Berakar di Belitung, Tumbuh untuk Negeri</h3>
          </div>

          {/* Profil Perusahaan */}
          <div className="grid md:grid-cols-2 gap-12 lg:gap-16 items-center mb-14">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-palm-green/10 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-palm-green" />
                </span>
                Profil Perusahaan
              </h3>
              <div className="text-lg text-gray-600 leading-relaxed space-y-4">
                <p>
                  PT Rebinmas Jaya adalah perusahaan yang bergerak di bidang budidaya dan pengolahan kelapa sawit.
                  Berkantor pusat di Jakarta dan memiliki basis operasional strategis di Kabupaten Belitung dan
                  Belitung Timur, kami fokus pada produksi Tandan Buah Segar (TBS) dan Minyak Kelapa Sawit (CPO)
                  yang memenuhi standar industri.
                </p>
                <p>
                  Dengan pengalaman panjang di industri perkebunan, kami mengelola ribuan hektar lahan produktif
                  yang tersebar di berbagai estate, dengan dukungan tenaga kerja profesional yang berdedikasi.
                </p>
              </div>
            </div>

            <RevealScale className="relative">
              <div className="relative h-72 md:h-[420px] rounded-3xl overflow-hidden shadow-2xl">
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[2s] hover:scale-105"
                  style={{ backgroundImage: "url('/assets/kebun sawit.webp')" }}
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-palm-green/75 to-earth-brown/80" />
                </div>
                <div className="relative h-full flex items-center justify-center text-center text-white p-8">
                  <div>
                    <TreePine className="h-16 w-16 mx-auto mb-4 opacity-90" />
                    <p className="text-lg font-semibold">Perkebunan Kelapa Sawit</p>
                    <p className="text-sm opacity-80">Belitung, Bangka Belitung</p>
                  </div>
                </div>
                {/* Corner accent */}
                <div className="absolute -top-3 -right-3 w-24 h-24 rounded-tr-[2rem] border-t-4 border-r-4 border-golden-yellow/70 pointer-events-none" />
              </div>
            </RevealScale>
          </div>

          {/* Stats strip — animated counters */}
          <RevealItem className="mb-14">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 shadow-sm">
              {[
                { v: 3, suffix: '', label: 'Estate Utama', icon: MapPin },
                { v: 10, suffix: '+', label: 'Divisi Kebun', icon: TreePine },
                { v: 100, suffix: '%', label: 'Komitmen ISPO', icon: Shield },
                { v: 5, suffix: '+', label: 'Desa Binaan', icon: Users },
              ].map((s, i) => (
                <div key={s.label} className="bg-white p-6 text-center hover:bg-[#f6f8f6] transition-colors">
                  <s.icon className="h-5 w-5 text-palm-green mx-auto mb-3" />
                  <p className="text-3xl md:text-4xl font-bold text-gray-900 font-display">
                    <CountUp value={s.v} suffix={s.suffix} />
                  </p>
                  <p className="mt-1 text-xs md:text-sm text-gray-500">{s.label}</p>
                  <span className="sr-only">{i}</span>
                </div>
              ))}
            </div>
          </RevealItem>

          {/* Visi & Misi */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Visi */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border-l-4 border-palm-green hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <Award className="h-7 w-7 text-golden-yellow" />
                Visi
              </h3>
              <p className="text-gray-600 leading-relaxed">
                PT. Rebinmas Jaya berkomitmen untuk memproduksi CPO dan Kernel berkwalitas yang berkesinambungan,
                dengan managemen yang professional didukung karyawan yang berdedikasi.
              </p>
            </div>

            {/* Misi */}
            <div className="bg-white p-8 rounded-2xl shadow-lg border-l-4 border-golden-yellow hover:shadow-xl transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <Leaf className="h-7 w-7 text-palm-green" />
                Misi
              </h3>
              <ul className="text-gray-600 leading-relaxed space-y-3">
                <li className="flex items-start gap-2">
                  <span className="text-palm-green font-bold">1.</span>
                  Melakukan kegiatan usaha yang berwawasan lingkungan dan berkelanjutan.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-palm-green font-bold">2.</span>
                  Menghasilkan produksi berkwalitas tinggi.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-palm-green font-bold">3.</span>
                  Mendorong Pembelajaran secara terus menerus dan perbaikan dalam penerapannya.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-palm-green font-bold">4.</span>
                  Menjadikan suatu perusahaan yang bertanggung jawab kepada masyarakat sekitar.
                </li>
              </ul>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Operasional Section */}
      <section id="operations" className="py-24 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green mb-3">Operasional</h2>
            <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight">Tiga Estate, Satu Standar</h3>
          </div>

          {/* Estates Grid — tilt + shine on hover */}
          <div className="grid md:grid-cols-3 gap-6 mb-14">
            {[
              {
                name: 'Parit Gunung Estate', loc: 'Kecamatan Badau, Belitung', icon: MapPin,
                grad: 'from-emerald-600 via-palm-green to-emerald-800',
                areas: ['1A', '1B', '2A', '2B'],
              },
              {
                name: 'Air Ruak Estate', loc: 'Kabupaten Belitung Timur', icon: TreePine,
                grad: 'from-amber-700 via-earth-brown to-amber-900',
                areas: ['ARE A', 'ARE B1', 'ARE B2', 'ARE C'],
              },
              {
                name: 'Darul Makmur Estate', loc: 'Kabupaten Belitung', icon: Globe,
                grad: 'from-teal-500 via-teal-600 to-teal-800',
                areas: ['Air Raya', 'Kandis', 'Cendong'],
              },
            ].map((estate, i) => (
              <RevealItem key={estate.name} delay={i * 0.12}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className={`group relative overflow-hidden rounded-3xl bg-gradient-to-br ${estate.grad} text-white p-7 shadow-lg hover:shadow-2xl transition-shadow`}
                >
                  {/* Shine sweep */}
                  <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                  {/* Decorative circle */}
                  <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-48 w-48 rounded-full border border-white/10" />
                  <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full border border-white/10" />

                  <div className="relative">
                    <div className="w-13 h-13 md:w-14 md:h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-5 ring-1 ring-white/25 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3">
                      <estate.icon className="h-7 w-7" />
                    </div>
                    <h3 className="text-xl font-bold mb-1.5 tracking-tight">{estate.name}</h3>
                    <p className="text-white/75 text-sm mb-5">{estate.loc}</p>
                    <div className="flex flex-wrap gap-2">
                      {estate.areas.map(a => (
                        <span key={a} className="px-3 py-1 bg-white/15 backdrop-blur-sm rounded-full text-xs font-medium ring-1 ring-white/10 transition-colors group-hover:bg-white/25">{a}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </RevealItem>
            ))}
          </div>

          {/* Satellite Map */}
          <RevealScale className="mb-14">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3 tracking-tight">
              <span className="w-10 h-10 rounded-xl bg-palm-green/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-palm-green" />
              </span>
              Lokasi Operasional
            </h3>
            <SatelliteMap />
          </RevealScale>

          {/* Standar Kualitas */}
          <RevealItem>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#f6f8f6] to-white p-8 md:p-10 border border-gray-200 shadow-sm">
              <Shield className="absolute -right-6 -top-6 h-36 w-36 text-palm-green/[0.06]" />
              <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3 tracking-tight">
                <span className="w-10 h-10 rounded-xl bg-palm-green/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-palm-green" />
                </span>
                Standar Kualitas
              </h3>
              <div className="text-gray-600 leading-relaxed space-y-4 max-w-3xl">
                <p>
                  Kami menerapkan Good Agricultural Practices (GAP) mulai dari pembibitan, perawatan,
                  hingga panen untuk memastikan Tandan Buah Segar (TBS) yang diproduksi memiliki rendemen
                  minyak yang tinggi.
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  {['GAP Certified', 'High Yield TBS', 'Quality CPO', 'ISPO Compliant'].map((badge, i) => (
                    <motion.span
                      key={badge}
                      initial={{ opacity: 0, scale: 0.85 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: i * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className={`px-4 py-2 rounded-full text-sm font-semibold ${i % 2 === 0 ? 'bg-palm-green/10 text-palm-green' : 'bg-earth-brown/10 text-earth-brown'}`}
                    >
                      {badge}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          </RevealItem>
        </RevealBlock>
      </section>

      {/* Inovasi Teknologi Section */}
      <section id="inovasi" className="py-24 bg-[#f6f8f6]">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <RevealScale className="order-2 lg:order-1">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[500px] group">
                <Image
                  src="/assets/Foto_deteksi.webp"
                  alt="Sistem Deteksi"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-[1.5s] group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="absolute bottom-4 left-4 right-4 bg-white/10 backdrop-blur-xl rounded-2xl p-4 border border-white/20"
                >
                  <div className="flex items-center gap-3 text-white">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400" />
                    </span>
                    <span className="text-sm font-semibold tracking-wider">SMART DETECTION SYSTEM ACTIVE</span>
                  </div>
                </motion.div>
              </div>
            </RevealScale>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green">Inovasi</h2>
              <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight leading-tight">Teknologi & Pertanian Presisi</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Menerapkan teknologi komputasi visual terkini untuk inventarisasi tegakan kelapa sawit yang akurat, memastikan estimasi hasil panen dan pemantauan kesehatan blok yang optimal.
              </p>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* WebGIS Section */}
      <section id="webgis" className="py-24 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-6 order-1">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green">Pemetaan Spasial</h2>
              <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight leading-tight">WebGIS Terintegrasi</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Manajemen lahan terintegrasi berbasis sistem informasi geografis. Mendukung pengambilan keputusan agronomis yang cepat dan presisi di seluruh area hak guna usaha.
              </p>
            </div>
            <RevealScale className="order-2">
              <div className="group relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[500px] ring-1 ring-gray-200">
                <Image
                  src="https://bookdown.org/einavg7/sp_technical_guide/images/lulcla.png"
                  alt="WebGIS Pemetaan Spasial"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  unoptimized
                  className="object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-blue-900/15 mix-blend-overlay" />
                <div className="absolute top-4 left-4 flex items-center gap-2 rounded-full bg-white/90 backdrop-blur-md px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-md">
                  <Globe className="h-3.5 w-3.5 text-palm-green" /> Live Layer
                </div>
              </div>
            </RevealScale>
          </div>
        </RevealBlock>
      </section>

      {/* Tata Kelola SDM Section */}
      <section id="hr" className="py-24 bg-[#f6f8f6]">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <RevealScale className="order-2 lg:order-1">
              <div className="group relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[500px]">
                <Image
                  src="https://memory.co.ke/wp-content/uploads/2022/08/human-resource-management-software.jpg"
                  alt="Dashboard HR"
                  fill
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover transition-transform duration-[1.5s] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            </RevealScale>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green">Tata Kelola SDM</h2>
              <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight leading-tight">Kesejahteraan Karyawan</h3>
              <p className="text-lg text-gray-600 leading-relaxed">
                Mengedepankan transparansi dan kesejahteraan tenaga kerja melalui sistem manajemen kompensasi yang adil, terstruktur, dan digerakkan oleh data terpusat.
              </p>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Keberlanjutan & CSR Section */}
      <section id="sustainability" className="relative py-24 overflow-hidden">
        {/* Dark nature backdrop */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/assets/kelapa-sawit-pohon.webp"
            alt=""
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0c231a]/95 via-[#123526]/92 to-earth-brown/90" />
        </div>

        <RevealBlock className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300 mb-3">Keberlanjutan</h2>
            <h3 className="text-3xl font-bold text-white sm:text-4xl tracking-tight">Tumbuh Tanpa Merusak</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Komitmen Lingkungan ISPO */}
            <RevealItem>
              <div className="group h-full bg-white/[0.07] backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/15 hover:border-amber-300/40 transition-colors shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-300/15 flex items-center justify-center mb-6 ring-1 ring-amber-300/25 transition-transform duration-500 group-hover:scale-110">
                  <Leaf className="h-7 w-7 text-amber-300" />
                </div>
                <h3 className="text-2xl font-bold mb-5 tracking-tight">Komitmen Lingkungan (ISPO)</h3>
                <p className="text-white/80 leading-relaxed">
                  PT Rebinmas Jaya berkomitmen penuh terhadap tata kelola perkebunan yang ramah lingkungan.
                  Kami telah dan terus berupaya memenuhi standar <strong className="text-white">Indonesian Sustainable Palm Oil (ISPO)</strong>,
                  memastikan bahwa produk kami dihasilkan tanpa merusak keseimbangan ekosistem. Predikat kelas
                  kebun yang baik menjadi bukti keseriusan kami dalam pengelolaan lahan.
                </p>
              </div>
            </RevealItem>

            {/* Pemberdayaan Masyarakat */}
            <RevealItem delay={0.12}>
              <div className="group h-full bg-white/[0.07] backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/15 hover:border-amber-300/40 transition-colors shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-amber-300/15 flex items-center justify-center mb-6 ring-1 ring-amber-300/25 transition-transform duration-500 group-hover:scale-110">
                  <Users className="h-7 w-7 text-amber-300" />
                </div>
                <h3 className="text-2xl font-bold mb-5 tracking-tight">Pemberdayaan Masyarakat</h3>
                <p className="text-white/80 leading-relaxed mb-5">
                  Kami percaya bahwa perusahaan tidak bisa tumbuh sendirian. PT Rebinmas Jaya aktif menjalin
                  hubungan harmonis dengan masyarakat di sekitar wilayah operasional (Ring 1), termasuk desa-desa
                  di Kabupaten Belitung dan Belitung Timur.
                </p>
                <div className="flex items-center gap-2.5 text-amber-300 font-semibold">
                  <Heart className="h-5 w-5" />
                  Program Plasma untuk ekonomi warga lokal
                </div>
              </div>
            </RevealItem>
          </div>

          {/* CSR & Bantuan Sosial */}
          <RevealItem delay={0.1} className="mt-8">
            <div className="bg-white/[0.07] backdrop-blur-xl p-8 md:p-10 rounded-3xl border border-white/15 shadow-2xl">
              <h3 className="text-xl font-bold mb-8 text-center tracking-tight">CSR & Bantuan Sosial</h3>
              <div className="grid sm:grid-cols-3 gap-8">
                {[
                  { icon: Heart, text: 'Bantuan paket sembako pada hari besar keagamaan (Ramadan/Idul Fitri)' },
                  { icon: Users, text: 'Penyaluran hewan kurban untuk masyarakat desa sekitar' },
                  { icon: Building2, text: 'Bantuan infrastruktur untuk desa binaan (Air Batu Buding, Kacang Butor, Pelepak Pute)' },
                ].map((item, i) => (
                  <motion.div
                    key={item.text}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="text-center p-4"
                  >
                    <div className="w-16 h-16 bg-amber-300/15 ring-1 ring-amber-300/25 rounded-full flex items-center justify-center mx-auto mb-4">
                      <item.icon className="h-7 w-7 text-amber-300" />
                    </div>
                    <p className="text-sm text-white/80 leading-relaxed">{item.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </RevealItem>
        </RevealBlock>
      </section>

      {/* Galeri CSR & Komunitas Section */}
      <section id="csr-gallery" className="py-20 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green mb-3">Dokumentasi</h2>
            <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight mb-5">Galeri CSR & Komunitas</h3>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Tumbuh bersama masyarakat Belitung. Menyalurkan dukungan nyata secara berkelanjutan untuk pendidikan, kesehatan, dan ketahanan pangan desa di sekitar area operasional kami.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
            {csrGalleryImages.map((item, index) => (
              <motion.button
                key={item.src}
                type="button"
                onClick={() => setSelectedGalleryIndex(index)}
                className={`relative rounded-2xl overflow-hidden cursor-zoom-in shadow-lg group focus:outline-none focus:ring-4 focus:ring-palm-green/30 ${item.featured ? 'col-span-2 row-span-2 h-64 md:h-[400px]' : 'h-48 md:h-[192px]'}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                whileHover={{ y: -4 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55, delay: index * 0.05, ease: 'easeOut' }}
                aria-label={`Perbesar foto ${item.alt}`}
              >
                <Image
                  src={item.src}
                  alt={item.alt}
                  fill
                  sizes={item.featured ? '(min-width: 1024px) 50vw, 100vw' : '(min-width: 1024px) 25vw, 50vw'}
                  className="object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                  <span className="text-white text-sm font-semibold tracking-wider flex items-center gap-2">
                    <Maximize2 className="w-4 h-4" /> Buka Dokumentasi
                  </span>
                </div>
              </motion.button>
            ))}
          </div>

          <div className="space-y-8">
            <h3 className="text-2xl font-bold text-gray-900 border-l-4 border-palm-green pl-4">Dokumentasi & Berita CSR</h3>
            <div className="grid md:grid-cols-2 gap-6">
              {newsItems.map((item) => (
                <a
                  key={`csr-${item.title}`}
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative flex flex-col sm:flex-row bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all border border-gray-100 h-full"
                >
                  <div className="relative w-full sm:w-2/5 aspect-video sm:aspect-auto sm:h-auto overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      unoptimized
                      sizes="(min-width: 768px) 40vw, 100vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="w-full sm:w-3/5 p-6 flex flex-col justify-center">
                    <h4 className="text-lg font-bold text-gray-900 group-hover:text-palm-green transition-colors mb-2 line-clamp-2">{item.title}</h4>
                    <p className="text-sm text-gray-600 line-clamp-3 mb-4">{item.summary}</p>
                    <span className="text-sm font-semibold text-palm-green flex items-center mt-auto">
                      Baca Selengkapnya <ExternalLink className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Berita & CSR Section */}
      <section id="news" className="py-20 bg-gray-50">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green mb-3">Berita</h2>
            <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight">Kabar Terkini</h3>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {newsItems.map((item) => (
              <a
                key={item.title}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col group bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-100 hover:border-palm-green/30 h-full"
              >
                <div className="relative w-full h-48 overflow-hidden bg-gray-100 flex-shrink-0">
                  <Image
                    src={item.image}
                    alt={item.title}
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-white/90 text-palm-green backdrop-blur-sm shadow-sm">Berita Terkini</span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-lg font-bold text-gray-900 group-hover:text-palm-green transition-colors line-clamp-2">{item.title}</h4>
                    <ExternalLink className="h-4 w-4 text-gray-400 flex-shrink-0 ml-2" />
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-4 mb-4 flex-grow">{item.summary}</p>
                  <span className="text-sm font-semibold text-palm-green flex items-center mt-auto">
                    Baca Selengkapnya <ExternalLink className="h-4 w-4 ml-1 transform group-hover:translate-x-1 transition-transform" />
                  </span>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden rounded-2xl bg-earth-brown text-white shadow-lg">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-35"
                style={{ backgroundImage: "url('/assets/CSR_1.webp')" }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-earth-brown via-earth-brown/90 to-palm-green/80" />
              <div className="relative p-8">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
                  <PlayCircle className="h-9 w-9 text-golden-yellow" />
                </div>
                <h3 className="text-2xl font-bold">Video Penyaluran CSR</h3>
                <p className="mt-4 max-w-2xl text-white/85 leading-relaxed">
                  Dokumentasi kegiatan sosial perusahaan, termasuk penyaluran bantuan kepada masyarakat desa sekitar,
                  dukungan pendidikan, dan program pemberdayaan komunitas di wilayah operasional Belitung.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium">Bantuan Sosial</span>
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium">Pendidikan</span>
                  <span className="rounded-full bg-white/15 px-4 py-2 text-sm font-medium">Pemberdayaan</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
              <p className="text-xl font-bold text-gray-900">Berita Terkini</p>
              <div className="mt-5 space-y-4">
                {[
                  'MoU pembangunan kebun plasma Desa Aik Batu Buding',
                  'CSR direksi untuk masyarakat lingkar HGU',
                  'Beasiswa pendidikan dan bantuan sembako',
                  'Hewan kurban dan dana pemberdayaan masyarakat',
                ].map((item, index) => (
                  <div key={item} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-palm-green text-sm font-bold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm font-medium text-gray-700">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </RevealBlock>
      </section>


      {/* Hubungi Kami Section */}
      <section id="contact" className="py-20 bg-gray-50">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-palm-green mb-3">Kontak</h2>
            <h3 className="text-3xl font-bold text-gray-900 sm:text-4xl tracking-tight">Hubungi Kami</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info Section */}
            <RevealItem className="space-y-8">
              {/* Kantor Kebun */}
              <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  <Factory className="h-6 w-6 text-palm-green" />
                  Kantor Kebun
                </h3>
                <div className="text-gray-600 space-y-4">
                  <p className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-palm-green mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Parit Gunung Estate</strong><br />
                      Dusun Parit Gunung, Desa Air Batu Buding<br />
                      Kecamatan Badau, Belitung
                    </span>
                  </p>
                  <p className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-palm-green mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Air Ruak Estate</strong><br />
                      Kabupaten Belitung Timur
                    </span>
                  </p>
                  <p className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-palm-green mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Darul Makmur Estate (Pelepak Pute)</strong><br />
                      Kabupaten Belitung
                    </span>
                  </p>
                </div>
              </div>

              {/* Kantor Induk (Head Office) */}
              <div className="bg-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-shadow">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-palm-green" />
                  Kantor Induk (Head Office)
                </h3>
                <div className="text-gray-600 space-y-2">
                  <p className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-palm-green mt-0.5 flex-shrink-0" />
                    <span>
                      Dusun Parit Gunung, Desa Air Batu Buding<br />
                      Kecamatan Badau, Tanjung Pandan 33451<br />
                      Kabupaten Belitung, Kepulauan Bangka Belitung
                    </span>
                  </p>
                  <p className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-palm-green flex-shrink-0" />
                    <span>(021) 51401888</span>
                  </p>
                </div>
              </div>
            </RevealItem>

            {/* Contact Form */}
            <RevealItem delay={0.1} className="bg-white p-8 rounded-2xl shadow-lg">
              <h3 className="text-xl font-bold text-gray-900 mb-6">Formulir Kontak</h3>
              <form className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Nama</label>
                  <input
                    type="text"
                    id="name"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all"
                    placeholder="Nama lengkap Anda"
                  />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    id="email"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all"
                    placeholder="email@contoh.com"
                  />
                </div>
                <div>
                  <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-1">Subjek</label>
                  <input
                    type="text"
                    id="subject"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all"
                    placeholder="Subjek pesan"
                  />
                </div>
                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Pesan</label>
                  <textarea
                    id="message"
                    rows={4}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-palm-green focus:border-transparent transition-all resize-none"
                    placeholder="Tulis pesan Anda di sini..."
                  />
                </div>
                <button
                  type="submit"
                  className="w-full px-6 py-3 bg-palm-green hover:bg-palm-green-hover text-white font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  Kirim Pesan
                </button>
              </form>
            </RevealItem>
          </div>
        </RevealBlock>
      </section>

      {/* Footer */}
      <footer className="relative bg-[#0c231a] text-white py-14 overflow-hidden">
        <span aria-hidden className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full border border-white/5" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -right-16 h-52 w-52 rounded-full border border-white/5" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <div className="overflow-hidden rounded-full bg-white p-1 shadow-lg">
                  <Image src="/assets/logo.webp" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain p-1" />
                </div>
                <h4 className="text-lg font-bold text-amber-200 tracking-tight">PT Rebinmas Jaya</h4>
              </div>
              <p className="text-white/60 text-sm leading-relaxed max-w-xs">
                Perusahaan perkebunan kelapa sawit yang berkomitmen pada keberlanjutan dan pemberdayaan masyarakat.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/80 mb-4">Navigasi</h4>
              <ul className="text-white/70 text-sm space-y-2.5">
                {[
                  ['#kilasan', 'Kilasan Perusahaan'],
                  ['#about', 'Tentang Kami'],
                  ['#operations', 'Operasional'],
                  ['#sustainability', 'Keberlanjutan & CSR'],
                  ['#news', 'Berita & CSR'],
                  ['#contact', 'Hubungi Kami'],
                ].map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="group inline-flex items-center gap-1.5 hover:text-white transition-colors">
                      <span className="h-px w-0 bg-amber-300 transition-all duration-300 group-hover:w-3" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300/80 mb-4">Kontak</h4>
              <div className="text-white/70 text-sm space-y-2.5">
                <p className="flex items-center gap-2.5">
                  <Phone className="h-4 w-4 text-amber-300/80" />
                  (021) 51401888
                </p>
                <p className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-amber-300/80" />
                  info@rebinmasjaya.co.id
                </p>
                <p className="flex items-start gap-2.5">
                  <MapPin className="h-4 w-4 mt-0.5 text-amber-300/80" />
                  Belitung, Bangka Belitung
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-white/50 text-sm">
              &copy; {new Date().getFullYear()} PT Rebinmas Jaya. Hak Cipta Dilindungi.
            </p>
            <p className="text-white/35 text-xs tracking-wide">Sawit Berkelanjutan · Belitung</p>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {selectedGalleryItem && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label={`Foto ${selectedGalleryItem.alt}`}
          >
            <button
              type="button"
              aria-label="Tutup foto"
              className="absolute inset-0 cursor-zoom-out"
              onClick={closeGallery}
            />

            <motion.div
              className="pointer-events-none absolute inset-0 flex items-center justify-center p-4 sm:p-8"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <div className="pointer-events-auto relative h-[78vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/20">
                <Image
                  src={selectedGalleryItem.src}
                  alt={selectedGalleryItem.alt}
                  fill
                  sizes="100vw"
                  className="object-contain"
                  priority
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
                  <p className="text-sm font-semibold tracking-wide">{selectedGalleryItem.alt}</p>
                  <p className="mt-1 text-xs text-white/70">{selectedGalleryIndex! + 1} / {csrGalleryImages.length}</p>
                </div>
              </div>
            </motion.div>

            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={showPreviousGalleryImage}
              className="absolute left-3 top-1/2 z-[101] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:left-6 sm:h-12 sm:w-12"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={showNextGalleryImage}
              className="absolute right-3 top-1/2 z-[101] flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-6 sm:h-12 sm:w-12"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
            <button
              type="button"
              aria-label="Tutup foto"
              onClick={closeGallery}
              className="absolute right-4 top-4 z-[101] flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition hover:bg-white/25 sm:right-6 sm:top-6"
            >
              <X className="h-6 w-6" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
