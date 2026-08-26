'use strict';

/**
 * Windows Toast notifier via PowerShell WinRT (tanpa dependency eksternal).
 *
 * INDEX NOTIF — peta isi file (grep hint: "INDEX NOTIF")
 * ----------------------------------------------------------------------------
 *   escapeXml()                  : escaping teks untuk XML toast
 *   normalizePriority()          : low | normal | high | critical
 *   resolveScenario()            : priority -> scenario toast (Alarm/Reminder)
 *   resolveAudioXml()            : priority+sound -> elemen <audio>
 *   buildToastXml()              : rakit XML ToastGeneric (pure, unit-tested)
 *   runProcess()                 : spawn dengan timeout (kill saat hang)
 *   class WindowsToastNotifier   : display() via show-toast.ps1, fallback
 *                                  balloon tip via show-balloon.ps1
 *
 * Skrip pendukung (dipanggil powershell.exe -File, argumen aman quoting):
 *   assets/notifications/scripts/show-toast.ps1    (INDEX TOAST-PS1)
 *   assets/notifications/scripts/show-balloon.ps1  (INDEX BALLOON-PS1)
 *
 * Catatan prioritas:
 *   critical -> scenario Alarm  + bunyi Looping.Alarm (sticky + bunyi ulang)
 *   high     -> scenario Reminder (tetap di layar sampai user tutup)
 *   lainnya  -> toast biasa; sound=false membuat toast bisu (<audio silent/>)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PRIORITIES = new Set(['low', 'normal', 'high', 'critical']);

/** Escaping karakter berbahaya XML (& < > " ') agar aman di teks maupun atribut. */
export function escapeXml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/** Normalisasi prioritas; nilai tak dikenal jatuh ke 'normal'. */
export function normalizePriority(value) {
  const text = String(value ?? '').trim().toLowerCase();
  return PRIORITIES.has(text) ? text : 'normal';
}

/** Pemetaan priority -> atribut scenario pada elemen <toast>. */
export function resolveScenario(priority) {
  switch (normalizePriority(priority)) {
    case 'critical': return 'Alarm';
    case 'high': return 'Reminder';
    default: return 'Default';
  }
}

/** Elemen <audio> sesuai prioritas dan flag sound. */
export function resolveAudioXml(priority, sound) {
  if (sound === false) return '<audio silent="true"/>';
  if (normalizePriority(priority) === 'critical') {
    return '<audio src="ms-winsoundevent:Notification.Looping.Alarm" loop="true"/>';
  }
  return '<audio src="ms-winsoundevent:Notification.Default"/>';
}

/**
 * Rakit XML toast gaya korporat: judul, pesan, footer/attribution, logo
 * bulat, dan hero image tema. Path logo/hero HARUS sudah diverifikasi ada
 * oleh pemanggil (fungsi ini sengaja tidak menyentuh filesystem).
 */
export function buildToastXml(notification, options = {}) {
  const lines = [];
  lines.push(`<toast activationType="protocol" launch="" scenario="${resolveScenario(notification.priority)}">`);
  lines.push(`  <visual lang="${escapeXml(options.lang ?? 'id-ID')}">`);
  lines.push('    <binding template="ToastGeneric">');
  lines.push(`      <text>${escapeXml(notification.title)}</text>`);
  lines.push(`      <text>${escapeXml(notification.message)}</text>`);
  if (options.logoPath) {
    lines.push(`      <image placement="appLogoOverride" src="${escapeXml(options.logoPath)}" hint-crop="circle"/>`);
  }
  if (options.heroPath) {
    lines.push(`      <image placement="hero" src="${escapeXml(options.heroPath)}"/>`);
  }
  if (notification.footer) {
    lines.push(`      <text placement="attribution">${escapeXml(notification.footer)}</text>`);
  }
  lines.push('    </binding>');
  lines.push('  </visual>');
  lines.push(`  ${resolveAudioXml(notification.priority, notification.sound)}`);
  lines.push('</toast>');
  return lines.join('\n');
}

