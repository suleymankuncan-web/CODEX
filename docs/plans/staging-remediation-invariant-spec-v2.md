# Staging Remediation Invariant Specification V2

Status: `implementation_ready_evidence_gated`
Shelf: architecture
Owner: Product owner
Implementation: REM-2B
Last verified: 2026-07-12
Query set: `staging-remediation-invariant-v2`

## 1. Purpose And Boundary

V2 expresses the revised business semantics locked in REM-2 without changing
the immutable V1 query, specification, or evidence. It is a read-only evidence
contract. It does not correct a row, add a constraint, change an API, or approve
staging execution.

The following gates remain closed:

- `D-STAGING-MUTATION = NOT_READY`
- `D-CONSTRAINT-WINDOW = NOT_READY`

The V2 runner may be implemented and tested against local/disposable fixtures.
After merge, one staging execution still requires an exact target confirmation
and bounded run-window approval. The transaction contract is
`REPEATABLE READ READ ONLY`.

## 2. Immutable Baseline

These V1 artifacts remain byte-for-byte immutable:

| Artifact | Canonical SHA-256 |
| --- | --- |
| `db/preflight/database-invariant-preflight-v1.sql` | `f6d33e91aa5ba76a6026b419d1df2692640222453727d7ec227d6d61474394cd` |
| `docs/plans/database-invariant-preflight-spec-v1.md` | `61b6baf10cc993fc1a5bfe9eefd5760cdd50c23d4f54e63e36b6300d46b4109a` |
| `docs/evidence/readiness/2026-07-11-dg2-staging-invariant-preflight-v1.md` | `94c4f49099d2e8b64bcf5b692f2101172915e52639938ca094bbfbffb0a32c6d` |

V1 stays the continuity baseline. V2 becomes an active semantic candidate only
after its implementation PR merges and a later owner-approved evidence run
produces a valid receipt.

## 3. Locked Decision Trace

| Decision | V2 effect |
| --- | --- |
| `REM2-TARGET-02-PILOT-20260712` | Ordinary requests compare count to JSON; pilot imports compare count to approved personnel references. |
| `REM2-ORG04-KPI-PERIOD-END-20260712` | Monthly store KPI region uses the Region Manager portfolio effective on the month’s final day. |
| `REM2-ORG04-NORM-LIFECYCLE-20260712` | Closed plans preserve history; active/future mismatches remain hits requiring an approved superseding lifecycle. |
| `REM2-ORG02-ASSIGNMENT-LIFECYCLE-20260712` | Active assignment region follows current store authority; closed history is not compared to today’s store region. |
| `REM2-ASSIGN01-PRIMARY-SUPPORT-20260712` | Concurrent support is secondary; an employee with open assignments has exactly one open primary. |
| `REM2-ASSIGN01-WINNER-ROTATION-20260712` | Primary ranges use inclusive end dates; a successor cannot start until after the prior end date. Row winners still require separate secure evidence. |

Restore and concurrency decisions remain future correction preconditions. They
do not authorize a backup, service pause, staging read, DML, or DDL here.

## 4. Active V2 Invariants

### 4.1 Target requests

`target.ordinary_count_matches_json` applies when the target label is not the
reviewed pilot-import label. A JSON array is required by the unchanged
`TARGET-01` contract; V2 reports a hit when the stored count differs from the
array length.

`target.pilot_count_matches_approved_references` applies only to the reviewed
pilot-import label. It reports a hit when:

- the stored count differs from the number of `approved` personnel target
  references for the request; or
- approved references repeat the same employee, period and target type.

Superseded and voided references are not active pilot count authority. V2 does
not rebuild JSON or mutate preserved imported requests.

### 4.2 KPI period-end manager portfolio

`org.kpi_period_end_manager` applies to store-scoped KPI actuals with a store
and region. The authority date is the month’s final calendar day computed from
the KPI row’s `period_start`; a malformed `period_end` cannot redefine the
ownership rule.

A candidate manager must have an effective `REGION_MANAGER` role assignment at
that date and must own the store either through an effective store-scoped role
assignment or an effective action-store assignment attached to the manager’s
region-scoped role. Zero candidates is `missing`; multiple effective role
assignment rows are `ambiguous` even when they repeat the same user/region;
both fail closed. Exactly one candidate establishes the expected region
portfolio.

This rule does not compare a closed KPI month to the store’s later current
region. It also does not guess when effective-dated manager evidence is absent.

### 4.3 Norm Kadro lifecycle

`norm.lifecycle_manager` classifies a plan relative to the transaction’s UTC
observation date:

- `period_end < observed_on`: closed; preserve historical scope and omit the
  current-manager mismatch from V2;
- `period_start <= observed_on <= period_end`: active; use `observed_on` as the
  manager authority date;
- `period_start > observed_on`: future; use `period_start` as the authority
  date.

Active/future rows with missing, ambiguous, company-mismatched or
region-mismatched authority remain hits. Their correction direction is an
approved replacement/supersession workflow. V2 performs no direct update and
does not claim the current schema already proves a supersession chain.

