# FormBridge Improvement Plan

> Detailed implementation plan derived from auto-claude ideation analysis (2026-01-31).
> 35 items across 6 categories, organized into prioritized execution phases.

---

## Execution Phases

| Phase | Focus | Items | Priority |
|-------|-------|-------|----------|
| **Phase 1** | Security hardening | sec-002, sec-001, sec-003, sec-004, sec-005 | Critical/High |
| **Phase 2** | Performance + code quality | perf-002, perf-004, perf-001, cq-001, cq-003 | High |
| **Phase 3** | Feature wiring + schedulers | ci-001, ci-003, ci-004, ci-005, ci-002 | Medium |
| **Phase 4** | Rendering perf + UI/UX | perf-003, uiux-006, uiux-008, uiux-009, uiux-007 | Medium |
| **Phase 5** | Architecture cleanup | cq-002, cq-004, perf-005, uiux-010 | Medium |
| **Phase 6** | Test coverage + docs | cq-005, doc-001 through doc-005 | Medium/Low |

---

## Phase 1 — Security Hardening

### 1.1 [sec-002] Fix resume token leakage via unauthenticated GET endpoint (CRITICAL)

**Problem:** `GET /intake/:intakeId/submissions/:submissionId` (src/app.ts:340-354) returns `resumeToken` in the response body with zero authentication. The resume token is the sole authorization mechanism for all write operations (setFields, submit, approve, reject). An attacker who knows a submission ID can retrieve the token and gain full write access. Tokens also leak in event payloads via `GET /submissions/:id/events`.

**Affected files:**
- `src/app.ts` (lines 340-354)
- `src/core/submission-manager.ts` (event payload construction)
- `src/routes/hono-events.ts`

**Implementation:**
1. Create a `SubmissionView` DTO that excludes `resumeToken` — use it in all GET responses
2. Only return `resumeToken` in POST create and POST handoff responses (to the creator/initiator)
3. Redact resume tokens from event payloads before returning via the events API — store internally but strip from query responses
4. As defense-in-depth, require resume token as a query parameter for GET submission so only token holders can read
5. Add integration tests verifying resume tokens never leak in read-only responses

**Vulnerability:** CWE-200 (Exposure of Sensitive Information to an Unauthorized Actor)

---

### 1.2 [sec-001] Add SSRF protection for webhook delivery

**Problem:** `WebhookManager` (src/core/webhook-manager.ts:226) calls `fetch()` against user-supplied destination URLs with zero SSRF protection. `IntakeRegistry` validates URL syntax but doesn't block private IP ranges (127.0.0.1, 10.x, 192.168.x, 169.254.169.254 AWS IMDS), internal hostnames, or dangerous schemes (file://, gopher://). Destination headers are spread directly into fetch, allowing header injection. Retry logic amplifies attacks.

**Affected files:**
- `src/core/webhook-manager.ts`
- `src/core/intake-registry.ts`

**Implementation:**
1. Add URL validation layer in `IntakeRegistry.validateDestination()` — resolve hostname to IP, block RFC 1918 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), link-local (169.254.0.0/16), loopback (127.0.0.0/8), and IPv6 equivalents
2. Restrict allowed schemes to `https://` only (or configurable allowlist)
3. In `WebhookManager`, re-validate destination URL at delivery time to prevent DNS rebinding
4. Sanitize `destination.headers` — block overwriting Content-Type, Host, Authorization, and X-FormBridge-* headers via allowlist
5. Add configurable URL allowlist/blocklist for webhook destinations

**Vulnerability:** CWE-918 (SSRF)

---

### 1.3 [sec-003] Add security response headers and request body size limits

**Problem:** No security response headers are set (no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy). Missing Referrer-Policy means resume tokens in URL query parameters leak via the Referer header. POST/PATCH endpoints have no body size limit — a multi-GB JSON payload can exhaust memory. Demo Vite binds to 0.0.0.0.

**Affected files:**
- `src/app.ts`
- `src/middleware/cors.ts`
- `packages/demo/vite.config.ts`

**Implementation:**
1. Add `app.use('*', secureHeaders())` from `hono/secure-headers` — sets X-Content-Type-Options, X-Frame-Options, CSP, HSTS, Referrer-Policy
2. Add `app.use('*', bodyLimit({ maxSize: 1024 * 1024 }))` from `hono/body-limit` — 1MB default with route-specific overrides for uploads
3. Change demo `vite.config.ts` host from `0.0.0.0` to `localhost`
4. Environment-aware header presets (strict for production, relaxed for dev)

