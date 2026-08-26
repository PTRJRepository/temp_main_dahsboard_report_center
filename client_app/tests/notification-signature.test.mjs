'use strict';

/**
 * Unit test verifikasi token HMAC notifikasi (INDEX VERIFY di
 * src/modules/push-notification.js).
 * Jalankan: node --test tests/notification-signature.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canonicalNotificationString,
  computeNotificationSignature,
  verifyNotificationSignature,
} from '../src/modules/push-notification.js';

const SECRET = 'rahasia-estate-2026';
const BASE = {
  notificationId: 'NTF-SIG-01',
  category: 'update',
  priority: 'high',
  title: 'Pembaruan Aplikasi',
  message: 'Silakan hubungi IT.',
};

test('bentuk kanonik stabil dan berurutan v1|id|category|priority|title|message', () => {
  const canonical = canonicalNotificationString(BASE);
  assert.equal(
    canonical,
    'v1|NTF-SIG-01|update|high|Pembaruan Aplikasi|Silakan hubungi IT.||',
  );
});

test('field kosong/null dinormalisasi menjadi string kosong', () => {
  const a = canonicalNotificationString({ ...BASE, details: null });
  const b = canonicalNotificationString({ ...BASE, details: '' });
  assert.equal(a, b);
});

test('trim diaplikasikan sehingga spasi tepi tidak mengubah kanonik', () => {
  const a = canonicalNotificationString(BASE);
  const b = canonicalNotificationString({ ...BASE, title: '  Pembaruan Aplikasi ' });
  assert.equal(a, b);
});

test('expiresAt Date dan ISO string ekuivalen menghasilkan kanonik sama', () => {
  const asDate = canonicalNotificationString({ ...BASE, expiresAt: new Date('2030-01-01T00:00:00.000Z') });
  const asString = canonicalNotificationString({ ...BASE, expiresAt: '2030-01-01T00:00:00.000Z' });
  assert.equal(asDate, asString);
});

test('signature berbeda bila isi payload diubah (tamper terdeteksi)', () => {
  const signed = computeNotificationSignature(BASE, SECRET);
  const tampered = computeNotificationSignature({ ...BASE, title: 'Pembaruan Palsu' }, SECRET);
  assert.notEqual(signed, tampered);
});

test('verify menerima signature yang benar dan menolak yang salah', () => {
  const payload = { ...BASE, signature: computeNotificationSignature(BASE, SECRET) };
  assert.equal(verifyNotificationSignature(payload, SECRET), true);
  assert.equal(verifyNotificationSignature(payload, 'token-lain'), false);
});

test('verify menolak payload tanpa signature atau secret kosong', () => {
  assert.equal(verifyNotificationSignature(BASE, SECRET), false);
  const payload = { ...BASE, signature: computeNotificationSignature(BASE, SECRET) };
  assert.equal(verifyNotificationSignature(payload, ''), false);
  assert.equal(verifyNotificationSignature(payload, undefined), false);
});

test('perubahan satu karakter pada expiresAt merusak signature', () => {
  const withExpiry = { ...BASE, expiresAt: '2030-01-01T00:00:00.000Z' };
  const good = { ...withExpiry, signature: computeNotificationSignature(withExpiry, SECRET) };
  assert.equal(verifyNotificationSignature(good, SECRET), true);
  const shifted = { ...good, expiresAt: '2030-01-01T00:00:01.000Z' };
  assert.equal(verifyNotificationSignature(shifted, SECRET), false);
});
