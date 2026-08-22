# Module Context — rjfm (WAJIB dibaca agent sebelum mengubah apa pun)

> **ATURAN EMAS — JANGAN DILANGGAR:**
> Modul ini **100% terisolasi dan mandiri**. Semua kode, halaman, API, konfigurasi,
> dan build RJFM harus berada **di dalam folder `Module Services/rjfm/` ini**.
> TIDAK BOLEH ada file RJFM di luar folder ini (tidak di `Dashboard_Utama/`,
> tidak di module lain). Modul lain tidak boleh mengimpor dari modul ini, dan
> modul ini tidak boleh mengimpor dari modul lain atau `Dashboard_Utama`.

## Isolasi & Kemandirian

- Modul ini **aplikasi lengkap sendiri**: Express TS API + UI (Next.js di
  `ui-app/`) + penyimpanan berkas (NAS via SMB `Z:`) + auth sendiri.
- **Jalan sendiri**: `npm run dev` / `npx tsx src/server.ts` dari folder ini
  → hidup di port 8011, tanpa butuh gateway portal (3001), tanpa Dashboard_Utama.
- **Kedepannya modul ini jadi subrepo git tersendiri** — jaga agar:
  - tidak ada referensi path relatif keluar folder (`../../Dashboard_Utama`, dst),
  - dependensi dideklarasikan di `package.json` modul ini sendiri,
  - data lokal (`data/`), log, `.env` tetap di dalam folder modul.
- Shared code antar modul = **JANGAN diimpor; copy** ke `src/lib/` atau
  `ui-app/lib/` milik modul ini.

## Arsitektur monolith (satu port 8011)

| Jalur | Isi |
|---|---|
| `/health`, `/api/v1/*`, `/api/auth/*`, `/api/gateway/*` | Express API (src/) |
| `/api/file/*` | rewrite internal → `/api/v1/*` (dipakai UI) |
| `/file`, `/_next/*`, aset statis | UI Next.js hasil build `ui-app/` |

- UI dibangun dari `ui-app/` (Next.js standalone) dan dilayani Express via
  reverse-proxy ke port internal 8012 (`RJFM_UI_PORT` untuk override).
- Gateway portal (`:3001/rjfm`) tetap jalan sebagai proxy passthrough —
  bukan kebergantungan; hanya jalur alternatif.

## Sumber user

- Login & daftar kerani dari **`extend_db_ptrj` (tabel `user_ptrj`)** —
  MSSQL `10.0.0.110:1433`. Lihat `src/lib/directory.ts` + `src/routes/auth.ts`.
- Fallback akun demo di `data/rjfm-demo.json` hanya saat DB tidak terjangkau.

## Gateway NAS (service-to-service)

- API key statis: `RJFM_API_KEY` di `.env` — header `x-api-key`.
- Endpoint: `/api/gateway/{health,stats,files,download,upload,file,tasks,revisions/:id/stream,users}`.
- Delete via API hanya boleh di bawah folder `gateway/`.

## Perintah

- `npm run dev` → `tsx watch src/server.ts` (API + UI monolith, port 8011)
- `npm start` → `tsx src/server.ts`
- Build UI: `cd ui-app && npm run build` (output standalone dipakai server.ts)
- Typecheck API: `npx tsc --noEmit`
- Test: `node scripts/kerani-tests.mjs`, `node scripts/sanitize-tests.mjs`,
  `node scripts/gateway-tests.mjs` (butuh server hidup di 8011)

## Hal yang TIDAK boleh dilakukan

- ❌ Menaruh file UI/API RJFM di `Dashboard_Utama/` atau module lain.
- ❌ Mengimpor `@modules/*` atau path keluar folder modul.
- ❌ Menjalankan Next dev terpisah untuk UI modul ini — pakai build standalone
  + proxy dari `src/ui/serve.ts`.
- ❌ Membuat port kedua untuk UI (UI wajib lewat 8011).
