# Monthly Stock Account Movement Details

**Report ID:** RPTIN1000015
**Status:** Live | Priority: Critical
**Database:** db_ptrj_mill (source=pabrik)
**Source File:** `Dashboard_Utama/lib/reports/inventory/monthly-stock-account-movement.ts`

## Table of Contents

| # | Document | Description |
|---|----------|-------------|
| 01 | [Overview](./01-OVERVIEW.md) | Gambaran umum report, tujuan, dan penggunaan |
| 02 | [Tables Reference](./02-TABLES-REFERENCE.md) | Referensi lengkap semua tabel yang digunakan |
| 03 | [SQL CTE Structure](./03-SQL-CTE-STRUCTURE.md) | Struktur SQL CTE dan alur query |
| 04 | [Movement Definitions](./04-MOVEMENT-DEFINITIONS.md) | Definisi 14 kolom movement dengan status implementasi |
| 05 | [Filters & Parameters](./05-FILTERS-PARAMETERS.md) | Filter URL dan parameter query |
| 06 | [API Endpoints](./06-API-ENDPOINTS.md) | Endpoint API dan format response |
| 07 | [Accounting Period](./07-ACCOUNTING-PERIOD.md) | Konversi periode aktual ke akuntansi |
| 08 | [Workshop Items](./08-WORKSHOP-ITEMS.md) | Penanganan ItemType 4 (Workshop) |
| 09 | [Goods Receive](./09-GOODS-RECEIVE.md) | Valuasi goods receive dari purchasing |
| 10 | [Closing Formula](./10-CLOSING-FORMULA.md) | Formula closing stock calculation |
| 11 | [Validation Rules](./11-VALIDATION-RULES.md) | Aturan validasi dan quality notes |
| 12 | [Nested Response](./12-NESTED-RESPONSE.md) | Format nested JSON response (ASMA format) |

## Quick Reference

### Source Tables
```
IN_ITEM, IN_PRODTYPE, IN_MTHENDITEM, IN_STOCKISSUE, IN_STOCKISSUELN,
IN_FUELISSUE, IN_FUELISSUELN, WS_JOBSTOCK, WS_JOB,
PU_GOODSRCV, PU_GOODSRCVLN, PU_GOODSRET, PU_GOODSRETLN, PU_POLN
```

### Movement Columns
| Column | Status | Source |
|--------|--------|--------|
| Opening | ✅ Implemented | IN_MTHENDITEM previous period |
| Received | ⚠️ Placeholder | Not implemented |
| Return Advice | ⚠️ Placeholder | Not implemented |
| Transferred | ⚠️ Placeholder | Not implemented |
| Adjustment | ⚠️ Placeholder | Not implemented |
| Issued - Ledger | ✅ Implemented | IN_STOCKISSUE (non-workshop, no block/vehicle) |
| Issued - Station | ✅ Implemented | IN_STOCKISSUE (non-workshop, has block) |
| Issued - Vehicle | ✅ Implemented | IN_STOCKISSUE (non-workshop, has vehicle) |
| Issued - Total | ✅ Implemented | Computed |
| Return | ✅ Implemented | WS_JOBSTOCK TransType 2 |
| Goods Receive | ✅ Implemented | PU_GOODSRCV × PU_POLN.Cost |
| Goods Return | ✅ Implemented | PU_GOODSRET × Cost |
| Dispatch Advice | ⚠️ Placeholder | Not implemented |
| Closing | ✅ Implemented | Computed formula |

### API Quick Access
```
GET /api/reports/inventory?report=monthly-stock-account-movement-details
GET /api/reports/monthly-stock-account-movement-details-json
```

## Related Documentation
- [Report Center Documentation](./Report-Center-Documentation.md)
- [DB_PTRJ_MILL Stock Relations](./DB_ptrj_mill_Stock_Hubungan.md)
- [IN_ITEM Schema](../IN_TABLES_MCP.md)
