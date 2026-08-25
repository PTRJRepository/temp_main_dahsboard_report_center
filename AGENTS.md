# Repository Guidelines

## Project Structure & Module Organization

Monorepo: root Bun/Express proxy gateway + main Next.js dashboard in `Dashboard_Utama/` + **isolated, independent module services** in `Module Services/`.

- `server.js` / `server_bun.js`: root proxy/API gateway entrypoints.
- `Dashboard_Utama/app/`: Next.js App Router pages and API routes. Route groups: `(landing-page)` public site, `(login)` auth + user/admin dashboards, `(report-center)` thin re-export stubs.
- `Module Services/report-center/`: **Report Center module** — standalone Next.js app (own port 3101, `bun start`). Owns `app/`, `components/`, `lib/`, `store/`, `utils/`. Pages + `/api/reports` handlers live here; Dashboard_Utama re-exports them. See its README.
- `Module Services/*`: other module services (ifess-control, rjfm, Wifi_LAN_Monitor).
- `keys/report-center-access.key`: shared access key for module login (gitignored, rotate by editing; all modules read the same file).
- `Dashboard_Utama/components/`: reusable React UI components (shared app chrome; report-center components live in the module).
- `Dashboard_Utama/lib/`: shared utilities and generic helpers.
- Local tests live beside modules, for example `Module Services/report-center/lib/reports/*.test.ts`.

Rules:
- Module services must stay self-contained — never import Dashboard_Utama internals; Dashboard_Utama imports modules via `@modules/*`.
- Gateway routes for modules live in `routes-config.json`; `shared/auth/paths.js` DASHBOARD_PATHS must not include module paths.

## Port Contract (JANGAN DIUBAH SEMBARANGAN)

Port setiap service adalah **kontrak monorepo** — dipakai gateway
(`routes-config.json`), launcher (`scripts/module.js`,
`start-module-services.ps1`), dan antar modul. **DILARANG mengubah port
service/port internal tanpa izin eksplisit user.** Daftar port baku:

| Service | Port |
|---|---|
| Gateway (server_bun.js/server.js) | 3001 |
| Dashboard_Utama (Next dev) | 3100 |
| report-center | 3101 |
| rebinmas-jaya-server | 3102 |
| rjfm | 8011 (internal UI: RJFM_UI_PORT) |
| sql-gateway | 8001 |

Kalau port sibuk, JANGAN ganti konfigurasi port — matikan proses pemegang
port lama atau laporkan ke user.

## Design & UI Rules (semua module services)

- Saat membuat/mengubah UI visual (SVG, ilustrasi, empty state, hero):
  **aktifkan skill `professional-svg`** (personal skill) — standar corporate
  flat profesional untuk aplikasi industri (dipakai manager/CEO), BUKAN gaya
  kartun/anak-anak. Palet maks 4–6 warna turunan token modul, tanpa wajah
  karakter, tanpa animasi infinite (blob/sway/glow/shimmer bergerak).
- Animasi dibatasi transisi/fade sekali jalan yang tenang.
- Untuk foto latar nyata, gunakan `shared/google-image-search`
  (lihat contoh penerapan di Module Services/rjfm → `/api/v1/meta/scene`).

## Build, Test, and Development Commands

Run gateway commands from the repository root:

- `npm run dev`: start the root gateway in development watch mode.
- `npm run start`: start the gateway in production mode.
- `npm run build:dashboard`: build the dashboard from the root.

Run dashboard commands from `Dashboard_Utama/`:

- `npm run dev`: start the Next.js dev server.
- `npm run build`: create a production Next.js build.
- `npm run start`: serve the built dashboard.
- `npm run lint`: run ESLint with Next core-web-vitals and TypeScript rules.
- `npx tsc --noEmit`: run TypeScript validation.
- `npx tsx modules/report-center/lib/reports/accounting-period.test.ts`: run a standalone assert-based test.

Run module commands from `Module Services/report-center/`:

- `bun start`: serve the standalone report center (port 3101).
- `bun run dev`: Next.js dev server (port 3101).
- `bun run build`: production build.
- `npx tsc --noEmit`: TypeScript validation.
- `npx tsx lib/reports/sql-gateway-config.test.ts`: module unit test.

## Coding Style & Naming Conventions

Use TypeScript for application code and keep `strict` compatibility. Follow existing formatting: 2-space indentation, single quotes in TS/TSX, and concise named helpers. React components use `PascalCase`; functions, variables, and hooks use `camelCase`; report IDs and routes use kebab-case such as `all-stock-movement-analysis`.

Prefer existing helpers in `lib/reports/` for report filtering, accounting periods, SQL safety, and metadata instead of duplicating logic.

## Testing Guidelines

Tests are lightweight Node assert scripts named `*.test.ts`. Place new tests next to the module they cover. For report logic, test pure helpers first, then validate API behavior with `npx tsc --noEmit`, `npm run lint`, and targeted endpoint checks where needed.

## Commit & Pull Request Guidelines

No Git history is available in this workspace, so use concise imperative commit messages with an optional scope, for example `inventory: fix movement category pagination`. PRs should include a short summary, affected routes/reports, verification commands, and screenshots for UI changes.

## Security & Configuration Tips

Do not commit secrets from `.env`, `.env.local`, or `keys/`. Keep SQL report routes read-only and reuse `validateReadOnlySql` / report-filtering utilities when adding query features.
