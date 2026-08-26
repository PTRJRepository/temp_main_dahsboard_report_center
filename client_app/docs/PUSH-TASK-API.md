# API Task Notifikasi — EXECUTE_SHOW_NOTIFICATION

Panduan lengkap untuk **aplikasi lain/operator** yang ingin mendaftarkan dan memanggil
task notifikasi/pengingat menuju IFESS client tertentu. Sistem ini **satu arah**
(server → client); client tidak membalas isi notifikasi, hanya status eksekusi command.

```
Aplikasi lain / Operator                Client Kerani (headless)
        │                                       ▲
        │  1. DAFTARKAN task (enqueue)          │ 4. tampilkan Toast + widget
        ▼                                       │    pengingat terpin
   Control Server ──2. antrian commands.json ───┤
        ▲                                       │ 5. commandResult (Success/Failed)
        └────── 3. client POLL tiap 5 detik ────┘    (infrastruktur standar)
```

---

## 1. Prasyarat

| Butuh | Keterangan |
|---|---|
| URL server | Direct `http://<host>:8003` atau via proxy `<gateway>/ifess` |
| `X-API-Key` | Harus sama dengan `IFESS_API_KEY` server |
| `NOTIFY_TOKEN` *(opsional, disarankan)* | Shared secret HMAC. Bila client mengisi `verifyToken`, **hanya payload bertanda tangan yang valid** |

> Konvensi penamaan: variabel lingkungan di sisi pengirim disebut `NOTIFY_TOKEN`;
> di sisi client nilainya dikonfigurasi sebagai `customConfig.verifyToken`.
> Isi keduanya HARUS sama persis.

## 2. Memilih client tujuan

```powershell
# Lihat daftar client terdaftar (untuk memilih target):
node scripts/send-notification.mjs --server http://10.0.0.128:8003 `
  --api-key <IFESS_API_KEY> --list-clients
```

Aturan pemilihan target pada level protokol:

| Target | Cara |
|---|---|
| Satu client | `POST /api/clients/{clientId}/commands` |
| Beberapa client | Ulangi POST untuk tiap id, atau (mock/admin) `clientIds: [...]` |
| Semua client | Loop `GET /api/clients` lalu POST ke masing-masing; CLI menyediakan `--all`; mock admin: kosongkan target |

Endpoint kontrak server asli (js-server Kerani):

```http
GET  /api/clients                              -> daftar client terdaftar
POST /api/clients/{clientId}/commands          -> daftarkan task ke SATU client
```

Mock server pengujian (`npm run mock:server`) menyediakan tambahan admin:

```http
POST /admin/command  {commandId?, commandType, moduleCode?, payload}   -> broadcast
POST /admin/notify   {title, message, ..., clientId? | clientIds? }    -> task notifikasi
GET  /admin/events                                                     -> observasi hasil
```

## 3. Mendaftarkan task (payload lengkap)

Body `POST /api/clients/{id}/commands`:

```json
{
  "commandType": "EXECUTE_SHOW_NOTIFICATION",
  "moduleCode": "IFESS_PUSH_NOTIFICATION",
  "payload": {
    "notificationId": "NTF-20260826-001",
    "category": "update",
    "priority": "high",
    "title": "Pembaruan Sistem Tersedia",
    "message": "Hubungi Divisi IT untuk penjadwalan pembaruan.",
    "details": "Opsional: baris tambahan.",
    "footer": "PT. Rebinmas Jaya • Divisi IT",
    "theme": "default",
    "expiresAt": "2026-08-27T00:00:00.000Z",
    "sound": true,
    "signature": "<hex-hmac-jika-token-aktif>"
  }
}
```

| Field | Wajib | Aturan |
|---|---|---|
| `notificationId` | – | Kunci dedupe (maks 100 kar.). Kosong = dari commandId |
| `title` / `message` | ✔ | Non-kosong; default maks 120 / 600 karakter |
| `category` | – | announcement, update, instruction, alert, maintenance, reminder |
| `priority` | – | low, normal, high (sticky), critical (sticky + alarm berulang) |
| `details` | – | Teks tambahan (fallback balloon menampilkannya) |
| `footer` | – | Attribution; default dari config client |
| `theme` | – | harvest, maintenance, safety, default (memilih banner hero) |
| `expiresAt` | – | ISO date; kadaluarsa → dilewati dengan pesan jelas |
| `sound` | – | `false` = toast bisu |
| `signature` | kondisional | WAJIB bila client mengaktifkan `verifyToken` |

## 4. Memanggil / mengirim task

### a. CLI helper (paling cepat)

```powershell
node scripts/send-notification.mjs --server http://10.0.0.128:8003 `
  --api-key <IFESS_API_KEY> --token <NOTIFY_TOKEN> `
  --client CLIENT-PTRJ-ARE-A `
  --category update --priority high `
  --title "Pembaruan Sistem Tersedia" `
  --message "Hubungi Divisi IT untuk penjadwalan." `
  --expires-minutes 720
# varian: --client A,B,C  ·  --all  ·  --silent  ·  --theme harvest  ·  --id NTF-X
```

### b. PowerShell langsung

