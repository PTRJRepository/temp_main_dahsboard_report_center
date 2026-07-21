# ADR 0003 — SQLite Prisma for application ACL

- **Status:** Accepted
- **Date:** 2026-07-21 (documented)

## Context

The dashboard needs portable local user/service access control separate from heavy MSSQL report stores.

## Decision

Use Prisma with SQLite (`provider = "sqlite"`) for `User`, `Service`, and `AccessControl` models stored under `Dashboard_Utama/prisma/`.

## Alternatives

1. Store ACL in MSSQL — couples portal to report DB availability.
2. Full IdP (Keycloak etc.) — heavier ops.

## Consequences

- Easy project move with file copy.
- Concurrent multi-instance write limits of SQLite.
- Role string divergence risk vs RBAC TypeScript types.

## Evidence

- `Dashboard_Utama/prisma/schema.prisma`
- `dev.db` present in tree

## Follow-up

- Document production HA if multiple nodes need shared ACL.
