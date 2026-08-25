// Lapisan penyimpanan RJFM — berkas fisik disimpan di NAS Synology
// (http://RJFM_NAS_URL) via FileStation API. Path relatif (mis. "tasks/12/assign_13/x.pdf")
// dipetakan ke folder dasar RJFM_STORAGE_PATH (mis. /IT/Extend Server Portal/RJFM).
//
// Sebelumnya: SMB mount Z:. Kini HTTP murni agar modul tidak bergantung pada
// drive mapping Windows.
import path from 'node:path'
import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import { env } from '../config/env.js'
import * as nas from './nas.js'

export type SavedFile = {
  originalName: string;
  systemName: string;
  storagePath: string; // relative
  sizeBytes: number;
  mimeType: string;
  sha256: string;
};

const EXT_MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.kml': 'application/vnd.google-earth.kml+xml',
  '.kmz': 'application/vnd.google-earth.kmz',
  '.csv': 'text/csv',
  '.txt': 'text/plain',
};

const ALLOWED_MIMES = new Set(Object.values(EXT_MIME));

function mimeForExt(ext: string): string {
  return EXT_MIME[ext.toLowerCase()] || 'application/octet-stream';
}

/** Pastikan folder dasar tersedia di NAS (mkdir -p). */
export async function ensureStorageRoot(): Promise<void> {
  await nas.nasEnsureDir(env.storagePath.replace(/\/+$/, ''))
}

export async function saveBuffer(
  buffer: Buffer,
  originalName: string,
  subFolder: string,
): Promise<SavedFile> {
  const ext = path.extname(originalName).toLowerCase();
  const mime = mimeForExt(ext);
  if (!ALLOWED_MIMES.has(mime)) {
    throw Object.assign(new Error(`Format '${ext}' tidak diizinkan. Hanya PDF, Word, Excel, foto, video, KML/KMZ, CSV, TXT.`), {
      status: 415,
    });
  }
  if (buffer.length > env.maxFileMb * 1024 * 1024) {
    throw Object.assign(new Error(`Ukuran melebihi ${env.maxFileMb} MB.`), { status: 413 });
  }

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const systemName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeBase}${ext}`;
  const dirRel = String(subFolder || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const absDir = dirRel ? `${env.storagePath.replace(/\/+$/, '')}/${dirRel}` : env.storagePath;
  await nas.nasUpload(absDir, systemName, buffer);
  const storagePath = [dirRel, systemName].filter(Boolean).join('/');
  return { originalName, systemName, storagePath, sizeBytes: buffer.length, mimeType: mime, sha256 };
}

/**
 * Content-Disposition yang benar menurut RFC 6266/5987:
 * `filename*=` (UTF-8) untuk nama non-ASCII, `filename=` fallback ASCII.
 */
export function contentDisposition(name: string, disposition: 'inline' | 'attachment' = 'inline'): string {
  const ascii = String(name).replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_').slice(0, 150) || 'file';
  return `${disposition}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/'/g, '%27')}`;
}

/** Stat berkas relatif → { size, mtime } atau null bila tidak ada. */
export async function statRemote(relativePath: string): Promise<{ size: number; mtime: number } | null> {
  const f = await nas.nasStat(nas.nasFullPath(relativePath));
  if (!f || f.isdir) return null;
  return { size: f.size, mtime: f.mtime };
}

/** Hapus berkas/folder relatif dari NAS. */
export async function deleteRemote(relativePath: string): Promise<void> {
  await nas.nasRemove([nas.nasFullPath(relativePath)]);
}

/** Unduh seluruh isi berkas relatif. Null bila berkas tidak ada di NAS. */
export async function downloadBuffer(relativePath: string): Promise<Buffer | null> {
  return nas.nasDownload(nas.nasFullPath(relativePath));
}

/** Bungkus buffer menjadi stream Readable (dipakai route stream). */
export function bufferToStream(buffer: Buffer): Readable {
  return Readable.from(buffer);
}

/** Walk seluruh berkas di bawah root storage → daftar relatif + ukuran + mtime. */
export async function listAllFiles(): Promise<Array<{ rel: string; size: number; mtime: number }>> {
  return nas.nasWalk('');
}

export async function getStorageHealth(): Promise<{
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freePercentage: number;
  isAlertNeeded: boolean;
}> {
  try {
    const reachable = await nas.nasPing();
    if (!reachable) throw new Error('NAS unreachable');
    // Kuota volume share tidak diekspos FileStation — laporkan sehat tanpa angka.
    return { totalBytes: 0, freeBytes: 0, usedBytes: 0, freePercentage: 100, isAlertNeeded: false };
  } catch {
    return { totalBytes: 0, freeBytes: 0, usedBytes: 0, freePercentage: 100, isAlertNeeded: false };
  }
}
