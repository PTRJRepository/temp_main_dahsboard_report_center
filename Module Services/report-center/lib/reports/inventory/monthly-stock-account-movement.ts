import { accountingToActualPeriod, actualToAccountingPeriod } from '../accounting-period'
import {
  fuelIssueFiscalPeriodFilter,
  fuelIssueStatusFilter,
  FUEL_ISSUE_PERIOD_RULE,
} from './fuel-issue-sql'
import { MOVEMENT_CATEGORY_ORDER, normalizeMovementCategoryLabel } from '../movement-category'
import type { DbRow, ReportFilterInput } from '../report-filtering'
import type { InventoryAnalyticsContract } from './analytics-contract'
import {
  executeInventoryReadQuery,
  normalizeInventoryQueryLimit,
  type InventoryQueryContext,
} from './query-gateway'

export const MONTHLY_STOCK_MOVEMENT_REPORT_ID = 'RPTIN1000015'
export const MONTHLY_STOCK_MOVEMENT_REPORT_TITLE = 'MONTHLY STOCK ACCOUNT MOVEMENT DETAILS'
/** @deprecated Stock Analysis Code (DEADS/MEMOV/SLMOV) removed from monthly path. Official group = Product Type Code. */
export const MONTHLY_STOCK_ANALYSIS_CODES = [] as const

export type MonthlyStockAnalysisCode = string

export type MonthlyMovementKey =
  | 'opening'
  | 'received'
  | 'return_advice'
  | 'transferred'
  | 'adjustment'
  | 'issued_ledger'
  | 'issued_station'
  | 'issued_vehicle'
  | 'issued_total'
  | 'return'
  | 'purchasing_goods_receive'
  | 'purchasing_goods_return'
  | 'purchasing_dispatch_advice'
  | 'closing'

export type MonthlyMovementMeasureStatus = 'implemented' | 'placeholder_zero'

export type MonthlyMovementDefinition = {
  key: MonthlyMovementKey
  sqlPrefix: string
  label: string
  quantity_unit: string
  amount_currency: string
  status: MonthlyMovementMeasureStatus
  source: string
}

export type MonthlyMovementAmount = {
  quantity: number
  amount_idr: number
}

export type MonthlyMovementTotals = Record<MonthlyMovementKey, MonthlyMovementAmount>

export type MonthlyStockMovementScope = {
  actualYear: number
  actualMonth: number
  actualPeriod: string
  actualPeriodStart: string
  accYear: number
  accMonth: number
  accountingPeriod: string
  openingAccYear: number
  openingAccMonth: number
  openingAccountingPeriod: string
  openingActualPeriod: string
  location: string
  /** Kept empty — Stock Analysis Code filter removed; official scope is active ItemType 1+4 + Product Type. */
  categoryCodes: MonthlyStockAnalysisCode[]
  search: string
  limit: number
  transactionAsOf: string
  inputMode: 'actual' | 'accounting' | 'period' | 'current'
  /** True = report untuk periode lampau; base CTE menggunakan IN_MTHENDITEM snapshot, bukan IN_ITEM live */
  snapshotMode: boolean
  /** Official PDF default analysis group */
  analysisGroup: string
}

export type MonthlyStockMovementPayload = {
  title: string
  description: string
  rows: DbRow[]
  columns: string[]
  summary: DbRow
  chart: DbRow[]
  metadata: DbRow
}

export type MonthlyStockMovementNestedItem = {
  product_type_code: string
  product_type_name: string
  sequence_in_group: number
  item_code: string
  description: string
  unit: string
  description_as_printed: string
  movements: MonthlyMovementTotals
  source_page: number
}

export type MonthlyStockMovementNestedResponse = {
  metadata: DbRow
  column_definitions: Array<Pick<MonthlyMovementDefinition, 'key' | 'label' | 'quantity_unit' | 'amount_currency'> & {
    status: MonthlyMovementMeasureStatus
  }>
  product_types: Array<{
    code: string
    description: string
    item_count: number
    reported_total: MonthlyMovementTotals
    calculated_total: MonthlyMovementTotals
    totals_source: 'full_scope_product_type_query'
  }>
  items: MonthlyStockMovementNestedItem[]
}

export type MonthlyStockMovementQueryExecutor = (ctx: InventoryQueryContext, sql: string) => Promise<DbRow[]>

export const MONTHLY_MOVEMENT_DEFINITIONS: readonly MonthlyMovementDefinition[] = [
  {
    key: 'opening',
    sqlPrefix: 'Opening',
    label: 'Opening',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'IN_MTHENDITEM previous accounting period',
  },
  {
    key: 'received',
    sqlPrefix: 'Received',
    label: 'Inventory Received',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'IN_STOCKRECEIVE/LN — inventory module receive (bukan purchasing GR)',
  },
  {
    key: 'return_advice',
    sqlPrefix: 'ReturnAdvice',
    label: 'Return Advice',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'placeholder_zero',
    source: 'Not implemented in current RPTIN1000015 reconstruction',
  },
  {
    key: 'transferred',
    sqlPrefix: 'Transferred',
    label: 'Transferred',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'placeholder_zero',
    source: 'Not implemented in current RPTIN1000015 reconstruction',
  },
  {
    key: 'adjustment',
    sqlPrefix: 'Adjustment',
    label: 'Adjustment',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'placeholder_zero',
    source: 'Not implemented in current RPTIN1000015 reconstruction',
  },
  {
    key: 'issued_ledger',
    sqlPrefix: 'Ledger',
    label: 'Issued - Ledger',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'IN_STOCKISSUE/IN_STOCKISSUELN, IN_FUELISSUE/IN_FUELISSUELN, and WS_JOBSTOCK TransType 1 without block or vehicle',
  },
  {
    key: 'issued_station',
    sqlPrefix: 'IssuedStation',
    label: 'Issued - Station',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'IN_STOCKISSUE/IN_STOCKISSUELN, IN_FUELISSUE/IN_FUELISSUELN, and WS_JOBSTOCK TransType 1 with block and no vehicle',
  },
  {
    key: 'issued_vehicle',
    sqlPrefix: 'IssuedVehicle',
    label: 'Issued - Vehicle',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'IN_STOCKISSUE/IN_STOCKISSUELN, IN_FUELISSUE/IN_FUELISSUELN, and WS_JOBSTOCK TransType 1 with vehicle',
  },
  {
    key: 'issued_total',
    sqlPrefix: 'IssuedTotal',
    label: 'Issued - Total',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'Computed ledger + station + vehicle issue',
  },
  {
    key: 'return',
    sqlPrefix: 'Return',
    label: 'Inventory Return',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'IN_STOCKRTN/LN + WS_JOBSTOCK TransType 2 (return ke gudang, bukan purchasing goods return)',
  },
  {
    key: 'purchasing_goods_receive',
    sqlPrefix: 'GoodsReceive',
    label: 'Purchasing Goods Receive',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'PU_GOODSRCV/LN × PU_POLN.Cost · Status 2/5/6',
  },
  {
    key: 'purchasing_goods_return',
    sqlPrefix: 'GoodsReturn',
    label: 'Purchasing Goods Return',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'PU_GOODSRET/LN · retur ke supplier (bukan inventory stock return)',
  },
  {
    key: 'purchasing_dispatch_advice',
    sqlPrefix: 'DispatchAdv',
    label: 'Purchasing - Dispatch Advice',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'placeholder_zero',
    source: 'Not implemented in current RPTIN1000015 reconstruction',
  },
  {
    key: 'closing',
    sqlPrefix: 'Closing',
    label: 'Closing',
    quantity_unit: 'item unit',
    amount_currency: 'IDR',
    status: 'implemented',
    source: 'Computed opening + in - issue + return - purchasing out',
  },
]

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

function formatPeriod(year: number, month: number) {
  return `${year}-${padMonth(month)}`
}

