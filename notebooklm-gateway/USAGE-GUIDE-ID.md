# Dokumentasi Penggunaan — NotebookLM Gateway (Bun.js)

## Overview

**NotebookLM Gateway** adalah server API yang menyediakan akses ke dokumentasi Main Dashboard PT Rebinmas Jaya via RAG (Retrieval-Augmented Generation). Semua dokumentasi yang sudah di-upload ke NotebookLM bisa di-query via HTTP.

```
Server  : http://localhost:8003
Notebook: 10b4e732-ccb0-45f2-80a9-354502ebf89c
Docs    : 11 file (semua READY ✅)
```

---

## Start Server

```bash
# Cara 1: Launcher
D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\start.bat

# Cara 2: Manual
cd D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway
bun run server.ts
```

---

## 1. RAG — Tanya Dokumentasi

Ini adalah endpoint **paling penting** untuk mencari dan bertanya tentang dokumentasi.

### 1.1 Tanya Basic (Tanpa Konteks Percakapan)

```bash
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the Main Dashboard architecture?"}'
```

**Response:**
```json
{
  "answer": "The Main Dashboard is a **Unified Dashboard and Proxy Gateway**...",
  "conversation_id": "24823501-bbe4-4de4-bc06-50acbe",
  "turn_number": 1,
  "is_follow_up": false,
  "references": [
    {
      "source_id": "uuid",
      "citation_number": 1,
      "cited_text": "Project Overview — PT Rebinmas Jaya...",
      "score": 0.7637
    }
  ]
}
```

### 1.2 Tanya Dengan Konteks Percakapan (Follow-up)

Jika ingin melanjutkan percakapan (context-aware), kirim `conversation_id` dari response sebelumnya:

```bash
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What port does it run on?",
    "conversation_id": "24823501-bbe4-4de4-bc06-50acbe"
  }'
```

### 1.3 Tanya Dari Notebook Lain

```bash
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Explain the SQL Bridge Gateway",
    "notebook_id": "45506445-c367-4fcb-9abc-1234567890ab"
  }'
```

### 1.4 Contoh Pertanyaan Berguna

```bash
# Tanya tentang arsitektur server
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Explain the dual-layer server architecture"}'

# Tanya tentang database
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What databases are used and how are they connected?"}'

# Tanya tentang API routes
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"List all API routes and their purposes"}'

# Tanya tentang workflow
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does the report center workflow work?"}'

# Tanya tentang security
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What security mechanisms are implemented?"}'

# Tanya tentang inventory reports
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What inventory reports are available?"}'

# Tanya tentang deployment
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How is the production deployment structured?"}'

# Tanya tentang specific service (misal: Venus Rekap)
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the Venus Rekap service and how does it work?"}'

# Tanya tentang SQL query parser
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does the SQL Bridge Gateway validate and execute queries?"}'

# Tanya tentang Next.js integration
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does the Next.js frontend connect to the backend services?"}'
```

---

## 2. Cek Status Dokumen

### 2.1 Cek Semua Source (Apakah READY?)

```bash
curl http://localhost:8003/rag/status
```

**Response:**
```json
{
  "notebook_id": "10b4e732-ccb0-45f2-80a9-354502ebf89c",
  "total_sources": 11,
  "ready": 11,
  "errors": 0,
  "sources": [
    {"id": "uuid", "title": "README.md", "status": "READY"},
    ...
  ]
}
```

### 2.2 Cek via Python

```python
import requests
resp = requests.get("http://localhost:8003/rag/status")
d = resp.json()
print(f"{d['ready']}/{d['total_sources']} sources READY")
```

---

## 3. Bulk Operations

### 3.1 Upload Ulang Semua Dokumen

Jika ada dokumen yang error, bisa di-upload ulang semua:

```bash
curl -X POST http://localhost:8003/bulk/upload-all-docs
```

### 3.2 Hapus Semua Source (Clean Start)

```bash
curl -X POST http://localhost:8003/bulk/delete-all-sources
```

### 3.3 Upload Dokumen Spesifik

