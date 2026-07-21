# Architecture Diagrams

This file contains comprehensive Mermaid diagrams for the PT Rebinmas Jaya Dashboard system.

## System Context Diagram

```mermaid
flowchart TB
    subgraph External["External Systems"]
        Browser[("Browser Users")]
        IFESSDesktop[("iFESS Desktop<br/>Clients")]
    end

    subgraph Gateway["Bun Gateway"]
        Proxy["Reverse Proxy"]
        JWTAuth["JWT Auth"]
    end

    subgraph Dashboard["Dashboard App"]
        NextJS["Next.js 16"]
        API["API Routes"]
    end

    subgraph Data["Data Layer"]
        MSSQLDB[("MSSQL<br/>extend_db_ptrj")]
        FirebirdDB[("Firebird<br/>PTRJ_ARC.FDB")]
        JSONData["JSON Files<br/>/data/ifess"]
    end

    subgraph Services["Upstream Services"]
        Payroll["Payroll<br/>:5175"]
        Attendance["Attendance<br/>:5176"]
        GDrive["Google Drive<br/>:5178"]
    end

    Browser -->|HTTP| Proxy
    IFESSDesktop -->|HTTP| Proxy
    Proxy --> JWTAuth
    Proxy --> NextJS
    NextJS --> API
    API --> MSSQLDB
    Proxy --> FirebirdDB
    Proxy --> JSONData
    Proxy --> Payroll
    Proxy --> Attendance
    Proxy --> GDrive
```

## Container Architecture

```mermaid
flowchart TB
    subgraph Client["Client Layer"]
        Browser["Browser"]
        IFESSClient["iFESS Client App"]
    end

    subgraph Gateway["Gateway Layer - server_bun.js"]
        HTTP["Bun HTTP Server"]
        Proxy["Route Matcher"]
        JWTAuth["JWT Validator"]
        StaticCache["LRU Cache"]
    end

    subgraph AppLayer["Application Layer - Next.js"]
        LandingPage["Landing Page<br/>/"]
        LoginPage["Login<br/>/login"]
        Dashboard["Dashboard<br/>/dashboard"]
        ReportCenter["Report Center<br/>/report-center"]
        IFESSControl["iFESS Control<br/>/ifess-control"]
    end

    subgraph APILayer["API Layer"]
        AuthAPI["Auth API<br/>/api/auth/*"]
        ReportAPI["Report API<br/>/api/reports/*"]
        IFESSAPI["iFESS API<br/>/api/ifess/*"]
        QueryAPI["Query API<br/>/api/query-gateway/*"]
    end

    subgraph ServiceLayer["Service Layer"]
        MSSQLService["MSSQL Connection Pool"]
        FirebirdService["Firebird Query Service"]
        IFESSService["iFESS Control Service"]
    end

    Browser -->|HTTPS| HTTP
    IFESSClient -->|HTTPS| HTTP
    HTTP --> Proxy
    Proxy --> JWTAuth
    JWTAuth --> StaticCache
    StaticCache --> LandingPage
    JWTAuth --> LoginPage
    JWTAuth --> Dashboard
    JWTAuth --> ReportCenter
    JWTAuth --> IFESSControl
    Dashboard --> AuthAPI
    ReportCenter --> ReportAPI
    IFESSControl --> IFESSAPI
    QueryAPI --> FirebirdService
    AuthAPI --> MSSQLService
    ReportAPI --> MSSQLService
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant User as User
    participant Browser as Browser
    participant Gateway as Bun Gateway
    participant NextJS as Next.js
    participant MSSQL as MSSQL DB

    User->>Browser: Enter credentials
    Browser->>Gateway: POST /api/auth/login
    Gateway->>NextJS: Proxy to /api/auth/login
    NextJS->>MSSQL: Verify credentials
    MSSQL-->>NextJS: User data
    NextJS->>NextJS: Generate JWT (RS256)
    NextJS-->>Gateway: {token, user}
    Gateway-->>Browser: Set auth-token cookie
    Browser-->>User: Login success

    Note over User,Browser: Subsequent requests

    User->>Browser: Access /dashboard
    Browser->>Gateway: GET /dashboard
    Gateway->>Gateway: Extract token from cookie
    Gateway->>Gateway: Verify JWT signature
    Gateway->>Gateway: Check token expiration
    Gateway->>NextJS: Proxy request
    NextJS->>NextJS: Verify user session
    NextJS-->>Gateway: Protected page
    Gateway-->>Browser: Dashboard HTML
    Browser-->>User: Display dashboard
```

## iFESS Client Lifecycle

```mermaid
flowchart TD
    A[Start] --> B[Client Startup]
    B --> C[Get server-info]
    C --> D{Server reachable?}
    D -->|No| E[Retry 3x]
    E -->|Fail| F[Show error]
    D -->|Yes| G[Parse server config]
    G --> H[Register client]
    H --> I{Already registered?}
    I -->|Yes| J[Skip registration]
    I -->|No| K[POST /clients/register]
    K --> L[Save client ID]
    J --> M[Start heartbeat loop]
    M --> N[Wait 30 seconds]
    N --> O[POST /clients/:id/heartbeat]
    O --> P{Success?}
    P -->|No| Q[Mark offline]
    Q --> M
    P -->|Yes| R[Update lastHeartbeat]
    R --> N
    F --> B
```

## Report Request Flow

