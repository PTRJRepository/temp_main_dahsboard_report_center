# Module Context — daftar-upah

You (an agent) are working inside `Module Services/daftar-upah`, one module of
the Main Dashboard monorepo. Read this before changing anything.
Full platform rulebook: repo root `docs/MONOREPO.md`.

## What this is

Daftar Upah Payroll (PT Rebinmas) — copied from
`D:/Gawean Rebinmas/PORTAL_ESTATE/V 2 (begin versioning)` on 2026-08-24.
One Bun process serves BOTH the API and the built Vite SPA:

```
backend/src/index.ts   → API (/payroll/*, /auth/*, /tax-report/*, …)
                       → static frontend/dist + SPA fallback (base /upah/)
frontend/src           → React + Vite source; `npm run build` → frontend/dist
```

## Dual access — every module has TWO ways to be reached

| Mode | URL | Auth |
|---|---|---|
| **Via gateway proxy** | `http://localhost:3001/upah` | Gateway verified the RS256 cookie; backend runs `USE_PROXY=true` + `AUTH_MODE=external` |
| **Direct** (independent) | `http://localhost:3104/upah/` | Same RS256 cookie verified by the backend itself via `backend/keys/public.pem` |

Rules that follow:
- The gateway strips `/backend/upah` before proxying (`PROXY_STRIP_PREFIX`).
- Keep both paths working. Direct-port access = standalone operation.
- This module runs on ITS OWN PORT (**3104**, `.env` overrides) and starts with
  zero other processes. The main dashboard does NOT auto-start modules —
  start/stop independently: `node scripts/module.js start daftar-upah`.

## Isolation contract

- Never import from another module or from Dashboard_Utama source. Shared code =
  copy into this module's own folders.
- `backend/node_modules` and `frontend/node_modules` are **junctions** to the
  source install at `PORTAL_ESTATE/V 2 (begin versioning)` (same pattern as
  `versions/`). Recreate per machine if broken:
  `cmd /c mklink /J <module>\...\node_modules <source>\...\node_modules`
- `backend/.env` is module-local: same DB credentials as the source, but
  `PORT=3104`. Never commit it. `keys/public.pem` must match the gateway's
  `keys/public.pem` (RS256 SSO).

## Sync with upstream source

This folder is a snapshot. After changing code in
`PORTAL_ESTATE/V 2 (begin versioning)`, re-copy the changed files (robocopy
mirrors backend/src, frontend/src, frontend/dist, assets) or re-run the copy
step — then rebuild the frontend if `dist` changed.

## Health

- Backend direct: `GET http://localhost:3104/health`
- Via gateway: `GET http://localhost:3001/backend/upah/health`
- UI via gateway: `http://localhost:3001/upah`

## Port Contract (JANGAN DIUBAH SEMBARANGAN)

Port service adalah kontrak monorepo (lihat root AGENTS.md untuk daftar
lengkap). DILARANG mengubah port service/port internal tanpa izin eksplisit
user. Kalau port sibuk, matikan proses pemegang port atau laporkan — jangan
ganti konfigurasi.

## Design & UI Rules

- Saat membuat/mengubah UI visual (SVG, ilustrasi, empty state, hero):
  aktifkan skill personal **professional-svg** — standar corporate flat
  profesional untuk aplikasi industri (dipakai manager/CEO), bukan gaya
  kartun/anak-anak. Palet maks 4-6 warna turunan token modul, tanpa wajah
  karakter, tanpa animasi infinite (blob/sway/glow/shimmer bergerak).
- Animasi dibatasi transisi/fade sekali jalan yang tenang.
