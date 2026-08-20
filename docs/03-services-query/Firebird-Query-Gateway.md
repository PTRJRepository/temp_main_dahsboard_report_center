# Firebird Query Gateway — Deep Dive

> Hardest layer. Runs **read-only SQL against the local Firebird 1.5 DB** (`PTRJ_ARC.FDB`, ARE-C estate) by shelling out to `isql.exe`. All execution flows through `execLocalQuery()` in `server_bun.js`. No connection pool, no ODBC, no network — writes a `.sql` file, invokes `isql.exe` via `execFileSync`, parses paginated text back into `{ headers, rows, rowCount, raw }`.

## 1. Execution Path
```
POST /api/query-gateway/exec-sync
  → handleQueryGateway (server_bun.js:2734)         [also /api/ifess/query-gateway/*]
  → ifessService.isReadOnlySql (service.js:1426)      guard: must be SELECT/WITH
  → execLocalQuery(queryText, maxRows||100) (server_bun.js:2968)
       1. temp file ifess_exec_{ts}_{pid}_{_seq}.sql (:2972)
       2. inject "SELECT FIRST N" if not present (:2975)
       3. writeFileSync(tmp, sql + ";\nquit;\n")      (:2978)
       4. withIsqlLock(() => execFileSync(LOCAL_ISQL,
            ['localhost:'+DB,'-u','SYSDBA','-p','masterkey','-q','-i',tmp],
            {timeout:20000, maxBuffer:100MB}))        (:2985)
       5. parseIsqlOutput(out) → {headers, rows}      (:2986 / :2895)
       6. catch → taskkill /IM isql.exe /F            (:2993)
       7. finally → unlinkSync(tmp)                   (:2998)
  → {success, headers, rows, rowCount, raw}
```
DB constants (`server_bun.js:2890`): `LOCAL_ISQL = C:\Program Files (x86)\Firebird\Firebird_1_5\bin\isql.exe`, `LOCAL_DB = ...\PTRJ_ARC.FDB`, `SYSDBA`/`masterkey` (override via `ISQL_PATH`, `IFESS_DB_PATH`, `FB_USER`, `FB_PASS`).

## 2. Reliability Fixes Applied
- **Temp-file collision** (`_seq` counter, `:2972`): concurrent `Promise.all` shared `Date.now()`-based names → one `.sql` overwritten mid-read. Symptom: `/explore` returned 0 while `/exec-sync` returned real data.
- **isql serialization** (`withIsqlLock`, `:2962`): Firebird 1.5 `fbserver` is single-threaded; `_isqlChain` allows one isql at a time. Without it, concurrent sessions cascade-timeout.
- **Zombie reaper** (`catch`, `:2993`): `spawnSync('taskkill','/IM','isql.exe','/F')` kills ALL isql on any failure to release a pinned DB lock.
- **`spawnSync`+timeout unreliable under Bun** (false SIGTERM on fast success) → use `execFileSync`. `spawnSync` only used for the taskkill cleanup (own timeout fine).

## 3. `parseIsqlOutput` (server_bun.js:2895)
isql paginates (~20 rows/page: `header` → `===` separator → `data` → blank). Parser merges all pages' rows:
- `isSeparator(l)` = trimmed line all `=`/`space` containing `=`; `isDataEnd(l)` = `SQL>`.
- Slices cells by matching `=` column spans (`colsFromSep`); header defined once.
- Skips blank lines before data; distinguishes end-of-page blank via `sawData`.
- Stops on `rows selected/fetched`, `SQL>`, `Statement failed`.
- **All cells are strings** — cast in app. `rowCount` = `rows.length`.

## 4. Placeholder Substitution Model
`#VAR#` tokens substituted in the **browser** before POST, not by isql. Identifier vars injected **unquoted**: `MONTH` (01–12), `YEAR` (4-digit), `LASTDAY` (last day), `TABLE_NAME`, any `*_NAME$`. Others become quoted string literals (`'value'`), single quotes doubled.
`#LASTDAY#` computed as `new Date(y, m, 0).getDate()` (Firebird lacks `LAST_DAY()`).

