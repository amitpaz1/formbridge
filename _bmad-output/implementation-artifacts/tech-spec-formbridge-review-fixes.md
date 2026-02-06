---
title: 'FormBridge Code Review Remediation'
slug: 'formbridge-review-fixes'
created: '2026-02-06'
status: 'in-progress'
stepsCompleted: []
tech_stack:
  - TypeScript 5.x
  - Hono (web framework)
  - Ajv (JSON Schema validation)
  - Zod (schema validation)
  - better-sqlite3
  - Node.js crypto module
files_to_modify:
  - src/core/approval-manager.ts
  - src/core/submission-manager.ts
  - src/app.ts
  - src/routes/hono-submissions.ts
  - src/routes/hono-events.ts
  - src/routes/hono-approvals.ts
  - src/routes/uploads.ts
  - src/routes/hono-webhooks.ts
  - src/types/intake-contract.ts
  - src/auth/rate-limiter.ts
  - src/core/webhook-manager.ts
  - src/core/validator.ts
  - src/core/event-store.ts
  - src/mcp/submission-store.ts
  - src/mcp/response-builder.ts
  - src/mcp/server.ts
  - src/storage/sqlite-storage.ts
  - packages/schema-normalizer/src/index.ts
code_patterns:
  - Branded types for domain IDs (SubmissionId, IntakeId, etc.)
  - Event sourcing with triple-write pattern
  - State machine with guard functions
  - Options object pattern for constructors
  - Discriminated union types
  - timingSafeEqual for token comparison
test_patterns:
  - Vitest test runner
  - In-memory stores for unit tests
  - 49/50 test files passing (sqlite native module issue)
---

# Tech-Spec: FormBridge Code Review Remediation

**Created:** 2026-02-06
**Source:** Opus 4.6 automated code review of all production source files
**Build Health:** TypeScript zero errors, 1273/1341 tests passing (68 failures in sqlite-storage.test.ts due to native module issue)

## Overview

### Problem Statement

FormBridge is a shipped, functional mixed-mode agent-human form submission system. An Opus 4.6 code review identified **3 critical security issues**, **8 high-priority improvements**, **5 performance concerns**, and **7 quick wins**. These need to be addressed systematically to harden the codebase before wider adoption.

### Solution

A prioritized remediation plan organized into 5 epics with 20 implementation stories. Each story is self-contained with exact file paths, current code patterns, replacement code, and acceptance criteria. A fresh sub-agent can pick up any story and implement it without additional context.

### Scope

**In Scope:**
- All critical and high-priority findings from the code review
- Performance fixes for production readiness
- Quick wins that improve code quality with minimal risk
- Type system improvements for long-term maintainability

**Out of Scope:**
- Feature development (no new functionality)
- Database migration changes (SQLite schema unchanged)
- MCP protocol changes (wire format unchanged)
- Test infrastructure fixes (the sqlite native module issue is a build problem, not a code bug)
- `Result<T, E>` refactor of SubmissionManager error handling (too invasive for this sprint)

## Context for Development

### Codebase Patterns

1. **Branded types**: Domain IDs use branded types from `src/types/branded.ts`. Always use constructors like `SubmissionId(...)`, `ResumeToken(...)`, etc.
2. **Event sourcing**: State changes go through `SubmissionManager.recordEvent()` which implements the triple-write pattern: append to submission.events, emit via EventEmitter, persist to EventStore.
3. **State machine**: `src/core/state-machine.ts` defines valid transitions. Always call `assertValidTransition()` before changing state.
4. **Error handling**: Two patterns coexist — thrown errors (SubmissionNotFoundError, InvalidResumeTokenError) and returned IntakeError objects. This spec does NOT change this pattern (out of scope).
5. **Route structure**: Hono routers in `src/routes/` are created by factory functions that receive manager instances. Routes are mounted in `src/app.ts`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/core/approval-manager.ts` | Approval workflow — approve/reject/requestChanges |
| `src/core/submission-manager.ts` | Core submission lifecycle — create/setFields/submit |
| `src/app.ts` | App factory, InMemorySubmissionStore, BridgingEventEmitter, route wiring |
| `src/routes/hono-submissions.ts` | HTTP endpoints for submission operations |
| `src/routes/hono-events.ts` | HTTP endpoints for event stream queries |
| `src/routes/hono-approvals.ts` | HTTP endpoints for approval workflow |
| `src/routes/hono-webhooks.ts` | HTTP endpoints for webhook delivery status |
| `src/routes/hono-analytics.ts` | HTTP endpoints for analytics dashboard |
| `src/types/intake-contract.ts` | Core type definitions — IntakeError, SubmissionState, etc. |
| `src/auth/rate-limiter.ts` | Per-key sliding window rate limiter |
| `src/core/webhook-manager.ts` | Webhook delivery with HMAC signing and retry |
| `src/core/validator.ts` | Ajv-based JSON Schema validation |
| `src/core/event-store.ts` | Event storage interface + InMemoryEventStore |
| `src/core/state-machine.ts` | State transition map and guard function |
| `src/mcp/server.ts` | MCP server — registers intakes as tools |
| `src/mcp/submission-store.ts` | MCP session store + InMemorySubmissionStore |
| `src/mcp/response-builder.ts` | MCP response factories and type guards |
| `src/schemas/intake-schema.ts` | MCP-side IntakeDefinition (Zod-based) |
| `src/storage/memory-storage.ts` | InMemorySubmissionStorage (storage interface impl) |
| `src/storage/sqlite-storage.ts` | SQLite storage backend |
| `packages/schema-normalizer/src/index.ts` | Schema normalizer entry point |

### Technical Decisions

1. **timingSafeEqual for tokens**: Use `crypto.timingSafeEqual` with Buffer encoding. Tokens are `rtok_${UUID}` format (41 chars), so both buffers will always be the same length when comparing a submission's token against the request token.
2. **Auth middleware placement**: Apply auth middleware at the route-group level in `app.ts` using Hono's `app.use()` pattern, not inside individual route handlers.
3. **IntakeError split**: Create two new interfaces (`IntakeErrorEnvelope` and `IntakeErrorFlat`) and make `IntakeError` a discriminated union. The discriminant is the presence of `ok: false` (envelope) vs `type` at top level (flat).
4. **SubmissionState split**: Define `CoreSubmissionState` (11 states used by state machine) and keep `SubmissionState` as the full union for backward compatibility. Add `MCPSessionState` for MCP-only states.
5. **Rate limiter cleanup**: Piggyback cleanup on every Nth `check()` call rather than requiring external timer management.

---

## Implementation Plan

### Epic 1: Security Hardening (Critical)

---

#### Story 1.1: Timing-Safe Resume Token Comparison

**Priority:** Critical
**Estimated effort:** Small (1-2 hours)
**Files to modify:**
- `src/core/approval-manager.ts` (lines 131, 188, 246)
- `src/core/submission-manager.ts` (lines 204, 279, 334, 380)

**Current code pattern (approval-manager.ts line 131):**
```typescript
if (submission.resumeToken !== request.resumeToken) {
  throw new InvalidResumeTokenError();
}
```

**Required change:**

1. Add a `timingSafeTokenCompare` utility function to `src/core/errors.ts`:

```typescript
import { timingSafeEqual } from "node:crypto";

