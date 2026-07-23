# PROMPT SIAP COPY — Agent Dokumentasi + Diagram Report Center Inventory

Salin **seluruh blok di antara** `===== BEGIN PROMPT =====` dan `===== END PROMPT =====` ke Claude Code / Codex / Cursor / agent lain.  
Mode: **DOKUMENTASI + DIAGRAM SAJA** — jangan ubah production code.  
Bahasa dokumen: **Indonesia** (ID report/teknis boleh EN).

---

===== BEGIN PROMPT =====

## ROLE
Anda adalah Principal Technical Writer + Data Architect untuk PT Rebinmas Jaya (palm oil).  
Tugas: buat **dokumentasi khusus Report Center — fokus Inventory**, plus **diagram multi-layer**.  
Bukan coder UI. Jangan edit `ReportViewerClient.tsx` / production TSX.  
Boleh baca repo + tulis file baru di folder target.

## PRODUK (WAJIB PAHAMI)
- Next.js di `Dashboard_Utama/`, gateway root `server.js`, Report Center **port 3001**
- Inventory: `/report-center/inventory/...`
- Dual monolith:
  - Viewer ~6k: `app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx`
  - Catalog ~2.5k: `.../inventory/InventoryReportsClient.tsx`
- Domain monthly: `lib/reports/inventory/monthly-stock-account-movement.ts`
- API: `app/api/reports/inventory/route.ts`
- Metrics: `utils/format.ts` + `lib/reports/inventory/metric-dictionary.md`
- Registry live: `Dashboard_Utama/lib/reports/inventory/config.ts`  
  Snapshot: `Dokumentasi/INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md`  
  ≈ **19 live + 1 hold** — **jangan percaya “27 reports”** tanpa hitung ulang
- SQL: **READ-ONLY** via SQL Gateway. **CUD dilarang.**

## IRON LAWS DATA (harus muncul di docs/diagram)
1. `RTRIM()` pada char (`Status`, `AccCode`, `LocCode`, dll)
2. `1900-01-01` = sentinel / never issued — bukan tanggal valid
3. `IN_STOCKISSUELN.AccCode` = **department/cost center**, **BUKAN** GL_ACCOUNT
4. `VehCode` di **LINE** (`IN_STOCKISSUELN`, `IN_FUELISSUELN`), bukan header
5. `IN_STOCKRECEIVE` **EMPTY** di estate → GR pakai `PU_GOODSRCV` + `PU_GOODSRCVLN` + **cost dari `PU_POLN` via `POLnID`** di **SERVER_PROFILE_2 / db_ptrj**
6. Tanggal GR: `GoodsRcvRefDate` (bukan `PostDate`)
7. Accounting period ≠ calendar month (AccMonth/AccYear) — verifikasi helper, jangan hardcode buta
8. Export honesty 3 layer: ringkasan server terfilter ≠ baris stream/tabel ≠ AI sample (~50×40)
9. PDF = pratinjau; AI = sample chips; CSV/Excel = full filtered dengan ceiling
10. Konflik antar docs: **code + tests + metric-dictionary + Monthly-Stock pack + good_receipt_correlation** menang atas PRD lama
11. **Jangan salin secret/API key** dari docs lama

## BACA DULU (urutan)
1. `Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md`
2. `Dokumentasi/MASTER_PROMPT_REPORT_CENTER_REDESIGN_ADVANCED.md`
3. `Dokumentasi/INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md`
4. `Dokumentasi/Monthly-Stock-Account-Movement-Details/README.md` + 01…12
5. `Dokumentasi/Report Inventory Kebun/good_receipt_correlation.md`
6. `Dokumentasi/Report Inventory Kebun/good_receipt_db_diagram.excalidraw` (contoh diagram bagus)
7. `Dokumentasi/Report-Center-Tables/**` (MASTER, STOCK_FLOW, MONTHLY_END, PURCHASING, LOOKUP)
8. `Dashboard_Utama/docs/inventory-in-database/*`
9. `Dashboard_Utama/lib/reports/inventory/metric-dictionary.md`
10. Live: `config.ts`, monthly domain TS, API route
11. Opsional: `Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html` (jika ada, boleh evolve/replace)

