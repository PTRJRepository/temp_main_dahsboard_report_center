---
name: 09-auth-permission-context
description: Authentication and permission analysis
metadata:
  type: documentation
  tags: [auth, security, permissions]
---

# Auth & Permission Context

## Authentication Methods

| Method | Usage | Token Type |
|--------|-------|------------|
| JWT Cookie | User login | RS256 signed |
| API Key | Service-to-service | Static key |
| Bearer Token | API access | RS256 signed |

## JWT Authentication

### Token Structure

```javascript
// Header
{
  "alg": "RS256",
  "typ": "JWT"
}

// Payload
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "admin",
  "exp": 1720000000,
  "iat": 1719990000
}
```

### Key Files

| File | Purpose |
|------|---------|
| `keys/private.pem` | Sign tokens (server only) |
| `keys/public.pem` | Verify tokens (shared) |
| `server_bun.js` | JWT verification logic |

### Token Lifecycle

```
Login → Generate JWT (RS256) → Set Cookie → Use in Requests
                                        ↓
                              Gateway verifies → Allow/Deny
                                        ↓
                              Expiry → Re-authenticate
```

## User Roles (Implied)

| Role | Dashboard | Reports | Admin | iFESS |
|------|----------|---------|-------|-------|
| User | ✅ Read | ✅ Read | ❌ | ❌ |
| Admin | ✅ Full | ✅ Full | ✅ | ✅ |
| Super Admin | ✅ Full | ✅ Full | ✅ | ✅ |

**Note**: Full RBAC matrix not documented. Requires verification.

## API Key Authentication

| Service | Key | Header | Purpose |
|---------|-----|--------|---------|
| iFESS Control | IFESS_API_KEY | X-API-Key | Manage clients |
| Query Gateway | QUERY_API_KEY | X-API-Key | Firebird queries |
| Upah | UPATH_API_KEY | X-API-Key | Payroll API |

### Default Keys (⚠️ Security Risk)

```javascript
IFESS_API_KEY = 'ptrj-rebinmas-air-ruak-parit-gunung-darul'
QUERY_API_KEY = 'ptrj-query-gateway-key'
UPATH_API_KEY = 'ptrj-upath-key'
```

## Protected Routes

### User Authentication Required

| Path Pattern | Description |
|--------------|-------------|
| `/admin/*` | Admin dashboard |
| `/dashboard/*` | User dashboard |
| `/report-center/*` | Report viewer |
| `/modules/*` | Module pages |
| `/api/services/*` | Services API |
| `/api/reports/*` | Report API |

### No Authentication

| Path | Description |
|------|-------------|
| `/` | Landing page |
| `/login` | Login page |
| `/api/ifess/health` | Health check |
| `/api/ifess/server-info` | Server info |
| `/api/auth/public-key` | Public key |

## Frontend Auth Guards

```typescript
// Example auth guard pattern
export function requireAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { user } = useAuth();

    if (!user) {
      router.push('/login');
      return null;
    }

    return <Component {...props} />;
  };
}
```

## Cookie Configuration

```typescript
// Login response cookie
response.cookies.set('auth-token', token, {
  httpOnly: false,      // Allow client access
  secure: false,        // HTTP for localhost
  sameSite: 'lax',     // CSRF protection
  maxAge: 60 * 60 * 8, // 8 hours
  path: '/'
});
```

## Session Management

| Aspect | Implementation |
|--------|----------------|
| Storage | HTTP Cookie |
| Expiry | 8 hours |
| Refresh | Re-login required |
| Logout | Clear cookie |

## Permission Matrix (Assumed)

| Action | User | Admin | Super Admin |
|--------|------|-------|-------------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Reports | ✅ | ✅ | ✅ |
| Export Reports | ❌ | ✅ | ✅ |
| Manage Users | ❌ | ✅ | ✅ |
| System Settings | ❌ | ✅ | ✅ |
| iFESS Control | ❌ | ✅ | ✅ |

**⚠️ Needs verification**: Full permission matrix not documented.

---

**Evidence**: `server_bun.js`, `app/api/auth/login/route.ts`
