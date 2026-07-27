# Inventory Ops PDF Design — Shared Template (Approach A)

**Date:** 2026-07-24  
**Status:** approved direction (user: every live inventory report · estate ops print pack · Approach A)  
**Scope:** 19 live inventory reports via existing Export PDF path  
**Skills:** brainstorming · hallmark · pdf  

---

## Locked decisions

| Decision | Choice |
|---|---|
| Scope | Every **live** inventory report (`status !== hold`) — not raw DB table dumps |
| Audience | Estate ops print pack (warehouse / workshop / estate managers) |
| Architecture | **One shared ops template**; report fills title / code / filters / columns |
| Engine | Client-side **jsPDF** (already in `Dashboard_Utama/package.json`) |
| Tone | High-contrast, printable, practical beauty — no luxury cover, no charts v1 |
| Language | Indonesian UI labels already used in viewer; PDF chrome bilingual-safe (code + title as-is) |

---

## Problem with current PDF

`Dashboard_Utama/lib/reports/export-pdf-preview.ts` (`saveReportPdfPreview`):

- Landscape A4, max **34 rows × 7 columns**
- Giant **PRATINJAU** watermark + footer “bukan laporan resmi”
- Flat grey header, no real hierarchy, no page n/N, no truncation honesty beyond preview language
- All 19 reports share this draft path via `exportPdf()` in `ReportViewerClient.tsx`

Ops need a **real printable pack**, still one engine.

---

## Design system (Hallmark · ops / utilitarian · technical)

**Genre:** utilitarian + technical (estate print desk).  
**Not:** SaaS landing chrome, atmospheric dark UI, invented metrics.

### Tokens (map to jsPDF RGB; no mid-render improvisation)

| Token | Role | Approx |
|---|---|---|
| `--ink` | body text | near-black `#141A16` |
| `--ink-muted` | meta / filters | `#4A554C` |
| `--paper` | page | `#FFFFFF` |
| `--paper-zebra` | alt row | `#F3F6F3` |
| `--rule` | top rule + header bar | `#0B2A1C` (deep estate green) |
| `--rule-soft` | hairlines | `#C9D2CB` |
| `--header-fg` | on dark bar | `#F5FFF5` |
| `--accent` | code pill / focus | `#1F6B45` |
| `--warn` | truncation notice | `#8A5A00` |

**Type (jsPDF standard fonts only in v1 — no custom embed):**

- Titles / body: `helvetica`
- Codes / filters / footer: `helvetica` (small) — treat as mono-feel via size + tracking discipline
- No italic headers

**Spacing:** 4pt grid — margins 28–32pt; row height 14–16pt for density.

---

## Page architecture (every page)

```
┌─────────────────────────────────────────────────────────────┐
│ ██ top rule 3pt (--rule)                                    │
│ PTRJ · Report Center          Estate | 2026-07 | 24/07/26   │
│ INV-01                         source · period · generated  │
│                                                             │
│ Posisi Stok & Nilai Inventory                               │
│ Optional one-line description…                              │
│                                                             │
│ Filters: ItemType=1,4 · Loc=… · AccYear=2026                │
│ ─────────────────────────────────────────────────────────── │
│ ▓▓▓ dark header bar · column labels · numeric right ▓▓▓▓▓▓▓ │
│ row … zebra …                                               │
│ row …                                                       │
│ …                                                           │
│ footer: stok-gudang · p.2/5 · rows 35–68 of 1.240 · R/O   │
└─────────────────────────────────────────────────────────────┘
```

### Rules

1. **A4 landscape** default. Portrait only if `columns.length <= 4` and no wide amount fields.
2. **Repeat masthead + table header** on every page.
3. **Numeric columns** right-aligned (reuse `isNumericValue` / existing `formatValue`).
4. **Column cap:** prefer **visible columns from viewer**, not hard-coded 7. Soft max ~10; if more, drop lowest-priority text fields first (keep ItemCode, LocCode, Qty*, Amount*, Movement*).
5. **Row cap:** use same honesty model as Excel — export the rows already fetched for the confirmed export, or fetch `all` with `exportRowCeiling` (20_000 / 100_000 monthly). PDF practical soft cap for browser: **2_000 rows** default with footer `showing X of Y (truncated — use Excel for full)`.
6. **No watermark.** Official ops export language.
7. **Empty state:** single page with masthead + “Tidak ada baris untuk diekspor.”
8. **Filename:** `${reportId}-${periodOrCurrent}.pdf` (kebab-safe).

---

## Content mapping (sesuai report-nya)

