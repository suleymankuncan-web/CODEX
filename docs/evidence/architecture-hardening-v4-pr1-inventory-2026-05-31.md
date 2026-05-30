# Architecture Hardening V4 PR-1 Inventory And Contract Freeze

Status: active V4 contract-freeze evidence
Created: 2026-05-31
Risk class: R0 docs/process
Contract Impact: none

This document freezes the V4 refactor map before PR-2 through PR-6 move
runtime code. It records repo-backed file shape, protected behavior, existing
test evidence, missing characterization requirements, and selected next
targets.

## Scope Guard

This PR does not change runtime code, API response shape, DB schema, auth or
permission semantics, scoring/ranking/snapshot/checklist behavior, BullMQ or
import lifecycle behavior, user-facing workflow behavior, Store UI design, or
provider configuration.

Rollback is docs-only: revert this evidence file plus the references added to
`current-state.md` and `docs/plans/refactor-completion-inventory-v1.md`.

## Hotspot Shape

Line counts were read from the current tree on 2026-05-31:

| Area | Current file | Lines | V4 decision |
| --- | --- | ---: | --- |
| Master data bootstrap | `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts` | 1194 | Code-actionable in PR-2 only after parity tests lock promotion behavior. |
| Workforce requests | `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts` | 1160 | Code-actionable in PR-3 only after parity tests lock write/status/audit behavior. |
| Competitions | `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts` | 1360 | Code-actionable in PR-4 only for selected stage-package-plan review command boundary. |
| OpenAPI generator | `backend/nestjs/src/openapi/generate-openapi.ts` | 5256 | Selected PR-5 generator target. |
| System-flow generator | `scripts/generate-system-flow.mjs` | 1438 | Parked in V4 unless PR-5 exposes a stronger reason to swap target. |
| Store broad E2E | `admin-web/e2e/store-surfaces.spec.ts` | 5226 | Selected PR-6 decomposition source; target is Store targets tests only. |
| Competition broad E2E | `admin-web/e2e/competition-surfaces.spec.ts` | 1674 | Parked in V4 unless Store target split becomes unsafe. |

## Behavior Freeze Matrix

### MasterDataBootstrapService

Protected behavior:

- Batch creation stages rows with normalized references, stable row hashes, and
  command response shape.
- List/read models preserve derived readiness, next action, scoped batch
  access, row review shape, promotion readiness, and already-promoted handling.
- Validation does not promote staged data; it preserves review/ready statuses,
  duplicate handling, unknown store type/region handling, and required evidence
  handling.
- Store and personnel promotion preserve `ready_to_promote` precondition,
  stale-row rejection, already-promoted skip behavior, promoted row counts,
  returned batch/promotion shape, and message/status strings.
- Repository persistence location and import lifecycle remain unchanged.

Existing test map:

- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-staging.service.spec.ts`
  covers staging, normalized references, stable hashes, personnel national-id
  hash evidence, and normalized promotion metadata.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-read-models.service.spec.ts`
  covers batch list readiness/next action, scoped row review, pending/invalid
  blockers, ready rows, and promoted rows.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts`
  covers personnel validation without promotion, required live-write metadata,
  unknown store type, missing/unknown region, region-resolved rows, duplicate
  store codes, duplicate seller codes, duplicate national-id hashes, and
  existing employee mismatch review issues.
- `backend/nestjs/src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts`
  covers store/personnel type mismatch rejection, batch-not-ready rejection,
  ready-row promotion with already-promoted skip behavior, stale-row rejection,
  and required personnel evidence.

Missing characterization before PR-2 refactor:

- Add or confirm a test-only parity assertion for exact promotion command
  response envelope fields (`status`, `message`, `data.batch`,
  `data.promotedRows`) before moving promotion decision/build logic.
- Add or confirm a test-only parity assertion for audit/event behavior if PR-2
  touches code that currently triggers repository-side promotion writes. If
  audit behavior cannot be observed without changing the repository contract,
  PR-2 must keep audit/persistence calls in place and record it as parked.

PR-2 may proceed only after those parity checks exist or Scout proves current
promotion specs already assert the same fields explicitly.

### WorkforceRequestRepository

Protected behavior:

- Seller-code create, approve, reject, and resubmit status transitions and audit
  event names remain unchanged.
- Offboarding create, approve, reject, and resubmit status transitions and
  audit event names remain unchanged.
- Store-manager list/action scope remains limited to assigned stores even when
  wider company scope exists.
- HR approval remains company-scoped and rejects out-of-scope requests.
- Offboarding approval still terminates the employee, closes active assignment,
  and links lifecycle/access effects through the existing repository flow.
- Returned request shape, status strings, transaction boundaries, and conflict
  behavior remain unchanged.

Existing test map:

- `backend/nestjs/src/modules/store-ops/application/workforce-request-transition.policy.spec.ts`
  locks seller-code/offboarding transition statuses, audit events, and source
  status checks.
- `backend/nestjs/test/integration/workforce-seller-code.e2e-spec.ts` covers
  latest franchise reference, store-manager create, non-franchise create,
  assigned-store list scope, position options, HR approve, HR reject,
  out-of-scope HR approval rejection, and rejected-request resubmit.
- `backend/nestjs/test/integration/workforce-offboarding.e2e-spec.ts` covers
  active employee lookup, store-manager create, assigned-store list scope, HR
  approve with assignment closure, HR reject without employee mutation,
  out-of-scope HR approval rejection, and rejected-request resubmit.

Missing characterization before PR-3 refactor:

- Add a test-only parity assertion around the exact repository return shape for
  create/approve/reject/resubmit if PR-3 extracts SQL builders or command
  persistence methods.
- Add a test-only parity assertion around transaction grouping if the split
  moves multiple SQL statements across helper boundaries. If transaction
  grouping cannot be proven without instrumentation, PR-3 must keep the
  existing `withTransaction` owner in the facade and only extract inner command
  builders/executors.

### CompetitionRepository

Selected PR-4B boundary:

- Stage package plan review command persistence:
  `createStagePackagePlan`, `updateStagePackagePlan`,
  `submitStagePackagePlan`, `approveStagePackagePlan`,
  `rejectStagePackagePlan`, `cloneStagePackagePlan`, `cancelStagePackagePlan`,
  and `listStagePackagePlanAuditEvents` are eligible.

Protected behavior:

- Stage package plan statuses, transition policy checks, review notes, audit
  metadata, clone status reset, and returned plan shape remain unchanged.
- Stage execution, scoring recalculation, finalization, and store contribution
  read-scope behavior do not move in PR-4.
- Transaction boundaries around command writes remain unchanged.
- `CompetitionRepository` remains the service-facing facade.

Existing test map:

- `backend/nestjs/src/modules/store-ops/application/competition-stage-package-plan-transition.policy.spec.ts`
  locks draft/review/execution/cancellation/clone transitions and source status
  checks.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts`
  covers list, save draft, update draft, reject executed update, cancel draft,
  submit draft, approve submitted, reject submitted, clone rejected, reject
  non-rejected clone, and audit event list behavior.
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
  covers the facade paths for stage package plans plus adjacent stage creation,
  package creation, finalization warning handling, and scoped detail reads.
