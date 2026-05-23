# 05-LIB-UTILS - Library Utilities

This document documents all utility modules in `lib/` including API clients, React hooks, RBAC system, and report helpers.

---

## lib/api/ (4 files)

### lib/api/types.ts

TypeScript interfaces for SQL Gateway API responses.

**Exports:**
- `QueryResponse<T>` - Generic response wrapper with success, db, execution_ms, data, error
- `QueryOptions` - Options for single queries: sql, database, server, params
- `ServerStatus` - Server connection status: name, host, port, defaultDatabase, readOnly, connected, healthy
- `ServersResponse` - Response listing all servers: success, data.servers[], total, defaultServer
- `DatabasesResponse` - Response listing databases: success, server, data.databases[], total
- `BatchQueryOptions` - Options for batch queries: queries[], database?, server?
- `BatchQueryResponse` - Batch query result: success, server, db, execution_ms, data.results[], transactionCommitted

---

### lib/api/sql-gateway.ts

Core SQL Gateway client for executing read-only queries against the API.

**Exports:**
- `SqlGatewayError` - Error class with statusCode, success, executionMs, db
- `SqlGatewayConfigError` - Configuration error class
- `SqlGatewayConfig` - Configuration interface: baseUrl, apiKey, defaultDatabase?, defaultServer?, debug?
- `SqlGateway` - Main client class with methods:
  - `query<T>(sql, options?)` - Execute read-only SQL query
  - `queryRows<T>(sql, options?)` - Execute query and return recordset array
  - `queryBatch(queries, options?)` - Execute multiple queries
  - `listServers(signal?)` - List all server profiles
  - `listDatabases(server?, signal?)` - List accessible databases

---

### lib/api/reports.ts

Report-oriented query helpers built on SqlGateway.

**Exports:**
- `HRAggregateRow` - HR headcount result: DEPT_NAME, HEADCOUNT
- `PayrollSummaryRow` - Payroll summary: DEPT, EMPLOYEE_COUNT, TOTAL_BASIC, TOTAL_ALLOWANCES, TOTAL_DEDUCTIONS, TOTAL_NET
- `AttendanceDailyRow` - Daily attendance: DEPT, STATUS, COUNT
- `EmployeeRow` - Employee record: EMP_ID, EMP_NAME, DEPT
- `createReportHelpers(db)` - Factory function returning report methods:
  - `hrHeadcountByDepartment(signal?)`
  - `hrHeadcountByStatus(signal?)`
  - `hrHeadcountWithAvgSalary(signal?)`
  - `attendanceDailyBreakdown(date, signal?)`
  - `attendanceMonthlyRate(yearMonth, signal?)`
  - `attendanceMissingMonthly(yearMonth, signal?)`
  - `payrollSummary(yearMonth, signal?)`
  - `payrollMonthOverMonth(yearMonth, signal?)`
  - `payrollAnomalies(yearMonth, signal?)`
  - `dashboardKPIs(yearMonth, signal?)`

---

### lib/api/queries.ts

Pre-built parameterized query helpers for common entities.

**Exports:**
- `PaginationParams` - Pagination: limit?, offset?
- `DateFilterParams` - Date range: from?, to?
- `SearchParams` - Search options: search?
- `createQueryHelpers(db)` - Factory returning:
  - `employees` - selectAll, search, selectById, count
  - `departments` - selectAll, selectById, listEmployees
  - `attendance` - selectByEmployee, dailySummary
  - `payroll` - selectByEmployeeAndPeriod, summaryByDepartment
  - `raw(sql, params?, signal?)` - Generic raw query

---

## lib/hooks/ (3 files)

### lib/hooks/useReports.ts

React Query hook for fetching reports with mock fallback.

**Exports:**
- `Report` - Report type (re-exported from mock-data)
- `UseReportsOptions` - Hook options: moduleId?, staleTime?, enabled?
- `fetchReportsFromApi(moduleId?)` - Async fetch function
- `useReports(options?)` - Main hook returning useQuery<Report[]>
- `reportKeys` - Query key factory: all, lists, list, details, detail
- `useReport(id)` - Fetch single report by ID

---

### lib/hooks/useSearch.ts

Search hooks with debounce, infinite scroll, and autocomplete.

