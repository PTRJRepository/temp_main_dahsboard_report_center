# ADR 0001 — Bun gateway as primary runtime

- **Status:** Accepted (de facto)
- **Date:** 2026-07-21 (documented)

## Context

The monorepo historically used Express (`server.js`) as a reverse proxy. Performance and unified IFESS/query concerns pushed a Bun native server.

## Decision

Treat `server_bun.js` as the active gateway for proxy, IFESS control API, and Firebird query gateway. Keep `server.js` for legacy parity only.

## Alternatives

1. Express-only — simpler Node ecosystem, slower/less integrated IFESS path.
2. Separate microservices without monorepo gateway — more ops overhead.

## Consequences

- Root npm scripts default to Bun.
- Contributors need Bun installed.
- Dual codebase maintenance until Express is removed.

## Evidence

- Root `package.json` scripts `dev`/`start` → `bun run server_bun.js`
- `CLAUDE.md` dual-mode architecture notes

## Follow-up

- Explicit deprecation timeline for Express.
- Smoke tests covering Bun-only paths.
