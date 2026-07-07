# iFESS Standalone Analytics UI — Deep Dive

> Single static HTML file (Bootstrap 5.3 + CodeMirror 5.65.2) served by the Bun gateway at `/ifess-control/app` and `/ifess-control/simple`. No build step. Talks directly to the Firebird 1.5 Query Gateway (`/api/query-gateway/*`). Reskinned to a "deep-blue" token theme via `bridge.css` that retargets Bootstrap **without touching the JS**.

## 1. Pages (default landing = `tables`)
| Key | Page | Notes |
|-----|------|-------|
| `dashboard` | Dashboard | KPI/action tiles |
| `clients` | Clients | client management |
| `monitor` | Monitor | client/query job monitoring |
| `query` | Query | CodeMirror editor → `exec-sync` |
| `history` | History | past query batches |
| `tables` | **Tables** | table list (default via `showPage('tables')`) |
| `explorer` | Explorer | schema tree, per-column drill-down |
| `karyawan` | Karyawan | employee view |
| `absensi` | Absensi | attendance pivot matrix |
| `produksi` | Produksi | production module runner |
| `payroll` | Payroll | payroll module runner |
| `eksekutif` | Eksekutif | executive KPI runner |

Single-document swap: each page is `<div class="page" id="page-...">`; `showPage(name)` toggles `.active`. `ifess-simple.html` (346 lines) is a query-only console with its own inline dark CSS — no CodeMirror, no pivot, no `bridge.css`.

## 2. How It's Served (no Next.js build)
In `server_bun.js` (early handler, before proxy):
- **HTML routes** (`:3956`): `/ifess-control[/app]` → `ifess-app.html`; `/ifess-control/simple` → `ifess-simple.html`. Served `no-cache, no-store, must-revalidate` → UI edits picked up without restart.
- **Static assets** (`:3209`): `{prefix:'/ifess-assets', dir: public/ifess-assets}`. Resolved via `getStaticFilePath` → `serveLocalFile` (`:3911`). Cache-Control `max-age=3600` (JS/CSS w/o hash) or immutable (filename-hashed). HTML uses `?v=3` versioning.

Asset tree `public/ifess-assets/`:
```
css/theme.css            # deep-blue base tokens + components
css/pages.css            # page-specific styles
css/bridge.css           # Bootstrap 5 → token bridge (the reskin)
css/attendance-matrix.css# Absensi pivot styles
tokens.json              # machine-readable tokens
logo-ifess.svg, icons/, illustrations/
```

## 3. Absensi Page — Attendance Pivot Matrix
`loadAbsensiCalendar(offset)` (`:1309`) auto-loads on open. Firebird 1.5 has no `PIVOT`, so the matrix is built in JS:
- **Axis**: X = `tanggal`, Y = `karyawan`, cell = `hadir`.
- **Fetch** (`:1336`): single `exec-sync` on `GWSCANNERDATA{m}` JOIN `EMP`, filtered `TRANSDATE BETWEEN '...-01' AND '...-#LASTDAY#'`, `e.LASTWORKINGDATE IS NULL`, `GROUP BY EMPCODE,NAME,TRANSDATE` (maxRows 8000). Parallel `COUNT(*) FROM EMP WHERE LASTWORKINGDATE IS NULL` = active denominator.
- **Pivot** (`:1344`): rows → `empMap` (NIP→{name,dates,hadir}) + `dateSet`; sort by `hadir` desc; `renderAbsMatrix()`.
- **Last-day** (`new Date(y, mo+1, 0).getDate()`) injected in-app.
- **Sticky layout** (`attendance-matrix.css`): name column `position:sticky; left:0`; date header `top:0`; corner `z-index:20`. Cells `.abs-matrix-in` (present, green) vs `.out`/`.wkend`.
- **Cell click** `showAbsensiDayDetail` (`:1377`): loads `ATTEND_DAILY`, narrows to single day via regex, renders `absensi-result`.
- **Stats** `loadAbsensiStats` (`:1209`): `COUNT(*) FROM EMP` + single-table `COUNT(DISTINCT WORKEREMPID) FROM GWSCANNERDATA{m}` (kept separate to dodge cross-union DISTINCT timeout).

