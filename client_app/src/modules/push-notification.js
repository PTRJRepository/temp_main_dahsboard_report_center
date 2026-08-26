'use strict';

/**
 * Modul Push Notification satu arah (Server -> Client).
 * Alur: command EXECUTE_SHOW_NOTIFICATION dari control server -> verifikasi
 * token (opsional) -> validasi -> dedupe persisten -> tampilkan Windows Toast
 * -> tulis inbox widget -> catat riwayat lokal.
 *
 * Isi notifikasi TIDAK dibalas ke server; yang dilaporkan hanya status sukses/
 * gagal eksekusi command melalui kanal command result standar yang sudah ada.
 *
 * INDEX PUSHMOD — peta isi file (grep hint: "INDEX PUSHMOD")
 * ----------------------------------------------------------------------------
 *   PUSH_NOTIFICATION_MODULE      : 'IFESS_PUSH_NOTIFICATION' (moduleCode)
 *   SHOW_NOTIFICATION_COMMAND     : 'EXECUTE_SHOW_NOTIFICATION' (commandType)
 *   DEFAULT_OPTIONS               : konfigurasi default modul
 *   CATEGORIES / THEMES           : daftar kategori & tema yang dikenal
 *   CATEGORY_BANNER               : kategori -> file hero image default
 *   canonicalNotificationString() : bentuk kanonik untuk tanda tangan (v1)
 *   computeNotificationSignature(): HMAC-SHA256 hex atas bentuk kanonik
 *   verifyNotificationSignature() : cek signature payload (timing-safe)
 *   validateNotificationPayload() : validasi + normalisasi payload (pure)
 *   loadSeenState()/saveSeenState(): persistensi ID ter-tampil untuk dedupe
 *   class PushNotificationModule  : handler command + riwayat + dedupe +
 *                                   penulis inbox widget + auto-launch widget
 *
 * INDEX VERIFY — verifikasi payload (grep hint: "INDEX VERIFY")
 * ----------------------------------------------------------------------------
 * Jika customConfig.verifyToken diisi (mis. dari client.config.local.json),
 * SETIAP command wajib menyertakan payload.signature = HMAC-SHA256 hex yang
 * dihitung dari bentuk kanonik:
 *     v1 | notificationId | category | priority | title | message |
 *     details | expiresAt(raw string)
 * Field kosong ditulis '' (details/footer null -> ''). Signature sendiri
 * TIDAK ikut kanonik. Tanpa verifyToken, payload tanpa signature tetap
 * diterima (mode kompatibel); dengan verifyToken, unsigned/tamper -> Failed.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { WindowsToastNotifier, normalizePriority } from '../notifications/toast-notifier.js';

export const PUSH_NOTIFICATION_MODULE = 'IFESS_PUSH_NOTIFICATION';
export const SHOW_NOTIFICATION_COMMAND = 'EXECUTE_SHOW_NOTIFICATION';

export const CATEGORIES = new Set([
  'announcement', 'update', 'instruction', 'alert', 'maintenance', 'reminder',
]);
export const THEMES = new Set(['default', 'harvest', 'maintenance', 'safety']);

const CATEGORY_BANNER = {
  announcement: 'banner-announcement.png',
  reminder: 'banner-announcement.png',
  update: 'banner-update.png',
  instruction: 'banner-update.png',
  maintenance: 'banner-maintenance.png',
  alert: 'banner-alert.png',
};

const DEFAULT_OPTIONS = {
  dataPath: 'data/notifications',
  themesPath: 'assets/notifications',
  logoPath: 'assets/notifications/logo.png',
  appUserModelId: 'PT.Rebinmas.IFESS.ClientApp',
  appName: 'IFESS Klien',
  footerText: 'PT. Rebinmas Jaya • Divisi IT',
  soundByDefault: true,
  // dryRun=true: validasi+dedupe+riwayat+inbox jalan, tapi TIDAK memanggil
  // PowerShell toast DAN tidak meluncurkan widget (dipakai e2e/CI).
  dryRun: false,
  maxTitleLength: 120,
  maxMessageLength: 600,
  maxDetailsLength: 1200,
  seenCapacity: 1000,
  historyRetainDays: 30,
  displayTimeoutSeconds: 10,

  // INDEX VERIFY: shared secret HMAC. Kosong = verifikasi dinonaktifkan.
  // Simpan nilai aslinya di client.config.local.json (gitignored).
  verifyToken: '',

  // Widget pengingat terpin: tulis inbox untuk widget dan/atau luncurkan.
  widgetInbox: true,
  autoLaunchWidget: true,
};

/** Bentuk kanonik v1 untuk tanda tangan; deterministik dua sisi. */
export function canonicalNotificationString(payload) {
  const field = value => {
    if (value instanceof Date) return value.toISOString();
    return String(value ?? '').trim();
  };
  return [
    'v1',
    field(payload?.notificationId),
    field(payload?.category),
    field(payload?.priority),
    field(payload?.title),
    field(payload?.message),
    field(payload?.details),
    field(payload?.expiresAt),
  ].join('|');
}

