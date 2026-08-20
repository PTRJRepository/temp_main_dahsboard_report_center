# Master Prompt (Advanced) — Report Center + Report Detail Total Redesign

**Copy this entire document into any coding agent with repo access.**  
**Attach:** current Report Detail screenshots + `REPORT_CENTER_PAGES_AND_UI_COMPONENTS.md` + `Report-Center-Inventory-Module.md` + `IN_ITEM-Database-Schema.md` + `Report-Center-Tables` docs + this file’s companions:

- `Dokumentasi/REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md`
- `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md`
- `Dokumentasi/REPORT_CENTER_DEBUG_REPORT_2026-07-21.md`

**Git checkpoints (mandatory knowledge):**
- `05dd66b` = pre-redesign baseline (safe rollback)
- `4fe3253` = typed metrics + calm monthly Ringkasan hierarchy

If you break the tree: `git reset --hard 05dd66b` or `4fe3253` as appropriate. Never force-push. Never commit secrets (`.env*`, keys).

---

## 0. Agent identity and non-negotiables

You are lead product designer, accounting-report UX architect, data-product engineer, and senior full-stack engineer.

You are authorized to use specialized sub-agents. Work long-horizon. **Do not stop after audit/plan/wireframe/partial restyle.** Continue through discovery → contracts → implementation → tests → browser verification → polish until acceptance criteria pass **or** the user manually stops continuous mode.

**Iron laws**
1. Repository + runtime + tests > docs > this prompt.  
2. **No invented accounting formulas.** Mark unverified metrics.  
3. **No fix without root cause** for bugs (systematic debugging).  
4. **No generic SaaS reskin.** Evolve existing dark forest enterprise identity.  
5. **No currency formatting for period/qty/count/status.** Use typed metrics.  
6. **SQL/debug never equals executive content.**  
7. **Same output contract** as other agents: follow shared reference files above.  
8. Preserve read-only SQL, permissions, filters-in-URL, estate|pabrik sources.  
9. Prefer smallest correct diff; delete noise over adding decoration.  
10. Continuous work until user stops manually (if user requested continuous mode).

---

## 1. First implementation target

**MONTHLY STOCK ACCOUNT MOVEMENT DETAILS**  
- Route id: `monthly-stock-account-movement-details`  
- Code: `RPTIN1000015`  
- Viewer: `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`  
- Domain: `Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts`  
- API: `Dashboard_Utama/app/api/reports/inventory/route.ts`

Then generalize shell to other inventory reports without per-report JSX forks.

---

## 2. Source-of-truth hierarchy

1. Actual repository and runtime behavior  
2. SQL handlers, data contracts, tests, real payloads  
3. Screenshots (UX evidence)  
4. Markdown/ZIP documentation (may be stale)  
5. This prompt (direction)

### Known doc inconsistencies to resolve against code (document outcomes)

| Topic | Action |
| --- | --- |
| Report count 17 vs 20 | Count live config / handlers |
| Accounting year Apr–Mar examples | Verify `accounting-period.ts` + tests + payload |
| Client vs server filters | Classify each filter: SQL / API / client-window / presentation |
| Row limits (table/export/AI) | Read actual constants and routes |

---

## 3. Already fixed — do not re-break

These were root-cause fixed; **preserve and extend**, do not reintroduce:

| Issue | Fix location | Guard |
| --- | --- | --- |
| KPI forced to currency | `utils/format.ts`, `compactMetric(value, field, label)` | `utils/format.test.ts` |
| Bare format calls | All `compactMetric` sites pass field/label | Scan for single-arg calls = fail |
| Loud subtotals | `rc-subtotal-row` + CSS remap of `#167A3A` | Visual + CSS check |
| SQL chip noise | `rc-sql-debug` + parent `group`, hover/focus | Do not restyle as primary amber pills |
| Duplicate monthly grand totals | Hide sticky grand when flow KPIs present | Monthly only |
| Secondary KPI flood | `monthlySecondaryOpen` default false | Keep progressive disclosure |

If a regression appears: systematic debug Phase 1 first (read error, reproduce, check `git diff 4fe3253`).

---

## 4. Design quality guardrails (mandatory)

Before any UI edit, define in the PR/commit body:

- Page purpose  
- Primary user task  
- Information hierarchy  
- Main action / secondary actions  
- Content grouping  
- Spacing scale (4/8/12/16/24/32)  
- Color meaning  
- Component priority  

### Hierarchy every screen

1. **Context** — title, description, source, period, status, main action  
2. **Controls** — period, source, group, search, more filters, chips  
3. **Summary** — ≤6 meaningful KPIs  
4. **Insight** — exceptions, top contributors, reconciliation  
5. **Detail** — serious table  
6. **Advanced** — SQL, metadata, lineage, server profile  

### Avoid

Too many cards/borders/accents, nested cards, truncated primary numbers, neon, equal-weight buttons, SQL in Ringkasan, generic dashboard look.

### Theme

Deep forest/charcoal/navy surfaces; emerald/lime primary accent; muted amber for attention/subtotal; red only for real errors/negatives. Keep existing shell identity.

