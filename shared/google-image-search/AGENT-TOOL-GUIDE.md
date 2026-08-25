# AGENT TOOL CALL GUIDE — google_image_search

Panduan lengkap bagaimana **agen** (Claude/Droid/pemanggil tool apa pun)
menggunakan tool-call `google_image_search` dari `shared/google-image-search/`.

Tujuan tool: **cari gambar di Google dan dapatkan alamat (URL) gambarnya** untuk
dipakai lebih lanjut (embed, unduh, lampirkan ke dokumen/laporan, dsb).

---

## 1. Ringkasan cepat

| Item | Nilai |
|---|---|
| Nama tool | `google_image_search` |
| Lokasi | `shared/google-image-search/index.js` |
| Dependensi wajib | nol — jalan di Bun ≥1.0 & Node ≥18 (fetch global) |
| Dependensi opsional | `puppeteer-core` (hanya untuk mode `browser`) |
| API key | opsional (`GOOGLE_API_KEY` + `GOOGLE_CSE_ID`) |
| Biaya tanpa key | gratis (mode scrape/browser) |
| Hasil | `{ query, totalResults, mode, engine, results[] }` — tiap item berisi `imageUrl` |

---

## 2. Skema tool (JSON-Schema — salin langsung ke daftar tool agen)

```json
{
  "name": "google_image_search",
  "description": "Cari gambar di Google dan kembalikan daftar alamat (URL) gambarnya beserta judul, sumber, dan ukuran. Tanpa API key pun bisa (mode scraping otomatis); dengan env GOOGLE_API_KEY+GOOGLE_CSE_ID memakai API resmi.",
  "parameters": {
    "type": "object",
    "properties": {
      "query":   { "type": "string",  "description": "Kata kunci pencarian gambar (wajib)" },
      "count":   { "type": "integer", "description": "Jumlah hasil: 1-10 (api) / hingga 20 (scrape/browser)", "default": 5 },
      "safe":    { "type": "boolean", "description": "SafeSearch aktif", "default": true },
      "mode":    { "type": "string",  "description": "auto | api | scrape | browser", "default": "auto" },
      "imgSize": { "type": "string",  "description": "(api saja) icon|small|medium|large|xlarge|xxlarge|huge" },
      "imgType": { "type": "string",  "description": "(api saja) photo|clipart|lineart|face|stock|animated" }
    },
    "required": ["query"]
  }
}
```

> Skema yang sama tersedia sebagai objek siap pakai:
> `googleImageSearchToolDefinition` (ekspor dari `index.js`).

---

## 3. Cara agen memanggil (4 cara)

### 3.1 Registrasi + eksekusi (pola paling umum)

```js
import {
  googleImageSearchToolDefinition,
  executeGoogleImageSearchTool,
} from '../shared/google-image-search/index.js';

// 1. daftarkan ke runtime agen Anda (contoh ringkas):
const agentTools = [googleImageSearchToolDefinition];

// 2. pada saat agen memutuskan memanggil tool:
const hasil = await executeGoogleImageSearchTool({ query: 'alat panen kelapa sawit', count: 5 });
```

### 3.2 Pemanggilan fungsi langsung

```js
import { searchGoogleImages, googleImageUrls } from '../shared/google-image-search/index.js';

const res = await searchGoogleImages('kebun sawit aerial', { count: 4 });
const urls = await googleImageUrls('kebun sawit aerial', { count: 4 }); // hanya array URL
```

### 3.3 Dari route handler gateway/modul (Bun — pola repo ini)

```js
// server_bun.js atau modul mana pun
import { executeGoogleImageSearchTool } from './shared/google-image-search/index.js';

Bun.serve({
  async fetch(req) {
    if (new URL(req.url).pathname === '/api/tool/image-search') {
      const body = await req.json();
      const out = await executeGoogleImageSearchTool(body); // body = { query, ... }
      return Response.json(out);
    }
  },
});
```

### 3.4 Dari route handler Next.js / Express / Fastify

```js
// app/api/image-search/route.ts (Next.js App Router)
import { NextResponse } from 'next/server';
import { executeGoogleImageSearchTool } from '@modules/...'; // sesuaikan path ke shared

export async function POST(req: Request) {
  const body = await req.json();
  try {
    const out = await executeGoogleImageSearchTool(body);
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
```

---

## 4. Contoh hasil & bagaimana membaca `engine`

```jsonc
{
  "query": "alat panen kelapa sawit",
  "totalResults": null,
  "mode": "browser",
  "engine": "google",          // google | bing | none (lihat §5)
  "results": [
    {
      "title": "Egrek Panen Sawit...",
      "imageUrl": "https://cms.gokomodo.com/wp-content/uploads/2023/09/...jpg",
      "thumbnailUrl": "https://encrypted-tbn0.gstatic.com/images?q=...",
      "pageUrl": "https://.../artikel",
      "source": "cms.gokomodo.com",
      "width": 768,
      "height": 1024,
      "mimeType": null,
      "snippet": ""
    }
  ]
}
```

