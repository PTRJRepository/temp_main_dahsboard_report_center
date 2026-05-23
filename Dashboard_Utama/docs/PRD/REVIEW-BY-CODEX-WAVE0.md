# Review by Codex Wave 0

Reviewer: Ujang, Chief Architect, Rebinmas Tech  
Scope: Product Vision, Design System, Component Blueprint, Information Architecture, UX Flows, Role Access Matrix, World Monitor AI

## 1. Consistency Check

### Conflicts and Alignment Risks

1. **World Monitor AI vs RBAC**
   - Risk: AI summaries can leak restricted report data if prompts, embeddings, cached responses, or citations are built from content the user cannot access.
   - Required resolution: every AI request must carry user identity, role, business unit, and report-scope filters. AI output must cite only accessible source records.

2. **Executive dashboard vs module-level navigation**
   - Risk: the IA likely presents modules as separate areas, while executive users need cross-module rollups. This creates duplicate metrics and conflicting totals if aggregation rules are not centralized.
   - Required resolution: define one canonical metrics layer before building executive dashboard widgets.

3. **Global search vs role access matrix**
   - Risk: global search can reveal names, titles, snippets, counts, or autocomplete suggestions for inaccessible reports.
   - Required resolution: search index and suggestions must be permission-filtered server-side, not only hidden in UI.

4. **Design system vs component blueprint**
   - Risk: PRDs often define components visually but omit token ownership, responsive behavior, and interaction states.
   - Required resolution: each component must map to design tokens for spacing, color, typography, radius, shadow, and focus state. No hardcoded one-off styles.

5. **Report preview vs report viewing**
   - Risk: ReportPreviewPanel may show enough sensitive content to bypass full viewer permissions.
   - Required resolution: preview must use the same permission gate as ReportViewer and support redacted previews when only metadata access is allowed.

6. **Export flows vs audit/compliance**
   - Risk: exports are high-risk data egress, but product PRDs often treat them as simple buttons.
   - Required resolution: exports need server-side authorization, audit logs, row-level filters, queued job ownership, expiry, and download watermarking if required by policy.

7. **Empty/loading/error states vs UX flows**
   - Risk: UX flows usually document happy paths only.
   - Required resolution: every page and data component needs loading, empty, partial-data, forbidden, failed, and retry states.

8. **AI confidence vs user trust**
   - Risk: IntelligenceWidget and World Monitor AI can be interpreted as authoritative if confidence, source age, and source coverage are absent.
   - Required resolution: AI outputs must show source links, generated time, confidence level, and "insufficient data" states.

## 2. Implementation Priority

Complexity scale: * low, ** moderate, *** high, **** very high, ***** extreme.

| Priority | Module | Complexity | Why This Order |
|---:|---|---:|---|
| 1 | Foundation Shell | ** | AppShell, Sidebar, Topbar, tokens, layout, routing, and auth context unblock all feature work. |
| 2 | RBAC and Auth Enforcement | **** | Must exist before search, reports, exports, previews, and AI. UI-only RBAC is unacceptable. |
| 3 | Core Navigation and IA | ** | ModuleCard grid, route structure, breadcrumbs, and module entry points establish user workflows. |
| 4 | Report Catalog | *** | ReportListItem, filters, search results, metadata schema, pagination, and preview integration. |
| 5 | Report Viewing | **** | ReportViewer, DataTable, SummaryCard, permissions, large data handling, and error states. |
| 6 | Export Management | **** | ExportButtonGroup and ExportQueuePanel require async jobs, audit, retry, expiry, and authorization. |
| 7 | Executive Dashboard | **** | Depends on canonical metrics, cross-module aggregation, and RBAC-safe rollups. |
| 8 | World Monitor AI / Intelligence | ***** | Depends on content permissions, indexed sources, citations, model governance, and evaluation. |
| 9 | Polish and Accessibility | *** | EmptyState, LoadingSkeleton, ErrorBoundary, keyboard navigation, screen reader behavior, and QA hardening. |