```powershell
$payload = @{
  notificationId = "NTF-$([DateTime]::Now.ToString('yyyyMMdd-HHmmss'))"
  category='update'; priority='high'
  title='Pembaruan Sistem Tersedia'; message='Hubungi Divisi IT.'
} | ConvertTo-Json -Depth 4 | ConvertFrom-Json

# (opsional) tandatangani bila client mengaktifkan verifyToken:
$token = $env:NOTIFY_TOKEN
$canonical = "v1|$($payload.notificationId)|$($payload.category)|$($payload.priority)|$($payload.title)|$($payload.message)||"
$hmac = [System.Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($token))
$payload | Add-Member signature (-join ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical)) | ForEach-Object ToString x2))

$body = @{ commandType='EXECUTE_SHOW_NOTIFICATION'; moduleCode='IFESS_PUSH_NOTIFICATION'
           payload=$payload } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://10.0.0.128:8003/api/clients/CLIENT-PTRJ-ARE-A/commands" `
  -Headers @{ 'X-API-Key' = $env:IFESS_API_KEY } -ContentType 'application/json' -Body $body
```

### c. Node.js (fetch)

```js
const payload = {
  notificationId: `NTF-${Date.now()}`,
  category: 'instruction', priority: 'critical',
  title: 'Panen Blok C dimulai 07:00',
  message: 'Seluruh kerani blok C wajib hadir di titik kumpul.',
};
// const signature = computeNotificationSignature(payload, process.env.NOTIFY_TOKEN);

await fetch(`${SERVER}/api/clients/CLIENT-PTRJ-ARE-A/commands`, {
  method: 'POST',
  headers: { 'X-API-Key': process.env.IFESS_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ commandType: 'EXECUTE_SHOW_NOTIFICATION', moduleCode: 'IFESS_PUSH_NOTIFICATION', payload }),
});
```

Atau pakai fungsi siap-pakai dari repo ini:

```js
import { validateNotificationPayload, computeNotificationSignature } from './src/modules/push-notification.js';
const { ok, value, error } = validateNotificationPayload(rawPayload);
if (!ok) throw new Error(error);
value.signature = computeNotificationSignature(value, process.env.NOTIFY_TOKEN);
```

## 5. Verifikasi token di sisi client (INDEX VERIFY)

Bentuk kanonik **v1** (field kosong → string kosong; trim tepi):

```
v1|notificationId|category|priority|title|message|details|expiresAt(raw)
```

`signature = HMAC-SHA256(canonicalString, NOTIFY_TOKEN)` dalam hex lowercase.
Field `signature` sendiri tidak ikut kanonik. Perilaku client:

| Config `verifyToken` | Payload tanpa signature | Payload signature salah |
|---|---|---|
| kosong (default) | ✅ diterima (mode kompatibel) | ✅ diterima (diabaikan) |
| diisi | ❌ Failed `Verifikasi gagal` | ❌ Failed `Verifikasi gagal` |

Aktifkan di `client.config.local.json` (gitignored):

```jsonc
{ "modules": [ { "Code": "IFESS_PUSH_NOTIFICATION",
                 "customConfig": { "verifyToken": "<NOTIFY_TOKEN>" } } ] }
```

Perbandingan memakai `crypto.timingSafeEqual`. Urutan pemeriksaan client:
**verifikasi → validasi → expiry → dedupe → tampil**.

## 6. Perilaku setelah diterima

- **Toast Windows** korporat (logo + banner tema); `critical` sticky+bunyi berulang.
- **Widget pengingat terpin**: kartu masuk daftar pengingat; kerani bisa menghapus
  per kartu (`Hapus`) atau `Bersihkan semua` — hapus bersifat lokal.
- **Dedupe**: `notificationId` sama tidak pernah tampil dua kali (persisten antar restart).
- **Riwayat**: `data/notifications/history-YYYY-MM-DD.jsonl` + inbox widget.
- **Fallback**: toast gagal → balloon tray → gagal lagi → command `Failed` dengan alasan.

## 7. Status hasil (commandResult)

Client melapor lewat `POST /api/clients/{id}/commands/{commandId}/result`:

| status | contoh message |
|---|---|
| Success | `Notifikasi '<judul>' ditampilkan (toast).` / `(dry-run)` |
| Success | `Duplikat dilewati: <id> sudah ditampilkan sebelumnya.` |
| Success | `Kadaluarsa dilewati: <id>.` |
| Failed | `Verifikasi gagal: signature hilang atau tidak cocok...` |
| Failed | `Payload tidak valid: title wajib diisi.` dst. |

Latensi tampil mengikuti `commandPollIntervalSeconds` client (default 5 detik).

## 8. Troubleshooting singkat

| Gejala | Sebab umum |
|---|---|
| HTTP 401 saat enqueue | `X-API-Key` beda dengan `IFESS_API_KEY` server |
| Failed `Verifikasi gagal` | NOTIFY_TOKEN ≠ verifyToken client, atau payload berubah setelah signing |
| Tidak muncul apa pun | Client mati; Focus Assist; cek riwayat jsonl & log modul |
| `Duplikat dilewati` padahal baru | notificationId bentrok dengan kiriman lama — pakai id unik |