/**
 * Timing-safe comparison of two token strings.
 * Prevents timing attacks on bearer credentials.
 * Returns false if either token is empty/undefined.
 */
export function timingSafeTokenCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
```

2. Replace all `submission.resumeToken !== request.resumeToken` checks in both files with:

```typescript
import { timingSafeTokenCompare } from "./errors.js";

if (!timingSafeTokenCompare(submission.resumeToken, request.resumeToken)) {
  throw new InvalidResumeTokenError();
}
```

**Call sites to update (6 total):**

In `src/core/approval-manager.ts`:
- `approve()` method — line 131: `if (submission.resumeToken !== request.resumeToken)`
- `reject()` method — line 188: `if (submission.resumeToken !== request.resumeToken)`
- `requestChanges()` method — line 246: `if (submission.resumeToken !== request.resumeToken)`

In `src/core/submission-manager.ts`:
- `setFields()` method — line 204: `if (submission.resumeToken !== request.resumeToken)`
- `requestUpload()` method — line 279: `if (submission.resumeToken !== input.resumeToken)`
- `confirmUpload()` method — line 334: `if (submission.resumeToken !== input.resumeToken)`
- `submit()` method — line 380 (approx): `if (submission.resumeToken !== request.resumeToken)`

**Acceptance criteria:**
- **Given** two token strings of equal length, **When** compared via `timingSafeTokenCompare`, **Then** the comparison uses `crypto.timingSafeEqual` (not `===`)
- **Given** tokens of different lengths, **When** compared, **Then** returns `false` (no crash)
- **Given** an empty or undefined token, **When** compared, **Then** returns `false`
- All existing tests continue to pass (token comparison behavior unchanged for correct/incorrect tokens)

---

#### Story 1.2: Add Auth Middleware to Analytics and Webhook Routes

**Priority:** Critical
**Estimated effort:** Small (1 hour)
**Files to modify:**
- `src/app.ts` (route mounting section, around lines 295-305)

**Current code (app.ts ~line 295-305):**
```typescript
// Webhook routes
app.route('/', createHonoWebhookRouter(webhookManager));

// Analytics routes
app.route('/', createHonoAnalyticsRouter(analyticsProvider));
```

These routes are mounted with zero authentication. Analytics endpoints expose submission counts, state distributions, and recent events. The webhook retry endpoint allows re-triggering delivery without auth.

**Required change:**

Add authentication middleware before these route groups. The project already has `createAuthMiddleware` patterns. Apply middleware using Hono's `app.use()`:

```typescript
import { createAuthMiddleware } from './middleware/auth.js';

// Check if auth middleware module exists — if not, create a simple API key guard
// Apply auth to analytics routes
app.use('/analytics/*', createAuthMiddleware());

// Apply auth to webhook management routes
app.use('/webhooks/*', createAuthMiddleware());
```

If `createAuthMiddleware` doesn't exist yet, create `src/middleware/auth.ts`:

```typescript
import type { MiddlewareHandler } from 'hono';

/**
 * Simple API key authentication middleware.
 * Reads FORMBRIDGE_API_KEY from environment.
 * Returns 401 if missing/invalid.
 */