## 3. Critical Dependencies

1. **Design token contract**
   - Colors, typography, spacing, radius, elevation, breakpoints, focus rings, chart colors, and semantic statuses.
   - Must be implemented before components to prevent visual drift.

2. **Routing and layout contract**
   - AppShell regions, sidebar collapse behavior, mobile navigation, topbar actions, breadcrumbs, and route guards.

3. **RBAC policy engine**
   - Role matrix, module permissions, report permissions, row-level rules, export rules, and AI access rules.
   - Must run server-side for every data endpoint.

4. **Report metadata schema**
   - Required fields: id, title, module, description, owner, updatedAt, freshness, tags, sensitivity, access level, source system, preview availability.

5. **Data fetching standard**
   - Loading, stale, empty, error, forbidden, retry, pagination, sorting, filtering, cancellation, and caching behavior.

6. **Audit logging**
   - Required for report view, preview open, export create, export download, AI query, and permission denial.

7. **Mock data contract**
   - Developers need realistic seeded data that includes accessible, forbidden, empty, stale, failed, and large-record scenarios.

8. **AI source and citation pipeline**
   - World Monitor AI cannot be built safely until source permissions and citation filtering are solved.

## 4. Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RBAC only implemented in React components | High | Critical | Enforce permissions in API/server layer. Add negative tests for forbidden data. |
| Search leaks restricted metadata | High | Critical | Permission-filter index queries and autocomplete. Do not return inaccessible counts. |
| AI leaks data through prompts or cache | Medium | Critical | Build per-user scoped retrieval, output filtering, cache partitioning, and audit logs. |
| Component specs omit edge states | High | High | Require loading, empty, error, forbidden, and partial states in every component checklist. |
| Export feature bypasses filters | Medium | Critical | Server owns export query. UI sends export intent only, not raw query authority. |
| Executive metrics disagree with reports | Medium | High | Create canonical metric definitions and shared aggregation service. |
| Large DataTable performance degrades | Medium | High | Use pagination or virtualization, server-side sorting/filtering, and column width rules. |
| Design system becomes inconsistent | High | Medium | Block inline styles, require token usage, and review visual diffs. |
| Mobile sidebar and topbar conflict | Medium | Medium | Define exact breakpoints, overlay behavior, focus trap, and escape behavior. |
| World Monitor AI lacks explainability | Medium | High | Require citations, source age, confidence, and fallback states before release. |
| Export queue jobs become orphaned | Medium | Medium | Add job ownership, status lifecycle, expiry, retry limit, and cleanup job. |
| Error boundaries hide operational failures | Medium | Medium | Log errors with correlation IDs and show actionable retry/report states. |

## 5. Missing Specifications

Developers will need these details before implementation can be considered ready:

1. **Exact role definitions**
   - Role names, inheritance, module permissions, report permissions, export permissions, AI permissions, and admin override rules.

2. **Route map**
   - Full URL structure, dynamic route params, redirects, forbidden pages, not-found behavior, and default landing page per role.

3. **Data contracts**
   - TypeScript interfaces for module, report, preview, table, summary, export job, AI insight, notification, user, and permission result.

4. **API contracts**
   - Endpoints, request params, response shape, errors, pagination, sort syntax, filter syntax, retry semantics, and caching.

5. **Audit events**
   - Event names, required fields, retention requirements, and who can view audit logs.

6. **Report freshness rules**
   - Definition of current, stale, delayed, failed, and unknown data.

7. **Export limits**
   - Allowed formats, row limits, rate limits, file naming, expiry, cancellation, and watermarking.

8. **Search behavior**
   - Search scope, ranking, debounce, minimum characters, empty query behavior, recent searches, and permission filtering.

9. **AI governance**
   - Model/provider, grounding sources, prompt ownership, citation rules, confidence scoring, forbidden topics, retention, evaluation set, and human escalation.

10. **Responsive behavior**
   - Breakpoints, sidebar collapse rules, table behavior on mobile, topbar wrapping, and touch target size.

