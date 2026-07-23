# Inventory Module — Report Center

> Scope awal: inventory stock issue, month-end journal, dan month-end snapshot.
> Data contoh: `db_ptrj_mill`, `AccYear = 2027`, `AccMonth = 1`.
> Safety: field bebas seperti `Remark` dan `Description` disensor bila berisi catatan/nama internal.

## Tujuan Dokumentasi

Dokumentasi ini menjelaskan modul Inventory dari sisi Report Center:

1. Tabel mana yang mewakili transaksi realtime.
2. Tabel mana yang mewakili jurnal month-end.
3. Tabel mana yang mewakili snapshot/saldo akhir.
4. Arti setiap field penting.
5. Makna `Amount` di setiap tabel.
6. Case bisnis yang sering bikin salah baca angka.
7. Query audit antar tabel.

## File

| File | Isi |
|---|---|
| `01_DATA_MODEL.md` | mental model relasi inventory: realtime → journal → snapshot |
| `02_FIELD_DICTIONARY.md` | definisi field lengkap untuk `IN_STOCKISSUE`, `IN_STOCKISSUELN`, `IN_MTHENDTRX`, `IN_MTHENDITEM` |
| `03_BUSINESS_CASES.md` | case bisnis: barang dipakai, jurnal debit/credit, snapshot closing, Amount |
| `04_AUDIT_MONTHEND_REALTIME_2027_01.md` | audit real periode 2027-1: SQL, hasil, interpretasi |

## Tabel Core Inventory Yang Dibahas

| Table | Peran | Grain |
|---|---|---|
| `IN_STOCKISSUE` | Header transaksi barang keluar | 1 row = 1 dokumen issue |
| `IN_STOCKISSUELN` | Detail barang keluar | 1 row = 1 item dalam dokumen issue |
| `IN_MTHENDTRX` | Jurnal month-end inventory | 1 line issue = 2 row jurnal debit/credit |
| `IN_MTHENDITEM` | Snapshot stok akhir bulan | 1 row = 1 item + lokasi + periode |

## Kesimpulan Paling Penting

```text
IN_STOCKISSUELN.Amount = nilai uang barang yang dipakai/keluar.
IN_MTHENDTRX.Amount    = nilai jurnal dari transaksi itu, muncul + dan -.
IN_MTHENDITEM.Amount   = valuasi stok tersisa pada akhir bulan.
```

Contoh konsep:

```text
Barang A nilai stok awal: 10 juta
Dipakai periode ini:      6 juta
Sisa akhir bulan:         4 juta

IN_STOCKISSUELN.Amount = 6 juta
IN_MTHENDTRX.Amount    = +6 juta dan -6 juta
IN_MTHENDITEM.Amount   = 4 juta
```

Tapi angka sisa tidak selalu `awal - issue` saja, karena closing juga dipengaruhi receive, transfer, adjustment, return, fuel/workshop movement, dan koreksi lain.
