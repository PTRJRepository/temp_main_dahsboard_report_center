import { AsyncLocalStorage } from 'node:async_hooks'
import { NextRequest, NextResponse } from 'next/server'
import { getInventoryReport } from '@/lib/reports/inventory/config'
import { attachInventoryAnalytics, type InventoryAnalyticsContract } from '@/lib/reports/inventory/analytics-contract'
import { buildMonthlyStockAccountMovementAnalytics } from '@/lib/reports/inventory/monthly-stock-account-movement'
import { buildInventoryReportAnalytics } from '@/lib/reports/inventory/report-analytics'
import { accountingActualPeriodSelectSql, accountingToActualPeriod, actualToAccountingPeriod } from '@/lib/reports/accounting-period'
import {
  applyReportFilters,
  filtersFromSearchParams,
  normalizeInventoryAnalysisGroupFilters,
  validateReadOnlySql,
  type ReportFilterInput,
} from '@/lib/reports/report-filtering'
import {
  MOVEMENT_CATEGORY_ORDER,
  buildMovementCategoryBalancedRows,
  countMovementCategoryRows,
  isMovementCategoryField,
  movementAnalysisSqlCase,
  movementCategoryThresholdLabel,
  movementCategoryRankSqlCase,
  movementCategorySqlCase,
  normalizeMovementCategoryThresholds,
  type MovementCategoryThresholds,
} from '@/lib/reports/movement-category'
import {
  buildMovementPeriodMetadata,
  resolveMovementWindowScope,
  type MovementWindowScope,
} from '@/lib/reports/inventory/movement-period'
import { verifyToken } from '@/utils/jwt'
import {
  gatewayOverrideFromRequest,
  resolveSqlGatewayApiKey,
  resolveSqlGatewayBase,
  sqlGatewayQueryUrl,
} from '@/lib/reports/sql-gateway-config'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TOKEN =
  resolveSqlGatewayApiKey() ||
  process.env.SQL_GATEWAY_API_KEY ||
  '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'

type ReportSource = 'estate' | 'pabrik'

type QueryContext = {
  source: ReportSource
  sourceLabel: string
  server: string
  database: string
  dataSource: string
}

function databaseForServer(server: string) {
  if (process.env.DATABASE_NAME) return process.env.DATABASE_NAME
  if (server === 'SERVER_PROFILE_2') return 'db_ptrj'
  if (server === 'SERVER_PROFILE_3') return 'db_ptrj_mill'
  return 'db_ptrj'
}

function sourceToContext(source: ReportSource): QueryContext {
  const server = source === 'pabrik' ? 'SERVER_PROFILE_3' : 'SERVER_PROFILE_2'
  const database = databaseForServer(server)
  return {
    source,
    sourceLabel: source === 'pabrik' ? 'Pabrik' : 'Estate / Kebun',
    server,
    database,
    dataSource: source === 'pabrik' ? 'Pabrik Inventory DB (Live)' : 'Estate Inventory DB (Live)',
  }
}

function getSource(request: NextRequest): ReportSource {
  const raw = (request.nextUrl.searchParams.get('source') ?? '').trim().toLowerCase()
  return raw === 'pabrik' || raw === 'mill' || raw === 'factory' ? 'pabrik' : 'estate'
}

type DbRow = Record<string, unknown>

type GatewayResult = {
  success: boolean
  db?: string | null
  execution_ms?: number
  data?: {
    recordset?: DbRow[]
    rowsAffected?: number[]
  } | null
  error?: string | null
}

type ReportPayload = {
  title: string
  description: string
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart: DbRow[]
  metadata: DbRow
  analytics?: InventoryAnalyticsContract
}

type ReportHandlerOptions = { limit: number; limitAll?: boolean; search: string; ctx: QueryContext; stale: string; filters?: ReportFilterInput }
type ReportHandler = (options: ReportHandlerOptions) => Promise<ReportPayload>

type DebugSqlStatement = {
  label: string
  server: string
  database: string
  sql: string
  rows: number
  executionMs?: number
  readOnly: true
}

type PaginationState = {
  page: number
  pageSize: number
}

const TABLE_WINDOW_ROW_LIMIT = 20000
const debugSqlStorage = new AsyncLocalStorage<DebugSqlStatement[]>()
const gatewayBaseStorage = new AsyncLocalStorage<string | null>()

function wantsDebugSql(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('debugSql') ?? '').trim().toLowerCase()
  return raw === '1' || raw === 'true' || raw === 'yes'
}

function isAdminDebugRequest(request: NextRequest) {
  if (!wantsDebugSql(request)) return false
  const token =
    request.cookies.get('auth-token')?.value ||
    request.cookies.get('payroll_auth_token')?.value
  if (!token) return false

  try {
    const payload = verifyToken(token)
    return String(payload?.role ?? '').toUpperCase() === 'ADMIN'
  } catch {
    return false
  }
}

function classifySqlStatement(sql: string) {
  const text = compactSql(sql)
  if (/\bSELECT\s+TOP\s+\d+\s+\*\s+FROM\s+report_rows\b/i.test(text)) return 'detail'
  if (/\bSELECT\s+TOP\s+\d+[\s\S]*(\bDimensionId\b|\bAS\s+Label\b|\bGROUP\s+BY\b)/i.test(text)) return 'chart-or-breakdown'
  if (/\bCOUNT\(\*\)\s+AS\s+TotalItem\b/i.test(text) || /\bSELECT\s+COUNT\b/i.test(text)) return 'summary'
  if (/\bGROUP\s+BY\b/i.test(text) || /\bDimensionId\b/i.test(text) || /\bLabel\b/i.test(text)) return 'chart-or-breakdown'
  if (/\bSELECT\s+TOP\b/i.test(text)) return 'detail'
  return 'query'
}

function compactSql(sql: string) {
  return sql.replace(/[ \t]+$/gm, '').trim()
}

function wantsAllRows(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get('limit') ?? '').trim().toLowerCase()
  return raw === 'all' || raw === 'semua' || raw === '*'
}

function getPage(request: NextRequest) {
  const raw = Number(request.nextUrl.searchParams.get('page') ?? 1)
  if (!Number.isFinite(raw)) return 1
  return Math.max(1, Math.trunc(raw))
}

function getPageSize(request: NextRequest, max = 500) {
  const raw = Number(request.nextUrl.searchParams.get('pageSize') ?? request.nextUrl.searchParams.get('limit') ?? 100)
  if (!Number.isFinite(raw)) return 100
  return Math.min(Math.max(Math.trunc(raw), 5), max)
}

function getTableSort(request: NextRequest) {
  const column = sanitizeLike(request.nextUrl.searchParams.get('tableSortColumn') ?? '')
  const direction: 'asc' | 'desc' = request.nextUrl.searchParams.get('tableSortDirection') === 'asc' ? 'asc' : 'desc'
  return { column: column || undefined, direction }
}

function sanitizeLike(value: string) {
  return value.trim().replace(/'/g, "''").slice(0, 80)
}

function cleanInventoryCode(value?: string) {
  const cleaned = sanitizeLike(value ?? '').toUpperCase()
  return /^[A-Z0-9_.-]{1,40}$/.test(cleaned) ? cleaned : ''
}

const monthlyAnalysisGroups = {
  StockAnalysisCode: { dimensionId: 'stock-analysis', label: 'Stock Analysis Code', sql: 'StockAnalysisCode', nameSql: 'StockAnalysisName' },
  ProductTypeCode: { dimensionId: 'product-type', label: 'Product Type Code', sql: 'ProductTypeCode', nameSql: 'ProductTypeDescription' },
  ProductCategoryCode: { dimensionId: 'product-category', label: 'Product Category Code', sql: 'ProductCategoryCode', nameSql: undefined },
  ProductBrandCode: { dimensionId: 'product-brand', label: 'Product Brand Code', sql: 'ProductBrandCode', nameSql: undefined },
  ProductModelCode: { dimensionId: 'product-model', label: 'Product Model Code', sql: 'ProductModelCode', nameSql: undefined },
  ProductMaterialCode: { dimensionId: 'product-material', label: 'Product Material Code', sql: 'ProductMaterialCode', nameSql: undefined },
  Location: { dimensionId: 'location', label: 'Location', sql: 'Location', nameSql: undefined },
  MovementCategory: { dimensionId: 'movement-category', label: 'Actual Movement Category', sql: 'MovementCategory', nameSql: undefined },
} as const

type MonthlyAnalysisGroupKey = keyof typeof monthlyAnalysisGroups

function cleanMonthlyAnalysisGroup(value?: string): MonthlyAnalysisGroupKey {
  const normalized = String(value ?? '').trim()
  return Object.prototype.hasOwnProperty.call(monthlyAnalysisGroups, normalized)
    ? (normalized as MonthlyAnalysisGroupKey)
    : 'StockAnalysisCode'
}

function cleanMonthlyMovementCategory(value?: string) {
  const normalized = String(value ?? '').trim().toLowerCase()
  return MOVEMENT_CATEGORY_ORDER.find((category) => category.toLowerCase() === normalized) ?? ''
}

const monthlyStockMovementChartMetricSelect = `
      COUNT(*) AS TotalItem,
      CAST(SUM(QtyOnHand) AS DECIMAL(18,2)) AS QtyOnHand,
      CAST(SUM(QtyOnHold) AS DECIMAL(18,2)) AS QtyOnHold,
      CAST(SUM(QtyOnHandHold) AS DECIMAL(18,2)) AS QtyOnHandHold,
      CAST(SUM(OnHandHoldAmount) AS DECIMAL(18,2)) AS OnHandHoldAmount,
      CAST(SUM(OpeningQty) AS DECIMAL(18,2)) AS OpeningQty,
      CAST(SUM(OpeningAmount) AS DECIMAL(18,2)) AS OpeningAmount,
      CAST(SUM(ReceivedQty) AS DECIMAL(18,2)) AS ReceivedQty,
      CAST(SUM(ReceivedAmount) AS DECIMAL(18,2)) AS ReceivedAmount,
      CAST(SUM(ReturnAdviceQty) AS DECIMAL(18,2)) AS ReturnAdviceQty,
      CAST(SUM(ReturnAdviceAmount) AS DECIMAL(18,2)) AS ReturnAdviceAmount,
      CAST(SUM(TransferredQty) AS DECIMAL(18,2)) AS TransferredQty,
      CAST(SUM(TransferredAmount) AS DECIMAL(18,2)) AS TransferredAmount,
      CAST(SUM(AdjustmentQty) AS DECIMAL(18,2)) AS AdjustmentQty,
      CAST(SUM(AdjustmentAmount) AS DECIMAL(18,2)) AS AdjustmentAmount,
      CAST(SUM(LedgerQty) AS DECIMAL(18,2)) AS LedgerQty,
      CAST(SUM(LedgerAmount) AS DECIMAL(18,2)) AS LedgerAmount,
      CAST(SUM(IssuedStationQty) AS DECIMAL(18,2)) AS IssuedStationQty,
      CAST(SUM(IssuedStationAmount) AS DECIMAL(18,2)) AS IssuedStationAmount,
      CAST(SUM(IssuedVehicleQty) AS DECIMAL(18,2)) AS IssuedVehicleQty,
      CAST(SUM(IssuedVehicleAmount) AS DECIMAL(18,2)) AS IssuedVehicleAmount,
      CAST(SUM(IssuedTotalQty) AS DECIMAL(18,2)) AS IssuedTotalQty,
      CAST(SUM(IssuedTotalAmount) AS DECIMAL(18,2)) AS IssuedTotalAmount,
      CAST(SUM(ReturnQty) AS DECIMAL(18,2)) AS ReturnQty,
      CAST(SUM(ReturnAmount) AS DECIMAL(18,2)) AS ReturnAmount,
      CAST(SUM(GoodsReceiveQty) AS DECIMAL(18,2)) AS GoodsReceiveQty,
      CAST(SUM(GoodsReceiveAmount) AS DECIMAL(18,2)) AS GoodsReceiveAmount,
      CAST(SUM(GoodsReturnQty) AS DECIMAL(18,2)) AS GoodsReturnQty,
      CAST(SUM(GoodsReturnAmount) AS DECIMAL(18,2)) AS GoodsReturnAmount,
      CAST(SUM(DispatchAdvQty) AS DECIMAL(18,2)) AS DispatchAdvQty,
      CAST(SUM(DispatchAdvAmount) AS DECIMAL(18,2)) AS DispatchAdvAmount,
      CAST(SUM(ClosingQty) AS DECIMAL(18,2)) AS ClosingQty,
      CAST(SUM(ClosingAmount) AS DECIMAL(18,2)) AS ClosingAmount,
      CAST(SUM(ClosingQty) AS DECIMAL(18,2)) AS Qty,
      CAST(SUM(ClosingAmount) AS DECIMAL(18,2)) AS Amount,
      CAST(SUM(IssuedTotalAmount) AS DECIMAL(18,2)) AS IssuedAmount,
      CAST(SUM(MovementActivityCountActual) AS DECIMAL(18,2)) AS MovementActivityCountActual,
      CAST(SUM(MovementActivityQtyActual) AS DECIMAL(18,2)) AS MovementActivityQtyActual,
      CAST(SUM(MovementActivityAmountActual) AS DECIMAL(18,2)) AS MovementActivityAmountActual,
      CAST(SUM(StockIssueMovementCount) AS DECIMAL(18,2)) AS StockIssueMovementCount,
      CAST(SUM(StockIssueMovementQty) AS DECIMAL(18,2)) AS StockIssueMovementQty,
      CAST(SUM(StockIssueMovementAmount) AS DECIMAL(18,2)) AS StockIssueMovementAmount,
      CAST(SUM(MovementIssueCountActual) AS DECIMAL(18,2)) AS MovementIssueCountActual,
      CAST(SUM(MovementIssueQtyActual) AS DECIMAL(18,2)) AS MovementIssueQtyActual,
      CAST(SUM(MovementIssueAmountActual) AS DECIMAL(18,2)) AS MovementIssueAmountActual`

function cleanWarehouseItemTypeScope(value?: string) {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === '1' || normalized === 'gudang' || normalized === 'stock') return '1'
  if (normalized === '4' || normalized === 'workshop' || normalized === 'mesin') return '4'
  return ''
}

function cleanSqlDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return value
}

function monthBounds(period?: string) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return {}
  const [year, month] = period.split('-').map(Number)
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  return {
    from: `${year}-${String(month).padStart(2, '0')}-01`,
    toExclusive: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

function formatPeriod(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function resolveActualAccountingPeriod(period?: string) {
  const match = period?.trim().match(/^(\d{4})-(\d{2})(?:-\d{2})?$/)
  const parsed = match ? actualToAccountingPeriod(Number(match[1]), Number(match[2])) : null
  if (parsed) return parsed

  const now = new Date()
  const fallback = actualToAccountingPeriod(now.getFullYear(), now.getMonth() + 1)
  if (!fallback) throw new Error('Periode aktual tidak valid')
  return fallback
}

function previousAccountingPeriod(accYear: number, accMonth: number) {
  if (accMonth <= 1) return { accYear: accYear - 1, accMonth: 12 }
  return { accYear, accMonth: accMonth - 1 }
}

function resolveAssetValuationPeriod(filters?: ReportFilterInput) {
  // Prefer explicit actual calendar period (period=YYYY-MM or actualYear+actualMonth)
  // so leftover AccYear/AccMonth in URL cannot override user month picker.
  const rawPeriod = filters?.period?.trim()
  const actualMatch = rawPeriod?.match(/^(\d{4})-(\d{1,2})(?:-\d{2})?$/)
  const fromActualPeriod = actualMatch
    ? actualToAccountingPeriod(Number(actualMatch[1]), Number(actualMatch[2]))
    : null
  if (fromActualPeriod) {
    return {
      ...fromActualPeriod,
      actualPeriod: formatPeriod(fromActualPeriod.actualYear, fromActualPeriod.actualMonth),
      accountingPeriod: formatPeriod(fromActualPeriod.accYear, fromActualPeriod.accMonth),
      requested: true,
      inputMode: 'actual' as const,
    }
  }

  const fromActualFields = filters?.actualYear && filters?.actualMonth
    ? actualToAccountingPeriod(filters.actualYear, filters.actualMonth)
    : null
  if (fromActualFields) {
    return {
      ...fromActualFields,
      actualPeriod: formatPeriod(fromActualFields.actualYear, fromActualFields.actualMonth),
      accountingPeriod: formatPeriod(fromActualFields.accYear, fromActualFields.accMonth),
      requested: true,
      inputMode: 'actual' as const,
    }
  }

  const accountingMatch = rawPeriod?.match(/^(?:acc|accounting)[:/-](\d{4})-(\d{1,2})$/i)
  const fromAccountingPeriod = accountingMatch
    ? accountingToActualPeriod(Number(accountingMatch[1]), Number(accountingMatch[2]))
    : null
  if (fromAccountingPeriod) {
    return {
      ...fromAccountingPeriod,
      actualPeriod: formatPeriod(fromAccountingPeriod.actualYear, fromAccountingPeriod.actualMonth),
      accountingPeriod: formatPeriod(fromAccountingPeriod.accYear, fromAccountingPeriod.accMonth),
      requested: true,
      inputMode: 'accounting' as const,
    }
  }

  const fromAccountingFields = filters?.accYear && filters?.accMonth
    ? accountingToActualPeriod(filters.accYear, filters.accMonth)
    : null
  if (fromAccountingFields) {
    return {
      ...fromAccountingFields,
      actualPeriod: formatPeriod(fromAccountingFields.actualYear, fromAccountingFields.actualMonth),
      accountingPeriod: formatPeriod(fromAccountingFields.accYear, fromAccountingFields.accMonth),
      requested: true,
      inputMode: 'accounting' as const,
    }
  }

  const now = new Date()
  const fallback = actualToAccountingPeriod(now.getFullYear(), now.getMonth() + 1)
  if (!fallback) throw new Error('Periode valuation listing tidak valid')
  return {
    ...fallback,
    actualPeriod: formatPeriod(fallback.actualYear, fallback.actualMonth),
    accountingPeriod: formatPeriod(fallback.accYear, fallback.accMonth),
    requested: false,
    inputMode: 'current' as const,
  }
}

function cleanLocationCode(value?: string) {
  const code = sanitizeLike(value ?? '').trim().toUpperCase()
  return code || 'PTRJ'
}

function goodReceiptSqlScope(filters?: ReportFilterInput) {
  const month = monthBounds(filters?.period)
  const dateFrom = cleanSqlDate(filters?.dateFrom) ?? month.from
  const dateTo = cleanSqlDate(filters?.dateTo)
  const clauses = ["h.CreateDate >= '2000-01-01'"]
  const applied: Record<string, string> = { dateField: 'PU_GOODSRCV.CreateDate' }

  if (dateFrom) {
    clauses.push(`h.CreateDate >= '${dateFrom}'`)
    applied.dateFrom = dateFrom
  }

  if (dateTo) {
    clauses.push(`h.CreateDate < DATEADD(DAY, 1, CONVERT(date, '${dateTo}'))`)
    applied.dateTo = dateTo
  } else if (month.toExclusive) {
    clauses.push(`h.CreateDate < '${month.toExclusive}'`)
    applied.dateToExclusive = month.toExclusive
  }

  const location = sanitizeLike(filters?.location ?? '')
  if (location) {
    clauses.push(`RTRIM(h.LocCode) LIKE '%${location}%'`)
    applied.location = location
  }

  return {
    whereSql: `WHERE ${clauses.join('\n      AND ')}`,
    applied,
  }
}

function itemSearch(alias: string, search: string) {
  const q = sanitizeLike(search)
  if (!q) return ''
  return `AND (RTRIM(${alias}.ItemCode) LIKE '%${q}%' OR RTRIM(${alias}.Description) LIKE N'%${q}%')`
}

function warehouseInventoryItemTypeExpression(alias = '') {
  const prefix = alias ? `${alias}.` : ''
  return `RTRIM(CONVERT(varchar(10), ${prefix}ItemType))`
}

function warehouseInventoryItemTypeFilter(alias = '') {
  const prefix = alias ? `${alias}.` : ''
  return `AND ${prefix}ItemType IN ('1', '4')`
}

function nonWorkshopItemTypeFilter(alias = 'i') {
  return `AND ISNULL(${warehouseInventoryItemTypeExpression(alias)}, '') <> '4'`
}

function workshopStockIssueDateExpression(alias = 's') {
  return `COALESCE(NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), ${alias}.TransDate)`
}

function workshopStockIssueDocumentExpression(alias = 's') {
  return `COALESCE(
            NULLIF(RTRIM(CONVERT(varchar(50), ${alias}.JobStockIssueID)), ''),
            NULLIF(RTRIM(CONVERT(varchar(50), ${alias}.JobStockID)), ''),
            NULLIF(RTRIM(CONVERT(varchar(50), ${alias}.JobID)), '')
          )`
}

function workshopStockIssueAmountExpression(alias = 's') {
  return `COALESCE(${alias}.Amount, ${alias}.PriceAmount, ISNULL(${alias}.Qty, 0) * ISNULL(${alias}.Price, 0), 0)`
}

function fuelIssueDocumentDateExpression(alias = 'h') {
  return `COALESCE(NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), ${alias}.FuelIssueRefDate, ${alias}.UpdateDate, ${alias}.CreateDate)`
}

function fuelIssueStatusFilter(alias = 'h') {
  return `AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '6')`
}

function workshopStockIssueItemTypeExpression(itemAlias = 'i', stockAlias = 's') {
  return `COALESCE(
            NULLIF(RTRIM(CONVERT(varchar(10), ${itemAlias}.ItemType)), ''),
            NULLIF(RTRIM(CONVERT(varchar(10), ${stockAlias}.ItemType)), '')
          )`
}

function quantityClosingExpression(alias = '') {
  const prefix = alias ? `${alias}.` : ''
  return `(ISNULL(${prefix}QtyOnHand, 0) + ISNULL(${prefix}QtyOnHold, 0) + ISNULL(${prefix}QtyOnOrder, 0))`
}

function inventoryTaxonomyScopeFilter(alias: string, filters?: ReportFilterInput) {
  const productType = cleanInventoryCode(filters?.productType)
  const productCategory = cleanInventoryCode(filters?.productCategory)
  const productBrand = cleanInventoryCode(filters?.productBrand)
  const productModel = cleanInventoryCode(filters?.productModel)
  const productMaterial = cleanInventoryCode(filters?.productMaterial)
  const stockAnalysis = cleanInventoryCode(filters?.stockAnalysis)
  const clauses = [
    productType ? `RTRIM(ISNULL(${alias}.ProdTypeCode, '')) = '${productType}'` : '',
    productCategory ? `RTRIM(ISNULL(${alias}.ProdCatCode, '')) = '${productCategory}'` : '',
    productBrand ? `RTRIM(ISNULL(${alias}.ProdBrandCode, '')) = '${productBrand}'` : '',
    productModel ? `RTRIM(ISNULL(${alias}.ProdModelCode, '')) = '${productModel}'` : '',
    productMaterial ? `RTRIM(ISNULL(${alias}.ProdMatCode, '')) = '${productMaterial}'` : '',
    stockAnalysis ? `RTRIM(ISNULL(${alias}.StockAnalysisCode, '')) = '${stockAnalysis}'` : '',
  ].filter(Boolean)

  return clauses.map((clause) => `AND ${clause}`).join('\n        ')
}

function inventoryGenericCategoryScopeFilter(alias: string, filters?: ReportFilterInput) {
  const category = sanitizeLike(filters?.category ?? '')
  if (!category) return ''
  return `AND (
        RTRIM(ISNULL(${alias}.ProdCatCode, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(${alias}.ProdTypeCode, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(${alias}.StockAnalysisCode, '')) LIKE N'%${category}%'
      )`
}

function inventoryItemTypeScopeFilter(alias: string, filters?: ReportFilterInput) {
  const itemTypeScope = cleanWarehouseItemTypeScope(filters?.itemType)
  if (itemTypeScope === '1') return `AND ${warehouseInventoryItemTypeExpression(alias)} = '1'`
  if (itemTypeScope === '4') return `AND ${warehouseInventoryItemTypeExpression(alias)} = '4'`
  return ''
}

function inventoryItemScopeExistsFilter(database: string, itemCodeSql: string, locCodeSql: string, filters?: ReportFilterInput) {
  const taxonomy = inventoryTaxonomyScopeFilter('itemScope', filters)
  const category = inventoryGenericCategoryScopeFilter('itemScope', filters)
  const itemType = inventoryItemTypeScopeFilter('itemScope', filters)
  if (!taxonomy && !category && !itemType) return ''

  return `AND EXISTS (
      SELECT 1
      FROM [${database}].[dbo].[IN_ITEM] itemScope
      WHERE itemScope.ItemCode = ${itemCodeSql}
        AND itemScope.LocCode = ${locCodeSql}
        ${itemType}
        ${taxonomy}
        ${category}
    )`
}

function movementWindowFromFilters(filters?: ReportFilterInput): MovementWindowScope {
  return resolveMovementWindowScope({
    movementWindow: filters?.movementWindow,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    period: filters?.period,
  })
}

function movementThresholdsFromFilters(filters?: ReportFilterInput): MovementCategoryThresholds {
  return normalizeMovementCategoryThresholds({
    fastMinIssueCount: filters?.movementFastMin,
    movingMinIssueCount: filters?.movementMovingMin,
    movingMaxIssueCount: filters?.movementMovingMax,
    slowIssueCount: filters?.movementSlowCount,
  })
}

function stockIssueDateBoundsSql(windowScope: MovementWindowScope, dateExpression: string) {
  return `${dateExpression} >= '${windowScope.startInclusive}'
            AND ${dateExpression} < '${windowScope.endExclusive}'`
}
function stockIssueUsageApply(
  database: string,
  itemAlias = 'i',
  windowScope: MovementWindowScope = resolveMovementWindowScope(),
) {
  const itemType = warehouseInventoryItemTypeExpression(itemAlias)
  const workshopDate = workshopStockIssueDateExpression('s')
  const workshopDoc = workshopStockIssueDocumentExpression('s')
  const workshopAmount = workshopStockIssueAmountExpression('s')
  const issueDocsSql = `
          SELECT
            RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS StockIssueID,
            h.PostDate AS PostDate,
            l.Qty AS Qty,
            l.Amount AS Amount
          FROM [${database}].[dbo].[IN_STOCKISSUELN] l
          INNER JOIN [${database}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
          WHERE ISNULL(${itemType}, '') <> '4'
            AND l.ItemCode = ${itemAlias}.ItemCode
            AND h.LocCode = ${itemAlias}.LocCode
            AND ${stockIssueDateBoundsSql(windowScope, 'h.PostDate')}
          UNION ALL
          SELECT
            ${workshopDoc} AS StockIssueID,
            ${workshopDate} AS PostDate,
            s.Qty AS Qty,
            ${workshopAmount} AS Amount
          FROM [${database}].[dbo].[WS_JOBSTOCK] s
          WHERE ${itemType} = '4'
            AND RTRIM(ISNULL(s.TransType, '')) = '1'
            AND s.ItemCode = ${itemAlias}.ItemCode
            AND s.LocCode = ${itemAlias}.LocCode
            AND ${stockIssueDateBoundsSql(windowScope, workshopDate)}`

  return `
    OUTER APPLY (
      SELECT
        COUNT(DISTINCT issueDocs.StockIssueID) AS StockIssueEventCount,
        CAST(SUM(ISNULL(issueDocs.Qty, 0)) AS DECIMAL(18,2)) AS StockIssueQtyAllPeriod,
        CAST(SUM(ISNULL(issueDocs.Amount, 0)) AS DECIMAL(18,2)) AS StockIssueAmountAllPeriod,
        MAX(issueDocs.PostDate) AS LastStockIssueDate
      FROM (
${issueDocsSql}
      ) issueDocs
    ) issueUsage
    OUTER APPLY (
      SELECT
        COUNT(DISTINCT issueDocs.StockIssueID) AS MovementEventCountAll,
        CAST(SUM(ISNULL(issueDocs.Qty, 0)) AS DECIMAL(18,2)) AS MovementQtyAll,
        CAST(SUM(ISNULL(issueDocs.Amount, 0)) AS DECIMAL(18,2)) AS MovementAmountAll
      FROM (
${issueDocsSql}
      ) issueDocs
    ) movement12
    OUTER APPLY (
      SELECT
        MAX(CASE WHEN rn = 1 THEN EventText END) AS MovementEvent1,
        MAX(CASE WHEN rn = 2 THEN EventText END) AS MovementEvent2,
        MAX(CASE WHEN rn = 1 THEN PostDate END) AS LastMovementDate
      FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY issueDocs.PostDate DESC, issueDocs.StockIssueID DESC) AS rn,
          issueDocs.PostDate,
          CONCAT(
            RTRIM(issueDocs.StockIssueID),
            ' | ',
            CONVERT(varchar(10), issueDocs.PostDate, 23),
            ' | Qty ',
            CONVERT(varchar(30), CAST(ISNULL(issueDocs.Qty, 0) AS DECIMAL(18,2))),
            ' | Amount ',
            CONVERT(varchar(30), CAST(ISNULL(issueDocs.Amount, 0) AS DECIMAL(18,2)))
          ) AS EventText
        FROM (
          SELECT TOP 2
            issueDocs.StockIssueID,
            issueDocs.PostDate,
            SUM(ISNULL(issueDocs.Qty, 0)) AS Qty,
            SUM(ISNULL(issueDocs.Amount, 0)) AS Amount
          FROM (
${issueDocsSql}
          ) issueDocs
          GROUP BY issueDocs.StockIssueID, issueDocs.PostDate
          ORDER BY issueDocs.PostDate DESC, issueDocs.StockIssueID DESC
        ) issueDocs
      ) latestIssueRows
    ) latestMovement
    OUTER APPLY (
      SELECT
        MAX(CASE WHEN rn = 1 THEN EventText END) AS StockIssueEvent1,
        MAX(CASE WHEN rn = 2 THEN EventText END) AS StockIssueEvent2
      FROM (
        SELECT
          ROW_NUMBER() OVER (ORDER BY issueDocs.PostDate DESC, issueDocs.StockIssueID DESC) AS rn,
          CONCAT(
            RTRIM(issueDocs.StockIssueID),
            ' | ',
            CONVERT(varchar(10), issueDocs.PostDate, 23),
            ' | Qty ',
            CONVERT(varchar(30), CAST(ISNULL(issueDocs.Qty, 0) AS DECIMAL(18,2))),
            ' | Amount ',
            CONVERT(varchar(30), CAST(ISNULL(issueDocs.Amount, 0) AS DECIMAL(18,2)))
          ) AS EventText
        FROM (
          SELECT TOP 2
            issueDocs.StockIssueID,
            issueDocs.PostDate,
            SUM(ISNULL(issueDocs.Qty, 0)) AS Qty,
            SUM(ISNULL(issueDocs.Amount, 0)) AS Amount
          FROM (
${issueDocsSql}
          ) issueDocs
          GROUP BY issueDocs.StockIssueID, issueDocs.PostDate
          ORDER BY issueDocs.PostDate DESC, issueDocs.StockIssueID DESC
        ) issueDocs
      ) issueEventRows
    ) issueEvents`
}

function stockIssueUsageColumns(
  quantityExpression?: string,
  thresholds: MovementCategoryThresholds = movementThresholdsFromFilters(),
) {
  const movementEventCount = 'ISNULL(movement12.MovementEventCountAll, 0)'
  const movementGap = quantityExpression
    ? `CAST(${quantityExpression} - ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS MovementGapQty,
      ${movementCategorySqlCase(movementEventCount, quantityExpression, thresholds)} AS MovementCategory,
      CASE
        WHEN ${quantityExpression} = 0 AND ISNULL(movement12.MovementEventCountAll, 0) = 0 THEN 'Stok nol, tidak ada movement valid'
        WHEN latestMovement.LastMovementDate IS NULL THEN 'Tidak ada movement valid'
        WHEN latestMovement.LastMovementDate <= DATEADD(YEAR, -2, GETDATE()) THEN 'Dead movement > 24 bulan'
        WHEN ISNULL(movement12.MovementEventCountAll, 0) > 0 AND DATEDIFF(MONTH, ISNULL(latestMovement.LastMovementDate, GETDATE()), GETDATE()) <= 12 THEN 'Stale check: movement masih ada'
        ELSE 'Stale check: movement rendah'
      END AS StaleMovementRelation,`
    : ''

  return `CAST(ISNULL(issueUsage.StockIssueEventCount, 0) AS INT) AS StockIssueEventCount,
      CAST(ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueQtyAllPeriod,
      CAST(ISNULL(issueUsage.StockIssueAmountAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueAmountAllPeriod,
      issueUsage.LastStockIssueDate,
      CAST(ISNULL(movement12.MovementEventCountAll, 0) AS INT) AS MovementEventCountAll,
      CAST(ISNULL(movement12.MovementQtyAll, 0) AS DECIMAL(18,2)) AS MovementQtyAll,
      CAST(ISNULL(movement12.MovementAmountAll, 0) AS DECIMAL(18,2)) AS MovementAmountAll,
      latestMovement.LastMovementDate,
      CASE WHEN latestMovement.LastMovementDate IS NULL THEN NULL ELSE DATEDIFF(DAY, latestMovement.LastMovementDate, GETDATE()) END AS MovementAgeDays,
      ${movementGap}
      latestMovement.MovementEvent1,
      latestMovement.MovementEvent2,
      issueEvents.StockIssueEvent1,
      issueEvents.StockIssueEvent2`
}

function stockMovementAnalysisColumns(
  quantityExpression: string,
  thresholds: MovementCategoryThresholds = movementThresholdsFromFilters(),
) {
  const issueCount = 'ISNULL(issueUsage.StockIssueEventCount, 0)'
  return `CAST(ISNULL(issueUsage.StockIssueEventCount, 0) AS INT) AS StockIssueMovementCount,
      CAST(ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueMovementQty,
      CAST(ISNULL(issueUsage.StockIssueAmountAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueMovementAmount,
      issueUsage.LastStockIssueDate AS LastStockIssueMovementDate,
      latestMovement.LastMovementDate AS LastMovementDate,
      CAST(${quantityExpression} - ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueMovementGapQty,
      ${movementCategorySqlCase(issueCount, quantityExpression, thresholds)} AS MovementCategory,
      ${movementAnalysisSqlCase(issueCount, quantityExpression, thresholds)} AS MovementAnalysis,
      latestMovement.MovementEvent1 AS StockIssueMovementEvent1,
      latestMovement.MovementEvent2 AS StockIssueMovementEvent2,
      CAST(ISNULL(issueUsage.StockIssueEventCount, 0) AS INT) AS StockIssueEventCount,
      CAST(ISNULL(issueUsage.StockIssueEventCount, 0) AS INT) AS JumlahStockIssue,
      CAST(ISNULL(issueUsage.StockIssueEventCount, 0) AS INT) AS MovementEventCountAll,
      CAST(ISNULL(issueUsage.StockIssueEventCount, 0) AS INT) AS JumlahMovement,
      CAST(ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueQtyAllPeriod,
      CAST(ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS JumlahQtyStockIssue,
      CAST(ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS MovementQtyAll,
      CAST(ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS JumlahQtyMovement,
      CAST(ISNULL(issueUsage.StockIssueAmountAllPeriod, 0) AS DECIMAL(18,2)) AS StockIssueAmountAllPeriod,
      CAST(ISNULL(issueUsage.StockIssueAmountAllPeriod, 0) AS DECIMAL(18,2)) AS JumlahAmountStockIssue,
      CAST(ISNULL(issueUsage.StockIssueAmountAllPeriod, 0) AS DECIMAL(18,2)) AS MovementAmountAll,
      CAST(ISNULL(issueUsage.StockIssueAmountAllPeriod, 0) AS DECIMAL(18,2)) AS JumlahAmountMovement,
      issueUsage.LastStockIssueDate,
      CAST(${quantityExpression} - ISNULL(issueUsage.StockIssueQtyAllPeriod, 0) AS DECIMAL(18,2)) AS MovementGapQty,
      latestMovement.MovementEvent1,
      latestMovement.MovementEvent2,
      issueEvents.StockIssueEvent1,
      issueEvents.StockIssueEvent2,
      CASE
        WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 AND ${quantityExpression} > 0 THEN 100
        WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 80
        WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 1 THEN 50
        WHEN ISNULL(issueUsage.StockIssueEventCount, 0) BETWEEN 2 AND 5 THEN 20
        ELSE 10
      END AS RiskScore`
}

function shouldUseMovementCategoryWindow(filters?: ReportFilterInput) {
  if (filters?.groupBy) return isMovementCategoryField(filters.groupBy)
  if (filters?.chartDimension) return isMovementCategoryField(filters.chartDimension)
  return false
}

function movementCategoryLoadedGroups(rowsData: DbRow[]) {
  const counts = countMovementCategoryRows(rowsData)
  return MOVEMENT_CATEGORY_ORDER
    .filter((category) => counts[category] !== undefined)
    .join(', ')
}

function numericRowValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const numeric = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(numeric) ? numeric : 0
  }
  return 0
}

