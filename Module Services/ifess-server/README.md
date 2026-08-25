# IFESS Server (Module Service)

Standalone **Bun** HTTP service that acts as the control plane for every
IFESS.SuperApp (.NET 8) client: registration, heartbeats, remote commands,
module status reporting, client groups, audit logs, and the query-gateway
job pipeline. Serves the unified ifess-control frontend directly — one
process for UI + API.

- **Port:** `8012` (`PORT` env overrides)
- **Auth:** `X-API-Key` header — `IFESS_API_KEY` (or `IFESS_CLIENT_API_KEY`
  for the gateway-proxied flow)
- **Storage:** shared `data/ifess/*.json` via the canonical
  `Services/ifess-control-server/service.js` (same files server_bun.js writes)

## Layout

```
ifess-server/
├── package.json          # bun scripts (start/dev/test)
├── .env.example          # PORT + IFESS_API_KEY
├── src/
│   ├── index.js          # Bun.serve entrypoint + reaper interval
│   ├── config.js         # env + repo .env.development/.env.production fallback
│   ├── auth.js           # timing-safe X-API-Key validation (2 keys)
│   ├── service.js        # CJS bridge → Services/ifess-control-server/service.js
│   ├── handler.js        # routing: bare REST + /api/ifess aliases + dispatcher
│   └── static.js         # unified frontend serving from Module Services/ifess-control
└── tests/
    └── wire.test.js      # bun test — wire-compat + auth coverage
```

## Run

```bash
node ../../scripts/module.js start ifess-server   # managed
bun run dev                                        # watch mode
bun run start                                      # plain
```

## Endpoints

Public: `GET /health`, `GET /server-info`, `GET /api/ifess/health`,
`GET /api/ifess/server-info`, unified UI at `/`, `/simple`, `/assets/*`.

Protected (`X-API-Key`) — .NET client wire protocol (bare paths):

| Method | Path |
|---|---|
| POST | `/api/clients/register` |
| GET | `/api/clients`, `/api/clients/{id}` |
| GET/PUT | `/api/clients/{id}/config` |
| POST | `/api/clients/{id}/heartbeat` |
| POST/GET | `/api/clients/{id}/modules/status` |
| POST | `/api/clients/{id}/commands` |
| GET | `/api/clients/{id}/commands/pending` → `{commands:[...]}` |
| POST | `/api/clients/{id}/commands/{commandId}/result` |
| GET | `/api/module-statuses?clientId=`, `/api/commands?clientId=&status=` |
| GET | `/api/dashboard` |
| POST | `/api/query-gateway/validate`, `/dispatch` |
| GET | `/api/query-gateway/batches[/{batchId}]`, `/history`, `/templates` |
| POST | `/api/query-gateway/jobs/{jobId}/result`, `/jobs/{jobId}/chunks` |
| POST/PUT/DELETE | `/api/query-gateway/templates[/{templateCode}]` |

Protected — legacy alias surface (UI + gateway proxy): `POST /api/ifess`
with `{action, params}` (full dispatcher: clients, heartbeat, commands,
groups, audit, sync), plus `/api/ifess/clients*`, `/api/ifess/dashboard`,
`/api/ifess/client-groups`, `/api/ifess/audit-logs`,
`/api/ifess/query-gateway/*`.

## Pointing clients here

In each SuperApp's `appsettings.json`:

```jsonc
"ControlServer": {
  "BaseUrl": "http://<server-lan-ip>:8012",
  "ApiKey": "ptrj-rebinmas-air-ruak-parit-gunung-darul"
}
```

Gateway proxy mode also works: keep `BaseUrl http://<dashboard>:3001/ifess`
and register an `/ifess` route in `routes-config.json` targeting
`http://localhost:8012`.
