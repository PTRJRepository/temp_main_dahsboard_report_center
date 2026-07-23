# Katalog KPI Procurement Command Deck (Komprehensif)

**Tujuan:** daftar KPI yang *bisa* ditambahkan — pick & choose.  
**Bukan** berarti semua ditampilkan di layar sekaligus.  
**Rekomendasi UI:** Hero 4–6 · rails/tabs · drill-down report.  
**Sumber live yang sudah ada:** valuasi, GR, PR, PO, movement aging.  
**Yang paling kurang hari ini:** issue/usage, frekuensi, top barang, return, net flow.

---

## Cara baca prioritas

| Tag | Arti |
|-----|------|
| **P0** | Wajib di deck “wow” v1 |
| **P1** | Rail utama v1–v2 |
| **P2** | Advanced / CEO insight |
| **P3** | Nice-to-have / butuh SQL lebih berat |
| **LIVE** | Sudah ada (sebagian) di `ProcurementKpiStrip` |
| **NEW** | Belum hero / belum ada |

---

# A. VALUASI & POSISI STOK

| ID | KPI | Definisi singkat | Unit | Prioritas | Status |
|----|-----|------------------|------|-----------|--------|
| V01 | **Total valuasi inventory** | (QtyOnHand+OnHold)×avg cost · ItemType 1+4 | Rp | P0 | LIVE |
| V02 | Valuasi gudang (IT1) | Porsi gudang | Rp + % | P0 | LIVE |
| V03 | Valuasi workshop (IT4) | Porsi workshop | Rp + % | P0 | LIVE |
| V04 | Total item valuasi | Count item di scope | # | P0 | LIVE chip |
| V05 | Total qty on hand | Quantity siap pakai | qty | P1 | LIVE chip |
| V06 | Total qty on hold | Ditahan | qty | P1 | LIVE chip |
| V07 | Qty on order | Masih dipesan | qty | P1 | NEW |
| V08 | Rata-rata nilai per item | Valuasi / #item | Rp | P2 | NEW |
| V09 | Konsentrasi top 10 item | % valuasi dari 10 item terbesar | % | P2 | NEW |
| V10 | Lokasi / gudang dominan | Loc dengan nilai terbesar | code + Rp | P2 | NEW |
| V11 | Stock cover (hari) | Stock value ÷ (usage harian) | hari | P2 | NEW |
| V12 | Dead stock value | Nilai item dead/stale | Rp | P1 | NEW (dari movement) |

---

# B. BARANG MASUK — RECEIVE (GR)

| ID | KPI | Definisi | Unit | Prioritas | Status |
|----|-----|----------|------|-----------|--------|
| R01 | **Nilai goods receive** | SUM qty×PO cost periode | Rp | P0 | LIVE |
| R02 | Qty receive | Total qty masuk | qty | P0 | LIVE chip |
| R03 | Dokumen GR | Count header receive | # | P1 | LIVE chip |
| R04 | Baris GR | Count lines | # | P1 | LIVE chip |
| R05 | Supplier aktif (periode) | Distinct supplier | # | P1 | LIVE chip |
| R06 | Item diterima | Distinct item di GR | # | P1 | LIVE chip |
| R07 | GR per hari (frekuensi) | Docs / active days | #/hari | P2 | NEW |
| R08 | Top supplier by value | Top 5 supplier | list | P1 | NEW |
| R09 | Top item received | Top 5 item masuk | list | P1 | NEW |
| R10 | GR tanpa cost PO | Missing POLn cost rows | # | P1 | LIVE quality |
| R11 | Partial receipt rate | PO line terima sebagian | % | P2 | NEW |
| R12 | Lead time PO→GR | Avg days PODate→GoodsRcvRefDate | hari | P3 | NEW |

---

# C. BARANG KELUAR — ISSUE / USAGE (INTI YANG ANDA MAU)