```bash
curl -X POST http://localhost:8003/bulk/upload \
  -H "Content-Type: application/json" \
  -d '{
    "files": [
      {"name": "01-Project-Overview", "path": "01-project-overview/README.md"},
      {"name": "02-Server-Architecture", "path": "02-server-architecture/README.md"}
    ]
  }'
```

---

## 4. Daftar Dokumen (11 File)

| # | Nama | Path |
|---|------|------|
| 1 | 00-INDEX | docs/00-INDEX/README.md |
| 2 | 01-Project-Overview | docs/01-project-overview/README.md |
| 3 | 02-Server-Architecture | docs/02-server-architecture/README.md |
| 4 | 03-Services-Query-API | docs/03-services-query/README.md |
| 5 | 04-Services-Inventory | docs/04-services-inventory/README.md |
| 6 | 05-Services-SQLServer | docs/05-services-sqlserver/README.md |
| 7 | 06-Routes-API | docs/06-routes-api/README.md |
| 8 | 07-Public-Assets | docs/07-public-assets/README.md |
| 9 | 08-Database-Schema | docs/08-database-schema/README.md |
| 10 | 09-Workflow-Artifacts | docs/09-workflow-artifacts/README.md |
| 11 | 10-PRD-Docs | docs/10-prd-docs/README.md |

---

## 5. Chat History

### 5.1 Lihat Riwayat Percakapan

```bash
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/chat/history
```

**Response:**
```json
{
  "ok": true,
  "history": [
    ["What is the Main Dashboard project?", "The Main Dashboard project is..."],
    ["Explain the server architecture", "The server architecture operates as..."]
  ]
}
```

### 5.2 Hapus Percakapan

```bash
curl -X DELETE http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/chat/conversation
```

### 5.3 Reset Chat

```bash
curl -X POST http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/chat/reset
```

---

## 6. Notebook Management

### 6.1 List Semua Notebook

```bash
curl http://localhost:8003/notebooks
```

### 6.2 Get Detail Notebook

```bash
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c
```

### 6.3 AI Summary Notebook

```bash
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/summary
```

### 6.4 Get Source IDs

```bash
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/source-ids
```

---

## 7. Source Management

### 7.1 List Semua Source

```bash
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources
```

### 7.2 Add Text Source

```bash
curl -X POST http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources/text \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Custom Note",
    "content": "This is a text note to add to the notebook."
  }'
```

### 7.3 Rename Source

```bash
curl -X POST http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources/{source_id}/rename \
  -H "Content-Type: application/json" \
  -d '{"new_title": "New Title Here"}'
```

### 7.4 Delete Source

```bash
curl -X DELETE http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources/{source_id}
```

### 7.5 Refresh Source

```bash
curl -X POST http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources/{source_id}/refresh
```

---

## 8. File Upload

Upload file via multipart form (gunakan field name `upload`):

```bash
curl -X POST http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources/file \
  -F "upload=@D:/Gawean Rebinmas/Main Dashboard/docs/00-INDEX/README.md"
```

---

## 9. Chat Langsung (Tanpa RAG Wrapper)

```bash
curl -X POST http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What services are integrated?"}'
```

---

## 10. Python Client Example

```python
import requests
import json

API = "http://localhost:8003"
NOTEBOOK_ID = "10b4e732-ccb0-45f2-80a9-354502ebf89c"

def rag_ask(question, conversation_id=None):
    """Tanya dokumentasi via RAG"""
    payload = {"question": question}
    if conversation_id:
        payload["conversation_id"] = conversation_id
    resp = requests.post(f"{API}/rag/ask", json=payload, timeout=60)
    return resp.json()

def check_status():
    """Cek status dokumen"""
    resp = requests.get(f"{API}/rag/status")
    d = resp.json()
    print(f"{d['ready']}/{d['total_sources']} READY")
    return d

# Usage
result = rag_ask("Explain the server architecture")
print(result["answer"])
print(f"References: {len(result['references'])}")
print(f"Conversation ID: {result['conversation_id']}")
```

---

## 11. JavaScript/Node.js Client

```javascript
const API = "http://localhost:8003";

async function ragAsk(question, conversationId = null) {
  const body = { question };
  if (conversationId) body.conversation_id = conversationId;
  const resp = await fetch(`${API}/rag/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return await resp.json();
}

