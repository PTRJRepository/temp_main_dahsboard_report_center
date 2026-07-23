# Claude Code Audit

**Scope:** Report Center UI/export/performance (read-only)  
**Method:** Hallmark audit + a11y pass + code fact-check  
**Monolit size:** `ReportViewerClient.tsx` ~5068 baris / ~246 KB · `InventoryReportsClient.tsx` ~2500 baris / ~116 KB

## Overall score /10

**6.4 / 10**

Sistem sudah punya DNA visual kuat (forest tokens, command deck, export honesty di detail path, virtual table). Gap utama: PDF masih “text dump”, dual export path tidak jujur di catalog, monolit + 8 parallel KPI fetch, a11y dialog/table, densitas kognitif tinggi.

## Scorecard (dimension | score | gap severity)

| Dimension | Score | Gap severity |
|---|---:|---|
| 1. Estetika UI overall (forest, hierarchy, density, consistency) | **7.2** | Medium |
| 2. KPI deck / command deck visual quality | **7.5** | Medium |
| 3. Report detail / monthly ringkasan | **6.8** | Medium |
| 4. Table design & keterbacaan | **6.5** | Medium–High |
| 5. PDF export design quality | **3.5** | **P0** |
| 6. Excel/CSV export honesty & UX | **6.0** | **P0–P1** |
| 7. Performance (virtualizer, monolit, parallel) | **5.5** | **P0–P1** |
| 8. Accessibility | **5.0** | **P1** |
| 9. Mobile/responsive | **5.5** | P1–P2 |
| 10. Information architecture / cognitive load | **5.8** | **P1** |

## Findings P0/P1/P2 with path:line

### P0

1. **PDF detail = pipe-joined text dump, bukan tabel resmi**  
   `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx:2047-2068`  
   Landscape jspdf, `columns.slice(0, 7)`, `rows.slice(0, 34)`, `join(' | ')`, filename `*-pratinjau.pdf`. Honest di copy, tapi visual tidak layak audit/print untuk manajemen.

2. **Catalog PDF menyamar “resmi”**  
   `InventoryReportsClient.tsx:928-947`  
   28 baris × 6 kolom, **tanpa** watermark pratinjau, simpan `${report.id}.pdf` (bukan `*-pratinjau.pdf`). User bisa anggap full report.

3. **Dual monolit membebani bundle + maintenance**  
   `ReportViewerClient.tsx` ~5068 L · `InventoryReportsClient.tsx` ~2500 L. Export, virtualizer, filter, KPI, AI, UI state campur satu file. Setiap import route bawa surface besar.

4. **KPI command deck: 8 fetch parallel per filter change**  
   `ProcurementKpiStrip.tsx:68-77` + `365-398`  
   `Promise.allSettled` atas 8 report summary tiap ganti period/group/scope. Risk thundering herd ke SQL gateway + jank UI saat filter typing/select.

### P1

5. **Export honesty split path**  
   Detail: `ExportPreflightDialog` + ceiling + PDF warning (`ExportPreflightDialog.tsx:15-30`, `ReportViewerClient.tsx:5043+`).  
   Catalog: Excel/PDF **tanpa** preflight, Excel hard-limit 500 (`InventoryReportsClient.tsx:919-925`), PDF silent 80-fetch/28-print.

6. **Excel detail full-load browser**  
   `ReportViewerClient.tsx:2030-2044`  
   `fetchReport(..., 'all')` + `xlsx` client-side. Honest di dialog, tapi large set = main-thread freeze; tidak ada progress/chunk/cancel.

7. **Dialog a11y lemah**  
   `ExportPreflightDialog.tsx:45-98`  
   Ada `role="dialog"` + `aria-modal`, **tidak ada**: focus trap, Escape handler, initial focus, restore focus, `aria-describedby`. Click backdrop = cancel (mudah miss-click).

8. **Table a11y / semantics**  
   `ReportDataTable.tsx:151-175, 182-196`  
   Sort header = button di `<th>` OK, tapi **no `aria-sort`**. Whole `<tr onClick>` expand — keyboard user sulit. Group header button OK; numeric alignment bergantung class luar, zebra lewat `zebraAlt` OK.