export function createAuthMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const apiKey = process.env['FORMBRIDGE_API_KEY'];
    if (!apiKey) {
      // No API key configured — allow access (dev mode)
      return next();
    }

    const authHeader = c.req.header('Authorization');
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;

    const queryKey = c.req.query('api_key');

    if (bearerToken !== apiKey && queryKey !== apiKey) {
      return c.json(
        { ok: false, error: { type: 'unauthorized', message: 'Valid API key required' } },
        401
      );
    }

    return next();
  };
}
```

**Acceptance criteria:**
- **Given** no `FORMBRIDGE_API_KEY` env var, **When** accessing `/analytics/summary`, **Then** request succeeds (dev mode)
- **Given** `FORMBRIDGE_API_KEY=test123`, **When** accessing `/analytics/summary` without auth, **Then** returns 401
- **Given** `FORMBRIDGE_API_KEY=test123`, **When** accessing `/analytics/summary` with `Authorization: Bearer test123`, **Then** returns 200
- **Given** `FORMBRIDGE_API_KEY=test123`, **When** POSTing `/webhooks/deliveries/:id/retry` without auth, **Then** returns 401
- Submission CRUD endpoints (`/intake/*`) remain unauthenticated (they use resumeToken auth)

---

#### Story 1.3: Validate intakeId Path Parameter in Submit Route

**Priority:** High
**Estimated effort:** Small (30 minutes)
**Files to modify:**
- `src/routes/hono-submissions.ts` (submit route handler, line ~155)

**Current code (hono-submissions.ts ~line 155):**
```typescript
router.post(
  "/intake/:intakeId/submissions/:submissionId/submit",
  async (c: Context) => {
    const submissionId = c.req.param("submissionId");
    // intakeId is extracted but NEVER USED
    const body = await c.req.json();
```

The `intakeId` from the URL is completely ignored. A submission from intake A can be submitted via `/intake/B/submissions/:id/submit`.

**Required change:**

After fetching the submission, validate that its intakeId matches the URL parameter:

```typescript
router.post(
  "/intake/:intakeId/submissions/:submissionId/submit",
  async (c: Context) => {
    const intakeId = c.req.param("intakeId");
    const submissionId = c.req.param("submissionId");

    const body = await c.req.json();

    if (!body.resumeToken) {
      return c.json(
        { ok: false, error: { type: "invalid_request", message: "resumeToken is required" } },
        400
      );
    }

    const actorResult = parseActor(body.actor);
    if (!actorResult.ok) {
      return c.json(
        { ok: false, error: { type: "invalid_request", message: actorResult.error } },
        400
      );
    }

    try {
      // Validate intakeId matches the submission before submitting
      const submission = await manager.getSubmission(submissionId);
      if (!submission) {
        return c.json(
          { ok: false, error: { type: "not_found", message: `Submission '${submissionId}' not found` } },
          404
        );
      }
      if (submission.intakeId !== intakeId) {
        return c.json(
          {
            ok: false,
            error: {
              type: "not_found",
              message: `Submission '${submissionId}' not found for intake '${intakeId}'`,
            },
          },
          404
        );
      }

      const result = await manager.submit({
        // ... rest unchanged
```

**Acceptance criteria:**
- **Given** submission `sub_1` belonging to intake `vendor_onboarding`, **When** submitting via `/intake/vendor_onboarding/submissions/sub_1/submit`, **Then** succeeds
- **Given** submission `sub_1` belonging to intake `vendor_onboarding`, **When** submitting via `/intake/wrong_intake/submissions/sub_1/submit`, **Then** returns 404 with "not found for intake" message
- Existing submit tests continue to pass

---

### Epic 2: Type System Cleanup (High)

---

#### Story 2.1: Split IntakeError into Discriminated Unions

**Priority:** High
**Estimated effort:** Medium (3-4 hours)
**Files to modify:**
- `src/types/intake-contract.ts` (IntakeError definition, lines 99-118)
- `src/mcp/response-builder.ts` (type guard, line ~65)
- `src/core/approval-manager.ts` (error construction)
- `src/core/submission-manager.ts` (error construction)

**Current code (intake-contract.ts lines 99-118):**
```typescript
export interface IntakeError {
  ok?: false;
  submissionId?: SubmissionId;
  state?: SubmissionState;
  resumeToken?: string;
  error?: { type: IntakeErrorType; message?: string; ... };
  /** Flat shape fields (used by MCP server and error mapper) */
  type?: IntakeErrorType | string;
  message?: string;
  fields?: FieldError[];
  nextActions?: NextAction[];
  timestamp?: string;
}
```

Everything is optional; both shapes coexist in one interface.

**Required change:**

Replace with discriminated union:

```typescript
/**
 * Structured error envelope used by HTTP API responses.
 * The `ok: false` discriminant distinguishes this from success responses.
 */
export interface IntakeErrorEnvelope {
  ok: false;
  submissionId?: SubmissionId;
  state?: SubmissionState;
  resumeToken?: string;
  error: {
    type: IntakeErrorType;
    message?: string;
    fields?: FieldError[];
    nextActions?: NextAction[];
    retryable: boolean;
    retryAfterMs?: number;
  };
}

/**
 * Flat error shape used by MCP server and error mappers.
 * Distinguished by having `type` at the top level (no `ok` field).
 */
export interface IntakeErrorFlat {
  type: IntakeErrorType | string;
  message: string;
  fields: FieldError[];
  nextActions: NextAction[];
  timestamp?: string;
}

/**
 * Union of all error shapes. Use type guards to distinguish.
 */
export type IntakeError = IntakeErrorEnvelope | IntakeErrorFlat;

/**
 * Type guard: is this the HTTP envelope shape?
 */
export function isEnvelopeError(error: IntakeError): error is IntakeErrorEnvelope {
  return 'ok' in error && error.ok === false;
}

/**
 * Type guard: is this the flat MCP shape?
 */