function sanitizeSqlText(value: unknown, max = 80) {
  return String(value ?? '').trim().replace(/'+/g, "''").replace(/[%[\]]/g, '').slice(0, max)
}

function normalizeLocation(value: unknown) {
  const code = sanitizeSqlText(value, 16).toUpperCase()
  return /^[A-Z0-9_-]{1,16}$/.test(code) ? code : 'PTRJ'
}

function numberValue(value: unknown) {
  const numeric = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0
}

function previousAccountingPeriod(accYear: number, accMonth: number) {
  return accMonth <= 1
    ? { accYear: accYear - 1, accMonth: 12 }
    : { accYear, accMonth: accMonth - 1 }
}

function periodFromActual(
  actualYear: number,
  actualMonth: number,
  inputMode: MonthlyStockMovementScope['inputMode'],
) {
  const accounting = actualToAccountingPeriod(actualYear, actualMonth)
  if (!accounting) throw new Error('Periode monthly stock movement tidak valid.')

  const opening = previousAccountingPeriod(accounting.accYear, accounting.accMonth)
  const openingActual = accountingToActualPeriod(opening.accYear, opening.accMonth)
  if (!openingActual) throw new Error('Opening period monthly stock movement tidak valid.')

  return {
    actualYear,
    actualMonth,
    actualPeriod: formatPeriod(actualYear, actualMonth),
    actualPeriodStart: `${formatPeriod(actualYear, actualMonth)}-01`,
    accYear: accounting.accYear,
    accMonth: accounting.accMonth,
    accountingPeriod: accounting.accountingPeriod,
    openingAccYear: opening.accYear,
    openingAccMonth: opening.accMonth,
    openingAccountingPeriod: formatPeriod(opening.accYear, opening.accMonth),
    openingActualPeriod: openingActual.actualPeriod,
    inputMode,
  }
}

/** Stock Analysis Code filter removed. Always empty — keep signature for callers. */
export function normalizeMonthlyStockAnalysisCodes(_value?: string | null): MonthlyStockAnalysisCode[] {
  return []
}

export function resolveMonthlyStockMovementScope({
  filters,
  search,
  limit,
  now = new Date(),
  source: _source,
}: {
  filters?: ReportFilterInput
  search?: string
  limit?: number
  now?: Date
  /** Kept for caller compatibility; official report keys are fiscal for all sources. */
  source?: string
} = {}): MonthlyStockMovementScope {
  void _source
  // Prefer actual calendar period so stale AccYear/AccMonth in URL cannot win.
  const rawPeriod = filters?.period?.trim()
  const actualMatch = rawPeriod?.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/)
  const fromActualPeriod = actualMatch
    ? actualToAccountingPeriod(Number(actualMatch[1]), Number(actualMatch[2]))
    : null
  const fromActualFields = filters?.actualYear && filters?.actualMonth
    ? actualToAccountingPeriod(filters.actualYear, filters.actualMonth)
    : null
  const accountingMatch = rawPeriod?.match(/^(?:acc|accounting)[:/-](\d{4})-(\d{1,2})$/i)
  const fromAccountingPeriod = accountingMatch
    ? accountingToActualPeriod(Number(accountingMatch[1]), Number(accountingMatch[2]))
    : null
  const fromAccountingFields = filters?.accYear && filters?.accMonth
    ? accountingToActualPeriod(filters.accYear, filters.accMonth)
    : null
  const resolved = fromActualPeriod
    ? periodFromActual(fromActualPeriod.actualYear, fromActualPeriod.actualMonth, 'period')
    : fromActualFields
      ? periodFromActual(fromActualFields.actualYear, fromActualFields.actualMonth, 'actual')
      : fromAccountingPeriod
        ? periodFromActual(fromAccountingPeriod.actualYear, fromAccountingPeriod.actualMonth, 'accounting')
        : fromAccountingFields
          ? periodFromActual(fromAccountingFields.actualYear, fromAccountingFields.actualMonth, 'accounting')
          : periodFromActual(now.getFullYear(), now.getMonth() + 1, 'current')

  // Snapshot mode: periode yang diminta adalah bulan lampau (bukan bulan berjalan).
  // Untuk periode lampau, base CTE menggunakan IN_MTHENDITEM snapshot (qty/amount akhir bulan),
  // bukan IN_ITEM live (yang terus berubah setiap ada transaksi).
  const requestedYear = resolved.actualYear
  const requestedMonth = resolved.actualMonth
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const snapshotMode = requestedYear < currentYear || (requestedYear === currentYear && requestedMonth < currentMonth)

  const analysisGroupRaw = String(filters?.groupBy ?? filters?.chartDimension ?? 'ProductTypeCode').trim()
  const analysisGroup = analysisGroupRaw && analysisGroupRaw !== 'StockAnalysisCode'
    ? analysisGroupRaw
    : 'ProductTypeCode'

  return {
    ...resolved,
    location: normalizeLocation(filters?.location),
    categoryCodes: [],
    search: sanitizeSqlText(search ?? filters?.search ?? '', 120),
    limit: normalizeInventoryQueryLimit(limit, { min: 1, max: 20_000, fallback: 500 }),
    transactionAsOf: normalizeMonthlyTransactionAsOf(filters?.dateTo),
    snapshotMode,
    analysisGroup,
  }
}