## DELIVERABLE UTAMA (WAJIB) — SATU FILE DIAGRAM
Buat **satu file HTML tunggal**:

`Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html`

### Syarat layout (HARD REQUIREMENT)
- **14 diagram terpisah**, masing-masing di dalam **box/card sendiri**
- **Jarak antar box jelas** (CSS `gap` minimal **40–48px**, stack vertikal)
- Tiap box punya: nomor 01–14, judul, deskripsi singkat, area diagram, footer catatan
- TOC di atas (anchor loncat ke tiap box)
- Tema forest: navy `#071426` + green `#167A3A` (+ gold aksen opsional)
- Diagram pakai **Mermaid** (CDN mermaid v10/v11 OK)
- Print-friendly: `break-inside: avoid` per box
- **Jangan** satukan semua diagram jadi satu canvas berdesakan
- **Jangan** taruh secret/API key di file

### 14 diagram wajib (isi minimum)

| # | Judul | Jenis | Isi minimum |
|---|--------|-------|-------------|
| 01 | System Context | flowchart C4 L1 | User roles → Report Center :3001 → Gateway → SQL Gateway :8001 → SP1/SP2/SP3 |
| 02 | Container | flowchart C4 L2 | Catalog UI, Viewer UI, pages, API inventory, domain lib, format, config, SQL Gateway |
| 03 | Peta halaman Inventory | sitemap | `/report-center` → catalog → `[report]` → workspaces Ringkasan/Analisis/Detail/Audit |
| 04 | Request flow | sequence | User filter → Viewer → API → domain → SQL Gateway → SQL Server → payload → KPI/table |
| 05 | ER Stock Core | erDiagram/flowchart | IN_ITEM, issue/return/transfer/adj + lookups; AccCode dept; VehCode line |
| 06 | ER Goods Receive Estate | flowchart | PU_GOODSRCV → LN → **★ PU_POLN cost**; SUPPLIER/ITEM/PRODTYPE; ⛔ IN_STOCKRECEIVE empty |
| 07 | ER Month-End | flowchart | IN_MTHEND* / opening-closing story + transaksi bulan |
| 08 | Formula Monthly RPTIN1000015 | flowchart | Opening + GR − Issued + Return → Closing; TotalItem; placeholder_zero |
| 09 | Accounting vs Calendar | flowchart | UI month → mapper → AccMonth/AccYear → SQL → payload |
| 10 | Viewer IA | flowchart | Context → **single Controls** → ≤6 KPI → Insight → Table → Advanced; anti-redundancy |
| 11 | Export/AI honesty | layered flowchart | Layer summary / stream rows / AI sample + CSV Excel PDF AI labels |
| 12 | Report Registry | flowchart | config.ts → live (~19) + hold; highlight monthly-stock-account-movement-details / RPTIN1000015 |
| 13 | Server routing | flowchart | mill SP1 vs estate GR SP2+db_ptrj vs traps empty table |
| 14 | Monolith extraction | flowchart | Viewer/Catalog monolith → ControlBar, MonthlyRingkasan, profiles, ExportMenu, shell |

### KPI RPTIN1000015 (jangan diubah tanpa bukti code/test)
`OpeningAmount`, `GoodsReceiveAmount`, `IssuedTotalAmount`, `ReturnAmount`, `ClosingAmount`, `TotalItem`  
Hormati `placeholder_zero`. Secondary product-type wall = Advanced, bukan default Ringkasan.

