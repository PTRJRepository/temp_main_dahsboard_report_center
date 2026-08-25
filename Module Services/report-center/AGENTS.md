# Module Context — report-center

You (an agent) are working inside `Module Services/report-center`, one module of
the Main Dashboard monorepo. Read this before changing anything.

## Dual access — every module has TWO ways to be reached

| Mode | URL | Auth |
|---|---|---|
| **Direct** (independent) | `http://localhost:3101` | This module verifies the shared RS256 cookie itself (`keys/public.pem` at repo root) or its own login page |
| **Via gateway proxy** | `http://localhost:3001/report-center` | The Bun gateway (`server_bun.js`) already verified the cookie and forwards identity headers: `X-User-Id`, `X-User-Name`, `X-User-Email`, `X-User-Role` |

Rules that follow:
- NEVER trust raw inbound `X-User-*` headers on direct port — only the gateway
  can set them legitimately (it strips inbound copies before injecting).
- Keep both paths working. A change that breaks direct-port access breaks
  standalone operation.
- This module runs on ITS OWN PORT and must start with zero other processes.
  The main dashboard does NOT auto-start modules — each is started/stopped
  independently (`node scripts/module.js start report-center` from repo root).

## Isolation contract

- Never import from another module or from Dashboard_Utama source. Shared code =
  copy into this module's own `utils/`/`lib/`.
- Route registration lives in `routes-config.json` at repo root (hot-reloaded).
  This module's path must NOT appear in `shared/auth/paths.js` DASHBOARD_PATHS.
- Full platform rulebook: repo root `docs/MONOREPO.md`. Service registry +
  ports table live there.

## This module

- Port **3101** · Next.js 16 standalone · route id `report-center`
- Start: `bun run dev` / `bun start` (see package.json)
- Health: page `/report-center` returns 200 with a valid session; API under
  `/api/reports/*` returns 401 without.
- Gateway status probe: `GET :3001/api/services/status` lists up/down for all routes.

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
