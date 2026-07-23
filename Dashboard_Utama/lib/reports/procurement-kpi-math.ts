/**
 * Pure KPI math untuk Procurement Command Deck.
 * Kontrak mengikuti Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md §5.2 & M.
 * Semua fungsi murni — tanpa fetch/SQL — agar mudah diuji.
 */

/** Pembagian aman: 0 bila denominator kosong/tidak valid. */
function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return 0
  return numerator / denominator
}

/** NetFlowAmount = Receive − Issue + Return (nilai, signed). */
export function netFlowAmount(receiveAmount: number, issueAmount: number, returnAmount: number): number {
  return receiveAmount - issueAmount + returnAmount
}

/** FreqPerDay = IssueEvents / ActiveIssueDays. */
export function frequencyPerDay(issueEvents: number, activeIssueDays: number): number {
  return safeRatio(issueEvents, activeIssueDays)
}

/** ReturnRate = ReturnAmount / IssueAmount (fraksi 0..n; kalikan 100 untuk %). */
export function returnRate(returnAmount: number, issueAmount: number): number {
  return safeRatio(returnAmount, issueAmount)
}

/** POFillRate = QtyReceive / QtyOrder (fraksi 0..n). */
export function poFillRate(qtyReceive: number, qtyOrder: number): number {
  return safeRatio(qtyReceive, qtyOrder)
}

/** UsageIntensity = IssueAmount / StockValue (fraksi 0..n). */
export function usageIntensity(issueAmount: number, stockValue: number): number {
  return safeRatio(issueAmount, stockValue)
}

/** RiskCount = Slow + Dead + Stale (count item). */
export function riskCount(slow: number, dead: number, stale: number): number {
  return (Number.isFinite(slow) ? slow : 0) + (Number.isFinite(dead) ? dead : 0) + (Number.isFinite(stale) ? stale : 0)
}

/** Persen dari total (0..100). */
export function percentOf(value: number, total: number): number {
  return safeRatio(value, total) * 100
}