**Exports:**
- `useDebounce<T>(value, delay)` - Debounce hook returning debounced value
- `searchKeys` - Query key factory: all, results, suggestions
- `SearchResult` - Paginated search result: items[], total, page, pageSize, hasMore
- `SearchParams` - Search parameters: q, type?, page?, pageSize?, filters?
- `SearchSuggestion` - Autocomplete item: id, text, type, meta?
- `useSearch(options)` - Main search hook with infinite query
- `useSearchSuggestions(options)` - Lightweight autocomplete hook
- `RecentSearch` - Recent search entry: term, timestamp, type?
- `useRecentSearches()` - Hook for managing recent searches in localStorage
- `useSearchPrefetch(searchOptions)` - Hook for imperative prefetch

---

### lib/hooks/useExport.ts

Export hooks for CSV/XLSX/PDF generation with polling.

**Exports:**
- `ExportFormat` - Type: 'csv' | 'xlsx' | 'pdf'
- `ExportPayload` - Export request: reportId?, format, filters?
- `ExportProgress` - Job status: jobId, status, progress?, downloadUrl?, error?, expiresAt?
- `ExportResponse` - Initial response: jobId, downloadUrl, expiresAt
- `useExportReport(options)` - Mutation hook for single report export
- `ExportAllPayload` - Bulk export: format, filters?, includeQueryText?
- `useExportAllReports(options)` - Mutation hook for bulk export
- `useExportCancel()` - Mutation hook to cancel export job
- `ExportTemplate` - Template definition: id, name, format, description, defaultFilters?
- `useExportTemplates(queryOptions?)` - Query hook for export templates

---

## lib/rbac/ (4 files)

### lib/rbac/types.ts

RBAC types.

**Exports:**
- `Role` - Role type: 'kerani' | 'hr' | 'payroll' | 'manager' | 'admin' | 'SuperAdmin'
- `ModuleId` - Module identifier: 'dashboard' | 'queries' | 'users' | 'reports' | 'payroll' | 'settings' | 'audit_logs'
- `ROLE_LABELS` - Human-readable labels: Record<Role, string>
- `UserSession` - Session object: id, username, displayName, role, email?, sessionCreatedAt, expiresAt
- `AuthContextValue` - Auth context: user, isLoading, login, logout

---

### lib/rbac/index.ts

Public API surface for RBAC library.

**Exports:** (re-exports from submodules)
- All types from `./types`
- ROLE_LABELS
- UserSession, AuthContextValue
- ModuleId, REPORT_LABELS from `./permissions`
- Permission functions: canAccessModule, canViewReport, canExport, getAccessibleModules, getViewableReports, getExportableFormats
- Hooks: usePermission, useModuleAccess, useReportAccess, useExportAccess
- ProtectedRoute component

---

### lib/rbac/permissions.ts

Core permission functions and access matrices.

**Exports:**
- `ModuleId` - Module IDs (same as types.ts)
- `MODULE_LABELS` - Human-readable module labels
- `ReportId` - Report IDs: 'summary' | 'query_history' | 'user_activity' | 'hr_report' | 'payroll_report' | 'audit_log'
- `REPORT_LABELS` - Report labels
- `ExportFormat` - Export formats: 'csv' | 'xlsx' | 'json' | 'pdf'
- `canAccessModule(role, module)` - Check module access
- `canViewReport(role, report)` - Check report visibility
- `canExport(role, format)` - Check export permission
- `getAccessibleModules(role)` - Get allowed modules
- `getViewableReports(role)` - Get allowed reports
- `getExportableFormats(role)` - Get allowed formats

---

### lib/rbac/usePermission.ts

React hooks for RBAC permission checks.

**Exports:**
- `usePermission()` - Hook returning `can(action, target)` function and role
- `useModuleAccess()` - Hook returning accessible ModuleId[]
- `useReportAccess()` - Hook returning visible ReportId[]
- `useExportAccess()` - Hook returning allowed ExportFormat[]

---

## lib/reports/ (5 files)

### lib/reports/config.ts

Module registry for Report Center.

**Exports:**
- `ModuleStatus` - Status: 'active' | 'coming_soon' | 'locked'
- `ModuleIcon` - Icon names: 'Package' | 'Calendar' | 'Wallet' | etc.
- `ModuleConfig` - Module config: id, name, description, reportCount, route, status, lastUpdated, color, icon
- `MODULE_CONFIGS` - Array of 9 module configs
- `MODULE_IDS` - Array of module IDs
- `getModuleConfig(id)` - Lookup function

---

### lib/reports/monitoring.ts

Monitoring data types.