### 4.4 Assignment-region lifecycle

`assignment.lifecycle_region` keeps employee/store/position company checks.
For the assignment-region/store-region part:

- active-now rows must match the store’s current region portfolio;
- closed rows preserve their period region;
- future rows wait until activation;
- an inconsistent status/date shape fails closed as
  `assignment.active_lifecycle_invalid`.

V2 never rewrites a closed assignment to match a later store rotation.

### 4.5 Primary and support assignments

`assignment.exactly_one_open_primary` counts open active assignments per
employee. Secondary support may overlap, but zero or more than one open primary
is a hit.

`assignment.primary_ranges_non_overlapping` compares only active primary rows.
PostgreSQL inclusive ranges (`[]`) make a successor starting on the prior
assignment’s end date a same-day primary handoff hit. A valid successor starts
on a later date. Strict multi-day primary overlap is a separate reason. The
query never selects a winning row.

## 5. Exact V1-To-V2 Bridge

Each family compares sanitized internal record keys inside the one SQL
statement. Raw keys never enter the result. For every family:

- `carriedForwardCount`: record exists in both V1 and V2 result sets;
- `revisedValidCount`: record exists only in V1 and is valid under the locked
  revised semantics;
- `v2NewCount`: record exists only in V2 because the revised contract adds a
  fail-closed requirement;
- `v1HitCount` and `v2HitCount`: total record hits under each version.

The validator requires both equations exactly:

```text
V1 = carriedForwardCount + revisedValidCount
V2 = carriedForwardCount + v2NewCount
```

All four families (`TARGET-02`, `ORG-04`, `ORG-02`, `ASSIGN-01`) must be
present even when their counts are zero. Missing families, duplicate totals,
unknown codes, dishonest totals, or a broken equation reject the complete
receipt.

## 6. Output And Privacy Contract

The SQL emits one JSON document containing:

- query-set version and UTC observation instant;
- per-invariant typed reason/source aggregates;
- family and overall check-hit totals;
- at most five 12-character hashed references per aggregate; and
- the exact four-family bridge.

The runner wraps it in a canonical SHA-256 receipt binding:

- reviewed merge commit;
- query and runner digests;
- opaque target fingerprint;
- target class and TLS/certificate state;
- exact timeout profile;
- proven transaction isolation and read-only state; and
- the V2 query result.

Database URLs, host/database names, CA material, credentials, raw UUIDs,
personnel fields and business payloads are forbidden. Extra fields and
reason/source combinations borrowed from another invariant fail closed.

## 7. Acceptance Criteria

- **AC-V2-01 / FR-SCOPE-01 / FR-DEC-08 / AC-11:** V1 hashes remain unchanged
  and V2 is a separate query/spec/runner/contract.
- **AC-V2-02 / NFR-02..04:** one read-only repeatable-read snapshot owns query,
  bridge and receipt; no sensitive value is emitted.
- **AC-V2-03 / AC-03:** ordinary and pilot target authority are separated and
  duplicate approved pilot references fail closed.
- **AC-V2-04 / AC-04:** KPI and Norm Kadro use their locked period/lifecycle
  semantics; missing/ambiguous manager evidence is not guessed.
- **AC-V2-05 / AC-04, AC-05:** active assignment region, closed history,
  secondary support, exactly one open primary and inclusive date behavior are
  separately represented.
- **AC-V2-06 / AC-11:** bridge equations and family totals reconcile exactly.
- **AC-V2-07 / AC-01, AC-12:** receipt digest, reviewed SHA, verify-full state,
  typed schema and sanitizer all validate before stdout.

## 8. Adversarial Fixtures

Contract tests cover incomplete family catalogs, dishonest bridge equations,
wrong reason/invariant combinations, wrong source/invariant combinations,
extra fields, unbounded or malformed sample references, unsafe serialized
content and digest tampering. SQL/disposable fixtures cover ordinary versus
pilot targets, missing/ambiguous period-end manager authority, closed versus
active/future Norm Kadro, active versus closed assignment region, secondary
support, missing/multiple primary, same-day primary handoff and strict overlap.

## 9. Stop Rules

Stop without retry when:

- V1 hash changes;
- SQL can mutate or the transaction is not proven repeatable-read/read-only;
- manager or rotation authority is missing/ambiguous;
- any bridge equation or total is dishonest;
- output may contain sensitive or unbounded data;
- reviewed SHA, query/runner digest, target identity or certificate proof
  differs from the approved run contract;
- a query/runner change is attempted in an evidence-only PR; or
- staging access, DML, DDL, backup, service pause, paid service or production
  operation is attempted without its separate explicit authority.

## 10. Contract Impact

Contract Impact: intentionally changed for internal invariant interpretation.

- Public API/OpenAPI/auth/UI/runtime application behavior: unchanged.
- Database schema, migrations and business rows: unchanged.
- V1 evidence and query: unchanged.
- New behavior: versioned read-only internal evidence semantics only.
