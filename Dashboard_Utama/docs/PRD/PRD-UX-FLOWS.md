# PRD: UX Flow Specification

## PT Rebinmas Jaya Report Center

## 1. UX Flow Goals

Report Center flows must make report discovery, preview, viewing, exporting, and access handling predictable. The product is read-only for source business data, so every flow ends in one of these outcomes:

| Outcome | Meaning |
|---|---|
| Preview | User understands report purpose, filters, freshness, and sample data |
| View | User loads report table or summary with scoped data |
| Export | User receives immediate file or queued export |
| Save | User favorites or reuses report access path |
| Explain | User sees why data is empty, unavailable, stale, or restricted |

## 2. Search Flow

```text
User starts on any page
        │
        ▼
Global search focused or Ctrl+K
        │
        ▼
User types query
        │
        ├───────────────┐
        ▼               ▼
Exact match        Semantic parsing
        │               │
        └───────┬───────┘
                ▼
Permission-filtered results
                │
                ├─ Reports
                ├─ Modules
                ├─ Suggested filters
                ├─ Recent matches
                └─ Commands
                │
                ▼
User selects result
                │
        ┌───────┼────────┐
        ▼       ▼        ▼
 Report preview Module   Command action
        │       │        │
        ▼       ▼        ▼
Preview opens  Module    Navigate / queue export
with filters   page
```

Search behavior:

| Step | UX Requirement |
|---|---|
| Focus | Search input expands with glass overlay and grouped suggestions |
| Typing | Results update after short debounce; skeleton appears if delayed |
| Parsing | Dates, division, gang, employee, and period become filter chips |
| Ranking | Exact title, recent use, favorites, role relevance, semantic match |
| Selection | Opens preview unless command explicitly requests export or navigation |
| Audit | Query, result selected, and no-result events are logged without exposing sensitive text unnecessarily |

Search result layout:

```text
┌──────────────────────────────────────────────┐
│ Search: "gaji lembur divisi 2 april"         │
├──────────────────────────────────────────────┤
│ Reports                                      │
│  🟢 Rekap Premi & Lembur Bulanan             │
│     Match: lembur + April + Divisi 2         │
│  🟢 Payroll Summary Bulanan                  │
│     Related payroll output                   │
├──────────────────────────────────────────────┤
│ Filters detected                             │
│  [Period: 2026-04] [Division: 2]             │
├──────────────────────────────────────────────┤
│ Commands                                     │
│  Export lembur April Divisi 2 as XLSX        │
└──────────────────────────────────────────────┘
```

## 3. Module Browse Flow

```text
Dashboard
   │
   ├─ Click sidebar module
   │
   ▼
Module page
   │
   ├─ Module report search
   ├─ Filter by favorite/recent/freshness
   └─ Scan report cards
   │
   ▼
Click report card
   │
   ▼
Universal preview
   │
   ├─ Required filters missing ──► Prompt user to complete filters
   │
   ├─ Data stale ────────────────► Show warning, allow if permitted
   │
   ├─ Access restricted ─────────► No-access flow
   │
   └─ Ready ─────────────────────► Open viewer or export
```

Module page card anatomy:

```text
┌──────────────────────────────────────────────┐
│ Laporan Absensi Harian                  ★    │
│ Daily attendance by estate/division/gang     │
│ Owner: HR Ops     Fresh: 17 May 2026 07:10   │
│ Sensitivity: Internal                        │
│ [Preview] [Export]                           │
└──────────────────────────────────────────────┘
```

Flow requirements:

| Requirement | Detail |
|---|---|
| Report count | Count only reports the user can access |
| Module search | Searches within module and preserves user scope |
| Related reports | Module footer suggests operationally adjacent modules |
| Preview default | Clicking a card opens preview, not heavy full table |

## 4. Report Viewer Flow

