# 08 — Authentication and Permissions

**Last verified:** 2026-07-21

## Mechanisms present

| Mechanism | Evidence | Notes |
|---|---|---|
| **Primary** credential login API | `app/api/auth/login/route.ts` | Issues RS256 JWT; sets `auth-token` |
| Cookie names | `auth-token`, `payroll_auth_token` | Dual for compatibility |
| Token also in `localStorage` | `components/LoginForm.tsx` | Not httpOnly-only |
| Cookie flags | login/verify routes | `httpOnly: false`, `secure: false` (current code) |
| NextAuth route | `app/api/auth/[...nextauth]`, `auth.ts` | **Parallel** stack; UI still uses custom login |
| JWT RS256 keys | `utils/jwt.ts`, public-key route | Path via env |
| Report-center layout gate | `app/(report-center)/report-center/layout.tsx` | Cookie required; auditor notes ADMIN role gate |
| Inventory debug SQL gate | inventory route `debugSql` | ADMIN JWT only for debug branch |
| Most report API routes | `app/api/reports/*` | **No explicit auth** seen in several handlers |
| Bun gateway | `server_bun.js` | Proxies dashboard before late protected-path check |
| Client mock RBAC | `lib/rbac/AuthContext.tsx` | Mock users for demo |
| Permission matrix | `lib/rbac/permissions.ts` | Module/report/export access (frontend matrix) |
| AuthProvider mount | layout/providers | **Incomplete wiring** risk (default context) |
| Prisma roles | `prisma/schema.prisma` | Different role strings |

## Login UX

- Page: `/login` → `components/LoginForm.tsx`
- Posts `{ email: username, password }` to `/api/auth/login`
- On success stores token in `localStorage` **and** relies on cookies; redirects `/dashboard-user`

## RBAC roles (TypeScript)

From `lib/rbac/types.ts`:

`kerani | hr | payroll | manager | admin | SuperAdmin`

### Module access (summary)

| Module | Roles |
|---|---|
| dashboard, queries, reports | kerani+ |
| users | hr+ |
| payroll | payroll+ |
| settings, audit_logs | manager+ |

Export formats typed: `csv | xlsx | json | pdf` with further gates in `permissions.ts` (read full file for format matrix).

## Intended vs implemented gaps

| Topic | Current | Intended / risk |
|---|---|---|
| Role vocabulary | Prisma `ADMIN/KERANI/...` vs RBAC `admin/kerani/...` | Unify mapping — **gap** |
| Mock AuthContext users | Hardcoded passwords in source for demo | Must not ship as production identity |
| localStorage token | Still written by LoginForm | Prefer httpOnly cookie only |
| Monthly stock JSON route | No explicit auth check in route file snippet | Confirm gateway/network exposure |

## Service access control

Prisma `AccessControl` links `role` or `userId` to `Service`. `/api/services` returns services for authenticated user.

## Related

- [14-security.md](./14-security.md)
- [07-api-reference.md](./07-api-reference.md)
