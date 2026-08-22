# RJFM — Rebinmas Jaya File Management

Module Services/rjfm — port **8011**, proxied via gateway `/rjfm` → `http://localhost:8011`.

## Stack
Express + mssql (MSSQL `RJ_FileManagement`) + JWT (HS256) + multer + isolated local storage (`D:/RJFM_Storage/uploads`).

## Setup
```bash
# 1. DB
# SSMS → run 02_Database_SQL/schema_database_rjfm.sql  (creates RJ_FileManagement + sp_ReviewSubmission)
# 2. env
cp .env.example .env   # edit MSSQL_PASSWORD if needed
# 3. install & run
npm install
npm run dev            # :8011
# via gateway
# http://localhost:3001/rjfm/api/v1/...  (add x-api-key or Authorization: Bearer <jwt>)
```

## Endpoints (OpenAPI 03_Spesifikasi_API/openapi_rjfm_v1.json)
- `POST /api/v1/auth/login`
- `POST /api/v1/tasks` (Manager/Asisten)
- `GET  /api/v1/tasks`
- `POST /api/v1/assignments/:id/submit` multipart `file` + `notes` (Kerani)
- `GET  /api/v1/assignments` / `:id`
- `POST /api/v1/submissions/:id/review` `{review_status, manager_feedback}` 422 if REJECTED without >=10 char
- `GET  /api/v1/files/:id/stream`
- `GET  /api/v1/system/storage-health` + `/health`

## Notes
- `sharp` auto-compression ponytail: add when foto >2MB sering.
- WA gateway: Notifications rows with channel=WHATSAPP queued; sender is external (Fonnte/Wablas) — not in this service.
- Gateway route: `routes-config.json` id `rjfm` path `/rjfm` target `http://localhost:8011`.
