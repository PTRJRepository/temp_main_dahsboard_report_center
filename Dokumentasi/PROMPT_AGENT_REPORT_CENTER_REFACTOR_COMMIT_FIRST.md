# PROMPT MASTER — Report Center Refactor (COMMIT FIRST)

**Cara pakai:** salin seluruh blok antara  
`===== BEGIN PROMPT =====` dan `===== END PROMPT =====`  
ke Claude Code / Codex / Cursor / Hermes agent lain.

**Bahasa kerja:** Indonesia untuk UI copy & laporan ke user; kode mengikuti style repo (TS/TSX, single quotes, 2-space).

---

===== BEGIN PROMPT =====

# ROLE
Anda adalah **Principal Frontend Engineer** untuk PT Rebinmas Jaya — Report Center (Procurement + Inventory).

Tugas: **refactor bertahap** berdasarkan audit & dokumentasi yang sudah ada, dengan disiplin:

1. **COMMIT DULU** (checkpoint aman) sebelum mengubah kode  
2. Baca **index dokumentasi**  
3. Ikuti **implementation plan** di prompt ini  
4. Kerjakan fase demi fase, commit kecil tiap fase yang hijau  
5. **Jangan** big-bang rewrite monolit  
6. **Jangan** CUD SQL; READ-ONLY tetap  

# HARD RULES
- **Commit first, then code.** Jika working tree kotor: status → stage hanya file relevan → commit checkpoint **sebelum** refactor besar.  
- **Jangan** `git push --force`, **jangan** `git reset --hard` kecuali user eksplisit.  
- **Jangan** commit secrets (`.env`, API keys).  
- **Jangan** dua agent mengedit monolit viewer bersamaan.  
- AccCode issue = **dept/cost center**, bukan GL.  
- Period usage ≠ movement aging window.  
- PDF catalog & detail harus **jujur** (pratinjau).  
- Konflik docs: **code + tests > docs**.  
- Windows paths: `D:/Gawean Rebinmas/Main Dashboard/...`  
- Setelah edit: `npx tsc --noEmit` di `Dashboard_Utama` + test terkait bila ada.

# DOCUMENTATION INDEX (WAJIB BACA)

**Entry agent (baca pertama):**
```
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md
```

**Pack UI living docs:**
```
D:/Gawean Rebinmas/Main Dashboard/Dokumentasi/UI-REPORT-CENTER-CURRENT/
  00-INDEX.md
  02-KPI-COMMAND-DECK.md          ← KPI live
  04-TABLE-AND-DETAIL-DESIGN.md
  06-LONG-HORIZON-ROADMAP.md
  13-FILTER-MATRIX.md
  17-AUDIT-UX-PDF-TABLE-PERF.md   ← Hermes audit
  17-CLAUDE-CODE-AUDIT-RAW.md     ← Claude audit (line refs)
  18-PDF-REDESIGN-SPEC.md         ← PDF-A/B/C
  19-EXECUTIVE-SUMMARY-AUDIT.md   ← consensus ~6.5/10  ★ baca untuk prioritas
```

**KPI / plan / prompts terkait:**
```
Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md
Dokumentasi/KATALOG_KPI_PROCUREMENT_KOMPREHENSIF.md
Dokumentasi/PROMPT_AGENT_PROCUREMENT_KPI_DECK_COMPLETE.md
Dokumentasi/REPORT_CENTER_EXPLORATION_INDEX_2026-07-21.md
```

**Skill (jika ada di environment):** `report-center-development`

