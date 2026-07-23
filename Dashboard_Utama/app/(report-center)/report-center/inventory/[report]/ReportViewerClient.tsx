'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Expand,
  FileSpreadsheet,
  FileText,
  Loader2,
  Minimize2,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  X,
  XCircle,
} from 'lucide-react'
import AiDynamicDashboard from '@/components/report/AiDynamicDashboard'
import ReportAnalysisBand from '@/components/report-center/ReportAnalysisBand'
import AppliedFilterBar from '@/components/report-center/AppliedFilterBar'
import MonthlyStockRingkasan from '@/components/report-center/MonthlyStockRingkasan'
import ExportPreflightDialog, { type ExportPreflightKind } from '@/components/report-center/ExportPreflightDialog'
import ReportWorkspaceTabs, { type WorkspaceTabId } from '@/components/report-center/ReportWorkspaceTabs'
import ReportTableToolbar from '@/components/report-center/ReportTableToolbar'
import ReportDataTable from '@/components/report-center/ReportDataTable'
import { bucketTone, isAmountField, movementTone, renderReportCell, riskTone } from '@/components/report-center/reportTableCells'
import ReportDetailLoadingScreen from '@/components/report-center/ReportDetailLoadingScreen'
import ReportQuestionPanel, { type ReportQuestionRequest } from '@/components/report-center/ReportQuestionPanel'
import type { InventoryAnalyticsContract } from '@/lib/reports/inventory/analytics-contract'
import { inventoryColumnLabel, inventoryColumnTitleAttribute } from '@/lib/reports/inventory/column-glossary'
import { getInventoryReport, liveInventoryReports, type InventoryReport } from '@/lib/reports/inventory/config'
import type { AiDashboardDefinition } from '@/lib/reports/ai-dashboard'
import {
  buildReportTableGroups,
  buildReportTableRows,
  buildReportSummaryTotals,
  compactReportPayloadForAi,
  formatInventoryQuantityBreakdown,
  mergeReportFilterAction,
  normalizeReportTableWindow,
  selectSubtotalColumns,
  type ReportTableRenderRow,
} from '@/lib/reports/report-detail-performance'
import { useReportStore } from '@/store/reportStore'
import {
  filtersFromSearchParams,
  normalizeInventoryAnalysisGroupFilters,
  type ReportColumnFilter,
  type ReportColumnOperator,
  type ReportFilterInput,
} from '@/lib/reports/report-filtering'
import {
  ASSET_VALUATION_REPORT_IDS,
  MONTHLY_CONTEXT_DETAIL_COLUMNS,
  MONTHLY_OFFICIAL_DETAIL_COLUMNS,
  MONTHLY_STOCK_MOVEMENT_REPORT_IDS,
  MOVEMENT_ANALYSIS_REPORT_IDS,
  STOCK_AGING_REPORT_IDS,
  getReportViewerProfile,
  monthlyStockMovementKpis as buildMonthlyStockMovementKpis,
  preferredVisibleColumnsForProfile,
  type ProfileBuilders,
  type ReportPreset,
  type ReportViewerProfile,
} from '@/lib/reports/inventory/viewer-profiles'
import type { ReportFilterAction } from '@/lib/reports/report-experience'
import { actualToAccountingPeriod } from '@/lib/reports/accounting-period'
import { formatCurrency, formatKpiValue, formatMetric, inferMetricKind } from '@/utils/format'

type DbRow = Record<string, unknown>

type ReportPayload = {
  title: string
  description: string
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart?: DbRow[]
  metadata: DbRow
  totalRows?: number
  analytics?: InventoryAnalyticsContract
}

type DebugSqlStatement = {
  id?: string
  ordinal?: number
  label?: string
  server?: string
  database?: string
  sql?: string
  rows?: number
  executionMs?: number
  readOnly?: boolean
}

type DebugSqlMetadata = {
  enabled?: boolean
  access?: string
  target?: {
    source?: string
    sourceLabel?: string
    server?: string
    database?: string
  }
  sourceTables?: string
  statementCount?: number
  copyHint?: string
  statements: DebugSqlStatement[]
}

type ApiResponse = {
  success: boolean
  data?: ReportPayload
  error?: string
}

type ReportSource = 'estate' | 'pabrik'
type InsightTab = 'ai' | 'charts' | 'quality' | 'metadata' | 'recommendations' | 'sql'
type TableDensity = 'compact' | 'comfortable'
const REPORT_SOURCE_STORAGE_KEY = 'report-center:last-source'

type ReportSchemaColumn = {
  field: string
  label?: string
  type?: string
  aggregatable?: boolean
}

type ManualColumnType = 'number' | 'date' | 'boolean' | 'string'

type DynamicFilterColumn = {
  field: string
  label: string
  type: ManualColumnType
  options: string[]
}

type ReportKpiCard = {
  label: string
  value: unknown
  description: string
  tone: string
  /**
   * global = whole-scope metric
   * flow = official RPTIN column block (Opening / Inventory / Issued / Purchasing / Closing)
   * breakdown = fixed split of grand total (Stock Gudang vs Workshop Mesin) — NOT analysis sub-category
   * sub = dynamic analysis-group bucket (Product Type / SA / Location / …) — never Movement Category
   * movement = always-on Movement Category rail (separate from sub)
   */
  scope?: 'global' | 'flow' | 'breakdown' | 'sub' | 'movement'
  /** group field when scope=sub|breakdown|movement */
  groupField?: string
  /** bucket key when scope=sub|breakdown|movement */
  groupKey?: string
  /** flow section id: opening | inventory | issued | purchasing | closing */
  flowSection?: string
  metrics?: Array<{ key: string; label: string; value: unknown; sourceTable?: string; sourceField?: string }>
  /** DB / report field provenance for user trust */
  sourceTable?: string
  sourceField?: string
  /** Short illustrative SELECT for this KPI only (not full production query). */
  simpleSql?: string
  filterAction?: ReportFilterAction
}

/**
 * Paste-ready SQL Server scripts for KPI value checks.
 * Literals for AccYear/AccMonth (no @params). Short SUM/COUNT — not full gateway CTE.
 */
type KpiSqlPeriod = {
  accYear: number
  accMonth: number
  openingAccYear: number
  openingAccMonth: number
  actualPeriod?: string
  location?: string
  database?: string
  /** inventory = ItemType 1+4, gudang = 1, workshop = 4 */
  itemTypeScope?: 'inventory' | 'gudang' | 'workshop'
  periodKeyMode?: string
  summaryOpeningAmount?: number
  summaryClosingAmount?: number
  summaryIssuedAmount?: number
  summaryGoodsReceiveAmount?: number
}

function sqlIdent(value: unknown, fallback = 'Amount') {
  const text = String(value ?? '').split(/[←+\-,]/)[0] ?? ''
  const clean = text.replace(/[^A-Za-z0-9_]/g, '')
  return clean || fallback
}

function sqlStringLiteral(value: unknown) {
  return String(value ?? '').replace(/'/g, "''")
}

function previousAccPeriod(accYear: number, accMonth: number) {
  if (accMonth <= 1) return { accYear: accYear - 1, accMonth: 12 }
  return { accYear, accMonth: accMonth - 1 }
}

function resolveItemTypeScopeForSql(filters?: ReportFilterInput, metadata?: DbRow): KpiSqlPeriod['itemTypeScope'] {
  const raw = String(filters?.itemType ?? metadata?.itemTypeScope ?? '').trim().toLowerCase()
  if (raw === '1' || raw === 'gudang' || raw === 'stock') return 'gudang'
  if (raw === '4' || raw === 'workshop' || raw === 'mesin') return 'workshop'
  return 'inventory'
}

function itemTypeSqlPredicate(alias: string, scope: KpiSqlPeriod['itemTypeScope'] = 'inventory') {
  const col = `ISNULL(RTRIM(CONVERT(varchar(10), ${alias}.ItemType)), '')`
  if (scope === 'gudang') return `${col} = '1'`
  if (scope === 'workshop') return `${col} = '4'`
  return `${col} IN ('1', '4')`
}

function resolveKpiSqlPeriod(payload?: ReportPayload | null, filters?: ReportFilterInput): KpiSqlPeriod | null {
  const summary = payload?.summary ?? {}
  const metadata = payload?.metadata ?? {}
  const pickNum = (...keys: string[]) => {
    for (const key of keys) {
      const raw = summary[key] ?? metadata[key]
      const n = Number(raw)
      if (Number.isFinite(n) && n > 0) return Math.trunc(n)
    }
    return null
  }
  // Prefer server-resolved Acc keys from payload so paste SQL matches KPI summary.
  let accYear = pickNum('AccYear', 'accYear', 'acc_year', 'ReportAccYear')
  let accMonth = pickNum('AccMonth', 'accMonth', 'acc_month', 'ReportAccMonth')
  const actualPeriod = String(
    summary.ActualPeriod ?? summary.actualPeriod ?? metadata.actualPeriod ?? metadata.period ?? filters?.period ?? '',
  ).trim()
  // Only convert when payload Acc missing. Mill may store calendar Acc in metadata already.
  if ((!accYear || !accMonth) && actualPeriod) {
    const [y, m] = actualPeriod.split(/[-/]/)
    const periodKeyMode = String(metadata.periodKeyMode ?? '').toLowerCase()
    if (periodKeyMode === 'calendar') {
      const yy = Number(y)
      const mm = Number(m)
      if (Number.isFinite(yy) && Number.isFinite(mm)) {
        accYear = Math.trunc(yy)
        accMonth = Math.trunc(mm)
      }
    } else {
      const converted = actualToAccountingPeriod(y, m)
      if (converted) {
        accYear = converted.accYear
        accMonth = converted.accMonth
      }
    }
  }
  if (!accYear || !accMonth) {
    const filterAccY = Number(filters?.accYear)
    const filterAccM = Number(filters?.accMonth)
    if (Number.isFinite(filterAccY) && Number.isFinite(filterAccM) && filterAccY > 0 && filterAccM > 0) {
      accYear = Math.trunc(filterAccY)
      accMonth = Math.trunc(filterAccM)
    }
  }
  if (!accYear || !accMonth) return null

  // Opening Acc from metadata first (server already computed prev period).
  const openFromMeta = String(metadata.openingAccountingPeriod ?? summary.OpeningAccountingPeriod ?? '').trim()
  const openMatch = openFromMeta.match(/^(\d{4})-(\d{1,2})$/)
  const openY = pickNum('OpeningAccYear', 'openingAccYear') ?? (openMatch ? Number(openMatch[1]) : null)
  const openM = pickNum('OpeningAccMonth', 'openingAccMonth') ?? (openMatch ? Number(openMatch[2]) : null)
  const prev = openY && openM ? { accYear: openY, accMonth: openM } : previousAccPeriod(accYear, accMonth)
  const location = String(
    filters?.location ?? summary.Location ?? summary.LocCode ?? metadata.location ?? metadata.LocCode ?? 'PTRJ',
  ).trim() || 'PTRJ'
  const database = String(
    metadata.sourceDatabase ?? metadata.database ?? metadata.Database ?? '',
  ).trim()
  const toAmt = (...keys: string[]) => {
    for (const key of keys) {
      const n = Number(summary[key] ?? metadata[key])
      if (Number.isFinite(n)) return n
    }
    return undefined
  }
  return {
    accYear,
    accMonth,
    openingAccYear: prev.accYear,
    openingAccMonth: prev.accMonth,
    actualPeriod: actualPeriod || undefined,
    location,
    database: database || undefined,
    itemTypeScope: resolveItemTypeScopeForSql(filters, metadata),
    periodKeyMode: String(metadata.periodKeyMode ?? '') || undefined,
    summaryOpeningAmount: toAmt('OpeningAmount'),
    summaryClosingAmount: toAmt('ClosingAmount'),
    summaryIssuedAmount: toAmt('IssuedTotalAmount'),
    summaryGoodsReceiveAmount: toAmt('GoodsReceiveAmount'),
  }
}

function dboTable(period: KpiSqlPeriod | null | undefined, table: string) {
  const db = period?.database ? `[${sqlIdent(period.database, 'db')}].[dbo].` : 'dbo.'
  return `${db}[${sqlIdent(table, 'IN_MTHENDITEM')}]`
}

function locationWhere(period: KpiSqlPeriod | null | undefined, alias = '') {
  if (!period?.location) return ''
  const col = alias ? `${alias}.LocCode` : 'LocCode'
  return `\n  AND RTRIM(${col}) = '${sqlStringLiteral(period.location)}'`
}

function mthendItemTypeExistsSql(period: KpiSqlPeriod, mthAlias: string) {
  const item = dboTable(period, 'IN_ITEM')
  return [
    `AND EXISTS (`,
    `  SELECT 1 FROM ${item} i`,
    `  WHERE i.ItemCode = ${mthAlias}.ItemCode`,
    `    AND i.LocCode = ${mthAlias}.LocCode`,
    `    AND ${itemTypeSqlPredicate('i', period.itemTypeScope)}`,
    `)`,
  ].join('\n  ')
}

/** Valuation formula aligned with report CTE: prefer stored Amount, else Qty*AverageCost. */
function mthendAmountExpr(alias: string) {
  return `CAST(ISNULL(${alias}.Amount, ISNULL(${alias}.Qty, 0) * ISNULL(${alias}.AverageCost, 0)) AS decimal(18,4))`
}

function simpleSqlForKpi(input: {
  label?: string
  flowSection?: string
  groupField?: string
  groupKey?: string
  sourceTable?: string
  sourceField?: string
  scope?: ReportKpiCard['scope']
  metricKey?: string
  period?: KpiSqlPeriod | null
}): string {
  const label = String(input.label ?? '')
  const flow = String(input.flowSection ?? '').toLowerCase()
  const groupField = sqlIdent(input.groupField, '')
  const groupKey = sqlStringLiteral(input.groupKey)
  const col = sqlIdent(input.sourceField ?? input.metricKey, 'Amount')
  const period = input.period
  const scopeLabel =
    period?.itemTypeScope === 'gudang' ? 'ItemType=1 Gudang' :
    period?.itemTypeScope === 'workshop' ? 'ItemType=4 Workshop' :
    'ItemType IN (1,4) Gudang+Workshop'
  const header = [
    '/* Paste ke SSMS — query debug KPI (mirror summary report) */',
    '/* Harus ≈ nilai card KPI. Bandingkan juga ke JSON official RPTIN bila period sama. */',
    period?.actualPeriod ? `/* Actual period: ${period.actualPeriod} */` : null,
    period ? `/* AccYear=${period.accYear} AccMonth=${period.accMonth} | Opening Acc=${period.openingAccYear}-${String(period.openingAccMonth).padStart(2, '0')} */` : null,
    period?.periodKeyMode ? `/* periodKeyMode: ${period.periodKeyMode} */` : null,
    period?.location ? `/* LocCode: ${period.location} */` : null,
    period?.database ? `/* Database: ${period.database} */` : null,
    `/* Scope: ${scopeLabel} */`,
    period?.summaryOpeningAmount != null ? `/* UI summary.OpeningAmount = ${period.summaryOpeningAmount} */` : null,
    period?.summaryClosingAmount != null ? `/* UI summary.ClosingAmount = ${period.summaryClosingAmount} */` : null,
    period?.summaryIssuedAmount != null ? `/* UI summary.IssuedTotalAmount = ${period.summaryIssuedAmount} */` : null,
    period?.summaryGoodsReceiveAmount != null ? `/* UI summary.GoodsReceiveAmount = ${period.summaryGoodsReceiveAmount} */` : null,
  ].filter(Boolean).join('\n')

  if (!period) {
    return `${header}\n/* Period belum ada di payload — buka report dulu. */\nSELECT CAST(NULL AS decimal(18,2)) AS Value`
  }

  const ay = period.accYear
  const am = period.accMonth
  const oy = period.openingAccYear
  const om = period.openingAccMonth
  const mth = dboTable(period, 'IN_MTHENDITEM')
  const item = dboTable(period, 'IN_ITEM')
  const loc = locationWhere(period)

  if (flow === 'opening' || /^opening$/i.test(label)) {
    return [
      header,
      '/* Opening = IN_MTHENDITEM previous Acc period, ItemType scope via IN_ITEM */',
      'SELECT',
      `  CAST(SUM(${mthendAmountExpr('m')}) AS decimal(18,2)) AS OpeningAmount,`,
      '  CAST(SUM(CAST(ISNULL(m.Qty, 0) AS decimal(18,4))) AS decimal(18,2)) AS OpeningQty,',
      '  COUNT(*) AS OpeningRows',
      `FROM ${mth} m`,
      `WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${oy}'`,
      `  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${om}'${locationWhere(period, 'm')}`,
      `  ${mthendItemTypeExistsSql(period, 'm')};`,
    ].join('\n')
  }
  if (flow === 'closing' || /^closing$/i.test(label)) {
    return [
      header,
      '/* Closing snapshot = IN_MTHENDITEM report Acc period (same formula as Opening) */',
      'SELECT',
      `  CAST(SUM(${mthendAmountExpr('m')}) AS decimal(18,2)) AS ClosingAmount,`,
      '  CAST(SUM(CAST(ISNULL(m.Qty, 0) AS decimal(18,4))) AS decimal(18,2)) AS ClosingQty,',
      '  COUNT(*) AS ClosingRows',
      `FROM ${mth} m`,
      `WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${ay}'`,
      `  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${am}'${locationWhere(period, 'm')}`,
      `  ${mthendItemTypeExistsSql(period, 'm')};`,
    ].join('\n')
  }
  if (flow === 'issued' || /issued/i.test(label)) {
    return [
      header,
      '/* Issued = stock (non-workshop) + fuel + workshop WS_JOBSTOCK TransType=1 */',
      'SELECT',
      '  CAST(SUM(LineAmount) AS decimal(18,2)) AS IssuedTotalAmount,',
      "  CAST(SUM(CASE WHEN Bucket = 'ledger' THEN LineAmount ELSE 0 END) AS decimal(18,2)) AS LedgerAmount,",
      "  CAST(SUM(CASE WHEN Bucket = 'station' THEN LineAmount ELSE 0 END) AS decimal(18,2)) AS IssuedStationAmount,",
      "  CAST(SUM(CASE WHEN Bucket = 'vehicle' THEN LineAmount ELSE 0 END) AS decimal(18,2)) AS IssuedVehicleAmount",
      'FROM (',
      '  /* IN_STOCKISSUE — exclude ItemType 4 (workshop uses WS_JOBSTOCK) */',
      "  SELECT CASE",
      "    WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 THEN 'ledger'",
      "    WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0 THEN 'station'",
      "    WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0 THEN 'vehicle' ELSE 'ledger' END AS Bucket,",
      '    CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS decimal(18,4)) AS LineAmount',
      `  FROM ${dboTable(period, 'IN_STOCKISSUE')} h`,
      `  INNER JOIN ${dboTable(period, 'IN_STOCKISSUELN')} l ON h.StockIssueID = l.StockIssueID`,
      `  LEFT JOIN ${item} issueItem ON issueItem.ItemCode = l.ItemCode AND issueItem.LocCode = h.LocCode`,
      `  WHERE RTRIM(CONVERT(varchar(10), h.AccYear)) = '${ay}'`,
      `    AND RTRIM(CONVERT(varchar(10), h.AccMonth)) = '${am}'`,
      `    AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')${locationWhere(period, 'h')}`,
      "    AND (issueItem.ItemCode IS NULL OR ISNULL(RTRIM(CONVERT(varchar(10), issueItem.ItemType)), '') <> '4')",
      '  UNION ALL',
      '  /* IN_FUELISSUE */',
      "  SELECT CASE",
      "    WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 THEN 'ledger'",
      "    WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0 THEN 'station'",
      "    WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0 THEN 'vehicle' ELSE 'ledger' END,",
      '    CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS decimal(18,4))',
      `  FROM ${dboTable(period, 'IN_FUELISSUE')} h`,
      `  INNER JOIN ${dboTable(period, 'IN_FUELISSUELN')} l ON h.FuelIssueID = l.FuelIssueID`,
      `  WHERE RTRIM(CONVERT(varchar(10), h.AccYear)) = '${ay}'`,
      `    AND RTRIM(CONVERT(varchar(10), h.AccMonth)) = '${am}'`,
      `    AND RTRIM(ISNULL(h.Status, '')) IN ('2', '6')${locationWhere(period, 'h')}`,
      '  UNION ALL',
      '  /* Workshop issue TransType=1 */',
      "  SELECT CASE",
      "    WHEN LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) = 0 THEN 'ledger'",
      "    WHEN LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) > 0 THEN 'station'",
      "    WHEN LEN(RTRIM(ISNULL(j.VehCode, ''))) > 0 THEN 'vehicle' ELSE 'ledger' END,",
      '    CAST(COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) AS decimal(18,4))',
      `  FROM ${dboTable(period, 'WS_JOBSTOCK')} s`,
      `  LEFT JOIN ${dboTable(period, 'WS_JOB')} j ON s.JobID = j.JobID`,
      `  LEFT JOIN ${item} issueItem ON issueItem.ItemCode = s.ItemCode AND issueItem.LocCode = s.LocCode`,
      `  WHERE RTRIM(CONVERT(varchar(10), s.AccYear)) = '${ay}'`,
      `    AND RTRIM(CONVERT(varchar(10), s.AccMonth)) = '${am}'${locationWhere(period, 's')}`,
      "    AND RTRIM(ISNULL(s.TransType, '')) = '1'",
      "    AND COALESCE(NULLIF(RTRIM(CONVERT(varchar(10), issueItem.ItemType)), ''), NULLIF(RTRIM(CONVERT(varchar(10), s.ItemType)), '')) = '4'",
      ') x;',
    ].join('\n')
  }
  if (flow === 'inventory' || /^inventory$/i.test(label)) {
    return [
      header,
      '/* Inventory block RPTIN placeholders — currently 0 in rebuild */',
      'SELECT',
      '  CAST(0 AS decimal(18,2)) AS ReceivedAmount,',
      '  CAST(0 AS decimal(18,2)) AS ReturnAdviceAmount,',
      '  CAST(0 AS decimal(18,2)) AS TransferredAmount,',
      '  CAST(0 AS decimal(18,2)) AS AdjustmentAmount,',
      '  CAST(0 AS decimal(18,2)) AS InventoryTotal;',
    ].join('\n')
  }
  if (flow === 'purchasing' || /purchasing|goods\s*receive/i.test(label)) {
    return [
      header,
      '/* Goods receive — mill often Status 5; include 2/5/6 like issue posted docs */',
      'SELECT',
      '  CAST(SUM(LineAmount) AS decimal(18,2)) AS GoodsReceiveAmount,',
      '  COUNT(*) AS GoodsReceiveLines',
      'FROM (',
      '  SELECT CAST(COALESCE(NULLIF(gl.Amount, 0), ISNULL(gl.StockQty, 0) * ISNULL(p.Cost, 0), 0) AS decimal(18,4)) AS LineAmount',
      `  FROM ${dboTable(period, 'PU_GOODSRCV')} g`,
      `  INNER JOIN ${dboTable(period, 'PU_GOODSRCVLN')} gl ON g.GoodsRcvID = gl.GoodsRcvID`,
      `  LEFT JOIN ${dboTable(period, 'PU_POLN')} p ON gl.POLnID = p.POLnID`,
      `  WHERE RTRIM(CONVERT(varchar(10), g.AccYear)) = '${ay}'`,
      `    AND RTRIM(CONVERT(varchar(10), g.AccMonth)) = '${am}'`,
      `    AND RTRIM(ISNULL(g.Status, '')) IN ('2', '5', '6')${locationWhere(period, 'g')}`,
      ') x;',
    ].join('\n')
  }
  if (input.scope === 'movement' || groupField === 'MovementCategory') {
    return [
      header,
      '/* Quick issue lines by item — MovementCategory buckets dihitung di app */',
      'SELECT',
      '  RTRIM(l.ItemCode) AS ItemCode,',
      '  COUNT(DISTINCT h.StockIssueID) AS IssueDocCount,',
      '  CAST(SUM(CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS decimal(18,4))) AS decimal(18,2)) AS IssueAmount',
      `FROM ${dboTable(period, 'IN_STOCKISSUE')} h`,
      `INNER JOIN ${dboTable(period, 'IN_STOCKISSUELN')} l ON h.StockIssueID = l.StockIssueID`,
      `WHERE RTRIM(CONVERT(varchar(10), h.AccYear)) = '${ay}'`,
      `  AND RTRIM(CONVERT(varchar(10), h.AccMonth)) = '${am}'`,
      `  AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')${locationWhere(period, 'h')}`,
      'GROUP BY RTRIM(l.ItemCode)',
      'ORDER BY IssueDocCount DESC;',
      groupKey ? `/* KPI bucket filter di UI: MovementCategory = '${groupKey}' */` : '',
    ].filter(Boolean).join('\n')
  }
  if (input.scope === 'breakdown' || groupField === 'ItemType') {
    return [
      header,
      'SELECT',
      '  RTRIM(CONVERT(varchar(10), i.ItemType)) AS ItemType,',
      '  COUNT(*) AS ItemCount,',
      `  CAST(SUM(${mthendAmountExpr('m')}) AS decimal(18,2)) AS ClosingAmount`,
      `FROM ${mth} m`,
      `INNER JOIN ${item} i ON i.ItemCode = m.ItemCode AND i.LocCode = m.LocCode`,
      `WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${ay}'`,
      `  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${am}'${locationWhere(period, 'm')}`,
      `  AND ${itemTypeSqlPredicate('i', period.itemTypeScope)}`,
      groupKey ? `  AND RTRIM(CONVERT(varchar(10), i.ItemType)) = '${groupKey}'` : '',
      'GROUP BY RTRIM(CONVERT(varchar(10), i.ItemType));',
    ].filter(Boolean).join('\n')
  }
  if (input.scope === 'sub' && groupField) {
    const g = groupField === 'Location' ? 'm.LocCode' : groupField === 'ProductTypeCode' ? 'i.ProdTypeCode' : `m.${groupField}`
    return [
      header,
      'SELECT',
      `  RTRIM(CONVERT(varchar(100), ${g})) AS GroupKey,`,
      '  COUNT(*) AS ItemCount,',
      `  CAST(SUM(${mthendAmountExpr('m')}) AS decimal(18,2)) AS ClosingAmount`,
      `FROM ${mth} m`,
      `INNER JOIN ${item} i ON i.ItemCode = m.ItemCode AND i.LocCode = m.LocCode`,
      `WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${ay}'`,
      `  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${am}'${locationWhere(period, 'm')}`,
      `  AND ${itemTypeSqlPredicate('i', period.itemTypeScope)}`,
      groupKey ? `  AND RTRIM(CONVERT(varchar(100), ${g})) = '${groupKey}'` : '',
      `GROUP BY RTRIM(CONVERT(varchar(100), ${g}))`,
      'ORDER BY ClosingAmount DESC;',
    ].filter(Boolean).join('\n')
  }
  if (/amount|qty|total/i.test(col)) {
    return [
      header,
      `SELECT CAST(SUM(${mthendAmountExpr('m')}) AS decimal(18,2)) AS ${col}`,
      `FROM ${mth} m`,
      `WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${ay}'`,
      `  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${am}'${locationWhere(period, 'm')}`,
      `  ${mthendItemTypeExistsSql(period, 'm')};`,
    ].join('\n')
  }
  return [
    header,
    `SELECT CAST(SUM(${mthendAmountExpr('m')}) AS decimal(18,2)) AS Amount`,
    `FROM ${mth} m`,
    `WHERE RTRIM(CONVERT(varchar(10), m.AccYear)) = '${ay}'`,
    `  AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${am}'${locationWhere(period, 'm')}`,
    `  ${mthendItemTypeExistsSql(period, 'm')};`,
  ].join('\n')
}

function attachSimpleSql(card: ReportKpiCard, period?: KpiSqlPeriod | null): ReportKpiCard {
  return {
    ...card,
    simpleSql: simpleSqlForKpi({
      label: card.label,
      flowSection: card.flowSection,
      groupField: card.groupField,
      groupKey: card.groupKey,
      sourceTable: card.sourceTable,
      sourceField: card.sourceField,
      scope: card.scope,
      period,
    }),
  }
}


type NaturalFilterResponse = {
  success: boolean
  filters?: ReportFilterInput
  explanation?: string
  provider?: string
  model?: string
  warning?: string
  error?: string
}

const columnOperators: Array<{ value: ReportColumnOperator; label: string }> = [
  { value: 'contains', label: 'Contains' },
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'between', label: 'Between' },
  { value: 'blank', label: 'Kosong' },
  { value: 'notBlank', label: 'Tidak kosong' },
]

