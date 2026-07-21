import type { ProfileBuilders, ReportViewerProfile } from './types'
import {
  ASSET_VALUATION_REPORT_IDS,
  MONTHLY_CONTEXT_DETAIL_COLUMNS,
  MONTHLY_OFFICIAL_DETAIL_COLUMNS,
  MONTHLY_STOCK_MOVEMENT_REPORT_IDS,
  MOVEMENT_ANALYSIS_REPORT_IDS,
  STOCK_AGING_REPORT_IDS,
  assetValuationBusinessColumns,
  assetValuationTechnicalColumns,
  genericTechnicalColumns,
  movementAnalysisBusinessColumns,
  movementAnalysisTechnicalColumns,
  stockAgingBusinessColumns,
  stockAgingKpiPresetByLabel,
  stockAgingManualFilterColumns,
  stockAgingPresets,
  stockAgingTechnicalColumns,
  stockAgingVisibleColumns,
} from './constants'

export function getReportViewerProfile(reportId: string, builders: ProfileBuilders): ReportViewerProfile {
  const {
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
    monthlyStockMovementKpis,
    toNumber,
  } = builders
  const baseProfile: ReportViewerProfile = {
    presets: [],
    preferredGroupColumns: ['Gudang', 'Location', 'SupplierName', 'SupplierCode', 'Kendaraan', 'KodeBarang', 'ItemCode', 'item_code'],
    technicalColumns: genericTechnicalColumns,
    naturalPlaceholder: 'Contoh: Amount 1000 sampai 5000, sort Gudang desc, row 50-100',
    presetTitle: 'Quick Preset',
    // Always show month/year control on inventory detail pages.
    showAccountingPeriodFilter: true,
    rowDetail: 'generic',
    topRowsTitle: 'Priority Rows',
    kpiBuilder: genericKpis,
    qualityBuilder: genericQualityItems,
    topRowsBuilder: genericTopRows,
    defaultSort: (columns) => {
      const preferred = ['RiskScore', 'TotalAmount', 'total_amount', 'NilaiStok', 'Amount', 'amount'].find((column) => columns.includes(column))
      return preferred ? { column: preferred, direction: 'desc' as const } : null
    },
  }

  if (MOVEMENT_ANALYSIS_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: MOVEMENT_ANALYSIS_REPORT_IDS,
      businessColumns: movementAnalysisBusinessColumns,
      fallbackColumns: movementAnalysisBusinessColumns,
      technicalColumns: movementAnalysisTechnicalColumns,
      manualFilterColumns: movementAnalysisBusinessColumns,
      preferredGroupColumns: ['MovementCategory', 'Gudang', 'KodeKategori', 'KodeBarang', ...baseProfile.preferredGroupColumns],
      kpiPresetByLabel: {
        'Fast Moving': 'Fast Moving',
        Moving: 'Moving',
        'Slow Moving': 'Slow Moving',
        'Dead Stock': 'Dead Stock',
        Stale: 'Stale',
      },
      presets: [
        { label: 'Semua Item', description: 'Reset filter movement', filters: { stale: 'semua', groupBy: undefined, movementCategory: undefined } },
        { label: 'Group Movement Category', description: 'Kategorikan tabel by MovementCategory', filters: { stale: 'semua', groupBy: 'MovementCategory' } },
        { label: 'MC All Period', description: 'Hitung movement category all-period', filters: { stale: 'semua', movementWindow: 'all', groupBy: 'MovementCategory' } },
        { label: 'MC 3 Bulan', description: 'Hitung movement category 3 bulan terakhir', filters: { stale: 'semua', movementWindow: '3m', groupBy: 'MovementCategory' } },
        { label: 'MC 6 Bulan', description: 'Hitung movement category 6 bulan terakhir', filters: { stale: 'semua', movementWindow: '6m', groupBy: 'MovementCategory' } },
        { label: 'Tanpa Group Movement', description: 'Matikan group MovementCategory', filters: { stale: 'semua', groupBy: undefined } },
        { label: 'Fast Moving', description: 'StockIssue >= 6 event', filters: { stale: 'semua', movementCategory: 'Fast Moving' } },
        { label: 'Moving', description: 'StockIssue 2-5 event', filters: { stale: 'semua', movementCategory: 'Moving' } },
        { label: 'Slow Moving', description: 'StockIssue 1 event', filters: { stale: 'semua', movementCategory: 'Slow Moving' } },
        { label: 'Dead Stock', description: 'Stok ada, 0 movement', filters: { stale: 'semua', movementCategory: 'Dead Stock' } },
        { label: 'Stale', description: 'Stok dan movement 0', filters: { stale: 'semua', movementCategory: 'Stale' } },
        { label: 'Nilai Stok Tinggi', description: 'Prioritas nilai terbesar', filters: { stale: 'semua', sortColumn: 'AmountItem', sortDirection: 'desc', resultLimit: 100 } },
        { label: 'Gudang Tertentu', description: 'Filter per gudang/lokasi', filters: { stale: 'semua', groupBy: 'Gudang' } },
      ],
      maxInitialColumns: 32,
      showAccountingPeriodFilter: true,
      naturalPlaceholder: 'Contoh: group by movement category, fast moving, stock issue event > 5, sort movement event desc',
      presetTitle: 'Quick Preset Movement',
      rowDetail: 'movement',
      topRowsTitle: 'Top Movement Items',
      kpiBuilder: (payload, filters) => movementAnalysisKpis(payload.summary, payload.rows, filters?.groupBy ?? filters?.chartDimension),
      qualityBuilder: movementAnalysisQualityItems,
      topRowsBuilder: movementAnalysisTopItems,
      defaultSort: (columns) => columns.includes('StockIssueMovementCount') ? { column: 'StockIssueMovementCount', direction: 'desc' as const } : baseProfile.defaultSort?.(columns) ?? null,
    }
  }

  if (STOCK_AGING_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: STOCK_AGING_REPORT_IDS,
      businessColumns: stockAgingBusinessColumns,
      fallbackColumns: stockAgingVisibleColumns,
      technicalColumns: stockAgingTechnicalColumns,
      manualFilterColumns: stockAgingManualFilterColumns,
      presets: stockAgingPresets,
      kpiPresetByLabel: stockAgingKpiPresetByLabel,
      preferredGroupColumns: ['MovementCategory', 'AgingBucket', 'RiskLevel', 'Gudang', ...baseProfile.preferredGroupColumns],
      loadAllRows: false,
      showAccountingPeriodFilter: true,
      naturalPlaceholder: 'Contoh: tampilkan item yang lebih dari 1 tahun tidak update dan nilai stok terbesar',
      presetTitle: 'Quick Preset Stock Aging',
      rowDetail: 'movement',
      topRowsTitle: 'Top Critical Items',
      kpiBuilder: (payload) => stockAgingKpis(payload.summary, payload.rows),
      qualityBuilder: stockAgingQualityItems,
      topRowsBuilder: stockAgingTopItems,
      defaultSort: (columns) => columns.includes('RiskScore') ? { column: 'RiskScore', direction: 'desc' as const } : baseProfile.defaultSort?.(columns) ?? null,
    }
  }

  if (ASSET_VALUATION_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: ASSET_VALUATION_REPORT_IDS,
      businessColumns: assetValuationBusinessColumns,
      technicalColumns: assetValuationTechnicalColumns,
      tableContextColumns: ['report_id', 'source_report_title', 'acc_year', 'acc_month', 'accounting_period', 'actual_period', 'period_data_source'],
      preferredGroupColumns: ['product_type_code', 'product_type_description', 'actual_period', 'accounting_period', ...baseProfile.preferredGroupColumns],
      loadAllRows: false,
      showAccountingPeriodFilter: true,
      naturalPlaceholder: 'Contoh: accyear 2027 accmonth 1 group by product type code total amount',
      kpiBuilder: (payload) => assetValuationKpis(payload.summary, payload.metadata, payload.rows),
      defaultSort: (columns) => columns.includes('total_amount')
        ? { column: 'total_amount', direction: 'desc' as const }
        : columns.includes('product_type_code')
          ? { column: 'product_type_code', direction: 'asc' as const }
          : baseProfile.defaultSort?.(columns) ?? null,
    }
  }

  if (MONTHLY_STOCK_MOVEMENT_REPORT_IDS.has(reportId)) {
    return {
      ...baseProfile,
      reportIds: MONTHLY_STOCK_MOVEMENT_REPORT_IDS,
      // GUARDRAIL(RPTIN1000015-official-columns):
      // Keep the visible detail table in official report order:
      // Item/Description, Opening, INVENTORY, ISSUED, PURCHASING, Closing.
      // Taxonomy and actual MovementCategory are context columns after the official flow.
      businessColumns: [...MONTHLY_OFFICIAL_DETAIL_COLUMNS],
      fallbackColumns: [...MONTHLY_CONTEXT_DETAIL_COLUMNS],
      maxInitialColumns: 36,
      tableContextColumns: [
        'reportId',
        'actualPeriod',
        'accountingPeriod',
        'accYear',
        'accMonth',
        'openingActualPeriod',
        'openingAccountingPeriod',
        'location',
      ],
      preferredGroupColumns: ['ProductTypeCode', 'MovementCategory', 'ProductCategoryCode', 'ProductBrandCode', 'ProductModelCode', 'ProductMaterialCode', 'ItemCode', 'KodeBarang', ...baseProfile.preferredGroupColumns],
      loadAllRows: false,
      showAccountingPeriodFilter: true,
      naturalPlaceholder: 'Contoh: period 2026-07, group ProductTypeCode',
      presetTitle: 'Quick Preset Monthly Movement',
      presets: [
        { label: 'Bulan Berjalan', description: 'Reset ke periode current', filters: { period: undefined, accYear: undefined, accMonth: undefined, stockAnalysis: undefined, category: undefined, groupBy: 'ProductTypeCode' } },
        { label: 'Group Product Type', description: 'Official PDF analysis group', filters: { groupBy: 'ProductTypeCode', chartDimension: 'ProductTypeCode' } },
        { label: 'Group Movement Actual', description: 'Group item by MovementCategory aktual periodik', filters: { groupBy: 'MovementCategory', chartDimension: 'MovementCategory', movementWindow: 'all' } },
        { label: 'Match JSON Product Type', description: 'ProductTypeCode + Include Workshop Item: No seperti PDF resmi', filters: { period: '2026-07', location: 'PTRJ', itemType: 'gudang', includeWorkshopItem: 'no', groupBy: 'ProductTypeCode', chartDimension: 'ProductTypeCode' } },
        { label: 'Group Product Brand', description: 'Group item by IN_ITEM.ProdBrandCode', filters: { groupBy: 'ProductBrandCode', chartDimension: 'ProductBrandCode' } },
        { label: 'Group Product Model', description: 'Group item by IN_ITEM.ProdModelCode', filters: { groupBy: 'ProductModelCode', chartDimension: 'ProductModelCode' } },
        { label: 'Group Product Material', description: 'Group item by IN_ITEM.ProdMatCode', filters: { groupBy: 'ProductMaterialCode', chartDimension: 'ProductMaterialCode' } },
      ],
      rowDetail: 'movement',
      topRowsTitle: 'Top Monthly Movement',
      kpiBuilder: (payload, filters) => monthlyStockMovementKpis(
        payload,
        {
          ...filters,
          groupBy: filters?.groupBy === 'StockAnalysisCode' ? 'ProductTypeCode' : (filters?.groupBy ?? filters?.chartDimension ?? 'ProductTypeCode'),
          chartDimension: filters?.chartDimension === 'StockAnalysisCode' ? 'ProductTypeCode' : (filters?.chartDimension ?? filters?.groupBy ?? 'ProductTypeCode'),
          stockAnalysis: undefined,
          category: undefined,
        },
        filters?.groupBy === 'StockAnalysisCode' ? 'ProductTypeCode' : (filters?.groupBy ?? filters?.chartDimension ?? 'ProductTypeCode'),
      ),
      qualityBuilder: (payload, rows) => [
        ['Actual Period', payload?.metadata?.actualPeriod ?? payload?.summary?.ActualPeriod],
        ['Accounting Period', payload?.metadata?.accountingPeriod ?? payload?.summary?.AccountingPeriod],
        ['Opening Period', payload?.metadata?.openingActualPeriod ?? payload?.summary?.OpeningActualPeriod],
        ['Closing Amount', payload?.summary?.ClosingAmount ?? rows.reduce((s, r) => s + toNumber(r.ClosingAmount), 0)],
        ['Issued Amount', payload?.summary?.IssuedTotalAmount ?? rows.reduce((s, r) => s + toNumber(r.IssuedTotalAmount), 0)],
        ['Items', payload?.summary?.TotalItem ?? rows.length],
      ],
      topRowsBuilder: (rows) => [...rows].sort((a, b) => toNumber(b.ClosingAmount) - toNumber(a.ClosingAmount)).slice(0, 10),
    }
  }

  return baseProfile
}


