# 07 - Accounting Period

## Overview

Sistem menggunakan **dual period tracking**: periode aktual (calendar) dan periode akuntansi (fiscal year).

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERIOD CONVERSION FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐       ┌─────────────────────────┐    │
│  │  ACTUAL PERIOD      │       │  ACCOUNTING PERIOD      │    │
│  │  (Calendar Year)    │       │  (Fiscal Year)          │    │
│  │                     │       │                         │    │
│  │  January    01      │       │  April       01         │    │
│  │  February   02      │       │  May         02         │    │
│  │  March      03      │       │  June        03         │    │
│  │  ────────────────  │       │  July        04         │    │
│  │  April      04  ───┼──────►│  August      05         │    │
│  │  May        05     │       │  September   06         │    │
│  │  June       06     │       │  October     07         │    │
│  │  July       07     │       │  November    08         │    │
│  │  August     08     │       │  December    09         │    │
│  │  September  09     │       │  January     10         │    │
│  │  October    10     │       │  February    11         │    │
│  │  November   11     │       │  March       12         │    │
│  │  December   12     │       │                         │    │
│  └─────────────────────┘       └─────────────────────────┘    │
│                                                                 │
│  Fiscal Year Start: April                                       │
│  Actual Year + 1 when month >= April                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Conversion Rules

### Actual → Accounting

```typescript
function actualToAccountingPeriod(actualYear: number, actualMonth: number) {
  // April onwards: fiscal year + 1
  // Before April: fiscal year same as actual
  const accYear = actualMonth >= 4 ? actualYear + 1 : actualYear
  // AccMonth = actualMonth - 3 (April=1, May=2, ...)
  const accMonth = actualMonth - 3

  return { accYear, accMonth }
}
```

### Accounting → Actual

```typescript
function accountingToActualPeriod(accYear: number, accMonth: number) {
  // ActualMonth = accMonth + 3 (1=April → 4, 2=May → 5, ...)
  const actualMonth = accMonth + 3
  // ActualYear = accYear when month <= 12
  const actualYear = accMonth >= 10 ? accYear - 1 : accYear

  return { actualYear, actualMonth }
}
```

## Conversion Examples

| Actual Period | AccYear | AccMonth | Accounting Period |
|--------------|---------|----------|-------------------|
| 2026-01 (Jan) | 2026 | 10 | 2026-10 |
| 2026-02 (Feb) | 2026 | 11 | 2026-11 |
| 2026-03 (Mar) | 2026 | 12 | 2026-12 |
| 2026-04 (Apr) | 2027 | 1 | 2027-01 |
| 2026-05 (May) | 2027 | 2 | 2027-02 |
| 2026-06 (Jun) | 2027 | 3 | 2027-03 |
| 2026-07 (Jul) | 2027 | 4 | 2027-04 |
| 2026-08 (Aug) | 2027 | 5 | 2027-05 |
| 2026-09 (Sep) | 2027 | 6 | 2027-06 |
| 2026-10 (Oct) | 2027 | 7 | 2027-07 |
| 2026-11 (Nov) | 2027 | 8 | 2027-08 |
| 2026-12 (Dec) | 2027 | 9 | 2027-09 |

## Opening Period Calculation

Opening period adalah bulan sebelumnya dalam accounting period:

```typescript
function previousAccountingPeriod(accYear: number, accMonth: number) {
  return accMonth <= 1
    ? { accYear: accYear - 1, accMonth: 12 }  // January → December prev year
    : { accYear, accMonth: accMonth - 1 }      // Others: previous month
}
```

### Opening Period Examples

| Current Period | Opening Period |
|----------------|---------------|
| 2027-04 (Jul 2026) | 2027-03 (Jun 2026) |
| 2027-03 (Jun 2026) | 2027-02 (May 2026) |
| 2027-02 (May 2026) | 2027-01 (Apr 2026) |
| 2027-01 (Apr 2026) | 2026-12 (Mar 2026) |

## Scope Period Resolution

```typescript
interface PeriodScope {
  // Current period (actual)
  actualYear: number          // e.g., 2026
  actualMonth: number         // e.g., 7
  actualPeriod: string         // e.g., "2026-07"
  actualPeriodStart: string    // e.g., "2026-07-01"

  // Current period (accounting)
  accYear: number             // e.g., 2027
  accMonth: number            // e.g., 4
  accountingPeriod: string    // e.g., "2027-04"

  // Opening period (previous month)
  openingAccYear: number      // e.g., 2027
  openingAccMonth: number     // e.g., 3
  openingAccountingPeriod: string  // e.g., "2027-03"
  openingActualPeriod: string  // e.g., "2026-06"

  // Metadata
  inputMode: 'actual' | 'accounting' | 'period' | 'current'
}
```

## SQL Usage

### Current Period Filter
```sql
WHERE RTRIM(CONVERT(varchar(10), AccYear)) = '${scope.accYear}'
  AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${scope.accMonth}'
```

### Opening Period Filter (IN_MTHENDITEM)
```sql
WHERE RTRIM(CONVERT(varchar(10), AccYear)) = '${scope.openingAccYear}'
  AND RTRIM(CONVERT(varchar(10), AccMonth)) = '${scope.openingAccMonth}'
```

## Input Modes

| Mode | Input | Resolution |
|------|-------|------------|
| `period` | `?period=2026-07` | Parses YYYY-MM format |
| `actual` | `?actualYear=2026&actualMonth=7` | Uses actualYear/actualMonth fields |
| `accounting` | `?accYear=2027&accMonth=4` | Uses accYear/accMonth fields |
| `current` | (no params) | Uses current date |

## Display Format

### UI Labels
```typescript
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Jul 2026, AccMonth 4, AccYear 2027
const label = `4/2027 (Jul 2026)`
// Format: accMonth/accYear (monthName year)
```

### Period String Formats

| Format | Example | Usage |
|--------|---------|-------|
| `actualPeriod` | `2026-07` | URL parameter |
| `actualPeriodStart` | `2026-07-01` | Date calculations |
| `accountingPeriod` | `2027-04` | Display labels |
| `openingActualPeriod` | `2026-06` | Previous actual month |
| `openingAccountingPeriod` | `2027-03` | Previous accounting month |

## Navigation

**Previous:** [06-API Endpoints](./06-API-ENDPOINTS.md)
**Next:** [08-Workshop Items](./08-WORKSHOP-ITEMS.md)