function normalizeMonthlyTransactionAsOf(value?: string) {
  const raw = sanitizeSqlText(value ?? '', 32).replace(' ', 'T')
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T23:59:59`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) return `${raw}:00`
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(raw)) return raw
  return ''
}

function monthlyTextSearch(search: string, fields: string[]) {
  const q = sanitizeSqlText(search, 120)
  if (!q) return ''
  return `AND (${fields.map((field) => `RTRIM(${field}) LIKE N'%${q}%'`).join(' OR ')})`
}

function accountingPeriodFilter(alias: string, accYear: number, accMonth: number) {
  return `
      AND RTRIM(CONVERT(varchar(10), ${alias}.AccYear)) = '${accYear}'
      AND RTRIM(CONVERT(varchar(10), ${alias}.AccMonth)) = '${accMonth}'`
}

function transactionAsOfFilter(alias: string, transactionAsOf: string) {
  return transactionAsOf ? `AND COALESCE(${alias}.UpdateDate, ${alias}.CreateDate) <= CONVERT(datetime, '${transactionAsOf}', 126)` : ''
}

function nonWorkshopItemTypeFilter(alias: string) {
  return `AND ISNULL(RTRIM(CONVERT(varchar(10), ${alias}.ItemType)), '') <> '4'`
}

function inventoryValuationItemTypeFilter(alias: string) {
  // GUARDRAIL(monthly-valuation-itemtype):
  // Valuation/evaluation scope must include ItemType 1 Stock/Gudang and
  // ItemType 4 Workshop/Mesin. Do not narrow this default to ItemType = '1'.
  return `AND ISNULL(RTRIM(CONVERT(varchar(10), ${alias}.ItemType)), '') IN ('1', '4')`
}

function workshopStockIssueItemTypeExpression(itemAlias = 'i', stockAlias = 's') {
  return `COALESCE(
            NULLIF(RTRIM(CONVERT(varchar(10), ${itemAlias}.ItemType)), ''),
            NULLIF(RTRIM(CONVERT(varchar(10), ${stockAlias}.ItemType)), '')
          )`
}

/** Base CTE untuk periode lampau: pakai IN_MTHENDITEM snapshot (period-end balance). */
function buildSnapshotBaseCte(database: string, scope: MonthlyStockMovementScope, _categoryFilter: string, whereSearch: string) {
  return `
      SELECT
        RTRIM(m.ItemCode) AS ItemCode,
        RTRIM(ISNULL(i.Description, m.ItemCode)) AS Description,
        RTRIM(ISNULL(i.UOMCode, '-')) AS UOM,
        RTRIM(m.LocCode) AS Location,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductTypeCode,
        RTRIM(ISNULL(pt.Description, ISNULL(i.ProdTypeCode, ''))) AS ProductTypeDescription,
        CAST(ISNULL(m.Qty, 0) AS decimal(18, 6)) AS QtyOnHand,
        CAST(0 AS decimal(18, 6)) AS QtyOnHold,
        CAST(ISNULL(m.AverageCost, 0) AS decimal(18, 6)) AS AverageCost,
        CAST(ISNULL(m.Amount, ISNULL(m.Qty, 0) * ISNULL(m.AverageCost, 0)) AS decimal(18, 6)) AS OnHandHoldAmount
      FROM [${database}].[dbo].[IN_MTHENDITEM] m
      LEFT JOIN [${database}].[dbo].[IN_ITEM] i
        ON i.ItemCode = m.ItemCode
        AND i.LocCode = m.LocCode
      LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt
        ON pt.ProdTypeCode = i.ProdTypeCode
      WHERE RTRIM(m.LocCode) = '${scope.location}'
        AND RTRIM(CONVERT(varchar(10), m.AccYear)) = '${scope.accYear}'
        AND RTRIM(CONVERT(varchar(10), m.AccMonth)) = '${scope.accMonth}'
        ${whereSearch}
      UNION ALL
      -- Item yang ADA di IN_ITEM master tapi BELUM ada di IN_MTHENDITEM bulan tsb
      SELECT
        RTRIM(i.ItemCode) AS ItemCode,
        RTRIM(i.Description) AS Description,
        RTRIM(i.UOMCode) AS UOM,
        RTRIM(i.LocCode) AS Location,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductTypeCode,
        RTRIM(ISNULL(pt.Description, ISNULL(i.ProdTypeCode, ''))) AS ProductTypeDescription,
        CAST(0 AS decimal(18, 6)) AS QtyOnHand,
        CAST(0 AS decimal(18, 6)) AS QtyOnHold,
        CAST(0 AS decimal(18, 6)) AS AverageCost,
        CAST(0 AS decimal(18, 6)) AS OnHandHoldAmount
      FROM [${database}].[dbo].[IN_ITEM] i
      LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt
        ON pt.ProdTypeCode = i.ProdTypeCode
      WHERE RTRIM(i.LocCode) = '${scope.location}'
        -- RPTIN1000015 Suppress Zero Balance = No includes inactive zero rows (status 2).
        AND RTRIM(i.Status) IN ('1', '2')
        ${inventoryValuationItemTypeFilter('i')}
        AND RTRIM(ISNULL(i.ProdTypeCode, '')) <> 'DC'
        AND NOT EXISTS (
          SELECT 1 FROM [${database}].[dbo].[IN_MTHENDITEM] mx
          WHERE mx.ItemCode = i.ItemCode
            AND mx.LocCode = i.LocCode
            AND RTRIM(CONVERT(varchar(10), mx.AccYear)) = '${scope.accYear}'
            AND RTRIM(CONVERT(varchar(10), mx.AccMonth)) = '${scope.accMonth}'
        )
        ${whereSearch}
  `
}

/** Base CTE untuk periode berjalan: pakai IN_ITEM live. */
function buildLiveBaseCte(database: string, scope: MonthlyStockMovementScope, _categoryFilter: string, whereSearch: string) {
  return `
      SELECT
        RTRIM(i.ItemCode) AS ItemCode,
        RTRIM(i.Description) AS Description,
        RTRIM(i.UOMCode) AS UOM,
        RTRIM(i.LocCode) AS Location,
        RTRIM(ISNULL(i.ProdTypeCode, '')) AS ProductTypeCode,
        RTRIM(ISNULL(pt.Description, ISNULL(i.ProdTypeCode, ''))) AS ProductTypeDescription,
        CAST(ISNULL(i.QtyOnHand, 0) AS decimal(18, 6)) AS QtyOnHand,
        CAST(ISNULL(i.QtyOnHold, 0) AS decimal(18, 6)) AS QtyOnHold,
        CAST(ISNULL(i.AverageCost, 0) AS decimal(18, 6)) AS AverageCost,
        CAST((ISNULL(i.QtyOnHand, 0) + ISNULL(i.QtyOnHold, 0)) * ISNULL(i.AverageCost, 0) AS decimal(18, 6)) AS OnHandHoldAmount
      FROM [${database}].[dbo].[IN_ITEM] i
      LEFT JOIN [${database}].[dbo].[IN_PRODTYPE] pt
        ON pt.ProdTypeCode = i.ProdTypeCode
      WHERE RTRIM(i.LocCode) = '${scope.location}'
        -- RPTIN1000015 Suppress Zero Balance = No includes inactive zero rows (status 2).
        AND RTRIM(i.Status) IN ('1', '2')
        ${inventoryValuationItemTypeFilter('i')}
        AND RTRIM(ISNULL(i.ProdTypeCode, '')) <> 'DC'
        ${whereSearch}
  `
}

export function buildMonthlyStockAccountMovementCte(scope: MonthlyStockMovementScope, database: string) {
  const categoryFilter = ''
  const whereSearch = monthlyTextSearch(scope.search, ['i.ItemCode', 'i.Description', 'i.ProdTypeCode', "ISNULL(pt.Description, '')"])

  // Snapshot mode: gunakan IN_MTHENDITEM sebagai sumber QtyOnHand/AverageCost.
  // Non-snapshot mode (periode berjalan): gunakan IN_ITEM live.
  // Official PDF analysis group = Product Type Code — no StockAnalysisCode filter.
  const baseCte = scope.snapshotMode
    ? buildSnapshotBaseCte(database, scope, categoryFilter, whereSearch)
    : buildLiveBaseCte(database, scope, categoryFilter, whereSearch)

  return `
    WITH base AS (
      ${baseCte}
    ),
    movements AS (
      SELECT
        RTRIM(mth_open.ItemCode) AS ItemCode,
        mth_open.Qty AS opening_qty,
        CAST(ISNULL(mth_open.Amount, ISNULL(mth_open.Qty, 0) * ISNULL(mth_open.AverageCost, 0)) AS decimal(18, 6)) AS opening_amt,
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
      FROM [${database}].[dbo].[IN_MTHENDITEM] mth_open
      WHERE RTRIM(mth_open.LocCode) = '${scope.location}'
        AND RTRIM(CONVERT(varchar(10), mth_open.AccYear)) = '${scope.openingAccYear}'
        AND RTRIM(CONVERT(varchar(10), mth_open.AccMonth)) = '${scope.openingAccMonth}'
        AND EXISTS (
          SELECT 1 FROM [${database}].[dbo].[IN_ITEM] i
          WHERE i.ItemCode = mth_open.ItemCode
            AND i.LocCode = mth_open.LocCode
            AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') IN ('1', '4')
        )

      UNION ALL

      SELECT
        RTRIM(l.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 THEN ISNULL(l.Qty, 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 THEN COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0 THEN ISNULL(l.Qty, 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0 THEN COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0 THEN ISNULL(l.Qty, 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0 THEN COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) ELSE 0 END,
        0, 0, 0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[IN_STOCKISSUE] h
      JOIN [${database}].[dbo].[IN_STOCKISSUELN] l
        ON h.StockIssueID = l.StockIssueID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = l.ItemCode
        AND issueItem.LocCode = h.LocCode
      WHERE RTRIM(h.LocCode) = '${scope.location}'
        ${accountingPeriodFilter('h', scope.accYear, scope.accMonth)}
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        AND (
          issueItem.ItemCode IS NULL
          OR ISNULL(RTRIM(CONVERT(varchar(10), issueItem.ItemType)), '') <> '4'
        )
        ${transactionAsOfFilter('h', scope.transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(l.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 THEN ISNULL(l.Qty, 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.BlkCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 THEN COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0 THEN ISNULL(l.Qty, 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(l.BlkCode, ''))) > 0 THEN COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0 THEN ISNULL(l.Qty, 0) ELSE 0 END,
        CASE WHEN LEN(RTRIM(ISNULL(l.VehCode, ''))) > 0 THEN COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) ELSE 0 END,
        0, 0, 0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[IN_FUELISSUE] h
      JOIN [${database}].[dbo].[IN_FUELISSUELN] l
        ON h.FuelIssueID = l.FuelIssueID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = l.ItemCode
        AND issueItem.LocCode = h.LocCode
      WHERE RTRIM(h.LocCode) = '${scope.location}'
        ${fuelIssueFiscalPeriodFilter('h', scope.accYear, scope.accMonth)}
        ${fuelIssueStatusFilter('h')}
        AND (
          issueItem.ItemCode IS NULL
          OR ISNULL(RTRIM(CONVERT(varchar(10), issueItem.ItemType)), '') <> '4'
        )
        ${transactionAsOfFilter('h', scope.transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(s.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1' AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) = 0 THEN ISNULL(s.Qty, 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1' AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) = 0 THEN COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1' AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) > 0 THEN ISNULL(s.Qty, 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1' AND LEN(RTRIM(ISNULL(j.VehCode, ''))) = 0 AND LEN(RTRIM(ISNULL(j.BlkCode, ''))) > 0 THEN COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1' AND LEN(RTRIM(ISNULL(j.VehCode, ''))) > 0 THEN ISNULL(s.Qty, 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '1' AND LEN(RTRIM(ISNULL(j.VehCode, ''))) > 0 THEN COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '2' THEN ISNULL(s.Qty, 0) ELSE 0 END,
        CASE WHEN RTRIM(ISNULL(s.TransType, '')) = '2' THEN COALESCE(s.Amount, s.PriceAmount, ISNULL(s.Qty, 0) * ISNULL(s.Price, 0), 0) ELSE 0 END,
        0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[WS_JOBSTOCK] s
      LEFT JOIN [${database}].[dbo].[WS_JOB] j
        ON s.JobID = j.JobID
      LEFT JOIN [${database}].[dbo].[IN_ITEM] issueItem
        ON issueItem.ItemCode = s.ItemCode
        AND issueItem.LocCode = s.LocCode
      WHERE RTRIM(s.LocCode) = '${scope.location}'
        ${accountingPeriodFilter('s', scope.accYear, scope.accMonth)}
        AND ${workshopStockIssueItemTypeExpression('issueItem', 's')} = '4'
        ${transactionAsOfFilter('s', scope.transactionAsOf)}

      UNION ALL

      -- Inventory module RECEIVE (IN_STOCKRECEIVE) — bukan purchasing GR
      SELECT
        RTRIM(l.ItemCode),
        0, 0,
        ISNULL(l.Qty, 0),
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS decimal(18, 6)),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[IN_STOCKRECEIVE] h
      JOIN [${database}].[dbo].[IN_STOCKRECEIVELN] l
        ON h.StockReceiveID = l.StockReceiveID
      WHERE RTRIM(h.LocCode) = '${scope.location}'
        ${accountingPeriodFilter('h', scope.accYear, scope.accMonth)}
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        ${transactionAsOfFilter('h', scope.transactionAsOf)}

      UNION ALL

      -- Inventory module RETURN (IN_STOCKRTN) — return ke gudang dari issue
      SELECT
        RTRIM(l.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ISNULL(l.Qty, 0),
        CAST(COALESCE(NULLIF(l.Amount, 0), ISNULL(l.Qty, 0) * ISNULL(l.Cost, 0), 0) AS decimal(18, 6)),
        0, 0, 0, 0, 0, 0
      FROM [${database}].[dbo].[IN_STOCKRTN] h
      JOIN [${database}].[dbo].[IN_STOCKRTNLN] l
        ON h.StockRtnID = l.StockRtnID
      WHERE RTRIM(h.LocCode) = '${scope.location}'
        ${accountingPeriodFilter('h', scope.accYear, scope.accMonth)}
        AND RTRIM(ISNULL(h.Status, '')) IN ('2', '5', '6')
        ${transactionAsOfFilter('h', scope.transactionAsOf)}

      UNION ALL

      SELECT
        RTRIM(gl.ItemCode),
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ISNULL(gl.StockQty, 0),
        CAST(ISNULL(gl.StockQty, 0) * ISNULL(p.Cost, 0) AS decimal(18, 6)),
        0, 0, 0, 0
      FROM [${database}].[dbo].[PU_GOODSRCV] g
      JOIN [${database}].[dbo].[PU_GOODSRCVLN] gl
        ON g.GoodsRcvID = gl.GoodsRcvID
      LEFT JOIN [${database}].[dbo].[PU_POLN] p
        ON gl.POLnID = p.POLnID
      WHERE RTRIM(g.LocCode) = '${scope.location}'
        ${accountingPeriodFilter('g', scope.accYear, scope.accMonth)}
        -- Posted GR often Status 5; Status=2 only → GoodsReceiveAmount 0
        AND RTRIM(ISNULL(g.Status, '')) IN ('2', '5', '6')
        -- RPTIN1000015 Purchasing-Goods Receive: exclude ProdType 'DC' (direct-charge asset lines)
        AND NOT EXISTS (
          SELECT 1 FROM [${database}].[dbo].[IN_ITEM] dc
          WHERE dc.ItemCode = gl.ItemCode
            AND dc.LocCode = g.LocCode
            AND RTRIM(ISNULL(dc.ProdTypeCode, '')) = 'DC'
        )
        ${transactionAsOfFilter('g', scope.transactionAsOf)}

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
      WHERE RTRIM(gr.LocCode) = '${scope.location}'
        ${accountingPeriodFilter('gr', scope.accYear, scope.accMonth)}
        AND RTRIM(ISNULL(gr.Status, '')) IN ('2', '5', '6')
        ${transactionAsOfFilter('gr', scope.transactionAsOf)}
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
    period_closing AS (
      SELECT
        RTRIM(mth_close.ItemCode) AS ItemCode,
        CAST(ISNULL(mth_close.Qty, 0) AS decimal(18, 6)) AS period_closing_qty,
        CAST(ISNULL(mth_close.Amount, ISNULL(mth_close.Qty, 0) * ISNULL(mth_close.AverageCost, 0)) AS decimal(18, 6)) AS period_closing_amt
      FROM [${database}].[dbo].[IN_MTHENDITEM] mth_close
      WHERE RTRIM(mth_close.LocCode) = '${scope.location}'
        AND RTRIM(CONVERT(varchar(10), mth_close.AccYear)) = '${scope.accYear}'
        AND RTRIM(CONVERT(varchar(10), mth_close.AccMonth)) = '${scope.accMonth}'
        AND EXISTS (
          SELECT 1 FROM [${database}].[dbo].[IN_ITEM] i
          WHERE i.ItemCode = mth_close.ItemCode
            AND i.LocCode = mth_close.LocCode
            AND ISNULL(RTRIM(CONVERT(varchar(10), i.ItemType)), '') IN ('1', '4')
        )
    ),
    final AS (
      SELECT
        b.Location,
        b.ProductTypeCode,
        b.ProductTypeDescription,
        ROW_NUMBER() OVER (PARTITION BY b.ProductTypeCode ORDER BY b.ItemCode) AS RowNo,
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
        CAST(ISNULL(pc.period_closing_qty, 0) AS decimal(18, 6)) AS period_closing_qty,
        CAST(ISNULL(pc.period_closing_amt, 0) AS decimal(18, 6)) AS period_closing_amt,
        CASE WHEN pc.ItemCode IS NULL THEN 0 ELSE 1 END AS has_period_closing
      FROM base b
      LEFT JOIN agg a ON a.ItemCode = b.ItemCode
      LEFT JOIN period_closing pc ON pc.ItemCode = b.ItemCode
    ),
    report_rows AS (
      SELECT
        '${scope.actualPeriod}' AS ActualPeriod,
        CONVERT(date, '${scope.actualPeriodStart}') AS ActualPeriodStart,
        '${scope.accountingPeriod}' AS AccountingPeriod,
        ${scope.accYear} AS AccYear,
        ${scope.accMonth} AS AccMonth,
        '${scope.openingActualPeriod}' AS OpeningActualPeriod,
        '${scope.openingAccountingPeriod}' AS OpeningAccountingPeriod,
        Location,
        ProductTypeCode,
        ProductTypeDescription,
        RowNo AS [No],
        ItemCode,
        Description AS ItemDescription,
        UOM,
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
        CASE WHEN has_period_closing = 1 THEN period_closing_qty
          ELSE opening_qty + received_qty + return_advice_qty + transferred_qty + adjustment_qty
            - (ledger_qty + issued_station_qty + issued_vehicle_qty)
            + return_qty + goods_receive_qty - goods_return_qty - dispatch_adv_qty
        END AS ClosingQty,
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
        CASE WHEN has_period_closing = 1 THEN period_closing_amt
          ELSE opening_amt + received_amt + return_advice_amt + transferred_amt + adjustment_amt
            - (ledger_amt + issued_station_amt + issued_vehicle_amt)
            + return_amt + goods_receive_amt - goods_return_amt - dispatch_adv_amt
        END AS ClosingAmount,
        CASE WHEN has_period_closing = 1 THEN 'IN_MTHENDITEM' ELSE 'reconstructed' END AS ClosingSource
      FROM final
    )`
}

export function monthlyStockMovementDetailSql(cte: string, limit: number) {
  return `
    ${cte}
    SELECT TOP ${normalizeInventoryQueryLimit(limit, { min: 1, max: 20_000, fallback: 500 })} *
    FROM report_rows
    ORDER BY ProductTypeCode, ItemCode
  `
}

export function monthlyStockMovementSummarySql(cte: string) {
  return `
    ${cte}
    SELECT
      Location,
      ActualPeriod,
      AccountingPeriod,
      OpeningActualPeriod,
      OpeningAccountingPeriod,
      COUNT(*) AS TotalItem,
      COUNT(DISTINCT Location) AS TotalGudang,
      COUNT(DISTINCT ProductTypeCode) AS TotalProductType,
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
      CAST(SUM(ClosingQty) AS DECIMAL(18,2)) AS TotalQty,
      CAST(SUM(ClosingAmount) AS DECIMAL(18,2)) AS TotalAmount
    FROM report_rows
    GROUP BY Location, ActualPeriod, AccountingPeriod, OpeningActualPeriod, OpeningAccountingPeriod
  `
}

export function monthlyStockMovementBreakdownSql(cte: string) {
  return `
    ${cte}
    SELECT TOP 25
      'product-type' AS DimensionId,
      ProductTypeCode AS DimensionValue,
      ProductTypeCode AS Label,
      ProductTypeCode,
      ProductTypeDescription,
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
      CAST(SUM(ClosingAmount) AS DECIMAL(18,2)) AS Amount
    FROM report_rows
    GROUP BY ProductTypeCode, ProductTypeDescription
    ORDER BY Amount DESC
  `
}

function columnsFrom(rows: DbRow[]) {
  return rows[0] ? Object.keys(rows[0]) : []
}

function normalizeSummary(row: DbRow | undefined, scope: MonthlyStockMovementScope): DbRow {
  const summary = row ?? {}
  return {
    ...summary,
    Location: summary.Location ?? scope.location,
    ActualPeriod: summary.ActualPeriod ?? scope.actualPeriod,
    AccountingPeriod: summary.AccountingPeriod ?? scope.accountingPeriod,
    OpeningActualPeriod: summary.OpeningActualPeriod ?? scope.openingActualPeriod,
    OpeningAccountingPeriod: summary.OpeningAccountingPeriod ?? scope.openingAccountingPeriod,
    TotalItem: numberValue(summary.TotalItem),
    TotalGudang: numberValue(summary.TotalGudang),
    TotalProductType: numberValue(summary.TotalProductType ?? summary.TotalStockAnalysis),
    TotalQty: numberValue(summary.TotalQty ?? summary.ClosingQty),
    TotalAmount: numberValue(summary.TotalAmount ?? summary.ClosingAmount),
  }
}

function monthlyChartDimensionId(row: DbRow) {
  const explicit = String(row.DimensionId ?? '').trim()
  if (explicit) return explicit

  const label = String(row.MovementCategory ?? row.DimensionValue ?? row.Label ?? '').trim()
  const normalized = normalizeMovementCategoryLabel(label)
  if ((MOVEMENT_CATEGORY_ORDER as readonly string[]).includes(String(normalized))) return 'movement-category'

  return 'product-type'
}

function isMonthlyProductTypeChartRow(row: DbRow) {
  return monthlyChartDimensionId(row) === 'product-type'
}

function isMonthlyMovementCategoryChartRow(row: DbRow) {
  return monthlyChartDimensionId(row) === 'movement-category'
}

function analyticsBreakdowns(chart: DbRow[]) {
  return chart.filter(isMonthlyProductTypeChartRow).map((row) => ({
    DimensionId: 'product-type',
    DimensionValue: String(row.ProductTypeCode ?? row.DimensionValue ?? row.Label ?? ''),
    Label: String(row.ProductTypeDescription ?? row.Label ?? row.ProductTypeCode ?? ''),
    TotalItem: numberValue(row.TotalItem),
    Qty: numberValue(row.Qty ?? row.ClosingQty),
    Amount: numberValue(row.Amount ?? row.ClosingAmount),
  }))
}

function firstPresentNumber(...values: unknown[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue
    const numeric = numberValue(value)
    if (Number.isFinite(numeric)) return numeric
  }
  return 0
}

function monthlySummaryMetric(summary: DbRow, ...keys: string[]) {
  return firstPresentNumber(...keys.map((key) => summary[key]))
}

function monthlyDetailWindow(payload: Pick<MonthlyStockMovementPayload, 'rows' | 'summary' | 'metadata'>): InventoryAnalyticsContract['detailWindow'] {
  const metadata = payload.metadata ?? {}
  const totalRows = firstPresentNumber(metadata.totalRows, payload.summary.TotalItem, payload.rows.length)
  const filteredRows = firstPresentNumber(metadata.filteredRows, totalRows)
  const returnedRows = firstPresentNumber(metadata.returnedRows, payload.rows.length)
  const loadedRows = firstPresentNumber(metadata.loadedRows, payload.rows.length)
  const maxLoadedRows = firstPresentNumber(metadata.maxLoadedRows, Math.max(loadedRows, returnedRows))
  const reachableRows = firstPresentNumber(metadata.reachableRows, Math.min(filteredRows, maxLoadedRows || filteredRows))
  const pageSize = firstPresentNumber(metadata.pageSize, returnedRows, loadedRows, 1) || 1
  const pageCount = firstPresentNumber(metadata.totalPages, Math.ceil((reachableRows || filteredRows || 1) / pageSize), 1)
  const partial = Boolean(metadata.windowed) || returnedRows < filteredRows || reachableRows < filteredRows

  return {
    totalRows,
    filteredRows,
    returnedRows,
    loadedRows,
    maxLoadedRows,
    reachableRows,
    pageCount,
    strategy: partial ? 'window' : 'all',
    partial,
    page: metadata.page === undefined ? undefined : firstPresentNumber(metadata.page),
    pageSize,
    reason: partial
      ? 'Detail table memakai window/pagination; KPI memakai summary full scope dari query report.'
      : 'Semua baris scope aktif tersedia di payload report.',
  }
}

function monthlyProductTypeFilterAction(code: string) {
  return {
    type: 'set-filter' as const,
    semanticDimensionId: 'product-type',
    value: code,
  }
}

function monthlyProductTypeBreakdowns(chart: DbRow[]): InventoryAnalyticsContract['breakdowns'] {
  return chart
    .filter(isMonthlyProductTypeChartRow)
    .map((row, index) => {
    const code = String(row.ProductTypeCode ?? row.DimensionValue ?? row.Label ?? '').trim()
    const label = String(row.ProductTypeDescription ?? row.Label ?? code).trim() || code || `Product type ${index + 1}`
    return {
      id: `product-type-${code || index}`,
      label: code && label !== code ? `${code} - ${label}` : label,
      dimensionId: 'product-type',
      value: firstPresentNumber(row.OnHandHoldAmount, row.Amount, row.ClosingAmount),
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      filterAction: code ? monthlyProductTypeFilterAction(code) : undefined,
      evidence: {
        source: 'chart',
        valuePath: `chart[${index}].Amount`,
        rowCount: 1,
        notes: ['Breakdown full-scope dari query GROUP BY ProductTypeCode (official PDF analysis group).'],
      },
    }
  })
}

function monthlyMovementCategoryBreakdowns(chart: DbRow[]): InventoryAnalyticsContract['breakdowns'] {
  return chart
    .filter(isMonthlyMovementCategoryChartRow)
    .map((row, index) => {
      const category = String(row.MovementCategory ?? row.DimensionValue ?? row.Label ?? '').trim()
      const label = category || `Movement category ${index + 1}`
      return {
        id: `movement-category-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-') || index}`,
        label,
        dimensionId: 'movement-category',
        // Period Closing first — live OnHandHold diverges after month-end for past periods.
        value: firstPresentNumber(row.ClosingAmount, row.Amount, row.OnHandHoldAmount),
        unit: 'IDR',
        format: 'currency',
        scope: 'full-scope',
        filterAction: category
          ? {
              type: 'set-filter' as const,
              semanticDimensionId: 'movement-category',
              field: 'MovementCategory',
              operator: 'equals' as const,
              value: category,
            }
          : undefined,
        evidence: {
          source: 'chart' as const,
          valuePath: `chart.movement-category[${index}].ClosingAmount`,
          rowCount: 1,
          notes: [
            'MovementCategory = distinct issue docs in movementWindow (anchored to Actual period).',
            'Amount = full-scope SUM(ClosingAmount) for that category — same as filtered detail summary.ClosingAmount.',
          ],
        },
      }
    })
}

function monthlyTaxonomyBreakdowns(chart: DbRow[]): InventoryAnalyticsContract['breakdowns'] {
  const fieldByDimension: Record<string, keyof ReportFilterInput | undefined> = {
    'product-type': 'productType',
    'product-category': 'productCategory',
    'product-brand': 'productBrand',
    'product-model': 'productModel',
    'product-material': 'productMaterial',
    'item-type': 'itemType',
  }

  return chart
    .filter((row) => {
      const dimensionId = monthlyChartDimensionId(row)
      return dimensionId !== 'movement-category' && dimensionId !== 'stock-analysis'
    })
    .map((row, index) => {
      const dimensionId = monthlyChartDimensionId(row)
      const value = String(row.DimensionValue ?? row.Label ?? '').trim()
      const name = String(row.DimensionName ?? row.ProductTypeDescription ?? row.Label ?? '').trim()
      const label = value && name && name !== value ? `${value} - ${name}` : name || value || `Group ${index + 1}`
      const field = fieldByDimension[dimensionId]

      return {
        id: `${dimensionId}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-') || index}`,
        label,
        dimensionId,
        value: firstPresentNumber(row.OnHandHoldAmount, row.Amount, row.ClosingAmount),
        unit: 'IDR',
        format: 'currency',
        scope: 'full-scope',
        filterAction: field && value
          ? {
              type: 'set-filter' as const,
              semanticDimensionId: dimensionId,
              field: String(field),
              operator: 'equals' as const,
              value,
            }
          : undefined,
        evidence: {
          source: 'chart' as const,
          valuePath: `chart.${dimensionId}[${index}].Amount`,
          rowCount: 1,
          notes: ['Breakdown taxonomy aktif dari GROUP BY SQL report; bukan StockAnalysisCode kecuali dimensi memang stock-analysis.'],
        },
      }
    })
}

function monthlyFlowBreakdowns(summary: DbRow): InventoryAnalyticsContract['breakdowns'] {
  const flowMetrics = [
    ['monthly-flow-opening', 'Opening saldo', 'OpeningAmount'],
    ['monthly-flow-issued', 'Issued total', 'IssuedTotalAmount'],
    ['monthly-flow-goods-receive', 'Goods receive', 'GoodsReceiveAmount'],
    ['monthly-flow-return', 'Return', 'ReturnAmount'],
    ['monthly-flow-closing', 'Closing hasil hitung', 'ClosingAmount'],
  ] as const

  return flowMetrics.map(([id, label, key]) => ({
    id,
    label,
    dimensionId: 'chart',
    value: monthlySummaryMetric(summary, key),
    unit: 'IDR',
    format: 'currency',
    scope: 'full-scope',
    evidence: {
      source: 'summary',
      valuePath: `summary.${key}`,
      notes: ['Movement step dari rekonstruksi RPTIN1000015, bukan movement category periodik.'],
    },
  }))
}

function monthlyLocationBreakdown(payload: Pick<MonthlyStockMovementPayload, 'summary'>): InventoryAnalyticsContract['breakdowns'][number] {
  const location = String(payload.summary.Location ?? 'PTRJ').trim() || 'PTRJ'
  return {
    id: `location-${location}`,
    label: location,
    dimensionId: 'location',
    value: monthlySummaryMetric(payload.summary, 'OnHandHoldAmount', 'ClosingAmount', 'TotalAmount'),
    unit: 'IDR',
    format: 'currency',
    scope: 'full-scope',
    filterAction: {
      type: 'set-filter',
      semanticDimensionId: 'location',
      value: location,
    },
    evidence: {
      source: 'summary',
      valuePath: 'summary.Location',
      notes: ['Lokasi berasal dari scope SQL report.'],
    },
  }
}

function monthlyTopItemBreakdowns(rowsData: DbRow[]): InventoryAnalyticsContract['breakdowns'] {
  return [...rowsData]
    .filter((row) => String(row.ItemCode ?? '').trim())
    .sort((left, right) =>
      firstPresentNumber(right.OnHandHoldAmount, right.ClosingAmount) - firstPresentNumber(left.OnHandHoldAmount, left.ClosingAmount),
    )
    .slice(0, 5)
    .map((row, index) => {
      const itemCode = String(row.ItemCode ?? '').trim()
      const description = String(row.ItemDescription ?? row.Description ?? '').trim()
      return {
        id: `item-code-${itemCode}`,
        label: description ? `${itemCode} - ${description}` : itemCode,
        dimensionId: 'item-code',
        value: firstPresentNumber(row.OnHandHoldAmount, row.ClosingAmount),
        unit: 'IDR',
        format: 'currency',
        scope: 'returned-window',
        filterAction: {
          type: 'set-column-filter',
          semanticDimensionId: 'item-code',
          field: 'ItemCode',
          operator: 'equals',
          value: itemCode,
        },
        evidence: {
          source: 'rows',
          valuePath: `rows[${index}].OnHandHoldAmount`,
          rowCount: rowsData.length,
          notes: ['Top item dihitung dari detail window aktif, bukan summary full-scope.'],
        },
      }
    })
}

function monthlyMovementCategoryKpis(summary: DbRow, totalRows: number): InventoryAnalyticsContract['kpis'] {
  const categoryKeys = [
    ['Fast Moving', 'FastMovingItem'],
    ['Moving', 'MovingItem'],
    ['Slow Moving', 'SlowMovingItem'],
    ['Dead Stock', 'DeadStockItem'],
  ] as const

  const categoryKpis: InventoryAnalyticsContract['kpis'] = categoryKeys.map(([label, key]) => ({
    id: `monthly-actual-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-item`,
    label: `${label} actual`,
    value: monthlySummaryMetric(summary, key),
    format: 'number',
    scope: 'full-scope',
    filterAction: {
      type: 'set-filter',
      semanticDimensionId: 'movement-category',
      field: 'MovementCategory',
      operator: 'equals',
      value: label,
    },
    evidence: {
      source: 'server-aggregate',
      valuePath: `summary.${key}`,
      totalRows,
      notes: ['Kategori real dari MovementCategory periodik. StockAnalysisCode master tidak dipakai untuk KPI ini.'],
    },
  }))

  return [
    {
      id: 'monthly-actual-movement-activity-count',
      label: 'Actual movement activity',
      value: monthlySummaryMetric(summary, 'TotalMovementActivityCountActual'),
      format: 'number',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.TotalMovementActivityCountActual',
        totalRows,
        notes: ['Jumlah activity pada kolom movement report: received, issue, return, goods receive, transfer/adjustment jika ada. Opening/closing saldo tidak dihitung sebagai movement.'],
      },
    },
    {
      id: 'monthly-actual-issue-document-count',
      label: 'Actual issue document',
      value: monthlySummaryMetric(summary, 'TotalMovementIssueCountActual', 'TotalStockIssueDocumentCountActual'),
      format: 'number',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.TotalMovementIssueCountActual',
        totalRows,
        notes: ['Distinct issue document dalam movementWindow aktif; fallback ke activity count saat issue document tidak tersedia untuk item.'],
      },
    },
    ...categoryKpis,
  ]
}

export function buildMonthlyStockAccountMovementAnalytics(
  payload: Pick<MonthlyStockMovementPayload, 'rows' | 'summary' | 'chart' | 'metadata'>,
): InventoryAnalyticsContract {
  const summary = payload.summary ?? {}
  const totalRows = firstPresentNumber(payload.metadata?.totalRows, summary.TotalItem, payload.rows.length)

  const kpis: InventoryAnalyticsContract['kpis'] = [
    {
      id: 'monthly-stock-onhand-hold-value',
      label: 'Valuasi QtyOnHand+Hold',
      value: monthlySummaryMetric(summary, 'OnHandHoldAmount'),
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.OnHandHoldAmount',
        totalRows,
        notes: ['Formula: (QtyOnHand + QtyOnHold) * AverageCost dari IN_ITEM.'],
      },
    },
    {
      id: 'monthly-stock-closing-value',
      label: 'Closing hasil hitung',
      value: monthlySummaryMetric(summary, 'ClosingAmount', 'TotalAmount'),
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.ClosingAmount',
        totalRows,
        notes: ['Closing = opening + in - issue + return + goods receive - out.'],
      },
    },
    {
      id: 'monthly-stock-total-item',
      label: 'Jumlah item',
      value: monthlySummaryMetric(summary, 'TotalItem'),
      format: 'number',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.TotalItem',
        totalRows,
      },
    },
    {
      id: 'monthly-stock-onhand-hold-qty',
      label: 'Qty OnHand+Hold',
      value: monthlySummaryMetric(summary, 'QtyOnHandHold', 'TotalQty', 'ClosingQty'),
      format: 'quantity',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.QtyOnHandHold',
        totalRows,
      },
    },
    {
      id: 'monthly-stock-issued-value',
      label: 'Issued total',
      value: monthlySummaryMetric(summary, 'IssuedTotalAmount'),
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.IssuedTotalAmount',
        totalRows,
      },
    },
    {
      id: 'monthly-stock-goods-receive-value',
      label: 'Goods receive',
      value: monthlySummaryMetric(summary, 'GoodsReceiveAmount'),
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.GoodsReceiveAmount',
        totalRows,
      },
    },
    {
      id: 'monthly-stock-return-value',
      label: 'Return',
      value: monthlySummaryMetric(summary, 'ReturnAmount'),
      unit: 'IDR',
      format: 'currency',
      scope: 'full-scope',
      evidence: {
        source: 'server-aggregate',
        valuePath: 'summary.ReturnAmount',
        totalRows,
      },
    },
    ...monthlyMovementCategoryKpis(summary, totalRows),
  ]

  return {
    semanticDimensions: ['movement-category', 'product-type', 'product-category', 'location', 'item-code'],
    experienceProfile: {
      id: 'monthly-stock-account-movement-details',
      globalModule: 'procurement',
      submodule: 'inventory',
      capabilities: ['semantic-filters', 'interactive-kpis', 'breakdowns', 'detail-window', 'ai-insight', 'export'],
    },
    kpis,
    breakdowns: [
      ...monthlyMovementCategoryBreakdowns(payload.chart ?? []),
      ...monthlyTaxonomyBreakdowns(payload.chart ?? []),
      ...monthlyProductTypeBreakdowns(payload.chart ?? []),
      monthlyLocationBreakdown(payload),
      ...monthlyTopItemBreakdowns(payload.rows ?? []),
      ...monthlyFlowBreakdowns(summary),
    ],
    detailWindow: monthlyDetailWindow(payload),
  }
}