```text
Report preview
      │
      ▼
User reviews metadata and sample rows
      │
      ▼
User sets required filters
      │
      ├─ Invalid filter ─────────► Inline validation
      │
      ├─ Filter outside scope ───► Scope warning
      │
      └─ Valid filters
              │
              ▼
          Load report
              │
      ┌───────┼────────┐
      ▼       ▼        ▼
   Loading   Error    Table result
      │       │        │
      │       │        ├─ Sort
      │       │        ├─ Freeze key columns
      │       │        ├─ Adjust density
      │       │        ├─ Save favorite
      │       │        └─ Export
      │       ▼
      │    Error flow
      ▼
Skeleton rows
```

Viewer state model:

| State | UI Behavior |
|---|---|
| Preview | Metadata, sample rows, required filters, freshness, related reports |
| Filter ready | Primary `Load Report` action enabled |
| Loading | Stable table skeleton; filter panel locked except cancel |
| Loaded | Table, summary chips, export actions, column metadata |
| Empty | Empty state explains valid query but no matching records |
| Error | Error state with retry, support reference, and report owner |
| Restricted | No-access state; no data rendered |

Filter requirements:

| Filter Type | UX Rule |
|---|---|
| Date | Use date picker with today/this week/this month presets |
| Period | Use month selector for payroll and daftar upah |
| Estate | Defaults to user's assigned estate if scoped |
| Division | Filtered by estate and user access |
| Gang | Filtered by division and user access |
| Employee | Visible only for permitted HR/payroll/admin reports |

## 5. Export Queue Flow

```text
User clicks Export
       │
       ▼
Export preflight
       │
       ├─ Small result
       │     │
       │     ▼
       │  Generate immediately
       │     │
       │     ▼
       │  Browser download
       │
       └─ Large result or heavy format
             │
             ▼
        Show queue estimate
             │
             ├─ User cancels ─────► Return to report
             │
             └─ User confirms
                    │
                    ▼
             Queue export job
                    │
                    ▼
             Status: Pending
                    │
                    ▼
             Status: Processing
                    │
             ┌──────┴───────┐
             ▼              ▼
        Completed          Failed
             │              │
             ▼              ▼
      Notification       Retry / support
             │
             ▼
        Secure download
```

Export preflight panel:

```text
┌──────────────────────────────────────────────┐
│ Export XLSX                                  │
├──────────────────────────────────────────────┤
│ Report: Payroll Summary Bulanan              │
│ Filters: April 2026, Estate A, Divisi 2      │
│ Estimated rows: 48,200                       │
│ Estimated time: 3-5 minutes                  │
│ Delivery: Export Queue                       │
│                                              │
│ [Cancel]                         [Queue]     │
└──────────────────────────────────────────────┘
```

Export status table:

| Status | User Message | Available Action |
|---|---|---|
| Pending | Export request accepted | Cancel |
| Processing | File is being generated | View report |
| Completed | Export ready | Download |
| Failed | Export failed with reference ID | Retry, contact support |
| Expired | Download window expired | Regenerate |
| Canceled | Export canceled | Queue again |

## 6. Favorite and Recent Flow

```text
User opens report preview or viewer
        │
        ├─ Automatically added to Recent
        │
        ▼
User clicks favorite star
        │
        ├─ Favorite added
        │
        ▼
Favorites page
        │
        ├─ Reorder optional
        ├─ Remove favorite
        ├─ Open with last filters
        └─ Open with default filters
```

Recent behavior:

| Rule | Detail |
|---|---|
| Add event | On preview open and viewer load |
| Store filters | Save last safe filter set per user and report |
| Retention | Show last 30 reports or 90 days, whichever is smaller |
| Scope changes | If user loses access, hide recent item |
| Audit | Recent history uses audit events but displays user-friendly labels |

Favorite behavior:

| Rule | Detail |
|---|---|
| Favorite action | Available on report card, preview, and viewer |
| Default state | Empty favorites page suggests recently used reports |
| Filter memory | User can choose default filters or last used filters |
| Restricted change | If access removed, favorite disappears and is recorded in audit |

