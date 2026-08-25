# sql-gateway — Internal SQL Gateway Module

Internal SQL bridge untuk MSSQL, dimigrasikan dari `D:/Tools_Gawe/Database_Query_Gateway`
ke dalam monorepo sebagai **module service** yang berdiri sendiri — plus
**traffic monitoring UI unified**, **audit log**, dan **internal API** yang bisa
dipakai module lain.

- **Port**: `8001` · **Route UI**: `/sql-gateway` (SSO portal) · **Route API**: `/api/sql-gateway`
- **Stack**: Fastify 5 + mssql (tedious) + node-sql-parser, TypeScript strict, jalan di Bun atau Node.
- **Kontrak monorepo**: `docs/MONOREPO.md` — folder sendiri, port sendiri, `bun start` mandiri,
  teregistrasi di `routes-config.json` (+ production), tanpa import lintas-module.

---

## Menjalankan

```bash
cd "Module Services/sql-gateway"
cp .env.example .env        # lalu isi: SQLGW_API_KEYS + DATABASE_PROFILES_* (format sama persis dgn gateway lama)
bun install                 # sekali per mesin
bun start                   # produksi   → http://0.0.0.0:8001
bun run dev                 # watch mode
npm run start:node          # alternatif Node via tsx
npm run typecheck           # tsc --noEmit
```

Tanpa `DATABASE_PROFILES_*` server tetap hidup dalam mode *degraded*:
`/health` OK (`"degraded":true`), UI & monitor jalan, semua query ditolak rapi.

> **Port 8001 = port lama gateway eksternal.** Sengaja dipertahankan agar
> pemanggil lama yang menunjuk `http://<host>:8001/v1/query` tidak berubah.
> Alias `/query/v1/*` juga tersedia untuk pola lewat route gateway `/query`
> (rewritePath:false). Pastikan proses gateway lama sudah berhenti sebelum
> `bun start`, karena keduanya memakai port yang sama.
>
> **Dua lapis key di jalur legacy `/query` (via :3001):** gateway tetap
> memvalidasi `x-api-key` terhadap env `QUERY_API_KEY` miliknya
> (`server_bun.js` Phase 5) sebelum meneruskan ke modul; modul lalu
> memvalidasi terhadap `SQLGW_API_KEYS`. Agar caller lama lewat `/query`
> tidak berubah, masukkan nilai `QUERY_API_KEY` lama sebagai salah satu
> entry di `SQLGW_API_KEYS` (beri nama, mis. `"legacy-query"`). Caller yang
> langsung ke `:8001/v1/*` hanya melewati key modul — pola lama persis sama.
> Rekomendasi jangka panjang: migrasikan caller ke `/api/sql-gateway`
> (satu lapis key modul saja).

## Akses & Auth (3 mode + halaman login)

| Mode | Cara | Identitas tercatat di audit |
|---|---|---|
| **M2M via gateway** | `POST :3001/api/sql-gateway/v1/query` + header `x-api-key` | `api:<nama-key>` |
| **M2M direct port** | `POST :8001/v1/query` + header `x-api-key` | `api:<nama-key>` |
| **Browser via portal SSO** | buka `:3001/sql-gateway/` (cookie RS256 diverifikasi gateway → header `X-User-*`) — **tidak ada login kedua, langsung masuk** | `user:<name>` |
| **Browser direct port** | `:8001/` tanpa sesi → **302 ke `/login`** → SSO portal atau tempel API key; cookie diverifikasi sendiri via shared/authkit (`keys/public.pem`) | `user:<name>` |

Alur auth di modul (`src/plugins/auth.ts`):

1. `x-api-key` valid → service principal (timing-safe; key salah = 401 keras,
   tercatat sebagai `invalid-api-key`).
2. Header `X-User-*` dari peer loopback (hasil proxy gateway) → dipercaya,
   tidak ada langkah login tambahan.
3. Cookie portal RS256 → diverifikasi memakai **authkit bersama di repo**
   (`shared/authkit/index.js` — single source of truth di luar Module
   Services, sesuai arahan; salinan lokal `src/lib/authkit.js` hanya fallback
   bila folder dilepas dari monorepo).
4. Selain itu: permintaan browser (GET non-API) → redirect ke
   `/login?next=…`; panggilan API → 401 JSON.

Halaman `/login` (publik) menyediakan:

- Tombol **Masuk lewat Portal SSO** (membuka `SQLGW_LOGIN_URL`, default
  `http://localhost:3001/login`; setelah login di portal, cookie yang sama
  otomatis mengautentikasi port langsung karena host-nya sama).
- Kolom **API key** untuk akses mesin/direct-port: diverifikasi dulu lewat
  `/monitor/self`, lalu disimpan di `localStorage` browser dan dikirim
  sebagai header pada tiap request (pola yang sama dengan Swagger
  *persistAuthorization*). Tombol ⎋ di dashboard menghapusnya.

### Konfigurasi API key (`.env`)

```json
SQLGW_API_KEYS={"KUNCI_PANJANG_1":{"name":"report-center","readOnly":true},"KUNCI_PANJANG_2":{"name":"admin-cli","readOnly":false}}
```

- `readOnly:true` → hanya SELECT di semua profil.
- `readOnly:false` → write/DDL hanya pada pasangan **write window**
  (`SQLGW_FULLACCESS_PROFILE` + `SQLGW_FULLACCESS_DB`, default
  `SERVER_PROFILE_1` + `extend_db_ptrj` — perilaku identik dengan gateway lama).
- User portal: role `ADMIN` setara full access; role lain read-only.
- `API_TOKEN` lama masih didukung sebagai admin key bernama `legacy-token`.

