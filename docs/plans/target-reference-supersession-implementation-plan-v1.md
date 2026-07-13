# Target Reference Supersession Implementation Plan V1

Status: `approved_execution`
Shelf: operating
Risk: `R5 DB/workflow/API contract`
Approved: 2026-07-13
Base: `0bc86879420693aa0b231b71d2562a4730cadf8b`
Specification: `docs/plans/target-reference-supersession-spec-v1.md`

## Objective

Implement the approved target-reference lifecycle as one vertical, reversible
PR. Ordinary target approval becomes append-only and concurrency-safe, pilot
import becomes initial-create-only, and the Store target revision flow sends an
exact base/removal contract. Existing first-request behavior remains backward
compatible.

## Contract Impact

`Contract Impact: changed`

- Add optional `revision.baseReferenceIds` and `revision.removedEmployeeIds` to
  the existing create-request input.
- Add an action-scoped read-only `revision-basis` endpoint.
- Allow six TREF codes in the existing standard error-envelope `code` field.
- Preserve existing response shapes, roles, permissions, scoring formulas,
  snapshot identity, DB schema, and existing approval evidence.
- Change target-reference persistence from overwrite to append-only lifecycle.

## Explicit Boundaries

- No migration, schema edit, staging/production DML or DDL, provider change,
  auth-policy widening, score change, data repair, closed-period rerun, or paid
  service operation.
- No inference from created/updated timestamps.
- No legacy writer may continue silent replacement after this PR.
- GitHub Codex review remains disabled.

## Locked Implementation Decisions

1. Legacy approval evidence remains intact. New `targetRevision` lineage and
   audit metadata contain identifiers, reason presence/class, and outcome only.
2. The revision input is optional; existing initial requests remain compatible.
3. `revision-basis` returns the complete active set for exact store/month,
   including employees absent from the current roster, under store action scope.
4. Every base employee is retained or explicitly removed. A newly eligible
   primary employee may be added without a predecessor.
5. Primary-store eligibility is checked inside the approval transaction at the
   DB business date in Europe/Istanbul. Support never qualifies.
6. Adjusted approval may change values/notes only; it cannot change the submitted
   employee/removal set.
7. The existing error-envelope shape is unchanged; only six TREF codes are
   allowlisted, never arbitrary exception values.
8. Existing schema is sufficient. Any contradiction stops implementation.

## Implementation Slices And TDD Order

### S1 — Contract and revision basis

RED then GREEN, one behavior at a time:

- optional revision DTO validation: UUIDs, uniqueness, disjoint sets and reason;
- read-only revision-basis query DTO, controller, service and repository;
- action-scope positive/negative coverage;
- additive OpenAPI and generated frontend types;
- Store target API/model and revision UI exact payload, explicit removals and
  newly eligible allocation support.

Owned areas:

- `backend/nestjs/src/modules/store-ops/web/dto/`
- `backend/nestjs/src/modules/store-ops/web/target-distribution.controller.ts`
- target distribution application/repository tests and implementation;
- `docs/api/openapi.json`, generated frontend types;
- `admin-web/src/features/targets/`, `StoreTargetsPage.tsx`, targeted tests/E2E.

### S2 — Shared append-only lifecycle

Create a small infrastructure lifecycle component used by ordinary approval and
pilot import. Tests must prove:

- request lock and `pending_region_approval` old-value predicate;
- fresh action-store authority and primary eligibility inside transaction;
- exact completed-monthly-snapshot rejection, including global empty
  `company_ids` semantics;
- deterministic sorted employee and active-reference locks;
- complete base reconciliation, explicit terminal removal and eligible newcomer;
- predecessor `status='approved' RETURNING` old-value predicate;
- successor insert with exact link, no `ON CONFLICT DO UPDATE`;
- atomic request/reference/evidence/audit commit and rollback;
- snapshot reference identity remains unchanged.

### S3 — Pilot writer and typed conflicts

- Pilot import inserts only when no active key exists.
- Exact replay is a no-op and does not rewrite request totals or audit history.
- Any differing value/store/region/source collision returns the typed import
  conflict and instructs the ordinary revision flow.
- Standard error filter exposes only the six allowlisted TREF codes in its
  existing envelope and preserves generic codes elsewhere.
- A static writer inventory fails if another target-reference writer appears or
  either writer contains active-row `DO UPDATE` replacement.

### S4 — Disposable PostgreSQL proof

