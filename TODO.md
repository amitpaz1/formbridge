# FormBridge TODO

*Last updated: 2026-01-31*

Current state: All 23 features implemented. 638 tests passing. Core engine solid.
Focus: Fix bugs, polish for public release, publish to npm.

---

## 🔴 Bugs (Fix Before Release)

### 1. Idempotency broken in app factory
- **What:** `createFormBridgeAppWithIntakes()` doesn't wire up the idempotency store. Sending the same `Idempotency-Key` twice returns two different submissions instead of replaying the first.
- **Where:** `src/app.ts` — the `InMemorySubmissionStore.getByIdempotencyKey()` exists but the submission route likely doesn't call it during creation.
- **Impact:** Core feature (008) broken at the integration level. Unit tests pass because they wire it up manually.
- **Fix:** Trace the submission creation flow in `createFormBridgeAppWithIntakes` → ensure idempotency key is checked before creating a new submission.

### 2. CLI scaffolding ignores command-line arguments
- **What:** `npx @formbridge/create --name my-project --schema zod` ignores all flags and enters interactive mode.
- **Where:** `packages/create-formbridge/src/index.ts` — likely calls `prompts()` unconditionally without checking `parseArgs()` first.
- **Impact:** Non-interactive mode doesn't work. Blocks CI usage and scripted scaffolding.
- **Fix:** Check if sufficient args are provided via `parseArgs()`, skip prompts if so.

### 3. Resume token lookup returns 404 after PATCH
- **What:** After updating a submission (PATCH), the resume token rotates. The `/submissions/resume/:token` endpoint can't find submissions by the new token.
- **Where:** `src/routes/hono-submissions.ts` → `GET /submissions/resume/:resumeToken` and how SubmissionManager stores/indexes tokens.
- **Impact:** Agent-to-human handoff flow breaks if the agent updates fields before generating the handoff URL.
- **Verify:** May be a test artifact (using old token). Confirm by testing: create → patch → lookup with NEW token.

### 4. ESLint remaining errors (11)
- **What:** 4 unused variables, 6 `require()` imports in error-handler.ts, 1 unused import.
- **Where:** `src/middleware/error-handler.ts` (most), `src/core/intake-registry.ts`, `src/storage/sqlite-storage.ts`
- **Impact:** Low. Warnings, not blocking. But CI should pass clean.
- **Fix:** Remove unused vars, convert `require()` to dynamic `import()`.

---

## 🟡 Polish (Before Public Release)

### 5. Add LICENSE file
- **What:** No LICENSE file exists. package.json says MIT but there's no actual license file.
- **Fix:** Add standard MIT LICENSE file with Amit's name and 2026 year.

### 6. Add `repository` and `homepage` to package.json
- **What:** Root package.json missing `repository`, `homepage`, and `bugs` fields.
- **Fix:** Add GitHub repo URL, set homepage to docs site or GitHub.

### 7. README needs updating
- **What:** README exists (581 lines) and is decent, but:
  - References `@formbridge/mcp-server-sdk` (wrong package name — actual is `@formbridge/mcp-server`)
  - npm badge links to a package that doesn't exist yet
  - No quickstart for the HTTP API (only MCP)
  - No mention of the React form renderer, admin dashboard, or CLI tool
- **Fix:** Rewrite to cover all packages, correct package names, add HTTP API quickstart alongside MCP.

### 8. Demo app type warnings
- **What:** Vite build shows warnings: `IntakeSchema`, `FormData`, `Actor`, `UseFormSubmissionReturn`, `FormSubmissionState`, `SubmissionError`, `IntakeError` not exported from form-renderer types.
- **Where:** `packages/form-renderer/src/types.ts` and `packages/form-renderer/src/types/error.ts`
- **Impact:** Demo builds but with warnings. Types exist in the codebase but aren't re-exported from the package entry point.
- **Fix:** Add missing type exports to `packages/form-renderer/src/index.ts`.

