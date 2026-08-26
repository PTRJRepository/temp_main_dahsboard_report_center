# Setup Guide — Fresh Machine Installation

Panduan instalasi dari nol di komputer baru (fokus **Windows**, karena seluruh
tooling gateway/launcher berbasis Windows + PowerShell). Ikuti urutannya —
setiap langkah ada langkah verifikasinya.

> Dokumen terkait: [MONOREPO.md](./MONOREPO.md) (rulebook arsitektur modul),
> `docs/05-configuration.md` (detail konfigurasi/Firebird),
> [README.md](../README.md) (ringkasan proyek).

---

## 0. Ringkasan apa yang akan dipasang

| Komponen | Keterangan |
|---|---|
| Git + Git Bash | clone repo, shell script |
| Node.js ≥ 20 | Next.js portal, modul-modul (terverifikasi jalan di v22) |
| Bun ≥ 1.3 | gateway aktif (`server_bun.js`) & beberapa modul |
| npm | installer workspaces |
| OpenSSL | membuat kunci JWT (sudah ikut di Git for Windows) |
| *(Opsional)* MSSQL client access | sumber data laporan (`extend_db_ptrj`, `db_ptrj`, `db_ptrj_mill`) |
| *(Opsional)* Firebird 1.5 + `isql.exe` | Query Gateway analytics lokal (PTRJ_ARC.FDB) |

Port yang akan dipakai (pastikan tidak bentrok):

| Port | Layanan |
|------|---------|
| 3001 | Gateway (Bun) |
| 3100 | Portal / Dashboard_Utama (Next.js standalone) |
| 3101 | report-center |
| 3102 | rebinmas-jaya-server (server-monitor) |
| 3104 | daftar-upah |
| 8001 | sql-gateway |
| 8003 | ifess-server |
| 8011 | rjfm (API + UI; internal UI :8012) |

---

## 1. Pasang prasyarat

### 1.1 Git for Windows
Unduh dari <https://git-scm.com/download/win>, instal dengan opsi default
(ini sekaligus menyediakan **Git Bash** dan **openssl**).

Verifikasi (buka Git Bash):
```bash
git --version    # >= 2.40
openssl version  # boleh versi berapa saja
```

### 1.2 Node.js 20+
Unduh LTS dari <https://nodejs.org> (atau pakai `winget install OpenJS.NodeJS.LTS`).

```bash
node --version   # v20 ke atas (repo ini diverifikasi di v22.14.0)
npm --version
```

### 1.3 Bun
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```
Tutup dan buka ulang terminal, lalu:
```bash
bun --version    # >= 1.3
```

### 1.4 (Opsional) Akses database
- **MSSQL**: pastikan komputer bisa menjangkau server MSSQL kantor (network/VPN).
- **Firebird**: hanya untuk fitur analytics iFESS lokal. Butuh `isql.exe` (dari
  instalasi Firebird 1.5) dan file DB `PTRJ_ARC.FDB`. Lokasi DB/isql diset lewat
  env — lihat `docs/05-configuration.md`. Tanpa ini, semua layanan lain tetap jalan.

---

## 2. Clone repository

```bash
cd /d/
git clone git@github.com:PTRJRepository/temp_main_dahsboard_report_center.git "Gawean Rebinmas/Main Dashboard"
cd "/d/Gawean Rebinmas/Main Dashboard"

# Pastikan Anda di branch yang benar (main untuk produksi)
git checkout main
```

> SSH ke GitHub harus sudah dikonfigurasi (`ssh-keygen` + tambahkan pubkey ke
> GitHub), atau pakai HTTPS remote. Verifikasi: `ssh -T git@github.com`.

---

## 3. Buat kunci di `keys/` (WAJIB — folder ini sengaja tidak ikut git)

Folder `keys/` berisi rahasia sehingga **tidak ada di GitHub**. Di komputer baru
Anda HARUS membuatnya ulang:

```bash
mkdir -p keys

# 1) Pasangan kunci RS256 untuk cookie auth (auth-token)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out keys/private.pem
openssl rsa -pubout -in keys/private.pem -out keys/public.pem

# 2) Access key report-center (teks bebas, min. 16 karakter acak)
openssl rand -hex 24 > keys/report-center-access.key

