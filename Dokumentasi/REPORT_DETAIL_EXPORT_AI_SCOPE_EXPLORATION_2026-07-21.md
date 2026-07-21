# Report Detail — Export, AI & Scope Honesty (Deep Exploration)

**Date:** 2026-07-21  
**Scope:** How exports, AI analysis, and “full scope vs sample” labels actually work on inventory report detail (esp. monthly movement).  
**Primary code:**  
- `ReportViewerClient.tsx` export helpers + AI effect  
- `app/api/reports/inventory/route.ts` limit/export/csv  
- `lib/reports/report-detail-performance.ts` (`compactReportPayloadForAi`, table window)  
- `lib/reports/ai-evidence.ts`  
- `app/api/reports/[reportCode]/ai-analysis/route.ts`  
- `app/api/reports/ai-insight/route.ts`  
- `lib/reports/report-experience.ts` (`ReportDetailWindowMetadata`, scopes)

**Companions:**  
- `Dokumentasi/REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md`  
- `Dokumentasi/REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md`  
- `Dokumentasi/REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md`

---

## 0. Executive diagnosis

| Channel | User expectation | Actual behavior | Honesty risk |
| --- | --- | --- | --- |
| KPI / Ringkasan | Totals for filtered period | **Server `summary`** (correct intent for monthly flow) | Low if labeled; medium if UI says “full” without chip |
| Table view | See all matching rows | First window / page + optional **stream** for monthly | Medium — stream badge exists; easy to miss |
| CSV | Full filtered export | Server `format=csv` + `limit=all` → monthly **≤100k**, others **≤20k** | Medium if > ceiling silent |
| Excel | Full filtered export | Client `fetchReport(..., 'all')` then **xlsx in browser** | High — memory + same ceiling; no dialog |
| PDF | “Report PDF” | Client **≤34 rows**, **≤7 columns**, landscape jspdf text | **Critical** — looks like full report |
| AI insight | Analysis of report | Compacted **sample 50 rows / 40 cols** (+ summary) | High if UI omits “sample” |
| AI cache | Fresh on filter change | `sessionStorage` key includes filters+source+report | OK if key complete |

**Product trust rule:** never say “full scope” for sample, page, or truncated export. Prefer three labels only:

1. **Ringkasan server (terfilter)** — SQL aggregates  
2. **Baris termuat / stream** — what table holds now  
3. **Sampel AI** — compacted evidence  

---

## 1. Scope vocabulary (code contracts)

### 1.1 KPI card `scope` (presentation rails)

In viewer: `'global' | 'flow' | 'breakdown' | 'sub' | 'movement'`

This is **UI rail taxonomy**, not export scope.

### 1.2 `ReportKpiScope` / evidence (experience layer)

Used in analytics contracts and AI evidence metrics — values like `full-scope` appear in tests (`ai-evidence.test.ts`). Agents must not invent new scope strings; align with `report-experience.ts`.

### 1.3 `ReportDetailWindowMetadata`

```ts
strategy: 'all' | 'page' | 'window' | 'balanced' | 'sample'
partial: boolean
totalRows, filteredRows, returnedRows, loadedRows, maxLoadedRows, reachableRows, pageCount
```

Helper: `isReportDetailWindowPartial` → `partial || returnedRows < filteredRows`.

### 1.4 Inventory API tableRowsScope strings

Handlers set metadata notes e.g.:

- Full listing request/export  
- Rows table paginated for fast render; **summary remains full dataset**

Monthly export/stream ceiling explicitly raised so table is not hard-capped at 20k.

---

## 2. Limit matrix (API)

From `inventory/route.ts` `handleInventoryGet`:

| Condition | Limit |
| --- | --- |
| Normal interactive | `min(page * pageSize, TABLE_WINDOW_ROW_LIMIT)` |
| `format=csv` OR wants all rows | `limitAll = true` |
| limitAll + monthly RPTIN1000015 | **100_000** |
| limitAll + other reports | **20_000** |
| Hold report | 409, no data |

`exportAll = format === 'csv' || wantsAllRows(request)`.