# CODE ENTRY POINTS
```
Dashboard_Utama/components/report-center/ProcurementKpiStrip.tsx
Dashboard_Utama/components/report-center/ProcurementModuleWorkspace.tsx
Dashboard_Utama/components/report-center/ExportPreflightDialog.tsx
Dashboard_Utama/components/report-center/ReportDataTable.tsx
Dashboard_Utama/components/report-center/ReportTableToolbar.tsx
Dashboard_Utama/components/report-center/reportTableCells.tsx
Dashboard_Utama/components/report-center/MonthlyStockRingkasan.tsx
Dashboard_Utama/components/report-center/ReportControlBar.tsx
Dashboard_Utama/app/(report-center)/report-center/inventory/[report]/ReportViewerClient.tsx
Dashboard_Utama/app/(report-center)/report-center/inventory/InventoryReportsClient.tsx
Dashboard_Utama/utils/format.ts
Dashboard_Utama/app/globals.css
```

# CONSENSUS PRIORITIES (dari audit — jangan diabaikan)
| Priority | Item | Why |
|----------|------|-----|
| **P0** | Samakan PDF honesty catalog + detail | Catalog PDF tanpa pratinjau menipu |
| **P0** | PDF layout minimal (bukan hanya pipe text) | Skor PDF 3.5/10 |
| **P1** | Preflight export di catalog | Honesty split path |
| **P1** | KPI deck progressive disclosure / less noise | Cognitive load |
| **P1** | Table toolbar overflow + min type 11px + dark chips | Readability |
| **P1** | Debounce KPI filter fetches | 8 parallel storms |
| **P2** | Extract monolit slices (export module first) | Maintainability |
| **P2** | A11y export dialog | focus trap / Escape |

**Jangan** mulai dari monolit full rewrite. **Jangan** fitur baru di luar plan tanpa user.

---

# PHASE 0 — COMMIT CHECKPOINT (WAJIB, SEBELUM REFACTOR)

Kerjakan **sekarang**, berurutan:

```bash
cd "D:/Gawean Rebinmas/Main Dashboard"
git status
git branch -vv
git diff --stat
```

### 0.1 Jika ada perubahan **dokumentasi** yang relevan & aman
Stage **hanya** docs (contoh):
```
Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md
Dokumentasi/UI-REPORT-CENTER-CURRENT/**
Dokumentasi/PLAN_PROCUREMENT_KPI_COMMAND_DECK_WOW.md
Dokumentasi/PROMPT_AGENT_*.md
Dokumentasi/KATALOG_KPI_*.md
Dokumentasi/REPORT-CENTER-INVENTORY-DIAGRAMS-ONEFILE.html
```
Commit message contoh:
```
docs(report-center): agent index + UI pack + audit scores (no app code)
```

### 0.2 Jika ada perubahan **kode app** yang sudah ada di tree (bukan dari Anda)
- **Jangan** campur dengan docs commit.  
- Commit terpisah dengan message jujur, **atau** tanya user jika tidak jelas.  
- Jangan commit file sensitif.

### 0.3 Setelah checkpoint
```bash
git status   # clean atau hanya untracked tidak relevan
git log -3 --oneline
```
Catat SHA checkpoint di laporan akhir (contoh: `CHECKPOINT_DOCS=abc1234`).

### 0.4 Update log singkat (opsional file)
Append ke `Dokumentasi/UI-REPORT-CENTER-CURRENT/11-CHANGELOG-UI-SNAPSHOT.md` bahwa refactor agent mulai dari SHA X — **hanya docs**.

**STOP & REPORT** jika:
- Merge conflict  
- Tidak bisa commit (hooks/policy)  
- User belum mengizinkan commit sama sekali → tanya sekali, default: commit docs OK  

---

# IMPLEMENTATION PLAN (setelah commit)

Kerjakan **berurutan**. Tiap fase: code → verify → **commit kecil**.

## PHASE 1 — Export honesty unify (P0, low risk) ★ UTAMA AWAL

**Goal:** Catalog & detail memakai kontrak pratinjau yang sama.