## 5. `/api/query-gateway/*` Handlers
| Route | Method | Behavior |
|-------|--------|----------|
| `exec-sync` | POST | validate + `execLocalQuery` → `{success,headers,rows,rowCount,raw}` |
| `exec-async` | — | via `dispatch` → batch/job/command + client polling |
| `dispatch` | POST | `createQueryBatch` |
| `batches` `(/[:id])` | GET | list / get batch |
| `templates` | GET/POST | list / create template |
| `templates/[:code]` | DELETE | delete template |
| `jobs/:id/result` | POST | `storeQueryJobResult` |
| `jobs/:id/chunks` | POST | `storeQueryResultChunk` |
| `explore` | GET | two parallel `execLocalQuery` over `RDB$RELATIONS` → `{objects,count}` (183 tables, 81 views) |
| `explore/:table` | GET | `RDB$RELATION_FIELDS` columns |
| `validate` | POST | `isReadOnlySql` → `{valid, errors}` |

**Verifying a query** (no browser): write a `.js` using `http` module + `node`, or `curl --data-binary @file.json`, to `POST /api/query-gateway/exec-sync` with `{"queryText":"...","maxRows":N}`. Inline `node -e`/`http` is intercepted by the harness.

## 6. Firebird 1.5 Limitations (silent wrong/zero data)
1. Multi-year scanner tables (`FFBSCANNERDATA*`, `GWSCANNERDATA*`, `RTSCANNERDATA*`) hold ALL years per month-slot → **always** `TRANSDATE BETWEEN '#YEAR#-#MONTH#-01' AND '#YEAR#-#MONTH#-#LASTDAY#'`.
2. `COUNT(DISTINCT)` over UNION of large scanner tables times out (>60s). Single-table DISTINCT fine.
3. `ORDER BY <alias>` fails (SQLCODE -206) → ordinal `ORDER BY 8 DESC`.
4. No `WITH` / window functions / `FETCH FIRST n OFFSET` / derived tables in `FROM/JOIN` → use `FIRST n`. `NOT IN` > `NOT EXISTS` (correlated times out).
5. No `LAST_DAY()` / `EXTRACT(DAY FROM date)`.

## 7. DB Facts — `PTRJ_ARC.FDB`, ARE-C Estate
- 183 tables, 81 views. `EMP` ≈ 5915 rows. `RESIGNED`/`RETIRE` empty (active filter = `NOT IN` against scanner).
- `GWSCANNERDATA*` ≈ 40k rows/mo (`WORKEREMPID`); `FFBSCANNERDATA*` ≈ 78k/mo (`SCANUSERID`); **`RTSCANNERDATA*` = 0** (palm estate, no rubber — never query RT).
- `FFBSCANNERDATA.LOOSEFRUIT` all 0 → use `LOOSEFRUIT2`. `BASICRATE`/`ADDRATE` all 0 → `EstCost` 0; rates in `SALARYSCALE`.
- `OVERTIME` single non-partitioned table, ~72k rows; filter `EXTRACT(MONTH FROM INPDATE)=#MONTH# AND EXTRACT(YEAR FROM INPDATE)=#YEAR#`. `VEHID=0` = "no vehicle" sentinel (never NULL).
- FK: `EMP.OCID→OC.ID`, `EMP.ID←GW.WORKEREMPID / FFB.SCANUSERID / OVERTIME.EMPID`, `OCFIELD.OCID→OC.ID`, `FFB.FIELDID→OCFIELD.ID`, `OVERTIME.JOBID→JOBCODE.ID`, `OVERTIME.VEHID→VEHCODE.ID`.

## 8. Seeded Templates
Live store `data/ifess/query-templates.json` (25 templates) — edit directly, mtime-cached. Seed `DEFAULT_QUERY_TEMPLATES` (`service.js:102`) runs only when JSON empty.
✅ **Fixed:** `EXEC_KPI` now uses `LOOSEFRUIT2` (real brondolan weight) and reports `TOTAL_LATEX = 0` with a note that RT/latex is N/A on this palm estate (`RTSCANNERDATA` is 0 rows). Previously it summed the all-zero `LOOSEFRUIT` column and `RTSCANNERDATA`.

## 9. Key Refs
`handleQueryGateway:2598/3874`, `execLocalQuery:2968`, `parseIsqlOutput:2895`, `withIsqlLock:2962`, `isReadOnlySql:1426`, `DEFAULT_QUERY_TEMPLATES:102`.
