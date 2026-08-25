# RJFM — Panduan Pengguna (Manager, Asisten, Kerani)

> Cara memakai aplikasi RJFM sehari-hari lewat UI. Untuk API/integrasi lihat
> [GATEWAY.md](GATEWAY.md); untuk arsitektur internal lihat
> [ARSITEKTUR.md](ARSITEKTUR.md).

---

## 1. Masuk Aplikasi

| Cara | URL |
|---|---|
| Langsung (port modul) | `http://localhost:8011/file/login` |
| Lewat portal utama | `http://localhost:3001/rjfm/file/login` |

* Login memakai **email + password** akun Anda di direktori karyawan
  (`extend_db_ptrj.user_ptrj`). Bila server DB sedang tidak terjangkau,
  aplikasi otomatis memakai mode demo.
* Sudah login di portal utama? Membuka `:3001/rjfm` langsung dikenali —
  tidak perlu login ulang.

### Akun demo (hanya saat mode demo)

| Email/Username | Password | Peran |
|---|---|---|
| `manager` | `manager123` | Manager |
| `asisten` | `manager123` | Asisten |
| `kerani` | `kerani123` | Kerani Afdeling 01 |
| `kerani_afd2` | `kerani123` | Kerani Afdeling 02 |
| `admin_demo` | `admin123` | Superadmin IT |

Setelah login Anda dibawa ke **Beranda** (`/file/home`). Menu samping menyesuaikan peran.

---

## 2. Alur Kerja Inti

```
MANAGER/ASISTEN                     KERANI
────────────────                    ──────
Buat Tugas ──▶ assignment per       menerima notifikasi
(pilih kerani) kerani target        "Tugas baru"
      │                                │
      │                        Tugas Saya → buka tugas
      │                        upload berkas + catatan
      │                                │
Review Berkas ◀──────────  status SUBMITTED
APPROVED          REJECTED_NEEDS_REVISION
(selesai)              │ feedback ≥10 karakter
                       ▼
                notifikasi "Perlu Revisi"
                kerani submit ulang → revisi N+1
```

Aturan penting:

* **Penolakan wajib memberi instruksi revisi minimal 10 karakter** — sistem
  menolak (422) bila kosong/terlalu pendek, agar kerani tahu letak perbaikan.
* Setiap submit ulang membuat **revisi baru** (`revision_number` bertambah);
  riwayat lengkap tersimpan dan bisa dibuka kembali.
* Berkas divalidasi isi (magic bytes), bukan sekadar nama: PDF, Word, Excel,
  foto (JPG/PNG/GIF/WEBP), video MP4/WEBM, KML/KMZ, CSV/TXT.
  Ekstensi berbahaya (.exe/.bat/…) ditolak walau isinya disamarkan.

---

## 3. Menu untuk KERANI

Sidebar: **Beranda · Tugas Saya · Drive Saya · Terbaru · Berbintang · Sampah**

### 3.1 Tugas Saya (`/file/tasks`)
* Daftar tugas yang ditugaskan ke Anda, lengkap dengan status
  (ASSIGNED / SUBMITTED / REVISION_NEEDED / APPROVED) dan deadline.
* Buka detail assignment → unggah berkas (+ catatan opsional).
* Jika status **REVISION_NEEDED**, baca feedback manager pada revisi terakhir,
  perbaiki, lalu submit ulang dari halaman yang sama.
* Batas ukuran & format mengikuti pengaturan tiap tugas (default 10 MB).

### 3.2 Drive Saya (`/file/drive`)
Penyimpanan pribadi (kuota tampil di halaman):

* Buat folder, unggah berkas ke folder mana pun — bisa **tarik & lepas**.
* Berkas hasil pengumpulan tugas **otomatis masuk folder "Tugas"** lengkap
  dengan badge jejak: judul tugas asal, nama pengirim, waktu kirim, dan
  catatan yang dituliskan kerani saat submit. Ada tombol "Buka tugas" untuk
  melompat ke detail assignment-nya.