/** Spawn proses tanpa shell; resolve selalu (tidak pernah reject), kill saat timeout. */
function runProcess(command, args, timeoutMs) {
  return new Promise(resolve => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* proses sudah keluar */ }
      finish({ code: -1, stdout, stderr: `${stderr}\nTimeout after ${timeoutMs}ms`.trim() });
    }, timeoutMs);
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', err => finish({ code: -1, stdout, stderr: String(err?.message ?? err) }));
    child.on('close', code => finish({ code, stdout, stderr }));
  });
}

export class WindowsToastNotifier {
  /**
   * @param {object} options
   *   appUserModelId        : AUMID yang tampil sebagai nama aplikasi di toast
   *   assetsDirectory       : folder assets/notifications (berisi scripts/*.ps1)
   *   displayTimeoutSeconds : batas waktu tiap panggilan PowerShell
   *   toastScriptPath / balloonScriptPath : override lokasi skrip (untuk test)
   */
  constructor(options = {}) {
    this.assetsDirectory = options.assetsDirectory
      ?? path.join(process.cwd(), 'assets', 'notifications');
    this.appUserModelId = options.appUserModelId ?? 'PT.Rebinmas.IFESS.ClientApp';
    this.timeoutMs = Math.max(2000, Number(options.displayTimeoutSeconds ?? 10) * 1000);
    this.toastScriptPath = options.toastScriptPath
      ?? path.join(this.assetsDirectory, 'scripts', 'show-toast.ps1');
    this.balloonScriptPath = options.balloonScriptPath
      ?? path.join(this.assetsDirectory, 'scripts', 'show-balloon.ps1');
  }

  /**
   * Tampilkan notifikasi. Selalu resolve:
   *   { displayed: boolean, method: 'toast'|'balloon'|'none', message: string }
   */
  async display(notification) {
    const xml = buildToastXml(notification, {
      logoPath: notification.logoPath ?? null,
      heroPath: notification.heroPath ?? null,
    });
    const xmlFile = path.join(os.tmpdir(), `ifess-toast-${process.pid}-${Date.now()}.xml`);
    fs.writeFileSync(xmlFile, xml, 'utf8');
    try {
      const result = await runProcess(
        'powershell.exe',
        [
          '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
          '-File', this.toastScriptPath,
          '-XmlFile', xmlFile,
          '-AppId', this.appUserModelId,
        ],
        this.timeoutMs,
      );
      if (result.code === 0) {
        return { displayed: true, method: 'toast', message: 'ditampilkan via Windows Toast.' };
      }
      const reason = (result.stderr || `exit code ${result.code}`).trim();
      return await this.showBalloon(notification, reason);
    } finally {
      try { fs.unlinkSync(xmlFile); } catch { /* biarkan OS membersihkan */ }
    }
  }

  /** Fallback balloon tip tray untuk Windows lama / toast diblokir policy. */
  async showBalloon(notification, failureReason) {
    const priority = normalizePriority(notification.priority);
    const iconType = priority === 'critical' ? 'Error' : priority === 'high' ? 'Warning' : 'Info';
    const body = notification.details
      ? `${notification.message}\n${notification.details}`
      : String(notification.message ?? '');
    const durationMs = Math.min(this.timeoutMs, 10000);
    const result = await runProcess(
      'powershell.exe',
      [
        '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
        '-File', this.balloonScriptPath,
        '-Title', String(notification.title ?? ''),
        '-Message', body,
        '-IconType', iconType,
        '-DurationMs', String(durationMs),
      ],
      this.timeoutMs,
    );
    if (result.code === 0) {
      return {
        displayed: true,
        method: 'balloon',
        message: `ditampilkan via balloon tip (fallback; toast gagal: ${failureReason.slice(0, 160)})`,
      };
    }
    const balloonReason = (result.stderr || `exit code ${result.code}`).trim();
    return {
      displayed: false,
      method: 'none',
      message: `toast dan balloon sama-sama gagal. toast: ${failureReason.slice(0, 200)} | balloon: ${balloonReason.slice(0, 200)}`,
    };
  }
}
