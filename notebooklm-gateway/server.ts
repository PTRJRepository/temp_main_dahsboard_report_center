import { Elysia } from "elysia";
import { spawn } from "bun";
import { join } from "path";

// ============================================================
// Config
// ============================================================
const PYTHON_API = "http://localhost:8002";
const NOTEBOOK_ID = "10b4e732-ccb0-45f2-80a9-354502ebf89c";
const DOCS_DIR = "D:/Gawean Rebinmas/Main Dashboard/docs";
const PYTHON_EXE = "C:/Users/nbgmf/AppData/Local/hermes/hermes-agent/venv/Scripts/python.exe";

// ============================================================
// Utility: Spawn Python script → JSON (async with context)
// ============================================================
async function py(script: string, timeout = 120): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn({
      cmd: [PYTHON_EXE, "-c", script],
      stdout: "pipe",
      stderr: "pipe",
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.pipeTo(new WritableStream({ write(d) { stdout += new TextDecoder().decode(d); } }));
    proc.stderr.pipeTo(new WritableStream({ write(d) { stderr += new TextDecoder().decode(d); } }));
    setTimeout(() => { proc.kill(); reject(new Error("Timeout after " + timeout + "s")); }, timeout * 1000);
    proc.exited.then(code => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout.trim())); }
        catch { resolve(stdout.trim()); }
      } else {
        reject(new Error(stderr || stdout || "Exit code " + code));
      }
    });
  });
}

// ============================================================
// Utility: Proxy to Python REST API
// ============================================================
async function pyApi(method: string, path: string, body?: any) {
  const url = `${PYTHON_API}${path}`;
  const opts: RequestInit = { method, headers: {} };
  if (body) {
    opts.body = JSON.stringify(body);
    opts.headers = { "Content-Type": "application/json" };
  }
  const r = await fetch(url, opts);
  return await r.json();
}