**Vulnerability:** CWE-693 (Protection Mechanism Failure), CWE-770 (Resource Allocation Without Limits)

---

### 1.4 [sec-004] Enforce schema validation on HTTP API field data

**Problem:** HTTP routes store user-supplied fields via `SubmissionManager.setFields()` without validating against the intake's JSON Schema. The AJV `Validator` class exists at `src/core/validator.ts` but is never invoked from HTTP handlers. MCP path validates with Zod, creating inconsistency. The internal `__uploads` field name can be overwritten via `fields: {"__uploads": {}}`. Actor validation on HTTP routes only checks truthy kind/id with no type/length enforcement.

**Affected files:**
- `src/app.ts` (POST lines 209-299, PATCH lines 357-446)
- `src/core/submission-manager.ts`
- `src/core/validator.ts`

**Implementation:**
1. Wire `Validator` into HTTP route handlers — call `validator.validate(intakeSchema, body.fields)` in both POST and PATCH before `setFields()`, return 400 with errors on failure
2. Add reserved field name blocklist in `setFields()` — reject `__proto__`, `constructor`, `prototype`, `__uploads`
3. Standardize actor validation using the Zod `actorSchema` from `hono-submissions.ts` with `.strict()` and `.max(255)`
4. Add max field value size limits (64KB per field, 1MB per submission)
5. Add tests verifying HTTP API rejects invalid data matching MCP rules

**Vulnerability:** CWE-20 (Improper Input Validation)

---

### 1.5 [sec-005] Add .env to .gitignore and establish secrets hygiene

**Problem:** `.gitignore` has no exclusion for `.env` files. Webhook signing secret defaults to `undefined` — webhooks are unsigned with no startup warning. Manual XOR comparison in `webhook-manager.ts` (lines 88-93) instead of `crypto.timingSafeEqual()` (which IS used correctly in `local-storage.ts`).

**Affected files:**
- `.gitignore`
- `src/app.ts`
- `src/core/webhook-manager.ts`
- `package.json`

**Implementation:**
1. Add `.env`, `.env.*`, `.env.local`, `.env.production`, `.env.*.local` to `.gitignore`
2. Create `.env.example` documenting expected variables
3. Emit startup warning when webhook signing secret is not configured
4. Replace manual XOR loop in `verifySignature()` with `crypto.timingSafeEqual()`
5. Consider adding pre-commit hook via husky + gitleaks

**Vulnerability:** CWE-540 (Sensitive Information in Source Code)

---

## Phase 2 — Performance + Code Quality

### 2.1 [perf-002] Fix SubmissionManager double-save and sequential triple-write

**Problem:** Every mutating operation calls `store.save()` explicitly, then calls `recordEvent()` which also calls `store.save()` — 2x write amplification. `recordEvent()` runs emitter, eventStore, and save sequentially when emit and appendEvent are independent. `BridgingEventEmitter.emit()` uses `Promise.all()` blocking on the slowest listener (webhook delivery blocks API response). POST /submissions with initial fields produces 4 saves and 2 triple-write cycles.

**Current metric:** 2x writes per operation; 8+ async ops for create-with-fields

**Affected files:**
- `src/core/submission-manager.ts` (recordEvent at line 136; save calls at lines 204, 318, 436, 546, 656, 701)
- `src/app.ts` (BridgingEventEmitter.emit lines 76-86)

**Implementation:**
1. Remove explicit `store.save()` calls before `recordEvent()` — recordEvent already saves
2. Parallelize emit and appendEvent in `recordEvent()`: `await Promise.all([emit, appendEvent]); await store.save()`
3. Use `Promise.allSettled()` in `BridgingEventEmitter.emit()` for error isolation
4. Separate listeners into sync (must complete before response) and async (fire-and-forget) so webhook delivery doesn't block API responses
5. Support initial fields in `createSubmission()` natively to avoid separate `setFields` roundtrip

**Expected improvement:** 50% reduction in save calls; ~40% latency reduction in recordEvent; 30-50% faster mutation endpoints

---

