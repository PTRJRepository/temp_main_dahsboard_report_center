# IFESS Control (Module Service)

Standalone Firebird query-gateway UI + iFESS client-management dashboard.
Served directly by the Bun gateway (no Next.js build) at `/ifess-control/app`
(full UI) and `/ifess-control/simple` (query-only).

## Layout

```
ifess-control/
├── app/index.html        # full UI (Dashboard, Clients, Query, Absensi, Produksi, Payroll, Eksekutif)
├── simple/index.html     # query-only UI
├── assets/
│   ├── css/              # theme.css + pages.css (design tokens), bridge.css (Bootstrap→token reskin), attendance-matrix.css
│   ├── icons/            # sprite
│   ├── illustrations/    # empty-state SVGs
│   ├── logo-ifess.svg
│   └── tokens.json       # design token source
└── README.md
```

## Serving

- HTML: gateway `server_bun.js` serve block → `IFESS_CONTROL_DIR/{app,simple}/index.html` (read once, cached for process lifetime).
- Assets: `DEFAULT_STATIC_ROOTS` maps `/ifess-assets` → `assets/`.
- API: the UI calls `/api/ifess/*` and `/api/query-gateway/*`, both gateway-native (Firebird via `isql.exe`, iFESS via `Services/ifess-control-server/service.js`).

## Routes config

`routes-config.json` entry `id: ifess-control`, `target: self`, `public: true`.

## Auth

The HTML page is open; the API endpoints it calls require `X-API-Key`
(`IFESS_API_KEY` for `/api/ifess`, `QUERY_API_KEY` for `/api/query-gateway`).
The standalone UI injects the key client-side from `server-info`.
