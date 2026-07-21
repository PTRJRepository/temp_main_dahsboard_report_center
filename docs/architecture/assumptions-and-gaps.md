# Assumptions and Gaps

## Missing Information

### Authentication Details

| Gap | Evidence | Recommendation |
|-----|---------|----------------|
| User roles and permissions matrix not documented | Only `auth-service.ts` analyzed | Document RBAC roles |
| Password hashing algorithm details unclear | `bcryptjs` imported but salt rounds unknown | Review `auth-service.ts` full implementation |
| Token refresh mechanism not found | Only login endpoint analyzed | Check for refresh token endpoint |

**Status**: Needs verification from `lib/utils/auth-service.ts`

### Database Schema

| Gap | Evidence | Recommendation |
|-----|---------|----------------|
| Complete MSSQL table list not documented | Only report-related tables inferred | Generate full schema from database |
| Foreign key relationships not fully mapped | Partial relationships in CLAUDE.md | Document with ER diagram |
| Index strategies unknown | No index documentation | Review query performance |

**Status**: Partial - CLAUDE.md provides limited schema info

### Report System

| Gap | Evidence | Recommendation |
|-----|---------|----------------|
| All report codes not enumerated | Only inventory reports confirmed | Document all report types |
| Report parameters not fully specified | Filter schema implied | Complete API reference |
| Export formats not documented | XLSX mentioned in deps | Document export capabilities |

**Status**: Partial - `lib/reports/config.ts` provides module list

## Ambiguous Behavior

### Scanner Table Partitions

**Ambiguity**: `#MONTH#` placeholder behavior unclear

> The CLAUDE.md states: "The `#MONTH#` placeholder selects the *partition slot*, NOT a calendar month."

**Questions**:
- What determines which slot = which month?
- How to query historical data (different years)?
- Is slot 01 always January?

**Recommendation**: Verify partition mapping logic

### iFESS Client Offline Handling

**Ambiguity**: Heartbeat timeout threshold not documented

> `Services/ifess-control-server/` suggests heartbeat-based status

**Questions**:
- After how many missed heartbeats is client marked offline?
- Are pending commands preserved for offline clients?

**Recommendation**: Check `services.js` for offline detection logic

### API Key Authentication Scope

**Ambiguity**: Overlapping API keys

| Key | Header | Used For |
|-----|--------|---------|
| IFESS_API_KEY | X-API-Key | iFESS Control API |
| QUERY_API_KEY | X-API-Key | Query Gateway |
| UPATH_API_KEY | X-API-Key | Payroll API |

**Questions**:
- Are these used interchangeably?
- What happens if wrong key is provided?

**Recommendation**: Clarify key validation per endpoint

## Potentially Unused Code

### Legacy Express Server

| File | Status | Evidence |
|------|--------|----------|
| `server.js` | Legacy | `server_bun.js` is primary gateway |
| `server_bun.out.log` | Debug file | Log output |

**Recommendation**: Deprecate and remove `server.js` if not used

### Unused NPM Dependencies

From `package.json` analysis:

| Package | Status | Notes |
|---------|--------|-------|
| `autocannon` | Dev only | Load testing tool - OK |
| `next-auth` | Imported but not fully used | Check `app/api/auth/[...nextauth]/route.ts` |

**Recommendation**: Audit `next-auth` usage - may be dead code

### Static Asset Directories

From `routes-config.json`:

```json
"staticRoots": [
  {
    "prefix": "/upah/assets",
    "dir": "D:/Gawean Rebinmas/PORTAL_ESTATE/...",
    "immutable": true
  }
]
```

**Concern**: References external path outside repository

**Recommendation**: Verify path exists and is intentional

## Unknown/Missing Components

### Component | Status | Evidence

| Component | Status | Evidence |
|-----------|--------|----------|
| Prisma ORM | Imported but not used | `Dashboard_Utama/package.json` has `@prisma/client` |
| Landing Page | Implemented | `app/(landing-page)/page.tsx` exists |
| Admin Dashboard | Implemented | `app/(login)/admin/page.tsx` exists |
| Executive Dashboard | Implemented | `app/(login)/admin/executive/page.tsx` exists |

**Recommendation**: Verify Prisma usage - may be planned but not implemented

### External Service Dependencies

| Service | Status | Verification |
|---------|---------|---------------|
| Payroll (port 5175/8002) | Unknown | Not analyzed |
| Attendance (port 5176) | Unknown | Not analyzed |
| Rice Monitoring (port 5177) | Unknown | Not analyzed |
| Google Drive (port 5178) | Unknown | Not analyzed |

**Recommendation**: Document each service's API contract

## Risks

### Security Risks

| Risk | Level | Evidence | Mitigation |
|------|-------|----------|------------|
| Default API keys in source | HIGH | `server_bun.js` has hardcoded defaults | Move to environment variables |
| Hardcoded DB credentials | HIGH | `.env.production` contains real credentials | Use secrets management |
| No rate limiting on APIs | MEDIUM | Not found in code | Add rate limiting middleware |
| XSS potential in report viewer | MEDIUM | User input in SQL queries | Validate and sanitize inputs |

### Operational Risks

| Risk | Level | Evidence | Mitigation |
|------|-------|----------|------------|
| Firebird isql timeout | HIGH | `ETIMEDOUT` mentioned in CLAUDE.md | Already has zombie reaper |
| Port conflicts | MEDIUM | Multiple services on various ports | Document port assignments |
| No CI/CD pipeline | MEDIUM | No GitHub Actions found | Implement automated deployment |
| No backup strategy documented | MEDIUM | Backup commands not provided | Document backup procedures |

### Technical Debt

| Issue | Impact | Evidence | Recommendation |
|-------|--------|----------|----------------|
| Dual gateway (Express + Bun) | Maintenance | Both `server.js` and `server_bun.js` exist | Consolidate to Bun |
| Mixed authentication methods | Complexity | Cookie + API key + Bearer | Standardize auth |
| External path dependencies | Fragility | Payroll static files outside repo | Bundle or document |

## Recommendations

### High Priority

1. **Document RBAC/permissions model** - Who can access what?
2. **Remove hardcoded secrets** - API keys should not be in source
3. **Implement backup strategy** - Document and automate
4. **Create API contract for upstreams** - Document each service

### Medium Priority

5. **Audit unused dependencies** - Remove `next-auth` if not used
6. **Standardize authentication** - One auth method across system
7. **Document Firebird partition logic** - Clarify `#MONTH#` behavior
8. **Implement rate limiting** - Protect against abuse

### Low Priority

9. **Deprecate Express server** - Remove `server.js` if not needed
10. **Add health check for upstreams** - Monitor all services
11. **Document report export formats** - XLSX, PDF capabilities
12. **Create runbook** - Step-by-step operational procedures

---

**Evidence**: Codebase analysis, `CLAUDE.md`, `routes-config.json`
**Status**: Partial - Not all components fully analyzed
**Generated**: 2026-07-18
