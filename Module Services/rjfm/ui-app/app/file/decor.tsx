'use client'

/**
 * Ilustrasi estate: FOTO ASLI dari pencarian gambar (shared/google-image-search)
 * yang dicari sekali per tema lalu disimpan permanen di NAS (folder scene/).
 * SVG pemandangan dipertahankan sebagai fallback saat foto gagal dimuat.
 */

import { useEffect, useState } from 'react'

/** Satu pohon sawit (siluet corporate flat) — pangkal di (0,0). */
function PalmTree({ x = 0, y = 0, s = 1, tone = '#14532d' }: { x?: number; y?: number; s?: number; tone?: string }) {
  const fronds = [-78, -52, -26, 0, 24, 50, 76]
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {/* batang melengkung */}
      <path d="M0 0 C 3 -34, -4 -66, 6 -96 L 12 -95 C 5 -65, 12 -33, 10 0 Z" fill={tone} />
      {/* pelepah */}
      {fronds.map((deg, i) => (
        <path key={i}
          d="M9 -97 C 30 -122, 62 -132, 92 -124 C 64 -108, 36 -98, 11 -93 Z"
          fill={tone}
          transform={`rotate(${deg} 9 -97)`}
          opacity={0.95}
        />
      ))}
      {/* tandan buah (TBS) emas kecil di mahkota — accent ≤10% area */}
      <circle cx="7" cy="-88" r="6" fill="#e8a33d" />
      <circle cx="14" cy="-84" r="4.5" fill="#f2b25c" />
    </g>
  )
}

/**
 * Pemandangan lebar: langit pagi, matahari, kabut, barisan sawit,
 * jalan tanah merah — untuk hero login & beranda.
 */
