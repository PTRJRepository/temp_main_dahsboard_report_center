export function validateFeedback(status: string, feedback: unknown): string | null {
  if (status !== 'REJECTED_NEEDS_REVISION') return null;
  if (typeof feedback !== 'string' || feedback.trim().length < 10) {
    return 'Instruksi revisi wajib diisi minimal 10 karakter agar kerani paham letak perbaikan.';
  }
  return null;
}

// minimal magic-bytes check (ponytail: full file-type lib when spoof attacks observed)
const MAGIC: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', bytes: [0x47, 0x49, 0x46] }, // GIF8
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (webp container)
  { mime: 'video/mp4', bytes: [0x00, 0x00, 0x00] }, // ftyp box (cek ftyp di bawah)
  { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bytes: [0x50, 0x4b, 0x03, 0x04] }, // zip/ooxml
  { mime: 'application/vnd.ms-excel', bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE
];

export function sniffMime(buffer: Buffer): string | null {
  for (const { mime, bytes } of MAGIC) {
    if (bytes.every((b, i) => buffer[i] === b)) {
      if (mime === 'video/mp4') {
        const brand = buffer.toString('latin1', 4, 8);
        if (brand !== 'ftyp') return null;
      }
      return mime;
    }
  }
  // KML/KMZ: XML teks — deteksi via root element (ponytail: cek deklarasi namespace penuh jika perlu)
  const head = buffer.subarray(0, 512).toString('utf8').trim().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<kml')) {
    if (head.includes('<kml')) return 'application/vnd.google-earth.kml+xml';
  }
  if (head.startsWith('pk')) return null; // kmz = zip; sudah tertangani zip magic di atas
  return null;
}

// ---- Sanitasi upload: blokir ekstensi/mime berbahaya & rapikan nama file ----

// Ekstensi yang diizinkan setelah magic bytes cocok. Semua executable/script diblok.
const SAFE_EXT_BY_MIME: Record<string, string[]> = {
  'application/pdf': ['pdf'],
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/gif': ['gif'],
  'image/webp': ['webp'],
  'video/mp4': ['mp4'],
  'video/webm': ['webm'],
  'text/plain': ['txt'],
  'text/csv': ['csv'],
  'application/vnd.ms-excel': ['xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['xlsx'],
  'application/msword': ['doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['docx'],
  'application/vnd.google-earth.kml+xml': ['kml'],
  'application/vnd.google-earth.kmz': ['kmz'],
};

const BLOCKED_EXT = /\.(exe|dll|bat|cmd|com|scr|pif|msi|sh|bash|ps1|vbs|js|mjs|jar|hta|cpl|msc|reg|lnk|iso|img|vhd|apk|app|deb|rpm)$/i;

/** Rapikan nama file: buang path, kontrol char, titik berbahaya; batasi panjang. */
export function sanitizeFilename(raw: string): string {
  const base = String(raw || 'file')
    .split(/[\\/]/).pop()!          // buang komponen path
    .replace(/[\u0000-\u001f<>:"|?*]/g, '') // kontrol + char ilegal Windows
    .replace(/^\.+/, '')            // leading dots (hidden / traversal)
    .trim()
    .slice(0, 180);
  return base || 'file';
}

/**
 * Validasi konsistensi nama ↔ konten. Return null jika aman, atau pesan error.
 * - tolak ekstensi berbahaya walau isi tersembunyi sebagai pdf (double-ext)
 * - ekstensi wajib ada dan termasuk daftar aman untuk mime hasil sniff
 */
export function validateUpload(filename: string, sniffedMime: string | null): string | null {
  const name = sanitizeFilename(filename);
  if (BLOCKED_EXT.test(name)) return `Ekstensi berbahaya tidak diizinkan: ${name.split('.').pop()}`;
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (!ext) return 'Berkas harus punya ekstensi (mis. .pdf)';
  const safeExts = sniffedMime ? SAFE_EXT_BY_MIME[sniffedMime] : null;
  if (!sniffedMime) return 'Tipe konten tidak dikenali — hanya PDF, gambar, video mp4/webm, Office, KML/KMZ, CSV/TXT.';
  if (!safeExts?.includes(ext)) return `Isi berkas (${sniffedMime}) tidak cocok dengan ekstensi .${ext}. Ganti nama atau periksa berkas.`;
  return null;
}