| ID | KPI | Definisi | Unit | Prioritas | Status |
|----|-----|----------|------|-----------|--------|
| I01 | **Total issue (nilai)** | SUM amount issue periode | Rp | **P0** | **NEW hero** |
| I02 | **Total issue (qty)** | SUM qty issue | qty | **P0** | **NEW** |
| I03 | **Frekuensi issue (event)** | Count baris issue **atau** dokumen (kunci definisi) | # | **P0** | **NEW** |
| I04 | Frekuensi issue (dokumen) | Count header StockIssue / job | # | P0 | NEW |
| I05 | **Hari aktif issue** | Distinct tanggal ada issue | hari | P0 | NEW |
| I06 | **Frekuensi / hari** | Events ÷ ActiveDays | #/hari | **P0** | **NEW** |
| I07 | Frekuensi / item | Events ÷ items used | #/item | P1 | NEW |
| I08 | **Item aktif dipakai** | Distinct ItemCode ber-issue | # | **P0** | **NEW** |
| I09 | Usage intensity | Issue amount ÷ stock value | % | P1 | NEW |
| I10 | Issue gudang vs workshop | Split nilai IT1 vs IT4/WS | Rp + % | P0 | NEW |
| I11 | Issue regular vs workshop event | Count split (movement sudah partial) | # | P1 | partial LIVE |
| I12 | Issue ke kendaraan | Amount di mana VehCode terisi | Rp + % | P1 | NEW |
| I13 | Issue ke blok/station | Amount BlkCode terisi | Rp + % | P1 | NEW |
| I14 | Issue ke dept/cost center | Amount by AccCode (**dept, bukan GL**) | Rp | P1 | NEW |
| I15 | Avg nilai per event | Issue amount ÷ events | Rp | P2 | NEW |
| I16 | Avg qty per event | Issue qty ÷ events | qty | P2 | NEW |
| I17 | Peak day usage | Hari dengan issue terbesar | date + Rp | P2 | NEW |
| I18 | Issue MoM Δ | vs bulan lalu | % | P2 | NEW |
| I19 | Issue YTD | Akumulasi tahun berjalan | Rp | P2 | NEW |
| I20 | Zero-price issue lines | Issue tanpa cost valid | # | P1 | NEW quality |

---

# D. TOP LISTS (ANALISIS ISSUE — “BARANG PALING BANYAK DIPAKAI”)

Toggle dimensi: **Item | Kategori/Tipe | Dept | Vehicle | Block | Lokasi**

| ID | KPI | Sort by | Prioritas | Status |
|----|-----|---------|-----------|--------|
| T01 | **Top item by issue amount** | Rp | **P0** | **NEW** |
| T02 | **Top item by issue qty** | qty | P0 | NEW |
| T03 | **Top item by frekuensi** | #events | P0 | NEW |
| T04 | Top product type / category | amount | P1 | NEW |
| T05 | **Top cost center / dept (AccCode)** | amount | **P0** | **NEW** |
| T06 | **Top vehicle (VehCode)** | amount | P1 | NEW |
| T07 | Top block / station | amount | P1 | NEW |
| T08 | Top gudang asal issue (LocCode) | amount | P1 | NEW |
| T09 | Top workshop job / running unit | amount | P2 | NEW |
| T10 | Fast-rising items | Δ amount vs prev period | P2 | NEW |
| T11 | High value + low stock | issue tinggi & on-hand rendah | P2 | NEW |
| T12 | Repeat offenders | item issue ≥ N kali / periode | P2 | NEW |

**Default tampilan Top:** 5 baris (bukan 20). Klik → report `pengeluaran-barang` filtered.

---

# E. RETURN

| ID | KPI | Definisi | Unit | Prioritas | Status |
|----|-----|----------|------|-----------|--------|
| U01 | **Total return (nilai)** | Return ke gudang / WS return | Rp | **P0** | **NEW** |
| U02 | Total return (qty) | | qty | P1 | NEW |
| U03 | Return events | Count | # | P1 | NEW |
| U04 | **Return rate** | Return ÷ Issue | % | **P0** | **NEW** |
| U05 | Top item returned | | list | P1 | NEW |
| U06 | Return vs receive | Return ÷ GR | % | P2 | NEW |

Sumber usulan: `return-barang`, monthly return, `WS_JOBSTOCK` TransType return, `PU_GOODSRET` bila relevan.

---

# F. ARUS BERSIH & BRIDGE BULANAN

