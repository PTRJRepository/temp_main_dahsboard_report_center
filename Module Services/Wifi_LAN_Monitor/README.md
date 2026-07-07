# Paket PRD & Reference Design - Rebinmas Jaya Network Monitoring

Isi paket:

- `PRD_Sistem_Monitoring_WiFi_LAN.md` — Product Requirements Document lengkap.
- `reference-design/index.html` — Dashboard operasional table-first.
- `reference-design/cable-trace.html` — Layar inti pencarian IP/MAC/kabel dan evidence saat kabel dicabut.
- `reference-design/topology.html` — Topology & dependency view.
- `reference-design/inventory.html` — Inventory, port intelligence, dan cable plant.
- `reference-design/assets/styles.css` — Design system lokal.
- `reference-design/assets/app.js` — Interaksi prototype.

## Cara membuka reference design

Buka salah satu file `.html` dengan browser modern. Seluruh aset bersifat lokal, tidak membutuhkan internet atau backend.

## Karakter desain

- NOC console profesional dengan pendekatan **table-first** untuk pengguna yang bekerja lama dengan data padat.
- Tema **midnight navy / cobalt / cyan** dengan status kontras tinggi.
- Detail dibuka melalui side panel agar konteks dashboard atau tabel tidak hilang.
- Data contoh sengaja menunjukkan timestamp, sumber data, dan confidence supaya UI tidak menampilkan korelasi sebagai kepastian absolut.
