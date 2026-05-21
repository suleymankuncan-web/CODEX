# Competition Team Template Command Boundary Decision V1

Date: 2026-05-21

## Purpose

Decide whether the next competition repository refactor should move
team-template command methods out of `CompetitionRepository`, and define the
minimum invariant/test contract before any code movement starts.

This is a docs-only decision. It changes no production code, SQL, DTO, API
response shape, authorization behavior, DB schema, CSS, or user-facing
behavior.

## Sokrates Decision

Claim:

- The next competition backend refactor may be the team-template command
  boundary, but only as a narrow command extraction with explicit invariants and
  tests.

Assumptions:

- `listTeamTemplates` is already delegated to
  `CompetitionTeamTemplateReadRepository`, so the remaining team-template
  methods in `CompetitionRepository` are write/command oriented.
- Command extraction can be reviewable if it moves only command persistence and
  keeps service validation, authorization, DTOs, routes, audit event names,
  transaction behavior, and response shapes unchanged.

Repo Evidence:

- `competition-repository-boundary-inventory-v1.md` marks team-template command
  methods as the next competition candidate after the read boundary.
- `CompetitionRepository` still owns:
  - `createTeamTemplate`
  - `updateTeamTemplate`
  - `deactivateTeamTemplate`
  - `cloneTeamTemplate`
- `competition-team-template.repository.spec.ts` already asserts command SQL,
  membership writes, read-back mapping, and audit metadata for create, update,
  deactivate, and clone.
- `competition-team-template.service.spec.ts` already asserts store ID
  de-duplication, empty-store rejection, command result messages, and repository
  call payloads.
- `competition.e2e-spec.ts` already asserts HR_ADMIN out-of-scope store
  rejection before insert and in-scope team-template creation returning `201`.

Counterargument:

- This is still command/write code. A pure line-count reduction is not enough,
  and moving it without preserving transaction/audit semantics could hide a
  regression behind unchanged TypeScript types.

Risk:

- MEDIUM for the future code slice.
- LOW for this docs-only decision.

Door:

- The docs decision is a two-way door.
- The future command extraction should remain a two-way door only if it is one
  normal squash-revert PR and does not change schema, response shape, auth, or
  state semantics.

Decision:

- Allow one future code slice named around
  `CompetitionTeamTemplateCommandRepository`.
- The slice may move only:
  - `createTeamTemplate`
  - `updateTeamTemplate`
  - `deactivateTeamTemplate`
  - `cloneTeamTemplate`
- Keep `getTeamTemplateAccessContext` parked in `CompetitionRepository` for now
  because it feeds authorization/access checks.
- Keep stage-package plan writes, stage creation/execution, score
  recalculation, finalization, and access-context helpers parked.

## Invariants For The Future Code Slice

The future extraction must preserve:

- Transaction boundary: every command still runs inside the same
  `databaseService.withTransaction` unit.
- Audit event names:
  - `competition_team_template.created`
  - `competition_team_template.updated`
  - `competition_team_template.deactivated`
  - `competition_team_template.cloned`
- Audit entity name: `ops.competition_team_template`.
- Create semantics: insert template, insert supplied store memberships, audit,
  then read back through the existing team-template row query/mapping path.
- Update semantics: update template fields, replace store memberships by delete
  plus insert, audit `changedFields`, then read back through the existing query.
- Deactivate semantics: set `is_active = FALSE`, audit, then read back the
  template.
- Clone semantics: insert a new template, copy source template store
  memberships, audit source metadata, then read back the cloned template.
- Service-level validation remains in `CompetitionService`, including empty
  store rejection and store ID de-duplication.
- Controller route paths, status codes, DTOs, generated OpenAPI contract, and
  frontend API usage stay unchanged.

## Required Verification Ladder

Before opening the future code PR:

```powershell
npm.cmd --prefix backend/nestjs test -- competition-team-template.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- competition-team-template.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- competition.e2e-spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- competition --runInBand
npm.cmd --prefix backend/nestjs run build
```

If OpenAPI output changes, stop and treat it as unexpected drift unless the
future slice explicitly scopes API contract work. The intended command
extraction should not change OpenAPI output.

## Stop Rules

Stop before coding or before PR if:

- Any command response shape changes.
- A route path, DTO, generated client, or status code changes.
- HR_ADMIN out-of-scope store rejection changes or loses its negative test.
- Store membership replacement changes from delete-plus-insert semantics.
- Audit event names, entity name, metadata, or actor user handling changes.
- The extraction touches stage-package plan writes, stage creation/execution,
  score recalculation, finalization, or access-context helpers.
- The PR cannot be reviewed as one command-boundary story.

## Future PR Shape

Recommended future code PR:

- Add `competition-team-template-command.repository.ts`.
- Move only the four command methods listed above.
- Keep `CompetitionRepository` as a delegating facade for those methods in the
  first slice so service/controller behavior does not change.
- Reuse `queryTeamTemplateRows`, `mapTeamTemplates`, and existing audit helper
  behavior.
- Do not batch with frontend StageBuilder, stage package plans, scoring,
  finalization, or access/scope work.