### 2.2 [perf-004] Add O(1) secondary indexes for resumeToken and idempotencyKey

**Problem:** `InMemorySubmissionStore` in `src/app.ts` does O(n) linear scan for `getByResumeToken()`. MCP store does O(n) for `getByIdempotencyKey()`. `memory-storage.ts` wastes O(T) scanning all tokens on every save.

**Current metric:** O(n) per resumeToken lookup (critical handoff path)

**Affected files:**
- `src/app.ts` (InMemorySubmissionStore.getByResumeToken lines 53-59)
- `src/mcp/submission-store.ts`
- `src/storage/memory-storage.ts`

**Implementation:**
1. Add `resumeTokenIndex: Map<string, string>` to InMemorySubmissionStore, maintained on save()
2. Add `idempotencyKeyIndex: Map<string, string>` to MCP store
3. Replace O(T) stale token scan in memory-storage.ts with reverse index: `submissionTokens: Map<string, string>`
4. Consider consolidating three store implementations to prevent future drift

**Expected improvement:** All lookups drop to O(1). Handoff latency becomes constant.

---

### 2.3 [perf-001] Eliminate O(n*m) analytics full-table scans

**Problem:** `AnalyticsDataProvider` in `src/app.ts` (lines 162-192) performs 4+ separate full-table scans on every `/analytics/summary` request. `getRecentEvents()` collects ALL events from ALL submissions, sorts the entire array, then takes only 20 items.

**Current metric:** O(4n + n*m*log(n*m)) per /analytics/summary

**Affected files:**
- `src/app.ts` (analyticsProvider lines 162-192)
- `src/core/event-store.ts`

**Implementation:**
1. Add incremental counters to InMemorySubmissionStore: `totalCount`, `stateCountMap<string,number>`, `pendingApprovalCount` — updated in `save()` by diffing old vs new state
2. Maintain bounded max-heap or sorted deque of last N events in EventStore, updated on `appendEvent()`
3. Add type-indexed `Map<eventType, IntakeEvent[]>` to EventStore for `getEventsByType` O(1) lookup
4. Wire AnalyticsDataProvider to read pre-computed structures
5. Periodic reconciliation to prevent counter drift

**Expected improvement:** O(1) reads for counters; O(k) for recent events. ~100x faster for 1000+ submissions.

---

### 2.4 [cq-001] Extract duplicated condition-evaluator into shared package (CRITICAL)

**Problem:** `src/core/condition-evaluator.ts` (306 lines) and `packages/form-renderer/src/core/condition-evaluator.ts` (305 lines) are near-identical copies. Same for `step-validator.ts` (147 vs 146 lines). Any bug fix must be applied in two places.

**Affected files:**
- `src/core/condition-evaluator.ts`
- `packages/form-renderer/src/core/condition-evaluator.ts`
- `src/core/step-validator.ts`
- `packages/form-renderer/src/core/step-validator.ts`

**Implementation:**
1. Create `packages/shared` (or `packages/core-logic`) as a new workspace package
2. Move condition-evaluator and step-validator as zero-dependency isomorphic modules
3. Both root `src/` and `packages/form-renderer` import from `@formbridge/shared`
4. Consolidate the 5 independent nested-value accessor implementations (getFieldValue in both evaluators, schemaParser.ts, FormBridgeForm.tsx getNestedValue/setNestedValue) into a single utility in the shared package
5. Ensure existing tests pass against the unified module

**Metrics:** 451 duplicate lines eliminated

---

### 2.5 [cq-003] Consolidate duplicated error classes and route utilities

**Problem:** `SubmissionNotFoundError` and `InvalidResumeTokenError` are defined identically in both `submission-manager.ts` and `approval-manager.ts` (instanceof checks can fail unexpectedly). `actorSchema` + `parseActor()` are copy-pasted between `hono-submissions.ts` and `hono-approvals.ts` (20 identical lines each).

**Affected files:**
- `src/core/submission-manager.ts`, `src/core/approval-manager.ts`
- `src/routes/hono-submissions.ts`, `src/routes/hono-approvals.ts`

**Implementation:**
1. Extract shared errors to `src/core/errors.ts` — import from both managers
2. Extract `actorSchema` + `parseActor` to `src/routes/shared/actor-validation.ts`
3. Extract shared interfaces (SubmissionStore, EventEmitter) to `src/core/interfaces.ts`
4. Verify instanceof checks still work after consolidation

