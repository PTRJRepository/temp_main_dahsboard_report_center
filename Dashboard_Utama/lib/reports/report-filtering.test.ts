import assert from 'node:assert/strict'
import {
  applyReportFilters,
  filtersFromSearchParams,
  hasActiveReportFilters,
  inferReportSchema,
  parseNaturalFilterLocally,
  validateNaturalLanguageReadOnly,
  validateReadOnlySql,
} from './report-filtering'

const may2026 = new Date('2026-05-18T00:00:00.000Z')

assert.equal(validateReadOnlySql('SELECT TOP 10 * FROM dbo.IN_ITEM').safe, true)
assert.equal(validateReadOnlySql('WITH data AS (SELECT 1 AS x) SELECT x FROM data').safe, true)
assert.equal(validateReadOnlySql('UPDATE dbo.IN_ITEM SET Status = 0').safe, false)
assert.equal(validateReadOnlySql('SELECT * INTO dbo.tmp_item FROM dbo.IN_ITEM').safe, false)
assert.equal(validateNaturalLanguageReadOnly('hapus data fuel usage').safe, false)

const fuelMay = parseNaturalFilterLocally('Tampilkan fuel usage bulan Mei untuk gudang ARA', may2026)
assert.equal(fuelMay.safe, true)
assert.equal(fuelMay.filters.period, '2026-05')
assert.equal(fuelMay.filters.location, 'ara')
assert.equal(fuelMay.filters.category, undefined)
assert.equal(fuelMay.filters.search, undefined)

const blankVehCode = parseNaturalFilterLocally('Tampilkan data yang VehCode kosong', may2026)
assert.equal(blankVehCode.filters.blankField, 'VehCode')

const dieselQty = parseNaturalFilterLocally('Tampilkan hanya diesel dengan qty di atas 50', may2026)
assert.equal(dieselQty.filters.category, 'diesel')
assert.equal(dieselQty.filters.minQty, 50)

const compareVehicle = parseNaturalFilterLocally('Bandingkan total fuel per kendaraan', may2026)
assert.equal(compareVehicle.filters.analysis, 'compare')
assert.equal(compareVehicle.filters.chartDimension, 'Kendaraan')
assert.equal(compareVehicle.filters.category, undefined)

const amountRange = parseNaturalFilterLocally('Amount antara 500 dan 1000 sort Amount desc row 1-2', may2026, [
  'Tanggal',
  'Gudang',
  'Kendaraan',
  'NamaFuel',
  'QtyFuel',
  'Amount',
])
assert.equal(amountRange.filters.columnFilters?.[0].field, 'Amount')
assert.equal(amountRange.filters.columnFilters?.[0].operator, 'between')
assert.equal(amountRange.filters.sortColumn, 'Amount')
assert.equal(amountRange.filters.rowStart, 1)
assert.equal(amountRange.filters.rowEnd, 2)

const aggregateFuel = parseNaturalFilterLocally('Group by kendaraan dan sum qty fuel', may2026, [
  'Tanggal',
  'Gudang',
  'Kendaraan',
  'QtyFuel',
  'Amount',
])
assert.equal(aggregateFuel.filters.groupBy, 'Kendaraan')
assert.equal(aggregateFuel.filters.aggregateField, 'QtyFuel')
assert.equal(aggregateFuel.filters.aggregateFn, 'sum')

const movementCategoryGroup = parseNaturalFilterLocally('group by movement category dan jumlah stock issue', may2026, [
  'MovementCategory',
  'StockIssueMovementCount',
  'JumlahStockIssue',
  'AmountItem',
])
assert.equal(movementCategoryGroup.filters.groupBy, 'MovementCategory')
assert.equal(movementCategoryGroup.filters.aggregateField, 'StockIssueMovementCount')

const statusOt = parseNaturalFilterLocally('Cari absensi yang status OT = yes', may2026, [
  'NamaKaryawan',
  'StatusOT',
  'JamLembur',
])
assert.equal(statusOt.filters.columnFilters?.[0].field, 'StatusOT')
assert.equal(statusOt.filters.columnFilters?.[0].operator, 'equals')
assert.equal(statusOt.filters.columnFilters?.[0].value, 'yes')