# 3) SSL key self-signed (opsional — hanya jika menjalankan endpoint https lokal)
openssl req -x509 -newkey rsa:2048 -nodes -keyout keys/ssl.key -out keys/ssl.crt \
  -days 3650 -subj "//CN=localhost"
```

Verifikasi:
```bash
ls keys/
# private.pem  public.pem  report-center-access.key  [ssl.key]
openssl rsa -in keys/private.pem -check -noout   # harus: "RSA key ok"
```

> ⚠️ Token login yang diterbitkan komputer lama TIDAK berlaku lagi di komputer
> baru (kunci beda) — semua user tinggal login ulang. Itu normal.
>
> ⚠️ Jangan pernah commit folder `keys/`. Rotasi = timpa file, semua sesi lama
> otomatis invalid.

---

## 4. Siapkan file `.env`

Semua template sudah di-repo sebagai `*.example`. Salin yang dibutuhkan:

```bash
# Root (gateway): .env.example -> .env
cp .env.example .env

# Portal (Dashboard_Utama): .env.local.example -> .env.local
cp Dashboard_Utama/.env.local.example Dashboard_Utama/.env.local

# Modul yang punya template (contoh ifess-server)
cp "Module Services/ifess-server/.env.example" "Module Services/ifess-server/.env"
```

Lalu isi nilai nyata di masing-masing file (cari komentar `Replace with your actual`):

| File | Variabel penting | Isi dengan |
|---|---|---|
| `.env` | `JWT_PRIVATE_KEY_PATH`, `JWT_PUBLIC_KEY_PATH` | biarkan default `./keys/*.pem` |
| `.env` | `IFESS_API_KEY`, `QUERY_API_KEY` | API key internal (minta ke admin / komputer lama) |
| `.env` | `NEXTAUTH_SECRET`, `AUTH_SECRET` | string acak (`openssl rand -hex 32`) |
| `Dashboard_Utama/.env.local` | `SQL_GATEWAY_URL`, `SQL_GATEWAY_API_KEY` | alamat + key SQL Gateway kantor |
| `Dashboard_Utama/.env.local` | `LOCAL_LLM_BASE_URL`, `LOCAL_LLM_MODEL`, `LOCAL_LLM_API_KEY` | hanya jika mau fitur AI Insight |
| `"Module Services/ifess-server/.env"` | `IFESS_PORT=8003` | default sudah benar |

> Cara paling cepat & akurat menyalin nilai rahasia: buka `.env` / `.env.local`
> di **komputer lama** dan salin manual nilainya (folder env tidak ikut git).

---

## 5. Install dependencies + symlink node_modules

Repo ini adalah **npm workspaces** (`Dashboard_Utama` + `Module Services/*`),
jadi satu kali install di root sudah meng-cover semuanya:

```bash
cd "/d/Gawean Rebinmas/Main Dashboard"
npm install
```

Kemudian buat symlink `Module Services/node_modules -> Dashboard_Utama/node_modules`
(wajib agar import `@modules/*` antar-folder jalan — symlink ini gitignored dan
harus dibuat ulang tiap mesin):

```bash
cd "Module Services"
rm -rf node_modules 2>/dev/null
node -e "require('fs').symlinkSync('../Dashboard_Utama/node_modules','node_modules','dir')"
```

> **Windows**: pembuatan symlink butuh **Developer Mode aktif**
> (Settings → Privacy & Security → For developers → Developer Mode ON) atau
> jalankan terminal sebagai Administrator. Tanpa ini build modul akan gagal
> resolve `@modules/*`.
>
> Gotcha terdokumentasi: Turbopack `resolveAlias` untuk path out-of-root rusak
> bila symlink ini hilang — JANGAN coba workaround lain, cukup buat symlink.

---

## 6. Build portal (sekali, sebelum mode produksi)

```bash
cd "/d/Gawean Rebinmas/Main Dashboard"
npm run build:dashboard        # = next build di Dashboard_Utama (standalone output)
```

Setelah build, sinkronkan aset statis ke output standalone (wajib — tanpa ini
portal hidup tapi CSS/JS 404):

```powershell
Copy-Item -Recurse -Force Dashboard_Utama\.next\static Dashboard_Utama\.next\standalone\Dashboard_Utama\.next\static
Copy-Item -Recurse -Force Dashboard_Utama\public Dashboard_Utama\.next\standalone\Dashboard_Utama\public
```

(Launcher `-IncludeDashboard` pada langkah 7 juga melakukan ini otomatis.)

---

## 7. Menjalankan

### 7a. Semua module services sekaligus (cara baku)

```bash
npm run status:modules     # lihat kondisi RUNNING/DOWN
npm run start:modules      # prod semua modul (build otomatis bila perlu)
# npm run dev:modules      # atau mode dev/HMR
# npm run stop:modules     # matikan semua (gateway :3001 tidak disentuh)
```

Log per modul: `logs/modules/`, PID tracking: `logs/modules/module-pids.json`.

### 7b. Gateway + portal

```bash
npm run start          # prod: gateway :3001 + spawn portal :3100
# npm run dev          # dev (HMR)
# npm run dev:gateway  # gateway SAJA tanpa portal/dashboard/modul
```

Syarat: port 3100 harus KOSONG saat gateway start, kalau tidak gateway menganggap
portal sudah jalan dan tidak men-spawn (cek `status:modules`, restart dengan
`start-module-services.ps1 -IncludeDashboard` bila perlu).

### 7c. Modul tunggal (tanpa sisanya)

```bash
cd "Module Services/report-center" && bun start        # :3101
cd "Module Services/rebinmas-jaya-server" && npm run dev  # :3102
cd "Module Services/rjfm" && npx tsx src/server.ts      # :8011
cd "Module Services/daftar-upah" && npm start           # :3104
cd "Module Services/ifess-server" && bun start          # :8003 (lihat README modulnya)
```

### 7d. LAN access

Portal/gateway dev bind `0.0.0.0` via `npm run dev:lan`. Akses dari komputer
lain: `http://<ip-komputer-ini>:3001` (LAN **tidak** lewat `localhost:3001`).

---

## 8. Verifikasi akhir

Dari browser / curl di mesin yang sama:

```bash
curl http://localhost:3001/api/ifess/health       # -> {"status":"ok",...}
curl http://localhost:3001/api/services/status    # tabel status semua layanan
```

Cek manual:
1. `http://localhost:3001` — landing portal muncul (CSS termuat = symlink & static sync benar).
2. Login portal dengan akun MSSQL (`extend_db_ptrj`) — berhasil = kunci JWT benar.
3. `http://localhost:3001/report-center` — login pakai isi `keys/report-center-access.key`.
4. (Opsional, butuh Firebird) `http://localhost:3001/ifess-control/app` — buka tab
   Tables, harus muncul 183 tabel PTRJ_ARC.
5. `npm run status:modules` — semua modul yang diinginkan bertanda RUNNING.

Selesai — komputer siap dipakai develop maupun deploy.

---

## Troubleshooting (masalah paling sering)

| Gejala | Penyebab | Solusi |
|---|---|---|
| Port 3001 "access denied" saat start gateway | proses `bun.exe` zombie milik sesi lain memegang 3001 | jalankan gateway di port lain: `PORT=3002 START_DASHBOARD=false bun run server_bun.js`, arahkan browser ke :3002 |
| Build modul gagal resolve `@modules/*` | symlink `Module Services/node_modules` belum dibuat / hilang | ulangi langkah 5 (butuh Developer Mode Windows) |
| Portal hidup tapi CSS/JS 404 | `.next/static` belum tersalin ke `.next/standalone` | ulangi salinan di langkah 6, atau restart via `-IncludeDashboard` |
| Landing mati sendiri padahal tadi jalan | ada proses lama menduduki :3100 saat gateway start → portal tidak di-spawn | `npm run stop:modules`, matikan proses penumpang :3100, start ulang |
| Query Firebird timeout / ETIMEDOUT | Firebird 1.5 single-threaded; query paralel antre & cascade-timeout | jalankan ulang query satu-satu; hindari COUNT DISTINCT lintas-tabel scanner (lihat CLAUDE.md) |
| Login portal gagal semua user | `keys/*.pem` tidak cocok / belum dibuat | ulangi langkah 3, restart gateway |
| `isql` false-timeout saat testing | jangan pakai `spawnSync` + `timeout` di bawah Bun | biarkan `execFileSync` seperti implementasi sekarang |