Viewer first paint: `TABLE_FIRST_LIMIT = 500`, `pageSize` default **100**.

Monthly after paint: client may **stream** additional pages/chunks; KPI merge prefers fuller summary fields; `streamComplete` in metadata when done.

---

## 3. Export channels (detailed)

### 3.1 CSV — server attachment

```ts
downloadCsv:
  buildReportParams(report, source, 'all', filters)
  params.set('format', 'csv')
  anchor → GET /api/reports/inventory?...
```

- Content-Disposition filename from API  
- Rows generated server-side under limitAll ceiling  
- **No UI confirmation** of expected row count  
- If true filtered set > 100k monthly / 20k other → **silent truncation risk** unless API errors (verify handler behavior when exceeding)

### 3.2 Excel — client-side XLSX

```ts
exportExcel:
  fetchReport(report, source, 'all', filters)  // JSON full attempt
  rows = payload.rows
  if empty return
  dynamic import('xlsx')
  json_to_sheet(rows) → writeFile(`${report.id}.xlsx`)
```

Issues:

1. Same `limitAll` ceiling as JSON all-rows (20k/100k) — not infinite  
2. Entire row array in browser memory — can freeze tab on large monthly  
3. No sheet for summary/KPI — data rows only  
4. No filter legend, period, source on cover sheet  
5. No progress UI / cancel  
6. Button sits equal-weight next to PDF (which is not equivalent fidelity)

**There is also** `components/shared/ExportButtonGroup.tsx` + `lib/hooks/useExport.ts` (job queue API `/exports`) used elsewhere — **report detail does not use the job queue**. Two export worlds; detail uses ad-hoc path.

### 3.3 PDF — client snapshot (worst honesty)

```ts
exportPdf(report, filteredRows, visibleColumns):
  landscape jspdf
  title
  header = first 7 column names joined
  rows.slice(0, 34) each line text join formatValue, max 165 chars
  save file
```

Called as: `exportPdf(report, filteredRows, visibleColumns)` from table toolbar.

So PDF is:

- At most **34 rows of whatever is currently filtered in client memory**  
- At most **7 columns** (not full visible set if >7)  
- No KPI strip, no period banner requirement, no “sampel” watermark in code  
- **Not** server PDF of RPTIN official layout  

**Must label in UI:** `PDF pratinjau (maks 34 baris)` or replace with proper server print later.

### 3.4 Print / Copy link

- `window.print()` — dumps current DOM (includes sticky chrome noise)  
- Copy link — good for filter URL share  

### 3.5 Export dialog (missing — target)

Required fields for professional export:

| Field | Why |
| --- | --- |
| Format CSV / Excel / PDF | Different fidelity |
| Scope: full filtered vs current table window vs sample | Honesty |
| Expected max rows (from metadata.filteredRows) | User consent |
| Columns: visible / preset / all | Excel/PDF |
| Include summary sheet | Accounting |
| Include active filters text | Audit |
| Warn if > N rows (client Excel) | Performance |
| For PDF: explicit preview-only | Prevent false official docs |

Until dialog exists: button labels must encode limits.

---

## 4. AI pipeline (detailed)

### 4.1 Trigger

- User opens AI insight (`aiInsightVisible` / jumpToAnalysis('ai'))  
- Requires `payload`, `tableReady`, `analysisReady`  
- **2s delay** so table paints first  
- Cache: `sessionStorage` key `ai:${report.id}:${source}:${JSON.stringify(requestFilters)}`

### 4.2 Payload compaction (always)

Client:

```ts
compactReportPayloadForAi(payload, { sampleRows: 50, maxColumns: 40 })
```

Server ai-analysis route **compacts again** similarly; evidence builder often **12 sample rows**.

Metadata stamped:

- `aiPayloadCompacted: true`  
- `aiOriginalRows`, `aiOriginalColumns`  
- `aiSampleRows`, `aiSampleColumns`  

### 4.3 Endpoints

| Route | Role |
| --- | --- |
| `POST /api/reports/{reportCode}/ai-analysis` | Structured dashboard definition from compacted payload + filters |
| `POST /api/reports/ai-insight` | Heuristic / LLM insight cards from sample context |
| `POST /api/reports/natural-filter` | NL → `ReportFilterInput` (not analysis) |