/** HMAC-SHA256 (hex) atas bentuk kanonik; dipakai pengirim & penerima. */
export function computeNotificationSignature(payload, secret) {
  if (!secret) throw new Error('Secret token tidak boleh kosong.');
  return crypto.createHmac('sha256', String(secret)).update(canonicalNotificationString(payload)).digest('hex');
}

/** Verifikasi timing-safe; aman terhadap payload tanpa signature. */
export function verifyNotificationSignature(payload, secret) {
  if (!secret || !payload?.signature) return false;
  const provided = String(payload.signature).toLowerCase();
  const expected = computeNotificationSignature(payload, secret);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Validasi & normalisasi payload notifikasi.
 * Return { ok:true, value } atau { ok:false, error }.
 * Kategori/prioritas tak dikenal sengaja dilonggarkan (forward-compatible),
 * kesalahan fatal hanya pada field wajib dan format tanggal.
 */
export function validateNotificationPayload(rawPayload, limits = {}) {
  const maxTitle = Math.max(1, Number(limits.maxTitleLength ?? 120));
  const maxMessage = Math.max(1, Number(limits.maxMessageLength ?? 600));
  const maxDetails = Math.max(0, Number(limits.maxDetailsLength ?? 1200));
  const errors = [];

  const title = String(rawPayload?.title ?? '').trim();
  if (!title) errors.push('title wajib diisi.');
  else if (title.length > maxTitle) errors.push(`title melebihi ${maxTitle} karakter.`);

  const message = String(rawPayload?.message ?? '').trim();
  if (!message) errors.push('message wajib diisi.');
  else if (message.length > maxMessage) errors.push(`message melebihi ${maxMessage} karakter.`);

  const details = String(rawPayload?.details ?? '').trim();
  if (details.length > maxDetails) errors.push(`details melebihi ${maxDetails} karakter.`);

  let expiresAt = null;
  if (rawPayload?.expiresAt) {
    expiresAt = new Date(rawPayload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) errors.push('expiresAt bukan tanggal yang valid.');
  }

  if (errors.length > 0) {
    return { ok: false, error: `Payload tidak valid: ${errors.join(' ')}` };
  }

  const categoryInput = String(rawPayload?.category ?? '').trim().toLowerCase();
  const themeInput = String(rawPayload?.theme ?? '').trim().toLowerCase();
  return {
    ok: true,
    value: {
      notificationId: rawPayload?.notificationId
        ? String(rawPayload.notificationId).trim().slice(0, 100)
        : '',
      category: CATEGORIES.has(categoryInput) ? categoryInput : 'announcement',
      priority: normalizePriority(rawPayload?.priority),
      title,
      message,
      details: details || null,
      footer: rawPayload?.footer != null && String(rawPayload.footer).trim() !== ''
        ? String(rawPayload.footer).trim()
        : null,
      theme: THEMES.has(themeInput) ? themeInput : '',
      expiresAt,
      sound: rawPayload?.sound === undefined ? true : Boolean(rawPayload.sound),
    },
  };
}

/** Muat daftar ID dari seen.json; toleran file korup (kembalikan kosong). */
export function loadSeenState(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (Array.isArray(parsed)) return parsed.filter(item => typeof item === 'string');
    if (Array.isArray(parsed?.ids)) return parsed.ids.filter(item => typeof item === 'string');
    return [];
  } catch {
    return [];
  }
}

