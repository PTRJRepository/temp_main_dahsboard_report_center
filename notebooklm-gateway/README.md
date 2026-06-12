# NotebookLM Gateway (Bun.js) — API Reference

**Server:** `http://localhost:8003`  
**Notebook ID:** `10b4e732-ccb0-45f2-80a9-354502ebf89c`  
**Start:** `D:\Gawean Rebinmas\Main Dashboard\notebooklm-gateway\start.bat`

---

## Quick Start

```bash
# RAG query (uses default notebook)
curl -X POST http://localhost:8003/rag/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the Main Dashboard architecture?"}'

# Check source status
curl http://localhost:8003/rag/status

# Bulk upload all 11 docs
curl -X POST http://localhost:8003/bulk/upload-all-docs

# Clear all sources
curl -X POST http://localhost:8003/bulk/delete-all-sources
```

---

## Endpoints

### RAG (Default Notebook)
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/rag/ask` | `{question, notebook_id?}` | Query RAG — returns answer + citations |
| GET | `/rag/status` | — | Source status: total, ready, errors |

### Notebooks
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notebooks` | List all notebooks |
| POST | `/notebooks` | Create notebook `{title}` |
| GET | `/notebooks/:id` | Get notebook details |
| PATCH | `/notebooks/:id/rename` | Rename `{new_title}` |
| DELETE | `/notebooks/:id` | Delete notebook |
| GET | `/notebooks/:id/summary` | AI summary |
| GET | `/notebooks/:id/description` | Description + suggested topics |
| GET | `/notebooks/:id/share-url` | Public share URL |
| POST | `/notebooks/:id/share` | Share notebook |
| GET | `/notebooks/:id/source-ids` | List source IDs |

### Sources
| Method | Path | Description |
|--------|------|-------------|
| GET | `/notebooks/:id/sources` | List all sources |
| POST | `/notebooks/:id/sources/text` | Add text source `{title, content}` |
| POST | `/notebooks/:id/sources/url` | Add URL source `{url}` |
| POST | `/notebooks/:id/sources/file` | Upload file (multipart `upload=@file`) |
| DELETE | `/notebooks/:id/sources/:sid` | Delete source |
| GET | `/notebooks/:id/sources/:sid/fulltext` | Get full text content |
| GET | `/notebooks/:id/sources/:sid/guide` | Get source guide |
| POST | `/notebooks/:id/sources/:sid/refresh` | Refresh source |
| GET | `/notebooks/:id/sources/:sid/freshness` | Check freshness |
| POST | `/notebooks/:id/sources/:sid/rename` | Rename source `{new_title}` |

### Chat
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/notebooks/:id/chat/ask` | `{question}` | Chat with notebook |
| GET | `/notebooks/:id/chat/conversation` | — | Get conversation ID + turn count |
| GET | `/notebooks/:id/chat/history` | — | Get conversation history |
| DELETE | `/notebooks/:id/chat/conversation` | — | Delete conversation |
| POST | `/notebooks/:id/chat/reset` | — | Reset chat |

### Artifacts
| Method | Path | Query/Body | Description |
|--------|------|------------|-------------|
| POST | `/notebooks/:id/artifacts/generate` | `{type, options}` | Generate artifact |
| GET | `/notebooks/:id/artifacts` | — | List all artifacts |
| GET | `/notebooks/:id/artifacts/tasks/:taskId` | `?wait=true` | Poll task status |
| GET | `/notebooks/:id/artifacts/download` | `?type=&output_format=` | Download artifact |
| GET | `/notebooks/:id/artifacts/reports` | — | List generated reports |
| GET | `/notebooks/:id/artifacts/quizzes` | — | List quizzes |
| GET | `/notebooks/:id/artifacts/flashcards` | — | List flashcards |
| GET | `/notebooks/:id/artifacts/infographics` | — | List infographics |
| GET | `/notebooks/:id/artifacts/slide-decks` | — | List slide decks |
| GET | `/notebooks/:id/artifacts/videos` | — | List videos |
| GET | `/notebooks/:id/artifacts/data-tables` | — | List data tables |
| GET | `/notebooks/:id/artifacts/audio` | — | List audio |
| POST | `/notebooks/:id/artifacts/suggest-reports` | — | Suggest report topics |
| POST | `/notebooks/:id/artifacts/generate-study-guide` | — | Generate study guide |
| POST | `/notebooks/:id/artifacts/generate-cinematic-video` | — | Generate cinematic video |

### Bulk Operations
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/bulk/upload` | `{notebook_id?, docs_dir?, files?}` | Upload specific files |
| POST | `/bulk/upload-all-docs` | — | Upload all 11 default docs |
| POST | `/bulk/delete-all-sources` | `{notebook_id?}` | Delete all sources |

---

## RAG Response Format

```json
{
  "answer": "The Main Dashboard is a **Unified Dashboard**...",
  "conversation_id": "uuid",
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

---

## Notes

- `suggest-reports` endpoint may timeout — NotebookLM API limitation
- File upload uses direct `notebooklm-py` client (bypasses broken REST API)
- RAG `ask` uses direct client for full reference data
- All Python calls use `async with NotebookLMClient.from_storage()` context
- Default notebook ID hardcoded: `10b4e732-ccb0-45f2-80a9-354502ebf89c`
- Python path: `C:\Users\nbgmf\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe`
