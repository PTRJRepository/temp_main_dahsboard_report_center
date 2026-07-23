# 07 — Source of Truth & Gaps

## 1. Source of truth hierarchy

1. **Runtime production** (bun :3001 + Next :3100)  
2. **Kode komponen** listed below  
3. **Tests** (`*.test.ts` di samping modul)  
4. **Folder ini** `UI-REPORT-CENTER-CURRENT/`  
5. Plan/katalog/prompt KPI  
6. Exploration pack Jul 2026 (detail redesign)  
7. PRD lama “27 reports” — **jangan** tanpa re-count registry  

## 2. File kode acuan UI

| Area | Path |
|------|------|
| KPI deck | `Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx` |
| Workspace | `.../ProcurementModuleWorkspace.tsx` |
| Overview | `.../InventoryOverview.tsx` |
| Control bar | `.../ReportControlBar.tsx` |
| Monthly ringkasan | `.../MonthlyStockRingkasan.tsx` |
| Analytics strip | `.../AnalyticsKpiStrip.tsx` |
| Catalog | `app/(report-center)/report-center/inventory/InventoryReportsClient.tsx` |
| Viewer | `.../inventory/[report]/ReportViewerClient.tsx` |
| Tokens | `app/globals.css` |
| Format | `utils/format.ts` |
| Registry | `lib/reports/inventory/config.ts` |
| Workspace links | `lib/reports/procurement-workspace.ts` |
| API | `app/api/reports/inventory/route.ts` |

## 3. Docs silang

| Doc | Update relation |
|-----|-----------------|
| `PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md` | Plan; sebagian item sudah LIVE — tandai saat implement |
| `KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md` | Pick-list; status LIVE update manual |
| `PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md` | Agent execution |
| `REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md` | Detail redesign pack |
| `INVENTORY_REPORT_REGISTRY_SNAPSHOT_2026-07-21.md` | ~19 live + 1 hold |

## 4. Gap jujur (kode vs “sempurna”)

| Gap | Severity | Catatan |
|-----|----------|---------|
| Tidak ada tab Issue Analysis penuh | Med | masih section 1–4 + top strip |
| Risk/quality card lama tidak di hero sections | Med | movement cards menggantikan sebagian |
| Freq/hari & ActiveDays kurang menonjol | Med | event line chip only |
| Top dept/vehicle belum | Med | only top items from chart |
| PO fill % belum kartu | Low | qty order/receive available |
| Composite API belum | Med | 8 parallel client fetches |
| Currency 4-dec deck vs format.ts | Low | consistency debt |
| Screenshot live butuh login | Low | docs tanpa media session |
| Monolit viewer masih besar | High long-term | extract bertahap |

## 5. Cara update folder ini (prosedur)

Saat UI KPI/table berubah:

1. Edit `02-KPI-COMMAND-DECK.md` inventaris kartu  
2. Update `08` / `09` / `10` jika overview/catalog/monthly berubah  
3. Update status di `06-LONG-HORIZON`  
4. Catat gap di §4  
5. Append `11-CHANGELOG-UI-SNAPSHOT.md`  
6. Bump tanggal di `00-INDEX.md`  
7. Jangan biarkan plan wow bilang “belum ada usage” jika kode sudah ada  

## 6. Runtime notes (sesi docs)

- Production start script: `npm start` → `NODE_ENV=production` + `bun run server_bun.js`  
- Gateway listen **3001**; dashboard internal **3100**  
- Unauthenticated browser → login redirect  

## 7. Stop condition

User menghentikan manual kapan saja.  
Folder ini sudah **cukup sebagai baseline UI docs** meski long horizon belum dieksekusi.

---

**End of pack.**
