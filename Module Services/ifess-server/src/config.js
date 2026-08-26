/**
 * IFESS Server — Configuration
 *
 * Resolves PORT and API keys from process.env first, then falls back to the
 * repo-root .env.development / .env.production files (same files the main
 * gateway reads). This keeps keys in lockstep with server_bun.js even when
 * this module is spawned with a different working directory.
 */

import fs from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)); // src/
export const REPO_ROOT = resolve(here, '../../../');

/** Parse KEY=VALUE lines without overriding variables already in process.env. */
function parseDotEnv(file) {
    const out = {};
    try {
        for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
            const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
            if (m && process.env[m[1]] === undefined) {
                out[m[1]] = m[2].replace(/^["']|["']$/g, '');
            }
        }
    } catch { /* file absent — fine */ }
    return out;
}

const fileEnv = {
    ...parseDotEnv(resolve(REPO_ROOT, '.env.development')),
    ...parseDotEnv(resolve(REPO_ROOT, '.env.production')),
};

// Dedicated variable on purpose: generic `PORT` in the repo .env files means
// the main gateway (:3001) and must NOT leak into this module.
// 8003 = the historical iFESS ControlServer port (the old .NET server the
// SuperApp clients were configured against); this module deliberately
// takes it over (same migration pattern as sql-gateway ← 8001).
export const PORT = parseInt(process.env.IFESS_PORT || '8003', 10);

/** Key the control UI and .NET clients send (X-API-Key). */
export const IFESS_API_KEY = process.env.IFESS_API_KEY || fileEnv.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

/** Secondary key used when clients reach us through the gateway proxy flow. */
export const IFESS_CLIENT_API_KEY = process.env.IFESS_CLIENT_API_KEY || fileEnv.IFESS_CLIENT_API_KEY || '';

/** Directory holding the unified frontend (app/, simple/, assets/).
 * Module-OWNED copy under ui/ — the sibling `Module Services/ifess-control`
 * folder is the legacy copy still disk-served by the gateway until cut-over
 * completes; this module serves its own. */
export const UI_DIR = process.env.IFESS_UI_DIR || resolve(import.meta.dirname, '../ui');
