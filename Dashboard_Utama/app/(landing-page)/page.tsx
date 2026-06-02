'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import SatelliteMap from '@/components/SatelliteMapWrapper'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Phone, Mail, Building2, Factory, Leaf, Users, Award, TreePine, Heart, Globe, Shield, ExternalLink, PlayCircle, X, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'

const reveal = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
}

const revealSoft = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
}

const revealTransition = { duration: 0.7, ease: 'easeOut' as const }

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
      <section id="kilasan" className="py-20 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-6">Kilasan Perusahaan</h2>
            <div className="h-1 w-24 bg-palm-green mx-auto rounded-full mb-8" />
            <p className="text-xl text-gray-600 leading-relaxed italic">
              &quot;Berbasis di jantung Kepulauan Bangka Belitung, PT Rebinmas Jaya adalah perusahaan perkebunan kelapa sawit yang memadukan efisiensi operasional dengan tanggung jawab sosial. Kami percaya bahwa pertumbuhan bisnis harus berjalan seiring dengan kesejahteraan masyarakat dan kelestarian lingkungan.&quot;
            </p>
          </div>
        </RevealBlock>
      </section>

      {/* Tentang Kami Section */}
      <section id="about" className="py-20 bg-gray-50">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Tentang Kami</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
          </div>

          {/* Profil Perusahaan */}
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                <Building2 className="h-8 w-8 text-palm-green" />
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

            <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden shadow-xl">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: "url('/assets/kebun sawit.webp')" }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-palm-green/80 to-earth-brown/80" />
              </div>
              <div className="relative h-full flex items-center justify-center text-center text-white p-8">
                <div>
                  <TreePine className="h-16 w-16 mx-auto mb-4 opacity-90" />
                  <p className="text-lg font-semibold">Perkebunan Kelapa Sawit</p>
                  <p className="text-sm opacity-80">Belitung, Bangka Belitung</p>
                </div>
              </div>
            </div>
          </div>

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
      <section id="operations" className="py-20 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Operasional</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
          </div>

          {/* Estates Grid */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Parit Gunung Estate */}
            <div className="bg-gradient-to-br from-palm-green to-emerald-700 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <MapPin className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Parit Gunung Estate</h3>
              <p className="text-white/80 text-sm mb-4">Kecamatan Badau, Belitung</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">1A</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">1B</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">2A</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">2B</span>
              </div>
            </div>

            {/* Air Ruak Estate */}
            <div className="bg-gradient-to-br from-earth-brown to-amber-800 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <TreePine className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Air Ruak Estate</h3>
              <p className="text-white/80 text-sm mb-4">Kabupaten Belitung Timur</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">ARE A</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">ARE B1</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">ARE B2</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">ARE C</span>
              </div>
            </div>

            {/* Darul Makmur Estate */}
            <div className="bg-gradient-to-br from-teal-600 to-teal-800 text-white p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-4">
                <Globe className="h-7 w-7" />
              </div>
              <h3 className="text-xl font-bold mb-2">Darul Makmur Estate</h3>
              <p className="text-white/80 text-sm mb-4">Kabupaten Belitung</p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">Air Raya</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">Kandis</span>
                <span className="px-3 py-1 bg-white/20 rounded-full text-xs">Cendong</span>
              </div>
            </div>
          </div>

          {/* Satellite Map */}
          <div className="mb-12">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <MapPin className="h-7 w-7 text-palm-green" />
              Lokasi Operasional
            </h3>
            <SatelliteMap />
          </div>

          {/* Standar Kualitas */}
          <div className="bg-gray-50 p-8 rounded-2xl">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <Shield className="h-7 w-7 text-palm-green" />
              Standar Kualitas
            </h3>
            <div className="text-gray-600 leading-relaxed space-y-4">
              <p>
                Kami menerapkan <em>Good Agricultural Practices</em> (GAP) mulai dari pembibitan, perawatan,
                hingga panen untuk memastikan Tandan Buah Segar (TBS) yang diproduksi memiliki rendemen
                minyak yang tinggi.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="px-4 py-2 bg-palm-green/10 text-palm-green rounded-full text-sm font-medium">GAP Certified</span>
                <span className="px-4 py-2 bg-golden-yellow/10 text-earth-brown rounded-full text-sm font-medium">High Yield TBS</span>
                <span className="px-4 py-2 bg-palm-green/10 text-palm-green rounded-full text-sm font-medium">Quality CPO</span>
                <span className="px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">ISPO Compliant</span>
              </div>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Inovasi Teknologi Section */}
      <section id="inovasi" className="py-20 bg-gray-50">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[500px] group">
              <Image
                src="/assets/Foto_deteksi.webp"
                alt="Sistem Deteksi"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20">
                <div className="flex items-center gap-3 text-white">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-sm font-semibold tracking-wider">SMART DETECTION SYSTEM ACTIVE</span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Inovasi Teknologi & Pertanian Presisi</h2>
              <div className="h-1 w-24 bg-palm-green rounded-full" />
              <p className="text-lg text-gray-600 leading-relaxed">
                Menerapkan teknologi komputasi visual terkini untuk inventarisasi tegakan kelapa sawit yang akurat, memastikan estimasi hasil panen dan pemantauan kesehatan blok yang optimal.
              </p>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* WebGIS Section */}
      <section id="webgis" className="py-20 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Pemetaan Spasial (WebGIS)</h2>
              <div className="h-1 w-24 bg-palm-green rounded-full" />
              <p className="text-lg text-gray-600 leading-relaxed">
                Manajemen lahan terintegrasi berbasis sistem informasi geografis. Mendukung pengambilan keputusan agronomis yang cepat dan presisi di seluruh area hak guna usaha.
              </p>
            </div>
            <div className="relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[500px] border-4 border-gray-100">
              <Image
                src="https://bookdown.org/einavg7/sp_technical_guide/images/lulcla.png"
                alt="WebGIS Pemetaan Spasial"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                unoptimized
                className="object-cover"
              />
              <div className="absolute inset-0 bg-blue-900/20 mix-blend-overlay" />
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Tata Kelola SDM Section */}
      <section id="hr" className="py-20 bg-gray-50">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 relative rounded-3xl overflow-hidden shadow-2xl h-80 lg:h-[500px]">
              <Image
                src="https://memory.co.ke/wp-content/uploads/2022/08/human-resource-management-software.jpg"
                alt="Dashboard HR"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="order-1 lg:order-2 space-y-6">
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Tata Kelola SDM & Kesejahteraan Karyawan</h2>
              <div className="h-1 w-24 bg-palm-green rounded-full" />
              <p className="text-lg text-gray-600 leading-relaxed">
                Mengedepankan transparansi dan kesejahteraan tenaga kerja melalui sistem manajemen kompensasi yang adil, terstruktur, dan digerakkan oleh data terpusat.
              </p>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Keberlanjutan & CSR Section */}
      <section id="sustainability" className="py-20 bg-gradient-to-br from-palm-green to-earth-brown text-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold sm:text-4xl">Keberlanjutan & CSR</h2>
            <div className="mt-4 h-1 w-24 bg-golden-yellow mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Komitmen Lingkungan ISPO */}
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Leaf className="h-7 w-7 text-golden-yellow" />
                Komitmen Lingkungan (ISPO)
              </h3>
              <p className="text-white/90 leading-relaxed">
                PT Rebinmas Jaya berkomitmen penuh terhadap tata kelola perkebunan yang ramah lingkungan.
                Kami telah dan terus berupaya memenuhi standar <strong>Indonesian Sustainable Palm Oil (ISPO)</strong>,
                memastikan bahwa produk kami dihasilkan tanpa merusak keseimbangan ekosistem. Predikat kelas
                kebun yang baik menjadi bukti keseriusan kami dalam pengelolaan lahan.
              </p>
            </div>

            {/* Pemberdayaan Masyarakat */}
            <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
              <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                <Users className="h-7 w-7 text-golden-yellow" />
                Pemberdayaan Masyarakat
              </h3>
              <p className="text-white/90 leading-relaxed mb-4">
                Kami percaya bahwa perusahaan tidak bisa tumbuh sendirian. PT Rebinmas Jaya aktif menjalin
                hubungan harmonis dengan masyarakat di sekitar wilayah operasional (Ring 1), termasuk desa-desa
                di Kabupaten Belitung dan Belitung Timur.
              </p>
              <div className="flex items-center gap-2 text-golden-yellow font-semibold">
                <Heart className="h-5 w-5" />
                Program Plasma untuk ekonomi warga lokal
              </div>
            </div>
          </div>

          {/* CSR & Bantuan Sosial */}
          <div className="mt-12 bg-white/10 backdrop-blur-sm p-8 rounded-2xl border border-white/20">
            <h3 className="text-2xl font-bold mb-6 text-center">CSR & Bantuan Sosial</h3>
            <div className="grid sm:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-golden-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-8 w-8 text-golden-yellow" />
                </div>
                <p className="text-sm text-white/90">Bantuan paket sembako pada hari besar keagamaan (Ramadan/Idul Fitri)</p>
              </div>
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-golden-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-golden-yellow" />
                </div>
                <p className="text-sm text-white/90">Penyaluran hewan kurban untuk masyarakat desa sekitar</p>
              </div>
              <div className="text-center p-4">
                <div className="w-16 h-16 bg-golden-yellow/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="h-8 w-8 text-golden-yellow" />
                </div>
                <p className="text-sm text-white/90">Bantuan infrastruktur untuk desa binaan (Air Batu Buding, Kacang Butor, Pelepak Pute)</p>
              </div>
            </div>
          </div>
        </RevealBlock>
      </section>

      {/* Galeri CSR & Komunitas Section */}
      <section id="csr-gallery" className="py-20 bg-white">
        <RevealBlock className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Galeri CSR & Komunitas</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full mb-6" />
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
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Berita & CSR PT Rebinmas Jaya</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
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
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Hubungi Kami</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
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
      <footer className="bg-earth-brown text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <div className="overflow-hidden rounded-full bg-white p-1">
                  <Image src="/assets/logo.webp" alt="Logo" width={48} height={48} className="h-12 w-12 object-contain p-1" />
                </div>
                <h4 className="text-lg font-bold text-golden-yellow">PT Rebinmas Jaya</h4>
              </div>
              <p className="text-white/80 text-sm leading-relaxed">
                Perusahaan perkebunan kelapa sawit yang berkomitmen pada keberlanjutan dan pemberdayaan masyarakat.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4 text-golden-yellow">Navigasi</h4>
              <ul className="text-white/80 text-sm space-y-2">
                <li><a href="#kilasan" className="hover:text-white transition-colors">Kilasan Perusahaan</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Tentang Kami</a></li>
                <li><a href="#operations" className="hover:text-white transition-colors">Operasional</a></li>
                <li><a href="#sustainability" className="hover:text-white transition-colors">Keberlanjutan & CSR</a></li>
                <li><a href="#news" className="hover:text-white transition-colors">Berita & CSR PT Rebinmas Jaya</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Hubungi Kami</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-lg font-bold mb-4 text-golden-yellow">Kontak</h4>
              <div className="text-white/80 text-sm space-y-2">
                <p className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  (021) 51401888
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  info@rebinmasjaya.co.id
                </p>
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5" />
                  Belitung, Bangka Belitung
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 text-center">
            <p className="text-white/60 text-sm">
              &copy; {new Date().getFullYear()} PT Rebinmas Jaya. Hak Cipta Dilindungi.
            </p>
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
