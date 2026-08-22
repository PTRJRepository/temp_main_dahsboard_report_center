import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

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

export function ensureStorageRoot(): void {
  fs.mkdirSync(env.storagePath, { recursive: true });
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

  // ponytail: sharp auto-compression skipped for MVP (no extra dep, saves CPU at 17:00 burst).
  // Add when foto lapangan >2MB sering: sharp(buffer).resize({width:1920,height:1080,fit:'inside'}).jpeg({quality:80})

  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const safeBase = path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]/g, '_') || 'file';
  const systemName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${safeBase}${ext}`;
  const dir = path.join(env.storagePath, subFolder);
  fs.mkdirSync(dir, { recursive: true });
  const fullPath = path.join(dir, systemName);
  await fs.promises.writeFile(fullPath, buffer);
  const storagePath = path.join(subFolder, systemName).replace(/\\/g, '/');
  return { originalName, systemName, storagePath, sizeBytes: buffer.length, mimeType: mime, sha256 };
}

export function absolutePath(relativePath: string): string {
  // prevent traversal: relativePath must not escape storage root
  const full = path.resolve(path.join(env.storagePath, relativePath));
  const root = path.resolve(env.storagePath);
  if (!full.startsWith(root)) throw Object.assign(new Error('Invalid storage path'), { status: 400 });
  return full;
}

export function createReadStream(relativePath: string): fs.ReadStream {
  const full = absolutePath(relativePath);
  if (!fs.existsSync(full)) throw Object.assign(new Error('Berkas tidak ditemukan'), { status: 404 });
  return fs.createReadStream(full);
}

export async function getStorageHealth(): Promise<{
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  freePercentage: number;
  isAlertNeeded: boolean;
}> {
  try {
    const stats: any = await (fs.promises as any).statfs(env.storagePath);
    const totalBytes = stats.bsize * stats.blocks;
    const freeBytes = stats.bsize * stats.bfree;
    const usedBytes = totalBytes - freeBytes;
    const freePercentage = totalBytes ? (freeBytes / totalBytes) * 100 : 100;
    return { totalBytes, freeBytes, usedBytes, freePercentage, isAlertNeeded: freePercentage < 15 };
  } catch {
    return { totalBytes: 0, freeBytes: 0, usedBytes: 0, freePercentage: 100, isAlertNeeded: false };
  }
}
