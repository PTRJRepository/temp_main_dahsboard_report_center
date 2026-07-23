export type InventoryColumnGlossaryEntry = {
  field: string
  label: string
  description: string
  formula?: string
  source?: string
}

const entries: InventoryColumnGlossaryEntry[] = [
  {
    field: 'ItemCode',
    label: 'Item Code',
    description: 'Kode unik barang di master inventory.',
    source: 'IN_ITEM.ItemCode',
  },
  {
    field: 'item_code',
    label: 'Item Code',
    description: 'Kode unik barang di master inventory.',
    source: 'IN_ITEM.ItemCode',
  },
  {
    field: 'KodeBarang',
    label: 'Kode Barang',
    description: 'Alias ItemCode untuk tampilan report kebun/pabrik.',
    source: 'IN_ITEM.ItemCode',
  },
  {
    field: 'Description',
    label: 'Description',
    description: 'Nama/deskripsi barang (ASMA) dari master item.',
    source: 'IN_ITEM.Description',
  },
  {
    field: 'ItemDescription',
    label: 'Item Description',
    description: 'Nama barang yang dipakai cetak/report.',
    source: 'IN_ITEM.Description',
  },
  {
    field: 'NamaBarang',
    label: 'Nama Barang',
    description: 'Nama barang dari master item.',
    source: 'IN_ITEM.Description',
  },
  {
    field: 'description_as_printed',
    label: 'Description As Printed',
    description: 'Format cetak: nama barang + satuan.',
    formula: 'Description + " (" + UOM + ")"',
  },
  {
    field: 'UOM',
    label: 'UOM',
    description: 'Satuan stok barang.',
    source: 'IN_ITEM.UOMCode',
  },
  {
    field: 'QtyOnHand',
    label: 'Qty On Hand',
    description: 'Qty stok tersedia saat ini di gudang.',
    source: 'IN_ITEM.QtyOnHand',
  },
  {
    field: 'quantity_on_hand',
    label: 'Quantity On Hand',
    description: 'Qty stok tersedia. Untuk periode historis diambil dari month-end.',
    source: 'IN_ITEM.QtyOnHand atau IN_MTHENDITEM.Qty',
  },
  {
    field: 'QtyOnHold',
    label: 'Qty On Hold',
    description: 'Qty ditahan/tidak free issue.',
    source: 'IN_ITEM.QtyOnHold',
  },
  {
    field: 'quantity_on_hold',
    label: 'Quantity On Hold',
    description: 'Qty ditahan. Period historis biasanya 0 di snapshot month-end.',
    source: 'IN_ITEM.QtyOnHold',
  },
  {
    field: 'QtyOnHandHold',
    label: 'Real-Time Qty',
    description: 'Total qty aktif real-time.',
    formula: 'QtyOnHand + QtyOnHold',
  },
  {
    field: 'total_quantity',
    label: 'Total Quantity',
    description: 'Total qty valuasi item.',
    formula: 'quantity_on_hand + quantity_on_hold',
  },
  {
    field: 'QuantityClosing',
    label: 'Quantity Closing',
    description: 'Qty penutup/posisi stok report summary.',
    formula: 'QtyOnHand + QtyOnHold + QtyOnOrder',
    source: 'IN_ITEM',
  },
  {
    field: 'StokAkhir',
    label: 'Stok Akhir',
    description: 'Alias QuantityClosing.',
    formula: 'QtyOnHand + QtyOnHold + QtyOnOrder',
  },
  {
    field: 'AverageCost',
    label: 'Average Cost',
    description: 'Harga rata-rata per unit untuk valuasi stok.',
    source: 'IN_ITEM.AverageCost',
  },
  {
    field: 'unit_cost',
    label: 'Unit Cost',
    description: 'Biaya per unit. Period historis dari month-end, current dari AverageCost.',
    source: 'IN_ITEM.AverageCost / IN_MTHENDITEM',
  },
  {
    field: 'differential_unit_cost',
    label: 'Differential Unit Cost',
    description: 'Selisih unit cost (DiffAverageCost). Snapshot month-end biasanya 0.',
    source: 'IN_ITEM.DiffAverageCost',
  },
  {
    field: 'NilaiStok',
    label: 'Nilai Stok',
    description: 'Valuasi aset stok (bukan jumlah transaksi movement). Diambil dari saldo barang x unit cost.',
    formula: 'QuantityClosing * AverageCost',
    source: 'IN_ITEM / IN_MTHENDITEM asset balance',
  },
  {
    field: 'total_amount',
    label: 'Total Amount',
    description: 'Total valuasi aset item. Bukan sum amount movement/issue.',
    formula: 'total_quantity * unit_cost',
    source: 'asset stock valuation listing / IN_ITEM atau IN_MTHENDITEM',
  },
  {
    field: 'AmountCurrent',
    label: 'Amount Current',
    description: 'Valuasi stok current dari saldo master item, bukan rekap movement.',
    formula: 'QuantityClosing * AverageCost',
    source: 'IN_ITEM asset balance',
  },
  {
    field: 'AmountItem',
    label: 'Asset Amount Real Time',
    description: 'Nilai aset item real-time untuk ranking. Sumber saldo stok, bukan total transaksi movement.',
    formula: 'qty aktif * AverageCost',
    source: 'IN_ITEM asset balance',
  },
  {
    field: 'OnHandHoldAmount',
    label: 'On Hand Hold Amount',
    description: 'Valuasi aset qty on hand + on hold. Bukan sum movement amount.',
    formula: '(QtyOnHand + QtyOnHold) * AverageCost',
    source: 'IN_ITEM asset balance',
  },
  {
    field: 'MovementCategory',
    label: 'Movement Category',
    description:
      'Klasifikasi frekuensi issue aktual di movementWindow (ditambatkan ke Actual period). Bukan StockAnalysisCode master. Bukan dasar total valuasi global — nilai bucket = ClosingAmount item di kategori itu.',
    formula:
      'issue doc count: >=6 Fast Moving; 2-5 Moving; 1 Slow Moving; 0 + ClosingQty>0 Dead Stock; 0 + ClosingQty=0 Stale. Scope = movementWindow.',
    source: 'IN_STOCKISSUE / IN_FUELISSUE / WS_JOBSTOCK + Closing qty period',
  },
  {
    field: 'Stale',
    label: 'Stale',
    description:
      'Barang tanpa issue document valid di window movement, dan ClosingQty period = 0. Artinya: tidak ada pemakaian tercatat + tidak ada sisa stok di periode itu. Bukan “barang usang di gudang” (itu Dead Stock: issue 0 tapi masih ada stok). Sering item kosong / non-aktif / sudah habis.',
    formula: 'MovementIssueCountActual = 0 AND ClosingQty = 0',
    source: 'MovementCategory classifier',
  },
  {
    field: 'DeadStock',
    label: 'Dead Stock',
    description:
      'Barang tanpa issue document valid di window movement, tapi ClosingQty period > 0. Artinya: stok masih ada di periode, tapi tidak terpakai/terbit. Risiko idle stock.',
    formula: 'MovementIssueCountActual = 0 AND ClosingQty > 0',
    source: 'MovementCategory classifier',
  },
  {
    field: 'MovementActivityCountActual',
    label: 'Movement Activity Count',
    description: 'Jumlah jenis aktivitas movement non-zero pada baris monthly stock account movement. Opening/closing saldo tidak dihitung.',
    formula: 'count(non-zero issue/receive/return/transfer/adjustment/dispatch buckets)',
    source: 'RPTIN1000015 reconstructed movement columns',
  },
  {
    field: 'MovementActivityQtyActual',
    label: 'Movement Activity Qty',
    description: 'Total absolut qty movement aktual pada baris report. Opening/closing saldo tidak dihitung.',
    formula: 'sum(abs(non-opening movement qty buckets))',
    source: 'RPTIN1000015 reconstructed movement columns',
  },
  {
    field: 'MovementActivityAmountActual',
    label: 'Movement Activity Amount',
    description: 'Total absolut amount movement aktual pada baris report. Opening/closing saldo tidak dihitung.',
    formula: 'sum(abs(non-opening movement amount buckets))',
    source: 'RPTIN1000015 reconstructed movement columns',
  },
  {
    field: 'MovementAnalysis',
    label: 'StockIssue Movement Analysis',
    description: 'Penjelasan teks dari Movement Category + ambang issue count.',
  },
  {
    field: 'StaleMovementRelation',
    label: 'Movement Analysis',
    description: 'Relasi stale vs movement valid terakhir.',
  },
  {
    field: 'StockIssueEventCount',
    label: 'Stock Issue Event Count',
    description: 'Jumlah dokumen issue valid (distinct StockIssueID / JobStock issue) di window movement.',
    source: 'IN_STOCKISSUE / WS_JOBSTOCK',
  },
  {
    field: 'StockIssueMovementCount',
    label: 'StockIssue Movement Count',
    description: 'Alias hitungan event issue untuk klasifikasi movement.',
  },
  {
    field: 'JumlahStockIssue',
    label: 'Jumlah Stock Issue',
    description: 'Alias hitungan event stock issue.',
  },
  {
    field: 'JumlahMovement',
    label: 'Jumlah Movement',
    description: 'Jumlah event movement valid pada window.',
  },
  {
    field: 'MovementEventCountAll',
    label: 'Movement Event All Period',
    description: 'Jumlah event movement pada scope all/window yang dipakai query.',
  },
  {
    field: 'StockIssueQtyAllPeriod',
    label: 'Stock Issue Qty All Period',
    description: 'Total qty keluar via stock issue pada window.',
    formula: 'SUM(issue qty valid)',
  },
  {
    field: 'StockIssueMovementQty',
    label: 'StockIssue Movement Qty',
    description: 'Total qty movement issue pada window.',
  },
  {
    field: 'JumlahQtyStockIssue',
    label: 'Jumlah Qty Stock Issue',
    description: 'Alias total qty stock issue.',
  },
  {
    field: 'MovementQtyAll',
    label: 'Movement Qty All Period',
    description: 'Total qty movement pada scope query.',
  },
  {
    field: 'StockIssueAmountAllPeriod',
    label: 'Stock Issue Amount All Period',
    description: 'Total amount transaksi issue pada window. Ini rekap aktivitas, bukan total valuasi stok barang.',
    formula: 'SUM(issue amount valid)',
  },
  {
    field: 'StockIssueMovementAmount',
    label: 'StockIssue Movement Amount Transaksi',
    description: 'Total amount transaksi issue movement. Jangan dipakai sebagai total valuasi aset.',
  },
  {
    field: 'MovementAmountAll',
    label: 'Movement Amount All Period',
    description: 'Total amount aktivitas movement pada scope query. Beda dari valuasi stok/asset.',
  },
  {
    field: 'MovementGapQty',
    label: 'Movement Gap Qty',
    description: 'Selisih stok penutup vs qty issue window.',
    formula: 'QuantityClosing - StockIssueQty',
  },
  {
    field: 'StockIssueMovementGapQty',
    label: 'StockIssue Movement Gap Qty',
    description: 'Alias Movement Gap Qty berbasis stock issue.',
    formula: 'QuantityClosing - StockIssueMovementQty',
  },
  {
    field: 'LastMovementDate',
    label: 'Last Movement Date',
    description: 'Tanggal movement valid terakhir di window.',
  },
  {
    field: 'LastStockIssueDate',
    label: 'Last Stock Issue Date',
    description: 'Tanggal stock issue valid terakhir.',
  },
  {
    field: 'MovementAgeDays',
    label: 'Movement Age Days',
    description: 'Umur hari sejak last movement sampai hari ini.',
    formula: 'DATEDIFF(day, LastMovementDate, today)',
  },
  {
    field: 'MovementSource',
    label: 'Movement Source',
    description: 'Sumber transaksi movement: stock issue reguler atau workshop jobstock.',
  },
  {
    field: 'OpeningQty',
    label: 'Opening Qty',
    description: 'Saldo awal periode dari month-end sebelumnya.',
    source: 'IN_MTHENDITEM (previous accounting period)',
  },
  {
    field: 'OpeningAmount',
    label: 'Opening Amount',
    description: 'Nilai saldo awal periode.',
    formula: 'OpeningQty * AverageCost (month-end)',
  },
  {
    field: 'ReceivedQty',
    label: 'Received Qty',
    description: 'Qty receive non-purchasing pada periode (jika terisi di pipeline movement).',
  },
  {
    field: 'ReceivedAmount',
    label: 'Received Amount',
    description: 'Nilai receive non-purchasing pada periode.',
  },
  {
    field: 'ReturnAdviceQty',
    label: 'Return Advice Qty',
    description: 'Qty return advice inventory pada periode.',
  },
  {
    field: 'ReturnAdviceAmount',
    label: 'Return Advice Amount',
    description: 'Nilai return advice inventory pada periode.',
  },
  {
    field: 'TransferredQty',
    label: 'Transfered Qty',
    description: 'Qty transfer inventory pada periode. Label mengikuti header resmi RPTIN1000015.',
  },
  {
    field: 'TransferredAmount',
    label: 'Transfered Amount',
    description: 'Nilai transfer inventory pada periode. Label mengikuti header resmi RPTIN1000015.',
  },
  {
    field: 'AdjustmentQty',
    label: 'Adjustment Qty',
    description: 'Qty adjustment inventory pada periode.',
  },
  {
    field: 'AdjustmentAmount',
    label: 'Adjustment Amount',
    description: 'Nilai adjustment inventory pada periode.',
  },
  {
    field: 'IssuedStationQty',
    label: 'Issued Station Qty',
    description: 'Qty issue ke station/blok (BlkCode terisi, VehCode kosong).',
    source: 'IN_STOCKISSUELN / WS_JOBSTOCK',
  },
  {
    field: 'IssuedStationAmount',
    label: 'Issued Station Amount',
    description: 'Nilai issue ke station/blok (BlkCode terisi, VehCode kosong).',
    source: 'IN_STOCKISSUELN / WS_JOBSTOCK',
  },
  {
    field: 'IssuedVehicleQty',
    label: 'Issued Vehicle Qty',
    description: 'Qty issue ke kendaraan (VehCode terisi).',
    source: 'IN_STOCKISSUELN / WS_JOBSTOCK',
  },
  {
    field: 'IssuedVehicleAmount',
    label: 'Issued Vehicle Amount',
    description: 'Nilai issue ke kendaraan (VehCode terisi).',
    source: 'IN_STOCKISSUELN / WS_JOBSTOCK',
  },
  {
    field: 'LedgerQty',
    label: 'Issued Ledger Qty',
    description: 'Qty issue ledger (BlkCode + VehCode kosong).',
  },
  {
    field: 'LedgerAmount',
    label: 'Issued Ledger Amount',
    description: 'Nilai issue ledger (BlkCode + VehCode kosong).',
  },
  {
    field: 'IssuedTotalQty',
    label: 'Issued Total Qty',
    description: 'Total qty issue.',
    formula: 'Ledger + Station + Vehicle',
  },
  {
    field: 'IssuedTotalAmount',
    label: 'Issued Total Amount',
    description: 'Total nilai issue.',
    formula: 'LedgerAmount + IssuedStationAmount + IssuedVehicleAmount',
  },
  {
    field: 'ReturnQty',
    label: 'Return Qty',
    description: 'Qty return workshop/operasional (WS_JOBSTOCK TransType=2).',
  },
  {
    field: 'ReturnAmount',
    label: 'Return Amount',
    description: 'Nilai return workshop/operasional (WS_JOBSTOCK TransType=2).',
  },
  {
    field: 'GoodsReceiveQty',
    label: 'Purchasing Goods Receive Qty',
    description: 'Qty goods receive purchasing pada accounting period.',
    source: 'PU_GOODSRCVLN.StockQty',
  },
  {
    field: 'GoodsReceiveAmount',
    label: 'Purchasing Goods Receive Amount',
    description: 'Nilai goods receive.',
    formula: 'StockQty * PU_POLN.Cost',
  },
  {
    field: 'GoodsReturnQty',
    label: 'Purchasing Goods Return Qty',
    description: 'Qty goods return purchasing pada accounting period.',
  },
  {
    field: 'GoodsReturnAmount',
    label: 'Purchasing Goods Return Amount',
    description: 'Nilai goods return purchasing pada accounting period.',
  },
  {
    field: 'DispatchAdvQty',
    label: 'Purchasing Dispatch Adv Qty',
    description: 'Qty dispatch advice purchasing pada accounting period.',
  },
  {
    field: 'DispatchAdvAmount',
    label: 'Purchasing Dispatch Adv Amount',
    description: 'Nilai dispatch advice purchasing pada accounting period.',
  },
  {
    field: 'ClosingQty',
    label: 'Closing Qty',
    description: 'Saldo akhir dihitung, bukan ambil current master langsung.',
    formula: 'Opening + In - Issued + Return + GR - ReturnGR - Dispatch',
  },
  {
    field: 'ClosingAmount',
    label: 'Closing Amount',
    description: 'Nilai closing hasil rekonsiliasi saldo movement bulanan. Bukan pengganti valuasi listing aset global.',
  },
  {
    field: 'StockAnalysisCode',
    label: 'Stock Analysis Code',
    description: 'Kode analisis stok master (DEADS/MEMOV/SLMOV/dll). Beda dari Movement Category periodik.',
    source: 'IN_ITEM.StockAnalysisCode',
  },
  {
    field: 'stock_analysis_code',
    label: 'Stock Analysis Code',
    description: 'Kode analisis stok master item.',
    source: 'IN_ITEM.StockAnalysisCode',
  },
  {
    field: 'StockAnalysisName',
    label: 'Stock Analysis Name',
    description: 'Nama analisis stok dari master.',
    source: 'IN_STOCKANALYSIS.Description',
  },
  {
    field: 'ProductTypeCode',
    label: 'Product Type Code',
    description: 'Tipe produk master dari IN_ITEM. Dipakai sebagai analysis group pre-open.',
    source: 'IN_ITEM.ProdTypeCode',
  },
  {
    field: 'ProdTypeCode',
    label: 'Product Type Code',
    description: 'Tipe produk master.',
    source: 'IN_ITEM.ProdTypeCode',
  },
  {
    field: 'product_type_code',
    label: 'Product Type Code',
    description: 'Tipe produk master.',
    source: 'IN_ITEM.ProdTypeCode',
  },
  {
    field: 'product_type_description',
    label: 'Product Type Description',
    description: 'Nama tipe produk.',
    source: 'IN_PRODTYPE.Description',
  },
  {
    field: 'ProductCategoryCode',
    label: 'Product Category Code',
    description: 'Kategori produk master dari IN_ITEM.ProdCatCode.',
    source: 'IN_ITEM.ProdCatCode',
  },
  {
    field: 'ProductBrandCode',
    label: 'Product Brand Code',
    description: 'Brand produk master dari IN_ITEM.ProdBrandCode.',
    source: 'IN_ITEM.ProdBrandCode',
  },
  {
    field: 'ProductModelCode',
    label: 'Product Model Code',
    description: 'Model produk master dari IN_ITEM.ProdModelCode.',
    source: 'IN_ITEM.ProdModelCode',
  },
  {
    field: 'ProductMaterialCode',
    label: 'Product Material Code',
    description: 'Material produk master dari IN_ITEM.ProdMatCode.',
    source: 'IN_ITEM.ProdMatCode',
  },
  {
    field: 'KodeKategori',
    label: 'Kode Kategori',
    description: 'Kategori produk/barang.',
    source: 'IN_ITEM.ProdCatCode',
  },
  {
    field: 'Kategori',
    label: 'Kategori',
    description: 'Label kategori barang.',
    source: 'IN_ITEM.ProdCatCode',
  },
  {
    field: 'ItemType',
    label: 'Item Type',
    description: 'Tipe item: 1=Stock, 4=Workshop.',
    source: 'IN_ITEM.ItemType',
  },
  {
    field: 'ItemTypeName',
    label: 'Item Type Name',
    description: 'Label ItemType (Stock/Workshop).',
  },
  {
    field: 'Location',
    label: 'Location',
    description: 'Kode gudang/lokasi stok.',
    source: 'IN_ITEM.LocCode',
  },
  {
    field: 'Gudang',
    label: 'Gudang',
    description: 'Alias lokasi gudang.',
    source: 'IN_ITEM.LocCode / header.LocCode',
  },
  {
    field: 'RiskLevel',
    label: 'Risk Level',
    description: 'Tingkat risiko stok (Critical/High/Medium/Low) dari aging + nilai + quality flag.',
  },
  {
    field: 'RiskScore',
    label: 'Risk Score',
    description: 'Skor numerik prioritas risiko untuk ranking.',
  },
  {
    field: 'AgingBucket',
    label: 'Aging Bucket',
    description: 'Kelompok umur berdasarkan UpdateDate master item (bukan movement window).',
    source: 'IN_ITEM.UpdateDate',
  },
  {
    field: 'UmurBulan',
    label: 'Umur Bulan',
    description: 'Bulan sejak last update master item.',
    formula: 'DATEDIFF(month, UpdateDate, today)',
  },
  {
    field: 'IssueSummary',
    label: 'Issue Summary',
    description: 'Ringkas quality flag: stok nol, tanpa kategori, tanpa issue valid, update tua.',
  },
  {
    field: 'actual_period',
    label: 'Actual Period',
    description: 'Periode kalender aktual YYYY-MM.',
  },
  {
    field: 'accounting_period',
    label: 'Accounting Period',
    description: 'Periode akuntansi fiscal (April=AccMonth 1).',
  },
  {
    field: 'period_data_source',
    label: 'Period Data Source',
    description: 'Sumber data periode: current IN_ITEM atau snapshot IN_MTHENDITEM.',
  },
]

const byField = new Map(entries.map((entry) => [entry.field.toLowerCase(), entry]))

function normalizeField(field: string) {
  return String(field ?? '').trim().toLowerCase()
}

export function getInventoryColumnGlossary(field: string): InventoryColumnGlossaryEntry | undefined {
  return byField.get(normalizeField(field))
}

export function inventoryColumnLabel(field: string, fallback?: string) {
  return getInventoryColumnGlossary(field)?.label ?? fallback ?? field
}

export function inventoryColumnHelpText(field: string) {
  const entry = getInventoryColumnGlossary(field)
  if (!entry) return ''
  const parts = [entry.description]
  if (entry.formula) parts.push(`Formula: ${entry.formula}`)
  if (entry.source) parts.push(`Sumber: ${entry.source}`)
  return parts.join(' | ')
}

export function inventoryColumnTitleAttribute(field: string, fallbackLabel?: string) {
  const entry = getInventoryColumnGlossary(field)
  if (!entry) return fallbackLabel ?? field
  return `${entry.label}: ${inventoryColumnHelpText(field)}`
}

export function listInventoryColumnGlossary() {
  return entries.slice()
}