function textSearch(search: string, fields: string[]) {
  const q = sanitizeLike(search)
  if (!q) return ''
  return `AND (${fields.map((field) => `RTRIM(${field}) LIKE N'%${q}%'`).join(' OR ')})`
}

const stockAccountMovementAnalysisCodes = ['DEADS', 'MEMOV', 'SLMOV']

function cleanStockAccountMovementAnalysisCode(value?: string) {
  const code = sanitizeLike(value ?? '').trim().toUpperCase()
  return stockAccountMovementAnalysisCodes.includes(code) ? code : ''
}

function accountingPeriodFilter(alias: string, accYear: number, accMonth: number) {
  return `
      AND RTRIM(CONVERT(varchar(10), ${alias}.AccYear)) = '${accYear}'
      AND RTRIM(CONVERT(varchar(10), ${alias}.AccMonth)) = '${accMonth}'`
}

function cleanTransactionAsOf(value?: string) {
  const raw = sanitizeLike(value ?? '').trim().replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T23:59:59`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return raw
  return ''
}

function transactionAsOfFilter(alias: string, transactionAsOf: string) {
  return transactionAsOf ? `AND COALESCE(${alias}.UpdateDate, ${alias}.CreateDate) <= CONVERT(datetime, '${transactionAsOf}', 126)` : ''
}

function monthlyStockAccountMovementCtes({
  database,
  location,
  reportAccYear,
  reportAccMonth,
  openingAccYear,
  openingAccMonth,
  actualPeriod,
  openingActualPeriod,
  search,
  stockAnalysisCode,
  productTypeCode,
  productCategoryCode,
  productBrandCode,
  productModelCode,
  productMaterialCode,
  itemTypeScope,
  stockAnalysisDefaultScope,
  rowNumberPartitionSql,
  transactionAsOf,
  movementWindow,
  movementThresholds,
}: {
  database: string
  location: string
  reportAccYear: number
  reportAccMonth: number
  openingAccYear: number
  openingAccMonth: number
  actualPeriod: string
  openingActualPeriod: string
  search: string
  stockAnalysisCode: string
  productTypeCode: string
  productCategoryCode: string
  productBrandCode: string
  productModelCode: string
  productMaterialCode: string
  itemTypeScope: string
  stockAnalysisDefaultScope: boolean
  rowNumberPartitionSql: string
  transactionAsOf: string
  movementWindow: MovementWindowScope
  movementThresholds: MovementCategoryThresholds
}) {
  const reportAccountingPeriod = formatPeriod(reportAccYear, reportAccMonth)
  const openingAccountingPeriod = formatPeriod(openingAccYear, openingAccMonth)
  const analysisFilter = stockAnalysisCode
    ? `AND RTRIM(i.StockAnalysisCode) = '${stockAnalysisCode}'`
    : stockAnalysisDefaultScope
      ? "AND RTRIM(i.StockAnalysisCode) IN ('DEADS', 'MEMOV', 'SLMOV')"
      : ''
  const productTypeFilter = productTypeCode ? `AND RTRIM(ISNULL(i.ProdTypeCode, '')) = '${productTypeCode}'` : ''
  const productCategoryFilter = productCategoryCode ? `AND RTRIM(ISNULL(i.ProdCatCode, '')) = '${productCategoryCode}'` : ''
  const productBrandFilter = productBrandCode ? `AND RTRIM(ISNULL(i.ProdBrandCode, '')) = '${productBrandCode}'` : ''
  const productModelFilter = productModelCode ? `AND RTRIM(ISNULL(i.ProdModelCode, '')) = '${productModelCode}'` : ''
  const productMaterialFilter = productMaterialCode ? `AND RTRIM(ISNULL(i.ProdMatCode, '')) = '${productMaterialCode}'` : ''
  // GUARDRAIL(monthly-valuation-itemtype):
  // Default Report Center valuation must include both warehouse stock and workshop/mesin.
  // Do not change the default back to ItemType = '1'. Use itemType=gudang/workshop
  // only when the user explicitly asks to isolate one side.
  const itemTypeFilter = itemTypeScope === '1'
    ? `AND ${warehouseInventoryItemTypeExpression('i')} = '1'`
    : itemTypeScope === '4'
      ? `AND ${warehouseInventoryItemTypeExpression('i')} = '4'`
      : `AND ${warehouseInventoryItemTypeExpression('i')} IN ('1', '4')`
  const whereSearch = textSearch(search, ['i.ItemCode', 'i.Description', 'i.StockAnalysisCode', "ISNULL(sa.Description, '')", 'i.ProdTypeCode', "ISNULL(pt.Description, '')"])
  const movementActivityCountExpression = `(
          CASE WHEN ABS(ISNULL(a.received_qty, 0)) > 0 OR ABS(ISNULL(a.received_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.return_advice_qty, 0)) > 0 OR ABS(ISNULL(a.return_advice_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.transferred_qty, 0)) > 0 OR ABS(ISNULL(a.transferred_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.adjustment_qty, 0)) > 0 OR ABS(ISNULL(a.adjustment_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.ledger_qty, 0)) > 0 OR ABS(ISNULL(a.ledger_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.issued_station_qty, 0)) > 0 OR ABS(ISNULL(a.issued_station_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.issued_vehicle_qty, 0)) > 0 OR ABS(ISNULL(a.issued_vehicle_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.return_qty, 0)) > 0 OR ABS(ISNULL(a.return_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.goods_receive_qty, 0)) > 0 OR ABS(ISNULL(a.goods_receive_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.goods_return_qty, 0)) > 0 OR ABS(ISNULL(a.goods_return_amt, 0)) > 0 THEN 1 ELSE 0 END +
          CASE WHEN ABS(ISNULL(a.dispatch_adv_qty, 0)) > 0 OR ABS(ISNULL(a.dispatch_adv_amt, 0)) > 0 THEN 1 ELSE 0 END
        )`
  const movementActivityQtyExpression = `(
          ABS(ISNULL(a.received_qty, 0)) +
          ABS(ISNULL(a.return_advice_qty, 0)) +
          ABS(ISNULL(a.transferred_qty, 0)) +
          ABS(ISNULL(a.adjustment_qty, 0)) +
          ABS(ISNULL(a.ledger_qty, 0)) +
          ABS(ISNULL(a.issued_station_qty, 0)) +
          ABS(ISNULL(a.issued_vehicle_qty, 0)) +
          ABS(ISNULL(a.return_qty, 0)) +
          ABS(ISNULL(a.goods_receive_qty, 0)) +
          ABS(ISNULL(a.goods_return_qty, 0)) +
          ABS(ISNULL(a.dispatch_adv_qty, 0))
        )`
  const movementActivityAmountExpression = `(
          ABS(ISNULL(a.received_amt, 0)) +
          ABS(ISNULL(a.return_advice_amt, 0)) +
          ABS(ISNULL(a.transferred_amt, 0)) +
          ABS(ISNULL(a.adjustment_amt, 0)) +
          ABS(ISNULL(a.ledger_amt, 0)) +
          ABS(ISNULL(a.issued_station_amt, 0)) +
          ABS(ISNULL(a.issued_vehicle_amt, 0)) +
          ABS(ISNULL(a.return_amt, 0)) +
          ABS(ISNULL(a.goods_receive_amt, 0)) +
          ABS(ISNULL(a.goods_return_amt, 0)) +
          ABS(ISNULL(a.dispatch_adv_amt, 0))
        )`
  const movementActualCountExpression = `(CASE WHEN ISNULL(mi.MovementIssueCountActual, 0) > 0 THEN ISNULL(mi.MovementIssueCountActual, 0) ELSE ${movementActivityCountExpression} END)`
  const movementActualQtyExpression = `(CASE WHEN ISNULL(mi.MovementIssueCountActual, 0) > 0 THEN ISNULL(mi.MovementIssueQtyActual, 0) ELSE ${movementActivityQtyExpression} END)`
  const movementActualAmountExpression = `(CASE WHEN ISNULL(mi.MovementIssueCountActual, 0) > 0 THEN ISNULL(mi.MovementIssueAmountActual, 0) ELSE ${movementActivityAmountExpression} END)`

  return `
    WITH base AS (
      SELECT
        RTRIM(i.ItemCode) AS ItemCode,
        RTRIM(i.Description) AS Description,
        RTRIM(i.UOMCode) AS UOM,
        RTRIM(i.LocCode) AS Location,
        ${warehouseInventoryItemTypeExpression('i')} AS ItemType,
        CASE ${warehouseInventoryItemTypeExpression('i')}
          WHEN '1' THEN 'Stock / Gudang'
          WHEN '4' THEN 'Workshop / Mesin'
          ELSE ISNULL(${warehouseInventoryItemTypeExpression('i')}, '-')
        END AS ItemTypeName,
        RTRIM(i.StockAnalysisCode) AS StockAnalysisCode,
        RTRIM(ISNULL(sa.Description, i.StockAnalysisCode)) AS StockAnalysisName,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductTypeCode,
        RTRIM(ISNULL(pt.Description, i.ProdTypeCode)) AS ProductTypeDescription,
        RTRIM(ISNULL(i.ProdCatCode, '')) AS ProductCategoryCode,
        RTRIM(ISNULL(i.ProdBrandCode, '')) AS ProductBrandCode,
        RTRIM(ISNULL(i.ProdModelCode, '')) AS ProductModelCode,
        RTRIM(ISNULL(i.ProdMatCode, '')) AS ProductMaterialCode,
        CAST(ISNULL(i.QtyOnHand, 0) AS decimal(18, 6)) AS QtyOnHand,
        CAST(ISNULL(i.QtyOnHold, 0) AS decimal(18, 6)) AS QtyOnHold,
        CAST(ISNULL(i.AverageCost, 0) AS decimal(18, 6)) AS AverageCost,
        CAST((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) * ISNULL(i.AverageCost, 0) AS decimal(18, 6)) AS OnHandHoldAmount
      FROM [${database}].[dbo].[IN_ITEM] i
      LEFT JOIN [${database}].[dbo].[IN_STOCKANALYSIS] sa
        ON sa.StockAnalysisCode = i.StockAnalysisCode
      LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt
        ON pt.ProdTypeCode = i.ProdTypeCode
      WHERE RTRIM(i.LocCode) = '${location}'
        -- RPTIN1000015 with Suppress Zero Balance = No includes inactive zero rows
        -- such as MG28017; status 2 must stay visible for official PDF parity.
        AND RTRIM(i.Status) IN ('1', '2')
        ${itemTypeFilter}
        ${analysisFilter}
        ${productTypeFilter}
        ${productCategoryFilter}
        ${productBrandFilter}
        ${productModelFilter}
        ${productMaterialFilter}
        ${whereSearch}
    ),
    movements AS (
      SELECT
        RTRIM(ItemCode) AS ItemCode,
        Qty AS opening_qty,
        CAST(ISNULL(Amount, ISNULL(Qty, 0) * ISNULL(AverageCost, 0)) AS decimal(18, 6)) AS opening_amt,
        0.0 AS received_qty,
        0.0 AS received_amt,
        0.0 AS return_advice_qty,
        0.0 AS return_advice_amt,
        0.0 AS transferred_qty,
        0.0 AS transferred_amt,
        0.0 AS adjustment_qty,
        0.0 AS adjustment_amt,
        0.0 AS ledger_qty,
        0.0 AS ledger_amt,
        0.0 AS issued_station_qty,
        0.0 AS issued_station_amt,
        0.0 AS issued_vehicle_qty,
        0.0 AS issued_vehicle_amt,
        0.0 AS return_qty,
        0.0 AS return_amt,
        0.0 AS goods_receive_qty,
        0.0 AS goods_receive_amt,
        0.0 AS goods_return_qty,
        0.0 AS goods_return_amt,
        0.0 AS dispatch_adv_qty,
        0.0 AS dispatch_adv_amt
      FROM [${database}].[dbo].[IN_MTHENDITEM]
      WHERE RTRIM(LocCode) = '${location}'
        AND RTRIM(CONVERT(varchar(10), AccYear)) = '${openingAccYear}'
        AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${openingAccMonth}'

      UNION ALL

      SELECT
        RTRIM(l.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN LEN(RTRIM(l.BlkCode)) = 0 AND LEN(RTRIM(l.VehCode)) = 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.BlkCode)) = 0 AND LEN(RTRIM(l.VehCode)) = 0 THEN l.Amount ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) = 0 AND LEN(RTRIM(l.BlkCode)) > 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) = 0 AND LEN(RTRIM(l.BlkCode)) > 0 THEN l.Amount ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) > 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) > 0 THEN l.Amount ELSE 0 END,
        0, 0, 0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[IN_STOCKISSUE] h
      JOIN [${database}].[dbo].[IN_STOCKISSUELN] l
        ON h.StockIssueID = l.StockIssueID
      JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = l.ItemCode
        AND issueItem.LocCode = h.LocCode
      WHERE RTRIM(h.LocCode) = '${location}'
        ${accountingPeriodFilter('h', reportAccYear, reportAccMonth)}
        AND RTRIM(h.Status) = '2'
        ${nonWorkshopItemTypeFilter('issueItem')}
        ${transactionAsOfFilter('h', transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(l.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN LEN(RTRIM(l.BlkCode)) = 0 AND LEN(RTRIM(l.VehCode)) = 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.BlkCode)) = 0 AND LEN(RTRIM(l.VehCode)) = 0 THEN l.Amount ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) = 0 AND LEN(RTRIM(l.BlkCode)) > 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) = 0 AND LEN(RTRIM(l.BlkCode)) > 0 THEN l.Amount ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) > 0 THEN l.Qty ELSE 0 END,
        CASE WHEN LEN(RTRIM(l.VehCode)) > 0 THEN l.Amount ELSE 0 END,
        0, 0, 0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[IN_FUELISSUE] h
      JOIN [${database}].[dbo].[IN_FUELISSUELN] l
        ON h.FuelIssueID = l.FuelIssueID
      JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = l.ItemCode
        AND issueItem.LocCode = h.LocCode
      WHERE RTRIM(h.LocCode) = '${location}'
        ${accountingPeriodFilter('h', reportAccYear, reportAccMonth)}
        ${fuelIssueStatusFilter('h')}
        ${nonWorkshopItemTypeFilter('issueItem')}
        ${transactionAsOfFilter('h', transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(s.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) = 0 THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) = 0 THEN s.Amount ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) > 0 THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) = 0 AND LEN(RTRIM(j.BlkCode)) > 0 THEN s.Amount ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) > 0 THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '1' AND LEN(RTRIM(j.VehCode)) > 0 THEN s.Amount ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '2' THEN s.Qty ELSE 0 END,
        CASE WHEN RTRIM(s.TransType) = '2' THEN s.Amount ELSE 0 END,
        0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${database}].[dbo].[WS_JOB] j
        ON s.JobID = j.JobID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = s.ItemCode
        AND issueItem.LocCode = s.LocCode
      WHERE RTRIM(s.LocCode) = '${location}'
        ${accountingPeriodFilter('s', reportAccYear, reportAccMonth)}
        AND ${workshopStockIssueItemTypeExpression('issueItem', 's')} = '4'
        ${transactionAsOfFilter('s', transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(gl.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        gl.StockQty,
        CAST(gl.StockQty * ISNULL(p.Cost, 0) AS decimal(18, 6)),
        0, 0, 0, 0
      FROM [${database}].[dbo].[PU_GOODSRCV] g
      JOIN [${database}].[dbo].[PU_GOODSRCVLN] gl
        ON g.GoodsRcvID = gl.GoodsRcvID
      LEFT JOIN [${database}].[dbo].[PU_POLN] p
        ON gl.POLnID = p.POLnID
      WHERE RTRIM(g.LocCode) = '${location}'
        ${accountingPeriodFilter('g', reportAccYear, reportAccMonth)}
        AND RTRIM(g.Status) = '2'
        ${transactionAsOfFilter('g', transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(grl.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0),
        CAST(COALESCE(
          NULLIF(grl.Amount, 0),
          COALESCE(NULLIF(grl.ReturnStockQty, 0), grl.QtyReturn, 0) * COALESCE(NULLIF(grl.Cost, 0), p.Cost, 0),
          0
        ) AS decimal(18, 6)),
        0, 0
      FROM [${database}].[dbo].[PU_GOODSRET] gr
      JOIN [${database}].[dbo].[PU_GOODSRETLN] grl
        ON gr.GoodsRetId = grl.GoodsRetId
      LEFT JOIN [${database}].[dbo].[PU_POLN] p
        ON grl.POLnID = p.POLnID
      WHERE RTRIM(gr.LocCode) = '${location}'
        ${accountingPeriodFilter('gr', reportAccYear, reportAccMonth)}
        AND RTRIM(gr.Status) = '2'
        ${transactionAsOfFilter('gr', transactionAsOf)}
    ),
    agg AS (
      SELECT
        ItemCode,
        SUM(opening_qty) AS opening_qty,
        SUM(opening_amt) AS opening_amt,
        SUM(received_qty) AS received_qty,
        SUM(received_amt) AS received_amt,
        SUM(return_advice_qty) AS return_advice_qty,
        SUM(return_advice_amt) AS return_advice_amt,
        SUM(transferred_qty) AS transferred_qty,
        SUM(transferred_amt) AS transferred_amt,
        SUM(adjustment_qty) AS adjustment_qty,
        SUM(adjustment_amt) AS adjustment_amt,
        SUM(ledger_qty) AS ledger_qty,
        SUM(ledger_amt) AS ledger_amt,
        SUM(issued_station_qty) AS issued_station_qty,
        SUM(issued_station_amt) AS issued_station_amt,
        SUM(issued_vehicle_qty) AS issued_vehicle_qty,
        SUM(issued_vehicle_amt) AS issued_vehicle_amt,
        SUM(return_qty) AS return_qty,
        SUM(return_amt) AS return_amt,
        SUM(goods_receive_qty) AS goods_receive_qty,
        SUM(goods_receive_amt) AS goods_receive_amt,
        SUM(goods_return_qty) AS goods_return_qty,
        SUM(goods_return_amt) AS goods_return_amt,
        SUM(dispatch_adv_qty) AS dispatch_adv_qty,
        SUM(dispatch_adv_amt) AS dispatch_adv_amt
      FROM movements
      GROUP BY ItemCode
    ),
    movement_issue_doc_sources AS (
      SELECT
        RTRIM(l.ItemCode) AS ItemCode,
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS MovementDocId,
        ISNULL(l.Qty, 0) AS MovementQty,
        ISNULL(l.Amount, 0) AS MovementAmount,
        h.PostDate AS MovementDate
      FROM [${database}].[dbo].[IN_STOCKISSUE] h
      JOIN [${database}].[dbo].[IN_STOCKISSUELN] l
        ON h.StockIssueID = l.StockIssueID
      JOIN base b
        ON b.ItemCode = RTRIM(l.ItemCode)
        AND b.Location = RTRIM(h.LocCode)
      JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = l.ItemCode
        AND issueItem.LocCode = h.LocCode
      WHERE RTRIM(h.LocCode) = '${location}'
        AND h.PostDate >= '${movementWindow.startInclusive}'
        AND h.PostDate < '${movementWindow.endExclusive}'
        AND RTRIM(ISNULL(h.Status, '')) = '2'
        ${nonWorkshopItemTypeFilter('issueItem')}
        ${transactionAsOfFilter('h', transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(l.ItemCode) AS ItemCode,
        RTRIM(CONVERT(varchar(50), h.FuelIssueID)) AS MovementDocId,
        ISNULL(l.Qty, 0) AS MovementQty,
        ISNULL(l.Amount, 0) AS MovementAmount,
        ${fuelIssueDocumentDateExpression('h')} AS MovementDate
      FROM [${database}].[dbo].[IN_FUELISSUE] h
      JOIN [${database}].[dbo].[IN_FUELISSUELN] l
        ON h.FuelIssueID = l.FuelIssueID
      JOIN base b
        ON b.ItemCode = RTRIM(l.ItemCode)
        AND b.Location = RTRIM(h.LocCode)
      JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = l.ItemCode
        AND issueItem.LocCode = h.LocCode
      WHERE RTRIM(h.LocCode) = '${location}'
        AND ${fuelIssueDocumentDateExpression('h')} >= '${movementWindow.startInclusive}'
        AND ${fuelIssueDocumentDateExpression('h')} < '${movementWindow.endExclusive}'
        ${fuelIssueStatusFilter('h')}
        ${nonWorkshopItemTypeFilter('issueItem')}
        ${transactionAsOfFilter('h', transactionAsOf)}
    ),
    movement_issue_docs AS (
      SELECT
        ItemCode,
        COUNT(DISTINCT MovementDocId) AS MovementIssueCountActual,
        CAST(SUM(MovementQty) AS decimal(18, 6)) AS MovementIssueQtyActual,
        CAST(SUM(MovementAmount) AS decimal(18, 6)) AS MovementIssueAmountActual,
        MAX(MovementDate) AS MovementLastIssueDate
      FROM movement_issue_doc_sources
      GROUP BY ItemCode
    ),
    final AS (
      SELECT
        b.Location,
        b.ItemType,
        b.ItemTypeName,
        b.StockAnalysisCode,
        b.StockAnalysisName,
        b.ProductTypeCode,
        b.ProductTypeDescription,
        b.ProductCategoryCode,
        b.ProductBrandCode,
        b.ProductModelCode,
        b.ProductMaterialCode,
        ROW_NUMBER() OVER (PARTITION BY ${rowNumberPartitionSql} ORDER BY b.ItemCode) AS RowNo,
        b.ItemCode,
        b.Description,
        b.UOM,
        b.QtyOnHand,
        b.QtyOnHold,
        b.AverageCost,
        b.OnHandHoldAmount,
        CAST(ISNULL(a.opening_qty, 0) AS decimal(18, 6)) AS opening_qty,
        CAST(ISNULL(a.opening_amt, 0) AS decimal(18, 6)) AS opening_amt,
        CAST(ISNULL(a.received_qty, 0) AS decimal(18, 6)) AS received_qty,
        CAST(ISNULL(a.received_amt, 0) AS decimal(18, 6)) AS received_amt,
        CAST(ISNULL(a.return_advice_qty, 0) AS decimal(18, 6)) AS return_advice_qty,
        CAST(ISNULL(a.return_advice_amt, 0) AS decimal(18, 6)) AS return_advice_amt,
        CAST(ISNULL(a.transferred_qty, 0) AS decimal(18, 6)) AS transferred_qty,
        CAST(ISNULL(a.transferred_amt, 0) AS decimal(18, 6)) AS transferred_amt,
        CAST(ISNULL(a.adjustment_qty, 0) AS decimal(18, 6)) AS adjustment_qty,
        CAST(ISNULL(a.adjustment_amt, 0) AS decimal(18, 6)) AS adjustment_amt,
        CAST(ISNULL(a.ledger_qty, 0) AS decimal(18, 6)) AS ledger_qty,
        CAST(ISNULL(a.ledger_amt, 0) AS decimal(18, 6)) AS ledger_amt,
        CAST(ISNULL(a.issued_station_qty, 0) AS decimal(18, 6)) AS issued_station_qty,
        CAST(ISNULL(a.issued_station_amt, 0) AS decimal(18, 6)) AS issued_station_amt,
        CAST(ISNULL(a.issued_vehicle_qty, 0) AS decimal(18, 6)) AS issued_vehicle_qty,
        CAST(ISNULL(a.issued_vehicle_amt, 0) AS decimal(18, 6)) AS issued_vehicle_amt,
        CAST(ISNULL(a.return_qty, 0) AS decimal(18, 6)) AS return_qty,
        CAST(ISNULL(a.return_amt, 0) AS decimal(18, 6)) AS return_amt,
        CAST(ISNULL(a.goods_receive_qty, 0) AS decimal(18, 6)) AS goods_receive_qty,
        CAST(ISNULL(a.goods_receive_amt, 0) AS decimal(18, 6)) AS goods_receive_amt,
        CAST(ISNULL(a.goods_return_qty, 0) AS decimal(18, 6)) AS goods_return_qty,
        CAST(ISNULL(a.goods_return_amt, 0) AS decimal(18, 6)) AS goods_return_amt,
        CAST(ISNULL(a.dispatch_adv_qty, 0) AS decimal(18, 6)) AS dispatch_adv_qty,
        CAST(ISNULL(a.dispatch_adv_amt, 0) AS decimal(18, 6)) AS dispatch_adv_amt,
        CAST(${movementActivityCountExpression} AS int) AS MovementActivityCountActual,
        CAST(${movementActivityQtyExpression} AS decimal(18, 6)) AS MovementActivityQtyActual,
        CAST(${movementActivityAmountExpression} AS decimal(18, 6)) AS MovementActivityAmountActual,
        CAST(ISNULL(mi.MovementIssueCountActual, 0) AS int) AS StockIssueDocumentCountActual,
        CAST(ISNULL(mi.MovementIssueQtyActual, 0) AS decimal(18, 6)) AS StockIssueDocumentQtyActual,
        CAST(ISNULL(mi.MovementIssueAmountActual, 0) AS decimal(18, 6)) AS StockIssueDocumentAmountActual,
        CAST(${movementActualCountExpression} AS int) AS MovementIssueCountActual,
        CAST(${movementActualQtyExpression} AS decimal(18, 6)) AS MovementIssueQtyActual,
        CAST(${movementActualAmountExpression} AS decimal(18, 6)) AS MovementIssueAmountActual,
        mi.MovementLastIssueDate,
        ${movementCategorySqlCase(movementActualCountExpression, 'b.QtyOnHand + b.QtyOnHold', movementThresholds)} AS MovementCategory
      FROM base b
      LEFT JOIN agg a ON a.ItemCode = b.ItemCode
      LEFT JOIN movement_issue_docs mi ON mi.ItemCode = b.ItemCode
    ),
    report_rows AS (
      SELECT
        '${actualPeriod}' AS ActualPeriod,
        CONVERT(date, '${actualPeriod}-01') AS ActualPeriodStart,
        '${reportAccountingPeriod}' AS AccountingPeriod,
        ${reportAccYear} AS AccYear,
        ${reportAccMonth} AS AccMonth,
        '${openingActualPeriod}' AS OpeningActualPeriod,
        '${openingAccountingPeriod}' AS OpeningAccountingPeriod,
        Location,
        ItemType,
        ItemTypeName,
        StockAnalysisCode,
        StockAnalysisName,
        ProductTypeCode,
        ProductTypeDescription,
        ProductCategoryCode,
        ProductBrandCode,
        ProductModelCode,
        ProductMaterialCode,
        RowNo AS [No],
        ItemCode,
        Description AS ItemDescription,
        UOM,
        MovementCategory,
        MovementActivityCountActual,
        MovementActivityQtyActual,
        MovementActivityAmountActual,
        StockIssueDocumentCountActual,
        StockIssueDocumentQtyActual,
        StockIssueDocumentAmountActual,
        MovementIssueCountActual,
        MovementIssueQtyActual,
        MovementIssueAmountActual,
        MovementLastIssueDate,
        MovementIssueCountActual AS StockIssueMovementCount,
        MovementIssueQtyActual AS StockIssueMovementQty,
        MovementIssueAmountActual AS StockIssueMovementAmount,
        QtyOnHand,
        QtyOnHold,
        QtyOnHand + QtyOnHold AS QtyOnHandHold,
        AverageCost,
        OnHandHoldAmount,
        opening_qty AS OpeningQty,
        received_qty AS ReceivedQty,
        return_advice_qty AS ReturnAdviceQty,
        transferred_qty AS TransferredQty,
        adjustment_qty AS AdjustmentQty,
        ledger_qty AS LedgerQty,
        issued_station_qty AS IssuedStationQty,
        issued_vehicle_qty AS IssuedVehicleQty,
        ledger_qty + issued_station_qty + issued_vehicle_qty AS IssuedTotalQty,
        return_qty AS ReturnQty,
        goods_receive_qty AS GoodsReceiveQty,
        goods_return_qty AS GoodsReturnQty,
        dispatch_adv_qty AS DispatchAdvQty,
        opening_qty + received_qty + return_advice_qty + transferred_qty + adjustment_qty
          - (ledger_qty + issued_station_qty + issued_vehicle_qty)
          + return_qty + goods_receive_qty - goods_return_qty - dispatch_adv_qty AS ClosingQty,
        opening_amt AS OpeningAmount,
        received_amt AS ReceivedAmount,
        return_advice_amt AS ReturnAdviceAmount,
        transferred_amt AS TransferredAmount,
        adjustment_amt AS AdjustmentAmount,
        ledger_amt AS LedgerAmount,
        issued_station_amt AS IssuedStationAmount,
        issued_vehicle_amt AS IssuedVehicleAmount,
        ledger_amt + issued_station_amt + issued_vehicle_amt AS IssuedTotalAmount,
        return_amt AS ReturnAmount,
        goods_receive_amt AS GoodsReceiveAmount,
        goods_return_amt AS GoodsReturnAmount,
        dispatch_adv_amt AS DispatchAdvAmount,
        opening_amt + received_amt + return_advice_amt + transferred_amt + adjustment_amt
          - (ledger_amt + issued_station_amt + issued_vehicle_amt)
          + return_amt + goods_receive_amt - goods_return_amt - dispatch_adv_amt AS ClosingAmount
      FROM final
    )`
}

function staleUpdateFilter(alias: string, stale: string) {
  if (stale === 'active') return `AND ${alias}.UpdateDate IS NOT NULL AND ${alias}.UpdateDate >= DATEADD(MONTH, -3, GETDATE())`
  if (stale === 'watch') return `AND ${alias}.UpdateDate IS NOT NULL AND ${alias}.UpdateDate < DATEADD(MONTH, -3, GETDATE()) AND ${alias}.UpdateDate >= DATEADD(MONTH, -6, GETDATE())`
  if (stale === 'slow-moving') return `AND ${alias}.UpdateDate IS NOT NULL AND ${alias}.UpdateDate < DATEADD(MONTH, -6, GETDATE()) AND ${alias}.UpdateDate > DATEADD(YEAR, -1, GETDATE())`
  if (stale === 'dead-stock') return `AND (${alias}.UpdateDate IS NULL OR ${alias}.UpdateDate <= DATEADD(YEAR, -2, GETDATE()))`
  if (stale === 'kurang-1-tahun') return `AND ${alias}.UpdateDate IS NOT NULL AND ${alias}.UpdateDate > DATEADD(YEAR, -1, GETDATE())`
  if (stale === 'semua') return ''
  return `AND (${alias}.UpdateDate IS NULL OR ${alias}.UpdateDate <= DATEADD(YEAR, -1, GETDATE()))`
}

function staleUpdateLabel(stale: string) {
  if (stale === 'active') return 'Update <= 3 bulan'
  if (stale === 'watch') return 'Update 3-6 bulan'
  if (stale === 'slow-moving') return 'Update 6-12 bulan'
  if (stale === 'dead-stock') return 'Tidak update lebih dari 24 bulan'
  if (stale === 'kurang-1-tahun') return 'Update kurang dari 1 tahun'
  if (stale === 'semua') return 'Semua item'
  return 'Tidak update lebih dari 1 tahun'
}

/** Parse stale param like "dari-3-bulan-sampai-sekarang" or "dari-1 tahun-ke-5-tahun" */
function staleFilterByRange(alias: string, stale: string) {
  // format: dari-{n}-{unit}-sampai-{m}-{unit2}
  // units: hari, minggu, bulan, tahun
  const dariMatch = stale.match(/^dari-(\d+)-(hari|minggu|bulan|tahun)/)
  const sampaiMatch = stale.match(/sampai-(sekarang|(\d+)-(hari|minggu|bulan|tahun))/)
  if (!dariMatch) return '' // fallback: semua
  const [, dariN, dariUnit] = dariMatch
  const dn = parseInt(dariN, 10)
  const du = dariUnit === 'hari' ? 'DAY' : dariUnit === 'minggu' ? 'WEEK' : dariUnit === 'bulan' ? 'MONTH' : 'YEAR'
  if (sampaiMatch) {
    if (sampaiMatch[1] === 'sekarang') {
      // dari-X sampai sekarang → UpdateDate antara X lalu dan sekarang
      return `AND ${alias}.UpdateDate BETWEEN DATEADD(${du}, -${dn}, GETDATE()) AND GETDATE()`
    } else {
      const [, , sampaiN, sampaiUnit] = sampaiMatch
      const sn = parseInt(sampaiN, 10)
      const su = sampaiUnit === 'hari' ? 'DAY' : sampaiUnit === 'minggu' ? 'WEEK' : sampaiUnit === 'bulan' ? 'MONTH' : 'YEAR'
      return `AND ${alias}.UpdateDate BETWEEN DATEADD(${du}, -${dn}, GETDATE()) AND DATEADD(${su}, -${sn}, GETDATE())`
    }
  }
  return `AND ${alias}.UpdateDate >= DATEADD(${du}, -${dn}, GETDATE())`
}

function staleRangeLabel(stale: string) {
  const dariMatch = stale.match(/^dari-(\d+)-(hari|minggu|bulan|tahun)/)
  const sampaiMatch = stale.match(/sampai-(sekarang|(\d+)-(hari|minggu|bulan|tahun))/)
  if (!dariMatch) return 'Semua item aktif'
  const [, n, unit] = dariMatch
  const unitLabel = (u: string) => u === 'hari' ? 'hari' : u === 'minggu' ? 'minggu' : u === 'bulan' ? 'bulan' : 'tahun'
  const dariLabel = `${n} ${unitLabel(unit)} ke atas`
  if (sampaiMatch) {
    if (sampaiMatch[1] === 'sekarang') return `Dari ${n} ${unitLabel(unit)} lalu sampai sekarang`
    const [, , sn, sunit] = sampaiMatch
    return `Dari ${n} ${unitLabel(unit)} sampai ${sn} ${unitLabel(sunit)}`
  }
  return dariLabel
}

async function querySQL(ctx: QueryContext, sql: string): Promise<GatewayResult> {
  const validation = validateReadOnlySql(sql)
  if (!validation.safe) {
    return {
      success: false,
      error: validation.reason ?? 'Query non-read diblokir oleh validator report.',
    }
  }

  const base = resolveSqlGatewayBase({ override: gatewayBaseStorage.getStore() })
  try {
    const response = await fetch(sqlGatewayQueryUrl(base), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': TOKEN,
      },
      body: JSON.stringify({ sql, server: ctx.server, database: ctx.database }),
      cache: 'no-store',
    })

    const result = (await response.json()) as GatewayResult
    if (!response.ok || result.success === false) {
      return {
        success: false,
        error: result.error ?? `SQL Gateway HTTP ${response.status}`,
        db: result.db,
        execution_ms: result.execution_ms,
      }
    }
    debugSqlStorage.getStore()?.push({
      label: classifySqlStatement(sql),
      server: ctx.server,
      database: ctx.database,
      sql: compactSql(sql),
      rows: result.data?.recordset?.length ?? 0,
      executionMs: result.execution_ms,
      readOnly: true,
    })
    return result
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function rows(ctx: QueryContext, sql: string) {
  const result = await querySQL(ctx, sql)
  if (!result.success) {
    throw new Error(result.error ?? 'SQL Gateway query failed')
  }
  return result.data?.recordset ?? []
}

async function first(ctx: QueryContext, sql: string) {
  const recordset = await rows(ctx, sql)
  return recordset[0] ?? {}
}

function columnsFrom(rowsData: DbRow[]) {
  return rowsData[0] ? Object.keys(rowsData[0]) : []
}

function payloadHasMovementCategory(payload: Pick<ReportPayload, 'rows' | 'columns' | 'chart'>) {
  return payload.columns.includes('MovementCategory') ||
    payload.rows.some((row) => row.MovementCategory !== undefined) ||
    payload.chart.some((row) => row.MovementCategory !== undefined)
}

const MOVEMENT_ENRICHMENT_ITEM_FIELDS = ['ItemCode', 'KodeBarang', 'item_code', 'KodeItem']
const MOVEMENT_ENRICHMENT_LOCATION_FIELDS = ['LocCode', 'Location', 'Gudang', 'Lokasi', 'location', 'Warehouse']
const MOVEMENT_ENRICHMENT_LIMIT = 2000

function firstTextField(row: DbRow, fields: string[]) {
  for (const field of fields) {
    const value = String(row[field] ?? '').trim()
    if (value) return value
  }
  return ''
}

function movementEnrichmentPair(row: DbRow) {
  const itemCode = firstTextField(row, MOVEMENT_ENRICHMENT_ITEM_FIELDS)
  const locCode = firstTextField(row, MOVEMENT_ENRICHMENT_LOCATION_FIELDS)
  return itemCode && locCode ? { itemCode, locCode } : null
}

async function enrichPayloadWithMovementCategory<T extends ReportPayload>(
  payload: T,
  ctx: QueryContext,
  filters?: ReportFilterInput,
): Promise<T> {
  if (payloadHasMovementCategory(payload) || payload.rows.length === 0) return payload

  const pairMap = new Map<string, { itemCode: string; locCode: string }>()
  payload.rows.forEach((row) => {
    const pair = movementEnrichmentPair(row)
    if (!pair) return
    pairMap.set(`${pair.itemCode}@@${pair.locCode}`, pair)
  })

  const pairs = [...pairMap.values()].slice(0, MOVEMENT_ENRICHMENT_LIMIT)
  if (pairs.length === 0) return payload

  const movementWindow = movementWindowFromFilters(filters)
  const movementThresholds = movementThresholdsFromFilters(filters)
  const quantityClosing = quantityClosingExpression('i')
  const valuesSql = pairs
    .map((pair) => `(N'${sanitizeLike(pair.itemCode)}', N'${sanitizeLike(pair.locCode)}')`)
    .join(',\n      ')

  let movementRows: DbRow[] = []
  try {
    movementRows = await rows(ctx, `
      WITH requested(ItemCode, LocCode) AS (
        SELECT *
        FROM (VALUES
        ${valuesSql}
        ) v(ItemCode, LocCode)
      )
      SELECT
        RTRIM(i.ItemCode) AS ItemCode,
        RTRIM(i.LocCode) AS LocCode,
        CAST(ISNULL(movement12.MovementEventCountAll, 0) AS INT) AS MovementIssueCountActual,
        CAST(ISNULL(movement12.MovementQtyAll, 0) AS DECIMAL(18,2)) AS MovementIssueQtyActual,
        CAST(ISNULL(movement12.MovementAmountAll, 0) AS DECIMAL(18,2)) AS MovementIssueAmountActual,
        latestMovement.LastMovementDate AS MovementLastIssueDate,
        ${movementCategorySqlCase('ISNULL(movement12.MovementEventCountAll, 0)', quantityClosing, movementThresholds)} AS MovementCategory
      FROM [${ctx.database}].[dbo].[IN_ITEM] i
      INNER JOIN requested r
        ON RTRIM(i.ItemCode) = r.ItemCode
        AND RTRIM(i.LocCode) = r.LocCode
      ${stockIssueUsageApply(ctx.database, 'i', movementWindow)}
    `)
  } catch (error) {
    return {
      ...payload,
      metadata: {
        ...payload.metadata,
        movementCategoryEnrichment: {
          enabled: false,
          pairCount: pairs.length,
          error: error instanceof Error ? error.message : 'MovementCategory enrichment failed',
        },
      },
    }
  }

  const movementByKey = new Map(
    movementRows.map((row) => [
      `${String(row.ItemCode ?? '').trim()}@@${String(row.LocCode ?? '').trim()}`,
      row,
    ]),
  )

  if (movementByKey.size === 0) return payload

  const enrichedRows = payload.rows.map((row) => {
    const pair = movementEnrichmentPair(row)
    if (!pair) return row
    const movement = movementByKey.get(`${pair.itemCode}@@${pair.locCode}`)
    if (!movement) return row
    return {
      ...row,
      MovementCategory: movement.MovementCategory,
      MovementIssueCountActual: movement.MovementIssueCountActual,
      MovementIssueQtyActual: movement.MovementIssueQtyActual,
      MovementIssueAmountActual: movement.MovementIssueAmountActual,
      MovementLastIssueDate: movement.MovementLastIssueDate,
      StockIssueMovementCount: row.StockIssueMovementCount ?? movement.MovementIssueCountActual,
      StockIssueMovementQty: row.StockIssueMovementQty ?? movement.MovementIssueQtyActual,
      StockIssueMovementAmount: row.StockIssueMovementAmount ?? movement.MovementIssueAmountActual,
    }
  })

  return {
    ...payload,
    rows: enrichedRows,
    columns: [
      ...payload.columns,
      ...[
        'MovementCategory',
        'MovementIssueCountActual',
        'MovementIssueQtyActual',
        'MovementIssueAmountActual',
        'MovementLastIssueDate',
      ].filter((column) => !payload.columns.includes(column)),
    ],
    metadata: {
      ...payload.metadata,
      movementCategoryEnrichment: {
        enabled: true,
        pairCount: pairs.length,
        enrichedPairCount: movementByKey.size,
        capped: pairMap.size > MOVEMENT_ENRICHMENT_LIMIT,
        movementWindow,
        movementCategoryThresholds: movementThresholds,
        sourceTables: 'IN_ITEM, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      },
    },
  }
}

function compactFilterParameters(filters: ReportFilterInput) {
  return Object.fromEntries(
    Object.entries(filters).filter(([, value]) => Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== ''),
  )
}

function buildFilterParameterMetadata(filters: ReportFilterInput, payload: ReportPayload, reportId: string, ctx: QueryContext) {
  const hasMovement = payloadHasMovementCategory(payload)
  return {
    report: reportId,
    source: ctx.source,
    active: compactFilterParameters(filters),
    movementCategory: {
      available: hasMovement,
      groupingEnabled: hasMovement && (isMovementCategoryField(filters.groupBy) || isMovementCategoryField(filters.chartDimension)),
      filter: filters.movementCategory,
      groupBy: filters.groupBy,
      chartDimension: filters.chartDimension,
      window: movementWindowFromFilters(filters),
      thresholds: movementThresholdsFromFilters(filters),
      optional: true,
      rule: 'MovementCategory dihitung dari issue valid dalam movementWindow aktif; grouping hanya aktif jika groupBy/chartDimension = MovementCategory.',
    },
  }
}

function metadata(ctx: QueryContext, extra: DbRow = {}) {
  return {
    source: ctx.source,
    sourceLabel: ctx.sourceLabel,
    sourceServer: ctx.server,
    sourceDatabase: ctx.database,
    dataSource: ctx.dataSource,
    period: 'Mei 2026',
    generatedAt: new Date().toISOString(),
    updatedBy: 'Sistem Otomatis',
    readOnly: true,
    validDateRule: "Tanggal < 2000-01-01 dianggap placeholder dan dikeluarkan dari chart periode.",
    ...extra,
  }
}

function applyTableSort<T extends ReportPayload>(payload: T, column?: string, direction: 'asc' | 'desc' = 'desc'): T {
  if (!column || !payload.columns.includes(column)) return payload
  const sortedRows = [...payload.rows].sort((a, b) => {
    const result = String(a[column] ?? '').localeCompare(String(b[column] ?? ''), 'id-ID', { numeric: true })
    return direction === 'asc' ? result : -result
  })

  return {
    ...payload,
    rows: sortedRows,
    metadata: {
      ...payload.metadata,
      tableSortColumn: column,
      tableSortDirection: direction,
    },
  }
}

function paginatePayload<T extends ReportPayload>(payload: T, pagination: PaginationState, enabled: boolean, windowLimit = TABLE_WINDOW_ROW_LIMIT): T {
  const totalRows = Number(payload.metadata.filteredRows ?? payload.rows.length)
  const safeTotalRows = Number.isFinite(totalRows) ? totalRows : payload.rows.length
  const maxLoadedRows = enabled ? Math.min(safeTotalRows, windowLimit) : safeTotalRows
  const totalPages = Math.max(1, Math.ceil(maxLoadedRows / pagination.pageSize))

  if (!enabled) {
    return {
      ...payload,
      metadata: {
        ...payload.metadata,
        page: 1,
        pageSize: payload.rows.length,
        totalRows: safeTotalRows,
        filteredRows: safeTotalRows,
        loadedRows: payload.rows.length,
        maxLoadedRows: safeTotalRows,
        reachableRows: safeTotalRows,
        totalPages: 1,
        paginated: false,
        windowed: false,
        tableReady: true,
      },
    }
  }

  const safePage = Math.min(Math.max(pagination.page, 1), totalPages)
  const start = (safePage - 1) * pagination.pageSize
  const pageRows = payload.rows.slice(start, start + pagination.pageSize)

  return {
    ...payload,
    rows: pageRows,
    columns: pageRows[0] ? Object.keys(pageRows[0]) : payload.columns,
    metadata: {
      ...payload.metadata,
      page: safePage,
      pageSize: pagination.pageSize,
      totalRows: safeTotalRows,
      filteredRows: safeTotalRows,
      loadedRows: payload.rows.length,
      maxLoadedRows,
      reachableRows: maxLoadedRows,
      totalPages,
      rowStart: safeTotalRows === 0 ? 0 : start + 1,
      rowEnd: start + pageRows.length,
      paginated: true,
      windowed: maxLoadedRows < safeTotalRows,
      tableReady: true,
    },
  }
}

async function stockSummary({ limit, search, ctx, stale, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = itemSearch('i', search)
  const quantityClosing = quantityClosingExpression('i')
  const quantityClosingField = quantityClosingExpression()
  const itemTypeFilter = filters?.itemType?.toLowerCase()
  const itemTypeSql = itemTypeFilter === '1' || itemTypeFilter === 'gudang' ? "AND i.ItemType = '1'" : itemTypeFilter === '4' || itemTypeFilter === 'workshop' ? "AND i.ItemType = '4'" : warehouseInventoryItemTypeFilter('i')
  const movementThresholds = movementThresholdsFromFilters(filters)

  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(i.ItemCode) AS KodeBarang,
      RTRIM(i.Description) AS NamaBarang,
      RTRIM(i.LocCode) AS Gudang,
      RTRIM(i.UOMCode) AS Satuan,
      CAST(${quantityClosing} AS DECIMAL(18,2)) AS QuantityClosing,
      ${stockIssueUsageColumns(quantityClosing, movementThresholds)},
      CAST(ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS AverageCost,
      CAST(${quantityClosing} * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS NilaiStok,
      RTRIM(ISNULL(i.ProdCatCode, '-')) AS Kategori,
      i.UpdateDate AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      ${itemTypeSql}
      ${whereSearch}
    ORDER BY ${quantityClosing} DESC, i.UpdateDate DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(*) AS TotalItem,
      SUM(CASE WHEN ${quantityClosing} > 0 THEN 1 ELSE 0 END) AS ItemAdaStok,
      SUM(CASE WHEN ${quantityClosing} = 0 THEN 1 ELSE 0 END) AS ItemStokNol,
      SUM(CASE WHEN i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = '' OR RTRIM(i.ProdCatCode) = '0' THEN 1 ELSE 0 END) AS ItemTanpaKategori,
      SUM(CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END) AS ItemTanpaIssueValid,
      SUM(CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate < DATEADD(MONTH, -12, GETDATE()) THEN 1 ELSE 0 END) AS ItemUpdateLebih12Bulan,
      CAST(SUM(${quantityClosing}) AS DECIMAL(18,2)) AS TotalStok,
      COUNT(DISTINCT RTRIM(i.LocCode)) AS TotalGudang,
      CAST(SUM(${quantityClosing} * ISNULL(i.AverageCost, 0)) AS DECIMAL(18,2)) AS NilaiPersediaan,
      SUM(CASE WHEN ${quantityClosing} < ISNULL(i.ReOrderLevel, 0) AND ISNULL(i.ReOrderLevel, 0) > 0 THEN 1 ELSE 0 END) AS ItemMinimumStock,
      MAX(i.UpdateDate) AS TerakhirUpdate,
      SUM(CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '1' THEN 1 ELSE 0 END) AS GudangItemCount,
      SUM(CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '4' THEN 1 ELSE 0 END) AS WorkshopItemCount,
      SUM(CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '1' AND ${quantityClosing} > 0 THEN 1 ELSE 0 END) AS GudangItemWithStock,
      SUM(CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '4' AND ${quantityClosing} > 0 THEN 1 ELSE 0 END) AS WorkshopItemWithStock,
      CAST(SUM(CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '1' AND ${quantityClosing} > 0 THEN ${quantityClosing} * ISNULL(i.AverageCost, 0) ELSE 0 END) AS DECIMAL(18,2)) AS GudangTotalAmount,
      CAST(SUM(CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '4' AND ${quantityClosing} > 0 THEN ${quantityClosing} * ISNULL(i.AverageCost, 0) ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopTotalAmount,
      COUNT(DISTINCT CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '1' AND ${quantityClosing} > 0 THEN RTRIM(i.LocCode) END) AS GudangLocationWithStock,
      COUNT(DISTINCT CASE WHEN RTRIM(ISNULL(i.ItemType, '')) = '4' AND ${quantityClosing} > 0 THEN RTRIM(i.LocCode) END) AS WorkshopLocationWithStock
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      ${itemTypeSql}
  `)

  const chart = await rows(ctx, `
    SELECT TOP 8
      RTRIM(LocCode) AS Gudang,
      COUNT(*) AS TotalItem,
      CAST(SUM(${quantityClosingField}) AS DECIMAL(18,2)) AS TotalStok,
      CAST(SUM(${quantityClosingField} * ISNULL(AverageCost, 0)) AS DECIMAL(18,2)) AS NilaiStok
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    WHERE RTRIM(ISNULL(Status, '0')) = '1'
      ${itemTypeSql}
    GROUP BY RTRIM(LocCode)
    ORDER BY NilaiStok DESC
  `)

  return {
    title: 'Posisi Stok & Nilai Inventory',
    description: 'Executive view nilai persediaan inventory, stok Gudang + Workshop/Mesin, lokasi dominan, top item, dan risiko kualitas master dari IN_ITEM.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_ITEM, IN_PRODCAT, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      quantityRule: 'QuantityClosing = QtyOnHand + QtyOnHold + QtyOnOrder',
      issueUsageRule: 'ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK.TransType = 1.',
      primaryChart: 'Nilai Persediaan per Lokasi',
      availableCharts: [
        'Nilai Persediaan per Lokasi',
        'Komposisi Nilai per Kategori',
        'Top Item Berdasarkan Nilai Stok',
        'Quality Flags Master Stok',
      ],
      qualityFocus: ['ItemStokNol', 'ItemTanpaKategori', 'ItemTanpaIssueValid', 'ItemUpdateLebih12Bulan'],
    }),
  }
}

async function assetStockValuationListing({ limit, limitAll, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const rowLimit = limitAll ? 20000 : limit
  const period = resolveAssetValuationPeriod(filters)
  const now = new Date()
  const isCurrentActualPeriod = period.actualYear === now.getFullYear() && period.actualMonth === now.getMonth() + 1
  const useMonthEnd = period.requested && !isCurrentActualPeriod
  const whereSearch = textSearch(search, ['i.ItemCode', 'i.Description', 'i.ProdTypeCode', "ISNULL(pt.Description, '')", 'i.LocCode', "ISNULL(i.ProdCatCode, '')", "ISNULL(i.StockAnalysisCode, '')"])
  const location = sanitizeLike(filters?.location ?? '')
  const category = sanitizeLike(filters?.category ?? '')
  const locationFilter = location ? `AND RTRIM(i.LocCode) LIKE N'%${location}%'` : ''
  const taxonomyFilter = inventoryTaxonomyScopeFilter('i', filters)
  const categoryFilter = category
    ? `AND (
        RTRIM(ISNULL(i.ProdCatCode, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(i.ProdTypeCode, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(pt.Description, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(i.StockAnalysisCode, '')) LIKE N'%${category}%'
      )`
    : ''
  const qtyOnHand = useMonthEnd ? 'ISNULL(m.Qty, 0)' : 'ISNULL(i.QtyOnHand, 0)'
  const qtyOnHold = useMonthEnd ? '0' : 'ISNULL(i.QtyOnHold, 0)'
  const unitCost = useMonthEnd
    ? 'COALESCE(NULLIF(m.AverageCost, 0), CASE WHEN ISNULL(m.Qty, 0) = 0 THEN 0 ELSE ISNULL(m.Amount, 0) / NULLIF(m.Qty, 0) END, 0)'
    : 'ISNULL(i.AverageCost, 0)'
  const differentialUnitCost = useMonthEnd ? '0' : 'ISNULL(i.DiffAverageCost, 0)'
  const totalQuantity = `${qtyOnHand} + ${qtyOnHold}`
  const totalAmount = `(${totalQuantity}) * ${unitCost}`
  const fromSql = useMonthEnd
    ? `
    FROM [${DATABASE}].[dbo].[IN_MTHENDITEM] m
    INNER JOIN [${DATABASE}].[dbo].[IN_ITEM] i
      ON i.ItemCode = m.ItemCode
      AND i.LocCode = m.LocCode
    OUTER APPLY (
      SELECT TOP 1 p.Description
      FROM [${DATABASE}].[dbo].[IN_PRODTYPE] p
      WHERE p.ProdTypeCode = i.ProdTypeCode
      ORDER BY p.ProdTypeCode
    ) pt`
    : `
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    OUTER APPLY (
      SELECT TOP 1 p.Description
      FROM [${DATABASE}].[dbo].[IN_PRODTYPE] p
      WHERE p.ProdTypeCode = i.ProdTypeCode
      ORDER BY p.ProdTypeCode
    ) pt`
  const periodWhere = useMonthEnd
    ? `
      AND RTRIM(CONVERT(varchar(10), m.AccYear)) = '${period.accYear}'
      AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${period.accMonth}`
    : ''
  const statusFilter = ''
  const itemTypeFilter = filters?.itemType?.toLowerCase()
  const itemTypeSql = itemTypeFilter === '1' || itemTypeFilter === 'gudang' ? "AND i.ItemType = '1'" : itemTypeFilter === '4' || itemTypeFilter === 'workshop' ? "AND i.ItemType = '4'" : warehouseInventoryItemTypeFilter('i')

  const reportSql = `
    WITH asset_valuation AS (
      SELECT
        'RPTIN1000011' AS report_id,
        'Report Asset Stock Valuasi Listing' AS source_report_title,
        ${period.accYear} AS acc_year,
        ${period.accMonth} AS acc_month,
        '${period.accountingPeriod}' AS accounting_period,
        ${period.actualYear} AS actual_year,
        ${period.actualMonth} AS actual_month,
        '${period.actualPeriod}' AS actual_period,
        CONVERT(date, '${period.actualPeriod}-01') AS ActualPeriodStart,
        '${useMonthEnd ? 'IN_MTHENDITEM' : 'IN_ITEM current balance'}' AS period_data_source,
        RTRIM(i.ProdTypeCode) AS product_type_code,
        RTRIM(ISNULL(pt.Description, i.ProdTypeCode)) AS product_type_description,
        RTRIM(i.LocCode) AS location,
        RTRIM(i.ItemCode) AS item_code,
        RTRIM(i.Description) AS description,
        RTRIM(i.UOMCode) AS uom,
        ${warehouseInventoryItemTypeExpression('i')} AS item_type,
        CASE ${warehouseInventoryItemTypeExpression('i')}
          WHEN '1' THEN 'Stock'
          WHEN '4' THEN 'Workshop'
          ELSE ISNULL(${warehouseInventoryItemTypeExpression('i')}, '-')
        END AS item_type_name,
        CAST(${qtyOnHand} AS DECIMAL(18,2)) AS quantity_on_hand,
        CAST(${qtyOnHold} AS DECIMAL(18,2)) AS quantity_on_hold,
        CAST(${totalQuantity} AS DECIMAL(18,2)) AS total_quantity,
        CAST(${unitCost} AS DECIMAL(18,6)) AS unit_cost,
        CAST(${differentialUnitCost} AS DECIMAL(18,6)) AS differential_unit_cost,
        CAST(${totalAmount} AS DECIMAL(38,6)) AS total_amount,
        NULLIF(RTRIM(i.ProdCatCode), '') AS product_category_code,
        NULLIF(RTRIM(i.ProdBrandCode), '') AS product_brand_code,
        NULLIF(RTRIM(i.ProdModelCode), '') AS product_model_code,
        NULLIF(RTRIM(i.ProdMatCode), '') AS product_material_code,
        NULLIF(RTRIM(i.StockAnalysisCode), '') AS stock_analysis_code,
        i.UpdateDate AS update_date
      ${fromSql}
      WHERE 1=1
        ${itemTypeSql}
        ${statusFilter}
        ${periodWhere}
        ${locationFilter}
        ${taxonomyFilter}
        ${categoryFilter}
        ${whereSearch}
    )`

  const reportRows = await rows(ctx, `
    ${reportSql}
    SELECT TOP ${rowLimit} *
    FROM asset_valuation
    ORDER BY total_amount DESC, item_code ASC
  `)

  const summary = await first(ctx, `
    ${reportSql}
    SELECT
      ${period.accYear} AS acc_year,
      ${period.accMonth} AS acc_month,
      '${period.accountingPeriod}' AS accounting_period,
      ${period.actualYear} AS actual_year,
      ${period.actualMonth} AS actual_month,
      '${period.actualPeriod}' AS actual_period,
      '${useMonthEnd ? 'IN_MTHENDITEM' : 'IN_ITEM current balance'}' AS period_data_source,
      COUNT(*) AS total_item,
      COUNT(DISTINCT product_type_code) AS total_product_type,
      COUNT(DISTINCT location) AS total_location,
      CAST(SUM(quantity_on_hand) AS DECIMAL(18,2)) AS total_quantity_on_hand,
      CAST(SUM(quantity_on_hold) AS DECIMAL(18,2)) AS total_quantity_on_hold,
      CAST(SUM(total_quantity) AS DECIMAL(18,2)) AS total_quantity,
      CAST(SUM(total_amount) AS DECIMAL(38,6)) AS total_amount,
      SUM(CASE WHEN total_quantity = 0 THEN 1 ELSE 0 END) AS zero_quantity_item,
      SUM(CASE WHEN unit_cost = 0 THEN 1 ELSE 0 END) AS zero_unit_cost_item,
      MAX(update_date) AS last_update_date,
      SUM(CASE WHEN item_type = '1' THEN 1 ELSE 0 END) AS GudangItemCount,
      SUM(CASE WHEN item_type = '4' THEN 1 ELSE 0 END) AS WorkshopItemCount,
      SUM(CASE WHEN item_type = '1' AND total_quantity > 0 THEN 1 ELSE 0 END) AS GudangItemWithStock,
      SUM(CASE WHEN item_type = '4' AND total_quantity > 0 THEN 1 ELSE 0 END) AS WorkshopItemWithStock,
      CAST(SUM(CASE WHEN item_type = '1' AND total_quantity > 0 THEN total_amount ELSE 0 END) AS DECIMAL(38,6)) AS GudangTotalAmount,
      CAST(SUM(CASE WHEN item_type = '4' AND total_quantity > 0 THEN total_amount ELSE 0 END) AS DECIMAL(38,6)) AS WorkshopTotalAmount,
      COUNT(DISTINCT CASE WHEN item_type = '1' AND total_quantity > 0 THEN location END) AS GudangLocationWithStock,
      COUNT(DISTINCT CASE WHEN item_type = '4' AND total_quantity > 0 THEN location END) AS WorkshopLocationWithStock
    FROM asset_valuation
  `)

  const chart = await rows(ctx, `
    ${reportSql}
    SELECT TOP 12
      product_type_code AS Label,
      product_type_code,
      product_type_description,
      COUNT(*) AS TotalItem,
      CAST(SUM(total_quantity) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(total_amount) AS DECIMAL(38,6)) AS TotalAmount
    FROM asset_valuation
    GROUP BY product_type_code, product_type_description
    ORDER BY TotalAmount DESC
  `)

  return {
    title: 'Report Asset Stock Valuasi Listing',
    description: 'Listing valuasi stock berdasarkan item stock dan workshop, dengan periode aktual/accounting yang dikonversi otomatis.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      reportId: 'RPTIN1000011',
      sourceReportTitle: 'Report Asset Stock Valuasi Listing',
      sourceTables: useMonthEnd ? 'IN_MTHENDITEM, IN_ITEM, IN_PRODTYPE' : 'IN_ITEM, IN_PRODTYPE',
      period: period.actualPeriod,
      actualPeriod: period.actualPeriod,
      actualYear: period.actualYear,
      actualMonth: period.actualMonth,
      accountingPeriod: period.accountingPeriod,
      accYear: period.accYear,
      accMonth: period.accMonth,
      periodInputMode: period.inputMode,
      periodDataSource: useMonthEnd ? 'IN_MTHENDITEM period snapshot' : 'IN_ITEM current balance; period shown for accounting context',
      itemTypeScope: 'ItemType IN (1, 4): 1 = Stock, 4 = Workshop',
      statusScope: 'Tidak filter Status; scope mengikuti query pembanding user: IN_ITEM WHERE ItemType IN (1, 4).',
      summaryScope: 'Full data aggregation; tidak mengikuti limit/pagination rows table.',
      tableRowsScope: limitAll ? 'Full listing request/export.' : 'Rows table dipaginasi untuk render cepat; summary tetap full dataset.',
      totalRows: summary.total_item,
      filteredRows: summary.total_item,
      groupBy: 'Product Type Code',
      suppressZeroBalance: 'No',
      includeWorkshopItem: 'Yes',
      decimalPlaces: 1,
      periodRule: 'Actual period YYYY-MM dikonversi dengan actualToAccountingPeriod; AccYear/AccMonth dikonversi balik dengan accountingToActualPeriod.',
      quantityRule: 'total_quantity = quantity_on_hand + quantity_on_hold.',
      valuationRule: useMonthEnd ? 'total_amount = IN_MTHENDITEM.Qty * AverageCost.' : 'total_amount = (quantity_on_hand + quantity_on_hold) * IN_ITEM.AverageCost',
      differentialUnitCostRule: useMonthEnd ? 'IN_MTHENDITEM tidak punya DiffAverageCost; differential_unit_cost ditampilkan 0.' : 'differential_unit_cost = IN_ITEM.DiffAverageCost',
      primaryChart: 'Top Product Type by total_amount',
      availableCharts: ['Top product type by total_amount', 'Quantity on hand by product type', 'Zero balance quality check'],
      qualityFocus: ['zero_quantity_item', 'zero_unit_cost_item'],
    }),
  }
}

async function allStockMovementAnalysis({ limit, limitAll, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const movementWindow = movementWindowFromFilters(filters)
  const movementThresholds = movementThresholdsFromFilters(filters)
  const DATABASE = ctx.database
  const rowLimit = limitAll ? 20000 : limit
  const period = resolveAssetValuationPeriod(filters)
  const now = new Date()
  const isCurrentActualPeriod = period.actualYear === now.getFullYear() && period.actualMonth === now.getMonth() + 1
  const useMonthEnd = period.requested && !isCurrentActualPeriod
  const whereSearch = textSearch(search, ['i.ItemCode', 'i.Description', 'i.ProdTypeCode', "ISNULL(pt.Description, '')", 'i.LocCode', "ISNULL(i.ProdCatCode, '')", "ISNULL(i.StockAnalysisCode, '')"])
  const location = sanitizeLike(filters?.location ?? '')
  const category = sanitizeLike(filters?.category ?? '')
  const movementCategory = sanitizeLike(filters?.movementCategory ?? '')
  const movementCategoryFilter = movementCategory ? `WHERE MovementCategory = N'${movementCategory}'` : ''
  const useMovementCategoryWindow = !movementCategory && !limitAll && shouldUseMovementCategoryWindow(filters)
  const locationFilter = location ? `AND RTRIM(i.LocCode) LIKE N'%${location}%'` : ''
  const taxonomyFilter = inventoryTaxonomyScopeFilter('i', filters)
  const categoryFilter = category
    ? `AND (
        RTRIM(ISNULL(i.ProdCatCode, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(i.ProdTypeCode, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(pt.Description, '')) LIKE N'%${category}%'
        OR RTRIM(ISNULL(i.StockAnalysisCode, '')) LIKE N'%${category}%'
      )`
    : ''
  const qtyOnHand = useMonthEnd ? 'ISNULL(m.Qty, 0)' : 'ISNULL(i.QtyOnHand, 0)'
  const qtyOnHold = useMonthEnd ? '0' : 'ISNULL(i.QtyOnHold, 0)'
  const qtyOnOrder = useMonthEnd ? '0' : 'ISNULL(i.QtyOnOrder, 0)'
  const unitCost = useMonthEnd
    ? 'COALESCE(NULLIF(m.AverageCost, 0), CASE WHEN ISNULL(m.Qty, 0) = 0 THEN 0 ELSE ISNULL(m.Amount, 0) / NULLIF(m.Qty, 0) END, 0)'
    : 'ISNULL(i.AverageCost, 0)'
  const totalQuantity = `${qtyOnHand} + ${qtyOnHold}`
  const quantityClosing = `${qtyOnHand} + ${qtyOnHold} + ${qtyOnOrder}`
  const totalAmount = useMonthEnd
    ? `(${totalQuantity}) * ${unitCost}`
    : '(i.QtyOnHand + i.QtyOnHold) * i.AverageCost'
  const totalAmountStored = totalAmount
  const workshopDate = workshopStockIssueDateExpression('s')
  const workshopDoc = workshopStockIssueDocumentExpression('s')
  const workshopAmount = workshopStockIssueAmountExpression('s')
  const itemTypeFilter = filters?.itemType?.toLowerCase()
  const itemTypeSql = itemTypeFilter === '1' || itemTypeFilter === 'gudang' ? "AND i.ItemType = '1'" : itemTypeFilter === '4' || itemTypeFilter === 'workshop' ? "AND i.ItemType = '4'" : warehouseInventoryItemTypeFilter('i')
  const issueMovementCtes = `
    issue_docs AS (
      SELECT
        raw.ItemCode,
        raw.LocCode,
        raw.StockIssueID,
        MAX(raw.PostDate) AS PostDate,
        SUM(ISNULL(raw.Qty, 0)) AS Qty,
        SUM(ISNULL(raw.Amount, 0)) AS Amount
      FROM (
        SELECT
          l.ItemCode,
          h.LocCode,
          RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS StockIssueID,
          h.PostDate AS PostDate,
          l.Qty AS Qty,
          l.Amount AS Amount
        FROM [${DATABASE}].[dbo].[IN_STOCKISSUELN] l
        INNER JOIN [${DATABASE}].[dbo].[IN_STOCKISSUE] h
          ON l.StockIssueID = h.StockIssueID
        INNER JOIN [${DATABASE}].[dbo].[IN_ITEM] issueItem
          ON issueItem.ItemCode = l.ItemCode
          AND issueItem.LocCode = h.LocCode
        WHERE h.PostDate >= '${movementWindow.startInclusive}'
          AND h.PostDate < '${movementWindow.endExclusive}'
          ${nonWorkshopItemTypeFilter('issueItem')}
        UNION ALL
        SELECT
          s.ItemCode,
          s.LocCode,
          ${workshopDoc} AS StockIssueID,
          ${workshopDate} AS PostDate,
          s.Qty AS Qty,
          ${workshopAmount} AS Amount
        FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] s
        INNER JOIN [${DATABASE}].[dbo].[IN_ITEM] issueItem
          ON issueItem.ItemCode = s.ItemCode
          AND issueItem.LocCode = s.LocCode
        WHERE RTRIM(ISNULL(s.TransType, '')) = '1'
          AND ${workshopStockIssueItemTypeExpression('issueItem', 's')} = '4'
          AND ${workshopDate} >= '${movementWindow.startInclusive}'
          AND ${workshopDate} < '${movementWindow.endExclusive}'
      ) raw
      GROUP BY raw.ItemCode, raw.LocCode, raw.StockIssueID
    ),
    issue_usage AS (
      SELECT
        ItemCode,
        LocCode,
        COUNT(*) AS StockIssueEventCount,
        CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS StockIssueQtyAllPeriod,
        CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS StockIssueAmountAllPeriod,
        MAX(PostDate) AS LastStockIssueDate
      FROM issue_docs
      GROUP BY ItemCode, LocCode
    ),
    ranked_issue_docs AS (
      SELECT
        ItemCode,
        LocCode,
        StockIssueID,
        PostDate,
        Qty,
        Amount,
        ROW_NUMBER() OVER (PARTITION BY ItemCode, LocCode ORDER BY PostDate DESC, StockIssueID DESC) AS rn,
        CONCAT(
          RTRIM(StockIssueID),
          ' | ',
          CONVERT(varchar(10), PostDate, 23),
          ' | Qty ',
          CONVERT(varchar(30), CAST(ISNULL(Qty, 0) AS DECIMAL(18,2))),
          ' | Amount ',
          CONVERT(varchar(30), CAST(ISNULL(Amount, 0) AS DECIMAL(18,2)))
        ) AS EventText
      FROM issue_docs
    ),
    latest_movement AS (
      SELECT
        ItemCode,
        LocCode,
        MAX(CASE WHEN rn = 1 THEN EventText END) AS MovementEvent1,
        MAX(CASE WHEN rn = 2 THEN EventText END) AS MovementEvent2,
        MAX(CASE WHEN rn = 1 THEN PostDate END) AS LastMovementDate
      FROM ranked_issue_docs
      WHERE rn <= 2
      GROUP BY ItemCode, LocCode
    ),
    issue_events AS (
      SELECT
        ItemCode,
        LocCode,
        MAX(CASE WHEN rn = 1 THEN EventText END) AS StockIssueEvent1,
        MAX(CASE WHEN rn = 2 THEN EventText END) AS StockIssueEvent2
      FROM ranked_issue_docs
      WHERE rn <= 2
      GROUP BY ItemCode, LocCode
    )`
  const issueMovementJoins = `
    LEFT JOIN issue_usage issueUsage
      ON issueUsage.ItemCode = i.ItemCode
      AND issueUsage.LocCode = i.LocCode
    LEFT JOIN latest_movement latestMovement
      ON latestMovement.ItemCode = i.ItemCode
      AND latestMovement.LocCode = i.LocCode
    LEFT JOIN issue_events issueEvents
      ON issueEvents.ItemCode = i.ItemCode
      AND issueEvents.LocCode = i.LocCode`
  const fromSql = useMonthEnd
    ? `
    FROM [${DATABASE}].[dbo].[IN_MTHENDITEM] m
    INNER JOIN [${DATABASE}].[dbo].[IN_ITEM] i
      ON i.ItemCode = m.ItemCode
      AND i.LocCode = m.LocCode
    OUTER APPLY (
      SELECT TOP 1 p.Description
      FROM [${DATABASE}].[dbo].[IN_PRODTYPE] p
      WHERE p.ProdTypeCode = i.ProdTypeCode
      ORDER BY p.ProdTypeCode
    ) pt
    ${issueMovementJoins}`
    : `
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    OUTER APPLY (
      SELECT TOP 1 p.Description
      FROM [${DATABASE}].[dbo].[IN_PRODTYPE] p
      WHERE p.ProdTypeCode = i.ProdTypeCode
      ORDER BY p.ProdTypeCode
    ) pt
    ${issueMovementJoins}`
  const periodWhere = useMonthEnd
    ? `
      AND RTRIM(CONVERT(varchar(10), m.AccYear)) = '${period.accYear}'
      AND TRY_CONVERT(int, NULLIF(RTRIM(CONVERT(varchar(10), m.AccMonth)), '')) = ${period.accMonth}`
    : ''
  const reportSql = `
    WITH ${issueMovementCtes},
    movement_analysis AS (
      SELECT
        ${period.accYear} AS acc_year,
        ${period.accMonth} AS acc_month,
        '${period.accountingPeriod}' AS accounting_period,
        ${period.actualYear} AS actual_year,
        ${period.actualMonth} AS actual_month,
        '${period.actualPeriod}' AS actual_period,
        CONVERT(date, '${period.actualPeriod}-01') AS ActualPeriodStart,
        '${useMonthEnd ? 'IN_MTHENDITEM' : 'IN_ITEM current balance'}' AS period_data_source,
        RTRIM(i.ProdTypeCode) AS product_type_code,
        RTRIM(ISNULL(pt.Description, i.ProdTypeCode)) AS product_type_description,
        RTRIM(i.LocCode) AS location,
        RTRIM(i.LocCode) AS Gudang,
        RTRIM(i.ItemCode) AS item_code,
        RTRIM(i.ItemCode) AS KodeBarang,
        RTRIM(i.Description) AS description,
        RTRIM(i.Description) AS NamaBarang,
        ${warehouseInventoryItemTypeExpression('i')} AS ItemType,
        CASE ${warehouseInventoryItemTypeExpression('i')}
          WHEN '1' THEN 'Stock'
          WHEN '4' THEN 'Workshop'
          ELSE ISNULL(${warehouseInventoryItemTypeExpression('i')}, '-')
        END AS ItemTypeName,
        CASE
          WHEN ${warehouseInventoryItemTypeExpression('i')} = '4' THEN 'WS_JOBSTOCK'
          ELSE 'STOCK_ISSUE_REGULAR'
        END AS MovementSource,
        CAST(CASE
          WHEN ${warehouseInventoryItemTypeExpression('i')} IN ('1', '4') THEN 1
          ELSE 0
        END AS INT) AS MovementSourceValid,
        RTRIM(i.UOMCode) AS uom,
        RTRIM(i.UOMCode) AS Satuan,
        NULLIF(RTRIM(i.ProdCatCode), '') AS product_category_code,
        NULLIF(RTRIM(i.ProdBrandCode), '') AS product_brand_code,
        NULLIF(RTRIM(i.ProdModelCode), '') AS product_model_code,
        NULLIF(RTRIM(i.ProdMatCode), '') AS product_material_code,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS KodeKategori,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS Kategori,
        NULLIF(RTRIM(i.StockAnalysisCode), '') AS stock_analysis_code,
        CAST(1 AS INT) AS ItemCurrent,
        CAST(${qtyOnHand} AS DECIMAL(18,2)) AS quantity_on_hand,
        CAST(${qtyOnHand} AS DECIMAL(18,2)) AS QtyOnHand,
        CAST(${qtyOnHold} AS DECIMAL(18,2)) AS quantity_on_hold,
        CAST(${qtyOnHold} AS DECIMAL(18,2)) AS QtyOnHold,
        CAST(${qtyOnOrder} AS DECIMAL(18,2)) AS quantity_on_order,
        CAST(${totalQuantity} AS DECIMAL(18,2)) AS total_quantity,
        CAST(${totalQuantity} AS DECIMAL(18,2)) AS QtyOnHandHold,
        CAST(${quantityClosing} AS DECIMAL(18,2)) AS QuantityClosing,
        CAST(${quantityClosing} AS DECIMAL(18,2)) AS StokAkhir,
        CAST(${unitCost} AS DECIMAL(18,2)) AS unit_cost,
        CAST(${unitCost} AS DECIMAL(18,2)) AS HargaSatuan,
        CAST(${unitCost} AS DECIMAL(18,2)) AS AverageCost,
        CAST(${totalAmountStored} AS DECIMAL(38,6)) AS AmountItem,
        CAST(${totalAmountStored} AS DECIMAL(38,6)) AS total_amount,
        CAST(${totalAmountStored} AS DECIMAL(38,6)) AS AmountCurrent,
        CAST(${totalAmountStored} AS DECIMAL(38,6)) AS TotalAmount,
        CAST(${totalAmountStored} AS DECIMAL(38,6)) AS NilaiStok,
        ${stockMovementAnalysisColumns(quantityClosing, movementThresholds)}
      ${fromSql}
      WHERE 1=1
        ${itemTypeSql}
        ${periodWhere}
        ${locationFilter}
        ${taxonomyFilter}
        ${categoryFilter}
        ${whereSearch}
    )`

  const movementPriorityOrder = `RiskScore DESC,
      TotalAmount DESC,
      StockIssueMovementCount DESC,
      LastMovementDate DESC`
  const reportRows = await rows(ctx, useMovementCategoryWindow
    ? `
    ${reportSql},
    ranked_movement_analysis AS (
      SELECT
        movement_analysis.*,
        ROW_NUMBER() OVER (
          PARTITION BY MovementCategory
          ORDER BY ${movementPriorityOrder}
        ) AS MovementCategoryWindowRank
      FROM movement_analysis
    )
    SELECT TOP ${rowLimit} *
    FROM ranked_movement_analysis
    ${movementCategoryFilter}
    ORDER BY
      MovementCategoryWindowRank ASC,
      ${movementCategoryRankSqlCase('MovementCategory')},
      ${movementPriorityOrder}
  `
    : `
    ${reportSql}
    SELECT TOP ${rowLimit} *
    FROM movement_analysis
    ${movementCategoryFilter}
    ORDER BY
      ${movementPriorityOrder}
  `)

  const summary = await first(ctx, `
    ${reportSql}
    SELECT
      ${period.accYear} AS acc_year,
      ${period.accMonth} AS acc_month,
      '${period.accountingPeriod}' AS accounting_period,
      ${period.actualYear} AS actual_year,
      ${period.actualMonth} AS actual_month,
      '${period.actualPeriod}' AS actual_period,
      '${useMonthEnd ? 'IN_MTHENDITEM' : 'IN_ITEM current balance'}' AS period_data_source,
      COUNT(*) AS TotalItem,
      COUNT(*) AS total_item,
      COUNT(DISTINCT product_type_code) AS total_product_type,
      COUNT(DISTINCT location) AS total_location,
      SUM(CASE WHEN MovementCategory = 'Fast Moving' THEN 1 ELSE 0 END) AS FastMovingItem,
      CAST(SUM(CASE WHEN MovementCategory = 'Fast Moving' THEN AmountItem ELSE 0 END) AS DECIMAL(38,6)) AS FastMovingAmount,
      SUM(CASE WHEN MovementCategory = 'Moving' THEN 1 ELSE 0 END) AS MovingItem,
      CAST(SUM(CASE WHEN MovementCategory = 'Moving' THEN AmountItem ELSE 0 END) AS DECIMAL(38,6)) AS MovingAmount,
      SUM(CASE WHEN MovementCategory = 'Slow Moving' THEN 1 ELSE 0 END) AS SlowMovingItem,
      CAST(SUM(CASE WHEN MovementCategory = 'Slow Moving' THEN AmountItem ELSE 0 END) AS DECIMAL(38,6)) AS SlowMovingAmount,
      SUM(CASE WHEN MovementCategory = 'Stale' THEN 1 ELSE 0 END) AS StaleItem,
      CAST(SUM(CASE WHEN MovementCategory = 'Stale' THEN AmountItem ELSE 0 END) AS DECIMAL(38,6)) AS StaleAmount,
      SUM(CASE WHEN MovementCategory = 'Stale' THEN 1 ELSE 0 END) AS NoMovementItem,
      CAST(SUM(CASE WHEN MovementCategory = 'Stale' THEN AmountItem ELSE 0 END) AS DECIMAL(38,6)) AS NoMovementAmount,
      SUM(CASE WHEN MovementCategory = 'Dead Stock' THEN 1 ELSE 0 END) AS DeadMovementItem,
      CAST(SUM(CASE WHEN MovementCategory = 'Dead Stock' THEN AmountItem ELSE 0 END) AS DECIMAL(38,6)) AS DeadMovementAmount,
      CAST(SUM(quantity_on_hand) AS DECIMAL(18,2)) AS total_quantity_on_hand,
      CAST(SUM(quantity_on_hold) AS DECIMAL(18,2)) AS total_quantity_on_hold,
      CAST(SUM(total_quantity) AS DECIMAL(18,2)) AS total_quantity,
      CAST(SUM(QuantityClosing) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(AmountItem) AS DECIMAL(38,6)) AS total_amount,
      CAST(SUM(AmountItem) AS DECIMAL(38,6)) AS TotalAmount,
      CAST(SUM(AmountItem) AS DECIMAL(38,6)) AS TotalAssetAmount,
      CAST(SUM(StockIssueMovementCount) AS DECIMAL(18,2)) AS TotalStockIssueMovementCount,
      CAST(SUM(StockIssueMovementQty) AS DECIMAL(18,2)) AS TotalStockIssueMovementQty,
      CAST(SUM(StockIssueMovementAmount) AS DECIMAL(38,6)) AS TotalStockIssueMovementAmount,
      CAST(SUM(StockIssueMovementCount) AS DECIMAL(18,2)) AS TotalStockIssueEvent,
      CAST(SUM(StockIssueMovementQty) AS DECIMAL(18,2)) AS TotalStockIssueQty,
      CAST(SUM(StockIssueMovementAmount) AS DECIMAL(38,6)) AS TotalStockIssueAmount,
      CAST(SUM(AmountItem) AS DECIMAL(38,6)) AS TotalAmountItem,
      SUM(CASE WHEN ItemType = '4' THEN 1 ELSE 0 END) AS ItemType4WorkshopItem,
      SUM(CASE WHEN ItemType = '4' AND MovementSource = 'WS_JOBSTOCK' THEN 1 ELSE 0 END) AS ItemType4WorkshopSourceValid,
      SUM(CASE WHEN ItemType = '4' AND MovementSource <> 'WS_JOBSTOCK' THEN 1 ELSE 0 END) AS ItemType4WorkshopSourceInvalid,
      SUM(CASE WHEN MovementSource IS NULL OR RTRIM(MovementSource) = '' THEN 1 ELSE 0 END) AS MovementSourceMissing,
      SUM(CASE WHEN MovementSourceValid = 0 THEN 1 ELSE 0 END) AS MovementSourceInvalid,
      CAST(SUM(CASE WHEN ItemType = '4' THEN StockIssueMovementCount ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopStockIssueMovementCount,
      CAST(SUM(CASE WHEN ItemType = '1' THEN StockIssueMovementCount ELSE 0 END) AS DECIMAL(18,2)) AS RegularStockIssueMovementCount,
      MAX(LastMovementDate) AS LastMovementDate
    FROM movement_analysis
    ${movementCategoryFilter}
  `)

  const chart = await rows(ctx, `
    ${reportSql}
    SELECT TOP 12
      MovementCategory AS Label,
      MovementCategory,
      COUNT(*) AS TotalItem,
      CAST(SUM(total_quantity) AS DECIMAL(18,2)) AS Qty,
      CAST(SUM(AmountItem) AS DECIMAL(38,6)) AS AssetAmountRealTime,
      CAST(SUM(StockIssueMovementCount) AS DECIMAL(18,2)) AS StockIssueMovementCount,
      CAST(SUM(StockIssueMovementQty) AS DECIMAL(18,2)) AS StockIssueMovementQty,
      CAST(SUM(StockIssueMovementAmount) AS DECIMAL(38,6)) AS StockIssueMovementAmount
    FROM movement_analysis
    ${movementCategoryFilter}
    GROUP BY MovementCategory
    ORDER BY
      ${movementCategoryRankSqlCase('MovementCategory')},
      AssetAmountRealTime DESC
  `)

  return {
    title: 'ALL Stock Movement Analysis Real Time',
    description: 'Analisis movement real-time per item dari IN_ITEM current stock: kategori movement dihitung dari jumlah stock issue, lengkap dengan qty, amount asset, dan event movement terakhir.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: useMonthEnd ? 'IN_MTHENDITEM, IN_ITEM, IN_PRODTYPE, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK' : 'IN_ITEM, IN_PRODTYPE, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      period: period.actualPeriod,
      actualPeriod: period.actualPeriod,
      actualYear: period.actualYear,
      actualMonth: period.actualMonth,
      accountingPeriod: period.accountingPeriod,
      accYear: period.accYear,
      accMonth: period.accMonth,
      periodInputMode: period.inputMode,
      periodDataSource: useMonthEnd ? 'IN_MTHENDITEM period snapshot untuk valuation historis; StockIssue Movement dari transaksi stock issue valid' : 'IN_ITEM current stock real-time untuk valuation; StockIssue Movement dari transaksi stock issue valid',
      itemTypeScope: 'IN_ITEM.ItemType IN (1, 4): Stock dan Workshop.',
      statusScope: 'Tidak filter Status; scope mengikuti IN_ITEM WHERE ItemType IN (1, 4).',
      quantityRule: useMonthEnd ? 'Histori: total_quantity = IN_MTHENDITEM.Qty.' : 'Current: total_quantity = QtyOnHand + QtyOnHold; QuantityClosing = QtyOnHand + QtyOnHold + QtyOnOrder.',
      valuationRule: useMonthEnd ? 'Histori: AmountItem = IN_MTHENDITEM.Qty * AverageCost.' : 'Current: TotalAssetAmount = SUM((QtyOnHand + QtyOnHold) * AverageCost) FROM IN_ITEM WHERE ItemType IN (1, 4).',
      movementRule: `MovementCategory dihitung dari StockIssue Movement Count per item: ${movementCategoryThresholdLabel(movementThresholds)}. Dead Stock jika stok real-time ada tapi StockIssue Movement 0, Stale jika stok real-time dan StockIssue Movement 0.`,
      movementCategoryThresholds: movementThresholds,
      movementCategoryThresholdLabel: movementCategoryThresholdLabel(movementThresholds),
      issueUsageRule: 'StockIssue Movement: ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK.TransType = 1. Asset Amount Real Time tetap berasal dari IN_ITEM (QtyOnHand + QtyOnHold) * AverageCost.',
      movementSourceRule: 'MovementSource dinormalisasi per row: ItemType 4 = WS_JOBSTOCK, ItemType 1 = STOCK_ISSUE_REGULAR.',
      movementSourceQuality: {
        itemType4WorkshopItem: summary.ItemType4WorkshopItem,
        itemType4WorkshopSourceValid: summary.ItemType4WorkshopSourceValid,
        itemType4WorkshopSourceInvalid: summary.ItemType4WorkshopSourceInvalid,
        movementSourceMissing: summary.MovementSourceMissing,
        movementSourceInvalid: summary.MovementSourceInvalid,
      },
      activeFilter: 'Semua IN_ITEM current stock real-time ItemType 1 dan 4.',
      summaryScope: 'Full data aggregation; tidak mengikuti limit/pagination rows table.',
      tableRowsScope: limitAll ? 'Full listing request/export.' : 'Rows table dipaginasi untuk render cepat; summary tetap full dataset.',
      totalRows: summary.TotalItem,
      filteredRows: summary.TotalItem,
      movementCategoryOrder: MOVEMENT_CATEGORY_ORDER.join(', '),
      groupWindowField: useMovementCategoryWindow ? 'MovementCategory' : undefined,
      groupWindowStrategy: useMovementCategoryWindow ? 'balanced' : 'ranked',
      loadedMovementCategoryGroups: movementCategoryLoadedGroups(reportRows),
      loadedMovementCategoryCounts: JSON.stringify(countMovementCategoryRows(reportRows)),
      movementCategoryFilter: movementCategory || undefined,
      primaryChart: 'Item by Movement Category',
      availableCharts: ['Item by Movement Category', 'Stock issue event by movement category', 'Movement qty and amount by category', 'Top movement items'],
      qualityFocus: ['MovementCategory', 'MovementSource', 'StockIssueMovementCount', 'StockIssueMovementQty', 'StockIssueMovementAmount', 'LastMovementDate'],
    }),
  }
}
async function stockCard({ limit, search, ctx, stale, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereAge = staleFilterByRange('i', stale)
  const labelAge = staleRangeLabel(stale)
  const quantityClosing = quantityClosingExpression('i')
  const movementThresholds = movementThresholdsFromFilters(filters)
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(i.ItemCode) AS KodeBarang,
      RTRIM(i.Description) AS NamaBarang,
      RTRIM(i.LocCode) AS Gudang,
      RTRIM(ISNULL(i.ProdCatCode, '-')) AS KodeKategori,
      CAST(${quantityClosing} AS DECIMAL(18,2)) AS QuantityClosing,
      ${stockIssueUsageColumns(quantityClosing, movementThresholds)},
      CAST(${quantityClosing} * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS NilaiStok,
      CASE WHEN ${quantityClosing} = 0 THEN 1 ELSE 0 END AS FlagStokNol,
      CASE WHEN i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = '' OR RTRIM(i.ProdCatCode) = '0' THEN 1 ELSE 0 END AS FlagTanpaKategori,
      CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END AS FlagTanpaIssueValid,
      CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate < DATEADD(MONTH, -12, GETDATE()) THEN 1 ELSE 0 END AS FlagUpdateStale,
      i.LastIssueDate AS TerakhirIssue,
      i.LastOrderDate AS TerakhirOrder,
      i.UpdateDate AS TerakhirUpdate,
      DATEDIFF(MONTH, ISNULL(i.UpdateDate, GETDATE()), GETDATE()) AS UmurBulan,
      CASE
        WHEN i.UpdateDate IS NULL THEN 'Belum pernah update'
        WHEN DATEDIFF(DAY, i.UpdateDate, GETDATE()) < 30 THEN CONCAT(DATEDIFF(DAY, i.UpdateDate, GETDATE()), ' hari')
        WHEN DATEDIFF(MONTH, i.UpdateDate, GETDATE()) < 12 THEN CONCAT(DATEDIFF(MONTH, i.UpdateDate, GETDATE()), ' bulan')
        ELSE CONCAT(DATEDIFF(MONTH, i.UpdateDate, GETDATE()) / 12, ' tahun ', DATEDIFF(MONTH, i.UpdateDate, GETDATE()) % 12, ' bulan')
      END AS UmurItem
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      ${whereAge}
      ${itemSearch('i', search)}
    ORDER BY
      CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END DESC,
      DATEDIFF(MONTH, ISNULL(i.UpdateDate, GETDATE()), GETDATE()) DESC,
      ${quantityClosing} * ISNULL(i.AverageCost, 0) DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(*) AS TotalItem,
      SUM(CASE WHEN ${quantityClosing} = 0 THEN 1 ELSE 0 END) AS ItemStokNol,
      SUM(CASE WHEN i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = '' OR RTRIM(i.ProdCatCode) = '0' THEN 1 ELSE 0 END) AS ItemTanpaKategori,
      SUM(CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END) AS ItemTanpaIssueValid,
      SUM(CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate < DATEADD(MONTH, -12, GETDATE()) THEN 1 ELSE 0 END) AS ItemUpdateLebih12Bulan,
      SUM(CASE WHEN ISNULL(i.QtyOnOrder, 0) > 0 THEN 1 ELSE 0 END) AS ItemOnOrder,
      CAST(SUM(${quantityClosing} * ISNULL(i.AverageCost, 0)) AS DECIMAL(18,2)) AS NilaiPersediaan,
      MAX(i.UpdateDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
  `)

  const chart = await rows(ctx, `
    WITH stock_flags AS (
      SELECT
        CASE WHEN ${quantityClosing} = 0 THEN 1 ELSE 0 END AS StokNol,
        CASE WHEN i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) = '' OR RTRIM(i.ProdCatCode) = '0' THEN 1 ELSE 0 END AS TanpaKategori,
        CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END AS TanpaIssueValid,
        CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate < DATEADD(MONTH, -12, GETDATE()) THEN 1 ELSE 0 END AS UpdateStale
      FROM [${DATABASE}].[dbo].[IN_ITEM] i
      ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
      WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
    )
    SELECT 'Stok Nol' AS QualityFlag, SUM(StokNol) AS TotalItem FROM stock_flags
    UNION ALL
    SELECT 'Tanpa Kategori', SUM(TanpaKategori) FROM stock_flags
    UNION ALL
    SELECT 'Tanpa Issue Valid', SUM(TanpaIssueValid) FROM stock_flags
    UNION ALL
    SELECT 'Update > 12 Bulan', SUM(UpdateStale) FROM stock_flags
  `)

  return {
    title: 'Item Movement & Update Tracking',
    description: `Pantau item berdasarkan umur UpdateDate. Filter: ${labelAge}. Include audit stok nol, kategori kosong, dan item tanpa issue valid.`,
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_ITEM, IN_ITEMCODE, IN_PRODCAT, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      quantityRule: 'QuantityClosing = QtyOnHand + QtyOnHold + QtyOnOrder',
      issueUsageRule: 'ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK.TransType = 1.',
      primaryChart: 'Distribusi Quality Flags',
      availableCharts: ['Distribusi Quality Flags', 'Item Stale per Gudang', 'Top Item Stale Bernilai Besar'],
      qualityFocus: ['ItemStokNol', 'ItemTanpaKategori', 'ItemTanpaIssueValid', 'ItemUpdateLebih12Bulan'],
      activeFilter: labelAge,
    }),
  }
}

async function stockMovement({ limit, search, ctx }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['Dokumen', 'KodeBarang', 'NamaBarang', 'JenisMutasi'])
  const maxTransactionDate = 'DATEADD(DAY, 1, CONVERT(date, GETDATE()))'
  const workshopDate = workshopStockIssueDateExpression('s')
  const workshopDoc = workshopStockIssueDocumentExpression('s')
  const workshopAmount = workshopStockIssueAmountExpression('s')
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit} *
    FROM (
      SELECT
        'Keluar' AS JenisMutasi,
        RTRIM(h.StockIssueID) AS Dokumen,
        h.StockIssueRefDate AS Tanggal,
        RTRIM(h.LocCode) AS Gudang,
        RTRIM(l.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
        RTRIM(l.AccCode) AS AccCode,
        RTRIM(l.BlkCode) AS BlkCode,
        RTRIM(l.VehCode) AS VehCode
      FROM [${DATABASE}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.StockIssueRefDate >= '2000-01-01'
        AND h.StockIssueRefDate < ${maxTransactionDate}
        ${nonWorkshopItemTypeFilter('i')}
      UNION ALL
      SELECT
        'Keluar Workshop' AS JenisMutasi,
        RTRIM(${workshopDoc}) AS Dokumen,
        ${workshopDate} AS Tanggal,
        RTRIM(s.LocCode) AS Gudang,
        RTRIM(s.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, s.ItemCode)) AS NamaBarang,
        CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(${workshopAmount} AS DECIMAL(18,2)) AS Amount,
        RTRIM(ISNULL(s.AccCode, '')) AS AccCode,
        RTRIM(COALESCE(NULLIF(RTRIM(s.BlkCode), ''), NULLIF(RTRIM(j.BlkCode), ''), '')) AS BlkCode,
        RTRIM(COALESCE(NULLIF(RTRIM(s.VehCode), ''), NULLIF(RTRIM(j.VehCode), ''), '')) AS VehCode
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DATABASE}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${workshopDate} >= '2000-01-01'
        AND ${workshopDate} < ${maxTransactionDate}
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND ${workshopStockIssueItemTypeExpression('i', 's')} = '4'
      UNION ALL
      SELECT
        'Masuk',
        RTRIM(h.StockReceiveID),
        h.StockRefDate,
        RTRIM(h.LocCode),
        RTRIM(l.ItemCode),
        RTRIM(ISNULL(i.Description, l.ItemCode)),
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)),
        CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)),
        RTRIM(l.AccCode),
        RTRIM(l.BlkCode),
        RTRIM(l.VehCode)
      FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.StockRefDate >= '2000-01-01'
        AND h.StockRefDate < ${maxTransactionDate}
      UNION ALL
      SELECT
        'Masuk Good Receipt',
        RTRIM(h.GoodsRcvID),
        h.CreateDate,
        RTRIM(h.LocCode),
        RTRIM(l.ItemCode),
        RTRIM(ISNULL(i.Description, l.ItemCode)),
        CAST(ISNULL(NULLIF(l.StockQty, 0), ISNULL(l.ReceiveQty, 0)) AS DECIMAL(18,2)),
        CAST(COALESCE(NULLIF(l.CommAmount, 0), ISNULL(l.ReceiveQty, 0) * ISNULL(p.Cost, 0), 0) AS DECIMAL(18,2)),
        RTRIM(l.AccCode),
        RTRIM(ISNULL(l.BlkCode, '')),
        RTRIM(ISNULL(l.VehCode, ''))
      FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l
      INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
      LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
      OUTER APPLY (
        SELECT TOP 1 item.Description
        FROM [${DATABASE}].[dbo].[IN_ITEM] item
        WHERE item.ItemCode = l.ItemCode
        ORDER BY CASE WHEN item.LocCode = h.LocCode THEN 0 ELSE 1 END, item.UpdateDate DESC
      ) i
      WHERE h.CreateDate >= '2000-01-01'
        AND h.CreateDate < ${maxTransactionDate}
      UNION ALL
      SELECT
        'Transfer',
        RTRIM(h.StockTransferID),
        h.StockTransferDate,
        RTRIM(h.LocCode) + ' -> ' + RTRIM(h.ToLocCode),
        RTRIM(l.ItemCode),
        RTRIM(ISNULL(i.Description, l.ItemCode)),
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)),
        CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)),
        '-' AS AccCode,
        '-' AS BlkCode,
        '-' AS VehCode
      FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFERLN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKTRANSFER] h ON l.StockTransferID = h.StockTransferID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.StockTransferDate >= '2000-01-01'
        AND h.StockTransferDate < ${maxTransactionDate}
    ) movement
    WHERE 1=1 ${whereSearch}
    ORDER BY Tanggal DESC, Dokumen DESC
  `)

  const summary = await first(ctx, `
    WITH keluar AS (
      SELECT
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
        h.StockIssueRefDate AS Tanggal,
        l.ItemCode,
        l.Qty,
        l.Amount
      FROM [${DATABASE}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.StockIssueRefDate >= '2000-01-01'
        AND h.StockIssueRefDate < ${maxTransactionDate}
        ${nonWorkshopItemTypeFilter('i')}
      UNION ALL
      SELECT
        ${workshopDoc} AS Dokumen,
        ${workshopDate} AS Tanggal,
        s.ItemCode,
        s.Qty,
        ${workshopAmount} AS Amount
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${workshopDate} >= '2000-01-01'
        AND ${workshopDate} < ${maxTransactionDate}
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND ${workshopStockIssueItemTypeExpression('i', 's')} = '4'
    )
    SELECT
      (SELECT COUNT(*) FROM keluar) AS BarisKeluar,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVELN] l INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID WHERE h.StockRefDate >= '2000-01-01' AND h.StockRefDate < ${maxTransactionDate})
        + (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID WHERE h.CreateDate >= '2000-01-01' AND h.CreateDate < ${maxTransactionDate}) AS BarisMasuk,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVELN] l INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID WHERE h.StockRefDate >= '2000-01-01' AND h.StockRefDate < ${maxTransactionDate}) AS BarisMasukStockReceive,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID WHERE h.CreateDate >= '2000-01-01' AND h.CreateDate < ${maxTransactionDate}) AS BarisMasukGoodReceipt,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFERLN] l INNER JOIN [${DATABASE}].[dbo].[IN_STOCKTRANSFER] h ON l.StockTransferID = h.StockTransferID WHERE h.StockTransferDate >= '2000-01-01' AND h.StockTransferDate < ${maxTransactionDate}) AS BarisTransfer,
      (SELECT CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) FROM keluar) AS NilaiKeluar,
      CAST(
        ISNULL((SELECT SUM(ISNULL(l.Amount, 0)) FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVELN] l INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID WHERE h.StockRefDate >= '2000-01-01' AND h.StockRefDate < ${maxTransactionDate}), 0)
        + ISNULL((SELECT SUM(COALESCE(NULLIF(l.CommAmount, 0), ISNULL(l.ReceiveQty, 0) * ISNULL(p.Cost, 0), 0)) FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID WHERE h.CreateDate >= '2000-01-01' AND h.CreateDate < ${maxTransactionDate}), 0)
        AS DECIMAL(18,2)
      ) AS NilaiMasuk,
      (SELECT CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVELN] l INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRECEIVE] h ON l.StockReceiveID = h.StockReceiveID WHERE h.StockRefDate >= '2000-01-01' AND h.StockRefDate < ${maxTransactionDate}) AS NilaiMasukStockReceive,
      (SELECT CAST(SUM(COALESCE(NULLIF(l.CommAmount, 0), ISNULL(l.ReceiveQty, 0) * ISNULL(p.Cost, 0), 0)) AS DECIMAL(18,2)) FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID WHERE h.CreateDate >= '2000-01-01' AND h.CreateDate < ${maxTransactionDate}) AS NilaiMasukGoodReceipt,
      (SELECT MAX(MaxDate) FROM (VALUES
        ((SELECT MAX(Tanggal) FROM keluar)),
        ((SELECT MAX(StockRefDate) FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVE] WHERE StockRefDate >= '2000-01-01' AND StockRefDate < ${maxTransactionDate})),
        ((SELECT MAX(CreateDate) FROM [${DATABASE}].[dbo].[PU_GOODSRCV] WHERE CreateDate >= '2000-01-01' AND CreateDate < ${maxTransactionDate})),
        ((SELECT MAX(StockTransferDate) FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFER] WHERE StockTransferDate >= '2000-01-01' AND StockTransferDate < ${maxTransactionDate}))
      ) AS dates(MaxDate)) AS TerakhirUpdate
  `)

  const chart = await rows(ctx, `
    WITH MovementRaw AS (
      SELECT 'Keluar' AS Jenis, CONVERT(char(7), h.StockIssueRefDate, 120) AS Periode, SUM(ISNULL(l.Qty,0)) AS Qty, SUM(ISNULL(l.Amount,0)) AS Amount
      FROM [${DATABASE}].[dbo].[IN_STOCKISSUE] h JOIN [${DATABASE}].[dbo].[IN_STOCKISSUELN] l ON l.StockIssueID=h.StockIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.StockIssueRefDate >= '2025-05-01'
        AND h.StockIssueRefDate < ${maxTransactionDate}
        ${nonWorkshopItemTypeFilter('i')}
      GROUP BY CONVERT(char(7), h.StockIssueRefDate, 120)
      UNION ALL
      SELECT 'Keluar', CONVERT(char(7), ${workshopDate}, 120), SUM(ISNULL(s.Qty,0)), SUM(${workshopAmount})
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${workshopDate} >= '2025-05-01'
        AND ${workshopDate} < ${maxTransactionDate}
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND ${workshopStockIssueItemTypeExpression('i', 's')} = '4'
      GROUP BY CONVERT(char(7), ${workshopDate}, 120)
      UNION ALL
      SELECT 'Masuk', CONVERT(char(7), h.StockRefDate, 120), SUM(ISNULL(l.Qty,0)), SUM(ISNULL(l.Amount,0))
      FROM [${DATABASE}].[dbo].[IN_STOCKRECEIVE] h JOIN [${DATABASE}].[dbo].[IN_STOCKRECEIVELN] l ON l.StockReceiveID=h.StockReceiveID
      WHERE h.StockRefDate >= '2025-05-01'
        AND h.StockRefDate < ${maxTransactionDate}
      GROUP BY CONVERT(char(7), h.StockRefDate, 120)
      UNION ALL
      SELECT 'Masuk', CONVERT(char(7), h.CreateDate, 120), SUM(ISNULL(NULLIF(l.StockQty, 0), ISNULL(l.ReceiveQty,0))), SUM(COALESCE(NULLIF(l.CommAmount, 0), ISNULL(l.ReceiveQty,0) * ISNULL(p.Cost,0), 0))
      FROM [${DATABASE}].[dbo].[PU_GOODSRCV] h
      JOIN [${DATABASE}].[dbo].[PU_GOODSRCVLN] l ON l.GoodsRcvID=h.GoodsRcvID
      LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID=p.POLnID
      WHERE h.CreateDate >= '2025-05-01'
        AND h.CreateDate < ${maxTransactionDate}
      GROUP BY CONVERT(char(7), h.CreateDate, 120)
      UNION ALL
      SELECT 'Transfer', CONVERT(char(7), h.StockTransferDate, 120), SUM(ISNULL(l.Qty,0)), SUM(ISNULL(l.Amount,0))
      FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFER] h JOIN [${DATABASE}].[dbo].[IN_STOCKTRANSFERLN] l ON l.StockTransferID=h.StockTransferID
      WHERE h.StockTransferDate >= '2025-05-01'
        AND h.StockTransferDate < ${maxTransactionDate}
      GROUP BY CONVERT(char(7), h.StockTransferDate, 120)
    ),
    Movement AS (
      SELECT Jenis, Periode, SUM(Qty) AS Qty, SUM(Amount) AS Amount
      FROM MovementRaw
      GROUP BY Jenis, Periode
    )
    SELECT TOP 36 Periode + ' ' + Jenis AS Label, Periode, Jenis, CAST(Qty AS DECIMAL(18,2)) AS Qty, CAST(Amount AS DECIMAL(18,2)) AS Amount
    FROM Movement
    ORDER BY Periode DESC, Jenis
  `)

  return {
    title: 'Movement Stock',
    description: 'Pergerakan fisik barang — barang masuk, keluar, dan transfer antar gudang berdasarkan transaksi valid. Track movement terakhir dan trend perubahan stok.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_STOCKISSUE/LN, WS_JOBSTOCK, IN_STOCKRECEIVE/LN, PU_GOODSRCV/LN, IN_STOCKTRANSFER/LN',
      primaryChart: 'Mutasi Masuk vs Keluar per Bulan',
      availableCharts: ['Mutasi Masuk vs Keluar per Bulan', 'Top Barang Bergerak', 'Bulan Tidak Muncul'],
      qualityFocus: ['ItemType 4 Workshop keluar dibaca dari WS_JOBSTOCK.TransType = 1.', 'Goods receipt masuk memakai PU_GOODSRCV.CreateDate dan PU_GOODSRCVLN.StockQty/ReceiveQty.', 'Tanggal IN_STOCK memakai StockIssueRefDate, StockRefDate, dan StockTransferDate.', 'Tanggal transaksi future dikeluarkan dari movement valid.', 'missing period'],
    }),
  }
}

