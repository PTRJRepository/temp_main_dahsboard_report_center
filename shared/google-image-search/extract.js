// shared/google-image-search/extract.js
// Mesin ekstraksi URL gambar dari HTML hasil mesin pencari.
// Dipakai bersama oleh index.js (scrape fetch polos) dan browser.js
// (render browser lalu ekstrak dari HTML yang sudah eksekusi JS).

/** Dekode escape \uXXXX yang ditanam Google pada URL di dalam skripnya. */
export function unescapeGoogleString(s) {
  try {
    return JSON.parse(`"${s.replace(/"/g, '\\"')}"`);
  } catch {
    return s;
  }
}

export function looksLikeImageUrl(u) {
  if (!u || !/^https?:\/\//i.test(u)) return false;
  if (/\.gstatic\.com\/images\?|google\.com\/(images|imgres)|gstatic\.com\/favicon|\.bing\.net\/th\?/i.test(u)) return false;
  return Boolean(
    /\.(jpe?g|png|gif|webp|bmp|avif)(\?|$)/i.test(u) ||
    /(image|photo|media|img|gambar)/i.test(u) ||
    true
  );
}

/** Dekode HTML-entity &amp; di dalam JSON escaped (gaya Bing: &quot;). */
export function decodeHtmlEntities(s) {
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
export function extractImagesFromHtml(html) {
  const found = new Map();

  const push = (rawUrl, w = null, h = null, thumb = '', title = '', pageUrl = '') => {
    let u = rawUrl;
    if (/\\u[0-9a-f]{4}/i.test(u)) u = unescapeGoogleString(u);
    u = u.trim();
    if (!looksLikeImageUrl(u)) return;
    const key = u.split('#')[0];
    if (found.has(key)) {
      const prev = found.get(key);
      if (!prev.width && w) { prev.width = Number(w) || null; prev.height = Number(h) || null; }
      if (!prev.thumbnailUrl && thumb) prev.thumbnailUrl = thumb;
      if (!prev.title && title) prev.title = title;
      if (!prev.pageUrl && pageUrl) prev.pageUrl = pageUrl;
      return;
    }
    found.set(key, {
      title: title || '',
      imageUrl: u,
      thumbnailUrl: thumb,
      pageUrl: pageUrl || '',
      source: (() => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      width: w ? Number(w) : null,
      height: h ? Number(h) : null,
      mimeType: null,
      snippet: '',
    });
  };

  // S1 — tuple URL,dimensi (paling umum di snapshot data Google Images)
  const s1 = /\["(https?:\\?\/\\?\/[^"\\\]]+?)",(\d{1,5}),(\d{1,5})\]/g;
  for (const m of html.matchAll(s1)) push(m[1], m[2], m[3]);

  // S2 — imgres?imgurl=
  const s2 = /imgres\?(?:[^"']*&)?imgurl=([^&"' ]+)/g;
  for (const m of html.matchAll(s2)) {
    let u = m[1];
    try { u = decodeURIComponent(u); } catch { /* biarkan apa adanya */ }
    push(u);
  }

  // S3 — JSON lama "ou":
  const s3 = /"ou":"(https?:[^"]+)"/g;
  for (const m of html.matchAll(s3)) push(m[2] ? m[2] : m[1]);

  const thumbs = [...html.matchAll(/"(https?:\/\/encrypted-tbn\d*\.gstatic\.com\/images\?[^"]+)"/g)].map((m) =>
    unescapeGoogleString(m[1])
  );
  let i = 0;
  for (const item of found.values()) {
    if (thumbs[i]) item.thumbnailUrl = thumbs[i];
    i++;
    if (i >= thumbs.length) break;
  }

  return [...found.values()];
}

/**
 * Bing Images — mesin cadangan yang masih mengirim data gambar di HTML
 * (atribut m="{JSON escaped}" pada <a class="iusc">). Tanpa API key.
 */
export function extractImagesFromBing(html) {
  const found = new Map();
  const attr = /m="((?:&quot;|[^"]){20,8000})"/g;
  for (const mm of html.matchAll(attr)) {
    let raw = decodeHtmlEntities(mm[1]);
    try { raw = JSON.parse(raw); } catch { continue; }
    if (!raw.murl || !/^https?:\/\//i.test(raw.murl)) continue;
    const key = raw.murl.split('#')[0];
    if (found.has(key)) continue;
    found.set(key, {
      title: raw.t || '',
      imageUrl: raw.murl,
      thumbnailUrl: raw.turl || '',
      pageUrl: raw.purl || '',
      source: (() => { try { return new URL(raw.murl).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      width: raw.mw ? Number(raw.mw) : null,
      height: raw.mh ? Number(raw.mh) : null,
      mimeType: null,
      snippet: '',
    });
  }
  return [...found.values()];
}

/** Isi metadata pelengkap yang belum terisi (source, pageUrl, title). */
export function enrichResults(results, fallbackPageUrl) {
  for (const r of results) {
    if (!r.source) {
      try { r.source = new URL(r.imageUrl).hostname.replace(/^www\./, ''); } catch { r.source = ''; }
    }
    if (!r.pageUrl) r.pageUrl = fallbackPageUrl || '';
    if (!r.title) {
      try {
        const base = decodeURIComponent(new URL(r.imageUrl).pathname.split('/').pop() || '');
        r.title = base.slice(0, 80);
      } catch { r.title = ''; }
    }
  }
  return results;
}
