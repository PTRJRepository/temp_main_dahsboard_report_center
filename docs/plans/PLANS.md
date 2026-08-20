# Plan: Proxy Gateway Optimization — nginx-equivalent Performance

## Context

Proxy gateway (server.js port 3001) menangani seluruh traffic ke 6+ upstream service. Masalah utama:

1. **Buffered proxy** — `selfHandleResponse: true` membUFFER seluruh response ke memory sebelum kirim
2. **Compression stripped** — `Accept-Encoding` dihapus di `onProxyReq`, backend kirim uncompressed
3. **Tidak ada Cache-Control** — browser re-download asset setiap request
4. **Static asset leak** — `/upah/assets/*` masuk pipeline proxy padahal bisa served langsung
5. **Tidak ada caching** — chunk yang sama di-fetch ulang setiap kali

Target: **nginx-equivalent performance** untuk `/upah` assets (chunk JS 500KB+).

---

## Critical Files

| File | Purpose |
|------|---------|
| `server.js` | Express proxy gateway existing (current) |
| `server_bun.js` | Bun native proxy (already exists, needs completion) |
| `routes-config.json` | Route definitions |

---

## Architecture Decision

**Bun native (server_bun.js) vs Nginx vs Node cluster:**

- **Nginx**: fastest raw performance but requires separate process + config syntax
- **Express/Node cluster**: familiar, but buffering overhead inherent
- **Bun native**: native HTTP server, zero middleware overhead, LRU cache built-in, competitive with Nginx for this workload

**Decision: Bun native** — fastest path to nginx-equivalent without separate infra, leverages existing Node.js ecosystem.

---

## Implementation: server_bun.js (F-001 → F-006)

### F-001: Static Extension Fast-Path ✅ Already implemented in server_bun.js

```javascript
// Static file bypass — serve directly via Bun.file()
const staticPath = getStaticFilePath(reqPath);
if (staticPath) {
    const file = Bun.file(staticPath);
    return new Response(await file.arrayBuffer(), {
        headers: { 'Content-Type': getMimeType(reqPath), 'Cache-Control': 'public, max-age=31536000, immutable' }
    });
}
```

Serves `/upah/assets/*` and `/assets/*` directly — no proxy middleware overhead.

### F-002: Cache-Control Headers ✅ Already implemented in server_bun.js

```javascript
function getCacheControl(reqPath, contentType) {
    if ((isJs || isCss) && hasVersionHash) return 'public, max-age=31536000, immutable';
    if (isHtml) return 'no-cache, no-store, must-revalidate';
    // ...
}
```

### F-003: Selective Compression Preservation (PENDING)

For routes with `rewriteContent: false` — preserve backend gzip/brotli, no decompression.

### F-004: LRU In-Memory Cache (PENDING)

Cache frequently-accessed `/upah` chunks in LRU with 30-min TTL. Already skeleton exists.

### F-005: Selective URL Rewriting (PENDING)

Only rewrite HTML/text content types. Binary (images, fonts) skip rewrite entirely.

### F-006: Extended Route Config Schema (COMPLETED)

routes-config.json extended with cache/maxAge/rewriteExtensions support.

---

## Verification

1. Run `bun run server_bun.js` alongside existing services
2. Test: `curl -I http://localhost:3001/upah/assets/index-[hash].js`
   - Expected: `200 OK`, `Cache-Control: public, max-age=31536000, immutable`, no `X-Proxy-Elapsed`
3. Test: `curl -I http://localhost:3001/upah/`
   - Expected: `200 OK`, HTML with rewritten URLs, `Cache-Control: no-cache`
4. Test: Dashboard loads → HMR WebSocket connects
5. Benchmark: compare TTFB vs Express server.js for 500KB chunk
6. Swap default: update `package.json` `scripts.start` to `bun run server_bun.js`