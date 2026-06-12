# Landing Page — Dokumentasi Teknis

**Project:** PT Rebinmas Jaya Main Dashboard  
**File:** `Dashboard_Utama/app/(landing-page)/page.tsx`  
**Updated:** 2026-06-12

---

## 1. Overview

Halaman landing page (`/`) adalah halaman publik utama yang menampilkan profil perusahaan PT Rebinmas Jaya — perusahaan perkebunan kelapa sawit di Belitung, Bangka Belitung. Halaman ini **tidak memerlukan autentikasi** (public).

**Routing:** Next.js App Router, route group `(landing-page)`  
**Styling:** Tailwind CSS + framer-motion (animasi scroll reveal)  
**No Auth:** Tidak ada proteksi middleware — siapa pun bisa akses

---

## 2. File Structure

```
Dashboard_Utama/app/(landing-page)/
└── page.tsx          # ~600 baris — komponen utama

Dashboard_Utama/components/
├── Navbar.tsx              # Navigasi atas + menu
├── HeroSection.tsx         # Hero banner besar
├── SatelliteMapWrapper.tsx  # Peta satelit Belitung
├── HeroBanner.tsx          # Banner promo (dashboard)
├── ModuleCard.tsx          # Kartu modul (dashboard)
├── GlobalSearch.tsx        # Pencarian global (dashboard)
└── SatelliteMap.tsx       # Peta satelit (dashboard)
```

---

## 3. Sections (Landing Page)

### 3.1 Navbar
Navigasi horizontal dengan logo, menu links, dan CTA button.  
Links: `#kilasan`, `#about`, `#layanan`, `#berita`, `#kontak`

### 3.2 HeroSection
Banner hero full-width dengan background image, headline, subtext, dan 2 CTA buttons.  
Animation: framer-motion fade-in + scale.  
Image: `/assets/kebun Sawit.webp` dari `Dashboard_Utama/public/assets/`

### 3.3 Kilasan Perusahaan
Section quote company vision. Center-aligned, italic text.

### 3.4 Tentang Kami
Grid 2 kolom: profil perusahaan (kiri) + visual card (kanan).  
Konten: profil perusahaan, visi-misi, struktur organisasi, dan aktivitas CSR.

### 3.5 Layanan / Modul Dashboard
4 kartu modul layanan:
1. **Report Center** — Laporan Inventori Kebun
2. **Absensi Karyawan** — `/absen`
3. **Penggajian / Payroll** — `/upah`
4. **Monitoring Beras** — `/monitoring-beras`

Masing-masing kartu: icon, nama, deskripsi, button "Akses →"

### 3.6 Berita / News
Carousel/gallery berita CSR dari external links (pikiran-rakyat, tribunnews, setda.belitung.go.id).  
4 news items dengan image, title, summary, dan external link.

### 3.7 Galeri CSR
Lightbox gallery 5 gambar CSR dari `/assets/CSR_1.webp` s/d `CSR_5.webp`.  
Fitur: keyboard navigation (Arrow Left/Right/Escape), fullscreen, swipe.

### 3.8 Statistik
4 counter cards: Tahun Berdiri, Total Karyawan, Luas Kebun, Production CPO.  
Animation: number counter dengan framer-motion.

### 3.9 Kontak
Info kontak: alamat, telepon, email, maps/alamat.  
2 action buttons: "Hubungi Kami" + "Kunjungi Lokasi".

### 3.10 Footer
Copyright, links, social icons.

---

## 4. Design System

### Color Variables (CSS Custom Properties via Tailwind config)
- `--palm-green`: `#167A3A` (primary accent)
- `--earth-brown`: kombinasi earthy tone
- `--navy-dark`: `#071426` (sidebar, dark elements)

### Typography
- Headings: `text-3xl font-bold` (h2), `text-4xl` (h1)
- Body: `text-lg text-gray-600`
- Quote: `text-xl italic`

### Animations
- `RevealBlock`: fade + translate Y(50px→0), `duration: 0.7s`, triggered on viewport enter
- `RevealItem`: fade + translate Y(30px→0), `duration: 0.7s`, staggered delays
- CSR Gallery: modal overlay + keyboard navigation

---

## 5. Static Assets

```
Dashboard_Utama/public/assets/
├── kebun Sawit.webp      # Hero background
├── CSR_1.webp - CSR_5.webp  # Galeri CSR
└── (other assets)

Gateway serving:
- server.js serves /assets/* from Dashboard_Utama/public/assets/
- server.js serves /upah/assets/* from Dashboard_Utama/public/assets/
```

---

## 6. Routing & Navigation

| Route | File | Auth | Description |
|-------|------|------|-------------|
| `/` | `(landing-page)/page.tsx` | Public | Landing page |
| `/login` | `(login)/login/page.tsx` | Public | Login form |
| `/dashboard` | `(login)/dashboard/page.tsx` | Required | Dashboard user |
| `/dashboard-user` | `(login)/dashboard-user/page.tsx` | Required | Dashboard user alt |
| `/admin` | `(login)/admin/page.tsx` | Required | Admin panel |
| `/admin/executive` | `(login)/admin/executive/page.tsx` | Required | Executive view |
| `/report-center` | `(report-center)/... | Required | Report center |
| `/modules/inventory` | `(report-center)/modules/inventory/page.tsx` | Required | Inventory module |

---

## 7. Related Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Navbar` | `components/Navbar.tsx` | Top navigation |
| `HeroSection` | `components/HeroSection.tsx` | Hero banner |
| `SatelliteMap` | `components/SatelliteMapWrapper.tsx` | Peta satelit Belitung |
| `ModuleCard` | `components/dashboard/ModuleCard.tsx` | Kartu modul layanan |

---

## 8. Key Implementation Details

### Framer Motion Animations
```tsx
const reveal = {
  hidden: { opacity: 0, y: 50 },
  visible: { opacity: 1, y: 0 },
};
// Triggered once on viewport entry (once: true)
```

### CSR Gallery Lightbox
- State: `selectedGalleryIndex: number | null`
- Keyboard: Escape, ArrowLeft, ArrowRight
- Body overflow locked when modal open

### News Section
- Static data array `newsItems[]` — hardcoded, tidak fetch dari API
- External links open in new tab
- Images from CDN (pikiran-rakyat, tribunnews, setda.belitung.go.id)

---

## 9. Development Commands

```bash
# Run from Dashboard_Utama/
npm run dev          # Next.js dev server (port 3000)
npm run build        # Production build

# Run gateway (proxies to Dashboard)
npm run dev          # from root — starts server.js on port 3001
npm run build:dashboard  # build Next.js from root
```

---

## 10. Environment Variables

```
BACKEND_HOST=localhost          # Dev, or 223.25.98.220 (prod)
BACKEND_HOST_FALLBACK=localhost
NODE_ENV=development
PORT=3001                       # Gateway port
DASHBOARD_PORT=3100
```