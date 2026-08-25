# shared/google-image-search

Helper pencarian gambar Google untuk tool-call agen — **bisa tanpa API key**.

## Mode

| Mode | Sumber | Kredensial | Keterangan |
|---|---|---|---|
| `api` | Google Custom Search JSON API (resmi) | `GOOGLE_API_KEY` + `GOOGLE_CSE_ID` | Stabil, kuota gratis 100/hari, paginasi, filter ukuran/jenis |
| `scrape` | Google Images HTML (best-effort) → **Bing Images** (fallback solid) | tidak ada | Gratis, tanpa batas kuota; Google kini JS-only bagi fetch server, Bing yang menyuplai hasil |
| `browser` | **Google Images asli** via driver browser ringan (`puppeteer-core` + Chrome/Edge sistem) | tidak ada | Hasil paling akurat karena hasil sungguhan Google; butuh puppeteer-core terpasang + satu browser sistem |
| `auto` (default) | API bila env lengkap, selain itu scrape | — | Mode yang disarankan: makin lengkap konfigurasi, makin baik hasilnya |

## Mode browser (driver ringan — modular & opsional)

Tidak mengunduh Chromium (~300MB) — memakai Chrome/Edge yang SUDAH ada di sistem
melalui `puppeteer-core` (~3MB saja). Terdaftar sebagai **`optionalDependencies`**
di `package.json` root sehingga tetap terpasang otomatis saat npm dijalankan,
tapi TIDAK memblokir instalasi maupun runtime bila gagal/gagal terpasang —
modul ini di-load **lazy** hanya saat `mode: 'browser'` dipanggil. Jalur
`auto`/`scrape`/`api` tidak membutuhkannya sama sekali.

```bash
npm install      # otomatis mencoba memasang puppeteer-core; gagal pun tidak menghentikan
```

```js
const res = await searchGoogleImages('traktor sawit', { mode: 'browser' });
// res.engine === 'google' — hasil asli dari Google Images
```

Penyesuaian yang didukung: `GOOGLE_IMAGE_BROWSER_PATH` (path executable browser),
`PUPPETEER_MODULE_PATH` (bila puppeteer-core berada di node_modules lain),
`GOOGLE_IMAGE_TIMEOUT_MS`. Mode ini memasang stealth ringan (webdriver dimatikan,
flag anti-deteksi), tapi Google tetap bisa menampilkan halaman CAPTCHA dari
jaringan tertentu — saat itu helper melempar error jelas "diblokir anti-bot",
bukan diam-diam gagal. Dari jaringan tempat repo ini dikembangkan, mode ini
terverifikasi berhasil.

Catatan: mode `auto` sengaja TIDAK memakai browser (bobot & latensi);
panggil `mode: 'browser'` secara eksplisit bila ingin hasil Google asli.

## Fungsi

| Ekspor | Kegunaan |
|---|---|
| `searchGoogleImages(query, opts?)` | Cari gambar → `{ query, totalResults, mode, engine, results[] }` (judul, **imageUrl**, thumbnail, halaman sumber, dimensi, mime) |
| `googleImageUrls(query, opts?)` | Varian ringkas: hanya array URL gambar |
| `googleImageSearchToolDefinition` | Skema tool JSON-Schema untuk didaftarkan ke agen |
| `executeGoogleImageSearchTool(args)` | Handler langsung untuk tool executor (terima `{query, count, safe, mode, imgSize, imgType}`) |

Contoh:

```js
import { searchGoogleImages, googleImageUrls, googleImageSearchToolDefinition } from '../shared/google-image-search/index.js';

const res = await searchGoogleImages('traktor sawit', { count: 5 });            // auto
const res2 = await searchGoogleImages('traktor sawit', { mode: 'scrape' });     // paksa scrape
const res3 = await searchGoogleImages('traktor sawit', { mode: 'browser' });    // Google asli (puppeteer-core)
const urls = await googleImageUrls('alat panen', { count: 3 });                 // ["https://...", ...]
```

Opsi: `count` 1-10 (api) / hingga 20 (scrape), `safe` (default aktif), `mode` (`auto|api|scrape`),
`imgSize`/`imgType` (api saja), `start` (api saja, offset ≤91).

## Konfigurasi API (opsional — hanya untuk mode api/auto)

```env
GOOGLE_API_KEY=<API key dari console.cloud.google.com>
GOOGLE_CSE_ID=<ID Programmable Search Engine>
```

- API key: Google Cloud Console → Credentials → API key (aktifkan *Custom Search API*).
- CSE: https://programmablesearchengine.google.com → engine dengan
  **"Search the entire web"** + **Image search** aktif.

Tanpa env: mode `auto` otomatis memakai scrape; mode `api` melempar error instruktif.

## Catatan penting tentang mode scrape (tanpa API key)

- Google Images saat ini menyajikan halaman **JavaScript-only** kepada permintaan
  server tanpa browser → ekstraksi dari HTML Google sering gagal. Helper mencoba
  Google lebih dulu, lalu otomatis memakai **Bing Images** yang masih menyertakan
  `murl` (URL gambar asli) di HTML-nya. Field `engine` pada respons memberi tahu
  hasil berasal dari mana.
- Scraping mesin pencari berisiko terhadap perubahan struktur halaman dan bisa
  bertentangan dengan ToS penyedia. Gunakan secara wajar dan hindari volume besar;
  untuk kebutuhan produksi/legal, sediakan env dan pakai mode `api`.
- DuckDuckGo Images tidak dipakai sebagai fallback: dari jaringan tertentu
  endpoint-nya sering diblokir (timeout).

## Registrasi sebagai tool agen

```js
import { googleImageSearchToolDefinition, executeGoogleImageSearchTool } from '../shared/google-image-search/index.js';

// 1. daftarkan toolDefinition ke pemanggil tool agen
// 2. saat dipanggil: const out = await executeGoogleImageSearchTool(args)
```

Zero-dependency (`fetch` global). Kompatibel Bun ≥1.0 dan Node ≥18.

> **Panduan lengkap untuk agen** (skema tool, contoh pemanggilan dari gateway/Next/Express,
> cara memilih mode, troubleshooting): lihat [`AGENT-TOOL-GUIDE.md`](./AGENT-TOOL-GUIDE.md).
