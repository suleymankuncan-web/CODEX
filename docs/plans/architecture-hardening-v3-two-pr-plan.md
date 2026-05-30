# Architecture Hardening V3 Two-PR Plan

Status: proposed
Created: 2026-05-30

## Goal

Close two high-leverage architecture debts after Architecture Hardening V2 and
raise the architecture health estimate from `84/100` to roughly `88/100`
without changing product behavior.

This plan intentionally picks two PRs only. The purpose is not to keep
refactoring because files are large. The purpose is to reduce the two remaining
growth risks most likely to make future features unsafe:

1. Integration import lifecycle growth before Nebim or additional source
   adapters arrive.
2. Auth-admin write-boundary growth before more role, scope, action-store, or
   personnel access features arrive.

## Current Evidence

Current closeout evidence:

- `docs/evidence/architecture-hardening-v2-closeout-2026-05-30.md`
- `docs/plans/refactor-completion-inventory-v1.md`
- `current-state.md`

Relevant current risk after V2:

- `IntegrationService` still owns import creation, source governance, retry,
  approval, reconciliation, and repository orchestration.
- `AuthAdminRepository` still owns user account, pilot binding,
  action-store assignment, and role-permission command behavior outside the
  role-assignment command extraction.
- `WorkforceRequestRepository` and `CompetitionRepository` still have real
  parked risk, but V2 already extracted their transition policies. They are
  lower priority for a two-PR push than integration and auth.

## Hard Non-Goals

Neither PR may change:

- API response shape.
- DB schema or migrations.
- Auth or permission semantics.
- Clerk/session behavior.
- Import retry behavior.
- BullMQ behavior.
- Source governance semantics.
- Audit event type, audit actor, or audit metadata semantics.
- KPI scoring, ranking sort, checklist weights, or snapshot interpretation.
- Store UI or user-facing workflow behavior.

If a slice needs one of these behavior changes, stop and split it into a
separate decision.

## PR-1: Integration Import Lifecycle Boundary

Risk: high

Target branch:

```text
codex/architecture-hardening-v3-pr1-integration-import-lifecycle
```

### Purpose

Move import lifecycle command orchestration out of the central
`IntegrationService` so future source adapters, especially Nebim, do not keep
adding lifecycle logic to the same application hotspot.

### Candidate Files

Likely modify:

- `backend/nestjs/src/modules/integration/application/integration.service.ts`
- `backend/nestjs/src/modules/integration/integration.module.ts`
- `backend/nestjs/src/modules/integration/infrastructure/integration.repository.ts`
- existing integration specs under `backend/nestjs/src/modules/integration/`

Likely create:

- `backend/nestjs/src/modules/integration/application/integration-import-command.service.ts`
- optional small helper/policy if it removes real duplication:
  `backend/nestjs/src/modules/integration/application/integration-import-lifecycle.policy.ts`

Only create a new infrastructure repository if the current
`IntegrationRepository` command/write grouping becomes clearer and tests can
prove equivalent behavior. Do not create a broad abstraction just to move
files.

### Scope

Extract orchestration for the existing command lifecycle:

- `createImportBatch`
- `retryImportBatch`
- `approveExternalIdMapping`
- mapping candidate resolution needed by approval
- retry eligibility/category helpers if they are currently lifecycle-specific
- company-scope checks only if moved as pure shared application logic with no
  behavior change

Leave read surfaces in place:

- source list/detail and lookups
- store master reads
- personnel master reads
- import batch list/summary/overview/errors/audit reads
- Power BI upload parser/normalizer/reconciliation boundaries already closed
  in V2

### Required Preservation

Preserve exactly:

- batch status strings and retry transitions
- mapping approval semantics
- actor audit semantics
- source authorization behavior
- queue handoff behavior
- error messages observed by current tests
- OpenAPI/client response shapes

### Local Verification

