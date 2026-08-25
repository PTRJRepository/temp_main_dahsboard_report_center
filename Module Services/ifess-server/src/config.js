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
export const PORT = parseInt(process.env.IFESS_PORT || '8012', 10);

/** Key the control UI and .NET clients send (X-API-Key). */
export const IFESS_API_KEY = process.env.IFESS_API_KEY || fileEnv.IFESS_API_KEY || 'ptrj-rebinmas-air-ruak-parit-gunung-darul';

/** Secondary key used when clients reach us through the gateway proxy flow. */
export const IFESS_CLIENT_API_KEY = process.env.IFESS_CLIENT_API_KEY || fileEnv.IFESS_CLIENT_API_KEY || '';

/** Directory holding the unified frontend (app/, simple/, assets/). */
export const UI_DIR = process.env.IFESS_UI_DIR || resolve(REPO_ROOT, 'Module Services/ifess-control');