```mermaid
sequenceDiagram
    participant User as User
    participant Browser as Browser
    participant NextJS as Next.js App
    participant ReportAPI as Report API
    participant MSSQL as MSSQL DB

    User->>Browser: Navigate to /report-center
    Browser->>NextJS: GET /report-center
    NextJS-->>Browser: Page HTML

    User->>Browser: Select "Stock Detail" report
    Browser->>Browser: Load report viewer

    Browser->>ReportAPI: GET /api/reports/stock-detail
    ReportAPI->>ReportAPI: Build SQL query
    ReportAPI->>ReportAPI: Apply filters
    ReportAPI->>MSSQL: Execute query
    MSSQL-->>ReportAPI: 500 rows
    ReportAPI-->>Browser: {data: [...], meta: {...}}

    Browser->>Browser: Render table
    User->>Browser: Apply search filter
    Browser->>ReportAPI: GET /api/reports/stock-detail?search=ABC
    ReportAPI-->>Browser: Filtered results
```

## Query Gateway Flow

```mermaid
sequenceDiagram
    participant Client as Client App
    participant Gateway as Bun Gateway
    participant QuerySvc as Query Service
    participant Firebird as Firebird DB
    participant FS as File System

    Client->>Gateway: POST /api/query-gateway/exec-sync
    Gateway->>Gateway: Validate API key
    Gateway->>QuerySvc: Execute query

    QuerySvc->>QuerySvc: Generate unique filename
    QuerySvc->>QuerySvc: Write SQL to temp file
    QuerySvc->>QuerySvc: Wait for isql lock

    QuerySvc->>Firebird: isql.exe -i query.sql
    Firebird-->>QuerySvc: Raw output stream
    QuerySvc->>QuerySvc: Parse isql output
    QuerySvc->>QuerySvc: Release isql lock
    QuerySvc->>FS: Delete temp SQL file

    QuerySvc-->>Gateway: {headers, rows, rowCount}
    Gateway-->>Client: JSON response

    Note over QuerySvc,Firebird: Timeout handling
    Note over QuerySvc,Firebird: Zombie isql cleanup
```

## Deployment Architecture

```mermaid
flowchart LR
    subgraph Development["Development"]
        DevClient["Browser"]
        DevBun["Bun Gateway<br/>localhost:3001"]
        DevNext["Next.js Dev<br/>localhost:3100"]
        DevFirebird["Firebird DB<br/>PTRJ_ARC.FDB"]
        DevMSSQL["MSSQL<br/>10.0.0.110"]
    end

    subgraph Production["Production (Docker)"]
        ProdClient["Browser"]
        Nginx["nginx:alpine<br/>:8080"]
        DockerNext["Next.js Standalone<br/>:3001"]
        DockerMSSQL["MSSQL<br/>External"]
        DockerFirebird["Firebird<br/>Local"]
    end

    DevClient -->|HTTP| DevBun
    DevBun -->|Proxy| DevNext
    DevBun -->|CLI| DevFirebird
    DevBun -->|TCP| DevMSSQL

    ProdClient -->|HTTP| Nginx
    Nginx -->|Proxy| DockerNext
    DockerNext -->|TCP| DockerMSSQL
    DockerNext -->|CLI| DockerFirebird
```

## Data Model Relationships

```mermaid
erDiagram
    OC ||--o{ OCFIELD : "has"
    OC ||--o{ EMP : "employs"
    OCFIELD ||--o{ FFB : "produces"
    EMP ||--o{ GWSCANNERDATA : "scans_at"
    EMP ||--o{ FFB : "harvests"
    EMP ||--o{ OVERTIME : "works"

    OC {
        int ID PK
        varchar NAME
        varchar CODE
    }
    OCFIELD {
        int ID PK
        int OCID FK
        varchar NAME
    }
    EMP {
        int ID PK
        int OCID FK
        varchar NAME
        varchar EMAIL
    }
    GWSCANNERDATA {
        int ID PK
        date TRANSDATE
        int WORKEREMPID FK
        time SCANTIME
    }
    FFB {
        int ID PK
        int FIELDID FK
        int SCANUSERID FK
        date TRANSDATE
        decimal HARVESTKG
    }
    OVERTIME {
        int ID PK
        int EMPID FK
        int JOBID FK
        int VEHID FK
        date INPDATE
        decimal ESTCOST
    }
```

## Security Boundaries

```mermaid
flowchart TB
    subgraph Public["Public Access"]
        Landing["/ Landing"]
        Health["/api/ifess/health"]
        ServerInfo["/api/ifess/server-info"]
        Login["/login"]
    end

    subgraph UserAuth["User Authentication Required"]
        Dashboard["/dashboard/*"]
        Reports["/report-center/*"]
        Profile["/admin/profile"]
    end

    subgraph AdminAuth["Admin Only"]
        SystemSettings["/admin/settings"]
        UserManagement["/admin/users"]
    end

    subgraph ServiceAuth["API Key Required"]
        IFESSAPI["/api/ifess/*"]
        QueryAPI["/api/query-gateway/*"]
        UpahAPI["/backend/upah"]
    end

    Landing -->|No auth| Public
    Health -->|No auth| Public
    ServerInfo -->|No auth| Public
    Login -->|No auth| Public

    Dashboard -->|JWT Cookie| UserAuth
    Reports -->|JWT Cookie| UserAuth

    SystemSettings -->|JWT + Admin Role| AdminAuth
    UserManagement -->|JWT + Admin Role| AdminAuth

    IFESSAPI -->|X-API-Key| ServiceAuth
    QueryAPI -->|X-API-Key| ServiceAuth
```

---

**Generated**: 2026-07-18
**Diagrams**: 9 total