function nestedAccountingLabel(metadata: DbRow) {
  const actualPeriod = String(metadata.actualPeriod ?? '')
  const actualYear = Number(actualPeriod.slice(0, 4))
  const actualMonth = Number(actualPeriod.slice(5, 7))
  const accYear = Number(metadata.accYear ?? 0)
  const accMonth = Number(metadata.accMonth ?? 0)
  const actualLabel = Number.isFinite(actualYear) && Number.isFinite(actualMonth)
    ? `${MONTH_NAMES[actualMonth - 1] ?? actualPeriod} ${actualYear}`
    : actualPeriod
  return `${accMonth}/${accYear} (${actualLabel})`
}

function buildMetadata(ctx: InventoryQueryContext, scope: MonthlyStockMovementScope, summary: DbRow, chart: DbRow[]) {
  const totalRows = numberValue(summary.TotalItem)
  return {
    source: ctx.source,
    sourceLabel: ctx.sourceLabel,
    sourceServer: ctx.server,
    sourceDatabase: ctx.database,
    publicSourceId: ctx.publicSourceId,
    dataSource: ctx.dataSource,
    period: scope.actualPeriod,
    generatedAt: new Date().toISOString(),
    updatedBy: 'Sistem Otomatis',
    readOnly: true,
    reportReference: MONTHLY_STOCK_MOVEMENT_REPORT_ID,
    actualPeriod: scope.actualPeriod,
    actualPeriodStart: scope.actualPeriodStart,
    accountingPeriod: scope.accountingPeriod,
    accYear: scope.accYear,
    accMonth: scope.accMonth,
    transactionAsOf: scope.transactionAsOf || 'live',
    openingActualPeriod: scope.openingActualPeriod,
    openingAccountingPeriod: scope.openingAccountingPeriod,
    location: scope.location,
    analysisGroup: scope.analysisGroup,
    stockAnalysisScope: '',
    inputMode: scope.inputMode,
    snapshotMode: scope.snapshotMode,
    baseDataSource: scope.snapshotMode ? 'IN_MTHENDITEM period-end snapshot' : 'IN_ITEM current live balance',
    totalRows,
    filteredRows: totalRows,
    tableRowsScope: 'full-scope-summary-with-bounded-detail-window',
    sourceTables: 'IN_ITEM, IN_PRODTYPE, IN_MTHENDITEM, IN_STOCKISSUE, IN_STOCKISSUELN, IN_FUELISSUE, IN_FUELISSUELN, WS_JOBSTOCK, WS_JOB, PU_GOODSRCV, PU_GOODSRCVLN, PU_GOODSRET, PU_GOODSRETLN, PU_POLN',
    periodRule: 'Filter period memakai periode aktual YYYY-MM lalu dikonversi dengan actualToAccountingPeriod.',
    baseDataSourceRule: scope.snapshotMode
      ? 'Base CTE memakai IN_MTHENDITEM snapshot (Qty/Amount period-end) karena periode yang diminta adalah bulan lampau.'
      : 'Base CTE memakai IN_ITEM live karena periode yang diminta adalah bulan berjalan (month-end belum ada).',
    openingRule: 'Opening qty diambil dari IN_MTHENDITEM accounting period sebelumnya; opening amount memakai Amount tersimpan dengan fallback Qty * AverageCost. Transaksi bulan berjalan memakai AccYear/AccMonth hasil konversi periode aktual.',
    transactionAsOfRule: 'Jika dateTo dikirim, transaksi bulan berjalan dibatasi ke COALESCE(UpdateDate, CreateDate) <= dateTo agar hanya dokumen yang sudah posted/update sebelum waktu cetak yang ikut dihitung.',
    closingRule: 'Closing prefer IN_MTHENDITEM AccYear/AccMonth = report period (official). Fallback reconstruct: opening + received + return advice + transferred + adjustment - issued total + return + goods receive - goods return - dispatch advice.',
    issueUsageRule: `Issue non-workshop: IN_STOCKISSUE/LN (Acc period). Fuel BBM: IN_FUELISSUE/LN — ${FUEL_ISSUE_PERIOD_RULE} Workshop ItemType 4: WS_JOBSTOCK TT1 issue / TT2 return.`,
    onHandHoldAmountRule: scope.snapshotMode
      ? 'Valuasi dari IN_MTHENDITEM snapshot: Amount tersimpan, fallback Qty * AverageCost.'
      : 'Valuasi saldo aktif dari IN_ITEM live: (QtyOnHand + QtyOnHold) * AverageCost.',
    goodsReceiveAmountRule: 'Goods receive amount = PU_GOODSRCVLN.StockQty * PU_POLN.Cost.',
    goodsReturnAmountRule: 'Goods return amount = PU_GOODSRETLN.Amount fallback ReturnStockQty * Cost; mengurangi closing.',
    analysisGroupRule: 'Official PDF analysis group = Product Type Code. Stock Analysis Code (DEADS/MEMOV/SLMOV) removed from monthly scope.',
    movementMeasureStatus: MONTHLY_MOVEMENT_DEFINITIONS.map((definition) => ({
      key: definition.key,
      label: definition.label,
      status: definition.status,
      source: definition.source,
    })),
    analyticsBreakdowns: analyticsBreakdowns(chart),
    primaryChart: 'Closing Amount by Product Type',
  }
}

