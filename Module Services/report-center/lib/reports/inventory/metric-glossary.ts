/**
 * Glosarium metrik inventory kanonik (source of truth istilah di seluruh UI report-center).
 *
 * Tujuan: SEMUA panel/modal/tooltip memakai definisi yang sama, sehingga istilah seperti
 * "Total Issue" tidak pernah beda makna antar komponen. Sinkron dengan
 * `metric-dictionary.md` dan `column-glossary.ts`.
 *
 * Aturan pakai:
 * - Label metrik uang pemakaian SELALU "Total Issue" (bukan "Total Usage"/"Issue Amount").
 * - Label aset stok SELALU "Total Valuasi" — jangan pernah dicampur dengan Total Issue.
 * - Return inventory = informasi terpisah; TIDAK pernah masuk Total Issue / kategori movement.
 */

export type InventoryMetricId =
  | 'total-issue'
  | 'total-valuation'
  | 'movement-category-value'
  | 'movement-issue-count'
  | 'inventory-return'
  | 'purchasing-goods-receive'
  | 'purchasing-goods-return'
  | 'closing-amount'
  | 'opening-amount'
  | 'unused-stock'

export type InventoryMetricEntry = {
  id: InventoryMetricId
  /** Label baku yang tampil di UI. */
  label: string
  /** Alias yang dilarang dipakai di UI baru, tapi masih mungkin muncul di label lama. */
  aka: string[]
  /** Penjelasan 1-2 kalimat untuk tooltip/popup. */
  description: string
  formula: string
  /** Sumber tabel/kolom. */
  source: string
  /** Modul pemilik: inventory / purchasing / derived. */
  module: 'inventory' | 'purchasing' | 'derived'
  /** Daftar metrik yang TIDAK sama dengan metrik ini — untuk mencegah salah tafsir. */
  notEquals: string[]
}

const ISSUE_UNIVERSE =
  'IN_STOCKISSUE (gudang) + IN_FUELISSUE (BBM, filter DocDate) + WS_JOBSTOCK TT=1 (workshop issue)'