const AUTO_GROUP = '__auto__'
const NO_GROUP = '__none__'
const MONTHLY_ANALYSIS_GROUP_OPTIONS = [
  { field: 'ProductTypeCode', label: 'Product Type' },
  { field: 'MovementCategory', label: 'Actual Movement' },
  { field: 'ProductCategoryCode', label: 'Product Category' },
  { field: 'ProductBrandCode', label: 'Product Brand' },
  { field: 'ProductModelCode', label: 'Product Model' },
  { field: 'ProductMaterialCode', label: 'Product Material' },
  { field: 'Location', label: 'Location' },
] as const
const MONTHLY_MOVEMENT_WINDOW_OPTIONS = [
  { value: 'all', label: 'All period' },
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
] as const
const SUB_KPI_CHART_TOTAL_KEYS = [
  'TotalItem',
  'ItemCurrent',
  'AmountItem',
  'AssetAmountRealTime',
  'QtyOnHandHold',
  'ClosingAmount',
  'OpeningAmount',
  'IssuedTotalAmount',
  'IssuedStationAmount',
  'IssuedVehicleAmount',
  'GoodsReceiveAmount',
  'ReturnAmount',
  'OnHandHoldAmount',
  'ClosingQty',
  'OpeningQty',
  'IssuedTotalQty',
  'GoodsReceiveQty',
  'ReturnQty',
  'MovementActivityCountActual',
  'MovementActivityQtyActual',
  'MovementActivityAmountActual',
  'MovementIssueCountActual',
  'MovementIssueQtyActual',
  'MovementIssueAmountActual',
  'StockIssueMovementCount',
  'StockIssueMovementQty',
  'StockIssueMovementAmount',
] as const
// Reports that recompute SQL by accounting / actual month-year.
const EMPTY_COLUMNS: string[] = []
const TABLE_FIRST_LIMIT = 500
/** Chunk size for progressive full-table stream (monthly RPTIN). */
const TABLE_STREAM_CHUNK = 2000
const REPORT_INFO_AUTO_HIDE_MS = 6500

function normalizeViewerReportFilters(reportId: string, filters: ReportFilterInput) {
  return MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(reportId)
    ? normalizeInventoryAnalysisGroupFilters(filters)
    : filters
}

function uniqueValues(rows: DbRow[], field: string, cache?: Map<string, string[]>) {
  if (cache) {
    const cached = cache.get(field)
    if (cached) return cached
  }
  const values = new Set<string>()
  rows.slice(0, 500).forEach((row) => {
    const value = row[field]
    if (value === null || value === undefined || value === '') return
    const text = String(value).trim()
    if (!text || text.length > 60) return
    values.add(text)
  })
  const result = [...values].sort((a, b) => a.localeCompare(b, 'id-ID', { numeric: true }))
  if (cache) cache.set(field, result)
  return result
}

function inferManualColumnType(field: string, schemaColumns: ReportSchemaColumn[], rows: DbRow[]): ManualColumnType {
  const schemaType = schemaColumns.find((column) => column.field === field)?.type
  if (schemaType === 'number' || schemaType === 'date' || schemaType === 'boolean') return schemaType
  if (/date|tanggal|update|periode|period|time/i.test(field)) return 'date'

  const sample = rows
    .slice(0, 30)
    .map((row) => row[field])
    .filter((value) => value !== null && value !== undefined && value !== '')
  if (sample.length > 0 && sample.every((value) => typeof value === 'number' || (typeof value === 'string' && /^-?\d+(?:[.,]\d+)?$/.test(value.trim())))) return 'number'
  return 'string'
}

function operatorsForManualType(type: ManualColumnType) {
  const allowed =
    type === 'number' || type === 'date'
      ? ['equals', 'gt', 'gte', 'lt', 'lte', 'between', 'blank', 'notBlank']
      : type === 'boolean'
        ? ['equals', 'notEquals', 'blank', 'notBlank']
        : ['contains', 'equals', 'notEquals', 'blank', 'notBlank']
  return columnOperators.filter((operator) => allowed.includes(operator.value))
}

function defaultOperatorForManualType(type: ManualColumnType, hasOptions = false): ReportColumnOperator {
  if (hasOptions) return 'equals'
  if (type === 'number' || type === 'date') return 'gte'
  return 'contains'
}

function coerceManualFilterValue(value: string, type: ManualColumnType) {
  if (!value) return undefined
  if (type !== 'number') return value
  const numeric = Number(value.replace(',', '.'))
  return Number.isFinite(numeric) ? numeric : undefined
}

function normalizeSource(value: string | null): ReportSource {
  return value === 'pabrik' ? 'pabrik' : 'estate'
}

function sourceLabel(source: ReportSource) {
  return source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun'
}

function sourceDescription(source: ReportSource) {
  return source === 'pabrik' ? 'SERVER_PROFILE_3 / db_ptrj_mill' : 'SERVER_PROFILE_2 / db_ptrj'
}

function formatAmount4(value: number) {
  return formatCurrency(value)
}


