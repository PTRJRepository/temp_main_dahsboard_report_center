# Report Detail Implementation Reference

Shared contract so every coding agent produces the **same** output for the Report Center redesign.

**Baseline checkpoint (rollback):** `05dd66b`  
`git reset --hard 05dd66b` restores pre-redesign snapshot.

**First report:** `monthly-stock-account-movement-details` / `RPTIN1000015`

---

## 0. Design quality (mandatory)

Page purpose: accounting stock movement detail  
Primary task: open → in → out → close for period/source  
Hierarchy: Context → Controls → Summary → Insight → Detail → Advanced  
Main action: Export  
Theme: existing dark forest — mature, not replaced

Never: random cards, neon overload, equal-weight everything, truncated primary numbers, SQL in executive view.

---

## 1. Source of truth order

1. Repository + runtime  
2. SQL/handlers/tests/payloads  
3. Screenshots (UX evidence)  
4. Markdown docs (may be stale)  
5. Master redesign prompt (direction only)

Do not invent formulas. Verify in code.

---

## 2. Files that own behavior

| Concern | Path |
| --- | --- |
| Report viewer monolith | `Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx` |
| Monthly SQL/payload | `Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts` |
| Metric dictionary | `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md` |
| Typed formatters | `Dashboard_Utama/utils/format.ts` |
| Format tests | `Dashboard_Utama/utils/format.test.ts` |
| Experience types | `Dashboard_Utama/lib/reports/report-experience.ts` |
| Tokens / hierarchy CSS | `Dashboard_Utama/app/globals.css` (`.report-center-dark`, `.rc-*`) |
| Inventory API | `Dashboard_Utama/app/api/reports/inventory/route.ts` |

---

## 3. Formatting contract

```ts
import { formatMetric, formatKpiValue, inferMetricKind } from '@/utils/format'

// ALWAYS pass field or label
formatKpiValue(value, fieldKey, label)
// NEVER: formatCurrency(unknownField)
```

Kinds: `currency | quantity | count | percentage | date | period | duration | status | code | text`

Rules:

- Period labels → plain text  
- Qty → no `Rp`  
- Count → integer, no `Rp`  
- Money → `Rp` + 4 decimals id-ID  
- Primary KPI values use class `rc-kpi-value` (no truncate)

---

## 4. Ringkasan (default workspace)

Max **6** primary metrics for RPTIN1000015:

1. `OpeningAmount` — Saldo Awal (currency)  
2. `GoodsReceiveAmount` — Penerimaan (currency)  
3. `IssuedTotalAmount` — Pengeluaran (currency)  
4. `ReturnAmount` — Retur (currency)  
5. `ClosingAmount` — Saldo Akhir (currency)  
6. `TotalItem` — Jumlah Item (count)

Show period + source as context chips, not currency KPIs.

Collapse by default:

- SQL debug buttons (class `rc-sql-debug`)  
- Product Type card floods (scroll/cap or Dimension Explorer later)  
- Raw metadata / server profile / full SQL  

Breakdown Gudang vs Workshop: compact comparison, typed amount/qty/count.

---

## 5. Subtotals

- Class preference: `rc-subtotal-row`  
- Calm amber tint + left accent edge  
- Not solid orange/green warning fill  
- CSS already remaps legacy `#167A3A` under `.report-center-dark`

---

## 6. Scope honesty

Labels must say one of:

- Full filtered (server summary)  
- Loaded window  
- Sample (AI)

Never “full scope” for first-N rows or AI sample.

---

## 7. Incremental extraction order (later)

Do not big-bang rewrite. Order:

1. `utils/format.ts` ✅  
2. CSS hierarchy tokens ✅  
3. Wire formatters + calm subtotals in viewer (in progress)  
4. Extract `ReportKpiStrip` / flow cards only after behavior stable  
5. Extract table body last  

Max new files early: 3–5.

---

## 8. Sub-agent split

| Agent | Model | Owns |
| --- | --- | --- |
| Mechanical UI wire | Haiku | Call-site format args, truncate removal, SQL demotion classes |
| Architecture | Sonnet 4.6 | Hierarchy blueprint, extraction plan |
| Lead | Session model | Integration, commits, acceptance |

Non-overlapping files when parallel.

---

## 9. Acceptance (minimum)

- [ ] No period/qty/count shown as `Rp`  
- [ ] Primary KPI values fully readable  
- [ ] Subtotals calm  
- [ ] SQL not primary visual  
- [ ] Dark forest theme preserved  
- [ ] `npx tsx utils/format.test.ts` passes  
- [ ] Rollback still `05dd66b`  

---

## 10. Continuous mode

Work until user manually stops. Prefer small verified diffs + re-test over large untested rewrites.
