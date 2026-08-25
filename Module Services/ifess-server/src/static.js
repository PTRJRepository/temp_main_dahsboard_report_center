/**
 * IFESS Server — Unified Frontend Serving
 *
 * Serves the ifess-control UI directly from this backend (no separate
 * frontend process): app console at /, query console at /simple, and
 * /assets/* static files. File contents are cached after first read;
 * restart the service to pick up edits.
 */

import fs from 'node:fs';
import { resolve, extname } from 'node:path';
import { UI_DIR } from './config.js';

const cache = new Map(); // absolute path -> Buffer

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
        if (!full.startsWith(UI_DIR)) return null;

        let content = cache.get(full);
        if (content === undefined) {
            content = fs.readFileSync(full);
            cache.set(full, content);
        }

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
