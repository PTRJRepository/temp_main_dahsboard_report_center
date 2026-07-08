---
title: Quality Rules
readMode: optional
priority: medium
category: execution
scope: project
dimension: specs
keywords: [quality, testing, lint, typecheck]
---

# Quality Rules

- [rule:testing] Leave one runnable check for non-trivial logic.
- [rule:lint] Run focused validation for changed area when feasible.
- [rule:security] No secrets in code; no destructive or disruptive network behavior.
- [rule:read-only] Monitoring/query features should be read-only unless user explicitly asks for mutation.