### 9. Dual event emission on field update
- **What:** When PATCHing 4 fields at once, 4 separate `field.updated` events are emitted (one per field), each containing the FULL diffs array of all 4 changes. Should either emit 1 batch event or 4 events with individual diffs.
- **Where:** `src/core/submission-manager.ts` — field update logic.
- **Impact:** Event stream is noisy and redundant. Audit trail works but is wasteful.
- **Fix:** Emit one `fields.updated` batch event, or have each `field.updated` event contain only its own diff.

---

## 🟢 Build & Publish Pipeline

### 10. Build all packages
- **What:** Only root `src/` builds with `tsc`. Individual packages (`form-renderer`, `schema-normalizer`, `templates`, `create-formbridge`, `admin-dashboard`) don't build — no `dist/` directories.
- **Fix:** Add a root script `build:packages` that builds each package. Consider using `tsup` or `unbuild` for proper ESM/CJS dual output with bundled deps.
- **Blocked by:** Each package needs its own tsconfig and build config.

### 11. Set up npm publishing
- **What:** Changesets configured (`access: "public"`) but never tested. No npm auth, no provenance, no publish scripts.
- **Steps:**
  1. Register `@formbridge` scope on npm (or use `formbridge-sdk` if taken)
  2. Add `NPM_TOKEN` to GitHub secrets
  3. Test `npx changeset` → `npx changeset version` → `npm publish` locally first
  4. Enable provenance attestation in release.yml
- **Priority:** This is the gateway to users.

### 12. CI pipeline needs lint step
- **What:** CI runs `typecheck` and `test` but NOT `eslint`. Also doesn't build packages.
- **Fix:** Add `npm run lint` step to ci.yml. Add package builds to the build job.

---

## 🔵 Test Coverage Gaps

### 13. Increase coverage for critical modules
Current coverage gaps (0-50%):
| Module | Coverage | Priority |
|--------|----------|----------|
| `src/core/validator.ts` | 0% | HIGH — core validation logic |
| `src/storage/s3-storage.ts` | 0% | LOW — needs S3 mock |
| `src/storage/sqlite-storage.ts` | 27% | MEDIUM — production storage |
| `src/middleware/error-handler.ts` | 42% | MEDIUM — error responses |
| `src/mcp/server.ts` | 57% | MEDIUM — MCP server |
| `src/routes/hono-webhooks.ts` | 12% | LOW — webhook routes |

**Target:** 80%+ overall (currently 69.5%).

---

## 🟣 Future Enhancements (Post-Release)

### 14. Make repo public
- **When:** After bugs fixed, README polished, LICENSE added, first npm publish.
- **Checklist:** Remove any hardcoded secrets/URLs, review git history for sensitive data.

### 15. Landing page / docs site
- **What:** VitePress docs site exists in `docs-site/` but isn't deployed.
- **Fix:** Deploy to GitHub Pages or Vercel. Add CNAME if desired.

### 16. Real-world integration test
- **What:** Set up an end-to-end test: start server → MCP agent submits → human completes via form → webhook fires.
- **Why:** Current tests are unit/integration but don't test the full agent→human→webhook flow with real HTTP calls.

### 17. PostgreSQL storage backend
- **What:** Only in-memory and SQLite exist. PostgreSQL is needed for production hosted tier.
- **Where:** `src/storage/` — implement `StorageBackend` interface.

### 18. npm scope ownership
- **What:** Need to register `@formbridge` org on npm before someone else does.
- **Action:** `npm org create formbridge` or publish under personal scope first.

---

## Priority Order

**This weekend:**
1. Fix idempotency bug (#1)
2. Fix CLI arg parsing (#2)
3. Verify resume token lookup (#3)
4. Add LICENSE (#5)
5. Fix package.json meta (#6)

**Next week:**
6. Clean ESLint errors (#4)
7. Fix form-renderer type exports (#8)
8. Update README (#7)
9. Build all packages (#10)
10. Set up npm publishing (#11)

**Before public release:**
11. Fix event duplication (#9)
12. Bump test coverage (#13)
13. Fix CI pipeline (#12)
14. Make repo public (#14)
15. Deploy docs (#15)
