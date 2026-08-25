# Auth Utilities - User Guide

## Overview

Folder `backend/src/utils/auth/` menyediakan utility untuk authentication dan authorization di PORTAL_ESTATE. Sistem ini dirancang untuk mendukung user management yang komprehensif dengan role-based access control (RBAC).

## Folder Structure

```
backend/src/utils/auth/
├── index.ts              # Main exports
├── auth-types.ts         # TypeScript type definitions
├── permission-service.ts  # Permission checking logic
└── user-service.ts       # User CRUD operations
```

## Quick Start

### Import Types

```typescript
import {
    User,
    UserRole,
    UserCreate,
    UserUpdate,
    JWTPayload,
    LoginRequest,
    LoginResponse
} from '../utils/auth/auth-types';
```

### Use Permission Service

```typescript
import { permissionService } from '../utils/auth';

// Check if user is admin
if (permissionService.isAdmin(user)) {
    // Admin-only logic
}

// Check division access
if (permissionService.hasDivisionAccess(user, 'ARA')) {
    // User can access ARA division
}

// Filter accessible divisions
const accessibleDivisions = permissionService.filterAccessibleDivisions(user, ['ARA', 'ARC', 'NRS']);
```

### Use User Service

```typescript
import { userService } from '../utils/auth';

// Get all users
const users = await userService.getAllUsers();

// Create new user
const newUser = await userService.createUser({
    username: 'john_doe',
    email: 'john@example.com',
    password: 'secret123',
    full_name: 'John Doe',
    role: UserRole.USER,
    divisions: ['ARA', 'ARC']
});

// Update user
await userService.updateUser(userId, {
    role: UserRole.KERANI,
    divisions: ['NRS']
});

// Change password
await userService.changePassword(userId, 'newPassword123');

// Delete user
await userService.deleteUser(userId);
```

## API Endpoints

### Admin Auth Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/auth/users` | Get all users |
| GET | `/admin/auth/users/:id` | Get user by ID |
| POST | `/admin/auth/users` | Create new user |
| PUT | `/admin/auth/users/:id` | Update user |
| DELETE | `/admin/auth/users/:id` | Delete user |
| POST | `/admin/auth/users/:id/password` | Change user password |
| POST | `/admin/auth/users/:id/activate` | Activate user |
| POST | `/admin/auth/users/:id/deactivate` | Deactivate user |
| GET | `/admin/auth/users/search?q=` | Search users |
| GET | `/admin/auth/users/role/:role` | Get users by role |
| GET | `/admin/auth/divisions` | Get all divisions |
| GET | `/admin/auth/roles` | Get all roles |

### Example API Usage

```bash
# Login first to get token
curl -X POST http://localhost:8002/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'

# Get all users (requires admin token)
curl http://localhost:8002/admin/auth/users \
  -H "Authorization: Bearer <your_token>"

# Create new user
curl -X POST http://localhost:8002/admin/auth/users \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "new_user",
    "email": "new@example.com",
    "password": "password123",
    "full_name": "New User",
    "role": "user",
    "divisions": ["ARA", "ARC"]
  }'
```

## User Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `admin` | Administrator | Full access to all divisions and features |
| `user` | Regular User | Division-restricted access |
| `kerani` | Kerani | Division-specific data access (field supervisor) |
| `visitor` | Visitor | Read-only access |

## Division Codes

### Production Divisions
- `ARA` - Afdeling ARA
- `ARC` - Afdeling ARC
- `ARB1` - Afdeling ARB1
- `ARB2` - Afdeling ARB2
- `NRS` - Afdeling NRS
- `PG2A` - Afdeling PG2A
- `P1A`, `P1B`, `P2A`, `P2B` - Afdeling P

### Support Divisions
- `KBN` - Kebun (Umum)
- `IJL` - Inti Jawa Lestari
- `STF-OFFICE` - Staff Office
- `SECURITY` - Keamanan

### Virtual Divisions
- `INF` - Infrastruktur
- `WKS_AR` - Workshop ARC Group
- `WKS_PG` - Workshop PG Group
- `WORKSHOP` - Workshop Umum
- `MILL` - Pabrik

## Migration from Main Dashboard

Jika Anda ingin mengintegrasikan sistem auth ini dengan Main Dashboard:

### Option 1: Shared JWT Validation

Main Dashboard bisa memvalidasi token PORTAL_ESTATE dengan public key:

```typescript
// Main Dashboard middleware
import { verifyToken } from '@/utils/jwt-edge'

// Validate PORTAL_ESTATE token
const payload = await verifyToken(token, {
    publicKey: PORTAL_ESTATE_PUBLIC_KEY
})
```

### Option 2: Cross-System Token Exchange

```
1. User login ke Main Dashboard
2. Main Dashboard call PORTAL_ESTATE /auth/login
3. PORTAL_ESTATE returns token
4. Token digunakan untuk kedua sistem
```

## Database Schema

### Users Table (SQLite)

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    divisions TEXT NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Logs Table

```sql
CREATE TABLE audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);
```

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-secret-key

# API Key Bypass (for testing/development)
API_KEY_BYPASS=your-api-key

# Dev Bypass Token
DEV_BYPASS_TOKEN=dev-token
```

## Best Practices

1. **Always use HTTPS** in production
2. **Rotate JWT secrets** periodically
3. **Set appropriate token expiry** (default: 8 hours)
4. **Use strong passwords** (min 8 characters)
5. **Enable audit logging** for security tracking
6. **Regular user access reviews** to remove unused accounts