Minimum:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/integration
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
git diff --check
```

If the diff touches release-impacting import behavior or shared gate scripts,
also run:

```powershell
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run check:release
```

### PR Description Must Say

- No Nebim behavior was added.
- No new import source behavior was added.
- No retry, approval, queue, schema, or API behavior changed.
- The PR only creates a clearer command lifecycle boundary for existing
  behavior.

### Rollback

Normal squash revert. No data, migration, provider, or queue cleanup should be
required.

### Expected Score Impact

Estimated architecture health after merge: `86/100`.

Why:

- Future source adapters stop entering the central `IntegrationService` import
  lifecycle path by default.
- Existing import write behavior becomes reviewable as one application command
  boundary.

## PR-2: Auth Admin Remaining Write Boundary

Risk: high

Target branch:

```text
codex/architecture-hardening-v3-pr2-auth-admin-write-boundaries
```

### Purpose

Move the remaining auth-admin write SQL and audit persistence out of the large
facade repository so future role/scope/action-store/personnel-access features
do not grow one security-sensitive file.

This is the highest-value security/permission architecture slice after the V2
role-assignment command extraction.

### Candidate Files

Likely modify:

- `backend/nestjs/src/modules/auth/auth-admin.repository.ts`
- `backend/nestjs/src/modules/auth/auth.module.ts`
- auth repository/service specs under `backend/nestjs/src/modules/auth/`
- auth integration specs under `backend/nestjs/test/integration/`

Likely create one or more focused repositories:

- `backend/nestjs/src/modules/auth/auth-user-account-command.repository.ts`
- `backend/nestjs/src/modules/auth/auth-action-store-assignment-command.repository.ts`
- `backend/nestjs/src/modules/auth/auth-role-permission-command.repository.ts`

If this is too large for one coherent review story, split inside the PR plan
before opening a PR. The preferred split would be:

1. user account and pilot binding commands
2. action-store assignment and role-permission commands

However, the default plan is one PR only if the diff stays reviewable and all
changes share the same security write-boundary story.

### Scope

Extract focused command persistence for:

- `createUserAccount`
- `reactivateUserAccount`
- `createPilotUserBinding`
- `createActionStoreAssignment`
- `deactivateActionStoreAssignment`
- `countActiveActionStoreAssignments`
- `grantRolePermission`
- `revokeRolePermission`

Keep the existing service-facing facade if it minimizes behavior risk. The
goal is not to redesign auth; it is to stop security-sensitive write SQL from
continuing to accumulate in the same large repository.

### Required Preservation

Preserve exactly:

- role/scope permission semantics
- action-store assignment semantics
- pilot binding semantics
- active employee/store validation semantics
- audit event types and metadata operation names
- conflict behavior
- returned shapes and error behavior
- all existing auth integration test expectations

### Local Verification

Minimum:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/auth
npm.cmd --prefix backend/nestjs test -- --runInBand test/integration/auth-role-assignments.e2e-spec.ts test/integration/auth-user-accounts.e2e-spec.ts test/integration/auth-action-scope.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run check:release
npm.cmd run test:scripts
git diff --check
```

If OpenAPI or generated client output changes, stop. That would violate this
plan unless the only change is a separately approved contract refresh with no
response-shape drift.

### PR Description Must Say

- No auth or permission semantics changed.
- No role/scope visibility changed.
- No Clerk/session behavior changed.
- No API shape changed.
- The PR only moves existing write persistence behind focused command
  repositories.

### Rollback

Normal squash revert. No data, migration, provider, or auth repair should be
required.

### Expected Score Impact

Estimated architecture health after merge: `88/100`.

Why:

- Security-sensitive auth write behavior becomes bounded by focused command
  repositories.
- Future role/scope/action-store/personnel access work gets a clearer extension
  point instead of growing `AuthAdminRepository`.

## Why Not Competition Or Workforce First

Competition and workforce still carry real risk, but V2 already extracted
explicit transition policies there. For a two-PR push, the higher return is:

1. Integration, because Nebim and source-adapter growth will otherwise land in
   the current import lifecycle hotspot.
2. Auth, because permission/write drift has higher blast radius than a
   repository remaining large after its transition policy was extracted.

Competition scoring/finalization and workforce SQL persistence remain good
future candidates after this two-PR line, especially if a product feature
touches those domains.

## Execution Rules

For each PR:

1. Start from fresh `origin/main`.
2. Use a new `codex/` branch.
3. Keep the PR to one review story and one rollback story.
4. Run the pre-PR adversarial review from `discipline.md`.
5. Push, open PR, request Codex review, and monitor all checks.
6. Do not merge until checks are green, PR is mergeable, and Codex review
   channels are clean.
7. After merge, fetch/verify `origin/main` before starting the next PR.

## Stop Conditions

Stop and report before opening or pushing a PR if:

- API response shape changes.
- DB schema or migration changes.
- Auth/permission semantics change.
- Import retry, queue, or source-governance behavior changes.
- Tests reveal current behavior contradicts documented business expectations.
- The PR starts mixing integration and auth work.
- The diff cannot be explained in one paragraph.

## Final Closeout

After both PRs merge:

- Update `current-state.md`.
- Add a short evidence closeout under `docs/evidence/`.
- Record the new architecture health estimate.
- Record which risks remain intentionally parked.
