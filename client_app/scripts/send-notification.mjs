#!/usr/bin/env node
'use strict';

/**
 * INDEX SENDNOTIF — CLI kirim Push Notification (EXECUTE_SHOW_NOTIFICATION)
 * dari aplikasi lain/operator menuju client tertentu atau broadcast, lengkap
 * dengan verifikasi token HMAC opsional (INDEX VERIFY di push-notification.js).
 *
 * Contoh pemakaian:
 *
 *   // Lihat daftar client terdaftar untuk memilih target:
 *   node scripts/send-notification.mjs --server http://localhost:8003 ^
 *     --api-key ptrj-... --list-clients
 *
 *   // Server asli (js-server Kerani), satu client:
 *   node scripts/send-notification.mjs --server http://localhost:8003 ^
 *     --api-key ptrj-rebinmas-air-ruak-parit-gunung-darul ^
 *     --client CLIENT-PTRJ-ARE-A ^
 *     --category update --priority high --token <NOTIFY_TOKEN> ^
 *     --title "Pembaruan Sistem Tersedia" ^
 *     --message "Hubungi Divisi IT untuk penjadwalan pembaruan."
 *
 *   // Banyak client / broadcast:
 *   --client CLIENT-PTRJ-ARE-A,CLIENT-PTRJ-PAB-01     (atau ulangi --client)
 *   ... --all                                          (semua client terdaftar)
 *
 *   // Mode mock uji lokal (tanpa server asli):
 *   node scripts/send-notification.mjs --mock http://localhost:8100 \
 *     --title "Uji Notifikasi" --message "Halo dari operator." [--token rahasia]
 *
 * Flag lain: --details, --footer, --theme harvest|maintenance|safety|default,
 *            --id NTF-ABC123 (default otomatis), --expires-minutes 60,
 *            --silent (toast tanpa bunyi).
 */

import process from 'node:process';
import {
  validateNotificationPayload,
  computeNotificationSignature,
} from '../src/modules/push-notification.js';

const COMMAND_TYPE = 'EXECUTE_SHOW_NOTIFICATION';
const MODULE_CODE = 'IFESS_PUSH_NOTIFICATION';

function printUsage() {
  console.log(`Kirim push notification satu arah ke IFESS client.

Pemakaian:
  send-notification.mjs --server URL [--api-key KEY] [--token SECRET]
      (--client ID[,ID...] | --all | --list-clients)
      --title "..." --message "..." [--category c] [--priority p]
      [--details t] [--footer t] [--theme t] [--id id] [--expires-minutes n] [--silent]

  send-notification.mjs --mock URL --title "..." --message "..." [--client ID] [--token SECRET]

--list-clients : hanya menampilkan clientId terdaftar lalu keluar.
--token        : HMAC-SHA256 payload; WAJIB bila client mengaktifkan verifyToken.

Kategori : announcement | update | instruction | alert | maintenance | reminder
Prioritas: low | normal | high | critical`);
}

function parseArgs(argv) {
  const options = {
    clients: [], all: false, listClients: false, server: '', mock: '',
    apiKey: '', token: '', category: 'announcement', priority: 'normal',
    theme: '', title: '', message: '', details: '', footer: '',
    id: '', expiresMinutes: null, sound: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`flag ${flag} membutuhkan nilai.`);
      return argv[++i];
    };
    switch (flag) {
      case '--server': options.server = next(); break;
      case '--mock': options.mock = next(); break;
      case '--api-key': options.apiKey = next(); break;
      case '--token': options.token = next(); break;
      case '--client': options.clients.push(...String(next()).split(',').map(item => item.trim()).filter(Boolean)); break;
      case '--all': options.all = true; break;
      case '--list-clients': options.listClients = true; break;
      case '--title': options.title = next(); break;
      case '--message': options.message = next(); break;
      case '--details': options.details = next(); break;
      case '--footer': options.footer = next(); break;
      case '--category': options.category = next(); break;
      case '--priority': options.priority = next(); break;
      case '--theme': options.theme = next(); break;
      case '--id': options.id = next(); break;
      case '--expires-minutes': options.expiresMinutes = Number(next()); break;
      case '--silent': options.sound = false; break;
      default: throw new Error(`argumen tidak dikenal: ${flag}`);
    }
  }
  return options;
}

