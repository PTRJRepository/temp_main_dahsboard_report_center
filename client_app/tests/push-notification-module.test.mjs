'use strict';

/**
 * Unit test perilaku PushNotificationModule (INDEX PUSHMOD) dengan notifier
 * palsu (tanpa PowerShell sungguhan). Jalankan:
 *   node --test tests/push-notification-module.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PushNotificationModule,
  SHOW_NOTIFICATION_COMMAND,
  PUSH_NOTIFICATION_MODULE,
  computeNotificationSignature,
} from '../src/modules/push-notification.js';

// Folder aset branding asli proyek (untuk test resolusi hero/logo).
const REAL_ASSETS_DIR = fileURLToPath(new URL('../assets/notifications', import.meta.url));
const SECRET = 'rahasia-estate-2026';

function makeLoggerStub() {
  return {
    info: () => {},
    warning: () => {},
    errorException: () => {},
    forModule: () => makeLoggerStub(),
  };
}

/** Notifier palsu yang mencatat panggilan; hasil bisa diatur per test. */
function makeNotifierStub(result = { displayed: true, method: 'toast', message: 'ok' }) {
  return {
    calls: [],
    result,
    async display(notification) {
      this.calls.push(notification);
      if (this.result instanceof Error) throw this.result;
      return typeof this.result === 'function' ? this.result() : this.result;
    },
  };
}

async function makeModule(testDir, { customConfig = {}, notifier = null } = {}) {
  const baseDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushmod-'));
  const moduleInstance = new PushNotificationModule(baseDirectory, makeLoggerStub(), notifier);
  await moduleInstance.start({
    customConfig: { dataPath: path.join(testDir, 'data', 'notifications'), ...customConfig },
  });
  return moduleInstance;
}

const COMMAND = payload => ({
  commandId: 'CMD-TEST-001',
  commandType: SHOW_NOTIFICATION_COMMAND,
  moduleCode: PUSH_NOTIFICATION_MODULE,
  payload,
});

test('canHandle hanya menerima pasangan commandType+moduleCode yang benar', () => {
  const moduleInstance = new PushNotificationModule('/tmp', makeLoggerStub());
  assert.equal(moduleInstance.canHandle(COMMAND({})), true);
  assert.equal(moduleInstance.canHandle({
    commandId: 'x', commandType: SHOW_NOTIFICATION_COMMAND, moduleCode: 'IFESS_AUTO_TASK_KILL', payload: {},
  }), false);
  assert.equal(moduleInstance.canHandle({
    commandId: 'x', commandType: 'EXECUTE_OTHER', moduleCode: PUSH_NOTIFICATION_MODULE, payload: {},
  }), false);
});

test('handle menampilkan notifikasi, menyimpan seen, dan menulis riwayat', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub();
  const moduleInstance = await makeModule(testDir, {
    notifier,
    // Pakai folder banner asli supaya resolusi hero image teruji end-to-end.
    customConfig: { themesPath: REAL_ASSETS_DIR },
  });

  const result = await moduleInstance.handle(COMMAND({
    notificationId: 'NTF-A1',
    title: 'Panen Blok C Siap',
    message: 'Tim A diminta berkumpul di kantor estate pukul 07:00.',
    priority: 'high',
    category: 'instruction',
  }));

  assert.equal(result.success, true);
  assert.match(result.message, /ditampilkan \(toast\)/);
  assert.equal(notifier.calls.length, 1);
  assert.equal(notifier.calls[0].title, 'Panen Blok C Siap');
  // Kategori instruction -> banner-update.png harus ada di aset proyek.
  assert.ok(notifier.calls[0].heroPath, 'hero image tema harus terisi bila aset ada');
  assert.match(notifier.calls[0].heroPath, /banner-update\.png$/);
  assert.ok(fs.existsSync(path.join(testDir, 'data', 'notifications', 'seen.json')));
  // INDEX REMDATA: inbox widget berisi entri notifikasi yang tampil.
  const inboxPath = path.join(testDir, 'data', 'notifications', 'inbox.jsonl');
  const inboxLines = fs.readFileSync(inboxPath, 'utf8').trim().split('\n');
  assert.equal(inboxLines.length, 1);
  const inboxEntry = JSON.parse(inboxLines[0]);
  assert.equal(inboxEntry.id, 'NTF-A1');
  assert.equal(inboxEntry.title, 'Panen Blok C Siap');
  assert.equal(inboxEntry.category, 'instruction');
  const files = fs.readdirSync(path.join(testDir, 'data', 'notifications')).filter(name => name.startsWith('history-'));
  assert.equal(files.length, 1);
});

test('notificationId sama tidak ditampilkan dua kali (dedupe)', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub();
  const moduleInstance = await makeModule(testDir, { notifier });
  const payload = { notificationId: 'NTF-DUP', title: 'T', message: 'M' };

  const first = await moduleInstance.handle(COMMAND(payload));
  const second = await moduleInstance.handle(COMMAND(payload));

  assert.equal(first.success, true);
  assert.equal(second.success, true);
  assert.match(second.message, /Duplikat dilewati/);
  assert.equal(notifier.calls.length, 1);
});

test('seen bertahan lintas restart modul (persistensi dedupe)', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const first = await makeModule(testDir, { notifier: makeNotifierStub() });
  await first.handle(COMMAND({ notificationId: 'NTF-PERSIST', title: 'T', message: 'M' }));
  await first.stop();

  const notifierSecond = makeNotifierStub();
  const second = await makeModule(testDir, { notifier: notifierSecond });
  const result = await second.handle(COMMAND({ notificationId: 'NTF-PERSIST', title: 'T', message: 'M' }));

  assert.match(result.message, /Duplikat dilewati/);
  assert.equal(notifierSecond.calls.length, 0);
});