| ID | KPI | Formula ringkas | Prioritas | Status |
|----|-----|-----------------|-----------|--------|
| N01 | **Net flow nilai** | GR − Issue + Return | **P0** | **NEW** |
| N02 | Net flow qty | sama di qty | P1 | NEW |
| N03 | Opening amount | dari month-end prev | P1 | via RPTIN1000015 |
| N04 | Closing amount | formula monthly | P1 | via RPTIN1000015 |
| N05 | Goods receive (monthly) | | P1 | LIVE di monthly |
| N06 | Issued total (monthly) | | P0 | monthly |
| N07 | Placeholder flags | movement kolom belum real | P1 | honesty |
| N08 | Transfer in/out | bila diaktifkan | P2 | often placeholder |
| N09 | Adjustment amount | opname/adj | P2 | stock-opname |

---

# G. PROCUREMENT PROCESS (PR / PO)

| ID | KPI | Definisi | Prioritas | Status |
|----|-----|----------|-----------|--------|
| P01 | Total PR | count | P1 | LIVE chip |
| P02 | **PR outstanding qty** | | P0 | LIVE |
| P03 | PR outstanding nilai | | P1 | NEW/enrich |
| P04 | PR qty request / received | | P1 | LIVE chip |
| P05 | Total PO | count | P1 | LIVE chip |
| P06 | **PO outstanding qty** | | P0 | LIVE |
| P07 | PO nilai order | | P1 | LIVE chip |
| P08 | **PO fill rate** | QtyReceive÷QtyOrder | **P0** | **NEW derived** |
| P09 | PO outstanding nilai | | P1 | NEW |
| P10 | PR→PO conversion rate | | P2 | NEW |
| P11 | Aging outstanding >30/60/90h | bucket | P2 | NEW |
| P12 | Outstanding amount nol (quality) | | P1 | LIVE quality |

---

# H. MOVEMENT / AGING / RISIKO STOK

| ID | KPI | Prioritas | Status |
|----|-----|-----------|--------|
| M01 | Fast moving items | P1 | LIVE chip |
| M02 | Moving items | P1 | LIVE chip |
| M03 | Slow moving | P0 | in risk |
| M04 | Dead movement | P0 | in risk |
| M05 | Stale / no movement | P0 | in risk |
| M06 | **Slow+Dead+Stale (Risk count)** | P0 | LIVE |
| M07 | Distribution bar Fast→Stale | P1 | NEW UI |
| M08 | Issue events (movement window) | P1 | LIVE fields |
| M09 | Issue qty/amount (window) | P1 | LIVE fields |
| M10 | % dead of total items | P1 | NEW |
| M11 | Dead stock value | P1 | NEW |

**Catatan:** `movementWindow` (1m/3m/6m/12m) untuk aging — **terpisah** dari periode usage.

---

# I. FUEL & WORKSHOP KHUSUS

| ID | KPI | Prioritas | Status |
|----|-----|-----------|--------|
| F01 | Fuel usage qty (liter) | P1 | report ada, deck belum |
| F02 | Fuel usage nilai | P1 | NEW deck |
| F03 | Top vehicle fuel | P1 | NEW |
| F04 | Workshop sparepart usage | P1 | partial via issue IT4 |
| F05 | Vehicle running units | P2 | vehicle-running-workshop |
| F06 | Cost per running unit | P3 | NEW |

---

# J. KUALITAS DATA & KEPERCAYAAN ANGKA

| ID | KPI | Prioritas | Status |
|----|-----|-----------|--------|
| Q01 | Zero qty items | P1 | LIVE |
| Q02 | Zero unit cost items | P1 | LIVE |
| Q03 | Missing PO line cost (GR) | P1 | LIVE |
| Q04 | PR outstanding amount 0 | P1 | LIVE |
| Q05 | **Quality alert composite** | P0 | LIVE |
| Q06 | Issue tanpa AccCode/Veh saat wajib | P2 | NEW |
| Q07 | Char padding / bad codes | P3 | ops |

---

# K. FREKUENSI & POLA WAKTU (lintas proses)

Bisa dipakai untuk **Issue**, **GR**, **PR**, **PO**:

| ID | Pola | Contoh label |
|----|------|----------------|
| X01 | Count events | “Frekuensi issue” |
| X02 | Active days | “Hari ada transaksi” |
| X03 | Events / day | “Rata-rata per hari” |
| X04 | Events / week | “Per minggu” |
| X05 | Peak day / peak week | “Puncak pemakaian” |
| X06 | Weekday vs weekend mix | P3 |
| X07 | MoM / YoY | “vs bulan lalu” |
| X08 | Sparkline 6–12 titik | visual tren |

---

# L. PAKET TAMPILAN YANG DISARANKAN (biar komprehensif tapi tidak berantakan)

## Hero (selalu kelihatan) — 4 kartu
1. **V01** Total valuasi  
2. **N01** Net flow (GR − Issue + Return)  
3. **I01** Total issue nilai (+ chip I03 frekuensi, I08 item aktif)  
4. **M06** Risk pulse (slow/dead/stale) *atau* **Q05** quality  

## Tab / rail 1 — Valuasi  
V01–V07, V09, V12  

## Tab / rail 2 — Masuk (Receive + PR/PO)  
R01–R06, R08–R09, P02, P06, P08  

## Tab / rail 3 — **Issue Analysis** (fokus Anda)  
I01–I10, I12–I14  
**Top panel:** T01 / T03 / T05 (toggle Item · Frekuensi · Dept)  
Opsional T06 vehicle  

## Tab / rail 4 — Return & net  
U01, U04, N01, N03–N06  

## Tab / rail 5 — Aging & quality  
M01–M07, Q01–Q05  

## Tab / rail 6 — Fuel/workshop (opsional)  
F01–F04  

---

# M. Definisi formal yang harus dikunci (supaya angka “benar”)

```
TotalIssueAmount   = SUM(issue line amount)  // gudang IN_STOCKISSUELN + workshop WS_JOBSTOCK
TotalIssueQty      = SUM(issue qty)
IssueEvents        = COUNT(lines)            // rekomendasi default
IssueDocuments     = COUNT(DISTINCT header)
ActiveIssueDays    = COUNT(DISTINCT issue date)
FreqPerDay         = IssueEvents / ActiveIssueDays
ItemsUsed          = COUNT(DISTINCT ItemCode)
ReturnRate         = ReturnAmount / NULLIF(IssueAmount,0)
NetFlowAmount      = ReceiveAmount - IssueAmount + ReturnAmount
UsageIntensity     = IssueAmount / NULLIF(StockValue,0)
POFillRate         = QtyReceive / NULLIF(QtyOrder,0)
```

**Iron laws:**  
- AccCode di issue = **dept/cost center**, bukan GL  
- VehCode di **line**  
- Periode usage ≠ movement window aging  
- Estate GR cost dari **PU_POLN**  
- Jangan klaim kolom monthly yang masih `placeholder_zero`

---

# N. Urutan tambah (praktis)

| Gelombang | KPI | Kenapa |
|-----------|-----|--------|
| **1** | I01, I02, I03, I06, I08, T01, T03, U01, U04, N01, P08 | Langsung “usage + top + return + net” |
| **2** | T05, T06, I10–I14, R08–R09, M07, V12 | Analisis driver + visual risk |
| **3** | F01–F03, V09, lead time, MoM sparkline, composite API | Wow lanjutan |

---

# O. Ringkas untuk CEO

**Bisa ditambah (kelompok besar):**  
1. Valuasi stok (sudah)  
2. Receive masuk (sudah, bisa diperkaya top supplier/item)  
3. **Issue total + frekuensi + item aktif (baru, prioritas)**  
4. **Top barang / dept / unit paling boros (baru)**  
5. Return + return rate + net flow (baru)  
6. PR/PO outstanding + fill rate  
7. Aging fast→dead + nilai dead stock  
8. Fuel & workshop khusus  
9. Quality alert (sudah)  
10. Tren waktu (frekuensi/hari, MoM, sparkline)

**Jangan taruh 80 KPI di satu grid.**  
Komprehensif = **katalog lengkap di belakang**, **hero + 3–4 rail di depan**.

---

Dokumen terkait: `PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md`