async function monthlyStockAccountMovementDetails({ limit, limitAll, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  // Honor period OR accYear+accMonth from detail-page Apply control.
  const reportPeriod = resolveAssetValuationPeriod(filters)
  const actualPeriod = reportPeriod.actualPeriod
  const openingPeriod = previousAccountingPeriod(reportPeriod.accYear, reportPeriod.accMonth)
  const openingActualPeriod = accountingToActualPeriod(openingPeriod.accYear, openingPeriod.accMonth)?.actualPeriod ?? ''
  const location = cleanLocationCode(filters?.location)
  const stockAnalysisCode = cleanStockAccountMovementAnalysisCode(filters?.category ?? filters?.stockAnalysis)
  const productTypeCode = cleanInventoryCode(filters?.productType)
  const productCategoryCode = cleanInventoryCode(filters?.productCategory)
  const productBrandCode = cleanInventoryCode(filters?.productBrand)
  const productModelCode = cleanInventoryCode(filters?.productModel)
  const productMaterialCode = cleanInventoryCode(filters?.productMaterial)
  const itemTypeScope = cleanWarehouseItemTypeScope(filters?.itemType)
  const transactionAsOf = cleanTransactionAsOf(filters?.dateTo)
  const movementWindow = movementWindowFromFilters(filters)
  const movementThresholds = movementThresholdsFromFilters(filters)
  const analysisGroupKey = cleanMonthlyAnalysisGroup(filters?.groupBy ?? filters?.chartDimension)
  const analysisGroup = monthlyAnalysisGroups[analysisGroupKey]
  const stockAnalysisDefaultScope = analysisGroupKey === 'StockAnalysisCode' && !stockAnalysisCode
  const rowNumberPartitionSql = analysisGroupKey === 'MovementCategory' ? 'b.StockAnalysisCode' : `b.${analysisGroup.sql}`
  const reportOrderSql = analysisGroupKey === 'MovementCategory'
    ? `${movementCategoryRankSqlCase('MovementCategory')}, ItemCode`
    : `${analysisGroup.sql}, ItemCode`
  // GUARDRAIL(monthly-detail-balanced-groups):
  // Interactive detail windows must show every selected analysis group early.
  // Official/export order remains grouped; non-export rows use RowNo-first order
  // so groups like ProductTypeCode=VSPARE are visible on page 1 instead of being
  // hidden behind large earlier buckets such as SUND.
  const detailOrderSql = limitAll ? reportOrderSql : `[No], ${reportOrderSql}`
  const analysisGroupNameSelect = analysisGroup.nameSql ? `MAX(NULLIF(${analysisGroup.nameSql}, '')) AS DimensionName,` : ''
  const movementCategoryScope = cleanMonthlyMovementCategory(filters?.movementCategory)
  const movementCategoryWhere = movementCategoryScope ? `WHERE MovementCategory = '${movementCategoryScope}'` : ''
  const ctes = monthlyStockAccountMovementCtes({
    database: DATABASE,
    location,
    reportAccYear: reportPeriod.accYear,
    reportAccMonth: reportPeriod.accMonth,
    openingAccYear: openingPeriod.accYear,
    openingAccMonth: openingPeriod.accMonth,
    actualPeriod,
    openingActualPeriod,
    search,
    stockAnalysisCode,
    productTypeCode,
    productCategoryCode,
    productBrandCode,
    productModelCode,
    productMaterialCode,
    itemTypeScope,
    stockAnalysisDefaultScope,
    rowNumberPartitionSql,
    transactionAsOf,
    movementWindow,
    movementThresholds,
  })

  const reportRows = await rows(ctx, `
    ${ctes}
    SELECT TOP ${limit} *
    FROM report_rows
    ${movementCategoryWhere}
    ORDER BY ${detailOrderSql}
  `)

  const summary = await first(ctx, `
    ${ctes}
    SELECT
      Location,
      ActualPeriod,
      AccountingPeriod,
      OpeningActualPeriod,
      OpeningAccountingPeriod,
      COUNT(*) AS TotalItem,
      SUM(CASE WHEN ItemType = '1' THEN 1 ELSE 0 END) AS StockGudangItem,
      SUM(CASE WHEN ItemType = '4' THEN 1 ELSE 0 END) AS WorkshopMesinItem,
      COUNT(DISTINCT StockAnalysisCode) AS TotalStockAnalysis,
      COUNT(DISTINCT MovementCategory) AS TotalMovementCategory,
      COUNT(DISTINCT ProductTypeCode) AS TotalProductType,
      COUNT(DISTINCT ProductCategoryCode) AS TotalProductCategory,
      COUNT(DISTINCT ProductBrandCode) AS TotalProductBrand,
      COUNT(DISTINCT ProductModelCode) AS TotalProductModel,
      COUNT(DISTINCT ProductMaterialCode) AS TotalProductMaterial,
      SUM(CASE WHEN MovementCategory = 'Fast Moving' THEN 1 ELSE 0 END) AS FastMovingItem,
      SUM(CASE WHEN MovementCategory = 'Moving' THEN 1 ELSE 0 END) AS MovingItem,
      SUM(CASE WHEN MovementCategory = 'Slow Moving' THEN 1 ELSE 0 END) AS SlowMovingItem,
      SUM(CASE WHEN MovementCategory = 'Dead Stock' THEN 1 ELSE 0 END) AS DeadStockItem,
      SUM(CASE WHEN MovementCategory = 'Stale' THEN 1 ELSE 0 END) AS StaleItem,
      CAST(SUM(MovementActivityCountActual) AS DECIMAL(18,2)) AS TotalMovementActivityCountActual,
      CAST(SUM(MovementActivityQtyActual) AS DECIMAL(18,2)) AS TotalMovementActivityQtyActual,
      CAST(SUM(MovementActivityAmountActual) AS DECIMAL(18,2)) AS TotalMovementActivityAmountActual,
      CAST(SUM(StockIssueDocumentCountActual) AS DECIMAL(18,2)) AS TotalStockIssueDocumentCountActual,
      CAST(SUM(MovementIssueCountActual) AS DECIMAL(18,2)) AS TotalMovementIssueCountActual,
      CAST(SUM(MovementIssueQtyActual) AS DECIMAL(18,2)) AS TotalMovementIssueQtyActual,
      CAST(SUM(MovementIssueAmountActual) AS DECIMAL(18,2)) AS TotalMovementIssueAmountActual,
      CAST(SUM(QtyOnHand) AS DECIMAL(18,2)) AS QtyOnHand,
      CAST(SUM(QtyOnHold) AS DECIMAL(18,2)) AS QtyOnHold,
      CAST(SUM(QtyOnHandHold) AS DECIMAL(18,2)) AS QtyOnHandHold,
      CAST(SUM(OnHandHoldAmount) AS DECIMAL(18,2)) AS OnHandHoldAmount,
      CAST(SUM(CASE WHEN ItemType = '1' THEN QtyOnHandHold ELSE 0 END) AS DECIMAL(18,2)) AS StockGudangQtyOnHandHold,
      CAST(SUM(CASE WHEN ItemType = '1' THEN OnHandHoldAmount ELSE 0 END) AS DECIMAL(18,2)) AS StockGudangOnHandHoldAmount,
      CAST(SUM(CASE WHEN ItemType = '4' THEN QtyOnHandHold ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopMesinQtyOnHandHold,
      CAST(SUM(CASE WHEN ItemType = '4' THEN OnHandHoldAmount ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopMesinOnHandHoldAmount,
      CAST(SUM(OpeningQty) AS DECIMAL(18,2)) AS OpeningQty,
      CAST(SUM(OpeningAmount) AS DECIMAL(18,2)) AS OpeningAmount,
      CAST(SUM(CASE WHEN ItemType = '1' THEN OpeningAmount ELSE 0 END) AS DECIMAL(18,2)) AS StockGudangOpeningAmount,
      CAST(SUM(CASE WHEN ItemType = '4' THEN OpeningAmount ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopMesinOpeningAmount,
      CAST(SUM(ReceivedQty) AS DECIMAL(18,2)) AS ReceivedQty,
      CAST(SUM(ReceivedAmount) AS DECIMAL(18,2)) AS ReceivedAmount,
      CAST(SUM(ReturnAdviceQty) AS DECIMAL(18,2)) AS ReturnAdviceQty,
      CAST(SUM(ReturnAdviceAmount) AS DECIMAL(18,2)) AS ReturnAdviceAmount,
      CAST(SUM(TransferredQty) AS DECIMAL(18,2)) AS TransferredQty,
      CAST(SUM(TransferredAmount) AS DECIMAL(18,2)) AS TransferredAmount,
      CAST(SUM(AdjustmentQty) AS DECIMAL(18,2)) AS AdjustmentQty,
      CAST(SUM(AdjustmentAmount) AS DECIMAL(18,2)) AS AdjustmentAmount,
      CAST(SUM(LedgerQty) AS DECIMAL(18,2)) AS LedgerQty,
      CAST(SUM(LedgerAmount) AS DECIMAL(18,2)) AS LedgerAmount,
      CAST(SUM(IssuedStationQty) AS DECIMAL(18,2)) AS IssuedStationQty,
      CAST(SUM(IssuedStationAmount) AS DECIMAL(18,2)) AS IssuedStationAmount,
      CAST(SUM(IssuedVehicleQty) AS DECIMAL(18,2)) AS IssuedVehicleQty,
      CAST(SUM(IssuedVehicleAmount) AS DECIMAL(18,2)) AS IssuedVehicleAmount,
      CAST(SUM(IssuedTotalQty) AS DECIMAL(18,2)) AS IssuedTotalQty,
      CAST(SUM(IssuedTotalAmount) AS DECIMAL(18,2)) AS IssuedTotalAmount,
      CAST(SUM(ReturnQty) AS DECIMAL(18,2)) AS ReturnQty,
      CAST(SUM(ReturnAmount) AS DECIMAL(18,2)) AS ReturnAmount,
      CAST(SUM(GoodsReceiveQty) AS DECIMAL(18,2)) AS GoodsReceiveQty,
      CAST(SUM(GoodsReceiveAmount) AS DECIMAL(18,2)) AS GoodsReceiveAmount,
      CAST(SUM(GoodsReturnQty) AS DECIMAL(18,2)) AS GoodsReturnQty,
      CAST(SUM(GoodsReturnAmount) AS DECIMAL(18,2)) AS GoodsReturnAmount,
      CAST(SUM(DispatchAdvQty) AS DECIMAL(18,2)) AS DispatchAdvQty,
      CAST(SUM(DispatchAdvAmount) AS DECIMAL(18,2)) AS DispatchAdvAmount,
      CAST(SUM(ClosingQty) AS DECIMAL(18,2)) AS ClosingQty,
      CAST(SUM(ClosingAmount) AS DECIMAL(18,2)) AS ClosingAmount,
      CAST(SUM(CASE WHEN ItemType = '1' THEN ClosingAmount ELSE 0 END) AS DECIMAL(18,2)) AS StockGudangClosingAmount,
      CAST(SUM(CASE WHEN ItemType = '4' THEN ClosingAmount ELSE 0 END) AS DECIMAL(18,2)) AS WorkshopMesinClosingAmount
    FROM report_rows
    ${movementCategoryWhere}
    GROUP BY Location, ActualPeriod, AccountingPeriod, OpeningActualPeriod, OpeningAccountingPeriod
  `)

  const stockAnalysisChart = await rows(ctx, `
    ${ctes}
    SELECT TOP 10
      'stock-analysis' AS DimensionId,
      StockAnalysisCode AS Label,
      StockAnalysisCode AS DimensionValue,
      StockAnalysisCode,
      StockAnalysisName,
      ${monthlyStockMovementChartMetricSelect}
    FROM report_rows
    ${movementCategoryWhere}
    GROUP BY StockAnalysisCode, StockAnalysisName
    ORDER BY Amount DESC
  `)

  const movementCategoryChart = await rows(ctx, `
    ${ctes}
    SELECT TOP 10
      'movement-category' AS DimensionId,
      MovementCategory AS Label,
      MovementCategory AS DimensionValue,
      MovementCategory,
      ${monthlyStockMovementChartMetricSelect}
    FROM report_rows
    ${movementCategoryWhere}
    GROUP BY MovementCategory
    ORDER BY ${movementCategoryRankSqlCase('MovementCategory')}, Amount DESC
  `)

  const analysisGroupChart = analysisGroupKey === 'StockAnalysisCode' || analysisGroupKey === 'MovementCategory'
    ? []
    : await rows(ctx, `
      ${ctes}
      SELECT TOP 50
        '${analysisGroup.dimensionId}' AS DimensionId,
        NULLIF(${analysisGroup.sql}, '') AS Label,
        NULLIF(${analysisGroup.sql}, '') AS DimensionValue,
        NULLIF(${analysisGroup.sql}, '') AS ${analysisGroup.sql},
        ${analysisGroupNameSelect}
        ${monthlyStockMovementChartMetricSelect}
      FROM report_rows
      ${movementCategoryWhere}
      GROUP BY ${analysisGroup.sql}
      ORDER BY Amount DESC
    `)

  const itemTypeChart = await rows(ctx, `
    ${ctes}
    SELECT
      'item-type' AS DimensionId,
      ItemTypeName AS Label,
      ItemType AS DimensionValue,
      ItemType,
      ItemTypeName,
      ${monthlyStockMovementChartMetricSelect}
    FROM report_rows
    ${movementCategoryWhere}
    GROUP BY ItemType, ItemTypeName
    ORDER BY ItemType
  `)

  const chart = analysisGroupKey === 'StockAnalysisCode'
    ? [...stockAnalysisChart, ...movementCategoryChart, ...itemTypeChart]
    : analysisGroupKey === 'MovementCategory'
      ? [...movementCategoryChart, ...stockAnalysisChart, ...itemTypeChart]
      : [...analysisGroupChart, ...movementCategoryChart, ...stockAnalysisChart, ...itemTypeChart]

  return {
    title: 'MONTHLY STOCK ACCOUNT MOVEMENT DETAILS',
    description: 'RPTIN1000015: mutasi actual per bulan (Opening/Issue/Receive/Closing dihitung SQL). StockAnalysisCode (DEADS/MEMOV/SLMOV) = master field IN_ITEM, BUKAN MovementCategory dinamis dari aktivitas movement.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      period: actualPeriod,
      sourceTables: 'IN_ITEM, IN_PRODTYPE, IN_STOCKANALYSIS, IN_MTHENDITEM, IN_STOCKISSUE, IN_STOCKISSUELN, IN_FUELISSUE, IN_FUELISSUELN, WS_JOBSTOCK, WS_JOB, PU_GOODSRCV, PU_GOODSRCVLN, PU_GOODSRET, PU_GOODSRETLN, PU_POLN',
      reportReference: 'RPTIN1000015',
      actualPeriod,
      accountingPeriod: reportPeriod.accountingPeriod,
      accYear: reportPeriod.accYear,
      accMonth: reportPeriod.accMonth,
      periodInputMode: reportPeriod.inputMode,
      periodRequested: reportPeriod.requested,
      transactionAsOf: transactionAsOf || 'live',
      openingActualPeriod,
      openingAccountingPeriod: formatPeriod(openingPeriod.accYear, openingPeriod.accMonth),
      location,
      stockAnalysisScope: stockAnalysisCode || (stockAnalysisDefaultScope ? 'DEADS, MEMOV, SLMOV' : 'all stock analysis codes'),
      stockAnalysisSource: 'master_field',
      stockAnalysisRule: stockAnalysisDefaultScope
        ? 'Mode StockAnalysisCode memakai scope default DEADS/MEMOV/SLMOV dari IN_ITEM + IN_STOCKANALYSIS.'
        : 'Mode taxonomy seperti ProductTypeCode memakai full active ItemType 1+4 scope; StockAnalysisCode hanya menjadi kolom referensi bila tidak dipilih sebagai group/filter.',
      itemTypeScope: itemTypeScope || '1,4',
      includeWorkshopItem: filters?.includeWorkshopItem ?? (itemTypeScope === '1' ? 'No' : 'Yes'),
      itemTypeScopeRule: itemTypeScope === '1'
        ? 'Scope item dibatasi ke ItemType 1 Stock/Gudang.'
        : itemTypeScope === '4'
          ? 'Scope item dibatasi ke ItemType 4 Workshop/Mesin.'
          : 'Scope item default report center mencakup ItemType 1 Stock/Gudang dan ItemType 4 Workshop/Mesin.',
      baseItemScopeRule: analysisGroupKey === 'StockAnalysisCode'
        ? `Base item: LocCode PTRJ, Status 1/2, ItemType ${itemTypeScope || '1+4'}, dan StockAnalysisCode default DEADS/MEMOV/SLMOV kecuali filter spesifik dikirim.`
        : `Base item: LocCode PTRJ, Status 1/2, ItemType ${itemTypeScope || '1+4'}, tidak suppress zero balance, tanpa default StockAnalysis/DC/M-only filter.`,
      officialJsonComparisonRule: 'Untuk match JSON/PDF RPTIN1000015 dengan header Include Workshop Item: No, gunakan includeWorkshopItem=no atau itemType=gudang. Default Report Center tetap ItemType 1+4 karena inventory procurement merangkum Gudang + Workshop/Mesin.',
      valuationBreakdown: {
        scope: itemTypeScope || 'ItemType 1 Stock/Gudang + ItemType 4 Workshop/Mesin',
        activeStockValue: 'OnHandHoldAmount = (QtyOnHand + QtyOnHold) * AverageCost dari IN_ITEM live.',
        accountingClosingValue: 'ClosingAmount = OpeningAmount - IssuedTotalAmount + GoodsReceiveAmount + return/transfer/adjustment component yang tersedia pada periode accounting.',
        stockGudangValue: 'StockGudangOnHandHoldAmount dan StockGudangClosingAmount hanya ItemType=1.',
        workshopMesinValue: 'WorkshopMesinOnHandHoldAmount dan WorkshopMesinClosingAmount hanya ItemType=4.',
        movementCostSources: [
          'Opening: IN_MTHENDITEM periode accounting sebelumnya.',
          'Issue stock/gudang: IN_STOCKISSUE + IN_STOCKISSUELN.',
          'Issue BBM: IN_FUELISSUE + IN_FUELISSUELN.',
          'Issue workshop/mesin: WS_JOBSTOCK TransType=1.',
          'Return workshop: WS_JOBSTOCK TransType=2.',
          'Goods receive: PU_GOODSRCV + PU_GOODSRCVLN + PU_POLN.Cost.',
          'Goods return: PU_GOODSRET + PU_GOODSRETLN Amount atau ReturnStockQty * Cost.',
        ],
        note: 'Untuk KPI valuasi cepat gunakan OnHandHoldAmount. Untuk rekonstruksi laporan accounting bulanan gunakan ClosingAmount.',
      },
      analysisGroup: analysisGroupKey,
      analysisGroupLabel: analysisGroup.label,
      movementCategoryScope: movementCategoryScope || undefined,
      taxonomyScope: {
        productType: productTypeCode || undefined,
        productCategory: productCategoryCode || undefined,
        productBrand: productBrandCode || undefined,
        productModel: productModelCode || undefined,
        productMaterial: productMaterialCode || undefined,
        itemType: itemTypeScope || undefined,
      },
      actualMovementCategoryRule: `MovementCategory aktual RPTIN1000015 dihitung dari distinct issue document dalam window ${movementWindow.label} (IN_STOCKISSUE/IN_STOCKISSUELN + IN_FUELISSUE/IN_FUELISSUELN). Jika tidak ada issue document, fallback ke aktivitas movement pada baris report (issue station/vehicle/ledger, return, goods receive, goods return, dispatch, transfer/adjustment bila ada). Opening/closing saldo tidak dihitung sebagai movement. Rule: ${movementCategoryThresholdLabel(movementThresholds)}. Ini bukan StockAnalysisCode master.`,
      movementWindow: movementWindow.preset,
      movementWindowLabel: movementWindow.label,
      movementWindowStartInclusive: movementWindow.startInclusive,
      movementWindowEndExclusive: movementWindow.endExclusive,
      movementCategoryThresholds: movementThresholds,
      movementCategoryThresholdLabel: movementCategoryThresholdLabel(movementThresholds),
      actualMovementRule: 'Actual movement = kolom Opening/Received/Issued*/Return/GoodsReceive/Closing qty+amount dihitung dari transaksi bulan aktual (Acc fiscal April).',
      periodRule: 'Filter period: actual YYYY-MM (period=) preferred. AccYear/AccMonth only if actual absent. Fiscal April via accounting-period helper.',
      openingRule: 'Opening qty dan amount diambil dari IN_MTHENDITEM accounting period sebelumnya; transaksi bulan berjalan memakai AccYear/AccMonth hasil konversi periode aktual.',
      transactionAsOfRule: 'Jika dateTo dikirim, transaksi bulan berjalan dibatasi ke COALESCE(UpdateDate, CreateDate) <= dateTo agar hanya dokumen yang sudah posted/update sebelum waktu cetak yang ikut dihitung.',
      closingRule: 'Closing dihitung: opening + received + return advice + transferred + adjustment - issued total + return + goods receive - goods return - dispatch advice.',
      issueUsageRule: 'Issue non-workshop dihitung dari IN_STOCKISSUE/IN_STOCKISSUELN dan issue BBM dari IN_FUELISSUE/IN_FUELISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK dengan TransType 1 untuk issue dan TransType 2 untuk return.',
      onHandHoldAmountRule: 'Valuasi saldo aktif dari IN_ITEM dihitung dengan (QtyOnHand + QtyOnHold) * AverageCost.',
      goodsReceiveAmountRule: 'Goods receive amount = PU_GOODSRCVLN.StockQty * PU_POLN.Cost.',
      goodsReturnAmountRule: 'Goods return amount = PU_GOODSRETLN.Amount fallback ReturnStockQty * Cost; mengurangi closing.',
      primaryChart: `Closing Amount by ${analysisGroup.label}`,
      defaultGroupBy: analysisGroupKey,
      detailWindowOrder: limitAll ? 'official-grouped-order' : 'balanced-by-analysis-group-row-number',
      detailWindowOrderRule: limitAll
        ? 'Export/all rows memakai urutan resmi: analysis group lalu ItemCode.'
        : 'Tampilan interaktif memakai ORDER BY No dalam group, lalu analysis group, supaya semua ProductType/analysis group muncul di halaman awal.',
    }),
  }
}

