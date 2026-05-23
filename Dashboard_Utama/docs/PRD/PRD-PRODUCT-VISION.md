# PRD: Product Vision & Scope

## PT Rebinmas Jaya Report Center

## 1. Executive Summary

PT Rebinmas Jaya Report Center is a dedicated reporting portal for operational, HR, payroll, inventory, productivity, estate, and audit reporting. It centralizes report discovery, preview, filtering, exporting, and audit visibility without becoming a transactional CRUD application.

The product exists to solve a recurring operational problem: users know the data they need, but reports are scattered, inconsistently named, hard to preview, slow to export, and often dependent on manual file sharing. Report Center gives every authorized user one place to find trusted reports quickly, understand report context before opening, and export large datasets without blocking their work.

The system follows a strict **no-CRUD principle**:

| Allowed | Not Allowed |
|---|---|
| Search reports | Create operational records |
| Browse report modules | Edit source data |
| Preview report output | Delete transactional data |
| Apply report filters | Maintain master data |
| Export report files | Approve, post, or mutate business transactions |
| Favorite and view recent reports | Replace HRIS, payroll, inventory, or estate systems |
| Administer report metadata and access policy | Become a generic admin panel |

Report Center is a glassmorphism-styled, dark navy operational portal with a persistent sidebar, fast search, and green/gold visual language:

| Design Token | Usage |
|---|---|
| `#071426` dark navy | Primary sidebar and application shell |
| `#167A3A` green accent | Active state, primary action, successful status |
| Gold highlight | Executive emphasis, priority markers, pinned insights |
| Glassmorphism | Report cards, previews, command overlays, dashboard panels |

## 2. North-Star Metric

> **Any report accessible in under 10 seconds from any page.**

This means a permitted user can start from any page, search or navigate, identify the correct report, and reach a usable preview or viewer state in less than 10 seconds under normal network conditions.

## 3. Product Scope

### 3.1 Modules

| Module | Report Count | Primary Audience |
|---|---:|---|
| Absensi | 18 | Kerani, HR, Manager, Admin |
| Payroll | 24 | Payroll, HR, Manager, Admin |
| Daftar Upah | 15 | Payroll, HR, Manager, Admin |
| Inventory | 22 | Kerani, Manager, Admin |
| Premi & Lembur | 12 | Payroll, HR, Manager, Admin |
| Produktivitas | 16 | Kerani, Manager, Admin |
| Karyawan | 20 | HR, Manager, Admin |
| Estate / Divisi | 10 | Kerani, Manager, Admin |
| Integrasi & Audit | 14 | Admin, Manager |

Total initial catalog: **151 reports**.

### 3.2 User Roles

| Role | Primary Need |
|---|---|
| Kerani | Find daily operational reports by estate, division, gang, and date |
| HR | Review employee, attendance, and payroll-support reports |
| Payroll | Validate pay, wage, overtime, and premium calculations |
| Manager | Monitor exceptions, trends, summaries, and operational performance |
| Admin | Govern access, monitor audit activity, and maintain report metadata |

## 4. User Personas

### 4.1 Sari, Kerani Divisi

| Attribute | Detail |
|---|---|
| Context | Handles daily field administration for attendance, productivity, and estate/division reporting |
| Pain Points | Report names are hard to remember; date filters are repetitive; slow exports delay end-of-day reconciliation |
| Goals | Open daily reports quickly, reuse common filters, export clean Excel files for local checks |
| Success Signal | Can reach today's Absensi or Produktivitas report in one search and export it without asking IT |

### 4.2 Budi, Payroll Officer

| Attribute | Detail |
|---|---|
| Context | Validates payroll, daftar upah, premi, and lembur before payroll closing |
| Pain Points | Needs to compare related reports; large exports time out; unclear report freshness causes rework |
| Goals | Confirm report data period, run heavy exports asynchronously, trace calculation-support reports |
| Success Signal | Can queue payroll exports, keep working, and download files when processing completes |

### 4.3 Maya, HR Supervisor

| Attribute | Detail |
|---|---|
| Context | Reviews attendance patterns, employee status, compliance, and personnel reporting |
| Pain Points | Sensitive employee data must be scoped; common reports are buried; mobile access is difficult |
| Goals | Search employee-related reports semantically, preview columns before opening, protect personal data |
| Success Signal | Can answer employee status and attendance questions without exposing data outside her authority |

### 4.4 Pak Arif, Estate Manager

