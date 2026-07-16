# Credential Rotation Plan

**Date:** 2026-07-16
**Status:** Documented — rotation pending
**Scope:** Rotating secrets found in Phase 0 discovery that are committed to the repository.

> ⚠️ These credentials are already exposed in git history. Rotation must be done as a **separate, independent action** from the multi-service refactor.

---

## Credentials Found

### SEC-002: MSSQL — `ptrj@123`

| Location | Exposure | Rotation Owner |
|----------|----------|----------------|
| `.env.production` (committed!) | Full read access to `extend_db_ptrj` | DBA / sysadmin |
| `Services/access_sql_server_from_3001/sql_server_client.py` | Hardcoded in script | Dev |

**Rotation steps:**
1. DBA rotates password on SQL Server (`ALTER LOGIN [sa] WITH PASSWORD = '...'`)
2. Update `.env.production` with new password (move to `.gitignore` after rotation)
3. Update `sql_server_client.py` to read from environment variable
4. Verify all services connect with new credentials
5. Add `.env.production` to `.gitignore`

**Read-only fallback:** Create a read-only SQL user for report queries instead of using `sa`:
```sql
CREATE LOGIN report_reader WITH PASSWORD = '...';
CREATE USER report_reader FOR LOGIN report_reader;
GRANT SELECT ON DATABASE::extend_db_ptrj TO report_reader;
```

---

### SEC-003: Firebird SYSDBA — `masterkey`

| Location | Exposure | Rotation Owner |
|----------|----------|----------------|
| `server_bun.js:3154` (hardcoded default) | Full DB access to `PTRJ_ARC.FDB` | DBA |
| `data/ifess/query-templates.json` (template params) | Template may reference | Dev |

**Rotation steps:**
1. DBA changes Firebird SYSDBA password: `gsec -user SYSDBA -pass masterkey -mo SYSDBA -pw newpassword`
2. Set `FB_PASS=newpassword` in environment (not committed)
3. Remove hardcoded default from `server_bun.js` — require env var
4. Update any deployment configs

---

### SEC-001: IFESS API Key — `ptrj-rebinmas-air-ruak-parit-gunung-darul`

| Location | Exposure | Rotation Owner |
|----------|----------|----------------|
| `server_bun.js:182` (hardcoded default) | Protects IFESS endpoints | Dev |
| `.env.local.example` (placeholder) | Not committed | — |

**Rotation steps:**
1. Generate new key: `openssl rand -hex 32`
2. Set `IFESS_API_KEY=newkey` in environment (all IFESS clients must update)
3. Remove hardcoded default from `server_bun.js`
4. Update IFESS SuperApp clients with new key

---

## Not Secrets (informational only)

| Item | Status | Notes |
|------|--------|-------|
| `10.0.0.110` | Network topology | Already in repo READMEs — not a secret |
| JWT public key `keys/public.pem` | Public key | Not sensitive |
| `keys/private.pem` | Private key | Should not be committed — verify gitignore |

---

## Immediate Actions (Before Refactor Begins)

1. Move `.env.production` out of git tracking (or rotate credentials in it)
2. Verify `keys/private.pem` is not committed
3. Audit `Dashboard_Utama/.env.local` — check if committed

---

## PRD Compliance

PRD Section 10.6: *"A read-only operating-system or database credential should provide defense in depth."*

This plan addresses the rotation. The read-only account recommendation from the PRD should be implemented as part of Phase 1 or earlier.
