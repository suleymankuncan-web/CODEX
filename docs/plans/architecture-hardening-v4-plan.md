# Architecture Hardening V4 Plan

Status: proposed execution plan
Created: 2026-05-31

## Goal

Raise the repository's architecture health from roughly `88/100` to the
`94/100` range by closing the remaining high-impact maintainability debts with
small, reviewable, behavior-preserving PRs.

This plan continues the closed Architecture Hardening V3 line:

- PR #568: integration import lifecycle boundary.
- PR #569: auth admin write boundary.
- PR #570: integration response helpers and V3 closeout.

## Non-Goals

This plan must not change:

- API response shape.
- DB schema or migrations.
- Auth or permission semantics.
- KPI scoring result, ranking sort, checklist weights, or snapshot
  interpretation.
- BullMQ behavior, import retry behavior, source governance, or materialization
  lifecycle status.
- User-facing workflow behavior.
- Store UI product design.
- Provider configuration.
- Performance behavior: query count, transaction count, queue pressure, or
  runtime must not materially worsen.

If a slice needs one of these changes, stop the slice and record a separate
product or architecture decision before implementation.

## Operating Model

Use the `discipline.md` repo-native subagent review model for every PR:

- `Scout`: read current-state, sokrates, discipline, related plans, target code,
  tests, guards, and previous PR evidence.
- `Planner`: classify PR risk, define exact scope, stop condition, rollback,
  and verification.
- `Worker`: implement only the selected slice.
- `Reviewer`: run the local adversarial review before PR open and before every
  review-triggering push.
- `Closer`: open PR, request Codex review, monitor GitHub/Vercel checks,
  inspect comments/reviews/inline comments/reactions/status rollup, merge only
  when clean, then verify `origin/main`.

Do not install or depend on external subagent runtimes.

## Global Verification Rules

Every PR requires:

```powershell
git diff --stat
git diff --check
```

Every PR must state:

- Risk class: `R0` through `R5`.
- Contract Impact: `none`, `intentionally unchanged`, or `changed`.
- What changed.
- What did not change.
- Rollback path.
- Verification commands and results.

For backend PRs, also search changed files for:

```powershell
rg -n "DatabaseService|as unknown as|from ['\"].*/web|from ['\"].*controller" <changed-files>
```

For guard/script PRs, include negative tests for bypass paths when relevant.

## PR Sequence

### PR-1: V4 Inventory And Contract Freeze

Risk class: `R0 docs/process`

Expected score impact: `+0.5`

Purpose:

- Freeze the remaining debt map before touching write/scoring/workflow-heavy
  code.

Files:

- Create or modify evidence under `docs/evidence/`.
- Modify: `current-state.md`.
- Modify: `docs/plans/refactor-completion-inventory-v1.md`.

Scope:

- Inventory these debt areas with file paths, current line-count shape, owned
  behavior, tests, guards, and stop conditions:
  - `MasterDataBootstrapService`.
  - `WorkforceRequestRepository`.
  - `CompetitionRepository`.
  - large E2E specs.
  - generator scripts.
  - Store UI redesign-sensitive surfaces.
- Record which areas are code-actionable in V4 and which remain parked.
- Produce the Behavior Freeze Matrix before PR-2, PR-3, or PR-4 begins.
- Select the exact PR-5 generator target and PR-6 E2E spec target, including
  their execution order. PR-5 and PR-6 may swap order only when this PR records
  why.
- Do not refactor runtime code.

Behavior Freeze Matrix:

| Area | Protected behavior checklist | Test map requirement |
| --- | --- | --- |
| `MasterDataBootstrapService` | idempotency, validation error shape/text, status strings, promoted row counts, dependency handling, audit events, response shape | Map existing tests that prove each checklist item. If any item is missing, PR-2 starts with a test-only characterization/golden slice before refactor. |
| `WorkforceRequestRepository` | transaction boundary, seller-code/offboarding status transitions, audit event names, permission/scope behavior, conflict behavior, returned shape | Map existing unit/e2e tests that prove each checklist item. If any item is missing, PR-3 starts with a test-only characterization/golden slice before refactor. |
| `CompetitionRepository` | selected competition boundary behavior, score output if scoring is selected, lifecycle transition if transition/finalization is selected, stage execution side effects if stage execution is selected, audit events, transaction behavior, returned shape | Map existing unit/e2e/golden tests for the selected boundary. If any item is missing, PR-4 starts with a test-only characterization/golden slice before refactor. |
| generator target | generated output for the selected stable input, fixture inputs, output file list, expected no-diff contract | PR-5 must record the selected command/input/output and the before/after parity check. |
| E2E spec target | user-visible assertions, route/mocking setup, fixture payload meaning, test count/scenario coverage | PR-6 must record the selected spec, target command, assertion preservation plan, and flake/retry decision. |

PR-1 is not complete until it names:

- The selected PR-4B competition boundary.
- The selected PR-5 generator target.
- The selected PR-6 E2E spec target.
- Which missing behavior tests, if any, must be added before refactor commits.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert docs/evidence only.

### PR-2: Master Data Bootstrap Promotion Boundary

Risk class: `R4 backend write/workflow`

Expected score impact: `+1.0`

Purpose:

- Reduce `MasterDataBootstrapService` promotion/write orchestration risk without
  changing promotion behavior.

Likely files:

- Modify:
  `backend/nestjs/src/modules/integration/application/master-data-bootstrap.service.ts`
- Create focused helper/service files under:
  `backend/nestjs/src/modules/integration/application/`
- Modify targeted tests under:
  `backend/nestjs/src/modules/integration/application/`

Scope:

- Before any refactor commit, lock existing behavior with parity or
  characterization tests from the PR-1 Behavior Freeze Matrix. If coverage is
  missing, start with a test-only slice and do not move runtime code until it
  passes.
- Extract promotion decision/build logic from service orchestration.
- Keep SQL/persistence location unchanged unless Scout proves there is already
  a focused repository boundary that can be reused safely.
- Preserve validation errors, idempotency, status strings, row counts, audit
  semantics, and response shape.
- Add or preserve negative tests for partial dependency, invalid staged data,
  and promotion failure paths.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration/application/master-data-bootstrap.service.spec.ts src/modules/integration/application/master-data-bootstrap-validation.service.spec.ts src/modules/integration/application/master-data-bootstrap-promotion.service.spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
```

Rollback:

- Revert the extraction PR. No schema, API, queue, or auth behavior changes are
  allowed.
- Rollback must require no migration, no data repair, and no queue drain. If any
  of these would be required, stop the PR before merge.

Stop if:

- Promotion semantics must change to split the code.
- DB schema or migration becomes necessary.
- Tests reveal docs and behavior disagree.
- Query count, transaction count, queue pressure, or runtime materially worsens.

### PR-3: Workforce Request Persistence Boundary

Risk class: `R4 backend write/workflow`

Expected score impact: `+1.0`

Purpose:

- Split `WorkforceRequestRepository` persistence responsibilities so norm kadro,
  store action, and workforce feature growth does not expand one SQL facade.

Likely files:

- Modify:
  `backend/nestjs/src/modules/store-ops/infrastructure/workforce-request.repository.ts`
- Create focused infrastructure files under:
  `backend/nestjs/src/modules/store-ops/infrastructure/`
- Modify targeted workforce tests.

Scope:

- Before any refactor commit, lock existing behavior with parity or
  characterization tests from the PR-1 Behavior Freeze Matrix. If coverage is
  missing, start with a test-only slice and do not move runtime code until it
  passes.
- Separate seller-code persistence, offboarding persistence, and
  audit/status-write persistence if Scout confirms the current code boundaries
  support it.
- Preserve existing transition policy behavior, permission behavior, audit event
  names, transaction boundaries, status strings, and API response shape.
- Keep repository facade compatibility if current services depend on it.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
```

Rollback:

- Revert the persistence split. Workflow behavior must remain identical.
- Rollback must require no migration, no data repair, and no queue drain. If any
  of these would be required, stop the PR before merge.

