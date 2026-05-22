# Store Action V1B Command Boundary V1

## Scope

This evidence records the third Store Action V1B implementation kademe:
backend service and repository command behavior for persisted action plans.

It does not add a controller, endpoint, OpenAPI schema, generated frontend
client, workflow inbox source, UI behavior, DB migration, KPI scoring change,
checklist rule, target approval change, or auth semantic change.

## Sokrates Decision

Decision:

- Add `StoreActionPlanService` as the command orchestration boundary.
- Add `StoreActionPlanRepository` as the SQL write and audit transaction
  boundary.
- Keep the feature unexposed until controller, DTO, OpenAPI, generated client,
  workflow, and UI kademeleri are separately tested.

Why now:

- The schema and lifecycle contract are in place.
- The next risk is not UI; it is write authorization, lifecycle enforcement,
  duplicate-source handling, and audit transaction integrity.

Repo evidence:

- `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.ts`
  enforces assigned-store action scope, required due date validation, lifecycle
  transitions, and concurrent write conflict mapping.
- `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.ts`
  inserts/updates `ops.store_action_plan`, guards lifecycle writes with the
  observed expected status, and writes `audit.event_log` in the same
  transaction.
- `backend/nestjs/src/modules/store-ops/application/store-action-plan.service.spec.ts`
  covers assigned-store create, broad-scope non-widening, duplicate active
  source conflict mapping, required due date validation, terminal update
  rejection, close evidence, cancel evidence, expected-state writes, and
  concurrent write conflict mapping.
- `backend/nestjs/src/modules/store-ops/infrastructure/store-action-plan.repository.spec.ts`
  covers create/status/close/cancel SQL, expected-state predicates, audit event
  writes, and no-audit conflict behavior when an expected lifecycle state no
  longer matches.

Counterargument:

- Adding command code before API/UI can feel invisible. Here it is safer
  because the write behavior is the riskiest part; exposing it before
  authorization and audit are proven would create a harder rollback story.

Risk:

- HIGH domain, controlled slice. It touches write/auth/audit behavior, but only
  inside unregistered backend classes and tests. No public runtime route can
  call it yet.

Door:

- Two-way before exposure. The PR is revertible as a normal squash commit
  because there is no new public endpoint, client contract, UI, migration, or
  provider config.

## Command Boundary

Implemented command behavior:

- Create plan only when `actorActionScope.assignedStoreIds` contains the target
  store.
- Resolve canonical company/region from existing store scope lookup.
- Do not use broad actor read scope as write permission.
- Require a due date before store scope resolution reaches the repository.
- Map active duplicate source uniqueness to `ConflictException`.
- Reject status updates from terminal plans.
- Pass the observed plan status into status/close/cancel writes as an expected
  state predicate.
- Treat zero-row lifecycle writes as transition conflicts and skip audit writes.
- Require resolution note before close.
- Require cancel reason before cancel.
- Write create/status/close/cancel audit events in the repository transaction.

Still not implemented:

- controller/DTO route exposure,
- OpenAPI/generated frontend client,
- `/store/tasks` UI mutation flow,
- workflow inbox action-plan source mapping,
- notifications or escalation,
- direct checklist/target source candidates.

## Verification

TDD red proof:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan.service.spec.ts store-action-plan.repository.spec.ts
```

Initial result: failed because `store-action-plan.service.ts` and
`store-action-plan.repository.ts` did not exist yet.

Passed locally:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan.service.spec.ts store-action-plan.repository.spec.ts
npm.cmd --prefix backend/nestjs test -- store-action-plan.service.spec.ts store-action-plan.repository.spec.ts store-action-plan.contract.spec.ts audit-event-catalog.spec.ts
npm.cmd --prefix backend/nestjs run lint
npm.cmd --prefix backend/nestjs run build
npm.cmd run test:scripts
npm.cmd --prefix backend/nestjs run check:release
git diff --check
```

Result:

```text
Store Action command targeted tests: 14 passed, 0 failed
Store Action command + contract + audit tests: 21 passed, 0 failed
test:scripts: 309 passed, 0 failed
backend check:release: 121 suites / 701 tests passed, build passed, audit 0 vulnerabilities
```

## Next Kademe

Next safe implementation step:

- register service/repository and expose DTO/controller endpoints,
- add OpenAPI schema and generated frontend client coverage,
- keep Store Tasks UI and workflow inbox integration for later kademeler unless
  the API command boundary is green.
