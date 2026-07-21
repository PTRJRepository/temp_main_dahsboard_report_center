# 16 — Observability

**Last verified:** 2026-07-21

## Logging

| Source | Where |
|---|---|
| Gateway stdout/err | `server_bun.out.log`, `server_bun.err.log`, dev logs |
| Next dev | console / `.next-*.log` |
| Express morgan | legacy `server.js` stack |
| App login | `console.log` in auth routes (reduce in prod) |

## Health endpoints

| Endpoint | Meaning |
|---|---|
| Gateway `/health` | Proxy health (README) |
| `/api/ifess/health` | IFESS control alive |
| Docker compose healthcheck | wget app `:3001` |
| Route health | `/api/routes/:id/health` for upstream |

## Metrics / APM

No Prometheus/OpenTelemetry integration verified in application source for report center. Treat as **not implemented**.

## Recommended minimal ops signals

1. Gateway process up.
2. Next process up (if separate).
3. MSSQL connectivity for one inventory probe.
4. Firebird isql success for a trivial `SELECT`.
5. Error rate on `/api/reports/inventory`.

## Related

- [18-troubleshooting.md](./18-troubleshooting.md)
- [12-deployment.md](./12-deployment.md)
