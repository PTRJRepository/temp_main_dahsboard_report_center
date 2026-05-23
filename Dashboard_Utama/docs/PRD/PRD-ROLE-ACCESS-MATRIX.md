# PRD: Role Access Matrix

## PT Rebinmas Jaya Report Center

## 1. RBAC Objective

The Report Center access model protects operational, employee, payroll, and audit data while keeping report discovery fast. Access is enforced at every layer: sidebar visibility, search results, report preview, report execution, export queue, download links, audit views, and admin pages.

Core rule:

> A user only sees modules, reports, rows, columns, filters, exports, and audit events allowed by their role and assigned data scope.

## 2. User Role Definitions

| Role | Description | Typical Scope | Primary Permissions | Restrictions |
|---|---|---|---|---|
| Kerani | Field or office clerk handling daily operational reporting | Assigned estate, division, and sometimes gang | View operational attendance, productivity, inventory, and estate/division reports; export permitted operational reports | No payroll totals, sensitive employee compensation, system audit, or admin access |
| HR | Human resources user responsible for employee and attendance-related reporting | Assigned estate/division or all HR scope depending assignment | View employee, attendance, HR-support payroll inputs, and selected lembur/premi reports | No full payroll calculation reports unless explicitly granted |
| Payroll | Payroll processing user validating wage, payroll, premium, and overtime reports | Payroll processing scope; may span estates for payroll periods | View payroll, daftar upah, premi/lembur, attendance inputs, and employee payroll fields | Limited access to non-payroll inventory and estate operational reports |
| Manager | Operational or estate manager needing summary and exception visibility | Assigned estate/division; some users all-estate | View summaries, exception reports, productivity, attendance, inventory, and approved payroll summaries | Cannot administer access policy; sensitive employee detail may be masked |
| Admin | System/report administrator governing report catalog, access, audit, and health | Global system scope | View all modules subject to administrative policy; manage report metadata/access; inspect audit trail and export jobs | No mutation of source business transactions; no bypass of audit logging |

## 3. Module Access Matrix

Legend:

| Symbol | Meaning |
|---|---|
| `F` | Full module access within data scope |
| `S` | Summary or scoped access only |
| `L` | Limited report subset |
| `A` | Admin/governance access |
| `-` | Hidden/no access by default |

| Module | Reports | Kerani | HR | Payroll | Manager | Admin |
|---|---:|:---:|:---:|:---:|:---:|:---:|
| Absensi | 18 | F | F | S | F | A |
| Payroll | 24 | - | L | F | S | A |
| Daftar Upah | 15 | - | L | F | S | A |
| Inventory | 22 | F | - | - | F | A |
| Premi & Lembur | 12 | L | S | F | S | A |
| Produktivitas | 16 | F | - | - | F | A |
| Karyawan | 20 | L | F | S | S | A |
| Estate / Divisi | 10 | F | S | - | F | A |
| Integrasi & Audit | 14 | - | - | - | S | A |

## 4. Recommended Report Access by Role

| Module | Kerani | HR | Payroll | Manager | Admin |
|---|---|---|---|---|---|
| Absensi | Daily attendance, absence by gang, late/early summary | Attendance detail, absence pattern, employee attendance history | Attendance input summaries for payroll validation | Attendance trend, exceptions, division comparison | All plus metadata and access diagnostics |
| Payroll | Hidden | Payroll-support summaries where granted | Full payroll reports, variance, bank/payment outputs | Approved payroll summary and exception totals | All plus access/audit visibility |
| Daftar Upah | Hidden | Wage-support reports where granted | Full wage list reports by period and division | Summary wage cost by estate/division | All plus governance |
| Inventory | Stock balance, issue/receipt reports, low-stock operational reports | Hidden | Hidden | Stock summary, low-stock, aging, estate comparison | All plus source health |
| Premi & Lembur | Operational lembur input where granted | Lembur/premi validation summary | Full premium and overtime reports | Summary and exception reports | All plus audit |
| Produktivitas | Daily productivity, gang output, estate/division operational reports | Hidden | Hidden | Productivity trends, exceptions, comparisons | All plus source health |
| Karyawan | Basic roster in own scope | Full employee reporting within HR scope | Payroll-relevant employee fields | Headcount and workforce summary; sensitive fields masked | All plus policy diagnostics |
| Estate / Divisi | Assigned estate/division structure and reports | HR organizational scope | Hidden | Full assigned management scope | All |
| Integrasi & Audit | Hidden | Hidden | Hidden | Integration health summary and own-scope audit summaries | Full integration, system audit, access audit |