const overtime = parseNaturalFilterLocally('Cari karyawan yang lemburnya lebih dari 20 jam', may2026, [
  'NamaKaryawan',
  'JamLembur',
])
assert.equal(overtime.filters.columnFilters?.[0].field, 'JamLembur')
assert.equal(overtime.filters.columnFilters?.[0].operator, 'gt')
assert.equal(overtime.filters.columnFilters?.[0].value, 20)

const payrollRange = parseNaturalFilterLocally('Tampilkan payroll divisi DME dengan total gaji di atas 5 juta', may2026, [
  'NamaKaryawan',
  'Divisi',
  'TotalGaji',
])
assert.equal(payrollRange.filters.columnFilters?.some((filter) => filter.field === 'Divisi' && filter.value === 'DME'), true)
assert.equal(payrollRange.filters.columnFilters?.some((filter) => filter.field === 'TotalGaji' && filter.operator === 'gt' && filter.value === 5000000), true)

const dateRange = parseNaturalFilterLocally('Tampilkan range tanggal 1 sampai 15 Mei 2026', may2026, ['Tanggal', 'Amount'])
assert.equal(dateRange.filters.dateFrom, '2026-05-01')
assert.equal(dateRange.filters.dateTo, '2026-05-15')
assert.notEqual(dateRange.filters.columnFilters?.some((filter) => filter.field === 'Tanggal'), true)

const anomalyAmount = parseNaturalFilterLocally('Cari anomali amount tertinggi', may2026)
assert.equal(anomalyAmount.filters.analysis, 'anomaly')
assert.equal(anomalyAmount.filters.sortMetric, 'amount')
assert.equal(anomalyAmount.filters.top, 10)

const staleStock = parseNaturalFilterLocally('filter stock yang berumur 1 tahun', may2026, [
  'KodeBarang',
  'NamaBarang',
  'HariTidakUpdate',
])
assert.equal(staleStock.filters.stale, 'lebih-1-tahun')

const stockAgingColumns = [
  'RiskLevel',
  'RiskScore',
  'QuantityClosing',
  'NilaiStok',
  'KodeKategori',
  'IssueSummary',
  'Gudang',
  'UmurBulan',
]

const zeroStock = parseNaturalFilterLocally('tampilkan item stok nol', may2026, stockAgingColumns)
assert.equal(zeroStock.filters.stale, 'semua')
assert.equal(zeroStock.filters.columnFilters?.some((filter) => filter.field === 'QuantityClosing' && filter.operator === 'equals' && filter.value === 0), true)

const stockOnHandStale = parseNaturalFilterLocally('tampilkan barang dengan stok ada tapi update lebih dari 1 tahun', may2026, stockAgingColumns)
assert.equal(stockOnHandStale.filters.stale, 'lebih-1-tahun')
assert.equal(stockOnHandStale.filters.columnFilters?.some((filter) => filter.field === 'QuantityClosing' && filter.operator === 'gt' && filter.value === 0), true)

const missingCategory = parseNaturalFilterLocally('cari item tanpa kategori', may2026, stockAgingColumns)
assert.equal(missingCategory.filters.stale, 'semua')
assert.equal(missingCategory.filters.columnFilters?.some((filter) => filter.field === 'KodeKategori' && filter.operator === 'blank'), true)

const watchStock = parseNaturalFilterLocally('tampilkan item perlu dipantau 3-6 bulan', may2026, stockAgingColumns)
assert.equal(watchStock.filters.stale, 'watch')

const topDeadStock = parseNaturalFilterLocally('top 20 item dead stock berdasarkan nilai stok', may2026, stockAgingColumns)
assert.equal(topDeadStock.filters.stale, 'dead-stock')
assert.equal(topDeadStock.filters.top, 20)
assert.equal(topDeadStock.filters.sortColumn, 'NilaiStok')
assert.equal(topDeadStock.filters.groupBy, undefined)

