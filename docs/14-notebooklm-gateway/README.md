# NotebookLM Gateway — Dokumentasi Teknis

**Project:** PT Rebinmas Jaya Main Dashboard  
**Folder:** `notebooklm-gateway/`  
**Server:** `http://localhost:8003` (Bun.js, Elysia framework)  
**Notebook ID:** `10b4e732-ccb0-45f2-80a9-354502ebf89c`  
**Updated:** 2026-06-12

---

## 1. Overview

NotebookLM Gateway adalah Bun.js HTTP server yang membungkus **Google NotebookLM API** untuk penggunaan internal. Gateway ini menyediakan REST API endpoints untuk operasi RAG (Retrieval-Augmented Generation), manajemen notebook, sources, chat, dan artifacts.

**Framework:** Elysia.js (Bun-native)  
**Python Bridge:** Spawns Python subprocess untuk notebooklm-py client  
**Python Path:** `C:\Users\nbgmf\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe`  
**Storage Path:** `C:\Users\nbgmf\.notebooklm`

---

## 2. File Structure

```
notebooklm-gateway/
├── server.ts           # Main server (693 lines) — Elysia + Python bridge
├── package.json       # Dependencies (elysia, bun)
├── tsconfig.json      # TypeScript config
├── start.bat          # Launch script
├── README.md          # API reference (user-facing)
├── USAGE-GUIDE-ID.md  # Usage guide in Indonesian
└── bun.lock           # Lockfile
```

---

## 3. Architecture

```
HTTP Client (curl / browser)
       │
       ▼
 ┌─────────────────────────────────────────────┐
 │  Bun/Elysia Server (port 8003)              │
 │                                              │
 │  Routes:                                     │
 │  ├─ /rag/*      → RAG operations             │
 │  ├─ /notebooks/* → Notebook CRUD             │
 │  ├─ /bulk/*    → Bulk operations             │
 │  └─ /health    → Health check               │
 │                                              │
 │  Implementation strategy:                   │
 │  ├─ Python REST API calls (simple ops)      │
 │  ├─ Direct notebooklm-py spawn (complex)    │
 │  └─ File upload via direct client           │
 └─────────────────────────────────────────────┘
       │
       ▼
 ┌─ Python REST API (port 8002) ─────────────┐
 │  notebooklm_rest_api client (Flask)        │
 └───────────────────────────────────────────┘
       │
       ▼
 ┌─ Google NotebookLM API ──────────────────┐
 │  (notebooklm.google.com)                  │
 └───────────────────────────────────────────┘
```

---

## 4. Server Startup

```bash
# Via start.bat
D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\start.bat

# Manual
cd D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway
bun run server.ts
# Or: bun --watch server.ts (dev mode)
```

---

## 5. Core Utilities

### 5.1 Python Spawn Utility
```typescript
async function py(script: string, timeout = 120): Promise<any>
```
Spawns Python subprocess, runs inline script, returns JSON.  
Used for: direct notebooklm-py calls, file uploads, RAG ask.

### 5.2 Python REST API Proxy
```typescript
async function pyApi(method: string, path: string, body?: any)
```
Makes HTTP request to Python REST API (port 8002).  
Used for: simple CRUD operations (list, rename, delete).

### 5.3 File Upload
```typescript
async function pyUploadFile(notebookId: string, filePath: string, displayName: string)
```
Uploads file via direct notebooklm-py client. Polls for READY status (30 x 3s = 90s max).  
Mime type: `text/markdown`

### 5.4 RAG Ask
```typescript
async function pyRagAsk(notebookId: string, question: string)
```
Direct notebooklm-py chat.ask() — returns full reference data.  
Timeout: 60s

---

## 6. API Endpoints

### 6.1 RAG Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/rag/ask` | `{question, notebook_id?}` | Query RAG — returns answer + citations |
| GET | `/rag/status` | — | Source status: total, ready, errors |
| GET | `/rag/health` | — | Health check |

**RAG Response Format:**
```json
{
  "answer": "The Main Dashboard is...",
  "conversation_id": "uuid",
  "turn_number": 1,
  "is_follow_up": false,
  "references": [
    {
      "source_id": "uuid",
      "citation_number": 1,
      "cited_text": "cited text...",
      "score": 0.7637
    }
  ]
}
```

### 6.2 Notebook CRUD

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/notebooks` | — | List all notebooks |
| POST | `/notebooks` | `{title}` | Create notebook |
| GET | `/notebooks/:id` | — | Get notebook details |
| PATCH | `/notebooks/:id/rename` | `{new_title}` | Rename notebook |
| DELETE | `/notebooks/:id` | — | Delete notebook |
| GET | `/notebooks/:id/summary` | — | AI summary |
| GET | `/notebooks/:id/description` | — | Description + suggested topics |
| GET | `/notebooks/:id/share-url` | — | Public share URL |
| POST | `/notebooks/:id/share` | — | Share notebook |
| GET | `/notebooks/:id/source-ids` | — | List source IDs |

### 6.3 Sources

| Method | Path | Body | Description |
|--------|------|------|-------------|
| GET | `/notebooks/:id/sources` | — | List all sources |
| POST | `/notebooks/:id/sources/text` | `{title, content}` | Add text source |
| POST | `/notebooks/:id/sources/url` | `{url}` | Add URL source |
| POST | `/notebooks/:id/sources/file` | multipart | Upload file |
| DELETE | `/notebooks/:id/sources/:sid` | — | Delete source |
| GET | `/notebooks/:id/sources/:sid/fulltext` | — | Get full text |
| GET | `/notebooks/:id/sources/:sid/guide` | — | Get source guide |
| POST | `/notebooks/:id/sources/:sid/refresh` | — | Refresh source |
| GET | `/notebooks/:id/sources/:sid/freshness` | — | Check freshness |
| POST | `/notebooks/:id/sources/:sid/rename` | `{new_title}` | Rename source |

### 6.4 Chat

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/notebooks/:id/chat/ask` | `{question}` | Chat with notebook |
| GET | `/notebooks/:id/chat/conversation` | — | Get conversation ID + turn count |
| GET | `/notebooks/:id/chat/history` | — | Get conversation history |
| DELETE | `/notebooks/:id/chat/conversation` | — | Delete conversation |
| POST | `/notebooks/:id/chat/reset` | — | Reset chat |

