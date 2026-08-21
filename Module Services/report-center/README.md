# Report Center (Module Service)

Canonical report-center module for the PT Rebinmas Main Dashboard.
Imported by Dashboard_Utama via the `@modules/report-center/*` alias.

## Structure

```
report-center/
├── components/   # React components (ReportCenterPage, ReportCenterShell, report/*, report-center/*, dashboard/*, layout/*, shared/*)
├── lib/          # Pure logic (reports/*, rbac/*, hooks/useSearch)
├── store/        # zustand reportStore
└── package.json  # workspace stub (deps resolve via hoisted repo-root node_modules)
```

## Setup (required after fresh clone)

The module lives OUTSIDE Dashboard_Utama, so Turbopack/Next must resolve
`@modules/*` and its bare packages. Two things make this work:

1. **`turbopack.root = <repo root>`** in `Dashboard_Utama/next.config.js`
   (already set) so `@modules/*` resolves.
2. **A `Module Services/node_modules` symlink → `Dashboard_Utama/node_modules`**
   so the module's bare imports (`react`, `lucide-react`, `zustand`, ...)
   resolve. The symlink is gitignored and must be recreated per machine:

```bash
node -e "const fs=require('fs');const p='Module Services/node_modules';try{fs.rmSync(p,{force:true})}catch(e){}fs.symlinkSync('../Dashboard_Utama/node_modules',p,'dir')"
```

Run from the repo root. Without it, `next build` fails with
`Module not found: Can't resolve 'lucide-react'` etc.

## tsconfig

- `Dashboard_Utama/tsconfig.json` — adds `"@modules/*": ["../Module Services/*"]`.
- `Module Services/report-center/tsconfig.json` — standalone check config
  (`baseUrl` = repo root, `@/*` → Dashboard_Utama) for typechecking the module
  files in isolation. The authoritative typecheck is Dashboard_Utama's own.

## Consumption

Dashboard_Utama route group `app/(report-center)/**` imports the module via
`@modules/report-center/...`. The gateway proxies `/report-center` to the
Dashboard_Utama app (DASHBOARD_TARGET). No standalone Next app serves this
module.

## NPM workspaces

Repo-root `package.json` declares `workspaces: ["Dashboard_Utama", "Module Services/*"]`.
`npm install` at repo root installs all workspaces. The module's `package.json`
is a stub listing its peer deps (they dedupe against Dashboard_Utama's install).