## 7. Error and Empty State Flows

### 7.1 Empty Result Flow

```text
Report loaded successfully
        │
        ▼
No rows returned
        │
        ├─ Check filters too narrow
        ├─ Check source freshness
        └─ Suggest related report
        │
        ▼
User adjusts filters or opens related report
```

Empty state content:

| Element | Requirement |
|---|---|
| Title | States that no records match current filters |
| Filter summary | Shows active filters |
| Suggested action | Broaden date, estate, division, gang, or period |
| Related reports | Optional, permission-filtered |
| Export | Disabled unless business rule allows empty export |

### 7.2 Load Error Flow

```text
User loads report
      │
      ▼
System error or timeout
      │
      ├─ Retry available
      ├─ Export queue alternative if timeout
      ├─ Report owner shown
      └─ Incident reference generated
      │
      ▼
Audit error event
```

Error state matrix:

| Error Type | User Copy Intent | Action |
|---|---|---|
| Timeout | Report took too long to load | Retry or queue export |
| Source unavailable | Source system cannot be reached | Retry later, view freshness |
| Invalid filter | Filter combination is not allowed | Correct highlighted filters |
| Contract missing | Report metadata incomplete | Contact owner, admin alert |
| Export failed | File generation failed | Retry or support reference |

## 8. No-Access Flow

```text
User attempts report/module route
        │
        ▼
Authorization check
        │
 ┌──────┴────────┐
 ▼               ▼
Allowed         Denied
 │               │
 ▼               ▼
Open page       No-access page
                 │
                 ├─ Explain general reason
                 ├─ Show user's current role/scope
                 ├─ Suggest accessible alternatives
                 ├─ Provide request-access path if enabled
                 └─ Log denied event
```

No-access page rules:

| Rule | Requirement |
|---|---|
| No data leak | Do not show restricted rows, columns, report internals, or module counts |
| Clear reason | Explain role/scope mismatch in general terms |
| Alternatives | Show accessible module or report suggestions |
| Request access | If enabled, routes to existing IAM/support process, not in-app approval CRUD |
| Audit | Log route, role, scope, timestamp, and denial reason |

No-access layout:

```text
┌──────────────────────────────────────────────┐
│ Access not available                         │
├──────────────────────────────────────────────┤
│ Your current role or data scope does not     │
│ allow this report.                           │
│                                              │
│ Current scope: Estate A / Divisi 2           │
│                                              │
│ Accessible alternatives:                     │
│  • Laporan Absensi Harian                    │
│  • Rekap Produktivitas Divisi                │
│                                              │
│ [Back] [Open accessible reports]             │
└──────────────────────────────────────────────┘
```

## 9. Notification Flow

```text
Background event
      │
      ├─ Export completed
      ├─ Export failed
      ├─ Data source stale
      └─ Access policy changed
      │
      ▼
Notification center
      │
      ├─ Toast for immediate event
      └─ Persistent list for unread event
      │
      ▼
User acts or dismisses
```

Notification requirements:

| Event | Notification |
|---|---|
| Export completed | Toast with download action; persistent notification |
| Export failed | Toast with retry action and reference ID |
| Stale source | Gold indicator on affected reports/modules |
| Access removed | No sensitive report name if user no longer has rights |

## 10. Flow Instrumentation

| Event | Properties |
|---|---|
| `search_started` | role, page, input method |
| `search_result_selected` | result type, report/module ID, rank, filters detected |
| `report_preview_opened` | report ID, module, freshness, source |
| `report_loaded` | report ID, filters, duration, row count bucket |
| `report_empty` | report ID, filter summary, source freshness |
| `export_requested` | report ID, format, estimated size, queue mode |
| `export_completed` | job ID, duration, size bucket |
| `access_denied` | route type, role, scope, reason |
| `favorite_added` | report ID, module |
| `recent_opened` | report ID, age bucket |