## 4. Result Rendering — `renderSyncResultInto`
`renderSyncResultInto(r, ms, wrap)` (`:1405`): reusable table renderer.
- Toolbar: row/col/ms count + CSV button (`exportCSVFromTable`).
- `table table-sm query-result-table mb-0` in `.table-wrapper` (max-height 600px). `makeHeader` (`:946`) / `makeCell` (`:930`) wrap content in `<span class="cell-content">` with same truncation (header>30, cell>50) → th/td widths stay in sync.
- **Load-more**: when `>500` rows, "Load all N rows" appends via `DocumentFragment`.
- Fixed right-border separators (`.query-result-table th/td`); `.text-wrapped` toggles wrapping.

## 5. Module Runners & Placeholder Substitution
```js
function runAbsensi(code){ runModule(code, dateVarsPrompter(), 'absensi-result'); }
// runProduksi / runPayroll / runEksekutif same pattern
```
`runModule(code, promptFn, resultId)` (`:1162`): `getTemplate` → `extractQueryVars` → per-var `promptFn` (identifier vs literal) → substitute `#VAR#` (identifier bare, others `'value'`) → POST `{queryText, maxRows}` to `exec-sync` → `renderSyncResultInto`.

`dateVarsPrompter()` (`:1132`): memoized closure; first `MONTH/YEAR/LASTDAY` pops one `YYYY-MM` prompt, computes `LASTDAY`, caches all three consistent across one run. Manual editor `executeQuery()` (`:831`) uses same logic then runs direct isql or dispatches to a client (`executeQueryOnClient`, polls batches). `Ctrl+Enter` triggers it.

## 6. The Deep-Blue Reskin — `bridge.css`
Load order in `<head>`: `bootstrap.min.css → theme.css → pages.css → bridge.css → attendance-matrix.css`. `bridge.css` (412 lines) loads **after** Bootstrap so its rules win. **JS emits Bootstrap class names; bridge.css retargets them to `var(--surface)`/`var(--line)`/`var(--teal)` tokens — no JS edit.** Header comment mandates "No new hex" (a few button gradients remain).
Retargets: `.page`, `.card`, buttons (`.btn-primary` teal→blue gradient), alerts/badges, tables, forms, spinner, navbar→topbar, grid, `.query-result-table`, `.abs-matrix*`, CodeMirror (monokai→deep-blue), scrollbars, footer. The reskin is **purely CSS** — query/renderer JS unchanged from pre-reskin.

## 7. Key Files
| File | Role | Symbols |
|------|------|---------|
| `public/ifess-app.html` (1445) | Main SPA | `showPage:293`, `executeQuery:831`, `makeCell:930`, `makeHeader:946`, `dateVarsPrompter:1132`, `runModule:1162`, `runAbsensi..:1198`, `loadAbsensiStats:1209`, `loadAbsensiCalendar:1309`, `showAbsensiDayDetail:1377`, `renderSyncResultInto:1405` |
| `public/ifess-simple.html` | Query-only console | minimal editor + `exec-sync` |
| `server_bun.js` | Serves both | HTML routes `:3956`, `DEFAULT_STATIC_ROOTS:3209`, `serveLocalFile:3911` |
| `public/ifess-assets/css/bridge.css` | Bootstrap→token bridge | header `:1`, buttons `:40`, `.query-result-table:273`, `.abs-matrix*:296`, CodeMirror `:353` |

## 8. Operational Notes
- No build: edit HTML/CSS directly; HTML `no-cache`, assets `?v=3`.
- Run: `PORT=3002 START_DASHBOARD=false bun run server_bun.js`; UI at `http://localhost:3002/ifess-control/app`.
- Firebird constraints baked into UI: month-partition tables, `TRANSDATE BETWEEN` on every scanner query, in-app `#LASTDAY#`, separate single-table `COUNT(DISTINCT)`, ordinal/`FIRST n`.
