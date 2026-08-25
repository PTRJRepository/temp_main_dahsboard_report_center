# RJFM — Rebinmas Jaya File Management

Module Services/rjfm — port **8011**, proxied via gateway `/rjfm` → `http://localhost:8011`.

## Stack
Express + mssql (MSSQL `RJ_FileManagement`) + JWT (HS256) + multer + isolated local storage (`D:/RJFM_Storage/uploads`).

## Setup
```bash
# 1. DB — buat database RJ_FileManagement di MSSQL 10.0.0.110 (skema tabel + sp_ReviewSubmission)
# 2. env
cp .env.example .env   # edit MSSQL_PASSWORD if needed; WAJIB isi RJFM_API_KEY agar gateway aktif
# 3. install & run
npm install
npm run dev            # :8011
# via gateway
# http://localhost:3001/rjfm/api/v1/...  (add x-api-key or Authorization: Bearer <jwt>)
```

## Endpoints
Ringkasan (referensi lengkap: [docs/GATEWAY.md](docs/GATEWAY.md) §4 & §6):
- `POST /api/v1/auth/login`
- `POST /api/v1/tasks` (Manager/Asisten)
- `GET  /api/v1/tasks`
- `POST /api/v1/assignments/:id/submit` multipart `file` + `notes` (Kerani)
- `GET  /api/v1/assignments` / `:id`
- `POST /api/v1/submissions/:id/review` `{review_status, manager_feedback}` 422 if REJECTED without >=10 char
- `GET  /api/v1/files/:id/stream`
- `GET  /api/v1/system/storage-health` + `/health`

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [docs/GATEWAY.md](docs/GATEWAY.md) | Integrasi seluruh sistem: gateway NAS service-to-service (`/api/gateway/*`, `x-api-key`), dua jalur akses (direct :8011 vs portal :3001/rjfm), autentikasi, aturan berkas, resep integrasi, pengujian |
| [docs/ARSITEKTUR.md](docs/ARSITEKTUR.md) | Arsitektur monolith satu port, lapisan data (MSSQL + JSON store), model domain, rantai auth, pipeline ingest berkas, UI standalone |
| [docs/PANDUAN-PENGGUNA.md](docs/PANDUAN-PENGGUNA.md) | Panduan pemakaian harian Manager/Asisten/Kerani lewat UI `/file` |

## Notes
- `sharp` auto-compression ponytail: add when foto >2MB sering.
- WA gateway: Notifications rows with channel=WHATSAPP queued; sender is external (Fonnte/Wablas) — not in this service.
- Gateway route: `routes-config.json` id `rjfm` path `/rjfm` target `http://localhost:8011`.
