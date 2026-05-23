# Code Generation Checklist

Use this checklist for every generated component, page, and RBAC-sensitive feature. Code that fails these checks is not implementation-ready.

## Per-Component Standards

### TypeScript Contract
- [ ] Component has an explicit `Props` interface or type.
- [ ] Props use domain types from shared contracts where available.
- [ ] No `any` types.
- [ ] No untyped callback payloads.
- [ ] Optional props have clear defaults.
- [ ] Component exports are named exports.
- [ ] Component file lives in the correct feature or shared component folder.

### Styling and Design System
- [ ] Uses design tokens for color, spacing, typography, radius, elevation, and focus state.
- [ ] No inline styles except unavoidable dynamic CSS variables.
- [ ] No hardcoded hex values unless they are token definitions.
- [ ] No one-off spacing values outside the token scale.
- [ ] Responsive behavior follows documented breakpoints.
- [ ] Text does not overflow buttons, cards, table cells, or toolbar regions.

### State Coverage
- [ ] Loading state exists.
- [ ] Empty state exists when data can be empty.
- [ ] Error state exists with retry or recovery when applicable.
- [ ] Forbidden state exists when permissions can deny access.
- [ ] Disabled state communicates why action is unavailable where needed.
- [ ] Partial-data or stale-data state exists for reports and AI outputs.

### Accessibility
- [ ] Interactive elements are reachable by keyboard.
- [ ] Focus state is visible.
- [ ] Icon-only buttons have accessible names.
- [ ] Menus, dialogs, panels, and overlays manage focus correctly.
- [ ] Escape closes dismissible overlays.
- [ ] ARIA attributes describe state only when native HTML is insufficient.
- [ ] Color is not the only indicator of status.

### Behavior
- [ ] Button handlers are wired and tested with realistic inputs.
- [ ] Callback names describe intent, for example `onExportCreate` instead of `onClick`.
- [ ] Components do not fetch data unless they are explicitly container components.
- [ ] Presentational components do not read global auth state directly unless required by design.
- [ ] Component does not leak restricted values into DOM, logs, analytics, or test IDs.

## Per-Page Standards

### Layout and Responsiveness
- [ ] Page works at mobile, tablet, and desktop breakpoints.
- [ ] Sidebar behavior is correct: collapsed desktop, overlay mobile, active route visible.
- [ ] Topbar actions do not overlap search, title, user menu, or notifications.
- [ ] Main content has stable width, padding, and scroll behavior.
- [ ] Tables have defined mobile behavior: horizontal scroll, column reduction, or alternate layout.

### Data and Mocking
- [ ] Page uses typed mock data until API integration is available.
- [ ] Mock data includes accessible, forbidden, empty, stale, failed, and large-list scenarios.
- [ ] Data-fetching code handles cancellation or stale responses where search/filtering is used.
- [ ] Pagination, sorting, and filtering state are visible and recoverable.

### Actions and Flows
- [ ] All primary and secondary buttons have implemented handlers.
- [ ] Navigation actions use the app router, not raw browser location changes.
- [ ] Export actions call server-owned export creation logic.
- [ ] Search actions are debounced and permission-safe.
- [ ] Destructive or data-egress actions require confirmation when policy requires it.

### Error Handling
- [ ] Page is wrapped by the correct ErrorBoundary level.
- [ ] Errors are logged with route, user context where allowed, and correlation ID.
- [ ] User-facing errors do not expose stack traces, SQL, prompts, tokens, or internal IDs.
- [ ] Retry path is available for transient failures.

## RBAC Standards

### Component-Level Checks
- [ ] Navigation hides inaccessible modules.
- [ ] Report actions hide or disable actions the user cannot perform.
- [ ] Preview panels enforce the same permission level as full report views.
- [ ] Export controls are hidden or disabled based on export permission, sensitivity, and report scope.
- [ ] AI widgets are hidden or restricted when the user lacks source access.

### Server-Side Verification
- [ ] Every protected API endpoint verifies user identity and permission server-side.
- [ ] Report list, report detail, preview, search, export, and AI endpoints all enforce permissions.
- [ ] Row-level and business-unit filters are applied server-side.
- [ ] Export jobs store owner, role context, filter scope, source report IDs, and permission decision.
- [ ] Download URLs are scoped, expiring, and checked at download time.

### No Data Leakage
- [ ] Search autocomplete does not reveal inaccessible report titles or counts.
- [ ] Empty states do not distinguish "no data" from "no permission" unless policy allows it.
- [ ] Error messages do not confirm existence of restricted reports.
- [ ] AI prompts and retrieval context include only accessible source content.
- [ ] AI cache is partitioned by permission scope or disabled for sensitive outputs.
- [ ] Logs, analytics, and client-side state do not store restricted report content.
- [ ] Test snapshots do not include sensitive sample data.

## Required Review Gates

- [ ] Type check passes.
- [ ] Lint passes.
- [ ] Unit tests cover permission-allowed and permission-denied paths.
- [ ] Interaction tests cover keyboard navigation for menus, search, filters, and panels.
- [ ] Visual review covers mobile, tablet, and desktop.
- [ ] Security review covers search, preview, export, and AI data paths.
- [ ] Accessibility review covers keyboard, focus, labels, contrast, and screen reader behavior.
- [ ] Product review confirms copy, role behavior, and module ordering.