### Registry live (dokumentasikan jujur)
Live examples dari snapshot:  
stok-gudang, asset-stock-valuasi-listing, all-stock-movement-analysis, top-stock-issue-movement-items, movement-stock, **monthly-stock-account-movement-details (RPTIN1000015)**, pengeluaran-barang, goods-receiving-receipt-activity, purchase-request-inventory, transfer-antar-gudang, stock-opname, fuel-usage, riwayat-transaksi, return-barang, item-stale-update, purchase-order-history, supplier-purchasing-performance, pupuk-stock-procurement, vehicle-running-workshop  
Hold: expiry-inventory  

Hitung ulang dari `config.ts` saat menulis.

## DELIVERABLE DOKUMEN (opsional tapi disarankan)
Jika token/waktu cukup, buat juga hub:

```
Dokumentasi/REPORT-CENTER-INVENTORY-DOCS/
  00-INDEX.md          ← peta baca + link ke HTML onefile
  03-INVENTORY-REPORT-REGISTRY.md
  05-REPORT-RPTIN1000015-MONTHLY-MOVEMENT.md
  06-GOODS-RECEIVE-ESTATE.md
  12-DATA-QUALITY-IRON-LAWS.md
```

`00-INDEX.md` wajib link ke HTML onefile dan hierarchy source-of-truth.

Prioritas report:
- **P0:** RPTIN1000015, GR estate (PU_*), stock issue+return, month-end/valuation live
- **P1:** transfer, adj, fuel, PR/PO
- **P2:** hold/stub — status jujur

## ATURAN KERJA
1. Baca sumber di atas dulu; **jangan mengarang** schema/formula
2. Tidak yakin → tulis Open Questions + query SELECT verifikasi (jangan CUD)
3. Jangan commit secret
4. Jangan edit production code
5. File besar: ringkas + link path, jangan dump 6k baris
6. Setelah selesai, self-check:
   - [ ] 14 box terpisah + gap ≥40px
   - [ ] Mermaid renderable
   - [ ] GR cost ★ PU_POLN
   - [ ] IN_STOCKRECEIVE empty ditandai
   - [ ] AccCode dept vs GL dipisah
   - [ ] Export 3 layer jujur
   - [ ] Registry diselaraskan config.ts
   - [ ] Tidak ada API key

## RETURN FORMAT (akhir)
```
OK/FAIL
Primary file: <path absolut HTML onefile>
Docs hub: <path atau NONE>
Diagrams: 14 boxes in one HTML
Coverage: X/Y live inventory reports documented
Open questions: N
Risks in old docs: (bullet)
```

## PRIORITAS JIKA WAKTU SEMPIT
1) HTML onefile 14 box (wajib)  
2) `00-INDEX.md` hub  
3) Registry + iron laws + monthly + GR  
Sisanya boleh menyusul.

===== END PROMPT =====

---

## Versi super-pendek (jika token ketat)

```
Buat SATU file HTML: Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html
14 diagram Mermaid, masing-masing di BOX TERPISAH, jarak antar box gap 40–48px, TOC + nomor 01–14.
Tema navy #071426 + green #167A3A.
Isi: C4 context, container, page map inventory, sequence API→SQL, ER stock, ER GR (★PU_POLN, ⛔IN_STOCKRECEIVE empty), month-end, formula RPTIN1000015 (6 KPI + placeholder_zero), accounting vs calendar, viewer IA single controls, export/AI 3-layer honesty, registry live dari config.ts (~19+1 hold), server SP1/SP2 routing, monolith extraction.
Baca: REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md, INVENTORY_REPORT_REGISTRY_SNAPSHOT, Monthly-Stock-Account-Movement-Details/*, good_receipt_correlation.md, metric-dictionary.md, config.ts.
READ-ONLY. Jangan ubah production code. Jangan copy secrets. Konflik docs → code/tests menang.
Return OK/FAIL + path absolut.
```

---

## Catatan untuk user
- Prompt di atas **self-contained** — agent lain tidak perlu chat history ini.
- File diagram contoh/hasil sebelumnya (jika ada):  
  `Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html`  
  Agent boleh **ganti/perbaiki** file itu selama syarat box+jarak terpenuhi.
