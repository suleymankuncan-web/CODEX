# Database Invariant Preflight Specification V1

Status: specified; local tooling implementation pending
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
- `NODE_ENV` not equal to `production`;
- a transaction proven by `SHOW transaction_read_only` after `BEGIN READ ONLY`;
- a bounded local statement timeout.

The URL, credentials, host, database name, row contents, names, emails, phone
numbers, seller codes, and external references must never be printed.

No live run is authorized until a safe database target is supplied and
approved. Missing input is a recorded block, not evidence of clean data.

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
- overall decision: `clean_local`, `blocked_violations`, or
  `blocked_live_evidence`.

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
- disposable known-violation transaction smoke;
- disposable clean migration smoke;
- root script contracts;
- applicable release selector;
- no live execution in this PR without separately approved input.

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

## 10. Contract Impact

Contract Impact: none.

- API/OpenAPI/auth: unchanged.
- Database schema/migrations/data: unchanged.
- Supabase Data API/RLS/grants: unchanged.
- Runtime application behavior: unchanged.
- New artifact: read-only, input-gated evidence tooling only.
