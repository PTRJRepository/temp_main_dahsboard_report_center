# Report Center — Screenshot & Visual QA Checklist

**Date:** 2026-07-21  
**Use:** After each UI phase (P1+). Store under `Dokumentasi/screenshots/` or attach to PR.  
**First route:** `/report-center/inventory/monthly-stock-account-movement-details`

---

## 0. Capture setup

- Browser: Chromium, 1440×900 and 1920×1080  
- Theme: forest dark (default V2)  
- Source: one set **pabrik**, one set **estate** if data differs  
- Period: fixed known month (document which)  
- Zoom 100% and 125%  

Filename pattern:

```
YYYYMMDD-monthly-{view}-{state}-{WxH}.png
e.g. 20260721-monthly-ringkasan-default-1440x900.png
```

---

## 1. Mandatory shots (monthly)

| # | State | Pass criteria |
| --- | --- | --- |
| S1 | Loading initial | Loading screen clear; no half KPI |
| S2 | Ringkasan default | ≤6 primary metrics; secondary collapsed; no SQL visible at rest |
| S3 | Ringkasan + active chips | Chips only one bar; clear all visible |
| S4 | Filter drawer open | Period not triplicated; advanced only here |
| S5 | Issued rincian open | No full-width rose duplicate panel |
| S6 | Detail tab / table | Toolbar not overcrowded; scope line visible |
| S7 | Table streaming | Badge honest |
| S8 | Table fullscreen | Exit obvious; no double scroll trap |
| S9 | Group + subtotal | Calm subtotal (not solid warning) |
| S10 | Export menu | PDF labeled preview; ceiling note if any |
| S11 | AI open | Sample chips visible |
| S12 | Audit/SQL | SQL not on Ringkasan |
| S13 | Empty filters reset | Clean default |
| S14 | Error state | Readable, recoverable |
| S15 | Mobile/narrow 390px | Control stacks; values not clipped |

---

## 2. Visual rubric (score each 1–5)

| Criterion | 5 means |
| --- | --- |
| Hierarchy | Eye hits title → period → open/close in 5s |
| Density | Dense but calm; not card spam |
| Alignment | Columns/grids consistent 8px rhythm |
| Color | One accent family; semantic color rare |
| Type | Primary numbers fully readable, tabular |
| Honesty | Scope labels correct |
| Identity | Matches forest home, not random template |
| A11y focus | Focus rings visible when tabbing |

Ship gate: no criterion below 3; hierarchy + honesty ≥4.

---

## 3. Regression compare

Compare against:

- Checkpoint UI at `4fe3253` if needed  
- HTML target: `Dokumentasi/mocks/report-detail-monthly-wireframe-2026-07-21.html`  

Diff notes in PR: what moved, what deleted (redundancy list).

---

## 4. Other reports smoke (after monthly)

One screenshot each default open:

- `all-stock-movement-analysis`  
- `item-stale-update`  
- `asset-stock-valuasi-listing`  
- `stok-gudang`  

Ensure shell still works; profile fallback OK.

---

## 5. Catalog page

| Shot | Criteria |
| --- | --- |
| Inventory catalog default | Jump nav sticky works |
| Group scrolled | Section headers clear |
| Open monthly from tile | Handoff URL keeps source |

---

## 6. Agent output format

```
QA: PASS/FAIL
Period/source used:
Shots: [list paths]
Failures: [criterion + shot]
```

---

**End screenshot checklist.**
