---
name: 01-project-overview
description: Full project overview with scope and objectives
metadata:
  type: documentation
  tags: [project-overview, scope]
---

# Project Overview

## Project Name

**PT Rebinmas Jaya - Main Dashboard**

## Organization

PT Rebinmas Jaya operates oil palm plantations and palm oil mills (Pabrik Kelapa Sawit/PKS) in Indonesia.

## Project Purpose

The Main Dashboard serves as a unified gateway and administration portal for:

1. **Inventory Management** - Procurement, stock tracking, material movements
2. **Human Resources** - Employee attendance, overtime, payroll integration
3. **Production** - Fresh Fruit Bunch (FFB) harvesting analytics
4. **Financial** - Cost analysis, budget tracking, payroll
5. **iFESS Control** - Desktop client management for field data collection

## Project Scope

### In Scope

- Bun gateway reverse proxy (`server_bun.js`)
- Next.js 16 dashboard application
- MSSQL database integration
- Firebird query gateway
- iFESS control server
- Report viewing and generation
- JWT RS256 authentication

### Out of Scope

- Mobile application
- Real-time push notifications
- Multi-tenant architecture
- Cloud-native deployment (current is hybrid)

## Business Context

The plantation industry requires:
- **Field data collection** via iFESS desktop clients at estates
- **Centralized reporting** for management decisions
- **Integration** with payroll and attendance systems
- **Audit trails** for plantation operations

## Key Stakeholders

| Stakeholder | Role | System Access |
|-------------|------|--------------|
| Estate Managers | Operations oversight | Dashboard, Reports |
| Admin Staff | System administration | Full access |
| Field Workers | Data collection | iFESS Desktop |
| Management | Executive reporting | Executive Dashboard |

## Project Status

**Status**: Active Development

- Last commit: `f4ae255` (2026-07-18)
- Active branch: `main`
- Documentation: Generated 2026-07-18

## Related Projects

| Project | Relationship | Location |
|---------|-------------|----------|
| PORTAL_ESTATE | Payroll system upstream | External |
| Plantware_Auto_Report | Report automation | External |
| Dokumentasi.zip | Historical documentation | Local |

---

**Evidence**: `package.json`, `CLAUDE.md`, `git log`