| Attribute | Detail |
|---|---|
| Context | Needs executive visibility across estate, division, productivity, inventory, and payroll signals |
| Pain Points | Too many detailed reports; exceptions are not surfaced; switching between modules is slow |
| Goals | Use command mode to jump to strategic reports, see anomalies, and export executive packs |
| Success Signal | Can identify division-level risk in under 10 seconds and open the supporting report immediately |

## 5. Product Principles

| # | Principle | Product Rule |
|---:|---|---|
| 1 | Search-first | Global search is available from every page and is the fastest route to any report |
| 2 | Preview-before-open | Users see purpose, columns, filters, freshness, and sample rows before loading full reports |
| 3 | No-CRUD clarity | The portal never creates, edits, or deletes source business records |
| 4 | Role-aware by default | Every menu, result, preview, and export respects role and data scope |
| 5 | Two-click access | Any report must be reachable from dashboard, sidebar, search, recent, or favorites within two primary interactions |
| 6 | Fast perceived performance | Skeletons, cached metadata, preview contracts, and async exports keep the UI responsive |
| 7 | Export without waiting | Heavy exports go to a queue with visible status and notifications |
| 8 | Explain the report | Every report has a business definition, owner, refresh timing, filters, and data sensitivity label |
| 9 | Audit everything meaningful | Searches, opens, previews, exports, denied access, and admin changes are traceable |
| 10 | Consistent report contract | All reports share a standard preview, filter, table, export, and error model |

## 6. Innovative Feature Specifications

## 6.1 Report Intelligence Layer

The Report Intelligence Layer enriches each report with metadata, behavioral signals, and operational context so the portal can recommend, rank, and explain reports.

| Capability | Description |
|---|---|
| Report fingerprint | Unique metadata profile containing module, owner, sensitivity, source system, refresh cadence, default filters, output columns, and export formats |
| Usage-aware ranking | Search and dashboard ordering consider role, recent usage, favorites, frequency, and seasonal payroll/closing context |
| Related reports | Shows upstream, downstream, and comparable reports such as Absensi versus Payroll attendance inputs |
| Freshness indicator | Displays last refresh time, source latency, and stale-data warnings |
| Exception hints | Highlights common anomalies: missing gang, zero productivity, payroll mismatch, unposted integration batch |

Acceptance criteria:

| ID | Requirement |
|---|---|
| RI-01 | Every report has a metadata fingerprint before launch |
| RI-02 | Search results can be ranked by exact match, semantic match, user history, and role relevance |
| RI-03 | Report detail shows freshness, owner, sensitivity, and related reports |
| RI-04 | Reports with stale source data display a warning before export |

## 6.2 Executive Command Mode

Executive Command Mode is a keyboard-driven command overlay for managers and admins who need instant navigation and decision shortcuts.

Trigger: `Ctrl+K` on desktop or search icon long-press on mobile.

| Command Type | Example |
|---|---|
| Open report | `open payroll summary april` |
| Filter jump | `absensi today divisi 3` |
| Executive pack | `export estate weekly pack` |
| Exception view | `show payroll anomalies` |
| Navigation | `go exports`, `go recent`, `go inventory` |

Behavior:

| State | Behavior |
|---|---|
| Empty | Shows recent commands, pinned executive reports, and role-relevant shortcuts |
| Typing | Shows command suggestions, report matches, filter chips, and module matches |
| Confirmation | Risky actions such as large export show estimated row count and queue behavior |
| Completed | Navigates, previews, or queues export with toast confirmation |

Acceptance criteria:

| ID | Requirement |
|---|---|
| ECM-01 | Command overlay opens from every authenticated page |
| ECM-02 | Results are permission-filtered before display |
| ECM-03 | User can navigate to a report preview without touching the sidebar |
| ECM-04 | Large export commands are routed to Smart Export Queue |

## 6.3 Universal Report Preview Contract

The Universal Report Preview Contract standardizes how every report describes itself before full execution.

| Contract Field | Purpose |
|---|---|
| `reportId` | Stable report identifier |
| `moduleSlug` | Owning module |
| `title` | Human-readable report name |
| `businessPurpose` | Why the report exists |
| `defaultFilters` | Initial safe filter set |
| `requiredFilters` | Filters needed before load |
| `columns` | Column names, types, sensitivity, and visibility |
| `sampleRows` | Small role-scoped preview |
| `refreshStatus` | Last successful refresh and freshness state |
| `exportOptions` | XLSX, CSV, PDF, scheduled pack availability |
| `accessPolicy` | Role and scope constraints |

Preview states:

| State | UI Behavior |
|---|---|
| Available | Shows metadata, sample rows, filters, and open/export actions |
| Requires filter | Disables full load until required filters are provided |
| Restricted | Shows no sensitive data and explains access limitation |
| Stale | Allows viewing with warning if policy permits |
| Error | Shows report owner, retry action, and incident reference |

Acceptance criteria:

| ID | Requirement |
|---|---|
| UPC-01 | All 151 launch reports implement the same preview contract |
| UPC-02 | Preview payload must load faster than full report execution |
| UPC-03 | Sample rows are always permission and scope filtered |
| UPC-04 | Missing required filters block full report execution |

## 6.4 Smart Export Queue

Smart Export Queue handles heavy report exports asynchronously with visibility, prioritization, and retry.

| Capability | Description |
|---|---|
| Queue submission | Users request export from viewer, preview, command mode, or report list |
| Estimated size | System estimates rows, file size, and processing time before queueing |
| Status tracking | Pending, processing, completed, failed, expired, canceled |
| Notifications | In-app notification when export is ready or failed |
| Secure downloads | Time-limited download URLs, role-checked at request and download time |
| Priority rules | Small exports first; payroll closing exports can receive elevated priority |

Acceptance criteria:

| ID | Requirement |
|---|---|
| SEQ-01 | Exports above configured threshold are always queued |
| SEQ-02 | User can leave the page after requesting export |
| SEQ-03 | Export history is visible under `/exports` |
| SEQ-04 | Failed exports expose retry and support reference |
| SEQ-05 | Download events are written to audit trail |

## 6.5 Semantic Search

Semantic Search lets users find reports by business meaning, not just exact names.

Examples:

| User Query | Expected Match |
|---|---|
| `karyawan tidak masuk minggu ini` | Absensi absence reports, employee attendance summary |
| `gaji lembur divisi 2 april` | Payroll and Premi & Lembur reports with month/division filters |
| `stok pupuk rendah` | Inventory stock balance and low-stock reports |
| `hasil panen per gang` | Produktivitas reports scoped by gang |

Capabilities:

| Capability | Description |
|---|---|
| Synonym dictionary | Maps local terms, abbreviations, and Indonesian business terms |
| Filter extraction | Detects dates, estate, division, gang, employee, and module terms |
| Permission filtering | Unauthorized reports never appear in results |
| Result explanation | Shows why a result matched the query |
| Typo tolerance | Handles common spelling variation and shorthand |

Acceptance criteria:

| ID | Requirement |
|---|---|
| SS-01 | Search returns useful results for exact names, synonyms, and natural language queries |
| SS-02 | Search suggestions respond while typing |
| SS-03 | Extracted filters can be applied directly to preview or viewer |
| SS-04 | Restricted reports are excluded, not merely disabled |

## 7. Success Metrics

| Metric | Definition | Target |
|---|---|---:|
| Report access time | Median time from page load or navigation intent to report preview | `< 10 sec` |
| Search success rate | Searches that lead to preview/open/export within 60 seconds | `>= 85%` |
| Preview adoption | Report opens preceded by preview interaction | `>= 70%` |
| Export queue success | Queued exports completed without manual support | `>= 98%` |
| Failed export recovery | Failed exports resolved by retry or clear support reference | `>= 95%` |
| Favorite usage | Active users with at least 5 favorite reports | `>= 60%` |
| Recent return rate | Reports reopened from recent list | `>= 35%` |
| No-access clarity | Denied access events with clear reason displayed | `100%` |
| Report metadata completeness | Reports with owner, freshness, sensitivity, and filters defined | `100%` |
| Support ticket reduction | Report-location and export-timeout tickets after launch | `-50%` |

## 8. Out of Scope

| Area | Reason |
|---|---|
| CRUD for employee, payroll, inventory, or estate master data | Source systems remain authoritative |
| Transaction approval workflows | Report Center is read-only and reporting-focused |
| Payroll calculation engine | Payroll reports display validated outputs and supporting details only |
| Inventory stock movement posting | Operational inventory system remains source of truth |
| Attendance correction forms | Attendance source application handles correction workflows |
| BI dashboard builder for end users | Launch scope is governed report catalog, not self-service modeling |
| Public or unauthenticated report sharing | All access requires authentication and authorization |
| Permanent export links | Downloads are time-limited and audited |
| Cross-company multi-tenant administration | Initial scope is PT Rebinmas Jaya |
| Offline-first mobile application | Responsive web behavior is included; offline app is not |

