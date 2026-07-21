import assert from 'node:assert/strict'
import { attachInventoryAnalytics, validateInventoryAnalyticsPayload } from './analytics-contract'
import { getInventoryQueryContext } from './query-gateway'
import {
  adaptMonthlyStockMovementNestedResponse,
  buildMonthlyStockAccountMovementAnalytics,
  buildMonthlyStockAccountMovementCte,
  createMonthlyStockAccountMovementPayload,
  normalizeMonthlyStockAnalysisCodes,
  resolveMonthlyStockMovementScope,
  type MonthlyStockMovementQueryExecutor,
} from './monthly-stock-account-movement'

const scope = resolveMonthlyStockMovementScope({
  filters: {
    period: '2026-07',
    location: 'ptrj',
    category: 'DEADS,MEMOV,INVALID',
    dateTo: '2026-07-16T08:59:29',
  },
  search: "seal'",
  limit: 25,
  now: new Date('2026-07-19T00:00:00Z'),
})

assert.equal(scope.actualPeriod, '2026-07')
assert.equal(scope.accountingPeriod, '2027-04')
assert.equal(scope.openingAccountingPeriod, '2027-03')
assert.equal(scope.openingActualPeriod, '2026-06')
assert.deepEqual(scope.categoryCodes, ['DEADS', 'MEMOV'])
assert.equal(scope.search, "seal''")
assert.equal(scope.limit, 25)
assert.equal(scope.transactionAsOf, '2026-07-16T08:59:29')
// snapshotMode: period 2026-07 vs now 2026-07-19 → same month → live mode (month-end belum ada)
assert.equal(scope.snapshotMode, false, 'current month → live IN_ITEM mode')

const scopePast = resolveMonthlyStockMovementScope({
  filters: { period: '2026-05' },
  now: new Date('2026-07-19T00:00:00Z'),
})
// snapshotMode: period 2026-05 vs now 2026-07 → past → snapshot mode
assert.equal(scopePast.snapshotMode, true, 'past month → IN_MTHENDITEM snapshot mode')
assert.equal(scopePast.accYear, 2027)
assert.equal(scopePast.accMonth, 2)
assert.equal(scopePast.openingAccYear, 2027)
assert.equal(scopePast.openingAccMonth, 1)
assert.deepEqual(normalizeMonthlyStockAnalysisCodes('unknown'), ['DEADS', 'MEMOV', 'SLMOV'])

const cte = buildMonthlyStockAccountMovementCte(scope, 'db_ptrj_mill')
// scope is 2026-07 (same as now 2026-07-19) → live mode → IN_ITEM
assert.match(cte, /\[db_ptrj_mill\]\.\[dbo\]\.\[IN_ITEM\]/)
assert.match(cte, /RTRIM\(i\.StockAnalysisCode\) IN \('DEADS', 'MEMOV'\)/)
assert.match(cte, /RTRIM\(i\.Status\) IN \('1', '2'\)/)
assert.match(cte, /CONVERT\(varchar\(10\), i\.ItemType\)\), ''\) IN \('1', '4'\)/)
assert.doesNotMatch(cte, /CONVERT\(varchar\(10\), i\.ItemType\)\), ''\) = '1'/)
assert.match(cte, /ISNULL\(Amount, ISNULL\(Qty, 0\) \* ISNULL\(AverageCost, 0\)\)/)
assert.match(cte, /CONVERT\(varchar\(10\), h\.AccYear\)\) = '2027'/)
assert.match(cte, /COALESCE\(h\.UpdateDate, h\.CreateDate\) <= CONVERT\(datetime, '2026-07-16T08:59:29', 126\)/)
assert.match(cte, /COALESCE\(s\.UpdateDate, s\.CreateDate\) <= CONVERT\(datetime, '2026-07-16T08:59:29', 126\)/)
assert.match(cte, /COALESCE\(g\.UpdateDate, g\.CreateDate\) <= CONVERT\(datetime, '2026-07-16T08:59:29', 126\)/)
assert.match(cte, /\[db_ptrj_mill\]\.\[dbo\]\.\[PU_GOODSRET\]/)
assert.match(cte, /\[db_ptrj_mill\]\.\[dbo\]\.\[PU_GOODSRETLN\]/)
assert.match(cte, /COALESCE\(gr\.UpdateDate, gr\.CreateDate\) <= CONVERT\(datetime, '2026-07-16T08:59:29', 126\)/)
assert.match(cte, /LIKE N'%seal''%'/)