## 5. Report-Level Access Considerations

Report-level access is more specific than module access. A user may see a module but only a subset of reports inside it.

| Control | Requirement |
|---|---|
| Report visibility | Unauthorized reports are hidden from sidebar counts, module lists, search, favorites, and recent |
| Direct route access | `/reports/[id]` must re-check authorization server-side |
| Preview access | Preview contract must apply same role and scope rules as full viewer |
| Column masking | Sensitive columns can be masked or omitted by role |
| Row filtering | Estate, division, gang, employee, and payroll period filters are enforced server-side |
| Export access | Export payload must match visible data and columns; no export-only privilege escalation |
| Related reports | Suggestions must be permission-filtered |
| Command mode | Commands and command results must be permission-filtered before display |

Sensitive report categories:

| Category | Examples | Default Access |
|---|---|---|
| Compensation | Salary, payroll net pay, bank/payment output | Payroll, Admin; Manager summary only |
| Personal employee data | Identity fields, employment status, employee history | HR, Admin; limited Payroll/Manager |
| Attendance detail | Individual attendance and absence records | Kerani scoped, HR scoped, Payroll summary, Manager scoped |
| Operational productivity | Gang output, division productivity, estate comparison | Kerani scoped, Manager scoped, Admin |
| Inventory valuation | Stock value, aging, variance | Manager, Admin; Kerani operational subset |
| Integration/audit | Sync errors, access events, export history | Admin; Manager scoped summary |

## 6. Division and Gang Scope Rules

Scope hierarchy:

```text
Company
└─ Estate
   └─ Division
      └─ Gang
         └─ Employee
```

Scope rules:

| Rule | Requirement |
|---|---|
| Company scope | Admin can inspect all configured estates unless policy restricts |
| Estate scope | Manager may see all divisions and gangs under assigned estate |
| Division scope | Kerani commonly sees assigned division and gangs |
| Gang scope | Some Kerani users may be limited to specific gang reports |
| HR scope | HR scope may follow estate/division or centralized HR assignment |
| Payroll scope | Payroll scope may span estates by payroll processing responsibility |
| Employee scope | Employee-level rows require explicit role permission and scope match |
| Filter narrowing | Users can narrow scope but cannot expand beyond assigned scope |
| URL tampering | Server rejects filters outside assigned scope even if manually entered |

Examples:

| User | Assigned Scope | Allowed Query | Rejected Query |
|---|---|---|---|
| Kerani A | Estate A, Divisi 2 | Absensi Divisi 2, Gang 2A | Absensi Divisi 3 |
| Kerani B | Estate A, Divisi 2, Gang 2A | Produktivitas Gang 2A | Produktivitas Gang 2B |
| HR Estate | Estate A | Karyawan Estate A | Karyawan Estate B |
| Payroll Central | Payroll period across Estate A and B | Payroll April Estate A/B | Inventory valuation Estate A |
| Manager Estate | Estate A | Productivity all divisions in Estate A | Payroll employee net pay detail |

## 7. Data Visibility Rules

### 7.1 Column-Level Visibility

| Data Field Type | Kerani | HR | Payroll | Manager | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Employee name | Scoped | Full scoped | Scoped | Scoped/Masked | Full |
| Employee ID | Scoped | Full scoped | Full scoped | Scoped | Full |
| Identity number | Hidden | Masked/Full by policy | Hidden | Hidden | Masked/Full by policy |
| Attendance status | Scoped | Full scoped | Summary/scoped | Scoped summary/detail | Full |
| Payroll gross | Hidden | Limited | Full | Summary | Full |
| Payroll net | Hidden | Hidden/Limited | Full | Hidden/Summary | Full |
| Bank account | Hidden | Hidden | Masked/Full by policy | Hidden | Masked/Full by policy |
| Wage rate | Hidden | Limited | Full | Summary | Full |
| Premium/overtime value | Limited input | Summary | Full | Summary | Full |
| Inventory quantity | Scoped | Hidden | Hidden | Scoped | Full |
| Inventory value | Hidden/Limited | Hidden | Hidden | Scoped summary | Full |
| Audit actor | Hidden | Hidden | Hidden | Scoped summary | Full |
| System error detail | Hidden | Hidden | Hidden | Summary | Full |

