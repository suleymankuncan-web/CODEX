# Store Action V1B Schema V1

## Scope

This evidence records the first Store Action V1B implementation kademe:
the persisted action-plan schema contract and migration.

It does not add a controller, endpoint, service command, repository command,
OpenAPI schema, generated frontend client, workflow inbox source, UI behavior,
audit event write, KPI scoring change, checklist rule, target approval change,
or auth semantic change.

## Sokrates Decision

Decision:

- Add only the `ops.store_action_plan` table, indexes, comment, and schema
  contract.
- Keep runtime behavior unchanged until service, audit, API, workflow, and UI
  kademeleri are implemented separately.

Why now:

- The V1B design PR defined the table, lifecycle, source boundary, and rollback
  shape.
- The smallest reversible implementation step is schema plus contract guard.
- Later service/API work needs a stable table before it can be tested honestly.

Repo evidence:

- `docs/plans/store-action-v1b-persisted-action-plan-design-v1.md` defines the
  table and implementation order.
- `db/migrations/049_store_action_plan_v1.sql` adds the table with active
  source uniqueness.
- `db/schema.sql` keeps the canonical schema aligned for fresh database
  creation.
- `backend/nestjs/src/modules/store-ops/store-action-plan-schema-contract.spec.ts`
  guards the migration and canonical schema.

Counterargument:

- Adding DB schema before runtime code can feel premature. In this feature it
  is the safer order because it freezes the lifecycle and rollback shape before
  command code appears.

Risk:

- MEDIUM. This is a DB migration, but it is additive and does not touch existing
  tables or behavior.

Door:

- Near one-way after deployed, because database migrations require release
  discipline. The rollback shape remains simple: drop the active-source unique
  index, other indexes, and `ops.store_action_plan`.

## Schema Boundary

The table stores Store Action follow-up state only:

- source: `kpi_exception` only,
- owner and creator: `ops.user_account`,
- scope: company, region, store,
- lifecycle: `open`, `in_progress`, `blocked`, `closed`, `cancelled`,
- terminal evidence: `resolution_note` for closed and `cancel_reason` for
  cancelled.

The schema does not store or mutate:

- KPI score math,
- checklist score or acknowledgement state,
- target approval or target reference promotion,
- workflow inbox state,
- notification or escalation state.

## Verification

Passed locally:

```powershell
npm.cmd --prefix backend/nestjs test -- store-action-plan-schema-contract.spec.ts
node --test scripts/store-action-v1b-schema-contract.test.mjs
npm.cmd run test:scripts
npm.cmd run smoke:migration:fresh-db
npm.cmd --prefix backend/nestjs run check:release
```

Result:

```text
Test Suites: 1 passed, 1 total
Tests: 5 passed, 5 total
store action V1B schema guard: 4 passed, 0 failed
test:scripts: 309 passed, 0 failed
fresh migration smoke: 49/49 migrations applied, failed=0, ops tables=40
backend check:release: lint passed, 118 suites / 683 tests passed, build passed, prod audit 0 vulnerabilities
```

Release note:

- The first PR run exposed a transitive production-audit blocker in
  `qs@6.15.1`. `backend/nestjs` now overrides `qs` to `6.15.2`, which keeps
  the existing backend release gate green without changing application code.
- Codex review also found that the first schema contract concatenated canonical
  schema and migration text. The guard now validates both files independently
  so one path cannot mask a broken migration path.
- A follow-up Codex review pointed out that the migration-number guard only
  rejected the exact old filename. The guard now rejects any stale `040`
  reference in the implementation plan.

## Next Kademe

Next safe implementation step:

- add audit catalog entries and lifecycle contract helpers,
- then repository/service command tests,
- do not expose API/UI before command authorization and audit are proven.
