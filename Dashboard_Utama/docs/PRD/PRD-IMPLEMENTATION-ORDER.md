# PRD Implementation Order

Complexity scale: * low, ** moderate, *** high, **** very high, ***** extreme.

## Phase 1: Foundation

Components:
- AppShell (**)
- Sidebar (***)
- Topbar (**)
- HeroBanner (*)
- GlobalSearch (****)
- FilterChips (**)

Dependencies:
- Design tokens and theme provider.
- Routing structure and route guards.
- User session and permission context.
- Base data-fetching pattern.
- Mock user roles and module data.

Estimated dev time:
- 8-12 engineering days.

What could go wrong:
- Sidebar exposes modules the user should not see.
- Topbar search is built before server-side permission filtering is available.
- Layout works on desktop but fails on mobile due to undefined sidebar behavior.
- HeroBanner becomes a one-off visual component instead of a reusable module header.
- FilterChips use untyped string filters and become incompatible with APIs.

How to verify done:
- AppShell renders all protected routes behind auth.
- Sidebar shows correct module visibility for every mock role.
- Topbar remains stable at mobile, tablet, and desktop widths.
- GlobalSearch never returns inaccessible result titles, snippets, or counts.
- FilterChips update URL/query state or page state through typed handlers.
- Keyboard navigation reaches sidebar, search, actions, and main content in correct order.

## Phase 2: Core Navigation

Components:
- ModuleCard grid (**)
- ReportListItem (***)
- ReportPreviewPanel (****)

Dependencies:
- Phase 1 AppShell, Sidebar, Topbar, GlobalSearch.
- Module metadata contract.
- Report metadata contract.
- Permission-aware report list API or mock equivalent.
- Preview authorization rule.

Estimated dev time:
- 7-10 engineering days.

What could go wrong:
- Module cards duplicate business logic from the IA instead of reading from module metadata.
- ReportListItem displays actions that fail later because permission checks are inconsistent.
- Preview panel fetches too much data or leaks restricted content.
- Empty states are missing for modules with no reports.
- Search and filter state do not persist across navigation.

How to verify done:
- Module grid renders all allowed modules and hides forbidden modules.
- Report list supports loading, empty, error, stale, and forbidden states.
- Preview panel blocks unauthorized content before fetch.
- Report metadata shows owner, freshness, sensitivity, and updated time consistently.
- Selecting a report updates preview without losing list scroll or filter state.

## Phase 3: Report Viewing

Components:
- ReportViewer (****)
- DataTable (****)
- SummaryCard (**)
- ExportButtonGroup (****)

Dependencies:
- Report detail API contract.
- Table schema and metric schema.
- Server-side pagination, sorting, and filtering.
- Export authorization policy.
- Audit logging for view and export intent.

Estimated dev time:
- 12-18 engineering days.

What could go wrong:
- DataTable loads too much data client-side.
- SummaryCard metrics conflict with table totals due to different aggregation logic.
- ExportButtonGroup passes client-controlled filters that can be tampered with.
- ReportViewer handles happy path only and misses stale/partial/failed data states.
- Audit logs are forgotten or incomplete.

How to verify done:
- ReportViewer denies unauthorized users before report data loads.
- DataTable handles large fixtures with pagination or virtualization.
- Sorting and filtering are server-owned and reflected in visible state.
- SummaryCard values match canonical metric definitions.
- Export actions create authorized server-side jobs only.
- View and export audit events include user, role, report id, timestamp, and outcome.

## Phase 4: Advanced

Components:
- IntelligenceWidget (*****)
- ExportQueuePanel (****)
- ExecutiveDashboard (****)

Dependencies:
- Stable RBAC and audit layer.
- Export job lifecycle service.
- Canonical metrics layer.
- AI source retrieval with permission filtering.
- AI prompt, citation, confidence, and retention policy.

Estimated dev time:
- 15-25 engineering days.

What could go wrong:
- IntelligenceWidget generates answers from inaccessible or stale data.
- AI responses lack citations, confidence, or source age.
- ExportQueuePanel lets users see or download another user's jobs.
- ExecutiveDashboard creates separate metric logic from reports.
- Long-running export jobs lack retry, cancellation, expiry, or cleanup.

How to verify done:
- AI queries are scoped by user permissions and source filters.
- AI output includes citations, generated time, confidence, and insufficient-data handling.
- ExportQueuePanel shows only jobs owned by or administratively visible to the user.
- Export lifecycle covers queued, running, failed, expired, canceled, and completed states.
- ExecutiveDashboard totals reconcile with report-level canonical metrics.

## Phase 5: Polish

Components:
- EmptyState (*)
- LoadingSkeleton (*)
- ErrorBoundary (**)
- Accessibility (***)

Dependencies:
- All previous feature components.
- Accessibility acceptance standards.
- Error logging and correlation ID support.
- Final responsive QA matrix.
- Copy and localization decisions.

Estimated dev time:
- 6-10 engineering days.

What could go wrong:
- EmptyState is decorative but does not provide next actions.
- LoadingSkeleton causes layout shift.
- ErrorBoundary hides failures without logging enough detail.
- Accessibility is treated as final styling instead of behavior.
- Mobile QA finds layout issues too late.

How to verify done:
- Every route and major component has loading, empty, error, forbidden, and retry behavior where applicable.
- Skeleton dimensions match loaded content and do not shift layout.
- ErrorBoundary logs correlation IDs and shows user-safe recovery.
- Keyboard-only users can complete search, navigation, report view, and export flows.
- Screen reader labels exist for icon buttons, filters, table controls, menus, and dialogs.
- Color contrast, focus visibility, and touch targets meet agreed standards.
