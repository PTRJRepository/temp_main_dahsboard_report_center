// shared/google-image-search/index.js
// Google Image Search helper — cari gambar di Google lalu kembalikan alamat
// (URL) gambarnya, siap dipakai sebagai tool call oleh agen.
//
// DUA MODE:
//   1) "api"    — Google Programmable Search JSON API (stabil, resmi, butuh
//                 env GOOGLE_API_KEY + GOOGLE_CSE_ID; kuota gratis 100/hari).
//   2) "scrape" — ambil halaman hasil Google Images dan ekstrak URL gambar
//                 dari data tertanam (TANPA API KEY / gratis). Rapuh bila
//                 Google mengubah struktur halaman; gunakan secara wajar.
//   mode "auto" (default): pakai "api" bila kredensial lengkap, selain itu
//   otomatis jatuh ke "scrape".
//
// Kredensial dibaca dari environment — TIDAK pernah di-hardcode (aturan repo).
//
// Pemakaian cepat:
//   import { searchGoogleImages } from '../shared/google-image-search/index.js';
//   const res = await searchGoogleImages('traktor sawit', { count: 5 });            // auto
//   const res2 = await searchGoogleImages('traktor sawit', { mode: 'scrape' });     // paksa scraping
//
// Sebagai tool call agent (contoh skema):
//   {
//     "name": "google_image_search",
//     "description": "Cari gambar di Google dan kembalikan URL gambarnya",
//     "parameters": {
//       "type": "object",
//       "properties": {
//         "query": { "type": "string", "description": "kata kunci pencarian" },
//         "count": { "type": "integer", "description": "jumlah hasil 1-10 (api) / hingga 20 (scrape)", "default": 5 },
//         "safe":  { "type": "boolean", "description": "safe search on/off", "default": true },
//         "mode":  { "type": "string", "description": "auto | api | scrape", "default": "auto" },
//         "imgSize": { "type": "string", "description": "(api saja) icon|small|medium|large|xlarge|xxlarge|huge" },
//         "imgType": { "type": "string", "description": "(api saja) photo|clipart|lineart|face|stock|animated" }
//       },
//       "required": ["query"]
//     }
//   }

import {
  extractImagesFromHtml,
  extractImagesFromBing,
  enrichResults,
} from './extract.js';

const API_ENDPOINT = 'https://www.googleapis.com/customsearch/v1';
const SCRAPER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

/** Ambil kredensial dari env (mendukung beberapa nama varian). */
function getCredentials(overrides = {}) {
  const apiKey =
    overrides.apiKey ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_SEARCH_API_KEY ||
    '';
  const cseId =
    overrides.cseId ||
    process.env.GOOGLE_CSE_ID ||
    process.env.GOOGLE_CX ||
    process.env.NEXT_PUBLIC_GOOGLE_CSE_ID ||
    '';
  return { apiKey, cseId };
}

function hasApiCredentials(creds) {
  return Boolean(creds && creds.apiKey && creds.cseId);
}

/** Validasi & normalisasi opsi pencarian. */
function normalizeOptions(query, opts = {}) {
  const q = String(query ?? '').trim();
  if (!q) throw new Error('query kosong - tulis kata kunci pencarian gambar');
  if (q.length > 380) throw new Error('query terlalu panjang (maks ~380 karakter)');

  const requested = Math.min(Math.max(Number(opts.count ?? 5), 1), 20);
  const modeRaw = String(opts.mode ?? 'auto').toLowerCase();
  const mode = ['auto', 'api', 'scrape', 'browser'].includes(modeRaw) ? modeRaw : 'auto';
  const safe = opts.safe === false ? 'off' : 'active';

  const allowedSize = new Set(['', 'icon', 'small', 'medium', 'large', 'xlarge', 'xxlarge', 'huge']);
  const imgSize = allowedSize.has(String(opts.imgSize ?? '')) ? String(opts.imgSize ?? '') : '';

  const allowedType = new Set(['', 'photo', 'clipart', 'lineart', 'face', 'stock', 'animated']);
  const imgType = allowedType.has(String(opts.imgType ?? '')) ? String(opts.imgType ?? '') : '';

  let start = Number(opts.start ?? 1);
  if (!Number.isFinite(start) || start < 1) start = 1;
  start = Math.min(Math.round(start), 91);

  return { q, count: requested, mode, safe, imgSize, imgType, start };
}

