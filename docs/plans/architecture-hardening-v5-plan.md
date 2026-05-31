# Architecture Hardening V5 Plan

Status: closed
Created: 2026-05-31
Closed: 2026-05-31

## Goal

Close the debt intentionally parked after Architecture Hardening V4 without
turning the project back into open-ended refactor work.

Target architecture health after this line: `95/100` if OpenAPI parity is
repaired and at least one deeper backend boundary is safely narrowed.

Closeout evidence:
`docs/evidence/architecture-hardening-v5-closeout-2026-05-31.md`

## Non-Goals

This line must not change:

- API response shape unless a PR explicitly declares `Contract Impact: changed`.
- DB schema or migrations.
- Auth or permission semantics.
- KPI scoring output, ranking order, snapshot interpretation, or checklist
  weights.
- BullMQ, import retry, source governance, or materialization lifecycle
  behavior.
- User-facing workflow behavior.
- Store UI product design.
- Query count, transaction count, queue pressure, or runtime materially enough
  to worsen operator behavior.

If one of these becomes necessary, stop the PR and split a separate decision.

## Debt Selected From V4 Closeout

| Debt | Current evidence | V5 decision |
| --- | --- | --- |
| OpenAPI generator parity drift | `docs/evidence/architecture-hardening-v4-pr5-openapi-generator-blocker-2026-05-31.md` | First priority. Repair or explicitly classify the generated baseline before helper extraction. |
| `CompetitionRepository` scoring/finalization/stage execution ownership | `docs/evidence/architecture-hardening-v4-closeout-2026-05-31.md` and `docs/plans/refactor-completion-inventory-v1.md` | Second priority. Only one selected boundary after characterization/golden coverage. |
| Deeper workforce seller-code/offboarding command splits | `docs/plans/workforce-request-repository-boundary-inventory-v1.md` | Third priority. Only after transaction grouping is locked by tests. |
| Remaining broad E2E/generator files | `docs/plans/refactor-completion-inventory-v1.md` | Conditional. Only if gate time, flake, precision, or reviewability evidence appears. |

## Operating Model

Use `discipline.md` for every PR:

- Scout current code/tests/evidence before editing.
- Planner writes exact scope, risk class, rollback, and verification.
- Worker changes only the selected slice.
- Reviewer runs local adversarial review before PR open and before each push.
- Closer opens PR, follows GitHub/Vercel/Codex checks, merges only when clean,
  then verifies `origin/main`.

## PR Sequence

### PR-1: V5 Plan And OpenAPI Parity Scout

Risk class: `R0 docs/process`

Expected score impact: `+0.25`

Scope:

- Add this plan.
- Record V4 parked-risk selection in `current-state.md`.
- Run a fresh OpenAPI parity scout from current `origin/main` and record whether
  the V4 blocker still reproduces.
- Do not edit generator code or generated API files in this PR.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert docs/evidence only.

Stop if:

- OpenAPI generation modifies files in a way that cannot be restored cleanly.
- The scout finds runtime code changes are required before evidence can be
  recorded.

### PR-2: OpenAPI Metadata/Baseline Repair Decision

Risk class: `R3 backend read/API`

Expected score impact: `+0.75` if parity becomes green.

Scope:

- Reproduce the `openapi:generate` diff on clean `main`.
- Classify every diff family:
  - missing DTO schema metadata,
  - intentional generated baseline update,
  - generator bug,
  - stale tracked contract.
- Choose one repair path:
  - restore DTO metadata with explicit decorators or generator/plugin config
    while keeping `Contract Impact: unchanged`, or
  - declare `Contract Impact: changed` and update OpenAPI/generated client in a
    separate reviewed contract PR.
- Add a repeatable parity check command or evidence script if the current
  command sequence is too easy to misread.

Non-goals:

- No endpoint behavior changes.
- No controller route/status/auth changes.
- No broad DTO decorator sweep without exact diff evidence.
- No generator helper split yet.