* Tandai **berbintang** untuk akses cepat; hapus berkas masuk **Sampah**
  (bisa dipulihkan dari sana).
* **Terbaru** menampilkan 30 item terakhir yang berubah.

---

## 4. Menu untuk MANAGER / ASISTEN (dan ADMIN/SUPERADMIN)

Sidebar: **Beranda · Buat Tugas · Tugas · Review Berkas · Semua Berkas · Drive Saya**

### 4.1 Buat Tugas (`/file/manage`)
> Khusus **Manager, Admin, dan GM** — Asisten & Kerani tidak melihat menu ini
> dan API akan menolak (403).

1. Isi judul & deskripsi instruksi yang jelas.
2. Pilih kategori (LHP Panen, Restan, Absensi, dst.) — bila dikosongkan dipakai
   kategori pertama.
3. Pilih satu atau banyak **kerani tujuan**.
4. Deadline default **hari ini pukul 17.00** — ubah bila perlu; prioritas
   default MEDIUM (HIGH/URGENT untuk mendesak).
5. Opsional: batasi format berkas & ukuran maksimum untuk tugas ini.
6. Simpan → setiap kerani tujuan otomatis mendapat assignment + notifikasi
   (in-app; baris WhatsApp ikut dibuat untuk dikirim oleh gateway WA eksternal).

### 4.2 Review Berkas (`/file/review`)
Halaman ini berbasis **klik, bukan scroll panjang**:

1. **Pilih kerani** — chip di atas menampilkan semua kerani dengan badge
   jumlah submission yang menunggu review. Klik satu nama.
2. **Pilih filter status** — Perlu Review / Disetujui / Direvisi / Semua.
3. **Klik tugas** di daftar kiri → panel review terbuka di kanan:
   riwayat revisi (v1, v2, …), pratinjau berkas, catatan kerani, dan tombol
   **Setujui** atau **Minta Revisi** (instruksi ≥10 karakter).

* Setiap revisi menampilkan siapa pengirimnya, kapan dikirim, dan catatannya.
* Putusan APPROVED — tugas selesai, kerani dapat notifikasi persetujuan.
* REJECTED_NEEDS_REVISION — kerani dapat notifikasi dan assignment kembali
  berstatus REVISION_NEEDED untuk diperbaiki.

### 4.3 Tugas (`/file/tasks`) & Semua Berkas (`/file/files`)
* Tugas: pantau semua assignment lintas kerani beserta statusnya.
* Semua Berkas: rekap seluruh berkas revisi (nama, ukuran, SHA-256, status
  review, kerani pengunggah) untuk audit.

---

## 5. Notifikasi

Ikon lonceng di shell aplikasi menampilkan notifikasi in-app (maks 50):
tugas baru, hasil review, permintaan revisi. Klik untuk menandai dibaca.
Notifikasi WhatsApp di-queue oleh modul dan dikirim oleh layanan WA eksternal.

---

## 6. Pertanyaan Cepat (FAQ)

| Situasi | Penjelasan |
|---|---|
| Upload ditolak "Format tidak dikenali" | Isi berkas bukan format yang didukung, atau ekstensi tidak cocok dengan isi (mis. JPG berisi PDF). Ganti/periksa berkas. |
| Upload ditolak melebihi ukuran | Melewati batas tugas/global (default 10 MB). Kompres atau minta manager menaikkan batas tugas. |
| Tidak bisa membuka assignment orang lain | Memang diproteksi — hanya pemilik assignment dan role atasan. |
| Review ditolak saat menyimpan tanpa feedback | Wajib tulis instruksi revisi minimal 10 karakter. |
| Login gagal padahal password benar | Pastikan email sesuai user_ptrj; saat DB down hanya akun demo yang aktif. |
| Berkas submission hilang dari pratinjau | Berkas fisik tidak ada di storage server; hubungi admin (data metadata tetap utuh). |

---

*Dokumen mengikuti perilaku UI saat ini (menu `/file/*`). Perubahan menu atau
aturan validasi harap disinkronkan ke sini.*
