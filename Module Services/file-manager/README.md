# file-manager (Module Service — Standalone Next.js App)

File Management LMS ("RJ Drive") — penugasan operasional, pengumpulan berkas,
review & audit revisi. Extracted from Dashboard_Utama (`app/(file)` +
`app/api/file`) as an independent module service.

## Run

```bash
cd "Module Services/file-manager"
npm install          # or rely on repo-root workspaces install
bun run dev          # next dev, port 3103
bun start            # production, port 3103
```

- Direct: http://localhost:3103/file
- Via gateway proxy: http://localhost:3001/file (route `file` → `http://127.0.0.1:3103`)

## Auth (SSO)

- Via gateway: the gateway verifies the shared RS256 cookie and forwards
  identity headers; server-side `lib/rjfm/server.ts` `getSession()` reads the
  same `auth-token`/`payroll_auth_token` cookie directly, so no re-login.
- Direct-port without a session: `/file/login` (rjfm credentials) still works
  as fallback.

## Structure

```
file-manager/
├── app/                  # moved from Dashboard_Utama/app/(file)
│   ├── file/             # UI pages + FileShell + PreviewModal
│   └── api/file/         # API route handlers (moved from app/api/file)
├── lib/rjfm/             # rjfmFetch bridge + types (moved from Dashboard_Utama/lib/rjfm)
├── utils/jwt.ts          # RS256 verify against repo keys/ (moved copy)
├── next.config.js        # assetPrefix=/file, turbopack.root=repo root
└── package.json          # standalone app
```

Dashboard_Utama keeps thin re-export stubs so old links keep working.
See `docs/MONOREPO.md` for the module contract.