| PDF field | Source |
|---|---|
| code | `report.code` |
| title | `report.title` |
| description | `report.description` (1 line, truncated) |
| reportId | `report.id` |
| sourceLabel | `sourceLabel(source)` (Estate / Pabrik) |
| periodLabel | `filters.period \|\| filters.accYear \|\| 'Current'` |
| filters | active non-empty filter entries |
| columns | viewer column list / export preflight columns |
| rows | confirmed export rows |
| formatValue / displayColumnLabel | existing ReportViewer helpers |

No invented KPIs. No fake “+47%”. Charts deferred (v2 optional later).

---

## Component / file plan (shortest diff)

| Action | Path |
|---|---|
| **Rewrite** | `Dashboard_Utama/lib/reports/export-pdf-preview.ts` → keep export name `saveReportPdfPreview` **or** rename to `saveInventoryOpsPdf` + update import in viewer |
| **Touch** | `ReportViewerClient.tsx` — `exportPdf()` only if signature/name changes; drop “preview” copy in UI if any |
| **Optional** | tiny pure helpers in same file: `activeFilterText`, `pickPdfColumns`, `drawMasthead`, `drawTable` |
| **No new dependency** | stay on `jspdf` only |
| **Test** | one assert-based self-check or small node/tsx test for column pick + filter text + filename |

### API shape (proposed)

```ts
export type InventoryOpsPdfInput = {
  reportId: string
  reportTitle: string
  reportCode?: string
  description?: string
  sourceLabel: string
  periodLabel?: string
  generatedAt?: string
  filters?: Record<string, unknown>
  rows: Array<Record<string, unknown>>
  columns: string[]
  totalRowCount?: number // if known and > rows.length
  maxRows?: number       // default 2000
  maxColumns?: number    // default 10
  formatValue: (value: unknown, field?: string) => string
  displayColumnLabel: (column: string) => string
}

export async function saveInventoryOpsPdf(input: InventoryOpsPdfInput): Promise<void>
```

Keep `saveReportPdfPreview` as deprecated alias calling the new function for one release if needed (YAGNI: prefer single rename + one import fix).

---

## Draw pipeline (jsPDF)

1. Create landscape A4 pt doc  
2. For each page of rows:
   - `drawTopRule`
   - `drawMasthead` (org · code · source · period · time)
   - `drawTitle`
   - `drawFilterStamp`
   - `drawColumnHeader`
   - `drawRows` until bottom margin
3. `drawFooter` on every page (page index after full build or two-pass page count)
4. `doc.save(filename)`

Helpers stay private in the module. No React components for PDF.

---

## UI copy changes (viewer)

- Export preflight “Official PDF scope” can stay if accurate; remove any “pratinjau / bukan resmi” if present.
- Success alert: `PDF: N baris · M kolom · {filename}` (mirror Excel honesty).

---

## Out of scope (v1)

- Per-report custom layouts  
- Group accent skins (Approach B — later)  
- Embedded charts / KPI cover  
- Custom font files  
- Server-side PDF generation  
- Non-inventory modules (payroll, HR, …)  
- Raw 33-table dumps  

---

## Success criteria

1. All 19 live reports can export PDF from existing Export PDF button.  
2. No PRATINJAU watermark.  
3. Masthead + filters + page n/N + truncation footer present.  
4. Numeric right-align; zebra rows; dark header bar.  
5. Same filter set as on-screen export preflight.  
6. No new npm dependency.  
7. Printable on B&W (contrast holds when green → grey).  

---

## Implementation order

1. Replace PDF engine module (layout + tokens + pagination).  
2. Wire `exportPdf` / rename import.  
3. Manual smoke: `stok-gudang` + one wide transaction report (e.g. monthly stock movement).  
4. Optional unit test for `activeFilterText` + `pickPdfColumns` + `safeFilePart`.  
5. Later: Approach B group accents if ops want color coding.

---

## Hallmark pre-emit critique (design artifact)

/* Hallmark · pre-emit critique: P4 H5 E4 S4 R5 V3 */  
- Philosophy 4 — ops print desk, not decorative SaaS  
- Hierarchy 5 — rule → masthead → title → filters → table  
- Execution 4 — constrained by jsPDF standard fonts  
- Specificity 4 — estate green ink, inventory column priorities  
- Restraint 5 — no cover, no charts, no watermark theatre  
- Variety 3 — intentional sameness across 19 reports (ops eye path)

---

## Open for implementation kickoff

Ready to implement when user says go. Default work: rewrite `export-pdf-preview.ts` + thin viewer wire.  
}
