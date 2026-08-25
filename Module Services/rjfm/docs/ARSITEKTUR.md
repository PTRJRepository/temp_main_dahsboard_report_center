# RJFM — Arsitektur & Internal Sistem

> Referensi teknis internal modul **RJFM (Rebinmas Jaya File Management)**.
> Untuk integrasi antar service lihat [GATEWAY.md](GATEWAY.md); untuk alur
> pemakaian sehari-hari lihat [PANDUAN-PENGGUNA.md](PANDUAN-PENGGUNA.md).

---

## 1. Bentuk Aplikasi: Monolith Satu Port

Satu proses Express TS di **port 8011** melayani API + UI sekaligus.
Tidak ada proses kedua yang wajib — modul hidup mandiri (`npm run dev`).

```
Browser / Service
      │
      ▼ :8011 (Express, src/server.ts)
┌───────────────────────────────────────────────────────────────┐
│ mountApiRewriter   /api/file/* → /api/v1/*   (app-level)      │
│ cors + json(2mb) + urlencoded                                 │
│ Health publik      /health · /health/live · /health/ready     │
│                    (juga di prefix /rjfm dan /file)           │
│ Route API          prefix '' , '/rjfm' , '/file' ×            │
│                    auth tasks assignments submissions files   │
│                    system drive meta gateway                  │
│ mountUi (async)    proxy → Next standalone di 127.0.0.1:8012  │
│ Catch-all 404      dipasang SETELAH UI siap                   │
│ Error handler      { status:'error', message }                │
└───────────────────────────────────────────────────────────────┘
```

Poin urutan yang penting:

* Rewriter `/api/file/*` dipasang **paling awal** karena `req.url` di
  middleware ter-scope hanya berisi suffix; `originalUrl` ikut di-rewrite agar
  fallback proxy UI tidak meneruskan path lama ke Next.
* UI dipasang **async** (`mountUi(app).then(...)`): catch-all 404 baru boleh
  ditambahkan setelah proxy UI siap, supaya urutan middleware benar
  (API → UI → 404).

### Peta path

| Path | Tujuan |
|---|---|
| `/api/v1/*`, `/api/auth/*` | Express API (auth JWT) |
| `/api/gateway/*` | Gateway NAS service-to-service (x-api-key) — lihat GATEWAY.md |
| `/api/file/*` | Di-rewrite internal menjadi `/api/v1/*` (dipakai UI Next) |
| `/file/*`, `/_next/static/*` | UI Next standalone (assetPrefix `/file`) |
| semua lainnya | Proxy ke server Next :8012; kalau build tak ada → 404 JSON |

### Penyajian UI (src/ui/serve.ts)

* Build standalone dicari di `ui-app/.next/standalone/Module Services/rjfm/ui-app`
  (path relatif repo root — akibat Turbopack root = repo root). Override via
  env `RJFM_UI_STANDALONE`.
* Statik: `.next/static` dilayani Express di `/file/_next/static` dan
  `/_next/static` (cache 365 hari immutable); `public/` di `/file`.
* Server Next standalone **mendengarkan sendiri** di port privat
  **8012** (`RJFM_UI_PORT`) pada `127.0.0.1` — tidak pernah memakai port 8011.
  `RJFM_API_PORT` dipin ke 8011 supaya route UI memanggil API monolith dengan
  base yang benar (default-nya menuruti `PORT`, yang di sini adalah port UI).
* Bila `server.js` standalone tidak ditemukan → UI dimatikan dengan pesan log,
  API tetap jalan.

---

## 2. Lapisan Data

Modul ini memakai **dua penyimpanan** secara bersamaan:

| Lapisan | Isi | Lokasi |
|---|---|---|
| **MSSQL** (`RJ_FileManagement`) | Skema resmi + `sp_ReviewSubmission` | `10.0.0.110:1433` (`src/config/db.ts`, pool maks 10 koneksi) |
| **JSON store** (`data/rjfm-demo.json`) | Working store runtime: users, categories, afdelings, tasks, assignments, revisions, drive, notifications | `RJFM_STORE_PATH` atau `<cwd>/data/rjfm-demo.json` (`src/lib/store.ts`) |

* Pool MSSQL dibuat lazy (`getPool()`) — bila DB mati, endpoint tetap
  berfungsi dari JSON store (mode demo). Contoh: login mencoba
  `extend_db_ptrj.user_ptrj` dulu, gagal → lanjut store demo.
* JSON store dimuat sekali ke memori, tiap mutasi langsung `save()` (tulis penuh).
* Seed pertama membuat data demo (lihat §4).

### Direktori user (`src/lib/directory.ts`)

Sumber user utama = tabel `user_ptrj` di database **`extend_db_ptrj`**.

* Login memakai **email** (`LOWER(email) = @email`), verifikasi bcrypt.
* Normalisasi role (`normRole`):

| Role mentah user_ptrj | role_code RJFM |
|---|---|
| ASISTEN | ASISTEN |
| MANAGER, MNGR | MANAGER |
| ADMIN, SUPERADMIN, GM_ESTATE | SUPERADMIN |
| lainnya (KERANI, MANDOR, …) | KERANI |