### 1A. Shared preview helper (extract, no behavior regression)
- Buat helper mis. `Dashboard_Utama/lib/reports/export-pdf-preview.ts` (atau path setara project style):
  - watermark / banner text PRATINJAU  
  - max rows/cols constants (detail 34×7, catalog align)  
  - filename `*-pratinjau.pdf`  
  - metadata lines: title, source, period if available  
  - gunakan `formatMetric` / format yang sudah ada, **bukan** raw dump buta  
- Wire `ReportViewerClient` `exportPdf` ke helper.  
- Wire `InventoryReportsClient` `exportPdf` ke helper — **wajib** watermark + nama pratinjau.  

### 1B. Catalog preflight
- Pakai `ExportPreflightDialog` (atau setara) di path catalog export PDF/Excel/CSV.  
- Excel catalog: jangan diam-diam beda total dari detail tanpa label; dokumentasikan limit di UI.

### 1C. Verify + commit
```bash
cd Dashboard_Utama && npx tsc --noEmit
```
Commit:
```
fix(report-center): unify PDF preview honesty catalog+detail
```

**Exit P1:** Catalog PDF filename/watermark pratinjau; detail tetap jujur; tsc clean.

---

## PHASE 2 — PDF layout v1 (masih preview, bukan “resmi penuh”)

**Goal:** PDF pratinjau **readable table-like**, bukan `col | col | col` satu string saja.

Ikuti `18-PDF-REDESIGN-SPEC.md` PDF-B ringan:
- Header: title + “PRATINJAU”  
- Meta: period/source bila ada  
- Kolom: label manusia (`displayColumnLabel` jika tersedia di context)  
- Angka: format metric; right-align bila feasible di jspdf  
- Footer: “Menampilkan N baris × M kolom · bukan laporan resmi”  
- Page break sederhana jika y overflow  

**Jangan** klaim “laporan resmi penuh” di client slice.

Commit:
```
feat(report-center): structured PDF preview layout (still pratinjau)
```

---

## PHASE 3 — KPI deck density (UX, medium risk)

**Goal:** CEO 5 detik — kurangi noise, **jangan** hapus data.

Baca dulu `02-KPI-COMMAND-DECK.md` + audit IA.

### Allowed changes
- Accordion/tabs: Valuasi | Proses | Movement (default hero+valuasi terbuka)  
- Satu baris chip filter (hapus double-echo period/MC)  
- Debounce `scopeCode` 300–500ms sebelum refetch  
- Optional: hero currency compact + title full precision  

### Not in this phase
- Composite API penuh (boleh belakangan)  
- Rewrite seluruh strip  

Commit:
```
refactor(report-center): collapse KPI deck sections + debounce filters
```

---

## PHASE 4 — Table readability (medium)

**Goal:** keterbacaan operator + a11y dasar.

- `reportTableCells`: badge tone **dark-forest** (bukan `bg-red-50` di dark UI)  
- Min font compact ≥ 11px (hindari 9px sebagai default expanded)  
- `aria-sort` pada sorted column header  
- Toolbar: pindahkan secondary actions ke menu “Lainnya” (export tetap accessible)  

Commit:
```
fix(report-center): table density, dark chips, toolbar overflow
```

---

## PHASE 5 — Extract export module from monolit (optional if time)

**Goal:** pindahkan `exportPdf` / `exportExcel` / `downloadCsv` / ceiling helpers keluar `ReportViewerClient` ke `lib/reports/export-inventory-report.ts` (nama sesuaikan).

- Zero behavior change  
- Viewer & catalog import shared  

Commit:
```
refactor(report-center): extract inventory export helpers from monolit
```

---

## PHASE 6 — Docs sync (wajib sebelum bilang selesai)

Update **docs only**:
- `UI-REPORT-CENTER-CURRENT/11-CHANGELOG-UI-SNAPSHOT.md` — apa yang LIVE sekarang  
- `02-KPI-COMMAND-DECK.md` jika deck UI berubah  
- `19` atau note di changelog: skor PDF naik setelah P1–P2 (jujur: masih pratinjau)  
- Jangan fake “PDF resmi” di docs  