export function isFlatError(error: IntakeError): error is IntakeErrorFlat {
  return !('ok' in error) && 'type' in error && 'fields' in error;
}
```

Update `createIntakeError()` to return `IntakeErrorEnvelope` explicitly.

Update `isIntakeError()` type guard to use the new discriminated union.

Update `src/mcp/response-builder.ts` `isError()` to use `isFlatError()`.

Update all error construction sites in `approval-manager.ts` and `submission-manager.ts` — these already construct the envelope shape correctly, just need the return type annotation updated.

**Acceptance criteria:**
- **Given** an `IntakeErrorEnvelope`, **When** `isEnvelopeError()` is called, **Then** returns `true`
- **Given** an `IntakeErrorFlat`, **When** `isFlatError()` is called, **Then** returns `true`
- **Given** a success response, **When** `isIntakeError()` is called, **Then** returns `false`
- TypeScript compiler has zero errors after the change
- All existing tests pass without modification (runtime behavior unchanged)
- `createIntakeError()` returns `IntakeErrorEnvelope` (explicit type)

---

#### Story 2.2: Split SubmissionState into Core vs MCP States

**Priority:** High
**Estimated effort:** Small (1-2 hours)
**Files to modify:**
- `src/types/intake-contract.ts` (SubmissionState type, lines 31-51)

**Current code (intake-contract.ts lines 31-51):**
```typescript
export type SubmissionState =
  | "draft" | "in_progress" | "awaiting_input" | "awaiting_upload"
  | "submitted" | "needs_review" | "approved" | "rejected"
  | "finalized" | "cancelled" | "expired"
  // Upload negotiation protocol states
  | "created" | "validating" | "invalid" | "valid"
  | "uploading" | "submitting" | "completed" | "failed"
  | "pending_approval";
```

20+ states mixing core lifecycle with MCP-specific session states. The state machine in `state-machine.ts` only defines transitions for the first 11.

**Required change:**

```typescript
/**
 * Core submission lifecycle states — used by state machine and storage.
 * These are the only states that appear in VALID_TRANSITIONS.
 */
export type CoreSubmissionState =
  | "draft"
  | "in_progress"
  | "awaiting_input"
  | "awaiting_upload"
  | "submitted"
  | "needs_review"
  | "approved"
  | "rejected"
  | "finalized"
  | "cancelled"
  | "expired";

/**
 * MCP session states — used only by the MCP submission store.
 * These track the MCP tool call lifecycle, not the submission lifecycle.
 */
export type MCPSessionState =
  | "created"
  | "validating"
  | "invalid"
  | "valid"
  | "uploading"
  | "submitting"
  | "completed"
  | "failed"
  | "pending_approval";

/**
 * Full submission state union — backward-compatible.
 * Use CoreSubmissionState when you only need lifecycle states.
 */
export type SubmissionState = CoreSubmissionState | MCPSessionState;
```

Update the `SubmissionState` runtime const object to group them accordingly (no runtime change needed, just documentation).

**Acceptance criteria:**
- **Given** existing code that uses `SubmissionState`, **When** compiled, **Then** zero TypeScript errors (backward compatible)
- **Given** `CoreSubmissionState`, **When** used in state machine code, **Then** only the 11 lifecycle states are valid
- The state machine file (`state-machine.ts`) can optionally be typed with `CoreSubmissionState` for its map key/value types

---

#### Story 2.3: Rename MCP SubmissionStore to Avoid Name Collision

**Priority:** Medium
**Estimated effort:** Small (30 minutes)
**Files to modify:**
- `src/mcp/submission-store.ts` — rename `SubmissionStore` class to `MCPSessionStore`
- `src/mcp/server.ts` — update import
- `src/mcp/response-builder.ts` — update import and parameter types

**Current confusion:**
- `SubmissionStore` in `src/mcp/submission-store.ts` — MCP session store (keyed by resumeToken)
- `InMemorySubmissionStore` in `src/mcp/submission-store.ts` — implements `ISubmissionStore` for SubmissionManager
- `InMemorySubmissionStore` in `src/app.ts` — another submission store with analytics counters

**Required change:**
Rename `SubmissionStore` (the MCP session class) to `MCPSessionStore` in `src/mcp/submission-store.ts`. Update all imports.

**Acceptance criteria:**
- No class named `SubmissionStore` exists in `src/mcp/submission-store.ts`
- `MCPSessionStore` has identical API and behavior
- `src/mcp/server.ts` uses `MCPSessionStore`
- `src/mcp/response-builder.ts` uses `MCPSessionStore`
- All MCP tests pass

---

### Epic 3: Architecture Improvements (Medium)

---

#### Story 3.1: Extract Helper Classes from app.ts

**Priority:** Medium
**Estimated effort:** Medium (2-3 hours)
**Files to modify:**
- `src/app.ts` — remove class definitions
- `src/core/bridging-event-emitter.ts` — NEW FILE
- `src/core/expiry-scheduler.ts` — NEW FILE
- `src/core/webhook-notifier-impl.ts` — NEW FILE

**Current code:**
`src/app.ts` contains 4 classes inline:
1. `InMemorySubmissionStore` (lines ~85-195) — keep in app.ts for now (Story 3.2 addresses consolidation)
2. `BridgingEventEmitter` (lines ~200-215)
3. `WebhookNotifierImpl` (lines ~220-260)
4. `ExpiryScheduler` (lines ~265-290)

**Required change:**

Extract each class to its own file:

**`src/core/bridging-event-emitter.ts`:**
```typescript
import type { IntakeEvent } from "../types/intake-contract.js";

export interface EventListener {
  (event: IntakeEvent): Promise<void>;
}

/**
 * Fans out events to multiple listeners with error isolation.
 */
export class BridgingEventEmitter {
  private listeners: EventListener[] = [];

  addListener(listener: EventListener): void {
    this.listeners.push(listener);
  }