async function stockReceive({ limit, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const scope = goodReceiptSqlScope(filters)
  const itemScopeFilter = inventoryItemScopeExistsFilter(DATABASE, 'l.ItemCode', 'h.LocCode', filters)
  const whereSearch = textSearch(search, [
    'h.GoodsRcvID',
    'CONVERT(varchar(40), h.GoodsRcvRefNo)',
    'h.POID',
    'h.SupplierCode',
    "ISNULL(s.Name, '')",
    'l.ItemCode',
    "ISNULL(i.Description, '')",
    'l.AccCode',
    'l.ChargeTo',
    'h.LocCode',
  ])
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(h.GoodsRcvID) AS GoodsReceiveID,
      RTRIM(CONVERT(varchar(40), h.GoodsRcvRefNo)) AS ReferenceNo,
      h.GoodsRcvRefDate AS ReferenceDate,
      h.CreateDate AS CreateDate,
      RTRIM(h.LocCode) AS Location,
      po.DocumentNo,
      RTRIM(ISNULL(h.POID, '')) AS POID,
      po.PONumber,
      RTRIM(ISNULL(h.Status, '')) AS StatusRaw,
      CASE RTRIM(ISNULL(h.Status, ''))
        WHEN '1' THEN 'Draft'
        WHEN '2' THEN 'Confirmed'
        WHEN '5' THEN 'Posted'
        WHEN '' THEN 'Unknown'
        ELSE 'Status ' + RTRIM(ISNULL(h.Status, ''))
      END AS Status,
      RTRIM(h.SupplierCode) AS SupplierCode,
      RTRIM(ISNULL(s.Name, h.SupplierCode)) AS SupplierName,
      RTRIM(l.GoodsRcvLnID) AS GoodsReceiveLineID,
      RTRIM(l.ItemCode) AS ItemCode,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS ItemDescription,
      RTRIM(l.ReceiveUOM) AS UOM,
      CAST(ISNULL(l.ReceiveQty, 0) AS DECIMAL(18,2)) AS Quantity,
      CAST(ISNULL(p.Cost, 0) AS DECIMAL(18,2)) AS UnitCost,
      CAST(ISNULL(l.ReceiveQty, 0) * ISNULL(p.Cost, 0) AS DECIMAL(18,2)) AS TotalAmount,
      RTRIM(l.AccCode) AS ChartOfAccountCode,
      RTRIM(l.ChargeTo) AS ChargeTo,
      RTRIM(l.POLnID) AS POLineID,
      RTRIM(ISNULL(l.FixedAssetCode, '')) AS AssetCode,
      RTRIM(ISNULL(l.BlkCode, '')) AS FieldNoCode,
      RTRIM(ISNULL(l.VehCode, '')) AS VehicleCode,
      RTRIM(ISNULL(l.VehExpenseCode, '')) AS VehicleExpenseCode,
      RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductTypeCode,
      RTRIM(ISNULL(pt.Description, '')) AS ProductTypeDescription
    FROM [${DATABASE}].[dbo].[PU_GOODSRCV] h
    INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCVLN] l ON l.GoodsRcvID = h.GoodsRcvID
    LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
    LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode
    OUTER APPLY (
      SELECT TOP 1 item.Description, item.ProdTypeCode
      FROM [${DATABASE}].[dbo].[IN_ITEM] item
      WHERE item.ItemCode = l.ItemCode
      ORDER BY CASE WHEN item.LocCode = h.LocCode THEN 0 ELSE 1 END, item.UpdateDate DESC
    ) i
    LEFT JOIN [${DATABASE}].[dbo].[IN_PRODTYPE] pt ON i.ProdTypeCode = pt.ProdTypeCode
    OUTER APPLY (
      SELECT
        RTRIM(ISNULL(h.POID, '')) AS POText,
        CHARINDEX('/', REVERSE(RTRIM(ISNULL(h.POID, '')))) AS LastSlashFromRight
    ) poRaw
    OUTER APPLY (
      SELECT
        CASE
          WHEN poRaw.LastSlashFromRight > 0
            THEN LEFT(poRaw.POText, LEN(poRaw.POText) - poRaw.LastSlashFromRight + 1)
          ELSE poRaw.POText
        END AS DocumentNo,
        CASE
          WHEN poRaw.LastSlashFromRight > 0
            THEN RIGHT(poRaw.POText, poRaw.LastSlashFromRight - 1)
          ELSE poRaw.POText
        END AS PONumber
    ) po
    ${scope.whereSql}
      ${whereSearch}
      ${itemScopeFilter}
    ORDER BY h.CreateDate DESC, h.GoodsRcvID DESC, l.GoodsRcvLnID
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.GoodsRcvID) AS TotalGoodsReceive,
      COUNT(*) AS TotalBaris,
      COUNT(DISTINCT h.SupplierCode) AS TotalSupplier,
      COUNT(DISTINCT l.ItemCode) AS TotalItem,
      CAST(SUM(ISNULL(l.ReceiveQty, 0)) AS DECIMAL(18,2)) AS TotalQuantity,
      CAST(SUM(ISNULL(l.ReceiveQty, 0) * ISNULL(p.Cost, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      SUM(CASE WHEN p.POLnID IS NULL THEN 1 ELSE 0 END) AS MissingPOLineCostRows,
      SUM(CASE WHEN s.SupplierCode IS NULL THEN 1 ELSE 0 END) AS MissingSupplierNameRows,
      MAX(h.CreateDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l
    INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
    LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
    LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode
    OUTER APPLY (
      SELECT TOP 1 item.Description
      FROM [${DATABASE}].[dbo].[IN_ITEM] item
      WHERE item.ItemCode = l.ItemCode
      ORDER BY CASE WHEN item.LocCode = h.LocCode THEN 0 ELSE 1 END, item.UpdateDate DESC
    ) i
    ${scope.whereSql}
      ${whereSearch}
      ${itemScopeFilter}
  `)

  const chart = await rows(ctx, `
    SELECT TOP 12
      RTRIM(ISNULL(s.Name, h.SupplierCode)) AS Label,
      RTRIM(h.SupplierCode) AS SupplierCode,
      RTRIM(ISNULL(s.Name, h.SupplierCode)) AS SupplierName,
      COUNT(DISTINCT h.GoodsRcvID) AS TotalGoodsReceive,
      COUNT(*) AS TotalRows,
      CAST(SUM(ISNULL(l.ReceiveQty, 0)) AS DECIMAL(18,2)) AS Qty,
      CAST(SUM(ISNULL(l.ReceiveQty, 0) * ISNULL(p.Cost, 0)) AS DECIMAL(18,2)) AS Amount
    FROM [${DATABASE}].[dbo].[PU_GOODSRCVLN] l
    INNER JOIN [${DATABASE}].[dbo].[PU_GOODSRCV] h ON l.GoodsRcvID = h.GoodsRcvID
    LEFT JOIN [${DATABASE}].[dbo].[PU_POLN] p ON l.POLnID = p.POLnID
    LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON h.SupplierCode = s.SupplierCode
    OUTER APPLY (
      SELECT TOP 1 item.Description
      FROM [${DATABASE}].[dbo].[IN_ITEM] item
      WHERE item.ItemCode = l.ItemCode
      ORDER BY CASE WHEN item.LocCode = h.LocCode THEN 0 ELSE 1 END, item.UpdateDate DESC
    ) i
    ${scope.whereSql}
      ${whereSearch}
      ${itemScopeFilter}
    GROUP BY RTRIM(h.SupplierCode), RTRIM(ISNULL(s.Name, h.SupplierCode))
    ORDER BY Amount DESC
  `)

  return {
    title: 'Goods Receiving & Receipt Activity',
    description: 'Goods Receiving & Receipt Activity — Tracking aktivitas penerimaan barang dari supplier dengan referensi PO, item, qty diterima, unit cost, total amount, lokasi, status, dan klasifikasi inventory.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      flowStage: 'receive',
      sourceTables: 'PU_GOODSRCV, PU_GOODSRCVLN, PU_POLN, PU_SUPPLIER, IN_ITEM, IN_PRODTYPE',
      primaryChart: 'Nilai Goods Receive per Supplier',
      availableCharts: ['Nilai Goods Receive per Supplier', 'Nilai Goods Receive per Bulan', 'Top Item Goods Receive'],
      qualityFocus: [
        'UnitCost wajib lookup dari PU_POLN via POLnID; TotalAmount = ReceiveQty x UnitCost agar sesuai nilai GR aktual.',
        'Filter periode report memakai PU_GOODSRCV.CreateDate sesuai kebutuhan Good Receipt.',
        'GoodsRcvRefDate tetap ditampilkan sebagai tanggal referensi dokumen; PostDate dapat placeholder 1900.',
        'SupplierName fallback ke SupplierCode jika master supplier kosong.',
      ],
      sqlAppliedFilters: scope.applied,
      sourceDocument: 'D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/Report Inventory Kebun/good_receipt_correlation.md',
    }),
  }
}

async function stockIssue({ limit, search, ctx, stale, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['Dokumen', 'KodeBarang', 'NamaBarang', 'AccCode', 'BlkCode', 'VehCode'])
  const workshopDate = workshopStockIssueDateExpression('s')
  const workshopDoc = workshopStockIssueDocumentExpression('s')
  const workshopAmount = workshopStockIssueAmountExpression('s')
  const itemTypeFilter = filters?.itemType?.toLowerCase()
  const includeGudang = !itemTypeFilter || itemTypeFilter === '1' || itemTypeFilter === 'gudang'
  const includeWorkshop = !itemTypeFilter || itemTypeFilter === '4' || itemTypeFilter === 'workshop'

  const gudangQuery = `
      SELECT
        RTRIM(CONVERT(varchar(50), h.StockIssueID)) AS Dokumen,
        h.PostDate AS Tanggal,
        RTRIM(l.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS Kategori,
        CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(ISNULL(l.Cost, 0) AS DECIMAL(18,2)) AS Cost,
        CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
        RTRIM(ISNULL(l.VehCode, '')) AS VehCode,
        RTRIM(ISNULL(l.AccCode, '')) AS AccCode,
        RTRIM(ISNULL(l.BlkCode, '')) AS BlkCode,
        RTRIM(ISNULL(h.Remark, '')) AS Remark,
        RTRIM(ISNULL(h.Status, '')) AS Status,
        'IN_STOCKISSUE' AS SourceTable
      FROM [${DATABASE}].[dbo].[IN_STOCKISSUELN] l
      INNER JOIN [${DATABASE}].[dbo].[IN_STOCKISSUE] h ON l.StockIssueID = h.StockIssueID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
      WHERE h.PostDate >= '2000-01-01'
        ${nonWorkshopItemTypeFilter('i')}
  `

  const workshopQuery = `
      SELECT
        RTRIM(${workshopDoc}) AS Dokumen,
        ${workshopDate} AS Tanggal,
        RTRIM(s.ItemCode) AS KodeBarang,
        RTRIM(ISNULL(i.Description, s.ItemCode)) AS NamaBarang,
        RTRIM(ISNULL(i.ProdCatCode, '-')) AS Kategori,
        CAST(ISNULL(s.Qty, 0) AS DECIMAL(18,2)) AS Qty,
        CAST(ISNULL(s.Cost, 0) AS DECIMAL(18,2)) AS Cost,
        CAST(${workshopAmount} AS DECIMAL(18,2)) AS Amount,
        RTRIM(COALESCE(NULLIF(RTRIM(s.VehCode), ''), NULLIF(RTRIM(j.VehCode), ''), '')) AS VehCode,
        RTRIM(ISNULL(s.AccCode, '')) AS AccCode,
        RTRIM(COALESCE(NULLIF(RTRIM(s.BlkCode), ''), NULLIF(RTRIM(j.BlkCode), ''), '')) AS BlkCode,
        RTRIM(ISNULL(s.ReferenceNo, '')) AS Remark,
        RTRIM(ISNULL(s.Status, '')) AS Status,
        'WS_JOBSTOCK' AS SourceTable
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${DATABASE}].[dbo].[WS_JOB] j ON s.JobID = j.JobID
      LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON s.ItemCode = i.ItemCode AND i.LocCode = s.LocCode
      WHERE ${workshopDate} >= '2000-01-01'
        AND RTRIM(ISNULL(s.TransType, '')) = '1'
        AND ${workshopStockIssueItemTypeExpression('i', 's')} = '4'
  `

  const queries = []
  if (includeGudang) queries.push(gudangQuery)
  if (includeWorkshop) queries.push(workshopQuery)
  if (queries.length === 0) queries.push(gudangQuery) // fallback

  const issueRowsCte = `
    WITH issue_rows AS (
      ${queries.join(' UNION ALL ')}
    )`
  const reportRows = await rows(ctx, `
    ${issueRowsCte}
    SELECT TOP ${limit}
      *
    FROM issue_rows
    WHERE 1=1
      ${whereSearch}
    ORDER BY Tanggal DESC, Dokumen DESC
  `)

  const summary = await first(ctx, `
    ${issueRowsCte}
    SELECT
      COUNT(DISTINCT Dokumen) AS TotalDokumen,
      COUNT(*) AS TotalBaris,
      COUNT(DISTINCT KodeBarang) AS TotalItem,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      SUM(CASE WHEN RTRIM(ISNULL(AccCode, '')) = '' THEN 1 ELSE 0 END) AS BarisAccCodeKosong,
      SUM(CASE WHEN RTRIM(ISNULL(BlkCode, '')) = '' THEN 1 ELSE 0 END) AS BarisBlkCodeKosong,
      SUM(CASE WHEN RTRIM(ISNULL(VehCode, '')) = '' THEN 1 ELSE 0 END) AS BarisVehCodeKosong,
      SUM(CASE WHEN SourceTable = 'WS_JOBSTOCK' THEN 1 ELSE 0 END) AS BarisWorkshop,
      MAX(Tanggal) AS TerakhirUpdate
    FROM issue_rows
  `)

  const chart = await rows(ctx, `
    ${issueRowsCte}
    SELECT TOP 10
      KodeBarang,
      NamaBarang,
      COUNT(*) AS BarisTransaksi,
      CAST(SUM(ISNULL(Qty, 0)) AS DECIMAL(18,2)) AS QtyKeluar,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS NilaiKeluar,
      MAX(Tanggal) AS LastIssueDate
    FROM issue_rows
    WHERE Tanggal >= '2025-05-01'
    GROUP BY KodeBarang, NamaBarang
    ORDER BY NilaiKeluar DESC
  `)

  return {
    title: 'Pengeluaran Barang Operasional',
    description: 'Audit pemakaian barang ke operasional, cost center, blok, kendaraan, dan status posting.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK, WS_JOB, IN_STOCKISSUELN_ACC',
      issueUsageRule: 'ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK dengan TransType = 1.',
      primaryChart: 'Top Barang Keluar by Amount',
      availableCharts: ['Top Barang Keluar by Amount', 'Pengeluaran per Block / Account', 'Pengeluaran per Kendaraan'],
      qualityFocus: ['AccCode/BlkCode/VehCode kosong', 'PostDate placeholder'],
    }),
  }
}

async function stockOpname({ limit, search, ctx, stale }: { limit: number; search: string; ctx: QueryContext; stale: string }): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['h.StockAdjID', 'l.ItemCode', 'i.Description', 'l.AccCode', 'h.Remark'])
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(h.StockAdjID) AS Dokumen,
      h.PostDate AS TanggalPosting,
      h.StockAdjDate AS TanggalOpname,
      RTRIM(h.AdjType) AS AdjType,
      RTRIM(h.TransType) AS TransType,
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      CAST(ISNULL(l.Quantity, 0) AS DECIMAL(18,2)) AS QtySebelum,
      CAST(ISNULL(l.N_Quantity, 0) AS DECIMAL(18,2)) AS QtySesudah,
      CAST(ISNULL(l.D_Quantity, 0) AS DECIMAL(18,2)) AS SelisihQty,
      CAST(ISNULL(l.D_TotalCost, 0) AS DECIMAL(18,2)) AS SelisihNilai,
      RTRIM(l.AccCode) AS AccCode,
      RTRIM(h.Remark) AS Remark,
      RTRIM(h.Status) AS Status
    FROM [${DATABASE}].[dbo].[IN_STOCKADJLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKADJ] h ON l.StockAdjID = h.StockAdjID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '2000-01-01'
      ${whereSearch}
    ORDER BY h.PostDate DESC, h.StockAdjID DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.StockAdjID) AS TotalDokumen,
      COUNT(*) AS TotalBaris,
      CAST(SUM(ISNULL(l.D_Quantity, 0)) AS DECIMAL(18,2)) AS TotalSelisihQty,
      CAST(SUM(ISNULL(l.D_TotalCost, 0)) AS DECIMAL(18,2)) AS TotalSelisihNilai,
      MAX(h.PostDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_STOCKADJLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKADJ] h ON l.StockAdjID = h.StockAdjID
    WHERE h.PostDate >= '2000-01-01'
  `)

  const chart = await rows(ctx, `
    SELECT TOP 10
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      COUNT(*) AS BarisAdjustment,
      CAST(SUM(ISNULL(l.D_Quantity, 0)) AS DECIMAL(18,2)) AS SelisihQty,
      CAST(SUM(ISNULL(l.D_TotalCost, 0)) AS DECIMAL(18,2)) AS SelisihNilai,
      MAX(h.PostDate) AS LastAdjustmentDate
    FROM [${DATABASE}].[dbo].[IN_STOCKADJLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKADJ] h ON l.StockAdjID = h.StockAdjID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '2000-01-01'
    GROUP BY RTRIM(l.ItemCode), RTRIM(ISNULL(i.Description, l.ItemCode))
    ORDER BY ABS(SUM(ISNULL(l.D_TotalCost, 0))) DESC
  `)

  return {
    title: 'Stock Opname & Adjustment',
    description: 'Audit adjustment stok: qty sebelum/sesudah, selisih qty, dan selisih nilai.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_STOCKADJ, IN_STOCKADJLN, IN_STOCKADJLN_ACC',
      primaryChart: 'Top Item Selisih',
      availableCharts: ['Selisih Nilai per Tipe Adjustment', 'Top Item Selisih', 'Trend Adjustment'],
      qualityFocus: ['D_Quantity/D_TotalCost adalah delta', 'PostDate placeholder'],
    }),
  }
}

