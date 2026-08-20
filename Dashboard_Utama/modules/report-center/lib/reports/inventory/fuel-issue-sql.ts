/**
 * Shared IN_FUELISSUE date/status SQL fragments.
 * PATOKAN TANGGAL = CreateDate (tanggal slip dibuat). PostDate sering placeholder
 * 1900 dan tidak konsisten; data live membuktikan CreateDate TIDAK PERNAH placeholder
 * (0 baris 1900/NULL di semua tabel, vs PostDate ratusan baris 1900).
 * Urutan fallback: CreateDate → PostDate(≠1900) → FuelIssueRefDate(≠1900) → UpdateDate.
 *
 * Period filter: FISKAL AccYear/AccMonth — SAMA dengan stock issue & workshop.
 * Ini WAJIB agar Total Issue dashboard PARITY persis dengan monthly report RPTIN
 * (audit live membuktikan fuel kalender DocDate menyimpang Rp 171.913.818 untuk
 * periode Mei 2026 = 2/2027; fuel fiskal = parity Rp 0).
 * Helper DocDate/kalender di bawah tetap ada untuk trend lintas-bulan & panel
 * yang memang berbasis tanggal slip, tapi BUKAN untuk Total Issue periode akuntansi.
 */

export function fuelIssueDocumentDateExpression(alias = 'h') {
  return `COALESCE(NULLIF(${alias}.CreateDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.PostDate, CONVERT(datetime, '1900-01-01')), NULLIF(${alias}.FuelIssueRefDate, CONVERT(datetime, '1900-01-01')), ${alias}.UpdateDate)`
}

export function fuelIssueStatusFilter(alias = 'h') {
  return `AND RTRIM(ISNULL(${alias}.Status, '')) IN ('2', '6')`
}

/** Inclusive start / exclusive end on DocDate. Empty if bounds incomplete. */
export function fuelIssueDateRangeFilter(
  alias: string,
  startInclusive: string | null | undefined,
  endExclusive: string | null | undefined,
) {
  if (!startInclusive || !endExclusive) return ''
  if (!/^\d{4}-\d{2}-\d{2}/.test(startInclusive) || !/^\d{4}-\d{2}-\d{2}/.test(endExclusive)) return ''
  const docDate = fuelIssueDocumentDateExpression(alias)
  return `
      AND ${docDate} >= '${startInclusive.slice(0, 10)}'
      AND ${docDate} < '${endExclusive.slice(0, 10)}'`
}

/** period = YYYY-MM (actual calendar month selected in UI). Dipakai utk trend, BUKAN Total Issue. */
export function fuelIssueSelectedPeriodFilter(alias: string, periodYm: string) {
  const m = String(periodYm ?? '').trim().match(/^(\d{4})-(\d{1,2})/)
  if (!m) return ''
  const year = Number(m[1])
  const month = Number(m[2])
  if (!year || month < 1 || month > 12) return ''
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const nextY = month === 12 ? year + 1 : year
  const nextM = month === 12 ? 1 : month + 1
  const endExclusive = `${nextY}-${String(nextM).padStart(2, '0')}-01`
  return fuelIssueDateRangeFilter(alias, start, endExclusive)
}

/**
 * Filter periode FISKAL untuk fuel — IDENTIK dengan accountingPeriodFilter yang
 * dipakai stock issue & workshop. Pakai ini untuk Total Issue agar parity dgn RPTIN.
 */
export function fuelIssueFiscalPeriodFilter(alias: string, accYear: string | number, accMonth: string | number) {
  const y = String(accYear ?? '').trim()
  const m = String(accMonth ?? '').trim()
  if (!y || !m) return ''
  return `AND RTRIM(CONVERT(varchar(10), ${alias}.AccYear)) = '${y}'
        AND RTRIM(CONVERT(varchar(10), ${alias}.AccMonth)) = '${m}'`
}

export const FUEL_ISSUE_PERIOD_RULE =
  'Period filter Total Issue = FISKAL AccYear/AccMonth (parity dgn RPTIN). DocDate = COALESCE(NULLIF(PostDate,1900), NULLIF(FuelIssueRefDate,1900), UpdateDate, CreateDate) hanya utk trend/tanggal slip. Status 2/6; optional LocCode.'
