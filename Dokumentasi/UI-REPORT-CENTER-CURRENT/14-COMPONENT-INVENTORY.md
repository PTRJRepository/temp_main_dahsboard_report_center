# 14 — Component Inventory (UI)

Komponen Report Center yang membentuk tampilan terkini.

| Component | Path | Role | Status |
|-----------|------|------|--------|
| ProcurementModuleWorkspace | `components/report-center/ProcurementModuleWorkspace.tsx` | Page orchestration procurement | LIVE |
| ProcurementKpiStrip | `.../ProcurementKpiStrip.tsx` | Command deck KPI | LIVE |
| InventoryOverview | `.../InventoryOverview.tsx` | Movement mix + exceptions | LIVE |
| ExceptionQueue | (imported/local under overview stack) | Exception list | LIVE |
| MovementComposition | (overview stack) | Segment bars | LIVE |
| InventoryReportsClient | `app/(report-center)/.../InventoryReportsClient.tsx` | Catalog embedded | LIVE |
| ReportViewerClient | `.../[report]/ReportViewerClient.tsx` | Detail monolit | LIVE |
| MonthlyStockRingkasan | `components/report-center/MonthlyStockRingkasan.tsx` | Monthly sticky summary | LIVE |
| ReportControlBar | `.../ReportControlBar.tsx` | Single control surface | LIVE |
| AnalyticsKpiStrip | `.../AnalyticsKpiStrip.tsx` | Generic detail KPI strip | LIVE |
| ReportWorkspaceFrame | `.../ReportWorkspaceFrame.tsx` | Shell frame (underused by some details) | PARTIAL |
| ReportCommandBar | `.../ReportCommandBar.tsx` | Command chrome | PARTIAL |
| ReportAnalysisBand | `.../ReportAnalysisBand.tsx` | Insight band | PARTIAL |
| Sidebar / Topbar | `components/layout/*` | App chrome | LIVE |

## Lib supporting UI

| Module | Path |
|--------|------|
| procurement-workspace | `lib/reports/procurement-workspace.ts` |
| inventory config/registry | `lib/reports/inventory/config.ts` |
| report-filtering | `lib/reports/report-filtering.ts` |
| format metrics | `utils/format.ts` |
| monthly domain | `lib/reports/inventory/monthly-stock-account-movement.ts` |

## Suggested future extracts (from deck)

| Name | From |
|------|------|
| ProcurementKpiHero | master valuation block |
| ProcurementIssueTopStrip | top 5 usage |
| procurement-kpi-math.ts | netFlow, fillRate, intensity pure |

---

**Next:** `15-UI-COPY-GLOSSARY.md`