  async emit(event: IntakeEvent): Promise<void> {
    const results = await Promise.allSettled(
      this.listeners.map((fn) => fn(event))
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('[BridgingEventEmitter] Listener error:', result.reason);
      }
    }
  }
}
```

**`src/core/expiry-scheduler.ts`:**
```typescript
import type { SubmissionManager } from "./submission-manager.js";

export class ExpiryScheduler {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private manager: SubmissionManager,
    private intervalMs: number = 60_000
  ) {}

  start(): void { /* ... same code ... */ }
  stop(): void { /* ... same code ... */ }
}
```

**`src/core/webhook-notifier-impl.ts`:**
```typescript
import type { WebhookNotifier, ReviewerNotification } from "./approval-manager.js";
import type { WebhookManager } from "./webhook-manager.js";
import type { Submission } from "../submission-types.js";
import type { Destination } from "../types/intake-contract.js";
import { SubmissionId, IntakeId, ResumeToken } from "../types/branded.js";

export class WebhookNotifierImpl implements WebhookNotifier {
  constructor(
    private webhookManager: WebhookManager,
    private notificationUrl?: string
  ) {}

  async notifyReviewers(notification: ReviewerNotification): Promise<void> {
    // ... same code ...
  }
}
```

Update `src/app.ts` to import from new files.

**Acceptance criteria:**
- `src/app.ts` no longer contains class definitions for `BridgingEventEmitter`, `ExpiryScheduler`, or `WebhookNotifierImpl`
- Each extracted class is in its own file under `src/core/`
- All imports in `app.ts` resolve correctly
- All existing tests pass
- `app.ts` total line count drops by ~100 lines

---

#### Story 3.2: SubmissionManager Constructor Options Object

**Priority:** Medium
**Estimated effort:** Small (1-2 hours)
**Files to modify:**
- `src/core/submission-manager.ts` (constructor, line ~135)
- `src/app.ts` (SubmissionManager instantiation)
- Any test files that instantiate SubmissionManager

**Current code (submission-manager.ts line ~135):**
```typescript
constructor(
  private store: SubmissionStore,
  private _eventEmitter: EventEmitter,
  private intakeRegistry?: IntakeRegistry,
  private baseUrl: string = "http://localhost:3000",
  private storageBackend?: StorageBackend,
  eventStore?: EventStore
)
```

Six positional parameters, some optional.

**Required change:**

```typescript
export interface SubmissionManagerOptions {
  store: SubmissionStore;
  eventEmitter: EventEmitter;
  intakeRegistry?: IntakeRegistry;
  baseUrl?: string;
  storageBackend?: StorageBackend;
  eventStore?: EventStore;
}

export class SubmissionManager {
  private store: SubmissionStore;
  private eventEmitter: EventEmitter;  // renamed from _eventEmitter
  private intakeRegistry?: IntakeRegistry;
  private baseUrl: string;
  private storageBackend?: StorageBackend;
  private eventStore: EventStore;

  constructor(options: SubmissionManagerOptions) {
    this.store = options.store;
    this.eventEmitter = options.eventEmitter;
    this.intakeRegistry = options.intakeRegistry;
    this.baseUrl = options.baseUrl ?? "http://localhost:3000";
    this.storageBackend = options.storageBackend;
    this.eventStore = options.eventStore ?? new InMemoryEventStore();
  }
```

Update `src/app.ts`:
```typescript
const manager = new SubmissionManager({
  store,
  eventEmitter: emitter,
  intakeRegistry: registry,
  baseUrl: 'http://localhost:3000',
  eventStore,
});
```

Update all test files that instantiate SubmissionManager.

**Acceptance criteria:**
- Constructor accepts a single options object
- `_eventEmitter` renamed to `eventEmitter` (no underscore prefix for used fields)
- All 6 parameters accessible via options
- Defaults preserved (`baseUrl` defaults to localhost, `eventStore` defaults to InMemoryEventStore)
- All tests pass after updating instantiation sites

---

#### Story 3.3: Deduplicate ApprovalManager Validation Logic

**Priority:** Low
**Estimated effort:** Small (30 minutes)
**Files to modify:**
- `src/core/approval-manager.ts`

**Current code:**
The three methods `approve()`, `reject()`, and `requestChanges()` each contain identical blocks:
1. Get submission by ID (throw if not found)
2. Verify resume token (throw if mismatch)
3. Check state is `needs_review` (return error if not)

**Required change:**

Extract to a private helper:

```typescript
/**
 * Common pre-flight validation for review actions.
 * Fetches submission, verifies token, checks state.
 */
private async validateReviewRequest(
  submissionId: string,
  resumeToken: string
): Promise<Submission | IntakeError> {
  const submission = await this.store.get(submissionId);
  if (!submission) {
    throw new SubmissionNotFoundError(submissionId);
  }
  if (!timingSafeTokenCompare(submission.resumeToken, resumeToken)) {
    throw new InvalidResumeTokenError();
  }
  if (submission.state !== "needs_review") {
    return {
      ok: false,
      submissionId: submission.id,
      state: submission.state,
      resumeToken: submission.resumeToken,
      error: {
        type: "conflict",
        message: `Cannot perform review action on submission in state '${submission.state}'`,
        retryable: false,
      },
    };
  }
  return submission;
}
```

Then each method calls:
```typescript
const result = await this.validateReviewRequest(request.submissionId, request.resumeToken);
if ('ok' in result && result.ok === false) return result;
const submission = result as Submission;
```

**Acceptance criteria:**
- Duplicate validation blocks removed from approve/reject/requestChanges
- Single `validateReviewRequest` method handles all three
- Behavior unchanged
- All approval tests pass

---

### Epic 4: Performance Fixes (Medium)

---

#### Story 4.1: Rate Limiter Automatic Cleanup

**Priority:** High
**Estimated effort:** Small (30 minutes)
**Files to modify:**
- `src/auth/rate-limiter.ts`

**Current code:**
The `windows` Map grows without bound. `cleanup()` exists but is never called automatically.

**Required change:**

Add automatic cleanup piggybacked on `check()`:

```typescript
export class RateLimiter {
  private readonly config: RateLimitConfig;
  private readonly windows: Map<string, number[]> = new Map();
  private checkCount = 0;
  private readonly cleanupEvery: number;

