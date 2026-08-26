'use strict';

/**
 * Unit test pembangun XML Windows Toast (INDEX NOTIF).
 * Jalankan: node --test tests/toast-xml.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  escapeXml,
  normalizePriority,
  resolveScenario,
  resolveAudioXml,
  buildToastXml,
} from '../src/notifications/toast-notifier.js';

test('escapeXml mengganti kelima karakter berbahaya XML', () => {
  assert.equal(
    escapeXml(`A & B <tag> "q" 'a'`),
    'A &amp; B &lt;tag&gt; &quot;q&quot; &apos;a&apos;',
  );
});

test('escapeXml aman untuk nilai null/undefined', () => {
  assert.equal(escapeXml(null), '');
  assert.equal(escapeXml(undefined), '');
});

test('normalizePriority menerima empat nilai resmi', () => {
  for (const value of ['low', 'normal', 'high', 'critical']) {
    assert.equal(normalizePriority(value), value);
  }
});

test('normalizePriority melonggarkan nilai tak dikenal ke normal', () => {
  assert.equal(normalizePriority('URGENT'), 'normal');
  assert.equal(normalizePriority(''), 'normal');
  assert.equal(normalizePriority(undefined), 'normal');
});

test('resolveScenario memetakan critical->Alarm dan high->Reminder', () => {
  assert.equal(resolveScenario('critical'), 'Alarm');
  assert.equal(resolveScenario('high'), 'Reminder');
  assert.equal(resolveScenario('normal'), 'Default');
  assert.equal(resolveScenario('low'), 'Default');
});

test('resolveAudioXml: sound=false menghasilkan toast bisu', () => {
  assert.equal(resolveAudioXml('critical', false), '<audio silent="true"/>');
});

test('resolveAudioXml: critical memakai bunyi alarm berulang', () => {
  const audio = resolveAudioXml('critical', true);
  assert.match(audio, /Notification\.Looping\.Alarm/);
  assert.match(audio, /loop="true"/);
});

test('resolveAudioXml: prioritas lain memakai bunyi default', () => {
  assert.match(resolveAudioXml('normal', true), /Notification\.Default/);
});

test('buildToastXml menyusun judul, pesan, footer, logo, hero', () => {
  const xml = buildToastXml(
    { title: 'Judul', message: 'Isi pesan', footer: 'PT. Rebinmas Jaya', priority: 'high', sound: true },
    { logoPath: 'C:\\assets\\logo.png', heroPath: 'C:\\assets\\banner-update.png' },
  );
  assert.match(xml, /<toast[^>]*scenario="Reminder"/);
  assert.match(xml, /<text>Judul<\/text>/);
  assert.match(xml, /<text>Isi pesan<\/text>/);
  assert.match(xml, /placement="attribution"[^>]*>PT\. Rebinmas Jaya<\/text>/);
  assert.match(xml, /placement="appLogoOverride"[^>]*src="C:\\assets\\logo.png"/);
  assert.match(xml, /placement="hero"[^>]*src="C:\\assets\\banner-update.png"/);
});

test('buildToastXml meng-escape teks dari server sebelum masuk XML', () => {
  const xml = buildToastXml(
    { title: 'A<b>&c', message: "pesan 'aneh'", priority: 'normal', sound: true },
    {},
  );
  assert.match(xml, /<text>A&lt;b&gt;&amp;c<\/text>/);
  assert.match(xml, /pesan &apos;aneh&apos;/);
});

test('buildToastXml tanpa footer/logo/hero tidak menempelkan elemen kosong', () => {
  const xml = buildToastXml({ title: 'T', message: 'M', priority: 'low', sound: false }, {});
  assert.ok(!xml.includes('appLogoOverride'));
  assert.ok(!xml.includes('placement="hero"'));
  assert.ok(!xml.includes('attribution'));
  assert.match(xml, /<audio silent="true"\/>/);
});