export const INVENTORY_METRICS: InventoryMetricEntry[] = [
  {
    id: 'total-issue',
    label: 'Total Issue',
    aka: ['Total Usage', 'Total Movement', 'Issue Amount', 'Pengeluaran', 'Issued Total', 'IssuedTotalAmount'],
    description:
      'Nilai uang (Rp) barang yang KELUAR dipakai pada periode — KANONIK = ledger + station + vehicle, ' +
      'persis rumus monthly report RPTIN. "Total Usage"/"Total Movement"/"Issue Amount"/"Pengeluaran" semua merujuk ke angka yang SAMA ini.',
    formula:
      `${ISSUE_UNIVERSE}; status 2/5/6 (stock) & 2/6 (fuel); return TT=2 / IN_STOCKRTN TIDAK termasuk. ` +
      'ledger/station/vehicle = pemecah per baris by BlkCode/VehCode (ledger=tanpa blok&kendaraan, station=ber-BlkCode, vehicle=ber-VehCode) — BUKAN 3 sumber tabel.',
    source:
      'RPTIN IssuedTotalAmount = LedgerAmount + IssuedStationAmount + IssuedVehicleAmount (stock+fuel+workshop)',
    module: 'inventory',
    notEquals: [
      'Total Valuasi (nilai aset masih di rak)',
      'Inventory Return (barang kembali ke gudang)',
      'Total Issue Movement (jumlah event/dokumen, bukan Rupiah)',
      'Fuel issue (hanya sebagian baris fuel yang ber-VehCode → vehicle; fuel juga tersebar ke ledger/station)',
    ],
  },
  {
    id: 'total-valuation',
    label: 'Total Valuasi',
    aka: ['Valuasi Aset', 'Asset Valuation', 'Nilai Stok'],
    description:
      'Nilai aset stok yang masih ADA di rak (bukan yang sudah dipakai). ' +
      'Patokan "Total" di header Movement mix.',
    formula:
      '(QtyOnHand + QtyOnHold) × AverageCost; periode historis dari snapshot month-end, periode berjalan dari saldo live.',
    source: 'IN_ITEM / IN_MTHENDITEM (asset balance)',
    module: 'inventory',
    notEquals: ['Total Issue (barang sudah keluar)'],
  },
  {
    id: 'movement-category-value',
    label: 'Nilai per Kategori Movement',
    aka: ['Movement mix value', 'Σ kategori'],
    description:
      'Nilai stok (valuasi) barang yang tergolong Fast/Moving/Slow/Dead pada periode itu. ' +
      'Ini nilai ASET barang di kategori tersebut — BUKAN Total Issue periode dan bukan jumlah transaksi issue.',
    formula:
      'Per item: kategori dari frekuensi dokumen issue (default Fast ≥ 6, Moving 2–5, Slow 1, Dead 0 dalam jendela); nilai = valuasi stok item tsb. Σ 4 kategori ≈ Total Valuasi periode.',
    source: 'MovementCategory classifier + IN_ITEM/IN_MTHENDITEM valuation',
    module: 'derived',
    notEquals: ['Total Issue (flow keluar)', 'Total Valuasi global (aset keseluruhan)'],
  },
  {
    id: 'movement-issue-count',
    label: 'Total Issue Movement (event)',
    aka: ['Issue event count', 'Jumlah dokumen issue'],
    description: 'Jumlah DOKUMEN/event issue dalam jendela — hitungan frekuensi, BUKAN Rupiah.',
    formula: `COUNT(DISTINCT dokumen) pada ${ISSUE_UNIVERSE}`,
    source: 'IN_STOCKISSUE / IN_FUELISSUE / WS_JOBSTOCK',
    module: 'derived',
    notEquals: ['Total Issue (Rp)', 'Total Valuasi'],
  },
  {
    id: 'inventory-return',
    label: 'Inventory Return',
    aka: ['Stock Return', 'Return gudang'],
    description:
      'Barang KEMBALI ke gudang dari pemakaian: IN_STOCKRTN + WS_JOBSTOCK TT=2. ' +
      'Bukan retur ke supplier (PU_GOODSRET). Selalu ditampilkan terpisah — tidak mengubah Total Issue maupun kategori movement.',
    formula: 'SUM(amount) IN_STOCKRTN + WS_JOBSTOCK TransType=2',
    source: 'IN_STOCKRTN / WS_JOBSTOCK TT=2',
    module: 'inventory',
    notEquals: ['Purchasing Goods Return (retur supplier)', 'Total Issue'],
  },
  {
    id: 'purchasing-goods-receive',
    label: 'Purchasing Goods Receive',
    aka: ['GR', 'Goods Receive'],
    description: 'Penerimaan barang dari supplier (purchasing). Bukan inventory receive (IN_STOCKRECEIVE).',
    formula: 'StockQty × PU_POLN.Cost; status 2/5/6',
    source: 'PU_GOODSRCVLN × PU_POLN',
    module: 'purchasing',
    notEquals: ['Inventory Received (IN_STOCKRECEIVE)'],
  },
  {
    id: 'purchasing-goods-return',
    label: 'Purchasing Goods Return',
    aka: ['Retur supplier', 'Goods Return'],
    description:
      'Retur barang KE supplier (purchasing). BUKAN return inventory dan tidak dipakai untuk analisis movement.',
    formula: 'SUM(amount) PU_GOODSRET',
    source: 'PU_GOODSRETLN',
    module: 'purchasing',
    notEquals: ['Inventory Return (barang kembali ke gudang)'],
  },
  {
    id: 'closing-amount',
    label: 'Saldo Akhir',
    aka: ['Closing', 'Closing Amount'],
    description: 'Saldo akhir periode hasil rekonsiliasi movement bulanan (return tetap dihitung sesuai rumus resmi).',
    formula: 'Opening + In − Issued + Return + GR − ReturnGR − Dispatch',
    source: 'RPTIN1000015 ClosingAmount',
    module: 'inventory',
    notEquals: ['Total Valuasi listing aset global'],
  },
  {
    id: 'opening-amount',
    label: 'Saldo Awal',
    aka: ['Opening', 'Opening Amount'],
    description: 'Saldo awal periode dari month-end sebelumnya.',
    formula: 'OpeningQty × AverageCost (month-end)',
    source: 'IN_MTHENDITEM (previous accounting period)',
    module: 'inventory',
    notEquals: [],
  },
  {
    id: 'unused-stock',
    label: 'Barang Tidak Terpakai',
    aka: ['Unused stock', 'Barang mengendap', 'Dead stock fisik'],
    description:
      'Item live (Status=1) dengan stok fisik > 0 TAPI tanpa SATU PUN dokumen issue dalam window analisis. ' +
      'Berbeda dari kategori Dead Stock: Dead Stock = frekuensi issue 0 pada jendela movement; unused-stock menekankan stok yang masih mengendap di rak.',
    formula:
      `Stok (QtyOnHand+QtyOnHold) > 0 DAN NOT EXISTS dokumen issue pada ${ISSUE_UNIVERSE} dalam window; valuasi = (QtyOnHand+QtyOnHold) × AverageCost.`,
    source: 'IN_ITEM (live) LEFT ANTI JOIN IN_STOCKISSUE/IN_FUELISSUE/WS_JOBSTOCK TT=1',
    module: 'derived',
    notEquals: ['Total Issue (barang keluar)', 'Dead Stock (kategori frekuensi, bisa berstok 0)'],
  },
]

const byId = new Map<string, InventoryMetricEntry>()
for (const entry of INVENTORY_METRICS) {
  byId.set(entry.id, entry)
  for (const alias of entry.aka) byId.set(normalizeKey(alias), entry)
}

function normalizeKey(value: string) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-')
}

/** Cari metrik by id ATAU alias ("total usage" → total-issue). */
export function getInventoryMetric(idOrAlias: string): InventoryMetricEntry | undefined {
  return byId.get(normalizeKey(idOrAlias))
}

export const TOTAL_ISSUE = getInventoryMetric('total-issue')!
export const TOTAL_VALUATION = getInventoryMetric('total-valuation')!
export const MOVEMENT_CATEGORY_VALUE = getInventoryMetric('movement-category-value')!
export const MOVEMENT_ISSUE_COUNT = getInventoryMetric('movement-issue-count')!
export const INVENTORY_RETURN = getInventoryMetric('inventory-return')!
export const PURCHASING_GOODS_RETURN = getInventoryMetric('purchasing-goods-return')!
export const UNUSED_STOCK = getInventoryMetric('unused-stock')!

/** Teks tooltip standar: "Label: deskripsi | Formula: … | Sumber: …". */
export function metricHelpText(idOrAlias: string): string {
  const entry = getInventoryMetric(idOrAlias)
  if (!entry) return ''
  const parts = [`${entry.label}: ${entry.description}`, `Formula: ${entry.formula}`, `Sumber: ${entry.source}`]
  if (entry.aka.length > 0) parts.push(`Istilah lain (deprecated): ${entry.aka.join(', ')}`)
  if (entry.notEquals.length > 0) parts.push(`Bukan: ${entry.notEquals.join('; ')}`)
  return parts.join(' | ')
}