const categoryHighValue = parseNaturalFilterLocally('tampilkan item kategori CA2114 dengan nilai stok di atas 1 juta', may2026, stockAgingColumns)
assert.equal(categoryHighValue.filters.stale, 'semua')
assert.equal(categoryHighValue.filters.columnFilters?.some((filter) => filter.field === 'KodeKategori' && filter.operator === 'contains' && filter.value === 'CA2114'), true)
assert.equal(categoryHighValue.filters.columnFilters?.some((filter) => filter.field === 'NilaiStok' && filter.operator === 'gt' && filter.value === 1000000), true)

const unparsedNaturalQuery = parseNaturalFilterLocally('Tampilkan data yang relevan', may2026)
assert.equal(unparsedNaturalQuery.filters.naturalQuery, 'Tampilkan data yang relevan')
assert.equal(hasActiveReportFilters(unparsedNaturalQuery.filters), false)

const filtered = applyReportFilters(
  {
    rows: [
      { Tanggal: '2026-05-10', Gudang: 'ARA', Kendaraan: 'DT-01', NamaFuel: 'SOLAR', QtyFuel: 40, Amount: 500 },
      { Tanggal: '2026-05-11', Gudang: 'ARA', Kendaraan: '', NamaFuel: 'DIESEL', QtyFuel: 70, Amount: 900 },
      { Tanggal: '2026-04-10', Gudang: 'KCP', Kendaraan: 'DT-02', NamaFuel: 'DIESEL', QtyFuel: 80, Amount: 1200 },
    ],
    columns: ['Tanggal', 'Gudang', 'Kendaraan', 'NamaFuel', 'QtyFuel', 'Amount'],
    summary: {},
    chart: [],
    metadata: {},
  },
  {
    period: '2026-05',
    location: 'ara',
    columnFilters: [
      { field: 'Kendaraan', operator: 'blank' },
      { field: 'QtyFuel', operator: 'gte', value: 50 },
      { field: 'Amount', operator: 'between', value: 500, valueTo: 1000 },
    ],
    sortColumn: 'Amount',
    sortDirection: 'desc',
    resultLimit: 1,
  },
)

assert.equal(filtered.rows.length, 1)
assert.equal(filtered.rows[0].NamaFuel, 'DIESEL')
assert.equal((filtered.summary as Record<string, unknown>).FilteredRows, 1)

const movementCategoryParams = filtersFromSearchParams(new URLSearchParams('movementCategory=Fast+Moving'))
assert.equal(movementCategoryParams.movementCategory, 'Fast Moving')

const movementFiltered = applyReportFilters(
  {
    rows: [
      { KodeBarang: 'A', MovementCategory: 'Fast Moving', StockIssueMovementCount: 8, AmountItem: 1000 },
      { KodeBarang: 'B', MovementCategory: 'Slow Moving', StockIssueMovementCount: 1, AmountItem: 500 },
      { KodeBarang: 'C', MovementCategory: 'Fast Moving', StockIssueMovementCount: 6, AmountItem: 800 },
    ],
    columns: ['KodeBarang', 'MovementCategory', 'StockIssueMovementCount', 'AmountItem'],
    summary: {},
    chart: [],
    metadata: {},
  },
  {
    movementCategory: 'Fast Moving',
  },
)
assert.equal(movementFiltered.rows.length, 2)
assert.equal((movementFiltered.summary as Record<string, unknown>).FilteredRows, 2)
assert.equal((movementFiltered.summary as Record<string, unknown>).TotalStockIssueMovementCount, 14)