test('notifikasi kadaluarsa dilewati tanpa menampilkan apa pun', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub();
  const moduleInstance = await makeModule(testDir, { notifier });

  const result = await moduleInstance.handle(COMMAND({
    notificationId: 'NTF-OLD',
    title: 'T',
    message: 'M',
    expiresAt: '2001-01-01T00:00:00.000Z',
  }));

  assert.equal(result.success, true);
  assert.match(result.message, /Kadaluarsa dilewati/);
  assert.equal(notifier.calls.length, 0);
});

test('payload tidak valid menghasilkan result Failed dengan alasan', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const moduleInstance = await makeModule(testDir, { notifier: makeNotifierStub() });
  const result = await moduleInstance.handle(COMMAND({ title: '', message: '' }));

  assert.equal(result.success, false);
  assert.match(result.message, /Payload tidak valid/);
});

test('verifyToken aktif: payload tanpa signature ditolak', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const moduleInstance = await makeModule(testDir, {
    notifier: makeNotifierStub(),
    customConfig: { verifyToken: SECRET },
  });

  const result = await moduleInstance.handle(COMMAND({ notificationId: 'NTF-NOSIG', title: 'T', message: 'M' }));

  assert.equal(result.success, false);
  assert.match(result.message, /Verifikasi gagal/);
});

test('verifyToken aktif: payload bertanda tangan benar diterima; token salah ditolak', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub();
  const moduleInstance = await makeModule(testDir, {
    notifier,
    customConfig: { verifyToken: SECRET },
  });

  const signed = {
    ...{ notificationId: 'NTF-SIGNED', title: 'T', message: 'M' },
    signature: computeNotificationSignature(
      { notificationId: 'NTF-SIGNED', title: 'T', message: 'M' }, SECRET),
  };
  const goodResult = await moduleInstance.handle(COMMAND(signed));

  const wrongSecret = {
    notificationId: 'NTF-WRONG', title: 'T2', message: 'M2',
    signature: computeNotificationSignature(
      { notificationId: 'NTF-WRONG', title: 'T2', message: 'M2' }, 'token-lain'),
  };
  const badResult = await moduleInstance.handle(COMMAND(wrongSecret));

  assert.equal(goodResult.success, true);
  assert.match(goodResult.message, /ditampilkan \(toast\)/);
  assert.equal(badResult.success, false);
  assert.match(badResult.message, /Verifikasi gagal/);
});

test('kegagalan display menjadi Failed dengan pesan penyebab', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub({ displayed: false, method: 'none', message: 'toast dan balloon sama-sama gagal.' });
  const moduleInstance = await makeModule(testDir, { notifier });

  const result = await moduleInstance.handle(COMMAND({ notificationId: 'NTF-FAIL', title: 'T', message: 'M' }));

  assert.equal(result.success, false);
  assert.match(result.message, /gagal ditampilkan/);
});

test('dryRun tidak memanggil notifier tetapi tetap sukses dan mencatat riwayat', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub();
  const moduleInstance = await makeModule(testDir, { notifier, customConfig: { dryRun: true } });

  const result = await moduleInstance.handle(COMMAND({ notificationId: 'NTF-DRY', title: 'T', message: 'M' }));

  assert.equal(result.success, true);
  assert.match(result.message, /\(dry-run\)/);
  assert.equal(notifier.calls.length, 0);
});

test('kapasitas seen terbatas: ID tertua FIFO terusir agar bisa tampil lagi', async t => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ifess-pushdata-'));
  t.after(() => fs.rmSync(testDir, { recursive: true, force: true }));

  const notifier = makeNotifierStub();
  const moduleInstance = await makeModule(testDir, { notifier, customConfig: { seenCapacity: 3 } });

  // Urutan memori: [1] -> [1,2] -> [1,2,3] -> masuk 4, evict 1 -> [2,3,4]
  await moduleInstance.handle(COMMAND({ notificationId: 'NTF-1', title: 'T', message: 'M' }));
  await moduleInstance.handle(COMMAND({ notificationId: 'NTF-2', title: 'T', message: 'M' }));
  await moduleInstance.handle(COMMAND({ notificationId: 'NTF-3', title: 'T', message: 'M' }));
  await moduleInstance.handle(COMMAND({ notificationId: 'NTF-4', title: 'T', message: 'M' }));

  // NTF-3 masih ingat -> duplikat dilewati tanpa memanggil notifier lagi.
  const duplicateKept = await moduleInstance.handle(COMMAND({ notificationId: 'NTF-3', title: 'T', message: 'M' }));
  // NTF-1 sudah terusir -> ditampilkan ulang; memori jadi [4,1].
  const replayEvicted = await moduleInstance.handle(COMMAND({ notificationId: 'NTF-1', title: 'T', message: 'M' }));

  assert.match(duplicateKept.message, /Duplikat dilewati/);
  assert.match(replayEvicted.message, /ditampilkan \(toast\)/);

  // Persistensi juga tercap: seen.json tidak pernah melebihi kapasitas.
  const stored = JSON.parse(fs.readFileSync(path.join(testDir, 'data', 'notifications', 'seen.json'), 'utf8'));
  assert.ok(stored.ids.length <= 3);
  assert.deepEqual(stored.ids.slice(-1), ['NTF-1']);
});