11. **Accessibility acceptance**
   - Keyboard order, focus management, ARIA labels, contrast, reduced motion, screen reader copy, and modal behavior.

12. **Localization**
   - Bahasa/English copy strategy, date/timezone formatting, number formatting, and business terminology.

13. **Observability**
   - Metrics for page load, search latency, report open latency, export duration, AI latency, errors, and permission denials.

14. **Test fixtures**
   - Mock users for each role, modules with mixed access, reports with sensitivity levels, failed exports, stale data, and AI no-source cases.

## 6. High Priority Components

### 1. AppShell
Acceptance criteria:
- Renders Sidebar, Topbar, main content, and route outlet consistently.
- Supports authenticated, forbidden, loading, and error application states.
- Maintains responsive layout without content overlap at mobile, tablet, and desktop widths.
- Exposes skip-to-content target and landmark regions.

### 2. Sidebar
Acceptance criteria:
- Shows only modules the user can access.
- Supports collapsed desktop state and overlay mobile state.
- Keyboard navigation, focus trap on mobile, Escape close, and active route indication work.
- Does not leak hidden module names through DOM-visible labels.

### 3. Topbar
Acceptance criteria:
- Hosts global search, user menu, notifications, and contextual actions without wrapping failures.
- Shows current role/business context when required.
- All buttons have labels or accessible names.

### 4. HeroBanner
Acceptance criteria:
- Uses design tokens and responsive typography.
- Supports module title, subtitle, primary action, secondary action, and status metadata.
- Does not contain hardcoded business copy inside the component.

### 5. GlobalSearch
Acceptance criteria:
- Debounced input with loading, empty, error, and forbidden-safe states.
- Results are server-side permission filtered.
- Keyboard navigation supports arrows, Enter, Escape, and screen reader announcements.

### 6. FilterChips
Acceptance criteria:
- Supports selected, removable, disabled, overflow, and clear-all states.
- Emits typed filter changes.
- Keeps accessible labels for chip remove actions.

### 7. ModuleCard
Acceptance criteria:
- Displays module name, description, status, count, and last updated metadata.
- Handles forbidden, disabled, loading, and empty module states.
- Entire card is keyboard actionable without nested interactive conflicts.

### 8. ReportListItem
Acceptance criteria:
- Shows report metadata, freshness, sensitivity, owner, and quick actions.
- Does not show preview/export actions unless authorized.
- Supports compact and comfortable density if required by IA.

### 9. ReportPreviewPanel
Acceptance criteria:
- Uses the same authorization rules as ReportViewer.
- Supports redacted, loading, error, and no-preview states.
- Does not fetch full report data when only metadata preview is allowed.

### 10. ReportViewer
Acceptance criteria:
- Enforces permission before data fetch.
- Supports title, metadata, summaries, table/chart region, export actions, and audit event.
- Handles stale data and partial load clearly.

### 11. DataTable
Acceptance criteria:
- Supports server-side pagination, sort, filter, column visibility, and empty/error states.
- Handles large data without blocking the UI.
- Has accessible headers, row focus behavior, and no horizontal overflow breakage.

### 12. SummaryCard
Acceptance criteria:
- Displays metric value, label, trend, comparison period, and freshness.
- Handles unavailable, loading, stale, and permission-hidden states.
- Uses canonical metric definitions.

### 13. ExportButtonGroup
Acceptance criteria:
- Shows only allowed formats/actions.
- Creates server-side export jobs with current authorized filters.
- Shows disabled, queued, failed, success, and rate-limited states.

### 14. IntelligenceWidget
Acceptance criteria:
- Shows source-backed insights only.
- Displays generated time, confidence, citations, and insufficient-data state.
- Never includes inaccessible source content.

### 15. ErrorBoundary
Acceptance criteria:
- Catches render failures at app, page, and component levels.
- Logs correlation ID.
- Provides retry or navigation recovery without exposing stack traces to users.
