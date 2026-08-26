/**
 * IFESS Server — Unified Frontend Serving
 *
 * Serves the module-OWNED UI (ui/ — copy of ifess-control) directly from this
 * backend (no separate frontend process): app console at /, query console at
 * /simple, and /assets/* static files. Buffers are cached with mtime
 * validation so edits on disk are picked up without a restart.
 */

import fs from 'node:fs';
import { resolve, extname } from 'node:path';
import { UI_DIR } from './config.js';

const cache = new Map(); // absolute path -> { buf: Buffer, mtimeMs }

// Trailing separator so "ifess-control-evil" can never pass the prefix test
// below ("…/ifess-control-evil/x".startsWith("…/ifess-control/") is false,
// but without the separator "…/ifess-control".startsWith would also match).
const UI_ROOT = resolve(UI_DIR) + '/'.replace(/\//g, __dirname_sep());

function __dirname_sep() {
    // Windows accepts both separators; normalize to what resolve() emits.
    return resolve(UI_DIR).includes('\\') ? '\\' : '/';
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
};

/**
 * Serve a file relative to UI_DIR, or null when it does not exist
 * (caller decides the fallback).
 * @param {string} relPath e.g. "app/index.html", "assets/logo-ifess.svg"
 */
export function serveUi(relPath) {
    try {
        const full = resolve(UI_DIR, relPath);
        // Path-traversal guard: resolved path must stay inside UI_DIR.
        if (!full.startsWith(UI_ROOT)) return null;

        const stat = fs.statSync(full);
        let entry = cache.get(full);
        if (!entry || entry.mtimeMs !== stat.mtimeMs) {
            entry = { buf: fs.readFileSync(full), mtimeMs: stat.mtimeMs };
            cache.set(full, entry);
        }
        const content = entry.buf;

        const type = MIME[extname(full).toLowerCase()] || 'application/octet-stream';
        return new Response(content, {
            headers: {
                'Content-Type': type,
                'Cache-Control': relPath.endsWith('.html') ? 'no-cache' : 'public, max-age=300',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch {
        return null;
    }
}