async function reorderLevel({ limit, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const quantityClosing = quantityClosingExpression('i')
  const quantityClosingField = quantityClosingExpression()
  const movementThresholds = movementThresholdsFromFilters(filters)
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(i.ItemCode) AS KodeBarang,
      RTRIM(i.Description) AS NamaBarang,
      RTRIM(ISNULL(i.ProdCatCode, '-')) AS Kategori,
      RTRIM(i.UOMCode) AS Satuan,
      CAST(${quantityClosing} AS DECIMAL(18,2)) AS QuantityClosing,
      ${stockIssueUsageColumns(quantityClosing, movementThresholds)},
      CAST(ISNULL(i.ReOrderLevel, 0) AS DECIMAL(18,2)) AS ReOrderLevel,
      CAST(ISNULL(i.ReOrderLevel, 0) - ${quantityClosing} AS DECIMAL(18,2)) AS Shortage,
      CAST(ISNULL(i.LatestCost, 0) AS DECIMAL(18,2)) AS LatestCost,
      i.LastOrderDate,
      i.UpdateDate AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      AND ISNULL(i.ReOrderLevel, 0) > 0
      AND ${quantityClosing} < ISNULL(i.ReOrderLevel, 0)
      ${itemSearch('i', search)}
    ORDER BY Shortage DESC, i.UpdateDate DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(*) AS TotalItemReorder,
      CAST(SUM(ISNULL(ReOrderLevel, 0) - ${quantityClosingField}) AS DECIMAL(18,2)) AS TotalShortage,
      CAST(SUM((ISNULL(ReOrderLevel, 0) - ${quantityClosingField}) * ISNULL(LatestCost, 0)) AS DECIMAL(18,2)) AS EstimasiNilaiOrder,
      MAX(UpdateDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_ITEM]
    WHERE RTRIM(ISNULL(Status, '0')) = '1'
      AND ISNULL(ReOrderLevel, 0) > 0
      AND ${quantityClosingField} < ISNULL(ReOrderLevel, 0)
  `)

  return {
    title: 'Reorder Level',
    description: 'Daftar item yang telah mencapai batas minimum.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart: [],
    metadata: metadata(ctx, {
      sourceTables: 'IN_ITEM, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      quantityRule: 'QuantityClosing = QtyOnHand + QtyOnHold + QtyOnOrder',
      issueUsageRule: 'ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK.TransType = 1.',
    }),
  }
}

async function transactionHistory({ limit, search, ctx }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['DocId', 'DocLnId', 'ItemCode', 'Description', 'AccCode', 'BlkCode'])
  const actualPeriodColumns = accountingActualPeriodSelectSql({
    accYearExpression: 'AccYear',
    accMonthExpression: 'AccMonth',
    actualPeriodAlias: 'PeriodeAktual',
  })
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(DocId) AS Dokumen,
      RTRIM(DocLnId) AS Baris,
      RTRIM(DocType) AS Tipe,
      DocDate AS Tanggal,
      RTRIM(LocCode) AS Gudang,
      RTRIM(ItemCode) AS KodeBarang,
      RTRIM(Description) AS Deskripsi,
      CAST(ISNULL(Unit, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(ISNULL(Cost, 0) AS DECIMAL(18,2)) AS Cost,
      CAST(ISNULL(Amount, 0) AS DECIMAL(18,2)) AS Amount,
      RTRIM(AccCode) AS AccCode,
      RTRIM(BlkCode) AS BlkCode,
      RTRIM(VehCode) AS VehCode,
      RTRIM(AccYear) AS AccYear,
      RIGHT('0' + RTRIM(AccMonth), 2) AS AccMonth,
      RTRIM(AccYear) + '-' + RIGHT('0' + RTRIM(AccMonth), 2) AS PeriodeAkuntansi,
      ${actualPeriodColumns}
    FROM [${DATABASE}].[dbo].[IN_MTHENDTRX]
    WHERE DocDate >= '2019-01-01'
      ${whereSearch}
    ORDER BY DocDate DESC, DocId DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(*) AS TotalTransaksi,
      COUNT(DISTINCT DocId) AS TotalDokumen,
      CAST(SUM(ISNULL(Unit, 0)) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      MAX(DocDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_MTHENDTRX]
    WHERE DocDate >= '2019-01-01'
  `)

  const chart = await rows(ctx, `
    SELECT TOP 8
      RTRIM(DocType) AS Tipe,
      COUNT(*) AS Transaksi,
      CAST(SUM(ISNULL(Amount, 0)) AS DECIMAL(18,2)) AS Amount
    FROM [${DATABASE}].[dbo].[IN_MTHENDTRX]
    WHERE DocDate >= '2019-01-01'
    GROUP BY RTRIM(DocType)
    ORDER BY Transaksi DESC
  `)

  return {
    title: 'Riwayat Transaksi',
    description: 'Riwayat seluruh transaksi inventory.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_MTHENDTRX',
      accountingPeriodRule: 'AccMonth 1 = April, AccYear adalah fiscal year akhir; contoh AccYear 2027 AccMonth 1 = actual 2026-04.',
    }),
  }
}