export async function defaultMonthlyStockMovementQueryExecutor(ctx: InventoryQueryContext, sql: string) {
  const result = await executeInventoryReadQuery(ctx, sql)
  if (!result.success) throw new Error(result.error ?? 'SQL Gateway query failed')
  return result.data?.recordset ?? []
}

export async function createMonthlyStockAccountMovementPayload({
  ctx,
  filters,
  search,
  limit,
  now,
  executeQuery = defaultMonthlyStockMovementQueryExecutor,
}: {
  ctx: InventoryQueryContext
  filters?: ReportFilterInput
  search?: string
  limit?: number
  now?: Date
  executeQuery?: MonthlyStockMovementQueryExecutor
}): Promise<MonthlyStockMovementPayload> {
  const scope = resolveMonthlyStockMovementScope({ filters, search, limit, now, source: ctx.source })
  const cte = buildMonthlyStockAccountMovementCte(scope, ctx.database)
  const reportRows = await executeQuery(ctx, monthlyStockMovementDetailSql(cte, scope.limit))
  const summaryRows = await executeQuery(ctx, monthlyStockMovementSummarySql(cte))
  const chartRows = await executeQuery(ctx, monthlyStockMovementBreakdownSql(cte))
  const summary = normalizeSummary(summaryRows[0], scope)

  return {
    title: MONTHLY_STOCK_MOVEMENT_REPORT_TITLE,
    description: 'Rekonstruksi RPTIN1000015 untuk item movement pabrik PTRJ memakai base IN_ITEM, opening month-end, issue, workshop, return, goods receive, dan closing hasil hitung.',
    rows: reportRows,
    columns: columnsFrom(reportRows),
    summary,
    chart: chartRows,
    metadata: buildMetadata(ctx, scope, summary, chartRows),
  }
}