### 6.5 Artifacts

| Method | Path | Description |
|--------|------|-------------|
| POST | `/notebooks/:id/artifacts/generate` | Generate artifact |
| GET | `/notebooks/:id/artifacts` | List all artifacts |
| GET | `/notebooks/:id/artifacts/tasks/:taskId` | Poll task status |
| GET | `/notebooks/:id/artifacts/download` | Download artifact |
| GET | `/notebooks/:id/artifacts/reports` | List reports |
| GET | `/notebooks/:id/artifacts/quizzes` | List quizzes |
| GET | `/notebooks/:id/artifacts/flashcards` | List flashcards |
| GET | `/notebooks/:id/artifacts/infographics` | List infographics |
| GET | `/notebooks/:id/artifacts/slide-decks` | List slide decks |
| GET | `/notebooks/:id/artifacts/videos` | List videos |
| GET | `/notebooks/:id/artifacts/data-tables` | List data tables |
| GET | `/notebooks/:id/artifacts/audio` | List audio |
| POST | `/notebooks/:id/artifacts/suggest-reports` | Suggest report topics |
| POST | `/notebooks/:id/artifacts/generate-study-guide` | Generate study guide |
| POST | `/notebooks/:id/artifacts/generate-cinematic-video` | Generate cinematic video |

### 6.6 Bulk Operations

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/bulk/upload` | `{notebook_id?, docs_dir?, files?}` | Upload specific files |
| POST | `/bulk/upload-all-docs` | — | Upload all 11 default docs |
| POST | `/bulk/delete-all-sources` | `{notebook_id?}` | Delete all sources |

---

## 7. Default Documents (11 Docs)

Gateway configured dengan 11 default documents dari `docs/` folder:

```typescript
const DEFAULT_DOCS = [
  { name: "00-INDEX",              path: "INDEX/README.md" },
  { name: "01-Project-Overview",   path: "01-project-overview/README.md" },
  { name: "02-Server-Architecture", path: "02-server-architecture/README.md" },
  { name: "03-Services-Query-API",  path: "03-services-query/README.md" },
  { name: "04-Services-Inventory",  path: "04-services-inventory/README.md" },
  { name: "05-Services-SQLServer",  path: "05-services-sqlserver/README.md" },
  { name: "06-Routes-API",         path: "06-routes-api/README.md" },
  { name: "07-Public-Assets",       path: "07-public-assets/README.md" },
  { name: "08-Database-Schema",     path: "08-database-schema/README.md" },
  { name: "09-Workflow-Artifacts",  path: "09-workflow-artifacts/README.md" },
  { name: "10-PRD-Docs",            path: "10-prd-docs/README.md" },
];
```

Docs directory: `D:/Gawean Rebinmas/Main Dashboard/docs/`

---

## 8. Configuration Constants

```typescript
const PYTHON_API = "http://localhost:8002";
const NOTEBOOK_ID = "10b4e732-ccb0-45f2-80a9-354502ebf89c";
const DOCS_DIR = "D:/Gawean Rebinmas/Main Dashboard/docs";
const PYTHON_EXE = "C:/Users/nbgmf/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";
```

---

## 9. Known Limitations

1. **File upload via REST API is broken** — Python REST API on port 8002 cannot handle file upload. Workaround: use direct `notebooklm-py` client via Python spawn.

2. **suggest-reports endpoint may timeout** — NotebookLM API limitation, not gateway issue.

3. **Artifact generation is async** — poll `/artifacts/tasks/:taskId` with `?wait=true` to get result.

4. **Python storage path** — Uses `C:\Users\nbggmf\.notebooklm` — must be logged in via browser first.

---

## 10. Troubleshooting

### Python spawn fails
```
Error: spawn ENOENT
```
Check PYTHON_EXE path exists: `C:\Users\nbgmf\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe`

### Upload times out
Default poll is 30 iterations x 3s = 90s. If source doesn't reach READY in 90s, returns TIMEOUT status. Retry manually.

### NotebookLM not authenticated
Must login to notebooklm.google.com in browser first. Gateway reads from `C:\Users\nbggmf\.notebooklm` storage.

---

## 11. Quick Test Commands

```bash
# Health check
curl http://localhost:8003/rag/health

# RAG query
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What services are available?"}'

# List notebooks
curl http://localhost:8003/notebooks

# Source status
curl http://localhost:8003/rag/status

# Upload all docs
curl -X POST http://localhost:8003/bulk/upload-all-docs
```