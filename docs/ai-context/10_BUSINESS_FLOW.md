---
name: 10-business-flow
description: Business process flows
metadata:
  type: documentation
  tags: [business-flow, processes]
---

# Business Flow

## Login Flow

```
┌─────────────────────────────────────────────────────────────┐
│                         LOGIN                                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ User enters   │
                    │ email/password│
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ POST /api/    │
                    │   auth/login  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ MSSQL verify  │
                    │ credentials    │
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    │               │
               Success          Failure
                    │               │
                    ▼               ▼
            ┌─────────────┐   ┌─────────────┐
            │ Generate JWT│   │ Return 401  │
            │ (RS256)    │   │ Error       │
            └──────┬─────┘   └─────────────┘
                   │
                   ▼
           ┌─────────────┐
           │ Set cookie  │
           │ auth-token  │
           └──────┬─────┘
                  │
                  ▼
          ┌─────────────┐
          │ Redirect to │
          │ dashboard   │
          └─────────────┘
```

## Report Viewing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    REPORT VIEWING                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ User selects  │
                    │ report from   │
                    │ module list   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ GET /api/     │
                    │ reports/      │
                    │ [reportCode]  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ JWT verify    │
                    │ (middleware)  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Build SQL     │
                    │ with filters  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Execute MSSQL │
                    │ query         │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Return data   │
                    │ to client     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Render table  │
                    │ with pagination│
                    └───────────────┘
```

## iFESS Client Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 I F E S S   R E G I S T R A T I O N        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Desktop app   │
                    │ starts        │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ GET /api/     │
                    │ ifess/       │
                    │ server-info  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Parse config  │
                    │ (serverUrl)   │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ POST /api/   │
                    │ ifess/clients│
                    │ /register    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Save to       │
                    │ clients.json  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Start         │
                    │ heartbeat     │
                    │ loop (30s)    │
                    └───────────────┘
```

## Firebird Query Flow

```
┌─────────────────────────────────────────────────────────────┐
│              F I R E B I E R   Q U E R Y                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Client sends  │
                    │ SQL query     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Validate API  │
                    │ key           │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Wait for      │
                    │ isql lock     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Write SQL to  │
                    │ temp file     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Execute       │
                    │ isql.exe      │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Parse output  │
                    │ format        │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Delete temp   │
                    │ file          │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Return JSON   │
                    │ to client     │
                    └───────────────┘
```

## Data Sync Flow (iFESS)

```
┌─────────────────────────────────────────────────────────────┐
│                   D A T A   S Y N C                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Client checks │
                    │ for commands  │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ GET /api/    │
                    │ ifess/       │
                    │ commands      │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ If SYNC_DATA  │
                    │ command found │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Collect local │
                    │ data          │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ POST data to  │
                    │ server        │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Update        │
                    │ query-results │
                    └───────────────┘
```

---

**Evidence**: `server_bun.js`, `app/api/auth/login/route.ts`, `CLAUDE.md`