Stop if:

- Existing tests cannot distinguish transition behavior from persistence.
- Transaction semantics would need to change.
- Permission or scope behavior becomes ambiguous.
- Query count, transaction count, queue pressure, or runtime materially worsens.

### PR-4: Selected Competition Repository Boundary

Risk class: `R5 scoring/workflow`

Expected score impact: `+1.0`

Purpose:

- Isolate exactly one competition repository boundary selected by PR-1 before
  future competition features grow this repository.

Likely files:

- Modify:
  `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
- Create focused repository/helper files under:
  `backend/nestjs/src/modules/store-ops/infrastructure/`
  or policy/helper files under:
  `backend/nestjs/src/modules/store-ops/application/`
- Modify targeted competition tests.

Scope:

- PR-1 must select the PR-4B boundary before this PR starts. If PR-1 did not
  make the selection, open a docs-only PR-4A scout/selection slice first.
- PR-4B touches only the selected boundary:
  - stage execution persistence, or
  - scoring/finalization command persistence, or
  - read/query helper extraction.
- Scoring/finalization/stage execution must not be mixed in the same runtime PR.
- Before any refactor commit, lock existing behavior with parity or
  characterization tests from the PR-1 Behavior Freeze Matrix. If coverage is
  missing, start with a test-only slice and do not move runtime code until it
  passes.
- Preserve score outputs, ranking/sort semantics, lifecycle transitions, audit
  events, and transaction behavior.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
```

Rollback:

- Revert the extraction PR. Competition behavior must remain identical.
- Rollback must require no migration, no data repair, and no queue drain. If any
  of these would be required, stop the PR before merge.

Stop if:

- Scoring output changes.
- Lifecycle state-machine behavior changes.
- No adequate negative/golden coverage exists for the selected boundary.
- Query count, transaction count, queue pressure, or runtime materially worsens.

### PR-5: Generator Script Guard And Helper Split

Risk class: `R2 frontend data binding` or `R3 backend read/API`, depending on
the selected generator.

Expected score impact: `+0.5`

Purpose:

- Reduce generator-script reviewability debt and prevent silent contract drift.

Likely files:

- `scripts/generate-system-flow.mjs`
- related script tests under `scripts/*.test.mjs`
- docs under `docs/plans/` or `docs/evidence/`

Scope:

- Use the exact generator target selected by PR-1.
- Extract pure parse/build/format helpers.
- Add or strengthen generated-output drift checks if an existing stable
  baseline exists.
- Do not change generated output unless the PR explicitly records and verifies
  the output diff.
- Run the selected generator with the same input before and after the refactor.
  If output diff is empty, the refactor is acceptable. If output diff exists,
  stop this PR; a separate `Contract Impact: changed` PR is required.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert helper extraction and guard changes.

Stop if:

- Generated output changes without a clear contract reason.
- Fixture update would hide behavior drift.

### PR-6: E2E Spec Decomposition

Risk class: `R1 UI-only` or `R2 frontend data binding`

Expected score impact: `+0.5`

Purpose:

- Make broad Playwright specs reviewable without changing UI behavior or test
  semantics.

Likely files:

- A selected large spec such as `admin-web/e2e/competition-surfaces.spec.ts` or
  another current top offender from PR-1 inventory.
- Shared e2e helper/fixture files under `admin-web/e2e/`.

Scope:

- Use the exact E2E spec target selected by PR-1.
- Extract fixture builders, route setup helpers, and repeated assertions.
- Keep test names, covered scenarios, mocked API payload meaning, and user
  behavior unchanged.
- Do not update snapshots/screenshots unless the selected test already owns
  them and diff is verified.
- Preserve the same user-visible behavior assertions before and after the
  decomposition.
- Keep user-visible assertions readable in the main spec; helpers may set up
  state but must not hide the core expected behavior.
- Review fixture diffs separately from helper extraction. Fixture payload
  meaning must not change.
- If the selected spec has known timing/flakiness risk, run the targeted spec
  twice or record why one run is enough.

