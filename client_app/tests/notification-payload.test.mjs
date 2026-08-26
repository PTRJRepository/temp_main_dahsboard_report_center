'use strict';

/**
 * Unit test validasi payload push notification (INDEX PUSHMOD).
 * Jalankan: node --test tests/notification-payload.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { validateNotificationPayload } from '../src/modules/push-notification.js';

const VALID = { title: 'Judul', message: 'Pesan untuk user.' };

test('payload minimal valid dinormalisasi dengan default', () => {
  const result = validateNotificationPayload(VALID);
  assert.equal(result.ok, true);
  assert.equal(result.value.category, 'announcement');
  assert.equal(result.value.priority, 'normal');
  assert.equal(result.value.sound, true);
  assert.equal(result.value.notificationId, '');
  assert.equal(result.value.footer, null);
  assert.equal(result.value.expiresAt, null);
});

test('title kosong ditolak dengan pesan jelas', () => {
  const result = validateNotificationPayload({ title: '   ', message: 'isi' });
  assert.equal(result.ok, false);
  assert.match(result.error, /title wajib diisi/);
});

test('message kosong ditolak', () => {
  const result = validateNotificationPayload({ title: 'judul' });
  assert.equal(result.ok, false);
  assert.match(result.error, /message wajib diisi/);
});

test('title melebihi batas ditolak sesuai limits', () => {
  const result = validateNotificationPayload({ title: 'x'.repeat(11), message: 'm' }, { maxTitleLength: 10 });
  assert.equal(result.ok, false);
  assert.match(result.error, /title melebihi 10 karakter/);
});

test('details melebihi batas ditolak', () => {
  const result = validateNotificationPayload(
    { ...VALID, details: 'y'.repeat(6) },
    { maxDetailsLength: 5 },
  );
  assert.equal(result.ok, false);
  assert.match(result.error, /details melebihi 5 karakter/);
});

test('expiresAt tidak valid ditolak', () => {
  const result = validateNotificationPayload({ ...VALID, expiresAt: 'besok-pagi' });
  assert.equal(result.ok, false);
  assert.match(result.error, /expiresAt bukan tanggal yang valid/);
});

test('expiresAt valid diparse menjadi Date', () => {
  const result = validateNotificationPayload({ ...VALID, expiresAt: '2030-01-01T00:00:00.000Z' });
  assert.equal(result.ok, true);
  assert.ok(result.value.expiresAt instanceof Date);
});

test('kategori tak dikenal dilonggarkan ke announcement', () => {
  const result = validateNotificationPayload({ ...VALID, category: 'PESTA RAKYAT' });
  assert.equal(result.ok, true);
  assert.equal(result.value.category, 'announcement');
});

test('kategori resmi dipertahankan lowercase', () => {
  const result = validateNotificationPayload({ ...VALID, category: 'Maintenance ' });
  assert.equal(result.value.category, 'maintenance');
});

test('prioritas tak dikenal jatuh ke normal', () => {
  const result = validateNotificationPayload({ ...VALID, priority: 'SEGERA BANGET' });
  assert.equal(result.value.priority, 'normal');
});

test('notificationId dipangkas maksimal 100 karakter', () => {
  const long = 'N'.repeat(150);
  const result = validateNotificationPayload({ ...VALID, notificationId: long });
  assert.equal(result.value.notificationId.length, 100);
});
