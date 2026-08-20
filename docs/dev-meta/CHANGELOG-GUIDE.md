# Changelog Guide

**Last verified:** 2026-07-21

This repository does not currently maintain a full Keep-a-Changelog history at root (no complete `CHANGELOG.md` verified as authoritative). Use this guide when recording releases or major merges.

## Format

```markdown
## [Unreleased]

### Added
- ...

### Changed
- ...

### Fixed
- ...

### Security
- ...

### Docs
- ...
```

## What to log

| Include | Skip |
|---|---|
| New report IDs / API routes | Pure formatting |
| Auth/RBAC matrix changes | Dependency lock churn without behavior change |
| Breaking env vars | Generated `.next` artifacts |
| SQL formula changes for inventory metrics | Local WIP screenshots |

## Versioning suggestion (proposed, not enforced)

- **Major**: breaking API or auth cookie contract.
- **Minor**: new reports/modules.
- **Patch**: bugfix, docs, performance without contract change.

## Related evidence sources

- Git history on branch `main`.
- Workflow archives under `.workflow/archives/` (implementation notes, not user changelog).
- PRD/review docs under `Dashboard_Utama/docs/PRD/`.
