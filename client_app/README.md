# IFESS Client App

Aplikasi **sisi client** untuk **IFESS Control Server** (`Kerani_Super_App/IFESS.ControlServer/js-server`, port 8003).
Ini adalah port Node.js dari client resmi `IFESS.SuperApp` (.NET) dengan kontrak protokol yang sama persis,
ditempatkan di dalam repo Main Dashboard supaya gampang di-maintain di satu tempat.

> Server-nya tetap ada di `D:\Gawean Rebinmas\Kerani_Super_App\IFESS.ControlServer\js-server`.
> Aplikasi ini HANYA sisi client: register, heartbeat, terima command, eksekusi, lapor hasil.

## Fitur

| Kemampuan | Keterangan |
|---|---|
| Register + Heartbeat | Retry otomatis dengan exponential backoff + jitter; re-register saat koneksi putus |
| Command polling | Bounded in-flight pool (default 3); command lambat tidak memblokir polling |
| `PING` | Dibalas `pong from <host>` |
| `START/STOP/RESTART_MODULE`, `START_ALL_MODULES`, `STOP_ALL_MODULES` | Kontrol lifecycle modul internal |
| `EXECUTE_AUTO_TASK_KILL` | Kill proses (taskkill /T /F), mode `KillNow` / `Schedule` (Once/Daily) / `RemoveSchedule`; jadwal persisten di `data/auto-task-kill-schedules.json` |
| `EXECUTE_FIREBIRD_QUERY` | Validasi ulang read-only di client, materialisasi parameter (`:name` / `{{name}}`), eksekusi via `isql.exe`, hasil inline/chunked |
| Result outbox | Hasil query yang gagal terkirim disimpan lokal (`data/query-gateway-outbox`) dan dikirim ulang otomatis saat server hidup |

Tidak didukung (jelas ditolak, bukan diam): `EXECUTE_GDRIVE_BACKUP` (backup Google Drive tidak ikut dipaketkan di client Node ini).

## Struktur

```text
client_app/
├── client.config.json          # Konfigurasi utama (JSONC, boleh komentar //)
├── client.config.local.json    # Override lokal opsional (gitignored) - kredensial mesin ini
├── package.json
├── src/
│   ├── index.js                # Entrypoint: wiring config, registry, loop heartbeat/polling
│   ├── config.js               # Loader JSONC + deep merge + override *.local.json
│   ├── logger.js               # Log harian logs/host & logs/modules/<CODE>, redaksi secret
│   ├── retry.js                # Backoff eksponensial+jitter, sleep, interruptibleSleep
│   ├── control-client.js       # HTTP client kontrak Control Server
│   ├── firebird/
│   │   ├── validator.js        # Port ReadOnlyQueryValidator.cs (SELECT/WITH SELECT saja)
│   │   ├── materializer.js     # Port QueryParameterMaterializer.cs (:name, {{name}})
│   │   ├── tool-resolver.js    # Port FirebirdToolResolver.cs (auto-detect isql.exe)
│   │   └── executor.js         # Spawn isql.exe + parser output fixed-width
│   ├── reporting/
│   │   ├── reporter.js         # Envelope inline/chunked (QueryResultReporter.cs)
│   │   └── outbox.js           # Outbox durable (QueryResultOutbox.cs)
│   └── modules/
│       ├── registry.js         # Status modul ala ModuleRegistry.cs
│       ├── auto-task-kill.js   # Worker jadwal + handler EXECUTE_AUTO_TASK_KILL
│       ├── query-gateway.js    # Worker pool + handler EXECUTE_FIREBIRD_QUERY
│       ├── module-control.js   # Handler PING / START/STOP_MODULE dll.
│       ├── command-executor.js # Router command -> handler pertama yang cocok
│       ├── heartbeat.js        # Loop register+heartbeat
│       └── polling.js          # Loop polling command
├── scripts/
│   ├── mock-control-server.mjs # Mock server kontrak penuh (untuk dev/test)
│   ├── e2e-test.mjs            # Harness regresi end-to-end otomatis
│   └── test.config.json        # Config contoh untuk mock
└── tests/                      # Unit test (node --test)
```

## Menjalankan

Butuh **Node.js >= 18**. Tidak ada dependency eksternal.

```powershell
cd "D:\Gawean Rebinmas\Main Dashboard\client_app"
npm start                       # pakai client.config.json
node src/index.js --config <file-lain.json>
```

### Mode koneksi

Di `controlServer.baseUrl`:

- **Direct** ke IFESS Client Gateway: `http://10.0.0.128:8003`
- **Reverse proxy lewat Main Dashboard**: `http://10.0.0.110:3001/ifess`

`apiKey` harus sama dengan `IFESS_API_KEY` di JS server.

### Override lokal

Buat `client.config.local.json` (otomatis dibaca kalau ada, sudah gitignored).
Cukup isi bagian yang mau dioverride:

```json
{
  "controlServer": { "clientId": "CLIENT-PABRIK-01" },
  "modules": []
}
```

## Keamanan

- **Read-only dua lapis**: server memvalidasi, client memvalidasi ULANG sebelum menyentuh Firebird
  (`SELECT ...` / `WITH ... SELECT ...` saja; comment, multi-statement, DML/DDL/transaction ditolak).
- **Parameter dimaterialisasi menjadi literal SQL aman** (escape `'` → `''`); tipe didukung:
  string, int/long, decimal, bool, date, timestamp.
- **Password isql tidak lewat argv**: dikirim via env `ISC_PASSWORD` sehingga tidak terlihat di
  process listing Windows (`-p` dihindari). Error isql selalu di-redact.
- **Redaksi secret di log**: API key dan password DB tidak pernah tertulis ke file log/konsol.
- **Protected processes**: daftar proses Windows kritiss + diri sendiri tidak akan pernah dikenai kill.
  Untuk production gunakan user Firebird read-only (mis. `PTRJ_IFESS_GATEWAY`), bukan SYSDBA.

## Operasional

- **Log**: `logs/host/YYYY-MM-DD.log` dan `logs/modules/<CODE>/YYYY-MM-DD.log`; retensi default 14 hari.
- **Outbox**: jika server mati saat result query dikirim, envelope tersimpan di
  `data/query-gateway-outbox/` dan di-flush tiap 10 detik setelah server reachable lagi.
- **Jadwal kill**: tersimpan di `data/auto-task-kill-schedules.json`; bertahan across restart.
- **Tuning beban** (paritas panduan CLIENT-OPERATIONS.md): naikkan bertahap
  `maxConcurrentQueries` (3→5), `maxQueueSize` (20→50), `maxCommandsPerPoll` (20→30),
  `commandPollIntervalSeconds` bisa 1–5 sesuai kebutuhan responsivitas.

## Testing

```powershell
npm test           # unit test (validator, materializer, parser isql, jadwal ATK, backoff)
npm run test:e2e   # end-to-end penuh: mock server + client asli + 9 assertion protokol
```

Harness e2e memverifikasi siklus nyata: register → heartbeat → PING → Auto Task Kill →
penolakan INSERT oleh validator → failure report → STOP/START module.

## Catatan debugging (untuk pengelola)

- Routing berbasis `segments[]` di mock server punya blok komentar **INDEX MAP** di atasnya;
  cari dengan grep `INDEX MAP` sebelum mengubah path manapun.
- Kesalahan indeks segmen adalah root cause bug klasik di proyek ini (sudah 2 kejadian):
  `/clients/{id}/commands/{cid}/result` = `[3]=commands [4]={cid} [5]=result`,
  sedangkan `/query-gateway/jobs/{jid}/result` = `[2]=jobs [3]={jid} [4]=result`.