export function EstateScene({ className = '', idp = 'sc1', showRoad = true }: { className?: string; idp?: string; showRoad?: boolean }) {
  return (
    <svg viewBox="0 0 900 430" preserveAspectRatio="xMidYMax slice" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${idp}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fef9ec" />
          <stop offset="55%" stopColor="#f3ecd2" />
          <stop offset="100%" stopColor="#e4eecb" />
        </linearGradient>
        <linearGradient id={`${idp}-h1`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a7c98a" />
          <stop offset="100%" stopColor="#8fb877" />
        </linearGradient>
        <linearGradient id={`${idp}-h2`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6fae63" />
          <stop offset="100%" stopColor="#57954f" />
        </linearGradient>
        <linearGradient id={`${idp}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f7d44" />
          <stop offset="100%" stopColor="#2c5e35" />
        </linearGradient>
        <radialGradient id={`${idp}-sun`}>
          <stop offset="0%" stopColor="#ffd985" />
          <stop offset="60%" stopColor="#f6b75a" />
          <stop offset="100%" stopColor="rgba(246,183,90,0)" />
        </radialGradient>
      </defs>

      {/* langit + matahari */}
      <rect width="900" height="430" fill={`url(#${idp}-sky)`} />
      <circle cx="700" cy="120" r="150" fill={`url(#${idp}-sun)`} opacity=".85" />
      <circle cx="700" cy="120" r="46" fill="#ffdf94" />

      {/* awan tipis */}
      <ellipse cx="180" cy="86" rx="110" ry="16" fill="#ffffff" opacity=".7" />
      <ellipse cx="300" cy="112" rx="80" ry="12" fill="#ffffff" opacity=".5" />
      <ellipse cx="560" cy="70" rx="90" ry="13" fill="#ffffff" opacity=".55" />

      {/* bukit jauh & tengah */}
      <path d="M0 250 Q 140 190 300 236 T 620 226 T 900 214 V 430 H 0 Z" fill={`url(#${idp}-h1)`} />
      <path d="M0 292 Q 200 240 420 280 T 900 268 V 430 H 0 Z" fill={`url(#${idp}-h2)`} />
      {/* kabut */}
      <rect y="278" width="900" height="26" fill="#ffffff" opacity=".28" rx="13" />
      <rect y="304" width="900" height="18" fill="#ffffff" opacity=".18" rx="9" />

      {/* lahan depan + jalan tanah merah */}
      <path d="M0 330 Q 260 306 520 322 T 900 316 V 430 H 0 Z" fill={`url(#${idp}-ground)`} />
      {showRoad && (
        <>
          <path d="M-40 430 C 220 388 360 372 560 352 C 700 338 800 330 920 320 L 920 344 C 800 352 700 362 560 376 C 380 396 220 414 -40 430 Z"
            fill="#b0713f" opacity=".92" />
          <path d="M-40 430 C 220 388 360 372 560 352 C 700 338 800 330 920 320 L 920 326 C 800 336 700 346 560 360 C 380 380 220 400 -40 418 Z"
            fill="#8a5426" opacity=".45" />
        </>
      )}

      {/* barisan sawit: belakang kecil (tone muda) → depan besar (tone tua) */}
      <PalmTree x={70} y={332} s={0.55} tone="#2f6a3a" />
      <PalmTree x={170} y={340} s={0.7} tone="#2a6034" />
      <PalmTree x={300} y={344} s={0.6} tone="#2f6a3a" />
      <PalmTree x={430} y={346} s={0.85} tone="#24582f" />
      <PalmTree x={600} y={342} s={0.68} tone="#2a6034" />
      <PalmTree x={740} y={338} s={0.8} tone="#24582f" />
      <PalmTree x={850} y={344} s={0.62} tone="#2f6a3a" />
      <PalmTree x={230} y={396} s={1.15} tone="#1d4f2a" />
      <PalmTree x={520} y={410} s={1.35} tone="#17452a" />
      <PalmTree x={800} y={402} s={1.2} tone="#1d4f2a" />
    </svg>
  )

}

/** Palem tunggal untuk aksen kartu / empty state. */
export function PalmAccent({ className = '', tone = '#166534' }: { className?: string; tone?: string }) {
  return (
    <svg viewBox="-60 -160 160 165" className={className} aria-hidden>
      <PalmTree x={0} y={0} s={1} tone={tone} />
    </svg>
  )
}

/**
 * Foto ilustrasi untuk kartu tugas — dicari via backend memakai judul tugas
 * sebagai kata kunci (shared/google-image-search). Hasil di-cache per query.
 * Fallback: gradient hijau lembut saat foto belum siap / gagal.
 */
export function TaskScenePhoto({ title, className = '' }: { title: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const key = title.slice(0, 60)

  useEffect(() => {
    let alive = true
    const qs = encodeURIComponent(key)
    fetch(`/api/file/meta/scene/task?q=${qs}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive && j?.data?.url) setUrl(j.data.url) })
      .catch(() => {})
    return () => { alive = false }
  }, [key])

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      {!ready && (
        <div className="absolute inset-0 bg-gradient-to-br from-green-100 via-lime-50 to-emerald-200" />
      )}
      {url && (
        <img
          src={url}
          alt=""
          onLoad={() => setReady(true)}
          onError={() => setReady(false)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${ready ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
        />
      )}
    </div>
  )
}

/**
 * Foto scene asli (dari Google/Bing Images via backend, tersimpan di NAS).
 * Render <img> dengan fallback halus ke gradien hijau bila foto belum siap.
 */
export function ScenePhoto({
  theme = 'estate',
  className = '',
  overlay = true,
}: {
  theme?: 'estate' | 'palm' | 'harvest' | 'road' | 'tractor' | 'login'
  className?: string
  overlay?: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/file/meta/scene?theme=${theme}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(j => { if (alive && j?.data?.url) setUrl(j.data.url) })
      .catch(() => {})
    return () => { alive = false }
  }, [theme])

  return (
    <div className={`relative overflow-hidden ${className}`} aria-hidden>
      {/* fallback gradient saat foto belum termuat */}
      {!ready && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#fef9ec] via-[#e4eecb] to-[#8fb877]" />
      )}
      {url && (
        <img
          src={url}
          alt=""
          onLoad={() => setReady(true)}
          onError={() => setReady(false)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
        />
      )}
      {overlay && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-white/10 to-green-950/30" />
      )}
    </div>
  )
}

/** Ornamen pelepah untuk pojok panel (garis lengkap + helai). */
export function FrondCorner({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 220" className={className} aria-hidden fill="none">
      <path d="M10 210 C 60 150, 120 100, 205 60" stroke="rgba(255,255,255,.25)" strokeWidth="3" strokeLinecap="round" />
      {Array.from({ length: 7 }).map((_, i) => {
        const t = i / 6
        const px = 10 + t * 195
        const py = 210 - t * 150
        return (
          <g key={i} transform={`translate(${px} ${py}) rotate(${-58 + i * 6})`}>
            <path d="M0 0 C 16 -22, 44 -30, 70 -22 C 46 -10, 22 -4, 0 0 Z" fill="rgba(255,255,255,.16)" />
          </g>
        )
      })}
    </svg>
  )
}

/**
 * TaskPanel — kartu tugas bergaya korporat: panel putih bersih dengan
 * strip status vertikal di kiri (satu-satunya ornamen) + kolom aksi kanan.
 * `tone` menentukan warna strip status.
 */
export function TicketCard({ children, stub, onClick, className = '', tone = 'green' }: {
  children: React.ReactNode            // bagian utama panel
  stub?: React.ReactNode               // kolom aksi/status di kanan
  onClick?: () => void                 // seluruh panel bisa diklik
  className?: string
  tone?: 'green' | 'amber' | 'red' | 'sky'   // warna strip status kiri
}) {
  const accent = {
    green: '#16a34a',
    amber: '#d97706',
    red: '#dc2626',
    sky: '#0284c7',
  }[tone]
  const Comp: any = onClick ? 'button' : 'div'
  return (
    <Comp onClick={onClick}
      style={{ ['--ticket-accent' as any]: accent }}
      className={`ticket text-left w-full group transition-all duration-200 hover:-translate-y-[2px] hover:shadow-[0_16px_36px_-18px_rgba(27,45,34,.35)] ${className}`}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 p-5 pl-6">{children}</div>
        {stub && (
          <div className="ticket-perf ticket-stub shrink-0 w-[104px] flex flex-col items-center justify-center gap-1.5 px-3 py-4">
            {stub}
          </div>
        )}
      </div>
    </Comp>
  )
}

/**
 * Callout korporat — pengganti sticky note. Panel tint lembut dengan garis
 * aksen kiri; tanpa selotip, lipatan sudut, rotasi, atau garis buku tulis.
 */
export function StickyNote({ children, className = '', variant = 'yellow', rotate = 0, ruled = false }: {
  children: React.ReactNode
  className?: string
  variant?: 'yellow' | 'green' | 'blue' | 'red'
  rotate?: number
  ruled?: boolean
}) {
  const v = variant === 'green' ? 'rj-note-green' : variant === 'blue' ? 'rj-note-blue' : variant === 'red' ? 'rj-note-red' : ''
  return (
    <div
      className={`rj-note ${v} px-5 py-4 text-sm font-semibold ${className}`}>
      {children}
    </div>
  )
}
