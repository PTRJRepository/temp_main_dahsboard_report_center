# RJFM — Dokumentasi Gateway & Integrasi Seluruh Sistem

> Modul: **RJFM (Rebinmas Jaya File Management)** — port **8011**
> Dokumen ini adalah referensi lengkap cara mengakses dan mengintegrasikan
> seluruh sistem modul RJFM melalui gateway. Ditulis berdasarkan kode aktual
> di `src/` (server.ts, routes/gateway.ts, middleware/, lib/storage.ts).

---

## Daftar Isi

1. [Ringkasan Arsitektur](#1-ringkasan-arsitektur)
2. [Dua Cara Menjangkau Modul](#2-dua-cara-menjangkau-modul)
3. [Autentikasi & Otorisasi](#3-autentikasi--otorisasi)
4. [Gateway NAS API (`/api/gateway/*`) — Service-to-Service](#4-gateway-nas-api)
5. [Aturan Berkas (Upload, Validasi, Penyimpanan)](#5-aturan-berkas)
6. [API Bisnis (`/api/v1/*`)](#6-api-bisnis-apiv1)
7. [Format Respons & Kode Error](#7-format-respons--kode-error)
8. [Konfigurasi (.env)](#8-konfigurasi-env)
9. [Resep Integrasi Antar Service](#9-resep-integrasi-antar-service)
10. [Pengujian](#10-pengujian)
11. [Troubleshooting / FAQ](#11-troubleshooting--faq)

---

## 1. Ringkasan Arsitektur

Kata "gateway" di ekosistem ini punya **dua lapis makna** — pahami dulu
sebelum integrasi:

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAPIS 1 — Gateway Portal (Bun, :3001)                               │
│  Reverse proxy monorepo. Verifikasi cookie RS256 portal SATU kali,  │
│  lalu meneruskan request ke modul dengan header identitas           │
│  X-User-Id / X-User-Name / X-User-Email / X-User-Role.              │
│  Route: /rjfm → http://localhost:8011  (routes-config.json)         │
├─────────────────────────────────────────────────────────────────────┤
│ LAPIS 2 — Gateway NAS RJFM (:8011/api/gateway/*)                    │
│  API service-to-service milik modul ini untuk akses berkas & data   │
│  dari service LAIN (bukan dari browser user).                       │
│  Auth: header x-api-key bernilai RJFM_API_KEY dari .env.            │
└─────────────────────────────────────────────────────────────────────┘
```

Modul RJFM sendiri adalah **monolith satu port**:

| Jalur | Isi |
|---|---|
| `/health`, `/health/live`, `/health/ready` | Health check (publik) |
| `/api/v1/*`, `/api/auth/*` | Express API bisnis (JWT) |
| `/api/gateway/*` | Gateway NAS (x-api-key) |
| `/api/file/*` | Rewrite internal → `/api/v1/*` (dipakai UI Next) |
| `/file`, `/_next/*` | UI RJ Drive (build standalone Next.js via proxy internal :8012) |

Semua route API dipasang pada **tiga prefix sekaligus**: langsung (`/api/...`),
`/rjfm/api/...`, dan `/file/api/...` — sehingga akses direct-port maupun lewat
proxy portal memakai handler yang sama.

---

## 2. Dua Cara Menjangkau Modul

| Mode | URL Dasar | Kapan Dipakai |
|---|---|---|
| **Direct** (mandiri) | `http://localhost:8011` | Akses langsung tanpa portal; modul jalan sendiri. |
| **Via gateway portal** | `http://localhost:3001/rjfm` | User sudah login portal utama; gateway menyuntik identitas. |

Contoh yang setara:

```bash
# Direct
curl http://localhost:8011/api/v1/tasks -H "Authorization: Bearer <jwt>"
# Via portal
curl http://localhost:3001/rjfm/api/v1/tasks -H "Cookie: auth-token=<cookie-portal>"
```

**Health check tersedia publik di kedua jalur** (tanpa auth), juga dengan prefix
`/rjfm` dan `/file`:

```
GET /health          → { status: 'Healthy', service: 'rjfm', time }
GET /health/live     → { ok: true, service: 'rjfm', time }
GET /health/ready    → { ok: true, service: 'rjfm', version: '1.0.0' }
```

Status semua route monorepo: `GET :3001/api/services/status`.

---

## 3. Autentikasi & Otorisasi

### 3.1 Matriks metode autentikasi

| Metode | Header/Cookie | Berlaku Untuk | Sumber |
|---|---|---|---|
| **API key** | `x-api-key: <RJFM_API_KEY>` atau `Authorization: ApiKey <key>` | `/api/gateway/*` saja | `.env` → `RJFM_API_KEY` |
| **JWT modul (HS256)** | `Authorization: Bearer <token>` | `/api/v1/*` | `POST /api/v1/auth/login` (masa aktif `JWT_EXPIRES_IN`, default 12 jam) |
| **Cookie modul** | `rjfm-token=<jwt>` | `/api/v1/*` (dipakai UI monolith) | Diset otomatis oleh login |
| **Header gateway portal** | `X-User-Id` + `X-User-Role` (+ Name/Email) | `/api/v1/*` HANYA saat request datang lewat proxy :3001 | Gateway portal setelah verifikasi cookie RS256 |
| **Cookie portal (RS256)** | `auth-token` / `payroll_auth_token` | `/api/v1/*` saat direct-port | Verifikasi `keys/public.pem` repo root |

Urutan pemeriksaan middleware `auth()` pada `/api/v1/*`:

1. Ada `X-User-Id` → percaya (gateway portal sudah membersihkan header inbound palsu).
2. `Authorization: Bearer <jwt>` → verifikasi HS256.
3. Cookie `rjfm-token` → verifikasi HS256.
4. Cookie portal `auth-token` / `payroll_auth_token` → verifikasi RS256 (authkit).
5. Tidak ada → **401 Unauthorized**.

> ⚠️ **Jangan pernah percaya header `X-User-*` mentah pada port 8011 langsung**
> dari luar — hanya legitim bila request benar-benar diteruskan gateway portal.

### 3.2 Role & hak akses

`MANAGER_ROLES = ['MANAGER', 'ASISTEN', 'SUPERADMIN', 'ADMIN', 'GM_ESTATE']`

| Aksi | KERANI | MANAGER_ROLES |
|---|---|---|
| Buat tugas (`POST /api/v1/tasks`) | ❌ 403 | ✅ |
| Lihat tugas/assignment | ✅ (miliknya) | ✅ (semua) |
| Submit berkas (`POST /api/v1/assignments/:id/submit`) | ✅ (assignment miliknya; manager juga boleh) | ✅ |
| Review (`POST /api/v1/submissions/:id/review`) | ❌ 403 | ✅ |
| Meta users / admin files / admin drive | ❌ 403 | ✅ |
| Drive RJ: stream berkas | ✅ (owner) | ✅ (semua berkas) |
| Gateway NAS (`/api/gateway/*`) | — (bukan konteks user; pakai API key) | — |

### 3.3 Login (mendapat JWT)

Sumber user utama: **MSSQL `extend_db_ptrj.user_ptrj`** (login pakai email);
fallback ke store demo JSON (`data/rjfm-demo.json`) saat DB tak terjangkau.

```bash
curl -X POST http://localhost:8011/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"nama@rebinmas.com","password":"rahasia"}'
```

Respons sukses:

```json
{
  "status": "success",
  "data": {
    "token": "<jwt-hs256>",
    "user": { "user_id": 1, "username": "nama@rebinmas.com", "role_code": "KERANI", "...": "..." },
    "mode": "mssql"
  }
}
```

`mode`: `"mssql"` (dari DB) atau `"demo"` (store lokal). Respons juga menyetel
cookie `rjfm-token` (Path=/, SameSite=Lax, usia 12 jam).

Cek identitas token: `GET /api/v1/auth/me` dengan `Authorization: Bearer <jwt>`.

---

## 4. Gateway NAS API

Seluruh endpoint di bawah ini **wajib API key**. Dipakai oleh service lain
(script ETL, scheduler, modul lain) — bukan oleh browser user.

Base URL: `http://localhost:8011/api/gateway` (atau `http://localhost:3001/rjfm/api/gateway`).

> Jika `RJFM_API_KEY` kosong di `.env`, SELURUH gateway mengembalikan
> **503** `{ "status": "error", "message": "Gateway dinonaktifkan ..." }`.
> Ini by-design: gateway mati kalau kunci belum diset.

### 4.1 Ringkasan endpoint

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/health` | Status gateway + kapasitas disk penyimpanan |
| GET | `/stats` | Statistik data & storage (jumlah tugas, assignment, revisi, drive item, berkas fisik, byte terpakai) |
| GET | `/files?prefix=&limit=` | Daftar berkas di storage (terbaru dulu) |
| GET | `/download?path=` | Unduh/stream berkas berdasarkan path relatif |
| POST | `/upload` | Unggah berkas (multipart field `file`, opsional field `folder`) |
| DELETE | `/file?path=` | Hapus permanen — **hanya di bawah folder `gateway/`** |
| GET | `/tasks` | Daftar tugas aktif + jumlah assignment/revisi |
| GET | `/revisions/:id/stream` | Stream berkas revisi submission berdasarkan ID revisi |
| GET | `/users` | Daftar user (tanpa hash password) |

### 4.2 Detail & contoh

#### GET /health

```bash
curl -H "x-api-key: $RJFM_API_KEY" http://localhost:8011/api/gateway/health
```

```json
{
  "status": "success",
  "service": "rjfm-gateway",
  "time": "2026-08-24T02:00:00.000Z",
  "storage": {
    "totalBytes": 536870912000,
    "freeBytes": 214748364800,
    "usedBytes": 322122547200,
    "freePercentage": 40,
    "isAlertNeeded": false
  }
}
```

`isAlertNeeded: true` saat ruang bebas < 15%.

#### GET /stats

Mengembalikan `data.tasks`, `data.assignments`, `data.revisions`,
`data.drive_items`, `data.users_synced`, `data.files_on_storage`,
`data.bytes_on_storage` plus blok `storage` sama seperti health.

#### GET /files

Query: `prefix` (filter awalan path relatif, mis. `gateway/blok-c`),
`limit` (default 200, maksimum 1000). Diurutkan `modified_at` terbaru dulu.

```bash
curl -H "x-api-key: $RJFM_API_KEY" \
  "http://localhost:8011/api/gateway/files?prefix=gateway&limit=50"
```

```json
{
  "status": "success",
  "total": 1,
  "data": [
    { "path": "gateway/blok-c/1756000000000_a1b2c3d4_blok-c9.kml",
      "size_bytes": 241, "modified_at": "2026-08-24T01:59:59.000Z" }
  ]
}
```

#### POST /upload

multipart/form-data:

| Field | Wajib | Ket.
|---|---|---|
| `file` | ✅ | Isi berkas. Batas `RJFM_MAX_FILE_MB` (default 10 MB) |
| `folder` | ➖ | Subfolder di bawah `gateway/`, mis. `blok-c`. Karakter tidak aman otomatis dirapikan; traversal ditolak |

Validasi yang dijalankan (lihat §5): magic bytes harus dikenali, ekstensi wajib
ada dan cocok dengan isi, ekstensi berbahaya diblokir.

```bash
curl -X POST http://localhost:8011/api/gateway/upload \
  -H "x-api-key: $RJFM_API_KEY" \
  -F "file=@peta-blok-c.kml" \
  -F "folder=blok-c"
```

Respons **201**:

```json
{
  "status": "success",
  "data": {
    "path": "gateway/blok-c/1756000000000_a1b2c3d4_peta-blok-c.kml",
    "size_bytes": 2413,
    "mime_type": "application/vnd.google-earth.kml+xml",
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  "download": "/api/gateway/download?path=gateway%2Fblok-c%2F1756000000000_a1b2c3d4_peta-blok-c.kml"
}
```

Simpan `data.path` — itulah kunci untuk download/delete berikutnya. Nama fisik
di storage diubah menjadi `<timestamp>_<uuid8>_<nama-aman><ext>`.

#### GET /download

```bash
curl -H "x-api-key: $RJFM_API_KEY" -o hasil.kml \
  "http://localhost:8011/api/gateway/download?path=gateway%2Fblok-c%2F1756000000000_a1b2c3d4_peta-blok-c.kml"
```

Error: 400 jika `path` kosong; 404 jika tidak ada. Path traversal seperti
`?path=../../Windows/win.ini` ditolak (400/404) oleh sanitasi + resolusi absolut.

#### DELETE /file

```bash
curl -X DELETE -H "x-api-key: $RJFM_API_KEY" \
  "http://localhost:8011/api/gateway/file?path=gateway%2Fblok-c%2F1756000000000_a1b2c3d4_peta-blok-c.kml"
```

* **403** bila path di luar `gateway/` — berkas submission (`tasks/**`) dan
  drive (`drive/**`) **tidak dapat dihapus** lewat API. Ini proteksi permanen.
* 400 `path` kosong · 404 tidak ditemukan · 200 `{ status:'success', deleted:'...' }`.

#### GET /tasks

Semua tugas `is_active` dengan hitungan `assignment_count` dan `revision_count`.

#### GET /revisions/:id/stream

Stream isi berkas revisi (hasil submit kerani) berdasarkan ID revisi —
Content-Type sesuai MIME tersimpan. Tanpa cek kepemilikan (konteks
service-to-service). 404 bila revisi tidak ada atau berkas fisik hilang.

#### GET /users

Daftar ringkas: `user_id`, `username`, `full_name`, `role_code`
(hash password dibuang).

---

## 5. Aturan Berkas

Berlaku untuk SEMUA jalur upload (gateway, assignment, drive):

### 5.1 Format diizinkan (divalidasi magic bytes, bukan sekadar nama)

| Kelompok | Format |
|---|---|
| Dokumen | PDF, DOC, DOCX, XLS, XLSX, CSV, TXT |
| Gambar | JPG/JPEG, PNG, GIF, WEBP |
| Video | MP4 (cek box `ftyp`), WEBM |
| GIS | KML (XML teks), KMZ (zip) |

### 5.2 Validasi berlapis

1. **Sniff magic bytes** — isi tidak dikenali → **415**.
2. **Ekstensi wajib ada** dan harus termasuk daftar aman untuk MIME hasil sniff
   (isi PDF dengan nama `.jpg` → **415**).
3. **Ekstensi berbahaya diblokir** walau isinya disamarkan:
   `exe dll bat cmd com scr pif msi sh bash ps1 vbs js mjs jar hta cpl msc reg lnk iso img vhd apk app deb rpm` → **415**.
4. **Ukuran maksimum** `RJFM_MAX_FILE_MB` MB → **413**.
5. **Sanitasi nama**: komponen path dibuang, karakter kontrol/ilegal Windows
   dihapus, titik depan dibuang, maksimal 180 char.

### 5.3 Tata letak penyimpanan

Root: `RJFM_STORAGE_PATH` (default `D:/RJFM_Storage/uploads`) — isolat di luar webroot.

```
<RJFM_STORAGE_PATH>/
├── tasks/<task_id>/assign_<assignment_id>/<timestamp>_<uuid>_<nama>   # submission kerani
├── drive/u<user_id>/<timestamp>_<uuid>_<nama>                          # RJ Drive per user
└── gateway/[<folder>/]<timestamp>_<uuid>_<nama>                        # unggahan service lain
```

Setiap berkas dicatat SHA-256. Setiap operasi path melewati proteksi traversal:
path relatif diselesaikan absolut dan **wajib tetap di dalam root storage**.

---

## 6. API Bisnis (`/api/v1`)

Dipakai UI dan client user. Auth sesuai §3.1 (JWT/cookie/header gateway).
Alias lama tanpa `/v1` (`/api/tasks`, dst.) dan prefix `/rjfm`+`/file`
tetap terpasang. UI Next memanggil via `/api/file/*` yang di-rewrite internal
ke `/api/v1/*`.

| Method | Endpoint | Role | Catatan |
|---|---|---|---|
| POST | `/api/v1/auth/login` | publik | body `{username(email), password}` |
| GET | `/api/v1/auth/me` | apa pun (Bearer) | identitas token |
| POST | `/api/v1/tasks` | **Manager/Admin/GM saja** (`TASK_CREATOR_ROLES`) | body: `title`, `description`, `target_kerani_ids[]` wajib; opsional `category_id`, `deadline` (default hari ini 17:00), `priority`, `allowed_types[]`, `max_file_size_mb`, `template_file_path`. Asisten & Kerani → 403 |
| GET | `/api/v1/tasks` | semua | daftar sesuai role |
| GET | `/api/v1/tasks/:id` | semua | detail; 404 bila tiada |
| GET | `/api/v1/assignments` | semua | daftar sesuai role |
| GET | `/api/v1/assignments/:id` | pemilik/Manager+ | pack assignment |
| POST | `/api/v1/assignments/:id/submit` | KERANI (pemilik) / Manager+ | multipart `file` + opsional `notes`; simpan ke `tasks/<task_id>/assign_<id>` |
| POST | `/api/v1/submissions/:id/review` | Manager+ | body `{review_status, manager_feedback}`; `review_status ∈ {APPROVED, REJECTED_NEEDS_REVISION}`; REJECTED wajib feedback ≥10 char → else **422 FEEDBACK_MANDATORY_REQUIRED** |
| GET | `/api/v1/files/:id/stream` | pemilik/Manager+ | stream berkas revisi `:id` |
| GET | `/api/v1/drive` | semua | query: `parent_id`(root/kosong/angka), `q`, `trashed=1`, `starred=1`, `recent=1`; respons + `quota` |
| POST | `/api/v1/drive/folders` | semua | body `{name, parent_id?}` |
| POST | `/api/v1/drive/upload` | semua | multipart `file`, `parent_id` |
| PATCH | `/api/v1/drive/:id` | owner/Manager+ | ubah `name`/`parent_id`/`trashed`/`starred` |
| GET | `/api/v1/drive/:id/stream` | owner/Manager+ | stream berkas drive |
| GET | `/api/v1/system/storage-health` | semua | kapasitas disk + kuota drive user |
| GET | `/api/v1/system/health` | publik | status DB (`Healthy`/`Degraded`) |
| GET | `/api/v1/categories` · `/afdelings` | semua | meta |
| GET | `/api/v1/users` | Manager+ | dari `extend_db_ptrj.user_ptrj`; fallback demo |
| GET | `/api/v1/notifications` | semua | notifikasi user |
| POST | `/api/v1/notifications/:id/read` | semua | tandai dibaca |
| GET | `/api/v1/admin/files` · `/admin/drive` | Manager+ | rekap semua berkas |

Alur kerja inti (loop revisi wajib):

```
Manager/Admin/GM buat tugas ──▶ assignment otomatis per kerani target
      Kerani submit berkas ──▶ revisi baru (SUBMITTED)
                              + MIRROR OTOMATIS ke Drive kerani:
                                folder "Tugas" → item berkas dengan metadata
                                source=task_submission, task_title,
                                submitter_name, submitted_at, notes
      Manager/Asisten review ── APPROVED ▶ selesai
                     └─ REJECTED_NEEDS_REVISION (feedback ≥10 char)
                              └─▶ kerani submit ulang → revisi bertambah
```

Metadata jejak asal berkas pada Drive (`GET /api/v1/drive`): field `source`,
`task_title`, `submitter_name`, `submitted_at`, `notes` terisi untuk berkas
hasil tugas; upload manual memakai `source='upload'`.

---

## 7. Format Respons & Kode Error

Seluruh API memakai amplop seragam:

```json
{ "status": "success", "data": { ... } }        // sukses
{ "status": "error",   "message": "...", "code": "..." }  // gagal
```

| HTTP | Arti khas di modul ini |
|---|---|
| 400 | Body/query kurang, atau path storage tidak valid |
| 401 | Tanpa/tidak validnya API key atau token |
| 403 | Role tidak cukup; delete di luar `gateway/`; bukan pemilik berkas |
| 404 | Data/berkas tidak ada (termasuk traversal yang gagal) |
| 413 | Ukuran berkas > `RJFM_MAX_FILE_MB` |
| 415 | Isi tidak dikenali / ekstensi ≠ isi / ekstensi terlarang |
| 422 | Review REJECTED tanpa feedback ≥10 karakter (`FEEDBACK_MANDATORY_REQUIRED`) |
| 500 | Kesalahan internal |
| 503 | `RJFM_API_KEY` belum diset → gateway NAS dinonaktifkan |

---

## 8. Konfigurasi (.env)

Salin `.env.example` → `.env`. Variabel yang relevan untuk gateway/integrasi:

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | `8011` | Port monolith |
| `RJFM_API_KEY` | *(kosong)* | **Wajib diisi** agar `/api/gateway/*` hidup; kosong = 503 |
| `RJFM_STORAGE_PATH` | `D:/RJFM_Storage/uploads` | Root penyimpanan terisolasi |
| `RJFM_MAX_FILE_MB` | `10` | Batas ukuran unggahan |
| `MSSQL_HOST/PORT/USER/PASSWORD/DATABASE` | `10.0.0.110:1433 sa … RJ_FileManagement` | DB modul; login user tetap dari `extend_db_ptrj` |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | dev secret, `12h` | Token HS256 modul |
| `CORS_ORIGIN` | `http://localhost:3001` | Origin UI portal |
| `RJFM_UI_PORT` | `8012` | Port internal UI standalone (jangan diekspos) |

Rotasi kunci: ubah `RJFM_API_KEY` di `.env` lalu restart modul, dan perbarui
nilai di semua service pemakai.

---

## 9. Resep Integrasi Antar Service

Service lain (Node/Bun) yang ingin menyimpan/mengambil berkas ke RJFM:

```js
// 1) Upload berkas ke folder gateway/laporan/
const fd = new FormData()
fd.append('file', new Blob([bytes], { type: 'application/pdf' }), 'laporan-agustus.pdf')
fd.append('folder', 'laporan')

const up = await fetch('http://localhost:8011/api/gateway/upload', {
  method: 'POST',
  headers: { 'x-api-key': process.env.RJFM_API_KEY }, // JANGAN set Content-Type manual
  body: fd,
})
const { data } = await up.json()          // simpan data.path + sha256

// 2) Download kembali
const dl = await fetch(
  `http://localhost:8011/api/gateway/download?path=${encodeURIComponent(data.path)}`,
  { headers: { 'x-api-key': process.env.RJFM_API_KEY } },
)

// 3) Hapus (hanya berhasil untuk path di bawah gateway/)
await fetch(`http://localhost:8011/api/gateway/file?path=${encodeURIComponent(data.path)}`,
  { method: 'DELETE', headers: { 'x-api-key': process.env.RJFM_API_KEY } })
```

Praktik yang disarankan:

* Simpan `data.path` dan `sha256` dari respons upload; jangan pernah menyusun
  path sendiri.
* Perlakukan `RJFM_API_KEY` sebagai rahasia (env var, jangan hard-code).
* Panggilan bersamaan aman — tapi tetap batasi paralelisme untuk unggahan besar.
* Untuk berkas milik alur tugas (submission), jangan akses lewat filesystem;
  pakai `/api/gateway/revisions/:id/stream` atau `/api/v1/files/:id/stream`.

---

## 10. Pengujian

Server harus hidup di :8011 (`npm run dev`). `.env` harus punya `RJFM_API_KEY`
yang sama dengan yang dipakai script uji.

```bash
node scripts/gateway-tests.mjs    # health, auth gagal, upload/list/download/delete,
                                  # traversal, proteksi delete, stats/tasks/revisions
node scripts/kerani-tests.mjs     # alur bisnis kerani
node scripts/sanitize-tests.mjs   # validasi/sanitasi berkas
```

Uji cepat manual:

```bash
# harus 401
curl -i http://localhost:8011/api/gateway/health
# harus 200 + info storage
curl -i -H "x-api-key: $RJFM_API_KEY" http://localhost:8011/api/gateway/health
```

---

## 11. Troubleshooting / FAQ

| Gejala | Sebab & Solusi |
|---|---|
| Semua `/api/gateway/*` → 503 "Gateway dinonaktifkan" | `RJFM_API_KEY` kosong di `.env`. Isi lalu restart. |
| 401 "API key required/tidak valid" | Header `x-api-key` hilang/beda nilai dengan server. Pastikan env service pengirim sama. |
| Upload 415 | Isi vs ekstensi tidak cocok, format tak dikenali, atau ekstensi terlarang. Cek §5. |
| Upload 413 | Melebihi `RJFM_MAX_FILE_MB`. Naikkan env bila memang perlu. |
| Delete 403 | Path di luar `gateway/`. Proteksi permanen — hapus hanya via mekanisme modul. |
| 404 saat download padahal baris data ada | Berkas fisik hilang dari storage (mis. storage dipindah). Cocokkan `RJFM_STORAGE_PATH`. |
| Direct :8011 401 padahal sudah login portal | Direct-port perlu cookie `rjfm-token`/portal valid atau Bearer JWT; header `X-User-*` hanya sah via proxy :3001. |
| UI blank di :8011 | Build standalone belum ada — build UI (`ui-app`) agar `mountUi` aktif. |
| Port 3001 zombie (monorepo) | Jalankan gateway portal di `PORT=3002` dan arahkan client ke situ. |

---

*Dokumen ini menggambarkan kode pada folder modul ini. Bila mengubah
`routes/gateway.ts`, `middleware/apikey.ts`, atau `lib/storage.ts`,
perbarui dokumen ini di tempat yang sama.*