- `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
  and `backend/nestjs/test/integration/competition.e2e-spec.ts` cover service
  and API-level write/read guards for competition flows.

Missing characterization before PR-4 refactor:

- PR-4 starts with a test-only parity slice unless current tests already prove
  the exact facade delegation contract for the selected stage package plan
  command methods.
- PR-4 must not include `executeStagePackagePlan`, score recalculation,
  finalization, or stage execution movement. Those remain parked.

## Generator Target For PR-5

Selected target:

- `backend/nestjs/src/openapi/generate-openapi.ts`

Why:

- It is the largest active generator hotspot at 5256 lines.
- It has a concrete output contract: `docs/api/openapi.json`.
- The frontend generated client depends on the same OpenAPI document.

Parity contract:

1. From a clean branch, run:

   ```powershell
   npm.cmd --prefix backend/nestjs run openapi:generate
   git diff -- docs/api/openapi.json
   npm.cmd --prefix admin-web run api:check
   ```

2. Refactor only generator helper structure.
3. Run the same commands after the refactor.
4. Accept the PR only when the `docs/api/openapi.json` diff is empty and
   `api:check` passes.

If OpenAPI output changes, PR-5 stops and the change becomes a separate
`Contract Impact: changed` PR.

Parked generator:

- `scripts/generate-system-flow.mjs` stays parked because it already has
  `scripts/system-flow-generator-contract.test.mjs` coverage and lower line
  count. It can be reopened only if PR-5 discovers OpenAPI generator movement is
  unsafe.

## E2E Decomposition Target For PR-6

Selected source:

- `admin-web/e2e/store-surfaces.spec.ts`

Selected extraction target:

- Store targets tests:
  - `store targets page submits target distribution allocations with employee ids`
  - `store targets page renders only role-fit target flows`
  - `store targets page lets region managers approve pending target requests in scope`
  - `store targets page submits revision requests from approved target snapshots`
  - target-distribution coverage currently duplicated through Store approvals,
    if fixture/helper ownership makes that safer to move together.

Target file:

- `admin-web/e2e/store-targets-surfaces.spec.ts`

Guard rules:

- Preserve exact user-visible assertions in the extracted spec.
- Keep route, auth persona, API mocking, fixture meaning, and test names
  reviewable.
- Review fixture/helper diff separately.
- Run targeted before/after:

  ```powershell
  npm.cmd --prefix admin-web run test:e2e -- store-surfaces.spec.ts --grep "store targets"
  npm.cmd --prefix admin-web run test:e2e -- store-targets-surfaces.spec.ts --workers=1
  ```

- If the test runner or grep behavior differs on Windows, PR-6 must record the
  exact command that proves the same scenarios.

Parked E2E target:

- `admin-web/e2e/competition-surfaces.spec.ts` remains parked. It is smaller
  and competition workflow risk is already reserved for PR-4 backend boundary
  work.

## Store UI Redesign-Sensitive Surfaces

Store UI product design remains out of scope for Architecture Hardening V4.
The code-actionable V4 item is PR-7 guard/process foundation only.

Protected Store UI constraints:

- shadcn/ui + Tailwind v4 + lucide remains required for redesign work.
- No fake metrics, fake rankings, fake trend, fake checklist result, fake
  payout, fake target, or placeholder product copy.
- No role-out-of-scope toolbar/sidebar items.
- No legacy Store UI classes or internal debug/handoff copy.
- `/store/incentives` remains parked unless explicitly scoped by the user.

PR-7 may add process/script guard coverage for those constraints, but it must
not redesign Store screens.

## PR-1 Output Decisions

- PR-4B selected competition boundary: stage package plan review command
  persistence only.
- PR-5 selected generator target: `backend/nestjs/src/openapi/generate-openapi.ts`.
- PR-6 selected E2E target: Store targets tests from
  `admin-web/e2e/store-surfaces.spec.ts` into
  `admin-web/e2e/store-targets-surfaces.spec.ts`.
- Required test-only slices:
  - PR-2 must confirm or add promotion response/audit parity before moving
    promotion logic.
  - PR-3 must confirm or add workforce return-shape/transaction parity before
    moving command persistence.
  - PR-4 must confirm or add selected stage-package-plan facade delegation
    parity before moving command persistence.