/* ------------------------------------------------------------------ */
/* MODE API (Custom Search JSON API)                                   */
/* ------------------------------------------------------------------ */

async function callCseApi({ apiKey, cseId }, norm, countForApi) {
  const url = new URL(API_ENDPOINT);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('cx', cseId);
  url.searchParams.set('q', norm.q);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', String(countForApi));
  url.searchParams.set('safe', norm.safe);
  url.searchParams.set('start', String(norm.start));
  if (norm.imgSize) url.searchParams.set('imgSize', norm.imgSize);
  if (norm.imgType) url.searchParams.set('imgType', norm.imgType);

  const resp = await fetch(url, { headers: { Accept: 'application/json' } });

  if (!resp.ok) {
    let detail = '';
    try {
      const body = await resp.json();
      detail = body?.error?.message || '';
    } catch { /* abaikan body tak terbaca */ }
    if (resp.status === 403 && /quota/i.test(detail)) {
      throw new Error('Kuota Google CSE habis (403 quota exceeded). Coba lagi nanti atau naikkan kuota.');
    }
    if (resp.status === 400 && /API key not valid/i.test(detail)) {
      throw new Error('GOOGLE_API_KEY tidak valid. Periksa env GOOGLE_API_KEY.');
    }
    throw new Error(`Google CSE error ${resp.status}: ${detail || resp.statusText}`);
  }

  return resp.json();
}

function mapItems(apiResponse) {
  const items = Array.isArray(apiResponse?.items) ? apiResponse.items : [];
  return items.map((it) => ({
    title: it.title || '',
    imageUrl: it.link || '',
    thumbnailUrl: it.image?.thumbnailLink || '',
    pageUrl: it.image?.contextLink || '',
    source: it.displayLink || '',
    width: it.image?.width || null,
    height: it.image?.height || null,
    mimeType: it.mime || null,
    snippet: it.snippet || '',
  }));
}

/* ------------------------------------------------------------------ */
/* MODE SCRAPE (tanpa API key)                                         */
/* ------------------------------------------------------------------ */

/** Dekode escape \uXXXX yang ditanam Google pada URL di dalam skripnya. */
function unescapeGoogleString(s) {
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
  } catch {
    return s;
  }
}

