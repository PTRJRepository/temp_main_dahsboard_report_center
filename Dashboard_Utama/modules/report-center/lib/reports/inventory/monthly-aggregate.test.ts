import assert from 'node:assert/strict'
import { filterHashFor } from './monthly-aggregate-store'
import { resolveAggregationPeriod } from './monthly-aggregate'

// Acuan waktu tetap: 23 Juli 2026 (Asia/Jakarta → Juli 2026 bulan berjalan).
const NOW = new Date('2026-07-23T12:00:00Z')

// --- resolveAggregationPeriod: closed vs live ---

// Periode closed (bulan lalu) → closed.
assert.deepEqual(resolveAggregationPeriod({ period: '2026-06' }, NOW), {
  closed: true,
  period: '2026-06',
  actualYear: 2026,
  actualMonth: 6,
  requested: true,
})

// Bulan berjalan → live (tidak closed).
assert.equal(resolveAggregationPeriod({ period: '2026-07' }, NOW).closed, false)
assert.equal(resolveAggregationPeriod({ period: '2026-07' }, NOW).period, '2026-07')

// Masa depan → live.
assert.equal(resolveAggregationPeriod({ period: '2026-12' }, NOW).closed, false)

// Tanpa period → live, tidak requested.
assert.deepEqual(resolveAggregationPeriod({}, NOW), {
  closed: false,
  period: null,
  actualYear: null,
  actualMonth: null,
  requested: false,
})
assert.equal(resolveAggregationPeriod(undefined, NOW).closed, false)

// actualYear + actualMonth eksplisit.
assert.deepEqual(resolveAggregationPeriod({ actualYear: 2026, actualMonth: 5 }, NOW), {
  closed: true,
  period: '2026-05',
  actualYear: 2026,
  actualMonth: 5,
  requested: true,
})

// acc:YYYY-MM → dikonversi fiscal (tahun ajaran mulai April).
// acc 2027-01 = actual 2026-04 (closed relatif ke Juli 2026).
assert.deepEqual(resolveAggregationPeriod({ period: 'acc:2027-01' }, NOW), {
  closed: true,
  period: '2026-04',
  actualYear: 2026,
  actualMonth: 4,
  requested: true,
})

// accYear + accMonth → actual. acc 2026-12 = actual 2026-03 (closed relatif ke Juli 2026).
assert.deepEqual(resolveAggregationPeriod({ accYear: 2026, accMonth: 12 }, NOW), {
  closed: true,
  period: '2026-03',
  actualYear: 2026,
  actualMonth: 3,
  requested: true,
})

// Period invalid → live (aman, tidak diagregasi).
assert.equal(resolveAggregationPeriod({ period: 'bukan-tanggal' }, NOW).closed, false)
assert.equal(resolveAggregationPeriod({ period: '2026-13' }, NOW).closed, false)

// --- filterHashFor: stabil & membedakan yang relevan ---

// Deterministik — urutan key tidak berpengaruh.
const hashA = filterHashFor({ period: '2026-06', location: 'G1', productType: 'SPAREPART' })
const hashB = filterHashFor({ productType: 'SPAREPART', period: '2026-06', location: 'G1' })
assert.equal(hashA, hashB)

// Filter non-SQL-relevant (search/sort/page) tidak mengubah hash.
const hashC = filterHashFor({ period: '2026-06', location: 'G1', productType: 'SPAREPART', search: 'bearing', page: 3, sort: 'desc' })
assert.equal(hashA, hashC)

// Nilai kosong/undefined diabaikan.
const hashD = filterHashFor({ period: '2026-06', location: '', productType: 'SPAREPART', category: undefined })
const hashE = filterHashFor({ period: '2026-06', productType: 'SPAREPART' })
assert.equal(hashD, hashE)

// Filter relevan yang beda → hash beda.
const hashF = filterHashFor({ period: '2026-06', location: 'G2', productType: 'SPAREPART' })
assert.notEqual(hashA, hashF)

console.log('monthly-aggregate.test.ts: all assertions passed')
