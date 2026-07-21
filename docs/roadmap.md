# Roadmap (Evidence-Based)

**Last verified:** 2026-07-21  
Statuses are **Proposed** unless product accepts them.

## Critical

1. Remove hardcoded/default API keys; enforce env secrets.
2. AuthZ consistency: map Prisma roles ↔ RBAC; gate all report JSON routes.
3. Implement or hide monthly stock `placeholder_zero` measures.

## High

1. Automated backup for sqlite + `data/ifess`.
2. Single gateway path (document Express deprecation timeline).
3. OpenAPI generation from Next routes + gateway.
4. CI: `tsc`, lint, key `tsx` tests on PR.

## Medium

1. SQL pushdown for hot inventory filters.
2. Playwright smoke: login → procurement → open RPTIN1000015.
3. Unify Module Services vs Dashboard_Utama trees.
4. Observability metrics for report latency/errors.

## Optional

1. Compose profile bundling Bun gateway + Next.
2. Full accessibility audit on report viewer.
3. Keep-a-Changelog automation from PR labels.

## Related

- [20-known-limitations.md](./20-known-limitations.md)
- [adr/README.md](./adr/README.md)