9. **Typography density extreme**  
   Table expanded `text-[9px]`–`text-[11px]` (`ReportDataTable.tsx:181-182`). Banyak `font-black` + uppercase tracking di deck. Scan cepat bagus untuk operator power-user; buruk untuk auditor/manajemen & low-vision.

10. **Currency 4 desimal di KPI deck**  
    `ProcurementKpiStrip.tsx:121-129`  
    `minimumFractionDigits: 4` untuk valuasi. Akurat akuntansi, tapi hero number `text-5xl` jadi noise visual; compact (`Rp41,3 jt`) lebih command-deck.

11. **Filter chip double-echo**  
    `ProcurementKpiStrip.tsx:707-716` + `809-816`  
    Period/MC/scope ditampilkan 2 baris chip. Cognitive noise.

12. **Command deck filter grid 7-col di XL**  
    `ProcurementKpiStrip.tsx:725`  
    `xl:grid-cols-[150px_150px_190px_minmax(180px,1fr)_150px_140px_auto]` — di laptop menengah cramp; mobile stack OK via `md/grid` fallback, tapi middle breakpoint padat.

### P2

13. **Status KPI strip generic bagus, tapi underused vs custom deck**  
    `AnalyticsKpiStrip.tsx` + `globals.css:634-762` — tokenized, focus-visible, reduced-motion.  
    `ProcurementKpiStrip` rebuild visual sendiri (inline gradient/blur) — dua “voices” KPI.

14. **Monthly ringkasan kuat secara section, panjang secara scroll**  
    `MonthlyStockRingkasan.tsx` — section bar + bar cards bagus; multi-layer KPI (global/flow/breakdown/sub/movement) mudah overwhelm sebelum tab Detail.

15. **Sticky table height hard-coded**  
    `ReportDataTable.tsx:180` `min-h-[620px] max-h-[920px]` — di short viewport (laptop 768p + topbar) table “mendorong” chrome.

16. **Hardcoded gateway header di KPI fetch**  
    `ProcurementKpiStrip.tsx:278`  
    `x-sql-gateway-base` default `http://10.0.0.110:8001` — config smell (bukan UI score, tapi ops risk).

17. **Catalog PDF description free-text tanpa wrap control**  
    `InventoryReportsClient.tsx:938` — long description bisa overflow page width jspdf.

## PDF redesign brief

**Tujuan:** satu kontrak jujur “Pratinjau vs Resmi”, visual table, brand forest.

| Item | Now | Target |
|---|---|---|
| Detail PDF | 34×7 pipe text + line watermark | Table grid (autoTable / manual cells), header band forest, footer page x/y, stamp **PRATINJAU** diagonal 12–18% opacity |
| Catalog PDF | 28×6, no stamp, `id.pdf` | Samakan kontrak: max rows/cols, `*-pratinjau.pdf`, watermark |
| Typography | default Helvetica | Title 14–16 bold, meta 8–9, numbers tabular right-align |
| Columns | first N raw | Profile-driven priority cols (kode, nama, qty, amount…) |
| Numbers | string dump | `formatValue` + right align; amount 2 d.p. preview (4 d.p. optional note) |
| Empty/overflow | silent slice | Footer: “Menampilkan 34/12.480 baris · 7/18 kolom · bukan laporan resmi” |
| Resmi path | tidak ada | Hanya server/async job + watermark “RESMI” + audit meta (user, period, filter hash) — **jangan** claim resmi dari client jspdf slice |

**Do not:** jspdf pipe text sebagai “export laporan”.

## Table readability brief

**Keep**
- Sticky thead amber (`ReportDataTable.tsx:182`)
- Virtual padding rows + `@tanstack/react-virtual` di viewer
- Group header + subtotal row tone (`#071426` / `#13261c` + amber left border)
- First-col expand control + line-clamp-2
- Column help via `title={displayColumnHelp}`

