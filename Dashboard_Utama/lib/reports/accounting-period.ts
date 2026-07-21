export const ACCOUNTING_YEAR_START_MONTH = 4

const ACCOUNTING_MONTH_YEAR_SPLIT = 13 - ACCOUNTING_YEAR_START_MONTH
const ACTUAL_MONTH_OFFSET = ACCOUNTING_YEAR_START_MONTH - 2

export type AccountingPeriod = {
  accYear: number
  accMonth: number
  actualYear: number
  actualMonth: number
  actualPeriod: string
  actualPeriodStart: string
}

export type ActualPeriod = {
  actualYear: number
  actualMonth: number
  accYear: number
  accMonth: number
  accountingPeriod: string
}

function toInteger(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) return null
  return Number(text)
}

function padMonth(month: number) {
  return String(month).padStart(2, '0')
}

function nextActualMonth(year: number, month: number) {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export function normalizeAccountingMonth(value: string | number | null | undefined) {
  const month = toInteger(value)
  return month !== null && month >= 1 && month <= 12 ? month : null
}

export function normalizeAccountingYear(value: string | number | null | undefined) {
  const year = toInteger(value)
  return year !== null && year >= 1 ? year : null
}

export function accountingMonthToActualMonth(value: string | number | null | undefined) {
  const accMonth = normalizeAccountingMonth(value)
  if (accMonth === null) return null
  return ((accMonth + ACTUAL_MONTH_OFFSET) % 12) + 1
}

export function accountingToActualPeriod(
  accYearValue: string | number | null | undefined,
  accMonthValue: string | number | null | undefined,
): AccountingPeriod | null {
  const accYear = normalizeAccountingYear(accYearValue)
  const accMonth = normalizeAccountingMonth(accMonthValue)
  if (accYear === null || accMonth === null) return null

  const actualMonth = accountingMonthToActualMonth(accMonth)
  if (actualMonth === null) return null

  const actualYear = actualMonth >= ACCOUNTING_YEAR_START_MONTH ? accYear - 1 : accYear
  return {
    accYear,
    accMonth,
    actualYear,
    actualMonth,
    actualPeriod: `${actualYear}-${padMonth(actualMonth)}`,
    actualPeriodStart: `${actualYear}-${padMonth(actualMonth)}-01`,
  }
}

export function actualToAccountingPeriod(
  actualYearValue: string | number | null | undefined,
  actualMonthValue: string | number | null | undefined,
): ActualPeriod | null {
  const actualYear = normalizeAccountingYear(actualYearValue)
  const actualMonth = normalizeAccountingMonth(actualMonthValue)
  if (actualYear === null || actualMonth === null) return null

  const accMonth =
    actualMonth >= ACCOUNTING_YEAR_START_MONTH
      ? actualMonth - ACCOUNTING_YEAR_START_MONTH + 1
      : actualMonth + ACCOUNTING_MONTH_YEAR_SPLIT
  const accYear = actualMonth >= ACCOUNTING_YEAR_START_MONTH ? actualYear + 1 : actualYear

  return {
    actualYear,
    actualMonth,
    accYear,
    accMonth,
    accountingPeriod: `${accYear}-${padMonth(accMonth)}`,
  }
}

export function actualPeriodBounds(
  actualYearValue: string | number | null | undefined,
  actualMonthValue: string | number | null | undefined,
) {
  const actualYear = normalizeAccountingYear(actualYearValue)
  const actualMonth = normalizeAccountingMonth(actualMonthValue)
  if (actualYear === null || actualMonth === null) return null

  const next = nextActualMonth(actualYear, actualMonth)
  return {
    startInclusive: `${actualYear}-${padMonth(actualMonth)}-01`,
    endExclusive: `${next.year}-${padMonth(next.month)}-01`,
  }
}

export function sqlIntegerExpression(expression: string) {
  return `TRY_CONVERT(int, NULLIF(LTRIM(RTRIM(CONVERT(varchar(10), ${expression}))), ''))`
}

export function accountingActualMonthSqlExpression(accMonthExpression: string) {
  const accMonth = sqlIntegerExpression(accMonthExpression)
  return `CASE WHEN ${accMonth} BETWEEN 1 AND 12 THEN ((${accMonth} + ${ACTUAL_MONTH_OFFSET}) % 12) + 1 END`
}

export function accountingActualYearSqlExpression(accYearExpression: string, accMonthExpression: string) {
  const accYear = sqlIntegerExpression(accYearExpression)
  const accMonth = sqlIntegerExpression(accMonthExpression)
  return `CASE WHEN ${accMonth} BETWEEN 1 AND ${ACCOUNTING_MONTH_YEAR_SPLIT} THEN ${accYear} - 1 WHEN ${accMonth} BETWEEN ${ACCOUNTING_MONTH_YEAR_SPLIT + 1} AND 12 THEN ${accYear} END`
}

export function accountingActualPeriodSqlExpression(accYearExpression: string, accMonthExpression: string) {
  const actualYear = accountingActualYearSqlExpression(accYearExpression, accMonthExpression)
  const actualMonth = accountingActualMonthSqlExpression(accMonthExpression)
  return `CASE WHEN ${actualYear} IS NOT NULL AND ${actualMonth} IS NOT NULL THEN CONVERT(varchar(4), ${actualYear}) + '-' + RIGHT('0' + CONVERT(varchar(2), ${actualMonth}), 2) END`
}

export function accountingActualPeriodStartSqlExpression(accYearExpression: string, accMonthExpression: string) {
  const actualYear = accountingActualYearSqlExpression(accYearExpression, accMonthExpression)
  const actualMonth = accountingActualMonthSqlExpression(accMonthExpression)
  return `DATEFROMPARTS(${actualYear}, ${actualMonth}, 1)`
}

export function accountingActualPeriodSelectSql({
  accYearExpression,
  accMonthExpression,
  actualYearAlias = 'ActualYear',
  actualMonthAlias = 'ActualMonth',
  actualPeriodAlias = 'ActualPeriod',
  actualPeriodStartAlias = 'ActualPeriodStart',
}: {
  accYearExpression: string
  accMonthExpression: string
  actualYearAlias?: string
  actualMonthAlias?: string
  actualPeriodAlias?: string
  actualPeriodStartAlias?: string
}) {
  return [
    `${accountingActualYearSqlExpression(accYearExpression, accMonthExpression)} AS ${actualYearAlias}`,
    `${accountingActualMonthSqlExpression(accMonthExpression)} AS ${actualMonthAlias}`,
    `${accountingActualPeriodSqlExpression(accYearExpression, accMonthExpression)} AS ${actualPeriodAlias}`,
    `${accountingActualPeriodStartSqlExpression(accYearExpression, accMonthExpression)} AS ${actualPeriodStartAlias}`,
  ].join(',\n      ')
}