Panduan membaca:
- `engine: 'google'` → hasil asli Google Images (mode api/browser, atau scrape yang kebetulan tembus).
- `engine: 'bing'` → fallback Bing (masih URL gambar asli; capaian ketika Google menutup akses).
- `engine: 'none'` → tidak ada hasil dari semua jalur; coba kata kunci lain atau mode lain.
- `results[].imageUrl` = **alamat gambar asli** yang bisa langsung di-embed/diunduh.
- `results[].thumbnailUrl` = gambar kecil (cepat dimuat, cocok untuk grid/preview).

---

## 5. Kapan memilih `mode` apa (keputusan agen)

| Situasi | mode yang disarankan |
|---|---|
| Default / tidak tahu | `auto` — pakai api bila env lengkap, selain itu scrape |
| Butuh kualitas & akurasi hasil Google asli | `browser` (butuh `puppeteer-core` + Chrome/Edge di sistem) |
| Lingkungan tanpa browser & tanpa API key | `scrape` |
| Produksi / legal / volume besar | `api` (isi env `GOOGLE_API_KEY` + `GOOGLE_CSE_ID`) |
| Ingin menghindari CAPTCHA & ToS scraping | `api` |
| Butuh paginasi / filter ukuran-jenis | `api` (`start`, `imgSize`, `imgType`) |

Aturan praktis untuk agen:
1. **Jangan pernah** memanggil dengan `count > 10` pada mode `api` (API membatasi; helper otomatis memotong).
2. **Jangan** memanggil `mode: 'browser'` berulang-ulang dalam loop — berat (buat browser per panggilan); batch query dalam satu panggilan bila perlu.
3. Bila `results` kosong atau `engine: 'none'`, **coba kata kunci berbeda** atau naikkan `count`, jangan langsung menyalahkan tool.
4. Konten yang dipakai akhir (embed/download) memakai `imageUrl`; untuk preview cepat pakai `thumbnailUrl`.
5. Hormati sumber: jangan merehost/memperjualbelikan gambar orang lain tanpa izin (lihat §7).

---

## 6. Konfigurasi environment

```env
# --- Opsional: API resmi (mode api/auto) ---
GOOGLE_API_KEY=<API key dari console.cloud.google.com>   # aktifkan Custom Search API
GOOGLE_CSE_ID=<ID Programmable Search Engine>            # mode image + search entire web

# --- Opsional: mode browser ---
PUPPETEER_MODULE_PATH=<path ke node_modules berisi puppeteer-core>  # bila tidak di root
GOOGLE_IMAGE_BROWSER_PATH=<path chrome.exe/msedge.exe>   # bila deteksi otomatis gagal
GOOGLE_IMAGE_TIMEOUT_MS=25000                            # timeout halaman (ms)
```

Tanpa env apa pun: `auto` memakai scrape (gratis, tanpa key — langsung jalan).
API key bisa juga di-override per panggilan: `{ apiKey, cseId }`.

---

## 7. Etika & batasan

- **ToS**: scraping mesin pencari bisa melanggar ToS penyedia; mode `api` adalah jalur resmi yang disarankan untuk volume besar.
- **CAPTCHA**: Google terkadang menampilkan halaman "sorry" untuk akses headless — `browser.js` melempar error yang menjelaskan hal ini (bukan gagal diam-diam).
- **Hak cipta**: gunakan gambar hasil sesuai aturan sumber & lisensi; manfaatkan `title`/`source` untuk atribusi.
- **Rate**: hindari panggilan berulang dalam waktu singkat (jaring pelindung mesin pencari).

---

## 8. Troubleshooting ringkas

| Gejala | Penyebab | Solusi |
|---|---|---|
| `GOOGLE_API_KEY belum diset` | mode `api` tanpa env | isi env, atau pakai `mode:'scrape'`/`auto` |
| `0 gambar terekstrak` (scrape) | Google menutup HTML | otomatis jatuh ke Bing; bila tetap kosong pakai `browser` |
| `Google memblokir akses ini (CAPTCHA)` | halaman `sorry` dari IP ini | jalankan dari IP lain, atau mode `api` |
| `puppeteer-core tidak ditemukan` | mode `browser` tanpa driver | `npm install` (terdaftar optionalDependencies) atau set `PUPPETEER_MODULE_PATH` |
| `Chrome/Edge tidak terdeteksi` | executable tak ditemukan | set `GOOGLE_IMAGE_BROWSER_PATH` |
| hasil terasa "kurang relevan" | kata kunci terlalu umum | perjelas kata kunci, atau tambahkan `imgType:'photo'` (api) |