Add a localhost/safe-database-only disposable smoke that proves real PostgreSQL
locking, concurrent approval serialization, injected rollback, terminal removal,
newcomer insertion, pilot replay/conflict and snapshot FK immutability. It MUST
reject staging, production and arbitrary database targets and MUST roll back or
clean its disposable fixture.

## Traceability

| Contract | Primary proof |
| --- | --- |
| FR-01/AC-01/AC-06/EC-02/EC-14 | request-state service/repository/integration tests |
| FR-02/FR-07/AC-07/AC-08/EC-07/EC-08/EC-15 | action scope and primary-assignment tests |
| FR-03..05/AC-02/AC-04/AC-05/EC-03..06/EC-13 | lifecycle unit + disposable concurrency/rollback |
| FR-06/FR-15/AC-03/AC-12/EC-10 | snapshot close and immutable reference tests |
| FR-08/AC-09/EC-09 | manager-responsibility no-rewrite tests |
| FR-09/FR-16/AC-10/EC-12 | writer inventory and pilot import tests |
| FR-10/AC-14/NFR-04 | sanitized lineage/audit negative assertions |
| FR-11/NFR-03 | allowlisted standard-envelope integration tests |
| FR-13/FR-14/AC-11/EC-11/EC-15 | basis/create/adjusted-set/reconciliation tests |
| NFR-01/02/05/06 | atomicity, deterministic concurrency, bounded statements, rollback |
| NFR-07 | schema/migration diff guard |
| NFR-08 | complete writer inventory |

AC-13 is the historical TREF-1 docs-only acceptance already closed by PR #979;
it is not a no-runtime condition for this separately authorized implementation.

## Verification Ladder

1. Targeted Jest for DTO, service, repository, lifecycle, pilot and error filter.
2. Targeted frontend Vitest/Playwright for the Store target revision flow.
3. OpenAPI generate/check and generated-client drift check.
4. Writer-inventory and disposable PostgreSQL smoke.
5. Backend `check:release` and frontend affected release checks.
6. Affected selector, then one canonical root `check:release`.
7. R5 read-only `problem_solver_high` adversarial diff review.
8. Required GitHub/Vercel checks, clean mergeability, squash merge and exact-tree
   post-merge verification.

Never run two full release suites concurrently.

## Rollback

- Before merge: discard only this branch through normal PR closure; do not touch
  unrelated worktrees/branches.
- After merge but before real revision use: pause target approval and pilot
  import, squash-revert this PR, run the canonical release path.
- After append-only rows exist: do not resume legacy overwrite writers. Pause
  commands and ship a tested forward fix or separately authorized data plan.
- Transaction failures roll back; no compensating destructive edit is allowed.

## Stop Rules

Stop and re-plan if a migration is needed; a new writer appears; exact base set
cannot be read; fresh action/primary authority cannot be proven; existing data
requires repair; real concurrency cannot be demonstrated; permissions, scoring,
snapshot semantics or existing response shapes must change beyond this plan; a
privacy leak appears; or staging/production access becomes necessary.

## Completion

Complete only when every mapped FR/NFR/AC/EC proof is green, the R5 High review
has no blocker, the PR is current/mergeable with all required checks green, the
squash merge is verified on `origin/main`, and operating truth records no hidden
follow-up implementation writer.

## Execution evidence (2026-07-13)

- Implementation scope: one vertical R5 slice; no migration, staging,
  production, destructive data operation or new provider dependency.
- Targeted backend proof: 8 suites, 57 tests green, including request-state,
  transaction totals, exact basis reconciliation, completed-period closure,
  UUID normalization, multi-hop rotation, pilot replay/conflict, typed errors
  and recursive writer inventory.
- Frontend proof: production build and two focused Playwright revision tests
  green, including inherited basis without a local approved request.
- Contract proof: OpenAPI generation and generated-client drift check green.
- PostgreSQL proof: the compiled real repository passed disposable initial,
  concurrent one-winner revision, terminal removal, eligible newcomer, pilot
  replay/conflict, rollback and snapshot-identity checks.
- Process proof: current-state/project-control guards 13/13 green; backend and
  frontend lint green; diff check and migration-diff guard green.
- Required R5 read-only High review: GO after closing allocation/replay/closure,
  UUID, rotation, inherited-basis, real-repository proof and writer-inventory
  blockers.
- Canonical root release: green in `823.1s` after refreshing the generated
  system-flow inventory and adding the revision-basis pilot-smoke fixture.
  PR/main closeout remains the final gate.