/** Tulis seen.json atomik (.tmp lalu rename) agar tidak rusak saat crash. */
export function saveSeenState(filePath, ids) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify({ ids: [...ids] }, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

/**
 * Worker Push Notification. Interface mengikuti modul lain:
 * start(moduleOptions) / stop() / canHandle(command) / handle(command).
 * Notifier dapat di-inject (parameter constructor) untuk unit test; ketika
 * notifier di-inject, auto-launch widget sengaja dilewati (konteks test).
 */
export class PushNotificationModule {
  constructor(baseDirectory, logger, notifier = null) {
    this.baseDirectory = baseDirectory;
    this.logger = logger;
    this.notifierInstance = notifier;
    this.options = { ...DEFAULT_OPTIONS };
    this.dataDirectory = '';
    this.seenStorePath = '';
    this.widgetScriptPath = '';
    /** Set<string> urutan insertion: terlama di depan untuk eviction FIFO. */
    this.seenIds = new Set();
    this.running = false;
  }

  get code() { return PUSH_NOTIFICATION_MODULE; }

  async start(moduleOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...(moduleOptions?.customConfig ?? {}) };
    this.dataDirectory = path.resolve(this.baseDirectory, this.options.dataPath);
    this.seenStorePath = path.join(this.dataDirectory, 'seen.json');
    this.widgetScriptPath = path.resolve(this.baseDirectory, 'widget', 'reminder-widget.ps1');
    fs.mkdirSync(this.dataDirectory, { recursive: true });
    this.seenIds = new Set(loadSeenState(this.seenStorePath).slice(-this.options.seenCapacity));
    this.cleanupOldHistory();

    const internalNotifierNeeded = !this.notifierInstance && !this.options.dryRun;
    if (internalNotifierNeeded) {
      this.notifierInstance = new WindowsToastNotifier({
        appUserModelId: this.options.appUserModelId,
        assetsDirectory: path.resolve(this.baseDirectory, this.options.themesPath),
        displayTimeoutSeconds: this.options.displayTimeoutSeconds,
      });
    }

    this.running = true;
    this.logger.info(`Push Notification worker started. dryRun=${!!this.options.dryRun}`
      + `, verifyToken=${this.options.verifyToken ? 'AKTIF' : 'nonaktif'}`
      + `, seen=${this.seenIds.size}, data=${this.dataDirectory}`);

    // Auto-launch hanya saat benar-benar runtime produksi (bukan dry-run/test).
    if (internalNotifierNeeded && this.options.autoLaunchWidget && process.platform === 'win32') {
      this.launchReminderWidget();
    }
  }

  async stop() {
    this.running = false;
    this.logger.info('Push Notification worker stopped.');
  }

  canHandle(command) {
    return String(command?.commandType ?? '').toUpperCase() === SHOW_NOTIFICATION_COMMAND
      && String(command?.moduleCode ?? '').toUpperCase() === PUSH_NOTIFICATION_MODULE;
  }

  async handle(command) {
    if (!this.running) return failed('IFESS_PUSH_NOTIFICATION is not running.');

    // INDEX PUSHMOD: 0) verifikasi token bila diaktifkan di config.
    if (this.options.verifyToken && !verifyNotificationSignature(command?.payload, this.options.verifyToken)) {
      this.appendHistory({
        notificationId: String(command?.payload?.notificationId ?? '?'),
        category: '?', priority: '?', title: String(command?.payload?.title ?? '(tanpa judul)'),
      }, { displayed: false, method: 'rejected', note: 'invalid-signature' });
      return failed('Verifikasi gagal: signature hilang atau tidak cocok untuk payload ini.');
    }

    // 1) Validasi payload.
    const validation = validateNotificationPayload(command?.payload ?? {}, this.options);
    if (!validation.ok) return failed(validation.error);
    const notification = validation.value;
    if (!notification.notificationId) {
      notification.notificationId = `NTF-${String(command.commandId ?? Date.now()).slice(-40)}`;
    }
    notification.footer = notification.footer ?? this.options.footerText;

    // 2) Kadaluarsa: server boleh mengirim lebih awal, client skip jika basi.
    if (notification.expiresAt && notification.expiresAt.getTime() <= Date.now()) {
      this.appendHistory(notification, { displayed: false, method: 'skipped', note: 'expired' });
      return ok(`Kadaluarsa dilewati: ${notification.notificationId}.`);
    }

    // 3) Dedupe persisten: ID yang pernah tampil tidak ditampilkan lagi.
    if (this.seenIds.has(notification.notificationId)) {
      this.appendHistory(notification, { displayed: false, method: 'skipped', note: 'duplicate' });
      return ok(`Duplikat dilewati: ${notification.notificationId} sudah ditampilkan sebelumnya.`);
    }

    // 4) Tampilkan (atau dry-run) lalu 5) catat seen + inbox widget + riwayat.
    let outcome;
    if (this.options.dryRun) {
      outcome = { displayed: true, method: 'dry-run', message: 'dry-run aktif, tampilan fisik dilewati.' };
    } else {
      try {
        outcome = await this.getNotifier().display(this.toDisplayRequest(notification));
      } catch (err) {
        outcome = { displayed: false, method: 'none', message: err?.message ?? String(err) };
      }
    }

    this.rememberSeen(notification.notificationId);
    if (outcome.displayed && this.options.widgetInbox) this.appendInbox(notification);
    this.appendHistory(notification, {
      displayed: outcome.displayed,
      method: outcome.method,
      note: outcome.message ?? null,
    });

    return outcome.displayed
      ? ok(`Notifikasi '${notification.title}' ditampilkan (${outcome.method}).`)
      : failed(`Notifikasi '${notification.title}' gagal ditampilkan: ${outcome.message}`);
  }

  getNotifier() {
    if (!this.notifierInstance) {
      throw new Error('Notifier belum tersedia (dryRun=false tetapi notifier gagal dibuat).');
    }
    return this.notifierInstance;
  }

  /**
   * Inbox untuk widget pengingat terpin (INDEX REMDATA): file APPEND-ONLY
   * yang hanya ditulis client; widget membaca dengan byte-offset sendiri.
   */
  appendInbox(notification) {
    try {
      fs.mkdirSync(this.dataDirectory, { recursive: true });
      const entry = JSON.stringify({
        id: notification.notificationId,
        at: new Date().toISOString(),
        category: notification.category,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        details: notification.details,
        footer: notification.footer,
      });
      fs.appendFileSync(path.join(this.dataDirectory, 'inbox.jsonl'), `${entry}\n`, 'utf8');
    } catch (err) {
      this.logger.errorException('Gagal menulis inbox widget.', err);
    }
  }

  /** Luncurkan widget WPF sebagai proses terpisah (mutex mencegah ganda). */
  launchReminderWidget() {
    try {
      if (!fs.existsSync(this.widgetScriptPath)) {
        this.logger.warning(`Widget script tidak ditemukan: ${this.widgetScriptPath}`);
        return;
      }
      const child = spawn('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
        '-File', this.widgetScriptPath,
        '-DataDir', this.dataDirectory,
        '-AssetsDir', path.resolve(this.baseDirectory, this.options.themesPath),
      ], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
      this.logger.info('Reminder widget diluncurkan.');
    } catch (err) {
      this.logger.errorException('Gagal meluncurkan reminder widget.', err);
    }
  }

  /** Susun permintaan display: teks + path branding yang benar-benar ada. */
  toDisplayRequest(notification) {
    return {
      title: notification.title,
      message: notification.message,
      details: notification.details,
      footer: notification.footer,
      priority: notification.priority,
      sound: notification.sound,
      logoPath: this.resolveExisting(path.resolve(this.baseDirectory, this.options.logoPath)),
      heroPath: this.resolveHeroImage(notification),
    };
  }

  /** Urutan hero: tema eksplisit dari payload -> banner kategori -> default. */
  resolveHeroImage(notification) {
    const root = path.resolve(this.baseDirectory, this.options.themesPath);
    const candidates = [];
    if (notification.theme) candidates.push(path.join(root, `banner-${notification.theme}.png`));
    candidates.push(path.join(root, CATEGORY_BANNER[notification.category] ?? 'banner-announcement.png'));
    candidates.push(path.join(root, 'banner-default.png'));
    for (const candidate of candidates) {
      if (this.resolveExisting(candidate)) return candidate;
    }
    return null;
  }

  resolveExisting(candidatePath) {
    try {
      return fs.existsSync(candidatePath) ? candidatePath : null;
    } catch {
      return null;
    }
  }

  /** Simpan ID ke memori (FIFO kapasitas terbatas) lalu persist ke disk. */
  rememberSeen(id) {
    this.seenIds.delete(id);
    this.seenIds.add(id);
    while (this.seenIds.size > Math.max(1, Number(this.options.seenCapacity))) {
      const oldest = this.seenIds.values().next().value;
      this.seenIds.delete(oldest);
    }
    try {
      saveSeenState(this.seenStorePath, this.seenIds);
    } catch (err) {
      this.logger.errorException('Gagal menyimpan seen.json.', err);
    }
  }

  /** Riwayat harian: data/notifications/history-YYYY-MM-DD.jsonl (append). */
  appendHistory(notification, outcome) {
    try {
      const now = new Date();
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const line = JSON.stringify({
        at: now.toISOString(),
        notificationId: notification.notificationId,
        category: notification.category,
        priority: notification.priority,
        title: notification.title,
        displayed: outcome.displayed,
        method: outcome.method,
        note: outcome.note ?? null,
      });
      fs.mkdirSync(this.dataDirectory, { recursive: true });
      fs.appendFileSync(path.join(this.dataDirectory, `history-${stamp}.jsonl`), `${line}\n`, 'utf8');
    } catch (err) {
      this.logger.errorException('Gagal menulis riwayat notifikasi.', err);
    }
  }

  /** Hapus riwayat lebih tua dari historyRetainDays (dipanggil saat start). */
  cleanupOldHistory() {
    const retainDays = Math.max(1, Number(this.options.historyRetainDays ?? 30));
    const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000;
    try {
      for (const name of fs.readdirSync(this.dataDirectory)) {
        const match = /^history-(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(name);
        if (!match) continue;
        if (new Date(`${match[1]}T00:00:00`).getTime() < cutoff) {
          try { fs.unlinkSync(path.join(this.dataDirectory, name)); } catch { /* dipakai proses lain */ }
        }
      }
    } catch { /* folder belum ada */ }
  }
}

function pad(number) { return String(number).padStart(2, '0'); }
function ok(message) { return { success: true, message }; }
function failed(message) { return { success: false, message }; }
