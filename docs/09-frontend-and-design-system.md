# 09 — Frontend and Design System

**Last verified:** 2026-07-21

## Stack

- Next.js 16 App Router (`Dashboard_Utama`)
- React 19-era deps from package.json
- Tailwind CSS v4 toolchain (`@tailwindcss/postcss`)
- Zustand stores, TanStack Query + Virtual
- Lucide icons, Framer Motion present
- Leaflet maps dependency present

## Application shell

| Area | Implementation |
|---|---|
| Report Center shell | `ReportCenterShell.tsx` + sidebar/topbar |
| Theme tokens | `app/globals.css` `--rc-*` forest/dark tokens |
| Theme flag | `NEXT_PUBLIC_REPORT_CENTER_THEME_V2` |
| Auth gate | report-center `layout.tsx` cookie check |

## Primary routes (pages)

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/login` | Login |
| `/dashboard-user` | Post-login portal |
| `/admin` | Admin |
| `/report-center` | Report center home |
| `/report-center/[module]` | Module workspace (procurement etc.) |
| `/report-center/inventory` | Redirects into procurement stockGroup |
| `/report-center/inventory/[report]` | Report detail viewer |
| `/ifess-control` | IFESS admin page |

## Report Center UX building blocks

| Component | Role |
|---|---|
| `ProcurementModuleWorkspace` | Procurement shell, embeds inventory catalog |
| `ProcurementKpiStrip` | Context-grouped KPI command deck |
| `InventoryOverview` | Movement composition + exceptions (KPI strip removed from here 2026-07-21) |
| `InventoryReportsClient` | Catalog, central filter hub, quick jump |
| `ReportViewerClient` | Heavy detail viewer / table / filters |

## Design tokens (implemented)

CSS variables under `.report-center-dark` / forest theme:

- Surfaces: `--rc-bg`, `--rc-surface`, `--rc-forest-surface`
- Text: `--rc-text`, `--rc-text-muted`, `--rc-text-faint`
- Accent: `--rc-accent`, `--rc-forest-primary`, `--rc-forest-accent`
- Borders: `--rc-border`, `--rc-forest-border`

Utility overrides map Tailwind slate/white classes into dark theme inside report center (see `globals.css`).

## Patterns

| Pattern | Notes |
|---|---|
| Width | Dense pages often `max-w-[1680px]`; module pages `max-w-screen-2xl` |
| KPI cards | Label, value, context, basis preferred |
| Filters | Prefer single URL-synced hub (procurement inventory) |
| Tables | Sticky headers, virtualization in viewer |
| Export | Excel/PDF via client libs `xlsx`, `jspdf` |

## States

Documented in UI code paths:

- Loading skeletons / pulse blocks
- Empty filter results
- API error panels
- Partial windowed payloads (`metadata.windowed`)
- Disabled open/export when report not live-linked

## Accessibility

| Topic | Status |
|---|---|
| Focus rings | Some `rc-forest-focus` / focus:ring classes |
| Labels | Mixed; quick jump has explicit label |
| Reduced motion | Not systematically verified |
| Screen reader | Partial / **Unverified** full audit |

## Legacy inconsistencies

- Light inventory tiles vs dark shell still coexist historically.
- Dual visual languages across catalog vs viewer.
- Process map + multiple KPI decks can still lengthen procurement page.

## Related

- [10-reporting-engine.md](./10-reporting-engine.md)
- [11-report-detail-experience.md](./11-report-detail-experience.md)