**Metrics:** ~85 duplicate lines eliminated

---

## Phase 3 — Feature Wiring + Schedulers

### 3.1 [ci-001] Implement WebhookNotifier for approval reviewer notifications

**Problem:** The `WebhookNotifier` interface is defined, `ApprovalManager` accepts it optionally, and `notifyReviewers()` builds the full payload — but silently returns when no notifier configured. A `MockWebhookNotifier` in tests confirms the expected contract. Only the production implementation is missing.

**Affected files:**
- `src/core/approval-manager.ts`
- `src/app.ts`
- `src/core/webhook-manager.ts`

**Implementation:**
1. Create `WebhookNotifierImpl` class implementing `WebhookNotifier` by wrapping `WebhookManager`
2. `notifyReviewers()` formats `ReviewerNotification` into webhook payload, calls `webhookManager.deliver()` for each configured reviewer URL
3. Wire in `app.ts` — pass new instance as 3rd arg to `ApprovalManager` constructor
4. Gets HMAC signing, exponential backoff retry, and queue tracking from existing WebhookManager infrastructure

**Effort:** Small — pure wiring between existing subsystems

---

### 3.2 [ci-003] Add submission TTL expiry background scheduler

**Problem:** Submissions have `ttlMs` and `expiresAt` fields, and the state machine supports `expired` as a terminal state, but expiry is only checked reactively when `setFields` or `confirmUpload` is called. Submissions can sit expired indefinitely.

**Affected files:**
- `src/core/submission-manager.ts`
- `src/app.ts`

**Implementation:**
1. Add `expireStaleSubmissions()` to SubmissionManager — iterate store, filter non-terminal with `expiresAt < now`, transition each to `expired` via triple-write
2. Create `ExpiryScheduler` (or methods on SubmissionManager) using `setInterval` at configurable interval (default 60s)
3. Wire in `app.ts` during `createFormBridgeAppWithIntakes()`
4. Include `stop()` for graceful shutdown in tests
5. Follow the pattern of `EventStore.cleanupOld()`

---

### 3.3 [ci-004] Add webhook delivery retry background scheduler

**Problem:** `DeliveryQueue` defines `getPendingRetries()`, `calculateRetryDelay()` exists with exponential backoff, `WebhookManager.processDelivery()` handles individual attempts — but nothing connects them for periodic retry.

**Affected files:**
- `src/core/webhook-manager.ts`
- `src/core/delivery-queue.ts`
- `src/app.ts`

**Implementation:**
1. Add `startRetryScheduler(intervalMs?)` and `stopRetryScheduler()` to WebhookManager
2. Scheduler uses `setInterval` → `queue.getPendingRetries()` → filter by elapsed delay → `processDelivery()` each
3. Default 30s interval, configurable via `WebhookManagerOptions`
4. Wire in `app.ts` after WebhookManager creation

---

### 3.4 [ci-005] Extend analytics API with per-intake breakdown

**Problem:** Analytics only computes aggregate metrics across all intakes. All per-intake data is already stored on submissions (`intakeId`, `state`, `createdAt`, `updatedAt`).

**Affected files:**
- `src/routes/hono-analytics.ts`
- `src/app.ts`
- `packages/admin-dashboard/src/api/client.ts`

**Implementation:**
1. Add `getSubmissionsByIntake()` and `getCompletionRates()` to `AnalyticsDataProvider`
2. Implement by grouping `store.getAll()` by `intakeId`
3. Add `GET /analytics/intakes` → `[{ intakeId, total, byState, completionRate }]`
4. Add `GET /analytics/funnel` → state-transition funnel data
5. Add matching methods to admin dashboard API client

---

### 3.5 [ci-002] Implement DataTable column sorting

**Problem:** `DataTable` declares `sortable?: boolean` on `ColumnDef` but ignores it in render logic. `@tanstack/react-table` is a dependency but unused.

**Affected files:**
- `packages/admin-dashboard/src/components/DataTable.ts`

**Implementation:**
1. Add `useState<{column: string, direction: 'asc'|'desc'} | null>` for sort state
2. Make `<th>` clickable for columns with `sortable=true`, toggle sort on click
3. Sort data array using active column's `accessor` before rendering
4. Add CSS classes for visual indicators (arrow via `::after` pseudo-element)