**Fix order**
1. **Numeric columns:** `tabular-nums` + right align konsisten (qty/amount).
2. **Min type size:** compact ≥11px, normal ≥12px; expanded fullscreen boleh 11, jangan 9.
3. **Zebra:** pastikan contrast ≥ 3:1 row vs bg (dark forest); selected row lebih tegas dari zebra.
4. **Sticky first col** (sudah ada hook `stickyCellStyle`) — verify shadow separator saat horizontal scroll multi-col.
5. **`aria-sort`** di sorted th; keyboard expand via button only (hapus full-row click atau mirror Enter/Space).
6. **Density toggle** sudah ada di virtualizer estimate (`compact 34 / 42`) — expose jelas di toolbar.
7. **Column freeze max 1–2** + rest scroll; avoid 15+ visible cols default.

## Performance risks

| Risk | Evidence | Impact |
|---|---|---|
| Dual monolit client | 246KB + 116KB source | Slow parse/hydrate, hard code-split |
| 8× summary fetch on filter | `ProcurementKpiStrip` `kpiRequests` | Gateway queue, partial live flicker |
| Excel `limit=all` client xlsx | `exportExcel` detail | Main-thread freeze, memory spike |
| Virtualizer only on detail table | good path | Catalog tiles lighter; detail still owns heavy state |
| No request coalescing on filter inputs | scopeCode free text | Keystroke → effect dependency `filters` full refetch |
| Parallel overview + KPI + report payload | module workspace | Triple network on enter procurement |

**Mitigasi prioritas:** debounce filter 300–500ms · cache summary by key · server Excel/CSV only for large · split `ReportViewerClient` (export / table / monthly / AI).

## Top 10 recommendations

1. **Satukan kontrak export** catalog + detail: preflight, ceiling, PDF always `*-pratinjau.pdf` + watermark.  
2. **Ganti PDF engine layout** ke real table + forest header/footer; buang pipe-join.  
3. **Server-side Excel/CSV** untuk >N baris; client xlsx hanya sample kecil.  
4. **Pecah monolit** `ReportViewerClient` → export module, table shell, monthly shell, AI shell.  
5. **KPI fetch:** 1 batch endpoint atau cache+stale-while-revalidate; debounce scope input.  
6. **Hero numbers compact** (Rp41,3 jt) + tooltip full 4 d.p.  
7. **A11y dialog:** focus trap, Escape, `aria-describedby`, primary focus confirm.  
8. **Table:** aria-sort, tabular nums, min 11px, keyboard row expand.  
9. **Command deck IA:** collapse filters default; 1 chip row; section accordion (valuasi/proses/movement).  
10. **Mobile:** sticky “primary action” bar; hide secondary KPI sections behind tabs.

## Keep (already strong)

- **Forest design tokens** di `globals.css` (`--rc-forest-*`, focus ring, reduced-motion).  
- **Export honesty copy** di detail path (`ExportPreflightDialog` — ceiling + loaded rows + pratinjau note).  
- **Virtualized table** + group/subtotal model di `ReportDataTable`.  
- **Procurement command deck** hierarchy: master valuation hero + gudang/workshop share bars + formula transparency.  
- **AnalyticsKpiStrip** reusable contract (status, selected, loading, aria-pressed).  
- **Monthly section bars + flow tones** (opening/issued/purchasing/closing).  
- **CSV server download** path (`format=csv`) — arah benar vs full client dump.  
- **Live partial badge** (“Live sebagian, fallback aktif”) — jujur saat snapshot gagal.

---

`★ Insight ─────────────────────────────────────`  
1. **Honesty UI > pretty export:** preflight di detail bagus, tapi catalog path tanpa watermark merusak trust model — satu bad path = seluruh export diragukan.  
2. **Command deck vs densitas:** formula + source + 3 chips per card = audit-grade transparency; untuk daily ops butuh compact mode (value + 1 delta saja).  
3. **Virtualizer tidak menyelamatkan monolit:** row paint murah, tapi 5k-line client component tetap mahal di parse/compile/hydration dan cognitive load developer.  
`─────────────────────────────────────────────────`
