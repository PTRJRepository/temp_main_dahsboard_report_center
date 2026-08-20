# Report Center Redesign — Risk & Regression Register

**Date:** 2026-07-21  
**Use:** Before every PR touching Report Detail / inventory catalog.

---

## 1. Accounting / data risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-A1 | Changing flow KPI values while restyling | Only restyle; keep `pickSummaryOnly`; run monthly tests |
| R-A2 | Summing table rows for grand totals | Forbidden; summary only for flow |
| R-A3 | Treating placeholder_zero as real movement | Status badge / hide from primary 6 |
| R-A4 | Acc vs actual period fight | Clear Acc* when setting period; clear period when setting Acc |
| R-A5 | Workshop ItemType 4 wrong table | Keep WS_JOBSTOCK rules; don’t “simplify” joins |
| R-A6 | Estate GR empty IN_STOCKRECEIVE | PU_GOODSRCV path only where required |
| R-A7 | Match JSON preset hard-codes 2026-07 | Label as contoh; don’t make default |

## 2. Scope honesty risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-S1 | PDF looks official | Watermark + rename button |
| R-S2 | Excel silent 20k/100k cap | Preflight + toast |
| R-S3 | AI sample as full truth | Chips sampleRows |
| R-S4 | Subtotals on partial window | Label “baris termuat” |
| R-S5 | resultLimit=100 presets | Banner not full inventory |
| R-S6 | Stream incomplete | Badge until streamComplete |

## 3. UX / layout risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-U1 | Sticky Ringkasan too tall | Sticky control only |
| R-U2 | Nested scroll traps | One table scroll owner |
| R-U3 | Rainbow cards vs forest home | AnalyticsKpiStrip / tokens |
| R-U4 | Duplicate period controls | Single ControlBar |
| R-U5 | Toolbar action overload | Overflow + workspace tabs |
| R-U6 | Light strip in dark table | Tokenized dark only |
| R-U7 | Equal weight drill cards | DimensionExplorer |

## 4. Engineering risks

| ID | Risk | Mitigation |
| --- | --- | --- |
| R-E1 | Parallel edit 6k viewer | Extract first; file ownership |
| R-E2 | Profile drift catalog vs viewer | Shared analysis-group module |
| R-E3 | Duplicate export implementations | One ExportMenu |
| R-E4 | Currency regression | format.test.ts gate |
| R-E5 | Page bounce loading loop | Never setPage from response casually |
| R-E6 | Windows agent write stalls | Orchestrator writes large files |
| R-E7 | Commit secrets | Never .env |
| R-E8 | Big-bang rewrite | Phases P1–P9 |

## 5. Regression checklist (manual)

```
[ ] Monthly open default: secondary collapsed, 5–6 primary story visible
[ ] Period change updates KPI + URL
[ ] Source estate/pabrik switch refetches
[ ] Filter chip remove works
[ ] Table sort/group/columns
[ ] Fullscreen exit
[ ] CSV downloads
[ ] Excel opens
[ ] PDF clearly preview
[ ] AI sample labeled
[ ] Other profile reports: aging, movement, valuation still load
[ ] Favorite/recent
[ ] No Rp on period/qty/count
```

## 6. Automated gate

```bash
cd Dashboard_Utama
npx tsx utils/format.test.ts
npx tsx lib/reports/inventory/monthly-stock-account-movement.test.ts
npx tsx lib/reports/report-detail-performance.test.ts
npx tsx lib/reports/report-filtering.test.ts
npx tsx lib/reports/ai-evidence.test.ts
npx tsc --noEmit
```

---

**End risk register.**