---

## Phase 4 — Rendering Performance + UI/UX

### 4.1 [perf-003] Optimize form-renderer validateField() and stabilize re-renders

**Problem:** `validateField()` validates the entire form schema against all data just to check a single field (called on every blur/change). `handleFieldChange` is recreated on every keystroke due to `localFields` dependency, causing entire form re-render. No field components use `React.memo`.

**Current metric:** O(total_fields) validation per blur; O(N) re-renders per keystroke

**Affected files:**
- `packages/form-renderer/src/utils/validation.ts` (lines 248-272)
- `packages/form-renderer/src/components/FormBridgeForm.tsx`
- `packages/form-renderer/src/components/fields/*`

**Implementation:**
1. Use functional setState: `setLocalFields(prev => ...)` to remove localFields from useCallback deps — stable callback reference
2. Wrap FieldWrapper, ArrayField, FileField with `React.memo`
3. Extract sub-schemas per field at form init; compile per-field AJV validators
4. Validate only target field's data in `validateField()`
5. Assign stable `$id` to schemas to eliminate `JSON.stringify` cache keys
6. Keep full-form `validateForm()` for submit-time

**Expected improvement:** N-fold validation reduction; O(1) re-renders per keystroke; <1ms per field validation

---

### 4.2 [uiux-006] Replace browser prompt() with modal dialogs