async function purchaseRequestInventory({ limit, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['h.PRID', 'l.ItemCode', 'i.Description', 'h.LocCode', 'h.Status'])
  const month = monthBounds(filters?.period)
  const dateFrom = cleanSqlDate(filters?.dateFrom) ?? month.from ?? '2000-01-01'
  const dateTo = cleanSqlDate(filters?.dateTo)
  const location = sanitizeLike(filters?.location ?? '')
  const clauses = [`h.PRDate >= '${dateFrom}'`]
  if (dateTo) clauses.push(`h.PRDate < DATEADD(DAY, 1, CONVERT(date, '${dateTo}'))`)
  else if (month.toExclusive) clauses.push(`h.PRDate < '${month.toExclusive}'`)
  if (location) clauses.push(`RTRIM(h.LocCode) LIKE N'%${location}%'`)
  const scopeWhereSql = `WHERE ${clauses.join('\n      AND ')}`
  const itemScopeFilter = inventoryItemScopeExistsFilter(DATABASE, 'l.ItemCode', 'h.LocCode', filters)
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(h.PRID) AS DokumenPR,
      h.PRDate AS TanggalPR,
      RTRIM(h.LocCode) AS Gudang,
      RTRIM(h.PRType) AS TipePR,
      RTRIM(h.Status) AS StatusPR,
      RTRIM(l.PRLnID) AS BarisPR,
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      CAST(ISNULL(l.QtyReq, 0) AS DECIMAL(18,2)) AS QtyRequest,
      CAST(ISNULL(l.QtyRcv, 0) AS DECIMAL(18,2)) AS QtyReceived,
      CAST(ISNULL(l.QtyOutstanding, 0) AS DECIMAL(18,2)) AS QtyOutstanding,
      CAST(ISNULL(l.Cost, 0) AS DECIMAL(18,2)) AS Cost,
      CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
      RTRIM(l.Status) AS StatusLine,
      RTRIM(ISNULL(l.BudgetInd, '-')) AS BudgetInd
    FROM [${DATABASE}].[dbo].[IN_PRLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_PR] h ON l.PRID = h.PRID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    ${scopeWhereSql}
      ${whereSearch}
      ${itemScopeFilter}
    ORDER BY ISNULL(l.QtyOutstanding, 0) DESC, h.PRDate DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.PRID) AS TotalPR,
      COUNT(*) AS TotalBaris,
      COUNT(DISTINCT l.ItemCode) AS TotalItem,
      CAST(SUM(ISNULL(l.QtyReq, 0)) AS DECIMAL(18,2)) AS TotalQtyRequest,
      CAST(SUM(ISNULL(l.QtyRcv, 0)) AS DECIMAL(18,2)) AS TotalQtyReceived,
      CAST(SUM(ISNULL(l.QtyOutstanding, 0)) AS DECIMAL(18,2)) AS TotalQtyOutstanding,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      SUM(CASE WHEN ISNULL(l.QtyOutstanding, 0) > 0 AND ISNULL(l.Amount, 0) = 0 THEN 1 ELSE 0 END) AS OutstandingAmountNol,
      MAX(h.PRDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_PRLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_PR] h ON l.PRID = h.PRID
    ${scopeWhereSql}
      ${itemScopeFilter}
  `)

  const chart = await rows(ctx, `
    SELECT TOP 10
      RTRIM(h.LocCode) AS Gudang,
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      CAST(SUM(ISNULL(l.QtyOutstanding,0)) AS DECIMAL(18,2)) AS QtyOutstanding,
      CAST(SUM(ISNULL(l.Amount,0)) AS DECIMAL(18,2)) AS NilaiPR,
      COUNT(DISTINCT h.PRID) AS TotalPR,
      MAX(h.PRDate) AS LastPRDate
    FROM [${DATABASE}].[dbo].[IN_PR] h
    JOIN [${DATABASE}].[dbo].[IN_PRLN] l ON l.PRID=h.PRID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    ${scopeWhereSql}
      AND ISNULL(l.QtyOutstanding,0) > 0
      ${itemScopeFilter}
    GROUP BY RTRIM(h.LocCode), RTRIM(l.ItemCode), RTRIM(ISNULL(i.Description,l.ItemCode))
    ORDER BY QtyOutstanding DESC
  `)

  return {
    title: 'Purchase Request Inventory & Outstanding',
    description: 'PR inventory, qty request, received, outstanding, amount, dan item yang belum terpenuhi.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_PR, IN_PRLN, IN_PRLN_ACC',
      primaryChart: 'Top Outstanding Item',
      availableCharts: ['Top Outstanding Item', 'Outstanding per Gudang', 'Komposisi Status PR'],
      qualityFocus: ['Outstanding amount 0', 'PRDate placeholder'],
    }),
  }
}

async function transferWarehouse({ limit, search, ctx, stale }: { limit: number; search: string; ctx: QueryContext; stale: string }): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['h.StockTransferID', 'h.LocCode', 'h.ToLocCode', 'l.ItemCode', 'i.Description'])
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(h.StockTransferID) AS DokumenTransfer,
      h.PostDate AS Tanggal,
      RTRIM(h.LocCode) AS GudangAsal,
      RTRIM(h.ToLocCode) AS GudangTujuan,
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS Qty,
      CAST(ISNULL(l.Cost, 0) AS DECIMAL(18,2)) AS Cost,
      CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
      RTRIM(h.Status) AS Status
    FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFERLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKTRANSFER] h ON l.StockTransferID = h.StockTransferID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '2000-01-01'
      ${whereSearch}
    ORDER BY h.PostDate DESC, h.StockTransferID DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.StockTransferID) AS TotalDokumen,
      COUNT(*) AS TotalBaris,
      COUNT(DISTINCT l.ItemCode) AS TotalItem,
      CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      COUNT(DISTINCT RTRIM(h.LocCode) + '->' + RTRIM(h.ToLocCode)) AS TotalRoute,
      MAX(h.PostDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFERLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKTRANSFER] h ON l.StockTransferID = h.StockTransferID
    WHERE h.PostDate >= '2000-01-01'
  `)

  const chart = await rows(ctx, `
    SELECT TOP 10
      RTRIM(h.LocCode) + ' -> ' + RTRIM(h.ToLocCode) AS Route,
      COUNT(*) AS BarisTransfer,
      CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS QtyTransfer,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS NilaiTransfer,
      MAX(h.PostDate) AS LastTransferDate
    FROM [${DATABASE}].[dbo].[IN_STOCKTRANSFERLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKTRANSFER] h ON l.StockTransferID = h.StockTransferID
    WHERE h.PostDate >= '2025-05-01'
    GROUP BY RTRIM(h.LocCode), RTRIM(h.ToLocCode)
    ORDER BY NilaiTransfer DESC
  `)

  return {
    title: 'Transfer Antar Gudang',
    description: 'Mutasi antar lokasi dari gudang asal ke gudang tujuan, item, qty, dan nilai transfer.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_STOCKTRANSFER, IN_STOCKTRANSFERLN, IN_STOCKTRANSFERLN_ACC',
      primaryChart: 'Top Route Transfer',
      availableCharts: ['Top Route Transfer', 'Top Item Transfer'],
      qualityFocus: ['Lokasi asal/tujuan kosong', 'PostDate placeholder'],
    }),
  }
}

