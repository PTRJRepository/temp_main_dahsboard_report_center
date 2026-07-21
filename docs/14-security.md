# 14 — Security

**Last verified:** 2026-07-21

## Confirmed protections

| Control | Evidence |
|---|---|
| Report SQL read-only validation | `validateReadOnlySql` / NL write-verb rejection / Firebird `isReadOnlySql` |
| Report-center page gate | layout cookie (+ ADMIN note from audit) |
| IFESS management API key on many Bun native paths | `X-API-Key` after public health/info |
| Raw upstream prefixes require API keys | `/query*`, `/ifess*`, `/backend/upah*` in Bun |
| JWT RS256 signing | `utils/jwt.ts` |
| bcrypt password compare | user-repository |
| Docker non-root user | Dockerfile `nextjs` user |
| nginx basic headers + `/api/` rate zone | `nginx/conf.d/rebinmas.conf` |

## Risks / findings (auditor-backed)

| Priority | Issue | Risk | Recommendation |
|---|---|---|---|
| Critical | Several `/api/reports/*` routes lack explicit auth; Bun proxies dashboard early | Unauthenticated data access if network exposed | Require JWT on all report APIs |
| Critical | Firebird Query Service has **no auth** in service code; Bun proxies query-gateway without Bun auth | Anyone who can hit service can run SELECT/explore/template writes | Network isolate + API key at edge |
| Critical | Default/hardcoded API keys / auth secrets fallbacks in code | Unauthorized access | Env-only secrets; rotate |
| High | Cookies `httpOnly:false` + localStorage token | XSS session theft | httpOnly secure cookies only |
| High | Auth fragmented (custom JWT, NextAuth, mock RBAC, demo middleware) | Bypass / false security | One auth path |
| High | SQL Bridge auth attaches broad admin-like permissions to valid tokens | Over-privileged queries | Least-privilege permission objects |
| High | IFESS sync writes MSSQL migrated tables | Not read-only path | Lock down route + audit |
| Medium | Monthly stock JSON route no explicit auth | Data exposure | Cookie/JWT gate |
| Medium | Docker image copies `keys/`; health probe path may not exist | Ops/security friction | Mount secrets; fix `/health` |
| Medium | Helper scripts print credential-related material | Secret leakage in ops | Restrict scripts |
| Low | Verbose login console logs | Noise / info leak | Reduce PII in logs |

## Unverified areas

- Full CSRF strategy for cookie POSTs
- CSP / HSTS at nginx (basic headers present; CSP/HSTS not confirmed)
- Dependency CVE scan CI
- Whether Next `/api/ifess` is ever reached when Bun fronts traffic (shadowed)
- Exact production API key values (must remain secret)

## Secrets handling rules

1. Never commit `.env*`, private keys, or production connection strings.
2. Use `.env.example` keys only.
3. Redact host credentials in tickets and AI prompts.

## Related

- [08-authentication-and-permissions.md](./08-authentication-and-permissions.md)
- [05-configuration.md](./05-configuration.md)
- [20-known-limitations.md](./20-known-limitations.md)