Verification:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff -- docs/api/openapi.json
npm.cmd --prefix admin-web run api:generate
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
```

Rollback:

- Revert DTO/generator/generated contract changes. No migration, data repair, or
  queue drain may be required.

Stop if:

- Existing tracked OpenAPI and generated output disagree in a way that changes
  frontend request/response types.
- Repairing metadata requires changing API runtime behavior.

### PR-3: OpenAPI Generator Helper Split

Risk class: `R3 backend read/API`

Expected score impact: `+0.5`

Prerequisite:

- PR-2 must make the before/after OpenAPI parity gate green or explicitly
  record that generator helper split remains blocked.

Scope:

- Extract pure parse/build/format helpers from
  `backend/nestjs/src/openapi/generate-openapi.ts`.
- Same input before/after must produce no `docs/api/openapi.json` diff.
- Do not change generated output.

Verification:

```powershell
npm.cmd --prefix backend/nestjs run openapi:generate
git diff -- docs/api/openapi.json
npm.cmd --prefix admin-web run api:check
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
```

Rollback:

- Revert helper extraction only.

Stop if:

- Generated output changes.
- Helper split needs contract or DTO changes.

### PR-4: Competition Boundary Characterization

Risk class: `R0 docs/process` or `R5 scoring/workflow` if tests are added.

Expected score impact: `+0.5`

Scope:

- Select exactly one next competition boundary:
  - scoring recalculation,
  - finalization command persistence,
  - stage execution persistence.
- Map protected behavior, current tests, missing tests, transaction ownership,
  audit events, and rollback.
- If coverage is missing, add test-only characterization/golden coverage before
  runtime movement.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
```

Rollback:

- Revert docs/tests only if no runtime code moved.

Stop if:

- The selected boundary cannot be proven without changing scoring, lifecycle, or
  access semantics.

### PR-5: Selected Competition Boundary Extraction

Risk class: `R5 scoring/workflow`

Expected score impact: `+0.75`

Prerequisite:

- PR-4 must select the boundary and lock parity/characterization coverage.

Scope:

- Move only the selected competition boundary behind a focused helper or
  repository.
- `CompetitionRepository` may remain the service-facing facade.
- Do not mix scoring, finalization, and stage execution in one runtime PR.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
```

Rollback:

- Revert extraction. No migration, data repair, or queue drain may be required.

Stop if:

- Scoring output, lifecycle state, audit semantics, access scope, or transaction
  grouping would change.

### PR-6: Workforce Command Transaction Characterization

Risk class: `R4 backend write/workflow`

Expected score impact: `+0.5`

Scope:

- Select seller-code command or offboarding command path, not both.
- Add or strengthen characterization tests for transaction grouping, audit
  event names, duplicate/conflict behavior, status transitions, and returned
  shape.
- No runtime split yet unless the selected tests already exist and are exact.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
```

Rollback:

- Revert tests/docs only.

Stop if:

- Tests require changing workflow behavior to pass.

### PR-7: Workforce Selected Command Split

Risk class: `R4 backend write/workflow`

Expected score impact: `+0.5`

Prerequisite:

- PR-6 must lock one command path.

Scope:

- Move only the selected command persistence path behind a focused helper or
  command repository.
- Keep `WorkforceRequestRepository` as facade if services currently depend on
  it.
- Do not move access lifecycle closure unless it is the selected and tested
  path.

Verification:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/workforce-request-transition.policy.spec.ts test/integration/workforce-seller-code.e2e-spec.ts test/integration/workforce-offboarding.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
```

Rollback:

- Revert extraction. No migration, data repair, or queue drain may be required.

Stop if:

- Transaction grouping, audit, employee mutation, access lifecycle, status
  transition, auth scope, or API shape changes.

### PR-8: V5 Closeout

Risk class: `R0 docs/process`

Expected score impact: `+0.25`

Scope:

- Record merged PRs, verification, remaining parked risk, and updated
  architecture health estimate.
- Update `current-state.md` and `docs/plans/refactor-completion-inventory-v1.md`.

Verification:

```powershell
npm.cmd run test:scripts
git diff --check
```

Rollback:

- Revert docs only.

## Dependency Order

```text
PR-1 plan/scout
  -> PR-2 OpenAPI parity repair decision
  -> PR-3 OpenAPI generator helper split, only if PR-2 proves parity
  -> PR-4 competition characterization
  -> PR-5 selected competition extraction
  -> PR-6 workforce command characterization
  -> PR-7 selected workforce extraction
  -> PR-8 closeout
```

## Global Stop Conditions

Stop the active PR and report file/line evidence if:

- The PR crosses into a second risk class.
- The change cannot be reverted by normal squash revert.
- Existing tests and documented behavior disagree.
- A generated contract diff appears without an explicit contract decision.
- Auth, DB, scoring, queue, or workflow semantics become ambiguous.
- Verification scope is too narrow to prove the claim.