Verification:

```powershell
npm.cmd --prefix admin-web run lint
npm.cmd --prefix admin-web run build
npm.cmd --prefix admin-web exec playwright test <targeted-spec> --project=chromium
npm.cmd run test:scripts
```

Rollback:

- Revert helper extraction. Runtime code is not touched.

Stop if:

- Helper extraction makes tests less explicit.
- Flake appears that did not exist before.

### PR-7: Store UI Refactor Guard Foundation

Risk class: `R0 docs/process` plus `R1 UI-only` if scripts touch frontend
source patterns.

Expected score impact: `+0.5`

Purpose:

- Prevent future Store UI redesign work from reintroducing fake data, legacy UI
  copy/classes, role-out-of-scope navigation, or non-standard component stacks.

Likely files:

- `scripts/*.test.mjs`
- `docs/plans/store-surfaces-redesign-implementation-plan-v1.md`
- `current-state.md`
- optionally Store UI skill docs if already tracked.

Scope:

- Add script/test coverage only for patterns that can be checked reliably.
- Guard examples:
  - forbidden legacy Store class/copy patterns in refactored route files.
  - explicit exceptions for parked routes such as `/store/incentives`.
  - shadcn/Tailwind v4/lucide process expectation in docs.
- Do not redesign pages in this PR.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert docs/guard additions.

Stop if:

- Guard becomes broad enough to block legitimate parked UI.
- The check requires product decisions that are not yet made.

### PR-8: Architecture Hardening V4 Closeout

Risk class: `R0 docs/process`

Expected score impact: `+0.5`

Purpose:

- Record the completed V4 line and avoid reopening the same debt discussion
  without new evidence.

Files:

- Modify: `current-state.md`.
- Create evidence under `docs/evidence/`.
- Modify: `docs/plans/refactor-completion-inventory-v1.md`.
- Modify this plan if execution deviated.

Scope:

- Record opened/merged PRs.
- Record risks reduced by each PR.
- Record remaining parked risks and triggers.
- Record verification commands.
- Update estimated architecture health score.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert docs closeout only.

## Dependency Order

```text
PR-1 inventory
  -> PR-2 master-data bootstrap
  -> PR-3 workforce request persistence
  -> PR-4 competition boundary
  -> PR-5 generator guard/split
  -> PR-6 e2e decomposition
  -> PR-7 Store UI guard foundation
  -> PR-8 closeout
```

Notes:

- PR-2, PR-3, and PR-4 must stay separate because they carry different R4/R5
  workflow risks.
- PR-1 selects the exact PR-5/PR-6 targets and order. PR-5 and PR-6 may swap
  only when PR-1 records why.
- PR-7 must not redesign Store pages.
- PR-8 is always last.

## Expected Outcome

After V4:

- `MasterDataBootstrapService` has less promotion/write orchestration pressure.
- `WorkforceRequestRepository` no longer grows as the only workforce write SQL
  facade.
- `CompetitionRepository` has at least one high-risk scoring/finalization/stage
  persistence responsibility isolated.
- One high-risk generator script is smaller or guarded against silent drift.
- One broad E2E spec is decomposed into reusable helpers without behavior
  change.
- Store UI refactor work has a guard/process foundation for fake data, legacy
  UI remnants, and role mismatch.
- `current-state.md` and evidence reflect the final state.

Estimated architecture health after completion: `94/100`.

This is still not `100/100` because real production evidence, future product
decisions, and some intentionally parked UI/product surfaces cannot be closed by
architecture-only refactors.

## Global Stop Conditions

Stop the current PR and report file/line evidence if:

- API response shape must change.
- DB migration or schema change becomes necessary.
- Auth/permission semantics become ambiguous.
- Scoring output, ranking order, checklist weights, or snapshot interpretation
  would change.
- BullMQ, import retry, materialization lifecycle, or source governance behavior
  would change.
- A UI guard would block a legitimate parked/product-decision route.
- Tests reveal existing behavior and docs disagree.
- The PR crosses into a second risk class or loses one-review-story shape.
