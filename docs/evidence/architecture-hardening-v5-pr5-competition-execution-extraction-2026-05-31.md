# Architecture Hardening V5 PR-5 Competition Execution Extraction

Date: 2026-05-31
Branch: `codex/architecture-hardening-v5-competition-execution-extract`

## Scope

This PR extracts only the stage package plan execution persistence selected in
V5 PR-4.

New focused infrastructure owner:

```text
backend/nestjs/src/modules/store-ops/infrastructure/competition-stage-package-plan-execution-command.repository.ts
```

Facade retained:

```text
backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts
```

## Behavior Preserved

The extraction keeps:

- `CompetitionRepository.executeStagePackagePlan` as the service-facing method,
- the same `DatabaseService.withTransaction` grouping,
- the same `FOR UPDATE` plan lock,
- the same transition policy and rejection message,
- the same stage/team insert SQL,
- the same plan status update and `created_stage_ids` persistence,
- the same execution audit event and metadata,
- the same returned `{ plan, stages }` shape.

## Out Of Scope

This PR does not move or change:

- scoring recalculation,
- finalization,
- package-plan review/submit/update/cancel/clone,
- team-template behavior,
- API contract,
- DB schema or migrations,
- auth/permission semantics.

## Size Impact

- `competition.repository.ts`: 1295 -> 1245 lines.
- New execution command repository: 252 lines.

The frozen oversized baseline for `competition.repository.ts` was lowered to
1245 so future PRs cannot silently grow it back.

## Verification

```powershell
npm.cmd --prefix backend/nestjs test -- --runInBand src/modules/store-ops/application/competition.service.spec.ts src/modules/store-ops/infrastructure/competition.repository.spec.ts test/integration/competition.e2e-spec.ts
npm.cmd --prefix backend/nestjs run build
npm.cmd --prefix backend/nestjs run lint
npm.cmd run test:scripts
git diff --check
```

`npm.cmd run test:scripts` initially failed as expected because the file-size
guard still had the old 1295-line frozen cap. The cap was lowered to 1245 and
the command must pass before PR open.

## Rollback

Revert the execution command repository extraction and file-size baseline
update. No migration, data repair, queue drain, or API/client regeneration is
required.
