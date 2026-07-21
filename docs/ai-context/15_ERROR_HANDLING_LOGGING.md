---
name: 15-error-handling-logging
description: Error handling patterns and logging
metadata:
  type: documentation
  tags: [errors, logging, debugging]
---

# Error Handling & Logging

## Error Handling Patterns

### API Error Responses

```typescript
// Next.js API route error pattern
export async function GET(request: NextRequest) {
  try {
    const result = await operation();
    return NextResponse.json(result);
  } catch (error) {
    console.error('Operation failed:', error);
    return NextResponse.json(
      { error: 'Operation failed', details: error.message },
      { status: 500 }
    );
  }
}
```

### Error Response Format

```typescript
interface ErrorResponse {
  error: string;      // Human-readable message
  code?: string;       // Error code
  details?: any;      // Technical details (dev only)
}
```

### HTTP Status Codes

| Code | Usage | Example |
|------|-------|---------|
| 200 | Success | GET report data |
| 400 | Bad Request | Missing parameters |
| 401 | Unauthorized | Invalid token |
| 403 | Forbidden | No permission |
| 404 | Not Found | Report not found |
| 500 | Server Error | Database failure |

## Error Categories

### Authentication Errors

| Error | Code | Response |
|-------|------|----------|
| Missing credentials | AUTH_001 | `{ error: "Credentials required" }` |
| Invalid credentials | AUTH_002 | `{ error: "Invalid email or password" }` |
| Token expired | AUTH_003 | `{ error: "Token expired" }` |
| Invalid token | AUTH_004 | `{ error: "Invalid token" }` |

### Database Errors

| Error | Code | Response |
|-------|------|----------|
| Connection failed | DB_001 | `{ error: "Database connection failed" }` |
| Query failed | DB_002 | `{ error: "Query execution failed" }` |
| Timeout | DB_003 | `{ error: "Request timeout" }` |

### Business Logic Errors

| Error | Code | Response |
|-------|------|----------|
| Report not found | RPT_001 | `{ error: "Report not found" }` |
| Invalid filters | RPT_002 | `{ error: "Invalid filter parameters" }` |
| Export failed | RPT_003 | `{ error: "Export failed" }` |

## Logging

### Log Levels

| Level | Usage | Example |
|-------|-------|---------|
| ERROR | Failures | DB connection failed |
| WARN | Warnings | Deprecated API used |
| INFO | Events | User logged in |
| DEBUG | Details | Query parameters |

### Log Locations

| Environment | Output | File |
|------------|--------|------|
| Development | stdout | Console |
| Production | Files | `server_bun.out.log`, `server_bun.err.log` |

### Log Format

```typescript
// Bun gateway log format
console.log('🔐 Login attempt:', { email, passwordLength: password?.length });
console.log('❌ Login failed:', email, '- Reason:', result.error);
console.log('🍪 Setting auth-token cookie, token length:', result.token?.length);
```

## Error Recovery

### Firebird Query Recovery

```javascript
// Timeout handling with zombie cleanup
catch (error) {
  if (error.message.includes('ETIMEDOUT')) {
    // Kill zombie isql processes
    childProcess.runSync('taskkill /F /IM isql.exe', { encoding: 'utf8' });
    console.log('Killed zombie isql:', result);
  }
  throw error;
}
```

### Connection Pool Recovery

```typescript
// MSSQL pool error handling
pool.on('error', (err) => {
  console.error('Unexpected MSSQL pool error:', err);
  // Pool auto-reconnects on next request
});
```

## Debugging

### Enable Debug Mode

```bash
# Set debug flag
DEBUG=* npm run dev
```

### Common Issues

| Issue | Symptoms | Solution |
|-------|---------|----------|
| Port 3001 in use | EADDRINUSE | Use PORT=3002 |
| DB connection | Connection timeout | Check MSSQL_HOST |
| JWT invalid | 401 errors | Regenerate keys |
| CORS blocked | Preflight fails | Check origin settings |

---

**Evidence**: `server_bun.js`, `app/api/` routes