function looksLikeImageUrl(u) {
  if (!u || !/^https?:\/\//i.test(u)) return false;
  if (/\.gstatic\.com\/images\?|google\.com\/(images|imgres)|gstatic\.com\/favicon|\.bing\.net\/th\?/i.test(u)) return false;
  return Boolean(
    /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(u) ||
    /(image|photo|media|img|gambar)/i.test(u) ||
    true
  );
}

/** Dekode HTML-entity &amp; di dalam JSON escaped (gaya Bing: &quot;). */
function decodeHtmlEntities(s) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

/**
 * Ekstraksi multi-strategi dari HTML hasil Google Images.
 * S1: tuple ["https://...",w,h] di dalam AF_initDataCallback (struktur terkini).
 * S2: link imgres?imgurl=<encoded> (varian html dasar).
 * S3: kunci JSON lama "ou":"<url>".
 */
function extractImagesFromHtml_Local() {} // tempat lama; implementasi pindah ke ./extract.js

async function scrapeBingImages(norm) {
  const url = new URL('https://www.bing.com/images/search');
  url.searchParams.set('q', norm.q);
  url.searchParams.set('form', 'HDRSC2');
  url.searchParams.set('first', '1');
  const resp = await fetch(url, {
    headers: {
      'User-Agent': SCRAPER_UA,
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`Bing Images HTTP ${resp.status}`);
  const html = await resp.text();
  let results = extractImagesFromBing(html);
  if (results.length === 0) return results;
  results = results.slice(0, Math.min(norm.count, 20));
  return { query: norm.q, totalResults: null, mode: 'scrape', engine: 'bing', results };
}

async function scrapeGoogleImages(norm) {
  // udm=2 adalah parameter terbaru Google Images; tbm=isch disertakan sebagai fallback
  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', norm.q);
  url.searchParams.set('udm', '2');
  url.searchParams.set('tbm', 'isch');
  url.searchParams.set('hl', 'id');
  url.searchParams.set('gl', 'ID');
  url.searchParams.set('safe', norm.safe);
  url.searchParams.set('num', String(Math.max(norm.count, 10)));

  const resp = await fetch(url, {
    headers: {
      'User-Agent': SCRAPER_UA,
      'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
      Cookie: 'CONSENT=YES+cb.20240101-01-p0.id+FX+000; SOCS=CAESEwgDEgk2NzM5OTg2MDUaAmVuIAEaBgiA_LyaBg',
    },
    redirect: 'follow',
  });

  if (!resp.ok) {
    throw new Error(
      `Scrape Google Images gagal: HTTP ${resp.status}. ` +
      `Kemungkinan diminta verifikasi/consent — coba lagi nanti atau sediakan env GOOGLE_API_KEY+GOOGLE_CSE_ID untuk mode API.`
    );
  }

  const html = await resp.text();
  let results = extractImagesFromHtml(html);
  if (results.length === 0) {
    throw new Error(
      'Scrape Google Images: 0 gambar terekstrak. Kemungkinan Google mengubah struktur halaman ' +
      '(atau menampilkan halaman JS-only). Mode API tetap tersedia via env GOOGLE_API_KEY+GOOGLE_CSE_ID.'
    );
  }

  results = results.slice(0, Math.min(norm.count, 20));

  for (const r of results) {
    if (!r.source) r.source = (() => { try { return new URL(r.imageUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    if (!r.pageUrl) r.pageUrl = 'https://www.google.com/search?q=' + encodeURIComponent(norm.q) + '&udm=2';
    if (!r.title) {
      try {
        const base = decodeURIComponent(new URL(r.imageUrl).pathname.split('/').pop() || '');
        r.title = base.slice(0, 80);
      } catch { r.title = ''; }
    }
  }

  return { query: norm.q, totalResults: null, mode: 'scrape', engine: 'google', results };
}

/* ------------------------------------------------------------------ */
/* Fasad utama                                                         */
/* ------------------------------------------------------------------ */

/**
 * Tool utama: cari gambar di Google, dapatkan alamat gambarnya.
 *
 * @param {string} query  Kata kunci pencarian.
 * @param {object} [opts]
 * @param {'auto'|'api'|'scrape'} [opts.mode='auto']  auto = API bila env lengkap, else scrape.
 * @param {number}  [opts.count=5]    Jumlah hasil (1-10 api; hingga 20 scrape).
 * @param {boolean} [opts.safe=true] SafeSearch aktif.
 * @param {string}  [opts.imgSize]   (api) icon|small|medium|large|xlarge|xxlarge|huge
 * @param {string}  [opts.imgType]   (api) photo|clipart|lineart|face|stock|animated
 * @param {number}  [opts.start=1]   Offset (api <=91; scrape abaikan).
 * @param {string}  [opts.apiKey]    Override env GOOGLE_API_KEY.
 * @param {string}  [opts.cseId]     Override env GOOGLE_CSE_ID.
 * @returns {Promise<{query:string,totalResults:string|null,mode:string,results:Array}>}
 */
export async function searchGoogleImages(query, opts = {}) {
  const norm = normalizeOptions(query, opts);
  const creds = getCredentials(opts);

  // mode browser: render Google Images asli (puppeteer-core + Chrome/Edge sistem)
  if (norm.mode === 'browser') {
    const { browserGoogleImages } = await import('./browser.js');
    return browserGoogleImages(norm, opts);
  }

  const useApi = norm.mode === 'api' || (norm.mode === 'auto' && hasApiCredentials(creds));

  if (useApi) {
    if (!hasApiCredentials(creds)) {
      throw new Error(
        'mode "api" dipilih tapi kredensial belum lengkap. Set GOOGLE_API_KEY + GOOGLE_CSE_ID ' +
        '(atau pakai mode "auto"/"scrape").'
      );
    }
    const countForApi = Math.min(norm.count, 10); // batas keras CSE
    const data = await callCseApi(creds, norm, countForApi);
    return { query: norm.q, totalResults: data?.searchInformation?.totalResults || null, mode: 'api', results: mapItems(data) };
  }

  // scrape berlapis: Google Images dulu (best-effort), kalau 0 gambar -> Bing Images (solid).
  let googleResults = [];
  try {
    const googleAttempt = await scrapeGoogleImages(norm);
    googleResults = googleAttempt.results || [];
  } catch (e) {
    // engsel Google gagal (JS-only/consent) — lanjut ke Bing, jangan mati di sini
  }
  if (googleResults.length > 0) {
    return { query: norm.q, totalResults: null, mode: 'scrape', engine: 'google', results: googleResults };
  }

  const bingAttempt = await scrapeBingImages(norm);
  if (bingAttempt.results.length > 0) return { query: norm.q, totalResults: null, mode: 'scrape', engine: 'bing', results: bingAttempt.results };

  // bing juga nihil -> coba driver browser (bila tersedia)
  try {
    const { browserGoogleImages } = await import('./browser.js');
    return await browserGoogleImages(norm, opts);
  } catch (e) {
    if (/puppeteer-core tidak ditemukan|Chrome\/Edge tidak terdeteksi/.test(e.message)) {
      return { query: norm.q, totalResults: null, mode: 'scrape', engine: 'none', results: [] };
    }
    throw e;
  }
}

/**
 * Varian ringkas untuk agen: hanya array URL gambar.
 * @example const urls = await googleImageUrls('alat panen sawit', { count: 3 });
 */
export async function googleImageUrls(query, opts = {}) {
  const res = await searchGoogleImages(query, opts);
  return res.results.filter((r) => r.imageUrl).map((r) => r.imageUrl);
}

/** Definisi tool-call standar (untuk didaftarkan ke agen yang mendukung tools). */
export const googleImageSearchToolDefinition = {
  name: 'google_image_search',
  description:
    'Cari gambar di Google dan kembalikan daftar alamat (URL) gambarnya beserta judul, sumber, dan ukuran. ' +
    'Tanpa API key pun bisa (mode scraping otomatis); dengan env GOOGLE_API_KEY+GOOGLE_CSE_ID memakai API resmi.',
  parameters: {
    type: 'object',
    properties: {
      query:   { type: 'string',  description: 'Kata kunci pencarian gambar' },
      count:   { type: 'integer', description: 'Jumlah hasil: 1-10 (api) / hingga 20 (scrape)', default: 5 },
      safe:    { type: 'boolean', description: 'SafeSearch aktif', default: true },
      mode:    { type: 'string',  description: 'auto | api | scrape | browser', default: 'auto' },
      imgSize: { type: 'string',  description: '(api saja) icon|small|medium|large|xlarge|xxlarge|huge' },
      imgType: { type: 'string',  description: '(api saja) photo|clipart|lineart|face|stock|animated' },
    },
    required: ['query'],
  },
};

/** Handler generik agar bisa diregistrasi langsung sebagai tool executor. */
export async function executeGoogleImageSearchTool(args = {}) {
  return searchGoogleImages(args.query, args);
}

export default {
  searchGoogleImages,
  googleImageUrls,
  googleImageSearchToolDefinition,
  executeGoogleImageSearchTool,
};
