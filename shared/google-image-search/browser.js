// shared/google-image-search/browser.js
// MODE BROWSER — render Google Images sungguhan dengan browser headless
// memakai chrome/edge yang SUDAH terpasang di sistem (tanpa unduh Chromium).
//
// Driver: puppeteer-core (~3MB, tanpa browser bawaan). Install sekali:
//   npm i -D puppeteer-core        (di root repo / mesin yang menjalankan)
//
// Deteksi executable: opsi.puppeteerModulePath > env.PUPPETEER_MODULE_PATH >
// env.GOOGLE_IMAGE_BROWSER_PATH > Chrome 'C:\Program Files\Google\...' >
// Edge 'C:\Program Files (x86)\Microsoft\Edge\...' > fallback OS umum.
//
// Zero-dependency hard: modul ini hanya dimuat ketika mode 'browser'
// diminta (lazy dynamic import dari index.js).

import { createRequire } from 'node:module';
import { extractImagesFromHtml, enrichResults } from './extract.js';

const require = createRequire(import.meta.url);
const fs = require('node:fs');

const DEFAULT_TIMEOUT_MS = 25_000;

let cachedModulePath = null;

/** Temukan modul puppeteer-core (require resolvable / path eksplisit). */
function resolvePuppeteerModule() {
  if (cachedModulePath) return cachedModulePath;
  const candidates = [
    process.env.PUPPETEER_MODULE_PATH,
    'puppeteer-core',
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      // eslint-disable-next-line import/no-unresolved, global-require
      return require(c);
    } catch { /* lanjut kandidat berikut */ }
  }
  throw new Error(
    'puppeteer-core tidak ditemukan. Install sekali: npm i -D puppeteer-core ' +
    '(atau set PUPPETEER_MODULE_PATH ke folder node_modules yang memilikinya).'
  );
}

/** Daftar jalur executable browser sistem (Windows dulu, lalu umum). */
function detectBrowserExecutable() {
  const envPath = process.env.GOOGLE_IMAGE_BROWSER_PATH;
  if (envPath) return envPath;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch { /* lanjut */ }
  }
  throw new Error(
    'Chrome/Edge tidak terdeteksi di sistem. Set GOOGLE_IMAGE_BROWSER_PATH ke path executable browser.'
  );
}

/**
 * Cari gambar via browser headless — hasil dari GOOGLE IMAGES asli.
 *
 * @param {object} norm  Hasil normalizeOptions (q, count, safe, ...).
 * @param {object} [opts]  { executablePath, headless, timeoutMs }
 * @returns {Promise<{query,totalResults,mode,engine,results}>}
 */
export async function browserGoogleImages(norm, opts = {}) {
  const puppeteer = resolvePuppeteerModule();
  const executablePath = opts.executablePath || process.env.GOOGLE_IMAGE_BROWSER_PATH || detectBrowserExecutable();
  const timeoutMs = Number(opts.timeoutMs || process.env.GOOGLE_IMAGE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  const url = new URL('https://www.google.com/search');
  url.searchParams.set('q', norm.q);
  url.searchParams.set('tbm', 'isch'); // halaman Images interaktif (JS ter-render di browser)
  url.searchParams.set('hl', 'id');
  url.searchParams.set('gl', 'ID');
  url.searchParams.set('safe', norm.safe);

  let browser;
  try {
    browser = await puppeteer.launch({
      executablePath,
      headless: opts.headless === false ? false : 'new',
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
    );
    // minimalisasi tanda otomasi (webdriver, AutomationControlled)
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', { get: () => ['id-ID', 'id', 'en-US', 'en'] });
    });

    await page.goto(url, { waitUntil: 'networkidle2', timeout: timeoutMs });

    const finalUrl = page.url();
    if (/\/sorry\/|\/sorry\?/i.test(finalUrl) || /captcha/i.test(finalUrl)) {
      throw new Error(
        'Google memblokir akses ini (CAPTCHA / halaman "sorry"). Ini kebijakan anti-bot Google terhadap ' +
        'IP/headless, bukan kesalahan kode. Solusi: jalankan dari jaringan/IP lain, atau sediakan ' +
        'env GOOGLE_API_KEY+GOOGLE_CSE_ID untuk mode api.'
      );
    }

    // tunggu minimal satu gambar hasil render (fallback: sleep singkat)
    try {
      await page.waitForSelector('img[src^="http"]', { timeout: 8_000 });
    } catch { /* biarkan — tetap ekstrak dari HTML apa adanya */ }

    const html = await page.evaluate(() => document.documentElement.outerHTML);

    let results = extractImagesFromHtml(html);
    if (results.length === 0) {
      // strategi cadangan: baca src img yang sudah ter-render langsung
      const imgs = await page.evaluate(() =>
        [...document.querySelectorAll('img')]
          .map((i) => i.currentSrc || i.src || '')
          .filter((s) => /^https?:\/\//.test(s))
      );
      results = extractImagesFromHtml(`<html>${imgs.map((s) => `<img src="${s}">`).join('')}</html>`);
    }
    if (results.length === 0) {
      throw new Error(
        'Browser render selesai tapi 0 gambar terekstrak dari Google Images. ' +
        'Coba GOOGLE_IMAGE_BROWSER_PATH ke browser lain, atau mode scrape/api.'
      );
    }

    results = results.slice(0, Math.min(Math.max(norm.count, 1), 20));
    enrichResults(results, 'https://www.google.com/imghp');

    return {
      query: norm.q,
      totalResults: null,
      mode: 'browser',
      engine: 'google',
      results,
    };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export default browserGoogleImages;