**Exports:**
- `MonitoringTone` - Visual tone: 'green' | 'blue' | 'gold' | 'red' | 'slate'
- `MonitoringVisualData` - Visual data structure: kpis[], trend[], breakdown[], composition[], ranking[], alerts[], title, badge?

---

### lib/reports/intelligence.ts

Intelligence module definitions with KPIs and insights.

**Exports:**
- `IntelligenceModuleId` - Module IDs: 'absensi' | 'payroll' | 'daftar-upah' | 'inventory' | 'premi' | 'produktivitas' | 'karyawan' | 'estate' | 'integrasi'
- `VisualPoint` - Chart data point: label, value, secondary?
- `InsightContent` - AI insight: summary, trendDetection, anomalyDetection, recommendation, dataQualityNote
- `IntelligenceModule` - Full module definition with KPIs, charts, alerts, insight
- `intelligenceModules` - Array of 9 intelligence module configs

---

### lib/reports/report-filtering.ts

Report filtering and SQL validation utilities.

**Exports:**
- `DbRow` - Database row: Record<string, unknown>
- `ReportColumnType` - Column type: 'string' | 'number' | 'date' | 'boolean'
- `ReportAggregateFn` - Aggregate: 'sum' | 'count' | 'avg' | 'min' | 'max'
- `ReportColumnOperator` - Filter operator: 'contains' | 'equals' | 'notEquals' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'blank' | 'notBlank'
- `ReportColumnFilter` - Column filter: field, operator, value?, valueTo?
- `ReportColumnSchema` - Column schema: field, label, type, filterable, sortable, aggregatable, operators
- `ReportSchema` - Full schema: reportCode?, reportName?, module?, columns[]
- `ReportFilterInput` - Filter input: search?, period?, dateFrom?, dateTo?, location?, category?, supplier?, status?, vehicle?, blankField?, minQty?, minAmount?, sortMetric?, sortDirection?, chartDimension?, groupBy?, aggregateField?, aggregateFn?, top?, resultLimit?, analysis?, columnFilters?, naturalQuery?
- `ReadOnlyValidation` - Validation result: safe, reason?, blockedTerms?
- `validateReadOnlySql(sql)` - Validate SQL is read-only
- `validateNaturalLanguageReadOnly(query)` - Validate natural language query
- `normalizeReportFilters(input)` - Normalize input filters
- `filtersFromSearchParams(params)` - Parse URL search params
- `activeFiltersToRecord(filters)` - Convert to plain record
- `hasActiveReportFilters(filters)` - Check if filters active
- `inferReportSchema(payload)` - Infer schema from data

---

### lib/reports/inventory/config.ts

Inventory-specific report definitions.

**Exports:**
- `InventoryReportStatus` - Status: 'live' | 'update' | 'hold'
- `InventoryReportPriority` - Priority: 'critical' | 'high' | 'medium'
- `InventoryReportCadence` - Cadence: 'Harian' | 'Bulanan' | 'On demand'
- `InventoryChartDefinition` - Chart config: id, title, type, metric, dimension, sourceTables, insightFocus
- `InventoryReport` - Full report definition: id, apiReport, code, group, groupTitle, title, description, executiveQuestion, status, priority, tags[], sourceTables, lastUpdated, owner, cadence, dataGrain, validated, chartDefinitions[], qualityNotes[], readOnly
- `inventoryGroups` - Group names: executive, master, aging, transaction, purchasing, fertilizer, control, fuel, vehicle, hold
- `inventoryReports` - Array of inventory report definitions

---

## lib/utils.ts

Utility functions.

**Exports:**
- `cn(...inputs)` - Class name merger (twMerge + clsx)

---

## lib/mock-data.ts

Mock data for development and fallback.

**Exports:**
- `Report` - Report interface: id, moduleId, name, category, description, lastRun, status, rowCount
- `RAW_REPORTS` - Array of raw report records
- `getMockReportsByModule(moduleId?)` - Get reports filtered by module
- `getAllMockReports()` - Get all mock reports (with moduleId injected)

---

## Summary

| Directory | Files | Purpose |
|-----------|-------|---------|
| lib/api/ | 4 | SQL Gateway client, types, query/report helpers |
| lib/hooks/ | 3 | React Query hooks for reports, search, export |
| lib/rbac/ | 4 | Role-based access control, permissions |
| lib/reports/ | 5 | Report configs, filtering, intelligence, inventory |
| lib/utils.ts | 1 | Utility functions |
| lib/mock-data.ts | 1 | Mock data for development |