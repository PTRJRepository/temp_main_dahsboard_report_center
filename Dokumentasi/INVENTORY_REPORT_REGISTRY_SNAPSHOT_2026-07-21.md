# Inventory Report Registry Snapshot (from config.ts)

**Date:** 2026-07-21  
**Source of truth:** `Dashboard_Utama/lib/reports/inventory/config.ts`  
**Note:** Chart child objects also have titles; **live report status count ≈ 19 live + 1 hold** (do not trust doc “27” without re-count).

---

## Live reports (status=live) — primary catalog

| id | code | group | title |
| --- | --- | --- | --- |
| stok-gudang | INV-01 | executive | Posisi Stok & Nilai Inventory |
| asset-stock-valuasi-listing | RPTIN1000011 | executive | Report Asset Stock Valuasi Listing |
| all-stock-movement-analysis | INV-ALL-STOCK-MOVEMENT | transaction | ALL Stock Movement Analysis Real Time |
| top-stock-issue-movement-items | INV-STOCK-AGING | master | Top Stock Issue Movement Items |
| movement-stock | INV-03 | transaction | Movement Stock |
| **monthly-stock-account-movement-details** | **RPTIN1000015** | **transaction** | **MONTHLY STOCK ACCOUNT MOVEMENT DETAILS** |
| pengeluaran-barang | INV-04 | transaction | Pengeluaran Barang Operasional |
| goods-receiving-receipt-activity | INV-05 | purchasing | Goods Receiving & Receipt Activity |
| purchase-request-inventory | INV-06 | purchasing | Purchase Request Inventory & Outstanding |
| transfer-antar-gudang | INV-07 | transaction | Transfer Antar Gudang |
| stock-opname | INV-08 | control | Stock Opname & Adjustment |
| fuel-usage | INV-09 | fuel | Fuel Usage Inventory |
| riwayat-transaksi | INV-10 | control | Riwayat Transaksi Inventory |
| return-barang | INV-11 | control | Return Barang |
| item-stale-update | INV-12 | transaction | Item Tidak Update & Aging Master |
| purchase-order-history | INV-13 | purchasing | Purchasing Order History per Item & Supplier |
| supplier-purchasing-performance | INV-14 | purchasing | Supplier Performance & Master Quality |
| pupuk-stock-procurement | INV-15 | fertilizer | Pupuk: Stock, Issue Readiness & Procurement |
| vehicle-running-workshop | INV-16 | vehicle | Vehicle Running & Workshop Inventory Usage |

## Hold

| id | code | title |
| --- | --- | --- |
| expiry-inventory | INV-H01 | Expiry Date Inventory |

## Viewer profile families (detail forks)

| Profile family | Example report ids |
| --- | --- |
| Monthly stock movement | `monthly-stock-account-movement-details` |
| Movement analysis | `all-stock-movement-analysis` (+ related) |
| Stock aging | `item-stale-update`, top stock issue movement |
| Asset valuation | `asset-stock-valuasi-listing` |
| Generic | remaining live reports |

Redesign **shell** must work for all families; **summary content** is profile-pluggable. Monthly is the pilot.

## Chart / sub-titles in config

Many additional `title:` strings are **chartDefinitions** or nested metadata, not separate routes. Agents must not invent routes for every title string.

## Redesign implication

- Catalog IA groups by flow stage (InventoryReportsClient) vs config `group` (executive/transaction/purchasing/…) — **two taxonomies**. Document mapping when changing catalog.  
- Opening non-live / hold must not hit detail as success.  
- Semantic search tags live on each report in config — preserve when renaming UI only.

---

**End registry snapshot.**
