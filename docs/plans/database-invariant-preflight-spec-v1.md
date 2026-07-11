# Database Invariant Preflight Specification V1

Status: verify-full staging evidence completed; DB-CONSTRAINTS No-Go
Shelf: active plan
Author: Codex
Owner: Product owner
Last verified: 2026-07-10

## 1. Purpose

PR-9 creates read-only evidence tooling for candidate database invariants. It
does not add a constraint, migration, repair, index, trigger, grant, RLS policy,
or production-readiness claim. Its output decides whether PR-10 can be planned;
it cannot authorize PR-10 by itself without an approved safe-target run.

## 2. Current Schema Evidence

The canonical schema currently allows application-valid but database-invalid
hierarchies:

- `ops.store` references company and region independently, so the selected
  region can belong to another company.
- `ops.employee_assignment_history` references employee, store, region, and
  position independently.
- `ops.user_role_assignment` has no scope vocabulary/shape or hierarchy check.
- active primary employee assignments can overlap in time.
- `ops.target_distribution_request.allocation_count` duplicates the JSON array
  count and the JSON can contain duplicate employee identifiers.

Application services validate several of these paths, but direct SQL, import,
race, and future-code paths remain possible.

## 3. Provider And Execution Boundary

The tool uses a direct PostgreSQL connection only. It does not use Supabase
Data API, GraphQL, service-role keys, browser clients, RLS, or migration APIs.

Execution requires all of:

- an explicit target class of `disposable` or `staging`;
- an explicit acknowledgement value `read-only-approved`;
- a database URL supplied only through process environment;
- a disposable URL whose host is localhost and whose database name matches the
  fixed disposable preflight namespace; or, for staging, separately supplied
  expected host and database values that exactly match the URL;
- `NODE_ENV` not equal to `production`;
- staging `DB_SSL_MODE` equal to `verify-full` and a non-empty `DB_SSL_CA`;
- canonical runtime pool configuration, including removal of connection-string
  SSL overrides before applying the verified CA configuration;
- a single preflight pool connection;
- a transaction proven by `SHOW transaction_read_only` after `BEGIN READ ONLY`;
- a bounded local statement timeout.

The URL, credentials, host, database name, row contents, names, emails, phone
numbers, seller codes, and external references must never be printed.

No live run is authorized until a safe database target is supplied and
approved. Missing input is a recorded block, not evidence of clean data.
Staging execution additionally requires
`DATABASE_INVARIANT_PREFLIGHT_EXPECTED_HOST` and
`DATABASE_INVARIANT_PREFLIGHT_EXPECTED_DATABASE`. Host or database names marked
`prod` or `production` are refused even if the staging approval flag is set.
Staging also refuses `disable`, `require`, unknown/missing SSL modes, or a
missing CA before a pool connection is attempted. Disposable local smoke keeps
its existing non-TLS localhost path.

## 4. Check Inventory

| ID | Candidate | Evidence rule |
| --- | --- | --- |
| ORG-01 | Store company/region hierarchy | Store company differs from its region company |
| ORG-02 | Employee assignment hierarchy | Assignment store/region, employee company, or position company disagree |
| ORG-03 | Role assignment hierarchy | Assignment company/region/store identifiers disagree with canonical parents |
| ORG-04 | Scope-bearing business rows | Non-null company/region/store identifiers disagree in the explicitly inventoried operational/reporting tables |
| AUTH-01 | Role scope vocabulary and shape | Scope type is unknown or required/forbidden IDs do not match company/region/store shape |
| AUTH-02 | Role catalog/assignment scope | Assignment scope differs from role scope except the existing Region Manager store-scope exception |
| ASSIGN-01 | Primary assignment overlap | Two active primary ranges for one employee overlap; pair counted once |
| TARGET-01 | Allocation JSON shape | Allocation payload is not a JSON array |
| TARGET-02 | Allocation count parity | Stored count differs from JSON array length |
| TARGET-03 | Allocation employee uniqueness | One request repeats a non-empty employee ID |
| KEY-01 | Candidate parent key readiness | Candidate region/store composite key data is duplicate-free and catalog presence is reported |
| ENV-01 | PostgreSQL provider posture | Server version number and deprecated-extension presence are metadata only |

ORG-04 is not a dynamic guess. The implementation must keep an explicit table
inventory derived from the canonical schema so each table can have its own
scope/nullability semantics reviewed.

## 5. Output Contract

The command emits one JSON document:

- `event`: stable event name;
- `targetClass`: `disposable` or `staging`;
- `transactionReadOnly`: must be `true`;
- safe PostgreSQL version/extension metadata;
- one result per required check ID;
- `violationCount` as a non-negative integer;
- at most five stable sample references created as truncated hashes of internal
  identifiers;
- candidate classification and reason;
- local/approved-target decision: `clean_local`, `blocked_violations`, or
  `blocked_business_decision`;
- independent `liveEvidence`: `blocked_live_evidence` for disposable runs or
  `safe_target_run` for an explicitly approved staging run.

No raw identifier or row payload is emitted. A non-zero count returns a
non-success process status after printing sanitized evidence.

## 6. Candidate Classification

- `safe_to_enforce`: zero violations, current application semantics aligned,
  and no unresolved lock/performance prerequisite.
- `requires_data_correction`: one or more live violations; PR-10 blocked and no
  repair is performed.
- `requires_business_decision`: enforcement semantics are not yet approved,
  especially temporal primary-assignment overlap.
- `redundant_existing`: an equivalent canonical invariant already exists.
- `deferred_lock_or_performance`: data may be clean but validation/lock cost is
  not yet acceptable.
