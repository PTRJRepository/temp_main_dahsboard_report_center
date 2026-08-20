# Repository Guidelines

## Project Structure & Module Organization

This workspace contains a Bun/Express proxy gateway at the root and the main Next.js dashboard in `Dashboard_Utama/`.

- `server.js`: root proxy/API gateway entrypoint.
- `Dashboard_Utama/app/`: Next.js App Router pages and API routes. Route groups: `(landing-page)` public site, `(login)` auth + user/admin dashboards, `(report-center)` thin auth-gated route pages.
- `Dashboard_Utama/modules/report-center/`: **Report Center module** — self-contained components/store/lib with its own `package.json` stub, ready for micro-repo extraction. Landing page must not import from it.
- `Dashboard_Utama/components/`: reusable React UI components (shared app chrome; report-center-specific components live in `modules/report-center/`).
- `Dashboard_Utama/lib/`: shared utilities and generic helpers. Report logic lives in `modules/report-center/lib/reports/`.
- `Dashboard_Utama/store/`, `context/`, `types/`, `utils/`: client state and shared app support.
- `Dashboard_Utama/public/` and `assets/`: static assets.
- `Dashboard_Utama/prisma/`: Prisma schema and database support files.
- Local tests currently live beside modules, for example `modules/report-center/lib/reports/*.test.ts`.

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

## Coding Style & Naming Conventions

Use TypeScript for application code and keep `strict` compatibility. Follow existing formatting: 2-space indentation, single quotes in TS/TSX, and concise named helpers. React components use `PascalCase`; functions, variables, and hooks use `camelCase`; report IDs and routes use kebab-case such as `all-stock-movement-analysis`.

Prefer existing helpers in `lib/reports/` for report filtering, accounting periods, SQL safety, and metadata instead of duplicating logic.

## Testing Guidelines

Tests are lightweight Node assert scripts named `*.test.ts`. Place new tests next to the module they cover. For report logic, test pure helpers first, then validate API behavior with `npx tsc --noEmit`, `npm run lint`, and targeted endpoint checks where needed.

## Commit & Pull Request Guidelines

No Git history is available in this workspace, so use concise imperative commit messages with an optional scope, for example `inventory: fix movement category pagination`. PRs should include a short summary, affected routes/reports, verification commands, and screenshots for UI changes.

## Security & Configuration Tips

Do not commit secrets from `.env`, `.env.local`, or `keys/`. Keep SQL report routes read-only and reuse `validateReadOnlySql` / report-filtering utilities when adding query features.