**Problem:** `ApprovalActions` uses `window.prompt()` for rejection reasons (can't be styled, no textarea, not accessible, blocked by some browsers). Admin dashboard fires approve/reject immediately with no confirmation and hardcodes rejection reason as `'Rejected by admin'`.

**Affected files:**
- `packages/form-renderer/src/components/ApprovalActions.tsx`
- `packages/admin-dashboard/src/pages/SubmissionDetailPage.ts`
- `packages/admin-dashboard/src/main.ts`

**Implementation:**
1. Create `ConfirmationDialog` component for each package — inline modal overlay with focus trap, Escape-to-close, backdrop click-to-close, `aria-modal`/`role='dialog'`
2. Replace `prompt()` calls with dialog containing `<textarea>` for reason/feedback
3. Add simple confirmation variant for approve: "Are you sure?"
4. Admin reject dialog must include required reason textarea passed to `client.rejectSubmission()`
5. Show success/error feedback before navigating away

---

### 4.3 [uiux-008] Fix sidebar active-state highlighting for nested routes

**Problem:** `Layout` uses strict equality (`currentPath === item.path`) — child routes like `/submissions/abc-123` don't highlight the parent "Submissions" nav item. `aria-current='page'` also fails.

**Affected files:**
- `packages/admin-dashboard/src/components/Layout.ts`

**Implementation:**
1. Replace strict equality with: `itemPath === '/' ? currentPath === '/' : (currentPath === itemPath || currentPath.startsWith(itemPath + '/'))`
2. Optionally add `matchMode: 'exact' | 'prefix'` to `NavItem`
3. Ensure `aria-current='page'` uses same logic
4. Consider adding breadcrumb trail on detail pages

---

### 4.4 [uiux-009] Make DataTable rows keyboard-accessible

**Problem:** Clickable rows have `onClick` + `cursor:pointer` but lack `tabIndex`, keyboard handlers (`onKeyDown` for Enter/Space), and ARIA attributes. Keyboard-only users can't navigate. Pagination buttons lack descriptive `aria-labels`.

**Affected files:**
- `packages/admin-dashboard/src/components/DataTable.ts`

**Implementation:**
1. Add `tabIndex={0}` to clickable `<tr>` elements
2. Add `onKeyDown`: Enter/Space triggers `onRowClick(row)`
3. Add `aria-label` via new `rowLabel` prop
4. Add `.fb-table__row--clickable:focus-visible` outline style
5. Pagination buttons: `aria-label={Go to page ${N}}`

---

### 4.5 [uiux-007] Add focus management after dynamic content changes

**Problem:** No focus management after: ArrayField add/remove, WizardForm step nav, ResumeFormPage load/submit, FormBridgeForm validation errors. Keyboard and screen reader users lose position.

**Affected files:**
- `packages/form-renderer/src/components/fields/ArrayField.tsx`
- `packages/form-renderer/src/components/WizardForm.tsx`
- `packages/form-renderer/src/components/ResumeFormPage.tsx`
- `packages/form-renderer/src/components/FormBridgeForm.tsx`

**Implementation:**
1. **ArrayField:** After add, focus new item's first input via ref + useEffect. After remove, focus previous item or Add button
2. **WizardForm:** After step nav, focus first focusable element in new step via useEffect watching `state.currentStep`
3. **ResumeFormPage:** After load, focus form heading. After submit success/error, focus result container (`tabIndex={-1}`)
4. **FormBridgeForm:** After validation errors, focus first `[aria-invalid="true"]` element
5. All focus ops use `requestAnimationFrame()` for DOM timing. Respect `prefers-reduced-motion`

---

## Phase 5 — Architecture Cleanup

### 5.1 [cq-002] Split MCP server.ts (950 lines) into handler modules

**Problem:** `src/mcp/server.ts` handles MCP lifecycle, tool registration, 6 tool handler types, submission state, token handling, and response formatting. Contains 14 nearly-identical error construction blocks (~168 duplicate lines).

**Affected files:**
- `src/mcp/server.ts`
- `src/mcp/tool-generator.ts`

**Implementation:**
1. Extract tool handlers to `src/mcp/handlers/` — one file per action: `create-handler.ts`, `set-handler.ts`, `validate-handler.ts`, `submit-handler.ts`, `upload-handlers.ts`
2. Extract common error construction to `src/mcp/response-builder.ts` with factory functions
3. Extract common token-lookup-and-validate to shared helper
4. Main `server.ts` becomes thin orchestrator (~250 lines)

---

### 5.2 [cq-004] Reduce unsafe 'as any' type assertions

**Problem:** 153 instances of `as any` in production code. `approval-manager.ts` uses `(submission as any).reviewDecisions` in 9 places. `s3-storage.ts` has `any` for AWS SDK client. `validator.ts` casts AJV params to `any`.

**Affected files:**
- `src/core/approval-manager.ts` (9 instances)
- `src/storage/s3-storage.ts` (5 instances)
- `src/core/validator.ts` (4 instances)
- `packages/form-renderer/src/api/client.ts`

**Implementation:**
1. Add `reviewDecisions?: ReviewDecision[]` to `Submission` type — eliminates 9 casts
2. Create typed interface for S3 client operations
3. Type AJV `ErrorObject` params properly
4. Add proper return type to `getSubmissionByResumeToken` in form-renderer client

---

### 5.3 [perf-005] Add TTL-based eviction and memory bounds to in-memory stores

**Problem:** No eviction policies, size limits, or TTL cleanup in any in-memory store. Memory grows monotonically. Events stored 3x simultaneously. `appendEvent()` sorts entire array O(n*log(n)) on every call despite events arriving in order.

**Affected files:**
- `src/app.ts` (InMemorySubmissionStore)
- `src/core/event-store.ts`
- `src/core/delivery-queue.ts`
- `src/types.ts` (Submission.events)

**Implementation:**
1. Periodic cleanup sweep in InMemorySubmissionStore — remove past `expiresAt`
2. Configurable `maxEntries` with LRU eviction for terminal-state submissions
3. Auto-purge succeeded deliveries after configurable retention (default 24h)
4. Replace full sort in `appendEvent` with check-and-insert (skip sort if in order)
5. Cap `submission.events` to last N events (e.g., 50)
6. Wire `EventStore.cleanup()` to periodic schedule
7. Add memory metric to `/health` endpoint

---

### 5.4 [uiux-010] Add screen reader announcements and clickable steps to WizardForm

**Problem:** Step transitions are silent — no aria-live announcements, no "Step X of Y" text. Completed steps are non-interactive `<span>` elements despite `goTo(stepId)` existing in the hook.

**Affected files:**
- `packages/form-renderer/src/components/WizardForm.tsx`
- `packages/form-renderer/src/components/StepIndicator.tsx`
- `packages/form-renderer/src/hooks/useWizardNavigation.ts`

**Implementation:**
1. Add visually-hidden `aria-live='polite'` div that announces "Step N of M: [Title]" on step change
2. Change completed step `<span>` to `<button>` with `aria-label='Go to step N: [Title] (completed)'`
3. Wire `onGoToStep` callback through to `actions.goTo()`
4. Add visible "Step N of M" text for all users

---

## Phase 6 — Test Coverage + Documentation

### 6.1 [cq-005] Add test suites for untested critical areas

**Coverage gaps:**
- `packages/admin-dashboard/` — 14 source files, 0 tests (0% coverage)
- `src/middleware/error-handler.ts` — 279 lines, 0 tests
- `src/auth/middleware.ts` — 232 lines, 0 tests
- `src/core/intake-registry.ts` — 371 lines, no dedicated unit test

**Implementation priority:**
1. `tests/middleware/error-handler.test.ts` — test each error type → HTTP status mapping
2. `tests/auth/middleware.test.ts` — test auth pipeline (API key, permissions, rate limiting)
3. `src/core/__tests__/intake-registry.test.ts` — test registration, validation, lookup
4. `packages/admin-dashboard/src/__tests__/client.test.ts` — test API client with mocked fetch

---

### 6.2 [doc-001] Flesh out HTTP API reference pages

**Current state:** docs-site API pages are skeleton stubs. 0/18 endpoints fully documented. No analytics page.

**Scope:** For each of 18+ endpoints: full request/response JSON, required/optional fields table, status codes, error format, curl example. Create `analytics.md` page. Document handoff and upload endpoints.

---

### 6.3 [doc-002] Create React form renderer documentation

**Current state:** 25-line stub despite 30+ exports.

**Scope:** Expand into: overview/install, component props tables, hooks API (useFormState, useValidation, useFormSubmission, useResumeSubmission), WizardForm guide, ResumeFormPage integration, ReviewerView/ApprovalActions, and package README.

---

### 6.4 [doc-003] Expand core concepts page

**Current state:** 41 lines, happy-path-only state diagram.

**Scope:** Full state machine Mermaid diagram with all states/transitions, triple-write pattern explanation, field attribution JSON examples, resume token lifecycle, approval gates, idempotency.

---

### 6.5 [doc-004] Add package READMEs

**Missing for:** form-renderer, admin-dashboard, create-formbridge, templates (4 of 6 packages).

**Scope:** 50-150 lines each following schema-normalizer's pattern: overview, install, quick start, API surface, links to docs-site.

---

### 6.6 [doc-005] Add JSDoc to admin-dashboard API client

**Current state:** ~17% JSDoc coverage. 11 interfaces and 13+ methods undocumented.

**Scope:** Add field descriptions to all interfaces, `@param`/`@returns`/`@throws` to all methods, `@example` for high-use methods.

---

## Dependency Graph

```
Phase 1 (security) — no dependencies, can start immediately
  sec-005 → independent
  sec-002 → independent
  sec-001 → independent
  sec-003 → independent
  sec-004 → independent

Phase 2 (perf + quality) — after Phase 1 security baseline
  perf-002 → independent
  perf-004 → independent
  perf-001 → after perf-004 (uses same store, avoid conflicts)
  cq-001  → independent (shared package creation)
  cq-003  → independent

Phase 3 (features) — after Phase 2 core fixes
  ci-001 → after cq-003 (uses consolidated error classes)
  ci-003 → after perf-002 (depends on clean save pattern)
  ci-004 → independent
  ci-005 → after perf-001 (extends analytics provider)
  ci-002 → independent

Phase 4 (UI) — after Phase 2 shared package
  perf-003 → after cq-001 (uses shared validation utils)
  uiux-006 → independent
  uiux-008 → independent
  uiux-009 → independent (can combine with ci-002)
  uiux-007 → independent

Phase 5 (cleanup) — after Phases 2-3
  cq-002  → after ci-001 (MCP handlers may change)
  cq-004  → independent
  perf-005 → after ci-003 (TTL scheduler interacts with eviction)
  uiux-010 → after uiux-007 (builds on focus management)

Phase 6 (tests + docs) — ongoing, can run in parallel
  cq-005  → after Phases 1-3 (test against final implementations)
  doc-*   → independent, can start anytime
```

---

## Verification Criteria

After each phase:
1. `npm run build` and `npm run build --workspaces` pass
2. `npm run test:run` — all tests pass, no regressions
3. `npm run lint` — no new warnings
4. Manual smoke test: start backend (`npx tsx src/test-server.ts`), verify affected endpoints
5. For UI changes: start demo/admin-dashboard dev servers, verify in browser