export function emptyMovementTotals(): MonthlyMovementTotals {
  return Object.fromEntries(
    MONTHLY_MOVEMENT_DEFINITIONS.map((definition) => [definition.key, { quantity: 0, amount_idr: 0 }]),
  ) as MonthlyMovementTotals
}

export function movementTotalsFromRow(row: DbRow): MonthlyMovementTotals {
  return Object.fromEntries(
    MONTHLY_MOVEMENT_DEFINITIONS.map((definition) => [
      definition.key,
      {
        quantity: numberValue(row[`${definition.sqlPrefix}Qty`]),
        amount_idr: numberValue(row[`${definition.sqlPrefix}Amount`]),
      },
    ]),
  ) as MonthlyMovementTotals
}

export function columnDefinitions() {
  return MONTHLY_MOVEMENT_DEFINITIONS.map(({ key, label, quantity_unit, amount_currency, status }) => ({
    key,
    label,
    quantity_unit,
    amount_currency,
    status,
  }))
}

export function adaptMonthlyStockMovementNestedResponse(payload: MonthlyStockMovementPayload): MonthlyStockMovementNestedResponse {
  const metadata = payload.metadata
  const items = payload.rows.map((row, index) => {
    const description = String(row.ItemDescription ?? '')
    const unit = String(row.UOM ?? '')
    return {
      product_type_code: String(row.ProductTypeCode ?? ''),
      product_type_name: String(row.ProductTypeDescription ?? ''),
      sequence_in_group: numberValue(row.No ?? row.SeqNo) || index + 1,
      item_code: String(row.ItemCode ?? ''),
      description,
      unit,
      description_as_printed: `${description} (${unit})`,
      movements: movementTotalsFromRow(row),
      source_page: 2,
    }
  })

  return {
    metadata: {
      report_id: MONTHLY_STOCK_MOVEMENT_REPORT_ID,
      report_title: MONTHLY_STOCK_MOVEMENT_REPORT_TITLE,
      company: 'PT. REBINMAS JAYA OIL MILL',
      site_code: 'PTRJ',
      location: metadata.location,
      accounting_period_from: nestedAccountingLabel(metadata),
      accounting_period_to: nestedAccountingLabel(metadata),
      analysis_group: 'Product Type Code',
      stock_analysis_code_filter: '',
      account_code_filter: '',
      number_of_decimals: 2,
      suppress_zero_balance: 'No',
      include_workshop_item: 'Yes - Report Center valuation includes ItemType 1 and 4',
      printed_by: 'Report Center API',
      printed_at: metadata.generatedAt,
      page_count: Math.max(2, Math.ceil(items.length / 20) + 1),
      currency: 'IDR',
      source: metadata.source,
      source_label: metadata.sourceLabel,
      public_source_id: metadata.publicSourceId,
      actual_period: metadata.actualPeriod,
      accounting_period: metadata.accountingPeriod,
      opening_actual_period: metadata.openingActualPeriod,
      opening_accounting_period: metadata.openingAccountingPeriod,
      total_rows: metadata.totalRows,
      totals_source: 'full_scope_summary_and_product_type_queries',
      movement_measure_status: metadata.movementMeasureStatus,
    },
    column_definitions: columnDefinitions(),
    product_types: payload.chart.filter(isMonthlyProductTypeChartRow).map((row) => ({
      code: String(row.ProductTypeCode ?? row.DimensionValue ?? row.Label ?? ''),
      description: String(row.ProductTypeDescription ?? row.Label ?? row.ProductTypeCode ?? ''),
      item_count: numberValue(row.TotalItem),
      reported_total: movementTotalsFromRow(row),
      calculated_total: movementTotalsFromRow(row),
      totals_source: 'full_scope_product_type_query',
    })),
    items,
  }
}