// Usage
const result = await ragAsk("What is the Main Dashboard architecture?");
console.log(result.answer);
console.log(`Citations: ${result.references.length}`);
```

---

## 12. PowerShell Example

```powershell
# RAG query
$body = @{ question = "Explain the SQL Bridge Gateway" } | ConvertTo-Json
$resp = Invoke-RestMethod -Uri "http://localhost:8003/rag/ask" `
  -Method Post -ContentType "application/json" -Body $body
Write-Host $resp.answer

# Check status
$status = Invoke-RestMethod -Uri "http://localhost:8003/rag/status"
Write-Host "$($status.ready)/$($status.total_sources) sources READY"
```

---

## 13. cURL Cheat Sheet

```bash
# Health check
curl http://localhost:8003/health

# List notebooks
curl http://localhost:8003/notebooks

# RAG status
curl http://localhost:8003/rag/status

# RAG ask
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the architecture?"}'

# List sources
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/sources

# Chat history
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/chat/history

# Get summary
curl http://localhost:8003/notebooks/10b4e732-ccb0-45f2-80a9-354502ebf89c/summary

# Bulk upload all docs
curl -X POST http://localhost:8003/bulk/upload-all-docs

# Delete all sources
curl -X POST http://localhost:8003/bulk/delete-all-sources
```

---

## 14. Contoh Penggunaan untuk Main Dashboard

### Untuk Developer

```bash
# Tanya tentang specific route
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How does /api/inventory route work?"}'

# Tanya tentang database schema
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What tables are in the Estate database?"}'

# Tanya tentang error handling
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How are SQL errors handled in the gateway?"}'
```

### Untuk Tim IT

```bash
# Tanya tentang deployment
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What are the production deployment steps?"}'

# Tanya tentang monitoring
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How is system monitoring configured?"}'

# Tanya tentang backup
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the backup and recovery strategy?"}'
```

### Untuk Manajemen

```bash
# Tanya tentang report center
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What reports are available in the Report Center?"}'

# Tanya tentang inventory
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What inventory modules are available?"}'

# Tanya tentang system overview
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"Give me a system overview of the Main Dashboard"}'
```

---

## 15. Troubleshooting

### Server tidak running?
```bash
# Check port 8003
netstat -ano | grep ":8003"
# Kalau tidak ada, jalankan:
cd D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway
bun run server.ts
```

### Response timeout?
```bash
# Cek dulu apakah server alive
curl http://localhost:8003/health

# Kalau health OK tapi RAG timeout, berarti NotebookLM API lagi slow
# Tunggu beberapa detik lalu retry
```

### Semua source ERROR?
```bash
# Re-upload semua
curl -X POST http://localhost:8003/bulk/upload-all-docs
```

### Python path error?
```bash
# Cek Python executable
C:/Users/nbgmf/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe --version
```

---

## 16. Endpoint Summary

| # | Endpoint | Method | Fungsi |
|---|----------|--------|--------|
| 1 | `/` | GET | Info server |
| 2 | `/health` | GET | Health check |
| 3 | `/rag/ask` | POST | **RAG query — tanya dokumen** |
| 4 | `/rag/status` | GET | Cek status source |
| 5 | `/notebooks` | GET | List notebook |
| 6 | `/notebooks/:id` | GET | Detail notebook |
| 7 | `/notebooks/:id/summary` | GET | AI summary |
| 8 | `/notebooks/:id/sources` | GET | List sources |
| 9 | `/notebooks/:id/sources/file` | POST | Upload file |
| 10 | `/notebooks/:id/sources/text` | POST | Add text source |
| 11 | `/notebooks/:id/chat/ask` | POST | Chat dengan notebook |
| 12 | `/notebooks/:id/chat/history` | GET | Riwayat chat |
| 13 | `/bulk/upload-all-docs` | POST | Upload semua docs |
| 14 | `/bulk/delete-all-sources` | POST | Hapus semua source |

---

**Lokasi File:**
- Server: `D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\server.ts`
- Launcher: `D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\start.bat`
- API Docs: `D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\README.md`
- Usage Guide: `D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\USAGE-GUIDE-ID.md`