// ============================================================
// Utility: Upload file via direct notebooklm-py
// ============================================================
async function pyUploadFile(notebookId: string, filePath: string, displayName: string) {
  const escapedPath = filePath.replace(/\\/g, "\\\\");
  const escapedName = displayName.replace(/"/g, '\\"');
  const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json

async def upload():
    async with NotebookLMClient.from_storage() as client:
        nb_id = "${notebookId}"
        fpath = r"${escapedPath}"
        name = "${escapedName}"
        try:
            src = await client.sources.add_file(nb_id, fpath, mime_type="text/markdown")
            sid = src.id
            for _ in range(30):
                await asyncio.sleep(3)
                sources = await client.sources.list(nb_id)
                for s in sources:
                    if s.id == sid:
                        if s.status.name == "READY":
                            print(json.dumps({"ok":True,"source_id":sid,"name":name,"status":"READY"}))
                            return
                        elif s.status.name == "ERROR":
                            print(json.dumps({"ok":False,"source_id":sid,"name":name,"status":"ERROR"}))
                            return
                        break
            print(json.dumps({"ok":False,"name":name,"status":"TIMEOUT"}))
        except Exception as e:
            print(json.dumps({"ok":False,"name":name,"error":str(e)}))

asyncio.run(upload())
`.trim();
  return await py(script, 120);
}

// ============================================================
// Utility: RAG ask via direct client
// ============================================================
async function pyRagAsk(notebookId: string, question: string) {
  const escapedQ = question.replace(/'/g, "\\'").replace(/\n/g, " ");
  const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json

async def ask():
    async with NotebookLMClient.from_storage() as client:
        nb_id = "${notebookId}"
        q = '${escapedQ}'
        result = await client.chat.ask(nb_id, q)
        refs = []
        for r in result.references:
            refs.append({
                "source_id": r.source_id,
                "citation_number": r.citation_number,
                "cited_text": r.cited_text[:200] if r.cited_text else "",
                "score": round(r.score, 4)
            })
        out = {
            "answer": result.answer,
            "conversation_id": result.conversation_id,
            "turn_number": result.turn_number,
            "is_follow_up": result.is_follow_up,
            "references": refs
        }
        print(json.dumps(out, ensure_ascii=False))

asyncio.run(ask())
`.trim();
  return await py(script, 60);
}

// ============================================================
// Default docs list
// ============================================================
const DEFAULT_DOCS = [
  { name: "00-INDEX",               path: "INDEX/README.md" },
  { name: "01-Project-Overview",    path: "01-project-overview/README.md" },
  { name: "02-Server-Architecture", path: "02-server-architecture/README.md" },
  { name: "03-Services-Query-API",  path: "03-services-query/README.md" },
  { name: "04-Services-Inventory",  path: "04-services-inventory/README.md" },
  { name: "05-Services-SQLServer",  path: "05-services-sqlserver/README.md" },
  { name: "06-Routes-API",          path: "06-routes-api/README.md" },
  { name: "07-Public-Assets",       path: "07-public-assets/README.md" },
  { name: "08-Database-Schema",     path: "08-database-schema/README.md" },
  { name: "09-Workflow-Artifacts", path: "09-workflow-artifacts/README.md" },
  { name: "10-PRD-Docs",            path: "10-prd-docs/README.md" },
];

// ============================================================
// Elysia App
// ============================================================
const app = new Elysia()
  .get("/", () => ({
    name: "NotebookLM Gateway (Bun.js)",
    version: "1.0.0",
    description: "RAG + Upload Gateway for PT Rebinmas Jaya Main Dashboard docs",
    notebook_id: NOTEBOOK_ID,
    docs_dir: DOCS_DIR,
    python_api: PYTHON_API,
    endpoints: {
      health:            "GET  /health",
      rag_ask:           "POST /rag/ask",
      rag_status:        "GET  /rag/status",
      bulk_upload:       "POST /bulk/upload",
      bulk_upload_all:   "POST /bulk/upload-all-docs",
      bulk_delete_all:   "POST /bulk/delete-all-sources",
      notebooks_list:    "GET  /notebooks",
      notebooks_create:  "POST /notebooks",
      notebooks_get:     "GET  /notebooks/:id",
      notebooks_rename:   "PATCH /notebooks/:id/rename",
      notebooks_delete:   "DELETE /notebooks/:id",
      notebooks_summary:  "GET  /notebooks/:id/summary",
      notebooks_desc:    "GET  /notebooks/:id/description",
      notebooks_share:   "POST /notebooks/:id/share",
      notebooks_share_url:"GET  /notebooks/:id/share-url",
      notebooks_source_ids:"GET  /notebooks/:id/source-ids",
      sources_list:      "GET  /notebooks/:id/sources",
      sources_text:      "POST /notebooks/:id/sources/text",
      sources_url:       "POST /notebooks/:id/sources/url",
      sources_file:      "POST /notebooks/:id/sources/file",
      sources_delete:    "DELETE /notebooks/:id/sources/:sid",
      sources_fulltext:  "GET  /notebooks/:id/sources/:sid/fulltext",
      sources_guide:     "GET  /notebooks/:id/sources/:sid/guide",
      sources_refresh:   "POST /notebooks/:id/sources/:sid/refresh",
      sources_freshness: "GET  /notebooks/:id/sources/:sid/freshness",
      sources_rename:    "POST /notebooks/:id/sources/:sid/rename",
      chat_ask:          "POST /notebooks/:id/chat/ask",
      chat_conversation: "GET  /notebooks/:id/chat/conversation",
      chat_history:      "GET  /notebooks/:id/chat/history",
      chat_reset:        "POST /notebooks/:id/chat/reset",
      chat_delete_conv:  "DELETE /notebooks/:id/chat/conversation",
      artifacts_generate:    "POST /notebooks/:id/artifacts/generate",
      artifacts_list:        "GET  /notebooks/:id/artifacts",
      artifacts_tasks:       "GET  /notebooks/:id/artifacts/tasks/:taskId",
      artifacts_download:    "GET  /notebooks/:id/artifacts/download",
      artifacts_reports:     "GET  /notebooks/:id/artifacts/reports",
      artifacts_quizzes:     "GET  /notebooks/:id/artifacts/quizzes",
      artifacts_flashcards:  "GET  /notebooks/:id/artifacts/flashcards",
      artifacts_infographics:"GET  /notebooks/:id/artifacts/infographics",
      artifacts_slide_decks: "GET  /notebooks/:id/artifacts/slide-decks",
      artifacts_videos:      "GET  /notebooks/:id/artifacts/videos",
      artifacts_data_tables: "GET  /notebooks/:id/artifacts/data-tables",
      artifacts_audio:       "GET  /notebooks/:id/artifacts/audio",
      artifacts_suggest:     "POST /notebooks/:id/artifacts/suggest-reports",
      artifacts_study_guide: "POST /notebooks/:id/artifacts/generate-study-guide",
      artifacts_cinematic:   "POST /notebooks/:id/artifacts/generate-cinematic-video",
    },
  }))

  // ============================================================
  // Health
  // ============================================================
  .get("/health", async () => {
    try {
      const r = await fetch(`${PYTHON_API}/health`);
      const d = await r.json();
      return { ok: true, python_api: "online", ...d };
    } catch {
      return { ok: false, python_api: "offline" };
    }
  })

  // ============================================================
  // Notebooks
  // ============================================================
  .get("/notebooks", async () => pyApi("GET", "/v1/notebooks"))
  .post("/notebooks", async ({ body }) => pyApi("POST", "/v1/notebooks", body))
  .get("/notebooks/:id", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}`))
  .patch("/notebooks/:id/rename", async ({ params, body }) => pyApi("PATCH", `/v1/notebooks/${params.id}/rename`, body))
  .delete("/notebooks/:id", async ({ params }) => pyApi("DELETE", `/v1/notebooks/${params.id}`))
  .get("/notebooks/:id/summary", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}/summary`))
  .get("/notebooks/:id/description", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}/description`))

  .get("/notebooks/:id/share-url", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
async def run():
    async with NotebookLMClient.from_storage() as client:
        url = await client.notebooks.get_share_url("${params.id}")
        print(url)
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .post("/notebooks/:id/share", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        result = await client.notebooks.share("${params.id}")
        print(json.dumps(result, ensure_ascii=False))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/source-ids", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        ids = await client.notebooks.get_source_ids("${params.id}")
        print(json.dumps({"ok":True,"source_ids":ids}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  // ============================================================
  // Sources
  // ============================================================
  .get("/notebooks/:id/sources", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}/sources`))
  .post("/notebooks/:id/sources/text", async ({ params, body }) => pyApi("POST", `/v1/notebooks/${params.id}/sources/text`, body))
  .post("/notebooks/:id/sources/url", async ({ params, body }) => pyApi("POST", `/v1/notebooks/${params.id}/sources/url`, body))

  .post("/notebooks/:id/sources/file", async ({ params, body }) => {
    const form = body as any;
    const file = form?.upload;
    if (!file) return { ok: false, error: "No file uploaded (field name must be 'upload')" };
    const tmpPath = join(import.meta.dir, `tmp_${Date.now()}_${file.name}`);
    const buffer = await file.arrayBuffer();
    Bun.write(tmpPath, Buffer.from(buffer));
    const result = await pyUploadFile(params.id, tmpPath, file.name || "uploaded");
    try { Bun.file(tmpPath).delete(); } catch {}
    return result;
  })

  .delete("/notebooks/:id/sources/:sid", async ({ params }) => pyApi("DELETE", `/v1/notebooks/${params.id}/sources/${params.sid}`))
  .get("/notebooks/:id/sources/:sid/fulltext", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}/sources/${params.sid}/fulltext`))
  .get("/notebooks/:id/sources/:sid/guide", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}/sources/${params.sid}/guide`))

  .post("/notebooks/:id/sources/:sid/refresh", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        result = await client.sources.refresh("${params.id}", "${params.sid}")
        print(json.dumps({"ok": bool(result)}))
asyncio.run(run())
`.trim();
    return await py(script, 30);
  })

  .get("/notebooks/:id/sources/:sid/freshness", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        result = await client.sources.check_freshness("${params.id}", "${params.sid}")
        print(json.dumps({"ok":True,"fresh":bool(result)}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .post("/notebooks/:id/sources/:sid/rename", async ({ params, body }) => {
    const newTitle = (body as any)?.new_title || "";
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        result = await client.sources.rename("${params.id}", "${params.sid}", "${newTitle}")
        print(json.dumps({"ok":True,"source":str(result)}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  // ============================================================
  // Chat / RAG
  // ============================================================
  .post("/notebooks/:id/chat/ask", async ({ params, body }) => {
    const { question } = body || {};
    if (!question) return { ok: false, error: "question is required" };
    return await pyRagAsk(params.id, question);
  })

  .get("/notebooks/:id/chat/conversation", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        conv_id = await client.chat.get_conversation_id("${params.id}")
        turns = await client.chat.get_conversation_turns("${params.id}", conv_id) if conv_id else []
        print(json.dumps({"ok":True,"conversation_id":conv_id,"turns":len(turns)}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/chat/history", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        history = await client.chat.get_history("${params.id}")
        print(json.dumps({"ok":True,"history":history}, ensure_ascii=False))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .delete("/notebooks/:id/chat/conversation", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        await client.chat.delete_conversation("${params.id}")
        print(json.dumps({"ok":True}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .post("/notebooks/:id/chat/reset", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        await client.chat.reset_after_open("${params.id}")
        print(json.dumps({"ok":True}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  // ============================================================
  // RAG shortcuts (default notebook)
  // ============================================================
  .post("/rag/ask", async ({ body }) => {
    const { question, notebook_id } = body || {};
    if (!question) return { ok: false, error: "question is required" };
    const nbId = notebook_id || NOTEBOOK_ID;
    return await pyRagAsk(nbId, question);
  })

  .get("/rag/status", async () => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        sources = await client.sources.list("${NOTEBOOK_ID}")
        ready = [s for s in sources if s.status.name == "READY"]
        error = [s for s in sources if s.status.name == "ERROR"]
        print(json.dumps({
            "notebook_id": "${NOTEBOOK_ID}",
            "total_sources": len(sources),
            "ready": len(ready),
            "errors": len(error),
            "sources": [{"id": s.id, "title": s.title, "status": s.status.name} for s in sources]
        }, ensure_ascii=False))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  // ============================================================
  // Bulk Upload
  // ============================================================
  .post("/bulk/upload", async ({ body }) => {
    const { notebook_id, docs_dir, files } = body || {};
    const nbId = notebook_id || NOTEBOOK_ID;
    const baseDir = docs_dir || DOCS_DIR;
    const fileList = files || DEFAULT_DOCS;
    const results = [];
    for (const f of fileList) {
      const fpath = join(baseDir, f.path);
      const r = await pyUploadFile(nbId, fpath, f.name);
      results.push({ name: f.name, ...r });
      await new Promise(r => setTimeout(r, 1000));
    }
    return { ok: true, results };
  })

  .post("/bulk/upload-all-docs", async () => {
    const results = [];
    for (const f of DEFAULT_DOCS) {
      const fpath = join(DOCS_DIR, f.path);
      const r = await pyUploadFile(NOTEBOOK_ID, fpath, f.name);
      results.push({ name: f.name, ...r });
      await new Promise(r => setTimeout(r, 1000));
    }
    return { ok: true, results, total: results.length };
  })

  .post("/bulk/delete-all-sources", async ({ body }) => {
    const { notebook_id } = body || {};
    const nbId = notebook_id || NOTEBOOK_ID;
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        sources = await client.sources.list("${nbId}")
        deleted = 0
        for s in sources:
            await client.sources.delete("${nbId}", s.id)
            deleted += 1
        print(json.dumps({"ok":True,"deleted":deleted}))
asyncio.run(run())
`.trim();
    return await py(script, 60);
  })

  // ============================================================
  // Artifacts
  // ============================================================
  .post("/notebooks/:id/artifacts/generate", async ({ params, body }) => pyApi("POST", `/v1/notebooks/${params.id}/artifacts/generate`, body))
  .get("/notebooks/:id/artifacts", async ({ params }) => pyApi("GET", `/v1/notebooks/${params.id}/artifacts`))
  .get("/notebooks/:id/artifacts/tasks/:taskId", async ({ params, query }) => pyApi("GET", `/v1/notebooks/${params.id}/artifacts/tasks/${params.taskId}?wait=${query?.wait || false}`))
  .get("/notebooks/:id/artifacts/download", async ({ params, query }) => pyApi("GET", `/v1/notebooks/${params.id}/artifacts/download?type=${query?.type || "report"}&output_format=${query?.output_format || "json"}`))

  .get("/notebooks/:id/artifacts/reports", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        reports = await client.artifacts.list_reports("${params.id}")
        print(json.dumps({"ok":True,"reports":[str(r) for r in reports]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/quizzes", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        quizzes = await client.artifacts.list_quizzes("${params.id}")
        print(json.dumps({"ok":True,"quizzes":[str(q) for q in quizzes]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/flashcards", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        cards = await client.artifacts.list_flashcards("${params.id}")
        print(json.dumps({"ok":True,"flashcards":[str(c) for c in cards]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/infographics", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        items = await client.artifacts.list_infographics("${params.id}")
        print(json.dumps({"ok":True,"infographics":[str(i) for i in items]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/slide-decks", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        slides = await client.artifacts.list_slide_decks("${params.id}")
        print(json.dumps({"ok":True,"slide_decks":[str(s) for s in slides]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/videos", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        videos = await client.artifacts.list_video("${params.id}")
        print(json.dumps({"ok":True,"videos":[str(v) for v in videos]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/data-tables", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        tables = await client.artifacts.list_data_tables("${params.id}")
        print(json.dumps({"ok":True,"data_tables":[str(t) for t in tables]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .get("/notebooks/:id/artifacts/audio", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        audio = await client.artifacts.list_audio("${params.id}")
        print(json.dumps({"ok":True,"audio":[str(a) for a in audio]}))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .post("/notebooks/:id/artifacts/suggest-reports", async ({ params }) => {
    const script = `
import asyncio, os, sys
sys.path.insert(0, r"C:/Users/nbgmf/AppData/Local/hermes/notebooklm-rest-api")
os.environ["NOTEBOOKLM_STORAGE_PATH"] = r"C:/Users/nbgmf/.notebooklm"
from notebooklm import NotebookLMClient
import json
async def run():
    async with NotebookLMClient.from_storage() as client:
        suggestions = await client.artifacts.suggest_reports("${params.id}")
        out = [{"title": s.title, "description": s.description, "audience_level": s.audience_level} for s in suggestions]
        print(json.dumps({"ok":True,"suggestions":out}, ensure_ascii=False))
asyncio.run(run())
`.trim();
    return await py(script, 15);
  })

  .post("/notebooks/:id/artifacts/generate-study-guide", async ({ params }) => pyApi("POST", `/v1/notebooks/${params.id}/artifacts/generate`, { type: "study_guide", options: {} }))
  .post("/notebooks/:id/artifacts/generate-cinematic-video", async ({ params }) => pyApi("POST", `/v1/notebooks/${params.id}/artifacts/generate`, { type: "cinematic_video", options: {} }))

  // ============================================================
  // Start
  // ============================================================
  .listen({ port: 8003, hostname: "0.0.0.0" }, () => {
    console.log("==========================================");
    console.log("  NotebookLM Gateway (Bun.js)");
    console.log("  http://localhost:8003");
    console.log("==========================================");
    console.log("  Notebook ID : " + NOTEBOOK_ID);
    console.log("  Docs dir    : " + DOCS_DIR);
    console.log("  Python API  : " + PYTHON_API);
    console.log("==========================================");
    console.log("  Key endpoints:");
    console.log("  POST /rag/ask              - RAG query (default notebook)");
    console.log("  GET  /rag/status           - Source status check");
    console.log("  POST /bulk/upload-all-docs - Bulk upload all 11 docs");
    console.log("  POST /bulk/delete-all     - Clear all sources");
    console.log("  GET  /notebooks            - List notebooks");
    console.log("  GET  /notebooks/:id/sources - List sources");
    console.log("  POST /notebooks/:id/chat/ask - Chat with notebook");
    console.log("==========================================");
  });

export default app;
