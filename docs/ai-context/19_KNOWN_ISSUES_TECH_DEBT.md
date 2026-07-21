---
name: 19-known-issues-tech-debt
description: Known issues and technical debt
metadata:
  type: documentation
  tags: [issues, tech-debt, problems]
---

# Known Issues & Technical Debt

## Known Issues

### Critical Issues

| ID | Issue | Impact | Priority | Status |
|----|-------|--------|----------|--------|
| KI-001 | Hardcoded API keys | Security risk | Critical | Open |
| KI-002 | Firebird isql timeout | Data unavailable | High | Mitigated |
| KI-003 | Port 3001 zombie | Gateway unavailable | Medium | Workaround exists |

### High Priority Issues

| ID | Issue | Impact | Priority | Status |
|----|-------|--------|----------|--------|
| KI-004 | No rate limiting | Brute force risk | High | Open |
| KI-005 | SQL injection potential | Data breach | High | Review needed |
| KI-006 | No backup strategy | Data loss risk | High | Open |

### Medium Priority Issues

| ID | Issue | Impact | Priority | Status |
|----|-------|--------|----------|--------|
| KI-007 | Dual gateway maintenance | Extra work | Medium | Reduce to one |
| KI-008 | No CI/CD pipeline | Manual deploy | Medium | Open |
| KI-009 | Missing audit logging | Compliance risk | Medium | Open |
| KI-010 | Token without refresh | UX issues | Medium | Open |

### Low Priority Issues

| ID | Issue | Impact | Priority | Status |
|----|-------|--------|----------|--------|
| KI-011 | Prisma unused | Dead code | Low | Investigate |
| KI-012 | NextAuth unused | Dead code | Low | Investigate |
| KI-013 | Error messages verbose | Information leak | Low | Sanitize |

## Technical Debt

### Architecture Debt

| Item | Debt | Effort | Recommendation |
|------|------|--------|----------------|
| Dual gateway | High | Medium | Deprecate Express |
| Mixed auth | Medium | High | Standardize |
| External paths | Medium | High | Bundle assets |

### Code Debt

| Item | Debt | Evidence | Recommendation |
|------|------|----------|----------------|
| Magic numbers | Low | Various | Use constants |
| Deep nesting | Low | Some files | Refactor |
| Missing tests | High | API routes | Add tests |

### Dependency Debt

| Item | Debt | Evidence | Recommendation |
|------|------|----------|----------------|
| Unused Prisma | Low | package.json | Remove if unused |
| Old Next.js | Low | 16.0.7 available | Update |
| Old React | Low | 19.2.0 | Stay current |

## Firebird Query Issues

### Known Limitations

| Issue | Impact | Workaround |
|-------|--------|------------|
| No PIVOT support | Report complexity | JS-side pivot |
| No window functions | Analytics | App-side calculation |
| No WITH clause | Query complexity | Flatten queries |
| ORDER BY alias fails | Sorting | Use ordinal numbers |

### Scanner Data Trap

**Issue**: Multi-year data contamination

**Problem**: `#MONTH#` selects partition slot, not calendar month

**Solution**: Always filter with `TRANSDATE BETWEEN 'YYYY-MM-01' AND 'YYYY-MM-#LASTDAY#'`

## iFESS Cache Reload Trap

**Issue**: Nested mutations calling `loadAll()` wipe unsaved cache

**Problem**: Auto-save triggers reload, losing changes

**Solution**: Separate load and save operations

## Recommendations

### Quick Wins (1 day)

1. Rotate API keys
2. Add rate limiting
3. Enable HTTPS

### Medium Effort (1 week)

4. Implement audit logging
5. Add API tests
6. Document upstreams

### Long Term (1 month)

7. Migrate to single gateway
8. Implement secrets manager
9. Add CI/CD pipeline

---

**Evidence**: Code analysis, `CLAUDE.md`
