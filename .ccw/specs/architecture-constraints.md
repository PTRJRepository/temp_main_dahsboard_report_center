---
title: Architecture Constraints
readMode: optional
priority: medium
category: planning
scope: project
dimension: specs
keywords: [constraint, gateway, nextjs, ifess, sql]
---

# Architecture Constraints

- [rule:gateway] `server_bun.js` is active standalone gateway; `server.js` is legacy reference.
- [rule:nextjs] Docker deployment runs Next.js behind nginx on port 8080.
- [rule:ifess] Live IFESS JSON store is `data/ifess/*.json`.
- [rule:sql] SQL routes must be read-only and use existing validation helpers.
- [rule:firebird] Firebird 1.5 query layer has strict limitations; avoid unsupported SQL constructs.
