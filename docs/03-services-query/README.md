# SQL Bridge Gateway API - Dokumentasi Lengkap

**Last updated: 2026-06-10**

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Endpoint Overview](#2-endpoint-overview)
3. [Authentication Mechanism](#3-authentication-mechanism)
4. [Connection Manager](#4-connection-manager)
5. [Query Validator](#5-query-validator)
6. [Transformer](#6-transformer)
7. [API Key Generator](#7-api-key-generator)
8. [Database Configuration](#8-database-configuration)
9. [Error Handling](#9-error-handling)
10. [Request/Response Format](#10-requestresponse-format)
11. [Contoh Penggunaan](#11-contoh-penggunaan)

---

## 1. Gambaran Umum

SQL Bridge Gateway adalah REST API yang memungkinkan eksekusi query SQL ke **berbagai database pada SQL Server** melalui antarmuka yang aman dan terkontrol.

### Karakteristik Utama

- **Framework**: Fastify dengan Swagger/OpenAPI documentation
- **Database**: Microsoft SQL Server via library `mssql`
- **Port Default**: `8001`
- **Parser SQL**: `node-sql-parser` untuk validasi keamanan
- **Autentikasi**: API Key-based authentication

### Konfigurasi Default

| Parameter | Nilai Default |
|-----------|---------------|
| Server | `localhost:1433` |
| User | `sa` |
| Default DB | `db_ptrj` |
| Connection Pool Max | 20 |
| Connection Pool Min | 2 |
| Request Timeout | 30 detik |
| Connection Timeout | 15 detik |

### File Path Absolut

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\
├── index.js                          # Entry point Fastify server
├── routes\
│   ├── query.js                      # Query endpoints
│   └── apiKeys.js                    # API key management endpoints
├── middleware\
│   └── auth.js                       # Authentication middleware
├── services\
│   ├── connectionManager.js          # SQL Server connection pool
│   └── queryValidator.js             # SQL query security validator
├── utils\
│   ├── transformer.js               # Response formatting utilities
│   └── apiKeyGenerator.js            # API key generation & management
├── config\
│   └── database.js                   # Database profile configuration
└── ENDPOINT_DOCUMENTATION.md        # Dokumentasi endpoint reference
```

---

## 2. Endpoint Overview

### 2.1 Health Check

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/health` |
| **Auth Required** | Tidak |
| **Tags** | `Health` |

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-06-10T12:00:00.000Z"
}
```

---

### 2.2 List Databases

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/v1/databases` |
| **Auth Required** | Ya (API Key) |
| **Tags** | `Database` |

**Deskripsi**: Mengembalikan daftar semua database yang tersedia pada SQL Server.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "databases": ["db_ptrj", "extend_db_ptrj", "master", "tempdb"],
    "total": 4
  },
  "error": null
}
```

---

### 2.3 Execute Query

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **Path** | `/v1/query` |
| **Auth Required** | Ya (API Key) |
| **Tags** | `Query` |

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `sql` | string | Ya | Query SQL yang akan dieksekusi |
| `database` | string | Tidak | Nama database target (default: db_ptrj) |
| `params` | object | Tidak | Parameter untuk prepared statement |

**Contoh Request:**
```json
{
  "sql": "SELECT TOP 10 * FROM HR_EMPLOYEE",
  "database": "db_ptrj"
}
```

**Response (200):**
```json
{
  "success": true,
  "db": "db_ptrj",
  "execution_ms": 45,
  "data": {
    "recordset": [...],
    "rowsAffected": [10]
  },
  "error": null
}
```

---

### 2.4 Batch Query (Transaction)

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **Path** | `/v1/query/batch` |
| **Auth Required** | Ya (API Key) |
| **Tags** | `Query` |

**Deskripsi**: Mengeksekusi multiple query dalam satu transaksi. Semua berhasil atau semua di-rollback.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `database` | string | Tidak | Nama database target |
| `queries` | array | Ya | Array of query objects |

**Contoh Request:**
```json
{
  "database": "extend_db_ptrj",
  "queries": [
    { "sql": "INSERT INTO logs (msg) VALUES ('Start')" },
    { "sql": "UPDATE users SET active = 1" }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "db": "extend_db_ptrj",
  "execution_ms": 120,
  "data": {
    "results": [
      { "recordset": [], "rowsAffected": [1] },
      { "recordset": [], "rowsAffected": [5] }
    ],
    "transactionCommitted": true
  },
  "error": null
}
```

---

### 2.5 API Key Management Endpoints

#### 2.5.1 Initialize API Keys

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **Path** | `/v1/init` |
| **Auth Required** | Tidak (memerlukan INIT_KEY) |
| **Tags** | `API Keys` |
| **Hidden** | Ya (tidak muncul di dokumentasi) |

**Request Body:**
```json
{
  "initKey": "your-init-key"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "API key system initialized successfully"
}
```

---

#### 2.5.2 Create API Key

| Property | Value |
|----------|-------|
| **Method** | `POST` |
| **Path** | `/v1/api-keys` |
| **Auth Required** | Ya (API Key dengan write permission) |
| **Tags** | `API Keys` |

**Request Body:**
```json
{
  "description": "API Key untuk Reporting",
  "permissions": {
    "allowed_dbs": ["*"],
    "read_only": true,
    "write_dbs": [],
    "write_tables": []
  },
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "key_1234567890_abc123",
    "key": "dqg_xxxxxxxxxxxxxxxxxxxx",
    "createdAt": "2026-06-10T12:00:00.000Z",
    "permissions": {
      "description": "API Key untuk Reporting",
      "allowed_dbs": ["*"],
      "read_only": true,
      "write_dbs": [],
      "write_tables": []
    }
  }
}
```

---

#### 2.5.3 List API Keys

| Property | Value |
|----------|-------|
| **Method** | `GET` |
| **Path** | `/v1/api-keys` |
| **Auth Required** | Ya (API Key) |
| **Tags** | `API Keys` |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "key_1234567890_abc123",
        "permissions": {...},
        "createdAt": "2026-06-10T12:00:00.000Z",
        "lastUsed": "2026-06-10T14:00:00.000Z",
        "expiresAt": null,
        "isActive": true
      }
    ]
  }
}
```

---

#### 2.5.4 Delete API Key

| Property | Value |
|----------|-------|
| **Method** | `DELETE` |
| **Path** | `/v1/api-keys/:id` |
| **Auth Required** | Ya (API Key dengan write permission) |
| **Tags** | `API Keys` |

**Response (200):**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

---

## 3. Authentication Mechanism

### 3.1 Mekanisme Autentikasi

Autentikasi menggunakan **API Key** yang dikirim melalui HTTP header.

### 3.2 Header yang Dibutuhkan

```
x-api-key: <your-api-key>
```

### 3.3 Flow Autentikasi

```
Request masuk
    ↓
Cek URL (jika /health atau /docs → skip auth)
    ↓
Ambil header x-api-key
    ↓
Bandingkan dengan API_TOKEN dari environment
    ↓
Valid → attach permissions ke request
Invalid → return 401 error
```

### 3.4 Permissions Structure

Setiap API key memiliki permissions yang menentukan akses:

```javascript
{
  description: "Deskripsi API key",
  allowed_dbs: ["*"],           // Database yang boleh diakses
  read_only: false,             // true = hanya SELECT
  write_dbs: ["*"],             // Database yang boleh di-write
  write_tables: ["*"]          // Tabel yang boleh di-write
}
```

### 3.5 Permission Levels

| Level | allowed_dbs | read_only | write_dbs | write_tables |
|-------|-------------|-----------|-----------|--------------|
| Admin | `["*"]` | `false` | `["*"]` | `["*"]` |
| Read-Only | `["*"]` | `true` | `[]` | `[]` |
| Default | `["*"]` | `false` | `["EXTEND_DB_PTRJ"]` | `["*"]` |

### 3.6 File Path

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\middleware\auth.js
```

### 3.7 Error Responses

| HTTP Code | Error Message |
|-----------|---------------|
| 401 | `Missing API key. Include x-api-key header.` |
| 401 | `Invalid API key.` |
| 500 | `Server configuration error` (API_TOKEN tidak diset) |

---

## 4. Connection Manager

### 4.1 Deskripsi

`ConnectionManager` adalah singleton class yang mengelola **connection pool** ke SQL Server. Menggunakan profile `LOCAL` secara default dan mendukung switching database.

### 4.2 Fitur Utama

- **Singleton Pattern**: Hanya satu instance yang digunakan
- **Connection Pooling**: Optimized pool settings untuk concurrency
- **Pre-warming**: Koneksi dibuat saat startup untuk mengurangi latency
- **Auto-reconnect**: Otomatis membuat koneksi baru jika pool terputus

### 4.3 Methods

| Method | Deskripsi |
|--------|-----------|
| `getPool()` | Get atau create connection pool |
| `warmUp()` | Pre-warm koneksi saat startup |
| `createPool()` | Buat connection pool baru dengan config optimized |
| `query(sql, params, database)` | Eksekusi query dengan parameter opsional |
| `closeAll()` | Tutup semua koneksi |
| `getPoolStats()` | Get statistik pool (connected, size) |

### 4.4 Pool Configuration

```javascript
pool: {
  max: 20,                      // Max 20 connections
  min: 2,                       // Keep 2 warm
  idleTimeoutMillis: 60000,     // 60 detik idle timeout
  acquireTimeoutMillis: 15000  // 15 detik acquire timeout
}
```

### 4.5 Query Execution

```javascript
// Jika database specified, prepend USE statement
const finalQuery = database
  ? `USE [${database}]; ${sqlQuery}`
  : sqlQuery;
```

### 4.6 File Path

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\services\connectionManager.js
```

---

## 5. Query Validator

### 5.1 Deskripsi

`QueryValidator` memvalidasi SQL query terhadap aturan keamanan dan permissions menggunakan `node-sql-parser`.

### 5.2 Blacklisted Operations

Operasi SQL berikut **tidak diizinkan**:

| Operation | Reason |
|-----------|--------|
| `DROP` | Menghapus objek database |
| `TRUNCATE` | Menghapus semua data tabel |
| `ALTER` | Mengubah struktur database |
| `CREATE` | Membuat objek baru |
| `GRANT` | Memberikan hak akses |
| `REVOKE` | Mencabut hak akses |

### 5.3 Blacklisted Tables

Akses ke tabel sistem berikut **diblokir**:

- `information_schema`
- `sys`
- `master`
- `msdb`
- `tempdb`

### 5.4 Validation Flow

```
SQL Query masuk
    ↓
Cek apakah database di allowed_dbs
    ↓
Parse SQL dengan node-sql-parser
    ↓
Cek type operation (SELECT, INSERT, UPDATE, DELETE)
    ↓
Cek blacklisted operations
    ↓
Cek read_only permission
    ↓
Cek blacklisted tables
    ↓
Cek write permissions (untuk INSERT/UPDATE/DELETE)
    ↓
Valid atau Error
```

### 5.5 Validation Result

```javascript
// Success
{
  valid: true,
  queryType: "SELECT",
  tables: ["HR_EMPLOYEE"]
}

// Error
{
  valid: false,
  error: "Access denied: Database 'X' is not in your allowed databases.",
  queryType: "SELECT",
  tables: [...]
}
```

### 5.6 File Path

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\services\queryValidator.js
```

---

## 6. Transformer

### 6.1 Deskripsi

`transformer.js` menyediakan utility functions untuk formatting response dan pengukuran waktu eksekusi.

### 6.2 Functions

#### 6.2.1 successResponse

```javascript
successResponse(data, dbAlias, executionMs)
```

**Return:**
```json
{
  "success": true,
  "db": "db_ptrj",
  "execution_ms": 45,
  "data": {...},
  "error": null
}
```

#### 6.2.2 errorResponse

```javascript
errorResponse(error, dbAlias, executionMs)
```

**Return:**
```json
{
  "success": false,
  "db": "db_ptrj",
  "execution_ms": 45,
  "data": null,
  "error": "Database error: ..."
}
```

#### 6.2.3 measureTime

```javascript
measureTime(fn)
```

Mengukur waktu eksekusi function async dan return hasil beserta durasi.

**Return:**
```javascript
{
  result: {...},
  durationMs: 45.123
}
```

### 6.3 File Path

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\utils\transformer.js
```

---

## 7. API Key Generator

### 7.1 Deskripsi

`ApiKeyManager` adalah class untuk generate, menyimpan, dan memvalidasi API keys.

### 7.2 Key Format

```
dqg_<base64url-encoded-32-bytes>
```

Contoh: `dqg_xK3mP9nQ2rT5wY7zA1bC4dE6fG8hJ0kL`

### 7.3 Storage

API keys disimpan di file JSON:

```
<cwd>/data/api_keys.json
```

### 7.4 Key Record Structure

```javascript
{
  id: "key_1234567890_abc123",
  key: "dqg_xxxxxxxxxxxx",
  permissions: {
    description: "...",
    allowed_dbs: ["*"],
    read_only: false,
    write_dbs: ["*"],
    write_tables: ["*"]
  },
  createdAt: Date,
  lastUsed: Date | null,
  expiresAt: Date | null,
  isActive: true
}
```

### 7.5 Methods

| Method | Deskripsi |
|--------|-----------|
| `generateApiKey()` | Generate random API key |
| `createApiKey(permissions, description)` | Buat dan simpan API key baru |
| `findByKey(apiKey)` | Cari API key berdasarkan nilai |
| `findById(id)` | Cari API key berdasarkan ID |
| `validateApiKey(apiKey)` | Validasi key (exists, active, not expired) |
| `deactivateApiKey(id)` | Soft delete (set isActive = false) |
| `getAllApiKeys()` | Get semua active keys |
| `loadApiKeys()` | Load keys dari file JSON |
| `writeApiKeysFile(keys)` | Simpan keys ke file JSON |

### 7.6 File Path

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\utils\apiKeyGenerator.js
```

---

## 8. Database Configuration

### 8.1 Deskripsi

`database.js` mem-parsing environment variables untuk membuat konfigurasi database profiles.

### 8.2 Environment Variables Pattern

```
DATABASE_PROFILES_<PROFILE_NAME>_SERVER=<server>
DATABASE_PROFILES_<PROFILE_NAME>_PORT=<port>
DATABASE_PROFILES_<PROFILE_NAME>_DATABASE_NAME=<default_db>
DATABASE_PROFILES_<PROFILE_NAME>_USERNAME=<user>
DATABASE_PROFILES_<PROFILE_NAME>_PASSWORD=<password>
DATABASE_PROFILES_<PROFILE_NAME>_ENCRYPT=<true|false>
DATABASE_PROFILES_<PROFILE_NAME>_TRUSTED_CONNECTION=<true|false>
```

### 8.3 Functions

| Function | Deskripsi |
|----------|-----------|
| `loadDatabaseProfiles()` | Parse semua profile dari env vars (cached) |
| `getDatabaseConfig(alias)` | Get config untuk alias tertentu (case-insensitive) |
| `getAvailableAliases()` | Get semua nama profile yang tersedia |
| `clearProfileCache()` | Clear cache (untuk testing) |

### 8.4 Caching

Profiles di-cache untuk performance. Cache dibersihkan dengan `clearProfileCache()`.

### 8.5 File Path

```
D:\Gawean Rebinmas\Main Dashboard\Services\query\dist\config\database.js
```

---

## 9. Error Handling

### 9.1 HTTP Error Codes

| Code | Condition |
|------|-----------|
| 200 | Success |
| 400 | Bad Request (missing required fields) |
| 401 | Unauthorized (missing/invalid API key) |
| 403 | Forbidden (permission denied) |
| 404 | Not Found (resource tidak ditemukan) |
| 500 | Internal Server Error |

### 9.2 Error Response Format

```json
{
  "success": false,
  "db": "db_ptrj",
  "execution_ms": 45,
  "data": null,
  "error": "Error message here"
}
```

### 9.3 Common Error Messages

| Error | Cause |
|-------|-------|
| `Missing API key. Include x-api-key header.` | Header x-api-key tidak ada |
| `Invalid API key.` | API key tidak cocok dengan API_TOKEN |
| `Access denied: Database 'X' is not in your allowed databases.` | Database tidak diizinkan |
| `Access denied: Your API key only allows SELECT queries.` | Write operation dengan read-only key |
| `Blocked: DROP operations are not allowed.` | Query mengandung DROP |
| `Database error: ...` | Error dari SQL Server |
| `Transaction failed: ...` | Batch transaction gagal |

### 9.4 Graceful Shutdown

Server menangani SIGTERM dan SIGINT untuk graceful shutdown:

```javascript
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
```

Shutdown flow:
1. Log "Shutting down gracefully..."
2. Tutup semua koneksi dengan `connectionManager.closeAll()`
3. Tutup Fastify server
4. Exit process

---

## 10. Request/Response Format

### 10.1 Standard Request Headers

```
Content-Type: application/json
x-api-key: <your-api-key>
```

### 10.2 Standard Response Schema

```json
{
  "success": boolean,
  "db": string | null,
  "execution_ms": number,
  "data": object | null,
  "error": string | null
}
```

### 10.3 Response Data Structure

#### Query Result

```json
{
  "data": {
    "recordset": [...],       // Array of rows
    "rowsAffected": [number]   // Number of affected rows
  }
}
```

#### Batch Result

```json
{
  "data": {
    "results": [
      { "recordset": [], "rowsAffected": [1] },
      { "recordset": [], "rowsAffected": [5] }
    ],
    "transactionCommitted": true
  }
}
```

#### Database List

```json
{
  "data": {
    "databases": ["db1", "db2", ...],
    "total": number
  }
}
```

---

## 11. Contoh Penggunaan

### 11.1 PowerShell - Query ke Database Default

```powershell
$body = '{"sql":"SELECT TOP 5 * FROM HR_EMPLOYEE"}'
Invoke-RestMethod -Uri "http://localhost:8001/v1/query" -Method POST -Headers @{
    "x-api-key"="2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
    "Content-Type"="application/json"
} -Body $body
```

### 11.2 PowerShell - Query ke Database Spesifik

```powershell
$body = '{"sql":"SELECT TOP 5 * FROM users", "database":"extend_db_ptrj"}'
Invoke-RestMethod -Uri "http://localhost:8001/v1/query" -Method POST -Headers @{
    "x-api-key"="2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
    "Content-Type"="application/json"
} -Body $body
```

### 11.3 cURL

```bash
# Default database
curl -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql":"SELECT TOP 5 * FROM HR_EMPLOYEE"}'

# Specific database
curl -X POST http://localhost:8001/v1/query \
  -H "Content-Type: application/json" \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6" \
  -d '{"sql":"SELECT TOP 5 * FROM users", "database":"extend_db_ptrj"}'
```

### 11.4 Python

```python
import requests

# Query dengan database default
response = requests.post(
    'http://localhost:8001/v1/query',
    json={'sql': 'SELECT TOP 5 * FROM HR_EMPLOYEE'},
    headers={'x-api-key': '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'}
)
print(response.json())

# Query dengan database spesifik
response = requests.post(
    'http://localhost:8001/v1/query',
    json={
        'sql': 'SELECT TOP 5 * FROM HR_EMPLOYEE',
        'database': 'extend_db_ptrj'
    },
    headers={'x-api-key': '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'}
)
print(response.json())
```

### 11.5 JavaScript (Node.js)

```javascript
const response = await fetch('http://localhost:8001/v1/query', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': '2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6'
  },
  body: JSON.stringify({
    sql: 'SELECT TOP 5 * FROM HR_EMPLOYEE',
    database: 'db_ptrj'
  })
});
const data = await response.json();
console.log(data);
```

### 11.6 List Databases

```bash
curl -X GET http://localhost:8001/v1/databases \
  -H "x-api-key: 2a993486e7a448474de66bfaea4adba7a99784defbcaba420e7f906176b94df6"
```

### 11.7 Health Check

```bash
curl -X GET http://localhost:8001/health
```

---

## Swagger Documentation

Dokumentasi interaktif tersedia di:

```
http://localhost:8001/docs
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `API_TOKEN` | Ya | - | Static API key untuk autentikasi |
| `INIT_KEY` | Untuk init | - | Key untuk inisialisasi API key system |
| `HOST` | Tidak | `0.0.0.0` | Host untuk listen |
| `PORT` | Tidak | `8001` | Port untuk listen |
| `DATABASE_PROFILES_*` | Ya | - | Database connection profiles |

---

**Last updated: 2026-06-10**