async function fuelUsage({ limit, search, ctx, stale }: { limit: number; search: string; ctx: QueryContext; stale: string }): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['h.FuelIssueID', 'l.ItemCode', 'i.Description', 'l.VehCode', 'l.BlkCode'])
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(h.FuelIssueID) AS DokumenFuel,
      h.PostDate AS Tanggal,
      RTRIM(h.LocCode) AS Gudang,
      RTRIM(l.ItemCode) AS KodeFuel,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaFuel,
      RTRIM(l.VehCode) AS Kendaraan,
      RTRIM(l.BlkCode) AS Blok,
      RTRIM(l.AccCode) AS AccCode,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS QtyFuel,
      CAST(ISNULL(l.Cost, 0) AS DECIMAL(18,2)) AS Cost,
      CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
      RTRIM(h.Status) AS Status
    FROM [${DATABASE}].[dbo].[IN_FUELISSUELN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '2000-01-01'
      ${whereSearch}
    ORDER BY h.PostDate DESC, h.FuelIssueID DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.FuelIssueID) AS TotalDokumen,
      COUNT(*) AS TotalBaris,
      COUNT(DISTINCT l.VehCode) AS TotalKendaraan,
      CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS TotalQtyFuel,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      SUM(CASE WHEN RTRIM(ISNULL(l.VehCode, '')) = '' THEN 1 ELSE 0 END) AS BarisVehCodeKosong,
      SUM(CASE WHEN RTRIM(ISNULL(l.BlkCode, '')) = '' THEN 1 ELSE 0 END) AS BarisBlkCodeKosong,
      MAX(h.PostDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_FUELISSUELN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_FUELISSUE] h ON l.FuelIssueID = h.FuelIssueID
    WHERE h.PostDate >= '2000-01-01'
  `)

  const chart = await rows(ctx, `
    SELECT TOP 10
      RTRIM(l.VehCode) AS Kendaraan,
      RTRIM(l.ItemCode) AS KodeFuel,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaFuel,
      COUNT(*) AS Baris,
      CAST(SUM(ISNULL(l.Qty,0)) AS DECIMAL(18,2)) AS QtyFuel,
      CAST(SUM(ISNULL(l.Amount,0)) AS DECIMAL(18,2)) AS NilaiFuel,
      MAX(h.PostDate) AS LastIssueDate
    FROM [${DATABASE}].[dbo].[IN_FUELISSUE] h
    JOIN [${DATABASE}].[dbo].[IN_FUELISSUELN] l ON l.FuelIssueID=h.FuelIssueID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON i.ItemCode=l.ItemCode AND i.LocCode=h.LocCode
    WHERE h.PostDate >= '2025-05-01'
    GROUP BY RTRIM(l.VehCode), RTRIM(l.ItemCode), RTRIM(ISNULL(i.Description,l.ItemCode))
    ORDER BY NilaiFuel DESC
  `)

  return {
    title: 'Fuel Usage Inventory',
    description: 'Pemakaian BBM sebagai bagian dari inventory: kendaraan, blok, item fuel, qty, dan nilai.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_FUELISSUE, IN_FUELISSUELN, IN_FUELISSUELN_ACC',
      primaryChart: 'Fuel Usage per Kendaraan',
      availableCharts: ['Fuel Usage per Kendaraan', 'Trend Fuel Usage', 'Fuel per Block'],
      qualityFocus: ['VehCode/BlkCode kosong', 'PostDate placeholder'],
    }),
  }
}

async function stockReturn({ limit, search, ctx, stale }: { limit: number; search: string; ctx: QueryContext; stale: string }): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['h.StockRtnID', 'l.ItemCode', 'i.Description', 'l.StockIssueID'])
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(h.StockRtnID) AS DokumenReturn,
      h.PostDate AS Tanggal,
      RTRIM(h.LocCode) AS Gudang,
      RTRIM(l.StockIssueID) AS ReferensiIssue,
      RTRIM(l.StockIssueLNID) AS ReferensiIssueLine,
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      CAST(ISNULL(l.Qty, 0) AS DECIMAL(18,2)) AS QtyReturn,
      CAST(ISNULL(l.Cost, 0) AS DECIMAL(18,2)) AS Cost,
      CAST(ISNULL(l.Amount, 0) AS DECIMAL(18,2)) AS Amount,
      RTRIM(h.Status) AS Status
    FROM [${DATABASE}].[dbo].[IN_STOCKRTNLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRTN] h ON l.StockRtnID = h.StockRtnID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '2000-01-01'
      ${whereSearch}
    ORDER BY h.PostDate DESC, h.StockRtnID DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.StockRtnID) AS TotalDokumen,
      COUNT(*) AS TotalBaris,
      COUNT(DISTINCT l.ItemCode) AS TotalItem,
      CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS TotalQtyReturn,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      MAX(h.PostDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_STOCKRTNLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRTN] h ON l.StockRtnID = h.StockRtnID
    WHERE h.PostDate >= '2000-01-01'
  `)

  const chart = await rows(ctx, `
    SELECT TOP 10
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.ItemCode)) AS NamaBarang,
      COUNT(*) AS BarisReturn,
      CAST(SUM(ISNULL(l.Qty, 0)) AS DECIMAL(18,2)) AS QtyReturn,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS NilaiReturn,
      MAX(h.PostDate) AS LastReturnDate
    FROM [${DATABASE}].[dbo].[IN_STOCKRTNLN] l
    INNER JOIN [${DATABASE}].[dbo].[IN_STOCKRTN] h ON l.StockRtnID = h.StockRtnID
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON l.ItemCode = i.ItemCode AND i.LocCode = h.LocCode
    WHERE h.PostDate >= '2000-01-01'
    GROUP BY RTRIM(l.ItemCode), RTRIM(ISNULL(i.Description, l.ItemCode))
    ORDER BY NilaiReturn DESC
  `)

  return {
    title: 'Return Barang',
    description: 'Pengembalian barang dari stock issue, termasuk referensi dokumen issue dan nilai return.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_STOCKRTN, IN_STOCKRTNLN',
      primaryChart: 'Top Item Return',
      availableCharts: ['Top Item Return', 'Trend Return', 'Return per Lokasi'],
      qualityFocus: ['PostDate placeholder', 'volume data lebih kecil dari issue utama'],
    }),
  }
}

async function itemUpdateAge({ limit, limitAll, search, ctx, stale, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const ageFilter = staleUpdateFilter('i', stale)
  const useMovementCategoryWindow = !limitAll && shouldUseMovementCategoryWindow(filters)
  const topClause = limitAll || useMovementCategoryWindow ? '' : `TOP ${limit}`
  const quantityClosing = quantityClosingExpression('i')
  const quantityClosingField = quantityClosingExpression()
  const movementThresholds = movementThresholdsFromFilters(filters)
  const reportRowsRaw = await rows(ctx, `
    SELECT ${topClause}
      CASE
        WHEN (i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -2, GETDATE())) AND ${quantityClosing} * ISNULL(i.AverageCost, 0) > 0 THEN 'Critical'
        WHEN i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) AND ${quantityClosing} * ISNULL(i.AverageCost, 0) > 0 THEN 'High'
        WHEN ${quantityClosing} = 0 OR i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) IN ('', '0') OR ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 'Medium'
        ELSE 'Low'
      END AS RiskLevel,
      CASE
        WHEN (i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -2, GETDATE())) AND ${quantityClosing} * ISNULL(i.AverageCost, 0) > 0 THEN 100
        WHEN i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) AND ${quantityClosing} * ISNULL(i.AverageCost, 0) > 0 THEN 80
        WHEN ${quantityClosing} = 0 OR i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) IN ('', '0') OR ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 50
        ELSE 10
      END AS RiskScore,
      CASE
        WHEN i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -2, GETDATE()) THEN 'Tidak Update > 24 Bulan'
        WHEN i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN 'Tidak Update > 12 Bulan'
        WHEN i.UpdateDate < DATEADD(MONTH, -6, GETDATE()) THEN 'Update 6-12 Bulan'
        WHEN i.UpdateDate < DATEADD(MONTH, -3, GETDATE()) THEN 'Update 3-6 Bulan'
        ELSE 'Update <= 3 Bulan'
      END AS AgingBucket,
      CASE WHEN i.UpdateDate IS NULL THEN 999 ELSE DATEDIFF(MONTH, i.UpdateDate, GETDATE()) END AS UmurBulan,
      CAST(CASE WHEN i.UpdateDate IS NULL THEN 999.00 ELSE DATEDIFF(DAY, i.UpdateDate, GETDATE()) / 365.25 END AS DECIMAL(18,2)) AS UmurTahun,
      RTRIM(i.ItemCode) AS KodeBarang,
      RTRIM(i.Description) AS NamaBarang,
      ${warehouseInventoryItemTypeExpression('i')} AS ItemType,
      CASE ${warehouseInventoryItemTypeExpression('i')}
        WHEN '1' THEN 'Stock'
        WHEN '4' THEN 'Workshop'
        ELSE ISNULL(${warehouseInventoryItemTypeExpression('i')}, '-')
      END AS ItemTypeName,
      RTRIM(i.LocCode) AS Gudang,
      RTRIM(ISNULL(i.ProdCatCode, '-')) AS KodeKategori,
      RTRIM(ISNULL(i.ProdCatCode, '-')) AS Kategori,
      RTRIM(i.UOMCode) AS Satuan,
      CAST(1 AS INT) AS ItemCurrent,
      CAST(${quantityClosing} AS DECIMAL(18,2)) AS QuantityClosing,
      ${stockIssueUsageColumns(quantityClosing, movementThresholds)},
      CAST(ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS HargaSatuan,
      CAST(ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS AverageCost,
      CAST(${quantityClosing} * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS AmountCurrent,
      CAST(${quantityClosing} * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS TotalAmount,
      CAST(${quantityClosing} * ISNULL(i.AverageCost, 0) AS DECIMAL(18,2)) AS NilaiStok,
      i.LastIssueDate AS TerakhirIssue,
      i.LastOrderDate AS TerakhirOrder,
      i.UpdateDate AS LastUpdateDate,
      i.UpdateDate AS TerakhirUpdate,
      CASE WHEN i.UpdateDate IS NULL THEN 99999 ELSE DATEDIFF(DAY, i.UpdateDate, GETDATE()) END AS HariTidakUpdate,
      CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN 'Lebih 1 Tahun' ELSE 'Kurang 1 Tahun' END AS KelompokUpdate,
      CONCAT(
        CASE WHEN ${quantityClosing} = 0 THEN 'Stok Nol; ' ELSE '' END,
        CASE WHEN i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) IN ('', '0') THEN 'Tanpa Kategori; ' ELSE '' END,
        CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 'Tanpa Issue Valid; ' ELSE '' END,
        CASE WHEN i.UpdateDate IS NULL THEN 'Update Tidak Ada; ' WHEN i.UpdateDate <= DATEADD(YEAR, -2, GETDATE()) THEN 'Update > 24 Bulan; ' WHEN i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN 'Update > 12 Bulan; ' ELSE '' END
      ) AS IssueSummary
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      ${warehouseInventoryItemTypeFilter('i')}
      ${ageFilter}
      ${itemSearch('i', search)}
    ORDER BY
      CASE
        WHEN (i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -2, GETDATE())) AND ${quantityClosing} * ISNULL(i.AverageCost, 0) > 0 THEN 100
        WHEN i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) AND ${quantityClosing} * ISNULL(i.AverageCost, 0) > 0 THEN 80
        WHEN ${quantityClosing} = 0 OR i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) IN ('', '0') OR ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 50
        ELSE 10
      END DESC,
      ${quantityClosing} * ISNULL(i.AverageCost, 0) DESC,
      i.UpdateDate ASC
  `)
  const reportRows = useMovementCategoryWindow
    ? buildMovementCategoryBalancedRows(
        reportRowsRaw,
        limit,
        (row) => row.MovementCategory,
        (left, right) =>
          numericRowValue(right.RiskScore) - numericRowValue(left.RiskScore) ||
          numericRowValue(right.TotalAmount ?? right.NilaiStok) - numericRowValue(left.TotalAmount ?? left.NilaiStok) ||
          numericRowValue(right.StockIssueEventCount) - numericRowValue(left.StockIssueEventCount),
      )
    : reportRowsRaw

  const summary = await first(ctx, `
    SELECT
      COUNT(*) AS TotalItem,
      SUM(CASE WHEN i.UpdateDate >= DATEADD(MONTH, -3, GETDATE()) THEN 1 ELSE 0 END) AS ItemAktif,
      SUM(CASE WHEN i.UpdateDate < DATEADD(MONTH, -6, GETDATE()) AND i.UpdateDate > DATEADD(YEAR, -1, GETDATE()) THEN 1 ELSE 0 END) AS SlowMoving,
      SUM(CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN 1 ELSE 0 END) AS StaleLebih12Bulan,
      SUM(CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -2, GETDATE()) THEN 1 ELSE 0 END) AS DeadStockLebih24Bulan,
      CAST(SUM(CASE WHEN i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN ${quantityClosing} * ISNULL(i.AverageCost, 0) ELSE 0 END) AS DECIMAL(18,2)) AS NilaiStokBerisiko,
      SUM(CASE WHEN ${quantityClosing} = 0 THEN 1 ELSE 0 END) AS ItemStokNol,
      SUM(CASE WHEN i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) IN ('', '0') THEN 1 ELSE 0 END) AS ItemTanpaKategori,
      SUM(CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END) AS ItemTanpaIssueValid,
      SUM(CASE WHEN ${quantityClosing} = 0 OR i.ProdCatCode IS NULL OR RTRIM(i.ProdCatCode) IN ('', '0') OR ISNULL(issueUsage.StockIssueEventCount, 0) = 0 OR i.UpdateDate IS NULL OR i.UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN 1 ELSE 0 END) AS DataQualityIssue,
      CAST(SUM(${quantityClosing} * ISNULL(i.AverageCost, 0)) AS DECIMAL(18,2)) AS NilaiPersediaan,
      CAST(SUM(${quantityClosing} * ISNULL(i.AverageCost, 0)) AS DECIMAL(18,2)) AS TotalAmount,
      MAX(i.UpdateDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status, '0')) = '1'
      ${warehouseInventoryItemTypeFilter('i')}
  `)

  const chart = await rows(ctx, `
    SELECT TOP 10
      RTRIM(LocCode) AS Gudang,
      COUNT(*) AS TotalItem,
      SUM(CASE WHEN UpdateDate IS NULL OR UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN 1 ELSE 0 END) AS StaleLebih1Tahun,
      CAST(SUM(CASE WHEN UpdateDate IS NULL OR UpdateDate <= DATEADD(YEAR, -1, GETDATE()) THEN ${quantityClosingField} * ISNULL(AverageCost, 0) ELSE 0 END) AS DECIMAL(18,2)) AS NilaiStale
    FROM [${DATABASE}].[dbo].[IN_ITEM]
    WHERE RTRIM(ISNULL(Status, '0')) = '1'
      ${warehouseInventoryItemTypeFilter()}
    GROUP BY RTRIM(LocCode)
    ORDER BY NilaiStale DESC
  `)

  return {
    title: 'Stock Aging & Item Movement Health',
    description: 'Monitor kesehatan stok: aging update, slow moving, dead stock, stok nol, kategori kosong, dan nilai stok berisiko.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_ITEM, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      quantityRule: 'QuantityClosing = QtyOnHand + QtyOnHold + QtyOnOrder',
      issueUsageRule: 'ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK.TransType = 1.',
      stockAgingReport: true,
      itemTypeScope: 'ItemType 1 Stock dan 4 Workshop saja; ItemType 6 Asset dikeluarkan dari inventory gudang.',
      activeFilter: staleUpdateLabel(stale),
      rowLimit: limitAll ? 'all' : limit,
      movementCategoryOrder: MOVEMENT_CATEGORY_ORDER.join(', '),
      groupWindowField: useMovementCategoryWindow ? 'MovementCategory' : undefined,
      groupWindowStrategy: useMovementCategoryWindow ? 'balanced' : 'ranked',
      loadedMovementCategoryGroups: movementCategoryLoadedGroups(reportRows),
      loadedMovementCategoryCounts: JSON.stringify(countMovementCategoryRows(reportRows)),
      primaryChart: 'Nilai Item Stale per Gudang',
      availableCharts: ['Distribusi Umur Stok', 'Nilai Stok Berisiko per Gudang', 'Top Item Stale by Value', 'Issue Breakdown', 'Aging Heatmap'],
      qualityFocus: ['UpdateDate adalah metadata master item, bukan tanggal movement transaksi.', 'Scope report dibatasi ke ItemType 1 Stock dan 4 Workshop karena hanya item gudang yang masuk inventory module.'],
    }),
  }
}

