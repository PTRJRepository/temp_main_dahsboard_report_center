# Main Dashboard — Dokumentasi Teknis (Index)

**Project:** PT Rebinmas Jaya Main Dashboard  
**Updated:** 2026-06-12

---

## Dokumen Reference

Dokumentasi ini di-generate dari codebase scan lengkap. Semua file disimpan di folder `docs/` dan di-upload ke NotebookLM untuk RAG query.

| # | Dokumen | File | Topik |
|---|---------|------|-------|
| 11 | Landing Page | `docs/11-landing-page/README.md` | Landing page, Navbar, Hero, CSR gallery, routing |
| 12 | Proxy Gateway | `docs/12-proxy-gateway/README.md` | server.js, routes-config.json, proxy middleware, cookie sanitization |
| 13 | Report System | `docs/13-report-system/README.md` | 27 inventory reports, MSSQL, movement category, API |
| 14 | NotebookLM Gateway | `docs/14-notebooklm-gateway/README.md` | Bun/Elysia server, RAG, notebook CRUD, sources, chat, artifacts |

---

## Quick Navigation

### Landing Page (`docs/11-landing-page/`)
- Halaman publik utama PT Rebinmas Jaya
- Sections: Hero, Kilasan Perusahaan, Tentang Kami, Layanan, Berita, Galeri CSR, Statistik, Kontak
- Tech: Next.js App Router, Tailwind CSS, framer-motion
- No auth required

### Proxy Gateway (`docs/12-proxy-gateway/`)
- `server.js` (836 lines) — Express proxy di port 3001
- `server_bun.js` — Bun native proxy (optimized)
- `routes-config.json` — 7 route definitions
- Routes: `/upah` (8002), `/absen` (5176), `/monitoring-beras` (5177), `/query` (8001), `/file` (5178), `/ifess` (8003)
- Content rewriting: HTML/JS/CSS URL rewrite
- Cookie sanitization: strip RS256 auth-token
- Hot-reload config via fs.watchFile

### Report System (`docs/13-report-system/`)
- 27 inventory reports (Groups A-H)
- MSSQL database (db_ptrj, db_ptrj_mill) di 10.0.0.2:1888
- Movement category logic: Fast/Moving/Slow/Dead/No Movement
- Report handler di `app/api/reports/inventory/route.ts`
- Generic `ReportViewerClient` component
- Accounting period system
- Report filtering helpers

### NotebookLM Gateway (`docs/14-notebooklm-gateway/`)
- Bun/Elysia server di port 8003
- Wrapper untuk Google NotebookLM API
- RAG query, notebook CRUD, sources, chat, artifacts
- Direct notebooklm-py client via Python spawn
- 11 default docs dari `docs/` folder
- Notebook ID: `10b4e732-ccb0-45f2-80a9-354502ebf89c`

---

## Architecture Overview

```
Browser → Port 3001 (Gateway)
              │
              ├─ Static: /assets/* → Dashboard_Utama/public/assets/
              ├─ Proxy: /upah/* → localhost:8002 (Payroll)
              ├─ Proxy: /absen/* → localhost:5176 (Attendance)
              ├─ Proxy: /monitoring-beras/* → localhost:5177
              ├─ Proxy: /query/* → localhost:8001 (SQL Gateway)
              ├─ Proxy: /file/* → localhost:5178 (Google Drive)
              ├─ Proxy: /ifess/* → localhost:8003 (IFESS)
              └─ Next.js: /report-center/*, /dashboard/*, /admin/*, /login
 │
                          └─ MSSQL (10.0.0.2:1888)
                                  ├─ db_ptrj (Estate)
                                  └─ db_ptrj_mill (Mill/Pabrik)

NotebookLM Gateway (port 8003)
 │
              └─ Python REST API (port 8002)
                      └─ Google NotebookLM API
```

---

## Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `server.js` | 836 | Express proxy gateway |
| `server_bun.js` | ~600 | Bun native proxy (in progress) |
| `routes-config.json` | ~150 | Route definitions |
| `Dashboard_Utama/app/api/reports/inventory/route.ts` | ~2000+ | All report handlers |
| `Dashboard_Utama/lib/reports/config.ts` | ~500 | Report metadata registry |
| `notebooklm-gateway/server.ts` | 693 | Bun/Elysia + Python bridge |

---

## Development Commands

```bash
# Gateway (root)
npm run dev              # Bun server_bun.js dev
npm run start            # Bun server_bun.js prod
npm run build:dashboard  # Build Next.js

# Dashboard (Dashboard_Utama/)
npm run dev              # Next.js dev
npm run build            # Production build
npx tsc --noEmit         # TypeScript check
npm run lint             # ESLint

# NotebookLM Gateway
cd notebooklm-gateway && bun run server.ts

# Tests
npx tsx lib/reports/accounting-period.test.ts
npx tsx lib/reports/movement-category.test.ts
npx tsx lib/reports/report-filtering.test.ts
```

---

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Gateway | Express (Node.js) / Bun native |
| Frontend | Next.js 14 (App Router, React 18, TypeScript strict) |
| Styling | Tailwind CSS + framer-motion |
| Database (Auth) | Prisma + SQLite |
| Database (Reports) | MSSQL (SQL Server) |
| Auth | NextAuth.js + JWT (RS256) |
| Report DB | 10.0.0.2:1888 (db_ptrj, db_ptrj_mill) |
| AI Integration | Google NotebookLM API via notebooklm-py |
| Proxy | http-proxy-middleware |
| Bundler | Vite (upah frontend) |