### Rate limit

`SQLGW_RATE_LIMIT_PER_MIN` (default 120/menit) per kombinasi caller+IP khusus path `/v1/*`;
lebih → `429` + event `rate-limited`.

## Internal API (untuk module lain)

Semua respons mempertahankan bentuk gateway lama (`success/server/db/execution_ms/data/error`)
sehingga pemanggil lama cukup ganti base URL:

```bash
# Daftar profil + health pool
curl -H "x-api-key: $KEY" http://localhost:3001/api/sql-gateway/v1/servers

# Query tunggal
curl -X POST -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"sql":"SELECT TOP 10 * FROM HR_EMPLOYEE","database":"db_ptrj","server":"SERVER_PROFILE_2"}' \
  http://localhost:3001/api/sql-gateway/v1/query

# Batch (sekuensial, tanpa transaksi — seperti sumber)
curl -X POST -H "x-api-key: $KEY" -H "content-type: application/json" \
  -d '{"queries":[{"sql":"..."},{"sql":"..."}]}' \
  http://localhost:3001/api/sql-gateway/v1/query/batch

# Daftar database di sebuah profil
curl -H "x-api-key: $KEY" "http://localhost:3001/api/sql-gateway/v1/databases?server=SERVER_PROFILE_1"

# Purge / statistik cache hasil baca
curl -X DELETE -H "x-api-key: $KEY" http://localhost:3001/api/sql-gateway/v1/cache
```

Contoh konsumsi dari module lain (copy helper, jangan import lintas module):

```js
// lib/sqlgw.js di module pemanggil
const BASE = process.env.SQLGW_URL || 'http://127.0.0.1:8001'; // atau via gateway /api/sql-gateway
export async function sqlgQuery(sql, { db, server, params } = {}) {
  const res = await fetch(`${BASE}/v1/query`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.SQLGW_API_KEY },
    body: JSON.stringify({ sql, database: db, server, params }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || `sql-gateway ${res.status}`);
  return json.data.recordset;
}
```

Endpoint lengkap: `/health`, `/v1/servers`, `/v1/databases`, `/v1/query`,
`/v1/query/batch`, `/v1/cache` (GET/DELETE), `/monitor/*`
(`overview|requests|queries|security|callers|logs|self|heartbeat`).

## Traffic monitoring & audit UI

Buka **`http://localhost:3001/sql-gateway/`** (atau `:8001/`). Satu halaman
statis (tanpa build step) yang dilayari proses backend yang sama. Belum
terautentikasi? Otomatis diarahkan ke halaman login bawaan modul.

- **Cards**: request/error window, error rate, latency avg/p50/p95, jumlah &
  cache hit query, blocked+error query, security events, health pool DB.
- **Chart** request/error/query per menit (canvas, tanpa library).
- **Live Traffic**: tiap request — waktu, method, path, status, durasi,
  caller, mode auth, IP socket → client IP (X-Forwarded-For). Klik baris → detail JSON.
- **Queries**: audit SQL — preview + hash, server/db, tipe, decision
  (allowed/blocked/error), rows, durasi, cache hit, caller. Klik → SQL penuh.
- **Security**: `invalid-api-key`, `spoof-attempt`, `blocked-sql`,
  `rate-limited`, `unauthorized`.
- **Callers & IPs**: agregasi per caller/mode dan top IP.
- **Servers**: kartu per profil (endpoint, default db, readOnly, pool size/avail/pending).
- **Log Files**: daftar file JSONL di disk + retensi.
- **Tester**: jalankan query langsung (Ctrl+Enter), purge cache.
- Filter per tab, export CSV, auto-refresh 3 detik (pause saat tab hidden),
  selector window 15m/1h/4h/24h.

### Penyimpanan log

```
Module Services/sql-gateway/data/logs/
├── traffic-YYYY-MM-DD.jsonl     # setiap request
├── queries-YYYY-MM-DD.jsonl     # audit SQL
├── security-YYYY-MM-DD.jsonl    # event keamanan
└── heartbeat.json               # penanda flush terakhir
```

Rotasi harian otomatis, prune > `SQLGW_LOG_RETENTION_DAYS` (default 14),
guard ukuran file `SQLGW_LOG_MAX_FILE_MB`. Folder `data/` gitignored.
Nilai parameter query TIDAK dicatat (hanya nama param) agar payload sensitif
tidak masuk audit trail.

## Optimasi dibanding gateway lama

- Multi-key ber-atribusi (audit per pemanggil) vs satu static token.
- Audit trail terstruktur persisten (traffic/query/security) — sebelumnya tidak ada.
- Metrik cache (hit rate) + purge manual via API/UI.
- Statistik p50/p95, series per menit, ring buffer memory bounded.
- Timing-safe key compare, body limit 1 MB, cap panjang SQL & batch,
  rate limit per caller+IP.
- Degraded start tanpa profil DB (health tetap hijau, query ditolak rapi).
- Warmup pool paralel non-blocking; graceful shutdown + heartbeat sink.
- Format `.env` DATABASE_PROFILES_* identik → migrasi tinggal copy-paste.

## Checklist integrasi (sudah dilakukan)

- [x] Folder + package.json + port unik 8001, jalan mandiri
- [x] Route `routes-config.json` + `routes-config.production.json`
      (`/sql-gateway`, `/api/sql-gateway`)
- [x] Auth: gateway headers (loopback) + portal cookie (public.pem) + x-api-key
- [x] Registry tabel di `docs/MONOREPO.md` & `CLAUDE.md`
