# rebinmas-jaya-server (Server Monitor UI)

Server-health monitoring SPA for the PT Rebinmas Main Dashboard — servers,
network, incidents, alerts dashboards. Vite + React + Tailwind 4.

## Run

```bash
cd "Module Services/rebinmas-jaya-server"
npm install
npm run dev      # dev server, port 3102
npm run build    # production build → dist/
npm start        # serve dist/ via vite preview, port 3102
```

- Direct: http://localhost:3102/server-monitor/
- Via gateway proxy: http://localhost:3001/server-monitor

## Gateway wiring

Route `server-monitor` in `routes-config.json` targets `http://127.0.0.1:3102`.
The gateway's `rewriteViteDevResponse` branch (keys on `route.id === 'server-monitor'`)
rewrites Vite dev-module URLs so HMR works through the proxy.

Live data endpoints come from the gateway itself:
`/api/monitoring/snapshot`, `/api/monitoring/host-labels`,
`/api/monitoring/discovery/refresh` (see `shared/monitoring/`).

## Port

**3102** (`PORT` env overrides). Registered in the monorepo service registry —
see `docs/MONOREPO.md`.