### 7.2 Row-Level Visibility

| Rule | Description |
|---|---|
| Scope-first filtering | Row filters are applied before pagination, preview sampling, export generation, and totals |
| Aggregate protection | Summary totals must not reveal restricted detail through small group counts |
| Payroll privacy | Payroll detail rows require Payroll or Admin permission unless report is explicitly manager-summary |
| HR privacy | Personal data rows require HR/Admin or approved business-specific report access |
| Preview sampling | Sample rows cannot include data outside user scope |

### 7.3 Export Visibility

| Requirement | Detail |
|---|---|
| Same access as viewer | Export can never include more rows or columns than viewer policy permits |
| Re-check on download | Authorization is checked when export is requested and when downloaded |
| Expiring links | Downloads expire after configured window |
| Watermark metadata | Export includes generated timestamp, user, scope, filters, and report ID where appropriate |
| Sensitive formats | Payroll and employee exports may require stronger logging and shorter expiry |

## 8. Audit Trail Requirements Per Role

Audit events:

| Event | Kerani | HR | Payroll | Manager | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Login/logout | Log | Log | Log | Log | Log |
| Search query | Log | Log | Log | Log | Log |
| Report preview opened | Log | Log | Log | Log | Log |
| Report loaded | Log | Log | Log | Log | Log |
| Export requested | Log | Log | Log | Log | Log |
| Export downloaded | Log | Log | Log | Log | Log |
| Access denied | Log | Log | Log | Log | Log |
| Favorite added/removed | Log optional | Log optional | Log optional | Log optional | Log optional |
| Admin metadata change | N/A | N/A | N/A | N/A | Log |
| Access policy change | N/A | N/A | N/A | N/A | Log |
| Integration health viewed | N/A | N/A | N/A | Scoped log | Log |

Audit visibility:

| Role | Can View Audit? | Scope |
|---|---|---|
| Kerani | No | Not available |
| HR | No by default | Not available unless special compliance permission exists |
| Payroll | No by default | Not available unless payroll audit permission exists |
| Manager | Yes, limited | Own scope, summary-level events, no sensitive query text where restricted |
| Admin | Yes | Full audit trail subject to company policy |

Audit event payload:

| Field | Required | Notes |
|---|:---:|---|
| Timestamp | Yes | Server time |
| Actor user ID | Yes | Stable ID |
| Actor role | Yes | Role at time of action |
| Actor scope | Yes | Estate/division/gang/payroll scope snapshot |
| Event type | Yes | Search, preview, load, export, denial, admin change |
| Target type | Yes | Module, report, export, admin policy |
| Target ID | Yes | Stable ID where applicable |
| Filter summary | Yes | Redacted where sensitive |
| Result status | Yes | Success, denied, failed, queued |
| IP/device metadata | Yes | According to security policy |
| Correlation ID | Yes | For support and incident tracing |

## 9. Admin Governance Requirements

Admin can govern report metadata and access policy inside Report Center, but cannot mutate source operational records.

| Admin Function | Allowed | Not Allowed |
|---|---|---|
| Report metadata | Edit title, owner, description, tags, sensitivity, freshness rules | Edit source transactional data |
| Access policy | Assign role/report visibility and column policy | Grant business approval outside IAM process if prohibited |
| Audit review | Search and export audit logs if policy permits | Delete audit logs |
| Export monitoring | Inspect queue status and failures | Alter exported business values |
| Integration health | View source status and last refresh | Manually change source records |

## 10. Access Enforcement Checklist

```text
Authentication
   │
   ▼
Load user roles and scopes
   │
   ▼
Build permitted module/report catalog
   │
   ├─ Sidebar
   ├─ Search index filter
   ├─ Favorites filter
   └─ Recent filter
   │
   ▼
User opens report
   │
   ▼
Server validates report permission
   │
   ▼
Apply row and column policy
   │
   ▼
Render preview/viewer/export
   │
   ▼
Write audit event
```

Launch checklist:

| Check | Required |
|---|---|
| Every report mapped to module | Yes |
| Every report has sensitivity label | Yes |
| Every report has role policy | Yes |
| Every report has scope policy | Yes |
| Every sensitive column has visibility policy | Yes |
| Search index excludes unauthorized reports | Yes |
| Export service re-checks permission | Yes |
| Direct URL access is server-validated | Yes |
| Audit logs include denied access | Yes |
| Admin changes are immutable in audit | Yes |