  constructor(config: RateLimitConfig, cleanupEvery = 100) {
    this.config = config;
    this.cleanupEvery = cleanupEvery;
  }

  check(key: string): RateLimitResult {
    // Periodic cleanup to prevent unbounded growth
    this.checkCount++;
    if (this.checkCount >= this.cleanupEvery) {
      this.checkCount = 0;
      this.cleanup();
    }

    // ... rest unchanged
  }
```

**Acceptance criteria:**
- **Given** 100 `check()` calls, **When** the 100th call executes, **Then** `cleanup()` is invoked automatically
- **Given** a rate limiter with expired entries, **When** cleanup runs, **Then** entries with no active timestamps are removed from the Map
- Memory usage stabilizes under sustained load (no unbounded growth)
- Existing rate limiter tests pass

---

#### Story 4.2: Single-Query Pagination for Event Routes

**Priority:** Medium
**Estimated effort:** Medium (2-3 hours)
**Files to modify:**
- `src/routes/hono-events.ts` (GET handler, lines ~100-130)
- `src/core/event-store.ts` (EventStore interface + InMemoryEventStore)
- `src/storage/sqlite-storage.ts` (SQLite event store implementation)

**Current code (hono-events.ts ~lines 100-120):**
```typescript
// Get total count (without pagination) for metadata
const allEvents = await manager.getEvents(submissionId, contentFilters);
const total = allEvents.length;

// Get paginated results
const events = await manager.getEvents(submissionId, paginatedFilters);
```

Two full queries per request.

**Required change:**

1. Add a `countEvents` method to the `EventStore` interface:

```typescript
interface EventStore {
  // existing methods...