* `syncToStore()` meng-upsert user DB ke JSON store; password lokal demo
  **dipertahankan** saat sinkronisasi (hash dari DB selalu kosong).
* ID demo memakai rentang tinggi (9xxxx) agar tidak bentrok dengan ID asli
  `user_ptrj`.

---

## 3. Model Domain & Alur Status

```
Task ──dibuat──▶ Assignment (satu per kerani target)
                     │ current_status
                     ▼
        ASSIGNED ──submit──▶ SUBMITTED ──review(APPROVED)──▶ APPROVED (completed_at terisi)
                           │
                           └ review(REJECTED_NEEDS_REVISION)
                                  ▼
                          REVISION_NEEDED ──submit ulang──▶ SUBMITTED (revisi N+1)
```

Entitas utama (`src/lib/store.ts`):

* **Task**: kategori, judul, deskripsi, `allowed_mime_types`, `max_file_size_mb`,
  deadline, prioritas, `template_file_path`, pembuat.
* **Assignment**: task ↔ kerani + status + waktu.
* **Revision**: hasil submit kerani — nama asli/sistem, path storage,
  ukuran, MIME, **SHA-256**, catatan, status review, feedback manager.
  `revision_number` bertambah setiap submit ulang.
* **DriveItem**: pohon folder/berkas per user (owner), mendukung trash/star,
  metadata storage opsional (item demo tanpa berkas fisik). Setiap berkas
  membawa **jejak asal**: `source` (`upload` | `task_submission`),
  `task_title`, `submitter_name`, `submitted_at`, `notes`. Setiap submission
  tugas otomatis di-**mirror** ke folder "Tugas" milik kerani di Drive
  (dibuat bila belum ada) sehingga berkas tugas = berkas drive.
* **Notif**: channel `IN_APP` (ditampilkan) atau `WHATSAPP`
  (queued — pengirim eksternal Fonnte/Wablas, **di luar service ini**).

Status review per revisi: `PENDING → APPROVED | REJECTED_NEEDS_REVISION`.
Feedback wajib ≥10 karakter untuk penolakan (dijaga ganda: route + store).

---

## 4. Akun Demo (seed)

Dibuat otomatis saat `data/rjfm-demo.json` belum ada:

| Username | Password | Role |
|---|---|---|
| `manager` | `manager123` | MANAGER |
| `asisten` | `manager123` | ASISTEN |
| `kerani` | `kerani123` | KERANI (Afdeling 01) |
| `kerani_afd2` | `kerani123` | KERANI (Afdeling 02) |
| `admin_demo` | `admin123` | SUPERADMIN |

Kategori seed: LHP Harian Panen, Pemupukan & Agronomi, Restan TBS, Absensi &
Premi, Perawatan Unit/Traksi. Afdeling seed: AFD-01..03, PKS-01, TRAKSI.
Seed juga menyertakan contoh task/assignment/revisi tertolak + notifikasi.

> Ganti/hapus akun demo sebelum produksi; login produksi lewat
> `extend_db_ptrj.user_ptrj`.

---

## 5. Rantai Autentikasi (detail)

`src/middleware/auth.ts` — dipakai semua route bisnis:

1. Header `X-User-Id` ada → identitas dari gateway portal (portal sudah
   membersihkan header inbound palsu lalu menyuntikkan miliknya).
   Cek role bila route mensyaratkan.
2. `Authorization: Bearer <jwt>` → verifikasi HS256 (`JWT_SECRET`,
   masa aktif `JWT_EXPIRES_IN` default 12h).
3. Cookie `rjfm-token` → HS256 (diset oleh login untuk UI monolith;
   `Path=/; SameSite=Lax; Max-Age=12 jam`).
4. Cookie portal `auth-token` / `payroll_auth_token` → verifikasi **RS256**
   via authkit salinan lokal (`src/lib/authkit/`, kunci `keys/public.pem`
   repo root). Ini jalur direct-port bagi user yang sudah login portal utama.
5. Semua gagal → 401.

Role guard: parameter `auth(roles)`; konstanta
`MANAGER_ROLES = ['MANAGER','ASISTEN','SUPERADMIN','ADMIN','GM_ESTATE']`
untuk akses level atasan (review, meta admin, dsb.), dan
`TASK_CREATOR_ROLES = ['MANAGER','SUPERADMIN','ADMIN','GM_ESTATE']`
khusus untuk **pembuatan tugas** — kebijakan: hanya Manager/Admin/GM yang
boleh membuat penugasan; Asisten boleh review tetapi tidak membuat tugas.
Token portal bisa membawa role mentah seperti `GM_ESTATE` — karena itu masuk
kedua daftar.

Gateway NAS memakai rantai berbeda (`middleware/apikey.ts`):
`RJFM_API_KEY` kosong → 503 dinonaktifkan; header `x-api-key` atau
`Authorization: ApiKey <key>`; salah → 401.

---

## 6. Pipeline Ingesti Berkas

Berlaku seragam untuk submission tugas, upload drive, dan upload gateway:

```
multer memoryStorage (batas RJFM_MAX_FILE_MB)
  → sniffMime(buffer)         # magic bytes: %PDF, JPEG, PNG, GIF, RIFF/WEBP,
                              # MP4(ftyp), ZIP/OOXML, OLE/XLS, KML(XML)
  → validateUpload(nama,mime) # ekstensi wajib ada & cocok dgn isi;
                              # blokir exe/dll/bat/... (double-ext aman)
  → sanitizeFilename          # buang path/kontrol-char/titik depan, ≤180 char
  → saveBuffer                # sha256, nama sistem <ts>_<uuid8>_<aman><ext>,
                              # mkdir subfolder, tulis ke root storage
```

Root storage: folder dasar di NAS Synology via `RJFM_STORAGE_PATH`
(default `/IT/Extend Server Portal/RJFM`), diakses **HTTP FileStation API**
(`RJFM_NAS_URL` + `RJFM_NAS_USER`/`RJFM_NAS_PASS`) melalui klien `lib/nas.ts`
— bukan lagi SMB drive `Z:`. Setiap path relatif dinormalkan `nasFullPath()`
ke dalam folder dasar (anti-traversal).

Subfolder: `tasks/<task_id>/assign_<assignment_id>` · `drive/u<user_id>` ·
`gateway[/folder]`. Kompresi gambar (`sharp`) sengaja ditunda — aktifkan bila
foto lapangan >2 MB sering (catatan di `lib/storage.ts`).

Health storage: ping NAS (`nasPing`); kuota volume share tidak diekspos
FileStation, jadi angka kapasitas dilaporkan nol saat tidak diketahui.

Gotcha DSM yang sudah ditangani klien:
- Upload v2 memakai field form `path` (bukan `dest_folder_path`).
- Multipart dibangun manual sebagai Buffer — FormData/Blob Node mengirim
  chunked yang membuat DSM memotong isi berkas (byte NUL/biner hilang).
- Download sukses ditandai header `Content-Disposition`; tanpa itu berarti
  error JSON → diperlakukan 404.

---

## 7. Drive Pribadi (RJ Drive)

* Pohon per user (`owner_user_id`); folder & file adalah satu tabel item.
* Query list: `parent_id` (`root`/kosong → level atas), `q`, `trashed=1`,
  `starred=1`, `recent=1` (30 terbaru menurut `updated_at`).
* Kuota per user: kapasitas demo **2 GB** (`driveQuota`) — terpakai dihitung
  dari ukuran berkas non-trash.
* Stream `/:id/stream`: owner atau MANAGER_ROLES; item demo tanpa berkas fisik
  dirender sebagai placeholder teks `(demo)`.

## 8. Notifikasi

* `createTask` → per kerani target: 1 notif `IN_APP` + 1 `WHATSAPP` (queued).
* `review` REJECTED/APPROVED → notif `IN_APP` ke kerani pemilik assignment.
* Endpoint user: `GET /api/v1/notifications` (maks 50, channel IN_APP),
  `POST /api/v1/notifications/:id/read`.
* Pengirim WA eksternal (Fonnte/Wablas) membaca baris `channel='WHATSAPP'`
  dari luar service ini — modul hanya meng-queue.

---

## 9. Kontrak Isolasi Modul

Sesuai CLAUDE.md/AGENTS.md modul:

* Seluruh kode, build UI, data, log, `.env` berada di dalam
  `Module Services/rjfm/` — tidak ada file RJFM di luar folder ini.
* Dilarang impor dari modul lain maupun `Dashboard_Utama`; kode shared
  **disalin**, contoh nyata: `src/lib/authkit/` (salinan `shared/authkit`).
* Dependensi dideklarasikan sendiri di `package.json` modul
  (termasuk `proxy-gateway: file:../..`).
* UI wajib lewat 8011 (build standalone + proxy) — tidak menjalankan
  `next dev` terpisah, tidak membuat port kedua untuk publik.

## 10. Skrip Operasional (scripts/)

| Skrip | Fungsi |
|---|---|
| `gateway-tests.mjs` | Uji gateway NAS end-to-end: auth gagal/berhasil, upload/list/download/delete, traversal, proteksi delete, stats/tasks/revisions |
| `kerani-tests.mjs` | Alur bisnis lengkap: login 3 role, guard role, submit, magic-bytes (exe tersamar ditolak), loop revisi, review, kuota karakter feedback |
| `sanitize-tests.mjs` | Unit validasi/sanitasi berkas |
| `nas-probe.mjs` | Probe cepat NAS/storage |
| `smoke-db-link.mjs` | Cek konektivitas MSSQL |
| `check-ui.cjs`, `check-assets.cjs`, `check-css.cjs` | Sanity build/artefak UI |
| `check-cookie-upload.cjs`, `repro-forbidden.cjs`, `test-upload-per-kerani.cjs` | Repro/regresi isu auth cookie & izin submit per kerani |

Semua test butuh server hidup di :8011 dan `RJFM_API_KEY` terisi di `.env`
untuk bagian gateway.

---

*Dokumen menggambarkan working tree saat ditulis. Bila mengubah
`server.ts`, `store.ts`, `serve.ts`, `directory.ts`, atau pipeline berkas,
perbarui bagian terkait di sini.*