AI must not receive secrets: `ai-evidence` strips keys matching password/token/sql/query patterns.

### 4.4 What AI is allowed to claim

**Safe:**

- Patterns in **sample rows** with explicit “berdasarkan sampel N baris”  
- Commentary on **summary KPI** if those fields are passed as full-scope metrics  
- Filter-aware questions  

**Unsafe (forbid in prompts/UI):**

- “Seluruh gudang menunjukkan…” from 50 rows  
- Invented root causes without evidence paths  
- Treating placeholder_zero movements as real volume  
- Replacing accounting formulas  

### 4.5 UI honesty gaps

- Toolbar button “Tampilkan AI Insight” does not say sample  
- Cached AI can look “authoritative” after filter change if key bug (currently includes filters — good)  
- No persistent chip on AI panel: `Sampel 50 baris · ringkasan server terpisah`  
- Charts generated by AI may be misread as official report charts  

### 4.6 Target AI panel chrome

```
┌ AI Insight ─────────────────────────────────────┐
│ Chip: Sampel 50 baris / 40 kolom                │
│ Chip: KPI dari summary server (jika dipakai)    │
│ Chip: Filter aktif: …                           │
│ [Refresh] clears cache                          │
│ Body: findings with valuePath / evidence        │
│ Footer: “Bukan audit resmi · verifikasi di tabel”│
└─────────────────────────────────────────────────┘
```

---

## 5. Scope honesty matrix (who may say what)

| UI element | May say full filtered summary? | May say full row listing? | Must say sample/partial? |
| --- | --- | --- | --- |
| Flow KPI from summary | Yes | No | If summary missing fields |
| Sticky grand from flow | Yes (same) | No | |
| Table row count while streaming | No | “termuat L dari T” | Yes while streaming |
| Table after streamComplete + rows≥filtered | Cautious yes if metadata agrees | Yes if verified | |
| Group subtotals on loaded rows only | No as full scope | “subtotal baris termuat” | Yes if partial window |
| CSV export | Yes up to ceiling | Yes up to ceiling | Warn if truncated |
| Excel client | Same as fetch all | Same | Warn memory + ceiling |
| PDF | Never | Never | **Always** preview/sample |
| AI | Only for summary metrics passed as such | Never | **Always** sample for rows |
| Analysis band breakdowns | If from server chart/summary | No | If from page rows |

### Guardrails already in viewer (preserve)

- Flow KPI: `pickSummaryOnly` — never sum page rows  
- Issued total prefers SQL IssuedTotalAmount  
- Monthly stream: KPI not replaced by window sums  
- `rc-scope-chip` text exists (“summary server · bukan sample”) — expand to all surfaces  

### Gaps to close

1. PDF unlabeled  
2. Excel unlabeled ceiling  
3. Subtotal rows can be mistaken for full-group population when window partial  
4. English/ID mix on scope chips  
5. Export queue system unused by detail (inconsistent product)  
6. `resultLimit` presets (e.g. 100) can shrink data without loud banner  

---

## 6. Metadata fields agents should surface

When present on `payload.metadata` / analytics.detailWindow:

| Field | UI use |
| --- | --- |
| `filteredRows` / `totalRows` | Denominator |
| `returnedRows` / `loadedRows` | Numerator table |
| `paginated` / `windowed` | Strategy |
| `streamComplete` | Monthly stream done |
| `tableRowsScope` | Tooltip copy |
| `actualPeriod` / `accountingPeriod` | Context chips |
| `aiPayloadCompacted` + aiSample* | AI panel |
| `partial` | Force partial chip |

Never invent counts client-side that contradict summary.TotalItem without labeling conflict.

---

## 7. Recommended product behavior (target)

### 7.1 Export menu

```
Export ▾
  Excel (server/job or client with warn) — full filtered ≤ ceiling
  CSV — full filtered ≤ ceiling  
  PDF pratinjau — 34×7 watermark
  ────────────────
  Antrian export (future) — large jobs
```

