# System Flow And Bottleneck Readiness V1

## Reader And Action

Reader:

- A future engineer or agent using the generated system-flow map to decide
  where API pressure, authorization drift, telemetry, and Clerk evidence work
  should go next.

After reading, they should be able to:

- avoid treating the generated flow map as live telemetry,
- classify missing route/API/endpoint links without guessing,
- choose the next safe PR in the seven-milestone line,
- preserve the existing API/auth/DB behavior while improving evidence.

## Sokrates Decision

Claim:

- The generated system-flow map is useful enough to drive risk work, but only
  after false route fanout is reduced and the remaining signals are classified.

Assumptions:

- Source-derived flow is a dependency map, not request volume.
- Bottleneck candidates must be promoted to runtime evidence only after the
  static map stops over-counting route preloader and type/import noise.
- Clerk persona evidence remains the final live-input milestone, not a local
  mock replacement.

Repo evidence:

- `docs/flows/store-ops-system-flow.json` now has complete frontend API to
  backend/OpenAPI matching: 130 frontend API calls, 130 matched calls, and 0
  unmatched calls.
- After precision fixes, route/API edges dropped from the noisy 793 baseline
  to 193 static page edges.
- `/auth/login` maps only to `GET /api/auth/bootstrap`.
- `/admin/session` maps to `GET /api/auth/session` through
  `SessionReadinessPage`.
- Backend/OpenAPI count remains aligned at 164 endpoints.

Counterargument:

- A static map still cannot prove latency, request count, query cost, provider
  behavior, or queue pressure. It should inform telemetry placement, not replace
  telemetry.

Risk:

- LOW for generator/docs/evidence work.
- MEDIUM for frontend read-only telemetry UI work.
- HIGH for auth semantics, provider config, DB migrations, queue behavior,
  alert routing, or real Clerk/session evidence.

Door:

- The map, classifications, and docs are two-way doors.
- Provider configuration, real token handling, DB restore drills, and broad
  production decisions remain near-one-way doors.

Stop rule:

- Stop if a slice starts changing business logic, API response shape,
  auth/permission semantics, DB schema, provider config, queue behavior, KPI
  scoring, or user workflow semantics.

## Seven Milestones

### 1. System Flow Precision Fix

Goal:

- Make route/API edges represent static page reachability instead of route
  registry fanout.

Already targeted in this line:

- Do not traverse dynamic route preload registries when calculating a page's
  reachable API calls.
- Skip type-only relative imports in route reachability.
- Correct exported API wrapper function range detection when parameters contain
  TypeScript object types.
- Resolve simple local route wrappers such as `SessionGate` to the page they
  render when that page is imported through the route loader map.

Verification:

- `npm.cmd run system-flow:generate`.
- `node --test scripts/system-flow-generator-contract.test.mjs`.

### 2. Unlinked Endpoint Classification

Goal:

- Classify the 34 backend endpoints that do not currently have a frontend API
  edge in the source map.

Allowed classifications:

- intentional external-only,
- mobile-only,
- scheduled/cron/provider,
- admin-only,
- missing UI,
- dead/legacy candidate,
- future placeholder,
- needs evidence.

Current highest-count domains:

- integrations: 14,
- mobile: 6,
- snapshots: 4,
- admin/checklists: 3 each,
- health/org/reports/workforce: 1 each.

Verification:

- Docs/evidence plus `git diff --check`.
- Do not delete or change endpoints in this milestone.

### 3. Auth / Role / Scope Overlay

Goal:

- Make route, endpoint, role, read-scope, and action-store expectations visible
  beside the system-flow map.

Preferred shape:

- Reuse `docs/plans/authorization-matrix-drift-guard-v1.md` and
  `docs/plans/scope-auth-regression-matrix-v1.md`.
- Add a static overlay or evidence note before any runtime auth behavior work.

Verification:

- Docs contract tests where existing.
- Backend auth tests only if behavior is touched, which this milestone should
  avoid by default.

### 4. Fanout / Bottleneck Audit

Goal:

- Identify static bottleneck candidates without claiming live traffic.

Current post-precision top static fanout candidates:

- `/admin/competitions`: 23 API calls, mostly competitions.
- `/admin/auth`: 14 API calls, auth admin.
- `/admin/master-data`: 12 API calls, integrations.
- `/store/approvals`: 12 API calls, workforce and target distributions.
- `/admin/operations`: 10 API calls across integrations, reports, snapshots,
  workforce, workflow, and health.
- `/admin/inbox` and `/store/tasks`: 8 API calls each.

Audit questions:

- Does page entry trigger all calls immediately or only after user action?
- Are any queries duplicated between prefetch and page render?
- Are React Query keys, stale time, and enabled guards appropriate?
- Are loading, partial-error, and empty states clear when one domain fails?
- Are large payload endpoints obvious enough to receive runtime telemetry?

Verification:

- Browser/network or targeted Playwright evidence when touching UI/tests.
- Docs-only audit can use `git diff --check`.

### 5. Operations Telemetry V1

Goal:

- Add or refine small runtime/readiness signals only where an existing source
  and verification path already exist.

Priority signals:

- integrations import duration/error/retry posture,
- snapshot freshness and materialization status,
- workforce queue pressure,
- reports latency/freshness candidate surfaces,
- workflow inbox pending/blocked pressure,
- auth failure/session issue evidence when real inputs exist.

Guardrail:

- Do not build a broad observability platform in this milestone.
- Do not add hard SLA/SLO thresholds without a separate decision.

Verification:

- Follow `docs/plans/operations-metrics-bottleneck-readiness-v1.md`.
- Frontend work uses admin lint/build and targeted Playwright.
- Backend telemetry/read-model work uses targeted Jest/build and API contract
  checks when contracts change.

### 6. Store Placeholder Route Decision

Goal:

- Decide whether these store routes become honest placeholders or receive a
  small read-only data slice:
  - `/store/incentives`,
  - `/store/reports`,
  - `/store/settings`,
  - `/store/targets`.

Default:

- Prefer honest product copy and navigation clarity unless a real V1 read model
  is already available.

Verification:

- Frontend lint/build and the relevant store Playwright spec when UI changes.
- No backend/API/auth/DB behavior changes unless separately scoped.

### 7. Clerk Persona Evidence

Goal:

- Execute the existing Clerk persona evidence runbook only with real staging
  Clerk/session/persona inputs.

Allowed:

- Validate runbook structure locally.
- Record blocker status if real inputs are absent.
- Run real staging persona smoke only when token/persona prerequisites exist.

Not allowed:

- Fabricated local JWTs, raw token evidence, copied secrets, or mock auth proof
  represented as real Clerk evidence.

Verification:

- `docs/plans/clerk-persona-staging-evidence-runbook-v1.md`.
- `guard:auth:evidence` and smoke commands named by the runbook when inputs
  exist.

## PR Rhythm

- Seven milestones stay fixed, but PR count is not fixed.
- Each PR must have one review story and one rollback story.
- Docs-only classification work can batch.
- Runtime telemetry and auth evidence work should stay smaller.
- Merge only after local gates, GitHub/Vercel green checks, mergeable status,
  and Codex no-major-issue or thumbs-up approval.
