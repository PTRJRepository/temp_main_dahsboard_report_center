# System Architecture

## Architecture Overview

```mermaid
flowchart TB
    subgraph Internet["External Network"]
        Browser[("Browser Client")]
    end

    subgraph Gateway["Bun Gateway (Port 3001)"]
        ReverseProxy["Reverse Proxy<br/>(routes-config.json)"]
        JWTAuth["JWT Authentication"]
        IFESSAPI["iFESS Control API<br/>/api/ifess/*"]
        QueryGateway["Firebird Query Gateway<br/>/api/query-gateway/*"]
        StaticCache["Static Cache<br/>(LRU)"]
    end

    subgraph Dashboard["Next.js App (Port 3100)"]
        AppRouter["Next.js App Router"]
        AuthAPI["Auth API<br/>/api/auth/*"]
        ReportAPI["Report API<br/>/api/reports/*"]
    end

    subgraph Databases["Databases"]
        MSSQL["MSSQL<br/>extend_db_ptrj"]
        Firebird["Firebird<br/>PTRJ_ARC.FDB"]
        JSONFiles["JSON Files<br/>/data/ifess/"]
    end

    subgraph Upstream["Upstream Services"]
        Payroll["Payroll<br/>Port 8002"]
        Attendance["Attendance<br/>Port 5176"]
        Rice["Rice Monitor<br/>Port 5177"]
        GDrive["Google Drive<br/>Port 5178"]
    end

    Browser -->|"HTTPS"| ReverseProxy
    ReverseProxy --> JWTAuth
    JWTAuth -->|Pass| StaticCache
    JWTAuth -->|Pass| IFESSAPI
    JWTAuth -->|Pass| QueryGateway
    JWTAuth -->|Proxy| Dashboard
    Dashboard --> AuthAPI
    Dashboard --> ReportAPI
    AuthAPI --> MSSQL
    ReportAPI --> MSSQL
    QueryGateway --> Firebird
    IFESSAPI --> JSONFiles
    ReverseProxy -->|Rewrite| Payroll
    ReverseProxy -->|Rewrite| Attendance
    ReverseProxy -->|Rewrite| Rice
    ReverseProxy -->|Rewrite| GDrive
```

## Component Responsibilities

### Bun Gateway (`server_bun.js`)
| Component | Responsibility |
|-----------|----------------|
| Reverse Proxy | Routes requests to upstream services based on `routes-config.json` |
| JWT Auth | Verifies RS256 tokens, extracts user identity |
| iFESS Control API | Manages desktop client registration, heartbeats, commands |
| Query Gateway | Executes Firebird SQL, parses isql output |
| Static Cache | LRU cache for static assets (30min TTL) |

### Next.js Dashboard
| Component | Responsibility |
|-----------|----------------|
| App Router | Page routing with route groups |
| Auth API | Login, logout, token verification |
| Report API | MSSQL queries, report generation |
| Report Viewer | Generic renderer with filtering/export |

## Deployment Architecture

```mermaid
flowchart LR
    subgraph Development["Development"]
        DevBrowser["Browser"]
        DevBun["Bun Gateway<br/>localhost:3001"]
        DevNext["Next.js Dev<br/>localhost:3100"]
    end

    subgraph Docker["Docker Production"]
        Nginx["nginx<br/>Port 8080"]
        DockerNext["Next.js Standalone<br/>Internal:3001"]
    end

    DevBrowser -->|HTTP| DevBun
    DevBun -->|Proxy| DevNext

    Browser -->|HTTP| Nginx
    Nginx -->|Proxy| DockerNext
```

## iFESS Control Flow

```mermaid
sequenceDiagram
    participant Desktop as iFESS Desktop Client
    participant Gateway as Bun Gateway
    participant IFESS as iFESS Control Service
    participant Storage as JSON Files

    Desktop->>Gateway: GET /api/ifess/server-info
    Gateway->>Desktop: Server URL & Config

    Desktop->>Gateway: POST /api/ifess/clients/register
    Gateway->>IFESS: Register Client
    IFESS->>Storage: Save to clients.json
    Storage-->>IFESS: Confirm
    IFESS-->>Gateway: Client Registered
    Gateway-->>Desktop: Registration Success

    loop Every 30 seconds
        Desktop->>Gateway: POST /api/ifess/clients/:id/heartbeat
        Gateway->>IFESS: Update heartbeat
        IFESS->>Storage: Update clients.json
    end
```

## Communication Patterns

| Pattern | Protocol | Usage |
|---------|----------|-------|
| Browser → Gateway | HTTP | All client requests |
| Gateway → Next.js | HTTP | Dashboard proxy |
| Gateway → Upstreams | HTTP | Service proxies |
| Gateway → Firebird | CLI (isql) | SQL queries |
| Gateway → Storage | File I/O | JSON read/write |

## Security Boundaries

```mermaid
flowchart TB
    subgraph Public["Public"]
        Landing["/ Landing Page"]
    end

    subgraph AuthRequired["Authentication Required"]
        Login["/login"]
        Dashboard["/dashboard/*"]
        Reports["/report-center/*"]
    end

    subgraph APIPublic["Public APIs"]
        Health["/api/ifess/health"]
        ServerInfo["/api/ifess/server-info"]
    end

    subgraph APIProtected["Protected APIs"]
        IFESS["/api/ifess/*"]
        Reports["/api/reports/*"]
    end

    Landing -->|Public| AuthRequired
    Login -->|Auth| Dashboard
    Dashboard -->|Auth| Reports
    Health -->|No Auth| APIPublic
    ServerInfo -->|No Auth| APIPublic
    IFESS -->|API Key| APIProtected
```

## External Integrations

| Service | Protocol | Auth | Purpose |
|---------|----------|------|---------|
| Payroll System | HTTP | Proxy | Wage management |
| Attendance System | HTTP | Proxy | Employee attendance |
| Google Drive | HTTP | Proxy | Document storage |
| Firebird DB | CLI | None | Scanner/production data |

---

**Evidence**: `server_bun.js:1-195`, `routes-config.json`, `CLAUDE.md`