Preflight dialog:

```
Periode: 2026-07 | Sumber: pabrik | Filter: n
Perkiraan baris: 12.450 (metadata)
Batas sistem: 100.000 (monthly)
[ ] Sertakan lembar Ringkasan
[Lanjut] [Batal]
```

### 7.2 Streaming table

Keep badge; add permanent footer:

`Menampilkan {loaded} / {filtered} baris · KPI dari ringkasan server`

### 7.3 AI

Default closed; when open always sample chips; refresh invalidates cache; findings cite `valuePath` / metric id from evidence bundle.

### 7.4 Engineering convergence

Prefer one export path long-term:

- Small: sync CSV/Excel  
- Large: `useExport` job queue + notify  

Do not leave three incompatible UX patterns (detail ad-hoc, shared ExportButtonGroup, AI dashboard CSV).

---

## 8. Implementation slices (export/AI only)

| Slice | Work | Risk |
| --- | --- | --- |
| H1 | Rename PDF button + watermark text in PDF body | Low |
| H2 | Excel/CSV toast: “hingga N baris (batas sistem)” using metadata | Low |
| H3 | AI panel chips from compact metadata | Low |
| H4 | Export preflight modal component | Med |
| H5 | Server Excel stream / job for monthly >10k | High |
| H6 | Remove or gate PDF as non-official | Low |
| H7 | Align detail with ExportButtonGroup/queue | Med |

Do **not** change accounting SQL in these slices.

---

## 9. Test / verification checklist

```text
[ ] CSV download with known filter → row count ≤ ceiling; matches filteredRows if under ceiling
[ ] Excel same; browser does not OOM on mid-size
[ ] PDF always ≤34 lines; filename clear
[ ] Change filter → AI cache miss → new run
[ ] AI panel shows sample counts
[ ] Monthly stream: KPI stable while loaded rows increase
[ ] resultLimit=100 preset: banner not “full inventory”
[ ] No SQL/secrets in AI evidence keys
[ ] format tests + monthly tests still pass
```

Commands:

```bash
cd Dashboard_Utama
npx tsx lib/reports/ai-evidence.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsx app/api/reports/ai-insight/route.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
```

---

## 10. ASCII scope story (monthly)

```
SQL Gateway
   │
   ├─ summary aggregates ──────────► Ringkasan KPI (FULL FILTERED SUMMARY)
   │
   ├─ rows window/stream ≤100k ───► Table (LOADED / STREAMING)
   │         │
   │         ├─ CSV export limitAll ≤100k
   │         ├─ Excel client fetch all ≤100k (memory risk)
   │         └─ PDF ← filteredRows.slice(0,34)  (SAMPLE PREVIEW)
   │
   └─ compact 50×40 ───────────────► AI (SAMPLE + optional summary fields)
```

---

## 11. Agent one-liner

> KPI summary = server full filtered; table = loaded/stream; CSV/Excel = capped full attempt (100k monthly / 20k else) without dialog; PDF = **34×7 preview** mislabeled as export; AI = **50×40 sample** with weak UI labeling. Redesign = labels + preflight + optional job queue — not more silent buttons.

---

## 12. Doc pack index (exploration series)

| # | File | Topic |
| --- | --- | --- |
| 1 | `REPORT_CENTER_REFACTOR_CONTEXT_FOR_AGENTS_2026-07-21.md` | App map, IA, monolith, phases |
| 2 | `REPORT_DETAIL_CARD_LAYOUT_EXPLORATION_2026-07-21.md` | KPI/card composition |
| 3 | `REPORT_DETAIL_TABLE_AND_FILTERS_EXPLORATION_2026-07-21.md` | Filters + table tool |
| 4 | **This file** | Export, AI, scope honesty |
| + | `REPORT_CENTER_DEBUG_REPORT_2026-07-21.md` | Root-cause fixes already landed |
| + | `MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md` | Full agent charter |
| + | `REPORT_DETAIL_IMPLEMENTATION_REFERENCE.md` | Shared contract |
| + | `metric-dictionary.md` | RPTIN1000015 metrics |

---

**End of export / AI / scope exploration.**