const limitedDisplay = applyReportFilters(
  {
    rows: [
      { Gudang: 'ARA', NamaFuel: 'SOLAR', QtyFuel: 40, Amount: 500 },
      { Gudang: 'ARA', NamaFuel: 'DIESEL', QtyFuel: 70, Amount: 900 },
      { Gudang: 'ARA', NamaFuel: 'BIOSOLAR', QtyFuel: 80, Amount: 1200 },
    ],
    columns: ['Gudang', 'NamaFuel', 'QtyFuel', 'Amount'],
    summary: {},
    chart: [],
    metadata: {},
  },
  {
    location: 'ARA',
    sortColumn: 'Amount',
    sortDirection: 'desc',
    resultLimit: 1,
  },
)
assert.equal(limitedDisplay.rows.length, 1)
assert.equal(limitedDisplay.rows[0].NamaFuel, 'BIOSOLAR')
assert.equal((limitedDisplay.summary as Record<string, unknown>).FilteredRows, 3)
assert.equal((limitedDisplay.summary as Record<string, unknown>).TotalAmount, 2600)
assert.equal((limitedDisplay.metadata as Record<string, unknown>).filteredRows, 3)
assert.equal((limitedDisplay.metadata as Record<string, unknown>).displayRows, 1)

const schema = inferReportSchema(filtered)
assert.equal(schema.columns.find((column) => column.field === 'Tanggal')?.type, 'date')
assert.equal(schema.columns.find((column) => column.field === 'QtyFuel')?.aggregatable, true)

const invalidColumnFiltered = applyReportFilters(
  {
    rows: [
      { Tanggal: '2026-05-10', Gudang: 'ARA', Kendaraan: 'DT-01', QtyFuel: 40, Amount: 500 },
      { Tanggal: '2026-05-11', Gudang: 'ARA', Kendaraan: 'DT-01', QtyFuel: 50, Amount: 600 },
    ],
    columns: ['Tanggal', 'Gudang', 'Kendaraan', 'QtyFuel', 'Amount'],
    summary: {},
    chart: [],
    metadata: {},
  },
  {
    columnFilters: [{ field: 'TidakAda', operator: 'equals', value: 'x' }],
  },
)
assert.equal(invalidColumnFiltered.rows.length, 2)
const invalidMetadata = invalidColumnFiltered.metadata as Record<string, unknown>
assert.equal(((invalidMetadata.rejectedColumnFilters as unknown[]) ?? []).length, 1)

const aggregated = applyReportFilters(
  {
    rows: [
      { Tanggal: '2026-05-10', Gudang: 'ARA', Kendaraan: 'DT-01', QtyFuel: 40, Amount: 500 },
      { Tanggal: '2026-05-11', Gudang: 'ARA', Kendaraan: 'DT-01', QtyFuel: 50, Amount: 600 },
      { Tanggal: '2026-05-12', Gudang: 'KCP', Kendaraan: 'DT-02', QtyFuel: 20, Amount: 300 },
    ],
    columns: ['Tanggal', 'Gudang', 'Kendaraan', 'QtyFuel', 'Amount'],
    summary: {},
    chart: [],
    metadata: {},
  },
  {
    groupBy: 'Kendaraan',
    aggregateField: 'QtyFuel',
    aggregateFn: 'sum',
  },
)
const aggregatedChart = aggregated.chart as Record<string, unknown>[] | undefined
const dt01 = aggregatedChart?.find((row) => row.Label === 'DT-01')
assert.equal(dt01?.Aggregate, 90)
assert.equal(dt01?.AggregateField, 'QtyFuel')

const counted = applyReportFilters(
  {
    rows: [
      { Divisi: 'DME', Nama: 'A', TotalGaji: 100 },
      { Divisi: 'DME', Nama: 'B', TotalGaji: 200 },
      { Divisi: 'KCP', Nama: 'C', TotalGaji: 300 },
    ],
    columns: ['Divisi', 'Nama', 'TotalGaji'],
    summary: {},
    chart: [],
    metadata: {},
  },
  {
    groupBy: 'Divisi',
    aggregateFn: 'count',
  },
)
const countedChart = counted.chart as Record<string, unknown>[] | undefined
const dme = countedChart?.find((row) => row.Label === 'DME')
assert.equal(dme?.Aggregate, 2)
assert.equal(dme?.AggregateFn, 'count')

console.info('report-filtering guardrail tests passed')