function stampNotificationId() {
  const pad = number => String(number).padStart(2, '0');
  const now = new Date();
  return `NTF-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
    + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    + `-${Math.random().toString(36).slice(2, 6)}`;
}

async function fetchJson(url, init) {
  const response = await fetch(url, { signal: AbortSignal.timeout(10000), ...init });
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`${response.status} ${response.statusText}${detail ? `: ${detail}` : ''}`);
  }
  return response.json();
}

/** Ekstrak daftar clientId dari berbagai bentuk respons GET /api/clients. */
function extractClientIds(responseBody) {
  const list = Array.isArray(responseBody)
    ? responseBody
    : responseBody?.clients ?? responseBody?.data ?? [];
  if (!Array.isArray(list)) return [];
  return list
    .map(item => item?.clientId ?? item?.id ?? '')
    .map(String)
    .filter(Boolean);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`Error argumen: ${err.message}\n`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!options.server && !options.mock) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const headers = { 'X-API-Key': options.apiKey, 'Content-Type': 'application/json' };

  // ── Mode daftar client: bantu operator memilih target ─────────────────────
  if (options.listClients) {
    if (!options.server) { console.error('--list-clients butuh --server.'); process.exitCode = 1; return; }
    const listing = await fetchJson(new URL('/api/clients', options.server), { headers });
    const ids = extractClientIds(listing);
    console.log(ids.length === 0 ? '(tidak ada client terdaftar)' : ids.join('\n'));
    return;
  }

  if (!options.title.trim() || !options.message.trim()) {
    console.error('--title dan --message wajib diisi.');
    process.exitCode = 1;
    return;
  }

  const expiresAt = options.expiresMinutes !== null && options.expiresMinutes > 0
    ? new Date(Date.now() + options.expiresMinutes * 60000).toISOString()
    : undefined;

  // Validasi ulang di sisi pengirim agar kesalahan ketahap sebelum jaringan.
  const validation = validateNotificationPayload({
    notificationId: options.id || stampNotificationId(),
    category: options.category,
    priority: options.priority,
    title: options.title,
    message: options.message,
    details: options.details || undefined,
    footer: options.footer || undefined,
    theme: options.theme || undefined,
    expiresAt,
    sound: options.sound,
  }, { maxTitleLength: 200, maxMessageLength: 1000, maxDetailsLength: 2000 });
  if (!validation.ok) {
    console.error(validation.error);
    process.exitCode = 1;
    return;
  }
  const payload = validation.value;

  // INDEX VERIFY: tandatangani setelah normalisasi; client memverifikasi
  // bentuk kanonik yang identik (lihat canonicalNotificationString).
  if (options.token) {
    payload.signature = computeNotificationSignature(payload, options.token);
  }

  // ── Mode mock: antrikan lewat endpoint admin mock ─────────────────────────
  if (options.mock) {
    const body = {
      ...payload,
      clientId: options.clients[0] ?? null,
      clientIds: options.clients.length > 1 ? options.clients.slice(1) : undefined,
      broadcast: options.all,
    };
    const result = await fetchJson(new URL('/admin/notify', options.mock), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const targetLabel = options.all ? 'broadcast semua client'
      : options.clients.length > 0 ? `target ${result.command.targetDescription ?? options.clients.join(', ')}`
        : 'broadcast semua client';
    console.log(`OK (mock): command ${result.command.commandId} diantrikan (${targetLabel}).`);
    return;
  }

  // ── Mode server asli: POST /api/clients/{id}/commands per target ──────────
  let targets = options.clients;
  if (options.all) {
    const listing = await fetchJson(new URL('/api/clients', options.server), { headers });
    targets = extractClientIds(listing);
    if (targets.length === 0) {
      throw new Error('GET /api/clients tidak memuat clientId yang bisa dibaca (cek bentuk respons server).');
    }
    console.log(`Broadcast ke ${targets.length} client terdaftar.`);
  }
  if (targets.length === 0) {
    console.error('Tentukan target: --client ID atau --all.');
    process.exitCode = 1;
    return;
  }

  let failureCount = 0;
  for (const target of targets) {
    try {
      const url = new URL(`/api/clients/${encodeURIComponent(target)}/commands`, options.server);
      await fetchJson(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ commandType: COMMAND_TYPE, moduleCode: MODULE_CODE, payload }),
      });
      console.log(`OK: ${target} <- ${payload.notificationId} '${payload.title}'`);
    } catch (err) {
      failureCount++;
      console.error(`GAGAL: ${target}: ${err.message}`);
    }
  }
  if (failureCount > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error(`Gagal mengirim: ${err.message}`);
  process.exitCode = 1;
});
