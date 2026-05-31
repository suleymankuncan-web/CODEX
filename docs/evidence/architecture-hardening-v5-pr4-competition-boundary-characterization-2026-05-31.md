# Architecture Hardening V5 PR-4 Competition Boundary Characterization

Date: 2026-05-31
Branch: `codex/architecture-hardening-v5-competition-characterization`

## Scope

This PR selects the single competition boundary that may move in the next
runtime PR. It does not change application code.

## Boundary Decision

Selected PR-5 target:

```text
stage package plan execution persistence
```

Current owner:

```text
backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts
```

Selected method cluster:

- `executeStagePackagePlan`
- `getStagePackagePlanForUpdate`
- `insertStageWithTeams`
- `writeStagePackagePlanAudit`

The service-facing facade may remain `CompetitionRepository`. The next PR may
move only the execution persistence cluster behind a focused infrastructure
helper/repository.

## Why This Boundary

This is the lowest-risk remaining competition runtime split because existing
tests already lock the most important behavior:

- non-approved plans are rejected before execution,
- already executed plans cannot execute again,
- approved plans execute inside one transaction,
- stage drafts create concrete stages and teams,
- the plan status moves to `executed`,
- created stage ids are persisted,
- execution audit metadata includes stage count and created stage ids,
- service command response shape remains stable.

The other remaining boundaries are not selected:

- `recalculateStage` owns scoring SQL, warning generation, snapshot deletes, and
  ranking aggregation in one transaction. It must not move until a golden SQL or
  fixture-backed scoring parity test exists.
- `finalizeStage` is small in persistence, but the protected behavior is split
  across service warning policy and repository audit write. It should wait until
  execution is extracted or until finalization gets a dedicated policy/persistence
  characterization.

## Protected Behavior For PR-5

PR-5 must preserve:

- transition policy: only `approved` can execute,
- idempotency: executed/non-executable plans fail before writes,
- transaction grouping: plan lock, stage/team inserts, plan update, and audit
  write remain in the same transaction,
- audit event: `competition_stage_package.executed`,
- audit metadata: `competitionId`, `packageCode`, `planName`, `stageCount`,
  `createdStageIds`,
- created stage shape and mapped response shape,
- service command status/message/data shape,
- no scoring, finalization, review, cancel, clone, or package draft behavior
  changes.

## Test Map

Existing tests that protect the selected boundary:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
  - rejects executing a draft stage package plan before approval,
  - executes an approved stage package plan once in a transaction,
  - rejects executing a stage package plan that is already executed.
- `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
  - executes a saved stage package plan through the repository and preserves the
    command response.

Related broad workflow smoke:

- `backend/nestjs/test/integration/competition.e2e-spec.ts`
  - covers competition access and finalization warning behavior, but does not
    provide execution persistence parity by itself.

## PR-5 Allowed Movement

Allowed:

- extract execution-only persistence into a focused helper/repository,
- keep `CompetitionRepository.executeStagePackagePlan` as the facade method,
- pass the same transaction client through the extracted helper,
- keep existing SQL text behavior equivalent.

Not allowed:

- changing transition policy,
- changing audit metadata,
- changing returned command/data shape,
- moving scoring recalculation,
- moving finalization,
- moving review/cancel/clone/update package-plan behavior,
- adding migrations or data repair.

## Verification

Characterization command:

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
```

Result:

```text
Test Suites: 3 passed, 3 total
Tests: 35 passed, 35 total
```

PR closeout must also run:

```powershell
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
git diff --check
```

## Stop Conditions For PR-5

Stop if:

- extraction requires changing SQL result shape,
- extraction requires splitting the transaction,
- execution audit metadata changes,
- stage/team insert order changes,
- generated API output changes,
- tests reveal ambiguous behavior between current implementation and docs.

## Rollback

This PR is docs-only. Revert this evidence/current-state/inventory update.
No migration, data repair, queue drain, or runtime rollback is required.