- `blocked_live_evidence`: no approved safe-target result exists.

ASSIGN-01 remains `requires_business_decision` even when a disposable fixture is
clean. A clean fixture proves tooling, not the owner-approved temporal rule.
TARGET-02 and TARGET-03 also remain `requires_business_decision` at zero because
the owner has not selected generated state, duplicate-state removal, a trigger,
or another enforcement model. KEY-01 remains
`deferred_lock_or_performance` while the composite keys are absent and staging
validation/lock cost is unmeasured.

Zero counts from a disposable target are classified `blocked_live_evidence`,
not `safe_to_enforce`. Only an approved staging zero can produce
`safe_to_enforce`, and that still does not override independent business or
lock/performance blocks.

## 7. Acceptance Criteria

### AC-01 — Fail-closed target gate

Without target class, acknowledgement, or database URL, the command refuses to
connect and prints no secret material.

### AC-02 — Database-enforced read only

The script begins a read-only transaction, verifies it, applies a timeout, and
rolls back/ends without executing a mutation statement.

### AC-03 — Known violation fixture

A disposable local transaction containing known hierarchy, scope, overlap, and
target-allocation violations produces the exact non-zero check IDs and rolls
back all fixture writes.

### AC-04 — Clean fixture

A freshly migrated disposable database reports zero violations for every data
check while retaining business-decision/live-evidence classifications.

### AC-05 — Redaction

Output contains counts and hashed samples only and rejects raw UUID, URL,
credential, email, phone, employee name, and external-reference patterns.

### AC-06 — Mutation guard

Contracts scan executable preflight SQL and fail on INSERT, UPDATE, DELETE,
MERGE, DDL, GRANT, function creation, or migration calls.

### AC-07 — Live evidence boundary

Disposable evidence never upgrades PR-10 to Go. Only a reviewed staging
safe-target result can classify live data cleanliness.

## 8. Verification

- static SQL mutation guard and required-check inventory;
- pure output/classification/redaction tests;
- spawned CLI refusal tests that prove missing/mismatched target inputs exit
  before connection without printing the URL;
- verified TLS, missing-CA, weak/unknown-mode, and connection-string override
  tests against the same pool builder used by runtime;
- disposable known-violation transaction smoke;
- disposable clean migration smoke;
- root script contracts;
- applicable release selector;
- no live execution in DG2-B; approved staging evidence belongs to DG2-C.

## 9. Rollback And Stop Rules

Rollback removes the preflight query, runner, tests, command, and documents.
There is no data rollback because the production preflight is read-only and the
disposable fixture rolls back.

Stop immediately if:

- `transaction_read_only` is not on;
- any preflight statement can mutate schema or data;
- output contains a raw identifier, secret, or personal field;
- a count is non-zero on an approved safe target;
- an invariant requires unapproved temporal semantics;
- validation cost or lock behavior is claimed without measurement;
- the target is production or its classification is uncertain.

## 10. Local Disposable Evidence — 2026-07-10

Command: `npm run smoke:database:invariants`

- 59/59 migrations applied to the fixed local disposable database;
- all 11 clean checks returned zero;
- the known-violation fixture returned the exact expected non-zero IDs and
  counts;
- fixture writes were rolled back and marker residue was zero;
- all emitted samples remained bounded 12-character hashes;
- the local provider was PostgreSQL 16; this is not staging/provider evidence;
- both candidate parent composite unique constraints are absent in the current
  schema;
- no validation-cost or lock claim was made from an empty database.

| Candidate | Local count | Current classification | PR-10 prerequisite |
| --- | ---: | --- | --- |
| ORG-01 through ORG-04 | 0 | `blocked_live_evidence` | Approved staging counts and domain constraint order |
| AUTH-01 and AUTH-02 | 0 | `blocked_live_evidence` | Approved staging counts and service/catalog compatibility |
| ASSIGN-01 | 0 | `requires_business_decision` | Owner-approved temporal overlap semantics plus staging count |
| TARGET-01 | 0 | `blocked_live_evidence` | Approved staging count |
| TARGET-02 and TARGET-03 | 0 | `requires_business_decision` | Owner-approved duplicate-state enforcement model plus staging count |
| KEY-01 | 0 | `deferred_lock_or_performance` | Approved staging count and measured validation/lock strategy |
| ENV-01 | PostgreSQL 16 local | `blocked_live_evidence` | Approved provider target metadata and extension inventory |

PR-10 decision: **No-Go / blocked**. Disposable evidence proves the query,
runner, redaction, known-violation detection, clean migration behavior, and
rollback. It does not prove live data cleanliness or choose unresolved business
semantics. No PR-10 branch, migration, repair, or constraint is authorized by
this result.

## 11. Approved Staging Evidence - 2026-07-12

The owner-confirmed, verify-full, read-only staging run is recorded in
`docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md`.
It completed with 70 total check hits: `ASSIGN-01=2`, `ORG-02=3`,
`ORG-04=11`, and `TARGET-02=54`; all other check counts were zero.

Decision: **No-Go for DB-CONSTRAINTS**. Non-zero rows require a separately
approved correction plan, while assignment/target semantics and candidate-key
lock/validation strategy remain unresolved. No repair or mutation occurred.

## 12. Contract Impact

Contract Impact: none.

- API/OpenAPI/auth: unchanged.
- Database schema/migrations/data: unchanged.
- Supabase Data API/RLS/grants: unchanged.
- Runtime application behavior: unchanged.
- New artifact: read-only, input-gated evidence tooling only.
