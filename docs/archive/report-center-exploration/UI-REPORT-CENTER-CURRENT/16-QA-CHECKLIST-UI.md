# 16 — QA Checklist UI (manual)

Gunakan setelah login ke production gateway `:3001`.

## A. Procurement module

- [ ] `/report-center/procurement?source=estate` load tanpa blank
- [ ] Source toggle pabrik bekerja
- [ ] KPI badge Live atau Live sebagian (bukan stuck loading selamanya)
- [ ] Master valuation menampilkan Rp + bar gudang/workshop
- [ ] Net Flow berubah saat period diganti
- [ ] Total Usage menampilkan chips qty/event/item
- [ ] GR / PR out / PO out terisi atau 0 jujur
- [ ] Movement section terisi
- [ ] Top 5 muncul bila ada chart usage; klik buka issue
- [ ] Filter label period ≠ aging window jelas
- [ ] Reset filters kembali default

## B. Overview

- [ ] Embedded: tidak ada period select dobel (hideScopeControls)
- [ ] Threshold Fast/Slow editable + reset
- [ ] Exception queue / composition click drill
- [ ] Fast actions buka movement report

## C. Area kerja

- [ ] Tabs Semua/Gudang/Workshop/Ordering
- [ ] Ordering menampilkan process cards
- [ ] Catalog embedded load (Suspense OK)
- [ ] Process map 6 stage link benar

## D. Monthly detail RPTIN1000015

- [ ] Ringkasan sticky tidak double grand+flow
- [ ] Actual vs Accounting labels
- [ ] ControlBar period/group/MC/itemType
- [ ] Primary KPI ≤6 story
- [ ] Table scroll / stream
- [ ] Export labels jujur (PDF preview)

## E. Regression

- [ ] Login gate masih aktif
- [ ] Tidak ada API key di UI
- [ ] AccCode tidak dilabel GL di deck top strip copy
- [ ] Mobile: layout tidak overflow parah

## F. Docs sync

- [ ] Jika UI berubah, update `02`/`08`/`09`/`10` + `11` changelog

---

**End QA.**

## 2026-07-23 QA delta

- [x] TypeScript validation passed after each code phase with `node ./node_modules/typescript/bin/tsc --noEmit`.
- [x] Export dialog has labelled title/description, Escape close, initial focus, focus loop, and focus restoration.
- [x] Table headers expose `aria-sort`; operational type floor is 11px on table body/header.
- [x] PDF filename and footer state `pratinjau` / `bukan laporan resmi`.
- [ ] Browser visual verification at 320/375/414/768 still required.
- [ ] Official full PDF server flow still planned, not live.

