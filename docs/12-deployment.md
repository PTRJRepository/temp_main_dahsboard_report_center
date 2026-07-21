# 12 — Deployment

**Last verified:** 2026-07-21

## Options

### A) Standalone host (gateway + dashboard)

```bash
npm install
cd Dashboard_Utama && npm install && cd ..
# configure env + keys
npm run build:dashboard
npm run start
```

`start` → `NODE_ENV=production DASHBOARD_PORT=3100 START_DASHBOARD=true bun run server_bun.js`.

Gateway-only production:

```bash
npm run start:gateway
```

### B) Docker (Next.js only)

```bash
cd Dashboard_Utama
docker-compose up --build
```

| Service | Port |
|---|---|
| nginx | host **8080** → 80 |
| app | 3001 internal |

Volumes: prisma, keys, static assets. Healthcheck: wget app `http://localhost:3001`.

**Gap:** Bun IFESS/Firebird gateway is not defined in this compose file.

### C) Legacy Express

```bash
npm run start:express
```

## Production checklist

- [ ] Secrets only via env / secret store
- [ ] `keys/` private key protected
- [ ] `COOKIE_SECURE=true` behind HTTPS
- [ ] Correct `routes-config.production.json`
- [ ] MSSQL accounts least privilege **read** for reports
- [ ] IFESS_API_KEY rotated from any code default
- [ ] Reverse proxy TLS terminated
- [ ] Log rotation for `logs/` and gateway logs
- [ ] Backup Prisma sqlite + `data/ifess` if used
- [ ] Smoke: `/health` or login + one inventory report

## Upgrade / rollback

1. Backup env, keys, prisma db, ifess JSON.
2. Deploy new build artifact / image tag.
3. Run migrations if Prisma schema changed (`npx prisma migrate deploy`).
4. Smoke test auth + one report + IFESS health.
5. Rollback: previous image/tag + restore backups.

## Related

- [05-configuration.md](./05-configuration.md)
- [13-backup-and-restore.md](./13-backup-and-restore.md)
