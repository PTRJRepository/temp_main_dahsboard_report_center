# Operations Guide

## Environment Variables

### Core Server Configuration

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `NODE_ENV` | development | No | Environment mode |
| `PORT` | 3001 | No | Server port |
| `HOST` | 0.0.0.0 | No | Server bind address |
| `DASHBOARD_PORT` | 3100 | No | Next.js dev port |
| `START_DASHBOARD` | true | No | Auto-start Next.js |

### JWT Configuration

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `JWT_PRIVATE_KEY_PATH` | ./keys/private.pem | Yes | RS256 private key |
| `JWT_PUBLIC_KEY_PATH` | ./keys/public.pem | Yes | RS256 public key |

### MSSQL Database

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `MSSQL_HOST` | 10.0.0.110 | Yes | Database server |
| `MSSQL_PORT` | 1433 | No | Database port |
| `MSSQL_DATABASE` | extend_db_ptrj | Yes | Database name |
| `MSSQL_USER` | sa | Yes | Database user |
| `MSSQL_PASSWORD` | ptrj@123 | Yes | Database password |

### API Keys (Security Sensitive)

| Variable | Default | Purpose |
|----------|---------|---------|
| `IFESS_API_KEY` | ptrj-rebinmas-air-ruak-parit-gunung-darul | iFESS Control API |
| `QUERY_API_KEY` | ptrj-query-gateway-key | Query Gateway API |
| `UPATH_API_KEY` | ptrj-upath-key | Upah Payroll API |
| `IFESS_CLIENT_API_KEY` | ptrj-ifess-client-key | iFESS Client API |

### Upstream Services

| Variable | Default | Purpose |
|----------|---------|---------|
| `BACKEND_HOST` | localhost | Primary backend host |
| `BACKEND_HOST_FALLBACK` | localhost | Fallback backend host |
| `UPAH_PORT` | 5175 | Payroll service port |
| `ABSEN_PORT` | 5176 | Attendance service port |
| `MONITORING_BERAS_PORT` | 5177 | Rice monitoring port |
| `GDRIVE_PORT` | 5178 | Google Drive service port |

### Cookie Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `COOKIE_SECURE` | false | HTTPS-only cookies |
| `NEXTAUTH_URL` | http://localhost:3001 | Auth callback URL |

## Build and Run Commands

### Development Mode

```bash
# Full stack - Gateway + Next.js (recommended)
npm run dev

# Gateway only (fastest for iFESS work)
PORT=3002 START_DASHBOARD=false bun run server_bun.js

# Next.js only
cd Dashboard_Utama && npm run dev

# Express legacy gateway
npm run dev:express
```

### Production Mode

```bash
# Bun gateway (recommended)
npm run start

# Docker deployment
cd Dashboard_Utama
docker-compose up --build

# Access at http://localhost:8080 (nginx on 8080 → Next.js on 3001)
```

### Testing

```bash
# Run report tests
cd Dashboard_Utama
npx tsx lib/reports/accounting-period.test.ts
npx tsx lib/reports/movement-category.test.ts
npx tsx lib/reports/report-filtering.test.ts

# Gateway smoke test
npm run smoke:gateway

# iFESS client test
node scripts/test-ifess.js
```

## Docker Deployment

### docker-compose.yml Structure

```yaml
services:
  dashboard:
    build: .
    ports:
      - "8080:3001"
    environment:
      - NODE_ENV=production
    depends_on:
      - mssql
    networks:
      - internal

  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - dashboard
```

### Dockerfile Stages

```dockerfile
# Stage 1: Builder
FROM node:20-alpine
RUN npm install && npm run build

# Stage 2: Production
FROM node:20-alpine
COPY --from=builder /app/.next /app/.next
COPY --from=builder /app/public /app/public
EXPOSE 3001
CMD ["node", "server.js"]
```

## Logging and Monitoring

### Log Locations

| Environment | Location | Content |
|-------------|----------|---------|
| Development | stdout/stderr | Console output |
| Production | `server_bun.out.log` | stdout |
| Production | `server_bun.err.log` | stderr |

### Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/ifess/health` | iFESS health |
| `GET /api/reports/system-status` | Full system status |

### Monitoring Metrics

```json
{
  "status": "healthy",
  "services": {
    "mssql": "connected",
    "firebird": "connected"
  },
  "uptime": 86400,
  "memory": { "used": 128, "total": 512 },
  "requests": { "total": 1500, "failed": 2 }
}
```

## Common Troubleshooting Steps

### Port Already in Use

```bash
# Check what's using port 3001
netstat -ano | findstr :3001

# Use alternative port
PORT=3002 bun run server_bun.js
```

### MSSQL Connection Failed

1. Verify `MSSQL_HOST` is reachable
2. Check database credentials
3. Ensure SQL Server allows TCP/IP connections
4. Verify firewall rules

### Firebird Query Timeout

1. Check if `isql.exe` is accessible
2. Verify `PTRJ_ARC.FDB` path is correct
3. Check for zombie `isql.exe` processes:
   ```bash
   tasklist | findstr isql
   taskkill /F /IM isql.exe
   ```

### JWT Token Invalid

1. Verify JWT keys exist in `keys/` directory
2. Check key file permissions
3. Ensure public key matches private key pair

### Next.js Dev Server Not Starting

```bash
# Clear .next cache
cd Dashboard_Utama
rm -rf .next

# Set explicit dashboard port
DASHBOARD_PORT=3100 npm run dev
```

### iFESS Clients Not Connecting

1. Verify `IFESS_API_KEY` matches on client
2. Check firewall allows port 3001
3. Verify client `serverUrl` points to correct gateway

### Report Data Missing or Incorrect

1. Verify data source (`pabrik` vs `estate`)
2. Check scanner table date filters
3. Verify `#MONTH#` and `#YEAR#` placeholders are set
4. Check for multi-year data contamination

## Maintenance

### Database Backups

```bash
# MSSQL backup (via SQL Server Management Studio or scripts)
BACKUP DATABASE extend_db_ptrj TO DISK = 'backup.bak'

# Firebird backup
gbak -b localhost:PTRJ_ARC.FDB backup.fbk -user SYSDBA -password masterkey
```

### Cache Clearing

```bash
# Clear LRU cache (restart gateway)
# Gateway cache auto-clears on restart

# Clear Next.js cache
cd Dashboard_Utama && rm -rf .next

# Clear iFESS data cache (restart gateway)
# JSON files in data/ifess/ are reloaded on gateway start
```

### Log Rotation

Configure in `server_bun.js` or via external log rotation:

```bash
# Linux logrotate
/etc/logrotate.d/rebinmas-dashboard
```

---

**Evidence**: `package.json`, `.env.production`, `docker-compose.yml`, `CLAUDE.md`