Commit:
```
docs(report-center): sync UI pack after export/KPI/table refactor
```

---

# OUT OF SCOPE (jangan kerjakan kecuali user bilang)
- Server-side full official PDF job (PDF-C)  
- HR/FFB modules  
- Force push / history rewrite  
- Redesign seluruh ReportViewerClient 5k lines sekaligus  
- Menghapus export honesty / menaikkan PDF limit diam-diam tanpa UI  

# VERIFY MATRIX

| Phase | Check |
|-------|--------|
| 0 | git log shows docs (and/or clean) checkpoint |
| 1 | Catalog PDF name has pratinjau; watermark; tsc |
| 2 | Open PDF — readable columns, not only pipes |
| 3 | Procurement page: fewer equal-weight cards; filter debounce |
| 4 | Table chips dark; toolbar cleaner |
| 5 | Import paths work; tsc |
| 6 | Docs match code |

Manual (after login `:3001`):
- `/report-center/procurement?source=estate`  
- Export PDF dari catalog **dan** detail  
- Satu report monthly jika disentuh  

# COMMIT MESSAGE STYLE
- Conventional: `fix|feat|refactor|docs(report-center): …`  
- Satu concern per commit  
- Body optional: why + test note  

# RETURN FORMAT (ke user di akhir)
```
OK/FAIL
CHECKPOINT_SHA: ...
PHASES_DONE: 0,1,...
COMMITS:
  - <sha> <message>
FILES_TOUCHED: (list)
VERIFY: tsc= / manual=
DOCS_UPDATED: yes/no
REMAINING: (honest)
```

# EXECUTION ORDER (TODO)
1. git status / diff / branch  
2. **Commit docs checkpoint** (Phase 0)  
3. Read AGENT_INDEX + 19-EXECUTIVE-SUMMARY + 18-PDF-SPEC  
4. Phase 1 honesty unify + commit  
5. Phase 2 PDF layout v1 + commit  
6. Phase 3 KPI density + commit  
7. Phase 4 table + commit  
8. Phase 5 extract if time + commit  
9. Phase 6 docs sync + commit  
10. Final OK/FAIL report  

**Mulai Phase 0 sekarang. Jangan skip commit checkpoint.**

===== END PROMPT =====

---

## Versi super-pendek

```
Baca Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md + UI-REPORT-CENTER-CURRENT/19-EXECUTIVE-SUMMARY-AUDIT.md + 18-PDF-REDESIGN-SPEC.md.
UTAMAKAN: git status → commit dulu docs/checkpoint BERSIH sebelum refactor.
Lalu implement berurutan + commit kecil tiap fase:
P1 unify PDF/export honesty catalog+detail (pratinjau filename+watermark+preflight catalog)
P2 structured PDF preview (bukan pipe-only)
P3 KPI deck collapse/tabs + debounce filter
P4 table dark chips, min 11px, toolbar overflow, aria-sort
P5 optional extract export helpers from ReportViewerClient
P6 sync UI-REPORT-CENTER-CURRENT changelog
READ-ONLY SQL. No force-push. No big-bang monolit rewrite.
Return OK/FAIL + SHAs + tsc.
```

---

## Catatan untuk user (bukan bagian prompt agent)

- Prompt file: `Dokumentasi/PROMPT_AGENT_REPORT_CENTER_REFACTOR_COMMIT_FIRST.md`  
- Agent index: `Dokumentasi/AGENT_INDEX_REPORT_CENTER_UI.md`  
- Audit: `UI-REPORT-CENTER-CURRENT/19-EXECUTIVE-SUMMARY-AUDIT.md`  
- Scope default = **P0 export/PDF dulu**, baru densitas KPI & tabel — sesuai skor audit.  
- Jika Anda **belum** ingin commit otomatis, tambahkan di chat agent: “Phase 0: tampilkan git status saja, commit setelah saya setuju.”