// Past period → snapshot mode → IN_MTHENDITEM
const cteSnapshot = buildMonthlyStockAccountMovementCte(scopePast, 'db_ptrj_mill')
assert.match(cteSnapshot, /IN_MTHENDITEM/, 'past period uses IN_MTHENDITEM snapshot')
assert.match(cteSnapshot, /AccYear.*=.*'2027'/, 'filters AccYear 2027')
assert.match(cteSnapshot, /AccMonth.*=.*'2'/, 'filters AccMonth 2')
// Opening balance from prev month (Jan 2027)
assert.match(cteSnapshot, /AccYear.*=.*'2027'/, 'opening AccYear 2027') // same '2027'
assert.match(cteSnapshot, /AccMonth.*=.*'1'/, 'opening AccMonth 1 (Jan)')

const ctx = getInventoryQueryContext('pabrik', { SQL_GATEWAY_API_KEY: 'test' })
const calls: string[] = []
const executeQuery: MonthlyStockMovementQueryExecutor = async (_ctx, sql) => {
  calls.push(sql)
  if (sql.includes('SELECT TOP 25 *')) {
    return [
      {
        StockAnalysisCode: 'DEADS',
        StockAnalysisName: 'DEAD STOCK',
        No: 1,
        ItemCode: 'M001',
        ItemDescription: 'Seal kit',
        UOM: 'PCS',
        OpeningQty: 10,
        OpeningAmount: 1000,
        IssuedStationQty: 2,
        IssuedStationAmount: 200,
        OnHandHoldAmount: 900,
        ClosingQty: 8,
        ClosingAmount: 800,
      },
      {
        StockAnalysisCode: 'MEMOV',
        StockAnalysisName: 'MEDIUM MOVING',
        No: 1,
        ItemCode: 'M002',
        ItemDescription: 'Bearing',
        UOM: 'PCS',
        OpeningQty: 4,
        OpeningAmount: 400,
        GoodsReceiveQty: 1,
        GoodsReceiveAmount: 150,
        OnHandHoldAmount: 600,
        ClosingQty: 5,
        ClosingAmount: 550,
      },
    ]
  }

  if (sql.includes("'stock-analysis' AS DimensionId")) {
    return [
      {
        DimensionId: 'stock-analysis',
        DimensionValue: 'DEADS',
        Label: 'DEADS',
        StockAnalysisCode: 'DEADS',
        StockAnalysisName: 'DEAD STOCK',
        TotalItem: 70,
        OpeningQty: 100,
        OpeningAmount: 10000,
        IssuedStationQty: 20,
        IssuedStationAmount: 2000,
        OnHandHoldAmount: 8800,
        ClosingQty: 80,
        ClosingAmount: 8000,
        Qty: 80,
        Amount: 8000,
      },
      {
        DimensionId: 'movement-category',
        DimensionValue: 'Dead Stock',
        Label: 'Dead Stock',
        MovementCategory: 'Dead Stock',
        TotalItem: 10,
        MovementIssueCountActual: 0,
        MovementIssueQtyActual: 0,
        MovementIssueAmountActual: 0,
        OnHandHoldAmount: 1200,
        ClosingQty: 10,
        ClosingAmount: 1000,
        Qty: 10,
        Amount: 1000,
      },
    ]
  }

  if (sql.includes('COUNT(*) AS TotalItem')) {
    return [
      {
        Location: 'PTRJ',
        ActualPeriod: '2026-07',
        AccountingPeriod: '2027-04',
        OpeningActualPeriod: '2026-06',
        OpeningAccountingPeriod: '2027-03',
        TotalItem: 80,
        TotalGudang: 1,
        TotalStockAnalysis: 2,
        QtyOnHandHold: 123,
        OnHandHoldAmount: 888888,
        OpeningAmount: 120000,
        IssuedTotalAmount: 2200,
        ReturnAmount: 25,
        GoodsReceiveAmount: 1500,
        TotalQty: 123,
        TotalAmount: 999999,
        ClosingQty: 123,
        ClosingAmount: 999999,
      },
    ]
  }

  throw new Error('Unexpected SQL shape')
}

