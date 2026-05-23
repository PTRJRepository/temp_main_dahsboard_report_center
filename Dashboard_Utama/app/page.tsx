import Navbar from '@/components/Navbar'
import HeroSection from '@/components/HeroSection'
import SatelliteMap from '@/components/SatelliteMapWrapper'
import { MapPin, Phone, Mail, Building2, Factory, Leaf, Users, Award, TreePine, Heart, Globe, Shield, Newspaper, ExternalLink, PlayCircle } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50">
      <Navbar />
      <HeroSection />

      {/* Kilasan Perusahaan Section */}
      <section id="kilasan" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-6">Kilasan Perusahaan</h2>
            <div className="h-1 w-24 bg-palm-green mx-auto rounded-full mb-8" />
            <p className="text-xl text-gray-600 leading-relaxed italic">
              "Berbasis di jantung Kepulauan Bangka Belitung, PT Rebinmas Jaya adalah perusahaan perkebunan kelapa sawit yang memadukan efisiensi operasional dengan tanggung jawab sosial. Kami percaya bahwa pertumbuhan bisnis harus berjalan seiring dengan kesejahteraan masyarakat dan kelestarian lingkungan."
            </p>
          </div>
        </div>
      </section>

      {/* Tentang Kami Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        </div>
      </section>

      {/* Operasional Section */}
      <section id="operations" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        </div>
      </section>

      {/* Inovasi & Sistem Pendukung Section */}
      <section id="inovasi" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Inovasi & Sistem Pendukung</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
            <p className="mt-6 max-w-3xl mx-auto text-gray-600 text-lg">
              Area pendukung operasional yang sebelumnya ada tetap ditampilkan sebagai konteks transformasi digital perusahaan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Inovasi Teknologi & Pertanian Presisi',
                desc: 'Menerapkan teknologi komputasi visual terkini untuk inventarisasi tegakan kelapa sawit yang akurat, memastikan estimasi hasil panen dan pemantauan kesehatan blok yang optimal.',
                icon: Shield,
                color: 'from-palm-green to-emerald-700',
              },
              {
                title: 'Pemetaan Spasial (WebGIS)',
                desc: 'Manajemen lahan terintegrasi berbasis sistem informasi geografis untuk mendukung keputusan agronomis yang cepat dan presisi di seluruh area hak guna usaha.',
                icon: Globe,
                color: 'from-teal-600 to-teal-800',
              },
              {
                title: 'Tata Kelola SDM & Kesejahteraan Karyawan',
                desc: 'Mengedepankan transparansi dan kesejahteraan tenaga kerja melalui sistem manajemen kompensasi yang adil, terstruktur, dan digerakkan oleh data terpusat.',
                icon: Users,
                color: 'from-earth-brown to-amber-800',
              },
              {
                title: 'Galeri CSR & Komunitas',
                desc: 'Tumbuh bersama masyarakat Belitung melalui dukungan berkelanjutan untuk pendidikan, kesehatan, dan ketahanan pangan desa sekitar area operasional.',
                icon: Heart,
                color: 'from-golden-yellow to-amber-600',
              },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1">
                <div className={`bg-gradient-to-br ${item.color} p-6 text-white`}>
                  <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-5">
                    <item.icon className="h-7 w-7" />
                  </div>
                  <h3 className="text-lg font-bold leading-tight">{item.title}</h3>
                </div>
                <div className="p-6">
                  <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Keberlanjutan & CSR Section */}
      <section id="sustainability" className="py-20 bg-gradient-to-br from-palm-green to-earth-brown text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
        </div>
      </section>

      {/* Berita & CSR Section */}
      <section id="news" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-palm-green font-semibold uppercase tracking-wider mb-3">Berita Terkini</p>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl flex items-center justify-center gap-3">
              <Newspaper className="h-9 w-9 text-palm-green" />
              Berita & CSR PT Rebinmas Jaya
            </h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
            <p className="mt-6 max-w-3xl mx-auto text-gray-600 text-lg">
              Informasi terbaru tentang kemitraan masyarakat, program plasma, bantuan sosial, dan kegiatan CSR perusahaan.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                title: 'Penandatanganan MoU Pembangunan Kebun Plasma Desa Aik Batu Buding',
                summary: 'PT Rebinmas Jaya terus memperkuat komitmen kemitraan ekonomi dengan masyarakat melalui penandatanganan Memorandum of Understanding (MoU) untuk pembangunan kebun kelapa sawit plasma. Sinergi strategis dengan Desa Aik Batu Buding ini bertujuan untuk mendorong kemandirian ekonomi warga lokal, sekaligus memastikan bahwa kehadiran perusahaan mampu memberikan dampak kesejahteraan yang inklusif dan berkelanjutan.',
                image: 'https://assets.pikiran-rakyat.com/crop/0x0:0x0/720x0/webp/photo/2025/05/22/3924964735.jpg',
                link: 'https://bangkabelitung.pikiran-rakyat.com/babel/pr-3809352786/pt-rebinmas-jaya-dan-desa-aik-batu-buding-teken-mou-pembangunan-plasma',
                source: 'Pikiran Rakyat Bangka Belitung',
              },
              {
                title: 'Penyaluran Bantuan CSR oleh Jajaran Direksi Perusahaan',
                summary: 'Sebagai wujud nyata dari tata kelola perusahaan yang baik, jajaran manajemen yang dipimpin langsung oleh Direktur PT Rebinmas Jaya, Datuk Seri Ramli Sutanegara, turun langsung untuk menyalurkan bantuan Tanggung Jawab Sosial (CSR). Hal ini membuktikan dedikasi penuh manajemen dalam menjaga hubungan harmonis dan memastikan operasional perkebunan membawa nilai tambah bagi masyarakat di lingkar Hak Guna Usaha (HGU).',
                image: 'https://asset.tribunnews.com/uvA_6_LIkwH9xXci-0waso3kmVg=/1200x675/filters:upscale():quality(30):format(webp):focal(0.5x0.5:0.5x0.5)/belitung/foto/bank/originals/direktur-pt-rebinmas-jaya-datuk-seri-ramli-sutanegara-saat.jpg',
                link: 'https://belitung.tribunnews.com/2020/11/26/pt-rebinmas-jaya-salurkan-bantuan-csr',
                source: 'Tribun Belitung',
              },
              {
                title: 'Penyaluran Beasiswa Pendidikan dan Bantuan Sosial Sembako',
                summary: 'Berfokus pada peningkatan kualitas Sumber Daya Manusia (SDM) dan ketahanan pangan warga, PT Rebinmas Jaya menyalurkan dana CSR berupa beasiswa bagi mahasiswa berprestasi serta paket bantuan sembako untuk masyarakat Desa Air Batu Buding, Kecamatan Badau. Program ini adalah bentuk investasi sosial perusahaan untuk mendukung generasi muda Belitung dan meringankan beban kebutuhan dasar masyarakat.',
                image: 'https://setda.belitung.go.id/wp-content/uploads/2020/11/T.jpg',
                link: 'https://setda.belitung.go.id/desa-aik-batu-buding-terima-bantuan-csr-pt-rebinmas-jaya/',
                source: 'Setda Belitung',
              },
              {
                title: 'Penyerahan 12 Hewan Kurban dan Dana Pemberdayaan Masyarakat',
                summary: 'Menjaga kearifan lokal dan tradisi berbagi, PT Rebinmas Jaya rutin menyalurkan hewan kurban setiap perayaan Idul Adha. Pada tahun ini, perusahaan menyerahkan 12 ekor sapi kurban yang didistribusikan bersamaan dengan kucuran dana CSR untuk pemberdayaan masyarakat. Bantuan ini merupakan wujud rasa syukur sekaligus upaya mempererat tali silaturahmi dengan warga di sekitar area perkebunan.',
                image: 'https://asset.tribunnews.com/tJvavNSQWZuhbxBh5uKmwBx4BGY=/1200x675/filters:upscale():quality(30):format(webp):focal(0.5x0.5:0.5x0.5)/belitung/foto/bank/originals/rebinmas-jaya_20180814_102501.jpg',
                link: 'https://belitung.tribunnews.com/2018/08/14/pt-rebinmas-jaya-serahkan-12-hewan-kurban-dan-dana-csr',
                source: 'Tribun Belitung',
              },
            ].map((item) => (
              <article key={item.title} className="bg-gray-50 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all hover:-translate-y-1 border border-gray-100">
                <div className="h-44 overflow-hidden bg-gray-200">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                  />
                </div>
                <div className="p-5">
                  <div className="mb-3 inline-flex rounded-full bg-palm-green/10 px-3 py-1 text-xs font-semibold text-palm-green">
                    Sumber: {item.source}
                  </div>
                  <h3 className="font-bold text-gray-900 leading-snug line-clamp-2">{item.title}</h3>
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-5">{item.summary}</p>
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-palm-green hover:text-palm-green-hover transition-colors"
                  >
                    Baca Selengkapnya
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </article>
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

            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-8 shadow-lg">
              <h3 className="text-xl font-bold text-gray-900">Berita Terkini</h3>
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
        </div>
      </section>

      {/* Foto & Dokumentasi Section */}
      <section id="gallery" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Foto & Dokumentasi</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
            <p className="mt-6 max-w-3xl mx-auto text-gray-600 text-lg">
              Dokumentasi kegiatan operasional, CSR, komunitas, dan sistem pendukung PT Rebinmas Jaya.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 mb-8">
            <div className="relative h-[420px] rounded-2xl overflow-hidden shadow-xl group">
              <img
                src="/assets/kebun sawit.webp"
                alt="Dokumentasi perkebunan kelapa sawit PT Rebinmas Jaya"
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-earth-brown/90 via-earth-brown/25 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
                <span className="inline-flex rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                  Dokumentasi Operasional
                </span>
                <h3 className="mt-4 text-3xl font-bold">Perkebunan Kelapa Sawit</h3>
                <p className="mt-3 max-w-2xl text-white/85">
                  Area operasional perkebunan di Belitung sebagai basis produksi dan pengelolaan kebun berkelanjutan.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { src: '/assets/CSR_1.webp', title: 'Dokumentasi CSR 1' },
                { src: '/assets/CSR_2.webp', title: 'Dokumentasi CSR 2' },
                { src: '/assets/CSR_3.webp', title: 'Dokumentasi CSR 3' },
                { src: '/assets/CSR_4.webp', title: 'Dokumentasi CSR 4' },
              ].map((item) => (
                <div key={item.src} className="relative min-h-[200px] rounded-2xl overflow-hidden shadow-lg group">
                  <img
                    src={item.src}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-sm font-semibold text-white">{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                src: '/assets/CSR_5.webp',
                title: 'Galeri CSR & Komunitas',
                desc: 'Tumbuh bersama masyarakat Belitung melalui dukungan berkelanjutan untuk pendidikan, kesehatan, dan ketahanan pangan desa sekitar area operasional.',
              },
              {
                src: '/assets/Foto_deteksi.webp',
                title: 'Inovasi Teknologi & Pertanian Presisi',
                desc: 'Dokumentasi penerapan teknologi komputasi visual untuk inventarisasi tegakan kelapa sawit dan pemantauan kondisi blok.',
              },
              {
                src: '/assets/absen_monitoring.webp',
                title: 'Dokumentasi Sistem Operasional',
                desc: 'Monitoring sistem internal untuk mendukung tata kelola absensi, layanan, dan pelaporan operasional perusahaan.',
              },
            ].map((item) => (
              <article key={item.title} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                <div className="h-56 overflow-hidden bg-gray-200">
                  <img
                    src={item.src}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900">{item.title}</h3>
                  <p className="mt-3 text-sm text-gray-600 leading-relaxed">{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Hubungi Kami Section */}
      <section id="contact" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">Hubungi Kami</h2>
            <div className="mt-4 h-1 w-24 bg-palm-green mx-auto rounded-full" />
          </div>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Info Section */}
            <div className="space-y-8">
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
            </div>

            {/* Contact Form */}
            <div className="bg-white p-8 rounded-2xl shadow-lg">
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
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-earth-brown text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="text-lg font-bold mb-4 text-golden-yellow">PT Rebinmas Jaya</h4>
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
                <li><a href="#inovasi" className="hover:text-white transition-colors">Inovasi</a></li>
                <li><a href="#sustainability" className="hover:text-white transition-colors">Keberlanjutan & CSR</a></li>
                <li><a href="#news" className="hover:text-white transition-colors">Berita & CSR</a></li>
                <li><a href="#gallery" className="hover:text-white transition-colors">Foto & Dokumentasi</a></li>
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
    </main>
  )
}