### Product language (ID-first)

`Ringkasan`, `Analisis`, `Detail Data`, `Audit Data`, `Saldo Awal`, `Penerimaan`, `Pengeluaran`, `Saldo Akhir`, `Selisih Rekonsiliasi`. Codes in tooltips/audit only.

---

## 5. Business invariants (RPTIN1000015)

Preserve verified quantities/amounts for:

Opening, Received*, Return Advice*, Transfer*, Adjustment*, Issued Ledger/Station/Vehicle/Total, Return, Purchasing GR/Return/Dispatch*, Closing, ItemType Gudang vs Workshop, dimensions (Product Type/Category/Stock Analysis/Location…), accounting vs actual period, estate|pabrik, subtotals/grand totals, URL filters, permissions, read-only SQL.

\*Respect `MONTHLY_MOVEMENT_DEFINITIONS.status`: `placeholder_zero` must be labeled, never sold as proven movement.

### Metric dictionary (primary Ringkasan ≤6)

| # | Field | Label | Kind |
| --- | --- | --- | --- |
| 1 | `OpeningAmount` | Saldo Awal | currency |
| 2 | `GoodsReceiveAmount` (or verified inventory-in aggregate) | Penerimaan | currency |
| 3 | `IssuedTotalAmount` | Pengeluaran | currency |
| 4 | `ReturnAmount` / purchasing net if verified | Retur / net other | currency |
| 5 | `ClosingAmount` | Saldo Akhir | currency |
| 6 | `TotalItem` | Jumlah Item | count |

Context chips (not money KPIs): `ActualPeriod`, accounting period, Source.

Full dictionary: `lib/reports/inventory/metric-dictionary.md`.

### Reconciliation

Only show waterfall if math verified from payload/SQL. Else transparent variance / “not directly reconcilable”. Never fake balance.

### Scope labels

Never call sample / first-N / client-window totals **full scope**. Use: server summary filtered | loaded window | sample.

---

## 6. Target architecture (incremental)

### Persistent header
Breadcrumb, title, one-line description, module, Source, proven data status, last refresh, favorite, **Export** primary, Back secondary, overflow (copy link/print).

### Sticky control bar
Actual period, movement window, source, group by, search, more filters + count, apply/reset, filter chips, URL sync.

### Workspaces (tabs; do not mount all heavy content)
1. Ringkasan  
2. Analisis (dimension explorer, not 40 identical cards)  
3. Detail Data (table tool)  
4. Audit Data (permission-aware SQL/metadata)

### Typed metrics
Use/extend:

```ts
// Dashboard_Utama/utils/format.ts
export type MetricKind =
  | 'currency' | 'quantity' | 'count' | 'percentage'
  | 'date' | 'period' | 'duration' | 'status' | 'code' | 'text'

formatKpiValue(value, field?, label?)
inferMetricKind(field?, label?)
```

One formatter path for KPI, table, chart, tooltip, export metadata. Exports keep raw numbers.

### Recommended ownership (create only if no existing equivalent)

`ReportDetailShell`, `ReportHeader`, `ReportControlBar`, `AppliedFilterBar`, `ReportWorkspaceTabs`, `ReportSummaryWorkspace`, `ReconciliationPanel`, `ScopeComparison`, `InsightQueue`, `ReportAnalysisWorkspace`, `DimensionExplorer`, `ReportDataWorkspace`, `ReportTableToolbar`, `ReportDataTable`, `ReportAuditWorkspace`, `MetricValue`, metric registry, export dialog.

**Extraction order (max 3–5 files early):**
1. Keep `utils/format.ts` ✅  
2. Keep CSS tokens ✅  
3. Cap KPI builders in `monthly-stock-account-movement` / viewer helpers  
4. Extract `MonthlyStockRingkasan.tsx` after visual sign-off  
5. Table extract last  

Do not split into 20 files on day one.

---

## 7. Critical defects still to solve

### Formatting / meaning
- Field-aware precision (not always 4 dp on qty)  
- Exact values accessible when compact used  
- Table cells use same kind inference as KPI  

### Scope / accuracy
- Server-side filter/sort/aggregate where totals must be full-scope  
- Pagination must not change primary KPIs  
- Drill-down updates detail consistently without mutating unrelated globals  

### Hierarchy
- Remove remaining duplicate totals  
- Cap Product Type collections (Top N + View all)  
- Soft subtotals already started — ensure all report profiles inherit  

### Table
- Sticky headers + identity columns  
- One deliberate scroll container  
- Column presets (Summary / Qty / Amount / All)  
- Virtualization already present — keep healthy  
- Keyboard + a11y names  

### Export / print / AI
- Export dialog: format, scope, columns, filters, expected rows, totals included  
- Excel/CSV full filtered scope (no silent 500 if user asked full)  
- PDF labeled summary vs full  
- AI optional, sample-labeled, no fabricated causes  

---

## 8. Sub-agent operating model

