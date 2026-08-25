# daftar-upah — Daftar Upah Payroll (Module Service)

Sistem Penggajian / Daftar Upah PT Rebinmas — snapshot dari
`D:/Gawean Rebinmas/PORTAL_ESTATE/V 2 (begin versioning)` (2026-08-24).
Satu proses Bun menyajikan API + frontend build sekaligus.

## Run

```bash
cd "Module Services/daftar-upah"
npm start            # produksi  → backend :3104, serve frontend/dist
npm run dev          # watch mode
npm run build:frontend   # rebuild SPA → frontend/dist
npm test             # bun test di backend
```

- Via gateway proxy: http://localhost:3001/upah
- Direct: http://localhost:3104/upah/
- Health: `GET :3104/health` atau `GET :3001/backend/upah/health`

## Gateway wiring

Route `upah` + `backend-upah` di `routes-config.json` (+ `.production.json`)
target `http://localhost:3104`. `spaIndex`/`staticRoots` menunjuk ke
`Module Services/daftar-upah/frontend/dist` dan `daftar-upah/assets`.
Gateway hot-reload — edit JSON langsung efek tanpa restart.

## Struktur

```
daftar-upah/
├── package.json        # scripts: start/dev/build:frontend/test
├── AGENTS.md           # module context untuk agent
├── assets/             # images dilayani gateway di /upah/images
├── backend/            # Bun + Elysia API + static serving
│   ├── src/            # source (snapshot upstream)
│   ├── data/           # persisted JSON (thumbprint, premium defs, dll)
│   ├── keys/           # public.pem RS256 (harus = gateway keys/public.pem)
│   ├── .env            # PORT=3104, USE_PROXY=true, AUTH_MODE=external (jangan commit)
│   └── node_modules    # junction → source install
└── frontend/           # React + Vite (src + dist build)
    └── node_modules    # junction → source install
```

## Port

**3104** (`.env` `PORT`). Terdaftar di registry monorepo — lihat `docs/MONOREPO.md`.

## Catatan sinkronisasi

Folder ini snapshot; sumber tetap di `PORTAL_ESTATE/V 2 (begin versioning)`.
Setelah perubahan kode di sumber, copy ulang bagian yang berubah
(`backend/src`, `frontend/src`, rebuild `frontend/dist`) ke sini.
