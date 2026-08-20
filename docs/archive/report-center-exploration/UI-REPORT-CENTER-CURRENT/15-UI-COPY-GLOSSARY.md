# 15 — UI Copy Glossary (ID)

Salinan label yang **sebaiknya konsisten** di deck, overview, detail.

| Konsep | Copy UI disarankan | Hindari |
|--------|-------------------|---------|
| Full stock value | Total valuasi inventory | “Gudang only” untuk master |
| ItemType 1+4 | Inventory 1+4 / Gudang + Workshop | “All items” ambigu |
| Period calendar | Periode usage/receive | “Period” saja jika ada MC window |
| Movement aging window | Jendela aging movement | “Movement” = usage |
| Net flow | Arus bersih periode | “Profit” |
| Issue usage | Total usage (issue) / Pemakaian | “Sales” |
| Issue events | Event line (baris) | “Transaksi” tanpa definisi |
| Issue documents | Dokumen issue | |
| AccCode on issue | Pusat biaya / Dept / Cost center | **GL Account** |
| VehCode | Kendaraan (line) | |
| Goods receive | Nilai goods receive / Penerimaan | |
| PR/PO outstanding | PR/PO outstanding | “Hutang” (beda konteks) |
| Dead/Slow/Stale | Slow / Dead / Stale (movement) | “Expired” (beda report hold) |
| Live badge | Live dari SQL Gateway | “Realtime WS” palsu |
| Partial | Live sebagian, fallback aktif | Sembunyikan error total |
| Top usage | Top item usage periode | “Best seller” |
| Monthly actual vs accounting | Actual · Accounting | Satu label “period” saja |
| Export PDF | Pratinjau PDF | “Export penuh” |
| AI sample | Sampel AI | “Analisis full DB” |

## Microcopy patterns

- Eyebrow: `text-[10px] font-black uppercase tracking-[0.2em+]`
- Helper: 1 kalimat max, muted
- Source footer: report id singkat + arrow
- Empty top items: strip disembunyikan (`length > 0`) — pertimbangkan empty state eksplisit nanti

## Bilingual

Glossary ID/EN lebih lengkap:  
`Dokumentasi/REPORT_CENTER_PRODUCT_GLOSSARY_ID_EN_2026-07-21.md`

---

**Next:** `16-QA-CHECKLIST-UI.md`