function formatValue(value: unknown, field?: string) {
  return formatMetric(value, field)
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function resolveActivePeriodLabels(payload: ReportPayload | null, filters: ReportFilterInput) {
  const period = resolveKpiSqlPeriod(payload, filters)
  const actual = firstText(
    payload?.metadata?.actualPeriod,
    payload?.summary?.ActualPeriod,
    payload?.summary?.actualPeriod,
    filters.period,
    payload?.metadata?.period,
    period?.actualPeriod,
  )
  const accounting = firstText(
    payload?.metadata?.accountingPeriod,
    payload?.summary?.AccountingPeriod,
    payload?.summary?.accountingPeriod,
    period ? `${period.accYear}-${String(period.accMonth).padStart(2, '0')}` : '',
  )
  const parts = [actual ? `Actual ${actual}` : '', accounting ? `Acc ${accounting}` : ''].filter((part): part is string => Boolean(part))

  return {
    actual: actual || undefined,
    accounting: accounting || undefined,
    summary: parts.join(' · ') || 'Current scope',
  }
}

const LEGACY_COLUMN_LABELS: Record<string, string> = {
  acc_year: 'AccYear',
  acc_month: 'AccMonth',
  report_id: 'Report ID',
  source_report_title: 'Source Report',
  RecommendedAction: 'Recommended Action',
  ItemCurrent: 'Item Current',
  MovementActivityCountActual: 'Movement Activity Count',
  MovementActivityQtyActual: 'Movement Activity Qty',
  MovementActivityAmountActual: 'Movement Activity Amount',
  MovementIssueCountActual: 'Movement Actual Count',
  MovementIssueQtyActual: 'Movement Actual Qty',
  MovementIssueAmountActual: 'Movement Actual Amount',
  StockIssueDocumentCountActual: 'StockIssue Doc Count',
  StockIssueDocumentQtyActual: 'StockIssue Doc Qty',
  StockIssueDocumentAmountActual: 'StockIssue Doc Amount',
  MovementSourceValid: 'Movement Source Valid',
  LastStockIssueMovementDate: 'Last StockIssue Movement Date',
  StockIssueMovementAgeDays: 'StockIssue Movement Age Days',
  StockIssueMovementEvent1: 'StockIssue Movement Event 1',
  StockIssueMovementEvent2: 'StockIssue Movement Event 2',
  JumlahAmountStockIssue: 'Jumlah Amount Stock Issue',
  JumlahQtyMovement: 'Jumlah Qty Movement',
  JumlahAmountMovement: 'Jumlah Amount Movement',
  StockIssueEvent1: 'Stock Issue Event 1',
  StockIssueEvent2: 'Stock Issue Event 2',
}

function displayColumnLabel(field: string) {
  return inventoryColumnLabel(field, LEGACY_COLUMN_LABELS[field] ?? field)
}

function displayColumnHelp(field: string) {
  return inventoryColumnTitleAttribute(field, displayColumnLabel(field))
}

/** Field/label-aware KPI formatter — periods/qty/count never forced to Rp. */
function compactMetric(value: unknown, field?: string, label?: string) {
  return formatKpiValue(value, field, label)
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function stockAgingKpis(summary: DbRow, rows: DbRow[] = []) {
  const fromRows = summary.TotalItem === undefined && rows.length > 0
  const totalItem = fromRows ? rows.length : summary.TotalItem
  const itemAktif = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) <= 3).length : summary.ItemAktif
  const slowMoving = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) > 6 && toNumber(row.UmurBulan) <= 12).length : summary.SlowMoving
  const stale = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) >= 12).length : summary.StaleLebih12Bulan
  const dead = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) >= 24).length : summary.DeadStockLebih24Bulan
  const riskyValue = fromRows ? rows.filter((row) => toNumber(row.UmurBulan) >= 12).reduce((sum, row) => sum + (toNumber(row.TotalAmount) || toNumber(row.NilaiStok)), 0) : summary.NilaiStokBerisiko
  const zeroStock = fromRows ? rows.filter((row) => toNumber(row.QuantityClosing ?? row.StokAkhir) === 0).length : summary.ItemStokNol
  const fastMovement = rows.filter((row) => String(row.MovementCategory ?? '').toLowerCase().includes('fast')).length
  const slowMovement = rows.filter((row) => String(row.MovementCategory ?? '').toLowerCase().includes('slow')).length
  const deadMovement = rows.filter((row) => String(row.MovementCategory ?? '').toLowerCase().includes('dead')).length
  const noCategory = fromRows
    ? rows.filter((row) => {
        const category = String(row.KodeKategori ?? row.Kategori ?? '').trim()
        return !category || category === '-' || category === '0'
      }).length
    : summary.ItemTanpaKategori

  return [
    { label: 'Total Item', value: totalItem, description: 'Item count in selected stock-aging scope.', tone: 'border-blue-100 bg-blue-50 text-blue-700' },
    { label: 'Update <= 3 Bulan', value: itemAktif, description: 'Item count with last update within 3 months.', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    { label: 'Update 6-12 Bulan', value: slowMoving, description: 'Item count with last update age between 6 and 12 months.', tone: 'border-yellow-100 bg-yellow-50 text-yellow-700' },
    { label: 'Tidak Update > 12 Bulan', value: stale, description: 'Item count with no update for more than 12 months.', tone: 'border-orange-100 bg-orange-50 text-orange-700' },
    { label: 'Tidak Update > 24 Bulan', value: dead, description: 'Item count with no update for more than 24 months.', tone: 'border-red-100 bg-red-50 text-red-700' },
    { label: 'Nilai Stok Berisiko', value: riskyValue, description: 'Stock value in IDR for stale-risk items.', tone: 'border-red-100 bg-red-50 text-red-700' },
    { label: 'Stok Nol', value: zeroStock, description: 'Item count where closing quantity is zero.', tone: 'border-slate-200 bg-slate-50 text-slate-700' },
    { label: 'Fast Moving', value: fastMovement, description: 'Item count in Fast Moving category for all-period movement.', tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
    { label: 'Slow Moving Qty', value: slowMovement, description: 'Item count in Slow Moving category for all-period movement.', tone: 'border-yellow-100 bg-yellow-50 text-yellow-700' },
    { label: 'Dead Movement', value: deadMovement, description: 'Item count with Dead Movement / no recent usage signal.', tone: 'border-red-100 bg-red-50 text-red-700' },
    { label: 'Tanpa Kategori', value: noCategory, description: 'Item count with empty master category.', tone: 'border-purple-100 bg-purple-50 text-purple-700' },
  ]
}

function movementAnalysisKpis(summary: DbRow, rows: DbRow[] = [], groupBy?: string) {
  const countByCategory = (category: string) => rows.filter((row) => String(row.MovementCategory ?? '') === category).length
  const amountByCategory = (category: string) => rows
    .filter((row) => String(row.MovementCategory ?? '') === category)
    .reduce((sum, row) => sum + toNumber(row.AmountItem ?? row.TotalAmount), 0)
  const itemCount = (summary.TotalItem ?? rows.length) as unknown
  const categoryCard = (label: string, itemKey: string, amountKey: string, tone: string) => {
    const itemValue = summary[itemKey] ?? countByCategory(label)
    const amountValue = summary[amountKey] ?? amountByCategory(label)
    return {
      label,
      value: amountValue,
      description: `${formatValue(itemValue)} items in ${label}. Value is real-time asset amount in IDR.`,
      tone,
    }
  }

  const base: ReportKpiCard[] = [
    { label: 'Asset Amount Real Time', value: summary.TotalAssetAmount ?? summary.TotalAmount, description: `Current asset value in IDR for ${formatValue(itemCount)} inventory items from IN_ITEM.`, tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Total Item', value: itemCount, description: 'Item count for ItemType 1 + 4 in selected scope.', tone: 'border-blue-100 bg-blue-50 text-blue-700' },
    categoryCard('Fast Moving', 'FastMovingItem', 'FastMovingAmount', 'border-emerald-100 bg-emerald-50 text-emerald-700'),
    categoryCard('Moving', 'MovingItem', 'MovingAmount', 'border-blue-100 bg-blue-50 text-blue-700'),
    categoryCard('Slow Moving', 'SlowMovingItem', 'SlowMovingAmount', 'border-yellow-100 bg-yellow-50 text-yellow-700'),
    categoryCard('Dead Stock', 'DeadMovementItem', 'DeadMovementAmount', 'border-red-100 bg-red-50 text-red-700'),
    categoryCard('Stale', 'StaleItem', 'StaleAmount', 'border-orange-100 bg-orange-50 text-orange-700'),
    { label: 'StockIssue Movement', value: summary.TotalStockIssueMovementCount ?? rows.reduce((sum, row) => sum + toNumber(row.StockIssueMovementCount), 0), description: 'Count of StockIssue movement events in selected scope.', tone: 'border-amber-100 bg-amber-50 text-amber-700' },
  ]

  const dim = resolveGroupDimension(
    rows,
    groupBy,
    groupBy ? [] : ['ProductTypeCode', 'ProductType', 'Gudang', 'KodeKategori', 'MovementCategory'],
  )
  // Default MC cards already cover MovementCategory; only rebuild when user groups on other dim.
  if (dim && dim !== 'MovementCategory') {
    const groupCards = groupedKpiCards(rows, dim, [], 6)
    if (groupCards.length) {
      return [
        { label: `Group: ${displayColumnLabel(dim)}`, value: groupCards.length, description: 'Number of KPI cards grouped by active analysis field.', tone: 'border-white/10 bg-[#102b1b] text-lime-100' },
        ...groupCards,
        base[0],
        base[1],
      ].slice(0, 12)
    }
  }
  return base
}

function movementAnalysisQualityItems(payload: ReportPayload | null, rows: DbRow[]): Array<[string, unknown]> {
  return [
    ['Fast Moving', payload?.summary.FastMovingItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Fast Moving').length],
    ['Moving', payload?.summary.MovingItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Moving').length],
    ['Slow Moving', payload?.summary.SlowMovingItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Slow Moving').length],
    ['Stale', payload?.summary.StaleItem ?? rows.filter((row) => ['Stale', 'No Movement'].includes(String(row.MovementCategory ?? ''))).length],
    ['Dead Stock', payload?.summary.DeadMovementItem ?? rows.filter((row) => String(row.MovementCategory ?? '') === 'Dead Stock').length],
    ['ItemType 4 Source Valid', payload?.summary.ItemType4WorkshopSourceValid ?? rows.filter((row) => String(row.ItemType ?? '') === '4' && String(row.MovementSource ?? '') === 'WS_JOBSTOCK').length],
    ['ItemType 4 Source Invalid', payload?.summary.ItemType4WorkshopSourceInvalid ?? rows.filter((row) => String(row.ItemType ?? '') === '4' && String(row.MovementSource ?? '') !== 'WS_JOBSTOCK').length],
    ['Movement Source Missing', payload?.summary.MovementSourceMissing ?? rows.filter((row) => !String(row.MovementSource ?? '').trim()).length],
    ['Total StockIssue Movement', payload?.summary.TotalStockIssueMovementCount ?? rows.reduce((sum, row) => sum + toNumber(row.StockIssueMovementCount), 0)],
  ]
}

function movementAnalysisTopItems(rows: DbRow[]) {
  return [...rows]
    .sort((a, b) => toNumber(b.StockIssueMovementCount) - toNumber(a.StockIssueMovementCount))
    .slice(0, 10)
}
function assetValuationKpis(summary: DbRow, metadata: DbRow = {}, rows: DbRow[] = []) {
  const rowQtyOnHand = rows.reduce((sum, row) => sum + toNumber(row.quantity_on_hand), 0)
  const rowQtyOnHold = rows.reduce((sum, row) => sum + toNumber(row.quantity_on_hold), 0)
  const rowTotalQty = rowQtyOnHand + rowQtyOnHold
  const periodLabel = summary.actual_period ?? metadata.actualPeriod ?? metadata.period
  const accLabel = [
    summary.acc_month ?? metadata.accMonth,
    summary.acc_year ?? metadata.accYear,
  ].filter((part) => part !== undefined && part !== null && part !== '').join('/')
  return [
    { label: 'Nilai Asset', value: summary.total_amount ?? summary.TotalAmount, description: 'Stock valuation amount in IDR. This is inventory value, not movement sum.', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
    { label: 'Total Item', value: summary.total_item ?? summary.FilteredRows ?? rows.length, description: 'Item count for ItemType 1 Gudang + ItemType 4 Workshop/Mesin.', tone: 'border-blue-100 bg-blue-50 text-blue-800' },
    { label: 'Qty On Hand+Hold', value: summary.total_quantity ?? summary.TotalQty ?? rowTotalQty, description: 'Physical stock quantity: available on hand plus on hold.', tone: 'border-cyan-100 bg-cyan-50 text-cyan-800' },
    { label: 'Qty On Hand', value: summary.total_quantity_on_hand ?? rowQtyOnHand, description: 'Physical quantity currently available for use.', tone: 'border-sky-100 bg-sky-50 text-sky-800' },
    { label: 'Qty On Hold', value: summary.total_quantity_on_hold ?? rowQtyOnHold, description: 'Physical quantity reserved/on hold, not freely available.', tone: 'border-amber-100 bg-amber-50 text-amber-800' },
    { label: 'Periode Aktual', value: periodLabel, description: 'Calendar month applied by report filters.', tone: 'border-white/10 bg-[#0F2B1A] text-white' },
    { label: 'Acc Period', value: accLabel || (summary.accounting_period ?? metadata.accountingPeriod), description: 'Accounting fiscal period used by inventory tables.', tone: 'border-white/10 bg-[#1A1A1A] text-white' },
  ]
}

/** Aliases so user-selected analysis group maps to actual row/chart field names. */
function resolveGroupFieldAliases(groupBy?: string): string[] {
  if (!groupBy) return []
  const g = String(groupBy).trim()
  const map: Record<string, string[]> = {
    ProductTypeCode: ['ProductTypeCode', 'ProductType', 'product_type_code', 'ProductTypeDescription'],
    ProductType: ['ProductType', 'ProductTypeCode', 'product_type_code', 'ProductTypeDescription'],
    ProductCategoryCode: ['ProductCategoryCode', 'product_category_code', 'KodeKategori', 'Kategori'],
    ProductBrandCode: ['ProductBrandCode', 'product_brand_code'],
    ProductModelCode: ['ProductModelCode', 'product_model_code'],
    ProductMaterialCode: ['ProductMaterialCode', 'product_material_code'],
    MovementCategory: ['MovementCategory'],
    Location: ['Location', 'Gudang', 'LocCode', 'location'],
    Gudang: ['Gudang', 'Location', 'LocCode', 'location'],
    LocCode: ['LocCode', 'Gudang', 'Location', 'location'],
    ItemType: ['ItemType', 'ItemTypeName'],
    ItemTypeName: ['ItemTypeName', 'ItemType'],
  }
  return map[g] ?? [g]
}

function groupFieldsMatch(selected?: string, actual?: string) {
  if (!selected || !actual) return false
  if (selected === actual) return true
  const selectedAliases = new Set(resolveGroupFieldAliases(selected))
  const actualAliases = new Set(resolveGroupFieldAliases(actual))
  for (const key of selectedAliases) {
    if (actualAliases.has(key)) return true
  }
  return false
}

/**
 * Resolve table/KPI group dimension.
 * User-selected groupBy ALWAYS wins — never fall through to MovementCategory / SA
 * just because ProductType (etc.) is sparse on the current page rows.
 */
function resolveGroupDimension(rows: DbRow[], groupBy?: string, preferred: string[] = []) {
  if (groupBy) {
    const aliases = resolveGroupFieldAliases(groupBy)
    for (const key of aliases) {
      if (rows.some((row) => row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '')) {
        return key
      }
    }
    // Keep user selection even if empty on loaded page (chart/server may still scope by it).
    return aliases[0] ?? groupBy
  }

  for (const key of preferred.filter(Boolean) as string[]) {
    const aliases = resolveGroupFieldAliases(key)
    for (const alias of aliases) {
      if (rows.some((row) => row[alias] !== undefined && row[alias] !== null && String(row[alias]).trim() !== '')) {
        return alias
      }
    }
  }
  return undefined
}

function amountKeysForRows(rows: DbRow[]) {
  const preferred = ['ClosingAmount', 'AmountItem', 'TotalAmount', 'total_amount', 'NilaiStok', 'Amount', 'OnHandHoldAmount']
  return preferred.filter((key) => rows.some((row) => toNumber(row[key]) !== 0 || row[key] !== undefined))
}

function qtyKeysForRows(rows: DbRow[]) {
  const preferred = ['ClosingQty', 'TotalQty', 'total_quantity', 'Qty', 'QuantityClosing', 'IssuedTotalQty']
  return preferred.filter((key) => rows.some((row) => row[key] !== undefined))
}

function firstNumericRowValue(row: DbRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (value === undefined || value === null || value === '') continue
    return toNumber(value)
  }
  return undefined
}

function chartRowDimensionId(row: DbRow) {
  return String(row.DimensionId ?? '').trim().toLowerCase()
}

/** True only when this chart row belongs to the selected analysis group field. */
function chartRowMatchesGroupField(row: DbRow, groupField: string) {
  const dimId = chartRowDimensionId(row)
  if (groupFieldsMatch(groupField, 'MovementCategory')) {
    return dimId === 'movement-category' || Boolean(row.MovementCategory)
  }
  if (groupFieldsMatch(groupField, 'Location') || groupFieldsMatch(groupField, 'Gudang')) {
    return dimId === 'location' || Boolean(row.Gudang || row.Location || row.location || row.LocCode)
  }
  if (groupFieldsMatch(groupField, 'ItemType')) {
    return dimId === 'item-type' || Boolean(row.ItemType || row.ItemTypeName)
  }
  if (groupFieldsMatch(groupField, 'ProductTypeCode') || groupFieldsMatch(groupField, 'ProductType')) {
    return (
      dimId === 'product-type' ||
      Boolean(row.ProductTypeCode || row.ProductType || row.product_type_code)
    )
  }
  if (groupFieldsMatch(groupField, 'ProductCategoryCode')) {
    return dimId === 'product-category' || Boolean(row.ProductCategoryCode || row.product_category_code)
  }
  if (groupFieldsMatch(groupField, 'ProductBrandCode')) {
    return dimId === 'product-brand' || Boolean(row.ProductBrandCode || row.product_brand_code)
  }
  if (groupFieldsMatch(groupField, 'ProductModelCode')) {
    return dimId === 'product-model' || Boolean(row.ProductModelCode || row.product_model_code)
  }
  if (groupFieldsMatch(groupField, 'ProductMaterialCode')) {
    return dimId === 'product-material' || Boolean(row.ProductMaterialCode || row.product_material_code)
  }
  // Reject foreign dimension ids even if Label is filled.
  if (dimId && !['', 'analysis-group'].includes(dimId)) {
    const expected = String(groupField).replace(/Code$/i, '').toLowerCase()
    if (!dimId.includes(expected) && dimId !== String(groupField).toLowerCase()) return false
  }
  return resolveGroupFieldAliases(groupField).some((alias) => {
    const value = row[alias]
    return value !== undefined && value !== null && String(value).trim() !== ''
  })
}

function chartGroupKey(row: DbRow, groupField: string) {
  // Only read fields that belong to the active group dimension.
  // Never fall back to bare Label/DimensionValue from a foreign chart slice
  // (mixed monthly chart packs ProductType + MovementCategory + ItemType).
  if (!chartRowMatchesGroupField(row, groupField)) return ''

  const aliases = resolveGroupFieldAliases(groupField)
  const candidates = [
    ...aliases.map((alias) => row[alias]),
    ...(groupFieldsMatch(groupField, 'Location') || groupFieldsMatch(groupField, 'Gudang')
      ? [row.Gudang, row.Location, row.location, row.LocCode]
      : []),
    ...(groupFieldsMatch(groupField, 'MovementCategory') ? [row.MovementCategory] : []),
    ...(groupFieldsMatch(groupField, 'ProductTypeCode') || groupFieldsMatch(groupField, 'ProductType')
      ? [row.ProductTypeCode, row.ProductType, row.product_type_code, row.ProductTypeDescription]
      : []),
    // Safe only after chartRowMatchesGroupField — same-dimension chart rows.
    row.DimensionValue,
    row.Label,
  ]
  for (const value of candidates) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

function chartGroupName(row: DbRow, groupField: string) {
  const value =
    groupField === 'Gudang' || groupField === 'Location'
      ? row[groupField] ?? row.Gudang ?? row.Location
      : groupField === 'MovementCategory'
        ? row.MovementCategory ?? row.DimensionName ?? row.Label
        : row.DimensionName ??
          row[`${groupField.replace(/Code$/, '')}Description`] ??
          row.ProductTypeDescription ??
          (groupField === 'ItemType' || groupField === 'ItemTypeName' ? row.ItemTypeName ?? row.ItemType : undefined) ??
          row.Label
  return String(value ?? '').trim()
}

function chartMatchesGroupField(chart: DbRow[], groupField: string) {
  if (!chart.length) return false
  // Mixed monthly charts include ProductType + MovementCategory + ItemType slices.
  // Accept the chart only if at least one ROW matches the selected group field.
  return chart.some((row) => chartRowMatchesGroupField(row, groupField))
}

function chartRowsForGroupField(chart: DbRow[], groupField: string) {
  return chart.filter((row) => chartRowMatchesGroupField(row, groupField))
}

function chartMetricValue(row: DbRow, metric: string) {
  const aliases: Record<string, string[]> = {
    TotalItem: ['TotalItem', 'TotalRows', 'ItemCurrent'],
    ItemCurrent: ['ItemCurrent', 'TotalItem', 'TotalRows'],
    AmountItem: ['AmountItem', 'AssetAmountRealTime', 'TotalAmount', 'Amount', 'OnHandHoldAmount'],
    AssetAmountRealTime: ['AssetAmountRealTime', 'AmountItem', 'TotalAmount', 'Amount', 'OnHandHoldAmount'],
    QtyOnHandHold: ['QtyOnHandHold', 'Qty', 'total_quantity'],
    ClosingAmount: ['ClosingAmount', 'Amount', 'TotalAmount'],
    ClosingQty: ['ClosingQty', 'Qty', 'TotalQty'],
    IssuedTotalAmount: ['IssuedTotalAmount', 'IssuedAmount'],
    StockIssueMovementCount: ['StockIssueMovementCount', 'MovementIssueCountActual'],
    StockIssueMovementQty: ['StockIssueMovementQty', 'MovementIssueQtyActual'],
    StockIssueMovementAmount: ['StockIssueMovementAmount', 'MovementIssueAmountActual'],
  }
  return firstNumericRowValue(row, aliases[metric] ?? [metric])
}

function chartTotalsForGroup(row: DbRow) {
  const totals: Record<string, number> = {}
  SUB_KPI_CHART_TOTAL_KEYS.forEach((key) => {
    const value = chartMetricValue(row, key)
    if (value !== undefined) totals[key] = value
  })
  return totals
}

function chartTotalsByGroup(chart: DbRow[], groupField: string | undefined) {
  const totals = new Map<string, Record<string, number>>()
  if (!groupField) return totals

  chartRowsForGroupField(chart, groupField).forEach((row) => {
    const key = chartGroupKey(row, groupField)
    if (!key) return
    const next = chartTotalsForGroup(row)
    if (Object.keys(next).length > 0) totals.set(key, next)
  })

  return totals
}

/** Columns safe to sum into grand-total KPI (exclude codes/names/dates). */
function isSummableMetricField(field: string) {
  if (!field) return false
  if (/Code$|Name$|Description|Period|Date|Time|ID$|Label|Category|Type|Status|UOM|Unit$|Location|Gudang|Supplier|Rank|Window|Source|Rule|Raw|technical|report_id|server|database|sql/i.test(field)) {
    return false
  }
  return /Amount|Qty|Quantity|Total|Nilai|Count|Event|Cost|Value|OnHand|Hold|Closing|Opening|Issued|Received|Return|Goods|Adjustment|Transfer|Dispatch|Ledger|Station|Vehicle|Item$|Rows|Score/i.test(field)
}

const KPI_TONES = [
  'border-emerald-200 bg-emerald-50 text-emerald-900',
  'border-sky-100 bg-sky-50 text-sky-800',
  'border-amber-100 bg-amber-50 text-amber-800',
  'border-rose-100 bg-rose-50 text-rose-800',
  'border-purple-100 bg-purple-50 text-purple-800',
  'border-cyan-100 bg-cyan-50 text-cyan-800',
  'border-lime-100 bg-lime-50 text-lime-800',
  'border-blue-100 bg-blue-50 text-blue-800',
] as const

/**
 * Grand-total KPI cards driven by payload summary + numeric table columns present.
 * Prefer server summary (full scope) over row sum (loaded page).
 */
function resolveMetricKeysForKpis(
  summary: DbRow,
  columns: string[],
  preferredColumns: string[] = [],
  max = 16,
) {
  const summaryMetricKeys = Object.keys(summary).filter((key) => {
    const value = summary[key]
    if (value === null || value === undefined || value === '') return false
    if (typeof value === 'object') return false
    // Exclude ItemType split fields from global metric strip (shown on breakdown cards).
    if (/^(StockGudang|WorkshopMesin)/i.test(key)) return false
    return isSummableMetricField(key)
  })
  const columnMetrics = columns.filter((key) => isSummableMetricField(key))
  // Official RPTIN1000015 amount/qty block first so KPI strip mirrors export columns.
  const preferredOrder = [
    ...preferredColumns,
    'ClosingAmount',
    'OpeningAmount',
    'IssuedTotalAmount',
    'IssuedStationAmount',
    'IssuedVehicleAmount',
    'LedgerAmount',
    'GoodsReceiveAmount',
    'ReturnAmount',
    'GoodsReturnAmount',
    'DispatchAdvAmount',
    'ReceivedAmount',
    'ReturnAdviceAmount',
    'TransferredAmount',
    'AdjustmentAmount',
    'OnHandHoldAmount',
    'AmountItem',
    'TotalAmount',
    'total_amount',
    'NilaiStok',
    'ClosingQty',
    'OpeningQty',
    'IssuedTotalQty',
    'GoodsReceiveQty',
    'ReceivedQty',
    'ReturnQty',
    'QtyOnHandHold',
    'TotalQty',
    'TotalItem',
    'FilteredRows',
    'StockIssueMovementCount',
    'StockIssueMovementAmount',
  ]
  const ordered = [
    ...preferredOrder.filter((key) => summaryMetricKeys.includes(key) || columnMetrics.includes(key)),
    ...summaryMetricKeys.filter((key) => !preferredOrder.includes(key)),
    ...columnMetrics.filter((key) => !preferredOrder.includes(key) && !summaryMetricKeys.includes(key)),
  ]
  return [...new Set(ordered)].slice(0, max)
}

function pickMetricValue(summary: DbRow, rows: DbRow[], key: string) {
  const fromSummary = summary[key]
  if (fromSummary !== undefined && fromSummary !== null && fromSummary !== '') {
    return { value: fromSummary, source: 'summary' as const }
  }
  if (rows.length === 0) return null
  return {
    value: rows.reduce((sum, row) => sum + toNumber(row[key]), 0),
    source: 'rows' as const,
  }
}

const SUB_KPI_DEFAULT_LIMIT = 48

/**
 * Fixed grand-total breakdown: Stock Gudang (ItemType 1) vs Workshop Mesin (ItemType 4).
 * Not analysis sub-category — always under grand total, independent of Product Type / SA / MC group.
 */
function buildItemTypeBreakdownCards(
  summary: DbRow,
  rows: DbRow[],
  metricKeys: string[],
): ReportKpiCard[] {
  const primary = metricKeys[0] ?? 'ClosingAmount'
  const secondary = metricKeys.slice(0, 4)

  const summaryPairs: Array<{ key: string; label: string; amountKeys: string[]; qtyKeys: string[]; itemKeys: string[] }> = [
    {
      key: 'gudang',
      label: 'Stock Gudang',
      amountKeys: ['StockGudangClosingAmount', 'StockGudangOnHandHoldAmount', 'GudangTotalAmount', 'GudangTotalAssetAmount'],
      qtyKeys: ['StockGudangQtyOnHandHold', 'GudangTotalQty'],
      itemKeys: ['StockGudangItem', 'GudangItemCount', 'GudangItemWithStock'],
    },
    {
      key: 'workshop',
      label: 'Workshop Mesin',
      amountKeys: ['WorkshopMesinClosingAmount', 'WorkshopMesinOnHandHoldAmount', 'WorkshopTotalAmount'],
      qtyKeys: ['WorkshopMesinQtyOnHandHold', 'WorkshopTotalQty'],
      itemKeys: ['WorkshopMesinItem', 'WorkshopItemCount'],
    },
  ]

  const hasSummarySplit = summaryPairs.some((pair) =>
    [...pair.amountKeys, ...pair.itemKeys].some((key) => summary[key] !== undefined && summary[key] !== null && summary[key] !== ''),
  )

  if (hasSummarySplit) {
    return summaryPairs.map((pair, index) => {
      const amount = pair.amountKeys.map((key) => summary[key]).find((value) => value !== undefined && value !== null && value !== '')
      const qty = pair.qtyKeys.map((key) => summary[key]).find((value) => value !== undefined && value !== null && value !== '')
      const items = pair.itemKeys.map((key) => summary[key]).find((value) => value !== undefined && value !== null && value !== '')
      const metrics = [
        amount !== undefined ? { key: 'amount', label: 'Amount', value: amount } : null,
        qty !== undefined ? { key: 'qty', label: 'Qty', value: qty } : null,
        items !== undefined ? { key: 'items', label: 'Items', value: items } : null,
      ].filter(Boolean) as Array<{ key: string; label: string; value: unknown }>
      return {
        label: pair.label,
        value: amount ?? items ?? qty ?? 0,
        description: `${pair.label} amount/value in IDR. Qty and item chips show physical quantity and item count.`,
        tone: KPI_TONES[index % KPI_TONES.length],
        scope: 'breakdown' as const,
        groupField: 'ItemType',
        groupKey: pair.key,
        metrics,
      }
    })
  }

  // Fallback: split loaded rows by ItemType 1 vs 4 when summary has no dedicated columns.
  const buckets: Array<{ key: string; label: string; match: (row: DbRow) => boolean }> = [
    {
      key: 'gudang',
      label: 'Stock Gudang',
      match: (row) => {
        const t = String(row.ItemType ?? row.ItemTypeName ?? '').trim().toLowerCase()
        return t === '1' || t.includes('gudang') || t.includes('stock')
      },
    },
    {
      key: 'workshop',
      label: 'Workshop Mesin',
      match: (row) => {
        const t = String(row.ItemType ?? row.ItemTypeName ?? '').trim().toLowerCase()
        return t === '4' || t.includes('workshop') || t.includes('mesin')
      },
    },
  ]

  return buckets.map((bucket, index) => {
    const matched = rows.filter(bucket.match)
    const metrics = secondary.map((metric) => ({
      key: metric,
      label: displayColumnLabel(metric),
      value: matched.reduce((sum, row) => sum + toNumber(row[metric]), 0),
    }))
    const head = metrics.find((metric) => metric.key === primary) ?? metrics[0]
    return {
      label: bucket.label,
      value: head?.value ?? matched.length,
      description: `${matched.length} items in ItemType breakdown. Value follows primary metric for selected scope.`,
      tone: KPI_TONES[index % KPI_TONES.length],
      scope: 'breakdown' as const,
      groupField: 'ItemType',
      groupKey: bucket.key,
      metrics,
    }
  })
}

/** Sub-category KPI: same metric keys as global, split by table group field. */
function buildSubCategoryKpiCards(
  rows: DbRow[],
  groupField: string | undefined,
  metricKeys: string[],
  chart: DbRow[] = [],
  limit = SUB_KPI_DEFAULT_LIMIT,
): ReportKpiCard[] {
  if (!groupField || metricKeys.length === 0) return []
  const primary = metricKeys[0]
  // Keep export-aligned movement columns on each sub card (not just top 5).
  const secondary = metricKeys.slice(0, 12)
  const buckets = new Map<string, { count: number; metrics: Record<string, number>; name?: string; fromChart?: boolean }>()

  // Prefer full-scope chart aggregates (GROUP BY analysis field over report_rows).
  // Loaded table rows are paginated — summing them understates Closing vs export grand total.
  const matchedChart = chartRowsForGroupField(chart, groupField)
  const useChartOnly = matchedChart.length > 0

  if (useChartOnly) {
    for (const row of matchedChart) {
      const key = chartGroupKey(row, groupField)
      if (!key) continue
      const bucket = buckets.get(key) ?? { count: 0, metrics: {}, name: undefined, fromChart: true }
      const chartName = chartGroupName(row, groupField)
      if (chartName) bucket.name = chartName
      for (const metric of secondary) {
        const value = chartMetricValue(row, metric)
        if (value !== undefined) bucket.metrics[metric] = value
      }
      const primaryValue = chartMetricValue(row, primary)
      if (primaryValue !== undefined) bucket.metrics[primary] = primaryValue
      const itemCount = chartMetricValue(row, 'TotalItem')
      if (itemCount !== undefined) bucket.count = itemCount
      bucket.fromChart = true
      buckets.set(key, bucket)
    }
  } else {
    const groupAliases = resolveGroupFieldAliases(groupField)
    for (const row of rows) {
      let key = ''
      for (const alias of groupAliases) {
        const text = String(row[alias] ?? '').trim()
        if (text) {
          key = text
          break
        }
      }
      if (!key) key = '(blank)'
      const bucket = buckets.get(key) ?? { count: 0, metrics: {}, name: undefined }
      bucket.count += 1
      if (
        !bucket.name &&
        (groupFieldsMatch(groupField, 'ProductTypeCode') || groupFieldsMatch(groupField, 'ProductType')) &&
        row.ProductTypeDescription
      ) {
        bucket.name = String(row.ProductTypeDescription)
      }
      if (!bucket.name && groupFieldsMatch(groupField, 'MovementCategory') && row.MovementCategory) {
        bucket.name = String(row.MovementCategory)
      }
      for (const metric of secondary) {
        bucket.metrics[metric] = (bucket.metrics[metric] ?? 0) + toNumber(row[metric])
      }
      buckets.set(key, bucket)
    }
  }

  const ranked = [...buckets.entries()]
    .sort((a, b) => (b[1].metrics[primary] ?? 0) - (a[1].metrics[primary] ?? 0) || b[1].count - a[1].count)
    .slice(0, limit)

  return ranked.map(([key, stats], index) => {
    const masterHint =
      stats.name && stats.name !== key
        ? `${key} · ${stats.name}`
        : key
    const metricList = secondary
      .filter((metric) => stats.metrics[metric] !== undefined)
      .map((metric) => ({
        key: metric,
        label: displayColumnLabel(metric),
        value: stats.metrics[metric],
      }))
    const head = metricList[0]
    return {
      label: masterHint,
      value: head?.value ?? stats.count,
      description: stats.fromChart
        ? `${stats.count} items in ${displayColumnLabel(groupField)}. Amount/Qty chips use full grouped summary.`
        : `${stats.count} items in ${displayColumnLabel(groupField)} from loaded rows only.`,
      tone: KPI_TONES[index % KPI_TONES.length],
      scope: 'sub' as const,
      groupField,
      groupKey: key,
      metrics: metricList,
    }
  })
}

function buildDynamicGrandTotalKpis(
  payload: ReportPayload,
  filters?: ReportFilterInput,
  preferredColumns: string[] = [],
  limit = 12,
  tableGroupField?: string,
): ReportKpiCard[] {
  const summary = payload.summary ?? {}
  const metadata = payload.metadata ?? {}
  const rows = payload.rows ?? []
  const columns = payload.columns ?? []
  const metricKeys = resolveMetricKeysForKpis(summary, columns, preferredColumns, 8)

  const globalCards: ReportKpiCard[] = []
  const used = new Set<string>()

  for (const key of metricKeys) {
    if (used.has(key) || globalCards.length >= 14) break
    const picked = pickMetricValue(summary, rows, key)
    if (!picked) continue
    if (typeof picked.value === 'string' && Number.isNaN(Number(String(picked.value).replace(/[^\d.-]/g, ''))) && String(picked.value).trim() !== '0') {
      continue
    }
    used.add(key)
    globalCards.push({
      label: displayColumnLabel(key),
      value: picked.value,
      description: picked.source === 'summary' ? kpiMeaning(key) : `${displayColumnLabel(key)} sum from loaded rows only.`,
      tone: KPI_TONES[globalCards.length % KPI_TONES.length],
      scope: 'global',
    })
  }

  const period =
    summary.ActualPeriod ??
    summary.actualPeriod ??
    metadata.actualPeriod ??
    metadata.period ??
    filters?.period
  const acc = summary.AccountingPeriod ?? summary.accountingPeriod ?? metadata.accountingPeriod
  if (period) {
    globalCards.push({
      label: 'Actual Period',
      value: period,
      description: 'Actual calendar period applied by report filters.',
      tone: 'border-white/10 bg-[#0F2B1A] text-white',
      scope: 'global',
    })
  }
  if (acc) {
    globalCards.push({
      label: 'Acc Period',
      value: acc,
      description: 'Accounting fiscal period used by inventory report data.',
      tone: 'border-white/10 bg-[#1A1A1A] text-white',
      scope: 'global',
    })
  }

  // Two analysis families (do not mix):
  // 1) Stored taxonomy sub — fields already on row/master (ProductType, Location…).
  // 2) Computed rails — derived outside raw table cells (Movement Actual from StockIssue window).
  // Future auto-calc analyses → new scope rail like `movement`, never dump into `sub`.
  const selectedGroup = tableGroupField || filters?.groupBy || filters?.chartDimension
  const selectedIsItemType = groupFieldsMatch(selectedGroup, 'ItemType')
  const selectedIsComputedMovement = groupFieldsMatch(selectedGroup, 'MovementCategory')
  // Sub-category = stored fields only. MovementCategory never resolves as sub dim.
  const dim = resolveGroupDimension(
    rows,
    selectedIsItemType || selectedIsComputedMovement ? undefined : selectedGroup,
    selectedGroup && !selectedIsItemType && !selectedIsComputedMovement
      ? []
      : ['ProductTypeCode', 'ProductType', 'Gudang', 'Location'],
  )
  const breakdownCards = buildItemTypeBreakdownCards(summary, rows, metricKeys)
  const subCards =
    selectedIsItemType || selectedIsComputedMovement
      ? []
      : buildSubCategoryKpiCards(rows, dim, metricKeys, payload.chart ?? [], SUB_KPI_DEFAULT_LIMIT)
  // Computed Movement Actual — always own rail (scope=movement), not sub-category.
  const movementRailCards = buildSubCategoryKpiCards(
    rows,
    'MovementCategory',
    metricKeys,
    payload.chart ?? [],
    SUB_KPI_DEFAULT_LIMIT,
  ).map((card) => ({
    ...card,
    scope: 'movement' as const,
    description: 'Movement Category from StockIssue activity. Value follows issue amount/count metric for active movement window.',
  }))

  // Structure: GLOBAL → ItemType breakdown → stored sub → computed Movement Actual.
  const metricPreview = globalCards
    .filter((card) => card.scope === 'global' && card.label !== 'Actual Period' && card.label !== 'Acc Period')
    .slice(0, 14)

  if (breakdownCards.length > 0 || subCards.length > 0 || movementRailCards.length > 0) {
    return [
      {
        label: 'Global totals',
        value: metricPreview[0]?.value ?? rows.length,
        description: breakdownCards.length
          ? `Grand total summary for Gudang + Workshop. Also shows ${subCards.length} taxonomy groups and ${movementRailCards.length} Movement Category cards.`
          : `${displayColumnLabel(dim ?? 'taxonomy')} grouping summary: ${subCards.length} taxonomy groups and ${movementRailCards.length} Movement Category cards.`,
        tone: 'border-white/10 bg-[#0F2B1A] text-lime-100',
        scope: 'global' as const,
        metrics: metricPreview.map((card) => ({ key: card.label, label: card.label, value: card.value })),
      },
      ...globalCards.slice(0, 14),
      ...breakdownCards,
      ...(subCards.length > 0
        ? [
            {
              label: `Sub · ${displayColumnLabel(dim ?? 'group')}`,
              value: subCards.length,
              description: 'Stored taxonomy grouping such as Product, Brand, Model, Material, or Location. Not Movement Category.',
              tone: 'border-white/10 bg-[#102b1b] text-lime-100',
              scope: 'sub' as const,
              groupField: dim,
            },
            ...subCards,
          ]
        : []),
      ...movementRailCards,
    ]
  }

  return [...globalCards.slice(0, limit), ...movementRailCards]
}

function groupedKpiCards(rows: DbRow[], groupBy?: string, preferred: string[] = [], limit = 6): ReportKpiCard[] {
  return buildSubCategoryKpiCards(rows, resolveGroupDimension(rows, groupBy, preferred), amountKeysForRows(rows).concat(qtyKeysForRows(rows)).slice(0, 4), [], limit)
}
function kpiMeaning(field: string, label = displayColumnLabel(field)) {
  if (/period|bulan|month/i.test(field)) return `${label} applied by report filters.`
  if (/amount|nilai|value|cost|harga|valuation|asset/i.test(field)) return `${label} amount/value in IDR for selected report scope.`
  if (/qty|quantity|stok|stock|saldo/i.test(field)) return `${label} physical quantity total for selected report scope.`
  if (/count|item|rows|row|total|supplier|location|gudang/i.test(field)) return `${label} count for selected report scope.`
  return `${label} from report summary for selected scope.`
}

const GENERIC_KPI_PRIORITY: Array<{ keys: string[]; label: string; description: string; tone: string }> = [
  { keys: ['TotalAmount', 'total_amount', 'ClosingAmount', 'NilaiStok', 'Amount'], label: 'Total Amount', description: 'Main report amount/value in IDR for selected scope.', tone: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  { keys: ['TotalItem', 'total_item', 'FilteredRows', 'TotalRows'], label: 'Total Item / Rows', description: 'Item or row count in selected report scope.', tone: 'border-blue-100 bg-blue-50 text-blue-800' },
  { keys: ['TotalQty', 'total_quantity', 'ClosingQty', 'Qty'], label: 'Total Qty', description: 'Physical quantity total in selected report scope.', tone: 'border-cyan-100 bg-cyan-50 text-cyan-800' },
  { keys: ['ActualPeriod', 'actualPeriod', 'period'], label: 'Actual Period', description: 'Calendar month applied by report filters.', tone: 'border-white/10 bg-[#0F2B1A] text-white' },
  { keys: ['AccountingPeriod', 'accountingPeriod'], label: 'Acc Period', description: 'Accounting fiscal period used by report data.', tone: 'border-white/10 bg-[#1A1A1A] text-white' },
  { keys: ['TotalLocation', 'LocationCount'], label: 'Location', description: 'Location/Gudang count in selected report scope.', tone: 'border-teal-100 bg-teal-50 text-teal-800' },
  { keys: ['TotalSupplier', 'SupplierCount'], label: 'Supplier', description: 'Supplier count in selected report scope.', tone: 'border-lime-100 bg-lime-50 text-lime-800' },
]

function genericKpis(payload: ReportPayload, filters?: ReportFilterInput): ReportKpiCard[] {
  const dynamic = buildDynamicGrandTotalKpis(
    payload,
    filters,
    [
      'TotalAmount',
      'total_amount',
      'ClosingAmount',
      'AmountItem',
      'NilaiStok',
      'TotalQty',
      'TotalItem',
      'FilteredRows',
    ],
    18,
    filters?.groupBy ?? filters?.chartDimension,
  )
  if (dynamic.length > 0) return dynamic

  const summary = payload.summary ?? {}
  const used = new Set<string>()
  const cards: ReportKpiCard[] = []
  const groupCards = groupedKpiCards(
    payload.rows,
    filters?.groupBy ?? filters?.chartDimension,
    ['MovementCategory', 'ProductTypeCode', 'Gudang', 'Location', 'ProductType', 'KodeKategori', 'SupplierName'],
    6,
  )

  for (const rule of GENERIC_KPI_PRIORITY) {
    const hit = rule.keys.find((key) => summary[key] !== undefined && summary[key] !== null && summary[key] !== '')
    if (!hit || used.has(hit)) continue
    used.add(hit)
    cards.push({ label: rule.label, value: summary[hit], description: rule.description, tone: rule.tone })
  }

  // Fill with remaining numeric-ish summary keys (skip technical noise).
  for (const [key, value] of Object.entries(summary)) {
    if (cards.length >= 8) break
    if (used.has(key)) continue
    if (/^(source|server|database|sql|debug|reportId|quality)/i.test(key)) continue
    if (value === null || value === undefined || value === '') continue
    if (typeof value === 'object') continue
    used.add(key)
    cards.push({
      label: displayColumnLabel(key),
      value,
      description: kpiMeaning(key),
      tone: 'border-white/10 bg-[#1A1A1A] text-white',
    })
  }

  if (cards.length === 0) {
    cards.push(
      { label: 'Rows', value: payload.rows.length, description: 'Visible payload row count for selected report scope.', tone: 'border-blue-100 bg-blue-50 text-blue-800' },
      { label: 'Columns', value: payload.columns.length, description: 'Column count returned by selected report payload.', tone: 'border-slate-200 bg-slate-50 text-slate-800' },
    )
  }

  if (groupCards.length > 0 && (filters?.groupBy || filters?.chartDimension)) {
    const dim = filters?.groupBy ?? filters?.chartDimension
    return [
      { label: `Group: ${displayColumnLabel(String(dim))}`, value: groupCards.length, description: 'Number of KPI cards grouped by user-selected analysis field.', tone: 'border-white/10 bg-[#102b1b] text-lime-100' },
      ...groupCards,
      ...cards.slice(0, 4),
    ].slice(0, 12)
  }
  return cards
}

function genericQualityItems(payload: ReportPayload | null, rows: DbRow[]): Array<[string, unknown]> {
  return [
    ['Rows tampil', rows.length],
    ['Rows payload', payload?.rows.length ?? 0],
    ['Kolom', payload?.columns.length ?? 0],
    ['Filter aktif', payload?.metadata?.filteredRows ?? rows.length],
  ]
}

function genericTopRows(rows: DbRow[]) {
  return [...rows].sort((a, b) => numericValue(b) - numericValue(a)).slice(0, 10)
}

function stockAgingQualityItems(payload: ReportPayload | null, rows: DbRow[]): Array<[string, unknown]> {
  return [
    ['Stok Nol', payload?.summary.ItemStokNol ?? rows.filter((row) => toNumber(row.QuantityClosing ?? row.StokAkhir) === 0).length],
    ['Tanpa Kategori', payload?.summary.ItemTanpaKategori ?? rows.filter((row) => !String(row.KodeKategori ?? row.Kategori ?? '').trim()).length],
    ['Tidak Update > 12 Bulan', payload?.summary.StaleLebih12Bulan ?? rows.filter((row) => toNumber(row.UmurBulan) >= 12).length],
    ['Tidak Update > 24 Bulan', payload?.summary.DeadStockLebih24Bulan ?? rows.filter((row) => toNumber(row.UmurBulan) >= 24).length],
    ['Critical Risk', rows.filter((row) => String(row.RiskLevel ?? '').toLowerCase() === 'critical').length],
  ]
}


const contextValueAliases: Record<string, string[]> = {
  report_id: ['report_id', 'sourceReportId', 'reportId'],
  source_report_title: ['source_report_title', 'sourceReportTitle'],
  accounting_period: ['accounting_period', 'accountingPeriod'],
  actual_period: ['actual_period', 'actualPeriod', 'period'],
  acc_year: ['acc_year', 'accYear'],
  acc_month: ['acc_month', 'accMonth'],
  actual_year: ['actual_year', 'actualYear'],
  actual_month: ['actual_month', 'actualMonth'],
  period_data_source: ['period_data_source', 'periodDataSource'],
}

function payloadContextValue(payload: ReportPayload | null, field: string) {
  if (!payload) return undefined
  const keys = contextValueAliases[field] ?? [field]
  for (const source of [payload.summary, payload.metadata]) {
    for (const key of keys) {
      const value = source[key]
      if (value !== null && value !== undefined && value !== '') return value
    }
  }
  return undefined
}


function movementRowKey(row: DbRow, fallback: string) {
  return [
    row.KodeBarang,
    row.Gudang,
    row.LastUpdateDate ?? row.TerakhirUpdate,
    row.LastMovementDate,
    fallback,
  ].map((value) => String(value ?? '').trim()).join('|')
}


function numericValue(row: DbRow) {
  const preferred = [
    'Amount',
    'amount',
    'NilaiFuel',
    'NilaiStok',
    'TotalAmount',
    'total_amount',
    'QtyFuel',
    'Qty',
    'qty',
    'total_quantity',
    'TotalRows',
    'TotalItem',
  ]
  for (const key of preferred) {
    const value = toNumber(row[key])
    if (value) return value
  }
  return Math.max(0, ...Object.values(row).map(toNumber))
}

function groupMetricTotal(rows: DbRow[], keys: string[]) {
  const key = keys.find((item) => rows.some((row) => row[item] !== undefined && row[item] !== null && row[item] !== ''))
  if (!key) return 0
  return rows.reduce((sum, row) => sum + toNumber(row[key]), 0)
}

function stockAgingTopItems(rows: DbRow[]) {
  return [...rows]
    .sort((a, b) => toNumber(b.RiskScore) - toNumber(a.RiskScore) || (toNumber(b.TotalAmount) || toNumber(b.NilaiStok)) - (toNumber(a.TotalAmount) || toNumber(a.NilaiStok)))
    .slice(0, 10)
}

function preferredGroupColumn(columns: string[], profile: ReportViewerProfile, filters: ReportFilterInput) {
  // Explicit groupBy/chartDimension always wins — match aliases on payload columns.
  const explicit = filters.groupBy || filters.chartDimension
  if (explicit) {
    for (const alias of resolveGroupFieldAliases(explicit)) {
      if (columns.includes(alias)) return alias
    }
    if (columns.includes(explicit)) return explicit
    return explicit
  }

  const preferred = [
    filters.productType ? 'ProductTypeCode' : undefined,
    filters.productCategory ? 'ProductCategoryCode' : undefined,
    filters.productBrand ? 'ProductBrandCode' : undefined,
    filters.productModel ? 'ProductModelCode' : undefined,
    filters.productMaterial ? 'ProductMaterialCode' : undefined,
    filters.movementCategory ? 'MovementCategory' : undefined,
    undefined,
    ...profile.preferredGroupColumns,
  ].filter(Boolean) as string[]

  for (const column of preferred) {
    for (const alias of resolveGroupFieldAliases(column)) {
      if (columns.includes(alias)) return alias
    }
    if (columns.includes(column)) return column
  }
  return undefined
}

function filterKeyForGroupField(groupField?: string): keyof ReportFilterInput | undefined {
  if (!groupField) return undefined
  if (groupField === 'ProductTypeCode' || groupField === 'ProductTypeDescription') return 'productType'
  if (groupField === 'ProductCategoryCode') return 'productCategory'
  if (groupField === 'ProductBrandCode') return 'productBrand'
  if (groupField === 'ProductModelCode') return 'productModel'
  if (groupField === 'ProductMaterialCode') return 'productMaterial'
  if (groupField === 'MovementCategory') return 'movementCategory'
  if (groupField === 'Location' || groupField === 'Gudang' || groupField === 'LocCode') return 'location'
  if (groupField === 'ItemType' || groupField === 'ItemTypeName') return 'itemType'
  return undefined
}

function appendFilterParam(params: URLSearchParams, key: keyof ReportFilterInput, value: unknown) {
  if (value === undefined || value === null || value === '') return
  params.set(String(key), String(value))
}

const viewerFilterQueryKeys: Array<keyof ReportFilterInput | 'natural'> = [
  'search',
  'period',
  'accYear',
  'accMonth',
  'actualYear',
  'actualMonth',
  'dateFrom',
  'dateTo',
  'location',
  'category',
  'supplier',
  'status',
  'vehicle',
  'itemType',
  'includeWorkshopItem',
  'productType',
  'productCategory',
  'productBrand',
  'productModel',
  'productMaterial',
  'movementCategory',
  'movementWindow',
  'movementFastMin',
  'movementMovingMin',
  'movementMovingMax',
  'movementSlowCount',
  'blankField',
  'minQty',
  'minAmount',
  'sortMetric',
  'sortColumn',
  'sortDirection',
  'chartDimension',
  'groupBy',
  'aggregateField',
  'aggregateFn',
  'top',
  'resultLimit',
  'rowStart',
  'rowEnd',
  'stale',
  'analysis',
  'columnFilters',
  'naturalQuery',
  'natural',
]

function viewerUrlWithFilters(pathname: string, currentParams: URLSearchParams, source: ReportSource, filters: ReportFilterInput) {
  const params = new URLSearchParams(currentParams.toString())
  params.set('source', source)
  viewerFilterQueryKeys.forEach((key) => params.delete(String(key)))
  appendFilterParam(params, 'search', filters.search)
  appendFilterParam(params, 'period', filters.period)
  appendFilterParam(params, 'accYear', filters.accYear)
  appendFilterParam(params, 'accMonth', filters.accMonth)
  appendFilterParam(params, 'actualYear', filters.actualYear)
  appendFilterParam(params, 'actualMonth', filters.actualMonth)
  appendFilterParam(params, 'dateFrom', filters.dateFrom)
  appendFilterParam(params, 'dateTo', filters.dateTo)
  appendFilterParam(params, 'location', filters.location)
  appendFilterParam(params, 'category', filters.category)
  appendFilterParam(params, 'supplier', filters.supplier)
  appendFilterParam(params, 'status', filters.status)
  appendFilterParam(params, 'vehicle', filters.vehicle)
  appendFilterParam(params, 'itemType', filters.itemType)
  appendFilterParam(params, 'includeWorkshopItem', filters.includeWorkshopItem)
  appendFilterParam(params, 'productType', filters.productType)
  appendFilterParam(params, 'productCategory', filters.productCategory)
  appendFilterParam(params, 'productBrand', filters.productBrand)
  appendFilterParam(params, 'productModel', filters.productModel)
  appendFilterParam(params, 'productMaterial', filters.productMaterial)
  appendFilterParam(params, 'movementCategory', filters.movementCategory)
  appendFilterParam(params, 'movementWindow', filters.movementWindow)
  appendFilterParam(params, 'movementFastMin', filters.movementFastMin)
  appendFilterParam(params, 'movementMovingMin', filters.movementMovingMin)
  appendFilterParam(params, 'movementMovingMax', filters.movementMovingMax)
  appendFilterParam(params, 'movementSlowCount', filters.movementSlowCount)
  appendFilterParam(params, 'blankField', filters.blankField)
  appendFilterParam(params, 'minQty', filters.minQty)
  appendFilterParam(params, 'minAmount', filters.minAmount)
  appendFilterParam(params, 'sortMetric', filters.sortMetric)
  appendFilterParam(params, 'sortColumn', filters.sortColumn)
  appendFilterParam(params, 'sortDirection', filters.sortDirection)
  appendFilterParam(params, 'chartDimension', filters.chartDimension)
  appendFilterParam(params, 'groupBy', filters.groupBy)
  appendFilterParam(params, 'aggregateField', filters.aggregateField)
  appendFilterParam(params, 'aggregateFn', filters.aggregateFn)
  appendFilterParam(params, 'top', filters.top)
  appendFilterParam(params, 'resultLimit', filters.resultLimit)
  appendFilterParam(params, 'rowStart', filters.rowStart)
  appendFilterParam(params, 'rowEnd', filters.rowEnd)
  appendFilterParam(params, 'stale', filters.stale)
  appendFilterParam(params, 'analysis', filters.analysis)
  if (filters.columnFilters?.length) params.set('columnFilters', JSON.stringify(filters.columnFilters))
  appendFilterParam(params, 'naturalQuery', filters.naturalQuery)
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function hasActionableFilters(filters?: ReportFilterInput) {
  if (!filters) return false
  return Object.entries(filters).some(([key, value]) => {
    if (key === 'naturalQuery') return false
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  })
}

type FetchReportOptions = {
  page?: number
  pageSize?: number
  signal?: AbortSignal
  tableSortColumn?: string
  tableSortDirection?: 'asc' | 'desc'
  debugSql?: boolean
}

function buildReportParams(report: InventoryReport, source: ReportSource, limit: number | 'all' = 500, filters: ReportFilterInput = {}, options: FetchReportOptions = {}) {
  const params = new URLSearchParams({ report: report.apiReport, limit: String(limit), source })
  if (options.page) params.set('page', String(options.page))
  if (options.pageSize) params.set('pageSize', String(options.pageSize))
  if (options.tableSortColumn) {
    params.set('tableSortColumn', options.tableSortColumn)
    params.set('tableSortDirection', options.tableSortDirection ?? 'asc')
  }
  if (options.debugSql) params.set('debugSql', '1')
  appendFilterParam(params, 'search', filters.search)
  appendFilterParam(params, 'period', filters.period)
  appendFilterParam(params, 'accYear', filters.accYear)
  appendFilterParam(params, 'accMonth', filters.accMonth)
  appendFilterParam(params, 'actualYear', filters.actualYear)
  appendFilterParam(params, 'actualMonth', filters.actualMonth)
  appendFilterParam(params, 'dateFrom', filters.dateFrom)
  appendFilterParam(params, 'dateTo', filters.dateTo)
  appendFilterParam(params, 'location', filters.location)
  appendFilterParam(params, 'category', filters.category)
  appendFilterParam(params, 'supplier', filters.supplier)
  appendFilterParam(params, 'status', filters.status)
  appendFilterParam(params, 'vehicle', filters.vehicle)
  appendFilterParam(params, 'itemType', filters.itemType)
  appendFilterParam(params, 'includeWorkshopItem', filters.includeWorkshopItem)
  appendFilterParam(params, 'productType', filters.productType)
  appendFilterParam(params, 'productCategory', filters.productCategory)
  appendFilterParam(params, 'productBrand', filters.productBrand)
  appendFilterParam(params, 'productModel', filters.productModel)
  appendFilterParam(params, 'productMaterial', filters.productMaterial)
  appendFilterParam(params, 'movementCategory', filters.movementCategory)
  appendFilterParam(params, 'movementWindow', filters.movementWindow)
  appendFilterParam(params, 'movementFastMin', filters.movementFastMin)
  appendFilterParam(params, 'movementMovingMin', filters.movementMovingMin)
  appendFilterParam(params, 'movementMovingMax', filters.movementMovingMax)
  appendFilterParam(params, 'movementSlowCount', filters.movementSlowCount)
  appendFilterParam(params, 'blankField', filters.blankField)
  appendFilterParam(params, 'minQty', filters.minQty)
  appendFilterParam(params, 'minAmount', filters.minAmount)
  appendFilterParam(params, 'sortMetric', filters.sortMetric)
  appendFilterParam(params, 'sortColumn', filters.sortColumn)
  appendFilterParam(params, 'sortDirection', filters.sortDirection)
  appendFilterParam(params, 'chartDimension', filters.chartDimension)
  appendFilterParam(params, 'groupBy', filters.groupBy)
  appendFilterParam(params, 'aggregateField', filters.aggregateField)
  appendFilterParam(params, 'aggregateFn', filters.aggregateFn)
  appendFilterParam(params, 'top', filters.top)
  appendFilterParam(params, 'resultLimit', filters.resultLimit)
  appendFilterParam(params, 'rowStart', filters.rowStart)
  appendFilterParam(params, 'rowEnd', filters.rowEnd)
  appendFilterParam(params, 'stale', filters.stale)
  appendFilterParam(params, 'analysis', filters.analysis)
  if (filters.columnFilters?.length) params.set('columnFilters', JSON.stringify(filters.columnFilters))
  appendFilterParam(params, 'naturalQuery', filters.naturalQuery)
  return params
}

async function fetchReport(report: InventoryReport, source: ReportSource, limit: number | 'all' = 500, filters: ReportFilterInput = {}, options: FetchReportOptions = {}) {
  const params = buildReportParams(report, source, limit, filters, options)
  const response = await fetch(`/api/reports/inventory?${params.toString()}`, { cache: 'no-store', signal: options.signal, headers: typeof window !== 'undefined' ? { 'x-sql-gateway-base': window.localStorage.getItem('report-center:sql-gateway-base') || 'http://10.0.0.110:8001' } : undefined })
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    const body = await response.text()
    const hint = body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')
      ? 'Server return HTML (bukan JSON) — cek route API / proxy / login.'
      : `Response non-JSON (${contentType || 'unknown'}).`
    throw new Error(hint)
  }
  const data = (await response.json()) as ApiResponse
  if (!response.ok || !data.success || !data.data) throw new Error(data.error ?? 'Gagal memuat laporan')
  return data.data
}

function isReportPayloadReady(payload: ReportPayload | null) {
  return Boolean(
    payload &&
      Array.isArray(payload.rows) &&
      Array.isArray(payload.columns) &&
      payload.columns.length > 0 &&
      payload.summary &&
      payload.metadata &&
      (payload.metadata.tableReady === undefined || payload.metadata.tableReady === true),
  )
}

function exportRowCeiling(reportId: string) {
  return MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(reportId) ? 100_000 : 20_000
}

function downloadCsv(report: InventoryReport, source: ReportSource, filters: ReportFilterInput) {
  const ceiling = exportRowCeiling(report.id)
  const params = buildReportParams(report, source, 'all', filters)
  params.set('format', 'csv')
  const anchor = document.createElement('a')
  anchor.href = `/api/reports/inventory?${params.toString()}`
  anchor.download = `${report.id}.csv`
  anchor.click()
  window.setTimeout(() => {
    window.alert(`CSV diunduh (batas sistem hingga ${ceiling.toLocaleString('id-ID')} baris terfilter).`)
  }, 50)
}

async function exportExcel(report: InventoryReport, source: ReportSource, filters: ReportFilterInput, options?: { skipConfirm?: boolean }) {
  const ceiling = exportRowCeiling(report.id)
  if (!options?.skipConfirm && !window.confirm(`Export Excel memuat baris di browser (hingga ~${ceiling.toLocaleString('id-ID')} baris). Lanjut?`)) return
  const payload = await fetchReport(report, source, 'all', filters)
  const rows = payload.rows
  if (rows.length === 0) {
    window.alert('Tidak ada baris untuk diekspor.')
    return
  }
  const XLSX = await import('xlsx')
  const sheet = XLSX.utils.json_to_sheet(rows)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, report.title.slice(0, 31))
  XLSX.writeFile(workbook, `${report.id}.xlsx`)
  window.alert(`Excel: ${rows.length.toLocaleString('id-ID')} baris (bukan sampel AI; batas sistem ${ceiling.toLocaleString('id-ID')}).`)
}

async function exportPdf(report: InventoryReport, rows: DbRow[], columns: string[]) {
  const { default: JsPDF } = await import('jspdf')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'pt' })
  let y = 40
  const visible = columns.slice(0, 7)
  const previewRows = rows.slice(0, 34)
  doc.setFontSize(14)
  doc.text(report.title, 40, y)
  y += 16
  doc.setFontSize(9)
  doc.setTextColor(120, 40, 40)
  doc.text('PRATINJAU PDF — maks 34 baris × 7 kolom. Bukan laporan resmi penuh.', 40, y)
  doc.setTextColor(0, 0, 0)
  y += 14
  doc.setFontSize(8)
  doc.text(visible.join(' | '), 40, y)
  y += 14
  previewRows.forEach((row) => {
    doc.text(visible.map((column) => formatValue(row[column])).join(' | ').slice(0, 165), 40, y)
    y += 12
  })
  doc.save(`${report.id}-pratinjau.pdf`)
}

async function runConfirmedExport(
  kind: ExportPreflightKind,
  report: InventoryReport,
  source: ReportSource,
  filters: ReportFilterInput,
  rows: DbRow[],
  columns: string[],
) {
  if (kind === 'csv') return downloadCsv(report, source, filters)
  if (kind === 'excel') return exportExcel(report, source, filters, { skipConfirm: true })
  return exportPdf(report, rows, columns)
}

export default function ReportViewerClient({ reportId }: { reportId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchParamString = searchParams.toString()
  const report = getInventoryReport(reportId) ?? liveInventoryReports[0]
  const viewerProfile = useMemo(() => getReportViewerProfile(report.id, {
    genericKpis,
    genericQualityItems,
    genericTopRows,
    movementAnalysisKpis,
    movementAnalysisQualityItems,
    movementAnalysisTopItems,
    stockAgingKpis,
    stockAgingQualityItems,
    stockAgingTopItems,
    assetValuationKpis,
    monthlyStockMovementKpis: buildMonthlyStockMovementKpis,
    toNumber,
  }), [report.id])
  const [selectedSource, setSelectedSource] = useState<ReportSource>(normalizeSource(searchParams.get('source')))
  const [urlFilterSignature, setUrlFilterSignature] = useState(() => `${report.id}:${searchParamString}`)
  const [payload, setPayload] = useState<ReportPayload | null>(null)
  const [aiDashboard, setAiDashboard] = useState<AiDashboardDefinition | null>(null)
  const [aiDashboardLoading, setAiDashboardLoading] = useState(false)
  const [aiDashboardError, setAiDashboardError] = useState<string | null>(null)
  const [aiRefreshKey, setAiRefreshKey] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadStartedAt, setLoadStartedAt] = useState(() => Date.now())
  const [tableReady, setTableReady] = useState(false)
  const [tableStreaming, setTableStreaming] = useState(false)
  const [tableStreamProgress, setTableStreamProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [analysisReady, setAnalysisReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tableSearch, setTableSearch] = useState('')
  const [debouncedTableSearch, setDebouncedTableSearch] = useState('')
  const [remoteTableSearch, setRemoteTableSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(100)
  const [sortColumn, setSortColumn] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [serverSort, setServerSort] = useState<{ column?: string; direction: 'asc' | 'desc' }>({ direction: 'asc' })
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [tableGroupMode, setTableGroupMode] = useState(AUTO_GROUP)
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [manualFilters, setManualFilters] = useState<ReportFilterInput>(() => normalizeViewerReportFilters(report.id, filtersFromSearchParams(searchParams)))
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterInput>(() => normalizeViewerReportFilters(report.id, filtersFromSearchParams(searchParams)))
  const [columnFilterDraft, setColumnFilterDraft] = useState<Partial<ReportColumnFilter>>({ operator: 'contains' })
  const [naturalQuery, setNaturalQuery] = useState('')
  const [naturalLoading, setNaturalLoading] = useState(false)
  const [filterMessage, setFilterMessage] = useState<string | null>(null)
  const [filterWarning, setFilterWarning] = useState<string | null>(null)
  const [filterError, setFilterError] = useState<string | null>(null)
  const [tableExpanded, setTableExpanded] = useState(false)
  const [manualFilterOpen, setManualFilterOpen] = useState(false)
  const [reportInfoVisible, setReportInfoVisible] = useState(false)
  const [reportInfoManuallyOpened, setReportInfoManuallyOpened] = useState(false)
  const [aiInsightVisible, setAiInsightVisible] = useState(false)
  const [aiQuestionRequest, setAiQuestionRequest] = useState<ReportQuestionRequest | null>(null)
  const [insightTab, setInsightTab] = useState<InsightTab>('charts')
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTabId>('ringkasan')
  const [exportPreflight, setExportPreflight] = useState<null | { kind: ExportPreflightKind }>(null)
  const [debugSqlFocus, setDebugSqlFocus] = useState('summary')
  /** Per-KPI simple SQL (illustrative) — shown instead of full gateway dump when set. */
  const [kpiSimpleSqlView, setKpiSimpleSqlView] = useState<{ label: string; sql: string } | null>(null)
  const [tableDensity, setTableDensity] = useState<TableDensity>('compact')
  const [expandedMovementRows, setExpandedMovementRows] = useState<Record<string, boolean>>({})
  /** Monthly Ringkasan: secondary rails (global/breakdown/sub/movement) collapsed by default. */
  const [monthlySecondaryOpen, setMonthlySecondaryOpen] = useState(false)
  const { favorites, toggleFavorite, addRecent } = useReportStore()
  const uniqueValuesCache = useRef<Map<string, string[]>>(new Map())
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const requestSeqRef = useRef(0)
  const sortColumnRef = useRef<string | null>(sortColumn)
  const workspaceTabRef = useRef<WorkspaceTabId>(workspaceTab)
  sortColumnRef.current = sortColumn
  workspaceTabRef.current = workspaceTab

  const requestFilters = useMemo<ReportFilterInput>(() => {
    const search = remoteTableSearch.trim()
    return search ? { ...appliedFilters, search } : appliedFilters
  }, [appliedFilters, remoteTableSearch])

  const aiCacheKey = useMemo(
    () => `ai:${report.id}:${selectedSource}:${JSON.stringify(requestFilters)}`,
    [report.id, requestFilters, selectedSource],
  )
  const getCachedAi = useCallback(() => {
    try {
      const cached = sessionStorage.getItem(aiCacheKey)
      return cached ? (JSON.parse(cached) as AiDashboardDefinition) : null
    } catch { return null }
  }, [aiCacheKey])
  const setCachedAi = useCallback((data: AiDashboardDefinition) => {
    try { sessionStorage.setItem(aiCacheKey, JSON.stringify(data)) } catch {}
  }, [aiCacheKey])

  const syncViewerUrl = useCallback((filters: ReportFilterInput, mode: 'push' | 'replace' = 'push') => {
    const targetUrl = viewerUrlWithFilters(pathname, new URLSearchParams(searchParamString), selectedSource, filters)
    const currentUrl = searchParamString ? `${pathname}?${searchParamString}` : pathname
    if (targetUrl === currentUrl) return

    const targetQuery = targetUrl.includes('?') ? targetUrl.split('?')[1] ?? '' : ''
    setUrlFilterSignature(`${report.id}:${targetQuery}`)
    if (mode === 'replace') {
      router.replace(targetUrl, { scroll: false })
      return
    }
    router.push(targetUrl, { scroll: false })
  }, [pathname, report.id, router, searchParamString, selectedSource])

  useEffect(() => {
    const nextSignature = `${report.id}:${searchParamString}`
    if (nextSignature === urlFilterSignature) return

    const urlFilters = normalizeViewerReportFilters(report.id, filtersFromSearchParams(searchParams))
    setManualFilters(urlFilters)
    setAppliedFilters(urlFilters)
    setColumnFilterDraft({ operator: 'contains' })
    setPage(1)
    setFilterWarning(null)
    setFilterError(null)
    setFilterMessage(hasActionableFilters(urlFilters) ? 'Scope dari URL diterapkan ke report.' : null)
    setUrlFilterSignature(nextSignature)
  }, [report.id, searchParamString, searchParams, urlFilterSignature])

  useEffect(() => {
    const sourceParam = searchParams.get('source')
    const storedSource = window.localStorage.getItem(REPORT_SOURCE_STORAGE_KEY)
    const nextSource = sourceParam ? normalizeSource(sourceParam) : normalizeSource(storedSource)
    window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, nextSource)
    if (nextSource !== selectedSource) setSelectedSource(nextSource)
  }, [searchParams, selectedSource])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const search = tableSearch.trim()
      setDebouncedTableSearch(search)
      setRemoteTableSearch(search.length >= 2 ? search : '')
    }, 150)
    return () => window.clearTimeout(timer)
  }, [tableSearch])

  useEffect(() => {
    window.localStorage.setItem(REPORT_SOURCE_STORAGE_KEY, selectedSource)
    addRecent(report.id)
    let active = true
    const controller = new AbortController()
    const requestId = requestSeqRef.current + 1
    requestSeqRef.current = requestId
    const initialLimit = Math.min(pageSize, TABLE_FIRST_LIMIT)

    setLoading(true)
    setLoadStartedAt(Date.now())
    setTableReady(false)
    setTableStreaming(false)
    setTableStreamProgress(null)
    setAnalysisReady(false)
    setError(null)
    setAiDashboard(null)
    setAiDashboardError(null)
    setReportInfoVisible(false)
    setReportInfoManuallyOpened(false)
    setAiInsightVisible(false)
    setInsightTab(workspaceTabRef.current === 'audit' ? 'sql' : 'charts')
    uniqueValuesCache.current.clear()

    const isMonthlyStream = MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(report.id)

    fetchReport(report, selectedSource, initialLimit, requestFilters, {
      page,
      pageSize,
      signal: controller.signal,
      tableSortColumn: serverSort.column,
      tableSortDirection: serverSort.direction,
      debugSql: true,
    })
      .then(async (data) => {
        if (!active || requestSeqRef.current !== requestId) return
        setPayload(data)
        setVisibleColumns(preferredVisibleColumnsForProfile(viewerProfile, data.columns))
        const defaultSort = viewerProfile.defaultSort?.(data.columns)
        const currentSortColumn = sortColumnRef.current
        const hasCurrentSort = Boolean(currentSortColumn && data.columns.includes(currentSortColumn))
        if (!hasCurrentSort && defaultSort) {
          setSortColumn(defaultSort.column)
          setSortDirection(defaultSort.direction)
        } else {
          setSortColumn((current) => (current && data.columns.includes(current) ? current : null))
        }
        // GUARDRAIL(no-page-bounce): never setPage from response here — deps include page
        // and bounce re-triggers full loading UI ("load then reload again").
        setTableReady(isReportPayloadReady(data))
        if (active && requestSeqRef.current === requestId) setLoading(false)

        // Stream full table after first paint — KPI stays on summary; no window cap for monthly.
        if (!isMonthlyStream || !active || requestSeqRef.current !== requestId) return
        const totalHint = Math.max(
          toNumber(data.summary?.TotalItem),
          toNumber(data.metadata?.filteredRows),
          toNumber(data.metadata?.totalRows),
          data.rows.length,
        )
        const alreadyFull =
          Boolean(data.metadata?.streamComplete) ||
          (data.rows.length >= totalHint && data.metadata?.windowed === false && data.metadata?.paginated === false)
        if (alreadyFull) {
          setTableStreamProgress({ loaded: data.rows.length, total: Math.max(totalHint, data.rows.length) })
          return
        }

        setTableStreaming(true)
        setTableStreamProgress({ loaded: data.rows.length, total: totalHint })
        try {
          const full = await fetchReport(report, selectedSource, 'all', requestFilters, {
            signal: controller.signal,
            tableSortColumn: serverSort.column,
            tableSortDirection: serverSort.direction,
          })
          if (!active || requestSeqRef.current !== requestId) return
          // Prefer fuller Issued/Closing from either payload (summary must stay full-scope SQL).
          const mergeSummary = (a: DbRow = {}, b: DbRow = {}) => {
            const out: DbRow = { ...b, ...a }
            for (const key of [
              'IssuedTotalAmount',
              'LedgerAmount',
              'IssuedStationAmount',
              'IssuedVehicleAmount',
              'ClosingAmount',
              'OpeningAmount',
              'GoodsReceiveAmount',
              'ReturnAmount',
              'TotalItem',
            ]) {
              const av = toNumber(a[key])
              const bv = toNumber(b[key])
              if (bv > av) out[key] = b[key]
              else if (av > 0) out[key] = a[key]
            }
            return out
          }
          setPayload((prev) => {
            if (!prev) return full
            const summary = mergeSummary(prev.summary as DbRow, full.summary as DbRow)
            return {
              ...full,
              summary,
              chart: prev.chart?.length ? prev.chart : full.chart,
              analytics: full.analytics ?? prev.analytics,
              metadata: {
                ...full.metadata,
                ...prev.metadata,
                ...full.metadata,
                loadedRows: full.rows.length,
                totalRows: Math.max(toNumber(full.metadata?.totalRows), full.rows.length, totalHint),
                filteredRows: Math.max(toNumber(full.metadata?.filteredRows), full.rows.length, totalHint),
                windowed: false,
                paginated: false,
                tableReady: true,
                streamComplete: true,
              },
            }
          })
          setTableStreamProgress({ loaded: full.rows.length, total: Math.max(full.rows.length, totalHint) })
        } catch (streamErr) {
          if (!active || requestSeqRef.current !== requestId) return
          if (streamErr instanceof DOMException && streamErr.name === 'AbortError') return
          // First page already shown — stream failure is soft.
          setFilterWarning(
            streamErr instanceof Error
              ? `Table stream partial: ${streamErr.message}`
              : 'Table stream partial — showing first window only',
          )
        } finally {
          if (active && requestSeqRef.current === requestId) setTableStreaming(false)
        }
      })
      .catch((err) => {
        if (!active || requestSeqRef.current !== requestId) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setTableReady(false)
        setTableStreaming(false)
        setError(err instanceof Error ? err.message : 'Gagal memuat laporan')
        setLoading(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [report, addRecent, selectedSource, requestFilters, viewerProfile, page, pageSize, serverSort])

  useEffect(() => {
    if (!tableReady) {
      setAnalysisReady(false)
      return
    }

    setAnalysisReady(false)
    const timer = window.setTimeout(() => setAnalysisReady(true), 250)
    return () => window.clearTimeout(timer)
  }, [tableReady, payload, report.id, requestFilters, selectedSource])

  useEffect(() => {
    if (!reportInfoVisible || !tableReady || loading || error || reportInfoManuallyOpened) return

    const timer = window.setTimeout(() => setReportInfoVisible(false), REPORT_INFO_AUTO_HIDE_MS)
    return () => window.clearTimeout(timer)
  }, [error, loading, payload, reportInfoManuallyOpened, reportInfoVisible, tableReady])

  useEffect(() => {
    if (!aiInsightVisible || !payload || !tableReady || !analysisReady) {
      setAiDashboard(null)
      setAiDashboardError(null)
      setAiDashboardLoading(false)
      return
    }

    // Check cache first — skip API call if cached
    const cached = getCachedAi()
    if (cached) {
      setAiDashboard(cached)
      setAiDashboardLoading(false)
      return
    }

    let active = true
    // Delay AI analysis 2s so table renders first (non-blocking)
    const timer = window.setTimeout(async () => {
      setAiDashboardLoading(true)
      setAiDashboardError(null)
      try {
        const minimalPayload = compactReportPayloadForAi(payload, { sampleRows: 50, maxColumns: 40 })
        const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}/ai-analysis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filters: {
              ...requestFilters,
              source: selectedSource,
              reportId: report.id,
              apiReport: report.apiReport,
            },
            payload: minimalPayload,
            report: {
              code: report.code,
              name: report.title,
              description: report.description,
            },
            options: {
              maxCharts: 8,
              includePriorityTable: true,
              includeMissingFields: true,
              language: 'id',
            },
          }),
        })
        const result = await response.json()
        if (!active) return
        if (!response.ok || result.error) throw new Error(result.error ?? 'AI analysis gagal membaca payload report.')
        const aiResult = result as AiDashboardDefinition
        setAiDashboard(aiResult)
        setCachedAi(aiResult)
      } catch (err) {
        if (!active) return
        setAiDashboard(null)
        setAiDashboardError(err instanceof Error ? err.message : 'AI analysis gagal membaca payload report.')
      } finally {
        if (active) setAiDashboardLoading(false)
      }
    }, 2000)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [aiRefreshKey, aiInsightVisible, requestFilters, payload, report.apiReport, report.code, report.description, report.id, report.title, selectedSource, getCachedAi, setCachedAi, tableReady, analysisReady])

  const serverPaged = Boolean(payload?.metadata?.paginated)
  const filteredRows = useMemo(() => {
    const rows = payload?.rows ?? []
    if (serverPaged) return rows
    const q = debouncedTableSearch.trim().toLowerCase()
    const searched = q
      ? rows.filter((row) => Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(q)))
      : rows
    if (!sortColumn) return searched
    return [...searched].sort((a, b) => {
      const av = a[sortColumn]
      const bv = b[sortColumn]
      const result = String(av ?? '').localeCompare(String(bv ?? ''), 'id-ID', { numeric: true })
      return sortDirection === 'asc' ? result : -result
    })
  }, [payload, serverPaged, debouncedTableSearch, sortColumn, sortDirection])

  const tableWindow = useMemo(
    () => normalizeReportTableWindow(payload?.metadata, filteredRows.length, pageSize),
    [filteredRows.length, pageSize, payload?.metadata],
  )
  const safeTotalTableRows = serverPaged ? tableWindow.totalRows : filteredRows.length
  const reachableTableRows = serverPaged ? tableWindow.reachableRows : filteredRows.length
  const pageCount = serverPaged
    ? tableWindow.pageCount
    : Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageRows = serverPaged ? filteredRows : filteredRows.slice((page - 1) * pageSize, page * pageSize)
  const isFavorite = favorites.includes(report.id)
  const payloadColumns = payload?.columns ?? EMPTY_COLUMNS
  const autoGroupColumn = useMemo(
    () => preferredGroupColumn(payloadColumns, viewerProfile, requestFilters),
    [requestFilters, payloadColumns, viewerProfile],
  )
  const activeTableGroupColumn =
    tableGroupMode === NO_GROUP
      ? undefined
      : tableGroupMode === AUTO_GROUP
        ? autoGroupColumn
        : payloadColumns.includes(tableGroupMode)
          ? tableGroupMode
          : undefined
  const subtotalColumns = useMemo(
    () => selectSubtotalColumns(visibleColumns, filteredRows),
    [filteredRows, visibleColumns],
  )
  const groupSummaryTotals = useMemo(() => {
    return chartTotalsByGroup(payload?.chart ?? [], activeTableGroupColumn)
  }, [activeTableGroupColumn, payload?.chart])
  const tableGroups = useMemo(
    () => buildReportTableGroups(filteredRows, activeTableGroupColumn, visibleColumns, subtotalColumns)
      .map((group) => {
        const totals = groupSummaryTotals.get(group.label)
        if (!totals) return group
        return {
          ...group,
          totals: { ...group.totals, ...totals },
          subtotalColumns: [
            ...new Set([
              ...group.subtotalColumns,
              ...Object.keys(totals).filter((column) => visibleColumns.includes(column)),
            ]),
          ],
        }
      }),
    [activeTableGroupColumn, filteredRows, groupSummaryTotals, subtotalColumns, visibleColumns],
  )
  const tableTotals = useMemo(() => {
    if (tableExpanded) return {}
    const preferredMonthly = [
      'ClosingAmount',
      'OpeningAmount',
      'ReceivedAmount',
      'ReturnAdviceAmount',
      'TransferredAmount',
      'AdjustmentAmount',
      'LedgerAmount',
      'IssuedTotalAmount',
      'IssuedStationAmount',
      'IssuedVehicleAmount',
      'GoodsReceiveAmount',
      'GoodsReturnAmount',
      'DispatchAdvAmount',
      'ReturnAmount',
      'OnHandHoldAmount',
      'ClosingQty',
      'OpeningQty',
      'ReceivedQty',
      'ReturnAdviceQty',
      'TransferredQty',
      'AdjustmentQty',
      'LedgerQty',
      'IssuedTotalQty',
      'IssuedStationQty',
      'IssuedVehicleQty',
      'GoodsReceiveQty',
      'GoodsReturnQty',
      'DispatchAdvQty',
      'TotalItem',
    ]
    const preferredMovementTotals = [
      'AmountItem',
      'QtyOnHandHold',
      'QuantityClosing',
      'StockIssueMovementCount',
      'StockIssueMovementQty',
      'StockIssueMovementAmount',
    ]
    const fromVisible = (visibleColumns.length ? visibleColumns : payloadColumns).filter(isSummableMetricField)
    const orderedColumns =
      report.id === 'all-stock-movement-analysis'
        ? [
            ...preferredMovementTotals.filter((column) => subtotalColumns.includes(column) || fromVisible.includes(column)),
            ...subtotalColumns.filter((column) => !preferredMovementTotals.includes(column)),
            ...fromVisible.filter((column) => !preferredMovementTotals.includes(column) && !subtotalColumns.includes(column)),
          ]
        : MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(report.id)
          ? [
              ...preferredMonthly.filter((column) => fromVisible.includes(column) || subtotalColumns.includes(column) || Boolean(payload?.summary?.[column])),
              ...fromVisible.filter((column) => !preferredMonthly.includes(column)),
              ...subtotalColumns.filter((column) => !preferredMonthly.includes(column) && !fromVisible.includes(column)),
            ]
          : [
              ...subtotalColumns,
              ...fromVisible.filter((column) => !subtotalColumns.includes(column)),
            ]
    const keys = orderedColumns.length > 0 ? orderedColumns.slice(0, 10) : fromVisible.slice(0, 10)
    if (keys.length === 0) return {}
    // Prefer row sums only when full filtered set is in memory. Server-paged summary
    // already re-aggregates with SQL scope after filter apply — page rows alone undercount.
    const preferRows = !serverPaged && hasActionableFilters(requestFilters)
    return buildReportSummaryTotals(payload?.summary, filteredRows, keys, {
      fallbackToRows: !serverPaged,
      preferRows,
    })
  }, [filteredRows, payload?.summary, payloadColumns, report.id, requestFilters, serverPaged, subtotalColumns, tableExpanded, visibleColumns])
  const groupedTableActive = Boolean(activeTableGroupColumn && tableGroups.length > 0)
  const shownTableRows = groupedTableActive
    ? tableGroups.reduce((total, group) => total + (collapsedGroups[group.key] ? 0 : group.rows.length), 0)
    : pageRows.length
  const tableRows = useMemo(
    () =>
      buildReportTableRows({
        grouped: groupedTableActive,
        groups: tableGroups,
        pageRows,
        page,
        collapsedGroups,
        expandedRows: expandedMovementRows,
        getRowKey: movementRowKey,
      }),
    [collapsedGroups, expandedMovementRows, groupedTableActive, page, pageRows, tableGroups],
  )
  const reportSchemaColumns = useMemo(() => {
    const reportSchema = payload?.metadata?.reportSchema as { columns?: ReportSchemaColumn[] } | undefined
    return Array.isArray(reportSchema?.columns) ? reportSchema.columns : []
  }, [payload?.metadata?.reportSchema])
  const reportSchemaByField = useMemo(
    () => new Map(reportSchemaColumns.map((column) => [column.field, column])),
    [reportSchemaColumns],
  )
  const metadataDistinctValues = useMemo(() => {
    const value = payload?.metadata?.distinctValues
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  }, [payload?.metadata?.distinctValues])
  const dynamicFilterColumns = useMemo<DynamicFilterColumn[]>(() => {
    const rows = payload?.rows ?? []
    const preferredSource = viewerProfile.manualFilterColumns ?? visibleColumns
    const preferred = preferredSource.filter((column) => payloadColumns.includes(column))
    const rest = payloadColumns.filter((column) => !preferred.includes(column))
    const cache = uniqueValuesCache.current
    return [...preferred, ...rest].map((field) => {
      const schema = reportSchemaByField.get(field)
      const type = inferManualColumnType(field, reportSchemaColumns, rows)
      const metadataOptions = metadataDistinctValues[field]
      const options = type === 'string' || type === 'boolean'
        ? (Array.isArray(metadataOptions) ? metadataOptions.map(String).slice(0, 80) : uniqueValues(rows, field, cache).slice(0, 80))
        : []
      return {
        field,
        label: schema?.label ?? displayColumnLabel(field),
        type,
        options,
      }
    })
  }, [metadataDistinctValues, payload?.rows, payloadColumns, reportSchemaByField, reportSchemaColumns, viewerProfile.manualFilterColumns, visibleColumns])
  const isMonthlyStockMovement = MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(report.id)
  const movementCategoryAvailable = useMemo(
    () =>
      payloadColumns.includes('MovementCategory') ||
      Boolean(payload?.analytics?.semanticDimensions?.includes('movement-category')) ||
      MOVEMENT_ANALYSIS_REPORT_IDS.has(report.id),
    [payload?.analytics?.semanticDimensions, payloadColumns, report.id],
  )
  const groupByColumns = useMemo<DynamicFilterColumn[]>(() => {
    let cols = dynamicFilterColumns
    if (movementCategoryAvailable && !cols.some((column) => column.field === 'MovementCategory')) {
      cols = [
        {
          field: 'MovementCategory',
          label: 'Movement Category',
          type: 'string',
          options: ['Fast Moving', 'Moving', 'Slow Moving', 'Dead Stock', 'Stale'],
        },
        ...cols,
      ]
    }
    // Stock Analysis Code removed from monthly path — never inject SA filter column.
    return cols.filter((column) => column.field !== 'StockAnalysisCode' && column.field !== 'StockAnalysisName')
  }, [dynamicFilterColumns, movementCategoryAvailable])
  const selectedFilterColumn = dynamicFilterColumns.find((column) => column.field === columnFilterDraft.field)
  const manualColumnOperators = operatorsForManualType(selectedFilterColumn?.type ?? 'string')
  const aggregatableColumns = reportSchemaColumns
    .filter((column) => column.aggregatable)
    .map((column) => column.field)
  const activeFilterChips = (() => {
    const chips: Array<{ key: keyof ReportFilterInput | 'safety'; label: string; columnFilterIndex?: number; locked?: boolean }> = []

    Object.entries(requestFilters).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return
      if (key === 'naturalQuery') return
      // Stock Analysis Code removed from monthly path — never surface SA chips.
      if (key === 'stockAnalysis' || key === 'category') return
      if (key === 'columnFilters' && Array.isArray(value)) {
        value.forEach((item, index) => {
          const filter = item as ReportColumnFilter
          chips.push({
            key: 'columnFilters',
            columnFilterIndex: index,
            label: `${displayColumnLabel(filter.field ?? '')} ${filter.operator}${filter.value !== undefined ? ` ${filter.value}` : ''}${filter.valueTo !== undefined ? ` - ${filter.valueTo}` : ''}`,
          })
        })
        return
      }
      chips.push({ key: key as keyof ReportFilterInput, label: formatFilterChip(key, value) })
    })

    return chips
  })()
  const removableFilterChips = activeFilterChips.filter((chip) => !chip.locked)
  const metadataEntries = useMemo(
    () =>
      Object.entries(payload?.metadata ?? {})
        .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
        .slice(0, 8),
    [payload],
  )
  const debugSql = useMemo<DebugSqlMetadata | null>(() => {
    const value = payload?.metadata?.debugSql
    if (!value || typeof value !== 'object') return null
    const candidate = value as Partial<DebugSqlMetadata>
    return Array.isArray(candidate.statements) ? (candidate as DebugSqlMetadata) : null
  }, [payload?.metadata?.debugSql])
  const debugSqlStatements = debugSql?.statements ?? []
  const activeRequestFilterCount = useMemo(
    () => Object.values(requestFilters).filter((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value))).length,
    [requestFilters],
  )
  const focusedDebugSqlStatement = debugSqlStatements.find((statement) => statement.id === debugSqlFocus || statement.label === debugSqlFocus)
    ?? debugSqlStatements.find((statement) => statement.label === 'summary')
    ?? debugSqlStatements[0]
  const debugSqlCopyText = (statement?: DebugSqlStatement) => {
    if (!statement?.sql) return ''
    return [
      `-- Report Center SQL Debug: ${report.title}`,
      `-- Source: ${sourceLabel(selectedSource)} | Server: ${statement.server ?? debugSql?.target?.server ?? '-'} | Database: ${statement.database ?? debugSql?.target?.database ?? '-'}`,
      `-- Statement: ${statement.label ?? 'query'} | Rows returned: ${statement.rows ?? '-'}`,
      statement.sql,
    ].join('\n')
  }
  const activeFilterParameterEntries = useMemo(() => {
    const params = buildReportParams(report, selectedSource, TABLE_FIRST_LIMIT, requestFilters, {
      page,
      pageSize,
      tableSortColumn: serverSort?.column,
      tableSortDirection: serverSort?.direction,
    })
    return [...params.entries()]
      .filter(([key]) => !['limit'].includes(key))
      .map(([key, value]) => ({ key, value }))
  }, [page, pageSize, report, requestFilters, selectedSource, serverSort])

  useEffect(() => {
    setCollapsedGroups({})
    setExpandedMovementRows({})
    setPage(1)
  }, [activeTableGroupColumn])

  useEffect(() => {
    setExpandedMovementRows({})
  }, [payload])

  function formatFilterChip(key: string, value: unknown) {
    if (key === 'stale') {
      const preset = viewerProfile.presets.find((item) => item.filters.stale === value)
      return `Update aging: ${preset?.label ?? String(value)}`
    }
    if (key === 'productType') return `Product Type: ${String(value)}`
    if (key === 'productCategory') return `Product Category: ${String(value)}`
    if (key === 'productBrand') return `Product Brand: ${String(value)}`
    if (key === 'productModel') return `Product Model: ${String(value)}`
    if (key === 'productMaterial') return `Product Material: ${String(value)}`
    if (key === 'stockAnalysis' || key === 'category') return `Legacy filter ignored: ${key}`
    if (key === 'groupBy') {
      const group = String(value) === 'StockAnalysisCode' || String(value) === 'StockAnalysisName'
        ? 'ProductTypeCode'
        : String(value)
      return `Group: ${displayColumnLabel(group)}`
    }
    if (key === 'chartDimension') return `Chart: ${displayColumnLabel(String(value))}`
    if (key === 'movementCategory') return `Movement Category: ${String(value)}`
    if (key === 'movementWindow') return `Movement Window: ${String(value)}`
    if (key === 'movementFastMin') return `Fast >= ${String(value)} issue`
    if (key === 'movementMovingMin') return `Moving min: ${String(value)}`
    if (key === 'movementMovingMax') return `Moving max: ${String(value)}`
    if (key === 'movementSlowCount') return `Slow = ${String(value)} issue`
    if (key === 'period') return `Period: ${String(value)}`
    if (key === 'location') return `Location: ${String(value)}`
    if (key === 'itemType') return `Item Type: ${String(value)}`
    if (key === 'columnFilters' && Array.isArray(value)) {
      return value
        .map((item) => {
          const filter = item as ReportColumnFilter
          return `${displayColumnLabel(filter.field ?? '')} ${filter.operator}${filter.value !== undefined ? ` ${filter.value}` : ''}${filter.valueTo !== undefined ? ` - ${filter.valueTo}` : ''}`
        })
        .join(', ')
    }
    return `${key}: ${String(value)}`
  }

  const sortBy = (column: string) => {
    setPage(1)
    if (sortColumn === column) {
      const nextDirection = sortDirection === 'asc' ? 'desc' : 'asc'
      setSortDirection(nextDirection)
      setServerSort({ column, direction: nextDirection })
    } else {
      setSortColumn(column)
      setSortDirection('asc')
      setServerSort({ column, direction: 'asc' })
    }
  }

  const toggleColumn = (column: string) => {
    setVisibleColumns((current) =>
      current.includes(column) ? current.filter((item) => item !== column) : [...current, column],
    )
  }

  const toggleGroup = (groupKey: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupKey]: !current[groupKey],
    }))
  }

  const toggleMovementRow = (rowKey: string) => {
    setExpandedMovementRows((current) => (current[rowKey] ? {} : { [rowKey]: true }))
  }

  const toggleReportRow = (event: { preventDefault: () => void; stopPropagation: () => void }, rowKey: string) => {
    event.preventDefault()
    event.stopPropagation()
    toggleMovementRow(rowKey)
  }

  const setAllGroupsCollapsed = (collapsed: boolean) => {
    setCollapsedGroups(
      tableGroups.reduce<Record<string, boolean>>((next, group) => {
        next[group.key] = collapsed
        return next
      }, {}),
    )
  }

  const updateManualFilter = (key: keyof ReportFilterInput, value: string) => {
    if (key === 'groupBy' || key === 'chartDimension') {
      const group = value || undefined
      setManualFilters((current) => normalizeViewerReportFilters(report.id, {
        ...current,
        groupBy: group,
        chartDimension: group,
      }))
      return
    }

    if (key === 'itemType') {
      setManualFilters((current) => ({
        ...current,
        itemType: value || undefined,
        includeWorkshopItem: value === 'gudang' ? 'no' : value === 'workshop' ? 'yes' : undefined,
      }) as ReportFilterInput)
      return
    }

    setManualFilters((current) => ({
      ...current,
      [key]: value || undefined,
    }) as ReportFilterInput)
  }

  const updateManualNumber = (key: keyof ReportFilterInput, value: string) => {
    setManualFilters((current) => ({
      ...current,
      [key]: value ? Number(value) : undefined,
    }) as ReportFilterInput)
  }

  const updateActualPeriod = (value: string) => {
    // Actual month picker owns period; wipe Acc* so API cannot keep stale accounting scope.
    setManualFilters((current) => ({
      ...current,
      period: value || undefined,
      accYear: undefined,
      accMonth: undefined,
      actualYear: undefined,
      actualMonth: undefined,
    }))
  }

  const updateAccountingPeriod = (key: 'accYear' | 'accMonth', value: string) => {
    // Acc fields own scope; wipe actual period so they do not fight.
    setManualFilters((current) => ({
      ...current,
      period: undefined,
      actualYear: undefined,
      actualMonth: undefined,
      [key]: value ? Number(value) : undefined,
    }))
  }

  const updateColumnFilterDraft = (key: keyof ReportColumnFilter, value: string) => {
    if (key === 'field') {
      const nextColumn = dynamicFilterColumns.find((column) => column.field === value)
      setColumnFilterDraft({
        field: value || undefined,
        operator: nextColumn ? defaultOperatorForManualType(nextColumn.type, nextColumn.options.length > 0) : 'contains',
      })
      return
    }

    setColumnFilterDraft((current) => ({
      ...current,
      [key]: value || undefined,
    }))
  }

  const addColumnFilter = () => {
    if (!columnFilterDraft.field || !columnFilterDraft.operator) return
    const column = dynamicFilterColumns.find((item) => item.field === columnFilterDraft.field)
    const operator = columnFilterDraft.operator
    const nextFilter: ReportColumnFilter = {
      field: columnFilterDraft.field,
      operator,
      value: operator === 'blank' || operator === 'notBlank' ? undefined : coerceManualFilterValue(String(columnFilterDraft.value ?? ''), column?.type ?? 'string'),
      valueTo: operator === 'between' ? coerceManualFilterValue(String(columnFilterDraft.valueTo ?? ''), column?.type ?? 'string') : undefined,
    }

    setManualFilters((current) => ({
      ...current,
      columnFilters: [...(current.columnFilters ?? []), nextFilter].slice(0, 5),
    }))
    setColumnFilterDraft({ operator: 'contains' })
  }

  const removeColumnFilter = (index: number) => {
    setManualFilters((current) => ({
      ...current,
      columnFilters: (current.columnFilters ?? []).filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const commitReportFilters = (nextFilters: ReportFilterInput, message: string | null, mode: 'push' | 'replace' = 'push') => {
    const normalizedFilters = normalizeViewerReportFilters(report.id, nextFilters)
    setPage(1)
    setManualFilters(normalizedFilters)
    setAppliedFilters(normalizedFilters)
    setFilterWarning(null)
    setFilterError(null)
    setFilterMessage(message)
    syncViewerUrl(normalizedFilters, mode)
  }

  const applyManualFilters = () => {
    commitReportFilters(manualFilters, 'Filter manual diterapkan ke payload read-only.')
  }

  const resetFilters = () => {
    setColumnFilterDraft({ operator: 'contains' })
    setNaturalQuery('')
    setTableSearch('')
    setRemoteTableSearch('')
    commitReportFilters({}, null)
  }

  const removeFilterChip = (chip: { key: string; columnFilterIndex?: number; locked?: boolean }) => {
    if (chip.locked || chip.key === 'safety') return
    const removeFrom = (current: ReportFilterInput): ReportFilterInput => {
      if (chip.key === 'columnFilters') {
        return {
          ...current,
          columnFilters: (current.columnFilters ?? []).filter((_, index) => index !== chip.columnFilterIndex),
        }
      }
      const next = { ...current }
      const key = chip.key as keyof ReportFilterInput
      delete next[key]
      // Keep stockAnalysis + category in sync when either master SA chip is cleared.
      if (key === 'stockAnalysis' || key === 'category') {
        delete next.stockAnalysis
        delete next.category
      }
      return next
    }
    const nextFilters = removeFrom(appliedFilters)
    commitReportFilters(nextFilters, 'Filter chip dihapus.')
  }

  const applyKpiFilter = (label: string) => {
    const presetLabel = viewerProfile.kpiPresetByLabel?.[label]
    const preset = viewerProfile.presets.find((item) => item.label === presetLabel)
    if (preset) applyReportPreset(preset)
  }

  const applyReportPreset = (preset: ReportPreset) => {
    const nextFilters = preset.filters
    if (nextFilters.sortColumn) setSortColumn(nextFilters.sortColumn)
    if (nextFilters.sortDirection) setSortDirection(nextFilters.sortDirection)
    commitReportFilters(nextFilters, `Preset "${preset.label}" diterapkan sebagai filter read-only.`)
  }

  const applyReportFilterAction = (action: ReportFilterAction, label?: string) => {
    const nextFilters = mergeReportFilterAction(appliedFilters, action)
    if (action.type === 'set-group') setTableGroupMode(AUTO_GROUP)
    if (action.type === 'clear-filter') {
      setColumnFilterDraft({ operator: 'contains' })
      setNaturalQuery('')
      setTableSearch('')
      setRemoteTableSearch('')
    }
    commitReportFilters(nextFilters, `${label ?? action.label ?? 'Scope'} diterapkan ke KPI, tabel, export, dan AI evidence.`)
  }

  const applyMonthlyAnalysisGroup = (groupBy: string) => {
    setTableGroupMode(AUTO_GROUP)
    commitReportFilters({
      ...appliedFilters,
      groupBy,
      chartDimension: groupBy,
    }, `Analysis group ${displayColumnLabel(groupBy)} diterapkan ke KPI, tabel, export, dan AI evidence.`)
  }

  const applyMonthlyMovementWindow = (movementWindow: string) => {
    commitReportFilters({
      ...appliedFilters,
      movementWindow,
      dateFrom: movementWindow === 'custom' ? appliedFilters.dateFrom : undefined,
      dateTo: movementWindow === 'custom' ? appliedFilters.dateTo : undefined,
    }, `Movement period ${movementWindow} diterapkan ke actual MovementCategory.`)
  }

  const applyMonthlyItemType = (itemType: 'inventory' | 'gudang' | 'workshop') => {
    commitReportFilters({
      ...appliedFilters,
      itemType: itemType === 'inventory' ? undefined : itemType,
      includeWorkshopItem: itemType === 'gudang' ? 'no' : itemType === 'workshop' ? 'yes' : undefined,
    }, itemType === 'inventory'
      ? 'Item type: Gudang + Workshop (1+4).'
      : itemType === 'gudang'
        ? 'Item type: Gudang only (1).'
        : 'Item type: Workshop only (4).')
  }

  const applySubKpiCardFilter = (kpi: ReportKpiCard) => {
    if (!kpi.groupField || !kpi.groupKey) return
    const filterKey = filterKeyForGroupField(kpi.groupField)
    const nextFilters: ReportFilterInput = {
      ...appliedFilters,
      groupBy: kpi.groupField,
      chartDimension: kpi.groupField,
    }
    if (filterKey) {
      let filterValue = kpi.groupKey
      // ItemType KPI may show "Stock / Gudang" label — map to SQL scope code.
      if (filterKey === 'itemType') {
        const raw = String(kpi.groupKey).trim().toLowerCase()
        if (raw === '1' || raw.includes('gudang') || raw.includes('stock')) {
          filterValue = 'gudang'
          nextFilters.includeWorkshopItem = 'no'
        } else if (raw === '4' || raw.includes('workshop') || raw.includes('mesin')) {
          filterValue = 'workshop'
          nextFilters.includeWorkshopItem = 'yes'
        } else {
          filterValue = String(kpi.groupKey)
        }
      }
      ;(nextFilters as Record<string, unknown>)[filterKey] = filterValue
      if (filterKey === 'stockAnalysis') nextFilters.category = filterValue
      // Location/Gudang scope: drop competing group filters so valuation SQL stays on LocCode only.
      if (filterKey === 'location') {
        delete nextFilters.productType
        delete nextFilters.productCategory
        delete nextFilters.productBrand
        delete nextFilters.productModel
        delete nextFilters.productMaterial
        delete nextFilters.movementCategory
        delete nextFilters.stockAnalysis
        delete nextFilters.category
      }
    }
    if (kpi.groupField === 'MovementCategory') {
      nextFilters.movementWindow = appliedFilters.movementWindow ?? 'all'
    }
    setTableGroupMode(AUTO_GROUP)
    commitReportFilters(nextFilters, `${displayColumnLabel(kpi.groupField)} ${kpi.groupKey} diterapkan dari card KPI.`)
  }

  const applyNaturalFilter = async () => {
    const query = naturalQuery.trim()
    if (!query) return
    setNaturalLoading(true)
    setFilterError(null)
    setFilterWarning(null)
    setFilterMessage(null)
    try {
      const response = await fetch('/api/reports/natural-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          reportId: report.id,
          columns: payload?.columns ?? [],
        }),
      })
      const result = (await response.json()) as NaturalFilterResponse
      if (!response.ok || !result.success || !result.filters) {
        throw new Error(result.error ?? 'Natural filter gagal diproses.')
      }
      if (!hasActionableFilters(result.filters)) {
        throw new Error('Natural filter tidak menghasilkan filter yang bisa diterapkan.')
      }
      commitReportFilters(result.filters, `${result.explanation ?? 'Natural filter diterapkan.'} Provider: ${result.provider ?? 'local-rule'}.`)
      setFilterWarning(result.warning ?? null)
    } catch (err) {
      setFilterWarning(null)
      setFilterError(err instanceof Error ? err.message : 'Natural filter gagal diproses.')
    } finally {
      setNaturalLoading(false)
    }
  }

  const kpiCards = useMemo(() => {
    if (!payload) return [] as ReportKpiCard[]
    // User analysis-group pick wins over table auto-group so Product Type sub-KPI
    // never silently becomes MovementCategory from preferredGroupColumn fallback.
    const rawGroup =
      requestFilters.groupBy ||
      requestFilters.chartDimension ||
      activeTableGroupColumn ||
      (MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(report.id) ? 'ProductTypeCode' : undefined)
    const groupForKpi =
      rawGroup === 'StockAnalysisCode' || rawGroup === 'StockAnalysisName'
        ? 'ProductTypeCode'
        : rawGroup
    const period = resolveKpiSqlPeriod(payload, requestFilters)
    return viewerProfile.kpiBuilder(payload, {
      ...requestFilters,
      groupBy: groupForKpi,
      chartDimension: groupForKpi,
    }).map((card) => attachSimpleSql(card, period))
  }, [activeTableGroupColumn, payload, report.id, requestFilters, viewerProfile])
  const activeKpiGroupField = useMemo(
    () =>
      String(
        requestFilters.groupBy ??
          requestFilters.chartDimension ??
          activeTableGroupColumn ??
          payload?.metadata?.analysisGroup ??
          '',
      ).trim() || undefined,
    [activeTableGroupColumn, payload?.metadata?.analysisGroup, requestFilters.chartDimension, requestFilters.groupBy],
  )
  const flowKpiCards = useMemo(
    () => kpiCards.filter((card) => card.scope === 'flow'),
    [kpiCards],
  )
  const globalKpiCards = useMemo(
    () => kpiCards.filter((card) => card.scope === 'global' || (!card.scope && !card.groupKey)),
    [kpiCards],
  )
  // Fixed ItemType split of grand total — never mixed into dynamic sub-category rail.
  const breakdownKpiCards = useMemo(
    () => kpiCards.filter((card) => card.scope === 'breakdown' && Boolean(card.groupKey)),
    [kpiCards],
  )
  // Analysis-group sub only — never Movement Category (own rail below).
  const subKpiCards = useMemo(
    () =>
      kpiCards.filter(
        (card) =>
          card.scope === 'sub' &&
          Boolean(card.groupKey) &&
          !groupFieldsMatch(card.groupField, 'ItemType') &&
          !groupFieldsMatch(card.groupField, 'MovementCategory') &&
          (!activeKpiGroupField ||
            groupFieldsMatch(activeKpiGroupField, 'ItemType') ||
            groupFieldsMatch(activeKpiGroupField, card.groupField)),
      ),
    [activeKpiGroupField, kpiCards],
  )
  // Own section: always-on Movement Category (scope=movement), not sub-category KPI.
  const movementCategoryKpiCards = useMemo(
    () =>
      kpiCards.filter(
        (card) =>
          card.scope === 'movement' &&
          Boolean(card.groupKey) &&
          groupFieldsMatch(card.groupField, 'MovementCategory'),
      ),
    [kpiCards],
  )
  const activeMonthlyAnalysisGroup = String(
    requestFilters.groupBy ??
    requestFilters.chartDimension ??
    activeTableGroupColumn ??
    payload?.metadata?.analysisGroup ??
    'ProductTypeCode',
  )
  const resolvedMonthlyAnalysisGroup =
    activeMonthlyAnalysisGroup === 'StockAnalysisCode' || activeMonthlyAnalysisGroup === 'StockAnalysisName'
      ? 'ProductTypeCode'
      : activeMonthlyAnalysisGroup
  const activeMonthlyMovementWindow = String(
    requestFilters.movementWindow ??
    payload?.metadata?.movementWindow ??
    'all',
  )
  const stickyGrandTotals = useMemo(() => {
    if (!payload) return [] as Array<{ key: string; label: string; value: unknown }>
    // Prefer official RPTIN flow totals (Opening / Issued total / Closing …).
    const fromFlow = flowKpiCards.map((card) => ({
      key: `flow:${card.flowSection ?? card.label}`,
      label: card.label,
      value: card.value,
    }))
    if (fromFlow.length > 0) return fromFlow
    const preferredKeys = [
      'ClosingAmount',
      'OpeningAmount',
      'IssuedTotalAmount',
      'GoodsReceiveAmount',
      'LedgerAmount',
      'IssuedStationAmount',
      'IssuedVehicleAmount',
    ]
    const fromTablePreferred = preferredKeys
      .filter((key) => tableTotals[key] !== undefined)
      .map((key) => ({ key, label: displayColumnLabel(key), value: tableTotals[key] }))
    if (fromTablePreferred.length > 0) return fromTablePreferred
    const fromTable = Object.entries(tableTotals).map(([key, value]) => ({
      key,
      label: displayColumnLabel(key),
      value,
    }))
    if (fromTable.length > 0) return fromTable.slice(0, 10)
    return kpiCards
      .filter((card) => card.scope === 'global' && (card.description?.includes('Global') || /Amount|Qty|Total|Item/i.test(card.label)))
      .slice(0, 10)
      .map((card) => ({ key: card.label, label: card.label, value: card.value }))
  }, [flowKpiCards, kpiCards, payload, tableTotals])
  const tableContextItems = (viewerProfile.tableContextColumns ?? [])
    .map((column) => [displayColumnLabel(column), payloadContextValue(payload, column)] as [string, unknown])
    .filter(([, value]) => value !== null && value !== undefined && value !== '')

  const toggleReportInfo = () => {
    const nextVisible = !reportInfoVisible
    setReportInfoVisible(nextVisible)
    setReportInfoManuallyOpened(nextVisible)
  }

  const jumpToAnalysis = (tab: InsightTab) => {
    if (tab === 'sql') {
      setWorkspaceTab('audit')
      setInsightTab('sql')
      setReportInfoVisible(true)
      setReportInfoManuallyOpened(true)
      return
    }
    setWorkspaceTab('analisis')
    if (tab === 'ai') {
      setAiInsightVisible(true)
      setInsightTab('ai')
      return
    }
    setInsightTab(tab)
    setReportInfoVisible(true)
    setReportInfoManuallyOpened(true)
  }

  const showKpiSqlDebug = (kpi?: Pick<ReportKpiCard, 'label' | 'simpleSql' | 'flowSection' | 'groupField' | 'groupKey' | 'sourceTable' | 'sourceField' | 'scope'>) => {
    if (kpi) {
      const period = resolveKpiSqlPeriod(payload, requestFilters)
      const sql =
        kpi.simpleSql ||
        simpleSqlForKpi({
          label: kpi.label,
          flowSection: kpi.flowSection,
          groupField: kpi.groupField,
          groupKey: kpi.groupKey,
          sourceTable: kpi.sourceTable,
          sourceField: kpi.sourceField,
          scope: kpi.scope,
          period,
        })
      // Modal always on — paste-ready SQL Server script for SSMS.
      setKpiSimpleSqlView({ label: kpi.label, sql })
      return
    }
    setKpiSimpleSqlView(null)
    setDebugSqlFocus('summary')
    if (tableExpanded) setTableExpanded(false)
    jumpToAnalysis('sql')
  }

  const openKpiSqlDebug = (
    event: { preventDefault: () => void; stopPropagation: () => void },
    kpi?: Pick<ReportKpiCard, 'label' | 'simpleSql' | 'flowSection' | 'groupField' | 'groupKey' | 'sourceTable' | 'sourceField' | 'scope'>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    showKpiSqlDebug(kpi)
  }

  const askAiQuestion = (question: string) => {
    setAiQuestionRequest({ id: Date.now(), question })
    jumpToAnalysis('ai')
  }

  const hideAiInsight = () => {
    setAiInsightVisible(false)
    if (insightTab === 'ai') setInsightTab('charts')
  }

  const enterFullTable = () => {
    setWorkspaceTab('detail')
    setTableDensity('compact')
    setPageSize((current) => Math.max(current, 200))
    setTableExpanded(true)
  }

  const aiSections = [
    {
      label: 'Executive Summary',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'generating' : 'waiting',
      content: aiDashboard?.summary.mainFinding ?? (payload ? `${formatValue(filteredRows.length)} row siap dibaca. AI analysis berjalan non-blocking setelah table.` : 'Menunggu payload report.'),
    },
    {
      label: 'Key Findings',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'generating' : 'waiting',
      content: aiDashboard?.summary.recommendedFocus ?? 'Trend akan muncul setelah summary AI selesai.',
    },
    {
      label: 'Trend / Pattern',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.insights?.[0]?.finding ?? 'Pattern akan ditampilkan dari insight dan chart payload.',
    },
    {
      label: 'Risk / Anomaly',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.summary.businessRisk ?? 'Risk dan anomaly tidak memblokir table.',
    },
    {
      label: 'Data Quality',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.missingFields?.[0]?.reason ?? 'Indikator quality tersedia di tab Quality.',
    },
    {
      label: 'Recommendation',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: aiDashboard?.recommendedActions?.[0]?.action ?? 'Rekomendasi menyusul setelah AI selesai membaca summary, chart, dan sample rows.',
    },
    {
      label: 'Suggested Next Filters',
      status: aiDashboard ? 'ready' : aiDashboardLoading ? 'waiting' : 'waiting',
      content: viewerProfile.presets.length > 0 ? viewerProfile.presets.slice(0, 3).map((preset) => preset.label).join(', ') : 'Gunakan natural filter atau manual filter untuk drilldown lanjutan.',
    },
  ]

  const deferAnalysis = !tableReady || !analysisReady
  const qualityItems = useMemo(
    () => (deferAnalysis ? [] : viewerProfile.qualityBuilder(payload, filteredRows)),
    [deferAnalysis, filteredRows, payload, viewerProfile],
  )
  const aiDashboardReport = useMemo(
    () => ({
      code: report.code,
      name: report.title,
      description: report.description,
    }),
    [report.code, report.description, report.title],
  )
  const aiDashboardFilters = useMemo<DbRow>(
    () => ({
      ...requestFilters,
      source: selectedSource,
      reportId: report.id,
      apiReport: report.apiReport,
    }),
    [requestFilters, report.apiReport, report.id, selectedSource],
  )
  const aiChartPreview = aiDashboard?.charts?.[0] ?? null
  const aiChartTypes = [...new Set((aiDashboard?.charts ?? []).map((chart) => chart.type.replace('_', ' ')))]
  const generatedAtValue = String(
    payload?.metadata?.queryTiming && typeof payload.metadata.queryTiming === 'object'
      ? (payload.metadata.queryTiming as { generatedAt?: unknown }).generatedAt ?? ''
      : payload?.metadata?.generatedAt ?? '',
  )
  const activePeriodLabels = useMemo(
    () => resolveActivePeriodLabels(payload, requestFilters),
    [payload, requestFilters],
  )
  const reportStateCards = useMemo(() => [
    {
      label: 'Loaded rows',
      value: loading ? 'Loading' : formatValue(filteredRows.length),
      detail: serverPaged && tableWindow.windowed ? `${formatValue(safeTotalTableRows)} server rows` : 'Current evidence window',
      tone: 'border-lime-300/25 bg-lime-300/10 text-lime-50',
    },
    {
      label: 'Period state',
      value: activePeriodLabels.actual ?? 'Current',
      detail: activePeriodLabels.accounting ? `Acc ${activePeriodLabels.accounting}` : 'Accounting auto',
      tone: 'border-amber-300/25 bg-amber-300/10 text-amber-50',
    },
    {
      label: 'Analysis group',
      value: displayColumnLabel(resolvedMonthlyAnalysisGroup || activeTableGroupColumn || 'Report'),
      detail: `${subKpiCards.length} groups · ${movementCategoryKpiCards.length} movement`,
      tone: 'border-sky-300/25 bg-sky-300/10 text-sky-50',
    },
    {
      label: 'Trust state',
      value: debugSqlStatements.length > 0 ? 'Auditable' : 'Read-only',
      detail: aiInsightVisible ? 'AI secondary visible' : 'AI secondary hidden',
      tone: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-50',
    },
  ], [activePeriodLabels.accounting, activePeriodLabels.actual, activeTableGroupColumn, aiInsightVisible, debugSqlStatements.length, filteredRows.length, loading, movementCategoryKpiCards.length, resolvedMonthlyAnalysisGroup, safeTotalTableRows, serverPaged, subKpiCards.length, tableWindow.windowed])

  const insightTabLabels: Record<InsightTab, string> = {
    ai: 'AI Insight (sampel)',
    charts: 'Charts',
    quality: 'Quality',
    metadata: 'Metadata',
    recommendations: 'Recommendations',
    sql: 'SQL (audit)',
  }
  // Analisis/Audit tabs always surface the analysis workspace; Ringkasan stays calm.
  const analysisPanelVisible =
    reportInfoVisible ||
    aiInsightVisible ||
    workspaceTab === 'analisis' ||
    workspaceTab === 'audit'

  useEffect(() => {
    if (workspaceTab === 'audit') {
      setReportInfoVisible(true)
      setReportInfoManuallyOpened(true)
      setInsightTab('sql')
    } else if (workspaceTab === 'analisis') {
      setInsightTab((tab) => (tab === 'sql' ? 'charts' : tab))
    }
  }, [workspaceTab])

  const effectiveTableDensity = tableExpanded ? 'compact' : tableDensity
  // Compact table: tight padding so more cols fit without horizontal scroll.
  const headerPadding = tableExpanded
    ? 'px-1.5 py-1'
    : effectiveTableDensity === 'compact'
      ? 'px-2 py-1.5'
      : 'px-2.5 py-2'
  const cellPadding = tableExpanded
    ? 'px-1.5 py-1'
    : effectiveTableDensity === 'compact'
      ? 'px-2 py-1.5'
      : 'px-2.5 py-2'

  const isCodeColumn = (column: string) => ['KodeBarang', 'item_code', 'ItemCode'].includes(column)
  const isNameColumn = (column: string) => ['NamaBarang', 'description', 'ItemDescription'].includes(column)
  const isPinnedColumn = (column: string) => isCodeColumn(column) || isNameColumn(column)
  const isCategoryColumn = (column: string) => (
    /^(MovementCategory|ProductType|ProductCategory|ItemType|Location|Gudang|Category|Kategori)$/i.test(column)
    || /category|type|status|bucket|risk/i.test(column)
  )
  const isNumericColumn = (column: string) => (
    /(amount|nilai|qty|quantity|count|jumlah|total|stock|stok|gap|cost|harga|umur|age|rows|item|issue|event)$/i.test(column) &&
    !isNameColumn(column) &&
    !isCodeColumn(column) &&
    !isCategoryColumn(column)
  )
  const stickyLeftForColumn = (column: string) => {
    if (isCodeColumn(column)) return 0
    if (isNameColumn(column)) return visibleColumns.some(isCodeColumn) ? 96 : 0
    return undefined
  }
  const stickyCellStyle = (column: string) => {
    const left = stickyLeftForColumn(column)
    return left === undefined ? undefined : { left }
  }
  const stickyColumnClass = (column: string, header = false) => {
    if (!isPinnedColumn(column)) return ''
    const depth = header ? 'z-40' : 'z-20'
    const shadow = isNameColumn(column) ? 'shadow-[6px_0_10px_-10px_rgba(15,23,42,0.5)]' : ''
    return `sticky ${depth} ${shadow}`
  }
  const columnWidthClass = (column: string) => {
    if (isCodeColumn(column)) return 'w-[96px] min-w-[88px] max-w-[110px] whitespace-nowrap'
    if (isNameColumn(column)) {
      return 'w-[200px] min-w-[160px] max-w-[240px] whitespace-normal break-words leading-[1.25]'
    }
    if (isCategoryColumn(column)) return 'w-[108px] min-w-[96px] max-w-[132px] whitespace-normal break-words leading-tight'
    if (isNumericColumn(column)) return 'w-[92px] min-w-[80px] max-w-[120px] whitespace-nowrap text-right tabular-nums'
    return 'w-[112px] min-w-[96px] max-w-[148px] whitespace-normal break-words leading-tight'
  }
  const headerWidthClass = (column: string) => {
    if (isCodeColumn(column)) return 'w-[96px] min-w-[88px] max-w-[110px]'
    if (isNameColumn(column)) return 'w-[200px] min-w-[160px] max-w-[240px]'
    if (isCategoryColumn(column)) return 'w-[108px] min-w-[96px] max-w-[132px]'
    if (isNumericColumn(column)) return 'w-[92px] min-w-[80px] max-w-[120px]'
    return 'w-[112px] min-w-[96px] max-w-[148px]'
  }
  const cellContentClass = (column: string) => {
    if (isNameColumn(column)) return effectiveTableDensity === 'compact' ? 'line-clamp-2' : 'line-clamp-3'
    if (isCategoryColumn(column)) return 'line-clamp-2'
    if (/analysis|event|relation|remarks|description/i.test(column)) return 'line-clamp-2'
    return ''
  }
  const headerCellClass = (column: string) => {
    return `${headerWidthClass(column)} ${stickyColumnClass(column, true)} whitespace-normal break-words border-b border-r border-amber-400/20 bg-[#0b1018] ${headerPadding} align-bottom leading-tight font-black text-amber-100 shadow-[inset_0_-1px_0_rgba(245,158,11,0.28)]`
  }

  const bodyCellClass = (column: string, columnIndex: number, subtotal = false, selected = false, zebraAlt = false) => {
    const bg = subtotal
      ? 'bg-amber-500/15'
      : selected
        ? 'bg-amber-500/10 group-hover:bg-amber-500/20'
        : zebraAlt
          ? 'bg-[#111827] group-hover:bg-[#172033]'
          : 'bg-[#0f172a] group-hover:bg-[#172033]'
    const text = subtotal
      ? 'text-sm font-bold text-amber-50'
      : columnIndex === 0 || isCodeColumn(column)
        ? 'font-bold text-amber-100'
        : 'text-slate-300'
    return `${columnWidthClass(column)} ${stickyColumnClass(column)} ${bg} border-b border-r border-white/10 ${cellPadding} align-top leading-snug ${text}`
  }
  const displayTableTotalRows = serverPaged && tableWindow.windowed ? reachableTableRows : safeTotalTableRows
  const estimateTableRowSize = useCallback((index: number) => {
    const row = tableRows[index]
    // Compact estimates: expanded dropdown detail stays readable, base rows stay short.
    if (row?.type === 'detail') return tableExpanded ? 120 : 148
    if (row?.type === 'group-header') return tableExpanded ? 36 : 44
    if (row?.type === 'group-subtotal') return tableExpanded ? 28 : 34
    if (tableExpanded) return 28
    return effectiveTableDensity === 'compact' ? 34 : 42
  }, [effectiveTableDensity, tableExpanded, tableRows])
  const tableRowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: estimateTableRowSize,
    getItemKey: (index) => tableRows[index]?.key ?? index,
    overscan: tableExpanded ? 18 : 12,
  })
  const virtualRows = tableRowVirtualizer.getVirtualItems()
  const virtualPaddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0
  const virtualPaddingBottom = virtualRows.length > 0
    ? Math.max(0, tableRowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end)
    : 0

  return (
    <main className="min-h-full bg-[#0F2B1A]">
      <div className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        {/* Report identity banner — always above KPI rail */}
        <header className="rc-report-banner relative mb-4 overflow-hidden rounded-[28px] border border-[color:var(--rc-forest-border)] text-white shadow-[0_32px_90px_rgba(0,0,0,0.38)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_12%_0%,rgba(190,242,100,0.22),transparent_42%),radial-gradient(ellipse_at_88%_8%,rgba(52,211,153,0.18),transparent_40%),linear-gradient(135deg,#0a2416_0%,#071426_48%,#0c1a12_100%)]" />
          <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full bg-lime-300/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative p-5 sm:p-6 lg:p-7">
            {/* Hallmark · pre-emit critique: P5 H4 E4 S5 R4 V4 */}
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0 max-w-4xl">
                <nav className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                  <Link href={`/report-center?source=${selectedSource}`} className="transition hover:text-lime-200">Dashboard</Link>
                  <span className="text-white/20">/</span>
                  <Link href={`/report-center/inventory?source=${selectedSource}`} className="transition hover:text-lime-200">Inventory</Link>
                  <span className="text-white/20">/</span>
                  <span className="text-lime-100/70">{report.code || report.id}</span>
                </nav>

                <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-lime-100">
                  <FileSpreadsheet size={12} aria-hidden="true" />
                  Report {report.code || report.id}
                </p>

                <h1 className="mt-3 max-w-4xl text-3xl font-black leading-[0.95] tracking-[-0.05em] text-white sm:text-4xl lg:text-[2.65rem]">
                  {report.title}
                </h1>

                <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-white/70 sm:text-[15px]">
                  {report.description || 'Report inventory aktif pada scope filter server.'}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {reportStateCards.map((card) => (
                    <div key={card.label} className={`rounded-2xl border px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${card.tone}`}>
                      <span className="block text-[10px] font-black uppercase tracking-[0.14em] opacity-70">{card.label}</span>
                      <strong className="mt-1 block truncate text-base font-black tabular-nums">{card.value}</strong>
                      <span className="mt-0.5 block truncate text-[11px] font-semibold opacity-60">{card.detail}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100">
                    Inventory
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-lime-300/35 bg-lime-300/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-lime-100">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-300 shadow-[0_0_0_4px_rgba(190,242,100,0.18)]" />
                    {report.status === 'live' ? 'LIVE' : 'Update'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] font-black text-white">
                    <FileSpreadsheet size={12} />
                    {sourceLabel(selectedSource)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold text-white/55">
                    {sourceDescription(selectedSource)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-200">
                    <ShieldCheck size={13} />
                    Read-only SELECT
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[11px] font-bold text-sky-100">
                    <Sparkles size={13} />
                    AI baca payload
                  </span>
                  <span className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-50" title="Periode aktif: actual month dan accounting month">
                    <span className="text-amber-200/70">Periode aktif</span>
                    <span className="tabular-nums">{activePeriodLabels.summary}</span>
                  </span>
                  {payload?.metadata?.filteredRows !== undefined && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-100">
                      {formatValue(payload.metadata.filteredRows)} row filter
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleFavorite(report.id)}
                    className={isFavorite
                      ? 'rounded-full border border-amber-300/40 bg-amber-400/15 p-2 text-amber-200'
                      : 'rounded-full border border-white/12 bg-white/[0.05] p-2 text-white/45 hover:text-amber-200'}
                    aria-label={isFavorite ? 'Hapus favorit' : 'Tambah favorit'}
                  >
                    <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[220px]">
                <button
                  type="button"
                  onClick={toggleReportInfo}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-lime-300/35 bg-lime-300/12 px-4 py-3 text-sm font-black text-lime-50 transition hover:-translate-y-0.5 hover:bg-lime-300/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
                >
                  {reportInfoVisible ? 'Sembunyikan Filter' : 'Tampilkan Filter'}
                </button>
                <Link
                  href={`/report-center/inventory?source=${selectedSource}&report=${report.id}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300"
                >
                  <ArrowLeft size={16} />
                  Kembali ke Modul
                </Link>
                <p className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-[11px] font-semibold leading-5 text-white/50">
                  Banner report selalu di atas KPI. Angka KPI = full server scope, bukan halaman tabel.
                </p>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-emerald-400/20 bg-gradient-to-br from-[#12351F] via-[#0F2B1A] to-[#0B1F15] p-4 text-white shadow-[0_24px_60px_rgba(0,0,0,0.22)]">

        {removableFilterChips.length > 0 && (
          <AppliedFilterBar
            chips={removableFilterChips}
            onRemove={removeFilterChip}
            onClearAll={resetFilters}
            variant="sticky"
          />
        )}

        {!tableExpanded && (
          <ReportWorkspaceTabs
            value={workspaceTab}
            onChange={(tab) => {
              setWorkspaceTab(tab)
              if (tab === 'analisis' || tab === 'audit') {
                setReportInfoVisible(true)
                if (tab === 'audit') setReportInfoManuallyOpened(true)
              }
            }}
            showAudit
          />
        )}

        {/* Hold KPI/grand total until fetch finishes — avoids half-loaded Closing vs export. */}
        {loading && (
          <ReportDetailLoadingScreen
            open
            mode={payload ? 'refresh' : 'initial'}
            reportTitle={report.title}
            reportCode={report.code}
            sourceLabel={sourceLabel(selectedSource)}
            periodLabel={activePeriodLabels.summary}
            startedAt={loadStartedAt}
          />
        )}

        
        {!loading && workspaceTab === 'ringkasan' && kpiCards.length === 0 && stickyGrandTotals.length === 0 && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm font-semibold text-white/55">
            Ringkasan belum tersedia untuk filter aktif. Ubah periode/source, atau buka tab Detail Data.
          </div>
        )}

        {!loading && (workspaceTab === 'ringkasan' || tableExpanded) && (kpiCards.length > 0 || stickyGrandTotals.length > 0) && (
          <MonthlyStockRingkasan
            isMonthlyStockMovement={isMonthlyStockMovement}
            stickyGrandTotals={stickyGrandTotals}
            kpiCards={kpiCards}
            flowKpiCards={flowKpiCards}
            globalKpiCards={globalKpiCards}
            breakdownKpiCards={breakdownKpiCards}
            subKpiCards={subKpiCards}
            movementCategoryKpiCards={movementCategoryKpiCards}
            monthlySecondaryOpen={monthlySecondaryOpen}
            setMonthlySecondaryOpen={setMonthlySecondaryOpen}
            resolvedMonthlyAnalysisGroup={resolvedMonthlyAnalysisGroup}
            activeMonthlyMovementWindow={activeMonthlyMovementWindow}
            analysisGroupOptions={MONTHLY_ANALYSIS_GROUP_OPTIONS}
            movementWindowOptions={MONTHLY_MOVEMENT_WINDOW_OPTIONS}
            requestFilters={requestFilters}
            payload={payload}
            appliedFilters={appliedFilters}
            viewerProfile={viewerProfile}
            compactMetric={compactMetric}
            formatValue={formatValue}
            displayColumnLabel={displayColumnLabel}
            activePeriodLabels={activePeriodLabels}
            openKpiSqlDebug={openKpiSqlDebug}
            applyKpiFilter={applyKpiFilter}
            applySubKpiCardFilter={applySubKpiCardFilter}
            applyMonthlyAnalysisGroup={applyMonthlyAnalysisGroup}
            applyMonthlyMovementWindow={applyMonthlyMovementWindow}
            applyMonthlyItemType={applyMonthlyItemType}
            commitReportFilters={commitReportFilters}
            setReportInfoVisible={setReportInfoVisible}
            setReportInfoManuallyOpened={setReportInfoManuallyOpened}
            setManualFilterOpen={setManualFilterOpen}
          />
        )}
        </section>

        {!tableExpanded && workspaceTab === 'analisis' && (
          <ReportAnalysisBand
            analytics={payload?.analytics}
            activeFilters={requestFilters}
            sourceLabel={sourceLabel(selectedSource)}
            sourceDescription={sourceDescription(selectedSource)}
            reportTitle={report.title}
            reportDescription={report.description}
            reportCode={report.code}
            generatedAt={generatedAtValue || undefined}
            loading={loading}
            onFilterAction={applyReportFilterAction}
            onAskQuestion={askAiQuestion}
          />
        )}

        {viewerProfile.showAccountingPeriodFilter && !isMonthlyStockMovement && workspaceTab !== 'ringkasan' && (
        <section className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-white shadow-[0_0_0_1px_rgba(16,185,129,0.08)]">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Periode Report (Bulan Aktual)</p>
              <p className="mt-0.5 text-xs font-semibold text-emerald-100/70">
                Filter pakai bulan/tahun aktual. AccYear/AccMonth dihitung otomatis di server (baca saja).
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-white/70">
              {Boolean(payload?.metadata?.actualPeriod || appliedFilters.period) && (
                <span className="rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-emerald-100">
                  Actual: {String(payload?.metadata?.actualPeriod ?? appliedFilters.period)}
                </span>
              )}
              {Boolean(payload?.metadata?.accountingPeriod) && (
                <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1" title="Hasil konversi fiscal dari actual">
                  Acc (auto): {String(payload?.metadata?.accountingPeriod)}
                </span>
              )}
              {!appliedFilters.period && !payload?.metadata?.actualPeriod && (
                <span className="rounded-lg border border-white/10 bg-white/5 px-2 py-1">Scope: current</span>
              )}
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="block min-w-0">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/45">Bulan / Tahun aktual</span>
              <input
                type="month"
                value={manualFilters.period ?? ''}
                onChange={(event) => updateActualPeriod(event.target.value)}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
              />
            </label>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  const next: ReportFilterInput = {
                    ...manualFilters,
                    period: manualFilters.period || undefined,
                    // Always clear Acc* from client filter — server converts actual→acc.
                    accYear: undefined,
                    accMonth: undefined,
                    actualYear: undefined,
                    actualMonth: undefined,
                  }
                  commitReportFilters(
                    next,
                    next.period ? `Periode aktual ${next.period} diterapkan.` : 'Periode current diterapkan.',
                  )
                }}
                className="h-10 w-full rounded-lg bg-emerald-500 px-4 text-xs font-black text-slate-950 hover:bg-emerald-400"
              >
                Apply Periode
              </button>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  const next: ReportFilterInput = {
                    ...manualFilters,
                    period: undefined,
                    accYear: undefined,
                    accMonth: undefined,
                    actualYear: undefined,
                    actualMonth: undefined,
                  }
                  commitReportFilters(next, 'Periode dikembalikan ke current scope.')
                }}
                className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-4 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white"
              >
                Current
              </button>
            </div>
          </div>
        </section>
        )}

        {reportInfoVisible && workspaceTab !== 'ringkasan' && (
        <section className="mt-4 text-white">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <label htmlFor="natural-filter" className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                <Sparkles size={13} />
                Natural Filter
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id="natural-filter"
                  value={naturalQuery}
                  onChange={(event) => setNaturalQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') applyNaturalFilter()
                  }}
                  placeholder={viewerProfile.naturalPlaceholder}
                  className="h-11 min-w-0 flex-1 rounded-xl border border-emerald-500/20 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                />
                <button
                  type="button"
                  onClick={applyNaturalFilter}
                  disabled={naturalLoading || !naturalQuery.trim()}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {naturalLoading ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                  Jalankan
                </button>
              </div>
              {filterMessage && <p className="mt-2 text-xs font-medium text-emerald-300">{filterMessage}</p>}
              {filterWarning && <p className="mt-2 text-xs font-bold text-amber-300">{filterWarning}</p>}
              {filterError && <p className="mt-2 text-xs font-bold text-red-300">{filterError}</p>}
              <AppliedFilterBar
                chips={removableFilterChips}
                onRemove={removeFilterChip}
                onClearAll={resetFilters}
                variant="inline"
              />
              <div className="mt-3 rounded-xl border border-white/10 bg-black/15 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">Parameter request report</p>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard?.writeText(activeFilterParameterEntries.map((entry) => `${entry.key}=${entry.value}`).join('&'))}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-bold text-white/55 hover:bg-white/10 hover:text-white"
                  >
                    Copy params
                  </button>
                </div>
                <div className="mt-2 flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
                  {activeFilterParameterEntries.map((entry) => (
                    <span
                      key={`${entry.key}-${entry.value}`}
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] font-bold text-lime-100/85"
                    >
                      {entry.key}={entry.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-[0.22em] text-white/40">
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal size={13} />
                  Preset & Filter
                </span>
                <button
                  type="button"
                  onClick={() => setManualFilterOpen((current) => !current)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-bold text-white/60 hover:bg-white/10 hover:text-white"
                >
                  {manualFilterOpen ? 'Hide Manual' : 'Manual Filter'}
                </button>
              </div>
              {viewerProfile.presets.length > 0 && (
                <div className="mb-4 rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{viewerProfile.presetTitle}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {viewerProfile.presets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyReportPreset(preset)}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-emerald-500/40 hover:bg-emerald-500/10"
                      >
                        <span className="block text-sm font-bold text-white">{preset.label}</span>
                        <span className="mt-0.5 block text-xs font-medium text-white/40">{preset.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {manualFilterOpen && (
                <>
              {viewerProfile.showAccountingPeriodFilter && !isMonthlyStockMovement && (
                              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Periode (Bulan Aktual)</p>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <label className="block">
                      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Bulan / Tahun aktual</span>
                      <input
                        type="month"
                        value={manualFilters.period ?? ''}
                        onChange={(event) => updateActualPeriod(event.target.value)}
                        className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          commitReportFilters({
                            ...manualFilters,
                            period: manualFilters.period || undefined,
                            accYear: undefined,
                            accMonth: undefined,
                            actualYear: undefined,
                            actualMonth: undefined,
                          }, manualFilters.period
                            ? `Periode aktual ${manualFilters.period} diterapkan.`
                            : 'Periode current diterapkan.')
                        }}
                        className="h-10 rounded-lg bg-emerald-500 px-4 text-xs font-black text-slate-950 hover:bg-emerald-400"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => {
                          commitReportFilters({
                            ...manualFilters,
                            period: undefined,
                            accYear: undefined,
                            accMonth: undefined,
                            actualYear: undefined,
                            actualMonth: undefined,
                          }, 'Periode dikembalikan ke current scope.')
                        }}
                        className="h-10 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white"
                      >
                        Current
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-emerald-200/80">
                    Hanya actual month. Server konversi ke AccYear/AccMonth fiscal (April start). Acc tidak di-set dari UI.
                  </p>
                </div>
              )}

              {isMonthlyStockMovement && (
                <div className="mb-4 rounded-xl border border-sky-500/25 bg-sky-500/10 p-3">
                  <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-sky-300">
                    Official PDF scope
                  </p>
                  <p className="mb-3 text-xs font-semibold text-sky-100/85">
                    Analysis group resmi = <span className="font-black">Product Type Code</span>.
                    Stock Analysis Code (DEADS/MEMOV/SLMOV) dihapus. KPI = 14 kolom resmi Opening→Closing.
                  </p>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => commitReportFilters({
                        ...manualFilters,
                        period: manualFilters.period ?? '2026-07',
                        location: manualFilters.location ?? 'PTRJ',
                        itemType: 'gudang',
                        includeWorkshopItem: 'no',
                        groupBy: 'ProductTypeCode',
                        chartDimension: 'ProductTypeCode',
                        stockAnalysis: undefined,
                        category: undefined,
                        accYear: undefined,
                        accMonth: undefined,
                      }, 'Mode pembanding JSON/PDF aktif: ProductTypeCode + Include Workshop Item: No (ItemType 1).')}
                      className="rounded-lg border border-cyan-300/40 bg-cyan-400/15 px-3 py-2 text-xs font-black text-cyan-100 hover:bg-cyan-400/25"
                    >
                      Match JSON/PDF Product Type
                    </button>
                    <button
                      type="button"
                      onClick={() => commitReportFilters({
                        ...manualFilters,
                        itemType: undefined,
                        includeWorkshopItem: undefined,
                        stockAnalysis: undefined,
                        category: undefined,
                        groupBy: 'ProductTypeCode',
                        chartDimension: 'ProductTypeCode',
                      }, 'Scope default Report Center: ItemType 1+4 + Product Type.')}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                    >
                      Default Inventory 1+4
                    </button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setTableGroupMode('ProductTypeCode')
                        commitReportFilters({
                          ...manualFilters,
                          groupBy: 'ProductTypeCode',
                          chartDimension: 'ProductTypeCode',
                          stockAnalysis: undefined,
                          category: undefined,
                        }, 'Table/KPI group by ProductTypeCode (official PDF).')
                      }}
                      className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25"
                    >
                      Group table: Product Type
                    </button>
                  </div>
                </div>
              )}

              {movementCategoryAvailable && (
              <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3">
                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
                  Movement Category (hitung dinamis dari StockIssue)
                </p>
                <p className="mb-2 text-xs font-semibold text-amber-100/80">
                  Bukan field master DEADS/MEMOV. Fast/Moving/Slow/Dead/Stale dihitung ulang per item dari count issue valid dalam window.
                </p>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Window hitung issue</span>
                    <select
                      value={manualFilters.movementWindow ?? 'all'}
                      onChange={(event) => {
                        const next = event.target.value
                        setManualFilters((prev) => ({
                          ...prev,
                          movementWindow: next || 'all',
                          dateFrom: next === 'custom' ? prev.dateFrom : undefined,
                          dateTo: next === 'custom' ? prev.dateTo : undefined,
                        }))
                      }}
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="all">All period (default)</option>
                      <option value="1m">1 bulan</option>
                      <option value="3m">3 bulan terakhir</option>
                      <option value="6m">6 bulan terakhir</option>
                      <option value="12m">12 bulan terakhir</option>
                      <option value="custom">Custom range</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">dateFrom</span>
                    <input
                      type="date"
                      value={manualFilters.dateFrom ?? ''}
                      disabled={(manualFilters.movementWindow ?? 'all') !== 'custom'}
                      onChange={(event) => updateManualFilter('dateFrom', event.target.value)}
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white disabled:opacity-30"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">dateTo</span>
                    <input
                      type="date"
                      value={manualFilters.dateTo ?? ''}
                      disabled={(manualFilters.movementWindow ?? 'all') !== 'custom'}
                      onChange={(event) => updateManualFilter('dateTo', event.target.value)}
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white disabled:opacity-30"
                    />
                  </label>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => commitReportFilters({
                        ...manualFilters,
                        movementWindow: manualFilters.movementWindow ?? 'all',
                      }, 'Movement Category window diterapkan (read-only SELECT).')}
                      className="h-10 rounded-lg bg-amber-500 px-3 text-xs font-black text-slate-950 hover:bg-amber-400"
                    >
                      Apply MC
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setTableGroupMode('MovementCategory')
                      commitReportFilters({
                        ...manualFilters,
                        movementWindow: manualFilters.movementWindow ?? 'all',
                        groupBy: 'MovementCategory',
                        chartDimension: 'MovementCategory',
                      }, 'Grouping actual MovementCategory aktif untuk item report.')
                    }}
                    className="rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-400/25"
                  >
                    Aktifkan group movement actual
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTableGroupMode(AUTO_GROUP)
                      commitReportFilters({
                        ...manualFilters,
                        groupBy: undefined,
                        chartDimension: undefined,
                        movementCategory: undefined,
                      }, 'Grouping MovementCategory dimatikan; kategori tetap tersedia sebagai kolom item.')
                    }}
                    className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                  >
                    Matikan group movement
                  </button>
                  <span className="rounded-lg border border-white/10 bg-black/15 px-3 py-2 text-xs font-semibold text-amber-100/70">
                    Mode: {(manualFilters.groupBy ?? '') === 'MovementCategory' ? 'group actual movement' : 'kolom per item'}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-4">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Fast bila issue &gt;=</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={manualFilters.movementFastMin ?? ''}
                      onChange={(event) => updateManualNumber('movementFastMin', event.target.value)}
                      placeholder="6"
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Moving min</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={manualFilters.movementMovingMin ?? ''}
                      onChange={(event) => updateManualNumber('movementMovingMin', event.target.value)}
                      placeholder="2"
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Moving max</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={manualFilters.movementMovingMax ?? ''}
                      onChange={(event) => updateManualNumber('movementMovingMax', event.target.value)}
                      placeholder="5"
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-white/40">Slow bila issue =</span>
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={manualFilters.movementSlowCount ?? ''}
                      onChange={(event) => updateManualNumber('movementSlowCount', event.target.value)}
                      placeholder="1"
                      className="h-10 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs font-semibold text-amber-100/80">
                  Window dan definisi ini menghitung ulang Fast/Moving/Slow/Dead/Stale dari issue valid. Default: Fast &gt;= 6, Moving 2-5, Slow = 1. DB tetap read-only.
                </p>
              </div>
              )}

              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40 mb-3">Filter Kolom Report</p>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1.2fr)_140px_minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <select
                      value={columnFilterDraft.field ?? ''}
                      onChange={(event) => updateColumnFilterDraft('field', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Pilih kolom report</option>
                      {dynamicFilterColumns.map((column) => (
                        <option key={column.field} value={column.field}>{column.label}</option>
                      ))}
                    </select>
                    <select
                      value={columnFilterDraft.operator ?? defaultOperatorForManualType(selectedFilterColumn?.type ?? 'string', Boolean(selectedFilterColumn?.options.length))}
                      onChange={(event) => updateColumnFilterDraft('operator', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      disabled={!selectedFilterColumn}
                    >
                      {manualColumnOperators.map((operator) => (
                        <option key={operator.value} value={operator.value}>{operator.label}</option>
                      ))}
                    </select>
                    {selectedFilterColumn?.options.length && !['gt', 'gte', 'lt', 'lte', 'between'].includes(String(columnFilterDraft.operator)) ? (
                      <select
                        value={String(columnFilterDraft.value ?? '')}
                        onChange={(event) => updateColumnFilterDraft('value', event.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                        disabled={columnFilterDraft.operator === 'blank' || columnFilterDraft.operator === 'notBlank'}
                      >
                        <option value="">Pilih nilai</option>
                        {selectedFilterColumn.options.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={selectedFilterColumn?.type === 'number' ? 'number' : selectedFilterColumn?.type === 'date' ? 'date' : 'text'}
                        value={String(columnFilterDraft.value ?? '')}
                        onChange={(event) => updateColumnFilterDraft('value', event.target.value)}
                        placeholder={selectedFilterColumn ? `Nilai ${selectedFilterColumn.label}` : 'Pilih kolom dulu'}
                        disabled={!selectedFilterColumn || columnFilterDraft.operator === 'blank' || columnFilterDraft.operator === 'notBlank'}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400 disabled:opacity-30"
                      />
                    )}
                    <input
                      type={selectedFilterColumn?.type === 'number' ? 'number' : selectedFilterColumn?.type === 'date' ? 'date' : 'text'}
                      value={String(columnFilterDraft.valueTo ?? '')}
                      onChange={(event) => updateColumnFilterDraft('valueTo', event.target.value)}
                      placeholder="Nilai akhir"
                      disabled={columnFilterDraft.operator !== 'between'}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400 disabled:opacity-30"
                    />
                    <button type="button" onClick={addColumnFilter} disabled={!selectedFilterColumn} className="h-9 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-30">
                      +
                    </button>
                  </div>
                {(manualFilters.columnFilters ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {manualFilters.columnFilters?.map((filter, index) => (
                      <button
                        key={`${filter.field}-${filter.operator}-${index}`}
                        type="button"
                        onClick={() => removeColumnFilter(index)}
                        className="rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-300 hover:border-red-500/40"
                      >
                        {displayColumnLabel(filter.field ?? '')} {filter.operator}{filter.value !== undefined ? ` ${filter.value}` : ''}{filter.valueTo !== undefined ? ` - ${filter.valueTo}` : ''} x
                      </button>
                    ))}
                  </div>
                )}
                </div>
                <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/40 mb-3">Sort / Limit / Chart</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {viewerProfile.presets.some((preset) => preset.filters.stale) && (
                      <select
                        value={manualFilters.stale ?? ''}
                        onChange={(event) => updateManualFilter('stale', event.target.value)}
                        className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                      >
                        <option value="">Update aging</option>
                        <option value="semua">Semua Item</option>
                        <option value="active">{'Update <= 3 bulan'}</option>
                        <option value="watch">Update 3-6 bulan</option>
                        <option value="slow-moving">Update 6-12 bulan</option>
                        <option value="lebih-1-tahun">{'Tidak update > 12 bulan'}</option>
                        <option value="dead-stock">{'Tidak update > 24 bulan'}</option>
                      </select>
                    )}
                    <select
                      value={manualFilters.sortColumn ?? ''}
                      onChange={(event) => updateManualFilter('sortColumn', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Sort kolom</option>
                      {dynamicFilterColumns.map((column) => (
                        <option key={column.field} value={column.field}>{column.label}</option>
                      ))}
                    </select>
                    <select
                      value={manualFilters.sortDirection ?? ''}
                      onChange={(event) => updateManualFilter('sortDirection', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Arah sort</option>
                      <option value="desc">Tertinggi</option>
                      <option value="asc">Terendah</option>
                    </select>
                    <select
                      value={manualFilters.itemType ?? ''}
                      onChange={(event) => updateManualFilter('itemType', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Inventory 1+4</option>
                      <option value="gudang">Gudang / official no workshop</option>
                      <option value="workshop">Workshop/Mesin only</option>
                    </select>
                    <select
                      value={manualFilters.groupBy ?? ''}
                      onChange={(event) => updateManualFilter('groupBy', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Group / chart per kolom</option>
                      {groupByColumns.map((column) => (
                        <option key={column.field} value={column.field}>{column.label}</option>
                      ))}
                    </select>
                    {movementCategoryAvailable ? (
                      <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/90">
                        <input
                          type="checkbox"
                          checked={(manualFilters.groupBy ?? '') === 'MovementCategory'}
                          onChange={(event) => updateManualFilter(
                            'groupBy',
                            event.target.checked ? 'MovementCategory' : '',
                          )}
                          className="h-3.5 w-3.5 accent-[var(--rc-forest-accent,#7dd3a0)]"
                        />
                        Kategori movement
                      </label>
                    ) : null}
                    <select
                      value={manualFilters.aggregateField ?? ''}
                      onChange={(event) => updateManualFilter('aggregateField', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Field agregasi</option>
                      {(aggregatableColumns.length > 0 ? aggregatableColumns : dynamicFilterColumns.map((column) => column.field)).map((column) => (
                        <option key={column} value={column}>{displayColumnLabel(column)}</option>
                      ))}
                    </select>
                    <select
                      value={manualFilters.aggregateFn ?? ''}
                      onChange={(event) => updateManualFilter('aggregateFn', event.target.value)}
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white"
                    >
                      <option value="">Agregasi</option>
                      <option value="sum">Sum</option>
                      <option value="count">Count</option>
                      <option value="avg">Average</option>
                      <option value="min">Min</option>
                      <option value="max">Max</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={manualFilters.top ?? ''}
                      onChange={(event) => updateManualNumber('top', event.target.value)}
                      placeholder="Top N"
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400"
                    />
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={manualFilters.resultLimit ?? ''}
                      onChange={(event) => updateManualNumber('resultLimit', event.target.value)}
                      placeholder="Limit row"
                      className="h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-sm font-medium text-white placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>
                </>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={applyManualFilters} className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-500">
                  <SlidersHorizontal size={14} />
                  Terapkan
                </button>
                <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white/60 hover:bg-white/10 hover:text-white">
                  <XCircle size={14} />
                  Reset
                </button>
              </div>
            </div>
          </div>
        </section>
        )}

        <div className={`${tableExpanded || workspaceTab === 'detail' ? '' : 'hidden'}${tableExpanded ? '' : ' mt-5'}`.trim()}>
        <section className={tableExpanded ? 'fixed inset-0 z-50 overflow-hidden bg-[#06080d] p-2' : 'overflow-hidden rounded-2xl border border-amber-400/25 bg-[#0b1018] shadow-[0_24px_80px_rgba(0,0,0,0.32)]'}>
          <ReportTableToolbar
            tableExpanded={tableExpanded}
            tableSearch={tableSearch}
            onTableSearchChange={(value) => {
              setTableSearch(value)
              setPage(1)
            }}
            shownTableRows={shownTableRows}
            displayTableTotalRows={displayTableTotalRows}
            safeTotalTableRows={safeTotalTableRows}
            serverPaged={serverPaged}
            tableWindowed={Boolean(tableWindow.windowed)}
            tableStreaming={tableStreaming}
            tableStreamProgress={tableStreamProgress}
            tableGroupMode={tableGroupMode}
            onTableGroupModeChange={(value) => {
              setTableGroupMode(value)
              setCollapsedGroups({})
              setPage(1)
            }}
            autoGroupValue={AUTO_GROUP}
            noGroupValue={NO_GROUP}
            payloadColumns={payloadColumns}
            displayColumnLabel={displayColumnLabel}
            groupedTableActive={groupedTableActive}
            onExpandGroups={() => setAllGroupsCollapsed(false)}
            onCollapseGroups={() => setAllGroupsCollapsed(true)}
            tableDensity={tableDensity}
            onToggleDensity={() => setTableDensity((current) => (current === 'compact' ? 'comfortable' : 'compact'))}
            visibleColumns={visibleColumns}
            allColumns={payload?.columns ?? []}
            onToggleColumn={toggleColumn}
            page={page}
            pageCount={pageCount}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size)
              setPage(1)
            }}
            onExportExcel={() => setExportPreflight({ kind: 'excel' })}
            onExportPdf={() => setExportPreflight({ kind: 'pdf' })}
            onExportCsv={() => setExportPreflight({ kind: 'csv' })}
            onJumpToAnalysis={jumpToAnalysis}
            showSqlAudit={debugSqlStatements.length > 0}
            onEnterFullTable={enterFullTable}
            onExitFullTable={() => setTableExpanded(false)}
          />

          {loading ? (
            <div className="space-y-2 p-5" aria-hidden="true">
              <div className="flex items-center gap-2 rounded-xl border border-lime-400/20 bg-lime-400/10 px-4 py-3 text-sm font-bold text-lime-100">
                <Loader2 className="animate-spin text-lime-300" size={16} />
                Memuat ringkasan server & KPI… tabel menyusul.
              </div>
              <div className="h-11 animate-pulse rounded-xl bg-white/10" />
              <div className="h-11 animate-pulse rounded-xl bg-white/5" />
              <div className="h-11 animate-pulse rounded-xl bg-white/5" />
              <div className="h-11 animate-pulse rounded-xl bg-white/[0.04]" />
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-lg font-bold text-red-400">Gagal memuat laporan</p>
              <p className="mt-2 text-sm text-red-500">{error}</p>
            </div>
          ) : (
            <>
              {!tableExpanded && reportInfoVisible && tableContextItems.length > 0 && (
                <div className="border-b border-amber-400/15 bg-[#071426] px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {tableContextItems.map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
                        <span className="block text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">{label}</span>
                        <span className="mt-0.5 block text-xs font-black text-lime-100">{formatValue(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <ReportDataTable
                tableExpanded={tableExpanded}
                tableContainerRef={tableContainerRef}
                visibleColumns={visibleColumns}
                tableRows={tableRows}
                virtualRows={virtualRows}
                virtualPaddingTop={virtualPaddingTop}
                virtualPaddingBottom={virtualPaddingBottom}
                filteredRowsLength={filteredRows.length}
                sortColumn={sortColumn}
                sortDirection={sortDirection}
                onSort={sortBy}
                displayColumnLabel={displayColumnLabel}
                displayColumnHelp={displayColumnHelp}
                formatValue={formatValue}
                headerCellClass={headerCellClass}
                bodyCellClass={bodyCellClass}
                cellContentClass={cellContentClass}
                stickyCellStyle={stickyCellStyle}
                collapsedGroups={collapsedGroups}
                expandedMovementRows={expandedMovementRows}
                onToggleGroup={toggleGroup}
                onToggleMovementRow={toggleMovementRow}
                onToggleReportRow={toggleReportRow}
                activeTableGroupColumn={activeTableGroupColumn}
                groupMetricTotal={groupMetricTotal}
                reportId={report.id}
                rowDetailMode={viewerProfile.rowDetail}
              />

              {!tableExpanded && Object.keys(tableTotals).length > 0 && (
                <div className="sticky bottom-0 z-20 flex flex-wrap gap-2 border-t border-amber-400/30 bg-[#0b1018]/95 px-4 py-2.5 backdrop-blur-md">
                  <span className="self-center text-[10px] font-black uppercase tracking-[0.16em] text-amber-200/80">Grand total tabel</span>
                  {Object.entries(tableTotals).map(([column, total]) => (
                    <div key={column} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 shadow-sm ${report.id === 'all-stock-movement-analysis' && column === 'AmountItem' ? 'border-emerald-300 bg-emerald-50' : 'border-white/10 bg-white/5'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${report.id === 'all-stock-movement-analysis' && column === 'AmountItem' ? 'text-emerald-700' : 'text-white/50'}`}>{displayColumnLabel(column)}</span>
                      <span className={`text-sm font-black ${report.id === 'all-stock-movement-analysis' && column === 'AmountItem' ? 'text-emerald-950' : 'text-lime-200'}`}>{formatValue(total, column)}</span>
                    </div>
                  ))}
                </div>
              )}

              {!tableExpanded && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-400/20 bg-[#071426] px-5 py-3 text-sm text-slate-300">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Menampilkan {shownTableRows} dari {displayTableTotalRows} row{serverPaged && tableWindow.windowed ? ` dari ${safeTotalTableRows} total` : ''}
                    {groupedTableActive ? ` dalam ${tableGroups.length} group (${activeTableGroupColumn})` : ''}
                    {tableStreaming
                      ? ` · streaming full scope ${tableStreamProgress?.loaded?.toLocaleString('id-ID') ?? 0}/${tableStreamProgress?.total?.toLocaleString('id-ID') ?? '…'}`
                      : tableStreamProgress && !tableStreaming
                        ? ` · full stream ${tableStreamProgress.loaded.toLocaleString('id-ID')} rows`
                        : ''}
                  </span>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    Rows per page
                    <select
                      value={pageSize}
                      disabled={groupedTableActive}
                      onChange={(event) => {
                        setPageSize(Number(event.target.value))
                        setPage(1)
                      }}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {[50, 100, 200].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {!groupedTableActive && (
                  <div className="flex gap-2">
                    <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                      Prev
                    </button>
                    <span className="rounded-xl border border-emerald-700 bg-emerald-700 px-3 py-1.5 text-xs font-black text-white">{page} / {pageCount}</span>
                    <button type="button" disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30">
                      Next
                    </button>
                  </div>
                )}
              </div>
              )}
            </>
          )}
        </section>
        {!tableExpanded && (workspaceTab === 'analisis' || workspaceTab === 'audit') && analysisPanelVisible && tableReady && !analysisReady && (
          <section id="analysis-workspace" className="mt-5 rounded-2xl border border-emerald-500/25 bg-[#12351F] p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                  {workspaceTab === 'audit' ? 'Audit Workspace' : 'Analysis Workspace'}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/45">
                  {workspaceTab === 'audit'
                    ? 'SQL audit, metadata, quality, dan parameter request disiapkan setelah table.'
                    : aiInsightVisible
                      ? 'AI insight, chart, quality, metadata, dan recommendations disiapkan setelah table.'
                      : 'Chart, quality, metadata, dan recommendations disiapkan setelah table.'}
                </p>
              </div>
              <Loader2 className="animate-spin text-emerald-300" size={18} />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#0F2B1A] p-4 text-sm font-semibold text-white/60">
              {workspaceTab === 'audit'
                ? 'Table sudah siap. Audit Workspace sedang menyiapkan SQL, metadata, quality, dan parameter request.'
                : 'Table sudah siap. Analysis Workspace sedang dimuat di background supaya table tetap ringan dulu.'}
            </div>
          </section>
        )}
        {!tableExpanded && (workspaceTab === 'analisis' || workspaceTab === 'audit') && analysisPanelVisible && tableReady && analysisReady && (
          <section id="analysis-workspace" className="mt-5 rounded-2xl border border-emerald-500/25 bg-[#12351F] p-5 text-white shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                  {workspaceTab === 'audit' ? 'Audit Workspace' : 'Analysis Workspace'}
                </p>
                <p className="mt-1 text-xs font-semibold text-white/45">
                  {workspaceTab === 'audit'
                    ? 'SQL audit, metadata, quality, dan parameter request tersedia tanpa mengganggu table utama.'
                    : aiInsightVisible
                      ? 'AI insight, chart analysis, quality, metadata, dan recommendations tetap lengkap setelah table.'
                      : 'Chart, quality, metadata, dan recommendations tampil dulu. AI Insight menunggu tombol khusus.'}
                </p>
              </div>
              <button
                type="button"
                onClick={aiInsightVisible ? hideAiInsight : () => jumpToAnalysis('ai')}
                className={aiInsightVisible ? 'rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white' : 'rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20'}
              >
                {aiInsightVisible ? 'Sembunyikan AI Insight' : 'Tampilkan AI Insight'}
              </button>
            </div>

            <div className={aiInsightVisible ? 'mb-4 grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]' : 'mb-4 grid gap-4'}>
              {aiInsightVisible && (
              <div className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-white">AI Insight Preview</p>
                  <span className={
                    aiDashboard
                      ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300'
                      : aiDashboardLoading
                        ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300'
                        : 'rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/35'
                  }>
                    {aiDashboard ? 'Ready' : aiDashboardLoading ? 'Generating' : 'Waiting'}
                  </span>
                </div>
                <p className="mt-3 text-sm font-semibold leading-6 text-white/70">{aiSections[0]?.content}</p>
                <button
                  type="button"
                  onClick={() => jumpToAnalysis('ai')}
                  className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
                >
                  Open AI Insight
                </button>
              </div>
              )}

              <div className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">
                      {workspaceTab === 'audit' ? 'SQL Audit Preview' : aiChartPreview?.title ?? 'AI Chart Preview'}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/45">
                      {workspaceTab === 'audit'
                        ? 'Audit workspace fokus ke SQL, metadata, quality, dan parameter request untuk pemeriksaan teknis.'
                        : aiChartPreview?.reason ?? 'AI akan menentukan chart, dimensi, metric, agregasi, dan alasan analisis dari payload report.'}
                    </p>
                  </div>
                  {workspaceTab === 'audit'
                    ? <ShieldCheck className="shrink-0 text-emerald-300" size={18} />
                    : <BarChart3 className="shrink-0 text-emerald-300" size={18} />}
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/35">{workspaceTab === 'audit' ? 'SQL Statements' : 'Charts'}</p>
                    <p className="mt-1 text-lg font-black text-emerald-300">{workspaceTab === 'audit' ? debugSqlStatements.length : aiDashboard?.charts?.length ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/35">{workspaceTab === 'audit' ? 'Metadata' : 'Primary Type'}</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{workspaceTab === 'audit' ? `${metadataEntries.length} fields` : aiChartPreview?.type?.replace('_', ' ') ?? (aiDashboardLoading ? 'Generating' : 'Waiting')}</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-white/35">{workspaceTab === 'audit' ? 'Request Filters' : 'Metric'}</p>
                    <p className="mt-1 truncate text-sm font-black text-white">{workspaceTab === 'audit' ? `${activeRequestFilterCount} active` : aiChartPreview?.valueField ?? aiChartPreview?.yField ?? 'AI selected'}</p>
                  </div>
                </div>
                {workspaceTab !== 'audit' && aiChartTypes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {aiChartTypes.slice(0, 7).map((type) => (
                      <span key={type} className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-200">
                        {type}
                      </span>
                    ))}
                  </div>
                )}
                {workspaceTab !== 'audit' && aiChartPreview && (
                  <p className="mt-3 text-xs leading-5 text-white/50">
                    {aiChartPreview.xField || aiChartPreview.categoryField ? `Dimension: ${aiChartPreview.xField ?? aiChartPreview.categoryField}` : 'Dimension dipilih dari payload'}
                    {aiChartPreview.aggregation ? ` - Aggregation: ${aiChartPreview.aggregation}` : ''}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setInsightTab(workspaceTab === 'audit' ? 'sql' : 'charts')}
                  className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 hover:bg-white/10 hover:text-white"
                >
                  {workspaceTab === 'audit' ? 'Open SQL Audit' : 'Open Charts'}
                </button>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#0F2B1A] p-1 md:grid-cols-6">
              {(Object.keys(insightTabLabels) as InsightTab[])
                .filter((tab) => (tab !== 'ai' || aiInsightVisible) && (tab !== 'sql' || workspaceTab === 'audit' || debugSqlStatements.length > 0))
                .map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setInsightTab(tab)}
                  className={
                    insightTab === tab
                      ? 'rounded-lg bg-emerald-600 px-2 py-2 text-xs font-black text-white'
                      : 'rounded-lg px-2 py-2 text-xs font-bold text-white/45 hover:bg-white/5 hover:text-white'
                  }
                >
                  {insightTabLabels[tab]}
                </button>
              ))}
            </div>

            {insightTab === 'ai' && aiInsightVisible && (
              <div className="space-y-3">
                {aiDashboardError && (
                  <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-xs font-semibold text-red-200">
                    {aiDashboardError}
                  </div>
                )}
                <ReportQuestionPanel
                  reportId={report.id}
                  reportTitle={report.title}
                  reportDescription={report.description}
                  sourceLabel={sourceLabel(selectedSource)}
                  sourceDescription={sourceDescription(selectedSource)}
                  payload={payload}
                  activeFilters={requestFilters}
                  questionRequest={aiQuestionRequest}
                />
                {aiSections.map((section) => (
                  <div key={section.label} className="rounded-xl border border-white/10 bg-[#0F2B1A] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-black text-white">{section.label}</p>
                      <span className={
                        section.status === 'ready'
                          ? 'rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-black text-emerald-300'
                          : section.status === 'generating'
                            ? 'rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-300'
                            : 'rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-black text-white/35'
                      }>
                        {section.status === 'ready' ? 'Ready' : section.status === 'generating' ? 'Generating' : 'Waiting'}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/58">{section.content}</p>
                  </div>
                ))}
                <div className="text-slate-950">
                  <AiDynamicDashboard
                    definition={aiDashboard}
                    payload={payload}
                    report={aiDashboardReport}
                    filters={aiDashboardFilters}
                    loading={aiDashboardLoading}
                    error={aiDashboardError}
                    focus="ai"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(aiSections.map((section) => `${section.label}: ${section.content}`).join('\n'))}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 hover:bg-white/10 hover:text-white"
                  >
                    Copy Insight
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAiDashboard(null)
                      setAiRefreshKey((current) => current + 1)
                    }}
                    className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            )}

            {insightTab === 'charts' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black text-white">AI-Generated Chart Analysis</p>
                    <p className="mt-1 text-xs text-white/45">
                      Chart, dimensi, metric, agregasi, dan alasan analisis diambil dari dashboard definition AI untuk report ini.
                    </p>
                  </div>
                </div>
                <div className="text-slate-950">
                  <AiDynamicDashboard
                    definition={aiDashboard}
                    payload={payload}
                    report={aiDashboardReport}
                    filters={aiDashboardFilters}
                    loading={aiDashboardLoading}
                    error={aiDashboardError}
                    focus="charts"
                  />
                </div>
              </div>
            )}

            {insightTab === 'quality' && (
              <div className="space-y-2">
                {qualityItems.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0F2B1A] px-3 py-2">
                    <span className="text-xs font-bold text-white/60">{label}</span>
                    <span className="text-sm font-black text-emerald-300">{formatValue(value)}</span>
                  </div>
                ))}
              </div>
            )}

            {insightTab === 'metadata' && (
              <div className="space-y-2">
                {metadataEntries.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 rounded-xl border border-white/10 bg-[#0F2B1A] px-3 py-2 text-xs">
                    <span className="text-white/40">{label}</span>
                    <span className="truncate text-right font-bold text-white">{formatValue(value)}</span>
                  </div>
                ))}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Safety</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-white/55">
                    AI hanya membaca payload result. Query report tetap SELECT-only melalui backend allowlist.
                  </p>
                </div>
              </div>
            )}

            {insightTab === 'sql' && (
              <div className="space-y-4">
                {kpiSimpleSqlView ? (
                  <div className="rounded-xl border border-lime-300/30 bg-lime-400/10 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-200">SQL Server · paste SSMS</p>
                        <p className="mt-1 text-sm font-black text-white">{kpiSimpleSqlView.label}</p>
                        <p className="mt-1 text-xs font-semibold leading-5 text-white/60">
                          Bentuk SUM/COUNT agar nilai cocok dengan KPI. Bukan full production query (tanpa CASE/join panjang).
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(
                            [
                              `-- KPI: ${kpiSimpleSqlView.label}`,
                              `-- Report: ${report.title}`,
                              kpiSimpleSqlView.sql,
                            ].join('\n'),
                          )}
                          className="rounded-xl border border-lime-300/35 bg-lime-300/15 px-3 py-2 text-xs font-black text-lime-50 hover:bg-lime-300/25"
                        >
                          Copy simple SQL
                        </button>
                        <button
                          type="button"
                          onClick={() => setKpiSimpleSqlView(null)}
                          className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/70 hover:bg-white/10"
                        >
                          Tutup
                        </button>
                      </div>
                    </div>
                    <pre className="mt-3 max-h-[280px] overflow-auto rounded-xl border border-white/10 bg-[#071426] p-4 text-[12px] leading-6 text-lime-100">
                      <code>{kpiSimpleSqlView.sql}</code>
                    </pre>
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 text-sm font-semibold text-white/60">
                    Klik tombol <span className="font-black text-amber-100">SQL</span> di kartu KPI untuk lihat query sederhana KPI itu.
                  </div>
                )}

                {debugSqlStatements.length > 0 && (
                <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">Full gateway SQL (opsional)</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-white/70">
                        Query production lengkap dari API. Prefer SQL sederhana di atas untuk cek nilai KPI.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(debugSqlCopyText(focusedDebugSqlStatement))}
                      className="rounded-xl border border-amber-300/30 bg-amber-300/15 px-3 py-2 text-xs font-black text-amber-100 hover:bg-amber-300/25"
                    >
                      Copy full SQL
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-white/65 md:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-[#0F2B1A] p-3">
                      <span className="block text-white/35">Server</span>
                      <span className="mt-1 block font-black text-white">{debugSql?.target?.server ?? focusedDebugSqlStatement?.server ?? '-'}</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0F2B1A] p-3">
                      <span className="block text-white/35">Database</span>
                      <span className="mt-1 block font-black text-white">{debugSql?.target?.database ?? focusedDebugSqlStatement?.database ?? '-'}</span>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-[#0F2B1A] p-3">
                      <span className="block text-white/35">Statement</span>
                      <span className="mt-1 block font-black text-white">{formatValue(debugSql?.statementCount ?? debugSqlStatements.length)}</span>
                    </div>
                  </div>
                  {debugSql?.sourceTables && (
                    <p className="mt-3 rounded-lg border border-white/10 bg-[#0F2B1A] p-3 text-xs font-semibold leading-5 text-white/60">
                      Tabel sumber: {debugSql.sourceTables}
                    </p>
                  )}

                  <div className="mt-3 grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {debugSqlStatements.map((statement, index) => {
                        const statementId = statement.id ?? statement.label ?? String(index)
                        const active = focusedDebugSqlStatement === statement
                        return (
                          <button
                            key={statementId}
                            type="button"
                            onClick={() => setDebugSqlFocus(statementId)}
                            className={active
                              ? 'w-full rounded-xl border border-amber-300/50 bg-amber-300/15 p-3 text-left text-amber-100'
                              : 'w-full rounded-xl border border-white/10 bg-[#0F2B1A] p-3 text-left text-white/55 hover:border-amber-300/25 hover:text-white'}
                          >
                            <span className="block text-[10px] font-black uppercase tracking-wide">{statement.label ?? `query-${index + 1}`}</span>
                            <span className="mt-1 block text-xs font-semibold">Rows: {formatValue(statement.rows)}{statement.executionMs ? ` | ${statement.executionMs}ms` : ''}</span>
                          </button>
                        )
                      })}
                    </div>

                    <div className="min-w-0 rounded-xl border border-white/10 bg-[#071426]">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                        <div>
                          <p className="text-sm font-black text-white">{focusedDebugSqlStatement?.label ?? 'query'}</p>
                          <p className="text-xs font-semibold text-white/45">Full gateway SQL — opsional.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(debugSqlCopyText(focusedDebugSqlStatement))}
                          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/65 hover:bg-white/10 hover:text-white"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="max-h-[520px] overflow-auto p-4 text-[11px] leading-5 text-emerald-100">
                        <code>{debugSqlCopyText(focusedDebugSqlStatement)}</code>
                      </pre>
                    </div>
                  </div>
                </div>
                )}
              </div>
            )}

            {insightTab === 'recommendations' && (
              <div className="space-y-4">
                <div className="text-slate-950">
                  <AiDynamicDashboard
                    definition={aiDashboard}
                    payload={payload}
                    report={aiDashboardReport}
                    filters={aiDashboardFilters}
                    loading={aiDashboardLoading}
                    error={aiDashboardError}
                    focus="recommendations"
                  />
                </div>
                {viewerProfile.presets.length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-[#0F2B1A] p-4">
                    <p className="text-xs font-black text-white">Suggested Next Filters</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {viewerProfile.presets.slice(0, 6).map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() => applyReportPreset(preset)}
                          className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/20"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
        </div>
      </div>

      {/* Always-on simple SQL modal — segmented box frames for debug */}
      {kpiSimpleSqlView ? (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/65 p-3 sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`SQL sederhana ${kpiSimpleSqlView.label}`}
          onClick={() => setKpiSimpleSqlView(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-lime-300/35 bg-[#071426] text-white shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-lime-200">SQL Server · paste SSMS</p>
                <p className="mt-1 truncate text-base font-black text-white sm:text-lg">{kpiSimpleSqlView.label}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(
                    [`-- KPI: ${kpiSimpleSqlView.label}`, `-- Report: ${report.title}`, kpiSimpleSqlView.sql].join('\n'),
                  )}
                  className="rounded-xl border border-lime-300/35 bg-lime-300/15 px-3 py-2 text-xs font-black text-lime-50 hover:bg-lime-300/25"
                >
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => setKpiSimpleSqlView(null)}
                  className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/75 hover:bg-white/10"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {/* Segment box: how to verify */}
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { t: '1. Card KPI', d: 'Nilai di ringkasan UI' },
                  { t: '2. Query ini', d: 'Paste SSMS → sama Acc/Loc/ItemType' },
                  { t: '3. JSON official', d: 'RPTIN listing bila period sama' },
                ].map((box) => (
                  <div
                    key={box.t}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-lime-200/80">{box.t}</p>
                    <p className="mt-1 text-[11px] font-semibold leading-4 text-white/55">{box.d}</p>
                  </div>
                ))}
              </div>

              {/* Segment box: SQL body */}
              <div className="overflow-hidden rounded-xl border border-lime-300/20 bg-[#050d18] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">Query mirror summary</p>
                  <p className="text-[10px] font-bold text-white/35">ItemType 1+4 · Acc dari payload</p>
                </div>
                <pre className="max-h-[52vh] overflow-auto p-3 text-[12px] leading-6 text-lime-100 sm:p-4 sm:text-[13px]">
                  <code>{kpiSimpleSqlView.sql}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <ExportPreflightDialog
        open={Boolean(exportPreflight)}
        kind={exportPreflight?.kind ?? 'csv'}
        reportTitle={report.title}
        ceiling={exportRowCeiling(report.id)}
        loadedRows={filteredRows.length}
        onCancel={() => setExportPreflight(null)}
        onConfirm={() => {
          const kind = exportPreflight?.kind
          setExportPreflight(null)
          if (!kind) return
          void runConfirmedExport(kind, report, selectedSource, requestFilters, filteredRows, visibleColumns)
        }}
      />

    </main>
  )
}
