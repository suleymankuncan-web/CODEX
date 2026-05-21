# Competition Repository Boundary Inventory V1

Date: 2026-05-21

## Purpose

Record the current `CompetitionRepository` shape before backend code movement.
This is the safe docs-only first slice for
`technical-debt-resolution-roadmap-v1.md` Phase 2.4.

This document changes no production code, SQL, DTO, API response shape,
authorization behavior, DB schema, CSS, or user-facing behavior.

## Sokrates Decision

- Claim: `CompetitionRepository` remains a meaningful backend hotspot after
  the first StageBuilder frontend split line.
- Evidence: on `origin/main` after PR #358, the repository is 1839 physical
  lines and combines scoped competition reads, team-template commands,
  stage-package plan state transitions, stage creation, score recalculation,
  finalization, audit writes, and access-context reads.
- Counterargument: line count alone is not enough. The stage-package plan and
  recalculation paths are stateful and should not be moved just to reduce file
  size.
- Decision: record a boundary and test map first. The first future code slice
  should be a small read/audit boundary, not a broad backend competition split.
- Risk: LOW for this documentation slice. Future code movement is MEDIUM by
  default and HIGH for plan state transitions, score recalculation,
  finalization, or authorization/access helpers.
- Door: two-way door for this docs-only inventory; future extraction PRs must
  remain normal squash-revert changes.
- Stop rule: stop before implementation if a split changes SQL semantics,
  query output shape, API response shape, auth/scope behavior, audit metadata,
  DB schema, stage-package state rules, or scoring/finalization behavior.

## Current Shape