async function purchaseOrderHistory({ limit, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['l.ItemCode', 'i.Description', 'l.LineDescription', 'h.SupplierCode', 's.Name'])
  const month = monthBounds(filters?.period)
  const dateFrom = cleanSqlDate(filters?.dateFrom) ?? month.from ?? '2000-01-01'
  const dateTo = cleanSqlDate(filters?.dateTo)
  const location = sanitizeLike(filters?.location ?? '')
  const clauses = [`h.PODate >= '${dateFrom}'`]
  if (dateTo) clauses.push(`h.PODate < DATEADD(DAY, 1, CONVERT(date, '${dateTo}'))`)
  else if (month.toExclusive) clauses.push(`h.PODate < '${month.toExclusive}'`)
  if (location) clauses.push(`RTRIM(h.LocCode) LIKE N'%${location}%'`)
  const scopeWhereSql = `WHERE ${clauses.join('\n      AND ')}`
  const itemScopeFilter = inventoryItemScopeExistsFilter(DATABASE, 'l.ItemCode', 'h.LocCode', filters)
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(l.ItemCode) AS KodeBarang,
      RTRIM(ISNULL(i.Description, l.LineDescription)) AS NamaBarang,
      RTRIM(h.SupplierCode) AS SupplierCode,
      RTRIM(ISNULL(s.Name, h.SupplierCode)) AS SupplierName,
      COUNT(DISTINCT h.POID) AS TotalPO,
      CAST(SUM(ISNULL(l.QtyOrder, 0)) AS DECIMAL(18,2)) AS QtyOrder,
      CAST(SUM(ISNULL(l.QtyReceive, 0)) AS DECIMAL(18,2)) AS QtyReceive,
      CAST(SUM(ISNULL(l.QtyInvoice, 0)) AS DECIMAL(18,2)) AS QtyInvoice,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS POAmount,
      MIN(h.PODate) AS FirstPODate,
      MAX(h.PODate) AS LastPODate,
      MAX(RTRIM(ISNULL(h.Status, '-'))) AS LastStatusPO
    FROM [${DATABASE}].[dbo].[PU_PO] h
    INNER JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID = h.POID
    LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON s.SupplierCode = h.SupplierCode
    LEFT JOIN [${DATABASE}].[dbo].[IN_ITEM] i ON i.ItemCode = l.ItemCode AND i.LocCode = h.LocCode
    ${scopeWhereSql}
      ${whereSearch}
      ${itemScopeFilter}
    GROUP BY RTRIM(l.ItemCode), RTRIM(ISNULL(i.Description, l.LineDescription)), RTRIM(h.SupplierCode), RTRIM(ISNULL(s.Name, h.SupplierCode))
    ORDER BY POAmount DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(DISTINCT h.POID) AS TotalPO,
      COUNT(*) AS TotalLine,
      COUNT(DISTINCT l.ItemCode) AS TotalItem,
      COUNT(DISTINCT h.SupplierCode) AS TotalSupplier,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS TotalPOAmount,
      CAST(SUM(ISNULL(l.QtyOrder, 0)) AS DECIMAL(18,2)) AS TotalQtyOrder,
      CAST(SUM(ISNULL(l.QtyReceive, 0)) AS DECIMAL(18,2)) AS TotalQtyReceive,
      CAST(SUM(ISNULL(l.QtyOrder, 0) - ISNULL(l.QtyReceive, 0)) AS DECIMAL(18,2)) AS TotalQtyOutstanding,
      MAX(h.PODate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[PU_PO] h
    INNER JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID = h.POID
    ${scopeWhereSql}
      ${itemScopeFilter}
  `)

  const chart = await rows(ctx, `
    SELECT TOP 12
      RTRIM(h.SupplierCode) AS SupplierCode,
      RTRIM(ISNULL(s.Name, h.SupplierCode)) AS SupplierName,
      COUNT(DISTINCT h.POID) AS TotalPO,
      COUNT(DISTINCT l.ItemCode) AS TotalItem,
      CAST(SUM(ISNULL(l.Amount, 0)) AS DECIMAL(18,2)) AS POAmount,
      MAX(h.PODate) AS LastPODate
    FROM [${DATABASE}].[dbo].[PU_PO] h
    INNER JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID = h.POID
    LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON s.SupplierCode = h.SupplierCode
    ${scopeWhereSql}
      ${itemScopeFilter}
    GROUP BY RTRIM(h.SupplierCode), RTRIM(ISNULL(s.Name, h.SupplierCode))
    ORDER BY POAmount DESC
  `)

  return {
    title: 'Purchasing Order History per Item & Supplier',
    description: 'Histori PO yang mengelompokkan barang dengan supplier yang pernah memasok, qty order/receive/invoice, nilai PO, dan tanggal PO terakhir.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'PU_PO, PU_POLN, PU_SUPPLIER, IN_ITEM',
      primaryChart: 'Top Supplier by PO Amount',
      availableCharts: ['Top supplier by amount', 'Supplier diversity per item', 'PO status composition'],
      qualityFocus: ['QtyOrder - QtyReceive dibaca sebagai outstanding indikatif dari line PO.'],
    }),
  }
}

async function supplierPerformance({ limit, search, ctx, stale }: { limit: number; search: string; ctx: QueryContext; stale: string }): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const whereSearch = textSearch(search, ['s.SupplierCode', 's.Name', 's.Town', 's.ContactPerson'])
  const reportRows = await rows(ctx, `
    WITH po AS (
      SELECT h.SupplierCode, COUNT(DISTINCT h.POID) AS TotalPO, COUNT(*) AS TotalPOLine,
        COUNT(DISTINCT l.ItemCode) AS TotalItem, SUM(ISNULL(l.Amount,0)) AS POAmount,
        SUM(ISNULL(l.QtyOrder,0)) AS QtyOrder, SUM(ISNULL(l.QtyReceive,0)) AS QtyReceive, MAX(h.PODate) AS LastPODate
      FROM [${DATABASE}].[dbo].[PU_PO] h
      JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID = h.POID
      WHERE h.PODate >= '2000-01-01'
      GROUP BY h.SupplierCode
    ),
    gr AS (
      SELECT h.SupplierCode, COUNT(DISTINCT h.GoodsRcvID) AS TotalGR, SUM(ISNULL(l.ReceiveQty,0)) AS ReceiveQty,
        SUM(ISNULL(l.CommAmount,0)) AS ReceiveAmount, MAX(h.PostDate) AS LastGRDate
      FROM [${DATABASE}].[dbo].[PU_GOODSRCV] h
      JOIN [${DATABASE}].[dbo].[PU_GOODSRCVLN] l ON l.GoodsRcvID = h.GoodsRcvID
      WHERE h.PostDate >= '2000-01-01'
      GROUP BY h.SupplierCode
    ),
    inv AS (
      SELECT SupplierCode, COUNT(DISTINCT InvoiceRcvID) AS TotalInvoice,
        SUM(ISNULL(GrandTotal, ISNULL(TotalAmount,0))) AS InvoiceAmount,
        SUM(ISNULL(OutstandingAmount,0)) AS OutstandingAmount,
        MAX(PostDate) AS LastInvoiceDate
      FROM [${DATABASE}].[dbo].[AP_INVOICERCV]
      WHERE PostDate >= '2000-01-01'
      GROUP BY SupplierCode
    )
    SELECT TOP ${limit}
      RTRIM(s.SupplierCode) AS SupplierCode,
      RTRIM(s.Name) AS SupplierName,
      RTRIM(ISNULL(s.ContactPerson, '-')) AS ContactPerson,
      RTRIM(ISNULL(s.Town, '-')) AS Kota,
      RTRIM(ISNULL(s.TelNo, '-')) AS Telp,
      RTRIM(ISNULL(s.Email, '-')) AS Email,
      RTRIM(ISNULL(s.Status, '-')) AS StatusSupplier,
      ISNULL(po.TotalPO, 0) AS TotalPO,
      ISNULL(po.TotalPOLine, 0) AS TotalPOLine,
      ISNULL(po.TotalItem, 0) AS TotalItem,
      CAST(ISNULL(po.POAmount, 0) AS DECIMAL(18,2)) AS POAmount,
      CAST(ISNULL(po.QtyOrder, 0) AS DECIMAL(18,2)) AS QtyOrder,
      CAST(ISNULL(po.QtyReceive, 0) AS DECIMAL(18,2)) AS QtyReceive,
      ISNULL(gr.TotalGR, 0) AS TotalGoodsReceive,
      CAST(ISNULL(gr.ReceiveAmount, 0) AS DECIMAL(18,2)) AS ReceiveAmount,
      ISNULL(inv.TotalInvoice, 0) AS TotalInvoice,
      CAST(ISNULL(inv.InvoiceAmount, 0) AS DECIMAL(18,2)) AS InvoiceAmount,
      CAST(ISNULL(inv.OutstandingAmount, 0) AS DECIMAL(18,2)) AS OutstandingInvoice,
      po.LastPODate,
      gr.LastGRDate,
      inv.LastInvoiceDate,
      s.UpdateDate AS SupplierUpdateDate
    FROM [${DATABASE}].[dbo].[PU_SUPPLIER] s
    LEFT JOIN po ON po.SupplierCode = s.SupplierCode
    LEFT JOIN gr ON gr.SupplierCode = s.SupplierCode
    LEFT JOIN inv ON inv.SupplierCode = s.SupplierCode
    WHERE 1=1 ${whereSearch}
    ORDER BY ISNULL(po.POAmount, 0) DESC, ISNULL(gr.ReceiveAmount, 0) DESC
  `)

  const summary = await first(ctx, `
    SELECT
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[PU_SUPPLIER]) AS TotalSupplierMaster,
      (SELECT SUM(CASE WHEN RTRIM(ISNULL(Status,''))='1' THEN 1 ELSE 0 END) FROM [${DATABASE}].[dbo].[PU_SUPPLIER]) AS SupplierActive,
      (SELECT SUM(CASE WHEN RTRIM(ISNULL(Email,''))='' THEN 1 ELSE 0 END) FROM [${DATABASE}].[dbo].[PU_SUPPLIER]) AS EmailKosong,
      (SELECT SUM(CASE WHEN RTRIM(ISNULL(TelNo,''))='' THEN 1 ELSE 0 END) FROM [${DATABASE}].[dbo].[PU_SUPPLIER]) AS TelpKosong,
      (SELECT SUM(CASE WHEN ISNULL(CreditLimit,0)=0 THEN 1 ELSE 0 END) FROM [${DATABASE}].[dbo].[PU_SUPPLIER]) AS CreditLimitNol,
      (SELECT COUNT(DISTINCT SupplierCode) FROM [${DATABASE}].[dbo].[PU_PO] WHERE PODate >= '2000-01-01') AS SupplierDenganPO,
      (SELECT CAST(SUM(ISNULL(l.Amount,0)) AS DECIMAL(18,2)) FROM [${DATABASE}].[dbo].[PU_PO] h JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID=h.POID WHERE h.PODate >= '2000-01-01') AS TotalPOAmount,
      (SELECT MAX(PODate) FROM [${DATABASE}].[dbo].[PU_PO] WHERE PODate >= '2000-01-01') AS TerakhirUpdate
  `)

  const chart = await rows(ctx, `
    SELECT TOP 12
      RTRIM(h.SupplierCode) AS SupplierCode,
      RTRIM(ISNULL(s.Name, h.SupplierCode)) AS SupplierName,
      COUNT(DISTINCT h.POID) AS TotalPO,
      CAST(SUM(ISNULL(l.Amount,0)) AS DECIMAL(18,2)) AS POAmount
    FROM [${DATABASE}].[dbo].[PU_PO] h
    JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID=h.POID
    LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON s.SupplierCode=h.SupplierCode
    WHERE h.PODate >= '2000-01-01'
    GROUP BY RTRIM(h.SupplierCode), RTRIM(ISNULL(s.Name,h.SupplierCode))
    ORDER BY POAmount DESC
  `)

  return {
    title: 'Supplier Performance & Master Quality',
    description: 'Kinerja supplier berdasarkan PO, goods receive, invoice, outstanding invoice, dan kualitas master supplier.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'PU_SUPPLIER, PU_PO, PU_POLN, PU_GOODSRCV, PU_GOODSRCVLN, AP_INVOICERCV',
      primaryChart: 'Top Supplier by PO Amount',
      availableCharts: ['Top supplier by PO amount', 'Supplier master quality flags', 'Receive vs invoice coverage'],
      qualityFocus: ['Email/Telp/CreditLimit kosong adalah quality flag master supplier.'],
    }),
  }
}

async function fertilizerInventoryProcurement({ limit, search, ctx, filters }: ReportHandlerOptions): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const quantityClosing = quantityClosingExpression('i')
  const movementThresholds = movementThresholdsFromFilters(filters)
  const reportRows = await rows(ctx, `
    SELECT TOP ${limit}
      RTRIM(i.ItemCode) AS KodeBarang,
      RTRIM(i.Description) AS NamaPupuk,
      RTRIM(i.LocCode) AS Gudang,
      RTRIM(i.UOMCode) AS Satuan,
      CAST(${quantityClosing} AS DECIMAL(18,2)) AS QuantityClosing,
      ${stockIssueUsageColumns(quantityClosing, movementThresholds)},
      CAST(ISNULL(i.AverageCost,0) AS DECIMAL(18,2)) AS AverageCost,
      CAST(${quantityClosing} * ISNULL(i.AverageCost,0) AS DECIMAL(18,2)) AS NilaiStok,
      i.LastIssueDate,
      i.LastOrderDate,
      i.UpdateDate,
      RTRIM(ISNULL(lastpo.SupplierCode, '-')) AS LastSupplierCode,
      RTRIM(ISNULL(lastpo.SupplierName, '-')) AS LastSupplierName,
      lastpo.LastPODate,
      CAST(ISNULL(lastpo.LastPOAmount, 0) AS DECIMAL(18,2)) AS LastPOAmount
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    OUTER APPLY (
      SELECT TOP 1 h.SupplierCode, ISNULL(s.Name, h.SupplierCode) AS SupplierName, h.PODate AS LastPODate, l.Amount AS LastPOAmount
      FROM [${DATABASE}].[dbo].[PU_PO] h
      JOIN [${DATABASE}].[dbo].[PU_POLN] l ON l.POID = h.POID
      LEFT JOIN [${DATABASE}].[dbo].[PU_SUPPLIER] s ON s.SupplierCode = h.SupplierCode
      WHERE l.ItemCode = i.ItemCode AND h.PODate >= '2000-01-01'
      ORDER BY h.PODate DESC, ISNULL(l.Amount,0) DESC
    ) lastpo
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status,'0'))='1'
      AND RTRIM(ISNULL(i.ProdCatCode,''))='CA2111'
      ${itemSearch('i', search)}
    ORDER BY ${quantityClosing} * ISNULL(i.AverageCost,0) DESC
  `)

  const summary = await first(ctx, `
    SELECT
      COUNT(*) AS TotalPupukItem,
      SUM(CASE WHEN ${quantityClosing} > 0 THEN 1 ELSE 0 END) AS ItemAdaStok,
      CAST(SUM(${quantityClosing}) AS DECIMAL(18,2)) AS TotalStok,
      CAST(SUM(${quantityClosing} * ISNULL(i.AverageCost,0)) AS DECIMAL(18,2)) AS NilaiStok,
      SUM(CASE WHEN i.UpdateDate < DATEADD(YEAR,-1,GETDATE()) THEN 1 ELSE 0 END) AS StaleLebih1Tahun,
      SUM(CASE WHEN ISNULL(issueUsage.StockIssueEventCount, 0) = 0 THEN 1 ELSE 0 END) AS LastIssueTidakValid,
      MAX(i.UpdateDate) AS TerakhirUpdate
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    ${stockIssueUsageApply(DATABASE, 'i', movementWindowFromFilters(filters))}
    WHERE RTRIM(ISNULL(i.Status,'0'))='1'
      AND RTRIM(ISNULL(i.ProdCatCode,''))='CA2111'
  `)

  const chart = await rows(ctx, `
    SELECT TOP 12
      RTRIM(i.ItemCode) AS KodeBarang,
      RTRIM(i.Description) AS NamaPupuk,
      RTRIM(i.LocCode) AS Gudang,
      CAST(SUM(${quantityClosing}) AS DECIMAL(18,2)) AS TotalStok,
      CAST(SUM(${quantityClosing} * ISNULL(i.AverageCost,0)) AS DECIMAL(18,2)) AS NilaiStok
    FROM [${DATABASE}].[dbo].[IN_ITEM] i
    WHERE RTRIM(ISNULL(i.Status,'0'))='1'
      AND RTRIM(ISNULL(i.ProdCatCode,''))='CA2111'
    GROUP BY RTRIM(i.ItemCode), RTRIM(i.Description), RTRIM(i.LocCode)
    ORDER BY NilaiStok DESC
  `)

  return {
    title: 'Pupuk: Stock, Issue Readiness & Procurement',
    description: 'Report khusus kategori pupuk CA2111: stok, nilai, last issue/order, supplier PO terakhir, dan quality flag item pupuk.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'IN_ITEM, PU_PO, PU_POLN, PU_SUPPLIER, IN_STOCKISSUE, IN_STOCKISSUELN, WS_JOBSTOCK',
      quantityRule: 'QuantityClosing = QtyOnHand + QtyOnHold + QtyOnOrder',
      issueUsageRule: 'ItemType 1 Stock memakai IN_STOCKISSUE/IN_STOCKISSUELN; ItemType 4 Workshop memakai WS_JOBSTOCK.TransType = 1.',
      primaryChart: 'Top Pupuk by Stock Value',
      availableCharts: ['Top pupuk by stock value', 'PO pupuk by supplier', 'Pupuk stale update'],
      qualityFocus: ['ProdCatCode CA2111 dipakai sebagai definisi pupuk. LastIssue tidak valid dihitung dari movement aktual; ItemType 4 memakai WS_JOBSTOCK.'],
    }),
  }
}

async function vehicleRunningWorkshop({ limit, search, ctx, stale }: { limit: number; search: string; ctx: QueryContext; stale: string }): Promise<ReportPayload> {
  const DATABASE = ctx.database
  const q = sanitizeLike(search)
  const whereSearch = q ? `AND (RTRIM(v.VehCode) LIKE '%${q}%' OR RTRIM(v.Description) LIKE N'%${q}%' OR RTRIM(v.VehTypeCode) LIKE '%${q}%')` : ''
  const reportRows = await rows(ctx, `
    WITH usage AS (
      SELECT u.VehCode, COUNT(*) AS UsageLine, SUM(ISNULL(l.UsageUnit,0)) AS TotalUsageUnit,
        SUM(ISNULL(u.TotalAmount,0)) AS UsageAmount, MAX(l.TransactDate) AS LastUsageDate
      FROM [${DATABASE}].[dbo].[GL_VEHUSAGE] u
      JOIN [${DATABASE}].[dbo].[GL_VEHUSAGELN] l ON l.VehUsageID = u.VehUsageID
      WHERE l.TransactDate >= '2025-05-01'
      GROUP BY u.VehCode
    ),
    workshop AS (
      SELECT COALESCE(NULLIF(js.VehCode,''), NULLIF(j.VehCode,'')) AS VehCode,
        COUNT(DISTINCT js.JobID) AS TotalJob, COUNT(*) AS WorkshopLine, COUNT(DISTINCT js.ItemCode) AS WorkshopItem,
        SUM(ISNULL(js.Qty,0)) AS WorkshopQty, SUM(ISNULL(js.Amount,0)) AS WorkshopAmount,
        MAX(js.PostDate) AS LastWorkshopDate
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] js
      LEFT JOIN [${DATABASE}].[dbo].[WS_JOB] j ON j.JobID = js.JobID
      WHERE js.PostDate >= '2025-05-01'
      GROUP BY COALESCE(NULLIF(js.VehCode,''), NULLIF(j.VehCode,''))
    )
    SELECT TOP ${limit}
      RTRIM(v.VehCode) AS Kendaraan,
      RTRIM(v.Description) AS NamaKendaraan,
      RTRIM(ISNULL(v.VehTypeCode, '-')) AS TipeKendaraan,
      RTRIM(ISNULL(v.LocCode, '-')) AS Lokasi,
      RTRIM(ISNULL(v.Status, '-')) AS StatusKendaraan,
      CAST(ISNULL(u.TotalUsageUnit,0) AS DECIMAL(18,2)) AS TotalUsageUnit,
      ISNULL(u.UsageLine, 0) AS UsageLine,
      CAST(ISNULL(u.UsageAmount,0) AS DECIMAL(18,2)) AS UsageAmount,
      ISNULL(w.TotalJob, 0) AS TotalWorkshopJob,
      ISNULL(w.WorkshopLine, 0) AS WorkshopStockLine,
      ISNULL(w.WorkshopItem, 0) AS WorkshopItem,
      CAST(ISNULL(w.WorkshopQty,0) AS DECIMAL(18,2)) AS WorkshopQty,
      CAST(ISNULL(w.WorkshopAmount,0) AS DECIMAL(18,2)) AS WorkshopAmount,
      u.LastUsageDate,
      w.LastWorkshopDate,
      v.NextServiceMaintenanceDate,
      v.NextRenewRoadTaxDate
    FROM [${DATABASE}].[dbo].[GL_VEHICLE] v
    LEFT JOIN usage u ON u.VehCode = v.VehCode
    LEFT JOIN workshop w ON w.VehCode = v.VehCode
    WHERE (u.VehCode IS NOT NULL OR w.VehCode IS NOT NULL)
      ${whereSearch}
    ORDER BY ISNULL(w.WorkshopAmount,0) DESC, ISNULL(u.TotalUsageUnit,0) DESC
  `)

  const summary = await first(ctx, `
    SELECT
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[GL_VEHICLE]) AS TotalVehicleMaster,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[BD_VEHICLERUNNING]) AS TotalVehicleRunningBudget,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[GL_VEHUSAGE]) AS TotalVehicleUsageDoc,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[GL_VEHUSAGELN]) AS TotalVehicleUsageLine,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[WS_JOB]) AS TotalWorkshopJob,
      (SELECT COUNT(*) FROM [${DATABASE}].[dbo].[WS_JOBSTOCK]) AS TotalWorkshopStockLine,
      (SELECT MAX(UpdateDate) FROM [${DATABASE}].[dbo].[BD_VEHICLERUNNING]) AS LastRunningUpdate,
      (SELECT MAX(TransactDate) FROM [${DATABASE}].[dbo].[GL_VEHUSAGELN] WHERE TransactDate >= '2000-01-01') AS LastUsageDate,
      (SELECT MAX(PostDate) FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] WHERE PostDate >= '2000-01-01') AS TerakhirUpdate
  `)

  const chart = await rows(ctx, `
    WITH workshop AS (
      SELECT COALESCE(NULLIF(js.VehCode,''), NULLIF(j.VehCode,'')) AS VehCode,
        SUM(ISNULL(js.Amount,0)) AS WorkshopAmount, COUNT(DISTINCT js.JobID) AS TotalJob, MAX(js.PostDate) AS LastPostDate
      FROM [${DATABASE}].[dbo].[WS_JOBSTOCK] js
      LEFT JOIN [${DATABASE}].[dbo].[WS_JOB] j ON j.JobID = js.JobID
      WHERE js.PostDate >= '2025-05-01'
      GROUP BY COALESCE(NULLIF(js.VehCode,''), NULLIF(j.VehCode,''))
    )
    SELECT TOP 15
      RTRIM(w.VehCode) AS Kendaraan,
      RTRIM(ISNULL(v.Description, w.VehCode)) AS NamaKendaraan,
      COUNT(*) AS Baris,
      CAST(MAX(w.WorkshopAmount) AS DECIMAL(18,2)) AS WorkshopAmount,
      MAX(w.TotalJob) AS TotalJob,
      MAX(w.LastPostDate) AS LastPostDate
    FROM workshop w
    LEFT JOIN [${DATABASE}].[dbo].[GL_VEHICLE] v ON v.VehCode = w.VehCode
    WHERE w.VehCode IS NOT NULL
    GROUP BY RTRIM(w.VehCode), RTRIM(ISNULL(v.Description, w.VehCode))
    ORDER BY WorkshopAmount DESC
  `)

  return {
    title: 'Vehicle Running & Workshop Inventory Usage',
    description: 'Executive view kendaraan: running/usage unit, pemakaian sparepart workshop, biaya stock workshop, service date, dan quality linkage kendaraan.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart,
    metadata: metadata(ctx, {
      sourceTables: 'GL_VEHICLE, BD_VEHICLERUNNING, GL_VEHUSAGE, GL_VEHUSAGELN, WS_JOB, WS_JOBSTOCK',
      primaryChart: 'Top Vehicle by Workshop Stock Amount',
      availableCharts: ['Top vehicle by workshop cost', 'Usage unit ranking', 'Workshop stock item concentration'],
      qualityFocus: ['WS_JOBSTOCK.VehCode banyak kosong sehingga fallback ke WS_JOB.VehCode dipakai.'],
    }),
  }
}

const reportHandlers: Record<string, ReportHandler> = {
  'stok-gudang': stockSummary,
  'asset-stock-valuasi-listing': assetStockValuationListing,
  'all-stock-movement-analysis': allStockMovementAnalysis,
  'report-asset-stock-valuasi-listing': assetStockValuationListing,
  'seluruh-stock-summary': assetStockValuationListing,
  'RPTIN1000011': assetStockValuationListing,
  'summary': stockSummary,
  'kartu-stok': stockCard,
  'kualitas-master-item': stockCard,
  'mutasi-barang': stockMovement,
  'monthly-stock-account-movement-details': monthlyStockAccountMovementDetails,
  'RPTIN1000015': monthlyStockAccountMovementDetails,
  'penerimaan-barang': stockReceive,
  'pengeluaran-barang': stockIssue,
  'purchase-request-inventory': purchaseRequestInventory,
  'transfer-antar-gudang': transferWarehouse,
  'stock-opname': stockOpname,
  'fuel-usage': fuelUsage,
  'reorder-level': reorderLevel,
  'riwayat-transaksi': transactionHistory,
  'return-barang': stockReturn,
  'item-stale-update': itemUpdateAge,
  'purchase-order-history': purchaseOrderHistory,
  'supplier-purchasing-performance': supplierPerformance,
  'pupuk-stock-procurement': fertilizerInventoryProcurement,
  'vehicle-running-workshop': vehicleRunningWorkshop,
}

function toCsv(rowsData: DbRow[]) {
  if (rowsData.length === 0) return ''
  const headers = Object.keys(rowsData[0])
  const escapeCell = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return `"${text.replace(/"/g, '""')}"`
  }
  return [headers.join(','), ...rowsData.map((row) => headers.map((header) => escapeCell(row[header])).join(','))].join('\n')
}

export async function GET(request: NextRequest) {
  const gatewayOverride = gatewayOverrideFromRequest({
    headers: request.headers,
    searchParams: request.nextUrl.searchParams,
  })
  return gatewayBaseStorage.run(gatewayOverride, () => handleInventoryGet(request))
}

async function handleInventoryGet(request: NextRequest) {
  const ctx = sourceToContext(getSource(request))
  const reportParam = request.nextUrl.searchParams.get('report') ?? 'stok-gudang'
  const format = request.nextUrl.searchParams.get('format') ?? 'json'
  const search = request.nextUrl.searchParams.get('search') ?? ''
  const stale = request.nextUrl.searchParams.get('stale') ?? 'lebih-1-tahun'
  const rawFilters = filtersFromSearchParams(request.nextUrl.searchParams)
  const page = getPage(request)
  const pageSize = getPageSize(request)
  const tableSort = getTableSort(request)
  const report = getInventoryReport(reportParam)
  const handler = reportHandlers[report?.apiReport ?? reportParam]
  const handlerKey = report?.apiReport ?? reportParam
  const isMonthlyStockAccountMovementReport = handlerKey === 'monthly-stock-account-movement-details' || handlerKey === 'RPTIN1000015'
  const filters = isMonthlyStockAccountMovementReport
    ? normalizeInventoryAnalysisGroupFilters(rawFilters)
    : rawFilters
  const isStockAgingReport = handlerKey === 'item-stale-update' || handlerKey === 'all-stock-movement-analysis'
  const isFullListingReport = ['asset-stock-valuasi-listing', 'report-asset-stock-valuasi-listing', 'seluruh-stock-summary', 'RPTIN1000011', 'all-stock-movement-analysis'].includes(handlerKey)
  const exportAll = format === 'csv' || wantsAllRows(request)
  const limitAll = exportAll
  const limit = limitAll ? 20000 : Math.min(page * pageSize, TABLE_WINDOW_ROW_LIMIT)
  const includeDebugSql = isAdminDebugRequest(request)
  const debugSqlStatements: DebugSqlStatement[] = []

  if (report?.status === 'hold') {
    return NextResponse.json(
      {
        success: false,
        report: report.id,
        error: `Report '${report.title}' masih hold: ${report.qualityNotes.join(' ')}`,
        metadata: metadata(ctx, {
          reportCode: report.code,
          reportStatus: report.status,
          sourceTables: report.sourceTables.join(', '),
          availableCharts: report.chartDefinitions.map((chart) => chart.title),
          qualityNotes: report.qualityNotes,
        }),
      },
      { status: 409 },
    )
  }

  if (!handler) {
    return NextResponse.json({ success: false, error: `Report '${reportParam}' tidak ditemukan` }, { status: 404 })
  }

  try {
    const rawPayload = includeDebugSql
      ? await debugSqlStorage.run(debugSqlStatements, () => handler({ limit, limitAll, search, ctx, stale, filters }))
      : await handler({ limit, limitAll, search, ctx, stale, filters })
    const rawPayloadWithMovement = includeDebugSql
      ? await debugSqlStorage.run(debugSqlStatements, () => enrichPayloadWithMovementCategory(rawPayload, ctx, filters))
      : await enrichPayloadWithMovementCategory(rawPayload, ctx, filters)
    const sqlScopedFilters = handlerKey === 'monthly-stock-account-movement-details' || handlerKey === 'RPTIN1000015'
    const allStockMovementScopedFilters = handlerKey === 'all-stock-movement-analysis'
    const periodScopedFilters = isFullListingReport
    const itemScopeSqlScopedFilters = [
      'asset-stock-valuasi-listing',
      'report-asset-stock-valuasi-listing',
      'RPTIN1000011',
      'goods-receiving-receipt-activity',
      'purchase-request-inventory',
      'purchase-order-history',
    ].includes(handlerKey)
    const basePostFilterInput = sqlScopedFilters
      ? {
          ...filters,
          search: undefined,
          period: undefined,
          accYear: undefined,
          accMonth: undefined,
          actualYear: undefined,
          actualMonth: undefined,
          dateFrom: undefined,
          dateTo: undefined,
          location: undefined,
          category: undefined,
          stockAnalysis: undefined,
          productType: undefined,
          productCategory: undefined,
          productBrand: undefined,
          productModel: undefined,
          productMaterial: undefined,
          includeWorkshopItem: undefined,
          movementCategory: undefined,
          movementWindow: undefined,
          groupBy: undefined,
          chartDimension: undefined,
          aggregateField: undefined,
          aggregateFn: undefined,
          top: undefined,
        }
      : allStockMovementScopedFilters
        // Keep SQL chart/summary by MovementCategory. Do NOT re-group by location/Gudang.
        ? {
            ...filters,
            search: undefined,
            period: undefined,
            accYear: undefined,
            accMonth: undefined,
            actualYear: undefined,
            actualMonth: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            location: undefined,
            category: undefined,
            movementCategory: undefined,
            movementWindow: undefined,
            movementFastMin: undefined,
            movementMovingMin: undefined,
            movementMovingMax: undefined,
            movementSlowCount: undefined,
            stale: undefined,
            groupBy: undefined,
            chartDimension: undefined,
          }
      : itemScopeSqlScopedFilters
        ? {
            ...filters,
            search: undefined,
            period: undefined,
            accYear: undefined,
            accMonth: undefined,
            actualYear: undefined,
            actualMonth: undefined,
            dateFrom: undefined,
            dateTo: undefined,
            location: undefined,
            category: undefined,
            stockAnalysis: undefined,
            productType: undefined,
            productCategory: undefined,
            productBrand: undefined,
            productModel: undefined,
            productMaterial: undefined,
            itemType: undefined,
            includeWorkshopItem: undefined,
            movementWindow: undefined,
          }
      : periodScopedFilters
        ? { ...filters, period: undefined, accYear: undefined, accMonth: undefined, actualYear: undefined, actualMonth: undefined, dateFrom: undefined, dateTo: undefined, movementWindow: undefined }
      : { ...filters, movementWindow: undefined }
    const postFilterInput = { ...basePostFilterInput, itemType: undefined }
    const rawChart = rawPayloadWithMovement.chart
    const payload = applyTableSort(applyReportFilters(rawPayloadWithMovement, postFilterInput), tableSort.column, tableSort.direction)
    if (allStockMovementScopedFilters && Array.isArray(rawChart) && rawChart.length > 0) {
      // Preserve SQL chart grouped by MovementCategory (Fast/Moving/Slow/Dead/Stale).
      payload.chart = rawChart
    }
    payload.metadata = {
      ...payload.metadata,
      reportId: report?.id ?? reportParam,
      reportCode: report?.code,
      reportStatus: report?.status ?? 'live',
      reportValidated: report?.validated ?? true,
      executiveQuestion: report?.executiveQuestion,
      dataGrain: report?.dataGrain,
      chartDefinitions: report?.chartDefinitions ?? [],
      qualityNotes: report?.qualityNotes ?? [],
      sourceTables: report?.sourceTables?.join(', ') ?? payload.metadata.sourceTables,
      filterParameters: buildFilterParameterMetadata(filters, payload, report?.id ?? reportParam, ctx),
      movementAnalysis: payloadHasMovementCategory(payload)
        ? buildMovementPeriodMetadata(
            undefined,
            movementWindowFromFilters(filters),
            movementThresholdsFromFilters(filters),
          )
        : undefined,
      sqlScopedFilters: sqlScopedFilters
        ? {
            search: filters.search,
            period: filters.period,
            location: filters.location,
            category: filters.category,
            stockAnalysis: filters.stockAnalysis,
            productType: filters.productType,
            productCategory: filters.productCategory,
            productBrand: filters.productBrand,
            productModel: filters.productModel,
            productMaterial: filters.productMaterial,
            itemType: filters.itemType,
            includeWorkshopItem: filters.includeWorkshopItem,
            movementCategory: filters.movementCategory,
            groupBy: filters.groupBy,
            chartDimension: filters.chartDimension,
          }
        : allStockMovementScopedFilters
          ? {
              search: filters.search,
              period: filters.period,
              accYear: filters.accYear,
              accMonth: filters.accMonth,
              actualYear: filters.actualYear,
              actualMonth: filters.actualMonth,
              location: filters.location,
              category: filters.category,
              movementCategory: filters.movementCategory,
              movementWindow: filters.movementWindow,
              movementFastMin: filters.movementFastMin,
              movementMovingMin: filters.movementMovingMin,
              movementMovingMax: filters.movementMovingMax,
              movementSlowCount: filters.movementSlowCount,
              movementCategoryThresholds: movementThresholdsFromFilters(filters),
              movementWindowResolved: movementWindowFromFilters(filters),
            }
        : undefined,
    }
    if (includeDebugSql) {
      payload.metadata.debugSql = {
        enabled: true,
        access: 'ADMIN',
        target: {
          source: ctx.source,
          sourceLabel: ctx.sourceLabel,
          server: ctx.server,
          database: ctx.database,
        },
        sourceTables: payload.metadata.sourceTables,
        statementCount: debugSqlStatements.length,
        copyHint: 'Copy statement summary untuk validasi angka KPI/total. Semua SQL sudah memakai database qualifier dan read-only SELECT.',
        statements: debugSqlStatements.map((statement, index) => ({
          ...statement,
          id: `${index + 1}-${statement.label}`,
          ordinal: index + 1,
        })),
      }
    }

    console.info('[inventory-report-read]', {
      report: report?.id ?? reportParam,
      source: ctx.source,
      rows: payload.rows.length,
      page,
      pageSize,
      filters: payload.metadata.appliedFilters,
      mode: payload.metadata.querySafety,
    })

    if (format === 'csv') {
      const csv = toCsv(payload.rows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${report?.id ?? reportParam}.csv"`,
        },
      })
    }

    let responsePayload = paginatePayload(payload, { page, pageSize }, !limitAll, TABLE_WINDOW_ROW_LIMIT)
    responsePayload = attachInventoryAnalytics(
      responsePayload,
      sqlScopedFilters
        ? buildMonthlyStockAccountMovementAnalytics(responsePayload)
        : buildInventoryReportAnalytics(responsePayload, {
            reportId: report?.id ?? reportParam,
            sourcePayload: payload,
          }),
    )

    return NextResponse.json({
      success: true,
      report: report?.id ?? reportParam,
      data: responsePayload,
      totalRows: responsePayload.metadata.totalRows,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        report: report?.id ?? reportParam,
        error: error instanceof Error ? error.message : 'Gagal memuat laporan inventory',
        metadata: metadata(ctx),
      },
      { status: 502 },
    )
  }
}