async function main() {
  const payload = await createMonthlyStockAccountMovementPayload({
    ctx,
    filters: {
      period: '2026-07',
      location: 'PTRJ',
      category: 'DEADS,MEMOV',
    },
    search: 'seal',
    limit: 25,
    executeQuery,
  })

  assert.equal(calls.length, 3)
  assert.equal(payload.rows.length, 2)
  assert.equal(payload.summary.TotalItem, 80)
  assert.equal(payload.summary.TotalAmount, 999999)
  assert.equal(payload.metadata.totalRows, 80)
  assert.equal(payload.metadata.stockAnalysisScope, 'DEADS, MEMOV')

  const breakdowns = payload.metadata.analyticsBreakdowns as Array<Record<string, unknown>>
  assert.equal(breakdowns[0].DimensionId, 'stock-analysis')
  assert.equal(breakdowns[0].Amount, 8000)

  const analytics = buildMonthlyStockAccountMovementAnalytics(payload)
  assert.deepEqual(analytics.semanticDimensions, ['movement-category', 'stock-analysis', 'product-type', 'product-category', 'location', 'item-code'])
  assert.equal(analytics.kpis.find((kpi) => kpi.id === 'monthly-stock-onhand-hold-value')?.value, 888888)
  assert.equal(analytics.kpis.find((kpi) => kpi.id === 'monthly-stock-issued-value')?.value, 2200)
  assert.equal(analytics.kpis.find((kpi) => kpi.id === 'monthly-actual-dead-stock-item')?.filterAction?.semanticDimensionId, 'movement-category')
  assert.equal(analytics.breakdowns.some((entry) => entry.id === 'monthly-flow-closing'), true)
  assert.equal(analytics.breakdowns.find((entry) => entry.id === 'movement-category-dead-stock')?.filterAction?.semanticDimensionId, 'movement-category')
  assert.equal(analytics.breakdowns.find((entry) => entry.id === 'stock-analysis-DEADS')?.filterAction?.semanticDimensionId, 'stock-analysis')
  assert.equal(analytics.detailWindow?.totalRows, 80)
  assert.equal(analytics.detailWindow?.returnedRows, 2)

  const groupedMovementPayload = {
    ...payload,
    chart: [
      { Label: 'Dead Stock', TotalRows: 4, Amount: 258691.84, Qty: 255424230.86 },
      { Label: 'Stale', TotalRows: 1, Amount: 2070, Qty: 2070 },
    ],
  }
  const groupedMovementAnalytics = buildMonthlyStockAccountMovementAnalytics(groupedMovementPayload)
  assert.equal(groupedMovementAnalytics.breakdowns.find((entry) => entry.id === 'movement-category-dead-stock')?.dimensionId, 'movement-category')
  assert.equal(groupedMovementAnalytics.breakdowns.find((entry) => entry.id === 'movement-category-stale')?.dimensionId, 'movement-category')
  assert.equal(groupedMovementAnalytics.breakdowns.some((entry) => entry.id === 'stock-analysis-Dead Stock'), false)

  const analyticsPayload = attachInventoryAnalytics(payload, analytics)
  assert.equal(validateInventoryAnalyticsPayload(analyticsPayload).valid, true)

  const nested = adaptMonthlyStockMovementNestedResponse(payload)
  assert.equal(nested.metadata.report_id, 'RPTIN1000015')
  assert.equal(nested.metadata.totals_source, 'full_scope_summary_and_stock_analysis_queries')
  assert.equal(nested.column_definitions.some((column) => column.status === 'placeholder_zero'), true)
  assert.equal(nested.items.length, 2)
  assert.equal(nested.items[0].movements.closing.amount_idr, 800)
  assert.equal(nested.stock_analyses.length, 1)
  assert.equal(nested.stock_analyses[0].item_count, 70)
  assert.equal(nested.stock_analyses[0].reported_total.closing.amount_idr, 8000)
  assert.equal(nested.stock_analyses[0].totals_source, 'full_scope_stock_analysis_query')
  assert.equal(adaptMonthlyStockMovementNestedResponse(groupedMovementPayload).stock_analyses.length, 0)

  console.info('monthly stock account movement tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