Primary file:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.ts`
  - 1839 physical lines on `origin/main` after PR #358.

Adjacent support files already present:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.mapper.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.audit.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.db.ts`
- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.team-template-queries.ts`

Primary caller:

- `backend/nestjs/src/modules/store-ops/application/competition.service.ts`

Controller boundary:

- `backend/nestjs/src/modules/store-ops/web/competition.controller.ts`

Provider wiring:

- `backend/nestjs/src/modules/store-ops/store-ops.module.ts`

Frontend surface using the same workflows:

- `admin-web/src/features/competitions/StageBuilderForm.tsx`
- `admin-web/src/features/competitions/stage-builder-package-section.tsx`
- `admin-web/e2e/competition-surfaces.spec.ts`

## Method Families

### Access And Scope Reads

Methods:

- `hasReadScope`
- `listStoreAccessContexts`
- `getCompetitionAccessContext`
- `getCompetitionIdForStage`
- `getTeamTemplateAccessContext`
- `getStagePackagePlanForAccess`

Observed risk:

- Medium-to-high despite being read-only because these methods feed service
  authorization checks for competition admin scope, stage admin scope, team
  template admin scope, store selection validation, and stage-package plan
  access.

Likely future boundary:

- `CompetitionAccessReadRepository`

Split guidance:

- Do not move this first unless the PR includes focused service access tests.
- If moved, keep method names, returned context shape, SQL filtering, and
  fail-closed behavior unchanged.

### Competition List, Detail, Contribution, Score, And Warning Reads

Methods:

- `listCompetitions`
- `getCompetitionDetail`
- `listStoreContributionsForCompetition`
- `listStages`
- `listTeams`
- `listLatestScores`
- `listWarningsForCompetition`

Observed risk:

- Medium. These are read-only, but they control store/company/region scope,
  owner-user fallback, redacted team-store detail, latest scores, warnings, and
  scoped store contribution rows.

Likely future boundary:

- `CompetitionReadRepository`

Split guidance:

- Good candidate after the smaller stage-package plan read/audit boundary.
- Include repository scope tests plus service redaction/scope tests.
- Stop if the frontend or API response shape needs changes.

Current status:

- In progress on the next code slice: `listCompetitions`,
  `getCompetitionDetail`, `listStoreContributionsForCompetition`, and the
  detail helper reads are extracted into `CompetitionReadRepository`.
- `CompetitionRepository` delegates these methods and remains responsible for
  access-context reads, team-template commands, stage/package writes,
  stage-package plan state transitions, score recalculation, and finalization.
- After this slice, `CompetitionRepository` is roughly 1518 physical lines and
  `CompetitionReadRepository` is roughly 336 physical lines.

### Team Template Reads And Commands

Methods:

- `listTeamTemplates`
- `createTeamTemplate`
- `deactivateTeamTemplate`
- `updateTeamTemplate`
- `cloneTeamTemplate`

Existing helper:

- `queryTeamTemplateRows`

Observed risk:

- Medium. The list/query helper is already partially isolated, but command
  methods write memberships and audit events. Store membership scope is checked
  in `CompetitionService`.

Likely future boundary:

- `CompetitionTeamTemplateRepository` or a smaller
  `CompetitionTeamTemplateReadRepository` followed by command extraction.

Split guidance:

- Do not mix this with stage-package plan state transitions.
- If command methods move, keep audit event names, membership replacement
  semantics, and clone-source-store semantics unchanged.

Current status:

- In progress on the next code slice: `listTeamTemplates` is extracted into
  `CompetitionTeamTemplateReadRepository`.
- Team-template command methods still live in `CompetitionRepository` and keep
  using the existing `queryTeamTemplateRows` helper to read back the updated
  template rows inside write transactions.
- `CompetitionRepository` is roughly 1516 physical lines after this slice, and
  `CompetitionTeamTemplateReadRepository` is roughly 23 physical lines.
- The command/write boundary decision is now recorded at
  `docs/plans/competition-team-template-command-boundary-decision-v1.md`.
  Future command extraction is allowed only for create/update/deactivate/clone
  team-template methods, with transaction, audit, membership replacement, and
  response-shape invariants preserved.
- The command/write extraction is now in progress as
  `CompetitionTeamTemplateCommandRepository`, with `CompetitionRepository`
  delegating create/update/deactivate/clone team-template methods. After this
  slice, `CompetitionRepository` is roughly 1432 physical lines and
  `CompetitionTeamTemplateCommandRepository` is roughly 254 physical lines.
  Access-context helpers, stage-package writes, stage creation/execution, score
  recalculation, and finalization stay parked.

### Stage Creation And Stage Package Execution

Methods:

- `createStageWithTeams`
- `createStagePackage`
- `executeStagePackagePlan`
- `insertStageWithTeams`

Observed risk:

- High relative to normal refactor. These methods create competition stages,
  teams, team-store memberships, and audit rows inside transactions. Executing
  an approved package plan must stay exactly once and must preserve created
  stage IDs.

Likely future boundary:

- `CompetitionStageWriteRepository`

Split guidance:

- Do not move before the read/audit boundaries are stable.
- Keep transactional behavior, `FOR UPDATE` locking, audit metadata, and
  created-stage ordering unchanged.

### Stage Package Plan Read, Audit, And State Machine

Methods:

- `listStagePackagePlans`
- `createStagePackagePlan`
- `updateStagePackagePlan`
- `submitStagePackagePlan`
- `approveStagePackagePlan`
- `rejectStagePackagePlan`
- `cloneStagePackagePlan`
- `cancelStagePackagePlan`
- `listStagePackagePlanAudit`
- `getStagePackagePlanForUpdate`

Observed risk:

- Read/audit methods are medium risk and reviewable.
- State-transition writes are high risk because they enforce draft/submitted/
  approved/rejected/executed/cancelled rules, review metadata, clone semantics,
  and audit rows.

Recommended first code boundary:

- Extract a small `CompetitionStagePackagePlanReadRepository` containing:
  - `listStagePackagePlans`
  - `listStagePackagePlanAudit`
  - optionally `getStagePackagePlanForAccess` only if service access tests are
    included and the fail-closed behavior stays unchanged.

Current status:

- Done for `listStagePackagePlans` and `listStagePackagePlanAudit`.
- `CompetitionRepository` is roughly 1792 physical lines after the slice, and
  `CompetitionStagePackagePlanReadRepository` is roughly 76 physical lines.
- Parked for `getStagePackagePlanForAccess` because it feeds service
  authorization checks and should move only with focused access/fail-closed
  tests.

Parked:

- create/update/submit/approve/reject/clone/cancel/execute state transitions.

### Score Recalculation And Finalization

Methods:

- `recalculateStage`
- `listOpenWarnings`
- `finalizeStage`

Observed risk:

- High. `recalculateStage` rewrites score snapshots and warnings from closed
  daily store facts and checklist facts. `finalizeStage` writes finalization
  state and audited override metadata.

Likely future boundary:

- `CompetitionStageScoringRepository`

Split guidance:

- Do not move until a concrete product/risk change touches stage scoring or
  finalization.
- If moved, keep all SQL, delete/insert ordering, row-count metadata, warning
  generation, ranking calculation, and audit metadata unchanged.

## Test Map

Repository tests:

- `backend/nestjs/src/modules/store-ops/infrastructure/competition.repository.spec.ts`
  - stage creation audit and advancement rule
  - package execution transaction and executable-state guards
  - score recalculation SQL contract
  - finalization audit metadata
  - scoped contribution reads
  - empty-scope short-circuit
  - owner-user text comparison for list/detail reads
- `backend/nestjs/src/modules/store-ops/infrastructure/competition-team-template.repository.spec.ts`
  - active/inactive template reads
  - create/deactivate/update/clone command SQL and audit metadata
- `backend/nestjs/src/modules/store-ops/infrastructure/competition-stage-package-plan.repository.spec.ts`
  - list stage package plans
  - save/update/cancel/submit/approve/reject/clone state transitions
  - non-editable/non-cloneable guards
  - audit event reads

Service tests:

- `backend/nestjs/src/modules/store-ops/application/competition.service.spec.ts`
  - stage/package command orchestration
  - package plan state commands
  - finalization override rules
  - scoped competition detail and store redaction
  - store manager assigned-store read behavior
  - company-scope redaction
- `backend/nestjs/src/modules/store-ops/application/competition-team-template.service.spec.ts`
  - template validation, scope checks, create/update/deactivate/clone behavior

Frontend E2E:

- `admin-web/e2e/competition-surfaces.spec.ts`
  - admin list/detail read surface
  - stage builder stage creation
  - package creation
  - save/submit/approve/execute/reject/edit/cancel plan flows
  - team template create/apply/deactivate/update/clone flows
  - region manager read-only scoped surface

## Recommended Extraction Order

1. Done: `CompetitionStagePackagePlanReadRepository`
   - Move plan list and audit reads first.
   - `getStagePackagePlanForAccess` remains parked because it is
     auth-adjacent.
   - Do not move state-transition writes in the same PR.
2. Done: `CompetitionReadRepository`
   - Move competition list/detail/contribution/detail-helper reads after the
     first small read boundary proves the provider split.
   - Extracted these reads without moving access-context helpers
     or write/state-machine behavior.
3. `CompetitionTeamTemplateReadRepository`
   - Move read/access pieces before command methods if template work becomes
     active.
   - Current slice extracts `listTeamTemplates` only.
4. `CompetitionTeamTemplateRepository` command boundary
   - Move create/deactivate/update/clone together only with repository and
     service tests.
5. Stage-package plan command state machine
   - Move only after a dedicated decision on state-transition invariants.
6. Stage creation/package execution boundary
   - Move after package-plan read/audit and command boundaries are stable.
7. Score recalculation/finalization boundary
   - Last, and only with concrete scoring/finalization risk or product work.
8. Access-context boundary
   - Move separately if access helpers remain noisy after read boundaries;
     treat as auth-adjacent and require service negative tests.

## Recommended First Implementation Slice

Preferred first code PR:

- Extract `CompetitionStagePackagePlanReadRepository` for stage-package plan
  list/audit reads.

Status:

- Done for list/audit reads only.
- `getStagePackagePlanForAccess` is intentionally not part of this first code
  slice.

Reason:

- It is smaller and more reviewable than a full competition read split.
- It supports the StageBuilder/package-plan surface that was just decomposed on
  the frontend.
- It has focused repository and service tests.
- It avoids the high-risk state-transition, execution, scoring, and
  finalization paths.

Possible inclusion:

- Include `getStagePackagePlanForAccess` only if the diff remains one coherent
  read/access PR and the service access tests are part of the gate.

## Verification Ladder For First Code Slice

For a stage-package plan read/audit extraction:

```powershell
npm.cmd --prefix backend/nestjs test -- competition-stage-package-plan.repository.spec.ts --runInBand
npm.cmd --prefix backend/nestjs test -- competition.service.spec.ts --runInBand
npm.cmd --prefix backend/nestjs run build
```

If provider wiring expands beyond the small boundary or `getStagePackagePlanForAccess`
moves:

```powershell
npm.cmd --prefix backend/nestjs test -- competition.repository.spec.ts --runInBand
npm.cmd --prefix admin-web run test:e2e -- competition-surfaces.spec.ts --workers=1
npm.cmd --prefix backend/nestjs test -- --runInBand
```

## Stop Rules For Implementation

Stop and re-plan if a future code PR:

- changes stage-package plan status transitions,
- changes created stage IDs or execution locking,
- changes audit event names or metadata shape,
- changes competition list/detail/contribution response shape,
- changes owner-user fallback or store/company/region scope filters,
- changes service authorization or fail-closed behavior,
- requires a DB migration or index,
- mixes backend repository extraction with frontend StageBuilder UI changes,
- cannot be explained as one repository boundary in one paragraph,
- fails targeted competition tests for a reason that is not fully understood.

## What This Inventory Changes

Nothing at runtime.

It narrowed the first safe backend refactor from "split competition repository"
to a reviewable first code slice: stage-package plan list/audit extraction.
Full state-machine writes, scoring, finalization, and access-context changes
remain parked until they have a tighter invariant and test decision.