| Agent | Focus | File ownership |
| --- | --- | --- |
| A Auditor | Routes, configs, regression inventory | Read-only discovery |
| B Data/accounting | SQL, metric dictionary, reconciliation math | `lib/reports/inventory/*`, tests |
| C UX/IA | Hierarchy, tokens, ID copy, wire notes | CSS, shell components |
| D Table/perf | Virtualization, sticky, grouping | table sections only |
| E Export/AI | Scope honesty, payloads | export + AI routes |
| F QA | Tests, browser, a11y, screenshots | no production logic thrash |
| Lead | Integration, conflicts, final quality | merges |

**Rules:** no two agents edit the same large file concurrently; evidence-based handoffs; small commits; lead inspects every integration diff.

**Model split suggestion:** Haiku for mechanical call-site/CSS wire; Sonnet/Opus for architecture and accounting contracts.

---

## 9. Execution phases (do not declare done early)

| Phase | Deliverable |
| --- | --- |
| 1 Audit & baseline | Screenshots, behavior inventory, discrepancy list — **partially done** |
| 2 Data & presentation contract | Metric dictionary, scope model, format tests — **started** |
| 3 Structural shell | Header, controls, workspace tabs behind feature flag/fallback |
| 4 Ringkasan + Analisis | Typed KPIs, recon, Gudang/Workshop, dimension explorer — **partial Ringkasan** |
| 5 Detail Data | Toolbar, subtotals, sticky, presets, scope labels |
| 6 Audit + export + AI | Permission SQL, honest export, optional AI |
| 7 Verify & polish | Full checks both sources, empty/error/partial, a11y, final screenshots |

Continuous mode: loop Phase 4→7 until user stops or acceptance green.

---

## 10. Acceptance criteria (ship gate)

### Clarity
- First-time user sees report/source/period/filters/open/in/out/close/recon without debug  
- No SQL/server profile in default Ringkasan  
- No duplicate primary totals without purpose  
- No Product Type card flood  

### Correctness
- Periods/counts/qty/money distinct  
- No `Rp` on qty/count/period  
- No ellipsis on primary numbers  
- Totals independent of table page unless labeled  
- “Full scope” never for sample/partial  
- Recon verified or explicitly unavailable  

### Table
- Sticky context while horizontal scroll  
- Calm subtotals  
- Group/sort/filter/columns/density/search reliable  
- No nested scroll trap  

### A11y
- Keyboard, focus, aria-names, contrast AA, reduced motion  

### Export & audit
- Explicit scope/rows  
- Excel/CSV not silently truncated when full requested  
- PDF honesty  
- Audit permission-aware  

### Engineering
- Boundaries clearer than pure 6k monolith (or explicit migration path)  
- Other reports work or safe fallback  
- Tests for format/totals/filters/grouping/source/export  
- lint/tsc/tests/build pass or documented pre-existing failures  

---

## 11. Required deliverables

1. Production code (not mockups only)  
2. Metric dictionary (keep `metric-dictionary.md` current)  
3. Scope/total semantics note  
4. Before/after UX notes + screenshots  
5. Component architecture update  
6. Design token guidance  
7. Tests (format, calc, filters, table, permissions, export)  
8. Migration note for other profiles  
9. Removed/merged redundancy list  
10. Completion report: files, preserved behaviors, resolved inconsistencies, commands+results, perf/a11y, risks, routes  

---

## 12. Constraints

- Preserve unrelated user work  
- No destructive DB ops; read-only report SQL  
- No secrets in commits  
- No fake anomaly thresholds  
- No charts for decoration  
- No color without meaning  
- No unreviewable big-bang engine rewrite  
- No stopping at proposal only (unless user pauses)  
- Safe fallback while migrating profiles  

---

## 13. Immediate start checklist for next agent

```text
[ ] Read REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md
[ ] Read metric-dictionary.md
[ ] Read REPORT_CENTER_DEBUG_REPORT_2026-07-21.md
[ ] git log -3 --oneline ; note 05dd66b / 4fe3253
[ ] npx tsx utils/format.test.ts
[ ] npx tsc --noEmit
[ ] Reproduce monthly report in browser if server up
[ ] Confirm 0 bare compactMetric( calls
[ ] Cap data-layer primary KPIs to verified 6
[ ] Browser screenshot Ringkasan default (secondary collapsed)
[ ] Only then continue Phase 4/5
```

### Commands

```bash
cd "Dashboard_Utama"
npx tsx utils/format.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsc --noEmit
```

### Forbidden regressions

- Reintroducing currency-only `compactMetric`  
- Restoring solid orange/green subtotal fills  
- Always-visible SQL amber pills on KPI faces  
- Always-expanded product-type card walls on monthly default  
- Inventing Received/Transfer/Adjustment as real if still `placeholder_zero`  

---

## 14. Final standard

The product must feel like a **premium enterprise accounting/ops analytics app**: clean, structured, calm, trustworthy, information-dense when needed, comfortable for long sessions — **the current forest app matured**, not replaced by a random template.

Start now. Prefer evidence over aesthetics. Prefer root-cause fixes over polish theater. Keep agents aligned via the shared docs in §0.
