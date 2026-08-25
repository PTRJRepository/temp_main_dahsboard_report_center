# shared/authkit — Module Authentication Kit

Reusable auth functions for ANY module service in this monorepo. The gateway
(`server_bun.js` :3001) is the single auth center; this kit is how a module
**consumes** that identity — both access modes:

| Mode | Who verified? | What the module does |
|---|---|---|
| Via gateway proxy (`:3001/<path>`) | Gateway verified the RS256 cookie and injected `X-User-*` headers | `verifyGatewayIdentity(req)` — trust headers (inbound spoofed ones are stripped by the gateway) |
| Direct port (`:<modulePort>/<path>`) | Nobody yet | `verifyPortalCookie(token)` — verify the same RS256 cookie with `keys/public.pem` |

## Usage — copy, don't import

Module isolation rule (`docs/MONOREPO.md` §2): modules never import across
folders. **Copy this file** into your module (e.g. `Module Services/<mod>/lib/authkit.js`)
and adapt imports. It has ZERO dependencies (Node crypto + fs only) so it works
in Bun, Node, and Next.js server code.

```js
// Module Services/<mod>/lib/authkit.js  ← copy of this file
import { requireAuth, verifyGatewayIdentity, verifyPortalCookie } from './authkit.js';

// Express middleware (rjfm, any Express module):
app.use('/api/secure', requireAuth({ roles: ['ADMIN', 'MANAGER'] }));

// Manual check (Next.js route/page, Bun handler):
const user = verifyGatewayIdentity(req.headers);            // proxy mode
const user = verifyPortalCookie(req.cookies['auth-token']); // direct mode
```

## API

### `verifyGatewayIdentity(headers) → { userId, name, email, role } | null`
Reads `x-user-id`, `x-user-name`, `x-user-email`, `x-user-role` (case-insensitive).
Returns null if `x-user-id` is absent — meaning "not via gateway".

### `verifyPortalCookie(token, opts?) → payload | null`
RS256-verifies the portal JWT (`auth-token` / `payroll_auth_token`) using the
repo-root `keys/public.pem`. Caches verified payloads until `exp − 5s`.
`opts.keysDir` overrides the keys directory (default: walks up to repo root).
Never throws.

### `resolveIdentity({ headers, cookie }) → user | null`
Convenience: gateway headers first, portal cookie second.

### `requireAuth({ roles? }) → express middleware`
401 without identity, 403 when `roles` given and role not included.
Sets `req.user = { userId, name, email, role }`.

### `hasRole(user, ...roles) → boolean`
Case-insensitive role check; `ADMIN` always passes admin-ish checks by listing it explicitly.

## Trust rules (do not break)

1. NEVER trust raw inbound `X-User-*` on a port exposed to LAN — the gateway is
   the ONLY writer (it strips inbound copies before injecting). If your module
   binds `0.0.0.0`, pair `verifyGatewayIdentity` with a check that the request
   came through the gateway (e.g. require the gateway's `X-Request-Id` or bind
   the module to loopback).
2. The portal cookie is signed RS256 — verification needs ONLY `keys/public.pem`.
   Never copy `keys/private.pem` into a module.
3. Role names come from MSSQL `user_ptrj.role` (see `docs/MONOREPO.md` §4).
