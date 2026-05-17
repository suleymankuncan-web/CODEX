# API Failure Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe frontend API failure diagnostics so future reliability fixes start from endpoint-level evidence.

**Architecture:** Add a focused diagnostics helper under `admin-web/src/lib` that sanitizes and emits failed-request evidence through console, a browser event, and a small ring buffer. Wire the existing `api.ts` request boundary so JSON and form-data requests emit diagnostics on HTTP, network, and non-JSON failures without changing user-facing behavior.

**Tech Stack:** React/Vite admin web, TypeScript, shared `fetch` API helper, Playwright E2E.

---

## File Structure

- Modify: `docs/superpowers/specs/2026-05-17-api-failure-diagnostics-design.md`
  - Clarify that route query values are sanitized, not logged raw.
- Create: `admin-web/src/lib/api-diagnostics.ts`
  - Owns event type, sanitization, retryability classification, and browser emission.
- Modify: `admin-web/src/lib/api.ts`
  - Measures API attempts and calls diagnostics helper before throwing failures.
- Create: `admin-web/e2e/api-diagnostics.spec.ts`
  - Proves a failed API request emits sanitized diagnostics and a successful request does not.

---

### Task 1: Tighten Spec Privacy Wording

**Files:**
- Modify: `docs/superpowers/specs/2026-05-17-api-failure-diagnostics-design.md`

- [x] **Step 1: Update route field wording**

Change the `route` field note to:

```markdown
- `route` is the current browser pathname plus query parameter names only; query values are replaced so deep-link values do not leak.
```

- [x] **Step 2: Confirm no placeholder text**

Run:

```powershell
rg "TBD|TODO|FIXME|\?\?\?" docs/superpowers/specs/2026-05-17-api-failure-diagnostics-design.md
```

Expected: no matches.

---

### Task 2: Add Diagnostics Helper

**Files:**
- Create: `admin-web/src/lib/api-diagnostics.ts`

- [x] **Step 1: Create event type and helper functions**

Create `admin-web/src/lib/api-diagnostics.ts` with:

```ts
export type ApiFailureCategory = 'http' | 'network' | 'non_json' | 'unknown'

export type ApiFailureDiagnostic = {
  event: 'api.failure'
  route: string
  method: string
  path: string
  queryKeys: string[]
  status: number | null
  durationMs: number
  retryable: boolean
  requestAttempt: number
  errorCategory: ApiFailureCategory
  errorMessage: string
  requestId: string | null
  occurredAt: string
}
```

Add sanitizers:

```ts
function sanitizePathname(pathname: string) {
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, ':uuid')
    .replace(/\b\d{6,}\b/g, ':id')
}
```

- [x] **Step 2: Add browser ring buffer and event emission**

Expose `emitApiFailureDiagnostic(input)` that:

- builds a serializable `ApiFailureDiagnostic`
- logs `console.warn('[store-ops:api-failure]', event)`
- dispatches `new CustomEvent('store-ops-api-failure', { detail: event })`
- stores the last 20 events in `window.__STORE_OPS_API_FAILURES__`

The helper must no-op safely when `window` is unavailable.

---

### Task 3: Wire API Client Failures

**Files:**
- Modify: `admin-web/src/lib/api.ts`

- [x] **Step 1: Import diagnostics helper**

Add:

```ts
import { emitApiFailureDiagnostic, getRequestIdFromHeaders } from './api-diagnostics'
```

- [x] **Step 2: Add fetch attempt measurement**

Add a small internal helper:

```ts
async function performFetchAttempt(
  path: string,
  input: RequestInit & { method: JsonMethod },
  requestAttempt: number,
) {
  const startedAt = nowMs()
  try {
    const response = await fetch(`${resolveApiBaseUrl()}${path}`, input)
    return {
      response,
      durationMs: Math.max(0, Math.round(nowMs() - startedAt)),
      requestAttempt,
    }
  } catch (error) {
    emitApiFailureDiagnostic({
      path,
      method: input.method,
      status: null,
      durationMs: Math.max(0, Math.round(nowMs() - startedAt)),
      requestAttempt,
      errorCategory: 'network',
      errorMessage: error instanceof Error ? error.message : 'Network request failed',
      requestId: null,
    })
    throw error
  }
}
```

- [x] **Step 3: Emit diagnostics before HTTP and non-JSON throws**

Pass the attempt context into `throwApiError` and `parseJsonResponse`. `throwApiError` emits with `errorCategory: 'http'`; `parseJsonResponse` emits with `errorCategory: 'non_json'`.

- [x] **Step 4: Preserve behavior**

Keep 401 session-expired dispatch, bearer refresh retry, thrown `ApiError` messages, and returned JSON behavior unchanged.

---

### Task 4: Add Playwright Coverage

**Files:**
- Create: `admin-web/e2e/api-diagnostics.spec.ts`

- [x] **Step 1: Write failure diagnostic test**

Add a test that:

- seeds a mock store session
- routes `/api/auth/session` successfully
- routes `/api/feed?limit=50&offset=0` with status 503 and `x-request-id: req-feed-503`
- opens `/store/feed?result=secret-value`
- waits for `window.__STORE_OPS_API_FAILURES__`
- asserts the event has `status: 503`, `retryable: true`, `requestId: 'req-feed-503'`, `path: '/feed'`, `queryKeys: ['limit', 'offset']`
- asserts serialized diagnostics do not include `secret-value`, `Authorization`, or a seeded request body string

- [x] **Step 2: Write success no-op test**

Add a test that routes the same page successfully and asserts:

```ts
await expect
  .poll(() => page.evaluate(() => window.__STORE_OPS_API_FAILURES__?.length ?? 0))
  .toBe(0)
```

---

### Task 5: Verify And Commit

**Files:**
- All files touched above.

- [x] **Step 1: Run focused E2E**

Run:

```powershell
npm.cmd --prefix admin-web run test:e2e -- api-diagnostics.spec.ts
```

Expected: all tests pass.

- [x] **Step 2: Run lint and build**

Run:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
```

Expected: both pass.

- [x] **Step 3: Run diff check**

Run:

```powershell
git diff --check -- admin-web/src/lib/api.ts admin-web/src/lib/api-diagnostics.ts admin-web/e2e/api-diagnostics.spec.ts docs/superpowers/specs/2026-05-17-api-failure-diagnostics-design.md docs/superpowers/plans/2026-05-17-api-failure-diagnostics.md
```

Expected: no whitespace errors.

- [x] **Step 4: Commit**

Run:

```powershell
git add -- admin-web/src/lib/api.ts admin-web/src/lib/api-diagnostics.ts admin-web/e2e/api-diagnostics.spec.ts docs/superpowers/specs/2026-05-17-api-failure-diagnostics-design.md docs/superpowers/plans/2026-05-17-api-failure-diagnostics.md
git commit -m "Add API failure diagnostics"
```

Expected: commit succeeds with only the intended files staged.

---

## Self-Review

- The plan covers all spec goals: sanitized event, emission sinks, API integration, privacy, and tests.
- No backend or UI retry behavior is included.
- `requestAttempt` is explicitly API-helper attempt count, not React Query failure count.
- Playwright is used instead of adding a new unit-test framework.