  /**
   * Count events matching filters (without fetching data).
   * Used for pagination metadata.
   */
  countEvents(submissionId: string, filters?: EventFilters): Promise<number>;
}
```

2. Implement in `InMemoryEventStore`:
```typescript
async countEvents(submissionId: string, filters?: EventFilters): Promise<number> {
  const events = this.eventsBySubmission.get(submissionId) ?? [];
  if (!filters) return events.length;
  // Apply content filters (same as getEvents) but just count
  return events.filter(/* same filter logic */).length;
}
```

3. Implement in SQLite storage:
```typescript
async countEvents(submissionId: string, filters?: EventFilters): Promise<number> {
  // SELECT COUNT(*) FROM events WHERE ... (single efficient query)
}
```

4. Add `countEvents` to `SubmissionManager`:
```typescript
async countEvents(submissionId: string, filters?: EventFilters): Promise<number> {
  const submission = await this.store.get(submissionId);
  if (!submission) throw new SubmissionNotFoundError(submissionId);
  return this.eventStore.countEvents(submissionId, filters);
}
```

5. Update the route handler:
```typescript
const [events, total] = await Promise.all([
  manager.getEvents(submissionId, paginatedFilters),
  manager.countEvents(submissionId, contentFilters),
]);
```

**Acceptance criteria:**
- Event list endpoint makes exactly 2 queries (count + paginated) that can run in parallel, instead of 2 sequential full-data queries
- For SQLite, `countEvents` uses `SELECT COUNT(*)` not `SELECT *`
- Pagination metadata (`total`, `hasMore`) remains accurate
- All event route tests pass

---

#### Story 4.3: Validator Schema Cache via WeakMap

**Priority:** Low
**Estimated effort:** Small (1 hour)
**Files to modify:**
- `src/core/validator.ts` (getCompiledSchema/getSchemaKey, lines ~260-280)

**Current code:**
```typescript
private getSchemaKey(schema: JSONSchema): string {
  if (schema.$id) return schema.$id;
  return JSON.stringify(schema);
}
```

`JSON.stringify` on every validation for schemas without `$id`.

**Required change:**

Add a `WeakMap` as a first-level cache:

```typescript
private readonly weakCache = new WeakMap<object, ValidateFunction>();

private getCompiledSchema(schema: JSONSchema): ValidateFunction {
  // Fast path: same object reference
  const weakCached = this.weakCache.get(schema);
  if (weakCached) return weakCached;

  // Slow path: string key lookup
  const schemaKey = this.getSchemaKey(schema);
  let validate = this.compiledSchemas.get(schemaKey);
  if (!validate) {
    validate = this.ajv.compile(schema);
    this.compiledSchemas.set(schemaKey, validate);
  }

  // Cache by reference for next time
  this.weakCache.set(schema, validate);
  return validate;
}
```

**Acceptance criteria:**
- **Given** the same schema object reference, **When** `validate()` is called twice, **Then** `JSON.stringify` is called only once (WeakMap hits on second call)
- **Given** two different schema objects with identical content, **When** validated, **Then** both get the same compiled function via string key fallback
- All validator tests pass

---

#### Story 4.4: Fix SQLite LIMIT/OFFSET Construction

**Priority:** Medium
**Estimated effort:** Small (1 hour)
**Files to modify:**
- `src/storage/sqlite-storage.ts` (lines ~375-390)

**Current code:**
```typescript
if (filters?.offset) {
  sql += ` OFFSET ${filters.offset}`;
}
if (filters?.limit !== undefined) {
  // Need to add LIMIT before OFFSET for proper SQL
  const limitClause = ` LIMIT ${filters.limit}`;
  if (filters?.offset) {
    sql = `SELECT * FROM events ${whereStr} ORDER BY ts ASC LIMIT ${filters.limit} OFFSET ${filters.offset}`;
  } else {
    sql += limitClause;
  }
}
```

String concatenation with fragile reconstruction. `OFFSET` without `LIMIT` is invalid SQL.

**Required change:**

Replace with clean construction:

```typescript
// Always build LIMIT/OFFSET together at the end
if (filters?.limit !== undefined) {
  sql += ` LIMIT ?`;
  params.push(filters.limit);
  if (filters?.offset) {
    sql += ` OFFSET ?`;
    params.push(filters.offset);
  }
} else if (filters?.offset) {
  // OFFSET requires LIMIT in SQLite — use -1 for unlimited
  sql += ` LIMIT -1 OFFSET ?`;
  params.push(filters.offset);
}
```

Note: Uses parameterized queries instead of string interpolation.

**Acceptance criteria:**
- **Given** `limit=10, offset=5`, **When** query executes, **Then** SQL is `... LIMIT ? OFFSET ?` with params `[10, 5]`
- **Given** `offset=5` without limit, **When** query executes, **Then** SQL is `... LIMIT -1 OFFSET ?` with params `[5]`
- **Given** `limit=10` without offset, **When** query executes, **Then** SQL is `... LIMIT ?` with params `[10]`
- No string interpolation of filter values in SQL
- SQLite event query tests pass

---

### Epic 5: Quick Wins (Low effort, high value)

---

#### Story 5.1: Remove Stale .d.ts Files

**Priority:** Low
**Estimated effort:** Trivial (5 minutes)
**Files to delete:**
- `src/types/intake-contract.d.ts`
- `src/core/step-validator.d.ts`
- `src/core/condition-evaluator.d.ts`
- `src/submission-types.d.ts`

These `.d.ts` files exist alongside their `.ts` counterparts. They are likely stale build artifacts that could shadow the actual TypeScript source.

**Required change:**
Delete all 4 files.

**Acceptance criteria:**
- Files deleted
- `npx tsc --noEmit` still has zero errors
- All tests pass

---

#### Story 5.2: Move test-server.ts Out of src/

**Priority:** Low
**Estimated effort:** Trivial (10 minutes)
**Files to modify:**
- Move `src/test-server.ts` → `test/test-server.ts` (or `scripts/test-server.ts`)
- Update any imports referencing it

**Acceptance criteria:**
- `src/test-server.ts` no longer exists
- File is accessible from its new location
- If any test imports it, the import path is updated

---

#### Story 5.3: Log Swallowed Errors in Webhook processDelivery

**Priority:** Medium
**Estimated effort:** Trivial (5 minutes)
**Files to modify:**
- `src/core/webhook-manager.ts` (line ~254)

**Current code:**
```typescript
this.processDelivery(record, submission, destination).catch(() => {
  // Errors are tracked in the delivery record
});
```

Silently swallows all errors.

**Required change:**
```typescript
this.processDelivery(record, submission, destination).catch((err) => {
  console.error('[WebhookManager] processDelivery error:', err);
});
```

Also fix the retry scheduler's similar pattern (line ~390):
```typescript
this.processDelivery(record, submission, destination).catch((err) => {
  console.error('[WebhookManager] Retry delivery error:', err);
});
```

**Acceptance criteria:**
- Delivery errors are logged to console.error
- No silent swallowing of exceptions
- Delivery record tracking behavior unchanged

---

#### Story 5.4: Fix ESM Imports in Schema Normalizer

**Priority:** Low
**Estimated effort:** Small (30 minutes)
**Files to modify:**
- `packages/schema-normalizer/src/index.ts`

**Current code:**
```typescript
export function createJSONSchemaParser(options?) {
  const { JSONSchemaParser } = require('./parsers/json-schema-parser');
  return new JSONSchemaParser(options);
}
```

Uses CommonJS `require()` in what should be ESM.

**Required change:**

Option A (preferred): Remove factory functions entirely since the classes are already exported:
```typescript
// Remove createJSONSchemaParser, createZodParser, createOpenAPIParser, createJSONSchemaSerializer
// They're redundant — classes are already exported above
```

Option B: Convert to dynamic imports if factories are desired:
```typescript
export async function createJSONSchemaParser(options?: ParserOptions) {
  const { JSONSchemaParser } = await import('./parsers/json-schema-parser');
  return new JSONSchemaParser(options);
}
```

Note: Option B changes the return type to `Promise<JSONSchemaParser>`, which may break callers. Option A is safer.

**Acceptance criteria:**
- No `require()` calls in the schema-normalizer package
- If factories are removed, all references to them are updated or removed
- Package builds and tests pass

---

#### Story 5.5: Consistent HTTP Status for InvalidResumeTokenError in Approvals

**Priority:** Low
**Estimated effort:** Trivial (5 minutes)
**Files to modify:**
- `src/routes/hono-approvals.ts` (3 catch blocks)

**Current code:**
```typescript
if (error instanceof InvalidResumeTokenError) {
  return c.json(
    { ok: false, error: { type: "invalid_resume_token", message: error.message } },
    403  // ← Returns 403
  );
}
```

The submission routes return 409 for token errors. Approvals return 403. Inconsistent.

**Required change:**
Change all 3 occurrences of `403` to `409` in the InvalidResumeTokenError catch blocks.

**Acceptance criteria:**
- All 3 approval endpoints return 409 for invalid resume token (not 403)
- Matches the pattern in `hono-submissions.ts`
- Approval tests updated if they assert on 403

---

#### Story 5.6: Add fields.updated to Zod Event Type Enum

**Priority:** Low
**Estimated effort:** Trivial (5 minutes)
**Files to modify:**
- `src/routes/hono-events.ts` (Zod enum, line ~35)

**Current code:**
```typescript
const eventTypeEnum = z.enum([
  "submission.created",
  "field.updated",
  "validation.passed",
  // ...
]);
```

The `VALID_EVENT_TYPES` Set includes `"fields.updated"` but the Zod enum does not. The Set also includes `"step.started"`, `"step.completed"`, `"step.validation_failed"` that the Zod enum is missing.

**Required change:**
Add missing event types to the Zod enum:
```typescript
const eventTypeEnum = z.enum([
  "submission.created",
  "field.updated",
  "fields.updated",  // ADD
  // ... existing entries ...
  "step.started",           // ADD
  "step.completed",         // ADD
  "step.validation_failed", // ADD
]);
```

**Acceptance criteria:**
- Zod enum contains all event types that `VALID_EVENT_TYPES` Set contains
- No inconsistency between the two validation mechanisms
- Event filtering tests pass with `fields.updated` type filter

---

#### Story 5.7: Event Store — Clone Event Before Mutating Version

**Priority:** Low
**Estimated effort:** Trivial (10 minutes)
**Files to modify:**
- `src/core/event-store.ts` (InMemoryEventStore.appendEvent, line ~148)

**Current code:**
```typescript
event.version = nextVersion;
```

Mutates the input event object. Events should be immutable after creation.

**Required change:**
```typescript
async appendEvent(event: IntakeEvent): Promise<void> {
  // ... validation ...

  // Clone event to avoid mutating the caller's object
  const storedEvent: IntakeEvent = { ...event, version: nextVersion };

  // Use storedEvent instead of event for all subsequent operations
  this.eventIds.add(storedEvent.eventId);
  // ... rest uses storedEvent
```

**Acceptance criteria:**
- Original event object passed to `appendEvent()` is not modified
- Stored event has the correct version number
- All event store tests pass

---

## Additional Context

### Dependencies

No new npm packages required. All changes use existing dependencies:
- `node:crypto` (already used by webhook-manager)
- `hono` middleware patterns (already used)
- `zod` (already used)

### Testing Strategy

1. **Unit tests**: Each story should update or add tests in the corresponding test file
2. **Integration tests**: After Epic 1 (security), run the full test suite to verify no regressions
3. **Manual smoke test**: After all stories, start the server and verify:
   - Health endpoint works
   - Can create/submit a submission
   - Analytics returns 401 without API key (when configured)
   - Webhook retry returns 401 without API key (when configured)

### Implementation Order

Execute stories in this order for safety (dependencies respected):

1. **Story 5.1** — Remove stale .d.ts (zero risk, cleans workspace)
2. **Story 5.2** — Move test-server.ts (zero risk)
3. **Story 1.1** — Timing-safe tokens (critical security, no API change)
4. **Story 1.2** — Auth middleware (critical security, additive)
5. **Story 1.3** — intakeId validation (high security, additive)
6. **Story 5.3** — Log webhook errors (trivial, improves observability)
7. **Story 5.5** — Consistent 403→409 (trivial, consistency fix)
8. **Story 5.6** — Zod enum sync (trivial, consistency fix)
9. **Story 5.7** — Event clone (trivial, correctness fix)
10. **Story 4.1** — Rate limiter cleanup (small, prevents memory leak)
11. **Story 2.1** — Split IntakeError (type-only change, backward compatible)
12. **Story 2.2** — Split SubmissionState (type-only change, backward compatible)
13. **Story 2.3** — Rename MCPSessionStore (simple rename)
14. **Story 3.1** — Extract classes from app.ts (refactor, no behavior change)
15. **Story 3.2** — Options object for SubmissionManager (refactor)
16. **Story 3.3** — Deduplicate approval validation (refactor)
17. **Story 4.2** — Single-query pagination (new interface method)
18. **Story 4.3** — WeakMap schema cache (optimization)
19. **Story 4.4** — SQLite LIMIT/OFFSET fix (bug fix)
20. **Story 5.4** — ESM imports in schema-normalizer (package fix)

### Notes

- **The `as unknown as` cast in `src/mcp/server.ts` line 67** is a symptom of the dual IntakeDefinition types. After Story 2.1 stabilizes IntakeError, a follow-up story should unify IntakeDefinition types between `schemas/intake-schema.ts` and `types/intake-contract.ts`. This is tracked as future work, not in this sprint.
- **The three in-memory stores consolidation** is partially addressed by Story 2.3 (rename) and Story 3.1 (extract). Full consolidation where `InMemorySubmissionStore` in `app.ts` wraps `InMemorySubmissionStorage` from `memory-storage.ts` is deferred — it requires careful analysis of the analytics counter logic.
- **The `Result<T, E>` pattern** for SubmissionManager error handling (review section 6.3) is deferred. It would require changing every caller of setFields/submit, which is too invasive for a remediation sprint.
